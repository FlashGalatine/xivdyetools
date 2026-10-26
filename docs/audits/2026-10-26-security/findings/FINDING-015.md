# FINDING-015: Author-ban guard on approve/revert is a separate, non-atomic pre-read in moderation-worker; presets-api /status and /revert write approved with no author-ban check
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** moderation-worker + presets-api · **Rotation:** NONE · **Policy:** NONE · **CWE:** CWE-367

## Location
- `apps/moderation-worker/src/handlers/buttons/preset-moderation.ts:186` — Author-ban guard on approve/revert is a separate, non-atomic pre-read in moderation-worker; presets-api /status and /revert write approved with no author-ban check
- `apps/presets-api/src/handlers/moderation.ts:224` — presets-api never enforces the author ban on moderator approve/revert; the only guard is moderation-worker's non-atomic pre-check

## Evidence
- preset-moderation.ts:186 `if (await banService.isPresetAuthorBanned(env.DB, presetId)) {` ... :206 `await presetApi.approvePreset(env, presetId, userId, binding)`; preset-service.ts `WHERE id = ? AND status = ? AND content_revision = ?`; ban-service.ts:686-688 `WHERE author_discord_id = ? AND status = 'approved'`
- Reach: A moderator clicks Approve (or submits a Revert) on a banned author's pending/flagged preset while a second moderator's ban of that author commits between the isPresetAuthorBanned read and the PATCH. Separately, any moderator can send PATCH /api/v1/moderation/:id/status or /revert straight to api.xivdyetools.app with a web JWT, which skips the pre-check entirely.
- processApproval reads isPresetAuthorBanned (preset-moderation.ts:186) and then calls presetApi.approvePreset (:206); processRevert does the same (modals/preset-rejection.ts:268 then :293). presets-api's /status batch (moderation.ts:225, prepareStatusUpdate in preset-service.ts) and /revert batch (moderation.ts:330, prepareRevert) bind only id/status/revision/snapshot, with no banned_users lookup. requireNotBanned is mounted only on presets.ts:131 and votes.ts:30 and checks the caller, not the author. banUser's batch (ban-service.ts:508, hideUserPresetsStatement :678-688) hides only 'approved' rows, so a write that lands after the b… Preconditions: Actor holds moderator rights (MODERATOR_IDS). Either two moderators act on the same author within one request's latency (ban commits between pre-read and PATCH), or a moderator calls the presets-api moderation route directly instead of through the bot. The slash-command path (commands/preset.ts:284…
- Live state the repo cannot show: Membership of the MODERATOR_IDS secret, which decides who can take the direct-API path.

## Fix
- Enforce the author ban inside the presets-api write itself by adding `AND NOT EXISTS (SELECT 1 FROM banned_users b WHERE (b.discord_id = presets.author_discord_id OR b.xivauth_id = presets.author_discord_id) AND b.unbanned_at IS NULL)` to the WHERE clause of prepareStatusUpdate (when the target status is approved) and of prepareRevert. Map the zero-row case to a distinct 409 or 403 AUTHOR_BANNED, and keep moderation…

## Status
OPEN
