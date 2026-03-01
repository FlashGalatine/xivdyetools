# DEAD-011: LocalStorageCacheBackend (Deprecated Cache Backend)

## Category
Legacy Code

## Location
- File(s): `src/services/api-service-wrapper.ts`
- Line(s): ~174
- Symbol(s): `LocalStorageCacheBackend` class

## Evidence
Marked `@deprecated Use IndexedDBCacheBackend instead`. Only imported in its own test file. No production consumers — the app uses `IndexedDBCacheBackend` exclusively.

## Why It Exists
Original cache backend using localStorage, replaced by IndexedDB for better performance and storage limits.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — explicitly deprecated, only test uses it |
| **Blast Radius** | LOW — need to update test file |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- Removes ~40-60 lines of deprecated code
- Test should be updated to test the current `IndexedDBCacheBackend` instead

### If Removing
1. Delete `LocalStorageCacheBackend` class from `src/services/api-service-wrapper.ts`
2. Update or remove tests that reference the old backend
3. Run build + tests to verify
