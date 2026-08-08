# 4C Pin rail — Gradient Builder port spec (distilled from the design project)

Source: `Gradient Tool Directions.dc.html` (Turn 4, fetched 2026-08-08) +
`GradientScreen.dc.html`. CONFIRMED: **4C Pin rail is the Gradient Builder spec; 4A
(Ribbon) and 4B (Ladder) stay as the record.** Everything else is the confirmed 1A/3C
language.

## The problem the direction answers

Harmony and the Extractor produce a *set*; a gradient produces a *sequence* — the
interesting failure isn't one bad match, it's a ramp that reads smooth in theory and
lurches in practice. An eight-step ramp between two of 136 dyes will have steps at ΔE 2
and steps at ΔE 25, and today you find that out by reading eight cards. All three
directions answer *how do you see the gap between the ideal ramp and the achievable
one?* — 4C answers it by letting you fix the achievable.

## The pin (the sentence of explanation)

Normally the ramp is drawn between the two endpoints and each step hunts for the
nearest real dye — every middle step is a compromise, and its ΔE is how far it missed.
**Pinning a step swaps which one is in charge**: the dye that step matched becomes a
fixed waypoint, and the ramp is redrawn as two shorter ramps — endpoint → pin and
pin → endpoint — so the curve must pass through a colour that actually exists in the
game. The pinned step's error drops to **0.0** (it is no longer aiming at anything) and
its neighbours re-aim around it. You keep the good part of a ramp and rebuild only the
bad part.

- Multiple pins allowed (`pins: []` state; segments between consecutive anchors each
  re-interpolate).
- The two endpoints show a **dashed anchor mark**, not a pin — they are already fixed.
- Controls: Pin this step / Unpin per step; a Pinned-steps panel with count, the
  explainer ("Pin a step to make it an anchor. Segments either side re-interpolate
  around it.") and Clear pins.

## Layout (4C frames)

1. Endpoints block: FROM / TO dye cards with Swap; Steps count; Interpolation mode.
2. **Ramp**: ideal band and dye band (the 4A ideal-over-achievable read rides along),
   per-step ΔE (drift) labels, average-ΔE (`avg ΔE`) summary; pin affordance per step;
   dashed anchors at the ends.
3. Step focus → detail card below (Result Card, confirmed fields).
4. Export CSS action in the header.
5. Five interpolation spaces, really implemented — oklch ("Modern perceptual — best
   overall, even lightness"), lab, lch, hsv, rgb — switchable in Advanced, ramps
   change live.

## Register deltas (this doc predates later turns)

- The doc's ALGOS block still lists the retired six (oklab default, hyab,
  oklch-weighted). **The Phase-1 suite vocabulary overrides**: six-set, ΔE2000
  default — do not port the old list.
- Exclusions/fields/formats blocks match the current shared config components — no
  action.
- Phase-0 already fixed the svg generator's gradient boundary-distance defect; the web
  tool's per-step ΔE must measure step-vs-matched-dye, not neighbour distance.

## Strings

en/de/ja verbatim in the doc's UI block: ramp/ideal/matched/step/from/to/swap/steps/
endpoints/interpolation, pinned/pinnedDesc/clearPins/pin/unpin/endAnchor, avgDrift,
exportCss, startColour/endColour + the five MODES labels/descs. fr/ko/zh authored at
port time. Land under `gradient.*`, diffing against existing keys.

## Deltas vs the shipped tool (work list)

- Pinning does not exist — the new capability. State: `pins: number[]` (step indexes);
  generator: piecewise interpolation between anchors (endpoints + pinned steps'
  matched dye colours); pinned step ΔE = 0.0.
- Ideal-vs-achievable bands: shipped tool shows one ramp of matched results; the flush
  ideal band above with per-step drift is the 4A read to add.
- avg ΔE summary + per-step drift labels.
- Export CSS exists? Verify; add if absent (ideal ramp or dye ramp — export the dye
  ramp's hexes).
- v4-shell reality (9C lesson): one main flow; inline styles for non-Lit content.
