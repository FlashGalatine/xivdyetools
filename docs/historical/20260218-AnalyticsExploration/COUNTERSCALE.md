# Counterscale: Self-Hosted Analytics

**Status**: Draft
**Date**: January 15, 2026
**Context**: Evaluating Counterscale as a self-hosted alternative to managed analytics services

---

## Overview

Counterscale is an open-source web analytics platform that runs entirely on Cloudflare's infrastructure. It offers full data ownership with near-zero operating costs, making it an interesting alternative for privacy-conscious projects.

**Repository**: [github.com/benvinegar/counterscale](https://github.com/benvinegar/counterscale)

---

## What It Is

> "Counterscale is a simple web analytics tracker and dashboard that you self-host on Cloudflare."

Unlike managed services, you deploy Counterscale to your own Cloudflare account, giving you complete control over the data collected.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Your Cloudflare Account                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│   │   Browser    │───▶│   Worker     │───▶│  Analytics   │  │
│   │  (tracker)   │    │  (endpoint)  │    │   Engine     │  │
│   └──────────────┘    └──────────────┘    └──────────────┘  │
│                              │                    │          │
│                              ▼                    ▼          │
│                       ┌──────────────┐    ┌──────────────┐  │
│                       │  Dashboard   │    │  R2 Bucket   │  │
│                       │   (Worker)   │    │  (optional)  │  │
│                       └──────────────┘    └──────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Components

| Component | Cloudflare Service | Purpose |
|-----------|-------------------|---------|
| Tracker | JS snippet | Captures page views from visitors |
| Worker | Workers | Receives events, stores to Analytics Engine |
| Analytics Engine | Analytics Engine | Time-series data storage |
| Dashboard | Workers | Self-hosted analytics UI |
| Long-term Storage | R2 (optional) | Apache Arrow files for >90 day data |

---

## What It Tracks

### Default Metrics

| Metric | Description |
|--------|-------------|
| Page URL | Full page path visited |
| Referrer | Traffic source |
| UTM parameters | source, medium, campaign |
| Page views | Count of views |
| Country | Geographic location (from Cloudflare headers) |
| Device type | Desktop, mobile, tablet |
| Browser | User agent parsing |

### What It Does NOT Track

- User IDs or sessions
- IP addresses (not stored)
- Cookies (none used)
- Cross-site behavior

---

## Setup Process

### Prerequisites

- Node.js v20+
- Cloudflare account (free tier works)
- Wrangler CLI installed
- ~10-15 minutes

### Deployment Steps

```bash
# 1. Clone repository
git clone https://github.com/benvinegar/counterscale.git
cd counterscale

# 2. Install dependencies
npm install

# 3. Create API token
# Dashboard > My Profile > API Tokens > Create Token
# Use "Edit Cloudflare Workers" template

# 4. Configure wrangler
npx wrangler login

# 5. Deploy
npm run deploy

# 6. Get tracking snippet
# Dashboard will provide JS snippet after deployment
```

### Tracking Snippet

```html
<script
  defer
  src="https://your-counterscale.workers.dev/tracker.js"
  data-site-id="xivdyetools"
></script>
```

### Dashboard Access

- Default: Public (anyone with URL can view)
- Optional: Password protection via environment variable

---

## Data Retention

### Default: 90 Days

Analytics Engine has a **maximum 90-day retention** limit. This is a hard constraint of the underlying infrastructure.

### Extended Retention with R2

Counterscale supports writing data to R2 buckets in Apache Arrow format:

```
┌──────────────────┐
│ Analytics Engine │──(90 days max)
└────────┬─────────┘
         │
         ▼ (export job)
┌──────────────────┐
│    R2 Bucket     │──(unlimited retention)
│  (Arrow files)   │
└──────────────────┘
```

**Trade-offs**:
- R2 has storage costs (though minimal)
- Querying historical data requires separate tooling
- Not as seamless as managed solutions

---

## Cost Analysis

### Cloudflare Free Tier Limits

| Resource | Free Limit | Counterscale Usage |
|----------|------------|-------------------|
| Workers requests | 100K/day | Dashboard + tracker |
| Analytics Engine writes | 100K/day | One per pageview |
| Analytics Engine queries | 10K/day | Dashboard queries |
| R2 storage | 10GB | Historical data |
| R2 operations | 1M Class A, 10M Class B | Arrow writes/reads |

### Realistic Cost

For a site with **<100K daily pageviews**:

| Scenario | Cost |
|----------|------|
| Free tier usage | **$0/month** |
| Moderate traffic (100K-500K views) | ~$5-10/month |
| High traffic (500K+ views) | Variable, still low |

---

## Pros and Cons

### Advantages

| Advantage | Explanation |
|-----------|-------------|
| **Full data ownership** | Data never leaves your Cloudflare account |
| **No third-party sharing** | Complete privacy guarantee |
| **Near-zero cost** | Runs on free tier for most sites |
| **Open source** | Can audit, modify, extend |
| **Cloudflare ecosystem** | Consistent with existing infrastructure |
| **Simple deployment** | ~10-15 minute setup |

### Disadvantages

| Disadvantage | Explanation |
|--------------|-------------|
| **90-day retention** | Historical analysis limited without R2 |
| **Maintenance burden** | You own updates, security patches |
| **Basic features** | Less polished than commercial tools |
| **No custom events** | Tracks pageviews only by default |
| **Limited dashboard** | Basic compared to GA4, Mixpanel |
| **Debugging is on you** | No support team |

---

## Comparison with Managed Options

| Aspect | Counterscale | CF Web Analytics | CF Analytics Engine |
|--------|-------------|------------------|---------------------|
| Data ownership | Full | Cloudflare | Cloudflare |
| Custom events | No | No | Yes |
| Dashboard | Self-hosted | Cloudflare | Build your own |
| Retention | 90 days (+R2) | Limited | 90 days |
| Cost | Near-zero | Free | Free tier |
| Maintenance | You | Cloudflare | You (for queries) |
| Setup time | 15 min | 5 min | 2-4 hours |

---

## Suitability for XIV Dye Tools

### Fits Well If...

- Primary concern is data sovereignty
- Happy with pageview-level analytics
- Want to minimize external dependencies
- Comfortable with basic dashboard

### May Not Fit If...

- Need custom event tracking (tool usage, dye clicks)
- Want long-term historical analysis
- Prefer zero maintenance overhead
- Need advanced segmentation

### Recommendation

**Consider Counterscale as a supplement, not replacement:**

1. Use **Cloudflare Web Analytics** for baseline metrics (zero maintenance)
2. Use **Analytics Engine** for custom events (already proven with Discord bot)
3. Consider **Counterscale** if data sovereignty becomes a hard requirement

Counterscale shines when you need to guarantee data doesn't touch third-party services, but for practical custom event tracking, Analytics Engine offers more flexibility.

---

## Open Questions

1. Is 90-day retention sufficient for our analytics needs?
2. Do we have concerns about data being on Cloudflare's infrastructure?
3. Would we extend Counterscale to track custom events?
4. Who would maintain the deployment long-term?

---

## Priority Assessment

| Factor | Rating | Notes |
|--------|--------|-------|
| User Value | Medium | Provides insights, but so do other options |
| Effort | Medium | Simple setup, ongoing maintenance |
| Uniqueness | High | Only option with full data ownership |
| Risk | Low | Open source, can migrate away |

---

## Next Steps

If pursuing Counterscale:

- [ ] Test deployment in dev environment
- [ ] Evaluate dashboard functionality
- [ ] Assess R2 setup for extended retention
- [ ] Document maintenance procedures

---

## References

- [Counterscale GitHub Repository](https://github.com/benvinegar/counterscale)
- [Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)
- [Apache Arrow Format](https://arrow.apache.org/)
