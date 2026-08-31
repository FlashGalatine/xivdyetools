# FINDING-010: every request on oauth, api-worker and presets-api is logged with its User-Agent (`logUserAgent: true`), and limiter error paths log the raw key (client IP / Discord id) — the web privacy guide promises the UA is never collected and that the telemetry server "discards everything about the request"
**Severity:** LOW (latent — not retained today) · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** worker-kit + oauth + api-worker + presets-api · **Rotation:** NONE · **CWE:** CWE-532

## Location
- `packages/worker-kit/src/middleware/logger.ts:141-145` — `startContext.userAgent = c.req.header('user-agent')` on "Request started"; opted in at `apps/oauth/src/index.ts:37-40`, `apps/api-worker/src/index.ts:66-73` (covers `POST /v1/telemetry`), `apps/presets-api/src/index.ts:49-53`; og-worker sets `false`
- `packages/worker-kit/src/middleware/rate-limit.ts:142-150,175-184`, backends `kv.ts:165-170,228-247`, `cloudflare.ts:161-165`, `upstash.ts:100-104` — the limiter key (`public:ip:<ip>` on presets-api/api-worker, Discord id on the bots) is logged on backend errors

## Evidence
- `apps/web-app/PRIVACY.md:78-82`: "never collected: your IP address, user agent … The server discards everything about the request except the validated events"; `apps/api-worker/CHANGELOG.md:16` repeats it. Nothing consumes the UA. Promotes 2026-08-21 INFO API-14.
- Retention: none today — `evidence/workers-log-retention.md` (observability unset on all 9 scripts, logpush off, no tail consumers), so the lines exist only in a live `wrangler tail`; enabling Workers Logs would make this a policy breach.

## Fix
- Default `logUserAgent` to `false` in worker-kit and remove the three opt-ins; on limiter errors log the key's scope, not its value; note in `docs/operations` that Workers Logs must not be enabled before FINDING-010/011 are closed.

## Status
FIXED 2026-08-30 (all four units) — worker-kit part `3f5dc8e2`, `e502384a`, `2bf2a5cb` (1.2.0).
Six log sites carried the raw limiter key — a client IP or a Discord user id — on their
fail-open / backend-error paths: `middleware/rate-limit.ts`'s two warns, all three fallible
backends' fail-open catches, and `kv.ts`'s increment retry-exhausted path (its logger call *and*
its `console.error` fallback). `kv.ts` logged it twice, once as `key` and once embedded in the
derived `kvKey`. All six now log a `keyScope` through one helper (`scopeRateLimitKey`): a
configured `keyPrefix` — chosen by deploying code, never derived from request data — *is* the
scope and the key is discarded outright; otherwise the key is classified by shape (`ip` / `id` /
`unknown` / `unscoped` / `empty`) without echoing any substring of it. Deliberately not a hash: a
hashed IP is still an IP-shaped identifier that correlates two log lines. `keyPrefix` is the one
remaining input written verbatim, and its public JSDoc now says so on all three option types.
The `logUserAgent` "default flip" was a no-op (already `false`); the real defect was the JSDoc
example recommending `true`, now corrected.

Consumer halves, for the record: api-worker part FIXED 2026-08-30 81035796 (0.10.0: the last `logUserAgent: true` opt-in in the tree is gone — request logs match the web privacy page; note the worker-kit default was already `false`, so Sprint 9's "default flip" item is a no-op and only the limiter-key logging remains there). presets-api opt-in removed 2026-08-30 efd495a4 (2.2.0) and oauth opt-in removed 2026-08-30 b14cade9 (3.0.0), each with a test that the request-start log has no `userAgent` (all shipped earlier in this branch).
