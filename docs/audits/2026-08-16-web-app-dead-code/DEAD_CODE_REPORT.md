# Dead Code Analysis Report — `apps/web-app` (5.0.0)

## Executive Summary

- **Project:** `xivdyetools-web-app` 5.0.0 (Vite + Lit + Tailwind v4) at `monorepo-2.0-prep` `950660e`
- **Analysis Date:** 2026-08-16
- **Analysis Depth:** standard — symbol-level. Tooling: knip 6.32 (default **and** `--production` mode), `tsc --noUnusedLocals --noUnusedParameters`, depcheck 1.4, the repo's own `analyze-unused-keys.js` plus a stricter re-implementation, four parallel verification passes (TS symbols · CSS · i18n · non-source surface), and an **empirical browser check** (`vite preview` + Playwright `getComputedStyle`) for the CSS reachability claim.
- **Total Findings:** 30 (DEAD-030 added during Wave 3 execution)
- **Recommended Removals:** 25 REMOVE · 4 REFACTOR-FIRST (DEAD-018, 020, 025, parts of 026) · 0 KEEP-only findings (keep items are in the register below)
- **Estimated dead weight:** ~**1,000 source TS lines** + ~**1,900 test lines** · **1,719 of 2,758 CSS lines (62 %)** · **472 of 1,526 i18n keys (26 %, 131 KB across six locales)** · **~3.9 MB of never-served static assets** · 1 runtime dependency · 2 whole modules · 2 whole test files · 1 whole stylesheet

The prior sweep (2026-08-09) reported the web-app clean at the *file* level and it was — every file-level item it named is now closed. This pass went one level down and found that the **symbol, stylesheet, locale and asset** layers carry the leftovers of three UI generations (v3 multi-page → v4 → 5.0), plus one structural surprise:

> **The nine tools render inside `V4LayoutShell`'s shadow root, so more than half of the page CSS can never reach them.** The repo already knew this (`v4-layout.ts:313-321`) and 5.0 patched the visible casualties with inline styles and per-tool `<style>` tags — but the original rules were never removed, and four rule groups (`.number` tabular-nums among them) have **no** shadow-side equivalent at all. Verified with computed styles in the built app: `evidence/shadow-dom-css-check.md`.

## Health Score

**Code Freshness: C** (weighted) — with very different grades per layer:

| Layer | Dead share | Grade |
|---|---|---|
| TypeScript source (63.8k non-test lines) | ~1.6 % (≈1,000 lines; largest single item is one 385-line class) | **B** |
| CSS (2,758 lines) | 62 % dead or unreachable | **F** |
| i18n (1,526 keys × 6) | 26 % | **D** |
| Static assets (`public/`, root) | ~3.9 MB unreferenced (2 MB of it uploaded on every deploy) | **D** |
| Test infrastructure | ~34 KB of unused helpers; 2 whole test files for dead modules; 0 skipped tests | **B** |
| Dependencies | 1 redundant runtime dep; devDeps all justified | **A** |

The TypeScript grade is genuinely good for a 100k-line app. The C is earned by the stylesheets and locales, which nobody has audited since the shell moved to shadow DOM.

## Summary by Category

| Category | Count | Remove | Refactor first | Approx. size |
|----------|-------|--------|----------------|--------------|
| Orphaned Files & Assets | 9 | 9 | 0 | ~3.9 MB + 257 src lines + 488 test lines |
| Unused Exports / Types / Symbols | 7 | 7 | (1 row) | ~1,000 src + ~1,400 test lines |
| Dead Code Paths / Legacy / Debug | 2 | 1 | 1 | ~60 lines |
| Dead CSS | 3 | 2 | 1 | ~1,719 lines / 36.6 KB |
| i18n | 1 | 1 | 0 | 472 keys / 131 KB |
| Dead Config / Dependency | 2 | 2 | 0 | config + 1 dep |
| Stale Tests / Scripts / Metadata / Docs | 5 | 3 | 2 | ~34 KB helpers + metadata |

## Findings Catalog

| ID | Title | Category | Confidence | Blast radius | Recommendation |
|----|-------|----------|-----------|--------------|----------------|
| [DEAD-001](findings/DEAD-001.md) | Top-level `assets/` — 1.1 MB v3 static bundle outside publicDir | Orphaned File | HIGH | NONE | **REMOVE** (copy 2 icons to `public/` first) |
| [DEAD-002](findings/DEAD-002.md) | `src/public/` — 408 KB in a dir Vite never serves | Orphaned File | HIGH | NONE | **REMOVE** |
| [DEAD-003](findings/DEAD-003.md) | `service-worker.js` (v3 precache list, never shipped) + `sw-register.js` (shipped, never loaded) | Orphaned File | HIGH | NONE | **REMOVE** |
| [DEAD-004](findings/DEAD-004.md) | `public/js/load-css.js` — superseded by the async-css plugin | Orphaned File | HIGH | NONE | **REMOVE** |
| [DEAD-005](findings/DEAD-005.md) | root `robots.txt` — v3 disallows, never deployed | Orphaned File | HIGH | NONE | **REMOVE** |
| [DEAD-006](findings/DEAD-006.md) | dead aliases (`@apps` `@data` `@assets` `@v4`), broken `build:css*`, `tsconfig.app.json`, `main` field | Dead Config | HIGH | NONE | **REMOVE** |
| [DEAD-007](findings/DEAD-007.md) | `spectral.js` declared but only reached via `@xivdyetools/core/blending` | Unused Dependency | HIGH | NONE | **REMOVE** |
| [DEAD-008](findings/DEAD-008.md) | **`SecureStorage`** — 385-line checksummed-storage class, 0 callers, 1,325-line test | Unused Export | HIGH | LOW | **REMOVE** |
| [DEAD-009](findings/DEAD-009.md) | `price-utilities.ts` — whole module (191) + test (418), 0 prod callers | Orphaned Module | HIGH | LOW | **REMOVE** |
| [DEAD-010](findings/DEAD-010.md) | `dye-selection-context.ts` — whole module (66) + test (70) | Orphaned Module | HIGH | NONE | **REMOVE** |
| [DEAD-011](findings/DEAD-011.md) | services barrel — 42 redundant + 30 dead re-exports | Unused Export | HIGH | LOW | **REMOVE** (trim) |
| [DEAD-012](findings/DEAD-012.md) | 15 dead exported functions (`generateMarketErrorCode` 51, `generateHarmonyPanelData` 53, five `close*`, `destroyV4Layout` 46, …) + 30 drop-export-only | Unused Export | HIGH | LOW | **REMOVE** |
| [DEAD-013](findings/DEAD-013.md) | 21 dead SVG icon constants (6.4 KB) | Unused Export | HIGH | NONE | **REMOVE** |
| [DEAD-014](findings/DEAD-014.md) | 11 dead exported types (`types.ts` state island 41 lines, `WebAppTranslations` 33, 4 market events, …) | Unused Type | HIGH | NONE | **REMOVE** |
| [DEAD-015](findings/DEAD-015.md) | 15 unread locals/fields/params incl. `dyesWithHSV` cascade (32), write-only `@state displayOptions`, `_toolName`×2 | Dead Code Path | HIGH | LOW | **REMOVE** (`_isFocused` REFACTOR-FIRST) |
| [DEAD-016](findings/DEAD-016.md) | dead `BaseComponent` protected API (`addClass/removeClass/hasClass/off/setState`), `clearError`, no-op `updateDrawerContent` with 6 callers | Dead Code Path | HIGH | LOW | **REMOVE** |
| [DEAD-017](findings/DEAD-017.md) | always-true `FEATURE_FLAGS`, completed-migration `HarmonyConfig.show*`, `ICON_UPLOAD` alias | Legacy Code | HIGH | LOW | **REMOVE** |
| [DEAD-018](findings/DEAD-018.md) | ~24 `console.info` traces shipping to prod (auth-service echoes URL during sign-in) | Debug Residue | MEDIUM | NONE | **REFACTOR FIRST** |
| [DEAD-019](findings/DEAD-019.md) | provably dead CSS — entire `v4-utilities.css` + ~580 lines elsewhere | Dead CSS | HIGH | LOW | **REMOVE** |
| [DEAD-020](findings/DEAD-020.md) | **unreachable CSS** — ~876 lines targeting shadow-DOM tool content (verified empirically). *Correction at execution:* the page copies of `.number`, `.dye-swatch`, `.empty-state*`, `.component-error-*` **do** reach the light-DOM modal mounts of the same components (`preset-edit-form` → `dye-selector` → `dye-grid`), so those were kept page-side and *additionally* injected shadow-side via one shared `tool-content.css`; only tool-only rules were deleted | Dead CSS | HIGH | NONE (inert) | **REFACTOR FIRST** for 4 rule groups, then **REMOVE** |
| [DEAD-021](findings/DEAD-021.md) | `tailwind.config.js` phantom `content`, dead `font-heading`, colliding `font-numeric` | Dead Config | HIGH | NONE | **REMOVE** |
| [DEAD-022](findings/DEAD-022.md) | **472 dead i18n keys** × 6 locales (131 KB) | Legacy Data | HIGH | LOW | **REMOVE** |
| [DEAD-023](findings/DEAD-023.md) | **`public/og/<tool>/` 18 static OG cards (2.06 MB)** — og-worker serves these | Orphaned Asset | HIGH | NONE | **REMOVE** |
| [DEAD-024](findings/DEAD-024.md) | `public/assets/icons/` orphans (~172 KB) incl. publicly-reachable `tools/preview.html`, duplicate `opengraph.png`, dead icon preloads | Orphaned Asset | HIGH | LOW | **REMOVE** |
| [DEAD-025](findings/DEAD-025.md) | `manifest.json` v3 shortcuts + `share_target`, `sitemap.xml` 5 dead URLs, `browserconfig.xml` 404 tile | Stale Metadata | HIGH | LOW | **REFACTOR FIRST** (correct) |
| [DEAD-026](findings/DEAD-026.md) | `convert-icons-to-webp.js` (dead), `analyze-unused-keys.js` (unwired), `scripts/README.md` | Stale Scripts | HIGH | NONE | **REMOVE** / wire |
| [DEAD-027](findings/DEAD-027.md) | `e2e/example.spec.ts` (hits playwright.dev) — *(the 3 fixture exports first reported here were re-checked and are live; kept)* | Stale Test | HIGH | NONE | **REMOVE** |
| [DEAD-028](findings/DEAD-028.md) | 22/32 `component-utils` helpers, 9 mock factories, `errorHandlers`, 2 server helpers (~34 KB) | Stale Test | HIGH | NONE | **REMOVE** |
| [DEAD-029](findings/DEAD-029.md) | stale `CLAUDE.md`/`scripts/README.md`/`.env` lines, `engines.node` mismatch | Stale Docs | HIGH | NONE | **CORRECT** |
| [DEAD-030](findings/DEAD-030.md) | **`HarmonyType` never constructed** — `harmony-type.ts` (369) + `info-tooltip.ts` (118) + tests (578); found during Wave 3 (imported only as a type, so knip missed it) | Orphaned Module | HIGH | LOW | **REMOVE** (done, Wave 3) |

## Quick Wins (High Confidence, Safe to Remove, No Cascades)

| ID | Description | Saved |
|----|-------------|-------|
| DEAD-023 | delete `public/og/<tool>/` ×9 dirs | 2.06 MB per deploy |
| DEAD-001 + 002 | delete root `assets/` and `src/public/` (after copying `favicon-48x48.png`, `mstile-150x150.png` into `public/assets/icons/`) | 1.5 MB in repo; fixes two production 404s |
| DEAD-003 + 004 + 005 | delete `service-worker.js`, `public/js/`, root `robots.txt` | 3 files |
| DEAD-013 | delete 21 icon constants | 130 lines |
| DEAD-014 | delete `types.ts:88-128`, `i18n-types.ts:29-64`, 4 market-event types, `ConfigChangeEvent`, `PricingState` | ~120 lines |
| DEAD-019 | `git rm src/styles/v4-utilities.css` + its `main.ts` import | 265 lines |
| DEAD-027 | delete `e2e/example.spec.ts` | one external network dependency per e2e run |
| DEAD-007 | drop `spectral.js` from `package.json` | 1 dep |
| DEAD-006 | drop dead aliases, `build:css*`, `tsconfig.app.json`, `main` | config |

## Recommended Removals (High Confidence, Small Cascades)

| ID | Description | Verify Before Removing |
|----|-------------|----------------------|
| DEAD-008 | `SecureStorage` section + test | coverage ratchet delta (`vitest --coverage` before/after) |
| DEAD-009 / 010 | two orphan service modules + tests | same |
| DEAD-011 | trim the barrel | `type-check` names any test that imported through it |
| DEAD-012 | 15 dead functions | trim the matching `it()` blocks in 4 test files |
| DEAD-015 / 016 / 017 | tsc-flagged locals, base-class API, feature flags | mechanical; type-check is the oracle |
| DEAD-022 | 472 i18n keys | run the deletion script against **all six** locales; `validate:i18n`; smoke in `en` + one CJK |
| DEAD-024 | icon orphans + preload lines | update `beta-branding.test.ts` fixture (`:40-41,:136`) |
| DEAD-028 | test-helper pruning | `pnpm test` |

## Refactor First

| ID | What to decide | Why it isn't a plain delete |
|----|----------------|-----------------------------|
| DEAD-020 | Where should `.number` (Fragment Mono + tabular-nums), `.component-error-*`, `.loading-spinner`, `.harmony-*` live so they *apply*? | The rules are inert today; deleting them changes nothing, but the intent (`6b608ec` "numeric columns in Fragment Mono") is currently unfulfilled inside the shell. Move to a shadow-side sheet, verify with `getComputedStyle`, then delete the page copies. |
| DEAD-018 | Convert `console.info` traces to `logger.info` and drop `'info'` from ESLint's `no-console` allow list | `auth-service.ts` logs request context into every user's console during sign-in. |
| DEAD-025 | Correct `manifest.json` / `sitemap.xml` / `browserconfig.xml` | These are corrections to shipped metadata, not deletions. |
| DEAD-015 `_isFocused` | Should the dye-grid cell reflect keyboard focus? | Might be a missing feature, not dead code. |
| DEAD-026 `analyze-unused-keys.js` | Wire it (with the 11 real lookup patterns) or delete it | An unwired analyzer with known false positives helps nobody. |

## Keep / Monitor Register

| Item | Reason to keep | Revisit trigger |
|------|----------------|-----------------|
| `wrangler` devDependency | `cloudflare/wrangler-action@v4` with `packageManager: pnpm` and no `wranglerVersion` resolves the version from the working directory's install — this devDep pins the deploy tool | Confirm against the action's source; if it always installs its own, remove |
| `scripts/check-bundle-size.d.ts` | knip false positive — implicitly resolved for `bundle-budget.test.ts`'s `.js` import | never |
| `functions/_middleware.ts` | deployed (wrangler resolves `functions/` from cwd = `apps/web-app`); the old domain still appears in live oauth source | when `xivdyetools.projectgalatine.com` is retired |
| `tutorial.*` i18n namespace (47 keys) | all literal-referenced by `tutorial-service.ts` / `tutorial-spotlight.ts` — the prior "36 unused" note was stale | never |
| `TOOL_ICONS` legacy keys `matcher`/`character` | back the `/matcher`,`/character` route redirects | when `LEGACY_ROUTE_REDIRECTS` is retired |
| `collection-service.ts:213-397`, `extractor-tool.ts:455-464` storage migrations; `migrateLegacyThemeName` | must survive until every user's localStorage has been read once | after a documented sunset window |
| `browser-api-types.ts` `EyeDropper*` exports; 6 `@customElement` side-effect modules; `getState` (polymorphic); `firstUpdated` (Lit hook); `__setTestEnvironment` (test hook); beta-branding exports (vite plugin) | dynamic / framework / test consumers knip cannot see | never |
| `sharp`, `cross-env`, `@vitest/ui`, `msw`, `jsdom` etc. | each has a verified consumer | — |
| `showDeltaE` (`@deprecated`) | still read by 3+ tools | when the deprecation completes |
| `e2e-coverage/` (78 MB on disk, gitignored) | build artefact, not source | local cleanup only |

## Dependency Cleanup

| Package | Status | Recommendation |
|---------|--------|---------------|
| `spectral.js` | direct dep, no direct import; reached via `@xivdyetools/core/blending` which declares it | Remove from web-app `package.json` (DEAD-007) |
| `wrangler` | devDep; used only implicitly by `wrangler-action` | KEEP-UNCERTAIN (see register) |
| everything else | verified consumers | KEEP |

depcheck's other "unused devDependencies" (`@tailwindcss/postcss`, `autoprefixer`, `postcss`, `tailwindcss`, `cross-env`) are false positives — consumed by `postcss.config.js`, `@import "tailwindcss"`, and one script.

## Collateral Bugs Found (not dead code — fix alongside)

| # | Where | What |
|---|---|---|
| B1 | `src/index.html:53` | links `/assets/icons/favicon-48x48.png` — **missing from `public/`** (only in dead root `assets/icons/`) → 404 in production (beta rewrites to `beta/` and works) |
| B2 | `public/browserconfig.xml` | `mstile-150x150.png` missing from `public/` → Windows tile 404 |
| B3 | page CSS vs shadow DOM | `.number` (Fragment Mono + tabular-nums), `.component-error-*`, `.loading-spinner`, `.harmony-*` never apply to tool content — the styling intent is silently unmet (DEAD-020) |
| B4 | `src/index.html:77-78` | two `<link rel="preload">` for images nothing renders — browser warns on every load; `fetchpriority="high"` on an unused image competes with real LCP work |
| B5 | `public/manifest.json` | PWA shortcuts point at v3 URLs; `share_target` has no handler; app ships a manifest but no service worker |
| B6 | `dist/robots.txt` | production has none (404) while `sitemap.xml` ships and lists 5 dead URLs |
| B7 | `src/services/auth-service.ts` | `console.info` of `window.location.href`/params during OAuth exchange (DEAD-018) |
| B8 | `src/components/v4/preset-detail.ts:99` | write-only `@state` → spurious re-renders on every config change |
| B9 | `public/assets/icons/tools/preview.html` | dev gallery page publicly reachable in production |

## Cleanup Execution Plan

### Wave 1 — Isolated deletions (one PR, no code-path changes)
1. Copy `assets/icons/favicon-48x48.png` and `assets/icons/mstile-150x150.png` → `public/assets/icons/` (fixes B1, B2)
2. DEAD-001, 002, 003, 004, 005, 023, 024, 027, 013, 014, 019 (`v4-utilities.css` only), 006, 007
3. Correct `CLAUDE.md` / `scripts/README.md` lines that described the deleted things (DEAD-029)
4. `pnpm --filter xivdyetools-web-app run type-check test build && node scripts/check-bundle-size.js`; `vite preview` smoke

### Wave 2 — Symbol removals (one PR per bullet is fine)
1. DEAD-008 (`SecureStorage` + test) → measure coverage delta, adjust the ratchet by exactly that
2. DEAD-009, 010 (orphan modules + tests) → same
3. DEAD-012, 015, 016, 017 (functions, locals, base-class API, flags) → then DEAD-011 (barrel trim) last, since it becomes self-verifying
4. DEAD-028 (test helpers)
5. Flip `noUnusedLocals`/`noUnusedParameters` to `true` in `apps/web-app/tsconfig.json` once the count is 0

### Wave 3 — CSS and i18n
1. DEAD-020 refactor: move `.number`, `.component-error-*`, `.loading-spinner`, `.harmony-*` into a shadow-side sheet; verify with the `getComputedStyle` probe in `evidence/shadow-dom-css-check.md`
2. DEAD-019 remaining blocks + DEAD-020 page copies + DEAD-021 → build, size-check, visual smoke of toasts/tooltips/modals/theme switch
3. DEAD-022: scripted deletion of the 472 keys from all six locales → `validate:i18n`, smoke `en` + `ja`

### Wave 4 — Corrections and guardrails
1. DEAD-025 (manifest/sitemap/browserconfig), DEAD-018 (`console.info` → logger; tighten `no-console`), DEAD-026 (wire or delete the analyzer)
2. Add `knip` to the web-app's `lint` (or a `lint:dead` script) with a checked-in `knip.json` — the config used here is reproducible from `evidence/knip-report.txt`'s header
3. Extend `scripts/validate-i18n.js` with the 11 lookup patterns so orphaned keys fail CI

## Post-Cleanup Verification
- [ ] `pnpm turbo run type-check test lint build --filter=xivdyetools-web-app` green
- [ ] `node scripts/check-bundle-size.js` green; record the locale-chunk and CSS-chunk deltas
- [ ] `vite preview`: `/harmony`, `/extractor`, `/presets`, `/mixer` in `en` and `ja`; theme switch; toast; tooltip; error boundary (force one)
- [ ] `getComputedStyle` probe confirms `.number` now resolves to Fragment Mono + tabular inside the shell (DEAD-020)
- [ ] No "preloaded but not used" console warnings; no 404s for favicon-48 / mstile
- [ ] `dist/` contains no `og/<tool>/`, no `js/`, no `assets/icons/tools/preview.html`
- [ ] Coverage ratchet adjusted only by the measured delta from deleting fully-covered dead modules

## Recommendations (preventing regrowth) — status after Waves 1-4

| # | Recommendation | Status |
|---|---|---|
| 1 | knip in CI | **done** — `knip.jsonc`, `lint` runs it, turbo cache key extended (Wave 4) |
| 2 | `noUnusedLocals`/`noUnusedParameters` on | **done** (Wave 2) |
| 3 | shadow-boundary rule where it bites | **done** — `tool-content.css` header + `v4-layout.css`/`v4-layout.ts` comments (Wave 3); the Playwright computed-style assertion is still a good idea (not done) |
| 4 | i18n orphan detection as a gate | **done** — `i18n:unused` + `i18n-orphans.test.ts` (Wave 4) |
| 5 | audit `public/` on UI-generation changes | **partly** — `public-metadata.test.ts` pins the metadata files and icon links to `ROUTES`/`public/` (Wave 4); a check that every file under `public/` is referenced is not done |

1. **Ship knip in CI for the web-app.** With `--production` mode it would have caught `SecureStorage`, `price-utilities`, `dye-selection-context` and the barrel drift years ago. Test files as entries hide test-only symbols; run both modes.
2. **Turn on `noUnusedLocals` / `noUnusedParameters`** in `apps/web-app/tsconfig.json`, and stop using `_`-prefixes to silence real dead code (`eslint.config.js` `varsIgnorePattern: '^_'` is what let `_toolName`, `_isFocused`, `_configController` survive).
3. **Put the shadow-boundary rule where it bites:** a comment block at the top of `globals.css` and `v4-layout.css` ("rules here do NOT reach tool content — see v4-layout.ts") plus a Playwright assertion that a known tool element has the expected computed font-family. Half the CSS in this app was written on the wrong side of that boundary.
4. **Make i18n orphan detection a gate.** `validate-i18n.js` checks *missing* keys only; extend it with the enumerated lookup patterns and fail on orphans. 26 % dead locale content is what happens without it.
5. **Audit `public/` on every UI generation change.** Everything under `public/` ships; the 2 MB of OG cards and the dev gallery page were invisible precisely because they never broke anything.

## Method Notes
- knip was run twice: default (test files as entries → catches nothing-imports-it) and `--production` (test files ignored → surfaces test-only symbols). Both outputs are in `evidence/`.
- The i18n number went 507 (repo script) → 632 (stricter literal/prefix scan) → **472 confirmed dead + 160 false positives** (every dynamic template's value set enumerated). The intermediate lists are kept so the false-positive shapes are reusable.
- The CSS "unreachable" claim was not taken from grep alone: it was reproduced in the built app with computed styles (`evidence/shadow-dom-css-check.md`) — page rule says `14px/600`, element computes `11px/400` from an inline style.
- Three claims from the verification passes were overturned by the main session and are recorded as such: `scripts/check-bundle-size.d.ts` is **not** dead (implicit `.d.ts` resolution); `sw-register.js` does **not** 404 on every load (nothing loads it in the first place); and the three `e2e/fixtures/navigation.ts` exports named in DEAD-027 are used by three specs (caught on re-check during Wave 1 — always re-grep before `git rm`).
