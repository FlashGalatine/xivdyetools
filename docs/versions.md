# Version Matrix

**Single source of truth for all XIV Dye Tools project versions**

*Last Updated: April 29, 2026*

---

## Current Versions

### Core Applications

| Project | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Core Library** | v2.6.0 | `@xivdyetools/core` | npm | Active |
| **Web Application** | v4.10.0 | `xivdyetools-web-app` | Cloudflare Pages | Active |
| **Discord Bot** | v4.5.0 | `xivdyetools-discord-worker` | Cloudflare Workers | Active |
| **Moderation Bot** | v1.2.0 | `xivdyetools-moderation-worker` | Cloudflare Workers | Active |
| **OAuth Worker** | v2.4.0 | `xivdyetools-oauth-worker` | Cloudflare Workers | Active |
| **Presets API** | v1.5.0 | `xivdyetools-presets-api` | Cloudflare Workers | Active |
| **Universalis Proxy** | v1.4.5 | `xivdyetools-universalis-proxy` | Cloudflare Workers | Active |
| **OpenGraph Worker** | v1.2.0 | `xivdyetools-og-worker` | Cloudflare Workers | Active |
| **Public REST API** | v0.4.0 | `xivdyetools-api-worker` | Cloudflare Workers + KV | Active |
| **API Documentation** | v0.1.0 | `xivdyetools-api-docs` | Cloudflare Pages (VitePress) | Active |
| **Stoat Bot** | v0.1.4 | `xivdyetools-stoat-worker` | Node.js | Active |

### Developer Tools

| Project | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Dye Maintainer** | v1.0.2 | `xivdyetools-maintainer` | Local (Vite + Express) | Active |

### Shared Packages

| Package | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Types** | v1.14.0 | `@xivdyetools/types` | npm | Active |
| **Auth** | v1.1.2 | `@xivdyetools/auth` | npm | Active |
| **Crypto** | v1.1.0 | `@xivdyetools/crypto` | npm | Active |
| **Logger** | v1.2.2 | `@xivdyetools/logger` | npm | Active |
| **Rate Limiter** | v1.4.4 | `@xivdyetools/rate-limiter` | npm | Active |
| **Core** | v2.6.0 | `@xivdyetools/core` | npm | Active |
| **SVG** | v1.1.2 | `@xivdyetools/svg` | npm | Active |
| **Bot Logic** | v1.2.0 | `@xivdyetools/bot-logic` | npm | Active |
| **Bot i18n** | v1.2.0 | `@xivdyetools/bot-i18n` | npm | Active |
| **Color Blending** | v1.0.1 | `@xivdyetools/color-blending` | npm | Active |
| **Worker Middleware** | v1.1.2 | `@xivdyetools/worker-middleware` | npm | Active |
| **Test Utils** | v1.1.7 | `@xivdyetools/test-utils` | npm | Active |

### Deprecated

| Project | Last Version | Replacement |
|---------|--------------|-------------|
| xivdyetools-discord-bot | Archived | xivdyetools-discord-worker |

---

## Version History

### @xivdyetools/core

| Version | Date | Highlights |
|---------|------|------------|
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

### xivdyetools-universalis-proxy

| Version | Date | Highlights |
|---------|------|------------|
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
| **v1.2.0** | **Apr 2026** | **REFACTOR-001 OG embed metadata localized via `?lang=` query param — all 6 locales preloaded at module init; `harmonyToKey()` kebab-to-camel converter; REFACTOR-002 wired `@xivdyetools/worker-middleware`; global `app.onError` handler with structured logging; 6 new vitest cases (total: 344)** |
| **v1.1.0** | **Apr 2026** | **TEST-003 added 50 route-level integration tests (parameter validation, boundary values, crawler routing, health check, fallback routes); migrated middleware to `@xivdyetools/worker-middleware`; ARCH-001 removed `nodejs_compat`; BUG-001 strict TypeScript checks** |
| v1.0.7 | Mar 2026 | ARCH-001 deploy trigger fix for logger transitive dependency |
| v1.0.6 | Mar 2026 | Dependency updates |
| v1.0.5 | Feb 2026 | Lint fixes |
| v1.0.4 | Feb 2026 | NaN validation for dyeId parameters, escapeHtml for themeColor |
| v1.0.3 | Feb 2026 | Parameter bounds validation |
| v1.0.0 | Jan 2026 | Initial release, dynamic OpenGraph metadata for social media previews |

### @xivdyetools/test-utils

| Version | Date | Highlights |
|---------|------|------------|
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
| **v1.1.2** | **Mar 2026** | **BUG-005 LRU cache true ordering fix, BUG-010 require `sub` claim in JWT verification (security hardening)** |
| v1.1.1 | Mar 2026 | Dependency updates |
| v1.1.0 | Feb 2026 | Require exp claim, 32-byte min key, deduplicate JWT verification, CryptoKey caching |
| v1.0.3 | Feb 2026 | Lint fixes |
| v1.0.2 | Jan 2026 | Previous stable |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/crypto

| Version | Date | Highlights |
|---------|------|------------|
| v1.1.0 | Feb 2026 | Validate hex input in hexToBytes |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/rate-limiter

| Version | Date | Highlights |
|---------|------|------------|
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
| v1.1.2 | Mar 2026 | Dependency updates, type imports migrated from core → @xivdyetools/types |
| v1.1.1 | Mar 2026 | Dead code cleanup wave 13: extracted rgbToHsv(), standardized truncation, cleaned unused params |
| v1.1.0 | Feb 2026 | Shared truncateText/estimateTextWidth, fix double XML escaping, fix CJK badge width |
| v1.0.1 | Feb 2026 | Lint fixes |
| v1.0.0 | Feb 2026 | Initial release |

### @xivdyetools/bot-logic

| Version | Date | Highlights |
|---------|------|------------|
| **v1.2.0** | **Apr 2026** | **`dyeFilters?: DyeTypeFilters` parameter on all 4 execute functions (match, harmony, gradient, mixer) — filters applied during candidate selection for cross-bot DyeTypeFilters integration** |
| v1.1.2 | Mar 2026 | Dependency updates, type imports migrated from core → @xivdyetools/types |
| v1.1.1 | Mar 2026 | Marked internal helpers `@internal` (DEAD-037–041) |
| v1.1.0 | Feb 2026 | Shared color-math.ts module, 193-test comprehensive suite |
| v1.0.0 | Feb 2026 | Initial release |

### @xivdyetools/bot-i18n

| Version | Date | Highlights |
|---------|------|------------|
| **v1.2.0** | **Apr 2026** | **Filter-related translation keys added to all 6 locales (en, ja, de, fr, ko, zh) for the `DyeTypeFilters` integration** |
| v1.1.0 | Mar 2026 | Marked `LocaleData` and `TranslatorLogger` as `@internal`, removed 3 unused function exports and 5 unused locale key sections |
| v1.0.1 | Feb 2026 | Lint fixes |
| v1.0.0 | Feb 2026 | Initial release |

### @xivdyetools/color-blending

| Version | Date | Highlights |
|---------|------|------------|
| v1.0.1 | Feb 2026 | Lint fixes |
| v1.0.0 | Feb 2026 | Initial release |

### xivdyetools-stoat-worker

| Version | Date | Highlights |
|---------|------|------------|
| v0.1.4 | Mar 2026 | REFACTOR-007 removed Phase 2 TODO comments from command routing |
| v0.1.3 | Mar 2026 | Dependency updates |
| v0.1.2 | Mar 2026 | Type imports migrated from core → @xivdyetools/types |
| v0.1.1 | Feb 2026 | Lint fixes |
| v0.1.0 | Feb 2026 | Initial release — revolt.js bot with 4 commands |

### xivdyetools-api-worker

| Version | Date | Highlights |
|---------|------|------------|
| **v0.4.0** | **Apr 2026** | **Removed `?alliedSociety=` filter (post-Patch 7.5); OPT-001 `localeMiddleware` validates `?locale=` once per request; BUG-001 structured logger; ARCH-001 CORS `maxAge` 24h → 1h; BUG-004 per-request `KVRateLimiter` construction (eliminates singleton footgun)** |
| v0.3.0 | Apr 2026 | OPT-001 promise deduplication on `GET /api/v1/categories` (thundering-herd prevention); REFACTOR-010 named TTL constants; migrated rate-limit/request-ID/logger middleware to `@xivdyetools/worker-middleware`; ARCH-001 removed `nodejs_compat`; BUG-001 strict TypeScript checks |
| v0.2.0 | Apr 2026 | `DyeQueryFilters` interface and `parseDyeFilters()` for query-string filter parsing; dye type filtering on `GET /v1/dyes`; filter exclusion on `/closest` and `/within-distance`; 11 unit tests |
| v0.1.0 | Apr 2026 | Initial release — public REST API for XIV Dye Tools dye database and color matching at `data.xivdyetools.app` |

### xivdyetools-api-docs

| Version | Date | Highlights |
|---------|------|------------|
| v0.1.0 | Apr 2026 | Initial VitePress docs site at `developers.xivdyetools.app` — covers all 9 Phase 1 API endpoints; inline "Try It" panels firing live requests; one-click "Copy as cURL" |

### @xivdyetools/worker-middleware

| Version | Date | Highlights |
|---------|------|------------|
| **v1.1.2** | **Apr 2026** | **LINT-FIX — made `getLogger` / `getRequestId` generic over `Context<E, P, I>` so callers (e.g. `presets-api` with `& { auth: AuthContext }`) preserve narrow typing; resolves CI `no-unsafe-argument` lint cascade from 1.1.1** |
| **v1.1.1** | **Apr 2026** | **REFACTOR-003 — replaced `Context<any, any, any>` in helpers with Hono's standard `Context` (relies on the existing `ContextVariableMap` augmentation); SEC-002 — strengthened `keyExtractor` JSDoc warning against deriving keys from `X-Forwarded-For`** |
| v1.1.0 | Apr 2026 | `rateLimitMiddleware()` factory with standardized `X-RateLimit-*` headers, `Retry-After` on 429, fail-open error handling; adopted by `presets-api` and `api-worker`; BUG-003 eliminated all `any` types via `ContextVariableMap` augmentation |
| v1.0.0 | Apr 2026 | Initial release — `requestIdMiddleware()` (UUID-validated, log-injection safe), `loggerMiddleware()` (per-request structured logging), `getRequestId()` / `getLogger()` safe context helpers, `MiddlewareVariables` base type. Extracts ~185 lines of duplicated middleware from 5 workers |

---

## Compatibility Matrix

| Consumer | Minimum Core Version | Notes |
|----------|---------------------|-------|
| Web App v4.9+ | @xivdyetools/core v2.5.0+ | Patch 7.5 dye consolidation active end-to-end |
| Web App v4.5–4.8 | @xivdyetools/core v2.0.0+ | Types imported from `@xivdyetools/types` directly |
| Web App v4.0–4.1 | @xivdyetools/core v1.5.4+ | Requires facewear dye support, 9 tools |
| Discord Worker v4.5+ | @xivdyetools/core v2.6.0+ | Allied Society filter removed (co-deleted with types/core) |
| Discord Worker v4.1–4.4 | @xivdyetools/core v2.0.0+ | Types imported from `@xivdyetools/types` directly |
| Discord Worker v4.0.x | @xivdyetools/core v1.5.4+ | Requires facewear dye support |
| API Worker v0.4+ | @xivdyetools/core v2.6.0+ | Allied Society query parameter removed |
| API Worker v0.1–0.3 | @xivdyetools/core v2.4.0+ | Requires DyeTypeFilters |
| Presets API v1.x | @xivdyetools/core v1.2.0+ | Requires localization |
| Web App v3.2.0+ | Universalis Proxy v1.0.0+ | Budget Suggestions tool uses proxy |
| Stoat Worker v0.1.x | @xivdyetools/core v2.0.0+ | Uses bot-logic + bot-i18n shared packages |
| All workers using shared middleware | @xivdyetools/worker-middleware v1.0.0+ | Replaces local request-ID + logger middleware |

---

## Updating Versions

This is a **pnpm monorepo** with Turborepo. When releasing a new version:

1. **Shared Library** (e.g., `@xivdyetools/core`):
   ```bash
   # Build and test the package
   pnpm turbo run build test --filter=@xivdyetools/core

   # Bump version in packages/core/package.json
   # Publish to npm
   pnpm --filter @xivdyetools/core publish --provenance --access public --no-git-checks
   ```

2. **Workers** (e.g., `xivdyetools-discord-worker`):
   ```bash
   # Build and test
   pnpm turbo run build test --filter=xivdyetools-discord-worker

   # Deploy
   pnpm --filter xivdyetools-discord-worker run deploy:production
   ```

3. **Web App**:
   ```bash
   pnpm --filter xivdyetools-web-app run build
   # Deploy via Cloudflare Pages GitHub integration (push to main)
   ```

4. **Update this document** with the new version numbers.

Internal dependencies use the `workspace:*` protocol and resolve automatically within the monorepo.

See [Release Process](developer-guides/release-process.md) for detailed instructions.
