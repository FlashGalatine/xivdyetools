/**
 * XIV Dye Tools v4.0 - Dye Palette Drawer Component
 *
 * 320px right-side drawer containing dye selection palette.
 * Features favorites, search, filter chips, and swatch grid.
 * Emits dye-selected events for context-aware tool integration.
 *
 * @module components/v4/dye-palette-drawer
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { BaseLitComponent } from './base-lit-component';
import { DyeService, type Dye } from '@services/dye-service-wrapper';
import { CollectionService } from '@services/collection-service';
import { ToastService } from '@services/toast-service';
import { logger } from '@shared/logger';
import { ICON_DICE, ICON_BROOM, ICON_CLOSE } from '@shared/ui-icons';
import { LanguageService } from '@services/index';
import type { ToolId } from '@services/router-service';

/**
 * Filter types for dye categories
 */
type DyeFilter = 'all' | 'metallic' | 'pastel' | 'dark' | 'vibrant';

/**
 * Dye categories for grouping
 */
const DYE_CATEGORY_ORDER = [
  'White',
  'Grey',
  'Black',
  'Brown',
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Blue',
  'Purple',
  'Pink',
] as const;

/**
 * Mapping from dye category names to translation keys
 */
const CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  White: 'colorPalette.whites',
  Grey: 'colorPalette.grays',
  Black: 'colorPalette.blacks',
  Brown: 'colorPalette.browns',
  Red: 'colorPalette.reds',
  Orange: 'colorPalette.oranges',
  Yellow: 'colorPalette.yellows',
  Green: 'colorPalette.greens',
  Blue: 'colorPalette.blues',
  Purple: 'colorPalette.purples',
  Pink: 'colorPalette.pinks',
};

/**
 * V4 Dye Palette Drawer - Right-side color selection panel
 *
 * @fires dye-selected - When a dye swatch is clicked or random dye is selected
 *   - detail.dye: The selected Dye object
 * @fires drawer-toggle - When close button is clicked
 * @fires clear-all-dyes - When clear all button is clicked, signals tool to reset
 *
 * @example
 * ```html
 * <dye-palette-drawer
 *   .isOpen=${true}
 *   @dye-selected=${this.handleDyeSelected}
 *   @drawer-toggle=${this.handleToggle}
 *   @clear-all-dyes=${this.handleClearDyes}
 * ></dye-palette-drawer>
 * ```
 */
@customElement('dye-palette-drawer')
export class DyePaletteDrawer extends BaseLitComponent {
  /**
   * Whether the drawer is open/visible.
   * Defaults to false; parent component controls via is-open attribute.
   */
  @property({ type: Boolean, reflect: true, attribute: 'is-open' })
  isOpen = false;

  /**
   * Currently active tool ID - used to conditionally show Custom Color section
   */
  @property({ type: String, attribute: 'active-tool' })
  activeTool: ToolId = 'harmony';

  /**
   * Tools that support the Custom Color feature
   */
  private static readonly TOOLS_WITH_CUSTOM_COLOR: ToolId[] = ['harmony', 'gradient', 'mixer'];

  /**
   * Check if custom color section should be shown for current tool
   */
  private get shouldShowCustomColor(): boolean {
    return DyePaletteDrawer.TOOLS_WITH_CUSTOM_COLOR.includes(this.activeTool);
  }

  // =========================================================================
  // Internal State
  // =========================================================================

  @state() private searchQuery = '';
  @state() private activeFilter: DyeFilter = 'all';
  @state() private favoriteDyes: Dye[] = [];
  @state() private favoriteIds: Set<number> = new Set();
  @state() private allDyes: Dye[] = [];
  @state() private filteredDyes: Dye[] = [];
  @state() private favoritesExpanded = true;
  @state() private customColorHex = '#FF5500';
  @state() private customColorExpanded = true;

  private unsubscribeFavorites: (() => void) | null = null;
  private languageUnsubscribe: (() => void) | null = null;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
        width: var(--v4-drawer-width, 320px);
        height: 100%;
        flex-shrink: 0;
      }

      :host(:not([is-open])) {
        display: none;
      }

      .drawer {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--v4-glass-bg, rgba(30, 30, 30, 0.7));
        backdrop-filter: var(--v4-glass-blur, blur(12px));
        -webkit-backdrop-filter: var(--v4-glass-blur, blur(12px));
        border-left: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
      }

      /* Header */
      .drawer-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.1));
      }

      .drawer-title {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 600;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--theme-text, #e0e0e0);
      }

      .close-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.15));
        color: var(--theme-text, #e0e0e0);
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
          color 0.2s,
          background 0.2s,
          border-color 0.2s,
          transform 0.15s;
      }

      .close-btn svg {
        width: 16px;
        height: 16px;
      }

      .close-btn:hover {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.15);
        border-color: rgba(255, 107, 107, 0.3);
        transform: scale(1.05);
      }

      .close-btn:active {
        transform: scale(0.95);
      }

      /* Header Actions Container */
      .header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      /* Action Buttons (Random, Clear) */
      .action-btn {
        background: none;
        border: none;
        color: var(--v4-text-secondary, #a0a0a0);
        cursor: pointer;
        padding: 6px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition:
          color 0.2s,
          background 0.2s,
          transform 0.15s;
      }

      .action-btn:hover {
        color: var(--theme-primary, #d4af37);
        background: rgba(212, 175, 55, 0.1);
        transform: scale(1.05);
      }

      .action-btn:active {
        transform: scale(0.95);
      }

      .action-btn svg {
        width: 18px;
        height: 18px;
      }

      .action-btn.random-btn:hover {
        color: var(--theme-primary, #d4af37);
      }

      .action-btn.clear-btn:hover {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.1);
      }

      /* Drawer Content */
      .drawer-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        scrollbar-width: thin;
      }

      .drawer-content::-webkit-scrollbar {
        width: 6px;
      }

      .drawer-content::-webkit-scrollbar-track {
        background: transparent;
      }

      .drawer-content::-webkit-scrollbar-thumb {
        background: var(--theme-border, rgba(255, 255, 255, 0.2));
        border-radius: 3px;
      }

      /* Search Box */
      .search-box {
        position: relative;
        margin-bottom: 16px;
      }

      .search-input {
        width: 100%;
        padding: 10px 12px 10px 36px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.1));
        border-radius: 8px;
        color: var(--theme-text, #e0e0e0);
        font-size: 14px;
        outline: none;
        transition:
          border-color 0.2s,
          background 0.2s;
      }

      .search-input::placeholder {
        color: var(--v4-text-secondary, #a0a0a0);
      }

      .search-input:focus {
        border-color: var(--theme-primary, #d4af37);
        background: rgba(255, 255, 255, 0.08);
      }

      .search-icon {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 16px;
        height: 16px;
        color: var(--v4-text-secondary, #a0a0a0);
        pointer-events: none;
      }

      /* Filter Chips */
      .filter-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 16px;
      }

      .filter-chip {
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.1));
        border-radius: 16px;
        color: var(--v4-text-secondary, #a0a0a0);
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .filter-chip:hover {
        background: rgba(255, 255, 255, 0.1);
        color: var(--theme-text, #e0e0e0);
      }

      .filter-chip.active {
        background: var(--theme-primary, #d4af37);
        border-color: var(--theme-primary, #d4af37);
        color: var(--theme-text-on-primary, #000);
      }

      /* Favorites Section */
      .favorites-section {
        margin-bottom: 16px;
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.1));
        border-radius: 8px;
        overflow: hidden;
      }

      .section-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: rgba(255, 255, 255, 0.03);
        cursor: pointer;
        user-select: none;
      }

      .section-header:hover {
        background: rgba(255, 255, 255, 0.06);
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--v4-text-secondary, #a0a0a0);
      }

      .favorites-icon {
        width: 14px;
        height: 14px;
        color: var(--theme-primary, #d4af37);
      }

      .chevron {
        width: 16px;
        height: 16px;
        color: var(--v4-text-secondary, #a0a0a0);
        transition: transform 0.2s;
      }

      .chevron.collapsed {
        transform: rotate(-90deg);
      }

      .favorites-content {
        padding: 12px;
        display: none;
      }

      .favorites-content.expanded {
        display: block;
      }

      .favorites-empty {
        font-size: 12px;
        color: var(--v4-text-secondary, #a0a0a0);
        text-align: center;
        padding: 8px;
        font-style: italic;
      }

      /* Swatch Grid */
      .swatch-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 6px;
      }

      .swatch {
        aspect-ratio: 1;
        border-radius: 6px;
        cursor: pointer;
        border: 2px solid transparent;
        transition:
          transform 0.15s,
          border-color 0.15s,
          box-shadow 0.15s;
        position: relative;
      }

      .swatch:hover {
        transform: scale(1.1);
        z-index: 10;
        border-color: rgba(255, 255, 255, 0.5);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      }

      .swatch:active {
        transform: scale(1.05);
      }

      .swatch[title]::after {
        content: attr(title);
        position: absolute;
        bottom: calc(100% + 6px);
        left: 50%;
        transform: translateX(-50%);
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.9);
        border-radius: 4px;
        font-size: 11px;
        color: #fff;
        white-space: nowrap;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.15s;
        z-index: 100;
      }

      .swatch:hover[title]::after {
        opacity: 1;
      }

      /* Favorite Star Button */
      .swatch-favorite-btn {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 18px;
        height: 18px;
        padding: 2px;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.5);
        color: var(--v4-text-secondary, #a0a0a0);
        cursor: pointer;
        opacity: 0;
        transform: scale(0.8);
        transition:
          opacity 0.15s,
          transform 0.15s,
          color 0.15s,
          background 0.15s;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .swatch:hover .swatch-favorite-btn {
        opacity: 1;
        transform: scale(1);
      }

      .swatch-favorite-btn:hover {
        background: rgba(0, 0, 0, 0.7);
        color: var(--theme-primary, #d4af37);
      }

      .swatch-favorite-btn.is-favorite {
        opacity: 1;
        color: var(--theme-primary, #d4af37);
      }

      .swatch-favorite-btn.is-favorite:hover {
        color: #ff6b6b;
      }

      .swatch-favorite-btn svg {
        width: 12px;
        height: 12px;
      }

      /* Always show star in favorites section for easy removal */
      .favorites-content .swatch-favorite-btn {
        opacity: 1;
        transform: scale(1);
        background: rgba(0, 0, 0, 0.6);
        color: var(--theme-primary, #d4af37);
      }

      .favorites-content .swatch-favorite-btn:hover {
        background: rgba(220, 53, 69, 0.8);
        color: white;
      }

      /* Category Sections */
      .category-section {
        margin-bottom: 16px;
      }

      .category-label {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--v4-text-secondary, #a0a0a0);
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.05));
      }

      /* No Results */
      .no-results {
        text-align: center;
        padding: 24px 16px;
        color: var(--v4-text-secondary, #a0a0a0);
        font-size: 13px;
      }

      .no-results-icon {
        width: 32px;
        height: 32px;
        margin: 0 auto 12px;
        opacity: 0.5;
      }

      /* Custom Color Section */
      .custom-color-section {
        margin-bottom: 16px;
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.1));
        border-radius: 8px;
        overflow: hidden;
      }

      .custom-color-content {
        padding: 12px;
        display: none;
      }

      .custom-color-content.expanded {
        display: block;
      }

      .custom-color-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }

      .custom-color-preview {
        width: 40px;
        height: 40px;
        border-radius: 6px;
        border: 2px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.2));
        flex-shrink: 0;
      }

      .custom-color-inputs {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .custom-hex-input {
        width: 100%;
        padding: 8px 10px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.1));
        border-radius: 6px;
        color: var(--theme-text, #e0e0e0);
        font-family: 'JetBrains Mono', monospace;
        font-size: 13px;
        outline: none;
        transition:
          border-color 0.2s,
          background 0.2s;
      }

      .custom-hex-input:focus {
        border-color: var(--theme-primary, #d4af37);
        background: rgba(255, 255, 255, 0.08);
      }

      .custom-hex-input.invalid {
        border-color: #ff6b6b;
      }

      .custom-color-picker {
        width: 100%;
        height: 32px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        background: transparent;
      }

      .custom-color-picker::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      .custom-color-picker::-webkit-color-swatch {
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.2));
        border-radius: 6px;
      }

      .custom-apply-btn {
        width: 100%;
        padding: 10px 16px;
        background: var(--theme-primary, #d4af37);
        color: var(--theme-text-on-primary, #000);
        border: none;
        border-radius: 6px;
        font-family: 'Space Grotesk', sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition:
          background 0.2s,
          transform 0.15s,
          opacity 0.2s;
      }

      .custom-apply-btn:hover:not(:disabled) {
        background: var(--theme-primary-hover, #c49f2f);
        transform: scale(1.02);
      }

      .custom-apply-btn:active:not(:disabled) {
        transform: scale(0.98);
      }

      .custom-apply-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ];

  // =========================================================================
  // Lifecycle
  // =========================================================================

  connectedCallback(): void {
    super.connectedCallback();
    this.loadDyes();
    this.subscribeToFavorites();
    // Subscribe to language changes to update translated text
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.requestUpdate();
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.unsubscribeFavorites) {
      this.unsubscribeFavorites();
      this.unsubscribeFavorites = null;
    }
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
  }

  // =========================================================================
  // Data Loading
  // =========================================================================

  private loadDyes(): void {
    try {
      const dyeService = DyeService.getInstance();
      this.allDyes = dyeService.getAllDyes().filter((d) => d.category !== 'Facewear');
      this.applyFilters();
      logger.debug(`[DyePaletteDrawer] Loaded ${this.allDyes.length} dyes`);
    } catch (error) {
      logger.error('[DyePaletteDrawer] Failed to load dyes:', error);
    }
  }

  private subscribeToFavorites(): void {
    // Load initial favorites
    const favoriteIds = CollectionService.getFavorites();
    this.favoriteIds = new Set(favoriteIds);
    this.updateFavoriteDyes(favoriteIds);

    // Subscribe to changes
    this.unsubscribeFavorites = CollectionService.subscribeFavorites((ids) => {
      this.favoriteIds = new Set(ids);
      this.updateFavoriteDyes(ids);
    });
  }

  private updateFavoriteDyes(favoriteIds: number[]): void {
    const dyeService = DyeService.getInstance();
    this.favoriteDyes = favoriteIds
      .map((id) => dyeService.getDyeById(id))
      .filter((dye): dye is Dye => dye !== null);
  }

  // =========================================================================
  // Filtering
  // =========================================================================

  private applyFilters(): void {
    let dyes = [...this.allDyes];

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      dyes = dyes.filter((d) => d.name.toLowerCase().includes(query));
    }

    // Apply category filter
    if (this.activeFilter !== 'all') {
      dyes = this.filterByType(dyes, this.activeFilter);
    }

    this.filteredDyes = dyes;
  }

  private filterByType(dyes: Dye[], filter: DyeFilter): Dye[] {
    switch (filter) {
      case 'metallic':
        return dyes.filter((d) => d.name.toLowerCase().includes('metallic'));
      case 'pastel':
        return dyes.filter((d) => d.name.toLowerCase().includes('pastel'));
      case 'dark':
        return dyes.filter((d) => d.hsv.v < 40);
      case 'vibrant':
        return dyes.filter((d) => d.hsv.s > 60 && d.hsv.v > 50);
      default:
        return dyes;
    }
  }

  private groupByCategory(dyes: Dye[]): Map<string, Dye[]> {
    const groups = new Map<string, Dye[]>();

    for (const category of DYE_CATEGORY_ORDER) {
      const categoryDyes = dyes.filter((d) => d.category === category);
      if (categoryDyes.length > 0) {
        groups.set(category, categoryDyes);
      }
    }

    // Add any remaining categories not in our order
    for (const dye of dyes) {
      if (!DYE_CATEGORY_ORDER.includes(dye.category as (typeof DYE_CATEGORY_ORDER)[number])) {
        const existing = groups.get(dye.category) || [];
        existing.push(dye);
        groups.set(dye.category, existing);
      }
    }

    return groups;
  }

  // =========================================================================
  // Event Handlers
  // =========================================================================

  private handleSearchInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.searchQuery = input.value;
    this.applyFilters();
  }

  private handleFilterClick(filter: DyeFilter): void {
    this.activeFilter = filter;
    this.applyFilters();
  }

  private handleToggleFavorites(): void {
    this.favoritesExpanded = !this.favoritesExpanded;
  }

  private handleDyeClick(dye: Dye): void {
    this.emit('dye-selected', { dye });
    logger.debug(`[DyePaletteDrawer] Dye selected: ${dye.name}`);
  }

  private handleClose(): void {
    this.emit('drawer-toggle');
  }

  /**
   * Select a random dye from all available dyes.
   * Emits dye-selected with the randomly chosen dye.
   */
  private handleRandomDye(): void {
    if (this.allDyes.length === 0) {
      ToastService.warning(LanguageService.t('colorPalette.noDyesAvailable'));
      return;
    }

    const randomIndex = Math.floor(Math.random() * this.allDyes.length);
    const randomDye = this.allDyes[randomIndex];

    this.emit('dye-selected', { dye: randomDye });
    logger.debug(`[DyePaletteDrawer] Random dye selected: ${randomDye.name}`);
    ToastService.info(
      LanguageService.tInterpolate('colorPalette.randomDyeSelected', { name: randomDye.name })
    );
  }

  /**
   * Clear all dye selections for the active tool.
   * Emits clear-all-dyes event for parent to handle.
   */
  private handleClearDyes(): void {
    this.emit('clear-all-dyes');
    logger.debug('[DyePaletteDrawer] Clear all dyes requested');
  }

  /**
   * Toggle favorite status for a dye.
   * Prevents event bubbling to avoid triggering dye selection.
   */
  private handleFavoriteToggle(e: Event, dye: Dye): void {
    e.stopPropagation();
    e.preventDefault();

    const wasFavorite = this.favoriteIds.has(dye.id);
    const result = CollectionService.toggleFavorite(dye.id);

    if (!result && !wasFavorite) {
      // Failed to add - likely at limit
      const maxFavorites = CollectionService.getMaxFavorites();
      ToastService.warning(
        LanguageService.tInterpolate('collections.favoritesFull', { max: String(maxFavorites) })
      );
    } else {
      logger.debug(
        `[DyePaletteDrawer] ${wasFavorite ? 'Removed' : 'Added'} ${dye.name} ${wasFavorite ? 'from' : 'to'} favorites`
      );
    }
  }

  /**
   * Check if a dye is currently favorited
   */
  private isFavorite(dyeId: number): boolean {
    return this.favoriteIds.has(dyeId);
  }

  // =========================================================================
  // Custom Color Handlers
  // =========================================================================

  /**
   * Toggle custom color section expanded state
   */
  private handleToggleCustomColor(): void {
    this.customColorExpanded = !this.customColorExpanded;
  }

  /**
   * Handle hex input changes with validation
   */
  private handleCustomHexInput(e: Event): void {
    const input = e.target as HTMLInputElement;
    let value = input.value.trim().toUpperCase();

    // Auto-prepend # if missing
    if (value && !value.startsWith('#')) {
      value = '#' + value;
    }

    this.customColorHex = value;
  }

  /**
   * Handle color picker input - sync to hex
   */
  private handleCustomColorPicker(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.customColorHex = input.value.toUpperCase();
  }

  /**
   * Validate if the current hex color is valid
   */
  private isValidHex(): boolean {
    return /^#[0-9A-Fa-f]{6}$|^#[0-9A-Fa-f]{3}$/.test(this.customColorHex);
  }

  /**
   * Apply the custom color - emit event for tool to handle
   */
  private handleApplyCustomColor(): void {
    if (!this.isValidHex()) {
      ToastService.warning(LanguageService.t('colorPalette.invalidHexCode'));
      return;
    }

    // Normalize 3-char hex to 6-char
    let hex = this.customColorHex.toUpperCase();
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }

    this.emit('custom-color-selected', { hex });
    logger.debug(`[DyePaletteDrawer] Custom color applied: ${hex}`);
    ToastService.info(LanguageService.t('colorPalette.customColorApplied'));
  }

  // =========================================================================
  // Render
  // =========================================================================

  protected override render(): TemplateResult {
    const groupedDyes = this.groupByCategory(this.filteredDyes);

    return html`
      <aside class="drawer">
        <div class="drawer-header">
          <span class="drawer-title">${LanguageService.t('colorPalette.title')}</span>
          <div class="header-actions">
            <button
              class="action-btn random-btn"
              @click=${this.handleRandomDye}
              title="${LanguageService.t('aria.selectRandomDye')}"
              aria-label="${LanguageService.t('aria.selectRandomDye')}"
            >
              ${unsafeHTML(ICON_DICE)}
            </button>
            <button
              class="action-btn clear-btn"
              @click=${this.handleClearDyes}
              title="${LanguageService.t('aria.clearAllDyes')}"
              aria-label="${LanguageService.t('aria.clearAllDyes')}"
            >
              ${unsafeHTML(ICON_BROOM)}
            </button>
            <button
              class="close-btn"
              @click=${this.handleClose}
              title="${LanguageService.t('aria.closePalette')}"
              aria-label="${LanguageService.t('aria.closePalette')}"
            >
              ${unsafeHTML(ICON_CLOSE)}
            </button>
          </div>
        </div>

        <div class="drawer-content">
          ${this.renderSearch()} ${this.renderFilters()}
          ${this.shouldShowCustomColor ? this.renderCustomColor() : nothing}
          ${this.renderFavorites()} ${this.renderDyeGrid(groupedDyes)}
        </div>
      </aside>
    `;
  }

  private renderSearch(): TemplateResult {
    return html`
      <div class="search-box">
        <svg
          class="search-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          class="search-input"
          placeholder=${LanguageService.t('colorPalette.searchPlaceholder')}
          .value=${this.searchQuery}
          @input=${this.handleSearchInput}
        />
      </div>
    `;
  }

  private renderFilters(): TemplateResult {
    const filters: { id: DyeFilter; labelKey: string }[] = [
      { id: 'all', labelKey: 'colorPalette.all' },
      { id: 'metallic', labelKey: 'colorPalette.metallic' },
      { id: 'pastel', labelKey: 'colorPalette.pastel' },
      { id: 'dark', labelKey: 'colorPalette.dark' },
      { id: 'vibrant', labelKey: 'colorPalette.vibrant' },
    ];

    return html`
      <div class="filter-bar">
        ${filters.map(
          (f) => html`
            <button
              class="filter-chip ${this.activeFilter === f.id ? 'active' : ''}"
              @click=${() => this.handleFilterClick(f.id)}
            >
              ${LanguageService.t(f.labelKey)}
            </button>
          `
        )}
      </div>
    `;
  }

  /**
   * Render the custom color input section
   */
  private renderCustomColor(): TemplateResult {
    const isValid = this.isValidHex();
    // Normalize hex for color picker (needs 6-char format)
    let pickerValue = this.customColorHex;
    if (pickerValue.length === 4) {
      pickerValue =
        '#' +
        pickerValue[1] +
        pickerValue[1] +
        pickerValue[2] +
        pickerValue[2] +
        pickerValue[3] +
        pickerValue[3];
    }
    if (!isValid) {
      pickerValue = '#FF5500'; // Default fallback
    }

    return html`
      <div class="custom-color-section">
        <div class="section-header" @click=${this.handleToggleCustomColor}>
          <span class="section-title">
            <svg class="favorites-icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
              />
            </svg>
            ${LanguageService.t('colorPalette.customColor')}
          </span>
          <svg
            class="chevron ${this.customColorExpanded ? '' : 'collapsed'}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div class="custom-color-content ${this.customColorExpanded ? 'expanded' : ''}">
          <div class="custom-color-row">
            <div
              class="custom-color-preview"
              style="background-color: ${isValid ? this.customColorHex : '#FF5500'}"
            ></div>
            <div class="custom-color-inputs">
              <input
                type="text"
                class="custom-hex-input ${isValid ? '' : 'invalid'}"
                placeholder=${LanguageService.t('colorPalette.enterHexCode')}
                .value=${this.customColorHex}
                @input=${this.handleCustomHexInput}
                maxlength="7"
              />
              <input
                type="color"
                class="custom-color-picker"
                .value=${pickerValue}
                @input=${this.handleCustomColorPicker}
              />
            </div>
          </div>
          <button
            class="custom-apply-btn"
            ?disabled=${!isValid}
            @click=${this.handleApplyCustomColor}
          >
            ${LanguageService.t('colorPalette.applyCustomColor')}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Get localized dye name, falling back to English name
   */
  private getLocalizedDyeName(dye: Dye): string {
    return LanguageService.getDyeName(dye.id) || dye.name;
  }

  /**
   * Render a single dye swatch with favorite star button
   */
  private renderSwatch(dye: Dye): TemplateResult {
    const isFav = this.isFavorite(dye.id);
    const localizedName = this.getLocalizedDyeName(dye);

    return html`
      <div
        class="swatch"
        style="background-color: ${dye.hex}"
        title="${localizedName}"
        @click=${() => this.handleDyeClick(dye)}
      >
        <button
          class="swatch-favorite-btn ${isFav ? 'is-favorite' : ''}"
          type="button"
          title="${isFav
            ? LanguageService.t('aria.removeFromFavorites')
            : LanguageService.t('aria.addToFavorites')}"
          aria-label="${isFav
            ? `${LanguageService.t('aria.removeFromFavorites')}: ${localizedName}`
            : `${LanguageService.t('aria.addToFavorites')}: ${localizedName}`}"
          @click=${(e: Event) => this.handleFavoriteToggle(e, dye)}
        >
          ${isFav
            ? html`<svg viewBox="0 0 20 20" fill="currentColor">
                <path
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                />
              </svg>`
            : html`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
                <path
                  d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                />
              </svg>`}
        </button>
      </div>
    `;
  }

  private renderFavorites(): TemplateResult {
    return html`
      <div class="favorites-section">
        <div class="section-header" @click=${this.handleToggleFavorites}>
          <span class="section-title">
            <svg class="favorites-icon" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              />
            </svg>
            ${LanguageService.t('colorPalette.favorites')} (${this.favoriteDyes.length})
          </span>
          <svg
            class="chevron ${this.favoritesExpanded ? '' : 'collapsed'}"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <div class="favorites-content ${this.favoritesExpanded ? 'expanded' : ''}">
          ${this.favoriteDyes.length > 0
            ? html`
                <div class="swatch-grid">
                  ${this.favoriteDyes.map((dye) => this.renderSwatch(dye))}
                </div>
              `
            : html`
                <div class="favorites-empty">
                  ${LanguageService.t('collections.favoritesEmptyHint')}
                </div>
              `}
        </div>
      </div>
    `;
  }

  private renderDyeGrid(groupedDyes: Map<string, Dye[]>): TemplateResult {
    if (groupedDyes.size === 0) {
      return html`
        <div class="no-results">
          <svg
            class="no-results-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
            <path d="M8 8l6 6M14 8l-6 6" />
          </svg>
          <p>${LanguageService.t('colorPalette.noDyesFound')}</p>
        </div>
      `;
    }

    return html`
      ${Array.from(groupedDyes.entries()).map(
        ([category, dyes]) => html`
          <div class="category-section">
            <div class="category-label">
              ${LanguageService.t(CATEGORY_TRANSLATION_KEYS[category] || category)}
            </div>
            <div class="swatch-grid">${dyes.map((dye) => this.renderSwatch(dye))}</div>
          </div>
        `
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dye-palette-drawer': DyePaletteDrawer;
  }
}
