# Translation Key Reference

This document details all translation keys needed for the web app localization.

**Note:** Dye names, categories, acquisitions, harmony types, and vision types are provided by the core library (`xivdyetools-core`). This document covers web-app-specific UI strings only.

---

## Key Naming Convention

- Use dot notation for hierarchy: `section.subsection.key`
- Use camelCase for multi-word keys: `baseColor`, `showPrices`
- Keep keys short but descriptive
- Group related keys under common prefixes

---

## Translation Keys by Section

### `app` - Application Global

| Key | English | Description |
|-----|---------|-------------|
| `app.title` | XIV Dye Tools | Main app title |
| `app.loading` | Loading... | Generic loading state |
| `app.error` | An error occurred | Generic error state |
| `app.retry` | Retry | Retry button |
| `app.reload` | Reload Page | Reload button |

### `header` - Header UI

| Key | English | Description |
|-----|---------|-------------|
| `header.tools` | Tools | Tools dropdown label |
| `header.theme` | Theme | Theme dropdown label |
| `header.language` | Language | Language dropdown label |

### `footer` - Footer Content

| Key | English | Description |
|-----|---------|-------------|
| `footer.version` | Version | Version label |
| `footer.createdBy` | Created by Flash Galatine (Balmung) for the FFXIV community | Creator credit |
| `footer.disclaimer` | FINAL FANTASY XIV © 2010-2025 SQUARE ENIX CO., LTD. All Rights Reserved. | Copyright disclaimer |
| `footer.notAffiliated` | XIV Dye Tools is a fan-made application and is not affiliated with or endorsed by Square Enix. | Fan project disclaimer |

### `tools` - Tool Definitions

#### Harmony Tool
| Key | English |
|-----|---------|
| `tools.harmony.title` | Color Harmony Explorer |
| `tools.harmony.shortName` | Harmony |
| `tools.harmony.description` | Generate harmonious color palettes |
| `tools.harmony.subtitle` | Discover harmonious color combinations using color theory. Select a base color to generate classic harmony types. |

#### Matcher Tool
| Key | English |
|-----|---------|
| `tools.matcher.title` | Color Matcher |
| `tools.matcher.shortName` | Matcher |
| `tools.matcher.description` | Match colors from images |
| `tools.matcher.subtitle` | Upload an image or select a color to find the closest matching FFXIV dyes. |

#### Accessibility Tool
| Key | English |
|-----|---------|
| `tools.accessibility.title` | Accessibility Checker |
| `tools.accessibility.shortName` | Vision |
| `tools.accessibility.description` | Simulate colorblindness |
| `tools.accessibility.subtitle` | Check how dye combinations appear to players with different types of color vision. |

#### Comparison Tool
| Key | English |
|-----|---------|
| `tools.comparison.title` | Dye Comparison |
| `tools.comparison.shortName` | Compare |
| `tools.comparison.description` | Compare up to 4 dyes |
| `tools.comparison.subtitle` | Compare dyes side-by-side to see color differences and find the perfect match. |

#### Mixer Tool
| Key | English |
|-----|---------|
| `tools.mixer.title` | Dye Mixer |
| `tools.mixer.shortName` | Mixer |
| `tools.mixer.description` | Find intermediate dyes |
| `tools.mixer.subtitle` | Create smooth color gradients between two dyes and discover intermediate options. |

### `common` - Common UI Elements

| Key | English | Description |
|-----|---------|-------------|
| `common.generate` | Generate | Generate button |
| `common.select` | Select | Select action |
| `common.copy` | Copy | Copy action |
| `common.export` | Export | Export action |
| `common.clear` | Clear | Clear action |
| `common.reset` | Reset | Reset action |
| `common.save` | Save | Save action |
| `common.delete` | Delete | Delete action |
| `common.cancel` | Cancel | Cancel action |
| `common.close` | Close | Close action |
| `common.search` | Search | Search action |
| `common.filter` | Filter | Filter action |
| `common.or` | or | Divider text |
| `common.baseColor` | Base Color | Base color label |
| `common.targetColor` | Target Color | Target color label |
| `common.hexColor` | Hex Color | Hex input label |
| `common.enterHex` | Enter a hex color | Hex input placeholder |
| `common.noResults` | No results found | Empty state |
| `common.loading` | Loading... | Loading state |
| `common.showMore` | Show More | Expand action |
| `common.showLess` | Show Less | Collapse action |
| `common.selectDye` | Select a dye | Dye selector placeholder |
| `common.noDyeSelected` | No dye selected | Empty dye state |

### `harmony` - Harmony Tool Specific

| Key | English | Description |
|-----|---------|-------------|
| `harmony.suggestionMode` | Suggestion Mode | Mode selector label |
| `harmony.simple` | Simple Suggestions | Simple mode name |
| `harmony.simpleDesc` | Strict harmony with precise dye matching | Simple mode description |
| `harmony.expanded` | Expanded Suggestions | Expanded mode name |
| `harmony.expandedDesc` | Additional similar dyes per harmony color | Expanded mode description |
| `harmony.companionDyes` | Additional Dyes per Harmony Color | Companion slider label |
| `harmony.companionDyesDesc` | Choose how many additional companion dyes to show | Companion slider description |
| `harmony.baseColorSection` | Base Color | Section heading |
| `harmony.harmonyResults` | Harmony Results | Results heading |
| `harmony.selectBaseColor` | Select a base color to generate harmonies | Empty state message |
| `harmony.generatingHarmonies` | Generating harmonies... | Loading state |

### `matcher` - Matcher Tool Specific

| Key | English | Description |
|-----|---------|-------------|
| `matcher.uploadImage` | Upload Image | Upload section label |
| `matcher.dragDrop` | Drag and drop an image here | Drag area text |
| `matcher.orClickBrowse` | or click to browse | Browse prompt |
| `matcher.supportedFormats` | Supported formats: PNG, JPG, GIF, WebP | Format hint |
| `matcher.privacyNote` | Images never leave your browser | Privacy note |
| `matcher.pickFromImage` | Pick from Image | Color picker label |
| `matcher.sampleSize` | Sample Size | Sample size label |
| `matcher.sampleSizeDesc` | Larger sizes produce more accurate color matching | Sample size description |
| `matcher.matchedDyes` | Matched Dyes | Results heading |
| `matcher.bestMatch` | Best Match | Best match label |
| `matcher.similarDyes` | Similar Dyes | Similar dyes heading |
| `matcher.distance` | Distance | Color distance label |
| `matcher.clickToSample` | Click on the image to sample a color | Instruction |
| `matcher.zoomIn` | Zoom In | Zoom control |
| `matcher.zoomOut` | Zoom Out | Zoom control |
| `matcher.zoomFit` | Fit | Zoom control |
| `matcher.zoomWidth` | Width | Zoom control |
| `matcher.zoomReset` | Reset | Zoom control |

### `accessibility` - Accessibility Tool Specific

| Key | English | Description |
|-----|---------|-------------|
| `accessibility.selectDyes` | Select Dyes | Section heading |
| `accessibility.selectUpTo` | Select up to {count} dyes to check accessibility | Instruction |
| `accessibility.visionSimulation` | Vision Simulation | Section heading |
| `accessibility.individualAnalysis` | Individual Dye Analysis | Section heading |
| `accessibility.pairComparisons` | Dye Pair Comparisons | Section heading |
| `accessibility.overallScore` | Overall Accessibility Score | Score heading |
| `accessibility.contrastScore` | Contrast Score | Score label |
| `accessibility.wcagAA` | WCAG AA | Standard label |
| `accessibility.wcagAAA` | WCAG AAA | Standard label |
| `accessibility.pass` | Pass | Status |
| `accessibility.fail` | Fail | Status |
| `accessibility.warning` | Warning | Status |
| `accessibility.issuesFound` | {count} issues found | Issue count |
| `accessibility.noIssues` | No accessibility issues | Success state |

### `comparison` - Comparison Tool Specific

| Key | English | Description |
|-----|---------|-------------|
| `comparison.selectDyes` | Select Dyes to Compare | Section heading |
| `comparison.selectUpTo` | Select up to {count} dyes | Instruction |
| `comparison.sideBySide` | Side-by-Side Comparison | Section heading |
| `comparison.colorValues` | Color Values | Section heading |
| `comparison.rgbValues` | RGB Values | Label |
| `comparison.hsvValues` | HSV Values | Label |
| `comparison.hexValue` | Hex Value | Label |

### `mixer` - Mixer Tool Specific

| Key | English | Description |
|-----|---------|-------------|
| `mixer.startColor` | Start Color | Input label |
| `mixer.endColor` | End Color | Input label |
| `mixer.interpolationSteps` | Interpolation Steps | Slider label |
| `mixer.colorSpace` | Color Space | Select label |
| `mixer.gradient` | Gradient | Section heading |
| `mixer.intermediateDyes` | Intermediate Dyes | Section heading |
| `mixer.selectTwoDyes` | Select two dyes to see interpolation | Empty state |
| `mixer.savedGradients` | Saved Gradients | Section heading |
| `mixer.saveGradient` | Save Gradient | Button label |
| `mixer.noSavedGradients` | No saved gradients | Empty state |
| `mixer.gradientSaved` | Gradient saved! | Success message |

### `filters` - Dye Filter UI

| Key | English | Description |
|-----|---------|-------------|
| `filters.title` | Dye Filters | Section heading |
| `filters.category` | Category | Filter label |
| `filters.allCategories` | All Categories | Default option |
| `filters.excludeExpensive` | Exclude Expensive Dyes | Checkbox label |
| `filters.excludeMetallic` | Exclude Metallic Dyes | Checkbox label |
| `filters.excludeCosmic` | Exclude Cosmic Dyes | Checkbox label |
| `filters.excludeSpecial` | Exclude Special Dyes | Checkbox label |
| `filters.showOnlyMetallic` | Show Only Metallic | Checkbox label |
| `filters.resetFilters` | Reset Filters | Button label |

### `marketBoard` - Market Board UI

| Key | English | Description |
|-----|---------|-------------|
| `marketBoard.title` | Market Board Prices | Section heading |
| `marketBoard.dataCenter` | Data Center | Select label |
| `marketBoard.world` | World | Select label |
| `marketBoard.selectWorld` | Select a world | Placeholder |
| `marketBoard.priceCategories` | Price Categories | Section heading |
| `marketBoard.baseDyes` | Base Dyes | Category |
| `marketBoard.craftDyes` | Craft Dyes | Category |
| `marketBoard.alliedSocietyDyes` | Allied Society Dyes | Category |
| `marketBoard.cosmicDyes` | Cosmic Dyes | Category |
| `marketBoard.specialDyes` | Special Dyes | Category |
| `marketBoard.refresh` | Refresh Prices | Button label |
| `marketBoard.lastUpdated` | Last updated: {time} | Timestamp |
| `marketBoard.priceUnavailable` | Price unavailable | Empty state |
| `marketBoard.fetchingPrices` | Fetching prices... | Loading state |

### `export` - Export Dialog

| Key | English | Description |
|-----|---------|-------------|
| `export.title` | Export Palette | Dialog title |
| `export.format` | Format | Select label |
| `export.json` | JSON | Format option |
| `export.css` | CSS Variables | Format option |
| `export.text` | Plain Text | Format option |
| `export.copyToClipboard` | Copy to Clipboard | Button label |
| `export.download` | Download | Button label |
| `export.preview` | Preview | Section heading |

### `errors` - Error Messages

| Key | English |
|-----|---------|
| `errors.invalidHex` | Invalid hexadecimal color format. Use #RRGGBB. |
| `errors.invalidRgb` | RGB values must be between 0 and 255. |
| `errors.dyeNotFound` | Dye not found in database. |
| `errors.databaseLoadFailed` | Failed to load dye database. Please refresh the page. |
| `errors.apiFailed` | Failed to fetch data from market board. |
| `errors.networkError` | Network connection error. Please check your internet connection. |
| `errors.imageLoadFailed` | Failed to load image. Please ensure it is a valid image file. |
| `errors.imageTooLarge` | Image file is too large. Maximum size is 10MB. |
| `errors.unsupportedFormat` | Unsupported file format. |
| `errors.clipboardFailed` | Failed to copy to clipboard. |
| `errors.storageFailed` | Failed to save settings. Storage may be full. |

### `success` - Success Messages

| Key | English |
|-----|---------|
| `success.copiedToClipboard` | Copied to clipboard! |
| `success.exported` | Data exported successfully! |
| `success.settingsSaved` | Settings saved! |
| `success.gradientSaved` | Gradient saved! |

### `themes` - Theme Display Names

| Key | English |
|-----|---------|
| `themes.standardLight` | Standard (Light) |
| `themes.standardDark` | Standard (Dark) |
| `themes.hydaelynLight` | Hydaelyn |
| `themes.ogClassicDark` | OG Classic |
| `themes.parchmentLight` | Parchment |
| `themes.cottonCandy` | Cotton Candy |
| `themes.sugarRiot` | Sugar Riot |
| `themes.grayscaleLight` | Grayscale (Light) |
| `themes.grayscaleDark` | Grayscale (Dark) |

---

## String Interpolation

Some strings contain placeholders for dynamic values:

| Placeholder | Usage | Example |
|-------------|-------|---------|
| `{count}` | Numeric count | "Select up to {count} dyes" → "Select up to 12 dyes" |
| `{time}` | Timestamp | "Last updated: {time}" → "Last updated: 2 minutes ago" |
| `{author}` | Author name | "Created by {author}" |

### Implementation

```typescript
// Simple interpolation helper
function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}

// Usage
const message = interpolate(LanguageService.t('accessibility.selectUpTo'), { count: 12 });
// → "Select up to 12 dyes"
```

---

## Total Key Count

| Section | Count |
|---------|-------|
| app | 5 |
| header | 3 |
| footer | 4 |
| tools (5 tools × 4 keys) | 20 |
| common | 25 |
| harmony | 12 |
| matcher | 20 |
| accessibility | 15 |
| comparison | 10 |
| mixer | 12 |
| filters | 10 |
| marketBoard | 15 |
| export | 8 |
| errors | 11 |
| success | 4 |
| themes | 9 |
| **Total** | **~183** |

*Note: Actual count may vary slightly during implementation as we discover additional strings.*
