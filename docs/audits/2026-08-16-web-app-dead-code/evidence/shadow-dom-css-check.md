# Empirical check — do page stylesheets reach tool content inside `V4LayoutShell`?

Method: `pnpm --filter xivdyetools-web-app exec vite preview --port 4173` against the current `dist/`
(built 2026-08-16 16:46), driven with Playwright, `getComputedStyle` inside
`document.querySelector('v4-layout-shell').shadowRoot.querySelector('.v4-layout-content-scroll')`.

## Structure

| Probe | Result |
|---|---|
| `v4-layout-shell` has a shadow root | **yes** |
| light-DOM children of `<v4-layout-shell>` (would be slotted) | **0** |
| children of `.v4-layout-content-scroll` inside the shadow root | 1 — `DIV.v4-tool-container` (the tool is appended *inside* the shadow tree, `v4-layout.ts:618`) |
| `shadowRoot.adoptedStyleSheets` | 2 (Lit `static styles`) — neither contains a `.flex` rule |
| `<style>` elements inside the tool container | 1 (extractor's own `x3c-*` block, 846 B) |
| `document.styleSheets` | 2 (Tailwind + globals bundle, async CSS) |

## Sanity: Tailwind works in the light DOM
A `<div class="flex">` appended to `document.body` computes `display: flex`. ✅

## /harmony (after selecting a random dye — 2 `v4-result-card`s rendered)

| Element inside shadow root | Class | Page rule | Computed |
|---|---|---|---|
| empty-state CTA row | `empty-state-action flex gap-3` | `.flex{display:flex}` | **`display: block`** ✗ |
| one element | `text-sm` | `.text-sm{font-size:14px}` | not 14px ✗ |
| elements with class `number` | — | `.number{font-family:var(--font-mono);font-variant-numeric:tabular-nums}` | **0 elements carry the class** in this tool (5.0 result cards are Lit components with their own shadow styles) |

Only 125 elements total live in the shell's shadow content — the 5.0 tools are mostly Lit components (`v4-result-card`, `dye-palette-drawer`, `v4-config-sidebar`) with their own shadow-scoped `static styles`, so the surface that *would* need page CSS is small. On that surface, page CSS demonstrably does not apply.

## /extractor (BaseComponent-built markup, 82 elements)

| Element | Page rule (from `document.styleSheets`) | Computed | Source of the computed value |
|---|---|---|---|
| `.extractor-section-title` | `font-size:14px; font-weight:600; letter-spacing:1px; text-transform:uppercase` | **`11px / 400 / 1.5px`** | inline `style="font-size: 11px; letter-spacing: 1.5px; …"` |
| `.image-drop-zone` | `aspect-ratio:4/3; border-radius:12px; border:2px dashed …` | **`border-radius:16px`, no aspect-ratio, `padding:24px 18px`** | inline `style="flex:1; … border-radius:16px; …"` |
| `.extractor-layout x3c-workspace` | `.extractor-layout` in `v4-layout.css` | `display:flex` | the tool's own `<style>` `.x3c-workspace{display:flex;…}` — **not** the page rule |

Conclusion: the page rules for `.extractor-*`, `.image-drop-zone`, `.number`, `.empty-state*`, `.section-title`, `.vision-*`,
`.harmony-*`, `.component-error-*`, `.loading-spinner`, `.dye-swatch` and the Tailwind-compat block in `v4-layout.css:706-863`
are all **unreachable** — the 5.0 code compensates with inline styles, per-tool `<style>` tags, and shadow-side duplicates
(`v4-layout-shell.ts:369-533`, `v4-layout.ts:325-418`). This matches the repo's own warning at `v4-layout.ts:313-321`.

## Console (both routes)
- `[WARNING] /assets/icons/icon-40x40.webp was preloaded using link preload but not used within a few seconds`
- `[WARNING] /assets/icons/icon-192x192.png was preloaded using link preload but not used within a few seconds`
- `[ERROR] api.xivdyetools.app/health` CORS from `localhost:4173` — expected (origin not allow-listed), unrelated to this audit
