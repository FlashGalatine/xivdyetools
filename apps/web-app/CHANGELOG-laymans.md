# What's New in Version 1.7.0

*Released: March 18, 2026*

---

## Swatch Matcher: Reverse Matching

You can now go backwards with the Swatch Matcher! Select any dye from the Color Palette drawer or enter a custom hex code, and the tool will highlight the 3 closest matching character color swatches in the grid. This makes it easy to answer the question: "which character colors does this dye look like?" Click any highlighted swatch to jump straight into the regular forward matching flow.

## "Inspect Dye in..." Now Includes Swatch Matcher

When viewing a dye result card from any tool, the right-click context menu "Inspect Dye in..." now includes **Swatch Matcher** as a destination. This lets you quickly check what character colors a dye resembles without leaving your current workflow.

## Bug Fix: Empty Color Grid

Fixed an issue where the Swatch Matcher's color grid would appear empty when returning to the tool with a previously saved race-specific category (like Skin Colors or Hair Colors). The grid now properly loads color data in all cases.

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*

---

# What's New in Version 1.6.0

*Released: March 14, 2026*

---

## Correct Currency Display on Dye Cards

Previously, every dye's vendor cost showed "G" (Gil) as the currency — even for dyes that cost Skybuilders' Scrips, Cosmocredits, pigments, or other currencies. Now the result cards display the correct currency name for each dye, fully translated into all 6 supported languages.

## "The Firmament" Now Translated

Dyes acquired from The Firmament previously showed "The Firmament" in English regardless of your language setting. Now it correctly displays in all 6 languages (e.g., "蒼天街" in Japanese, "창천 거리" in Korean).

---

## Patch 7.5 Dye Consolidation — Ready When You Are

This release prepares XIV Dye Tools for an upcoming change in FFXIV Patch 7.5, where Square Enix is expected to consolidate 105 individual dye items into just 3 items on the market board.

**What this means for you:**

- When Patch 7.5 launches, our tools will automatically handle the new consolidated dye items — no action needed on your end
- The Discord bot's `/budget` command will make significantly fewer market board API calls (~80% reduction), meaning faster responses
- The web app's market board prices will correctly map the new consolidated items back to individual dyes

**Nothing changes right now** — this update is purely forward-looking. All existing tools and features continue to work exactly as before.

---

## Documentation Overhaul

- 16 new documentation files covering web app tools, Discord bot commands, OAuth flows, API endpoints, database schema, deployment guides, and more
- Updated architecture diagrams and version references across the project

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*
