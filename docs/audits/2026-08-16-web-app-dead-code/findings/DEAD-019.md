# [DEAD-019]: Provably dead CSS — the entire `v4-utilities.css` plus ~580 lines across the other stylesheets (~843 lines / ~20 KB)

## Category
Dead CSS

## Location
`evidence/agent-report-css.md` §B1, §C, §E. Every class token was grepped against `src/**/*.{ts,html}` (class attributes, `classList`, `classMap`, `querySelector`) and `e2e/`:

| File | Dead lines | Bytes | Headline items |
|---|---:|---:|---|
| `src/styles/v4-utilities.css` | **265 (entire file)** | 6,119 | all 24 classes (`.v4-glass*`, `.v4-shadow-*`, `.v4-gradient-*`, `.v4-header`, `.v4-tool-banner`, `.v4-sidebar`, `.v4-content-padding`, `.v4-result-card`, `.v4-transition-*`, `.v4-interactive`, `.v4-text-*`, `.v4-border-*`) — 0 class consumers; the `--v4-*` **variables** they read are alive (used from Lit shadow styles and `theme-service.ts`) |
| `src/styles/globals.css` | ~277 | ~6,600 | `.btn`, `.nav-item`, `.font-numeric`, `.tool-card` (+ `body.*` variants, "for index.html"), `.text-warning/-error/-success/-info`, `.spinner-sm/-md/-lg`, the whole modal-animation block (`@keyframes modal-*` ×4 + `.modal-*-animate-*`, 75 lines), `.dye-preview-overlay .pulse-dot` + `@keyframes preview-pulse`, `.dye-swatch.selected` (gradient-tool uses the *attribute*, not the class), `.harmony-card`, every `body.<theme>` override block (`document.body.classList` is never touched anywhere), `.sr-only-focusable`, dead theme-name selectors (`.theme-cotton-candy`, `.theme-grayscale-*`, `.theme-parchment-light`, `.theme-hydaelyn-light`, `.theme-sugar-riot`, `.theme-og-classic-dark`, `.dark`) — `THEME_NAMES` is exactly `['standard-light','standard-dark']` (`constants.ts:47`) |
| `src/styles/v4-layout.css` | ~252 | ~5,670 | `.v4-content-full-bleed`, `.v4-content-centered`, `.v4-card-grid`, `.v4-tool-layout`, `.v4-tool-section(-title)`, `.v4-empty-state*`, `.v4-loading-overlay/-spinner` + `@keyframes v4-spin` (138 lines); `body.theme-*-light v4-config-sidebar` / high-contrast blocks (24); `.image-input-section`, `.has-image`, `.drop-*`, `.extractor-section-header`, `.palette-actions`, `.extractor-empty-results`, `.vision-simulations-grid` (~90); `.v4-mobile-sidebar-toggle` print rule (test-only locator, src=0) |
| `src/styles/themes.css` | ~44 | ~1,400 | `html.theme-high-contrast-*` block (20 lines, incl. `--focus-ring-width/-offset`), `.featured-section-gradient`, `.app-shell`, `.app-footer`, `.color-swatch .palette-color .gradient-stop [data-color-swatch]`, `--v4-glass-opacity` (never read), `--v4-shadow-card` (only reader is dead `.v4-shadow-card`) |
| `src/styles/error-boundary.css` | 5 | ~215 | `[data-theme="dark"]`, `.theme-og-classic-dark`, `.theme-sugar-riot`, `.theme-grayscale-dark`, `.theme-high-contrast-dark` selectors (only `.theme-standard-dark` can match) |
| `src/styles/globals.css:204-205` | 2 | | `input[type="submit"]`, `input[type="reset"]` — 0 such inputs in `src` |

## Why It Exists
Three generations of theming (12 themes → 2), the v3 multi-page markup (`.tool-card`, `.nav-item`), and a glassmorphism utility layer (`v4-utilities.css`) whose consumers moved into Lit `static styles`. Tailwind v4 also generates identical utilities for several hand-authored ones.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH — every token grepped, dynamic patterns (`toast-${type}`, `theme-${name}`) accounted for and kept |
| **Blast Radius** | LOW — page CSS only; the light-DOM surface (`body`, `#app`, toasts, tooltips, modals root) is small and its live rules are kept |
| **Reversibility** | EASY |
| **Hidden Consumers** | `--v4-*` custom properties are read by shadow styles — keep the *variable declarations* in `themes.css`; delete only the utility *classes*. Tailwind `@source` auto-detection scans `.css` files too, so deleting `.font-numeric` in `globals.css` also stops Tailwind emitting the colliding `.font-numeric` utility (good). |

## Recommendation
**REMOVE**

### If Removing
1. `git rm src/styles/v4-utilities.css`; delete `main.ts:11`
2. Delete the listed blocks in `globals.css`, `v4-layout.css`, `themes.css`, `error-boundary.css` (line ranges in the evidence report)
3. `pnpm --filter xivdyetools-web-app run build && node scripts/check-bundle-size.js`; spot-check toasts, tooltips, modals, theme switch in `vite preview`
