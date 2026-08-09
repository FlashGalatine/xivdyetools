# Changelog

All notable changes to the XIV Dye Tools OpenGraph Worker will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-09

The 5.0 card rewrite, plus a reconciliation pass against the confirmed design
record (`OG Card Directions` / `OG Default Cards` / `OG X Variants` /
`String Pass - OG One-liners`, ratified in `Decisions.md`).

### Added

- **The 15E band frame**, one shape for all nine tools, on a 400-wide design grid rastered ×3 (Discord 400×350 → 1200×1050, X 400×210 → 1200×630 via `?frame=x`, which `twitter:image` carries). `og:image:width/height` state the raster size and the two frames take separate cache keys.
- **Routes for the three unwired tools** — extractor, presets and budget — in `SUPPORTED_TOOLS`, `wrangler.toml` and `services/svg/`. A shared preset or budget swap no longer unfurls as a bare URL.
- **The 2a default cards**: `/og/default.png` and `/og/:tool/default.png`. A default card never fakes data — no dye names, no Δ, no prices — the mark's six spill stripes carry the identity and the tool's banner glyph floats in a dark tile. The root card takes no tile and drops the method tag.
- **Deck strings ×6** (`OG_DECK`) — ten tool name + one-liner pairs, the worker's first tool-describing card strings.
- **The localized header tool tag ×6** (`TOOL_TAG`) — `BandCardOptions.toolTag` was documented as localized and passed an English literal at all nine call sites. EN also takes the design's card vocabulary: COMPARE, VISION, EXTRACT, PRESET.
- **Four authored deck lines ×6** (`OG_DECK_LINE`) for the headlines that are not pure data — swatch's "Nearest {n} to {hex}", extractor's count, budget's "Best per point:", accessibility's dye count.
- **Name wrapping** (`wrapName`): band names wrap and hyphenate instead of truncating. A character cap is an EN-width heuristic that decapitates German compounds, and a vertical band is exactly where a long dye name has nowhere to go. resvg has no `hyphens: auto`, so this is that pass.
- Fragment Mono is bundled and every value is set in it; a JP subset joins SC and KR so JA stops rendering in Chinese letterforms.

### Fixed

- **The `/og/` prefix**, missing from every emitted `og:image` URL — the routes register under `/og/`, the meta tags pointed one level up, and nothing served that path. No card of any design was ever fetched.
- **`?lang=` reaches the picture.** The text localized six ways around an English card while the worker bundled CJK subsets precisely so it would not have to.
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

- `og-card.ts` and its tests — the pre-5.0 1200×630 shell, with no caller left.
- The duplicate `ALGO_TAG` map in `harmony.ts`, which shadowed `band-shared.ts`.

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
