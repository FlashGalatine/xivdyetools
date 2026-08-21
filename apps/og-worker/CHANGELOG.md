# Changelog

All notable changes to the XIV Dye Tools OpenGraph Worker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2026-08-21

Security audit remediation (docs/audits/2026-08-21-security, FINDING-005). Minor bump: new request guards and an edge cache; card output for valid inputs is unchanged.

### Security

- **`/og/*` path-segment length guard** (`index.ts`): any segment longer than 64 characters, or a path longer than 512, is answered with `400 {"error":"Request path too long"}` before any card is generated. A 16 KB `:color` on `/og/swatch/:color/:limit` used to reach the not-found card and its text wrapper — measured at **177 s of CPU** in the regression test — unauthenticated, unrate-limited and uncached.
- **Linear-time text layout** (`services/svg/band.ts`): `fit()` and `wrapName()` re-measured the remaining string on every trimmed character (quadratic / cubic). They now take one forward pass using `estimateTextWidth`'s per-code-point additivity, clip inputs at 512 code points, and hyphenate with a single scan per fragment. Same output for every real dye/preset name.
- **Not-found card echo is capped** (`services/svg/band-shared.ts`): `notFoundBand` clips the echoed input to 32 code points + `…` (`clipLabel`, `NOT_FOUND_LABEL_MAX`) before it reaches layout.

### Added

- **Edge cache for rendered PNGs** (`index.ts`): `/og/*` GET 200s are stored in `caches.default` keyed on the full URL (lang / frame / algo all vary the image) and served from the cache on repeat requests; the `Cache-Control` / `CDN-Cache-Control` headers renderOGImage sets were inert on their own, so every hit was a full resvg raster. Error responses are not cached; outside Workers (tests) the middleware is a pass-through.

## [2.2.0] - 2026-08-21

The 2026-08-20 i18n audit (`docs/audits/2026-08-20-og-worker-i18n/I18N_AUDIT.md`, 14 findings)
executed in three commits plus a web-app companion. Headline: under `?lang=` the **picture** was
localized but the **words around it** were not — and no link the web-app produced ever carried
`?lang=`, so the localized path was unreachable from real shares.

### Added

- **`OG_EMBED` ×6 (`services/og-embed.ts`)** — every `og:title` / `og:description` sentence, the
  root and catch-all embeds, the swatch gender pair and the one body string, authored in all six
  locales and filled by `embed()`. Until now these were English templates with localized nouns
  spliced in (`Snow White - 分裂補色 Harmony | XIV Dye Tools`, `Explore geteiltes komplement color
  harmonies…`). The 2.0.0 note "every social preview now respects the sharer's locale" described the
  four nouns, not the sentences. Lives in its own file because `scripts/subset-cjk-fonts.py` parses
  every locale block of `og-strings.ts`, and browser text must not bloat the card subsets.
- **`OG_ROLE` ×6 (`og-strings.ts`)** — the band role words (BASE, START/END, BUYABLE, TARGET,
  CLOSEST PAIR, AS DESIGNED, NOT FOUND, CURATED, BEST, VENDOR, COFFER, BOARD, NO STAIN ID) were
  English literals on every card in every locale. They now follow the bot's card vocabulary
  (`bot-logic` `card.base` = BASIS / ベース, `card.target` = ZIEL / 目標色, `card.designed` =
  WIE ENTWORFEN / 本来の色) so the unfurl and the bot embed of one result agree. Codes stay codes:
  A/B/C, `ALGO_TAG`, `LENS_SHORT`, STD SPECTRUM / WIDE #1, `216 G`. `notFoundBand()` takes the
  locale. CJK subsets re-cut (JP 372 KB, SC 558 KB, KR 185 KB); `font-coverage.test.ts` covers the
  new table.
- **`OGData.locale`** → `<html lang="…">`, a new `og:locale` meta (`ja_JP`, `de_DE`, …), and the
  body link text. Was `lang="en"` for every locale.
- **Tests:** a ja gate in `og-data-generator.test.ts` renders every tool's share and asserts no
  English word survives in the title or description; `roles-i18n.test.ts` asserts the role words
  per card per locale; `OG_EMBED` / `OG_ROLE` completeness and placeholder parity ×6; root and
  catch-all honour `?lang=`.

### Fixed

- **Dye names in the embed localize like they do on the card** — `getDyeInfo()` went through
  `dye.name` (EN) while every adapter used `getLocalizedDyeName()`.
- **Tool names in the embed title come from `OG_DECK`, not core `tools.*`** — core has no
  `extractor` / `presets` / `budget` (`getToolName()` fell through to a formatted key: `Presets |
  XIV Dye Tools` in all six locales) and its six older names differ from the 5.0 page titles the
  deck quotes in 20 of 36 cells (de `Verlaufs-Generator` vs the card's and page's
  `Verlauf-Ersteller`). One unfurl, one vocabulary.
- **No `.toLowerCase()` on localized nouns** — German lost its capitals (`geteiltes komplement`,
  `deuteranopie`); EN keeps its mid-sentence case via the templates.
- **Swatch race / gender resolve** through core `clans` / `races` and the new gender pair instead
  of echoing URL slugs (`female miqote 髪の色`).
- **`'Color Vision'` fallback** (accessibility without `?vision=`) is a ×6 string.
- **Budget deck ja/zh** — `{name}` is in the `budgetBest` template, so no ASCII space follows the
  fullwidth colon (`最良： ピュア…` → `最良：ピュア…`); `deckLine()` fills any `{placeholder}`.
- **`DEFAULT_DECK.label`** (`/HARMONY` … ×9) was dead — `index.ts` builds the chip from the
  localized `TOOL_TAG`. Removed.

### Companion (web-app)

- `ShareService.generateUrl` now appends `lang=<current locale>` for non-English locales
  (`apps/web-app`, same branch). og-worker resolves locale from `?lang=` and from nothing else —
  crawlers send no useful `Accept-Language` — so this is the change that makes everything above
  reachable from a real share. English stays unparameterised (EN cache keys stay bare).

## [2.1.0] - 2026-08-18

The 2026-08-18 dead-code audit (`docs/audits/2026-08-18-og-worker-dead-code/`,
28 findings) executed in four commits. Roughly 500 production lines of
15E-rewrite sediment removed, three functional gaps the audit surfaced closed,
and one guardrail restored.

### Fixed

- **The three 5.0 tools' embeds finally reach their cards (DEAD-001).** `generateOGDataForTool` had no `extractor` / `presets` / `budget` cases, so every share URL for those tools emitted the *root* default card and `/og/extractor|presets|budget/*` were unreachable from any embed. Now `?colors=` → `/og/extractor/<colors>.png`, `/presets/<id>` (the web app shares presets as a **path**, so a `/presets/:presetId` crawler route exists) → `/og/presets/<id>.png` for curated slugs, `?dye=` → `/og/budget/<stainID>.png`; a share URL that resolves to nothing emits `/og/<tool>/default.png`, never the root card. The beta deploy workflow now follows a `/budget/?dye=102` embed end to end as well as harmony.
- **Extractor accepts bare `RRGGBB` entries.** The web app's share grammar carries the palette but not each colour's share, so the image route and `generateExtractorOG` take `RRGGBB` or `RRGGBB-share`; without shares the bands are **equal and ranked** (no invented percentage — proportion is only claimed where it was measured).
- **Comparison honours `?frame=x` (DEAD-010).** The route dropped `frame`, so `twitter:image` for a comparison was a 1200×1050 card X crops; it now renders 1200×630 like the other eight.
- **`?algo=` rides the image URL for harmony / gradient / mixer (DEAD-022)** as it already did for swatch — normalised, with the suite default and unknown values kept off the URL for stable cache keys — so the card computes the Δ the page showed.
- Swatch's `?sheet=` / `?race=` / `?gender=` no longer travel on the *image* URL (the 15E card never drew them; they fragmented the edge cache key per tuple). They still shape the crawler description and the page URL.

### Removed

- `services/svg/dye-helpers.ts`: the character-colour-sheet lookup block (~260 lines, test-only since the 15E rewrite) and the `CharacterColorService` it built at module load on every isolate.
- `services/svg/base.ts` (indigo `THEME`, 1200×630 `OG_DIMENSIONS`, `linearGradient`, ten unused `@xivdyetools/svg` re-exports) and its 342-line test that re-tested the package; `band.ts` / `default-card.ts` import `escapeXml` / `estimateTextWidth` from the package directly.
- `fonts.ts` `cjkStack` / `FONT_FAMILIES`; the `svg/index.ts` barrel is trimmed to what the route table imports; `Env.OG_CACHE` (never bound), `ShareParams`, `HarmonyParams.perceptual`, `SwatchParams.index`; `AnalyticsEvent.cacheHit` (hard-coded `false` at 12 sites — Analytics `doubles` are positional, so `double2` is simply no longer written); the unreachable "legacy 1200-wide SVG" render defaults; unused imports; orphaned JSDoc; item-ID-era comments.
- `scripts/subset-cjk-fonts.py`: the 13 source-font fallback paths that could not exist (only `scripts/.font-sources/` is real).
- The CJK subsets are regenerated: 99 FFXIV job-name glyphs the worker never renders are gone (−45 KB); nothing rendered was lost (verified by cmap diff, not md5 — fonttools rewrites `head.modified` on every run).

### Changed

- `services/svg/tokens.ts` is the one source for the `#0B0B0C` ground, the font stacks, the six mark stripes and the compact-glyph inks; band frame, default cards, raster and the crawler HTML consume it instead of re-typing them. Byte-identical output (111 generator/HTML snapshots).
- `og-data-generator` uses `translator.ts`'s `getLocalizedHarmonyName` / `getLocalizedVisionName` instead of private copies, so the embed text and the card share one lookup; `harmony.ts` uses `notFoundBand()` / `bandGlyph()` like the other eight adapters; `presets.ts` uses `@xivdyetools/types` `PresetData`; `types.ts` `VisionType` is core's.
- `tsconfig.json` inherits the base `noUnusedLocals` / `noUnusedParameters` / `noImplicitReturns` (the override is what let the unused imports ship); `vitest.config.ts` no longer excludes `src/index.ts` from the coverage gate.
- Googlebot's exclusion from the crawler table is now a stated decision with a test, not a commented-out line.
- **A bare `/swatch/` (no `hex=`/`color=`) now emits the swatch default card** instead of inventing a white `#FFFFFF` target — the last "default that fakes data" (2a rule).

### Added (guards — each one caught a real audit finding)

- `pnpm lint` = `knip && knip --production` (`knip.jsonc`), wired into CI through turbo's `lint` task. Production mode works once the *project* glob carries the `!` suffix too — two audits had recorded it as unusable; that was the config gap.
- `services/font-coverage.test.ts`: parses the six bundled TTFs' `cmap` tables (no font library) and fails if any runtime string — core locales via `LocaleLoader`, the `og-strings.ts` tables, the Δ/·/→ glyphs the adapters emit — is not drawable, or if a `ja` CJK glyph is missing from the JP subset; surplus glyphs warn. Parser verified against fonttools' glyph counts.
- `index.test.ts`: every image route × {default, `?frame=x`} → 400×350 / 400×210 (DEAD-010's class); `og-data-generator.test.ts`: route ↔ emitter parity for all nine tools, no exemptions.

## [2.0.0] - 2026-08-16

The 5.0 card rewrite — the 15E band frame across all nine tools — plus a
reconciliation pass against the confirmed design record (`OG Card Directions` /
`OG Default Cards` / `OG X Variants` / `String Pass - OG One-liners`, ratified in
`Decisions.md`; port spec in `docs/research/monorepo-2.0/4-og-15e-band-port-spec.md`),
the share-URL grammar cut-over to stainID, and a routed **beta** environment.

Ships together with `@xivdyetools/svg` 2.0.0, `@xivdyetools/core` 4.0.0,
`@xivdyetools/types` 2.0.0 and web-app 5.0.0 — the share-URL grammar below is
an atomic web + og move, so neither side should go out without the other.

### ⚠️ BREAKING

- **Share URLs key on stainID, not itemID.** Every dye-class parameter the crawler routes read (`?dye=`, `?start=`/`?end=`, `?a=`/`?b=`/`?c=`, comparison / accessibility dye lists, budget's `?dye=`) and every `/og/<tool>/:dyeId…` image path segment is now a **stainID (1–254)**. The dye lookup map in `services/svg/dye-helpers.ts` is re-keyed to `stainID`; legacy itemIDs (≥ 5729, a disjoint range) deliberately **miss into the default-card path** rather than guessing a dye. Budget's `?dye=NAME` outlier is gone (names are localized six ways and were never a stable key). Swatch's bare-colour param is `?hex=` with `?color=` accepted as a read alias. Old shared links from the 4.x web-app therefore unfurl as the tool's default card, not as a wrong dye. (`96f30fc`)
- **`?algo=` speaks the 5.0 matching vocabulary.** `MatchingAlgorithm` is now core's `MatchingMethod` (`ciede2000`, `oklab`, `cie76`, `redmean`, `rgb`, `distinguish`); the retired `euclidean` / `hyab` / `oklch-weighted` values are still accepted in URLs and normalized on use via `normalizeMatchingMethod`, so old links keep rendering. Mixer / gradient blend-space switches cover the new methods; harmony's `HarmonyType` gains `inverted-tetradic` (offsets `[120, 180, 300]`). (`9f6a105`, `f0aed04`)
- **`SubRace` `'Helion'` → `'Helions'`** in the swatch character-colour subrace list, in step with `@xivdyetools/types` 2.0.0. (`be884d1`)
- **A bare `wrangler deploy` / `pnpm deploy` now publishes to real, public hostnames.** The top-level env is the *beta* worker and carries live `beta.xivdyetools.app/<tool>/*` routes (see "Two routed environments" below). It still cannot reach production — `[env.production]` declares its own `routes` and `workers_dev`. (`b06b6a8`)
- `@xivdyetools/worker-middleware` → `@xivdyetools/worker-kit` (Tier 1 package consolidation): `requestIdMiddleware` / `loggerMiddleware` / `getLogger` now import from `@xivdyetools/worker-kit`. Internal to the worker; no route or output change. (`3f73b08`)

### Added

- **The 15E band frame**, one shape for all nine tools, on a 400-wide design grid rastered ×3 (Discord 400×350 → 1200×1050, X 400×210 → 1200×630 via `?frame=x`, which `twitter:image` carries). `og:image:width/height` state the raster size and the two frames take separate cache keys. Each tool is a thin adapter (`services/svg/<tool>.ts`) onto the shared `services/svg/band.ts` frame; the pre-5.0 1200×630 generators are gone.
- **Routes for the three unwired tools** — extractor, presets and budget — in `SUPPORTED_TOOLS`, `wrangler.toml` (both envs) and `services/svg/`: `GET /og/extractor/:colors[.png]` (`RRGGBB-share` pairs, max 5), `GET /og/presets/:presetId[.png]` (slug `^[a-z0-9-]{1,64}$`), `GET /og/budget/:dyeId[.png]`. A shared preset or budget swap no longer unfurls as a bare URL. **Known gap:** the crawler-intercept HTML for these three still emits the generic site title and the root `/og/default.png` — `generateOGDataForTool` has no extractor / presets / budget case yet, so their 15E data cards are reachable only by direct PNG URL (`src/index.test.ts` pins the current behaviour).
- **The 2a default cards**: `/og/default.png` and the new per-tool `GET /og/:tool/default.png` (registered before the parameterised routes so comparison can no longer parse `default.png` as a dye list). A default card never fakes data — no dye names, no Δ, no prices — the mark's six spill stripes carry the identity and the tool's banner glyph floats in a dark tile. The root card takes no tile and drops the method tag. `?lang=` reaches the defaults too (`buildDefaultCardSvg` is locale-aware).
- **Deck strings ×6** (`OG_DECK`) — ten tool name + one-liner pairs, verbatim from the String Pass, the worker's first tool-describing card strings.
- **The localized header tool tag ×6** (`TOOL_TAG`) — `BandCardOptions.toolTag` was documented as localized and passed an English literal at all nine call sites. EN also takes the design's card vocabulary: COMPARE, VISION, EXTRACT, PRESET.
- **Four authored deck lines ×6** (`OG_DECK_LINE`) for the headlines that are not pure data — swatch's "Nearest {n} to {hex}", extractor's count, budget's "Best per point:", accessibility's dye count.
- **Name wrapping** (`wrapName`): band names wrap and hyphenate instead of truncating. A character cap is an EN-width heuristic that decapitates German compounds, and a vertical band is exactly where a long dye name has nowhere to go. resvg has no `hyphens: auto`, so this is that pass.
- **Per-method Δ precision** (`fmtDelta` in `band-shared.ts`): ΔEOK prints its raw scale to 3 dp and DISTINGUISH an integer — a blanket `.toFixed(1)` was flattening raw OKLAB deltas to `0.0`.
- **Fonts**: Fragment Mono is bundled and every value (hex, Δ, price, path) is set in it; a **Noto Sans JP subset** joins SC and KR so JA stops rendering in Chinese letterforms (JP-first fallback is per-locale, so `zh` never picks up Japanese letterforms). Six TTFs total; `scripts/subset-cjk-fonts.py` gains the JP target and downloads sources into the gitignored `scripts/.font-sources/`. (`9399a33`)
- **The human redirect page** (`generateOGHTML`) — the body a refresh-blocking browser or pre-fetching client sees — now wears the console palette (mark stripes, the requested title + description, the accent link) instead of `#1a1a2e` system-font paragraphs. (`69dcbd3`)
- **A routed beta environment.** `beta.xivdyetools.app` had no og-worker coverage, so every beta tool path fell through to web-app's static root card and no shared beta link could ever render a real card. The top-level env is now the beta worker (`xivdyetools-og-worker-dev`), mirroring discord-worker: it routes `beta.xivdyetools.app/<tool>/*` ×9 plus the `og-beta.xivdyetools.app` card host (wrangler provisions the DNS record on first deploy), with `APP_BASE_URL = https://beta.xivdyetools.app` so a shared beta link's embed links back to beta, and its own Analytics Engine dataset (`xivdyetools_og_analytics_beta`) so beta traffic cannot skew production metrics. `routes` and `workers_dev` are declared explicitly in **both** envs so beta's routes can never leak into production by inheritance. `og-beta.` is a separate hostname rather than `beta.xivdyetools.app/og` because `isOgImageHost()` recognises its own image host by comparing the request hostname to `OG_IMAGE_BASE_URL`'s and answers a match by redirecting humans to `APP_BASE_URL` — collapsing the two would bounce every real visitor off every beta tool page. (`b06b6a8`)
- `tests/wrangler-env.test.ts` pins those config invariants per environment (image host ≠ app host, the `/og` prefix on `OG_IMAGE_BASE_URL`, the analytics dataset split, and that no production route names a beta host); each assertion was mutation-tested.
- `.github/workflows/deploy-og-worker-beta.yml` — deploys the beta env off non-`main` branches and then **follows the emitted `og:image` URL end to end**, failing if it 404s or degrades to a default card. A health check stayed green throughout the v1 era while every emitted URL was missing the `/og/` prefix; nothing verified the URL in the metadata was one the worker would serve. The smoke check uses a stainID (`dye=1`, Snow White), not the item ID the old checklist carried — an unrecognised dye degrades to the default card rather than failing, so `dye=5771` rendered a valid-looking card that tested nothing.
- `og.xivdyetools.app` is declared in `wrangler.toml` as a `custom_domain` route (BUG-069 closure — it was dashboard-only). (`d7dba9f`)
- `README.md` for the worker (2026-08-10 README audit).

### Changed

- `OG_IMAGE_BASE_URL` now carries the `/og` suffix in both envs (`https://og.xivdyetools.app/og`, beta `https://og-beta.xivdyetools.app/og`) — the suffix is load-bearing; see the first Fixed bullet. The vitest env fixtures had already assumed this value.
- **Edge / browser TTLs, end state:** image responses `Cache-Control: public, max-age=86400, s-maxage=604800` (24 h browser, 7 d edge, explicit `{ browser, edge }` on `renderOGImage` — no hidden ×7); default cards the same 24 h / 7 d; crawler HTML `max-age=3600, s-maxage=86400`; the root crawler card `max-age=86400`. English stays unparameterised (`?lang=` is only appended for non-`en`) so cache keys stay stable.
- Coverage gate: `branches` 75 → 80 (statements / functions / lines stay 85), part of the 2026-08-11 workspace-wide raise to 90 % packages / 80 % apps.
- Dependencies: `hono` `^4.12.32` → `^4.12.34` (FINDING-001, 2026-08-09 pre-release audit; the CORS-ReDoS advisory does not reach this worker — it mounts no `cors()` and no `hono/language` — but the floor is now explicit), `wrangler` `^4.114.0` → `^4.120.0` (FINDING-004: miniflare 5 / undici 7.29 clears the undici advisories), `@xivdyetools/svg` consumed at 2.0.0 (band primitives), `@xivdyetools/core` at 4.0.0.

### Fixed

- **Algo-less links render with the suite default** — the five image routes defaulted `?algo` to `oklab` while every other surface (and the page a visitor lands on) defaults to `ciede2000`, so a hand-typed or legacy link without `algo` produced a card whose harmony deltas and "Algorithm:" footer disagreed with the page; now `DEFAULT_MATCHING_METHOD` from core (web-app share links always carry `algo`, so those were already correct)
- **The `/og/` prefix**, missing from every emitted `og:image` URL — the routes register under `/og/`, the meta tags pointed one level up, and nothing served that path. No card of any design was ever fetched.
- **`?lang=` reaches the picture.** The text localized six ways around an English card while the worker bundled CJK subsets precisely so it would not have to. `?lang=` now travels with every emitted `og:image` URL.
- **Harmony's Δ measures the right pair** — match → computed ideal, not base → match. A complement is far from its base by definition, so a correct tetrad printed four reds.
- **The emoji glyphs are gone.** `✦ XIV DYE TOOLS` and `🎨 xivdyetools.app` had no glyph in a rasterizer with no emoji font, and arrived as tofu or as nothing.
- **The CJK subsets cover the worker's own card strings.** `subset-cjk-fonts.py` read `packages/core` locales only, so every string authored in `og-strings.ts` — deck names, one-liners, tool tags — was covered by luck alone. It now reads both, and fails loudly if the ×6 tables stop parsing rather than silently under-covering them.
- **The chrome is one chrome.** Data cards drew a single bottom strip (the Turn-15 sketch) while default cards drew the confirmed 30px header / deck / 26px footer. `cardHeader` and `cardFooter` in `band.ts` are now the single source for both families, so the same frame emits the same markup.
- **The X frame keeps its bands.** Names were dropped from every X band and replaced by a one-line summary; the confirmed degrade rule drops the deck *only*, moves its headline to the footer's right slot, and leaves in-band content unchanged. Extractor is the one exception — its narrowest band is under the 11px floor.
- **X source strips scale ×0.66** (accessibility 52→34, extractor 54→36, mixer 46→30) so the split still reads as annotation, not as a second row of bands. They were passing the Discord height through.
- **The mark matches the OG doc's `#ogmark`**, which its own comment claimed to copy verbatim: two spill-stripe widths, the missing `#C8CCD5` bucket outline, and the rim and pour ellipses (the pour is purple, not red).
- **The footer prints the path only.** One resvg text node has no wrapping, so a query string clips at the frame edge rather than reflowing.
- **Budget holds one figure per row on both frames.** A five-band card makes each candidate ~67px wide regardless of height, so neither `Δ5.2 · 216 G` nor `STD SPECTRUM` fits — the latter ellipsised to an identical `STD S…` on every priced band. The price takes the role row, Δ stands alone, and the footer names the tier once.
- Extractor's `N colours` was hardcoded en-GB against the String Pass's explicit EN-US rule, and never localized.
- `renderOGImage`'s default background was still the retired `#1a1a2e`.

### Removed

- `og-card.ts` and its tests — the pre-5.0 1200×630 shell, with no caller left — and the legacy 1200×630 text-and-circles default card.
- The duplicate `ALGO_TAG` map in `harmony.ts`, which shadowed `band-shared.ts`.
- `Habibi-Regular.ttf` (replaced by Fragment Mono for values).

### Removed (2026-08-18 dead-code audit)

- **`services/svg/base.ts`'s `truncateText` and `rgbToHex` re-exports** (DEAD-014/015): both were dropped from `@xivdyetools/svg`'s own barrel as dead (this worker never called either through the re-export). `services/svg/band.ts`'s hard-coded `fill="#CE2222"` on the reduced app mark (`ogMark()`) now reads `@xivdyetools/svg`'s `GLYPH_ACCENT_LIGHT` instead — same value, single source (DEAD-018).
- **DEAD-024 (adopt)**: `services/svg/dye-helpers.ts`'s `ALL_SUBRACES` now derives its subrace set from `@xivdyetools/types`' `RACE_SUBRACES` instead of hand-rolling its own copy; the race-iteration order `buildHexIndex`'s first-match semantics depend on (Viera before Hrothgar — differs from `RACE_SUBRACES`' own key order) is preserved via a local `SUBRACE_SEARCH_ORDER` array. `ALL_SUBRACES` is now exported so `dye-helpers.test.ts` can assert the derived set matches `RACE_SUBRACES` and the pre-adoption order is unchanged.

### Boundary: what this worker does *not* cover

og-worker covers only the **nine tool paths**. The site root `/` is deliberately not routed in either env — `xivdyetools.app/` and `beta.xivdyetools.app/` serve web-app's **static** card from `/og/default.png` (`default-x.png` for X); that artwork and its `_headers` live in `apps/web-app` and are tracked in web-app's changelog. The worker's own `GET /` handler is reached only on the `og.` / `og-beta.` hosts.

### Deploy-day steps

1. No npm publish is required for the deploy itself — `@xivdyetools/svg` 2.0.0 / `core` 4.0.0 / `types` 2.0.0 / `worker-kit` are `workspace:*` deps that both deploy workflows build with `turbo run build --filter=xivdyetools-og-worker...` before `wrangler deploy`. Publish them on the normal package schedule.
2. Re-run `scripts/subset-cjk-fonts.py` if any card string changed since the bundled subsets were generated (new JA/KO/ZH deck glyphs render as tofu otherwise), then commit the regenerated `src/fonts/NotoSans{JP,SC,KR}-Subset.ttf`.
3. **Beta first**: `pnpm --filter xivdyetools-og-worker deploy` (or let `deploy-og-worker-beta.yml` run off the branch). The first deploy provisions the `og-beta.xivdyetools.app` DNS record. Spot-check `https://og-beta.xivdyetools.app/og/harmony/1/tetradic.png` — use a **stainID**, and check the returned card names the dye.
4. **Production**: `pnpm --filter xivdyetools-og-worker deploy:production` (CI: `deploy-og-worker.yml` on `main`). `OG_IMAGE_BASE_URL` is a `wrangler.toml` var (`https://og.xivdyetools.app/og`) — no dashboard edit is needed, but any dashboard override of that var must carry the `/og` suffix too or every card URL 404s again.
5. Deploy web-app 5.0.0 in the same window — old 4.x links (itemID grammar) unfurl as default cards until the app emits stainID URLs.
6. Validate a real shared link in Discord *and* X — the embed should render the new card within ~5 s of cache expiry; the previous production cards were cached up to 7 days at the edge.

## [1.4.0] - 2026-07-19

2026-07-18 audit remediation (Sprint 7) — OG image fidelity.

### Fixed

- **BUG-031**: the validated `?algo=` and 3-dye `ratio` parameters are finally used — harmony match deltas, gradient interpolation space (OKLAB / CIELAB / RGB via core's mixers), and blend/step matching all honor the requested algorithm, and the 3-dye mixer applies the ratio (A = ratio%, B/C split the remainder). The "Algorithm:" footer on shared images no longer advertises math that didn't run.
- **BUG-068**: `renderOGImage` takes explicit `{ browser, edge }` TTLs — the old single parameter was silently multiplied by 7 for the edge, giving `/og/default.png` a 49-day edge TTL against a "cache for 7 days" comment.
- **BUG-069**: pass-throughs guard against fetching the worker's own `og.` custom domain — stray non-crawler hits get a 302/404 instead of a Cloudflare 1042 self-fetch error page.

### Changed

- **REFACTOR-009**: the local fork of the SVG primitives is replaced by `@xivdyetools/svg` re-exports (~230 duplicated lines gone) — inheriting the package's attribute escaping and CJK-aware truncation, which fixes ja/ko/zh dye names overflowing their OG swatch columns.
- **REFACTOR-024**: CLAUDE.md font documentation matches reality (five bundled fonts incl. CJK subsets + regeneration trigger); one shared `DyeService` instance instead of two per isolate; locale resolution deduplicated across all seven image routes.
- **OPT-005**: character-color-by-hex lookup uses a lazily built reverse index — one `Map.get` instead of up to 64 sequential sheet scans per swatch request.
- **OPT-023**: O(1) itemID lookups via a precomputed map; the harmony scan computes ΔE only for winning candidates (~99% fewer computations).

## [1.3.0] - 2026-05-29

### Added

- **CJK font support**: Noto Sans SC and Noto Sans KR subset fonts bundled into the worker (289.6 KiB + 176.5 KiB = 466.1 KiB total) — OG preview cards now render actual Japanese, Korean, and Chinese dye names when `?lang=ja`, `?lang=ko`, or `?lang=zh` is requested, instead of falling back to English.
  - `src/fonts/NotoSansSC-Subset.ttf` (289.6 KiB) — covers Chinese ideographs + Japanese kana for all dye names present in `packages/core/src/data/locales/`
  - `src/fonts/NotoSansKR-Subset.ttf` (176.5 KiB) — Korean Hangul syllables only (OPT-001: scope restricted to Hangul U+AC00–U+D7AF + U+1100–U+11FF + ASCII < 0x80, excluding the CJK Han block unused by the Korean locale; saves ~595 KiB vs full Noto Sans KR)
  - New subsetting script at `scripts/subset-cjk-fonts.py` — reads dye-name characters from `packages/core/src/data/locales/` only (narrower than `discord-worker`'s scope, which also covers bot-i18n UI strings). Re-run when new dyes are added whose names contain characters outside the current subset
- **`FONTS.primaryCjk` / `FONTS.headerCjk`** exported from `services/svg/base.ts` — CJK-aware fallback chains (`'Onest, Noto Sans SC, Noto Sans KR'` and `'Space Grotesk, Noto Sans SC, Noto Sans KR'`). Static English labels (tool names, section headers, hex codes, delta values) continue to use `FONTS.primary` / `FONTS.header` — only text elements that render a localized dye name use the CJK chain

### Fixed

- **CJK locale fallback removed** (`services/translator.ts`): `getLocalizedDyeName()` had a `CJK_LOCALES` guard (`new Set<LocaleCode>(['ja', 'ko', 'zh'])`) that short-circuited to `dye.name` (the English name) for those three locales, bypassing `TranslationProvider` entirely. This was a temporary stub added when CJK rendering was blocked by missing fonts. Guard removed — all 6 locales now route through `ogTranslator.getDyeName()` uniformly, falling back to `dye.name` only when the locale data itself is missing
- **All six SVG generators** updated to apply `FONTS.primaryCjk` / `FONTS.headerCjk` on every text element that outputs a localized dye name:
  - `harmony.ts`: input dye name (large card label), harmony match names below swatches
  - `comparison.ts`: dye name below each swatch
  - `gradient.ts`: step dye-name labels, `startDye → endDye` summary line
  - `swatch.ts`: match dye name
  - `accessibility.ts`: original-color dye name in the left column
  - `mixer.ts` (7 call sites): dyeA name, dyeB name, dyeC name (3-dye variant), `≈ closestMatch` line for both 2-dye and 3-dye layouts

---

## [1.2.0] - 2026-04-29

### Added

- **REFACTOR-001** (2026-04-28 audit): OG embed metadata is now **localized via `?lang=` query param**. The four hardcoded English display-name maps (`TOOL_NAMES`, `HARMONY_NAMES`, `VISION_NAMES`, `SHEET_NAMES`) were removed and replaced with calls to the new `TranslationProvider` methods on `@xivdyetools/core`. Every social media link preview now respects the sharer's locale (en / ja / de / fr / ko / zh) — Discord, Twitter, Facebook crawlers will see localized titles and descriptions when the shared link includes `?lang=<code>`.
  - Module-scoped `TranslationProvider` is bootstrapped once at module init with all 6 locales preloaded, so per-request lookups are synchronous and stateless (no race risk between concurrent requests with different locales).
  - The kebab→camel conversion `'split-complementary'` → `'splitComplementary'` is handled by a thin `harmonyToKey()` shim — only that one harmony name differs in case style between og-worker's domain types and core's localization keys.
  - Six new vitest cases exercise the localized path (Japanese harmony names, German tool fallback, Korean sheet names in swatch descriptions, French short vision name in accessibility titles, plus the kebab/camel boundary). Total test count: 344.
- **REFACTOR-002** (2026-04-28 audit): Wired the shared `@xivdyetools/worker-middleware` stack — `requestIdMiddleware()` and `loggerMiddleware({ serviceName: 'xivdyetools-og-worker' })` — so og-worker now emits structured JSON logs with cross-worker request IDs, matching the discord-worker / presets-api / api-worker observability pattern.
- Global `app.onError` handler with structured logging (og-worker previously had none, so unhandled errors fell through to Hono's default 500 with no log signal).

### Changed

- `createToolHandler` now types its handler argument as `Context<{ Bindings: Env }>` (replacing a hand-rolled inline subset). No behavior change — enables `getLogger(c)` to type-check.
- Replaced an ad-hoc `console.log` in the crawler-tool handler with a structured `getLogger(c)?.info('Serving OG metadata', …)` call carrying tool, locale, crawler, URL, and OG title fields.
- All six per-tool generators (`generateHarmonyOGData`, `generateGradientOGData`, etc.) and the `generateOGDataForTool` dispatcher gained an optional trailing `locale: LocaleCode = 'en'` parameter. Backwards-compatible default; existing callers keep working without changes.

---

## [1.1.0] - 2026-04-07

### Added

- **TEST-003**: 50 route-level integration tests covering all OG image endpoints — parameter validation (NaN, out-of-bounds), boundary values, crawler vs. non-crawler routing, health check, and fallback routes; total test count: 338

### Changed

- Migrated request-ID and logger middleware to `@xivdyetools/worker-middleware`; deleted local middleware files
- **ARCH-001**: Removed `nodejs_compat` compatibility flag from `wrangler.toml`
- **BUG-001**: Re-enabled strict TypeScript checks; cleaned up unused variables and implicit returns

---

## [1.0.7] - 2026-03-18

### Fixed

- **ARCH-001**: Deploy workflow now triggers on changes to `logger` package (transitive dependency via core)

---

## [1.0.6] - 2026-03-09

### Changed

- Updated `hono` from 4.12.3 to 4.12.5 (security: SSE injection, cookie injection, middleware bypass fixes)
- Updated `@cloudflare/workers-types` from 4.20260305.0 to 4.20260307.1
- Updated `wrangler` from 4.69.0 to 4.71.0
- Updated `@types/node` from 25.3.3 to 25.3.5

## [1.0.5] - 2026-03-01

### Changed

- Migrate type imports (`Dye`, `SubRace`, `Gender`) across 8 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)

## [1.0.4] - 2026-02-21

### Security

- **FINDING-011**: Add NaN validation for all `parseInt`'d `dyeId` route parameters — prevents unhandled 500 errors from crafted non-numeric URLs in harmony, gradient, and mixer routes
- **FINDING-013**: Apply `escapeHtml()` to `themeColor` meta tag — defense-in-depth against XSS if upstream hex validation is bypassed

## [1.0.3] - 2026-02-19

### Security

- **FINDING-003**: Added parameter bounds validation to all OG image generation routes to prevent resource exhaustion
  - Gradient: `steps` must be 2–20 (returns 400 if exceeded)
  - Mixer: `ratio` must be 1–99 (returns 400 if out of range)
  - Swatch: `limit` must be 1–20 (returns 400 if exceeded)
  - Comparison/Accessibility: `dyeIds` limited to 1–16 IDs (returns 400 if exceeded)
  - Replaced silent `isNaN` fallbacks with explicit error responses

---

## [1.0.2] - 2026-01-26

### Security

- Added pre-commit hooks for security scanning (detect-secrets, trivy)
  - Scans for accidentally committed secrets before push
  - Vulnerability scanning for dependencies and container images

### Changed

- Added Dependabot configuration for automated dependency updates
  - Weekly npm dependency updates
  - Weekly GitHub Actions updates

---

## [1.0.1] - 2026-01-25

### Security

- **FINDING-004**: Updated `hono` to ^4.11.4 to fix JWT algorithm confusion vulnerability (CVSS 8.2)
- **FINDING-005**: Updated `wrangler` to ^4.59.1 to fix OS command injection in `wrangler pages deploy`

---

## [1.0.0] - 2025-01-19

### Added

#### Core Infrastructure
- **Cloudflare Worker** with Hono framework for routing and request handling
- **Crawler detection** for Discord, Twitter/X, Facebook, LinkedIn, Slack, Telegram, and WhatsApp
- **Analytics tracking** via Cloudflare Analytics Engine for share events and image requests

#### OG Image Generation
- **SVG rendering engine** with reusable primitives (`rect`, `text`, `circle`)
- **PNG conversion** using `resvg-wasm` WebAssembly library
- **Custom fonts** embedded in the worker:
  - Onest (primary UI text)
  - Space Grotesk (headers and branding)
  - Habibi (decorative accents)

#### Tool-Specific OG Images

- **Harmony Tool** (`/og/harmony/:dyeId/:harmonyType.png`)
  - Displays base dye with color harmony visualization
  - Supports: complementary, analogous, triadic, split-complementary, tetradic, square
  - Shows dye name, hex code, and matched harmony colors with delta values

- **Gradient Tool** (`/og/gradient/:startId/:endId/:steps.png`)
  - Visualizes dye gradient from start to end color
  - Shows intermediate steps with matched dyes
  - Displays start/end dye names and hex codes

- **Mixer Tool** (`/og/mixer/:dyeAId/:dyeBId/:ratio.png`)
  - Shows two input dyes with their blend result
  - Displays blend ratio percentage
  - Shows closest matching dye to the blended color

- **Swatch Matcher** (`/og/swatch/:color/:limit.png`)
  - Input color display with hex and RGB values
  - Top 4 matching dyes with delta (Δ) distance values
  - Color-coded delta indicators (green < 3, yellow < 6, red ≥ 6)
  - **Character color position display**: Shows where the input color appears in the FFXIV character creator (e.g., "Eye Colors - Row 4, Col 3")

#### Character Color Lookup
- Search across all FFXIV character color sheets:
  - **Shared colors**: Eye Colors, Highlights, Lip Colors (Dark/Light), Tattoo/Limbal, Face Paint (Dark/Light)
  - **Race-specific colors**: Hair Colors and Skin Colors for all 16 subraces and both genders
- Position calculation using 8-column grid matching in-game UI

#### OG Metadata Generation
- Dynamic `og:title`, `og:description`, `og:image` tags per tool
- Twitter Card support (`twitter:card`, `twitter:image`)
- Proper caching headers (1h browser, 24h edge)

#### API Routes
- Tool interception routes: `/harmony/*`, `/gradient/*`, `/mixer/*`, `/swatch/*`, `/comparison/*`, `/accessibility/*`
- Direct image routes: `/og/harmony/...`, `/og/gradient/...`, `/og/mixer/...`, `/og/swatch/...`
- Default image: `/og/default.png`
- Health check: `/health`

### Technical Details

- **Image dimensions**: 1200×630px (standard OG image size)
- **Bundle size**: ~4MB (1.3MB gzipped)
- **Startup time**: ~45ms
- **Supported algorithms**: OKLAB (default), CIEDE2000, RGB

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| hono | ^4.10.7 | Web framework |
| @resvg/resvg-wasm | ^2.6.2 | SVG → PNG |
| @xivdyetools/core | ^1.14.0 | Dye database |
| @xivdyetools/types | ^1.7.0 | Type definitions |

---

## Planned
- Comparison tool OG images
- Accessibility tool OG images
- KV caching for generated images
- Budget tool support (if shareable)
