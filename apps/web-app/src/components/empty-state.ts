/**
 * XIV Dye Tools v2.1.0 - Empty State Component
 *
 * Reusable empty state display for zero-result scenarios
 * Provides friendly messaging with optional action buttons
 *
 * @module components/empty-state
 */

import { BaseComponent } from './base-component';
import { clearContainer } from '@shared/utils';
import { LanguageService } from '@services/index';
import {
  ICON_SEARCH,
  ICON_PALETTE,
  ICON_COINS,
  ICON_HARMONY,
  ICON_IMAGE,
  ICON_WARNING,
  ICON_LOADING,
} from '@shared/empty-state-icons';

// ============================================================================
// Types
// ============================================================================

export interface EmptyStateOptions {
  /** Icon to display (SVG string, emoji, or text) */
  icon: string;
  /** Main title text */
  title: string;
  /** Description/explanation text */
  description?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Secondary action button label */
  secondaryActionLabel?: string;
  /** Secondary action button callback */
  onSecondaryAction?: () => void;
}

// ============================================================================
// Preset Empty States
// ============================================================================

export const EMPTY_STATE_PRESETS = {
  noSearchResults: (query: string, onClear?: () => void): EmptyStateOptions => ({
    icon: ICON_SEARCH,
    title: LanguageService.t('emptyStates.noSearchResults.title').replace('{query}', query),
    description: LanguageService.t('emptyStates.noSearchResults.description'),
    actionLabel: LanguageService.t('emptyStates.noSearchResults.action'),
    onAction: onClear,
  }),

  allFilteredOut: (onReset?: () => void): EmptyStateOptions => ({
    icon: ICON_PALETTE,
    title: LanguageService.t('emptyStates.filteredOut.title'),
    description: LanguageService.t('emptyStates.filteredOut.description'),
    actionLabel: LanguageService.t('emptyStates.filteredOut.action'),
    onAction: onReset,
  }),

  noPriceData: (onTryAnother?: () => void): EmptyStateOptions => ({
    icon: ICON_COINS,
    title: LanguageService.t('marketBoard.priceUnavailable'),
    description: LanguageService.t('emptyStates.noPrice.description'),
    actionLabel: LanguageService.t('emptyStates.noPrice.action'),
    onAction: onTryAnother,
  }),

  noHarmonyResults: (onSelectDye?: () => void): EmptyStateOptions => ({
    icon: ICON_HARMONY,
    title: LanguageService.t('emptyStates.noHarmony.title'),
    description: LanguageService.t('emptyStates.noHarmony.description'),
    actionLabel: LanguageService.t('emptyStates.noHarmony.action'),
    onAction: onSelectDye,
  }),

  noImage: (onUpload?: () => void): EmptyStateOptions => ({
    icon: ICON_IMAGE,
    title: LanguageService.t('emptyStates.noImage.title'),
    description: LanguageService.t('emptyStates.noImage.description'),
    actionLabel: LanguageService.t('emptyStates.noImage.action'),
    onAction: onUpload,
  }),

  error: (message: string, onRetry?: () => void): EmptyStateOptions => ({
    icon: ICON_WARNING,
    title: LanguageService.t('errors.somethingWentWrong'),
    description: message,
    actionLabel: LanguageService.t('errors.tryAgain'),
    onAction: onRetry,
  }),

  loading: (): EmptyStateOptions => ({
    icon: ICON_LOADING,
    title: LanguageService.t('emptyStates.loading.title'),
    description: LanguageService.t('emptyStates.loading.description'),
  }),
} as const;

// ============================================================================
// Empty State Component
// ============================================================================

export class EmptyState extends BaseComponent {
  private options: EmptyStateOptions;

  constructor(container: HTMLElement, options: EmptyStateOptions) {
    super(container);
    this.options = options;
  }

  /**
   * Render the empty state
   */
  renderContent(): void {
    clearContainer(this.container);

    // Main wrapper with styling from globals.css
    const wrapper = this.createElement('div', {
      className: 'empty-state',
    });

    // Icon - supports both SVG strings and emoji/text
    const icon = this.createElement('div', {
      className: 'empty-state-icon',
      attributes: {
        'aria-hidden': 'true',
      },
    });
    // Check if the icon is an SVG string
    if (this.options.icon.includes('<svg')) {
      icon.innerHTML = this.options.icon;
    } else {
      icon.textContent = this.options.icon;
    }
    wrapper.appendChild(icon);

    // Title
    const title = this.createElement('h3', {
      className: 'empty-state-title',
      textContent: this.options.title,
    });
    wrapper.appendChild(title);

    // Description
    if (this.options.description) {
      const description = this.createElement('p', {
        className: 'empty-state-description',
        textContent: this.options.description,
      });
      wrapper.appendChild(description);
    }

    // Actions container
    if (this.options.actionLabel || this.options.secondaryActionLabel) {
      const actions = this.createElement('div', {
        className: 'empty-state-action flex gap-3',
      });

      // Primary action button
      if (this.options.actionLabel && this.options.onAction) {
        const primaryBtn = this.createElement('button', {
          className:
            'px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors',
          textContent: this.options.actionLabel,
          attributes: {
            type: 'button',
          },
        });
        primaryBtn.addEventListener('click', this.options.onAction);
        actions.appendChild(primaryBtn);
      }

      // Secondary action button
      if (this.options.secondaryActionLabel && this.options.onSecondaryAction) {
        const secondaryBtn = this.createElement('button', {
          className:
            'px-4 py-2 text-sm font-medium rounded-lg border border-current text-current hover:bg-black/5 dark:hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-current focus:ring-offset-2 transition-colors',
          textContent: this.options.secondaryActionLabel,
          attributes: {
            type: 'button',
          },
        });
        secondaryBtn.addEventListener('click', this.options.onSecondaryAction);
        actions.appendChild(secondaryBtn);
      }

      wrapper.appendChild(actions);
    }

    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  /**
   * Bind events
   */
  bindEvents(): void {
    // Events are bound in render() for action buttons
  }

  /**
   * Update the empty state options
   */
  setOptions(options: Partial<EmptyStateOptions>): void {
    this.options = { ...this.options, ...options };
    this.update();
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty state from a preset
 */
export function createEmptyState(container: HTMLElement, preset: EmptyStateOptions): EmptyState {
  const emptyState = new EmptyState(container, preset);
  return emptyState.init();
}

/**
 * Create empty state HTML string for use in innerHTML
 * Handles both SVG icons and emoji/text icons
 */
export function getEmptyStateHTML(options: EmptyStateOptions): string {
  // SVG icons are inserted directly, emojis are escaped
  const iconContent = options.icon.includes('<svg')
    ? options.icon
    : options.icon.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">${iconContent}</div>
      <h3 class="empty-state-title">${options.title}</h3>
      ${options.description ? `<p class="empty-state-description">${options.description}</p>` : ''}
    </div>
  `.trim();
}
