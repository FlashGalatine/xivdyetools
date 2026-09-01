# FINDING-012: worker-kit `CloudflareRateLimiter` fails open silently — no consumer passes a logger, `backendError` is dropped by oauth and moderation-worker, and no test exercises a throwing binding
**Severity:** LOW · **Exposure:** INTERNET-UNAUTH · **Deploy unit:** worker-kit + oauth + moderation-worker (api-worker / presets-api share the pattern) · **Rotation:** NONE · **CWE:** CWE-636, CWE-778 (insufficient logging)

## Location
- `packages/worker-kit/src/rate-limiter/backends/cloudflare.ts:108-117,159-175` — `config.failOpen !== false` → allow, with `this.logger?.warn(...)` on an optional logger; the constructor never validates the binding
- `apps/oauth/src/services/rate-limit.ts:95-98`, `apps/moderation-worker/src/middleware/rate-limit.ts:147-150` — constructed without a logger; `backendError` ignored at oauth `rate-limit.ts:140-145`, moderation `rate-limit.ts:188-193`

## Evidence
- `docs/architecture/security-trade-offs.md:125-129` accepts fail-open **on the condition** that fail-open events are logged/alertable — here they are invisible; `rate-limit-binding.test.ts` (both workers) covers allow/deny/fallback, never a throwing binding; `docs/operations/POST_MERGE_CHECKLIST.md:340` binding confirmation still unchecked.

## Fix
- worker-kit: fall back to `console.warn` when no logger is supplied and expose `backendError` on the result/headers; consumers: pass the request logger, count `backendError`; add a throwing-binding test per consumer; consider `failOpen: false` on oauth `/auth/*`.

## Status
FIXED 2026-08-30 (all three units) — worker-kit part `3f5dc8e2`, `2bf2a5cb` (1.2.0).
`CloudflareRateLimiter`, `KVRateLimiter.checkOnly` and `UpstashRateLimiter` now fall back to
`console.warn` with the same redacted context when constructed without a logger, so a fail-open
is never silent — the condition `docs/architecture/security-trade-offs.md:125-129` places on
accepting fail-open at all. `CloudflareRateLimiter`'s constructor validates every tier's binding
and throws, instead of letting a typo'd `[[ratelimits]]` name fail *open* on the first request.
No client-visible `backendError` header was added (it would tell a brute-forcer when the limiter
is degraded — the ruling oauth 3.0.0 and moderation-worker 1.6.0 shipped on); `result.backendError`
was verified correct on every fail-open path rather than changed.

**Known consequence, disclosed in the 1.2.0 changelog:** no in-repo consumer passes `logger:` to
a backend (both bots deliberately don't, to avoid freezing the first request's id in a per-isolate
singleton), so **five** workers now emit the backend's raw `console.warn` *and* their own
structured warn per fail-open event. That duplication is the accepted trade — an opt-out would
re-create the configuration-dependent silence this finding is about. A late-bound logger option
(`logger?: RateLimiterLogger | (() => RateLimiterLogger | undefined)`) would remove it additively;
routed as a follow-up, with the middleware's own still-silent `catch` fail-open.

Consumer halves, for the record: oauth part FIXED 2026-08-30 b14cade9 (3.0.0: `backendError` surfaced per request through the request logger, path only, deliberately no client-visible header — ruling R3; throwing-binding test proves the request is still served and the warn is emitted). moderation-worker part FIXED 2026-08-30 b5d4c53b (1.6.0: `backendError` copied through the local result type and warned per request at both call sites with `{ type }` only, no client-visible header; throwing-binding tests) (both shipped earlier in this branch).
