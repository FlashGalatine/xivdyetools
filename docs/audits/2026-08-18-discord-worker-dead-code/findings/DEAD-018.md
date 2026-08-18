# [DEAD-018]: `GLYPH_ACCENT_LIGHT` is exported but every consumer hard-codes the literal `#CE2222`

## Category
Unused Export (redundant token) — REFACTOR FIRST

## Location
- `packages/svg/src/icons/tool-icons.ts:29` — `export const GLYPH_ACCENT_LIGHT = '#CE2222'` (2 lines); `GLYPH_ACCENT_DARK` is live
- Hard-coded copies of the same literal: `packages/svg/src/frame.ts:305` (`appIcon`), `apps/og-worker/src/services/svg/band.ts:140`, `apps/web-app/src/services/theme-service.ts:78`

## Evidence
`git grep -nw GLYPH_ACCENT_LIGHT` → definition + barrel only; `git grep -n "#CE2222"` → the three literals above.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — the token is unused, but the *value* is clearly load-bearing in three places |
| **Blast Radius** | LOW |
| **Reversibility** | EASY |

## Recommendation
**REFACTOR FIRST** — wire the three literals to the constant (that is what it exists for) rather than deleting it. Deleting would leave three copies of a brand colour with no single source.
