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
ThemeService.initialize()                 // Load persisted theme and apply it
ThemeService.getCurrentTheme()            // → ThemeName
ThemeService.getCurrentThemeObject()      // → Theme
ThemeService.getTheme(name)               // → Theme
ThemeService.getAllThemes()               // → Theme[] (both of them)
ThemeService.setTheme(themeName)          // Apply and persist
ThemeService.toggleDarkMode()             // Swap to the opposite variant
ThemeService.getLightVariant(name)        // → ThemeName
ThemeService.getDarkVariant(name)         // → ThemeName
ThemeService.getColor(key)                // → string | boolean | undefined
ThemeService.getRequiredColor(key, …)     // Throws rather than returning undefined
ThemeService.subscribe(listener)          // → unsubscribe function
```

`subscribe` returns its own unsubscribe function. Components extending `BaseComponent` should
register it through `this.subs.add(...)` so cleanup happens automatically in `destroy()`.

## Storage

- **localStorage key:** `xivdyetools_theme` (`STORAGE_PREFIX` + `_theme`)
- Persists across sessions
- An unrecognized stored value is first passed through `migrateLegacyThemeName()`; only a value
  that survives neither validation nor migration falls back to `standard-dark`

## CSS Custom Properties

Themes define layout and color variables on `:root`. Key layout properties:

| Property | Value |
|----------|-------|
| `--v4-header-height` | `48px` |
| `--v4-tool-bar-height` | `64px` |
| `--v4-sidebar-width` | `320px` |
| `--v4-content-padding` | `24px` |
| `--v4-result-card-width` | `280px` |

Color variables cover backgrounds, text, accents, and glass effects. Each theme provides a full set of these.

## Glassmorphism (v4)

The v4 UI uses glassmorphism throughout:

- Frosted glass panels via `backdrop-filter: blur()`
- Semi-transparent backgrounds
- Subtle borders for depth perception
- Both themes supply compatible color values for glass effects

## Tailwind CSS Integration

- Built with Tailwind CSS ^4.2
- Themes integrate with Tailwind's dark mode system
- Custom Tailwind plugins provide glassmorphism utility classes

## Related Documentation

- [Components](components.md)
- [Tools](tools.md)
- [Overview](overview.md)
