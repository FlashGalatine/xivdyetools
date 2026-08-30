# FINDING-018: ban / unban / hide / restore still write no `moderation_log` rows (carry-forward of 2026-08-21/FINDING-034)
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api (schema owner) + moderation-worker · **Rotation:** NONE · **CWE:** CWE-778
Supersedes the deferred part of `2026-08-21-security/FINDING-034`.

## Location
- `apps/moderation-worker/src/services/ban-service.ts:305-315` (ban + hide in one batch), `:374-385` (unban + restore) — `banned_users` only; `moderation_log.preset_id` is `NOT NULL`, so user-level actions cannot be logged there

## Evidence
- `apps/moderation-worker/CHANGELOG.md` 1.5.0 "Not done"; `docs/operations/POST_MERGE_CHECKLIST.md:381-383`. Accountability survives in `banned_users` (moderator id, reason, timestamps); per-preset history and `/stats` never see bans.

## Fix
- Migration: make `moderation_log.preset_id` nullable (or add `target_discord_id`); log the four actions through presets-api.

## Status
OPEN
