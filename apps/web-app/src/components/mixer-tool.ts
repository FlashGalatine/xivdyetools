/**
 * XIV Dye Tools v4.0.0 - Mixer Tool Component (Dye Mixer)
 *
 * V4 NEW: Dye Mixer - Blend two dyes together to find matching FFXIV dyes.
 * This is a completely different tool from the old Mixer (now Gradient Builder).
 *
 * Features:
 * - Crafting-style interface with two input slots
 * - RGB averaging to create blended color
 * - Find closest matching FFXIV dyes to the blend
 * - Configurable number of results (3-8)
 *
 * Left Panel: Dye selection, mix settings, filters, market board
 * Right Panel: Crafting UI with slots, matched dye results grid
 *
 * @module components/tools/mixer-tool
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { DyeSelector } from '@components/dye-selector';
import { DyeFilters } from '@components/dye-filters';
import { MarketBoard } from '@components/market-board';
import { createDyeActionDropdown } from '@components/dye-action-dropdown';
import {
  ColorService,
  dyeService,
  LanguageService,
  StorageService,
  ToastService,
  MarketBoardService,
  // WEB-REF-003 FIX: Import from extracted blending engine
  blendColors,
  calculateMixerColorDistance,
  findMatchingDyes as findMatchingDyesEngine,
  getContrastColor,
} from '@services/index';
import type { MixedColorResult } from '@services/index';
import { ConfigController } from '@services/config-controller';
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import { ICON_TOOL_DYE_MIXER } from '@shared/tool-icons';
import {
  ICON_FILTER,
  ICON_MARKET,
  ICON_PALETTE,
  ICON_BEAKER,
  ICON_SLIDERS,
} from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, PriceData } from '@shared/types';
import type { MixerConfig, DisplayOptionsConfig, MixingMode, MatchingMethod } from '@shared/tool-config-types';
// WEB-REF-003 FIX: ColorConverter usage moved to mixer-blending-engine.ts
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';
import '@components/v4/result-card';
import type { ResultCardData, ContextAction } from '@components/v4/result-card';
import '@components/v4/share-button';
import type { ShareButton } from '@components/v4/share-button';
import { ShareService } from '@services/share-service';

// ============================================================================
// Types and Constants
// ============================================================================

export interface MixerToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

// WEB-REF-003 FIX: MixedColorResult type imported from @services/mixer-blending-engine

// WEB-REF-003 Phase 2: Shared panel builder result types
interface DyeSelectorPanelRefs {
  selector: DyeSelector;
  displayContainer: HTMLElement;
}

interface SettingsSliderRefs {
  slider: HTMLInputElement;
  valueDisplay: HTMLElement;
}

interface FiltersPanelRefs {
  panel: CollapsiblePanel;
  filters: DyeFilters;
}

interface MarketPanelRefs {
  panel: CollapsiblePanel;
  marketBoard: MarketBoard;
}

/**
 * Storage keys for Dye Mixer tool
 */
const STORAGE_KEYS = {
  selectedDyes: 'v4_mixer_selected_dyes',
} as const;

/**
 * Slot dimensions in pixels
 */
const SLOT_SIZE = {
  input: 100, // 100x100px for input slots
  result: 120, // 120x120px for result slot
} as const;

// ============================================================================
// Component
// ============================================================================

/**
 * Dye Mixer Tool - v4 New Tool
 *
 * Blend two dyes together to find matching FFXIV dyes.
 */
export class MixerTool extends BaseComponent {
  private options: MixerToolOptions;

  // State
  private selectedDyes: [Dye | null, Dye | null, Dye | null] = [null, null, null];
  private blendedColor: string | null = null;
  private matchedResults: MixedColorResult[] = [];
  private maxResults: number = 5;
  private mixingMode: MixingMode = 'ryb';
  private matchingMethod: MatchingMethod = 'oklab';

  // Market Board Service (shared price cache with race condition protection)
  private marketBoardService: MarketBoardService;

  // Getters for service state
  private get showPrices(): boolean {
    return this.marketBoardService.getShowPrices();
  }
  private get priceData(): Map<number, PriceData> {
    return this.marketBoardService.getAllPrices();
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
  private mobileMaxResultsDisplay: HTMLElement | null = null;

  // DOM References
  private selectedDyesContainer: HTMLElement | null = null;
  private mobileSelectedDyesContainer: HTMLElement | null = null;
  private maxResultsValueDisplay: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private craftingContainer: HTMLElement | null = null;
  private resultsSection: HTMLElement | null = null;
  private resultsGridContainer: HTMLElement | null = null;
  private slot1Element: HTMLElement | null = null;
  private slot2Element: HTMLElement | null = null;
  private slot3Element: HTMLElement | null = null;
  private resultSlotElement: HTMLElement | null = null;
  private emptyStateMessage: HTMLElement | null = null;
  private emptyStateIcon: HTMLElement | null = null;
  private shareButton: ShareButton | null = null;

  // Subscriptions
  private languageUnsubscribe: (() => void) | null = null;
  private configUnsubscribe: (() => void) | null = null;

  // Display options (from ConfigController)
  private displayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

  constructor(container: HTMLElement, options: MixerToolOptions) {
    super(container);
    this.options = options;

    // Initialize MarketBoardService (shared price cache)
    this.marketBoardService = MarketBoardService.getInstance();

    // Load config from ConfigController (v4 unified config)
    const config = ConfigController.getInstance().getConfig('mixer');
    this.maxResults = config.maxResults;
    this.mixingMode = config.mixingMode ?? 'ryb';
    this.displayOptions = config.displayOptions ?? { ...DEFAULT_DISPLAY_OPTIONS };

    // Load persisted dye selections
    this.loadSelectedDyes();

    logger.info('[MixerTool] Initializing Dye Mixer');
  }

  /**
   * Load selected dyes from storage
   */
  private loadSelectedDyes(): void {
    const savedDyeIds = StorageService.getItem<[number | null, number | null, number | null]>(
      STORAGE_KEYS.selectedDyes
    );

    if (savedDyeIds) {
      this.selectedDyes = [
        savedDyeIds[0] ? (dyeService.getDyeById(savedDyeIds[0]) ?? null) : null,
        savedDyeIds[1] ? (dyeService.getDyeById(savedDyeIds[1]) ?? null) : null,
        savedDyeIds[2] ? (dyeService.getDyeById(savedDyeIds[2]) ?? null) : null,
      ];

      // Recalculate blend if at least two dyes present (slot 3 is optional)
      if (this.selectedDyes[0] && this.selectedDyes[1]) {
        const hexColors = this.selectedDyes.filter((d): d is Dye => d !== null).map((d) => d.hex);
        this.blendedColor = this.blendColorsInternal(hexColors);
      }
    }
  }

  /**
   * Save selected dyes to storage
   */
  private saveSelectedDyes(): void {
    const ids: [number | null, number | null, number | null] = [
      this.selectedDyes[0]?.id ?? null,
      this.selectedDyes[1]?.id ?? null,
      this.selectedDyes[2]?.id ?? null,
    ];
    StorageService.setItem(STORAGE_KEYS.selectedDyes, ids);
  }

  // ============================================================================
  // Color Blending Logic
  // WEB-REF-003 FIX: Delegated to mixer-blending-engine.ts (~120 lines extracted)
  // ============================================================================

  /**
   * Blend multiple hex colors using the configured mixing mode.
   * Delegates to extracted blending engine for algorithm implementation.
   */
  private blendColorsInternal(hexColors: string[]): string {
    return blendColors(hexColors, this.mixingMode);
  }

  /**
   * Find the closest matching dyes to the blended color.
   * Delegates to extracted blending engine for matching algorithm.
   */
  private findMatchingDyesInternal(): void {
    if (!this.blendedColor) {
      this.matchedResults = [];
      return;
    }

    // Get exclude IDs (the input dyes)
    const excludeIds = this.selectedDyes
      .filter((dye): dye is Dye => dye !== null)
      .map((dye) => dye.id);

    // Delegate to extracted engine
    this.matchedResults = findMatchingDyesEngine(
      this.blendedColor,
      { matchingMethod: this.matchingMethod, maxResults: this.maxResults },
      excludeIds,
      this.dyeFilters
    );
  }

  // ============================================================================
  // WEB-REF-003 Phase 2: Shared Panel Builders
  // Eliminates desktop ↔ drawer code duplication (~250 lines extracted)
  // ============================================================================

  /**
   * Build dye selector panel content (shared by desktop and drawer)
   * @param container Container to render into
   * @param storageKeyPrefix Storage key prefix for component state
   * @returns References to created selector and display container
   */
  private buildDyeSelectorPanel(container: HTMLElement, storageKeyPrefix: string): DyeSelectorPanelRefs {
    const dyeContainer = this.createElement('div', { className: 'space-y-3' });

    // Instruction text
    const instruction = this.createElement('p', {
      className: 'text-sm mb-2',
      textContent: LanguageService.t('mixer.selectDyesToBlend'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });
    dyeContainer.appendChild(instruction);

    // Selected dyes display
    const displayContainer = this.createElement('div', {
      className: 'selected-dyes-display space-y-2',
    });
    dyeContainer.appendChild(displayContainer);

    // Dye selector component
    const selectorContainer = this.createElement('div', { className: 'mt-3' });
    dyeContainer.appendChild(selectorContainer);

    const selector = new DyeSelector(selectorContainer, {
      maxSelections: 3,
      allowMultiple: true,
      allowDuplicates: true,
      showCategories: true,
      showPrices: true,
      excludeFacewear: true,
      showFavorites: true,
      compactMode: true,
      hideSelectedChips: true,
    });
    selector.init();

    // Set initial selection if dyes were loaded from storage
    const initialDyes = this.selectedDyes.filter((d): d is Dye => d !== null);
    if (initialDyes.length > 0) {
      selector.setSelectedDyes(initialDyes);
    }

    container.appendChild(dyeContainer);
    return { selector, displayContainer };
  }

  /**
   * Render selected dyes display (shared by desktop and drawer)
   * @param container Container to render into
   */
  private renderSelectedDyesDisplayInto(container: HTMLElement): void {
    clearContainer(container);

    const filledSlots = this.selectedDyes.filter((d): d is Dye => d !== null);

    if (filledSlots.length === 0) {
      // Empty state - dashed border placeholder
      const placeholder = this.createElement('div', {
        className: 'p-3 rounded-lg border-2 border-dashed text-center text-sm',
        textContent: LanguageService.t('mixer.selectDyes'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      container.appendChild(placeholder);
      return;
    }

    // Display each selected dye with role label
    const labels = [
      LanguageService.t('mixer.dye1'),
      LanguageService.t('mixer.dye2'),
      LanguageService.t('mixer.dye3'),
    ];

    for (let i = 0; i < 3; i++) {
      const dye = this.selectedDyes[i];
      if (!dye) continue;

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

      // Remove button (only for desktop - drawer is read-only display)
      if (container === this.selectedDyesContainer) {
        const removeBtn = this.createElement('button', {
          className: 'w-8 h-8 flex items-center justify-center rounded-full transition-colors',
          textContent: '\u00D7',
          attributes: {
            style:
              'background: var(--theme-card-hover); color: var(--theme-text-muted); font-size: 1.25rem;',
            title: LanguageService.t('common.remove'),
          },
        });

        const slotIndex = i;
        this.on(removeBtn, 'click', () => {
          this.handleSlotRemove(slotIndex as 0 | 1 | 2);
        });

        card.appendChild(removeBtn);
      }

      container.appendChild(card);
    }
  }

  /**
   * Build settings slider (shared by desktop and drawer)
   * @param container Container to render into
   * @returns References to created slider and value display
   */
  private buildSettingsSlider(container: HTMLElement): SettingsSliderRefs {
    const settingsContainer = this.createElement('div', { className: 'space-y-4' });

    // Max Results slider (3-8 range)
    const sliderGroup = this.createElement('div');
    const sliderLabel = this.createElement('label', {
      className: 'flex items-center justify-between text-sm mb-2',
    });

    const labelText = this.createElement('span', {
      textContent: LanguageService.t('mixer.maxResults'),
      attributes: { style: 'color: var(--theme-text);' },
    });

    const valueDisplay = this.createElement('span', {
      className: 'number',
      textContent: String(this.maxResults),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    sliderLabel.appendChild(labelText);
    sliderLabel.appendChild(valueDisplay);
    sliderGroup.appendChild(sliderLabel);

    const slider = this.createElement('input', {
      attributes: {
        type: 'range',
        min: '3',
        max: '8',
        value: String(this.maxResults),
        style: 'width: 100%; accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    sliderGroup.appendChild(slider);
    settingsContainer.appendChild(sliderGroup);
    container.appendChild(settingsContainer);

    return { slider, valueDisplay };
  }

  /**
   * Bind settings slider events (shared by desktop and drawer)
   * Syncs both sliders when either changes
   */
  private bindSettingsSliderEvents(slider: HTMLInputElement, valueDisplay: HTMLElement): void {
    this.on(slider, 'input', () => {
      this.maxResults = parseInt(slider.value, 10);
      // Update both displays
      if (this.maxResultsValueDisplay) {
        this.maxResultsValueDisplay.textContent = String(this.maxResults);
      }
      if (this.mobileMaxResultsDisplay) {
        this.mobileMaxResultsDisplay.textContent = String(this.maxResults);
      }
    });

    this.on(slider, 'change', () => {
      ConfigController.getInstance().setConfig('mixer', { maxResults: this.maxResults });
      this.findMatchingDyesInternal();
      this.renderResultsGrid();
      if (this.showPrices) {
        void this.fetchPricesForDisplayedDyes();
      }
      this.updateDrawerContent();
    });
  }

  /**
   * Build filters panel (shared by desktop and drawer)
   * @param container Container to render into
   * @param storageKey Storage key for panel collapse state
   * @returns References to created panel and filters
   */
  private buildFiltersPanel(container: HTMLElement, storageKey: string): FiltersPanelRefs {
    const panel = new CollapsiblePanel(container, {
      title: LanguageService.t('filters.advancedFilters'),
      storageKey,
      defaultOpen: false,
      icon: ICON_FILTER,
    });
    panel.init();

    const filtersContent = this.createElement('div');
    const filters = new DyeFilters(filtersContent, {
      storageKeyPrefix: storageKey.replace('_filters', ''),
      hideHeader: true,
      onFilterChange: () => {
        this.findMatchingDyesInternal();
        this.renderResultsGrid();
        if (this.showPrices) {
          void this.fetchPricesForDisplayedDyes();
        }
      },
    });
    filters.render();
    filters.bindEvents();
    panel.setContent(filtersContent);

    return { panel, filters };
  }

  /**
   * Build market board panel (shared by desktop and drawer)
   * @param container Container to render into
   * @param storageKey Storage key for panel collapse state
   * @returns References to created panel and market board
   */
  private buildMarketPanel(container: HTMLElement, storageKey: string): MarketPanelRefs {
    const panel = new CollapsiblePanel(container, {
      title: LanguageService.t('marketBoard.title'),
      storageKey,
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    panel.init();

    const marketContent = this.createElement('div');
    const marketBoard = new MarketBoard(marketContent);
    marketBoard.init();

    // Set up market board event listeners using shared utility
    setupMarketBoardListeners(
      marketContent,
      () => this.showPrices,
      () => this.fetchPricesForDisplayedDyes(),
      {
        onPricesToggled: () => {
          if (this.showPrices) {
            void this.fetchPricesForDisplayedDyes();
          } else {
            this.renderResultsGrid();
          }
        },
        onServerChanged: () => {
          this.renderResultsGrid();
          if (this.showPrices && this.matchedResults.length > 0) {
            void this.fetchPricesForDisplayedDyes();
          }
        },
      }
    );

    panel.setContent(marketContent);
    return { panel, marketBoard };
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  renderContent(): void {
    // In V4 mode, leftPanel and rightPanel are the same element.
    // Skip renderLeftPanel to avoid creating a DyeSelector that gets
    // immediately destroyed by renderRightPanel (which clears the container).
    // V4 uses ConfigSidebar for settings and Color Palette drawer for dye selection.
    const isV4Mode = this.options.leftPanel === this.options.rightPanel;
    if (!isV4Mode) {
      this.renderLeftPanel();
    }
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
    // Subscribe to language changes
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update();
    });

    // Subscribe to config changes from v4 sidebar
    this.configUnsubscribe = ConfigController.getInstance().subscribe('mixer', (config) => {
      this.setConfig(config);
    });

    // Check for share URL parameters (takes priority over localStorage)
    this.loadFromShareUrl();

    // If dyes were loaded from storage or URL, calculate blend and matches
    if (this.selectedDyes[0] && this.selectedDyes[1]) {
      const hexColors = this.selectedDyes.filter((d): d is Dye => d !== null).map((d) => d.hex);
      this.blendedColor = this.blendColorsInternal(hexColors);
      this.findMatchingDyesInternal();
      this.showEmptyState(false);
      this.updateCraftingUI();
      this.renderResultsGrid();
    }

    logger.info('[MixerTool] Mounted');
  }

  /**
   * Find a dye by its itemID (FFXIV game item ID)
   * This is different from getDyeById which uses the internal database ID
   */
  private findDyeByItemId(itemId: number): Dye | null {
    const allDyes = dyeService.getAllDyes();
    return allDyes.find((d) => d.itemID === itemId) ?? null;
  }

  /**
   * Load dyes and settings from share URL parameters
   * Takes priority over localStorage if share params are present
   */
  private loadFromShareUrl(): void {
    const parsed = ShareService.getShareParamsFromCurrentUrl();
    if (!parsed || parsed.tool !== 'mixer') return;

    const params = parsed.params;
    logger.info('[MixerTool] Loading from share URL:', params);

    // Load dyeA (required)
    if (typeof params.dyeA === 'number') {
      const dyeA = this.findDyeByItemId(params.dyeA);
      if (dyeA) {
        this.selectedDyes[0] = dyeA;
      }
    }

    // Load dyeB (required)
    if (typeof params.dyeB === 'number') {
      const dyeB = this.findDyeByItemId(params.dyeB);
      if (dyeB) {
        this.selectedDyes[1] = dyeB;
      }
    }

    // Load dyeC (optional third dye)
    if (typeof params.dyeC === 'number') {
      const dyeC = this.findDyeByItemId(params.dyeC);
      if (dyeC) {
        this.selectedDyes[2] = dyeC;
      }
    }

    // Load mixing mode
    if (typeof params.mode === 'string' && ['rgb', 'ryb', 'cmyk'].includes(params.mode)) {
      this.mixingMode = params.mode as MixingMode;
      ConfigController.getInstance().setConfig('mixer', { mixingMode: this.mixingMode });
    }

    // Load matching algorithm
    if (typeof params.algo === 'string' && ['oklab', 'ciede2000', 'rgb'].includes(params.algo)) {
      this.matchingMethod = params.algo as MatchingMethod;
      ConfigController.getInstance().setConfig('mixer', { matchingMethod: this.matchingMethod });
    }

    // If we loaded dyes, save to storage and update selectors
    if (this.selectedDyes[0] || this.selectedDyes[1]) {
      this.saveSelectedDyes();
      const selectedDyes = this.selectedDyes.filter((d): d is Dye => d !== null);
      this.dyeSelector?.setSelectedDyes(selectedDyes);
      this.mobileDyeSelector?.setSelectedDyes(selectedDyes);
      this.updateSelectedDyesDisplay();

      // Recalculate blend if at least 2 dyes
      if (this.selectedDyes[0] && this.selectedDyes[1]) {
        const hexColors = this.selectedDyes.filter((d): d is Dye => d !== null).map((d) => d.hex);
        this.blendedColor = this.blendColorsInternal(hexColors);
      }
    }

    // Clear URL params after loading (optional - keeps URL clean)
    // Commenting out to allow refreshing with same params
    // window.history.replaceState({}, '', window.location.pathname);
  }

  destroy(): void {
    this.languageUnsubscribe?.();
    this.configUnsubscribe?.();

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

    this.selectedDyes = [null, null, null];
    this.matchedResults = [];

    super.destroy();
    logger.info('[MixerTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Clear all dye selections and return to empty state.
   * Called when "Clear All Dyes" button is clicked in Color Palette.
   */
  public clearDyes(): void {
    this.selectedDyes = [null, null, null];
    this.blendedColor = null;
    this.matchedResults = [];

    // Clear from storage
    StorageService.removeItem(STORAGE_KEYS.selectedDyes);
    logger.info('[MixerTool] All dyes cleared');

    // Update dye selectors
    this.dyeSelector?.setSelectedDyes([]);
    this.mobileDyeSelector?.setSelectedDyes([]);

    // Clear results grid
    if (this.resultsGridContainer) {
      clearContainer(this.resultsGridContainer);
    }

    // Update UI to show empty slots with plus signs
    this.showEmptyState(true);
    this.updateCraftingUI();
    this.updateDrawerContent();
  }

  /**
   * Select a dye from the Color Palette drawer
   * Adds to first empty slot, or shifts dyes if all three slots are full
   */
  public selectDye(dye: Dye): void {
    if (!dye) return;

    // Allow duplicates but not triplicates (max 2 of same dye)
    const existingCount = this.selectedDyes.filter((d) => d?.id === dye.id).length;
    if (existingCount >= 2) {
      // Already have 2 of this dye, don't add a third
      return;
    }

    // Add to first empty slot, or shift if all full
    if (!this.selectedDyes[0]) {
      this.selectedDyes[0] = dye;
    } else if (!this.selectedDyes[1]) {
      this.selectedDyes[1] = dye;
    } else if (!this.selectedDyes[2]) {
      this.selectedDyes[2] = dye;
    } else {
      // All 3 slots full - shift dyes: 2→1, 3→2, new→3
      this.selectedDyes[0] = this.selectedDyes[1];
      this.selectedDyes[1] = this.selectedDyes[2];
      this.selectedDyes[2] = dye;
    }

    // Update selectors
    const selectedDyes = this.selectedDyes.filter((d): d is Dye => d !== null);
    this.dyeSelector?.setSelectedDyes(selectedDyes);
    this.mobileDyeSelector?.setSelectedDyes(selectedDyes);

    // Save and update
    this.saveSelectedDyes();
    this.updateSelectedDyesDisplay();

    // Calculate blend if at least 2 dyes selected (slot 3 is optional)
    if (this.selectedDyes[0] && this.selectedDyes[1]) {
      const hexColors = this.selectedDyes.filter((d): d is Dye => d !== null).map((d) => d.hex);
      this.blendedColor = this.blendColorsInternal(hexColors);
      this.findMatchingDyesInternal();
      this.showEmptyState(false);
      this.updateCraftingUI();
      this.renderResultsGrid();
      if (this.showPrices) {
        void this.fetchPricesForDisplayedDyes();
      }
    } else {
      this.updateCraftingUI();
    }

    this.updateDrawerContent();
    logger.info(`[MixerTool] Selected dye from palette: ${dye.name}`);
  }

  /**
   * Select a custom color from hex input (Color Palette drawer)
   * Creates a virtual dye from the hex color for mixing.
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

    // Use the existing selectDye logic to add to mix
    this.selectDye(virtualDye);
    logger.info(`[MixerTool] Custom color selected: ${hex}`);
  }

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   * Handles both tool-specific config (maxResults, displayOptions) and
   * shared market config (showPrices, selectedServer)
   * Note: Market state is managed by MarketBoardService
   */
  public setConfig(
    config: Partial<MixerConfig> & { _tool?: string; showPrices?: boolean; selectedServer?: string }
  ): void {
    let needsUpdate = false;
    let needsRerender = false;
    let needsPriceFetch = false;

    // Handle market config changes (_tool === 'market')
    // Note: MarketBoardService handles state persistence and cache clearing
    if (config._tool === 'market') {
      if (config.showPrices !== undefined) {
        logger.info(`[MixerTool] setConfig: showPrices -> ${config.showPrices}`);
        if (config.showPrices) {
          needsPriceFetch = true;
        } else {
          needsRerender = true;
        }
      }

      if (config.selectedServer !== undefined) {
        logger.info(`[MixerTool] setConfig: selectedServer -> ${config.selectedServer}`);
        // Service clears cache on server change
        needsRerender = true;
        if (this.showPrices && this.matchedResults.length > 0) {
          needsPriceFetch = true;
        }
      }
    }

    // Handle tool-specific config
    if (config.maxResults !== undefined && config.maxResults !== this.maxResults) {
      this.maxResults = config.maxResults;
      needsUpdate = true;
      logger.info(`[MixerTool] setConfig: maxResults -> ${config.maxResults}`);

      // Update slider displays
      if (this.maxResultsValueDisplay) {
        this.maxResultsValueDisplay.textContent = String(this.maxResults);
      }
      if (this.mobileMaxResultsDisplay) {
        this.mobileMaxResultsDisplay.textContent = String(this.maxResults);
      }
    }

    // Handle mixing mode changes
    if (config.mixingMode !== undefined && config.mixingMode !== this.mixingMode) {
      this.mixingMode = config.mixingMode;
      needsUpdate = true;
      logger.info(`[MixerTool] setConfig: mixingMode -> ${config.mixingMode}`);

      // Recalculate blended color if at least 2 dyes are selected
      if (this.selectedDyes[0] && this.selectedDyes[1]) {
        const hexColors = this.selectedDyes.filter((d): d is Dye => d !== null).map((d) => d.hex);
        this.blendedColor = this.blendColorsInternal(hexColors);
        this.updateCraftingUI();
      }
    }

    // Handle matchingMethod - re-match dyes when algorithm changes
    if (config.matchingMethod !== undefined && config.matchingMethod !== this.matchingMethod) {
      this.matchingMethod = config.matchingMethod;
      needsUpdate = true;
      logger.info(`[MixerTool] setConfig: matchingMethod -> ${config.matchingMethod}`);
    }

    // Handle display options changes
    if (config.displayOptions) {
      const newOpts = config.displayOptions;
      const oldOpts = this.displayOptions;
      if (
        newOpts.showHex !== oldOpts.showHex ||
        newOpts.showRgb !== oldOpts.showRgb ||
        newOpts.showHsv !== oldOpts.showHsv ||
        newOpts.showLab !== oldOpts.showLab ||
        newOpts.showPrice !== oldOpts.showPrice ||
        newOpts.showDeltaE !== oldOpts.showDeltaE ||
        newOpts.showAcquisition !== oldOpts.showAcquisition
      ) {
        this.displayOptions = newOpts;
        needsRerender = true;
        logger.info('[MixerTool] setConfig: displayOptions updated');
      }
    }

    // Apply updates
    if (needsUpdate && this.blendedColor) {
      this.findMatchingDyesInternal();
      this.renderResultsGrid();
      if (this.showPrices) {
        void this.fetchPricesForDisplayedDyes();
      }
    } else if (needsRerender && this.blendedColor) {
      // Only re-render cards (no need to recalculate matches)
      this.renderResultsGrid();
    }

    // Fetch prices if needed (after render so cards exist)
    if (needsPriceFetch && this.blendedColor && this.matchedResults.length > 0) {
      void this.fetchPricesForDisplayedDyes();
    }
  }

  // ============================================================================
  // Left Panel Rendering
  // ============================================================================

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Section 1: Dye Selection
    const dyeSelectionContainer = this.createElement('div');
    left.appendChild(dyeSelectionContainer);
    this.dyeSelectionPanel = new CollapsiblePanel(dyeSelectionContainer, {
      title: LanguageService.t('mixer.dyeSelection'),
      storageKey: 'v4_mixer_dye_selection_panel',
      defaultOpen: true,
      icon: ICON_PALETTE,
    });
    this.dyeSelectionPanel.init();
    const dyeSelectionContent = this.createElement('div', { className: 'p-4' });
    this.renderDyeSelector(dyeSelectionContent);
    this.dyeSelectionPanel.setContent(dyeSelectionContent);

    // Section 2: Mix Settings
    const settingsContainer = this.createElement('div');
    left.appendChild(settingsContainer);
    this.settingsPanel = new CollapsiblePanel(settingsContainer, {
      title: LanguageService.t('mixer.mixSettings'),
      storageKey: 'v4_mixer_settings_panel',
      defaultOpen: true,
      icon: ICON_SLIDERS,
    });
    this.settingsPanel.init();
    const settingsContent = this.createElement('div', { className: 'p-4' });
    this.renderSettings(settingsContent);
    this.settingsPanel.setContent(settingsContent);

    // Section 3: Dye Filters (collapsible)
    // WEB-REF-003 Phase 2: Refactored to use shared builder
    const filtersContainer = this.createElement('div');
    left.appendChild(filtersContainer);
    const filtersRefs = this.buildFiltersPanel(filtersContainer, 'v4_mixer_filters');
    this.filtersPanel = filtersRefs.panel;
    this.dyeFilters = filtersRefs.filters;

    // Section 4: Market Board (collapsible)
    // WEB-REF-003 Phase 2: Refactored to use shared builder
    const marketContainer = this.createElement('div');
    left.appendChild(marketContainer);
    const marketRefs = this.buildMarketPanel(marketContainer, 'v4_mixer_market');
    this.marketPanel = marketRefs.panel;
    this.marketBoard = marketRefs.marketBoard;
  }

  /**
   * Render dye selector section
   * WEB-REF-003 Phase 2: Refactored to use shared builder
   */
  private renderDyeSelector(container: HTMLElement): void {
    const refs = this.buildDyeSelectorPanel(container, 'v4_mixer');

    // Store references
    this.dyeSelector = refs.selector;
    this.selectedDyesContainer = refs.displayContainer;

    // Render initial display
    this.renderSelectedDyesDisplayInto(refs.displayContainer);

    // Listen for selection changes
    refs.selector.getElement()?.parentElement?.addEventListener('selection-changed', () => {
      const selectedDyes = refs.selector.getSelectedDyes();
      this.handleDyeSelection(selectedDyes);
    });
  }

  /**
   * Handle dye selection from DyeSelector
   */
  private handleDyeSelection(dyes: Dye[]): void {
    // Update selectedDyes array (limit to 3)
    this.selectedDyes = [dyes[0] ?? null, dyes[1] ?? null, dyes[2] ?? null];

    this.saveSelectedDyes();
    this.updateSelectedDyesDisplay();

    // Calculate blend if at least 2 dyes selected (slot 3 is optional)
    if (this.selectedDyes[0] && this.selectedDyes[1]) {
      const hexColors = this.selectedDyes.filter((d): d is Dye => d !== null).map((d) => d.hex);
      this.blendedColor = this.blendColorsInternal(hexColors);
      this.findMatchingDyesInternal();
      this.showEmptyState(false);
      this.updateCraftingUI();
      this.renderResultsGrid();
      if (this.showPrices) {
        void this.fetchPricesForDisplayedDyes();
      }
    } else {
      this.blendedColor = null;
      this.matchedResults = [];
      this.showEmptyState(true);
      this.updateCraftingUI();
    }

    this.updateDrawerContent();
  }

  /**
   * Update the selected dyes display with Dye 1/Dye 2 labels and remove buttons
   * WEB-REF-003 Phase 2: Refactored to use shared method
   */
  private updateSelectedDyesDisplay(): void {
    if (!this.selectedDyesContainer) return;
    this.renderSelectedDyesDisplayInto(this.selectedDyesContainer);
  }

  /**
   * Handle removing a dye from a slot
   */
  private handleSlotRemove(index: 0 | 1 | 2): void {
    this.selectedDyes[index] = null;
    this.saveSelectedDyes();

    // Update DyeSelector
    const remainingDyes = this.selectedDyes.filter((d): d is Dye => d !== null);
    this.dyeSelector?.setSelectedDyes(remainingDyes);
    this.mobileDyeSelector?.setSelectedDyes(remainingDyes);

    // Recalculate blend if at least 2 dyes remain
    if (this.selectedDyes[0] && this.selectedDyes[1]) {
      const hexColors = this.selectedDyes.filter((d): d is Dye => d !== null).map((d) => d.hex);
      this.blendedColor = this.blendColorsInternal(hexColors);
      this.findMatchingDyesInternal();
      this.showEmptyState(false);
    } else {
      this.blendedColor = null;
      this.matchedResults = [];
      this.showEmptyState(true);
    }

    this.updateSelectedDyesDisplay();
    this.updateCraftingUI();
    this.renderResultsGrid();
    this.updateDrawerContent();
  }

  /**
   * Render mix settings (maxResults slider)
   * WEB-REF-003 Phase 2: Refactored to use shared builder
   */
  private renderSettings(container: HTMLElement): void {
    const refs = this.buildSettingsSlider(container);
    this.maxResultsValueDisplay = refs.valueDisplay;
    this.bindSettingsSliderEvents(refs.slider, refs.valueDisplay);
  }

  // ============================================================================
  // Right Panel Rendering
  // ============================================================================

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    // In V4, leftPanel and rightPanel are the same element.
    // Clear to remove leftPanel content (V4 uses ConfigSidebar instead).
    clearContainer(right);

    // Apply flex styling to the right panel for proper layout
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
      overflow-y: auto;
    `
    );

    // Content wrapper with max-width to prevent over-expansion on ultrawide monitors
    const contentWrapper = this.createElement('div', {
      attributes: {
        style: 'max-width: 1200px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; gap: 32px;',
      },
    });

    // Empty state (hidden - replaced by crafting UI with empty slots)
    this.emptyStateContainer = this.createElement('div', {
      attributes: { style: 'display: none; width: 100%; justify-content: center;' },
    });
    this.renderEmptyState();
    contentWrapper.appendChild(this.emptyStateContainer);

    // Crafting UI section (shown by default with empty slots)
    this.craftingContainer = this.createElement('div', {
      className: 'mb-6',
      attributes: { style: 'display: block; width: 100%;' },
    });
    this.renderCraftingUI();
    contentWrapper.appendChild(this.craftingContainer);

    // Results grid section (hidden initially)
    this.resultsSection = this.createElement('div', {
      attributes: { style: 'display: none; width: 100%;' },
    });
    // Results header (using consistent section-header/section-title pattern from other tools)
    const resultsHeader = this.createElement('div', {
      className: 'section-header',
      attributes: {
        style: 'display: flex; justify-content: space-between; align-items: center;',
      },
    });
    const resultsTitle = this.createElement('span', {
      className: 'section-title',
      textContent: LanguageService.t('mixer.matchingDyes'),
    });

    // Share Button - v4-share-button custom element
    this.shareButton = document.createElement('v4-share-button') as ShareButton;
    this.shareButton.tool = 'mixer';
    this.shareButton.shareParams = this.getShareParams();

    resultsHeader.appendChild(resultsTitle);
    resultsHeader.appendChild(this.shareButton);
    this.resultsSection.appendChild(resultsHeader);
    this.resultsGridContainer = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
          --v4-result-card-width: 280px;
        `,
      },
    });
    this.resultsSection.appendChild(this.resultsGridContainer);
    contentWrapper.appendChild(this.resultsSection);

    right.appendChild(contentWrapper);
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
      <span style="display: block; width: 150px; height: 150px; margin: 0 auto 1.5rem; opacity: 0.25; color: var(--theme-text);">${ICON_TOOL_DYE_MIXER}</span>
      <p style="color: var(--theme-text); font-size: 1.125rem;">${LanguageService.t('mixer.selectTwoDyesToMix')}</p>
    `;

    this.emptyStateContainer.appendChild(empty);
  }

  /**
   * Render the crafting UI with slots
   */
  private renderCraftingUI(): void {
    if (!this.craftingContainer) return;
    clearContainer(this.craftingContainer);

    // Main container with centered layout
    const craftingArea = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 24px 0;
          gap: 16px;
        `,
      },
    });

    // Equation row: [Slot1] + [Slot2] + [Slot3?] → [Result]
    const equationRow = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 24px;
        `,
      },
    });

    // Slot 1
    this.slot1Element = this.createDyeSlot(0);
    equationRow.appendChild(this.slot1Element);

    // Plus sign
    const plusSign = this.createElement('span', {
      className: 'mixer-operator',
      textContent: '+',
      attributes: {
        style: 'font-size: 28px; font-weight: bold; color: var(--theme-text-muted);',
      },
    });
    equationRow.appendChild(plusSign);

    // Slot 2
    this.slot2Element = this.createDyeSlot(1);
    equationRow.appendChild(this.slot2Element);

    // Plus sign 2 (for optional slot 3)
    const plusSign2 = this.createElement('span', {
      className: 'mixer-operator',
      textContent: '+',
      attributes: {
        style: 'font-size: 28px; font-weight: bold; color: var(--theme-text-muted);',
      },
    });
    equationRow.appendChild(plusSign2);

    // Slot 3 (optional)
    this.slot3Element = this.createDyeSlot(2, true);
    equationRow.appendChild(this.slot3Element);

    // Arrow
    const arrow = this.createElement('span', {
      className: 'mixer-operator',
      textContent: '→',
      attributes: {
        style: 'font-size: 28px; font-weight: bold; color: var(--theme-primary);',
      },
    });
    equationRow.appendChild(arrow);

    // Result slot
    this.resultSlotElement = this.createResultSlot();
    equationRow.appendChild(this.resultSlotElement);

    craftingArea.appendChild(equationRow);

    // Tool icon (shown when no dyes selected, between equation and message)
    const hasDyes = this.selectedDyes[0] !== null || this.selectedDyes[1] !== null;
    this.emptyStateIcon = this.createElement('div', {
      attributes: {
        style: `
          width: 150px;
          height: 150px;
          margin-top: 24px;
          opacity: 0.25;
          color: var(--theme-text);
          display: ${hasDyes ? 'none' : 'block'};
        `,
      },
    });
    this.emptyStateIcon.innerHTML = ICON_TOOL_DYE_MIXER;
    craftingArea.appendChild(this.emptyStateIcon);

    // Empty state message (shown when no dyes selected)
    this.emptyStateMessage = this.createElement('p', {
      textContent: LanguageService.t('mixer.selectTwoDyesToMix'),
      attributes: {
        style: `
          color: var(--theme-text-muted);
          font-size: 1rem;
          margin-top: 16px;
          text-align: center;
          display: ${hasDyes ? 'none' : 'block'};
        `,
      },
    });
    craftingArea.appendChild(this.emptyStateMessage);

    this.craftingContainer.appendChild(craftingArea);
  }

  /**
   * Create a dye input slot (100x100px)
   * @param index - Slot index (0, 1, or 2)
   * @param isOptional - If true, shows different placeholder for optional slot
   */
  private createDyeSlot(index: 0 | 1 | 2, isOptional: boolean = false): HTMLElement {
    const dye = this.selectedDyes[index];
    const size = SLOT_SIZE.input;

    const slot = this.createElement('div', {
      className: 'mixer-dye-slot',
      attributes: {
        'data-slot-index': String(index),
        style: `
          width: ${size}px;
          height: ${size}px;
          border-radius: 12px;
          background: ${dye ? dye.hex : 'var(--v4-glass-bg, rgba(30, 30, 30, 0.7))'};
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 2px ${dye ? 'solid' : 'dashed'} var(--v4-glass-border, rgba(255, 255, 255, 0.1));
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
          position: relative;
          overflow: hidden;
          flex-shrink: 0;
          ${isOptional && !dye ? 'opacity: 0.6;' : ''}
        `,
      },
    });

    if (dye) {
      // Dye name label
      const label = this.createElement('span', {
        className: 'mixer-slot-label',
        textContent: LanguageService.getDyeName(dye.itemID) || dye.name,
        attributes: {
          style: `
            font-size: 10px;
            font-weight: 500;
            color: ${getContrastColor(dye.hex)};
            text-align: center;
            padding: 4px 6px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 4px;
            max-width: 90%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            position: absolute;
            bottom: 6px;
          `,
        },
      });
      slot.appendChild(label);

      // Slot number at top
      const slotNumber = this.createElement('span', {
        textContent: String(index + 1),
        attributes: {
          style: `
            font-size: 12px;
            font-weight: 600;
            color: ${getContrastColor(dye.hex)};
            position: absolute;
            top: 6px;
            left: 8px;
            background: rgba(0, 0, 0, 0.4);
            width: 18px;
            height: 18px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
          `,
        },
      });
      slot.appendChild(slotNumber);
    } else {
      // Empty slot placeholder
      const plusSign = this.createElement('span', {
        textContent: isOptional ? '?' : '+',
        attributes: {
          style: `
            font-size: ${isOptional ? '28px' : '32px'};
            font-weight: 300;
            color: rgba(255, 255, 255, ${isOptional ? '0.3' : '0.4'});
          `,
        },
      });
      slot.appendChild(plusSign);

      // Show "Optional" label for slot 3
      if (isOptional) {
        const optionalLabel = this.createElement('span', {
          textContent: LanguageService.t('common.optional'),
          attributes: {
            style: `
              font-size: 9px;
              font-weight: 500;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: rgba(255, 255, 255, 0.3);
              position: absolute;
              bottom: 8px;
            `,
          },
        });
        slot.appendChild(optionalLabel);
      }
    }

    // Hover effect
    this.on(slot, 'mouseenter', () => {
      slot.style.transform = 'scale(1.03)';
      slot.style.boxShadow = 'var(--v4-shadow-soft, 0 4px 24px rgba(0, 0, 0, 0.3))';
    });
    this.on(slot, 'mouseleave', () => {
      slot.style.transform = 'scale(1)';
      slot.style.boxShadow = 'none';
    });

    return slot;
  }

  /**
   * Create the result slot (120x120px)
   */
  private createResultSlot(): HTMLElement {
    const size = SLOT_SIZE.result;

    const slot = this.createElement('div', {
      className: 'mixer-result-slot',
      attributes: {
        style: `
          width: ${size}px;
          height: ${size}px;
          border-radius: 16px;
          background: ${this.blendedColor || 'var(--v4-glass-bg, rgba(30, 30, 30, 0.5))'};
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 3px solid var(--theme-primary, #d4af37);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 20px rgba(212, 175, 55, 0.3);
          position: relative;
          flex-shrink: 0;
        `,
      },
    });

    if (this.blendedColor) {
      // "Blend" label at top
      const blendLabel = this.createElement('span', {
        textContent: LanguageService.t('mixer.blend'),
        attributes: {
          style: `
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: ${getContrastColor(this.blendedColor)};
            position: absolute;
            top: 8px;
            background: rgba(0, 0, 0, 0.4);
            padding: 2px 8px;
            border-radius: 4px;
          `,
        },
      });
      slot.appendChild(blendLabel);

      // Hex value at bottom
      const hexLabel = this.createElement('span', {
        className: 'number',
        textContent: this.blendedColor.toUpperCase(),
        attributes: {
          style: `
            font-size: 12px;
            font-weight: 600;
            color: ${getContrastColor(this.blendedColor)};
            background: rgba(0, 0, 0, 0.5);
            padding: 4px 10px;
            border-radius: 4px;
            position: absolute;
            bottom: 8px;
          `,
        },
      });
      slot.appendChild(hexLabel);
    } else {
      // Empty state with question mark (indicates result will appear here)
      const placeholder = this.createElement('span', {
        textContent: '?',
        attributes: {
          style: `
            font-size: 36px;
            font-weight: 300;
            color: rgba(255, 255, 255, 0.4);
          `,
        },
      });
      slot.appendChild(placeholder);
    }

    return slot;
  }

  /**
   * Update the crafting UI slots
   */
  private updateCraftingUI(): void {
    if (!this.craftingContainer) return;

    // Re-render the crafting UI
    this.renderCraftingUI();
  }

  /**
   * Show/hide empty state
   */
  private showEmptyState(show: boolean): void {
    // Hide old icon+text empty state (replaced by slots with plus signs)
    if (this.emptyStateContainer) {
      this.emptyStateContainer.style.display = 'none';
    }

    // Always show crafting UI (slots visible with "+" when empty)
    if (this.craftingContainer) {
      this.craftingContainer.style.display = 'block';
    }

    // Show/hide the empty state icon above the slots
    if (this.emptyStateIcon) {
      this.emptyStateIcon.style.display = show ? 'block' : 'none';
    }

    // Show/hide the empty state message below the slots
    if (this.emptyStateMessage) {
      this.emptyStateMessage.style.display = show ? 'block' : 'none';
    }

    // Only show results section when we have matching dyes
    if (this.resultsSection) {
      this.resultsSection.style.display = show ? 'none' : 'block';
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
    const dyeA = this.selectedDyes[0];
    const dyeB = this.selectedDyes[1];
    const dyeC = this.selectedDyes[2];

    // Need at least 2 dyes to share
    if (!dyeA || !dyeB) {
      return {};
    }

    const params: Record<string, unknown> = {
      dyeA: dyeA.itemID,
      dyeB: dyeB.itemID,
      mode: this.mixingMode,
      algo: this.matchingMethod,
    };

    // Include optional third dye if present
    if (dyeC) {
      params.dyeC = dyeC.itemID;
    }

    return params;
  }

  /**
   * Update share button parameters when state changes
   */
  private updateShareButton(): void {
    if (this.shareButton) {
      this.shareButton.shareParams = this.getShareParams();
      // Disable share button if not at least 2 dyes selected
      this.shareButton.disabled = !this.selectedDyes[0] || !this.selectedDyes[1];
    }
  }

  /**
   * Render the results grid with v4-result-cards
   */
  private renderResultsGrid(): void {
    if (!this.resultsGridContainer) return;
    clearContainer(this.resultsGridContainer);

    if (this.matchedResults.length === 0) {
      return;
    }

    for (const result of this.matchedResults) {
      // Create v4-result-card
      const card = document.createElement('v4-result-card') as HTMLElement;
      card.setAttribute('show-actions', 'true');
      card.setAttribute('show-slot-picker', 'true');
      card.setAttribute('primary-action-label', LanguageService.t('mixer.replaceSlot'));

      // Set data property (ResultCardData interface)
      // Get price data to resolve both price and world name
      const priceDataForDye = this.priceData.get(result.matchedDye.itemID);
      const cardData: ResultCardData = {
        dye: result.matchedDye,
        originalColor: result.blendedHex,
        matchedColor: result.matchedDye.hex,
        deltaE: result.distance,
        matchingMethod: this.matchingMethod,
        // Resolve worldId to actual world name (e.g., "Balmung" instead of "Crystal")
        marketServer: this.marketBoardService.getWorldNameForPrice(priceDataForDye),
        price: priceDataForDye?.currentMinPrice,
      };
      (card as unknown as { data: ResultCardData }).data = cardData;

      // Set display options from tool state
      (card as unknown as { showHex: boolean }).showHex = this.displayOptions.showHex;
      (card as unknown as { showRgb: boolean }).showRgb = this.displayOptions.showRgb;
      (card as unknown as { showHsv: boolean }).showHsv = this.displayOptions.showHsv;
      (card as unknown as { showLab: boolean }).showLab = this.displayOptions.showLab;
      (card as unknown as { showDeltaE: boolean }).showDeltaE = this.displayOptions.showDeltaE;
      (card as unknown as { showPrice: boolean }).showPrice = this.displayOptions.showPrice;
      (card as unknown as { showAcquisition: boolean }).showAcquisition =
        this.displayOptions.showAcquisition;

      // Listen for context actions
      card.addEventListener('context-action', ((
        e: CustomEvent<{ action: ContextAction; dye: Dye }>
      ) => {
        this.handleContextAction(e.detail.action, e.detail.dye);
      }) as EventListener);

      this.resultsGridContainer.appendChild(card);
    }
  }

  /**
   * Handle context menu actions from result cards
   */
  private handleContextAction(action: ContextAction, dye: Dye): void {
    switch (action) {
      case 'add-comparison':
        // Navigate to comparison tool with this dye
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', {
            detail: { toolId: 'comparison', dye },
          })
        );
        ToastService.success(LanguageService.t('harmony.addedToComparison'));
        break;

      case 'add-mixer':
        // Add to this tool's selection (if slot available)
        if (!this.selectedDyes[0]) {
          this.selectedDyes[0] = dye;
        } else if (!this.selectedDyes[1]) {
          this.selectedDyes[1] = dye;
        } else {
          ToastService.warning(
            LanguageService.t('mixer.slotsFullReplacing')
          );
          this.selectedDyes[0] = this.selectedDyes[1];
          this.selectedDyes[1] = dye;
        }
        this.handleDyeSelection(this.selectedDyes.filter((d): d is Dye => d !== null));
        break;

      case 'add-mixer-slot-1':
        // Explicitly replace Slot 1
        this.selectedDyes[0] = dye;
        this.handleDyeSelection(this.selectedDyes.filter((d): d is Dye => d !== null));
        ToastService.success(
          LanguageService.t('mixer.replacedSlot1')
        );
        break;

      case 'add-mixer-slot-2':
        // Explicitly replace Slot 2
        this.selectedDyes[1] = dye;
        this.handleDyeSelection(this.selectedDyes.filter((d): d is Dye => d !== null));
        ToastService.success(
          LanguageService.t('mixer.replacedSlot2')
        );
        break;

      case 'add-accessibility':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', {
            detail: { toolId: 'accessibility', dye },
          })
        );
        ToastService.success(
          LanguageService.t('harmony.addedToAccessibility')
        );
        break;

      case 'see-harmonies':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', {
            detail: { toolId: 'harmony', dye },
          })
        );
        break;

      case 'budget':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', {
            detail: { toolId: 'budget', dye },
          })
        );
        break;

      case 'copy-hex':
        void navigator.clipboard.writeText(dye.hex).then(() => {
          ToastService.success(
            LanguageService.t('success.copiedToClipboard')
          );
        });
        break;
    }
  }

  // ============================================================================
  // Mobile Drawer
  // ============================================================================

  /**
   * Render mobile drawer content
   * WEB-REF-003 Phase 2: Refactored to use shared builders
   */
  private renderDrawerContent(): void {
    const drawer = this.options.drawerContent;
    if (!drawer) return;

    // Preserve any existing nav
    const existingNav = drawer.querySelector('[data-drawer-nav]');
    clearContainer(drawer);
    if (existingNav) {
      drawer.appendChild(existingNav);
    }

    // Section 1: Dye Selection - uses shared builder
    const dyeSelectionContainer = this.createElement('div');
    drawer.appendChild(dyeSelectionContainer);
    this.mobileDyeSelectionPanel = new CollapsiblePanel(dyeSelectionContainer, {
      title: LanguageService.t('mixer.dyeSelection'),
      storageKey: 'v4_mixer_mobile_dye_selection_panel',
      defaultOpen: true,
      icon: ICON_PALETTE,
    });
    this.mobileDyeSelectionPanel.init();
    const mobileDyeSelectionContent = this.createElement('div', { className: 'p-4' });
    const dyeRefs = this.buildDyeSelectorPanel(mobileDyeSelectionContent, 'v4_mixer_mobile');
    this.mobileDyeSelector = dyeRefs.selector;
    this.mobileSelectedDyesContainer = dyeRefs.displayContainer;
    this.renderSelectedDyesDisplayInto(dyeRefs.displayContainer);

    // Listen for selection changes - sync with desktop
    dyeRefs.selector.getElement()?.parentElement?.addEventListener('selection-changed', () => {
      const selectedDyes = dyeRefs.selector.getSelectedDyes();
      this.handleDyeSelection(selectedDyes);
      this.dyeSelector?.setSelectedDyes(selectedDyes);
    });

    this.mobileDyeSelectionPanel.setContent(mobileDyeSelectionContent);

    // Section 2: Mix Settings - uses shared builder
    const settingsContainer = this.createElement('div');
    drawer.appendChild(settingsContainer);
    this.mobileSettingsPanel = new CollapsiblePanel(settingsContainer, {
      title: LanguageService.t('mixer.mixSettings'),
      storageKey: 'v4_mixer_mobile_settings_panel',
      defaultOpen: true,
      icon: ICON_SLIDERS,
    });
    this.mobileSettingsPanel.init();
    const mobileSettingsContent = this.createElement('div', { className: 'p-4' });
    const settingsRefs = this.buildSettingsSlider(mobileSettingsContent);
    this.mobileMaxResultsDisplay = settingsRefs.valueDisplay;
    this.bindSettingsSliderEvents(settingsRefs.slider, settingsRefs.valueDisplay);
    this.mobileSettingsPanel.setContent(mobileSettingsContent);

    // Section 3: Filters - uses shared builder
    const filtersContainer = this.createElement('div');
    drawer.appendChild(filtersContainer);
    const filtersRefs = this.buildFiltersPanel(filtersContainer, 'v4_mixer_mobile_filters');
    this.mobileFiltersPanel = filtersRefs.panel;
    this.mobileDyeFilters = filtersRefs.filters;

    // Section 4: Market Board - uses shared builder
    const marketContainer = this.createElement('div');
    drawer.appendChild(marketContainer);
    const marketRefs = this.buildMarketPanel(marketContainer, 'v4_mixer_mobile_market');
    this.mobileMarketPanel = marketRefs.panel;
    this.mobileMarketBoard = marketRefs.marketBoard;
  }

  // WEB-REF-003 Phase 2: renderMobileDyeSelector, updateMobileSelectedDyesDisplay,
  // and renderMobileSettings removed - now using shared builders in renderDrawerContent

  /**
   * Update drawer content (called when state changes)
   * WEB-REF-003 Phase 2: Uses shared method for display update
   */
  private updateDrawerContent(): void {
    // Update mobile selected dyes display using shared method
    if (this.mobileSelectedDyesContainer) {
      this.renderSelectedDyesDisplayInto(this.mobileSelectedDyesContainer);
    }

    // Sync mobile DyeSelector with desktop
    const selectedDyes = this.selectedDyes.filter((d): d is Dye => d !== null);
    this.mobileDyeSelector?.setSelectedDyes(selectedDyes);

    // Sync slider
    if (this.mobileMaxResultsDisplay) {
      this.mobileMaxResultsDisplay.textContent = String(this.maxResults);
    }
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Format price for display
   */
  private formatPrice(dye: Dye): string | null {
    if (!this.showPrices) return null;
    const price = this.priceData.get(dye.itemID);
    if (!price?.currentMinPrice) return null;
    return `${price.currentMinPrice.toLocaleString()} gil`;
  }

  /**
   * Fetch prices for displayed dyes
   * Delegates to MarketBoardService with race condition protection
   */
  private async fetchPricesForDisplayedDyes(): Promise<void> {
    if (!this.showPrices) return;

    const dyes = this.matchedResults.map((r) => r.matchedDye);
    if (dyes.length === 0) return;

    try {
      const prices = await this.marketBoardService.fetchPricesForDyes(dyes);
      // Always re-render after fetch completes (even if empty/stale)
      // This ensures cards reflect current state when server changes
      this.renderResultsGrid();
      logger.info(`[MixerTool] Fetched prices for ${prices.size} dyes`);
    } catch (error) {
      logger.error('[MixerTool] Failed to fetch prices:', error);
    }
  }

  // WEB-REF-003 FIX: getContrastColor() moved to @services/mixer-blending-engine
}
