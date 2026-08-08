# 3.3 — /gradient (12H·2/·3/·4) + /mixer (12F) on the measured row

Source: `Bot Graphics Directions 2.dc.html` (Turn 12), all CONFIRMED; strings
×6 verbatim from its authored data script.

## /gradient → 12H·2 "Strip over distinct dyes"

Six steps in the header, five rows under it, no contradiction — the strip
carries **every step** (a 7 px ideal cap over the nearest dye's block per
step: the top edge ramps, the body steps) and the rows are the **distinct
dyes**. Per-step ΔE2000 is computed and kept (the old boundary threw it
away; `GradientStepResult.distance` now carries it). Rows are the measured
row with the ideal half outlined (`sourceIdeal`), lead = step index or
merged range ("2–3", lead slot 28 px).

**The cap as three stages** (`capGradientRows`, one function, both frames):
1. **Merge** adjacent steps resolving to one dye → one row, step range,
   the WORST ΔE of the covered steps.
2. **Drop rows at ΔE 0.0** — testing the VALUE, never the position: a
   bare-hex endpoint has a real ΔE and stays (the most informative row).
3. **Keep the widest gaps**, rendered back in step order; the omitted
   count rides the embed (`card.gradOmitted`).

Legend: `card.gradKey` normally, `card.gradKeyCut` ({n} steps / {k} gaps)
when rows were omitted. 12H·3 (twelve steps) is the same frame with all
stages firing — the strip holds twelve steps regardless.

**12H·4 stage 0** — trigger: ≥4 steps resolving to ≤2 rows **after the
merge** (never on endpoint separation). The card gets shorter, not padded,
and carries the verdict sentence (`card.gradVerdict` ×6: "{n} steps resolve
to {k} dyes. Nothing in the game sits between them.") — numbers that
mislead are where this suite spends a verdict. The strip makes the case
without a word: caps ramp, blocks step once.

Embed: one line (title; description only when rows were omitted).

## /mixer → 12F Ratio (the command's first image)

The sweep replaces the hardcoded midpoint: `MIXER_SWEEP_RATIOS = [25, 40,
50, 65, 80]` (% of dye B), each blended in the command's mode and matched
by ΔE2000 — no `ratio` option on the command; the five rows generate
themselves. The best landing is highlighted (accent % lead, per the drawn
frame). Header: pill + mode readout; the two inputs face each other above
the rows. Rows: measured row, blend half outlined (`ratioKey`: "outline =
blend · solid = nearest dye" ×6 — single-line, ellipsises per the drawn
footer). `MixerResult` gains `svgString` + `sweep`; `blendedHex`/`matches`
(50% legacy shape) stay for adapters; distances flip raw-RGB → ΔE2000.
Embed: one line leading with the best stop ("**80%** · Abyssal Blue").

## Register notes

- `generateGradientBar` deleted; `interpolateColor`/`generateGradientColors`
  survive (bot-logic's RGB interpolation path uses them).
- The verdict/legend word-wrap is a px-budget wrap (`wrapVerdict`) — card
  heights derive from the wrapped line count, so a shorter card is measured,
  not estimated (the 12H·4 lesson).
- `card.gradVerdict` is the authored single-form string — k=1 prints
  "1 dyes" in EN; the doc's own fn had the same shape and the k=1 case is
  the degenerate same-dye-endpoints run. Revisit only if it shows up in use.
- Theme preference wiring still pending (shell unit); `theme?` accepted
  end-to-end.
