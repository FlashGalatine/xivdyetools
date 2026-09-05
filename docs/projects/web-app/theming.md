# Web App Theming System (v5.0)

The web app ships **two themes**, managed by `ThemeService` (a static class, not an instance
singleton). Themes are persisted in `localStorage` and applied at runtime via CSS custom
properties.

## Available Themes

```typescript
export type ThemeName = 'standard-light' | 'standard-dark';
export const THEME_NAMES: readonly ThemeName[] = ['standard-light', 'standard-dark'];
export const DEFAULT_THEME: ThemeName = 'standard-dark';
```

**Default:** `standard-dark`.

The novelty themes were retired in 5.0 — the pre-5.0 system had 12. This was a deliberate
decision made at the start of Monorepo 2.0, not an accident of the redesign: two themes that are
properly maintained beat twelve that drift.

### Legacy name migration

A stored theme name from before 5.0 is mapped onto the surviving pair rather than discarded, by
`migrateLegacyThemeName()`: anything ending in `-light`, plus the two specifically-named light
themes `cotton-candy` and `parchment-light`, becomes `standard-light`; everything else becomes
`standard-dark`. A returning user keeps their light/dark preference across the reduction.

## ThemeService API

All members are **static** — there is no `getInstance()`.

```typescript
ThemeService.initialize()                     // Load persisted theme and apply it
ThemeService.getCurrentTheme()                // → ThemeName
ThemeService.getTheme(name)                   // → Theme  (the object: getTheme(getCurrentTheme()))
ThemeService.getAllThemes()                   // → Theme[] (both of them)
ThemeService.setTheme(themeName)              // Apply and persist — silent, records no telemetry
ThemeService.toggledVariant()                 // → the opposite variant's ThemeName, or null
ThemeService.getRequiredColor(key, …)         // Throws rather than returning undefined
ThemeService.isDarkMode()                     // → boolean
ThemeService.subscribe(listener)              // → unsubscribe function
ThemeService.resetToDefault()                 // Back to DEFAULT_THEME
```

`subscribe` returns its own unsubscribe function. Components extending `BaseComponent` should
register it through `this.subs.add(...)` so cleanup happens automatically in `destroy()`.

**Switching the theme goes through `services/theme-switch.ts`, not `ThemeService` directly.**
`switchTheme(to)` and `toggleThemeVariant()` (Light ↔ Dark, Shift+T) are the one path that records
the `theme_change` telemetry event; `ThemeService.setTheme` stays silent so the boot apply, the
legacy-name migration and a settings import never count. `toggledVariant()` is the query;
`toggleThemeVariant()` is the applying path.

## Storage

- **localStorage key:** `xivdyetools_theme` (`STORAGE_PREFIX` + `_theme`)
- Persists across sessions
- An unrecognized stored value is first passed through `migrateLegacyThemeName()`; only a value
  that survives neither validation nor migration falls back to `standard-dark`

## CSS Custom Properties

Themes define layout and color variables on `:root`. Key layout properties:

| Property | Value |
|----------|-------|
| `--v4-header-height` | `54px` (the 5.0 console bar) |
| `--v4-tool-bar-height` | `0px` (no persistent tool rail in 5.0) |
| `--v4-sidebar-width` | `252px` (Simple-Settings column) |
| `--v4-content-padding` | `24px` |
| `--v4-result-card-width` | `280px` |

Color variables cover backgrounds, text, accents, and glass effects. Each theme provides a full set of these.

## Glassmorphism (v4)

The v4 UI uses glassmorphism throughout:

- Frosted glass panels via `backdrop-filter: blur()`
- Semi-transparent backgrounds
- Subtle borders for depth perception
- Both themes supply compatible color values for glass effects

There is no Tailwind plugin behind this. The look is a set of `--v4-glass-*` custom properties
declared in `styles/themes.css` and refreshed by `ThemeService.applyTheme()`, consumed by the
`.glass-panel` rule in `components/v4/base-lit-component.ts`'s shared `baseStyles`.

## Tailwind CSS Integration

- Built with Tailwind CSS ^4.3
- `tailwind.config.js` sets **no** `darkMode` key and **no** `plugins`. Tailwind's own `dark:`
  variants therefore follow `prefers-color-scheme`, which is *not* how the app themes: Light/Dark
  are driven by an `html.theme-*` class plus the `--theme-*` / `--v4-*` custom properties that
  `ThemeService` writes. Do not reach for `dark:` to theme something
- The config's only `extend` is `fontFamily`, and both families defer to the `--font-*` variables
  declared in `styles/globals.css`, which is the single declaration site for the font contract

## Related Documentation

- [Components](components.md)
- [Tools](tools.md)
- [Overview](overview.md)
