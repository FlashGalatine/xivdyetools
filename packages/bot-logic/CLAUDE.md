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
pnpm --filter @xivdyetools/bot-logic exec vitest run src/commands/harmony.test.ts --coverage.enabled=false
```

Coverage is **enforced** (BUG-127): `vitest.config.ts` sets `coverage.enabled: true`, so `run test` (and `turbo run test`, and CI) fails when any of lines / functions / branches / statements drops below 90%. `run test:coverage` is now the same run. A single-file run needs `--coverage.enabled=false`, because a green subset otherwise exits 1 on the global thresholds. Add tests that pin behaviour, not ones that only execute lines, and list a branch that cannot be reached without a source change instead of contorting a test to hit it.

## Architecture

Each `commands/<name>.ts` exports an `execute<Name>` function plus its `<Name>Input` and `<Name>Result` types. The result is always a discriminated union: `{ ok: true, svgString, embed, ... }` on success, or `{ ok: false, error: <string-literal-code>, errorMessage }` on failure. Adapters never throw across the boundary — they read the discriminator and render accordingly.

A small set of shared utilities lives at the top level of `src/`:
- `input-resolution.ts` — turns dye ids, hex codes, dye names, or CSS color names into a single `ResolvedColor` shape (order under *Input resolution order* below). Owns a process-singleton `DyeService` (loaded from `dyeDatabase` JSON).
- `localization.ts` — wraps `LocalizationService` with a per-locale instance cache to avoid singleton race conditions in concurrent CF Worker requests.
- `css-colors.ts` — 148 standard CSS color name → hex lookup.

`color-math.ts` (`getColorDistance`, `getMatchQualityInfo`) was removed 2026-08-18 (DEAD-012 dead-code audit) — it was a dead delegate to core's `ColorService.getColorDistance` / `classifyMatchDistance`; no command imported it. `handlers/commands/gradient.ts` in `apps/discord-worker` now calls `classifyMatchDistance` from `@xivdyetools/types` directly instead of re-implementing a quality ladder with different thresholds.

### Key Directories

```
src/
├── index.ts                       # Public re-exports
├── input-resolution.ts            # Hex / dye-name / CSS-color resolution + dyeService singleton
├── localization.ts                # initializeLocale, getLocalizedDyeName, getLocalizedCategory
├── css-colors.ts                  # CSS named-color → hex (BlueViolet, coral, ...)
├── moderators.ts                  # parseModeratorIds / isModeratorId / isValidDiscordSnowflake (shared MODERATOR_IDS grammar)
├── i18n/                          # Bot UI Translator + six locale JSONs — subpath @xivdyetools/bot-logic/i18n
└── commands/
    ├── types.ts                   # EmbedData, EmbedField (platform-neutral)
    ├── harmony.ts                 # /harmony — triadic / complementary / analogous / split / tetradic / inverted-tetradic / square / mono / compound / shades
    ├── dye-info.ts                # /dye info AND /dye random (shared module)
    ├── mixer.ts                   # /mixer — 6-mode color blending + closest-dye match
    ├── gradient.ts                # /gradient — N-step gradient + dye matches per stop
    ├── comparison.ts              # /comparison — side-by-side dye grid
    ├── contrast.ts                # /contrast — WCAG 1.4.11 ratios between dye pairs
    ├── swatch.ts                  # /swatch — character-colour reference matching
    ├── glamour.ts                 # /glamour — the Glamour Reader (resolver injected) + GPOSERS list
    ├── chara-identity.ts          # what /swatch and /glamour share: palette service, producer token, tribe line
    └── accessibility.ts           # /accessibility — colorblind sim + WCAG matrix
```

## Public API

### Foundation

```ts
function isValidHex(input: string, options?: { allowShorthand?: boolean }): boolean;
function normalizeHex(hex: string): string;            // → '#RRGGBB' uppercase
function resolveColorInput(input: string, options?: ResolveColorOptions): ResolvedColor | null;
function resolveDyeInput(input: string, locale?: LocaleCode): Dye | null;   // default locale 'en'
const dyeService: DyeService;                          // shared singleton
type ResolvedColor = { hex; name?; id?; itemID?; stainID?; dye? };
type ResolveColorOptions = { excludeFacewear?; findClosestForHex?; locale? };
```

### Localization

```ts
async function initializeLocale(locale: LocaleCode): Promise<void>;
function getLocalizedDyeName(itemID: number, fallbackName: string, locale?: LocaleCode): string;
function getLocalizedCategory(category: string, locale?: LocaleCode): string;
type LocaleCode;  // re-exported from ./i18n (formerly @xivdyetools/bot-i18n): 'en'|'ja'|'de'|'fr'|'ko'|'zh'

// @xivdyetools/bot-logic/i18n — the locale layer both Discord bots share (REFACTOR-001)
async function resolveUserLocale(kv: LocalePreferenceStore, userId: string,
                                 discordLocale?: string, logger?: LocaleResolutionLogger): Promise<LocaleCode>;
  // order: prefs:v1:<id> blob → i18n:user:<id> legacy key → Discord client locale → 'en'; never throws
  type LocalePreferenceStore = { get(key: string): Promise<string | null> };   // a KVNamespace fits
  type LocaleResolutionLogger = { error(message: string, error?: Error): void }; // ExtendedLogger fits
```

`logger` is optional (BUG-126). Existing three-argument callers still compile, but they stay silent on a KV outage. When it is passed, each degraded step logs one fixed-message line that never names the user id. A failed KV read passes the KV's own `Error` through unchanged, or `undefined` for a non-Error rejection. A malformed blob is logged with no error object at all, because `JSON.parse`'s `SyntaxError` quotes the stored blob. Callers that hold a logger should pass it.

### Shared types & helpers

```ts
type EmbedData = { title; description?; fields?: EmbedField[]; color: number; footer? };
type EmbedField = { name; value; inline? };
```

### Commands

Each command exports `execute<Name>(input): Promise<<Name>Result>` along with its input/result types.

```ts
executeHarmony(input: HarmonyInput): Promise<HarmonyResult>
  type HarmonyInput = { baseHex; baseName?; baseId?; baseItemID?; harmonyType; wheel?: ColorWheelId;
                        locale; dyeFilters?; companionCount?; matchingMethod?; strictMatching?;
                        preventDuplicates?; theme?; logger?;
                        harmonyOptions? /* @deprecated — ignored since PR #159 */ };
  type HarmonyResult = { ok: true; svgString; baseHex; baseName; harmonyDyes: Dye[]; embed }
                     | { ok: false; error: 'NO_MATCHES'|'GENERATION_FAILED'; errorMessage };
  type HarmonyType = 'triadic'|'complementary'|'analogous'|'split-complementary'|'tetradic'|'inverted-tetradic'|'square'|'monochromatic'|'compound'|'shades';
  const HARMONY_TYPES: readonly HarmonyType[];
  function getHarmonyTypeChoices(): {name; value}[];

executeDyeInfo(input: DyeInfoInput): Promise<DyeInfoResult>
  // errors: GENERATION_FAILED
executeRandom(input: RandomInput): Promise<RandomResult>      // exported from same module
  // errors: NO_DYES | GENERATION_FAILED

executeMixer(input: MixerInput): Promise<MixerResult>
  // MixerResult = { ok: true; svgString; blendingMode; sweep: MixerSweepStop[]; embed }
  //             | { ok: false; error: 'NO_MATCHES'|'GENERATION_FAILED'; errorMessage }

executeGradient(input: GradientInput): Promise<GradientResult>
  type GradientStepResult, InterpolationMode;
  // errors: GENERATION_FAILED

executeComparison(input: ComparisonInput): Promise<ComparisonResult>
  // errors: NOT_ENOUGH_DYES | GENERATION_FAILED
  // NOT_ENOUGH_DYES: fewer than 2 dyes, or `dyes` not an array → errorMessage mixer.bothRequired

executeContrast(input: ContrastInput): Promise<ContrastResult>
  // errors: NOT_ENOUGH_DYES | GENERATION_FAILED
  // NOT_ENOUGH_DYES: fewer than 2 dyes, or `dyes` not an array → errorMessage mixer.bothRequired

executeSwatch(input: SwatchInput): Promise<SwatchResult>
  // errors: PARSE_FAILED | NO_LIVE_SLOTS | SLOT_MISSING | GENERATION_FAILED

executeGlamour(input: GlamourInput): Promise<GlamourResult>
  // input.resolve(gear, glassesId) → GlamourResolveAnswer — the adapter's transport to api-worker
  // POST /v1/chara/resolve; errors: PARSE_FAILED | NO_GEAR | RESOLVE_FAILED | RESOLVE_BUSY | GENERATION_FAILED
  // A resolver error may carry the HTTP `status`: 429 → RESOLVE_BUSY; 400/413/422 → PARSE_FAILED
  // (api-worker refused what the file describes; the reply is card.swatchParseError wrapping the localized card.charaFileReason.unreadable, never the error's English message; no card is drawn); else RESOLVE_FAILED

executeAccessibility(input: AccessibilityInput): Promise<AccessibilityResult>
  const VISION_TYPES;
  type AccessibilityDye, VisionType;
  // errors: NOT_ENOUGH_DYES | GENERATION_FAILED
  // NOT_ENOUGH_DYES: no dye at all, or `dyes` not an array → errorMessage errors.missingInput (one dye is enough)
```

`NOT_ENOUGH_DYES` (comparison, contrast, accessibility) is the caller's mistake, checked **before** the `try`. Before it existed, a short list threw a `TypeError` inside the renderer, and the catch reported it as `GENERATION_FAILED`, a render bug. Each guard tests `Array.isArray` first because it runs outside the `try`, so a JavaScript caller's `undefined` is refused rather than thrown across the boundary. Widening a published `error` union is semver-minor: a consumer with an exhaustive `never` switch needs the new case.

## Key Patterns / Algorithms

### Discriminated-union result contract
`{ ok: true, ... } | { ok: false, error: <code>, errorMessage }`. Adapters branch on `result.ok` — on the failure path `errorMessage` is already localized and ready to render, and `error` is a short string literal that adapters can use to set embed colors or log levels (e.g., `'NO_MATCHES' → yellow warn`, `'GENERATION_FAILED' → red error`).

### Failure logging (BUG-125)
Every `*Input` takes an optional `logger?: TranslatorLogger` (`{ warn(msg) }`). It hears the Translator's missing-key warnings, harmony's `[harmony] unknown colour wheel "<wheel>" — using rgb` (which echoes the caller's value, the one line that does), and one line per caught failure, written by `failureKind(error)` in `commands/failure-kind.ts` (internal, not exported):

```
[<cmd>] generation failed: <Name>[ <code>]     every execute*'s final catch; [dye info] / [dye random] for dye-info.ts
[swatch] parse failed: <Name>[ <code>]         the .chara read (parse + resolve + nickname strip)
[glamour] resolve failed: <Name>[ (status N)]  RESOLVE_FAILED only; 429 and 400/413/422 are answers, not logged
```

`<Name>` is the error's class, plus its `code` when it carries a string one: an `AppError`'s (`AppError INVALID_HEX_COLOR`), but also a runtime error's (`Error ECONNREFUSED`). A thrown non-Error is named by its `typeof` (`string`). The error's **message is never logged**: core's colour helpers quote the hex they were given, which can be what the user typed, and the `.chara` parser quotes field values from the player's file (PRIVACY_POLICY §3). New catches use `failureKind`, never `` `${error.name}: ${error.message}` ``. Glamour's parse catch is still bare, so a `PARSE_FAILED` from `/glamour` is not logged yet.

### `EmbedData` is platform-neutral
Discord adapters map `EmbedData` onto `APIEmbed` (`title → title`, `color → number`, `fields → fields[]`, etc.). Revolt's adapter maps it onto its own message structure. **Never** put Discord-specific types like `APIEmbed`, `Snowflake`, or interaction objects in this package.

### Per-locale `LocalizationService` cache
`localization.ts` keeps a `Map<LocaleCode, LocalizationService>` and **never** mutates a singleton's `currentLocale` after construction. This is deliberate — the previous singleton + `setLocale()` pattern raced inside Cloudflare Workers when concurrent requests for different locales overlapped at I/O yield points. New flows should look up the per-locale instance, not call `setLocale`.

### `dyeService` is a process singleton
`input-resolution.ts` constructs one `DyeService(dyeDatabase)` at module load. Re-importing won't rebuild the database. If a command needs a custom dye filter view, **filter the result** rather than constructing a second `DyeService`.

### Input resolution order
Every resolver trims its input once at the top, so surrounding whitespace never changes how it is read (BUG-034: `' 013114'` is the colour #013114, and `' #FF0000 '` is red).

`resolveColorInput` takes the first step that applies:

1. **A bare number that is not six digits** is a dye id, through `parseDyeIdInput`. 1–5 digits look up a stainID (1–254, the value every autocomplete sends) or a legacy item id (≥ 5729). Zero, the gap between the ranges, and seven or more digits resolve to `null`, with no fallthrough. That is why `'101'` is Pure White and not shorthand for #110011.
2. **Hex**: `#FF0000` / `FF0000` / `#F00` / `F00`, plus **six bare digits, which are always a colour** (`'000000'`, `'013114'`). No real id needs six digits: the highest legacy item id is 48227 and the consolidated market items are 52254–52256. A shorthand without `#` must carry a hex letter.
3. **Dye name**: a case-insensitive partial match on the English name, plus the localized name when `options.locale` is set and `initializeLocale` has run (`searchDyesByName`).
4. **CSS named color** (`BlueViolet`).

`resolveDyeInput` runs in a different order: name search, which reads 1–5 digits as an id; then a six-character hex (no shorthand), answered with the closest dye; then `null`. It has no CSS step. `findDyeByName` is exact-match only, with the same id rule. `excludeFacewear` (default `true`) filters `category === 'Facewear'` and is effectively a no-op since schema v2, because Facewear colours are no longer in the dye database at all. Pass `findClosestForHex: true` when the command needs a dye attached to an arbitrary hex code.

## Consumers

- `apps/discord-worker` — primary consumer. Each Discord slash command handler calls one `execute*` and renders the result.
- `apps/stoat-worker` — Revolt bot. Same `execute*` calls, different rendering shim.

## Internal Dependencies

- `@xivdyetools/types` — `Dye`, `DyeTypeFilters`, `LocaleCode`, etc.
- `@xivdyetools/core` — `DyeService`, `dyeDatabase`, `LocalizationService`, harmony types, `filterDyes`.
- `@xivdyetools/core/blending` — `blendColors`, `BlendingMode` (subpath of core since the retired `@xivdyetools/color-blending` was absorbed).
- `@xivdyetools/svg` — every `generate*` SVG used by command results.
- Built-in `src/i18n/` — `Translator`, `createTranslator`, `LocaleCode` + six bot-UI locale JSONs, exported as `@xivdyetools/bot-logic/i18n` (absorbed from the retired `@xivdyetools/bot-i18n`).

## Dead-code gate (knip)

`pnpm run lint` = `eslint src && pnpm run lint:dead`, and `lint:dead` is
`knip --directory ../.. --workspace packages/bot-logic` against the **root**
`knip.jsonc`. `--workspace` filters reporting only — knip still traverses
`apps/discord-worker`, so an `execute*` the bot calls counts as used.

`includeEntryExports` is on, so `src/index.ts` and `src/i18n/index.ts` (the
`/i18n` subpath) are in scope. Barrel symbols nothing imports must carry
`/** @public */` on the specifier (`"tags": ["-public"]` excludes them) — that is
the `*Input`/`*Result` contract types plus `HARMONY_TYPES`,
`getHarmonyTypeChoices`, `VISION_TYPES`, `isValidDiscordSnowflake`,
`isValidHex`/`normalizeHex`, `getLocalizedCurrency`, `LocaleData`,
`TranslatorLogger`. A new command export with no handler wiring and no tag fails
`lint`.

## Publishing

Publishing goes through the **Publish Packages to npm** GitHub Actions workflow, which authenticates via npm trusted publishing (OIDC). There is no npm token — see the root `CLAUDE.md` for the full flow and the break-glass local path.

```bash
# 1. Bump version in packages/bot-logic/package.json and merge to main
# 2. Build + test
pnpm turbo run build test --filter=@xivdyetools/bot-logic

# 3. Actions → "Publish Packages to npm" → package: @xivdyetools/bot-logic
```
