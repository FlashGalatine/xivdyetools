# DEAD-068: `createSimpleLogger` — zero external consumers

## Category
Unused Exports (Functions)

## Location
- File(s): `packages/logger/src/core/base-logger.ts`
- Line(s): 329–343
- Symbol(s): `createSimpleLogger`

## Evidence
Monorepo-wide grep for `createSimpleLogger` returns zero import hits outside `packages/logger/`.

The function creates an anonymous `BaseLogger` subclass from a plain write function. It's a convenience for consumers who want a custom logger without extending `BaseLogger`. No consumer has ever used it.

The function is ~15 lines and returns a `Logger` interface (not `ExtendedLogger`), making it less capable than the preset factories (`createBrowserLogger`, `createWorkerLogger`, etc.) which return `ExtendedLogger`.

## Why It Exists
Escape hatch for custom logger implementations. Designed for consumers who want logging with a custom output destination but don't want to subclass `BaseLogger`.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — distinctive function name, zero hits |
| **Blast Radius** | NONE — zero consumers |
| **Reversibility** | EASY — single function |
| **Hidden Consumers** | UNLIKELY |

## Recommendation
**MARK @internal** (defer removal to next major version)

### Rationale
The function has a legitimate use case but zero adoption. Since it depends on `BaseLogger` (DEAD-066), if `BaseLogger` is marked `@internal`, this function should be too. Both serve the extensibility story that has zero current consumers.

### If Removing
1. Remove from `src/core/index.ts` re-export
2. Remove from `src/index.ts` barrel
3. Keep the implementation in `base-logger.ts` for potential future use
