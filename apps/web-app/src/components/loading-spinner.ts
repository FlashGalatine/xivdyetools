/**
 * XIV Dye Tools v2.1.0 - Loading Spinner Component
 *
 * Reusable loading indicator with accessibility support
 * Respects prefers-reduced-motion preference
 *
 * @module components/loading-spinner
 */

import { BaseComponent } from './base-component';
import { clearContainer } from '@shared/utils';

// ============================================================================
// Types
// ============================================================================

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface LoadingSpinnerOptions {
  size?: SpinnerSize;
  message?: string;
  inline?: boolean;
}

// ============================================================================
// Spinner SVG (theme-aware using currentColor)
// ============================================================================

const SPINNER_SVG = `<svg class="loading-spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" opacity="0.25"/>
  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
</svg>`;

// ============================================================================
// Loading Spinner Component
// ============================================================================

export class LoadingSpinner extends BaseComponent {
  private options: Required<LoadingSpinnerOptions>;

  constructor(container: HTMLElement, options: LoadingSpinnerOptions = {}) {
    super(container);
    this.options = {
      size: options.size || 'md',
      message: options.message || '',
      inline: options.inline ?? false,
    };
  }

  /**
   * Get size classes for the spinner
   */
  private getSizeClasses(): string {
    const sizeMap: Record<SpinnerSize, string> = {
      sm: 'spinner-sm', // 1rem
      md: 'spinner-md', // 1.5rem
      lg: 'spinner-lg', // 2rem
    };
    return sizeMap[this.options.size];
  }

  /**
   * Render the spinner
   */
  renderContent(): void {
    clearContainer(this.container);

    // Wrapper element
    const wrapper = this.createElement('div', {
      className: this.options.inline
        ? 'inline-flex items-center gap-2'
        : 'flex flex-col items-center justify-center gap-3 py-8',
      attributes: {
        role: 'status',
        'aria-live': 'polite',
        'aria-busy': 'true',
      },
    });

    // Spinner SVG
    const spinnerWrapper = this.createElement('div', {
      className: `${this.getSizeClasses()} text-current`,
      innerHTML: SPINNER_SVG,
    });
    wrapper.appendChild(spinnerWrapper);

    // Loading message (visible and for screen readers)
    if (this.options.message) {
      const message = this.createElement('span', {
        className: this.options.inline ? 'text-sm text-current' : 'text-sm text-current opacity-75',
        textContent: this.options.message,
      });
      wrapper.appendChild(message);
    } else {
      // Screen reader only text when no message provided
      const srOnly = this.createElement('span', {
        className: 'sr-only',
        textContent: 'Loading...',
      });
      wrapper.appendChild(srOnly);
    }

    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Bind events (none for spinner)
   */
  bindEvents(): void {
    // No events needed for static spinner
  }

  /**
   * Update the loading message
   */
  setMessage(message: string): void {
    this.options.message = message;
    this.update();
  }

  /**
   * Update the spinner size
   */
  setSize(size: SpinnerSize): void {
    this.options.size = size;
    this.update();
  }
}

// ============================================================================
// Factory Functions for Common Use Cases
// ============================================================================

/**
 * Create and render an inline spinner (for buttons, etc.)
 */
export function createInlineSpinner(container: HTMLElement, message?: string): LoadingSpinner {
  const spinner = new LoadingSpinner(container, {
    size: 'sm',
    message,
    inline: true,
  });
  return spinner.init();
}

/**
 * Create and render a block spinner (for content areas)
 */
export function createBlockSpinner(container: HTMLElement, message?: string): LoadingSpinner {
  const spinner = new LoadingSpinner(container, {
    size: 'md',
    message,
    inline: false,
  });
  return spinner.init();
}

/**
 * Create spinner HTML string for use in innerHTML
 * (useful when you can't use the component directly)
 */
export function getSpinnerHTML(size: SpinnerSize = 'md', message?: string): string {
  const sizeClass = size === 'sm' ? 'spinner-sm' : size === 'lg' ? 'spinner-lg' : 'spinner-md';

  return `
    <div class="flex flex-col items-center justify-center gap-3 py-8" role="status" aria-live="polite" aria-busy="true">
      <div class="${sizeClass} text-current">${SPINNER_SVG}</div>
      ${message ? `<span class="text-sm text-current opacity-75">${message}</span>` : '<span class="sr-only">Loading...</span>'}
    </div>
  `.trim();
}
