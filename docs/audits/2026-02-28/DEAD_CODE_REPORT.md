# Dead Code Analysis Report — xivdyetools Web App

## Executive Summary

- **Project:** xivdyetools-web-app v4.2.0
- **Analysis Date:** 2026-02-28
- **Analysis Depth:** Exhaustive (automated tools + manual analysis + git history)
- **Total Findings:** 19
- **Recommended Removals:** 16 (3 deferred to refactoring tasks)
- **Estimated Dead Lines:** ~3,600+ (source + tests)
- **Estimated Dead Files:** 9

## Health Score

**Code Freshness: B**
- ~5% dead code by line count (~3,600 of 71,503 production lines)
- 7 orphaned component files
- Active development (most files touched within 1 year)
- The v3→v4 migration left behind some residue but is mostly complete

---

## Summary by Category

| Category | Count | Remove | Keep | Est. Lines |
|----------|-------|--------|------|------------|
| Orphaned Files | 7 | 7 | 0 | 2,929 |
| Unused Exports | 6 | 6 | 0 | ~450 |
| Dead Code Paths | 2 | 2 | 0 | ~180 |
| Legacy/Deprecated | 4 | 2 now, 2 later | 0 | ~60 now |
| **Total** | **19** | **17** | **0** | **~3,619** |

---

## Quick Wins (High Confidence, Safe to Remove)

These can be removed immediately with minimal risk:

| ID | Description | File(s) | Lines Saved |
|----|-------------|---------|-------------|
| DEAD-007 | ToolHeader component (unused) | `tool-header.ts` | 57 |
| DEAD-002 | DyeComparisonChart component (unused) | `dye-comparison-chart.ts` | 401 |
| DEAD-003 | DyePreviewOverlay component (unused) | `dye-preview-overlay.ts` | 317 |
| DEAD-004 | FeaturedPresetsSection component (unused) | `featured-presets-section.ts` | 160 |
| DEAD-005 | MobileBottomNav component (unused) | `mobile-bottom-nav.ts` | 200 |
| DEAD-009 | V4 barrel file (zero importers) | `v4/index.ts` | 38 |
| DEAD-013 | Dead empty state icons + lookup | `empty-state-icons.ts` | ~30 |
| DEAD-014 | Dead UI icons + lookup | `ui-icons.ts` | ~120 |

**Total Quick Wins: ~1,323 lines**

---

## Recommended Removals (Medium Effort)

These are very likely dead but require slightly more care:

| ID | Description | File(s) | Verify Before Removing |
|----|-------------|---------|----------------------|
| DEAD-001 | AppLayout v3 shell + test (replaced by v4) | `app-layout.ts`, `app-layout.test.ts` | Confirm v4-layout is the sole layout path |
| DEAD-006 | SavedPalettesModal + test (zero callers) | `saved-palettes-modal.ts`, `saved-palettes-modal.test.ts` | Confirm collection-manager is the replacement |
| DEAD-008 | Components barrel (1/35 exports used) | `components/index.ts` | Update `main.ts` import before deleting |
| DEAD-010 | Deprecated MarketBoard methods | `market-board.ts` | Confirm 0 callers |
| DEAD-011 | LocalStorageCacheBackend (deprecated) | `api-service-wrapper.ts` | Update test file |
| DEAD-012 | ~30 unused constants | `constants.ts` | Verify each has 0 importers |
| DEAD-015 | 44 unused local variables | Multiple files | Review each for intentional `_` prefixed placeholders |
| DEAD-016 | Dead barrel re-exports in services | `services/index.ts` | Verify tests don't use barrel path |
| DEAD-017 | initErrorTracking() dead in production | `logger.ts` | Update test setup |

---

## Deferred / Keep / Monitor

These need larger refactoring efforts:

| ID | Description | Reason to Defer |
|----|-------------|----------------|
| DEAD-018 | Deprecated `@shared/types` re-exports | 50 files need import migration; schedule as dedicated task |
| DEAD-019 | Deprecated `HarmonyConfig` fields | Need to verify config migration is complete |

---

## Dependency Cleanup

Knip flagged some dependencies as unused. However, most are false positives due to workspace imports, build tools, and dynamic imports. **No npm dependency changes recommended** at this time.

| Package | Status | Recommendation |
|---------|--------|---------------|
| `@xivdyetools/core` | Used via workspace | **Keep** — false positive (path aliases) |
| `@xivdyetools/logger` | Used via workspace | **Keep** — false positive |
| `@xivdyetools/types` | Used via workspace | **Keep** — false positive |
| `spectral.js` | Used by mixer-blending-engine | **Keep** — false positive |
| `lit` | Used by v4 components | **Keep** — false positive |
| `sharp` | Script-only devDependency | **Keep** — used by `scripts/generate-icons.mjs` |
| `@testing-library/dom` | Test devDependency | **Keep** — used in tests |

---

## Cleanup Execution Plan

Recommended order of operations for safe cleanup:

### Wave 1: Quick Wins — Isolated File Deletions (~1,323 lines)
1. Delete `src/components/tool-header.ts`
2. Delete `src/components/dye-comparison-chart.ts`
3. Delete `src/components/dye-preview-overlay.ts`
4. Delete `src/components/featured-presets-section.ts`
5. Delete `src/components/mobile-bottom-nav.ts`
6. Delete `src/components/v4/index.ts`
7. Remove dead icons/functions from `src/shared/empty-state-icons.ts` and `src/shared/ui-icons.ts`
8. **Run full test suite to verify**

### Wave 2: V3 Remnant Removal (~1,396 lines)
1. Delete `src/components/app-layout.ts` + `__tests__/app-layout.test.ts`
2. Delete `src/components/saved-palettes-modal.ts` + `__tests__/saved-palettes-modal.test.ts`
3. Update `main.ts` to import `offlineBanner` directly from `@components/offline-banner`
4. Delete `src/components/index.ts` (barrel)
5. **Run full test suite to verify**

### Wave 3: Dead Methods, Variables, and Exports (~400 lines)
1. Remove deprecated methods from `market-board.ts`
2. Remove `LocalStorageCacheBackend` from `api-service-wrapper.ts`
3. Remove `initErrorTracking()` from `logger.ts`
4. Remove ~30 unused constants from `constants.ts`
5. Remove dead barrel re-exports from `services/index.ts`
6. Clean up 44 unused local variables across component files
7. **Run full test suite and type-check to verify**

### Wave 4: Type Migration (Deferred — ~50 file changes)
1. Plan as a dedicated PR
2. Update all 50 files importing from `@shared/types` to use `@xivdyetools/types` directly
3. Remove deprecated re-export blocks from `shared/types.ts`
4. **Run full build + test suite**

---

## Post-Cleanup Verification

After completing cleanup waves 1-3:
- [ ] All tests pass (`npm test -- --run`)
- [ ] Build completes successfully (`npm run build`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] No new runtime errors in dev environment (`npm run dev`)
- [ ] Bundle size reduced (measure before/after with `npm run check-bundle-size`)

---

## Recommendations

### Preventing Dead Code Accumulation

1. **Enable stricter TypeScript settings**: Set `noUnusedLocals: true` and `noUnusedParameters: true` in `tsconfig.json` (currently both `false`)
2. **Add knip to CI**: Run `npx knip --no-exit-code` as a warning step in CI to catch new unused exports before they accumulate
3. **Barrel file policy**: Consider removing barrel files entirely in favor of direct imports, which this project already naturally prefers
4. **Deprecation with deadline**: When marking code `@deprecated`, include a removal date/version tag (e.g., `@deprecated Remove in v5.0`)
5. **Quarterly audit**: Schedule a dead code sweep each quarter to catch drift

### Architecture Observations

- The v3→v4 migration is ~95% complete. The remaining v3 residue (AppLayout, MobileBottomNav, etc.) can be safely cleaned
- The `shared/types.ts` re-export debt is the largest single item and should be prioritized for v5.0
- The `createSection` pattern appearing as dead code in 7 tools suggests an incomplete refactoring — investigate whether the shared version in `tool-panel-builders.ts` should be adopted by all tools
