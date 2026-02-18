# Implementation Approaches

**Status**: Draft
**Date**: January 15, 2026
**Context**: Technical options for implementing analytics in xivdyetools-web-app

---

## Overview

This document outlines five distinct approaches to implementing analytics, ranging from zero-code to fully custom solutions. Each approach has different trade-offs in terms of effort, capabilities, and maintenance burden.

---

## Approach A: Web Analytics Only

### Description

Enable Cloudflare Web Analytics with no code changes. Get baseline traffic metrics immediately.

### Architecture

```
┌─────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│   Browser   │───▶│ Cloudflare Beacon   │───▶│  Web Analytics   │
│             │    │ (auto-injected)     │    │    Dashboard     │
└─────────────┘    └─────────────────────┘    └──────────────────┘
```

### What You Get

| Metric | Available |
|--------|-----------|
| Page views | Yes |
| Visits | Yes |
| Countries | Yes |
| Devices/Browsers | Yes |
| Core Web Vitals | Yes |
| Referrers | Yes |
| **Custom events** | **No** |

### Implementation

**Step 1**: Enable in Cloudflare Dashboard
```
Workers & Pages > xivdyetools-web-app > Metrics > Enable Web Analytics
```

**Step 2**: Done.

### Effort Estimate

| Task | Time |
|------|------|
| Enable Web Analytics | 5 minutes |
| **Total** | **5 minutes** |

### Pros

- Zero code changes
- No maintenance
- Immediate insights
- Privacy-compliant by default

### Cons

- No custom events (tool usage, dye clicks, themes)
- Limited segmentation
- No SQL access

### Best For

- Quick win for baseline metrics
- Understanding traffic patterns
- Performance monitoring (Core Web Vitals)

---

## Approach B: Web Analytics + Analytics Engine

### Description

Combine Web Analytics for baseline metrics with Analytics Engine for custom event tracking. Leverages existing Discord bot infrastructure patterns.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
├─────────────────────────────────────────────────────────────────┤
│                              │                                   │
│    Page Load                 │    User Actions                   │
│        │                     │        │                          │
│        ▼                     │        ▼                          │
│  ┌───────────┐               │  ┌───────────┐                    │
│  │ CF Beacon │               │  │ fetch()   │                    │
│  └─────┬─────┘               │  └─────┬─────┘                    │
│        │                     │        │                          │
└────────┼─────────────────────┼────────┼──────────────────────────┘
         │                     │        │
         ▼                     │        ▼
┌─────────────────┐            │  ┌─────────────────┐
│  Web Analytics  │            │  │ Analytics Worker │
│   (Dashboard)   │            │  │  POST /events    │
└─────────────────┘            │  └────────┬────────┘
                               │           │
                               │           ▼
                               │  ┌─────────────────┐
                               │  │ Analytics Engine │
                               │  │    Dataset       │
                               │  └────────┬────────┘
                               │           │
                               │    SQL API ◀
                               │
```

### What You Get

| Metric | Source |
|--------|--------|
| Page views, visits | Web Analytics |
| Countries, devices | Web Analytics |
| Core Web Vitals | Web Analytics |
| Tool usage | Analytics Engine |
| Dye selections | Analytics Engine |
| Theme changes | Analytics Engine |
| Custom queries | SQL API |

### Implementation

**Step 1**: Create Analytics Worker

Create a new file: `xivdyetools-analytics-worker/`

```typescript
// src/index.ts
export interface Env {
  ANALYTICS: AnalyticsEngineDataset;
}

interface AnalyticsEvent {
  event: string;
  properties: Record<string, string | number>;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const { event, properties } = await request.json() as AnalyticsEvent;

    // Write to Analytics Engine
    env.ANALYTICS.writeDataPoint({
      blobs: [
        event,
        properties.tool || '',
        properties.dye_id || '',
        properties.theme || '',
      ],
      doubles: [1],  // count
      indexes: [event],
    });

    return new Response('OK', {
      headers: {
        'Access-Control-Allow-Origin': 'https://xivdyetools.com',
        'Access-Control-Allow-Methods': 'POST',
      },
    });
  },
};
```

**Step 2**: Create wrangler.toml

```toml
name = "xivdyetools-analytics"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[analytics_engine_datasets]]
binding = "ANALYTICS"
dataset = "xivdyetools_web_analytics"

[env.production]
routes = [
  { pattern = "analytics.xivdyetools.projectgalatine.com", custom_domain = true }
]
```

**Step 3**: Add client-side tracking

```typescript
// In web app: src/services/analytics-service.ts
class AnalyticsService {
  private endpoint = 'https://analytics.xivdyetools.projectgalatine.com';

  async track(event: string, properties: Record<string, string | number> = {}) {
    try {
      await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, properties }),
      });
    } catch {
      // Fail silently - analytics should never break the app
    }
  }
}

export const analytics = new AnalyticsService();
```

**Step 4**: Instrument key events

```typescript
// In router-service.ts (tool changes)
analytics.track('tool_view', { tool: toolId, source: 'navigation' });

// In dye-selector.ts (dye selections)
analytics.track('dye_selected', { dye_id: dye.id, category: dye.category });

// In theme-service.ts (theme changes)
analytics.track('theme_changed', { from_theme: old, to_theme: new });
```

### Effort Estimate

| Task | Time |
|------|------|
| Create Analytics Worker | 2-3 hours |
| Deploy and configure | 30 minutes |
| Create AnalyticsService | 1 hour |
| Instrument Phase 1 events | 2-3 hours |
| Testing | 1-2 hours |
| **Total** | **7-10 hours** |

### Pros

- Full control over custom events
- SQL querying for complex analysis
- Consistent with Discord bot approach
- Can build custom dashboards

### Cons

- More implementation effort
- Requires Worker maintenance
- No built-in dashboard (must build or use Grafana)

### Best For

- Teams comfortable with Workers
- Need for custom event tracking
- Want SQL access for analysis
- Building custom dashboards

---

## Approach C: Web Analytics + Zaraz

### Description

Combine Web Analytics for baseline metrics with Zaraz for custom event tracking via the browser.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
├─────────────────────────────────────────────────────────────────┤
│                              │                                   │
│    Page Load                 │    User Actions                   │
│        │                     │        │                          │
│        ▼                     │        ▼                          │
│  ┌───────────┐               │  ┌─────────────┐                  │
│  │ CF Beacon │               │  │ zaraz.track │                  │
│  └─────┬─────┘               │  └──────┬──────┘                  │
│        │                     │         │                         │
└────────┼─────────────────────┼─────────┼─────────────────────────┘
         │                     │         │
         ▼                     │         ▼
┌─────────────────┐            │  ┌─────────────────┐
│  Web Analytics  │            │  │  Zaraz (Edge)   │
│   Dashboard     │            │  │   Processing    │
└─────────────────┘            │  └────────┬────────┘
                               │           │
                               │           ▼
                               │  ┌─────────────────┐
                               │  │ Configured      │
                               │  │ Destinations    │
                               │  └─────────────────┘
```

### What You Get

| Metric | Source |
|--------|--------|
| Page views, visits | Web Analytics |
| Countries, devices | Web Analytics |
| Core Web Vitals | Web Analytics |
| Tool usage | Zaraz |
| Dye selections | Zaraz |
| Theme changes | Zaraz |
| Third-party integrations | Zaraz |

### Implementation

**Step 1**: Enable Zaraz
```
Dashboard > Websites > xivdyetools.com > Zaraz > Enable
```

**Step 2**: Create triggers in Zaraz dashboard

For each event type:
1. Create trigger matching event name
2. Configure action (Cloudflare Analytics, or external)

**Step 3**: Add client-side tracking

```typescript
// In web app: src/services/analytics-service.ts
declare global {
  interface Window {
    zaraz?: {
      track: (event: string, properties?: Record<string, string | number>) => Promise<void>;
    };
  }
}

class AnalyticsService {
  async track(event: string, properties: Record<string, string | number> = {}) {
    if (window.zaraz) {
      await window.zaraz.track(event, properties);
    }
  }
}

export const analytics = new AnalyticsService();
```

**Step 4**: Instrument events (same as Approach B)

### Effort Estimate

| Task | Time |
|------|------|
| Enable Zaraz | 10 minutes |
| Create triggers | 1-2 hours |
| Create AnalyticsService | 30 minutes |
| Instrument Phase 1 events | 2-3 hours |
| Testing | 1 hour |
| **Total** | **5-7 hours** |

### Pros

- No Worker code to maintain
- Easy to add third-party integrations
- Dashboard-based configuration
- Faster iteration on events

### Cons

- Limited querying (no SQL)
- Trigger configuration can be tedious
- Less flexible than code-based approach

### Best For

- Teams preferring dashboard configuration
- May want third-party integrations later
- Faster initial implementation

---

## Approach D: Counterscale (Self-Hosted)

### Description

Deploy Counterscale for full data ownership. Replace all managed analytics with self-hosted solution.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   Your Cloudflare Account                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐    ┌────────────────┐    ┌──────────────────┐    │
│   │ Browser  │───▶│  Counterscale  │───▶│ Analytics Engine │    │
│   │ tracker  │    │    Worker      │    │    Dataset       │    │
│   └──────────┘    └────────────────┘    └──────────────────┘    │
│                          │                                       │
│                          ▼                                       │
│                   ┌────────────────┐                             │
│                   │  Counterscale  │                             │
│                   │   Dashboard    │                             │
│                   └────────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### What You Get

| Metric | Available |
|--------|-----------|
| Page views | Yes |
| Countries | Yes |
| Referrers | Yes |
| UTM params | Yes |
| Devices | Yes |
| **Custom events** | **No (without modification)** |

### Implementation

**Step 1**: Clone and deploy
```bash
git clone https://github.com/benvinegar/counterscale.git
cd counterscale
npm install
npx wrangler login
npm run deploy
```

**Step 2**: Add tracker to web app
```html
<script defer src="https://your-counterscale.workers.dev/tracker.js"
        data-site-id="xivdyetools"></script>
```

**Step 3**: (Optional) Configure password protection

**Step 4**: (Optional) Set up R2 for >90 day retention

### Effort Estimate

| Task | Time |
|------|------|
| Clone and deploy | 15 minutes |
| Configure | 30 minutes |
| Add tracker | 15 minutes |
| Testing | 30 minutes |
| R2 setup (optional) | 1-2 hours |
| **Total** | **1.5-3.5 hours** |

### Pros

- Full data ownership
- No third-party data sharing
- Near-zero cost
- Open source (auditable)

### Cons

- No custom events by default
- 90-day retention limit
- Basic dashboard
- Maintenance burden

### Best For

- Data sovereignty requirements
- Simple pageview analytics
- Maximum privacy guarantee

---

## Approach E: Hybrid (Recommended)

### Description

Combine multiple solutions for comprehensive coverage with manageable complexity.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Page Load          Tool/Dye Events        Experiments          │
│       │                    │                     │               │
│       ▼                    ▼                     ▼               │
│   CF Beacon           fetch() to           zaraz.track()         │
│       │              Analytics Worker           │                │
│       │                    │                    │                │
└───────┼────────────────────┼────────────────────┼────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐   ┌────────────────┐   ┌────────────────┐
│ Web Analytics │   │Analytics Engine│   │     Zaraz      │
│  (Baseline)   │   │ (Core Events)  │   │ (Experiments)  │
└───────────────┘   └────────────────┘   └────────────────┘
```

### Strategy

| Layer | Solution | Purpose |
|-------|----------|---------|
| **Baseline** | Web Analytics | Traffic, devices, geography, Core Web Vitals |
| **Core Events** | Analytics Engine | Tool usage, dye selections, themes (high-value, stable) |
| **Experiments** | Zaraz | New event experiments, third-party trials |

### What You Get

| Metric | Source |
|--------|--------|
| Page views, visits | Web Analytics |
| Countries, devices | Web Analytics |
| Core Web Vitals | Web Analytics |
| Tool usage | Analytics Engine |
| Dye selections | Analytics Engine |
| Theme changes | Analytics Engine |
| SQL queries | Analytics Engine |
| New experiments | Zaraz |
| Third-party trials | Zaraz |

### Implementation

**Phase 1** (Week 1):
1. Enable Web Analytics (5 min)
2. Deploy Analytics Worker (3-4 hours)
3. Instrument Phase 1 events (2-3 hours)

**Phase 2** (Week 2):
1. Enable Zaraz (10 min)
2. Set up experimental triggers (1-2 hours)
3. Instrument Phase 2 events (2-3 hours)

### Effort Estimate

| Phase | Tasks | Time |
|-------|-------|------|
| Phase 1 | Web Analytics + Analytics Engine | 6-8 hours |
| Phase 2 | Zaraz integration | 3-5 hours |
| **Total** | | **9-13 hours** |

### Pros

- Best of all worlds
- Gradual rollout
- SQL for core metrics
- Flexibility for experiments

### Cons

- More complex setup
- Multiple systems to monitor
- Higher initial investment

### Best For

- Teams wanting comprehensive analytics
- Need for both stability and flexibility
- Planning for future growth

---

## Comparison Summary

| Approach | Effort | Custom Events | SQL | Maintenance | Best For |
|----------|--------|---------------|-----|-------------|----------|
| A: Web Analytics Only | 5 min | No | No | None | Quick baseline |
| B: + Analytics Engine | 7-10 hrs | Yes | Yes | Medium | Custom queries |
| C: + Zaraz | 5-7 hrs | Yes | No | Low | Fast iteration |
| D: Counterscale | 1.5-3.5 hrs | No | No | Medium | Data sovereignty |
| E: Hybrid | 9-13 hrs | Yes | Yes | Medium | Comprehensive |

---

## Recommendation

Based on decisions made:
- **SQL querying needed**: Yes (for CSV export)
- **Third-party tools**: No (GA4/Mixpanel conflict with privacy-first)
- **Custom dashboards**: Not needed (CSV + spreadsheets sufficient)

### Recommended: Approach B (Web Analytics + Analytics Engine)

This approach best fits the requirements:

| Requirement | How Approach B Satisfies |
|-------------|-------------------------|
| SQL querying for export | Analytics Engine SQL API |
| Privacy-first | Cloudflare-only, no third-party |
| Custom events | Tool usage, dye clicks, themes |
| Baseline metrics | Web Analytics provides these free |
| Exportable data | SQL → CSV via Cloudflare dashboard or API |

**Why not other approaches**:
- **A (Web Analytics only)**: No custom events, no SQL
- **C (Zaraz)**: No SQL querying
- **D (Counterscale)**: More maintenance, no custom events by default
- **E (Hybrid)**: Zaraz layer adds complexity without benefit (no third-party integrations)

---

## Open Questions (Resolved)

1. ~~What's the team's comfort level with Worker development?~~ → N/A, Worker required for Analytics Engine
2. ~~Do we need SQL querying, or is dashboard sufficient?~~ → **Yes, SQL needed for CSV export**
3. ~~Will we integrate third-party analytics tools?~~ → **No, conflicts with privacy-first**
4. ~~How important is real-time vs batch analytics?~~ → **Batch (CSV export) is sufficient**

---

## Next Steps

- [x] Decision: Approach B (Web Analytics + Analytics Engine)
- [ ] Create Analytics Worker project (`xivdyetools-analytics-worker`)
- [ ] Define event schema for Phase 1 metrics
- [ ] Instrument web app with analytics calls
- [ ] Test CSV export via SQL API
- [ ] Enable Web Analytics in Cloudflare dashboard

---

## References

- [CLOUDFLARE_OPTIONS.md](./CLOUDFLARE_OPTIONS.md) - Platform capabilities
- [WEB_APP_METRICS.md](./WEB_APP_METRICS.md) - What to track
- [COUNTERSCALE.md](./COUNTERSCALE.md) - Self-hosted option
- [Discord Bot Analytics Implementation](../projects/xivdyetools-discord-worker.md)
