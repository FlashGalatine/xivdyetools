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
OPEN
