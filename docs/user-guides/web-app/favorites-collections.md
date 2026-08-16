# Favorites & Collections

**Save and organize your dyes**

Favorites are the dyes you reach for most; saved palettes are the sets of dyes you build with the tools. Both live in your browser on the device you are using, and both carry the game's own dye numbers, so anything you save today opens the same way tomorrow, in any language, and in any tool.

---

## Favorites

### What Are Favorites?

A quick-access list of up to 40 dyes, shown at the top of the Color Palette drawer in every tool that uses it, so your usual picks are always one tap away.

### Adding Favorites

Favorites are managed from the **Color Palette** drawer — the dye picker that slides in from the right (on phones it starts closed; tap the round palette button to open it):

1. Find the dye in the drawer — search by name, use the **All / Metallic / Pastel / Dark / Vibrant** chips, or scroll the colour groups.
2. Hover (or tap) the swatch and click the **★** in its corner. The star fills and the dye moves into the **Favorites** section at the top of the drawer.
3. Click the star again — in the Favorites section or on the swatch — to remove it.

The star is the only place favorites are set; the ⋮ menu on result cards is for sending a dye to other tools, not for saving it.

### Managing Favorites

- **Favorites (n)** — the section header shows your count; click it to collapse or expand the section.
- **Use** — clicking a favorite swatch selects that dye in whichever tool you are in, exactly like any other swatch.
- **Clear all** — open the gear icon in the top bar → **Advanced Settings** → **Data** → **Clear Favorites** (asks you to confirm; cannot be undone).

### Limits

- Maximum 40 favorites — at the limit you will see *"Maximum 40 favorites allowed"*; remove one to add another.
- Not available in Palette Extractor or Community Presets, which do not use the drawer.
- Stored in your browser.

---

## Saved Palettes (Collections)

### What Are Saved Palettes?

A saved palette is a named group of dyes (up to 20) that a tool wrote to your device. In 5.0 you do not build these by hand — each tool has its own **Save** action, and everything it saves lands in one place:

| Tool | Action | What gets saved |
|------|--------|-----------------|
| **Dye Mixer** | **Save mix** under the mixing field | Dye A, Dye B and the dye your current blend resolves to, named "A × B" |
| **Swatch Matcher** | **Make a palette** → **Save to this device** (after loading a `.chara` file) | The 3–6 dyes your character's glamour is wearing |
| **Swatch Matcher** | **Save character colours** on the character file card | The closest dye for each of your character's colours (hair, eyes, skin, lips…) |
| **Budget Suggestions** | **Save swap** on a substitute row | The dye you priced and its cheapest substitute |

Palettes you saved in earlier versions (harmony palettes, older collections) are carried over automatically the first time 5.0 loads.

### Finding Your Palettes

Open **Community Presets** and switch to the **Saved** tab. Your device-local palettes are listed there alongside the community presets you have saved, and the search box matches their names. Open one to see the full dye list, its **PALETTE COST**, and the **TAKE THIS PALETTE INTO** row that sends the whole set to Harmony, Comparison, Gradient or Accessibility.

Palettes from the Mixer and Swatch Matcher appear there. Saved swaps and character-colour sets are kept in the same store but do not have their own screen yet.

### Managing Saved Palettes

- **Clear all** — gear icon → **Advanced Settings** → **Data** → **Clear Saved Palettes** (confirmation required; cannot be undone). This removes every saved palette but leaves favorites, swaps and character sets alone.
- There is no per-palette rename or delete in this release.

### Limits

- Maximum 50 saved records; maximum 20 dyes per record; names up to 50 characters.
- Records only hold real dyes — a custom hex colour that isn't a dye is skipped when saving.
- Stored in your browser.

---

## Saved Community Presets

Saving a community or official preset is a separate shelf: press **Save** on any preset card (**Saved** once it is kept). That stores a snapshot of the preset on your device — up to 200, no sign-in needed, and it survives the author deleting the original (marked *"Removed by its author — your saved copy"*). The **Saved** section of the presets settings lets you pin saved presets to the top of every tab and choose whether to keep author-deleted copies.

---

## Storage

Favorites, saved palettes and saved presets are stored locally, signed in or not:

- They stay in this browser on this device.
- They are cleared if you clear the site's browser data.
- Nothing syncs to an account, to other devices, or to the Discord bot.
- The **Backup** card in Advanced Settings exports and imports your tool *settings* as a file — it does not include favorites or saved palettes, so there is currently no way to move those between browsers.

Anything from a previous version that points at a dye the app can no longer identify is dropped during the automatic upgrade rather than kept as a broken entry.

---

## Tips

### Organization Ideas

| Habit | How |
|-------|-----|
| Outfit projects | Load your character's `.chara` file in the Swatch Matcher and **Save to this device** to keep the glamour's dyes as a palette |
| Custom colours | **Save mix** in the Dye Mixer whenever a blend lands on a dye you want to remember |
| Budget planning | **Save swap** on the substitute you actually intend to buy |
| Top picks | Star them — 40 favorites is plenty for the dyes you use week to week |

### Workflow Tips

1. **Star immediately** — favorite dyes as you find them; they follow you into every tool's drawer.
2. **Save when a result is right** — palettes are saved from the moment, not assembled later.
3. **Reopen in the Saved tab** — then use **TAKE THIS PALETTE INTO** to keep working with the set.

---

## Discord Bot

The Discord bot's `/favorites` and `/collection` commands were removed in 5.0. Bot results carry a
share link that opens the same dyes in the web app, where you can save them; the bot can only
favourite community presets (`/preset favorite`).

---

## Related Tools

- [Dye Mixer](dye-mixer.md) - Save a blend as a palette
- [Swatch Matcher](swatch-matcher.md) - Save your character's colours and glamour dyes
- [Budget Suggestions](budget-suggestions.md) - Save a swap
- [Community Presets](community-presets.md) - Where the Saved tab lives
- [All Tools](getting-started.md) - Every tool with a palette drawer supports favorites
