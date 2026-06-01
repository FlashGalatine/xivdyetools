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

*For technical details, see [CHANGELOG.md](./CHANGELOG.md)*
