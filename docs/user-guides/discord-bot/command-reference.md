# Discord Bot Command Reference

**Complete guide to all XIV Dye Tools Discord commands**

---

> **5.0 note.** The 5.0 release replaced the v4 command set. `/match`, `/match_image`, `/favorites`,
> `/collection` and `/language` are gone — dye matching is `/extractor color` / `/extractor image`,
> language is `/preferences set language:`, and saved dyes/palettes live in the web app (favourite
> *presets* are `/preset favorite`). `/contrast`, `/a11y` and `/changelog` are new, and `/swatch` now
> reads a `.chara` character file. Every card is a redrawn image; the text embed is a one-liner plus
> a share link. Type `/about` in Discord for the live roster.
>
> | Discord Command | Web App Tool |
> |-----------------|--------------|
> | `/extractor color`, `/extractor image` | Palette Extractor |
> | `/gradient` | Gradient Builder |
> | `/mixer` | Dye Mixer |
> | `/swatch` | Swatch Matcher |
> | `/contrast`, `/accessibility` | Accessibility Checker |
> | `/budget` | Budget Suggestions |
> | `/preset` commands | Community Presets |

Most colour options accept **either a hex code (`#FF6B6B`) or a dye name** (autocomplete). Every
`matching` option offers the same six methods: `ciede2000` (ΔE2000, the default), `oklab` (ΔEOK),
`cie76` (ΔE76), `redmean`, `rgb`, `distinguish` — set your own default with
`/preferences set matching:`.

---

## Color Tools

### /harmony
Generate harmonious dye combinations based on color theory.

**Usage**: `/harmony color:#FF6B6B type:triadic`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `color` | Starting hex color or dye name | Yes |
| `type` | complementary (default), analogous, triadic, split-complementary, tetradic, inverted-tetradic, square, monochromatic | No |
| `color_space` | Hue-rotation space: hsv (default), oklch, lch, hsl | No |
| `companions` | Companion dyes per slot (1-3) | No |
| `matching` | Matching method (see above) | No |
| `strict_matching` | Tighten the distance threshold | No |
| `prevent_duplicates` | Don't repeat a dye across slots | No |

---

### /extractor color
Find the closest FFXIV dyes to a colour (this is what `/match` used to do).

**Usage**: `/extractor color color:#FF6B6B count:5`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `color` | Hex color or dye name | Yes |
| `count` | Number of matches (1-10) | No |
| `matching` | Matching method | No |
| `prevent_duplicates` | Don't show the same dye twice | No |

---

### /extractor image
Extract colors from an image and match them to FFXIV dyes (this is what `/match_image` used to do).

**Usage**: `/extractor image image:<attach a file> colors:5`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `image` | Image file to analyze | Yes |
| `colors` | Number of colors to extract (3-10) | No |
| `vibrancy_boost` | Boost vibrancy of extracted colors (default: on) | No |
| `matching` | Matching method | No |
| `prevent_duplicates` | Don't map two slots to the same dye (default: on) | No |

---

### /gradient
Create a color gradient between two colours, with the closest dye at each step.

**Usage**: `/gradient start_color:Dalamud Red end_color:Jet Black steps:6`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `start_color` | Starting hex color or dye name | Yes |
| `end_color` | Ending hex color or dye name | Yes |
| `steps` | Gradient steps (2-12, default 6) | No |
| `color_space` | Interpolation: hsv (default), oklch, lab, lch, rgb, oklab, ryb, hsl, spectral | No |
| `matching` | Matching method | No |

---

### /mixer
Blend two dyes and see the closest real dyes at 25 / 40 / 50 / 65 / 80 %.

**Usage**: `/mixer dye1:Dalamud Red dye2:Metallic Gold mode:spectral`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `dye1`, `dye2` | The two dyes (hex or name) | Yes |
| `mode` | Blending algorithm: ryb (default, like the web app), spectral, oklab, lab, hsl, rgb | No |
| `matching` | Matching method | No |
| `count` | Closest matches to show (1-10) | No |

---

### /swatch
Match your character's colours to the nearest dyes from a `.chara` file (Anamnesis / Ktisis export).

**Usage**: `/swatch file:<attach .chara>`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `file` | `.chara` character file (1 MiB max) | Yes |
| `order` | `slots` (file order, default) or `hardest` (worst match first) | No |
| `slot` | Show the five nearest dyes for one slot: skin, hair, highlights, eyes, lip, facepaint, limbal | No |

See `/manual topic:character_file` for how to export the file.

---

## Dye Database

### /dye search
Search dyes by name.

**Usage**: `/dye search query:red`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `query` | Search term | Yes |

---

### /dye info
Get detailed information about a specific dye (colour values, source, market price incl. the consolidated Spectrum item, nearest dyes).

**Usage**: `/dye info name:Dalamud Red`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `name` | Dye name | Yes |

---

### /dye list
List dyes by category.

**Usage**: `/dye list category:Reds`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `category` | Reds, Browns, Yellows, Greens, Blues, Purples, Neutral, Special | No |

---

### /dye random
Show 5 randomly selected dyes.

**Usage**: `/dye random unique_categories:true`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `unique_categories` | At most one dye per category | No |

---

## Analysis

### /comparison
Compare 2-4 dyes side by side.

**Usage**: `/comparison dye1:Dalamud Red dye2:Jet Black`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `dye1`, `dye2` | Dyes to compare (hex or name) | Yes |
| `dye3`, `dye4` | Additional dyes | No |

---

### /contrast
WCAG non-text contrast (3:1 floor) between 2-4 dyes — one pair, a worst-first ledger for three, or a plot for four. New in 5.0.

**Usage**: `/contrast dye1:Snow White dye2:Soot Black`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `dye1`, `dye2` | Dyes to check (hex or name) | Yes |
| `dye3`, `dye4` | Additional dyes | No |

---

### /accessibility (or /a11y)
See how a dye — or a pair of dyes — looks under each kind of color vision.

**Usage**: `/accessibility dye:Dalamud Red dye2:Metallic Green vision:deuteranopia`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `dye` | Primary dye (hex or name) | Yes |
| `dye2` | Second dye — renders the pair frames | No |
| `vision` | all (default), protanopia, deuteranopia, tritanopia, achromatopsia | No |

`/a11y` is the same command under a shorter name.

---

### /budget
Find cheaper look-alikes for an expensive dye using live market board prices.

**Subcommands**:
- `/budget find target_dye:Metallic Gold world:Balmung` — the ledger of alternatives (options: `matching`, `max_distance` 2-20 ΔE2000 default 8, `exclude_coffers`, `exclude_wide_spectrum`)
- `/budget quick preset:jet_black` — one-click check for Pure White, Jet Black, Metallic Silver, Metallic Gold, Pastel Pink
- `/budget set_world world:Balmung` — save your world/datacenter so you can omit it

---

## Community

Preset categories: jobs, grand-companies, seasons, events, aesthetics, appearance, zones, raids-trials.

### /preset list
Browse community presets.

**Usage**: `/preset list category:jobs sort:popular`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `category` | Filter by category | No |
| `sort` | popular, recent, name | No |

---

### /preset show
View a specific preset.

**Usage**: `/preset show name:My Outfit`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `name` | Preset name (autocomplete) | Yes |

---

### /preset random
Get a random approved preset, optionally within a category.

---

### /preset submit
Submit a new community preset (goes to moderation first).

**Usage**: `/preset submit preset_name:My Outfit description:... category:jobs dye1:Dalamud Red dye2:Jet Black dye3:Soot Black`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `preset_name` | Preset name (2-50 characters) | Yes |
| `description` | Description (10-200 characters) | Yes |
| `category` | Preset category | Yes |
| `dye1`, `dye2` | First two dyes | Yes |
| `dye3`, `dye4`, `dye5` | More dyes | No |
| `tags` | Comma-separated tags (max 10) | No |

Community presets need **3 to 6 dyes**. Known issue in 5.0.0: bot-side `/preset submit` and
`/preset edit` are still being brought in line with the 5.0 preset rules and may be rejected —
submit from the web app's Community Presets tool in the meantime.

---

### /preset vote
Toggle your vote on a preset.

**Usage**: `/preset vote preset:My Outfit`

---

### /preset edit
Edit one of your own presets (name, description, tags, dyes — all optional).

---

### /preset favorite
Keep a list of community presets you like.

- `/preset favorite add preset_name:My Outfit`
- `/preset favorite remove preset_name:My Outfit`
- `/preset favorite list`

---

### Moderation (moderators, via the moderation bot)
`/preset moderate`, `/preset ban_user` and `/preset unban_user` belong to the separate XIV Dye Tools moderation bot, not this one.

---

## Utility

### /preferences
Your personal defaults — replaces the old `/language`.

- `/preferences show`
- `/preferences set language:ja` — also `matching`, `blending`, `count`, `clan`, `gender`, `world`, `market`, `show_hex` / `show_rgb` / `show_hsv` / `show_lab` / `show_deltae` / `show_acquisition`, and `theme:` (`dark` default or `light` cards)
- `/preferences reset key:language` (omit `key` to reset everything)
- `/preferences filters set metallic:true …` / `filters show` / `filters reset` — exclude dye types (metallic, pastel, dark, cosmic, ishgardian, expensive, vendor, craft) from results

Languages: en, ja, de, fr, ko, zh. All `/preferences` replies are private (ephemeral).

---

### /manual
Show the help guide, or a topic: `match_image`, `color_vision`, `contrast`, `matching_methods`, `spectrum_prices`, `character_file`.

**Usage**: `/manual topic:matching_methods`

---

### /changelog
What's new — the newest release expanded, older ones collapsed. `version:5.0.0` expands a specific release. Private reply.

---

### /about
Bot information, version, dye count, links, and (for one release) where each removed v4 command went.

---

### /stats
`/stats summary` is public; `overview`, `commands`, `preferences`, `health` are for authorised users only.

---

## Tips

- **Autocomplete** - Start typing and the bot suggests options
- **Dye names** - Use exact names or close matches
- **Colors** - Use standard hex format (#RRGGBB) or a dye name
- **Results** - Image commands include a card attachment and a share link into the web app
- **Card theme** - `/preferences set theme:light` if you prefer light cards

---

## Related Documentation

- [Getting Started](getting-started.md) - First steps with the bot
- [Favorites & Collections](favorites-collections.md) - What happened to `/favorites` and `/collection`
- [FAQ](faq.md) - Common questions
