/**
 * XIV Dye Tools v3.0.0 - Budget Tool Component
 *
 * Phase 8: Budget Suggestions - Find affordable dye alternatives.
 * Helps players find cheaper alternatives to expensive dyes within their budget.
 *
 * Left Panel: Target dye selector, quick picks, budget slider, sort options, filters, market board
 * Right Panel: Target overview, alternatives list with price/savings display
 *
 * @module components/tools/budget-tool
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { DyeSelector } from '@components/dye-selector';
import { DyeFilters } from '@components/dye-filters';
import { MarketBoard } from '@components/market-board';
import '@components/v4/result-card';
import { ResultCard, type ResultCardData, type ContextAction } from '@components/v4/result-card';
import {
  ColorService,
  ConfigController,
  dyeService,
  LanguageService,
  MarketBoardService,
  StorageService,
  ToastService,
  applyDisplayOptions,
  formatPriceWithSuffix,
} from '@services/index';
import type { DisplayOptionsConfig } from '@shared/tool-config-types';
import { RouterService } from '@services/router-service';
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import { ICON_TOOL_BUDGET } from '@shared/tool-icons';
import {
  ICON_FILTER,
  ICON_MARKET,
  ICON_TARGET,
  ICON_SPARKLES,
  ICON_COINS,
  ICON_SORT,
  ICON_DISTANCE,
  ICON_EYE,
} from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, PriceData } from '@shared/types';
import type { BudgetConfig } from '@shared/tool-config-types';

// ============================================================================
// Types and Constants
// ============================================================================

export interface BudgetToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Alternative dye with price and savings data
 */
interface AlternativeDye {
  dye: Dye;
  distance: number;
  price: number;
  savings: number;
  valueScore: number;
}

/**
 * Storage keys for v3 budget tool
 */
const STORAGE_KEYS = {
  targetDyeId: 'v3_budget_target',
  budgetLimit: 'v3_budget_limit',
  sortBy: 'v3_budget_sort',
  colorDistance: 'v3_budget_distance',
  resultLimit: 'v3_budget_result_limit',
  showHex: 'v3_budget_show_hex',
  showRgb: 'v3_budget_show_rgb',
  showHsv: 'v3_budget_show_hsv',
  showLab: 'v3_budget_show_lab',
  showPrice: 'v3_budget_show_price',
  showDeltaE: 'v3_budget_show_delta_e',
  showAcquisition: 'v3_budget_show_acquisition',
} as const;

/**
 * Default values
 */
const DEFAULTS = {
  budgetLimit: 100000,
  sortBy: 'match' as const,
  colorDistance: 50,
  resultLimit: 8,
};

/**
 * Popular expensive dyes for quick picks
 */
const POPULAR_EXPENSIVE_DYE_NAMES = [
  'Pure White',
  'Jet Black',
  'Carmine Red',
  'Violet Purple',
  'Azure Blue',
  'Bright Orange',
];

// ============================================================================
// BudgetTool Component
// ============================================================================

/**
 * Budget Tool - v3 Two-Panel Layout
 *
 * Find affordable alternatives to expensive dyes within budget constraints.
 */
export class BudgetTool extends BaseComponent {
  private options: BudgetToolOptions;

  // State
  private targetDye: Dye | null = null;
  private budgetLimit: number;
  private sortBy: 'match' | 'price' | 'value';
  private colorDistance: number;
  private resultLimit: number;
  private alternatives: AlternativeDye[] = [];
  private totalAffordableCount: number = 0; // Track total before limit applied
  private priceData: Map<number, PriceData> = new Map();
  private targetPrice: number = 0;
  private isLoading: boolean = false;
  private fetchProgress: { current: number; total: number } = { current: 0, total: 0 };

  // Display options
  private showHex: boolean = true;
  private showRgb: boolean = false;
  private showHsv: boolean = false;
  private showLab: boolean = false;
  private showPrice: boolean = true;
  private showDeltaE: boolean = true;
  private showAcquisition: boolean = true;

  // Child components
  private dyeSelector: DyeSelector | null = null;
  private dyeFilters: DyeFilters | null = null;
  private marketBoard: MarketBoard | null = null;
  private marketBoardService: MarketBoardService;
  private filtersPanel: CollapsiblePanel | null = null;
  private marketPanel: CollapsiblePanel | null = null;
  private targetDyePanel: CollapsiblePanel | null = null;
  private quickPicksPanel: CollapsiblePanel | null = null;
  private budgetLimitPanel: CollapsiblePanel | null = null;
  private sortByPanel: CollapsiblePanel | null = null;
  private colorDistancePanel: CollapsiblePanel | null = null;
  private colorFormatsPanel: CollapsiblePanel | null = null;

  // DOM References
  private targetDyeContainer: HTMLElement | null = null;
  private budgetValueDisplay: HTMLElement | null = null;
  private distanceValueDisplay: HTMLElement | null = null;
  private resultLimitValueDisplay: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private targetOverviewContainer: HTMLElement | null = null;
  private alternativesSection: HTMLElement | null = null;
  private alternativesHeaderContainer: HTMLElement | null = null;
  private alternativesListContainer: HTMLElement | null = null;
  private quickPickButtons: HTMLButtonElement[] = [];

  // Mobile drawer components (separate from desktop)
  private mobileDyeSelector: DyeSelector | null = null;
  private mobileDyeFilters: DyeFilters | null = null;
  private mobileMarketBoard: MarketBoard | null = null;
  private mobileTargetDyePanel: CollapsiblePanel | null = null;
  private mobileQuickPicksPanel: CollapsiblePanel | null = null;
  private mobileBudgetLimitPanel: CollapsiblePanel | null = null;
  private mobileSortByPanel: CollapsiblePanel | null = null;
  private mobileColorDistancePanel: CollapsiblePanel | null = null;
  private mobileColorFormatsPanel: CollapsiblePanel | null = null;
  private mobileFiltersPanel: CollapsiblePanel | null = null;
  private mobileMarketPanel: CollapsiblePanel | null = null;
  private mobileTargetDyeContainer: HTMLElement | null = null;
  private mobileBudgetValueDisplay: HTMLElement | null = null;
  private mobileDistanceValueDisplay: HTMLElement | null = null;
  private mobileResultLimitValueDisplay: HTMLElement | null = null;
  private mobileQuickPickButtons: HTMLButtonElement[] = [];

  // Subscriptions
  private languageUnsubscribe: (() => void) | null = null;
  private configUnsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, options: BudgetToolOptions) {
    super(container);
    this.options = options;

    // Initialize MarketBoardService (shared price cache)
    this.marketBoardService = MarketBoardService.getInstance();

    // Load persisted settings
    this.budgetLimit =
      StorageService.getItem<number>(STORAGE_KEYS.budgetLimit) ?? DEFAULTS.budgetLimit;
    this.sortBy =
      StorageService.getItem<'match' | 'price' | 'value'>(STORAGE_KEYS.sortBy) ?? DEFAULTS.sortBy;
    this.colorDistance =
      StorageService.getItem<number>(STORAGE_KEYS.colorDistance) ?? DEFAULTS.colorDistance;
    this.resultLimit =
      StorageService.getItem<number>(STORAGE_KEYS.resultLimit) ?? DEFAULTS.resultLimit;

    // Load display options
    this.showHex = StorageService.getItem<boolean>(STORAGE_KEYS.showHex) ?? true;
    this.showRgb = StorageService.getItem<boolean>(STORAGE_KEYS.showRgb) ?? false;
    this.showHsv = StorageService.getItem<boolean>(STORAGE_KEYS.showHsv) ?? false;
    this.showLab = StorageService.getItem<boolean>(STORAGE_KEYS.showLab) ?? false;
    this.showPrice = StorageService.getItem<boolean>(STORAGE_KEYS.showPrice) ?? true;
    this.showDeltaE = StorageService.getItem<boolean>(STORAGE_KEYS.showDeltaE) ?? true;
    this.showAcquisition = StorageService.getItem<boolean>(STORAGE_KEYS.showAcquisition) ?? true;

    // Load persisted target dye
    const savedDyeId = StorageService.getItem<number>(STORAGE_KEYS.targetDyeId);
    if (savedDyeId) {
      this.targetDye = dyeService.getDyeById(savedDyeId) || null;
    }
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  renderContent(): void {
    this.renderLeftPanel();
    this.renderRightPanel();

    if (this.options.drawerContent) {
      this.renderDrawerContent();
    }

    this.element = this.container;
  }

  bindEvents(): void {
    // Event bindings handled in child components
  }

  onMount(): void {
    // Subscribe to language changes (only in onMount, NOT bindEvents - avoids infinite loop)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update();
    });

    // Subscribe to config changes from V4 ConfigSidebar
    this.configUnsubscribe = ConfigController.getInstance().subscribe('budget', (config) => {
      this.setConfig(config);
    });

    // Enable market board by default for Budget Tool (prices are core to this tool)
    this.marketBoardService.setShowPrices(true);

    logger.info('[BudgetTool] Mounted');

    // Handle deep linking
    this.handleDeepLink();

    // Load initial data if target dye is set
    if (this.targetDye) {
      this.findAlternatives();
    }
  }

  destroy(): void {
    this.languageUnsubscribe?.();
    this.configUnsubscribe?.();

    // Desktop components
    this.dyeSelector?.destroy();
    this.dyeFilters?.destroy();
    this.marketBoard?.destroy();
    this.filtersPanel?.destroy();
    this.marketPanel?.destroy();
    this.targetDyePanel?.destroy();
    this.quickPicksPanel?.destroy();
    this.budgetLimitPanel?.destroy();
    this.sortByPanel?.destroy();
    this.colorDistancePanel?.destroy();
    this.colorFormatsPanel?.destroy();

    // Mobile components
    this.mobileDyeSelector?.destroy();
    this.mobileDyeFilters?.destroy();
    this.mobileMarketBoard?.destroy();
    this.mobileTargetDyePanel?.destroy();
    this.mobileQuickPicksPanel?.destroy();
    this.mobileBudgetLimitPanel?.destroy();
    this.mobileSortByPanel?.destroy();
    this.mobileColorDistancePanel?.destroy();
    this.mobileColorFormatsPanel?.destroy();
    this.mobileFiltersPanel?.destroy();
    this.mobileMarketPanel?.destroy();

    this.targetDye = null;
    this.alternatives = [];
    this.priceData.clear();
    this.quickPickButtons = [];
    this.mobileQuickPickButtons = [];

    super.destroy();
    logger.info('[BudgetTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   */
  public setConfig(config: Partial<BudgetConfig>): void {
    let needsRefilter = false;

    // Handle maxPrice (maps to budgetLimit)
    if (config.maxPrice !== undefined && config.maxPrice !== this.budgetLimit) {
      this.budgetLimit = config.maxPrice;
      StorageService.setItem(STORAGE_KEYS.budgetLimit, config.maxPrice);
      needsRefilter = true;
      logger.info(`[BudgetTool] setConfig: maxPrice -> ${config.maxPrice}`);

      // Update desktop display
      if (this.budgetValueDisplay) {
        this.budgetValueDisplay.textContent = formatPriceWithSuffix(config.maxPrice);
      }
      // Update mobile display
      if (this.mobileBudgetValueDisplay) {
        this.mobileBudgetValueDisplay.textContent = formatPriceWithSuffix(config.maxPrice);
      }
    }

    // Handle maxResults (maps to resultLimit)
    if (config.maxResults !== undefined && config.maxResults !== this.resultLimit) {
      this.resultLimit = config.maxResults;
      StorageService.setItem(STORAGE_KEYS.resultLimit, config.maxResults);
      needsRefilter = true;
      logger.info(`[BudgetTool] setConfig: maxResults -> ${config.maxResults}`);

      // Update desktop display
      if (this.resultLimitValueDisplay) {
        this.resultLimitValueDisplay.textContent = String(config.maxResults);
      }
      // Update mobile display
      if (this.mobileResultLimitValueDisplay) {
        this.mobileResultLimitValueDisplay.textContent = String(config.maxResults);
      }
    }

    // Handle maxDeltaE (maps to colorDistance)
    if (config.maxDeltaE !== undefined && config.maxDeltaE !== this.colorDistance) {
      this.colorDistance = config.maxDeltaE;
      StorageService.setItem(STORAGE_KEYS.colorDistance, config.maxDeltaE);
      needsRefilter = true;
      logger.info(`[BudgetTool] setConfig: maxDeltaE -> ${config.maxDeltaE}`);

      // Update desktop display
      if (this.distanceValueDisplay) {
        this.distanceValueDisplay.textContent = String(config.maxDeltaE);
      }
      // Update mobile display
      if (this.mobileDistanceValueDisplay) {
        this.mobileDistanceValueDisplay.textContent = String(config.maxDeltaE);
      }
    }

    // Handle displayOptions from v4-display-options component
    // WEB-REF-003: Using shared applyDisplayOptions helper
    let needsRerender = false;
    if (config.displayOptions) {
      // Build current state as DisplayOptionsConfig
      const currentOptions: DisplayOptionsConfig = {
        showHex: this.showHex,
        showRgb: this.showRgb,
        showHsv: this.showHsv,
        showLab: this.showLab,
        showPrice: this.showPrice,
        showDeltaE: this.showDeltaE,
        showAcquisition: this.showAcquisition,
      };

      const result = applyDisplayOptions({
        current: currentOptions,
        incoming: config.displayOptions,
        toolName: 'BudgetTool',
        onChange: (key, value) => {
          // Persist each change to storage
          StorageService.setItem(STORAGE_KEYS[key], value);
        },
      });

      if (result.hasChanges) {
        // Distribute updated values back to individual properties
        this.showHex = result.options.showHex;
        this.showRgb = result.options.showRgb;
        this.showHsv = result.options.showHsv;
        this.showLab = result.options.showLab;
        this.showPrice = result.options.showPrice;
        this.showDeltaE = result.options.showDeltaE;
        this.showAcquisition = result.options.showAcquisition;
        needsRerender = true;
      }
    }

    // Re-filter and re-render if any config changed and we have data
    if (needsRefilter && this.targetDye) {
      // For maxDeltaE changes, we need to re-fetch alternatives since the distance threshold changed
      if (config.maxDeltaE !== undefined) {
        void this.findAlternatives();
      } else {
        // For budget/result limit changes, just re-filter existing data
        this.filterAndSortAlternatives();
      }
      this.updateDrawerContent();
    }

    // Re-render cards if display options changed
    if (needsRerender && this.targetDye) {
      this.renderTargetOverview();
      this.renderAlternativesList();
    }
  }

  // ============================================================================
  // Deep Linking Support
  // ============================================================================

  /**
   * Handle URL parameters for cross-tool navigation
   */
  private handleDeepLink(): void {
    const params = new URLSearchParams(window.location.search);
    const dyeName = params.get('dye');

    if (dyeName) {
      // Search for dye by name (exact match preferred)
      const matches = dyeService.searchByName(dyeName);
      const dye = matches.find((d) => d.name.toLowerCase() === dyeName.toLowerCase()) || matches[0];
      if (dye) {
        this.targetDye = dye;
        this.updateTargetDyeDisplay();
        this.updateQuickPickSelection();
        StorageService.setItem(STORAGE_KEYS.targetDyeId, dye.id);
        this.findAlternatives();
      }
    }
  }

  // ============================================================================
  // Left Panel Rendering
  // ============================================================================

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Section 1: Target Dye (collapsible, default open)
    const targetContainer = this.createElement('div');
    left.appendChild(targetContainer);
    this.targetDyePanel = new CollapsiblePanel(targetContainer, {
      title: LanguageService.t('budget.targetDye'),
      storageKey: 'v3_budget_target_panel',
      defaultOpen: true,
      icon: ICON_TARGET,
    });
    this.targetDyePanel.init();
    const targetContent = this.createElement('div');
    this.renderTargetDyeSection(targetContent);
    this.targetDyePanel.setContent(targetContent);

    // Section 2: Quick Picks (collapsible, default open)
    const quickContainer = this.createElement('div');
    left.appendChild(quickContainer);
    this.quickPicksPanel = new CollapsiblePanel(quickContainer, {
      title: LanguageService.t('budget.quickPicks'),
      storageKey: 'v3_budget_quickpicks_panel',
      defaultOpen: true,
      icon: ICON_SPARKLES,
    });
    this.quickPicksPanel.init();
    const quickContent = this.createElement('div');
    this.renderQuickPicksSection(quickContent);
    this.quickPicksPanel.setContent(quickContent);

    // Section 3: Budget Limit (collapsible, default open)
    const budgetContainer = this.createElement('div');
    left.appendChild(budgetContainer);
    this.budgetLimitPanel = new CollapsiblePanel(budgetContainer, {
      title: LanguageService.t('budget.budgetLimit'),
      storageKey: 'v3_budget_limit_panel',
      defaultOpen: true,
      icon: ICON_COINS,
    });
    this.budgetLimitPanel.init();
    const budgetContent = this.createElement('div');
    this.renderBudgetSection(budgetContent);
    this.budgetLimitPanel.setContent(budgetContent);

    // Section 4: Color Distance (collapsible, default closed)
    const distanceContainer = this.createElement('div');
    left.appendChild(distanceContainer);
    this.colorDistancePanel = new CollapsiblePanel(distanceContainer, {
      title: LanguageService.t('budget.colorDistance'),
      storageKey: 'v3_budget_distance_panel',
      defaultOpen: false,
      icon: ICON_DISTANCE,
    });
    this.colorDistancePanel.init();
    const distanceContent = this.createElement('div');
    this.renderColorDistanceSection(distanceContent);
    this.colorDistancePanel.setContent(distanceContent);

    // Section 5: Sort Options (collapsible, default closed)
    const sortContainer = this.createElement('div');
    left.appendChild(sortContainer);
    this.sortByPanel = new CollapsiblePanel(sortContainer, {
      title: LanguageService.t('budget.sortBy'),
      storageKey: 'v3_budget_sort_panel',
      defaultOpen: false,
      icon: ICON_SORT,
    });
    this.sortByPanel.init();
    const sortContent = this.createElement('div');
    this.renderSortSection(sortContent);
    this.sortByPanel.setContent(sortContent);

    // Section 6: Dye Filters (collapsible)
    const filtersContainer = this.createElement('div');
    left.appendChild(filtersContainer);
    this.filtersPanel = new CollapsiblePanel(filtersContainer, {
      title: LanguageService.t('filters.title'),
      storageKey: 'v3_budget_filters',
      defaultOpen: false,
      icon: ICON_FILTER,
    });
    this.filtersPanel.init();

    const filtersContent = this.createElement('div');
    this.dyeFilters = new DyeFilters(filtersContent, {
      storageKeyPrefix: 'v3_budget',
      onFilterChange: () => {
        this.findAlternatives();
      },
      hideHeader: true, // Prevent double-nesting with external CollapsiblePanel
    });
    this.dyeFilters.render();
    this.dyeFilters.bindEvents();
    this.filtersPanel.setContent(filtersContent);

    // Section 7: Color Formats (collapsible)
    const colorFormatsContainer = this.createElement('div');
    left.appendChild(colorFormatsContainer);
    this.colorFormatsPanel = new CollapsiblePanel(colorFormatsContainer, {
      title: LanguageService.t('config.colorFormats'),
      storageKey: 'v3_budget_color_formats',
      defaultOpen: false,
      icon: ICON_EYE,
    });
    this.colorFormatsPanel.init();

    const colorFormatsContent = this.createElement('div', { className: 'space-y-2' });
    this.renderColorFormatsOptions(colorFormatsContent);
    this.colorFormatsPanel.setContent(colorFormatsContent);

    // Section 8: Market Board (collapsible)
    const marketContainer = this.createElement('div');
    left.appendChild(marketContainer);
    this.marketPanel = new CollapsiblePanel(marketContainer, {
      title: LanguageService.t('marketBoard.title'),
      storageKey: 'v3_budget_market',
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    this.marketPanel.init();

    const marketContent = this.createElement('div');
    this.marketBoard = new MarketBoard(marketContent);
    this.marketBoard.init();

    // Set up market board event listeners - budget tool always needs prices
    setupMarketBoardListeners(marketContent, () => true, () => this.findAlternatives(), {
      onServerChanged: () => {
        this.findAlternatives();
      },
    });

    this.marketPanel.setContent(marketContent);
  }

  /**
   * Create a section with label
   */
  private createSection(label: string): HTMLElement {
    const section = this.createElement('div', {
      className: 'p-4 border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });
    const sectionLabel = this.createElement('h3', {
      className: 'text-sm font-semibold uppercase tracking-wider mb-3',
      textContent: label,
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    section.appendChild(sectionLabel);
    return section;
  }

  /**
   * Render color formats toggle options
   */
  private renderColorFormatsOptions(container: HTMLElement): void {
    const options = [
      { key: 'showHex' as const, label: LanguageService.t('config.hexCodes') },
      { key: 'showRgb' as const, label: LanguageService.t('config.rgbValues') },
      { key: 'showHsv' as const, label: LanguageService.t('config.hsvValues') },
      { key: 'showLab' as const, label: LanguageService.t('config.labValues') },
    ];

    for (const option of options) {
      const row = this.createElement('div', {
        className: 'flex items-center justify-between py-1',
      });

      const label = this.createElement('span', {
        className: 'text-sm',
        textContent: option.label,
        attributes: { style: 'color: var(--theme-text);' },
      });

      const toggleContainer = this.createElement('div');
      const checkbox = this.createElement('input', {
        attributes: {
          type: 'checkbox',
          style: 'cursor: pointer;',
        },
      }) as HTMLInputElement;
      checkbox.checked = this[option.key];

      this.on(checkbox, 'change', () => {
        this[option.key] = checkbox.checked;
        StorageService.setItem(STORAGE_KEYS[option.key], checkbox.checked);
        this.renderTargetOverview();
        this.renderAlternativesList();
      });

      toggleContainer.appendChild(checkbox);
      row.appendChild(label);
      row.appendChild(toggleContainer);
      container.appendChild(row);
    }
  }

  /**
   * Render target dye display and selector
   */
  private renderTargetDyeSection(container: HTMLElement): void {
    const dyeContainer = this.createElement('div', { className: 'space-y-3' });

    // Selected dye display
    this.targetDyeContainer = this.createElement('div');
    dyeContainer.appendChild(this.targetDyeContainer);
    this.updateTargetDyeDisplay();

    // Dye selector component
    const selectorContainer = this.createElement('div', { className: 'mt-2' });
    dyeContainer.appendChild(selectorContainer);

    this.dyeSelector = new DyeSelector(selectorContainer, {
      maxSelections: 1,
      allowMultiple: false,
      allowDuplicates: false,
      showCategories: true,
      showPrices: true,
      excludeFacewear: true,
      showFavorites: true,
      compactMode: true,
    });
    this.dyeSelector.init();

    // Listen for selection changes
    selectorContainer.addEventListener('selection-changed', () => {
      const selectedDyes = this.dyeSelector?.getSelectedDyes() || [];
      this.targetDye = selectedDyes[0] || null;
      this.updateTargetDyeDisplay();
      this.updateQuickPickSelection();

      if (this.targetDye) {
        StorageService.setItem(STORAGE_KEYS.targetDyeId, this.targetDye.id);
      }

      this.findAlternatives();
      this.updateDrawerContent();
    });

    container.appendChild(dyeContainer);
  }

  /**
   * Update target dye display card
   */
  private updateTargetDyeDisplay(): void {
    if (!this.targetDyeContainer) return;
    clearContainer(this.targetDyeContainer);

    if (!this.targetDye) {
      // Empty state
      const placeholder = this.createElement('div', {
        className: 'p-4 rounded-lg border-2 border-dashed text-center',
        textContent: LanguageService.t('budget.selectTargetDye'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      this.targetDyeContainer.appendChild(placeholder);
      return;
    }

    // Display card with dye color as background
    // Dynamically set text color based on background luminance for optimal readability
    const isLight = this.isLightColor(this.targetDye.hex);
    const textColor = isLight ? '#1A1A1A' : '#FFFFFF';
    // Add subtle text shadow for better contrast on mid-range colors
    const textShadow = isLight
      ? '0 1px 2px rgba(255, 255, 255, 0.3)'
      : '0 1px 2px rgba(0, 0, 0, 0.3)';

    const card = this.createElement('div', {
      className: 'p-4 rounded-lg',
      attributes: {
        style: `background: ${this.targetDye.hex}; border: 1px solid var(--theme-border);`,
      },
    });

    const name = this.createElement('p', {
      className: 'font-semibold text-lg mb-1',
      textContent: LanguageService.getDyeName(this.targetDye.itemID) || this.targetDye.name,
      attributes: { style: `color: ${textColor} !important; text-shadow: ${textShadow};` },
    });

    const hex = this.createElement('p', {
      className: 'text-sm number mb-2',
      textContent: this.targetDye.hex,
      attributes: {
        style: `color: ${textColor} !important; opacity: 0.8; text-shadow: ${textShadow};`,
      },
    });

    const price = this.createElement('p', {
      className: 'text-sm font-medium number',
      textContent:
        this.targetPrice > 0
          ? `~${formatPriceWithSuffix(this.targetPrice)}`
          : LanguageService.t('budget.loadingPrice'),
      attributes: { style: `color: ${textColor} !important; text-shadow: ${textShadow};` },
    });

    card.appendChild(name);
    card.appendChild(hex);
    card.appendChild(price);
    this.targetDyeContainer.appendChild(card);
  }

  /**
   * Render quick picks grid
   */
  private renderQuickPicksSection(container: HTMLElement): void {
    const grid = this.createElement('div', {
      className: 'grid grid-cols-3 gap-2',
    });

    this.quickPickButtons = [];

    POPULAR_EXPENSIVE_DYE_NAMES.forEach((dyeName) => {
      const matches = dyeService.searchByName(dyeName);
      const dye = matches.find((d) => d.name === dyeName) || matches[0];
      if (!dye) return;

      const isSelected = this.targetDye?.id === dye.id;
      const btn = this.createElement('button', {
        className: 'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors',
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: var(--theme-card-background); color: var(--theme-text);',
          type: 'button',
          title: LanguageService.getDyeName(dye.itemID) || dye.name,
        },
      }) as HTMLButtonElement;

      const swatch = this.createElement('div', {
        className: 'w-6 h-6 rounded',
        attributes: { style: `background: ${dye.hex}; border: 1px solid var(--theme-border);` },
      });

      const label = this.createElement('span', {
        className: 'text-xs truncate w-full text-center',
        textContent: dyeName.split(' ')[0],
      });

      btn.appendChild(swatch);
      btn.appendChild(label);

      this.on(btn, 'click', () => {
        this.targetDye = dye;
        this.updateTargetDyeDisplay();
        this.updateQuickPickSelection();
        StorageService.setItem(STORAGE_KEYS.targetDyeId, dye.id);
        this.findAlternatives();
        this.updateDrawerContent();
      });

      this.quickPickButtons.push(btn);
      grid.appendChild(btn);
    });

    container.appendChild(grid);
  }

  /**
   * Update quick pick button selection state
   */
  private updateQuickPickSelection(): void {
    this.quickPickButtons.forEach((btn, index) => {
      const dyeName = POPULAR_EXPENSIVE_DYE_NAMES[index];
      const matches = dyeService.searchByName(dyeName);
      const dye = matches.find((d) => d.name === dyeName) || matches[0];
      const isSelected = dye && this.targetDye?.id === dye.id;

      btn.setAttribute(
        'style',
        isSelected
          ? 'background: var(--theme-primary); color: var(--theme-text-header);'
          : 'background: var(--theme-card-background); color: var(--theme-text);'
      );
    });
  }

  /**
   * Render budget limit slider
   */
  private renderBudgetSection(container: HTMLElement): void {
    // Current value display
    const valueDisplay = this.createElement('div', {
      className: 'flex items-center justify-between mb-3',
    });

    const labelSpan = this.createElement('span', {
      className: 'text-sm',
      textContent: LanguageService.t('budget.maxPrice'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    this.budgetValueDisplay = this.createElement('span', {
      className: 'font-semibold',
      textContent: formatPriceWithSuffix(this.budgetLimit),
      attributes: { style: 'color: var(--theme-text);' },
    });

    valueDisplay.appendChild(labelSpan);
    valueDisplay.appendChild(this.budgetValueDisplay);
    container.appendChild(valueDisplay);

    // Slider
    const slider = this.createElement('input', {
      className: 'w-full',
      attributes: {
        type: 'range',
        min: '0',
        max: '200000',
        value: String(Math.min(this.budgetLimit, 200000)),
        step: '1000',
        style: 'accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    this.on(slider, 'input', () => {
      this.budgetLimit = parseInt(slider.value, 10);
      if (this.budgetValueDisplay) {
        this.budgetValueDisplay.textContent = formatPriceWithSuffix(this.budgetLimit);
      }
      StorageService.setItem(STORAGE_KEYS.budgetLimit, this.budgetLimit);
      this.filterAndSortAlternatives();
      this.updateDrawerContent();
    });

    container.appendChild(slider);

    // Tick labels
    const ticksContainer = this.createElement('div', {
      className: 'flex justify-between mt-1',
    });
    ['0', '50K', '100K', '150K', '200K'].forEach((tick) => {
      const tickLabel = this.createElement('span', {
        className: 'text-xs',
        textContent: tick,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      ticksContainer.appendChild(tickLabel);
    });
    container.appendChild(ticksContainer);

    // Divider
    const divider = this.createElement('div', {
      className: 'my-4',
      attributes: { style: 'border-top: 1px solid var(--theme-border);' },
    });
    container.appendChild(divider);

    // Result Limit section
    const resultLimitDisplay = this.createElement('div', {
      className: 'flex items-center justify-between mb-3',
    });

    const resultLimitLabel = this.createElement('span', {
      className: 'text-sm',
      textContent: LanguageService.t('budget.maxResults'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    this.resultLimitValueDisplay = this.createElement('span', {
      className: 'font-semibold',
      textContent: String(this.resultLimit),
      attributes: { style: 'color: var(--theme-text);' },
    });

    resultLimitDisplay.appendChild(resultLimitLabel);
    resultLimitDisplay.appendChild(this.resultLimitValueDisplay);
    container.appendChild(resultLimitDisplay);

    // Result Limit Slider
    const resultLimitSlider = this.createElement('input', {
      className: 'w-full',
      attributes: {
        type: 'range',
        min: '1',
        max: '10',
        value: String(this.resultLimit),
        step: '1',
        style: 'accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    this.on(resultLimitSlider, 'input', () => {
      this.resultLimit = parseInt(resultLimitSlider.value, 10);
      if (this.resultLimitValueDisplay) {
        this.resultLimitValueDisplay.textContent = String(this.resultLimit);
      }
      StorageService.setItem(STORAGE_KEYS.resultLimit, this.resultLimit);
      this.filterAndSortAlternatives();
      this.updateDrawerContent();
    });

    container.appendChild(resultLimitSlider);

    // Result Limit Tick labels
    const resultLimitTicks = this.createElement('div', {
      className: 'flex justify-between mt-1',
    });
    ['1', '3', '5', '7', '10'].forEach((tick) => {
      const tickLabel = this.createElement('span', {
        className: 'text-xs',
        textContent: tick,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      resultLimitTicks.appendChild(tickLabel);
    });
    container.appendChild(resultLimitTicks);
  }

  /**
   * Render color distance (Delta-E) slider
   */
  private renderColorDistanceSection(container: HTMLElement): void {
    // Current value display
    const valueDisplay = this.createElement('div', {
      className: 'flex items-center justify-between mb-3',
    });

    const labelSpan = this.createElement('span', {
      className: 'text-sm',
      textContent: LanguageService.t('budget.maxDistance'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    this.distanceValueDisplay = this.createElement('span', {
      className: 'font-semibold',
      textContent: String(this.colorDistance),
      attributes: { style: 'color: var(--theme-text);' },
    });

    valueDisplay.appendChild(labelSpan);
    valueDisplay.appendChild(this.distanceValueDisplay);
    container.appendChild(valueDisplay);

    // Description text
    const description = this.createElement('p', {
      className: 'text-xs mb-3',
      textContent:
        LanguageService.t('budget.distanceDesc'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    container.appendChild(description);

    // Slider
    const slider = this.createElement('input', {
      className: 'w-full',
      attributes: {
        type: 'range',
        min: '25',
        max: '100',
        value: String(this.colorDistance),
        step: '5',
        style: 'accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    this.on(slider, 'input', () => {
      this.colorDistance = parseInt(slider.value, 10);
      if (this.distanceValueDisplay) {
        this.distanceValueDisplay.textContent = String(this.colorDistance);
      }
      StorageService.setItem(STORAGE_KEYS.colorDistance, this.colorDistance);
      this.findAlternatives();
      this.updateDrawerContent();
    });

    container.appendChild(slider);

    // Tick labels
    const ticksContainer = this.createElement('div', {
      className: 'flex justify-between mt-1',
    });
    ['25', '50', '75', '100'].forEach((tick) => {
      const tickLabel = this.createElement('span', {
        className: 'text-xs',
        textContent: tick,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      ticksContainer.appendChild(tickLabel);
    });
    container.appendChild(ticksContainer);
  }

  /**
   * Render sort options
   */
  private renderSortSection(container: HTMLElement): void {
    const options = [
      {
        id: 'match',
        label: LanguageService.t('budget.sortMatch'),
        desc: LanguageService.t('budget.sortMatchDesc'),
      },
      {
        id: 'price',
        label: LanguageService.t('budget.sortPrice'),
        desc: LanguageService.t('budget.sortPriceDesc'),
      },
      {
        id: 'value',
        label: LanguageService.t('budget.sortValue'),
        desc: LanguageService.t('budget.sortValueDesc'),
      },
    ];

    const optionsContainer = this.createElement('div', { className: 'space-y-2' });

    options.forEach((opt) => {
      const isSelected = this.sortBy === opt.id;
      const label = this.createElement('label', {
        className: 'flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors',
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent;',
        },
      });

      const radio = this.createElement('input', {
        className: 'mt-1',
        attributes: {
          type: 'radio',
          name: 'sortBy',
          value: opt.id,
          ...(isSelected && { checked: '' }),
        },
      }) as HTMLInputElement;

      const text = this.createElement('div');
      const labelText = this.createElement('span', {
        className: 'font-medium text-sm',
        textContent: opt.label,
      });
      const descText = this.createElement('p', {
        className: 'text-xs',
        textContent: opt.desc,
        attributes: { style: isSelected ? '' : 'color: var(--theme-text-muted);' },
      });
      text.appendChild(labelText);
      text.appendChild(descText);

      this.on(radio, 'change', () => {
        this.sortBy = opt.id as 'match' | 'price' | 'value';
        StorageService.setItem(STORAGE_KEYS.sortBy, this.sortBy);

        // Update all label styles
        optionsContainer.querySelectorAll('label').forEach((lbl, idx) => {
          const selected = options[idx].id === opt.id;
          lbl.setAttribute(
            'style',
            selected
              ? 'background: var(--theme-primary); color: var(--theme-text-header);'
              : 'background: transparent;'
          );
          const pEl = lbl.querySelector('p');
          if (pEl) {
            pEl.setAttribute('style', selected ? '' : 'color: var(--theme-text-muted);');
          }
        });

        this.filterAndSortAlternatives();
        this.updateDrawerContent();
      });

      label.appendChild(radio);
      label.appendChild(text);
      optionsContainer.appendChild(label);
    });

    container.appendChild(optionsContainer);
  }

  // ============================================================================
  // Right Panel Rendering
  // ============================================================================

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Determine initial visibility based on whether target dye is already set
    // This ensures correct state after re-renders (e.g., language change)
    const hasTargetDye = this.targetDye !== null;

    // Content wrapper with max-width to prevent over-expansion on ultrawide monitors
    const contentWrapper = this.createElement('div', {
      attributes: {
        style: 'max-width: 1200px; margin: 0 auto; width: 100%;',
      },
    });

    // Empty state - hidden when we have a target dye
    this.emptyStateContainer = this.createElement('div', {
      className: hasTargetDye ? 'hidden' : '',
    });
    this.renderEmptyState();
    contentWrapper.appendChild(this.emptyStateContainer);

    // Target Overview Card - visible when we have a target dye
    this.targetOverviewContainer = this.createElement('div', {
      className: hasTargetDye ? 'mb-6' : 'mb-6 hidden',
    });
    contentWrapper.appendChild(this.targetOverviewContainer);

    // Alternatives Section - wraps header + list to keep them visually grouped
    this.alternativesSection = this.createElement('div', {
      className: hasTargetDye ? '' : 'hidden',
    });

    // Alternatives Header
    this.alternativesHeaderContainer = this.createElement('div', {
      className: 'mb-4',
    });
    this.alternativesSection.appendChild(this.alternativesHeaderContainer);

    // Alternatives List
    this.alternativesListContainer = this.createElement('div', {
      className: 'w-full',
    });
    this.alternativesSection.appendChild(this.alternativesListContainer);

    contentWrapper.appendChild(this.alternativesSection);

    right.appendChild(contentWrapper);

    // If we have a target dye, render the results content
    if (hasTargetDye) {
      this.renderTargetOverview();
      this.renderAlternativesHeader();
      this.renderAlternativesList();
    }
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): void {
    if (!this.emptyStateContainer) return;
    clearContainer(this.emptyStateContainer);

    const empty = this.createElement('div', {
      className: 'flex flex-col items-center justify-center text-center',
      attributes: {
        style: 'min-height: 400px; padding: 3rem 2rem;',
      },
    });

    empty.innerHTML = `
      <span style="display: block; width: 150px; height: 150px; margin: 0 auto 1.5rem; opacity: 0.25; color: var(--theme-text);">${ICON_TOOL_BUDGET}</span>
      <p style="color: var(--theme-text); font-size: 1.125rem; text-align: center;">${LanguageService.t('budget.selectTargetToStart')}</p>
    `;

    this.emptyStateContainer.appendChild(empty);
  }

  /**
   * Show/hide empty state
   */
  private showEmptyState(show: boolean): void {
    if (this.emptyStateContainer) {
      this.emptyStateContainer.style.display = show ? 'flex' : 'none';
      this.emptyStateContainer.style.justifyContent = 'center';
    }
    if (this.targetOverviewContainer) {
      this.targetOverviewContainer.style.display = show ? 'none' : 'block';
    }
    if (this.alternativesSection) {
      this.alternativesSection.style.display = show ? 'none' : 'block';
    }
  }

  /**
   * Render target overview card using v4-result-card
   */
  private renderTargetOverview(): void {
    if (!this.targetOverviewContainer || !this.targetDye) return;

    // Ensure empty state is hidden when rendering target overview
    this.showEmptyState(false);

    clearContainer(this.targetOverviewContainer);

    // Section header (using consistent section-header/section-title pattern from other tools)
    const sectionHeader = this.createElement('div', {
      className: 'section-header',
      attributes: { style: 'width: 100%; margin-bottom: 16px;' },
    });
    const sectionTitle = this.createElement('span', {
      className: 'section-title',
      textContent: LanguageService.t('budget.selectedDye'),
    });
    sectionHeader.appendChild(sectionTitle);
    this.targetOverviewContainer.appendChild(sectionHeader);

    // Wrapper for centering the card
    const cardWrapper = this.createElement('div', {
      attributes: {
        style: 'display: flex; justify-content: center; margin-bottom: 24px;',
      },
    });

    // Create v4-result-card for the target dye
    const card = document.createElement('v4-result-card') as ResultCard;

    // Get market server name
    const priceInfo = this.priceData.get(this.targetDye.itemID);
    const marketServer = this.marketBoardService.getWorldNameForPrice(priceInfo);

    // Build ResultCardData - use same color for both to show solid preview
    const cardData: ResultCardData = {
      dye: this.targetDye,
      originalColor: this.targetDye.hex,
      matchedColor: this.targetDye.hex,
      marketServer: marketServer,
      price: this.targetPrice > 0 ? this.targetPrice : priceInfo?.currentMinPrice,
      vendorCost: this.targetDye.cost,
    };

    card.data = cardData;
    card.showActions = true;
    card.primaryActionLabel =
      LanguageService.t('budget.currentlySelected');
    card.showDeltaE = false; // Hide delta-E for target card (it's the reference)

    // Configure display options from global settings
    card.showHex = this.showHex;
    card.showRgb = this.showRgb;
    card.showHsv = this.showHsv;
    card.showLab = this.showLab;
    card.showPrice = this.showPrice;
    card.showAcquisition = this.showAcquisition;

    // Card width
    card.style.setProperty('--v4-result-card-width', '320px');

    // Event handlers - clicking the card opens context menu
    card.addEventListener('context-action', ((
      e: CustomEvent<{ action: ContextAction; dye: Dye }>
    ) => {
      this.handleContextAction(e.detail.action, e.detail.dye);
    }) as EventListener);

    cardWrapper.appendChild(card);
    this.targetOverviewContainer.appendChild(cardWrapper);
  }

  /**
   * Render alternatives header
   */
  private renderAlternativesHeader(): void {
    if (!this.alternativesHeaderContainer) return;
    clearContainer(this.alternativesHeaderContainer);

    const displayCount = this.alternatives.length;
    const totalCount = this.totalAffordableCount;
    const isLimited = displayCount < totalCount;

    // Show "Showing X of Y" when results are limited, otherwise show total count
    const countLabel = isLimited
      ? LanguageService.t('budget.showingXOfY')
          .replace('{showing}', String(displayCount))
          .replace('{total}', String(totalCount))
      : `${totalCount} ${totalCount === 1
          ? LanguageService.t('budget.alternativeWithinBudget')
          : LanguageService.t('budget.alternativesWithinBudget')}`;

    // Section header (using consistent section-header/section-title pattern from other tools)
    const sectionHeader = this.createElement('div', {
      className: 'section-header',
      attributes: { style: 'width: 100%;' },
    });
    const sectionTitle = this.createElement('span', {
      className: 'section-title',
      textContent: countLabel,
    });
    sectionHeader.appendChild(sectionTitle);
    this.alternativesHeaderContainer.appendChild(sectionHeader);
  }

  /**
   * Render alternatives list
   */
  private renderAlternativesList(): void {
    if (!this.alternativesListContainer || !this.targetDye) return;

    // Ensure empty state is hidden when rendering alternatives
    if (this.emptyStateContainer) {
      this.emptyStateContainer.classList.add('hidden');
    }

    clearContainer(this.alternativesListContainer);

    if (this.isLoading) {
      const loading = this.createElement('div', {
        className: 'w-full flex flex-col items-center justify-center py-8 gap-4 text-center',
      });

      const { current, total } = this.fetchProgress;
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

      loading.innerHTML = `
        <svg class="animate-spin h-8 w-8" width="32" height="32" style="color: var(--theme-primary); width: 32px; height: 32px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div class="w-full max-w-xs">
          <div class="flex justify-between text-xs mb-1" style="color: var(--theme-text-muted);">
            <span>${LanguageService.t('budget.fetchingPrices')}</span>
            <span class="number">${current} / ${total}</span>
          </div>
          <div class="w-full h-2 rounded-full overflow-hidden" style="background: var(--theme-background-secondary);">
            <div class="h-full rounded-full transition-all duration-150" style="background: var(--theme-primary); width: ${percentage}%;"></div>
          </div>
        </div>
      `;
      this.alternativesListContainer.appendChild(loading);
      return;
    }

    if (this.alternatives.length === 0) {
      const emptyState = this.createElement('div', {
        className: 'text-center py-8',
      });
      emptyState.innerHTML = `
        <p class="text-lg font-medium mb-2" style="color: var(--theme-text);">${LanguageService.t('budget.noDyesWithinBudget')}</p>
        <p class="text-sm mb-4" style="color: var(--theme-text-muted);">${LanguageService.t('budget.tryIncreasingBudget')}</p>
      `;
      this.alternativesListContainer.appendChild(emptyState);
      return;
    }

    // Grid container for v4 result cards
    const grid = this.createElement('div', {
      attributes: {
        style: 'display: flex; flex-wrap: wrap; gap: 24px; justify-content: center;',
      },
    });

    this.alternatives.forEach((alt) => {
      // Create card wrapper with savings display
      const wrapper = this.createElement('div', {
        attributes: {
          style: 'display: flex; flex-direction: column; gap: 8px;',
        },
      });

      // Create v4-result-card
      const card = document.createElement('v4-result-card') as ResultCard;

      // Get market server name (use MarketBoardService like other tools)
      const priceInfo = this.priceData.get(alt.dye.itemID);
      const marketServer = this.marketBoardService.getWorldNameForPrice(priceInfo);

      // Build ResultCardData
      const cardData: ResultCardData = {
        dye: alt.dye,
        originalColor: this.targetDye!.hex, // Target dye (original)
        matchedColor: alt.dye.hex, // Alternative dye (match)
        deltaE: alt.distance,
        marketServer: marketServer,
        price: priceInfo?.currentMinPrice,
        vendorCost: alt.dye.cost,
      };

      card.data = cardData;
      card.showActions = true;

      // Configure display options from global settings
      card.showHex = this.showHex;
      card.showRgb = this.showRgb;
      card.showHsv = this.showHsv;
      card.showLab = this.showLab;
      card.showDeltaE = this.showDeltaE;
      card.showPrice = this.showPrice;
      card.showAcquisition = this.showAcquisition;

      // Event handlers
      card.addEventListener('card-select', ((e: CustomEvent<{ dye: Dye }>) => {
        this.handleCardSelect(e.detail.dye);
      }) as EventListener);

      card.addEventListener('context-action', ((
        e: CustomEvent<{ action: ContextAction; dye: Dye }>
      ) => {
        this.handleContextAction(e.detail.action, e.detail.dye);
      }) as EventListener);

      wrapper.appendChild(card);

      // Add savings badge below card (if savings > 0)
      if (alt.savings > 0) {
        const savingsBadge = this.createElement('div', {
          textContent: `${LanguageService.t('budget.save')} ${formatPriceWithSuffix(alt.savings)}`,
          attributes: {
            style:
              'background: rgba(34, 197, 94, 0.15); color: #22C55E; font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 6px; text-align: center;',
          },
        });
        wrapper.appendChild(savingsBadge);
      }

      grid.appendChild(wrapper);
    });

    this.alternativesListContainer.appendChild(grid);
  }

  // ============================================================================
  // Core Business Logic
  // ============================================================================

  /**
   * Find alternatives for the target dye
   */
  private async findAlternatives(): Promise<void> {
    if (!this.targetDye) {
      this.showEmptyState(true);
      this.alternatives = [];
      return;
    }

    this.showEmptyState(false);
    this.isLoading = true;
    this.renderAlternativesList();

    try {
      // 1. Get all dyes within user-configurable color distance threshold
      const candidates = dyeService.findDyesWithinDistance(
        this.targetDye.hex,
        this.colorDistance,
        50
      );

      // 2. Apply filters
      let filtered = candidates.filter((dye) => dye.id !== this.targetDye?.id);
      if (this.dyeFilters) {
        filtered = this.dyeFilters.filterDyes(filtered);
      }

      // 3. Fetch prices
      await this.fetchPrices([this.targetDye, ...filtered]);

      // 4. Get target price
      const targetPriceData = this.priceData.get(this.targetDye.itemID);
      this.targetPrice = targetPriceData?.currentMinPrice ?? 0;

      // 5. Build alternatives with price data
      this.alternatives = filtered.map((dye) => {
        const priceData = this.priceData.get(dye.itemID);
        const price = priceData?.currentMinPrice ?? Infinity;
        const distance = ColorService.getColorDistance(this.targetDye!.hex, dye.hex);
        const savings = Math.max(0, this.targetPrice - price);
        const valueScore = this.calculateValueScore(distance, price);

        return { dye, distance, price, savings, valueScore };
      });

      // 6. Mark loading complete before filtering/sorting (so render shows results, not spinner)
      this.isLoading = false;

      // 7. Filter and sort
      this.filterAndSortAlternatives();
    } catch (error) {
      logger.error('[BudgetTool] Error finding alternatives:', error);
      ToastService.error(LanguageService.t('budget.errorFindingAlternatives'));
      this.isLoading = false;
      this.renderAlternativesList(); // Show error state, not loading spinner
    } finally {
      this.renderTargetOverview();
      this.updateTargetDyeDisplay();
    }
  }

  /**
   * Filter by budget and sort alternatives
   */
  private filterAndSortAlternatives(): void {
    // Filter by budget
    const affordable = this.alternatives.filter((alt) => alt.price <= this.budgetLimit);

    // Sort by selected criteria
    affordable.sort((a, b) => {
      switch (this.sortBy) {
        case 'price':
          return a.price - b.price;
        case 'value':
          return a.valueScore - b.valueScore;
        case 'match':
        default:
          return a.distance - b.distance;
      }
    });

    // Track total count before applying result limit
    this.totalAffordableCount = affordable.length;

    // Apply result limit
    this.alternatives = affordable.slice(0, this.resultLimit);
    this.renderAlternativesHeader();
    this.renderAlternativesList();
  }

  /**
   * Calculate value score (lower is better)
   */
  private calculateValueScore(distance: number, price: number): number {
    const maxDistance = 50;
    const maxPrice = 200000;
    const normalizedDistance = (distance / maxDistance) * 100;
    const normalizedPrice = (price / maxPrice) * 100;
    return normalizedDistance * 0.7 + normalizedPrice * 0.3;
  }

  /**
   * Fetch prices for dyes with progress tracking
   */
  private async fetchPrices(dyes: Dye[]): Promise<void> {
    if (!this.marketBoard) return;

    // Initialize progress
    this.fetchProgress = { current: 0, total: dyes.length };
    this.renderAlternativesList();

    try {
      const prices = await this.marketBoard.fetchPricesForDyes(dyes, (current, total) => {
        this.fetchProgress = { current, total };
        this.renderAlternativesList();
      });
      prices.forEach((data, itemId) => {
        this.priceData.set(itemId, data);
      });
    } catch (error) {
      logger.warn('[BudgetTool] Error fetching prices:', error);
    }
  }

  // ============================================================================
  // Mobile Drawer Content
  // ============================================================================

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    const drawer = this.options.drawerContent;
    clearContainer(drawer);

    // Section 1: Target Dye (collapsible, default open)
    const targetContainer = this.createElement('div');
    drawer.appendChild(targetContainer);
    this.mobileTargetDyePanel = new CollapsiblePanel(targetContainer, {
      title: LanguageService.t('budget.targetDye'),
      storageKey: 'v3_budget_mobile_target_panel',
      defaultOpen: true,
      icon: ICON_TARGET,
    });
    this.mobileTargetDyePanel.init();
    const targetContent = this.createElement('div');
    this.renderMobileTargetDyeSection(targetContent);
    this.mobileTargetDyePanel.setContent(targetContent);

    // Section 2: Quick Picks (collapsible, default open)
    const quickContainer = this.createElement('div');
    drawer.appendChild(quickContainer);
    this.mobileQuickPicksPanel = new CollapsiblePanel(quickContainer, {
      title: LanguageService.t('budget.quickPicks'),
      storageKey: 'v3_budget_mobile_quickpicks_panel',
      defaultOpen: true,
      icon: ICON_SPARKLES,
    });
    this.mobileQuickPicksPanel.init();
    const quickContent = this.createElement('div');
    this.renderMobileQuickPicksSection(quickContent);
    this.mobileQuickPicksPanel.setContent(quickContent);

    // Section 3: Budget Limit (collapsible, default open)
    const budgetContainer = this.createElement('div');
    drawer.appendChild(budgetContainer);
    this.mobileBudgetLimitPanel = new CollapsiblePanel(budgetContainer, {
      title: LanguageService.t('budget.budgetLimit'),
      storageKey: 'v3_budget_mobile_limit_panel',
      defaultOpen: true,
      icon: ICON_COINS,
    });
    this.mobileBudgetLimitPanel.init();
    const budgetContent = this.createElement('div');
    this.renderMobileBudgetSection(budgetContent);
    this.mobileBudgetLimitPanel.setContent(budgetContent);

    // Section 4: Color Distance (collapsible, default closed)
    const distanceContainer = this.createElement('div');
    drawer.appendChild(distanceContainer);
    this.mobileColorDistancePanel = new CollapsiblePanel(distanceContainer, {
      title: LanguageService.t('budget.colorDistance'),
      storageKey: 'v3_budget_mobile_distance_panel',
      defaultOpen: false,
      icon: ICON_DISTANCE,
    });
    this.mobileColorDistancePanel.init();
    const distanceContent = this.createElement('div');
    this.renderMobileColorDistanceSection(distanceContent);
    this.mobileColorDistancePanel.setContent(distanceContent);

    // Section 5: Sort Options (collapsible, default closed)
    const sortContainer = this.createElement('div');
    drawer.appendChild(sortContainer);
    this.mobileSortByPanel = new CollapsiblePanel(sortContainer, {
      title: LanguageService.t('budget.sortBy'),
      storageKey: 'v3_budget_mobile_sort_panel',
      defaultOpen: false,
      icon: ICON_SORT,
    });
    this.mobileSortByPanel.init();
    const sortContent = this.createElement('div');
    this.renderMobileSortSection(sortContent);
    this.mobileSortByPanel.setContent(sortContent);

    // Section 6: Dye Filters (collapsible)
    const filtersContainer = this.createElement('div');
    drawer.appendChild(filtersContainer);
    this.mobileFiltersPanel = new CollapsiblePanel(filtersContainer, {
      title: LanguageService.t('filters.title'),
      storageKey: 'v3_budget_mobile_filters',
      defaultOpen: false,
      icon: ICON_FILTER,
    });
    this.mobileFiltersPanel.init();

    const filtersContent = this.createElement('div');
    this.mobileDyeFilters = new DyeFilters(filtersContent, {
      storageKeyPrefix: 'v3_budget', // Share filter state with desktop
      onFilterChange: () => {
        this.findAlternatives();
      },
      hideHeader: true,
    });
    this.mobileDyeFilters.render();
    this.mobileDyeFilters.bindEvents();
    this.mobileFiltersPanel.setContent(filtersContent);

    // Section 7: Color Formats (collapsible)
    const colorFormatsContainer = this.createElement('div');
    drawer.appendChild(colorFormatsContainer);
    this.mobileColorFormatsPanel = new CollapsiblePanel(colorFormatsContainer, {
      title: LanguageService.t('config.colorFormats'),
      storageKey: 'v3_budget_mobile_color_formats',
      defaultOpen: false,
      icon: ICON_EYE,
    });
    this.mobileColorFormatsPanel.init();

    const colorFormatsContent = this.createElement('div', { className: 'space-y-2' });
    this.renderColorFormatsOptions(colorFormatsContent);
    this.mobileColorFormatsPanel.setContent(colorFormatsContent);

    // Section 8: Market Board (collapsible)
    const marketContainer = this.createElement('div');
    drawer.appendChild(marketContainer);
    this.mobileMarketPanel = new CollapsiblePanel(marketContainer, {
      title: LanguageService.t('marketBoard.title'),
      storageKey: 'v3_budget_mobile_market',
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    this.mobileMarketPanel.init();

    const marketContent = this.createElement('div');
    this.mobileMarketBoard = new MarketBoard(marketContent);
    this.mobileMarketBoard.init();

    // Set up market board event listeners - budget tool always needs prices
    setupMarketBoardListeners(marketContent, () => true, () => this.findAlternatives(), {
      onServerChanged: () => {
        this.findAlternatives();
      },
    });

    this.mobileMarketPanel.setContent(marketContent);
  }

  /**
   * Render mobile target dye display and selector
   */
  private renderMobileTargetDyeSection(container: HTMLElement): void {
    const dyeContainer = this.createElement('div', { className: 'space-y-3' });

    // Selected dye display
    this.mobileTargetDyeContainer = this.createElement('div');
    dyeContainer.appendChild(this.mobileTargetDyeContainer);
    this.updateMobileTargetDyeDisplay();

    // Dye selector component
    const selectorContainer = this.createElement('div', { className: 'mt-2' });
    dyeContainer.appendChild(selectorContainer);

    this.mobileDyeSelector = new DyeSelector(selectorContainer, {
      maxSelections: 1,
      allowMultiple: false,
      allowDuplicates: false,
      showCategories: true,
      showPrices: true,
      excludeFacewear: true,
      showFavorites: true,
      compactMode: true,
    });
    this.mobileDyeSelector.init();

    // Listen for selection changes
    selectorContainer.addEventListener('selection-changed', () => {
      const selectedDyes = this.mobileDyeSelector?.getSelectedDyes() || [];
      this.targetDye = selectedDyes[0] || null;
      this.updateTargetDyeDisplay();
      this.updateMobileTargetDyeDisplay();
      this.updateQuickPickSelection();
      this.updateMobileQuickPickSelection();

      if (this.targetDye) {
        StorageService.setItem(STORAGE_KEYS.targetDyeId, this.targetDye.id);
      }

      this.findAlternatives();
    });

    container.appendChild(dyeContainer);
  }

  /**
   * Update mobile target dye display card
   */
  private updateMobileTargetDyeDisplay(): void {
    if (!this.mobileTargetDyeContainer) return;
    clearContainer(this.mobileTargetDyeContainer);

    if (!this.targetDye) {
      const placeholder = this.createElement('div', {
        className: 'p-4 rounded-lg border-2 border-dashed text-center',
        textContent: LanguageService.t('budget.selectTargetDye'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      this.mobileTargetDyeContainer.appendChild(placeholder);
      return;
    }

    const isLight = this.isLightColor(this.targetDye.hex);
    const textColor = isLight ? '#1A1A1A' : '#FFFFFF';
    const textShadow = isLight
      ? '0 1px 2px rgba(255, 255, 255, 0.3)'
      : '0 1px 2px rgba(0, 0, 0, 0.3)';

    const card = this.createElement('div', {
      className: 'p-4 rounded-lg',
      attributes: {
        style: `background: ${this.targetDye.hex}; border: 1px solid var(--theme-border);`,
      },
    });

    const name = this.createElement('p', {
      className: 'font-semibold text-lg mb-1',
      textContent: LanguageService.getDyeName(this.targetDye.itemID) || this.targetDye.name,
      attributes: { style: `color: ${textColor} !important; text-shadow: ${textShadow};` },
    });

    const hex = this.createElement('p', {
      className: 'text-sm number mb-2',
      textContent: this.targetDye.hex,
      attributes: {
        style: `color: ${textColor} !important; opacity: 0.8; text-shadow: ${textShadow};`,
      },
    });

    const price = this.createElement('p', {
      className: 'text-sm font-medium number',
      textContent:
        this.targetPrice > 0
          ? `~${formatPriceWithSuffix(this.targetPrice)}`
          : LanguageService.t('budget.loadingPrice'),
      attributes: { style: `color: ${textColor} !important; text-shadow: ${textShadow};` },
    });

    card.appendChild(name);
    card.appendChild(hex);
    card.appendChild(price);
    this.mobileTargetDyeContainer.appendChild(card);
  }

  /**
   * Render mobile quick picks grid
   */
  private renderMobileQuickPicksSection(container: HTMLElement): void {
    const grid = this.createElement('div', {
      className: 'grid grid-cols-3 gap-2',
    });

    this.mobileQuickPickButtons = [];

    POPULAR_EXPENSIVE_DYE_NAMES.forEach((dyeName) => {
      const matches = dyeService.searchByName(dyeName);
      const dye = matches.find((d) => d.name === dyeName) || matches[0];
      if (!dye) return;

      const isSelected = this.targetDye?.id === dye.id;
      const btn = this.createElement('button', {
        className: 'flex flex-col items-center gap-1 p-2 rounded-lg transition-colors',
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: var(--theme-card-background); color: var(--theme-text);',
          type: 'button',
          title: LanguageService.getDyeName(dye.itemID) || dye.name,
        },
      }) as HTMLButtonElement;

      const swatch = this.createElement('div', {
        className: 'w-6 h-6 rounded',
        attributes: { style: `background: ${dye.hex}; border: 1px solid var(--theme-border);` },
      });

      const label = this.createElement('span', {
        className: 'text-xs truncate w-full text-center',
        textContent: dyeName.split(' ')[0],
      });

      btn.appendChild(swatch);
      btn.appendChild(label);

      this.on(btn, 'click', () => {
        this.targetDye = dye;
        this.updateTargetDyeDisplay();
        this.updateMobileTargetDyeDisplay();
        this.updateQuickPickSelection();
        this.updateMobileQuickPickSelection();
        StorageService.setItem(STORAGE_KEYS.targetDyeId, dye.id);
        this.findAlternatives();
      });

      this.mobileQuickPickButtons.push(btn);
      grid.appendChild(btn);
    });

    container.appendChild(grid);
  }

  /**
   * Update mobile quick pick button selection state
   */
  private updateMobileQuickPickSelection(): void {
    this.mobileQuickPickButtons.forEach((btn, index) => {
      const dyeName = POPULAR_EXPENSIVE_DYE_NAMES[index];
      const matches = dyeService.searchByName(dyeName);
      const dye = matches.find((d) => d.name === dyeName) || matches[0];
      const isSelected = dye && this.targetDye?.id === dye.id;

      btn.setAttribute(
        'style',
        isSelected
          ? 'background: var(--theme-primary); color: var(--theme-text-header);'
          : 'background: var(--theme-card-background); color: var(--theme-text);'
      );
    });
  }

  /**
   * Render mobile budget limit slider
   */
  private renderMobileBudgetSection(container: HTMLElement): void {
    const valueDisplay = this.createElement('div', {
      className: 'flex items-center justify-between mb-3',
    });

    const labelSpan = this.createElement('span', {
      className: 'text-sm',
      textContent: LanguageService.t('budget.maxPrice'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    this.mobileBudgetValueDisplay = this.createElement('span', {
      className: 'font-semibold',
      textContent: formatPriceWithSuffix(this.budgetLimit),
      attributes: { style: 'color: var(--theme-text);' },
    });

    valueDisplay.appendChild(labelSpan);
    valueDisplay.appendChild(this.mobileBudgetValueDisplay);
    container.appendChild(valueDisplay);

    const slider = this.createElement('input', {
      className: 'w-full',
      attributes: {
        type: 'range',
        min: '0',
        max: '200000',
        value: String(Math.min(this.budgetLimit, 200000)),
        step: '1000',
        style: 'accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    this.on(slider, 'input', () => {
      this.budgetLimit = parseInt(slider.value, 10);
      if (this.mobileBudgetValueDisplay) {
        this.mobileBudgetValueDisplay.textContent = formatPriceWithSuffix(this.budgetLimit);
      }
      if (this.budgetValueDisplay) {
        this.budgetValueDisplay.textContent = formatPriceWithSuffix(this.budgetLimit);
      }
      StorageService.setItem(STORAGE_KEYS.budgetLimit, this.budgetLimit);
      this.filterAndSortAlternatives();
    });

    container.appendChild(slider);

    const ticksContainer = this.createElement('div', {
      className: 'flex justify-between mt-1',
    });
    ['0', '50K', '100K', '150K', '200K'].forEach((tick) => {
      const tickLabel = this.createElement('span', {
        className: 'text-xs',
        textContent: tick,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      ticksContainer.appendChild(tickLabel);
    });
    container.appendChild(ticksContainer);

    // Divider
    const divider = this.createElement('div', {
      className: 'my-4',
      attributes: { style: 'border-top: 1px solid var(--theme-border);' },
    });
    container.appendChild(divider);

    // Result Limit section
    const resultLimitDisplay = this.createElement('div', {
      className: 'flex items-center justify-between mb-3',
    });

    const resultLimitLabel = this.createElement('span', {
      className: 'text-sm',
      textContent: LanguageService.t('budget.maxResults'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    this.mobileResultLimitValueDisplay = this.createElement('span', {
      className: 'font-semibold',
      textContent: String(this.resultLimit),
      attributes: { style: 'color: var(--theme-text);' },
    });

    resultLimitDisplay.appendChild(resultLimitLabel);
    resultLimitDisplay.appendChild(this.mobileResultLimitValueDisplay);
    container.appendChild(resultLimitDisplay);

    // Result Limit Slider
    const resultLimitSlider = this.createElement('input', {
      className: 'w-full',
      attributes: {
        type: 'range',
        min: '1',
        max: '10',
        value: String(this.resultLimit),
        step: '1',
        style: 'accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    this.on(resultLimitSlider, 'input', () => {
      this.resultLimit = parseInt(resultLimitSlider.value, 10);
      if (this.mobileResultLimitValueDisplay) {
        this.mobileResultLimitValueDisplay.textContent = String(this.resultLimit);
      }
      if (this.resultLimitValueDisplay) {
        this.resultLimitValueDisplay.textContent = String(this.resultLimit);
      }
      StorageService.setItem(STORAGE_KEYS.resultLimit, this.resultLimit);
      this.filterAndSortAlternatives();
    });

    container.appendChild(resultLimitSlider);

    // Result Limit Tick labels
    const resultLimitTicks = this.createElement('div', {
      className: 'flex justify-between mt-1',
    });
    ['1', '3', '5', '7', '10'].forEach((tick) => {
      const tickLabel = this.createElement('span', {
        className: 'text-xs',
        textContent: tick,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      resultLimitTicks.appendChild(tickLabel);
    });
    container.appendChild(resultLimitTicks);
  }

  /**
   * Render mobile color distance slider
   */
  private renderMobileColorDistanceSection(container: HTMLElement): void {
    const valueDisplay = this.createElement('div', {
      className: 'flex items-center justify-between mb-3',
    });

    const labelSpan = this.createElement('span', {
      className: 'text-sm',
      textContent: LanguageService.t('budget.maxDistance'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    this.mobileDistanceValueDisplay = this.createElement('span', {
      className: 'font-semibold',
      textContent: String(this.colorDistance),
      attributes: { style: 'color: var(--theme-text);' },
    });

    valueDisplay.appendChild(labelSpan);
    valueDisplay.appendChild(this.mobileDistanceValueDisplay);
    container.appendChild(valueDisplay);

    const description = this.createElement('p', {
      className: 'text-xs mb-3',
      textContent:
        LanguageService.t('budget.distanceDesc'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    container.appendChild(description);

    const slider = this.createElement('input', {
      className: 'w-full',
      attributes: {
        type: 'range',
        min: '25',
        max: '100',
        value: String(this.colorDistance),
        step: '5',
        style: 'accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    this.on(slider, 'input', () => {
      this.colorDistance = parseInt(slider.value, 10);
      if (this.mobileDistanceValueDisplay) {
        this.mobileDistanceValueDisplay.textContent = String(this.colorDistance);
      }
      if (this.distanceValueDisplay) {
        this.distanceValueDisplay.textContent = String(this.colorDistance);
      }
      StorageService.setItem(STORAGE_KEYS.colorDistance, this.colorDistance);
      this.findAlternatives();
    });

    container.appendChild(slider);

    const ticksContainer = this.createElement('div', {
      className: 'flex justify-between mt-1',
    });
    ['25', '50', '75', '100'].forEach((tick) => {
      const tickLabel = this.createElement('span', {
        className: 'text-xs',
        textContent: tick,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      ticksContainer.appendChild(tickLabel);
    });
    container.appendChild(ticksContainer);
  }

  /**
   * Render mobile sort options
   */
  private renderMobileSortSection(container: HTMLElement): void {
    const options = [
      {
        id: 'match',
        label: LanguageService.t('budget.sortMatch'),
        desc: LanguageService.t('budget.sortMatchDesc'),
      },
      {
        id: 'price',
        label: LanguageService.t('budget.sortPrice'),
        desc: LanguageService.t('budget.sortPriceDesc'),
      },
      {
        id: 'value',
        label: LanguageService.t('budget.sortValue'),
        desc: LanguageService.t('budget.sortValueDesc'),
      },
    ];

    const optionsContainer = this.createElement('div', { className: 'space-y-2' });

    options.forEach((opt) => {
      const isSelected = this.sortBy === opt.id;
      const label = this.createElement('label', {
        className: 'flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors',
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent;',
        },
      });

      const radio = this.createElement('input', {
        className: 'mt-1',
        attributes: {
          type: 'radio',
          name: 'mobileSortBy',
          value: opt.id,
          ...(isSelected && { checked: '' }),
        },
      }) as HTMLInputElement;

      const text = this.createElement('div');
      const labelText = this.createElement('span', {
        className: 'font-medium text-sm',
        textContent: opt.label,
      });
      const descText = this.createElement('p', {
        className: 'text-xs',
        textContent: opt.desc,
        attributes: { style: isSelected ? '' : 'color: var(--theme-text-muted);' },
      });
      text.appendChild(labelText);
      text.appendChild(descText);

      this.on(radio, 'change', () => {
        this.sortBy = opt.id as 'match' | 'price' | 'value';
        StorageService.setItem(STORAGE_KEYS.sortBy, this.sortBy);

        // Update mobile label styles
        optionsContainer.querySelectorAll('label').forEach((lbl, idx) => {
          const selected = options[idx].id === opt.id;
          lbl.setAttribute(
            'style',
            selected
              ? 'background: var(--theme-primary); color: var(--theme-text-header);'
              : 'background: transparent;'
          );
          const pEl = lbl.querySelector('p');
          if (pEl) {
            pEl.setAttribute('style', selected ? '' : 'color: var(--theme-text-muted);');
          }
        });

        this.filterAndSortAlternatives();
      });

      label.appendChild(radio);
      label.appendChild(text);
      optionsContainer.appendChild(label);
    });

    container.appendChild(optionsContainer);
  }

  /**
   * Update drawer content (lightweight update for dynamic data only)
   */
  private updateDrawerContent(): void {
    this.updateMobileTargetDyeDisplay();
    this.updateMobileQuickPickSelection();
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  /**
   * Handle card selection - set as new target dye
   */
  private handleCardSelect(dye: Dye): void {
    this.selectDye(dye);
  }

  /**
   * Handle context menu actions from result cards
   */
  private handleContextAction(action: ContextAction, dye: Dye): void {
    switch (action) {
      case 'add-comparison':
        RouterService.navigateTo('comparison', { dye: dye.name });
        break;
      case 'add-mixer':
        RouterService.navigateTo('mixer', { dye: dye.name });
        break;
      case 'add-accessibility':
        RouterService.navigateTo('accessibility', { dye: dye.name });
        break;
      case 'see-harmonies':
        RouterService.navigateTo('harmony', { dye: dye.name });
        break;
      case 'budget':
        this.selectDye(dye);
        break;
      case 'copy-hex':
        navigator.clipboard.writeText(dye.hex);
        ToastService.success(LanguageService.t('success.copiedToClipboard'));
        break;
    }
  }

  /**
   * Check if a color is light (for text contrast)
   */
  private isLightColor(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }

  /**
   * Clear all dye selections and return to empty state.
   * Called when "Clear All Dyes" button is clicked in Color Palette.
   */
  public clearDyes(): void {
    this.targetDye = null;
    this.alternatives = [];

    // Clear from storage
    StorageService.removeItem(STORAGE_KEYS.targetDyeId);
    logger.info('[BudgetTool] All dyes cleared');

    // Update dye selector
    this.dyeSelector?.setSelectedDyes([]);

    // Clear results
    if (this.alternativesListContainer) {
      clearContainer(this.alternativesListContainer);
    }

    // Show empty state
    this.showEmptyState(true);
    this.updateDrawerContent();
  }

  /**
   * Select a dye from external source (Color Palette drawer)
   * Sets the dye as the target color and updates the UI.
   *
   * @param dye The dye to select as the target
   */
  public selectDye(dye: Dye): void {
    if (!dye) return;

    this.targetDye = dye;

    // Persist to storage
    StorageService.setItem(STORAGE_KEYS.targetDyeId, dye.id);
    logger.info(`[BudgetTool] External dye selected: ${dye.name}`);

    // Update DyeSelector if it exists
    if (this.dyeSelector) {
      this.dyeSelector.setSelectedDyes([dye]);
    }

    // Call findAlternatives() instead of filterAndSortAlternatives()
    // This properly hides empty state and fetches data
    this.findAlternatives();
    this.updateTargetDyeDisplay();
    this.updateDrawerContent();
  }
}
