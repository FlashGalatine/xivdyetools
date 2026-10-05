# DEAD-028: Unused _maxRetries parameter of incrementRateLimit in rate-limit.ts; its @param falsely says it is passed to the shared package: 2 src lines + 4 call-site edits
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/moderation-worker · **Semver:** NONE · **Category:** Dead Path · **Origin:** MAIN

## Location
- `apps/moderation-worker/src/middleware/rate-limit.ts:233` — incrementRateLimit._maxRetries

## Evidence
- The body (lines 236-247) never reads _maxRetries. Both production callers (index.ts:324,400) pass a literal 3 only to reach the positional `bindings` argument.
  - Commands: sed rate-limit.ts:229-248: no use of _maxRetries; @param at :227 claims 'passed to shared package'; git grep -w incrementRateLimit: index.ts:324,400 pass 3; component-gate.test.ts:134 and rate-limit-binding.test.ts:59 pass 3; the rest pass 3 args; main 8ecb878f: rate-limit.ts:233 identical
- Origin: git grep -n _maxRetries 8ecb878f -- apps/moderation-worker -> rate-limit.ts:233

## Fix
**REMOVE.** Type-check catches any missed call site: a leftover literal 3 would bind to `bindings?: ModerationRateLimitBindings` and fail.

Steps: 1. In apps/moderation-worker/src/middleware/rate-limit.ts, delete line 233 (`_maxRetries: number = 3,`) and the @param at line 227.
2. Optionally reword the stale MOD-BUG-001 note at lines 221-222.
3. In src/index.ts:324 and :400, drop the `3,` argument.
4. In src/component-gate.test.ts:134, expect `(env.KV, MOD, 'command', expect.anything())`.
5. In src/middleware/rate-limit-binding.test.ts:59, call `incrementRateLimit(mockKV, 'user-1', 'command', bindings)`.
6. Run `pnpm turbo run build type-check lint test --filter=...xivdyetools-moderation-worker`, then `pnpm dead-code:check`.

## Status
OPEN
