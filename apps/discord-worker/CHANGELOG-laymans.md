# What's New — XIV Dye Tools Discord bot

Plain-language release notes for the Discord bot, shown inside Discord by
`/changelog`. Newest release first. The web app keeps its own file
(`apps/web-app/CHANGELOG-laymans.md`), and the product-level notes that the
release-announcement webhook posts live at the repository root.

<!--
FORMAT CONTRACT — /changelog parses this file with a strict grammar
(src/services/changelog-parser.ts); entries that break it are silently
skipped, and src/services/changelog-parser.test.ts checks the file on every
test run:

  ## [x.y.z] - YYYY-MM-DD
  ### Section Title            (emoji in section titles is welcome)
  - Short, self-contained bullet

Rules:
- Newest entry first, versions strictly descending. The newest entry may LAG
  package.json (a security-only or dependency patch has nothing to say here)
  but must never be AHEAD of it — the test enforces both, and that every
  `## ` header is on the grammar. Notes for work that has not shipped yet go
  straight into the upcoming version's block (bump package.json alongside);
  there is no `Unreleased` block here — an off-grammar header is dropped at
  the top and silently MERGED into the entry above it anywhere else.
- The newest entry must render inside /changelog's 4000-character embed
  budget (the test renders it); split or trim rather than let it be cut.
- Only user-visible bot changes. Dependency bumps, lint passes, internal
  refactors and security-only patches are folded out
  (docs/developer-guides/release-process.md).
- Write for players: what changed for them and how to reach it. Name commands
  with a leading slash in backticks.
- The file is bundled into the Worker at deploy time (wrangler Text rule), so
  editing it is a deploy: `apps/discord-worker/**` is on the deploy workflow's
  path filter.
-->

## [5.5.0] - 2026-09-05
### 🎨 /harmony can use a different colour wheel
- `/harmony` has a new `wheel` option: RGB (default), RYB (the painter's wheel — red's complement is green), Munsell (JIS), OKLCH hue, or OKLCH lightness. The dyes it suggests change with the wheel.
- The card names the wheel under the harmony type when it is not the default, and its link opens the web app on the same wheel.
- Leave the option out and nothing changes.

## [5.4.0] - 2026-09-04

### 🐛 Fixes

- **Spectral mixes and gradients came out almost black.** Picking `spectral` on `/mixer` or `/gradient` gave you a near-black colour at almost every setting: a blue-to-yellow gradient rendered nine near-black steps out of eleven, and even white mixed with black came back as very-nearly-black instead of a mid grey. The mode is meant to imitate how real paint pigments combine, and it now does — blue and yellow make a green, the way they do on a palette. The website's Mixer was always doing this correctly; only the bot was affected, and the two now agree exactly.
- **`/harmony analogous` and friends give the right answer on the `oklab` matching method.** If you had set `matching: ΔEOK` in `/preferences`, or passed it to a command, the dye it picked was measured on a scale that under-weighted how colourful two dyes were compared with how light or dark they were. Roughly one search in four now returns a different, closer dye. The default (`ΔE2000`) is unchanged, so this only affects you if you deliberately chose the OKLAB option.

### 🔧 Changes

- **The OKLAB matching method is now labelled `ΔEOK2`** everywhere it appears — the method pickers, `/budget`'s comparison column, `/preferences`, and the cards. It is the more precise name for the formula the bot actually uses, and the old label named a slightly different one. Nothing about how you pick it has changed.

## [5.3.0] - 2026-09-03

### 🌐 Fixes

- **`/budget quick preset` listed its 22 dye names in English no matter what language you use.** Every one of the 125 dye names has been translated for a long time; that one menu just was not asking for them. It now shows them in your language, like every other dye list in the bot.
- **Harmony names and colour-vision names in the command menus disagreed with the website** in Japanese, Korean, Chinese and German. Both now come from the same place the site uses, so a harmony called one thing on the page is called the same thing in Discord.
- **Bold text on cards rendered too thin in Japanese, Korean and Chinese.** Headings and dye names that were meant to stand out were being drawn at the lightest weight instead, so they blended into the rest of the card. Latin text was never affected.

## [5.2.0] - 2026-09-03

### ✨ New

- `/harmony` has two more types to pick from: **Compound** and **Shades**. The web app has always offered them; now the bot does too.

### 🐛 Fixes

- `/harmony` picks the same dyes the website's Harmony Explorer does. The two had been working from different colour maths, so asking for the same harmony on the same dye in both places could give you two different sets of dyes — most noticeably on pale or near-grey dyes, where `/harmony analogous` on Snow White answered Neon Green and Kobold Brown while the site showed Pure White and Pearl White. One answer now, in both places.
- The picture that shows up when you paste a harmony link into Discord matches the page the link opens. It had been choosing its dyes a third way of its own.
- Filters on `/harmony` now pick the closest dye you are *allowed* to have, rather than the closest one to a dye that was filtered out.

## [5.1.2] - 2026-09-02

### 🐛 Fixes

- `/gradient` shows a colour chip beside every step again. They had been missing from the list, while the Start and End lines above kept theirs.
- `/harmony` shows a colour chip beside the base colour, which was the one line in that reply without one.
- `/gradient`'s summary sentence no longer runs off the edge of the picture in Japanese and Korean — it wraps properly instead of losing the last third.
- `/stats` reports the version the bot is actually running. It had been stuck on an old number and disagreed with `/about`.
- Preset pictures with Japanese, Korean or Chinese names no longer show empty boxes where the characters should be. The picture now draws what it can, and the text beside it carries the full name.
- `/preferences set` with several options at once saves all of them. Occasionally one could be quietly dropped while the reply still said it had been saved.
- The preset name autocomplete on `/preset favorite remove` no longer comes up empty for some long-standing users.
- When market data is unavailable, `/budget` says so instead of telling you your own world does not exist.

## [5.1.0] - 2026-08-30

### 🐛 Fixes

- `/preferences set world:` now checks that the world or data centre you type actually exists and saves it with its official spelling — an unknown name is refused instead of being saved as typed.
- `/about`, `/manual` and `/changelog` are now rate-limited like every other command (30 uses per minute).

### 🔒 Privacy

- The counters behind those per-command limits no longer leave Cloudflare — they used to be kept by an outside company. Nothing changes in how the limits behave.
- The privacy policy was refreshed: it now lists your preset favourites, the one-time welcome notice, and your saved preference fields, plus the commands to view or delete them.

## [5.0.1] - 2026-08-29

### 🔒 Your character's name stays yours

- `/swatch` no longer shows your character's name or your file's name anywhere — the card and the reply are simply titled "Character swatch". Many exports are named after the character, and some players use their real name, so neither reaches the channel now.

## [5.0.0] - 2026-08-28

### 🎨 Every card redrawn

- Every command's picture was redrawn — sharper, smaller cards that stay readable at Discord's display size, with dye names in your language.
- Pick light or dark cards with `/preferences set theme` (dark is the default).
- Replies are now one line plus a share link under the picture — the card carries everything, so nothing is printed twice.

### ⚠️ Commands that went away

- The deprecated `/language` command is gone — `/preferences set language` replaces it. (`/match`, `/match_image`, `/favorites` and `/collection` had already been retired in 4.0; colour matching lives in `/extractor`.)
- `/swatch` no longer takes a colour or a grid position — it takes a `.chara` character file now (see below).
- `/budget find` no longer takes a result count — the new ledger always shows the whole picture — and `/extractor image` drops its `vibrancy_boost` switch, which never did anything.
- Share links now key on the game's own dye numbers, so links made with the 4.x bot no longer open; re-share anything you posted earlier.

### 📏 One matching vocabulary

- Every `matching:` option offers the same six methods as the web app — ΔE2000 (the new default), ΔEOK, ΔE76, REDMEAN, RGB DIST and DISTINGUISH % — and every card scores with the method you picked, including `/gradient` and `/harmony`, which used to ignore it.
- Quality bands are calibrated per method, so a "close" match means the same thing on every card.
- The Facewear colours are no longer mixed into the dye list — the dye list is the game's 125 real dyes.

### ♿ New and reworked commands

- `/contrast` measures WCAG contrast between up to four dyes — the letter grades are gone, the ratios speak for themselves.
- `/a11y` is a shorter way to type `/accessibility`, and both now simulate four colour-vision lenses.
- `/changelog` — this command — shows the bot's release notes without leaving Discord; `/manual` grew topics for colour vision, contrast, matching methods, dye prices and character files.
- `/swatch` takes a `.chara` character file from Anamnesis or Ktisis and matches every colour on your character to a dye.
- `/budget` prices by the real Patch 7.5 market groups — one price per Spectrum tier, never an invented per-dye number — and shows the vendor price when that is cheaper than the board.
- `/mixer` mixes in RYB by default, the same as the web app's Mixer, so the same two dyes blend the same way on both surfaces.
- `/harmony` learned the inverted-tetradic type.
- `/about` lists every command by category, the dye count and the bot's version.

### 🖼️ Community presets

- Three new categories — Appearance, Zones, and Raids & Trials; the old catch-all "Community" category is retired.
- Known issue: `/preset submit` and `/preset edit` still speak the old preset format (2–5 dyes, old item numbers) and can be rejected by the updated preset service — fixed in 5.1. Until then, submit and edit presets in the web app; browsing, voting and favourites work as before.

### 🤫 Quieter replies

- `/preferences` replies are private to you — `show`, `set` and `reset` used to post your settings to the channel.
- New users (no saved preferences yet) get a one-time private introduction to 5.0 the first time they use the bot.

### 🌏 Your language, everywhere

- Slash-command descriptions and many option choices show in your Discord language in the command picker (Japanese, German, French, Korean, Chinese).
- Type a dye name in your own language: autocomplete and typed names match English or your language, and suggestions are labelled in your language.
- Seven `/budget` messages that showed raw key names (no world set, a missing preset, and the like) now read as proper sentences.
- Korean and Chinese text on cards was re-checked against every string the bot can draw — no missing characters.

### 🔒 Privacy

- The privacy policy spells out exactly which usage statistics the bot records, and the bot no longer records which server a command was used in — only whether it was a server or a DM.

## [4.7.0] - 2026-07-19

### 🛟 Reliability

- When Discord fails mid-reply, the bot says so instead of leaving you on an endless "Bot is thinking…".
- `/budget` on a world no longer shows the datacenter's cheapest price as your world's price, and during Universalis outages it serves recent prices (marked as stale, at most 15 minutes old) instead of failing.
- `/preset` exact-name lookups find the preset even when many share a prefix, and favourite-preset autocomplete is instant.
- Preset moderation buttons work again, so submitted presets no longer sit unreviewed.
- `/stats` unique-user counts no longer stop at 1,000.

## [4.6.0] - 2026-05-12

### 🧩 The options the web app had

- `/harmony`: choose how many companion dyes (1–3), the matching method, strict matching and no-duplicates.
- `/extractor color` and `/extractor image`: matching method and no-duplicates options.
- `/gradient`: up to 12 steps, four more colour-space modes and a sixth matching method.
- `/mixer`: pick the matching method.
- `/accessibility`: compare up to six dyes, with five vision modes.
- `/swatch`: OKLCH-weighted matching.
- `/budget find`: choose how many results (1–20).
- `/preset favorite`: favourite community presets and list them later.
- `/preferences set`: six display toggles (hex, RGB, HSV, LAB, ΔE, acquisition) for the values shown on cards.

## [4.5.0] - 2026-04-29

### 🧹 Patch 7.5 follow-through

- The `/preferences filters set allied_society` toggle is gone — after Patch 7.5's dye consolidation the Allied Society vendors no longer carry dyes, so there was nothing left to filter.
- Korean and Chinese dye names render fully on cards again — the bundled fonts were re-cut to cover every name.

## [4.3.0] - 2026-04-03

### 🎛️ Dye filters

- `/preferences filters set`, `show` and `reset`: nine on/off filters that decide which kinds of dye the matching commands may suggest.

## [4.2.0] - 2026-03-14

### 🪙 Budget prices after the Patch 7.5 consolidation

- `/budget` looks prices up by the consolidated market-board items Patch 7.5 introduced, so dyes that now share one listing get the right price — and the lookup is faster.

## [4.1.1] - 2026-03-01

### 🪙 Budget quick picks

- The `/budget` quick picks are now the 16 Cosmic Exploration dyes and the 4 Cosmic Fortunes dyes, replacing Metallic Silver, Metallic Gold and Pastel Pink.

## [4.1.0] - 2026-02-27

### 🖼️ Palette Extractor

- `/extractor image` no longer suggests the same dye for several palette slots — when a flat image matches one dye over and over, later slots move on to the next-best distinct dye.

## [4.0.1] - 2026-02-09

### 🐛 Fixes

- `/budget` without a home world set now explains what to do instead of showing a broken picture.
- Replies no longer hang when Discord is slow — calls time out and the bot tells you.
- Dye names in your language no longer occasionally come back in someone else's language under heavy use.

## [4.0.0] - 2026-02-05

### 🚀 The v4 bot

- `/extractor` merges `/match` and `/match_image`: `color` finds the closest dyes to a colour or dye name, `image` extracts a palette from a picture.
- `/gradient` (formerly `/mixer`) blends between two colours with a choice of colour spaces and matching methods.
- `/mixer` is new: blend two dyes with six mixing models, including a paint-like spectral mix.
- `/swatch`: match your character's skin, hair, eyes, highlights, lips, tattoos and face paint to dyes, for all 16 clans.
- `/preferences`: one place for language, blending, matching, result count, clan, gender, world and market settings.
- `/stats`: a public summary plus admin views.
- `/dye info` and `/dye random` draw cards; `/comparison` adds LAB values; `/harmony` gains a `color_space` option.
- Japanese, Chinese and Korean text renders properly on every card.
- `/language` is marked deprecated and points at `/preferences set language`; `/match`, `/match_image`, `/favorites` and `/collection` are no longer offered.
- The bot posts a summary in the announcement channel when a new version ships.

Releases before 4.0 (1.0 – 2.3, December 2025 – January 2026) predate these notes; the technical history is in CHANGELOG.md.
