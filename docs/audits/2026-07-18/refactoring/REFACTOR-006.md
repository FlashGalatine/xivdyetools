# [REFACTOR-006]: Durable Object rate limiter is fully dead code (unbound, unexported, flag never set)

## Priority
MEDIUM

## Category
Architecture / Dead Code with security consequence

## Location
- File(s): `apps/oauth/src/durable-objects/rate-limiter.ts` (240 lines); `apps/oauth/src/services/rate-limit-do.ts` (114 lines); `apps/oauth/src/index.ts:132-145` (feature-flag branch); `apps/oauth/wrangler.toml` (no `[[durable_objects.bindings]]`, no `[[migrations]]`, no `USE_DO_RATE_LIMITING` var in any environment)
- Scope: module level (oauth rate limiting subsystem)

## Current State
The runtime path requires `c.env.USE_DO_RATE_LIMITING === 'true' && c.env.RATE_LIMITER` (index.ts:137). Neither exists in `wrangler.toml` for any environment (production, development, preview). Additionally, the `RateLimiter` class is **not exported from `src/index.ts`**, so it could not deploy as a Durable Object even if a binding were added. Every deployment therefore silently uses the per-isolate `MemoryRateLimiter` — the brute-force protection on `/auth/*` resets per isolate/colo, so an attacker rotating colos or waiting for isolate churn gets a large multiple of the configured 10 req/min.

Latent issues inside the DO if it were ever enabled:
- `alarm()` reschedules itself unconditionally every 2 minutes forever (`rate-limiter.ts:233-239`) — every IP that ever authenticates leaves a DO waking eternally (cost leak). It should go quiescent when `requestLog` is empty.
- `rate-limit-do.ts:43-51` has the same prefix-shadowing config-lookup bug as the in-memory service (`/auth/xivauth` matches before `/auth/xivauth/callback`; see BUG-007).

## Issues
- ~360 lines of maintained, tested-looking code that can never execute.
- The feature flag's existence gives a false impression that distributed rate limiting is one config toggle away — it also requires a class export and a DO migration.
- Meanwhile the actual protection level of the highest-value brute-force target (auth endpoints) is materially weaker than configured (see OPT-004).

## Proposed Refactoring
Decide explicitly:
- **(a) Wire it up (recommended):** `export { RateLimiter } from './durable-objects/rate-limiter.js';` in index.ts; add `[[durable_objects.bindings]]` + `[[migrations]] new_classes = ["RateLimiter"]` and `USE_DO_RATE_LIMITING = "true"` to wrangler.toml; fix the alarm to stop rescheduling when empty (`if (this.requestLog.size === 0) return;` after cleanup); fix the config-lookup ordering.
- **(b) Delete:** remove both files and the branch in index.ts:132-145, and the `RATE_LIMITER`/`USE_DO_RATE_LIMITING` fields from `types.ts:65,76`.

## Benefits
- (a): real distributed rate limiting on auth endpoints; (b): smaller, honest codebase and a simpler index.ts. Either outcome removes the misleading half-built state.

## Effort Estimate
LOW (delete) / MEDIUM (enable: bindings + migration + two fixes + a smoke test against a deployed preview).

## Risk Assessment
LOW. Enabling is behind fail-open error handling (`checkRateLimitDO` returns `allowed: true` on DO errors), so a botched rollout degrades to current behavior rather than blocking logins. Deleting is risk-free at runtime (code is unreachable today).

> Source: evidence/d1-workers-analysis.md (2026-07-18 deep-dive, d1-workers area)

## Status

**DONE 2026-07-19** — decided (b) delete: `durable-objects/rate-limiter.ts`, `services/rate-limit-do.ts`, the index.ts feature-flag branch, and the `RATE_LIMITER`/`USE_DO_RATE_LIMITING` Env fields are gone (~360 dead lines). Distributed limiting was achieved via KV instead (see OPT-004).
