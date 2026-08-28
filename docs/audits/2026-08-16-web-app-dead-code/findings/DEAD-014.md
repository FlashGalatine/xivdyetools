# [DEAD-014]: Dead exported types — 11 interfaces/types with zero references (~120 lines)

## Category
Unused Type

## Location / Evidence
`grep -w` per name across `src`, `e2e`, `scripts` (`evidence/agent-report-ts-symbols.md` §C):

| file:line | type | lines | note |
|---|---|---|---|
| `src/shared/types.ts:88-128` | `AppState`, `HarmonyState`, `MatcherState`, `ComparisonState` | 41 | self-contained island — `AppState` referenced only by the other three, which nothing references; `MatcherState` names the retired `matcher` tool |
| `src/shared/i18n-types.ts:29-64` | `WebAppTranslations` | 33 | locale JSON is not typed against it anywhere; runs to EOF |
| `src/services/config-controller.ts:74-83` | `ConfigChangeEvent` | 10 | |
| `src/services/market-board-service.ts:39-68` | `PricesUpdatedEvent`, `ServerChangedEvent`, `SettingsChangedEvent`, `FetchErrorEvent` | 27 | stale CustomEvent detail shapes; the service dispatches untyped |
| `src/services/pricing-mixin.ts:4-10` | `PricingState` | 8 | `MarketBoardListenerOptions` (`:15`) is the live one |
| `src/services/price-utilities.ts` | `PriceCardData`, `DyePriceDisplayOptions` | — | go with DEAD-009 |
| `src/services/indexeddb-service.ts` | `StoreName`, `GetResult` | ~6 | knip `--production`; verify in-file use before deleting (likely DROP-EXPORT-ONLY) |
| `src/services/camera-service.ts` | `CameraDevice` | ~5 | same |
| `src/components/changelog-modal.ts` | `ChangelogMode` | ~2 | same |

**DROP-EXPORT-ONLY (used in-file; keep the type, drop `export`):** `ComponentLifecycle`, `AuthProvider`, `PrimaryCharacter`, `AuthUser`, `AuthState`, `AuthStateListener`, `Tombstone`, `CollectionExport`, `DisplayOptionsChangeCallback`, `UnifiedCategory`, `PresetSortOption` (×2, both local), `GetPresetsOptions`, `ModalType`, `MySubmissionsResponse`, `SampleAreaSize`, `GlobalConfig`, and the 8 `*ShareParams` members of the `ShareParams` union (`share-service.ts:58-136`) — **load-bearing, do not delete**.

**DYNAMIC-KEEP:** `EyeDropper`, `EyeDropperConstructor` (`browser-api-types.ts:8,12`) feed the `declare global` `Window` augmentation consumed by a bare side-effect import (`color-picker-display.ts:15`).

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (rows 1-5); MEDIUM (rows 7-9 pending in-file check) |
| **Blast Radius** | NONE — types only; `tsc` is the oracle |
| **Reversibility** | EASY |
| **Hidden Consumers** | None; types cannot be reached dynamically. |

## Recommendation
**REMOVE** rows 1-6; **verify then REMOVE or drop-export** rows 7-9.

### If Removing
1. Delete the blocks; after `types.ts:88-128` goes, check whether `ThemeName`/`HexColor` imports at the top of `types.ts` are still used
2. `pnpm --filter xivdyetools-web-app run type-check`
