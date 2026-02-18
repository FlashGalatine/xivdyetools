# Analytics Brainstorming

**Status**: Complete
**Date**: January 15, 2026
**Context**: Privacy-first analytics strategy for xivdyetools-web-app hosted on Cloudflare

---

## Overview

This directory contains brainstorming documents exploring analytics solutions for XIV Dye Tools. Our primary goals are:

1. **Privacy-first**: No cookies, no fingerprinting, no personal data collection
2. **Cloudflare-native**: Leverage existing infrastructure where possible
3. **Actionable insights**: Track metrics that inform product decisions

---

## Documents

| Document | Purpose | Status |
|----------|---------|--------|
| [CLOUDFLARE_OPTIONS.md](./CLOUDFLARE_OPTIONS.md) | Compare Web Analytics, Analytics Engine, and Zaraz | Complete |
| [COUNTERSCALE.md](./COUNTERSCALE.md) | Self-hosted analytics deep-dive | Complete |
| [WEB_APP_METRICS.md](./WEB_APP_METRICS.md) | Define what to track and why | Complete |
| [IMPLEMENTATION_APPROACHES.md](./IMPLEMENTATION_APPROACHES.md) | Technical options with trade-offs | Complete |
| [PRIVACY_CONSIDERATIONS.md](./PRIVACY_CONSIDERATIONS.md) | Data ethics, GDPR, bias analysis | Complete |
| [PRIVACY_UPDATE_DRAFT.md](./PRIVACY_UPDATE_DRAFT.md) | Proposed updates to web app PRIVACY.md | Draft |

---

## Quick Reference

### What Cloudflare Offers (Free)

| Solution | Custom Events | Code Changes | Best For |
|----------|---------------|--------------|----------|
| **Web Analytics** | No | Minimal | Baseline traffic, Core Web Vitals |
| **Analytics Engine** | Yes | Worker code | Custom events, SQL queries |
| **Zaraz** | Yes | `zaraz.track()` | Rapid experimentation |

### Existing Infrastructure

- **Analytics Engine**: Already in use for Discord bot (`xivdyetools_bot_analytics` dataset)
- **KV Storage**: Rate limiting, preferences across workers
- **D1 Database**: Presets, user data
- **Web App Events**: `dye-selected`, `selection-changed`, `sort-changed` already emitted

### Key Metrics to Track

| Category | Metric | Default Consideration |
|----------|--------|----------------------|
| Tool Usage | Active tool | Harmony Explorer is default landing |
| Dyes | Clicked dyes | N/A |
| Themes | Selected theme | Premium Dark is default |
| Regional | Geography + language | Browser defaults apply |
| Journeys | Feature discovery | Favorites panel, config sidebar |

### Key Recommendation: Index Landing Page

To eliminate default bias on tool usage metrics, introduce an index landing page:
- Users select a tool via the tool selector bar instead of landing on Harmony
- Every tool view becomes intentional—no passive landing inflation
- See [WEB_APP_METRICS.md](./WEB_APP_METRICS.md#1-tool-usage) for details

---

## Decision Status

| Decision | Status | Resolution |
|----------|--------|------------|
| Third-party tools (GA4, Mixpanel) | **Decided: No** | Conflict with privacy-first approach |
| SQL querying needed? | **Decided: Yes** | For CSV export capability |
| Custom dashboards needed? | **Decided: No** | Exportable data + spreadsheets sufficient |
| Discord bot consistency | **Decided: No** | Bot uses v3 naming, start fresh |
| Primary analytics platform | **Decided** | Cloudflare (Web Analytics + Analytics Engine) |
| Self-hosted vs managed | **Decided: Managed** | Counterscale adds maintenance without benefit |
| Implementation approach | **Decided: Approach B** | Web Analytics + Analytics Engine |
| Metrics to track (Phase 1) | **Decided** | Tool usage + time, dye selections, themes, geography |
| Dye tracking granularity | **Decided: Both** | Individual dye IDs + category aggregation |
| Time-based metrics | **Decided: Yes** | Track time spent on each tool |
| Search query tracking | **Decided: No** | Privacy concern; track usage only, not queries |
| Aggregation frequency | **Decided: Daily** | Batch export via CSV sufficient |
| Privacy policy updates | **Decided** | Update existing PRIVACY.md + About modal |
| Opt-out functionality | **Decided: Yes** | localStorage flag, exceeds legal requirements |
| EU/GDPR handling | **Decided: None needed** | No PII, no cookies = no consent required |

---

## Related Documentation

- [Architecture Overview](../architecture/ECOSYSTEM.md)
- [Web App Project](../projects/xivdyetools-web-app.md)
- [Discord Worker Analytics](../projects/xivdyetools-discord-worker.md)

---

## Next Steps

1. Review each document and mark decisions
2. Prioritize metrics for Phase 1 implementation
3. Select implementation approach
4. Update privacy policy if needed
5. Create implementation tickets
