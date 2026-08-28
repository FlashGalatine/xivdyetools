# [DEAD-027]: Design constants re-typed across files — font stacks ×3, the `#0B0B0C` ground ×4, the six mark stripes ×3

## Category
Legacy Code (duplication that the code's own comments forbid)

## Location
| Constant | Copies |
|---|---|
| Font stacks (`Fragment Mono, Onest, Noto Sans JP, …`) | `band.ts:46-50` `STACKS`; `default-card.ts:58-59` `STACK_BODY`/`STACK_MONO`; `fonts.ts:134-147` `FONT_FAMILIES` (dead, DEAD-006) |
| Ground `#0B0B0C` | `band.ts:88` `GROUND`; `default-card.ts:50` `GROUND`; `index.ts:50` `BAND_RENDER.background`; `renderer.ts:277` default; `og-data-generator.ts:420` HTML `background` |
| Mark stripes `#E5484D #F76B15 #FFC53D #30A46C #0091FF #8E4EC6` | `default-card.ts:41-48` `MARK_STRIPES` ("the mark's source of truth, referenced once, never re-typed per card"); `band.ts:144-149` `ogMark` rects; `og-data-generator.ts:452` inline `<span style="background:#E5484D">…` |
| Glyph ink/accent `{ size: 13, ink: '#ECECEE', accent: '#FF6257' }` | `band-shared.ts:29` `bandGlyph`; `harmony.ts:206,242`; `default-card.ts:109-113, 191-195` |

## Evidence
`grep -rn "#0B0B0C\|#E5484D\|Noto Sans KR'" src` — counts above. `default-card.ts:38-39` explicitly promises MARK_STRIPES is referenced once; `ogMark()` and the crawler HTML each re-type the six hexes. None of this is *dead*, but each copy is a place a design change can miss — and DEAD-006's dead `FONT_FAMILIES` is what happens when a "single source" is created and then not used.

## Recommendation
**REFACTOR (MEDIUM)** — one `services/svg/tokens.ts` (or reuse fonts.ts after DEAD-006) exporting `GROUND`, `STACKS`, `MARK_STRIPES`, `GLYPH_INK`; `ogMark` and the HTML template iterate `MARK_STRIPES`; `renderer.ts` and `index.ts` import `GROUND`. ~30 lines removed, one place to change. Pairs naturally with DEAD-014.
