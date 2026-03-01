# DEAD-069: `createWorkerLogger` — zero direct external consumers

## Category
Unused Exports (Functions)

## Location
- File(s): `packages/logger/src/presets/worker.ts`
- Line(s): 55–93
- Symbol(s): `createWorkerLogger`

## Evidence
Monorepo-wide grep for `createWorkerLogger` as an import returns **zero** hits outside `packages/logger/`.

All 4 worker apps (discord-worker, moderation-worker, presets-api, oauth) import `createRequestLogger` from `@xivdyetools/logger/worker`, never `createWorkerLogger`.

**Internal usage:** `createRequestLogger` (L97) calls `createWorkerLogger` internally, so the function IS used — just never directly by consumers.

The only external references to `createWorkerLogger` are in JSDoc code comments in `packages/rate-limiter/` (documentation examples, not actual imports).

## Why It Exists
`createWorkerLogger` is the lower-level factory that takes explicit `WorkerLoggerOptions`. `createRequestLogger` is a convenience wrapper that extracts options from an `env` object (matching Cloudflare Worker `Env` patterns). All consumers prefer the convenience API.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero import hits |
| **Blast Radius** | LOW — only barrel export affected; internal call from `createRequestLogger` unaffected |
| **Reversibility** | EASY |
| **Hidden Consumers** | UNLIKELY |

## Recommendation
**MARK @internal** (keep in subpath, remove from main barrel)

### Rationale
The function is a legitimate building block used by `createRequestLogger`. It should remain implemented and available via `@xivdyetools/logger/worker` subpath for consumers who need fine-grained control. But it should be marked `@internal` to signal that `createRequestLogger` is the preferred API.

### If Removing from Main Barrel
1. Remove `createWorkerLogger` from `src/presets/index.ts` re-export
2. Remove from `src/index.ts` barrel
3. Keep in `src/presets/worker.ts` (still importable via `./worker` subpath)
4. Add `@internal` JSDoc tag
