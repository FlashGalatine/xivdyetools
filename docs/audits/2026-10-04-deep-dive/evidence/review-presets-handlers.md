# Review: presets-handlers (presets-api handlers)

Branch preview/integration-2026-10-04 @80262a2f. Read-only review; no tests run.

## Map
| Module | Routes |
|---|---|
| handlers/presets.ts (1488 l, PR-#224 touched) | GET /, /featured, /mine, /rate-limit, /:id; POST /; PATCH /refresh-author, /:id; DELETE /:id; POST+DELETE /:id/preview-image; router-wide requireNotBanned on POST/PATCH/DELETE |
| handlers/moderation.ts (586 l, PR-#224 touched) | GET /pending, /stats, /failed-notifications, /:id, /:id/history; PATCH /:id/status, /:id/revert, /:id/preview-image, /failed-notifications/:id/resolve |
| handlers/votes.ts | POST/DELETE /:presetId (approved-only gate), GET /:presetId/check; exports addVote/removeVote used by presets.ts |
| handlers/categories.ts | GET /, GET /:id (60 s edge cache, per-isolate in-flight dedupe) |

## Candidates

### presets-handlers-01 BUG MEDIUM - bot tag-only edit on a PENDING preset still posts a moderation embed (FINDING-004 cap bypassed via the bot)
- apps/presets-api/src/handlers/presets.ts:892-902 and apps/discord-worker/src/handlers/commands/preset.ts:880,921-925
- presets-api deliberately does not notify or reserve a flagged_edit slot when a pending preset's edit brings no new text (`ownerEditOutcome` pending case, presets.ts:524-525), but it still reports `moderation_status: 'pending'` (resultingStatus = stored 'pending', presets.ts:738,892-895). discord-worker keys its own post purely on that value: `isPending = response.moderation_status === 'pending'` then `notifyEditModerationChannel` (preset.ts:880, 922-925), with no cap and legacy button ids.
- Failing input: owner of a pending preset runs `/preset edit` changing only tags, repeatedly. Each call returns 200 `moderation_status:'pending'` and one moderation-channel embed. Only the 100/min per-user limiter bounds it. This is the "uncapped moderation ping" the FINDING-004 comment at presets.ts:521-523 says was closed.
- Tests miss it: presets-api tests assert no notify/no slot; discord-worker tests mock the API response. Covered: no (cross-worker contract).
- Origin: MAIN. Excerpt: `const reportedStatus = resultingStatus === 'approved' || resultingStatus === 'pending' ? resultingStatus : undefined;`
- Fix: drop the bot-side posts (see -02); the webhook is the single capped path. Or report `moderation_status` only when `notifiesModerators`.

### presets-handlers-02 BUG MEDIUM - LEAD CONFIRMED: bot-submitted presets produce two Discord posts (pending: two moderation embeds; approved: two submission-log embeds)
- apps/presets-api/src/handlers/presets.ts:1077-1100 (webhook, `source: auth.authSource` = 'bot', revision-bound ids) vs apps/discord-worker/src/handlers/commands/preset.ts:567-577 (`notifySubmissionChannel` when approved, `notifyModerationChannel` when pending, no contentRevision -> legacy ids). Webhook side: apps/discord-worker/src/index.ts:402-440 (pending -> moderation channel) and :443-486 (approved -> SUBMISSION_LOG_CHANNEL_ID).
- Failing input: any `/preset submit` via the bot. presets-api always fires notifyDiscordBot for the new row (no source filter, presets.ts:1089), and the bot posts again after the response. Moderators see two embeds per pending preset, one with legacy `preset_approve_<uuid>` buttons that moderation-worker turns into a refresh (preset-notifications.ts:94-113); the log channel gets two "published" lines per approved preset. Bot edits that enter pending double the same way (see -01).
- Web submissions post once (no bot-side post), so only the bot path doubles. No test spans both workers. Origin: MAIN.
- Fix: delete the notifyModerationChannel / notifyEditModerationChannel / notifySubmissionChannel calls in discord-worker preset.ts (the webhook is authoritative, capped, dead-lettered).

### presets-handlers-03 BUG LOW - moderator status/revert can un-hide a ban-hidden preset (expected_status 'hidden' accepted)
- apps/presets-api/src/handlers/moderation.ts:80,128-129,219 and services/preset-service.ts:458-464, 481-485
- REVIEWED_STATUSES includes 'hidden'; `prepareStatusUpdate` is `WHERE status = ? AND content_revision = ?` with the caller's expected_status. `PATCH /moderation/:id/status {status:'approved', expected_status:'hidden', expected_revision:N}` flips a banned user's hidden preset to approved (revert sets status='approved' unconditionally), logged as approve/unflag rather than restore. CLAUDE.md treats hidden as the ban-driven soft delete.
- Needs a moderator credential and a deliberate call; the Discord buttons cannot produce it. Tests: moderation-revision covers hidden only as a concurrent winner. Covered: no. Origin: MAIN.
- Fix: refuse expected_status === 'hidden' on the status route (and revert); restore stays with moderation-worker.

### presets-handlers-04 BUG LOW - JSON `null` (or non-object) body gives an opaque 500, not 400
- presets.ts:597 (`!body.name` on PATCH), :974/1391 (validateSubmission `body.name` on POST), moderation.ts:175 (`body.status`) and :269 (`body.reason`)
- `await c.req.json()` of the literal `null` returns null; the next property read throws TypeError -> global 500. (The preview-image route already uses `body?.`, moderation.ts:359.) Whether jsonDepthLimit rejects scalars was not verified. Covered: no. Origin: MAIN.
- Fix: after parsing, reject `typeof body !== 'object' || body === null || Array.isArray(body)` with invalidJsonResponse.

### presets-handlers-05 BUG LOW - owner PATCH re-runs moderation on text that did not change
- presets.ts:652-656 vs :656-703
- `textChanged` is computed, but the Perspective call and the text_edit slot are spent whenever `body.name || body.description` is present, and `flaggedByThisEdit` comes from that verdict. With the "unscored" fail-closed result (moderation-service.ts:377-384; every call once the key is removed at the 2026-12-31 sunset) a client that re-sends an unchanged name moves an APPROVED preset to pending and notifies (ownerEditOutcome approved case, :530-533). Web and bot send only changed fields (preset-edit-form.ts:713-714), so only API clients hit it today.
- Fix: gate the reservation and moderateContent on `textChanged`. Covered: no. Origin: MAIN.

### presets-handlers-06 BUG LOW - status route does not validate `reason` type/length
- moderation.ts:227 `body.reason || null`; validateModerationReason is called only by revert (:269).
- A non-string reason reaches `.bind()` -> D1 error -> 500; a ~100 KB string is stored and later shown to the author as `rejection_reason` (preset-service.ts:568-573). Moderator-only, hence LOW. Covered: no. Origin: MAIN. Fix: validate an optional reason (max length) when present.

### presets-handlers-07 OPT LOW - category counts are O(categories x presets) with json_each per pair
- categories.ts:36-53 and :104-120: LEFT JOIN on `category_id = c.id OR EXISTS (json_each(secondary_categories) ...)` cannot use idx_presets_status_category_vote. Fine at current size; cached 60 s plus per-isolate dedupe. Origin: MAIN.

## POSITIVE
- Visibility rule is centralised (`canSeePreset`, presets.ts:142) and applied to GET/PATCH/DELETE/preview routes; hidden previews cannot be probed via 403s.
- Moderator status/revert/image writes are one D1 batch with a `changes() > 0`-gated log row and revision/status/snapshot CAS; STALE_REVIEW/REVISION_REQUIRED fail closed (moderation.ts:121-134, 205-237).
- Owner edit CAS on author+content_revision, re-read after RETURNING for the embed revision (presets.ts:841-846); reservation release on every failed exit (BUG-015 holds).
- Vote add/remove are single batches recomputing vote_count from the votes table; approved-only gate shared by POST/DELETE (votes.ts:39,64-77).
- DELETE /:id removes votes, dead letters, audit rows and the preset in one batch, R2 delete after the DB write with a swallowed error (presets.ts:456-483).
- Route order is correct (literals before /:id in presets and moderation).
- Categories in-flight dedupe cannot poison the isolate: `.finally` clears the slot on rejection (categories.ts:77-79).

## REJECTED
- Submit rollback race (two concurrent 9/10 submits both roll back): fails safe, over-denies only.
- getPresets OFFSET with an enormous `page` (parseInt of a 20-digit string -> 1e20) may be a D1 datatype error; could not confirm D1 binding semantics without running it.
- Submission event kept when the rollback deletes the preset (presets.ts:1051-1055): intended, events are append-only quota records.
- `moderationRouter.get('/:presetId')` shadowing /stats etc.: registered last (moderation.ts:541).
- addVote auto-vote on a pending preset (presets.ts:1036) bypassing the approved gate: intentional.
- Rejected author never notified (moderation-worker-11) and Perspective sunset behaviour: known/decided.

## COVERED
4 non-test source files read in full: handlers/presets.ts, handlers/moderation.ts, handlers/votes.ts, handlers/categories.ts. Supporting reads: services/preset-service.ts (160-720), services/moderation-service.ts (340-395), services/rate-limit-service.ts (reserveDailyEvent), discord-worker index.ts webhook and commands/preset.ts submit/edit paths, preset-notifications.ts header. Tests only skimmed by name/grep.
