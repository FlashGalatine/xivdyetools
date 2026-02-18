# Discord Bot Commands

**XIV Dye Tools Discord Bot** - Slash Command Specifications

**Version**: 1.0.0
**Last Updated**: November 22, 2025

---

## Table of Contents

1. [Overview](#overview)
2. [Command Reference](#command-reference)
   - [/harmony](#harmony)
   - [/match](#match)
   - [/match_image](#match_image)
   - [/accessibility](#accessibility)
   - [/comparison](#comparison)
   - [/mixer](#mixer)
   - [/dye](#dye)
3. [Parameter Types](#parameter-types)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)

---

## Overview

All commands use Discord's **slash command** system with auto-complete support where applicable. Commands are stateless and can be executed in any order.

### Global Options

Most commands support these optional parameters:

- **`show_prices`** (boolean) - Include market board prices from Universalis API
- **`data_center`** (string) - Data center for price lookups (see [Data Centers](#data-centers) for complete list - includes NA, EU, OCE, JP, CN, KR)
- **`ephemeral`** (boolean) - Show response only to you (default: false)

---

## Command Reference

### `/harmony`

Generate color harmony suggestions based on color theory principles.

#### Syntax

```
/harmony base_color:<hex> type:<harmony_type> [companion_count:<1-3>] [show_prices:<bool>] [data_center:<dc>]
```

#### Parameters

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| `base_color` | String | ✅ | Hex color code | `/^#[0-9A-Fa-f]{6}$/` |
| `type` | Choice | ✅ | Harmony type | See [Harmony Types](#harmony-types) |
| `companion_count` | Integer | ❌ | Number of companions (default: 1) | 1-3 |
| `show_prices` | Boolean | ❌ | Include prices (default: false) | - |
| `data_center` | Choice | ❌ | DC for prices | See [Data Centers](#data-centers) |

#### Harmony Types

| Value | Display Name | Description | Dyes Returned |
|-------|--------------|-------------|---------------|
| `complementary` | Complementary | Opposite on color wheel (180°) | Base + 1 |
| `analogous` | Analogous | Adjacent colors (±30°) | Base + 2 |
| `triadic` | Triadic | Equilateral triangle (120°) | Base + 2 |
| `split_complementary` | Split-Complementary | ±30° from complement | Base + 2 |
| `tetradic` | Tetradic (Rectangle) | Two complementary pairs | Base + 3 |
| `square` | Square | 90° spacing | Base + 3 |
| `monochromatic` | Monochromatic | Same hue, varied saturation | Base + 2-3 |
| `compound` | Compound (Analogous + Complement) | Analogous + opposite | Base + 3 |
| `shades` | Shades | Similar tones (±15°) | Base + 2-3 |

#### Example Usage

```
/harmony base_color:#FF0000 type:triadic show_prices:true data_center:Aether
```

#### Example Response

```
╔════════════════════════════════════════════════╗
║   🎨 Color Harmony: Triadic                   ║
╚════════════════════════════════════════════════╝

Base Color: #FF0000 (Red)
Closest Match: Dalamud Red (#A21D21)

🎯 Harmony Suggestions (120° spacing):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Dalamud Red [Base]
   ████ #A21D21
   Hue: 358° | Sat: 84% | Bright: 64%
   Acquisition: Crafting (ALC)
   💰 Price: 1,250 Gil (Aether)

2️⃣ Turquoise Green
   ████ #00A896
   Hue: 118° (+120° from base)
   Deviation: 2° (Excellent match)
   Acquisition: Dye Vendor
   💰 Price: 216 Gil

3️⃣ Royal Blue
   ████ #4169E1
   Hue: 225° (+227° from base)
   Deviation: 7° (Good match)
   Acquisition: Crafting (ALC)
   💰 Price: 2,100 Gil (Aether)

Total Cost: 3,566 Gil
[Attached: color_wheel_triadic_358.png]
```

---

### `/match`

Find the closest FFXIV dye matching a given color.

#### Syntax

```
/match color:<hex|name> [top_results:<1-10>] [exclude_category:<category>] [show_prices:<bool>]
```

#### Parameters

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| `color` | String | ✅ | Hex code or web color name | Hex: `/^#[0-9A-Fa-f]{6}$/`<br>Name: autocomplete |
| `top_results` | Integer | ❌ | Number of results (default: 1) | 1-10 |
| `exclude_category` | Choice | ❌ | Exclude category | See [Categories](#categories) |
| `show_prices` | Boolean | ❌ | Include prices (default: false) | - |
| `data_center` | Choice | ❌ | DC for prices | See [Data Centers](#data-centers) |

#### Web Color Names (Autocomplete)

The bot supports standard CSS color names with autocomplete:
- `red`, `blue`, `green`, `yellow`, `orange`, `purple`, `pink`, `brown`, `white`, `black`, `gray`, `cyan`, `magenta`, `lime`, `navy`, `teal`, `maroon`, `olive`, `silver`, `gold`, etc.

#### Example Usage

```
/match color:#8A2BE2 top_results:3 exclude_category:Facewear
/match color:blueviolet top_results:1
```

#### Example Response

```
🎯 Color Match Results for #8A2BE2 (Blue Violet)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Grape Purple (Best Match)
   ████ #8F4DAD
   Distance: 12.5 (Excellent)
   Hue: 283° | Sat: 58% | Bright: 68%
   Category: Purple
   Acquisition: Ixali Vendor
   💰 Price: 216 Gil

2️⃣ Royal Violet
   ████ #7E41A8
   Distance: 18.3 (Very Good)
   Hue: 276° | Sat: 61% | Bright: 66%
   Category: Purple
   Acquisition: Crafting (ALC)

3️⃣ Iris Purple
   ████ #A357B2
   Distance: 25.7 (Good)
   Hue: 290° | Sat: 51% | Bright: 70%
   Category: Purple
   Acquisition: Dye Vendor

ℹ️ Distance Metric: Euclidean RGB distance (0 = perfect, <30 = excellent, <60 = good)
```

---

### `/match_image`

Extract a color from an uploaded image and find matching dyes.

#### Syntax

```
/match_image attachment:<image> [sample_x:<px>] [sample_y:<px>] [sample_size:<px>] [top_results:<1-10>]
```

#### Parameters

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| `attachment` | Attachment | ✅ | Image file (PNG/JPG/WEBP) | Max 8 MB |
| `sample_x` | Integer | ❌ | X coordinate (default: center) | 0 - image width |
| `sample_y` | Integer | ❌ | Y coordinate (default: center) | 0 - image height |
| `sample_size` | Integer | ❌ | Sample area size (default: 5) | 1-50 pixels |
| `top_results` | Integer | ❌ | Number of results (default: 3) | 1-10 |

#### Example Usage

```
/match_image attachment:screenshot.png
/match_image attachment:gear.jpg sample_x:100 sample_y:200 sample_size:10 top_results:5
```

#### Example Response

```
🖼️ Image Color Extraction
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Sample Location: (512, 384)
📏 Sample Size: 5×5 pixels (averaged)
🎨 Extracted Color: ████ #C84751 (RGB: 200, 71, 81)

🎯 Top 3 Matching Dyes:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ Rolanberry Red
   ████ #C94854
   Distance: 3.2 (Perfect Match!)
   Category: Red
   Acquisition: Ixali Vendor

2️⃣ Dalamud Red
   ████ #A21D21
   Distance: 45.8 (Good)
   Category: Red
   Acquisition: Crafting (ALC)

3️⃣ Rust Red
   ████ #B54531
   Distance: 52.1 (Fair)
   Category: Red
   Acquisition: Sylph Vendor

[Attached: sample_preview.png]
```

---

### `/accessibility`

Simulate colorblindness for selected dyes and check WCAG contrast compliance.

#### Syntax

```
/accessibility dye1:<name> [dye2:<name>] [dye3:<name>] [dye4:<name>] [vision_types:<types>] [check_contrast:<bool>]
```

#### Parameters

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| `dye1` | String | ✅ | First dye | Autocomplete |
| `dye2` | String | ❌ | Second dye | Autocomplete |
| `dye3` | String | ❌ | Third dye | Autocomplete |
| `dye4` | String | ❌ | Fourth dye | Autocomplete |
| `vision_types` | String | ❌ | Comma-separated types (default: all) | See [Vision Types](#vision-types) |
| `check_contrast` | Boolean | ❌ | Calculate WCAG compliance (default: true) | - |

**Note**: Individual parameters (vs. comma-separated) enable autocomplete for each dye, improving UX. For >4 dyes, use the web app.

#### Vision Types

| Value | Display Name | Description |
|-------|--------------|-------------|
| `normal` | Normal Vision | No simulation |
| `deuteranopia` | Deuteranopia | Red-green (no green cones) |
| `protanopia` | Protanopia | Red-green (no red cones) |
| `tritanopia` | Tritanopia | Blue-yellow (no blue cones) |
| `achromatopsia` | Achromatopsia | Total color blindness |

#### Example Usage

```
/accessibility dye1:snow_white dye2:jet_black dye3:dalamud_red check_contrast:true
/accessibility dye1:royal_blue dye2:turquoise_green vision_types:deuteranopia,protanopia
```

#### Example Response

```
♿ Color Accessibility Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Selected Dyes:
1. Snow White (#E4DFD0)
2. Jet Black (#1C1C1C)
3. Dalamud Red (#A21D21)

[Attached: colorblind_swatches.png]
┌─────────────┬──────────┬──────────┬──────────┐
│ Vision Type │ Dye 1    │ Dye 2    │ Dye 3    │
├─────────────┼──────────┼──────────┼──────────┤
│ Normal      │ ████     │ ████     │ ████     │
│ Deuteranopia│ ████     │ ████     │ ████     │
│ Protanopia  │ ████     │ ████     │ ████     │
│ Tritanopia  │ ████     │ ████     │ ████     │
│ Achromatop. │ ████     │ ████     │ ████     │
└─────────────┴──────────┴──────────┴──────────┘

📊 WCAG Contrast Ratios:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Snow White vs. Jet Black: 14.8:1
  ✅ WCAG AAA (7:1) - Excellent for text
  ✅ WCAG AA Large (4.5:1)
  ✅ WCAG AA (4.5:1)

Snow White vs. Dalamud Red: 3.2:1
  ❌ WCAG AAA (7:1)
  ❌ WCAG AA (4.5:1)
  ⚠️ WCAG AA Large (3:1) - OK for large text only

Jet Black vs. Dalamud Red: 4.6:1
  ❌ WCAG AAA (7:1)
  ✅ WCAG AA (4.5:1) - Good for normal text
  ✅ WCAG AA Large (3:1)

ℹ️ Simulation uses Brettel 1997 transformation matrices
```

---

### `/comparison`

Compare 2-4 dyes side-by-side with color metrics and pricing.

#### Syntax

```
/comparison dye1:<name> dye2:<name> [dye3:<name>] [dye4:<name>] [show_chart:<bool>] [show_prices:<bool>] [data_center:<dc>]
```

#### Parameters

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| `dye1` | String | ✅ | First dye | Autocomplete |
| `dye2` | String | ✅ | Second dye | Autocomplete |
| `dye3` | String | ❌ | Third dye | Autocomplete |
| `dye4` | String | ❌ | Fourth dye | Autocomplete |
| `show_chart` | Boolean | ❌ | Generate HSV scatter plot (default: true) | - |
| `show_prices` | Boolean | ❌ | Include prices (default: false) | - |
| `data_center` | Choice | ❌ | DC for prices | See [Data Centers](#data-centers) |

**Note**: Individual parameters enable autocomplete for each dye selection.

#### Example Usage

```
/comparison dye1:snow_white dye2:jet_black dye3:dalamud_red dye4:royal_blue show_chart:true show_prices:true data_center:Aether
```

#### Example Response

```
📊 Dye Comparison
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────────────────┬─────────────┬───────────┬─────────────┬────────────┐
│ Property       │ Snow White  │ Jet Black │ Dalamud Red │ Royal Blue │
├────────────────┼─────────────┼───────────┼─────────────┼────────────┤
│ Hex            │ #E4DFD0     │ #1C1C1C   │ #A21D21     │ #4169E1    │
│ Category       │ Neutral     │ Neutral   │ Red         │ Blue       │
│ Hue            │ 45°         │ 0°        │ 358°        │ 225°       │
│ Saturation     │ 9%          │ 0%        │ 84%         │ 73%        │
│ Brightness     │ 89%         │ 11%       │ 64%         │ 88%        │
│ Acquisition    │ Dye Vendor  │ Dye Ven.  │ Crafting    │ Crafting   │
│ Price (Aether) │ 216 Gil     │ 216 Gil   │ 1,250 Gil   │ 2,100 Gil  │
└────────────────┴─────────────┴───────────┴─────────────┴────────────┘

🎨 Color Distance Matrix:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

               Snow White  Jet Black  Dalamud Red  Royal Blue
Snow White          -        203.5       158.2        125.3
Jet Black        203.5         -         115.8         95.4
Dalamud Red      158.2       115.8         -          125.6
Royal Blue       125.3        95.4       125.6          -

ℹ️ Distance metric: Euclidean RGB distance (0 = identical, 255 = opposite)

[Attached: hsv_comparison_chart.png]
```

---

### `/mixer`

Find intermediate dyes for smooth color transitions between two dyes.

#### Syntax

```
/mixer start:<dye> end:<dye> [steps:<2-20>] [colorspace:<rgb|hsv>] [show_gradient:<bool>]
```

#### Parameters

| Parameter | Type | Required | Description | Validation |
|-----------|------|----------|-------------|------------|
| `start` | String | ✅ | Starting dye name | Autocomplete |
| `end` | String | ✅ | Ending dye name | Autocomplete |
| `steps` | Integer | ❌ | Number of interpolation steps (default: 5) | 2-20 |
| `colorspace` | Choice | ❌ | Interpolation method (default: hsv) | `rgb` or `hsv` |
| `show_gradient` | Boolean | ❌ | Show gradient image (default: true) | - |

#### Colorspace Options

| Value | Display Name | Description | Best For |
|-------|--------------|-------------|----------|
| `rgb` | RGB Linear | Linear RGB interpolation | Desaturated transitions |
| `hsv` | HSV Perceptual | Hue-based interpolation | Natural color gradients |

#### Example Usage

```
/mixer start:snow_white end:jet_black steps:10 colorspace:hsv
/mixer start:dalamud_red end:royal_blue steps:5 colorspace:rgb show_gradient:true
```

#### Example Response

```
🎨 Dye Mixer: Snow White → Jet Black
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Interpolation: HSV Perceptual (10 steps)

Gradient:
████████████████████████████████████████████████

Intermediate Dyes:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  0% ▸ Snow White (#E4DFD0) [Start]
 10% ▸ Bone White (#CCC4B4) - Distance: 15.2
 20% ▸ Ash Grey (#B5AE9A) - Distance: 12.8
 30% ▸ Slate Grey (#9D9882) - Distance: 11.3
 40% ▸ Mud Grey (#86816A) - Distance: 10.5
 50% ▸ Storm Grey (#6F6B54) - Distance: 9.8
 60% ▸ Charcoal Grey (#58543E) - Distance: 8.9
 70% ▸ Dark Grey (#413D2A) - Distance: 7.2
 80% ▸ Gun Metal (#2A2718) - Distance: 5.5
 90% ▸ Soot Black (#151309) - Distance: 3.1
100% ▸ Jet Black (#1C1C1C) [End]

ℹ️ Distance: Average color difference between interpolated and matched dye
ℹ️ HSV interpolation preserves hue transitions for more natural gradients

[Attached: gradient_white_to_black.png]
```

---

### `/dye`

Search for dyes, get detailed information, or browse by category.

#### Subcommands

- `/dye search <query>` - Search dyes by name
- `/dye info <name>` - Get detailed info about a specific dye
- `/dye list <category>` - List all dyes in a category
- `/dye random [category]` - Get a random dye

#### Example: `/dye search`

```
/dye search query:purple
```

**Response:**
```
🔍 Search Results for "purple" (8 matches)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Grape Purple (#8F4DAD) - Purple
2. Royal Violet (#7E41A8) - Purple
3. Iris Purple (#A357B2) - Purple
4. Plum Purple (#6B2C5C) - Purple
5. Lavender Purple (#B09FC3) - Purple
6. Regal Purple (#52396D) - Purple
7. Gloom Purple (#4A2847) - Purple
8. Woad Purple (#553E62) - Purple

Use /dye info <name> for details
```

#### Example: `/dye info`

```
/dye info name:dalamud_red data_center:Aether
```

**Response:**
```
📋 Dye Information: Dalamud Red
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

████ #A21D21

🎨 Color Properties:
  • Hex: #A21D21
  • RGB: (162, 29, 33)
  • HSV: (358°, 84%, 64%)
  • Category: Red

📦 Acquisition:
  • Method: Crafting (Alchemist)
  • Level: 30
  • Base Price: 1,000 Gil
  • Market Price: 1,250 Gil (Aether, updated 2 min ago)

🛒 Marketboard Details:
  • Lowest Listing: 1,250 Gil (Jenova)
  • Average Price: 1,450 Gil
  • Daily Sales: 12 units
  • Last Sale: 5 minutes ago

🎯 Similar Dyes:
  • Rolanberry Red (#C94854) - Distance: 35.2
  • Rust Red (#B54531) - Distance: 42.8
  • Wine Red (#722F37) - Distance: 55.1

🔗 External Links:
  • Garland Tools: https://garlandtools.org/db/#item/5729
  • Universalis: https://universalis.app/market/5729
```

---

## Parameter Types

### Categories

All dye categories for filtering:

```typescript
enum DyeCategory {
  Neutral = 'Neutral',
  Red = 'Red',
  Orange = 'Orange',
  Yellow = 'Yellow',
  Green = 'Green',
  Blue = 'Blue',
  Purple = 'Purple',
  Brown = 'Brown',
  Special = 'Special',
  Facewear = 'Facewear'
}
```

### Data Centers

All FFXIV data centers for price lookups (verified via Universalis API):

**North America:**
- Aether
- Crystal
- Dynamis
- Primal

**Europe:**
- Chaos
- Light

**Oceania:**
- Materia

**Japan:**
- Elemental
- Gaia
- Mana
- Meteor

**China:**
- 陆行鸟 (LuXingNiao / Chocobo)
- 莫古力 (MoGuLi / Moogle)
- 猫小胖 (MaoXiaoPang / Cait Sith)
- 豆豆柴 (DouDouChai / Twintania)

**Korea:**
- 한국 (Korea)

**Note**: Universalis API uses CJK characters as official identifiers. Discord.js fully supports Unicode in slash command parameters.

---

## Error Handling

### Common Error Responses

#### Invalid Hex Color

```
❌ Invalid Color Format

The color "#GG0000" is not a valid hex code.
Please use the format #RRGGBB (e.g., #FF0000 for red).
```

#### Dye Not Found

```
❌ Dye Not Found

Could not find a dye named "super_rainbow_dye".
Use /dye search to find available dyes.
```

#### Image Too Large

```
❌ Image Too Large

The uploaded image (12.5 MB) exceeds the maximum size of 8 MB.
Please compress or crop the image and try again.
```

#### API Timeout

```
⚠️ Partial Results

Price data could not be retrieved from the market board API.
Showing results with base vendor prices instead.
```

#### Rate Limited

```
⏱️ Rate Limit Exceeded

You are making requests too quickly.
Please wait 30 seconds before trying again.
```

---

## Rate Limiting

### Per-User Limits

| Limit Type | Value | Window |
|------------|-------|--------|
| Commands per minute | 10 | 60 seconds |
| Commands per hour | 100 | 3600 seconds |
| Image uploads per minute | 3 | 60 seconds |

### Global Limits

| Limit Type | Value | Window |
|------------|-------|--------|
| API calls to Universalis | 60 | 60 seconds |
| Rendered images | 120 | 60 seconds |

### Rate Limit Headers (for developers)

```typescript
{
  'X-RateLimit-Limit': '10',
  'X-RateLimit-Remaining': '7',
  'X-RateLimit-Reset': '1700000000'
}
```

---

## Autocomplete Support

Commands with autocomplete for better UX:

| Command | Parameter | Autocomplete Source |
|---------|-----------|---------------------|
| `/harmony` | `base_color` | Recent colors + web color names |
| `/match` | `color` | Web color names (CSS named colors) |
| `/match_image` | - | - |
| `/accessibility` | `dye1`, `dye2`, `dye3`, `dye4` | All dye names |
| `/comparison` | `dye1`, `dye2`, `dye3`, `dye4` | All dye names |
| `/mixer` | `start`, `end` | All dye names |
| `/dye search` | `query` | - |
| `/dye info` | `name` | All dye names |
| `/dye list` | `category` | All categories |

---

## Next Steps

1. **Review**: [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. **Review**: [RENDERING.md](./RENDERING.md) for image generation details
3. **Review**: [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for service extraction
4. **Implement**: Command handlers in `packages/discord-bot/src/commands/`

---

**Last Updated**: November 22, 2025
**Author**: XIV Dye Tools Team
**Version**: 1.0.0
