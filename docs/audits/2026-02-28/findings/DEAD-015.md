# DEAD-015: 44 Unused Local Variables and Parameters

## Category
Dead Code Path

## Location
- File(s): Multiple files (44 instances)
- Tool: TypeScript `--noUnusedLocals --noUnusedParameters`

## Evidence
TypeScript compiler flagged 44 variables/parameters that are declared but never read. Full list:

### Components (28 instances)
| File | Line | Variable | Notes |
|------|------|----------|-------|
| `accessibility-tool.ts` | 536 | `createSection` | Declared but not called |
| `add-to-collection-menu.ts` | 176 | `dyeName` | Destructured but unused |
| `budget-tool.ts` | 602 | `createSection` | Declared but not called |
| `color-interpolation-display.ts` | 387 | `oldIndex` | Left from refactor |
| `color-picker-display.ts` | 23 | `eyedropperMode` | Unused state variable |
| `comparison-tool.ts` | 473 | `createSection` | Declared but not called |
| `comparison-tool.ts` | 808 | `populateServerDropdown` | Dead helper function |
| `comparison-tool.ts` | 1304 | `_gapStart` | Unused destructuring |
| `dye-action-dropdown.ts` | 449 | `_toolName` | Named "unused" by convention |
| `dye-card-renderer.ts` | 21 | `container` | Unreferenced DOM ref |
| `dye-grid.ts` | 103 | `_isFocused` | Named "unused" by convention |
| `extractor-tool.ts` | 105 | `filterConfig` | Unused config ref |
| `extractor-tool.ts` | 118 | `currentImageDataUrl` | Unused state |
| `extractor-tool.ts` | 624 | `createSection` | Declared but not called |
| `extractor-tool.ts` | 1549 | `renderRecentColors` | Dead render function |
| `gradient-tool.ts` | 614 | `createSection` | Declared but not called |
| `gradient-tool.ts` | 631 | `createHeader` | Declared but not called |
| `gradient-tool.ts` | 1850 | `hexToRgbString` | Dead utility function |
| `harmony-tool.ts` | 135 | `suggestionsMode` | Unused state |
| `harmony-tool.ts` | 936 | `createSection` | Declared but not called |
| `harmony-tool.ts` | 1783 | `handleExport` | Dead handler function |
| `image-upload-display.ts` | 23 | `isDragging` | Unused state |
| `my-submissions-panel.ts` | 26 | `isLoading` | Unused state |
| `preset-tool.ts` | 144 | `selectedPreset` | Unused state |
| `preset-tool.ts` | 432 | `createSection` | Declared but not called |
| `shortcuts-panel.ts` | 139 | `_modifierKey` | Named "unused" |
| `swatch-tool.ts` | 2088 | `_key` | Named "unused" |
| `tutorial-spotlight.ts` | 79-80 | `currentStepIndex`, `totalSteps` | Unused state |

### V4 Components (3 instances)
| File | Line | Variable |
|------|------|----------|
| `v4-layout.ts` | 37 | `_configController` |
| `v4/preset-detail.ts` | 115 | `isFetchingPrices` |
| `v4/result-card.ts` | 1083 | `_toolName` |

### Services (4 instances)
| File | Line | Variable |
|------|------|----------|
| `keyboard-service.ts` | 41 | `isInitialized` |
| `share-service.ts` | 206 | `tool` |
| `share-service.ts` | 618 | `_failed` |
| `tutorial-service.ts` | 310 | `spotlightElement` |

### Mockups (4 instances)
| File | Line | Variable |
|------|------|----------|
| `BudgetMockup.ts` | 22, 26, 45 | `_ICON_CURRENCY`, `_ICON_SORT`, `_BUDGET_TICKS` |
| `MatcherMockup.ts` | 60 | `paletteMode` |

### Tests (4 instances)
| File | Line | Variable |
|------|------|----------|
| `harmony-generator.test.ts` | 51 | `hex1`, `hex2` |
| `mixer-blending-engine.test.ts` | 31 | `hex1`, `hex2` |

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — TypeScript compiler analysis |
| **Blast Radius** | NONE — local scope only |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None possible — they're local variables |

## Recommendation
**REMOVE**

### Rationale
- Cleaner code, fewer "why is this here?" moments
- The `createSection` pattern (7 instances) suggests an incomplete refactoring wave
- Several dead helper functions (`hexToRgbString`, `renderRecentColors`, `handleExport`, `populateServerDropdown`) are entire function bodies that should be deleted

### If Removing
1. For `_`-prefixed variables, remove if truly unused; they may be intentional destructuring placeholders
2. For `createSection` declarations, investigate if these are part of a shared pattern that was abandoned
3. For dead functions (`hexToRgbString`, `renderRecentColors`, `handleExport`, `populateServerDropdown`), delete the entire function body
4. For unused state variables (`eyedropperMode`, `isDragging`, `isLoading`, etc.), remove if no future code path needs them
5. Run build + tests after each batch
