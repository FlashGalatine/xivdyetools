# Review: apps/presets-api (2026-10-03 security audit)

Commit 0ab33466. Read-only review. Probe: `evidence/scripts/presets-api/example-link-probe.mjs` (mirrors `validateExampleLink`, no network).

## 1. Entry points and authz matrix

Global chain (src/index.ts): requestId -> logger (UA off, path only; :36-43) -> env validation (prod fails every request on misconfig; :46-65) -> security headers -> CORS exact-match (:88-135) -> `/api/*`: public rate limit (native `RL_PUBLIC`, 100/60 s per IP; skipped only when no `CF-Connecting-IP`, i.e. service-binding traffic; middleware/rate-limit.ts:556-567) -> `bodySizeLimit` 100 KB (preview upload exempt, 5 MB stream cap) -> `jsonDepthLimit` (depth 10) -> `authMiddleware` (all routes) -> per-user rate limit (after auth) -> Content-Type gate (JSON, or image/* for upload). Production reachability: custom domains `api.xivdyetools.app` and `api.xivdyetools.projectgalatine.com`; top-level (dev) worker has `workers_dev=false` and no routes (wrangler.toml:16, tests/wrangler-config.test.ts:36-42). Service bindings: DISCORD_WORKER, IMAGE_WORKER; R2 THUMBNAILS; KV TOKEN_BLACKLIST (shared with oauth); D1 DB.

Auth sources (middleware/auth.ts): (a) bot = `Bearer BOT_API_SECRET` (constant-time, :269) AND valid `X-Request-Signature-V2` binding method+path+body hash+timestamp+nonce+identity (:311) AND single-use nonce (:338; KV, fail-open on KV error = accepted trade-off); in production `BOT_SIGNING_SECRET` is mandatory (env-validation.ts:97). (b) web = HS256 JWT, issuer pinned (:101), jti revocation (:107); identity = `discord_id` claim else `sub`. Moderator = identity in `MODERATOR_IDS` (checkModerator).

| Route | Reachable | Auth needed | Guards before handler | Body / param caps |
|---|---|---|---|---|
| GET `/`, `/health` | internet | none | global chain | n/a; `/` echoes ENVIRONMENT + API_VERSION |
| GET `/__force-error` | internet | none | 404 in production (index.ts:~178) | n/a |
| GET `/api/v1/categories`, `/categories/:id` | internet | none | rate limit | param bound via `.bind()`; `Cache-Control: public` 30-60 s |
| GET `/api/v1/presets` | internet | none; non-approved `status=` needs moderator (presets.ts:232-237) | rate limit | page>=1 (no upper bound), limit 1-50 (:246-247), `search` unbounded length (see handoffs) |
| GET `/presets/featured` | internet | none | rate limit | fixed LIMIT 10 |
| GET `/presets/mine`, `/presets/rate-limit` | internet | user (JWT or signed bot) + user context | requireAuth + requireUserContext | none |
| GET `/presets/:id` | internet | none; non-approved visible only to owner/moderator, else 404 (canSeePreset :140) | rate limit | id bound |
| POST `/presets` | internet | user | router-level `requireNotBanned` (:128), daily submission cap 10 + post-insert rollback (:1004-1020) | 100 KB JSON; name 2-50, desc 10-200, dyes 3-6 ints <=254, tags <=10 x 30 charset-restricted, link host allowlist |
| PATCH `/presets/refresh-author` | internet | user + name | ban check | empty body |
| PATCH `/presets/:id` | internet | owner only (moderators cannot edit, :552); 404 for invisible | ban check; `updatePreset` WHERE author + `content_revision` (preset-service.ts:713) -> 409 on stale | same validators; text-edit cap 30/day before Perspective, flagged-edit cap 10/day before notify |
| DELETE `/presets/:id` | internet | owner or moderator; 404 for invisible | ban check | batch deletes votes, dead letters, preset; R2 delete after DB |
| POST `/presets/:id/preview-image` | internet | owner only | ban check; upload cap 20/day (reserve-then-act, released on every failure) | 5 MB stream cap + byte-length recheck + magic-byte sniff (png/jpeg/webp) before image-worker; 10 s timeout; key `${presetId}/${uuid}.webp` server-built |
| DELETE `/presets/:id/preview-image` | internet | owner only | ban check | n/a |
| POST/DELETE `/votes/:presetId` | internet | user | router-level ban check; approved-only gate (votes.ts:194) | PK dedupe, ON CONFLICT DO NOTHING |
| GET `/votes/:presetId/check` | internet | user (own vote only) | requireAuth | n/a |
| GET `/moderation/pending`, `/stats`, `/:id/history`, `/failed-notifications` | internet | moderator | requireModerator (first statement) | n/a |
| PATCH `/moderation/:id/status` | internet | moderator | requireModerator | status enum; atomic batch, WHERE status + content_revision, audit insert `WHERE changes()>0` (moderation.ts:141-151) |
| PATCH `/moderation/:id/revert` | internet | moderator | requireModerator | reason 10-200; WHERE content_revision + raw previous_values (preset-service.ts:479-499) |
| PATCH `/moderation/:id/preview-image` | internet | moderator | requireModerator | key must match `^id/[A-Za-z0-9-]+.webp$`; UPDATE WHERE key + status='pending', 409 otherwise (:306-328) |
| PATCH `/moderation/failed-notifications/:id/resolve` | internet | moderator | requireModerator | id bound |

Everything is internet-reachable (no internal-only handlers). The bots call the same routes through service bindings; the per-IP limiter is skipped for them and the per-user limiter applies after the signature check.

## 2. Positive controls

- Auth order: public limiter -> body guards -> auth -> per-user limiter; limiter key is IP only, never a caller header (rate-limit.ts:524-526, :556-567). Bot identity requires HMAC v2 + nonce; v1 gone (auth.ts:269-345). JWT issuer pinned + revocation checked (auth.ts:101-109). Prod env validation fails every request when security bindings are missing (env-validation.ts:97-143, index.ts:46-65).
- Regression 2026-09-15/FINDING-002 holds: approval/rejection is bound to the exact pending key and returns 409 if stale (moderation.ts:280-328). Guarded by tests/handlers/preview-revision.test.ts (K1->K2 replace, mid-flight replace via beforeStatement hook, malformed/unversioned bodies, repeat action, non-moderator).
- Regression 2026-09-15/FINDING-004 holds: owner edit WHERE author + `content_revision` (preset-service.ts:713) and the DB trigger covers status/previous_values/author changes from any worker (schema.sql:64-78, migrations/0014:5-19). Guarded by tests/handlers/owner-revision.test.ts (moderator flag between read and write, status ABA, two racing owners, ownership change, hidden resubmission).
- Regression 2026-09-15/FINDING-005 holds: status uses `status` + revision (preset-service.ts:458-464); revert uses revision + raw snapshot (:479-499); audit row in the same batch with `WHERE changes()>0` (moderation.ts:141-151, :224-235). Guarded by tests/handlers/moderation-revision.test.ts (ABA, stale previous_values, audit rollback, vote-only/preview-only writes do not 409).
- 2026-08-29 findings still hold with tests: 004 state machine (`ownerEditOutcome` presets.ts:479-519), 005 fail-closed Perspective (`moderationUnavailable` moderation-service.ts:225-232; tests/services/moderation-service.test.ts:608), 006 key in `x-goog-api-key` header and `doNotStore: true` (:261, :274; tests :512-538), 016 author id withheld from anonymous callers (`toPublicPreset` preset-service.ts:169-193; tests presets.test.ts:3756+), 017 dead-letter minimisation + 30/90 day prune + 30 day event prune (notification-service.ts `toDeadLetterRecord`, `pruneFailedNotifications`; rate-limit-service.ts:156-174; tests notification-service-deadletter.test.ts, rate-limit-service-events.test.ts:107), 018 cache purge after delete (preview-image-service.ts:156-192, :269-277; tests preview-image-service.test.ts:90+). Ban check fail-closed 503 (ban-check.ts:87-110; tests ban-check.test.ts:201-240) on every mutating route via router-level `on([POST,PATCH,DELETE])` (presets.ts:128, votes.ts:185).
- D1 access is `.prepare().bind()` everywhere; the only interpolated SQL is the fixed `whereClause`/`orderBy` built from constants (preset-service.ts:237-289); LIKE wildcards escaped (:32-34). `previous_values`/`content_revision`/`preview_image_key` never serialised to public callers (rowToPreset gate :117-123; `stripAuditData`).
- R2 key is server-built from a DB-verified preset id + `crypto.randomUUID()` (preview-image-service.ts:243); the moderation key is regex-checked and matched against the DB row before any delete.
- Upload gates: declared size, stream cap, 5 MB recheck, magic-byte sniff (not Content-Type), image-worker validates dimensions/pixel count and re-encodes to WebP (drops EXIF) (image-worker index.ts:185-216).
- Error handler hides message/stack outside development (index.ts:~267-284). Logger records method + pathname only, UA off (index.ts:36-43); nonce/secret never logged (auth.ts:172-230); dead-letter prune logs counts only.
- Outbound fetch targets are fixed: Perspective URL constant with 5 s timeout, Cloudflare purge URL with encoded zone id and 5 s timeout, image-worker/discord-worker through bindings (outbound-fetch.txt, presets-api rows).
- Secrets are secrets, not `[vars]` (wrangler.toml:88-100); `.dev.vars*` ignored by .gitignore.
- Tag charset is narrow (validation-service.ts:132) plus control/invisible character rules for name/description (:62-123); example link is https + host allowlist (:367-419).
- Notification fan-out is capped per user: submissions 10/day, flagged edits 10/day, text edits 30/day, uploads 20/day (rate-limit-service.ts:24-45), reserve-then-act with deterministic tie-break.

## 3. Rejected items

- Refresh-token confusion at JWT verify (no `expectedType`): oauth mints a single token type (grep of apps/oauth/src: only `createJWTForUser`); nothing to confuse.
- Dev worker bound to production D1/R2/discord-worker (wrangler.toml:21-37): unreachable (no routes, `workers_dev=false`, guarded by wrangler-config test); LOCAL only via `wrangler dev --remote`.
- `ADDITIONAL_CORS_ORIGINS` includes `xiv-colorexplorer.pages.dev` and `beta.xivdyetools.app` with `credentials: true`: auth is Bearer header, not cookies; exact-match list; no cross-origin credential to steal.
- Dead-letter `error` column storing upstream body text on 4xx (notification-service.ts ~`Discord worker returned ${status}: ${text}`): discord-worker's 4xx bodies are static strings (discord-worker index.ts:257-330), no payload echo.
- SQL injection via `category`/`sort`/`search`: bound or switch-mapped; LIKE escaped.
- Pending preview objects readable by key: previously accepted design (2026-09-15 rejected list); gating is URL advertisement.
- KV nonce check fail-open: accepted trade-off (auth.ts:200-230 documents it).
- Per-IP limiter skipped without `CF-Connecting-IP`: only service-binding callers lack it; there is no workers.dev or other direct route.
- `Cache-Control: public, s-maxage` on categories with Vary Origin: public data, Cloudflare ignores Vary for Worker responses; no confidentiality impact.
- JWT `username`/`global_name` stored as `author_name`: disclosed in apps/web-app/PRIVACY.md section 3 and the bot policy (Discord Username: attribute preset submissions).
- Moderation `history`/`stats` returning raw ids: moderator-only.
- Cascade of `moderation_log` on preset delete: FK `ON DELETE CASCADE` (schema.sql:138-148); user-level rows (ban/unban) have NULL preset_id and are kept by design.

## 4. Files covered

apps/presets-api: wrangler.toml, schema.sql, migrations/0005, 0009, 0011, 0012, 0013 (header), 0014; src/index.ts; src/types.ts; src/handlers/{presets,moderation,votes,categories}.ts; src/middleware/{auth,body-validation,rate-limit,ban-check}.ts; src/services/{preset-service,preview-image-service,moderation-service,validation-service,rate-limit-service,notification-service,category-service}.ts; src/utils/env-validation.ts; src/utils/api-response.ts (error shapes); src/data/profanity/*.ts; tests/wrangler-config.test.ts, tests/handlers/{preview,owner,moderation}-revision.test.ts (read), tests/sqlite-d1.ts (head); other tests grepped for guard presence only (moderation-service, notification-service-deadletter, preview-image-service, ban-check, presets, rate-limit-service-events).
Cross-unit (read for context): apps/image-worker/src/index.ts:175-216, photon.ts:235-262; apps/discord-worker/src/index.ts:250-330; packages/auth/src/jwt.ts:200-260; packages/worker-kit/src/body-guards/body-guards.ts; packages/worker-kit/src/middleware/logger.ts; apps/web-app/PRIVACY.md; apps/discord-worker/PRIVACY_POLICY.md (claims via policy-claims.txt); DEPRECATIONS.md:8-50; evidence pii-sinks/pii-sources/outbound-fetch (presets-api rows).

## 5. Candidates

| cid | sev | exposure | path:line | claim |
|---|---|---|---|---|
| c1 | MEDIUM | INTERNET-AUTH | apps/presets-api/src/data/profanity/en.ts:8-15; src/services/moderation-service.ts:248-250; src/handlers/presets.ts:949-950; DEPRECATIONS.md:30-44 | The local word lists contain only anti-"AI slop" phrases (zero profanity or slurs, all 6 languages). The documented "supported degradation" for Perspective's 2026-12-31 shutdown (delete the key) therefore turns moderation into a no-op: every submission and text edit auto-approves and is published to the gallery and Discord embeds. |
| c2 | LOW | INTERNET-AUTH | apps/presets-api/src/handlers/presets.ts:1211-1216, :1311-1315, :428-436 | Preview-image writes are unconditional `WHERE id = ?` (no compare on the old key, `meta.changes` ignored). An owner racing POST preview-image against DELETE preset / DELETE preview-image leaves an R2 object (publicly readable on shots.xivdyetools.app) that no row references: never reviewed, and the moderator route 404s on a missing preset, so nothing deletes it. |
| c3 | MEDIUM | INTERNET-UNAUTH | apps/web-app/PRIVACY.md:16-18 and :158 vs apps/presets-api/src/handlers/presets.ts:1077-1260, apps/web-app/src/services/preset-submission-service.ts:236 | The privacy document promises images "never leave your device" and "you will see no image upload", but the web app uploads the author's chosen preset preview image to presets-api -> image-worker -> R2, where it is held and publicly addressable (pending by key, approved by URL). The doc mentions only that preview images are "served from" the CDN. |
| c4 | LOW | INTERNET-UNAUTH | apps/presets-api/schema.sql:161-172 (banned_users), :138-148 (moderation_log), :215-224 (submission_events); apps/web-app/PRIVACY.md:67-75 | The governing documents are silent on records the code keeps: ban records (Discord id, username at ban time, free-text reason, moderator id; never pruned), moderation-log reasons, daily activity counters and dead letters. The bot policy lists counters/dead letters/"Moderation history" (PRIVACY_POLICY.md:104,176-177) with no retention line for ban or moderation records; the web document covers none. Dedupe with the moderation-worker review (it writes bans). |
| c5 | LOW | INTERNET-AUTH | apps/presets-api/src/services/validation-service.ts:401-419, :426-431 | `example_link` is validated through `new URL()` (which strips tab/newline and percent-encodes) but the RAW string is stored (`normalizeExampleLink` only trims). Probe: `https://x.com/a\n[b](https://evil.example)` and bidi-override characters are accepted and stored verbatim. Only the web app sanitises on read (`sanitizeExampleLink`); any future bot/API consumer rendering the field gets markdown or direction-spoofing injection. Fix: store `url.href` or reject control/invisible characters. |
| c6 | INFO | INTERNET-AUTH | apps/presets-api/migrations/0014_add_content_revision.sql:5-19; schema.sql:64-78; tests/handlers/*-revision.test.ts | FINDING-004/005 only work if the production database really has the `presets_content_revision_after_update` trigger (hand-run migration). Tests build the DB from schema.sql only; nothing asserts migration 0014 equals the schema trigger, and no runtime check detects a missing trigger (content_revision would stay 0 and every stale write would pass). Missing guard test. |
| c7 | INFO | INTERNET-AUTH | apps/presets-api/src/handlers/presets.ts:225-258, :279-298, :866-887 | Viewer-specific responses (`/mine`, `/:id` with `author_discord_id`/`is_owner`/`previous_values`, listing for moderators) set no `Cache-Control: private/no-store` and no `Vary: Authorization`. Worker responses are uncached today, but a future zone Cache Rule would serve a moderator's variant to anonymous callers. The 2026-09-15 report's "user-specific responses use no-store" does not hold for this unit. |
| c8 | INFO | INTERNET-AUTH | apps/presets-api/src/handlers/moderation.ts:263-340 | Moderator preview-image approve/reject writes no `moderation_log` row, although presets.ts:1266-1267 says the reject action "belongs in the moderation log". Image takedowns are unaudited (CWE-778). |

Policy fields for the table above (for structured output): c3 policy CORRECT, reconcile_case 3, apps/web-app/PRIVACY.md §Images and camera captures + §How to verify (six-file edit). c4 policy AMEND, reconcile_case 2 (minimise first: `banned_users.username` is not needed to enforce a ban), apps/discord-worker/PRIVACY_POLICY.md §8 Data Retention + apps/web-app/PRIVACY.md §3. Others policy NONE, reconcile_case 0.

## 6. Handoffs (non-security)

- `GET /api/v1/presets?search=` has no length cap; D1 limits LIKE patterns (documented ~50 bytes), so a long term probably returns a 500 (preset-service.ts:250-255). Cap at the handler. Untested locally.
- `page` has no upper bound (presets.ts:246); an absurd value yields a huge OFFSET bind and probably a D1 datatype error (500). Clamp.
- `POST /presets` and `PATCH /presets/:id` do `body.name` on a JSON `null` body -> TypeError -> generic 500 (presets.ts:924-931, :559-575); moderation status route likewise (moderation.ts:105-111). Return 400.
- DEPRECATIONS.md says deleting the Perspective key is the "supported degradation" but does not say the local list is empty (see c1); update the checklist, and remove the Perspective mention from both privacy documents when the tier is removed (six-file edits).
- `PATCH /presets/refresh-author` changes `author_name`, which the revision trigger counts, so a login-time refresh can 409 an in-flight owner edit (migrations/0014:7-12).
- Dead-letter and `submission_events` pruning ride requests (no cron); fine today, but a documentation note belongs in docs/operations.
