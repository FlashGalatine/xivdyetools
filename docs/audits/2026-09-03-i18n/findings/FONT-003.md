# FONT-003: 75 web-app style blocks hardcode a Latin font family instead of the `var(--font-*)` token, so CJK text bypasses the curated `--font-cjk` chain
**Tier:** P2 (degraded glyph forms, not tofu — text stays readable) · **Locale(s):** ja ko zh · **Deploy unit:** web-app · **Generated?** no

## Location
- The tokens that exist and are correct: `apps/web-app/src/styles/globals.css:81` — `--font-cjk: 'Noto Sans JP', 'Noto Sans SC', 'Noto Sans KR', 'Hiragino Sans', 'Yu Gothic UI', …`; `:84` — `--font-display: 'Space Grotesk', var(--font-cjk), -apple-system, …`.
- The bypass: **75 declarations across 22 files** write `font-family: 'Space Grotesk' | 'Fragment Mono' | 'Onest', sans-serif` directly. Verified representatives that demonstrably render localized text:
  - `components/v4/dye-palette-drawer.ts:548` — `.category-label`, filled at `:1302` with `LanguageService.getCategory(category)` (ja `赤系`, ko `빨강`).
  - `components/v4/config-sidebar.ts:310` `.v4-sidebar-title` (`common.options`) and `:377` `.config-label` (~20 config labels across all 9 tools).
  - `components/v4/result-card.ts:522` `.zval` — `getAcquisition(dye.acquisition)`.
  - `components/comparison-tool.ts:1788` — the "What Differs" row labels (ja 明度 / 彩度 / 色相).
  - `components/v4/v4-color-wheel.ts:226` `.hub-label` — `harmony.baseColorSection`.

## Evidence
- `git ls-files 'apps/web-app/src/**/*.ts' | xargs grep -n "font-family: *'\(Space Grotesk\|Fragment Mono\|Onest\)'"` → **75 hits / 22 files** (test files excluded).
- Because the literal ends at `sans-serif`, the browser resolves CJK from its own default rather than the JP-first chain. That is precisely what `--font-cjk`'s ordering exists to control — `apps/web-app/src/__tests__/font-contract.test.ts:143` documents that "`--font-cjk` puts Noto Sans JP first, which is correct for ja but draws…". The Han-unification consequence is that a Japanese reader can get Chinese glyph forms for shared kanji.
- Custom properties inherit through the shadow boundary, so `var(--font-display)` works from inside `V4LayoutShell`'s shadow root — the literal is not a workaround for the shadow-DOM CSS boundary.
- The existing regression test (`FONT-WEB-002` in `font-contract.test.ts`) guards only the single file already fixed (`my-submissions-modal.ts`); it does not scan the rest of `src/`, which is why 75 sites persist.

## Fix
- Replace the literals with `var(--font-display)` / `var(--font-mono)` / `var(--font-body)`. Mechanical, but check each site: a few are numeric-only (hex codes, ΔE values) where the token is still correct but the change is cosmetic.
- Extend `font-contract.test.ts` to fail on any `font-family:` in `src/**` that names a bundled family without going through a token — one assertion closes the class permanently.

## Status
FIXED 2026-09-03 `0e61574d` + `1307d783` — 95 declarations across 26 files now use
`var(--font-*)`.

**The first pass was about half of it.** It matched `font-family: 'X'` inside CSS templates —
one of *three* ways these families reach the DOM. It missed
`el.style.fontFamily = "'Fragment Mono', monospace"` (a DOM property, no `font-family:` text at
all) and `const MONO = "'Fragment Mono', …"` interpolated into a style string: 20 more
declarations across 8 components, `swatch-tool.ts` among them — a file listed in the first
commit's "22 fixed" while keeping its own hardcodes. The new tree-wide gate matched the same
single syntax, so it reported clean over all of them.

The gate now matches the family **name** wherever it is quoted, in single or double quotes,
and a second assertion covers the stylesheets. A guard that knows one spelling guards one
spelling.
