# Discord Bot Command Reference (v5.0.0)

Reference for the XIV Dye Tools Discord bot's slash commands.

## The roster of record

`apps/discord-worker/src/commands/registry.ts` holds `COMMAND_REGISTRY` — the authoritative list.
The registration script asserts schema parity against it, `/about` builds its index from it, and
`about.test.ts` asserts roster parity, so a command cannot exist in the dispatch switch, the
registration schema, and `/about` in three different states. **If this document and the registry
disagree, the registry is right.**

**17 registrations, 16 distinct commands:**

| Category | Commands |
|----------|----------|
| Colour tools | `/harmony`, `/mixer`, `/gradient`, `/extractor`, `/swatch` |
| Dye database | `/dye` |
| Analysis | `/comparison`, `/contrast`, `/accessibility`, `/a11y`, `/budget` |
| Community | `/preset` |
| Utility | `/preferences`, `/manual`, `/changelog`, `/about`, `/stats` |

`/a11y` is a second registration sharing the `/accessibility` handler — Discord has no alias
mechanism, so an alias costs a registration slot.

### Changed in 5.0

- **`/contrast` added** — WCAG 1.4.11 contrast pairs, split out of `/accessibility`
- **`/changelog` added** — release notes in Discord
- **`/favorites` and `/collection` removed** as top-level commands. Preset favourites now live
  under **`/preset favorite`** (`add` / `remove` / `list`)
- **`/language` removed** as a top-level command — it is now `/preferences set language:`
- **`/match` and `/match_image` removed** — dye matching lives in `/extractor color` and
  `/extractor image`
- **`/swatch` reshaped** — the `color` / `grid` subcommands are gone; it now takes a required
  `.chara` character-file attachment
- **`/accessibility` went pair-based** (`dye`, optional `dye2`, `vision`); its old `dye3`–`dye6`
  contrast inputs moved to `/contrast`
- **Matching vocabulary** on every `matching` option: `ciede2000` (default) / `oklab` / `cie76` /
  `redmean` / `rgb` / `distinguish` — `hyab` and `oklch-weighted` are retired (stored preferences
  normalise on read)
- **`/preset` categories**: `community` dropped; `appearance`, `zones`, `raids-trials` added

Any of these changes require re-running `register-commands`; deploying the worker alone does not
update Discord's copy of the roster. On merge to `main` the deploy workflow runs it automatically.

The option tables below are transcribed from `src/commands/schemas.ts`; when in doubt, read the
schema.

---

## Rate Limits

Per-user, per-command sliding windows (`checkRateLimit` in `src/index.ts`, presets from
`@xivdyetools/worker-kit/rate-limiter` — `DISCORD_COMMAND_LIMITS`, keyed by the **top-level**
command name; unlisted commands fall through to `default`).

| Commands | Limit |
|----------|-------|
| `/dye` | 20 requests/min |
| `/accessibility`, `/budget` | 10 requests/min |
| `/harmony`, `/mixer`, `/comparison` | 15 requests/min |
| `/extractor`, `/gradient`, `/swatch`, `/contrast`, `/a11y`, `/preset`, `/preferences` (default tier) | 15 requests/min |
| `/about`, `/manual`, `/stats`, `/changelog` | Not rate limited |
| Autocomplete | 60/min + 10 burst (fail-soft — limited requests return empty choices) |

## Deferred Response Pattern

All image-generating commands use Discord's deferred response (interaction response type 5). The bot acknowledges the interaction immediately, renders the card as a PNG via resvg-wasm, then edits the original response with the final embed and attached image. Since 5.0 the embed is one line plus a share URL — the PNG carries the content.

---

## Color Tools

### /harmony

Generate harmonious dye combinations based on color theory. Renders the 11A ideal-vs-found card.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `color` | String (autocomplete) | Yes | Base color — hex code (`#FF5733`) or dye name |
| `type` | String (choice) | No | `complementary` (default), `analogous`, `triadic`, `split-complementary`, `tetradic`, `inverted-tetradic`, `square`, `monochromatic` |
| `color_space` | String (choice) | No | Hue-rotation space: `hsv` (default), `oklch`, `lch`, `hsl` |
| `companions` | Integer (1-3) | No | Companion dyes per harmony slot |
| `matching` | String (choice) | No | `ciede2000` (default), `oklab`, `cie76`, `redmean`, `rgb`, `distinguish` |
| `strict_matching` | Boolean | No | Tighten the distance threshold |
| `prevent_duplicates` | Boolean | No | Deduplicate dyes across harmony slots |

**Example usage:**
```
/harmony color:Soot Black type:complementary
/harmony color:#FF6B6B type:triadic color_space:oklch
```

**Rate limit:** 15/min

---

### /extractor

Extract colors from an image or a single color value and match them to FFXIV dyes. Image pixels are fetched through the `IMAGE_WORKER` service binding (`POST /extract` on `xivdyetools-image-worker`) and clustered with K-means++; `color` ranks by ΔE2000 over the whole non-Facewear pool.

#### Subcommand: `color` (14J·2 colour sheet)

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `color` | String (autocomplete) | Yes | Color to match — hex code or dye name |
| `count` | Integer (1-10) | No | Number of matches (default 1) |
| `matching` | String (choice) | No | `ciede2000`, `oklab`, `cie76`, `redmean`, `rgb`, `distinguish` — **registered but not yet read by the `color` handler**, which always ranks by ΔE2000 (`handlers/commands/extractor.ts` TODO) |
| `prevent_duplicates` | Boolean | No | Avoid showing the same dye twice |

#### Subcommand: `image` (14K ramp)

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `image` | Attachment | Yes | Image to analyze |
| `colors` | Integer (3-10) | No | Number of colors to extract |
| `vibrancy_boost` | Boolean | No | Boost vibrancy of extracted colors (default: true) |
| `matching` | String (choice) | No | As above |
| `prevent_duplicates` | Boolean | No | Avoid mapping multiple slots to the same dye (default: true) |

> The `image` handler currently reads only `image` and `colors`; `vibrancy_boost`, `matching` and `prevent_duplicates` are registered but not consulted (dedup is applied unconditionally; matching uses `PaletteService.extractAndMatchPalette`'s default) — see the TODO in `handlers/commands/extractor.ts`.

**Example usage:**
```
/extractor image [attach screenshot] colors:6
/extractor color color:#8B0000 count:5
```

**Rate limit:** 15/min

---

### /gradient

Create a color gradient between two colors, showing intermediate dye matches along the path (12H strip). Was `/mixer` in v3; renamed in v4 when the blending-focused `/mixer` was introduced.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `start_color` | String (autocomplete) | Yes | Starting color — hex or dye name |
| `end_color` | String (autocomplete) | Yes | Ending color — hex or dye name |
| `steps` | Integer (2-12) | No | Number of color steps (default: 6) |
| `color_space` | String (choice) | No | Interpolation mode: `hsv` (default), `oklch`, `lab`, `lch`, `rgb`, `oklab`, `ryb`, `hsl`, `spectral` |
| `matching` | String (choice) | No | `ciede2000` (default), `oklab`, `cie76`, `redmean`, `rgb`, `distinguish` |

**Example usage:**
```
/gradient start_color:Snow White end_color:Soot Black steps:7 color_space:oklch
/gradient start_color:#FF0000 end_color:Metallic Gold
```

**Rate limit:** 15/min

---

### /mixer

Blend two dyes across a ratio sweep (25/40/50/65/80 %, 12F card) using `@xivdyetools/core/blending`. New in v4; since 5.0 it defers and attaches a PNG.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye1` | String (autocomplete) | Yes | First dye — hex or dye name |
| `dye2` | String (autocomplete) | Yes | Second dye — hex or dye name |
| `mode` | String (choice) | No | Blending algorithm: `rgb`, `lab`, `oklab`, `ryb`, `hsl`, `spectral` (default from `/preferences set blending`, else `ryb` — `PREFERENCE_DEFAULTS.blending`, the same default as the web app's Mixer) |
| `matching` | String (choice) | No | `ciede2000` (default), `oklab`, `cie76`, `redmean`, `rgb`, `distinguish` |
| `count` | Integer (1-10) | No | Number of closest dye matches to show |

**Example usage:**
```
/mixer dye1:Dalamud Red dye2:Metallic Gold mode:spectral
/mixer dye1:Pastel Pink dye2:Cream Yellow
```

**Rate limit:** 15/min

---

### /swatch

Match a character file's colours to the nearest dyes. 5.0 replaced the v4 `color` / `grid` subcommands with a required `.chara` attachment (Anamnesis / Ktisis export, 1 MiB cap): core's `parseCharaFile` + `resolveCharaColors` resolve the live slots (skin, hair, highlights, eyes, lip, face paint, tattoo/limbal), and the swatch card shows five rows. `slot:` routes to the 14J·2 colour sheet for one slot instead.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `file` | Attachment | Yes | `.chara` character file |
| `order` | String (choice) | No | Row order: `slots` (file order, default) or `hardest` (worst match first) — both show the same five rows |
| `slot` | String (choice) | No | Show the five nearest dyes for one slot: `skin`, `hair`, `highlights`, `eyes`, `lip`, `facepaint`, `limbal` |

**Example usage:**
```
/swatch file:[attach .chara]
/swatch file:[attach .chara] slot:hair
```

**Rate limit:** 15/min

---

### /budget

Find affordable dye alternatives via the Universalis market board (through the `UNIVERSALIS_PROXY` binding → `xivdyetools-api-worker`). New in v4; 5.0 replaced the alternatives list with the 13G ledger (`findBudgetLedger`): tier-group pricing (Type-A = min(vendor 216 gil, board 52254), Type-B/C = the consolidated board figure), gil-per-ΔE pinned to ΔE2000, unpriced rows left blank.

#### Subcommand: `find`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `target_dye` | String (autocomplete) | Yes | The expensive dye you want alternatives for |
| `world` | String (autocomplete) | No | World or datacenter (uses the saved preference if not set) |
| `matching` | String (choice) | No | Method for the ΔE column: `ciede2000` (default), `oklab`, `cie76`, `redmean`, `rgb`, `distinguish` |
| `max_distance` | Integer (2-20) | No | Match line — furthest ΔE2000 to consider (default: 8) |
| `exclude_coffers` | Boolean | No | Remove Venture Coffer dyes |
| `exclude_wide_spectrum` | Boolean | No | Remove Wide Spectrum #1/#2 |

#### Subcommand: `set_world`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `world` | String (autocomplete) | Yes | World or datacenter name to save |

#### Subcommand: `quick`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `preset` | String (choice) | Yes | `pure_white`, `jet_black`, `metallic_silver`, `metallic_gold`, `pastel_pink` |
| `world` | String (autocomplete) | No | World or datacenter (uses the saved preference if not set) |

Uses `fetchPricesBatched` to handle all 125 dyes (Universalis caps a request at 100 items). Facewear colours are not dyes and never enter the price path. Post-Patch 7.5 the budget calculator uses `getMarketItemID()` so the 105 consolidated dyes share three real itemIDs (Type-A=52254, Type-B=52255, Type-C=52256).

**Example usage:**
```
/budget find target_dye:Metallic Gold world:Balmung max_distance:10
/budget quick preset:jet_black
```

**Rate limit:** 10/min

---

## Dye Database

All dye database commands are subcommands under the `/dye` parent command.

### /dye search

Search for dyes by name. Supports autocomplete with localized dye names (en, ja, de, fr, ko, zh).

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `query` | String (autocomplete) | Yes | Search term (dye name) |

**Example usage:**
```
/dye search query:Dalamud
/dye search query:metallic
```

---

### /dye info

Get detailed information about a specific dye (11B sheet: dye-coloured band, numeric grid, source / market rows including the consolidated Spectrum item, nearest-dyes strip).

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | String (autocomplete) | Yes | Dye name |

**Example usage:**
```
/dye info name:Soot Black
```

---

### /dye list

List dyes in a category.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `category` | String (choice) | No | `Reds`, `Browns`, `Yellows`, `Greens`, `Blues`, `Purples`, `Neutral`, `Special` |

**Example usage:**
```
/dye list category:Reds
```

---

### /dye random

Show 5 randomly selected dyes (11B table).

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `unique_categories` | Boolean | No | Limit to 1 dye per category (default: false) |

**Rate limit (all `/dye`):** 20/min

---

## Analysis

### /comparison

Compare 2-4 dyes side by side — 14A duel (2), 14C·2 triangle (3) or 14C coded triangle (4) with hex values and ΔE2000 between each pair.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye1` | String (autocomplete) | Yes | First dye — hex or dye name |
| `dye2` | String (autocomplete) | Yes | Second dye |
| `dye3` | String (autocomplete) | No | Third dye |
| `dye4` | String (autocomplete) | No | Fourth dye |

**Example usage:**
```
/comparison dye1:Soot Black dye2:Ink Blue
/comparison dye1:Dalamud Red dye2:Blood Red dye3:Wine Red dye4:Rust Red
```

**Rate limit:** 15/min

---

### /contrast

WCAG 1.4.11 non-text contrast between dye pairs (floor 3:1). New in 5.0 — split out of `/accessibility`. Routed by count: 2 dyes → one pair (13A), 3 → ledger of every pair worst-first (13B), 4 → log-axis plot with the 3 / 4.5 / 7 criterion lines (13C·1). Four dyes is the schema-enforced limit; there are no AA/AAA letter grades.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye1` | String (autocomplete) | Yes | First dye — hex or dye name |
| `dye2` | String (autocomplete) | Yes | Second dye |
| `dye3` | String (autocomplete) | No | Third dye |
| `dye4` | String (autocomplete) | No | Fourth dye |

**Rate limit:** 15/min

---

### /accessibility (alias `/a11y`)

How a dye or a pair of dyes survives each kind of color vision (Brettel simulation, ΔE2000 separation between the simulated colours). One dye renders 13H (a shift is not a risk — no verdict); a pair renders 13D (one named lens) or 13E (`vision:all`, worst lens named).

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `dye` | String (autocomplete) | Yes | Primary dye — hex or dye name |
| `dye2` | String (autocomplete) | No | Second dye — renders the pair frames |
| `vision` | String (choice) | No | `all` (default), `protanopia`, `deuteranopia`, `tritanopia`, `achromatopsia` |

`/a11y` carries the identical option list (`ACCESSIBILITY_OPTIONS` is shared); the card chip prints whichever name the user typed.

**Example usage:**
```
/accessibility dye:Dalamud Red
/a11y dye:Metallic Green dye2:Metallic Red vision:deuteranopia
```

**Rate limit:** `/accessibility` 10/min; `/a11y` 15/min (default tier — the limiter keys on the registered name)

---

## User Data — ❌ REMOVED in v5.0

`/favorites` and `/collection` are **no longer registered commands**, and `src/services/user-storage.ts` (their KV store) is deleted. Saved dyes/palettes live in the web app; preset favourites moved under `/preset favorite` (`add` / `remove` / `list`). `/about` names where each removed command went for one release, and `scripts/cleanup-v4-kv.ts` lists the orphaned `xivdye:favorites:v1:*` / `xivdye:collections:v1:*` / `i18n:user:*` keys for a user-run delete.

---

## Community Presets

All preset commands are subcommands under the `/preset` parent command. Presets are stored in the presets-api Cloudflare Worker (D1 database) and moderated via the moderation-worker (which owns `/preset moderate`, `/preset ban_user`, `/preset unban_user`). 5.0 presets are stainID-keyed; the bot resolves them via `dyeService.getByStainId()`.

Category choices (`PRESET_CATEGORY_CHOICES`, typed against `PresetCategory`): `jobs`, `grand-companies`, `seasons`, `events`, `aesthetics`, `appearance`, `zones`, `raids-trials`. `community` was retired in 5.0.

### /preset list

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `category` | String (choice) | No | Filter by category |
| `sort` | String (choice) | No | `popular`, `recent`, `name` |

### /preset show

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `name` | String (autocomplete) | Yes | Preset name |

### /preset random

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `category` | String (choice) | No | Optionally restrict to a category |

### /preset submit

Submit a new preset for community review. Submitted presets go through moderation before appearing publicly.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `preset_name` | String | Yes | Preset name (2-50 characters) |
| `description` | String | Yes | Description (10-200 characters) |
| `category` | String (choice) | Yes | Preset category (see list above) |
| `dye1` | String (autocomplete) | Yes | First dye |
| `dye2` | String (autocomplete) | Yes | Second dye |
| `dye3` | String (autocomplete) | No | Third dye |
| `dye4` | String (autocomplete) | No | Fourth dye |
| `dye5` | String (autocomplete) | No | Fifth dye |
| `tags` | String | No | Comma-separated tags (max 10) |

> **Known issue (5.0.0):** `/preset submit` and `/preset edit` still send legacy itemIDs and accept
> 2–5 dyes, while presets-api 5.0 requires **stainIDs and 3–6 dyes** — bot-side submission/editing
> fails against the migrated API until the handler moves to `dye.stainID`. Browsing, voting and
> favourites are unaffected. See the discord-worker CHANGELOG "Known issues".

### /preset vote

Toggle your vote on a preset.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `preset` | String (autocomplete) | Yes | Preset to vote on |

### /preset edit

Edit one of your own presets. All fields optional; only provided values change.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `preset` | String (autocomplete) | Yes | The preset to edit |
| `name` | String | No | New name (2-50 characters) |
| `description` | String | No | New description (10-200 characters) |
| `tags` | String | No | New tags (comma-separated) |
| `dye1`…`dye5` | String (autocomplete) | No | Replacement dyes |

### /preset favorite add | remove | list

| Subcommand | Option | Description |
|------------|--------|-------------|
| `add` | `preset_name` (autocomplete, required) | Add a preset to your favourites |
| `remove` | `preset_name` (autocomplete, required) | Remove a preset from your favourites |
| `list` | — | List your favourited presets |

**Rate limit (all `/preset`):** 15/min

---

## Utility

### /language — ❌ REMOVED in v5.0

No longer a registered command. Language is now an option on `/preferences`:

```
/preferences set language:ja
```

Legacy `i18n:user:*` KV keys fold into `prefs:v1:*` on read.

---

### /preferences

Manage your personal bot preferences. New in v4; every response is ephemeral since 5.0.

#### `/preferences show`
Display your current preferences.

#### `/preferences set` (all options optional; only provided values are updated)

| Option | Type | Description |
|--------|------|-------------|
| `language` | String (choice) | `en`, `ja`, `de`, `fr`, `ko`, `zh` |
| `blending` | String (choice) | Default `/mixer` mode: `rgb`, `lab`, `oklab`, `ryb`, `hsl`, `spectral` |
| `matching` | String (choice) | Default matching method: `ciede2000`, `oklab`, `cie76`, `redmean`, `rgb`, `distinguish` |
| `count` | Integer (1-10) | Default number of results |
| `clan` | String (autocomplete) | Default clan for `/swatch` |
| `gender` | String (choice) | `male`, `female` |
| `world` | String (autocomplete) | Default world/datacenter for market prices |
| `market` | Boolean | Show Market Board prices by default |
| `show_hex`, `show_rgb`, `show_hsv`, `show_lab`, `show_deltae`, `show_acquisition` | Boolean | Result-card readouts |
| `theme` | String (choice) | Card theme for every generated image: `dark` (default), `light` |

#### `/preferences reset [key]`
Reset one preference (`language`, `blending`, `matching`, `count`, `clan`, `gender`, `world`, `market`, `show_*`, `theme`, `filters`) or all when `key` is omitted.

#### `/preferences filters set | show | reset`
Dye type filters applied to search results — `set` takes optional Booleans `metallic`, `pastel`, `dark`, `cosmic`, `ishgardian`, `expensive` (Pure White / Jet Black), `vendor`, `craft`, each meaning "exclude".

**Example usage:**
```
/preferences set world:Balmung language:en theme:light
/preferences filters set metallic:true expensive:true
```

**Rate limit:** 15/min

---

### /manual

Show the help guide, or one of six localized topics from core's `MANUAL_TOPICS`.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `topic` | String (choice) | No | `match_image`, `color_vision`, `contrast`, `matching_methods`, `spectrum_prices`, `character_file` |

**Rate limit:** Not rate limited

---

### /changelog

Ephemeral release notes for the bot, rendered from `apps/discord-worker/CHANGELOG-laymans.md` — bundled into the Worker as text at deploy time (wrangler `*.md` Text rule), so no fetch and no cache; newest release expanded, five collapsed one-liners, long entries cut on a line boundary with a link to the full file. The product-level root `CHANGELOG-laymans.md` feeds the release-announcement webhook instead. New in 5.0.

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `version` | String | No | Expand a specific release (e.g. `5.0.0`) |

**Rate limit:** Not rate limited

---

### /about

Bot information: roster built from `COMMAND_REGISTRY`, version, dye count (read from the database), "Built on" credits, product/social links, the Square Enix attribution, and — for one release — a "Removed in v5" field.

**Rate limit:** Not rate limited

---

### /stats

Bot usage statistics. `summary` is public; the other subcommands are restricted to `STATS_AUTHORIZED_USERS`.

| Subcommand | Description |
|------------|-------------|
| `summary` | Basic bot information (public) |
| `overview` | Usage metrics (admin only) |
| `commands` | Per-command breakdown (admin only) |
| `preferences` | Preference adoption rates (admin only) |
| `health` | System health status (admin only) |

**Rate limit:** Not rate limited

---

## Related Documentation

- [Overview](overview.md) -- Discord worker architecture and project structure
- [Interactions](interactions.md) -- Interaction handling, deferred responses, and autocomplete
- [Rendering](rendering.md) -- SVG generation, resvg-wasm rendering, and CJK font subsetting
- [Deployment](deployment.md) -- Wrangler configuration, environment variables, and CI/CD
