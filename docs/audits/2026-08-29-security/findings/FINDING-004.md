# FINDING-004: presets-api — any edit to an owner's non-approved preset re-queues it as `pending` and fires an uncapped moderation notification (FINDING-008 gap); rejected presets bounce back to pending
**Severity:** MEDIUM · **Exposure:** INTERNET-AUTH · **Deploy unit:** presets-api (embeds land via discord-worker) · **Rotation:** NONE · **CWE:** CWE-770 (allocation without limits), CWE-841 (improper enforcement of behavioral workflow)

## Location
- `apps/presets-api/src/handlers/presets.ts:482-483` — `moderationStatus = preset.status === 'approved' ? 'approved' : 'pending'` for **every** PATCH
- `apps/presets-api/src/handlers/presets.ts:494-523` — only an edit that itself trips moderation sets `flaggedByThisEdit` and hits the daily cap
- `apps/presets-api/src/handlers/presets.ts:591-609` — `if (moderationStatus === 'pending')` → `notifyDiscordBot` with `moderation_status: 'flagged'` (moderation embed: `apps/discord-worker/src/index.ts:316-350`)

## Evidence
- `PATCH /v1/presets/:id` body `{"tags":["a"]}` on the caller's own pending/rejected/flagged preset → no Perspective call, no cap, no `submission_events` row, one moderation-channel embed per request; bounded only by `RL_PUBLIC` (100/min per IP). A `rejected` preset is written back as `pending`.
- Quota tests only use `status: 'approved'` fixtures (`apps/presets-api/tests/handlers/presets-quotas.test.ts:100-101`).

## Fix
- Notify only when this edit flagged (`flaggedByThisEdit`) or when name/description changed while pending; never lift `rejected` to `pending` on an owner edit (require an explicit resubmit that counts against the flagged-edit cap).

## Status
OPEN
