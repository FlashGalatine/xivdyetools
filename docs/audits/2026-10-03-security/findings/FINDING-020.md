# FINDING-020: presets-api moderation.ts preview-image PATCH approves or rejects (and R2-deletes) images without writing a moderation_log row
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-778

## Location
- apps/presets-api/src/handlers/moderation.ts:305-313 — approve branch: single UPDATE preview_image_status='approved', no audit INSERT
- apps/presets-api/src/handlers/moderation.ts:322-339 — reject branch: UPDATE clears preview_image_key, then deletePreviewImage (R2), no audit INSERT
- apps/presets-api/src/handlers/presets.ts:1266-1267 — doc comment states moderator image removal 'belongs in the moderation log'

## Evidence
- moderation.ts:322-328: `UPDATE presets SET preview_image_key = NULL, preview_image_status = 'none', updated_at = ? WHERE id = ? AND preview_image_key = ? AND preview_image_status = 'pending'` ... `if (result.meta.changes !== 1) return staleReview();` — the handler never references auth.userDiscordId or moderation_log
- Contrast moderation.ts:224-235 (revert): `c.env.DB.batch([prepareRevert(...), INSERT INTO moderation_log ... SELECT ... WHERE changes() > 0])` — status and revert are audited atomically
- moderation.ts:353-360: GET /:presetId/history selects only FROM moderation_log, so image approvals/takedowns never appear; the only trace is the edited Discord moderation message (discord-worker buttons/preview-image.ts)

## Fix
- Turn each branch's UPDATE into a db.batch with `INSERT INTO moderation_log (id, preset_id, moderator_discord_id, action, reason, created_at) SELECT ?,?,?,?,NULL,? WHERE changes() > 0`, using actions such as 'image_approve' / 'image_reject' (update the action comment in schema.sql:142)
- Keep the R2 delete after the batch as today; the log row should gate on the conditional UPDATE so a stale review writes neither
- Add tests asserting history shows the image action and that a 409 stale review writes no log row

## Status
FIX COMMITTED, NOT DEPLOYED — `f1b54a0f` (local branch `fix/security-2026-10-03-sprint3`, presets-api 2.4.0; not pushed).
