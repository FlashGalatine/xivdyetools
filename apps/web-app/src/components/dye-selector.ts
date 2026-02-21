/**
 * XIV Dye Tools v2.0.0 - Dye Selector Component
 *
 * Phase 12: Architecture Refactor
 * UI component for selecting and filtering dyes from the database
 *
 * @module components/dye-selector
 */

import { BaseComponent } from './base-component';
import { DyeService, LanguageService, CollectionService } from '@services/index';
import type { Dye } from '@shared/types';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import { ICON_CRYSTAL } from '@shared/ui-icons';
import { DyeSearchBox, SortOption } from './dye-search-box';
import { DyeGrid } from './dye-grid';
import { showCollectionManagerModal } from './collection-manager-modal';

/**
 * Options for dye selector initialization
 */
export interface DyeSelectorOptions {
  maxSelections?: number;
  allowMultiple?: boolean;
  allowDuplicates?: boolean;
  showCategories?: boolean;
  showPrices?: boolean;
  excludeFacewear?: boolean;
  showFavorites?: boolean;
  /** Use compact 3-column grid layout for narrow panels */
  compactMode?: boolean;
  /** Hide the "Selected X/Y" chips container at the bottom (useful when parent shows selections elsewhere) */
  hideSelectedChips?: boolean;
}

/**
 * Dye selector component - allows users to browse and select dyes
 * Supports filtering by category and searching by name
 */
export class DyeSelector extends BaseComponent {
  private selectedDyes: Dye[] = [];
  private filteredDyes: Dye[] = [];
  private currentCategory: string | null = null;
  private searchQuery: string = '';
  private sortOption: SortOption = 'alphabetical';
  private options: DyeSelectorOptions;
  private allowDuplicates: boolean = false;
  private favoriteDyes: Dye[] = [];
  private favoritesExpanded: boolean = true;
  private unsubscribeFavorites: (() => void) | null = null;
  private languageUnsubscribe: (() => void) | null = null;

  // Sub-components
  private searchBox: DyeSearchBox | null = null;
  private dyeGrid: DyeGrid | null = null;

  constructor(container: HTMLElement, options: DyeSelectorOptions = {}) {
    super(container);
    this.options = {
      maxSelections: options.maxSelections ?? 4,
      allowMultiple: options.allowMultiple ?? true,
      allowDuplicates: options.allowDuplicates ?? false,
      showCategories: options.showCategories ?? true,
      showPrices: options.showPrices ?? false,
      excludeFacewear: options.excludeFacewear ?? true,
      showFavorites: options.showFavorites ?? true,
      compactMode: options.compactMode ?? false,
      hideSelectedChips: options.hideSelectedChips ?? false,
    };
    this.allowDuplicates = this.options.allowDuplicates ?? false;
    // Note: Subscriptions are set up in onMount() to prevent leaks if init() fails
  }

  /**
   * Update favorite dyes from IDs
   */
  private updateFavoriteDyes(favoriteIds: number[]): void {
    const dyeService = DyeService.getInstance();
    this.favoriteDyes = favoriteIds
      .map((id) => dyeService.getDyeById(id))
      .filter((dye): dye is Dye => dye !== undefined);
    this.updateFavoritesPanel();
  }

  /**
   * Render the dye selector component
   */
  renderContent(): void {
    const wrapper = this.createElement('div', {
      className: 'space-y-4',
    });

    // 1. Search Box Container
    const searchBoxContainer = this.createElement('div');
    wrapper.appendChild(searchBoxContainer);

    this.searchBox = new DyeSearchBox(searchBoxContainer, {
      showCategories: this.options.showCategories,
      excludeFacewear: this.options.excludeFacewear,
      initialSort: this.sortOption,
      initialCategory: this.currentCategory,
      initialSearch: this.searchQuery,
    });
    this.searchBox.init();

    // 2. Favorites Panel (collapsible)
    if (this.options.showFavorites) {
      const favoritesPanel = this.createFavoritesPanel();
      wrapper.appendChild(favoritesPanel);
    }

    // 3. Selected Dyes Display (can be hidden if parent manages display)
    if (this.options.allowMultiple && !this.options.hideSelectedChips) {
      const selectedContainer = this.createElement('div', {
        id: 'selected-dyes-container',
        className:
          'p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700',
        attributes: { style: this.selectedDyes.length > 0 ? '' : 'display: none;' },
      });
      selectedContainer.style.display = ''; // Reset style

      const selectedLabel = this.createElement('div', {
        id: 'selected-dyes-label',
        className: 'text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2',
      });
      selectedContainer.appendChild(selectedLabel);

      const selectedList = this.createElement('div', {
        id: 'selected-dyes-list',
        className: 'flex flex-wrap gap-2',
      });
      selectedContainer.appendChild(selectedList);

      wrapper.appendChild(selectedContainer);
    }

    // 4. Dye Grid Container
    const gridContainer = this.createElement('div', { id: 'dye-grid-container' });
    wrapper.appendChild(gridContainer);

    this.dyeGrid = new DyeGrid(gridContainer, {
      allowMultiple: this.options.allowMultiple,
      allowDuplicates: this.allowDuplicates,
      maxSelections: this.options.maxSelections,
      showCategories: this.options.showCategories,
      compactMode: this.options.compactMode,
    });
    this.dyeGrid.init();

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    if (!this.element) return;

    // Listen for events from DyeGrid
    // We listen on gridContainer directly to ensure we catch the event
    const gridContainer = this.element.querySelector('#dye-grid-container');

    if (gridContainer) {
      // Use onCustom for custom events
      this.onCustom('dye-selected', (e) => {
        const dye = e.detail as Dye;
        this.handleDyeSelection(dye);
      });
    } else {
      logger.warn('DyeSelector: gridContainer not found for dye-selected event listener.');
    }

    // Listen for events from DyeSearchBox (bubbled)
    this.onCustom('search-changed', (e) => {
      this.searchQuery = e.detail as string;
      this.updateGrid();
    });

    this.onCustom('sort-changed', (e) => {
      this.sortOption = e.detail as SortOption;
      this.updateGrid();
    });

    this.onCustom('category-changed', (e) => {
      this.currentCategory = e.detail as string | null;
      this.updateGrid();
    });

    this.onCustom('clear-all', () => {
      this.selectedDyes = [];
      this.searchQuery = '';
      this.update();
      this.emit('selection-changed', { selectedDyes: this.selectedDyes });
    });

    this.onCustom('random-dye-requested', () => {
      this.selectRandomDye();
    });

    this.onCustom('escape-pressed', () => {
      if (this.selectedDyes.length > 0) {
        this.selectedDyes = [];
        this.update();
        this.emit('selection-changed', { selectedDyes: this.selectedDyes });
      } else {
        (document.activeElement as HTMLElement)?.blur();
      }
    });

    // Favorites panel events
    if (this.options.showFavorites) {
      // Toggle favorites panel
      const favoritesHeader = this.element.querySelector<HTMLElement>('#favorites-header');
      if (favoritesHeader) {
        this.on(favoritesHeader, 'click', () => {
          this.toggleFavoritesPanel();
        });
      }

      // Click on favorite dye cards
      const favoritesPanel = this.element.querySelector<HTMLElement>('#favorites-panel');
      if (favoritesPanel) {
        this.on(favoritesPanel, 'click', (e) => {
          const target = (e.target as HTMLElement).closest('.favorite-dye-card');
          if (target) {
            const dyeId = parseInt(target.getAttribute('data-dye-id') || '0', 10);
            const dye = this.favoriteDyes.find((d) => d.id === dyeId);
            if (dye) {
              this.handleDyeSelection(dye);
            }
          }
        });
      }
    }

    // Global keyboard shortcut
    this.on(document, 'keydown', this.handleGlobalKeydown);
  }

  private handleDyeSelection(dye: Dye): void {
    if (this.options.allowMultiple) {
      if (this.allowDuplicates) {
        if (this.selectedDyes.length < (this.options.maxSelections ?? 4)) {
          this.selectedDyes.push(dye);
        }
      } else {
        const index = this.selectedDyes.findIndex((d) => d.id === dye.id);
        if (index >= 0) {
          this.selectedDyes.splice(index, 1);
        } else if (this.selectedDyes.length < (this.options.maxSelections ?? 4)) {
          this.selectedDyes.push(dye);
        }
      }
    } else {
      this.selectedDyes = [dye];
    }

    this.updateSelectedList();
    this.dyeGrid?.setSelectedDyes(this.selectedDyes);
    this.emit('selection-changed', { selectedDyes: this.selectedDyes });
  }

  private handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === '/' || (event.ctrlKey && event.key === 'f')) {
      if (document.activeElement?.tagName !== 'INPUT') {
        event.preventDefault();
        this.searchBox?.focusSearch();
      }
    }
  }

  /**
   * Select a random dye from the currently filtered list
   */
  private selectRandomDye(): void {
    const availableDyes = this.getFilteredDyes();

    if (availableDyes.length === 0) {
      logger.warn('DyeSelector: No dyes available to select randomly');
      return;
    }

    // Select a random dye from filtered list
    const randomIndex = Math.floor(Math.random() * availableDyes.length);
    const randomDye = availableDyes[randomIndex];

    // Use the same selection handler
    this.handleDyeSelection(randomDye);

    // Log for debugging
    logger.info(`DyeSelector: Random dye selected - ${randomDye.name}`);
  }

  override update(): void {
    if (!this.isInitialized) return;

    // Update Selected Dyes List
    this.updateSelectedList();

    // Update Grid
    this.updateGrid();
  }

  private updateSelectedList(): void {
    if (!this.options.allowMultiple) return;

    const selectedLabel = this.container.querySelector<HTMLElement>('#selected-dyes-label');
    const selectedList = this.container.querySelector<HTMLElement>('#selected-dyes-list');

    if (selectedLabel) {
      selectedLabel.textContent = LanguageService.tInterpolate('dyeSelector.selected', {
        current: String(this.selectedDyes.length),
        max: String(this.options.maxSelections),
      });
    }

    if (selectedList) {
      clearContainer(selectedList);

      this.selectedDyes.forEach((dye) => {
        const dyeTag = this.createElement('div', {
          className:
            'inline-flex items-center gap-2 px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm',
        });

        const dyeColor = this.createElement('div', {
          className: 'w-3 h-3 rounded-full border border-gray-400',
          attributes: { style: `background-color: ${dye.hex}` },
        });

        const dyeName = this.createElement('span', {
          textContent: LanguageService.getDyeName(dye.itemID) || dye.name,
          className: 'text-gray-900 dark:text-white',
        });

        const removeBtn = this.createElement('button', {
          textContent: '✕',
          className:
            'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white dye-remove-btn',
          attributes: {
            'data-dye-id': String(dye.id),
            type: 'button',
          },
        });

        this.on(removeBtn, 'click', (e) => {
          e.preventDefault();
          this.selectedDyes = this.selectedDyes.filter((d) => d.id !== dye.id);
          this.update();
          this.emit('selection-changed', { selectedDyes: this.selectedDyes });
        });

        dyeTag.appendChild(dyeColor);
        dyeTag.appendChild(dyeName);
        dyeTag.appendChild(removeBtn);
        selectedList.appendChild(dyeTag);
      });
    }
  }

  private updateGrid(): void {
    if (!this.dyeGrid) return;

    this.filteredDyes = this.getFilteredDyes();

    this.dyeGrid.setDyes(this.filteredDyes, {
      type: this.searchQuery.trim() ? 'search' : 'category',
      query: this.searchQuery,
    });
    this.dyeGrid.setSelectedDyes(this.selectedDyes);
  }

  private getFilteredDyes(): Dye[] {
    const dyeService = DyeService.getInstance();
    let dyes = dyeService.getAllDyes();

    if (this.options.excludeFacewear) {
      dyes = dyes.filter((d) => d.category !== 'Facewear');
    }

    if (this.currentCategory) {
      dyes = dyes.filter((d) => d.category === this.currentCategory);
    }

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.trim().toLowerCase();
      dyes = dyes.filter((d) => d.name.toLowerCase().includes(query));
    }

    dyes.sort((a, b) => this.compareDyes(a, b, this.sortOption));

    return dyes;
  }

  private compareDyes(a: Dye, b: Dye, sortOption: SortOption): number {
    switch (sortOption) {
      case 'alphabetical':
        return a.name.localeCompare(b.name);
      case 'brightness-asc':
        return a.hsv.v - b.hsv.v;
      case 'brightness-desc':
        return b.hsv.v - a.hsv.v;
      case 'hue': {
        const hueDiff = a.hsv.h - b.hsv.h;
        if (Math.abs(hueDiff) > 1) return hueDiff;
        const satDiff = b.hsv.s - a.hsv.s;
        if (Math.abs(satDiff) > 1) return satDiff;
        return b.hsv.v - a.hsv.v;
      }
      case 'saturation': {
        const saturationDiff = a.hsv.s - b.hsv.s;
        if (Math.abs(saturationDiff) > 1) return saturationDiff;
        return a.hsv.v - b.hsv.v;
      }
      case 'category': {
        const categoryDiff = a.category.localeCompare(b.category);
        if (categoryDiff !== 0) return categoryDiff;
        return a.name.localeCompare(b.name);
      }
      default:
        return a.name.localeCompare(b.name);
    }
  }

  onMount(): void {
    // Subscribe to favorites changes (done here to prevent leaks if init fails)
    if (this.options.showFavorites) {
      // Load initial favorites
      const initialFavorites = CollectionService.getFavorites();
      this.updateFavoriteDyes(initialFavorites);

      // Subscribe to future changes
      this.unsubscribeFavorites = CollectionService.subscribeFavorites((favoriteIds) => {
        this.updateFavoriteDyes(favoriteIds);
      });
    }

    // Initial update to populate the grid
    this.update();

    // Subscribe to language changes (store unsubscribe for cleanup)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update();
    });
  }

  getSelectedDyes(): Dye[] {
    return [...this.selectedDyes];
  }

  setSelectedDyes(dyes: Dye[]): void {
    this.selectedDyes = dyes.slice(0, this.options.maxSelections ?? 4);
    this.update();
  }

  /**
   * Create the collapsible favorites panel
   */
  private createFavoritesPanel(): HTMLElement {
    const panel = this.createElement('div', {
      id: 'favorites-panel',
      className:
        'rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden',
    });

    // Header (clickable to toggle)
    const header = this.createElement('button', {
      id: 'favorites-header',
      className:
        'w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors',
      attributes: { type: 'button' },
    });

    const headerLeft = this.createElement('div', {
      className: 'flex items-center gap-2',
    });

    // Crystal icon (FFXIV-style favorites indicator)
    const crystalIcon = this.createElement('span', {
      className: 'w-5 h-5 inline-block text-yellow-500',
    });
    crystalIcon.innerHTML = ICON_CRYSTAL;
    headerLeft.appendChild(crystalIcon);

    // Title with count
    const title = this.createElement('span', {
      id: 'favorites-title',
      textContent: `${LanguageService.t('collections.favorites')} (${this.favoriteDyes.length})`,
      className: 'font-medium text-gray-900 dark:text-white',
    });
    headerLeft.appendChild(title);

    header.appendChild(headerLeft);

    const headerRight = this.createElement('div', {
      className: 'flex items-center gap-2',
    });

    // Manage Collections button
    // WEB-BUG-001 FIX: Use this.on() instead of direct addEventListener
    // to ensure proper cleanup via unbindAllEvents() on component destroy/update
    const manageBtn = this.createElement('button', {
      id: 'manage-collections-btn',
      className:
        'text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors',
      textContent: LanguageService.t('collections.manageCollections'),
      attributes: { type: 'button' },
    });
    this.on(manageBtn, 'click', (e) => {
      e.stopPropagation(); // Prevent toggling the panel
      showCollectionManagerModal();
    });
    headerRight.appendChild(manageBtn);

    // Chevron icon
    const chevron = this.createElement('span', {
      id: 'favorites-chevron',
      textContent: this.favoritesExpanded ? '▼' : '▶',
      className: 'text-gray-500 text-sm transition-transform',
    });
    headerRight.appendChild(chevron);

    header.appendChild(headerRight);

    panel.appendChild(header);

    // Content area
    const content = this.createElement('div', {
      id: 'favorites-content',
      className: `px-4 py-3 ${this.favoritesExpanded ? '' : 'hidden'}`,
    });

    if (this.favoriteDyes.length === 0) {
      // Empty state
      const emptyState = this.createElement('div', {
        className: 'text-center py-4 text-gray-500 dark:text-gray-400',
      });
      const emptyText = this.createElement('p', {
        textContent: LanguageService.t('collections.favoritesEmptyHint'),
        className: 'text-sm',
      });
      emptyState.appendChild(emptyText);
      content.appendChild(emptyState);
    } else {
      // Grid of favorite dyes - use compact 3-column layout when compactMode is enabled
      const gridClasses = this.options.compactMode
        ? 'grid grid-cols-3 gap-2'
        : 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2';
      const grid = this.createElement('div', {
        id: 'favorites-grid',
        className: gridClasses,
      });

      this.favoriteDyes.forEach((dye) => {
        const dyeCard = this.createFavoriteDyeCard(dye);
        grid.appendChild(dyeCard);
      });

      content.appendChild(grid);
    }

    panel.appendChild(content);

    return panel;
  }

  /**
   * Create a compact dye card for the favorites panel
   */
  private createFavoriteDyeCard(dye: Dye): HTMLElement {
    const isSelected = this.selectedDyes.some((d) => d.id === dye.id);

    const card = this.createElement('button', {
      className: `favorite-dye-card relative flex flex-col items-center p-2 rounded-lg transition-all duration-200 ${
        isSelected
          ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30'
          : 'hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-600'
      }`,
      attributes: {
        'data-dye-id': String(dye.id),
        'aria-label': `${LanguageService.getDyeName(dye.itemID) || dye.name}`,
        type: 'button',
      },
    });

    // Color swatch
    const swatch = this.createElement('div', {
      className: 'w-8 h-8 rounded border border-gray-300 dark:border-gray-500',
      attributes: { style: `background-color: ${dye.hex};` },
    });
    card.appendChild(swatch);

    // Dye name (truncated)
    const name = this.createElement('div', {
      textContent: LanguageService.getDyeName(dye.itemID) || dye.name,
      className: 'text-xs text-gray-700 dark:text-gray-300 truncate w-full text-center mt-1',
    });
    card.appendChild(name);

    return card;
  }

  /**
   * Update the favorites panel without full re-render
   */
  private updateFavoritesPanel(): void {
    if (!this.options.showFavorites || !this.element) return;

    const panel = this.element.querySelector('#favorites-panel');
    if (!panel) return;

    // Update title count
    const title = panel.querySelector('#favorites-title');
    if (title) {
      title.textContent = `${LanguageService.t('collections.favorites')} (${this.favoriteDyes.length})`;
    }

    // Update content
    const content = panel.querySelector<HTMLElement>('#favorites-content');
    if (content) {
      clearContainer(content);

      if (this.favoriteDyes.length === 0) {
        // Empty state
        const emptyState = this.createElement('div', {
          className: 'text-center py-4 text-gray-500 dark:text-gray-400',
        });
        const emptyText = this.createElement('p', {
          textContent: LanguageService.t('collections.favoritesEmptyHint'),
          className: 'text-sm',
        });
        emptyState.appendChild(emptyText);
        content.appendChild(emptyState);
      } else {
        // Grid of favorite dyes
        const grid = this.createElement('div', {
          id: 'favorites-grid',
          className: 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2',
        });

        this.favoriteDyes.forEach((dye) => {
          const dyeCard = this.createFavoriteDyeCard(dye);
          grid.appendChild(dyeCard);
        });

        content.appendChild(grid);
      }
    }
  }

  /**
   * Toggle favorites panel expansion
   */
  private toggleFavoritesPanel(): void {
    this.favoritesExpanded = !this.favoritesExpanded;

    const content = this.element?.querySelector('#favorites-content');
    const chevron = this.element?.querySelector('#favorites-chevron');

    if (content) {
      content.classList.toggle('hidden', !this.favoritesExpanded);
    }
    if (chevron) {
      chevron.textContent = this.favoritesExpanded ? '▼' : '▶';
    }
  }

  /**
   * Clean up subscriptions when component is destroyed
   */
  override destroy(): void {
    if (this.unsubscribeFavorites) {
      this.unsubscribeFavorites();
      this.unsubscribeFavorites = null;
    }
    if (this.languageUnsubscribe) {
      this.languageUnsubscribe();
      this.languageUnsubscribe = null;
    }
    super.destroy();
  }

  protected getState(): Record<string, unknown> {
    return {
      selectedDyes: this.selectedDyes,
      searchQuery: this.searchQuery,
      currentCategory: this.currentCategory,
      sortOption: this.sortOption,
    };
  }

  protected setState(newState: Record<string, unknown>): void {
    if (Array.isArray(newState.selectedDyes)) {
      this.selectedDyes = newState.selectedDyes;
    }
    if (typeof newState.searchQuery === 'string') {
      this.searchQuery = newState.searchQuery;
    }
    if (newState.currentCategory === null || typeof newState.currentCategory === 'string') {
      this.currentCategory = newState.currentCategory;
    }
    if (typeof newState.sortOption === 'string') {
      this.sortOption = newState.sortOption as SortOption;
    }
  }
}
