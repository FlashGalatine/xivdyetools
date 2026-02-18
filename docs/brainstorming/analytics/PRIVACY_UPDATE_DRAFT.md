# Proposed PRIVACY.md Updates

**Status**: Draft for Review
**Date**: January 15, 2026
**Context**: Proposed additions to [xivdyetools-web-app/docs/PRIVACY.md](../../xivdyetools-web-app/docs/PRIVACY.md) for analytics transparency

---

## Overview

This document contains proposed text to add to the existing PRIVACY.md file when analytics are implemented. The goal is to maintain transparency while keeping the privacy-first tone of the existing document.

---

## Proposed New Section: Analytics

Add this section after "Network Access" in the existing PRIVACY.md:

```markdown
## Analytics

To improve XIV Dye Tools, we collect anonymous usage statistics. This helps us understand which tools are most useful and how we can make them better.

### What We Collect

- **Tool usage**: Which tools are viewed and for how long
- **Dye interactions**: Which dyes are clicked (aggregate counts, not your specific palettes)
- **Theme preferences**: Which themes are selected
- **Geographic region**: Country-level only (no city or precise location)

### What We Do NOT Collect

- Your identity or any account information
- Your specific dye palettes or combinations
- Search queries you type
- Cookies or tracking identifiers
- Any data that could identify you personally

### How It Works

We use [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) and Cloudflare Analytics Engine:
- **No cookies** are used
- **No fingerprinting** or device identification
- Data is **aggregated**, not tied to individuals
- We count "visits" (page loads from different sources), not unique users

Our analytics code is fully open source: [View on GitHub](https://github.com/FlashGalatine/xivdyetools-analytics-worker)

### Opt Out

If you prefer not to contribute anonymous usage data, you can disable analytics:

1. Open Settings (gear icon)
2. Toggle "Help improve XIV Dye Tools" to OFF

Your choice is saved locally and respected immediately.

### Data Retention

Analytics data is retained for up to 90 days, after which it is automatically deleted.
```

---

## Proposed About Modal Text

Brief mention for the About modal (links to full privacy page and source code):

```
We collect anonymous usage statistics to help improve the tools.
No cookies, no tracking, no personal data.

[Privacy Details] | [View Source Code] | [Opt Out in Settings]
```

The "View Source Code" link goes to the analytics worker repository, allowing users to audit exactly what data is collected.

---

## Proposed Opt-Out UI

For the Settings panel:

```
┌─────────────────────────────────────────────────┐
│ Privacy                                          │
├─────────────────────────────────────────────────┤
│ ☑ Help improve XIV Dye Tools                    │
│   Share anonymous usage statistics               │
│   (no personal data collected)                   │
│                                                  │
│   [Learn more about our privacy practices]       │
└─────────────────────────────────────────────────┘
```

**Implementation notes**:
- Default: ON (opt-out model)
- Store in localStorage: `analytics-opt-out: true/false`
- Check flag before sending any analytics events

---

## Comparison: Before vs After

### Current PRIVACY.md (lines 17-22):
```markdown
## Network Access

The only external network calls are:

1. **Universalis API** (optional): Fetches market-board prices...
2. **Google Fonts CDN**: Loads the Outfit, Inter, and JetBrains Mono fonts.

No other third-party trackers, analytics scripts, or telemetry endpoints are used.
```

### Updated version:
```markdown
## Network Access

The only external network calls are:

1. **Universalis API** (optional): Fetches market-board prices...
2. **Google Fonts CDN**: Loads the Outfit, Inter, and JetBrains Mono fonts.
3. **Cloudflare Analytics** (optional): Sends anonymous usage statistics if enabled.

No third-party trackers or telemetry that identifies individual users.
```

---

## Implementation Checklist

When ready to implement analytics:

- [ ] Create `xivdyetools-analytics-worker` repository (public, MIT license)
- [ ] Update PRIVACY.md with new Analytics section
- [ ] Update Network Access section (item 3)
- [ ] Add opt-out toggle to Settings panel
- [ ] Add brief mention to About modal with GitHub link
- [ ] Implement localStorage check for opt-out flag
- [ ] Test that opt-out actually stops analytics events

---

## Notes

- The opt-out default is **ON** (analytics enabled by default)
- This follows common practice and is legally permissible since no PII is collected
- Users who care about privacy can easily opt out
- The transparency in PRIVACY.md and About modal ensures informed consent
