# 5C Mixing field — Dye Mixer port spec (distilled from the design project)

Source: `Mixer Tool Directions.dc.html` (Turn 5, fetched 2026-08-08) +
`MixerScreen.dc.html`. CONFIRMED: **5C Mixing field is the Dye Mixer spec; 5A (Bench)
and 5B (Model wall) stay as the record.**

## Why the tool exists (and why 5C)

The Mixer looks like the Gradient Builder's little sibling and would be redundant built
that way. What makes it a tool is `MixingMode`: six models that disagree violently —
blue + yellow lands on grey in RGB, pink in LAB, cyan in OKLAB, olive in RYB and green
under Kubelka-Munk. **The model is not a setting buried in Advanced — it is the
question the tool asks.** 5C crosses model against ratio: six model rows × five ratio
columns (10/30/50/70/90), thirty real blends on one screen, every cell tappable. It is
the only direction where you can see two models agree at 50/50 and diverge at 80/20 —
which happens constantly and is invisible otherwise.

## Layout (5C frames)

1. Dyes block: DYE A / DYE B cards with Swap.
2. Mix hero: the selected cell's blend at full size — hex, `{model} · {ratio}` line,
   CLOSEST DYE row (best match + ΔE).
3. **The field**: `Model × ratio` — rows are the six models (row headers use the
   technical abbreviation MODEL_SHORT: RYB / Spectral / OKLAB / LAB / HSL / RGB —
   identical in every locale, full names on the tooltip), columns the five ratios.
   Each cell renders its real blend colour and its matched-dye ΔE; tapping a cell makes
   it the mix (fieldDesc: "Tap any cell to make it the mix. Rows are models, columns
   are ratios."; hint: "6 models × 5 ratios"). Selected cell ringed.
4. Matches list below follows the selected cell (count from the existing control).
5. Optional (from 5B, strings exist): Model spread — how far apart the six models land
   at the current ratio; "High means the choice of model matters a lot for this pair."

## Model rows (labels/descs verbatim en/de/ja; fr/ko/zh authored)

ryb Paint ("RYB colour wheel — blue + yellow = olive") · spectral Pigment
("Kubelka-Munk — how real paint behaves") · oklab Perceptual ("OKLAB — even, modern,
no muddiness") · lab LAB ("Older perceptual space, warmer bias") · hsl Hue ("Sweeps
the wheel, keeps saturation") · rgb Light ("Additive — blue + yellow = grey").

## Register deltas

- The doc's ALGOS block is the retired matching list — Phase-1 vocabulary overrides
  (six-set, ΔE2000 default) for the *matching* method. The six *mixing* models are a
  different axis and stay as-is (they match core's blending modes).
- The web tool already implements all six mixing modes via core/spectral.js — the 5C
  work is presentation: the field grid replacing the single-model flow.
- v4-shell reality: one main flow, inline styles for non-Lit content.

## Deltas vs the shipped tool (work list)

- The field grid (6×5, tappable, per-cell blend + ΔE, selected ring) — the new UI.
- Mix hero with `{model} · {ratio}` line + CLOSEST DYE row.
- Ratio columns are fixed 10/30/50/70/90 in the field; the fine-grained ratio slider
  remains for the selected mix (the field is the map, the slider the vernier).
- Save mix action (strings exist; wire to saved shelf or defer with note).
