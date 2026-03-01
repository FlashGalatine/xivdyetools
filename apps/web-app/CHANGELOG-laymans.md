# What's New in Version 4.2.0

*Released: February 27, 2026*

---

## 🔬 Pixel Sampling & Canvas Panning (Unreleased)

**Palette Extractor**
- **Shift+Click** on a zoomed image to sample a single pixel (or a configurable area up to 16×16) and instantly find the closest matching dyes
- **Ctrl+Drag** (or Cmd+Drag on Mac) to pan around zoomed-in images — a grab cursor shows when panning is active
- A new **Pixel Sample Area** size option has been added to the Extractor sidebar so you can choose how large of an area to sample
- Your pan position is remembered when you change zoom levels

---

## 🧹 Under-the-Hood Cleanup (Unreleased)

- Removed a large amount of leftover code from the v3 → v4 migration, reducing the codebase by ~1,200 lines
- Cleaned up internal imports to use the shared type library directly — no user-visible changes

---

## 🎨 No More Duplicate Results

**Harmony Explorer & Palette Extractor**
- Both the Harmony Explorer and Palette Extractor now prevent the same dye from appearing in multiple result cards — you'll see a wider variety of dye suggestions
- A new "Prevent Duplicates" toggle has been added to the OPTIONS sidebar for each tool (on by default) so you can turn it off if you prefer the old behavior

---

## 📋 Paste Images from Clipboard

**Palette Extractor**
- You can now paste images directly into the Palette Extractor using Ctrl+V (or Cmd+V on Mac)
- A new "Paste" button also appears in the image drop zone on supported browsers (Chromium-based)
- Great for quickly extracting colors from screenshots without saving them as files first

---

## 🛠️ Under-the-Hood Improvements

**Code Quality**
- Upgraded to ESLint v10 and resolved all new lint warnings across the entire codebase
- Improved TypeScript strictness — better error handling and type safety throughout
- No visible changes to users — just cleaner, more maintainable code

---

*For the full technical changelog, see [CHANGELOG.md](./CHANGELOG.md)*
