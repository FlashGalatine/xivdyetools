# Review: trust-boundaries (cross-cutting) — 2026-10-03

Commit 0ab33466. Read-only review by vulnerability class: service-binding trust, outbound/SSRF, cache/CDN, error handling, scheduled/DO. No probe scripts were needed (no files under `evidence/scripts/trust-boundaries/`). No test was run.

## 1. Entry points and authz matrix

### 1a. Service bindings (every `[[services]]`, both envs; top-level = beta/dev worker, `[env.production]` = prod)

All six edges are identical in the top-level and production blocks and point at the **production** callee names (`xivdyetools-presets-api`, `-api-worker`, `-image-worker`, `-discord-worker`), including the beta discord-worker (wrangler.toml of discord-worker:29-39 vs 139-149; this is the documented "shared" beta design, docs/operations/DEPLOY_ENVIRONMENTS.md:19-21 and :255 "accepted residual risk").

| Caller binding | Callee path used | Same handler reachable from the internet? | What authenticates the caller | Verdict |
|---|---|---|---|---|
| discord-worker `PRESETS_API` (wrangler.toml:29-31, :139-141) and moderation-worker `PRESETS_API` (wrangler.toml:28-30, :84-86) | `/api/v1/*` (preset-api.ts discord:141-148, moderation:137) | YES. `api.xivdyetools.app` / `api.xivdyetools.projectgalatine.com` custom domains (presets-api wrangler.toml, `[env.production]`) serve the same Hono app. | `Authorization: Bearer BOT_API_SECRET` (constant-time, auth.ts:141,269) AND v2 HMAC over method+path+body-hash+timestamp+nonce+identity (auth.ts:311-325; hmac.ts:280-296) AND single-use nonce in KV (auth.ts:207-243, :338). Missing `BOT_SIGNING_SECRET` in production leaves the caller unauthenticated (auth.ts:285-292). Not INTERNAL: reachable by anyone, authenticated by secret. | OK. Query string not covered by the signature (rejected, FINDING-015). |
| discord-worker `UNIVERSALIS_PROXY` (wrangler.toml:33-35, :143-145) | `GET /api/v2/aggregated/...` (universalis-client.ts:126, :222) and `POST /v1/chara/resolve` (glamour.ts:65) | YES. `data.xivdyetools.app`, `proxy.xivdyetools.app`, `proxy.xivdyetools.projectgalatine.com` serve the same app (api-worker wrangler.toml `[env.production]` routes). | Nothing. Both are public, anonymous read endpoints by design. Binding callers are told apart only by the absence of `CF-Connecting-IP` for rate-limit bucketing (rate-limit.ts:73-75; universalis/router.ts:127-142). | OK. Cloudflare sets the header on every external request; it is a rate-limit selector, not an authorization decision. |
| discord-worker `IMAGE_WORKER` (wrangler.toml:37-39, :147-149) | `POST /extract` (image-client.ts:53) | NO. image-worker: `workers_dev=false`, `preview_urls=false`, no `routes` in either env (image-worker wrangler.toml, pinned by src/wrangler-config.test.ts); handler also 404s any `*.workers.dev` host (image-worker index.ts:112-119). | None, by design (no auth, no rate limit). | INTERNAL is valid. |
| presets-api `IMAGE_WORKER` (wrangler.toml:35-37, :84-86) | `POST /thumbnail` (preview-image-service.ts:143) | NO (same as above). | None. | INTERNAL is valid. |
| presets-api `DISCORD_WORKER` (wrangler.toml:27-29, :76-78) | `POST /webhooks/preset-submission` (notification-service.ts:184) | YES. `bot.xivdyetools.app` / `bot.xivdyetools.projectgalatine.com` (discord-worker `[env.production]` routes) and, for the beta worker, `*.workers.dev` (`workers_dev = true`, top-level). | `Authorization: Bearer INTERNAL_WEBHOOK_SECRET`, constant-time compare (discord-worker index.ts:257-282). Missing secret returns 401 (fail closed). 10 KB streamed cap before parse (index.ts:282). Binding-only is NOT enforced (c1). | OK, hardening only. |

Preview URLs: presets-api, oauth, moderation-worker, og-worker and discord-worker (production) do not pin `preview_urls`. Wrangler 4.140 passes `previews_enabled: undefined` when unset and the platform default follows `workers_dev` (wrangler-dist/cli.js:159906-159915, :160021 message text), so those stay off where `workers_dev` is false. Unverifiable without Cloudflare; recorded as rejected.

### 1b. HTTP entry points by worker (middleware order = registration order)

| Worker | Route | Callable by | Middleware before handler | Body / param caps |
|---|---|---|---|---|
| presets-api | `GET /`, `/health` | anyone | requestId, logger, env validation (500 in prod if misconfigured), security headers, CORS (index.ts:48-102) | none; `/` echoes ENVIRONMENT and version |
| presets-api | `/api/v1/presets` GET list/featured, `/:id`, `/categories*` | anyone (non-approved presets only to owner/moderator, handlers/presets.ts:226-250, :866-885) | + IP rate limit 100/min via `RL_PUBLIC` binding, skipped when no `CF-Connecting-IP` (rate-limit.ts:139), bodySizeLimit 100 KB, jsonDepthLimit, authMiddleware, per-user limit | page/limit clamped; sort whitelisted by `switch`; D1 `.bind` throughout (preset-service.ts:237-310) |
| presets-api | `/presets` POST, `/:id` PATCH/DELETE, `/mine`, `/rate-limit`, `/refresh-author`, `/:id/preview-image` POST/DELETE, `/votes/*` | signed-in web user (JWT) or bot (secret + HMAC + nonce) | as above + `requireAuth` + `requireUserContext` + `requireNotBanned` (fail closed 503) | JSON 100 KB; preview image 5 MB streamed (body-validation.ts:75-93) |
| presets-api | `/api/v1/moderation/*` (8 routes) | moderators only (`MODERATOR_IDS`), web JWT or bot | as above + `requireModerator` | JSON 100 KB |
| presets-api | `/__force-error` | nobody in prod (404 when `ENVIRONMENT=production`, index.ts:237-243) | | |
| discord-worker | `POST /` | Discord (Ed25519, 300 s freshness, streamed 100 KB cap — packages/auth/src/discord.ts:70-140) | CORS, requestId, logger, env validation (500), security headers; then per-user `[[ratelimits]]` tier | 100 KB |
| discord-worker | `POST /webhooks/preset-submission` | presets-api (via binding) or anyone holding `INTERNAL_WEBHOOK_SECRET` | same global chain; bearer compare | 10 KB streamed (index.ts:282) |
| discord-worker | `POST /webhooks/github` | GitHub (HMAC-SHA256 over exact bytes; pinned repo, pinned branch, once-per-version memo) | same global chain | 1 MiB streamed (index.ts:521-545) |
| discord-worker | `GET /health` | anyone | | |
| moderation-worker | `POST /` | Discord (same verifier); every command/button/modal/autocomplete re-checks `isModerator` (handlers/commands/preset.ts:403,517,627; buttons/preset-moderation.ts:89,226,278; ban-confirmation.ts:66,136; modals/*; index.ts:364) | requestId, logger, headers (`no-store`, CSP `default-src 'none'`), env gate | 100 KB verifier cap |
| oauth | `GET /auth/discord`, `/auth/xivauth`, `GET+POST /auth/callback`, `/auth/xivauth/callback` | anyone | CORS allowlist, headers (`no-store`), env gate, per-IP native limiter tiers (index.ts:182-232), body guards after limiter (10 KB) | exact redirect-URI allowlist + fixed path (constants/oauth.ts:12-44); redirect URIs built from `FRONTEND_URL`/`WORKER_URL`, never the Host header |
| oauth | `GET /auth/me`, `POST /auth/revoke` | bearer JWT holders | same | |
| api-worker | `*` on host `developers.xivdyetools.app` | anyone (static docs via ASSETS) | host branch BEFORE all API middleware, security headers re-applied (index.ts:43-60) | |
| api-worker | `GET /v1/dyes|match|wheels|harmony`, `/v1/chara/icon/:id`, `POST /v1/chara/resolve`, `POST /v1/telemetry` | anyone (CORS `*`, no credentials) | requestId, logger, headers, CORS, `/v1/*` native limiter 65/min per IP (service bucket 1300/min when no client IP), telemetry bucket fail-closed | resolve 8 KB streamed; icon 1 MB streamed, PNG signature checked |
| api-worker | `GET /universalis/*`, `/api/v2/*` (data-centers, worlds, aggregated) | anyone | requestId, logger, headers, CORS, version header; NO `/v1` limiter | datacenter whitelist/live list, ids `^[\d,]+$`, 1..100 ids each 1..1,000,000; per-isolate memory limiter (accepted trade-off, see Rejected) |
| image-worker | `GET /health`, `POST /extract`, `POST /thumbnail` | bound workers only | requestId, logger, `*.workers.dev` host refusal | extract: Discord CDN host allowlist, 10 s, 10 MB streamed, redirect `manual` + revalidate; thumbnail: 10 MB streamed |
| og-worker | zone routes `xivdyetools.app/<tool>/*`, `og.xivdyetools.app/og/*` | anyone | per-unit reviewer (review-og-worker.md); only fetch is the bounded SPA pass-through (index.ts:530-540) | n/a here |
| web-app (Pages) | `functions/_middleware.ts` | anyone | host redirect (fixed target), refuses an HTML body under `/assets/*` | |

### 1c. Outbound fetch inventory (every line of evidence/outbound-fetch.txt)

Legend: host = fixed constant / operator var / allowlisted; redir = redirect handling (default `follow` unless stated); cap = byte cap before parse; enc = user input encoded. "binding" calls are Worker-to-Worker, no DNS, redirects n/a.

| path:line | host | redir | timeout | cap | enc / input | note |
|---|---|---|---|---|---|---|
| api-worker docs/.vitepress/theme/lib/live.ts:112,154 | browser to `API_BASE` constant (live.ts:10) | follow | none | none | `buildUrl` (live.ts:201) | visitor's browser, not SSRF |
| api-worker scripts/build-acquisition.ts:69 | fixed XIVAPI / GitHub raw / Teamcraft constants | follow | none (3 retries) | none | URLSearchParams | LOCAL maintainer script |
| api-worker src/chara/xivapi.ts:234 | `XIVAPI_BASE` var (default `v2.xivapi.com`) | `manual`, 3xx refused | 10 s | icon 1 MB streamed (router.ts:317); search/glasses `.json()` uncapped (:280,:294) | validated integers, URLSearchParams | var is not request data |
| api-worker src/index.ts:48 | `ASSETS` binding | n/a | n/a | n/a | n/a | static assets, not a network fetch |
| api-worker universalis/services/cached-fetch.ts:134 | `UNIVERSALIS_API_BASE` var | `manual` | 10 s | 5 MB streamed (:141-170) | dc whitelist/live list, ids `^[\d,]+$` normalised | |
| discord-worker scripts/register-commands.ts:82 | `discord.com/api/v10` constant | follow | none | none | ids from env | LOCAL script, token from env |
| discord-worker scripts/upload-emojis.ts:140,147,172 | `discord.com` constant | follow | none | none | ids from API | LOCAL script |
| discord-worker src/handlers/commands/glamour.ts:65,67 | `UNIVERSALIS_PROXY` binding; `UNIVERSALIS_PROXY_URL` var only if no binding (unset in wrangler.toml) | n/a / follow | 12 s | `.json()` uncapped on api-worker's own answer | fixed path, JSON body of integers | |
| discord-worker src/index.ts:623 | `raw.githubusercontent.com/FlashGalatine/xivdyetools` constant | follow | 10 s | `.text()` uncapped (own repository) | constant | |
| discord-worker services/budget/universalis-client.ts:126,143 | binding / var | n/a / follow | 10 s | `.json()` uncapped on api-worker answer | `encodeURIComponent(world)` after `validateWorld` (:222) | |
| discord-worker services/image-client.ts:53 | `IMAGE_WORKER` binding | n/a | 10 s | `arrayBuffer()` uncapped, bounded by image-worker output | URL from signed interaction; image-worker re-validates host | |
| discord-worker services/preset-api.ts:141,152 | `PRESETS_API` binding / `PRESETS_API_URL` var | n/a / follow | 10 s | `.json()` uncapped on presets-api answer | `encodeURIComponent` on every id, URLSearchParams for filters | |
| discord-worker utils/chara-attachment.ts:87 | Discord CDN allowlist (2 hosts, https) | `manual` | 10 s | 1 MiB streamed | URL from signed payload, host-checked (:42-48) | |
| discord-worker utils/discord-api.ts:90,149,178,235,364,398 | `discord.com/api/v10` constant | follow | 5-10 s | responses not bulk-read | interaction token / ids from the signed payload; channel ids from env | |
| image-worker validators.ts:423,449 | exact set `cdn.discordapp.com`, `media.discordapp.net`, https, no IP literals (:25-27, :160-215) | `manual`, one revalidated hop | 10 s | 10 MB streamed | URL validated by `new URL` + set membership | strongest control in repo |
| image-worker validators.ts:153, photon.ts:166 | | | | | | doc-comment lines, not calls |
| moderation-worker scripts/register-commands.ts:155 | `discord.com` constant | follow | none | none | env ids | LOCAL script |
| moderation-worker services/preset-api.ts:125 | | | | | | comment, not a call |
| moderation-worker services/preset-api.ts:137,145 | binding / `PRESETS_API_URL` var | n/a / follow | 10 s | `.json()` uncapped on presets-api answer | `pathSegment()` (:309) | |
| moderation-worker utils/discord-api.ts:48,134,170 | `discord.com/api/v10` constant | follow | 5 s | none | ids from signed payload; log lines pass `sanitizeUrl` | |
| moderation-worker utils/url-sanitizer.ts:115 | | | | | | doc-comment line, not a call |
| oauth handlers/callback.ts:136,186 | `discord.com/api` constants | follow | 10 s / 5 s | `.json()` uncapped (Discord) | code/verifier in form body | |
| oauth handlers/xivauth.ts:164,225,276 | `xivauth.net` constants (:34-37) | follow | 10 s / 5 s | `.json()` uncapped (XIVAuth) | form body / bearer | |
| og-worker index.ts:489,503,570,1278,1284 | | | | | | comments, not calls |
| og-worker index.ts:534 | the request's own URL, only when host == `APP_BASE_URL` host (:496-512, :1278-1297) | follow | 5 s | streamed through to the client | none needed | SPA pass-through |
| presets-api services/moderation-service.ts:255 | `PERSPECTIVE_ENDPOINT` constant | follow | 5 s | `.json()` uncapped (Google) | user text in JSON body only | key in header, `doNotStore` |
| presets-api services/notification-service.ts:184 | `DISCORD_WORKER` binding | n/a | none (see handoffs) | `response.text()` only on 4xx | fixed path | |
| presets-api services/preview-image-service.ts:81 | `api.cloudflare.com` constant | follow | 5 s | body unread | `encodeURIComponent(zoneId)` | |
| presets-api services/preview-image-service.ts:143 | `IMAGE_WORKER` binding | n/a | 10 s | `arrayBuffer()` uncapped, internal | none | |
| web-app config-sidebar.ts:722,723; world-service.ts:51,52 | same-origin `/json/*` | follow | none | none | constants | browser |
| web-app auth-service.ts:407,524,756; preset-submission-service.ts:235,263,313,392,441,480,592; community-preset-service.ts:249; chara-resolve-service.ts:135; telemetry-service.ts:233 | `OAUTH_WORKER_URL`, `PRESETS_API_URL`, `getApiWorkerBase()` build-time first-party origins | follow | 10-12 s on most; telemetry `keepalive` | none | `encodeURIComponent(presetId)` where an id is interpolated | browser; first-party hosts allowed by the CSP `connect-src` |
| packages/core APIService.ts:40,47,691,1031 | injected `fetchClient`; fixed base URL | follow | `AbortController` | length checked after `text()` buffering (:709-718) | URL builder | published library, see handoffs |
| packages/core utils/index.ts:342,373; logger index.ts:25; logger presets/worker.ts:47; test-utils auth/headers.ts:13, auth/jwt.ts:20; worker-kit rate-limiter/index.ts:17 | | | | | | doc-comment examples, not calls |

No `scheduled()`, `queue()`, `[triggers]`/crons, Durable Objects or `[[queues]]` exist in any worker (`git grep` of apps/*/src and wrangler.toml for scheduled, queue, DurableObject, durable_objects, crons, queues: no hits). Nothing to trigger externally.

## 2. Positive controls

- Public-route secrets compared in constant time and fail closed when unset: discord-worker index.ts:262-282 (webhook), index.ts:504-508 (GitHub), presets-api auth.ts:141-155.
- Bot-to-API auth is layered: shared secret, v2 HMAC (method, path, body hash, timestamp, nonce, identity), 60 s window, single-use nonce written only after the signature verifies (auth.ts:207-243, :338); v1 fallback is gone (auth.ts:296-306).
- Per-user rate-limit key is the authenticated identity, never a caller header (rate-limit.ts:92-99, :131-157).
- image-worker has no public surface in any env and refuses `*.workers.dev` hosts (image-worker index.ts:112-119); the callee does SSRF defence in depth: https only, exact host set, IP-literal block, `redirect: 'manual'` with a one-hop revalidated follow, 10 s abort, 10 MB streamed read (validators.ts:25-27, :160-215, :423-475).
- `.chara` attachment download: same host allowlist, `redirect: 'manual'`, 10 s timeout, 1 MiB capped read (chara-attachment.ts:23-33, :86-108).
- Every outbound target is a constant or an operator var, never request data: Discord REST (`discord.com/api/v10`), `discord.com/api/oauth2/token`, `xivauth.net/*` (xivauth.ts:34-37), Perspective endpoint, `api.cloudflare.com/.../purge_cache` with `encodeURIComponent(zoneId)` (preview-image-service.ts:81-95), `raw.githubusercontent.com/FlashGalatine/xivdyetools/...` pinned repo (discord-worker index.ts:622-623), `UNIVERSALIS_API_BASE`/`XIVAPI_BASE` vars. All carry `AbortSignal.timeout` (5-12 s) or an abort controller; Universalis and XIVAPI use `redirect: 'manual'`; Universalis bodies are byte-budgeted at 5 MB (cached-fetch.ts:98-118, :141-170) and the XIVAPI icon body at 1 MB (chara/router.ts:317), while XIVAPI `searchItems`/`getGlasses` call `response.json()` with no budget (xivapi.ts:280, :294; see per-line table and handoffs).
- User input reaching a path is encoded or validated: preset ids `encodeURIComponent` (discord preset-api.ts:239,346,367,380,398,461; moderation `pathSegment`), world `encodeURIComponent` after `validateWorld` (universalis-client.ts:222), Universalis dc/ids whitelisted and normalised (router.ts:164-215), chara icon id canonical-decimal regex (chara/router.ts:273).
- Cache keys: Universalis/chara use a fixed synthetic origin and `encodeURIComponent(key)` with canonicalised ids, locale only from `?locale=` (cache-service.ts:98-108; locale.ts:13-17); og images use an allow-listed query key set (og-worker index.ts:216,386-400); icon cache key rebuilt from the parsed integer (chara/router.ts:272-280). No KV or Cache API key is built from free text.
- Error handlers: no stack or env value in any production response (presets-api index.ts:271-291 dev-only; api-worker index.ts:206-252 never; oauth index.ts:304-326 dev-only message; discord-worker index.ts:1381-1389 generic; moderation index.ts:671-686 dev-only; og-worker index.ts:1299-1311 generic; image-worker falls to Hono's plain 500). Every unrouted dev worker is `workers_dev=false`, so the dev branches are local-only. Upstream status text is logged, not echoed (universalis/router.ts:303-305).
- Cache-Control: oauth `no-store` on every response (index.ts:127); moderation-worker `no-store` (index.ts:73); api-worker adds `no-store` on every non-2xx (index.ts:90-92) and on the chara POST (chara/router.ts:259); crawler HTML carries `Vary: User-Agent` plus CSP (og-worker index.ts:118-137).
- CORS exact-match allowlists with `Vary: Origin` (Hono): presets-api index.ts:95-146 (dev loopback gated on `ENVIRONMENT`), oauth index.ts:52-100 (same allowlist as redirects, dev-gated loopback), discord-worker pinned to two origins (index.ts:169-176). api-worker is `*` without credentials by design.
- Secrets: none in `[vars]` (reviewed all wrangler.toml; only client ids, public URLs, zone id); `.dev.vars*` gitignored and none tracked (`git ls-files` shows only `apps/stoat-worker/.env.example`).
- Module-scope state is isolate-local cache or rate-limit state keyed by IP, never user data; the request coalescer shares only public Universalis payloads via a deferred promise (request-coalescer.ts:103-130).
- Body guards: `bodyGuards()` uses Hono `bodyLimit` (stream-counted when no Content-Length) (worker-kit body-guards.ts:35-47); chara resolve, webhook, GitHub and verifier paths use their own streamed caps.
- `waitUntil` carries side effects: first-run notice (discord index.ts:889), Discord notifications and dead-letter prune (presets.ts:824,1036,1056,1248), cache stores (cache-service.ts:179-183).

## 3. Rejected items

- "Service-binding callers bypass the presets-api IP limiter (skip when no CF-Connecting-IP)": Cloudflare sets that header on every external request including Worker subrequests, so the skip is unreachable from the internet; callers are then limited per authenticated user (rate-limit.ts:121-157). Documented design (BUG-044 follow-up).
- "Universalis/api-worker treat `CF-Connecting-IP` absence as trusted service": same reasoning; it only picks a bucket, no privilege attaches (rate-limit.ts:73-75).
- "Unpinned `preview_urls` on presets-api/oauth/moderation/og/discord prod exposes `*-worker.<acct>.workers.dev`": platform default follows `workers_dev=false` (wrangler cli.js:159906-159915, :160021). Not verifiable without Cloudflare; no code path to confirm.
- "Beta discord-worker (`workers_dev=true`, `ENVIRONMENT=development`) bound to production presets-api/api-worker/image-worker": documented accepted residual risk (DEPLOY_ENVIRONMENTS.md:255-256); dev-only branches in this worker are limited to env validation and /stats text, no auth bypass (`git grep ENVIRONMENT` in discord-worker/moderation-worker src).
- "presets-api CORS lists `https://xiv-colorexplorer.pages.dev` (a claimable name if the Pages project is deleted)": auth is a Bearer token held in the page's own origin storage, no cookies, so an attacker origin gains nothing from the allowance. Hygiene note only.
- "Dev-mode `err.message`/`stack` in presets-api/oauth/moderation onError": only when `ENVIRONMENT=development`, and the dev workers have no routes and `workers_dev=false`.
- "`discord-worker` `unauthorizedResponse(error)` echoes the verifier's reason to unauthenticated callers": reasons are fixed strings, or the `discord-interactions` library message for a malformed signature; no secret or internal path (packages/auth/src/discord.ts:132-139).
- "KV/Cache API keys built from user input": none found (see Positive controls). KV user keys use signed-interaction snowflakes (`prefs:v1:${userId}`, index.ts:793).
- "Request-ID header injection": requestIdMiddleware UUID-validates (request-id.ts:47-56).
- "Host-header trust": oauth builds all URLs from env; api-worker/og-worker compare the request host only to choose a static-asset or redirect branch with fixed targets.
- "SSRF via og-worker `fetch(request)` pass-through": gated to the app host (`isAppHost`), 5 s timeout, same-origin target (og-worker index.ts:496-540, :1278-1297).
- "D1 template SQL": the only dynamic fragments are a `switch`-whitelisted ORDER BY and `?` placeholders (preset-service.ts:262-306); no `prepare()` takes request text.
- "Docs live explorer fetches arbitrary URL": `API_BASE` is a constant (docs/.vitepress/theme/lib/live.ts:10, :201).
- "scheduled/queue/DO handlers": none exist.
- Universalis proxy throttled by a per-isolate `MemoryRateLimiter` outside the native limiter (code: rate-limiter.ts:39-46, router.ts:156-165, index.ts:183-186): already ruled "accepted trade-off (cache-miss path only)" in docs/audits/2026-08-29-security/SECURITY_AUDIT_REPORT.md (Rejected suspicions) and listed as PKG-11; `git log 0332fcc5..HEAD -- apps/api-worker/src/universalis/` shows only a `cache.delete` rejection catch (3e6d9a46) and a test alias move (6fce09cf), so the verdict still holds. The missing entry in security-trade-offs.md is a doc handoff.
- No `Cache-Control: no-store`/`private` on presets-api authenticated JSON (`/mine`, `/rate-limit`, per-viewer `/:id`, `/moderation/*`): already PAPI-15 / PAPI-11 "unchanged INFO, not re-filed" (docs/audits/2026-08-29-security/evidence/review-presets-api.md:202,239). `git log 0332fcc5..HEAD -- apps/presets-api/src/index.ts` is empty, so nothing changed. The 2026-09-15 positive-control line "User-specific/auth responses use no-store controls" is true of oauth, moderation-worker and api-worker errors, not presets-api; coordinator may want to reword it. Cloudflare does not cache JSON by default, so no live exploit.
- v2 bot signature does not bind the query string (hmac.ts:252,280-290): FINDING-015 (2026-08-29) records "Deliberately not done: query-string signing (v3 / PKG-03) stays INFO" (findings/FINDING-015.md:33). Also needs an in-path position that a service binding does not offer, the nonce is single-use, and the replayer would only read what the signing identity could already read.
- `notFound` handlers in presets-api (index.ts:259-267), oauth (index.ts:293-302) and api-worker (index.ts:192-204) echo `c.req.path`/method into a JSON body: `Content-Type: application/json` with `X-Content-Type-Options: nosniff` (presets-api index.ts:82-93, oauth index.ts:114-135, api-worker index.ts:78-93), so no HTML sink.
- "Shared `TOKEN_BLACKLIST` KV key collision between revocation (`jti`) and `botnonce:`": the nonce key is only written after HMAC verification and is pattern-limited to `[A-Za-z0-9._-]{1,64}` (auth.ts:169-172, :212).

## 4. Files covered (read in full unless noted)

apps/presets-api: src/index.ts, src/middleware/{auth,rate-limit,body-validation}.ts, src/middleware/ban-check.ts (first 80 lines), src/handlers/categories.ts (60-150), src/handlers/presets.ts (215-380, 855-900; route/guard grep for the rest), src/services/{notification-service.ts (120-260), preview-image-service.ts (55-200), moderation-service.ts (225-330), preset-service.ts (195-345)}, src/utils/env-validation.ts (1-140), wrangler.toml.
apps/discord-worker: src/index.ts (85-1000, 1370-1391), src/utils/{discord-api.ts (grep), chara-attachment.ts}, src/services/{preset-api.ts (95-230), image-client.ts, budget/price-cache.ts (25-140), budget/universalis-client.ts (100-175), env-validation.ts (40-140)}, src/handlers/commands/glamour.ts (30-130), scripts/register-commands.ts and upload-emojis.ts (fetch sites), wrangler.toml.
apps/moderation-worker: src/index.ts (1-330, 640-689), src/services/preset-api.ts (95-200), src/utils/discord-api.ts (30-190), wrangler.toml.
apps/oauth: src/index.ts, src/constants/oauth.ts, src/handlers/token.ts (1-140), src/handlers/callback.ts (125-215), src/handlers/xivauth.ts (155-300), wrangler.toml.
apps/api-worker: src/index.ts, src/middleware/{rate-limit,locale}.ts, src/universalis/router.ts, services/{cached-fetch,cache-service (90-200),request-coalescer (1-140),rate-limiter}.ts, src/chara/{router,cache (1-80),xivapi (195-330)}.ts, src/lib/validation.ts (470-495), scripts/build-acquisition.ts (40-110), docs/.vitepress/theme/lib/live.ts (95-170), wrangler.toml.
apps/image-worker: src/index.ts, src/validators.ts (15-60, 160-260, 395-500), wrangler.toml.
apps/og-worker: src/index.ts (100-140, 380-420, 480-640, 1255-1319), wrangler.toml.
apps/web-app: functions/_middleware.ts, public/_headers, public/_redirects (head), src/services/{community-preset-service (225-262), preset-submission-service (225-275, 470-490, 585-600)}.ts.
packages: auth/src/{discord.ts, hmac.ts (240-345)}, worker-kit/src/{rate-limiter/ip.ts (53-79), body-guards/{index,body-guards}.ts, middleware/{request-id,logger}.ts}, core/src/services/APIService.ts (675-720).
Docs/evidence: docs/audits/2026-09-15-security/SECURITY_AUDIT_REPORT.md and docs/audits/2026-08-29-security/SECURITY_AUDIT_REPORT.md (both read in full for Positive controls and Rejected sections), 2026-08-29 findings/FINDING-015.md (query-signing decision), FINDING-024.md and FINDING-025.md (grep), 2026-08-29 evidence/review-presets-api.md (grep for cache headers), 2026-08-29 and 2026-08-21 evidence/review-discord-worker.md (grep for the webhook secret), docs/operations/DEPLOY_ENVIRONMENTS.md (grep), docs/architecture/security-trade-offs.md (headings), evidence/outbound-fetch.txt, evidence/wrangler-surface.txt, evidence/delta-commits.txt (grep), evidence/review-image-worker.md (table). Wrangler's own `getSubdomainValues` in apps/presets-api/node_modules/wrangler/wrangler-dist/cli.js:159906 (tool behaviour only).
Count: 84 files opened (full or in the ranges listed), including the 12 docs/evidence items and wrangler's cli.js for tool behaviour.
Not read (other reviewers own them): handlers/votes.ts, handlers/moderation.ts bodies, discord-worker command handlers, bot-logic, svg, og-worker renderers, stoat-worker.

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | INFO | INTERNET-UNAUTH | apps/discord-worker/src/index.ts:257-282 ; apps/discord-worker/src/utils/env-validation.ts:78-84 ; apps/presets-api/src/utils/env-validation.ts:112-135 | `/webhooks/preset-submission` is a binding-only call that is also served on `bot.xivdyetools.app`, guarded only by a bearer secret with no length floor (`BOT_SIGNING_SECRET` and `JWT_SECRET` have one; `INTERNAL_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`, `BOT_API_SECRET` only need to be non-empty). |

### c1 detail

Trigger: any internet host POSTs `https://bot.xivdyetools.app/webhooks/preset-submission` with `Authorization: Bearer <guess>`. Failed attempts are not rate limited (the route sits outside any limiter) and the check is a plain secret compare. If the production secret were short or leaked, the caller could post forged "pending preset" embeds and image-review embeds with approve/reject buttons into the moderator channel (text is sanitised, ids/keys pattern-checked, index.ts:299-310). That the route is reachable by any HTTP client was already known (2026-08-21 and 2026-08-29 review-discord-worker.md, "reachable by any HTTP client on bot.xivdyetools.app"); the length-floor gap was not recorded. Mitigation options: min-length check in both env validators, or refuse requests that carry `CF-Connecting-IP` on this one path (binding callers have none), which makes it truly binding-only. Not exploitable without a weak or leaked secret. policy NONE, reconcile_case 0, rotation NONE.

Evidence:
```
// index.ts:272-276
  if (!(await timingSafeEqual(authHeader, expectedAuth))) {
    logger.error('Webhook authentication failed');
    return c.json({ error: 'Unauthorized' }, 401);
// env-validation.ts:80  (the only secret with a length floor in this validator)
    if (env.BOT_SIGNING_SECRET.length < 32) {
```

Three drafted leads were re-checked against the earlier audits and moved to Rejected (section 3): the Universalis per-isolate limiter, missing `no-store` on presets-api, and the unsigned query string.

## 6. Handoffs (non-security)

- bug (presets-api): `GET /api/v1/presets?search=<more than ~48 chars>` builds `%...%` and binds it to three `LIKE ... ESCAPE` clauses with no length cap (handlers/presets.ts:226,241; preset-service.ts:249-254); D1 documents a 50-byte LIKE pattern limit, which should surface as an unhandled D1 error and a generic 500 (unverified, not run against D1). Cap `search` to ~40 characters in the handler and 400 above it.
- bug (presets-api): `notifyDiscordBot` calls `env.DISCORD_WORKER.fetch` with no `AbortSignal` while every other service-binding call in the repo has one (notification-service.ts:184-193); a hung discord-worker would pin the `waitUntil` for up to the platform limit across 4 attempts.
- bug (image-worker): no `app.onError`; `POST /extract` calls `c.req.json()` with no size cap (image-worker index.ts:135-139). Internal-only, but a thrown error surfaces as Hono's default 500 text rather than the `{error}` envelope the discord-worker markers expect.
- doc: `docs/architecture/security-trade-offs.md` has no entry for the per-isolate Universalis limiter (BUG-066) that rate-limiter.ts:39 and the 2026-08-29 report call an accepted trade-off.
- bug/robustness (api-worker): `searchItems`/`getGlasses` parse XIVAPI with an unbounded `response.json()` on an operator-var host (xivapi.ts:280,294); the host is a constant in production, so INFO. A shared `readBoundedText` already exists (lib/bounded-body.ts) and would fit.
- doc: 2026-09-15 SECURITY_AUDIT_REPORT.md positive control "User-specific/auth responses use no-store controls" overstates presets-api (see Rejected).
- doc/consistency: presets-api and moderation-worker still return `stack` in development onError while api-worker removed it in every environment (api-worker index.ts:232-235); harmless today (no routes) but inconsistent.
- bug (core): `APIService.fetchWithTimeout` measures the body after `response.text()` has buffered it (packages/core/src/services/APIService.ts:709-718), so `API_MAX_RESPONSE_SIZE` bounds nothing for a chunked response; the published library targets a fixed host, so low value.
- note for privacy reviewers: discord-worker and moderation-worker log the Discord user id at info (`logger.info('Handling command', { command, userId })`, index.ts:832; moderation index.ts:247). The bot policy lists the id; confirm retention wording.
