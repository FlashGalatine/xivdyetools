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
FIXED 2026-08-30 dfb49aa1 (moderation-worker 1.6.0 + migration `apps/presets-api/migrations/0013_moderation_log_user_actions.sql` — hand-run on `xivdyetools-presets` BEFORE the 1.6.0 deploy, never `d1 migrations apply`: rebuilds `moderation_log` with `preset_id` nullable + `target_discord_id`, re-run-guarded by a leading `ADD COLUMN`. `banUser`/`unbanUser` write one `ban`/`unban` row (`preset_id` NULL) plus one `hide`/`restore` row per affected preset in the SAME `batch()` as the ban — atomic, so a pre-migration deploy makes bans fail loudly instead of silently unlogged; history and `/stats` now see them. Rulings: direct D1 writes (not a presets-api route); `@xivdyetools/types` `ModerationLogEntry` still narrower than the table → Sprint 11.)
