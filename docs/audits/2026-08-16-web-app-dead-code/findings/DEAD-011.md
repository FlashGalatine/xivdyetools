# [DEAD-011]: `src/services/index.ts` barrel — 42 value re-exports and ~30 type re-exports nobody imports through it

## Category
Unused Export (barrel hygiene)

## Location
- `apps/web-app/src/services/index.ts` (223 lines)

## Evidence
The barrel is the primary import path for components (≈45 files import from `@services/index`). knip lists **~75 names** re-exported by the barrel that no file imports *from the barrel*. Cross-checking each name against direct imports from its source file (`evidence/barrel-classification.txt`) splits them:

**BARREL-LINE-ONLY (42)** — the symbol is live, but consumers import it directly from its module, so the barrel line is redundant:
`appStorage`, `ROUTES`, `apiService`, `TooltipService`, `AnnouncerService`, `indexedDBService`, `STORES`, `CommunityPresetService`, `hybridPresetService`, `ShareService`, `formatPrice`, `blendTwoColors`, `HARMONY_TYPE_IDS`, `DEFAULT_DISPLAY_OPTIONS`, `ErrorHandler`, `KeyboardService` (used *inside* the barrel's `initializeServices()`, export unused), and the type re-exports `ToolId`, `Toast`, `ToastType`, `Modal`, `CaptureResult`, `TutorialTool`, `TutorialStep`, `Tutorial`, `DyeId`, `Collection`, `CommunityPreset`, `PresetStatus`, `PresetFilters`, `UnifiedPreset`, `PresetSortOption`, `AuthUser`, `PresetSubmission`, `SubmissionResult`, `PresetEditRequest`, `EditResult`, `ShareParams`, `SwatchShareParams`, `HarmonyTypeInfo`, `MarketPanelRefs`, `Dye`, `PriceData`, `ThemeName`.

**SYMBOL-DEAD (30)** — the underlying symbol is unused outside its own file (covered by DEAD-008/009/010/012/013): `NamespacedStorage`*, `SecureStorage`, `CameraService`*, `IndexedDBService`*, `DyeSelectionContext`, `HybridPresetService`*, `AuthService`*, `consumeReturnTool`, `PresetSubmissionService`*, `getConfigController`, `getMarketBoardService`, `calculateMixerColorDistance`, `calculateHarmonyColorDistance`, `generateHarmonyPanelData`, the 7 `price-utilities` functions, `hasDisplayOptionsChanges`, `getCardDisplayOptions`, `mergeWithDefaults`, `FavoritesData`, `CollectionsData`, `AuthState`, `MarketPanelConfig`, `VisionType`. (* = class/instance used in-file; only the *export* is dead.)

## Why It Exists
The barrel was built as "export everything" during the services consolidation. Consumers gradually moved to direct imports (better tree-shaking, fewer circular-import hazards) but the barrel was never trimmed.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for every name (each verified by grep) |
| **Blast Radius** | LOW — type-check catches any miss instantly |
| **Reversibility** | EASY |
| **Hidden Consumers** | Tests import a few names via the barrel (`tests=1` column in the evidence) — type-check will name them; switch those imports to the source module. |

## Recommendation
**REMOVE** (trim the barrel to what is actually imported through it)

### Rationale
A barrel that re-exports 75 unconsumed names is a maintenance tax: every rename touches it, knip cannot report per-module dead exports cleanly through it, and it re-introduces `import` cycles (`services/index.ts` ⇄ `harmony-generator.ts` etc.). Trimming it also makes the DEAD-008/009/010 deletions self-verifying.

### If Removing
1. Delete every barrel line for the SYMBOL-DEAD list *together with* the source deletions in DEAD-008/009/010/012/013
2. Delete the BARREL-LINE-ONLY lines; run `pnpm --filter xivdyetools-web-app run type-check` and fix any test that imported through the barrel by pointing it at the source module
3. Keep `initializeServices`, `getServicesStatus`, and the names components actually pull (`LanguageService`, `ColorService`, `ToastService`, `StorageService`, `ModalService`, `WorldService`, `CollectionService`, `APIService`, `DyeService`/`dyeService`, `cameraService`, `authService`, `TutorialService`, `ThemeService`, `RouterService`, `applyDisplayOptions`, `buildMarketPanel`, `findHarmonyDyes`…, `MixedColorResult`, `ScoredDyeMatch`, `HarmonyConfig`)
