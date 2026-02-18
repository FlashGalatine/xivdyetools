/**
 * XIV Dye Tools v4.0 - Glass Panel Component
 *
 * Reusable glassmorphism container component with optional header.
 * Provides frosted glass effect with backdrop blur for dark themes.
 *
 * @module components/v4/glass-panel
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';

/**
 * Styling variants for the glass panel
 */
export type GlassPanelVariant = 'default' | 'card' | 'sidebar';

/**
 * Padding options for the glass panel
 */
export type GlassPanelPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * V4 Glass Panel - Glassmorphism container component
 *
 * Uses CSS custom properties for theming:
 * - `--v4-glass-bg`: Background color with transparency
 * - `--v4-glass-blur`: Backdrop blur filter value
 * - `--v4-glass-border`: Border color
 * - `--v4-shadow-soft`: Box shadow
 *
 * @slot - Default slot for panel content
 * @slot header - Named slot for custom header content (overrides heading prop)
 *
 * @example
 * ```html
 * <v4-glass-panel heading="Settings" padding="md">
 *   <p>Panel content goes here</p>
 * </v4-glass-panel>
 *
 * <v4-glass-panel variant="card" interactive>
 *   <span slot="header">Custom Header</span>
 *   <p>Card content</p>
 * </v4-glass-panel>
 * ```
 */
@customElement('v4-glass-panel')
export class GlassPanel extends BaseLitComponent {
  /**
   * Optional heading text displayed at the top of the panel
   */
  @property({ type: String })
  heading?: string;

  /**
   * Styling variant
   */
  @property({ type: String, reflect: true })
  variant: GlassPanelVariant = 'default';

  /**
   * Internal padding size
   */
  @property({ type: String, reflect: true })
  padding: GlassPanelPadding = 'md';

  /**
   * Remove border styling
   */
  @property({ type: Boolean, reflect: true, attribute: 'no-border' })
  noBorder: boolean = false;

  /**
   * Add interactive hover effects (for clickable panels)
   */
  @property({ type: Boolean, reflect: true })
  interactive: boolean = false;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
      }

      .glass-panel-container {
        background: var(--v4-glass-bg, rgba(30, 30, 30, 0.7));
        backdrop-filter: var(--v4-glass-blur, blur(12px));
        -webkit-backdrop-filter: var(--v4-glass-blur, blur(12px));
        border: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        border-radius: 12px;
        overflow: hidden;
        transition:
          transform var(--v4-transition-fast, 150ms),
          box-shadow var(--v4-transition-fast, 150ms);
      }

      /* Variants */
      :host([variant='card']) .glass-panel-container {
        background: linear-gradient(
          to bottom,
          var(--theme-card-background, #2a2a2a),
          var(--v4-card-gradient-end, #1a1a1a)
        );
        border-radius: 8px;
      }

      :host([variant='sidebar']) .glass-panel-container {
        border-radius: 0;
        height: 100%;
      }

      /* No border variant */
      :host([no-border]) .glass-panel-container {
        border: none;
      }

      /* Interactive hover effects */
      :host([interactive]) .glass-panel-container {
        cursor: pointer;
      }

      :host([interactive]) .glass-panel-container:hover {
        transform: translateY(-2px);
        box-shadow: var(--v4-shadow-soft, 0 4px 24px rgba(0, 0, 0, 0.1));
      }

      :host([interactive]) .glass-panel-container:active {
        transform: translateY(0);
      }

      /* Padding variants */
      .glass-panel-content {
        padding: 16px;
      }

      :host([padding='none']) .glass-panel-content {
        padding: 0;
      }

      :host([padding='sm']) .glass-panel-content {
        padding: 8px;
      }

      :host([padding='lg']) .glass-panel-content {
        padding: 24px;
      }

      /* Header */
      .glass-panel-header {
        padding: 12px 16px;
        border-bottom: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        font-weight: 600;
        font-size: 14px;
        color: var(--theme-text, #e0e0e0);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      :host([padding='none']) .glass-panel-header {
        padding: 12px 16px;
      }

      :host([padding='sm']) .glass-panel-header {
        padding: 8px;
        font-size: 13px;
      }

      :host([padding='lg']) .glass-panel-header {
        padding: 16px 24px;
        font-size: 15px;
      }

      /* When header is present, adjust content padding top */
      .glass-panel-header + .glass-panel-content {
        padding-top: 12px;
      }

      :host([padding='none']) .glass-panel-header + .glass-panel-content {
        padding-top: 0;
      }

      /* Focus visible for accessibility */
      :host([interactive]) .glass-panel-container:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 2px;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .glass-panel-container {
          transition: none;
        }
        :host([interactive]) .glass-panel-container:hover {
          transform: none;
        }
        :host([interactive]) .glass-panel-container:active {
          transform: none;
        }
      }
    `,
  ];

  protected override render(): TemplateResult {
    const hasHeading = this.heading || this.querySelector('[slot="header"]');

    return html`
      <div
        class="glass-panel-container"
        role=${this.interactive ? 'button' : nothing}
        tabindex=${this.interactive ? '0' : nothing}
      >
        ${hasHeading
          ? html`
              <div class="glass-panel-header">
                <slot name="header">${this.heading}</slot>
              </div>
            `
          : nothing}
        <div class="glass-panel-content">
          <slot></slot>
        </div>
      </div>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-glass-panel': GlassPanel;
  }
}
