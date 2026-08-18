# [DEAD-029]: core `utils/index.ts` — 11 documented helpers with zero callers (~360 lines) and the test-only `AsyncLRUCache` (156 lines)

## Category
Unused Export (DEAD / TEST-ONLY)

## Location
`packages/core/src/utils/index.ts`:
- **DEAD** (0 core-internal imports, 0 external): `lerp` (315-343), `distance` (376-406), `unique` (411-433), `groupBy` (434-473), `sortByProperty` (474-515), `filterNulls` (516-537), `isString` / `isNumber` / `isArray` / `isObject` / `isNullish` (649-754) — ≈360 src lines; tests `utils.test.ts:119-156, 190-223, 224-338, 437-539` (≈290 lines). CLAUDE.md:176 lists them and README shows a `lerp` example
- **TEST-ONLY** (not even on the barrel): `AsyncLRUCache` (127-282, 156 lines; `utils.test.ts:811-957` ≈146 lines) — `LRUCache` is live (ColorConverter ×7, ColorblindnessSimulator)
- **KEEP** (INTERNAL-ONLY + documented): `clamp`, `round`, `isValidHexColor`, `isValidRGB`, `isValidHSV`, `LRUCache`, `retry`, `sleep`, `generateChecksum`, `isAbortError`, `abbreviateDyeName` (bot-logic/svg)

## Evidence
`grep "from '.*utils/index.js'" packages/core/src` lists every internal import — none carries the 11 names (word hits for `round`/`distance`/`unique`/`isArray` elsewhere are unrelated identifiers). External: `git grep -nw` over tracked files → 0 for each (a plain `grep -r` is poisoned by `apps/web-app/e2e-coverage/*.json`, which embeds core's full source — restrict to tracked files).

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW; core is npm-published and CLAUDE.md/README document these → semver-minor for hypothetical external consumers (DEPRECATIONS.md and CHANGELOG name only workspace consumers) |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** `AsyncLRUCache` (not public); **REMOVE WITH CAUTION** the 11 helpers (CHANGELOG note, update CLAUDE.md:176 + README example).
