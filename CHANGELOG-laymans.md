# What's New — XIV Dye Tools

Product-level release notes for players, covering every surface (web app,
Discord bot, link previews). Newest release first.

<!--
FORMAT CONTRACT — the Discord announcement webhook and /changelog command
parse this file with a strict grammar; entries that break it are silently
skipped:

  ## [x.y.z] - YYYY-MM-DD
  ### Section Title            (emoji in section titles is welcome)
  - Short, self-contained bullet

Rules:
- Newest entry first.
- Say which surface changed (web app / Discord bot / link previews).
- Bullets must stand alone (they are translated into six languages).
- Push edits to this file as their own small commit — the announcement
  webhook caps payloads at 10 KB and fires on any push to main touching
  this exact root path.
-->

## [5.0.0] - 2026-08-08

### 🎨 The 5.0 redesign

- Web app: every tool rebuilt on the new console look — two themes (light and dark), a slide-over Advanced Options panel, and redesigned result cards that never overflow, in any of the six languages.
- Web app: the Swatch tool now reads `.chara` character files from Anamnesis and Ktisis — drop one in and every colour on your character is matched to a dye, right in your browser.
- Discord bot: every command's picture was redrawn — sharper, smaller cards that stay readable at Discord's display size, with your dye names in your language.
- Discord bot: pick light or dark cards with `/preferences set theme`.

### 📏 One matching vocabulary

- Everywhere: the six matching methods are now the same list on every surface — ΔE2000 (the default), ΔEOK, ΔE76, REDMEAN, RGB DIST and DISTINGUISH % — and quality bands are calibrated per method, so a "close" match means the same thing wherever you read it.
- Everywhere: share links now key on the game's own stain numbers, so a link you save today keeps working.

### ♿ New commands

- Discord bot: `/contrast` measures WCAG contrast between up to four dyes — the letter grades are gone, the ratios speak for themselves.
- Discord bot: `/a11y` is a shorter way to type `/accessibility`, and both now simulate four colour-vision lenses.
- Discord bot: `/changelog` shows these release notes without leaving Discord, and `/manual` grew topics for colour vision, contrast, matching methods, dye prices and character files.
- Discord bot: `/swatch` now takes a `.chara` character file, and `/budget` prices by the real market groups — one price per Spectrum tier, never an invented per-dye number.

### 🔗 Link previews

- Link previews: sharing any tool link now unfurls a redrawn card — full-bleed colour bands that stay recognisable even as a tiny thumbnail, localised when the link carries a language, with a proper X/Twitter variant.
- Link previews: bare tool links (no dye in them) finally get real preview images instead of a broken picture.

## [4.12.0] - 2026-07-19

### 📜 Full release history in the web app

- Web app: a new scroll-icon button in the header opens the release history, so you can catch up on everything that changed — not just the latest version.
- Web app: the automatic "What's New" popup after updates no longer shows up empty.

### ⚡ Palette Extractor feels much faster

- Web app: the "Extracting…" state now actually appears while a palette is being extracted.
- Web app: big images extract much faster — a 4K screenshot now takes a fraction of the time, with no visible loss in palette quality.

### 🛟 Your settings can no longer silently stop saving

- Web app: uploaded images now live in their own, much larger storage area, so a large image can no longer fill the space your settings, favorites, and collections need.

### 🔧 Under-the-hood reliability

- Web app and Discord bot: a broad batch of behind-the-scenes fixes from a full code audit — more accurate Market Board price handling and general hardening.
