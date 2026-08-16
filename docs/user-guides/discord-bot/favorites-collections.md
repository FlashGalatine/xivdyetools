# Favorite Presets & Preferences (Discord)

**What the bot remembers for you — and where saved dyes live now**

The 5.0 bot no longer keeps dye lists. `/favorites` and `/collection` were removed (with their
storage), so the bot remembers exactly two things per Discord account:

| What | Command | Where it lives |
|------|---------|----------------|
| Community presets you like | `/preset favorite` | Bot only (per Discord account, up to 50) |
| Your defaults — language, card theme, matching method, world… | `/preferences` | Bot only (per Discord account) |

Saved **dyes** — favorites and collections — are a web-app feature and are stored in your browser.
There is no sync in either direction. See [Where dye favorites live](#where-dye-favorites-live) below.

---

## Favorite Presets

Keep a short list of community presets so you can find them again without searching. Everything here
is a private (ephemeral) reply that only you can see.

### Add a Favorite

```
/preset favorite add preset_name:Tank Glamour
```

Start typing and the `preset_name` autocomplete suggests **approved community presets** by name; pick
one from the list. A name typed out in full also works. If the palette is already on your list the bot
tells you so; if you are at the cap you'll see
"You've reached the limit of 50 favorited presets."

### Remove a Favorite

```
/preset favorite remove preset_name:Tank Glamour
```

Here the autocomplete suggests **only presets already on your list**, so you can pick from what you
have rather than search the whole gallery. Removing something that isn't there is a soft error, not a
crash ("… is not in your favorites.").

### List Your Favorites

```
/preset favorite list
```

Shows a numbered list — `1. Tank Glamour — Jobs` — with the count against the cap in the title
(`Your favorite presets (3/50)`). If a favorited preset has since been deleted by its author or a
moderator it simply drops out of the list; use `remove` to tidy the entry away.

### Good to know

- **Limit**: 50 favorites per Discord account.
- Favoriting is a bookmark, not a vote — use `/preset vote preset:…` to add your upvote.
- The list follows your Discord account, so it is the same in every server and in DMs with the bot.
- The web app's Community Presets tool has its own **Saved** tab (snapshots kept in your browser).
  It is a separate list — the bot and the web app do not share preset favorites.
- To see a favorite again, `/preset show name:…` — the same autocomplete resolves the name.

---

## Preferences

`/preferences` is where the bot keeps your defaults (it replaced the old `/language`). All replies are
private.

```
/preferences show
/preferences set language:ja theme:light
/preferences reset key:theme          (omit key to reset everything)
```

### What it stores

| Key | Values | Default | Read by |
|-----|--------|---------|---------|
| `language` | `en`, `ja`, `de`, `fr`, `ko`, `zh` | `en` | Every reply and card |
| `theme` | `dark`, `light` | `dark` | Every generated card image |
| `matching` | `ciede2000` (ΔE2000), `oklab` (ΔEOK), `cie76` (ΔE76), `redmean`, `rgb`, `distinguish` | `ciede2000` | `/harmony`, `/extractor`, `/gradient`, `/mixer`, `/budget find` when you don't pass `matching:` |
| `blending` | `rgb`, `lab`, `oklab`, `ryb`, `hsl`, `spectral` | `ryb` | `/mixer` when you don't pass `mode:` |
| `count` | 1–10 | 5 | `/mixer` result count |
| `world` | World or data centre (autocomplete) | none | `/budget` prices, `/manual topic:spectrum_prices` |
| `clan`, `gender` | Clan name (autocomplete); `male` / `female` | none | Stored and shown; the 5.0 `/swatch` reads a `.chara` file instead, so nothing consults them today |
| `market` | `true` / `false` | `false` | Stored and shown; no 5.0 card reads it yet |
| `show_hex`, `show_rgb`, `show_hsv`, `show_lab`, `show_deltae`, `show_acquisition` | `true` / `false` | all `true` | Stored and shown; the 5.0 cards have fixed layouts and do not read these yet |

`/preferences show` lists all of them; `/preferences reset` (with or without `key:`) puts them back to
the defaults above.

### Dye filters

A separate sub-group hides whole dye types from every search result:

```
/preferences filters set metallic:true expensive:true
/preferences filters show
/preferences filters reset
```

Filters: `metallic`, `pastel`, `dark`, `cosmic`, `ishgardian`, `expensive` (Pure White / Jet Black),
`vendor`, `craft`. `/preferences reset key:filters` clears them too.

### Good to know

- Preferences are per Discord account and apply wherever you use the bot.
- A command's own option always wins over the stored default for that one run
  (e.g. `matching:oklab` on a single `/harmony`).
- They are bot-only. The web app has its own settings panel; the two are not linked.

---

## Where Dye Favorites Live

Saving individual **dyes** — the star on a swatch, named collections of dyes, saved palettes,
gradients and mixes — happens in the [web app](../web-app/favorites-collections.md), and stays in the
browser you saved it in (export/import as JSON to move it). The bot has no dye favorites and never
did sync with the web app.

The bridge is the share link under a card: `/harmony`, `/dye info`, `/swatch` and `/budget` replies
carry a link that opens the same dye or result in the matching web-app tool, where you can star the
dye or save the palette from there.

---

## Related Commands

- `/preset list`, `/preset show`, `/preset random` — find presets to favorite
- `/preset vote` — upvote a preset (separate from favoriting)
- `/preferences set language:` — the old `/language`
- `/about` — lists where each removed v4 command went

---

## Related Documentation

- [Command Reference](command-reference.md) - All commands
- [Getting Started](getting-started.md) - First steps
- [Web App: Favorites & Collections](../web-app/favorites-collections.md) - Saved dyes, collections, export/import
