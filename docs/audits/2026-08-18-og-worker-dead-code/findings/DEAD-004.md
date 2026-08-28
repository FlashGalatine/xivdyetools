# [DEAD-004]: `services/svg/base.ts` — indigo `THEME`, 1200×630 `OG_DIMENSIONS`, `linearGradient` and 10 of 12 package re-exports are pre-5.0 leftovers

## Category
Unused Export / Legacy Code

## Location
- File: `src/services/svg/base.ts` (77 lines)
- Symbols: `THEME` (57–69), `OG_DIMENSIONS` (74–77), `linearGradient` (34–51); re-exports `hexToRgb, getLuminance, getContrastTextColor, createSvgDocument, rect, circle, line, text, group, FONTS` (16–29)

## Evidence
Only two importers in prod: `band.ts:38` and `default-card.ts:25`, both `import { escapeXml, estimateTextWidth } from './base'`. `symrefs`: `THEME prod=3 (base.ts only) tests=13`, `OG_DIMENSIONS prod=2 tests=4`, `linearGradient prod=3 tests=5`, `hexToRgb/getLuminance/createSvgDocument/FONTS prod=1 (the re-export line itself)`. `getContrastTextColor` is named in a band.ts *comment* ("deliberately NOT the package's getContrastTextColor") — not called. The `THEME` is the retired **indigo** palette (`accent: '#6366f1'`, `background: '#1a1a2e'`) — the 15E cards are console-dark `#0B0B0C` with `#FF6257` accent, and `renderer.ts:275-277` even warns callers off "the retired pre-5.0 indigo". The header comment still calls the file the home of "the 1200×630 OG_DIMENSIONS".

## Why It Exists
REFACTOR-009 (2026-07-18) turned a drifted local fork into a re-export shim; the v2.0.0 15E rewrite then stopped using almost all of it.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — 2 import lines + barrel + `base.test.ts` (DEAD-005) |
| **Reversibility** | EASY |
| **Hidden Consumers** | none |

## Recommendation
**REMOVE** the file; import `escapeXml`/`estimateTextWidth` straight from `@xivdyetools/svg` in the two consumers.

### If Removing
1. `band.ts:38`, `default-card.ts:25` → `import { escapeXml, estimateTextWidth } from '@xivdyetools/svg'`.
2. Delete `base.ts`; drop `export * from './base'` in `svg/index.ts` (DEAD-013).
3. Delete `base.test.ts` (DEAD-005).
