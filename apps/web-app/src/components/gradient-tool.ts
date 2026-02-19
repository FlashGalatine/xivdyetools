/**
 * XIV Dye Tools v4.0.0 - Gradient Tool Component (Gradient Builder)
 *
 * V4 Renamed: mixer-tool.ts → gradient-tool.ts
 * Creates color gradients between two dyes with intermediate matches.
 *
 * Left Panel: Start/End dye selectors, steps slider, color space toggle, filters, market board
 * Right Panel: Gradient preview, intermediate dye matches, export options
 *
 * @module components/tools/gradient-tool
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { DyeSelector } from '@components/dye-selector';
import { DyeFilters } from '@components/dye-filters';
import { MarketBoard } from '@components/market-board';
import type { ResultCard, ResultCardData, ContextAction } from '@components/v4/result-card';
import '@components/v4/share-button';
import type { ShareButton } from '@components/v4/share-button';
import { RouterService } from '@services/router-service';
import { ShareService } from '@services/share-service';
import {
  ColorService,
  ConfigController,
  dyeService,
  LanguageService,
  MarketBoardService,
  StorageService,
  ToastService,
  WorldService,
  // WEB-REF-003 Phase 3: Shared panel builders
  buildFiltersPanel,
  buildMarketPanel,
} from '@services/index';
// Note: setupMarketBoardListeners still used by drawer code until Phase 2 refactor
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import { ICON_TOOL_MIXER } from '@shared/tool-icons';
// Note: ICON_FILTER and ICON_MARKET still used by drawer code until Phase 2 refactor
import { ICON_FILTER, ICON_MARKET, ICON_EXPORT, ICON_STAIRS, ICON_PALETTE } from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, PriceData } from '@shared/types';
import type {
  GradientConfig,
  DisplayOptionsConfig,
  MarketConfig,
  InterpolationMode,
  MatchingMethod,
} from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';

// ============================================================================
// Types and Constants
// ============================================================================

export interface GradientToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Interpolation step with dye match
 */
interface InterpolationStep {
  position: number; // 0-1
  theoreticalColor: string;
  matchedDye: Dye | null;
  distance: number;
}

/**
 * Storage keys for v3 mixer tool
 */
const STORAGE_KEYS = {
  stepCount: 'v3_mixer_steps',
  colorSpace: 'v3_mixer_color_space',
  selectedDyes: 'v3_mixer_selected_dyes',
  // Legacy keys for migration
  startDyeId: 'v3_mixer_start_dye_id',
  endDyeId: 'v3_mixer_end_dye_id',
} as const;

/**
 * Default values
 */
const DEFAULTS = {
  stepCount: 8,
  colorSpace: 'hsv' as const,
};

// ============================================================================
// MixerTool Component
// ============================================================================

/**
 * Mixer Tool - v3 Two-Panel Layout
 *
 * Creates smooth color transitions between two dyes with intermediate matches.
 */
export class GradientTool extends BaseComponent {
  private options: GradientToolOptions;

  // State - selectedDyes[0] = start, selectedDyes[1] = end
  private selectedDyes: Dye[] = [];
  private stepCount: number;
  private colorSpace: InterpolationMode;
  private matchingMethod: MatchingMethod = 'oklab';
  private currentSteps: InterpolationStep[] = [];

  // Market Board Service integration
  private marketBoardService: MarketBoardService;

  // Computed getters for market data (delegates to shared service)
  private get showPrices(): boolean {
    return this.marketBoardService.getShowPrices();
  }

  private get priceData(): Map<number, PriceData> {
    return this.marketBoardService.getAllPrices();
  }

  // Computed getters for backward compatibility
  private get startDye(): Dye | null {
    return this.selectedDyes[0] || null;
  }

  private get endDye(): Dye | null {
    return this.selectedDyes[1] || null;
  }

  // Child components (desktop)
  private dyeSelector: DyeSelector | null = null;
  private dyeFilters: DyeFilters | null = null;
  private marketBoard: MarketBoard | null = null;
  private dyeSelectionPanel: CollapsiblePanel | null = null;
  private settingsPanel: CollapsiblePanel | null = null;
  private filtersPanel: CollapsiblePanel | null = null;
  private marketPanel: CollapsiblePanel | null = null;

  // Child components (mobile drawer - separate instances for independent panel states)
  private mobileDyeSelectionPanel: CollapsiblePanel | null = null;
  private mobileSettingsPanel: CollapsiblePanel | null = null;
  private mobileFiltersPanel: CollapsiblePanel | null = null;
  private mobileMarketPanel: CollapsiblePanel | null = null;
  private mobileDyeSelector: DyeSelector | null = null;
  private mobileDyeFilters: DyeFilters | null = null;
  private mobileMarketBoard: MarketBoard | null = null;
  private mobileStepValueDisplay: HTMLElement | null = null;

  // DOM References
  private selectedDyesContainer: HTMLElement | null = null;
  private mobileSelectedDyesContainer: HTMLElement | null = null;
  private stepValueDisplay: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private gradientContainer: HTMLElement | null = null;
  private matchesContainer: HTMLElement | null = null;
  private exportContainer: HTMLElement | null = null;
  private resultsHeader: HTMLElement | null = null;
  private resultsHeaderContainer: HTMLElement | null = null;
  private shareButton: ShareButton | null = null;

  // V4 Result Card references (for price updates)
  private v4ResultCards: ResultCard[] = [];

  // Subscriptions
  private languageUnsubscribe: (() => void) | null = null;
  private configUnsubscribe: (() => void) | null = null;
  private marketConfigUnsubscribe: (() => void) | null = null;

  // Display options (from ConfigController) - for future v4-result-card migration
  private displayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

  // Guard flag to prevent selection-changed event from overwriting state during external selection
  private isExternalSelection = false;

  constructor(container: HTMLElement, options: GradientToolOptions) {
    super(container);
    this.options = options;

    // Initialize shared MarketBoardService
    this.marketBoardService = MarketBoardService.getInstance();

    // Load persisted settings
    this.stepCount = StorageService.getItem<number>(STORAGE_KEYS.stepCount) ?? DEFAULTS.stepCount;
    this.colorSpace =
      StorageService.getItem<InterpolationMode>(STORAGE_KEYS.colorSpace) ?? DEFAULTS.colorSpace;

    // Load display options from ConfigController
    const configController = ConfigController.getInstance();
    const gradientConfig = configController.getConfig('gradient');
    this.displayOptions = gradientConfig.displayOptions ?? { ...DEFAULT_DISPLAY_OPTIONS };

    // Note: showPrices now comes from MarketBoardService getter

    // Load persisted dye selections (with migration from old format)
    this.loadSelectedDyes();
  }

  /**
   * Load selected dyes from storage, migrating from old format if needed
   */
  private loadSelectedDyes(): void {
    // Try new storage format first
    const savedDyeIds = StorageService.getItem<number[]>(STORAGE_KEYS.selectedDyes);

    if (savedDyeIds && savedDyeIds.length > 0) {
      // Load from new format
      this.selectedDyes = savedDyeIds
        .map((id) => dyeService.getDyeById(id))
        .filter((dye): dye is Dye => dye !== null);
    } else {
      // Migrate from old format (separate start/end dye IDs)
      const startDyeId = StorageService.getItem<number>(STORAGE_KEYS.startDyeId);
      const endDyeId = StorageService.getItem<number>(STORAGE_KEYS.endDyeId);

      const dyes: Dye[] = [];
      if (startDyeId) {
        const startDye = dyeService.getDyeById(startDyeId);
        if (startDye) dyes.push(startDye);
      }
      if (endDyeId) {
        const endDye = dyeService.getDyeById(endDyeId);
        if (endDye) dyes.push(endDye);
      }

      if (dyes.length > 0) {
        this.selectedDyes = dyes;
        // Save to new format
        this.saveSelectedDyes();
        // Clean up old keys
        StorageService.removeItem(STORAGE_KEYS.startDyeId);
        StorageService.removeItem(STORAGE_KEYS.endDyeId);
        logger.info('[MixerTool] Migrated dye selection from old storage format');
      }
    }
  }

  /**
   * Save selected dyes to storage
   */
  private saveSelectedDyes(): void {
    const dyeIds = this.selectedDyes.map((d) => d.id);
    StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);
  }

  /**
   * Find a dye by its itemID (FFXIV game item ID).
   * Share URLs use itemID, but getDyeById() uses internal database id.
   */
  private findDyeByItemId(itemId: number): Dye | null {
    const allDyes = dyeService.getAllDyes();
    return allDyes.find((d) => d.itemID === itemId) ?? null;
  }

  /**
   * Load tool state from share URL parameters if present.
   * Called on mount to restore shared state.
   */
  private loadFromShareUrl(): void {
    const parsed = ShareService.getShareParamsFromCurrentUrl();
    if (!parsed || parsed.tool !== 'gradient') {
      return;
    }

    const params = parsed.params;
    let hasChanges = false;

    // Load start dye
    if (typeof params.start === 'number') {
      const startDye = this.findDyeByItemId(params.start);
      if (startDye) {
        this.selectedDyes[0] = startDye;
        hasChanges = true;
      }
    }

    // Load end dye
    if (typeof params.end === 'number') {
      const endDye = this.findDyeByItemId(params.end);
      if (endDye) {
        this.selectedDyes[1] = endDye;
        hasChanges = true;
      }
    }

    // Load step count
    if (typeof params.steps === 'number' && params.steps >= 2 && params.steps <= 10) {
      this.stepCount = params.steps;
      StorageService.setItem(STORAGE_KEYS.stepCount, params.steps);
    }

    // Load interpolation mode (color space)
    if (params.interpolation && typeof params.interpolation === 'string') {
      const validModes = ['rgb', 'hsv', 'lab', 'oklch', 'lch'];
      if (validModes.includes(params.interpolation)) {
        this.colorSpace = params.interpolation as typeof this.colorSpace;
        StorageService.setItem(STORAGE_KEYS.colorSpace, params.interpolation);
      }
    }

    // Load matching algorithm
    if (params.algo && typeof params.algo === 'string') {
      const validAlgos = ['oklab', 'ciede2000', 'euclidean'];
      if (validAlgos.includes(params.algo)) {
        this.matchingMethod = params.algo as typeof this.matchingMethod;
      }
    }

    // If dyes were loaded, save and sync selectors
    if (hasChanges) {
      this.saveSelectedDyes();
      // Sync to selector UI (will be done after render in onMount)
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
    // Load from share URL first (overrides localStorage if URL params present)
    this.loadFromShareUrl();

    // Sync DyeSelector with loaded dyes (from URL or localStorage)
    if (this.selectedDyes.length > 0) {
      this.dyeSelector?.setSelectedDyes(this.selectedDyes);
      this.mobileDyeSelector?.setSelectedDyes(this.selectedDyes);
      this.updateSelectedDyesDisplay();
      this.updateMobileSelectedDyesDisplay();
    }

    // Subscribe to language changes (only in onMount, NOT bindEvents - avoids infinite loop)
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update();
    });

    // Subscribe to config changes from V4 ConfigSidebar
    const configController = ConfigController.getInstance();
    this.configUnsubscribe = configController.subscribe('gradient', (config) => {
      this.setConfig(config);
    });

    // Subscribe to market config changes
    this.marketConfigUnsubscribe = configController.subscribe('market', (config) => {
      this.setConfig(config);
    });

    // Sync MarketBoard components with ConfigController on initial load
    const marketConfig = configController.getConfig('market');
    if (this.marketBoard) {
      this.marketBoard.setSelectedServer(marketConfig.selectedServer);
      this.marketBoard.setShowPrices(marketConfig.showPrices);
    }
    if (this.mobileMarketBoard) {
      this.mobileMarketBoard.setSelectedServer(marketConfig.selectedServer);
      this.mobileMarketBoard.setShowPrices(marketConfig.showPrices);
    }

    // If dyes were loaded from storage or URL, calculate interpolation
    if (this.startDye && this.endDye) {
      this.updateInterpolation();
      this.updateDrawerContent();
    }

    // Initial responsive layout update
    this.updateGradientLayout();

    // Listen for window resize to update responsive layout
    this.on(window, 'resize', () => {
      this.updateGradientLayout();
    });

    logger.info('[GradientTool] Mounted');
  }

  destroy(): void {
    this.languageUnsubscribe?.();
    this.configUnsubscribe?.();
    this.marketConfigUnsubscribe?.();

    // Destroy desktop components
    this.dyeSelector?.destroy();
    this.dyeFilters?.destroy();
    this.marketBoard?.destroy();
    this.dyeSelectionPanel?.destroy();
    this.settingsPanel?.destroy();
    this.filtersPanel?.destroy();
    this.marketPanel?.destroy();

    // Destroy mobile drawer components
    this.mobileDyeSelector?.destroy();
    this.mobileDyeFilters?.destroy();
    this.mobileMarketBoard?.destroy();
    this.mobileDyeSelectionPanel?.destroy();
    this.mobileSettingsPanel?.destroy();
    this.mobileFiltersPanel?.destroy();
    this.mobileMarketPanel?.destroy();

    this.selectedDyes = [];
    this.currentSteps = [];

    super.destroy();
    logger.info('[MixerTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   * Accepts both GradientConfig and MarketConfig properties
   */
  public setConfig(config: Partial<GradientConfig> & Partial<MarketConfig>): void {
    let needsUpdate = false;

    // Handle stepCount
    if (config.stepCount !== undefined && config.stepCount !== this.stepCount) {
      this.stepCount = config.stepCount;
      StorageService.setItem(STORAGE_KEYS.stepCount, config.stepCount);
      needsUpdate = true;
      logger.info(`[GradientTool] setConfig: stepCount -> ${config.stepCount}`);

      // Update desktop display
      if (this.stepValueDisplay) {
        this.stepValueDisplay.textContent = String(config.stepCount);
      }
      // Update mobile display
      if (this.mobileStepValueDisplay) {
        this.mobileStepValueDisplay.textContent = String(config.stepCount);
      }
    }

    // Handle interpolation (maps to colorSpace)
    if (config.interpolation !== undefined) {
      if (config.interpolation !== this.colorSpace) {
        this.colorSpace = config.interpolation;
        StorageService.setItem(STORAGE_KEYS.colorSpace, config.interpolation);
        needsUpdate = true;
        logger.info(`[GradientTool] setConfig: interpolation -> ${config.interpolation}`);
      }
    }

    // Handle matchingMethod - re-calculate gradient when algorithm changes
    if (config.matchingMethod !== undefined && config.matchingMethod !== this.matchingMethod) {
      this.matchingMethod = config.matchingMethod;
      needsUpdate = true;
      logger.info(`[GradientTool] setConfig: matchingMethod -> ${config.matchingMethod}`);
    }

    // Handle display options changes - re-render results when these change
    if (config.displayOptions) {
      const oldOptions = this.displayOptions;
      this.displayOptions = { ...this.displayOptions, ...config.displayOptions };
      logger.info('[GradientTool] setConfig: displayOptions updated', config.displayOptions);

      // Check if any display option actually changed
      const hasChanged = Object.keys(config.displayOptions).some(
        (key) =>
          oldOptions[key as keyof typeof oldOptions] !==
          config.displayOptions![key as keyof typeof config.displayOptions]
      );

      if (hasChanged) {
        // Re-render results to reflect new display options
        this.renderIntermediateMatches();
        logger.info('[GradientTool] Re-rendered results with new display options');
      }
    }

    // Handle market config changes (showPrices, selectedServer)
    // Note: MarketBoardService manages state via ConfigController subscription
    if ('showPrices' in config) {
      const showPrices = config.showPrices as boolean;
      logger.info(`[GradientTool] setConfig: showPrices -> ${showPrices}`);

      // Update both MarketBoard UI instances
      if (this.marketBoard) {
        this.marketBoard.setShowPrices(showPrices);
      }
      if (this.mobileMarketBoard) {
        this.mobileMarketBoard.setShowPrices(showPrices);
      }

      // Fetch prices if enabled, or re-render to hide them
      if (showPrices) {
        void this.fetchPricesForDisplayedDyes();
      } else {
        this.renderIntermediateMatches();
      }
    }

    if ('selectedServer' in config) {
      const selectedServer = config.selectedServer as string;
      logger.info(`[GradientTool] setConfig: selectedServer -> ${selectedServer}`);

      // Update both MarketBoard UI instances with the new server
      if (this.marketBoard) {
        this.marketBoard.setSelectedServer(selectedServer);
      }
      if (this.mobileMarketBoard) {
        this.mobileMarketBoard.setSelectedServer(selectedServer);
      }

      // Re-fetch prices with the new server (service clears cache automatically on server change)
      if (this.showPrices) {
        void this.fetchPricesForDisplayedDyes();
      }
    }

    // Re-interpolate if any config changed and we have data
    if (needsUpdate && this.startDye && this.endDye) {
      void this.updateInterpolation();
      this.updateDrawerContent();
    }
  }

  // ============================================================================
  // Left Panel Rendering
  // ============================================================================

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Section 1: Dye Selection (consolidated - select 2 dyes)
    const dyeSelectionContainer = this.createElement('div');
    left.appendChild(dyeSelectionContainer);
    this.dyeSelectionPanel = new CollapsiblePanel(dyeSelectionContainer, {
      title: LanguageService.t('mixer.dyeSelection'),
      storageKey: 'v3_mixer_dye_selection_panel',
      defaultOpen: true,
      icon: ICON_PALETTE,
    });
    this.dyeSelectionPanel.init();
    const dyeSelectionContent = this.createElement('div', { className: 'p-4' });
    this.renderDyeSelector(dyeSelectionContent);
    this.dyeSelectionPanel.setContent(dyeSelectionContent);

    // Section 2: Interpolation Settings (collapsible)
    const settingsContainer = this.createElement('div');
    left.appendChild(settingsContainer);
    this.settingsPanel = new CollapsiblePanel(settingsContainer, {
      title: LanguageService.t('mixer.interpolationSettings'),
      storageKey: 'v3_mixer_settings_panel',
      defaultOpen: true,
      icon: ICON_STAIRS,
    });
    this.settingsPanel.init();
    const settingsContent = this.createElement('div', { className: 'p-4' });
    this.renderSettings(settingsContent);
    this.settingsPanel.setContent(settingsContent);

    // Section 3: Dye Filters (collapsible)
    // WEB-REF-003 Phase 3: Refactored to use shared builder
    const filtersContainer = this.createElement('div');
    left.appendChild(filtersContainer);
    const filtersRefs = buildFiltersPanel(this, filtersContainer, {
      storageKey: 'v3_mixer_filters',
      storageKeyPrefix: 'v3_mixer',
      onFilterChange: () => {
        this.updateInterpolation();
      },
    });
    this.filtersPanel = filtersRefs.panel;
    this.dyeFilters = filtersRefs.filters;

    // Section 4: Market Board (collapsible)
    // WEB-REF-003 Phase 3: Refactored to use shared builder
    const marketContainer = this.createElement('div');
    left.appendChild(marketContainer);
    const marketRefs = buildMarketPanel(this, marketContainer, {
      storageKey: 'v3_mixer_market',
      getShowPrices: () => this.showPrices,
      fetchPrices: () => this.fetchPricesForDisplayedDyes(),
      onPricesToggled: () => {
        if (this.showPrices) {
          void this.fetchPricesForDisplayedDyes();
        } else {
          this.updateSelectedDyesDisplay();
          this.renderIntermediateMatches();
        }
      },
      onServerChanged: () => {
        if (this.showPrices) {
          void this.fetchPricesForDisplayedDyes();
        }
      },
    });
    this.marketPanel = marketRefs.panel;
    this.marketBoard = marketRefs.marketBoard;
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
   * Create a header for right panel sections
   */
  private createHeader(text: string): HTMLElement {
    return this.createElement('h3', {
      className: 'text-sm font-semibold uppercase tracking-wider mb-3',
      textContent: text,
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
  }

  /**
   * Render consolidated dye selector section (select 2 dyes: start and end)
   */
  private renderDyeSelector(container: HTMLElement): void {
    const dyeContainer = this.createElement('div', { className: 'space-y-3' });

    // Instruction text
    const instruction = this.createElement('p', {
      className: 'text-sm mb-2',
      textContent: LanguageService.t('mixer.selectTwoDyes'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    dyeContainer.appendChild(instruction);

    // Selected dyes display
    const displayContainer = this.createElement('div', {
      className: 'selected-dyes-display space-y-2',
    });
    dyeContainer.appendChild(displayContainer);
    this.selectedDyesContainer = displayContainer;

    this.updateSelectedDyesDisplay();

    // Dye selector component
    const selectorContainer = this.createElement('div', { className: 'mt-3' });
    dyeContainer.appendChild(selectorContainer);

    const selector = new DyeSelector(selectorContainer, {
      maxSelections: 2,
      allowMultiple: true,
      allowDuplicates: false,
      showCategories: true,
      showPrices: true,
      excludeFacewear: true,
      showFavorites: true,
      compactMode: true,
      hideSelectedChips: true, // We show selections above with Start/End labels
    });
    selector.init();

    // Store reference
    this.dyeSelector = selector;

    // Listen for selection changes
    selectorContainer.addEventListener('selection-changed', () => {
      // Skip if this change was triggered by external selection (e.g., from Color Palette drawer)
      if (this.isExternalSelection) {
        return;
      }
      this.selectedDyes = selector.getSelectedDyes();
      this.saveSelectedDyes();
      this.updateSelectedDyesDisplay();
      this.updateInterpolation();
      this.updateDrawerContent();
    });

    // Set initial selection if dyes were loaded from storage
    if (this.selectedDyes.length > 0) {
      selector.setSelectedDyes(this.selectedDyes);
    }

    container.appendChild(dyeContainer);
  }

  /**
   * Update the selected dyes display with Start/End labels and remove buttons
   */
  private updateSelectedDyesDisplay(): void {
    if (!this.selectedDyesContainer) return;
    clearContainer(this.selectedDyesContainer);

    if (this.selectedDyes.length === 0) {
      // Empty state - dashed border placeholder
      const placeholder = this.createElement('div', {
        className: 'p-3 rounded-lg border-2 border-dashed text-center text-sm',
        textContent: LanguageService.t('mixer.selectDyes'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      this.selectedDyesContainer.appendChild(placeholder);
      return;
    }

    // Display each selected dye with role label
    const labels = [LanguageService.t('mixer.startDye'), LanguageService.t('mixer.endDye')];

    for (let i = 0; i < this.selectedDyes.length; i++) {
      const dye = this.selectedDyes[i];
      const label = labels[i];

      const card = this.createElement('div', {
        className: 'flex items-center gap-3 p-3 rounded-lg',
        attributes: { style: 'background: var(--theme-background-secondary);' },
      });

      // Color swatch
      const swatch = this.createElement('div', {
        className: 'w-10 h-10 rounded border',
        attributes: {
          style: `background: ${dye.hex}; border-color: var(--theme-border);`,
        },
      });
      card.appendChild(swatch);

      // Info section
      const info = this.createElement('div', { className: 'flex-1 min-w-0' });

      // Role label
      const roleLabel = this.createElement('p', {
        className: 'text-xs font-semibold uppercase tracking-wider',
        textContent: label,
        attributes: { style: 'color: var(--theme-primary);' },
      });
      info.appendChild(roleLabel);

      // Dye name
      const name = this.createElement('p', {
        className: 'font-medium truncate',
        textContent: LanguageService.getDyeName(dye.itemID) || dye.name,
        attributes: { style: 'color: var(--theme-text);' },
      });
      info.appendChild(name);

      // Hex and price
      const details = this.createElement('p', {
        className: 'text-xs number',
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      let detailText = dye.hex;
      const priceText = this.formatPrice(dye);
      if (priceText) {
        detailText += ` • ${priceText}`;
      }
      details.textContent = detailText;
      info.appendChild(details);

      card.appendChild(info);

      // Remove button
      const removeBtn = this.createElement('button', {
        className: 'w-8 h-8 flex items-center justify-center rounded-full transition-colors',
        textContent: '\u00D7',
        attributes: {
          style:
            'background: var(--theme-card-hover); color: var(--theme-text-muted); font-size: 1.25rem;',
          title: LanguageService.t('common.remove'),
        },
      });

      this.on(removeBtn, 'click', () => {
        // Remove this dye from selection
        const newSelection = this.selectedDyes.filter((d) => d.id !== dye.id);
        this.selectedDyes = newSelection;
        this.dyeSelector?.setSelectedDyes(newSelection);
        this.saveSelectedDyes();
        this.updateSelectedDyesDisplay();
        this.updateInterpolation();
        this.updateDrawerContent();
      });

      card.appendChild(removeBtn);
      this.selectedDyesContainer.appendChild(card);
    }
  }

  /**
   * Render interpolation settings
   */
  private renderSettings(container: HTMLElement): void {
    const settingsContainer = this.createElement('div', { className: 'space-y-4' });

    // Steps slider
    const stepsGroup = this.createElement('div');
    const stepsLabel = this.createElement('label', {
      className: 'flex items-center justify-between text-sm mb-2',
    });
    const stepsText = this.createElement('span', {
      textContent: LanguageService.t('mixer.steps'),
      attributes: { style: 'color: var(--theme-text);' },
    });
    this.stepValueDisplay = this.createElement('span', {
      className: 'number',
      textContent: String(this.stepCount),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    stepsLabel.appendChild(stepsText);
    stepsLabel.appendChild(this.stepValueDisplay);
    stepsGroup.appendChild(stepsLabel);

    const stepsInput = this.createElement('input', {
      className: 'w-full',
      attributes: {
        'data-testid': 'gradient-step-slider',
        type: 'range',
        min: '2',
        max: '10',
        value: String(this.stepCount),
        style: 'accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    this.on(stepsInput, 'input', () => {
      this.stepCount = parseInt(stepsInput.value, 10);
      if (this.stepValueDisplay) {
        this.stepValueDisplay.textContent = String(this.stepCount);
      }
      StorageService.setItem(STORAGE_KEYS.stepCount, this.stepCount);
      this.updateInterpolation();
      this.updateDrawerContent();
    });

    stepsGroup.appendChild(stepsInput);
    settingsContainer.appendChild(stepsGroup);

    // Color space dropdown
    const colorSpaceGroup = this.createElement('div');
    const colorSpaceLabel = this.createElement('label', {
      className: 'block text-sm mb-2',
      textContent: LanguageService.t('mixer.colorSpace'),
      attributes: { style: 'color: var(--theme-text);' },
    });
    colorSpaceGroup.appendChild(colorSpaceLabel);

    // Dropdown select for interpolation mode
    const colorSpaceSelect = this.createElement('select', {
      className: 'w-full px-3 py-2 text-sm rounded-lg',
      attributes: {
        'data-testid': 'gradient-colorspace-select',
        style: `
          background: var(--theme-background-secondary);
          color: var(--theme-text);
          border: 1px solid var(--theme-border);
          cursor: pointer;
        `,
      },
    }) as HTMLSelectElement;

    // Interpolation mode options with descriptive labels
    const modeOptions: { value: InterpolationMode; label: string; description: string }[] = [
      { value: 'rgb', label: 'RGB', description: LanguageService.t('gradient.mode.rgb') },
      { value: 'hsv', label: 'HSV', description: LanguageService.t('gradient.mode.hsv') },
      { value: 'lab', label: 'LAB', description: LanguageService.t('gradient.mode.lab') },
      { value: 'oklch', label: 'OKLCH', description: LanguageService.t('gradient.mode.oklch') },
      { value: 'lch', label: 'LCH', description: LanguageService.t('gradient.mode.lch') },
    ];

    for (const mode of modeOptions) {
      const option = this.createElement('option', {
        textContent: `${mode.label} - ${mode.description}`,
        attributes: { value: mode.value },
      }) as HTMLOptionElement;
      if (mode.value === this.colorSpace) {
        option.selected = true;
      }
      colorSpaceSelect.appendChild(option);
    }

    this.on(colorSpaceSelect, 'change', () => {
      this.colorSpace = colorSpaceSelect.value as InterpolationMode;
      StorageService.setItem(STORAGE_KEYS.colorSpace, this.colorSpace);
      this.updateInterpolation();
      this.updateDrawerContent();
    });

    colorSpaceGroup.appendChild(colorSpaceSelect);
    settingsContainer.appendChild(colorSpaceGroup);

    container.appendChild(settingsContainer);
  }

  // ============================================================================
  // Right Panel Rendering
  // ============================================================================

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Apply gradient-view styling to the right panel
    // Note: overflow-y handled by parent layout shell - do NOT add it here to avoid double scrollbars
    right.setAttribute(
      'style',
      `
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      padding: 32px;
      gap: 32px;
      box-sizing: border-box;
    `
    );

    // Content wrapper with max-width to prevent over-expansion on ultrawide monitors
    const contentWrapper = this.createElement('div', {
      attributes: {
        style:
          'max-width: 1200px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 32px; flex: 1;',
      },
    });

    // Gradient Builder UI section (Start node -> Path -> End node)
    // Store reference for responsive layout updates
    this.gradientBuilderUI = this.createElement('div', {
      className: 'gradient-builder-ui',
      attributes: {
        'data-testid': 'gradient-builder-ui',
        style: `
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          position: relative;
          min-height: 150px;
          background: radial-gradient(circle at center, rgba(255, 255, 255, 0.03) 0%, transparent 70%);
          border-radius: 20px;
          padding: 20px;
        `,
      },
    });
    const gradientBuilderUI = this.gradientBuilderUI;

    // Start Node - store reference for responsive layout
    this.startNodeElement = this.createElement('div', {
      className: 'gradient-node main start',
      attributes: {
        'data-testid': 'gradient-start-node',
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          z-index: 2;
          cursor: pointer;
          transition: transform 0.2s;
        `,
      },
    });
    const startNode = this.startNodeElement;
    const startCircle = this.createElement('div', {
      className: 'node-circle start-circle',
      attributes: {
        style: `
          width: 80px;
          height: 80px;
          border-radius: 50%;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          border: 4px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border-style: dashed;
          border-color: rgba(255, 255, 255, 0.3);
        `,
        title: LanguageService.t('gradient.clickToSelectStart'),
      },
    });
    startCircle.innerHTML =
      '<span style="font-size: 32px; color: rgba(255, 255, 255, 0.4); font-weight: 300;">+</span>';
    const startLabel = this.createElement('span', {
      className: 'node-label',
      textContent: LanguageService.t('gradient.selectColor'),
      attributes: {
        style:
          'font-size: 12px; color: var(--theme-text-muted); text-transform: uppercase; font-weight: 500;',
      },
    });
    startNode.appendChild(startCircle);
    startNode.appendChild(startLabel);
    gradientBuilderUI.appendChild(startNode);

    // Gradient Path Container
    const pathContainer = this.createElement('div', {
      className: 'gradient-path-container',
      attributes: {
        style: `
          flex: 1;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          margin: 0 16px;
          position: relative;
          border-radius: 3px;
          max-width: 400px;
        `,
      },
    });

    // Gradient Track (filled gradient)
    const gradientTrack = this.createElement('div', {
      className: 'gradient-track',
      attributes: {
        style: `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border-radius: 3px;
          opacity: 0.8;
          background: repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 4px, transparent 4px, transparent 8px);
        `,
      },
    });
    pathContainer.appendChild(gradientTrack);

    // Step markers container (we'll update these dynamically)
    this.gradientContainer = pathContainer; // Repurpose for step markers
    this.pathContainerElement = pathContainer; // Also store for responsive layout
    gradientBuilderUI.appendChild(pathContainer);

    // End Node - store reference for responsive layout
    this.endNodeElement = this.createElement('div', {
      className: 'gradient-node main end',
      attributes: {
        'data-testid': 'gradient-end-node',
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          z-index: 2;
          cursor: pointer;
          transition: transform 0.2s;
        `,
      },
    });
    const endNode = this.endNodeElement;
    const endCircle = this.createElement('div', {
      className: 'node-circle end-circle',
      attributes: {
        style: `
          width: 80px;
          height: 80px;
          border-radius: 50%;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          border: 4px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border-style: dashed;
          border-color: rgba(255, 255, 255, 0.3);
        `,
        title: LanguageService.t('gradient.clickToSelectEnd'),
      },
    });
    endCircle.innerHTML =
      '<span style="font-size: 32px; color: rgba(255, 255, 255, 0.4); font-weight: 300;">+</span>';
    const endLabel = this.createElement('span', {
      className: 'node-label',
      textContent: LanguageService.t('gradient.selectColor'),
      attributes: {
        style:
          'font-size: 12px; color: var(--theme-text-muted); text-transform: uppercase; font-weight: 500;',
      },
    });
    endNode.appendChild(endCircle);
    endNode.appendChild(endLabel);
    gradientBuilderUI.appendChild(endNode);

    contentWrapper.appendChild(gradientBuilderUI);

    // Results section container
    const resultsSection = this.createElement('div', {
      attributes: {
        'data-testid': 'gradient-results-section',
        style:
          'width: 100%; overflow: hidden; display: flex; flex-direction: column; position: relative; flex: 1;',
      },
    });

    // Results header (using consistent section-header/section-title pattern from other tools)
    // Hidden by default - shown when dyes are selected via showEmptyState(false)
    this.resultsHeaderContainer = this.createElement('div', {
      className: 'section-header',
      attributes: {
        style: 'width: 100%; display: none; justify-content: space-between; align-items: center;',
      },
    });
    this.resultsHeader = this.createElement('span', {
      className: 'section-title',
      textContent: `${LanguageService.t('gradient.gradientResults')} (${this.stepCount} Steps)`,
    });

    // Share Button - v4-share-button custom element
    this.shareButton = document.createElement('v4-share-button') as ShareButton;
    this.shareButton.tool = 'gradient';
    this.shareButton.shareParams = this.getShareParams();

    this.resultsHeaderContainer.appendChild(this.resultsHeader);
    this.resultsHeaderContainer.appendChild(this.shareButton);
    resultsSection.appendChild(this.resultsHeaderContainer);

    // Matches container (for harmony-cards)
    this.matchesContainer = this.createElement('div', {
      className: 'gradient-results-list',
      attributes: {
        'data-testid': 'gradient-matches-container',
        style: `
          display: flex;
          flex-direction: row;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
          width: 100%;
          padding: 20px 0;
          --v4-result-card-width: 280px;
        `,
      },
    });

    // Empty state message (inside results area, positioned near the gradient nodes)
    this.emptyStateContainer = this.createElement('div', {
      className: 'empty-state-message',
      attributes: {
        'data-testid': 'gradient-empty-state',
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          height: 100%;
          min-height: 200px;
          color: var(--theme-text-muted);
          text-align: center;
          padding: 60px 40px 40px 40px;
        `,
      },
    });
    this.emptyStateContainer.innerHTML = `
      <div style="width: 150px; height: 150px; opacity: 0.3; margin-bottom: 16px; color: currentColor;">
        ${ICON_TOOL_MIXER}
      </div>
      <div style="font-size: 16px; color: var(--theme-text); margin-bottom: 8px;">${LanguageService.t('gradient.setStartAndEnd')}</div>
      <div style="font-size: 14px; opacity: 0.7;">${LanguageService.t('gradient.clickPlusButtons')}</div>
    `;

    resultsSection.appendChild(this.emptyStateContainer);
    resultsSection.appendChild(this.matchesContainer);
    contentWrapper.appendChild(resultsSection);

    // Export container (hidden by default)
    this.exportContainer = this.createElement('div', { attributes: { style: 'display: none;' } });
    contentWrapper.appendChild(this.exportContainer);

    right.appendChild(contentWrapper);

    // Store references to update dynamically
    this.startCircleElement = startCircle;
    this.startLabelElement = startLabel;
    this.endCircleElement = endCircle;
    this.endLabelElement = endLabel;
    this.gradientTrackElement = gradientTrack;
  }

  // DOM element references for dynamic updates
  private startCircleElement: HTMLElement | null = null;
  private startLabelElement: HTMLElement | null = null;
  private endCircleElement: HTMLElement | null = null;
  private endLabelElement: HTMLElement | null = null;
  private gradientTrackElement: HTMLElement | null = null;
  // Additional references for responsive layout
  private gradientBuilderUI: HTMLElement | null = null;
  private startNodeElement: HTMLElement | null = null;
  private endNodeElement: HTMLElement | null = null;
  private pathContainerElement: HTMLElement | null = null;

  /**
   * Update gradient nodes and track based on current dye selections
   */
  private updateGradientNodes(): void {
    // Update Start node
    if (this.startCircleElement && this.startLabelElement) {
      if (this.startDye) {
        this.startCircleElement.style.background = this.startDye.hex;
        this.startCircleElement.style.borderStyle = 'solid';
        this.startCircleElement.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.startCircleElement.innerHTML = '';
        this.startLabelElement.textContent = `Start (${LanguageService.getDyeName(this.startDye.itemID) || this.startDye.name})`;
      } else {
        this.startCircleElement.style.background = 'transparent';
        this.startCircleElement.style.borderStyle = 'dashed';
        this.startCircleElement.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        this.startCircleElement.innerHTML =
          '<span style="font-size: 32px; color: rgba(255, 255, 255, 0.4); font-weight: 300;">+</span>';
        this.startLabelElement.textContent = LanguageService.t('gradient.selectColor');
      }
    }

    // Update End node
    if (this.endCircleElement && this.endLabelElement) {
      if (this.endDye) {
        this.endCircleElement.style.background = this.endDye.hex;
        this.endCircleElement.style.borderStyle = 'solid';
        this.endCircleElement.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.endCircleElement.innerHTML = '';
        this.endLabelElement.textContent = `End (${LanguageService.getDyeName(this.endDye.itemID) || this.endDye.name})`;
      } else {
        this.endCircleElement.style.background = 'transparent';
        this.endCircleElement.style.borderStyle = 'dashed';
        this.endCircleElement.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        this.endCircleElement.innerHTML =
          '<span style="font-size: 32px; color: rgba(255, 255, 255, 0.4); font-weight: 300;">+</span>';
        this.endLabelElement.textContent = LanguageService.t('gradient.selectColor');
      }
    }

    // Update gradient track
    if (this.gradientTrackElement) {
      if (this.startDye && this.endDye) {
        this.gradientTrackElement.style.background = `linear-gradient(to right, ${this.startDye.hex}, ${this.endDye.hex})`;
      } else if (this.startDye) {
        this.gradientTrackElement.style.background = `linear-gradient(to right, ${this.startDye.hex}, rgba(255,255,255,0.1))`;
      } else if (this.endDye) {
        this.gradientTrackElement.style.background = `linear-gradient(to right, rgba(255,255,255,0.1), ${this.endDye.hex})`;
      } else {
        this.gradientTrackElement.style.background =
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.1) 0px, rgba(255,255,255,0.1) 4px, transparent 4px, transparent 8px)';
      }
    }
  }

  /**
   * Update gradient builder UI layout for responsive display.
   * On mobile (<768px), reduces circle sizes and step marker sizes to fit better.
   * Called on mount and window resize.
   */
  private updateGradientLayout(): void {
    const isMobile = window.innerWidth < 768;

    // Circle sizes: 80px desktop, 60px mobile
    const circleSize = isMobile ? '60px' : '80px';
    // Plus sign font size: 32px desktop, 24px mobile
    const plusFontSize = isMobile ? '24px' : '32px';
    // Node gap: 12px desktop, 8px mobile
    const nodeGap = isMobile ? '8px' : '12px';
    // Path margin: 16px desktop, 8px mobile
    const pathMargin = isMobile ? '0 8px' : '0 16px';
    // Builder padding: 20px desktop, 12px mobile
    const builderPadding = isMobile ? '12px' : '20px';
    // Min-height: 150px desktop, 120px mobile
    const minHeight = isMobile ? '120px' : '150px';

    // Update gradient builder UI container
    if (this.gradientBuilderUI) {
      this.gradientBuilderUI.style.padding = builderPadding;
      this.gradientBuilderUI.style.minHeight = minHeight;
    }

    // Update start circle
    if (this.startCircleElement) {
      this.startCircleElement.style.width = circleSize;
      this.startCircleElement.style.height = circleSize;
      // Update plus sign if no dye selected
      if (!this.startDye) {
        this.startCircleElement.innerHTML = `<span style="font-size: ${plusFontSize}; color: rgba(255, 255, 255, 0.4); font-weight: 300;">+</span>`;
      }
    }

    // Update end circle
    if (this.endCircleElement) {
      this.endCircleElement.style.width = circleSize;
      this.endCircleElement.style.height = circleSize;
      // Update plus sign if no dye selected
      if (!this.endDye) {
        this.endCircleElement.innerHTML = `<span style="font-size: ${plusFontSize}; color: rgba(255, 255, 255, 0.4); font-weight: 300;">+</span>`;
      }
    }

    // Update node containers gap
    if (this.startNodeElement) {
      this.startNodeElement.style.gap = nodeGap;
    }
    if (this.endNodeElement) {
      this.endNodeElement.style.gap = nodeGap;
    }

    // Update path container margin
    if (this.pathContainerElement) {
      this.pathContainerElement.style.margin = pathMargin;
    }

    // Re-render step markers with appropriate sizes if we have dyes selected
    if (this.startDye && this.endDye && this.currentSteps.length > 0) {
      this.renderGradientPreview();
    }
  }

  /**
   * Update all results
   */
  private updateInterpolation(): void {
    // Always update gradient nodes to reflect current selection state
    this.updateGradientNodes();

    // Update results header with current step count
    if (this.resultsHeader) {
      this.resultsHeader.textContent = `${LanguageService.t('gradient.gradientResults')} (${this.stepCount} Steps)`;
    }

    if (!this.startDye || !this.endDye) {
      this.showEmptyState(true);
      this.currentSteps = [];
      return;
    }

    this.showEmptyState(false);
    this.calculateInterpolation();
    this.renderGradientPreview();
    this.renderIntermediateMatches();
    this.renderExportOptions();
  }

  /**
   * Show/hide empty state and matches container
   */
  private showEmptyState(show: boolean): void {
    if (this.emptyStateContainer) {
      this.emptyStateContainer.style.display = show ? 'flex' : 'none';
    }
    if (this.matchesContainer) {
      this.matchesContainer.style.display = show ? 'none' : 'flex';
    }
    // Hide results header when showing empty state
    if (this.resultsHeaderContainer) {
      this.resultsHeaderContainer.style.display = show ? 'none' : 'flex';
    }
    // Update share button state
    this.updateShareButton();
  }

  // ============================================================================
  // Share Functionality
  // ============================================================================

  /**
   * Get current share parameters for the share button
   */
  private getShareParams(): Record<string, unknown> {
    if (!this.startDye || !this.endDye) {
      return {};
    }

    return {
      start: this.startDye.itemID,
      end: this.endDye.itemID,
      steps: this.stepCount,
      interpolation: this.colorSpace,
      algo: this.matchingMethod,
    };
  }

  /**
   * Update share button parameters when state changes
   */
  private updateShareButton(): void {
    if (this.shareButton) {
      this.shareButton.shareParams = this.getShareParams();
      // Disable share button if not both dyes selected
      this.shareButton.disabled = !this.startDye || !this.endDye;
    }
  }

  /**
   * Calculate interpolation steps
   *
   * Interpolation modes and their characteristics:
   * - RGB: Linear RGB interpolation (gray midpoints for complementary colors)
   * - HSV: Hue-based interpolation with wraparound (vibrant but can be unpredictable)
   * - LAB: Perceptually uniform (good for natural transitions, has blue issues)
   * - OKLCH: Modern perceptual with hue (best for gradients, fixes LAB's blue distortion)
   * - LCH: Cylindrical LAB with hue (good balance of perceptual uniformity)
   */
  private calculateInterpolation(): void {
    if (!this.startDye || !this.endDye) {
      this.currentSteps = [];
      return;
    }

    const result: InterpolationStep[] = [];
    const steps = this.stepCount;

    for (let i = 0; i < steps; i++) {
      const t = steps === 1 ? 0 : i / (steps - 1);

      let theoreticalColor: string;

      switch (this.colorSpace) {
        case 'rgb': {
          // RGB interpolation (linear)
          const startRgb = ColorService.hexToRgb(this.startDye.hex);
          const endRgb = ColorService.hexToRgb(this.endDye.hex);

          const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * t);
          const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * t);
          const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * t);

          theoreticalColor = ColorService.rgbToHex(r, g, b);
          break;
        }

        case 'hsv': {
          // HSV interpolation (with hue wraparound)
          const startHsv = ColorService.hexToHsv(this.startDye.hex);
          const endHsv = ColorService.hexToHsv(this.endDye.hex);

          // Handle hue wraparound (take shorter path)
          let hueDiff = endHsv.h - startHsv.h;
          if (hueDiff > 180) hueDiff -= 360;
          if (hueDiff < -180) hueDiff += 360;

          const h = (startHsv.h + hueDiff * t + 360) % 360;
          const s = startHsv.s + (endHsv.s - startHsv.s) * t;
          const v = startHsv.v + (endHsv.v - startHsv.v) * t;

          theoreticalColor = ColorService.hsvToHex(h, s, v);
          break;
        }

        case 'lab': {
          // LAB interpolation (perceptually uniform, linear in L*a*b*)
          const startLab = ColorService.hexToLab(this.startDye.hex);
          const endLab = ColorService.hexToLab(this.endDye.hex);

          const L = startLab.L + (endLab.L - startLab.L) * t;
          const a = startLab.a + (endLab.a - startLab.a) * t;
          const b = startLab.b + (endLab.b - startLab.b) * t;

          theoreticalColor = ColorService.labToHex(L, a, b);
          break;
        }

        case 'oklch': {
          // OKLCH interpolation (modern perceptual with hue)
          const startOklch = ColorService.hexToOklch(this.startDye.hex);
          const endOklch = ColorService.hexToOklch(this.endDye.hex);

          // Handle hue wraparound (take shorter path)
          let hueDiff = endOklch.h - startOklch.h;
          if (hueDiff > 180) hueDiff -= 360;
          if (hueDiff < -180) hueDiff += 360;

          const L = startOklch.L + (endOklch.L - startOklch.L) * t;
          const C = startOklch.C + (endOklch.C - startOklch.C) * t;
          const h = (startOklch.h + hueDiff * t + 360) % 360;

          theoreticalColor = ColorService.oklchToHex(L, C, h);
          break;
        }

        case 'lch': {
          // LCH interpolation (cylindrical LAB with hue)
          const startLch = ColorService.hexToLch(this.startDye.hex);
          const endLch = ColorService.hexToLch(this.endDye.hex);

          // Handle hue wraparound (take shorter path)
          let hueDiff = endLch.h - startLch.h;
          if (hueDiff > 180) hueDiff -= 360;
          if (hueDiff < -180) hueDiff += 360;

          const L = startLch.L + (endLch.L - startLch.L) * t;
          const C = startLch.C + (endLch.C - startLch.C) * t;
          const h = (startLch.h + hueDiff * t + 360) % 360;

          theoreticalColor = ColorService.lchToHex(L, C, h);
          break;
        }

        default:
          // Default to HSV for backward compatibility
          theoreticalColor = ColorService.hsvToHex(0, 0, 50);
      }

      // Find closest dye (excluding start and end) using configured matching algorithm
      const excludeIds = [this.startDye.id, this.endDye.id];
      let matchedDye = dyeService.findClosestDye(theoreticalColor, {
        excludeIds,
        matchingMethod: this.matchingMethod,
      });

      // Apply filters if available
      if (this.dyeFilters && matchedDye && this.dyeFilters.isDyeExcluded(matchedDye)) {
        // Find next closest non-excluded dye
        const allDyes = dyeService.getAllDyes();
        const filteredDyes = this.dyeFilters
          .filterDyes(allDyes)
          .filter((dye) => !excludeIds.includes(dye.id) && dye.category !== 'Facewear');
        matchedDye =
          filteredDyes.length > 0
            ? filteredDyes.reduce((best, dye) => {
                const bestDist = ColorService.getColorDistance(theoreticalColor, best.hex);
                const dyeDist = ColorService.getColorDistance(theoreticalColor, dye.hex);
                return dyeDist < bestDist ? dye : best;
              })
            : null;
      }

      const distance = matchedDye
        ? ColorService.getColorDistance(theoreticalColor, matchedDye.hex)
        : Infinity;

      result.push({
        position: t,
        theoreticalColor,
        matchedDye: matchedDye || null,
        distance: distance === Infinity ? 0 : distance,
      });
    }

    this.currentSteps = result;
  }

  /**
   * Render gradient preview with step markers on the gradient track
   */
  private renderGradientPreview(): void {
    if (!this.gradientContainer || !this.startDye || !this.endDye) return;

    // Update the gradient track to reflect the actual color space interpolation
    // CSS linear-gradient always uses RGB, so we create multi-stop gradient from calculated colors
    if (this.gradientTrackElement && this.currentSteps.length > 0) {
      const colorStops = this.currentSteps
        .map((step) => `${step.theoreticalColor} ${step.position * 100}%`)
        .join(', ');
      this.gradientTrackElement.style.background = `linear-gradient(to right, ${colorStops})`;
    }

    // Remove existing step markers (but keep the gradient track element)
    const existingSteps = this.gradientContainer.querySelectorAll('.gradient-step');
    existingSteps.forEach((el) => el.remove());

    // Responsive step marker size: 24px desktop, 16px mobile
    const isMobile = window.innerWidth < 768;
    const stepMarkerSize = isMobile ? 16 : 24;
    const borderWidth = isMobile ? 1 : 2;

    // Add step markers for each interpolation step
    for (let i = 0; i < this.currentSteps.length; i++) {
      const step = this.currentSteps[i];
      // Calculate position as percentage (0 to 100)
      const leftPercent = step.position * 100;

      const stepMarker = this.createElement('div', {
        className: 'gradient-step',
        attributes: {
          style: `
            position: absolute;
            top: 50%;
            left: ${leftPercent}%;
            width: ${stepMarkerSize}px;
            height: ${stepMarkerSize}px;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            border: ${borderWidth}px solid rgba(255, 255, 255, 0.8);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            z-index: 1;
            transition: transform 0.1s;
            background: ${step.theoreticalColor};
          `,
          title: `Step ${i}: ${step.matchedDye ? LanguageService.getDyeName(step.matchedDye.itemID) || step.matchedDye.name : 'No match'}`,
        },
      });

      // Hover effect
      this.on(stepMarker, 'mouseenter', () => {
        stepMarker.style.transform = 'translate(-50%, -50%) scale(1.2)';
      });
      this.on(stepMarker, 'mouseleave', () => {
        stepMarker.style.transform = 'translate(-50%, -50%)';
      });

      this.gradientContainer.appendChild(stepMarker);
    }
  }

  /**
   * Render intermediate dye matches using v4-result-card components
   */
  private renderIntermediateMatches(): void {
    if (!this.matchesContainer) return;
    clearContainer(this.matchesContainer);

    // Clear previous card references
    this.v4ResultCards = [];

    // Render ALL steps as v4-result-card components
    for (let i = 0; i < this.currentSteps.length; i++) {
      const step = this.currentSteps[i];
      if (!step.matchedDye) continue;

      const dye = step.matchedDye;

      // Create v4-result-card custom element
      const card = document.createElement('v4-result-card') as ResultCard;

      // Get price data for this dye
      const priceInfo = this.priceData.get(dye.itemID);

      // Get market server name - prefer worldId from price data (actual listing location)
      let marketServer: string | undefined;
      if (priceInfo?.worldId) {
        marketServer = WorldService.getWorldName(priceInfo.worldId);
      }
      if (!marketServer) {
        marketServer = this.getActiveMarketBoard()?.getSelectedServer?.();
      }

      // Build ResultCardData
      const cardData: ResultCardData = {
        dye: dye,
        originalColor: step.theoreticalColor,
        matchedColor: dye.hex,
        deltaE: step.distance,
        matchingMethod: this.matchingMethod,
        marketServer: marketServer,
        price: this.showPrices && priceInfo ? priceInfo.currentMinPrice : undefined,
        vendorCost: dye.cost,
      };

      card.data = cardData;
      card.setAttribute('data-gradient-step', String(i + 1));

      // Set display options from tool state
      card.showHex = this.displayOptions.showHex;
      card.showRgb = this.displayOptions.showRgb;
      card.showHsv = this.displayOptions.showHsv;
      card.showLab = this.displayOptions.showLab;
      card.showDeltaE = this.displayOptions.showDeltaE;
      card.showPrice = this.displayOptions.showPrice;
      card.showAcquisition = this.displayOptions.showAcquisition;

      // Enable slot picker for gradient tool (Select Dye → choose Start or End slot)
      card.showSlotPicker = true;
      card.primaryActionLabel = LanguageService.t('common.selectDye');

      // Handle slot selection (add-mixer-slot-1 = Start, add-mixer-slot-2 = End)
      card.addEventListener('context-action', ((
        e: CustomEvent<{ action: ContextAction; dye: Dye }>
      ) => {
        const { action, dye: selectedDye } = e.detail;

        if (action === 'add-mixer-slot-1') {
          // Set as start dye
          this.selectedDyes[0] = selectedDye;
          logger.info(`[GradientTool] Set ${selectedDye.name} as start dye from v4-result-card`);
          this.updateAfterSlotSelection();
        } else if (action === 'add-mixer-slot-2') {
          // Set as end dye
          this.selectedDyes[1] = selectedDye;
          logger.info(`[GradientTool] Set ${selectedDye.name} as end dye from v4-result-card`);
          this.updateAfterSlotSelection();
        } else {
          // Handle other context actions (inspect, transform, external links)
          this.handleContextAction(action, selectedDye);
        }
      }) as EventListener);

      // Store reference for later price updates
      this.v4ResultCards.push(card);

      this.matchesContainer.appendChild(card);
    }

    // If no steps have matches
    if (this.currentSteps.every((s) => !s.matchedDye)) {
      const noSteps = this.createElement('div', {
        textContent: LanguageService.t('gradient.noMatchesFound'),
        attributes: {
          style:
            'padding: 24px; text-align: center; font-size: 14px; color: var(--theme-text-muted);',
        },
      });
      this.matchesContainer.appendChild(noSteps);
    }
  }

  /**
   * Update UI after a slot selection from v4-result-card
   */
  private updateAfterSlotSelection(): void {
    this.isExternalSelection = true;
    try {
      this.dyeSelector?.setSelectedDyes(this.selectedDyes);
    } finally {
      this.isExternalSelection = false;
    }
    this.saveSelectedDyes();
    this.updateSelectedDyesDisplay();
    this.updateMobileSelectedDyesDisplay();
    this.updateInterpolation();
    this.updateDrawerContent();
  }

  /**
   * Handle context menu action from v4-result-card
   */
  private handleContextAction(action: ContextAction, dye: Dye): void {
    logger.info(`[GradientTool] Context action: ${action} for dye: ${dye.name}`);

    switch (action) {
      // Inspect actions - navigate to tool
      case 'inspect-harmony':
        RouterService.navigateTo('harmony', { dyeId: String(dye.itemID) });
        break;
      case 'inspect-budget':
        StorageService.setItem('v3_budget_target', dye.id);
        ToastService.success(LanguageService.t('resultCard.sentToBudget'));
        RouterService.navigateTo('budget');
        break;
      case 'inspect-accessibility':
        this.addDyeToTool('v3_accessibility_selected_dyes', dye, 4);
        RouterService.navigateTo('accessibility');
        break;
      case 'inspect-comparison':
        this.addDyeToTool('v3_comparison_selected_dyes', dye, 4);
        RouterService.navigateTo('comparison');
        break;

      // Transform actions
      case 'transform-gradient':
        // Already in gradient tool - add to current selection
        if (this.selectedDyes.length < 2) {
          this.selectedDyes.push(dye);
          this.updateAfterSlotSelection();
          ToastService.success(LanguageService.t('resultCard.addedTo'));
        } else {
          ToastService.info(LanguageService.t('gradient.slotsFull'));
        }
        break;
      case 'transform-mixer':
        this.addDyeToTool('v4_mixer_selected_dyes', dye, 2, true);
        RouterService.navigateTo('mixer');
        break;

      // Legacy actions (for backwards compatibility)
      case 'add-comparison':
        this.addDyeToTool('v3_comparison_selected_dyes', dye, 4);
        break;
      case 'add-mixer':
        this.addDyeToTool('v3_mixer_selected_dyes', dye, 2);
        break;
      case 'add-accessibility':
        this.addDyeToTool('v3_accessibility_selected_dyes', dye, 4);
        break;
      case 'see-harmonies':
        RouterService.navigateTo('harmony', { dyeId: String(dye.itemID) });
        break;
      case 'budget':
        StorageService.setItem('v3_budget_target', dye.id);
        RouterService.navigateTo('budget');
        break;
      case 'copy-hex':
        void navigator.clipboard.writeText(dye.hex).then(() => {
          ToastService.success(LanguageService.t('common.copied'));
        });
        break;
    }
  }

  /**
   * Helper to add a dye to a tool's storage
   */
  private addDyeToTool(
    storageKey: string,
    dye: Dye,
    maxSlots: number,
    isTuple: boolean = false
  ): void {
    if (isTuple) {
      // Handle tuple format [number | null, number | null] for v4 mixer
      const current = StorageService.getItem<[number | null, number | null]>(storageKey) ?? [
        null,
        null,
      ];
      if (current[0] === dye.id || current[1] === dye.id) {
        ToastService.info(LanguageService.t('resultCard.dyeAlreadyIn'));
        return;
      }
      if (current[0] === null) {
        current[0] = dye.id;
      } else if (current[1] === null) {
        current[1] = dye.id;
      } else {
        ToastService.info(LanguageService.t('resultCard.slotsFull'));
        return;
      }
      StorageService.setItem(storageKey, current);
    } else {
      // Handle array format for other tools
      const existing = StorageService.getItem<number[]>(storageKey) ?? [];
      if (existing.includes(dye.id)) {
        ToastService.info(LanguageService.t('resultCard.dyeAlreadyIn'));
        return;
      }
      if (existing.length >= maxSlots) {
        ToastService.info(LanguageService.t('resultCard.slotsFull'));
        return;
      }
      existing.push(dye.id);
      StorageService.setItem(storageKey, existing);
    }
    ToastService.success(LanguageService.t('resultCard.addedTo'));
  }

  /**
   * Helper to convert hex to RGB string
   */
  private hexToRgbString(hex: string): string {
    const rgb = ColorService.hexToRgb(hex);
    return `${rgb.r},${rgb.g},${rgb.b}`;
  }

  /**
   * Render export options
   */
  private renderExportOptions(): void {
    if (!this.exportContainer) return;
    clearContainer(this.exportContainer);

    const card = this.createElement('div', {
      className: 'p-4 rounded-lg flex items-center justify-between',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });

    const label = this.createElement('span', {
      className: 'text-sm font-medium',
      textContent: LanguageService.t('mixer.exportPalette'),
      attributes: { style: 'color: var(--theme-text);' },
    });
    card.appendChild(label);

    const buttonGroup = this.createElement('div', { className: 'flex gap-2' });

    // Copy button
    const copyBtn = this.createElement('button', {
      className: 'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
      attributes: {
        style: 'background: var(--theme-background-secondary); color: var(--theme-text);',
      },
    });
    const copyIcon = this.createElement('span', { className: 'w-4 h-4' });
    copyIcon.innerHTML = ICON_EXPORT;
    copyBtn.appendChild(copyIcon);
    copyBtn.appendChild(document.createTextNode(LanguageService.t('common.copy')));

    this.on(copyBtn, 'click', () => this.copyPalette());
    buttonGroup.appendChild(copyBtn);

    // Download button
    const downloadBtn = this.createElement('button', {
      className: 'flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors',
      attributes: { style: 'background: var(--theme-primary); color: var(--theme-text-header);' },
    });
    const downloadIcon = this.createElement('span', { className: 'w-4 h-4' });
    downloadIcon.innerHTML = ICON_EXPORT;
    downloadBtn.appendChild(downloadIcon);
    downloadBtn.appendChild(document.createTextNode(LanguageService.t('common.download')));

    this.on(downloadBtn, 'click', () => this.downloadPalette());
    buttonGroup.appendChild(downloadBtn);

    card.appendChild(buttonGroup);
    this.exportContainer.appendChild(card);
  }

  /**
   * Copy palette to clipboard
   */
  private copyPalette(): void {
    if (!this.startDye || !this.endDye) return;

    const lines: string[] = [
      `Start: ${this.startDye.name} (${this.startDye.hex})`,
      `End: ${this.endDye.name} (${this.endDye.hex})`,
      `Steps: ${this.stepCount}, Color Space: ${this.colorSpace.toUpperCase()}`,
      '',
      'Intermediate Matches:',
    ];

    for (let i = 1; i < this.currentSteps.length - 1; i++) {
      const step = this.currentSteps[i];
      if (step.matchedDye) {
        lines.push(
          `  ${i}. ${step.matchedDye.name} (${step.matchedDye.hex}) - Distance: ${step.distance.toFixed(1)}`
        );
      }
    }

    navigator.clipboard
      .writeText(lines.join('\n'))
      .then(() => {
        ToastService.success(LanguageService.t('common.copied'));
      })
      .catch(() => {
        ToastService.error(LanguageService.t('common.copyFailed'));
      });
  }

  /**
   * Download palette as JSON
   */
  private downloadPalette(): void {
    if (!this.startDye || !this.endDye) return;

    const data = {
      startDye: { name: this.startDye.name, hex: this.startDye.hex, id: this.startDye.id },
      endDye: { name: this.endDye.name, hex: this.endDye.hex, id: this.endDye.id },
      stepCount: this.stepCount,
      colorSpace: this.colorSpace,
      intermediates: this.currentSteps.slice(1, -1).map((step, i) => ({
        index: i + 1,
        theoreticalColor: step.theoreticalColor,
        matchedDye: step.matchedDye
          ? {
              name: step.matchedDye.name,
              hex: step.matchedDye.hex,
              id: step.matchedDye.id,
            }
          : null,
        distance: step.distance,
      })),
      generatedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dye-gradient-${this.startDye.name}-to-${this.endDye.name}.json`;
    a.click();
    URL.revokeObjectURL(url);

    ToastService.success(LanguageService.t('common.downloaded'));
  }

  // ============================================================================
  // Mobile Drawer Content
  // ============================================================================

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;

    const drawer = this.options.drawerContent;
    clearContainer(drawer);

    // Section 1: Dye Selection (consolidated - select 2 dyes)
    const dyeSelectionContainer = this.createElement('div');
    drawer.appendChild(dyeSelectionContainer);
    this.mobileDyeSelectionPanel = new CollapsiblePanel(dyeSelectionContainer, {
      title: LanguageService.t('mixer.dyeSelection'),
      storageKey: 'v3_mixer_mobile_dye_selection_panel',
      defaultOpen: true,
      icon: ICON_PALETTE,
    });
    this.mobileDyeSelectionPanel.init();
    const mobileDyeSelectionContent = this.createElement('div', { className: 'p-4' });
    this.renderMobileDyeSelector(mobileDyeSelectionContent);
    this.mobileDyeSelectionPanel.setContent(mobileDyeSelectionContent);

    // Section 2: Interpolation Settings (collapsible)
    const settingsContainer = this.createElement('div');
    drawer.appendChild(settingsContainer);
    this.mobileSettingsPanel = new CollapsiblePanel(settingsContainer, {
      title: LanguageService.t('mixer.interpolationSettings'),
      storageKey: 'v3_mixer_mobile_settings_panel',
      defaultOpen: true,
      icon: ICON_STAIRS,
    });
    this.mobileSettingsPanel.init();
    const mobileSettingsContent = this.createElement('div', { className: 'p-4' });
    this.renderMobileSettings(mobileSettingsContent);
    this.mobileSettingsPanel.setContent(mobileSettingsContent);

    // Section 3: Dye Filters (collapsible)
    const filtersContainer = this.createElement('div');
    drawer.appendChild(filtersContainer);
    this.mobileFiltersPanel = new CollapsiblePanel(filtersContainer, {
      title: LanguageService.t('filters.advancedFilters'),
      storageKey: 'v3_mixer_mobile_filters',
      defaultOpen: false,
      icon: ICON_FILTER,
    });
    this.mobileFiltersPanel.init();

    const mobileFiltersContent = this.createElement('div');
    this.mobileDyeFilters = new DyeFilters(mobileFiltersContent, {
      storageKeyPrefix: 'v3_mixer', // Share filter state with desktop
      hideHeader: true,
      onFilterChange: () => {
        this.updateInterpolation();
      },
    });
    this.mobileDyeFilters.render();
    this.mobileDyeFilters.bindEvents();
    this.mobileFiltersPanel.setContent(mobileFiltersContent);

    // Section 4: Market Board (collapsible)
    const marketContainer = this.createElement('div');
    drawer.appendChild(marketContainer);
    this.mobileMarketPanel = new CollapsiblePanel(marketContainer, {
      title: LanguageService.t('marketBoard.title'),
      storageKey: 'v3_mixer_mobile_market',
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    this.mobileMarketPanel.init();

    const mobileMarketContent = this.createElement('div');
    this.mobileMarketBoard = new MarketBoard(mobileMarketContent);
    this.mobileMarketBoard.init();

    // Set up market board event listeners using shared utility
    setupMarketBoardListeners(
      mobileMarketContent,
      () => this.showPrices,
      () => this.fetchPricesForDisplayedDyes(),
      {
        onPricesToggled: () => {
          if (this.showPrices) {
            void this.fetchPricesForDisplayedDyes();
          } else {
            this.updateSelectedDyesDisplay();
            this.updateMobileSelectedDyesDisplay();
            this.renderIntermediateMatches();
          }
        },
        onServerChanged: () => {
          if (this.showPrices) {
            void this.fetchPricesForDisplayedDyes();
          }
        },
      }
    );

    this.mobileMarketPanel.setContent(mobileMarketContent);
  }

  /**
   * Render consolidated mobile dye selector section (select 2 dyes: start and end)
   */
  private renderMobileDyeSelector(container: HTMLElement): void {
    const dyeContainer = this.createElement('div', { className: 'space-y-3' });

    // Instruction text
    const instruction = this.createElement('p', {
      className: 'text-sm mb-2',
      textContent: LanguageService.t('mixer.selectTwoDyes'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    dyeContainer.appendChild(instruction);

    // Selected dyes display
    const displayContainer = this.createElement('div', {
      className: 'mobile-selected-dyes-display space-y-2',
    });
    dyeContainer.appendChild(displayContainer);
    this.mobileSelectedDyesContainer = displayContainer;

    this.updateMobileSelectedDyesDisplay();

    // Dye selector component
    const selectorContainer = this.createElement('div', { className: 'mt-3' });
    dyeContainer.appendChild(selectorContainer);

    const selector = new DyeSelector(selectorContainer, {
      maxSelections: 2,
      allowMultiple: true,
      allowDuplicates: false,
      showCategories: true,
      showPrices: true,
      excludeFacewear: true,
      showFavorites: true,
      compactMode: true,
      hideSelectedChips: true, // We show selections above with Start/End labels
    });
    selector.init();

    // Store reference
    this.mobileDyeSelector = selector;

    // Listen for selection changes
    selectorContainer.addEventListener('selection-changed', () => {
      // Skip if this change was triggered by external selection (e.g., from Color Palette drawer)
      if (this.isExternalSelection) {
        return;
      }
      this.selectedDyes = selector.getSelectedDyes();
      this.saveSelectedDyes();
      // Sync to desktop selector
      this.dyeSelector?.setSelectedDyes(this.selectedDyes);
      this.updateSelectedDyesDisplay();
      this.updateMobileSelectedDyesDisplay();
      this.updateInterpolation();
    });

    // Set initial selection if dyes were loaded from storage
    if (this.selectedDyes.length > 0) {
      selector.setSelectedDyes(this.selectedDyes);
    }

    container.appendChild(dyeContainer);
  }

  /**
   * Update mobile selected dyes display with Start/End labels and remove buttons
   */
  private updateMobileSelectedDyesDisplay(): void {
    if (!this.mobileSelectedDyesContainer) return;
    clearContainer(this.mobileSelectedDyesContainer);

    if (this.selectedDyes.length === 0) {
      // Empty state - dashed border placeholder
      const placeholder = this.createElement('div', {
        className: 'p-2 rounded-lg border-2 border-dashed text-center text-sm',
        textContent: LanguageService.t('mixer.selectDyes'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      this.mobileSelectedDyesContainer.appendChild(placeholder);
      return;
    }

    // Display each selected dye with role label
    const labels = [LanguageService.t('mixer.startDye'), LanguageService.t('mixer.endDye')];

    for (let i = 0; i < this.selectedDyes.length; i++) {
      const dye = this.selectedDyes[i];
      const label = labels[i];

      const card = this.createElement('div', {
        className: 'flex items-center gap-2 p-2 rounded-lg',
        attributes: { style: 'background: var(--theme-background-secondary);' },
      });

      // Color swatch
      const swatch = this.createElement('div', {
        className: 'w-8 h-8 rounded border',
        attributes: {
          style: `background: ${dye.hex}; border-color: var(--theme-border);`,
        },
      });
      card.appendChild(swatch);

      // Info section
      const info = this.createElement('div', { className: 'flex-1 min-w-0' });

      // Role label and dye name on same line for mobile
      const labelAndName = this.createElement('div', { className: 'flex items-center gap-2' });
      const roleLabel = this.createElement('span', {
        className: 'text-xs font-semibold uppercase',
        textContent: label,
        attributes: { style: 'color: var(--theme-primary);' },
      });
      const name = this.createElement('span', {
        className: 'text-sm font-medium truncate',
        textContent: LanguageService.getDyeName(dye.itemID) || dye.name,
        attributes: { style: 'color: var(--theme-text);' },
      });
      labelAndName.appendChild(roleLabel);
      labelAndName.appendChild(name);
      info.appendChild(labelAndName);

      card.appendChild(info);

      // Remove button
      const removeBtn = this.createElement('button', {
        className: 'w-6 h-6 flex items-center justify-center rounded-full transition-colors',
        textContent: '\u00D7',
        attributes: {
          style:
            'background: var(--theme-card-hover); color: var(--theme-text-muted); font-size: 1rem;',
          title: LanguageService.t('common.remove'),
        },
      });

      this.on(removeBtn, 'click', () => {
        // Remove this dye from selection
        const newSelection = this.selectedDyes.filter((d) => d.id !== dye.id);
        this.selectedDyes = newSelection;
        this.mobileDyeSelector?.setSelectedDyes(newSelection);
        this.dyeSelector?.setSelectedDyes(newSelection);
        this.saveSelectedDyes();
        this.updateSelectedDyesDisplay();
        this.updateMobileSelectedDyesDisplay();
        this.updateInterpolation();
      });

      card.appendChild(removeBtn);
      this.mobileSelectedDyesContainer.appendChild(card);
    }
  }

  /**
   * Render mobile interpolation settings
   */
  private renderMobileSettings(container: HTMLElement): void {
    const settingsContainer = this.createElement('div', { className: 'space-y-4' });

    // Steps slider
    const stepsGroup = this.createElement('div');
    const stepsLabel = this.createElement('label', {
      className: 'flex items-center justify-between text-sm mb-2',
    });
    const stepsText = this.createElement('span', {
      textContent: LanguageService.t('mixer.steps'),
      attributes: { style: 'color: var(--theme-text);' },
    });
    this.mobileStepValueDisplay = this.createElement('span', {
      className: 'number',
      textContent: String(this.stepCount),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    stepsLabel.appendChild(stepsText);
    stepsLabel.appendChild(this.mobileStepValueDisplay);
    stepsGroup.appendChild(stepsLabel);

    const stepsInput = this.createElement('input', {
      className: 'w-full',
      attributes: {
        type: 'range',
        min: '2',
        max: '10',
        value: String(this.stepCount),
        style: 'accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    this.on(stepsInput, 'input', () => {
      this.stepCount = parseInt(stepsInput.value, 10);
      // Update both displays
      if (this.mobileStepValueDisplay) {
        this.mobileStepValueDisplay.textContent = String(this.stepCount);
      }
      if (this.stepValueDisplay) {
        this.stepValueDisplay.textContent = String(this.stepCount);
      }
      StorageService.setItem(STORAGE_KEYS.stepCount, this.stepCount);
      this.updateInterpolation();
    });

    stepsGroup.appendChild(stepsInput);
    settingsContainer.appendChild(stepsGroup);

    // Color space dropdown (matches desktop)
    const colorSpaceGroup = this.createElement('div');
    const colorSpaceLabel = this.createElement('label', {
      className: 'block text-sm mb-2',
      textContent: LanguageService.t('mixer.colorSpace'),
      attributes: { style: 'color: var(--theme-text);' },
    });
    colorSpaceGroup.appendChild(colorSpaceLabel);

    // Dropdown select for interpolation mode
    const colorSpaceSelect = this.createElement('select', {
      className: 'w-full px-3 py-2 text-sm rounded-lg',
      attributes: {
        'data-testid': 'gradient-mobile-colorspace-select',
        style: `
          background: var(--theme-background-secondary);
          color: var(--theme-text);
          border: 1px solid var(--theme-border);
          cursor: pointer;
        `,
      },
    }) as HTMLSelectElement;

    // Interpolation mode options with descriptive labels
    const modeOptions: { value: InterpolationMode; label: string; description: string }[] = [
      { value: 'rgb', label: 'RGB', description: LanguageService.t('gradient.mode.rgb') },
      { value: 'hsv', label: 'HSV', description: LanguageService.t('gradient.mode.hsv') },
      { value: 'lab', label: 'LAB', description: LanguageService.t('gradient.mode.lab') },
      { value: 'oklch', label: 'OKLCH', description: LanguageService.t('gradient.mode.oklch') },
      { value: 'lch', label: 'LCH', description: LanguageService.t('gradient.mode.lch') },
    ];

    for (const mode of modeOptions) {
      const option = this.createElement('option', {
        textContent: `${mode.label} - ${mode.description}`,
        attributes: { value: mode.value },
      }) as HTMLOptionElement;
      if (mode.value === this.colorSpace) {
        option.selected = true;
      }
      colorSpaceSelect.appendChild(option);
    }

    this.on(colorSpaceSelect, 'change', () => {
      this.colorSpace = colorSpaceSelect.value as InterpolationMode;
      StorageService.setItem(STORAGE_KEYS.colorSpace, this.colorSpace);
      this.updateInterpolation();
    });

    colorSpaceGroup.appendChild(colorSpaceSelect);
    settingsContainer.appendChild(colorSpaceGroup);

    container.appendChild(settingsContainer);
  }

  /**
   * Update drawer content (called when state changes from desktop)
   * Syncs mobile selector with current state
   */
  private updateDrawerContent(): void {
    // Sync mobile selector with current state (if it exists)
    // Use guard flag to prevent event handler from overwriting state
    if (this.mobileDyeSelector && this.selectedDyes.length > 0) {
      this.isExternalSelection = true;
      try {
        this.mobileDyeSelector.setSelectedDyes(this.selectedDyes);
      } finally {
        this.isExternalSelection = false;
      }
    }
    // Update the mobile display
    this.updateMobileSelectedDyesDisplay();
  }

  // ============================================================================
  // Market Board Integration
  // ============================================================================

  /**
   * Get an active MarketBoard instance that has showPrices enabled.
   * This handles the case where prices are enabled on mobile vs desktop.
   */
  private getActiveMarketBoard(): MarketBoard | null {
    // Check desktop MarketBoard first
    if (this.marketBoard?.getShowPrices()) {
      return this.marketBoard;
    }
    // Fall back to mobile MarketBoard
    if (this.mobileMarketBoard?.getShowPrices()) {
      return this.mobileMarketBoard;
    }
    // If showPrices is enabled but neither MarketBoard reports it,
    // use desktop as fallback (this handles the case where the event
    // was just fired and the MarketBoard state is in sync)
    if (this.showPrices && this.marketBoard) {
      return this.marketBoard;
    }
    if (this.showPrices && this.mobileMarketBoard) {
      return this.mobileMarketBoard;
    }
    return null;
  }

  /**
   * Fetch prices for all displayed dyes (start, end, and intermediate matches)
   * Uses shared MarketBoardService for centralized price caching.
   */
  private async fetchPricesForDisplayedDyes(): Promise<void> {
    if (!this.showPrices) {
      return;
    }

    const dyesToFetch: Dye[] = [];

    // Add start dye if selected
    if (this.startDye && this.marketBoardService.shouldFetchPrice(this.startDye)) {
      dyesToFetch.push(this.startDye);
    }

    // Add end dye if selected
    if (this.endDye && this.marketBoardService.shouldFetchPrice(this.endDye)) {
      dyesToFetch.push(this.endDye);
    }

    // Add intermediate dyes from interpolation steps
    for (const step of this.currentSteps) {
      if (step.matchedDye && this.marketBoardService.shouldFetchPrice(step.matchedDye)) {
        // Avoid duplicates
        if (!dyesToFetch.some((d) => d.id === step.matchedDye!.id)) {
          dyesToFetch.push(step.matchedDye);
        }
      }
    }

    if (dyesToFetch.length > 0) {
      try {
        const prices = await this.marketBoardService.fetchPricesForDyes(dyesToFetch);
        // Note: Service updates its shared cache, priceData getter returns latest
        logger.info(`[GradientTool] Fetched prices for ${prices.size} dyes`);
      } catch (error) {
        logger.error('[GradientTool] Failed to fetch prices:', error);
      }
    }

    // Always update displays (even if no prices were fetched)
    this.updateSelectedDyesDisplay();
    this.updateMobileSelectedDyesDisplay();
    this.renderIntermediateMatches();
  }

  /**
   * Format price for display
   */
  private formatPrice(dye: Dye): string | null {
    if (!this.showPrices) return null;

    const price = this.priceData.get(dye.itemID);
    if (!price) return null;

    return MarketBoard.formatPrice(price.currentMinPrice);
  }

  /**
   * Clear all dye selections and return to empty state.
   * Called when "Clear All Dyes" button is clicked in Color Palette.
   */
  public clearDyes(): void {
    this.selectedDyes = [];
    this.currentSteps = [];

    // Clear from storage (main key used for persistence)
    StorageService.removeItem(STORAGE_KEYS.selectedDyes);
    logger.info('[GradientTool] All dyes cleared');

    // Update dye selectors
    this.dyeSelector?.setSelectedDyes([]);
    this.mobileDyeSelector?.setSelectedDyes([]);

    // Clear UI containers
    if (this.matchesContainer) {
      clearContainer(this.matchesContainer);
    }

    // Show empty state
    this.showEmptyState(true);
    this.updateSelectedDyesDisplay();
    this.updateMobileSelectedDyesDisplay();
    this.updateDrawerContent();
  }

  /**
   * Add a dye from external source (Color Palette drawer)
   * Sets the dye as start (if empty) or end color for gradient.
   *
   * @param dye The dye to add to the gradient
   */
  public selectDye(dye: Dye): void {
    if (!dye) return;

    // Check if this dye is already selected
    const isAlreadyStart = this.startDye && this.startDye.id === dye.id;
    const isAlreadyEnd = this.endDye && this.endDye.id === dye.id;

    // If no start dye, set as start
    if (!this.startDye) {
      this.selectedDyes[0] = dye;
      logger.info(`[GradientTool] External dye set as start: ${dye.name}`);
    }
    // If no end dye, set as end (but warn if it would duplicate start)
    else if (!this.endDye) {
      if (isAlreadyStart) {
        // Would result in same dye for both slots
        ToastService.warning(LanguageService.t('gradient.sameDyeWarning'));
        logger.info(`[GradientTool] Prevented duplicate: ${dye.name} is already start`);
        return;
      }
      this.selectedDyes[1] = dye;
      logger.info(`[GradientTool] External dye set as end: ${dye.name}`);
    }
    // If both are set: shift dyes (new dye → Start, old Start → End)
    else {
      // Check if shift would result in same dye in both slots
      // After shift: Start = new dye, End = old Start
      // This would be a problem if new dye === old Start (already handled by isAlreadyStart)
      if (isAlreadyStart) {
        // Selecting the current start again - no change needed, just ignore
        logger.info(`[GradientTool] Dye ${dye.name} is already start, ignoring`);
        return;
      }

      // If selecting the current end dye, swap start and end
      if (isAlreadyEnd) {
        const temp = this.selectedDyes[0];
        this.selectedDyes[0] = this.selectedDyes[1];
        this.selectedDyes[1] = temp;
        logger.info(`[GradientTool] Swapped: ${dye.name} is now start`);
      } else {
        // Normal shift: old Start → End, new dye → Start
        this.selectedDyes[1] = this.selectedDyes[0];
        this.selectedDyes[0] = dye;
        logger.info(`[GradientTool] Shifted dyes: ${dye.name} is now start`);
      }
    }

    // Update DyeSelector if it exists (with guard flag to prevent event handler loop)
    if (this.dyeSelector) {
      this.isExternalSelection = true;
      try {
        this.dyeSelector.setSelectedDyes(this.selectedDyes);
      } finally {
        this.isExternalSelection = false;
      }
    }

    // Persist and update UI
    this.saveSelectedDyes();
    this.updateSelectedDyesDisplay();
    this.updateMobileSelectedDyesDisplay();
    this.updateInterpolation();
    this.updateDrawerContent();
  }

  /**
   * Select a custom color from hex input (Color Palette drawer)
   * Creates a virtual dye from the hex color for gradient creation.
   *
   * @param hex The hex color code (e.g., '#FF5500')
   */
  public selectCustomColor(hex: string): void {
    if (!hex) return;

    // Create a virtual "dye" object for the custom color
    // Using negative ID to distinguish from real dyes
    const virtualDye: Dye = {
      id: -Date.now(), // Unique negative ID
      itemID: -Date.now(),
      stainID: null, // Custom colors don't have a stain ID
      name: `Custom (${hex})`,
      hex: hex.toUpperCase(),
      rgb: ColorService.hexToRgb(hex),
      hsv: ColorService.hexToHsv(hex),
      category: 'Custom',
      acquisition: 'Custom',
      cost: 0,
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,
    };

    // Use the existing selectDye logic to add to gradient
    this.selectDye(virtualDye);
    logger.info(`[GradientTool] Custom color selected: ${hex}`);
  }
}
