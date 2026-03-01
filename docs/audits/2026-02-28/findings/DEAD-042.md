# DEAD-042: Deprecated `types/logger.ts` wrapper file

## Category
Legacy/Deprecated

## Location
- File(s): `packages/core/src/types/logger.ts`
- Line(s): 1–22
- Symbol(s): `Logger` (type), `NoOpLogger`, `ConsoleLogger`, `createLibraryLogger`

## Evidence
The entire file is a deprecated re-export wrapper around `@xivdyetools/logger/library`. All 4 exports are marked `@deprecated`.

```typescript
/** @deprecated Import directly from '@xivdyetools/logger/library' instead. */
export type { Logger } from '@xivdyetools/logger/library';
/** @deprecated Import directly from '@xivdyetools/logger/library' instead. */
export { NoOpLogger, ConsoleLogger, createLibraryLogger } from '@xivdyetools/logger/library';
```

This file exists solely to provide backwards-compatible imports for consumers that used to import logger types from `@xivdyetools/core`. The canonical source is `@xivdyetools/logger/library`.

Only one external consumer still imports through this path:
- `web-app/api-service-wrapper.ts` imports `NoOpLogger` from `@xivdyetools/core`

`ConsoleLogger`, `Logger`, and `createLibraryLogger` have **zero** external consumers via this re-export path.

## Why It Exists
Historical compatibility — logger types were originally part of core before being extracted to `@xivdyetools/logger`.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — file is explicitly deprecated |
| **Blast Radius** | LOW — 1 consumer needs import migration (`NoOpLogger` in web-app) |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None — only barrel re-exports consume this |

## Recommendation
**REMOVE WITH CAUTION**

### Rationale
The file is explicitly deprecated. `createLibraryLogger` is not even re-exported from `index.ts`. Only `NoOpLogger` needs a consumer migration (1 file in web-app). Removal cuts 22 lines.

### If Removing
1. Update `web-app/src/services/api-service-wrapper.ts` to import `NoOpLogger` from `@xivdyetools/logger/library`
2. Remove `types/logger.ts`
3. Remove `export type { Logger }` and `export { NoOpLogger, ConsoleLogger }` from `types/index.ts` (lines 15–20)
4. Remove the corresponding re-exports from `src/index.ts`
5. Delete `src/__tests__/logger.test.ts` (see DEAD-044)
6. Run full test suite
