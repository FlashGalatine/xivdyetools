# Review: presets-core (presets-api services, middleware, retention, migrations, schema, wrangler)

Branch preview/integration-2026-10-04 @80262a2f. Read-only review. 45 slice files read (tests skimmed).

## Map
| Module | Role |
|---|---|
| src/index.ts | Hono app + `Object.assign(app,{scheduled})`; middleware order requestId, logger, validateEnv, headers, CORS, IP limit, body caps, auth, per-user limit, content-type |
| src/retention-job.ts | Daily cron (`23 4 * * *`, production only): 3 prunes via allSettled inside waitUntil |
| middleware/auth.ts | Bot HMAC v2 + nonce replay (KV) / JWT (iss pin, jti revocation) -> AuthContext |
| middleware/ban-check.ts | requireNotBanned: fail closed 503 outside development; matches discord_id or xivauth_id |
| middleware/rate-limit.ts | RL_PUBLIC native binding (IP, then per user), memory fallback |
| middleware/body-validation.ts | worker-kit bodyGuards, 100 KB, 5 MB preview exemption |
| services/preset-service.ts | CRUD, RETURNING * conditional UPDATEs bound to content_revision |
| services/identity-rekey-service.ts | UUID -> snowflake re-key, one batch, ban guard on all 5 statements |
| services/moderation-retention-service.ts | 90 d lifted bans, 12 mo ban/unban/hide/restore log rows |
| services/notification-service.ts | Discord webhook retry, reduced dead letters, prune, list/resolve |
| services/rate-limit-service.ts | submission_events quotas, reserve-then-count, 30 d prune |
| services/validation-service.ts | name/desc/dyes/tags/links/secondary categories |
| services/moderation-service.ts, preview-image-service.ts, category-service.ts | filter + Perspective; sniff/R2/purge; 60 s category cache |
| migrations 0014/0015, schema.sql, wrangler.toml | content_revision trigger; dead-letter rewrite; prod cron + RL bindings |

## Candidates

### presets-core-01 | BUG | MEDIUM | handlers/presets.ts:1077-1098 (+ discord-worker/src/handlers/commands/preset.ts:571,576,924) | MAIN
Claim: lead confirmed. A preset submitted/edited through the bot is announced twice. presets-api's `notifyDiscordBot` fires for EVERY submission and edit (payload `source: auth.authSource`, never skipped for `bot`), and discord-worker's own command handler also posts to the same channels.
Failing input: `/preset submit` that lands `pending` -> command calls `notifyModerationChannel` (preset.ts:576, no contentRevision, legacy button ids) AND presets-api webhook -> `sendModerationNotification` (index.ts:404, revision-bound ids). Two moderation embeds. Auto-approved: `notifySubmissionChannel` (preset.ts:571) plus webhook `status==='approved'` branch -> two submission-log entries. Edit path: preset.ts:924 plus presets-api ~853.
Wrong outcome: duplicate queue items; the legacy one needs two clicks (preview-image.ts:176 refresh-then-bound click); duplicate submission-log posts.
Tests miss it: each side tested in isolation (presets-api mocks DISCORD_WORKER, discord-worker mocks the API). Covered: no.
```
// presets.ts:1077  (no source check)
const submissionPayload = submittedRow && submittedRow.status === status ? { type:'submission', preset:{ ..., source: auth.authSource } } : null;
if (submissionPayload) c.executionCtx.waitUntil(notifyDiscordBot(...))
```
Fix: pick one owner. Cheapest: drop the three discord-worker direct posts (preset.ts:571/576/924), since the webhook is the revision-bound path; or have presets-api skip when `authSource==='bot'`.

### presets-core-02 | BUG | MEDIUM | services/validation-service.ts:236 | MAIN
Claim: `validatePresetDyes` checks count, integer and range but never uniqueness. `dye_signature` = sorted ids, so `[5,5,5]`, `[1,2,3,3]`, `[1,2,2,3]` each get a distinct signature.
Failing input: POST /presets with dyes `[1,2,3]`, then `[1,2,3,3]`. Duplicate pre-check and the partial UNIQUE index both pass; same palette published again. `[7,7,7]` is a one-dye "3-dye palette".
Wrong outcome: duplicate-detection (PRESETS-CRITICAL-001) bypass; the 10/day quota lets one author flood near-copies. No test for repeated ids (validation-service.test.ts and presets.test.ts have none). Covered: no.
Fix: reject `new Set(dyes).size !== dyes.length` (edit path uses the same validator).

### presets-core-03 | BUG | LOW | services/validation-service.ts:182,208 | MAIN
Claim: length checks run on the raw string, never trimmed (no `.trim()` on name/description in the handlers or validators).
Failing input: name `"  "` (2 spaces) or a 10-space description passes validation and the local filter and is stored blank. Wrong outcome: blank-named preset in gallery/queue. Covered: no. Fix: require a non-whitespace code point / trim before the min-length test and store the trimmed value.

### presets-core-04 | BUG | LOW | services/validation-service.ts:417-438 vs normalizeExampleLink | MAIN
Claim: `validateExampleLink` does not trim, `normalizeExampleLink` does. A link pasted with a leading space fails the `^https?://` test, becomes `https:// https://x.com/...`, `new URL` throws -> "Example link is not a valid URL", though normalize would have accepted it. Wrong outcome: spurious 400 on a common paste artifact. Covered: no. Fix: `link.trim()` first in validate.

### presets-core-05 | BUG | LOW | services/preset-service.ts:268-276 | MAIN
Claim: `name ASC` and `created_at DESC` have no unique tiebreaker; names are not unique.
Failing input: more than `limit` presets sharing a name (or created_at), page 1 then page 2 via LIMIT/OFFSET: SQLite may order ties differently per query, so a row repeats or is skipped. Covered: no. Fix: append `, id` to every ORDER BY.

### presets-core-06 | UNTESTED | LOW | services/identity-rekey-service.ts:39 | PR-#224
Claim: `rekeyIdentity(db, id, id)` is destructive: statement 2 is a no-op, statement 3 decrements vote_count for every vote the user has, statement 4 deletes all their votes. Only guard is the caller's `jwtSub !== jwtDiscordId` (handlers/presets.ts:372-374). Latent: no current caller passes equal ids. identity-rekey.test.ts has no equal-id case. Fix: `if (fromId === toId) return false;` at the top.

### presets-core-07 | OPT | LOW | services/rate-limit-service.ts:188,292 | PR-#224
Claim: every quota write (`recordSubmissionEvent`, `reserveDailyEvent`) and every failed-notification store/list/resolve still issues a DELETE prune although the daily cron now guarantees the window. One extra D1 write round trip per submission, edit and upload. Fix: throttle (once per isolate per hour) or keep it only where no cron exists.

## POSITIVE
- Retention cron: allSettled inside `ctx.waitUntil`, each prune never throws, logs counts/error names only; production-only trigger (wrangler.toml `[env.production.triggers]`); timestamp formats match their writers (ISO for submission_events and moderation tables, SQLite datetime for failed_notifications via `toSqliteDateTime`).
- Migration 0014 trigger: `UPDATE OF` list excludes `content_revision`, so no self-recursion; every consumer that needs the post-trigger revision re-reads (presets.ts ~845 and ~1069).
- Re-key: NOT_BANNED guard on all five statements, correct statement order, idempotent, real-SQLite tests including a ban landing between read and write.
- Ban check fails closed (503) except `development`; matches both ban columns.
- Rate limiter keys on CF-Connecting-IP / authenticated id only; auth uses constant-time secret compare, v2-only HMAC and a nonce replay cache.
- Category cache clears its in-flight promise in `.finally` (no rejected-promise poisoning); env validation runs every request, only the logging latches.

## REJECTED
- JWT `type` not checked in auth.ts: no worker issues typed/refresh JWTs (git grep for `expectedType` / `'refresh'` in apps), so no confusion path.
- Per-request KV nonce writes: operational cost only, documented fail-open.
- `author_name` in the revision trigger staling embeds after a display-name refresh: intended fail-closed (documented in identity-rekey header and 0014).
- `getPresetsByUser` stale `rejection_reason` on resubmitted presets: only the web `rejected` kind renders it (my-submissions-modal.ts:108-110).
- `prepareStatusUpdate` RETURNING * showing the pre-trigger revision: the moderation response goes through `rowToPreset`, which does not expose `content_revision`.
- Cron bypasses `validateEnv`: the job only needs `env.DB`.
- Huge `page` values reaching OFFSET (presets.ts:248): could not make it fail in my head (D1 behaviour with a float bind unverified).
- `notifyDiscordBot` not retrying 408/429: minor; upstream 4xx bodies are static strings so the dead-letter `error` column does not echo preset content.
- 12-month prune of `ban` log rows for an old active ban: policy choice stated in the module header.

## COVERED
45 files: migrations 0002-0015 and 002 (16), package.json, schema.sql, scripts/migrate-presets.ts (head), data/profanity (skimmed), src/index.ts, retention-job.ts, middleware x4, services x9 (category, identity-rekey, moderation-retention, moderation, notification, preset, preview-image, rate-limit, validation), types.ts, utils x2, wrangler.toml. Also read for context: handlers/presets.ts (refresh-author, edit/submit notify, validation helpers), handlers/moderation.ts 185-300, discord-worker index.ts webhook and preset.ts notify, moderation-worker ban-service.
