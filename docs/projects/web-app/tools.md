# Web App Tools (v5.0.0)

The XIV Dye Tools web app ships nine tools. Each has its own route, a `ToolId`, a config shape in `ConfigController`, and (for eight of the nine) a share-URL grammar. In 5.0 every tool was re-ported to its confirmed design spec (`docs/research/monorepo-2.0/*-port-spec.md`) on the console shell described in [Components](components.md). This page is the developer reference: which files, what the port did, the config shape, the share params, matching-method handling, and the routes. Ground truth is the code under `apps/web-app/src/`.

---

## Cross-cutting facts (read first)

**How a tool is mounted.** `src/components/v4-layout.ts` `loadToolContent()` lazy-imports the tool module on navigation and mounts it into `.v4-layout-content-scroll` *inside `v4-layout-shell`'s shadow root* (not a slot). Eight tools are imperative `BaseComponent` subclasses (`new HarmonyTool(container, { leftPanel, rightPanel, drawerContent: null })` then `.init()`); Community Presets is a Lit element (`<v4-preset-tool>`) appended directly. Because tool DOM lives in a shadow root, `styles/globals.css` and document-level Tailwind never reach it — tools use inline styles, and the two shared rules (`.v5-results-grid`, empty states) are injected by `v4-layout.ts` into the shell's shadow root. `leftPanel === rightPanel` in the v4 shell, so every tool renders one main flow; configuration lives in the config sidebar / Advanced Options, not in the tool.

**Picking dyes.** The palette drawer (`v4/dye-palette-drawer.ts`) is the app's dye picker. The shell routes `dye-selected` to the active tool's `selectDye(dye)` (or `addDye`) and `custom-color-selected` to `selectCustomColor(hex)`. The drawer is hidden for `extractor` and `presets` (`V4LayoutShell.TOOLS_WITHOUT_PALETTE`); its **Custom Color** section is shown for harmony, gradient, mixer, swatch, accessibility, comparison and budget (`DyePaletteDrawer.TOOLS_WITH_CUSTOM_COLOR`). A custom colour is a virtual dye with `stainID: null` — never persisted to a collection, never shared as `dye=0`.

**Config.** Each tool's shape is an interface in `src/shared/tool-config-types.ts`, keyed by `ToolId` in `ToolConfigMap` (plus `global`, `market`, `advanced`). `ConfigController.getInstance().getConfig('harmony')` / `setConfig()` / `subscribe()`; persisted per key under `xivdyetools_v4_config_<key>` and merged over `DEFAULT_CONFIGS` on load. Every tool config carries `displayOptions: DisplayOptionsConfig` (result-card rows: `showHex/Rgb/Hsv/Lab/Cmyk`, `showPrice`, `showAcquisition`, 5.0 `showHue/showStain/showSpectrum`; `showDeltaE` is deprecated — the ΔE2000 verdict is structural) and most carry `dyeFilters: DyeFiltersConfig` (`Required<DyeTypeFilters>` + the web-only `excludeCoffers`).

**Matching method.** One vocabulary from `@xivdyetools/core` — `ciede2000` (default) · `oklab` · `cie76` · `redmean` · `rgb` · `distinguish`. The config sidebar's "Matching Algorithm" select lists them as `ΔE2000 - Default`, `ΔEOK - Perceptual`, `ΔE76 - Fast`, `REDMEAN - Weighted RGB`, `RGB DIST - Basic`, `DISTINGUISH % - Percentage` (`config.matching*` keys). Retired 4.x values (`hyab`, `oklch-weighted`, swatch's `euclidean`) are normalised through core's `normalizeMatchingMethod` in three places: `ConfigController.loadFromStorage()` (persisted configs), each tool's init (`normalizeMatchingMethod(config.matchingMethod ?? 'ciede2000')`), and the `algo` share param. Tools dispatch distance through `ColorService.getDistanceForMethod`; the result card's verdict is **always ΔE2000** regardless of the ordering method. `matchingMethod` exists on harmony, extractor, gradient, mixer, budget and swatch; comparison and accessibility have none (comparison shows all six as readouts).

**Share URLs** (`src/services/share-service.ts`, `v4/share-button.ts`; Shift+S shares the active tool). `ShareService.generateUrl({ tool, params })` builds `https://xivdyetools.app/<tool>/?…&v=1`. Grammar since 5.0: every dye-class param (`dye`, `dyes`, `start`/`end`, `dyeA`/`dyeB`) is a **stainID (1–254)**; `ShareService.resolveSharedDye()` rejects legacy itemIDs (≥ 5729, a disjoint range) and unknown values *loudly* — toast `share.legacyLink` / `share.invalidDye`, never a fallback dye. Bare colours travel as `hex`-class params (`RRGGBB`, `#` optional; `ShareService.parseSharedHex()` → `share.invalidHex`), mutually exclusive with the slot's dye param. Booleans are `1`/`0`, arrays comma-separated; `ShareService.parseUrl()` coerces numbers/booleans/arrays on read. The `ShareParams` interfaces are the declared grammar; the per-tool tables below list what each tool actually reads/writes today.

**Result cards, export, saving.** Matches render as `<v4-result-card>` (5B ticket, see Components). Extractor, Gradient, Comparison and Mixer open the shared export sheet (`components/export-sheet.ts` — CSS custom properties / SCSS / JSON / HEX / Tailwind `@theme`). "Save" actions write `CollectionService` records with a `kind`: `palette` (mixer "Save mix"), `swap` (budget "Save swap"), `character` (swatch "Save character colours"). Every stored dye ref is a stainID.

---

## 1. Harmony Explorer — 1A dial

**Route:** `/harmony` · **ToolId:** `harmony` · **Files:** `src/components/harmony-tool.ts` (`HarmonyTool`), `v4/v4-color-wheel.ts` (`<v4-color-wheel>`), `harmony-result-panel.ts`, `harmony-type.ts`, `color-wheel-display.ts`, `services/harmony-generator.ts` (`HARMONY_OFFSETS`, `findHarmonyDyes`, `findClosestDyesToHue`). Spec: `1a-dial-port-spec.md`.

**What 5.0 shipped.** The hero wheel is the control: 42 px tappable slot pucks (tap jumps the base to the nearest dye), a 114 px hub button that names the base and opens the palette drawer (`open-palette-drawer` event), the wheel mirroring the result grid (dedup + user swaps). An icon rail of every harmony type sits over the wheel (single scrolling row with a first-run `harmony.railSwipeHint` "SWIPE FOR MORE" below 768 px) and stays in sync with the sidebar through `ConfigController` (two-way — the sidebar subscribes to `harmony`). Ten harmony types: complementary, analogous, triadic, split-complementary, tetradic (a rectangle now), **inverted-tetradic** (new, offsets 120/180/300), square, monochromatic, compound, shades — the last three finally draw nodes. Each result card carries **companion alternates** as 22 px swatch dots with one-tap slot swap (`HarmonyConfig.companionDyesCount`, 1–5 slider "Additional Dyes per Harmony Color"). Custom base colours are accepted (drawer's Custom Color). One dismissible market-failure strip replaces the per-card dash. The 4.x `PaletteExporter` and the orphaned left-panel companion slider are gone.

**Config (`HarmonyConfig`):** `harmonyType`, `strictMatching` (perceptual ΔE matching instead of hue-based), `matchingMethod` (default `ciede2000`), `preventDuplicates` (default on), `companionDyesCount`, `displayOptions`, `dyeFilters` (+ deprecated `showHex/Rgb/Hsv/Lab` migration fields).

**Share params** (read via `URLSearchParams`, written by `getShareParams()`):

| Param | Meaning |
|-------|---------|
| `dye` | base stainID (`resolveSharedDye`) |
| `hex` | bare-colour base (`RRGGBB`), used only when `dye` is absent → `selectCustomColor()` |
| `harmony` | harmony type id (validated against the known list) |
| `algo` | matching method (`normalizeMatchingMethod`, synced to `ConfigController`) |
| `perceptual` | `1`/`true`/`yes` → `strictMatching` |

---

## 2. Palette Extractor — 3C loupe

**Route:** `/extractor` (legacy `/matcher` redirects) · **ToolId:** `extractor` · **Files:** `src/components/extractor-tool.ts` (`ExtractorTool`), `image-upload-display.ts`, `image-zoom-controller.ts`, `color-picker-display.ts`, `recent-colors-panel.ts`, `camera-preview-modal.ts`, `services/camera-service.ts`, `services/indexeddb-service.ts` (image persistence). Spec: `3c-loupe-port-spec.md`. Locale namespace is still `matcher.*` (v3 name "Color Matcher").

**What 5.0 shipped.** A plain click/tap on the image samples the pixels under it (4.x opened the file dialog); dragging shows a 74 px loupe with crosshair + hex chip that samples on release (`matcher.clickToSample`: "Click to sample · drag for the loupe"). Samples land in the **PALETTE ROLL** strip (`matcher.roll`) with Clear and **Auto-extract** (`matcher.autoExtract` — the bulk K-means++ path, demoted to a button). Drawn drop zone with privacy chip (`matcher.privacyNote`: "Images are read in your browser and never uploaded.") and a mobile "Take a photo" lead; paste from clipboard still works. Region-rect selection was removed; the roll exports through the shared export sheet (each entry = sampled pixel + resolved dye + ΔE). Clearing the image also clears the IndexedDB copy. No palette drawer on this tool.

**Config (`ExtractorConfig`):** `vibrancyBoost`, `maxColors` (3–10, default 4), `dragThreshold` (px, click-vs-drag), `sampleAreaSize` (`1|2|4|8|16`, NxN pixel average), `matchingMethod`, `preventDuplicates`, `displayOptions`, `dyeFilters`.

**Share params:** none wired. `ExtractorShareParams` (`colors`, `algo`) is declared in `share-service.ts` but the tool has no share button and reads no params — the export sheet is the hand-off.

---

## 3. Gradient Builder — 4C pin rail

**Route:** `/gradient` (the v3 "Dye Mixer" — `/mixer` is **not** redirected, it is the new Dye Mixer) · **ToolId:** `gradient` · **Files:** `src/components/gradient-tool.ts` (`GradientTool`), `dye-selector.ts`, `export-sheet.ts`. Spec: `4c-pin-rail-port-spec.md`.

**What 5.0 shipped.** FROM / swap / TO endpoint cards (`gradient.fromLabel` / `gradient.swap` / `gradient.toLabel`), ideal-over-achievable stacked bands above the rail, per-step drift in the active method, a summary with average + max drift and pinned count. **Pin** any middle step (`gradient.pinStep` "Pin this step") to make its matched dye a fixed waypoint — the ramp re-interpolates per segment between anchors, a pinned step reads ΔE 0.0, pins clear on endpoint or step-count change. Endpoints resolve to themselves at 0.0. `preventDuplicates` (default on) walks flat stretches to the next-closest unused dye. One 3–12 step range everywhere (`STEP_MIN`/`STEP_MAX`; older 2–10 stored values clamp). Export via the shared sheet (the tool had no export before). Custom colours accepted for either endpoint.

**Config (`GradientConfig`):** `stepCount` (3–12, default 8), `interpolation: InterpolationMode` (`rgb | hsv | lab | oklch | lch`, default `hsv`), `matchingMethod`, `preventDuplicates`, `displayOptions`, `dyeFilters`.

**Share params** (`loadFromShareUrl()` / `getShareParams()`):

| Param | Meaning |
|-------|---------|
| `start`, `end` | endpoint stainIDs (`resolveSharedDye`); a custom endpoint is written as `0` |
| `steps` | 3–12 |
| `interpolation` | one of the five modes |
| `algo` | matching method (normalised) |

`hexStart` / `hexEnd` are declared in `GradientShareParams` but the tool neither writes nor reads them yet.

---

## 4. Dye Mixer — 5C mixing field

**Route:** `/mixer` · **ToolId:** `mixer` · **Files:** `src/components/mixer-tool.ts` (`MixerTool`), `services/mixer-blending-engine.ts` (`blendColors`, `findMatchingDyes` over `@xivdyetools/core/blending`), `dye-selector.ts`, `export-sheet.ts`. Spec: `5c-mixing-field-port-spec.md`.

**What 5.0 shipped.** A **two-dye** tool (the third slot and `dyeC` were cut). The mixing field (`mixer.fieldLabel` "Model × ratio", `mixer.fieldHint` "6 models × 5 ratios") renders six blend models × five ratios (10/30/50/70/90) as thirty real blends with nearest-dye ΔE; tapping a cell sets model + ratio and the match list follows; the tapped ratio survives re-blends and rides in the share URL. **Model spread** (`mixer.spread`) in the field header reads how far the six models land apart. **Save mix** (`mixer.saveMix`) stores dye A + dye B + the resolved dye as a device-local `kind: 'palette'` collection. Field cells and results draw from one filtered pool; result cards carry `vendorCost` (coffer dyes read "1 Venture Coffer", never gil). Export via the shared sheet.

**Config (`MixerConfig`):** `maxResults` (3–8, default 4), `mixingMode: MixingMode` (`rgb | lab | oklab | ryb | hsl | spectral`, default `ryb`), `matchingMethod`, `displayOptions`, `dyeFilters`.

**Share params:**

| Param | Meaning |
|-------|---------|
| `dyeA`, `dyeB` | slot stainIDs (both required to share; a custom slot is written as `0`) |
| `ratio` | 0–100, percentage of dye A |
| `mode` | one of the six blend models |
| `algo` | matching method (normalised) |

`hexA` / `hexB` are declared in `MixerShareParams` but not wired in the tool.

---

## 5. Accessibility Checker — 6A lens

**Route:** `/accessibility` · **ToolId:** `accessibility` · **Files:** `src/components/accessibility-tool.ts` (`AccessibilityTool`), `metric-help.ts` (`createMetricHelp`, `PAIR_READOUT_UNITS`), `dye-selector.ts`. Spec: `6a-lens-port-spec.md`.

**What 5.0 shipped.** Up to four slots (dyes or custom colours). Five **lens** tabs — normal, deuteranopia, protanopia, tritanopia, achromatopsia (`VISION_TYPES`; Brettel simulation from core) — each with prevalence and a worst-pair dot (`accessibility.worstHint`); the whole workspace repaints through the active lens (persisted under `v5_accessibility_lens`), per-dye cards carry the lens's ΔE2000 shift badge on the 5/10/20/35 ramp, result cards read as-designed → as-perceived. The **pair readout** ("Can you tell them apart?") switches between three units — Distinguishability % (the app's RGB-distance measure), Contrast ratio (WCAG 1.4.11), ΔE2000 — with tier bands from core's calibrated `BAND_VOCABULARY`; a `MetricHelp` expander gives definition / caveat / NOT A STANDARD / tier legend / unit switcher / localized W3C learn-link. The 4.x vision cards, contrast table and 4×4 distinguishability matrix are gone, as are the three dead simulation-display toggles.

**Config (`AccessibilityConfig`):** `normalVision`, `deuteranopia`, `protanopia`, `tritanopia`, `achromatopsia` (which lenses are offered), `displayOptions` (defaults: `showPrice`, `showAcquisition` off). No `matchingMethod`, no `dyeFilters`.

**Share params:**

| Param | Meaning |
|-------|---------|
| `dyes` | comma-separated stainIDs, max 4 (custom colours are dropped on write) |
| `vision` | lens id; a shared link opens on the lens it was shared as (`shareVisionType`, default `protanopia`) |

---

## 6. Dye Comparison — 7C duel

**Route:** `/comparison` · **ToolId:** `comparison` · **Files:** `src/components/comparison-tool.ts` (`ComparisonTool`), `metric-help.ts` (methods mode), `dye-selector.ts`, `export-sheet.ts`. Spec: `7c-duel-port-spec.md`.

**What 5.0 shipped.** Up to four dyes/custom colours; pair chips ordered closest-first feed a split duel panel: a tiered verdict (`comparison.tierSame/Close/Near/Far` — SAME / CLOSE / NEAR / FAR) with a cost line, a "What actually differs" block (`comparison.whatDiffers`: Lab L*, saturation, hue, vendor, source), then seven readouts — the six matching methods with tier words plus RATIO — that double as method tiles, and two mirrored full-size result cards. `TIE` badges (`comparison.tieBadge`). The **Match line** slider (`comparison.matchLine`, 1–15 ΔE2000) in the sidebar sets the SAME cut; the verdict cites each method's own calibrated cut (core `BAND_VOCABULARY`), never ΔE2000's number under another method. The duel refreshes when market prices arrive. The 4.x stat cards / charts / 4×4 matrix (~26 KB) were removed. Export via the shared sheet (entries carry the dye only — nothing drifted).

**Config (`ComparisonConfig`):** `matchThreshold` (1–15, default 5), `displayOptions`. No `matchingMethod` (all six are shown).

**Share params:** `dyes` — comma-separated stainIDs, max 4 (custom colours dropped on write).

---

## 7. Community Presets — 8A gallery + 8S flows

**Route:** `/presets` · **ToolId:** `presets` · **Files:** `src/components/v4/preset-tool.ts` (`<v4-preset-tool>`, Lit), `v4/preset-card.ts` (`<v4-preset-card>`), `v4/preset-detail.ts` (`<v4-preset-detail>`), `preset-submission-form.ts`, `preset-edit-form.ts`, `preset-category-selector.ts`, `signin-modal.ts`, `my-submissions-modal.ts`; services `hybrid-preset-service.ts` (curated + API), `community-preset-service.ts`, `preset-submission-service.ts`, `saved-presets-service.ts`, `auth-service.ts`; `shared/preset-i18n.ts`, `shared/example-link.ts`. Spec: `8a-gallery-port-spec.md`.

**What 5.0 shipped.** Community-first tabs **Community / Official / Saved / Mine** (`preset.tabCommunity…tabMine`) with live counts, a category rail (eight categories — `jobs`, `grand-companies`, `seasons`, `events`, `aesthetics`, `appearance`, `zones`, `raids-trials`; `community` is gone — community-ness is a tab; rail and detail honour secondary categories), one search field that also matches dye names (`preset.searchPlaceholder` "Search presets, dyes, tags…"), cycling sort (Most Popular / Most Recent / Alphabetical), an offline strip. Cards are picture-led posts with vote / save pills. The **saved shelf** (`SavedPresetsService` — local snapshots, tombstones for author-removed presets, capped 200, works signed out) and the user's own `CollectionService` palettes (including everything migrated from 4.x) appear in the gallery. Detail is a readable palette list with a `PALETTE COST` note (9C vocabulary) and a `TAKE THIS PALETTE INTO` hand-off row (Harmony / Comparison / Gradient / Accessibility) that emits the stainID share grammar. The 15 curated presets render name/description/tags in the user's language (`preset.<id>.*`). Dye refs are resolved by `resolvePresetDye()` (`services/dye-service-wrapper.ts`: 1–254 → stainID, ≥ 5729 → legacy itemID, so un-migrated API rows still render).

**8S modals** (all on the 16A shell): **sign-in** (`panelWidth: 460`, gates table + Discord / XIVAuth), **submit** (`panelWidth: 560`, `HOW IT WILL LOOK` preview band, 3–6 dyes, opened from the sidebar's "+ Submit Preset" or prefilled from the Swatch tool), **My Submissions** (`panelWidth: 620`, stats + status rows LIVE / IN REVIEW / NOT PUBLISHED with real rejection reasons), **edit** (owner only; PATCH sends only what changed), delete confirm (`destructive: true`). Submission and edit share the 1-primary + 2-secondary category selector, optional preview-image upload (≤ 5 MB, shown once approved) and an example link validated against the client mirror of the API allowlist (Eorzea Collection, Mirapri, Reddit, X, Bluesky, Instagram, pixiv, Lodestone, Misskey).

**Config (`PresetsConfig`):** `sortBy: 'popular' | 'recent' | 'name'`, `category: PresetCategoryFilter` (`'all'` + the eight), Feed section `feedShots` (example images on cards), `feedBlend` (mix Official into Community), `feedHideUnbuyable`; Saved section `savedFirst`, `keepDeleted`; `displayOptions`. (`showMyPresetsOnly` / `showFavorites` are gone.)

**Share params:** none — presets are addressed by the API, and the detail page's hand-off row shares *into* other tools.

---

## 8. Budget Suggestions — 9C ledger

**Route:** `/budget` · **ToolId:** `budget` · **Files:** `src/components/budget-tool.ts` (`BudgetTool`), `metric-help.ts`, `services/market-board-service.ts` (Universalis via `https://data.xivdyetools.app/universalis` on api-worker), `services/price-utilities.ts`. Spec: `9c-ledger-port-spec.md`.

**What 5.0 shipped.** Rewritten on Patch 7.5 pricing rules — `priceOf()` replaces the 4.x `getBudgetComparablePrice`: Venture Coffer (X) dyes are board-only, Spectrum A = 216 gil vendor + the 52254 board price, B/C = scrip/credit locally with the consolidated board price as the only gil figure, currencies never converted, Facewear colours never enter. A tier-grouped ledger (A → B → C → X, price printed once per group, `×N CHEAPER`, `VENDOR SAVES {diff} vs BOARD`) with sortable `DYE | ΔE | BOARD | GIL/ΔE` rows, a verdict block (green priced / amber offline / neutral upgrade), upgrade mode ("ALREADY THE FLOOR") for Standard-Spectrum targets, quick picks generated from the live board (`PRICIEST ON {world} NOW`), the 2–20 ΔE **Match line** (`budget.matchLine`), a `SEND TO` row (Harmony / Compare / Copy item name / **Save swap** → the store's first `kind: 'swap'` record) plus a share button, arbitrary-hex targets, three-column ledger ≤ 480 px. New **Exclude Coffer Dyes** filter (`excludeCoffers`, wired through every sidebar). The gil-limit slider, 1–10 result cap and 0.7/0.3 value sort are gone; the sidebar match-line slider is disabled when `matchingMethod !== 'ciede2000'`.

**Config (`BudgetConfig`):** `maxDeltaE` (2–20, default 8), `matchingMethod`, `displayOptions`, `dyeFilters`. (`maxPrice` / `maxResults` removed.) Market server / show-prices live in the shared `MarketConfig` (`selectedServer`, `showPrices`).

**Share params** (`handleDeepLink()` / `getShareParams()`):

| Param | Meaning |
|-------|---------|
| `dye` | target stainID |
| `hex` | bare-colour target (`RRGGBB`), used only when `dye` is absent; never persisted |
| `maxDelta` | match line, clamped to 2–20 |

`maxPrice` is declared in `BudgetShareParams` but no longer read. The 4.x `?dye=NAME` outlier is gone.

---

## 9. Swatch Matcher — 10A sheet + `.chara` import

**Route:** `/swatch` (legacy `/character` redirects) · **ToolId:** `swatch` · **Files:** `src/components/swatch-tool.ts` (`SwatchTool`), `chara-import.ts` (the 10A file card / THIS CHARACTER sheet), core's `CharacterColorService`, `parseCharaFile`, `resolveCharaColors`. Spec: `10a-sheet-port-spec.md`. Locale namespaces `swatch.*` and `tools.character.*` (v3 name "Character Colors"; en title "Character Matcher", short name "Swatch").

**What 5.0 shipped.** The front door is a reader: drop an Anamnesis / Ktisis / Brio `.chara` file (`swatch.dropTitle`) — parsed entirely on-device into a file card (producer, nickname, `LOCAL ONLY` chip, tribe/gender readout), a **THIS CHARACTER** sheet (one card per slot with its R·C grid address or amber `OFF GRID`, absent-slot reasons, best dye + tier-coloured ΔE2000, lip blend beside the raw cell), grid pins on the loaded palette, a five-row excerpt around a picked cell, and **DYES ON THIS GLAMOUR** (both channels, droppable chips, 3–6 counter → prefilled preset submission). **Save character colours** (`swatch.saveCharacter`) writes a `kind: 'character'` record. The grid path keeps a seven-palette rail (eye, hair, skin, highlight, lip, tattoo, face paint) with a Dark/Light range toggle for the split palettes (replacing the sidebar dropdown); race/gender selectors lock into a readout while a file is loaded (`SwatchConfig.fileProvided`; the sidebar subscribes to `swatch`); `SEND TO` hand-off row; the **Evercold deprecation banner** on the eye / hair / skin grids (`EVERCOLD_DEPRECATED_CATEGORIES`); 26 px desktop / 44 px mobile cells. Sixteen sub-races (`Helion` → `Helions` migrates on read) × two genders for the race-specific sheets. Reverse-match rings use the theme accent.

**Config (`SwatchConfig`):** `colorSheet` (`eyeColors | hairColors | skinColors | highlightColors | lipColorsDark | lipColorsLight | tattooColors | facePaintColorsDark | facePaintColorsLight`, default `hairColors`), `fileProvided`, `race` (sub-race, default `SeekerOfTheSun`), `gender` (`Male | Female`), `maxResults` (1–6, default 3), `matchingMethod`, `displayOptions`, `dyeFilters`.

**Share params** (`loadFromShareUrl()` / `getShareParams()` — a cell is identified by address, not hex, because two cells can share a colour):

| Param | Meaning |
|-------|---------|
| `slot` | colour sheet (`sheet` accepted as the pre-5.0 alias) |
| `i` | cell index within the sheet (the R·C address derives from it) |
| `race`, `gender` | written for race-specific sheets (hair, skin); validated on read |
| `algo` | matching method (normalised — 4.x only whitelisted `oklab|ciede2000|euclidean`) |
| `limit` | max results (≤ 20 on read) |
| `hex` | bare-colour reverse match (`color` accepted as the legacy alias; `parseSharedHex`) |

---

## Tool ID to Route Mapping

`ROUTES` in `src/services/router-service.ts` (History API, not hash). Legacy v3 paths in `LEGACY_ROUTE_REDIRECTS` are rewritten with `replaceRoute()`; root or unknown paths land on the default tool (`harmony`). `dc`, `dye`, `ui` query params are preserved across navigation (`PRESERVED_PARAMS`). Keyboard `1`–`9` switch tools in `ROUTES` order (`KeyboardService`).

| Tool (`ToolId`) | Route (`title`) | Key | Legacy v3 route / name |
|------|---------------|-----|-----------------|
| `harmony` | `/harmony` (Harmony Explorer) | 1 | `/harmony` — Harmony Explorer |
| `extractor` | `/extractor` (Palette Extractor) | 2 | `/matcher` (redirects) — Color Matcher |
| `accessibility` | `/accessibility` (Accessibility Checker) | 3 | `/accessibility` — Accessibility Checker |
| `comparison` | `/comparison` (Dye Comparison) | 4 | — Dye Comparison |
| `gradient` | `/gradient` (Gradient Builder) | 5 | `/mixer` (**not** redirected — `/mixer` is now the Dye Mixer) — Dye Mixer |
| `presets` | `/presets` (Community Presets) | 6 | `/presets` — Preset Browser |
| `budget` | `/budget` (Budget Suggestions) | 7 | — (new in v4) |
| `swatch` | `/swatch` (Swatch Matcher) | 8 | `/character` (redirects) — Character Colors |
| `mixer` | `/mixer` (Dye Mixer) | 9 | — (new in v4) |

The nine tool paths also have dynamic OpenGraph cards from `og-worker` (`?lang=`), which consumes the same stainID/hex share grammar; the site root uses static cards under `public/og/`.

---

## Related Documentation

- [Components](components.md) - Shell, shared components, services
- [Theming](theming.md) - Theme system
- [Overview](overview.md) - Web app overview
- `docs/research/monorepo-2.0/` - per-tool port specs (design intent; the code decides what shipped)
