/**
 * XIV Dye Tools v4.0 - Share Button Component
 *
 * Button component for generating and copying shareable deep-link URLs.
 * Supports all tools with OpenGraph-ready URL generation.
 *
 * @module components/v4/share-button
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import { ShareService, type ShareParams } from '@services/share-service';
import type { ToolId } from '@services/router-service';
import { LanguageService } from '@services/index';

/**
 * Share icon SVG (Material Design share icon)
 */
const SHARE_ICON = html`
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
`;

/**
 * Check icon for copied state
 */
const CHECK_ICON = html`
  <svg
    class="icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
`;

/**
 * V4 Share Button - Copies shareable URL to clipboard
 *
 * Uses CSS custom properties for theming:
 * - `--theme-primary`: Accent color
 * - `--v4-glass-bg`: Background color
 * - `--v4-transition-fast`: Animation duration
 *
 * @fires share - Emits when share is successful
 *   - `detail.url`: The generated URL
 *   - `detail.title`: The share title
 *   - `detail.tool`: The tool ID
 *
 * @example
 * ```html
 * <v4-share-button
 *   .tool=${'harmony'}
 *   .shareParams=${{ dye: 48227, harmony: 'Complementary' }}
 * ></v4-share-button>
 *
 * <!-- Compact mode for tight spaces -->
 * <v4-share-button
 *   .tool=${'mixer'}
 *   .shareParams=${{ dyeA: 123, dyeB: 456, ratio: 50 }}
 *   compact
 * ></v4-share-button>
 * ```
 */
@customElement('v4-share-button')
export class ShareButton extends BaseLitComponent {
  /**
   * The tool being shared
   */
  @property({ type: String })
  tool: ToolId = 'harmony';

  /**
   * Tool-specific parameters for the share URL
   */
  @property({ type: Object })
  shareParams: Record<string, unknown> = {};

  /**
   * Compact mode - icon only, no text
   */
  @property({ type: Boolean, reflect: true })
  compact: boolean = false;

  /**
   * Disabled state - prevents interaction
   */
  @property({ type: Boolean, reflect: true })
  disabled: boolean = false;

  /**
   * Custom button label
   */
  @property({ type: String })
  label?: string;

  /**
   * Whether the button is currently in "copied" state
   */
  @state()
  private isCopied: boolean = false;

  /**
   * Loading state during copy operation
   */
  @state()
  private isLoading: boolean = false;

  /**
   * Timeout reference for copied state reset
   */
  private copiedTimeout?: ReturnType<typeof setTimeout>;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: inline-flex;
      }

      button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 8px 16px;
        background: var(--v4-glass-bg, rgba(30, 30, 30, 0.7));
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.1));
        border-radius: 8px;
        color: var(--theme-text, #e0e0e0);
        font-family: var(--font-body, 'Onest', sans-serif);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition:
          background-color var(--v4-transition-fast, 150ms),
          border-color var(--v4-transition-fast, 150ms),
          transform var(--v4-transition-fast, 150ms),
          box-shadow var(--v4-transition-fast, 150ms);
        white-space: nowrap;
      }

      :host([compact]) button {
        padding: 8px;
        gap: 0;
      }

      button:hover:not(:disabled) {
        background: var(--theme-card-hover, rgba(255, 255, 255, 0.1));
        border-color: var(--theme-primary, #d4af37);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      }

      button:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: none;
      }

      button:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 2px;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Copied state */
      button.copied {
        background: var(--v4-success-bg, rgba(76, 175, 80, 0.2));
        border-color: var(--v4-success, #4caf50);
        color: var(--v4-success, #4caf50);
      }

      /* Loading state */
      button.loading {
        pointer-events: none;
      }

      .icon {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        transition: transform var(--v4-transition-fast, 150ms);
      }

      button.copied .icon {
        transform: scale(1.1);
      }

      .label {
        /* Fade in/out for text changes */
        transition: opacity var(--v4-transition-fast, 150ms);
      }

      button.loading .label {
        opacity: 0.7;
      }

      /* Spinner for loading state */
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      button.loading .icon {
        animation: spin 1s linear infinite;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        button,
        .icon,
        .label {
          transition: none;
        }

        button.loading .icon {
          animation: none;
        }
      }
    `,
  ];

  disconnectedCallback(): void {
    super.disconnectedCallback();
    // Clean up timeout on unmount
    if (this.copiedTimeout) {
      clearTimeout(this.copiedTimeout);
    }
  }

  /**
   * Handle share button click
   */
  private async handleShare(): Promise<void> {
    if (this.disabled || this.isLoading) return;

    this.isLoading = true;

    try {
      // Build share data
      const shareData: ShareParams = {
        tool: this.tool,
        params: this.shareParams,
      } as ShareParams;

      // Validate params
      const errors = ShareService.validateShareParams(shareData);
      if (errors.length > 0) {
        this.setError(`Invalid share params: ${errors.join(', ')}`);
        this.isLoading = false;
        return;
      }

      // Generate and copy URL
      const result = await ShareService.shareAndCopy(shareData);

      if (result) {
        // Show copied state
        this.isCopied = true;

        // Emit share event
        this.emit('share', {
          url: result.url,
          title: result.title,
          tool: result.tool,
        });

        // Reset copied state after delay
        if (this.copiedTimeout) {
          clearTimeout(this.copiedTimeout);
        }
        this.copiedTimeout = setTimeout(() => {
          this.isCopied = false;
        }, 2000);
      }
    } catch (error) {
      this.setError('Failed to share', error as Error);
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Get the button label text
   */
  private getLabel(): string {
    if (this.isCopied) {
      return LanguageService.t('share.copied') || 'Copied!';
    }
    if (this.label) {
      return this.label;
    }
    return LanguageService.t('share.button') || 'Share';
  }

  protected override render(): TemplateResult {
    const buttonClass = [this.isCopied ? 'copied' : '', this.isLoading ? 'loading' : '']
      .filter(Boolean)
      .join(' ');

    const icon = this.isCopied ? CHECK_ICON : SHARE_ICON;
    const label = this.getLabel();
    const ariaLabel = this.compact ? label : undefined;

    return html`
      <button
        class=${buttonClass}
        ?disabled=${this.disabled}
        @click=${this.handleShare}
        title=${label}
        aria-label=${ariaLabel || nothing}
      >
        ${icon} ${!this.compact ? html`<span class="label">${label}</span>` : nothing}
      </button>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-share-button': ShareButton;
  }
}
