# FINDING-016: presets-api publishes `author_discord_id` on every anonymous list / featured / detail response — the policies promise the display name, not the id
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** presets-api · **Rotation:** NONE · **CWE:** CWE-359
Promotes 2026-08-21 INFO PAPI-14.

## Location
- `apps/presets-api/src/services/preset-service.ts:106` — row → `author_discord_id` in every serialised `CommunityPreset`
- `apps/presets-api/src/handlers/presets.ts:89-93,221,233,643` — list / featured / detail are anonymous routes

## Evidence
- Only privileged consumers need the id: web-app `preset-edit-form.ts:111` (owner check on an authenticated page), discord-worker `preset.ts:777` (behind HMAC). Anonymous callers get every author's Discord id → cross-referencing and DM targeting.

## Fix
- Strip `author_discord_id` from anonymous responses; return `is_owner: boolean` for the authenticated caller and keep the id on bot/moderator routes.

## Status
OPEN
