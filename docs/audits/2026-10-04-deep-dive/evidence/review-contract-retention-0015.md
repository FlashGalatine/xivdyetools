# review-contract-retention-0015 (cross-PR contract: #224 retention cron + migration 0015)

## Map
| Piece | Where | Behaviour |
|---|---|---|
| Cron wiring | apps/presets-api/wrangler.toml:123-124 `[env.production.triggers] crons=["23 4 * * *"]`; no top-level `[triggers]` (only crons in the repo) | production worker only; guarded by tests/wrangler-config.test.ts:126-131 |
| Handler | src/index.ts:305 `Object.assign(app,{scheduled})`; src/retention-job.ts:54-60 | `ctx.waitUntil(runRetentionJob(env.DB))`; index.test.ts:46-50 asserts export |
| Job | retention-job.ts:30-47 | `Promise.allSettled` over 3 prunes; summary log |
| Prune 1 | rate-limit-service.ts:156-173 | submission_events `created_at < ISO(now-30d)`; column default strftime ISO (migration 0011) |
| Prune 2 | notification-service.ts:269-299 | failed_notifications resolved>30d / unresolved>90d; cutoff `YYYY-MM-DD HH:MM:SS`, matches `datetime('now')` writers (0005, :479) |
| Prune 3 | moderation-retention-service.ts:55-90 | banned_users lifted>90d; moderation_log actions ban/unban/hide/restore >12 months; ISO cutoffs; every writer binds ISO (ban-service.ts:483/579, handlers/moderation.ts:206/298/386) |
| Migration 0015 | migrations/0015_rewrite_legacy_dead_letters.sql:8 | one UPDATE; fat `{type,preset:{id,..}}` -> `{type,preset_id,moderation_status?}`; skips reduced and invalid JSON (CASE guard); idempotent; hand-run via `wrangler d1 execute --file` |
| Reader | notification-service.ts:371-401 `summarizeFailedNotification` | handles both shapes, so pre-0015 rows never break the listing |

Deploy states:
- Dev (top-level) worker: no cron; it binds the SAME D1 (database_id e17d68a1..., wrangler.toml:22-25), so its lazy write-path prunes act on production rows. Consistent formats, harmless.
- Production before 0015: cron prunes by age only (payload untouched); fat rows linger until 0015 or until aged out (<=90d unresolved). The reader serves id only. Nothing in the cron depends on 0015, 0013 or 0014 (a missing table is caught by each prune and warned).
- Production after 0015: all rows reduced. Re-run is a no-op (current rows have no `$.preset`).

## Candidates

### contract-retention-0015-01 (BUG, MEDIUM, operational) retention-job.ts:30-47, :43-45
Claim: a total prune failure is reported as success, and nothing durable records it. Each prune catches its own D1 error and only `logger.warn`s (moderation-retention-service.ts:89-90, notification-service.ts:297-298, rate-limit-service.ts:171-172), so `Promise.allSettled` never sees a rejection. `rejected` is always 0 and the line `[retention-job] done {fulfilled:3,rejected:0}` is logged even when all three DELETEs failed. `scheduled()` returns normally, so the Cloudflare cron event shows success. `[observability] enabled=false` is pinned (wrangler.toml:65,129-130), so the warn lines are not persisted either.
Failing state: D1 outage, or a dropped table/column at 04:23 UTC -> three swallowed errors, a "success" cron run, and no record. The privacy promise (30/90 d, 12 mo) silently lapses until someone runs `wrangler tail` at that moment.
Tests: tests/retention-job.test.ts mocks all three prunes (:10-19), so the `rejected` path is only reachable by a mock that real prunes never produce. Covered: no. Origin: PR-#224.
Excerpt: `const results = await Promise.allSettled([pruneSubmissionEvents(db, logger), pruneFailedNotifications(db, logger), pruneModerationRecords(db, logger)]);`
Fix direction: have the prunes return `{pruned:number}|{failed:true}` (or rethrow when called from the job) and have `runRetentionJob` throw (or call `ctx`/console.error plus a non-success exit) when any failed, so the cron status goes red; keep the best-effort swallow only on request paths.

### contract-retention-0015-02 (BUG, LOW, policy-vs-data) migrations (none) / moderation-retention-service.ts:76
Claim: both policies promise that when a ban is lifted "the author name and the reason are cleared at once" (discord-worker/PRIVACY_POLICY.md:189 and the de/fr/ja/ko/zh equivalents :189-191; web-app PRIVACY*.md ban item). The scrub exists only in the unban statement shipped by moderation-worker 1.8.0 (ban-service.ts:605). Bans lifted before that deploy keep `username` and `reason` until the cron deletes the row 90 days after `unbanned_at`. The only remedy is the "optional one-off" in moderation-worker/CHANGELOG.md:43-45, which is not a migration file, and 0015 only touches dead letters.
Failing state: ban lifted 2026-09-20 -> row retains name and moderator reason until 2026-12-19, while the published policy says cleared at once.
Tests: none. Covered: no. Origin: PR-#224 / moderation-worker sprint 4 (documented as optional).
Fix direction: include `UPDATE banned_users SET username='', reason='' WHERE unbanned_at IS NOT NULL` in the 0015 rollout (or a 0016), or word the policy "from the date of this policy" for earlier bans.

## POSITIVE
- Production-only wiring is real: `[triggers]` exists only under `[env.production]`, a test pins it, and the `Object.assign` export is asserted.
- Timestamp formats are matched per column everywhere: ISO for submission_events and the moderation tables (all writers bind ISO), space format only for failed_notifications; the ISO-vs-space edge in banned_users/moderation_log can only prune up to a day early and is documented.
- Retention numbers equal both policies in all six languages: 30 d events and resolved dead letters, 90 d unresolved, 90 d after a lift, 12 months for ban/unban/hide/restore. Checked en/de/fr/zh/ja/ko for web-app and discord-worker.
- 0015 is idempotent and safe on invalid JSON (CASE short-circuit); its test runs the real file on SQLite.
- D1 limits: each prune is one batch of 1-2 statements (no 100-bound-parameter or batch-size risk); the 4 `IN` placeholders are fixed. The lazy write-path prunes keep volumes small, so the first run is not a large delete.
- Cron work is held by `waitUntil`; the job is idempotent and the only shared state is the DB.

## REJECTED
- Mixed `datetime('now')` / ISO in banned_users and moderation_log: no code path writes the default (all INSERTs bind created_at/banned_at), and the bias is toward early prune only.
- Legacy preview_image rows keeping `moderation_status` after 0015: harmless, `summarizeFailedNotification` reads it either way.
- 0015 dropping `content_revision`: legacy fat rows predate revision binding (0014), so none exist.
- Unbounded DELETE sizes / D1 statement timeouts: submission_events and dead letters are pruned lazily on writes; moderation tables are small.
- Cron against the shared dev/prod D1 from the dev worker: dev has no cron; formats are identical.

## COVERED (12)
apps/presets-api/src/retention-job.ts, src/index.ts (wiring), wrangler.toml, migrations/0015_rewrite_legacy_dead_letters.sql, 0005, 0011, src/services/{rate-limit-service,notification-service,moderation-retention-service}.ts, src/handlers/moderation.ts (writers), apps/moderation-worker/src/services/ban-service.ts, tests/{retention-job,wrangler-config,index,services/failed-notifications-legacy-rewrite}.test.ts (skimmed); PRIVACY*.md x6 (web-app) and PRIVACY_POLICY*.md x6 (discord-worker).
