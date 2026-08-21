# FINDING-008: presets-api abuse limits are resettable/incomplete — daily cap counts surviving rows, flagged edits and preview uploads are unlimited

## Severity
**MEDIUM** — each bypass fans out to a Discord moderation embed, a Perspective API call and dead-letter rows, so one account can flood the moderation channel and external quotas. Reviewer ID: PAPI-1. Coordinator-verified (`COUNT(*) FROM presets` at `rate-limit-service.ts:27-47`).

## Category
CWE-770 Allocation of Resources Without Limits or Throttling · CWE-799 Improper Control of Interaction Frequency

## Location
- `apps/presets-api/src/services/rate-limit-service.ts:27-66` — `getSubmissionCountToday()` counts rows that still exist; deleting your own presets (`handlers/presets.ts:227-281`) resets the quota.
- `apps/presets-api/src/handlers/presets.ts:454-473` — PATCH edits that re-flag a preset have no per-user limit yet trigger `notifyDiscordBot` + moderation.
- `apps/presets-api/src/handlers/presets.ts:786-800` — preview-image upload/replace has no per-user limit (each call hits image-worker and R2).

## Description
The only per-user quota is `DAILY_SUBMISSION_LIMIT` computed from surviving rows; the other moderation-triggering mutations have none. The per-IP limiter (FINDING-003) is per-isolate and shared by all bot users, so it does not compensate.

## Impact
Moderation-channel spam, Perspective/R2/image-worker quota burn, dead-letter table growth (`failed_notifications` is never pruned — PAPI-17), moderator fatigue.

## Recommendation
- Count submissions from an append-only log (or `moderation_log`) rather than live rows; apply the same daily counter to flagged edits and preview uploads.
- Add a per-user cooldown on mutations that notify moderators; prune `failed_notifications`.

## References
- Evidence: `../evidence/review-presets-api.md` (PAPI-1, PAPI-17)
