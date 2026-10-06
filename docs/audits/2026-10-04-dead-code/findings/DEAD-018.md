# DEAD-018: IndexedDBService.getAll/count/deleteDatabase are test-only — 100 src lines + ~200 test lines
**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE · **Category:** Test-only · **Origin:** MAIN

## Location
- `apps/web-app/src/services/indexeddb-service.ts:280` — IndexedDBService.getAll/count/deleteDatabase (isReady, close excluded)

## Evidence
- Applies to getAll/count/deleteDatabase; only production consumer IndexedDBCacheBackend uses initialize/get/set/delete/clear/keys. isReady and close are not included as reset/observation hooks over live db/initPromise state (close is the test afterEach reset at :161).
  - Commands: git grep 'indexedDBService|IndexedDBService' apps/web-app non-test: only api-service-wrapper.ts:86-162 (initialize/set/delete/clear/keys/get); git grep -w getAll/deleteDatabase non-test: only same-named members of SavedPresetsService/StorageService/IDB natives
- Origin: indexeddb-service.ts unchanged between 8ecb878f and HEAD. 2026-09-01 members.txt:119 already listed deleteDatabase as unitSrc=1 (declaration only).

## Fix
**REMOVE.** Keep isReady/close (optionally tag @testonly naming indexeddb-service.test.ts afterEach). deleteDatabase's internal this.close() call does not make close dead: it stays the test reset hook.

Steps: In apps/web-app/src/services/indexeddb-service.ts delete getAll (277-310), count (345-377) and deleteDatabase (389-424, keeping the class's closing brace). In indexeddb-service.test.ts delete describe('getAll') 396-415, describe('count') 439-458 and describe('deleteDatabase') 476-495. Also delete the error-handling its at 694-725, 760-791 and 793-851, the mockStore getAll/count stubs at 64-69, and the mockIndexedDB.deleteDatabase stub (around 134-148). Run pnpm turbo run build type-check lint test --filter=...xivdyetools-web-app and pnpm dead-code:check.

## Status
REMOVED, NOT DEPLOYED — `057cba2f` (branch `fix/remediation-2026-10-04-sprint23`, web-app 5.14.7; PR #253, open, stacked on #252).
