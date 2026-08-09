/**
 * XIV Dye Tools 5.0 - Console App Bar
 *
 * The 1A/2B console bar: brand + tool title-menu on the left (the switcher —
 * tapping the current tool opens a two-column menu of all nine tools with
 * one-line descriptions; no persistent tool rail), and the chrome cluster on
 * the right (What's New · About · locale code · theme · Advanced gear). Sits
 * on the console ground with a hairline bottom border — never the accent wash.
 *
 * 3F responsive locale chrome: globe + locale code on desktop, the mono code
 * alone on mobile.
 *
 * @fires tool-select - When a tool is picked from the title menu ({ toolId })
 * @fires changelog-click / about-click / language-click / theme-click / advanced-click
 *
 * @module components/v4/v4-app-header
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import {
  ICON_GLOBE,
  ICON_ABOUT,
  ICON_THEME_SUN,
  ICON_THEME_MOON,
  ICON_SCROLL,
  ICON_SETTINGS,
} from '@shared/ui-icons';
import { TOOL_ICONS } from '@shared/tool-icons';
import { LOGO_SPARKLES } from '@shared/app-logo';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LanguageService } from '@services/index';
import { ThemeService } from '@services/theme-service';
import type { ToolId } from '@services/router-service';

/** Display order + translation key prefixes (matcher/character are the 4.x key names). */
const TOOL_MENU: Array<{ id: ToolId; translationKey: string }> = [
  { id: 'harmony', translationKey: 'tools.harmony' },
  { id: 'extractor', translationKey: 'tools.matcher' },
  { id: 'accessibility', translationKey: 'tools.accessibility' },
  { id: 'comparison', translationKey: 'tools.comparison' },
  { id: 'gradient', translationKey: 'tools.gradient' },
  { id: 'mixer', translationKey: 'tools.mixer' },
  { id: 'presets', translationKey: 'tools.presets' },
  { id: 'budget', translationKey: 'tools.budget' },
  { id: 'swatch', translationKey: 'tools.character' },
];

@customElement('v4-app-header')
export class V4AppHeader extends BaseLitComponent {
  /** Currently active tool (drives the title-menu button). */
  @property({ type: String, attribute: 'active-tool' })
  activeTool: ToolId = 'harmony';

  @state()
  private toolMenuOpen = false;

  private languageUnsubscribe: (() => void) | null = null;
  private themeUnsubscribe: (() => void) | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.languageUnsubscribe = LanguageService.subscribe(() => this.requestUpdate());
    this.themeUnsubscribe = ThemeService.subscribe(() => this.requestUpdate());
    document.addEventListener('keydown', this.handleKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
    this.themeUnsubscribe?.();
    this.themeUnsubscribe = null;
    document.removeEventListener('keydown', this.handleKeydown);
  }

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
        height: var(--v4-header-height, 54px);
      }

      .v4-app-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        height: 100%;
        padding: 0 16px;
        background-color: var(--theme-background, #0b0b0c);
        color: var(--theme-text, #ececee);
        border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.12));
      }

      /* Brand + tool menu */
      .v4-header-left {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }

      .v4-header-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-shrink: 0;
      }

      .v4-header-logo-icon {
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .v4-header-logo-icon svg {
        width: 100%;
        height: 100%;
      }

      .v4-header-logo-text {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        font-size: 15px;
        white-space: nowrap;
        user-select: none;
      }

      .tool-menu-wrap {
        position: relative;
        min-width: 0;
      }

      .tool-menu-btn {
        display: flex;
        align-items: center;
        gap: 9px;
        height: 36px;
        padding: 0 12px;
        border-radius: 9px;
        cursor: pointer;
        font-family: inherit;
        background: var(--theme-background-secondary, rgba(255, 255, 255, 0.06));
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.12));
        color: inherit;
        min-width: 0;
        max-width: 100%;
      }

      .tool-menu-btn:hover {
        border-color: var(--theme-primary, #ea4133);
      }

      .tool-menu-btn:focus-visible {
        outline: 2px solid var(--theme-primary, #ea4133);
        outline-offset: 2px;
      }

      .tool-menu-btn .glyph {
        display: block;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        color: var(--theme-primary, #ea4133);
      }

      .tool-menu-btn .glyph svg {
        width: 100%;
        height: 100%;
      }

      .tool-menu-btn .label {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 600;
        font-size: 13.5px;
        color: var(--theme-text, #ececee);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        min-width: 0;
      }

      .tool-menu-btn .caret {
        font-size: 9px;
        color: var(--theme-text-muted, #9c9ca2);
        flex-shrink: 0;
      }

      /* Backdrop closes the menu */
      .tool-menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 90;
        background: transparent;
        border: none;
        padding: 0;
        cursor: default;
      }

      .tool-menu {
        position: absolute;
        top: 42px;
        left: 0;
        z-index: 100;
        width: min(460px, calc(100vw - 24px));
        padding: 8px;
        border-radius: 14px;
        background: var(--theme-background-secondary, #141416);
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.12));
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 5px;
      }

      .tool-menu-item {
        display: flex;
        align-items: center;
        gap: 9px;
        min-height: 44px;
        padding: 8px 10px;
        border-radius: 9px;
        cursor: pointer;
        font-family: inherit;
        text-align: left;
        background: transparent;
        border: 1px solid transparent;
        color: inherit;
        min-width: 0;
      }

      .tool-menu-item:hover,
      .tool-menu-item:focus-visible {
        border-color: var(--theme-primary, #ea4133);
        outline: none;
      }

      .tool-menu-item.active {
        background: var(--theme-card-background, rgba(255, 255, 255, 0.05));
        border-color: var(--theme-primary, #ea4133);
      }

      .tool-menu-item .glyph {
        display: block;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        color: var(--theme-primary, #ea4133);
      }

      .tool-menu-item .glyph svg {
        width: 100%;
        height: 100%;
      }

      .tool-menu-item .text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .tool-menu-item .name {
        font-size: 12.5px;
        font-weight: 600;
        color: var(--theme-text, #ececee);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .tool-menu-item .desc {
        font-size: 10px;
        color: var(--theme-text-muted, #9c9ca2);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Right chrome cluster */
      .v4-header-nav {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .v4-header-nav-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 32px;
        height: 32px;
        padding: 0 6px;
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.12));
        border-radius: 8px;
        background: var(--theme-background-secondary, rgba(255, 255, 255, 0.06));
        color: var(--theme-text-muted, #9c9ca2);
        cursor: pointer;
        transition:
          color var(--v4-transition-fast, 150ms),
          border-color var(--v4-transition-fast, 150ms);
      }

      .v4-header-nav-btn:hover {
        color: var(--theme-text, #ececee);
        border-color: var(--theme-primary, #ea4133);
      }

      .v4-header-nav-btn:focus-visible {
        outline: 2px solid var(--theme-primary, #ea4133);
        outline-offset: 2px;
      }

      .v4-header-nav-btn:active {
        transform: scale(0.95);
      }

      .v4-header-nav-btn svg {
        width: 18px;
        height: 18px;
        stroke: currentColor;
      }

      .lang-code {
        font-family: 'Fragment Mono', ui-monospace, monospace;
        font-size: 11px;
        letter-spacing: 0.5px;
      }

      @media (max-width: 768px) {
        .v4-header-logo-text {
          display: none;
        }

        /* 3F: mobile drops the globe — the mono code alone is the control */
        .lang-globe {
          display: none;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .v4-header-nav-btn {
          transition: none;
        }
        .v4-header-nav-btn:active {
          transform: none;
        }
      }
    `,
  ];

  private handleKeydown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.toolMenuOpen) {
      this.toolMenuOpen = false;
    }
  };

  private toggleToolMenu(): void {
    this.toolMenuOpen = !this.toolMenuOpen;
  }

  private closeToolMenu(): void {
    this.toolMenuOpen = false;
  }

  private selectTool(toolId: ToolId): void {
    this.toolMenuOpen = false;
    if (toolId !== this.activeTool) {
      this.emit('tool-select', { toolId });
    }
  }

  private handleChangelogClick(): void {
    this.emit('changelog-click');
  }

  private handleAboutClick(): void {
    this.emit('about-click');
  }

  private handleLanguageClick(): void {
    this.emit('language-click');
  }

  private handleThemeClick(): void {
    this.emit('theme-click');
  }

  private handleAdvancedClick(): void {
    this.emit('advanced-click');
  }

  private renderToolMenu(): TemplateResult {
    return html`
      <button
        class="tool-menu-backdrop"
        aria-hidden="true"
        tabindex="-1"
        @click=${this.closeToolMenu}
      ></button>
      <div class="tool-menu" role="menu" aria-label="${LanguageService.t('aria.toolSelection')}">
        ${TOOL_MENU.map((tool) => {
          const name = LanguageService.t(`${tool.translationKey}.title`);
          const desc = LanguageService.t(`${tool.translationKey}.description`);
          return html`
            <button
              class="tool-menu-item ${tool.id === this.activeTool ? 'active' : ''}"
              role="menuitem"
              title=${desc}
              @click=${(): void => this.selectTool(tool.id)}
            >
              <span class="glyph" aria-hidden="true">${unsafeHTML(TOOL_ICONS[tool.id])}</span>
              <span class="text">
                <span class="name">${name}</span>
                <span class="desc">${desc}</span>
              </span>
            </button>
          `;
        })}
      </div>
    `;
  }

  protected override render(): TemplateResult {
    const activeDef = TOOL_MENU.find((t) => t.id === this.activeTool) ?? TOOL_MENU[0];
    const activeName = LanguageService.t(`${activeDef.translationKey}.title`);
    const localeCode = LanguageService.getCurrentLocale().toUpperCase();
    const themeIcon = ThemeService.isDarkMode() ? ICON_THEME_MOON : ICON_THEME_SUN;

    return html`
      <header class="v4-app-header" role="banner">
        <div class="v4-header-left">
          <div class="v4-header-logo">
            <span class="v4-header-logo-icon" aria-hidden="true">${unsafeHTML(LOGO_SPARKLES)}</span>
            <span class="v4-header-logo-text">XIV Dye Tools</span>
          </div>

          <div class="tool-menu-wrap">
            <button
              class="tool-menu-btn"
              type="button"
              aria-haspopup="menu"
              aria-expanded=${this.toolMenuOpen}
              title="${LanguageService.t('aria.toolSelection')}"
              @click=${this.toggleToolMenu}
            >
              <span class="glyph" aria-hidden="true"
                >${unsafeHTML(TOOL_ICONS[this.activeTool])}</span
              >
              <span class="label">${activeName}</span>
              <span class="caret" aria-hidden="true">▾</span>
            </button>
            ${this.toolMenuOpen ? this.renderToolMenu() : nothing}
          </div>
        </div>

        <nav class="v4-header-nav" aria-label="${LanguageService.t('aria.headerNavigation')}">
          <button
            class="v4-header-nav-btn"
            type="button"
            title="${LanguageService.t('changelog.title')}"
            aria-label="${LanguageService.t('changelog.title')}"
            @click=${this.handleChangelogClick}
          >
            ${unsafeHTML(ICON_SCROLL)}
          </button>

          <button
            class="v4-header-nav-btn"
            type="button"
            title="${LanguageService.t('header.about')}"
            aria-label="${LanguageService.t('header.about')}"
            @click=${this.handleAboutClick}
          >
            ${unsafeHTML(ICON_ABOUT)}
          </button>

          <button
            class="v4-header-nav-btn"
            type="button"
            title="${LanguageService.t('header.language')}"
            aria-label="${LanguageService.t('header.language')}"
            @click=${this.handleLanguageClick}
          >
            <span class="lang-globe" aria-hidden="true">${unsafeHTML(ICON_GLOBE)}</span>
            <span class="lang-code">${localeCode}</span>
          </button>

          <button
            class="v4-header-nav-btn"
            type="button"
            title="${LanguageService.t('header.theme')}"
            aria-label="${LanguageService.t('header.theme')}"
            @click=${this.handleThemeClick}
          >
            ${unsafeHTML(themeIcon)}
          </button>

          <button
            class="v4-header-nav-btn"
            type="button"
            title="${LanguageService.t('config.advancedSettings')}"
            aria-label="${LanguageService.t('config.advancedSettings')}"
            @click=${this.handleAdvancedClick}
          >
            ${unsafeHTML(ICON_SETTINGS)}
          </button>
        </nav>
      </header>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-app-header': V4AppHeader;
  }
}
