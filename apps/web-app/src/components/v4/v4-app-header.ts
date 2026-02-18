/**
 * XIV Dye Tools v4.0 - App Header Component
 *
 * 48px header with logo, title, and navigation controls (theme/language/about)
 * Lit-based component extending BaseLitComponent
 *
 * @module components/v4/v4-app-header
 */

import { html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import { ICON_GLOBE, ICON_ABOUT, ICON_THEME } from '@shared/ui-icons';
import { LOGO_SPARKLES } from '@shared/app-logo';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { LanguageService } from '@services/index';

/**
 * V4 App Header - Branded header with navigation controls
 *
 * @fires theme-click - When theme button is clicked
 * @fires language-click - When language button is clicked
 * @fires about-click - When about button is clicked
 *
 * @example
 * ```html
 * <v4-app-header
 *   @theme-click=${this.handleThemeClick}
 *   @language-click=${this.handleLanguageClick}
 *   @about-click=${this.handleAboutClick}
 * ></v4-app-header>
 * ```
 */
@customElement('v4-app-header')
export class V4AppHeader extends BaseLitComponent {
  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
        height: var(--v4-header-height, 48px);
      }

      .v4-app-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 100%;
        padding: 0 16px;
        background-color: var(--theme-primary, #8b1a1a);
        color: var(--theme-text-header, #ffffff);
        box-shadow: var(--v4-shadow-soft, 0 4px 6px rgba(0, 0, 0, 0.3));
        border-bottom: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
      }

      /* Logo Section */
      .v4-header-logo {
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 600;
        font-size: 16px;
        letter-spacing: 0.5px;
      }

      .v4-header-logo-icon {
        width: 28px;
        height: 28px;
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
        user-select: none;
      }

      /* Navigation Controls */
      .v4-header-nav {
        display: flex;
        align-items: center;
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
        transition:
          opacity var(--v4-transition-fast, 150ms),
          background-color var(--v4-transition-fast, 150ms);
      }

      .v4-header-nav-btn:hover {
        opacity: 1;
        background: rgba(255, 255, 255, 0.15);
      }

      .v4-header-nav-btn:focus-visible {
        opacity: 1;
        outline: 2px solid currentColor;
        outline-offset: 2px;
      }

      .v4-header-nav-btn:active {
        transform: scale(0.95);
      }

      .v4-header-nav-btn svg {
        width: 20px;
        height: 20px;
        stroke: currentColor;
      }

      /* Reduced motion */
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

  /**
   * Handle about button click
   */
  private handleAboutClick(): void {
    this.emit('about-click');
  }

  /**
   * Handle language button click
   */
  private handleLanguageClick(): void {
    this.emit('language-click');
  }

  /**
   * Handle theme button click
   */
  private handleThemeClick(): void {
    this.emit('theme-click');
  }

  protected override render(): TemplateResult {
    return html`
      <header class="v4-app-header" role="banner">
        <!-- Logo Section -->
        <div class="v4-header-logo">
          <span class="v4-header-logo-icon" aria-hidden="true"> ${unsafeHTML(LOGO_SPARKLES)} </span>
          <span class="v4-header-logo-text">XIV Dye Tools</span>
        </div>

        <!-- Navigation Controls -->
        <nav class="v4-header-nav" aria-label="${LanguageService.t('aria.headerNavigation')}">
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
            ${unsafeHTML(ICON_GLOBE)}
          </button>

          <button
            class="v4-header-nav-btn"
            type="button"
            title="${LanguageService.t('header.theme')}"
            aria-label="${LanguageService.t('header.theme')}"
            @click=${this.handleThemeClick}
          >
            ${unsafeHTML(ICON_THEME)}
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
