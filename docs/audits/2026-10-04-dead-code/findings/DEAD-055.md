# DEAD-055: getClientIp trustXForwardedFor opt-in path is test-only in-repo — 26 src lines + 60 test lines; stale comments
**Confidence:** HIGH · **Blast radius:** HIGH · **Deploy unit:** packages/worker-kit · **Semver:** MAJOR · **Category:** Dead Path · **Origin:** MAIN

## Location
- `packages/worker-kit/src/rate-limiter/ip.ts:26` — GetClientIpOptions.trustXForwardedFor

## Evidence
- No production caller passes options to getClientIp (api-worker, presets-api, oauth wrapper all call getClientIp(req)); XFF branch ip.ts:66-76 reached only from ip.test.ts. Stale comments at ip.ts:46 and :67 contradict @default false.
  - Commands: git grep -w trustXForwardedFor -- . : only ip.ts, ip.test.ts, oauth test title (calls getClientIp(req) without options), changelogs/docs.; git grep -w getClientIp prod calls: api-worker rate-limit.ts:76/117/199, router.ts:139, presets-api rate-limit.ts:100, oauth rate-limit.ts:124 — none pass options.; npm view @xivdyetools/worker-kit version = 1.4.1 = local.
- Origin: git log --oneline 8ecb878f..HEAD -S trustXForwardedFor: empty; no PR touches packages/worker-kit (pr-delta.txt); worker-kit 1.4.1 (c50ea318) already has the option.

## Fix
**KEEP.** Published security opt-in; GetClientIpOptions is explicitly /** @public */ at rate-limiter/index.ts:82; worker-kit 1.4.1 = npm. Revisit at next worker-kit major. Fix the stale docs now (comment-only, no semver).

Steps: Now (docs only): packages/worker-kit/src/rate-limiter/ip.ts:46-50 rewrite JSDoc example (default ignores XFF; opt in with { trustXForwardedFor: true }); ip.ts:67 drop '(default true for compat)'; packages/worker-kit/README.md:223 'Never trusts X-Forwarded-For' -> 'unless opted in'. Removal (major only): ip.ts:8-27, param :55, :58, :66-76; index.ts:82; ip.test.ts:20-28, 40-48, 66-87, 99-107, 121-129. Then pnpm turbo run build type-check lint test --filter=...@xivdyetools/worker-kit && pnpm dead-code:check

## Status
KEEP (register) — revisit on the trigger above
