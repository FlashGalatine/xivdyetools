# FINDING-017: Moderator approve/reject buttons carry no reviewed content_revision, so a stale embed's Approve button approves text edited after it was posted
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** discord-worker + moderation-worker + presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-367

## Location
- apps/moderation-worker/src/services/preset-api.ts:356-391 — approvePreset/rejectPreset send body { status, reason } with no revision or expected status
- apps/discord-worker/src/handlers/commands/preset-notifications.ts:153 — button custom_id is `preset_approve_${preset.id}` only; moderation-worker buttons/preset-moderation.ts:77,137 forwards just the id
- apps/presets-api/src/handlers/moderation.ts:~110-145 — reads presetRow fresh, then prepareStatusUpdate(..., preset.status, presetRow.content_revision) uses the server's own read, not a value the moderator saw

## Evidence
- presets-api/src/services/preset-service.ts:458-464: `UPDATE presets SET status = ?, updated_at = ? WHERE id = ? AND status = ? AND content_revision = ?` bound to (status, now, id, expectedStatus, expectedRevision). Both expected values come from the row moderation.ts read in the same request, so the condition guards only against concurrent writes, not against a stale review.
- presets-api/src/handlers/presets.ts:~805-815: an edit that notifiesModerators leaves the preset 'pending' and posts a new embed ('one that was already pending stays there'). The earlier embed's Approve button stays live, and clicking it approves the edited text.
- The 2026-09-15 FINDING-002 fix bound only preview-image approvals to a reviewed revision. Its fix bullet says patching only the DB race 'does not fix stale buttons', and that gap remains for text status changes.

## Fix
- Order matters (verified for the plan): the notification payload (`notification-service.ts:25-41`) must first carry the `content_revision` and status of the text being sent; moderation-worker owns the buttons (embeds are posted with `MODERATION_BOT_TOKEN`, `preset-notifications.ts:58-63`) and parses `custom_id` with `replace()` (`buttons/preset-moderation.ts:77,215`), so it must parse old and new formats (incl. `preset_reject_modal_`) before discord-worker emits revision-bearing ids. Old buttons get the 2026-09-15 refresh-and-reclick recovery.
- `/preset moderate approve|reject` (typed id, no revision seen): look up the current revision, show the text being approved, and require a confirm click bound to that revision — otherwise fail-closed makes the command 409 forever.
- Send expected_revision/expected_status in approvePreset/rejectPreset, and have PATCH /moderation/:id/status use those values in the WHERE clause (not the freshly read ones). Return 409 when they do not match, so old buttons fail closed and tell the moderator to re-review.
- Optionally disable or strip the buttons from earlier embeds when presets-api re-notifies for the same preset.

## Status
OPEN — presets-api part (status and revert bound to the reviewed revision, GET /moderation/:id, payload revision) in `f1b54a0f` (local branch `fix/security-2026-10-03-sprint3`, presets-api 2.4.0; not pushed); moderation-worker part (revision-bound buttons, modals and confirm, legacy refresh) in `c7fd9eba` (local branch `fix/security-2026-10-03-sprint4`, moderation-worker 1.8.0; not pushed). The discord-worker part (emit the new custom_ids) is Sprint 5. Revert was added to the contract during review.
