# Dead CSS — Summary

## Overview
- **Total Findings:** 3 (DEAD-019, 020, 021)
- **Recommended for Removal:** 3 (DEAD-020 REFACTOR-FIRST for four rule groups)
- **Estimated Lines Removable:** ~1,719 of 2,758 (62 %) / ~36.6 KB of 66.8 KB

| ID | Scope | Lines | Confidence | Recommendation |
|----|-------|------|------------|----------------|
| DEAD-019 | Provably dead — entire `v4-utilities.css` + blocks in `globals.css`, `v4-layout.css`, `themes.css`, `error-boundary.css` | ~843 | HIGH | REMOVE |
| DEAD-020 | Unreachable — page rules targeting tool content inside `V4LayoutShell`'s shadow root (verified with `getComputedStyle`) | ~876 | HIGH (inert) | REFACTOR FIRST for `.number`, `.component-error-*`, `.loading-spinner`, `.harmony-*` (move into a shadow-side sheet), then REMOVE all |
| DEAD-021 | `tailwind.config.js` — phantom `content`, dead `font-heading`, colliding `font-numeric`, contradictory `darkMode` comment | config | HIGH | REMOVE / fix |

**Live and kept:** the `--v4-*` / `--theme-*` / `--font-*` custom properties (read from shadow styles), the toast classes (light DOM), `theme-standard-light/-dark`, tooltip `[data-position]`, all three `@font-face` + woff2 files, `--tw-ring-color`.
