/**
 * XIV Dye Tools v4.0 - Display Options Component
 *
 * Shared component for controlling result display options.
 * Used across tools for consistent color format and metadata visibility.
 *
 * @module components/v4/display-options-v4
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import type { DisplayOptionsConfig } from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';
import { LanguageService } from '../../services/language-service';

// Import toggle switch for internal use
import './toggle-switch-v4';

/**
 * Option group identifiers
 */
export type OptionGroup = 'colorFormats' | 'resultMetadata' | 'custom';

/**
 * Event detail for display-options-change event
 */
export interface DisplayOptionsChangeDetail {
  /** The option key that changed */
  option: keyof DisplayOptionsConfig;
  /** The new value */
  value: boolean;
  /** All current option values */
  allOptions: DisplayOptionsConfig;
}

/**
 * V4 Display Options - Shared configuration toggles
 *
 * Controls visibility of color formats (Hex, RGB, HSV, LAB) and result
 * metadata (Price, Delta-E, Acquisition) in result cards.
 *
 * @fires display-options-change - Emits when any option changes
 *   - `detail.option`: The option key that changed
 *   - `detail.value`: The new boolean value
 *   - `detail.allOptions`: All current option values
 *
 * @slot custom-options - Slot for tool-specific options (e.g., Perceptual Matching)
 *
 * @example
 * ```html
 * <v4-display-options
 *   .showHex=${true}
 *   .showRgb=${false}
 *   .showHsv=${true}
 *   .showLab=${false}
 *   .visibleGroups=${['colorFormats', 'resultMetadata']}
 *   @display-options-change=${this.handleChange}
 * >
 *   <div slot="custom-options">
 *     <v4-toggle-switch
 *       label="Perceptual Matching"
 *       .checked=${this.strictMatching}
 *       @toggle-change=${this.handleStrictMatchingChange}
 *     ></v4-toggle-switch>
 *   </div>
 * </v4-display-options>
 * ```
 */
@customElement('v4-display-options')
export class DisplayOptionsV4 extends BaseLitComponent {
  // ========== Color Format Options ==========

  /**
   * Show HEX color codes in results
   */
  @property({ type: Boolean, attribute: 'show-hex' })
  showHex: boolean = DEFAULT_DISPLAY_OPTIONS.showHex;

  /**
   * Show RGB values in results
   */
  @property({ type: Boolean, attribute: 'show-rgb' })
  showRgb: boolean = DEFAULT_DISPLAY_OPTIONS.showRgb;

  /**
   * Show HSV values in results
   */
  @property({ type: Boolean, attribute: 'show-hsv' })
  showHsv: boolean = DEFAULT_DISPLAY_OPTIONS.showHsv;

  /**
   * Show LAB values in results
   */
  @property({ type: Boolean, attribute: 'show-lab' })
  showLab: boolean = DEFAULT_DISPLAY_OPTIONS.showLab;

  // ========== Result Metadata Options ==========

  /**
   * Show market prices in results
   */
  @property({ type: Boolean, attribute: 'show-price' })
  showPrice: boolean = DEFAULT_DISPLAY_OPTIONS.showPrice;

  /**
   * Show Delta-E color distance in results
   */
  @property({ type: Boolean, attribute: 'show-delta-e' })
  showDeltaE: boolean = DEFAULT_DISPLAY_OPTIONS.showDeltaE;

  /**
   * Show acquisition source information in results
   */
  @property({ type: Boolean, attribute: 'show-acquisition' })
  showAcquisition: boolean = DEFAULT_DISPLAY_OPTIONS.showAcquisition;

  // ========== Configuration ==========

  /**
   * Which option groups to display
   * Defaults to showing all groups
   */
  @property({ type: Array, attribute: false })
  visibleGroups: OptionGroup[] = ['colorFormats', 'resultMetadata', 'custom'];

  /**
   * Whether to show group headers/labels
   */
  @property({ type: Boolean, attribute: 'show-labels' })
  showLabels: boolean = true;

  /**
   * Whether sections can be collapsed
   */
  @property({ type: Boolean, attribute: 'collapsible' })
  collapsible: boolean = true;

  // ========== Collapsed State ==========

  /**
   * Whether the color formats section is collapsed
   */
  @state()
  private colorFormatsCollapsed: boolean = false;

  /**
   * Whether the result metadata section is collapsed
   */
  @state()
  private resultMetadataCollapsed: boolean = false;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
      }

      .display-options {
        display: flex;
        flex-direction: column;
        gap: var(--v4-display-options-group-gap, 20px);
      }

      .option-group {
        display: flex;
        flex-direction: column;
        gap: var(--v4-display-options-gap, 12px);
      }

      .option-group-label {
        font-family: 'Space Grotesk', sans-serif;
        font-size: var(--v4-display-options-label-size, 11px);
        color: var(--v4-display-options-label-color, var(--theme-text-muted, #888888));
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 500;
        margin-bottom: 4px;
      }

      /* Collapsible header styles */
      .option-group-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
        padding: 4px 0;
        margin-bottom: 4px;
        border-radius: 4px;
        transition: background-color 150ms ease;
      }

      .option-group-header:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }

      .option-group-header .option-group-label {
        margin-bottom: 0;
      }

      .collapse-icon {
        font-size: 10px;
        color: var(--theme-text-muted, #888888);
        transition: transform 150ms ease;
        margin-right: 4px;
      }

      .collapse-icon.collapsed {
        transform: rotate(180deg);
      }

      /* Collapsible content */
      .option-group-content {
        display: flex;
        flex-direction: column;
        gap: var(--v4-display-options-gap, 12px);
        overflow: hidden;
        max-height: 500px;
        transition:
          max-height 200ms ease-out,
          opacity 150ms ease;
        opacity: 1;
      }

      .option-group-content.collapsed {
        max-height: 0;
        opacity: 0;
        pointer-events: none;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .option-group-header,
        .collapse-icon,
        .option-group-content {
          transition: none;
        }
      }

      .option-row {
        display: flex;
        align-items: center;
      }

      /* Slot styling */
      .custom-slot-wrapper {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      ::slotted(*) {
        /* Ensure slotted content matches option row styling */
      }
    `,
  ];

  /**
   * Get current options as a DisplayOptionsConfig object
   */
  private getCurrentOptions(): DisplayOptionsConfig {
    return {
      showHex: this.showHex,
      showRgb: this.showRgb,
      showHsv: this.showHsv,
      showLab: this.showLab,
      showPrice: this.showPrice,
      showDeltaE: this.showDeltaE,
      showAcquisition: this.showAcquisition,
    };
  }

  /**
   * Handle option change from toggle switch
   */
  private handleOptionChange(option: keyof DisplayOptionsConfig, checked: boolean): void {
    // Update local property
    (this as unknown as Record<string, boolean>)[option] = checked;

    // Emit change event
    this.emit<DisplayOptionsChangeDetail>('display-options-change', {
      option,
      value: checked,
      allOptions: this.getCurrentOptions(),
    });
  }

  /**
   * Check if a group should be rendered
   */
  private shouldShowGroup(group: OptionGroup): boolean {
    return this.visibleGroups.includes(group);
  }

  /**
   * Toggle collapsed state for a section
   */
  private toggleSection(section: 'colorFormats' | 'resultMetadata'): void {
    if (!this.collapsible) return;

    if (section === 'colorFormats') {
      this.colorFormatsCollapsed = !this.colorFormatsCollapsed;
    } else if (section === 'resultMetadata') {
      this.resultMetadataCollapsed = !this.resultMetadataCollapsed;
    }
  }

  /**
   * Render a collapsible section header
   */
  private renderSectionHeader(
    label: string,
    collapsed: boolean,
    onToggle: () => void
  ): TemplateResult {
    if (!this.showLabels) return html``;

    if (this.collapsible) {
      return html`
        <div
          class="option-group-header"
          @click=${onToggle}
          role="button"
          aria-expanded=${!collapsed}
          tabindex="0"
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
        >
          <div class="option-group-label">${label}</div>
          <span class="collapse-icon ${collapsed ? 'collapsed' : ''}"
            >${collapsed ? '▼' : '▲'}</span
          >
        </div>
      `;
    }

    return html`<div class="option-group-label">${label}</div>`;
  }

  /**
   * Render color formats group (Hex, RGB, HSV, LAB)
   */
  private renderColorFormatsGroup(): TemplateResult {
    return html`
      <div class="option-group">
        ${this.renderSectionHeader(
          LanguageService.t('config.colorFormats'),
          this.colorFormatsCollapsed,
          () => this.toggleSection('colorFormats')
        )}
        <div class="option-group-content ${this.colorFormatsCollapsed ? 'collapsed' : ''}">
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.hexCodes')}
              .checked=${this.showHex}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleOptionChange('showHex', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.rgbValues')}
              .checked=${this.showRgb}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleOptionChange('showRgb', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.hsvValues')}
              .checked=${this.showHsv}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleOptionChange('showHsv', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.labValues')}
              .checked=${this.showLab}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleOptionChange('showLab', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render result metadata group (Price, Delta-E, Acquisition)
   */
  private renderResultMetadataGroup(): TemplateResult {
    return html`
      <div class="option-group">
        ${this.renderSectionHeader(
          LanguageService.t('config.resultDetails'),
          this.resultMetadataCollapsed,
          () => this.toggleSection('resultMetadata')
        )}
        <div class="option-group-content ${this.resultMetadataCollapsed ? 'collapsed' : ''}">
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.showPrices')}
              .checked=${this.showPrice}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleOptionChange('showPrice', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.showDeltaE')}
              .checked=${this.showDeltaE}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleOptionChange('showDeltaE', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="option-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.showAcquisition')}
              .checked=${this.showAcquisition}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleOptionChange('showAcquisition', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render custom options slot
   */
  private renderCustomSlot(): TemplateResult {
    return html`
      <div class="custom-slot-wrapper">
        <slot name="custom-options"></slot>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    return html`
      <div class="display-options">
        ${this.shouldShowGroup('colorFormats') ? this.renderColorFormatsGroup() : nothing}
        ${this.shouldShowGroup('resultMetadata') ? this.renderResultMetadataGroup() : nothing}
        ${this.shouldShowGroup('custom') ? this.renderCustomSlot() : nothing}
      </div>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-display-options': DisplayOptionsV4;
  }
}
