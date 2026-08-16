# What's New

---

## Web-App Version 5.0.0 — August 16, 2026

### A brand-new look for every tool

- **XIV Dye Tools 5.0 is a top-to-bottom redesign.** All nine tools were rebuilt on a cleaner layout, with a new logo, new icons, and new fonts.
- **Desktop: the tools live in the top bar.** Nine small icons sit in the header — hover one to see its name, click to switch. On phones, tap the tool name at the top to open the tool menu.
- **Two themes instead of twelve.** There is now one Light and one Dark theme. Your saved theme is mapped automatically: light-style themes become Light, everything else becomes Dark.
- **Advanced Options is a slide-in panel.** The gear button in the top bar opens backup and restore, resets, and behaviour toggles. On phones, each tool's own settings live in that panel too.
- **On phones, the dye palette starts closed** so the tool gets the whole screen. A one-time hint points you to the palette button.

### Old share links need to be re-made

- **Share links now use the game's own dye numbers** instead of item numbers. Those numbers don't change when the game merges or reshuffles items, so new links will keep working for years.
- **Links made with older versions that point at a dye will no longer open.** Rather than quietly guessing, the app shows a message asking for a fresh link.
- Links that carry a plain colour code (a hex value) still work, and every link the app makes today — from the Share button or when one tool sends a colour to another — uses the new format.

### "Close" means the same thing in every tool

- **The same six matching methods everywhere:** ΔE2000 (the default), ΔEOK, ΔE76, Redmean, RGB distance, and Distinguishability %. These are different ways of measuring how far apart two colours look.
- **Quality words are calibrated per method,** so a "close" match in Harmony means the same as one in Comparison — or in the Discord bot. Your saved choice carries over.

### Harmony Explorer: a colour wheel you can steer

- **Click any dot on the wheel** to jump your base colour to the nearest dye. The big centre button names the base and opens the picker.
- **A row of harmony types sits over the wheel** so you can flip between them without the sidebar. New type: Inverted Tetradic.
- **Companion swatches on every card.** Each result shows up to five nearby alternatives as small dots — tap one to swap it in. A new slider sets how many.
- Monochromatic, compound, and shades harmonies finally draw their dots on the wheel.

### Palette Extractor: click the picture

- **Click or tap anywhere on your image to sample that colour.** (Before, clicking opened the file dialog.) Drag to get a magnifying loupe with a crosshair and hex code, then let go to sample.
- **Your samples collect in a Palette Roll strip.** Auto-extract is still there as a button when you want the whole palette in one go.
- A clearer drop zone with a privacy note; on phones you can take a photo directly.

### Gradient Builder: pin a step

- **Pin any middle step to its matched dye and the gradient bends through it** — the other steps re-blend around your pin. Handy for "I already own this one".
- New From / To end cards with a swap button, and a summary of average and worst drift from the ideal colour.
- No more repeated dyes on flat stretches (you can turn that off), 3–12 steps everywhere, and Gradient gets an export button for the first time.

### Dye Mixer: the mixing field

- **See thirty blends at once** — six mixing models (RYB, Spectral, OKLAB, LAB, HSL, RGB) across five ratios, each with its nearest dye. Tap a cell to make it your active mix.
- **The ratio you pick actually sticks now.** It used to snap back to 50/50; it now survives changing dyes and rides along in share links.
- **Save mix** keeps the pair and its matched dye in your saved palettes. The Mixer is now a two-dye tool — the little-used third slot is gone.

### Accessibility Checker: the lens view

- **Pick a lens and the whole workspace repaints** the way someone with that kind of colour vision sees it — normal, two red-green types, blue-yellow, and no colour at all.
- **Each lens tab shows how common that vision type is** and marks your worst pair. Read each pair as a percentage, a contrast ratio, or a colour difference, with a plain-language explainer for each.
- Any of the four slots can be a custom colour, not just a dye.

### Dye Comparison: the duel

- **Pick a pair and get a verdict** — Same, Close, Near, or Far — plus a "what differs" breakdown (lightness, saturation, hue, vendor, source) and a cost line.
- **All six matching methods are shown side by side** for the pair, so you can see where they agree and where they don't.
- Custom colours can be compared too. The old stat cards, charts, and grid are gone.

### Community Presets: a proper gallery

- **New tabs — Community, Official, Saved, Mine** — with live counts, a category rail, one search box that also finds dye names, and picture-led cards with vote and save buttons.
- **A Saved shelf** keeps a copy of presets you like, even signed out. If an author later removes one, you keep your copy.
- **Sign in, submit, and My Submissions are redesigned.** Submissions can now carry a preview image, up to two extra categories, and an example link.
- **Example links** can point at Eorzea Collection, Mirapri, Reddit, X, Bluesky, Instagram, pixiv, the Lodestone, or Misskey — and can be edited after you submit.
- **Three new categories: Appearance, Zones, and Raids & Trials.** The old "Community" category is retired — community is now a tab, not a category.
- The 15 official presets show their name, description, and tags in your language, and every preset page has a "take this palette into" row for Harmony, Comparison, Gradient, and Accessibility.
- Your own saved palettes (including everything from 4.x) show up in the gallery too.

### Budget Suggestions: honest Patch 7.5 prices

- **Prices follow the real Patch 7.5 rules.** Dyes that share a Market Board listing show one price per Spectrum tier, and Venture Coffer dyes are no longer listed as costing about 1 gil.
- **Scrip and credit dyes are priced in their own currency** — never quietly converted to gil.
- **Results are grouped by tier in a ledger** you can sort by dye, closeness, board price, or gil-per-step, with a plain verdict and "× cheaper" callouts.
- Quick picks come from live prices ("priciest on your world right now"), a new Exclude Coffer Dyes filter, and a Send To row (Harmony, Compare, copy name, Save swap).
- The old gil-limit slider is replaced by a closeness slider — set how far from the target colour you're willing to go.

### Swatch Matcher: drop in your character

- **Drop a `.chara` file from Anamnesis, Ktisis, or Brio** and every colour on your character — skin, hair, eyes, lips, and more — is matched to the closest dye at once.
- **The file is read entirely on your device. Nothing is uploaded.**
- Save the whole set as a character record, send the matches on to other tools, or start a preset submission from the dyes on that glamour.
- The palette rail and Dark/Light toggle sit right on the grid, and sharing a cell now identifies exactly which cell you meant.
- **Heads-up:** the eye, hair, and skin grids carry a notice that these preset palettes are being retired in the Evercold expansion (January 2027) in favour of a free colour picker.

### Result cards, export, and saving

- **Redesigned result cards** laid out like a ticket: swatch pair and verdict up top, then HEX / RGB / HSV / LAB (CMYK optional), then source and cost, with alternates as small swatch dots.
- **One export sheet** in Extractor, Gradient, Comparison, and Mixer: CSS, SCSS, JSON, plain HEX, or Tailwind, with a live preview, Copy, and Download.
- **Saved palettes, saved swaps, and character records now live in one place.** Everything you saved before is moved over automatically the first time you open 5.0.
- If you delete something and later import an old backup, it stays deleted instead of coming back.
- Custom colours can be used as the starting point in Harmony, Comparison, Accessibility, and Budget.

### Keyboard shortcuts finally work

- **The shortcuts had been silently broken** — 1–9 to switch tools, Shift+T for theme, Shift+L for language, and ? for help did nothing. They all work now.
- **New: Shift+S shares the current tool.** And typing numbers into a search box no longer switches tools.

### Faster, more private, better link previews

- **Fonts ship with the app.** No more Google Fonts request, so one fewer third party sees your visit and the page paints sooner.
- **New link preview cards** when you share the site or a tool on Discord or X.
- Everything is available in all six languages (English, Japanese, German, French, Korean, Chinese) — roughly 450 new lines of text per language.

### Under the hood

- A long list of fixes rode along: Harmony cards printed the wrong number under the ΔE2000 label, some display toggles did nothing, and the second pop-up you ever opened lost its styling.
- Test coverage, build checks, and a beta site (beta.xivdyetools.app) were also set up.

### What you need to do

- **Nothing, for most people.** Your theme, settings, favourites, and saved palettes are converted automatically the first time you open 5.0.
- **Re-make any share links you've posted.** Links to specific dyes shared before 5.0 (Discord, forums, guides) now show a message instead of opening — open the tool and make a fresh link.
- **If Market Board prices look empty right after the release,** wait a few minutes and refresh. The pricing server is being updated at the same time.

---

## Web-App Version 4.12.0 — July 19, 2026

### Full release history in the "What's New" window

A new scroll-icon button in the header opens this changelog as a browsable release history, so you can catch up on everything that changed — not just the latest version. (The automatic "What's New" popup after updates was also fixed; it had been showing up empty.)

### Palette Extractor feels much faster

- **The "Extracting…" state now actually appears** when you extract a palette. Before, the app froze for the whole extraction without any feedback.
- **Big images extract much faster.** A 4K screenshot now takes a fraction of the time it used to, with no visible loss in palette quality.

### Your settings can no longer silently stop saving

Uploaded images used to be stored in the same small storage space as your settings, favorites, and collections — and a large image could fill it completely, making everything else quietly fail to save. Images now live in their own, much larger storage area, and anything stuck in the old location is moved over automatically.

### Under-the-hood reliability

This release also includes a broad batch of behind-the-scenes fixes from a full code audit — more accurate Market Board price handling, sturdier tool cleanup when switching between tools, and general hardening across the app.

### What you need to do

Nothing. These changes are automatic and available immediately after deployment.

---

## Web-App Version 4.11.0 — May 31, 2026

### New Spectrum Filters in the Color Palette

The Color Palette drawer now includes a new Spectrum filter row so you can quickly narrow dyes by consolidation group:

- **Standard Spectrum**
- **Wide Spectrum #1**
- **Wide Spectrum #2**
- **Unconsolidated**

This makes it much easier to browse exactly the dye group you care about, especially after Patch 7.5 consolidation changes.

### Better Budget Suggestions

Budget Suggestions now behave more predictably and give better options:

- **Matching algorithm selector is now available in Budget settings** so you can choose how matching is calculated.
- **Alternative generation now uses the full candidate pool** instead of an early cap, so good matches are less likely to be skipped.
- **Vendor-cost fallback is used when market data is missing**, so valid dyes are not dropped just because Market Board pricing is temporarily unavailable.

### Stability and Quality Improvements

This release also includes quality-of-life cleanup and testing improvements:

- **Collection Manager E2E tests were re-enabled and stabilized** for the v4 UI.
- **Favorites header semantics were improved** for cleaner accessibility and keyboard behavior.
- **Legacy/dead v3 and test-only code was removed**, reducing maintenance overhead and keeping the app leaner.

### What you need to do

Nothing. These changes are automatic and available immediately after deployment.

---

## Web-App Version 4.10.0 — April 29, 2026

### Dye spectrum shown on every result

Result cards now tell you which consolidated dye spectrum a dye belongs to, so you can see at a glance how it's grouped after the Patch 7.5 changes.

- Harmony, Gradient, Budget, Swatch, and Palette Extractor results now show a Spectrum label (Standard, Wide #1, or Wide #2).
- Special and Facewear dyes that aren't consolidated simply show a dash.

### Simpler filters

- Removed the old "Exclude Allied Society Dyes" filter, which no longer did anything after the Patch 7.5 dye changes.

---

## Web-App Version 4.9.0 — April 28, 2026

### Patch 7.5 Market Board pricing

Final Fantasy XIV's Patch 7.5 combined many dyes into shared Market Board listings, and the app now prices them correctly.

- Dyes that now share a listing show a single, accurate price (Standard Spectrum, Wide Spectrum #1, or Wide Spectrum #2).
- Premium dyes like Pure White and Jet Black are still priced individually.
- The Market Board refresh button now sits right next to the prices.

---

## Web-App Version 4.8.0 — April 10, 2026

### Color history in the Palette Extractor

The Palette Extractor now remembers the colors you pull from an image.

- Every color you sample is saved to an "Extracted Colors" history with swatches and hex codes.
- A new info card shows the technical details (HEX, RGB, HSV, and LAB) for the color you sampled, with a one-click "Copy Color Info" button.
- Your extracted-color history stays put even after you reload the page.

---

## Web-App Version 4.6.0 — April 3, 2026

### Redesigned dye filters

Dye filtering has been rebuilt and now works the same way everywhere.

- A cleaner panel groups options into "Dye Types" and "Acquisition Source."
- The same filters now apply across Harmony, Palette Extractor, Gradient, Mixer, Budget, and Swatch.
- The Swatch Matcher respects your filters too, and still returns a full set of results.

---

## Web-App Version 4.5.0 — March 18, 2026

### Reverse matching in the Swatch Matcher

The Swatch Matcher now works in both directions.

- Pick a dye, or type a hex color, and the tool highlights the closest matching character-color swatches.
- The three closest swatches are highlighted and ranked so you can compare options.
- You can send a dye straight to the Swatch Matcher from any result card's menu.
- Fixed a problem where the color grid could show up empty when returning to the tool.

---

## Web-App Version 4.4.0 — March 14, 2026

### Correct currencies and vendor names

Prices and vendor information now appear in your language with the right currency.

- Vendor costs show the correct currency (for example "500 Scrips" or "600 CC") instead of always showing gil.
- "The Firmament" and similar acquisition sources now appear translated.

---

## Web-App Version 4.3.0 — March 1, 2026

### Pixel sampling and image panning

The Palette Extractor gives you finer control over your images.

- Hold Shift and click a zoomed image to sample an exact pixel (or a small area) and find the closest dyes.
- Hold Ctrl or Cmd and drag to pan around a zoomed-in image.
- You can set the sample area size, from a single pixel up to 16×16, in the sidebar.

---

## Web-App Version 4.2.0 — February 27, 2026

### No more duplicate results

The palette tools now avoid repeating the same dye.

- A new "Prevent Duplicates" option (on by default) makes the Harmony Explorer and Palette Extractor pick a different dye for each slot instead of repeating one.
- Dyes you choose yourself are always kept, even if they repeat.

### Paste an image from your clipboard

- The Palette Extractor now has a "Paste from Clipboard" button, and you can paste an image with Ctrl+V or Cmd+V.

---

## Web-App Version 4.1.1 — January 21, 2026

### Mobile experience overhaul

A big batch of fixes makes the tools much nicer to use on phones.

- Tap outside the Color Palette drawer to close it.
- The first tool is no longer cut off in the tool bar.
- Comparison charts and contrast tables now fit the screen and scroll properly.
- The Swatch, Gradient, and Palette Extractor tools resize cleanly on smaller screens.

---

## Web-App Version 4.1.0 — January 18, 2026

### Choose how colors are matched

You can now control the math the app uses to match colors.

- Five tools (Harmony, Palette Extractor, Gradient, Mixer, and Swatch) have a "Matching Algorithm" setting with options like OKLAB (recommended), CIEDE2000, and more.
- Result cards now show which algorithm was used and adapt their closeness scores to it.

### Easier sharing

- Share buttons are clearer and now live in the "Selected Dyes" header; the Accessibility tool lets you pick which color-vision type to include in a shared link.

---

## Web-App Version 4.0.0 — January 17, 2026

### A brand-new look and a new tool

Version 4 is a complete redesign with a modern, glass-like interface and twelve themes to choose from.

- A brand-new **Dye Mixer** tool blends two dyes using realistic paint-mixing models and finds the closest matching FFXIV dyes.
- The whole app was rebuilt for a cleaner, more responsive layout on every screen size.

### Some tools were renamed

A few tools have new names — their features are unchanged:

- Color Matcher is now the **Palette Extractor**.
- The old Dye Mixer is now the **Gradient Builder**.
- Character Color Matcher is now the **Swatch Matcher**.
- Preset Browser is now **Community Presets**.

---

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*
