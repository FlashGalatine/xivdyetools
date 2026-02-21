# Version Matrix

**Single source of truth for all XIV Dye Tools project versions**

*Last Updated: February 21, 2026*

---

## Current Versions

### Core Applications

| Project | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Core Library** | v1.17.2 | `@xivdyetools/core` | npm | Active |
| **Web Application** | v4.1.8 | — | Cloudflare Pages | Active |
| **Discord Bot** | v4.0.2 | — | Cloudflare Workers | Active |
| **Moderation Bot** | v1.1.6 | — | Cloudflare Workers | Active |
| **OAuth Worker** | v2.3.7 | — | Cloudflare Workers | Active |
| **Presets API** | v1.4.14 | — | Cloudflare Workers | Active |
| **Universalis Proxy** | v1.4.2 | — | Cloudflare Workers | Active |
| **OpenGraph Worker** | v1.0.4 | — | Cloudflare Workers | Active |
| **Stoat Bot** | v0.1.1 | — | Cloudflare Workers | Active |

### Developer Tools

| Project | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Dye Maintainer** | v1.0.0 | — | Local (Vite + Express) | Active |

### Shared Packages

| Package | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Types** | v1.8.0 | `@xivdyetools/types` | npm | Active |
| **Auth** | v1.1.0 | `@xivdyetools/auth` | npm | Active |
| **Crypto** | v1.1.0 | `@xivdyetools/crypto` | npm | Active |
| **Logger** | v1.2.0 | `@xivdyetools/logger` | npm | Active |
| **Rate Limiter** | v1.4.0 | `@xivdyetools/rate-limiter` | npm | Active |
| **Core** | v1.17.2 | `@xivdyetools/core` | npm | Active |
| **SVG** | v1.1.0 | `@xivdyetools/svg` | npm | Active |
| **Bot Logic** | v1.1.0 | `@xivdyetools/bot-logic` | npm | Active |
| **Bot i18n** | v1.0.1 | `@xivdyetools/bot-i18n` | npm | Active |
| **Color Blending** | v1.0.1 | `@xivdyetools/color-blending` | npm | Active |
| **Test Utils** | v1.1.3 | `@xivdyetools/test-utils` | npm | Active |

### Deprecated

| Project | Last Version | Replacement |
|---------|--------------|-------------|
| xivdyetools-discord-bot | Archived | xivdyetools-discord-worker |

---

## Version History

### @xivdyetools/core

| Version | Date | Highlights |
|---------|------|------------|
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
| v4.0.2 | Feb 2026 | Lint sweep (85+ errors), targetDye.hex bug fix |
| v4.0.1 | Feb 2026 | Previous stable |
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
| v1.8.0 | Feb 2026 | DiscordSnowflake branded type with validation utilities |
| v1.7.0 | Jan 2026 | Previous stable |
| v1.1.1 | Dec 2025 | Previous stable, branded types runtime validation guidance |
| v1.1.0 | Dec 2025 | Facewear ID support (synthetic IDs ≤ -1000) |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/logger

| Version | Date | Highlights |
|---------|------|------------|
| v1.2.0 | Feb 2026 | Array recursion for redaction, merge custom redactFields with defaults |
| v1.1.3 | Feb 2026 | Lint fixes |
| v1.1.0 | Jan 2026 | Previous stable |
| v1.0.2 | Dec 2025 | Previous stable, Authorization pattern fix |
| v1.0.1 | Dec 2025 | Secret redaction pattern fixes |
| v1.0.0 | Nov 2025 | Initial release |

### xivdyetools-moderation-worker

| Version | Date | Highlights |
|---------|------|------------|
| v1.1.6 | Feb 2026 | Fix safeParseJSON prototype pollution, fix rate limit HTTP 429 response |
| v1.1.5 | Feb 2026 | Startup env validation |
| v1.0.1 | Jan 2026 | Previous stable |
| v1.0.0 | Dec 2025 | Initial release, separate moderation bot for community presets |

### xivdyetools-og-worker

| Version | Date | Highlights |
|---------|------|------------|
| v1.0.4 | Feb 2026 | NaN validation for dyeId parameters, escapeHtml for themeColor |
| v1.0.3 | Feb 2026 | Parameter bounds validation |
| v1.0.0 | Jan 2026 | Initial release, dynamic OpenGraph metadata for social media previews |

### @xivdyetools/test-utils

| Version | Date | Highlights |
|---------|------|------------|
| v1.1.3 | Feb 2026 | Fix D1 mock bind timing and batch results |
| v1.1.2 | Feb 2026 | Lint fixes |
| v1.1.0 | Jan 2026 | Previous stable |
| v1.0.3 | Dec 2025 | Previous stable |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/auth

| Version | Date | Highlights |
|---------|------|------------|
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
| v1.4.0 | Feb 2026 | Atomic Upstash pipeline, default trustXForwardedFor to false, KV off-by-one fixes |
| v1.3.1 | Feb 2026 | Lint fixes |
| v1.3.0 | Jan 2026 | Previous stable |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/svg

| Version | Date | Highlights |
|---------|------|------------|
| v1.1.0 | Feb 2026 | Shared truncateText/estimateTextWidth, fix double XML escaping, fix CJK badge width |
| v1.0.1 | Feb 2026 | Lint fixes |
| v1.0.0 | Feb 2026 | Initial release |

### @xivdyetools/bot-logic

| Version | Date | Highlights |
|---------|------|------------|
| v1.1.0 | Feb 2026 | Shared color-math.ts module, 193-test comprehensive suite |
| v1.0.0 | Feb 2026 | Initial release |

### @xivdyetools/bot-i18n

| Version | Date | Highlights |
|---------|------|------------|
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
| v0.1.1 | Feb 2026 | Lint fixes |
| v0.1.0 | Feb 2026 | Initial release — revolt.js bot with 4 commands |

---

## Compatibility Matrix

| Consumer | Minimum Core Version | Notes |
|----------|---------------------|-------|
| Web App v4.x | @xivdyetools/core v1.5.4+ | Requires facewear dye support, 9 tools |
| Web App v3.x | @xivdyetools/core v1.4.0+ | Requires facewear dye support, 7 tools |
| Discord Worker v2.x | @xivdyetools/core v1.4.0+ | Requires facewear dye support |
| Presets API v1.x | @xivdyetools/core v1.2.0+ | Requires localization |
| Web App v3.2.0+ | Universalis Proxy v1.0.0+ | Budget Suggestions tool uses proxy |

---

## Updating Versions

When releasing a new version:

1. **Core Library**:
   - Update `xivdyetools-core/package.json`
   - Run `npm publish`
   - Update this document

2. **Workers**:
   - Update respective `package.json`
   - Run `npm run deploy:production`
   - Update this document

3. **Web App**:
   - Update `xivdyetools-web-app/package.json`
   - Deploy to Cloudflare Pages
   - Update this document

See [Release Process](developer-guides/release-process.md) for detailed instructions.
