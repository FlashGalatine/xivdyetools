# Agent report — i18n unused-key verification

**Bottom line:** of the 632 candidate keys in `i18n-unused-keys-full.txt`, **472 are DEAD with high confidence** and **160 are false positives (actually used)**. Removing the 472 from all six locales saves **~131 KB raw JSON (~26 % of every locale file)**.

## (A) Key-lookup patterns

The entire surface is `LanguageService` — no i18n framework, no `keyPrefix`/`namespace`, no plural forms.

| # | Pattern | Definition / example |
|---|---|---|
| 1 | `LanguageService.t(key)` | `language-service.ts:171` — dot-path via `getNestedValue` (`:348`); missing → `logger.warn` + returns the key |
| 2 | `LanguageService.tInterpolate(key, params)` | `:196` |
| 3 | Core-library proxies (**not** locale-JSON keys) | `getDyeName/getCategory/getAcquisition/getCurrency/getHarmonyType/getVisionType/getLabel/getRace/getClan` (`:213–275`) read `@xivdyetools/core` data |
| 4 | Prefixed local `t()` wrappers | `metric-help.ts:137` → `` `accessibility.${key}` ``; `:300` and `comparison-tool.ts:1580,:1688` → `` `comparison.${key}` ``; `chara-import.ts:184-185` → `` `swatch.${key}` `` |
| 5 | Suffix templates | `metric-help.ts:152/167/173/211` `` `${def.stem}Label|Desc|Caveat|Short` ``; `:285/311/323/329`; `accessibility-tool.ts:1464`; `harmony-generator.ts:100` `` `harmony.types.${camelCaseKey}Desc` `` |
| 6 | Infix templates | `accessibility-tool.ts:1348` `` `accessibility.visionDesc${Cap}` ``; `mixer-tool.ts:1284` `` `mixer.model${Model}` `` |
| 7 | Whole-prefix-is-a-variable | `v4-app-header.ts:533/534/564/565/588` `` `${tool.translationKey}.title|.shortName|.description` `` — **biggest source of false positives** |
| 8 | Two-variable | `shared/preset-i18n.ts:28` `` `preset.${id}.${field}` ``, `field: 'name' \| 'description'` |
| 9 | Static key maps | `preset-i18n.ts:58`, `dye-palette-drawer.ts:50`, `dye-action-dropdown.ts:142-172`, `swatch-tool.ts:1714-1720`, `welcome-modal.ts:38-72`, `tutorial-service.ts`, `preset-tool.ts:923`, `comparison-tool.ts:110`, `metric-help.ts:293` — all string literals |
| 10 | Decoys (not translation keys) | `config-sidebar.ts:875,909` `` `displayOptions.${option}` `` / `` `dyeFilters.${filter}` `` — event payload names |
| 11 | Dead template | `swatch-tool.ts:3103` `_key` (unused) — the `tools.character.` "dynamic prefix" in the evidence file is spurious |

No string-concatenation key building exists. **No consumer of `apps/web-app/src/locales/*.json` outside web-app** (`language-service.ts:326,335`, `scripts/validate-i18n.js`, `check-bundle-size.js:47` dir listing). Core and bot-logic have separate locale sets. Safe to prune without cross-app coordination.

## (B) Dynamic-prefix analysis (LOW tier, 310 keys → 168 dead / 142 reachable)

| Prefix | Producing template | Value set | LOW keys | Reachable | NOT reachable (dead) |
|---|---|---|---|---|---|
| `accessibility.` | `metric-help.ts:137,152-211`, `accessibility-tool.ts:1464,1348` | stems `unitPct,unitRatio,unitDe`; literals `notAStandard,learnMore,tier{Clear,Fine,Tight,Collapsed}`; vision ids `normal,deuteranopia,protanopia,tritanopia,achromatopsia` | 45 | 23 | **22**: `colorblindnessIssues, contrastBetween, contrastRatios, distinguishabilityByVision, distinguishable, dyesSelected, fail, individualAnalysis, level, pairComparisons, pass, selectDyes, selectTwoDyes, selectUpTo, selectedDyes, visionSimulation, visionTypesEnabled, vsBlack, vsWhite, warning, wcagAA, wcagAAA` |
| `comparison.` | `comparison-tool.ts:1232,1580,1688`, `metric-help.ts:285-329` | `TIER_KEYS` = `tierSame,tierClose,tierNear,tierFar`; `METHOD_STEM` = `mCiede2000,mOklab,mCie76,mRedmean,mRgb,mDistinguish` × `{Label,Desc,Caveat,Short}`; `kind0/1/2`; literals `badgeSame,badgeClose,badgeWide,costSame,whatDiffers,delta{Hue,Light,Sat,Source,Vendor},differs,same,methodsLearnMore` | 74 | 44 | **30**: `avgBrightness, avgDistance, avgSaturation, brightnessDistribution, chart.brightnessAxis, chart.brightnessDesc, chart.brightnessTitle, chart.hueAxis, chart.hueSaturationDesc, chart.hueSaturationTitle, chart.saturationAxis, colorDistanceMatrix, colorValues, comparing, copyHexCodes, hexValue, hsvValues, hueRange, hueSaturationPlot, matrix.description, matrix.selectDyes, matrix.title, rgbValues, selectDyes, selectToSeeAnalysis, selectUpTo, selected, showPriceComparison, sideBySide, statistics` |
| `harmony.` | `color-wheel-display.ts:69` `` `harmony.${this.harmonyType}` `` | `HARMONY_TYPE_IDS` (10 ids) | 14 | 0 | **all 14**: `acquisition, expanded, expandedDesc, generatingHarmonies, harmonyResults, noColorSelected, noDyeSelected, selectBaseColor, selectColorAction, selectColorMessage, selectDyePrompt, simple, simpleDesc, suggestionMode` |
| `harmony.types.` | `harmony-generator.ts:100` | same 10 ids camel-cased | 10 | 10 | none |
| `preset.` | `preset-i18n.ts:28` | 15 curated ids × `{name,description}` only | 115 | 30 | **85**: 58 `preset.<id>.tags.N` (no `tags` field ever requested) + 27 two-segment keys (`account, allPresets, browse, categoriesTitle, category, categoryLocked, dyesCounter, editPreset, featured, fieldCategoryHint, loadMore, loadingSubmissions, loginPrompt, notFound, previewImageReplace, saveChanges, search, searchPlaceholder, sortBy, submissions, submitForReview, submitPresetHint, tab, vendorLabel, viewMySubmissions, voteCount, votesCount`) |
| `swatch.` | `chara-import.ts:184-185` | the 34 literals passed to `this.t()` | 43 | 31 | **12**: `charaFile, hexInvalid, hexPlaceholder, matchLine, orDye, pickColour, shortEyes, shortHair, shortHighlights, shortLip, shortPaint, shortSkin` |
| `themes.` | `theme-modal.ts:130` | `standardLight, standardDark` | 2 | 2 | none |
| `tools.character.` | `v4-app-header.ts:533/534/565` (`translationKey: 'tools.character'`) | `{title, shortName, description}` | 7 | 2 | **5**: `clickToSelect, colorIndex, matchingDyes, selectedColor, subtitle` |

## (C) MEDIUM / MEDIUM-HIGH verdicts (all 146 checked)

**`tools.*` is consumed dynamically** via `v4-app-header.ts:53-62` — every `tools.<x>.{title,shortName,description}` is live (accounts for all 12 MEDIUM/M-H false positives). `.subtitle` has no consumer → all 9 `tools.*.subtitle` dead.

| Namespace | Verdict | Representative evidence |
|---|---|---|
| `preset.*` | DEAD | last segments are coincidental prop names (`dye-grid.ts:25` `'search' \| 'category'`, `role: 'tab'`) |
| `mixer.*` | DEAD except `mixer.model{Rgb,Lab,Oklab,Ryb,Hsl,Spectral}` (live via `mixer-tool.ts:1284`) | `mixer.dyeA/dyeB` → `share-service.ts:617-618` URL params; `mixer.selectDye` → `v4-layout.ts:194` `'selectDye' in activeTool`; `mixer.quickActions` → live key is `shortcuts.quickActions` |
| `config.*` (33) | DEAD — every one duplicates a live key elsewhere or is an identifier | `config.eyeColors…` → live `tools.character.*`; `config.jobs/seasons/…` → live `preset.categories.*`; `config.allCategories` → `dyeSelector.allCategories`; **no `config.mixing${Mode}` template exists** |
| `matcher.*` (43) | DEAD — whole legacy namespace (tool renamed matcher→extractor; `tools.matcher.*` survived via `translationKey`, body namespace did not) | segments hit private field names in `extractor-tool.ts` |
| `budget.*` | DEAD | `budget.sortBy` → live `dyeSelector.sortBy`; no `budget.sort${X}` template |
| `common.*` (26) | DEAD | canonical strings live in other namespaces (`success.copiedToClipboard`, `dyeSelector.noResults`, `shortcuts.closeModal`) |
| `gradient.*` | DEAD — flat legacy `gradient.modeRgb` shape; live shape is nested `gradient.mode.rgb` (`gradient-tool.ts:937-941`) | |
| `palette.*`, `errors.*`, `auth.*`, `collections.*`, `app.*`, `filters.*`, `marketBoard.*`, `success.*`, singletons | DEAD | `error-handler.ts` has no `errors.*` lookups; `auth.loginWithDiscord` → live `config.loginWithDiscord`; etc. |

## (D) HIGH-tier confirmation

20 sampled keys full-text-grepped over the whole `apps/web-app` tree (incl. `e2e/`, `scripts/`, `assets/`, `*.md`, `*.html`) — all absent. Then the exact-literal regex was run over **all 472** final dead keys across every `.ts/.tsx/.js/.mjs/.html` in `apps/web-app`: **0 hits**. No unit/e2e test references any of them.

**HIGH-tier false positives (6):** `mixer.model{Rgb,Lab,Oklab,Ryb,Hsl,Spectral}` — `mixer-tool.ts:1284`. The six `mixer.model*Desc` siblings ARE dead.

### Full DEAD list — 472 keys, grouped by namespace

**preset (85)** — `account, allPresets, browse, categoriesTitle, category, categoryLocked, dyesCounter, editPreset, featured, fieldCategoryHint, loadMore, loadingSubmissions, loginPrompt, notFound, previewImageReplace, saveChanges, search, searchPlaceholder, sortBy, submissions, submitForReview, submitPresetHint, tab, vendorLabel, viewMySubmissions, voteCount, votesCount` + all `<id>.tags.N` for `event-allsaints(0-3), event-hatching(0-3), event-heavensturn(0-2), event-littleladies(0-3), event-moonfire(0-3), event-rising(0-2), event-starlight(0-3), event-valentione(0-3), gc-adders(0-3), gc-flames(0-3), gc-maelstrom(0-3), season-autumn(0-3), season-spring(0-3), season-summer(0-3), season-winter(0-3)`

**mixer (67)** — `avgDistance, bestMatch, clickStopHint, closestDye, colorGradient, colorSpaceHint, colorSpaceHsv, colorSpaceRgb, colorTransition, copyShareUrl, copyUrlFailed, coverage, delete, deleteFailed, distance, distanceExplanation, distanceHint, dyeA, dyeB, dyeNotFoundInDb, end, excellentMatch, fairMatch, goodMatch, gradientDeleted, gradientNotFound, gradientSaved, gradientSavedSuccess, intermediateDyeMatches, intermediateDyes, interpolationPreview, interpolationSteps, load, loadFailed, loadedGradient, matched, maxDistance, mixLabel, modelHslDesc, modelLabDesc, modelOklabDesc, modelRgbDesc, modelRybDesc, modelSpectralDesc, nameYourGradient, noCloseMatch, noInterpolationData, noSavedGradientsHint, poorMatch, qualityScale, quickActions, ratioDesc, saveFailed, saveGradient, savedGradients, selectColor, selectDye, selectDyesToSave, selectDyesToShare, selectStartEnd, selectStartEndDyes, start, stepsHint, targetColor, transitionQuality, understandingDistance, urlCopied`

**matcher (43)** — `bestMatch, colorCountDesc, coloursDesc, coloursToExtract, copiedHex, copyHex, dominance, dropImageHere, extractPaletteBtn, extractedColor, extractionMode, imageColorPicker, imageTooLarge, imageUpload, manualColorInput, matchedDye, noColorSelected, orClickBrowse, orEnterHex, paletteMode, paletteModeDesc, paletteResults, pasteFromClipboard, pasteNotSupported, pickFromImage, privacyNoteFull, privacyNoticeHtml, samplePreview, sampleSettings, sampleSizeDesc, sampled, sampledColor, selectedColor, similarDyes, similarDyesCount, singleColor, singleColorDesc, supportedFormats, uploadPrompt, vibrancy, vibrancyDesc, zoomIn, zoomOut`

**config (33)** — `aesthetics, allCategories, alphabetical, budgetLimit, category, character, colorDistance, colorSheet, community, events, eyeColors, facePaintDark, facePaintLight, filters, grandCompanies, hairColors, highlightColors, hsvHueBased, jobs, lipColorsDark, lipColorsLight, maxDeltaE, maxPrice, mostPopular, mostRecent, rgbDirect, seasons, showDeltaE, showFavorites, showMyPresetsOnly, skinColors, sortBy, tattooColors`

**comparison (30)** — `avgBrightness, avgDistance, avgSaturation, brightnessDistribution, chart.brightnessAxis, chart.brightnessDesc, chart.brightnessTitle, chart.hueAxis, chart.hueSaturationDesc, chart.hueSaturationTitle, chart.saturationAxis, colorDistanceMatrix, colorValues, comparing, copyHexCodes, hexValue, hsvValues, hueRange, hueSaturationPlot, matrix.description, matrix.selectDyes, matrix.title, rgbValues, selectDyes, selectToSeeAnalysis, selectUpTo, selected, showPriceComparison, sideBySide, statistics`

**budget (29)** — `alternativeWithinBudget, alternativesFound, alternativesWithinBudget, budget, budgetLimit, budgetOptions, colorDistance, distanceDesc, findCheaperTooltip, loading, marketPrice, maxDistance, maxPrice, maxResults, noDyesWithinBudget, quickPicks, save, selectedDye, showingXOfY, sortBy, sortMatch, sortMatchDesc, sortPrice, sortPriceDesc, sortValue, sortValueDesc, sortedBy, target, tryIncreasingBudget`

**common (26)** — `baseColor, closeModal, copiedToClipboard, copy, copyFailed, download, downloaded, dye, dyes, enterHex, filter, full, generate, loading, match, noDyeSelected, noResults, or, recommended, search, select, showLess, showMore, source, targetColor, technical`

**tools (23)** — `accessibility.subtitle, budget.budgetOptions, budget.findCheaperTooltip, budget.subtitle, character.clickToSelect, character.colorIndex, character.matchingDyes, character.selectedColor, character.subtitle, comparison.subtitle, gradient.subtitle, harmony.subtitle, matcher.subtitle, mixer.subtitle, presets.allCategories, presets.colorsInPalette, presets.communityDescription, presets.communityTitle, presets.dyes, presets.noPresets, presets.searchPlaceholder, presets.subtitle, presets.tags`

**accessibility (22)** — `colorblindnessIssues, contrastBetween, contrastRatios, distinguishabilityByVision, distinguishable, dyesSelected, fail, individualAnalysis, level, pairComparisons, pass, selectDyes, selectTwoDyes, selectUpTo, selectedDyes, visionSimulation, visionTypesEnabled, vsBlack, vsWhite, warning, wcagAA, wcagAAA`

**gradient (16)** — `endColour, endpoints, idealLabel, interpolation, matchedLabel, modeHsv, modeHsvDesc, modeLab, modeLabDesc, modeLch, modeLchDesc, modeOklch, modeOklchDesc, modeRgb, modeRgbDesc, startColour`

**palette (15)** — `confirmDelete, deleted, export, import, importFailed, imported, invalidFile, load, loaded, name, noPalettes, preview, saveHint, savedCount, savedPalettes`

**harmony (14)** — `acquisition, expanded, expandedDesc, generatingHarmonies, harmonyResults, noColorSelected, noDyeSelected, selectBaseColor, selectColorAction, selectColorMessage, selectDyePrompt, simple, simpleDesc, suggestionMode`

**errors (12)** — `clipboardFailed, databaseLoadFailed, dyeNotFound, failedToDeletePreset, failedToLoadSubmissions, invalidHex, invalidRgb, networkError, noPixelsInRegion, regionTooSmall, storageFailed, unsupportedFormat`

**filters (12)** — `advancedFilters, allCategories, category, excludeCosmicDesc, excludeDarkDesc, excludeExpensiveDesc, excludeMetallicDesc, excludePastelDesc, excludeSpecial, resetFilters, showOnlyMetallic, title`

**swatch (12)** — `charaFile, hexInvalid, hexPlaceholder, matchLine, orDye, pickColour, shortEyes, shortHair, shortHighlights, shortLip, shortPaint, shortSkin`

**marketBoard (8)** — `dataCenter, fetchingPrices, lastUpdated, selectWorld, standardSpectrumDye, wideSpectrum1Dye, wideSpectrum2Dye, world`
**auth (5)** — `loginWithDiscord, loginWithXIVAuth, logout, userMenu, verified`
**collections (5)** — `collections, collectionsFull, favoritesCount, favoritesEmpty, removeFromCollection`
**app (5)** — `error, loading, reload, retry, title`
**success (3)** — `exported, gradientSaved, settingsSaved`
**singletons (7)** — `aria.refreshSubmissions, colorPalette.neutral, dyeSelector.randomDyeSelected, footer.version, header.tools, offline.pricesUnavailable, resultCard.categoryShort`

### False positives — 160 keys the evidence file wrongly flagged

| Tier | Count | Keys | Consumer |
|---|---|---|---|
| HIGH | 6 | `mixer.model{Rgb,Lab,Oklab,Ryb,Hsl,Spectral}` | `mixer-tool.ts:1284` |
| MEDIUM-HIGH | 2 | `tools.harmony.shortName`, `tools.matcher.shortName` | `v4-app-header.ts:534` |
| MEDIUM | 10 | `tools.{harmony,matcher,accessibility,comparison,gradient,mixer,presets,budget}.description`, `tools.budget.title`, `tools.presets.title` | `v4-app-header.ts:533/564/565/588` |
| LOW | 142 | `accessibility.*` 23, `comparison.*` 44, `harmony.types.*Desc` 10, `preset.<15 ids>.{name,description}` 30, `swatch.*` 31, `themes.standard{Light,Dark}` 2, `tools.character.{title,description}` 2 | see (B) |

## (E) `tutorial.*` — NOT dead
All 47 `tutorial.*` keys are referenced as string literals: `tutorial-service.ts` (36 via `titleKey`/`descriptionKey`), `tutorial-spotlight.ts:341,381,409,435,436`, `tutorial.prompt.*` (5). The service is live-wired (`tutorial-spotlight.ts:125-455`, `advanced-options-panel.ts:19/282`). The prior "36 unused tutorial keys" claim is stale.

## (F) Test / parity implications
**No test changes required.** No locale-parity or key-count test exists in Vitest. `scripts/validate-i18n.js`: removing the 472 keys from all six locales → PASS; from `en.json` only → also PASS (it only iterates en's keys — five files would keep invisible orphans; not recommended); from non-en only → exit 2 under `--strict`. Not wired into CI. The validator's regex only understands quoted-literal calls — it would NOT catch deleting a dynamically-reached key (any of the 160 false positives); failure mode is a raw dot-path in the UI + `logger.warn`. `check-bundle-size.js` charges only the largest locale chunk; a 26 % shrink only creates headroom.

## (G) Byte savings (pruned in memory, re-serialised with indent=2)

| Locale | On disk | After | Saved | % |
|---|---:|---:|---:|---:|
| en | 77,436 | 57,204 | 20,231 | 26.1 |
| ja | 91,788 | 67,526 | 24,261 | 26.4 |
| de | 83,913 | 61,936 | 21,976 | 26.2 |
| fr | 87,677 | 64,436 | 23,240 | 26.5 |
| ko | 85,389 | 63,301 | 22,087 | 25.9 |
| zh | 74,459 | 55,034 | 19,424 | 26.1 |
| **Total** | **500,662** | **369,437** | **131,219 (~128 KB)** | **26.2** |

Per visitor: only the active locale (+ `en` fallback for non-en) is loaded — a Japanese visitor saves ~44.5 KB raw (~10-13 KB gzipped); an English visitor ~20 KB raw.
