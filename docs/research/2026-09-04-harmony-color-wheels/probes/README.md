# Probes

Self-contained Node scripts (no dependencies) that produced the numbers quoted in this folder. Each
reads `packages/core/src/data/dyes.json` relative to its own location, so run them from anywhere:

```bash
node docs/research/2026-09-04-harmony-color-wheels/probes/wheelstakes.mjs
```

| Script | What it measures | Output |
|---|---|---|
| `wheelstakes.mjs` | For all 125 dyes × complementary/triadic/analogous: the nearest-dye partner under the RGB wheel vs the RYB warp vs OKLCH constant-L/C rotation (CSS Color 4 gamut map and naive clip); the metric-swap comparison (ΔE00 vs ΔE_OK ranking); grey stability | `wheelstakes.output.txt` |
| `wheelstakes2.mjs` | The same comparison adding an OKLCH *hue-warp* wheel (S/V carry); reports the warp table's non-monotonicity and round-trip error before monotonising | `wheelstakes2.output.txt` |
| `wheelstakes3.mjs` | Where the OKLab and CIELab hue of the sRGB pure-hue circle stop being monotone (the 0.16° dent at HSV 231.4°–240°) | `wheelstakes3.output.txt` |
| `core-ryb-wheel-probe.mjs` | Where core's existing `rybToRgb` (the mixer's "Paint" model) places the twelve RYB hues, to compare against the 25-pair warp table | `core-ryb-wheel-probe.output.txt` |

`wheelstakes*.mjs` were written by the implementation research pass and re-run from this location on
2026-09-04; the outputs checked in are from that re-run.
