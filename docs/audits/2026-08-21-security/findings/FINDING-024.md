# FINDING-024: og-worker crawler HTML on the production origin — unvalidated query params echoed into OG tags; no CSP/nosniff/Referrer-Policy; cacheable without `Vary`

## Severity
**LOW** — values are HTML-escaped (reflected XSS was specifically hunted and not found), so the result is link-preview content spoofing on `xivdyetools.app/{tool}/*` URLs, plus missing defence-in-depth headers on HTML served from the app's own origin. Reviewer IDs: OG-2, OG-3, OG-6, OG-9.

## Category
CWE-20 Improper Input Validation · CWE-693 Protection Mechanism Failure (missing headers)

## Location
- `apps/og-worker/src/og-data-generator.ts:683-748` + `services/translator.ts:42-63` — `?harmony/vision/sheet/race/gender/hex/steps/ratio` flow into `og:title`/`og:description` unvalidated (escaped); `:196-197, 322, 384-385` — unencoded values spliced into `og:url`/`og:image`.
- `apps/og-worker/src/index.ts:235-238, 695-698, 717-719` — crawler HTML responses carry no `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`; `Cache-Control: public` without `Vary: User-Agent` although the body depends on UA; unknown routed paths return 200 HTML.

## Recommendation
Validate each echoed parameter against its enum/regex (fallback to defaults), `encodeURIComponent` values in emitted URLs, add the same security headers the Pages `_headers` file sets (at least `CSP: default-src 'none'`, nosniff, Referrer-Policy) and `Vary: User-Agent` (or key the cache on the crawler decision); return 404 for unknown paths.

## References
- Evidence: `../evidence/review-og-image-workers.md` (OG-2, OG-3, OG-6, OG-9)
