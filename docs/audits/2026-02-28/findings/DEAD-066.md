# DEAD-066: 4 internal implementation classes exported in barrel

## Category
Unused Exports (Over-exported API)

## Location
- File(s): `packages/logger/src/index.ts` (barrel), `packages/logger/src/core/base-logger.ts`, `packages/logger/src/adapters/*.ts`
- Symbol(s): `BaseLogger`, `ConsoleAdapter`, `JsonAdapter`, `NoopAdapter`

## Evidence
Monorepo-wide grep for each class as an import (excluding `packages/logger/`):

| Symbol | External Import Hits | Notes |
|--------|---------------------|-------|
| `BaseLogger` | 0 | Abstract class — internal base for all adapters |
| `ConsoleAdapter` | 0 | Internal — consumers use `createBrowserLogger` or `createWorkerLogger` |
| `JsonAdapter` | 0 | Internal — used by `createWorkerLogger` internally |
| `NoopAdapter` | 0 | Internal — consumers use `NoOpLogger` (from presets/library.ts) which IS consumed |

These are implementation details that consumers never need. The package provides higher-level factory functions (`createBrowserLogger`, `createWorkerLogger`, `createRequestLogger`, `createLibraryLogger`) and pre-configured instances (`browserLogger`, `NoOpLogger`, `ConsoleLogger`) that wrap these classes.

## Why They Exist
Standard OOP inheritance pattern: `BaseLogger` is abstract, adapters extend it. Exported for extensibility — a consumer could theoretically create a custom adapter by extending `BaseLogger`. However, no consumer has ever done this.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero import hits |
| **Blast Radius** | LOW — removing from barrel doesn't affect internal usage |
| **Reversibility** | EASY — re-add to barrel |
| **Hidden Consumers** | POSSIBLE — external npm consumers might extend BaseLogger (unlikely for workspace package) |

## Recommendation
**MARK @internal** (remove from barrel at next major version)

### Rationale
These classes have legitimate use as extensibility points, but zero adoption. Mark with `@internal` JSDoc to signal they're not part of the public API. At the next major version, remove from the main barrel. If a consumer needs them, they can deep-import from e.g. `@xivdyetools/logger/core`.

### If Removing from Barrel
1. Remove `BaseLogger` from `src/core/index.ts` re-export (keep in `base-logger.ts`)
2. Remove `ConsoleAdapter`, `JsonAdapter`, `NoopAdapter` from `src/adapters/index.ts` re-export
3. Remove from `src/index.ts` barrel
4. Internal imports within logger (e.g., `library.ts` importing `NoopAdapter`) already use direct paths
