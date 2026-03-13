# Web App Component Architecture

XIV Dye Tools web app (v4.3.1) is built with **Lit 3** web components organized into a layered architecture: a shared base class, a glassmorphism layout shell, tool-specific components, reusable UI primitives, and a singleton service layer.

---

## BaseComponent

All tool components extend `BaseComponent`, which standardizes rendering and error handling across the application.

| Method | Purpose |
|--------|---------|
| `safeRender()` | Try/catch wrapper around `renderContent()`. Called by Lit's `render()` lifecycle. |
| `renderContent()` | Abstract method each tool overrides to produce its template. |
| `safeAsync<T>(operation)` | Wraps an async operation with error handling; returns `T` on success. |
| `handleRenderError(error)` | Logs the error, stores it on the component, and triggers a fallback UI. |
| `renderError()` | Renders an error state with a retry button so the user can recover without a page reload. |

Subclasses implement `renderContent()` and never override `render()` directly. Any uncaught exception in rendering is caught by `safeRender()`, routed through `handleRenderError()`, and displayed via `renderError()`.

---

## Layout Shell (v4)

The `v4-layout-shell` component provides the top-level page structure using a glassmorphism design language (frosted glass panels, translucent backgrounds, subtle blur effects).

### Layout Dimensions

| Region | Value |
|--------|-------|
| Header height | 48px |
| Tool bar height | 64px |
| Sidebar width | 320px |
| Content padding | 24px |

### Responsive Behavior

- **Desktop (>= 1024px):** Sidebar is visible alongside the main content area.
- **Mobile (< 1024px):** Sidebar collapses into an off-canvas drawer.

### Color Palette Drawer

The palette drawer is rendered by the layout shell but hidden for tools that do not use a user-selected palette: **extractor**, **swatch**, and **presets**.

---

## Component Categories

### Tool Components

One component per tool. Each extends `BaseComponent` and is loaded on demand via dynamic imports.

| Component | Tag Name | Purpose |
|-----------|----------|---------|
| HarmonyTool | `harmony-tool` | Color harmony generation |
| ExtractorTool | `extractor-tool` | Image color extraction |
| GradientTool | `gradient-tool` | Gradient creation between dyes |
| MixerTool | `mixer-tool` | Dye color blending |
| SwatchTool | `swatch-tool` | Full dye swatch browser |
| BudgetTool | `budget-tool` | Market board price lookups |
| ComparisonTool | `comparison-tool` | Side-by-side dye comparison |
| AccessibilityTool | `accessibility-tool` | Contrast and accessibility checks |
| PresetsTool | `presets-tool` | Community preset management |

### Shared UI Components

Reusable primitives used across multiple tools.

| Component | Purpose |
|-----------|---------|
| `color-display` | Renders a color swatch with optional label |
| `dye-card` | Displays a single dye with name, color, and metadata |
| `dye-search` | Autocomplete search input for the dye database |
| `color-picker` | HSL/RGB color picker with hex input |
| `range-slider` | Numeric range input with label and value display |
| `toggle-switch` | Boolean toggle for settings and options |

### Layout Components

Structural components that compose the application shell.

| Component | Purpose |
|-----------|---------|
| `v4-layout-shell` | Top-level layout with glassmorphism panels |
| `tool-bar` | Horizontal bar for switching between tools |
| `sidebar-panel` | Collapsible sidebar for tool-specific controls |
| `palette-drawer` | Slide-out drawer for the active color palette |

### Modal Components

Overlay dialogs rendered above the layout shell.

| Component | Purpose |
|-----------|---------|
| `welcome-modal` | First-visit onboarding |
| `changelog-modal` | Version release notes |
| `settings-modal` | User preferences (language, theme, etc.) |
| `auth-modal` | Discord OAuth sign-in flow |

---

## Service Layer

Services follow the **singleton pattern** with `getInstance()` for access and `resetInstance()` for test teardown. They are organized into initialization levels to respect inter-service dependencies.

### Level 0 -- No Dependencies

| Service | Responsibility |
|---------|----------------|
| `StorageService` | localStorage abstraction with JSON serialization |
| `LoggerService` | Structured logging with level filtering |
| `AnnouncerService` | ARIA live-region announcements for screen readers |

### Level 1 -- Depends on Level 0

| Service | Responsibility |
|---------|----------------|
| `LanguageService` | Wraps `@xivdyetools/core` LocalizationService; provides `t(key)` and `tInterpolate(key, params)` |
| `ThemeService` | Light/dark theme toggling and persistence |
| `RouterService` | Hash-based routing for tool navigation |

### Level 2 -- Depends on Levels 0-1

| Service | Responsibility |
|---------|----------------|
| `ConfigController` | Reactive per-tool configuration (see below) |
| `MarketBoardService` | Universalis price fetching via the proxy worker |
| `DyeSelectionContext` | Shared state for currently selected dye(s) |

### Level 3 -- Depends on Levels 0-2

| Service | Responsibility |
|---------|----------------|
| `ToastService` | Ephemeral notification popups |
| `ModalService` | Modal lifecycle management |
| `TooltipService` | Hover tooltip positioning and display |
| `TutorialService` | Step-by-step guided tours |
| `AuthService` | Discord OAuth token management |
| `CollectionService` | User dye collection persistence |
| `CameraService` | Image capture from extractor tool |
| `PaletteService` | User palette CRUD and active palette state |
| `HarmonyGenerator` | Color harmony algorithm execution |
| `MixerBlendingEngine` | Dye blending calculations |

---

## ConfigController

`ConfigController` is the central reactive state manager for v4 tool configuration.

### Design

- **Type-safe generics:** Each tool declares its config shape in `ToolConfigMap`. The controller is parameterized by tool ID, so `getConfig('harmony')` returns the harmony-specific type.
- **Lazy-loading:** Config is read from `localStorage` only on first access for a given tool.
- **Subscription pattern:** Components call `subscribe(toolId, callback)` to receive updates when any config value changes. Returns an unsubscribe function.
- **Automatic persistence:** Every config mutation is written back to `localStorage` immediately.

### Usage Pattern

```ts
const config = ConfigController.getInstance();

// Read
const harmonyCfg = config.getConfig('harmony');

// Update (triggers subscribers and persists)
config.updateConfig('harmony', { schemeType: 'triadic' });

// Subscribe
const unsub = config.subscribe('harmony', (newCfg) => {
  this.requestUpdate();
});

// Cleanup
unsub();
```

---

## Code Splitting

The build uses Vite's dynamic import boundaries to produce per-tool chunks, keeping the initial bundle small.

### Chunk Strategy

| Chunk | Contents |
|-------|----------|
| `tool-harmony` | `harmony-tool` and its unique dependencies |
| `tool-extractor` | `extractor-tool` and camera/canvas utilities |
| `tool-gradient` | `gradient-tool` |
| `tool-mixer` | `mixer-tool` and blending engine |
| `tool-swatch` | `swatch-tool` |
| `tool-budget` | `budget-tool` and market board utilities |
| `tool-comparison` | `comparison-tool` |
| `tool-accessibility` | `accessibility-tool` |
| `tool-presets` | `presets-tool` |
| modals | All modal components bundled together |
| `vendor-lit` | Lit framework |
| `vendor-core` | `@xivdyetools/core` |
| `vendor-spectral` | Spectral.js color science library |

Tool chunks are loaded when the user navigates to that tool via `RouterService`.

---

## Localization

`LanguageService` wraps the `LocalizationService` from `@xivdyetools/core` and exposes two primary methods:

| Method | Signature | Purpose |
|--------|-----------|---------|
| `t` | `t(key: string): string` | Looks up a dot-notation key (e.g., `tools.harmony.title`) and returns the localized string. Falls back to English if the key is missing in the active locale. |
| `tInterpolate` | `tInterpolate(key: string, params: Record<string, string>): string` | Same as `t` but replaces `{placeholder}` tokens with the provided values. |

### Supported Languages

`en`, `ja`, `de`, `fr`, `ko`, `zh`

Components access localized strings through `LanguageService.getInstance().t(key)`. When the language changes, the service notifies subscribers and components re-render with updated text.

---

## Related Documentation

- [Tools Reference](tools.md) -- Individual tool features and usage
- [Theming](theming.md) -- Glassmorphism design system, theme tokens, and dark/light modes
- [Web App Overview](overview.md) -- High-level architecture and build configuration
