# Getting Started with the Discord Bot

**Using XIV Dye Tools in your Discord server**

> **Coming from the v4 bot?** The v4
> commands `/match`, `/match_image`, `/favorites`, `/collection` and `/language` no longer exist:
> dye matching is `/extractor color` / `/extractor image`, language is `/preferences set language:`,
> and saved dyes/palettes live in the web app (only community *presets* can be favourited, via
> `/preset favorite`). `/contrast`, `/a11y` and `/changelog` are new; `/swatch` now reads a `.chara`
> file. Every result is a redrawn image card with a one-line embed and a share link into the web
> app. `/about` shows the live command roster.

---

## Adding the Bot

1. Click the **invite link** (available on the web app)
2. Select your Discord server
3. Approve the required permissions
4. The bot is now ready to use!

---

## Your First Command

Try the `/extractor color` command:

```
/extractor color color:#FF6B6B
```

The bot will respond with:
- The **closest FFXIV dyes** to that color, ranked by ΔE2000
- A **colour sheet** image showing each match and its distance
- A **share link** that opens the same result in the web app

---

## Command Categories

### Color Tools

| Command | Description | Example |
|---------|-------------|---------|
| `/extractor color` | Find closest dyes to a color | `/extractor color color:#FF6B6B` |
| `/extractor image` | Extract colors from an image | `/extractor image image:<attach>` |
| `/harmony` | Generate color harmonies | `/harmony color:#FF6B6B type:triadic` |
| `/gradient` | Gradient between two colours | `/gradient start_color:#FF0000 end_color:#0000FF` |
| `/mixer` | Blend two dyes | `/mixer dye1:Dalamud Red dye2:Metallic Gold` |
| `/swatch` | Match a `.chara` character file's colours | `/swatch file:<attach .chara>` |

> **Web app equivalents**
>
> | Discord Command | Web App Tool |
> |-----------------|--------------|
> | `/extractor color`, `/extractor image` | Palette Extractor |
> | `/gradient` | Gradient Builder |
> | `/mixer` | Dye Mixer |
> | `/swatch` | Swatch Matcher |
> | `/preset` commands | Community Presets |

### Dye Database

| Command | Description | Example |
|---------|-------------|---------|
| `/dye search` | Search dyes by name | `/dye search query:red` |
| `/dye info` | Get dye details | `/dye info name:Dalamud Red` |
| `/dye list` | List dyes by category | `/dye list category:Reds` |
| `/dye random` | Five random dyes | `/dye random` |

### Analysis

| Command | Description | Example |
|---------|-------------|---------|
| `/comparison` | Compare 2-4 dyes | `/comparison dye1:Dalamud Red dye2:Blood Red` |
| `/contrast` | WCAG contrast between 2-4 dyes | `/contrast dye1:Snow White dye2:Soot Black` |
| `/accessibility` (`/a11y`) | Color-vision simulation | `/accessibility dye:#FF6B6B` |
| `/budget` | Cheaper look-alike dyes | `/budget find target_dye:Jet Black` |

### Community Presets

| Command | Description | Example |
|---------|-------------|---------|
| `/preset list` | Browse presets | `/preset list category:jobs` |
| `/preset show` | View preset details | `/preset show name:My Outfit` |
| `/preset submit` | Submit new preset | `/preset submit preset_name:… category:… dye1:… dye2:… dye3:…` |
| `/preset vote` | Toggle your vote | `/preset vote preset:My Outfit` |
| `/preset favorite` | Favourite presets | `/preset favorite list` |

### Utility

| Command | Description | Example |
|---------|-------------|---------|
| `/preferences` | Language, matching method, card theme, world… | `/preferences set language:ja` |
| `/manual` | Show help | `/manual topic:match_image` |
| `/changelog` | What's new | `/changelog` |
| `/about` | Bot information | `/about` |

---

## Understanding the Results

When you use `/extractor color`, you'll see a colour-sheet card listing the nearest dyes and their distance. The v4 text layout looked roughly like this:

```
┌─────────────────────────────────────────────┐
│  Color Match Results                        │
├─────────────────────────────────────────────┤
│                                             │
│  Input: #FF6B6B                            │
│                                             │
│  ┌──────────┐    ┌──────────┐              │
│  │  Input   │    │ Dalamud  │              │
│  │  Color   │    │   Red    │              │
│  └──────────┘    └──────────┘              │
│                                             │
│  Match Quality: 92%                        │
│  Delta E: 8.5 (Noticeable difference)      │
│                                             │
│  Market Price: 1,234 gil (Gilgamesh)       │
│                                             │
└─────────────────────────────────────────────┘
```

### Delta E Scale

Distances are ΔE2000 by default (`matching:ciede2000`); other methods use their own calibrated bands.

| Value | Meaning |
|-------|---------|
| 0-1 | Imperceptible |
| 1-2 | Barely noticeable |
| 2-10 | Noticeable at a glance |
| 10-50 | Colors are similar |
| 50+ | Colors are different |

---

## Saving Favorites (removed in 5.0)

`/favorites` and `/collection` were removed in 5.0. Saved dyes and palettes now live in the web app
(every share link from the bot opens there). What you *can* keep in Discord is a list of favourite
community presets:

```
/preset favorite add preset_name:Tank Glamour
/preset favorite list
/preset favorite remove preset_name:Tank Glamour
```

---

## Extracting Colors from Images

Attach an image to the command:

```
/extractor image image:<attach a file>
```

The bot will:
1. Extract dominant colors using K-means++
2. Match each color to the closest FFXIV dye
3. Show a visual palette with dye recommendations

---

## Changing Your Language

The bot supports 6 languages:

```
/preferences set language:ja
```

Options:
- `en` - English
- `ja` - Japanese (日本語)
- `de` - German (Deutsch)
- `fr` - French (Français)
- `ko` - Korean (한국어)
- `zh` - Chinese (中文)

---

## Getting Help

### Full Manual

```
/manual
```

### Topic-Specific Help

```
/manual topic:match_image
```

Available topics:
- `match_image` - Image matching tips
- `color_vision` - Colour vision
- `contrast` - Contrast
- `matching_methods` - Matching methods
- `spectrum_prices` - Spectrum & prices
- `character_file` - Character (`.chara`) file

---

## Tips

### For Best Results

- Use hex colors (like `#FF6B6B`) for precise matching
- For images, use screenshots from the game for best accuracy
- Some colors don't have close FFXIV dye matches - that's normal!

### Rate Limits

To prevent abuse, commands have per-user rate limits:
- Most commands: 15 per minute (`/dye`: 20; `/accessibility` and `/budget`: 10)
- `/about`, `/manual`, `/stats`, `/changelog` are not limited

### Server Admins

- The bot only needs basic permissions
- All data is stored per-user, not per-server
- Commands work in any channel the bot can see

---

## Next Steps

- [Command Reference](command-reference.md) - All commands in detail
- [Favorite Presets & Preferences](favorites-collections.md) - `/preset favorite`, `/preferences`, and what happened to `/favorites` and `/collection`
- [FAQ](faq.md) - Common questions

---

## Need Help?

- Use `/manual` for in-bot help
- Check the [FAQ](faq.md)
- Report issues on [GitHub](https://github.com/your-repo/issues)
