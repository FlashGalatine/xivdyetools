# Changelog

All notable changes to the XIV Dye Tools monorepo will be documented in this file.

This changelog covers the **monorepo itself** (workspace structure, CI/CD, shared configuration). For individual package changelogs, see the `CHANGELOG.md` in each package's directory.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.18.0] - 2026-07-19

Full remediation of the 2026-07-18 deep-dive audit (139 findings; 128 scheduled across 8 deploy-unit sprints in `docs/audits/2026-07-18/REMEDIATION_PLAN.md`) — every sprint implemented, verified, and documented, with per-finding Status sections recording what shipped and what was deliberately deferred. Sprint 1 (presets-api) deployed to production 2026-07-18; everything else awaits the coordinated npm publish + worker deploy + web-app release sequence recorded in the plan.

### Security

- **presets-api** `1.6.0` (Sprint 1): **CRITICAL** — closed the moderation state-machine gap that allowed submitter self-approval; transitions validated server-side, D1 `batch()` used as a single transaction with `changes()`-gated updates; migration 0006 adds a unique preset-signature index (production applied; also surfaced that migration 0004's index had never landed as UNIQUE)
- **oauth** `2.5.0` / **@xivdyetools/auth** `1.2.0` (Sprint 2): refresh rotation with `jti`-based revocation (KV) and `orig_iat` absolute session anchoring; OAuth state-signing hardening; dual JWT verifier paths consolidated
- **@xivdyetools/logger** `1.3.0` (Sprint 6): redaction bypasses closed — case/separator-normalized key matching with a sensitive-suffix heuristic and a cycle guard instead of the depth-3 cap (BUG-024); JSON-quoted keys and spaced separators sanitized in error messages (BUG-025); the browser preset's errorTracker path now redacts before forwarding to third parties (BUG-026)
- **@xivdyetools/auth** `1.2.0` (Sprint 6): Discord request body limit measured in UTF-8 bytes, closing the ~4× permissive gap for CJK/emoji payloads (BUG-059)
- **@xivdyetools/svg** `1.2.0` (Sprint 6): all string attributes in SVG primitives XML-escaped — injection-proof regardless of caller hygiene (REFACTOR-019)
- **universalis-proxy** `1.5.0` (Sprint 7): spoofable `X-Forwarded-For` fallback removed in favor of the shared `getClientIp()` (BUG-066); 5 MB upstream cap enforced by a streamed byte budget, closing the chunked-response bypass (BUG-065)

### Fixed

- **web-app** `4.12.0` (Sprint 3): market-board pricing, storage-service, and v4-layout corrections from the web-frontends findings batch
- **@xivdyetools/core** `2.7.0` (Sprint 4): perceptual dye search uses an exact scan — the k-d-radius approach could return a worse in-radius dye while the true nearest sat outside (REFACTOR-003, proven by the new parity test); LRU caches return defensive copies (BUG-005); `APIService` batches >100-item Universalis requests; **api-worker** `0.5.0` route/middleware/validation fixes ride the same sprint
- **discord-worker** `4.7.0` (Sprint 5): moderation approve/reject buttons finally routable via the new `MODERATION_BOT_TOKEN` secret — Discord routes component clicks to the message-owning application, so buttons posted by the main bot could never reach moderation-worker (BUG-009 HIGH); outcome-checked Discord API wrappers end silent "Bot is thinking…" hangs (BUG-035, also **moderation-worker** `1.3.0`); Universalis world→DC→region scope cascade (BUG-033); `/stats` follows KV cursors (BUG-037); shared MODERATOR_IDS grammar in **@xivdyetools/bot-logic** `1.3.0` (BUG-073); **stoat-worker** `0.2.0` reaction context keyed by the bot reply's ID (BUG-038)
- **@xivdyetools/rate-limiter** `1.5.0` (Sprint 6): fake KV optimistic concurrency removed — version metadata was never compared and the verification read could double-count while costing a billed read per request (BUG-022/OPT-002); per-key cleanup windows (BUG-023); Upstash reports actual remaining TTL (BUG-055); window-boundary straddle fixed (BUG-064); **@xivdyetools/worker-middleware** `1.2.0` memoizes backend factories so a per-request `MemoryRateLimiter` can no longer silently disable limiting (BUG-061)
- **@xivdyetools/types** `1.15.0` + **@xivdyetools/svg** `1.2.0` + **@xivdyetools/bot-logic** `1.3.0` (Sprint 6): match-quality thresholds unified in one shared classifier — four divergent copies (two comparison operators) meant an embed and its attached image could disagree about the same match at boundary distances (REFACTOR-004); plus emoji-tofu removal (BUG-056), surrogate-safe truncation (BUG-060), `#NaNNaNNaN` gradient guard (BUG-063), fullwidth-forms width estimation (REFACTOR-020), localizable accessibility labels (REFACTOR-022)
- **universalis-proxy** `1.5.0` (Sprint 7): `Vary: Origin` on cacheable CORS responses — shared caches could replay one allowed origin's ACAO to the other (BUG-027); stale SWR responses no longer export a full fresh `max-age` downstream (BUG-028)
- **og-worker** `1.4.0` (Sprint 7): the validated `?algo=` and 3-dye `ratio` are actually used — harmony deltas, gradient interpolation space, and blend matching honor the requested algorithm, so the "Algorithm:" footer on shared images no longer lies (BUG-031); explicit browser/edge TTLs replace the hidden ×7 multiplier that turned "7 days" into 49 at the edge (BUG-068); self-fetch guard on the `og.` custom domain (BUG-069)
- **maintainer** `1.0.3` (Sprint 8): `stripDyePrefix` finally contains a real U+FF1A full-width colon — the old "full-width" variant was the same ASCII `:` twice (BUG-081)

### Changed

- **web-app** `4.12.0` (Sprint 8 / REFACTOR-002 step 1): `BaseComponent` owns a shared `SubscriptionManager` with automatic cleanup in `destroy()`; all seven hand-rolled tools converted — subscription hygiene is now guaranteed by the base class instead of re-audited per 2,000-3,500-line component. Steps 2-4 (price mixin, shared result-card renderer, drawer builder) remain as documented, independently shippable follow-ups
- **@xivdyetools/color-blending** `1.1.0`: dropped its `@xivdyetools/core` dependency (one hexToRgb call pulled in the entire dye DB/k-d tree/i18n) — now a true zero-internal-dependency leaf matching the documented graph (REFACTOR-005)
- **og-worker** `1.4.0`: local ~260-line fork of the SVG primitives replaced by `@xivdyetools/svg` re-exports — retroactively inheriting Sprint 6's attribute escaping and CJK-aware truncation (fixes ja/ko/zh names overflowing OG swatch columns) (REFACTOR-009); CLAUDE.md font documentation corrected, single `DyeService` per isolate (REFACTOR-024)
- **discord-worker** `4.7.0`: shared sanitized moderation-embed builder replaces three divergent copies (REFACTOR-025/BUG-072); component-context TTL capped at Discord's 15-minute token lifetime (BUG-075)

### Performance

- **web-app** `4.12.0` (Sprint 8): Palette Extractor yields a frame so the "Extracting…" state paints, and grid-samples the K-means input (~80× less blocking work on 4K images) (OPT-011); images persist to a new IndexedDB `image_cache` store instead of a multi-MB localStorage data-URL that could consume ~80% of the shared quota and silently break all later settings/favorites writes (OPT-012, with one-time migration)
- **discord-worker** `4.7.0` (Sprint 5): favorites autocomplete drops from up to 50 service-binding subrequests per keystroke to zero via denormalized entries (OPT-007); stale-if-error price cache keeps `/budget` alive through Universalis outages (OPT-006); no-op analytics verification read deleted (OPT-008); ~21 MiB unused CJK source fonts moved out of bundling reach (OPT-009); one prefs read per interaction (OPT-026)
- **universalis-proxy** `1.5.0` (Sprint 7): one cache write per burst instead of one per coalesced waiter (OPT-021); item IDs deduplicated and the upstream URL canonicalized (OPT-022)
- **og-worker** `1.4.0` (Sprint 7): character-color-by-hex is a lazy reverse index — one `Map.get` instead of 64 sequential sheet scans per swatch request (OPT-005); O(1) itemID lookups and winner-only ΔE in the harmony scan (OPT-023)
- **@xivdyetools/crypto** `1.1.1`: chunked base64 encoding, ~10-50× faster for KB+ payloads (OPT-019); **@xivdyetools/logger** `1.3.0`: child-logger timing entries carry `requestId` (OPT-020); **maintainer** `1.0.3`: XIVAPI locale fetches fan out concurrently — worst case 40 s → 10 s (OPT-029)

### Documentation

- Per-finding `## Status` sections added to all 128 scheduled finding docs under `docs/audits/2026-07-18/`; each sprint header in `REMEDIATION_PLAN.md` marked ✅ with its deploy needs
- All 22 package/app changelogs updated with the sprint work; lagging app versions bumped (oauth 2.5.0, presets-api 1.6.0, discord-worker 4.7.0, moderation-worker 1.3.0, stoat-worker 0.2.0, api-worker 0.5.0, maintainer 1.0.3, web-app 4.12.0, og-worker 1.4.0 — 1.3.0 had already shipped 2026-05-29 while `package.json` lagged); web-app `CHANGELOG-laymans.md` gained a plain-language 4.12.0 entry
- CLAUDE.md corrections where the audit invalidated documented claims: rate-limiter (best-effort KV semantics), color-blending (zero internal deps), moderation-worker (actual HMAC scope), og-worker (five bundled fonts incl. CJK subsets), universalis-proxy (stale-response cache headers, `getClientIp`)
- **@xivdyetools/test-utils** `1.1.8`: MockD1 `exec()` keeps `_queries`/`_bindings` index-aligned (BUG-062); `batch()` honors `run()` semantics

### Deploy sequence (pending)

1. Batch npm publish: types 1.15.0, crypto 1.1.1, logger 1.3.0, auth 1.2.0, rate-limiter 1.5.0, color-blending 1.1.0, svg 1.2.0, bot-logic 1.3.0, worker-middleware 1.2.0, test-utils 1.1.8, core 2.7.0 (`--ignore-scripts` if locale files were hand-edited)
2. Worker deploys: discord-worker (+ set `MODERATION_BOT_TOKEN` secret), moderation-worker, oauth, api-worker, universalis-proxy, og-worker (needs the svg publish), stoat-worker restart
3. web-app 4.12.0 release

---

## [1.17.0] - 2026-06-09

Module-surface cleanup and CI hygiene fixes from the dead-code audit (DEAD-113 through DEAD-126), merged alongside routine dependabot dependency-bump PRs (`@cloudflare/workers-types`, `hono`, `@types/node`, `wrangler`, and other dev/production dependencies across 15 `package.json` files — version-string bumps only, no behavioral changes).

### Removed

- **discord-worker** `4.6.1`: Dead-code cleanup (DEAD-113..120) — deleted the unused `utils/error-response.ts` "Error UX Standard V4" module (21 exports, zero consumers) and its 344-line test suite, plus unused exports across `utils/response.ts`, `utils/verify.ts`, `services/budget/price-cache.ts` (+ `services/budget/index.ts` re-export), `services/component-context.ts`, `services/emoji.ts`, `types/budget.ts`, `types/image.ts`, `types/preferences.ts`, `types/preset.ts`, and `test-utils.integration.ts` — roughly 1,300 lines removed with no change to the worker's public command surface

### Added

- **discord-worker** `4.6.1`: New `services/preset-favorites.test.ts` (22 tests) covering the `/preset favorite` KV-backed service introduced in `4.6.0`, which previously had zero test coverage

### Fixed

- **discord-worker** `4.6.1`: `vitest.config.ts` coverage thresholds used the Vitest 1/2-era `{ global: { statements, branches, functions, lines } }` shape, which Vitest 4 silently ignores — `test:coverage` exited 0 even though statements coverage had drifted to 84.89%, below the documented 85% floor. Flattened to the shape Vitest 4 actually reads; coverage now sits at 86.39% / 76.73% / 88.69% / 86.66% (statements / branches / functions / lines), all above the 85/75/85/85 thresholds

### Documentation

- **bot-i18n** `1.2.1`: README corrected to remove documentation for `translate()`, `getAvailableLocales()`, `isLocaleSupported()` (DEAD-126) — these were removed from the package's exports in `1.1.0` (DEAD-032), but the README kept describing them as part of the public API for two subsequent releases

---

## [1.16.0] - 2026-05-31

Web-app release rollup for the consolidation-spectrum filter work, budget matching improvements, and v4 E2E stabilization tracked on `feat/consolidation-spectrum-filter` ahead of merge to `main`.

### Added

- **web-app** `4.11.0`: New Consolidation Spectrum filter chips in the color palette drawer (Standard, Wide #1, Wide #2, Unconsolidated) with all 6 locales updated for the new `colorPalette.spectrum*` keys
- **web-app** `4.11.0`: Budget Suggestions now exposes matching-algorithm selection in v4 config and uses that algorithm for candidate matching and Delta-E sorting

### Fixed

- **web-app** `4.11.0`: Budget alternatives are now generated from the full in-distance dye pool instead of a hard 50-candidate cap, with vendor-cost fallback when market prices are unavailable
- **web-app** `4.11.0`: Re-enabled and stabilized Collection Manager E2E coverage for v4 flows (tool selection, overlays, advanced settings)
- **web-app** `4.11.0`: Updated favorites header semantics in `dye-selector.ts` to avoid invalid nested interactive controls while preserving keyboard and ARIA behavior

### Changed

- **web-app** `4.11.0`: Landed v4 Playwright rewrite blocks for dye comparison, dye mixer, harmony generator, and UI interactions using resilient selectors and startup hardening
- **web-app** `4.11.0`: Tightened module surfaces and dependency hygiene via dead-code cleanup waves (DEAD-086..112)

### Removed

- **web-app** `4.11.0`: Removed orphaned/dead v3 and test-only UI modules, deprecated filter-chain code, unused shared exports, and obsolete dev dependencies

---

## [1.15.0] - 2026-05-29

Security hardening from the 2026-05-28 quick-wins audit pass, plus CJK font support in `og-worker` so shared link embeds render localized dye names in Japanese, Korean, and Chinese.

### Added

- **og-worker** `1.3.0`: Noto Sans SC (289.6 KiB) and Noto Sans KR (176.5 KiB) subset fonts bundled — OG preview cards now render actual CJK dye names for `?lang=ja`, `?lang=ko`, `?lang=zh` instead of English fallback. Subset characters scoped to dye names in `packages/core/src/data/locales/` (narrower than discord-worker which also includes bot-i18n UI strings). New `scripts/subset-cjk-fonts.py` script; re-run when new dyes add out-of-subset characters
- **og-worker** `1.3.0`: `FONTS.primaryCjk` / `FONTS.headerCjk` constants in `services/svg/base.ts` — CJK-aware font-family fallback chains applied to all localized dye-name text elements across all 6 SVG generators (`harmony`, `comparison`, `gradient`, `swatch`, `accessibility`, `mixer`)

### Fixed

- **og-worker** `1.3.0`: `getLocalizedDyeName()` in `services/translator.ts` — removed `CJK_LOCALES` early-return guard that was serving English dye names for `ja`/`ko`/`zh` locales. All 6 locales now served uniformly through `TranslationProvider`

### Security

- **FINDING-005** (monorepo): `qs >= 6.15.2` pinned via `pnpm.overrides` in root `package.json` and applied to lockfile — resolves advisory **GHSA-q8mj-m7cp-5q26** (prototype pollution in qs ≤ 6.15.1). `pnpm audit` now shows 2 remaining advisories, both in the `apps/api-docs → vitepress → vite / esbuild` chain (`GHSA-4w7w-66w2-5vf9`, `GHSA-67mh-4wv8-2f99`); VitePress 1.6.4 hard-pins `"vite": "^5.4.14"` — unfixable without a VitePress major upgrade

### Documentation

- **oauth** `2.4.1`: `FINDING-006` — inline TODO comment added to the dev `[[d1_databases]]` binding in `wrangler.toml` documenting the `"TODO_RUN_WRANGLER_D1_CREATE"` placeholder that must be replaced before local D1 operations are possible
- **oauth** `2.4.1`: `FINDING-003` — JSDoc note added to `verifyJWT()` in `jwt-service.ts` clarifying that it does not check the token blacklist; callers requiring revocation enforcement must use `verifyJWTWithRevocationCheck()`

---

## [1.14.0] - 2026-05-12

### Documentation

- **Documentation hub refresh** (`docs/`) — Bumped versions across 6 stale hub files (`index.md`, `README.md`, `projects/index.md`, `architecture/overview.md`, `architecture/dependency-graph.md`, `projects/web-app/overview.md`) from March 2026 versions to current April 2026 (`@xivdyetools/core` 2.0.1 → 2.6.0, web-app 4.3.1 → 4.10.0, discord-worker 4.1.2 → 4.5.0, presets-api 1.4.15 → 1.5.0, oauth 2.3.8 → 2.4.0, og-worker 1.0.6 → 1.2.0, universalis-proxy 1.4.3 → 1.4.5, moderation-worker 1.1.8 → 1.2.0, types 1.9.0 → 1.14.0, etc.). Discord-worker command count corrected from 19 → 20.
- **`@xivdyetools/worker-middleware` and `xivdyetools-api-docs` added** to navigation, comparison matrices, dependency graphs, and ASCII ecosystem diagrams across `docs/index.md`, `docs/projects/index.md`, `docs/architecture/overview.md`, `docs/architecture/dependency-graph.md`, `docs/CLAUDE.md`. The monorepo is now correctly described as 12 packages + 10 applications (was 11 + 9).
- **Public API docs (`apps/api-docs/`)** — Added 3 previously-undocumented filter parameters (`vendor`, `craft`, `expensive`) to `/v1/dyes` and `/v1/match` reference pages — these were implemented in `api-worker@0.2.0`+ but missing from the docs site. Updated the `consolidation-groups` example response to reflect Patch 7.5 active state (`consolidationActive: true`, real itemIDs `52254`/`52255`/`52256`). Added a CORS-preflight section noting `maxAge` reduction to 1h (`api-worker@0.4.0`).
- **Standardized dye-count phrasing** — Replaced "136 dyes" / "136-dye database" everywhere it appeared as prose with "125 standard dyes plus 11 Facewear color entries (with synthetic negative IDs)" to match the actual `colors_xiv.json` composition. Affects `docs/index.md`, `docs/README.md`, `docs/projects/index.md`, `docs/architecture/overview.md`, `docs/architecture/dependency-graph.md`, `docs/architecture/data-flow.md`, `docs/projects/web-app/overview.md`, `docs/projects/web-app/tools.md`, `docs/projects/discord-worker/commands.md`, `docs/projects/core/services.md`, `docs/research/api/01-overview-and-goals.md`, `docs/research/api/02-endpoint-catalog.md`, `docs/research/api/README.md`, `docs/reference/glossary.md`, `docs/brainstorming/CORE_COLOR_VERIFICATION.md`, `docs/brainstorming/SHARE_BUTTON_OPENGRAPH.md`, `apps/api-docs/index.md`, `apps/api-docs/reference/dyes.md`, `apps/api-docs/reference/matching.md`, `apps/api-docs/guide/errors.md`, `apps/api-docs/guide/rate-limits.md`, plus the workspace-level and `apps/api-worker/` `CLAUDE.md` files. Numeric API limits like `1–136` retained where they describe actual ranges (with explanatory inline notes).
- **Allied Society / Beast Tribes terminology retired from docs** (post-Patch 7.5 cleanup) — Removed from live forward-facing docs (`docs/projects/web-app/tools.md` "Dye categories" line, `apps/api-docs/guide/index.md` Quick Start example response, `apps/api-docs/reference/dyes.md` `acquisition` field example). Stripped the 5 tribal-vendor rows (Ixali / Sylphic / Kobold / Amalj'aa / Sahagin) from `docs/audits/2026-01-17/03-I18N-FFXIV-TERMINOLOGY.md` with an explanatory note. Test fixtures `acquisition: 'Beast Tribes'` in `packages/core/src/services/__tests__/PresetService.test.ts` and `DyeService.test.ts` updated to current acquisition string `'Venture Coffers'`. Reworded the `DyeFilter.contract.test.ts` history comment to drop the term while preserving rationale.
- **Deprecation banners** added to the historical Phase 6 docs (`docs/historical/web-app/20251113-Phase6/PHASE_6_2_MARKET_BOARD_CHANGES.md`, `PHASE_6_2_6_TESTING_CHECKLIST.md`, `IMPLEMENTATION_PLAN.md`), the v2.0.0 TODO list (`docs/historical/web-app/20251117-v2.0.0/20251119-TODO.md`), the v2.0.0 translation-key reference (`docs/historical/web-app/20251127-Localization/TRANSLATION-KEYS.md`), and the 6 legacy v1.6 HTML snapshots (`docs/historical/legacy-v1.6/dyecomparison_*.html`, `colormatcher_*.html`, `colorexplorer_*.html`) — these documents describe features retired by Patch 7.5 consolidation; banners preserve historical accuracy without rewriting frozen snapshots.
- **CLAUDE.md sweep** — Updated the workspace-level `CLAUDE.md` (`/CLAUDE.md`), the monorepo-root `CLAUDE.md` (`xivdyetools/CLAUDE.md`), and `apps/api-worker/CLAUDE.md` for the 12-package count, dye-count rephrasing, the `worker-middleware` package row, the `api-docs` and `api-worker` app rows, and Patch 7.5 consolidation state.

---

## [1.13.0] - 2026-04-29

Post-consolidation cleanup, og-worker / api-worker localization, Allied Society dye filter removal, and SEC-001 XSS hardening from the 2026-04-28 audit.

### Added

- **@xivdyetools/core** `2.6.0`: New localization surfaces for `og-worker` — `tools` (6 web-app tool display names), `visions` (compact vision names for OG titles), `sheets` (9 Swatch Matcher color categories); new `TranslationProvider` methods `getToolName()`, `getVisionShort()`, `getSheetName()`
- **@xivdyetools/core** `2.6.0`: Top-level exports `LocaleLoader`, `LocaleRegistry`, `TranslationProvider`, `SUPPORTED_LOCALES`, `extractLocaleCode`, `resolveLocaleFromPreference` for stateless concurrent-locale access
- **@xivdyetools/types** `1.14.0`: `ToolKey`, `SheetKey` types; optional `tools` / `visions` / `sheets` fields on `LocaleData`
- **og-worker** `1.2.0`: OG embed metadata localization via `?lang=` query parameter — all 6 locales preloaded at module init; `harmonyToKey()` kebab-to-camel converter; global `onError` handler with structured logging
- **og-worker** `1.2.0`: Integrated `@xivdyetools/worker-middleware` (`requestIdMiddleware` + `loggerMiddleware`) for structured JSON observability — matches `discord-worker` / `presets-api` / `api-worker` pattern
- **api-worker** `0.4.0`: `localeMiddleware` validates `?locale=` once per request and stores it in context (REFACTOR-001 / OPT-001) — eliminates 7 ad-hoc `setLocale` calls in handlers
- **web-app** `4.10.0`: Result Card v4 "Spectrum" row showing the consolidated dye spectrum (Standard / Wide #1 / Wide #2) via `showConsolidation` (default `true`) across all 5 tools (Harmony, Gradient, Budget, Swatch, Extractor); new `common.spectrum` i18n key in all 6 locales
- **@xivdyetools/core** `2.6.0`: ARCH-002 Facewear-invariants contract test (`Facewear.invariants.test.ts`) — 5 cases pinning the negative synthetic-itemID contract and ruling out collisions
- **@xivdyetools/core** `2.6.0`: BUG-003 contract test (`DyeFilter.contract.test.ts`) validating all acquisition constants exist in live `colors_xiv.json` data — auto-detects future renames like the recent `'Crafting'` → `'The Firmament'` drift
- **discord-worker** `4.5.0`: ARCH-002 consolidation fan-out integration test (`consolidation-fanout.test.ts`) — 3 cases verifying budget deduplication for active consolidation and regression-pinning the Facewear synthetic-ID filter

### Changed

- **@xivdyetools/core** `2.6.0`: All 6 locale JSONs rebuilt with new `tools`, `visions`, `sheets` keys
- **api-worker** `0.4.0`: CORS `maxAge` reduced 86400 s → 3600 s (matches `presets-api` / `oauth` precedent); `KVRateLimiter` construction moved per-request to eliminate the singleton footgun (BUG-004)
- **og-worker** `1.2.0`: All per-tool OG generators gained an optional trailing `locale: LocaleCode = 'en'` parameter (backwards-compatible); `createToolHandler` typed `Context<{ Bindings: Env }>`; ad-hoc `console.log` replaced with structured logger
- **universalis-proxy** `1.4.5`: REFACTOR-002 — wired `@xivdyetools/worker-middleware` (`requestIdMiddleware` + `loggerMiddleware`); 4 `console.error` call sites (3 route handlers + global `app.onError`) replaced with structured `getLogger(c)?.error(...)` calls carrying operation tags
- **@xivdyetools/worker-middleware** `1.1.1`: REFACTOR-003 — replaced `Context<any, any, any>` in `getLogger` / `getRequestId` with Hono's standard `Context`; SEC-002 — strengthened `keyExtractor` JSDoc with explicit warning against deriving rate-limit keys from client-controlled headers
- **@xivdyetools/worker-middleware** `1.1.2`: LINT-FIX — made `getLogger` / `getRequestId` generic over `Context<E, P, I>` so callers (e.g. `presets-api` with `& { auth: AuthContext }`) preserve narrow typing through the helpers; resolves the CI `no-unsafe-argument` lint cascade from the 1.1.1 refactor
- **discord-worker** `4.5.0`: CJK font subsets regenerated (484 KiB SC / 820 KiB KR) after `subset-cjk-fonts.py` path corrections
- **web-app** `4.10.0`: Market Board refresh button moved out of the deleted Price Categories panel into the price panel directly

### Fixed

- **@xivdyetools/core** `2.6.0`: BUG-002 — `TranslationProvider.getDyeName()` now consults `CONSOLIDATED_IDS` / `CONSOLIDATED_DYES` as a fallback for items absent from the CSV locale registry (52254 / 52255 / 52256). 4 new test cases cover all three Type-A/B/C IDs across locales
- **@xivdyetools/core** `2.6.0`: BUG-003 — 8 stale `acquisition: 'Crafting'` instances replaced with `'The Firmament'` across 4 dye test fixtures (`DyeDatabase.test.ts`, `DyeService.test.ts`, `DyeSearch.test.ts`, `HarmonyGenerator.test.ts`)
- **api-worker** `0.4.0`: BUG-001 — bare `console.error` replaced with structured logger; `loggerMiddleware` wired globally
- **discord-worker** `4.5.0`: FONT_SUBSET_AUDIT (HIGH) — `subset-cjk-fonts.py` had stale path resolutions (`apps/xivdyetools-core/...`, `apps/discord-worker/src/locales/`) corrected to `packages/*/src/locales/`; silent skips converted to `FileNotFoundError` for loudness on future restructures
- **web-app** `4.10.0`: Test-fixture drift (BUG-003 follow-up) — `dye-filter-utils.test.ts` updated to post-rename acquisition strings (`'The Firmament'`, `'Venture Coffers'`)
- **web-app** `4.10.0`: Localization — `themes.sugarRiot` corrected against official SE client strings (German `Zuckerschock`, Korean `슈거 라이엇`); Chinese unchanged pending patch 7.2 client release

### Security

- **SEC-001** (web-app `4.10.0`, 2026-04-28 audit): Replaced `innerHTML` interpolation in `auth-button.ts` (user character name / server from OAuth response) with `createElement` + `textContent` to prevent HTML-entity XSS. CSP `script-src 'self'` provides defense-in-depth.

### Removed

- **@xivdyetools/core** `2.6.0`: `ALLIED_SOCIETY_ACQUISITIONS` constant, filter branches in `isDyeExcluded` / `hasActiveFilters`, vendor entries from all 6 locale `acquisitions` maps
- **@xivdyetools/types** `1.14.0`: `DyeTypeFilters.excludeAlliedSocietyDyes` field
- **api-worker** `0.4.0`: `?alliedSociety=` query parameter on `/v1/dyes` and `/v1/match`; `alliedSociety?: boolean` field on `DyeQueryFilters` (parameter ignored, forward-compatible — no error)
- **discord-worker** `4.5.0`: `/preferences set allied_society` slash-command option and `preferences.ts` `FILTER_OPTIONS` row. **Deployment note**: `pnpm --filter xivdyetools-discord-worker run register-commands` must re-run post-deploy to drop the schema
- **web-app** `4.10.0`: Entire "Price Categories" UI section (5 acquisition checkboxes), `PriceCategorySettings` type, `getPriceCategories()` / `setCategories()` methods on `MarketBoardService`, `categories-changed` DOM event, `categories` field on `SettingsChangedEvent`, pricing-mixin callback, ConfigSidebar handler, `PRICE_CATEGORIES` constant, stale i18n keys (`marketBoard.priceCategories`, `marketBoard.baseDyes`, etc.), stale `localStorage` `market_board_categories` key
- **web-app** `4.10.0`: "Exclude Allied Society Dyes" toggle from the v4 Acquisition Source filter panel, `excludeAlliedSocietyDyes` property on `DyeFiltersV4`, 6 prop-passing sites, dead `alliedSocietyDyes` block in `shared-components.js` `PRICE_CATEGORIES` map, 6 locale translation keys

### Documentation

- **@xivdyetools/core** / **web-app**: i18n audit report at `docs/audits/2026-04-28/` covering locale-file parity (100% structural match across 6 locales × 3 stores), CJK font-subset coverage, the stale-path subset-script bug, and hardcoded English strings in `og-worker` / `discord-worker`

---

## [1.12.0] - 2026-04-28

Patch 7.5 ("Trail to the Heavens") goes live in FFXIV. The dye consolidation framework that landed in `core@2.1.0` (2026-03-14) is **activated**: `CONSOLIDATED_IDS` is filled with real market itemIDs, and the `~105 → 3` market-board call collapse is now in effect for everyone.

### Changed

- **@xivdyetools/core** `2.5.0`: Patch 7.5 dye consolidation **activated** — `CONSOLIDATED_IDS` populated with real market itemIDs (Type-A = `52254`, Type-B = `52255`, Type-C = `52256`); `isConsolidationActive()` now returns `true`; `getMarketItemID()` collapses 105 consolidated dyes down to 3 market lookups
- **web-app** `4.9.0`: Market Board service fans out the 3 consolidated prices to all 105 individual dye cache entries via `getMarketItemID()` — refresh now issues ~20 API calls instead of 105

### Added

- **@xivdyetools/core** `2.5.0`: `CONSOLIDATED_DYES` config with full Patch 7.5 metadata (itemID, localized names en/ja/de/fr/ko/zh, acquisition, price, currency); new `getConsolidatedDyeName(type, locale)` helper
- **@xivdyetools/core** `2.5.0`: `DyeService.getByStainId()`, `getDyesByStainIds()`, `getLocalizedDyeByStainId()` for post-consolidation stainID-only lookups
- **web-app** `4.9.0`: User-facing release notes documenting Patch 7.5 go-live (`apps/web-app/CHANGELOG-laymans.md`)

---

## [1.11.0] - 2026-04-07

### Security

- **SEC-001**: Added global `onError` handler to `moderation-worker` to prevent stack trace leakage in production error responses
- **SEC-002**: Eliminated `innerHTML` XSS vector in `web-app` modal system — `ModalConfig.content` now requires `HTMLElement` only; all callers migrated to DOM construction
- **SEC-003**: Added JSON depth-limiting middleware to `presets-api` and `oauth` (maxDepth 10; prototype pollution keys rejected)
- **SEC-004**: Added Hono `bodyLimit` middleware to `presets-api` (100 KB on `/api/*`) and `oauth` (10 KB on `/auth/*`)
- **SEC-005**: Fixed placeholder `DISCORD_CLIENT_ID` in `moderation-worker` `wrangler.toml`; added startup detection in env-validation
- **SEC-006**: Updated `rollup` via pnpm override to ≥ 4.59.0 (CVE fix); updated `tsup` (8.5.1) and `vitepress` (1.6.4) in affected apps

### Added

- **@xivdyetools/worker-middleware** `1.1.0`: New `rateLimitMiddleware()` factory — standardized `X-RateLimit-*` response headers, `Retry-After`, fail-open error handling, and 429 responses; adopted by `presets-api` and `api-worker`
- **og-worker**: 50 route-level integration tests covering all OG image endpoints, parameter validation, boundary values, crawler routing, and health check (resolves TEST-003)
- **CI/CD** (ARCH-002): Post-deploy smoke tests added to `deploy-og-worker.yml` and `deploy-api-docs.yml` (all 8 deployment workflows now have smoke tests)
- **CI/CD** (ARCH-004): Bundle size reporting step added to CI pipeline with a > 5 MiB warning threshold

### Changed

- **@xivdyetools/worker-middleware** (REFACTOR-001/002): Extracted shared request-ID and logger middleware from 5 workers into `@xivdyetools/worker-middleware`; all workers migrated, 14 local middleware files deleted
- **All CF Workers** (ARCH-001): Removed `nodejs_compat` compatibility flag from all 7 Cloudflare Workers — confirmed no worker uses Node.js APIs; all use Web APIs only
- **Coverage thresholds** (REFACTOR-003): Standardized Vitest coverage thresholds across all 17 configs (Libraries: 90/90/85/90; Workers: 85/85/75/85; Frontend: 80/80/75/80)
- **CORS** preflight `maxAge` reduced from 86400 s (24 h) to 3600 s (1 h) in `presets-api` and `oauth` — allows policy changes to propagate within one hour
- **@xivdyetools/types** `1.13.0`: `DiscordSnowflake` type and `createSnowflake` function promoted from `@internal` to public API
- **All packages** (REFACTOR-006): Added `stripInternal: true` to all 11 `tsconfig.build.json` files — enforces `@internal` API boundaries in published `.d.ts` declarations

### Fixed

- **BUG-001**: Re-enabled strict TypeScript checks (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`) across all 5 worker apps; ~80 unused variables and implicit returns cleaned up
- **BUG-002**: Replaced `console.error` with structured logger in `preset-service.ts`
- **BUG-003**: Eliminated all `any` types in `@xivdyetools/worker-middleware` via Hono `ContextVariableMap` module augmentation
- **OPT-001** (`api-worker`): Added pending-promise deduplication to `GET /api/v1/categories` to prevent D1 thundering herd during CDN cache misses

### Documentation

- Updated 2026-04-07 deep-dive and security audit report with all resolution statuses (23 audit files added under `docs/audits/2026-04-07/`)
- Added MIT `LICENSE` files to 18 apps/packages that were missing them; standardized SE disclaimer across all existing `LICENSE` files

---

## [1.10.0] - 2026-04-03

### Added

- **api-docs**: New VitePress documentation site (`xivdyetools-api-docs`) deployed to `developers.xivdyetools.app` via Cloudflare Pages — covers all 9 Phase 1 API endpoints with a hero landing page, Quick Start guide, Responses/Errors/Rate Limits guides, and full API reference for the Dyes and Color Matching endpoint groups
- **api-docs**: Inline "Try It" panels on every reference endpoint — fires live requests to `data.xivdyetools.app` directly from the browser, shows response body, HTTP status badge, and rate limit headers (`X-RateLimit-Remaining`, `Cache-Control`), with a one-click "Copy as cURL" button
- **CI/CD**: `deploy-api-docs.yml` GitHub Actions workflow — path-filtered to `apps/api-docs/**`, builds with `pnpm turbo run build --filter=xivdyetools-api-docs`, and deploys to Cloudflare Pages via `cloudflare/wrangler-action@v3`

---

## [1.9.0] - 2026-04-03

### Added

- **@xivdyetools/types**: `DyeTypeFilters` interface with 9 optional boolean flags for dye filtering (metallic, pastel, dark, cosmic, ishgardian, expensive, vendor, craft, alliedSociety)
- **@xivdyetools/core**: Shared dye filter functions (`isDyeExcluded`, `filterDyes`, `hasActiveFilters`) with acquisition constants (`VENDOR_ACQUISITIONS`, `CRAFT_ACQUISITIONS`, `ALLIED_SOCIETY_ACQUISITIONS`, `EXPENSIVE_DYE_IDS`)
- **@xivdyetools/bot-logic**: `dyeFilters?: DyeTypeFilters` parameter on all 4 execute functions (match, harmony, gradient, mixer) — filters applied during candidate selection
- **discord-worker**: `/preferences filters` subcommand group with `set` (9 boolean options), `show`, and `reset` subcommands for persistent per-user dye filtering
- **discord-worker**: All 4 command handlers (match, harmony, gradient, mixer) now apply user's saved dye filters from preferences
- **@xivdyetools/bot-i18n**: Filter-related translation keys added to all 6 locales (en, ja, de, fr, ko, zh)
- **api-worker**: Dye type/acquisition boolean filters (`metallic`, `pastel`, `dark`, `cosmic`, `ishgardian`, `vendor`, `craft`, `alliedSociety`, `expensive`) on both match routes (`/closest`, `/within-distance`)
- **api-worker**: Acquisition and expensive filters added to GET `/v1/dyes` listing endpoint

### Changed

- **web-app**: `DyeFiltersConfig` now extends `Required<DyeTypeFilters>` from core; filter utilities re-export from `@xivdyetools/core`

---

## [1.8.0] - 2026-04-02

### Added

- **api-worker**: New public REST API worker (`xivdyetools-api-worker`) deployed to `data.xivdyetools.app` — Phase 1 MVP with 9 endpoints for dye database access and color matching
- **api-worker**: 7 dye endpoints — list with filtering/sorting/pagination, single lookup with auto-detection of itemID/stainID/facewear ID, explicit stainID lookup, name search with localization, category listing, batch lookup (max 50), and Patch 7.5 consolidation group metadata
- **api-worker**: 2 color matching endpoints — closest dye match and within-distance search supporting 6 distance algorithms (rgb, cie76, ciede2000, oklab, hyab, oklch-weighted)
- **api-worker**: KV-backed rate limiting (60 req/min per IP), request ID tracing, security headers, permissive CORS (`*`), and deterministic Cache-Control headers
- **api-worker**: Full test suite — 88 tests across 6 files covering unit tests (validation, response envelopes, dye serialization), route integration tests, and middleware tests

---

## [1.7.0] - 2026-03-18

### Fixed

- **web-app**: Swatch Matcher color grid showed 0 colors when returning with a saved race-specific category (Skin/Hair Colors) due to async race condition in constructor
- **ARCH-001**: Fixed incomplete deploy triggers in CI/CD workflows — discord-worker now triggers on bot-i18n, bot-logic, color-blending, svg changes; moderation-worker triggers on crypto (transitive via auth); og-worker triggers on logger (transitive via core)
- **@xivdyetools/core**: Added "The Firmament" to acquisition translation maps in all 6 locales — previously displayed untranslated in non-English UIs

### Added

- **ARCH-002**: Added post-deploy health check smoke tests to 6 deployment workflows (discord-worker, presets-api, oauth, universalis-proxy, moderation-worker, web-app)
- **ARCH-003**: Added `pnpm audit --prod` step to CI pipeline for production dependency vulnerability scanning
- **ARCH-004**: Added bundle size check step to web-app deploy workflow
- **web-app**: Swatch Matcher reverse matching — select a dye or custom hex from the Color Palette drawer to find and highlight the closest character color swatches
- **web-app**: Result card "Inspect Dye in..." context menu now includes Swatch Matcher for cross-tool reverse matching

### Docs

- **docs/reference/ffxiv-terminology.md**: Added Locations section with localized names for The Firmament

---

## [1.6.0] - 2026-03-14

### Added

- **@xivdyetools/types**: `currency` (`string | null`) field on the `Dye` interface for localized vendor cost display
- **@xivdyetools/types**: `consolidationType` (`'A' | 'B' | 'C' | null`) and `isIshgardian` (`boolean`) fields on the `Dye` interface for Patch 7.5 dye consolidation
- **@xivdyetools/core**: `consolidated-ids.ts` config module with `CONSOLIDATED_IDS`, `isConsolidationActive()`, and `getMarketItemID()` — patch-day activation requires updating only 3 null values in one file
- **@xivdyetools/core**: Exported `getMarketItemID`, `isConsolidationActive`, `CONSOLIDATED_IDS` from package index
- **docs**: Research document for Patch 7.5 dye consolidation (`docs/research/patch-7.5/dye-consolidation.md`)

### Changed

- **@xivdyetools/core**: `DyeDatabase.initialize()` defaults `currency` to `null`, `consolidationType` to `null`, and `isIshgardian` to `false` for backward compatibility
- **@xivdyetools/core**: Added `currencies` section to all 6 locale files with localized display labels for 11 currency types (Gil, Skybuilders Scrips, Cosmocredits, pigments, etc.)
- **@xivdyetools/core**: Added `getCurrency()` to `TranslationProvider` and `LocalizationService` for localized currency name retrieval
- **@xivdyetools/core**: `DyeDatabase.initialize()` defaults `consolidationType` to `null` and `isIshgardian` to `false` for backward compatibility
- **@xivdyetools/core**: Synced acquisition, price, and currency data for 47 dyes from CSV to `colors_xiv.json`; corrected 3 Firmament dyes (30122–30124) from Cosmic Exploration to The Firmament / Skybuilders Scrips
- **@xivdyetools/core**: Added `consolidationType` and `isIshgardian` to all 136 dye entries in `colors_xiv.json`
- **discord-worker**: Budget calculator uses `getMarketItemID()` for market board price lookups with deduplication (105 → ~20 API calls post-consolidation)
- **web-app**: Result card `formatVendorCost()` displays correct localized currency instead of hardcoded "G"
- **web-app**: Market board service fans out consolidated prices to individual dye cache entries via `getMarketItemID()`
- **@xivdyetools/test-utils**: Updated all mock dye factories and fixtures with `consolidationType` and `isIshgardian` fields
- **Tests**: Updated mock dye objects across core, discord-worker, and web-app test suites for new fields

### Docs

- **versions.md**: Update all 20 project versions to current (source of truth for version matrix)
- **index.md**: Rewrite ecosystem diagram with all 20 projects and current versions; update Recent Updates to March 2026
- **README.md**: Update all version numbers in Applications and Shared Libraries tables
- **architecture/overview.md**: Rewrite Mermaid diagram with all 11 packages and 9 apps; add new package nodes and dependency edges
- **architecture/dependency-graph.md**: Full rewrite — 11 packages, 9 consumers, complete dependency matrix and version sync docs
- **projects/core/overview.md**: Update to v2.0.1; add v2.0.0 Migration section documenting breaking type re-export removal
- **projects/discord-worker/overview.md**: Full rewrite to v4.1.2 — v4 command names, 20 commands, shared packages architecture
- **projects/web-app/overview.md**: Update to v4.3.1; add v4.3.0 (pixel sampling, canvas panning) and v4.2.0 (prevent duplicates, clipboard paste) sections
- **projects/moderation-worker/overview.md**: Update to v1.1.8; add Recent Changes (env validation, safeParseJSON fix, rate limit 429 fix)
- **projects/og-worker/overview.md**: Update to v1.0.6; add Recent Changes (NaN validation, escapeHtml, bounds validation); add comparison and accessibility routes
- **projects/index.md**: Expand comparison matrix from 11 to 20 rows; rewrite architecture layers diagram; split version tables
- **CLAUDE.md** (docs): Full rewrite — 20 projects, pnpm monorepo commands, v2.0.0 import patterns
- **developer-guides/local-setup.md**: Full rewrite — Node 22+, pnpm 10+, monorepo workflow commands
- **New**: 16 missing documentation files drafted from source code research:
  - `projects/web-app/tools.md` — All 9 interactive tools with routes, features, and v4.x changes
  - `projects/web-app/components.md` — Lit component architecture, BaseComponent, layout shell, service layer, ConfigController
  - `projects/web-app/theming.md` — 12 themes, CSS custom properties, glassmorphism, ThemeService API
  - `projects/web-app/deployment.md` — Cloudflare Pages, Vite build, code splitting, CI/CD, bundle size
  - `projects/discord-worker/commands.md` — Full 20-command reference with options, rate limits, deferred response pattern
  - `projects/discord-worker/interactions.md` — HTTP Interactions model, button/modal/autocomplete handlers, webhook endpoints
  - `projects/discord-worker/rendering.md` — SVG→PNG pipeline, @xivdyetools/svg templates, CJK fonts, resvg-wasm, bundle constraints
  - `projects/discord-worker/deployment.md` — Wrangler config, environment bindings, secrets, slash command registration
  - `projects/oauth/endpoints.md` — 11 endpoints (Discord OAuth, XIVAuth, token management, health), rate limits, CORS, security headers
  - `projects/oauth/pkce-flow.md` — 5-step OAuth 2.0 + PKCE flow, state parameter security, redirect URI validation
  - `projects/oauth/jwt.md` — Token structure, HS256 signing, claims, lifecycle (creation, verification, refresh, revocation)
  - `projects/presets-api/endpoints.md` — Full REST API reference (health, categories, presets, votes, moderation), auth methods
  - `projects/presets-api/moderation.md` — Two-tier content filtering, moderation states, ban system, Discord notifications
  - `projects/presets-api/database.md` — D1 schema (6 tables), composite indexes, migrations, design decisions
  - `projects/presets-api/rate-limiting.md` — Two-tier rate limiting (IP 100/min + user 10/day), failure modes, CORS headers
  - `developer-guides/testing.md` — Vitest setup, @xivdyetools/test-utils, patterns, E2E with Playwright, CI config

---

## [1.5.1] - 2026-03-09

### Changed

- **Dependencies (production)**: Updated `hono` from 4.12.3 to 4.12.5 (security fixes: SSE Control Field Injection, Cookie Attribute Injection, Middleware Bypass in Serve Static), `@cloudflare/workers-types` 4.20260305.0 → 4.20260307.1, `@upstash/redis` 1.36.3 → 1.36.4, `vue` 3.5.29 → 3.5.30
- **Dependencies (development)**: Updated `turbo` 2.8.12 → 2.8.14, `eslint` 10.0.2 → 10.0.3, `wrangler` 4.69.0 → 4.71.0, `@cloudflare/vitest-pool-workers` 0.12.18 → 0.12.20, `express-rate-limit` 8.2.1 → 8.3.1, `@types/node` 25.3.3 → 25.3.5
- Patch version bumps across all 13 packages and apps

## [1.5.0] - 2026-03-01

### Added

- **web-app**: Shift+Click pixel sampling in Extractor tool — samples a pixel (or configurable NxN area) and finds closest matching dyes using v4 unified result cards
- **web-app**: Ctrl/Cmd+Drag panning for zoomed images in Extractor tool with grab cursor feedback
- **web-app**: Pixel Sample Area size config (1×1 to 16×16) in the Extractor sidebar
- **web-app**: Pan offset persistence across zoom changes in Extractor tool
- **web-app**: New locale keys for pixel sampling and panning in all 6 languages
- **docs**: Dead code audit (2026-02-28) — 19 findings (DEAD-001 through DEAD-019) with categorized reports, evidence, and analysis manifest

### Changed

- **discord-worker**: Budget quick picks updated — replaced Metallic Silver, Metallic Gold, and Pastel Pink with all 16 Cosmic Exploration dyes and 4 Cosmic Fortunes dyes (22 total quick picks)
- **web-app**: Migrate `@shared/types` re-exports to direct `@xivdyetools/types` imports across 46 files; deprecated re-export blocks removed from `shared/types.ts` (local types `Theme`, `AppState`, `DataCenter`, `World` remain)
- **web-app**: Migrate `NoOpLogger` import from `@xivdyetools/core` to `@xivdyetools/logger/library` in `api-service-wrapper.ts`
- **bot-i18n**: Marked `LocaleData` and `TranslatorLogger` type exports as `@internal` (DEAD-033)
- **bot-logic**: Marked `HARMONY_TYPES`, `VISION_TYPES`, `EmbedData`, `EmbedField`, `ResolveColorOptions` as `@internal` (DEAD-037–040); cleaned up stale REFACTOR comment markers (DEAD-041)
- **core**: Wave 9 — `@xivdyetools/core` v2.0.0: marked 28 symbols `@internal` (DEAD-045, DEAD-046, DEAD-048, DEAD-054); added `isAbortError` tests (DEAD-054); removed all deprecated type re-exports — import `Dye`, `RGB`, `PresetCategory`, etc. from `@xivdyetools/types` (DEAD-047 Phase 2)
- **bot-logic**: Added `@xivdyetools/types` as explicit dependency; migrated `Dye` type imports across 8 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **svg**: Migrated `Dye`/`RGB` type imports across 7 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **discord-worker**: Migrated type imports (`Dye`, `RGB`, `CharacterColorMatch`) across 8 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **og-worker**: Migrated type imports (`Dye`, `SubRace`, `Gender`) across 8 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **stoat-worker**: Migrated `Dye` type import from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)
- **web-app**: Migrated type imports (`Dye`, `PresetCategory`, `PresetPalette`, `PresetData`, `CategoryMeta`, `PriceData`, `CachedData`) across 10 files from `@xivdyetools/core` to `@xivdyetools/types` (DEAD-047 Phase 2)

### Removed

- **svg**: Dead code cleanup — Wave 13 (DEAD-077–082, DEAD-085 from 2026-02-28 audit)
  - Phase 1: Remove unused params/interfaces in `comparison-grid.ts` (DEAD-079, DEAD-080); remove unused `baseName` from `HarmonyWheelOptions` (DEAD-081); remove dead `export * from '@xivdyetools/svg'` re-export in discord-worker (DEAD-082)
  - Phase 2: Extract `rgbToHsv()` to shared `base.ts` utility (DEAD-077); replace local luminance/contrast with `ColorService` (DEAD-078); standardize truncation with `truncateText()` (DEAD-085)
- **bot-logic**: Remove `baseName` from `generateHarmonyWheel()` call — follows svg DEAD-081
- **web-app**: 5 orphaned v3 components — `tool-header`, `dye-comparison-chart`, `dye-preview-overlay`, `featured-presets-section`, `mobile-bottom-nav` (DEAD-002 – DEAD-005, DEAD-007)
- **web-app**: Dead v3 components `AppLayout` and `SavedPalettesModal` plus their tests (DEAD-001, DEAD-006)
- **web-app**: Components barrel files `components/index.ts` and `v4/index.ts`; `main.ts` updated to import `offlineBanner` directly (DEAD-008, DEAD-009)
- **web-app**: Deprecated `fetchPrice()` and `getWorldName()` from MarketBoard component (DEAD-010)
- **web-app**: `LocalStorageCacheBackend` class and all associated tests (DEAD-011)
- **web-app**: ~30 unused constants from `shared/constants.ts` — API config, FFXIV stats, chart/zoom/sampling/color-wheel config, `SUCCESS_MESSAGES`, `ANIMATION_DURATIONS` (DEAD-012)
- **web-app**: Unused empty-state icon exports and lookup functions (DEAD-013), unused UI icon exports and lookup functions (DEAD-014)
- **web-app**: 26 unused local variables across 16 component/service files (DEAD-015)
- **web-app**: `initErrorTracking()`, `errorTrackerInstance`, dead production error-tracking branches, `isProd()` (DEAD-017)
- **web-app**: Dead icon exports from `empty-state-icons.ts` and `ui-icons.ts` (DEAD-009, DEAD-013, DEAD-014)
- **discord-worker**: Dead code cleanup — Wave 5 (DEAD-020 through DEAD-023 from 2026-02-28 audit):
  - 6 dead service/util files + tests: `pagination`, `progress`, `image-cache`, `color-blending`, `user-preferences`, `css-colors` (DEAD-020)
  - 6 orphaned locale JSON files duplicating `@xivdyetools/bot-i18n` data (DEAD-021)
  - Legacy `handleMixerCommand` handler, replaced by `handleGradientCommand` (DEAD-022)
  - Unused `discord-interactions` devDependency (DEAD-023)
- **discord-worker**: Dead code cleanup — Wave 6 (DEAD-024–027, 029, 035): `InteractionContext`/deadline infrastructure, 4 unused component builders, legacy KV preference functions, dead exports, unused re-exports
- **bot-i18n**: 3 unused function exports (`translate`, `getAvailableLocales`, `isLocaleSupported`) and 5 unused locale key sections (`buttons`, `status`, `pagination`, `components`, `matching`) from all 6 language files (DEAD-032, DEAD-034)
- **bot-logic**: `resolveCssColorName` from barrel export — internal helper not part of public API (DEAD-036)
- **core**: Dead code cleanup — Wave 7 (DEAD-043, 044, 049–053): legacy omnibus test files (`core.test.ts`, `logger.test.ts`), deprecated `characterColorData` barrel export, 3 orphaned `add-type-flags` scripts, `compare-scrapes.js`, stale `response.json` debug artifact, tracked `dye_names.csv`
- **core**: Dead code cleanup — Wave 8 (DEAD-042, DEAD-047 Phase 1): deprecated `types/logger.ts` wrapper file, ~35 zero-consumer deprecated barrel re-exports (auth types, preset sub-types, localization types, character types/constants, error types, color space types, `Logger`/`NoOpLogger`/`ConsoleLogger`)
- **types**: Dead code cleanup — Wave 10 Phase 1 (DEAD-060, DEAD-061, DEAD-063): removed entire utility module (`Result`, `AsyncResult`, `Nullable`, `Optional`, `isOk`, `isErr`), removed generic API response types (`APISuccessResponse`, `APIErrorResponse`, `APIResponse`), removed orphaned preset types (`AuthenticatedPresetSubmission`). `ResolvedPreset` migrated to `@xivdyetools/core` PresetService (audit had missed core consumer)
- **types**: Dead code cleanup — Wave 10 Phase 2 (DEAD-057, DEAD-058, DEAD-059, DEAD-060, DEAD-064): marked 31 symbols `@internal` and removed from main barrel — 11 preset response sub-types, 7 auth response sub-types, `DiscordSnowflake`/`createSnowflake`, `CharacterColorCategory`, `Matrix3x3`, `Race`, `SharedColorCategory`, `RaceSpecificColorCategory`, `LocalizedDye`, `DyeDatabase`. All remain accessible via subpath imports
- **core**: `ResolvedPreset` interface now defined and exported from `PresetService` (migrated from `@xivdyetools/types`)
- **logger**: Dead code cleanup — Wave 11 (DEAD-066–070): removed `getRequestId` from barrel exports (deprecated, superseded by app-local Hono Context versions); marked 10 implementation-detail symbols `@internal` (`BaseLogger`, `ConsoleAdapter`, `JsonAdapter`, `NoopAdapter`, `createSimpleLogger`, `createWorkerLogger`, `LogEntry`); updated README and `@packageDocumentation` examples to use `createRequestLogger`
- **rate-limiter**: Dead code cleanup — Wave 12 (DEAD-073, DEAD-074): deleted orphaned `src/backends/index.ts` barrel file; removed duplicate `UpstashRateLimiterOptions` interface from `src/backends/upstash.ts` (now imports canonical definition from `types.ts`)
- **test-utils**: Dead code cleanup — Wave 14 (DEAD-083, DEAD-084): removed deprecated `nextId()` and legacy counter infrastructure (`counters` Map, `resetCounters()`, `resetCounter()`, `getCounterValue()`); factories now use `randomId()`/`randomStringId()` for parallel-safe ID generation
- **presets-api**: Removed `resetCounters()` imports and `beforeEach` calls from 7 test files (no longer needed with random IDs)

---

## [1.4.0] - 2026-02-27

### Fixed

- **ESLint v10 compatibility**: Fix 17 lint errors across 15 files for new `eslint:recommended` rules
  - `no-useless-assignment`: Remove dead variable initializers in `ColorConverter`, `harmony-wheel`, `url-sanitizer`, `dye-grid`, `tool-banner`, and test files
  - `preserve-caught-error`: Add `{ cause: error }` to re-thrown errors in `APIService`, `photon`, `validators`, `renderer`, `community-preset-service`, and test files
  - `prefer-const`: Convert `uniqueUsersToday` to const in analytics service
- **web-app**: Update TypeScript lib from ES2020 to ES2022 for `ErrorOptions` support
- **rate-limiter**: Fix `vi.fn()` mock typing in `upstash.test.ts` — type generics now match `RateLimiterLogger` signatures (type-check error)
- **logger**: Fix `globalThis`/`process` typing and `Logger` type mismatch in test presets (type-check errors)
- **web-app**: Fix 159 ESLint errors across 38 files — removed unused imports/variables, replaced `@ts-ignore` with `@ts-expect-error`, replaced `any` with proper types, added `void` for floating promises

### Changed

- **deps**: Upgrade `@eslint/js` from 9.39.3 to 10.0.2 (major version with new recommended rules)
- **deps**: Upgrade `eslint` from 10.0.1 to 10.0.2, `typescript-eslint` from 8.56.0 to 8.56.1
- **deps**: Upgrade Cloudflare tooling — `wrangler` 4.67.0 → 4.68.1, `miniflare` 4.20260219.0 → 4.20260302.0, `@cloudflare/vitest-pool-workers` 0.12.14 → 0.12.17
- **deps**: Upgrade `tailwindcss` from 4.2.0 to 4.2.1, `@tailwindcss/postcss` patch update
- **deps**: Upgrade `hono` and `@cloudflare/workers-types` to latest patch versions

### Added

- **web-app**: Prevent Duplicate Results toggle for Harmony Explorer — deduplicates dyes across harmony slots using a shared `Set<number>` tracker, with next-best unique match fallback. Configurable via `preventDuplicates` on `HarmonyConfig` (default: on). User-swapped dyes override dedup
- **web-app**: Prevent Duplicate Results toggle for Palette Extractor — deduplicates dyes across palette slots as a post-processing pass on `PaletteMatch[]`. Configurable via `preventDuplicates` on `ExtractorConfig` (default: on). Raw extraction results preserved for toggle re-render without re-extraction
- **web-app**: Updated `config.preventDuplicatesDesc` locale strings in all 6 languages to be tool-agnostic ("result slots")
- **discord-worker**: Prevent Duplicate Results for `/extractor image` — deduplicates dyes across palette slots as a post-processing pass on `PaletteMatch[]`. When a monochromatic image causes multiple extracted colors to match the same dye, later slots are reassigned to the next-best unique alternative via `findDyesWithinDistance()`. Always on (no toggle)
- **web-app**: Paste from Clipboard feature for Extractor tool — visible "Paste" button (Chromium), Ctrl+V keyboard paste, and hint text in drop zone. Paste handling moved from `ImageUploadDisplay` to `ExtractorTool` to avoid duplicate processing
- **web-app**: `ICON_CLIPBOARD` SVG icon in `ui-icons.ts`
- **web-app**: New locale keys (`pasteFromClipboard`, `pasteNoImage`, `pasteNotSupported`) in all 6 languages

---

## [1.3.0] — 2026-02-21

### Added

- **@xivdyetools/bot-logic**: Comprehensive test suite — 193 tests across 10 files covering input resolution, CSS colors, localization, and all 8 commands (dye-info, harmony, match, comparison, gradient, mixer, accessibility, random)
- **core**: `spectral-js.d.ts` type declarations for untyped spectral.js library
- **web-app**: New tests for CSRF fail-closed validation (missing `csrf` param and missing stored state)
- **crypto**: New `hex.test.ts` test suite — 15 tests covering valid conversion, rejection of invalid input, and roundtrips
- **bot-logic**: New `color-math.ts` shared utility module with `getColorDistance()` and `getMatchQualityInfo()`, plus 9-test suite (REFACTOR-001, REFACTOR-002)
- **svg**: New `truncateText()` and `estimateTextWidth()` shared utilities in `base.ts` with 11-test suite (REFACTOR-005, BUG-012)
- **test-utils**: New D1 mock tests for bind-at-execution-time (4 tests) and batch result passthrough (1 test) (BUG-006, BUG-007)

### Security

- **web-app**: Fix CSRF state validation fail-open — reject OAuth callback when `csrf` or stored state is missing, not only on mismatch (FINDING-001)
- **rate-limiter**: Fix Upstash race condition — use atomic `INCR` + `EXPIRE NX` pipeline instead of separate `EXPIRE` call that could leave immortal keys on Worker crash (FINDING-002)
- **auth**: Require `exp` claim in `verifyJWT` — reject tokens without expiration instead of treating them as never-expiring (FINDING-003)
- **crypto**: Validate hex input in `hexToBytes` — reject odd-length strings and non-hex characters instead of silently producing corrupt output (FINDING-004)
- **rate-limiter**: Default `trustXForwardedFor` to `false` in `getClientIp` — prevents IP spoofing in Cloudflare Workers where `CF-Connecting-IP` is the trusted source (FINDING-006)
- **logger**: Recurse into arrays during sensitive field redaction — previously array elements containing secrets were logged unredacted (FINDING-007)
- **logger**: Merge custom `redactFields` with defaults — previously custom fields replaced defaults, silently removing protection for `password`, `token`, etc. (FINDING-008)
- **auth**: Enforce 32-byte minimum key length in `createHmacKey` — reject weak secrets that undermine HMAC-SHA256 security (FINDING-009)
- **og-worker**: Add NaN validation for all `parseInt`'d `dyeId` route parameters — prevents unhandled 500 errors from crafted non-numeric URLs in harmony, gradient, and mixer routes (FINDING-011)
- **og-worker**: Apply `escapeHtml()` to `themeColor` meta tag — defense-in-depth against XSS if upstream hex validation is bypassed (FINDING-013)

### Fixed

- **test-utils**: Fix D1 mock `bind()` recording at bind-time instead of execution-time — bindings are now tracked when the statement is actually executed via `first()`/`all()`/`run()`/`raw()`, matching real D1 behavior (BUG-006)
- **test-utils**: Fix D1 mock `batch()` discarding statement results — now returns actual results from each statement instead of always returning empty arrays (BUG-007)
- **svg**: Fix CJK badge width miscalculation in dye-info-card — use `estimateTextWidth()` to account for full-width CJK characters in category badges (BUG-012)
- **svg**: Remove double XML escaping across 7 SVG generators — `escapeXml()` was called on values already escaped by tagged template literals, producing `&amp;amp;` in output (BUG-001)
- **rate-limiter**: Fix KV backend `checkOnly` off-by-one — `remaining` was 1 less than actual remaining capacity due to premature decrement (BUG-004)
- **rate-limiter**: Fix KV backend `check` post-increment accounting — `remaining` now reflects the consumed request after `increment()` (BUG-005)
- **moderation-worker**: Fix `safeParseJSON` prototype pollution check — use `Object.hasOwn()` instead of `in` operator, which false-positived on every object due to inherited `__proto__`/`constructor` (BUG-002)
- **moderation-worker**: Fix rate limit response returning HTTP 429 instead of 200 — Discord silently discards non-200 interaction responses (BUG-003)

### Changed

- **bot-logic**: Consolidate duplicated `getColorDistance()` across match, mixer, and gradient commands into shared `color-math.ts` — single source of truth delegating to `ColorService.getColorDistance()` from core (REFACTOR-001)
- **bot-logic**: Consolidate duplicated match quality thresholds across match, mixer, and gradient commands into shared `getMatchQualityInfo()` with consistent tiers and i18n key lookup (REFACTOR-002)
- **svg**: Replace local `getColorDistance()` in `comparison-grid.ts` with `ColorService.getColorDistance()` from core (REFACTOR-001)
- **auth**: Deduplicate JWT verification logic — extract shared `verifyJWTSignature()` helper used by both `verifyJWT()` and `verifyJWTSignatureOnly()`, eliminating ~30 lines of duplication (REFACTOR-003)
- **svg**: Standardize text truncation across all SVG generators — replace 3 inconsistent ellipsis styles (`..`, `...`, `…`) with shared `truncateText()` utility using Unicode ellipsis (REFACTOR-005)

### Performance

- **core**: Add LRU cache for `rgbToOklab()` conversions — OKLAB is the recommended matching method and was the only uncached color space conversion on the hot path (OPT-001)
- **auth**: Cache `CryptoKey` objects at module level — eliminates redundant `crypto.subtle.importKey()` calls when the same HMAC secret is reused across requests within a Worker isolate (OPT-002)

- **bot-logic**: Add `--passWithNoTests` to test script for CI compatibility (reverted once tests were added)
- **bot-logic** / **stoat-worker**: Resolve CI lint failures — add `^build` dependency to Turbo lint task, include test files in tsconfig, fix async/unused-var/misused-promises violations
- **discord-worker**: Fix 85+ lint errors (unused imports, unsafe type assertions, no-floating-promises, require-await, no-case-declarations) and fix `targetDye.hex` reference bug in budget handler
- **discord-worker**: Fix `stats.test.ts` mock to reject with raw string instead of Error object
- **moderation-worker** / **oauth** / **presets-api** / **universalis-proxy**: Resolve lint errors across all worker packages
- **oauth**: Fix type-check errors — add type assertions for `response.json()`, fix mock Env properties (`XIVAUTH_CLIENT_ID`, `DB`), fix `XIVAuthCharacter.server` → `home_world`, fix D1Meta cast
- **oauth**: Cast mock context through `unknown` to fix TS2352 type-check errors
- **oauth**: Handle `URLSearchParams` in mock fetch body assertions
- **core** / **rate-limiter**: Resolve type-check errors in tests — add missing Dye properties (`stainID`, `isMetallic`, `isPastel`, `isDark`, `isCosmic`), fix type-only imports, rename OklchWeights `L/C/H` → `kL/kC/kH`
- **auth**: Fix type-check errors with strict `unknown` return types
- **web-app**: Auto-format sources via `eslint --fix`; fix lint issues in components, services, and tests
- **14 packages**: Resolve all remaining ESLint warnings — add type assertions to `JSON.parse()` calls, add explicit return types, fix `no-base-to-string`, replace `as any` with proper types, type `Object.create(null)` calls
- **Turbo**: Add `dependsOn: ["^build"]` to lint task for correct dependency ordering
- **ESLint**: Relax rules for test-utils files in root config; add `tsconfig.build.json` split for packages needing separate build/dev configs

### Changed

- **8 packages**: Patch version bumps for lint-only changes — auth 1.0.3, bot-i18n 1.0.1, color-blending 1.0.1, core 1.17.1, logger 1.1.3, rate-limiter 1.3.1, svg 1.0.1, test-utils 1.1.2

### CI

- Add `color-blending`, `svg`, `bot-i18n`, `bot-logic` to publish workflow

### Docs

- Update monorepo README with new packages and stoat-worker
- Update all project READMEs with MIT license, social links, and server change (Midgardsormr, Aether)
- **2026-02-21 audit**: Deep-dive analysis and security audit — 12 hidden bugs (2 critical), 14 security findings (2 high), 6 refactoring opportunities, 3 optimization opportunities, with prioritized remediation plan

---

## [1.2.0] — 2026-02-20

### Added

- **stoat-worker 0.1.0**: Initial scaffold for Stoat (Revolt) bot — revolt.js WebSocket client, prefix command parser (`!xivdye` / `!xd`), command router, dye resolver, and 4 commands (ping, help, about, info)

### Docs

- **stoat-worker**: README with command reference, architecture overview, development guide, and project structure
- **stoat-worker**: CHANGELOG (initial 0.1.0 release)
- **@xivdyetools/bot-logic**: README with API surface, usage examples, and dependency overview
- **@xivdyetools/bot-logic**: CHANGELOG (initial 1.0.0 release)
- **@xivdyetools/bot-i18n**: README with Translator class usage, locale utilities, and translation key reference
- **@xivdyetools/bot-i18n**: CHANGELOG (initial 1.0.0 release)
- **@xivdyetools/svg**: README with all 14 generators, SVG primitives, color utilities, and design principles
- **@xivdyetools/svg**: CHANGELOG (initial 1.0.0 release)
- **@xivdyetools/color-blending**: README with 6 blending modes, comparison examples, and API reference
- **@xivdyetools/color-blending**: CHANGELOG (initial 1.0.0 release)

---

## [1.1.0] — 2026-02-19

### Security

- **og-worker 1.0.3**: Added parameter bounds validation to OG image generation routes (FINDING-003)
- **presets-api 1.4.13**: Enforce `BOT_SIGNING_SECRET` in production env validation (FINDING-001)
- **oauth 2.3.6**: Block `STATE_TRANSITION_PERIOD=true` in production (FINDING-007)
- **web-app 4.1.7**: Clear APIService cache on logout (FINDING-008)
- **web-app 4.1.7**: Millisecond timestamp guard for token expiry (BUG-001)

### Added

- **moderation-worker 1.1.5**: Startup environment variable validation with production fail-fast (REFACTOR-001)
- **web-app 4.1.7**: Cross-tab session sync via `StorageEvent` (BUG-002)
- **DEPRECATIONS.md**: Deprecation registry with removal timelines (REFACTOR-003)
- **core 1.17.0**: Cache hit/miss/eviction/error metrics in `APIService` (OPT-002)
- **universalis-proxy 1.4.1**: Structured cache hit/miss logging for observability (OPT-002)
- **types 1.8.0**: `DiscordSnowflake` branded type with `isValidSnowflake()` / `createSnowflake()` (FINDING-002)

### Changed

- **presets-api** / **discord-worker** / **moderation-worker**: Replaced inline snowflake regex with shared `isValidSnowflake()` from `@xivdyetools/types` (FINDING-002)

### Docs

- Audit findings FINDING-004 and BUG-003 verified as false positives (already correctly implemented)
- Audit findings FINDING-007, FINDING-008, FINDING-010, BUG-001, BUG-002 resolved with code changes

---

## [1.0.0] — 2026-02-18

### Summary

Initial release of the XIV Dye Tools monorepo, consolidating 15 previously independent repositories into a single pnpm workspace with Turborepo.

### Added

#### Monorepo Infrastructure
- pnpm 10 workspace with `workspace:*` protocol for all internal dependencies
- Turborepo 2.8 task orchestration with dependency-aware build, test, lint, and type-check pipelines
- Shared `tsconfig.base.json` (TypeScript 5.9, strict mode, ES2022, bundler module resolution)
- Root ESLint 9 flat config with typescript-eslint and relaxed rules for test files
- Root Prettier 3 configuration
- Shared `.gitignore` covering all project types

#### Libraries Migrated (7 packages)
- **`@xivdyetools/types`** v1.7.0 — Branded types and shared interfaces
- **`@xivdyetools/crypto`** v1.0.0 — Base64URL encoding utilities
- **`@xivdyetools/logger`** v1.1.2 — Multi-runtime logging with secret redaction
- **`@xivdyetools/auth`** v1.0.2 — JWT verification, HMAC signing, Discord Ed25519
- **`@xivdyetools/rate-limiter`** v1.3.0 — Sliding window rate limiting (Memory, KV, Upstash)
- **`@xivdyetools/core`** v1.16.0 — Color algorithms, 136-dye database, k-d tree, 6-language i18n
- **`@xivdyetools/test-utils`** v1.1.1 — Cloudflare Workers mocks and test factories

#### Applications Migrated (8 apps)
- **`xivdyetools-discord-worker`** v4.0.1 — Primary Discord bot (1,403 tests)
- **`xivdyetools-moderation-worker`** v1.1.4 — Moderation bot for presets (546 tests)
- **`xivdyetools-presets-api`** v1.4.12 — Community presets REST API (463 tests)
- **`xivdyetools-oauth-worker`** v2.3.5 — Discord OAuth + JWT issuance (228 tests)
- **`xivdyetools-universalis-proxy`** v1.3.5 — Universalis market data proxy (90 tests)
- **`xivdyetools-og-worker`** v1.0.2 — OpenGraph image generation (288 tests)
- **`xivdyetools-web-app`** v4.1.5 — Main web app (2,574 tests)
- **`xivdyetools-maintainer`** v1.0.1 — Local dev tool for dye database

#### Documentation
- Migrated 523 documentation files from the standalone docs repository
- Architecture overviews, API contracts, deployment guides, and research notes
- `CLAUDE.md` with comprehensive AI coding guidance for the monorepo

#### CI/CD (GitHub Actions)
- **CI workflow** — Lint, type-check, test, and build on every push/PR to `main` (affected packages only via Turbo filtering)
- **7 deploy workflows** — Path-filtered auto-deploy to Cloudflare Workers/Pages on push to `main`
- **Publish workflow** — Manual `workflow_dispatch` to publish any `@xivdyetools/*` package to npm with provenance

### Changed

- All `@xivdyetools/*` dependencies now use `workspace:*` protocol instead of pinned npm versions
- TypeScript, ESLint, and Prettier hoisted to root — no longer duplicated across 15 repos
- Common devDependencies shared across all packages (reduces total `node_modules` size significantly)
- `@xivdyetools/test-utils` mock factories updated to include `stainID` field (aligning with `@xivdyetools/types` v1.7.0)

### Security

- Revoked and regenerated exposed npm authentication token
- All authentication tokens stored exclusively in GitHub Secrets
- No `.npmrc` or `.env` files containing secrets in the repository

### Migration Notes

- All 15 original repositories were tagged with `archive/pre-monorepo` before migration
- No git history was merged — the monorepo starts with a clean history
- All original test suites pass with identical results (pre-existing failures in oauth, presets-api, and moderation-worker are unchanged)
- Total test count: ~7,800 tests across 15 packages

---

[1.14.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.13.0...v1.14.0
[1.13.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.12.0...v1.13.0
[1.12.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.5.1...v1.6.0
[1.5.1]: https://github.com/FlashGalatine/xivdyetools/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/FlashGalatine/xivdyetools/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/FlashGalatine/xivdyetools/releases/tag/v1.0.0
