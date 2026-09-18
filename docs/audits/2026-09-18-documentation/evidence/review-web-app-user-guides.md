# Documentation audit — cluster `web-app-user-guides`

Reviewed 2026-09-18 against worktree HEAD `0fec18f4` (`origin/main`).

## Coverage table

| file | sections reviewed | result |
|------|--------------------|--------|
| docs/user-guides/index.md | all | reviewed |
| docs/user-guides/web-app/accessibility.md | all | reviewed |
| docs/user-guides/web-app/budget-suggestions.md | all | reviewed |
| docs/user-guides/web-app/color-harmony.md | all | reviewed |
| docs/user-guides/web-app/community-presets.md | all | reviewed |
| docs/user-guides/web-app/dye-comparison.md | all | reviewed |
| docs/user-guides/web-app/dye-mixer.md | all | reviewed |
| docs/user-guides/web-app/faq.md | all | reviewed |
| docs/user-guides/web-app/favorites-collections.md | all | reviewed |
| docs/user-guides/web-app/getting-started.md | all | reviewed |
| docs/user-guides/web-app/gradient-builder.md | all | reviewed |
| docs/user-guides/web-app/palette-extractor.md | all | reviewed |
| docs/user-guides/web-app/swatch-matcher.md | all | reviewed |

## Candidates

| cand-id | sev | kind | file:line | claim vs reality | evidence (source) |
|---------|-----|------|-----------|-------------------|--------------------|
| C1 | MEDIUM | WRONG | docs/user-guides/web-app/swatch-matcher.md:169-176 | "Understanding Delta E" table gives bands 0-1 "Virtually identical", 1-2 "Very close", 2-10 "Noticeable but similar", 10+ "Visibly different" | packages/core/src/config/band-vocabulary.ts:93-100 (`match.ciede2000` cuts are `[5, 10, 20]`, i.e. SAME<5/CLOSE<10/NEAR<20/FAR≥20 — the same 4-band system every other guide documents, e.g. budget-suggestions.md:95-100, dye-comparison.md:84-89, palette-extractor.md:84-89, faq.md:46-51); apps/web-app/src/components/v4/result-card.ts:1033-1037 (`classifyBandTier(deltaE2000, 'ciede2000', 'match')`) is what tints the Swatch Matcher's own CLOSEST DYES cards, via apps/web-app/src/components/swatch-tool.ts:2325-2326 |
| C2 | MEDIUM | WRONG | docs/user-guides/web-app/swatch-matcher.md:63 | "The ⋮ menu on a card offers Inspect Dye in… (Harmony, Budget, Accessibility, Comparison), Transform Dye in… (Gradient, Mixer) and Open in browser… (Universalis, GarlandTools)" — Inspect list omits Swatch, Open-in-browser list omits TeamCraft and Saddlebag Exchange | apps/web-app/src/components/v4/result-card.ts:1799-1836 (Inspect Dye in… unconditionally renders Harmony/Budget/Accessibility/Comparison/**Swatch**, 5 items — every other guide using this same shared component lists all 5, e.g. color-harmony.md:47, dye-mixer.md:40) and :1866-1895 (Open in browser… unconditionally renders Universalis/GarlandTools/**TeamCraft**/**Saddlebag Exchange**, 4 sites — matches color-harmony.md:47's own enumeration). swatch-tool.ts uses the same `v4-result-card` element (swatch-tool.ts:2325-2326), so it renders the identical menu |
| C3 | MEDIUM | WRONG | docs/user-guides/web-app/swatch-matcher.md:123 | "Pick any dye in the Color Palette drawer… and the grid lights up the **three** closest swatches" | apps/web-app/src/components/swatch-tool.ts:631-645 — code comment: "5.0: the hardcoded top-3 is cut — the result count follows the same maxResults control as the forward side" (`scored.slice(0, this.maxResults)`); `maxResults` ranges 1–6 (apps/web-app/src/components/v4/config-sidebar.ts, swatch config block, `.min=${1} .max=${6}`) — the shown count is whatever Max Results is set to, not a fixed three |
| C4 | MEDIUM | MISSING | docs/user-guides/web-app/swatch-matcher.md (DYES ON THIS GLAMOUR section, ~L89-113) | The guide never mentions that clicking a gear-slot row opens an "Open in…" link menu for that piece | apps/web-app/src/components/chara-import.ts:481-514 (`attachItemLinks` wires each gear row to `showItemLinksMenu`) + apps/web-app/src/components/item-links-menu.ts (menu with Mirapri/GarlandTools/TeamCraft/Gamer Escape/Lodestone links) — shipped as PR #173 (web-app 5.9.0, "open a glamour piece in seven community databases"), entirely unmentioned in the guide's own DYES ON THIS GLAMOUR section |
| C5 | MEDIUM | MISSING | docs/user-guides/web-app/swatch-matcher.md (DYES ON THIS GLAMOUR section, ~L89-117) | The guide never mentions the "Copy list" / "Export .md" buttons | apps/web-app/src/components/chara-import.ts:1373-1406 (`renderListActions` — "Copy list" / "Export .md" buttons beside "Make a palette", writing the whole worn glamour as a GPOSERS submission template) — shipped as PR #187 (web-app 5.10.0, "Copy list / Export .md for the glamour equipment list"), not documented anywhere in the guide |
| C6 | MEDIUM | WRONG | docs/user-guides/web-app/getting-started.md:110 | "Share links — seven of the nine tools have a Share button… Palette Extractor and Community Presets do not — a picture and a browsable list have nothing to put in a link" | apps/web-app/src/components/extractor-tool.ts:1166-1170 (`v4-share-button` wired to `tool = 'extractor'`) — the extractor's share link was restored by commit `3eaca5a7` "feat(web-app): restore the Palette Extractor's share link (BUG-002)" and is exactly what docs/user-guides/web-app/palette-extractor.md:57-61 ("Share" section) itself documents. Only Community Presets truly lacks a share button (no `v4-share-button` in apps/web-app/src/components/v4/preset-tool.ts). The correct count is **eight** of nine tools, and Palette Extractor should be dropped from the "do not" list |

## Positive controls (checked and correct — do not re-chase)

- Tool rail order, app-title overrides ("Preset Palettes", "Character Matcher") and the `1`-`9` keyboard mapping (`1` Harmony … `6` Presets `7` Budget `8` Swatch `9` Mixer) — apps/web-app/src/services/router-service.ts:74-82, apps/web-app/src/services/keyboard-service.ts:31-41, apps/web-app/src/locales/en.json (`tools.presets.title`, `tools.character.title`).
- Two-theme claim (Light/Dark only, novelty themes retired) — apps/web-app/src/services/theme-service.ts:78,102,130-134.
- 6 supported languages (en/ja/de/fr/ko/zh) — apps/web-app/src/locales/*.json.
- Harmony's 10 harmony types and 5 colour wheels (RGB/RYB/Munsell/OKLCH hue/OKLCH lightness) — apps/web-app/src/services/harmony-generator.ts:40-49; core CLAUDE.md wheel list.
- Harmony "Additional Dyes per Harmony Color" slider range 1-5 — apps/web-app/src/shared/constants.ts:114-117.
- Gradient Builder step count range 3-12 and the 5 colour spaces (RGB/HSV/LAB/OKLCH/LCH) — apps/web-app/src/components/gradient-tool.ts:104-105,936-940.
- Dye Mixer's 6 models × 5 ratios (RYB/Spectral/OKLAB/LAB/HSL/RGB; 10/30/50/70/90) and Max Results 3-8 — apps/web-app/src/components/mixer-tool.ts:1167,1179, and the maxResults slider (min 3 / max 8).
- Palette Extractor: Max Colors 3-10 (default 4, matching the guide's "4 of 4" example), Pixel Sample Area 1×1-16×16, 20 MB / PNG·JPG·WebP·GIF drop limits, 6-pick cap, share link carrying up to 5 colours — apps/web-app/src/components/v4/config-sidebar.ts:1073-1120, apps/web-app/src/shared/constants.ts:127 (`MAX_USER_FILE_BYTES`), apps/web-app/src/locales/en.json:316-317, apps/web-app/src/components/extractor-tool.ts:126 (`MAX_PICKS`), apps/web-app/src/services/share-service.ts:178-190.
- Palette Extractor mobile "Take a photo" is still a `capture` file input (not the deleted live-camera modal) — confirmed via commit `a121ae91` ("delete CameraService… Mobile capture is unaffected and unchanged") and apps/web-app/src/components/extractor-tool.ts:577-596.
- Budget Suggestions: match line range 2-20 default 8, tier prices (216 gil / 100 Skybuilders' Scrips / 600 Cosmocredits), Quick Picks showing 6 dyes, SEND TO row (Harmony/Compare/Copy item name/Save swap/Share) — apps/web-app/src/components/budget-tool.ts:112-114,865-866,1143-1189; packages/core/src/config/consolidated-ids.ts:56-86.
- Dye Comparison match line range 1-15 default 5 — apps/web-app/src/components/v4/config-sidebar.ts:1239-1247.
- Community Presets: 15 official presets, 8 categories, submission limits (name 2-50, description 10-200, dyes 3-6, ≤2 secondary categories, 10 submissions/day) and saved-preset cap of 200 — packages/core/src/data/presets.json, apps/presets-api/src/services/validation-service.ts:19-39, apps/presets-api/src/services/rate-limit-service.ts:24, apps/web-app/src/services/saved-presets-service.ts:23. Bot `/preset` subcommands (list/show/random/submit/vote/edit/favorite, no delete) — apps/discord-worker/src/handlers/commands/preset.ts:101-171.
- Favorites & Collections limits: 40 favorites, 50 saved records, 20 dyes/record, 50-char names — apps/web-app/src/services/collection-service.ts:142-146.
- Accessibility Checker: ΔE shift ramp 5/10/20/35, tier words Clear/Fine/Tight/Collapsed, 441.67 RGB-cube diagonal, WCAG 3:1 top band — apps/web-app/src/components/metric-help.ts:109-119, apps/web-app/src/locales/en.json:368-371,456, packages/core/src/config/band-vocabulary.ts:124-131 (`RATIO_BANDS.accessibility`).
- Swatch Matcher tribes/subraces (8 tribes, 16 subraces) and 8-swatch grid columns — packages/core/src/data/character_colors/index.json.
- Swatch Matcher Max Results range 1-6 — apps/web-app/src/components/v4/config-sidebar.ts (swatch config block).
- Evercold notice wording — apps/web-app/src/locales/en.json:100-101.
- Default tool on load is Color Harmony Explorer — apps/web-app/src/services/router-service.ts:67.

## Rejected items (looked wrong, were right)

- Palette Extractor's "Take a photo" mobile flow looked stale after #172 removed `CameraService`, but the removal explicitly preserved the `capture="environment"` file-input path the guide describes; only the unreachable live-preview modal was deleted. Not a finding.
- Considered flagging the Dye Mixer/Gradient/Extractor "Inspect Dye in…" lists for omitting the site names in "Open in browser…", but those guides never enumerate the sites (unlike swatch-matcher.md and color-harmony.md), so there is nothing to contradict.
