# [DEAD-022]: `HarmonyParams.algo` / `GradientParams.algo` / `MixerParams.algo` are parsed from the share URL but never forwarded to the emitted image URL

## Category
Dead Code Path (parsed-but-dropped) — with a product consequence

## Location
- `src/og-data-generator.ts:503, 514, 526` (parse `algo`)
- `src/og-data-generator.ts:145, 176, 210, 221` (`imageUrl` built without `?algo=`)
- contrast: `:261, 269` swatch **does** forward `algo` to both the page URL and the image URL

## Evidence
`generateHarmonyOGData` / `Gradient` / `Mixer` never read `params.algo` (grep the function bodies). The image routes accept `?algo=` and honour it (`ALGO_TAG` in the footer, `deltaForAlgorithm` for the Δ), so a shared `/harmony/?dye=102&harmony=tetradic&algo=oklab` produces an embed whose card says **ΔE2000** while the page the user shared computed **ΔEOK**. The `?perceptual=` sibling is fully dead (DEAD-009). Only swatch is consistent.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH that the fields are unread; the *desired* behaviour is a product call |
| **Blast Radius** | LOW either way |
| **Reversibility** | EASY |

## Recommendation
**REFACTOR FIRST** — decide once: (a) forward `algo` (and `v`, if the page URL is to round-trip) onto the three image URLs like swatch does — the card then matches the page; or (b) stop parsing `algo` for those tools and let the card always speak ΔE2000. (a) is ~6 lines and is what the design's "embed text and picture cannot disagree" rule wants. Note (a) also multiplies edge-cache keys by the number of algorithms actually shared — acceptable.
