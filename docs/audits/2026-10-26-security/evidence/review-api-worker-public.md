# Review: api-worker-public (apps/api-worker/src excluding src/chara/)

HEAD 13c386e5. Read-only review; every claim below was opened at file:line in this checkout.

## Route / authz table

All routes are anonymous (no JWT, no API key). CORS is `origin: '*'`, no credentials (index.ts:96-111).
Order: docs-host branch (index.ts:40-56) -> requestId -> logger -> security headers -> CORS -> `/v1/*` API limiter (telemetry carved out) -> `/v1/telemetry/*` limiter -> locale (`/v1/*`) -> handlers.

| Route | Method | Auth | Limiter | Validation |
|---|---|---|---|---|
| `/`, `/health` | GET | none | none (documented) | none needed |
| `/v1/dyes`, `/search`, `/categories`, `/batch`, `/consolidation-groups`, `/stain/:id`, `/:id` | GET | none | API 65/60s per IP, service bucket 1300 | `CANONICAL_DYE_ID` regex, q<=100, ids<=50, perPage<=200, page<=1000, enums (validation.ts, dyes.ts) |
| `/v1/match/closest`, `/within-distance` | GET | none | same | strict hex regex, strict decimal parsers, limit<=125, excludeIds<=50 |
| `/v1/wheels`, `/wheels/:id` | GET | none | same | wheel id via core parser, stops 3..360 |
| `/v1/harmony`, `/harmony/types` | GET | none | same | type/wheel/method allowlists, companions<=5 |
| `POST /v1/telemetry` | POST | Origin allowlist (exact match), Sec-GPC drop | own bucket 240/60s, fail-closed | body <=16 KB streamed, schema allowlist, 25 events max |
| `/universalis/aggregated/:dc/:ids` and `/api/v2/...` | GET | none | cache-miss charge: native binding per IP (30 prod), service key 20x | static world/DC set + upstream-list fallback, ids `^[\d,]+$`, 1..100 ids, 1..1e6, canonicalised |
| `/universalis/data-centers`, `/worlds` | GET | none | none (24 h cached) | none needed |
| developers.xivdyetools.app/* | GET | none | none (static assets) | host-exact check |

## Positive controls

- Telemetry datapoint = event, tool, dimA, dimB, locale(6-enum), theme(2-enum), vp(m/t/d), ver (strict semver regex, 16 chars), env derived from Origin, double = dwell<=1800 (schema.ts:56-69, 139-197). No IP, UA, request id reaches a datapoint; Origin value is never logged (router.ts:68-76). stainID checked against the dye DB (schema.ts:87-90). Event lookup uses a Map (no prototype keys).
- GPC check is first and unconditional (router.ts:52-54); matches PRIVACY.md section "Usage analytics". Unaccepted origins get 204 and a drop, body unread (router.ts:62-72).
- Rate limiters key per `CF-Connecting-IP` only (XFF not trusted, ip.ts:62); production native bindings declared for all five buckets (wrangler.toml env.production); telemetry limiter fails closed (rate-limit.ts:188-219).
- Logger middleware logs method + pathname only, no UA (logger.ts:127-144); observability off in both blocks (wrangler.toml); error handler never returns a stack, generic message in production (index.ts:222-253); 4xx/5xx and non-2xx get `no-store` (index.ts:81-83).
- Universalis: `redirect: 'manual'`, 10 s timeout, 5 MB streamed cap, status clamp, upstream statusText logged not echoed, world/DC allowlist, cache key from validated lowercased name and sorted-unique ids, fixed synthetic cache origin (cached-fetch.ts, router.ts, cache-service.ts:56-60).
- No D1, no R2, no KV key built from request data in this scope (KV only as limiter fallback, bound only when binding absent). No template SQL. No secrets in `[vars]`; no regex built from user input in api-worker/src.
- Numeric params are strict decimal (BUG-038), enum params reject prototype names (BUG-011), facewear negative ids give a 404 with slug (dyes.ts:211-227).
- Docs host: security headers applied to immutable asset response copy (index.ts:44-53); docs source has no third-party scripts, fonts self-hosted.

## Rejected

- `received:` echo of bad query values in error `details`: JSON body, `nosniff`, `no-store`; no sink.
- Dev env leaks `err.message` (index.ts:253): dev worker has `workers_dev=false`, `preview_urls=false`.
- KV rate-limit fallback keys embed raw IP (kv.ts:buildKey): only when bindings are absent, documented in PRIVACY.md (120 s); accepted-style, production has all bindings.
- Telemetry `ver` can carry up to ~10 free chars after `-`: forgeable-client only, not personal data, origin-gated.
- Uncached hits on aggregated route are free of limiter: intended (API-7); KV limiter race and fail-open are accepted trade-offs.
- Docs host lacks CSP/Cache-Control override: static site, no inputs; INFO only.
- CORS `*` on POST telemetry: Origin header gate is the control (FINDING-014).

## Candidate

api-worker-public-01 (LOW): invalid world/DC names trigger two uncharged upstream list fetches (router.ts:166-190) before any limiter charge; failures are not negative-cached.

FILES COVERED: 38 files (apps/api-worker/src/{index.ts,types.ts,lib,middleware,routes,telemetry,universalis}, wrangler.toml, docs/.vitepress config/theme/live.ts, docs/guide/rate-limits.md, worker-kit logger/ip/cloudflare/kv backends), plus PRIVACY.md telemetry section.
