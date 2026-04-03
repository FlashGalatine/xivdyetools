# What's New in Version 1.9.0

*Released: April 3, 2026*

---

## Filter Out Dyes You Don't Want

- **New filter panel in every tool** — A collapsible "Filters" sidebar section now appears in all six tools: Harmony Explorer, Palette Extractor, Gradient Builder, Dye Mixer, Budget Suggestions, and Swatch Matcher
- **9 toggles, two groups** — Hide dyes by type or where you get them:
  - *Dye Types*: Metallic, Pastel, Dark, Cosmic
  - *Acquisition Source*: Ishgardian (Firmament), Vendor, Crafted, Allied Society, Expensive
- **Swatch Matcher stays accurate** — When filters are active, the tool automatically fetches extra candidates and post-filters so you still get a full set of the best matches

## Discord Bot: Save Your Filter Preferences

- **New `/preferences filters` commands** — Set your dye type preferences once and have them automatically apply to every command you run
  - `/preferences filters set` — Toggle any of the 9 filters on or off per your preference
  - `/preferences filters show` — See your current saved filter settings at a glance
  - `/preferences filters reset` — Clear all filters and return to defaults
- **Applied automatically** — Your saved preferences are picked up by `/match`, `/harmony`, `/mixer`, and `/gradient` without any extra steps on your end

---

## Patch 7.5 Dye Consolidation — Ready When You Are

- **Forward-looking preparation** — this release gets XIV Dye Tools ready for FFXIV Patch 7.5, where Square Enix is expected to consolidate 105 individual dye items into just 3 on the market board
- **Automatic handling** — when Patch 7.5 launches, our tools will handle the new consolidated items with no action needed on your end
- **Faster Discord bot responses** — the `/budget` command will make ~80% fewer market board API calls
- **Correct price mapping** — the web app will correctly map new consolidated items back to individual dyes
- **Nothing changes right now** — all existing tools and features continue to work exactly as before

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*
