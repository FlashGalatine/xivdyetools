# Review: og-worker (2026-10-03)

Scope: apps/og-worker at 0ab33466. Read-only; no probes written.

## 1. Entry points and authz matrix

All routes are unauthenticated GETs (anyone on the internet). No secrets, no bindings except the optional ANALYTICS dataset (apps/og-worker/wrangler.toml). No D1/KV/R2, no service bindings, no in-worker rate limiter (the WAF rule of 2026-09-01 is the out-of-repo control; not verifiable from source).
Middleware order (src/index.ts): requestId (154) > logger, logUserAgent:false (155-162) > on /og/*: path caps 64/segment, 512 total (178-192) > query-key allowlist + algo/mode/wheel value validation (216-288) > edge cache match/put, GET+HEAD, 200 only (408-433) > handler.

| Entry | Guard before handler | Param caps |
|---|---|---|
| GET /health (466) | none | none; returns status + ISO time |
| GET /{tool}, /{tool}/ x10 (617-619), GET /presets/:presetId (622) | UA crawler detect (index.ts:564); non-crawler -> 302 to APP_BASE_URL unless app host, else fetch(request) with 5s timeout (532-541) | query values parsed through og-params whitelists/clamps; presetId /^[a-z0-9-]{1,64}$/ (og-data-generator.ts:~925) |
| GET /og/:tool/default.png (788) | /og/* guards; tool in SUPPORTED_TOOLS | lang/frame only |
| GET /og/harmony/:dyeId/:type (803), gradient (856), mixer 2/3 dye (901, 947), budget (1208) | /og/* guards; canonical int (704) | steps 2-20, ratio 1-99, path <=64/seg |
| GET /og/swatch/:color/:limit (995) | color /^[0-9A-F]{6}$/ (726), limit 1-20 | |
| GET /og/comparison/:dyes (1041), accessibility (1075) | canonical int list, <=16 ids (715, 1055) | segment <=64 chars so <=~32 ids anyway |
| GET /og/extractor/:colors (1120) | canonical RRGGBB[-n] entries, <=5 drawn | |
| GET /og/presets/:presetId (1162) | slug regex 64; `default` reserved (1197) | |
| GET /og/default.png (1230), GET / (1246) | / : crawler -> HTML, human -> 302 constant | |
| ALL * (1265) | crawler -> 404 no-store; og host -> 404 JSON; non-app host -> 302; app host -> bounded pass-through | |
| onError (1299) | generic 500 body, no stack echo | |

## 2. Positive controls

- Crawler metadata log carries only tool, normalized locale, crawler category: src/index.ts:597-601. Guarded by a real-request test with UA, full-URL and query sentinels: src/index.privacy.test.ts:30-53. Regression of 2026-09-15 FINDING-006 does not exist.
- Request logger: logUserAgent false (index.ts:160), middleware logs method + pathname only (packages/worker-kit/src/middleware/logger.ts:~118-165, never the query); worker-kit test pins no userAgent (logger.test.ts:245-252).
- Analytics Engine datapoint = blobs [event, tool, crawler category], double [timestamp], index tool (index.ts:448-452). No IP/UA/URL/lang/option values. Human page views not counted (581-588).
- Cache key canonical: pathname (decoded, .png stripped), resolved lang, resolved frame, CARD_VERSION, raw-but-validated algo/mode, normalised wheel only on route that reads it (335-383); query key allowlist (259-265) retains FINDING-024 fix; verified no regression.
- Escaping: generateOGHTML escapes every interpolated value (og-data-generator.ts escapeHtml, used on title/description/url/imageUrl/siteName/themeColor); all SVG text/attrs via escapeXml (packages/svg/src/base.ts:29, drops XML-illegal chars; band.ts:216-223, 440, 447). Echoed user text in SVG is only the preset slug [a-z0-9-], clipped to 32 code points (band-shared.ts:63-88).
- Share-URL data rendered by crawler/cards is whitelisted: ints looked up in dye DB, enum ids, hex; unknown -> default card (og-data-generator.ts:760-948). Crawler HTML sent with CSP default-src 'none', nosniff, Vary: User-Agent, no-referrer (index.ts:122-140).
- character-cells.ts: input is only a sheet enum, <=4-digit cell index, SubRace via Object.hasOwn and gender enum (character-cells.ts:36-79; og-data-generator.ts swatch case); output is a palette hex from bundled core tables. No .chara data, TypeName or Nickname can reach og-worker: glamour has no share grammar (case 'glamour' -> toolDefault, og-data-generator.ts:~940).
- No SSRF: only outbound fetch is pass-through of the incoming request to its own routed host, 5s timeout, app-host check (index.ts:478-541). Redirect targets are env constants.
- resvg cost: fixed x3 raster of two frame sizes, labels clipped, comparison/extractor lists capped, no user-controlled geometry or text length.
- Error handler generic (1299-1313); renderer returns generic text on failure and 500 is never cached (renderer.ts, index.ts:423).

## 3. Rejected items

- Unlimited distinct valid-but-unknown ids (e.g. /og/budget/<n>) each cost a resvg render: documented residual of FINDING-024, bounded by WAF rule deployed 2026-09-01 (2026-09-15 report FINDING-024 row); code unchanged. Beta host og-beta is not shown in the repo to be covered by the same rule (handoff).
- Spoofed `Discordbot` UA gets the HTML stub / inflates og_request counter: no secret, counter only, no personal data.
- trackAnalytics runs before gradient/mixer range checks, so 400 requests also write datapoints: metric inflation only, not a privacy item.
- Cloudflare edge ignores Vary: User-Agent: not applicable, Worker responses are not auto-cached in the zone; only Cache API entries for /og/* PNGs, which do not vary by UA.
- Exact Date.now() double in the datapoint: Analytics Engine stamps every row anyway; not an added fingerprint, no identifiers present.
- Pathname logged in "Request started/completed" contains extractor colours / swatch hex: Workers Logs are off per web-app PRIVACY.md and wrangler.toml has no observability block; live-tail only.
- Meta-refresh/og:url injection: url built from APP_BASE_URL + validated ints/enums, then escaped.
- HEAD cache path / S7-R8, percent-encoded path collapse S7-R9, `/og/presets/default` poisoning S7-R16: verified fixed in code (335-383, 1197).
- Hono `c.header` on cached Response (immutable headers): out of scope, covered by tests/behaviour not security.

## 4. Files covered

apps/og-worker/src/index.ts (full), og-data-generator.ts (full), og-params.ts, crawler-detector.ts, index.privacy.test.ts, services/character-cells.ts, services/renderer.ts, services/svg/band-shared.ts (notFoundBand/clipLabel), grep of services/svg/band.ts and presets.ts (escapeXml, presetId), types.ts (head), wrangler.toml, CLAUDE.md; packages/worker-kit/src/middleware/logger.ts, packages/svg/src/base.ts (escapeXml); apps/web-app/PRIVACY.md (lines 60-160); discord-worker PRIVACY_POLICY.md (grep); evidence/{pii-sinks,pii-sources,outbound-fetch,wrangler-surface,delta-commits}.txt (filtered); prior reports 2026-09-15 and 2026-08-29 (grep).

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:77,99 vs apps/og-worker/src/index.ts:448 | PRIVACY.md says og-worker "sees only the URL" and that analytics run only when opted in, but og-worker writes a non-opt-in, non-GPC-gated Analytics Engine datapoint per crawler hit and per uncached card render (tool, crawler category, ms timestamp). No personal field; the document is silent. Case 3: CORRECT (six-file edit). |

## 6. Handoffs

- documentation: c1 wording, add one sentence on og-worker's server-side counters (no IP/UA/URL) to PRIVACY.md and its 5 translations.
- infra/doc: confirm the 2026-09-01 WAF rate-limit rule also matches og-beta.xivdyetools.app and beta.xivdyetools.app (live beta routes), since no in-worker limiter exists.
- plain bug (minor): index.ts:874-883 and 919-928 write the analytics datapoint before the steps/ratio range check, so rejected requests are counted.
