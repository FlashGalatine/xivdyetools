# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Overview

`@xivdyetools/bot-logic` is the **platform-agnostic command business logic** shared by the Discord bot (`apps/discord-worker`, Cloudflare Workers + Hono + HTTP Interactions) and the Revolt bot (`apps/stoat-worker`, Node.js + revolt.js). Each command is implemented as a pure `execute*(input): result` function that takes a typed input, runs the dye-database / color-math / SVG work, and returns a discriminated-union result containing an SVG string and a platform-neutral `EmbedData`. The platform adapters in each app then map that result onto Discord embeds or Revolt messages — no Discord-specific or Revolt-specific code lives here.

The whole point of this package is that the moment the Discord bot grows a `/harmony` command, the Revolt bot gets the same command for free; only the rendering shim differs.

## Commands

```bash
pnpm --filter @xivdyetools/bot-logic run build
pnpm --filter @xivdyetools/bot-logic run test
pnpm --filter @xivdyetools/bot-logic run test:coverage
pnpm --filter @xivdyetools/bot-logic run type-check
pnpm --filter @xivdyetools/bot-logic run lint
pnpm --filter @xivdyetools/bot-logic run clean
```

### Run from monorepo root

```bash
pnpm turbo run build --filter=@xivdyetools/bot-logic
pnpm turbo run test --filter=@xivdyetools/bot-logic
pnpm --filter @xivdyetools/bot-logic exec vitest run src/commands/harmony.test.ts
```

## Architecture

Each `commands/<name>.ts` exports an `execute<Name>` function plus its `<Name>Input` and `<Name>Result` types. The result is always a discriminated union: `{ ok: true, svgString, embed, ... }` on success, or `{ ok: false, error: <string-literal-code>, errorMessage }` on failure. Adapters never throw across the boundary — they read the discriminator and render accordingly.

A small set of shared utilities lives at the top level of `src/`:
- `input-resolution.ts` — turns hex codes, dye names, or CSS color names into a single `ResolvedColor` shape. Owns a process-singleton `DyeService` (loaded from `dyeDatabase` JSON).
- `localization.ts` — wraps `LocalizationService` with a per-locale instance cache to avoid singleton race conditions in concurrent CF Worker requests.
- `color-math.ts` — distance / match-quality helpers shared across commands.
- `css-colors.ts` — 148 standard CSS color name → hex lookup.

### Key Directories

```
src/
├── index.ts                       # Public re-exports
├── input-resolution.ts            # Hex / dye-name / CSS-color resolution + dyeService singleton
├── localization.ts                # initializeLocale, getLocalizedDyeName, getLocalizedCategory
├── color-math.ts                  # getColorDistance, getMatchQualityInfo
├── css-colors.ts                  # CSS named-color → hex (BlueViolet, coral, ...)
└── commands/
    ├── types.ts                   # EmbedData, EmbedField (platform-neutral)
    ├── harmony.ts                 # /harmony — triadic / complementary / analogous / split / tetradic / square / mono
    ├── dye-info.ts                # /dye-info AND /random (shared module)
    ├── mixer.ts                   # /mixer — 6-mode color blending + closest-dye match
    ├── gradient.ts                # /gradient — N-step gradient + dye matches per stop
    ├── match.ts                   # /match — find closest N dyes for a color
    ├── comparison.ts              # /compare — side-by-side dye grid
    └── accessibility.ts           # /accessibility — colorblind sim + WCAG matrix
```

## Public API

### Foundation

```ts
function isValidHex(input: string, options?: { allowShorthand?: boolean }): boolean;
function normalizeHex(hex: string): string;            // → '#RRGGBB' uppercase
function resolveColorInput(input: string, options?: ResolveColorOptions): ResolvedColor | null;
function resolveDyeInput(input: string): Dye | null;
const dyeService: DyeService;                          // shared singleton
type ResolvedColor = { hex; name?; id?; itemID?; dye? };
type ResolveColorOptions = { excludeFacewear?; findClosestForHex? };
```

### Localization

```ts
async function initializeLocale(locale: LocaleCode): Promise<void>;
function getLocalizedDyeName(itemID: number, fallbackName: string, locale?: LocaleCode): string;
function getLocalizedCategory(category: string, locale?: LocaleCode): string;
type LocaleCode;  // re-exported from @xivdyetools/bot-i18n: 'en'|'ja'|'de'|'fr'|'ko'|'zh'
```

### Shared types & helpers

```ts
type EmbedData = { title; description?; fields?: EmbedField[]; color: number; footer? };
type EmbedField = { name; value; inline? };
function getColorDistance(hex1, hex2): number;
function getMatchQualityInfo(distance): MatchQualityInfo;
type MatchQualityInfo;
```

### Commands

Each command exports `execute<Name>(input): Promise<<Name>Result>` along with its input/result types.

```ts
executeHarmony(input: HarmonyInput): Promise<HarmonyResult>
  type HarmonyInput = { baseHex; baseName?; baseId?; baseItemID?; harmonyType; locale; harmonyOptions?; dyeFilters? };
  type HarmonyResult = { ok: true; svgString; baseHex; baseName; harmonyDyes: Dye[]; embed }
                     | { ok: false; error: 'NO_MATCHES'|'GENERATION_FAILED'; errorMessage };
  type HarmonyType = 'triadic'|'complementary'|'analogous'|'split-complementary'|'tetradic'|'square'|'monochromatic';
  const HARMONY_TYPES: readonly HarmonyType[];
  function getHarmonyTypeChoices(): {name; value}[];
  type HarmonyColorSpace;  // re-exported from @xivdyetools/core

executeDyeInfo(input: DyeInfoInput): Promise<DyeInfoResult>
executeRandom(input: RandomInput): Promise<RandomResult>      // exported from same module

executeMixer(input: MixerInput): Promise<MixerResult>
  type BlendingMode;     // re-exported from @xivdyetools/color-blending
  type MixerMatch;

executeGradient(input: GradientInput): Promise<GradientResult>
  type GradientStepResult, InterpolationMode, MatchingMethod;

executeMatch(input: MatchInput): Promise<MatchResult>
  type MatchEntry;

executeComparison(input: ComparisonInput): Promise<ComparisonResult>

executeAccessibility(input: AccessibilityInput): Promise<AccessibilityResult>
  const VISION_TYPES;
  type AccessibilityDye, VisionType;
```

## Key Patterns / Algorithms

### Discriminated-union result contract
`{ ok: true, ... } | { ok: false, error: <code>, errorMessage }`. Adapters branch on `result.ok` — on the failure path `errorMessage` is already localized and ready to render, and `error` is a short string literal that adapters can use to set embed colors or log levels (e.g., `'NO_MATCHES' → yellow warn`, `'GENERATION_FAILED' → red error`).

### `EmbedData` is platform-neutral
Discord adapters map `EmbedData` onto `APIEmbed` (`title → title`, `color → number`, `fields → fields[]`, etc.). Revolt's adapter maps it onto its own message structure. **Never** put Discord-specific types like `APIEmbed`, `Snowflake`, or interaction objects in this package.

### Per-locale `LocalizationService` cache
`localization.ts` keeps a `Map<LocaleCode, LocalizationService>` and **never** mutates a singleton's `currentLocale` after construction. This is deliberate — the previous singleton + `setLocale()` pattern raced inside Cloudflare Workers when concurrent requests for different locales overlapped at I/O yield points. New flows should look up the per-locale instance, not call `setLocale`.

### `dyeService` is a process singleton
`input-resolution.ts` constructs one `DyeService(dyeDatabase)` at module load. Re-importing won't rebuild the database. If a command needs a custom dye filter view, **filter the result** rather than constructing a second `DyeService`.

### Input resolution order
`resolveColorInput` tries inputs in this order: hex (`#FF0000` / `FF0000` / `#F00`) → dye name (case-insensitive partial match, Facewear excluded by default) → CSS named color (`BlueViolet`). Pass `findClosestForHex: true` when the command needs a dye attached to an arbitrary hex code.

## Consumers

- `apps/discord-worker` — primary consumer. Each Discord slash command handler calls one `execute*` and renders the result.
- `apps/stoat-worker` — Revolt bot. Same `execute*` calls, different rendering shim.

## Internal Dependencies

- `@xivdyetools/types` — `Dye`, `DyeTypeFilters`, `LocaleCode`, etc.
- `@xivdyetools/core` — `DyeService`, `dyeDatabase`, `LocalizationService`, harmony types, `filterDyes`.
- `@xivdyetools/color-blending` — `blendColors`, `BlendingMode`.
- `@xivdyetools/svg` — every `generate*` SVG used by command results.
- `@xivdyetools/bot-i18n` — `Translator`, `createTranslator`, `LocaleCode`.

## Publishing

```bash
# 1. Bump version in packages/bot-logic/package.json
# 2. Build + test
pnpm turbo run build test --filter=@xivdyetools/bot-logic

# 3. Publish
pnpm --filter @xivdyetools/bot-logic publish --provenance --access public --no-git-checks
```
