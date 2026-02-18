# Browser Testing Checklist - v2.0.0

**Purpose**: Verify all 5 tools work correctly across browsers
**Test Environment**: http://localhost:5173/
**Release Target**: November 16, 2025

---

## Testing Browsers

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | Latest | ⏳ | Primary - Most users |
| Firefox | Latest | ⏳ | Secondary |
| Safari | Latest | ⏳ | macOS/iOS |
| Edge | Latest | ⏳ | Windows |

---

## Quick Test Checklist

### Global Tests (All Tools)
- [x] Portal loads, no console errors
- [x] All 5 tools link visible
- [x] Theme switcher works (all 10 themes)
- [x] Theme persists after refresh

### Tool 1: Accessibility Checker
- [x] Dye selection works
- [x] **Duplicate dyes selectable** ✨
- [x] **Search preserves focus & text** ✨
- [x] **Category highlights change** ✨
- [ ] **Analysis results display** ✨
  - [ ] So far, only Individual Dye Analysis works. However, it seems to have only given me tritanopia results and not the other color blindness types.

- [ ] Pair comparisons work
  - [ ] Not sure how to test this. Is there supposed to be a function to combine two dyes into one with this tool?


### Tool 2: Color Harmony Explorer
- [x] All 6 harmony types generate
- [ ] Color wheel visualizes
  - [ ] BUG: **THERE IS NO COLOR WHEEL!** (See feedback/no-colorwheel.png)

- [x] Deviance scores display
- [x] Works in all themes
- [ ] SUGGESTION: Can we add buttons to export the listed dyes as CSS and JSON, just like in the Dye Comparison tool?

### Tool 3: Color Matcher
- [x] Drag-drop works
- [x] Color picker works
- [x] Image displays on canvas
- [ ] Zoom controls work
  - [ ] There are Zoom controls? I don't see any controls, nor do I know of any keyboard shortcuts that activates them.

- [x] Matching results accurate
- [ ] VISUAL BUG: The "Tip: Paste an image using Ctrl+V (Cmd+V on Mac)" message does NOT change colors when selecting other Themes.
- [ ] BUG: Facewear Dyes are still being recommended in the "Similar Dyes" list.
  - [ ] INTENDED: No Facewear Dyes should be in this list.

- [ ] SUGGESTION: Can you increase the Maximum size from 10 MB to 20 MB? This would allow for some 4K images to be loaded.

### Tool 4: Dye Comparison
- [x] 3 charts render (matrix, 2D, 1D)
- [x] Export formats work (JSON, CSV)
- [x] Data accurate
- [x] Performance acceptable

### Tool 5: Dye Mixer
- [x] Gradient interpolates
- [x] Deviance scores display
- [ ] Save/load works
  - [ ] **THERE'S NO SAVE/LOAD FEATURE!**

- [x] Responsive layout

---

## Key Features to Verify

### Critical Fixes (NEW)
1. **Duplicate Dye Selection** ✨
   - Select same dye multiple times
   - Up to 12 total selections
   - All analyzed independently

2. **Search Input Stability** ✨
   - Type without losing focus
   - Text remains visible
   - Filtering still works

3. **Category Button Highlighting** ✨
   - Buttons show current category
   - Highlight changes on click
   - Not stuck on "Neutral"

4. **Analysis Results Generation** ✨
   - Results appear after selection
   - Individual dye cards show
   - Pair comparisons display
   - All data accurate

---

## Console Check

For each browser, verify:
- ✅ **0 red errors**
- ✅ **0 yellow warnings** (or acceptable)
- ✅ **No 404s for assets**

---

## Performance Targets

- Page load: **< 3 seconds**
- Tool switch: **< 500ms**
- Dye selection: **< 100ms**
- Charts render: **< 1 second**

---

## Pass Criteria

✅ All 5 tools fully functional
✅ No console errors
✅ All themes work
✅ Responsive at 375px, 768px, 1080p
✅ Performance acceptable
✅ Keyboard navigation works
✅ Text contrast readable

---

## When Complete

After testing all browsers and confirming all checks pass:

1. ✅ Create git tag: `git tag -a v2.0.0 -m "Release v2.0.0"`
2. ✅ Final commit
3. ✅ Ready for production deployment

---

**Status**: Ready for testing
**Date**: November 16, 2025
