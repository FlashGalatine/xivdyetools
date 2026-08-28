# [DEAD-006]: `fonts.ts` — `cjkStack()` and `FONT_FAMILIES` are unused

## Category
Unused Export

## Location
- File: `src/services/fonts.ts` lines 121–147
- Symbols: `cjkStack`, `FONT_FAMILIES`

## Evidence
knip default: `apps/og-worker/src/services/fonts.ts: cjkStack, FONT_FAMILIES`. `symrefs`: `cjkStack prod=3 (fonts.ts only) tests=0`, `FONT_FAMILIES prod=1 tests=0`. The live stacks are `STACKS` in `band.ts:46-50` and `STACK_BODY`/`STACK_MONO` in `default-card.ts:58-59` — both hard-code JP-first, which is exactly what `FONT_FAMILIES.bodyCjk`'s NOTE says to compose via `cjkStack(locale)`. Neither reads fonts.ts. CLAUDE.md's file map still advertises `fonts.ts # getFontBuffers() + FONT_FAMILIES export`.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | NONE |
| **Reversibility** | EASY |

## Recommendation
**REMOVE** `cjkStack` + `FONT_FAMILIES` (27 lines) and fix the CLAUDE.md file-map line. See DEAD-027 for making `STACKS` the single source.
