# Review: presets-api services (key `presets-api-services`, deploy unit `presets-api`)

Audit 2026-10-26, HEAD 13c386e5. Read-only review of `apps/presets-api/src/services/*`, the
retention cron, the moderation/Perspective pipeline, daily caps, discord-worker notifications,
image-worker thumbnail calls and ban handling. Advisor/Fable not used (user instruction).

## Module / outbound-call table

| Module (file) | Role | D1 / R2 / outbound | Called from | Auth context |
|---|---|---|---|---|
| `services/moderation-service.ts` | local word list + Perspective | `fetch` commentanalyzer.googleapis.com, header key, `doNotStore`, 5 s timeout | POST /presets (`handlers/presets.ts:1031`), PATCH /presets/:id (`:708`) | JWT or signed bot |
| `services/rate-limit-service.ts` | daily caps (10 submit / 10 flagged edit / 30 text edit / 20 preview) + `submission_events` prune | D1 bound statements | POST, PATCH, preview upload | JWT or signed bot |
| `services/notification-service.ts` | `DISCORD_WORKER` fan-out, retry x3, dead letter, prune | service binding `/webhooks/preset-submission` (bearer `INTERNAL_WEBHOOK_SECRET`); D1 `failed_notifications` | POST/PATCH/preview upload via `waitUntil`; moderator dead-letter routes | JWT/bot; moderator for list/resolve |
| `services/preview-image-service.ts` | sniff, `IMAGE_WORKER /thumbnail` (10 s), R2 put, delete + CF purge (5 s) | service binding, R2 `THUMBNAILS`, `api.cloudflare.com` purge | preview upload/delete, preset delete, moderator image reject | owner / moderator |
| `services/preset-service.ts` | preset queries, author-id visibility rule (`toPublicPreset`) | D1, all `.bind()`; interpolated fragments are constants | all preset routes | any |
| `services/moderation-retention-service.ts` | 90 d lifted bans, 12 mo ban/unban/hide/restore log rows | D1 batch | cron + moderator write paths | n/a |
| `services/identity-rekey-service.ts` | FINDING-014 UUID -> snowflake move, ban-guarded per statement | D1 batch | PATCH /presets/refresh-author (ids from JWT claims only, `presets.ts:371-379`) | web JWT |
| `services/category-service.ts` | 60 s module-scope category-id cache | D1 | validation | n/a |
| `services/validation-service.ts` | name/description/tag/dye/link validators | none | POST/PATCH | n/a |
| `retention-job.ts` | daily cron `23 4 * * *` (prod only), three prunes under allSettled, rejects waitUntil on failure | D1 | `scheduled` (`index.ts:305`) | n/a |
| `middleware/ban-check.ts` | router-level ban gate on every mutating method, fail closed outside development | D1 | presets/votes routers | JWT/bot |

### Authz matrix of the routes these services back (spot-checked)

| Route | Anonymous | Authenticated user | Owner | Moderator |
|---|---|---|---|---|
| GET /presets (status!=approved) | 403 | 403 | 403 | yes (`presets.ts:235-240`) |
| POST /presets | 401 | yes (ban gate, daily cap) | - | yes |
| PATCH /presets/:id | 401 | 404/403 | yes (rev CAS `preset-service.ts:716`) | - |
| POST /presets/:id/preview-image | 401 | 404/403 | yes (`presets.ts:1200-1213`) | - |
| PATCH /moderation/:id/preview-image | 401 | 403 | 403 | yes, key-bound CAS (`moderation.ts:423-450`) |
| GET/PATCH /moderation/failed-notifications | 401 | 403 | 403 | yes (`moderation.ts:523-546`) |

## Candidates

### presets-api-services-01 (LOW, INTERNET-AUTH) - POST /presets spends a Perspective call before any quota is reserved; a same-dye concurrent burst is charged one submission
- `handlers/presets.ts:998` `checkSubmissionRateLimit` is a read-only pre-check (no reservation),
  `:1031` calls `moderateContent` (Perspective) next, and `:1058-1064` answers a `dye_signature`
  UNIQUE collision with `respondToDuplicate` (`:171-205`, which records no `submission_events` row);
  the only quota record is `:1075`, after a successful INSERT.
- So N concurrent POSTs from one account with the same fresh dye set make N Perspective calls but
  one INSERT and one `submission` event; repeated with a new dye set each burst (10 per day), one
  account can issue roughly 10 x (per-user limiter, 100/min) Perspective calls per day. Perspective's
  quota is ~1 QPS (`security-trade-offs.md:297`), so the burst 429s every other user's concurrent
  submission/edit into `perspective_unavailable` -> `pending` (fail closed: no publish bypass, but
  auto-approval and the moderator queue are degraded). The PATCH path closes exactly this with
  reserve-before-spend (`presets.ts:683`, trade-offs Mitigation 2/3); POST does not.
- Not run live: race inferred from code; requires concurrent requests landing before the first INSERT.

### presets-api-services-02 (LOW, INTERNET-AUTH) - Preview-upload slot is refunded when image-worker decode fails, so decodes are uncapped per day
- `handlers/presets.ts:1290-1299`: `storePreviewImage` throwing (image-worker non-OK or the 10 s
  timeout, `preview-image-service.ts:143-153`) calls `uploadReservation.release()`, deleting the
  `preview_upload` row (`rate-limit-service.ts:320-330`). The FINDING-008 comment at `:1215-1216`
  states the cap exists because "each upload costs an image-worker decode".
- An owner of any preset can therefore POST 5 MB bodies that sniff as PNG/JPEG/WebP but fail to
  decode, indefinitely, bounded only by the 100/min per-user limiter. Precondition not confirmed: how
  much photon work a truncated-but-valid-header image costs before it errors (image-worker's
  pre-decode 9.4 MP gate bounds the worst case).

## POSITIVE controls (verified this checkout)
- Perspective key in `x-goog-api-key` header, `doNotStore: true`, 5 s `AbortSignal.timeout`;
  non-OK/throw/malformed body -> `perspective_unavailable` (`passed:false`); no key -> `unscored`
  (`passed:false`) (`moderation-service.ts:255-277, 279-296, 328-332, 377-384`). FINDING-019 and
  2026-08-29 FINDING-005/006 hold.
- Local filter: escaped single alternation regex, no `g` flag (no lastIndex state), CJK path
  boundary-less (`moderation-service.ts:73-87`).
- Daily caps: reserve-then-count with `id <= rowId` tie-break (`rate-limit-service.ts:291-356`);
  PATCH reserves `text_edit` before Perspective and never refunds it (`presets.ts:683-701`).
- Dead letter keeps only `{type, preset_id, moderation_status, content_revision}`
  (`notification-service.ts:182-191`); listing projects legacy rows down to id
  (`:463-497`); prune 30 d resolved / 90 d unresolved with SQLite-format cutoffs (`:218-220, 352-385`).
- discord-worker webhook 4xx bodies are fixed strings, so `failed_notifications.error` cannot carry
  content (`apps/discord-worker/src/index.ts:305-362`).
- R2 keys are `${presetId}/${randomUUID}.webp` (`preview-image-service.ts:156`), presetId is a row the
  caller owns; moderator image decisions bind the reviewed key with a strict regex and CAS
  (`moderation.ts:389-450`); delete-then-purge order (`preview-image-service.ts:182-190`).
- Upload body stream-capped at 5 MB before buffering (`middleware/body-validation.ts:61-88`), magic-byte
  sniff (`preview-image-service.ts:121-123`), image-worker re-caps 10 MB and applies the header
  dimension / 9.4 MP gate (`apps/image-worker/src/index.ts:185-208`).
- Retention cron: three isolated prunes, counts/names only in logs, `waitUntil` promise rejects on a
  failed sweep (`retention-job.ts:58-133`); moderation retention 90 d / 12 mo (`moderation-retention-service.ts:22-97`).
- Re-key: fromId/toId only from verified JWT claims, ban guard inside every statement, self-move
  refused (`identity-rekey-service.ts:22-71`, `presets.ts:371-379`).
- Ban gate matches acting id, JWT sub and JWT discord_id against both ban columns, 503 on lookup failure
  outside development (`ban-check.ts:48-64, 89-112, 147`).
- D1: every service statement uses `.bind()`; interpolations are constants (`preset-service.ts:286-287,
  715`, `rate-limit-service.ts:120`, `moderation-retention-service.ts:74-85`, `ban-check.ts:56-59`).
- Author id stripped for anonymous viewers, kept only for owner/moderator (`preset-service.ts:169-193`).

## REJECTED
- Tags never pass content moderation (`validation-service.ts:153-159, 294-305`) - re-file of 2026-08-21 PAPI-6 / FINDING-019; remediated by narrowing the charset, code comment documents the choice.
- Perspective `attributeScores: {}` reads as all-zero pass (`moderation-service.ts:293-304`) - no confirmed path where Google returns 200 with requested attributes missing; speculative.
- Pending preview images publicly readable on shots.xivdyetools.app - documented (`preset-service.ts:505-512`) and re-file of the 2026-10-03 rejected R2 orphan item; key is an unguessable UUID the uploader never receives.
- Approved preview image stays in R2 when a ban hides the preset (`moderation-worker ban-service.ts:687`) - hide is reversible and restore needs the object; the image was moderator-approved.
- Viewer-specific responses without Cache-Control: private - 2026-10-03 rejected (PAPI-15).
- Notification payload carries `author_discord_id` to discord-worker - internal service binding, embed shows sanitized name only; not stored in the dead letter.
- Concurrent preview uploads orphan one R2 object - 2026-10-03 rejected suspicion.
- Huge `page` produces an out-of-int64 OFFSET 500 (`preset-service.ts:282`) - harmless error, handler reviewer's scope.
- `reserveDailyEvent` fails open on D1 error / missing migration 0012 (`rate-limit-service.ts:304-318`) - documented coordinator ruling and accepted fail-open rate limiting.

## FILES COVERED (17)
- `apps/presets-api/src/services/` (9: moderation, rate-limit, notification, preview-image, preset, moderation-retention, identity-rekey, category, validation [partial])
- `apps/presets-api/src/retention-job.ts`, `apps/presets-api/src/index.ts` (scheduled wiring)
- `apps/presets-api/src/middleware/` (ban-check, body-validation, rate-limit [partial])
- `apps/presets-api/src/handlers/` (presets.ts [partial: list, refresh-author, POST, PATCH, preview upload], moderation.ts [partial: preview-image, route map])
- cross-unit spot reads: `apps/discord-worker/src/index.ts:285-520` (webhook), `apps/image-worker/src/index.ts:175-222`
