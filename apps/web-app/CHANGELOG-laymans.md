# What's New in Version 1.7.0

*Released: March 18, 2026*

---

## Swatch Matcher: Reverse Matching

- **Match dyes back to character colors** — select any dye from the Color Palette drawer or enter a custom hex code, and the tool highlights the 3 closest matching swatches in the grid
- **Answer "which character colors does this dye look like?"** without trial and error
- **Seamless forward-matching flow** — click any highlighted swatch to jump straight into regular matching

## "Inspect Dye in..." Now Includes Swatch Matcher

- **New context menu destination** — right-click any dye result card and choose "Inspect Dye in... Swatch Matcher"
- **Stay in your workflow** — quickly check what character colors a dye resembles without switching tools manually

## Bug Fix: Empty Color Grid

- **Fixed empty grid on return visits** — the Swatch Matcher's color grid no longer appears blank when returning to the tool with a previously saved race-specific category (Skin Colors, Hair Colors, etc.)
- **Reliable data loading** — the grid now properly loads color data in all cases

## Correct Currency Display on Dye Cards

- **Accurate currency names** — dye result cards now show the correct currency (Skybuilders' Scrips, Cosmocredits, pigments, etc.) instead of always displaying "G" (Gil)
- **Fully translated** — currency names appear in all 6 supported languages

## "The Firmament" Now Translated

- **Localized acquisition source** — "The Firmament" now displays in your selected language instead of always showing English
- **All 6 languages supported** — e.g., "蒼天街" in Japanese, "창천 거리" in Korean

---

## Patch 7.5 Dye Consolidation — Ready When You Are

- **Forward-looking preparation** — this release gets XIV Dye Tools ready for FFXIV Patch 7.5, where Square Enix is expected to consolidate 105 individual dye items into just 3 on the market board
- **Automatic handling** — when Patch 7.5 launches, our tools will handle the new consolidated items with no action needed on your end
- **Faster Discord bot responses** — the `/budget` command will make ~80% fewer market board API calls
- **Correct price mapping** — the web app will correctly map new consolidated items back to individual dyes
- **Nothing changes right now** — all existing tools and features continue to work exactly as before

---

## Documentation Overhaul

- **16 new documentation files** — covering web app tools, Discord bot commands, OAuth flows, API endpoints, database schema, deployment guides, and more
- **Updated diagrams and references** — architecture diagrams and version references refreshed across the project

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*
 