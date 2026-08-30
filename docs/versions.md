# Version Matrix

**Single source of truth for all XIV Dye Tools project versions**

*Last Updated: August 30, 2026*

> **Versions below are read from each project's `package.json` on the working branch.** The 5.0
> wave — `core` v4.0.1, `types` v2.0.0, `svg` v2.0.1, `bot-logic` v2.1.0, `worker-kit` v1.1.0,
> `web-app` v5.0.0, `discord-worker` v5.0.0, `og-worker` v2.3.0, `presets-api` v2.2.0 and the
> rest (the patch/minor bumps on top of the 5.0 versions are the 2026-08-21 security-audit
> remediation) — is complete on `monorepo-2.0-prep` with every `CHANGELOG.md` written, but **not
> yet merged to `main` or published to npm**. Merging to `main` is the release; the root
> `CHANGELOG.md` 2.0.0 entry carries the deploy sequence and
> [`operations/POST_MERGE_CHECKLIST.md`](operations/POST_MERGE_CHECKLIST.md) the ordered
> post-merge list. See [Release Process](developer-guides/release-process.md).

---

## Current Versions

### Core Applications

| Project | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Web Application** | v5.0.0 | `xivdyetools-web-app` | Cloudflare Pages | Active — release pending |
| **Discord Bot** | v5.1.0 | `xivdyetools-discord-worker` | Cloudflare Workers | Active — release pending |
| **Image Worker** | v1.1.0 | `xivdyetools-image-worker` | Cloudflare Workers | Active |
| **Moderation Bot** | v1.6.0 | `xivdyetools-moderation-worker` | Cloudflare Workers | Active |
| **OAuth Worker** | v3.0.0 | `xivdyetools-oauth-worker` | Cloudflare Workers + D1 | Active |
| **Presets API** | v2.2.0 | `xivdyetools-presets-api` | Cloudflare Workers + D1 | Active |
| **Public REST API** | v0.10.0 | `xivdyetools-api-worker` | Cloudflare Workers + KV | Active |
| **OpenGraph Worker** | v2.4.0 | `xivdyetools-og-worker` | Cloudflare Workers | Active |
| **Stoat Bot** | v0.2.2 | `xivdyetools-stoat-worker` | Node.js | Parked — no active investment |
| **Universalis Proxy** | — | merged into `xivdyetools-api-worker` (`/universalis` + `/api/v2` compat) | Cloudflare Workers | Merged 2026-07-31 |
| **API Documentation** | — | merged into `xivdyetools-api-worker` (`docs/`, Workers Static Assets) | Cloudflare Workers | Merged 2026-07-31 |

### Shared Packages

| Package | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Core** (incl. `/blending` + schema-v2 data) | v4.0.1 | `@xivdyetools/core` | npm | Active — publish pending |
| **Types** | v2.0.0 | `@xivdyetools/types` | npm | Active — publish pending |
| **Auth** (incl. `/encoding`) | v1.4.0 | `@xivdyetools/auth` | npm | Active |
| **Logger** | v2.1.0 | `@xivdyetools/logger` | npm | Active |
| **Worker Kit** (middleware + `/rate-limiter`) | v1.1.0 | `@xivdyetools/worker-kit` | npm | Active (first publish 2026-08-28) |
| **SVG** | v3.0.0 | `@xivdyetools/svg` | npm | Active — publish pending (publish **before** bot-logic 3.0.0) |
| **Bot Logic** (incl. `/i18n`) | v3.0.0 | `@xivdyetools/bot-logic` | npm | Active — publish pending (requires svg 3.0.0 on npm first) |
| **Test Utils** | v1.2.0 | `@xivdyetools/test-utils` | workspace-private | Active (never published) |

### Deprecated

| Project | Last Version | Replacement |
|---------|--------------|-------------|
| xivdyetools-discord-bot | Archived | xivdyetools-discord-worker |
| @xivdyetools/crypto | v1.1.2 | `@xivdyetools/auth/encoding` (2026-07-30) |
| @xivdyetools/bot-i18n | v1.2.1 | `@xivdyetools/bot-logic/i18n` (2026-07-30) |
| @xivdyetools/color-blending | v1.1.0 | `@xivdyetools/core/blending` (2026-07-31) |
| @xivdyetools/rate-limiter | v1.5.0 | `@xivdyetools/worker-kit/rate-limiter` (2026-07-31) |
| @xivdyetools/worker-middleware | v1.2.0 | `@xivdyetools/worker-kit` (2026-07-31) |
| xivdyetools-maintainer | v1.0.3 | Manual workflow — `docs/maintainer/adding-dyes.md` (2026-07-31) |
| xivdyetools-universalis-proxy | v1.5.0 | `xivdyetools-api-worker` `/universalis` routes (2026-07-31) |

---

## Version History

### @xivdyetools/core

| Version | Date | Highlights |
|---------|------|------------|
| **v4.0.1** | **Aug 2026** | **2026-08-21 security audit (FINDING-027) — `.chara` `mapNamed` and `TranslationProvider.getLabel` use `Object.hasOwn` (prototype keys such as `constructor` / `__proto__` no longer resolve)** |
| **v4.0.0** | **Aug 2026** | **5.0 wave — one matching vocabulary (`ciede2000` default / `oklab` / `cie76` / `redmean` / `rgb` / `distinguish`; `hyab` + `oklch-weighted` retired, `normalizeMatchingMethod`), per-method band tiers (`classifyBandTier`), LCh rotation, Machado CVD matrices, `.chara` character-file parser + slot resolver, `dye-vocabulary.ts` (ex-maintainer), `presets.json` 2.0.0 (stainID, 15 curated rows), `SubRace 'Helions'`, `MANUAL_TOPICS`; 2.8.0 / 3.0.0 were never published** |
| **v3.0.0** | **Jul 2026** | **BREAKING — dye data schema v2. `colors_xiv.json` (136 × 16 fields) → `dyes.json` (125 × 7 fields, stainID-keyed); `rgb`/`hsv`/`lab`, `cost`/`currency`, and the five `is*` flags derived at `initialize()` so the runtime `Dye` shape is unchanged. The 11 Facewear colours left the dye table for `facewearColors` (`LEGACY_FACEWEAR_ITEM_IDS` retains the old synthetic IDs). `isMetallic` = the Stain sheet's 16-dye gloss set (was 14 by name prefix); `isCosmic ≡ consolidationType 'C'` (11, was 20 — Firmament dyes were mislabelled). Adds inverted-tetradic harmony and CMYK conversions** |
| **v2.8.0** | **Jul 2026** | **Monorepo 2.0 Tier 1 — absorbed `@xivdyetools/color-blending` as the `/blending` subpath export; `build-locales.ts` made idempotent so rebuilds no longer dirty all six locale JSONs** |
| **v2.7.0** | **Jul 2026** | **2026-07-18 audit (Sprint 4) — REFACTOR-003 exact linear scan for perceptual dye search (the k-d-radius approach could miss the true nearest), BUG-005 LRU caches return defensive copies, `APIService` batches Universalis requests above the 100-item limit** |
| **v2.6.0** | **Apr 2026** | **REFACTOR-001 og-worker localization (`tools` / `visions` / `sheets`), BUG-002 consolidated dye name fallback (52254/52255/52256), BUG-003 acquisition contract test, ARCH-002 Facewear invariants test, removed `ALLIED_SOCIETY_ACQUISITIONS`** |
| **v2.5.0** | **Apr 2026** | **Patch 7.5 dye consolidation activated — `CONSOLIDATED_IDS` populated with real itemIDs (A=52254, B=52255, C=52256); `CONSOLIDATED_DYES` config + `getConsolidatedDyeName()` helper; new `DyeService.getByStainId()` family** |
| v2.4.0 | Apr 2026 | Dye type filter functions (`isDyeExcluded`, `filterDyes`, `hasActiveFilters`) + acquisition constants (`VENDOR_ACQUISITIONS`, `CRAFT_ACQUISITIONS`, `ALLIED_SOCIETY_ACQUISITIONS`, `EXPENSIVE_DYE_IDS`) |
| v2.3.0 | Apr 2026 | Pre-Patch 7.5 release polish |
| **v2.2.0** | **Mar 2026** | **BUG-003/006/007/011 fixes, REFACTOR-005 readonly `getDyesInternal()` return, REFACTOR-006 stability warnings on internal exports, OPT-003 fire-and-forget cache eviction, Firmament locale translations** |
| **v2.1.0** | **Mar 2026** | **Patch 7.5 dye consolidation framework — `consolidated-ids.ts`, `getMarketItemID()`, `isConsolidationActive()`, data field additions** |
| v2.0.1 | Mar 2026 | Dependency updates (hono 4.12.5, workers-types) |
| **v2.0.0** | **Mar 2026** | **BREAKING: Removed ~35 deprecated type re-exports — import `Dye`, `RGB`, etc. from `@xivdyetools/types` directly. 28 symbols marked `@internal`. `ResolvedPreset` migrated to core's PresetService** |
| v1.17.2 | Feb 2026 | LRU cache for rgbToOklab(), spectral-js.d.ts type declarations |
| v1.17.1 | Feb 2026 | Lint fixes |
| v1.15.1 | Jan 2026 | Previous stable |
| v1.5.4 | Dec 2025 | Previous stable |
| v1.5.3 | Dec 2025 | Pre-computed lowercase names, simplified findClosestNonFacewearDye |
| v1.5.2 | Dec 2025 | Input validation, batch API URL validation, 100-item limit |
| v1.5.0 | Dec 2025 | Generic LRU cache consolidation |
| v1.4.0 | Dec 2025 | Facewear dye support (synthetic IDs ≤ -1000) |
| v1.3.7 | Dec 2025 | Bug fixes, performance improvements |
| v1.3.0 | Nov 2025 | K-means++ palette extraction |
| v1.2.0 | Nov 2025 | Preset service, localization |
| v1.0.0 | Nov 2025 | Initial release |

### xivdyetools-web-app

| Version | Date | Highlights |
|---------|------|------------|
| **v5.0.0** | **Aug 2026** | **5.0 redesign — every tool re-ported, themes reduced to Light + Dark (`standard-light` / `standard-dark`, legacy names migrated on load), console bar + tool rail, Advanced Options panel, result cards, `CollectionService` 5.0 (stainID-keyed saved things, exact-range migration), `.chara` import, share URLs on stainID + `?hex=` grammar, self-hosted fonts, root OG cards, beta build (`VITE_APP_ENV=beta`)** |
| **v4.12.0** | **Jul 2026** | **REFACTOR-002 step 1 — `BaseComponent` owns a `SubscriptionManager` with automatic cleanup in `destroy()` (7 tools converted); "What's New" full-history changelog modal in the v4 header; layman's changelog backfilled v4.0.0–v4.10.0** |
| v4.11.0 | May 2026 | Consolidation Spectrum filter chips in the dye palette drawer (Budget defaults to Unconsolidated); Budget matching-algorithm control; alternatives computed from the full in-distance pool; collection-manager E2E re-enabled (DEAD-110) |
| **v4.10.0** | **Apr 2026** | **Result Card v4 "Spectrum" row (Standard / Wide #1 / Wide #2), `common.spectrum` i18n, SEC-001 `auth-button.ts` XSS hardening, "Exclude Allied Society Dyes" filter removed, BUG-003 test fixture drift fix, sugarRiot localization fix (DE/KO)** |
| **v4.9.0** | **Apr 2026** | **Patch 7.5 dye consolidation active end-to-end — Market Board fans 3 consolidated prices to 105 dyes; tradeability-gated price fetch; refresh button relocated; deleted Price Categories panel + 6 dead i18n keys** |
| v4.8.0 | Apr 2026 | Palette Extractor "Extracted Colors" history with localStorage persistence; "Sampled Color" info card with HEX/RGB/HSV/LAB |
| v4.7.0 | Apr 2026 | SEC-002 modal `innerHTML` XSS vector eliminated — `ModalConfig.content` now requires `HTMLElement` only; all callers migrated to DOM construction |
| v4.6.0 | Apr 2026 | Dye Filters v4 web component (9 toggles, 2 collapsible sections); `dye-filter-utils.ts` with `isDyeExcluded`/`filterDyes`/`hasActiveFilters`; integrated across all 6 tools |
| **v4.5.0** | **Mar 2026** | **Swatch Matcher reverse matching (Color Palette drawer + custom hex), cross-tool context menu navigation, empty grid fix for saved race-specific categories** |
| v4.4.0 | Mar 2026 | Correct currency display on dye cards, Firmament localization, Patch 7.5 dye consolidation readiness |
| v4.3.1 | Mar 2026 | Dependency updates |
| **v4.3.0** | **Mar 2026** | **Shift+Click pixel sampling (1×1 to 16×16 area), Ctrl/Cmd+Drag canvas panning, pan offset persistence, dead code cleanup (7 v3 components, 30+ unused constants)** |
| **v4.2.0** | **Feb 2026** | **Prevent Duplicate Results toggle for Harmony Explorer and Palette Extractor, Paste from Clipboard in Extractor tool, type imports migrated from core → @xivdyetools/types** |
| v4.1.8 | Feb 2026 | CSRF state validation fix, lint/format sweep |
| v4.1.7 | Feb 2026 | Session security fixes, cross-tab sync |
| v4.1.1 | Jan 2026 | Previous stable, bug fixes and polish |
| v4.0.0 | Jan 2026 | **Major release**: Tool renaming (Color Matcher → Palette Extractor, Dye Mixer → Gradient Builder, Preset Browser → Community Presets), new Dye Mixer (RGB blending), new Swatch Matcher, 9 tools total, Glassmorphism UI, 12 themes, Lit.js web components |
| v3.2.8 | Dec 2025 | Previous stable release |
| v3.2.7 | Dec 2025 | Theme factory pattern (createThemePalette) |
| v3.2.6 | Dec 2025 | SVG icons consolidated to ui-icons.ts (~10KB savings), SubscriptionManager utility |
| v3.2.5 | Dec 2025 | Dye Mixer context menu (action dropdown for intermediate matches) |
| v3.2.4 | Dec 2025 | See Color Harmonies fix in Color Matcher |
| v3.2.2 | Dec 2025 | Slot selection modal, duplicate detection toasts |
| v3.2.0 | Dec 2025 | Budget Suggestions tool (7th tool) |
| v3.1.0 | Dec 2025 | SVG icon redesign |
| v3.0.0 | Dec 2025 | UI/UX rehaul, new theme system |
| v2.6.0 | Dec 2025 | Community presets browser |
| v2.0.0 | Nov 2025 | Major release with 6 tools |
| v1.6.x | Legacy | Original HTML-based tools |

### xivdyetools-discord-worker

| Version | Date | Highlights |
|---------|------|------------|
| **v5.1.0** | **Aug 2026** | **2026-08-29 security audit (Sprint 3) — rate-limit counters move from Upstash Redis to native `[[ratelimits]]` bindings, `/about`/`/manual`/`/changelog` take the normal per-command rate limit, the first-run notice flag expires after 180 days, `/preferences set world:` validates against Universalis and stores the canonical spelling (also checked on read), log lines carry ids/lengths instead of values, the release-announcement webhook is repo-pinned and de-duplicated per version, the bot stops sending the legacy v1 request signature to presets-api, and production `validateEnv` now requires all six `RL_*` bindings via a new `ENVIRONMENT` var (FINDING-007/008/011/013/015/019/020/021); PRIVACY_POLICY.md refreshed to match** |
| **v5.0.1** | **Aug 2026** | **Chara-name privacy (2026-08-29) — `/swatch` never shows the character's name or the attachment filename (neutral "Character swatch" title on card + embed, filename no longer forwarded to the renderer), PRIVACY_POLICY §3 amended; bot-logic 3.0.0 / svg 3.0.0** |
| **v5.0.0** | **Aug 2026** | **5.0 command set — v4 commands (`/match`, `/match_image`, `/favorites`, `/collection`, `/language`) deleted; `COMMAND_REGISTRY` becomes the roster of record; `/contrast` split out of `/accessibility` for WCAG 1.4.11 pairs; `/changelog` added; `/a11y` registered as an alias; `/swatch` takes a `.chara` file; every card redrawn on the svg 2.0.0 frame system; matching vocabulary + `/preferences set theme`; Photon decoding moved to `image-worker` behind a service binding (2,632 KiB gzip); beta bot on the routeless `-dev` env** |
| **v4.7.0** | **Jul 2026** | **2026-07-18 audit (Sprint 5) — BUG-009 moderation approve/reject buttons finally routable (embeds post via `MODERATION_BOT_TOKEN` so clicks reach moderation-worker), BUG-035 throw-safe outcome-checked Discord API wrappers, BUG-033 world → DC → region price-scope cascade in `/budget`** |
| v4.6.1 | Jun 2026 | Dead-code cleanup (DEAD-113–120) — unused "Error UX Standard V4" module and ~1,300 lines of orphaned exports removed |
| v4.6.0 | May 2026 | Web-parity option expansion — `/harmony` companions + matching algorithms, `/extractor` vibrancy boost + 3–10 colors, `/gradient` 2–12 steps with 9 interpolation modes, `/mixer` matching option |
| **v4.5.0** | **Apr 2026** | **Patch 7.5 cleanup — `/preferences set allied_society` slash-command option removed (requires `register-commands` re-run), ARCH-002 consolidation fan-out integration test, FONT_SUBSET_AUDIT fix in `subset-cjk-fonts.py`, CJK font subsets regenerated (484 KiB SC / 820 KiB KR)** |
| **v4.4.0** | **Apr 2026** | **REFACTOR-001/002 — migrated request-ID + logger middleware to `@xivdyetools/worker-middleware`; ARCH-001 removed `nodejs_compat` flag; BUG-001 strict TypeScript checks re-enabled** |
| **v4.3.0** | **Apr 2026** | **`/preferences filters` subcommand group (set/show/reset) with 9 boolean filter options; all 4 command handlers apply user filter preferences from bot-logic** |
| v4.2.1 | Mar 2026 | ARCH-001 deploy trigger fix for bot-i18n, bot-logic, color-blending, svg |
| v4.2.0 | Mar 2026 | Patch 7.5 dye consolidation in budget calculator |
| v4.1.2 | Mar 2026 | Dependency and security updates (hono 4.12.5) |
| **v4.1.1** | **Mar 2026** | **Budget quick picks updated with 20 Cosmic dyes, type imports migrated from core → @xivdyetools/types, dead code waves 5-6** |
| **v4.1.0** | **Feb 2026** | **Prevent Duplicate Results for `/extractor image`, ESLint v10 compatibility** |
| **v4.0.1** | **Feb 2026** | **7 bug fixes (BUG-001–007): LocalizationService singleton race condition, budget "no world set" broken embed, collection rename sanitization, Discord API timeout handling** |
| v4.0.2 | Feb 2026 | Lint sweep (85+ errors), targetDye.hex bug fix |
| v2.3.4 | Jan 2026 | Previous stable |
| v2.3.1 | Dec 2025 | Previous stable |
| v2.3.0 | Dec 2025 | KV schema versioning, analytics tracking fix, webhook auth security fix |
| v2.2.0 | Dec 2025 | User ban system (`/preset ban_user`, `/preset unban_user`) |
| v2.1.0 | Dec 2025 | Moderation infrastructure |
| v2.0.1 | Dec 2025 | Bug fixes |
| v2.0.0 | Dec 2025 | HTTP Interactions migration |
| v1.0.0 | Nov 2025 | Initial Cloudflare Worker release |

### xivdyetools-oauth

| Version | Date | Highlights |
|---------|------|------------|
| **v3.0.0** | **Aug 2026** | **BREAKING — 2026-08-29 security audit Sprint 2 (FINDING-001/002/003/010/012/013/022/023) — `/auth/refresh` removed; `orig_iat`/`xivauth_id`/`primary_character` no longer minted; `users.avatar_url` and the `xivauth_characters` roster table dropped by a hand-run migration (no known client used any of them); `Cache-Control: no-store` + `Pragma: no-cache` worker-wide; request logger drops the User-Agent; rate-limit binding fail-open events now logged; production `validateEnv` requires `RL_AUTH_10`/`RL_AUTH_20`/`RL_AUTH_30`/`TOKEN_BLACKLIST`; new wrangler-config invariant test; fixed `GET /auth/me`'s `avatar_url` (was built from the internal UUID, not the Discord snowflake)** |
| **v2.7.0** | **Aug 2026** | **2026-08-21 security audit (FINDING-001) — `/auth/refresh` grace window 24 h → shared `REFRESH_GRACE_SECONDS` (15 min); revocation blacklist entries now outlive `exp` by that window, so a revoked/leaked token can no longer be re-minted after it expires** |
| **v2.6.0** | **Aug 2026** | **Beta origin (`https://beta.xivdyetools.app`) on the redirect + CORS allowlist (unified — beta login hang fixed); migrated to `@xivdyetools/worker-kit` and `@xivdyetools/auth/encoding`** |
| **v2.5.0** | **Jul 2026** | **2026-07-18 audit (Sprint 2) — refresh rotation with `jti`-based revocation + `orig_iat` absolute session anchor (refresh chains can no longer extend a session indefinitely), state-signing hardening, single JWT verifier via `@xivdyetools/auth` 1.2.0** |
| v2.4.1 | May 2026 | FINDING-003/006 documentation — `verifyJWT()` revocation caveat (use `verifyJWTWithRevocationCheck()`), dev-env D1 placeholder note in `wrangler.toml` |
| **v2.4.0** | **Apr 2026** | **SEC-003 `jsonDepthLimit` middleware (maxDepth 10, 10 KB body, prototype pollution rejection); SEC-004 Hono `bodyLimit` (10 KB) on all `/auth/*`; REFACTOR-004 `isValidSnowflake` validation for `DISCORD_CLIENT_ID`; CORS `maxAge` 24h → 1h; migrated middleware to `@xivdyetools/worker-middleware`** |
| v2.3.10 | Mar 2026 | Lowered branch coverage threshold 90% → 88% — uncovered branches are defensive paths (Durable Objects rate limiting, error handler logger fallback, legacy unsigned state) |
| **v2.3.9** | **Mar 2026** | **BUG-013 removed STATE_TRANSITION_PERIOD — production requires HMAC-signed OAuth states** |
| v2.3.8 | Mar 2026 | Dependency updates |
| v2.3.7 | Feb 2026 | Type-check fixes, lint sweep |
| v2.3.6 | Feb 2026 | Block STATE_TRANSITION_PERIOD in production |
| v2.2.2 | Dec 2025 | Previous stable |
| v2.2.1 | Dec 2025 | Timeout protection (10s token exchange, 5s user info fetch) |
| v2.2.0 | Dec 2025 | Open redirect fix, improved state handling |
| v2.1.0 | Dec 2025 | State handling improvements |
| v1.1.0 | Dec 2025 | Refresh token improvements |
| v1.0.0 | Nov 2025 | Initial release with PKCE |

### xivdyetools-presets-api

| Version | Date | Highlights |
|---------|------|------------|
| **v2.2.0** | **Aug 2026** | **2026-08-29 security audit Sprint 1 (FINDING-004/005/006/010/011/013/015/016/017/023) — `author_discord_id` dropped from anonymous responses (`is_owner` added for web callers), v1 bot signature no longer accepted, moderation fails closed and gains a per-user `text_edit` daily cap (migration 0012), owner edits capped and status-transition-safe, dead-letter rows hold only the preset id, `console.*` eliminated in favor of the structured logger (no personal fields), production `validateEnv` requires `JWT_SECRET`/`JWT_ISSUER`/`TOKEN_BLACKLIST`/`RL_PUBLIC`, new wrangler-config invariant test** |
| **v2.1.0** | **Aug 2026** | **2026-08-21 security audit (FINDING-002/015) — oauth `TOKEN_BLACKLIST` KV bound: revoked JWTs rejected by `authMiddleware`; `JWT_ISSUER` var pins `iss`; claim typing via `@xivdyetools/auth` 1.4.0** |
| **v2.0.0** | **Aug 2026** | **BREAKING — preset dyes are stainIDs (3–6 per preset; legacy itemIDs rejected loudly), `community` category dropped (migration 0007) and `appearance` / `zones` / `raids-trials` added with 1 primary + ≤2 secondary categories (0010), `example_link` (0008), moderated preview images via image-worker `POST /thumbnail` + R2 (0009), `rejection_reason`, beta CORS origin, `worker-kit`; dev/prod `wrangler.toml` split** |
| **v1.6.0** | **Jul 2026** | **2026-07-18 audit (Sprint 1) — CRITICAL: moderation self-approval gap closed (submitters could approve their own presets); state-machine transitions validated server-side with D1 `batch()` transactions and `changes()`-gated updates; migration 0006 unique preset-signature index applied to production** |
| **v1.5.0** | **Apr 2026** | **SEC-003 `jsonDepthLimit` middleware (maxDepth 10, 100 KB body, prototype pollution rejection); SEC-004 Hono `bodyLimit` (100 KB) on `/api/*`; migrated to `rateLimitMiddleware()` from `@xivdyetools/worker-middleware` (standardized `X-RateLimit-*` + `Retry-After`); CORS `maxAge` 24h → 1h; BUG-002 structured logger in `preset-service.ts`** |
| **v1.4.16** | **Mar 2026** | **BUG-012 corrupted D1 row resilience, BUG-015 dead-letter table for failed Discord notifications, BUG-016 rate limiter fail-open logging, OPT-001 category cache promise deduplication** |
| v1.4.15 | Mar 2026 | Dependency updates |
| v1.4.14 | Feb 2026 | Lint sweep |
| v1.4.13 | Feb 2026 | Enforce BOT_SIGNING_SECRET in production |
| v1.4.7 | Jan 2026 | Previous stable |
| v1.4.5 | Dec 2025 | Previous stable |
| v1.4.4 | Dec 2025 | Standardized API responses, cascade delete integration tests |
| v1.4.3 | Dec 2025 | UTF-8 safe truncation for Discord embeds |
| v1.4.1 | Dec 2025 | Perspective API 5s timeout protection |
| v1.4.0 | Dec 2025 | Race condition handling, dynamic category validation, Discord notification retries |
| v1.2.0 | Dec 2025 | Moderation pipeline enhancements |
| v1.1.0 | Dec 2025 | Initial moderation pipeline |
| v1.0.0 | Nov 2025 | Initial release |

### xivdyetools-universalis-proxy (merged into api-worker 2026-07-31)

| Version | Date | Highlights |
|---------|------|------------|
| **v1.5.0** | **Jul 2026** | **2026-07-18 audit (Sprint 7) — BUG-027 `Vary: Origin` on all responses (shared caches can't replay the wrong CORS origin), BUG-028 honest SWR cache headers (`HIT-STALE` no longer advertised as fresh), BUG-065 streamed 5 MB byte budget closes the chunked-response bypass, BUG-066 shared `getClientIp()`** |
| **v1.4.5** | **Apr 2026** | **REFACTOR-002 — wired `@xivdyetools/worker-middleware` (`requestIdMiddleware` + `loggerMiddleware`); 4 `console.error` call sites replaced with structured `getLogger(c)?.error(...)` carrying operation tags** |
| **v1.4.4** | **Mar 2026** | **OPT-002 bound upstream response size with `listings=5&entries=5` query parameters** |
| v1.4.3 | Mar 2026 | Dependency updates |
| v1.4.2 | Feb 2026 | Lint sweep |
| v1.4.1 | Feb 2026 | Structured cache logging |
| v1.3.0 | Jan 2026 | Previous stable |
| v1.2.2 | Dec 2025 | Previous stable, 5MB response size limit |
| v1.2.0 | Dec 2025 | Memory leak fix (60s entry cleanup), input validation (100 items max, ID range 1-1M) |
| v1.1.0 | Dec 2025 | Dual-layer caching (Cache API + KV), request coalescing, stale-while-revalidate |
| v1.0.0 | Dec 2025 | Initial release with CORS proxy |

### @xivdyetools/types

| Version | Date | Highlights |
|---------|------|------------|
| **v2.0.0** | **Aug 2026** | **5.0 wave — `FacewearColor`, `CMYK`, `invertedTetradic`, `SubRace 'Helions'` (was `'Helion'`), `CommunityPreset` multi-category / preview-image / `example_link` / `rejection_reason` fields, `MatchingMethod` 5.0 vocabulary (1.16.0 folded in, never published)** |
| **v1.16.0** | **Jul 2026** | **Schema v2 support — `FacewearColor` interface (string slug `id`, `name`, `hex`) for the split-out Facewear collection, and the `CMYK` interface for core's new conversions** |
| **v1.15.0** | **Jul 2026** | **REFACTOR-004 shared match-quality tiers — `MATCH_QUALITY_TIERS`, `classifyMatchDistance()`, `MatchQualityKey`: single source of truth for thresholds previously duplicated 4× across bot-logic/svg with inconsistent boundary operators; standardized on inclusive `<=`** |
| **v1.14.0** | **Apr 2026** | **Removed `DyeTypeFilters.excludeAlliedSocietyDyes` (post-Patch 7.5 consolidation); REFACTOR-001 added `ToolKey` / `SheetKey` types + optional `tools` / `visions` / `sheets` fields on `LocaleData` for og-worker localization** |
| v1.13.0 | Apr 2026 | REFACTOR-003 promoted `DiscordSnowflake` type and `createSnowflake` function from `@internal` to public API; REFACTOR-006 enabled `stripInternal: true` in `tsconfig.build.json` |
| v1.12.0 | Apr 2026 | `DyeTypeFilters` interface with 9 optional boolean fields for dye type and acquisition source filtering |
| v1.11.0 | Mar 2026 | `currency` field on `Dye` interface, `consolidationType` and `isIshgardian` fields for Patch 7.5 |
| v1.10.0 | Mar 2026 | Dead code cleanup wave 10b: additional internal symbol refinements |
| **v1.9.0** | **Mar 2026** | **Dead code cleanup wave 10: removed utility module, generic API response types, orphaned preset types. 31 symbols marked `@internal` and removed from main barrel** |
| v1.8.0 | Feb 2026 | DiscordSnowflake branded type with validation utilities |
| v1.7.0 | Jan 2026 | Previous stable |
| v1.1.1 | Dec 2025 | Previous stable, branded types runtime validation guidance |
| v1.1.0 | Dec 2025 | Facewear ID support (synthetic IDs ≤ -1000) |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/logger

| Version | Date | Highlights |
|---------|------|------------|
| **v2.1.0** | **Aug 2026** | **2026-08-21 security audit (FINDING-026) — `safeStringify` (cycles / BigInt never throw in `write()`), `message` + non-Error throws sanitised, redact list extended, value-shape redaction (Bearer / JWT / Discord-token / long hex), browser `errorTracker` stack sanitised** |
| **v1.3.0** | **Jul 2026** | **2026-07-18 audit (Sprint 6) — BUG-024 case-insensitive redaction with sensitive-suffix heuristic + WeakSet cycle guard (depth cap removed), BUG-025 JSON-shaped error-message sanitization, BUG-026 `errorTracker` path redacts before forwarding, OPT-020 child loggers time with their own context** |
| v1.2.2 | Mar 2026 | Dependency updates |
| v1.2.1 | Feb 2026 | Dead code cleanup wave 11: removed `getRequestId` from barrel, 10 symbols marked `@internal` |
| v1.2.0 | Feb 2026 | Array recursion for redaction, merge custom redactFields with defaults |
| v1.1.3 | Feb 2026 | Lint fixes |
| v1.1.0 | Jan 2026 | Previous stable |
| v1.0.2 | Dec 2025 | Previous stable, Authorization pattern fix |
| v1.0.1 | Dec 2025 | Secret redaction pattern fixes |
| v1.0.0 | Nov 2025 | Initial release |

### xivdyetools-moderation-worker

| Version | Date | Highlights |
|---------|------|------------|
| **v1.6.0** | **Aug 2026** | **2026-08-29 security audit — ban/unban/hide/restore written to `moderation_log` via presets-api migration 0013 (FINDING-018); ban log line ids-only (FINDING-011); rate-limiter fail-open surfaced (FINDING-012); production refuses every request while an RL binding is missing (FINDING-013); v1 bot signature no longer sent (FINDING-015); `wrangler.toml` invariant test (FINDING-023)** |
| **v1.5.0** | **Aug 2026** | **2026-08-21 security audit — native `RL_COMMAND` / `RL_AUTOCOMPLETE` rate-limit bindings (FINDING-003); autocomplete moderator-gated (FINDING-006); ban-flow `custom_id`s carry only the snowflake, username resolved from D1 (FINDING-007); command registration guild-scoped** |
| **v1.4.0** | **Aug 2026** | **Image-only queue entries marked instead of mis-approved; new preset category rows; `worker-kit`; dev/prod `wrangler.toml` split (bare deploy = routeless `-dev` worker)** |
| **v1.3.0** | **Jul 2026** | **2026-07-18 audit (Sprint 5) — BUG-035 throw-safe outcome-checked Discord API wrappers (failures logged, not silently dropped), BUG-073 `MODERATOR_IDS` parsed via the shared `@xivdyetools/bot-logic` grammar** |
| **v1.2.0** | **Apr 2026** | **SEC-001 global `onError` handler prevents stack-trace leakage; SEC-005 placeholder `DISCORD_CLIENT_ID` detection at startup; migrated request-ID/logger/rate-limit middleware to `@xivdyetools/worker-middleware`; ARCH-001 removed `nodejs_compat`; BUG-001 strict TypeScript checks** |
| v1.1.9 | Mar 2026 | ARCH-001 deploy trigger fix for crypto transitive dependency |
| v1.1.8 | Mar 2026 | Dependency updates |
| v1.1.7 | Feb 2026 | Lint fixes |
| v1.1.6 | Feb 2026 | Fix safeParseJSON prototype pollution, fix rate limit HTTP 429 response |
| v1.1.5 | Feb 2026 | Startup env validation |
| v1.0.1 | Jan 2026 | Previous stable |
| v1.0.0 | Dec 2025 | Initial release, separate moderation bot for community presets |

### xivdyetools-og-worker

| Version | Date | Highlights |
|---------|------|------------|
| **v2.4.0** | **Aug 2026** | **2026-08-29 security audit (FINDING-024, OG-4) — `/og/*` allows only `lang`/`frame`/`algo` query keys and every path parameter must be canonical (no leading zeros, wrong case, `%2F` spellings, silently-dropped dye-list entries, or the `default` preset slug, which now renders the reserved default card after it was found to collide with a real not-found render under one cache key), `.png` stays optional but only as a true trailing suffix, `HEAD` is cacheable like `GET`, and the edge cache key is the canonical decoded path × resolved lang × resolved frame × raw algo instead of the full URL — closing the cache-defeat amplification for every *malformed or non-canonical* spelling of a card (two narrower residuals remain, both bounded by the WAF rule, not the cache key: distinct-id enumeration, and a card's own dye-list/count tail past what it actually draws — the crawler's own emitted links no longer produce the latter); plus the card font-weight fix (Space Grotesk/Onest ship as static instances, fixing every band name rendering at Light instead of its intended weight)** |
| **v2.3.0** | **Aug 2026** | **2026-08-21 security audit (FINDING-005) — /og/* segment-length guard (400), linear-time `fit`/`wrapName` (a 16 KB not-found label took 177 s), not-found echo capped at 32 chars, `caches.default` edge cache for rendered PNGs** |
| **v2.1.0** | **Aug 2026** | **Dead-code audit cleanup: extractor / presets / budget embeds reach their cards (were unreachable — root default only), `/presets/:id` crawler route, comparison honours `?frame=x`, `?algo=` rides harmony/gradient/mixer image URLs, ~500 lines of 15E-rewrite sediment removed (colour-sheet lookup, `base.ts`), CJK subsets −45 KB, base tsconfig flags restored** |
| **v2.0.0** | **Aug 2026** | **15E band cards for all nine tools (Discord 1200×1050 + X 1200×630), per-tool default cards, `?lang=` localization, stainID paths, `@xivdyetools/svg` 2.0.0 frame system, routed beta env (`deploy-og-worker-beta.yml`)** |
| **v1.4.0** | **Jul 2026** | **2026-07-18 audit (Sprint 7) — BUG-031 validated `?algo=` and 3-dye `ratio` parameters are finally honored (the "Algorithm:" footer no longer advertises math that didn't run), BUG-068 explicit `{ browser, edge }` cache TTLs, BUG-069 self-fetch guard on pass-throughs, REFACTOR-009 local SVG fork replaced by `@xivdyetools/svg` re-exports (~230 lines)** |
| v1.3.0 | May 2026 | CJK font subsets bundled (Noto Sans SC + KR, 466 KiB total) — ja/ko/zh dye names render on OG cards instead of falling back to English; new `scripts/subset-cjk-fonts.py` |
| **v1.2.0** | **Apr 2026** | **REFACTOR-001 OG embed metadata localized via `?lang=` query param — all 6 locales preloaded at module init; `harmonyToKey()` kebab-to-camel converter; REFACTOR-002 wired `@xivdyetools/worker-middleware`; global `app.onError` handler with structured logging; 6 new vitest cases (total: 344)** |
| **v1.1.0** | **Apr 2026** | **TEST-003 added 50 route-level integration tests (parameter validation, boundary values, crawler routing, health check, fallback routes); migrated middleware to `@xivdyetools/worker-middleware`; ARCH-001 removed `nodejs_compat`; BUG-001 strict TypeScript checks** |
| v1.0.7 | Mar 2026 | ARCH-001 deploy trigger fix for logger transitive dependency |
| v1.0.6 | Mar 2026 | Dependency updates |
| v1.0.5 | Feb 2026 | Lint fixes |
| v1.0.4 | Feb 2026 | NaN validation for dyeId parameters, escapeHtml for themeColor |
| v1.0.3 | Feb 2026 | Parameter bounds validation |
| v1.0.0 | Jan 2026 | Initial release, dynamic OpenGraph metadata for social media previews |

### xivdyetools-image-worker

| Version | Date | Highlights |
|---------|------|------------|
| **v1.1.0** | **Aug 2026** | **2026-08-21 security audit (FINDING-004) — header-only dimension gate before photon decodes (PNG/JPEG/GIF/WebP/BMP; 4096 px / 16 MP), `maxDimension` validated, byte caps enforced while streaming on /extract fetches and /thumbnail bodies** |
| **v1.0.0** | **Aug 2026** | **Initial release — split out of `discord-worker` (`docs/operations/IMAGE_WORKER_SPLIT.md`) to carry `@cf-wasm/photon`, bringing `discord-worker` back under Cloudflare's 3 MiB gzip limit (3,209.3 → 2,589.70 KiB). `POST /extract` decodes an image URL and returns raw RGBA pixels; `POST /thumbnail` returns a WebP preview for presets-api's preview images; reachable only via the `IMAGE_WORKER` service bindings (discord-worker, presets-api), no public surface** |

### @xivdyetools/test-utils

| Version | Date | Highlights |
|---------|------|------------|
| v1.2.0 | Jul 2026 | Monorepo 2.0 Tier 1 — package made workspace-private and unpublished from npm; factories updated for schema v2 |
| v1.1.8 | Jul 2026 | 2026-07-18 audit (Sprints 1 & 6) — BUG-062 MockD1 `exec()` keeps `_queries`/`_bindings` index-aligned; `batch()` routes through `run()` semantics (honors RETURNING + mutation meta) |
| v1.1.7 | Mar 2026 | Mock dye factories updated with `currency`, `consolidationType`, `isIshgardian` fields |
| v1.1.6 | Mar 2026 | Dependency updates |
| v1.1.5 | Mar 2026 | Dependency updates |
| v1.1.4 | Mar 2026 | Dead code cleanup wave 14: removed legacy counter infrastructure, factories now use `randomId()` for parallel safety |
| v1.1.3 | Feb 2026 | Fix D1 mock bind timing and batch results |
| v1.1.2 | Feb 2026 | Lint fixes |
| v1.1.0 | Jan 2026 | Previous stable |
| v1.0.3 | Dec 2025 | Previous stable |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/auth

| Version | Date | Highlights |
|---------|------|------------|
| **v1.4.0** | **Aug 2026** | **2026-08-21 security audit — `revokeToken` TTL = exp + `REFRESH_GRACE_SECONDS` (FINDING-001); `verifyJWT` claim typing, `nbf`, `issuer`/`audience` options (FINDING-015)** |
| **v1.3.0** | **Jul 2026** | **Monorepo 2.0 Tier 1 — absorbed `@xivdyetools/crypto` v1.1.2: Base64URL and hex utilities now live at `@xivdyetools/auth/encoding`. API identical; only the import specifier changes** |
| **v1.2.0** | **Jul 2026** | **2026-07-18 audit (Sprints 2 & 6) — `jti`-based revocation + `orig_iat` absolute session anchoring primitives (consumed by oauth's refresh rotation); BUG-059 `verifyDiscordRequest` body-size check measures UTF-8 bytes, not UTF-16 code units** |
| **v1.1.2** | **Mar 2026** | **BUG-005 LRU cache true ordering fix, BUG-010 require `sub` claim in JWT verification (security hardening)** |
| v1.1.1 | Mar 2026 | Dependency updates |
| v1.1.0 | Feb 2026 | Require exp claim, 32-byte min key, deduplicate JWT verification, CryptoKey caching |
| v1.0.3 | Feb 2026 | Lint fixes |
| v1.0.2 | Jan 2026 | Previous stable |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/crypto (retired — merged into `@xivdyetools/auth/encoding` 2026-07-30)

| Version | Date | Highlights |
|---------|------|------------|
| v1.1.2 | Jul 2026 | Release-infrastructure validation — first publish via npm trusted publishing (OIDC); contents identical to 1.1.1 |
| v1.1.1 | Jul 2026 | OPT-019 chunked `String.fromCharCode.apply` in `base64UrlEncodeBytes` — identical output, ~10-50× faster for KB+ payloads |
| v1.1.0 | Feb 2026 | Validate hex input in hexToBytes |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/rate-limiter (retired — merged into `@xivdyetools/worker-kit/rate-limiter` 2026-07-31)

| Version | Date | Highlights |
|---------|------|------------|
| **v1.5.0** | **Jul 2026** | **2026-07-18 audit (Sprints 5 & 6) — BUG-022 fake optimistic concurrency removed from `KVRateLimiter` (honest best-effort fixed window, 3 → 2 KV reads per admitted request), BUG-023 per-key window cleanup, BUG-055 real Upstash TTL in `Retry-After`, BUG-064 consistent window key across `checkOnly`/`increment`** |
| **v1.4.4** | **Mar 2026** | **OPT-005 in-place `splice()` for `cleanupOldEntries()`, direct array access for `pruneOldestEntries()` (performance)** |
| v1.4.3 | Mar 2026 | Dependency updates |
| v1.4.2 | Mar 2026 | Dead code cleanup wave 12: deleted orphaned barrel file, removed duplicate interface |
| v1.4.1 | Feb 2026 | Lint fixes |
| v1.4.0 | Feb 2026 | Atomic Upstash pipeline, default trustXForwardedFor to false, KV off-by-one fixes |
| v1.3.1 | Feb 2026 | Lint fixes |
| v1.3.0 | Jan 2026 | Previous stable |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/svg

| Version | Date | Highlights |
|---------|------|------------|
| **v3.0.0** | **Aug 2026** | **⚠️ BREAKING — chara-name privacy (2026-08-29): `SwatchCardOptions.charName` → `title`, a neutral card label that is never the character's name or the attachment filename** |
| **v2.0.1** | **Aug 2026** | **2026-08-21 security audit (FINDING-028) — `escapeXml` strips XML-illegal controls / U+FFFE / U+FFFF / lone surrogates; `fill` attributes escaped in contrast-card, gradient, dye-info-card, swatch-card** |
| **v2.0.0** | **Aug 2026** | **5.0 card frame system (`frame.ts`: 400 px canvas, 350 px ceiling, `CARD_DARK` / `CARD_LIGHT`), nine new generators (`generateContrastCard`, `generateA11yCard`, `generateBudgetLedger`, `generateNearestSheet`, `generateSwatchCard`, …), icon home (`icons/tool-icons.ts`), Fragment Mono + JP/SC/KR font stacks, `frame-budget` guard; five 4.x `build*Svg` modules deleted** |
| v1.2.1 | Jul 2026 | Release-infrastructure validation — publish via npm trusted publishing (OIDC), confirming `workspace:*` rewriting under npm 11; contents identical to 1.2.0 |
| **v1.2.0** | **Jul 2026** | **2026-07-18 audit (Sprint 6) — BUG-056 emoji removed from SVG text (bundled fonts have no emoji glyphs), BUG-060 code-point-safe truncation (no bisected surrogate pairs), BUG-063 single-step gradient NaN guard, REFACTOR-019 `escapeXml` on every string attribute** |
| v1.1.2 | Mar 2026 | Dependency updates, type imports migrated from core → @xivdyetools/types |
| v1.1.1 | Mar 2026 | Dead code cleanup wave 13: extracted rgbToHsv(), standardized truncation, cleaned unused params |
| v1.1.0 | Feb 2026 | Shared truncateText/estimateTextWidth, fix double XML escaping, fix CJK badge width |
| v1.0.1 | Feb 2026 | Lint fixes |
| v1.0.0 | Feb 2026 | Initial release |

### @xivdyetools/bot-logic

| Version | Date | Highlights |
|---------|------|------------|
| **v3.0.0** | **Aug 2026** | **⚠️ BREAKING — chara-name privacy (2026-08-29): `SwatchInput.fileName` removed, `SwatchResult.character` is `SwatchCharacter` (no `nickname`), card + embed titles are the neutral localized `card.swatchTitle`, the card's producer line is allowlisted; requires `@xivdyetools/svg` 3.0.0** |
| **v2.1.0** | **Aug 2026** | **2026-08-21 security audit (FINDING-019) — `escapeDiscordMarkdown`, `sanitizeEmbedText`, `ALLOWED_MENTIONS_NONE` shared by both bots (and stoat)** |
| **v2.0.0** | **Aug 2026** | **5.0 wave — one-line embeds, `executeContrast` / `executeSwatch`, gradient row capping, mixer ratio sweep, lens-based accessibility, `card.*` strings ×6 locales; `executeMatch` removed (1.4.0 / 1.5.0 never published)** |
| v1.5.0 | Aug 2026 | `inverted-tetradic` harmony type on `/harmony` (via core's `findInvertedTetradicDyes`), localized in all six bot locales — requires re-running slash-command registration |
| **v1.4.0** | **Jul 2026** | **Monorepo 2.0 Tier 1 — absorbed `@xivdyetools/bot-i18n` v1.2.1: the `Translator` engine, `LocaleCode` types, and the six bot-UI locale files now live at `@xivdyetools/bot-logic/i18n`. API identical; only the import specifier changes** |
| **v1.3.0** | **Jul 2026** | **2026-07-18 audit (Sprints 4 & 5) — shared `moderators` module (`parseModeratorIds` + snowflake validation) ends the discord-worker/moderation-worker parser drift; REFACTOR-004 match quality delegates to types' `classifyMatchDistance`; match results sorted by the displayed metric** |
| **v1.2.0** | **Apr 2026** | **`dyeFilters?: DyeTypeFilters` parameter on all 4 execute functions (match, harmony, gradient, mixer) — filters applied during candidate selection for cross-bot DyeTypeFilters integration** |
| v1.1.2 | Mar 2026 | Dependency updates, type imports migrated from core → @xivdyetools/types |
| v1.1.1 | Mar 2026 | Marked internal helpers `@internal` (DEAD-037–041) |
| v1.1.0 | Feb 2026 | Shared color-math.ts module, 193-test comprehensive suite |
| v1.0.0 | Feb 2026 | Initial release |

### @xivdyetools/bot-i18n (retired — merged into `@xivdyetools/bot-logic/i18n` 2026-07-30)

| Version | Date | Highlights |
|---------|------|------------|
| v1.2.1 | Jun 2026 | DEAD-126 README correction — removed docs for `translate()` / `getAvailableLocales()` / `isLocaleSupported()`, deleted from the package in 1.1.0 but still documented on npm for two releases |
| **v1.2.0** | **Apr 2026** | **Filter-related translation keys added to all 6 locales (en, ja, de, fr, ko, zh) for the `DyeTypeFilters` integration** |
| v1.1.0 | Mar 2026 | Marked `LocaleData` and `TranslatorLogger` as `@internal`, removed 3 unused function exports and 5 unused locale key sections |
| v1.0.1 | Feb 2026 | Lint fixes |
| v1.0.0 | Feb 2026 | Initial release |

### @xivdyetools/color-blending (retired — merged into `@xivdyetools/core/blending` 2026-07-31)

| Version | Date | Highlights |
|---------|------|------------|
| **v1.1.0** | **Jul 2026** | **REFACTOR-005 — `@xivdyetools/core` dependency removed (local strict `hexToRgb` in `conversions.ts`); zero internal dependencies, so blending-only consumers no longer pull in the dye database / k-d tree / i18n** |
| v1.0.1 | Feb 2026 | Lint fixes |
| v1.0.0 | Feb 2026 | Initial release |

### xivdyetools-stoat-worker

| Version | Date | Highlights |
|---------|------|------------|
| v0.2.2 | Aug 2026 | 2026-08-21 security audit — bot authors ignored + per-user throttle (`message-handler.ts`), `Object.hasOwn` command tables, sanitised echoes, `.app` links; still parked |
| v0.2.1 | Aug 2026 | Dependency retargets only (`bot-logic/i18n`, `core/blending`); parked |
| **v0.2.0** | **Jul 2026** | **2026-07-18 audit (Sprint 5) — BUG-038 message context keyed by the bot reply's message ID (reaction handlers can actually find it; multi-match responses no longer overwrite each other); dead reaction affordances removed** |
| v0.1.4 | Mar 2026 | REFACTOR-007 removed Phase 2 TODO comments from command routing |
| v0.1.3 | Mar 2026 | Dependency updates |
| v0.1.2 | Mar 2026 | Type imports migrated from core → @xivdyetools/types |
| v0.1.1 | Feb 2026 | Lint fixes |
| v0.1.0 | Feb 2026 | Initial release — revolt.js bot with 4 commands |

### xivdyetools-api-worker

| Version | Date | Highlights |
|---------|------|------------|
| **v0.10.0** | **Aug 2026** | **2026-08-29 security audit (FINDING-010 + FINDING-014) — `POST /v1/telemetry` gates on `Origin` + honours `Sec-GPC: 1` before reading the body, derives `env` from the accepted origin (loopback keeps the body's `env`, non-production only), and fails closed on limiter errors; request logs drop the last `logUserAgent: true` opt-in in the repo** |
| **v0.9.0** | **Aug 2026** | **`POST /v1/telemetry` — the web app's opt-in usage telemetry → Analytics Engine (`ANALYTICS` dataset binding, allowlist schema, fixed blob layout, 204-only, internal); own per-IP bucket `TELEMETRY_RATE_LIMITER` (240 / 60 s) so beacons never consume the `/v1/*` API bucket** |
| **v0.8.0** | **Aug 2026** | **2026-08-21 security audit (FINDING-003) — `/v1/*` per-IP limiter now uses the native Workers Rate Limiting binding `API_RATE_LIMITER` (65 / 60 s); KV (which cannot throttle a fast client) is only the fallback** |
| **v0.6.0** | **Aug 2026** | **Absorbed universalis-proxy (`/universalis/*` canonical, `/api/v2/*` compat) and the api-docs VitePress site (Workers Static Assets on `developers.xivdyetools.app`); serves schema v2 (125 dyes, `facewearColors`, negative legacy IDs → 404 with slug); accepts the 5.0 matching vocabulary (`hyab` / `oklch-weighted` normalised to `ciede2000`, `kL/kC/kH` ignored); `worker-kit`; dev/prod split** |
| **v0.5.0** | **Jul 2026** | **2026-07-18 audit (Sprint 4) — route/middleware/validation fixes; consumes `@xivdyetools/core` 2.7.0's exact perceptual-search fix so `/v1` match results are correct at radius boundaries** |
| **v0.4.0** | **Apr 2026** | **Removed `?alliedSociety=` filter (post-Patch 7.5); OPT-001 `localeMiddleware` validates `?locale=` once per request; BUG-001 structured logger; ARCH-001 CORS `maxAge` 24h → 1h; BUG-004 per-request `KVRateLimiter` construction (eliminates singleton footgun)** |
| v0.3.0 | Apr 2026 | OPT-001 promise deduplication on `GET /api/v1/categories` (thundering-herd prevention); REFACTOR-010 named TTL constants; migrated rate-limit/request-ID/logger middleware to `@xivdyetools/worker-middleware`; ARCH-001 removed `nodejs_compat`; BUG-001 strict TypeScript checks |
| v0.2.0 | Apr 2026 | `DyeQueryFilters` interface and `parseDyeFilters()` for query-string filter parsing; dye type filtering on `GET /v1/dyes`; filter exclusion on `/closest` and `/within-distance`; 11 unit tests |
| v0.1.0 | Apr 2026 | Initial release — public REST API for XIV Dye Tools dye database and color matching at `data.xivdyetools.app` |

### xivdyetools-api-docs (merged into api-worker 2026-07-31)

| Version | Date | Highlights |
|---------|------|------------|
| v0.1.0 | Apr 2026 | Initial VitePress docs site at `developers.xivdyetools.app` — covers all 9 Phase 1 API endpoints; inline "Try It" panels firing live requests; one-click "Copy as cURL" |

### @xivdyetools/worker-middleware (retired — merged into `@xivdyetools/worker-kit` 2026-07-31)

| Version | Date | Highlights |
|---------|------|------------|
| **v1.2.0** | **Jul 2026** | **BUG-061 (2026-07-18 audit) — rate-limit `backend` factory result memoized per isolate (a `(c) => new MemoryRateLimiter()` factory can no longer construct a fresh empty limiter per request and silently disable rate limiting); backend errors logged with the real message** |
| **v1.1.2** | **Apr 2026** | **LINT-FIX — made `getLogger` / `getRequestId` generic over `Context<E, P, I>` so callers (e.g. `presets-api` with `& { auth: AuthContext }`) preserve narrow typing; resolves CI `no-unsafe-argument` lint cascade from 1.1.1** |
| **v1.1.1** | **Apr 2026** | **REFACTOR-003 — replaced `Context<any, any, any>` in helpers with Hono's standard `Context` (relies on the existing `ContextVariableMap` augmentation); SEC-002 — strengthened `keyExtractor` JSDoc warning against deriving keys from `X-Forwarded-For`** |
| v1.1.0 | Apr 2026 | `rateLimitMiddleware()` factory with standardized `X-RateLimit-*` headers, `Retry-After` on 429, fail-open error handling; adopted by `presets-api` and `api-worker`; BUG-003 eliminated all `any` types via `ContextVariableMap` augmentation |
| v1.0.0 | Apr 2026 | Initial release — `requestIdMiddleware()` (UUID-validated, log-injection safe), `loggerMiddleware()` (per-request structured logging), `getRequestId()` / `getLogger()` safe context helpers, `MiddlewareVariables` base type. Extracts ~185 lines of duplicated middleware from 5 workers |

---

## Compatibility Matrix

| Consumer | Minimum Core Version | Notes |
|----------|---------------------|-------|
| Web App v5.0+ | @xivdyetools/core v4.0.0+ | Schema v2, 5.0 matching vocabulary + band tiers, `.chara` parser; `@xivdyetools/types` v2.0.0+ |
| Discord Worker v5.0.1+ | @xivdyetools/core v4.0.0+ | `@xivdyetools/svg` v3.0.0+ and `@xivdyetools/bot-logic` v3.0.0+ (neutral `/swatch` title — chara-name privacy); publish svg before bot-logic |
| Discord Worker v5.0+ | @xivdyetools/core v4.0.0+ | Also `@xivdyetools/svg` v2.0.0+, `@xivdyetools/bot-logic` v2.0.0+ (incl. `/i18n`), `@xivdyetools/worker-kit` v1.0.0+ |
| OG Worker v2.0+ | @xivdyetools/svg v2.0.0+ | 15E band frame generators |
| Any consumer of blending | @xivdyetools/core v2.8.0+ | `@xivdyetools/color-blending` retired; import from `@xivdyetools/core/blending` |
| Any worker using middleware | @xivdyetools/worker-kit v1.0.0+ | Replaces `worker-middleware` and `rate-limiter` |
| Web App v4.9–4.12 | @xivdyetools/core v2.5.0+ | Patch 7.5 dye consolidation active end-to-end |
| Web App v4.5–4.8 | @xivdyetools/core v2.0.0+ | Types imported from `@xivdyetools/types` directly |
| Web App v4.0–4.1 | @xivdyetools/core v1.5.4+ | Requires facewear dye support, 9 tools |
| Discord Worker v4.5+ | @xivdyetools/core v2.6.0+ | Allied Society filter removed (co-deleted with types/core) |
| Discord Worker v4.1–4.4 | @xivdyetools/core v2.0.0+ | Types imported from `@xivdyetools/types` directly |
| Discord Worker v4.0.x | @xivdyetools/core v1.5.4+ | Requires facewear dye support |
| API Worker v0.4+ | @xivdyetools/core v2.6.0+ | Allied Society query parameter removed |
| API Worker v0.1–0.3 | @xivdyetools/core v2.4.0+ | Requires DyeTypeFilters |
| Presets API v1.x | @xivdyetools/core v1.2.0+ | Requires localization |
| Web App v3.2.0+ | Universalis Proxy v1.0.0+ | Budget Suggestions tool uses proxy |
| Stoat Worker v0.1.x | @xivdyetools/core v2.0.0+ | Uses bot-logic (+ bot-i18n, before it was absorbed) |

---

## Updating Versions

This is a **pnpm monorepo** with Turborepo. When releasing a new version:

1. **Shared Library** (e.g., `@xivdyetools/core`) — published by the
   **Publish Packages to npm** workflow via trusted publishing (OIDC); no npm
   token is involved. See the root `CLAUDE.md` for the full flow.
   ```bash
   # Build and test the package
   pnpm turbo run build test --filter=@xivdyetools/core

   # Bump version in packages/core/package.json and merge to main
   # Actions → "Publish Packages to npm" → package: @xivdyetools/core
   ```

2. **Workers** (e.g., `xivdyetools-discord-worker`):
   ```bash
   # Build and test
   pnpm turbo run build test --filter=xivdyetools-discord-worker

   # Deploy — note that a BARE `deploy` targets the DEV/BETA worker.
   # Production always needs the explicit :production script.
   pnpm --filter xivdyetools-discord-worker run deploy:production
   ```
   See [Deploy Environments](operations/DEPLOY_ENVIRONMENTS.md) before running either.

3. **Web App**:
   ```bash
   pnpm --filter xivdyetools-web-app run build
   # Deploy via Cloudflare Pages GitHub integration (push to main)
   ```

4. **Update this document** with the new version numbers.

Internal dependencies use the `workspace:*` protocol and resolve automatically within the monorepo.

See [Release Process](developer-guides/release-process.md) for detailed instructions.
