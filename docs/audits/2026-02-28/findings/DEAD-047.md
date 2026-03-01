# DEAD-047: ~80 deprecated type re-exports in `types/index.ts`

## Category
Legacy/Deprecated

## Location
- File(s): `packages/core/src/types/index.ts`
- Line(s): 1–163 (of 216 total)
- Symbol(s): 80+ types, interfaces, and values re-exported from `@xivdyetools/types` and `@xivdyetools/logger`

## Evidence
`types/index.ts` is 216 lines, of which ~163 are deprecated re-exports from `@xivdyetools/types` or `@xivdyetools/logger`. Only lines 164–216 contain core-specific (non-deprecated) types (`MatchingMethod`, `OklchWeights`, `MatchingConfig`, `MATCHING_PRESETS`).

The deprecated re-exports fall into these groups:

### Group A: Actively consumed (consumers still import from `@xivdyetools/core`)
| Symbol | Consumers |
|--------|-----------|
| `Dye` (type) | 25+ files across web-app, discord-worker, og-worker, bot-logic, svg, stoat-worker |
| `RGB` (type) | discord-worker/types/image.ts, svg/accessibility-comparison.ts, svg/palette-grid.ts |
| `NoOpLogger` (value) | web-app/api-service-wrapper.ts |
| `PresetCategory` (type) | 6 files in web-app |
| `PresetPalette` (type) | web-app/hybrid-preset-service.ts |
| `PresetData` (type) | web-app/hybrid-preset-service.ts |
| `CategoryMeta` (type) | web-app/hybrid-preset-service.ts |
| `PriceData` (type) | web-app/api-service-wrapper.ts |
| `CachedData` (type) | web-app/api-service-wrapper.ts |
| `SubRace` (type) | og-worker/dye-helpers.ts |
| `Gender` (type) | og-worker/dye-helpers.ts |
| `CharacterColorMatch` (type) | discord-worker/swatch.ts |

### Group B: Zero external consumers (safe to remove sooner)
All remaining ~68 deprecated type re-exports including:
- All auth types (15 types: `AuthProvider` through `UserInfoResponse`)
- All remaining color types (`HSV`, `LAB`, `OKLAB`, `OKLCH`, `LCH`, `HSL`, `HexColor`, etc.)
- All remaining dye types (`LocalizedDye`, `DyeWithDistance`, `DyeDatabase`)
- All character types (`CharacterColor`, `Race`, etc.) except `SubRace`, `Gender`, `CharacterColorMatch`
- All remaining preset/community types
- All API types (`APIResponse`, `ModerationResult`, etc.) except `PriceData`, `CachedData`
- All locale types (`TranslationKey`, `HarmonyTypeKey`, `JobKey`, etc.)
- All result types (`Result`, `AsyncResult`, `Nullable`, `Optional`, `isOk`, `isErr`)
- Error types (`ErrorCode`, `AppError`, `ErrorSeverity`)
- Factory functions (`createHexColor`, `createDyeId`, `createHue`, `createSaturation`)
- Character constants (`RACE_SUBRACES`, `SUBRACE_TO_RACE`, `COLOR_GRID_DIMENSIONS`)

## Why It Exists
These re-exports were the original API surface before types were extracted to `@xivdyetools/types`. They exist for backwards compatibility.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH for Group B (zero consumers), MEDIUM for Group A (requires migration) |
| **Blast Radius** | HIGH for Group A — `Dye` alone is imported in 25+ files across 6 projects |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | External npm consumers may rely on importing `Dye`, `RGB`, etc. from core |

## Recommendation
**REMOVE WITH CAUTION (Phased)**

### Rationale
163 lines of deprecated compatibility shims. The biggest migration effort is `Dye` (25+ files). Total migration would touch ~40 files across the monorepo. This is the single largest source of "dead weight" in the core package.

### Execution Plan
**Phase 1 (Now — Low Risk):** Remove Group B re-exports (zero consumers) — ~68 types, ~100 lines saved  
**Phase 2 (Scheduled — Requires Migration):** Migrate Group A consumers to import from `@xivdyetools/types` directly, then remove remaining deprecated re-exports  
**Phase 3 (v2.0.0):** Delete `types/logger.ts` entirely (see DEAD-042)

### If Removing Group B (Phase 1)
1. Remove all deprecated re-export blocks in `types/index.ts` that have zero external consumers
2. Remove corresponding re-exports from `src/index.ts`
3. Run `npm run type-check` across all monorepo projects
4. Run full test suites
