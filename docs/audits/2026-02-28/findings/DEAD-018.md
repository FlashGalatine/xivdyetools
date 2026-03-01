# DEAD-018: Deprecated Re-exports in shared/types.ts

## Category
Legacy Code

## Location
- File(s): `src/shared/types.ts` (208 lines)
- Symbol(s): ~8 deprecated re-export blocks from `@xivdyetools/types`

## Evidence
All deprecated re-exported types are marked with `@deprecated` JSDoc tags. They re-export types that already exist in `@xivdyetools/types` and `@xivdyetools/core`:

- `Dye`, `DyeWithDistance`, `DyeDatabase`
- `PriceData`, `VisionType`
- `RGB`, `HSV`, `HexColor`
- `AppError`, `ErrorCode`
- `Matrix3x3`, `APIResponse`, `CachedData`, `RateLimitResult`
- `Result`, `AsyncResult`, `Nullable`, `Optional`

**50 files** currently import from `@shared/types`. The web-app-specific types (`ThemeName`, `ThemePalette`, `Theme`, `AppState`, `HarmonyState`, `MatcherState`, `ComparisonState`, `DataCenter`, `World`) are NOT deprecated and ARE needed.

## Removal Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — explicitly deprecated with replacement path |
| **Blast Radius** | HIGH — 50 files need import updates |
| **Reversibility** | EASY — git revert |
| **Hidden Consumers** | None |

## Recommendation
**REFACTOR FIRST** (not a quick win)

### Rationale
- This is a migration task, not a deletion task
- All 50 consumers need to be updated to import from `@xivdyetools/types` or `@xivdyetools/core` directly
- The non-deprecated types in this file should remain
- Estimated effort: ~1-2 hours for a find-and-replace migration

### If Removing
1. For each deprecated re-export, find all 50 importing files
2. Update imports to use `@xivdyetools/types` or `@xivdyetools/core` directly
3. Remove deprecated re-export blocks from `src/shared/types.ts`
4. Keep non-deprecated types (`ThemeName`, `ThemePalette`, `Theme`, `AppState`, etc.)
5. Run build + tests to verify
