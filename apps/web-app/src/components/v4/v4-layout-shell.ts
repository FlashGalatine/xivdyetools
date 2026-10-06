/**
 * XIV Dye Tools 5.0 - Layout Shell Component
 *
 * The console shell: the app bar (brand + 2B tool title-menu + chrome
 * cluster) over the content area, with the left tool-Options panel and the
 * right dye-palette drawer. The header gear opens the Advanced Options
 * slide-over and nothing else; the Options panel is reached through its own
 * bottom-left FAB, which mirrors the palette FAB on the opposite corner.
 *
 * @module components/v4/v4-layout-shell
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import type { ToolId } from '@services/router-service';
import { LanguageService, StorageService } from '@services/index';
import { STORAGE_KEYS } from '@shared/constants';

// Import child components to ensure registration
import './v4-app-header';
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
 * @fires changelog-click - Bubbled from V4AppHeader
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
   * Whether we're in mobile viewport
   */
  @state()
  private isMobile = false;

  /**
   * Whether the right palette drawer is open.
   * Open by default on desktop; closed by default on mobile, where the drawer
   * is a full-height overlay that would otherwise cover the tool on first load
   * (see connectedCallback).
   */
  @state()
  private paletteDrawerOpen = true;

  /**
   * Whether the first-run "tap here to open the palette" hint has been
   * dismissed — either explicitly or by opening the drawer once. Persisted
   * under STORAGE_KEYS.PALETTE_HINT_SEEN so it only ever shows to a new user.
   */
  @state()
  private paletteHintDismissed = false;

  /**
   * Whether the tool-Options panel is collapsed (its × button, or the
   * bottom-left FAB). Open by default on desktop, where it is an inline
   * column; collapsed by default on mobile, where it is a full-height
   * left overlay that would otherwise cover the tool on first load
   * (see connectedCallback). Session-scoped — not persisted.
   *
   * The console-bar gear does NOT touch this — it only ever opens the
   * Advanced Options slide-over. Conflating the two put the Options panel
   * and the Advanced Settings sheet on screen at once on mobile.
   */
  @state()
  private optionsCollapsed = false;

  /**
   * Tools that should NOT show the Color Palette drawer
   */
  private static readonly TOOLS_WITHOUT_PALETTE: ToolId[] = ['extractor', 'presets', 'glamour'];

  /**
   * Tools with no Options panel (and so no Options FAB): the Glamour Reader
   * has nothing to configure — tribe and gender come from the file and
   * nothing is a colour match (design 1a, "No sidebar").
   */
  private static readonly TOOLS_WITHOUT_OPTIONS: ToolId[] = ['glamour'];

  private get shouldShowOptions(): boolean {
    return !V4LayoutShell.TOOLS_WITHOUT_OPTIONS.includes(this.activeTool);
  }

  /**
   * Check if the palette should be visible for the current tool
   */
  private get shouldShowPalette(): boolean {
    return !V4LayoutShell.TOOLS_WITHOUT_PALETTE.includes(this.activeTool);
  }

  /**
   * The mobile first-run hint shows only while the FAB is the way in: mobile
   * viewport, a tool that has a palette, drawer closed, hint not yet dismissed.
   */
  private get shouldShowPaletteHint(): boolean {
    return (
      this.isMobile &&
      this.shouldShowPalette &&
      !this.paletteDrawerOpen &&
      !this.paletteHintDismissed
    );
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

      /* Mobile Drawer Overlay (for tap-outside-to-close on palette drawer) */
      .v4-drawer-overlay {
        display: none;
        position: fixed;
        top: var(--v4-header-height, 54px);
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

      /* Left tool-Options Toggle FAB — the mirror of the palette FAB.
         Shares its geometry so the two corners read as one control pair. */
      .v4-options-toggle {
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

      .v4-options-toggle:hover {
        transform: scale(1.05);
      }

      .v4-options-toggle:active {
        transform: scale(0.95);
      }

      .v4-options-toggle svg {
        width: 22px;
        height: 22px;
      }

      /* While the panel is open it carries its own × — the FAB would only
         sit on top of the panel (mobile) or duplicate the close (desktop). */
      .v4-options-toggle.panel-open {
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

      /* Soft attention ring on the FAB while the first-run hint is showing */
      .v4-palette-toggle.hinting::before {
        content: '';
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 2px solid var(--theme-primary, #d4af37);
        opacity: 0;
        animation: v4-palette-hint-pulse 1.8s ease-out infinite;
        pointer-events: none;
      }

      @keyframes v4-palette-hint-pulse {
        0% {
          transform: scale(0.9);
          opacity: 0.8;
        }
        100% {
          transform: scale(1.5);
          opacity: 0;
        }
      }

      /* First-run mobile hint: a small callout above the palette FAB */
      .v4-palette-hint {
        position: fixed;
        bottom: 84px;
        right: 16px;
        max-width: min(260px, calc(100vw - 32px));
        display: none;
        align-items: flex-start;
        gap: 8px;
        padding: 10px 12px;
        border-radius: 10px;
        border: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        background: var(--v4-glass-bg, rgba(30, 30, 30, 0.95));
        backdrop-filter: var(--v4-glass-blur, blur(12px));
        -webkit-backdrop-filter: var(--v4-glass-blur, blur(12px));
        color: var(--theme-text, #e0e0e0);
        font-size: 13px;
        line-height: 1.4;
        box-shadow: var(--v4-shadow-soft, 0 4px 6px rgba(0, 0, 0, 0.3));
        z-index: 100;
        animation: v4-palette-hint-in 0.25s ease-out;
      }

      /* Caret pointing down at the FAB (FAB centre is at right: 88px + 24px) */
      .v4-palette-hint::after {
        content: '';
        position: absolute;
        bottom: -7px;
        right: 88px;
        width: 12px;
        height: 12px;
        background: inherit;
        border-right: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        border-bottom: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        transform: rotate(45deg);
      }

      @keyframes v4-palette-hint-in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .v4-palette-hint-text {
        flex: 1;
      }

      .v4-palette-hint-dismiss {
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        margin: -4px -6px -4px 0;
        padding: 0;
        border: none;
        border-radius: 6px;
        background: transparent;
        color: var(--v4-text-secondary, #a0a0a0);
        font-size: 16px;
        line-height: 1;
        cursor: pointer;
      }

      .v4-palette-hint-dismiss:hover {
        color: var(--theme-text, #e0e0e0);
        background: rgba(255, 255, 255, 0.08);
      }

      @media (prefers-reduced-motion: reduce) {
        .v4-palette-toggle.hinting::before,
        .v4-palette-hint {
          animation: none;
        }

        .v4-palette-toggle.hinting::before {
          opacity: 0.6;
          transform: none;
          inset: -3px;
        }
      }

      /* Mobile Styles */
      @media (max-width: 768px) {
        dye-palette-drawer {
          position: fixed;
          top: var(--v4-header-height, 54px);
          right: 0;
          bottom: 0;
          z-index: 100;
        }

        .v4-palette-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .v4-palette-hint {
          display: flex;
        }
      }
      /* ==========================================================================
         Global Helper Classes
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
    `,
    // BUG-112 (2026-10-04 deep-dive): print the tool, not the console. The
    // 100vh overflow-hidden host and the content scroller clipped a printout
    // to one sheet, with the app bar, FABs and Options column printed on it
    // (styles/v4-layout.css reaches only the host, not this shadow root).
    // Last in the list so it beats the max-width: 768px block, which a narrow
    // print page also matches; overflow is !important because v4-layout.ts
    // gives .v4-tool-main an inline overflow-y: auto. The rationale lives out
    // here because comments inside a css`` literal ship verbatim.
    css`
      @media print {
        :host,
        .v4-layout-main,
        .v4-layout-content,
        .v4-layout-content-scroll,
        .v4-tool-main {
          display: block;
          height: auto;
          overflow: visible !important;
        }
        v4-app-header,
        v4-config-sidebar,
        dye-palette-drawer,
        .v4-drawer-overlay,
        .v4-palette-hint,
        .v4-options-toggle,
        .v4-palette-toggle {
          display: none !important;
        }
      }
    `,
  ];

  private languageUnsubscribe: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();

    // The shell's own chrome (palette drawer aria-labels, mobile hint) is
    // localized, so it has to re-render when the language changes.
    this.languageUnsubscribe = LanguageService.subscribe(() => this.requestUpdate());

    // Set up mobile detection
    this.mobileQuery = window.matchMedia('(max-width: 768px)');
    this.isMobile = this.mobileQuery.matches;

    // On mobile both side panels are full-height overlays, so start with
    // them closed and let their FABs (plus a one-time hint) be the way in.
    if (this.isMobile) {
      this.paletteDrawerOpen = false;
      this.optionsCollapsed = true;
    }
    this.paletteHintDismissed =
      StorageService.getItem<boolean>(STORAGE_KEYS.PALETTE_HINT_SEEN, false) === true;

    // Listen for viewport changes
    this.mobileQuery.addEventListener('change', this.handleMediaQueryChange);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;

    // Clean up media query listener
    this.mobileQuery?.removeEventListener('change', this.handleMediaQueryChange);
  }

  /**
   * Handle media query changes
   */
  private handleMediaQueryChange = (e: MediaQueryListEvent): void => {
    this.isMobile = e.matches;
    // Crossing into the mobile layout turns both docked panels into
    // overlays — close them so they don't land on top of the tool.
    if (this.isMobile) {
      this.paletteDrawerOpen = false;
      this.optionsCollapsed = true;
    }
  };

  /**
   * Handle tool selection from the app bar's title menu
   */
  private handleToolSelect(e: CustomEvent<{ toolId: ToolId }>): void {
    const { toolId } = e.detail;
    if (toolId !== this.activeTool) {
      this.activeTool = toolId;
      this.emit('tool-change', { toolId });

      // Close both overlays on mobile after tool selection
      if (this.isMobile) {
        this.paletteDrawerOpen = false;
        this.optionsCollapsed = true;
      }
    }
  }

  /**
   * Handle drawer overlay click (close palette drawer on mobile)
   */
  private handleDrawerOverlayClick(): void {
    this.paletteDrawerOpen = false;
  }

  /**
   * Re-emit config changes from the Simple-Settings column for v4-layout
   */
  private handleConfigChange(e: CustomEvent): void {
    // BUG-113: emit() is bubbles + composed, so the original would reach
    // v4-layout's host listener too and every handler there ran twice.
    // Stop it, as handleDyeSelected does, and let only the re-emit through.
    e.stopPropagation();
    this.emit('config-change', e.detail);
  }

  /**
   * Toggle palette drawer visibility
   */
  private togglePaletteDrawer(): void {
    this.paletteDrawerOpen = !this.paletteDrawerOpen;
    if (this.paletteDrawerOpen) {
      // The user found the palette — the hint has done its job.
      this.dismissPaletteHint();
    }
  }

  /**
   * Handle drawer toggle from DyePaletteDrawer close button
   */
  private handlePaletteDrawerToggle(): void {
    this.paletteDrawerOpen = false;
  }

  /**
   * A tool asked for the picker (1A's hub button). The drawer is the app's
   * dye picker, so "open the sheet" means reveal it.
   */
  private handleOpenPaletteDrawer(): void {
    this.paletteDrawerOpen = true;
    this.dismissPaletteHint();
  }

  /**
   * Hide the first-run palette hint and remember that it has been seen.
   * Idempotent — safe to call from every path that opens the drawer.
   */
  private dismissPaletteHint(): void {
    if (this.paletteHintDismissed) return;
    this.paletteHintDismissed = true;
    StorageService.setItem(STORAGE_KEYS.PALETTE_HINT_SEEN, true);
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
  private handleClearAllDyes(e: Event): void {
    e.stopPropagation(); // BUG-113: see handleConfigChange
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
  private handleThemeClick(e: Event): void {
    e.stopPropagation(); // BUG-113: see handleConfigChange
    this.emit('theme-click');
  }

  /**
   * Handle "What's New" (changelog) button click from header
   * Bubbles up to v4-layout.ts
   */
  private handleChangelogClick(e: Event): void {
    e.stopPropagation(); // BUG-113: see handleConfigChange
    this.emit('changelog-click');
  }

  /**
   * Handle about button click from header
   * Bubbles up to v4-layout.ts
   */
  private handleAboutClick(e: Event): void {
    e.stopPropagation(); // BUG-113: see handleConfigChange
    this.emit('about-click');
  }

  /**
   * Handle language button click from header
   * Bubbles up to v4-layout.ts
   */
  private handleLanguageClick(e: Event): void {
    e.stopPropagation(); // BUG-113: see handleConfigChange
    this.emit('language-click');
  }

  /**
   * Handle the Options panel's × (sidebar-collapse).
   * The event is the panel's own; it stops here so v4-layout does not see
   * a stray collapse it has no surface for.
   */
  private handleOptionsCollapse(e: Event): void {
    e.stopPropagation();
    this.optionsCollapsed = true;
  }

  /**
   * Toggle the tool-Options panel from its bottom-left FAB. On desktop the
   * panel is an inline column, on mobile a left overlay; the FAB is the one
   * affordance that opens either.
   */
  private toggleOptionsPanel(): void {
    this.optionsCollapsed = !this.optionsCollapsed;
  }

  /**
   * Close the Options overlay when the mobile scrim behind it is tapped.
   */
  private handleOptionsOverlayClick(): void {
    this.optionsCollapsed = true;
  }

  /**
   * Handle advanced-options (gear) button click from header. It bubbles up to
   * v4-layout.ts, which opens the Advanced Options slide-over — and nothing
   * else. The gear used to double as the Options-panel toggle, which on
   * mobile put both surfaces on screen at once.
   */
  private handleAdvancedClick(e: Event): void {
    e.stopPropagation(); // BUG-113: see handleConfigChange
    this.emit('advanced-click');
  }

  protected override render(): TemplateResult {
    return html`
      <!-- Console App Bar (brand + 2B tool title-menu + chrome cluster) -->
      <v4-app-header
        .activeTool=${this.activeTool}
        @tool-select=${this.handleToolSelect}
        @changelog-click=${this.handleChangelogClick}
        @theme-click=${this.handleThemeClick}
        @about-click=${this.handleAboutClick}
        @language-click=${this.handleLanguageClick}
        @advanced-click=${this.handleAdvancedClick}
      ></v4-app-header>

      <!-- Main Layout (Simple Settings + Content + Drawer) -->
      <div class="v4-layout-main">
        <!-- Left tool-Options panel (drawn 1A desktop frames): an inline column
             on desktop, a left overlay on mobile. Both breakpoints reach it
             through the bottom-left Options FAB — never through the gear. -->
        ${
          this.shouldShowOptions
            ? html`<v4-config-sidebar
                class="v4-simple-settings"
                .activeTool=${this.activeTool}
                ?collapsed=${this.optionsCollapsed}
                @sidebar-collapse=${this.handleOptionsCollapse}
                @config-change=${this.handleConfigChange}
                @clear-all-dyes=${this.handleClearAllDyes}
              ></v4-config-sidebar>`
            : nothing
        }

        <!-- Mobile Options Overlay (tap outside to close the Options panel).
             Gated on the tool having a panel, like the palette's below: a
             route change that is not the app bar's tool-select (Back, a
             cross-link) leaves optionsCollapsed as it was. -->
        <div
          class="v4-drawer-overlay ${
            !this.optionsCollapsed && this.isMobile && this.shouldShowOptions ? 'visible' : ''
          }"
          @click=${this.handleOptionsOverlayClick}
          role="button"
          tabindex="-1"
          aria-label="${LanguageService.t('aria.closeSidebar')}"
        ></div>

        <!-- Mobile Drawer Overlay (tap outside to close palette) -->
        <div
          class="v4-drawer-overlay ${
            this.paletteDrawerOpen && this.isMobile && this.shouldShowPalette ? 'visible' : ''
          }"
          @click=${this.handleDrawerOverlayClick}
          role="button"
          tabindex="-1"
          aria-label="${LanguageService.t('aria.closePalette')}"
        ></div>

        <!-- Content Area -->
        <main
          class="v4-layout-content"
          id="main-content"
          role="main"
          @open-palette-drawer=${this.handleOpenPaletteDrawer}
        >
          <div class="v4-layout-content-scroll">
            <slot></slot>
          </div>
        </main>

        <!-- Right Palette Drawer (hidden for extractor, swatch, presets) -->
        ${
          this.shouldShowPalette
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
            : ''
        }
      </div>

      <!-- First-run mobile hint pointing at the palette FAB -->
      ${
        this.shouldShowPaletteHint
          ? html`
              <div class="v4-palette-hint" role="status">
                <span class="v4-palette-hint-text">
                  ${LanguageService.t('colorPalette.mobileHint')}
                </span>
                <button
                  class="v4-palette-hint-dismiss"
                  type="button"
                  aria-label="${LanguageService.t('aria.dismissHint')}"
                  @click=${this.dismissPaletteHint}
                >
                  &times;
                </button>
              </div>
            `
          : nothing
      }

      <!-- Tool-Options Toggle FAB (bottom-left; hidden while the panel is open) -->
      ${
        this.shouldShowOptions
          ? html`<button
              class="v4-options-toggle ${this.optionsCollapsed ? '' : 'panel-open'}"
              type="button"
              title="${LanguageService.t('common.options')}"
              aria-label="${LanguageService.t('common.options')}"
              aria-expanded=${!this.optionsCollapsed}
              @click=${this.toggleOptionsPanel}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
                />
              </svg>
            </button>`
          : nothing
      }

      <!-- Palette Drawer Toggle FAB (hidden when drawer is open or tool doesn't use palette) -->
      <button
        class="v4-palette-toggle ${this.paletteDrawerOpen ? 'drawer-open' : ''} ${
          !this.shouldShowPalette ? 'no-palette' : ''
        } ${this.shouldShowPaletteHint ? 'hinting' : ''}"
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
