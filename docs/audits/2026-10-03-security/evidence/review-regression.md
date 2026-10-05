# Review: regression sweep (2026-10-03) — HEAD 0ab33466

Scope: all 6 findings of `2026-09-15-security`, all 31 of `2026-08-29-security`, and every Positive-control bullet of both reports. For each: control located at HEAD (path:line), guard test named, guard test file run alone (`pnpm --filter <pkg> exec vitest run <file> --coverage.enabled=false`). Result: **62 guard test files run, 0 failures** (`evidence/scripts/regression/results.txt`, `results2.txt`; runner `run-tests.sh` / `run-tests2.sh`, lists `tests.list` / `tests2.list`). All nine 2026-09-15 fix commits are ancestors of HEAD (`git merge-base --is-ancestor 3095b8ce HEAD` = true).

Result: **no control REGRESSED.** One UNGUARDED class found (CI workflow / gitleaks config invariants have no test) -> candidate c1 (LOW, LOCAL).

## 1. Entry points and authz matrix (surfaces re-read for the regression sweep)

| Unit | Entry | Who can call | Middleware / guards before handler (in order) | Body / param caps |
|---|---|---|---|---|
| oauth | `GET /auth/discord`, `GET /auth/xivauth` | anyone | CORS exact-origin allowlist (index.ts:60-98) -> security headers + `Cache-Control: no-store` (index.ts:122-135) -> `validateEnv` fail-closed 500 (index.ts:~154) -> `/auth/*` native rate limit (index.ts:~176) -> bodySizeLimit 10 KB -> jsonDepthLimit | 10 KB streamed (`worker-kit/body-guards`, Hono `bodyLimit`) |
| oauth | `GET/POST /auth/callback`, `GET/POST /auth/xivauth/callback` | anyone with a signed state | same; POST requires signed state + PKCE verifier bound to challenge (callback.ts:99-105) | 10 KB |
| oauth | `GET /auth/me`, `POST /auth/revoke` | bearer JWT holder | same; `/me` HS256 + issuer pin + KV revocation (token.ts:34-60); `/revoke` signature-only verify then `revokeToken` (token.ts:101-140) | 10 KB |
| oauth | `/auth/refresh` | removed (404) | n/a (index.ts:279-283, token.test.ts:68) | n/a |
| presets-api | `GET /api/v1/presets`, `/featured`, `/:id`, `/categories*` | anyone | requestId, logger, `validateEnv` (prod 500), headers, CORS exact origin, `RL_PUBLIC`, bodySizeLimit 100 KB, jsonDepthLimit, `authMiddleware` (anonymous allowed), per-user limiter; `toPublicPreset` strips `author_discord_id` for anonymous (preset-service.ts:169-195) | 100 KB |
| presets-api | `POST/PATCH/DELETE /api/v1/presets*`, `/votes/*`, `/mine`, `/refresh-author` | signed-in web user (JWT) or bot (HMAC v2) | as above + `requireAuth`/`requireUserContext` + router-level `requireNotBanned` (presets.ts:128); owner checks (presets.ts:408, 552); PATCH owner write compares `author_discord_id` + `content_revision` (preset-service.ts:713) | 100 KB JSON; preview upload exempt to 5 MB (body-validation.ts, streamed) + magic-byte sniff (presets.ts:1177) |
| presets-api | `/api/v1/moderation/*` (pending, status, revert, preview-image, history, stats, failed-notifications) | moderators only (`MODERATOR_IDS`; web JWT or bot HMAC) | as above + `requireModerator` as first line of every handler (moderation.ts:82,95,180,264,347,369,399,415); status/revert compare `status` + `content_revision` (+ raw snapshot for revert), preview-image compares `preview_image_key` (moderation.ts:306-325) | 100 KB |
| discord-worker | `POST /` (interactions) | any Discord user; Ed25519 signature | CORS (browser-irrelevant), requestId, logger, `validateEnv` (fatal prod errors -> 500), headers, then `verifyDiscordRequest`: Content-Length precheck, header presence, timestamp freshness -300 s/+60 s **before reading body**, streamed byte cap 100 000 with cancel, verify original bytes (auth discord.ts:75-160) | 100 000 B streamed |
| discord-worker | `POST /webhooks/github` | GitHub (HMAC-SHA256) | secrets configured -> Content-Length 1 MiB -> streamed 1 MiB cap with cancel (index.ts:517-545) -> HMAC over raw bytes (index.ts:555) -> event allowlist (`ping`/`push`) -> pinned repo `full_name` -> branch main -> changelog touched -> per-version KV memo | 1 MiB streamed |
| discord-worker | `POST /webhooks/preset-submission` | presets-api (bearer `INTERNAL_WEBHOOK_SECRET`) | constant-time bearer compare (index.ts:~268), `readTextCapped` 10 KiB, `type` allowlist, preview key regex + `startsWith(presetId/)` (index.ts:~300) | 10 KiB streamed |
| discord-worker | button `preview-image` approve/reject | moderators (`isModerator`, preview-image.ts:147) | parse custom_id (UUID or `<id>/<uuid>.webp` only) -> moderator gate -> legacy id = refresh only (preview-image.ts:~150) -> new id = signed API write with the key | n/a |
| moderation-worker | `POST /` interactions | Discord users; Ed25519 | same verifier (workspace `@xivdyetools/auth` 2.0.2); every command/button/modal/autocomplete calls `presetApi.isModerator` (preset.ts:403,517,627; preset-moderation.ts:89,226,278; ban-confirmation.ts:66,136; ban-reason.ts:49; preset-rejection.ts:59,184; index.ts:364) | 100 000 B streamed |
| api-worker | `/v1/*`, `POST /v1/telemetry`, `/universalis`, `/api/v2` | anyone | docs-host short-circuit with security headers -> requestId -> logger -> headers + `no-store` on non-2xx -> CORS `*` (no credentials) -> native limiter (`/v1/*`; telemetry own bucket, exact + `/*`) -> locale | telemetry 16 KB streamed, <=25 events; Origin allowlist (exact match) checked before body read; `Sec-GPC:1` -> 204 no trace (telemetry/router.ts:57-70) |
| image-worker | `POST /extract`, `POST /thumbnail` | service binding only (`workers_dev=false`, `preview_urls=false`, no routes; `*.workers.dev` host -> 404, index.ts:~65) | requestId, logger | `/thumbnail` streamed cap; `/extract` JSON uncapped but INTERNAL and URL host allowlist + manual one-hop redirect + timeout (validators.ts:25,404-440) |
| og-worker | `/og/*`, crawler HTML routes | anyone | path/segment length guard (index.ts:170-184), query key allowlist (index.ts:~186), logger `logUserAgent:false` (index.ts:160), crawler log = `{tool,locale,crawler}` only (index.ts:~589) | 512-char path, 64-char segment |
| web-app (Pages) | static + `functions/_middleware.ts` | anyone | CSP `script-src 'self'`, `connect-src 'self' https://*.xivdyetools.app`, no third-party origins (`public/_headers`); `/assets/*` HTML fallback -> 404 `no-store` (functions/_middleware.ts:~26) | n/a |

## 2. Positive controls re-checked at HEAD

2026-09-15 report, bullet by bullet:

- **OAuth** — signed expiring state + PKCE verifier bound to challenge, mandatory state (`400 Missing state`): callback.ts:99-105, state-signing.ts; exact-origin CORS from the redirect allowlist: index.ts:60-98; 1 h JWT default `JWT_EXPIRY||3600`, `iss`, `jti`: jwt-service.ts:121-137; HS256 pinned: auth `jwt.ts:147`; revocation shared via `TOKEN_BLACKLIST`: token.ts:34-60; `/auth/refresh` removed: index.ts:279; prod `validateEnv` refuses missing `RL_AUTH_*`/`TOKEN_BLACKLIST`: oauth env-validation.ts:121-128. HOLDS (oauth tests all green: schema, callback, token, index, rate-limit, env-validation, wrangler-config, user-service).
- **Bots verify signature before parsing; freshness; moderator gates; v2 signatures with nonces** — discord.ts:100-160 (freshness at 100-111 precedes body read at 119); moderator gates listed in the matrix; presets-api auth.ts:309-340 (v2 only, nonce replay via KV `botnonce:`, TTL 120 s), canonical string length-prefixed `auth hmac.ts:276-291`, 60 s age window `hmac.ts:323-336`, key >= 32 B `hmac.ts:99-101`. HOLDS.
- **Presets ownership/visibility, bans, bound D1, server-generated keys, upload gates, Perspective** — `canSeePreset` presets.ts:140 (used at 403/547/879/1099); `requireNotBanned` presets.ts:128; keys `${presetId}/${crypto.randomUUID()}.webp` preview-image-service.ts:156; 5 MB streamed cap + sniff presets.ts:1177; Perspective: `x-goog-api-key` header moderation-service.ts:261, `doNotStore:true` :274, `AbortSignal.timeout(5000)` :277, failure -> `moderationUnavailable()` (`passed:false`) :218-230. All preset D1 access in the files read uses `.prepare().bind()`. HOLDS.
- **Image-worker** — service-binding-only (wrangler.toml: `workers_dev=false`, `preview_urls=false`, no routes; wrangler-config.test.ts 8 tests); dimension check before decode validators.ts:303 / dimensions.ts:121; host allowlist validators.ts:25, `redirect:'manual'`, one validated hop, abort timeout, byte caps validators.ts:404-470. HOLDS.
- **API/OG validation, cache keys, escaping, fixed outbound targets, no-store** — api-worker index.ts:78-96 (no-store on non-2xx), og index.ts:170-200 guards, og-guards.test.ts 44 tests. HOLDS.
- **Web telemetry** default off (`toggleOn=false`, telemetry-service.ts:53), `navigator.globalPrivacyControl` gate :118, queue dropped on opt-out :214, no client id; server enum/DB allowlist + Origin gate + GPC 204 (api-worker telemetry/router.ts:57-70, origin.ts exact map). HOLDS.
- **Web CSP** `script-src 'self'`, no third-party origins (`public/_headers`, security-headers.test.ts 11 tests); `.chara` names type-enforced (outside this sweep; other reviewers). HOLDS for CSP.
- **Logger**: nested/alias/cycle redaction (base-logger.ts, hardening.test.ts 26 tests), key list constants.ts:14-38, JWT/Bearer/Discord-token/hex64 value shapes base-logger.ts:560-590, `logUserAgent` default false (worker-kit logger.ts:117) and no app opts in (grep over apps/packages: only oauth/presets-api comments + og `false`); limiter key scoped to a bucket class (worker-kit key-scope.ts:78, 13 tests). HOLDS.
- **Workflows**: 14/14 workflows have every `uses:` pinned to a 40-hex SHA (counted per file); `permissions: contents: read` (ci.yml:39); all deploy/publish/sync workflows `environment: production`, beta workflows `environment: beta` with `CLOUDFLARE_API_TOKEN_BETA` and a fail-fast guard step. HOLDS in code, but see c1 (no test).

2026-08-29 report extras: Ed25519 raw-body check, `custom_id` regexes, `.dev.vars*` ignored (`.gitignore:11-12`, none tracked), wrangler `[vars]` public-only (grep of apps/*/wrangler.toml shows only binding names), `workers_dev`/`preview_urls` false on image-worker/api-worker/og-worker (tests pass), 0 `pull_request_target` / `workflow_run` triggers.

## 3. Rejected items

- `/extract` in image-worker reads `c.req.json()` with no byte cap (index.ts:138): INTERNAL only (no route, workers.dev 404) and the only caller is discord-worker over a service binding; the embedded URL is host-allowlisted. Not filed.
- `GITHUB_WEBHOOK_SECRET` imported with no length floor (discord-worker github-verify.ts:47): the secret is GitHub-side chosen and comparison is constant-time; accepted, not a regression of any earlier control.
- moderation-worker `BOT_SIGNING_SECRET` is "optional" in validation (env-validation.ts:111): presets-api rejects unsigned bot calls when its own secret is set and refuses when not set outside dev (auth.ts:~288); fail-closed, availability only.
- presets-api `validateEnv` gate keys on `ENVIRONMENT === 'production'` only (index.ts) whereas oauth treats every non-development env as production: top-level block is routeless `-dev` worker with `workers_dev=false`, so unreachable; already PAPI-11 INFO in 2026-08-29.
- Bot signature does not cover the query string: deliberately not done and recorded INFO in 2026-08-29/FINDING-015 (only GET routes read the query; INTERNAL) -> ACCEPTED, not re-filed.
- Native-limiter fail-open: accepted trade-off (`security-trade-offs.md`); the 08-29/FINDING-012 part (never silent, validated binding) HOLDS (cloudflare.ts:131-132, 201-237).
- Dev-environment `/__force-error` and stack echo in presets-api (index.ts): gated on `ENVIRONMENT==='production'`/'development'; routeless dev worker; earlier INFO.
- Policy-document halves of 08-29/002, /006, /008 (web guide names Google, bot policy lists KV prefixes and 180-day first-run flag): not re-verified here; belongs to the policy reviewers (claims inventory). Code halves HOLD (index.ts:770,791).
- Cloudflare dashboard facts (08-29/024 WAF rule, /030 token scope, /028 environment secrets, 09-15 deploy-pending items, migration 0014 applied in production): not observable from the repo; no network access allowed. Not claimed.

## 4. Files covered (read in whole or the cited ranges)

packages/auth/src/discord.ts, hmac.ts (99-104, 270-360), jwt.ts (140-310 skim); packages/logger/src/core/base-logger.ts (556-700 + redaction notes), constants.ts; packages/worker-kit/src/middleware/logger.ts, body-guards/body-guards.ts, rate-limiter/backends/cloudflare.ts (110-240), key-scope.ts; apps/oauth/src/index.ts, handlers/token.ts, handlers/callback.ts (1-110), services/jwt-service.ts (100-140), middleware/body-validation.ts, utils/env-validation.ts (110-130), schema/users.sql; apps/presets-api/src/index.ts, middleware/auth.ts, middleware/body-validation.ts, handlers/moderation.ts (1-420), handlers/presets.ts (100-200, 470-530, 700-740, 1040-1060, 1170-1250), services/moderation-service.ts (200-320), services/preset-service.ts (125-200, 450-490, 700-720), services/rate-limit-service.ts (150-175), migrations/0014_add_content_revision.sql, utils/env-validation.ts (100-120), wrangler.toml; apps/discord-worker/src/index.ts (100-330, 500-800), handlers/buttons/preview-image.ts (100-330), services/preferences.ts (60-80), wrangler.toml rate-limit blocks; apps/moderation-worker/src/handlers/commands/preset.ts (59-125, 353-410), utils/env-validation.ts (100-155), service grep; apps/api-worker/src/index.ts (36-190), telemetry/router.ts, telemetry/origin.ts; apps/image-worker/src/index.ts (54-200), validators.ts (380-470), wrangler.toml; apps/og-worker/src/index.ts (150-200, 440-460, 575-610, 1295-1310); apps/web-app/public/_headers, functions/_middleware.ts, src/services/telemetry-service.ts (grep), src/index.html (65-80); apps/stoat-worker/src/message-handler.ts (85-125), index.ts (55-66); .github/workflows/* (grep: pins, environments, triggers; ci.yml 170-196), .gitleaks.toml (1-60); docs/audits/2026-09-15-security/{SECURITY_AUDIT_REPORT,IMPLEMENTATION_REPORT}.md and findings/*, docs/audits/2026-08-29-security/SECURITY_AUDIT_REPORT.md and findings/FINDING-004, -015.

## 5. Regression table

Status key: HOLDS / REGRESSED / UNGUARDED / ACCEPTED. "Ran" = single-file vitest run passed at HEAD (test count in parentheses).

### 2026-09-15-security (deployment acceptance was pending at the time of that report; code state only is judged here)

| folder/ID | control at HEAD | guard test (ran) | status |
|---|---|---|---|
| 09-15/001 | auth discord.ts:75-160 streamed cap + cancel, original bytes verified | packages/auth/src/discord-stream.test.ts (7) | HOLDS |
| 09-15/002 | presets-api moderation.ts:264-325 (key regex, `WHERE preview_image_key=? AND status='pending'`, 409); discord-worker preview-image.ts:112-160 (key in custom_id, legacy = refresh only); only one writer sets `approved` (grep) | presets-api tests/handlers/preview-revision.test.ts (13); discord-worker src/handlers/buttons/preview-image.test.ts (15), preview-refresh.test.ts (3) | HOLDS |
| 09-15/003 | discord-worker index.ts:517-545 streamed 1 MiB cap before HMAC | src/github-body-limit.test.ts (8) | HOLDS |
| 09-15/004 | preset-service.ts:713 `author_discord_id=? AND content_revision=?`; migration 0014 trigger covers all content/status writers; handler presets.ts:748 | tests/handlers/owner-revision.test.ts (8) | HOLDS |
| 09-15/005 | preset-service.ts:461, 483 (`status`/`content_revision`/`previous_values` conditions); moderation.ts:142, 226 | tests/handlers/moderation-revision.test.ts (8) | HOLDS |
| 09-15/006 | og index.ts:~589 `{tool, locale, crawler}`; logger `logUserAgent:false` :160; request logger logs pathname only (worker-kit logger.ts:77-90) | og-worker src/index.privacy.test.ts (1) | HOLDS |

### 2026-08-29-security

| folder/ID | control at HEAD | guard test (ran) | status |
|---|---|---|---|
| 08-29/001 | oauth schema/users.sql (no roster table), migrations/0001, xivauth.ts:339 | oauth schema.test.ts (7), callback.test.ts (45), user-service.test.ts (15) | HOLDS |
| 08-29/002 | claims trimmed jwt-service.ts:100-140; users.avatar_url gone; web-app auth-service; disclosure text = policy reviewers | oauth jwt/token/user-service tests; web-app auth-service.test.ts (66) | HOLDS |
| 08-29/003 | `/auth/refresh` removed index.ts:279; no handler | oauth token.test.ts:68 (23), rate-limit.test.ts (15) | HOLDS |
| 08-29/004 | presets.ts:477-520 `newTextToJudge`, flagged-edit cap :724; no re-queue/re-notify | presets-quotas.test.ts (32), presets.test.ts (150) | HOLDS |
| 08-29/005 | moderation-service.ts:218-230, 255-285 fail-closed `moderationUnavailable`, header key | tests/services/moderation-service.test.ts (45), presets-quotas (32) | HOLDS |
| 08-29/006 | `doNotStore:true` moderation-service.ts:274; guide naming Google = policy reviewers | moderation-service.test.ts (45) | HOLDS (code) |
| 08-29/007 | discord-worker native `[[ratelimits]]` RL_5..RL_70 (wrangler.toml:50+, rate-limiter.ts:49-94); no `UPSTASH` in toml | discord-worker rate-limiter.test.ts (31), tests/wrangler-config.test.ts:117 (8), env-validation.test.ts (39) | HOLDS |
| 08-29/008 | first-run flag TTL 180 d index.ts:770,791; KV prefix doc = policy reviewers | discord-worker src/index.test.ts (81), preset-api-v2.test.ts (2) | HOLDS (code) |
| 08-29/009 | web-app images session-only, IDB v3 purge indexeddb-service.ts:16,111; extractor-tool.ts:108,1256 | indexeddb-service.test.ts (54), extractor-tool.test.ts (121) | HOLDS |
| 08-29/010 | `logUserAgent` default false, no consumer opts in; limiter key logged as scope key-scope.ts:78 | worker-kit logger.test.ts, key-scope.test.ts (13), cloudflare.test.ts (19), middleware/rate-limit.test.ts (17); api-worker app-hardening.test.ts (14); oauth index.test.ts (35) | HOLDS |
| 08-29/011 | ids/lengths only in logs (budget/preferences/ban-reason); presets-api moderation/votes | discord-worker preferences.exhaustive.test.ts (156), preferences.test.ts (13); moderation-worker ban-reason.test.ts (26) | HOLDS |
| 08-29/012 | cloudflare.ts:131-132 binding validated; 201-237 fail-open logged with `backendError`; oauth index.ts:~190 logs it | worker-kit cloudflare.test.ts (19); oauth rate-limit-binding.test.ts (6); moderation rate-limit-fail-open.test.ts (3) | HOLDS (fail-open itself ACCEPTED trade-off) |
| 08-29/013 | presets-api env-validation.ts:105-115; oauth :121-128; moderation :149+; discord-worker `PRODUCTION_ENV_ERROR_PREFIX` fatal (index.ts:~203) | presets-api env-validation.test.ts (49); oauth env-validation.test.ts (25); discord env-validation.test.ts (39); moderation env-validation-gate.test.ts (7) | HOLDS |
| 08-29/014 | telemetry router.ts:57-70, origin.ts exact map; limiter on exact path + `/*` (api index.ts:122-129) | api-worker origin.test.ts (8), router.test.ts (19), schema.test.ts (18), middleware/rate-limit.test.ts (9) | HOLDS |
| 08-29/015 | v2 only + nonce replay auth.ts:309-340; v1 export gone from auth; bots no longer send v1 | presets-api auth-v2.test.ts (16), auth.test.ts (49); auth hmac.test.ts (19); discord/moderation preset-api-v2.test.ts (2+2); query-string signing | HOLDS; query signing ACCEPTED (INFO, recorded) |
| 08-29/016 | `toPublicPreset` preset-service.ts:169-195 applied via presets.ts:120 | tests/services/preset-service.test.ts (71), presets.test.ts (150) | HOLDS |
| 08-29/017 | `pruneSubmissionEvents` rate-limit-service.ts:156-175; `pruneFailedNotifications` presets.ts:1056 | notification-service-deadletter.test.ts (10), rate-limit-service-events.test.ts (6) | HOLDS |
| 08-29/018 | moderation-worker ban-service.ts:353,378,404 write `moderation_log`; migration 0013 | ban-service.test.ts (58) | HOLDS |
| 08-29/019 | `WORLD_NAME_MAX_LENGTH=32` preferences.ts:74, enforced :455 | preferences.exhaustive.test.ts (156), commands/schemas.test.ts (16) | HOLDS |
| 08-29/020 | exempt commands skip hot-key KV writes (index.ts:~856-870) | discord rate-limiter.test.ts (31), index.test.ts (81) | HOLDS |
| 08-29/021 | event allowlist, pinned repo, per-version memo index.ts:~569-700 | discord src/index.test.ts (81) (redelivery cases :960, 1176-1232) | HOLDS |
| 08-29/022 | `Cache-Control: no-store` + Pragma on all responses oauth index.ts:127-128 | oauth index.test.ts (35) | HOLDS |
| 08-29/023 | wrangler invariant tests exist for image-worker, presets-api, moderation, oauth (+discord) and run in CI (ci.yml:174-196) | image-worker (8), presets-api (6), moderation (10), oauth (8), discord (8) wrangler-config tests | HOLDS |
| 08-29/024 | og guards index.ts:170-200 (path/segment/query-key) | og-guards.test.ts (44) | HOLDS (WAF rule is dashboard-side, not verifiable) |
| 08-29/025 | array items + free-text scan; JWT/Bearer/Discord token shapes base-logger.ts:560-590, SANITIZE_RULES :644+ | logger hardening.test.ts (26) | HOLDS |
| 08-29/026 | no universalis hint in index.html:65-80; CSP connect-src first-party | web-app security-headers.test.ts:186-193 (11) | HOLDS |
| 08-29/027 | functions/_middleware.ts `/assets/` HTML -> 404 no-store | pages-middleware.test.ts (5) | HOLDS |
| 08-29/028 | beta workflows `environment: beta`, `CLOUDFLARE_API_TOKEN_BETA`, fail-fast step (deploy-*-beta.yml:52-72) | none (workflow-only runtime guard step) | UNGUARDED -> c1 |
| 08-29/029 | `.gitleaks.toml` allowlists are file-shaped and value-anchored (1-60) | CI `Secret scan (gitleaks)` job (ci.yml:88-110); no test of the config | UNGUARDED (config) -> c1 |
| 08-29/030 | CI token scope is a Cloudflare dashboard setting | not observable in repo | ACCEPTED (external; marked done in report) |
| 08-29/031 | stoat message-handler.ts:93-117 logs command-only through `loggableCommand`; index.ts:59 admin count only | stoat message-handler.test.ts (11) | HOLDS |

Checklist rows (this assignment): Hono route auth order (matrix above) OK; body caps streamed everywhere user-reachable (oauth 10 KB, presets-api 100 KB / 5 MB, discord 100 000 B / 1 MiB / 10 KiB, telemetry 16 KB); D1 only via `.prepare().bind()` in all files read (moderation_log INSERT in ban-service uses a constant column list); R2 keys server-generated; error handlers return generic messages outside development; CORS exact-match (oauth, presets-api; api-worker `*` by design, no credentials); native rate limits present with prod validation; secrets not in `[vars]`; `.dev.vars*` ignored; module-scope state limited to `envErrorsLogged` flags; `waitUntil` used for side effects; outbound fetch targets fixed/allowlisted with timeouts (Perspective 5 s, image fetch abort, changelog 10 s). Packages: createHmacKey >= 32 B (hmac.ts:99-101), canonical string length-prefixed (hmac.ts:276-291), logger redaction covers Discord/JWT/Bearer/hex shapes, worker-kit native limiter validates binding and logs fail-open.

## 6. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | LOW | LOCAL | .github/workflows/deploy-og-worker-beta.yml:52-72 (and the 14 workflow files, .gitleaks.toml:1-60) | The FINDING-028 fix (beta workflows use `environment: beta` + `CLOUDFLARE_API_TOKEN_BETA`, never the production token), the SHA-pinning / least-privilege `permissions` / `environment: production` posture and the narrowed gitleaks allowlist are guarded only by an in-workflow runtime step and the CI scan itself; no test or script asserts them. A one-line edit that reverts a beta workflow to `secrets.CLOUDFLARE_API_TOKEN`, an unpinned `uses:`, or re-widens the allowlist would pass `build type-check lint test` and `test:scripts`. regression_of = `2026-08-29-security/FINDING-028` (and `/029`). |

Candidate detail (for the structured output): trigger = a PR editing a beta deploy workflow or `.gitleaks.toml`; evidence = `grep -l CLOUDFLARE_API_TOKEN_BETA` outside docs/.github returns only CHANGELOG/CLAUDE/README (no test), and `scripts/` holds only dead-code, docs and knip gates. Suggested guard: a `scripts/check-workflows.ts` (+ self-test in `test:scripts`) asserting every `uses:` is a 40-hex SHA, every deploy/publish workflow names an `environment:`, beta workflows reference only `_BETA` secrets, and the gitleaks `[[allowlists]]` carry no `paths` entry outside `*.test.ts`/`*.spec.ts`/`__tests__`. policy NONE, reconcile_case 0, rotation NONE.

## 7. Handoffs (non-security)

- documentation: 2026-09-15 `SECURITY_AUDIT_REPORT.md` still shows all six findings `OPEN — fixed locally; deploy pending` while HEAD (main) contains every fix commit; the status table needs closing once the deploy acceptance checks are recorded.
- documentation: 2026-08-29 `SECURITY_AUDIT_REPORT.md` Positive controls says "15/15 workflows" while 14 workflow files exist at HEAD (`git ls-files .github/workflows`).
- documentation/i18n: policy-text halves of 08-29/002, /006, /008 (Google named in web guide, KV prefixes + 180-day first-run flag in bot policy, deletion path) were not re-read in this review; hand to the policy-claims reviewer.
- plain bug (INFO): oauth `callback.ts` and `xivauth.ts` read `await c.req.json()` after the size/depth middleware has already consumed `c.req.text()`; works through Hono's body cache, noted only because the order is load-bearing (covered by callback.test.ts).
- plain bug (INFO): `apps/image-worker/src/index.ts:138` `/extract` has no byte cap on its own JSON body (INTERNAL only).
