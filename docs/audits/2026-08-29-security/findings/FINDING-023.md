# FINDING-023: no wrangler-config invariant test on oauth (bare deploy = production), image-worker (binding-only), moderation-worker or presets-api — og-worker and api-worker have one
**Severity:** LOW · **Exposure:** LOCAL (config drift → INTERNET-UNAUTH) · **Deploy unit:** oauth + image-worker + moderation-worker + presets-api · **Rotation:** NONE · **CWE:** CWE-1059 (insufficient technical documentation / guard)

## Location
- `apps/oauth/wrangler.toml:16,25-38,40-46,52-73` — invariants worth pinning: no `[env.preview]`, top-level `ENVIRONMENT = "production"`, three `[[ratelimits]]`, dev ids ≠ prod ids, `TOKEN_BLACKLIST` id = presets-api's; only 'wrangler' hit in oauth tests is a comment (`src/__tests__/env-validation.test.ts:126`)
- `apps/image-worker/wrangler.toml` + `src/index.ts:59,111` — "no routes, `workers_dev = false` in both envs" has no test and no in-code fallback (no shared-secret header), so one config flip publishes an unauthenticated decode/SSRF surface
- moderation-worker / presets-api — `workers_dev = false` unguarded (INF-06 residual)

## Evidence
- `apps/og-worker/tests/wrangler-env.test.ts`, `apps/api-worker/tests/wrangler-config.test.ts` are the pattern; `git ls-files 'apps/image-worker/*.test.ts'` → seven files, none reads the toml.

## Fix
- Add `tests/wrangler-config.test.ts` to the four workers (parse the toml, assert the invariants); optionally a cheap `X-Internal-Caller` header check in image-worker as defence in depth.

## Status
PARTIAL — presets-api part FIXED 2026-08-30 efd495a4 (2.2.0: `tests/wrangler-config.test.ts` pins `workers_dev`, routes, production `JWT_ISSUER`/`ENVIRONMENT`, `TOKEN_BLACKLIST` ids cross-checked against oauth's toml, `RL_PUBLIC`, no `[env.preview]`); oauth (Sprint 2), moderation-worker (Sprint 4) and the image-worker anchor (Sprint 8) pending.
