# Sweep C1 findings — discord-worker + web-app (READMEs, CLAUDE.md, ToS, docs/projects/<app>)

Verified against the worktree at 1eb57cda (= origin/main 2026-09-05). Evidence is path:line in the code.

## discord-worker

| ID | File:line | Claim (quoted) | Reality (evidence) | Sev | Proposed fix |
|---|---|---|---|---|---|
| DW-01 | `docs/projects/discord-worker/commands.md:64`, `:504`, `:516`, `:524`, `:540` | "`/about`, `/manual`, `/stats`, `/changelog` \| Not rate limited" | Every command is limited (FINDING-020/033). `apps/discord-worker/src/index.ts:830-850` runs `checkRateLimit` for every command. `/about`,`/manual`=30/min (`packages/worker-kit/src/rate-limiter/presets/configs.ts:98-99`), `/changelog`=30/min (`apps/discord-worker/src/services/rate-limiter.ts:189-192` `LOCAL_COMMAND_LIMITS`), `/stats`=15/min (`configs.ts:102`) | HIGH | Replace all five with the real tiers |
| DW-02 | `commands.md:83`, `:92` | `color_space` option (`hsv`/`oklch`/`lch`/`hsl`) + example `color_space:oklch` | No `color_space`. Real option is `wheel`: `rgb` (default) / `ryb` / `munsell` / `oklch-hue` / `oklch-lightness` (`apps/discord-worker/src/commands/schemas.ts:167-172`, `:51-62`) | HIGH | Replace row + example (`wheel:ryb`) |
| DW-03 | `commands.md:82` | harmony types list with `complementary` (default), 8 entries | Ten types; default is `triadic` (`schemas.ts:29-38`; `handlers/commands/harmony.ts:47`) | HIGH | "`triadic` (default), `complementary`, `analogous`, `split-complementary`, `tetradic`, `inverted-tetradic`, `square`, `monochromatic`, `compound`, `shades`" |
| DW-04 | `commands.md:223` | `/budget quick preset` choices `pure_white`, `jet_black`, `metallic_silver`, `metallic_gold`, `pastel_pink` | 22 ids from `QUICK_PICKS` (`apps/discord-worker/src/services/budget/quick-picks.ts:20-172`): `jet_black`, `pure_white` + 20 Cosmic dyes | HIGH | "22 choices generated from `QUICK_PICKS`…" |
| DW-05 | `commands.md:407-410` | "Known issue (5.0.0): `/preset submit`/`edit` still send legacy itemIDs and accept 2–5 dyes" | Resolved: `handlers/commands/preset.ts:449-456` resolves to `dye.stainID`; `:424`, `:712` collect dye1–dye6; schema 3 required + 3 optional (`schemas.ts:1020-1063`) | HIGH | Delete the block |
| DW-06 | `commands.md:402-405` | `/preset submit` table: `dye3` optional; ends at `dye5` | `dye3` required; `dye6` optional (`schemas.ts:1032-1063`) | HIGH | fix |
| DW-07 | `commands.md:118`, `:122` | `vibrancy_boost` option | Not registered (`schemas.ts:325-364`: `image`, `colors`, `matching`, `prevent_duplicates`) | HIGH | Delete |
| DW-08 | `docs/projects/discord-worker/deployment.md:34`, `:27` | `DB` D1 binding row; "D1 and the service bindings are shared" | No D1 binding (`apps/discord-worker/wrangler.toml`; `src/types/env.ts`) | HIGH | Delete row; fix prose |
| DW-09 | `commands.md:63`, `:356` | `/a11y` 15/min default tier | `COMMAND_ALIASES = { a11y: 'accessibility' }` (`services/rate-limiter.ts:172-174`, `:202`) → shares accessibility's 10/min | HIGH | fix |
| DW-10 | `commands.md:63`, `:440` | `/preset` 15/min | 10/min (`configs.ts:83`) | HIGH | fix |
| DW-11 | `apps/discord-worker/CLAUDE.md:67`, `:121`, `:212`, `:216`; `docs/projects/discord-worker/overview.md:85` | `utils/verify.ts` (Ed25519 + timingSafeEqual) | File does not exist; both come from `@xivdyetools/auth` (`src/index.ts:16-21`) | HIGH | Replace references; delete tree line |
| DW-12 | `overview.md:173` | "everything else: 15/minute" | `/preferences` 20 (`configs.ts:95`), `/preset` 10 (`:83`), `/extractor image` 5 (`:75`, `rate-limiter.ts:181`) | HIGH | Full tier list: `/dye`, `/preferences`: 20; `/accessibility`(+`/a11y`), `/budget`, `/preset`: 10; `/about`, `/manual`, `/changelog`: 30; `/extractor image`: 5; else 15 |
| DW-13 | `commands.md:166` | `/mixer` `count` option | Only `dye1`, `dye2`, `mode`, `matching` (`schemas.ts:432-490`) | MED | Delete row |
| DW-14 | `commands.md:110` | `/extractor color` `prevent_duplicates` | Only `color`, `count`, `matching` (`schemas.ts:291-324`) | MED | Delete row |
| DW-15 | `commands.md:109` | `matching` "registered but not yet read by the color handler" | Read at `handlers/commands/extractor.ts:233-236`; no TODO | MED | fix |
| DW-16 | `commands.md:122` | image handler "reads only image and colors … see the TODO" | `matching` read at `:462`, `prevent_duplicates` at `:466-467` | MED | Delete note |
| DW-17 | `overview.md:179`; `deployment.md:33` | "15-minute button context (`ctx:v2:*`)" in KV | No such key; `component-context.ts` removed 2026-08-18 (`interactions.md:162`); state lives in `custom_id` | MED | Delete |
| DW-18 | `overview.md:179`; `commands.md:362` | `scripts/cleanup-v4-kv.ts` | Does not exist (`apps/discord-worker/scripts/`) | MED | Delete refs |
| DW-19 | `deployment.md:50` | `DISCORD_CLIENT_ID` under Required Secrets | `[vars]` (`wrangler.toml:88`, `:126`) | MED | Move to a Vars table with `ENVIRONMENT`, `PRESETS_API_URL`, `ANNOUNCEMENT_CHANNEL_ID` |
| DW-20 | `deployment.md:64` | `ANNOUNCEMENT_CHANNEL_ID` under Optional Secrets | `[vars]` (`:90`, `:130`) | MED | same |
| DW-21 | `apps/discord-worker/CLAUDE.md:125` | `error-response.ts` | doesn't exist | MED | delete |
| DW-22 | `CLAUDE.md:127` | `color.ts # dyeService singleton` | doesn't exist; `dyeService` from bot-logic (`handlers/commands/dye.ts:38`) | MED | delete; note |
| DW-23 | `CLAUDE.md:134` | `types/image.ts` | not present | MED | delete |
| DW-24 | `overview.md:3`; `commands.md:1`; `deployment.md:3`; `interactions.md:128`; `rendering.md:232` | "v5.0.0" ×5 | 5.5.0 | MED | DROP per-page version stamps (versions live only in docs/versions.md) |
| DW-25 | `rendering.md:253` | "`@xivdyetools/svg` 2.0.0" | 4.1.0 | MED | drop the number |
| DW-26 | `apps/discord-worker/TERMS_OF_SERVICE.md:22` | "Favorites & Collections: Save and organize your favorite dyes" | `/favorites`, `/collection` deleted in 5.0 (`handlers/commands/about.ts:67` `REMOVED_IN_V5`) | MED | "Community Preset Favorites: mark and list community presets you like (`/preset favorite`)" |
| DW-27 | `TERMS_OF_SERVICE.md:48` | "Submissions are reviewed before becoming publicly visible" | Auto-approved when the automated check passes (`apps/presets-api/src/handlers/presets.ts:915`) | MED | "Submissions pass an automated content check; those that clear it are published immediately and logged for audit; anything flagged or unresolvable is held for moderator review" |
| DW-28 | `commands.md:63`, `:482` | `/preferences` 15/min | 20 (`configs.ts:95`) | MED | fix |
| DW-29 | `commands.md:58-65` | no `/extractor image` row | 5/min (`configs.ts:75`) | MED | add |
| DW-30 | `apps/discord-worker/README.md:29` | `/dye` lookups "by name, ID, hex, or category" | no hex lookup (`packages/bot-logic/src/input-resolution.ts:53-66`) | LOW | "by name, stainID/item ID, or category" |
| DW-31 | `commands.md:430` | `/preset edit` `dye1`…`dye5` | `dye6` (`schemas.ts:1101-1136`) | LOW | fix |
| DW-32 | `interactions.md:170` | autocomplete `dye1`…`dye5` | `dye6` | LOW | fix |
| DW-33 | `commands.md:54` | "`checkRateLimit` in `src/index.ts`" | defined in `services/rate-limiter.ts:234`, called from `index.ts:831` | LOW | fix |
| DW-34 | `CLAUDE.md:204` | `/preset` autocomplete "`show`/`vote`/`moderate`" | `moderate` not on this worker (`schemas.ts:1174-1175`) | LOW | "`show`/`vote`/`favorite add`" |
| DW-35 | `CLAUDE.md:22` | "`npm run lint # eslint src/`" | `eslint src/ && pnpm run lint:dead` | LOW | fix |
| DW-36 | `CLAUDE.md:90-137` | tree omits `src/commands/` | `commands/{registry,schemas,localize}.ts`; also `src/data/emoji-mapping.json`, `utils/{brand,text}.ts`, `services/font-coverage.ts` | LOW | add |
| DW-37 | `README.md:104`; `fonts-src/README.md:323` | "~21 MiB originals" | one file, `NotoSansKR-Variable.ttf` 10.4 MiB | LOW | fix |
| DW-38 | `fonts-src/README.md:325` | "~700 KiB subsets" | 965 KiB (JP 329 + KR 143 + SC 493) | LOW | fix |
| DW-39 | `rendering.md:243` | `generateComparisonCard(dyes, { theme })` | one options object (`packages/svg/src/comparison-card.ts`) | LOW | fix |

Checked and CORRECT (do not change): the 17-registration count; `PRIVACY_POLICY.md` in full; webhook caps; `announced:v:` memo; six `RL_*` tiers; the 13 SVG generator names in rendering.md.

## web-app

| ID | File:line | Claim (quoted) | Reality (evidence) | Sev | Proposed fix |
|---|---|---|---|---|---|
| WEB-01 | `apps/web-app/CLAUDE.md:9` | "with a service worker for offline support" | No service worker; same file `:219` says so | HIGH | Delete clause |
| WEB-02 | `docs/projects/web-app/overview.md:160-164` | "PWA Support — … service worker" | Only `public/manifest.json` | HIGH | "Installable via `public/manifest.json`. No service worker and no offline cache; `offline-banner.ts` only reports connectivity" |
| WEB-03 | `overview.md:110-146` | Source tree with `components/tools/`, `v4/glass-panel.ts`, `services/ThemeService.ts`, `utils/` | None exist; services are kebab-case | HIGH | Replace with the real tree (mirror `apps/web-app/CLAUDE.md:84-151` minus WEB-25/26/27) |
| WEB-04 | `docs/projects/web-app/theming.md:34` | `ThemeService.getCurrentThemeObject()` | statics: `initialize`, `getCurrentTheme`, `getTheme`, `getAllThemes`, `setTheme`, `toggledVariant`, `getRequiredColor`, `isDarkMode`, `subscribe`, `resetToDefault` (`services/theme-service.ts`) | HIGH | `getTheme(getCurrentTheme())` |
| WEB-05 | `theming.md:39`; `components.md:142` | `ThemeService.toggleDarkMode()` | `toggledVariant()` (`theme-service.ts:231`); applying path `toggleThemeVariant()` in `services/theme-switch.ts:29-33` | HIGH | fix |
| WEB-06 | `theming.md:40-41` | `getLightVariant`/`getDarkVariant` | don't exist | HIGH | delete |
| WEB-07 | `theming.md:42` | `ThemeService.getColor(key)` | only `getRequiredColor(key)` (`:329`) | HIGH | fix; add `isDarkMode()`, `resetToDefault()` |
| WEB-08 | `theming.md:83` | "Themes integrate with Tailwind's dark mode" | `tailwind.config.js:10-12` no `darkMode`; themes are `html.theme-*` + `--theme-*` (`theme-service.ts:242-315`) | HIGH | fix |
| WEB-09 | `theming.md:84` | "Custom Tailwind plugins provide glassmorphism utilities" | `plugins: []`; glass via `--v4-glass-*` + `.glass-panel` (`components/v4/base-lit-component.ts:73`) | HIGH | fix |
| WEB-10 | `components.md:3` | "Component names below are real files; anything not listed does not exist" | eight named files don't exist | HIGH | Drop the guarantee; regenerate lists from `git ls-files apps/web-app/src` |
| WEB-11 | `components.md:72` | `dye-card-renderer.ts`, `harmony-result-panel.ts`, `harmony-type.ts`, `color-wheel-display.ts`, `recent-colors-panel.ts`, `info-tooltip.ts` | none exist | HIGH | remove |
| WEB-12 | `components.md:158` | `DyeSelectionContext` / `dye-selection-context.ts` | doesn't exist | HIGH | delete row |
| WEB-13 | `docs/projects/web-app/tools.md:25` | `harmony-generator.ts` (`HARMONY_OFFSETS`, `findHarmonyDyes`, `findClosestDyesToHue`) + 3 panel files | exports only `HarmonyTypeInfo`, `HARMONY_TYPE_IDS`, `getHarmonyTypes`; selection is core's `generateHarmonySlots` (`:9-12`); `HARMONY_OFFSETS` from core (`components/v4/v4-color-wheel.ts:25`) | HIGH | rewrite; delete the three files |
| WEB-14 | `tools.md:29` | `HarmonyConfig` fields (+ deprecated) | has `wheel: ColorWheelId` default `'rgb'` (`shared/tool-config-types.ts:44-61`, `:421`); no deprecated fields; sidebar select at `components/v4/config-sidebar.ts:937-959` | HIGH | add `wheel`; drop deprecated note |
| WEB-15 | `tools.md:34-39` | Harmony share params `dye`, `hex`, `harmony`, `algo`, `perceptual` | also `wheel` unconditionally (`components/harmony-tool.ts:1843-1867`); `dyeId` alias (`:458`); `HarmonyShareParams.wheel` (`services/share-service.ts:64`) | HIGH | add rows |
| WEB-16 | `tools.md:67` | gradient "custom endpoint is written as `0`" | writes `hexStart`/`hexEnd` (`components/gradient-tool.ts:1670-1690`) | HIGH | fix |
| WEB-17 | `tools.md:72` | "`hexStart`/`hexEnd` … neither writes nor reads them yet" | read `:343-352`, written `:1681,1685` | HIGH | fix |
| WEB-18 | `tools.md:88` | mixer "custom slot is written as `0`" | writes `hexA`/`hexB` (`components/mixer-tool.ts:1909-1926`) | HIGH | fix |
| WEB-19 | `tools.md:93` | "`hexA`/`hexB` … not wired" | read `:673-681`, written `:1924-1926` | HIGH | fix |
| WEB-20 | `apps/web-app/functions/README.md:35-37` | "Once the old domain is fully deprecated … this middleware can be removed" | `_middleware.ts:24-39` also 404s `/assets/*` HTML fallbacks (FINDING-027) | HIGH | "Only the domain-redirect block may go. The `/assets/*` guard must stay." |
| WEB-21 | `functions/README.md:7` | Purpose: 301 redirect only | two purposes (`_middleware.ts:2-3`) | MED | state both |
| WEB-22 | `components.md:140` | `IndexedDBService` "Extractor image persistence" | DB v3 removed `image_cache` (`services/indexeddb-service.ts:16`, `:116-121`); `STORES` = price_cache/palettes/settings; image in memory only (`extractor-tool.ts:1475-1476`) | MED | fix |
| WEB-23 | `tools.md:45`, `:47` | indexeddb image persistence; `recent-colors-panel.ts` | same; file doesn't exist | MED | fix |
| WEB-24 | `components.md:142` | `toggleDarkMode` | see WEB-05 | MED | fix |
| WEB-25 | `apps/web-app/CLAUDE.md:123` | `palette-service.ts` | doesn't exist | MED | delete |
| WEB-26 | `CLAUDE.md:95` | `glass-panel` component | only CSS rule; add `display-options`, `dye-filters` | MED | fix |
| WEB-27 | `CLAUDE.md:110` | `color-display`, `color-wheel-display` | neither; real `color-picker-display.ts` | MED | fix |
| WEB-28 | `CLAUDE.md:243`, `:266` | `@xivdyetools/test-utils` devDependency | not in `package.json:34-51`, never imported | MED | delete |
| WEB-29 | `apps/web-app/README.md:97` | same | same | MED | delete |
| WEB-30 | `README.md:96` | `spectral.js` in app deps | core's dep | MED | "`@xivdyetools/core/blending` (→ `spectral.js`, core's dependency)" |
| WEB-31 | `README.md:63` | "Only the Budget and Presets tools make API calls." | `MarketBoardService` used by 7 tools; `/v1/chara/resolve` (`services/chara-resolve-service.ts:123`); `/v1/telemetry` opt-in | MED | "All colour maths is local. Network calls: market prices (any tool with Show Prices on), presets, `.chara` gear names, and opt-in telemetry." |
| WEB-32 | `CLAUDE.md:247` | "layout shell ≤ 200 KB" | 215 KB (`scripts/check-bundle-size.js:92`) | MED | fix |
| WEB-33 | `CLAUDE.md:264` | "Coverage thresholds 80% lines/functions/branches" | statements 78, branches 63, functions 74, lines 79 (`vitest.config.ts:71-75`) | MED | quote real |
| WEB-34 | `components.md:194` | "1,489 keys per language" | 1,152 | MED | fix |
| WEB-35 | `overview.md:27` | "1,041 → 1,489 × 6" | 1,152 | MED | fix |
| WEB-36 | `overview.md:182-190` | "All three are optional" | four: `VITE_API_WORKER_URL` (`src/vite-env.d.ts:14`, `services/api-worker-origin.ts:16`, default `http://localhost:8790`); `VITE_APP_ENV=beta` (`vite.config.ts:9`) | MED | add |
| WEB-37 | `overview.md:199-209` | deploy via Pages Git integration | `deploy-web-app.yml:59-65` wrangler-action `pages deploy dist --project-name=xivdyetools` | MED | fix; link deployment docs |
| WEB-38 | `tools.md:142` | `services/price-utilities.ts` | doesn't exist; `BudgetTool.priceOf()` (`components/budget-tool.ts:464`) + `services/pricing-mixin.ts` | MED | fix |
| WEB-39 | `components.md:161` | `price-utilities.ts` | same | MED | drop |
| WEB-40 | `components.md:159` | `HarmonyGenerator` row | see WEB-13 | MED | fix |
| WEB-41 | `components.md:137-161` | service table | missing `telemetry-service.ts`, `theme-switch.ts`, `chara-resolve-service.ts`, `api-worker-origin.ts` | MED | add |
| WEB-42 | `components.md:45` | sidebar contents | also Color wheel select (`config-sidebar.ts:937-963`) | MED | add |
| WEB-43 | `tools.md:17` | share URL grammar | also `lang=<locale>` for non-English (`services/share-service.ts:217-223`) | MED | add |
| WEB-44…47 | `overview.md:3`; `tools.md:1`; `components.md:3`; `deployment.md:3` | "v5.0.0" ×4 | 5.7.0 | MED | DROP per-page stamps |
| WEB-48 | `theming.md:63-65` | `--v4-header-height 48px`, `--v4-tool-bar-height 64px`, `--v4-sidebar-width 320px` | 54px, 0px, 252px (`src/styles/themes.css:59-62`) | MED | fix |
| WEB-49 | `theming.md:82` | "Tailwind CSS ^4.2" | `^4.3.3` | LOW | "^4.3" |
| WEB-50 | `tools.md:15` | "ΔEOK - Perceptual" | `ΔEOK2` (`config-sidebar.ts:1476`) | LOW | fix |
| WEB-51 | `components.md:152` | ShareService "client-side share analytics" | none | LOW | drop |
| WEB-52 | `components.md:135` | `WorldService` instance singleton | static class (`services/index.ts:21,89-90`) | LOW | move |
| WEB-53 | `CLAUDE.md:102` | `preset-tool.ts` under `components/` | `components/v4/preset-tool.ts` | LOW | fix |
| WEB-54 | `CLAUDE.md:224-226` | two Vite plugin rows | also `vite-plugin-beta-branding.ts` | LOW | add |
| WEB-55 | `apps/web-app/scripts/README.md:96-104` | Other scripts table | `generate-api-docs-icons.mjs` missing | LOW | add |
| WEB-56 | `README.md:11` | seven harmony types | ten + five colour wheels | LOW | "ten harmony types … on a choice of five colour wheels" |
| WEB-57 | `overview.md:32` | `auth-button.ts` | removed; `signin-modal.ts` | LOW | note |
| WEB-58 | `overview.md:174` | "6 languages via @xivdyetools/core" | UI strings in `src/locales/`; core supplies domain tables | LOW | fix |
| WEB-59 | `deployment.md:37-38` | triggers | `[main, master]`; beta `branches-ignore: [main, master, 'dependabot/**']` | LOW | fix |

`apps/web-app/PRIVACY.md` is clean. `theming.md` does NOT describe the retired 12-theme system (its theme list, default and `migrateLegacyThemeName()` are correct).

## Structural (apply)

1. **Add a "Colour wheels" subsection** to `docs/projects/web-app/tools.md` §Harmony (five wheels, `HarmonyConfig.wheel`, sidebar select, `wheel=` share param) plus one line each in `apps/web-app/README.md` and `CLAUDE.md`.
2. **Delete `docs/projects/web-app/deployment.md` and `docs/projects/discord-worker/deployment.md`** after folding any app-specific content that is not already in `docs/developer-guides/deployment.md` / `docs/operations/DEPLOY_ENVIRONMENTS.md` into the respective `overview.md` (a short "Deployment" section with a link). Both pages are unlinked from `docs/projects/index.md`, carry stale version banners, and restate the shared guides. If you delete them, grep the repo for inbound links and repoint them.
3. `docs/projects/web-app/components.md` and `tools.md` share one stale file inventory — fix both from `git ls-files apps/web-app/src`.
4. Drop every per-page version stamp in `docs/projects/web-app/*` and `docs/projects/discord-worker/*`.
