# Version Matrix

**Single source of truth for all XIV Dye Tools project versions**

*Last Updated: January 22, 2026*

---

## Current Versions

### Core Applications

| Project | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Core Library** | v1.15.1 | `@xivdyetools/core` | npm | Active |
| **Web Application** | v4.1.1 | — | Cloudflare Pages | Active |
| **Discord Bot** | v2.3.4 | — | Cloudflare Workers | Active |
| **Moderation Bot** | v1.0.1 | — | Cloudflare Workers | Active |
| **OAuth Worker** | v2.2.2 | — | Cloudflare Workers | Active |
| **Presets API** | v1.4.7 | — | Cloudflare Workers | Active |
| **Universalis Proxy** | v1.3.0 | — | Cloudflare Workers | Active |
| **OpenGraph Worker** | v1.0.0 | — | Cloudflare Workers | Active |

### Developer Tools

| Project | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Dye Maintainer** | v1.0.0 | — | Local (Vite + Express) | Active |

### Shared Packages

| Package | Version | Package Name | Platform | Status |
|---------|---------|--------------|----------|--------|
| **Types** | v1.7.0 | `@xivdyetools/types` | npm | Active |
| **Logger** | v1.1.0 | `@xivdyetools/logger` | npm | Active |
| **Test Utils** | v1.1.0 | `@xivdyetools/test-utils` | npm | Active |

### Deprecated

| Project | Last Version | Replacement |
|---------|--------------|-------------|
| xivdyetools-discord-bot | Archived | xivdyetools-discord-worker |

---

## Version History

### @xivdyetools/core

| Version | Date | Highlights |
|---------|------|------------|
| v1.15.1 | Jan 2026 | Current release |
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
| v4.1.1 | Jan 2026 | Current release, bug fixes and polish |
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
| v2.3.4 | Jan 2026 | Current release |
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
| v2.2.2 | Dec 2025 | Current release |
| v2.2.1 | Dec 2025 | Timeout protection (10s token exchange, 5s user info fetch) |
| v2.2.0 | Dec 2025 | Open redirect fix, improved state handling |
| v2.1.0 | Dec 2025 | State handling improvements |
| v1.1.0 | Dec 2025 | Refresh token improvements |
| v1.0.0 | Nov 2025 | Initial release with PKCE |

### xivdyetools-presets-api

| Version | Date | Highlights |
|---------|------|------------|
| v1.4.7 | Jan 2026 | Current release |
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
| v1.3.0 | Jan 2026 | Current release |
| v1.2.2 | Dec 2025 | Previous stable, 5MB response size limit |
| v1.2.0 | Dec 2025 | Memory leak fix (60s entry cleanup), input validation (100 items max, ID range 1-1M) |
| v1.1.0 | Dec 2025 | Dual-layer caching (Cache API + KV), request coalescing, stale-while-revalidate |
| v1.0.0 | Dec 2025 | Initial release with CORS proxy |

### @xivdyetools/types

| Version | Date | Highlights |
|---------|------|------------|
| v1.7.0 | Jan 2026 | Current release |
| v1.1.1 | Dec 2025 | Previous stable, branded types runtime validation guidance |
| v1.1.0 | Dec 2025 | Facewear ID support (synthetic IDs ≤ -1000) |
| v1.0.0 | Nov 2025 | Initial release |

### @xivdyetools/logger

| Version | Date | Highlights |
|---------|------|------------|
| v1.1.0 | Jan 2026 | Current release |
| v1.0.2 | Dec 2025 | Previous stable, Authorization pattern fix |
| v1.0.1 | Dec 2025 | Secret redaction pattern fixes |
| v1.0.0 | Nov 2025 | Initial release |

### xivdyetools-moderation-worker

| Version | Date | Highlights |
|---------|------|------------|
| v1.0.1 | Jan 2026 | Current release |
| v1.0.0 | Dec 2025 | Initial release, separate moderation bot for community presets |

### xivdyetools-og-worker

| Version | Date | Highlights |
|---------|------|------------|
| v1.0.0 | Jan 2026 | Initial release, dynamic OpenGraph metadata for social media previews |

### @xivdyetools/test-utils

| Version | Date | Highlights |
|---------|------|------------|
| v1.1.0 | Jan 2026 | Current release |
| v1.0.3 | Dec 2025 | Previous stable |
| v1.0.0 | Nov 2025 | Initial release |

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
