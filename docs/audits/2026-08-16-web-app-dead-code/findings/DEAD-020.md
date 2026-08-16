# [DEAD-020]: Unreachable CSS — ~876 lines of page-stylesheet rules that target tool content inside `V4LayoutShell`'s shadow root (verified empirically)

## Category
Dead CSS (unreachable) — with a design defect attached

## Location
`evidence/agent-report-css.md` §B2 and `evidence/shadow-dom-css-check.md`.

The nine tools are appended **inside** the shell's shadow root (`v4-layout.ts:434-441` → `shadowRoot.querySelector('.v4-layout-content-scroll')`; `:618` `contentContainer.appendChild(toolContainer)`). Document stylesheets do not match elements in a shadow tree, and the repo says so itself (`v4-layout.ts:313-321`: *"tools render INSIDE V4LayoutShell's shadow DOM, so nothing in styles/globals.css or styles/v4-layout.css reaches them … putting it in a page stylesheet is a silent no-op"*). No `adoptedStyleSheets`, `createRenderRoot`, `unsafeCSS`, or `<link>` in the shell exists to bridge it.

**Empirical proof (`vite preview` + Playwright, `getComputedStyle` inside the shadow root):** on `/extractor`, the page rule `.extractor-section-title{font-size:14px;font-weight:600}` exists in `document.styleSheets`, but the element computes `11px / 400` — from an inline `style` attribute; `.image-drop-zone{border-radius:12px;aspect-ratio:4/3}` → element computes `16px`, no aspect-ratio — from inline style; `.extractor-layout` is flex only because the tool injects its own `<style>` (`.x3c-workspace`). On `/harmony`, `class="empty-state-action flex gap-3"` computes `display:block` (Tailwind's `.flex` cannot reach it). A control `<div class="flex">` in the light DOM computes `display:flex`.

| Rules | Page CSS location | Lines | Shadow-side duplicate exists? |
|---|---|---:|---|
| `.extractor-layout .image-drop-zone .extractor-results-* .extractor-section-title .palette-actions .action-btn-text .image-canvas-container .zoom-controls .zoom-btn .zoom-separator` | `v4-layout.css:247-526` | 280 | no — compensated by inline styles + the tool's `<style>` |
| `.section-header .section-title .contrast-table* .pairwise-* .vision-*` | `v4-layout.css:528-704` | 177 | **yes** — `v4-layout-shell.ts:369-533` (byte-for-byte) |
| Tailwind-compat block `.flex … .cursor-pointer` (33 utilities) | `v4-layout.css:706-863` | 158 | Tailwind emits identical utilities; consumers are shadow-DOM |
| `.harmony-results-container .comparison-cards-container` | `v4-layout.css:233-245` | 13 | no (the `--v4-result-card-width` override can never land) |
| `.component-error-*` (9) | `error-boundary.css:12-116` | ~105 | no |
| `.empty-state*` | `globals.css:463-511` | 49 | **yes** — injected `#v5-results-grid-style` (`v4-layout.ts:325-418`) |
| `.dye-swatch` base/hover/active | `globals.css:621-634,659-673` | 29 | **yes** — `preset-detail.ts:464` |
| `.loading-spinner` + `@keyframes spinner-*` | `globals.css:414-445` | 32 | no |
| `.harmony-header/-title/-description/-deviance-info/-icon` | `themes.css:257-283` | 27 | no |
| **`.number`** (`font-family:var(--font-mono); font-variant-numeric:tabular-nums`) | `globals.css:118-123` | 6 | **no** — `grep "^\s*\.number\b" src/components` → 0. Whatever carries `class="number"` inside a tool gets neither the mono face nor tabular figures from this rule. |

## Why It Exists
The v4 layout moved tools into a Lit shell with a shadow root; the page stylesheets that styled them in v3/early-v4 were never migrated. 5.0 patched the visible casualties one at a time (inline styles, per-tool `<style>` tags, shell duplicates) and documented the trap, but the originals were left in place.

## Removal Risk Assessment
| Factor | Assessment |
|--------|------------|
| **Confidence** | HIGH that the rules cannot apply; MEDIUM on "nothing visible changes" only for the rows without a shadow-side duplicate — because if some element *does* rely on the page rule, it is already unstyled today, so deleting the rule changes nothing |
| **Blast Radius** | NONE at runtime (rules already inert). MEDIUM as a *design* question: rows without a duplicate (`.number`, `.component-error-*`, `.loading-spinner`, `.harmony-*`) mean those elements are currently unstyled by intent-bearing rules |
| **Reversibility** | EASY |
| **Hidden Consumers** | Light-DOM uses of the same class names: `.empty-state` etc. are only rendered inside tools; `.component-error-*` only via `BaseComponent` (all inside the shell). Verified none render in `document.body` directly. |

## Recommendation
**REMOVE the page rules — but first REFACTOR the four "no duplicate" rows** by moving each rule to where it *can* apply (the shell's `static styles`, the injected `#v5-results-grid-style`, or the component's own `static styles`). In particular decide what `.number` should mean in 5.0: if numeric columns are meant to be Fragment Mono + tabular (as `6b608ec` intended), that rule has to live in the shell/injected sheet, not `globals.css`. Then delete every row above from the page stylesheets and add a comment at the top of `globals.css`/`v4-layout.css` restating the shadow-boundary rule.

### If Removing
1. For each "no" row: move (don't delete) the rule into the appropriate shadow-side stylesheet, then verify in `vite preview` with `getComputedStyle` (the check in `evidence/shadow-dom-css-check.md` is reproducible)
2. Delete all rows above from `v4-layout.css`, `globals.css`, `themes.css`, `error-boundary.css`
3. `pnpm --filter xivdyetools-web-app run build && node scripts/check-bundle-size.js`
