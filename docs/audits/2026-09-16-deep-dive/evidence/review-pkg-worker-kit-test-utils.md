# Review: pkg-worker-kit-test-utils

Scope: `packages/worker-kit/src/` (published, Level 1) and `packages/test-utils/src/` +
`packages/test-utils/integration/` (workspace-private). Read-only review, no git/tests/builds run.

## 1. Map

| Module | Purpose |
|---|---|
| `worker-kit/src/middleware/{request-id,logger,rate-limit}.ts` | Hono middleware factories: request-ID (UUID validation), request logger, rate-limit (429/headers/fail-open) |
| `worker-kit/src/middleware/{index,types}.ts` | Barrel + `ContextVariableMap` augmentation |
| `worker-kit/src/rate-limiter/backends/memory.ts` | In-process sliding-window log + LRU eviction + per-key largest-window cleanup |
| `worker-kit/src/rate-limiter/backends/kv.ts` | Best-effort fixed-window KV limiter, checkOnly/increment split, retry-on-throw |
| `worker-kit/src/rate-limiter/backends/cloudflare.ts` | Native `[[ratelimits]]` binding, tiered by `(limit, period)`, fails loudly on bad binding at construction |
| `worker-kit/src/rate-limiter/backends/upstash.ts` | Redis INCR+EXPIRE NX pipeline, TTL-derived `resetAt`/`retryAfter` |
| `worker-kit/src/rate-limiter/{ip,key-scope,headers}.ts` | `getClientIp` (CF-Connecting-IP priority, XFF opt-in), key redaction, `X-RateLimit-*` header synth from real result |
| `worker-kit/src/rate-limiter/presets/configs.ts` | OAuth/Discord/moderation/public-API limit tables + longest-prefix / subcommand lookup |
| `worker-kit/src/rate-limiter/{index,types}.ts` | Barrel + shared interfaces |
| `test-utils/src/cloudflare/{d1,kv,r2,fetcher,analytics}.ts` | D1/KV/R2/service-binding/AE mocks with inspectable state |
| `test-utils/src/factories/{dye,preset,category}.ts` | Domain object factories (random, parallel-safe ids) |
| `test-utils/src/auth/{jwt,headers}.ts` | Test JWT signing + bearer header builder |
| `test-utils/src/constants/pkce.ts`, `src/utils/counters.ts`, `src/index.ts` | PKCE constants, id generators, barrels |
| `test-utils/integration/**` | Cross-service auth simulations (bot + JWT paths) built on the above mocks |

## 2. Candidates

**pkg-worker-kit-test-utils-16** — BUG, MEDIUM — `packages/test-utils/src/factories/dye.ts:35-37` (used at `:181`) — `randomStainId()` draws uniformly from only 254 values (`Math.floor(Math.random()*254)+1`), so `createMockDye()`'s default `stainID`→`itemID`→`id` chain collides with ~1/254 probability per pair of calls with no override and no collision-avoidance (unlike `utils/counters.ts`'s 9-digit `randomId()`/`randomStringId()`, which follow the documented TEST-DESIGN-001 parallel-safety pattern). `tests/factories/dye.test.ts:90-95` ("generates unique IDs") calls `createMockDye()` twice and asserts `dye1.id !== dye2.id` — failed in this audit's baseline coverage run (`expected 5794 not to be 5794`, i.e. both draws landed on stainID 66). Covered by test: **yes, and it is the flake** — the test exists but is itself unreliable rather than catching a real defect.
```ts
function randomStainId(): number {
  return Math.floor(Math.random() * MAX_STAIN_ID) + 1;   // only 254 values
}
...
const stainID = overrides.stainID ?? randomStainId();
const itemID = overrides.itemID ?? legacyItemIdForStain(stainID);
const id = overrides.id ?? itemID;                        // no uniqueness check
```
Fix direction: either widen the default id space (fall back to `randomId()`-style large range when the caller doesn't need a realistic in-range stainID) or make the "generates unique IDs" test pass explicit distinct `stainID` overrides instead of relying on two unmodified calls.

**pkg-worker-kit-test-utils-17** — BUG, MEDIUM — `packages/test-utils/src/factories/dye.ts:181-189` — `createMockDye({ stainID: null })` — the documented "null arm" legacy-fixture shape from `packages/types/src/dye/dye.ts:41-48` ("carry `id`/`itemID` without a `stainID`") — cannot be produced correctly by this factory. Failing input: `createMockDye({ stainID: null })` with no `itemID`/`id` override. `overrides.stainID ?? randomStainId()` treats the explicit `null` as nullish and substitutes a random 1-254 stain id *before* `itemID`/`id`/`name` are derived from it; the final `...overrides` spread does correctly restore `dye.stainID === null` on the returned object, but `itemID`, `id`, and `name` were already computed from the discarded random decoy rather than the deterministic `legacyItemIdForStain(null) → LEGACY_ITEM_ID_BASE + 1 = 5729` fallback that `legacyItemIdForStain` itself implements (`packages/test-utils/src/factories/dye.ts:39-41`) but can never reach through this call path — that branch is dead code from `createMockDye`. Wrong outcome: a test exercising the null-stainID loader-fallback path gets a nondeterministic, non-reproducible `itemID`/`id`/`name` each run, defeating the shared-fixture guarantee this file was just hardened for (see the -15 comment in the same file). Why tests miss it: `tests/factories/dye.test.ts` has no case passing `stainID: null` (the only null-adjacent case is the default-args test, which never sets it). Covered by test: **no**.
```ts
const stainID = overrides.stainID ?? randomStainId();     // null -> random, not the "unknown" fallback
const itemID = overrides.itemID ?? legacyItemIdForStain(stainID);
const id = overrides.id ?? itemID;
return {
  itemID, stainID, id,
  name: `Test Dye ${stainID ?? id}`,                       // stainID here is never null, so `?? id` is dead
  ...
  ...overrides,                                            // restores stainID: null here, too late for the above
};
```
Fix direction: compute `stainID`/`itemID`/`id`/`name` from `overrides.stainID` directly (distinguish "not provided" from "explicitly null") instead of coalescing null into `randomStainId()` before use.

## 3. POSITIVE

- `MemoryRateLimiter`'s sliding-window log and per-key "largest window ever seen" cleanup cutoff (BUG-023/097) are correct and covered by targeted regression tests for mixed-window keys on one instance.
- `scopeRateLimitKey()` redaction is applied consistently at all six fail-open/backend-error call sites (middleware x2, KV, Upstash, Cloudflare backends) and every one has a test asserting the raw key/derived key is absent, not just that a warning fired.
- `X-RateLimit-*`/`Retry-After` headers are always derived from the real `RateLimitResult` (never a synthesized placeholder), and `rateLimitMiddleware` applies them post-`next()` so a raw `new Response(...)` handler still receives them (not just `c.json()` responses).
- `CloudflareRateLimiter` validates every tier's `binding.limit` is callable at construction (fails loudly, not a silent forever-fail-open) and keys per-tier by `(limit, period)`, closing both the "shared binding across tiers" and "period-mismatch" classes of bucket collision.
- D1/KV/R2 mocks model real edge cases missing from a naive mock: D1 `.bind()` returns an independent statement and validates bindable types; `batch()`/session `batch()` are all-or-nothing and carry mutation `meta`/`RETURNING` rows like real `run()`; KV/R2 `list()` cursors never report "truncated, no cursor" (a state real KV/R2 never returns); KV rejects `expirationTtl < 60` and clears metadata on a bare `put()`.
- `getClientIp()` defaults to ignoring `X-Forwarded-For` (CF-Connecting-IP only) and normalizes IPv6 case, matching the SEC-002/FINDING-006 fixes.

## 4. REJECTED

- `DISCORD_COMMAND_LIMITS[commandName]` / `getDiscordCommandLimit` has no `Object.hasOwn` guard against prototype keys (`"toString"` etc.) — theoretically resolves `Object.prototype.toString` instead of `undefined`, but `commandName` only ever comes from a Discord interaction payload behind Ed25519 signature verification in discord-worker, not free-form client input reachable from this package — not exploitable here.
- `KVRateLimiter.reset()`/`resetAll()` (`backends/kv.ts`) call `kv.list({ prefix })` once with no cursor loop, so >1000 keys under a prefix would only be partially cleared — but both are documented test/ops-only helpers ("Primarily for testing purposes") backed by TTL-based expiry as a safety net, and `kv.ts` was not touched in this review cycle's changed-file set.
- Upstash pipeline command-level errors (a command erroring without the whole `pipeline.exec()` rejecting) — could not construct a concrete failing scenario from the SDK's documented behavior or the existing mock harness; the existing try/catch around the whole pipeline already fails open correctly for thrown/rejected cases, which is the only failure mode the test suite (and available docs) can produce.
- `CloudflareRateLimiter.selectTier`'s `candidates[candidates.length - 1]` fallback when nothing matches — cannot be `undefined` because the constructor throws on an empty `tiers` array and `samePeriod.length > 0 ? samePeriod : this.tiers` always leaves at least one candidate.

## 5. COVERED

44 files read (all non-test source in scope, plus the matching `*.test.ts`/`tests/*.test.ts`/`integration/*.test.ts` files to judge coverage):

worker-kit/src: index.ts, middleware/{index,logger,rate-limit,request-id,types}.ts, middleware/{logger,rate-limit,request-id}.test.ts, rate-limiter/{index,types,ip,key-scope,headers}.ts, rate-limiter/{ip,key-scope,headers}.test.ts, rate-limiter/backends/{memory,kv,cloudflare,upstash}.ts, rate-limiter/backends/{memory,kv,cloudflare,upstash}.test.ts, rate-limiter/presets/{configs,index}.ts, rate-limiter/presets/configs.test.ts (28 files)

test-utils/src: index.ts, cloudflare/{d1,kv,r2,fetcher,analytics,index}.ts, auth/{jwt,headers,index}.ts, factories/{dye,preset,category,index}.ts, constants/{pkce,index}.ts, utils/{counters,index}.ts (18 files)

test-utils/tests: cloudflare/{d1,kv,r2,fetcher,analytics}.test.ts, auth/{jwt,headers}.test.ts, factories/{dye,preset,category}.test.ts, constants/pkce.test.ts, utils/counters.test.ts (11 files)

test-utils/integration: setup.ts, discord-presets/bot-authentication.test.ts, oauth-presets/jwt-validation.test.ts (3 files)
