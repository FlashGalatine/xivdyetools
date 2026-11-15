# review-pii-web — personal-data row, web side (2026-10-26, HEAD 13c386e5)

Scope: apps/web-app (storage inventory, telemetry client, logs, outbound bodies), apps/api-worker
(telemetry schema + route, rate-limit keys, /v1/chara caches + logs, Universalis proxy logs),
apps/og-worker (AE counter, logs), apps/oauth (D1 users, XIVAuth/Discord callback logs),
apps/image-worker (logs). Governing promise: apps/web-app/PRIVACY.md (read in full),
apps/web-app/TERMS_OF_SERVICE.md (data lines), docs/superpowers/specs/2026-08-29-web-analytics-design.md.

## Sink table (field-by-field vs. promise)

| Sink | Fields written | Promise | Verdict |
|---|---|---|---|
| AE `writeDataPoint` api-worker telemetry/router.ts:45 | index1 event; blob1 event, blob2 tool (enum), blob3 entry/via/ok/to (enum), blob4 stainID (dye DB) / producer (enum), blob5 locale (SUPPORTED_LOCALES), blob6 theme (enum), blob7 vp (enum), blob8 ver (regex, see pii-web-02), blob9 env (from Origin); double1 dwell 0..1800 (schema.ts:96-197) | PRIVACY.md:191-211, spec §4 | OK except ver regex (INFO) |
| AE og-worker index.ts:548 | event (2-value enum), tool, crawler (CrawlerType enum, types.ts:174), timestamp | prior rejection OG-02 | OK |
| KV `RATE_LIMIT` (fallback) | `<prefix>:ip:<ip>` TTL = window 60 s + 60 s buffer (worker-kit kv.ts:64,218,240) | PRIVACY.md:224-229 "120 seconds" | OK |
| Cache API chara rows / icons | keys = prefix + model lookup key / iconId (cache.ts:44-51, icon-cache.ts:62) | no personal data | OK |
| Cache API Universalis | fixed synthetic origin + dc/itemIds (cache-service.ts:186) | — | OK |
| D1 oauth `users` | id, discord_id, xivauth_id, auth_provider, username (schema/users.sql) | PRIVACY.md:82-92 | OK |
| Outbound XIVAPI / Universalis | fixed Accept + UA headers only (xivapi.ts:378-388, cached-fetch.ts:134-139) | PRIVACY.md:41-46, 77-80 | OK |
| Outbound /v1/chara/resolve (web) | `{gear:[{slot,set?,base,variant}], glasses?}` rebuilt by protocol readGearModels (chara-inspection-protocol.ts:566-582; chara-resolve-service.ts:182-193) | PRIVACY.md:41-43 | OK |
| Request logs (worker-kit logger.ts:145-162) | method, pathname (no query), status, duration; UA off by default and in every consumer | PRIVACY.md:232-237 | OK |
| localStorage | prefs, collections (incl. nickname/file-name fallback names, local only), acquisition edits, auth token/expiry/provider | PRIVACY.md:50-65 | OK; delete-control text wrong (pii-web-01) |
| IndexedDB | only `price_cache` written (api-service-wrapper.ts:128); palettes/settings stores created, never written | PRIVACY.md:67-70 | OK |
| Browser console | extractor logs image file name (extractor-tool.ts:1322) | local only | INFO (pii-web-03) |

## Route / authz matrix (in-scope routes touching personal data)

| Route | Exposure | Auth | Personal data |
|---|---|---|---|
| POST data.xivdyetools.app/v1/telemetry | INTERNET-UNAUTH | none; Origin allowlist + Sec-GPC drop before body (router.ts:57-73); own fail-closed limiter | none stored beyond enum blobs |
| POST /v1/chara/resolve | INTERNET-UNAUTH | none; 8 KiB cap, uint16 lanes | none |
| GET /v1/chara/icon/:id | INTERNET-UNAUTH | none; canonical id regex | none |
| GET /universalis/*, /api/v2/* | INTERNET-UNAUTH | none | chosen DC/world logged in tail-only warn/error lines (router.ts:297-333) |
| GET/POST auth.xivdyetools.app/auth/* | INTERNET-UNAUTH -> JWT | PKCE + signed state | users row; logs carry status/counts only |
| og-worker crawler + /og/* | INTERNET-UNAUTH | none | enum AE blobs; log = tool, locale, crawler type |
| image-worker /extract, /thumbnail | INTERNAL | service binding only | image bytes never logged |

## Positive controls

- Telemetry client: default off (tool-config-types.ts:417), `isEnabled()` = toggle AND not GPC on both track and flush (telemetry-service.ts:117-123,186-192), toggle-off drops queue (:107), no id, no storage, coarse 3-bucket viewport (:241-246), producer normalized to enum (:177-184).
- Telemetry server: GPC dropped before logger/body (router.ts:57-59), Origin gate before body and Origin never logged (:65-73), Map-based event allowlist, stainID validated against dye DB (schema.ts:85-88,96-123), env derived from Origin.
- chara_parse tracked with `{ok, producer-bucket}` only; loader logs never carry file name/producer text (chara-file-loader.ts:93,109-130); Nickname/file name never pre-filled into community submission (glamour-block.ts:1797-1807).
- Inspection protocol rebuilds gearModels from validated uint16 fields only, so no stray dye/label field can ride the resolve body (chara-inspection-protocol.ts:566-582).
- Session cache for resolve is an in-memory Map (chara-resolve-service.ts:134); CharaSessionService memory-only.
- External item/dye links open with `noopener,noreferrer` and carry only item ids/names (item-links-menu.ts:131, result-card.ts:180-183,1491).
- api-worker/og-worker/oauth/image-worker: no UA logging (og-worker index.ts:159-163 explicit false; worker-kit default false); outbound third-party fetches send fixed headers, never client headers.
- oauth: XIVAuth roster read in memory and discarded; logs carry counts/booleans/status only (xivauth.ts:190-385); dev-only upstream error bodies; account-link logs carry provider only (user-service.ts:192-239).
- og-worker crawler log limited to tool, locale, crawler enum (index.ts:697-701).

## Candidates

- pii-web-01 LOW — PRIVACY.md:59-62 says no control deletes a single saved palette and Swatch character colors have no delete control, but the Collection Manager (reachable from the favorites panel of every DyeSelector with `showFavorites: true`: harmony, comparison, mixer, accessibility) lists every collection from `getCollections()` with no kind filter and offers a per-row delete (collection-manager-modal.ts:21-22,178-199; collection-service.ts:582-585). Policy: CORRECT apps/web-app/PRIVACY.md "What is stored on your device" (x6 locales). Not exercised in a browser.
- pii-web-02 INFO — telemetry `ver` (blob8) is regex- not enum-validated: `/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/` sliced to 16 chars (schema.ts:61-62,129-133), so a scripted sender spoofing an accepted Origin can write ~10 free alphanumeric chars per batch; the real client only sends `APP_VERSION` (constants.ts:39). Spec §4 says `/^\d+\.\d+\.\d+/` clamped. Fix code (drop the prerelease suffix or allowlist); policy NONE.
- pii-web-03 INFO — extractor prints the uploaded image's file name to the browser console on decode failure (extractor-tool.ts:1322); production logger level is warn (logger presets/browser.ts:92) and no errorTracker is passed, so it never leaves the device, but it is the pattern FINDING-001 removed from the .chara loader. Fix code; policy NONE.

## Rejected

- Universalis proxy logs DC/world name — operational tail-only lines, Workers Logs off; PRIVACY.md:232-237 covers diagnostic lines; world choice is disclosed as sent.
- Request logger path includes /universalis/aggregated/<world>/<ids> — same reasoning; pathname only, no query.
- web-app error-handler `window.Sentry` hook (error-handler.ts:90-102) — no Sentry dependency/script; CSP `script-src 'self'` blocks third-party loaders; unreachable.
- og_image_request AE events — enum blobs, `crawler: 'none'`; covered by prior rejection OG-02.
- IndexedDB `palettes`/`settings` stores vs "holds one thing" — created but never written; only price_cache is set.
- Local-palette Share copies `/presets/local-<uuid>` (preset-detail.ts:761-767) — a local record UUID, user-initiated, no name; a dead link bug at most, not personal data.
- JWT (with discord_id) in localStorage — disclosed as the session token; prior audits.
- sessionStorage pendingPresetId / OAuth flow state — prior rejection.
- oauth `Blocked redirect` / unsigned-state warns — log attacker-supplied URI / provider+iat, not personal.

## Files covered

~40 files read: apps/api-worker/src/{telemetry,chara,universalis,middleware,index.ts}; apps/web-app/src/services/{telemetry-service,chara-resolve-service,chara-file-loader,chara-inspection-protocol,auth-service,indexeddb-service,collection-service}.ts, apps/web-app/src/components/{glamour-block,collection-manager-modal,dye-selector,extractor-tool,v4/preset-tool,v4/preset-detail,item-links-menu,v4/result-card}.ts, apps/web-app/src/shared/{logger,constants,tool-config-types}.ts, apps/web-app/PRIVACY.md, TERMS_OF_SERVICE.md; apps/og-worker/src/{index,types}.ts; apps/oauth/src/{handlers/xivauth,handlers/callback,handlers/oauth-flow,services/user-service,utils/state-signing,index}.ts, apps/oauth/schema/users.sql; packages/worker-kit/src/middleware/logger.ts, rate-limiter/backends/kv.ts; packages/logger/src/presets/browser.ts; image-worker via grep of log sites (none beyond middleware).
