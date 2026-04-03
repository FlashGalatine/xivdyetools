---
layout: home

hero:
  name: "XIV Dye Tools API"
  text: "FFXIV dye data, served from the edge."
  tagline: "136 dyes, color matching, and localization in 6 languages. No auth required."
  actions:
    - theme: brand
      text: Quick Start
      link: /guide/
    - theme: alt
      text: API Reference
      link: /reference/

features:
  - title: 136 Dyes
    details: Full database including hex, RGB, HSV, categories, acquisition methods, vendor costs, and Patch 7.5 consolidation groups.
  - title: Color Matching
    details: Find the closest FFXIV dye to any hex color using six distance algorithms — RGB, CIE76, CIEDE2000, Oklab, HyAB, and OKLCh-weighted.
  - title: No Auth Required
    details: All Phase 1 endpoints are anonymous. Open CORS — callable from any browser, Dalamud plugin, Discord bot, or mobile app.
  - title: Edge Cached
    details: Deployed globally on Cloudflare Workers. Dye data is cached 1 hour in browsers and 24 hours at the edge.
  - title: 6 Languages
    details: Dye names available in English, Japanese, German, French, Korean, and Chinese via the `locale` query parameter.
  - title: Consistent Envelopes
    details: Every response uses the same `{ success, data, meta }` envelope with typed error codes and per-request UUIDs for easy debugging.
---
