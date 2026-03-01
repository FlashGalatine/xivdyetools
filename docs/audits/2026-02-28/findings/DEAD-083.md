# DEAD-083: @xivdyetools/test-utils — Deprecated `nextId()` Still Consumed by Factories

## Category
Legacy/Deprecated

## Location
- File(s): `packages/test-utils/src/utils/counters.ts` (line 63), `packages/test-utils/src/factories/dye.ts`, `packages/test-utils/src/factories/category.ts`
- Symbol(s): `nextId()` function

## Evidence
`nextId()` is explicitly marked `@deprecated` in `counters.ts`:

```typescript
/**
 * Get the next value for a named counter (legacy)
 * @deprecated Use randomId() for parallel-safe ID generation
 * @param name - The counter name (e.g., 'preset', 'category')
 * @returns The next sequential value
 */
export function nextId(name: string): number {
  if (!(name in counters)) {
    counters[name] = 0;
  }
  counters[name]++;
  return counters[name];
}
```

Yet it is still actively consumed by factory functions:
- `packages/test-utils/src/factories/dye.ts` — `createMockDye()` calls `nextId('dye')`
- `packages/test-utils/src/factories/category.ts` — `createMockCategoryRow()` calls `nextId('category')`

The recommended replacement `randomId()` is available and already used by other factories. This creates an inconsistency:
- `preset.ts` → uses `nextStringId()` (which internally delegates to `randomStringId()`)
- `user.ts` → uses `nextStringId()` (same)
- `vote.ts` → uses `randomStringId()` 
- `dye.ts` → uses deprecated `nextId()` ❌
- `category.ts` → uses deprecated `nextId()` ❌

## Why It Exists
TEST-DESIGN-001 migration to random IDs was applied to most factories but not `dye.ts` and `category.ts`, which generate numeric IDs (not string IDs). `nextId()` returns a number; `randomId()` also returns a number but wasn't substituted.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — `@deprecated` annotation is explicit |
| **Blast Radius** | LOW — 2 factory files need updating |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | Tests that depend on sequential IDs (1, 2, 3) for ordering would break with random IDs |

## Recommendation
**REMOVE WITH CAUTION** — Migrate `dye.ts` and `category.ts` to `randomId()`

### Rationale
- Completes the TEST-DESIGN-001 parallel-safety migration
- Removes the only callers of a deprecated function
- Once callers are migrated, `nextId()` can be removed entirely along with the counter storage
- ~10 lines of legacy counter code becomes fully dead

### If Removing
1. In `packages/test-utils/src/factories/dye.ts`: Replace `nextId('dye')` with `randomId()`
2. In `packages/test-utils/src/factories/category.ts`: Replace `nextId('category')` with `randomId()`
3. Verify no test depends on sequential numeric IDs (check for assertions like `expect(dye.id).toBe(1)`)
4. Run all test suites that use `createMockDye()` and `createMockCategoryRow()`
5. After confirming, consider removing `nextId()`, `counters` map, `resetCounters()`, `resetCounter()`, and `getCounterValue()` if no other consumers exist
