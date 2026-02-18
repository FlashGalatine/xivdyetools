# Cloudflare Analytics Options

**Status**: Draft
**Date**: January 15, 2026
**Context**: Evaluating Cloudflare's native analytics solutions for xivdyetools-web-app

---

## Overview

Cloudflare offers three analytics solutions that align with our privacy-first requirements. This document compares them in detail to inform our analytics strategy.

---

## A. Cloudflare Web Analytics

### What It Is

A free, privacy-first analytics service that tracks website performance and visitor patterns without using cookies or collecting personal data.

### What It Tracks (Out-of-Box)

| Metric | Description |
|--------|-------------|
| **Page Views** | Total page loads |
| **Visits** | Sessions from different referrers (not unique users) |
| **Country** | Visitor geography |
| **Device Type** | Desktop, mobile, tablet |
| **Browser** | Chrome, Safari, Firefox, etc. |
| **Operating System** | Windows, macOS, iOS, Android, etc. |
| **Referrers** | External traffic sources |
| **Core Web Vitals** | LCP, FID, CLS performance metrics |
| **Path** | Pages visited within the site |

### How "Visits" Work

Cloudflare counts visits differently than traditional analytics:

> Rather than count unique IP addresses (which requires storing state), they count page views that come from a different referrer. This provides a usable metric without compromising privacy.

**Implication**: If a user visits 5 pages in one session, that's 5 page views but only 1 visit. If they return later from a different referrer, that's a new visit.

### Setup Options

**Option 1: Automatic (Cloudflare Pages)**
```
Dashboard > Workers & Pages > [Project] > Metrics > Enable Web Analytics
```
- Zero code changes
- Enabled by default for new free domains (as of October 2025)

**Option 2: JavaScript Snippet**
```html
<!-- Add before </body> -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js'
        data-cf-beacon='{"token": "YOUR_TOKEN"}'></script>
```

### SPA Support

Web Analytics supports Single Page Applications (critical for xivdyetools):

- Automatically tracks route changes via History API
- No additional configuration needed for client-side navigation
- Works with Lit-based routing in our app

### Limitations

| Limitation | Impact |
|------------|--------|
| No custom events | Cannot track tool usage, dye clicks, theme changes |
| No user-defined dimensions | Cannot segment by custom attributes |
| Limited data retention | Dashboard shows recent data only |
| No SQL/API access | Cannot export or query programmatically |

### Privacy Guarantees

- No cookies
- No localStorage
- No fingerprinting
- No IP address tracking
- No cross-site tracking

### Cost

**Free** for all Cloudflare accounts.

---

## B. Cloudflare Analytics Engine

### What It Is

A time-series analytics database built into Cloudflare Workers, allowing custom event tracking with SQL querying capabilities.

### How It Works

```
                    ┌─────────────────┐
   Event Trigger    │   Worker Code   │
        │           │  writeDataPoint │
        ▼           └────────┬────────┘
   ┌─────────┐               │
   │ Browser │──HTTP POST───▶│
   └─────────┘               ▼
                    ┌─────────────────┐
                    │ Analytics Engine│
                    │    Dataset      │
                    └────────┬────────┘
                             │
                    SQL API ◀┘
```

### Data Model

Each data point can contain:

| Field Type | Max Count | Use Case |
|------------|-----------|----------|
| **Blobs** (strings) | 20 | Event names, IDs, categories |
| **Doubles** (numbers) | 20 | Counts, latencies, values |
| **Indexes** | 1 | Primary grouping key (queryable) |

### Example: Tracking Tool Usage

```typescript
// In a Worker handling analytics events
env.ANALYTICS.writeDataPoint({
  blobs: ['tool_view', 'harmony', 'premium-dark'],  // event, tool, theme
  doubles: [1, 250],  // count, latency_ms
  indexes: ['tool_view']  // primary index for queries
});
```

### Querying with SQL

```sql
SELECT
  blob2 AS tool_name,
  SUM(double1) AS view_count
FROM xivdyetools_web_analytics
WHERE timestamp > NOW() - INTERVAL '7' DAY
  AND index1 = 'tool_view'
GROUP BY blob2
ORDER BY view_count DESC
```

### Existing Usage: Discord Bot

We already use Analytics Engine for the Discord bot:

**Dataset**: `xivdyetools_bot_analytics`

**Current tracking**:
- Command execution counts
- Success/failure rates
- Per-command latencies
- Daily unique users (via KV fallback)

**Implementation**: [xivdyetools-discord-worker/src/services/analytics.ts](../projects/xivdyetools-discord-worker.md)

### Extending to Web App

To track web app events, we could:

1. Create new dataset: `xivdyetools_web_analytics`
2. Create lightweight Worker endpoint: `POST /api/analytics`
3. Send events from client via `fetch()`
4. Query via SQL API for dashboards

### Limitations

| Limitation | Impact |
|------------|--------|
| 90-day retention | Historical analysis limited |
| Requires Worker code | More implementation effort |
| No built-in dashboard | Must build or use Grafana |
| Write-only from Workers | Cannot write from browser directly |

### Cost

**Free tier** includes:
- 100,000 data points per day
- 10,000 SQL queries per day

Sufficient for moderate traffic sites.

---

## C. Cloudflare Zaraz

### What It Is

A tag manager that runs at the edge, allowing custom event tracking without client-side JavaScript libraries.

### How It Works

```javascript
// In browser JavaScript
zaraz.track("dye_selected", {
  dye_id: "snow-white",
  dye_category: "white",
  tool: "harmony"
});
```

Events are:
1. Captured by Zaraz's client-side script
2. Sent to Cloudflare's edge
3. Forwarded to configured destinations

### API Syntax

```javascript
zaraz.track(eventName: string, properties?: object)
```

- **eventName**: Identifier for the event type
- **properties**: Flat object of key-value pairs (no nested objects)
- **Returns**: Promise (can be awaited)

### Example Events for XIV Dye Tools

```javascript
// Tool navigation
zaraz.track("tool_changed", {
  from_tool: "harmony",
  to_tool: "extractor"
});

// Dye selection
zaraz.track("dye_selected", {
  dye_id: "soot-black",
  dye_category: "black",
  source: "grid"  // or "favorites", "search"
});

// Theme change
zaraz.track("theme_changed", {
  from_theme: "premium-dark",
  to_theme: "cotton-candy"
});

// Feature discovery
zaraz.track("feature_used", {
  feature: "favorites_panel",
  action: "expand"
});
```

### Configuration

Events need triggers configured in the Cloudflare dashboard:

```
Dashboard > Zaraz > Triggers
  └── Create trigger matching event name
      └── Create action (what to do with event)
```

### Destinations

Zaraz can forward events to:
- Cloudflare Analytics (built-in)
- Google Analytics 4
- Facebook Pixel
- Custom webhooks
- And 40+ other integrations

### Zaraz vs Analytics Engine

| Aspect | Zaraz | Analytics Engine |
|--------|-------|------------------|
| **Code location** | Browser | Worker |
| **Setup** | Dashboard + simple JS | Worker code |
| **Querying** | Dashboard only | SQL API |
| **Flexibility** | Structured triggers | Full custom logic |
| **Third-party** | Many integrations | Must build |
| **Learning curve** | Lower | Higher |

### Limitations

| Limitation | Impact |
|------------|--------|
| Dashboard-configured triggers | Less flexible than code |
| Flat properties only | No nested event data |
| Limited querying | No SQL access |
| Requires Zaraz enablement | Additional setup step |

### Cost

**Free tier** includes:
- Unlimited events
- Core integrations

---

## Comparison Matrix

### Feature Comparison

| Feature | Web Analytics | Analytics Engine | Zaraz |
|---------|--------------|------------------|-------|
| Custom events | No | Yes | Yes |
| Code changes | Minimal | Worker code | Browser JS |
| SQL querying | No | Yes | No |
| Built-in dashboard | Yes | No | Yes |
| Third-party integrations | No | No | Yes |
| SPA support | Yes | N/A | Yes |
| Real-time data | Yes | Yes | Yes |

### Privacy Comparison

| Privacy Aspect | Web Analytics | Analytics Engine | Zaraz |
|----------------|--------------|------------------|-------|
| Cookies | None | None | None |
| Fingerprinting | None | None | None |
| IP tracking | None | Your choice | Configurable |
| Data location | Cloudflare | Cloudflare | Cloudflare |

### Effort Comparison

| Task | Web Analytics | Analytics Engine | Zaraz |
|------|--------------|------------------|-------|
| Initial setup | 5 minutes | 2-4 hours | 1-2 hours |
| Adding new event | N/A | Code change | Dashboard + code |
| Querying data | Dashboard | SQL API | Dashboard |
| Building reports | Manual | Automated possible | Manual |

---

## Recommendations

### For Baseline Traffic Data

Use **Web Analytics**:
- Enable via dashboard (zero code)
- Get page views, geography, devices, Core Web Vitals
- Understand traffic patterns immediately

### For Custom Event Tracking

Consider **Analytics Engine** if:
- You want SQL querying capability
- You need to build custom dashboards
- You want consistency with Discord bot analytics

Consider **Zaraz** if:
- You want faster experimentation
- You may integrate third-party tools later
- You prefer dashboard configuration over code

### Hybrid Approach

A pragmatic approach combines multiple solutions:

1. **Web Analytics** for baseline metrics (traffic, devices, geography)
2. **Analytics Engine** for high-value custom events (tool usage, key interactions)
3. **Zaraz** for experimental tracking during product exploration

---

## Open Questions (Resolved)

1. **Do we need SQL querying capabilities, or is dashboard sufficient?**
   - **Decision**: SQL is valuable for CSV export capability
   - The key requirement is exportable data, not real-time dashboards
   - Analytics Engine provides SQL → can export to CSV for spreadsheet analysis

2. **Will we integrate with any third-party analytics tools (GA4, Mixpanel)?**
   - **Decision**: No - these conflict with privacy-first principles
   - GA4: Free but uses cookies, tracks users across sites
   - Mixpanel: Free up to 1M events, but tracks individual users
   - Both answer "what did User X do?" vs our goal of aggregate patterns
   - Cloudflare tools align better with privacy stance

3. **How important is building custom dashboards vs using Cloudflare's?**
   - **Decision**: Not important - exportable data (CSV) is the priority
   - Can use spreadsheets for custom analysis
   - Cloudflare's built-in dashboards sufficient for quick views

4. **Do we want event tracking consistency with Discord bot (Analytics Engine)?**
   - **Decision**: No - Discord bot uses v3 naming schemes/algorithms
   - Web app will use fresh event naming
   - Can unify later if Discord bot is updated to v4

---

## References

- [Cloudflare Web Analytics Documentation](https://developers.cloudflare.com/web-analytics/)
- [Analytics Engine Documentation](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Zaraz track() API](https://developers.cloudflare.com/zaraz/web-api/track/)
- [Privacy-First Web Analytics Blog](https://blog.cloudflare.com/free-privacy-first-analytics-for-a-better-web/)
