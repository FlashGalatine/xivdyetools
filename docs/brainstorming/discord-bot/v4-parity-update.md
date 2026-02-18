# V4 Parity Update

**Bringing the Discord Bot to feature parity with the Web App v4.0.0**

---

## Overview

Version 4.0.0 aligns the Discord bot's command names and features with the web app. This is a breaking change release with no backwards compatibility for old command names.

## Version Change

- **Previous**: v2.3.3
- **New**: v4.0.0 (matching web app version)

---

## Command Changes Summary

### Renamed Commands

| v2 Command | v4 Command | Notes |
|------------|------------|-------|
| `/match <color>` | `/extractor color <color>` | Now a subcommand |
| `/match_image <image>` | `/extractor image <image>` | Merged under /extractor |
| `/mixer <start> <end>` | `/gradient <start> <end>` | Frees up /mixer for new feature |

### New Commands

| Command | Description | Web App Equivalent |
|---------|-------------|-------------------|
| `/mixer <dye1> <dye2> [mode]` | Blend two dyes with selectable algorithm | Dye Mixer tool |
| `/swatch color <type> <color> [clan] [gender]` | Match character colors to dyes by hex | Swatch Matcher tool |
| `/swatch grid <type> <row> <col> [clan] [gender]` | Match character colors to dyes by grid position | Swatch Matcher tool |
| `/preferences set <key> <value>` | Set default algorithm, identity, and display preferences | N/A (Discord-only) |

**`/preferences`** — Unified user preferences replacing `/language` and `/budget set_world`. Stores default blending mode, matching method, result count, clan, gender, world, and language per user in KV (`prefs:v1:{userId}`). Commands resolve: explicit param → user preference → system default.

**`/mixer` Blending Modes** (full parity with web app):
- `rgb` - Standard additive color mixing (default)
- `lab` - Perceptually uniform CIELAB blending
- `oklab` - Modern perceptual uniform (fixes LAB's blue→purple hue shift)
- `ryb` - Traditional artist's color wheel via Gossett-Chen algorithm
- `hsl` - Hue-Saturation-Lightness interpolation
- `spectral` - Kubelka-Munk physics simulation (most realistic pigment mixing)

**`/mixer` Matching Methods** (new parameter, shared across `/extractor`, `/gradient`, `/swatch`):
- `rgb` - Euclidean RGB distance
- `cie76` - CIE76 CIELAB Euclidean distance
- `ciede2000` - CIEDE2000 industry standard perceptual formula
- `oklab` - OKLAB Euclidean distance (default)
- `hyab` - HyAB hybrid distance (best for large differences)
- `oklch-weighted` - OKLCH weighted distance with L/C/H priorities

### Removed Commands

| Command | Reason |
|---------|--------|
| `/favorites` | Functionality covered by /preset |
| `/collection` | Functionality covered by /preset |

### Enhanced Commands

| Command | Enhancement |
|---------|-------------|
| `/harmony` | V4-style color wheel with center swatch and connection lines |
| `/comparison` | Now includes LAB color values for each dye |
| `/dye info` | Full Result Card with Technical and Acquisition sections |
| `/dye random` | Visual infographic with five Result Cards |
| `/stats` | Expanded to 5 subcommands: public summary + admin overview, commands, preferences, and health dashboards. Channel-restricted admin access. Extended Analytics Engine tracking for blending modes, matching methods, and market usage. |

---

**`/harmony` V4 Color Wheel** - The color wheel visualization now matches the web app's v4 design:

| Element | Description |
|---------|-------------|
| **Center Swatch** | Large circular swatch showing the base color with colored glow |
| **Color Ring** | Smooth conic gradient spectrum around the wheel |
| **Connection Lines** | Dashed white lines from center to each harmony node |
| **Harmony Nodes** | Circular markers at calculated angles on the ring |
| **Type Label** | Harmony type name displayed below the center |

---

**`/dye info` Result Card** - The info subcommand now generates a visual Result Card containing:

| Section | Contents |
|---------|----------|
| **Technical** | HEX, RGB, HSV, LAB color values |
| **Acquisition** | Source (how to obtain), Vendor Cost |

**Note**: Market Board data is intentionally excluded from `/dye info`. Use `/budget` for market pricing.

### Unchanged Commands

| Command | Status |
|---------|--------|
| `/harmony` | ✅ Structure unchanged (visualization enhanced) |
| `/comparison` | ✅ Structure unchanged (LAB values added) |
| `/accessibility` | ✅ No changes |
| `/preset` | ✅ No changes |
| `/budget` | ✅ No changes |
| `/dye` | ✅ Structure unchanged (info subcommand enhanced) |
| `/language` | ⚠️ Deprecated — replaced by `/preferences set language` |
| `/manual` | ✅ No changes |
| `/about` | ✅ No changes |
| `/stats` | ✅ Enhanced — expanded to 5 subcommands (summary, overview, commands, preferences, health) |

---

## Feature Parity Matrix

| Web App Tool | Discord Command | Status |
|--------------|-----------------|--------|
| Harmony Explorer | `/harmony` | ✅ Aligned |
| Palette Extractor | `/extractor` | ✅ Renamed |
| Accessibility Checker | `/accessibility` | ✅ Aligned |
| Dye Comparison | `/comparison` | ✅ Aligned |
| Gradient Builder | `/gradient` | ✅ Renamed |
| Dye Mixer | `/mixer` | 📋 New |
| Community Presets | `/preset` | ✅ Aligned |
| Budget Suggestions | `/budget` | ✅ Aligned |
| Swatch Matcher | `/swatch` | 📋 New |

---

## V4 Design Standards

### Result Cards in Infographics

All commands that generate infographics displaying dye results should include **V4 Result Cards** where appropriate. This ensures visual consistency with the web app.

**Commands using Result Cards**:

| Command | Result Card Usage |
|---------|-------------------|
| `/harmony` | Each harmony node displays a Result Card with matched dye info |
| `/extractor` | Each matched dye shown as a Result Card |
| `/gradient` | Intermediate dyes displayed as Result Cards |
| `/mixer` | Blended result matches shown as Result Cards |
| `/comparison` | Each dye displayed in card format (already card-based) |
| `/budget` | Alternative dyes shown as Result Cards with pricing |
| `/swatch` | Matched dyes displayed as Result Cards |
| `/dye info` | Single dye shown as full Result Card |
| `/dye random` | Five random dyes shown as Result Cards |

**Result Card Standard Contents**:

| Section | Data |
|---------|------|
| **Header** | Dye name with category indicator |
| **Preview** | Color swatch |
| **Technical** | HEX, RGB, HSV, LAB |
| **Acquisition** | Source, Vendor Cost |
| **Match Quality** | Delta-E, Hue Deviance (when comparing to target) |
| **Pricing** | Market Board price — shown conditionally (see below) |

**Note**: Not all fields are shown on every card. Context determines which fields are relevant:
- `/dye info`, `/dye random` show Technical + Acquisition (no Delta-E, no pricing)
- `/budget` always shows all fields including pricing
- `/harmony`, `/extractor`, `/mixer`, `/gradient`, `/swatch` show Technical + Delta-E + **optional Pricing**

**Market Data on Result Cards**:

Commands that display Result Cards support an optional `market` parameter (boolean, default: off). When enabled, the Pricing section is appended to each Result Card with Market Board data for the user's preferred world (set via `/preferences set world`).

| Condition | Behavior |
|-----------|----------|
| `market: true` + world set | Pricing section shown with MB price from user's world |
| `market: true` + no world | Ephemeral prompt: "Set your world with `/preferences set world <world>` to see market prices." |
| `market: false` (default) | No Pricing section (cards are faster to generate) |
| `/budget` command | Always shows pricing regardless of `market` preference |

Users can set `market` as a persistent default via `/preferences set market on`, or toggle it per-command.

---

### Image Caching

V4 introduces edge caching for generated images via the **Cloudflare Cache API**. Since identical inputs (same colors, algorithm, locale) always produce identical PNGs, redundant `resvg-wasm` renders are eliminated on cache hits.

| Scenario | TTL | Notes |
|----------|-----|-------|
| Standard result (no market) | 24 hours | Deterministic color output |
| Result with `market: true` | 2 hours | Market prices shift over hours; 2h balances freshness vs. render cost |
| `/swatch grid` (no market) | 7 days | Static game palette data |
| `/dye info` | 7 days | Static dye metadata |
| `/dye random`, `/extractor image` | Not cached | Non-deterministic or unique input |

**Cache key**: `https://cache.xivdyetools.internal/v1/{command}/{sha256-params-hash}` — version prefix (`v1`) enables instant invalidation on game patches or visual redesigns.

Cache performance is tracked in Analytics Engine (`blob9`: hit/miss/skip, `double5`: lookup latency) and KV counters (`stats:cache:*`), feeding into the `/stats health` dashboard.

See [Image Caching in Command Reference](command-reference-v4.md#image-caching) for full specification.

---

### Interactive Components

V4 adds **select menus** and **toggle buttons** to image results, allowing users to switch algorithms or toggle market data without re-typing the command. Components leverage the image cache — most re-runs are cache hits.

| Command | Components | Purpose |
|---------|-----------|---------|
| `/mixer`, `/gradient` | Select menus: blending mode + matching method | Switch algorithm on the fly |
| `/extractor color` | Select menu: matching method | Switch matching |
| `/harmony` | Select menu: harmony type | Cycle through harmony types |
| `/swatch` | Button: market toggle | Show/hide market data |
| All image commands | Copy buttons (HEX/RGB/HSV) | Carried forward from v3 |

**Context storage**: Original command params stored in KV (`ctx:v1:{hash}`, 1h TTL) for reconstruction on interaction. Custom ID format: `{action}_{command}_{param}_{value}_{context-hash}`.

See [Interactive Components in Command Reference](command-reference-v4.md#interactive-components) for full specification.

---

### Error UX Standard

V4 introduces a unified error design system with 6 error categories, each with distinct emoji, color, and optional actionable tips. All errors are ephemeral.

| Category | Emoji | Color | Example |
|----------|-------|-------|---------|
| Validation | ❌ | Red | Invalid hex color |
| Not Found | 🔍 | Orange | Dye not found (with "Did you mean...?" fuzzy suggestions) |
| Rate Limited | ⏳ | Yellow | Cooldown with remaining seconds |
| External Failure | 🌐 | Orange | Universalis API timeout |
| Internal Error | ⚠️ | Red | SVG render failure |
| Permission | 🔒 | Gray | Admin-only command, wrong channel |

See [Error UX Standard in Command Reference](command-reference-v4.md#error-ux-standard) for full specification.

---

### Pagination

Commands returning large result sets (>10 items) use button-based navigation to stay within Discord's 10-embed limit. Navigation row: `[◀ Prev] [Page X of Y] [Next ▶]`. Context stored in KV with 15min TTL.

| Command | Trigger | Items/Page |
|---------|---------|-----------|
| `/dye list`, `/dye search` | >10 results | 10 |
| `/preset list` | >10 presets | 10 |
| `/extractor color` | `count` >5 | 5 |

See [Pagination in Command Reference](command-reference-v4.md#pagination) for full specification.

---

### Cooldown & Queue Feedback

Long-running commands show progress status updates mid-processing instead of only Discord's generic "thinking..." state. Updates only trigger when elapsed time exceeds 1 second (avoiding flicker for fast commands).

| Phase | Status |
|-------|--------|
| Rendering | `⏳ Generating image...` |
| Market fetch | `💰 Fetching market data...` |
| Rate limited | `⏳ Slow Down — try again in {seconds}s` |

See [Cooldown & Queue Feedback in Command Reference](command-reference-v4.md#cooldown--queue-feedback) for full specification.

---

### Localization (i18n)

All new v4 commands and features are fully localized across 6 languages (en, ja, de, fr, ko, zh). New locale sections added:

| Section | For |
|---------|-----|
| `swatch` | `/swatch` command strings |
| `preferences` | `/preferences` command strings |
| `stats` | `/stats` command strings |
| `status` | Progress feedback messages |
| `pagination` | Navigation button labels |
| `components` | Interactive component labels and errors |

Removed sections: `favorites`, `collection` (commands removed in v4).

See [Localization in Command Reference](command-reference-v4.md#localization-i18n) for full specification.

---

## Migration Notes

### For Users

- Old commands (`/match`, `/match_image`, `/mixer`) will no longer work
- Use `/extractor color` instead of `/match`
- Use `/extractor image` instead of `/match_image`
- Use `/gradient` instead of `/mixer` for creating color gradients
- Favorites and collections have been removed; use `/preset` for saved color schemes
- `/language` is deprecated; use `/preferences set language` instead
- Use `/preferences` to set default blending mode, matching method, clan, gender, world, and result count

### For Developers

- Handler files renamed to match new command names
- `match.ts` → `extractor.ts` (with subcommand handlers)
- `mixer.ts` → `gradient.ts`
- New files: `mixer.ts` (dye blending), `swatch.ts` (character colors), `preferences.ts` (unified user preferences)
- Remove: `favorites.ts`, `collection.ts`
- Deprecate: `language.ts` (thin wrapper delegating to `preferences.ts`)
- Migrate: `user-preferences.ts` (world) and `i18n.ts` (language) storage into unified `prefs:v1:{userId}` KV object
- New: `image-cache.ts` — Cache API wrapper with `buildCacheKey()`, TTL resolution, and `ctx.waitUntil()` background storage
- New: `component-context.ts` — KV context storage/retrieval for interactive components and pagination
- New: `error-response.ts` — Unified error response builder with category support and fuzzy match suggestions
- New: `pagination.ts` — Pagination state management and navigation button builder
- New: `progress.ts` — Status embed updates for long-running commands (>1s threshold)
- Update: `src/handlers/buttons/index.ts` — Add routing for `rerun_*`, `toggle_*`, `page_*` custom IDs
- Update: `src/locales/*.json` — Add `swatch`, `preferences`, `stats`, `status`, `pagination`, `components` sections; remove `favorites`, `collection`
- Update: `src/index.ts` — Mount webhook route for changelog announcements
- Update command registration in `register-commands.ts`

---

## Discord-Only Features

These commands exist only in the Discord bot (not in web app):

| Command | Purpose |
|---------|---------|
| `/dye` | Search and explore the dye database |
| `/preferences` | Manage default algorithm, identity, and display preferences |
| `/language` | Set language preference *(deprecated, wraps `/preferences`)* |
| `/manual` | View help documentation |
| `/about` | Bot information and version |
| `/stats` | Usage statistics (admin only) |
| Changelog Announcements | Auto-post to Discord when `CHANGELOG-laymans.md` is updated (see [changelog-announcements.md](changelog-announcements.md)) |
