# DEAD-055: `MemoryCacheBackend` class — zero external consumers

## Category
Unused Exports

## Location
- File(s): `packages/core/src/services/APIService.ts`
- Line(s): 129–183 (approximately)
- Symbol(s): `MemoryCacheBackend`

## Evidence
`MemoryCacheBackend` is a class that implements the `ICacheBackend` interface for in-memory caching. It is exported from both `APIService.ts` and the barrel `src/index.ts`.

**Internal usage:** Used as the default cache backend within `APIService` when no custom backend is provided.

**External consumer usage:** Zero. No monorepo project imports `MemoryCacheBackend` from `@xivdyetools/core`. The web-app creates its own `LocalStorageCacheBackend` and passes it to `APIService`, but never directly instantiates `MemoryCacheBackend`.

The class is well-tested in `APIService.test.ts` (as part of the APIService default behavior).

## Why It Exists
Exported as a public API so consumers could use or extend the default cache backend. In practice, consumers either use the default (by not passing a backend to `APIService`) or create their own `ICacheBackend` implementation.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | MEDIUM — zero monorepo consumers, but reasonable for npm consumers to use |
| **Blast Radius** | LOW — removing export doesn't affect internal APIService behavior |
| **Reversibility** | EASY |
| **Hidden Consumers** | Possible — npm consumers may instantiate it directly |

## Recommendation
**KEEP**

### Rationale
While no monorepo consumer imports it, `MemoryCacheBackend` is a legitimate public API for the `APIService` system. Users who want to pre-warm a cache or create a shared cache across services might instantiate it directly. It's a small class (55 lines) with a clear purpose and good test coverage. Low maintenance burden.
