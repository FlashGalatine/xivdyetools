# Manual security review — `apps/og-worker` (2.2.0) + `apps/image-worker` (1.0.0)

- **Audit:** 2026-08-21 monorepo security audit (see `../AUDIT_MANIFEST.md`)
- **Reviewer:** Claude Code (Fable 5), read-only manual code review — no source files modified; this report is the only file written
- **Deploy units:**
  - `xivdyetools-og-worker` — routed **in front of the production web app** on `xivdyetools.app/{harmony,gradient,mixer,swatch,comparison,accessibility,extractor,presets,budget}/*` plus the custom domain `og.xivdyetools.app`; the top-level (beta) env `xivdyetools-og-worker-dev` is routed the same way on `beta.xivdyetools.app/*` plus `og-beta.xivdyetools.app` **and** `workers_dev = true`.
  - `xivdyetools-image-worker` — Photon WASM host; **no routes, `workers_dev = false` in both envs**; reached only over service bindings from discord-worker (`POST /extract`) and presets-api (`POST /thumbnail`).
- **Method:** every non-test file under `apps/og-worker/src` and `apps/image-worker/src` read in full, plus both `wrangler.toml`s; call paths traced into `packages/svg/src/base.ts` (text escaping / width estimation), `packages/core` (`normalizeMatchingMethod`, `extractLocaleCode`, `TranslationProvider` fallbacks), `packages/worker-kit/src/middleware/{logger,request-id}.ts`, and — for image-worker — into the two callers (`apps/discord-worker/src/{services/image-client.ts,handlers/commands/extractor.ts}`, `apps/presets-api/src/{handlers/presets.ts,services/preview-image-service.ts}`). Three platform facts were checked against current Cloudflare docs (URL size limit, Workers Cache opt-in, same-zone/workers.dev `fetch()` rules). Full coverage list at the end.
- **Severity scale:** CRITICAL / HIGH / MEDIUM / LOW / INFO. Confidence: CONFIRMED (read at the cited lines and the path traced end-to-end) or PLAUSIBLE (magnitude or runtime behaviour depends on platform/library internals not verifiable from the repo).

---

## Executive summary

**No CRITICAL or HIGH findings.** The headline concern for og-worker — reflected XSS in crawler HTML served on the production origin — was specifically hunted and **not found**: every interpolation in `generateOGHTML` goes through `escapeHtml` (`& < > " '`), `<html lang>` and `og:locale` come from an allowlist, and every emitted URL is anchored to `env.APP_BASE_URL` / `env.OG_IMAGE_BASE_URL`, so no user input can choose a scheme or host. og-worker makes **no outbound call to presets-api** (curated presets are bundled from `@xivdyetools/core`; community ids degrade to the default card), so no user-submitted preset text reaches an embed or a card. SVG cards escape every text node and attribute via `escapeXml` and are rasterised to PNG by resvg-wasm — no `image/svg+xml` is ever served. image-worker has no public surface at all, an exact-match HTTPS Discord-CDN allowlist, and validated one-hop redirects.

What remains is two MEDIUM resource-exhaustion issues — one per worker — and a tail of LOW/INFO hardening items:

| ID | Sev | Location | Title |
|----|-----|----------|-------|
| OG-1 | **MEDIUM** | `apps/og-worker/src/index.ts:494`, `services/svg/swatch.ts:43-45`, `services/svg/band-shared.ts:50-56`, `services/svg/band.ts:241-247, 264-309` | Unbounded `:color` path segment on `/og/swatch/:color/:limit` reaches the cubic-time `wrapName`/`fit` hyphenation loops — a single ≤16 KB URL burns seconds-to-minutes of CPU (unauthenticated, unrate-limited, uncached) |
| OG-2 | LOW | `og-data-generator.ts:683, 693, 705, 715-726, 748` + `services/translator.ts:42-44, 57-63` + `packages/core/.../TranslationProvider.ts:463-468` | Unvalidated `?harmony=`, `?vision=`, `?sheet=`, `?race=`, `?gender=`, `?hex=/?color=`, `?steps=`, `?ratio=` are echoed (escaped) into `og:title` / `og:description` on `xivdyetools.app` — link-preview content spoofing, not XSS |
| OG-3 | LOW | `index.ts:235-238, 695-698, 717-719`; `og-data-generator.ts:545-641` | Crawler HTML on the production origin carries no CSP / `X-Content-Type-Options` / `Referrer-Policy` / `X-Frame-Options`, and is `Cache-Control: public` without `Vary: User-Agent` |
| OG-4 | LOW | `apps/og-worker/wrangler.toml` (no `[cache]`), `services/renderer.ts:129-136`, `index.ts` (no rate-limit middleware) | The "24 h browser / 7 d edge" cache headers are inert — Workers Caching is opt-in and not enabled, `caches.default` is never used — so every `/og/*` hit is a full 1200×1050 resvg raster with attacker-variable cache keys and no rate limit |
| OG-5 | LOW | `wrangler.toml:21`; `index.ts:207-216, 724-730` | Beta worker is also published on `*.workers.dev`; non-crawler requests there `fetch()` the worker's own workers.dev hostname (CF error 1042 → 5xx) and the public render surface is duplicated on a third hostname |
| OG-6 | INFO | `og-data-generator.ts:196-197, 322, 384-385` | Raw (unencoded) `harmony` / `vision` / swatch `color` values are spliced into the emitted `og:url` / `og:image` URLs (host-anchored, so no redirect; `withLang`/`withAlgo` `?`-detection can be confused) |
| OG-7 | INFO | `index.ts:114-121, 130-145, 198-204`; `packages/worker-kit/src/middleware/logger.ts:142-144` | Raw User-Agent logged for every request (incl. human pass-through) and an Analytics Engine datapoint written per human request before the crawler check; no IP/PII in Analytics Engine |
| OG-8 | INFO | `index.ts:330, 333, 373, 417, 462, 501, 569` | 400 bodies echo the raw offending parameter (JSON-encoded, `application/json` — harmless; nit) |
| OG-9 | INFO | `index.ts:709-720` | Any path under the routed prefixes returns **200** crawler HTML (no `Cache-Control`) to a crawler UA; a spoofed-UA browser receives a `meta refresh` to itself (self-loop). Hygiene only |
| IMG-1 | **MEDIUM** | `apps/image-worker/src/photon.ts:77-85, 162-209, 273-297`; `validators.ts:42-52, 204-224` (dead); `index.ts:54-59, 84-92` | No pre-decode dimension/pixel gate — `MAX_IMAGE_DIMENSION` / `MAX_PIXEL_COUNT` / `validateDimensions()` exist but are never called; photon fully decodes any 10 MB (extract) / 5 MB (thumbnail) file → decompression bomb kills the isolate. Reachable by any Discord user (`/extractor` attachment) and any web user (preset preview upload) |
| IMG-2 | LOW | `index.ts:56-59`; `photon.ts:95-125` | `maxDimension` from the JSON body is unvalidated (NaN/≤0/huge) — breaks the "≤256 KiB payload" contract or drives `resize(img, 0, 0)` |
| IMG-3 | LOW | `validators.ts:366-384`; `index.ts:85` | Size limits are enforced only after full buffering (`arrayBuffer()`); `Content-Length` is advisory and `/thumbnail` has no cap of its own |
| IMG-4 | INFO (PLAUSIBLE) | `photon.ts:77-85`, `273-297` | photon panics (Rust `unwrap`) on corrupt-but-magic-valid input; caught, but a panicked wasm-bindgen instance is formally undefined for the isolate's remaining life |
| IMG-5 | INFO | `validators.ts:125-128, 140-144`; `index.ts:70-73, 98-101` | `normalizedUrl` keeps userinfo/fragment; IPv6 literal regex never matches bracketed hostnames (moot behind the exact allowlist); raw `error.message` forwarded to the (internal) caller |

| Severity | Count | IDs |
|---|---|---|
| CRITICAL | 0 | — |
| HIGH | 0 | — |
| MEDIUM | 2 | OG-1, IMG-1 |
| LOW | 6 | OG-2, OG-3, OG-4, OG-5, IMG-2, IMG-3 |
| INFO | 6 | OG-6, OG-7, OG-8, OG-9, IMG-4, IMG-5 |

---

## Part A — `apps/og-worker`

### Threat model recap

Two surfaces share one Hono app:

1. **Crawler intercept** on the nine tool paths of the *production* zone. `detectCrawlerFromRequest` runs a literal-regex table over `User-Agent` (`crawler-detector.ts:19-52`). Crawler → synthesized `text/html` with OG/Twitter meta tags; anyone else → `return fetch(request)` (the raw request, untouched) to the Pages origin. Spoofing the UA only changes *which representation you get*; nothing authenticating depends on it, and the crawler HTML is a public, fully escaped stub. The pass-through forwards method, headers, cookies and body verbatim (Hono never reads the body; `c.req.raw` is the original `Request`) and returns the origin response (Hono re-wraps it to merge the `X-Request-ID` header; status/body untouched). `request.url`'s host is set by Cloudflare, not by the client's `Host` header, so there is no host-header trust. Same-zone `fetch()` from a route to its own hostname goes to origin (standard), and the og custom domain is explicitly guarded against self-fetch (`isOgImageHost`, BUG-069).
2. **Image rendering** under `/og/*`, reachable on `og.xivdyetools.app` (prod), `og-beta.xivdyetools.app` + `*.workers.dev` (beta). Every route validates its parameters, builds an SVG string on a 400-grid through `generateBandCard`/`generateDefaultCard`, and rasterises with resvg-wasm (`renderer.ts`) to `image/png`.

Outbound: **no service bindings, no presets-api call, no external fetch** other than the pass-through (verified by grep over `src/`: the only `fetch(` calls are `index.ts:215` and `:730`).

---

### OG-1 — MEDIUM — CPU-exhaustion DoS via unbounded `:color` on `/og/swatch/:color/:limit` (cubic text-wrapping on the not-found card)

- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-407 (Inefficient Algorithmic Complexity)
- **Confidence:** CONFIRMED (reachability + complexity read at the cited lines; wall-clock magnitude is an estimate)
- **Where:**
  - `apps/og-worker/src/index.ts:493-523` — the only image route whose path segment is forwarded without any validation:
    ```ts
    app.get('/og/swatch/:color/:limit', async (c) => {
      const color = c.req.param('color');            // ← never validated; only `limit` and `?algo=` are
      ...
      const svg = generateSwatchOG({ frame: frameFromQuery(c), color, limit, algorithm, locale });
    ```
  - `apps/og-worker/src/services/svg/swatch.ts:43-46` — a non-hex value becomes the *label* of the not-found card:
    ```ts
    const clean = options.color.replace('#', '').toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(clean)) {
      return notFoundBand(getToolTag('swatch', locale), 'swatch', `#${clean}`, 'swatch', frame, locale);
    }
    ```
  - `apps/og-worker/src/services/svg/band-shared.ts:50-56` — that label is used **twice**, as a band `name` (`nameSize: 17`) and as the `deck`:
    ```ts
    bands: [{ hex: '#17171A', role: role('notFound', locale), name: label, nameSize: 17 }],
    ... deck: label,
    ```
  - `apps/og-worker/src/services/svg/band.ts:264-309` (`wrapName`, called at `:481`) and `:241-247` (`fit`, called at `:505` for the deck and inside `wrapName`). Every width measurement `w()` is `estimateTextWidth` (`packages/svg/src/base.ts:292-309`), a linear scan over the string's code points. The hyphenation pass walks `cut` **down one character at a time**, re-slicing and re-measuring the prefix on every step:
    ```ts
    let rest = word;
    while (w(rest) > maxPx) {
      let cut = rest.length - 1;
      while (cut > 2 && w(`${rest.slice(0, cut)}-`) > maxPx) cut--;   // Σ O(cut) ≈ L²/2 per pass
      if (cut <= 2) break;
      atoms.push(`${rest.slice(0, cut)}-`);
      rest = rest.slice(cut);                                          // shrinks by ~40 chars (380 px at 17 px)
    }
    ```
    Cost ≈ Σ over passes of (remaining length)²/2 ≈ L³ / (6 × 40). `fit()` on the deck adds an O(L²) loop (`while (out.length > 1 && w(out + '…') > maxPx) out = out.slice(0, -1)`).
- **Exploit:** Cloudflare accepts URLs up to **16 KB** (docs: *Workers → Limits → "URL size 16 KB"*), so a single request like
  `GET https://og.xivdyetools.app/og/swatch/AAAA…(15 000 × 'A')/5.png`
  passes Hono, fails the hex regex, and enters `wrapName` with L ≈ 15 000: ≈ 1.4 × 10¹⁰ character operations (≈ 2 × 10⁹ at L = 8 000; ≈ 2.7 × 10⁸ at L = 4 000) — seconds to minutes of CPU per request, i.e. until the per-request CPU limit terminates it (error 1102). No rate limiting exists on the worker (OG-4), nothing caches the response (OG-4), and the same path is live on `og-beta.xivdyetools.app` and the beta `*.workers.dev` hostname (OG-5). The crawler path *also* emits this image URL for any `?hex=<junk>` swatch share (`og-data-generator.ts:322`), so the attacker does not even need to hit the image host directly — though doing so is cheaper. Only the swatch route is affected: every other not-found label is built from `parseInt` results (≤ ~25 chars each, ≤ 16 of them) or a 64-char regex-validated slug.
- **Impact:** availability of the image host (event-loop monopolisation inside the isolate, CPU-time billing, possible platform throttling). No data exposure.
- **Fix:**
  1. Validate at the route, mirroring the extractor route: `if (!/^#?[0-9A-Fa-f]{6}$/.test(color)) return c.json({ error: 'Invalid color' }, 400);` — and in `generateOGDataForTool('swatch')` fall back to `toolDefault(...)` for a non-hex `?hex=/?color=` so no junk image URL is emitted.
  2. Defence in depth in `notFoundBand`: `label = label.slice(0, 48)` (nothing legitimate is longer).
  3. Make `wrapName` robust regardless of caller: cap the input it will hyphenate (e.g. 200 code points) and/or binary-search `cut` instead of the linear walk.
  4. Add a regression test: a 16 KB `:color` returns 400 in well under 50 ms; a 16 KB *name* into `generateBandCard` completes in milliseconds.

### OG-2 — LOW — Reflected, HTML-escaped user text in `og:title` / `og:description` on the production domain (link-preview content spoofing)

- **CWE:** CWE-451 (UI Misrepresentation of Critical Information); CWE-20
- **Confidence:** CONFIRMED (reflection); XSS explicitly ruled out (see positive controls)
- **Where** (`apps/og-worker/src/og-data-generator.ts` unless noted):
  - `:683` `harmony: (searchParams.get('harmony') || 'complementary').toLowerCase()` — **not** checked against `VALID_HARMONY_TYPES` (that list exists only in `index.ts:81-84` for the image route). `services/translator.ts:42-44` → core `TranslationProvider.getHarmonyType` → unknown key → `formatKey(key)` (`packages/core/src/services/localization/TranslationProvider.ts:463-468`, splits on capitals and title-cases) → `:190-195` into `harmony.title` / `harmony.description`.
  - `:748` `vision: searchParams.get('vision') as VisionType` → `:371-373` `getLocalizedVisionName` → `getVisionShort` → `formatKey(raw)`.
  - `:723-725` `sheet` → `getSheetName` → `formatKey(raw)`; `race` → `services/translator.ts:57-63` `getLocalizedClanOrRace` → `return raw`; `gender` → `:118-122` `getGenderName` → `return raw`.
  - `:715` `color = searchParams.get('hex') || searchParams.get('color')` — any string → `:287, 292, 325, 330` (`Match #<anything>`, `theme-color`).
  - `:693` / `:705` `steps` / `ratio` — NaN, negative or huge numbers land in the sentence (`NaN% A + NaN% B`).
  - Plain-object lookups without `Object.hasOwn`: `?harmony=constructor` or `?race=constructor` resolves to an inherited `Object.prototype` function, which is then `String()`-ified into the title (`function Object() { [native code] }`).
- **Exploit:** share `https://xivdyetools.app/harmony/?dye=1&harmony=free%20gil%20giveaway%20at%20evil.example%20official` — Discord/Twitter/Slack unfurl it with the real `xivdyetools.app` domain, the real brand card image, and an `og:title` of “Snow White – Free Gil Giveaway At Evil.example Official Harmony | XIV Dye Tools”. With `?vision=`, `?sheet=`, `?race=` the image stays a perfectly valid card, which makes the preview more convincing. No script or markup is possible (all five HTML-significant characters are escaped), and URLs are host-anchored — so this is phishing-grade content spoofing only.
- **Fix:** validate at parse time and degrade to `toolDefault()` on anything unknown — reuse `VALID_HARMONY_TYPES` / `VALID_VISION_TYPES` from `index.ts`, an explicit `ColorSheetCategory` allowlist, the locale `clans`/`races` key sets (only echo a localized name, never the raw slug), `male|female`, a hex regex for the swatch colour, and clamp `steps` (2–20) / `ratio` (1–99) exactly as the image routes already do. Use `Object.hasOwn` in the translator fallbacks. Cap the length of anything still echoed.

### OG-3 — LOW — No security headers / `Vary` on the crawler HTML served from the production origin

- **CWE:** CWE-693 (Protection Mechanism Failure), CWE-1021
- **Confidence:** CONFIRMED (absence)
- **Where:** `apps/og-worker/src/index.ts:235-238` (tool routes), `:695-698` (root), `:717-719` (catch-all): only `Content-Type` and `Cache-Control` are set; `og-data-generator.ts:545-641` is the template. The Pages `_headers` CSP (if any) does **not** apply to Worker-synthesized responses on the same hostname.
- **Why it matters:** these responses run in the `https://xivdyetools.app` origin, where the web app keeps its auth JWT in `localStorage`. Today the template is fully escaped (no XSS found — see positive controls), so this is defence-in-depth: a CSP turns any future escaping regression into a non-event. The HTML is UA-dependent but `Cache-Control: public, max-age=3600, s-maxage=86400` without `Vary: User-Agent`; no shared cache currently stores it (OG-4), but the contract is wrong and will bite the moment Workers Caching is enabled (OG-4 fix note).
- **Fix:** add `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `Vary: User-Agent` (or make the crawler HTML `Cache-Control: private, no-store` — it is cheap to regenerate).

### OG-4 — LOW — Render endpoints are effectively uncached and unrate-limited (the edge-TTL headers are inert)

- **CWE:** CWE-400, CWE-770
- **Confidence:** CONFIRMED for configuration (Workers Caching is opt-in per Cloudflare docs — *“To turn caching off, set `cache.enabled` to false (or remove the `cache` block)”*; “My Worker runs on every request → check wrangler has `cache.enabled = true`”); impact PLAUSIBLE
- **Where:** `apps/og-worker/wrangler.toml` has no `[cache]` block in either env; `services/renderer.ts:129-136` emits `Cache-Control: public, max-age=86400, s-maxage=604800` + `CDN-Cache-Control`; nothing calls `caches.default`; `index.ts` mounts `requestIdMiddleware` + `loggerMiddleware` only — worker-kit's `rateLimit` middleware is not used.
- **Consequence:** the documented “24 h browser / 7 d edge” (CLAUDE.md) is an intent, not a behaviour: every `/og/*` request executes the Worker and a full resvg raster (~1200×1050 PNG), and the effective cache key is fully attacker-variable (`?lang=`, `?frame=`, `?algo=`, any junk query). Combined with OG-1 this is the amplifier; on its own it is cost/availability exposure of a public compute endpoint.
- **Fix:** either enable Workers Caching (`[cache] enabled = true`) **after** making the UA-dependent paths cache-safe — the Workers cache sits in front of the whole Worker and is keyed on path/entrypoint/version, *not* hostname or UA, so the crawler HTML must become `private`/`no-store` first (else humans would be served the crawler stub and its `meta refresh` loop) — or use `caches.default` inside `renderOGImage` keyed on a normalised URL (known params only). Add a WAF rate-limiting rule on `og.xivdyetools.app/og/*` and consider `rateLimit()` from worker-kit on the render routes.

### OG-5 — LOW — Beta worker is also published on `*.workers.dev`; pass-through there self-fetches

- **CWE:** CWE-16 (Configuration), CWE-749
- **Confidence:** CONFIRMED for configuration; the 1042 outcome per Cloudflare docs (*“On the same zone, the only way for a Worker to communicate with another Worker running on a route, or on a workers.dev subdomain, is via service bindings”*; error table entry 1042)
- **Where:** `apps/og-worker/wrangler.toml:21` `workers_dev = true` (top-level/beta env only; production is `false`). `index.ts:207-216` and `:724-730` call `fetch(request)` for any non-crawler request whose host is not the og image host — on `xivdyetools-og-worker-dev.<account>.workers.dev` that is the Worker's own hostname → error 1042 (5xx). Not an infinite loop (global fetch to a workers.dev Worker is refused, and the platform's 16-hop loop limit is a further backstop), but a guaranteed 5xx on every human hit plus a third public copy of the render surface (OG-1/OG-4 apply there too).
- **Fix:** `workers_dev = false` on the beta env (it already has the `og-beta.xivdyetools.app` custom domain); additionally gate the pass-through on an explicit host check — only `fetch(request)` when `url.hostname === new URL(env.APP_BASE_URL).hostname`, otherwise `Response.redirect(env.APP_BASE_URL, 302)` — so an unexpected ingress host can never trigger a self-fetch.

### OG-6 — INFO — Unencoded user values spliced into emitted `og:url` / `og:image` URLs

- **CWE:** CWE-20 · **Confidence:** CONFIRMED
- **Where:** `og-data-generator.ts:196-197` (`&harmony=${params.harmony}`, `/harmony/${params.dye}/${params.harmony}.png`), `:384-385` (`vision`), `:322` (`/swatch/${params.color}/${limit}.png` — the raw, unvalidated swatch colour; `withAlgo`/`withLang` then decide `?` vs `&` on `url.includes('?')`, which a colour containing `?` defeats). Both base URLs are fixed env strings ending in a path, so the host cannot change (no open redirect, no `javascript:`) — the result is at worst a broken/odd image URL and a redundant cache key. Resolved by the OG-2 validation; otherwise `encodeURIComponent` the segments.

### OG-7 — INFO — Observability footprint

- `index.ts:114-121` enables `logUserAgent: true`; `packages/worker-kit/src/middleware/logger.ts:142-144` logs the raw UA + method + path for **every** request, including human pass-throughs on production tool pages. No IP, no cookies, no query string in the log context. `trackAnalytics` (`index.ts:130-145`) writes only `event`/`tool`/`crawler type` + timestamp — **no PII** — but is called at `:198-204` *before* the crawler check, so every human page view on the nine paths also writes an Analytics Engine datapoint (cost, not privacy). Consider logging UA only for crawler hits and moving the analytics write after the branch.

### OG-8 — INFO — 400 bodies echo the raw parameter

- `index.ts:330, 333, 373, 417, 462, 501, 569` return `Invalid harmony type: ${harmonyTypeRaw}` etc. as JSON (`c.json` → `application/json`, JSON-encoded) — no injection; nit: omit the echo or truncate it.

### OG-9 — INFO — Catch-all returns 200 HTML for unknown routed paths; spoofed-UA self-loop

- `index.ts:709-720`: any crawler-UA request under a routed prefix that matches no tool route (e.g. `/harmony/anything`) receives a **200** generic embed with no `Cache-Control`; a browser spoofing a crawler UA on a tool page receives `<meta http-equiv="refresh" content="0;url=<same page>">` and loops. Hygiene (SEO/status correctness), no security impact. Consider 404 for the crawler fallback and `private` caching.

### Positive controls verified — og-worker

- **HTML output encoding:** `generateOGHTML` (`og-data-generator.ts:545-641`) wraps *every* dynamic value — title, description, url, imageUrl, siteName, themeColor, the body link and label — in `escapeHtml` (`:646-653`, escapes `& < > " '`). `<html lang>` uses the allowlisted locale; `og:locale` maps through a fixed table; `GROUND`/`MARK_STRIPES` are constants. `<a href>` / `meta refresh` / `og:url` always start with `env.APP_BASE_URL` (fixed scheme+host+path) — no `javascript:` and no open redirect. **No XSS found.**
- **SVG output encoding:** `band.ts:214-238` `bandText` escapes the text node *and* the `fill` attribute; band `hex` values are escaped in `fill="…"` (`:426, 433`); `default-card.ts:57-74` `text()` escapes content; `escapeXml` (`packages/svg/src/base.ts:12-19`) covers `& < > " '`. Cards are rasterised to `image/png` (`renderer.ts:129-136`) — no `image/svg+xml` is served; fonts are bundled Data imports (`fonts.ts`), resvg-wasm in Workers has no network/filesystem.
- **Route validation (image routes):** stainIDs `parseInt` + `isNaN` guards; `harmonyType` / `algo` / `visionType` enum allowlists (`index.ts:81-100`); `steps` 2–20; `ratio` 1–99; `limit` 1–20 (then capped to 4); comparison/accessibility ≤ 16 ids (sliced to 4); extractor ≤ 5 regex-validated hex entries; preset slug `^[a-z0-9-]{1,64}$`; `?lang=` through `extractLocaleCode` (allowlist); `?frame=` boolean. All regexes are linear (no nested quantifiers — no ReDoS), including the UA table.
- **Number handling:** huge/negative ids become map misses → not-found card; `getDyeByItemId` is a `Map` lookup; no loops are sized by user numbers except `steps` (bounded, then re-capped to `BAND_CAP`).
- **No user-submitted text anywhere:** presets come from bundled `presetData` (`og-data-generator.ts:437`, `svg/presets.ts:35-36`); community ids degrade to the default card; no presets-api binding (`wrangler.toml` has no `[[services]]`; grep confirms the only `fetch(` calls are the pass-through).
- **Pass-through fidelity:** `fetch(request)` / `fetch(c.req.raw)` forward the untouched `Request` (method, headers incl. cookies, body stream); origin response returned as-is (Hono merges `X-Request-ID` onto it). `request.url` host is CF-authoritative; og custom-domain self-fetch guarded (`isOgImageHost`); `app.get` handlers also serve HEAD (Hono 4.13.1 dispatches HEAD → GET, `hono-base.js:279`). Googlebot deliberately not intercepted.
- **Error handling:** `onError` (`index.ts:737-751`) returns a generic JSON 500 and logs server-side; `renderOGImage` catch returns plain `Image generation failed`; no stack traces in any response. WASM init failure resets the promise for retry (`renderer.ts:55-60`).
- **Secrets:** none (stateless worker; only two public vars).

### Route table — og-worker (registration order; Hono 4.13.1)

| # | Method / pattern | Crawler UA | Other UA | Notes |
|---|---|---|---|---|
| – | `use('*')` | `requestIdMiddleware`, `loggerMiddleware({logUserAgent:true})` | | |
| 1 | `GET /health` | JSON status | same | reachable only on og/og-beta/workers.dev hosts (zone routes are `/<tool>/*`) |
| 2 | `GET /{tool}`, `GET /{tool}/` ×9 | HTML embed (`max-age=3600, s-maxage=86400`) | `fetch(request)` → Pages origin; on the og host `302 APP_BASE_URL` | analytics datapoint before branch |
| 3 | `GET /presets/:presetId` | same handler (`tool='presets'`, slug regex) | same | |
| 4 | `GET /og/:tool/default.png` | PNG 24 h/7 d | same | tool ∈ SUPPORTED_TOOLS else 404 |
| 5 | `GET /og/harmony/:dyeId/:harmonyType` | PNG | same | enum + NaN checks; `?algo=` allowlist |
| 6 | `GET /og/gradient/:startId/:endId/:steps` | PNG | same | steps 2–20 |
| 7 | `GET /og/mixer/:dyeAId/:dyeBId/:ratio` | PNG | same | ratio 1–99 |
| 8 | `GET /og/mixer/:dyeAId/:dyeBId/:dyeCId/:ratio` | PNG | same | |
| 9 | `GET /og/swatch/:color/:limit` | PNG | same | **`:color` unvalidated → OG-1**; limit 1–20 |
| 10 | `GET /og/comparison/:dyes` | PNG | same | ≤16 ids |
| 11 | `GET /og/accessibility/:dyes/:visionType` | PNG | same | ≤16 ids, vision enum |
| 12 | `GET /og/extractor/:colors` | PNG | same | ≤5 `RRGGBB[-share]` |
| 13 | `GET /og/presets/:presetId` | PNG | same | slug regex |
| 14 | `GET /og/budget/:dyeId` | PNG | same | NaN check |
| 15 | `GET /og/default.png` | PNG 24 h/7 d | same | |
| 16 | `GET /` | root HTML embed (24 h) | `302 APP_BASE_URL` | not routed on the zones |
| 17 | `ALL *` | generic HTML embed, **200**, no cache header | og host → 404 JSON; else `fetch(c.req.raw)` | OG-9 |
| – | `onError` | generic JSON 500 | | |

Hosts: prod `xivdyetools.app/{9 tools}/*` + `og.xivdyetools.app` (custom domain, `workers_dev=false`); beta `beta.xivdyetools.app/{9}/*` + `og-beta.xivdyetools.app` + `xivdyetools-og-worker-dev.*.workers.dev` (`workers_dev=true`, OG-5). No `[cache]`, no `[[services]]`, Analytics Engine binding only.

---

## Part B — `apps/image-worker`

### Threat model recap

Binding-only Photon host: `POST /extract` takes `{url, maxDimension?}`, fetches the image (Discord CDN allowlist), decodes, resizes (default 256 px), returns raw RGBA; `POST /thumbnail` takes raw bytes, crops/resizes to 640×264, returns WebP. Callers: discord-worker (`/extractor` — attachment URL from any Discord user) and presets-api (`PUT …/preview` — upload from any authenticated web user, ≤ 5 MB, sniffed PNG/JPEG/WebP). No auth on the binding by design — Cloudflare service bindings are the trust boundary, and `wrangler.toml` exposes **no route and no workers.dev in either env** (positive control, verified).

### IMG-1 — MEDIUM — Decompression bomb: full decode before any dimension/pixel gate (the gate exists but is dead code)

- **CWE:** CWE-409 (Improper Handling of Highly Compressed Data), CWE-400
- **Confidence:** CONFIRMED (dead gate + unconditional full decode + both caller paths traced); exact failure mode (OOM-kill vs. WASM trap) PLAUSIBLE
- **Where:**
  - `apps/image-worker/src/photon.ts:77-85` — `loadImage` is a bare full decode:
    ```ts
    export function loadImage(buffer: Uint8Array): PhotonImage {
      try {
        return PhotonImage.new_from_byteslice(buffer);   // decodes the whole image to RGBA in WASM memory
    ```
    called unconditionally by `processImageForExtraction` (`:162-209`, step 1 before any resize) and `processImageForThumbnail` (`:273-297`).
  - `apps/image-worker/src/validators.ts:42-52, 204-224` — `MAX_IMAGE_DIMENSION = 4096`, `MAX_PIXEL_COUNT = 16 Mpx` and `validateDimensions()` are exported with the comment *“Prevents decompression bombs where a small file expands to huge pixel data”* — but **nothing in `src/` calls them** (grep: only the test files); `photon.ts:219-237` `getImageDimensions()` is likewise unused and would itself full-decode. `docs/operations/IMAGE_WORKER_SPLIT.md:88` lists these limits as if enforced.
  - `apps/image-worker/src/index.ts:54-59` — the only checks before decode are URL allowlist, ≤ 10 MB, and 12-byte magic sniff (`validateAndFetchImage`); `:84-92` — `/thumbnail` has none beyond non-empty.
  - Callers do not compensate: `apps/discord-worker/src/handlers/commands/extractor.ts:429-466, 501` forwards `attachment.url` with **no** `attachment.width/height/size/content_type` check; `apps/presets-api/src/handlers/presets.ts:713-740` checks only `byteLength ≤ 5 MB` + magic sniff before `storePreviewImage` (`services/preview-image-service.ts:66-70`).
- **Exploit:** upload a flat-colour 20 000 × 20 000 PNG (≈ 1–2 MB — deflate compresses uniform rows ~1000:1; even 6 000 × 6 000 → 144 MB RGBA is enough) as the `/extractor image:` attachment, or as a preset preview. photon/`image` decodes to 1.6 GB of RGBA → far beyond the 128 MB Worker memory limit → the isolate is terminated (error 1102), failing every in-flight `/extract`/`/thumbnail` in it; repeating the request keeps the worker in a restart loop. The caller receives an error and the user a localized failure message — availability only, but it is reachable by **any Discord user** and **any logged-in web user**, costs the attacker nothing, and the defensive constants already exist.
- **Fix:** gate on *header* dimensions before `new_from_byteslice`: parse width/height from the first bytes — PNG `IHDR` (bytes 16–23, big-endian), GIF logical screen (bytes 6–9, little-endian), BMP (bytes 18–25, little-endian), JPEG (scan markers for `SOF0/1/2` → height/width), WebP (`VP8X` canvas at bytes 24–29 / `VP8L` / `VP8` headers) — and call the existing `validateDimensions(w, h)` (reject > 4096 px or > 16 Mpx; fail closed if unparseable). Add crafted-header tests. Optionally belt-and-braces in the callers (discord-worker can check Discord's `attachment.width/height`; presets-api can reuse the same header parser).

### IMG-2 — LOW — Unvalidated `maxDimension` in the `/extract` body

- **CWE:** CWE-20 · **Confidence:** CONFIRMED (internal caller is trusted; discord-worker never sends it today)
- **Where:** `index.ts:56-59` passes `body.maxDimension` straight to `resizeImage` (`photon.ts:95-125`). `NaN`/negative/huge → the `width > maxDimension` test is false → no resize → `PhotonImage.new_from_byteslice(image.get_bytes())` (a PNG re-encode + re-decode) and the **full-resolution** RGBA is returned (up to 64 MB for 4096², breaking the “≤ 256 KiB payload” contract in `IMAGE_WORKER_SPLIT.md:109`); `0` → `resize(image, 0, 0)` (photon panic, IMG-4).
- **Fix:** `Number.isInteger(v) && v >= 16 && v <= 1024` else default 256.

### IMG-3 — LOW — Size limits enforced only after full buffering

- **CWE:** CWE-770 · **Confidence:** CONFIRMED
- **Where:** `validators.ts:366-384` — `Content-Length` is checked if present, then `await response.arrayBuffer()` reads the *entire* body before `validateFileSize(buffer.byteLength)`; a chunked/mis-sized response from the (allowlisted) CDN is buffered whole. `index.ts:85` `/thumbnail` calls `c.req.arrayBuffer()` with no cap at all (the only bound is presets-api's 5 MB pre-check upstream).
- **Fix:** read via `response.body.getReader()` accumulating ≤ `MAX_FILE_SIZE_BYTES` and abort on overflow; check `Content-Length` + stream-cap on `/thumbnail` too.

### IMG-4 — INFO (PLAUSIBLE) — photon panics on malformed input; instance state after a panic is undefined

- `photon.ts:77-85, 273-297`: photon-rs's `new_from_byteslice` (and `resize`/`crop` on degenerate boxes, e.g. a 1×1 source → `computeCropBox` yields a zero-height band) panic via Rust `unwrap()`; wasm-bindgen surfaces that as a thrown `RuntimeError`, which the code catches and maps to `Failed to load image: …` (so the caller's substring contract holds). A panicked (panic=abort) WASM instance is formally in an undefined state for the remaining life of the isolate; in practice subsequent calls usually work, but treat repeated “Failed to load image” errors on valid inputs as a signal to recycle. No action required beyond awareness; IMG-1's header gate removes the common degenerate-dimension trigger.

### IMG-5 — INFO — Validator nits

- `validators.ts:125-128`: `normalizedUrl = parsedUrl.toString()` preserves `username:password@` and `#fragment`; strip `username`/`password`/`hash` before fetching. `:140-144`: the IPv6 literal regex can never match because WHATWG `URL.hostname` keeps the brackets (`[::1]`) — moot behind the exact-match allowlist, but the “defense in depth” comment overstates it. `index.ts:70-73, 98-101`: raw `error.message` (upstream HTTP status, photon internals) forwarded to the caller — acceptable for an internal binding whose consumer substring-matches it by contract.

### Positive controls verified — image-worker

- **No public surface:** `wrangler.toml` — `workers_dev = false` at top level *and* under `[env.production]`, no `routes`, no custom domain; consumers bind the production name (`discord-worker/wrangler.toml:37-39, 88-90`; `presets-api/wrangler.toml:35-37, 65-67`). No secrets, no storage bindings (`types.ts:10-13`).
- **SSRF controls (`validators.ts:91-171`):** `new URL()` parse; `protocol === 'https:'` only; **exact-match** hostname allowlist (`cdn.discordapp.com`, `media.discordapp.net`) — no suffix matching, so `evil-cdn.discordapp.com.attacker.tld` and userinfo tricks fail; IP-literal / metadata / private-range blocklist as redundant depth (decimal IPs, `0.0.0.0`, `localhost`, internal `*.workers.dev` hostnames are all rejected by the allowlist first).
- **Redirects (`validators.ts:323-360`):** `redirect: 'manual'` (Workers return the 3xx with its `Location`), the target is re-validated with the same function, at most **one hop**, second fetch `redirect: 'error'`.
- **Timeout:** 10 s `AbortController` covering both fetches *and* the body read (`:324-325, 376, 390-391`).
- **Format check:** magic bytes for PNG/JPEG/GIF/WebP(RIFF+WEBP)/BMP (`:236-273`) — content-type header is not trusted.
- **WASM memory hygiene:** every `PhotonImage` is `free()`d in `finally`, with a `Set` to avoid double-free of identical pointers (`photon.ts:191-208, 284-295`); EXIF is stripped by the decode/encode round-trip (`:267-272`).
- **Error envelope:** JSON `{error}` with 400, no stack traces; `/health` only returns `{status:'ok'}`.

### Route table — image-worker

| Method / pattern | Input | Output | Caller |
|---|---|---|---|
| `use('*')` | `requestIdMiddleware`, `loggerMiddleware({readEnvironmentFromEnv:false})` | | |
| `GET /health` | – | `{status:'ok'}` | – |
| `POST /extract` | JSON `{url: string, maxDimension?: number}` | `application/octet-stream` RGBA + `X-Image-Width/Height`; 400 `{error}` | discord-worker `services/image-client.ts:44-50` (no `maxDimension` sent today) |
| `POST /thumbnail` | raw image bytes | `image/webp` 640×264; 400 `{error}` | presets-api `services/preview-image-service.ts:66-70` |
| (no catch-all) | Hono default 404 | | |

No routes, no `workers_dev`, no custom domain in either env → reachable only via `IMAGE_WORKER` service bindings.

---

## Coverage

**og-worker (all non-test files read in full):** `src/index.ts`, `src/types.ts`, `src/crawler-detector.ts`, `src/og-data-generator.ts`, `src/services/fonts.ts`, `src/services/renderer.ts`, `src/services/og-embed.ts`, `src/services/og-strings.ts` (tables skimmed, all helper functions read), `src/services/translator.ts`, `src/services/svg/{index,tokens,band,band-shared,default-card,dye-helpers,harmony,gradient,mixer,swatch,comparison,accessibility,extractor,presets,budget}.ts`, `wrangler.toml`, `package.json`, `CLAUDE.md`; `src/index.test.ts` consulted for the pass-through spy only.

**image-worker (all files read in full):** `src/index.ts`, `src/photon.ts`, `src/validators.ts`, `src/types.ts`, `wrangler.toml`, `package.json`.

**Shared code traced:** `packages/svg/src/base.ts` (`escapeXml`, `estimateTextWidth`), `packages/svg/src/icons/tool-icons.ts` (`toolGlyph`/`GLYPH_ACCENT_LIGHT` signatures), `packages/core/src/types/index.ts` (`normalizeMatchingMethod`), `packages/core/src/services/LocalizationService.ts` (`extractLocaleCode`), `packages/core/src/services/localization/TranslationProvider.ts` (`getDyeName/getHarmonyType/getVisionShort/getSheetName/getRace/getClan/formatKey`), `packages/worker-kit/src/middleware/{logger,request-id}.ts`.

**Callers traced (image-worker):** `apps/discord-worker/src/services/image-client.ts`, `apps/discord-worker/src/handlers/commands/extractor.ts:405-505`, `apps/discord-worker/wrangler.toml` (services), `apps/presets-api/src/handlers/presets.ts:700-745`, `apps/presets-api/src/services/preview-image-service.ts`, `apps/presets-api/wrangler.toml` (services), `docs/operations/IMAGE_WORKER_SPLIT.md`.

**Dependencies inspected:** `hono` 4.13.1 (`hono-base.js` HEAD→GET dispatch), `@cf-wasm/photon` 0.3.7 (version only).

**Platform facts verified against Cloudflare docs (2026-08-21):** URL size limit 16 KB (Workers → Limits); Workers Caching is opt-in via `cache.enabled` and a Worker without it runs on every request; global `fetch()` from a Worker to a Worker on a route or `workers.dev` fails without a service binding (error 1042), 16-hop loop limit.
