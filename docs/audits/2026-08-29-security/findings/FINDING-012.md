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
PARTIAL — oauth part FIXED 2026-08-30 b14cade9 (3.0.0: `backendError` surfaced per request through the request logger, path only, deliberately no client-visible header — ruling R3; throwing-binding test proves the request is still served and the warn is emitted). moderation-worker (Sprint 4) and the worker-kit anchor (Sprint 9: `console.warn` fallback, binding validation, KV-backend `backendError` parity; consider `failOpen: false` for `/auth/*`) pending.
