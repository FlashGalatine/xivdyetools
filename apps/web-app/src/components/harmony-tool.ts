/**
 * XIV Dye Tools v3.0.0 - Harmony Tool Component
 *
 * Phase 2: Color Harmony Explorer migration to v3 two-panel layout.
 * Orchestrates existing v2 components within the new shell structure.
 *
 * Left Panel: Dye selector, harmony type selector, companion slider, filters, market board
 * Right Panel: Color wheel visualization, harmony cards grid
 *
 * @module components/tools/harmony-tool
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { DyeSelector } from '@components/dye-selector';
import { DyeFilters, type DyeFilterConfig } from '@components/dye-filters';
import { MarketBoard } from '@components/market-board';
import { HarmonyType, type HarmonyTypeInfo } from '@components/harmony-type';
import { HarmonyResultPanel } from '@components/harmony-result-panel';
import { ColorWheelDisplay } from '@components/color-wheel-display';
import { PaletteExporter, type PaletteData } from '@components/palette-exporter';
import {
  ColorService,
  dyeService,
  LanguageService,
  RouterService,
  StorageService,
  WorldService,
  MarketBoardService,
  // WEB-REF-003 FIX: Import from extracted harmony generator
  HARMONY_OFFSETS,
  getHarmonyTypes,
  calculateHueDeviance,
  calculateHarmonyColorDistance,
  findClosestDyesToHue,
  replaceExcludedDyes,
  findHarmonyDyes,
  generateHarmonyPanelData,
} from '@services/index';
import type { ScoredDyeMatch, HarmonyConfig } from '@services/index';
import { ConfigController } from '@services/config-controller';
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, PriceData } from '@shared/types';
import { DisplayOptionsConfig, DEFAULT_DISPLAY_OPTIONS, type MatchingMethod } from '@shared/tool-config-types';
// WEB-REF-003 FIX: ColorConverter usage moved to harmony-generator.ts
import { HARMONY_ICONS } from '@shared/harmony-icons';
import {
  ICON_FILTER,
  ICON_MARKET,
  ICON_EXPORT,
  ICON_COINS,
  ICON_BEAKER,
  ICON_MUSIC,
} from '@shared/ui-icons';
import { ICON_TOOL_HARMONY } from '@shared/tool-icons';
import { COMPANION_DYES_MIN, COMPANION_DYES_MAX, COMPANION_DYES_DEFAULT } from '@shared/constants';
import { SubscriptionManager } from '@shared/subscription-manager';

// V4 Components - Import to register custom elements
import '@components/v4/v4-color-wheel';
import '@components/v4/result-card';
import '@components/v4/share-button';
import type { V4ColorWheel } from '@components/v4/v4-color-wheel';
import type { ResultCard, ResultCardData, ContextAction } from '@components/v4/result-card';
import type { ShareButton } from '@components/v4/share-button';

// ============================================================================
// Types and Constants
// ============================================================================

export interface HarmonyToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Suggestions mode type
 */
type SuggestionsMode = 'simple' | 'expanded';

// WEB-REF-003 Phase 2: Shared panel builder result types
interface BaseDyePanelRefs {
  selector: DyeSelector;
  displayContainer: HTMLElement;
}

interface CompanionSliderRefs {
  slider: HTMLInputElement;
  valueDisplay: HTMLElement;
}

interface HarmonyTypeSelectorRefs {
  container: HTMLElement;
}

interface FiltersPanelRefs {
  panel: CollapsiblePanel;
  filters: DyeFilters;
}

interface MarketPanelRefs {
  panel: CollapsiblePanel;
  marketBoard: MarketBoard;
}

// WEB-REF-003 FIX: HARMONY_TYPE_IDS and HARMONY_OFFSETS moved to @services/harmony-generator

/**
 * Storage keys for v3 harmony tool
 */
const STORAGE_KEYS = {
  harmonyType: 'v3_harmony_type',
  companionCount: 'v3_harmony_companions',
  suggestionsMode: 'v3_harmony_mode',
  selectedDyeId: 'v3_harmony_selected_dye',
} as const;

// WEB-REF-003 FIX: getHarmonyTypes() moved to @services/harmony-generator

// ============================================================================
// HarmonyTool Component
// ============================================================================

/**
 * Harmony Tool - v3 Two-Panel Layout
 *
 * Generates color harmony palettes from a base dye selection.
 * Integrates existing v2 components into the new panel structure.
 */
export class HarmonyTool extends BaseComponent {
  private options: HarmonyToolOptions;

  // State
  private selectedDye: Dye | null = null;
  private selectedHarmonyType: string;
  private companionDyesCount: number;
  private suggestionsMode: SuggestionsMode;
  private filterConfig: DyeFilterConfig | null = null;
  /** Tracks user-swapped dyes per harmony slot (harmonyIndex -> swapped dye) */
  private swappedDyes: Map<number, Dye> = new Map();
  /** V4 result card elements for updating prices after fetch */
  private v4ResultCards: ResultCard[] = [];

  // Market Board Service (shared price cache with race condition protection)
  private marketBoardService: MarketBoardService;

  // Getters for service state
  private get showPrices(): boolean {
    return this.marketBoardService.getShowPrices();
  }
  private get priceData(): Map<number, PriceData> {
    return this.marketBoardService.getAllPrices();
  }

  // Display options (from ConfigController)
  private displayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };
  private usePerceptualMatching: boolean = false;
  private matchingMethod: MatchingMethod = 'oklab';

  // Child components (desktop left panel)
  private dyeSelector: DyeSelector | null = null;
  private dyeFilters: DyeFilters | null = null;
  private marketBoard: MarketBoard | null = null;
  private filtersPanel: CollapsiblePanel | null = null;
  private marketPanel: CollapsiblePanel | null = null;
  private colorWheel: ColorWheelDisplay | null = null;
  private harmonyDisplays: Map<string, HarmonyType> = new Map();
  private resultPanels: HarmonyResultPanel[] = [];
  private paletteExporter: PaletteExporter | null = null;

  // Child components (mobile drawer) - separate instances for mobile config
  private drawerDyeSelector: DyeSelector | null = null;
  private drawerDyeFilters: DyeFilters | null = null;
  private drawerMarketBoard: MarketBoard | null = null;
  private drawerFiltersPanel: CollapsiblePanel | null = null;
  private drawerMarketPanel: CollapsiblePanel | null = null;
  private drawerHarmonyTypesContainer: HTMLElement | null = null;
  private drawerCompanionSlider: HTMLInputElement | null = null;
  private drawerCompanionDisplay: HTMLElement | null = null;

  // DOM References
  private harmonyTypesContainer: HTMLElement | null = null;
  private companionSlider: HTMLInputElement | null = null;
  private companionDisplay: HTMLElement | null = null;
  private colorWheelContainer: HTMLElement | null = null;
  private harmonyGridContainer: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private resultsSection: HTMLElement | null = null;
  private shareButton: ShareButton | null = null;

  // Subscriptions
  private subs = new SubscriptionManager();

  constructor(container: HTMLElement, options: HarmonyToolOptions) {
    super(container);
    this.options = options;

    // Initialize MarketBoardService (shared price cache)
    this.marketBoardService = MarketBoardService.getInstance();

    // Load persisted state
    this.selectedHarmonyType =
      StorageService.getItem<string>(STORAGE_KEYS.harmonyType) ?? 'complementary';
    this.companionDyesCount =
      StorageService.getItem<number>(STORAGE_KEYS.companionCount) ?? COMPANION_DYES_DEFAULT;
    this.suggestionsMode =
      StorageService.getItem<SuggestionsMode>(STORAGE_KEYS.suggestionsMode) ?? 'simple';

    // Load persisted selected dye
    const savedDyeId = StorageService.getItem<number>(STORAGE_KEYS.selectedDyeId);
    if (savedDyeId !== null) {
      // Debug: Check database status
      const allDyes = dyeService.getAllDyes();
      const dyeCount = allDyes.length;
      const minItemId = allDyes.length > 0 ? Math.min(...allDyes.map((d) => d.itemID)) : 0;
      const maxItemId = allDyes.length > 0 ? Math.max(...allDyes.map((d) => d.itemID)) : 0;
      logger.info(
        `[HarmonyTool] Database has ${dyeCount} dyes, itemID range: ${minItemId}-${maxItemId}`
      );
      logger.info(`[HarmonyTool] Attempting to restore dye with ID: ${savedDyeId}`);

      const dye = dyeService.getDyeById(savedDyeId);
      if (dye) {
        this.selectedDye = dye;
        logger.info(`[HarmonyTool] Restored persisted dye: ${dye.name} (itemID=${dye.itemID})`);
      } else {
        // Check if dye exists with itemID lookup (diagnostic)
        const foundBySearch = allDyes.find((d) => d.itemID === savedDyeId);
        if (foundBySearch) {
          logger.warn(
            `[HarmonyTool] Dye found by search (${foundBySearch.name}) but getDyeById(${savedDyeId}) returned null!`
          );
          // Use the dye we found manually
          this.selectedDye = foundBySearch;
          logger.info(`[HarmonyTool] Using fallback search to restore: ${foundBySearch.name}`);
        } else {
          logger.warn(
            `[HarmonyTool] Dye ID ${savedDyeId} not found in database (range: ${minItemId}-${maxItemId})`
          );
          StorageService.removeItem(STORAGE_KEYS.selectedDyeId);
        }
      }
    }
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  renderContent(): void {
    // CRITICAL: Destroy existing child components before re-rendering
    // This prevents orphaned components and memory leaks during update()
    this.destroyChildComponents();

    this.renderLeftPanel();
    this.renderRightPanel();

    if (this.options.drawerContent) {
      this.renderDrawerContent();
    }

    this.element = this.container;
  }

  /**
   * Clean up child components before re-rendering
   * Called automatically during render() to prevent memory leaks
   */
  private destroyChildComponents(): void {
    // Desktop left panel components
    this.dyeSelector?.destroy();
    this.dyeSelector = null;

    this.dyeFilters?.destroy();
    this.dyeFilters = null;

    this.marketBoard?.destroy();
    this.marketBoard = null;

    this.filtersPanel?.destroy();
    this.filtersPanel = null;

    this.marketPanel?.destroy();
    this.marketPanel = null;

    this.colorWheel?.destroy();
    this.colorWheel = null;

    this.paletteExporter?.destroy();
    this.paletteExporter = null;

    this.shareButton = null;

    for (const display of this.harmonyDisplays.values()) {
      display.destroy();
    }
    this.harmonyDisplays.clear();

    for (const panel of this.resultPanels) {
      panel.destroy();
    }
    this.resultPanels = [];

    // Mobile drawer components
    this.drawerDyeSelector?.destroy();
    this.drawerDyeSelector = null;

    this.drawerDyeFilters?.destroy();
    this.drawerDyeFilters = null;

    this.drawerMarketBoard?.destroy();
    this.drawerMarketBoard = null;

    this.drawerFiltersPanel?.destroy();
    this.drawerFiltersPanel = null;

    this.drawerMarketPanel?.destroy();
    this.drawerMarketPanel = null;

    this.drawerHarmonyTypesContainer = null;
    this.drawerCompanionSlider = null;
    this.drawerCompanionDisplay = null;
  }

  bindEvents(): void {
    // Event bindings handled in child components
  }

  onMount(): void {
    // Subscribe to language changes (only in onMount, NOT bindEvents - avoids infinite loop)
    this.subs.add(
      LanguageService.subscribe(() => {
        this.update();
      })
    );

    // Subscribe to route changes to handle deep links when navigating to harmony
    this.subs.add(
      RouterService.subscribe((state) => {
        if (state.toolId === 'harmony') {
          this.handleDeepLink();
        }
      })
    );

    // Handle deep link (e.g., ?dyeId=5729 from context menu)
    this.handleDeepLink();

    // Load display options from ConfigController
    const configController = ConfigController.getInstance();
    const harmonyConfig = configController.getConfig('harmony');
    this.displayOptions = harmonyConfig.displayOptions ?? { ...DEFAULT_DISPLAY_OPTIONS };
    this.usePerceptualMatching = harmonyConfig.strictMatching;
    this.matchingMethod = harmonyConfig.matchingMethod ?? 'oklab';

    // Note: Market config (showPrices, server) is now managed by MarketBoardService
    // which subscribes to ConfigController automatically. MarketBoard components
    // delegate to the service, so no manual sync is needed here.

    // Subscribe to harmony config changes
    this.subs.add(
      configController.subscribe('harmony', (config) => {
        const newDisplayOptions = config.displayOptions ?? { ...DEFAULT_DISPLAY_OPTIONS };
        const needsRerender =
          this.displayOptions.showHex !== newDisplayOptions.showHex ||
          this.displayOptions.showRgb !== newDisplayOptions.showRgb ||
          this.displayOptions.showHsv !== newDisplayOptions.showHsv ||
          this.displayOptions.showLab !== newDisplayOptions.showLab ||
          this.displayOptions.showPrice !== newDisplayOptions.showPrice ||
          this.displayOptions.showDeltaE !== newDisplayOptions.showDeltaE ||
          this.displayOptions.showAcquisition !== newDisplayOptions.showAcquisition;

        // Perceptual matching or matching method changes require regenerating harmonies
        const algorithmChanged =
          this.usePerceptualMatching !== config.strictMatching ||
          (config.matchingMethod !== undefined && this.matchingMethod !== config.matchingMethod);

        this.displayOptions = newDisplayOptions;
        this.usePerceptualMatching = config.strictMatching;
        if (config.matchingMethod !== undefined) {
          this.matchingMethod = config.matchingMethod;
        }

        if ((needsRerender || algorithmChanged) && this.selectedDye) {
          this.generateHarmonies();
        }
      })
    );

    // Subscribe to market config changes (from ConfigSidebar)
    // Note: MarketBoardService handles state updates and cache clearing.
    // We just need to regenerate UI when settings change.
    this.subs.add(
      configController.subscribe('market', (config) => {
        // Regenerate harmonies and fetch prices if needed
        if (this.selectedDye) {
          this.generateHarmonies();
          if (config.showPrices) {
            this.fetchPricesForDisplayedDyes();
          }
        }
      })
    );

    // Generate initial harmonies if a dye is selected, otherwise show empty state
    if (this.selectedDye) {
      this.generateHarmonies();
      // Fetch prices on initial load if enabled
      if (this.showPrices) {
        this.fetchPricesForDisplayedDyes();
      }
    } else {
      // No dye selected - show empty state message
      this.showEmptyState(true);
    }

    logger.info('[HarmonyTool] Mounted');
  }

  destroy(): void {
    // Cleanup subscriptions
    this.subs.unsubscribeAll();

    // Cleanup child components
    this.destroyChildComponents();

    super.destroy();
    logger.info('[HarmonyTool] Destroyed');
  }

  // ============================================================================
  // Deep Link Handling
  // ============================================================================

  /**
   * Handle deep links from URL parameters
   * Supports both legacy format (?dyeId=5729) and new share URLs
   * (?dye=5771&harmony=tetradic&algo=oklab&perceptual=1&v=1)
   */
  private handleDeepLink(): void {
    const params = new URLSearchParams(window.location.search);

    // Support both 'dye' (new share URLs) and 'dyeId' (legacy deep links)
    const dyeIdParam = params.get('dye') ?? params.get('dyeId');
    const harmonyParam = params.get('harmony');
    const algoParam = params.get('algo');
    const perceptualParam = params.get('perceptual');
    const versionParam = params.get('v');

    // Debug: Log what we're reading from the URL
    logger.info(
      `[HarmonyTool] handleDeepLink called - URL search: "${window.location.search}"`,
      { dyeIdParam, harmonyParam, algoParam, perceptualParam, versionParam }
    );

    // If no share params present, skip
    if (!dyeIdParam && !harmonyParam) {
      return;
    }

    // Get ConfigController instance for syncing sidebar
    const configController = ConfigController.getInstance();

    // Apply harmony type if valid
    if (harmonyParam) {
      const validHarmonyTypes = [
        'complementary',
        'analogous',
        'triadic',
        'split-complementary',
        'tetradic',
        'square',
        'monochromatic',
        'compound',
        'shades',
      ];

      // Normalize to lowercase for comparison
      const normalizedHarmony = harmonyParam.toLowerCase();

      if (validHarmonyTypes.includes(normalizedHarmony)) {
        this.selectedHarmonyType = normalizedHarmony;
        StorageService.setItem(STORAGE_KEYS.harmonyType, normalizedHarmony);
        logger.info(`[HarmonyTool] Share URL loaded harmony type: ${normalizedHarmony}`);

        // Sync with ConfigController so sidebar updates
        configController.setConfig('harmony', { harmonyType: normalizedHarmony });

        // Update harmony type buttons UI
        this.updateHarmonyTypeButtonStyles(this.harmonyTypesContainer, this.selectedHarmonyType);
        this.updateHarmonyTypeButtonStyles(
          this.drawerHarmonyTypesContainer,
          this.selectedHarmonyType
        );
      } else {
        logger.warn(`[HarmonyTool] Invalid harmony type in URL: ${harmonyParam}`);
      }
    }

    // Apply matching algorithm if valid
    if (algoParam) {
      const validAlgorithms = ['oklab', 'ciede2000', 'euclidean'];
      const normalizedAlgo = algoParam.toLowerCase();

      if (validAlgorithms.includes(normalizedAlgo)) {
        this.matchingMethod = normalizedAlgo as typeof this.matchingMethod;
        logger.info(`[HarmonyTool] Share URL loaded matching algorithm: ${normalizedAlgo}`);

        // Sync with ConfigController so sidebar updates
        configController.setConfig('harmony', { matchingMethod: normalizedAlgo as MatchingMethod });
      } else {
        logger.warn(`[HarmonyTool] Invalid algorithm in URL: ${algoParam}`);
      }
    }

    // Apply perceptual matching flag
    if (perceptualParam !== null) {
      // Accept '1', 'true', or 'yes' as truthy values
      this.usePerceptualMatching =
        perceptualParam === '1' || perceptualParam === 'true' || perceptualParam === 'yes';
      logger.info(
        `[HarmonyTool] Share URL loaded perceptual matching: ${this.usePerceptualMatching}`
      );

      // Sync with ConfigController so sidebar updates
      configController.setConfig('harmony', { strictMatching: this.usePerceptualMatching });
    }

    // Load dye by itemID
    if (dyeIdParam) {
      const dyeId = parseInt(dyeIdParam, 10);
      if (!isNaN(dyeId)) {
        // Find dye by itemID (FFXIV item ID)
        const allDyes = dyeService.getAllDyes();
        const dye = allDyes.find((d) => d.itemID === dyeId);

        if (dye) {
          this.selectedDye = dye;
          StorageService.setItem(STORAGE_KEYS.selectedDyeId, dye.itemID);
          logger.info(`[HarmonyTool] Share URL loaded dye: ${dye.name} (itemID=${dye.itemID})`);

          // Update the desktop dye selector if it exists
          if (this.dyeSelector) {
            this.dyeSelector.setSelectedDyes([dye]);
          }

          // Update the mobile drawer dye selector if it exists
          if (this.drawerDyeSelector) {
            this.drawerDyeSelector.setSelectedDyes([dye]);
          }

          // Clear any previously swapped dyes since we're selecting a new base
          this.swappedDyes.clear();

          // Re-render to update the current dye display elements
          this.update();

          // Generate harmonies for the newly selected dye
          this.generateHarmonies();

          // Fetch prices if enabled
          if (this.showPrices) {
            this.fetchPricesForDisplayedDyes();
          }
        } else {
          logger.warn(`[HarmonyTool] Share URL dye not found: itemID=${dyeId}`);
        }
      }
    } else if (harmonyParam && this.selectedDye) {
      // If only harmony type changed but we already have a dye, regenerate
      this.swappedDyes.clear();
      this.generateHarmonies();
    }
  }

  // ============================================================================
  // WEB-REF-003 Phase 2: Shared Panel Builders
  // Eliminates desktop ↔ drawer code duplication (~300 lines extracted)
  // ============================================================================

  /**
   * Render current dye display (shared by desktop and drawer)
   * @param container Container to render into
   */
  private renderCurrentDyeDisplayInto(container: HTMLElement): void {
    clearContainer(container);

    if (this.selectedDye) {
      const display = this.createElement('div', {
        className: 'flex items-center gap-3 p-3 rounded-lg',
        attributes: { style: 'background: var(--theme-primary); color: var(--theme-text-header);' },
      });

      const swatch = this.createElement('div', {
        className: 'w-8 h-8 rounded border-2 border-white/30',
        attributes: { style: `background: ${this.selectedDye.hex};` },
      });

      const name = this.createElement('span', {
        className: 'font-medium',
        textContent: LanguageService.getDyeName(this.selectedDye.itemID) ?? this.selectedDye.name,
      });

      display.appendChild(swatch);
      display.appendChild(name);
      container.appendChild(display);
    } else {
      const placeholder = this.createElement('div', {
        className: 'p-3 rounded-lg border-2 border-dashed text-center text-sm',
        textContent: LanguageService.t('harmony.selectDye'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      container.appendChild(placeholder);
    }
  }

  /**
   * Build base dye selector panel content (shared by desktop and drawer)
   * @param container Container to render into
   * @returns References to created selector and display container
   */
  private buildBaseDyePanel(container: HTMLElement): BaseDyePanelRefs {
    const dyeContainer = this.createElement('div', { className: 'space-y-3' });

    // Current selection display
    const displayContainer = this.createElement('div', {
      className: 'current-dye-display',
    });
    this.renderCurrentDyeDisplayInto(displayContainer);
    dyeContainer.appendChild(displayContainer);

    // Dye selector component
    const selectorContainer = this.createElement('div');
    dyeContainer.appendChild(selectorContainer);

    const selector = new DyeSelector(selectorContainer, {
      maxSelections: 1,
      allowMultiple: false,
      showCategories: true,
      showPrices: this.showPrices,
      excludeFacewear: true,
      showFavorites: true,
      compactMode: true,
    });
    selector.init();

    // Pre-select persisted dye if available
    if (this.selectedDye) {
      selector.setSelectedDyes([this.selectedDye]);
    }

    container.appendChild(dyeContainer);
    return { selector, displayContainer };
  }

  /**
   * Build harmony type selector buttons (shared by desktop and drawer)
   * @param container Container to render into
   * @returns Reference to container element
   */
  private buildHarmonyTypeSelector(container: HTMLElement): HarmonyTypeSelectorRefs {
    const typesContainer = this.createElement('div', {
      className: 'space-y-1 max-h-48 overflow-y-auto',
    });

    const harmonyTypes = getHarmonyTypes();

    for (const type of harmonyTypes) {
      const isSelected = this.selectedHarmonyType === type.id;
      const btn = this.createElement('button', {
        className:
          'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all text-sm',
        attributes: {
          style: isSelected
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: transparent; color: var(--theme-text);',
          'data-harmony-type': type.id,
        },
      });

      // Icon
      const iconSpan = this.createElement('span', {
        className: 'w-5 h-5 flex-shrink-0',
        innerHTML: HARMONY_ICONS[type.icon] || '',
      });

      const nameSpan = this.createElement('span', { textContent: type.name });

      btn.appendChild(iconSpan);
      btn.appendChild(nameSpan);

      typesContainer.appendChild(btn);
    }

    container.appendChild(typesContainer);
    return { container: typesContainer };
  }

  /**
   * Update harmony type button styles (shared by desktop and drawer)
   * @param container The harmony types container element
   * @param typeId Currently selected harmony type ID
   */
  private updateHarmonyTypeButtonStyles(container: HTMLElement | null, typeId: string): void {
    if (!container) return;
    const buttons = container.querySelectorAll('button');
    buttons.forEach((btn) => {
      const isSelected = btn.getAttribute('data-harmony-type') === typeId;
      btn.setAttribute(
        'style',
        isSelected
          ? 'background: var(--theme-primary); color: var(--theme-text-header);'
          : 'background: transparent; color: var(--theme-text);'
      );
    });
  }

  /**
   * Build companion dyes slider (shared by desktop and drawer)
   * @param container Container to render into
   * @returns References to created slider and value display
   */
  private buildCompanionSlider(container: HTMLElement): CompanionSliderRefs {
    const sliderContainer = this.createElement('div', { className: 'flex items-center gap-3' });

    const slider = this.createElement('input', {
      attributes: {
        type: 'range',
        min: String(COMPANION_DYES_MIN),
        max: String(COMPANION_DYES_MAX),
        value: String(this.companionDyesCount),
      },
      className: 'flex-1',
    }) as HTMLInputElement;

    const valueDisplay = this.createElement('span', {
      className: 'text-sm number w-6 text-center',
      textContent: String(this.companionDyesCount),
      attributes: { style: 'color: var(--theme-text);' },
    });

    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(valueDisplay);
    container.appendChild(sliderContainer);

    return { slider, valueDisplay };
  }

  /**
   * Bind companion slider events (shared by desktop and drawer)
   * Syncs both sliders when either changes
   */
  private bindCompanionSliderEvents(slider: HTMLInputElement, valueDisplay: HTMLElement): void {
    this.on(slider, 'input', () => {
      this.companionDyesCount = parseInt(slider.value, 10);
      valueDisplay.textContent = String(this.companionDyesCount);
      StorageService.setItem(STORAGE_KEYS.companionCount, this.companionDyesCount);

      // Sync both sliders
      if (this.companionSlider) {
        this.companionSlider.value = String(this.companionDyesCount);
      }
      if (this.companionDisplay) {
        this.companionDisplay.textContent = String(this.companionDyesCount);
      }
      if (this.drawerCompanionSlider) {
        this.drawerCompanionSlider.value = String(this.companionDyesCount);
      }
      if (this.drawerCompanionDisplay) {
        this.drawerCompanionDisplay.textContent = String(this.companionDyesCount);
      }
    });

    this.on(slider, 'change', () => {
      this.generateHarmonies();
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
      storageKeyPrefix: 'v3_harmony',
      hideHeader: true,
      onFilterChange: (filterConfig) => {
        this.filterConfig = filterConfig;
        this.generateHarmonies();
      },
    });
    filters.init();

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
    setupMarketBoardListeners(marketContent, () => this.showPrices, () => this.fetchPricesForDisplayedDyes(), {
      onPricesToggled: () => {
        this.generateHarmonies();
      },
      onServerChanged: () => {
        if (this.selectedDye) this.generateHarmonies();
      },
    });

    panel.setContent(marketContent);
    return { panel, marketBoard };
  }

  // ============================================================================
  // Left Panel Rendering
  // ============================================================================

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Section 1: Base Dye (Collapsible)
    const dyeContainer = this.createElement('div');
    left.appendChild(dyeContainer);
    this.renderBaseDyePanel(dyeContainer);

    // Section 2: Harmony Type + Companion Slider (Collapsible)
    const harmonyContainer = this.createElement('div');
    left.appendChild(harmonyContainer);
    this.renderHarmonyTypePanel(harmonyContainer);

    // Collapsible: Dye Filters
    const filtersContainer = this.createElement('div');
    left.appendChild(filtersContainer);
    this.renderFiltersPanel(filtersContainer);

    // Collapsible: Market Board
    const marketContainer = this.createElement('div');
    left.appendChild(marketContainer);
    this.renderMarketPanel(marketContainer);
  }

  /**
   * Render collapsible Base Dye panel
   */
  private renderBaseDyePanel(container: HTMLElement): void {
    const panel = new CollapsiblePanel(container, {
      title: LanguageService.t('harmony.baseDye'),
      defaultOpen: true,
      storageKey: 'harmony_base_dye',
      icon: ICON_BEAKER,
    });
    panel.init();

    const contentContainer = panel.getContentContainer();
    if (contentContainer) {
      this.renderDyeSelector(contentContainer);
    }
  }

  /**
   * Render collapsible Harmony Type panel (includes harmony selector and companion slider)
   */
  private renderHarmonyTypePanel(container: HTMLElement): void {
    const panel = new CollapsiblePanel(container, {
      title: LanguageService.t('harmony.harmonyType'),
      defaultOpen: true,
      storageKey: 'harmony_type',
      icon: ICON_MUSIC,
    });
    panel.init();

    const contentContainer = panel.getContentContainer();
    if (contentContainer) {
      this.renderHarmonyTypeSelector(contentContainer);

      // Companion Dyes slider (inside Harmony Type panel)
      const companionSection = this.createElement('div', {
        className: 'mt-4 pt-4 border-t',
        attributes: { style: 'border-color: var(--theme-border);' },
      });
      const companionLabel = this.createElement('div', {
        className: 'text-sm mb-2',
        textContent: LanguageService.t('harmony.companionDyes'),
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      companionSection.appendChild(companionLabel);
      this.renderCompanionSlider(companionSection);
      contentContainer.appendChild(companionSection);
    }
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
   * Render dye selector section
   * WEB-REF-003 Phase 2: Refactored to use shared builder
   */
  private renderDyeSelector(container: HTMLElement): void {
    const refs = this.buildBaseDyePanel(container);

    // Store references
    this.dyeSelector = refs.selector;
    // Store displayContainer reference for updates
    const displayContainer = refs.displayContainer;

    // Listen for dye selection (custom event from DyeSelector)
    refs.selector.getElement()?.parentElement?.addEventListener('selection-changed', ((
      event: CustomEvent<{ selectedDyes: Dye[] }>
    ) => {
      const selectedDyes = event.detail.selectedDyes;
      this.selectedDye = selectedDyes.length > 0 ? selectedDyes[0] : null;

      // Persist selected dye itemID for restoration when returning to this tool
      if (this.selectedDye) {
        const dyeIdToSave = this.selectedDye.itemID;
        StorageService.setItem(STORAGE_KEYS.selectedDyeId, dyeIdToSave);
        logger.info(`[HarmonyTool] Saved dye: ${this.selectedDye.name} (itemID=${dyeIdToSave})`);
      } else {
        StorageService.removeItem(STORAGE_KEYS.selectedDyeId);
        logger.info('[HarmonyTool] Cleared saved dye');
      }

      // Clear swapped dyes when base dye changes
      this.swappedDyes.clear();

      this.renderCurrentDyeDisplayInto(displayContainer);
      this.generateHarmonies();
      this.updateDrawerContent();
    }) as EventListener);
  }

  // WEB-REF-003 Phase 2: updateCurrentDyeDisplay removed - now using renderCurrentDyeDisplayInto

  /**
   * Render harmony type selector
   * WEB-REF-003 Phase 2: Refactored to use shared builder
   */
  private renderHarmonyTypeSelector(container: HTMLElement): void {
    const refs = this.buildHarmonyTypeSelector(container);
    this.harmonyTypesContainer = refs.container;

    // Bind click events
    const buttons = refs.container.querySelectorAll('button');
    buttons.forEach((btn) => {
      const typeId = btn.getAttribute('data-harmony-type');
      if (typeId) {
        this.on(btn, 'click', () => {
          this.selectHarmonyType(typeId);
        });
      }
    });
  }

  /**
   * Select a harmony type
   * WEB-REF-003 Phase 2: Uses shared style update method
   */
  private selectHarmonyType(typeId: string): void {
    this.selectedHarmonyType = typeId;
    StorageService.setItem(STORAGE_KEYS.harmonyType, typeId);

    // Clear swapped dyes when harmony type changes
    this.swappedDyes.clear();

    // Update button styles for both desktop and drawer
    this.updateHarmonyTypeButtonStyles(this.harmonyTypesContainer, typeId);
    this.updateHarmonyTypeButtonStyles(this.drawerHarmonyTypesContainer, typeId);

    this.generateHarmonies();
    this.updateDrawerContent();
  }

  /**
   * Render companion dyes slider
   * WEB-REF-003 Phase 2: Refactored to use shared builder
   */
  private renderCompanionSlider(container: HTMLElement): void {
    const refs = this.buildCompanionSlider(container);
    this.companionSlider = refs.slider;
    this.companionDisplay = refs.valueDisplay;
    this.bindCompanionSliderEvents(refs.slider, refs.valueDisplay);
  }

  /**
   * Render dye filters collapsible panel
   * WEB-REF-003 Phase 2: Refactored to use shared builder
   */
  private renderFiltersPanel(container: HTMLElement): void {
    const refs = this.buildFiltersPanel(container, 'harmony_filters');
    this.filtersPanel = refs.panel;
    this.dyeFilters = refs.filters;
  }

  /**
   * Render market board collapsible panel
   * WEB-REF-003 Phase 2: Refactored to use shared builder
   */
  private renderMarketPanel(container: HTMLElement): void {
    const refs = this.buildMarketPanel(container, 'harmony_market');
    this.marketPanel = refs.panel;
    this.marketBoard = refs.marketBoard;
  }

  // ============================================================================
  // Right Panel Rendering
  // ============================================================================

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Content wrapper with max-width to prevent over-expansion on ultrawide monitors
    const contentWrapper = this.createElement('div', {
      attributes: {
        style: 'max-width: 1200px; margin: 0 auto; width: 100%;',
      },
    });

    // Color Wheel Section - centered with inline styles for reliability
    this.colorWheelContainer = this.createElement('div', {
      className: 'color-wheel-container',
      attributes: {
        style:
          'display: flex; justify-content: center; align-items: center; width: 100%; margin-bottom: 1.5rem;',
      },
    });
    contentWrapper.appendChild(this.colorWheelContainer);

    // Results Section - wraps header + grid to keep them visually grouped
    this.resultsSection = this.createElement('div', {
      className: 'harmony-results-section',
    });

    // Results Header with Share Button
    const resultsHeader = this.createElement('div', {
      className: 'section-header',
      attributes: {
        style: 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;',
      },
    });

    const resultsTitle = this.createElement('span', {
      className: 'section-title',
      textContent: LanguageService.t('harmony.results'),
    });

    // Share Button - v4-share-button custom element
    this.shareButton = document.createElement('v4-share-button') as ShareButton;
    this.shareButton.tool = 'harmony';
    this.shareButton.shareParams = this.getShareParams();

    resultsHeader.appendChild(resultsTitle);
    resultsHeader.appendChild(this.shareButton);
    this.resultsSection.appendChild(resultsHeader);

    // Harmony Results - horizontal row layout with inline styles for reliability
    this.harmonyGridContainer = this.createElement('div', {
      className: 'harmony-results-container',
      attributes: {
        style:
          'display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center; --v4-result-card-width: 280px;',
      },
    });
    this.resultsSection.appendChild(this.harmonyGridContainer);

    contentWrapper.appendChild(this.resultsSection);

    // Empty state (shown when no dye selected)
    this.emptyStateContainer = this.createElement('div', {
      className: 'hidden',
    });
    contentWrapper.appendChild(this.emptyStateContainer);

    right.appendChild(contentWrapper);

    // Initial render
    this.renderColorWheel();
    this.renderEmptyState();
  }

  /**
   * Render color wheel visualization using v4-color-wheel component
   */
  private renderColorWheel(): void {
    if (!this.colorWheelContainer) return;
    clearContainer(this.colorWheelContainer);

    // Create v4-color-wheel custom element
    const wheel = document.createElement('v4-color-wheel') as V4ColorWheel;
    wheel.setAttribute('harmony-type', this.selectedHarmonyType);
    wheel.setAttribute('size', '300');

    if (this.selectedDye) {
      // Get matched dyes for the selected harmony type
      const matchedDyes = this.getMatchedDyesForCurrentHarmony();

      wheel.setAttribute('base-color', this.selectedDye.hex);
      wheel.harmonyColors = matchedDyes.map((dye) => dye.hex);
      wheel.harmonyDyes = matchedDyes;
    } else {
      // Empty state - show placeholder wheel
      wheel.setAttribute('empty', '');
    }

    this.colorWheelContainer.appendChild(wheel);
  }

  /**
   * Render empty state when no dye selected (v4 design)
   */
  private renderEmptyState(): void {
    if (!this.emptyStateContainer) return;
    clearContainer(this.emptyStateContainer);

    const empty = this.createElement('div', {
      className: 'harmony-results-empty',
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex: 1;
          padding: 40px;
          text-align: center;
          color: var(--theme-text-muted, #a0a0a0);
        `,
      },
    });

    // Harmony tool icon using official tool icon
    empty.innerHTML = `
      <div style="width: 150px; height: 150px; margin-bottom: 24px; opacity: 0.4; color: currentColor;">
        ${ICON_TOOL_HARMONY}
      </div>
      <div style="font-size: 18px; font-weight: 500; color: var(--theme-text, #e0e0e0); margin-bottom: 12px;">
        ${LanguageService.t('harmony.noColorSelected')}
      </div>
      <div style="font-size: 14px; color: var(--theme-text-muted, #a0a0a0); max-width: 300px; line-height: 1.5;">
        ${LanguageService.t('harmony.selectDyePrompt')}
      </div>
    `;

    this.emptyStateContainer.appendChild(empty);
  }

  // ============================================================================
  // Mobile Drawer Content
  // ============================================================================

  /**
   * Render full interactive configuration controls in the mobile drawer
   * WEB-REF-003 Phase 2: Refactored to use shared builders
   */
  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    const drawer = this.options.drawerContent;
    clearContainer(drawer);

    // Section 1: Base Dye (Collapsible) - uses shared builder
    const dyeContainer = this.createElement('div');
    drawer.appendChild(dyeContainer);
    const dyePanel = new CollapsiblePanel(dyeContainer, {
      title: LanguageService.t('harmony.baseDye'),
      defaultOpen: true,
      storageKey: 'harmony_base_dye_drawer',
      icon: ICON_BEAKER,
    });
    dyePanel.init();
    const dyeContent = dyePanel.getContentContainer();
    if (dyeContent) {
      const dyeRefs = this.buildBaseDyePanel(dyeContent);
      this.drawerDyeSelector = dyeRefs.selector;
      const displayContainer = dyeRefs.displayContainer;

      // Listen for dye selection - sync with desktop
      dyeRefs.selector.getElement()?.parentElement?.addEventListener('selection-changed', ((
        event: CustomEvent<{ selectedDyes: Dye[] }>
      ) => {
        const selectedDyes = event.detail.selectedDyes;
        this.selectedDye = selectedDyes.length > 0 ? selectedDyes[0] : null;

        // Persist selected dye
        if (this.selectedDye) {
          StorageService.setItem(STORAGE_KEYS.selectedDyeId, this.selectedDye.itemID);
          logger.info(`[HarmonyTool] Saved dye from drawer: ${this.selectedDye.name}`);
        } else {
          StorageService.removeItem(STORAGE_KEYS.selectedDyeId);
        }

        // Clear swapped dyes when base dye changes
        this.swappedDyes.clear();

        // Sync desktop selector if it exists
        if (this.dyeSelector && this.selectedDye) {
          this.dyeSelector.setSelectedDyes([this.selectedDye]);
        } else if (this.dyeSelector) {
          this.dyeSelector.setSelectedDyes([]);
        }

        // Update displays and regenerate
        this.renderCurrentDyeDisplayInto(displayContainer);
        this.generateHarmonies();
      }) as EventListener);
    }

    // Section 2: Harmony Type + Companion Slider (Collapsible) - uses shared builders
    const harmonyContainer = this.createElement('div');
    drawer.appendChild(harmonyContainer);
    const harmonyPanel = new CollapsiblePanel(harmonyContainer, {
      title: LanguageService.t('harmony.harmonyType'),
      defaultOpen: true,
      storageKey: 'harmony_type_drawer',
      icon: ICON_MUSIC,
    });
    harmonyPanel.init();
    const harmonyContent = harmonyPanel.getContentContainer();
    if (harmonyContent) {
      // Harmony type selector - uses shared builder
      const typeRefs = this.buildHarmonyTypeSelector(harmonyContent);
      this.drawerHarmonyTypesContainer = typeRefs.container;

      // Bind click events for drawer selector
      const buttons = typeRefs.container.querySelectorAll('button');
      buttons.forEach((btn) => {
        const typeId = btn.getAttribute('data-harmony-type');
        if (typeId) {
          this.on(btn, 'click', () => {
            this.selectHarmonyType(typeId);
          });
        }
      });

      // Companion Dyes slider - uses shared builder
      const companionSection = this.createElement('div', {
        className: 'mt-4 pt-4 border-t',
        attributes: { style: 'border-color: var(--theme-border);' },
      });
      const companionLabel = this.createElement('div', {
        className: 'text-sm mb-2',
        textContent: LanguageService.t('harmony.companionDyes'),
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      companionSection.appendChild(companionLabel);
      const sliderRefs = this.buildCompanionSlider(companionSection);
      this.drawerCompanionSlider = sliderRefs.slider;
      this.drawerCompanionDisplay = sliderRefs.valueDisplay;
      this.bindCompanionSliderEvents(sliderRefs.slider, sliderRefs.valueDisplay);
      harmonyContent.appendChild(companionSection);
    }

    // Collapsible: Dye Filters - uses shared builder
    const filtersContainer = this.createElement('div');
    drawer.appendChild(filtersContainer);
    const filtersRefs = this.buildFiltersPanel(filtersContainer, 'harmony_filters_drawer');
    this.drawerFiltersPanel = filtersRefs.panel;
    this.drawerDyeFilters = filtersRefs.filters;

    // Collapsible: Market Board - uses shared builder
    const marketContainer = this.createElement('div');
    drawer.appendChild(marketContainer);
    const marketRefs = this.buildMarketPanel(marketContainer, 'harmony_market_drawer');
    this.drawerMarketPanel = marketRefs.panel;
    this.drawerMarketBoard = marketRefs.marketBoard;
  }

  // WEB-REF-003 Phase 2: renderDrawerBaseDyePanel, renderDrawerDyeSelector,
  // updateDrawerCurrentDyeDisplay, renderDrawerHarmonyTypePanel, renderDrawerHarmonyTypeSelector,
  // selectHarmonyTypeFromDrawer, renderDrawerCompanionSlider, renderDrawerFiltersPanel,
  // and renderDrawerMarketPanel removed - now using shared builders in renderDrawerContent

  /**
   * Update drawer content - no longer needed since drawer has full interactive controls
   * Kept for backwards compatibility but now just syncs the current dye display
   */
  private updateDrawerContent(): void {
    // The drawer now has full interactive controls that sync via state
    // No need to rebuild the entire drawer content on every change
  }

  // ============================================================================
  // Harmony Generation
  // ============================================================================

  /**
   * Generate harmony results for the SELECTED harmony type only
   * Displays Base panel + Harmony 1, 2, etc. panels
   */
  private generateHarmonies(): void {
    if (!this.selectedDye || !this.harmonyGridContainer) {
      this.showEmptyState(true);
      return;
    }

    this.showEmptyState(false);

    // Clear existing result panels
    for (const panel of this.resultPanels) {
      panel.destroy();
    }
    this.resultPanels = [];
    this.v4ResultCards = []; // Clear v4 card references
    clearContainer(this.harmonyGridContainer);

    // Update color wheel
    this.renderColorWheel();

    // Get offsets for the SELECTED harmony type only
    const offsets = HARMONY_OFFSETS[this.selectedHarmonyType] || [];
    const baseHsv = ColorService.hexToHsv(this.selectedDye.hex);
    const allDyes = dyeService.getAllDyes();

    // Render Base panel (no closest dyes section)
    this.renderResultPanel({
      label: LanguageService.t('harmony.base'),
      matchedDye: this.selectedDye,
      targetColor: this.selectedDye.hex,
      deviance: 0,
      closestDyes: [],
      isBase: true,
    });

    // Render Harmony panels for each offset in the selected harmony type
    offsets.forEach((offset, index) => {
      const targetHue = (baseHsv.h + offset) % 360;
      const targetColor = ColorService.hsvToHex(targetHue, baseHsv.s, baseHsv.v);

      // Get extra candidates to allow for filter replacements, then apply filters
      let matches = this.findClosestDyesToHueInternal(allDyes, targetHue, this.companionDyesCount + 10);
      matches = this.replaceExcludedDyesInternal(matches, targetHue);

      // Use swapped dye if user has selected one, otherwise use best match
      const swappedDye = this.swappedDyes.get(index);
      const displayDye = swappedDye || matches[0].dye;
      const deviance = swappedDye
        ? calculateHueDeviance(swappedDye, targetHue)
        : matches[0].deviance;

      // Closest dyes excludes the currently displayed dye
      const closestDyes = matches
        .filter((m) => m.dye.itemID !== displayDye.itemID)
        .slice(0, this.companionDyesCount)
        .map((m) => m.dye);

      this.renderResultPanel({
        label: `${LanguageService.t('harmony.harmony')} ${index + 1}`,
        matchedDye: displayDye,
        targetColor,
        deviance,
        closestDyes,
        isBase: false,
        harmonyIndex: index,
        onSwapDye: (dye) => this.handleSwapDye(index, dye),
      });
    });

    logger.info(
      '[HarmonyTool] Generated harmonies for:',
      this.selectedDye.name,
      'type:',
      this.selectedHarmonyType
    );

    // Update share button with current params
    this.updateShareButton();

    // Fetch prices for displayed dyes if prices are enabled
    if (this.showPrices) {
      this.fetchPricesForDisplayedDyes();
    }
  }

  /**
   * Render an individual result panel (Base or Harmony N) using v4-result-card
   */
  private renderResultPanel(options: {
    label: string;
    matchedDye: Dye;
    targetColor: string;
    deviance: number;
    closestDyes: Dye[];
    isBase: boolean;
    harmonyIndex?: number;
    onSwapDye?: (dye: Dye) => void;
  }): void {
    if (!this.harmonyGridContainer) return;

    // Create v4-result-card custom element
    const card = document.createElement('v4-result-card') as ResultCard;

    // Get price data for this dye
    const priceInfo = this.priceData.get(options.matchedDye.itemID);

    // Calculate Delta-E between target color and matched dye
    const deltaE =
      ColorService.getDeltaE?.(options.targetColor, options.matchedDye.hex) ?? undefined;

    // Get market server name - prefer worldId from price data (actual listing location)
    // Fall back to selected server if worldId not available or can't be resolved
    let marketServer: string | undefined;
    if (priceInfo?.worldId) {
      // Resolve worldId to world name (e.g., 34 -> "Brynhildr")
      marketServer = WorldService.getWorldName(priceInfo.worldId);
    }
    if (!marketServer) {
      // Fall back to selected server (data center name)
      marketServer = this.marketBoard?.getSelectedServer?.();
    }

    // Build ResultCardData
    const cardData: ResultCardData = {
      dye: options.matchedDye,
      originalColor: options.targetColor,
      matchedColor: options.matchedDye.hex,
      deltaE: deltaE,
      hueDeviance: options.deviance,
      matchingMethod: this.matchingMethod,
      marketServer: marketServer,
      price: this.showPrices && priceInfo ? priceInfo.currentAverage : undefined,
      vendorCost: options.matchedDye.cost,
    };

    card.data = cardData;
    card.setAttribute('data-harmony-panel', options.label);

    // Set display options from tool state
    card.showHex = this.displayOptions.showHex;
    card.showRgb = this.displayOptions.showRgb;
    card.showHsv = this.displayOptions.showHsv;
    card.showLab = this.displayOptions.showLab;
    card.showDeltaE = this.displayOptions.showDeltaE;
    card.showPrice = this.displayOptions.showPrice;
    card.showAcquisition = this.displayOptions.showAcquisition;

    // Handle card selection - set as new base dye and regenerate harmonies
    card.addEventListener('card-select', ((e: CustomEvent<{ dye: Dye }>) => {
      logger.info(`[HarmonyTool] Card selected: ${e.detail.dye.name}`);
      this.selectDye(e.detail.dye);
    }) as EventListener);

    // Handle context menu actions
    card.addEventListener('context-action', ((
      e: CustomEvent<{ action: ContextAction; dye: Dye }>
    ) => {
      this.handleContextAction(e.detail.action, e.detail.dye);
    }) as EventListener);

    // Store reference for later price updates
    this.v4ResultCards.push(card);

    this.harmonyGridContainer.appendChild(card);
  }

  /**
   * Handle context menu action from v4-result-card
   */
  private handleContextAction(action: ContextAction, dye: Dye): void {
    logger.info(`[HarmonyTool] Context action: ${action} for dye: ${dye.name}`);

    switch (action) {
      case 'add-comparison':
        RouterService.navigateTo('comparison', { add: String(dye.itemID) });
        break;
      case 'add-mixer':
        RouterService.navigateTo('mixer', { add: String(dye.itemID) });
        break;
      case 'add-accessibility':
        RouterService.navigateTo('accessibility', { add: String(dye.itemID) });
        break;
      case 'see-harmonies':
        // Select this dye as base and regenerate harmonies
        this.selectDye(dye);
        break;
      case 'budget':
        RouterService.navigateTo('budget', { base: dye.hex.replace('#', '') });
        break;
      case 'copy-hex':
        navigator.clipboard.writeText(dye.hex).then(() => {
          logger.info(`[HarmonyTool] Copied hex: ${dye.hex}`);
        });
        break;
    }
  }

  /**
   * Handle swap dye action from result panel
   */
  private handleSwapDye(harmonyIndex: number, dye: Dye): void {
    this.swappedDyes.set(harmonyIndex, dye);
    this.generateHarmonies(); // Re-render with new selection
  }

  // ============================================================================
  // Harmony Generation Logic
  // WEB-REF-003 FIX: Core algorithms delegated to @services/harmony-generator
  // (~200 lines extracted to reduce component size)
  // ============================================================================

  /**
   * Build harmony config from current tool state
   */
  private getHarmonyConfig(): HarmonyConfig {
    return {
      usePerceptualMatching: this.usePerceptualMatching,
      matchingMethod: this.matchingMethod,
      companionDyesCount: this.companionDyesCount,
    };
  }

  /**
   * Find dyes closest to a target hue (delegated to harmony-generator)
   */
  private findClosestDyesToHueInternal(
    dyes: Dye[],
    targetHue: number,
    count: number
  ): ScoredDyeMatch[] {
    return findClosestDyesToHue(dyes, targetHue, count, this.getHarmonyConfig(), this.selectedDye);
  }

  /**
   * Replace excluded dyes with alternatives (delegated to harmony-generator)
   */
  private replaceExcludedDyesInternal(
    dyes: ScoredDyeMatch[],
    targetHue: number
  ): ScoredDyeMatch[] {
    return replaceExcludedDyes(dyes, targetHue, this.dyeFilters, this.filterConfig);
  }

  /**
   * Find matching dyes for a specific harmony type (delegated to harmony-generator)
   */
  private findHarmonyDyesInternal(typeId: string): ScoredDyeMatch[] {
    if (!this.selectedDye) return [];
    return findHarmonyDyes(
      this.selectedDye,
      typeId,
      this.getHarmonyConfig(),
      this.dyeFilters,
      this.filterConfig
    );
  }

  /**
   * Get matched dyes for the current harmony type (for color wheel)
   */
  private getMatchedDyesForCurrentHarmony(): Dye[] {
    const matches = this.findHarmonyDyesInternal(this.selectedHarmonyType);
    return matches.map((m) => m.dye);
  }

  /**
   * Show/hide empty state
   */
  private showEmptyState(show: boolean): void {
    if (this.emptyStateContainer) {
      this.emptyStateContainer.style.display = show ? 'flex' : 'none';
    }
    if (this.resultsSection) {
      this.resultsSection.style.display = show ? 'none' : 'block';
    }
    // Update share button state
    this.updateShareButton();
  }

  /**
   * Update price data on harmony displays and result panels
   */
  private updateHarmonyDisplayPrices(): void {
    for (const display of this.harmonyDisplays.values()) {
      display.setPriceData(this.priceData);
    }
    for (const panel of this.resultPanels) {
      panel.setPriceData(this.priceData);
    }
  }

  /**
   * Fetch prices for all displayed dyes (base + harmony dyes)
   * Called when prices are enabled, server changes, or categories change
   * Delegates to MarketBoardService which handles race condition protection
   */
  private async fetchPricesForDisplayedDyes(): Promise<void> {
    if (!this.showPrices || !this.selectedDye) {
      return;
    }

    // Collect all dyes that need price fetching
    const dyesToFetch: Dye[] = [this.selectedDye];

    // Get harmony dyes from the current harmony type
    const offsets = HARMONY_OFFSETS[this.selectedHarmonyType] || [];
    const baseHsv = ColorService.hexToHsv(this.selectedDye.hex);
    const allDyes = dyeService.getAllDyes();

    for (let i = 0; i < offsets.length; i++) {
      const offset = offsets[i];
      const targetHue = (baseHsv.h + offset) % 360;

      // Get matches (same logic as generateHarmonies)
      let matches = this.findClosestDyesToHueInternal(allDyes, targetHue, this.companionDyesCount + 10);
      matches = this.replaceExcludedDyesInternal(matches, targetHue);

      // Use swapped dye if available, otherwise best match
      const swappedDye = this.swappedDyes.get(i);
      const displayDye = swappedDye || matches[0]?.dye;

      if (displayDye) {
        dyesToFetch.push(displayDye);
      }

      // Also add closest dyes (companion dyes)
      const closestDyes = matches
        .filter((m) => displayDye && m.dye.itemID !== displayDye.itemID)
        .slice(0, this.companionDyesCount)
        .map((m) => m.dye);

      dyesToFetch.push(...closestDyes);
    }

    // Fetch prices via MarketBoardService (handles race conditions internally)
    try {
      const prices = await this.marketBoardService.fetchPricesForDyes(dyesToFetch);

      // Always update UI after fetch completes (even if empty/stale)
      // This ensures cards reflect current state when server changes
      this.updateHarmonyDisplayPrices();
      this.updateV4ResultCardPrices();
      logger.info(`[HarmonyTool] Fetched prices for ${prices.size} dyes`);
    } catch (error) {
      logger.error('[HarmonyTool] Failed to fetch prices:', error);
    }
  }

  /**
   * Update v4 result cards with newly fetched price data
   * Called after fetchPricesForDisplayedDyes() completes
   */
  private updateV4ResultCardPrices(): void {
    for (const card of this.v4ResultCards) {
      const currentData = card.data;
      if (!currentData?.dye) continue;

      const priceInfo = this.priceData.get(currentData.dye.itemID);

      // Resolve worldId to world name via MarketBoardService
      const marketServer = this.marketBoardService.getWorldNameForPrice(priceInfo);

      // Update card data with new price info (triggers Lit re-render)
      card.data = {
        dye: currentData.dye,
        originalColor: currentData.originalColor,
        matchedColor: currentData.matchedColor,
        deltaE: currentData.deltaE,
        hueDeviance: currentData.hueDeviance,
        vendorCost: currentData.vendorCost,
        price: this.showPrices && priceInfo ? priceInfo.currentAverage : undefined,
        marketServer: marketServer,
      };
    }
  }

  // ============================================================================
  // Export Functionality
  // ============================================================================

  private handleExport(): void {
    if (!this.selectedDye) {
      logger.warn('[HarmonyTool] No dye selected for export');
      return;
    }

    const matchedDyes = this.getMatchedDyesForCurrentHarmony();
    const paletteData: PaletteData = {
      base: this.selectedDye,
      groups: {
        [this.selectedHarmonyType]: matchedDyes,
      },
      metadata: {
        harmonyType: this.selectedHarmonyType,
        generatedAt: new Date().toISOString(),
      },
    };

    // For now, just log - full export implementation deferred
    logger.info('[HarmonyTool] Export palette:', paletteData);

    // TODO: Integrate PaletteExporter component
    // this.paletteExporter?.exportPalette(paletteData);
  }

  // ============================================================================
  // Share Functionality
  // ============================================================================

  /**
   * Get current share parameters for the share button
   */
  private getShareParams(): Record<string, unknown> {
    if (!this.selectedDye) {
      return {};
    }

    return {
      dye: this.selectedDye.itemID,
      harmony: this.selectedHarmonyType,
      algo: this.matchingMethod,
      perceptual: this.usePerceptualMatching,
    };
  }

  /**
   * Update share button parameters when state changes
   */
  private updateShareButton(): void {
    if (this.shareButton) {
      this.shareButton.shareParams = this.getShareParams();
      // Disable share button if no dye selected
      this.shareButton.disabled = !this.selectedDye;
    }
  }

  // ============================================================================
  // V4 Config Integration
  // ============================================================================

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   * This method allows the V4 layout to control tool settings.
   *
   * @param config Partial HarmonyConfig with updated values
   */
  public setConfig(
    config: Partial<{
      harmonyType: string;
      showNames: boolean;
      showHex: boolean;
      showRgb: boolean;
      showHsv: boolean;
      strictMatching: boolean;
    }>
  ): void {
    let needsRerender = false;

    // Handle harmony type change
    if (config.harmonyType !== undefined && config.harmonyType !== this.selectedHarmonyType) {
      this.selectedHarmonyType = config.harmonyType;
      StorageService.setItem(STORAGE_KEYS.harmonyType, config.harmonyType);
      this.swappedDyes.clear();
      needsRerender = true;
      logger.info(`[HarmonyTool] setConfig: harmonyType -> ${config.harmonyType}`);
    }

    // Handle perceptual matching (strictMatching) change
    // Note: This is now handled by ConfigController subscription in onMount()
    // which triggers regenerateHarmonies() with the updated usePerceptualMatching flag
    if (config.strictMatching !== undefined) {
      logger.info(`[HarmonyTool] setConfig: strictMatching -> ${config.strictMatching}`);
    }

    // Handle display option changes (showNames, showHex, showRgb, showHsv)
    // These would require updating result panel rendering
    // For now, log them - full integration in Phase 8
    if (config.showNames !== undefined) {
      logger.debug(`[HarmonyTool] setConfig: showNames -> ${config.showNames}`);
    }
    if (config.showHex !== undefined) {
      logger.debug(`[HarmonyTool] setConfig: showHex -> ${config.showHex}`);
    }
    if (config.showRgb !== undefined) {
      logger.debug(`[HarmonyTool] setConfig: showRgb -> ${config.showRgb}`);
    }
    if (config.showHsv !== undefined) {
      logger.debug(`[HarmonyTool] setConfig: showHsv -> ${config.showHsv}`);
    }

    // Re-render if needed
    if (needsRerender && this.selectedDye) {
      this.generateHarmonies();
      this.updateDrawerContent();

      // Update harmony type buttons if they exist (shared method handles null containers)
      this.updateHarmonyTypeButtonStyles(this.harmonyTypesContainer, this.selectedHarmonyType);
      this.updateHarmonyTypeButtonStyles(this.drawerHarmonyTypesContainer, this.selectedHarmonyType);
    }
  }

  /**
   * Clear all dye selections and return to empty state.
   * Called when "Clear All Dyes" button is clicked in Color Palette.
   */
  public clearDyes(): void {
    this.selectedDye = null;

    // Clear from storage
    StorageService.removeItem(STORAGE_KEYS.selectedDyeId);
    logger.info('[HarmonyTool] All dyes cleared');

    // Update dye selectors
    this.dyeSelector?.setSelectedDyes([]);
    this.drawerDyeSelector?.setSelectedDyes([]);

    // Clear harmony results grid
    if (this.harmonyGridContainer) {
      clearContainer(this.harmonyGridContainer);
    }

    // Show empty state
    this.showEmptyState(true);
    this.renderColorWheel();
    this.updateDrawerContent();
  }

  /**
   * Select a dye from external source (Color Palette drawer)
   * Sets the dye as the base color and updates the UI.
   *
   * @param dye The dye to select as the base color
   */
  public selectDye(dye: Dye): void {
    if (!dye) return;

    this.selectedDye = dye;

    // Persist to storage
    StorageService.setItem(STORAGE_KEYS.selectedDyeId, dye.itemID);
    logger.info(`[HarmonyTool] External dye selected: ${dye.name} (itemID=${dye.itemID})`);

    // Update the DyeSelector if it exists
    if (this.dyeSelector) {
      this.dyeSelector.setSelectedDyes([dye]);
    }

    // Generate harmonies and update UI
    this.generateHarmonies();
    this.updateDrawerContent();
  }

  /**
   * Select a custom color from hex input (Color Palette drawer)
   * Creates a virtual dye from the hex color for harmony generation.
   *
   * @param hex The hex color code (e.g., '#FF5500')
   */
  public selectCustomColor(hex: string): void {
    if (!hex) return;

    // Create a virtual "dye" object for the custom color
    // Using negative ID to distinguish from real dyes
    const virtualDye: Dye = {
      id: -1,
      itemID: -1,
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

    this.selectedDye = virtualDye;

    // Clear from storage (custom colors are not persisted)
    StorageService.removeItem(STORAGE_KEYS.selectedDyeId);
    logger.info(`[HarmonyTool] Custom color selected: ${hex}`);

    // Clear dye selector selection (custom color is not in the list)
    if (this.dyeSelector) {
      this.dyeSelector.setSelectedDyes([]);
    }

    // Generate harmonies and update UI
    this.generateHarmonies();
    this.updateDrawerContent();
  }
}
