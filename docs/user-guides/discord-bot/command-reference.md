# Discord Bot Command Reference

**Complete guide to all XIV Dye Tools Discord commands**

---

> **Web App v4 Terminology Note**
>
> The Discord bot retains the original command names for backwards compatibility. If you're familiar with the web app v4, here's how commands map:
>
> | Discord Command | Web App v4 Equivalent |
> |-----------------|----------------------|
> | `/match`, `/match_image` | Palette Extractor |
> | `/mixer` | Gradient Builder |
> | `/preset` commands | Community Presets |
>
> The functionality is identical—only the names differ.

---

## Color Tools

### /harmony
Generate harmonious dye combinations based on color theory.

**Usage**: `/harmony color:#FF6B6B type:triadic`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `color` | Starting hex color | Yes |
| `type` | Harmony type (complementary, triadic, analogous, etc.) | No (default: complementary) |

---

### /match
Find the closest FFXIV dye to a hex color.

> *Web App v4: This corresponds to "Palette Extractor"*

**Usage**: `/match color:#FF6B6B count:5`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `color` | Hex color to match | Yes |
| `count` | Number of matches (1-10) | No (default: 5) |

---

### /match_image
Extract colors from an image and match to FFXIV dyes.

**Usage**: `/match_image` (then upload image)

| Parameter | Description | Required |
|-----------|-------------|----------|
| `image` | Image file to analyze | Yes |
| `colors` | Number of colors to extract (3-8) | No (default: 5) |

---

### /mixer
Create a color gradient between two dyes.

> *Web App v4: This corresponds to "Gradient Builder"*

**Usage**: `/mixer start:Dalamud Red end:Jet Black steps:5`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `start` | Starting dye name | Yes |
| `end` | Ending dye name | Yes |
| `steps` | Gradient steps (3-10) | No (default: 5) |

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
Get detailed information about a specific dye.

**Usage**: `/dye info name:Dalamud Red`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `name` | Dye name | Yes |

---

### /dye list
List dyes by category.

**Usage**: `/dye list category:red`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `category` | Dye category (red, blue, green, etc.) | Yes |

---

### /dye random
Get random dye suggestions.

**Usage**: `/dye random count:3`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `count` | Number of random dyes (1-5) | No (default: 1) |
| `category` | Limit to category | No |

---

## Analysis

### /comparison
Compare 2-4 dyes side by side.

**Usage**: `/comparison dyes:Dalamud Red, Jet Black`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `dyes` | Comma-separated dye names (2-4) | Yes |

---

### /accessibility
Simulate how colors appear with color blindness.

**Usage**: `/accessibility color:#FF6B6B type:protanopia`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `color` | Hex color to simulate | Yes |
| `type` | Vision type | No (default: all types) |

---

## User Data

### /favorites
Manage your favorite dyes.

**Subcommands**:
- `/favorites list` - View all favorites
- `/favorites add name:Dalamud Red` - Add a favorite
- `/favorites remove name:Dalamud Red` - Remove a favorite

---

### /collection
Manage custom dye collections.

**Subcommands**:
- `/collection list` - List all collections
- `/collection show name:My Outfit` - View collection contents
- `/collection create name:Tank Glamour` - Create new collection
- `/collection add collection:Tank Glamour dye:Dalamud Red` - Add dye to collection
- `/collection remove collection:Tank Glamour dye:Dalamud Red` - Remove dye
- `/collection delete name:Tank Glamour` - Delete collection

---

## Community

### /preset list
Browse community presets.

**Usage**: `/preset list category:glamour sort:popular`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `category` | Filter by category | No |
| `sort` | Sort order (popular, new, hot) | No (default: hot) |

---

### /preset show
View a specific preset.

**Usage**: `/preset show id:123`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `id` | Preset ID | Yes |

---

### /preset submit
Submit a new community preset.

**Usage**: `/preset submit name:My Outfit dyes:Dalamud Red, Jet Black category:glamour`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `name` | Preset name | Yes |
| `dyes` | Comma-separated dye names (2-6) | Yes |
| `category` | Preset category | Yes |
| `description` | Description | No |

---

### /preset vote
Vote on a preset.

**Usage**: `/preset vote id:123 vote:up`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `id` | Preset ID | Yes |
| `vote` | Vote direction (up, down) | Yes |

---

### /preset ban_user (Moderators)
Ban a user from the preset system.

**Usage**: `/preset ban_user user:@username`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `user` | User to ban | Yes |

---

### /preset unban_user (Moderators)
Unban a user and restore their presets.

**Usage**: `/preset unban_user user:@username`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `user` | User to unban | Yes |

---

## Utility

### /language
Set your preferred language.

**Usage**: `/language lang:ja`

| Parameter | Description | Required |
|-----------|-------------|----------|
| `lang` | Language code (en, ja, de, fr, ko, zh) | Yes |

---

### /manual
Show the help guide.

**Usage**: `/manual`

---

### /about
Show bot information and version.

**Usage**: `/about`

---

### /stats (Moderators)
View usage statistics.

**Usage**: `/stats`

---

## Tips

- **Autocomplete** - Start typing and the bot suggests options
- **Dye names** - Use exact names or close matches
- **Colors** - Use standard hex format (#RRGGBB)
- **Results** - Most commands include image attachments

---

## Related Documentation

- [Getting Started](getting-started.md) - First steps with the bot
- [Favorites & Collections](favorites-collections.md) - Saving dyes
- [FAQ](faq.md) - Common questions
