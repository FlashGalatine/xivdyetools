# DEAD-034: KV rate-limiter fallbacks in four workers — still present, still gated on production evidence this audit cannot produce

**Confidence:** LOW (as dead code) · **Blast radius:** MEDIUM · **Deploy unit:** apps/api-worker · apps/oauth · apps/discord-worker · apps/moderation-worker · **Semver:** NONE (app-internal) · **Category:** Dead Path (gated)
Supersedes `docs/operations/POST_MERGE_CHECKLIST.md` §3 row "KV rate-limiter fallbacks" — carried forward here so it is not lost between audits.

## Location
- `apps/api-worker/src/middleware/rate-limit.ts:45-48,139` — `KVRateLimiter` branches in `selectApiRateLimiter` / `selectTelemetryRateLimiter`
- `apps/oauth/src/services/rate-limit.ts:98-113` — module-scope `kvLimiter`
- `apps/discord-worker/src/services/rate-limiter.ts:103,154-158,250-255` — `configuredBackend === 'kv'` path and its one-shot fallback warning
- `apps/moderation-worker/src/middleware/rate-limit.ts:169` — the `: new KVRateLimiter(…)` arm
- Plus the `RATE_LIMIT` / `RATE_LIMIT_KV` KV bindings in the corresponding `wrangler.toml` files

## Evidence
- All four branches are reachable in code — they are the fallback taken when the Cloudflare-native rate-limiting binding is absent, so no static analysis can call them dead. `evidence/bindings.py` confirms every declared binding still has a production reference, i.e. nothing here is *config* dead either.
- The gate is empirical and was set by the 2026-08-29 security audit (FINDING-003/005): **one week of production logs with no fallback warning**. discord-worker already emits exactly that signal (`rate-limiter.ts:250-255`).
- Constraint from the same audit that bounds how to collect it: Workers Logs must not be enabled without re-checking FINDING-010/011 first.

## Fix
**KEEP until the gate is met — do not schedule a removal sprint on this audit's evidence.**
**Revisit trigger:** a week of clean production tail on all four workers (or the equivalent from the existing analytics), after which removal is one commit per worker plus deletion of the now-unused KV namespaces. Until then the branches are insurance, not dead code.

## Status
OPEN (KEEP) — unchanged; gate is a week of clean production logs.

