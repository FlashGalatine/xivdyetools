# [DEAD-003]: Three orphaned modules — `services/svg/index.ts`, `types/image.ts`, `handlers/modals/index.ts`

## Category
Orphaned File

## Location
- `apps/discord-worker/src/services/svg/index.ts` — 8-line barrel (`export * from './renderer.js'`)
- `apps/discord-worker/src/types/image.ts` — 54 lines: `MatchQuality`, `MATCH_QUALITIES`, `getMatchQuality`
- `apps/discord-worker/src/handlers/modals/index.ts` — 10 lines (header comment + `export {}`) and `modals/index.test.ts` (17 lines asserting the module is empty)

## Evidence
- svg barrel: all 11 consumers import `../../services/svg/renderer.js` directly; 0 imports of `services/svg'` / `svg/index` anywhere (knip: unused file). Only other reference is the `vitest.config.ts` coverage-exclude line.
- `types/image.ts`: `grep -rnw MatchQuality|MATCH_QUALITIES|getMatchQuality apps packages` → only `packages/svg/CHANGELOG.md` (history: svg 5.0 replaced the emoji ladder with core's `classifyBandTier`). knip: unused file.
- `modals/index.ts`: `index.ts` never imports it — its `handleModal` (index.ts:1010) is inline and answers "Unknown modal". Its test only proves the module is empty.

## Why It Exists
Leftovers of the 4.x layout: local SVG generators (moved to `@xivdyetools/svg`), the pre-5.0 match-quality emoji ladder, and a modal-handler slot that never got a modal.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |
| **Hidden Consumers** | None (no dynamic imports; wrangler bundles from `src/index.ts`) |

## Recommendation
**REMOVE**

### If Removing
1. Delete the four files (3 modules + `modals/index.test.ts`).
2. Remove the two now-stale `vitest.config.ts` coverage-exclude lines (`src/services/svg/index.ts` is not listed but `src/handlers/modals` may be — see DEAD-007).
3. Test + type-check.
