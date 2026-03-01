# Dead Code Analysis Report — xivdyetools Ecosystem

## Executive Summary

- **Analysis Date:** 2026-02-28
- **Analysis Depth:** Exhaustive (automated tools + manual analysis + git history)
- **Total Findings:** 41
- **Projects:** web-app (v4.2.0), discord-worker (v4.1.0), bot-i18n (v1.0.1), bot-logic (v1.1.0)

| Project | Findings | Recommended Removals | Estimated Dead Lines |
|---------|----------|---------------------|---------------------|
| web-app | DEAD-001 – 019 | 16 (3 deferred) | ~3,600 |
| discord-worker | DEAD-020 – 031 | 9 (3 keep/monitor) | ~6,800 |
| bot-i18n | DEAD-032 – 035 | 2 (2 keep) | ~200 |
| bot-logic | DEAD-036 – 041 | 0 (all keep/mark @internal) | ~0 |
| **Total** | **41** | **27** | **~10,600** |

---

# Part 1: Web App (DEAD-001 – DEAD-019)

## Web App Executive Summary

- **Project:** xivdyetools-web-app v4.2.0
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

---

# Part 2: Discord Worker (DEAD-020 – DEAD-031)

## Discord Worker Executive Summary

- **Project:** discord-worker v4.1.0
- **Total Findings:** 12
- **Recommended Removals:** 9 (3 keep/monitor)
- **Estimated Dead Lines:** ~6,800+ (production + locale data + test files)
- **Estimated Dead Files:** 7 production, 6 locale, 7+ test files

## Discord Worker Health Score

**Code Freshness: C+**
- ~15% dead code by line count (~6,800 of ~12,000 production + locale lines)
- 7 entire dead service/utility files (never imported in production)
- 6 orphaned locale JSON files (exact duplicates of bot-i18n)
- Multiple features scaffolded but never wired in (pagination, progress, image-cache)
- The V4 migration left behind significant speculative infrastructure

---

## Discord Worker — Summary by Category

| Category | Findings | Remove | Keep | Est. Lines |
|----------|----------|--------|------|------------|
| Orphaned Files | DEAD-020, 021, 022 | 3 | 0 | ~6,562 |
| Unused Exports | DEAD-024, 025, 026, 028, 029, 035 | 4 | 2 | ~275 |
| Dead Code Paths | DEAD-027 | 0 | 1 | ~0 (params only) |
| Unused Dependencies | DEAD-023 | 1 | 0 | ~0 |
| Stale Test Code | DEAD-030 | 1 | 0 | ~50 |
| Legacy (Monitor) | DEAD-031 | 0 | 1 | ~0 |
| **Total** | **12** | **9** | **3** | **~6,887** |

---

## Discord Worker — Quick Wins

| ID | Description | Lines Saved |
|----|-------------|-------------|
| DEAD-020 | 7 entire dead service/util files | ~1,889 |
| DEAD-021 | 6 orphaned locale JSON files | ~4,422 |
| DEAD-022 | Legacy handleMixerCommand handler | ~251 |
| DEAD-023 | Remove discord-interactions devDep | ~0 (package.json only) |

**Total Quick Wins: ~6,562 lines**

---

## Discord Worker — Recommended Removals

| ID | Description | Verify Before Removing |
|----|-------------|----------------------|
| DEAD-024 | InteractionContext class + deadline functions | Confirm no future adoption plan |
| DEAD-025 | 7 unused component-context UI builders | Confirm no handler migration planned |
| DEAD-026 | 8 dead type/function exports | Verify each has 0 consumers |
| DEAD-029 | Legacy KV preference functions in i18n.ts | Confirm preferences.ts migration handles old keys |
| DEAD-030 | Stale test-utils.integration.ts | Confirm no integration tests planned |
| DEAD-035 | 5 unused re-exports in bot-i18n.ts | Coordinate with DEAD-032 |

---

## Discord Worker — Keep / Monitor

| ID | Description | Reason |
|----|-------------|--------|
| DEAD-027 | 9 unused handler params | 5 are interface-required; 4 need investigation |
| DEAD-028 | 10 test-only exports | Valid testing pattern — add @internal JSDoc |
| DEAD-031 | 8 legacy command markers | Live functional commands — monitor for future migration |

---

## Discord Worker — Cleanup Execution Plan

### Wave 5: Discord Worker Quick Wins (~6,562 lines)
1. Delete 7 dead service/util files (DEAD-020) + their test files
2. Delete `src/locales/` directory (DEAD-021)
3. Delete `handlers/commands/mixer.ts` (DEAD-022) + test file + re-export
4. Remove `discord-interactions` from package.json (DEAD-023)
5. **Run full test suite to verify**

### Wave 6: Discord Worker Deeper Cleanup (~275 lines)
1. Remove InteractionContext + deadline functions from discord-api.ts (DEAD-024)
2. Remove 7 unused builders from component-context.ts (DEAD-025)
3. Remove 8 dead type/function exports (DEAD-026)
4. Remove legacy KV functions from i18n.ts (DEAD-029)
5. Delete test-utils.integration.ts (DEAD-030)
6. Remove 5 unused re-exports from bot-i18n.ts (DEAD-035)
7. Prefix 5 interface-required params with `_` (DEAD-027 partial)
8. **Run full test suite and type-check to verify**

---

# Part 3: bot-i18n (DEAD-032 – DEAD-035)

## bot-i18n Executive Summary

- **Package:** @xivdyetools/bot-i18n v1.0.1
- **Total Findings:** 4
- **Recommended Removals:** 2 (2 keep — published package API concerns)
- **Estimated Dead Lines:** ~200 (locale keys + function bodies)

## bot-i18n — Findings

| ID | Description | Action | Reason |
|----|-------------|--------|--------|
| DEAD-032 | 3 unused function exports (translate, getAvailableLocales, isLocaleSupported) | REMOVE | Zero consumers; OOP API preferred over functional |
| DEAD-033 | 2 unused type exports (TranslatorLogger, LocaleData) | KEEP | Published API — mark @internal |
| DEAD-034 | ~30 unused locale key sections (buttons, pagination, components, status, matching) | REMOVE | Zero t() references |
| DEAD-035 | 5 unused re-exports in discord-worker's bot-i18n.ts | REMOVE | Downstream of DEAD-032/033 |

---

# Part 4: bot-logic (DEAD-036 – DEAD-041)

## bot-logic Executive Summary

- **Package:** @xivdyetools/bot-logic v1.1.0
- **Total Findings:** 6
- **Recommended Removals:** 0 (all are published API surface — keep with @internal tags)
- **Estimated Dead Lines:** ~0 (types are erased; functions are internal-only, not dead)

## bot-logic — Findings

| ID | Description | Action | Reason |
|----|-------------|--------|--------|
| DEAD-036 | 4 internal-only function exports (resolveCssColorName, etc.) | KEEP | Valid internal functions; remove from barrel only |
| DEAD-037 | 2 unused constant exports (HARMONY_TYPES, VISION_TYPES) | KEEP | Useful reference constants; mark @internal |
| DEAD-038 | ~24 unused Input/Result type exports | KEEP | Published SDK type contract |
| DEAD-039 | EmbedData/EmbedField types | KEEP | Part of platform-agnostic API design |
| DEAD-040 | ResolveColorOptions type | KEEP | Parameter type for public function |
| DEAD-041 | 2 REFACTOR comment markers | LOW | Clean up stale comments |

## bot-logic — Architecture Note

bot-logic has zero "dead code" in the traditional sense. All findings are about **published API surface** with no current monorepo consumers. The package is designed as a fully typed SDK, and its type exports are its documented contract. The recommendation is to add `@internal` JSDoc tags to implementation-detail exports and consider reducing the barrel re-export surface in the next major version.

---

# Cross-Project Analysis

## Root Causes of Dead Code

| Root Cause | Projects Affected | Findings |
|------------|-------------------|----------|
| V3→V4 migration residue | web-app, discord-worker | DEAD-001–007, DEAD-022, DEAD-029 |
| Speculative scaffolding never integrated | discord-worker | DEAD-020 (pagination, progress, image-cache) |
| Package extraction left duplicates | discord-worker, bot-i18n | DEAD-021, DEAD-035 |
| Over-exported published API surface | bot-i18n, bot-logic | DEAD-032–034, DEAD-036–041 |
| Abandoned integration test approach | discord-worker | DEAD-030 |
| Replaced dependencies not cleaned up | discord-worker | DEAD-023 |

## Prevention Recommendations

1. **Enable `noUnusedLocals` and `noUnusedParameters`** in tsconfig.json for all projects
2. **Add dead code detection to CI** (Knip for web-app; TSC strict for workers/libraries)
3. **Published package API audits**: When bumping major versions, review exported surface against actual consumers
4. **"Build it when you need it"**: Avoid scaffolding services/utilities before they have a consumer
5. **Package extraction checklist**: When extracting shared packages, delete the original copies from consuming apps
6. **Quarterly dead code sweeps**: Schedule reviews to catch accumulation early

---

## Post-Cleanup Verification (All Projects)

After completing all cleanup waves:
- [ ] All tests pass in each project (`npm test -- --run`)
- [ ] Builds complete (`npm run build`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] discord-worker: `npm run dev` starts without errors
- [ ] web-app: `npm run dev` starts without errors
- [ ] bot-i18n: Publish new patch version if public API changed
- [ ] bot-logic: No changes needed (all kept)
