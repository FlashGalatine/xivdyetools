# DEAD-063: API generic response types — zero external consumers

## Category
Unused Exports (Types)

## Location
- File(s): `packages/types/src/api/response.ts`
- Line(s): 12–48
- Symbol(s): `APISuccessResponse<T>`, `APIErrorResponse`, `APIResponse<T>`

## Evidence
Monorepo-wide grep returns zero import hits for these 3 types:

- `APISuccessResponse` — presets-api defines its own `ApiSuccessResponse` (note: different casing). Zero imports from types.
- `APIErrorResponse` — presets-api defines its own `ApiErrorResponse`. Zero imports from types.
- `APIResponse` — only found in core's own `parseApiResponse` method names (coincidental naming). Zero type imports.

The `CachedData<T>` type (same file, L56) IS consumed via core's re-export in `web-app/api-service-wrapper.ts`, so it's NOT dead.

The `PriceData` and `RateLimitResult` types (from `api/price.ts` and `api/moderation.ts`) are actively consumed.

## Why They Exist
Generic API response wrapper types intended to standardize response shapes across workers. In practice, each worker defines its own response types (presets-api uses `ApiSuccessResponse` with lowercase 'pi'), and the generic types from `@xivdyetools/types` were never adopted.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — searched for exact type names |
| **Blast Radius** | NONE — `CachedData` (same file) must be kept |
| **Reversibility** | EASY |
| **Hidden Consumers** | NONE |

## Recommendation
**REMOVE** (next minor version)

### Rationale
These are speculative generic types that were superseded by per-worker response types. Each worker defines its own response shape. Removing 3 unused types from a 73-line file reduces noise while keeping the actively-used `CachedData<T>`.

### If Removing
1. Remove `APISuccessResponse`, `APIErrorResponse`, `APIResponse` from `src/api/response.ts`
2. Remove from `src/api/index.ts` re-exports
3. Remove from `src/index.ts` barrel
4. Keep `CachedData<T>` (actively consumed)
5. Consider unifying with presets-api's `ApiSuccessResponse`/`ApiErrorResponse` in a future refactor
