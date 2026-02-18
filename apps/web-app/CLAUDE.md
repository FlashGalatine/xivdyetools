# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XIV Dye Tools is a client-side web application providing six tools for Final Fantasy XIV players:

1. **Color Harmony Explorer** - Generate color palettes using color theory
2. **Color Matcher** - Upload images and find matching FFXIV dyes (with K-means++ palette extraction)
3. **Color Accessibility Checker** - Simulate colorblindness (5 vision types)
4. **Dye Comparison** - Compare up to 4 dyes with visualizations
5. **Dye Mixer** - Find intermediate dyes for color transitions
6. **Preset Browser** - Browse and submit community dye presets

**Stack**: TypeScript + Vite 7 + Tailwind CSS + Vitest
**Core Dependency**: `xivdyetools-core` (npm) - shared color algorithms & dye database

---

## Commands

```bash
npm run dev              # Start dev server (http://localhost:5173)
npm run build            # Type-check + production build
npm run preview          # Preview production build
npm run test             # Run all tests (watch mode)
npm run test:coverage    # Run tests with coverage report
npm run lint             # ESLint check + autofix
npm run type-check       # TypeScript check only
```

### Running Single Tests
```bash
npm test -- src/services/__tests__/color-service.test.ts
npm test -- --grep "hexToRgb"    # Match pattern in test names
npm test -- --run                # Single run (no watch)
```

### Pre-commit Checklist
```bash
npm run lint && npm run test -- --run && npm run build
```

---

## Architecture

### Service Layer Pattern

The app uses a **service layer pattern** where business logic lives in singleton services consumed by UI components:

```
xivdyetools-core (npm package)
    ├── ColorService   - Color math, RGB/HSV/Hex conversion
    ├── DyeService     - 136-dye database, matching, harmony
    └── APIService     - Universalis API integration
            ↓
src/services/ (app-specific wrappers + additional services)
    ├── dye-service-wrapper.ts   - Wraps core DyeService
    ├── api-service-wrapper.ts   - Wraps core APIService
    ├── theme-service.ts         - 12 themes management
    ├── storage-service.ts       - localStorage wrapper
    ├── language-service.ts      - 6-language i18n
    ├── tutorial-service.ts      - First-time user tutorials
    ├── toast-service.ts         - Toast notifications
    ├── announcer-service.ts     - Screen reader announcements
    └── palette-service.ts       - K-means++ palette extraction
            ↓
src/components/ (Lit-style web components)
    ├── base-component.ts        - Base class with lifecycle hooks
    ├── app-layout.ts            - Shell, navigation, theme
    └── [tool]-tool.ts           - 6 tool components (lazy-loaded)
```

### Code Splitting

Tools are lazy-loaded via dynamic imports in [main.ts](src/main.ts). Vite chunks them separately:
- `tool-harmony`, `tool-matcher`, `tool-accessibility`, `tool-comparison`, `tool-mixer`
- `vendor-lit` (Lit framework), `vendor` (other dependencies)
- `modals` (welcome/changelog, loaded once)

### Path Aliases

Use these import aliases (configured in tsconfig.json + vite.config.ts):
```typescript
import { ColorService } from '@services/index';
import { BaseComponent } from '@components/base-component';
import { escapeHtml } from '@shared/utils';
```

---

## Key Patterns

### Creating/Modifying a Component
```typescript
import { BaseComponent } from '@components/base-component';

export class MyTool extends BaseComponent {
  init(): void {
    this.container.innerHTML = this.render();
    this.attachEventListeners();
  }

  render(): string {
    // Use theme CSS variables, never hardcode colors
    return `<div style="color: var(--theme-text)">...</div>`;
  }

  destroy(): void {
    // Cleanup event listeners, intervals, etc.
  }
}
```

### Using StorageService
```typescript
import { StorageService } from '@services/storage-service';

// All keys prefixed with xivdyetools_
StorageService.setItem('mykey', value);       // Saves as xivdyetools_mykey
StorageService.getItem('mykey', defaultVal);  // Returns defaultVal if missing
```

### Adding Theme-Aware Styles
```css
/* Never hardcode - use CSS variables from themes.css */
color: var(--theme-text);
background: var(--theme-card-background);
border-color: var(--theme-border);
accent-color: var(--theme-primary);
```

---

## Important Gotchas

- **Services are singletons** - Changes to DyeService/ColorService affect ALL tools
- **Never hardcode colors** - Use `var(--theme-*)` CSS variables
- **Always use `npm run dev`** - Opening `dist/index.html` directly causes CORS errors
- **xivdyetools-core changes** - Requires npm publish + version bump in this project's package.json
- **Color Matcher zoom** - Mouse wheel zoom requires holding `Shift`
- **Coverage thresholds** - Tests must maintain 80% coverage (lines/functions/branches)

---

## Service Dependencies

When modifying a service, test all tools that use it:

```
DyeServiceWrapper  → Harmony, Matcher, Comparison, Mixer, Presets
ColorService       → All tools
APIServiceWrapper  → Harmony, Matcher, Comparison (price fetching)
ThemeService       → All tools + app-layout
StorageService     → All services + components
LanguageService    → All tools (6 languages: en, ja, de, fr, ko, zh)
```

---

## Custom Vite Plugins

Two custom plugins in project root:
- `vite-plugin-async-css.ts` - Async CSS loading optimization
- `vite-plugin-changelog-parser.ts` - Parses CHANGELOG.md for "What's New" modal

---

## Security Patterns

### XSS Prevention

**Static SVG innerHTML Pattern**: Components use `innerHTML` for SVG icons, but this is **safe** because:
- SVG content comes from static constants in `src/shared/*-icons.ts`
- No user input is ever interpolated into these strings
- Icons are compile-time constants, not fetched externally

**User Content**: Always use `textContent` for user-controlled data:
```typescript
// ✅ SAFE: User content via textContent
element.textContent = userProvidedString;

// ⚠️ ONLY for static icons from *-icons.ts
element.innerHTML = ICON_SAVE;  // from ui-icons.ts
```

### Authentication Token Storage

Tokens are stored in `localStorage` (not httpOnly cookies) with these mitigations:
- Strict CSP prevents inline script execution
- Token expiry validated on every `isAuthenticated()` call
- Server-side token revocation on logout

See `src/services/auth-service.ts` for detailed security rationale.

### Content Security Policy

Production CSP (see `public/_headers`):
- `script-src 'self'` - No inline scripts, no eval
- `style-src 'self' 'unsafe-inline'` - Required for dynamic color swatches
- `form-action 'none'` - Prevents form hijacking
- `frame-ancestors 'none'` - Prevents clickjacking

---

## Documentation

| Document | Purpose |
|----------|---------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data flow |
| [docs/SERVICES.md](docs/SERVICES.md) | Service APIs, error handling |
| [docs/TOOLS.md](docs/TOOLS.md) | Tool algorithms, features |
| [docs/STYLE_GUIDE.md](docs/STYLE_GUIDE.md) | Theme tokens, hover rules |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues & solutions |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
