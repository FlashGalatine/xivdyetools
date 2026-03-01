# DEAD-006: SavedPalettesModal Component

## Category
Orphaned File

## Location
- File(s): `src/components/saved-palettes-modal.ts` (451 lines), `src/components/__tests__/saved-palettes-modal.test.ts` (115 lines)
- Symbol(s): `showSavedPalettesModal()`, `showSavePaletteDialog()`, `OnPaletteLoadCallback` type

## Evidence
Both `showSavedPalettesModal` and `showSavePaletteDialog` are only referenced within:
- The file itself (self-referential calls at lines 117, 296)
- The test file

No production component imports either function. The palette management functionality appears to have been superseded by the collection manager or the v4 preset system.

## Why It Exists
Provided a modal for saving/loading user palettes. This was a v3 feature that may have been replaced by the collection system (`collection-manager-modal.ts`).

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — zero external callers |
| **Blast Radius** | LOW — also remove its test |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REMOVE**

### Rationale
- 566 lines removed (451 source + 115 test)
- Eliminates unused modal

### If Removing
1. Delete `src/components/saved-palettes-modal.ts`
2. Delete `src/components/__tests__/saved-palettes-modal.test.ts`
3. Remove re-export from `src/components/index.ts` (if present)
4. Run build + tests to verify
