# DEAD-084: @xivdyetools/test-utils — Legacy Counter Infrastructure (counters, resetCounters, resetCounter, getCounterValue)

## Category
Legacy/Deprecated

## Location
- File(s): `packages/test-utils/src/utils/counters.ts` (lines 1–104)
- Symbol(s): `counters` (module-level Map), `resetCounters()`, `resetCounter()`, `getCounterValue()`

## Evidence
The counter infrastructure was created for sequential ID generation. After the TEST-DESIGN-001 migration to random IDs:

1. **`nextStringId()`** no longer uses counters — it delegates to `randomStringId()` (line 76)
2. **`nextId()`** is `@deprecated` and has only 2 remaining callers (DEAD-083)
3. The `counters` Map is only written by `nextId()` and read by `getCounterValue()`

Once DEAD-083 is resolved (migrating the 2 remaining `nextId()` callers to `randomId()`):
- `nextId()` has zero callers and can be removed
- `counters` Map has no writers and can be removed
- `resetCounters()` has no effect (nothing to reset) and can be removed
- `resetCounter()` has no effect and can be removed
- `getCounterValue()` always returns 0 and can be removed

**Current external consumption of counter functions:**
- `resetCounters` is imported and called in `apps/presets-api/tests/test-utils.ts`
- `resetCounter` and `getCounterValue` have zero external consumers

## Why It Exists
Original test factory infrastructure was based on sequential counters. The TEST-DESIGN-001 migration made random IDs the default but kept the counter infrastructure for backward compatibility.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH after DEAD-083 is resolved — all callers will be gone |
| **Blast Radius** | LOW — 1 external import of `resetCounters()` needs removal |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | `presets-api/tests/test-utils.ts` calls `resetCounters()` in `beforeEach()` but it's a no-op after migration |

## Recommendation
**REMOVE** (after DEAD-083 is complete)

### Rationale
- Completes the TEST-DESIGN-001 migration started with random IDs
- Removes ~40 lines of legacy infrastructure
- Eliminates the module-level mutable state (`counters` Map) which is a test isolation risk
- `resetCounters()` calls in external test setups become unnecessary

### If Removing
1. First complete DEAD-083 (migrate `nextId()` callers)
2. Remove `nextId()` function from `counters.ts`
3. Remove `counters` Map, `resetCounters()`, `resetCounter()`, `getCounterValue()`
4. Remove `resetCounters` from the re-exports in `factories/index.ts`
5. Remove `resetCounters` import from `apps/presets-api/tests/test-utils.ts`
6. Run all consumer test suites to verify
