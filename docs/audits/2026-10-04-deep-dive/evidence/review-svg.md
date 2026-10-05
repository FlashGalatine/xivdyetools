# Review: slice svg (packages/svg) - deep-dive 2026-10-04

Branch preview/integration-2026-10-04 @80262a2f. Four svg source files changed since the last deep-dive (glamour-card, tool-icons, index, swatch-card); none is changed by an open PR, so every origin is MAIN. Coverage 98.4 / 91.1 / 100 / 98.6 (coverage-baseline.txt:15).

## 1. Map

| Module | Role |
|---|---|
| base.ts | escapeXml (strips XML-illegal chars), hexToRgb, luminance, num/grp number formatting, estimateTextWidth (CJK 2x), THEME, FONTS |
| frame.ts | frame system: CARD_* constants, themes, cardText, textWidth, fitText, cardShell (clamps to 350), commandChip, bandInk, appIcon, markFooter, swatch, measuredRow (five-slot row), formatMeasure |
| harmony-card / gradient / mixer-card / palette-grid / nearest-sheet / swatch-card | measuredRow or slot-row consumers |
| contrast-card / comparison-card / a11y-card | routers (pair count, dye count, vision mode) |
| dye-info-card / random-dyes-grid / budget-ledger / glamour-card | fixed or grown-height sheets |
| preset-swatch.ts | pre-frame 600 px card (deferred) |
| icons/tool-icons.ts | single geometry home, renderGlyph (F / INK substitution) |
| emitted-glyphs.ts | source scanner feeding the Workers' font-coverage gates |

## 2. Candidates

### svg-01 BUG MEDIUM - gradient step-range lead is ellipsised on the 12-step card
- gradient.ts:103 `lead: 28` into frame.ts:570 `fitText(o.lead, w.lead, 13, 'mono')`; the range string is built at bot-logic/src/commands/gradient.ts:310 (`${start}–${end}`); steps go to 12 (discord-worker/src/commands/schemas.ts:395).
- Input: 12 steps where steps 9-10 (or 10-12) resolve to one dye. Mono 13 px is 8.06 px per char, so "9–10" is 32.2 px and "10–12" is 40.3 px, both over 28.
- Result: the row's lead renders "9–…" / "10…". Computed with the fitText algorithm: "2–3" fits, "9–10" gives "9–…", "10–12" gives "10…", "2–11" gives "2–…". The player cannot tell which steps the row covers.
- Tests miss it: gradient.test.ts:23 only uses '2–3'; frame-budget.test.ts:83 builds `${i+2}–${i+3}` (single digits). The 12H·3 twelve-step case never has a two-digit range.
- Origin MAIN. Covered by a test: no.
- Fix direction: widen `lead` to ~44 (taking it from `name`, which keeps the sum at 368) or draw the range at 11 px; add a 12-step range fixture.

### svg-02 BUG LOW - glamour look label drawn at 10.5 px, below the 11 px floor
- glamour-card.ts:237-239 (`size: 10.5`, also measured at :211). CLAUDE.md and frame.ts:9: "Nothing below 11, ever."
- Every /glamour row with a look label violates the floor the whole redesign rests on.
- Missed because svg-03.
- Origin MAIN (bfd393e7 added it). Fix: 11 px, and re-check the 60-132 px lead column fit.

### svg-03 UNTESTED LOW - the frame-budget gate omits five card families
- frame-budget.test.ts:28-35 imports eight generators. glamour, swatch, a11y (three modes), dye-info and budget-ledger are absent, so the "nothing below 11 px" and "no text outside the canvas" assertions never run on them.
- Behaviour that should be caught: a sub-floor size (svg-02) or a right-anchored run past the 16 px margin on a card that opts out. The only per-card checks are height <= 350 (glamour-card.test.ts:90, a11y-card.test.ts:88) and the swatch label's literal size (swatch-card.test.ts:133).
- Origin MAIN. Fix: add the five families (German binding case) to `cards`.

### svg-04 BUG LOW - contrast tier tone is judged on the unrounded ratio, the value printed is rounded
- contrast-card.ts:106-115 `ratioTier(ratio)` uses raw `>= 7 / 4.5 / 3`; 13C·1 prints `num(p.ratio, lang, 1)` (:427), 13A/13B print 2 dp.
- Input: ratio 2.96 prints "3.0" in the failing red; 6.96 prints "7.0" one tier short of the 7 line it names. The match cards avoid this by scoring the display-rounded value (core band-vocabulary.ts:149 `classifyBandTierWithCuts`).
- Origin MAIN. Not tested (no boundary case in contrast-card.test.ts). Fix: round to the printed dp before `ratioTier`, or print 2 dp.

### svg-05 REFACTOR LOW - /budget row cap mirrors the ledger's pixel constants with literals
- apps/discord-worker/src/services/budget/budget-calculator.ts:52-58 hardcodes `350 - 43 - 27`, GROUP_H 24, ROW_H 40, FOOTER_H 32, FOOTER_2LINE_H 47. packages/svg/src/budget-ledger.ts:107-116 owns the same numbers. The barrel (index.ts:207-215) exports only HEADER_H, COLHEAD_H and the two footer heights; LEDGER_GROUP_H and LEDGER_ROW_H are not exported, and the calculator imports none of them.
- A change to the ledger geometry silently lets the calculator pack rows past 350; cardShell then clamps the height and the footer and mark draw off the canvas. No parity test. Origin MAIN.
- Fix: export the two missing constants and import them in the calculator, or add a parity test.

### svg-06 BUG LOW (latent) - scanEmittedGlyphs fails open on `\u` escapes and on a keyword-preceded regex
- emitted-glyphs.ts:141-143 skips every backslash pair, so `'★'` records nothing (the "2605" is ASCII). A glyph written as an escape is invisible to the font-coverage gate - the exact FONT-002 failure class the file exists to close.
- emitted-glyphs.ts:97 treats `/` as division when `prev` is a letter, so `return /'/.test(s)` opens a string at the quote and desyncs; an even number of flips returns without the EOF throw (:169) and drops later literals.
- No current source triggers either (grep of `\u` in svg / discord-worker / bot-logic finds only U+200B at about.ts:117, which is not drawn). Origin MAIN. emitted-glyphs.test.ts has neither case. Fix: decode `\uXXXX` / `\u{...}`; treat a preceding keyword (`return`, `typeof`, `case`...) as regex-start.

### svg-07 REFACTOR LOW - caps and empty input are the caller's job on four generators
- glamour-card.ts:224, swatch-card.ts:176 and budget-ledger.ts:222 do not slice to the row cap (mixer/palette/nearest/gradient/random do). Six glamour rows give 56 + 288 + 33 = 377; cardShell clamps to 350 and the footer and mark land off the canvas. Bot-logic caps at 5 (glamour.ts:405), so latent.
- comparison-card.ts:103/109 (`<= 2` with 0 or 1 dyes) and contrast-card.ts:143/151 (`<= 1` with 0 pairs) dereference undefined (`a.hex`, `worst.hexA`) although the docblocks call the routers total. Latent.
- Fix: clamp with ROW_CAP like the siblings; guard the empty case.

## 3. POSITIVE
- escapeXml (base.ts:18-37) strips XML-illegal chars and lone surrogates before escaping; every `fill=`/`stroke=` interpolation goes through it, and generator-hygiene.test.ts:47 enforces that.
- fitText slices by code point (frame.ts:198) and the hygiene test sweeps budgets to prove no lone surrogate.
- Slot-width tables sum to the content width (gradient 328+40=368, mixer, palette, nearest; swatch 330+40=370 against PAD 15). The 2026-09-16 right-margin fix holds.
- Polarity is right: `separationTone` reverses against classifyBandTier (a11y-card.ts:114, core band-vocabulary.ts:151 gives 0 for the smallest value); bandInk's crossover is the true WCAG point.
- Weights stay on the bundled 400/600/700 (hygiene test).
- Glamour never draws a character name; the header takes producer and tribe only (glamour-card.ts:70).
- Clip and pattern ids are unique per document (appIcon counter, fixed ids once per card).

## 4. REJECTED
- appIcon `markUid` is module state (frame.ts:334) so identical input gives different bytes across calls: no consumer hashes or caches the SVG (searched discord-worker), and CLAUDE.md documents it.
- preset-swatch MIN_SWATCH_WIDTH 80 overflowing 600 px: presets cap at 6 dyes (presets-api validation-service.ts:28-31), and 6 x 85 fits.
- hexToRgb on a 3-digit or malformed hex gives NaN (base.ts:42): bandInk falls back to white, nothing throws, and callers pass normalised hexes.
- `num()` could print "-0.0" (base.ts:288): distances are non-negative.
- estimateTextWidth ignores astral CJK (U+20000+, base.ts:318-323): the Noto subsets carry no such glyphs, so they render as tofu regardless.
- budget `keyLines[0]` undefined, `tier` NaN: type-prevented, caller-controlled.
- fr thousands separator U+202F (base.ts:276): the glyph scanner and the Workers' font gates cover it.
- gradient deltaE sentinel 999 (bot-logic gradient.ts:285) overflowing the 32 px measure column: only when every candidate is filtered out; not an svg defect.
- Dead rest-strip branch in contrast render13A: owned by the dead-code audit.

## 5. COVERED
19 files read in full: packages/svg/package.json, src/{a11y-card, base, budget-ledger, comparison-card, contrast-card, dye-info-card, emitted-glyphs, frame, glamour-card, gradient, harmony-card, index, mixer-card, nearest-sheet, palette-grid, preset-swatch, random-dyes-grid, swatch-card}.ts, src/icons/tool-icons.ts. Tests skimmed: frame-budget, generator-hygiene, gradient, glamour-card, swatch-card, a11y-card (grep), plus core band-vocabulary.ts and the bot-logic / discord-worker callers noted above.
