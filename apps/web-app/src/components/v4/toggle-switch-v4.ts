/**
 * XIV Dye Tools v4.0 - Toggle Switch Component
 *
 * Animated toggle switch for boolean settings with full accessibility support.
 * Designed to replace checkbox inputs in the ConfigSidebar and other settings panels.
 *
 * @module components/v4/toggle-switch-v4
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import { LanguageService } from '@services/index';

/**
 * V4 Toggle Switch - Animated boolean toggle
 *
 * Uses CSS custom properties for theming:
 * - `--theme-primary`: Active state background color
 * - `--v4-transition-fast`: Animation duration
 *
 * @fires toggle-change - Emits when the toggle state changes
 *   - `detail.checked`: The new checked state (boolean)
 *
 * @example
 * ```html
 * <v4-toggle-switch
 *   label="Show dye names"
 *   .checked=${this.showNames}
 *   @toggle-change=${(e) => this.showNames = e.detail.checked}
 * ></v4-toggle-switch>
 *
 * <v4-toggle-switch
 *   label="Enable notifications"
 *   checked
 *   disabled
 * ></v4-toggle-switch>
 * ```
 */
@customElement('v4-toggle-switch')
export class ToggleSwitchV4 extends BaseLitComponent {
  /**
   * Current checked state
   */
  @property({ type: Boolean, reflect: true })
  checked: boolean = false;

  /**
   * Disabled state - prevents interaction
   */
  @property({ type: Boolean, reflect: true })
  disabled: boolean = false;

  /**
   * Accessible label for the toggle
   */
  @property({ type: String })
  label?: string;

  /**
   * Form field name (for form integration)
   */
  @property({ type: String })
  name?: string;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: inline-block;
      }

      .toggle-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        user-select: none;
      }

      :host([disabled]) .toggle-wrapper {
        cursor: not-allowed;
        opacity: 0.5;
      }

      .toggle-label {
        font-size: 13px;
        color: var(--theme-text, #e0e0e0);
      }

      .toggle-track {
        position: relative;
        width: 40px;
        height: 22px;
        background: var(--v4-toggle-bg, rgba(255, 255, 255, 0.15));
        border-radius: 11px;
        transition: background-color var(--v4-transition-fast, 150ms);
        flex-shrink: 0;
      }

      :host([checked]) .toggle-track {
        background: var(--theme-primary, #d4af37);
      }

      .toggle-track:focus-visible {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 2px;
      }

      .toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 18px;
        height: 18px;
        background: #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: transform var(--v4-transition-fast, 150ms);
      }

      :host([checked]) .toggle-thumb {
        transform: translateX(18px);
      }

      /* Hover effect on track */
      .toggle-wrapper:not(.disabled):hover .toggle-track {
        background: var(--v4-toggle-bg-hover, rgba(255, 255, 255, 0.25));
      }

      :host([checked]) .toggle-wrapper:not(.disabled):hover .toggle-track {
        background: var(--theme-primary-hover, #c49d2f);
      }

      /* Active press effect */
      .toggle-wrapper:not(.disabled):active .toggle-thumb {
        transform: scale(0.9);
      }

      :host([checked]) .toggle-wrapper:not(.disabled):active .toggle-thumb {
        transform: translateX(18px) scale(0.9);
      }

      /* Hidden checkbox for form submission */
      .hidden-input {
        position: absolute;
        opacity: 0;
        pointer-events: none;
        width: 0;
        height: 0;
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .toggle-track,
        .toggle-thumb {
          transition: none;
        }
      }
    `,
  ];

  /**
   * Handle toggle click/keyboard activation
   */
  private handleToggle(e: Event): void {
    if (this.disabled) {
      e.preventDefault();
      return;
    }

    this.checked = !this.checked;
    this.emit<{ checked: boolean }>('toggle-change', { checked: this.checked });
  }

  /**
   * Handle keyboard events for accessibility
   */
  private handleKeyDown(e: KeyboardEvent): void {
    if (this.disabled) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.handleToggle(e);
    }
  }

  protected override render(): TemplateResult {
    return html`
      <div class="toggle-wrapper ${this.disabled ? 'disabled' : ''}" @click=${this.handleToggle}>
        ${this.label ? html`<span class="toggle-label">${this.label}</span>` : nothing}
        <div
          class="toggle-track"
          role="switch"
          aria-checked=${this.checked}
          aria-disabled=${this.disabled}
          aria-label=${this.label || LanguageService.t('aria.toggle')}
          tabindex=${this.disabled ? -1 : 0}
          @keydown=${this.handleKeyDown}
        >
          <div class="toggle-thumb"></div>
        </div>
        ${this.name
          ? html`
              <input
                type="checkbox"
                class="hidden-input"
                name=${this.name}
                .checked=${this.checked}
                ?disabled=${this.disabled}
                tabindex="-1"
              />
            `
          : nothing}
      </div>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-toggle-switch': ToggleSwitchV4;
  }
}
