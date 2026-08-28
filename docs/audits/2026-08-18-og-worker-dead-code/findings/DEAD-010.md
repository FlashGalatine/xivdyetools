# [DEAD-010]: The comparison image route drops `frame`, so `generateComparisonOG`'s X-frame branch is unreachable (and X gets a cropped card)

## Category
Dead Code Path (defect — unreachable branch via caller)

## Location
- `src/index.ts:556` `const svg = generateComparisonOG({ dyeIds, locale });`
- `src/services/svg/comparison.ts:260, 267, 318-319` (`frame` option, `footRight: frame === 'x' ? …`)

## Evidence
Eight of the nine image routes pass `frame: frameFromQuery(c)`; comparison is the odd one out. So `?frame=x` — which `og-data-generator.withFrameX` puts on **every** `twitter:image` URL — is silently ignored for comparison: X fetches a 1200×1050 card and crops it (the exact failure the X frame exists to prevent, per band.ts:22-25), and the `frame === 'x'` branches in comparison.ts (`CLOSEST Δ…` in the footer, the 210-high field) can never execute from production. `comparison.test.ts` calls the generator directly with `frame: 'x'`, which is why nothing is red.

## Why It Exists
Comparison was ported to 15E first (its module note calls it "a qualified acceptance"); the `frame` plumbing landed in the route table afterwards for the other tools and this call site was missed.

## Removal Risk Assessment
| Factor | Assessment |
|---|---|
| **Confidence** | HIGH |
| **Blast Radius** | NONE (one-line fix) |
| **Reversibility** | EASY |

## Recommendation
**KEEP + FIX** — `generateComparisonOG({ dyeIds, locale, frame: frameFromQuery(c) })`, and add a route-level test asserting a `?frame=x` request renders 1200×630 (mock `renderOGImage` and inspect the SVG's `height="210"`).
