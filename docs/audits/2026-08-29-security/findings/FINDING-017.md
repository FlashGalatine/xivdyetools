# FINDING-017: presets-api dead-letter `failed_notifications.payload` (author id + name + full preset content) and `submission_events` are never pruned, survive the owner's delete, and have no retention row
**Severity:** LOW · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **CWE:** CWE-359, CWE-1258

## Location
- `apps/presets-api/src/services/notification-service.ts:156-172` — `INSERT INTO failed_notifications (payload, …)` with `JSON.stringify(payload)`; `:184-190` moderator listing (`include_resolved`)
- `apps/presets-api/src/handlers/presets.ts:369-372` — `submission_events` (append-only by FINDING-008 design)
- No `DELETE FROM failed_notifications|submission_events` anywhere (`git ls-files 'apps/presets-api/src/*.ts' | xargs grep -n 'DELETE FROM'`)

## Evidence
- Both tables outlive the preset and any deletion request; `apps/discord-worker/PRIVACY_POLICY.md:139-151` (retention table) has no line for them.

## Fix
- Store the preset id instead of the payload in the dead-letter row; prune resolved rows and events older than N days (scheduled job or on write); add a retention row.

## Status
OPEN
