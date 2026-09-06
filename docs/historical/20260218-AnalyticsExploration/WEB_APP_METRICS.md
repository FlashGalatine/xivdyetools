# Web App Metrics: What to Track

**Status**: Draft
**Date**: January 15, 2026
**Context**: Defining the specific metrics to track for xivdyetools-web-app and why they matter

---

## Overview

This document defines what we should track in the XIV Dye Tools web application. Each metric is evaluated for its product value, implementation complexity, and any biases to account for.

---

## Core Metrics

### 1. Tool Usage

**Question**: Which tools do users engage with most?

| Tool | Path | Default? | Notes |
|------|------|----------|-------|
| Harmony Explorer | `/harmony` | **Yes (default)** | Landing page, inflated by default behavior |
| Palette Extractor | `/extractor` | No | Image upload tool |
| Accessibility Checker | `/accessibility` | No | Colorblindness simulation |
| Dye Comparison | `/comparison` | No | Compare up to 4 dyes |
| Gradient Builder | `/gradient` | No | Find intermediate dyes |
| Dye Mixer | `/mixer` | No | NEW - Find dye combinations |
| Community Presets | `/presets` | No | Browse/submit presets |
| Budget Suggestions | `/budget` | No | Price-based recommendations |
| Swatch Matcher | `/swatch` | No | Match dyes from screenshots |

**What to Track**:
- Tool views (when tool becomes active)
- Tool switches (from tool A to tool B)
- Time spent on each tool (if feasible)

**Default Bias**: Harmony Explorer numbers will be inflated because it's the default landing.

**Recommended Solution: Index Landing Page**

Instead of landing directly on Harmony Explorer, introduce a tool selection landing page:
- Users must actively choose a tool via the tool selector bar
- Every tool view becomes intentional, eliminating passive landing bias
- No need for complex normalization logic in analytics

| Benefit | Description |
|---------|-------------|
| Clean data | All tool views represent genuine user interest |
| Equal footing | All 9 tools start with zero bias |
| User agency | New users can see all options before committing |
| Simpler analytics | No "landing" vs "navigation" distinction needed |

**Considerations**:
- Adds one click to user journey (acceptable trade-off for data quality)
- Could offer "remember my choice" for returning users
- Opportunity to show tool descriptions for onboarding

**Alternative: Track source separately** (if keeping current behavior):
- **Direct navigation** (user intentionally selected Harmony)
- **Landing only** (user stayed on default)
- **Tool switches** (user actively navigated away)

**Event Schema**:
```javascript
// When tool becomes active
{
  event: "tool_view",
  tool: "harmony" | "extractor" | "accessibility" | ...,
  source: "landing" | "navigation" | "direct_url",
  previous_tool: string | null
}

// When user leaves a tool (tracks time spent)
{
  event: "tool_exit",
  tool: "harmony",
  time_spent_seconds: 45
}
```

**Time Tracking Implementation**:
- Record timestamp when tool becomes active
- On tool switch or page unload, calculate duration
- Send `tool_exit` event with `time_spent_seconds`

---

### 2. Dye Interactions

**Question**: Which dyes are users interested in?

**What to Track**:

| Interaction | Description | Insight |
|-------------|-------------|---------|
| Dye click (grid) | Selected from main grid | Popular dyes |
| Dye click (favorites) | Selected from favorites panel | Power user preferences |
| Dye click (search result) | Selected after searching | Search effectiveness |
| Favorite added | Starred a dye | Long-term preferences |
| Favorite removed | Unstarred a dye | Changing preferences |
| Random dye button | Used random selection | Fun feature engagement |

**Dye Categories** (for aggregation):

| Category | Example Dyes |
|----------|--------------|
| White | Snow White, Chalk White |
| Black | Soot Black, Jet Black |
| Red | Wine Red, Coral Pink |
| Brown | Bark Brown, Chocolate Brown |
| Yellow | Canary Yellow, Vanilla Yellow |
| Green | Hunter Green, Celeste Green |
| Blue | Ice Blue, Midnight Blue |
| Purple | Grape Purple, Lavender Purple |
| Metallic | Metallic Gold, Metallic Silver |
| Special | Pure White, Jet Black |

**Event Schema**:
```javascript
{
  event: "dye_selected",
  dye_id: "snow-white",
  dye_category: "white",
  source: "grid" | "favorites" | "search" | "random",
  tool: "harmony"  // which tool was active
}
```

---

### 3. Theme Usage

**Question**: Which themes resonate with users?

**Available Themes**:

| Theme | Type | Default? |
|-------|------|----------|
| Premium Dark | Dark | **Yes (default)** |
| Standard Dark | Dark | No |
| Standard Light | Light | No |
| Hydaelyn Light | Light | No |
| OG Classic Dark | Dark | No |
| Parchment Light | Light | No |
| Cotton Candy | Light | No |
| Sugar Riot | Light | No |
| Grayscale Light | Light | No |
| Grayscale Dark | Dark | No |
| High Contrast Light | Light | No |
| High Contrast Dark | Dark | No |

**What to Track**:
- Theme changes (from X to Y)
- Theme modal opens (engagement with settings)
- Final theme on session end (actual preference)

**Default Bias**: Premium Dark will appear most "used" because it's the default. More meaningful:
- **Theme changes count**: How often do users change themes?
- **Change-from-default rate**: What % of users change away from Premium Dark?
- **Theme retention**: If changed, do they change again?

**Event Schema**:
```javascript
{
  event: "theme_changed",
  from_theme: "premium-dark",
  to_theme: "cotton-candy"
}
```

---

### 4. Regional & Language Data

**Question**: Where are our users from, and what languages do they use?

**Geography** (Available via Web Analytics):
- Country-level data
- No city/region granularity (privacy)

**Language Settings**:

| Language | Code | Notes |
|----------|------|-------|
| English | en | Default fallback |
| Japanese | ja | FFXIV origin market |
| German | de | Strong EU presence |
| French | fr | EU market |
| Korean | ko | Significant player base |
| Chinese | zh | Large market |

**What to Track**:
- Browser language (automatic)
- Language changes in app
- Mismatches (browser says EN, user changes to JA)

**Event Schema**:
```javascript
{
  event: "language_changed",
  from_language: "en",
  to_language: "ja",
  browser_language: "en-US"
}
```

---

## User Journey & Feature Discovery

Beyond core metrics, understanding how users discover and use features provides product insight.

### 5. Favorites Panel

**Question**: Do users discover and use the favorites feature?

| Action | Insight |
|--------|---------|
| Panel expanded | User found the feature |
| Panel collapsed | User tidying interface |
| First favorite added | Feature adoption |
| Favorites used for selection | Feature value |

**Event Schema**:
```javascript
{
  event: "favorites_panel",
  action: "expand" | "collapse"
}
```

---

### 6. Config Sidebar

**Question**: How do users configure tools?

The config sidebar appears for each tool with tool-specific options.

| Tool | Config Options |
|------|----------------|
| Harmony | Color harmony type, palette size |
| Extractor | Number of colors, clustering method |
| Comparison | Data center, price display |
| Gradient | Number of steps |
| Budget | Max price, data center |

**What to Track**:
- Config sidebar interactions
- Which configs are adjusted most
- Default vs custom config usage

**Event Schema**:
```javascript
{
  event: "config_changed",
  tool: "harmony",
  config_key: "harmony_type",
  config_value: "complementary"
}
```

---

### 7. Dye Search & Filtering

**Question**: How do users find dyes?

| Action | Track? | Insight |
|--------|--------|---------|
| Search was used | Yes | Search feature adoption |
| Search results count | Yes | Search effectiveness |
| ~~Search query text~~ | **No** | Privacy: could reveal personal intent |
| Category filter applied | Yes | Browsing vs targeted search |
| Sort changed | Yes | Preferred organization |

**Event Schema**:
```javascript
// Track that search was used, NOT what was searched
{
  event: "dye_search_used",
  results_count: 12,
  had_results: true
}

{
  event: "dye_filter",
  filter_type: "category",
  filter_value: "metallic"
}

{
  event: "dye_sort",
  sort_by: "name" | "price" | "category"
}
```

---

### 8. Tool Navigation Flow

**Question**: What paths do users take through the app?

Understanding common flows helps optimize navigation:

```
Common Flow Example:
Harmony → Comparison → Budget
(Pick palette → Compare options → Find affordable alternatives)
```

**What to Track**:
- Entry point (landing page vs direct URL)
- Tool transition sequences
- Exit point (last tool before leaving)

**Event Schema**:
```javascript
{
  event: "navigation_flow",
  from: "harmony",
  to: "comparison",
  method: "banner_click" | "direct_url"
}
```

---

### 9. Modal Interactions

**Question**: Do users engage with settings?

| Modal | Purpose |
|-------|---------|
| Theme Modal | Theme selection |
| Language Modal | Language selection |
| About Modal | Information |

**What to Track**:
- Modal open events
- Time spent in modal
- Actions taken vs cancelled

**Event Schema**:
```javascript
{
  event: "modal_opened",
  modal_type: "theme" | "language" | "about"
}
```

---

## Metrics Priority Matrix

### Phase 1 (Essential)

| Metric | Value | Effort | Priority |
|--------|-------|--------|----------|
| Tool usage | High | Low | **P0** |
| Time on tool | High | Medium | **P0** |
| Theme changes | High | Low | **P0** |
| Dye selections (individual + category) | High | Medium | **P0** |
| Geographic data | High | Zero (Web Analytics) | **P0** |

### Phase 2 (Valuable)

| Metric | Value | Effort | Priority |
|--------|-------|--------|----------|
| Language changes | Medium | Low | **P1** |
| Favorites usage | Medium | Low | **P1** |
| Search usage (not queries) | Medium | Low | **P1** |
| Navigation flows | Medium | Medium | **P1** |

### Phase 3 (Nice to Have)

| Metric | Value | Effort | Priority |
|--------|-------|--------|----------|
| Config changes | Low | Medium | **P2** |
| Modal interactions | Low | Low | **P2** |
| Sort preferences | Low | Low | **P2** |
| Category filters used | Low | Low | **P2** |

---

## Existing App Events

The web app already emits custom events that could be captured:

| Event | Component | Current Use |
|-------|-----------|-------------|
| `dye-selected` | DyeSelector | Internal state |
| `selection-changed` | DyeSelector | Parent notification |
| `search-changed` | DyeSearchBox | Filter update |
| `sort-changed` | DyeSearchBox | Grid re-render |
| `category-changed` | DyeSearchBox | Filter update |

**Implementation Opportunity**: These events already exist for UI reactivity. Adding analytics would hook into the same event system.

---

## Data Collection Boundaries

### What We WILL Track

- Aggregate tool usage patterns
- Dye popularity (aggregate)
- Theme preferences (aggregate)
- Geographic distribution
- Language preferences
- Feature discovery rates

### What We WILL NOT Track

- Individual user identities
- Session reconstruction (who did what)
- Personal dye combinations (your specific palettes)
- Browsing history across sessions
- Any form of fingerprinting
- **Search query text** (privacy: could reveal personal intent)

---

## Open Questions (Resolved)

1. **Should we track time-based metrics (session duration, time on tool)?**
   - **Decision: Yes** — Track time spent on each tool
   - Useful for understanding engagement depth
   - Implementation: Track tool entry/exit timestamps

2. **How granular should dye tracking be (individual dye vs category)?**
   - **Decision: Both** — Track individual dye IDs AND aggregate by category
   - Allows both "Snow White is popular" and "White dyes are popular" insights
   - Event schema includes both `dye_id` and `dye_category`

3. **Should search queries be tracked verbatim or categorized?**
   - **Decision: No** — Do not track search queries
   - Privacy consideration: search terms could reveal personal intent
   - Track only: whether search was used, result counts, category filters

4. **Do we need real-time analytics or is daily aggregation sufficient?**
   - **Decision: Daily aggregation is sufficient**
   - No need for real-time dashboards
   - CSV export for periodic analysis fits this model well

---

## Next Steps

- [x] Prioritize Phase 1 metrics for initial implementation
- [ ] Define exact event schemas for chosen metrics
- [x] Determine aggregation strategy → Daily batch
- [ ] Update priority matrix based on decisions

---

## References

- [Web App Architecture](../projects/xivdyetools-web-app.md)
- [Router Service (tools)](../projects/xivdyetools-web-app.md#routing)
- [Theme Service](../projects/xivdyetools-web-app.md#theming)
- [Dye Selector Component](../projects/xivdyetools-web-app.md#components)
