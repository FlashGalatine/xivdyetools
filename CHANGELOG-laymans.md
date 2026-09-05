# What's New — XIV Dye Tools

Product-level release notes for players, covering every surface (web app,
Discord bot, link previews). Newest release first.

<!--
FORMAT CONTRACT — the Discord release-announcement webhook parses this file
with a strict grammar; entries that break it are silently skipped. (The
bot's /changelog command shows its OWN notes, apps/discord-worker/
CHANGELOG-laymans.md, in the same grammar — keep the bot bullets here too;
this file is the product-wide summary.)

  ## [x.y.z] - YYYY-MM-DD
  ### Section Title            (emoji in section titles is welcome)
  - Short, self-contained bullet

Rules:
- Newest entry first.
- Say which surface changed (web app / Discord bot / link previews).
- Bullets must stand alone (they are translated into six languages).
- Push edits to this file as their own small commit — the announcement
  fires on any push to main touching this exact root path, and a focused
  commit keeps the announced release readable.

  (This line used to add "the announcement webhook caps payloads at 10 KB",
  which was wrong twice over and would push someone into trimming release
  history for no reason. 10 KB is the PRESET-SUBMISSION endpoint's cap;
  `/webhooks/github` allows 1 MiB. And that cap applies to GitHub's push
  payload, which carries commit metadata only — this file's contents are
  fetched separately from raw.githubusercontent.com, and only the newest
  entry is ever rendered, so the file's own size never enters into it.)
-->

## [5.3.0] - 2026-09-04

### ⚙️ Settings stopped stacking on top of each other

- Web app: on a phone, the gear in the top-right opened Advanced Settings *and* the tool's own Options at the same time, one printed straight through the other. Harmony Type and Matching Mode ran across the Reset and Backup rows, so neither panel could be read and both were awkward to tap. The gear now opens Advanced Settings and nothing else.
- Web app: the tool's Options panel has its own button in the bottom-left corner, opposite the Color Palette button — so each panel opens from its own side of the screen. On a phone Options slides in from the left over the tool; on a desktop it is the same column as before, and the new button is how you bring it back after closing it.
- Web app: every pop-up in the app — the welcome box, Advanced Settings, the theme and language pickers — was being drawn *underneath* the toolbar and the two corner buttons. On a phone the Color Palette button sat on top of the welcome box's "Get started" button and ate taps aimed at it, so the button looked broken. Pop-ups now sit above everything else.
- Web app: notification messages appear along the bottom of the screen, the same strip as the corner buttons, and were being drawn behind them. They are now on top.

### 📋 What's New was opening on the wrong release

- Web app: the What's New window opened on the August 16 notes for everyone, whatever version you were actually running. Seven releases' worth of notes had been written but never shown to anyone, and three more releases had never been written down at all. The window now lists every release, newest first.

## [5.2.0] - 2026-09-04

### 🎨 The colour mixing actually mixes now

- Discord bot: `spectral` mixes and gradients came out almost black. A blue-to-yellow `/gradient` rendered nine near-black steps out of eleven, and even white mixed with black came back nearly black instead of a mid grey. The mode is meant to imitate real paint pigments, and now it does — blue and yellow make a green. The web app was always correct here; the two now match exactly.
- Web app: the Mixer's RYB mode promised "Blue + Yellow = Olive" and now genuinely makes green. It had been running on a paint model that could not mix reliably — mixing a dye *with itself* failed to return that same dye for more than half of all dyes. Both problems are gone.
- Everywhere: the web app and the Discord bot had quietly been using two different recipes for RYB mixing, so the same two dyes could give you one colour on the site and another in Discord. There is one recipe now.

### 🔗 Shared links

- Link previews: sharing a Mixer link always previewed it in one fixed mode, whichever of the six you had actually picked — including the Mixer's own default. Whoever you sent it to saw a different colour from the one on your screen. The preview now uses your mode.
- Link previews: the dye a Mixer preview named was chosen by a different measurement than the one printed beside it, so it could disagree with the page the link opens — on about half of all mixes for some settings. It now names the dye your chosen method actually picks.

### 📏 Matching

- Everywhere: the OKLAB matching option was measuring on a scale that under-weighted how colourful two dyes are next to how light or dark they are. Roughly one search in four now returns a different, closer dye. It is also relabelled `ΔEOK2`, the precise name of the formula. The default matching method is unchanged, so this only affects you if you chose OKLAB yourself.
- Web app: the Matching Algorithm setting now says that your choice changes *which dye you get*, not just the score shown beside it — measured against the default, the alternatives return a different closest dye between a quarter and nearly half of the time, and nothing on the page said so.
- Web app: the Triadic, Tetradic and Square harmony descriptions stopped promising "vibrant, balanced palettes", "rich combinations" and "dynamic variety". There is no evidence behind those claims for these three schemes, so they now describe the shape they make on the colour wheel. Analogous and Monochromatic keep their wording — research does back those two.

<!--
BACKFILL, ARCHIVE ONLY — this block will never be announced, and that is
intended. The webhook renders parseAll(content)[0], i.e. only the newest entry,
and 5.2.0/5.3.0 above it are already memoised under KV `announced:v:<version>`.
[5.1.1] exists so the product-level history has no hole for the 2026-09-03
merges (#158/#159/#160, #162, #163), which shipped with no announcement at the
time. Do not "fix" it by moving it to the top: that would re-announce work
players received in early September as though it were new.
-->

## [5.1.1] - 2026-09-03

### 🎨 Harmony gives one answer, wherever you ask

- Everywhere: `/harmony` in the Discord bot and the website's Harmony Explorer had been working from different colour maths, so the same dye and the same harmony type could hand you two different sets of dyes depending on where you asked. It showed up most on pale and near-grey dyes — `/harmony analogous` on Snow White answered Neon Green and Kobold Brown while the site showed Pure White and Pearl White. One answer now, in both places, and the site's results are the ones that stayed.
- Link previews: the picture that unfurls when you paste a harmony link into Discord had been choosing its dyes a third way of its own. It matches the page the link opens now.
- Everywhere: filters on Harmony pick the closest dye you are *allowed* to have. They used to find the closest dye overall and then, if it was filtered out, look for something near *that* — which is not the same thing, and could land further from the colour you asked for than it needed to.
- Discord bot: `/harmony` has two more types to pick from, **Compound** and **Shades**. The web app has always offered them.

### 👗 Your whole glamour, not just the dyed parts

- Web app: the Swatch Matcher's glamour list only ever showed pieces carrying a dye, so an accessory could never appear in it at all — no earring, necklace, bracelet or ring in the game is dyeable — and worn-but-undyed armour was reduced to a number in the footnote. A new "Show all" switch beside the Pieces/Dyes toggle changes the list from one row per dyed channel to one row per piece your character is wearing, each with its icon, item name and slot. Your choice is remembered.
- Web app: facewear is listed too. The glasses were already being looked up on every import and then thrown away. `.chara` files do not store a facewear tint, so the colour chip is read from the colour word in the item's English name; an item with no colour word gets a plain chip and says the colour is unknown, rather than inventing one.
- Web app: a piece dyed only on its second channel used to draw one chip in the *first* chip's place, so the picture said channel one while your file said channel two. Dyeable pieces now always show both channels, with a plain chip for an empty one and the text naming it ("Metallic Orange + Undyed").
- Web app: a glamour with nothing dyed on it gets the list instead of nothing at all — the whole panel used to disappear, which would have hidden the new switch from exactly the character that needs it most.

### 🔀 Sending a dye to another tool

- Web app: Harmony's three "send to Comparison / Mixer / Accessibility" actions had **never** done anything — they passed the dye in a form no tool in the app reads. Budget was sending a dye *name*, and the Result Card and Gradient an ID no tool would accept for any of the 125 dyes. All of them hand the dye over correctly now, and a dye that cannot be sent no longer navigates away and then apologises.

### 🌏 Reading the app in your own language

- Web app: Japanese, Korean and Chinese text is drawn in the right typeface again. 75 style blocks across 22 components named a font directly and fell back to whatever the browser happened to pick, which is how a Japanese reader ends up seeing Chinese letterforms for kanji the two languages share.
- Discord bot: bold text on cards rendered too thin in Japanese, Korean and Chinese — headings and dye names meant to stand out were drawn at the lightest weight and blended into the rest of the card. Latin text was never affected.
- Discord bot: `/budget quick preset` listed its 22 dye names in English no matter what language you use. All 125 dye names have been translated for a long time; that one menu just was not asking for them.
- Discord bot: harmony names and colour-vision names in the command menus disagreed with the website in Japanese, Korean, Chinese and German. Both come from the same place now.
- Web app: if your account had been blocked from submitting community presets, the app answered "Failed to submit preset" — which is not what happened — with the real reason readable only in English underneath. It says you are blocked, in your own language.
- Web app: the "Show ΔE" switch works. Turning it off left the match-quality number on every result card exactly where it was, and the same setting is what the Accessibility checker, Dye Comparison and Budget use to keep that number off their cards — so all three were showing you a number they had been written not to show.

## [5.1.0] - 2026-08-31

### 🔒 A privacy pass over everything

- Web app: the Palette Extractor no longer remembers your last image between visits. Pictures you upload, paste or photograph are used while the tab is open and are gone when you close it — nothing is kept on your device any more, and if an earlier visit saved one, the app wipes it the next time you open the page.
- Web app: every page load used to open a connection to an outside price service before you had asked for anything — handing it your IP address for a request that never came. That connection is gone; prices are still fetched normally when a tool actually needs them.
- Web app: the sign-in box now says plainly what signing in creates — an account record holding your Discord or XIVAuth ID and username. The privacy guide covers how to ask for it to be removed.
- Discord bot: the counters behind the per-command limits no longer leave Cloudflare. They used to be kept by an outside company, which meant your Discord ID sat in someone else's database purely to count how often you used a command.
- Discord bot: `/preferences set world:` now checks that the world or data centre you type actually exists and saves it with the game's own spelling, instead of storing whatever you typed.
- Discord bot: the privacy policy was refreshed — it now lists your preset favourites, the one-time welcome notice and your saved preference fields, along with the commands to view or delete them.
- Everywhere: the servers stopped writing things into their logs that they had no business writing — your IP address on the web side, your Discord ID on the bot side when a rate-limit check failed. Those logs were never kept anywhere, so nothing about you was stored; the lines simply should not have been written in the first place.

## [5.0.0] - 2026-08-28

### 🎨 The 5.0 redesign

- Web app: every tool was rebuilt on the new console look — a slim top bar with a tool rail on desktop, a slide-over Advanced Options panel, and redesigned result cards that never overflow, in any of the six languages.
- Web app: themes are now just Light and Dark on the new red-accent palette; if you had one of the older themes selected, the closest of the two is picked for you automatically.
- Web app: on phones the colour palette drawer now starts closed (with a one-time hint on how to open it), so the tool you opened is the first thing you see.
- Web app: keyboard shortcuts finally work — they had been silently disabled — and Shift+S shares the tool you are looking at.
- Web app: fonts now ship with the app instead of being fetched from Google, so pages load a little faster and no font request leaves your browser.
- Discord bot: every command's picture was redrawn — sharper, smaller cards that stay readable at Discord's display size, with dye names in your language.
- Discord bot: pick light or dark cards with `/preferences set theme`.

### ⚠️ Old share links stop working

- Everywhere: share links now key on the game's own dye numbers, so a link you save today keeps working even if the game reshuffles items — but links made before 5.0 that used the old item numbers no longer open. Please re-share anything you posted earlier.
- Discord bot: the old `/match`, `/match_image`, `/favorites`, `/collection` and `/language` commands are gone. Colour matching lives in `/extractor`, and `/preferences` covers your language and theme.

### 📏 One matching vocabulary

- Everywhere: the six matching methods are the same list on every surface — ΔE2000 (the default), ΔEOK, ΔE76, REDMEAN, RGB DIST and DISTINGUISH % — and quality bands are calibrated per method, so a "close" match means the same thing wherever you read it.
- Everywhere: the Facewear colours are no longer mixed into the dye list — they are their own set, and the dye list is the game's 125 real dyes.

### 🧰 Every tool, reworked

- Web app: Harmony — click a node on the wheel to jump to that dye, and each result card offers alternate companion dyes you can swap in with one tap.
- Web app: Palette Extractor — click anywhere on your picture to sample that exact colour; the auto-extract button is still there.
- Web app: Gradient — pin any step to a dye you own and the gradient bends through it.
- Web app: Mixer — a mixing field shows six blending models across five ratios at once; tap a cell to see the nearest dye.
- Web app: Accessibility — a lens view shows how your palette reads under four kinds of colour vision, with the worst pair called out.
- Web app: Comparison — a duel view with a plain verdict on how far apart two dyes really are, and what differs.
- Web app: Budget — prices follow the real Patch 7.5 market groups (one price per Spectrum tier), so coffer-only dyes are no longer shown as costing about 1 gil.
- Web app: Swatch — drop a `.chara` character file from Anamnesis or Ktisis and every colour on your character is matched to a dye, entirely on your device, and the "Dyes on this glamour" list now names the actual pieces (icon, item name in your language, a +N badge for look-alike items, and a Pieces/Dyes switch) — only the gear's model numbers leave your device, never the file; a notice explains that the eye, hair and skin preset palettes are going away with the Evercold expansion.
- Web app: your saved palettes, dye swaps and character records now live in one place and carry over automatically — nothing to redo.

### 🖼️ Community presets

- Web app: the presets gallery has a saved shelf, sign-in, a submit form and a My Submissions view that shows why a preset was rejected.
- Web app and Discord bot: presets can carry a preview picture (reviewed by the moderators before it shows), a link to the glamour it comes from, one main category and up to two extra ones.
- Web app and Discord bot: three new categories — Appearance, Zones, and Raids & Trials; the old catch-all "Community" category is retired.
- Web app and Discord bot: presets now hold 3 to 6 dyes.

### ♿ New commands

- Discord bot: `/contrast` measures WCAG contrast between up to four dyes — the letter grades are gone, the ratios speak for themselves.
- Discord bot: `/a11y` is a shorter way to type `/accessibility`, and both now simulate four colour-vision lenses.
- Discord bot: `/changelog` shows the bot's own release notes without leaving Discord, and `/manual` grew topics for colour vision, contrast, matching methods, dye prices and character files.
- Discord bot: `/swatch` now takes a `.chara` character file, and `/budget` prices by the real market groups — one price per Spectrum tier, never an invented per-dye number.

### 🔗 Link previews

- Link previews: sharing any tool link now unfurls a redrawn card — full-bleed colour bands that stay recognisable even as a tiny thumbnail, localised when the link carries a language, with a proper X/Twitter variant.
- Link previews: bare tool links (no dye in them) and the site's front page finally get real preview images instead of a broken picture.

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
