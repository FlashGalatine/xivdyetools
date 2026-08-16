# [DEAD-008]: `SecureStorage` — a 385-line checksummed-storage subsystem with zero production callers (and a 1,325-line test suite keeping it alive)

## Category
Unused Export → Dead Module Section

## Location
- `apps/web-app/src/services/storage-service.ts:391-775` — the entire "Secure Storage" section:
  `MAX_CACHE_SIZE`, `SIZE_INDEX_KEY`, `SecureStorageEntry<T>`, `SizeIndexEntry`, `SizeIndex`, `generateChecksum()`, `verifyChecksum()`, `export class SecureStorage { … }` (static-method class with a size-index cache, a mutex, checksum verification, eviction)
- `apps/web-app/src/services/__tests__/secure-storage.test.ts` (1,325 lines)
- `apps/web-app/src/services/index.ts:22` — barrel re-export `SecureStorage`

## Evidence
- `grep -rln "SecureStorage" src --include=*.ts` → exactly three files: the definition, the barrel, and `secure-storage.test.ts`. **No component or service calls `SecureStorage.*`.**
- knip (both default and `--production`): `storage-service.ts: SecureStorage` unused; barrel `SecureStorage` unused.
- Every helper in lines 391-474 (`generateChecksum`, `verifyChecksum`, `SizeIndex*`, `SecureStorageEntry`, `MAX_CACHE_SIZE`, `SIZE_INDEX_KEY`) is referenced only from inside the class — verified with line-bounded greps; `StorageService` and `NamespacedStorage` (lines 1-389) do not touch them.
- The storage key `__secure_storage_size_index__` appears nowhere else (`grep -rn "__secure_storage" src` → only this file and its test) — no startup migration or cleanup depends on it.
- `git log -S"SecureStorage." -- src` (excluding tests) → **only the migration commit `79e945a`**: the class arrived in this repo already without a caller.

## Why It Exists
A hardened cache layer (integrity checksum + size budget + LRU-ish eviction) — evidently built for the API/price cache and then superseded by `IndexedDBService` (`src/services/indexeddb-service.ts`, which *is* used by `extractor-tool` and `api-service-wrapper`). The tests were comprehensive enough that nothing ever flagged the class as orphaned.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH |
| **Blast Radius** | LOW — one file loses a section; one test file is deleted; one barrel line goes |
| **Reversibility** | EASY |
| **Hidden Consumers** | Persisted browser data: any `localStorage` entries a *former* version wrote under SecureStorage's namespace would simply become inert strings; nothing reads them today either, so behaviour is unchanged. Coverage gate: `vitest.config.ts` thresholds are a ratchet (statements 71 / lines 72). Deleting a fully-covered 385-line section **lowers** overall coverage slightly — measure before/after and adjust the ratchet down only by what this removal accounts for (see the report's execution plan). |

## Recommendation
**REMOVE**

### Rationale
The single largest piece of dead logic in the app: ~1,700 lines including tests, all maintained, all linted, all type-checked, none executed in production. It also carries a `BUG-007 FIX` mutex comment — meaning past audit effort was spent fixing a race in code no user runs.

### If Removing
1. Delete `src/services/storage-service.ts` lines 391-775 (from the `// ===… Secure Storage` banner to end of file); keep the `appStorage` export above it
2. `git rm src/services/__tests__/secure-storage.test.ts`
3. Remove `SecureStorage` from `src/services/index.ts:22`
4. `pnpm --filter xivdyetools-web-app run type-check test`
5. Re-run `vitest --coverage`; if the ratchet trips, note the delta in the commit and lower **only** by that delta
