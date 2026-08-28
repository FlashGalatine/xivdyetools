# Agent report — dead CSS audit (`src/styles/*.css`)

**Load-bearing fact:** tool content renders inside `V4LayoutShell`'s shadow DOM (`v4-layout.ts:434-441`, `:618`), and the repo documents at `v4-layout.ts:313-321` that "nothing in styles/globals.css or styles/v4-layout.css reaches them". No escape hatch exists: `adoptedStyleSheets` 0 hits, `createRenderRoot` 0, `unsafeCSS` 0. (Confirmed empirically by the main session — see `shadow-dom-css-check.md`.)

Verdicts: **DEAD** (zero consumers anywhere), **UNREACHABLE** (consumers exist but are shadow-DOM elements the page sheet cannot style), KEEP / DYNAMIC-KEEP / TEST-ONLY.

## (A) File inventory & reachability

| File | Lines | Bytes | Reachable via |
|---|---:|---:|---|
| `src/styles/tailwind.css` | 18 | 505 | `main.ts:13` |
| `src/styles/globals.css` | 916 | 25,087 | `@import` from `tailwind.css:9` |
| `src/styles/error-boundary.css` | 164 | 4,519 | `@import` from `tailwind.css:12` |
| `src/styles/themes.css` | 532 | 14,175 | `main.ts:10` |
| `src/styles/v4-utilities.css` | 265 | 6,384 | `main.ts:11` — **loaded but 100 % unused** |
| `src/styles/v4-layout.css` | 863 | 16,112 | `main.ts:12` |
| **Total** | **2,758** | **66,782** | |

`src/index.html` has no `<link rel=stylesheet>`. Light DOM (page CSS applies): `<body>`, `#app`, the shell host, `modalRoot`/`toastRoot` (`v4-layout.ts:278,289`), tooltip container (`tooltip-service.ts:115`), announcer regions. Shadow DOM: everything under `.v4-layout-content-scroll` — all nine tools.

## (B1) DEAD — zero consumers anywhere (src or e2e)

| Class / rule | File:lines | Lines | Bytes | Evidence |
|---|---|---:|---:|---|
| `.btn` | `globals.css:201`; `themes.css:368,377` | 3 | ~60 | bare token → 0; only compounds (`zoom-btn`, `component-error-btn`, `x3c-auto-btn`) exist |
| `.nav-item` | `globals.css:203` | 1 | ~14 | 0 |
| `.font-numeric` | `globals.css:119` | 1 | ~16 | only `globals.css:119` + `CHANGELOG.md:104` |
| `.tool-card` (+4 `body.*` variants) | `globals.css:214-238` | 25 | 642 | comment says "for index.html" — `src/index.html` has no such markup |
| `.text-warning/.text-error/.text-success/.text-info` | `globals.css:393-408` | 16 | 248 | 0 |
| `.spinner-sm/-md/-lg` | `globals.css:447-461` | 15 | 167 | 0 |
| `@keyframes modal-backdrop-fade-in/slide-up/fade-in/slide-out` + `.modal-backdrop-animate-in` `.modal-animate-in` `.modal-animate-out` + reduced-motion | `globals.css:513-587` | 75 | 1,329 | classes 0; keyframes referenced only by those classes |
| `@keyframes preview-pulse` + `.dye-preview-overlay .pulse-dot` | `globals.css:589-615` | 27 | 543 | 0 |
| `.dye-swatch.selected` + `::after` | `globals.css:636-657` | 22 | 434 | `gradient-tool.ts:1600,2001` use `toggleAttribute('selected')` — attribute, not class |
| `.harmony-card` (+hover, reduced-motion) | `globals.css:675-693` | 19 | 358 | 0 |
| `body.standard-dark/…` `.modal-dialog` overrides | `globals.css:701-708` | 8 | 277 | `document.body.classList` never called anywhere |
| `body.*` `.tooltip` dark overrides | `globals.css:791-826` | 36 | 1,509 | same |
| `.sr-only-focusable:focus/:active` | `globals.css:845-856` | 12 | 263 | 0 (`.sr-only` itself IS used) |
| `body.*` `:focus-visible` overrides | `globals.css:875-882` | 8 | 313 | same |
| `.dark`, `.theme-sugar-riot`, `.theme-og-classic-dark` selectors | `globals.css:333,335,336` | 2 | 44 | rule survives via `[class*="-dark"]` (line 334) |
| `.theme-cotton-candy .theme-grayscale-light .theme-high-contrast-light .theme-parchment-light .theme-hydaelyn-light` | `globals.css:360-364` | 5 | 121 | theme names don't exist (see B3) |
| `--v4-glass-opacity` | `themes.css:45` | 1 | 37 | never read |
| `html.theme-high-contrast-*` block | `themes.css:323-342` | 20 | 607 | theme names don't exist |
| `.featured-section-gradient` | `themes.css:488-491` | 4 | 227 | 0 |
| `.app-shell`, `.app-footer` | `themes.css:92-95,106-110` | 9 | ~330 | 0 (`.app-header` also 0 — only `v4-app-header`) |
| `.color-swatch .palette-color .gradient-stop [data-color-swatch]` | `themes.css:392-399` | 8 | ~200 | 0 (`color-swatch` hits are `::-webkit-color-swatch` pseudo-elements) |
| `[data-theme="dark"]`, `.theme-og-classic-dark`, `.theme-sugar-riot`, `.theme-grayscale-dark`, `.theme-high-contrast-dark` | `error-boundary.css:122,124-127` | 5 | ~215 | only `.theme-standard-dark` (line 123) is live |
| **entire `v4-utilities.css`** (24 classes: `.v4-glass*`, `.v4-shadow-*`, `.v4-gradient-*`, `.v4-header`, `.v4-tool-banner`, `.v4-sidebar`, `.v4-content-padding`, `.v4-result-card`, `.v4-transition-*`, `.v4-interactive`, `.v4-text-*`, `.v4-border-*`) | `v4-utilities.css:1-265` | **265** | **6,119** | targeted `class=` regex → 0 for every class; non-zero substring hits are all `var(--v4-…)` reads or different tokens in Lit shadow styles. Variables alive; utility classes not. |
| `.v4-content-full-bleed .v4-content-centered .v4-card-grid .v4-tool-layout .v4-tool-section .v4-tool-section-title .v4-empty-state* .v4-loading-overlay .v4-loading-spinner` + `@keyframes v4-spin` | `v4-layout.css:40-177` | 138 | 2,795 | 0 in src and e2e |
| `body.theme-*-light v4-config-sidebar` / `theme-high-contrast-*` | `v4-layout.css:15-38` | 24 | 777 | body class never set AND theme names don't exist |
| `.image-input-section .has-image .drop-content .drop-icon .drop-text .drop-subtext .extractor-section-header .palette-actions .extractor-empty-results .vision-simulations-grid` | inside `v4-layout.css:247-704` | ~90 | ~2,100 | 0 |

## (B2) UNREACHABLE — consumers exist, but they're shadow-DOM elements

| Class(es) | Page-CSS location | Lines | Bytes | Consumer (all shadow DOM) | Shadow-side duplicate |
|---|---|---:|---:|---|---|
| `.number` | `globals.css:118-123` | 6 | ~180 | class-attribute consumers in tools (2 in components; the earlier "475" figure was a raw word count of `number` incl. TS types) | **none** — `grep "^\s*\.number\b" src/components` → 0. The tabular-nums rule reaches nothing. |
| `.empty-state -icon -title -description -action` | `globals.css:463-511` | 49 | ~1,150 | `empty-state.ts:131-163` | **yes** — injected shadow sheet `v4-layout.ts` gridStyle |
| `.section-header .section-title .contrast-table* .pairwise-* .vision-*` | `v4-layout.css:528-704` | 177 | 3,618 | `accessibility-tool.ts`, `comparison-tool.ts`, `gradient-tool.ts` | **yes** — `v4-layout-shell.ts:369-533` |
| `.extractor-layout .image-drop-zone .extractor-results-* .extractor-section-title .palette-actions .action-btn-text .image-canvas-container .zoom-controls .zoom-btn .zoom-separator` | `v4-layout.css:247-526` | 280 | 4,965 | `extractor-tool.ts`, `image-zoom-controller.ts` | none in CSS — compensated by inline styles + the tool's own `<style>` (`x3c-*`), verified empirically |
| `.harmony-results-container .comparison-cards-container` | `v4-layout.css:233-245` | 13 | 477 | `harmony-tool.ts:1079`, `comparison-tool.ts:942` | the `--v4-result-card-width` override can never land |
| `.harmony-header .harmony-title .harmony-description .harmony-deviance-info .harmony-icon` | `themes.css:257-283` | 27 | ~700 | `harmony-type.ts` | none |
| Tailwind-compat block (33 utilities `.flex … .cursor-pointer`) | `v4-layout.css:706-863` | 158 | 1,958 | Tailwind already emits identical utilities; consumers are shadow-DOM | redundant |
| `.component-error-*` (9 classes) | `error-boundary.css:12-116` | ~105 | ~2,600 | `base-component.ts:336-400` — BaseComponent instances render inside the shell's shadow root | none |
| `.loading-spinner` (+ `@keyframes spinner-spin/pulse`) | `globals.css:414-445` | 32 | ~430 | `market-board.ts:344` (inside a tool) | none |
| `.dye-swatch` base + hover/active | `globals.css:621-634,659-673` | 29 | ~500 | `dye-card-renderer.ts:98` | **yes** — `preset-detail.ts:464` |

## (B3) DYNAMIC-KEEP

`.toast-{success,error,warning,info}` — `toast-container.ts:98` template; toasts live in `toastRoot` → light DOM → `globals.css:369-391` genuinely apply. **KEEP.** `.theme-standard-light/-dark` — `theme-service.ts:262` on `document.documentElement`. **KEEP** — but *only* these two: `src/shared/constants.ts:47` `THEME_NAMES = ['standard-light','standard-dark']`, so every rule keyed on `theme-og-classic-dark`, `theme-sugar-riot`, `theme-cotton-candy`, `theme-grayscale-*`, `theme-parchment-light`, `theme-hydaelyn-light`, `theme-high-contrast-*` is unmatchable; and `document.body.classList` is never touched, so every `body.<theme>` / `body.dark-mode` selector is doubly dead.

## (B4) TEST-ONLY
`.v4-mobile-sidebar-toggle` (`v4-layout.css:189` print rule) — `e2e/budget-tool.spec.ts:306` locator; src=0 so the locator resolves to nothing; the rule is dead either way.

## (C) Custom properties (49 declared)
Dead: `--v4-glass-opacity` (`themes.css:45`), `--focus-ring-width` (`:326`), `--focus-ring-offset` (`:327`, inside the dead high-contrast block); `--v4-shadow-card` (`:52`) dead by transitivity (only reader is dead `.v4-shadow-card`). `--tw-ring-color` — KEEP (Tailwind reads it). Other 43 all read. **No `@theme` blocks** exist — the project uses the legacy JS-config path (`@config`), so `--font-*` are alive purely because `globals.css` and `tailwind.config.js:17-20` read them.

## (D) Fonts — clean
`Space Grotesk` / `Onest` / `Fragment Mono` all declared (`globals.css:37-68`), all files exist in `public/fonts/` (48,980 / 57,512 / 46,020 B), all families referenced; preloads at `index.html:90-91` correct; Fragment Mono deliberately not preloaded. No orphan font files.

## (E) Keyframes / IDs / attributes
11 keyframes, all referenced — but `modal-*` ×4, `preview-pulse`, `v4-spin` are referenced only from dead rules (dead by transitivity); `spinner-*` only from unreachable `.loading-spinner`; `toast-*` live. **Zero ID selectors** in any stylesheet. `[data-position=…]` (tooltip) live; `[data-color-swatch]` dead (0 setters); `[data-theme="dark"]` dead (only `theme-modal.ts:136` sets `data-theme` on modal buttons with values `standard-*`); `input[type="submit"]`/`[type="reset"]` (`globals.css:204-205`) 0 hits.

## (F) `tailwind.config.js`
Tailwind v4.3.3 via `@tailwindcss/postcss`; `@config "../../tailwind.config.js"` resolves correctly. `content[0]="./index.html"` does not exist; `content[1]="./src/**/*.{ts,tsx}"` matches no HTML/CSS. **Empirically `src/index.html` IS scanned** (`.font-sans` from `index.html:93` and `.font-numeric` from `globals.css:119` both appear in `dist/assets/index-*.css`) — via v4 automatic source detection, not the legacy globs. So `content` is dead/misleading config; correct to `./src/index.html` or drop in favour of `@source`. `theme.extend.fontFamily.heading` → `font-heading`: **0 hits repo-wide, not even generated — dead config.** `fontFamily.numeric` → `font-numeric` utility IS emitted (token seen in `globals.css`) and **collides** with the hand-authored `.font-numeric` rule — built CSS contains both back to back. `darkMode` comment (lines 3-5) contradicts `themes.css:130-133`; codebase writes `dark:` variants extensively — flagged for a separate check.

## (G) Totals
Provably dead: `globals.css` ~277 lines/~6,600 B; `themes.css` ~44/~1,400; `error-boundary.css` 5/~215; `v4-utilities.css` **265 (entire file)/6,119**; `v4-layout.css` ~252/~5,670 → **~843 lines / ~20,000 B**.
Unreachable: `globals.css` ~116/~2,260; `themes.css` 27/~700; `error-boundary.css` ~105/~2,600; `v4-layout.css` ~628/~11,018 → **~876 lines / ~16,580 B**.
**Grand total ~1,719 of 2,758 lines (62 %) / ~36.6 KB of 66.8 KB (55 %)** dead or unreachable.
