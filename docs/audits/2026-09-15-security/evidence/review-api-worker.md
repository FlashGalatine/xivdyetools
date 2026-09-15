# API worker security review — 2026-09-15

## Routes, authority, and sinks

| Route family | Authority / validation / sink | Evidence |
|---|---|---|
| `/v1/dyes`, `/v1/match`, `/v1/wheels`, `/v1/harmony` | Anonymous read-only data/algorithm endpoints; `/v1/*` per-IP limiter + locale middleware | `src/index.ts:118-177`; route declarations in `src/routes/*` |
| `/v1/chara/resolve`, `/v1/chara/icon/:id` | Anonymous bounded equipment lookup and PNG proxy; Cache API only holds canonical derived entries | `src/chara/router.ts:154-176,195-265,271-344` |
| `/v1/telemetry` | Origin + GPC gate, 16 KB / 25 event allowlist, fixed AE layout; own fail-closed IP limiter | `src/telemetry/router.ts:53-113`; `src/telemetry/schema.ts:24-195`; `src/middleware/rate-limit.ts:101-166` |
| `/universalis/*`, `/api/v2/*` | Fixed configured upstream, validated path values, Cache API + coalescing, cache-miss IP budget | `src/index.ts:179-185`; `src/universalis/router.ts:148-319`; `services/cached-fetch.ts:62-163` |
| `developers.xivdyetools.app` | Static asset binding, hostname-gated before API middleware | `src/index.ts:42-57` |

## Candidates

| Candidate | Severity / exposure | File:line | Claim | Evidence |
|---|---|---|---|---|
| Privacy disclosure omits operational IP-keyed limiting | P2 privacy / requesters whenever KV fallback is used | `src/middleware/rate-limit.ts:125-150`; `apps/web-app/PRIVACY.md:90-92` | Raw `CF-Connecting-IP` supplies rate-limit keys; KV fallback persists that value under `telemetry:ip:` (and API under `api:ip:`), contrary to the broad no-IP policy statement. | Native RateLimit may avoid app-managed KV, but configured fallback remains executable. This is an operational control, not an AE datapoint; disclose scope/short retention or transform the key. |

## Positive controls

- Telemetry’s accepted origin is exact-match and determines environment; unaccepted origins and `Sec-GPC: 1` are rejected before body read, and Origin/IP/UA/request ID never enter AE (`src/telemetry/origin.ts:23-68`; `router.ts:53-103`; `schema.ts:150-185`).
- All telemetry fields are enumerated or DB-validated: events use a `Map` resistant to prototype keys; stain IDs resolve through the dye service; body/event/dwell/version caps bound write cost (`schema.ts:24-145, 188-195`). Wrangler separates development and production AE datasets (`wrangler.toml:60-64,110-114`).
- Chara resolve enforces an 8 KB stream cap and typed/ranged integer lanes; icon proxy canonicalizes the cache key, caps bytes, validates PNG magic, fixes content type, and sandboxes inline output (`chara/router.ts:154-176,271-344`).
- Universalis cannot choose an arbitrary host: URLs derive from configured base plus allowlisted datacenter/world and canonical numeric IDs. Upstream requests use a 10 s abort, manual redirects, and 5 MB declared-and-streamed response limits (`universalis/router.ts:148-319`; `services/cached-fetch.ts:134-194`).
- Cache keys are fixed synthetic-origin namespaces, canonicalized per payload, and error responses default `no-store`, preventing host/query cache partitioning and error caching (`services/cache-service.ts:34-99`; `src/index.ts:76-91`).
- Request logging does not opt into User-Agent, and telemetry-specific logs omit Origin/body; IP is used only for limiter identity (`src/index.ts:68-74`; `src/telemetry/router.ts:53-113`; `src/middleware/rate-limit.ts:64-71`).

## Rejected suspicions

- Telemetry remains forgeable by a direct client that sets Origin, but browser-origin injection/metric poisoning is closed by the exact Origin gate; this is documented residual integrity scope, not an authorization boundary (`src/telemetry/origin.ts:11-18`).
- Permissive CORS does not authorize telemetry writes: route-level Origin/GPC gate follows CORS and rejects before parse/write (`src/index.ts:94-115`; `src/telemetry/router.ts:53-96`).
- KV rate-limit race/fail-open behavior for ordinary public API is an accepted availability trade-off documented in `docs/architecture/security-trade-offs.md`; telemetry uniquely fails closed, so it is not duplicated as a finding.

## Coverage and limits

Covered tracked worker source, all route mounts, telemetry schema/origin/rate limiter, chara proxy/cache, Universalis proxy/cache/fetch, global headers/CORS/errors, `wrangler.toml`, and analytics/privacy docs. Read-only review; no build/tests, production probes, or inspection of Cloudflare account configuration/log retention. Shared worker-kit behavior was inspected only to confirm UA logging defaults and IP key extraction.
