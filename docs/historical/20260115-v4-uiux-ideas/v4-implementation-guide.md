# XIV Dye Tools v4.0 Implementation Guide

This guide provides step-by-step implementation instructions with code snippets following the existing codebase patterns.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Phase 1: CSS Variables & Theme Updates](#2-phase-1-css-variables--theme-updates)
3. [Phase 2: Router Service Updates](#3-phase-2-router-service-updates)
4. [Phase 3: Layout Components](#4-phase-3-layout-components)
5. [Phase 4: Shared Components](#5-phase-4-shared-components)
6. [Phase 5: Tool Migration](#6-phase-5-tool-migration)
7. [Phase 6: New Dye Mixer Tool](#7-phase-6-new-dye-mixer-tool)
8. [Phase 7: Entry Point Updates](#8-phase-7-entry-point-updates)
9. [Verification Steps](#9-verification-steps)

---

## 1. Prerequisites

### Environment Setup

```bash
# Ensure you're in the web app directory
cd xivdyetools-web-app

# Install dependencies
npm install

# Run development server
npm run dev

# Run tests to establish baseline
npm run test
```

### Key Files to Understand

| File | Purpose |
|------|---------|
| `src/components/base-component.ts` | Abstract base class for all components |
| `src/services/theme-service.ts` | Theme management with 11 themes |
| `src/services/router-service.ts` | History API routing |
| `src/styles/themes.css` | CSS variable definitions |
| `src/shared/types.ts` | TypeScript type definitions |

---

## 2. Phase 1: CSS Variables & Theme Updates

### Step 1.1: Add v4 CSS Variables to themes.css

Add the following to `:root` in `src/styles/themes.css`:

```css
:root {
  /* Existing v3 variables... */

  /* ===== V4 LAYOUT DIMENSIONS ===== */
  --v4-header-height: 48px;
  --v4-tool-bar-height: 64px;
  --v4-sidebar-width: 320px;
  --v4-content-padding: 24px;

  /* ===== V4 GLASSMORPHISM ===== */
  --v4-glass-bg: rgba(30, 30, 30, 0.7);
  --v4-glass-blur: blur(12px);
  --v4-glass-border: rgba(255, 255, 255, 0.1);

  /* ===== V4 SHADOWS ===== */
  --v4-shadow-soft: 0 4px 24px rgba(0, 0, 0, 0.1);
  --v4-shadow-glow: 0 0 20px rgba(var(--v4-accent-rgb), 0.3);

  /* ===== V4 GRADIENTS ===== */
  --v4-gradient-start: #252525;
  --v4-gradient-end: #121212;
  --v4-card-gradient-end: #151515;

  /* ===== V4 RESULT CARD ===== */
  --v4-result-card-width: 320px;
}
```

### Step 1.2: Update ThemePalette Interface

In `src/shared/types.ts`, extend the interface:

```typescript
/**
 * Color palette for a theme
 * V4: Extended with glassmorphism and gradient properties
 */
export interface ThemePalette {
  // Existing v3 properties
  primary: string;
  background: string;
  text: string;
  textHeader: string;
  border: string;
  backgroundSecondary: string;
  cardBackground: string;
  cardHover: string;
  textMuted: string;

  // V4 additions (optional for backwards compatibility)
  bgGlass?: string;           // e.g., "rgba(245, 245, 245, 0.9)"
  textHeaderMuted?: string;   // e.g., "rgba(255, 255, 255, 0.7)"
  accentHover?: string;       // Hover state color
  accentRgb?: string;         // "139, 26, 26" for rgba() usage
  shadowSoft?: string;        // Full shadow value
  shadowGlow?: string;        // Glow effect
  gradientStart?: string;     // Gradient start color
  gradientEnd?: string;       // Gradient end color
  cardGradientEnd?: string;   // Card-specific gradient
  disableBlur?: boolean;      // For high contrast themes
}
```

### Step 1.3: Update Theme Definitions

In `src/services/theme-service.ts`, update each theme palette:

```typescript
const THEME_PALETTES: Record<ThemeName, ThemePalette> = {
  'standard-light': createThemePalette({
    primary: '#8B1A1A',
    background: '#D3D3D3',
    text: '#1A1A1A',
    isDark: false,
    overrides: {
      border: '#6B1515',
      backgroundSecondary: '#E0E0E0',
      cardBackground: '#F5F5F5',
      cardHover: '#FFFFFF',
      textMuted: '#4A4A4A',
      // V4 additions
      bgGlass: 'rgba(245, 245, 245, 0.9)',
      textHeaderMuted: 'rgba(255, 255, 255, 0.7)',
      accentHover: '#6B1515',
      accentRgb: '139, 26, 26',
      shadowSoft: '0 4px 6px rgba(0, 0, 0, 0.1)',
      shadowGlow: '0 0 10px rgba(139, 26, 26, 0.2)',
      gradientStart: '#E8E8E8',
      gradientEnd: '#D3D3D3',
      cardGradientEnd: '#E0E0E0',
    },
  }),
  // ... repeat for all 11 themes
};
```

### Step 1.4: Update applyTheme Method

```typescript
private static applyTheme(themeName: ThemeName): void {
  const theme = this.getTheme(themeName);
  const root = document.documentElement;
  const palette = theme.palette;
  const style = root.style;

  // Existing v3 variables
  style.setProperty('--theme-primary', palette.primary);
  style.setProperty('--theme-background', palette.background);
  style.setProperty('--theme-text', palette.text);
  style.setProperty('--theme-text-header', palette.textHeader);
  style.setProperty('--theme-border', palette.border);
  style.setProperty('--theme-background-secondary', palette.backgroundSecondary);
  style.setProperty('--theme-card-background', palette.cardBackground);
  style.setProperty('--theme-card-hover', palette.cardHover);
  style.setProperty('--theme-text-muted', palette.textMuted);

  // V4 variables
  if (palette.bgGlass) {
    style.setProperty('--v4-glass-bg', palette.bgGlass);
  }
  if (palette.accentRgb) {
    style.setProperty('--v4-accent-rgb', palette.accentRgb);
  }
  if (palette.shadowSoft) {
    style.setProperty('--v4-shadow-soft', palette.shadowSoft);
  }
  if (palette.shadowGlow) {
    style.setProperty('--v4-shadow-glow', palette.shadowGlow);
  }
  if (palette.gradientStart) {
    style.setProperty('--v4-gradient-start', palette.gradientStart);
  }
  if (palette.gradientEnd) {
    style.setProperty('--v4-gradient-end', palette.gradientEnd);
  }
  if (palette.cardGradientEnd) {
    style.setProperty('--v4-card-gradient-end', palette.cardGradientEnd);
  }

  // Disable blur for high contrast themes
  if (palette.disableBlur) {
    style.setProperty('--v4-glass-blur', 'none');
  } else {
    style.setProperty('--v4-glass-blur', 'blur(12px)');
  }
}
```

---

## 3. Phase 2: Router Service Updates

### Step 2.1: Update ToolId Type

In `src/services/router-service.ts`:

```typescript
/**
 * Available tool identifiers
 * V4: Updated with renamed and new tools
 */
export type ToolId =
  | 'harmony'        // Harmony Explorer (unchanged)
  | 'extractor'      // Palette Extractor (was 'matcher')
  | 'accessibility'  // Accessibility Checker (unchanged)
  | 'comparison'     // Dye Comparison (unchanged)
  | 'gradient'       // Gradient Builder (was 'mixer')
  | 'mixer'          // Dye Mixer (NEW)
  | 'presets'        // Community Presets (unchanged)
  | 'budget'         // Budget Suggestions (unchanged)
  | 'swatch';        // Swatch Matcher (was 'character')
```

### Step 2.2: Update ROUTES Array

```typescript
/**
 * Route definitions for all tools
 * V4: Updated paths and titles
 */
export const ROUTES: RouteDefinition[] = [
  {
    id: 'harmony',
    path: '/harmony',
    title: 'Harmony Explorer',
    description: 'Explore color harmonies and find complementary dyes',
  },
  {
    id: 'extractor',
    path: '/extractor',
    title: 'Palette Extractor',
    description: 'Extract color palettes from images and find matching dyes',
  },
  {
    id: 'accessibility',
    path: '/accessibility',
    title: 'Accessibility Checker',
    description: 'Simulate colorblindness and check WCAG contrast',
  },
  {
    id: 'comparison',
    path: '/comparison',
    title: 'Dye Comparison',
    description: 'Compare multiple dyes side by side',
  },
  {
    id: 'gradient',
    path: '/gradient',
    title: 'Gradient Builder',
    description: 'Create smooth color transitions between dyes',
  },
  {
    id: 'mixer',
    path: '/mixer',
    title: 'Dye Mixer',
    description: 'Mix two dyes to find blended color matches',
  },
  {
    id: 'presets',
    path: '/presets',
    title: 'Community Presets',
    description: 'Browse and share community dye palettes',
  },
  {
    id: 'budget',
    path: '/budget',
    title: 'Budget Suggestions',
    description: 'Find affordable alternatives to expensive dyes',
  },
  {
    id: 'swatch',
    path: '/swatch',
    title: 'Swatch Matcher',
    description: 'Match dyes to character customization colors',
  },
];
```

### Step 2.3: Update Default Tool

```typescript
/**
 * Default tool when no route is specified
 */
export const DEFAULT_TOOL_ID: ToolId = 'harmony';
```

---

## 4. Phase 3: Layout Components

### Step 3.1: Create V4AppHeader Component

Create `src/components/v4-app-header.ts`:

```typescript
/**
 * XIV Dye Tools v4.0 - App Header Component
 *
 * 48px header with logo, title, and navigation controls
 *
 * @module components/v4-app-header
 */

import { BaseComponent } from './base-component';
import { ThemeService } from '@services/theme-service';
import { LanguageService } from '@services/language-service';
import { ICON_LOGO, ICON_THEME, ICON_LANGUAGE, ICON_SETTINGS } from '@shared/ui-icons';

export interface V4AppHeaderOptions {
  onThemeClick?: () => void;
  onLanguageClick?: () => void;
  onSettingsClick?: () => void;
}

export class V4AppHeader extends BaseComponent {
  private options: V4AppHeaderOptions;

  constructor(container: HTMLElement, options: V4AppHeaderOptions = {}) {
    super(container);
    this.options = options;
  }

  renderContent(): void {
    this.element = this.createElement('header', {
      className: 'v4-app-header',
      attributes: {
        role: 'banner',
      },
    });

    // Logo section
    const logoSection = this.createElement('div', {
      className: 'v4-header-logo',
    });

    const logoIcon = this.createElement('span', {
      className: 'v4-header-logo-icon',
      innerHTML: ICON_LOGO,
      attributes: { 'aria-hidden': 'true' },
    });
    logoSection.appendChild(logoIcon);

    const logoText = this.createElement('span', {
      className: 'v4-header-logo-text',
      textContent: 'XIV Dye Tools',
    });
    logoSection.appendChild(logoText);

    this.element.appendChild(logoSection);

    // Navigation controls
    const navControls = this.createElement('nav', {
      className: 'v4-header-nav',
      attributes: {
        'aria-label': 'Header navigation',
      },
    });

    // Theme button
    const themeBtn = this.createNavButton('theme', ICON_THEME, 'Change theme');
    navControls.appendChild(themeBtn);

    // Language button
    const langBtn = this.createNavButton('language', ICON_LANGUAGE, 'Change language');
    navControls.appendChild(langBtn);

    // Settings button
    const settingsBtn = this.createNavButton('settings', ICON_SETTINGS, 'Settings');
    navControls.appendChild(settingsBtn);

    this.element.appendChild(navControls);

    // Clear and append
    this.container.innerHTML = '';
    this.container.appendChild(this.element);
  }

  private createNavButton(action: string, icon: string, label: string): HTMLButtonElement {
    const btn = this.createElement('button', {
      className: 'v4-header-nav-btn',
      innerHTML: icon,
      attributes: {
        type: 'button',
        'aria-label': label,
        title: label,
      },
      dataAttributes: { action },
    });
    return btn;
  }

  bindEvents(): void {
    // Theme button
    const themeBtn = this.querySelector<HTMLButtonElement>('[data-action="theme"]');
    if (themeBtn) {
      this.on(themeBtn, 'click', () => {
        this.options.onThemeClick?.();
      });
    }

    // Language button
    const langBtn = this.querySelector<HTMLButtonElement>('[data-action="language"]');
    if (langBtn) {
      this.on(langBtn, 'click', () => {
        this.options.onLanguageClick?.();
      });
    }

    // Settings button
    const settingsBtn = this.querySelector<HTMLButtonElement>('[data-action="settings"]');
    if (settingsBtn) {
      this.on(settingsBtn, 'click', () => {
        this.options.onSettingsClick?.();
      });
    }
  }
}
```

### Step 3.2: Create ToolBanner Component

Create `src/components/tool-banner.ts`:

```typescript
/**
 * XIV Dye Tools v4.0 - Tool Banner Component
 *
 * 64px horizontal navigation bar with 9 tool buttons
 *
 * @module components/tool-banner
 */

import { BaseComponent } from './base-component';
import { ToolId, ROUTES } from '@services/router-service';
import {
  ICON_TOOL_HARMONY,
  ICON_TOOL_EXTRACTOR,
  ICON_TOOL_ACCESSIBILITY,
  ICON_TOOL_COMPARISON,
  ICON_TOOL_GRADIENT,
  ICON_TOOL_DYE_MIXER,
  ICON_TOOL_PRESETS,
  ICON_TOOL_BUDGET,
  ICON_TOOL_SWATCH,
} from '@shared/tool-icons';

const TOOL_ICONS: Record<ToolId, string> = {
  harmony: ICON_TOOL_HARMONY,
  extractor: ICON_TOOL_EXTRACTOR,
  accessibility: ICON_TOOL_ACCESSIBILITY,
  comparison: ICON_TOOL_COMPARISON,
  gradient: ICON_TOOL_GRADIENT,
  mixer: ICON_TOOL_DYE_MIXER,
  presets: ICON_TOOL_PRESETS,
  budget: ICON_TOOL_BUDGET,
  swatch: ICON_TOOL_SWATCH,
};

const TOOL_LABELS: Record<ToolId, string> = {
  harmony: 'Harmony',
  extractor: 'Extractor',
  accessibility: 'Accessibility',
  comparison: 'Compare',
  gradient: 'Gradient',
  mixer: 'Mixer',
  presets: 'Presets',
  budget: 'Budget',
  swatch: 'Swatch',
};

export interface ToolBannerOptions {
  activeTool: ToolId;
  onToolSelect?: (toolId: ToolId) => void;
}

export class ToolBanner extends BaseComponent {
  private options: ToolBannerOptions;

  constructor(container: HTMLElement, options: ToolBannerOptions) {
    super(container);
    this.options = options;
  }

  renderContent(): void {
    this.element = this.createElement('nav', {
      className: 'v4-tool-banner',
      attributes: {
        role: 'navigation',
        'aria-label': 'Tool selection',
      },
    });

    // Create tool buttons
    const toolOrder: ToolId[] = [
      'harmony', 'extractor', 'accessibility', 'comparison',
      'gradient', 'mixer', 'presets', 'budget', 'swatch'
    ];

    for (const toolId of toolOrder) {
      const route = ROUTES.find(r => r.id === toolId);
      if (!route) continue;

      const isActive = toolId === this.options.activeTool;

      const btn = this.createElement('button', {
        className: `v4-tool-btn ${isActive ? 'active' : ''}`,
        attributes: {
          type: 'button',
          'aria-label': route.title,
          'aria-current': isActive ? 'page' : 'false',
          title: route.description,
        },
        dataAttributes: { tool: toolId },
      });

      // Icon
      const icon = this.createElement('span', {
        className: 'v4-tool-icon',
        innerHTML: TOOL_ICONS[toolId],
        attributes: { 'aria-hidden': 'true' },
      });
      btn.appendChild(icon);

      // Label
      const label = this.createElement('span', {
        className: 'v4-tool-label',
        textContent: TOOL_LABELS[toolId],
      });
      btn.appendChild(label);

      this.element.appendChild(btn);
    }

    this.container.innerHTML = '';
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    // Tool button clicks
    const buttons = this.querySelectorAll<HTMLButtonElement>('.v4-tool-btn');
    for (const btn of buttons) {
      this.on(btn, 'click', () => {
        const toolId = btn.dataset.tool as ToolId;
        this.options.onToolSelect?.(toolId);
      });
    }

    // Keyboard navigation
    this.on(this.element!, 'keydown', (e: KeyboardEvent) => {
      this.handleKeyboardNavigation(e);
    });
  }

  private handleKeyboardNavigation(e: KeyboardEvent): void {
    const buttons = this.querySelectorAll<HTMLButtonElement>('.v4-tool-btn');
    const currentIndex = buttons.findIndex(btn => btn === document.activeElement);

    if (currentIndex === -1) return;

    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
        newIndex = (currentIndex + 1) % buttons.length;
        e.preventDefault();
        break;
      case 'ArrowLeft':
        newIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        e.preventDefault();
        break;
      case 'Home':
        newIndex = 0;
        e.preventDefault();
        break;
      case 'End':
        newIndex = buttons.length - 1;
        e.preventDefault();
        break;
    }

    if (newIndex !== currentIndex) {
      buttons[newIndex].focus();
    }
  }

  /**
   * Update the active tool
   */
  setActiveTool(toolId: ToolId): void {
    this.options.activeTool = toolId;

    // Update active states
    const buttons = this.querySelectorAll<HTMLButtonElement>('.v4-tool-btn');
    for (const btn of buttons) {
      const isActive = btn.dataset.tool === toolId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    }
  }
}
```

### Step 3.3: Create V4LayoutShell Component

Create `src/components/v4-layout-shell.ts`:

```typescript
/**
 * XIV Dye Tools v4.0 - Layout Shell Component
 *
 * Main layout container orchestrating header, tool banner,
 * config sidebar, and content area
 *
 * @module components/v4-layout-shell
 */

import { BaseComponent } from './base-component';
import { V4AppHeader } from './v4-app-header';
import { ToolBanner } from './tool-banner';
import { ConfigSidebar } from './config-sidebar';
import { ToolId, RouterService } from '@services/router-service';
import { ThemeService } from '@services/theme-service';
import { clearContainer } from '@shared/utils';

export interface V4LayoutShellOptions {
  initialTool?: ToolId;
  onToolChange?: (toolId: ToolId) => void;
}

export class V4LayoutShell extends BaseComponent {
  private options: V4LayoutShellOptions;

  // Child components
  private header: V4AppHeader | null = null;
  private toolBanner: ToolBanner | null = null;
  private sidebar: ConfigSidebar | null = null;

  // Element references
  private headerContainer: HTMLElement | null = null;
  private bannerContainer: HTMLElement | null = null;
  private sidebarContainer: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;

  constructor(container: HTMLElement, options: V4LayoutShellOptions = {}) {
    super(container);
    this.options = {
      initialTool: options.initialTool ?? 'harmony',
      onToolChange: options.onToolChange,
    };
  }

  renderContent(): void {
    clearContainer(this.container);

    this.element = this.createElement('div', {
      className: 'v4-layout-shell',
    });

    // Header container (48px)
    this.headerContainer = this.createElement('div', {
      className: 'v4-layout-header',
    });
    this.element.appendChild(this.headerContainer);

    // Tool banner container (64px)
    this.bannerContainer = this.createElement('div', {
      className: 'v4-layout-banner',
    });
    this.element.appendChild(this.bannerContainer);

    // Main area (sidebar + content)
    const mainArea = this.createElement('div', {
      className: 'v4-layout-main',
    });

    // Config sidebar (320px)
    this.sidebarContainer = this.createElement('aside', {
      className: 'v4-layout-sidebar',
      attributes: {
        role: 'complementary',
        'aria-label': 'Tool configuration',
      },
    });
    mainArea.appendChild(this.sidebarContainer);

    // Content area (flexible)
    this.contentContainer = this.createElement('main', {
      className: 'v4-layout-content',
      attributes: {
        role: 'main',
        id: 'main-content',
      },
    });
    mainArea.appendChild(this.contentContainer);

    this.element.appendChild(mainArea);
    this.container.appendChild(this.element);

    // Initialize child components
    this.initializeChildComponents();
  }

  private initializeChildComponents(): void {
    // Header
    if (this.headerContainer) {
      this.header = new V4AppHeader(this.headerContainer, {
        onThemeClick: () => this.handleThemeClick(),
        onLanguageClick: () => this.handleLanguageClick(),
        onSettingsClick: () => this.handleSettingsClick(),
      });
      this.header.init();
    }

    // Tool Banner
    if (this.bannerContainer) {
      this.toolBanner = new ToolBanner(this.bannerContainer, {
        activeTool: this.options.initialTool!,
        onToolSelect: (toolId) => this.handleToolSelect(toolId),
      });
      this.toolBanner.init();
    }

    // Config Sidebar
    if (this.sidebarContainer) {
      this.sidebar = new ConfigSidebar(this.sidebarContainer, {
        activeTool: this.options.initialTool!,
      });
      this.sidebar.init();
    }
  }

  bindEvents(): void {
    // Subscribe to router changes
    RouterService.subscribe((state) => {
      this.setActiveTool(state.toolId);
    });

    // Handle mobile drawer toggle
    this.on(window, 'resize', () => {
      this.handleResize();
    });
  }

  private handleToolSelect(toolId: ToolId): void {
    RouterService.navigateTo(`/${toolId}`);
    this.options.onToolChange?.(toolId);
  }

  private handleThemeClick(): void {
    // Cycle through themes or open theme picker
    ThemeService.toggleDarkMode();
  }

  private handleLanguageClick(): void {
    // Open language picker modal
    this.emit('language-picker-open');
  }

  private handleSettingsClick(): void {
    // Open settings modal
    this.emit('settings-modal-open');
  }

  private handleResize(): void {
    const isMobile = window.innerWidth < 768;
    this.element?.classList.toggle('v4-layout-mobile', isMobile);
  }

  /**
   * Set the active tool
   */
  setActiveTool(toolId: ToolId): void {
    this.toolBanner?.setActiveTool(toolId);
    this.sidebar?.setActiveTool(toolId);
  }

  /**
   * Get the content container for rendering tool content
   */
  getContentContainer(): HTMLElement | null {
    return this.contentContainer;
  }

  /**
   * Get the sidebar container for rendering tool config
   */
  getSidebarContainer(): HTMLElement | null {
    return this.sidebarContainer;
  }

  destroy(): void {
    this.header?.destroy();
    this.toolBanner?.destroy();
    this.sidebar?.destroy();
    super.destroy();
  }
}
```

### Step 3.4: Add CSS for Layout Components

Add to `src/styles/globals.css` or create `src/styles/v4-layout.css`:

```css
/* ===== V4 Layout Shell ===== */
.v4-layout-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, var(--v4-gradient-start), var(--v4-gradient-end));
}

.v4-layout-header {
  flex-shrink: 0;
  height: var(--v4-header-height);
}

.v4-layout-banner {
  flex-shrink: 0;
  height: var(--v4-tool-bar-height);
}

.v4-layout-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.v4-layout-sidebar {
  width: var(--v4-sidebar-width);
  flex-shrink: 0;
  overflow-y: auto;
  background: var(--theme-card-background);
  border-right: 1px solid var(--theme-border);
}

.v4-layout-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--v4-content-padding);
}

/* ===== V4 App Header ===== */
.v4-app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 100%;
  background: var(--theme-primary);
  color: var(--theme-text-header);
  box-shadow: var(--v4-shadow-soft);
}

.v4-header-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.v4-header-logo-icon {
  width: 28px;
  height: 28px;
}

.v4-header-logo-icon svg {
  width: 100%;
  height: 100%;
  fill: currentColor;
}

.v4-header-nav {
  display: flex;
  gap: 8px;
}

.v4-header-nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.8;
  transition: opacity 0.2s, background-color 0.2s;
}

.v4-header-nav-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

.v4-header-nav-btn svg {
  width: 20px;
  height: 20px;
  fill: currentColor;
}

/* ===== V4 Tool Banner ===== */
.v4-tool-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 100%;
  padding: 0 16px;
  background: linear-gradient(to bottom, var(--v4-gradient-start), var(--v4-gradient-end));
  border-bottom: 1px solid var(--theme-border);
  overflow-x: auto;
}

.v4-tool-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 16px;
  min-width: 72px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--theme-text-muted);
  cursor: pointer;
  position: relative;
  transition: color 0.2s, background-color 0.2s;
}

.v4-tool-btn:hover {
  color: var(--theme-text);
  background: rgba(255, 255, 255, 0.05);
}

.v4-tool-btn.active {
  color: var(--theme-primary);
}

.v4-tool-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 3px;
  background: var(--theme-primary);
  border-radius: 2px 2px 0 0;
}

.v4-tool-icon {
  width: 24px;
  height: 24px;
}

.v4-tool-icon svg {
  width: 100%;
  height: 100%;
}

.v4-tool-label {
  font-size: 11px;
  font-weight: 500;
}

/* ===== V4 Glass Panel ===== */
.v4-glass {
  background: var(--v4-glass-bg);
  backdrop-filter: var(--v4-glass-blur);
  -webkit-backdrop-filter: var(--v4-glass-blur);
  border: 1px solid var(--v4-glass-border);
  border-radius: 12px;
}

/* ===== Responsive ===== */
@media (max-width: 768px) {
  .v4-layout-sidebar {
    position: fixed;
    top: calc(var(--v4-header-height) + var(--v4-tool-bar-height));
    left: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.3s ease-out;
  }

  .v4-layout-sidebar.open {
    transform: translateX(0);
  }

  .v4-tool-banner {
    justify-content: flex-start;
  }
}
```

---

## 5. Phase 4: Shared Components

### Step 4.1: Create ResultCard Component

Create `src/components/result-card.ts`:

```typescript
/**
 * XIV Dye Tools v4.0 - Unified Result Card Component
 *
 * 320px fixed-width card for displaying dye match results
 * Used across Harmony, Gradient, Budget, Swatch, and Extractor tools
 *
 * @module components/result-card
 */

import { BaseComponent } from './base-component';
import type { Dye, DyeWithDistance } from '@xivdyetools/types';
import { ICON_CONTEXT_MENU } from '@shared/ui-icons';

export interface ResultCardData {
  dye: Dye | DyeWithDistance;
  originalColor: string;     // HEX color of input/original
  matchedColor: string;      // HEX color of dye
  deltaE?: number;           // Color difference (optional)
  marketServer?: string;
  price?: number;
}

export interface ResultCardOptions {
  data: ResultCardData;
  showActions?: boolean;
  primaryActionLabel?: string;
  onSelect?: (dye: Dye) => void;
  onContextAction?: (action: string, dye: Dye) => void;
}

export class ResultCard extends BaseComponent {
  private options: ResultCardOptions;
  private contextMenuOpen: boolean = false;

  constructor(container: HTMLElement, options: ResultCardOptions) {
    super(container);
    this.options = {
      showActions: true,
      primaryActionLabel: 'Select Dye',
      ...options,
    };
  }

  renderContent(): void {
    const { data } = this.options;
    const dye = data.dye;

    this.element = this.createElement('article', {
      className: 'v4-result-card',
      attributes: {
        role: 'article',
        'aria-label': `Dye result: ${dye.name}`,
      },
    });

    // Header
    const header = this.createElement('header', {
      className: 'v4-result-card-header',
    });

    const dyeName = this.createElement('h3', {
      className: 'v4-result-card-name',
      textContent: dye.name,
    });
    header.appendChild(dyeName);

    // Context menu button
    const menuBtn = this.createElement('button', {
      className: 'v4-result-card-menu-btn',
      innerHTML: ICON_CONTEXT_MENU,
      attributes: {
        type: 'button',
        'aria-label': 'More actions',
        'aria-haspopup': 'true',
        'aria-expanded': 'false',
      },
    });
    header.appendChild(menuBtn);

    this.element.appendChild(header);

    // Color preview
    const preview = this.createElement('div', {
      className: 'v4-result-card-preview',
    });

    const originalHalf = this.createElement('div', {
      className: 'v4-result-card-preview-half',
      attributes: { style: `background-color: ${data.originalColor}` },
    });
    const originalLabel = this.createElement('span', {
      className: 'v4-result-card-preview-label',
      textContent: 'Original',
    });
    originalHalf.appendChild(originalLabel);
    preview.appendChild(originalHalf);

    const matchHalf = this.createElement('div', {
      className: 'v4-result-card-preview-half',
      attributes: { style: `background-color: ${data.matchedColor}` },
    });
    const matchLabel = this.createElement('span', {
      className: 'v4-result-card-preview-label',
      textContent: 'Match',
    });
    matchHalf.appendChild(matchLabel);
    preview.appendChild(matchHalf);

    this.element.appendChild(preview);

    // Details grid
    const details = this.createElement('div', {
      className: 'v4-result-card-details',
    });

    // Technical column
    const techCol = this.createDetailColumn('Technical', [
      { label: 'ΔE', value: data.deltaE?.toFixed(2) ?? '—', colorCode: this.getDeltaEColor(data.deltaE) },
      { label: 'HEX', value: data.matchedColor.toUpperCase() },
      { label: 'RGB', value: `${dye.rgb.r}, ${dye.rgb.g}, ${dye.rgb.b}` },
    ]);
    details.appendChild(techCol);

    // Acquisition column
    const acqCol = this.createDetailColumn('Acquisition', [
      { label: 'Source', value: dye.source ?? 'Unknown' },
      { label: 'Market', value: data.marketServer ?? 'N/A' },
      { label: 'Price', value: data.price ? `${data.price.toLocaleString()} G` : '—', isLarge: true },
    ]);
    details.appendChild(acqCol);

    this.element.appendChild(details);

    // Context menu dropdown (hidden initially)
    const contextMenu = this.createContextMenu();
    this.element.appendChild(contextMenu);

    // Append to container
    this.container.appendChild(this.element);
  }

  private createDetailColumn(header: string, rows: Array<{ label: string; value: string; colorCode?: string; isLarge?: boolean }>): HTMLElement {
    const col = this.createElement('div', {
      className: 'v4-result-card-col',
    });

    const colHeader = this.createElement('div', {
      className: 'v4-result-card-col-header',
      textContent: header,
    });
    col.appendChild(colHeader);

    for (const row of rows) {
      const rowEl = this.createElement('div', {
        className: `v4-result-card-row ${row.isLarge ? 'v4-result-card-row-large' : ''}`,
      });

      const label = this.createElement('span', {
        className: 'v4-result-card-label',
        textContent: row.label,
      });
      rowEl.appendChild(label);

      const value = this.createElement('span', {
        className: 'v4-result-card-value',
        textContent: row.value,
      });
      if (row.colorCode) {
        value.style.color = row.colorCode;
      }
      rowEl.appendChild(value);

      col.appendChild(rowEl);
    }

    return col;
  }

  private createContextMenu(): HTMLElement {
    const menu = this.createElement('div', {
      className: 'v4-context-menu',
      attributes: {
        role: 'menu',
        'aria-hidden': 'true',
      },
    });

    const actions = [
      { id: 'add-comparison', label: 'Add to Comparison' },
      { id: 'add-mixer', label: 'Add to Mixer' },
      { id: 'add-accessibility', label: 'Add to Accessibility Check' },
      { id: 'see-harmonies', label: 'See Color Harmonies' },
      { id: 'budget', label: 'Budget Suggestions' },
      { id: 'copy-hex', label: 'Copy Hex Code' },
    ];

    for (const action of actions) {
      const item = this.createElement('button', {
        className: 'v4-context-menu-item',
        textContent: action.label,
        attributes: {
          type: 'button',
          role: 'menuitem',
        },
        dataAttributes: { action: action.id },
      });
      menu.appendChild(item);
    }

    return menu;
  }

  private getDeltaEColor(deltaE?: number): string {
    if (deltaE === undefined) return 'inherit';
    if (deltaE <= 1) return '#4caf50';      // Excellent
    if (deltaE <= 3) return '#8bc34a';      // Good
    if (deltaE <= 5) return '#ffc107';      // Acceptable
    if (deltaE <= 10) return '#ff9800';     // Noticeable
    return '#f44336';                        // Poor
  }

  bindEvents(): void {
    // Menu button
    const menuBtn = this.querySelector<HTMLButtonElement>('.v4-result-card-menu-btn');
    if (menuBtn) {
      this.on(menuBtn, 'click', (e: Event) => {
        e.stopPropagation();
        this.toggleContextMenu();
      });
    }

    // Context menu items
    const menuItems = this.querySelectorAll<HTMLButtonElement>('.v4-context-menu-item');
    for (const item of menuItems) {
      this.on(item, 'click', () => {
        const action = item.dataset.action;
        if (action) {
          this.options.onContextAction?.(action, this.options.data.dye as Dye);
        }
        this.closeContextMenu();
      });
    }

    // Close menu on outside click
    this.on(document, 'click', () => {
      this.closeContextMenu();
    });

    // Close menu on Escape
    this.on(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeContextMenu();
      }
    });

    // Card click for selection
    this.on(this.element!, 'click', () => {
      this.options.onSelect?.(this.options.data.dye as Dye);
    });
  }

  private toggleContextMenu(): void {
    this.contextMenuOpen = !this.contextMenuOpen;
    const menu = this.querySelector('.v4-context-menu');
    const btn = this.querySelector('.v4-result-card-menu-btn');

    if (menu) {
      menu.classList.toggle('open', this.contextMenuOpen);
      menu.setAttribute('aria-hidden', (!this.contextMenuOpen).toString());
    }
    if (btn) {
      btn.setAttribute('aria-expanded', this.contextMenuOpen.toString());
    }
  }

  private closeContextMenu(): void {
    if (!this.contextMenuOpen) return;
    this.contextMenuOpen = false;

    const menu = this.querySelector('.v4-context-menu');
    const btn = this.querySelector('.v4-result-card-menu-btn');

    if (menu) {
      menu.classList.remove('open');
      menu.setAttribute('aria-hidden', 'true');
    }
    if (btn) {
      btn.setAttribute('aria-expanded', 'false');
    }
  }
}
```

### Step 4.2: Add CSS for ResultCard

```css
/* ===== V4 Result Card ===== */
.v4-result-card {
  width: var(--v4-result-card-width);
  background: linear-gradient(to bottom, var(--theme-card-background), var(--v4-card-gradient-end));
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.v4-result-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--v4-shadow-soft);
}

.v4-result-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--theme-primary);
  color: var(--theme-text-header);
}

.v4-result-card-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.v4-result-card-menu-btn {
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.v4-result-card-menu-btn:hover {
  opacity: 1;
}

.v4-result-card-menu-btn svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}

.v4-result-card-preview {
  display: flex;
  height: 60px;
}

.v4-result-card-preview-half {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 8px;
}

.v4-result-card-preview-label {
  font-size: 10px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
}

.v4-result-card-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  padding: 16px;
}

.v4-result-card-col-header {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--theme-text-muted);
  margin-bottom: 8px;
}

.v4-result-card-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 12px;
}

.v4-result-card-row-large .v4-result-card-value {
  font-size: 16px;
  font-weight: 600;
}

.v4-result-card-label {
  color: var(--theme-text-muted);
}

.v4-result-card-value {
  font-family: 'Consolas', 'Monaco', monospace;
}

/* Context Menu */
.v4-context-menu {
  position: absolute;
  top: 48px;
  right: 8px;
  min-width: 180px;
  background: var(--theme-card-background);
  border: 1px solid var(--theme-border);
  border-radius: 8px;
  box-shadow: var(--v4-shadow-soft);
  z-index: 100;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-8px);
  transition: opacity 0.15s, transform 0.15s, visibility 0.15s;
}

.v4-context-menu.open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.v4-context-menu-item {
  display: block;
  width: 100%;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: var(--theme-text);
  text-align: left;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.v4-context-menu-item:first-child {
  border-radius: 8px 8px 0 0;
}

.v4-context-menu-item:last-child {
  border-radius: 0 0 8px 8px;
}

.v4-context-menu-item:hover {
  background: var(--theme-card-hover);
}
```

---

## 6. Phase 5: Tool Migration

### Step 5.1: Rename Tool Files

Use git to rename files while preserving history:

```bash
# Rename files
git mv src/components/matcher-tool.ts src/components/extractor-tool.ts
git mv src/components/mixer-tool.ts src/components/gradient-tool.ts
git mv src/components/character-tool.ts src/components/swatch-tool.ts

# Rename test files
git mv src/__tests__/matcher-tool.test.ts src/__tests__/extractor-tool.test.ts
git mv src/__tests__/mixer-tool.test.ts src/__tests__/gradient-tool.test.ts
git mv src/__tests__/character-tool.test.ts src/__tests__/swatch-tool.test.ts
```

### Step 5.2: Update Class Names

In each renamed file, update the class name:

**extractor-tool.ts:**
```typescript
// Change:
export class MatcherTool extends BaseComponent {
// To:
export class ExtractorTool extends BaseComponent {
```

**gradient-tool.ts:**
```typescript
// Change:
export class MixerTool extends BaseComponent {
// To:
export class GradientTool extends BaseComponent {
```

**swatch-tool.ts:**
```typescript
// Change:
export class CharacterTool extends BaseComponent {
// To:
export class SwatchTool extends BaseComponent {
```

### Step 5.3: Find and Replace References

Use your IDE's global search/replace:

| Find | Replace |
|------|---------|
| `MatcherTool` | `ExtractorTool` |
| `MixerTool` | `GradientTool` |
| `CharacterTool` | `SwatchTool` |
| `'matcher'` | `'extractor'` |
| `'/matcher'` | `'/extractor'` |
| `'character'` | `'swatch'` |
| `'/character'` | `'/swatch'` |

**Note:** Be careful with `'mixer'` as the new Dye Mixer tool uses this route.

---

## 7. Phase 6: New Dye Mixer Tool

### Step 6.1: Create DyeMixerTool Component

Create `src/components/dye-mixer-tool.ts`:

```typescript
/**
 * XIV Dye Tools v4.0 - Dye Mixer Tool
 *
 * Crafting-style interface for mixing two dyes
 * and finding dyes that match the blended result
 *
 * @module components/dye-mixer-tool
 */

import { BaseComponent } from './base-component';
import { DyeService } from '@services/dye-service-wrapper';
import { ColorService } from '@xivdyetools/core';
import { ResultCard, ResultCardData } from './result-card';
import type { Dye, DyeWithDistance } from '@xivdyetools/types';
import { clearContainer } from '@shared/utils';

export interface DyeMixerToolOptions {
  sidebarContainer: HTMLElement;
  contentContainer: HTMLElement;
}

interface MixerState {
  slot1: Dye | null;
  slot2: Dye | null;
  maxResults: number;
  results: DyeWithDistance[];
}

export class DyeMixerTool extends BaseComponent {
  private options: DyeMixerToolOptions;
  private state: MixerState = {
    slot1: null,
    slot2: null,
    maxResults: 5,
    results: [],
  };

  private resultCards: ResultCard[] = [];

  constructor(container: HTMLElement, options: DyeMixerToolOptions) {
    super(container);
    this.options = options;
  }

  renderContent(): void {
    // Render sidebar config
    this.renderSidebar();

    // Render main content
    this.renderMainContent();
  }

  private renderSidebar(): void {
    const sidebar = this.options.sidebarContainer;
    clearContainer(sidebar);

    const section = this.createElement('div', {
      className: 'v4-config-section',
    });

    // Section title
    const title = this.createElement('h3', {
      className: 'v4-config-title',
      textContent: 'Dye Mixer',
    });
    section.appendChild(title);

    // Max results slider
    const sliderGroup = this.createElement('div', {
      className: 'v4-config-group',
    });

    const sliderLabel = this.createElement('label', {
      className: 'v4-config-label',
      textContent: `Max Results: ${this.state.maxResults}`,
      attributes: { for: 'max-results' },
    });
    sliderGroup.appendChild(sliderLabel);

    const slider = this.createElement('input', {
      className: 'v4-range-slider',
      attributes: {
        type: 'range',
        id: 'max-results',
        min: '3',
        max: '10',
        value: this.state.maxResults.toString(),
      },
    });
    sliderGroup.appendChild(slider);

    section.appendChild(sliderGroup);
    sidebar.appendChild(section);
  }

  private renderMainContent(): void {
    clearContainer(this.container);

    this.element = this.createElement('div', {
      className: 'v4-dye-mixer',
    });

    // Mixing area
    const mixingArea = this.createElement('div', {
      className: 'v4-mixer-slots',
    });

    // Slot 1
    const slot1 = this.createSlot(1, this.state.slot1);
    mixingArea.appendChild(slot1);

    // Plus sign
    const plusSign = this.createElement('div', {
      className: 'v4-mixer-operator',
      textContent: '+',
    });
    mixingArea.appendChild(plusSign);

    // Slot 2
    const slot2 = this.createSlot(2, this.state.slot2);
    mixingArea.appendChild(slot2);

    // Arrow
    const arrow = this.createElement('div', {
      className: 'v4-mixer-operator',
      textContent: '→',
    });
    mixingArea.appendChild(arrow);

    // Result slot
    const resultSlot = this.createResultSlot();
    mixingArea.appendChild(resultSlot);

    this.element.appendChild(mixingArea);

    // Results grid
    if (this.state.results.length > 0) {
      const resultsSection = this.createElement('div', {
        className: 'v4-mixer-results',
      });

      const resultsTitle = this.createElement('h3', {
        className: 'v4-results-title',
        textContent: 'Matching Dyes',
      });
      resultsSection.appendChild(resultsTitle);

      const grid = this.createElement('div', {
        className: 'v4-results-grid',
      });
      resultsSection.appendChild(grid);

      // Create result cards
      for (const result of this.state.results) {
        const cardContainer = this.createElement('div');
        grid.appendChild(cardContainer);

        const blendedColor = this.getBlendedColor();
        const card = new ResultCard(cardContainer, {
          data: {
            dye: result,
            originalColor: blendedColor,
            matchedColor: `#${result.hex}`,
            deltaE: result.distance,
          },
          onSelect: (dye) => this.handleDyeSelect(dye),
        });
        card.init();
        this.resultCards.push(card);
      }

      this.element.appendChild(resultsSection);
    }

    this.container.appendChild(this.element);
  }

  private createSlot(slotNum: number, dye: Dye | null): HTMLElement {
    const slot = this.createElement('div', {
      className: `v4-mixer-slot ${dye ? 'filled' : 'empty'}`,
      dataAttributes: { slot: slotNum.toString() },
    });

    if (dye) {
      slot.style.backgroundColor = `#${dye.hex}`;

      const dyeName = this.createElement('span', {
        className: 'v4-mixer-slot-name',
        textContent: dye.name,
      });
      slot.appendChild(dyeName);

      const clearBtn = this.createElement('button', {
        className: 'v4-mixer-slot-clear',
        textContent: '×',
        attributes: {
          type: 'button',
          'aria-label': 'Clear slot',
        },
      });
      slot.appendChild(clearBtn);
    } else {
      const placeholder = this.createElement('span', {
        className: 'v4-mixer-slot-placeholder',
        textContent: `Slot ${slotNum}`,
      });
      slot.appendChild(placeholder);
    }

    return slot;
  }

  private createResultSlot(): HTMLElement {
    const slot = this.createElement('div', {
      className: 'v4-mixer-result-slot',
    });

    if (this.state.slot1 && this.state.slot2) {
      const blendedColor = this.getBlendedColor();
      slot.style.backgroundColor = blendedColor;

      const label = this.createElement('span', {
        className: 'v4-mixer-result-label',
        textContent: 'Blended',
      });
      slot.appendChild(label);
    } else {
      const placeholder = this.createElement('span', {
        className: 'v4-mixer-slot-placeholder',
        textContent: 'Result',
      });
      slot.appendChild(placeholder);
    }

    return slot;
  }

  private getBlendedColor(): string {
    if (!this.state.slot1 || !this.state.slot2) return '#808080';

    const rgb1 = this.state.slot1.rgb;
    const rgb2 = this.state.slot2.rgb;

    // Simple RGB average blend
    const blended = {
      r: Math.round((rgb1.r + rgb2.r) / 2),
      g: Math.round((rgb1.g + rgb2.g) / 2),
      b: Math.round((rgb1.b + rgb2.b) / 2),
    };

    return ColorService.rgbToHex(blended);
  }

  bindEvents(): void {
    // Slot click handlers
    const slots = this.querySelectorAll<HTMLElement>('.v4-mixer-slot');
    for (const slot of slots) {
      this.on(slot, 'click', () => {
        const slotNum = parseInt(slot.dataset.slot || '1', 10);
        this.openDyeSelector(slotNum);
      });
    }

    // Clear button handlers
    const clearBtns = this.querySelectorAll<HTMLButtonElement>('.v4-mixer-slot-clear');
    for (const btn of clearBtns) {
      this.on(btn, 'click', (e: Event) => {
        e.stopPropagation();
        const slot = btn.closest('.v4-mixer-slot');
        const slotNum = parseInt(slot?.dataset.slot || '1', 10);
        this.clearSlot(slotNum);
      });
    }

    // Max results slider
    const slider = this.options.sidebarContainer.querySelector<HTMLInputElement>('#max-results');
    if (slider) {
      this.on(slider, 'input', () => {
        this.state.maxResults = parseInt(slider.value, 10);
        const label = this.options.sidebarContainer.querySelector('.v4-config-label');
        if (label) {
          label.textContent = `Max Results: ${this.state.maxResults}`;
        }
        this.computeResults();
      });
    }
  }

  private openDyeSelector(slotNum: number): void {
    // Emit event to open dye selector modal
    this.emit('open-dye-selector', {
      slotNum,
      onSelect: (dye: Dye) => this.setSlot(slotNum, dye),
    });
  }

  private setSlot(slotNum: number, dye: Dye): void {
    if (slotNum === 1) {
      this.state.slot1 = dye;
    } else {
      this.state.slot2 = dye;
    }

    this.computeResults();
    this.update();
  }

  private clearSlot(slotNum: number): void {
    if (slotNum === 1) {
      this.state.slot1 = null;
    } else {
      this.state.slot2 = null;
    }

    this.state.results = [];
    this.update();
  }

  private computeResults(): void {
    if (!this.state.slot1 || !this.state.slot2) {
      this.state.results = [];
      return;
    }

    const blendedColor = this.getBlendedColor();
    const hex = blendedColor.replace('#', '');

    // Find closest dyes to blended color
    this.state.results = DyeService.findClosestDyes(hex, this.state.maxResults);
  }

  private handleDyeSelect(dye: Dye): void {
    this.emit('dye-selected', { dye });
  }

  destroy(): void {
    // Destroy child cards
    for (const card of this.resultCards) {
      card.destroy();
    }
    this.resultCards = [];
    super.destroy();
  }
}
```

### Step 6.2: Add Dye Mixer CSS

```css
/* ===== V4 Dye Mixer ===== */
.v4-dye-mixer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding: 24px;
}

.v4-mixer-slots {
  display: flex;
  align-items: center;
  gap: 16px;
}

.v4-mixer-slot {
  width: 100px;
  height: 100px;
  border-radius: 12px;
  border: 2px dashed var(--theme-border);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s, transform 0.2s;
  position: relative;
}

.v4-mixer-slot:hover {
  border-color: var(--theme-primary);
  transform: scale(1.02);
}

.v4-mixer-slot.filled {
  border-style: solid;
}

.v4-mixer-slot-name {
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  padding: 4px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border-radius: 4px;
}

.v4-mixer-slot-placeholder {
  color: var(--theme-text-muted);
  font-size: 12px;
}

.v4-mixer-slot-clear {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: var(--theme-primary);
  color: var(--theme-text-header);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.v4-mixer-slot:hover .v4-mixer-slot-clear {
  opacity: 1;
}

.v4-mixer-operator {
  font-size: 24px;
  font-weight: 300;
  color: var(--theme-text-muted);
}

.v4-mixer-result-slot {
  width: 120px;
  height: 120px;
  border-radius: 16px;
  border: 3px solid var(--theme-primary);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 12px;
  box-shadow: var(--v4-shadow-glow);
}

.v4-mixer-result-label {
  font-size: 12px;
  font-weight: 500;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
}

.v4-mixer-results {
  width: 100%;
  max-width: 1200px;
}

.v4-results-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  color: var(--theme-text);
}

.v4-results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  justify-items: center;
}
```

---

## 8. Phase 7: Entry Point Updates

### Step 7.1: Create v4-layout.ts

Create `src/components/v4-layout.ts`:

```typescript
/**
 * XIV Dye Tools v4.0 - Layout Initialization
 *
 * Entry point for v4 layout system
 *
 * @module components/v4-layout
 */

import { V4LayoutShell } from './v4-layout-shell';
import { RouterService, ToolId } from '@services/router-service';
import { logger } from '@shared/logger';

// Tool component loaders (lazy)
const toolLoaders: Record<ToolId, () => Promise<unknown>> = {
  harmony: () => import('./harmony-tool'),
  extractor: () => import('./extractor-tool'),
  accessibility: () => import('./accessibility-tool'),
  comparison: () => import('./comparison-tool'),
  gradient: () => import('./gradient-tool'),
  mixer: () => import('./dye-mixer-tool'),
  presets: () => import('./preset-tool'),
  budget: () => import('./budget-tool'),
  swatch: () => import('./swatch-tool'),
};

let layoutShell: V4LayoutShell | null = null;
let currentTool: unknown = null;

/**
 * Initialize the v4 layout system
 */
export async function initializeV4Layout(container: HTMLElement): Promise<void> {
  logger.info('🚀 Initializing V4 Layout');

  // Initialize router
  RouterService.initialize();

  // Create layout shell
  layoutShell = new V4LayoutShell(container, {
    initialTool: RouterService.getCurrentToolId(),
    onToolChange: (toolId) => {
      logger.info(`Tool changed to: ${toolId}`);
    },
  });
  layoutShell.init();

  // Subscribe to route changes
  RouterService.subscribe(async (state) => {
    await loadToolContent(state.toolId);
  });

  // Load initial tool
  await loadToolContent(RouterService.getCurrentToolId());

  logger.info('✅ V4 Layout initialized');
}

/**
 * Load and render tool content
 */
async function loadToolContent(toolId: ToolId): Promise<void> {
  if (!layoutShell) return;

  const contentContainer = layoutShell.getContentContainer();
  const sidebarContainer = layoutShell.getSidebarContainer();

  if (!contentContainer || !sidebarContainer) return;

  // Destroy previous tool
  if (currentTool && typeof (currentTool as { destroy: () => void }).destroy === 'function') {
    (currentTool as { destroy: () => void }).destroy();
    currentTool = null;
  }

  // Clear containers
  contentContainer.innerHTML = '<div class="loading-spinner">Loading...</div>';

  try {
    // Lazy load tool module
    const module = await toolLoaders[toolId]();

    // Get tool class (assuming default export or named export matching pattern)
    const ToolClass = getToolClass(module, toolId);

    if (ToolClass) {
      currentTool = new ToolClass(contentContainer, {
        sidebarContainer,
        contentContainer,
      });
      (currentTool as { init: () => void }).init();
    }
  } catch (error) {
    logger.error(`Failed to load tool: ${toolId}`, error);
    contentContainer.innerHTML = `
      <div class="error-message">
        Failed to load tool. Please try again.
      </div>
    `;
  }
}

/**
 * Extract tool class from module
 */
function getToolClass(module: unknown, toolId: ToolId): unknown {
  const mod = module as Record<string, unknown>;

  // Map toolId to expected class names
  const classNames: Record<ToolId, string> = {
    harmony: 'HarmonyTool',
    extractor: 'ExtractorTool',
    accessibility: 'AccessibilityTool',
    comparison: 'ComparisonTool',
    gradient: 'GradientTool',
    mixer: 'DyeMixerTool',
    presets: 'PresetTool',
    budget: 'BudgetTool',
    swatch: 'SwatchTool',
  };

  return mod[classNames[toolId]] || mod.default;
}

/**
 * Destroy v4 layout
 */
export function destroyV4Layout(): void {
  if (currentTool && typeof (currentTool as { destroy: () => void }).destroy === 'function') {
    (currentTool as { destroy: () => void }).destroy();
  }
  layoutShell?.destroy();
  layoutShell = null;
  currentTool = null;
}
```

### Step 7.2: Update main.ts

In `src/main.ts`, replace v3 layout initialization:

```typescript
// OLD (v3):
// const { initializeV3Layout } = await import('@components/v3-layout');
// await initializeV3Layout(contentContainer);

// NEW (v4):
const { initializeV4Layout } = await import('@components/v4-layout');
await initializeV4Layout(contentContainer);
```

---

## 9. Verification Steps

### Step 9.1: Run Type Checking

```bash
npm run type-check
# or
npx tsc --noEmit
```

Fix any TypeScript errors before proceeding.

### Step 9.2: Run Unit Tests

```bash
npm run test

# With coverage
npm run test:coverage
```

Ensure 80% coverage threshold is met.

### Step 9.3: Run E2E Tests

```bash
npm run test:e2e

# Headed mode for debugging
npm run test:e2e -- --headed
```

### Step 9.4: Manual Testing Checklist

- [ ] App loads without console errors
- [ ] All 9 tools accessible via Tool Banner
- [ ] URL changes on tool selection
- [ ] Browser back/forward works
- [ ] All 11 themes apply correctly
- [ ] Glassmorphism visible in dark themes
- [ ] Mobile layout works (< 768px)
- [ ] Keyboard navigation works
- [ ] Screen reader announces tool changes

### Step 9.5: Bundle Size Check

```bash
npm run build
npm run check-bundle-size
```

Verify bundle sizes are within limits:
- Main bundle < 200KB gzipped
- Per-tool chunk < 50KB gzipped

---

## Appendix: Quick Reference

### New Component Files

| File | Description |
|------|-------------|
| `src/components/v4-layout-shell.ts` | Main layout container |
| `src/components/v4-app-header.ts` | 48px header |
| `src/components/tool-banner.ts` | 64px tool nav |
| `src/components/config-sidebar.ts` | 320px config panel |
| `src/components/result-card.ts` | Unified result card |
| `src/components/glass-panel.ts` | Glassmorphism container |
| `src/components/dye-mixer-tool.ts` | New mixer tool |
| `src/components/v4-layout.ts` | Layout initialization |

### Renamed Files

| Old Name | New Name |
|----------|----------|
| `matcher-tool.ts` | `extractor-tool.ts` |
| `mixer-tool.ts` | `gradient-tool.ts` |
| `character-tool.ts` | `swatch-tool.ts` |

### CSS Files

| File | Description |
|------|-------------|
| `src/styles/v4-layout.css` | Layout component styles |
| `src/styles/v4-components.css` | Shared component styles |

### Import Aliases

Ensure `tsconfig.json` has these path aliases:

```json
{
  "compilerOptions": {
    "paths": {
      "@components/*": ["src/components/*"],
      "@services/*": ["src/services/*"],
      "@shared/*": ["src/shared/*"],
      "@styles/*": ["src/styles/*"]
    }
  }
}
```
