/**
 * XIV Dye Tools v4.0 - Layout Shell Component
 *
 * Main layout orchestrator combining:
 * - V4AppHeader (48px top header)
 * - ToolBanner (64px tool navigation)
 * - ConfigSidebar (320px left sidebar)
 * - Content Area (main slot for tool content)
 * - DyePaletteDrawer (320px right drawer)
 *
 * Handles routing subscription and coordinates all child components.
 * Provides 3-column layout: [ConfigSidebar] | [Content] | [DyePaletteDrawer]
 *
 * @module components/v4/v4-layout-shell
 */

import { html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import type { ToolId } from '@services/router-service';
import { LanguageService } from '@services/index';

// Import child components to ensure registration
import './v4-app-header';
import './tool-banner';
import './config-sidebar';
import './dye-palette-drawer';

// Import Dye type for event handling
import type { Dye } from '@services/dye-service-wrapper';

/**
 * V4 Layout Shell - Main application layout container
 *
 * @fires tool-change - When active tool changes, with detail: { toolId: ToolId }
 * @fires dye-selected - When a dye is selected from the palette drawer, with detail: { dye: Dye }
 * @fires custom-color-selected - When a custom color is applied from the palette drawer, with detail: { hex: string }
 * @fires clear-all-dyes - When clear all dyes button is clicked in palette drawer
 * @fires theme-click - Bubbled from V4AppHeader
 * @fires language-click - Bubbled from V4AppHeader
 * @fires about-click - Bubbled from V4AppHeader
 *
 * @slot - Default slot for tool content
 *
 * @example
 * ```html
 * <v4-layout-shell .activeTool=${'harmony'}>
 *   <harmony-tool></harmony-tool>
 * </v4-layout-shell>
 * ```
 */
@customElement('v4-layout-shell')
export class V4LayoutShell extends BaseLitComponent {
  /**
   * Currently active tool ID
   */
  @property({ type: String, attribute: 'active-tool' })
  activeTool: ToolId = 'harmony';

  /**
   * Whether the sidebar is collapsed (mobile mode)
   */
  @state()
  private sidebarCollapsed = false;

  /**
   * Whether we're in mobile viewport
   */
  @state()
  private isMobile = false;

  /**
   * Whether the right palette drawer is open (visible by default)
   */
  @state()
  private paletteDrawerOpen = true;

  /**
   * Tools that should NOT show the Color Palette drawer
   */
  private static readonly TOOLS_WITHOUT_PALETTE: ToolId[] = ['extractor', 'swatch', 'presets'];

  /**
   * Check if the palette should be visible for the current tool
   */
  private get shouldShowPalette(): boolean {
    return !V4LayoutShell.TOOLS_WITHOUT_PALETTE.includes(this.activeTool);
  }

  /**
   * Media query for mobile detection
   */
  private mobileQuery: MediaQueryList | null = null;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100vh;
        width: 100%;
        overflow: hidden;
        background: radial-gradient(
          circle at center,
          var(--v4-gradient-start, #252525) 0%,
          var(--v4-gradient-end, #121212) 100%
        );
      }

      /* Main Layout Container */
      .v4-layout-main {
        display: flex;
        flex: 1;
        overflow: hidden;
        position: relative;
      }

      /* Content Area */
      .v4-layout-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        position: relative;
      }

      /* Content Scroll Container */
      .v4-layout-content-scroll {
        flex: 1;
        overflow-y: auto;
        padding: var(--v4-content-padding, 24px);
        scrollbar-width: thin;
      }

      .v4-layout-content-scroll::-webkit-scrollbar {
        width: 8px;
      }

      .v4-layout-content-scroll::-webkit-scrollbar-track {
        background: transparent;
      }

      .v4-layout-content-scroll::-webkit-scrollbar-thumb {
        background: var(--theme-border, rgba(255, 255, 255, 0.2));
        border-radius: 4px;
      }

      /* Mobile Overlay */
      .v4-sidebar-overlay {
        display: none;
        position: fixed;
        top: calc(var(--v4-header-height, 48px) + var(--v4-tool-bar-height, 64px));
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 99;
        cursor: pointer;
      }

      .v4-sidebar-overlay.visible {
        display: block;
      }

      /* Mobile Drawer Overlay (for tap-outside-to-close on palette drawer) */
      .v4-drawer-overlay {
        display: none;
        position: fixed;
        top: calc(var(--v4-header-height, 48px) + var(--v4-tool-bar-height, 64px));
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 99;
        cursor: pointer;
      }

      .v4-drawer-overlay.visible {
        display: block;
      }

      /* Mobile Toggle Button */
      .v4-mobile-sidebar-toggle {
        display: none;
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: var(--theme-primary, #d4af37);
        color: var(--theme-text-on-primary, #000);
        cursor: pointer;
        box-shadow:
          var(--v4-shadow-soft, 0 4px 6px rgba(0, 0, 0, 0.3)),
          var(--v4-shadow-glow, 0 0 10px rgba(212, 175, 55, 0.2));
        z-index: 100;
        font-size: 24px;
        transition: transform var(--v4-transition-fast, 150ms);
      }

      .v4-mobile-sidebar-toggle:hover {
        transform: scale(1.05);
      }

      .v4-mobile-sidebar-toggle:active {
        transform: scale(0.95);
      }

      /* Left Sidebar Toggle FAB (shown when sidebar is closed) */
      .v4-sidebar-toggle {
        position: fixed;
        bottom: 24px;
        left: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        background: var(--v4-glass-bg, rgba(30, 30, 30, 0.9));
        backdrop-filter: var(--v4-glass-blur, blur(12px));
        -webkit-backdrop-filter: var(--v4-glass-blur, blur(12px));
        color: var(--theme-primary, #d4af37);
        cursor: pointer;
        box-shadow: var(--v4-shadow-soft, 0 4px 6px rgba(0, 0, 0, 0.3));
        z-index: 100;
        transition:
          transform var(--v4-transition-fast, 150ms),
          opacity 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .v4-sidebar-toggle:hover {
        transform: scale(1.05);
      }

      .v4-sidebar-toggle:active {
        transform: scale(0.95);
      }

      .v4-sidebar-toggle svg {
        width: 24px;
        height: 24px;
      }

      /* Hide toggle when sidebar is open */
      .v4-sidebar-toggle.sidebar-open {
        display: none;
      }

      /* Right Drawer Toggle FAB */
      .v4-palette-toggle {
        position: fixed;
        bottom: 24px;
        right: 88px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        background: var(--v4-glass-bg, rgba(30, 30, 30, 0.9));
        backdrop-filter: var(--v4-glass-blur, blur(12px));
        -webkit-backdrop-filter: var(--v4-glass-blur, blur(12px));
        color: var(--theme-primary, #d4af37);
        cursor: pointer;
        box-shadow: var(--v4-shadow-soft, 0 4px 6px rgba(0, 0, 0, 0.3));
        z-index: 100;
        transition:
          transform var(--v4-transition-fast, 150ms),
          opacity 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .v4-palette-toggle:hover {
        transform: scale(1.05);
      }

      .v4-palette-toggle:active {
        transform: scale(0.95);
      }

      .v4-palette-toggle svg {
        width: 24px;
        height: 24px;
      }

      /* Hide toggle when drawer is open on desktop */
      .v4-palette-toggle.drawer-open {
        display: none;
      }

      /* Hide toggle completely when palette is not available for tool */
      .v4-palette-toggle.no-palette {
        display: none !important;
      }

      /* Mobile Styles */
      @media (max-width: 768px) {
        .v4-mobile-sidebar-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        v4-config-sidebar {
          position: fixed;
          top: calc(var(--v4-header-height, 48px) + var(--v4-tool-bar-height, 64px));
          left: 0;
          bottom: 0;
          z-index: 100;
        }

        dye-palette-drawer {
          position: fixed;
          top: calc(var(--v4-header-height, 48px) + var(--v4-tool-bar-height, 64px));
          right: 0;
          bottom: 0;
          z-index: 100;
        }

        .v4-palette-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Hide desktop sidebar toggle on mobile - use mobile FAB instead */
        .v4-sidebar-toggle {
          display: none;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .v4-mobile-sidebar-toggle {
          transition: none;
        }
        .v4-mobile-sidebar-toggle:hover,
        .v4-mobile-sidebar-toggle:active {
          transform: none;
        }
      }
      /* ==========================================================================
         Accessibility Tool Styles & Global Helper Classes
         ========================================================================== */

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--theme-border);
        margin-bottom: 16px;
        margin-top: 8px;
      }

      .section-title {
        font-size: 14px;
        text-transform: uppercase;
        color: var(--theme-text-muted);
        font-weight: 600;
        letter-spacing: 1px;
      }

      .contrast-table-container {
        border-radius: 12px;
        overflow: hidden;
        background: var(--theme-card-background);
        border: 1px solid var(--theme-border);
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        max-width: 800px;
        margin: 0 auto;
      }

      .contrast-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      .contrast-table thead {
        background: var(--theme-background-secondary);
      }

      .contrast-table th {
        padding: 14px 16px;
        text-align: left;
        font-weight: 600;
        color: var(--theme-text-muted);
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 1px;
        border-bottom: 1px solid var(--theme-border);
      }

      .contrast-table td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--theme-border);
      }

      .contrast-table tr:last-child td {
        border-bottom: none;
      }

      .pairwise-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        max-width: 800px;
        margin: 0 auto;
        background: var(--theme-card-background);
        border: 1px solid var(--theme-border);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      }

      .pairwise-matrix {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      /* Vision Simulation Cards */
      .vision-card {
        display: flex;
        flex-direction: column;
        background: var(--theme-card-background);
        border: 1px solid var(--theme-border);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition:
          transform 0.2s,
          box-shadow 0.2s;
        flex: 1 1 200px;
        min-width: 200px;
        max-width: 280px;
      }

      .vision-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        border-color: var(--theme-text-muted);
      }

      .vision-card-header {
        background: rgba(0, 0, 0, 0.4);
        padding: 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--theme-border);
      }

      .vision-type-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--theme-text);
      }

      .vision-prevalence {
        font-size: 10px;
        color: var(--theme-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .vision-swatches {
        display: flex;
        gap: 10px;
        padding: 16px;
        justify-content: center;
        flex-grow: 1;
        align-items: flex-start;
      }

      .vision-swatch-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }

      .vision-swatch {
        width: 40px;
        height: 40px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }

      .vision-swatch-label {
        font-size: 9px;
        color: var(--theme-text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        max-width: 44px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: center;
      }

      .vision-swatch-hex {
        font-size: 9px;
        font-family: monospace;
        color: var(--theme-text-muted);
      }

      /* WCAG Contrast Table Enhancements */
      .dye-cell-content {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .dye-indicator {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        flex-shrink: 0;
      }

      .contrast-cell-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .contrast-ratio {
        color: var(--theme-text);
        font-family: monospace;
        font-size: 13px;
      }

      .wcag-badge {
        padding: 3px 10px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .wcag-badge.aaa {
        background: rgba(34, 197, 94, 0.2);
        color: #22c55e;
        border: 1px solid rgba(34, 197, 94, 0.3);
      }

      .wcag-badge.aa {
        background: rgba(234, 179, 8, 0.2);
        color: #eab308;
        border: 1px solid rgba(234, 179, 8, 0.3);
      }

      .wcag-badge.fail {
        background: rgba(239, 68, 68, 0.2);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }

      /* Pairwise Matrix Enhancements */
      .matrix-header-cell {
        padding: 10px 12px;
        text-align: center;
        vertical-align: bottom;
        min-width: 90px;
      }

      .matrix-header-swatch {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        margin: 0 auto 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .matrix-header-cell span {
        font-size: 11px;
        font-weight: 500;
        color: var(--theme-text-muted);
        display: block;
        max-width: 80px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin: 0 auto;
      }

      .matrix-row-header {
        padding: 10px 14px;
        background: var(--theme-card-background);
        position: sticky;
        left: 0;
        z-index: 1;
      }

      .matrix-row-swatch {
        width: 28px;
        height: 28px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        flex-shrink: 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }

      .matrix-corner {
        padding: 10px;
        min-width: 130px;
      }

      .matrix-cell {
        padding: 10px 14px;
        text-align: center;
        font-family: monospace;
        font-size: 13px;
        font-weight: 600;
        transition: all 0.15s ease;
      }

      .matrix-cell.diagonal {
        color: var(--theme-text-muted);
        background: var(--theme-background-secondary);
      }

      .matrix-cell.good {
        color: #22c55e;
        background: rgba(34, 197, 94, 0.15);
      }

      .matrix-cell.warning {
        color: #eab308;
        background: rgba(234, 179, 8, 0.15);
      }

      .matrix-cell.critical {
        color: #ef4444;
        background: rgba(239, 68, 68, 0.15);
      }

      .matrix-cell.ok {
        color: #3b82f6;
        background: rgba(59, 130, 246, 0.15);
      }

      /* Warning Callouts */
      .pairwise-warnings {
        padding: 16px;
        border-top: 1px solid var(--theme-border);
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .warning-callout {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 8px;
      }

      .warning-callout.warning {
        background: rgba(234, 179, 8, 0.12);
        border: 1px solid rgba(234, 179, 8, 0.25);
      }

      .warning-callout.critical {
        background: rgba(239, 68, 68, 0.12);
        border: 1px solid rgba(239, 68, 68, 0.25);
      }

      .warning-icon {
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        fill: currentColor;
      }

      .warning-callout.warning .warning-icon {
        color: #eab308;
      }

      .warning-callout.critical .warning-icon {
        color: #ef4444;
      }

      .warning-callout span {
        font-size: 12px;
        color: var(--theme-text);
        line-height: 1.5;
      }

      .warning-callout strong {
        color: var(--theme-text);
        font-weight: 600;
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();

    // Set up mobile detection
    this.mobileQuery = window.matchMedia('(max-width: 768px)');
    this.isMobile = this.mobileQuery.matches;
    this.sidebarCollapsed = this.isMobile;

    // Listen for viewport changes
    this.mobileQuery.addEventListener('change', this.handleMediaQueryChange);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    // Clean up media query listener
    this.mobileQuery?.removeEventListener('change', this.handleMediaQueryChange);
  }

  /**
   * Handle media query changes
   */
  private handleMediaQueryChange = (e: MediaQueryListEvent): void => {
    this.isMobile = e.matches;
    // Auto-collapse sidebar on mobile, auto-expand on desktop
    this.sidebarCollapsed = e.matches;
  };

  /**
   * Handle tool selection from ToolBanner
   */
  private handleToolSelect(e: CustomEvent<{ toolId: ToolId }>): void {
    const { toolId } = e.detail;
    if (toolId !== this.activeTool) {
      this.activeTool = toolId;
      this.emit('tool-change', { toolId });

      // Collapse sidebar and close drawer on mobile after tool selection
      if (this.isMobile) {
        this.sidebarCollapsed = true;
        this.paletteDrawerOpen = false;
      }
    }
  }

  /**
   * Handle sidebar collapse from ConfigSidebar
   */
  private handleSidebarCollapse(): void {
    this.sidebarCollapsed = true;
  }

  /**
   * Toggle sidebar visibility (mobile)
   */
  private toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  /**
   * Handle overlay click (close sidebar)
   */
  private handleOverlayClick(): void {
    this.sidebarCollapsed = true;
  }

  /**
   * Handle drawer overlay click (close palette drawer on mobile)
   */
  private handleDrawerOverlayClick(): void {
    this.paletteDrawerOpen = false;
  }

  /**
   * Handle config changes from ConfigSidebar
   * Re-emits the event for parent (v4-layout.ts) to handle
   */
  private handleConfigChange(e: CustomEvent): void {
    this.emit('config-change', e.detail);
  }

  /**
   * Handle settings reset from Advanced Settings
   */
  private handleSettingsReset(): void {
    this.emit('settings-reset');
  }

  /**
   * Handle favorites cleared from Advanced Settings
   */
  private handleFavoritesCleared(): void {
    this.emit('favorites-cleared');
  }

  /**
   * Handle palettes cleared from Advanced Settings
   */
  private handlePalettesCleared(): void {
    this.emit('palettes-cleared');
  }

  /**
   * Handle tutorial reset from Advanced Settings
   */
  private handleTutorialReset(): void {
    this.emit('tutorial-reset');
  }

  /**
   * Handle settings imported from Advanced Settings
   */
  private handleSettingsImported(): void {
    this.emit('settings-imported');
  }

  /**
   * Toggle palette drawer visibility
   */
  private togglePaletteDrawer(): void {
    this.paletteDrawerOpen = !this.paletteDrawerOpen;
  }

  /**
   * Handle drawer toggle from DyePaletteDrawer close button
   */
  private handlePaletteDrawerToggle(): void {
    this.paletteDrawerOpen = false;
  }

  /**
   * Handle dye selection from DyePaletteDrawer
   * Re-emits for parent to route to active tool
   */
  private handleDyeSelected(e: CustomEvent<{ dye: Dye }>): void {
    // Stop the original event from bubbling further to prevent duplicate handling
    // (we re-emit it ourselves for the parent v4-layout.ts to receive)
    e.stopPropagation();
    this.emit('dye-selected', e.detail);
  }

  /**
   * Handle clear all dyes request from DyePaletteDrawer
   * Re-emits for parent to clear selections on active tool
   */
  private handleClearAllDyes(): void {
    this.emit('clear-all-dyes');
  }

  /**
   * Handle custom color selection from DyePaletteDrawer
   * Re-emits for parent to route to active tool
   */
  private handleCustomColorSelected(e: CustomEvent<{ hex: string }>): void {
    e.stopPropagation();
    this.emit('custom-color-selected', e.detail);
  }

  /**
   * Handle theme button click from header
   * Bubbles up to v4-layout.ts
   */
  private handleThemeClick(): void {
    this.emit('theme-click');
  }

  /**
   * Handle about button click from header
   * Bubbles up to v4-layout.ts
   */
  private handleAboutClick(): void {
    this.emit('about-click');
  }

  /**
   * Handle language button click from header
   * Bubbles up to v4-layout.ts
   */
  private handleLanguageClick(): void {
    this.emit('language-click');
  }

  protected override render(): TemplateResult {
    return html`
      <!-- App Header -->
      <v4-app-header
        @theme-click=${this.handleThemeClick}
        @about-click=${this.handleAboutClick}
        @language-click=${this.handleLanguageClick}
      ></v4-app-header>

      <!-- Tool Banner -->
      <v4-tool-banner
        .activeTool=${this.activeTool}
        @tool-select=${this.handleToolSelect}
      ></v4-tool-banner>

      <!-- Main Layout (Sidebar + Content) -->
      <div class="v4-layout-main">
        <!-- Config Sidebar -->
        <v4-config-sidebar
          .activeTool=${this.activeTool}
          ?collapsed=${this.sidebarCollapsed}
          @sidebar-collapse=${this.handleSidebarCollapse}
          @config-change=${this.handleConfigChange}
          @settings-reset=${this.handleSettingsReset}
          @clear-all-dyes=${this.handleClearAllDyes}
          @favorites-cleared=${this.handleFavoritesCleared}
          @palettes-cleared=${this.handlePalettesCleared}
          @tutorial-reset=${this.handleTutorialReset}
          @settings-imported=${this.handleSettingsImported}
        ></v4-config-sidebar>

        <!-- Mobile Sidebar Overlay -->
        <div
          class="v4-sidebar-overlay ${!this.sidebarCollapsed && this.isMobile ? 'visible' : ''}"
          @click=${this.handleOverlayClick}
          role="button"
          tabindex="-1"
          aria-label="${LanguageService.t('aria.closeSidebar')}"
        ></div>

        <!-- Mobile Drawer Overlay (tap outside to close palette) -->
        <div
          class="v4-drawer-overlay ${this.paletteDrawerOpen &&
          this.isMobile &&
          this.shouldShowPalette
            ? 'visible'
            : ''}"
          @click=${this.handleDrawerOverlayClick}
          role="button"
          tabindex="-1"
          aria-label="${LanguageService.t('aria.closePalette')}"
        ></div>

        <!-- Content Area -->
        <main class="v4-layout-content" id="main-content" role="main">
          <div class="v4-layout-content-scroll">
            <slot></slot>
          </div>
        </main>

        <!-- Right Palette Drawer (hidden for extractor, swatch, presets) -->
        ${this.shouldShowPalette
          ? html`
              <dye-palette-drawer
                ?is-open=${this.paletteDrawerOpen}
                active-tool=${this.activeTool}
                @drawer-toggle=${this.handlePaletteDrawerToggle}
                @dye-selected=${this.handleDyeSelected}
                @custom-color-selected=${this.handleCustomColorSelected}
                @clear-all-dyes=${this.handleClearAllDyes}
              ></dye-palette-drawer>
            `
          : ''}
      </div>

      <!-- Mobile Sidebar Toggle FAB -->
      <button
        class="v4-mobile-sidebar-toggle"
        type="button"
        title="${LanguageService.t('aria.toggleConfigSidebar')}"
        aria-label="${LanguageService.t('aria.toggleConfigSidebar')}"
        aria-expanded=${!this.sidebarCollapsed}
        @click=${this.toggleSidebar}
      >
        ☰
      </button>

      <!-- Desktop Sidebar Toggle FAB (shown when sidebar is closed) -->
      <button
        class="v4-sidebar-toggle ${!this.sidebarCollapsed ? 'sidebar-open' : ''}"
        type="button"
        title="${LanguageService.t('aria.toggleConfigSidebar')}"
        aria-label="${LanguageService.t('aria.toggleConfigSidebar')}"
        aria-expanded=${!this.sidebarCollapsed}
        @click=${this.toggleSidebar}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="3"></circle>
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
          ></path>
        </svg>
      </button>

      <!-- Palette Drawer Toggle FAB (hidden when drawer is open or tool doesn't use palette) -->
      <button
        class="v4-palette-toggle ${this.paletteDrawerOpen ? 'drawer-open' : ''} ${!this
          .shouldShowPalette
          ? 'no-palette'
          : ''}"
        type="button"
        title="${LanguageService.t('aria.showColorPalette')}"
        aria-label="${LanguageService.t('aria.showColorPalette')}"
        aria-expanded=${this.paletteDrawerOpen}
        @click=${this.togglePaletteDrawer}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
          />
        </svg>
      </button>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-layout-shell': V4LayoutShell;
  }
}
