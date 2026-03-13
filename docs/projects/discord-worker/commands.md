# Discord Bot Command Reference (v4.1.2)

Full reference for all 20 slash commands in the XIV Dye Tools Discord bot.

---

## Rate Limits

| Tier | Commands | Limit |
|------|----------|-------|
| Image | `/extractor`, `/gradient`, `/mixer`, `/swatch`, `/budget`, `/comparison`, `/accessibility`, `/harmony` | 5 requests/min |
| Standard | `/dye`, `/preset`, `/favorites`, `/collection`, `/language`, `/preferences`, `/stats` | 15 requests/min |
| Unlimited | `/about`, `/manual` | No limit |

## Deferred Response Pattern

All image-generating commands use Discord's deferred response (interaction response type 5). The bot acknowledges the interaction immediately, renders the image as a PNG via resvg-wasm, then edits the original response with the final embed and attached image.

---

## Color Tools

### /harmony

Generate harmonious dye combinations based on color theory.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye` | String (autocomplete) | Yes | Base dye to generate harmonies from |
| `type` | String (choice) | Yes | Harmony type: `complementary`, `analogous`, `triadic`, `split-complementary`, `tetradic`, `monochromatic` |
| `count` | Integer (1-10) | No | Number of results to return. Default: `5` |

Returns an embed with color swatches showing the base dye and its harmonious matches from the 136-dye database.

**Example usage:**
```
/harmony dye:Soot Black type:complementary count:3
/harmony dye:Dalamud Red type:triadic
```

**Rate limit:** 5/min (image tier)

---

### /extractor

Extract colors from an image or color value and match them to FFXIV dyes. Uses K-means++ clustering for image analysis and k-d tree matching against the dye database.

#### Subcommand: `image`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `image` | Attachment | Yes | Image file to extract colors from |

#### Subcommand: `color`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `color` | String | Yes | Color value as hex (`#FF0000`) or RGB (`rgb(255,0,0)`) |

v4.1.x fix: Duplicate results are now filtered out when multiple extracted colors map to the same dye.

**Example usage:**
```
/extractor image [attach screenshot]
/extractor color color:#8B0000
/extractor color color:rgb(139,0,0)
```

**Rate limit:** 5/min (image tier)

---

### /gradient

Create a color gradient between two dyes, showing intermediate dye matches along the path.

Was `/mixer` in v3; renamed in v4 when the new blending-focused `/mixer` was introduced.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye1` | String (autocomplete) | Yes | Starting dye |
| `dye2` | String (autocomplete) | Yes | Ending dye |
| `steps` | Integer (3-10) | No | Number of gradient steps. Default: `5` |
| `mode` | String (choice) | No | Color interpolation mode: `RGB`, `HSV`, `LAB`, `OKLCH`, `LCH`. Default: `LAB` |

**Example usage:**
```
/gradient dye1:Snow White dye2:Soot Black steps:7 mode:OKLCH
/gradient dye1:Dalamud Red dye2:Metallic Gold
```

**Rate limit:** 5/min (image tier)

---

### /mixer

Blend two dyes together at a specified ratio. New in v4. Uses the `@xivdyetools/color-blending` library for perceptually accurate blending across multiple color spaces.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye1` | String (autocomplete) | Yes | First dye |
| `dye2` | String (autocomplete) | Yes | Second dye |
| `ratio` | Integer (0-100) | No | Blend ratio (0 = 100% dye1, 100 = 100% dye2). Default: `50` |
| `mode` | String (choice) | No | Blending mode: `rgb`, `lab`, `oklab`, `ryb`, `hsl`, `spectral`. Default: `oklab` |

**Example usage:**
```
/mixer dye1:Dalamud Red dye2:Metallic Gold ratio:30 mode:spectral
/mixer dye1:Pastel Pink dye2:Cream Yellow
```

**Rate limit:** 5/min (image tier)

---

### /swatch

Match character customization colors (skin tones, hair colors) to the closest FFXIV dyes. New in v4.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `clan` | String (choice) | Yes | Character clan (e.g., Midlander, Xaela, Veena, etc.) |
| `gender` | String (choice) | Yes | Character gender: `male`, `female` |
| `type` | String (choice) | Yes | Customization type: `skin`, `hair` |

**Example usage:**
```
/swatch clan:Xaela gender:female type:skin
/swatch clan:Midlander gender:male type:hair
```

**Rate limit:** 5/min (image tier)

---

### /budget

Find affordable dye alternatives via the Universalis market board API. New in v4.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye` | String (autocomplete) | Yes | Target dye to find alternatives for |
| `world` | String (autocomplete) | Yes | FFXIV world/server name |
| `max_price` | Integer | No | Maximum gil price filter |
| `count` | Integer | No | Number of alternatives to show |

v4.1.x additions: Cosmic dye quick picks featuring 20 new Dawntrail dyes. Uses `fetchPricesBatched` to handle all 136 dyes (Universalis max 100 items per request). Filters out Facewear dyes (`itemID > 0`) since they have no market board listings.

**Example usage:**
```
/budget dye:Metallic Gold world:Balmung max_price:5000 count:5
/budget dye:Dalamud Red world:Gilgamesh
```

**Rate limit:** 5/min (image tier)

---

## Dye Database

All dye database commands are subcommands under the `/dye` parent command.

### /dye search

Search for dyes by name. Supports autocomplete with localized dye names (en, ja, de, fr, ko, zh).

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | String (autocomplete) | Yes | Dye name to search for |

**Example usage:**
```
/dye search name:Dalamud
/dye search name:metallic
```

**Rate limit:** 15/min (standard tier)

---

### /dye info

Get detailed information about a specific dye, including hex color value, RGB components, dye category, item ID, and preview swatch.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye` | String (autocomplete) | Yes | Dye to look up |

**Example usage:**
```
/dye info dye:Soot Black
/dye info dye:Metallic Gold
```

**Rate limit:** 15/min (standard tier)

---

### /dye list

List all dyes in a given category.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `category` | String (choice) | Yes | Dye category (e.g., Red, Brown, Yellow, Green, Blue, Purple, White, Black, Metallic, Pastel, Cosmic, Facewear) |

**Example usage:**
```
/dye list category:Metallic
/dye list category:Cosmic
```

**Rate limit:** 15/min (standard tier)

---

### /dye random

Get a random dye suggestion from the database.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `category` | String (choice) | No | Optionally restrict to a specific dye category |

**Example usage:**
```
/dye random
/dye random category:Pastel
```

**Rate limit:** 15/min (standard tier)

---

## Analysis

### /comparison

Compare 2-4 dyes side by side. Shows color swatches, hex values, and deltaE (CIEDE2000) perceptual distance between each pair.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye1` | String (autocomplete) | Yes | First dye |
| `dye2` | String (autocomplete) | Yes | Second dye |
| `dye3` | String (autocomplete) | No | Third dye |
| `dye4` | String (autocomplete) | No | Fourth dye |

**Example usage:**
```
/comparison dye1:Soot Black dye2:Ink Blue
/comparison dye1:Dalamud Red dye2:Blood Red dye3:Wine Red dye4:Rust Red
```

**Rate limit:** 5/min (image tier)

---

### /accessibility

Simulate how dyes appear under various forms of colorblindness.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye` | String (autocomplete) | Yes | Dye to simulate |
| `type` | String (choice) | No | Colorblindness type: `deuteranopia` (red-green, most common), `protanopia` (red-green), `tritanopia` (blue-yellow), `achromatopsia` (total). Default: shows all |

**Example usage:**
```
/accessibility dye:Dalamud Red
/accessibility dye:Metallic Green type:deuteranopia
```

**Rate limit:** 5/min (image tier)

---

## User Data (Deprecated)

These commands are deprecated in v4 and will be removed in a future release. Users should migrate to the `/preset` system.

### /favorites

Manage your favorite dyes list.

> **Deprecated** -- use `/preset` instead.

| Subcommand | Description |
|------------|-------------|
| `add` | Add a dye to favorites |
| `remove` | Remove a dye from favorites |
| `list` | Show all favorite dyes |

**Rate limit:** 15/min (standard tier)

---

### /collection

Manage custom dye collections.

> **Deprecated** -- use `/preset` instead.

| Subcommand | Description |
|------------|-------------|
| `create` | Create a new collection |
| `add` | Add a dye to a collection |
| `remove` | Remove a dye from a collection |
| `list` | List all collections |
| `show` | Show dyes in a collection |
| `delete` | Delete a collection |

**Rate limit:** 15/min (standard tier)

---

## Community Presets

All preset commands are subcommands under the `/preset` parent command. Presets are stored in the presets-api Cloudflare Worker (D1 database) and moderated via the moderation-worker.

### /preset list

Browse community presets with pagination and optional category filtering.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `category` | String (choice) | No | Filter by preset category |
| `page` | Integer | No | Page number for pagination. Default: `1` |

**Example usage:**
```
/preset list
/preset list category:glamour page:2
```

**Rate limit:** 15/min (standard tier)

---

### /preset show

View details of a specific community preset, including dye swatches, author, description, and tags.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | String | Yes | Preset ID |

**Example usage:**
```
/preset show id:abc123
```

**Rate limit:** 15/min (standard tier)

---

### /preset random

Get a random approved community preset.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `category` | String (choice) | No | Optionally restrict to a category |

**Example usage:**
```
/preset random
/preset random category:glamour
```

**Rate limit:** 15/min (standard tier)

---

### /preset submit

Submit a new preset for community review. Submitted presets go through moderation before appearing publicly.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | String | Yes | Preset name |
| `description` | String | Yes | Description of the preset |
| `dye1` | String (autocomplete) | Yes | First dye (minimum 2 dyes required) |
| `dye2` | String (autocomplete) | Yes | Second dye |
| `dye3` | String (autocomplete) | No | Third dye |
| `dye4` | String (autocomplete) | No | Fourth dye |
| `dye5` | String (autocomplete) | No | Fifth dye (maximum 5) |
| `tags` | String | No | Comma-separated tags |

**Example usage:**
```
/preset submit name:Dark Knight Vibes description:Edgy dark palette dye1:Soot Black dye2:Ink Blue dye3:Gunmetal Black tags:dark,tank,drk
```

**Rate limit:** 15/min (standard tier)

---

### /preset vote

Vote on a community preset (upvote or downvote). One vote per user per preset.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `id` | String | Yes | Preset ID to vote on |
| `vote` | String (choice) | Yes | Vote direction: `up`, `down` |

**Example usage:**
```
/preset vote id:abc123 vote:up
```

**Rate limit:** 15/min (standard tier)

---

## Utility

### /language

Set your preferred display language for bot responses.

> **Deprecated** -- use `/preferences` instead.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `language` | String (choice) | Yes | Language: `en`, `ja`, `de`, `fr`, `ko`, `zh` |

**Example usage:**
```
/language language:ja
```

**Rate limit:** 15/min (standard tier)

---

### /preferences

Set user preferences for the bot. New in v4. Replaces the deprecated `/language` command and adds additional personalization options.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `world` | String (autocomplete) | No | Default FFXIV world/server |
| `datacenter` | String (choice) | No | Default datacenter |
| `clan` | String (choice) | No | Default character clan |
| `language` | String (choice) | No | Display language: `en`, `ja`, `de`, `fr`, `ko`, `zh` |
| `display` | String (choice) | No | Display preference for color values |

All options are optional; only provided values are updated. Preferences persist across sessions.

**Example usage:**
```
/preferences world:Balmung language:en
/preferences clan:Xaela datacenter:Crystal
```

**Rate limit:** 15/min (standard tier)

---

### /manual

Show the help guide with an overview of available commands and usage tips.

**Example usage:**
```
/manual
```

**Rate limit:** Unlimited

---

### /about

Display bot information including version number, uptime, server count, library versions, and links.

**Example usage:**
```
/about
```

**Rate limit:** Unlimited

---

### /stats

View bot usage statistics. Restricted to authorized users only.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `period` | String (choice) | No | Time period: `day`, `week`, `month`, `all`. Default: `week` |

**Example usage:**
```
/stats
/stats period:month
```

**Rate limit:** 15/min (standard tier)

---

## Related Documentation

- [Overview](overview.md) -- Discord worker architecture and project structure
- [Interactions](interactions.md) -- Interaction handling, deferred responses, and autocomplete
- [Rendering](rendering.md) -- SVG generation, resvg-wasm rendering, and CJK font subsetting
- [Deployment](deployment.md) -- Wrangler configuration, environment variables, and CI/CD
