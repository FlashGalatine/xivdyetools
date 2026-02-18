/**
 * XIV Dye Tools v4.0 - Range Slider Component
 *
 * Enhanced range slider with value display and theme integration.
 * Designed for configuration panels like max results, color count, etc.
 *
 * @module components/v4/range-slider-v4
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import { LanguageService } from '@services/index';

/**
 * V4 Range Slider - Enhanced slider with value display
 *
 * Uses CSS custom properties for theming:
 * - `--theme-primary`: Slider thumb and filled track color
 * - `--v4-transition-fast`: Animation duration
 *
 * @fires slider-change - Emits when value changes (on release)
 *   - `detail.value`: The new value (number)
 * @fires slider-input - Emits during dragging
 *   - `detail.value`: The current value (number)
 *
 * @example
 * ```html
 * <v4-range-slider
 *   label="Max Colors"
 *   .value=${5}
 *   .min=${3}
 *   .max=${10}
 *   @slider-change=${(e) => this.maxColors = e.detail.value}
 * ></v4-range-slider>
 *
 * <v4-range-slider
 *   label="Opacity"
 *   .value=${0.8}
 *   .min=${0}
 *   .max=${1}
 *   .step=${0.1}
 *   .valueFormatter=${(v) => `${Math.round(v * 100)}%`}
 * ></v4-range-slider>
 * ```
 */
@customElement('v4-range-slider')
export class RangeSliderV4 extends BaseLitComponent {
  /**
   * Current value
   */
  @property({ type: Number })
  value: number = 0;

  /**
   * Minimum value
   */
  @property({ type: Number })
  min: number = 0;

  /**
   * Maximum value
   */
  @property({ type: Number })
  max: number = 100;

  /**
   * Step increment
   */
  @property({ type: Number })
  step: number = 1;

  /**
   * Label text displayed above the slider
   */
  @property({ type: String })
  label?: string;

  /**
   * Show the current value display
   */
  @property({ type: Boolean, attribute: 'show-value' })
  showValue: boolean = true;

  /**
   * Disabled state
   */
  @property({ type: Boolean, reflect: true })
  disabled: boolean = false;

  /**
   * Form field name
   */
  @property({ type: String })
  name?: string;

  /**
   * Custom value formatter function
   */
  @property({ attribute: false })
  valueFormatter?: (value: number) => string;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
      }

      .slider-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      :host([disabled]) .slider-wrapper {
        opacity: 0.5;
        pointer-events: none;
      }

      .slider-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .slider-label {
        font-size: 13px;
        color: var(--theme-text, #e0e0e0);
        font-weight: 500;
      }

      .slider-value {
        font-size: 13px;
        font-weight: 600;
        color: var(--theme-primary, #d4af37);
        font-family: 'Consolas', 'Monaco', monospace;
        min-width: 40px;
        text-align: right;
      }

      .slider-track-wrapper {
        position: relative;
        height: 24px;
        display: flex;
        align-items: center;
      }

      .slider-input {
        width: 100%;
        height: 6px;
        appearance: none;
        -webkit-appearance: none;
        background: transparent;
        cursor: pointer;
        margin: 0;
        position: relative;
        z-index: 2;
      }

      /* Track styling */
      .slider-input::-webkit-slider-runnable-track {
        height: 6px;
        background: var(--v4-slider-track, rgba(255, 255, 255, 0.15));
        border-radius: 3px;
      }

      .slider-input::-moz-range-track {
        height: 6px;
        background: var(--v4-slider-track, rgba(255, 255, 255, 0.15));
        border-radius: 3px;
        border: none;
      }

      /* Thumb styling */
      .slider-input::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        background: var(--theme-primary, #d4af37);
        border-radius: 50%;
        cursor: pointer;
        margin-top: -6px;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        transition:
          transform var(--v4-transition-fast, 150ms),
          box-shadow var(--v4-transition-fast, 150ms);
      }

      .slider-input::-moz-range-thumb {
        width: 18px;
        height: 18px;
        background: var(--theme-primary, #d4af37);
        border-radius: 50%;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        transition:
          transform var(--v4-transition-fast, 150ms),
          box-shadow var(--v4-transition-fast, 150ms);
      }

      /* Hover effects */
      .slider-input::-webkit-slider-thumb:hover {
        transform: scale(1.1);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
      }

      .slider-input::-moz-range-thumb:hover {
        transform: scale(1.1);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.4);
      }

      /* Active/dragging effects */
      .slider-input::-webkit-slider-thumb:active {
        transform: scale(0.95);
      }

      .slider-input::-moz-range-thumb:active {
        transform: scale(0.95);
      }

      /* Focus styling */
      .slider-input:focus-visible {
        outline: none;
      }

      .slider-input:focus-visible::-webkit-slider-thumb {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 3px;
      }

      .slider-input:focus-visible::-moz-range-thumb {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 3px;
      }

      /* Filled track overlay */
      .slider-fill {
        position: absolute;
        left: 0;
        height: 6px;
        background: var(--theme-primary, #d4af37);
        border-radius: 3px 0 0 3px;
        pointer-events: none;
        z-index: 1;
        opacity: 0.7;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .slider-input::-webkit-slider-thumb,
        .slider-input::-moz-range-thumb {
          transition: none;
        }
      }
    `,
  ];

  /**
   * Calculate the fill percentage for the track
   */
  private get fillPercentage(): number {
    const range = this.max - this.min;
    if (range === 0) return 0;
    return ((this.value - this.min) / range) * 100;
  }

  /**
   * Format the displayed value
   */
  private get formattedValue(): string {
    if (this.valueFormatter) {
      return this.valueFormatter(this.value);
    }
    // For decimal steps, show appropriate precision
    if (this.step < 1) {
      const decimalPlaces = this.step.toString().split('.')[1]?.length || 1;
      return this.value.toFixed(decimalPlaces);
    }
    return this.value.toString();
  }

  /**
   * Handle input event (during drag)
   */
  private handleInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.value = parseFloat(input.value);
    this.emit<{ value: number }>('slider-input', { value: this.value });
  }

  /**
   * Handle change event (on release)
   */
  private handleChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.value = parseFloat(input.value);
    this.emit<{ value: number }>('slider-change', { value: this.value });
  }

  protected override render(): TemplateResult {
    return html`
      <div class="slider-wrapper">
        ${this.label || this.showValue
          ? html`
              <div class="slider-header">
                ${this.label ? html`<span class="slider-label">${this.label}</span>` : nothing}
                ${this.showValue
                  ? html`<span class="slider-value">${this.formattedValue}</span>`
                  : nothing}
              </div>
            `
          : nothing}
        <div class="slider-track-wrapper">
          <div class="slider-fill" style="width: ${this.fillPercentage}%"></div>
          <input
            type="range"
            class="slider-input"
            .value=${this.value.toString()}
            min=${this.min}
            max=${this.max}
            step=${this.step}
            ?disabled=${this.disabled}
            name=${this.name || nothing}
            aria-label=${this.label || LanguageService.t('aria.slider')}
            aria-valuemin=${this.min}
            aria-valuemax=${this.max}
            aria-valuenow=${this.value}
            @input=${this.handleInput}
            @change=${this.handleChange}
          />
        </div>
      </div>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-range-slider': RangeSliderV4;
  }
}
