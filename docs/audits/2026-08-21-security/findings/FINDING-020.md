# FINDING-020: Identifiers interpolated unencoded into outbound URL paths (discord-worker/moderation-worker → presets-api; web-app → API)

## Severity
**LOW** — IDs are validated as UUID/snowflake on most paths, so this is route-steering under the caller's own identity at worst; no cross-user impact found. Reviewer IDs: DW-3, MOD-5, WEB-11.

## Category
CWE-116 Improper Encoding or Escaping of Output

## Location
- `apps/discord-worker/src/services/preset-api.ts:237, 341, 360, 373, 390, 433` — `` `${base}/presets/${presetId}` `` without `encodeURIComponent`.
- `apps/moderation-worker/src/handlers/modals/preset-rejection.ts:37,169`, `services/preset-api.ts:376-448`, `modals/ban-reason.ts:72` — modal handlers skip the UUID/snowflake validation that button/command paths apply, then interpolate.
- `apps/web-app/src/services/community-preset-service.ts:312,368,426,478`, `preset-submission-service.ts:157,182,425,540`, `hybrid-preset-service.ts:354-358`.

## Recommendation
Validate at the handler boundary (UUID v4 / snowflake regex) **and** `encodeURIComponent()` every path segment in the API clients.

## References
- Evidence: `../evidence/review-discord-worker.md` (DW-3), `../evidence/review-moderation-worker.md` (MOD-5), `../evidence/review-web-app.md` (WEB-11)

## Status
**FIXED 2026-08-21** — moderation-worker 1.5.0, web-app, discord-worker 5.0.0 (bullets below).
- moderation-worker 1.5.0 (MOD-5): `encodeURIComponent` on every preset-id path segment in `services/preset-api.ts`; rejection/revert modals validate UUIDs, ban/unban validate snowflakes before D1.
- web-app (WEB-11): `encodeURIComponent` in `community-preset-service` (preset + vote routes) and `preset-submission-service` (preview-image, delete, edit).
- discord-worker 5.0.0: `encodeURIComponent` on all six preset-id path sites; `isValidPresetId()` (UUID v4) — non-UUID `/preset show|vote|edit|favorite` input is treated as a NAME and resolved via search (never a path segment); preview-image buttons refuse non-UUID `custom_id`s.
