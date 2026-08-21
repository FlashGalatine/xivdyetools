# FINDING-005: og-worker CPU exhaustion via unbounded `:color` on `/og/swatch/:color/:limit`; `/og/*` renders are never edge-cached

## Severity
**MEDIUM** — unauthenticated, unrate-limited, uncached; one ≤16 KB URL forces a cubic-time text-wrapping loop (seconds → CPU-limit kill) before rasterisation. Reviewer IDs: OG-1, OG-4, OG-5. Coordinator-verified (`wrapName`/`fit` loops).

## Category
CWE-400 Uncontrolled Resource Consumption · CWE-1050 Excessive Platform Resource Consumption within a Loop

## Location
- `apps/og-worker/src/index.ts:494-500` — `color = c.req.param('color')` with no length cap.
- `apps/og-worker/src/services/svg/swatch.ts:43-45` — invalid hex → `notFoundBand(…, '#' + clean, …)` echoes the whole parameter as the card title.
- `apps/og-worker/src/services/svg/band.ts:264-309` — `wrapName()` hyphenation: for an over-wide word, `while (cut > 2 && w(rest.slice(0,cut)+'-') > maxPx) cut--` with `w()` linear in the slice → O(L²) per fragment, O(L³/k) overall; `fit()` (`:241-247`) is O(L²).
- `apps/og-worker/src/services/renderer.ts:129-136` — `Cache-Control`/`s-maxage` headers only; `caches.default` is never used, so every request is a full resvg raster.
- `apps/og-worker/wrangler.toml:21` — the beta worker is additionally exposed on `*.workers.dev`.

## Description
The not-found card path treats the raw URL parameter as display text and feeds it to a wrapping algorithm whose cost grows cubically with input length. Cloudflare accepts URLs up to 16 KB, so a single request drives the worker to its CPU limit; there is no cache to absorb repeats and no rate limit.

## Impact
Cost amplification / degraded availability of social cards on the production origin (`xivdyetools.app/{tool}/*` crawler path) and `og.xivdyetools.app`.

## Recommendation
1. Return 400 for non-hex `:color` and cap every echoed parameter (≤ 32 chars) before it reaches any card.
2. Make `wrapName`/`fit` linear: compute the cut position from per-character width prefix sums instead of decrementing and re-measuring.
3. Put `/og/*` behind `caches.default` (key = full URL incl. `lang`/`frame`/`algo`) so repeat requests are served from the edge; consider a light per-IP limit (see FINDING-003 for backend choice).

## References
- Evidence: `../evidence/review-og-image-workers.md` (OG-1, OG-4, OG-5)
