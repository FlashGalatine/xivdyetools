# Review: cross-PR contract, revision-bound moderation (#224 presets-api 2.4.0, #225 moderation-worker 1.8.0, #227 discord-worker 5.8.0)

Preview branch @80262a2f. Read-only review; no tests run (the contract spans three apps and no test crosses them).

## Map: one review end to end

| Step | Where | What happens |
|---|---|---|
| 1 | presets-api `handlers/presets.ts:1067-1092` (submit), `:845-875` (edit) | Re-reads the row after the write, so the AFTER trigger's bump is visible (`RETURNING *` cannot see it). Builds the payload with `content_revision` and `status`; skipped if the status moved. `waitUntil(notifyDiscordBot)`, dead-letter on failure. |
| 2 | presets-api `migrations/0014`, `schema.sql:64-79` | AFTER UPDATE OF content columns, WHEN a column actually changed, `UPDATE presets SET content_revision = OLD+1`. `content_revision` is not in the OF list, so it cannot recurse. Same text in the migration and `schema.sql` (parity test). |
| 3 | discord-worker `index.ts:402-409` webhook, `preset-notifications.ts:100-230` | Pending only. `reviewCustomId` emits `preset_<k>_<uuid>:<rev>:<status>`, or the legacy id when the revision or status is missing or the id is over 100 chars. Posted with `MODERATION_BOT_TOKEN`, so clicks route to moderation-worker. |
| 4 | moderation-worker `buttons/preset-moderation.ts`, `utils/review-custom-id.ts` | Strict parse. A legacy id never acts: `refreshInstead` defers and runs `refreshReview`. Reject and revert open a modal whose id repeats the binding. |
| 5 | moderation-worker `modals/preset-rejection.ts` | Same parse. A legacy modal refreshes. The binding goes into the request. |
| 6 | moderation-worker `services/preset-api.ts:206-236` | Sends `expected_revision` and `expected_status`. A 409 with `code` STALE_REVIEW or REVISION_REQUIRED becomes `PresetReviewConflictError`. |
| 7 | presets-api `handlers/moderation.ts:150-216` (status), `:230-300` (revert) | `parseReviewBinding` fails closed (409 REVISION_REQUIRED). The UPDATE is `WHERE status=? AND content_revision=?`, and revert also checks `previous_values=?`. It is batched with a `changes()>0` log INSERT, so zero rows means 409 STALE_REVIEW with a fresh `current` and no log row. |
| 8 | moderation-worker `handlers/review-message.ts:149-205` | On a conflict or a legacy click: GET `/moderation/:id` (`moderation.ts:455`), edit the message with the current text, fresh buttons and `components` always set, then a follow-up. |

Deploy states (what each partial state does):

| State | Result | Changelog says so? |
|---|---|---|
| presets-api 2.4.0 + old mw 1.7.x | Every approve, reject and revert gets 409 REVISION_REQUIRED, shown as "Failed to approve". Nothing written. | Yes (presets-api intro, mw intro). |
| new mw 1.8.0 + old presets-api 2.3.x | `GET /moderation/:id` does not exist in 2.3.x, so 404. Every legacy click, `/preset moderate approve`, and stale refresh reports "no longer exists" and strips the buttons. Bound approve and reject still work, since extra body fields are ignored. | No. See -02. |
| old discord-worker + presets-api 2.4.0 | The extra payload field is ignored and legacy ids are emitted. New mw turns each into a refresh click. Safe. | Yes (types comment, notifications comment). |
| new discord-worker before new mw | Old parser fails `isValidUuid` on `<uuid>:<rev>:<status>` and answers "Invalid preset ID format". Safe, nothing written. | Yes (dw intro). |
| new discord-worker + old presets-api | No `content_revision` in the payload, so legacy ids, then a refresh. The refresh needs `GET /:id`, which is the -02 state. | Partly. |

## Candidates

### contract-revision-binding-01 (BUG, MEDIUM, origin MAIN, aggravated by PR-#227) Confirmed: a bot-submitted pending preset gets two moderation posts, and the bot's own post always carries legacy ids
- `apps/discord-worker/src/handlers/commands/preset.ts:576` and `:924` call `notifyModerationChannel` (`:1137-1149`) and `notifyEditModerationChannel` (`:1156-1170`). Neither passes `contentRevision`, so `reviewCustomId` (`preset-notifications.ts:100-121`) returns `preset_approve_<uuid>` and so on.
- At the same time `presets.ts:1090` and `:868` call `notifyDiscordBot` unconditionally, whatever `auth.authSource` is. The webhook at `discord-worker/src/index.ts:402` posts a second embed with bound ids. A grep for `source === 'bot'` in both apps finds nothing, so nothing skips the duplicate.
- Failing state: `/preset submit` of a text that goes pending. Result: two messages in the moderation channel. The bot's copy is the one carrying Revert (kind `edit`; the webhook only ever posts kind `new`).
- PR effect: on main both posts could act. Now every click on the bot's post gets only a refresh and a "click again" (extra step), and the second message goes stale after the first decision, becoming "nothing left to review" on its next click. The same duplication applies to auto-approved bot submissions: `notifySubmissionChannel` plus the webhook's submission-log post (`index.ts` ~440).
- Tests: no. `index.test.ts` and `preset-notifications.test.ts` test each sender alone, never the pair.
- Excerpt: `await sendModerationNotification(env, { kind: 'new', preset, categoryName: ... }, logger)` in `preset.ts:1142-1149`, with no `contentRevision`.
- Fix: drop the bot-side post (presets-api already notifies for both sources), or keep one and skip the other on `source === 'bot'`. If the bot post is kept for Revert and the diff, pass `response.preset.content_revision` read after the write.

### contract-revision-binding-02 (BUG, MEDIUM, origin PR-#225) The new moderation-worker against a presets-api that lacks `GET /moderation/:id` deletes live buttons and the changelog is silent
- `preset-api.ts:357-358` and `:409` map any 404 to `null`. `review-message.ts:171-186` treats `!current` as "That preset no longer exists" and edits with `components: []`.
- On presets-api 2.3.x the only matching route is a GET `/:presetId/history` or the generic app 404 (`index.ts:259`). So `/api/v1/moderation/<id>` returns a route 404, indistinguishable by status from a real missing preset.
- Failing state: mw 1.8.0 deployed first, or presets-api rolled back. A moderator clicks any pre-deploy legacy button, or a stale button. Result: the embed gets "That preset no longer exists" and the buttons are stripped. `/preset moderate approve <id>` answers "Preset not found". The preset stays pending and is unreviewable from the embed.
- The changelogs only describe the other order (old mw against 2.4.0).
- Tests: no. The `getModerationPreset` tests mock a clean 404 as "preset missing".
- Fix: return null only when the body is the real `Preset not found` (`notFoundResponse`) and treat any other 404 as an error that keeps the buttons. Or add one changelog line that mw must not deploy before presets-api.

### contract-revision-binding-03 (REFACTOR, LOW, origin PR-#227 + PR-#225) The id grammar is hand-copied in two apps with no shared definition or cross-check
- `discord-worker/preset-notifications.ts:78-84` says "Copied from moderation-worker's review-custom-id.ts ... Keep in step". `moderation-worker/utils/review-custom-id.ts:70-83` holds the parser. The status set is also repeated in `moderation-worker/services/preset-api.ts:44-50` and `presets-api/handlers/moderation.ts:107`.
- Failing state: adding a status to one list. Result: discord-worker emits an id the parser calls malformed, or the reverse, and nothing red.
- Fix: put the builder, parser and status list in `@xivdyetools/bot-logic` (both apps depend on it), or at least a parity test reading both files. A `PresetStatus` const array in `@xivdyetools/types` would serve the status lists.

### contract-revision-binding-04 (BUG, LOW, origin PR-#224) The 2.4.0 changelog intro says "No schema change and no migration" but the Rollout section requires hand-running `0015` and adds a cron trigger
- `apps/presets-api/CHANGELOG.md:10-13` against `:88-105`, and `wrangler.toml:123-124` (`crons = ["23 4 * * *"]`).
- 0015 is a data rewrite, so "no schema change" holds, but "no migration" does not. A deployer who reads only the intro skips a step the privacy policy relies on.
- Fix: reword the intro line.

## POSITIVE

- The conditional UPDATE binds the caller's values, not the handler's read, and the log INSERT is gated on `changes() > 0` in the same `batch`. A stale action writes no row (`moderation.ts:222-240`, `:268-285`).
- Post-write re-read gives text, status and revision from one row, and the AFTER trigger cannot recurse (`content_revision` is outside the OF list).
- Every message edit in `review-message.ts` sets `components`, so old buttons cannot survive an edit. The refresh never acts and never throws.
- Parser is strict (length at most 100, UUID, no leading zeros, safe integer, known status). The longest bound id is 82 characters.
- discord-worker falls back to legacy ids when the revision is missing, and the legacy path is safe (refresh, never act).

## REJECTED

- A rev-bound approve of a hidden or banned preset bypassing the ban: moderation-worker checks `isPresetAuthorBanned` first, and the pre-PR code had the same reach.
- The trigger missing `updated_at` or vote writes: intended, documented in `schema.sql`.
- `parseCurrent` result unused: `refreshReview` re-fetches, so it is harmless.
- Race between the write and the re-read: both the text and the revision come from the one later row, so the buttons bind to the text shown. A decision in between is caught by the status check.
- A flagged preset offering no actions on refresh: webhook posts are pending only; `/preset moderate` still confirms flagged ones.
- Approve of an already-approved preset (a confirm button on a non-pending preset): writes an extra `approve` log row but changes nothing; low value.

## COVERED (read)

presets-api: `handlers/moderation.ts`, `handlers/presets.ts` (submit, edit, notify sections), `services/preset-service.ts` (prepareStatusUpdate, prepareRevert), `services/notification-service.ts`, `migrations/0014`, `0015`, `schema.sql`, `CHANGELOG.md`, `wrangler.toml` (cron).
moderation-worker: `utils/review-custom-id.ts`, `handlers/review-message.ts`, `handlers/buttons/preset-moderation.ts`, `handlers/modals/preset-rejection.ts`, `handlers/commands/preset.ts`, `services/preset-api.ts`, `types/preset.ts`, `index.ts` diff, `CHANGELOG.md`.
discord-worker: `index.ts` (webhook), `handlers/commands/preset-notifications.ts`, `handlers/commands/preset.ts` (submit, edit, notify), `types/preset.ts`, `CHANGELOG.md`.
Total 21 files, plus the three PR diffs via `pr-delta.txt`.
