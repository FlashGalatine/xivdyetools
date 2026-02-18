/**
 * XIV Dye Tools v2.0.0 - Dye Filters Component
 *
 * Reusable component for Advanced Dye Filters with collapsible UI
 * Can be used across multiple tools (Harmony Explorer, Color Matcher, Dye Mixer)
 *
 * @module components/dye-filters
 */

import { BaseComponent } from './base-component';
import { LanguageService } from '@services/index';
import { appStorage } from '@services/storage-service';
import { EXPENSIVE_DYE_IDS } from '@shared/constants';
import type { Dye } from '@shared/types';
import { clearContainer } from '@shared/utils';

/**
 * Dye filter configuration
 */
export interface DyeFilterConfig {
  excludeMetallic: boolean;
  excludePastel: boolean;
  excludeExpensive: boolean;
  excludeDark: boolean;
  excludeCosmic: boolean;
}

/**
 * Options for DyeFilters component
 */
export interface DyeFiltersOptions {
  /**
   * Storage key prefix for persisting filter state
   * Default: 'harmony' (results in 'xivdyetools_harmony_filters')
   */
  storageKeyPrefix?: string;
  /**
   * Callback when filters change
   */
  onFilterChange?: (filters: DyeFilterConfig) => void;
  /**
   * Hide the internal collapsible header.
   * Use this when wrapping DyeFilters in an external CollapsiblePanel.
   */
  hideHeader?: boolean;
}

/**
 * Dye Filters Component
 * Provides collapsible UI for excluding dyes by type
 */
export class DyeFilters extends BaseComponent {
  private filters: DyeFilterConfig = {
    excludeMetallic: false,
    excludePastel: false,
    excludeExpensive: false,
    excludeDark: false,
    excludeCosmic: false,
  };
  private filterCheckboxes: Map<string, HTMLInputElement> = new Map();
  private filtersExpanded: boolean = false;
  private filterToggleButton: HTMLElement | null = null;
  private filterCheckboxesContainer: HTMLElement | null = null;
  private storageKey: string;
  private storageKeyExpanded: string;
  private onFilterChange?: (filters: DyeFilterConfig) => void;
  private languageUnsubscribe: (() => void) | null = null;
  private hideHeader: boolean = false;

  constructor(container: HTMLElement, options: DyeFiltersOptions = {}) {
    super(container);
    const prefix = options.storageKeyPrefix || 'harmony';
    this.storageKey = `xivdyetools_${prefix}_filters`;
    this.storageKeyExpanded = `xivdyetools_${prefix}_filters_expanded`;
    this.onFilterChange = options.onFilterChange;
    this.hideHeader = options.hideHeader ?? false;
  }

  /**
   * Render the dye filters component
   */
  renderContent(): HTMLElement {
    // Dye Filters section with collapsible header
    const filtersSection = this.createElement('div', {
      className: 'space-y-3',
    });

    // Generate IDs for accessibility
    const containerId = `${this.container.id || 'filters'}-checkboxes-container`;
    const chevronId = `${this.container.id || 'filters'}-toggle-chevron`;

    // Only render collapsible header if hideHeader is false
    if (!this.hideHeader) {
      // Collapsible header with toggle button
      const filtersHeader = this.createElement('button', {
        attributes: {
          type: 'button',
          'aria-expanded': 'false', // Updated in updateFiltersUI
          'aria-controls': containerId,
        },
        className:
          'w-full flex items-center justify-between p-2 -m-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
      });

      const filtersLabel = this.createElement('span', {
        textContent: LanguageService.t('filters.advancedFilters'),
        className: 'text-sm font-semibold text-gray-700 dark:text-gray-300',
      });

      const toggleChevron = this.createElement('span', {
        textContent: '▼',
        className: 'text-gray-400 dark:text-gray-500 text-xs transition-transform',
        attributes: {
          id: chevronId,
          'aria-hidden': 'true', // Decorative icon
        },
      });

      // Set initial collapsed state for chevron (rotated up)
      toggleChevron.style.transform = 'rotate(-90deg)';

      filtersHeader.appendChild(filtersLabel);
      filtersHeader.appendChild(toggleChevron);
      filtersSection.appendChild(filtersHeader);

      // Store toggle button reference
      this.filterToggleButton = filtersHeader;

      // Add an id to the label for aria-labelledby
      filtersLabel.id = `${this.container.id || 'filters'}-label`;
    }

    // Filter checkboxes container (collapsible only if header is shown)
    const checkboxesContainer = this.createElement('div', {
      className: this.hideHeader
        ? 'space-y-2'
        : 'space-y-2 max-h-96 overflow-hidden transition-all duration-300 ease-in-out',
      attributes: {
        id: containerId,
        role: 'region',
        'aria-labelledby': `${this.container.id || 'filters'}-label`,
      },
    });

    // Set initial collapsed state only if header is shown (default: collapsed)
    if (!this.hideHeader) {
      checkboxesContainer.style.maxHeight = '0px';
      checkboxesContainer.style.opacity = '0';
      checkboxesContainer.style.marginTop = '0';
    }

    // Store reference to checkboxes container
    this.filterCheckboxesContainer = checkboxesContainer;

    // Filter checkboxes
    const filterOptions = [
      {
        key: 'excludeMetallic',
        label: LanguageService.t('filters.excludeMetallic'),
        description: LanguageService.t('filters.excludeMetallicDesc'),
      },
      {
        key: 'excludePastel',
        label: LanguageService.t('filters.excludePastel'),
        description: LanguageService.t('filters.excludePastelDesc'),
      },
      {
        key: 'excludeDark',
        label: LanguageService.t('filters.excludeDark'),
        description: LanguageService.t('filters.excludeDarkDesc'),
      },
      {
        key: 'excludeCosmic',
        label: LanguageService.t('filters.excludeCosmic'),
        description: LanguageService.t('filters.excludeCosmicDesc'),
      },
      {
        key: 'excludeExpensive',
        label: LanguageService.t('filters.excludeExpensive'),
        description: LanguageService.t('filters.excludeExpensiveDesc'),
      },
    ];

    for (const option of filterOptions) {
      const checkboxDiv = this.createElement('div', {
        className: 'flex items-start gap-3',
      });

      const checkboxId = `${this.container.id || 'filters'}-${option.key}`;
      const checkbox = this.createElement('input', {
        attributes: {
          type: 'checkbox',
          id: checkboxId,
        },
        className:
          'mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer',
      });

      const labelElement = this.createElement('label', {
        attributes: {
          for: checkboxId,
        },
        className: 'cursor-pointer flex-1',
      });

      const labelText = this.createElement('div', {
        textContent: option.label,
        className: 'text-sm font-medium text-gray-700 dark:text-gray-300',
      });

      const descText = this.createElement('div', {
        textContent: option.description,
        className: 'text-xs text-gray-500 dark:text-gray-400',
      });

      labelElement.appendChild(labelText);
      labelElement.appendChild(descText);

      checkboxDiv.appendChild(checkbox);
      checkboxDiv.appendChild(labelElement);
      checkboxesContainer.appendChild(checkboxDiv);

      // Store checkbox reference
      this.filterCheckboxes.set(option.key, checkbox);
    }

    filtersSection.appendChild(checkboxesContainer);
    this.element = filtersSection;

    // Clear container and append element
    clearContainer(this.container);
    this.container.appendChild(this.element);

    return this.element;
  }

  /**
   * Bind event listeners
   */
  bindEvents(): void {
    // Bind toggle button
    if (this.filterToggleButton) {
      this.on(this.filterToggleButton, 'click', () => {
        this.toggleFilters();
      });
    }

    // Bind checkbox change events
    for (const [_key, checkbox] of this.filterCheckboxes) {
      this.on(checkbox, 'change', () => {
        this.updateFilterState();
      });
    }
  }

  /**
   * Initialize the component
   */
  onMount(): void {
    // Load saved filter state
    this.loadFilterState();
    this.loadFiltersExpandedState();

    // Clean up existing subscription before creating a new one (prevents exponential leak)
    this.languageUnsubscribe?.();

    // Subscribe to language changes to update localized text (store unsubscribe for cleanup)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update(); // Re-render to update localized text (NOT init() - avoids infinite loop)
    });
  }

  /**
   * Clean up subscriptions on destroy
   */
  override destroy(): void {
    if (this.languageUnsubscribe) {
      this.languageUnsubscribe();
      this.languageUnsubscribe = null;
    }
    super.destroy();
  }

  /**
   * Load filter state from localStorage
   */
  private loadFilterState(): void {
    const saved =
      appStorage.getItem<DyeFilterConfig>(this.storageKey, this.filters) ?? this.filters;
    this.filters = saved;

    // Update checkboxes to reflect saved state
    for (const [filterKey, checkbox] of this.filterCheckboxes) {
      const filterValue = this.filters[filterKey as keyof DyeFilterConfig] ?? false;
      checkbox.checked = filterValue;
    }
  }

  /**
   * Update filter state from checkboxes and save to localStorage
   */
  private updateFilterState(): void {
    for (const [filterKey, checkbox] of this.filterCheckboxes) {
      this.filters[filterKey as keyof DyeFilterConfig] = checkbox.checked;
    }
    appStorage.setItem(this.storageKey, this.filters);

    // Notify parent component
    if (this.onFilterChange) {
      this.onFilterChange(this.filters);
    }

    // Dispatch custom event for other components
    this.container.dispatchEvent(
      new CustomEvent('dye-filters-changed', {
        detail: { filters: this.filters },
        bubbles: true,
      })
    );
  }

  /**
   * Load filters expanded state from localStorage
   */
  private loadFiltersExpandedState(): void {
    this.filtersExpanded = appStorage.getItem<boolean>(this.storageKeyExpanded, false) ?? false;
    this.updateFiltersUI();
  }

  /**
   * Toggle filters expanded/collapsed state
   */
  private toggleFilters(): void {
    this.filtersExpanded = !this.filtersExpanded;
    this.updateFiltersUI();

    // Save state to localStorage
    appStorage.setItem(this.storageKeyExpanded, this.filtersExpanded);
  }

  /**
   * Update filters UI based on expanded state
   */
  private updateFiltersUI(): void {
    const checkboxesContainer = this.filterCheckboxesContainer;
    const chevronId = `${this.container.id || 'filters'}-toggle-chevron`;
    const chevron = document.getElementById(chevronId);

    if (!checkboxesContainer || !chevron) return;

    // Update aria-expanded on the toggle button
    if (this.filterToggleButton) {
      this.filterToggleButton.setAttribute('aria-expanded', String(this.filtersExpanded));
    }

    // Set transition properties
    checkboxesContainer.style.transition =
      'max-height 300ms ease-in-out, opacity 300ms ease-in-out, margin-top 300ms ease-in-out';
    chevron.style.transition = 'transform 300ms ease-in-out';

    if (this.filtersExpanded) {
      // Show checkboxes
      checkboxesContainer.style.maxHeight = '500px';
      checkboxesContainer.style.opacity = '1';
      checkboxesContainer.style.marginTop = '0.75rem';

      // Rotate chevron down
      chevron.style.transform = 'rotate(0deg)';
    } else {
      // Hide checkboxes
      checkboxesContainer.style.maxHeight = '0px';
      checkboxesContainer.style.opacity = '0';
      checkboxesContainer.style.marginTop = '0';

      // Rotate chevron up
      chevron.style.transform = 'rotate(-90deg)';
    }
  }

  /**
   * Check if a dye should be excluded based on current filter settings
   */
  isDyeExcluded(dye: Dye): boolean {
    // Exclude Metallic dyes (using locale-independent flag)
    if (this.filters.excludeMetallic && dye.isMetallic) {
      return true;
    }

    // Exclude Pastel dyes (using locale-independent flag)
    if (this.filters.excludePastel && dye.isPastel) {
      return true;
    }

    // Exclude Dark dyes (using locale-independent flag)
    if (this.filters.excludeDark && dye.isDark) {
      return true;
    }

    // Exclude Cosmic dyes (using locale-independent flag)
    if (this.filters.excludeCosmic && dye.isCosmic) {
      return true;
    }

    // Exclude Jet Black and Pure White
    if (this.filters.excludeExpensive && EXPENSIVE_DYE_IDS.includes(dye.itemID)) {
      return true;
    }

    return false;
  }

  /**
   * Get current filter configuration
   */
  getFilters(): DyeFilterConfig {
    return { ...this.filters };
  }

  /**
   * Set filter configuration programmatically
   */
  setFilters(filters: Partial<DyeFilterConfig>): void {
    this.filters = { ...this.filters, ...filters };

    // Update checkboxes FIRST before calling updateFilterState
    // (updateFilterState reads from checkboxes, so they must be updated first)
    for (const [filterKey, checkbox] of this.filterCheckboxes) {
      const filterValue = this.filters[filterKey as keyof DyeFilterConfig] ?? false;
      checkbox.checked = filterValue;
    }

    // Now save and notify (will read correct values from checkboxes)
    this.updateFilterState();
  }

  /**
   * Filter an array of dyes, removing excluded ones
   */
  filterDyes<T extends Dye>(dyes: T[]): T[] {
    return dyes.filter((dye) => !this.isDyeExcluded(dye));
  }
}
