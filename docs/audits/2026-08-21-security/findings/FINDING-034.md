# FINDING-034: moderation-worker hygiene — direct D1 writes bypass presets-api invariants, modal handlers skip ID validation, raw D1/API error strings posted to the moderation channel

## Severity
**LOW** — moderator-only reach; consequences are inconsistent moderation state and internal-error disclosure to moderators. Reviewer IDs: MOD-4, MOD-5, MOD-8, MOD-12, MOD-13.

## Category
CWE-1061 Insufficient Encapsulation (shared DB) · CWE-209

## Location
- `apps/moderation-worker/src/services/ban-service.ts:231-378`, `handlers/commands/preset.ts:217-251` — bans/hides written straight to the shared production D1: no `moderation_log` rows, ban hides only `approved` presets (pending/flagged remain approvable), approve path ignores author ban, ban+hide not atomic.
- `apps/moderation-worker/src/handlers/modals/preset-rejection.ts:37,169`, `modals/ban-reason.ts:72` — modal handlers skip the UUID/snowflake validation used by button/command paths (see also FINDING-020).
- `apps/moderation-worker/src/services/ban-service.ts:268-282` → `modals/ban-reason.ts:146-153`; `commands/preset.ts:405,570` — raw error strings (incl. upstream 5xx bodies) posted into the channel; `sanitizeErrorMessage` not applied.
- `apps/moderation-worker/src/index.ts:395-444` — button/modal interactions not rate limited; `services/preset-api.ts:464-500` — `preset_id` autocomplete always returns `[]` (fails safe; functional bug).

## Recommendation
Route ban/unban/hide through presets-api moderation endpoints (single writer, logged, atomic) or at least write `moderation_log` and cover all statuses; validate IDs in modal handlers; apply `sanitizeErrorMessage` on every channel-facing error path.

## References
- Evidence: `../evidence/review-moderation-worker.md` (MOD-4, MOD-5, MOD-8, MOD-12, MOD-13)
