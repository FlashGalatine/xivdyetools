# DEAD-025: rateLimitMiddleware in moderation-worker rate-limit.ts is a never-mounted no-op reached only by its test — 25 source + 13 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/moderation-worker/src/middleware/rate-limit.ts:260` — rateLimitMiddleware

## Evidence
- The body only awaits next(). index.ts never imports it; it calls checkRateLimit/incrementRateLimit directly. The only other in-unit hit is the same-file @example docblock at lines 20-22. Every other repo hit is the unrelated worker-kit factory used by api-worker and presets-api.
  - Commands: git grep -n -w rateLimitMiddleware: moderation-worker hits = rate-limit.ts:20,22 (docblock), :260 (def), rate-limit.test.ts:13,285,289,292; no index.ts import; no app.use in the unit; The gate exit 0 is a known under-report: the same-file docblock is a raw-text reference; main 8ecb878f: same hits at the same lines
- Origin: git grep -n -w rateLimitMiddleware 8ecb878f -- apps/moderation-worker returns identical hits (rate-limit.ts:20,22,260 + test); git log 8ecb878f..HEAD -SrateLimitMiddleware -- apps/moderation-worker is empty

## Fix
**REMOVE.** Nothing to verify beyond the gate: no mount, no dynamic access, and the app is not published.

Steps: 1. In apps/moderation-worker/src/middleware/rate-limit.ts, delete lines 250-267 (docblock + function).
2. Delete line 26 `import type { Context, Next } from 'hono';`. It becomes unused, and Env stays in use at line 126.
3. In the header docblock, delete the @example block at lines 18-23 and correct the stale line 10 (REFACTOR-002 `@xivdyetools/rate-limiter`, now worker-kit/rate-limiter).
4. In rate-limit.test.ts, delete the import at line 13 and the describe('rateLimitMiddleware') block at lines 285-296.
5. Run `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker`, then `pnpm dead-code:check`.

## Status
OPEN
