# What's New in Version 4.3.0

*Released: March 1, 2026*

---

## 🔬 Pixel Sampling & Canvas Panning

**Palette Extractor**
- **Shift+Click** on a zoomed image to sample a single pixel (or a configurable area up to 16×16) and instantly find the closest matching dyes
- **Ctrl+Drag** (or Cmd+Drag on Mac) to pan around zoomed-in images — a grab cursor shows when panning is active
- A new **Pixel Sample Area** size option has been added to the Extractor sidebar so you can choose how large of an area to sample
- Your pan position is remembered when you change zoom levels

---

## 🧹 Under-the-Hood Cleanup

- Removed a large amount of leftover code from the v3 → v4 migration, reducing the codebase by ~1,200 lines
- Cleaned up internal imports to use the shared type library directly — no user-visible changes
- Completed a comprehensive dead code audit across the entire project, removing unused components, deprecated functions, orphaned files, and stale constants
- Migrated all type imports to use the shared `@xivdyetools/types` library directly, improving build reliability

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
- The shared dye library (`@xivdyetools/core`) has been updated to v2.0.0 with cleaner internal organization
- SVG generation code has been refactored with shared utilities, reducing duplication
- Test infrastructure now uses random IDs for better parallel test support
- No visible changes to users — just cleaner, more maintainable code

---

*For the full technical changelog, see [CHANGELOG.md](./CHANGELOG.md)*
