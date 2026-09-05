# Privacy Considerations

**Status**: Draft
**Date**: January 15, 2026
**Context**: Data ethics, compliance, and transparency guidelines for XIV Dye Tools analytics

---

## Overview

This document establishes our privacy principles, addresses compliance considerations, analyzes potential biases in our data, and outlines transparency recommendations for users.

---

## Core Privacy Principles

### 1. No Personal Data Collection

We do not collect, store, or process personal data. Specifically:

| Data Type | Collected? | Notes |
|-----------|------------|-------|
| Names | No | Never requested |
| Email addresses | No | Never requested |
| IP addresses | No | Not logged or stored |
| User accounts | No | App works without login |
| Device fingerprints | No | Explicitly avoided |
| Cookies | No | None used for analytics |
| localStorage | No | Not used for tracking |

### 2. Aggregate-Only Analysis

All analytics focus on aggregate patterns, not individual behavior:

| Allowed | Not Allowed |
|---------|-------------|
| "500 users viewed Harmony Explorer" | "User X viewed Harmony Explorer 5 times" |
| "Snow White is the most clicked dye" | "User X clicked Snow White 3 times" |
| "30% of traffic from Japan" | "This visitor is from Tokyo" |

### 3. Privacy by Design

Our analytics approach is built on Cloudflare's privacy-first foundations:

> "Being privacy-first means we don't track individual users for the purposes of serving analytics. We don't use any client-side state (like cookies or localStorage) for analytics purposes. Cloudflare also doesn't track users over time via their IP address, User Agent string, or any other immutable attributes."
>
> — Cloudflare Privacy-First Web Analytics

---

## How "Visits" Work (No Unique Users)

Traditional analytics track "unique users" via cookies or fingerprinting. Cloudflare Web Analytics uses a privacy-preserving alternative:

### Traditional Approach (Invasive)
```
User visits → Cookie set → Same cookie seen later → "Returning user"
```

### Cloudflare Approach (Privacy-First)
```
Page load from referrer A → 1 visit
Page load from referrer A → still 1 visit (same referrer)
Page load from referrer B → 2 visits (new referrer)
```

**What this means**:
- We cannot identify returning visitors
- We cannot track user journeys across sessions
- We cannot build user profiles
- We CAN understand traffic patterns and feature popularity

---

## Compliance Considerations

### GDPR (European Union)

| Requirement | Our Status |
|-------------|------------|
| Lawful basis for processing | Legitimate interest (no personal data) |
| Data minimization | Yes - aggregate only |
| Purpose limitation | Yes - product improvement only |
| Storage limitation | 90 days max |
| Right to access | N/A - no personal data to access |
| Right to erasure | N/A - no personal data to erase |
| Cookie consent | Not required - no cookies |

**Assessment**: Cloudflare's privacy-first approach likely exempts us from GDPR consent requirements, as we don't process personal data.

### CCPA (California)

| Requirement | Our Status |
|-------------|------------|
| "Do Not Sell" | N/A - no data sold |
| Right to know | N/A - no personal data |
| Right to delete | N/A - no personal data |
| Non-discrimination | N/A - no data-based decisions |

**Assessment**: CCPA's definition of "personal information" requires data that can identify an individual. Our aggregate analytics do not meet this threshold.

### ePrivacy Directive (Cookie Law)

| Requirement | Our Status |
|-------------|------------|
| Cookie consent | Not required - no cookies |
| Tracking consent | Not required - no tracking |

**Assessment**: By design, we avoid the need for cookie consent banners.

### Important Caveat

This is not legal advice. If you have concerns about specific jurisdictions, consult with a legal professional familiar with data protection law.

---

## Default Bias Analysis

Several metrics will be artificially inflated due to default settings. Understanding these biases is crucial for accurate data interpretation.

### Tool Usage Bias

| Tool | Default? | Expected Bias |
|------|----------|---------------|
| **Harmony Explorer** | Yes (landing page) | **Highly inflated** |
| All other tools | No | Accurate representation |

**Problem**: Every visitor lands on Harmony Explorer, so its view count includes:
- Users who actively chose Harmony
- Users who left immediately
- Users who navigated to other tools

**Recommended Solution: Index Landing Page**

Introduce a tool selection landing page instead of defaulting to Harmony Explorer:
- Users arrive at an index page prompting tool selection via the tool selector bar
- Every tool view becomes an intentional choice
- Eliminates bias at the source—no normalization needed

See [WEB_APP_METRICS.md](./WEB_APP_METRICS.md#1-tool-usage) for full details.

**Alternative Normalization Strategies** (if keeping current behavior):

1. **Track source separately**:
   ```javascript
   // Distinguish landing vs navigation
   {
     event: "tool_view",
     tool: "harmony",
     source: "landing"    // vs "navigation"
   }
   ```

2. **Compare "sticky" sessions**:
   - Count users who stayed on Harmony > 30 seconds
   - Compare to other tools with same threshold

3. **Track tool switches**:
   - More meaningful: "How many left Harmony for another tool?"
   - This shows active choice, not passive landing

### Theme Usage Bias

| Theme | Default? | Expected Bias |
|-------|----------|---------------|
| **Premium Dark** | Yes | **Highly inflated** |
| All other themes | No | Accurate representation |

**Problem**: Premium Dark usage includes:
- Users who actively prefer it
- Users who never noticed theme options
- Users who haven't explored settings

**Normalization Strategies**:

1. **Track theme changes, not current theme**:
   ```javascript
   // More meaningful than "current theme"
   {
     event: "theme_changed",
     from_theme: "premium-dark",
     to_theme: "cotton-candy"
   }
   ```

2. **Calculate "change away" rate**:
   - What % of sessions include a theme change?
   - Of those, what themes do people change TO?

3. **Track theme modal opens**:
   - Indicates user considered changing
   - Even if they kept Premium Dark

### Language Bias

| Language | Default? | Expected Bias |
|----------|----------|---------------|
| **Browser default / English** | Yes | Inflated |
| All explicit selections | No | More accurate |

**Normalization Strategies**:

1. **Compare browser language to app language**:
   - If browser=ja and app=en, user actively chose English
   - If browser=en and app=en, might be passive default

2. **Track language changes**:
   - More meaningful than current setting

---

## What We Explicitly Do NOT Collect

To be transparent with users, we should clearly state what is NOT tracked:

### Never Collected

| Data | Why Not |
|------|---------|
| Your dye palettes/combinations | Private creative choices |
| Your favorite dyes list | Personal preference data |
| Session reconstructions | Would require user tracking |
| Behavior sequences | Would require identity persistence |
| Search history | Could reveal personal intent |
| Time-based patterns | Could fingerprint schedules |
| Cross-site behavior | We only see our own site |

### Technical Safeguards

| Safeguard | How It Protects |
|-----------|-----------------|
| No cookies | Cannot persist identity |
| No localStorage for analytics | Cannot persist identity |
| No IP logging | Cannot geolocate precisely |
| No user agent fingerprinting | Cannot identify browser |
| Aggregate-only queries | Cannot isolate individuals |

---

## Data Retention

| Solution | Retention Period |
|----------|------------------|
| Cloudflare Web Analytics | Rolling window (recent data) |
| Analytics Engine | 90 days maximum |
| Counterscale (if used) | 90 days (extendable with R2) |

**Implication**: Historical data beyond 90 days is not available. This is a feature, not a bug—it limits long-term profiling potential.

---

## Transparency Recommendations

### Option 1: Minimal (Passive Transparency)

Add to existing privacy/about section:

> "XIV Dye Tools uses Cloudflare Web Analytics to understand how people use our tools. This analytics service is privacy-first: it doesn't use cookies, doesn't track individual users, and doesn't collect personal information. We only see aggregate statistics like 'how many people used each tool this week.'"

**Effort**: 5 minutes (text update)

### Option 2: Moderate (Active Transparency)

Create a dedicated "Privacy" or "About Data" page:

```
/privacy

What We Collect
- Aggregate page views (how many times tools are viewed)
- General geographic regions (country-level only)
- Device categories (desktop, mobile, tablet)
- Performance metrics (page load times)

What We Don't Collect
- Your identity or account information
- Your dye palettes or combinations
- Your browsing history
- Any cookies or tracking identifiers

How This Helps
- Understanding which tools are most useful
- Improving performance for different devices
- Prioritizing features people actually use
```

**Effort**: 1-2 hours (new page)

### Option 3: Maximum (Opt-Out Support)

Provide an explicit opt-out mechanism:

```javascript
// Check for opt-out preference
if (!localStorage.getItem('analytics-opt-out')) {
  analytics.track('tool_view', { tool: toolId });
}
```

With UI toggle in settings:

```
Settings > Privacy
[ ] Help improve XIV Dye Tools by sharing anonymous usage data
    Learn more about what we collect
```

**Effort**: 4-6 hours (UI + logic)

### Recommendation

Start with **Option 2** (moderate transparency). It:
- Clearly communicates our privacy stance
- Builds trust with privacy-conscious users
- Doesn't require code changes
- Is proportionate to our data collection

Consider **Option 3** (opt-out) only if users request it or if we expand to more granular tracking.

---

## Third-Party Data Sharing

### Current State: None

We do not share analytics data with third parties. All data stays within Cloudflare's infrastructure.

### If Third-Party Integration Considered

If we ever integrate tools like Google Analytics 4, Mixpanel, etc., we would need to:

1. Update privacy documentation
2. Consider consent requirements
3. Evaluate GDPR implications
4. Communicate changes to users

**Recommendation**: Avoid third-party analytics integrations to maintain our privacy-first stance.

---

## FFXIV-Specific Considerations

### No In-Game Data

XIV Dye Tools does not collect:
- Character names
- Server/world information
- In-game activities
- FFXIV account data

The app works entirely with local browser data and public game information (dye names, colors, prices from Universalis API).

### Universalis API Usage

When fetching market prices, we query Universalis (community market API). This is:
- Third-party service with its own privacy policy
- Used for price data only, not user tracking
- No user identifier sent in requests

---

## Open Questions (Resolved)

1. **Should we implement opt-out functionality proactively?**
   - **Decision: Yes** — Provide opt-out toggle in settings
   - Goes above legal requirements but builds user trust
   - Implementation: Check localStorage flag before sending analytics events

2. **Is a dedicated privacy page warranted for our user base?**
   - **Decision: Update existing** — [PRIVACY.md](../../xivdyetools-web-app/docs/PRIVACY.md) already exists
   - Add new "Analytics" section to existing document
   - Maintain single source of truth

3. **Should we document analytics in the About modal?**
   - **Decision: Yes** — Be transparent in the UI
   - Brief mention with link to full privacy page
   - Example: "We collect anonymous usage statistics to improve tools. [Learn more]"

4. **Do we need region-specific considerations (EU visitors)?**
   - **Decision: No special handling needed**
   - No cookies → ePrivacy consent not required
   - No PII → GDPR consent likely not required
   - Aggregate-only data doesn't constitute "personal data"
   - Opt-out feature exceeds legal requirements

---

## Priority Assessment

| Task | Value | Effort | Priority |
|------|-------|--------|----------|
| Add transparency text | High | Low | **P0** |
| Create privacy page | Medium | Medium | **P1** |
| Implement opt-out | Low | Medium | **P2** |
| Legal review | Medium | High | **P2** |

---

## Next Steps

- [ ] Draft transparency text for about/settings
- [ ] Decide on privacy page creation
- [ ] Document analytics in CLAUDE.md
- [ ] Review with team before implementation

---

## References

- [Cloudflare Privacy-First Analytics Blog](https://blog.cloudflare.com/free-privacy-first-analytics-for-a-better-web/)
- [GDPR Official Text](https://gdpr.eu/)
- [CCPA Overview](https://oag.ca.gov/privacy/ccpa)
- [ePrivacy Directive](https://digital-strategy.ec.europa.eu/en/policies/eprivacy-directive)
