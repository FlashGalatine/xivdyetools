# Version Matrix

**Single source of truth for all XIV Dye Tools project versions**

*Last Updated: March 18, 2026*

---

## Current Versions

### Core Applications

| Project | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Core Library** | v2.2.0 | `@xivdyetools/core` | npm | Active |
| **Web Application** | v4.5.0 | — | Cloudflare Pages | Active |
| **Discord Bot** | v4.2.1 | — | Cloudflare Workers | Active |
| **Moderation Bot** | v1.1.9 | — | Cloudflare Workers | Active |
| **OAuth Worker** | v2.3.9 | — | Cloudflare Workers | Active |
| **Presets API** | v1.4.16 | — | Cloudflare Workers | Active |
| **Universalis Proxy** | v1.4.4 | — | Cloudflare Workers | Active |
| **OpenGraph Worker** | v1.0.7 | — | Cloudflare Workers | Active |
| **Stoat Bot** | v0.1.4 | — | Node.js | Active |

### Developer Tools

| Project | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Dye Maintainer** | v1.0.2 | — | Local (Vite + Express) | Active |

### Shared Packages

| Package | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Types** | v1.11.0 | `@xivdyetools/types` | npm | Active |
| **Auth** | v1.1.2 | `@xivdyetools/auth` | npm | Active |
| **Crypto** | v1.1.0 | `@xivdyetools/crypto` | npm | Active |
| **Logger** | v1.2.2 | `@xivdyetools/logger` | npm | Active |
| **Rate Limiter** | v1.4.4 | `@xivdyetools/rate-limiter` | npm | Active |
| **Core** | v2.2.0 | `@xivdyetools/core` | npm | Active |
| **SVG** | v1.1.2 | `@xivdyetools/svg` | npm | Active |
| **Bot Logic** | v1.1.2 | `@xivdyetools/bot-logic` | npm | Active |
| **Bot i18n** | v1.1.0 | `@xivdyetools/bot-i18n` | npm | Active |
| **Color Blending** | v1.0.1 | `@xivdyetools/color-blending` | npm | Active |
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
| v1.1.2 | Mar 2026 | Dependency updates, type imports migrated from core → @xivdyetools/types |
| v1.1.1 | Mar 2026 | Marked internal helpers `@internal` (DEAD-037–041) |
| v1.1.0 | Feb 2026 | Shared color-math.ts module, 193-test comprehensive suite |
| v1.0.0 | Feb 2026 | Initial release |

### @xivdyetools/bot-i18n

| Version | Date | Highlights |
|---------|------|------------|
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

---

## Compatibility Matrix

| Consumer | Minimum Core Version | Notes |
|----------|---------------------|-------|
| Web App v4.5.x | @xivdyetools/core v2.0.0+ | Types imported from `@xivdyetools/types` directly |
| Web App v4.0–4.1 | @xivdyetools/core v1.5.4+ | Requires facewear dye support, 9 tools |
| Discord Worker v4.1.x | @xivdyetools/core v2.0.0+ | Types imported from `@xivdyetools/types` directly |
| Discord Worker v4.0.x | @xivdyetools/core v1.5.4+ | Requires facewear dye support |
| Presets API v1.x | @xivdyetools/core v1.2.0+ | Requires localization |
| Web App v3.2.0+ | Universalis Proxy v1.0.0+ | Budget Suggestions tool uses proxy |
| Stoat Worker v0.1.x | @xivdyetools/core v2.0.0+ | Uses bot-logic + bot-i18n shared packages |

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
