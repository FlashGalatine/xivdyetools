# FINDING-011: personal fields in structured log lines — moderation-worker logs the banned user's display name and the moderator's free-text reason; discord-worker logs option values and preset names; presets-api logs unpublished preset names via `console.error`
**Severity:** LOW (latent — not retained today) · **Exposure:** INTERNET-AUTH · **Deploy unit:** moderation-worker + discord-worker + presets-api · **Rotation:** NONE · **CWE:** CWE-532

## Location
- `apps/moderation-worker/src/handlers/modals/ban-reason.ts:169-175` — `logger.info('User banned', { targetUserId, targetUsername, moderatorId, presetsHidden, reason })` (the unban line at `commands/preset.ts:641-645` logs ids only)
- `apps/discord-worker/src/handlers/commands/budget.ts:247` (`world` option), `src/services/preferences.ts:218-221` (any preference `value`), `src/index.ts:308-312` (`presetName`)
- `apps/presets-api/src/handlers/presets.ts:605,789` — `console.error(... name="${updatedPreset.name}")` bypasses the redacting logger (≈32 `console.*` sites in the unit)

## Evidence
- `apps/discord-worker/PRIVACY_POLICY.md` §2 lists ids/username for attribution only; a ban `reason` is moderator-authored commentary about a person. Retention: none today (`evidence/workers-log-retention.md`).

## Fix
- Log ids and lengths, never names, option values, free text or preset names; route presets-api `console.*` through the worker-kit logger.

## Status
PARTIAL — presets-api part FIXED 2026-08-30 efd495a4, a3e8ee14 (2.2.0: all 30 `console.*` sites routed through the worker-kit logger with ids/counts only; preset names dropped from the notification-failure lines; dead-letter insert failures log `err.name` only); moderation-worker (Sprint 4) and discord-worker (Sprint 3) parts pending.
