# [DEAD-005]: `base.test.ts` (342 lines) re-tests `@xivdyetools/svg` primitives through the re-export shim

## Category
Stale Test

## Location
- File: `src/services/svg/base.test.ts`

## Evidence
Its describes are `escapeXml`, `hexToRgb`, `getLuminance`, `getContrastTextColor`, `createSvgDocument`, `rect`, `circle`, `line`, `text`, `group`, plus `linearGradient` / `THEME` / `OG_DIMENSIONS`. All but the last three are `@xivdyetools/svg` functions already covered by `packages/svg/src/base.test.ts`; the last three are dead (DEAD-004). og-worker's own code touches only `escapeXml` and `estimateTextWidth` — and `estimateTextWidth` is **not** among the tests. So the file adds ~340 lines of run time and maintenance to assert another workspace's contract, and misses the one helper this app actually depends on for CJK fit.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | NONE (deleting `base.ts` with it keeps the 85 % coverage gate — verify after) |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** (with DEAD-004). If a local guard is wanted, one test that `band.ts` output contains `&amp;` for a name with `&` is worth more than all 342 lines.
