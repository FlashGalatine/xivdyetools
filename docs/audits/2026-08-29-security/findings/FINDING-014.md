# FINDING-014: api-worker `POST /v1/telemetry` accepts beacons from any Origin, trusts the client's `env` blob, ignores `Sec-GPC`, and its limiter fails open in front of up to 25 metered Analytics Engine writes per request
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** api-worker · **Rotation:** NONE · **CWE:** CWE-345 (insufficient verification of data authenticity), CWE-770

## Location
- `apps/api-worker/src/telemetry/router.ts:46-82` — no `Origin` / `Sec-GPC` read; `src/telemetry/schema.ts:55,149` — `env ∈ {production, beta}` taken from the body
- `apps/api-worker/src/middleware/rate-limit.ts:110-115,140` — `TELEMETRY_LIMIT.failOpen: true` + `onError: 'fail-open'`; `schema.ts:25` — ≤ 25 `writeDataPoint` per accepted batch

## Evidence
- `curl -X POST https://data.xivdyetools.app/v1/telemetry -H 'content-type: text/plain' -d '{"v":1,"env":"production","locale":"en","theme":"standard-dark","vp":"d","ver":"5.0.0","events":[…]}'` → 204 and a production datapoint (review-api-worker.md §API-01); any third-party page can `sendBeacon` the same from its visitors' IPs — the four product metrics are poisonable, and beta/production separation is client-asserted.
- The datapoint itself is clean (allowlisted, no IP/UA/ids — positive control); `apps/web-app/PRIVACY.md:57-59` GPC promise is enforced client-side only.

## Fix
- Require `Origin ∈ {https://xivdyetools.app, https://beta.xivdyetools.app}` (`sendBeacon` always sends it) and derive `env` from it; drop on `Sec-GPC: 1`; `failOpen: false` for this sink (a dropped batch costs nothing).

## Status
OPEN
