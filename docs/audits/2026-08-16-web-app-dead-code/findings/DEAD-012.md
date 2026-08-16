# [DEAD-012]: Unused exported functions — 15 dead functions across components/services/shared (~260 lines)

## Category
Unused Export

## Location / Evidence
All verified with `grep -w` across `src`, `e2e`, `scripts`, vite plugins (`evidence/agent-report-ts-symbols.md` §A, §E; `evidence/knip-production-report.txt`; main-session checks for `getToolIcon`/`getSocialIcon`/`createLabelWithInfo`).

| # | file:line | symbol | hits | lines | note |
|---|---|---|---|---|---|
| 1 | `src/components/v4/result-card.ts:162-212` | `generateMarketErrorCode` | 1 (decl) | 51 | never referenced, no test |
| 2 | `src/services/harmony-generator.ts:305-357` | `generateHarmonyPanelData` | 1 | 53 | last item in file; not in `harmony-generator.test.ts` |
| 3 | `src/components/about-modal.ts:410-419` | `closeAboutModal` | 1 | 7 | |
| 4 | `src/components/advanced-options-panel.ts:411-419` | `closeAdvancedOptionsPanel` | 1 | 7 | |
| 5 | `src/components/v4/language-modal.ts:236-244` | `closeLanguageModal` | 1 | 8 | |
| 6 | `src/components/v4/theme-modal.ts:205-213` | `closeThemeModal` | 1 | 8 | |
| 7 | `src/components/add-to-collection-menu.ts:276-283` | `isAddToCollectionMenuOpen` | 1 | 6 | |
| 8 | `src/components/v4-layout.ts:654-699` | `destroyV4Layout` (+ `_configController` at `:39,:153`) | 1 | 46+3 | **DEAD-MEDIUM** — deliberate lifecycle counterpart to `initV4Layout`; the SPA never unmounts. Delete or keep as a documented no-op decision. |
| 9 | `src/shared/tool-config-types.ts:505-513` | `isToolId` | 1 | 9 | type guard nobody calls |
| 10 | `src/shared/logger.ts:17` | `createBrowserLogger` re-export | 0 importers | 1 identifier | keep `perf` |
| 11 | `src/components/info-tooltip.ts:62-84` | `createLabelWithInfo` | test-only | 23 | `createInfoIcon` stays (used by live `addInfoIconTo`) — drop its `export` |
| 12 | `src/shared/tool-icons.ts:61-63` | `getToolIcon` | test-only (`icons.test.ts`) | 3 | `TOOL_ICONS` map is live (`v4-app-header.ts`, `welcome-modal.ts`) |
| 13 | `src/shared/social-icons.ts:63-78` | `SOCIAL_ICONS` map + `getSocialIcon` | test-only | 16 | `about-modal.ts:50` builds its **own** `SOCIAL_ICONS`; the 7 `ICON_*` constants are live |
| 14 | `src/services/display-options-helper.ts` | `hasDisplayOptionsChanges`, `getCardDisplayOptions`, `mergeWithDefaults`, type `DisplayOptionsChangeCallback` | test-only | ~60 | `applyDisplayOptions` is live (accessibility/budget tools); trim `display-options-helper.test.ts` (406 lines) accordingly |
| 15 | `src/services/auth-service.ts` | `consumeReturnTool` | test-only | ~10 | verify against `auth-service.test.ts` |

Plus 30 **DROP-EXPORT-ONLY** symbols (used in-file; the `export` keyword is the only dead part): `closeAddToCollectionMenu`, `LanguageModal`, `ThemeModal`, `AuthService`/`PresetSubmissionService` alias-export statements, `HybridPresetService`, `SHARE_URL_VERSION`, `BASE_URL`, `PRODUCTION_ORIGIN`, `EXAMPLE_LINK_HOSTS`, `DEFAULT_CONFIGS`, `ICON_TOOL_EXTRACTOR`, `ICON_TOOL_MIXER`, `SELECTABLE_CATEGORIES`, `MAX_CATEGORIES`, `avatarInitial`, `APP_ENV`, `resolveAppName`, `spectrumKeyForDye`, `IndexedDBService`, `NamespacedStorage`, `CameraService`, `AboutModal`, `ChangelogModal`, `OfflineBanner`, `createInfoIcon`, and the type list in DEAD-014.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH (rows 1-7, 9-13); MEDIUM (row 8 — design choice) |
| **Blast Radius** | LOW — each is self-contained; a few tests need trimming (rows 11-15) |
| **Reversibility** | EASY |
| **Hidden Consumers** | None found — none of these is referenced dynamically (`window.`, `customElements`, string lookup). |

## Recommendation
**REMOVE** rows 1-7, 9-15; **REMOVE WITH CAUTION** row 8 (or leave with a comment stating it is intentionally unused).

### If Removing
1. Delete each function with its JSDoc; for row 8 also delete `_configController` (`v4-layout.ts:39,153,696`)
2. For rows 11-15 delete the corresponding `it()` blocks in `info-tooltip.test.ts`, `icons.test.ts`, `display-options-helper.test.ts`, `auth-service.test.ts`
3. Drop the `export` keyword on the DROP-EXPORT-ONLY list
4. Remove the matching barrel lines (DEAD-011)
5. `pnpm --filter xivdyetools-web-app run type-check test lint`
