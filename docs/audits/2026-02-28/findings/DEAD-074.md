# DEAD-074: @xivdyetools/rate-limiter — Duplicate `UpstashRateLimiterOptions` Interface

## Category
Legacy/Deprecated

## Location
- File(s): `packages/rate-limiter/src/types.ts` (lines 222–254), `packages/rate-limiter/src/backends/upstash.ts` (lines 46–64)
- Symbol(s): `UpstashRateLimiterOptions`

## Evidence
The `UpstashRateLimiterOptions` interface is defined **identically** in two places:

**In `types.ts` (lines 222–254):**
```typescript
export interface UpstashRateLimiterOptions {
  url: string;
  token: string;
  keyPrefix?: string;
  logger?: RateLimiterLogger;
}
```

**In `backends/upstash.ts` (lines 46–64):**
```typescript
export interface UpstashRateLimiterOptions {
  url: string;
  token: string;
  keyPrefix?: string;
  logger?: RateLimiterLogger;
}
```

The main barrel `src/index.ts` re-exports the `types.ts` version. The `UpstashRateLimiter` class in `upstash.ts` uses its **local** copy. Both are structurally identical, but changes to one will not propagate to the other — a maintenance hazard.

This pattern differs from `MemoryRateLimiterOptions` and `KVRateLimiterOptions` which are only defined in `types.ts` and imported by their respective backends.

## Why It Exists
The `UpstashRateLimiter` was likely developed as a standalone module first, with its own options interface. When `types.ts` was consolidated as the central type hub, the local definition wasn't removed.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — structurally identical, maintenance risk is real |
| **Blast Radius** | LOW — single file change in `upstash.ts` |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — only used by `UpstashRateLimiter` constructor |

## Recommendation
**REMOVE WITH CAUTION** — Delete the duplicate in `upstash.ts` and import from `../types.js`

### Rationale
- Eliminates maintenance risk of divergent interfaces
- Makes `upstash.ts` consistent with `memory.ts` and `kv.ts` (both import from types.ts)
- ~18 lines removed from duplication

### If Removing
1. In `packages/rate-limiter/src/backends/upstash.ts`:
   - Remove the local `UpstashRateLimiterOptions` interface definition (lines 46–64)
   - Add `UpstashRateLimiterOptions` to the existing import from `../types.js`
2. Run `npm test -- --run` to verify
3. Run `npm run build` to verify
