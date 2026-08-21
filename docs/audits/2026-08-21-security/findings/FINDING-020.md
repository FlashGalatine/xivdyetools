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
