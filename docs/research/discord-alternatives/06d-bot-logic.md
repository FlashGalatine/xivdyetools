# Shared Libraries — `@xivdyetools/bot-logic`

**Parent document:** [06-shared-libraries.md](./06-shared-libraries.md)

Covers: Command orchestration layer, the three-part handler split, dependency injection for I/O, input resolution, extraction strategy.

---

## Purpose

Platform-agnostic command business logic — the "use case" layer that sits between input parsing and response formatting. Each function takes pure data inputs, computes results using `@xivdyetools/core` and `@xivdyetools/svg`, and returns pure data outputs. No HTTP responses, no Discord API calls, no KV reads, no WebSocket events.

This is the **most complex extraction** and should be done **last**, after `color-blending`, `svg`, and `bot-i18n` are stable.

---

## The Problem: Tangled Command Handlers

Currently, each Discord command handler does three things in one function:

```
handleHarmonyCommand(interaction, env, ctx, logger)
  │
  ├── 1. Parse Discord interaction options       ← Platform-specific
  │     Extract color, type, colorSpace from interaction.data.options
  │     Resolve user locale from KV
  │
  ├── 2. Business logic                          ← Platform-agnostic (EXTRACT THIS)
  │     resolveColorInput(colorInput)
  │     getHarmonyDyes(hex, type, options)
  │     Convert Dye[] to HarmonyDye[] with localized names
  │     generateHarmonyWheel(svgOptions)
  │     renderSvgToPng(svg)
  │     Build embed description with dye list
  │
  └── 3. Format Discord response                 ← Platform-specific
        editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
          embeds: [{ title, description, color, image, footer }],
          file: { name, data: pngBuffer, contentType }
        })
```

The Stoat Bot needs the same business logic (step 2) but with completely different input parsing (prefix commands instead of slash commands) and response formatting (SendableEmbed instead of Discord embed, Autumn CDN upload instead of Discord attachment).

---

## The Three-Part Split

After extraction, each command is split across three layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│ Bot-Specific (Discord Worker / Stoat Bot)                           │
│                                                                     │
│  1. INPUT ADAPTER                                                   │
│     Discord: Extract from interaction.data.options                  │
│     Stoat:   Parse from prefix command arguments                    │
│     Both:    Resolve user locale, validate permissions              │
│                                                                     │
│  → Produces: HarmonyInput { colorInput, harmonyType, colorSpace,   │
│                              locale }                               │
├─────────────────────────────────────────────────────────────────────┤
│ @xivdyetools/bot-logic (SHARED)                                    │
│                                                                     │
│  2. BUSINESS LOGIC                                                  │
│     resolveColorInput(input) → hex, dye                            │
│     getHarmonyDyes(hex, type) → Dye[]                              │
│     generateHarmonyWheel(options) → svgString                      │
│     Build embed data (title, description, fields)                  │
│                                                                     │
│  → Returns: HarmonyResult { svgString, baseDye, harmonyDyes,      │
│                              embedTitle, embedDescription,          │
│                              embedFields }                          │
├─────────────────────────────────────────────────────────────────────┤
│ Bot-Specific (Discord Worker / Stoat Bot)                           │
│                                                                     │
│  3. OUTPUT ADAPTER                                                  │
│     Discord: renderSvgToPng(svg), editOriginalResponse(embed)      │
│     Stoat:   renderSvgToPng(svg), uploadToAutumn(png),             │
│              channel.sendMessage({ embeds, masquerade })            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Package API

### Command Functions

Each command exports a single `execute*` function:

| Function | Input Type | Result Type | I/O Deps? |
|----------|-----------|-------------|-----------|
| `executeHarmony(input)` | `HarmonyInput` | `HarmonyResult` | No |
| `executeDyeInfo(input)` | `DyeInfoInput` | `DyeInfoResult` | No |
| `executeMixer(input)` | `MixerInput` | `MixerResult` | No |
| `executeMatch(input)` | `MatchInput` | `MatchResult` | No |
| `executeGradient(input)` | `GradientInput` | `GradientResult` | No |
| `executeComparison(input)` | `ComparisonInput` | `ComparisonResult` | No |
| `executeAccessibility(input)` | `AccessibilityInput` | `AccessibilityResult` | No |
| `executeRandom(input)` | `RandomInput` | `RandomResult` | No |
| `executeBudget(input, deps)` | `BudgetInput` | `BudgetResult` | **Yes** — price fetching |
| `executeExtract(input, deps)` | `ExtractInput` | `ExtractResult` | **Yes** — image fetching |
| `executePresetView(input, deps)` | `PresetViewInput` | `PresetViewResult` | **Yes** — preset API |

### Input/Result Type Pattern

Every command follows the same structural pattern:

```typescript
// Input: Pure data, no platform objects
interface HarmonyInput {
  /** Raw color input (hex code or dye name) */
  colorInput: string;
  /** Harmony type */
  harmonyType: 'triadic' | 'complementary' | 'analogous' | 'split-complementary'
    | 'tetradic' | 'square' | 'monochromatic';
  /** Optional color space for harmony calculation */
  colorSpace?: HarmonyColorSpace;
  /** User's locale for dye name localization */
  locale: LocaleCode;
}

// Result: Structured data, ready for platform-specific formatting
interface HarmonyResult {
  /** SVG string ready for rendering */
  svgString: string;
  /** Resolved base dye (null if input was a raw hex) */
  baseDye: Dye | null;
  /** Base color hex */
  baseHex: string;
  /** Localized base color name */
  baseName: string;
  /** Harmony dyes found */
  harmonyDyes: Dye[];
  /** Localized harmony type name */
  harmonyTypeName: string;
  /** Pre-formatted embed data */
  embed: {
    title: string;
    description: string;
    color: number;  // Decimal color for embed sidebar
  };
}
```

**Key property: `svgString`**

Every image-producing command returns an `svgString` in its result. The calling bot renders this to PNG using its own renderer. The SVG package generates the visual; the bot-logic package orchestrates when and how it's generated.

**Key property: `embed`**

Every command returns pre-built embed data (title, description, fields). The calling bot maps this to its platform's embed format:

```typescript
// Discord:
{
  title: result.embed.title,
  description: result.embed.description,
  color: result.embed.color,
  image: { url: 'attachment://harmony.png' },
  footer: { text: t.t('common.footer') }
}

// Stoat:
{
  title: result.embed.title,
  description: result.embed.description,
  colour: `#${result.embed.color.toString(16).padStart(6, '0')}`,
  media: fileId  // Autumn CDN file ID after upload
}
```

---

## Dependency Injection for I/O

Commands that need external data can't directly call KV, SQLite, or HTTP APIs. Instead, they accept a `deps` object with callback functions:

### Budget Command

```typescript
interface BudgetDeps {
  /** Fetch market prices for a list of item IDs on a world */
  fetchPrices: (world: string, itemIds: number[]) => Promise<Map<number, DyePriceData>>;
  /** Get the user's preferred world (from preferences) */
  getUserWorld: () => Promise<string | null>;
}

async function executeBudget(input: BudgetInput, deps: BudgetDeps): Promise<BudgetResult> {
  const world = input.world ?? await deps.getUserWorld();
  if (!world) {
    return { error: 'NO_WORLD_SET', /* ... */ };
  }

  // Get tradeable dye item IDs (filter out Facewear)
  const tradeableDyes = dyeService.getAllDyes().filter(d => d.itemID > 0);
  const itemIds = tradeableDyes.map(d => d.itemID);

  // Fetch prices via injected dependency
  const prices = await deps.fetchPrices(world, itemIds);

  // Business logic: rank by price, find alternatives, generate comparison SVG
  // ...
}
```

**Discord Worker provides:**

```typescript
executeBudget(input, {
  fetchPrices: (world, ids) => fetchPricesBatched(env.UNIVERSALIS_PROXY, world, ids),
  getUserWorld: () => getWorldPreference(env.KV, userId),
});
```

**Stoat Bot provides:**

```typescript
executeBudget(input, {
  fetchPrices: (world, ids) => fetchPricesViaProxy(proxyUrl, world, ids),
  getUserWorld: () => {
    const row = db.prepare('SELECT world FROM preferences WHERE user_id = ?').get(userId);
    return (row as any)?.world ?? null;
  },
});
```

### Extract Command

```typescript
interface ExtractDeps {
  /** Load and decode an image buffer, returning RGBA pixel data */
  processImage: (buffer: Buffer | Uint8Array) => Promise<{
    pixels: Uint8Array;
    width: number;
    height: number;
  }>;
}
```

**Discord Worker provides:** Photon WASM implementation.
**Stoat Bot provides:** sharp implementation.

The extract command's core logic (k-means clustering → dye matching → palette SVG generation) is platform-agnostic. Only the image decode/resize step differs.

### Preset View Command

```typescript
interface PresetDeps {
  /** Fetch a preset by ID from the preset API */
  fetchPreset: (presetId: string) => Promise<Preset | null>;
  /** Fetch presets by category */
  listPresets: (category: string, page: number) => Promise<PresetListResult>;
}
```

---

## Input Resolution (`resolveColorInput`, `resolveDyeInput`)

The color/dye resolution functions currently live in `discord-worker/src/utils/color.ts`. These are already platform-agnostic — they use `@xivdyetools/core`'s `DyeService` and don't touch any platform APIs.

### What Moves

```typescript
// From discord-worker/src/utils/color.ts:

/** Validate hex color format (3 or 6 digit, with or without #) */
export function isValidHex(input: string, options?: { allowShorthand?: boolean }): boolean;

/** Normalize hex to #RRGGBB uppercase format */
export function normalizeHex(hex: string): string;

/** Resolve color input: hex → dye name → CSS color name */
export function resolveColorInput(input: string, options?: ResolveColorOptions): ResolvedColor | null;

/** Resolve dye input: name → closest dye for hex */
export function resolveDyeInput(input: string): Dye | null;

// Types:
export interface ResolvedColor { hex: string; name?: string; id?: number; itemID?: number | null; dye?: Dye; }
export interface ResolveColorOptions { excludeFacewear?: boolean; findClosestForHex?: boolean; }
```

### CSS Color Name Resolution

`resolveColorInput()` currently falls back to CSS named colors (148 standard colors like "coral", "burlywood", "BlueViolet") via `resolveCssColorName()` from `discord-worker/src/utils/css-colors.ts`. This utility should also move to `bot-logic` since the Stoat Bot's prefix parser would benefit from the same fallback.

### Multi-Strategy Resolution for Stoat

The Stoat Bot's prefix commands need a richer resolver than Discord's slash command autocomplete. The `resolveDyeInput()` function already handles most cases:

1. **ItemID** (numeric) → O(1) hash map lookup
2. **English name** (exact/partial) → `dyeService.searchByName()`
3. **Localized name** → `dyeService.searchByLocalizedName()` (when locale ≠ en)
4. **CSS color name** → `resolveCssColorName()` fallback
5. **Hex code** → `findClosestDye()` for the nearest dye

The **ambiguity handling** (single match → execute, 2–4 matches → show all, 5+ → disambiguation) is Stoat-specific UX logic that stays in the Stoat Bot. The resolver just returns the matches — the bot decides what to do with them.

For the Stoat Bot, a new wrapper around `resolveColorInput` could return multiple candidates:

```typescript
// In bot-logic:
export function resolveColorInputMulti(
  input: string,
  locale: LocaleCode,
  options?: ResolveColorOptions
): ResolvedColor[] {
  // 1. Try exact match first (returns 0 or 1)
  // 2. Try partial match (returns 0-N)
  // 3. Try localized name match
  // 4. Try CSS color name
  // Return all candidates, sorted by relevance
}

// Bot decides:
// Discord: always use first match (autocomplete already narrowed)
// Stoat: show all (2-4) or disambiguate (5+)
```

---

## Error Handling Pattern

Command functions return errors as **data**, not exceptions:

```typescript
interface HarmonyResult {
  // Success case:
  svgString?: string;
  baseDye?: Dye | null;
  embed?: { title: string; description: string; color: number };

  // Error case:
  error?: 'INVALID_COLOR' | 'NO_MATCH' | 'GENERATION_FAILED';
  errorMessage?: string;
}
```

**Why not throw?** Each bot handles errors differently:
- Discord: ephemeral error embed with `flags: 64`
- Stoat: public reply with error message

The command function doesn't know which it is. It returns the error kind, and the bot formats it appropriately. The `errorMessage` is pre-translated using `bot-i18n` (the command receives the `Translator` or locale, and produces localized error strings).

**Alternative:** Use a discriminated union:

```typescript
type HarmonyResult =
  | { ok: true; svgString: string; baseDye: Dye | null; embed: EmbedData }
  | { ok: false; error: HarmonyError; errorMessage: string };

type HarmonyError = 'INVALID_COLOR' | 'NO_MATCH' | 'GENERATION_FAILED';
```

This is cleaner and more type-safe. The bot can switch on `result.ok` and get proper type narrowing. Recommended approach.

---

## Worked Example: Harmony Command

### Before (Discord Worker, single file)

```typescript
// handlers/commands/harmony.ts — 282 lines, mixes all three concerns

export async function handleHarmonyCommand(interaction, env, ctx, logger) {
  // 1. PARSE (Discord-specific)
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);
  const colorInput = interaction.data?.options?.find(o => o.name === 'color')?.value;
  const harmonyType = interaction.data?.options?.find(o => o.name === 'type')?.value || 'triadic';
  const colorSpace = interaction.data?.options?.find(o => o.name === 'color_space')?.value;

  if (!colorInput) {
    return Response.json({ type: 4, data: { embeds: [errorEmbed(...)], flags: 64 } });
  }

  // 2. COMPUTE (platform-agnostic — this moves to bot-logic)
  const resolved = resolveColorInput(colorInput, { excludeFacewear: false });
  if (!resolved) { /* error response */ }

  const harmonyDyes = getHarmonyDyes(resolved.hex, harmonyType, options);
  const dyesForWheel = harmonyDyes.map(dye => ({ ...dye, name: getLocalizedDyeName(...) }));
  const svg = generateHarmonyWheel({ baseColor: resolved.hex, dyes: dyesForWheel, ... });

  // 3. RESPOND (Discord-specific)
  const png = await renderSvgToPng(svg, { scale: 2 });
  const description = harmonyDyes.map((dye, i) => `**${i+1}.** ${emoji} ${name} (\`${hex}\`)`).join('\n');
  await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
    embeds: [{ title, description, color, image, footer }],
    file: { name: 'harmony.png', data: png },
  });
}
```

### After (three layers)

**`@xivdyetools/bot-logic/harmony.ts`:**

```typescript
import { DyeService, dyeDatabase, type Dye, type HarmonyOptions, type HarmonyColorSpace } from '@xivdyetools/core';
import { generateHarmonyWheel, type HarmonyDye } from '@xivdyetools/svg';
import { createTranslator, type LocaleCode } from '@xivdyetools/bot-i18n';
import { resolveColorInput } from './input-resolution.js';
import { getLocalizedDyeName, initializeLocale } from './localization.js';

export interface HarmonyInput {
  colorInput: string;
  harmonyType: string;
  colorSpace?: HarmonyColorSpace;
  locale: LocaleCode;
}

export type HarmonyResult =
  | { ok: true; svgString: string; baseDye: Dye | null; baseHex: string;
      baseName: string; harmonyDyes: Dye[];
      embed: { title: string; description: string; color: number } }
  | { ok: false; error: 'INVALID_COLOR' | 'NO_MATCH'; errorMessage: string };

export async function executeHarmony(input: HarmonyInput): Promise<HarmonyResult> {
  const { colorInput, harmonyType, colorSpace, locale } = input;
  const t = createTranslator(locale);
  await initializeLocale(locale);

  // Resolve color
  const resolved = resolveColorInput(colorInput, { excludeFacewear: false });
  if (!resolved) {
    return { ok: false, error: 'INVALID_COLOR', errorMessage: t.t('errors.invalidColor', { input: colorInput }) };
  }

  // Find harmony dyes
  const harmonyOptions: HarmonyOptions | undefined = colorSpace ? { colorSpace } : undefined;
  const harmonyDyes = getHarmonyDyes(resolved.hex, harmonyType, harmonyOptions);
  if (harmonyDyes.length === 0) {
    return { ok: false, error: 'NO_MATCH', errorMessage: t.t('errors.noMatchFound') };
  }

  // Localize dye names
  const dyesForWheel: HarmonyDye[] = harmonyDyes.map(dye => ({
    id: dye.id,
    name: getLocalizedDyeName(dye.itemID, dye.name, locale),
    hex: dye.hex,
    category: dye.category,
  }));

  // Generate SVG
  const baseName = resolved.name
    ? getLocalizedDyeName(resolved.itemID!, resolved.name, locale)
    : resolved.hex.toUpperCase();

  const svgString = generateHarmonyWheel({
    baseColor: resolved.hex,
    baseName,
    harmonyType,
    dyes: dyesForWheel,
    width: 600,
    height: 600,
  });

  // Build embed data
  const harmonyTypeName = t.t(`harmony.${harmonyType}`) || harmonyType;
  const dyeList = harmonyDyes
    .map((dye, i) => {
      const localizedName = getLocalizedDyeName(dye.itemID, dye.name, locale);
      return `**${i + 1}.** ${localizedName} (\`${dye.hex.toUpperCase()}\`)`;
    })
    .join('\n');

  return {
    ok: true,
    svgString,
    baseDye: resolved.dye ?? null,
    baseHex: resolved.hex,
    baseName,
    harmonyDyes,
    embed: {
      title: t.t('harmony.title', { type: harmonyTypeName }),
      description: `${t.t('harmony.baseColor')}: **${baseName}** (\`${resolved.hex.toUpperCase()}\`)\n\n${dyeList}`,
      color: parseInt(resolved.hex.replace('#', ''), 16),
    },
  };
}
```

**Discord Worker (thin adapter):**

```typescript
// handlers/commands/harmony.ts — now ~50 lines instead of ~280

export async function handleHarmonyCommand(interaction, env, ctx, logger) {
  const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';
  const t = await createUserTranslator(env.KV, userId, interaction.locale);

  const colorInput = interaction.data?.options?.find(o => o.name === 'color')?.value as string;
  if (!colorInput) {
    return Response.json({ type: 4, data: { embeds: [errorEmbed(t.t('common.error'), t.t('errors.missingInput'))], flags: 64 } });
  }

  const deferResponse = deferredResponse();

  ctx.waitUntil((async () => {
    const result = await executeHarmony({
      colorInput,
      harmonyType: interaction.data?.options?.find(o => o.name === 'type')?.value as string || 'triadic',
      colorSpace: interaction.data?.options?.find(o => o.name === 'color_space')?.value as HarmonyColorSpace,
      locale: t.getLocale(),
    });

    if (!result.ok) {
      await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
        embeds: [errorEmbed(t.t('common.error'), result.errorMessage)],
      });
      return;
    }

    const png = await renderSvgToPng(result.svgString, { scale: 2 });
    const emoji = result.baseDye ? getDyeEmoji(result.baseDye.id) : undefined;

    await editOriginalResponse(env.DISCORD_CLIENT_ID, interaction.token, {
      embeds: [{
        title: result.embed.title,
        description: (emoji ? `${emoji} ` : '') + result.embed.description,
        color: result.embed.color,
        image: { url: 'attachment://harmony.png' },
        footer: { text: t.t('common.footer') },
      }],
      file: { name: 'harmony.png', data: png, contentType: 'image/png' },
    });
  })());

  return deferResponse;
}
```

**Stoat Bot (thin adapter):**

```typescript
// commands/harmony.ts

async function handleHarmonyCommand(message: Message, args: ParsedArgs) {
  const t = createUserTranslator(db, message.author.id);
  await message.react(encodeURIComponent('⏳'));

  try {
    const result = await executeHarmony({
      colorInput: args.dyeName,
      harmonyType: args.options.type || 'triadic',
      colorSpace: args.options.colorSpace,
      locale: t.getLocale(),
    });

    if (!result.ok) {
      await message.channel.sendMessage({
        content: result.errorMessage,
        replies: [{ id: message.id, mention: false }],
      });
      return;
    }

    const png = renderSvgToPng(result.svgString, 2);
    const fileId = await uploadToAutumn(png, 'harmony.png');

    await message.channel.sendMessage({
      replies: [{ id: message.id, mention: false }],
      embeds: [{
        title: result.embed.title,
        description: result.embed.description,
        colour: `#${result.embed.color.toString(16).padStart(6, '0')}`,
        media: fileId,
      }],
      masquerade: result.baseDye ? {
        name: result.baseName,
        avatar: getDyeSwatchUrl(result.baseDye.itemID),
        colour: result.baseHex,
      } : undefined,
    });

  } finally {
    await message.unreact(encodeURIComponent('⏳'));
  }
}
```

---

## Dependencies

```
@xivdyetools/types
@xivdyetools/core
@xivdyetools/color-blending
@xivdyetools/svg
@xivdyetools/bot-i18n
        |
        v
@xivdyetools/bot-logic
```

This package depends on all other shared packages. It is the **top-level orchestration layer**.

---

## Package Structure

```
xivdyetools-bot-logic/
  src/
    index.ts                  ← Barrel re-exports
    input-resolution.ts       ← resolveColorInput, resolveDyeInput, isValidHex, normalizeHex
    css-colors.ts             ← CSS named color lookup table
    localization.ts           ← initializeLocale, getLocalizedDyeName (wraps core)
    commands/
      harmony.ts              ← executeHarmony()
      dye-info.ts             ← executeDyeInfo()
      mixer.ts                ← executeMixer()
      match.ts                ← executeMatch()
      gradient.ts             ← executeGradient()
      comparison.ts           ← executeComparison()
      accessibility.ts        ← executeAccessibility()
      random.ts               ← executeRandom()
      budget.ts               ← executeBudget() + BudgetDeps
      extract.ts              ← executeExtract() + ExtractDeps
      preset.ts               ← executePresetView() + PresetDeps
    types/
      inputs.ts               ← All *Input types
      results.ts              ← All *Result types
      deps.ts                 ← BudgetDeps, ExtractDeps, PresetDeps
  tests/
    input-resolution.test.ts
    commands/
      harmony.test.ts
      dye-info.test.ts
      mixer.test.ts
      ... (one per command)
  package.json
  tsconfig.json
  vitest.config.ts
```

---

## Extraction Strategy: Incremental, One Command at a Time

This extraction is too large to do in one pass. The recommended approach:

### Wave 1: Foundation + simplest commands

1. Extract `input-resolution.ts` (from `discord-worker/src/utils/color.ts`) — all commands depend on this
2. Extract `localization.ts` — wraps core's `LocalizationService` for the localized name pattern
3. Extract `dye-info.ts` — simplest command, good for establishing the Input/Result pattern
4. Extract `harmony.ts` — slightly more complex, exercises SVG generation

After Wave 1, the pattern is established. Both commands work from the shared package in the Discord Worker.

### Wave 2: Pure computation commands

5. `mixer.ts` — uses `@xivdyetools/color-blending`
6. `gradient.ts` — uses color blending + SVG gradient
7. `match.ts` — uses `resolveColorInput` with `findClosestForHex`
8. `comparison.ts` — multi-dye input, comparison grid SVG
9. `random.ts` — simplest of all (just random dye selection + grid SVG)

### Wave 3: Commands with external dependencies

10. `accessibility.ts` — uses colorblindness simulation from core
11. `budget.ts` — needs `BudgetDeps` for price fetching
12. `extract.ts` — needs `ExtractDeps` for image processing
13. `preset.ts` — needs `PresetDeps` for preset API

### Wave 4: Cleanup

14. Remove duplicate utility functions from Discord Worker
15. Update all imports to use `@xivdyetools/bot-logic`
16. Migrate test files to the package

---

## Type Promotions to `@xivdyetools/types`

These types currently live in `discord-worker/src/types/preferences.ts` but are needed by `bot-logic` (and both bots):

```typescript
// Game data types (not platform-specific):
export type BlendingMode = 'rgb' | 'lab' | 'oklab' | 'ryb' | 'hsl' | 'spectral';
export type MatchingMethod = 'rgb' | 'cie76' | 'ciede2000' | 'oklab' | 'hyab' | 'oklch-weighted';
export type Gender = 'male' | 'female';

export interface UserPreferences {
  language?: LocaleCode;
  blending?: BlendingMode;
  matching?: MatchingMethod;
  count?: number;
  clan?: string;
  gender?: Gender;
  world?: string;
  market?: boolean;
}

export const CLANS_BY_RACE: Record<string, string[]>;
export const VALID_CLANS: string[];
export const PREFERENCE_DEFAULTS: Required<Omit<UserPreferences, 'clan' | 'gender' | 'world'>>;

// Validators:
export function isValidBlendingMode(mode: string): mode is BlendingMode;
export function isValidMatchingMethod(method: string): method is MatchingMethod;
export function isValidClan(clan: string): boolean;
export function isValidGender(gender: string): gender is Gender;
export function isValidCount(count: number): boolean;
export function normalizeClan(clan: string): string | null;
export function getRaceForClan(clan: string): string | null;
```

**Note:** `BlendingMode` also lives in `@xivdyetools/color-blending`. It should be defined in one place (`color-blending` or `types`) and re-exported by the other. See [06a-color-blending.md](./06a-color-blending.md) for the recommendation.

---

## Testing

### Unit Tests with Mock Dependencies

Commands with `deps` are tested by providing mock implementations:

```typescript
test('executeBudget returns ranked dyes by price', async () => {
  const mockDeps: BudgetDeps = {
    fetchPrices: async (world, ids) => {
      const map = new Map();
      map.set(5729, { minPrice: 500, avgPrice: 750, listings: 10 });
      map.set(5730, { minPrice: 200, avgPrice: 300, listings: 5 });
      return map;
    },
    getUserWorld: async () => 'Famfrit',
  };

  const result = await executeBudget({ targetDye: 'Snow White', locale: 'en' }, mockDeps);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.suggestions[0].price).toBeLessThanOrEqual(result.suggestions[1].price);
  }
});
```

### Commands Without Dependencies

Most commands need no mocks — they're pure functions over `@xivdyetools/core`'s dye database:

```typescript
test('executeHarmony returns triadic dyes', async () => {
  const result = await executeHarmony({
    colorInput: 'Snow White',
    harmonyType: 'triadic',
    locale: 'en',
  });

  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.harmonyDyes.length).toBeGreaterThan(0);
    expect(result.svgString).toContain('<svg');
    expect(result.embed.title).toContain('Triadic');
  }
});
```

### Existing Test Migration

The Discord Worker's command handler tests currently test the full stack (input parsing → business logic → response formatting). After extraction:

- **Business logic tests** → move to `@xivdyetools/bot-logic`
- **Input parsing tests** → stay in Discord Worker (test interaction option extraction)
- **Response format tests** → stay in Discord Worker (test embed structure, file attachment)
- **Integration tests** → stay in Discord Worker (test full HTTP request → response cycle)
