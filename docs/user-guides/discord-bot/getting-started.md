# Getting Started with the Discord Bot

**Using XIV Dye Tools in your Discord server**

---

## Adding the Bot

1. Click the **invite link** (available on the web app)
2. Select your Discord server
3. Approve the required permissions
4. The bot is now ready to use!

---

## Your First Command

Try the `/match` command:

```
/match color:#FF6B6B
```

The bot will respond with:
- The **closest FFXIV dye** to that color
- A **visual comparison** image
- The **color difference** (deltaE)
- **Market price** information

---

## Command Categories

### Color Tools

| Command | Description | Example |
|---------|-------------|---------|
| `/match` | Find closest dye to a color | `/match color:#FF6B6B` |
| `/match_image` | Extract colors from image | `/match_image` + attach image |
| `/harmony` | Generate color harmonies | `/harmony color:#FF6B6B type:triadic` |
| `/mixer` | Create gradient between colors | `/mixer start:#FF0000 end:#0000FF` |

> **Web App v4 Terminology Note**
>
> The Discord bot uses the original command names for backwards compatibility. Here's how they map to the v4 web app:
>
> | Discord Command | Web App v4 Tool |
> |-----------------|-----------------|
> | `/match`, `/match_image` | Palette Extractor |
> | `/mixer` | Gradient Builder |
> | `/preset` commands | Community Presets |

### Dye Database

| Command | Description | Example |
|---------|-------------|---------|
| `/dye search` | Search dyes by name | `/dye search query:red` |
| `/dye info` | Get dye details | `/dye info name:Dalamud Red` |
| `/dye list` | List dyes by category | `/dye list category:red` |
| `/dye random` | Get random dye | `/dye random` |

### Analysis

| Command | Description | Example |
|---------|-------------|---------|
| `/comparison` | Compare multiple dyes | `/comparison dye1:Dalamud Red dye2:Blood Red` |
| `/accessibility` | Colorblindness simulation | `/accessibility color:#FF6B6B` |

### User Data

| Command | Description | Example |
|---------|-------------|---------|
| `/favorites` | Manage your favorites | `/favorites list` |
| `/favorites add` | Add a favorite | `/favorites add dye:Dalamud Red` |
| `/collection` | Manage collections | `/collection list` |

### Community Presets

| Command | Description | Example |
|---------|-------------|---------|
| `/preset list` | Browse presets | `/preset list category:glamour` |
| `/preset show` | View preset details | `/preset show id:abc123` |
| `/preset submit` | Submit new preset | `/preset submit` (opens form) |
| `/preset vote` | Vote on preset | `/preset vote id:abc123 vote:up` |

### Utility

| Command | Description | Example |
|---------|-------------|---------|
| `/language` | Set your language | `/language lang:ja` |
| `/manual` | Show help | `/manual topic:match_image` |
| `/about` | Bot information | `/about` |

---

## Understanding the Results

When you use `/match`, you'll see:

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

| Value | Meaning |
|-------|---------|
| 0-1 | Imperceptible |
| 1-2 | Barely noticeable |
| 2-10 | Noticeable at a glance |
| 10-50 | Colors are similar |
| 50+ | Colors are different |

---

## Saving Favorites

### Add a Favorite

```
/favorites add dye:Dalamud Red
```

### List Your Favorites

```
/favorites list
```

### Remove a Favorite

```
/favorites remove dye:Dalamud Red
```

### Clear All Favorites

```
/favorites clear
```

**Limits:**
- Maximum 20 favorites
- Synced with your Discord account (works across servers)

---

## Creating Collections

Collections let you group related dyes:

### Create a Collection

```
/collection create name:Tank Glamour
```

### Add Dyes to Collection

```
/collection add collection:Tank Glamour dye:Dalamud Red
```

### View Collection

```
/collection show name:Tank Glamour
```

### Delete Collection

```
/collection delete name:Tank Glamour
```

**Limits:**
- Maximum 50 collections
- Maximum 20 dyes per collection

---

## Extracting Colors from Images

Upload an image with your message:

```
/match_image
```

Then attach your image. The bot will:
1. Extract dominant colors using K-means++
2. Match each color to the closest FFXIV dye
3. Show a visual palette with dye recommendations

---

## Changing Your Language

The bot supports 6 languages:

```
/language lang:ja
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
- `match` - Color matching
- `match_image` - Image extraction
- `harmony` - Color harmonies
- `favorites` - Favorites system
- `collections` - Collections system
- `presets` - Community presets

---

## Tips

### For Best Results

- Use hex colors (like `#FF6B6B`) for precise matching
- For images, use screenshots from the game for best accuracy
- Some colors don't have close FFXIV dye matches - that's normal!

### Rate Limits

To prevent abuse, commands have rate limits:
- Image processing: 5 per minute
- Standard commands: 15 per minute

### Server Admins

- The bot only needs basic permissions
- All data is stored per-user, not per-server
- Commands work in any channel the bot can see

---

## Next Steps

- [Command Reference](command-reference.md) - All commands in detail
- [Favorites & Collections](favorites-collections.md) - Organize your dyes
- [FAQ](faq.md) - Common questions

---

## Need Help?

- Use `/manual` for in-bot help
- Check the [FAQ](faq.md)
- Report issues on [GitHub](https://github.com/your-repo/issues)
