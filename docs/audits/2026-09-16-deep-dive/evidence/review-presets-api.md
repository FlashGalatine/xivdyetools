# Review: presets-api (deep-dive 2026-09-16)

Scope: `apps/presets-api/src/**` (handlers, middleware, services, data/profanity, types),
`schema.sql`, `migrations/*.sql`, `wrangler.toml` (read-only). Repo root:
`C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-16` @ `origin/main` 79a69d1f.

## 1. Map

| Module | Routes / exports | Role |
|---|---|---|
| `src/index.ts` | Hono app, CORS, middleware chain, `/`, `/health`, `/__force-error` | entry, global middleware order |
| `handlers/presets.ts` (1373 lines) | `GET /`, `/featured`, `/mine`, `/rate-limit`; `PATCH /refresh-author`, `/:id`; `DELETE /:id`; `POST /`, `/:id/preview-image`; `DELETE /:id/preview-image` | preset CRUD, submission, moderation triggers |
| `handlers/votes.ts` | `POST/DELETE /:presetId`, `GET /:presetId/check` | atomic vote add/remove |
| `handlers/categories.ts` | `GET /`, `/:id` | category list + counts, edge cache |
| `handlers/moderation.ts` | `GET /pending`, `PATCH /:id/status`, `/:id/revert`, `/:id/preview-image`, `GET /:id/history`, `/stats`, `/failed-notifications*` | moderator actions, audit log |
| `middleware/auth.ts` | `authMiddleware`, `requireAuth/Moderator/UserContext` | dual bot-HMAC / JWT auth |
| `middleware/ban-check.ts` | `requireNotBanned` | ban gate, fail-closed |
| `middleware/body-validation.ts` | `bodySizeLimit`, `jsonDepthLimit` | body caps, JSON depth/proto-pollution |
| `middleware/rate-limit.ts` | `publicRateLimitMiddleware`, `perUserRateLimitMiddleware` | IP + per-user 100/min |
| `services/preset-service.ts` | `getPresets`, `createPreset`, `updatePreset`, `toPublicPreset`, … | D1 queries, row↔DTO, author-id redaction |
| `services/moderation-service.ts` | `moderateContent` | local filter + Perspective, fail-closed |
| `services/notification-service.ts` | `notifyDiscordBot`, dead-letter queue | retry/backoff, prune |
| `services/preview-image-service.ts` | `storePreviewImage`, `deletePreviewImage`, `purgePreviewImageCache` | R2 + image-worker + edge purge |
| `services/rate-limit-service.ts` | daily quota counters | submission/edit/upload caps |
| `services/category-service.ts` | `getValidCategories` | module-level 60s cache, dedup |
| `services/validation-service.ts` | field validators | name/desc/dyes/tags/link/category |
| `data/profanity/*` | word lists | data only, aggregated in `index.ts` |
| `schema.sql` + `migrations/0002-0014` | — | matches at HEAD; `content_revision` trigger + optimistic concurrency |

## 2. Candidates

**presets-api-01** — BUG — **HIGH** — `src/middleware/ban-check.ts:30-36` + `src/middleware/auth.ts:71-77`
Claim: XIVAuth-only banned users are never blocked by `requireNotBanned`.
`isUserBanned` queries only `WHERE discord_id = ?`, never `xivauth_id` — yet `schema.sql:161-181` defines `banned_users.xivauth_id` with its own partial unique index specifically for users banned with no Discord link. Separately, `resolveJWTUserId` (auth.ts:71) falls back to the oauth `sub` (internal UUID) for such accounts, so even a `xivauth_id`-aware query would be handed the wrong value. Failing input: a moderator bans a XIVAuth-only user (`banned_users` row has `discord_id IS NULL`, `xivauth_id = '<uuid>'`); that user logs in via web JWT (`auth_provider: 'xivauth'`, no `discord_id` claim) and calls `POST /api/v1/presets`. Wrong outcome: `isUserBanned(db, sub)` finds no row (queries the wrong column with the wrong id) → `requireNotBanned` calls `next()` → the ban has no effect on any mutating route (submit/edit/delete/vote/preview-image). Why tests miss it: no test constructs a XIVAuth-only auth context or a `xivauth_id`-only ban row (see UNTESTED presets-api-02). Fix direction: `isUserBanned` should check `discord_id = ? OR xivauth_id = ?` and the caller needs both identifiers available in `AuthContext` (or at minimum look up `xivauth_id` from the JWT `sub`/oauth user record before the ban query).
```ts
async function isUserBanned(db: D1Database, discordId: string): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM banned_users WHERE discord_id = ? AND unbanned_at IS NULL LIMIT 1')
    .bind(discordId)
    .first();
  return result !== null && result !== undefined;
}
```
Covered by test: no (see presets-api-02).

**presets-api-02** — UNTESTED — priority HIGH (pairs with -01) — `tests/middleware/ban-check.test.ts` (whole file) + `packages/test-utils/src/cloudflare/d1.ts:242-252`
Claim: every ban-check test passes because the shared mock D1 special-cases `SELECT 1 FROM ... banned_users` and returns "banned" from a global `_setBanStatus(true)` flag regardless of the bound parameter or which column the query names. The behaviour that `presets-api-01` breaks — "the query checks the *right identity* against the *right column*" — is exactly what this mock cannot observe: it would report the same 403 whether `isUserBanned` bound `discord_id`, `xivauth_id`, `sub`, or a hard-coded string. What the test was supposed to catch: a ban query silently checking the wrong column/identity for a XIVAuth-only user. Fix direction: add a real column-aware ban fixture (or a spy asserting the bound value/column) and a XIVAuth-only-identity test case.

**presets-api-03** — BUG — MEDIUM — `src/handlers/presets.ts:344-350`
Claim: `PATCH /api/v1/presets/refresh-author` binds `auth.userName` (typed `string | undefined`) straight into a D1 `.bind()` call with no fallback, unlike every other write in this file that touches an author name.
```ts
const result = await c.env.DB.prepare(`
  UPDATE presets
  SET author_name = ?
  WHERE author_discord_id = ?
`)
  .bind(auth.userName, auth.userDiscordId)
  .run();
```
Failing input: a bot request authenticated with `X-User-Discord-ID` but no `X-User-Discord-Name` header (or a JWT with neither `global_name` nor `username`) reaches `requireUserContext` fine (it only requires `userDiscordId`), so `auth.userName` is `undefined` when this handler runs. Wrong outcome: Cloudflare D1 rejects `undefined` bind parameters (`D1_TYPE_ERROR`), so the request throws and falls through to the global error handler → 500 instead of the intended no-op/clear. Every sibling call site guards this (`auth.userName || 'Unknown User'` in `POST /presets`, `auth.userName?.trim() || 'Unknown User'` in the submission payload, `preset.author_name || 'Unknown User'` in the edit payload) — this route is the one write path that doesn't. Why tests miss it: both refresh-author test cases (`tests/handlers/presets.test.ts:315-356` and `:3443-3491`) always send `X-User-Discord-Name`. Covered by test: no. Fix direction: `.bind(auth.userName ?? null, auth.userDiscordId)` (or reuse the `|| 'Unknown User'` convention).

**presets-api-04** — BUG — MEDIUM — `src/services/rate-limit-service.ts:168-200` vs. `src/handlers/presets.ts:620-642,696-709,1088-1100`
Claim: the daily caps for `text_edit`, `flagged_edit`, and `preview_upload` are plain check-then-insert (D1 COUNT-then-INSERT TOCTOU) with no post-insert re-check, unlike the `submission` cap which the code explicitly hardened (BUG-049/BUG-042, `getEffectiveSubmissionCountToday` re-queried and rolled back after the INSERT — `presets.ts:964-992`). Failing input: a user sitting at `DAILY_TEXT_EDIT_LIMIT - 1` (29/30) fires two concurrent `PATCH /:id` requests with name/description changes. Wrong outcome: both requests call `checkDailyEventLimit` and both see `used = 29 < 30`, both proceed, both `recordSubmissionEvent`, landing the user at 31/30 — the cap is soft under concurrency where the submission cap is not. Same shape for `flagged_edit` (10/day, each unit fans out a moderation embed) and `preview_upload` (20/day, each unit costs an image-worker decode + R2 write + moderation embed). Why tests miss it: `tests/handlers/presets-quotas.test.ts` only exercises sequential over-limit requests (`text_edit: DAILY_TEXT_EDIT_LIMIT` pre-seeded, single request), never two concurrent requests at `limit - 1`; `grep -rn concurrent tests/` finds only the `submission`-path race tests. Covered by test: no. Fix direction: apply the same effective-count re-check-and-rollback (or a `db.batch()` conditional insert) used for `submission` to the other three event kinds, or accept the soft-cap explicitly in a comment if the operational risk is judged acceptable.
```ts
export async function checkDailyEventLimit(
  db: D1Database, userDiscordId: string, kind: SubmissionEventKind, limit = DAILY_LIMITS[kind]
): Promise<RateLimitResult> {
  const used = await getEventCountToday(db, userDiscordId, kind);
  return { allowed: used < limit, remaining: Math.max(0, limit - used), resetAt: getNextResetUTC() };
}
```

## 3. POSITIVE

- Vote add/remove is a single `db.batch()` with `ON CONFLICT DO NOTHING` and a `vote_count` recompute — no TOCTOU, self-healing counter (`handlers/votes.ts:64-77,120-131`).
- Every dye-signature-collision path (submit, edit, both moderation transitions) is wrapped and answers a 409 that names the colliding preset only when the caller could already see it (FINDING-016) — no opaque 500, no visibility leak.
- Perspective fail-closed (FINDING-005) verified in code: any non-OK/timeout/unparsable response becomes `perspective_unavailable` with `passed: false`, never a silent pass.
- Preview-image lifecycle: DB write always precedes the R2 delete/replace (accepted failure = orphaned object, never a broken live URL), and `deletePreviewImage` purges the edge cache only after the R2 delete succeeds — FINDING-002 (2026-09-15) holds.
- `schema.sql` and `migrations/0010`–`0014` are byte-consistent with each other (secondary_categories, submission_events rebuild, moderation_log rebuild, content_revision trigger) — no schema.sql/migrations drift found in this slice.
- Every `waitUntil` call wraps a promise with its own `.catch()` that stores a dead-letter row; no floating promises, no bare `executionCtx` casts.
- Bot HMAC path is v2-only with a KV-backed single-use nonce and constant-time secret comparison; CORS loopback allowlist is correctly gated behind `ENVIRONMENT === 'development'`.
- `moderation_log` conditional-update + audit-insert pairs use `WHERE changes() > 0` inside one `db.batch()`, so a lost race never mislabels the audit trail (covered by dedicated `*-revision.test.ts` suites).

## 4. REJECTED

- PATCH `/:id` runs the dye-duplicate 409 check before the `status === 'hidden'` 403 check, so a caller editing their own hidden preset could see a 409 before the "cannot be edited" 403 — dropped: both are failure responses to the preset's own owner (the only caller who could reach this branch, since `requireNotBanned` already blocks a banned user's PATCH), no information disclosure, cosmetic ordering only.
- `content_revision` trigger recursion — the AFTER-UPDATE trigger does its own `UPDATE ... SET content_revision` inside its body — dropped: the inner UPDATE only touches `content_revision`, which is not in the trigger's column list, so the `WHEN` clause cannot re-fire it even with `recursive_triggers` on; verified against both `schema.sql` and `migrations/0014` (identical).
- `RETURNING *` after `updatePreset`'s conditional UPDATE reflects the pre-trigger `content_revision` (documented in CLAUDE.md) — dropped as live bug: the value is never re-used for a subsequent conditional write in this file (each handler re-fetches via `getPresetRowById` at the top), and `content_revision` is never included in any public response.
- `getValidCategories`'s module-level 60s cache (category-service.ts) shared across requests — dropped: categories change rarely, TTL + promise-dedup is deliberate (OPT-001), not a staleness bug.
- `findDuplicatePreset` returning `null` after a caught UNIQUE-violation on submit (the colliding preset deleted in the race's own window) falling through to `throw error` → 500 — dropped: vanishingly rare double-race, acceptable failure mode, not worth a fix.

## 5. COVERED

19 source files (full): `src/index.ts`, `src/types.ts`, `src/middleware/auth.ts`, `src/middleware/ban-check.ts`, `src/middleware/body-validation.ts`, `src/middleware/rate-limit.ts`, `src/utils/api-response.ts`, `src/utils/env-validation.ts`, `src/services/preset-service.ts`, `src/services/validation-service.ts`, `src/services/rate-limit-service.ts`, `src/services/moderation-service.ts`, `src/services/notification-service.ts`, `src/services/preview-image-service.ts`, `src/services/category-service.ts`, `src/handlers/categories.ts`, `src/handlers/votes.ts`, `src/handlers/moderation.ts`, `src/handlers/presets.ts` (1373/1373 lines).
Data (aggregator read, lists skimmed as data-only): `src/data/profanity/index.ts` (+ en/ja/de/fr/ko/zh word-list files, not individually read — pure literal arrays with no logic).
Schema/config (read-only, per brief): `schema.sql`, `migrations/0010_add_secondary_categories.sql`, `migrations/0011_submission_events.sql`, `migrations/0012_submission_events_text_edit.sql`, `migrations/0013_moderation_log_user_actions.sql`, `migrations/0014_add_content_revision.sql`, `wrangler.toml`.
Tests skimmed for coverage judgment: `tests/middleware/ban-check.test.ts` (full), `tests/handlers/presets-quotas.test.ts` (grep + relevant sections), `tests/handlers/presets.test.ts` (grep + refresh-author/ban sections), `tests/handlers/votes.test.ts`, `tests/handlers/moderation.test.ts` (grep).
External context (entry point only, to confirm mock behaviour): `packages/test-utils/src/cloudflare/d1.ts:150-460` (`_setBanStatus`).
Project doc read for architecture ground truth: `apps/presets-api/CLAUDE.md`.

Total: 26 files read/inspected in full or targeted detail (19 source + 7 schema/config) plus 5 test files and 1 package file skimmed for verification.
