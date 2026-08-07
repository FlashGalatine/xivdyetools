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
