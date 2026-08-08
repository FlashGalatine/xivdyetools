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
  ICON_STATE_SEARCH,
  ICON_STATE_FUNNEL,
  ICON_STATE_COINS,
  ICON_STATE_ALERT,
  ICON_STATE_WAIT_ANIMATED,
  ICON_DETAIL_HARMONY,
  ICON_DETAIL_EXTRACTOR,
} from '@shared/state-icons';

// ============================================================================
// Types
// ============================================================================

export interface EmptyStateOptions {
  /**
   * Icon to display — a static SVG string from `@shared/state-icons` /
   * `@shared/ui-icons` (compile-time constants only; emoji/text are no longer
   * accepted — one icon system, confirmed 2026-08-07).
   */
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
    icon: ICON_STATE_SEARCH,
    title: LanguageService.t('emptyStates.noSearchResults.title').replace('{query}', query),
    description: LanguageService.t('emptyStates.noSearchResults.description'),
    actionLabel: LanguageService.t('emptyStates.noSearchResults.action'),
    onAction: onClear,
  }),

  allFilteredOut: (onReset?: () => void): EmptyStateOptions => ({
    // The state is caused by filters, so the icon is the filter
    icon: ICON_STATE_FUNNEL,
    title: LanguageService.t('emptyStates.filteredOut.title'),
    description: LanguageService.t('emptyStates.filteredOut.description'),
    actionLabel: LanguageService.t('emptyStates.filteredOut.action'),
    onAction: onReset,
  }),

  noPriceData: (onTryAnother?: () => void): EmptyStateOptions => ({
    icon: ICON_STATE_COINS,
    title: LanguageService.t('marketBoard.priceUnavailable'),
    description: LanguageService.t('emptyStates.noPrice.description'),
    actionLabel: LanguageService.t('emptyStates.noPrice.action'),
    onAction: onTryAnother,
  }),

  noHarmonyResults: (onSelectDye?: () => void): EmptyStateOptions => ({
    // The tool's own detail glyph — the wheel, not music notes
    icon: ICON_DETAIL_HARMONY,
    title: LanguageService.t('emptyStates.noHarmony.title'),
    description: LanguageService.t('emptyStates.noHarmony.description'),
    actionLabel: LanguageService.t('emptyStates.noHarmony.action'),
    onAction: onSelectDye,
  }),

  noImage: (onUpload?: () => void): EmptyStateOptions => ({
    icon: ICON_DETAIL_EXTRACTOR,
    title: LanguageService.t('emptyStates.noImage.title'),
    description: LanguageService.t('emptyStates.noImage.description'),
    actionLabel: LanguageService.t('emptyStates.noImage.action'),
    onAction: onUpload,
  }),

  error: (message: string, onRetry?: () => void): EmptyStateOptions => ({
    icon: ICON_STATE_ALERT,
    title: LanguageService.t('errors.somethingWentWrong'),
    description: message,
    actionLabel: LanguageService.t('errors.tryAgain'),
    onAction: onRetry,
  }),

  loading: (): EmptyStateOptions => ({
    // 2a: the hourglass runs on the web; reduced motion pauses to the static glyph
    icon: ICON_STATE_WAIT_ANIMATED,
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

    // Icon — static SVG constants only (SEC pattern: code-controlled strings)
    const icon = this.createElement('div', {
      className: 'empty-state-icon',
      attributes: {
        'aria-hidden': 'true',
      },
    });
    icon.innerHTML = this.options.icon;
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
 * Create empty state HTML string for use in innerHTML.
 * `options.icon` must be a static SVG constant — anything else renders as an
 * empty icon slot (defense-in-depth: this string goes into innerHTML).
 */
export function getEmptyStateHTML(options: EmptyStateOptions): string {
  const iconContent = options.icon.trimStart().startsWith('<svg') ? options.icon : '';
  return `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">${iconContent}</div>
      <h3 class="empty-state-title">${options.title}</h3>
      ${options.description ? `<p class="empty-state-description">${options.description}</p>` : ''}
    </div>
  `.trim();
}
