/**
 * XIV Dye Tools v4.0 - Preset Card Component
 *
 * Displays a preset in the community presets grid.
 * Features color swatches, category icon, vote count, and community badge.
 *
 * @module components/v4/preset-card
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseLitComponent } from './base-lit-component';
import { getCategoryIcon } from '@shared/category-icons';
import { ICON_STAR } from '@shared/ui-icons';
import type { UnifiedPreset } from '@services/hybrid-preset-service';

/**
 * Data structure for the preset card
 */
export interface PresetCardData {
  /** The preset being displayed */
  preset: UnifiedPreset;
  /** Resolved hex colors from the preset's dyes */
  colors: string[];
}

/**
 * V4 Preset Card - Community preset display in grid
 *
 * @fires preset-select - Emits when the card is clicked
 *   - `detail.preset`: The selected preset
 *
 * @example
 * ```html
 * <v4-preset-card
 *   .data=${{ preset: somePreset, colors: ['#ff0000', '#00ff00'] }}
 *   @preset-select=${(e) => this.handleSelect(e.detail.preset)}
 * ></v4-preset-card>
 * ```
 */
@customElement('v4-preset-card')
export class PresetCard extends BaseLitComponent {
  /**
   * Card data containing preset info and resolved colors
   */
  @property({ attribute: false })
  data?: PresetCardData;

  /**
   * Selected state styling
   */
  @property({ type: Boolean, reflect: true })
  selected: boolean = false;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
        width: var(--v4-preset-card-width, 280px);
      }

      .preset-card {
        background: linear-gradient(
          to bottom,
          var(--theme-card-background, #2a2a2a),
          var(--v4-card-gradient-end, #151515)
        );
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        transition:
          transform var(--v4-transition-fast, 150ms),
          box-shadow var(--v4-transition-fast, 150ms),
          border-color var(--v4-transition-fast, 150ms);
        position: relative;
      }

      .preset-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.4);
        border-color: var(--theme-text-muted, #888888);
      }

      :host([selected]) .preset-card {
        border-color: var(--theme-primary, #d4af37);
        box-shadow: 0 0 0 2px var(--theme-primary, #d4af37);
      }

      /* Color swatch strip */
      .color-strip {
        display: flex;
        height: 64px;
        width: 100%;
      }

      .color-swatch {
        flex: 1;
        height: 100%;
      }

      /* Content section */
      .preset-content {
        padding: 16px;
      }

      /* Community badge */
      .community-badge {
        display: inline-block;
        background: rgba(99, 102, 241, 0.2);
        color: #818cf8;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }

      /* Header with icon, name, and votes */
      .preset-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .category-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        color: var(--theme-text-muted, #888888);
      }

      .category-icon svg {
        width: 100%;
        height: 100%;
      }

      .preset-name {
        flex: 1;
        font-weight: 700;
        font-size: 14px;
        color: var(--theme-text, #e0e0e0);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .vote-badge {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 600;
        color: var(--theme-primary, #d4af37);
        flex-shrink: 0;
      }

      .vote-badge svg {
        width: 14px;
        height: 14px;
        fill: currentColor;
      }

      /* Description */
      .preset-description {
        font-size: 12px;
        color: var(--theme-text-muted, #888888);
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        margin: 0;
      }

      /* Footer */
      .preset-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 12px;
        font-size: 11px;
        color: var(--theme-text-muted, #888888);
      }

      .dye-count {
        opacity: 0.7;
      }

      .author {
        opacity: 0.7;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 120px;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .preset-card {
          transition: none;
        }
        .preset-card:hover {
          transform: none;
        }
      }
    `,
  ];

  /**
   * Handle card click - emit preset-select event
   */
  private handleClick(): void {
    if (this.data) {
      this.emit<{ preset: UnifiedPreset }>('preset-select', {
        preset: this.data.preset,
      });
    }
  }

  protected override render(): TemplateResult {
    if (!this.data) {
      return html`<div class="preset-card">No data</div>`;
    }

    const { preset, colors } = this.data;

    return html`
      <article
        class="preset-card"
        role="button"
        tabindex="0"
        aria-label="Preset: ${preset.name}"
        @click=${this.handleClick}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.handleClick();
          }
        }}
      >
        <!-- Color swatch strip -->
        <div class="color-strip">
          ${colors.map(
            (color) => html` <div class="color-swatch" style="background-color: ${color}"></div> `
          )}
        </div>

        <!-- Content -->
        <div class="preset-content">
          <!-- Community badge for non-curated presets -->
          ${!preset.isCurated ? html` <div class="community-badge">Community</div> ` : nothing}

          <!-- Header with category icon, name, and votes -->
          <div class="preset-header">
            <span class="category-icon"> ${unsafeHTML(getCategoryIcon(preset.category))} </span>
            <span class="preset-name">${preset.name}</span>
            ${preset.voteCount > 0
              ? html`
                  <span class="vote-badge">
                    ${unsafeHTML(ICON_STAR)}
                    <span>${preset.voteCount}</span>
                  </span>
                `
              : nothing}
          </div>

          <!-- Description -->
          <p class="preset-description">${preset.description}</p>

          <!-- Footer -->
          <div class="preset-footer">
            <span class="dye-count">${preset.dyes.length} dyes</span>
            ${preset.author ? html`<span class="author">by ${preset.author}</span>` : nothing}
          </div>
        </div>
      </article>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-preset-card': PresetCard;
  }
}
