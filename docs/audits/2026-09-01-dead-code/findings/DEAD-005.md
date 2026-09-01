# DEAD-005: web-app — 37 public service methods across 13 classes with zero non-test call sites (knip 6 has no `classMembers` rule, so no gate can see them) — 352 lines

**Confidence:** HIGH · **Blast radius:** LOW · **Deploy unit:** apps/web-app · **Semver:** NONE (app-internal) · **Category:** Unused Export (test-only class members)

## Location
Full table in `evidence/members.txt` (rows flagged `extSrc=0 … unitSrc=0` with `unitTest>0`). By class:
- `ThemeService` ×7 — `getColor`, `getThemeVariants`, `getLightVariant`, `getDarkVariant`, `getCurrentThemeObject`, `toggleDarkMode`, `resetToDefault`
- `CameraService` ×6 — `isCameraSupported`, `requestPermission`, `onCameraAvailabilityChange`, `getCurrentStream`, `isStreamActive`, `detachStreamFromVideo`
- `CollectionService` ×6 — `reorderFavorites`, `canAddFavorite`, `getCollectionsByKind`, `reorderCollectionDyes`, `getCollectionsContainingDye`, `getMaxCollections`
- `StorageService` ×3 · `ModalService` ×2 (`dismissAll`, `getModals`) · `ToastService` ×2 (`dismissAll`, `getToasts`) · `MarketBoardService` ×2 · `LanguageService` ×2 · `TutorialService` ×2 · `RouterService`, `IndexedDBService`, `CommunityPresetService`, `IndexedDBCacheBackend`, `ErrorHandler` ×1 each

## Evidence
- `evidence/scripts/members-all.sh` over every exported class in `src/services` + `src/shared`; the counter is `.method\b` across **all** tracked files, so component call sites, `e2e/` and `functions/` are included.
- Spot-verified at file:line for five of them (`ThemeService.getColor`, `CollectionService.canAddFavorite`, `ModalService.dismissAll`/`getModals`, `ToastService.dismissAll`) — each appears exactly once outside tests: its own declaration.
- `__reloadForTesting` / `__resetForTesting` were excluded — those are deliberate test hooks (KEEP register).
- Spans measured per method in `evidence/measure-members.txt`: **352 lines** across the 37.

## Fix
**REMOVE WITH CAUTION**, one class per commit. Per method: re-grep, delete the method, delete only the test blocks that exercise nothing else. `ToastService.getToasts` / `ModalService.getModals` are read accessors the container components could reasonably want — check the component before deleting; if a container should be reading them, that is a bug to file, not a deletion.
Gate after each class: `pnpm turbo run build type-check lint test --filter=xivdyetools-web-app`.

## Status
OPEN
