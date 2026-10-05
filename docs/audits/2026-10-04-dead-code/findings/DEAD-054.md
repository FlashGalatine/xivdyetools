# DEAD-054: UpstashRateLimiter in worker-kit has no in-repo constructor (only its own test) but is @public published API: ~206 src lines + 344-line test
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/worker-kit · **Semver:** MAJOR · **Category:** Unused Export · **Origin:** MAIN

## Location
- `packages/worker-kit/src/rate-limiter/backends/upstash.ts:47` — UpstashRateLimiter

## Evidence
- No app or package constructs it; apps reference it only in comments/CHANGELOGs. The only importer is backends/upstash.test.ts. It is @public, published in 1.4.1 and reachable via root, ./rate-limiter and ./rate-limiter/upstash.
  - Commands: git grep -n -w UpstashRateLimiter -- . ':!docs/audits/**' outside upstash.ts = rate-limiter/index.ts:68 barrel, kv.ts/types.ts comments, README/CLAUDE/CHANGELOG/docs prose only; no `new UpstashRateLimiter` in apps; @upstash/redis declared only in packages/worker-kit/package.json:70; git show c50ea318 (release 1.4.1):packages/worker-kit/src/rate-limiter/index.ts:68 exports it
- Re-verified independently in the completeness re-sweep: Only upstash.test.ts constructs it, but the rate-limiter barrel tags both exports @public (index.ts:59,68). stoat-worker CLAUDE.md:98 and README.md:28 name it as the planned limiter, so removing it now would contradict a standing tag.
- Origin: git grep -n -w UpstashRateLimiter 8ecb878f -- apps = no code hits; git diff --stat 8ecb878f HEAD -- packages/ touches only bot-logic locales; app-side diff grep for UpstashRateLimiter empty

## Fix
**KEEP.** Published @public backend (npm 1.4.1). Revisit trigger: the next worker-kit major (2.0.0). Retire the backend, its options type, the ./rate-limiter/upstash subpath and the @upstash/redis dependency together then. This is not 2026-09-15-dead-code/DEAD-020: it is not a fallback, and no selector picks it.

Steps: At worker-kit 2.0.0:
1. Delete packages/worker-kit/src/rate-limiter/backends/upstash.ts (165 lines) and upstash.test.ts (344 lines).
2. Delete UpstashRateLimiterOptions from rate-limiter/types.ts:215-255.
3. Remove the barrel lines rate-limiter/index.ts:59 (UpstashRateLimiterOptions) and :67-69 (UpstashRateLimiter).
4. Remove the "./rate-limiter/upstash" exports-map entry and the @upstash/redis dependency from package.json, then run pnpm install to update the lockfile.
5. Fix the comments at src/index.ts:16 and backends/kv.ts:20,106, plus README.md:41,211 and CLAUDE.md:14,25,43.
6. Add a CHANGELOG entry and a DEPRECATIONS.md note.
7. Run pnpm turbo run build type-check lint test --filter=...@xivdyetools/worker-kit, then pnpm dead-code:check.

## Status
KEEP (register) — revisit on the trigger above
