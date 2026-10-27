# FINDING-038: Telemetry blob8 'ver' is regex-validated, not allowlisted, so a sender can write about 10 free alphanumeric characters
**Severity:** INFO · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** api-worker · **Rotation:** NONE · **Policy:** NONE (fix code) · **CWE:** n/a

## Location
- `apps/api-worker/src/telemetry/schema.ts:62` — Telemetry blob8 'ver' is regex-validated, not allowlisted, so a sender can write about 10 free alphanumeric characters

## Evidence
- schema.ts:61-62 `const VER_MAX_LENGTH = 16; const VER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;` and :130-132 `typeof value === 'string' && VER_PATTERN.test(value) ? value.slice(0, VER_MAX_LENGTH) : INVALID`
- Reach: A non-browser client POSTs a text/plain v1 batch to https://data.xivdyetools.app/v1/telemetry with a forged `Origin: https://xivdyetools.app`, at least one valid event, and `"ver":"1.0.0-abcdefghij"`. version() (schema.ts:129-133) passes it through VER_PATTERN, slices it to 16 characters, and parseTelemetryBatch (schema.ts:160-166, 181) writes it as blob8 on every point in the batch.
- The facts check out. VER_PATTERN at schema.ts:62 (`/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/`) with the 16-char clamp at :61/:131 is the only envelope field not checked through oneOf against an enum (locale, theme, vp and env use envelopeField at :161-165), so a "1.0.0-" prefix leaves 10 free [0-9A-Za-z.] characters. The real client only sends the build constant APP_VERSION (web-app constants.ts:39, telemetry-service.ts:195), so no user data is collected; the only effect is a sender putting a short token of its own choosing into its own datapoints, which makes this INFO. This is an unremediated carry-over of 2026-08-29 API-05 (same INFO… Preconditions: The sender must spoof an accepted Origin (trivial outside a browser; see origin.ts and the FINDING-014 gate), must not send Sec-GPC: 1, must stay within the TELEMETRY_RATE_LIMITER bucket (240/60 s per IP), and must include at least one event that passes its schema, because blob8 is only written on…

## Fix
- Store only the numeric triple, e.g. `/^(\d{1,4}\.\d{1,4}\.\d{1,4})/` match [1], or allowlist the one prerelease shape the beta build emits (`-beta\.\d+`), with anything else mapped to 'invalid'. Update schema.test.ts:174 (the timestamped-prerelease case) and spec section 4 to match.

## Status
OPEN — source prepared in A-API: validate the complete input version, store only a numeric triple with 1–4 ASCII digits per component, and discard a validated prerelease suffix; all five event schemas covered. Invalid input maps to `invalid` without partial clamping or blob-layout changes; [API evidence](../evidence/remediation-api-2026-10-27.md). Merge and production acceptance remain pending.
