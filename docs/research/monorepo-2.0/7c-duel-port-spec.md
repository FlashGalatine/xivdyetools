# 7C Duel — Dye Comparison port spec (distilled from the design project)

Source: `Comparison Tool Directions.dc.html` + `ComparisonScreen.dc.html` in design project
`993f0c5c-05b9-439b-8047-66a9c5ab1bd6` (fetched 2026-08-08). CONFIRMED: **7C Duel is the
Dye Comparison spec; 7A (Ledger) and 7B (Field) stay in the file as the record.** As with
6A, the drawn screens embed the future mobile shell — out of scope; port the tool content
into the existing v4 shell, inline styles only (shadow DOM — see 6A notes).

## The idea

Seed set: the four dark blues people actually confuse (Ink Blue, Dark Blue, Void Blue,
Midnight Blue) — every pair inside ΔE 12, closest inside ΔE 4, three different acquisition
paths. "The colours have already tied, so the tool has to help you decide on something
else." Comparison is pairwise: six pair chips across the top (closest first — the shipped
*Highlight closest pair* checkbox promoted to the spine), picking one fills the workspace
with that pair; the other dyes wait on the bench.

## Layout (content region, top to bottom)

1. **Slot strip** — up to 4 slots (dye or bare hex via hex field + native picker;
   Comparison joins the arbitrary-colour table). No pinned reference in 7C — the pair IS
   the comparison (the pin belongs to 7A/7B).
2. **Pair chips** — all six pairs, closest first in the active method. Chip: butted swatch
   pair + `A × B` title + value. Active chip = accent border. Section header: `pairs` label
   + mono unit tag right.
3. **The duel panel** — split panel: two large colour halves (names on each), the value +
   unit tag centered between/below.
4. **Verdict** — badge + headline + sub (tone by tier):
   - tier 0 (SAME): badge `SAME COLOUR` — "A and B are the same colour." / sub: "w apart,
     and the match line sits at thr. Nobody will see the difference on a chest piece — so
     this is a price question, not a colour one." + cost line:
     costSame "Both cost the same from the same source…" / costDiff "X is the cheaper of
     the two by N." / costUnknown "A is a vendor dye; B has no vendor price…"
   - tier 1 (CLOSE): `SUBSTITUTABLE` — "A can stand in for B." / "w apart. Side by side
     you can just about tell; at arm's length, on cloth, you cannot."
   - tier 2/3 (NEAR/FAR): `DIFFERENT` — "A and B are clearly different." / "w apart. These
     read as two different dyes at any distance."
   (en/de/ja verbatim in the doc; fr/ko/zh authored at port time.)
5. **What actually differs** — rows: LIGHTNESS / SATURATION / HUE / VENDOR / SOURCE — each
   `label | a-value | b-value | diff`, only where they differ meaningfully (`same`/`differs`
   words exist). Header has ⓘ (MetricHelp) + mono unit short.
6. **Seven readouts, printed at once** ("The same pair, six methods" + RATIO):
   ΔE2000 · ΔEOK · ΔE76 · REDMEAN · RGB DIST · DISTINGUISH % — each `tag | value | verdict`
   where verdict = tier word; then a rule, then **RATIO last** (register: "the ratio is not
   a colour difference"). Verdicts come from **core's calibrated BAND_VOCABULARY** (MATCH
   context per method) — NOT the drawn placeholder bands (the doc's [5,10,25]-style cuts
   predate the calibration; the register reversed them). ΔE2000 keeps the settled 5/10/20.
   RATIO uses core's calibrated RATIO_BANDS (top band anchored 3:1).
7. **Two full-size Result Cards** — "This pair · each measured against the other":
   card A = reference B → candidate A with real ΔE2000, card B mirrored. This fixes the
   shipped inert card (originalColor === matchedColor, showDeltaE=false).
8. **Bench** — "Also loaded": the unselected dyes as small chips; tapping swaps them into
   the duel.

## Tier vocabulary

`TIER_L`: SAME / CLOSE / NEAR / FAR (en); GLEICH / NAH / ÄHNL. / FERN (de);
同一 / 近い / 類似 / 遠い (ja). Four words over three cuts. **Green = close** (kept, the
deliberate polarity inversion vs Accessibility — each tool matches its own shipped
convention). Tier colours: reuse the metric-help ramps but INVERTED semantics — in
Comparison tier 0 (SAME) is green, tier 3 (FAR) is red.

## Method switching

Advanced → Matching method (the tool's config already carries the 5.0 `MatchingMethod`)
or the ⓘ beside a pair heading. The selected method changes the pair chips, the duel
value, and the verdict sentence; the Result Card keeps ΔE2000 regardless. MetricHelp is
the same shared component as 6A but needs a **methods mode**: entries for the six matching
methods with the doc's desc/caveat strings (en/de/ja verbatim; note ΔEOK is "OKLab ×100").
Match threshold slider (1–15, default 5) governs the ΔE2000 SAME cut only; other methods
carry fixed calibrated equivalents.

## L strings (en verbatim; de/ja in doc; fr/ko/zh authored)

sixPairs 'All six pairs' · whatDiffers 'What actually differs' · thisPair 'This pair' ·
eachOther 'each measured against the other' · bench 'Also loaded' ·
sixMethods 'The same pair, six methods' · same 'same' · differs 'differs' ·
DELTA_L: LIGHTNESS/SATURATION/HUE/VENDOR/SOURCE.

## What dies from the current tool

The four stat cards ("average saturation of four dyes you happened to pick is not a
finding"; "Avg Distance" printed unitless), the scatter plot, the bar chart, and the 4×4
matrix (six real numbers in sixteen cells). The comparison-tool's chart code goes.

## Config notes

- Result-card fields: acquisition + vendor cost default ON here ("once the colours tie,
  they are the whole decision").
- The tool's existing config (formats, exclusions, market board) stays; matching method
  moves onto the shared 5.0 config the sidebar already exposes.
