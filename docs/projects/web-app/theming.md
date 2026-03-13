# Web App Theming System (v4.3.1)

The web app supports 12 themes managed by `ThemeService`, a singleton. Themes are persisted in `localStorage` and applied at runtime via CSS custom properties.

## Available Themes

**Default:** `premium-dark`

There are 12 themes total: `premium-dark` and `premium-light` as base themes, plus 10 additional themed variants. Theme names are defined as constants in the theme module.

## ThemeService API

```typescript
ThemeService.getInstance()           // Singleton accessor
ThemeService.getCurrentTheme()       // Returns current theme ID
ThemeService.setTheme(themeId)       // Apply and persist a theme
ThemeService.getThemeList()          // Returns all 12 available themes
ThemeService.subscribe(listener)     // Subscribe to theme change events
```

## Storage

- **localStorage key:** `xivdyetools.theme`
- Persists across sessions
- Falls back to `premium-dark` if the stored value is invalid or missing

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
- All 12 themes supply compatible color values for glass effects

## Tailwind CSS Integration

- Built with Tailwind CSS ^4.2
- Themes integrate with Tailwind's dark mode system
- Custom Tailwind plugins provide glassmorphism utility classes

## Related Documentation

- [Components](components.md)
- [Tools](tools.md)
- [Overview](overview.md)
