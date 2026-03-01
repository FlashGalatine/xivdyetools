# DEAD-073: @xivdyetools/rate-limiter — Dead `backends/index.ts` Barrel File

## Category
Orphaned Files

## Location
- File(s): `packages/rate-limiter/src/backends/index.ts`
- Line(s): 1–14 (entire file)

## Evidence
The `backends/index.ts` barrel re-exports `MemoryRateLimiter`, `KVRateLimiter`, and `UpstashRateLimiter`. However:

1. The main `src/index.ts` imports each backend **directly** from `./backends/memory.js`, `./backends/kv.js`, `./backends/upstash.js` — it does NOT import from `./backends/index.js`
2. The `package.json` exports map does NOT include a `./backends` entry, so external consumers cannot reach this barrel
3. No other file in the monorepo imports from this barrel

```typescript
// src/backends/index.ts (14 lines)
export { MemoryRateLimiter } from './memory.js';
export { KVRateLimiter } from './kv.js';
export { UpstashRateLimiter } from './upstash.js';
```

Compared to `src/presets/index.ts` which IS reachable via the `"./presets"` package.json export, `backends/index.ts` has no route.

## Why It Exists
Likely created during initial development as a conventional barrel file for the backends directory, before the main barrel adopted direct imports.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — definitively unreachable via any import path |
| **Blast Radius** | NONE — 14-line orphaned file |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — not in package.json exports map, not imported internally |

## Recommendation
**REMOVE**

### Rationale
- Zero consumers, no entry in package.json exports
- 14 lines removed — trivial cleanup
- Eliminates a confusing dual-path (direct imports vs barrel) ambiguity

### If Removing
1. Delete `packages/rate-limiter/src/backends/index.ts`
2. Run `npm test -- --run` to verify
3. Run `npm run build` to verify
