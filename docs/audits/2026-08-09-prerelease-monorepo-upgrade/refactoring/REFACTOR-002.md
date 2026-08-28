# [REFACTOR-002]: Three font stacks disagree — `noscript`, `load-fonts.js`, and `globals.css` name different families

## Priority
MEDIUM

## Category
Maintainability / design-system conformance

## Location
- [apps/web-app/src/index.html](../../../../apps/web-app/src/index.html) lines 82–88 (`noscript` fallback), 80 (`load-fonts.js` tag)
- `apps/web-app/public/js/load-fonts.js` (12 lines)
- [apps/web-app/src/styles/globals.css](../../../../apps/web-app/src/styles/globals.css) lines 41, 64, 98, 108
- [apps/web-app/src/styles/v4-layout.css](../../../../apps/web-app/src/styles/v4-layout.css) line 29

## Deploy Unit
`web-app`

## Current State

Four places declare the web app's typefaces, and **no two agree**:

| Source | Families named |
|---|---|
| `load-fonts.js` (the path that actually runs) | Space Grotesk · Onest · **Fira Code** · **Varela Round** |
| `index.html` `<noscript>` fallback | **Inter** · **Outfit** · **JetBrains Mono** |
| `globals.css` rules | Space Grotesk (h1–h6) · Onest (body) · **Fira Code** (mono) · **Varela Round** · **Habibi** (`.number`) |
| `v4-layout.css:29` | **`'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`** — a raw system stack |

```js
// apps/web-app/public/js/load-fonts.js — the live request
link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700'
          + '&family=Onest:wght@100..900&family=Fira+Code:wght@400;500;600;700'
          + '&family=Varela+Round&display=swap';
```

```html
<!-- apps/web-app/src/index.html:82-88 — the no-JS fallback, three different families -->
<noscript>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700
              &family=Outfit:wght@400;500;600;700;800
              &family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
</noscript>
```

## Issues

1. **The `noscript` fallback loads three families the stylesheet never references.** With JS
   disabled, the browser downloads Inter, Outfit and JetBrains Mono, then renders in system
   fallbacks anyway because no CSS rule names them. It is pure waste plus a wrong-looking page.
2. **The mono face contradicts the suite decision.** The record settles Fragment Mono as the
   numeric/mono face across the suite; the web app loads Fira Code, and separately forces
   Habibi onto `.number` (see [BUG-002](../bugs/BUG-002.md)). That is *three* different mono-ish
   answers on one surface.
3. **`v4-layout.css:29` bypasses the system entirely** with `'Segoe UI', Tahoma, Geneva,
   Verdana` — a Windows-first stack that renders differently on macOS/Linux/Android and matches
   nothing else in the app. (Filed separately as `REFACTOR-004`; listed here because it is the
   same root cause.)
4. **No CJK fallback anywhere in the web stacks.** Onest and Space Grotesk carry no CJK. The
   record's rule — *"pin `line-height` on any stacked/multi-line small text … check JA and DE
   both"* — is applied on the SVG surfaces but not here. Web CJK currently falls through to the
   system default, which works but is unspecified and varies per OS.

## Proposed Refactoring

Establish **one** font contract for the web surface, then make all four sources read from it.

1. **Decide the roster** — presumably Space Grotesk (display), Onest (body), Fragment Mono
   (numeric/mono), matching the SVG surfaces. Drop Varela Round and Fira Code if nothing needs
   them; confirm against `globals.css:108`'s consumer first.
2. **Self-host.** All three already exist as files in the repo
   (`apps/discord-worker/src/fonts/`). Self-hosting removes the third-party request, kills the
   `fonts.googleapis.com`/`gstatic.com` entries from the CSP, drops four preconnect/dns-prefetch
   hints, and makes the `noscript` path identical to the JS path — the divergence becomes
   structurally impossible rather than merely fixed.
3. **If self-hosting is deferred**, at minimum make the `noscript` href byte-identical to the
   `load-fonts.js` href so the two cannot drift again.
4. **Add an explicit CJK fallback** to the body and display stacks, so ja/ko/zh rendering is a
   decision rather than an accident.

Self-hosting also subsumes [OPT-002](../DEEP_DIVE_REPORT.md) (runtime third-party font fetch)
and lets `DEAD-002` delete `apps/web-app/fonts/` outright.

## Benefits

- One source of truth; the no-JS path renders the same as the JS path.
- Removes a render-blocking third-party dependency from the critical path — a measurable LCP
  win and a privacy improvement (no Google Fonts request per visitor).
- Lets the CSP drop two external origins, tightening `style-src`/`font-src` to `'self'`.
- Aligns the web numeric face with the bot and OG surfaces, closing BUG-002 in the same pass.

## Effort Estimate
**MEDIUM.** The `noscript` alignment alone is LOW (one line). Full self-hosting is MEDIUM:
convert TTF→woff2, add `@font-face` blocks, update the CSP, delete the loader and the hints,
and visually verify all nine tools in both themes.

## Risk Assessment

**Low-to-moderate, and front-loaded.** Font swaps change metrics, and this project's layouts are
measurement-sensitive — the design record repeatedly warns that width checks behave differently
in Chrome vs resvg and that *"a 0 px-slack box 'fits in Chrome', not in resvg"*. That warning is
about the SVG surfaces, but the web app has its own fixed-width numeric columns.

Mitigations:
- Ship the `noscript` alignment first as a standalone, near-zero-risk change.
- Do the self-host as its own commit, with the Playwright E2E suite plus a manual pass over the
  widest-locale cases (JA and DE, per the record's "they fail by different mechanisms" rule).
- Keep `font-display: swap` so a failed self-host degrades to system fonts rather than invisible
  text.
