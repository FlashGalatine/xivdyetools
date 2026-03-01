# Dead Code Analysis Report — xivdyetools Ecosystem

## Executive Summary

- **Analysis Date:** 2026-02-28 (core addendum: 2026-03-01, types+logger addendum: 2026-03-01, remaining packages addendum: 2026-02-28)
- **Analysis Depth:** Exhaustive (automated tools + manual analysis + git history + cross-consumer mapping)
- **Total Findings:** 85
- **Projects:** web-app (v4.2.0), discord-worker (v4.1.0), bot-i18n (v1.0.1), bot-logic (v1.1.0), **core (v1.17.3)**, **types (v1.8.0)**, **logger (v1.2.1)**, **auth (v1.x)**, **crypto (v1.1.0)**, **color-blending (v1.0.1)**, **rate-limiter (v1.x)**, **svg (v1.1.1)**, **test-utils (v1.1.3)**

| Project | Findings | Recommended Removals | Estimated Dead Lines |
|---------|----------|---------------------|---------------------|
| web-app | DEAD-001 – 019 | 16 (3 deferred) | ~3,600 |
| discord-worker | DEAD-020 – 031 | 9 (3 keep/monitor) | ~6,800 |
| bot-i18n | DEAD-032 – 035 | 2 (2 keep) | ~200 |
| bot-logic | DEAD-036 – 041 | 0 (all keep/mark @internal) | ~0 |
| @xivdyetools/core | DEAD-042 – 056 | 7 now (5 keep, 3 v2.0.0) | ~1,140 |
| @xivdyetools/types | DEAD-057 – 065 | 5 remove (4 keep/mark) | ~210 |
| @xivdyetools/logger | DEAD-066 – 070 | 1 remove (4 mark @internal) | ~15 |
| @xivdyetools/auth | DEAD-071 | 0 (keep — library API) | ~0 |
| @xivdyetools/color-blending | DEAD-072 | 0 (keep — library API) | ~0 |
| @xivdyetools/crypto | _(none)_ | 0 (clean) | 0 |
| @xivdyetools/rate-limiter | DEAD-073 – 075 | 2 remove (1 keep) | ~32 |
| @xivdyetools/svg | DEAD-076 – 082, 085 | 5 remove (3 keep/mark) | ~80 |
| @xivdyetools/test-utils | DEAD-083 – 084 | 2 remove | ~50 |
| **Total** | **85** | **49** | **~12,127** |

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

# Part 5: @xivdyetools/core (DEAD-042 – DEAD-056)

## Core Executive Summary

- **Package:** @xivdyetools/core v1.17.3
- **Total Findings:** 15
- **Recommended Removals:** 7 now, 3 deferred to v2.0.0, 5 keep
- **Estimated Dead Lines:** ~1,140 (source + tests + scripts)
- **Estimated Dead Files:** 7 (scripts + tests)

## Core Health Score

**Code Freshness: B+**
- ~4% dead source code by line count
- Active development (index.ts, APIService, DyeDatabase, utils all modified within 6 months)
- The main dead weight is deprecated compatibility re-exports (~163 lines) and stale scripts (~365 lines)
- 77% of barrel exports (~99 of ~129) have zero external monorepo consumers — most are used internally or exist for npm API surface
- No unused production dependencies; all 3 deps (`@xivdyetools/types`, `@xivdyetools/logger`, `spectral.js`) are actively used

---

## Core — Consumer Map

8 monorepo projects depend on `@xivdyetools/core`. Of the ~129 barrel exports, only **30 unique symbols** are imported by consumers:

| Consumer | Symbols Imported | Key Imports |
|----------|-----------------|-------------|
| web-app | 23 | ColorService, DyeService, APIService, PresetService, PaletteService, CharacterColorService, ColorConverter |
| discord-worker | 12 | ColorService, DyeService, PaletteService, CharacterColorService, Dye, HarmonyOptions |
| og-worker | 8 | DyeService, ColorConverter, CharacterColorService, ColorService, Dye |
| bot-logic | 8 | ColorService, DyeService, LocalizationService, Dye, MatchingMethod |
| svg | 3 | ColorService, RGB, Dye |
| maintainer | 2 | ColorService, isValidHexColor |
| color-blending | 1 | ColorService |
| stoat-worker | 1 | Dye |

---

## Core — Summary by Category

| Category | Findings | Remove Now | Keep/Defer | Est. Lines |
|----------|----------|-----------|------------|------------|
| Legacy/Deprecated | DEAD-042, 047, 049 | 2 | 1 (phased) | ~185 now + ~100 Phase 1 |
| Stale Test Code | DEAD-043, 044 | 2 | 0 | 539 |
| Orphaned Files | DEAD-050, 051, 052, 053 | 4 | 0 | ~365 |
| Unused Exports | DEAD-045, 046, 048, 055, 056 | 0 | 5 (v2.0.0 or keep) | ~0 now |
| Dead Code Paths | DEAD-054 | 0 | 1 (adopt or remove) | ~40 |
| **Total** | **15** | **8** | **7** | **~1,140** |

---

## Core — Quick Wins (High Confidence, Safe to Remove)

| ID | Description | File(s) | Lines Saved |
|----|-------------|---------|-------------|
| DEAD-043 | Legacy omnibus `core.test.ts` (duplicates coverage) | `src/__tests__/core.test.ts` | 324 |
| DEAD-044 | `logger.test.ts` tests deprecated re-exports | `src/__tests__/logger.test.ts` | 215 |
| DEAD-049 | Deprecated `characterColorData` export + monolithic JSON | `src/index.ts`, `src/data/character_colors.json` | ~5 |
| DEAD-050 | 3 orphaned `add-type-flags` scripts | `scripts/add-type-flags.{js,mjs,ts}` | 154 |
| DEAD-051 | Orphaned `compare-scrapes.js` | `scripts/compare-scrapes.js` | 171 |
| DEAD-052 | Stale `response.json` debug artifact | `scripts/response.json` | 1 |
| DEAD-053 | Tracked CSV despite gitignore | `scripts/output/dye_names.csv` | 137 |

**Total Quick Wins: ~1,007 lines across 7 files**

---

## Core — Recommended Removals (Medium Effort)

| ID | Description | File(s) | Verify Before Removing |
|----|-------------|---------|------------------------|
| DEAD-042 | Deprecated `types/logger.ts` wrapper | `src/types/logger.ts` | Migrate web-app `NoOpLogger` import first |
| DEAD-047 Phase 1 | ~68 zero-consumer deprecated type re-exports | `src/types/index.ts` | Run monorepo-wide type-check after |

---

## Core — Deferred / Keep / Monitor

| ID | Description | Reason to Defer |
|----|-------------|----------------|
| DEAD-045 | 13 unused utility exports | Published npm API — mark `@internal`, remove v2.0.0 |
| DEAD-046 | 4 unused constant exports | Published npm API — mark `@internal`, remove v2.0.0 |
| DEAD-047 Phase 2 | 12 actively consumed deprecated re-exports (`Dye`, `RGB`, etc.) | Requires migration of ~40 files across 6 projects |
| DEAD-048 | 11 character color data exports | Published npm API — mark `@internal`, remove v2.0.0 |
| DEAD-054 | `isAbortError` — untested, unused | Either adopt internally + add tests, or deprecate |
| DEAD-055 | `MemoryCacheBackend` — zero external consumers | Legitimate public API for APIService users |
| DEAD-056 | `VERSION` — zero external consumers | Standard npm pattern, keep |

---

## Core — Dependency Cleanup

| Package | Status | Recommendation |
|---------|--------|----------------|
| `@xivdyetools/types` | Used | **Keep** |
| `@xivdyetools/logger` | Used (+ deprecated re-exports) | **Keep** |
| `spectral.js` | Used by SpectralMixer | **Keep** |
| `@vitest/coverage-v8` (dev) | Used via CLI, not imports | **Keep** — depcheck false positive |
| `typedoc-plugin-markdown` (dev) | Used via typedoc config | **Keep** — depcheck false positive |

**No dependency removals recommended.**

---

## Core — Cleanup Execution Plan

### Wave 7: Core Quick Wins (~1,007 lines)
1. Delete `src/__tests__/core.test.ts` (DEAD-043)
2. Delete `src/__tests__/logger.test.ts` (DEAD-044)
3. Remove `characterColorData` export from `src/index.ts` and delete `src/data/character_colors.json` (DEAD-049)
4. Delete `scripts/add-type-flags.{js,mjs,ts}` (DEAD-050)
5. Delete `scripts/compare-scrapes.js` (DEAD-051)
6. Delete `scripts/response.json` (DEAD-052)
7. `git rm --cached scripts/output/dye_names.csv` (DEAD-053)
8. **Run `npm test -- --run` and `npm run type-check` to verify**

### Wave 8: Core Deprecated Code Cleanup (~120 lines + 1 consumer migration)
1. Update web-app `api-service-wrapper.ts` to import `NoOpLogger` from `@xivdyetools/logger/library`
2. Delete `src/types/logger.ts` (DEAD-042)
3. Remove zero-consumer deprecated re-exports from `src/types/index.ts` (DEAD-047 Phase 1)
4. Update `src/index.ts` to remove corresponding barrel re-exports
5. **Run monorepo-wide `npm run type-check` across all consumers**

### Wave 9: Core v2.0.0 Preparation (Deferred)
1. Mark unused utility exports with `@internal` (DEAD-045)
2. Mark unused constant exports with `@internal` (DEAD-046)
3. Mark character color data exports with `@internal` (DEAD-048)
4. Add test coverage for `isAbortError` or deprecate it (DEAD-054)
5. Migrate 12 actively consumed deprecated type re-exports to `@xivdyetools/types` across ~40 files (DEAD-047 Phase 2)
6. **Plan as v2.0.0 breaking change release**

---

# Cross-Project Analysis

## Root Causes of Dead Code

| Root Cause | Projects Affected | Findings |
|------------|-------------------|----------|
| V3→V4 migration residue | web-app, discord-worker | DEAD-001–007, DEAD-022, DEAD-029 |
| Speculative scaffolding never integrated | discord-worker, types | DEAD-020, DEAD-061, DEAD-063 |
| Package extraction left duplicates | discord-worker, bot-i18n, core, svg | DEAD-021, DEAD-035, DEAD-042, DEAD-047, DEAD-077, DEAD-078 |
| Over-exported published API surface | bot-i18n, bot-logic, core, types, logger, auth, color-blending, rate-limiter, svg, test-utils | DEAD-032–034, DEAD-036–041, DEAD-045–048, DEAD-055–058, DEAD-066–068, DEAD-071, DEAD-072, DEAD-075, DEAD-076 |
| Abandoned integration test approach | discord-worker | DEAD-030 |
| Replaced dependencies not cleaned up | discord-worker | DEAD-023 |
| Stale development scripts/artifacts | core | DEAD-050–053 |
| Legacy omnibus test files | core | DEAD-043–044 |
| Untested utility code | core | DEAD-054 |
| Union-vs-subtypes pattern (consumers use unions, not sub-types) | types | DEAD-057, DEAD-058 |
| Unadopted branded-type pattern | types | DEAD-059 |
| Superseded by app-local implementations | logger | DEAD-070 |
| Implementation details in public barrel | logger, rate-limiter | DEAD-066, DEAD-069, DEAD-073 |
| Deprecated code still consumed | test-utils | DEAD-083, DEAD-084 |
| Orphaned internal barrel/re-exports | rate-limiter, discord-worker (svg) | DEAD-073, DEAD-082 |
| Duplicated utility implementations | svg, rate-limiter | DEAD-077, DEAD-078, DEAD-074, DEAD-085 |
| Unused local variables (compiler-verified) | svg | DEAD-080 |
| Accepted-but-unused options | svg | DEAD-081 |
| Types exported but not in barrel | svg | DEAD-079 |

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
- [ ] core: Publish new patch version after Wave 7; minor version after Wave 8
- [ ] core: Run monorepo-wide type-check after any type-related removal
- [ ] types: Publish new minor version after removing utility module/API types
- [ ] types: Run monorepo-wide type-check after any barrel changes
- [ ] logger: Publish new patch version after `@internal` markings (no API change)

---

# Part 6: @xivdyetools/types (DEAD-057 – DEAD-065)

## Types Package Executive Summary

- **Package:** @xivdyetools/types v1.8.0
- **Source:** 2,576 lines across 30 source files (+ 1,143 test lines across 4 test files)
- **Total Exported Symbols:** 88 (47 interfaces, 28 types, 8 functions, 3 consts, 1 enum, 1 class)
- **Consumed by Apps:** 40 symbols (45.5%)
- **Consumed Only by Core:** 15 symbols (17.0%)
- **Truly Dead:** 25 symbols (28.4%)
- **Subpath Exports:** 8 defined, 3 actively used, 5 with zero consumers
- **Total Findings:** 9 (DEAD-057 – DEAD-065)
- **Health Score:** B (significant dead surface, but much is intentional contract definition)

### Consumer Landscape

| Consumer | # Symbols Used | Notes |
|----------|:---:|-------|
| packages/core | 88 (all) | Re-exports entire surface (deprecated barrel) |
| apps/web-app | ~20 | Dye, PriceData, color types, error types |
| apps/discord-worker | ~20 | Preset types, Dye, character types, isValidSnowflake |
| apps/moderation-worker | ~17 | Preset types, isValidSnowflake |
| apps/presets-api | ~18 | Preset types, auth types, moderation types |
| apps/oauth | ~14 | Auth types, XIVAuth types |
| packages/test-utils | ~8 | Dye, preset, auth types (via subpath imports) |
| packages/svg | 1 | PresetCategory only |

### Finding Details

| ID | Title | Symbols | Rec. |
|----|-------|:---:|------|
| DEAD-057 | 11 unused preset response sub-types | 11 | Mark @internal |
| DEAD-058 | 7 unused auth response sub-types | 7 | Mark @internal |
| DEAD-059 | DiscordSnowflake + createSnowflake | 2 | Mark @internal |
| DEAD-060 | Orphaned preset/character types | 3 | Remove 2, mark 1 |
| DEAD-061 | Entire utility module | 6 | **Remove** |
| DEAD-062 | All localization types (zero direct consumers) | 9 | Keep (core uses) |
| DEAD-063 | API generic response types | 3 | **Remove** |
| DEAD-064 | Character/dye core-only types | 6 | Keep, mark @internal |
| DEAD-065 | 5 unused subpath exports | — | Keep (low cost) |

### Key Insight: The Union-vs-Subtypes Pattern

The single largest source of dead code in types (18 symbols across DEAD-057 and DEAD-058) follows a consistent pattern: discriminated union types that define sub-types for each variant. Consumers universally import the union type and narrow via property checks — they never import the constituent sub-types.

```typescript
// How the types are defined (types package)
export interface PresetSubmitCreatedResponse { ... }  // ← DEAD (DEAD-057)
export interface PresetSubmitDuplicateResponse { ... } // ← DEAD
export interface PresetSubmitErrorResponse { ... }     // ← DEAD
export type PresetSubmitResponse = ...;                // ← CONSUMED ✓

// How consumers actually use them (all apps)
import type { PresetSubmitResponse } from '@xivdyetools/types';
if (response.status === 'created') { ... } // Type narrowing via discriminant
```

**Recommendation:** Mark all sub-types `@internal`. Keep definitions in source files where they compose the unions. Remove from barrel exports.

### Cleanup Execution Plan — Wave 10

**Phase 1: Quick removals (patch version bump)**
1. Delete `src/utility/index.ts` + `src/utility/index.test.ts` (DEAD-061) — 6 dead symbols
2. Remove `APISuccessResponse`, `APIErrorResponse`, `APIResponse` from `src/api/response.ts` (DEAD-063) — 3 dead symbols
3. Remove `ResolvedPreset` from `src/preset/core.ts` (DEAD-060) — 1 dead symbol
4. Remove `AuthenticatedPresetSubmission` from `src/preset/community.ts` (DEAD-060) — 1 dead symbol
5. Update all barrel files and `src/index.ts`
6. Update core's deprecated re-exports to drop removed symbols
7. Run monorepo-wide `type-check` and tests

**Phase 2: @internal markings (no version bump needed)**
1. Add `@internal` to 18 response sub-types (DEAD-057, DEAD-058)
2. Add `@internal` to `DiscordSnowflake`, `createSnowflake` (DEAD-059)
3. Add `@internal` to `CharacterColorCategory` (DEAD-060)
4. Add `@internal` to 6 core-only types (DEAD-064)

---

# Part 7: @xivdyetools/logger (DEAD-066 – DEAD-070)

## Logger Package Executive Summary

- **Package:** @xivdyetools/logger v1.2.1
- **Source:** 1,491 lines across 13 source files (+ 2,901 test lines across 8 test files)
- **Total Exported Symbols:** 23 (9 types, 4 classes, 6 functions, 4 const instances)
- **Consumed Externally:** 9 symbols (39.1%)
- **Dead:** 14 symbols (60.9%)
- **Subpath Exports:** 3 defined, all 3 actively used
- **Total Findings:** 5 (DEAD-066 – DEAD-070)
- **Health Score:** A- (dead exports are implementation details, not speculative code)

### Two-Layer Architecture

Logger's exports form a clear two-layer architecture:

| Layer | Symbols | Consumed | Dead | Description |
|-------|:---:|:---:|:---:|---|
| **Public API** | 9 | 9 | 0 | Factory functions, pre-configured instances, key types |
| **Implementation** | 14 | 0 | 14 | Base classes, adapters, config types, low-level factories |

This is **healthy architecture** — the "dead" exports are implementation details that happen to be exposed. The fix is `@internal` markers, not deletion.

### Consumer Landscape

| Consumer | Symbols Used | Primary Import Path |
|----------|---|---|
| discord-worker | `ExtendedLogger`, `createRequestLogger` | Main barrel + `./worker` |
| moderation-worker | `ExtendedLogger`, `createRequestLogger` | Main barrel + `./worker` |
| presets-api | `ExtendedLogger`, `createRequestLogger` | Main barrel + `./worker` |
| oauth | `ExtendedLogger`, `createRequestLogger` | Main barrel + `./worker` |
| stoat-worker | `createLibraryLogger` | Main barrel |
| web-app | `createBrowserLogger`, `browserLogger`, `perf` | `./browser` |
| core | `Logger`, `NoOpLogger`, `ConsoleLogger` | `./library` |

### Finding Details

| ID | Title | Dead Symbols | Rec. |
|----|-------|:---:|------|
| DEAD-066 | Internal implementation classes in barrel | 4 | Mark @internal |
| DEAD-067 | Type exports with zero consumers | 7 | Keep (good DX practice) |
| DEAD-068 | `createSimpleLogger` | 1 | Mark @internal |
| DEAD-069 | `createWorkerLogger` (no direct consumers) | 1 | Mark @internal |
| DEAD-070 | `getRequestId` (superseded) | 1 | Remove from barrel |

### The `getRequestId` Mismatch (DEAD-070)

The only genuinely unnecessary export. All 4 worker apps define their own `getRequestId(c: Context)` that takes a Hono `Context` parameter. Logger's version takes a raw `Request` object — a signature mismatch that prevents adoption.

```typescript
// Logger's version (unused)
export function getRequestId(request: Request): string { ... }

// What every app defines locally
export function getRequestId(c: Context): string { ... }
```

### Cleanup Execution Plan — Wave 11

**Phase 1: Barrel cleanup (patch version bump)**
1. Remove `getRequestId` from `src/presets/index.ts` and `src/index.ts` (DEAD-070)
2. Keep function in `worker.ts` (called internally by `createRequestLogger`)

**Phase 2: @internal markings (no version bump needed)**
1. Add `@internal` to `BaseLogger`, `ConsoleAdapter`, `JsonAdapter`, `NoopAdapter` (DEAD-066)
2. Add `@internal` to `createSimpleLogger` (DEAD-068)
3. Add `@internal` to `createWorkerLogger` (DEAD-069)
4. Add `@internal` to `LogEntry` (only truly internal type from DEAD-067)

---

# Updated Cross-Project Analysis

## Ecosystem-Wide Dead Code Summary

| Package | Exports | Consumed | Dead | Dead % | Health |
|---------|:---:|:---:|:---:|:---:|:---:|
| @xivdyetools/types | 88 | 40 | 48* | 54.5% | B |
| @xivdyetools/core | ~129 | ~30 | ~99* | 76.7% | B+ |
| @xivdyetools/logger | 23 | 9 | 14 | 60.9% | A- |
| @xivdyetools/auth | 20 | 8 | 12 | 60.0% | A |
| @xivdyetools/crypto | 8 | 3 | 5 | 62.5% | A+ |
| @xivdyetools/color-blending | 10 | 5 | 5 | 50.0% | A |
| @xivdyetools/rate-limiter | 23 | 9 | 14 | 60.9% | B+ |
| @xivdyetools/svg | ~60 | 18 | 42 | 70.0% | B- |
| @xivdyetools/test-utils | ~35 | ~20 | ~15 | 42.9% | B+ |

\* For types and core, "dead" includes symbols consumed only through deprecated re-exports and core-internal-only symbols. Truly actionable dead code is lower.

## Shared Root Cause: Over-exported API Surface

The dominant pattern across all packages is **over-broad barrel exports**. Each package exports its full internal symbol set, but consumers only need a fraction:

- **Types:** 40 of 88 symbols consumed (45.5%)
- **Core:** ~30 of ~129 symbols consumed (23.3%)
- **Logger:** 9 of 23 symbols consumed (39.1%)
- **Auth:** 8 of 20 symbols consumed (40.0%)
- **Crypto:** 3 of 8 symbols consumed (37.5%)
- **Color-blending:** 5 of 10 symbols consumed (50.0%)
- **Rate-limiter:** 9 of 23 symbols consumed (39.1%)
- **SVG:** 18 of ~60 symbols consumed (30.0%)
- **Test-utils:** ~20 of ~35 symbols consumed (57.1%)

**Combined:** ~142 of ~396 symbols consumed across all 9 foundation packages (**35.9%**).

### Recommendation: Adopt `@internal` + Minimal Public API

For the next major version of each package:
1. Mark all implementation details `@internal`
2. Document the intended public API surface (types: ~40 symbols, core: ~30, logger: ~9, auth: ~8, svg: ~18)
3. Consider separate `/internal` subpath exports for extensibility
4. Run API surface audits at each major version bump

---

# Part 8: @xivdyetools/auth (DEAD-071)

## Auth Package Executive Summary

- **Package:** @xivdyetools/auth v1.x
- **Source:** 810 lines across 5 source files
- **Total Exported Symbols:** 20
- **Consumed Externally:** 8 (40.0%)
- **Dead Symbols:** 12 (60.0%)
- **Total Findings:** 1
- **Recommended Removals:** 0
- **Health Score:** A (clean package, all "dead" exports are intentional API surface)

### Consumer Landscape

| Consumer | Symbols Used | Key Imports |
|----------|:---:|---|
| discord-worker | 4 | `verifyDiscordInteraction`, `verifyJWT`, `JWTPayload`, `VerificationConfig` |
| moderation-worker | 3 | `verifyDiscordInteraction`, `verifyJWT`, `JWTPayload` |
| presets-api | 4 | `verifyJWT`, `verifyHMAC`, `signHMAC`, `HMACConfig` |

### Finding Details

| ID | Title | Symbols | Rec. |
|----|-------|:---:|------|
| DEAD-071 | 12 unused auth exports | 12 | KEEP (library API surface) |

The 12 unconsumed exports include `createJWT`, `decodeJWTPayload`, `isTokenExpired`, `isTokenNearExpiry`, and supporting types. These are all legitimate public API surface for an auth library — they exist for external consumers and future use cases.

**No cleanup actions needed.**

---

# Part 9: @xivdyetools/crypto _(no findings)_

## Crypto Package Executive Summary

- **Package:** @xivdyetools/crypto v1.1.0
- **Source:** 176 lines across 3 source files
- **Total Exported Symbols:** 8
- **Consumed Externally:** 3 (by @xivdyetools/auth only)
- **Total Findings:** 0
- **Health Score:** A+ (exceptionally clean)

The crypto package is the cleanest package in the entire monorepo. Zero dependencies, zero dead code markers, zero TODO/FIXME/HACK comments. The 5 unconsumed exports (`fromUint8Array`, `base64UrlToBase64`, `base64ToBase64Url`, `isBase64Url`, `base64UrlEncodeString`) are standard utility functions appropriate for a crypto library.

**No cleanup actions needed.**

---

# Part 10: @xivdyetools/color-blending (DEAD-072)

## Color-Blending Package Executive Summary

- **Package:** @xivdyetools/color-blending v1.0.1
- **Source:** 432 lines across 4 source files
- **Total Exported Symbols:** 10
- **Consumed Externally:** 5 (50.0%)
- **Dead Symbols:** 5 (50.0%)
- **Total Findings:** 1
- **Recommended Removals:** 0
- **Health Score:** A (clean package, well-structured)

### Consumer Landscape

| Consumer | Symbols Used | Key Imports |
|----------|:---:|---|
| bot-logic | 3 | `blendColors`, `BlendingMode`, `BLENDING_MODE_NAMES` |
| svg | 2 | `blendColors`, `BlendingMode` |
| discord-worker | 3 | `blendColors`, `BlendingMode`, `ALL_BLENDING_MODES` |

### Finding Details

| ID | Title | Symbols | Rec. |
|----|-------|:---:|------|
| DEAD-072 | 5 unused color-blending exports | 5 | KEEP (library API surface) |

The 5 unconsumed exports are 3 types (`BlendResult`, `BlendInput`, `BlendingModeInfo`) and 2 functions (`getBlendingModeDescription`, `getBlendingModeInfo`). All are standard library API surface.

**No cleanup actions needed.**

---

# Part 11: @xivdyetools/rate-limiter (DEAD-073 – DEAD-075)

## Rate-Limiter Package Executive Summary

- **Package:** @xivdyetools/rate-limiter v1.x
- **Source:** 1,213 lines across ~10 source files
- **Total Exported Symbols:** 23
- **Consumed Externally:** 9 (39.1%)
- **Dead Symbols (zero external consumers):** 14 (60.9%)
- **Total Findings:** 3
- **Recommended Removals:** 2
- **Estimated Dead Lines:** ~32
- **Health Score:** B+ (2 minor structural issues, otherwise solid)

### Consumer Landscape

| Consumer | Symbols Used | Key Imports |
|----------|:---:|---|
| universalis-proxy | 1 | `MemoryRateLimiter` |
| presets-api | 4 | `KVRateLimiter`, `RateLimitResult`, `isRateLimited`, `RATE_LIMIT_HEADERS` |
| moderation-worker | 2 | `KVRateLimiter`, `isRateLimited` |
| oauth | 2 | `UpstashRateLimiter`, `UpstashRateLimiterOptions` |
| discord-worker | 3 | `UpstashRateLimiter`, `RateLimitResult`, `RateLimiterOptions` |

### Summary by Category

| Category | Findings | Remove | Keep | Est. Lines |
|----------|----------|--------|------|------------|
| Orphaned Files | DEAD-073 | 1 | 0 | ~14 |
| Duplicate Definitions | DEAD-074 | 1 | 0 | ~18 |
| Unused Exports | DEAD-075 | 0 | 1 | ~0 |
| **Total** | **3** | **2** | **1** | **~32** |

### Finding Details

| ID | Title | Action | Details |
|----|-------|--------|---------|
| DEAD-073 | Orphaned `backends/index.ts` barrel | **REMOVE** | 14-line barrel file not imported by main `index.ts` or `package.json` exports. Dead since rate-limiter was created — the main barrel imports backends directly. |
| DEAD-074 | Duplicate `UpstashRateLimiterOptions` | **REMOVE WITH CAUTION** | The `UpstashRateLimiterOptions` interface is defined in both `types.ts` and `backends/upstash.ts`. Delete the local copy in `upstash.ts` and import from `types.ts`. |
| DEAD-075 | 14 unused exported symbols | KEEP | Standard library API surface (types, error codes, helper functions). |

### Cleanup Execution Plan — Wave 12

1. Delete `src/backends/index.ts` (DEAD-073)
2. Remove local `UpstashRateLimiterOptions` from `src/backends/upstash.ts`, import from `../types` (DEAD-074)
3. **Run `npm test -- --run` and `npm run type-check` to verify**

---

# Part 12: @xivdyetools/svg (DEAD-076 – DEAD-082, DEAD-085)

## SVG Package Executive Summary

- **Package:** @xivdyetools/svg v1.1.1
- **Source:** 3,764 lines across ~15 source files
- **Total Exported Symbols:** ~60
- **Consumed Externally:** 18 (30.0%)
- **Dead Symbols (zero external consumers):** 42 (70.0%)
- **Total Findings:** 8
- **Recommended Removals:** 5 (3 keep/mark @internal)
- **Estimated Dead Lines:** ~80
- **Health Score:** B- (most problematic package — concentrated issues in `comparison-grid.ts`)

### Consumer Landscape

| Consumer | Symbols Used | Key Imports |
|----------|:---:|---|
| bot-logic | ~12 | All 5 generator functions + Options types + Dye input types |
| discord-worker | ~8 | All 5 generator functions + `SVGGeneratorError` |

### Summary by Category

| Category | Findings | Remove | Keep | Est. Lines |
|----------|----------|--------|------|------------|
| Unused Exports | DEAD-076 | 0 | 1 | ~0 (mark @internal) |
| Duplicate Code | DEAD-077, DEAD-078, DEAD-085 | 0 | 3 | ~0 (refactor) |
| Types Not in Barrel | DEAD-079 | 1 | 0 | ~2 (remove `export`) |
| Unused Locals | DEAD-080 | 1 | 0 | ~12 |
| Unused Options | DEAD-081 | 1 | 0 | ~5 |
| Dead Re-exports | DEAD-082 | 1 | 0 | ~1 |
| **Total** | **8** | **4 remove, 3 refactor** | **1** | **~80** |

### Finding Details

| ID | Title | Action | Details |
|----|-------|--------|---------|
| DEAD-076 | 42 unused barrel exports (base primitives) | **KEEP** | SVG building blocks (`SVGRect`, `SVGCircle`, `SVGText`, etc.) + color utilities. Mark `@internal`. |
| DEAD-077 | Duplicate `rgbToHsv` in comparison-grid.ts and dye-info-card.ts | **REFACTOR** | Extract to `base.ts` shared utility. ~20 duplicated lines. |
| DEAD-078 | Duplicate luminance/contrast in comparison-grid.ts | **REFACTOR** | `getRelativeLuminance()` and `getContrastRatio()` reimplemented instead of using existing `ColorService`. ~25 duplicated lines. |
| DEAD-079 | `ComparisonDye`/`DyePair` exported but not in barrel | **REMOVE** export keyword | Types are `export`ed from their file but not re-exported from `index.ts`. Since no consumer imports them, remove the `export` keyword. |
| DEAD-080 | 3 unused locals in comparison-grid.ts | **REMOVE** | `columnWidth` (L258), `pairs` (L393), `dyes` (L399) — all compiler-verified unused (tsc TS6133). |
| DEAD-081 | `baseName` option in HarmonyWheelOptions | **REMOVE WITH CAUTION** | The `baseName` property is accepted in options but never rendered in the SVG output. Either implement it or remove it. |
| DEAD-082 | Dead `export * from '@xivdyetools/svg'` in discord-worker | **REMOVE** | `apps/discord-worker/src/services/svg/index.ts` re-exports all ~60 svg symbols, but no discord-worker file imports them via this path. Only the local `generateSVG` wrapper is used. |
| DEAD-085 | Inconsistent inline name truncation | **REFACTOR** | `comparison-grid.ts` uses inline substring truncation while `truncateText()` exists in `base.ts`. Standardize on the shared utility. |

### Key Architecture Observation

`comparison-grid.ts` is the most problematic file in the svg package, concentrating 5 of 8 findings (DEAD-077, DEAD-078, DEAD-080, DEAD-085, and contributing to DEAD-079). It appears to have been developed independently of the shared utility layer in `base.ts`, leading to duplicated implementations and unused locals.

### Cleanup Execution Plan — Wave 13

**Phase 1: Quick fixes (safe, no behavior change)**
1. Remove 3 unused locals from `comparison-grid.ts` (DEAD-080)
2. Remove `export` keyword from `ComparisonDye` and `DyePair` (DEAD-079)
3. Remove `export * from '@xivdyetools/svg'` from `discord-worker/src/services/svg/index.ts` (DEAD-082)
4. Remove `baseName` from `HarmonyWheelOptions` interface (DEAD-081)
5. **Run `npm test -- --run` and `npm run type-check` in both svg and discord-worker**

**Phase 2: Refactoring (behavior-preserving, requires testing)**
1. Extract `rgbToHsv` to `base.ts`, update imports in comparison-grid.ts and dye-info-card.ts (DEAD-077)
2. Replace local `getRelativeLuminance`/`getContrastRatio` with `ColorService` calls (DEAD-078)
3. Replace inline truncation with `truncateText()` usage (DEAD-085)
4. **Run full test suite to verify visual output hasn't changed**

---

# Part 13: @xivdyetools/test-utils (DEAD-083 – DEAD-084)

## Test-Utils Package Executive Summary

- **Package:** @xivdyetools/test-utils v1.1.3
- **Source:** 3,394 lines across ~25 source files
- **Total Exported Symbols:** ~35
- **Consumed Externally:** ~20 (57.1%)
- **Total Findings:** 2
- **Recommended Removals:** 2
- **Estimated Dead Lines:** ~50
- **Health Score:** B+ (deprecated code still actively consumed — needs migration)

### Consumer Landscape

| Consumer | Key Imports |
|----------|---|
| presets-api tests | `MockD1Database`, `MockKVNamespace`, `MockR2Bucket`, `createTestDye`, `createTestPreset`, `createTestUser`, `createTestJWT`, `createTestHMAC`, `randomId` |
| oauth tests | `MockD1Database`, `MockKVNamespace`, `createTestUser`, `createTestJWT`, `randomId` |
| moderation-worker tests | `MockD1Database`, `MockKVNamespace`, `createTestJWT`, `randomId` |
| svg tests | `createTestDye`, `createTestCategory` |

### Finding Details

| ID | Title | Action | Details |
|----|-------|--------|---------|
| DEAD-083 | Deprecated `nextId()` still consumed by `dye.ts` and `category.ts` factories | **REMOVE WITH CAUTION** | `nextId()` is marked `@deprecated` with JSDoc directing migration to `randomId()`, but 2 factory files still call it. Migrate those call sites to `randomId()`, then remove `nextId()`. |
| DEAD-084 | Legacy counter infrastructure | **REMOVE** (after DEAD-083) | The `counters` Map, `resetCounters()`, `resetCounter()`, and `getCounterValue()` exist solely to support `nextId()`. Once `nextId()` is removed, this entire infrastructure (~30 lines in `counters.ts`) becomes dead. |

### The Deprecation Gap

The `nextId()` deprecation represents a common pattern: deprecated code that was never fully migrated. The deprecated marker was added, but two internal consumers were not updated:

```typescript
// packages/test-utils/src/utils/counters.ts
/** @deprecated Use randomId() instead for unique IDs */
export function nextId(prefix: string): number {
  // Sequential counter — deterministic but fragile for tests
  const current = counters.get(prefix) ?? 0;
  const next = current + 1;
  counters.set(prefix, next);
  return next;
}
```

```typescript
// packages/test-utils/src/factories/dye.ts — STILL CALLS nextId()
import { nextId } from '../utils/counters.js';
export function createTestDye(overrides?: Partial<Dye>): Dye {
  const id = nextId('dye');
  // ...
}
```

### Cleanup Execution Plan — Wave 14

1. Update `src/factories/dye.ts`: Replace `nextId('dye')` with `randomId()` for ID generation
2. Update `src/factories/category.ts`: Replace `nextId('category')` with `randomId()` for ID generation
3. Remove `nextId()` from `src/utils/counters.ts`
4. Remove `counters` Map, `resetCounters()`, `resetCounter()`, `getCounterValue()` from `counters.ts`
5. If `counters.ts` is now empty, delete the file and update barrel imports
6. Update `src/index.ts` to remove re-exports of deleted symbols
7. **Run `npm test -- --run` across test-utils AND all consumers (presets-api, oauth, moderation-worker, svg)**

---

# Updated Post-Cleanup Verification (All Projects)

After completing all cleanup waves (1-14):
- [ ] All tests pass in each project (`npm test -- --run`)
- [ ] Builds complete (`npm run build`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] discord-worker: `npm run dev` starts without errors
- [ ] web-app: `npm run dev` starts without errors
- [ ] bot-i18n: Publish new patch version if public API changed
- [ ] bot-logic: No changes needed (all kept)
- [ ] core: Publish new patch version after Wave 7; minor version after Wave 8
- [ ] core: Run monorepo-wide type-check after any type-related removal
- [ ] types: Publish new minor version after removing utility module/API types
- [ ] types: Run monorepo-wide type-check after any barrel changes
- [ ] logger: Publish new patch version after `@internal` markings (no API change)
- [ ] rate-limiter: Publish new patch version after DEAD-073/074 cleanup
- [ ] svg: Publish new patch version after Wave 13 Phase 1; minor version after Phase 2
- [ ] test-utils: Publish new minor version after DEAD-083/084 (breaking for `nextId()` consumers)
- [ ] test-utils: Run tests across presets-api, oauth, moderation-worker, svg after changes
