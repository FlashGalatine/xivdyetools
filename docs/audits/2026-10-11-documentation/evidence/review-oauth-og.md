# Review: cluster oauth-og (2026-10-11)

Baseline: HEAD 42c35e87 == served 16a6123f for apps/oauth (3.1.3) and apps/og-worker (2.12.0).

## Coverage

| Path | Tier | Units | Sections reviewed | Result |
|---|---|---|---|---|
| docs/projects/oauth/overview.md | living | oauth | all (quick start, flow, tree, endpoints, PKCE, JWT, env, secrets, refresh removal) | reviewed |
| docs/projects/oauth/endpoints.md | living | oauth, worker-kit rate-limiter, auth | all | reviewed |
| docs/projects/oauth/jwt.md | living | oauth, auth | all | reviewed (startLogin / verifyJWT snippets are illustrative, not checked as importable code) |
| docs/projects/oauth/pkce-flow.md | living | oauth | all | reviewed |
| docs/projects/og-worker/overview.md | living | og-worker | all | reviewed |

## Candidates

### cand-oauth-og-01 (MEDIUM, missing) supersedes 2026-09-21-documentation/DOC-016
- Doc: docs/projects/oauth/overview.md:22-24 (Quick Start secrets) and :200-204 (Secrets block) list only DISCORD_CLIENT_SECRET and JWT_SECRET.
- Truth: a third, optional secret exists. apps/oauth/wrangler.toml:86 (`# Secrets: DISCORD_CLIENT_SECRET, JWT_SECRET, XIVAUTH_CLIENT_SECRET`); apps/oauth/src/types.ts:393 (`XIVAUTH_CLIENT_SECRET?` optional, confidential client mode); apps/oauth/src/handlers/xivauth.ts:172-174 (sent in the token exchange only when set). validateEnv (src/utils/env-validation.ts:217-226) does not require it, so only an XIVAuth app registered as confidential breaks.
- Fix: add `wrangler secret put XIVAUTH_CLIENT_SECRET    # optional: only for XIVAuth confidential-client mode` to both blocks (matches apps/oauth/CLAUDE.md and docs/developer-guides/environment-variables.md:156).

### cand-oauth-og-02 (MEDIUM, inaccurate)
- Doc: docs/projects/og-worker/overview.md:112 (`SUPPORTED_TOOLS` = nine tools ending `budget`), whole Routes section 106-150, Supported platforms; no occurrence of "glamour" anywhere in the file.
- Truth: SUPPORTED_TOOLS has ten entries including `glamour` (apps/og-worker/src/index.ts:100-111); a GET /glamour and /glamour/ handler is registered for every entry (index.ts:716-719); wrangler routes both envs include `xivdyetools.app/glamour/*` and `beta.xivdyetools.app/glamour/*` (apps/og-worker/wrangler.toml, routes lists); `generateOGDataForTool` has `case 'glamour'` returning the tool default (src/og-data-generator.ts:1083-1086, "no share grammar"); `/og/glamour/default.png` is served by `/og/:tool/default.png` (index.ts:888-897) with no method tag (index.ts:741). Shipped in og-worker 2.11.0 (CHANGELOG, commit 975175da).
- Fix: change line 112 to list ten tools and add a Routes row `/glamour | no share parameters; every link takes the Glamour Reader default card (a .chara file never leaves the browser)`; say that `/og/glamour/default.png` is its only image.

### cand-oauth-og-03 (LOW, inaccurate)
- Doc: docs/projects/oauth/endpoints.md:249-256 (GET /auth/discord errors), :322-337 (POST /auth/callback errors), :353-375 (xivauth).
- Truth: authorize also returns 400 for a bad `return_path` and a bad `state` (apps/oauth/src/handlers/oauth-flow.ts:167-186), neither in the table. POST callback 401 messages are `Failed to exchange authorization code`, `Token missing required permissions`, `Failed to fetch user information`, `Invalid user data received` (handlers/callback.ts:510-566; xivauth.ts:199-278), and the `500 Authentication failed` outcome (callback.ts:610-616) is not listed. The table's quoted-looking phrases `Token exchange failed`, `Missing required scope (identify)`, `Invalid user data from Discord` are paraphrases that match no response.
- Fix: add the two 400 rows and the 500 row; use the real error strings.

### cand-oauth-og-04 (LOW, missing)
- Doc: docs/projects/oauth/overview.md (no database section; tree lists no schema/ or migrations/).
- Truth: the worker owns D1 `xivdyetools-users` (apps/oauth/wrangler.toml D1 block), schema apps/oauth/schema/users.sql (users table, partial unique indexes on discord_id and xivauth_id, CHECK one id set) and one hand-run migration apps/oauth/migrations/0001_drop_xivauth_characters.sql. No living doc mentions the migration (git grep of docs minus archive tiers finds none), and the docs only say the `xivauth_characters` table is gone.
- Fix: add a short Database section: table columns, `wrangler d1 execute xivdyetools-users --remote --file=./schema/users.sql` for a fresh DB, and the migration being applied with `wrangler d1 execute --file` (never `migrations apply`).

### cand-oauth-og-05 (LOW, inaccurate)
- Doc: docs/projects/og-worker/overview.md:300-312 ("One datapoint per crawler hit"; blobs `[event, tool, crawler]` with "the detected crawler type").
- Truth: image routes also write a datapoint per uncached render, with `event: 'og_image_request'` and `crawler: 'none'` (src/index.ts:927-933 harmony and the same call in each image route; trackAnalytics at index.ts:541-558). A cache hit returns in the cache middleware (index.ts:508-535) before any handler, so no datapoint. The sentence "one per crawler hit" is true only for `og_request`.
- Fix: say `og_request` is one per crawler page hit and `og_image_request` is one per uncached image render with crawler `none`.

### cand-oauth-og-06 (LOW, missing)
- Doc: docs/projects/og-worker/overview.md Routes section.
- Truth: `GET /health` returns `{status:'ok', service:'xivdyetools-og-worker', timestamp}` (index.ts:566-572) and `GET /` serves a root embed to crawlers (24 h cache) or 302s humans to APP_BASE_URL (index.ts:1364-1377). Neither is documented; unknown paths for a crawler return a 404 embed with `no-store` (index.ts:1383-1394).
- Fix: add a short "Other routes" table.

### cand-oauth-og-07 (LOW, spelling) supersedes none
- Documents: docs/projects/og-worker/overview.md (4), docs/projects/oauth/endpoints.md (1), docs/projects/oauth/jwt.md (1). Detail in the table below.

## Priors
- DOC-016: STILL_PRESENT (cand-oauth-og-01).

## Seeds
1. oauth 3.1.3 (BUG-007 decoded-path limiter, BUG-056 non-object bodies, BUG-057 roster fallback, BUG-149 JSON-only callbacks): confirmed documented correctly at endpoints.md:326-336,363-367,490 against index.ts:182-193, callback.ts:399-411, xivauth.ts:312-376, body-validation.ts:473-503. No drift.
2. og-worker 2.12.0 (BUG-008 interpolation/steps, BUG-060 extractor algo, BUG-059 bare hex, BUG-058 key splitting, repeated-key 400): documented correctly at overview.md:116-123,154-172,269-277 against og-params.ts:159-179, og-data-generator.ts:395-449,653-679,952-984, index.ts:270-325,356-379. No drift. The only og-worker drift is the missing glamour tool (cand-02).

## Positive controls
- Rate limits 10/20/30 per route and the RL_AUTH_* bindings match services/rate-limit.ts:16-25 and wrangler.toml; header names and 429 body match index.ts:182-227.
- Security headers, CORS maxAge 3600, dev ports 3000/5173/8787 match index.ts:50-134.
- Redirect allowlist, exact path `/auth/callback`, 10 minute state, 10 s / 5 s timeouts match constants/oauth.ts and callback.ts.
- JWT claim set (10, nine without discord_id), iss pinning, `revoked:<jti>` with exp + 15 minute grace and 60 s floor match jwt-service.ts:119-146, 181, packages/auth/src/revocation.ts:25,87-92.
- Deploy notes: oauth bare `wrangler deploy` is production (package.json deploy scripts, no [env.production]); og-worker bare deploy is routed beta (`xivdyetools-og-worker-dev`), `deploy:production` uses `--env production`.
- og-worker: query allowlist of six keys and error strings, cache key axes, TTLs 86400/604800 and 3600/86400, ten font TTFs, 1200x1050 / 1200x630 frames, crawler list (Googlebot excluded), bindings and vars all match source.
- Anchor `endpoints.md#post-authrevoke` (jwt.md:115) resolves to the `### POST /auth/revoke` heading. No other anchors in the cluster.

## Rejected suspicions
- jwt.md "JWT_SECRET (hex string, 256-bit)": not enforced (validateEnv only requires 32+ chars) but matches the documented provisioning `openssl rand -hex 32`. Guidance, not a claim about code.
- jwt.md `startLogin()` and `verifyJWT(token, JWT_SECRET)` snippets: labelled consumer illustrations; web-app has no `startLogin`, presets-api wraps the shared verifyJWT. Not presented as an importable API.
- overview.md "ALLOWED_REDIRECT_ORIGINS (two origins)": the constant also lists four localhost origins, but they are filtered out outside development, which pkce-flow.md:165-170 states.
- Platform table omits Facebot, "Open Graph", MetaInspector patterns: detector comments call them generic; table is a summary.
- Presets `?id=` fallback not mentioned: harmless extra input.
- Gradient image-route 2-20 step bound not documented: direct-URL detail, crawler emits only 3-12.
- Ash Grey / Slate Grey in og overview.md:218: game dye names, carved out.

## Spelling (default sweep + hand triage)

| Document | Count | Rows |
|---|---|---|
| docs/projects/og-worker/overview.md | 4 | :124 colour, :139 parameterised, :168 unparameterised (dictionary miss), :272 unrecognised (dictionary miss) |
| docs/projects/oauth/endpoints.md | 1 | :75 behaviour |
| docs/projects/oauth/jwt.md | 1 | :62 minimisation |
| docs/projects/oauth/overview.md | 0 | |
| docs/projects/oauth/pkce-flow.md | 0 | |

Confirmed total 6. The `--all` extras list was empty. Rejected: overview.md:218 Grey (dye names), none else.
