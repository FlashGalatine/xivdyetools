# Command Reference v4

**Complete reference for XIV Dye Tools Discord Bot v4.0.0**

---

## Autocomplete Reference

All autocomplete uses Discord's autocomplete API (`APPLICATION_COMMAND_AUTOCOMPLETE_RESULT`) with a **25-result maximum**. Searches are **case-insensitive substring matching** unless noted otherwise. Empty queries show a sensible default list.

### Shared Autocomplete Types

These reusable autocomplete handlers are referenced by multiple commands:

| Type | Format | Value Returned | Empty Query |
|------|--------|---------------|-------------|
| **Dye Name** | `{DyeName} ({#HEX})` | Dye name (string) | First 25 dyes (alphabetical) |
| **Dye Name (Budget)** | `{DyeName} ({Category})` | Dye item ID (number) | First 25 dyes |
| **World/DC** | `{Name}` or `{Name} ({Region} Data Center)` | World or DC name | All DCs + worlds (DCs listed first) |
| **Clan** | `{ClanName} ({Race})` | Clan name (lowercase) | All 16 clans grouped by race |
| **Blending Mode** | `{mode} — {Description}` | Mode key (e.g., `spectral`) | All 6 modes |
| **Matching Method** | `{method} — {Description}` | Method key (e.g., `oklab`) | All 6 methods |
| **Preset** | `{Name} ({Votes}★)` or `{Name} ({Votes}★) by {Author}` | Preset ID (UUID) | Popular presets |
| **Collection** | `{Name} ({Count} dyes)` | Collection name | All user collections |

### Per-Command Autocomplete Map

| Command | Parameter | Autocomplete Type |
|---------|-----------|------------------|
| `/harmony` | `color` | Dye Name |
| `/extractor color` | `color` | Dye Name |
| `/extractor color` | `matching` | Matching Method |
| `/gradient` | `start`, `end` | Dye Name |
| `/gradient` | `mode` | Blending Mode |
| `/gradient` | `matching` | Matching Method |
| `/mixer` | `dye1`, `dye2` | Dye Name |
| `/mixer` | `mode` | Blending Mode |
| `/mixer` | `matching` | Matching Method |
| `/comparison` | `dye1`–`dye4` | Dye Name |
| `/accessibility` | `dye`–`dye4` | Dye Name |
| `/swatch color` | `clan` | Clan |
| `/swatch color` | `matching` | Matching Method |
| `/swatch grid` | `clan` | Clan |
| `/swatch grid` | `matching` | Matching Method |
| `/preset show` | `name` | Preset |
| `/preset submit` | `dye1`–`dye5` | Dye Name |
| `/preset vote` | `preset` | Preset |
| `/preset edit` | `preset` | Preset (own only) |
| `/preset edit` | `dye1`–`dye5` | Dye Name |
| `/budget find` | `target_dye` | Dye Name (Budget) |
| `/budget find` | `world` | World/DC |
| `/budget set_world` | `world` | World/DC |
| `/budget quick` | `world` | World/DC |
| `/dye search` | `query` | Dye Name |
| `/dye info` | `name` | Dye Name |
| `/preferences set` | `key`, `value` | Contextual (see [/preferences](#preferences)) |
| `/preferences reset` | `key` | Preference Key |
| `/stats commands` | `command` | Command Name (all registered commands) |

### Autocomplete UX Conventions

| Convention | Description |
|------------|-------------|
| **Current value indicator** | User's active preference or selection shown with `✓` prefix |
| **Contextual help text** | Parenthetical descriptions after values (e.g., `spectral — Kubelka-Munk physics`) |
| **Grouping** | Related options grouped logically (DCs before worlds, clans by race) |
| **Graceful fallback** | On error, return empty array (no crash, user can still type manually) |

---

## Color Tools

### /harmony

Generate color harmony palettes based on color theory with a visual color wheel.

**Usage**: `/harmony <color> [type] [market]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `color` | string | Yes | Hex color or dye name |
| `type` | choice | No | Harmony type (default: complementary) |
| `market` | boolean | No | Show Market Board pricing on Result Cards (default: off) |

**Harmony Types**: complementary, analogous, triadic, split-complementary, tetradic, square, monochromatic

**V4 Color Wheel Visualization**:

The harmony command generates an SVG color wheel matching the web app's v4 design:

```
         ╭──────────────────────╮
        ╱    Color Spectrum      ╲
       │    ┌─────────────┐       │
       │   ╱   ╲     ╱   ╲        │
       │  ●─────●───●─────●       │  ← Harmony nodes on ring
       │   ╲   ╱     ╲   ╱        │
       │    ╲ ╱       ╲ ╱         │
       │     ●─────────●          │  ← Dashed lines to center
       │      ╲       ╱           │
       │       ╲     ╱            │
       │        ╲   ╱             │
       │       ┌─────┐            │
       │       │ ███ │            │  ← Center swatch (base color)
       │       │ ███ │            │     with colored glow
       │       └─────┘            │
       │     COMPLEMENTARY        │  ← Harmony type label
        ╲                        ╱
         ╰──────────────────────╯
```

| Element | Description |
|---------|-------------|
| **Center Swatch** | Large circular swatch showing the base/selected color with a colored glow effect |
| **Color Ring** | Smooth conic gradient spectrum (red → yellow → green → cyan → blue → magenta → red) |
| **Harmony Nodes** | Circular markers positioned at calculated angles around the ring |
| **Connection Lines** | Dashed white lines from center to each harmony node |
| **Type Label** | Harmony type name displayed below center |

**Output**: V4 color wheel visualization with harmony dyes displayed as Result Cards showing Technical data and match quality.

**Enhanced in v4.0.0** - Now uses v4-style color wheel with center swatch and connection lines.

---

### /extractor

Find matching FFXIV dyes from colors or images.

**Subcommands**:

#### /extractor color

Find closest dye matches for a color.

**Usage**: `/extractor color <color> [matching] [count] [market]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `color` | string | Yes | Hex color or dye name *(autocomplete: Dye Name)* |
| `matching` | choice | No | Color matching algorithm (default: oklab) *(autocomplete: Matching Method)* |
| `count` | integer | No | Number of matches (1-10, default: 5) |
| `market` | boolean | No | Show Market Board pricing on Result Cards (default: off) |

**Matching Methods**: `rgb`, `cie76`, `ciede2000`, `oklab` (default), `hyab`, `oklch-weighted` — see [/mixer matching methods](#mixer) for full descriptions.

**Output**: Each matched dye displayed as a V4 Result Card with Technical data and Delta-E match quality.

#### /extractor image

Extract colors from an uploaded image.

**Usage**: `/extractor image <image> [colors]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `image` | attachment | Yes | Image file to analyze |
| `colors` | integer | No | Colors to extract (1-5, default: 3) |

**Output**: Extracted colors with matching dyes displayed as V4 Result Cards.

---

### /gradient

Create color gradients between two dyes.

**Usage**: `/gradient <start> <end> [mode] [matching] [steps] [market]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `start` | string | Yes | Starting color/dye *(autocomplete: Dye Name)* |
| `end` | string | Yes | Ending color/dye *(autocomplete: Dye Name)* |
| `mode` | choice | No | Interpolation algorithm (default: rgb) *(autocomplete: Blending Mode)* |
| `matching` | choice | No | Color matching algorithm (default: oklab) *(autocomplete: Matching Method)* |
| `steps` | integer | No | Intermediate steps (2-10, default: 5) |
| `market` | boolean | No | Show Market Board pricing on Result Cards (default: off) |

**Interpolation Modes**: `rgb` (default), `lab`, `oklab`, `ryb`, `hsl`, `spectral` — see [/mixer blending modes](#mixer) for full descriptions.

**Matching Methods**: `rgb`, `cie76`, `ciede2000`, `oklab` (default), `hyab`, `oklch-weighted` — see [/mixer matching methods](#mixer) for full descriptions.

**Output**: Gradient visualization with intermediate dyes displayed as V4 Result Cards showing Technical data and Delta-E from ideal gradient color.

---

### /mixer

Blend two dyes together to find dyes that match the blended result.

**Usage**: `/mixer <dye1> <dye2> [mode] [matching] [count] [market]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dye1` | string | Yes | First dye to blend *(autocomplete: Dye Name)* |
| `dye2` | string | Yes | Second dye to blend *(autocomplete: Dye Name)* |
| `mode` | choice | No | Color blending algorithm (default: rgb) *(autocomplete: Blending Mode)* |
| `matching` | choice | No | Color matching algorithm for finding closest dyes (default: oklab) *(autocomplete: Matching Method)* |
| `count` | integer | No | Number of results (3-8, default: 5) |
| `market` | boolean | No | Show Market Board pricing on Result Cards (default: off) |

**Blending Modes**:

| Mode | Description |
|------|-------------|
| `rgb` | **RGB Blending** (default) — Additive channel averaging. Best for digital/screen colors. Blue + Yellow = Gray. |
| `lab` | **LAB Blending** — Perceptually uniform CIELAB mixing. Visually balanced blends. Blue + Yellow = Pink (LAB hue distortion). |
| `oklab` | **OKLAB Blending** — Modern perceptual uniform color space (Björn Ottosson 2020). Fixes LAB's blue→purple hue shift. Blue + Yellow = Cyan. |
| `ryb` | **RYB Blending** — Traditional artist's color wheel via Gossett-Chen trilinear interpolation. Paint-like results. Blue + Yellow = Olive Green. |
| `hsl` | **HSL Blending** — Hue-Saturation-Lightness interpolation. Good for smooth hue transitions between similar colors. |
| `spectral` | **Spectral Blending** — Kubelka-Munk theory simulation using spectral reflectance curves (380-750nm). Most realistic pigment/paint mixing. Blue + Yellow = Green. |

**Matching Methods**:

| Method | Description |
|--------|-------------|
| `rgb` | Euclidean RGB distance. Fast but not perceptually accurate. |
| `cie76` | CIE76 — Simple Euclidean distance in CIELAB space. Fair accuracy. |
| `ciede2000` | CIEDE2000 — Industry standard perceptual color difference formula. Most accurate for close colors. |
| `oklab` | OKLAB Euclidean (default) — Modern perceptual distance, simpler than CIEDE2000. CSS Color Level 4 standard. |
| `hyab` | HyAB Hybrid — Taxicab distance for lightness + Euclidean for chroma. Best for large color differences (>10 ΔE). |
| `oklch-weighted` | OKLCH Weighted — Customizable Lightness/Chroma/Hue weight priorities for fine-tuned matching. |

**Example Results** (Snow White + Soot Black):

| Mode | Result |
|------|--------|
| RGB | Mid-gray with neutral tone |
| LAB | Perceptually balanced gray |
| OKLAB | Perceptually balanced gray (similar to LAB for neutrals) |
| RYB | Mid-gray (similar to RGB for neutrals) |
| HSL | Mid-gray via lightness interpolation |
| Spectral | Physically accurate mid-gray via reflectance averaging |

**Output**: Blended color swatch with matching dyes displayed as V4 Result Cards showing Technical data and Delta-E from the blended color.

**New in v4.0.0**

---

## Analysis Tools

### /comparison

Compare 2-4 dyes side-by-side with visual swatches and color analysis.

**Usage**: `/comparison <dye1> <dye2> [dye3] [dye4]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dye1` | string | Yes | First dye |
| `dye2` | string | Yes | Second dye |
| `dye3` | string | No | Third dye |
| `dye4` | string | No | Fourth dye |

**Comparison Card Contents**:

Each dye card displays:

| Data | Description |
|------|-------------|
| **Dye Name** | Full name with truncation indicator if needed |
| **Category** | Dye category (Reds, Blues, Yellows, etc.) |
| **HEX** | Hex color code |
| **RGB** | Red, Green, Blue values |
| **HSV** | Hue, Saturation, Value |
| **LAB** | CIELAB color space values |

**Color Analysis Section**:

| Metric | Description |
|--------|-------------|
| **Most Similar** | Pair with smallest color distance |
| **Most Different** | Pair with largest color distance |
| **Distance** | Euclidean color distance value |
| **Contrast** | WCAG contrast ratio with accessibility rating (AAA, AA, AA Large, Fail) |

**Enhanced in v4.0.0** - Now includes LAB color values for each dye.

---

### /accessibility

Colorblind simulation and contrast analysis.

**Usage**: `/accessibility <dye> [dye2] [dye3] [dye4] [vision]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dye` | string | Yes | Primary dye |
| `dye2-4` | string | No | Additional dyes for contrast matrix |
| `vision` | choice | No | Vision type simulation |

**Vision Types**: protanopia, deuteranopia, tritanopia, achromatopsia

---

### /swatch

Match character customization colors (eyes, hair, skin, etc.) to FFXIV dyes. Supports two input methods: a hex color value or a grid position from the in-game character creator.

**Subcommands**:

#### /swatch color

Find dyes matching a hex color within a character color palette.

**Usage**: `/swatch color <type> <color> [clan] [gender] [matching] [count] [market]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | choice | Yes | Color type to match |
| `color` | string | Yes | Hex color to match against the palette |
| `clan` | choice | Conditional | Character clan/sub-race (required for skin, hair) *(autocomplete: Clan)* |
| `gender` | choice | Conditional | Character gender (required for skin, hair) |
| `matching` | choice | No | Color matching algorithm (default: oklab) *(autocomplete: Matching Method)* |
| `count` | integer | No | Number of results (1-10, default: 5) |
| `market` | boolean | No | Show Market Board pricing on Result Cards (default: off) |

**Matching Methods**: `rgb`, `cie76`, `ciede2000`, `oklab` (default), `hyab`, `oklch-weighted` — see [/mixer matching methods](#mixer) for full descriptions.

#### /swatch grid

Find dyes matching a specific grid position from the character creator's color palette.

**Usage**: `/swatch grid <type> <row> <col> [clan] [gender] [matching] [count] [market]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | choice | Yes | Color type to match |
| `row` | integer | Yes | Row number in the color grid (1-indexed) |
| `col` | integer | Yes | Column number in the color grid (1-indexed) |
| `clan` | choice | Conditional | Character clan/sub-race (required for skin, hair) *(autocomplete: Clan)* |
| `gender` | choice | Conditional | Character gender (required for skin, hair) |
| `matching` | choice | No | Color matching algorithm (default: oklab) *(autocomplete: Matching Method)* |
| `count` | integer | No | Number of results (1-10, default: 5) |
| `market` | boolean | No | Show Market Board pricing on Result Cards (default: off) |

**Grid Position Mapping**:

The character creator displays colors in an **8-column grid**. The grid position maps to a linear palette index:

```
index = (row - 1) × 8 + (col - 1)
```

```
        Col 1  Col 2  Col 3  Col 4  Col 5  Col 6  Col 7  Col 8
Row 1  [  0  ] [  1  ] [  2  ] [  3  ] [  4  ] [  5  ] [  6  ] [  7  ]
Row 2  [  8  ] [  9  ] [ 10  ] [ 11  ] [ 12  ] [ 13  ] [ 14  ] [ 15  ]
Row 3  [ 16  ] [ 17  ] [ 18  ] [ 19  ] [ 20  ] [ 21  ] [ 22  ] [ 23  ]
  ⋮       ⋮       ⋮       ⋮       ⋮       ⋮       ⋮       ⋮       ⋮
Row 24 [184  ] [185  ] [186  ] [187  ] [188  ] [189  ] [190  ] [191  ]
```

**Grid Dimensions by Color Type**:

| Type | Rows | Columns | Total Colors |
|------|------|---------|-------------|
| `skin` | 24 | 8 | 192 |
| `hair` | 24 | 8 | 192 |
| `eyes` | 24 | 8 | 192 |
| `highlight` | 24 | 8 | 192 |
| `lips` | 12 | 8 | 96 |
| `tattoo` | 24 | 8 | 192 |
| `facepaint` | 24 | 8 | 192 |

**Example**: `/swatch grid hair 3 5 midlander male` → selects palette index 20 (Row 3, Col 5), looks up the hair color for Midlander Male at that position, and finds matching dyes.

---

**Color Types** (shared across both subcommands):

| Type | Clan/Gender Required | Palette | Description |
|------|---------------------|---------|-------------|
| `skin` | Yes | Race-specific | Character skin tone |
| `hair` | Yes | Race-specific | Character hair color |
| `eyes` | No | Shared | Character eye color |
| `highlight` | No | Shared | Hair highlight color |
| `lips` | No | Shared (12 rows) | Lip color |
| `tattoo` | No | Shared | Tattoo/limbal ring color |
| `facepaint` | No | Shared | Face paint color |

**Clans (Sub-races)**:

| Race | Clans |
|------|-------|
| Hyur | Midlander, Highlander |
| Miqo'te | Seeker of the Sun, Keeper of the Moon |
| Lalafell | Plainsfolk, Dunesfolk |
| Roegadyn | Sea Wolf, Hellsguard |
| Elezen | Wildwood, Duskwight |
| Au Ra | Raen, Xaela |
| Viera | Rava, Veena |
| Hrothgar | Helions, The Lost |

**Genders**: Male, Female

**Note**: Clan and gender are required for **skin** and **hair** only, because FFXIV uses different color palettes for each clan/gender combination. For example, Keeper of the Moon Miqo'te have different skin tones than Seekers of the Sun. All other color types (eyes, highlight, lips, tattoo, facepaint) use **shared palettes** that are the same across all races.

**Output**: The selected character color is displayed with its hex value and grid position (Row, Col). Matching dyes are displayed as V4 Result Cards with Technical data, Acquisition info, and Delta-E match quality.

**New in v4.0.0**

---

## Community

### /preset

Browse and submit community color presets.

**Subcommands**: `list`, `show`, `random`, `submit`, `vote`, `edit`

See `/manual preset` for detailed usage.

---

## Market

### /budget

Find affordable dye alternatives.

**Usage**: `/budget find <target_dye> [world]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target_dye` | string | Yes | Expensive dye to find alternatives for |
| `world` | string | No | FFXIV world for pricing data |

**Output**: Alternative dyes displayed as V4 Result Cards with Technical data, Acquisition info, Delta-E match quality, and Market Board pricing.

---

## Database

### /dye

Search and explore the FFXIV dye database.

**Subcommands**:

#### /dye search

Search dyes by name.

**Usage**: `/dye search <query>`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search term (partial name match) |

#### /dye info

Get detailed dye information with a visual Result Card matching the web app style.

**Usage**: `/dye info <name>`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Exact dye name (autocomplete enabled) |

**Result Card Contents**:

| Section | Data | Description |
|---------|------|-------------|
| **Header** | Dye Name | Centered name with category color |
| **Preview** | Color Swatch | Visual color preview |
| **Technical** | HEX | Hex color code (e.g., `#F1A1B2`) |
| | RGB | Red, Green, Blue values (e.g., `241, 161, 178`) |
| | HSV | Hue, Saturation, Value (e.g., `350°, 33%, 95%`) |
| | LAB | CIELAB color space values |
| **Acquisition** | Source | How to obtain (e.g., "Crafting", "Dye Vendor") |
| | Vendor Cost | Gil price from vendor (if applicable) |

**Note**: Market Board data is not included in `/dye info`. Use `/budget` for market pricing.

**Enhanced in v4.0.0** - Now displays a full Result Card with Technical and Acquisition sections.

#### /dye list

List dyes by category.

**Usage**: `/dye list [category]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `category` | choice | No | Filter by category (shows summary if omitted) |

**Categories**: Red, Brown, Yellow, Green, Blue, Purple, White, Black, Grey, Metallic, Special

#### /dye random

Show random dyes for inspiration.

**Usage**: `/dye random [unique]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `unique` | boolean | No | If true, shows 1 dye per category |

**Output**: Five random dyes displayed as V4 Result Cards with Technical and Acquisition data.

**Enhanced in v4.0.0** - Now generates a visual infographic with Result Cards.

---

## Utility

### /preferences

Manage user preferences and default settings. Preferences are stored per-user and apply across all commands. Any command parameter that has a default can be overridden per-invocation.

**Subcommands**:

#### /preferences show

Display all current preferences and their values.

**Usage**: `/preferences show`

**Output**: An embed listing each preference category with current values (or "default" if unset):

```
┌─────────────────────────────────────────┐
│         Your Preferences                │
├─────────────────────────────────────────┤
│ Language ─────────── English (en)       │
│ Blending Mode ────── rgb (default)      │
│ Matching Method ──── oklab (default)    │
│ Result Count ─────── 5 (default)        │
│ Clan ─────────────── Not set            │
│ Gender ───────────── Not set            │
│ World ────────────── Crystal            │
│ Market Data ─────── Off (default)      │
└─────────────────────────────────────────┘
```

#### /preferences set

Set a user preference.

**Usage**: `/preferences set <key> <value>`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | choice | Yes | The preference to set |
| `value` | string | Yes | The value to set (validated per key) |

**Preference Keys**:

| Key | Valid Values | Default | Affects |
|-----|-------------|---------|---------|
| `language` | `en`, `ja`, `de`, `fr`, `ko`, `zh` | Discord locale | All commands (UI language) |
| `blending` | `rgb`, `lab`, `oklab`, `ryb`, `hsl`, `spectral` | `rgb` | `/mixer`, `/gradient` |
| `matching` | `rgb`, `cie76`, `ciede2000`, `oklab`, `hyab`, `oklch-weighted` | `oklab` | `/mixer`, `/gradient`, `/extractor`, `/swatch`, `/budget` |
| `count` | `1`–`10` | `5` | `/mixer`, `/gradient`, `/extractor`, `/swatch` |
| `clan` | Any valid clan name (e.g., `midlander`, `xaela`) | None | `/swatch` (skin, hair) |
| `gender` | `male`, `female` | None | `/swatch` (skin, hair) |
| `world` | Any valid FFXIV world name | None | `/budget`, market data on Result Cards |
| `market` | `on`, `off` | `off` | All commands that display Result Cards |

**Autocomplete Behavior**:

Both `key` and `value` parameters use Discord's autocomplete API for a guided experience:

| Interaction | Autocomplete Response |
|-------------|----------------------|
| User focuses `key` | Shows all 7 preference keys with descriptions (e.g., `blending — Color mixing algorithm (current: spectral)`) |
| User focuses `value` after selecting `key` | Shows valid values for that key, with the current preference marked |

**Key autocomplete** — Each option displays the key name, a short description, and the user's current value:

```
┌──────────────────────────────────────────────────────┐
│ language     — UI language (current: English)        │
│ blending     — Color mixing algorithm (current: rgb) │
│ matching     — Color distance formula (current: oklab)│
│ count        — Default result count (current: 5)     │
│ clan         — Default clan for /swatch (not set)    │
│ gender       — Default gender for /swatch (not set)  │
│ world        — FFXIV world for /budget (not set)     │
│ market       — Show market data on cards (current: off)│
└──────────────────────────────────────────────────────┘
```

**Value autocomplete by key**:

| Key | Autocomplete Options |
|-----|---------------------|
| `language` | `English (en)`, `日本語 (ja)`, `Deutsch (de)`, `Français (fr)`, `한국어 (ko)`, `中文 (zh)` |
| `blending` | `rgb — Additive channel averaging`, `lab — Perceptual CIELAB`, `oklab — Modern perceptual`, `ryb — Artist's color wheel`, `hsl — Hue interpolation`, `spectral — Kubelka-Munk physics` |
| `matching` | `rgb — Euclidean RGB`, `cie76 — CIELAB Euclidean`, `ciede2000 — Industry standard`, `oklab — Modern perceptual`, `hyab — Hybrid distance`, `oklch-weighted — Weighted priorities` |
| `count` | `1` through `10` (numeric choices) |
| `clan` | All 16 clans grouped by race: `Midlander (Hyur)`, `Highlander (Hyur)`, `Wildwood (Elezen)`, etc. |
| `gender` | `Male`, `Female` |
| `world` | All FFXIV worlds, filterable by typing (e.g., typing "cac" shows `Cactuar`). Grouped by data center. |
| `market` | `On — Show Market Board prices on Result Cards`, `Off — Hide market data (default)` |

The current preference value is shown with a ✓ prefix (e.g., `✓ oklab — Modern perceptual`) so users can see their active setting at a glance.

**Preference Resolution Order**: Command parameter → User preference → System default

This means explicitly passing a parameter (e.g., `/mixer dye1 dye2 mode:spectral`) always overrides the stored preference.

**Example**:
```
/preferences set blending spectral
→ ✅ Blending mode set to spectral. This will be used as the default for /mixer and /gradient.

/preferences set clan xaela
→ ✅ Clan set to Xaela. This will be used as the default for /swatch skin and hair lookups.
```

#### /preferences reset

Reset one or all preferences to system defaults.

**Usage**: `/preferences reset [key]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `key` | choice | No | Specific preference to reset. If omitted, resets all preferences. |

**Example**:
```
/preferences reset blending
→ ✅ Blending mode reset to default (rgb).

/preferences reset
→ ✅ All preferences reset to defaults.
```

**KV Storage**:

| Key | KV Pattern | Data |
|-----|-----------|------|
| All preferences | `prefs:v1:{userId}` | JSON object with all preference fields |

Preferences are stored as a single JSON object per user, enabling atomic reads and reducing KV lookups:

```json
{
  "language": "en",
  "blending": "spectral",
  "matching": "oklab",
  "count": 5,
  "clan": "Xaela",
  "gender": "Female",
  "world": "Crystal",
  "market": false,
  "updatedAt": "2025-01-15T12:00:00Z"
}
```

**Migration**: Existing `/language` and `/budget set_world` preferences will be migrated into the unified preferences object on first access. The old KV keys (`i18n:user:{userId}`, `budget:world:v1:{userId}`) will be read as fallbacks during the transition period.

**New in v4.0.0**

---

### /language *(deprecated)*

Manage language preference. **Deprecated in v4.0.0** — use `/preferences set language <locale>` instead.

**Subcommands** (still functional for backwards compatibility):

- `/language set <locale>` - Set language (en, ja, de, fr, ko, zh) → delegates to `/preferences set language`
- `/language show` - Show current setting → delegates to `/preferences show`
- `/language reset` - Reset to Discord language → delegates to `/preferences reset language`

**Note**: `/language` will be removed in a future version. It currently acts as a thin wrapper around `/preferences`.

### /manual

Display help documentation.

**Usage**: `/manual [topic]`

### /about

Show bot information and version.

### /stats

View bot usage statistics. Provides a public summary for all users, and detailed admin dashboards for authorized users in a designated channel.

**Authorization**:

| Subcommand | Access | Channel Restriction |
|------------|--------|-------------------|
| `/stats summary` | **Public** — any user, any channel | None |
| `/stats overview` | **Admin only** | Stats channel only |
| `/stats commands` | **Admin only** | Stats channel only |
| `/stats preferences` | **Admin only** | Stats channel only |
| `/stats health` | **Admin only** | Stats channel only |

Admin authorization is controlled by `STATS_AUTHORIZED_USERS` (comma-separated Discord user IDs). The stats channel is controlled by `STATS_CHANNEL_ID`. Admin subcommands invoked outside the stats channel return an ephemeral error: *"This command can only be used in the stats channel."*

**Subcommands**:

#### /stats summary

Public bot statistics anyone can view. Returns an ephemeral response.

**Usage**: `/stats summary`

**Output**:

```
┌─────────────────────────────────────────┐
│       XIV Dye Tools — Bot Stats         │
├─────────────────────────────────────────┤
│ Total Commands ──── 142,857             │
│ Unique Users ────── 3,412               │
│ Active Servers ──── 287                 │
│ Most Popular ────── /extractor color    │
│ Uptime ──────────── 99.8%              │
│ Version ─────────── 4.0.0              │
└─────────────────────────────────────────┘
```

| Field | Description |
|-------|-------------|
| **Total Commands** | All-time command executions |
| **Unique Users** | All-time distinct user IDs |
| **Active Servers** | Guilds with ≥1 command in last 30 days |
| **Most Popular** | Highest usage command (all-time) |
| **Uptime** | Success rate (successful / total commands) |
| **Version** | Current bot version |

#### /stats overview

Admin dashboard with operational totals and trends. Returns an ephemeral response.

**Usage**: `/stats overview [period]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | choice | No | Time period for trends (default: 7d) |

**Periods**: `24h`, `7d`, `30d`

**Output** (3 embed fields):

**📈 Usage**:

| Metric | Description |
|--------|-------------|
| **Total Commands** | Command count for the selected period |
| **Success Rate** | Percentage of commands that completed without error |
| **Unique Users** | Distinct user IDs in the period |
| **New Users** | Users whose first command was in this period |
| **Active Servers** | Guilds with ≥1 command in the period |
| **Commands/Day** | Average daily command volume |

**📊 Trends** (compared to previous period):

| Metric | Description |
|--------|-------------|
| **Volume** | `↑ 12%` or `↓ 5%` vs. previous equivalent period |
| **Users** | User count change vs. previous period |
| **Servers** | Server count change vs. previous period |

**🏆 Top 5 Commands**:

| Metric | Description |
|--------|-------------|
| **Command name** | With execution count and percentage of total |

#### /stats commands

Per-command breakdown with latency and error analysis. Returns an ephemeral response.

**Usage**: `/stats commands [command] [period]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `command` | choice | No | Specific command to inspect (default: all) *(autocomplete)* |
| `period` | choice | No | Time period (default: 7d) |

**When no command specified** — overview table:

| Column | Description |
|--------|-------------|
| **Command** | Command name |
| **Count** | Executions in period |
| **Success** | Success rate percentage |
| **p50** | Median latency (ms) |
| **p95** | 95th percentile latency (ms) |
| **Trend** | `↑`/`↓`/`→` vs previous period |

**When a specific command is selected** — detailed breakdown:

| Section | Metrics |
|---------|---------|
| **Volume** | Total count, daily average, peak hour |
| **Latency** | p50, p95, p99 (ms) |
| **Errors** | Error count, error rate, top error types |
| **Parameters** | Most common parameter values (e.g., mode: spectral 42%, rgb 31%...) |
| **Market** | % of invocations with `market: true` |

#### /stats preferences

Preference adoption and distribution analysis. Returns an ephemeral response.

**Usage**: `/stats preferences [period]`

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | choice | No | Time period (default: 30d) |

**Output** (multiple embed fields):

**👤 Adoption**:

| Metric | Description |
|--------|-------------|
| **Users with preferences** | Count and percentage of total users who have set ≥1 preference |
| **Avg preferences set** | Average number of keys configured per user who has any |

**🎨 Blending Mode Distribution**:

| Metric | Description |
|--------|-------------|
| Per-mode breakdown | Usage count and percentage (e.g., `spectral: 1,240 (34%)`, `rgb: 980 (27%)`, ...) |
| **Default override rate** | % of `/mixer` and `/gradient` calls that use a non-default mode |

**🎯 Matching Method Distribution**:

| Metric | Description |
|--------|-------------|
| Per-method breakdown | Usage count and percentage |
| **Default override rate** | % of calls using a non-default method |

**💰 Market Data**:

| Metric | Description |
|--------|-------------|
| **Market opt-in rate** | % of users with `market: on` as default |
| **Per-command market usage** | % of each command's calls that include market data |
| **World distribution** | Top 5 worlds/DCs by user count |

**🐱 Swatch**:

| Metric | Description |
|--------|-------------|
| **Color vs Grid** | Usage split between `/swatch color` and `/swatch grid` |
| **Top clans** | Most popular clans set in preferences |
| **Color type distribution** | hair vs skin vs eyes vs lips vs tattoo vs facepaint |

#### /stats health

Operational health dashboard for monitoring infrastructure. Returns an ephemeral response.

**Usage**: `/stats health`

**Output** (multiple embed fields):

**⚡ Latency**:

| Metric | Description |
|--------|-------------|
| **Overall p50 / p95 / p99** | Command processing latency percentiles |
| **Slowest commands** | Top 3 commands by p95 latency |
| **Market data overhead** | Average additional latency when `market: true` |

**🌐 External APIs**:

| Metric | Description |
|--------|-------------|
| **Universalis** | Request count, success rate, avg latency (last 24h) |
| **Universalis errors** | Error count and top error types |

**🔒 Rate Limiting**:

| Metric | Description |
|--------|-------------|
| **Rate limit hits** | Count of blocked requests (last 24h) |
| **Top rate-limited users** | Top 3 users by block count (anonymized IDs) |
| **Top rate-limited commands** | Commands most frequently hitting limits |

**📦 Cache** (see [Image Caching](#image-caching)):

| Metric | Description |
|--------|-------------|
| **Hit rate** | Cache hits / (hits + misses) as percentage (last 24h) |
| **Daily trend** | Hit rate over last 7 days |
| **Estimated renders saved** | Cache hits × avg render time (ms saved) |
| **Top cached commands** | Commands with highest hit rates |
| **Top missed commands** | Commands with lowest hit rates (optimization targets) |

**💾 KV Storage**:

| Metric | Description |
|--------|-------------|
| **Read/Write ops** | Estimated KV operations (last 24h) |
| **Preference entries** | Total `prefs:v1:*` keys stored |
| **Stats key count** | Total `stats:*` keys |

**🚨 Errors**:

| Metric | Description |
|--------|-------------|
| **Error count** | Total errors (last 24h) |
| **Error rate** | Errors / total commands |
| **Top error types** | Top 5 errors by frequency with sample command |

---

**New Analytics Tracking (v4)**:

To support the expanded `/stats` subcommands, the Analytics Engine data points are extended:

| Field | Type | New in v4 | Description |
|-------|------|-----------|-------------|
| blob1 | string | No | Command name |
| blob2 | string | No | User ID |
| blob3 | string | No | Guild ID or `'dm'` |
| blob4 | string | No | Success flag (`'1'`/`'0'`) |
| blob5 | string | No | Error type (if failed) |
| blob6 | string | **Yes** | Blending mode used (if applicable) |
| blob7 | string | **Yes** | Matching method used (if applicable) |
| blob8 | string | **Yes** | Market flag (`'1'`/`'0'`) |
| blob9 | string | **Yes** | Cache status (`'hit'`/`'miss'`/`'skip'`) |
| double1 | number | No | Success count (0 or 1) |
| double2 | number | No | Latency (ms) |
| double3 | number | No | Total count (always 1) |
| double4 | number | **Yes** | Universalis latency (ms, 0 if no market call) |
| double5 | number | **Yes** | Cache lookup latency (ms) |

**KV Counter Extensions**:

| Key Pattern | New in v4 | Description |
|-------------|-----------|-------------|
| `stats:total` | No | Total commands |
| `stats:cmd:{name}` | No | Per-command count |
| `stats:success` | No | Total successes |
| `stats:failure` | No | Total failures |
| `stats:users:YYYY-MM-DD` | No | Daily unique users |
| `stats:guilds:YYYY-MM-DD` | **Yes** | Daily active guild IDs |
| `stats:mode:{mode}` | **Yes** | Per-blending-mode count |
| `stats:match:{method}` | **Yes** | Per-matching-method count |
| `stats:market:on` | **Yes** | Market opt-in count |
| `stats:market:off` | **Yes** | Market opt-out count |
| `stats:swatch:color` | **Yes** | `/swatch color` usage count |
| `stats:swatch:grid` | **Yes** | `/swatch grid` usage count |
| `stats:ratelimit:YYYY-MM-DD` | **Yes** | Daily rate limit hit count |
| `stats:newusers:YYYY-MM-DD` | **Yes** | Daily new user IDs (first command ever) |
| `stats:allusers` | **Yes** | All-time user ID set (for new user detection) |
| `stats:cache:hit` | **Yes** | Total cache hits |
| `stats:cache:miss` | **Yes** | Total cache misses |
| `stats:cache:skip` | **Yes** | Total cache skips (uncacheable commands) |
| `stats:cache:hit:YYYY-MM-DD` | **Yes** | Daily cache hits |
| `stats:cache:miss:YYYY-MM-DD` | **Yes** | Daily cache misses |

**Environment Variables**:

| Variable | Description |
|----------|-------------|
| `STATS_AUTHORIZED_USERS` | Comma-separated Discord user IDs authorized for admin subcommands |
| `STATS_CHANNEL_ID` | **New** — Discord channel ID where admin subcommands are allowed |

**Enhanced in v4.0.0** — Expanded from single command to 5 subcommands with detailed analytics.

---

## Infrastructure

### Image Caching

Generated images (SVG → PNG via `resvg-wasm`) are the most expensive operation per request. Since identical inputs always produce identical output, caching eliminates redundant renders and reduces response latency.

**Architecture**: Cloudflare Cache API (edge cache, per-PoP)

```
Request
  │
  ├─ Cache hit? ──→ Return cached PNG (< 5ms)
  │
  └─ Cache miss ──→ Generate SVG → Render PNG via resvg-wasm
                     │
                     ├─ Return PNG to Discord (attachment)
                     └─ Store in Cache API (background via ctx.waitUntil)
```

**Cache Key Design**:

Each cacheable response is stored under a synthetic URL used as the Cache API key:

```
https://cache.xivdyetools.internal/{command}/{deterministic-params-hash}
```

The params hash is a SHA-256 hex digest of a **sorted, deterministic JSON string** containing all parameters that affect the rendered image. Parameters that do NOT affect the image (e.g., ephemeral flags) are excluded.

**Example key inputs by command**:

| Command | Hash Inputs |
|---------|-------------|
| `/harmony` | `color`, `type`, `market`, `world`, `locale` |
| `/extractor color` | `color`, `matching`, `count`, `market`, `world`, `locale` |
| `/gradient` | `start`, `end`, `mode`, `matching`, `steps`, `market`, `world`, `locale` |
| `/mixer` | `dye1`, `dye2`, `mode`, `matching`, `count`, `market`, `world`, `locale` |
| `/comparison` | `dye1`–`dye4`, `locale` |
| `/accessibility` | `dye`–`dye4`, `vision`, `locale` |
| `/swatch color` | `type`, `color`, `clan`, `gender`, `matching`, `count`, `market`, `world`, `locale` |
| `/swatch grid` | `type`, `row`, `col`, `clan`, `gender`, `matching`, `count`, `market`, `world`, `locale` |
| `/budget find` | `target_dye`, `world`, `locale` (short TTL — prices are dynamic) |
| `/dye info` | `name`, `locale` |
| `/dye random` | ❌ Not cached (random output) |
| `/extractor image` | ❌ Not cached (unique user upload) |

**Note**: `locale` is included because rendered text (dye names, labels) changes per language.

**TTL Strategy**:

| Scenario | TTL | Rationale |
|----------|-----|-----------|
| Standard result (no market data) | **24 hours** | Color algorithms are deterministic; only a game patch changes dye data |
| Result with `market: true` | **2 hours** | Market Board prices shift over hours as players undercut; 2h balances freshness vs. render cost |
| `/swatch grid` (no market) | **7 days** | Character palettes are static game data, extremely unlikely to change between patches |
| `/budget find` | **2 hours** | Always includes pricing data |
| `/dye info` | **7 days** | Static dye metadata |
| `/dye random` | — | Not cached (non-deterministic) |
| `/extractor image` | — | Not cached (user-uploaded image is unique) |

**Cache Invalidation**:

| Trigger | Action |
|---------|--------|
| **Game patch** (new dyes, palette changes) | Purge all: bump cache version prefix (e.g., `v1` → `v2` in key URL) |
| **Bot update** (visual redesign) | Same version bump approach |
| **TTL expiry** | Automatic — Cache API handles eviction |
| **Manual purge** | Admin endpoint or Wrangler CLI: `wrangler cache purge` |

The cache version prefix is embedded in the key URL:

```
https://cache.xivdyetools.internal/v1/{command}/{params-hash}
```

Bumping to `v2` instantly orphans all `v1` entries (they expire naturally via TTL).

**Implementation Notes**:

```
// Pseudocode — cache-aware command handler
async function handleCommand(ctx: InteractionContext) {
  const cacheKey = buildCacheKey(ctx.command, ctx.resolvedParams);
  const cache = caches.default;

  // 1. Check cache
  const cached = await cache.match(cacheKey);
  if (cached) {
    const png = await cached.arrayBuffer();
    return sendImageResponse(ctx, png);  // Fast path
  }

  // 2. Generate image (slow path)
  const svg = generateSvg(ctx);
  const png = renderSvgToPng(svg);

  // 3. Store in cache (non-blocking)
  ctx.waitUntil(
    cache.put(cacheKey, new Response(png, {
      headers: {
        'Cache-Control': `s-maxage=${getTtl(ctx)}`,
        'Content-Type': 'image/png',
      },
    }))
  );

  return sendImageResponse(ctx, png);
}
```

**Cache-Control Header**:

| Header | Value | Purpose |
|--------|-------|---------|
| `s-maxage` | TTL in seconds (e.g., `86400` for 24h) | Cloudflare edge cache duration |
| `Content-Type` | `image/png` | Ensures correct binary handling |

**What is NOT cached**:

| Item | Reason |
|------|--------|
| `/dye random` results | Output is non-deterministic |
| `/extractor image` results | Input is a unique user upload |
| `/stats` responses | Admin data is real-time and ephemeral text (no image) |
| `/preferences` responses | Ephemeral text, no image |
| Embed text / metadata | Only the PNG image is cached; embed text is cheap to regenerate |

**Stats Integration**:

Cache performance is tracked via the existing Analytics Engine and KV counters:

| Field / Key | Type | Description |
|-------------|------|-------------|
| blob9 | string (Analytics) | Cache status: `'hit'`, `'miss'`, `'skip'` |
| double5 | number (Analytics) | Cache lookup latency (ms) |
| `stats:cache:hit` | KV counter | Total cache hits |
| `stats:cache:miss` | KV counter | Total cache misses |
| `stats:cache:skip` | KV counter | Total cache skips (uncacheable commands) |
| `stats:cache:hit:YYYY-MM-DD` | KV counter | Daily cache hits |
| `stats:cache:miss:YYYY-MM-DD` | KV counter | Daily cache misses |

These counters feed into the **📦 Cache** section of `/stats health` (see [/stats health](#stats-health)).

---

### Interactive Components

Discord message components (buttons and select menus) allow users to modify results without re-typing commands. V4 extends the existing copy-button pattern with **algorithm selectors**, **market toggles**, and **pagination controls**.

**Existing Components** (pre-v4):

| Component | Custom ID Pattern | Purpose |
|-----------|------------------|---------|
| Copy HEX button | `copy_hex_{hex}` | Copy hex code to clipboard |
| Copy RGB button | `copy_rgb_{r}_{g}_{b}` | Copy RGB values |
| Copy HSV button | `copy_hsv_{h}_{s}_{v}` | Copy HSV values |
| Preset Approve | `preset_approve_{id}` | Moderation: approve preset |
| Preset Reject | `preset_reject_{id}` | Moderation: reject preset |

**V4 Components**:

#### Per-Command Action Rows

| Command | Component Type | Options | Purpose |
|---------|---------------|---------|---------|
| `/mixer` | Select menu | 6 blending modes | Re-run with different algorithm |
| `/mixer` | Select menu | 6 matching methods | Switch matching on the fly |
| `/gradient` | Select menu | 6 interpolation modes | Same pattern as mixer |
| `/gradient` | Select menu | 6 matching methods | Same |
| `/extractor color` | Select menu | 6 matching methods | Switch matching |
| `/harmony` | Select menu | 7 harmony types | Cycle through harmony types |
| `/swatch` | Button | "💰 Show Market" / "💰 Hide Market" | Toggle market data |
| All image commands | Button row | Copy HEX / RGB / HSV | Already implemented (carried forward) |

#### Action Row Layout

Each message can have up to **5 action rows** (Discord limit). V4 commands use up to 3:

```
┌─────────────────────────────────────────────────────────┐
│ [Image result + embeds]                                  │
├─────────────────────────────────────────────────────────┤
│ Row 1: [Select Menu — Algorithm / Mode]                  │
│ Row 2: [◀ Prev] [Page 1 of 3] [Next ▶] [💰 Market]     │
│ Row 3: [Copy HEX] [Copy RGB] [Copy HSV]                 │
└─────────────────────────────────────────────────────────┘
```

Not all rows appear on every command. Row 1 only appears on commands with algorithm selection. Row 2 only appears when pagination or market toggle is applicable.

#### Custom ID Format (V4)

```
{action}_{command}_{param}_{value}_{context-hash}
```

| Segment | Description | Example |
|---------|-------------|---------|
| `action` | Operation type | `rerun`, `page`, `toggle` |
| `command` | Command name | `mixer`, `gradient`, `harmony` |
| `param` | Parameter being changed | `mode`, `matching`, `type`, `market` |
| `value` | New value | `spectral`, `ciede2000`, `triadic`, `on` |
| `context-hash` | 8-char hash of original params | `a3f2b1c9` |

**Examples**:
- `rerun_mixer_mode_spectral_a3f2b1c9` → re-render /mixer with mode=spectral
- `rerun_harmony_type_triadic_e7d1a2f0` → re-render /harmony as triadic
- `toggle_swatch_market_on_c4b8e3a1` → re-render /swatch with market data
- `page_dyelist_next_2_f1a9c3d2` → show page 2 of /dye list

#### Context Storage (KV)

When a command generates a response with interactive components, its full resolved parameters are stored in KV for later reconstruction:

| Key | TTL | Value |
|-----|-----|-------|
| `ctx:v1:{context-hash}` | **1 hour** | JSON: original resolved params |

```json
{
  "command": "mixer",
  "params": {
    "dye1": "Snow White",
    "dye2": "Soot Black",
    "mode": "rgb",
    "matching": "oklab",
    "count": 5,
    "market": false,
    "locale": "en"
  },
  "userId": "123456789",
  "createdAt": "2025-01-15T12:00:00Z"
}
```

**Why KV over embed fields**: Discord embed fields have size limits and are visible to users. KV is invisible, supports larger payloads, and the 1-hour TTL matches Discord's component interaction window.

**Security**: Context is validated on interaction — the `userId` in the stored context must match the interacting user. Other users cannot hijack another user's component interactions.

#### Component Interaction Handler Flow

```
User clicks button/select
       │
       ▼
MESSAGE_COMPONENT interaction received
       │
       ▼
Parse custom_id → extract action, command, param, value, context-hash
       │
       ▼
Fetch context from KV: ctx:v1:{context-hash}
       │
       ├─ Context not found → ephemeral error: "This interaction has expired. Please re-run the command."
       │
       └─ Context found → Validate userId match
              │
              ├─ Mismatch → ephemeral error: "Only the original user can interact with this."
              │
              └─ Match → Reconstruct params + apply override (param=value)
                     │
                     ▼
              Check image cache (Cache API) with new params
                     │
                     ├─ Cache hit → editOriginalResponse with cached PNG
                     │
                     └─ Cache miss → Generate new image → editOriginalResponse
                            │
                            └─ Store new image in cache (background)
```

**New in v4.0.0**

---

### Error UX Standard

All user-facing errors follow a consistent visual design with categorized severity, actionable tips, and full localization.

**Error Categories**:

| Category | Emoji | Color | When Used |
|----------|-------|-------|-----------|
| **Validation** | ❌ | Red (`0xFF0000`) | Invalid hex color, out-of-range grid position, missing required param |
| **Not Found** | 🔍 | Orange (`0xFF8C00`) | Dye not found, unknown clan name, unknown world |
| **Rate Limited** | ⏳ | Yellow (`0xFFCC00`) | User exceeded command rate limit |
| **External Failure** | 🌐 | Orange (`0xFF8C00`) | Universalis API timeout, market data unavailable |
| **Internal Error** | ⚠️ | Red (`0xFF0000`) | Unexpected error, SVG render failure, WASM crash |
| **Permission** | 🔒 | Gray (`0x808080`) | Admin-only command in wrong channel, unauthorized user |

**Error Embed Structure**:

```
┌─────────────────────────────────────────┐
│ {emoji} {Error Title}                    │
├─────────────────────────────────────────┤
│ {Description of what went wrong}         │
│                                          │
│ 💡 **Tip**: {Actionable suggestion}      │
└─────────────────────────────────────────┘
```

| Field | Required | Description |
|-------|----------|-------------|
| `title` | Yes | Category emoji + localized error title |
| `description` | Yes | User-facing explanation (never stack traces or internal details) |
| `tip` | No | Actionable recovery suggestion |
| `color` | Yes | Category-specific color from table above |
| `flags` | Yes | Always `64` (ephemeral — only visible to the user) |

**Error Examples**:

| Scenario | Title | Description | Tip |
|----------|-------|-------------|-----|
| Invalid hex | `❌ Invalid Color` | `"abc" is not a valid hex color.` | `💡 Use a 6-digit hex code like #FF5733, or type a dye name to use autocomplete.` |
| Dye not found | `🔍 Dye Not Found` | `No dye matching "Snow Wite" was found.` | `💡 Did you mean **Snow White**? Use autocomplete for suggestions.` |
| Grid out of range | `❌ Invalid Grid Position` | `Row 25 is out of range for hair (max: 24 rows).` | `💡 Hair colors use a 24×8 grid. Row must be 1-24, column must be 1-8.` |
| Rate limited | `⏳ Slow Down` | `You're using commands too quickly. Try again in **12 seconds**.` | `💡 Image commands: 5/min · Other commands: 15/min` |
| Universalis down | `🌐 Market Data Unavailable` | `Could not fetch Market Board prices. The result is shown without pricing.` | `💡 Try again later, or run without the market option.` |
| Wrong channel | `🔒 Wrong Channel` | `This command can only be used in the stats channel.` | — |
| Internal error | `⚠️ Something Went Wrong` | `An unexpected error occurred while processing your request.` | `💡 Try again. If this keeps happening, report it with /about.` |

**Fuzzy Match Suggestions**:

When a dye name or clan name is close but not exact, the error includes a "Did you mean...?" suggestion. This uses the same matching engine as autocomplete (substring + Levenshtein distance) to offer up to 3 candidates:

```
🔍 Dye Not Found
No dye matching "Lavnder Purple" was found.

💡 Did you mean: **Lavender Purple**, **Lavender Blue**, or **Lavender Mist**?
```

**Error Helper Signature**:

```typescript
function errorResponse(
  category: ErrorCategory,
  titleKey: string,
  descKey: string,
  tipKey?: string,
  vars?: Record<string, string>
): Response
```

All string parameters are i18n keys (e.g., `errors.invalidColor`), resolved via the user's locale. The `vars` object provides interpolation values (e.g., `{ input: 'abc', suggestion: 'Snow White' }`).

**New in v4.0.0**

---

### Pagination

Commands returning large result sets use button-based pagination to stay within Discord's **10-embed limit** per message.

**Paginated Commands**:

| Command | Trigger Condition | Items Per Page |
|---------|------------------|---------------|
| `/dye list [category]` | >10 dyes in the selected category | 10 |
| `/dye search` | >10 search results | 10 |
| `/extractor color` | `count` >5 with detailed Result Cards | 5 |
| `/preset list` | >10 presets | 10 |

**Non-Paginated Commands** (always fit in one message):

| Command | Max Items | Reason |
|---------|----------|--------|
| `/mixer` | 8 (`count` max) | Always fits |
| `/gradient` | 10 (`steps` max) | Always fits |
| `/harmony` | 7 (harmony types) | Always fits |
| `/swatch` | 10 (`count` max) | Always fits |
| `/comparison` | 4 (max dyes) | Always fits |

**Navigation Button Row**:

```
[◀ Prev] [Page 1 of 3] [Next ▶]
```

| Button | Style | Custom ID | Behavior |
|--------|-------|-----------|----------|
| ◀ Prev | Secondary (gray) | `page_{cmd}_prev_{page}_{hash}` | Go to previous page |
| Page X of Y | Secondary (gray), **disabled** | — | Visual indicator only (not clickable) |
| Next ▶ | Secondary (gray) | `page_{cmd}_next_{page}_{hash}` | Go to next page |

**Button States**:

| Condition | Prev Button | Next Button |
|-----------|-------------|-------------|
| Page 1 of N | Disabled | Enabled |
| Page N of N | Enabled | Disabled |
| Page 1 of 1 | No navigation row shown | — |

**Context Storage**:

Pagination reuses the same KV context pattern as Interactive Components:

```json
{
  "command": "dye_list",
  "params": { "category": "Red" },
  "pagination": {
    "totalItems": 34,
    "itemsPerPage": 10,
    "totalPages": 4,
    "currentPage": 1
  },
  "userId": "123456789",
  "createdAt": "2025-01-15T12:00:00Z"
}
```

**Key**: `ctx:v1:{context-hash}`, TTL: **15 minutes**

**Note**: Pagination context uses a shorter TTL (15min) than algorithm selector context (1h), because users are less likely to paginate through old results.

**Timeout Behavior**:

After the context TTL expires, Discord buttons become unresponsive. Clicking an expired button returns an ephemeral error:

```
⏳ This interaction has expired. Please re-run the command.
```

**New in v4.0.0**

---

### Cooldown & Queue Feedback

Users receive real-time status updates during long-running operations instead of only seeing Discord's generic "Bot is thinking..." state.

**Progress Status Updates**:

For commands that take >1 second after deferral, the deferred message is edited mid-processing to show a status embed:

| Phase | Status Embed | When Shown |
|-------|-------------|-----------|
| Deferred | *"Bot is thinking..."* (Discord default) | Immediately (automatic) |
| Rendering | `⏳ Generating image...` | Before SVG→PNG render, if elapsed >1s |
| Market fetch | `💰 Fetching market data...` | Before Universalis API call |
| Complete | Final result (image + embeds) | Replaces all status messages |

**Status Embed Design**:

```
┌─────────────────────────────────────────┐
│ ⏳ Generating image...                   │
│                                          │
│ ░░░░░░░░░░░░░░░░░░░░ (processing)       │
└─────────────────────────────────────────┘
```

Color: Discord Blurple (`0x5865F2`). Ephemeral if original command was ephemeral.

**Implementation Logic**:

```typescript
// Only show status if the command is taking a while (avoid flicker for fast commands)
if (ctx.elapsedMs() > 1000 && !ctx.isDeadlineExceeded()) {
  await editOriginalResponse(env.DISCORD_CLIENT_ID, token, {
    embeds: [statusEmbed('⏳', t.t('status.generating'))]
  });
}

// ... perform render ...

// Final result replaces status
await editOriginalResponse(env.DISCORD_CLIENT_ID, token, {
  embeds: [resultEmbed],
  file: { name: 'result.png', data: png, contentType: 'image/png' },
  components: [actionRows]
});
```

**Threshold**: Status messages are only sent when `ctx.elapsedMs() > 1000`. Commands completing in <1s go straight from "thinking..." to the final result with no intermediate flicker.

**Rate Limit Feedback**:

When a user is rate-limited, they see a specific cooldown embed instead of a generic error:

```
┌─────────────────────────────────────────┐
│ ⏳ Slow Down                             │
├─────────────────────────────────────────┤
│ You're using commands too quickly.       │
│ Try again in **12 seconds**.             │
│                                          │
│ 💡 Image commands: 5/min                 │
│    Other commands: 15/min                │
└─────────────────────────────────────────┘
```

The remaining cooldown time is calculated from the rate limiter's sliding window and displayed dynamically. Color: Yellow (`0xFFCC00`), consistent with the Error UX "Rate Limited" category.

**New in v4.0.0**

---

### Localization (i18n)

All new v4 commands and features require full localization across the 6 supported languages.

**Supported Locales**:

| Code | Language | Native Name | Flag |
|------|----------|-------------|------|
| `en` | English | English | 🇺🇸 |
| `ja` | Japanese | 日本語 | 🇯🇵 |
| `de` | German | Deutsch | 🇩🇪 |
| `fr` | French | Français | 🇫🇷 |
| `ko` | Korean | 한국어 | 🇰🇷 |
| `zh` | Chinese | 中文 | 🇨🇳 |

**Locale File Structure**: `src/locales/{locale}.json` — static JSON imported at build time.

**New Locale Sections** (v4):

| Section Key | For Feature | Example Keys |
|-------------|-------------|-------------|
| `swatch` | `/swatch` command | `swatch.title`, `swatch.colorType`, `swatch.gridPosition`, `swatch.clanRequired`, `swatch.gridOutOfRange` |
| `preferences` | `/preferences` command | `preferences.show.title`, `preferences.set.success`, `preferences.set.invalid`, `preferences.reset.confirm`, `preferences.reset.all`, `preferences.keys.blending`, `preferences.keys.matching`, `preferences.keys.market` |
| `stats` | `/stats` command | `stats.summary.title`, `stats.summary.totalCommands`, `stats.adminOnly`, `stats.wrongChannel`, `stats.overview.title`, `stats.health.title` |
| `status` | Progress feedback | `status.generating`, `status.fetchingMarket`, `status.expired` |
| `pagination` | Pagination controls | `pagination.pageOf`, `pagination.prev`, `pagination.next`, `pagination.expired` |
| `components` | Interactive components | `components.switchMode`, `components.switchMatching`, `components.toggleMarket`, `components.expiredInteraction`, `components.wrongUser` |

**Extended Existing Sections**:

| Section | New Keys | Purpose |
|---------|----------|---------|
| `errors` | `errors.invalidGridPosition`, `errors.invalidPreferenceKey`, `errors.worldRequired`, `errors.marketUnavailable`, `errors.dyeNotFoundSuggestion`, `errors.clanRequired` | Error UX standard messages |
| `buttons` | `buttons.showMarket`, `buttons.hideMarket`, `buttons.prevPage`, `buttons.nextPage` | Interactive component labels |
| `mixer` | `mixer.blend.title`, `mixer.blend.mode`, `mixer.blend.result` | Actual mixer command (was previously gradient-only) |

**Removed Sections** (v4):

| Section | Reason |
|---------|--------|
| `favorites` | `/favorites` command removed |
| `collection` | `/collection` command removed |

**Localization Rules**:

| Rule | Description |
|------|-------------|
| No hardcoded English | All user-facing text must go through `t.t()` |
| Interpolation format | `{variableName}` in strings, e.g., `"Try again in **{seconds}** seconds."` |
| Pluralization | Not currently supported; use neutral phrasing (e.g., "5 results" not "5 result(s)") |
| Fallback chain | Missing key → English fallback → raw key string |
| Error tips | Must be localized (under `errors.tip.*`) |
| Button labels | Must be localized (under `buttons.*`) |
| Select menu descriptions | Must be localized (under `components.*`) |
| Pagination labels | Template: `pagination.pageOf` → `"{current} / {total}"` |

**Example Locale Entry** (`en.json`):

```json
{
  "swatch": {
    "title": "Swatch Match",
    "colorType": "Color Type",
    "gridPosition": "Grid Position (Row {row}, Col {col})",
    "clanRequired": "Clan and gender are required for {type} colors.",
    "gridOutOfRange": "Row {row} is out of range (max: {maxRows})."
  },
  "preferences": {
    "show": {
      "title": "Your Preferences"
    },
    "set": {
      "success": "✅ **{key}** set to **{value}**. This will be used as the default for {commands}.",
      "invalid": "**{value}** is not a valid value for **{key}**."
    },
    "reset": {
      "confirm": "✅ **{key}** reset to default ({default}).",
      "all": "✅ All preferences reset to defaults."
    },
    "keys": {
      "blending": "Color mixing algorithm",
      "matching": "Color distance formula",
      "count": "Default result count",
      "clan": "Default clan for /swatch",
      "gender": "Default gender for /swatch",
      "world": "FFXIV world for market data",
      "market": "Show market data on cards",
      "language": "UI language"
    }
  },
  "status": {
    "generating": "Generating image...",
    "fetchingMarket": "Fetching market data...",
    "rateLimited": "You're using commands too quickly. Try again in **{seconds}** seconds."
  },
  "pagination": {
    "pageOf": "{current} / {total}",
    "prev": "◀ Prev",
    "next": "Next ▶",
    "expired": "This interaction has expired. Please re-run the command."
  },
  "components": {
    "switchMode": "Switch blending mode",
    "switchMatching": "Switch matching method",
    "toggleMarket": "Toggle market data",
    "expiredInteraction": "This interaction has expired. Please re-run the command.",
    "wrongUser": "Only the original user can interact with this."
  }
}
```

**Developer Notes**:

- Every new handler must call `createUserTranslator()` at the start
- Component interaction handlers must also resolve locale from stored context
- `LocalizationService.clear()` must be called before each request (Workers reuse isolates)
- New translations should be added to `en.json` first, then translated to the other 5 locales

**New in v4.0.0**
