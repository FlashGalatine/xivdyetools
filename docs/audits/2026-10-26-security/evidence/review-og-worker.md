# og-worker review (2026-10-26), HEAD 13c386e5

Unit: apps/og-worker 2.12.0. No service bindings, no secrets, no D1/KV/R2. Only bindings: ANALYTICS (Analytics Engine), vars APP_BASE_URL / OG_IMAGE_BASE_URL.

## Route table / authz matrix (all INTERNET-UNAUTH by design, GET only, no auth anywhere)

| Route | File:line | Gate before handler | Notes |
|---|---|---|---|
| middleware requestId + logger | index.ts:~112-120 | - | logUserAgent:false, path = pathname only (worker-kit logger.ts getRequestInfo); Workers Logs pinned off (wrangler.toml observability) |
| /og/* length guard | index.ts:~137 | 64/segment, 512 path | 400 |
| /og/* query allowlist + enum values + repeated-key | index.ts:~262-310 | 6 keys, algo/mode/wheel/interpolation validated, no echo | 404/400 |
| /og/* edge cache | index.ts:~500-530 | key = decoded path + resolved lang/frame + version + per-route axes | 200 only |
| GET /health | index.ts | none | static JSON |
| GET /:tool, /:tool/ (10 tools), /presets/:presetId | createToolHandler | UA crawler regex; humans -> SPA passthrough (5s timeout) or 302 | crawler HTML via escapeHtml + CSP + nosniff + Vary UA |
| GET /og/:tool/default.png, /og/default.png | index.ts | tool allowlist | static |
| GET /og/harmony,gradient,mixer(2/3),swatch,comparison,accessibility,extractor,presets,budget | index.ts | canonical-int / hex / slug grammars, bounds (steps 2-20, ratio 1-99, limit 1-20, dyes<=16, extractor entries sliced 5) | 400 JSON, no echo |
| GET / , app.all('*') | index.ts | crawler -> HTML; og host -> 404 JSON; non-app host -> 302 APP_BASE_URL; app host -> passthrough | fetch target is the request itself, not user-chosen (no SSRF) |
| onError | index.ts | generic 500, no stack/env | |

## Data flow / personal data
- writeDataPoint (index.ts trackAnalytics): blobs [event, tool, crawler-type enum], doubles [timestamp], index tool. No IP, UA string, URL, id, lang. crawler human traffic not counted. Clean.
- Logs: 'Serving OG metadata' = tool, locale, crawler type only (pinned by index.privacy.test.ts). console.error sites log errors only (renderer.ts:48,123,158; index.ts:555,1422). Observability disabled both envs.
- No cookies, no storage, no outbound requests other than SPA passthrough of the inbound request.
- character-cells.ts (new): reads only bundled core colour tables; input is sheet allowlist (isSheet), clan allowlist (Object.hasOwn on SUBRACE_TO_RACE), ^\d{1,4}$ index; output is hex from bundled data. No .chara data, nickname or file name ever reaches the worker (glamour tool has no share grammar, og-data-generator.ts:~1095 default card only).

## POSITIVE controls
- escapeHtml on every interpolated value in crawler HTML (og-data-generator.ts ~812-899); og:url / image URLs are built from env bases plus validated ints / enums / encodeURIComponent; extractor colors regexed to hex; comparison/accessibility dyes are ints; preset id slug-regexed and then looked up in bundled data (curated preset name only ever emitted).
- SVG text through escapeXml (band.ts:216,223,440,447; default-card.ts:119); no request string reaches SVG (ids, enums, canonical ints, upper-case hex only).
- lang through extractLocaleCode allowlist, falls to en; frame is 2-valued.
- Cache key bounded: path decoded, only routes that read algo/mode/wheel/interpolation key them, CARD_VERSION folded in, origin included; unknown query keys 404 before lookup; repeated keys 400 (prevents key/render disagreement).
- Beta vs production: routes and workers_dev set explicitly in both envs, workers_dev=false, separate analytics dataset, OG_IMAGE host != APP host, wrangler-env.test.ts pins these.
- SPA passthrough has 5s AbortSignal timeout; no secrets in [vars]; no .dev.vars tracked (git ls-files shows none).
- Googlebot deliberately not a crawler; UA spoofing only yields the harmless stub HTML.
- Error handler returns generic body; validation errors never echo input.

## REJECTED
- Crawler UA spoof inflates og_request counts / returns stub HTML: no secret, no auth surface; analytics integrity only (INFO).
- Unbounded distinct valid ids/slugs (/og/presets/<any 64-char slug>, unknown dye ids, extractor `-<share>` integers, max ~50 digits so finite) each mint one render + one cache entry: documented in CLAUDE.md as WAF-rate-limit territory (accepted), cosmetic layout only for huge shares.
- Crawler HTML sent `public, s-maxage=86400` with Vary: User-Agent: Worker responses are not edge-cached unless via Cache API, which is used only for /og/*; no poisoning path.
- Cache API key uses url.origin (Host-derived): routes exist only on the zone/custom domains; attacker cannot reach a different origin's keys.
- Hono %2F decode mismatch: closed by canonical grammar (prior FINDING-024 fix intact, no regression seen).
- Analytics/log PII: none found; regression check of 2026-10-03 FINDING-022 (observability pinned off) and 2026-09-15 FINDING-006 (no UA/URL in logs) both hold.

## FILES COVERED
about 28 files read in full or targeted (apps/og-worker: wrangler.toml, package.json, .gitignore, CLAUDE.md, src/index.ts, src/crawler-detector.ts, src/og-params.ts, src/og-data-generator.ts (sinks, escape, swatch, comparison, accessibility, extractor, presets, glamour, dispatcher), src/services/character-cells.ts, src/services/renderer.ts, src/services/svg/{band,default-card,extractor}.ts greps, packages/worker-kit/src/middleware/logger.ts). 72 tracked files in the unit; tests, fonts, og-strings/og-embed copy tables not read line by line.
