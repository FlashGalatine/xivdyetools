# What's New

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
