# 04 — Theme Consolidation (12 → Light + Dark)

> Part of [Monorepo 2.0 / Web-App 5.0 research](./README.md).
> **Decision (fixed input):** the web app keeps exactly two themes — Light and Dark — whose visual designs are being produced in Claude Design. Everything else here is scoping, not re-litigation.

## Summary

The web app currently ships **12 themes** (code comments claiming "11" at `theme-service.ts:5` / `themes.css:5` are stale, and `docs/projects/web-app/theming.md` invents a nonexistent `premium-light`). Theme identity is unusually well centralized — literal theme names live in only **5 source files** plus the 6 locale JSONs — and **no component branches on theme name**; everything consumes `var(--theme-*)` / `var(--v4-*)` custom properties. There are **no per-theme images, fonts, logos, or OG assets**, and **no production code outside web-app** knows any theme name (og-worker's `THEME` constant is an unrelated fixed SVG palette in `packages/svg/src/base.ts:267`).

Removal scope: roughly **~750 LOC of live TS/CSS**, **~400 LOC of tests**, and optionally **~1,500 LOC of already-dead legacy theme code** that Vite never ships.

## 1. Current Theme Inventory

Canonical definitions: `ThemeName` union in `apps/web-app/src/shared/types.ts:23-35`, `THEME_NAMES` in `src/shared/constants.ts:25-38`, palettes in `src/services/theme-service.ts:71-359`, per-theme `color-scheme` blocks in `src/styles/themes.css:58-124`, picker UI in `src/components/v4/theme-modal.ts` (268 LOC).

| Theme | Palette (theme-service.ts) | Notes |
|-------|---------------------------|-------|
| `standard-light` | `:73-95` | |
| `standard-dark` | `:96-119` | |
| `premium-dark` | `:122-145` | **Current default** (`DEFAULT_THEME`, `constants.ts:40`); oddly has no `color-scheme` block in themes.css |
| `hydaelyn-light` | `:148-169` | |
| `og-classic-dark` | `:170-192` | Extra selectors in `globals.css`, `error-boundary.css:124` |
| `parchment-light` | `:195-217` | Glass override in `v4-layout.css:43` |
| `cotton-candy` | `:218-241` | Light theme without `-light` suffix → forces the `toggleDarkMode()` "no variant" warning path (`theme-service.ts:456-470`) |
| `sugar-riot` | `:242-265` | Dark theme without `-dark` suffix → **hardcoded twice** into dark detection (`theme-service.ts:413`, `:588`); 8 selector groups in `globals.css` |
| `grayscale-light` | `:268-288` | |
| `grayscale-dark` | `:289-310` | ~7 selectors in `globals.css` |
| `high-contrast-light` | `:313-335` | `disableBlur: true`; overrides in `themes.css:369-395`, `v4-utilities.css:45-56`, `v4-layout.css:44,52` |
| `high-contrast-dark` | `:336-358` | Same override set |

Locale coupling: each of the 6 locale files carries a 12-key `"themes"` block (`src/locales/{en,ja,de,fr,ko,zh}.json:837-850`).

## 2. How Theming Works Today (the contract to preserve)

`ThemeService.applyTheme()` (`theme-service.ts:476-546`) does two things:

1. Swaps a `theme-<name>` class on `<html>` (`document.documentElement`). Note: several CSS rules target `body.theme-*` while the class is set on `<html>` — those rules are **already dead**.
2. Writes inline CSS custom properties onto `document.documentElement.style`:
   - **Core v3 vars (9):** `--theme-primary`, `--theme-background`, `--theme-text`, `--theme-text-header`, `--theme-border`, `--theme-background-secondary`, `--theme-card-background`, `--theme-card-hover`, `--theme-text-muted`
   - **Optional v4 vars:** `--v4-glass-bg`, `--v4-glass-blur`, `--v4-text-header-muted`, `--v4-accent-hover`, `--v4-accent-rgb`, `--v4-shadow-soft`, `--v4-shadow-glow`, `--v4-gradient-start`, `--v4-gradient-end`, `--v4-card-gradient-end`

**This variable set is the contract the new Claude Design Light/Dark themes must fill** (or deliberately replace — see §5). No CSS file swapping, no `data-theme` attribute (one orphaned `[data-theme="dark"]` selector at `error-boundary.css:122`; an E2E test also hardcodes `[data-theme="hydaelyn-light"]` at `e2e/ui-interactions.spec.ts:160` — both are cruft).

Persistence: localStorage `xivdyetools_theme` (`constants.ts:80`). A second key `xivdyetools_dark_mode` (`constants.ts:82`) is declared but **never read or written** — dead. Switching surfaces: theme modal (`v4/theme-modal.ts`), header button (`v4/v4-app-header.ts:216-220`), keyboard shortcut (`keyboard-service.ts:141-148` → `toggleDarkMode()`).

**Notably absent:** any `prefers-color-scheme` detection. The app never follows the OS light/dark preference — see §5.

## 3. Removal Scope

| Area | Location | ~LOC |
|------|----------|------|
| 10 of 12 palettes | `theme-service.ts:148-358` | 230 |
| Variant/toggle helpers made trivial (`toggleDarkMode` special cases, `getLightVariant`/`getDarkVariant`/`getThemeVariants`, sugar-riot hacks) | `theme-service.ts:413,456-470,588,594-605,636-640` | 60 |
| `THEME_NAMES` + `ThemeName` members | `constants.ts:29-37`, `types.ts:27-35` | 20 |
| Theme picker modal → 2-state toggle | `v4/theme-modal.ts` | ~230 of 268 |
| Locale `themes` keys (10 × 6 locales) | `src/locales/*.json:840-849` | 60 |
| Per-theme CSS (`color-scheme` blocks, high-contrast overrides, glass tweaks) | `themes.css:69-124,369-395`, `v4-utilities.css:45-56`, `v4-layout.css:38-57` | ~120 |
| Theme-name selectors in **unimported** files | `globals.css` (823 LOC file, ~30 theme lines), `error-boundary.css:122-129` | 38 (or ~990 if files deleted) |
| Tests: all-theme coverage, high-contrast, toggle edge cases, variant helpers | `src/services/__tests__/theme-service.test.ts:333-570` | ~400 of 834 |

**Live-source total ≈ 750 LOC; ≈ 1,150 with tests.** That's ~45% of `theme-service.ts`, ~90% of `theme-modal.ts`, ~50% of the theme test suite.

### Bonus: already-dead code found during this audit

Vite's entry is `src/index.html` (`vite.config.ts:11` sets `root: 'src'`), so the following never ships (confirmed against `dist/`) and can be deleted independently of the theme decision:

- Root-level `apps/web-app/index.html` (22 KB legacy v1.6 page advertising "10 Theme Variants")
- `apps/web-app/assets/js/shared-components.js` and `assets/css/shared-styles.css` (obsolete theme set: `theme-classic-ff`, `hydaelyn-dark`, `parchment-dark`, `sugar-riot-light/dark`)
- `src/styles/globals.css` (823 LOC) and `src/styles/error-boundary.css` (164 LOC) — **not imported by `main.ts`** (which imports only `themes.css`, `v4-utilities.css`, `v4-layout.css`, `tailwind.css`). Verify nothing else imports them, then delete or re-home the pieces actually wanted.
- The unused `@assets` Vite alias (`vite.config.ts`).

≈ 1,500+ additional LOC.

## 4. Things the Rebuild Should Fix While It's In There

1. **Name the survivors `light` and `dark` outright.** The `-light`/`-dark` suffix convention plus the `cotton-candy`/`sugar-riot` exceptions is why `isDarkMode()` is string-parsing theme names in two places. With two themes, `isDarkMode` collapses to a boolean field on the theme object.
2. **Pick the Dark baseline deliberately.** Current default is `premium-dark` (gold `#D4AF37` on `#121212`), *not* `standard-dark` (coral `#E85A5A` on `#2D2D2D`). The Claude Design output supersedes both, but migration code must map **all 12 legacy stored values** in `xivdyetools_theme` → `light`/`dark` (suggested: `*-light`, `cotton-candy`, `parchment-light`, `hydaelyn-light`, `grayscale-light`, `high-contrast-light` → `light`; everything else → `dark`).
3. **Add `prefers-color-scheme` support.** There is none today. A 3-state control (Light / Dark / System) via `matchMedia('(prefers-color-scheme: dark)')` is standard practice now and costs little once only two themes exist. This also pairs with the mobile-friendly redesign goal.
4. **Fix static meta colors.** `<meta name="theme-color">` is `#4F46E5` (indigo) in `src/index.html:14`, `:57`, and `manifest.json:9` — matches no shipped theme (v1 leftover). v5 should set it per active theme (two `<meta name="theme-color" media="(prefers-color-scheme: …)">` tags, plus runtime update on manual toggle).
5. **Decide the CSS variable strategy.** Today palettes are TS objects written as inline styles at runtime. With only two themes, plain CSS (`:root { … }` + `.dark { … }` or `@media (prefers-color-scheme)`) is simpler, avoids the FOUC-ish inline-style application, works before JS loads, and lets Tailwind's `dark:` variant participate (Tailwind currently knows nothing about the theme system — `tailwind.config.js` has no `darkMode` setting). Recommendation: **move palettes to CSS, keep the same `--theme-*` variable names** so the ~30 components consuming them don't change; `ThemeService` shrinks to a class-toggler + persistence.
6. **Accessibility successors.** `high-contrast-*` themes and their `disableBlur` behavior go away. Their concerns can be honored more cheaply via `@media (prefers-contrast: more)` and `@media (prefers-reduced-transparency)` overrides on the two remaining themes — worth folding into the Claude Design specs. The `(forced-colors: active)` block at `themes.css:397+` should stay.
7. **Tailwind `content` glob bug (unrelated but adjacent):** `tailwind.config.js` scans `./index.html` (the dead legacy file) but **not** `src/index.html`. Fix during v5.
8. **CSP check:** `netlify.toml:23` `connect-src` omits `api.`/`auth.`/`proxy.xivdyetools.app`; production presumably relies on `public/_headers`. Confirm which header source is authoritative during v5.

## 5. Cleanup Checklist

- [ ] Replace `THEME_PALETTES` with 2 palettes (or CSS-first per §4.5), delete variant-helper machinery
- [ ] `ThemeName` → `'light' | 'dark'`; migrate legacy localStorage values (§4.2)
- [ ] Replace theme modal with header toggle (Light/Dark/System)
- [ ] Remove 10 locale `themes.*` keys × 6 files; rename survivors' keys if themes are renamed
- [ ] Trim `themes.css`, `v4-utilities.css`, `v4-layout.css` per-theme blocks; delete orphaned `data-theme` selectors
- [ ] Delete dead files: root `index.html`, `assets/js/`, `assets/css/`, unimported `globals.css` / `error-boundary.css` (after re-homing any wanted rules), `xivdyetools_dark_mode` storage key
- [ ] Rewrite `theme-service.test.ts` theme-coverage suites; fix `e2e/ui-interactions.spec.ts:160`
- [ ] Update docs: `docs/projects/web-app/theming.md` (currently wrong about count *and* storage key — says `xivdyetools.theme`, actual is `xivdyetools_theme`), `apps/web-app/CLAUDE.md` ("Twelve themes"), glossary/user guides; fix stale "11-theme system" comments if any code survives
- [ ] Per-theme `<meta name="theme-color">` + manifest update (§4.4)

## 6. Out of Scope Here

The actual Light/Dark visual designs (colors, typography, spacing) — being produced in Claude Design by the maintainer. This document only defines the variable contract they plug into (§2) and the deletion path.
