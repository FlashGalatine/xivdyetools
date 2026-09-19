# Documentation audit — cluster: web-app-projects

Worktree: `origin/main` @ `0fec18f4` (2026-09-18). Cluster: `docs/projects/web-app/` (overview.md,
components.md, theming.md, tools.md). Source of truth: `apps/web-app/` (components, services,
shared, vite.config.ts, package.json, scripts/check-bundle-size.js, public/_headers) plus the
workers the app talks to (api-worker, oauth, presets-api, og-worker) for the CORS/routing claims
in overview.md.

## Coverage table

| file | sections reviewed | result |
|---|---|---|
| docs/projects/web-app/overview.md | all (What is the Web App, version-history subsections, Quick Start, Tech Stack, Architecture tree, Features, Env Vars, Deployment, Related Docs) | reviewed |
| docs/projects/web-app/components.md | all (shadow-root gotcha, BaseComponent/BaseLitComponent, console shell, tool components, shared UI primitives, modals, service layer, ConfigController, code splitting, localization) | reviewed |
| docs/projects/web-app/theming.md | all (available themes, legacy migration, ThemeService API, storage, CSS vars, glassmorphism, Tailwind integration) | reviewed |
| docs/projects/web-app/tools.md | all (cross-cutting facts + all 9 per-tool sections + route table) | reviewed |

## Candidate table

| cand-id | sev | kind | file:line | claim vs reality | evidence |
|---|---|---|---|---|---|
| C1 | MEDIUM | MISSING | docs/projects/web-app/tools.md:52,58 (Palette Extractor section); docs/projects/web-app/components.md (no mention) | tools.md:58 states "**Share params:** none wired. `ExtractorShareParams` (`colors`, `algo`) is declared in `share-service.ts` but the tool has no share button and reads no params — the export sheet is the hand-off." This was true for the 5.8 4A port but was reversed by commit `3eaca5a7` ("restore the Palette Extractor's share link (BUG-002)"), part of the PR #188 deep-dive wave merged into HEAD. | `apps/web-app/src/components/extractor-tool.ts:77-78` imports and registers `v4-share-button`; line 1166 `this.shareButton = document.createElement('v4-share-button')`; lines 2237-2247 `getShareParams()` returns `{ colors, algo: this.matchingMethod }` (colors capped at `MAX_EXTRACTOR_SHARE_COLORS`); lines 2255-2260 `updateShareButton()` pushes params to the button on every repaint; line 2280 reads `ShareService.getShareParamsFromCurrentUrl()` to restore a shared palette. Commit `3eaca5a7` (`git merge-base --is-ancestor 3eaca5a7 HEAD` = true) confirms this shipped before the doc's stated baseline (HEAD `0fec18f4`). |
| C2 | MEDIUM | MISSING | docs/projects/web-app/components.md:74 (Tool-owned subcomponents list); docs/projects/web-app/tools.md §9 Swatch Matcher (lines 165-183) | Two real, shipped Swatch subcomponents are absent from every list that purports to enumerate the tool's files/features: `item-links-menu.ts` (PR #173, web-app 5.9.0 — "Open in…" menu for a glamour piece, 5 community databases + Lodestone submenu) and `glamour-list-actions.ts` (PR #187, web-app 5.10.0 — "Copy list / Export .md" glamour export). `git grep -n -i "item-link\|glamour-list\|Copy list\|Export \.md"` over `docs/projects/web-app/` returns zero hits. | `apps/web-app/src/components/item-links-menu.ts:1-60` (module docblock: "Open in… menu for a glamour piece... Raised from the Swatch Manager's equipment rows"); `apps/web-app/src/components/glamour-list-actions.ts:1-33` (module docblock: "Copy list / Export .md — the click-time half of the glamour list... `chara-import` draws the two buttons"); `git log --oneline` shows `127d9d23 feat(web-app): open a glamour piece in seven community databases (5.9.0)` and `926d8f03 feat(web-app): Copy list / Export .md for the glamour equipment list (5.10.0)`, both ancestors of HEAD. components.md's "Tool-owned subcomponents" list (line 74) names `chara-import.ts` but stops short of these two newer files it spawns. |
| C3 | MEDIUM | WRONG | docs/projects/web-app/overview.md:242-244 (CORS prose) vs :250 (table row) | Prose states "Every backend the app calls enforces an origin allowlist, so a new deployment origin ... must be added there before it works" — but the doc's own table two lines later shows api-worker uses `cors({ origin: '*' })`, a wildcard, not an allowlist. The general claim is false for one of the four listed backends. | `apps/api-worker/src/index.ts:100-105`: `cors({ origin: '*', allowMethods: [...], ... })`, with a comment "CORS — permissive for public read-only API"; `apps/api-worker/CLAUDE.md` confirms "permissive CORS so it can be called from browsers, Dalamud plugins, Discord bots, and mobile apps" with no allowlist. Contrast with `apps/oauth/src/index.ts:52-59` and `apps/presets-api/src/index.ts:95-114`, which both use a real origin-callback allowlist — so the prose is accurate for 2 of 3 non-api-worker backends but directly contradicted by the api-worker row it introduces. |

## Positive controls (checked and correct — do not re-chase)

- overview.md's file tree (`src/components/`, `services/`, `shared/`, `styles/`, `locales/`) — every named file in it exists in `git ls-files apps/web-app/src`; the "flat, no `components/tools/`" claim is accurate.
- theming.md's `ThemeService` API surface (`initialize/getCurrentTheme/getTheme/getAllThemes/setTheme/toggledVariant/isDarkMode/subscribe/resetToDefault`, all static, no `getInstance()`) matches `apps/web-app/src/services/theme-service.ts` exactly, including `migrateLegacyThemeName()`'s exact rule (`-light` suffix, `cotton-candy`, `parchment-light` → light; else dark) and self-init on module load.
- theming.md's `THEME_NAMES`/`DEFAULT_THEME`/storage key (`xivdyetools_theme`) match `apps/web-app/src/shared/constants.ts:48,50,82,85` verbatim.
- components.md's `theme-switch.ts` description (only path that records `theme_change` telemetry; `ThemeService.setTheme` stays silent) matches `apps/web-app/src/services/theme-switch.ts` verbatim.
- tools.md's five colour-wheel ids (`rgb` default, `ryb`, `munsell`, `oklch-hue`, `oklch-lightness`) and ten harmony type ids (including `inverted-tetradic`) match `packages/core/src/services/dye/wheels/ColorWheel.ts:17-25` and `apps/web-app/src/services/harmony-generator.ts:39-50` exactly.
- All nine per-tool `ConfigController` default shapes in tools.md (Harmony/Extractor/Gradient/Mixer/Accessibility/Comparison/Presets/Budget/Swatch: field names, defaults, ranges implied by comments) match `apps/web-app/src/shared/tool-config-types.ts` `DEFAULT_CONFIGS` verbatim, including which tools have no `matchingMethod`/`dyeFilters` (accessibility, comparison).
- overview.md's bundle-budget summary ("2,200 KB total", "60 KB default" per-chunk) matches `PAYLOAD_JS_LIMIT = 2200 * KB` and `DEFAULT_CHUNK_LIMIT = 60 * KB` in `apps/web-app/scripts/check-bundle-size.js`.
- tools.md's `_headers` `camera=()` claim and its rationale (capture-attribute file input isn't gated by Permissions-Policy) matches `apps/web-app/public/_headers:39-45` verbatim.
- overview.md's OG worker row (`og.xivdyetools.app`, routed on `xivdyetools.app/<tool>/*`) matches `apps/og-worker/wrangler.toml` `[env.production]` routes (9 tool paths + `og.xivdyetools.app` custom domain).
- overview.md's four `VITE_*` env vars (`VITE_OAUTH_WORKER_URL`, `VITE_PRESETS_API_URL`, `VITE_UNIVERSALIS_PROXY_URL`, `VITE_API_WORKER_URL`) plus the `VITE_APP_ENV=beta` build switch all exist and are read exactly as described (`apps/web-app/src/vite-env.d.ts`, `auth-service.ts`, `api-worker-origin.ts`, `api-service-wrapper.ts`, `vite.config.ts:9`).
- PresetsConfig's 8 categories (`jobs, grand-companies, seasons, events, aesthetics, appearance, zones, raids-trials`) match presets-api's seeded categories exactly (`apps/presets-api/CLAUDE.md` Tables section).
- Camera-capture removal narrative (5.8, `image-upload-display.ts`/`color-picker-display.ts`/`camera-preview-modal.ts`/`services/camera-service.ts` deleted) is accurately dated to PR #172 (`23410bd4 Merge pull request #172 from FlashGalatine/worktree-camera-cleanup`); Extractor's 4A rework is accurately PR #171 (`9210947d`).

## Rejected items (looked wrong, were right)

- Suspected the `docs/research/monorepo-2.0/*-port-spec.md` links in tools.md might be stale/renamed — all nine files exist at the named paths.
- Suspected the four relative links out of overview.md (`../../developer-guides/deployment.md`, `../../operations/DEPLOY_ENVIRONMENTS.md`, `../../developer-guides/environment-variables.md`, `../../user-guides/web-app/getting-started.md`) might not resolve — all four exist.
- Suspected overview.md's "Colour wheel select... trademark note" and Harmony's ten-type list might be stale after the 2026-09-04/05 colour-wheel work — cross-checked against `packages/core` and it is exact.
- Suspected theming.md's "pre-5.0 had 12 themes" might be an inflated historical count — this is a past-tense claim (allowed) and not falsifiable against current code either way; not flagged.

## Not fully re-verified (time-boxed, low suspicion)

- Exact numeric ranges quoted in prose for sliders not present in `tool-config-types.ts` comments (e.g. Harmony's `companionDyesCount` "1–5", Comparison's `matchThreshold` "1–15", Budget's `maxDeltaE` "2–20") — the *defaults* were verified against `DEFAULT_CONFIGS`, but the min/max bounds live in the tool components' own validation code, which was not individually opened for all nine tools given the time budget.
