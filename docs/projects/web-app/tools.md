# Web App Tools

The XIV Dye Tools web app ships ten tools. Each has its own route and a `ToolId`; nine have a config shape in `ConfigController` (not the Glamour Reader) and eight a share-URL grammar (not Community Presets or the Glamour Reader). In 5.0 every tool was re-ported to its confirmed design spec (`docs/research/monorepo-2.0/*-port-spec.md`) on the console shell described in [Components](components.md). This page is the developer reference: which files, what the port did, the config shape, the share params, matching-method handling, and the routes. Ground truth is the code under `apps/web-app/src/`.

---

## Cross-cutting facts (read first)

**How a tool is mounted.** `src/components/v4-layout.ts` `loadToolContent()` lazy-imports the tool module on navigation and mounts it into `.v4-layout-content-scroll` *inside `v4-layout-shell`'s shadow root* (not a slot). Nine tools are imperative `BaseComponent` subclasses (`new HarmonyTool(container, { leftPanel, rightPanel, drawerContent: null })` then `.init()`); Community Presets is a Lit element (`<v4-preset-tool>`) appended directly. Because tool DOM lives in a shadow root, `styles/globals.css` and document-level Tailwind never reach it — tools use inline styles, and the two shared rules (`.v5-results-grid`, empty states) are injected by `v4-layout.ts` into the shell's shadow root. `leftPanel === rightPanel` in the v4 shell, so every tool renders one main flow; configuration lives in the config sidebar / Advanced Settings, not in the tool.

**Picking dyes.** The palette drawer (`v4/dye-palette-drawer.ts`) is the app's dye picker. The shell routes `dye-selected` to the active tool's `selectDye(dye)` (or `addDye`) and `custom-color-selected` to `selectCustomColor(hex)`. The drawer is hidden for `extractor`, `presets` and `glamour` (`V4LayoutShell.TOOLS_WITHOUT_PALETTE`); its **Custom Color** section is shown for harmony, gradient, mixer, swatch, accessibility, comparison and budget (`DyePaletteDrawer.TOOLS_WITH_CUSTOM_COLOR`). A custom colour is a virtual dye with `stainID: null` — never persisted to a collection, never shared as `dye=0`.

**Config.** Each tool's shape is an interface in `src/shared/tool-config-types.ts`, keyed by `ToolId` in `ToolConfigMap` (plus `global`, `market`, `advanced`). `ConfigController.getInstance().getConfig('harmony')` / `setConfig()` / `subscribe()`; persisted per key under `xivdyetools_v4_config_<key>` and merged over `DEFAULT_CONFIGS` on load. Since 5.14.1 the controller is the only owner of a setting: every tool reads every setting from `getConfig()` when it is built (`subscribe()` never replays), its own `setConfig()` only applies values that changed, and an in-tool pick, a share link or Budget's match-line slider applies locally and then writes `ConfigController.setConfig()`. No tool keeps its own copy in storage any more. The config sidebar seeds and subscribes to every key except `advanced`. Every tool config carries `displayOptions: DisplayOptionsConfig` (result-card rows: `showHex/Rgb/Hsv/Lab/Cmyk`, `showPrice`, `showAcquisition`, 5.0 `showHue/showStain/showSpectrum`; `showDeltaE` is deprecated — the ΔE2000 verdict is structural) and most carry `dyeFilters: DyeFiltersConfig` (`Required<DyeTypeFilters>` + the web-only `excludeCoffers`).

**Matching method.** One vocabulary from `@xivdyetools/core` — `ciede2000` (default) · `oklab` · `cie76` · `redmean` · `rgb` · `distinguish`. The config sidebar's "Matching Algorithm" select prefixes each with its symbol — `ΔE2000`, `ΔEOK2`, `ΔE76`, `REDMEAN`, `RGB DIST`, `DISTINGUISH %` — over localized descriptions (`config.matching*` keys). Retired 4.x values (`hyab`, `oklch-weighted`, swatch's `euclidean`) are normalised through core's `normalizeMatchingMethod` in three places: `ConfigController.loadFromStorage()` (persisted configs), each tool's init (`normalizeMatchingMethod(config.matchingMethod ?? 'ciede2000')`), and the `algo` share param (Gradient, Mixer and Swatch accept it only when it is a current or retired method, and ignore anything else rather than normalise it to the default). Tools dispatch distance through `ColorService.getDistanceForMethod`; the result card's verdict is **always ΔE2000** regardless of the ordering method. `matchingMethod` exists on harmony, extractor, gradient, mixer, budget and swatch; comparison and accessibility have none (comparison shows all six as readouts).

**Share URLs** (`src/services/share-service.ts`, `v4/share-button.ts`; Shift+S shares the active tool). `ShareService.generateUrl({ tool, params })` builds `https://xivdyetools.app/<tool>/?…&v=1`. Grammar since 5.0: every dye-class param (`dye`, `dyes`, `start`/`end`, `dyeA`/`dyeB`) is a **stainID (1–254)**; `ShareService.resolveSharedDye()` rejects legacy itemIDs (≥ 5729, a disjoint range) and unknown values *loudly* — toast `share.legacyLink` / `share.invalidDye`, never a fallback dye. Bare colours travel as `hex`-class params (`RRGGBB`, `#` optional; `ShareService.parseSharedHex()` → `share.invalidHex`), mutually exclusive with the slot's dye param. Booleans are `1`/`0`, arrays comma-separated; `ShareService.parseUrl()` coerces numbers/booleans/arrays on read. Every generated link also carries `lang=<locale>` when the sharer's locale is not English (og-worker resolves the unfurl's language from that param and nothing else; the SPA ignores it), and `v=1`. Gradient, Mixer and Swatch validate a link's settings params and write the valid ones to `ConfigController`, so they persist like a sidebar choice (Budget's `maxDelta` too); a malformed value changes nothing. The `ShareParams` interfaces are the declared grammar; the per-tool tables below list what each tool actually reads/writes today.

**Result cards, export, saving.** Matches render as `<v4-result-card>` (5B ticket, see Components). Extractor, Gradient, Comparison and Mixer open the shared export sheet (`components/export-sheet.ts` — CSS custom properties / SCSS / JSON / HEX / Tailwind `@theme`). "Save" actions write `CollectionService` records with a `kind`: `palette` (mixer "Save mix"), `swap` (budget "Save swap"), `character` (swatch "Save character colors"). Every stored dye ref is a stainID.

---

## 1. Harmony Explorer — 1A dial

**Route:** `/harmony` · **ToolId:** `harmony` · **Files:** `src/components/harmony-tool.ts` (`HarmonyTool`), `components/v4/v4-color-wheel.ts` (`<v4-color-wheel>`), `services/harmony-generator.ts`, `shared/harmony-icons.ts`. Spec: `1a-dial-port-spec.md`.

`services/harmony-generator.ts` is **UI vocabulary only** — it exports `HarmonyTypeInfo`, `HARMONY_TYPE_IDS` and `getHarmonyTypes()` (the ids the picker offers, their icons and localized names). Slot **selection** is core's `generateHarmonySlots`, and `HARMONY_OFFSETS` is imported from core by `v4-color-wheel.ts`: until 2026-09-03 the web app, the bot and the OG card each rotated hue their own way and disagreed on most base dyes. The tool renders its result panel and type rail itself; there is no `harmony-result-panel.ts`, `harmony-type.ts` or `color-wheel-display.ts`.

**What 5.0 shipped.** The hero wheel is the control: 42 px tappable slot pucks (tap jumps the base to the nearest dye), a 114 px hub button that names the base and opens the palette drawer (`open-palette-drawer` event), the wheel mirroring the result grid (dedup + user swaps). An icon rail of every harmony type sits over the wheel (single scrolling row with a first-run `harmony.railSwipeHint` "SWIPE FOR MORE" below 768 px) and stays in sync with the sidebar through `ConfigController` (two-way — the sidebar subscribes to `harmony`). Ten harmony types: complementary, analogous, triadic, split-complementary, tetradic (a rectangle now), **inverted-tetradic** (new, offsets 120/180/300), square, monochromatic, compound, shades — the last three finally draw nodes. Each result card carries **companion alternates** as 22 px swatch dots with one-tap slot swap (`HarmonyConfig.companionDyesCount`, 1–5 slider "Additional Dyes per Harmony Color"). Custom base colours are accepted (drawer's Custom Color). One dismissible market-failure strip replaces the per-card dash. The 4.x `PaletteExporter` and the orphaned left-panel companion slider are gone.

**Colour wheels.** The harmony angles are measured on a wheel the user picks, not always on RGB hue. Five ids (core's `COLOR_WHEEL_IDS`): `rgb` (the default, `DEFAULT_COLOR_WHEEL`), `ryb` (the artist's wheel), `munsell` (JIS), `oklch-hue` (perceptual spacing) and `oklch-lightness` (keeps brightness). The setting is `HarmonyConfig.wheel: ColorWheelId`, persisted with the rest of the harmony config; the control is a **Colour wheel** select in the config sidebar (`v4/config-sidebar.ts`) that renders `COLOR_WHEEL_IDS` with `LanguageService.getColorWheelName(id)`, a per-wheel description line and, for Munsell, a trademark note. Unknown values are folded to `rgb` by core's one normaliser (`normalizeColorWheelId` / `parseColorWheelId`). Changing the wheel **clears the tool's slot swaps** — a swap is fixed to a slot index, and the same slot index is a different target hue on a different wheel, so a swap carried across would land on a colour it was never chosen for (the same reason a harmony-type change clears them). The ring the `<v4-color-wheel>` draws comes from `getColorWheel(wheel).ringStops(72)`. The wheel is written into every share link **unconditionally** — see below. The bot's `/harmony wheel:` option takes the same five ids.

**Config (`HarmonyConfig`):** `harmonyType` (default `complementary`), `wheel` (`ColorWheelId`, default `rgb`), `strictMatching` (perceptual ΔE matching instead of hue-based), `matchingMethod` (default `ciede2000`), `preventDuplicates` (default on), `companionDyesCount`, `displayOptions`, `dyeFilters`.

**Share params** (read via `URLSearchParams`, written by `getShareParams()`):

| Param | Meaning |
|-------|---------|
| `dye` | base stainID (`resolveSharedDye`); `dyeId` is accepted as the pre-5.0 alias on read. **Consumed:** once the dye is applied and stored, `handleDeepLink` drops `dye`/`dyeId` from the URL (`history.replaceState`), so the preserved param can neither bring an old link back over a later pick nor ride into Budget as its target (BUG-013). One that does not resolve stays until the next base change in the tool (a pick, a custom colour, Clear), which drops it |
| `hex` | bare-colour base (`RRGGBB`), used only when `dye` is absent. Applied on arrival and left in the URL (a custom base is never stored, so a reload needs the link); a base change by the user drops it, so a reload cannot put the linked colour back over a later pick |
| `harmony` | harmony type id (validated against the known list) |
| `algo` | matching method (`normalizeMatchingMethod`, synced to `ConfigController`) |
| `perceptual` | `1`/`true`/`yes` → `strictMatching` |
| `wheel` | colour wheel id — **always written**, even for the `rgb` default. Eliding it only works while the reader also defaults to `rgb`, and a link is opened in someone else's session with someone else's persisted wheel; an elided default used to render a Munsell palette under an RGB sharer's link. On read, an absent `wheel` means `rgb` and an unknown value warns and falls back to `rgb` |

---

## 2. Palette Extractor — 4A loupe over a weighted bar

**Route:** `/extractor` (legacy `/matcher` redirects) · **ToolId:** `extractor` · **Files:** `src/components/extractor-tool.ts` (`ExtractorTool`), `image-zoom-controller.ts`. Specs: `3c-loupe-port-spec.md` (the 5.0 port) and the confirmed **4A** frame in the design project (`Extractor Tool Directions.dc.html`, 2026-09-05), which supersedes 3C. Locale namespace is still `matcher.*` (v3 name "Color Matcher").

**What 5.8 shipped (4A).** One column, three stages, each owning a different job. (1) The image with a **persistent loupe**: a click/tap reads the pixels under it (averaged over `sampleAreaSize`), a drag past `dragThreshold` drives the loupe live and reads at the release point; the bottom-left hint chip carries the instruction (`matcher.clickToSample` / `matcher.tapToSample`) until the first read and then names the hex and the nearest dye. Nothing commits by itself. (2) The **dominance bar butted under the image** (`#extractor-bar`): the K-means colours as proportional segments (`flex-grow` = share, labelled `n%`), a 3 px break, then each committed pick as a fixed-width segment (52 px desktop / 40 px mobile) labelled with its slot number — a pick has no share and is never drawn as one — and the `+` tile (`#extractor-add-pick`) that commits whatever the loupe holds. Picks cap at 6 (`matcher.pickCapReached`). Under the bar: the legend `IMAGE SHARE · n picks` (`matcher.imageShare`, `matcher.picksCount` / `picksCountOne`) with **Clear picks**, then the section header whose count reads `6 + 2` (`matcher.rollCount`) or `6 of 6` (`matcher.rollCountOf`). Tapping a segment focuses its card (`selected` ring, scrolled into view). (3) The **card sheet**: one compact `<v4-result-card>` per segment, extracted first, then picks. Extraction runs on image load (toast) and again, silently, on every config change; picks survive a re-extraction and clear with the image. One resolution path for both kinds — the nearest dye the filters allow that no earlier slot holds while `preventDuplicates` is on, measured with the selected method — and `vibrancyBoost` orders the extracted run by `0.55 × saturation + share` (widths stay share-based). Nothing is drawn onto the image any more (3C's numbered markers and the controller's red crosshair are gone). Desktop scrolls the column; mobile pins the hero and scrolls the sheet. Drawn drop zone with privacy chip (`matcher.privacyNote`), mobile "Take a photo" (capture-attribute file input), paste from clipboard, and the shared export sheet over the whole roll. **No option panel:** the v4 shell passes one element as both panels, so the 3C left column (upload display, colour picker, palette-mode options, market panel) was rendered and immediately cleared — 5.8 removed it together with `image-upload-display.ts`, `color-picker-display.ts`, `camera-preview-modal.ts` and `services/camera-service.ts`; `ConfigController` is the only settings store and the `v3_matcher_*` keys are purged on mount. With no `getUserMedia` caller left, `_headers` carries `camera=()` — the mobile capture-attribute input is served by the OS camera app and that directive does not gate it.

**What 5.0 shipped (3C, superseded).** A plain click/tap sampled the pixels under it and committed straight into a **PALETTE ROLL** strip of 58 px tiles with Clear and **Auto-extract** (bulk K-means demoted to a button); a sample replaced the sheet with the ten nearest dyes for that one colour. 4A keeps 3C's loupe as the input, makes the dominance bar the index and the sheet the output, so bulk extraction stops being a second mode. **The image is never persisted** — it lives in memory for the session only. (Up to 5.0.0 it went into an IndexedDB `image_cache` store; FINDING-009 removed that, and DB v3 deletes the store on first open.) No palette drawer on this tool.

**Config (`ExtractorConfig`):** `vibrancyBoost`, `maxColors` (3–10, default 4), `dragThreshold` (px, click-vs-drag), `sampleAreaSize` (`1|2|4|8|16`, NxN pixel average), `matchingMethod`, `preventDuplicates`, `displayOptions`, `dyeFilters`.

**Share params** (restored in 5.11.0, BUG-002; `getShareParams()` / `restoreFromShareLink()`):

| Param | Meaning |
|-------|---------|
| `colors` | palette colours, bare hex per entry (`RRGGBB`, no `#`, upper-case), comma-separated; capped at 5 (`MAX_EXTRACTOR_SHARE_COLORS`, matching og-worker's card slicing). Only extracted (K-means) entries are written — a pick has no dominance share and is excluded |
| `algo` | matching method (normalised), applied to the restored palette |

On read, the restored colours replace the roll with equal synthetic shares (the link carries no proportions) and clear any picks; an over-long list drops its tail and an invalid hex is skipped, both with a console warning rather than failing the link.

---

## 3. Gradient Builder — 4C pin rail

**Route:** `/gradient` (the v3 "Dye Mixer" — `/mixer` is **not** redirected, it is the new Dye Mixer) · **ToolId:** `gradient` · **Files:** `src/components/gradient-tool.ts` (`GradientTool`), `dye-selector.ts`, `export-sheet.ts`. Spec: `4c-pin-rail-port-spec.md`.

**What 5.0 shipped.** FROM / swap / TO endpoint cards (`gradient.fromLabel` / `gradient.swap` / `gradient.toLabel`), ideal-over-achievable stacked bands above the rail, per-step drift in the active method, a summary with average + max drift and pinned count. **Pin** any middle step (`gradient.pinStep` "Pin this step") to make its matched dye a fixed waypoint — the ramp re-interpolates per segment between anchors, a pinned step reads ΔE 0.0, pins clear on endpoint or step-count change. Endpoints resolve to themselves at 0.0. `preventDuplicates` (default on) walks flat stretches to the next-closest unused dye. One 3–12 step range everywhere (`STEP_MIN`/`STEP_MAX`; older 2–10 stored values clamp). Export via the shared sheet (the tool had no export before). Custom colours accepted for either endpoint.

**Config (`GradientConfig`):** `stepCount` (3–12, default 8), `interpolation: InterpolationMode` (`rgb | hsv | lab | oklch | lch`, default `hsv`), `matchingMethod`, `preventDuplicates`, `displayOptions`, `dyeFilters`.

**Share params** (`loadFromShareUrl()` / `getShareParams()`):

| Param | Meaning |
|-------|---------|
| `start`, `end` | endpoint stainIDs (`resolveSharedDye`) |
| `hexStart`, `hexEnd` | bare-colour endpoints (`RRGGBB`), each mutually exclusive with its slot's dye param — a custom endpoint is written here, never as an invalid `start=0`. Read through `resolveSharedEndpoint()`, which prefers the dye slot when both are present |
| `steps` | 3–12, an integer (anything else is ignored) |
| `interpolation` | one of the five modes |
| `algo` | matching method: a current or retired method only, normalised |

---

## 4. Dye Mixer — 5C mixing field

**Route:** `/mixer` · **ToolId:** `mixer` · **Files:** `src/components/mixer-tool.ts` (`MixerTool`), `services/mixer-blending-engine.ts` (`blendColors`, `findMatchingDyes` over `@xivdyetools/core/blending`), `dye-selector.ts`, `export-sheet.ts`. Spec: `5c-mixing-field-port-spec.md`.

**What 5.0 shipped.** A **two-dye** tool (the third slot and `dyeC` were cut). The mixing field (`mixer.fieldLabel` "Model × ratio", `mixer.fieldHint` "6 models × 5 ratios") renders six blend models × five ratios (10/30/50/70/90) as thirty real blends with nearest-dye ΔE; tapping a cell sets model + ratio and the match list follows; the tapped ratio survives re-blends and rides in the share URL. **Model spread** (`mixer.spread`) in the field header reads how far the six models land apart. **Save mix** (`mixer.saveMix`) stores dye A + dye B + the resolved dye as a device-local `kind: 'palette'` collection. Field cells and results draw from one filtered pool; result cards carry `vendorCost` (coffer dyes read "1 Venture Coffer", never gil). Export via the shared sheet.

**Config (`MixerConfig`):** `maxResults` (3–8, default 4), `mixingMode: MixingMode` (`rgb | lab | oklab | ryb | hsl | spectral`, default `ryb`), `matchingMethod`, `displayOptions`, `dyeFilters`.

**Share params:**

| Param | Meaning |
|-------|---------|
| `dyeA`, `dyeB` | slot stainIDs — both slots must be filled to share |
| `hexA`, `hexB` | bare-colour slots (`RRGGBB`), each mutually exclusive with its slot's dye param — a custom input is written here, never as an invalid `dyeA=0`. Read through `resolveSharedInput()`, which prefers the dye slot when both are present |
| `ratio` | 0–100, percentage of dye A |
| `mode` | one of the six blend models |
| `algo` | matching method: a current or retired method only, normalised |

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

**Route:** `/budget` · **ToolId:** `budget` · **Files:** `src/components/budget-tool.ts` (`BudgetTool`), `metric-help.ts`, `services/market-board-service.ts` (Universalis via `https://data.xivdyetools.app/universalis` on api-worker), and `BudgetTool.priceOf()` itself. There is no `services/price-utilities.ts`; the shared piece is `services/pricing-mixin.ts`'s `setupMarketBoardListeners()`, which wires a tool to server / show-prices changes. Spec: `9c-ledger-port-spec.md`.

**What 5.0 shipped.** Rewritten on Patch 7.5 pricing rules — `priceOf()` replaces the 4.x `getBudgetComparablePrice`: Venture Coffer (X) dyes are board-only, Spectrum A = 216 gil vendor + the 52254 board price, B/C = scrip/credit locally with the consolidated board price as the only gil figure, currencies never converted, Facewear colours never enter. A tier-grouped ledger (A → B → C → X, price printed once per group, `×N CHEAPER`, `VENDOR SAVES {diff} vs BOARD`) with sortable `DYE | ΔE | BOARD | GIL/ΔE` rows, a verdict block (green priced / amber offline / neutral upgrade), upgrade mode ("ALREADY THE FLOOR") for Standard-Spectrum targets, quick picks generated from the live board (`PRICIEST ON {world} NOW`), the 2–20 ΔE **Match line** (`budget.matchLine`), a `SEND TO` row (Harmony / Compare / Copy item name / **Save swap** → the store's first `kind: 'swap'` record) plus a share button, arbitrary-hex targets, three-column ledger ≤ 480 px. New **Exclude Coffer Dyes** filter (`excludeCoffers`, wired through every sidebar). The gil-limit slider, 1–10 result cap and 0.7/0.3 value sort are gone; the sidebar match-line slider is disabled when `matchingMethod !== 'ciede2000'`.

**Config (`BudgetConfig`):** `maxDeltaE` (2–20, default 8), `matchingMethod`, `displayOptions`, `dyeFilters`. (`maxPrice` / `maxResults` removed.) Market server / show-prices live in the shared `MarketConfig` (`selectedServer`, `showPrices`). Since 5.14.1 Budget fetches its prices whatever `showPrices` says (`fetchPricesForDyes(…, { ignoreShowPrices: true })`, result to the caller only, never the shared cache), and the sidebar hides the Enable Market Board switch on Budget, keeping the server select.

**Share params** (`handleDeepLink()` / `getShareParams()`):

| Param | Meaning |
|-------|---------|
| `dye` | target stainID. The result card's "Set as budget target" sends it explicitly (`handoffTo`), so it replaces a preserved one (BUG-013). **Consumed:** once the dye is applied and stored as the target, `handleDeepLink` drops `dye` from the URL, so the preserved param cannot follow the user into Harmony and replace its base. One that does not resolve stays until a pick, a custom colour or Clear drops it (with `hex`) |
| `hex` | bare-colour target (`RRGGBB`), used only when `dye` is absent; never persisted |
| `maxDelta` | match line, 2–20 (rounded); a value outside that range is ignored |

`maxPrice` is declared in `BudgetShareParams` but no longer read. The 4.x `?dye=NAME` outlier is gone.

---

## 9. Swatch Matcher — 10A sheet + `.chara` import

**Route:** `/swatch` (legacy `/character` redirects) · **ToolId:** `swatch` · **Files:** `src/components/swatch-tool.ts` (`SwatchTool`), `chara-file-card.ts` (the 10A drop zone and file card), `chara-sheet.ts` (THIS CHARACTER), `chara-ui.ts` (their shared helpers), `services/chara-session-service.ts` + `chara-file-loader.ts` (the loaded file), core's `CharacterColorService`, `parseCharaFile`, `resolveCharaColors`. Spec: `10a-sheet-port-spec.md`. Locale namespaces `swatch.*` and `tools.character.*` (v3 name "Character Colors"; en title "Swatch Matcher" since 5.12.0 — it read "Character Matcher" before — short name "Swatch").

**What 5.0 shipped.** The front door is a reader: drop an Anamnesis / Ktisis / Brio `.chara` file (`swatch.dropTitle`) — parsed entirely on-device into a file card (producer, nickname, `LOCAL ONLY` chip, tribe/gender readout), a **THIS CHARACTER** sheet (one card per slot with its R·C grid address or amber `OFF GRID`, absent-slot reasons, best dye + tier-coloured ΔE2000, lip blend beside the raw cell), grid pins on the loaded palette, and a five-row excerpt around a picked cell. **DYES ON THIS GLAMOUR moved to the [Glamour Reader](#10-glamour-reader--design-1a1b--export-sheet-2c) in 5.13.0**; the file card links there ("Glamour Reader →"). **Save character colors** (`swatch.saveCharacter`) writes a `kind: 'character'` record. The grid path keeps a seven-palette rail (eye, hair, skin, highlight, lip, tattoo, face paint) with a Dark/Light range toggle for the split palettes (replacing the sidebar dropdown); race/gender selectors lock into a readout while a file is loaded (the sidebar subscribes to `swatch` for the file's tribe/gender and, since 5.12.7, to `CharaSessionService` for the lock itself); `SEND TO` hand-off row; the **Evercold deprecation banner** on the eye / hair / skin grids (`EVERCOLD_DEPRECATED_CATEGORIES`); 26 px desktop / 44 px mobile cells. Sixteen sub-races (`Helion` → `Helions` migrates on read) × two genders for the race-specific sheets. Reverse-match rings use the theme accent.

**Item links (5.9.0).** A piece's icon tile or item name in the Pieces lens — and the carrier icon tiles in the Dyes lens, which names the dye rather than the piece — is a real button that opens an "Open in…" menu (`item-links-menu.ts`) onto five community sites: GarlandTools and Teamcraft (id-addressed, gear only), Mirapri and GamerEscape (name-addressed), and the Lodestone as a submenu of five regional searches (North America, Europe, Japan, Germany, France). Facewear has no Item id, so it gets only the three name-addressed entries, resolving its untinted base name first — a family's eleven tints carry the tint in their own name (e.g. the tints of "Simple Spectacles" are named "Silver Spectacles"). No Eorzea Collection entry: its item ids don't map onto FFXIV's own, so a wrong one would open a different item rather than 404.

**One loaded file (5.12.7).** The parsed character lives in `CharaSessionService`, in memory only (never browser storage, so a reload clears it), not in a component. The file card, THIS CHARACTER and DYES ON THIS GLAMOUR each subscribe to it, so leaving the tool or a language switch (which rebuilds the tool) keeps the file, and the sidebar's tribe/gender lock reads it directly. `SwatchConfig.fileProvided` is gone: that persisted flag outlived the file and left the selectors locked after a reload. `chara-file-loader.ts` parses a drop into the session (the 20 MB cap and `chara_parse` telemetry live there); the Swatch Matcher imports `glamour-block.ts` on demand, the first time a loaded file wears anything.

**Copy list / Export .md (5.10.0).** Two buttons beside Make a palette (`glamour-list-actions.ts`) write the *whole* worn glamour — the Pieces/Dyes lens and Show all only change what's on screen, not what's written — as a fixed submission template: a bold slot label, the item name, `Dye 1:` / `Dye 2:` for dyeable slots, and a blank `Acquisition:` line, ending at Facewear. The character's name is never included. Copy puts real bold on the clipboard (HTML for Word/Google Docs, a plain-text fallback with no Markdown syntax); Export downloads `glamour-equipment.md` with `**bold**` Markdown. Both wait for item names to resolve, but stay enabled under NAMES UNAVAILABLE.

**Config (`SwatchConfig`):** `colorSheet` (`eyeColors | hairColors | skinColors | highlightColors | lipColorsDark | lipColorsLight | tattooColors | facePaintColorsDark | facePaintColorsLight`, default `eyeColors`), `race` (sub-race, default `Midlander`), `gender` (`Male | Female`, default `Male`), `maxResults` (1–6, default 3), `matchingMethod`, `displayOptions`, `dyeFilters`.

**Share params** (`loadFromShareUrl()` / `getShareParams()` — a cell is identified by address, not hex, because two cells can share a colour):

| Param | Meaning |
|-------|---------|
| `slot` | colour sheet (`sheet` accepted as the pre-5.0 alias) |
| `i` | cell index within the sheet (the R·C address derives from it) |
| `race`, `gender` | written for race-specific sheets (hair, skin); validated on read |
| `algo` | matching method: a current or retired method only, normalised (4.x only whitelisted `oklab|ciede2000|euclidean`) |
| `limit` | max results, clamped to 1–6 |
| `hex` | bare-colour reverse match (`color` accepted as the legacy alias; `parseSharedHex`) |

## 10. Glamour Reader — design 1a/1b + export sheet 2c

**Route:** `/glamour` · **ToolId:** `glamour` · **Key:** `0` · **Files:** `src/components/glamour-tool.ts` (`GlamourTool`: title, Copy list / Export .md, the shared file card, the block), `glamour-block.ts` (IN THE GAME + DYES ON THIS GLAMOUR, its own chunk), `glamour-twin-picker.ts`, `glamour-sheet.ts` + `glamour-list-actions.ts` (the export sheet, loaded on demand), `item-links-menu.ts`, `shared/acquisition-edits.ts`, `shared/glamour-markdown.ts`; core `chara-game-rules.ts` + `chara-twins.ts`. Spec: `docs/superpowers/specs/2026-09-27-glamour-reader-design.md`. Locale namespaces `glamour.*` and `tools.glamour.*`. No sidebar, no palette drawer, no config slot.

**One file, two tools.** The reader draws the file `CharaSessionService` holds, so a file loaded in the Swatch Matcher is already here; each tool's file card links to the other, and SWAP clears the file for both. With no file loaded the card is the drop zone. The card's privacy line adds that edited acquisition notes are kept on the device.

**IN THE GAME comes first.** Once api-worker answers with rules, the verdict tops the block: a headline built from the counts ("1 piece named from a twin and 1 piece this character can't wear" — one/other phrase pairs picked by `Intl.PluralRules`, joined by `Intl.ListFormat`), the fixed explanation (since 7.4 any job can wear any piece for glamour; what's checked is dye channels, the glamour flag, race, gender and Grand Company), and FIXED BY A TWIN / NO FIX / FINE AS IS / NEEDS A GRAND COMPANY chips — one outcome per piece (spec G7), so they add up to the pieces: a fine piece that needs a company counts there, a fixed one stays fixed. A `.chara` records no Grand Company, so a company-locked piece is a flag, never a failure. The check runs in the browser.

**Twins.** A model key names a family of identical items. Each row names the twin the list will write — the player's pick, else the default: the first twin that passes the check, preferring a dyeable one (GPOSERS: use a dyeable twin), then one any Grand Company can wear, then not Dated, then more dye channels, then the lowest row (core `defaultCharaTwin`). The `+N` chip is green when a twin was named to fix a problem, amber when nothing fixes it, grey when the pick is a free choice; it opens the picker (popover on desktop, bottom sheet on a phone) with each twin's facts and why a failing twin fails. Picks live with the loaded file (they survive leaving the reader), never in storage. A piece the verdict flags always gets a row, dyed or not.

**The export sheet.** Copy list and Export .md open a preview of the GPOSERS list: one editable `Acquisition:` field per piece, filled from api-worker's line for the named twin (≥ 0.15.0), FILLED / EDITED / BLANK counts, WHAT GETS COPIED beside it, Reset all, Save .md and Copy list (the clipboard write starts inside that click, for WebKit). Edits are kept in `localStorage` keyed by a hash of the gear (slot, the family's row, the stains; the model for a piece with no item) — never the file or the character; for the page only when storage refuses the write — and a twin pick never overwrites one: the row offers Keep mine / Use new source. Two identical rings are written once as `Rings:`.

---

## Tool ID to Route Mapping

`ROUTES` in `src/services/router-service.ts` (History API, not hash). Legacy v3 paths in `LEGACY_ROUTE_REDIRECTS` are rewritten with `replaceRoute()`; root or unknown paths land on the default tool (`harmony`). `dc`, `dye`, `ui` query params are preserved across navigation (`PRESERVED_PARAMS`); a hand-off that names its own `dye` replaces the preserved one, and the two tools that read `dye` (Harmony, Budget) consume it: each drops it from the URL once its `handleDeepLink` has applied and stored the dye, so it reaches the next tool only when it was never applied. Keyboard `1`–`9` switch the first nine tools in `ROUTES` order and `0` the tenth (`KeyboardService`).

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
| `glamour` | `/glamour` (Glamour Reader) | 0 | — (new in 5.13.0) |

The tool paths also have dynamic OpenGraph cards from `og-worker` (`?lang=`), which consumes the same stainID/hex share grammar; the site root uses static cards under `public/og/`.

---

## Related Documentation

- [Components](components.md) - Shell, shared components, services
- [Theming](theming.md) - Theme system
- [Overview](overview.md) - Web app overview
- `docs/research/monorepo-2.0/` - per-tool port specs (design intent; the code decides what shipped)
