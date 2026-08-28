# [DEAD-006]: Re-export shims and redundant barrel lines (`utils/color.ts`, `utils/verify.ts` + a 220-line test of a mock, `budget/index.ts`, `types/preset.ts`)

## Category
Unused Export (REDUNDANT-RE-EXPORT) / Stale Test

## Location
- `apps/discord-worker/src/utils/color.ts` — 14-line pure re-export shim over `@xivdyetools/bot-logic`; `isValidHex`, `normalizeHex`, `resolveDyeInput`, `ResolvedColor`, `ResolveColorOptions` have 0 importers via the shim; consumers (11 files) use only `resolveColorInput` and `dyeService`
- `apps/discord-worker/src/utils/verify.ts` — 18-line re-export shim over `@xivdyetools/auth`; `verify.test.ts` (220 lines) **mocks `verifyDiscordRequest` (lines 19-29) and then tests it** — it exercises a mock; the real test is `packages/auth/src/discord.test.ts`
- `apps/discord-worker/src/services/budget/index.ts` — barrel lines for `fetchPrices`, `fetchPricesBatched`, `CACHE_TTL_SECONDS`, `getCachedPrice(s)`, `setCachedPrice(s)`, `fetchWithCache`, `QUICK_PICKS`, `UniversalisWorld`, `UniversalisDataCenter` (~10 lines) — all live via intra-file use or direct file imports, none via the barrel
- `apps/discord-worker/src/handlers/buttons/index.ts` — `handlePreviewImageButton`, `isPreviewImageButton` re-exports (live via direct import + routed at index.ts:81; barrel export unused)
- `apps/discord-worker/src/services/bot-i18n.ts:22` — `LocaleCode` re-export (consumers take it from `services/i18n.js` or `@xivdyetools/bot-logic/i18n`)
- `apps/discord-worker/src/types/preset.ts` — the self-marked `@deprecated … will be removed in the next major version` re-export blocks; `PresetSortOption` and `PresetStatus` already have 0 external importers (12 other names are still consumed — see DEAD-002 for the 3 that die with the moderation client)

## Evidence
knip `Unused exports` list for these files + per-symbol grep. `verify.test.ts:19-29` — `vi.mock('@xivdyetools/auth', …)` replaces `verifyDiscordRequest`, and the suite then asserts on the mock's return values.

## Why It Exists
Import-path stability during the 2026-07-30/31 package migrations (bot-i18n → bot-logic/i18n, crypto → auth) — the shims were meant to be temporary.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW–MEDIUM — deleting the two shims touches 11 + 1 import lines and ~30 `vi.mock('./utils/verify.js')` sites in `index.test.ts` (which would mock the package instead); `contrast.test.ts` mocks the color shim path |
| **Reversibility** | EASY |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE** the unused re-export lines now (budget barrel, buttons barrel, `bot-i18n` LocaleCode, `PresetSortOption`/`PresetStatus`, the 3 unused names in `utils/color.ts`); **REFACTOR FIRST** to retire the two shim files entirely (rewrite imports to the packages, delete `verify.test.ts`).

### If Removing
1. Trim the barrel lines; delete `verify.test.ts`.
2. Replace `from './utils/color.js'` (11 files) with `@xivdyetools/bot-logic`, `from './utils/verify.js'` (index.ts) with `@xivdyetools/auth`; update the `vi.mock` targets.
3. Test + type-check.
