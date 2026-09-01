# Review — `apps/og-worker` (2.3.0 + Unreleased) & `apps/image-worker` (1.1.0 + Unreleased)

Whole-monorepo security audit 2026-08-29. Read-only. Reviewer: og-worker + image-worker unit.
Commit `4c213248`. Delta scanned `b195723f..HEAD` (8 commits touch these units) + full sweep
against *Every Worker*, *og-worker/api-worker*, *image-worker*, *Personal data* checklist rows.

**Headline:** the two 2026-08-21 MEDIUMs that owned these units (FINDING-004 image decompression
bomb, FINDING-005 og cubic text-wrap) are **really fixed and guarded by tests** — verified below,
no regression. FINDING-024 (param echo / crawler headers / host-bound pass-through) and FINDING-028
(`escapeXml` control chars) are intact. No CRITICAL/HIGH/MEDIUM found. Neither worker holds a
secret (nothing to rotate). Residue is two LOW defence-in-depth items and two INFO.

## Route / command table + authz matrix

### og-worker (Hono; registration order). Hosts: prod `xivdyetools.app/{9 tools}/*` + `og.xivdyetools.app`; beta `beta.xivdyetools.app/{9}/*` + `og-beta.xivdyetools.app`. `workers_dev=false` both envs. No `[[services]]`, no secrets; ANALYTICS binding only.

| # | Method / path | Params + bounds | Cache | Limiter | Outbound |
|---|---|---|---|---|---|
| mw | `use('*')` requestId + logger(`logUserAgent:false`) | UUID-validated X-Request-ID | – | none | – |
| mw | `use('/og/*')` length guard | segment ≤64, path ≤512 → 400; sets `nosniff` after next() | – | none | – |
| mw | `use('/og/*')` edge cache | key = **full URL** (lang/frame/algo + any junk query) | `caches.default`, GET 200 only, waitUntil | none | – |
| 1 | `GET /health` | – | – | none | – |
| 2 | `GET /{tool}`,`/{tool}/` ×9 | crawler-UA→HTML embed; else host-checked pass-through | crawler `max-age=3600,s-maxage=86400` | none | `fetch(request)` iff `isAppHost`, else 302 APP_BASE_URL |
| 3 | `GET /presets/:presetId` | slug `^[a-z0-9-]{1,64}$` (in generator); path-len guard 64 | as #2 | none | as #2 |
| 4 | `GET /og/:tool/default.png` | tool ∈ SUPPORTED_TOOLS else 404; `?frame`,`?lang` | PNG 24h/7d | none | none (resvg only) |
| 5 | `GET /og/harmony/:dyeId/:harmonyType` | dyeId isNaN→400; harmony enum→400; `?algo` allowlist→400 | PNG | none | none |
| 6 | `GET /og/gradient/:startId/:endId/:steps` | ids isNaN→400; steps 2–20→400; `?algo` | PNG | none | none |
| 7/8 | `GET /og/mixer/...:ratio` (2 & 3 dye) | ids isNaN→400; ratio 1–99→400; `?algo` | PNG | none | none |
| 9 | `GET /og/swatch/:color/:limit` | `:color` unvalidated at route → generator regex→not-found card (clipped 32, linear); limit 1–20→400; `?algo` | PNG | none | none |
| 10 | `GET /og/comparison/:dyes` | 1–16 numeric ids (seg ≤64) else 400 | PNG | none | none |
| 11 | `GET /og/accessibility/:dyes/:visionType` | 1–16 ids; vision enum→400 | PNG | none | none |
| 12 | `GET /og/extractor/:colors` | ≤5 `RRGGBB[-share]` regex; else 400 | PNG | none | none |
| 13 | `GET /og/presets/:presetId` | slug `^[a-z0-9-]{1,64}$`→400 | PNG | none | none |
| 14 | `GET /og/budget/:dyeId` | isNaN→400 | PNG | none | none |
| 15 | `GET /og/default.png` | `?frame`,`?lang` | PNG 24h/7d | none | none |
| 16 | `GET /` | crawler→root embed 24h; else 302 APP_BASE_URL | – | none | – |
| 17 | `ALL *` | crawler→fallback embed **404 no-store**; og host→404 JSON; else host-checked | – | none | `fetch(c.req.raw)` iff isAppHost |
| – | `onError` | generic JSON 500, no stack | – | – | – |

Analytics (`index.ts:216`, crawler hits + image routes only, **after** the human short-circuit): `blobs:[event, tool, crawler-type]`, `doubles:[Date.now()]`, `indexes:[tool]`. **No IP / UA / referrer / path / query / id.**

### image-worker (Hono; service-binding only, no routes, `workers_dev=false` both envs, no secrets/KV/D1/R2)

| Method / path | Input + bounds | Output | Caller |
|---|---|---|---|
| `use('*')` requestId + logger(`logUserAgent` default false; logs pathname only) | – | – | – |
| `GET /health` | – | `{status:'ok'}` | – |
| `POST /extract` | JSON `{url, maxDimension?}`; url→SSRF allowlist; maxDimension int 16–4096 (400); 10 MB streamed cap; header dim-gate before decode | RGBA octet-stream + X-Image-W/H; 400 `{error}` | discord-worker (`/extractor`); never sends maxDimension |
| `POST /thumbnail` | raw bytes; Content-Length pre-check + `readBodyWithCap` 10 MB; non-empty; header dim-gate | `image/webp` 640×264; 400 `{error}` | presets-api (preview upload, 5 MB pre-capped) |
| (no catch-all) | Hono default 404 | – | – |

## Candidates

### OG-01 — LOW — `/og/*` edge-cache key is the full URL: junk query params bust the cache and force unbounded re-renders (no worker rate limit; WAF rule still pending)
- **Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Rotation:** none
- **Where:** `apps/og-worker/src/index.ts:182` `const cacheKey = new Request(c.req.url, { method: 'GET' });`
  ```ts
  const cacheKey = new Request(c.req.url, { method: 'GET' });
  const hit = await cache.match(cacheKey);
  ```
- **Trigger:** `GET https://og.xivdyetools.app/og/harmony/1/complementary?z=<random>` in a loop. The card
  generators read only `algo`/`lang`/`frame`; every other query key changes `c.req.url` (hence the cache
  key) but not the rendered PNG, so each request misses the cache and executes a full resvg raster
  (~1200×1050). `index.ts` mounts no rate-limit middleware, and the WAF rate-limit rule on
  `xivdyetools.app/og/*` is still an **unchecked** box in `docs/operations/POST_MERGE_CHECKLIST.md:342`.
- **Impact:** Cost / availability of the public render endpoint. Much reduced from the 2026-08-21 OG-4:
  FINDING-005 made every render linear-time, so this is normal per-render CPU × unbounded distinct keys,
  not the old seconds-to-minutes blowup. Residual of the accepted/tracked OG-4.
- **Fix:** build the cache key from the pathname + only the significant params (`lang`,`frame`,`algo`),
  not the raw URL; land the pending WAF rate-limit rule.

### IMG-02 — INFO — `/extract` accepts `maxDimension` up to 4096, so a caller can request a ~64 MB RGBA response
- **Severity:** INFO · **Exposure:** INTERNAL (service binding) · **Rotation:** none
- **Where:** `apps/image-worker/src/index.ts:26-34` (`isValidMaxDimension` allows up to `MAX_IMAGE_DIMENSION`=4096); `photon.ts:112-141` resizes *down* only.
- **Trigger:** an internal caller sending `{maxDimension:4096}` for a 4096² source → up to 4096×4096×4 ≈ 64 MB
  `application/octet-stream` back over the binding (the `IMAGE_WORKER_SPLIT.md` contract expects ≤256 KiB at
  the default 256). Bounded by the 16 MP pixel gate, and the only caller (discord-worker `image-client.ts`)
  never sends `maxDimension`, so not currently reachable.
- **Impact:** memory/response-size ceiling on an internal path; noted for the contract, not exploitable today.
- **Fix:** cap the accepted `maxDimension` to what any caller needs (e.g. ≤1024) rather than to the source-side 4096.

### IMG-01 — LOW — image-worker's "private" invariant (no routes / `workers_dev=false`) has no guarding test and no in-code defence-in-depth
- **Severity:** LOW · **Exposure:** INTERNAL now; INTERNET-UNAUTH on config drift · **Rotation:** none
- **Where:** `apps/image-worker/wrangler.toml` (config only, comments not tests); `apps/image-worker/src/index.ts:59,111` (`/extract`, `/thumbnail` run with **no** auth/shared-secret/header check — `types.ts:5` "no secrets" by design). No `tests/wrangler-env.test.ts` exists (contrast og-worker, whose `tests/wrangler-env.test.ts` pins `workers_dev=false` in both envs).
- **Trigger:** a future `routes`/`workers_dev=true` edit, or binding misconfig, silently makes `POST /extract`
  (SSRF-limited to Discord CDN, 10 MB, header-gated) and `POST /thumbnail` (arbitrary-bytes photon decode,
  10 MB, header-gated) reachable unauthenticated. Nothing in code or CI catches the flip.
- **Impact:** defence-in-depth gap. Blast radius is limited by the SSRF allowlist and dimension/byte gates,
  but `/thumbnail` becomes an open image-decode DoS surface if ever exposed.
- **Fix:** add a `tests/wrangler-env.test.ts` asserting `workers_dev=false` + no `routes` in both envs (mirror
  og-worker); optionally require a shared-secret header the two callers already send, so an accidental public
  route still 401s.

### OG-02 — INFO — og-worker Analytics Engine datapoint is not disclosed in any privacy policy (contains no personal data)
- **Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Rotation:** none
- **Where:** `apps/og-worker/src/index.ts:216-220` → dataset `xivdyetools_og_analytics{,_beta}`.
- **Detail (PII checklist reconciliation):** fields are `event` (`'og_request'|'og_image_request'`), `tool`
  (ToolId enum), `crawler` (CrawlerType enum — the *social platform's* bot, e.g. `discord`, or `none` for a
  direct image hit), and `Date.now()`. **No IP, UA, referrer, path, query, dye ids, or any user identifier.**
  Fires only on crawler hits / image renders (after the human short-circuit at `index.ts:293`), so it records
  bot traffic, not user activity. `apps/web-app/PRIVACY.md:47-49` describes og-worker as "sees only the URL"
  and does not mention it keeps analytics; no policy governs this dataset.
- **Why noted:** the *Personal data* row asks every `writeDataPoint` be checked against a governing promise.
  This one has no personal field, so it is a transparency gap, not the MEDIUM the "harmless field not in policy"
  rule targets (that rule is about a *personal* field). Recorded so the coordinator can decide on disclosure.
- **Fix (optional):** one line in PRIVACY.md that og-worker keeps aggregate, non-identifying crawler-hit counts.

## Positive controls (verified this audit — do not re-file unless regressed)

- **FINDING-004 real & tested.** `assertImageDimensionsFromHeader` (`validators.ts:239`) is called by BOTH
  `processImageForExtraction` (`photon.ts:189`) and `processImageForThumbnail` (`photon.ts:296`) **before**
  `PhotonImage.new_from_byteslice`. Header parsers (`dimensions.ts`) read container headers only, return
  `undefined` (→ reject, fail-closed) on unknown/truncated input. `maxDimension` validated at the route
  (`index.ts:72`, 400) *and* in `photon.ts:26` (`assertValidMaxDimension`). Byte caps stream via
  `readBodyWithCap` (`validators.ts:260`) on the `/extract` fetch (Content-Length pre-check + stream) and on
  `/thumbnail` (`index.ts:114-127`). Guarded by `photon-gate.test.ts`, `dimensions.test.ts`,
  `index-limits.test.ts`, `validators-cap.test.ts` (crafted 20000² PNG, 4096×4097 pixel bomb, unreadable
  header, missing/lying Content-Length). Gate is **not** header-forgeable to *pass*: a forged small dimension
  that mismatches the real image only makes photon decode a self-consistent smaller image or throw (caught);
  it cannot exceed the real pixel count. Not bypassable by chunked responses (streamed cap) or omitted headers
  (fail-closed).
- **FINDING-005 real & tested.** `/og/*` segment/path length guard (`index.ts:152`, ≤64/≤512 → 400 before any
  card). `wrapName`/`fit` linear via `prefixThatFits` accumulator + `MAX_NAME_CHARS=512` clip (`band.ts:249-337`).
  `notFoundBand` clips echoed input to `NOT_FOUND_LABEL_MAX=32` (`band-shared.ts:53,65-73`). `caches.default`
  keyed per URL, GET 200 only, errors uncached. Guarded by `og-guards.test.ts` (16 KB `:color` → 400 <2 s, no
  render) and `band-shared.test.ts` (16 KB + CJK labels linear).
- **FINDING-024 intact.** `og-params.ts` validates every echoed share param against one vocabulary shared with
  the image routes; `Object.hasOwn` in translator fallbacks (`translator.ts:61-81`) kills `?race=constructor` /
  `?harmony=constructor`; validated values `encodeURIComponent`'d into `og:url`/`og:image` (og-data-generator.ts).
  Crawler HTML carries CSP + `X-Content-Type-Options` + `Referrer-Policy` + `X-Frame-Options` + `Vary: User-Agent`
  (`index.ts:93-111`); `/og/*` responses carry `nosniff` (incl. cache hits). Catch-all = 404 `no-store` for
  crawlers. Human pass-through `fetch()` only on `isAppHost`, else 302 (`index.ts:298,823`) — verified by
  `index.test.ts:669` (workers.dev / og host / localhost all 302, fetch never called). `logUserAgent:false`;
  analytics only for crawler hits (`index.test.ts:701`).
- **FINDING-028 intact.** `escapeXml` (`packages/svg/src/base.ts:29`) strips XML-illegal C0/C1/`FFFE/FFFF`/lone
  surrogates then escapes `& < > " '`; `bandText`/`default-card` escape text nodes and `fill` attrs; cards
  raster to PNG (no `image/svg+xml` served). After FINDING-024 the only user-shaped SVG text is the clipped,
  escaped not-found label.
- **Redirect fix (6f257062) safe.** image-worker's 2nd redirect hop is now `redirect:'manual'` (workerd has no
  `error` mode); a 2nd 3xx returns as a non-`ok` response and is rejected by the existing `!response.ok`
  (`validators.ts:429-443`) — the one-hop-max property holds. Guarded by validators.test redirect cases.
- **SSRF (image-worker).** Exact-match host allowlist `cdn.discordapp.com` / `media.discordapp.net`, `https:`
  only, IP-literal / metadata / private-range blocklist as depth, one validated redirect hop, 10 s AbortController
  (`validators.ts:93-172,396-479`).
- **No PII in logs.** image-worker logs pathname only (never `body.url` / attachment URL). og-worker's crawler
  log (`index.ts:322`) records the *crawler's* UA + the *public* share URL, only on crawler hits — no user data.
- **No secrets** in either worker (og: two public vars + ANALYTICS; image: inert ENVIRONMENT only) — nothing to rotate.

## Rejected

- **OG-1 (2026-08-21) swatch cubic DoS** — FIXED (length guard + linear wrap + clipLabel); route still renders a
  not-found card for non-hex `:color` but that path is now cheap. Not re-filed.
- **IMG-1 (2026-08-21) decompression bomb** — FIXED (header gate wired + tested). Not re-filed.
- **OG-6 unencoded og:url values** — resolved: `encodeURIComponent` + validated params.
- **OG-7 raw UA / analytics-before-crawler-check** — resolved (`logUserAgent:false`, analytics after short-circuit). Residual disclosure gap → OG-02.
- **OG-8 400 bodies echo param** — resolved: bodies now name the field/bounds, not the value.
- **OG-9 catch-all 200** — resolved: 404 `no-store`.
- **IMG-4 photon panic state** — unchanged INFO; header gate removes the common decompression trigger; degenerate
  1×1 crop can still panic but is caught → 400 (no OOM). Photon now 0.4.0 (embeds `image-0.24.9`/`png-0.17.16`/
  `jpeg-decoder-0.3.2`/`gif-0.13.3`); no wider exposure. Not promoted.
- **IMG-5 `normalizedUrl` keeps userinfo/fragment** — unchanged INFO; harmless behind the exact-host allowlist
  (userinfo cannot change the parsed hostname). Not promoted.
- **`/og/*` cross-host cache poisoning** — cache key includes hostname and card output is host-independent (generators take no env host); og/og-beta isolated. No issue.
- **SQL/KV/R2 injection, D1** — N/A: neither worker has storage bindings.

## Files covered

**og-worker (all non-test src read in full):** `src/index.ts`, `src/types.ts`, `src/crawler-detector.ts`,
`src/og-params.ts`, `src/og-data-generator.ts`, `src/services/{renderer,fonts,og-embed,og-strings,translator}.ts`,
`src/services/svg/{index,band,band-shared,default-card,dye-helpers,tokens,harmony,gradient,mixer,swatch,comparison,accessibility,extractor,presets,budget}.ts`,
`wrangler.toml`, `package.json`, `CHANGELOG.md`. Tests read to confirm guards: `tests/wrangler-env.test.ts`,
`src/og-guards.test.ts`, `src/services/svg/band-shared.test.ts`, and test-name sweep of `src/index.test.ts` /
`src/og-data-generator.test.ts`.

**image-worker (all src read in full):** `src/index.ts`, `src/validators.ts`, `src/dimensions.ts`, `src/photon.ts`,
`src/types.ts`, `wrangler.toml`, `package.json`, `CHANGELOG.md`. Tests read to confirm guards:
`src/photon-gate.test.ts`, `src/dimensions.test.ts`, `src/index-limits.test.ts`, `src/validators-cap.test.ts`;
test-name sweep of `src/index.test.ts`, `src/validators.test.ts`, `src/photon.test.ts`.

**Traced:** `packages/svg/src/base.ts` (`escapeXml`, `estimateTextWidth`), `packages/worker-kit/src/middleware/{logger,request-id}.ts`,
`packages/core` `extractLocaleCode`/`SUPPORTED_LOCALES`; callers `apps/discord-worker/src/services/image-client.ts` +
`handlers/commands/extractor.ts` (image path) + `services/image-input-errors.ts`, `apps/presets-api/src/services/preview-image-service.ts` +
`handlers/presets.ts` (upload gate) + `middleware/body-validation.ts`; service bindings in both callers' `wrangler.toml`.
**Delta commits:** 62898ed6, f7a0c58e, 3ff697c1, 689a0679, 6f257062 (diffs read). **Deps:** hono 4.13.4, `@resvg/resvg-wasm` 2.6.2,
`@cf-wasm/photon` 0.4.0 (wasm crate versions inspected). **Docs:** `apps/web-app/PRIVACY.md`, `docs/operations/POST_MERGE_CHECKLIST.md`,
`docs/audits/2026-08-21-security/{findings/FINDING-004,FINDING-005,SECURITY_AUDIT_REPORT}.md`,
`evidence/{pii-sinks,pii-sources}.txt`.
