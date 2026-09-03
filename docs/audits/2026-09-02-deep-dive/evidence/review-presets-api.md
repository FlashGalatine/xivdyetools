# Review — `presets-api` (deep-dive 2026-09-02)

Worktree: `C:/dev/XIVProjects/xivdyetools/.claude/worktrees/deep-dive-2026-09-02`
Unit: `apps/presets-api` (CF Worker + Hono + D1 `xivdyetools-presets` + R2 previews), v2.2.1.

## 1. Map

| Path | Route / export | Auth | Notes |
|---|---|---|---|
| `src/index.ts` | global chain: requestId → logger → env-validate → security headers → CORS → `/api/*` IP rate limit → bodySizeLimit → jsonDepthLimit → authMiddleware → Content-Type gate | — | `/`, `/health`, `/__force-error` (404 in prod) |
| `handlers/presets.ts` | `GET /` (list), `GET /featured`, `GET /mine`, `GET /rate-limit`, `PATCH /refresh-author`, `DELETE /:id`, `PATCH /:id`, `GET /:id`, `POST /`, `POST /:id/preview-image`, `DELETE /:id/preview-image` | mixed | 1,348 lines; router-level `requireNotBanned` on POST/PATCH/DELETE |
| `handlers/votes.ts` | `POST /:presetId`, `DELETE /:presetId`, `GET /:presetId/check` + `addVote`/`removeVote` | user | `APPROVED_PRESET_GATE` on both mutations |
| `handlers/moderation.ts` | `GET /pending`, `PATCH /:presetId/status`, `PATCH /:presetId/revert`, `PATCH /:presetId/preview-image`, `GET /:presetId/history`, `GET /stats`, `GET /failed-notifications`, `PATCH /failed-notifications/:id/resolve` | moderator | all via `requireModerator` |
| `handlers/categories.ts` | `GET /`, `GET /:id` | public | only cached routes (`s-maxage=60`) |
| `middleware/auth.ts` | `authMiddleware`, `requireAuth`, `requireModerator`, `requireUserContext`, `resolveJWTUserId` | — | bot = BOT_API_SECRET + v2 HMAC + KV nonce; web = HS256 JWT + `iss` pin + jti blacklist |
| `middleware/ban-check.ts` | `requireNotBanned` | — | fails **closed** (503) outside `development` |
| `middleware/body-validation.ts` | `bodySizeLimit` (100 KB / 5 MB preview), `jsonDepthLimit` (depth 10 + proto keys) | — | `isPreviewImageUpload` carve-out |
| `middleware/rate-limit.ts` | `publicRateLimitMiddleware`, `selectPublicRateLimiter` | — | `RL_PUBLIC` native binding, memory fallback |
| `services/preset-service.ts` | `getPresets`, `getFeaturedPresets`, `getPresetById`, `getPresetsByUser`, `findDuplicatePreset(Excluding)`, `createPreset`, `updatePreset`, `prepareStatusUpdate`, `prepareRevert`, `getPendingPresets`, `rowToPreset`, `toPublicPreset`, `generateDyeSignature` | — | `preview_image_url` moderation gate lives in `rowToPreset` |
| `services/rate-limit-service.ts` | daily caps: submission 10, flagged_edit 10, preview_upload 20, text_edit 30; `submission_events` (append-only, 30-day prune) | — | |
| `services/moderation-service.ts` | `checkLocalFilter`, `checkWithPerspective` (5 s timeout, fail-closed), `moderateContent`, `compileProfanityPatterns` | — | 11 word-list entries total |
| `services/notification-service.ts` | `notifyDiscordBot` (3 retries), dead-letter write/read/resolve/prune | — | `DeadLetterRecord` = id + type only |
| `services/preview-image-service.ts` | `sniffImageType`, `storePreviewImage`, `deletePreviewImage`, `purgePreviewImageCache`, `getPresetImageState` | — | R2 key `{presetId}/{uuid}.webp` |
| `services/validation-service.ts` | name/description/dyes(stainID 1–254)/tags/secondary-categories/example-link + moderation validators | — | |
| `services/category-service.ts` | `getValidCategories` (60 s module cache + promise dedupe) | — | |
| `utils/api-response.ts`, `utils/env-validation.ts` | `ErrorCode` + helpers; `validateEnv` (prod requires JWT_SECRET/JWT_ISSUER/TOKEN_BLACKLIST/RL_PUBLIC/BOT_SIGNING_SECRET) | — | |
| `schema.sql`, `migrations/0002…0013`, `002_add_composite_indexes.sql` | 6 tables; partial unique index `presets(dye_signature) WHERE status IN ('approved','pending')` | — | `d1_migrations` intentionally empty; applied by hand |

**Schema drift check: none found.** `schema.sql` matches 0006 (partial dye_signature index), 0008 (`example_link`), 0009 (`preview_image_key`/`_status`), 0010 (`secondary_categories`), 0012 (`submission_events` CHECK incl. `text_edit` + both indexes) and 0013 (`moderation_log.preset_id` nullable + `target_discord_id` + all three indexes). Only nit: `002_add_composite_indexes.sql` uses a 3-digit prefix so a naive `migrations/*.sql` glob replays it **last** — harmless (all `CREATE INDEX IF NOT EXISTS`).

---

## 2. Candidates

### presets-api-01 — BUG — MEDIUM — `src/handlers/moderation.ts:97` (also `services/preset-service.ts:440`, `:461`)

**Claim:** a moderator status transition *into* the partial unique index (`flagged`/`rejected` → `approved`|`pending`) can violate `idx_presets_dye_signature`; nothing catches it, so the moderator gets an opaque 500 and the batched `moderation_log` row is rolled back with it.

**Failing input → wrong outcome:** preset A holds signature `S` and is `flagged` (or `rejected`) — outside the index (`WHERE status IN ('approved','pending')`, `schema.sql:92`). While it sits there, user C submits the same dye set: `findDuplicatePreset` (`preset-service.ts:361`) filters on the same two statuses, finds nothing, and C's row is created `approved` with `S`. The moderator now unflags A → `prepareStatusUpdate` writes `status='approved'` → `UNIQUE constraint failed: presets.dye_signature` → `await c.env.DB.batch(...)` rejects → `app.onError` → `500 {"error":"INTERNAL_ERROR","message":"An unexpected error occurred"}`. `prepareRevert` (`preset-service.ts:461`, unconditional `status = 'approved'` at `:470`) has the identical exposure. The owner-side twin is handled but confusing: `PATCH /:id` on a `rejected` preset flips it to `pending` (`presets.ts:489-492`), hits the same constraint, and the catch at `presets.ts:720` only builds a duplicate summary `if (body.dyes)` — a text-only resubmission therefore returns a bare 409 *"This dye combination already exists"* naming a field the author never touched, and the preset can never be resubmitted.

**Why tests miss it:** the string `UNIQUE` does not occur in any file under `tests/` — no suite ever makes a D1 write reject.

**Covered by test:** no.

```ts
// handlers/moderation.ts:97
const [updateResult] = await c.env.DB.batch<PresetRow>([
  prepareStatusUpdate(c.env.DB, presetId, body.status, preset.status, now),
  c.env.DB.prepare(`INSERT INTO moderation_log ... WHERE changes() > 0`)
    .bind(logId, presetId, auth.userDiscordId!, action, body.reason || null, now),
]);   // no try/catch — a dye_signature collision escapes as a 500
```

**Fix:** wrap both moderation batches in the same `UNIQUE constraint failed … dye_signature` recovery the submit/edit paths already use, returning a 409 that names the colliding preset (moderators may see any status); and in `presets.ts:721` look the duplicate up by the **stored** signature when `body.dyes` is absent.

---

### presets-api-02 — BUG — LOW — `src/handlers/moderation.ts:364`

**Claim:** `getActionFromStatusChange` logs `approve` for every transition to `pending` — the only case its fallback can reach.

**Failing input → wrong outcome:** `PATCH /api/v1/moderation/:id/status {"status":"pending"}` (allowed by `MODERATION_VALIDATION_RULES.validStatuses`, `validation-service.ts:49`). `flagged→approved` is caught above, `approved`/`rejected`/`flagged` each have their own branch, so `pending` is the *only* value that reaches `return 'approve'`. The audit trail then records "approve" for an action that pulled a preset **out** of public view, and `/moderation/stats` + `/:id/history` repeat it.

**Why tests miss it:** `tests/handlers/moderation.test.ts:1051-1140` covers pending→approved, flagged→approved, →rejected and →flagged; there is no →pending case.

**Covered by test:** no.

```ts
// handlers/moderation.ts:354
function getActionFromStatusChange(oldStatus, newStatus) {
  if (oldStatus === 'flagged' && newStatus === 'approved') return 'unflag';
  if (newStatus === 'approved') return 'approve';
  if (newStatus === 'rejected') return 'reject';
  if (newStatus === 'flagged') return 'flag';
  return 'approve'; // Default fallback (e.g., pending -> approved)  <-- only reachable for 'pending'
}
```

**Fix:** add `if (newStatus === 'pending') return 'requeue';` (widening the `moderation_log.action` vocabulary) or reject `pending` in `validateModerationStatus` if re-queueing is not a supported moderator action.

---

### presets-api-03 — BUG — MEDIUM — `src/handlers/presets.ts:952` and `:1013`

**Claim:** `POST /api/v1/presets` reports `remaining_submissions` from the **deletable** `presets` row count, while the limiter that actually gates the next request uses `max(rows, append-only events)` — so the number is wrong for anyone who has deleted a preset today, and disagrees with `GET /presets/rate-limit`.

**Failing input → wrong outcome:** submit 3 presets, delete all 3, submit a 4th. `getSubmissionCountToday` (`rate-limit-service.ts:69`, counts `presets` rows) returns 1 → the 201 says `remaining_submissions: 9`. `GET /presets/rate-limit` → `checkSubmissionRateLimit` (`:210`, `Math.max(rowsToday, eventsToday)` = 4) → `remaining: 6`. The web app's counter is over by exactly the number of deletions, and the user is refused at 6, not 9. The same variable is the BUG-049 overshoot guard at `:953` (`submissionsToday > DAILY_SUBMISSION_LIMIT`), so the concurrency rollback also under-triggers for a user who has deleted rows — the very case FINDING-008 introduced `submission_events` to close.

**Why tests miss it:** `remaining_submissions` appears in zero test files.

**Covered by test:** no.

```ts
// handlers/presets.ts:952
const submissionsToday = await getSubmissionCountToday(c.env.DB, auth.userDiscordId!); // presets rows only
if (submissionsToday > DAILY_SUBMISSION_LIMIT) { /* rollback */ }
...
remaining_submissions: Math.max(0, DAILY_SUBMISSION_LIMIT - submissionsToday),  // :1013
```

**Fix:** use `Math.max(getSubmissionCountToday, getEventCountToday(..., 'submission'))` for both the guard and the reported remainder — i.e. reuse `checkSubmissionRateLimit`'s rule in one helper.

---

### presets-api-04 — BUG — MEDIUM — `src/services/notification-service.ts:173` (+ `src/utils/env-validation.ts:287`)

**Claim:** a missing `DISCORD_WORKER` binding or `INTERNAL_WEBHOOK_SECRET` makes every moderator notification resolve as success — no throw, no `.catch`, no dead-letter row — and `validateEnv` does not require either in production.

**Failing input → wrong outcome:** drop `INTERNAL_WEBHOOK_SECRET` from the production worker (a secret-rotation slip; the wrangler.toml comment block at `wrangler.toml:88` shows four *other* secrets were deleted on 2026-09-01). `notifyDiscordBot` returns at line 174 with an `info` log; the `.catch(... storeFailedNotification ...)` at `presets.ts:985` never runs, so nothing lands in `failed_notifications` and `GET /moderation/failed-notifications` stays empty. Every flagged submission, resubmission and preview upload silently stops reaching the moderation channel; the only remaining signal is a moderator manually opening `GET /moderation/pending`. `validateEnv` (`env-validation.ts:287-299`) hardens JWT_SECRET / JWT_ISSUER / TOKEN_BLACKLIST / RL_PUBLIC for exactly this "degraded silently" class but omits `INTERNAL_WEBHOOK_SECRET`, `DISCORD_WORKER`, `IMAGE_WORKER` and `THUMBNAILS`.

**Why tests miss it:** `createMockEnv` (`tests/test-utils.ts:50-51`) sets both to `undefined` by default, so the skip branch is the *normal* test path and is never asserted as a failure.

**Covered by test:** no (the branch is exercised, its consequence is not).

```ts
// services/notification-service.ts:173
if (!env.DISCORD_WORKER || !env.INTERNAL_WEBHOOK_SECRET) {
  (logger ?? console).info('Discord worker binding not configured, skipping notification');
  return;                        // resolves — caller's .catch()/dead-letter never runs
}
```

**Fix:** add `INTERNAL_WEBHOOK_SECRET` (and the `DISCORD_WORKER` / `IMAGE_WORKER` / `THUMBNAILS` bindings) to the `ENVIRONMENT === 'production'` block of `validateEnv`; keep the skip only for non-production.

---

### presets-api-05 — BUG — MEDIUM — `src/middleware/rate-limit.ts:363`

**Claim:** every request arriving over a Service Binding shares one rate-limit bucket keyed `unknown`, so both bots and all their Discord users compete for a single 100 req/min allowance.

**Failing input → wrong outcome:** `getClientIp` (`packages/worker-kit/src/rate-limiter/ip.ts:60-78`) returns `'unknown'` when `CF-Connecting-IP` is absent, and `apps/discord-worker/src/services/preset-api.ts:140` builds `new Request('https://internal' + path, { method, headers, body })` with no such header (moderation-worker likewise). `publicRateLimitMiddleware` is mounted on `/api/*` **before** `authMiddleware` (`index.ts:152` vs `:163`), so there is no authenticated bypass: at ~1.7 rps aggregate across every guild, `/preset` commands start 429-ing each other. The comment at `middleware/rate-limit.ts:316-318` says the native `RL_PUBLIC` binding fixed the shared `unknown` bucket, but it only made the counting atomic — the bucket is still shared.

**Why tests miss it:** `tests/middleware/rate-limit*.test.ts` assert header shape and backend selection with a single synthetic key; nothing exercises two distinct bot users.

**Covered by test:** no.

```ts
// middleware/rate-limit.ts:360
export function createPublicRateLimitMiddleware(): MiddlewareHandler {
  return rateLimitMiddleware({
    backend: (c) => selectPublicRateLimiter(c.env),
    keyExtractor: (c) => getClientIp(c.req.raw),   // 'unknown' for every service-binding call
    config: PUBLIC_LIMIT,
  });
}
```

**Fix:** key on the acting identity when there is one — e.g. `c.req.header('X-User-Discord-ID') ?? getClientIp(...)`, or move the public limiter behind `authMiddleware` and give bot-sourced requests a per-user bucket.

---

### presets-api-06 — BUG — MEDIUM — `src/services/preview-image-service.ts:151`

**Claim:** the image-worker service-binding call is the only outbound `fetch` in this worker without an `AbortSignal`; a stalled Photon decode holds the author's upload request open with no bound.

**Failing input → wrong outcome:** a 5 MB PNG that makes `@cf-wasm/photon` spin (or an image-worker isolate under memory pressure). `await env.IMAGE_WORKER.fetch(...)` has no timeout, so `POST /:id/preview-image` blocks until the runtime kills the request — the author sees a hang, not the `400 "Image could not be processed"` the surrounding `try/catch` was written for. Perspective (`moderation-service.ts:305`) and the cache purge (`preview-image-service.ts:83`) both use `AbortSignal.timeout(5000)`, and the discord-worker's client to *this* worker uses `AbortSignal.timeout(PRESET_API_TIMEOUT_MS)` — this is the one hop with no ceiling.

**Why tests miss it:** the mock `IMAGE_WORKER` in `tests/test-utils.ts:53-61` resolves immediately; no test simulates a slow binding.

**Covered by test:** no.

```ts
// services/preview-image-service.ts:151
const response = await env.IMAGE_WORKER.fetch(
  new Request('https://image-worker/thumbnail', { method: 'POST', body: bytes })
);   // no signal — unbounded wait on the user-facing upload path
```

**Fix:** `signal: AbortSignal.timeout(10_000)` on the request; the existing `catch` at `presets.ts:1112` already turns it into the 400.

---

### presets-api-07 — BUG — LOW — `src/services/notification-service.ts:428`

**Claim:** `listFailedNotifications` swallows every D1 error into an empty array, so a database incident presents to a moderator as "the dead-letter queue is clear".

**Failing input → wrong outcome:** any transient D1 error on the `SELECT` (the justification comment — "table may not exist yet if migration hasn't run" — refers to migration 0005, applied long ago). `GET /api/v1/moderation/failed-notifications` returns `{"notifications":[],"total":0}` with HTTP 200; the moderator concludes nothing was missed. The sibling `resolveFailedNotification` deliberately lets its error propagate, so the two paths disagree about what a D1 failure means.

**Why tests miss it:** the only throwing mock in `tests/services/notification-service-deadletter.test.ts:171-176` and `:228-234` makes the **prune DELETE** throw and lets the `SELECT` succeed with `[]` — so the `catch` around the SELECT itself is never entered by any test.

**Covered by test:** no.

```ts
// services/notification-service.ts:425
try {
  const result = await db.prepare(query).all<FailedNotificationRow>();
  return (result.results || []).map(summarizeFailedNotification);
} catch {
  return [];        // D1 outage is indistinguishable from "queue empty"
}
```

**Fix:** narrow the catch to `no such table` (or drop it entirely now that 0005 is applied everywhere) and let anything else become a 500.

---

### presets-api-08 — BUG — LOW — `src/services/preset-service.ts:318`

**Claim:** `has_more` is computed from the *post-filter* preset count, so a row skipped as corrupt makes the last page claim there is another one.

**Failing input → wrong outcome:** `total = 21`, `limit = 20`, page 2 returns one row whose `dyes` column is unparsable. `rowsToPresets` (`:199`) drops it, `presets.length = 0`, so `has_more = 20 + 0 < 21 = true`; the client fetches page 3, gets `presets: []` and (via the `page > 1` fallback at `:303`) `total: 21` again — an infinite "load more". The same skew makes `total` and the returned page length disagree on any page containing a corrupt row.

**Why tests miss it:** `tests/services/preset-service.test.ts:239-278` only feeds well-formed rows, and no test anywhere hands `getPresets` a row that `rowToPreset` throws on (the single corruption test, `:750`, is a direct `rowToPreset` call for `secondary_categories`, which degrades rather than throws).

**Covered by test:** no.

```ts
// services/preset-service.ts:311-319
const presets = rowsToPresets(rows, logger);   // may be shorter than `rows`
return { presets, total, page, limit, has_more: offset + presets.length < total };
```

**Fix:** `has_more: offset + rows.length < total` — pagination position is a property of the query, not of how many rows survived parsing.

---

### presets-api-09 — UNTESTED — `src/services/moderation-service.ts:200` / `tests/services/moderation-service.test.ts:60-98,147-215`

**Behaviour that should be caught:** BUG-002 — `\b` never matches next to CJK, so ja/ko/zh entries are compiled into a separate boundary-less `cjkPattern` and both patterns must be tried.

Nothing tests `cjkPattern`. `compileProfanityPatterns` is only asserted on ASCII (`{ en: ['bad','word'] }`), and every `checkLocalFilter` test uses injected ASCII patterns via `_setTestPatterns`, which hard-codes `cjkPattern: null` (`moderation-service.ts:174`). Deleting `profanity.cjkPattern` from the `patterns` array at `:200` — or reverting the `asciiWords`/`cjkWords` split at `:102-103` — leaves the entire suite green while silently disabling matching for 6 of the 11 shipped entries (`ai垃圾`, `ai水文`, `ai 쓰레기`, `ai 퀄리티 낮음`, `aiのガラクタ`, `aiのゴミ`) and for `ki-füllmaterial`.

**Fix:** add `expect(checkLocalFilter('ai垃圾', 'clean')?.passed).toBe(false)` (one per script) against the *real* lists, plus `compileProfanityPatterns({ zh: ['ai垃圾'] }).cjkPattern` non-null / `combinedPattern` null.

---

### presets-api-10 — UNTESTED — `tests/services/preset-service.test.ts:280-289`

**Behaviour that should be caught:** LIKE-wildcard escaping in the search filter (`escapeLikePattern`, `preset-service.ts:32`).

The test named *"should escape LIKE pattern special characters in search"* asserts only `expect(query).toBeDefined()` where `query = db._queries.find(q => q.includes('LIKE'))` — i.e. that the search branch ran. Replacing `escapeLikePattern`'s body with `return str` keeps it green, and a search for `%` would then match every preset.

**Fix:** assert the binding: `expect(db._bindings.flat()).toContain('%test\\%\\_\\\\string%')`.

---

### presets-api-11 — UNTESTED — `tests/services/preset-service.test.ts:291-298` (and `:227-237`)

**Behaviour that should be caught:** that `is_curated: false` binds `0` into the WHERE clause.

`expect(db._bindings.some((b) => b.includes(0))).toBe(true)` is satisfied by the **OFFSET** binding, which is `0` on page 1 (`bind(...params, limit, offset)`, `:293`). Deleting the whole `is_curated` block at `:257-260` leaves the assertion true. The neighbouring pagination test (`:236`, `b.includes(10) && b.includes(20)`) is order-blind for the same reason and cannot detect a `limit`/`offset` swap.

**Fix:** assert the full binding tuple, e.g. `expect(db._bindings[0]).toEqual(['approved', 0, 20, 0])`.

---

### presets-api-12 — UNTESTED — `src/handlers/presets.ts:715-737`, `:918-932`, `:946-968`

**Behaviour that should be caught:** the three D1-failure recovery paths — PRESETS-CRITICAL-001 (submit races the unique index → vote on the winner), BUG-003 (edit races it → 409), BUG-049 (post-insert overshoot → rollback of preset + votes).

Neither `UNIQUE` nor `remaining_submissions` appears anywhere under `tests/`; no suite makes an `INSERT INTO presets` / `UPDATE presets` reject, even though `_setupMock` can throw (the dead-letter suite already does exactly that for its prune). All three branches — including the `DELETE FROM votes` / `DELETE FROM presets` rollback batch, which destroys a user's just-created preset — are dead to the suite.

**Fix:** `db._setupMock(q => { if (/INSERT INTO presets/i.test(q)) throw new Error('D1_ERROR: UNIQUE constraint failed: presets.dye_signature'); … })` and cover the submit-race (→ vote + 200), edit-race (→ 409) and overshoot (→ 429 + both DELETEs issued) cases.

---

### presets-api-13 — UNTESTED — `tests/data/profanity.test.ts:69-140`

**Behaviour that should be caught:** that each locale list is non-empty and lowercase.

Every assertion is inside `list.forEach(word => expect(...))`. Emptying any list makes the callback never run, so all four checks vacuously pass — the test titles even say "if not empty". The suite therefore cannot notice a locale losing its entries, which is precisely how the filter would silently stop covering a language.

**Fix:** add `expect(list.length).toBeGreaterThan(0)` before each `forEach` (or assert exact contents).

---

### presets-api-14 — REFACTOR — `src/middleware/auth.ts:385/419/441`, `src/index.ts:183/195`, `src/middleware/body-validation.ts:179/202/262/270`

Four different error shapes leave this worker: `{success:false, error: ErrorCode.X, message}` (the documented one, `utils/api-response.ts`), `{error:'Unauthorized'|'Forbidden'|'Bad Request', message}` (all three `require*` guards — no `success`, no `ErrorCode`), `{error:'Unsupported Media Type', message}` (the Content-Type gate) and `{success:false, error:'PAYLOAD_TOO_LARGE'|'BAD_REQUEST'|'VALIDATION_ERROR', message}` (body validation — codes that are not in the `ErrorCode` map). A client cannot switch on `error` reliably, and `success` is absent on the two most common rejections (401/415).

**Fix:** route the guards and the two middleware through `unauthorizedResponse`/`forbiddenResponse`/`validationErrorResponse`, and add `PAYLOAD_TOO_LARGE`/`UNSUPPORTED_MEDIA_TYPE` to `ErrorCode`.

---

### presets-api-15 — REFACTOR — `src/handlers/presets.ts:312`, `:866`, `:962`; `src/services/moderation-service.ts:69/98/118`

`DAILY_SUBMISSION_LIMIT` is imported into `presets.ts` (`:56`) yet the value `10` is hardcoded in three user-facing places — `GET /rate-limit`'s `limit: 10` and both 429 messages — while the other three caps correctly interpolate their constants (`:620`, `:696`, `:1070`). Raising the cap would ship a limiter and a UI that disagree. Separately, `CompiledProfanity.wordSet` is built at `:98`, returned at `:118` and asserted in tests (`moderation-service.test.ts:69,95`) but read by nothing — the "fast path" it documents does not exist.

**Fix:** interpolate `${DAILY_SUBMISSION_LIMIT}` in all three spots; delete `wordSet` (and its two assertions) or actually use it as the pre-filter.

---

### presets-api-16 — OPT — `src/services/rate-limit-service.ts:175`

`recordSubmissionEvent` runs `pruneSubmissionEvents` — an unindexed-by-user `DELETE FROM submission_events WHERE created_at < ?` — before **every** quota write, i.e. on every submission, every name/description edit and every preview upload. The 30-day window means the statement matches nothing on the overwhelming majority of calls, but it is still a second serialized D1 round-trip on the hot write path (and `POST /presets` separately `waitUntil`s `pruneFailedNotifications`, which is two more). `idx_submission_events_created` makes it cheap, not free.

**Fix:** sample it (e.g. run the prune on ~1 % of writes, or only when `Date.now()` crosses an hour boundary held in an isolate-local variable) — the retention promise is a window, not a per-write guarantee.

---

## 3. POSITIVE — do not re-file

- **The visibility rule is genuinely centralised.** `canSeePreset` (`presets.ts:133`) is applied on GET, DELETE, PATCH and both preview-image routes, and `presetForViewer`/`toPublicPreset` (`preset-service.ts:169`) is the single author-identity gate — anonymous callers get no `author_discord_id`, and `previous_values` is stripped for everyone but the owner/moderator.
- **Owner PATCH cannot re-approve.** `updatePreset` (`preset-service.ts:588`) reads only the seven editable columns plus the caller-computed `newStatus`; `ownerEditOutcome` (`presets.ts:459`) can only ever return `'pending'` or "don't write status", and `hidden` is refused outright at `:584`.
- **The duplicate check and the partial index agree on the INSERT paths.** `findDuplicatePreset` / `findDuplicatePresetExcluding` use exactly `status IN ('approved','pending')`, matching migration 0006 — the BUG-003 regression is not back (only the *transition* path is unguarded, see 01).
- **Timestamp formats are handled with unusual care.** `toSqliteDateTime` (`notification-service.ts:128`) deliberately renders `datetime('now')` format for `failed_notifications`, `submission_events` uses `strftime('%Y-%m-%dT%H:%M:%fZ')` to match `toISOString()`, and `/moderation/stats` binds `strftime(...)` rather than `datetime('now')`. No mixed-format comparison found in this worker's own writes.
- **Votes are atomic and self-healing.** `INSERT … ON CONFLICT DO NOTHING` plus a `vote_count = (SELECT COUNT(*) …)` recompute in the same `db.batch()` (`votes.ts:64`, `:120`), gated by `APPROVED_PRESET_GATE` on both directions.
- **Bot auth is v2-only with a KV replay cache and a constant-time secret compare** (`auth.ts:136`, `:202`, `:304`); `X-User-Discord-ID` is honoured only behind a valid signature, and the web path resolves identity from the JWT alone (`resolveJWTUserId`).
- **Ban check fails closed** (503 outside `development`, `ban-check.ts:61`) and is registered router-level for every mutating method on both routers.
- **R2 ordering is consistent and documented everywhere**: DB write first, R2 delete second, orphan accepted; `deletePreviewImage` deletes then purges, never the reverse.

## 4. REJECTED

- *`\b` around CJK regression (BUG-002)* — the ascii/cjk split at `moderation-service.ts:102-103` is intact and correct; only its **test coverage** is missing (filed as 09).
- *Perspective fail-closed / 2026-12-31 sunset* — already documented at `moderation-service.ts:232-244` and in DEPRECATIONS.md; unset key → local list decides, failed call → `perspective_unavailable` (`passed:false`) → queued. No regression, and the graceful path (delete the secret) is recorded.
- *Legacy itemIDs on the preset path* — `validatePresetDyes` (`validation-service.ts:217-223`) rejects `>= 5000` and `> 254` loudly on both submit and edit; `generateDyeSignature` is recomputed from the same validated array on every write. No `resolvePresetDye`/legacy fallback survives in this worker.
- *JWT audience not enforced* — `verifyJWT` supports `audience` (`packages/auth/src/jwt.ts:78`) but the oauth worker mints no `aud` claim, so there is nothing to pin; `iss` **is** pinned and required in production.
- *`c.req.arrayBuffer()` in `authMiddleware` after `jsonDepthLimit` already cached `text()`* — Hono re-encodes the cached text, which is byte-identical for the UTF-8 JSON both bots send, so the v2 body hash still verifies.
- *`prepareStatusUpdate`'s `changes() > 0` guard inside a `db.batch`* — D1 runs batch statements sequentially on one connection, so `changes()` sees the preceding UPDATE; covered by `tests/handlers/moderation.test.ts:368-390`.
- *Category cache poisoning by a rejected fetch* — `categoriesFetchPromise` is cleared in `.finally()` (`category-service.ts:281`), so a rejection is not cached; likewise `pendingCategoryListFetch` in `categories.ts:77`.
- *Missing `Vary: Origin` on the cached `/api/v1/categories` response* — Hono 4.13.5 appends it after `next()` (`hono/dist/middleware/cors/index.js:80-82`) for every non-OPTIONS request.
- *Security headers absent on thrown-error responses* (`index.ts:82-92` sets them after `await next()`, which rejects) — only affects uncacheable 500 JSON; not exploitable.
- *Path traversal via the R2 key* — `storePreviewImage` interpolates `presetId`, but the route only reaches it after `getPresetImageState` found the row, and every stored id came from `crypto.randomUUID()`.
- *`resolveFailedNotification` binding a string id against `INTEGER PRIMARY KEY`* — SQLite applies INTEGER affinity to the comparison, so `'5'` matches `5`.
- *Pagination `NaN`/negative/huge* — `Math.max(1, parseInt(...) || 1)` and `Math.min(Math.max(1, …), 50)` (`presets.ts:239-240`) clamp all of them; the `page > 1` empty-page fallback (`preset-service.ts:303`) keeps `total` stable.

## 5. COVERED — 43 files read

**Source (26):** `src/index.ts`, `src/types.ts`, `src/handlers/{presets,votes,moderation,categories}.ts`, `src/middleware/{auth,ban-check,body-validation,rate-limit}.ts`, `src/services/{preset,rate-limit,moderation,notification,preview-image,validation,category}-service.ts`, `src/utils/{api-response,env-validation}.ts`, `src/data/profanity/{index,en,de,fr,ja,ko,zh}.ts`, `scripts/migrate-presets.ts` (header).

**Schema / config (16):** `schema.sql`, `migrations/{0002,0003,0004,0005,0006,0007,0008,0009,0010,0011,0012,0013}*.sql`, `migrations/002_add_composite_indexes.sql`, `wrangler.toml`, `package.json`.

**Tests skimmed (8):** `tests/test-utils.ts`, `tests/data/profanity.test.ts`, `tests/services/{preset-service,moderation-service}.test.ts`, `tests/handlers/{moderation,presets,presets-quotas,votes}.test.ts` (targeted reads + pattern sweeps across all 27 test files).

**Read outside scope to confirm claims:** `packages/worker-kit/src/rate-limiter/ip.ts`, `packages/worker-kit/src/middleware/rate-limit.ts`, `packages/auth/src/jwt.ts`, `apps/discord-worker/src/services/preset-api.ts`, `apps/image-worker/src/index.ts` (header), `node_modules/.pnpm/hono@4.13.5/.../middleware/cors/index.js`.
