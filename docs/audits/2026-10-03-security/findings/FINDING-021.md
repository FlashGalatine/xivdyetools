# FINDING-021: ban-service.ts unbanUser restores hidden presets to approved with no dye_signature collision check, so another user's matching preset makes the all-or-nothing unban batch fail
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** moderation-worker · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-754

## Location
- apps/moderation-worker/src/services/ban-service.ts:537-550 — unbanUser runs the ban-row close, the audit logs and the restore in one db.batch, which is all-or-nothing
- apps/moderation-worker/src/services/ban-service.ts:608-622 — restoreUserPresetsStatement: an unconditional UPDATE from hidden to approved, with no duplicate-signature pre-check
- apps/presets-api/migrations/0006_partial_dye_signature_drop_rate_limits.sql:16-18 — the unique index on dye_signature covers only status IN ('approved','pending'), so hidden rows can share a signature

## Evidence
- ban-service.ts:616-618: `UPDATE presets SET status = 'approved', updated_at = ? WHERE author_discord_id = ? AND status = 'hidden'`. Nothing checks for a colliding approved or pending row first.
- presets-api preset-service.ts:371: `WHERE dye_signature = ? AND status IN ('approved', 'pending')`. Submitting a preset with a hidden preset's signature passes the duplicate check, and the partial index (0006) accepts it.
- ban-service.ts:564-571: the catch returns the generic 'Failed to unban user.', so the batch rolls back with no hint of the cause. presets-api's own status and revert paths handle this case with a 409 (moderation.ts:132-154, :219-238, BUG-041). This direct D1 path does not.

## Fix
- Before the batch, look up which of the author's hidden presets collide with an approved or pending row (same query shape as findDuplicateBySignature), then either restore only the non-colliding ones (add `AND NOT EXISTS (SELECT 1 FROM presets p2 WHERE p2.dye_signature = presets.dye_signature AND p2.status IN ('approved','pending'))` to the restore UPDATE) or leave the colliding ones hidden or rejected and report them to the moderator.
- Treat a UNIQUE/dye_signature error in unbanUser's catch as its own case and return a channel-safe message such as 'Unban blocked: a restored preset duplicates an existing one', rather than the generic failure.
- Longer term: move ban and unban behind a presets-api endpoint, so one service owns the dye_signature invariant. This is the FINDING-034 first-choice fix.

## Status
OPEN
