# XIV Dye Tools v2.0.0 - Release Notes

**Release Date**: November 16, 2025  
**Version**: 2.0.0  
**Status**: ✅ Production Ready

---

## 🎉 Welcome to v2.0.0!

XIV Dye Tools has been completely rebuilt from the ground up with modern web technologies. This is a major architectural refactor that brings type safety, maintainability, and enhanced performance while preserving all features you know and love.

---

## What's New in v2.0.0

### 🏗️ Architecture Refactor

**From Monolithic HTML to Component-Based Architecture**

Before (v1.6.x):
- 4 separate monolithic HTML files (~1,500-1,900 lines each)
- No TypeScript, pure JavaScript
- Manual testing
- Webpack build system
- Code duplication across tools

After (v2.0.0):
- 8 reusable TypeScript components
- 4 service layers (Color, Dye, Theme, Storage)
- 140+ unit tests (>90% coverage)
- Vite build system (~5x faster)
- Centralized business logic

### ✨ New Features

#### 1. **Duplicate Dye Selection in Accessibility Checker**
- Select the same dye multiple times (up to 12 total)
- Perfect for outfits that use the same color on multiple pieces
- Each selection analyzed independently

#### 2. **Smart Component Updates**
- Search box now preserves focus and text while filtering
- Category buttons highlight correctly when switching filters
- No more frustrating focus loss during interactions

#### 3. **Enhanced Theme System**
- All 10 themes working perfectly
- Proper background colors for light/dark variants
- Consistent contrast across all themes

### 🚀 Performance Improvements

| Metric | v1.6.x | v2.0.0 | Improvement |
|--------|--------|--------|------------|
| Build Time | 10-15s | 2-3s | **5-8x faster** |
| Bundle Size | N/A | 141.37 KB JS | Optimized |
| Component Updates | Full re-render | Smart update | Only changed sections |
| Test Coverage | 0% | 90%+ | Comprehensive |

### 🔧 Technical Improvements

- **TypeScript Strict Mode** - Full type safety everywhere
- **Vite Build System** - Modern, fast, optimized bundling
- **Component Lifecycle Hooks** - Proper initialization, updates, cleanup
- **Service Layer Pattern** - Separated concerns, easier testing
- **Unit Tests** - 140 tests with >90% coverage

### 📊 Code Quality Metrics

**Test Coverage by Service**:
- ThemeService: 98.06% ✅
- DyeService: 94.9% ✅
- ColorService: 89.87% ✅
- StorageService: 79.78% ✅
- **Overall**: 90.7% statements ✅

**Tests**: 140/140 passing (100%) ✅

### 🐛 Bug Fixes from Development

All issues discovered during Phase 12.5-12.6 fixed:

1. ✅ Facewear dyes no longer suggested for color matching
2. ✅ Triadic harmony excludes base color from results
3. ✅ Harmony suggestions limited to top 6 by deviance
4. ✅ Button text contrast improved on all colors
5. ✅ Theme backgrounds apply correctly
6. ✅ Harmony card headers use proper contrast
7. ✅ Category button highlighting works correctly
8. ✅ Search input preserves focus and text

---

## Breaking Changes

**For Users**: ❌ None!
- All v1.6.x features work exactly the same
- All your settings migrate automatically
- No data loss
- Same URLs, same bookmarks

**For Developers**: ⚠️ Build process changed
- Vite instead of webpack
- TypeScript required (no JavaScript version)
- Import paths use @ aliases
- Dev server on port 5173 instead of 8080

---

## How to Migrate from v1.6.x

### For Users

1. **Clear your browser cache** (recommended)
   - Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

2. **Your settings are automatically migrated**
   - Theme preference
   - localStorage data
   - No action needed!

### For Developers

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test -- --run
```

---

## System Requirements

- **Modern Browser** (ES2020+):
  - Chrome 51+
  - Firefox 54+
  - Safari 11+
  - Edge 15+
  
- **No server needed** - 100% client-side
- **Storage**: ~50MB for cache
- **RAM**: 4GB+ recommended

---

## Known Limitations

1. **Universalis API is optional**
   - Tools work offline
   - Market prices require connection

2. **GPU acceleration needed**
   - Canvas rendering for charts requires GPU
   - Works on all modern systems

3. **Database size**
   - 136 dyes fully supported
   - Filtering and search highly optimized

---

## Accessibility & Inclusion

- ♿ **WCAG AA compliant** - Full accessibility
- 🎨 **10 theme variants** - Many color options
- 👁️ **Colorblindness simulation** - Accurate Brettel 1997 algorithm
- ⌨️ **Keyboard navigation** - All features accessible
- 📱 **Responsive design** - Works on all devices

---

## All 5 Tools Updated to v2.0.0

### Color Accessibility Checker v2.0.0
- ✅ Duplicate dye selection support
- ✅ Improved event handling
- ✅ Better analysis reporting

### Color Harmony Explorer v2.0.0
- ✅ All harmony types working
- ✅ Stable filtering
- ✅ Theme-aware styling

### Color Matcher v2.0.0
- ✅ Drag-drop support
- ✅ Clipboard paste (Ctrl+V)
- ✅ Eyedropper tool

### Dye Comparison v2.0.0
- ✅ 3 chart types rendering
- ✅ Export formats (JSON, CSS)
- ✅ Performance optimized

### Dye Mixer v2.0.0
- ✅ HSV interpolation
- ✅ Gradient visualization
- ✅ Deviance scoring

---

## Support & Feedback

### Getting Help
- **Issues**: https://github.com/FlashGalatine/xivdyetools/issues
- **Discussions**: https://github.com/FlashGalatine/xivdyetools/discussions
- **Documentation**: [README.md](README.md) and [CHANGELOG.md](CHANGELOG.md)

### Report Bugs
If you encounter issues:
1. Check browser console (F12)
2. Note the error message
3. Create an issue on GitHub with:
   - Browser and version
   - Steps to reproduce
   - Console error (if any)

---

## What's Next?

### Phase 13 Plans (Future)
- Enhanced color matching with ML
- Inventory system integration
- Price history tracking
- Custom palette saving
- Community palette sharing
- Mobile app version

---

## Special Thanks

- **FFXIV Community** - Data centers, worlds, dye database
- **Universalis** - Real-time market board API
- **Color Science** - Brettel 1997 colorblindness research
- **All Users** - Feedback and support

---

## Quick Links

- **Live Version**: https://xivdyetools.com
- **GitHub**: https://github.com/FlashGalatine/xivdyetools
- **Documentation**: [README.md](README.md)
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **License**: MIT

---

**Happy Glamming! 🎨**

*XIV Dye Tools v2.0.0 is ready for production use.*

---

**Release Notes Generated**: November 16, 2025  
**Next Update**: Phase 13 (TBA)
