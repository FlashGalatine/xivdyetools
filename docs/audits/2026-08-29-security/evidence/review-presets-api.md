# Manual security review — `apps/presets-api` (community presets REST API)

- **Audit:** 2026-08-29 whole-monorepo security audit (see `REVIEWER_BRIEF.md`)
- **Unit:** `apps/presets-api` 2.1.0 — Cloudflare Worker (Hono 4.13.4) + D1 `xivdyetools-presets` + R2 `THUMBNAILS` (`shots.xivdyetools.app`) + KV `TOKEN_BLACKLIST` (oauth's) + native `RL_PUBLIC` + service bindings `DISCORD_WORKER`, `IMAGE_WORKER`; public at `api.xivdyetools.app` (production env only). Reviewed at `4c213248` (= `main`).
- **Reviewer:** Claude Code (Fable 5), read-only. This file is the only file written.
- **Method:** every non-test file under `src/`, `wrangler.toml`, `package.json`, `schema.sql`, `migrations/0011`, `scripts/migrate-dyes-to-stainids.ts` read in full; the delta `b195723f..HEAD` (11 commits: seven 2026-08-21 fix commits, two Dependabot bumps, one docs/script commit, one merge) diffed; the trust-boundary peers (`@xivdyetools/auth` hmac/jwt/revocation, `@xivdyetools/worker-kit` limiter/logger, image-worker `/thumbnail`, both bots' `preset-api.ts` clients, discord-worker `/webhooks/preset-submission`, oauth claim minting) read at the lines cited; both privacy policies and `docs/operations/POST_MERGE_CHECKLIST.md` §1/§3/§5 read. The unit's vitest suite was run unmodified in the main checkout at the same commit: **24 files, 679 passed, 4 skipped**.
- **Previous audit:** `docs/audits/2026-08-21-security/evidence/review-presets-api.md` (PAPI-1..18). Each FINDING that touches this unit is re-verified below (Positive controls); regressions/gaps are cross-linked.

## Summary

No CRITICAL/HIGH. The 2026-08-21 fixes are real, tested and not regressed (revocation + issuer pin, native rate limit, streamed 5 MB cap + pre-decode dimension gate, append-only quotas, v2 signature, 404-visibility rule, router-level fail-closed ban check, edge purge, charset rules). Two MEDIUMs are **gaps in the FINDING-008 / PAPI-16 remediation**: (1) an edit to a *non-approved* preset re-notifies the moderation channel without touching any per-user cap, so the fan-out FINDING-008 closed survives on one leg; (2) `moderateContent` runs before the flagged-edit cap and Perspective fails open, so an author can push the Perspective quota (or simply race) and have toxic text auto-approved. Two further MEDIUMs are Personal-data rubric items (undisclosed Perspective flow with `doNotStore` unset; User-Agent on every request log). The v1 bot-HMAC rollover gate (§3) is now met and v1 is still accepted, which voids FINDING-014's method/path/body binding for anyone who can drop a header. The identity backfill added **no new identity columns** — `author_discord_id` / `author_name` remain the only identity fields; `avatar` rides in the JWT but is never persisted or served.

| ID | Sev | Exposure | Title |
|---|---|---|---|
| PAPI-01 | MEDIUM | INTERNET-AUTH | FINDING-008 gap: edits to a pending/rejected/flagged preset re-notify moderators with no per-user cap |
| PAPI-02 | MEDIUM | INTERNET-AUTH | PAPI-16 promoted: Perspective fail-open is attacker-triggerable (uncapped calls on PATCH) → moderation bypass |
| PAPI-03 | MEDIUM (rubric) | INTERNET-AUTH | Preset text sent to Google Perspective with `doNotStore` unset; web privacy guide claims completeness and omits it; key in query string |
| PAPI-04 | MEDIUM (rubric) | INTERNET-UNAUTH | Request log carries User-Agent on every request; client IP logged on limiter backend error |
| PAPI-05 | LOW | INTERNET-UNAUTH | PAPI-14 promoted: `author_discord_id` served on every public preset; policy lists storage/attribution, not publication |
| PAPI-06 | LOW | INTERNET-AUTH | Personal data outlives the user's delete: `failed_notifications.payload` and `submission_events` are never pruned |
| PAPI-07 | LOW | INTERNAL | v1 bot HMAC still accepted after the §3 gate was met — header-strip downgrade restores 5-min any-route replay (FINDING-014) |
| PAPI-08 | LOW | INTERNET-AUTH | FINDING-002/015 controls are config-gated and `validateEnv` does not require `JWT_ISSUER` / `TOKEN_BLACKLIST` / `JWT_SECRET` in production |
| PAPI-09 | INFO | INTERNET-UNAUTH | `search` unbounded (3× LIKE), `page` unbounded (→ 500) — PAPI-17 unchanged |
| PAPI-10 | INFO | — | Unpublished preset names logged on notification failure; ~32 `console.*` sites bypass the redacting logger |
| PAPI-11 | INFO | — | Unchanged 2026-08-21 INFO items re-verified (PAPI-12/13/14/15/16/17/18, PAPI-8 residual) — none promoted beyond the above |

---

## Route / command table + authz matrix

Global middleware order (`src/index.ts:48-204`): `requestIdMiddleware` → `loggerMiddleware` (**logs UA**) → env validation (prod: 500 on every request if misconfigured) → security headers (`nosniff`, `X-Frame-Options: DENY`, HSTS in prod) → `cors()` (exact-match `CORS_ORIGIN` + `ADDITIONAL_CORS_ORIGINS`; loopback only when `ENVIRONMENT === 'development'`; preflight 204 answered here) → `/api/*` `RL_PUBLIC` 100/60 s per `CF-Connecting-IP` (`'unknown'` for service-binding traffic; memory limiter only if the binding is absent) → `/api/*` `bodyLimit` 100 KB (5 MB streamed for `POST …/preview-image`) → `/api/*` JSON depth ≤ 10 + `__proto__`/`constructor`/`prototype` reject → `authMiddleware` (`*`) → `/api/*` Content-Type gate. Router-level `requireNotBanned` on `POST|PATCH|DELETE *` of `presetsRouter` (`handlers/presets.ts:100`) and `POST|DELETE *` of `votesRouter` (`handlers/votes.ts:22`), fail-closed 503 except `development`.

Auth types: **public**; **JWT** (web: HS256, `exp`/`sub` typed, `iss` = `JWT_ISSUER` when set, `jti` checked against `TOKEN_BLACKLIST` when bound; identity = `discord_id` claim else `sub`); **bot-HMAC** (bearer `BOT_API_SECRET` constant-time **plus** `X-Request-Signature-V2` (method+path+body-hash+ts+nonce+identity, 60 s) or, when that header is absent, v1 `X-Request-Signature` (ts:id:name, 5 min); identity = signed `X-User-Discord-ID`); **moderator** = `MODERATOR_IDS` contains the resolved id (either source).

| Method | Path | Auth | Ownership / visibility | Rate limit | Body cap | Ban check | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/` | public | — | none (outside `/api`) | — | — | echoes `ENVIRONMENT` (PAPI-11) |
| GET | `/health` | public | — | none | — | — | |
| GET | `/__force-error` | public | — | none | — | — | 404 in production |
| GET | `/api/v1/presets` | public; `status≠approved` → moderator (400 on unknown status) | `hidden` never listable; `previous_values` stripped for non-moderators | IP 100/min | — | — | `search`/`page` unbounded (PAPI-09); `author_discord_id` public (PAPI-05) |
| GET | `/api/v1/presets/featured` | public | approved only | IP | — | — | |
| GET | `/api/v1/presets/mine` | JWT/bot + user ctx | own rows, all statuses, `rejection_reason` | IP | — | — | |
| GET | `/api/v1/presets/rate-limit` | JWT/bot + user ctx | self | IP | — | — | |
| PATCH | `/api/v1/presets/refresh-author` | JWT/bot + user ctx | `WHERE author_discord_id = ?` | IP | 100 KB (empty body allowed) | yes | binds `auth.userName` unvalidated |
| DELETE | `/api/v1/presets/:id` | JWT/bot + user ctx | `canSeePreset` → 404; owner **or** moderator | IP | — | yes | moderator delete writes no `moderation_log` row (PAPI-11) |
| PATCH | `/api/v1/presets/:id` | JWT/bot + user ctx | `canSeePreset` → 404; owner only; `hidden` → 403 | IP; flagged-edit 10/day **only when this edit trips moderation** | 100 KB | yes | **PAPI-01 / PAPI-02**; status write unconditional (PAPI-11) |
| GET | `/api/v1/presets/:id` | public | `canSeePreset` → 404; `previous_values` privileged-only | IP | — | — | |
| POST | `/api/v1/presets` | JWT/bot + user ctx | — | IP; 10/day = max(rows, events) + post-insert recount | 100 KB | yes | duplicate path: vote only on approved, bare 409 for others' pending |
| POST | `/api/v1/presets/:id/preview-image` | JWT/bot + user ctx | `canSeePreset` → 404; owner only | IP; 20 uploads/day (checked **before** body read) | 5 MB streamed + magic sniff | yes | → image-worker `/thumbnail` (10 MB cap, header dimension gate) → R2 `{presetId}/{uuid}.webp` |
| DELETE | `/api/v1/presets/:id/preview-image` | JWT/bot + user ctx | `canSeePreset` → 404; owner only | IP | — | yes | delete + purge |
| POST | `/api/v1/votes/:presetId` | JWT/bot + user ctx | preset must be `approved` (404 otherwise) | IP | 100 KB | yes | |
| DELETE | `/api/v1/votes/:presetId` | JWT/bot + user ctx | approved gate; own vote | IP | — | yes | |
| GET | `/api/v1/votes/:presetId/check` | JWT/bot + user ctx | own vote | IP | — | — | |
| GET | `/api/v1/categories`, `/:id` | public | — | IP | — | — | `Cache-Control: public, s-maxage=60` |
| GET | `/api/v1/moderation/pending` | moderator | — | IP | — | — | unbounded (PAPI-11); carries `pending_preview_image_url` |
| PATCH | `/api/v1/moderation/:presetId/status` | moderator | conditional on observed status + batched log (409 on race) | IP | 100 KB | — | `reason` type/length unvalidated (PAPI-11) |
| PATCH | `/api/v1/moderation/:presetId/revert` | moderator | unconditional; forces `approved` | IP | 100 KB | — | PAPI-11 |
| PATCH | `/api/v1/moderation/:presetId/preview-image` | moderator | — | IP | 100 KB | — | no `moderation_log` row (PAPI-11) |
| GET | `/api/v1/moderation/:presetId/history` | moderator | — | IP | — | — | |
| GET | `/api/v1/moderation/stats` | moderator | — | IP | — | — | |
| GET | `/api/v1/moderation/failed-notifications` | moderator | — | IP | — | — | raw `payload` incl. author id/name/content (PAPI-06) |
| PATCH | `/api/v1/moderation/failed-notifications/:id/resolve` | moderator | — | IP | 100 KB | — | |
| OPTIONS | any | `cors()` 204 before rate limit / auth | — | — | — | — | |

Outbound: `DISCORD_WORKER` binding `POST /webhooks/preset-submission` (bearer `INTERNAL_WEBHOOK_SECRET`; payload = full preset incl. `author_discord_id`, `author_name`, name, description, tags, dyes, `source`); `IMAGE_WORKER` binding `POST /thumbnail` (raw bytes); `https://commentanalyzer.googleapis.com` (name + description, key in query); `https://api.cloudflare.com/client/v4/zones/<zone>/purge_cache` (bearer `CACHE_PURGE_API_TOKEN`, 5 s timeout). The dead `notifyModerators` path (`MODERATION_WEBHOOK_URL` / Discord API) has no caller.

**Identity data map (Personal-data row).** D1: `presets.author_discord_id` + `author_name` (public via every preset response), `votes.user_discord_id`, `moderation_log.moderator_discord_id` + `reason`, `submission_events.user_discord_id` (never pruned), `failed_notifications.payload` (id + name + content, never pruned), `banned_users.*` (written by moderation-worker). R2: author screenshots re-encoded to WebP (documented, `PRIVACY.md:45`). Logs: method/path/UA/status per request, IP on limiter error, preset names on notification failure. Third party: Google Perspective ← name + description. Analytics: **none** (no `writeDataPoint` in this unit). The 2026-08-28 identity backfill (`POST_MERGE_CHECKLIST.md:150-170`) only re-keyed `author_discord_id` / `user_discord_id` from oauth UUIDs to Discord snowflakes — no username/avatar column exists; the JWT `avatar` claim (`middleware/auth.ts:44`) is never read.

---

## Candidates

### PAPI-01 — FINDING-008 gap: edits to a non-approved preset re-notify moderators with no per-user cap
- **Severity:** MEDIUM — **Exposure:** INTERNET-AUTH (any Discord/XIVAuth login) — **Rotation:** none
- **CWE:** CWE-770 / CWE-799 (cross-link FINDING-008, previous PAPI-1)
- **Where:** `apps/presets-api/src/handlers/presets.ts:482-483, 489, 523-537, 544-550, 580-586, 591-609`; fan-out target `apps/discord-worker/src/index.ts:316-350` (`preset.status === 'pending'` → `sendModerationNotification` to `MODERATION_CHANNEL_ID` with approve/reject buttons); the only guard is `RL_PUBLIC` 100/min/IP.
- **Excerpt:**
  ```ts
  let moderationStatus: 'approved' | 'pending' = preset.status === 'approved' ? 'approved' : 'pending';   // :482-483
  if (body.name || body.description) { … if (!moderationResult.passed) { flaggedByThisEdit = true; … } }  // :489-514
  if (flaggedByThisEdit) { const cap = await checkDailyEventLimit(c.env.DB, auth.userDiscordId, 'flagged_edit'); … } // :523
  updatedPreset = await updatePreset(c.env.DB, id, body, previousValues, moderationStatus);              // :544-550
  if (flaggedByThisEdit) { … recordSubmissionEvent(…, 'flagged_edit', id) }                                // :580
  if (moderationStatus === 'pending') { c.executionCtx.waitUntil(notifyDiscordBot(c.env, editPayload) …) } // :591-609
  ```
- **Trigger:** owner of any preset whose status is `pending` / `rejected` / `flagged` (one profane submission yields one) sends `PATCH /api/v1/presets/<id>` with a body that omits `name`/`description` — e.g. `{"tags":["a"]}`, `{"example_link":""}`, `{"category_id":"jobs"}` — or a clean name edit on a still-pending preset. `moderationStatus` is `'pending'` purely because the row was not `approved`, `flaggedByThisEdit` stays `false`, so no cap is consulted and no `submission_events` row is written, yet `notifyDiscordBot` fires with `moderation_status: 'flagged'`. Repeat at the IP limiter's rate. Side effect: a moderator-**rejected** preset is flipped back to `pending` on every such edit (`updatePreset(…, 'pending')`), re-entering the queue with the rejected text unchanged.
- **Impact:** the moderation-embed fan-out FINDING-008 was written to close (~100 embeds/min per IP, Discord 429s → retries → `failed_notifications` growth, queue churn) survives on this leg; the guarding tests only use `status: 'approved'` fixtures (`tests/handlers/presets-quotas.test.ts:100-101`), so the gap is untested.
- **Fix:** gate the notification, not the moderation result — check and record the `flagged_edit` cap whenever `moderationStatus === 'pending'` (or a new `edit_notification` kind); do not re-queue a `rejected` preset unless name/description/dyes actually changed; add a `status: 'pending'` fixture test asserting 429 + no notification at the cap.
- **Confidence:** CONFIRMED (full path traced; discord-worker branch read).

### PAPI-02 — Perspective fail-open is attacker-triggerable: uncapped moderation calls on PATCH → toxic text auto-approved
- **Severity:** MEDIUM — **Exposure:** INTERNET-AUTH — **Rotation:** none
- **CWE:** CWE-636 (Not Failing Securely), CWE-770 (cross-link previous PAPI-16 INFO → promoted; FINDING-008)
- **Where:** `apps/presets-api/src/services/moderation-service.ts:214-216, 236, 240-243, 277-280, 296-316`; `apps/presets-api/src/handlers/presets.ts:489-498` (moderation runs **before** the cap at `:523`; `POST /` is capped at 10/day at `:664`, `PATCH` is not); fallback list `apps/presets-api/src/data/profanity/en.ts:14` (one entry).
- **Excerpt:**
  ```ts
  if (!response.ok) { console.error('Perspective API error:', response.status, await response.text()); return null; } // Don't block on API failure   :240-243
  } catch (error) { console.error('Perspective API error:', error); return null; }                                    // :277-280
  const perspectiveResult = await checkWithPerspective(`${name} ${description}`, env);                                // :302
  if (perspectiveResult && !perspectiveResult.passed) return perspectiveResult;
  return { passed: true, method: perspectiveResult ? 'all' : 'local', … };                                            // :312-316
  ```
- **Trigger:** owner of an approved preset fires ~100 concurrent `PATCH /api/v1/presets/<id>` with `{"name":"<slur or harassment>"}`. Perspective's default project quota is 1 QPS; the overflow gets HTTP 429 → `!response.ok` → `null` → `moderateContent` passes on the local lists (`'ai slop'` + five 15-line lists) → `moderationStatus` stays `'approved'` → the toxic name is live and **no notification is sent** (`:591`). Retry in bursts until the last write is an approved one (the response's `moderation_status` tells the attacker which). A 5 s Google slowdown (`AbortSignal.timeout(5000)`, `:236`) has the same effect without any effort.
- **Impact:** content-moderation bypass on the public gallery and on bot cards; every PATCH with `name`/`description` also burns one Perspective call for the whole project (the daily cap only counts edits that were *already* flagged).
- **Fix:** when `PERSPECTIVE_API_KEY` is configured and the call fails/times out/429s, return `passed: false` (fail **to review**, i.e. `pending`) instead of `null`; count moderation checks per user per day *before* calling (`checkDailyEventLimit(…, 'flagged_edit')` pre-call, or a `moderation_check` event kind); send the key via `X-Goog-Api-Key` rather than `?key=` (PAPI-16 residual). Test: Perspective mock returning 429 must yield `pending`.
- **Confidence:** CONFIRMED for the code path; PLAUSIBLE for the exact Google quota number (documented default, not exercised).

### PAPI-03 — Preset text sent to Google Perspective with `doNotStore` unset; not disclosed in the web privacy guide; key in the URL
- **Severity:** MEDIUM per the brief's Personal-data rubric (undisclosed third-party flow of user free text); practical sensitivity low (the text is content the user is publishing) — **Exposure:** INTERNET-AUTH — **Rotation:** none (the key never left the request line; but see fix)
- **CWE:** CWE-359 (Privacy Violation), CWE-598 (sensitive data in query string)
- **Where:** `apps/presets-api/src/services/moderation-service.ts:221-237` (request), `:302-305` (text = `${name} ${description}`); governing promises `apps/web-app/PRIVACY.md:8-9` ("Nothing you … type is sent anywhere unless a section below says so, and the sections below are the complete list"), `:35-36` ("plus the one third party named below" — Universalis only), `:42-46` (community-presets item, no mention of Google); the bot policy does list Perspective (`apps/discord-worker/PRIVACY_POLICY.md:110`).
- **Excerpt:**
  ```ts
  const response = await fetch(
    `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${env.PERSPECTIVE_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: { text }, requestedAttributes: { TOXICITY: {}, … } }),   // no doNotStore
      signal: AbortSignal.timeout(5000) });
  ```
- **Trigger:** every web `POST /api/v1/presets` and every `PATCH` with `name`/`description` (also flagged-edit and pending-edit paths). Fields sent: name + description only (no id, no IP — Google sees the Worker egress). Without `doNotStore: true` the Perspective API is permitted to retain the comment for research/model building (API default).
- **Impact:** a web user's typed text reaches a third party the web guide says does not exist; retention by Google is not opted out.
- **Fix:** `doNotStore: true` in the request body; one sentence in `PRIVACY.md` item 3 ("preset names and descriptions are checked by Google's Perspective API before publication"); key via `X-Goog-Api-Key` header.
- **Confidence:** CONFIRMED.

### PAPI-04 — Request log carries the User-Agent on every request; client IP logged on limiter backend errors
- **Severity:** MEDIUM per the Personal-data rubric (UA / IP in a log not listed by any policy); practical risk low (Workers Logs, days of retention) — **Exposure:** INTERNET-UNAUTH — **Rotation:** none
- **CWE:** CWE-532 (Insertion of Sensitive Information into Log File)
- **Where:** `apps/presets-api/src/index.ts:49-53` (`logUserAgent: true`) → `packages/worker-kit/src/middleware/logger.ts:142-145`; `packages/worker-kit/src/middleware/rate-limit.ts:144-150` (`logger.warn('Rate limiter backend error', { onError, key, … })` where `key` = `public:ip:<CF-Connecting-IP>` from `apps/presets-api/src/middleware/rate-limit.ts:43, 57`). Governing text: neither policy mentions server request logs; `apps/discord-worker/PRIVACY_POLICY.md:54` promises IPs are not collected; `apps/web-app/PRIVACY.md:78-79` promises no UA/IP — scoped to analytics, but nothing discloses the request log.
- **Excerpt:**
  ```ts
  app.use('*', loggerMiddleware({ serviceName: 'xivdyetools-presets-api', readApiVersionFromEnv: true, logUserAgent: true }));
  // worker-kit logger.ts:142-145
  if (logUserAgent) { startContext.userAgent = c.req.header('user-agent'); }
  logger.info('Request started', startContext);
  ```
- **Trigger:** any request (UA); any `RL_PUBLIC.limit()` throw (IP).
- **Fix:** `logUserAgent: false` (or a coarse browser-family bucket); in worker-kit log a truncated hash of `key`; add a "server request logs (method, path, status; retained N days by Cloudflare)" line to both policies.
- **Confidence:** CONFIRMED.

### PAPI-05 — `author_discord_id` is served on every public preset (previous PAPI-14, promoted under the Personal-data row)
- **Severity:** LOW — **Exposure:** INTERNET-UNAUTH — **Rotation:** none
- **CWE:** CWE-359 / CWE-200
- **Where:** `apps/presets-api/src/services/preset-service.ts:106` (`author_discord_id: row.author_discord_id`), `apps/presets-api/src/handlers/presets.ts:89-93` (`stripAuditData` removes only `previous_values`), `:219-223` (list), `:230-234` (featured), `:640-643` (detail). Consumers of the field: web-app `apps/web-app/src/components/preset-edit-form.ts:111` (owner gate — the owner is privileged anyway), discord-worker `apps/discord-worker/src/handlers/commands/preset.ts:777` (bot calls as the acting user → owner/moderator already get it), moderation-worker reads D1 directly. Policy: `apps/web-app/PRIVACY.md:43-45` says the identity is *stored* and the author *name* is shown; the bot policy lists the ID for attribution/voting — neither lists serving it to anonymous callers.
- **Trigger:** anonymous `GET /api/v1/presets?limit=50&page=N` pages the whole table → preset ↔ Discord user id for every published author (and `/featured`, `/:id`).
- **Impact:** cross-referencing / targeted contact of authors from an unauthenticated endpoint; the web gallery never displays the id, so nothing public needs it.
- **Fix:** null `author_discord_id` in the non-privileged branches (extend `stripAuditData`), keep it for owner/moderator responses (or add `is_owner`); update the web-app edit gate accordingly. Document if it is to stay public.
- **Confidence:** CONFIRMED.

### PAPI-06 — Personal data outlives the user's delete: dead-letter payloads and quota events are never pruned
- **Severity:** LOW — **Exposure:** INTERNET-AUTH (moderator-readable; author-triggered) — **Rotation:** none
- **CWE:** CWE-359, CWE-459 (Incomplete Cleanup); previous PAPI-17 ("never pruned") re-scoped as personal data
- **Where:** `apps/presets-api/src/services/notification-service.ts:156-172` (payload = the whole notification: id, name, description, tags, dyes, `author_name`, `author_discord_id`, `source`), `:184-190` (moderator listing incl. `include_resolved`); `apps/presets-api/src/handlers/presets.ts:369-372` (owner delete removes only `votes` + `presets`); `apps/presets-api/src/services/rate-limit-service.ts:80-89, 105-117` (only "today" is ever counted; rows kept forever); no `DELETE` on either table anywhere in the monorepo (`git ls-files … | xargs grep -n submission_events` — presets-api only; `DELETE FROM` sites: `presets.ts:370-371, 758-759`, `votes.ts:112`). Retention table `apps/discord-worker/PRIVACY_POLICY.md:139-151` has no line for either; "Votes — until removed" implies user deletion is honoured.
- **Trigger:** a notification exhausts retries (Discord 429/5xx, discord-worker 502 per BUG-074) → payload persisted; the author later deletes the preset → `GET /api/v1/moderation/failed-notifications?include_resolved=true` still lists their id + display name + the (possibly flagged) text; `submission_events` keeps `(user_discord_id, kind, preset_id)` indefinitely.
- **Fix:** cron trigger pruning `submission_events` older than 48 h and resolved dead-letters older than 30 days; on preset delete, `DELETE FROM failed_notifications WHERE json_extract(payload, '$.preset.id') = ?`; add retention lines to the policy.
- **Confidence:** CONFIRMED.

### PAPI-07 — v1 bot HMAC still accepted after the §3 rollover gate was met; header-strip downgrade restores any-route replay
- **Severity:** LOW — **Exposure:** INTERNAL (needs a captured bot request; external callers cannot forge either scheme) — **Rotation:** none required unless a capture is suspected (then `BOT_SIGNING_SECRET`)
- **CWE:** CWE-294 (capture-replay), CWE-757 (algorithm downgrade); cross-link FINDING-014 / previous PAPI-7
- **Where:** `apps/presets-api/src/middleware/auth.ts:228-239` (v1 branch taken whenever `X-Request-Signature-V2` is absent), `:241-247` (only failures are logged); both bots send **both** headers on every request: `apps/discord-worker/src/services/preset-api.ts:147-148, 152-160`, `apps/moderation-worker/src/services/preset-api.ts:146-147, 151-159`; gate `docs/operations/POST_MERGE_CHECKLIST.md:367` ("both bots **and** presets-api production deploys carry the v2 code") — met by the 2026-08-28 deploys from `main`; its "tail shows only v2 verifications" clause is unobservable because successful verifications are never logged, so read the gate from code + deploy dates. v1 window `packages/auth/src/hmac.ts:245` (5 min + 1 min skew).
- **Excerpt:**
  ```ts
  } else {
    // v1 (timestamp:userId:userName) — kept for rollover; both bots send v2
    // as of 2026-08-21 and v1 is slated for removal once they are deployed.
    isValidSignature = await verifyBotSignature(signature, timestamp, userDiscordId, userName, c.env.BOT_SIGNING_SECRET);
  }
  ```
- **Trigger:** whoever holds one signed bot request (service-binding traffic, a bot-side debug log, or `BOT_API_SECRET` plus any capture) drops `X-Request-Signature-V2` / `X-Request-Nonce` and replays `X-Request-Signature` + `X-Request-Timestamp` + `X-User-Discord-ID/-Name` against **any** route as that user for 5 minutes — e.g. a captured moderator `GET /moderation/pending` becomes `PATCH /moderation/<id>/status {"status":"approved"}`. The v2 nonce is bound but not cached (`hmac.ts:360-362`, `auth.ts:222`) — recorded residual, `POST_MERGE_CHECKLIST.md:402-404`, not re-filed.
- **Impact:** FINDING-014's method/path/body binding provides no protection while v1 is accepted; every bot request currently carries a valid v1 tuple.
- **Fix:** delete the v1 branch (absent v2 header ⇒ unauthenticated), drop the v1 header from both bots, replace `tests/middleware/auth-v2.test.ts:106` ("still accepts a v1-only request") with "rejects a v1-only request"; deprecate `verifyBotSignature` in `@xivdyetools/auth` (checklist §3 row).
- **Confidence:** CONFIRMED.

### PAPI-08 — Revocation and issuer pinning are config-gated and not required by production env validation
- **Severity:** LOW — **Exposure:** INTERNET-AUTH — **Rotation:** none
- **CWE:** CWE-1188 (Insecure Default Initialization); cross-link FINDING-002 / FINDING-015
- **Where:** `apps/presets-api/src/middleware/auth.ts:95-97` (`issuer: env.JWT_ISSUER || undefined`), `:101-104` (`if (payload.jti && env.TOKEN_BLACKLIST)`); `apps/presets-api/src/utils/env-validation.ts:34-40` (required: `ENVIRONMENT, API_VERSION, CORS_ORIGIN, BOT_API_SECRET, MODERATOR_IDS`), `:86-90` (only `BOT_SIGNING_SECRET` is production-required). `JWT_SECRET` absent → all web auth silently 401 (fail-safe direction), but `JWT_ISSUER` / `TOKEN_BLACKLIST` absent → checks silently skipped.
- **Trigger:** a `wrangler.toml` edit or fresh environment that omits the `JWT_ISSUER` var (`wrangler.toml:64`) or the `TOKEN_BLACKLIST` binding (`:97-100`) — the memory notes vars are copy-pasted per env — deploys green with no log line.
- **Impact:** logged-out / rotated tokens stay valid until `exp` (1 h) and any HS256 token signed with the shared `JWT_SECRET` by another issuer (preview/dev oauth) is accepted — exactly FINDING-002/015, reopened by configuration.
- **Fix:** add `JWT_SECRET`, `JWT_ISSUER` and the `TOKEN_BLACKLIST` binding to the production-required set in `validateEnv` (same shape as the `BOT_SIGNING_SECRET` rule) with a test.
- **Confidence:** CONFIRMED.

### PAPI-09 — Unbounded query inputs on the public list (previous PAPI-17, unchanged)
- **Severity:** INFO — **Exposure:** INTERNET-UNAUTH — **Rotation:** none
- **Where:** `apps/presets-api/src/handlers/presets.ts:194, 208-215` (`search` passed through with no length cap; `page` lower-clamped only); `apps/presets-api/src/services/preset-service.ts:186-191` (three `LIKE ? ESCAPE '\'` clauses), `:218-229` (`OFFSET` bound as `(page-1)*limit`).
- **Trigger:** `GET /api/v1/presets?search=<~16 KB>` → three LIKE scans with a 16 KB pattern per row (table is small today, ≈16 rows); `?page=100000000000000000000` → non-integer REAL offset → SQLite datatype error → 500 via `onError`.
- **Fix:** cap `search` at ~100 chars (400 otherwise) and `page` at ~10 000.
- **Confidence:** CONFIRMED (behaviour), impact negligible at current table size.

### PAPI-10 — Unpublished preset names in logs; `console.*` bypasses the redacting logger
- **Severity:** INFO — **Exposure:** — — **Rotation:** none
- **CWE:** CWE-532
- **Where:** `apps/presets-api/src/handlers/presets.ts:605, 789` (`name="${preset.name}"` on notification failure — for a pending/flagged preset this is unpublished user text), `:386, 931, 950, 1022`; ≈32 `console.*` sites across `src/` (`ban-check.ts:64-70`, `auth.ts:199, 243`, `moderation-service.ts:241, 278`, `notification-service.ts:95, 118, 142, 175`, `preview-image-service.ts:76, 81, 84`, `votes.ts:87, 140`, `env-validation.ts:108-110`) never pass through `@xivdyetools/logger`'s redaction. None of them interpolates a token or secret today (`auth.ts:243-247` logs booleans + path; Perspective/discord-worker error bodies do not echo keys).
- **Fix:** log ids only; route through `c.get('logger')` so the redaction list applies by default.
- **Confidence:** CONFIRMED.

### PAPI-11 — Unchanged 2026-08-21 INFO items, re-verified against current code (none promoted beyond the above)
- **Severity:** INFO — **Exposure:** mixed — **Rotation:** none
- PAPI-12: owner-edit status write is unconditional (`services/preset-service.ts:580-596`, `WHERE id = ?`) — the read→write window (`handlers/presets.ts:411 → 544`) now spans the Perspective call (≤ 5 s), so a concurrent moderator reject/flag can still be overwritten with `approved`; `prepareRevert` unconditional and forces `approved` even on `hidden`/`rejected` (`:397-421`); moderator approve onto a colliding `dye_signature` → unhandled UNIQUE → 500 (`handlers/moderation.ts:97-107`).
- PAPI-13: moderator `DELETE /presets/:id` writes no `moderation_log` row (`handlers/presets.ts:331-390`); preview-image approve/reject writes none (`handlers/moderation.ts:198-258`); `reason` on `PATCH …/status` bound as-is — non-string → D1 type error → 500, length ≤ 100 KB (`:106`); `getActionFromStatusChange` labels any `→ pending` transition `'approve'` (`:353-364`).
- PAPI-14: `GET /` returns `environment` (`index.ts:210-217`); `/__force-error` compiled in (404 in prod, `:224-229`). `author_discord_id` → promoted, PAPI-05.
- PAPI-15: `credentials: true` on a bearer-token API (`index.ts:145`); no `Cache-Control: no-store` on authenticated JSON (`/mine`, `/rate-limit`, `/moderation/*`); legacy `https://xiv-colorexplorer.pages.dev` still allowlisted (`wrangler.toml:64`).
- PAPI-16: dead `notifyModerators` + `MODERATION_WEBHOOK_URL` / `OWNER_DISCORD_ID` / `DISCORD_BOT_TOKEN` (`services/moderation-service.ts:336-405`, `types.ts:75-77`) — `POST_MERGE_CHECKLIST.md:370` row; fail-open + key-in-URL → promoted, PAPI-02/03.
- PAPI-17: `/moderation/pending` unbounded (`services/preset-service.ts:449-453`); dye ids not checked for uniqueness/existence (`services/validation-service.ts:315-341` — `[5,5,5]` accepted); `refresh-author` binds a possibly-undefined `userName` (`handlers/presets.ts:314`; oauth always mints `username`, so unreachable from the web).
- PAPI-18: the routeless dev worker still binds the **production** D1 + R2 (`wrangler.toml:22-37`) under `ENVIRONMENT=development` (`:51-56`) — and since FINDING-017 the ban check fails **open** in `development` (`middleware/ban-check.ts:66-72`), one notch weaker than before; still `workers_dev = false` (`:16`), no routes, and CI deploys only `--env production` (`.github/workflows/deploy-presets-api.yml:60`).
- PAPI-8 residual: service-binding traffic carries no `CF-Connecting-IP` (neither bot forwards one — grep of both `preset-api.ts`), so all bot users still share one `public:ip:unknown` bucket of 100/60 s — now atomic per colo (`worker-kit/src/rate-limiter/backends/cloudflare.ts:134-158`) rather than per isolate; availability only, bounded by the bots' own per-user limits.

---

## Positive controls (re-verified; do not re-file)

1. **FINDING-002 / FINDING-015 — real, tested.** `auth.ts:95-104` passes `issuer: env.JWT_ISSUER` and calls `isTokenRevoked(payload.jti, env.TOKEN_BLACKLIST)`; `packages/auth/src/jwt.ts:190-196, 241-266` rejects non-string `iss`, ill-typed `exp`/`sub`, enforces `nbf`; production binds oauth's namespace `0d6f3be3…` (`wrangler.toml:97-100`) and `JWT_ISSUER = https://auth.xivdyetools.app` (`:64`). Tests `tests/middleware/auth.test.ts:1087-1143`. Residual → PAPI-08 (config-gated).
2. **FINDING-003 — native limiter is what runs in production.** `RL_PUBLIC` bound under `[env.production]` (`wrangler.toml:102-106`, namespace 1011) and selected whenever present (`middleware/rate-limit.ts:39-47`); the memory limiter is reachable only when the binding is absent from the deployed config — not by request manipulation; a binding throw fails open with a warn (`cloudflare.ts:159-175`, middleware default `onError: 'fail-open'`) — same accepted trade-off class as the KV limiter. No KV limiter exists in this unit. Tests `tests/middleware/rate-limit-binding.test.ts:37-51`.
3. **FINDING-004 — real.** 5 MB streamed `bodyLimit` on the upload route before the handler (`middleware/body-validation.ts:67-92`; tests `body-validation-preview.test.ts:30-72`), magic-byte sniff (`preview-image-service.ts:96-127`); image-worker `/thumbnail` re-checks `Content-Length`, streams with a 10 MB cap and gates on header dimensions **before** decode (`apps/image-worker/src/index.ts:112-127`, `photon.ts:294-296`, `validators.ts:238-244`).
4. **FINDING-008 — real for submissions and uploads.** `submission_events` (migration 0011, `schema.sql:189-198`) is written on every quota-bearing mutation and no code path in the monorepo deletes from it; the submission cap is `max(rows, events)` (`rate-limit-service.ts:144-160`) with a post-insert recount rollback (`presets.ts:755-771`); the upload cap runs before the body is read (`:852`). Tests `rate-limit-service-events.test.ts:30-85`, `presets-quotas.test.ts:69-198`. Gap → PAPI-01.
5. **FINDING-014 — v2 verified whenever present, no fallback when present** (`auth.ts:208-227`; test `auth-v2.test.ts:86`); length-prefixed canonical string binds method, path, body hash, timestamp, nonce, identity (`hmac.ts:326-338`), 60 s window; bots sign with `createBotSignatureV2` + random nonce. Residual → PAPI-07 (v1 still accepted), nonce-not-cached (accepted residual).
6. **FINDING-016 — real.** One visibility rule (`canSeePreset`, `presets.ts:112-121`) applied on GET and every mutation (`:353, 417, 636, 835, 998`); duplicate path votes only on approved and returns a bare 409 for others' pending (`:140-170, 177-183`); votes gated on `status = 'approved'` (`votes.ts:31, 171, 208`). Tests `presets.test.ts:1165-1246, 1333, 1754, 2020, 3192-3209`, `votes.test.ts:271-303, 418`.
7. **FINDING-017 — real.** Router-level `requireNotBanned` on every mutating method (`presets.ts:100`, `votes.ts:22`), fail-closed 503 except `development` (`ban-check.ts:60-82`). Tests `ban-check.test.ts:170-232`, `presets.test.ts:326, 1779, 3224`, `votes.test.ts:442`.
8. **FINDING-018 — real.** `s-maxage=86400` + browser immutable (`preview-image-service.ts:28`), delete-then-purge on every takedown path (`:178-182`; callers `presets.ts:384, 929, 1020`, `moderation.ts:252`), fixed purge host with `encodeURIComponent(zoneId)`, 5 s timeout, never throws, fail-safe `'skipped'` when unset (`:52-87`); zone id as a var, token as a secret (`wrangler.toml:64, 88-95`). Tests `preview-image-service.test.ts:49-191`.
9. **FINDING-019 / FINDING-028 — real.** Control/DEL/C1 and zero-width/bidi classes rejected on name/description, ZWJ only between emoji, Unicode tag grammar (`validation-service.ts:177-250, 262-381`); tests `validation-service.test.ts:15-178`.
10. **General.** Every D1 access parameterised (all 30 `pii-sinks` lines reviewed; `getPresets` joins only static fragments, `sort` by `switch`, LIKE escaped, `limit` clamped 1–50); JSON depth + prototype guard; Content-Type gate (stream-based); CORS exact match with env-gated loopback, `Vary: Origin`, preflight before auth; generic production errors with request id; `waitUntil` for notifications with retry/backoff + dead-letter; R2 key `${presetId}/${uuid}.webp` with `image/webp` set at put; secrets only via `wrangler secret`, `.dev.vars*` gitignored, `CACHE_PURGE_ZONE_ID` correctly a var; no analytics datapoints in this unit; identity backfill added no identity columns; `avatar` claim never persisted; unit test suite green at `4c213248` (679/683, 4 skipped).

## Rejected (checked, no finding)

- **Nonce only bound, not replay-checked** (`hmac.ts:360-362`, `auth.ts:222`) — the brief's question is answered "bound only"; it is a recorded residual (`POST_MERGE_CHECKLIST.md:402-404`, "acceptable inside Cloudflare"), INTERNAL, and moot while v1 is accepted (PAPI-07).
- **Can the daily cap still be reset by deleting rows?** No — nothing deletes `submission_events` (grep across all apps/scripts) and the cap takes `max(rows, events)`; moderation-worker's direct D1 access only writes `banned_users` and `UPDATE presets` (`ban-service.ts:309, 419-434`).
- **`author_name` / `X-User-Discord-Name` unvalidated charset** — bound in the HMAC (bot) or minted by oauth from Discord/XIVAuth (≤ 32 chars); bots sanitise before rendering (`discord-worker/src/index.ts:366-369`), the web app renders via Lit text bindings.
- **XIVAuth `global_name` = verified character name → `author_name`** (`apps/oauth/src/handlers/xivauth.ts:368-378`) — it is the sign-in identity the user chose; the chara-name rule (PR #151) governs `.chara` files, and `PRIVACY.md:43-45` discloses that the sign-in identity's name is shown.
- **Server-side chara-name leakage via preset `name`** — undetectable server-side; length/charset enforced (`validation-service.ts:262-280`); the client-side pre-fill rule is web-app's unit.
- **v2 body hash after `jsonDepthLimit` consumed `text()`** — Hono re-encodes the cached text; identical bytes for valid JSON; `auth-v2.test.ts:52-80` pass.
- **`refresh-author` binding `undefined`** — oauth always mints `username` (`callback.ts:242`, `xivauth.ts:323`); bots never call the route.
- **Hono 4.13.4 `bodyLimit`** — streamed-cap test present; `pnpm audit` evidence clean.
- **SQLi / SSRF / IDOR / JWT `alg` / prototype pollution / open redirect** — previous rejections re-verified; the delta touched none of those paths.
- **Pending preview images world-readable at unguessable UUID URLs** — accepted design (`preset-service.ts:429-431`).
- **`validatePresetDyes` now rejects the legacy itemIDs the bot still sends** (`POST_MERGE_CHECKLIST.md:378`) — functional, not security.
- **`/`, `/health` outside the rate limiter** — trivial handlers, no D1.
- **`scripts/migrate-dyes-to-stainids.ts`** — operator-run (LOCAL), quotes escaped, idempotent, ids come from D1.
- **Perspective / discord-worker error bodies in logs** — neither echoes a key or token.
- **CORS `credentials: true`, no `no-store`, legacy origin** — unchanged INFO (PAPI-11), not re-filed separately.

## Files covered

**Unit (read in full):** `apps/presets-api/src/index.ts`, `src/types.ts`, `src/handlers/presets.ts`, `src/handlers/votes.ts`, `src/handlers/categories.ts`, `src/handlers/moderation.ts`, `src/middleware/auth.ts`, `src/middleware/ban-check.ts`, `src/middleware/body-validation.ts`, `src/middleware/rate-limit.ts`, `src/services/preset-service.ts`, `src/services/moderation-service.ts`, `src/services/validation-service.ts`, `src/services/notification-service.ts`, `src/services/preview-image-service.ts`, `src/services/rate-limit-service.ts`, `src/services/category-service.ts`, `src/utils/api-response.ts`, `src/utils/env-validation.ts`, `src/data/profanity/index.ts`, `src/data/profanity/en.ts`, `wrangler.toml`, `package.json`, `schema.sql`, `migrations/0011_submission_events.sql`, `scripts/migrate-dyes-to-stainids.ts`, `CHANGELOG.md` (grep).
**Unit tests (names/fixtures, to confirm guards):** `tests/middleware/auth.test.ts`, `auth-v2.test.ts`, `rate-limit-binding.test.ts`, `body-validation-preview.test.ts`, `ban-check.test.ts`, `tests/handlers/presets-quotas.test.ts` (PATCH block read), `presets.test.ts`, `votes.test.ts`, `tests/services/rate-limit-service-events.test.ts`, `preview-image-service.test.ts`, `validation-service.test.ts`; full suite executed in the main checkout.
**Peers (trust boundary):** `packages/auth/src/hmac.ts`, `jwt.ts`, `revocation.ts`, `packages/auth/CHANGELOG.md` (grep); `packages/worker-kit/src/middleware/rate-limit.ts`, `middleware/logger.ts`, `middleware/request-id.ts`, `rate-limiter/ip.ts`, `rate-limiter/backends/cloudflare.ts`, `rate-limiter/backends/memory.ts` (head), `rate-limiter/presets/configs.ts` (grep); `apps/image-worker/src/index.ts`, `validators.ts` + `photon.ts` (grep); `apps/discord-worker/src/index.ts:198-420`, `apps/discord-worker/src/services/preset-api.ts` (grep), `apps/discord-worker/src/handlers/commands/preset.ts` + `preset-notifications.ts` (grep); `apps/moderation-worker/src/services/preset-api.ts` + `ban-service.ts` (grep); `apps/oauth/src/handlers/callback.ts`, `refresh.ts`, `xivauth.ts` (grep); `apps/web-app/src/components/preset-edit-form.ts` (grep).
**Policies / docs / evidence:** `apps/web-app/PRIVACY.md`, `apps/discord-worker/PRIVACY_POLICY.md`, `docs/operations/POST_MERGE_CHECKLIST.md` (§0 intro, §1:145-175, §3, §4, §5), `docs/architecture/security-trade-offs.md` (grep), `docs/audits/2026-08-21-security/evidence/review-presets-api.md`, `.github/workflows/deploy-presets-api.yml`, `evidence/REVIEWER_BRIEF.md`, `delta-files-by-unit.txt`, `commits-since-last-audit.txt`, `pii-sinks.txt`, `pii-sources.txt`, `wrangler-surface.txt`, `potential-secrets.txt`.
**Not reviewed:** other locale profanity lists (15-line arrays), `coverage/`, `.wrangler/`, `scripts/migrate-presets.ts` (unchanged since 08-21).
