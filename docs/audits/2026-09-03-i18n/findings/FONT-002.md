# FONT-002: `/preset` cards draw `★` next to the vote count, and no bundled face in either worker has U+2605 — it renders as tofu
**Tier:** P1 (visible on every preset card carrying a vote count) · **Locale(s):** all six — **locale-independent**, filed here because it was found by the font sweep and the fix is a font/gate change · **Deploy unit:** svg (+ discord-worker, og-worker fonts) · **Generated?** no

## Location
- `packages/svg/src/preset-swatch.ts:226` — `metaParts.push(\`${voteCount}★\`)`, joined and drawn through `text(...)` at :229.
- `apps/discord-worker/src/services/font-coverage.test.ts:126` — `const CODE_GLYPHS = 'Δα·—…→↓–↔≈°÷♂♀#%'` — the list of glyphs emitted from code, which the gate asserts are drawable. `★` is not in it.

## Evidence
- `evidence/svg-literal-glyphs.txt` — U+2605 is carried by **0 of 10** bundled faces in discord-worker and **0 of 10** in og-worker (fontTools cmap read, per face).
- The gate therefore passes: it only checks the 15 characters someone remembered to list, so a new emitted glyph is invisible to it by construction.
- The same file already knows this hazard and handles it correctly one screen earlier — `preset-swatch.ts:198`: *"CATEGORY_DISPLAY icons remain for Discord **message** text, where they work."* The category emoji are deliberately kept off the card; the star was not given the same treatment.

## Fix
- Either draw the rating without `★` (e.g. `12 votes`, localizable, which also removes a bare symbol from a localized surface), or add U+2605 to the Latin subsets and to `CODE_GLYPHS`.
- Better: derive the gate's emitted-glyph set from the source instead of a hand-maintained literal — scan `packages/svg/src/**` for non-ASCII literals outside comments and assert the union covers them. That closes the whole class rather than this one character.
- Verify by rendering; the SVG string looks correct today.

## Rejected while verifying this
- The nine emoji in `CATEGORY_DISPLAY` (`preset-swatch.ts:87-94`) are **not** a defect: they are Discord message text (`discord-worker/src/handlers/commands/preset.ts:240`), never drawn by resvg, as the file's own comment states.
- `Δ` (U+0394) is **not** tofu: Space Grotesk carries it in both workers (and Noto JP/SC additionally in discord-worker). It renders from a different face than the surrounding Fragment Mono, which is a minor typographic inconsistency, not a missing glyph.
- The CJK characters my sweep flagged in `harmony-card.ts`, `swatch-card.ts`, `dye-info-card.ts` etc. are all inside **JSDoc comments** describing label examples — never drawn.

## Status
FIXED 2026-09-03 1f3dd97c — `${voteCount}★` replaced by the localized `preset.cardVotes`; the emitted-glyph gate now derives from source via `scanEmittedGlyphs`
