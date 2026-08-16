# Agent report — non-source surface (scripts, e2e, test infra, public/, root config, docs)

## A. `apps/web-app/scripts/`

No `scripts/icons/` exists. `scripts/assets/` holds one file.

| File | Bytes | Consumer (verified) | Verdict |
|---|---|---|---|
| `check-bundle-size.js` | 15,561 | `package.json` `check-bundle-size`, `build:check`; `deploy-web-app.yml:48`; `deploy-web-app-beta.yml:72`; tested by `src/__tests__/bundle-budget.test.ts` | KEEP |
| `smoke-test-pages.js` | 8,960 | `deploy-web-app.yml:76`, `deploy-web-app-beta.yml:101` | KEEP |
| `smoke-test-pages.test.js` | 13,935 | run by vitest (`vitest.config.ts` include `scripts/**/*.{test,spec}.js`); `turbo.json` `test.inputs` | KEEP |
| `check-beta-build.js` | 2,272 | `deploy-web-app-beta.yml:78` | KEEP |
| `validate-i18n.js` | 14,074 | `package.json` `validate:i18n`; docs. **No workflow runs it** | KEEP (manual gate) |
| `generate-icons.mjs` | 4,331 | no consumer; input `public/assets/icons/sparkles.svg` exists (10,223 B). Writes to `public/assets/icons/` **and** `../assets/icons/` (dead dir) | KEEP-BUT-NOTE — half its output path is dead |
| `generate-beta-icons.mjs` | 1,947 | `CLAUDE.md:56`; input `scripts/assets/bot-avatar-beta-1024.png` exists; output `public/assets/icons/beta/` live | KEEP |
| `scripts/assets/bot-avatar-beta-1024.png` | 266,438 | sole input to `generate-beta-icons.mjs:17` | KEEP |
| `convert-icons-to-webp.js` | 1,971 | no consumer. Reads and writes `../assets/icons/` (line 16) — the dead top-level dir; outputs cannot reach `dist/` | **DEAD** |
| `analyze-unused-keys.js` | 7,612 | **zero consumers** monorepo-wide (not in `package.json`, workflows, or `scripts/README.md`) | **DEAD** (or wire it in) |
| `check-bundle-size.d.ts` | 1,676 | consumed implicitly by `src/__tests__/bundle-budget.test.ts:31` (`.js` import → sibling `.d.ts`); comment at `:25` names it | KEEP (knip false positive) |
| `scripts/README.md` | 2,714 | see below | STALE |

`scripts/README.md` vs reality: `:40` cites `src/components/app-layout.ts` (does not exist); documents 3 of 8 executable scripts (`check-bundle-size.js`, `check-beta-build.js`, `generate-icons.mjs`, `generate-beta-icons.mjs`, `analyze-unused-keys.js` undocumented); `convert-icons-to-webp.js` documented but writes to the dead dir.

## B. `apps/web-app/e2e/`

`playwright.config.ts`: `testDir: './e2e'`, no `testMatch` (default pattern; `fixtures/*.ts` and `global-teardown.ts` correctly not collected). Projects: `chromium`, `chromium-coverage`, `mobile-chrome`. **Skips: zero** across all specs (`forbidOnly` set for CI).

| Spec | Bytes | tests | Verdict |
|---|---|---|---|
| `accessibility-checker` 11,577/15 · `budget-tool` 14,237/22 · `collection-manager` 6,938/10 · `dye-comparison` 3,732/5 · `dye-mixer` 2,863/4 · `extractor-tool` 19,696/18 · `gradient-builder` 10,400/22 · `harmony-generator` 2,820/4 · `preset-browser` 8,062/10 · `ui-interactions` 11,704/21 | | | KEEP |
| **`example.spec.ts`** | 586 | 2 | **DEAD** — Playwright scaffold; both tests `goto('https://playwright.dev/')`; collected by all three projects; adds an external network dependency to every `test:e2e` run |

Fixtures: `fixtures/coverage.ts` KEEP (all specs + teardown). `fixtures/navigation.ts` — 9 exports; **`toolSwitcher`, `activeToolControl`, `closePaletteDrawer` have zero references** outside their definitions (3 DEAD exports; `revealToolList` is used internally by `switchToolViaMenu`). `global-teardown.ts` KEEP. `COVERAGE-GAPS.md` KEEP (intentional record).

Artifact dirs (all gitignored via root `.gitignore`; no `apps/web-app/.gitignore`): `e2e-coverage/` **78 MB** on disk (nothing prunes it — local cleanup candidate), `test-results/` 393 KB, `playwright-report/` 628 KB, `coverage/` 307 KB.

Stale selectors: none. Zero-match selectors (`#alternatives-section`, `#budget-empty-state`, `[data-section="options"]`, `[data-accordion-trigger]`, `[data-collapsible]`, `[data-preset-id]`, `[data-sort]`) are all the redundant arm of a comma-OR whose other arm matches. Risk is the opposite of dead code — broad OR-selectors can pass against a DOM they no longer describe.

## C. Unit test infra

91 `*.test.ts` under `src/` + `scripts/smoke-test-pages.test.js`. **Skips: zero. Broken subject imports: zero. No test file with zero `it(`/`test(`.** (`src/shared/__tests__/icons.test.ts` has no `icons.ts` subject but imports resolve to `social-icons.ts`/`tool-icons.ts`/`ui-icons.ts`.)

| File | Bytes | Exports | Actually imported by tests | Verdict |
|---|---|---|---|---|
| `src/__tests__/component-utils.ts` | 12,755 | 32 | 10: `createTestContainer, cleanupTestContainer, click, input, query, queryAll, getAttr, getText, hasClass, spyOnCustomEvent` (27 files) | **22 DEAD exports**: `createPanelContainers, waitForRender, waitForFrames, wait, waitFor, flushMicrotasks, doubleClick, change, keyboard, pressEnter, pressEscape, focus, blur, hover, unhover, dispatchCustomEvent, setupComponent, cleanupComponent, queryByText, queryByData, queryByRole, isVisible` |
| `src/__tests__/mocks/services.ts` | 14,965 | `mockDyes` + 9 factories + 9 interfaces | `mockDyes` only (17 files) | **DEAD: all 9 factories** (`createMockDyeService, createMockStorageService, createMockCollectionService, createMockMarketBoardService, createMockToastService, createMockModalService, createMockRouterService, createMockColorService, createAllMockServices`) + interfaces — ~14 KB of 15 KB |
| `src/__tests__/mocks/server.ts` | 627 | `server, resetHandlers, useHandler` | `server` only (`setup.ts:11`, `community-preset-service.integration.test.ts:9`) | **DEAD: `resetHandlers`, `useHandler`** |
| `src/__tests__/mocks/handlers.ts` | 10,698 | `mockPresets, mockCategories, handlers, errorHandlers` | `handlers` via `server.ts` | **DEAD: `errorHandlers`** (zero importers) |
| `mocks/virtual-changelog.ts`, `setup.ts`, `TESTING.md` | | | | KEEP |

MSW handlers vs real endpoints: every handler URL (`/health`, `/api/v1/presets*`, `/categories`, `/votes/*`, `/presets/mine`, `/presets/rate-limit`, PATCH/DELETE) is called by `community-preset-service.ts` or `preset-submission-service.ts`. **No orphan handlers.**

## D. `apps/web-app/public/` (~2.9 MB)

| File | Bytes | Consumer / evidence | Verdict |
|---|---|---|---|
| `_headers` | 4,631 | Pages; beta plugin appends `X-Robots-Tag`; all path blocks (`/assets/*`, `/og/*`, `/fonts/*`, `/json/*`) exist in `dist/` | KEEP |
| `_redirects` | 117 | `/* /index.html 200` — required by the history-API router | KEEP |
| `browserconfig.xml` | 268 | linked from `index.html:63`; **references `/assets/icons/mstile-150x150.png` which does NOT exist in `public/` or `dist/`** (only in dead root `assets/icons/`) | STALE (payload 404s) |
| `manifest.json` | 3,225 | linked from `index.html:59`; icons/screenshots exist. **All 4 `shortcuts[].url` are `*_stable.html` v3 pages; `share_target.action: "/share-handler"` — zero hits in `src/`** | STALE |
| `sitemap.xml` | 1,215 | `<loc>` #1 real; **the other 5 are `*_stable.html` v3 URLs**; none of the 9 SPA routes listed; `lastmod` 2025-01-14 | STALE |
| `fonts/*.woff2` ×3 | 152,512 | `globals.css` `@font-face` + preloads; pinned by `font-contract.test.ts` | KEEP |
| `json/data-centers.json`, `json/worlds.json` | 6,370 | `world-service.ts:51`, `config-sidebar.ts:719` | KEEP |
| `og/default.png` 129,843 · `og/default-x.png` 87,145 | | `index.html:31` og:image / `:46` twitter:image; asserted by `beta-branding.test.ts:142` | KEEP |
| **`og/{accessibility,budget,comparison,extractor,gradient,harmony,mixer,presets,swatch}/default.png` + `default-x.png` (18 files)** | **2,059,669** | nothing in web-app references them; per-tool cards are served by og-worker from `OG_IMAGE_BASE_URL = https://og.xivdyetools.app/og` (`apps/og-worker/wrangler.toml:76`, `src/index.ts:295`); og-worker's zone routes are `xivdyetools.app/<tool>/*`, not `/og/*`. Main session: `git log -S"og/harmony/default" -- apps/web-app/src` → no commit ever linked them; added by `591414f` (2026-08-12) | **DEAD (~2.06 MB)** |
| `assets/icons/` `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, `apple-touch-icon.png`, `icon-192x192.png`, `icon-512x512.png`, `icon-40x40.webp` (preload only — see main-session console note) | | `index.html:50-56,77-78`, `manifest.json` | KEEP (icon-40x40.webp: only consumer is a preload that the browser reports as unused) |
| **`favicon-48x48.png`** | — | **`index.html:53` links it; absent from `public/` and `dist/`** (exists only in dead root `assets/icons/` and in `beta/`) — 404 in production, resolves on beta | **BROKEN REF** |
| `favicon.png` 1,735 · `icon-40x40.png` 2,303 · `icon-60x60.{png,webp}` 6,225 · `icon-80x80.{png,webp}` 8,765 · `icon-192x192.webp` 6,902 · `icon-512x512.webp` 21,760 | ~47,700 | zero references (`scripts/README.md:40` claims `app-layout.ts` consumes the WebPs — file does not exist) | **DEAD** |
| `opengraph.png` | 87,145 | zero references; byte-identical size to `og/default-x.png` | **DEAD (duplicate)** |
| `sparkles.svg` | 10,223 | sole input to `generate-icons.mjs:14` | KEEP (build input) |
| loose UI SVGs `camera, crystal, eyedropper, hint, info, save, share, theme, upload, zoom-fit, zoom-width` | 6,528 | zero references — the app inlines icons from `src/shared/*-icons.ts` | **DEAD** |
| `harmony/*.svg` ×9 6,238 · `social/*.svg` ×7 4,274 · `tools/*.svg` ×6 3,781 | 14,293 | zero references (superseded by `harmony-icons.ts`, `social-icons.ts`, `tool-icons.ts`) | **DEAD** |
| **`tools/preview.html`** | 17,236 | standalone dev icon-gallery page; no links in or out; **ships to production at `/assets/icons/tools/preview.html`** | **DEAD — and publicly reachable** |
| `beta/*` ×7 | 53,525 | `beta-branding.ts:23`, `vite-plugin-beta-branding.ts`, `check-beta-build.js`, tests | KEEP |

Public dead-byte total ≈ 2.23 MB, dominated by the 18 per-tool OG cards.

## E. Root config & `package.json`

`eslint.config.js` + `eslint-rules/no-i18n-fallback.js` (registered as `xivdyetools-i18n`, rule enabled `warn`) KEEP · `postcss.config.js` KEEP · `tailwind.config.js` KEEP with stale `content[0]="./index.html"` · `playwright.config.ts` KEEP · all three `vite-plugin-*.ts` KEEP (imported by `vite.config.ts:3-5`) · `vite.config.ts` `@assets` alias DEAD · `.prettierrc.json`/`.prettierignore` KEEP · `.env.development` KEEP (gitignored; both vars read; comment names non-existent `xivdyetools-universalis-proxy`).

**`functions/_middleware.ts` — deployed and functional.** `node_modules/wrangler/wrangler-dist/cli.js:370150`: `functionsDirectory = customFunctionsDirectory || path.join(process.cwd(), "functions")` — resolved from cwd, not from `<dir>`. Workflows set `workingDirectory: apps/web-app` and run `pages deploy dist`, so `apps/web-app/functions/` is bundled at deploy time (`dist/` correctly has no `_worker.js`). Old domain `xivdyetools.projectgalatine.com` still appears in live source (`apps/oauth/src/constants/oauth.ts`) — redirect still has a subject. KEEP.

`package.json`: all scripts resolve except `build:css*` (dead) · `"main": "index.html"` — no such file (entry is `src/index.html`; `private`+`type:module` never resolves `main`) DEAD field · `engines.node ">=18.0.0"` vs root `">=22.13.0"` and CI `node-version: 22` — STALE.

devDependencies: `@playwright/test`, `@tailwindcss/postcss`, `tailwindcss`, `autoprefixer`, `postcss`, `@types/node`, `@vitest/coverage-v8`, `@vitest/ui` (`test:ui`), `jsdom`, `msw` (every unit test via `setup.ts:71`), `cross-env` (exactly one use — `test:e2e:coverage`), `sharp` (3 scripts, 2 live one-shots — heavy native dep for manual scripts only), `eslint-config-prettier`, `eslint-plugin-prettier`, `vite`, `vitest` — all KEEP. **`wrangler` (`^4.120.0`)** — not in any script or workflow command; deploy uses `cloudflare/wrangler-action@v4` with `packageManager: pnpm` and no `wranglerVersion`; the action resolves the version from the working directory's project when unset, so this devDep pins the deployed version. **KEEP — UNCERTAIN** (the "uses the local install" half is from knowledge of the action, not verified from its source here).

## F. Dead documentation

| File:line | Says | Wrong because |
|---|---|---|
| `CLAUDE.md:142` | lists `src/shared/… empty-state-icons.ts` | file is `state-icons.ts` |
| `CLAUDE.md:147` | `public/ # robots.txt, manifest.json, _headers` | `public/robots.txt` does not exist; contradicts line 250 |
| `CLAUDE.md:217` | "`service-worker.js` handles offline fallback" | SW is dead; by CLAUDE.md's own line 250 the root file never reaches `dist/` |
| `CLAUDE.md:49-50, 248` | `npm run build:css` → `assets/css/tailwind.css` committed | input absent, output in dead dir; real entry is `src/styles/tailwind.css` via PostCSS |
| `scripts/README.md:40` | responsive image code in `src/components/app-layout.ts` | file does not exist |
| `scripts/README.md` | documents 3 of 8 scripts | 5 undocumented |
| `.env.development` comment | `cd xivdyetools-universalis-proxy && npm run dev` | no such directory |
| `README.md:20-34`, `functions/README.md`, `src/__tests__/TESTING.md` | | all verified accurate |

## Summary of removable weight

| Bucket | Approx. bytes |
|---|---|
| `public/og/<tool>/*` (18 static cards superseded by og-worker) | 2,059,669 |
| `public/assets/icons/` orphans (SVG sets, unused sizes, `opengraph.png`, `tools/preview.html`) | ~172,000 |
| `scripts/analyze-unused-keys.js` + `scripts/convert-icons-to-webp.js` | 9,583 |
| `e2e/example.spec.ts` | 586 |
| Dead test-helper exports | ~20,000 (in-file) |

Two things that are not dead but broken: `src/index.html:53` → missing `favicon-48x48.png` (404 in production, works in beta) and `public/browserconfig.xml` → missing `mstile-150x150.png`. Both files exist only in the dead top-level `assets/icons/`, so deleting that directory without first copying them (or removing the two references) makes it permanent.
