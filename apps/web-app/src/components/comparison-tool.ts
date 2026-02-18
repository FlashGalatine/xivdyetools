/**
 * XIV Dye Tools v3.0.0 - Comparison Tool Component
 *
 * Phase 5: Dye Comparison migration to v3 two-panel layout.
 * Orchestrates dye comparison with visual charts and distance matrix.
 *
 * Left Panel: Dye selector (up to 4), comparison options
 * Right Panel: Statistics summary, Hue-Saturation plot, Brightness chart, Distance matrix
 *
 * @module components/tools/comparison-tool
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { DyeSelector } from '@components/dye-selector';
import { MarketBoard } from '@components/market-board';
import { ResultCard, type ResultCardData } from '@components/v4/result-card';
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import {
  ColorService,
  ConfigController,
  DyeService,
  LanguageService,
  MarketBoardService,
  StorageService,
  WorldService,
} from '@services/index';
import { ICON_TOOL_COMPARISON } from '@shared/tool-icons';
import { ICON_BEAKER, ICON_SETTINGS, ICON_MARKET } from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye } from '@shared/types';
import type { ComparisonConfig } from '@shared/tool-config-types';
import '@components/v4/share-button';
import type { ShareButton } from '@components/v4/share-button';
import { ShareService } from '@services/share-service';

// ============================================================================
// Types and Constants
// ============================================================================

export interface ComparisonToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Comparison options state
 */
interface ComparisonOptions {
  showDistanceValues: boolean;
  highlightClosestPair: boolean;
  showHex: boolean;
  showRgb: boolean;
  showHsv: boolean;
  showLab: boolean;
  showMarketPrices: boolean;
}

/**
 * Dye with HSV values for charting
 */
interface DyeWithHSV {
  dye: Dye;
  h: number;
  s: number;
  v: number;
}

/**
 * Statistics summary
 */
interface ComparisonStats {
  avgSaturation: number;
  avgBrightness: number;
  hueRange: number;
  avgDistance: number;
}

/**
 * Storage keys for v3 comparison tool
 */
const STORAGE_KEYS = {
  showDistanceValues: 'v3_comparison_show_distance',
  highlightClosestPair: 'v3_comparison_highlight_closest',
  selectedDyes: 'v3_comparison_selected_dyes',
  showHex: 'v3_comparison_show_hex',
  showRgb: 'v3_comparison_show_rgb',
  showHsv: 'v3_comparison_show_hsv',
  showLab: 'v3_comparison_show_lab',
  showMarketPrices: 'v3_comparison_show_prices',
} as const;

/**
 * Default comparison options
 */
const DEFAULT_OPTIONS: ComparisonOptions = {
  showDistanceValues: true,
  highlightClosestPair: false,
  showHex: true,
  showRgb: true,
  showHsv: false,
  showLab: false,
  showMarketPrices: true,
};

// ============================================================================
// ComparisonTool Component
// ============================================================================

/**
 * Comparison Tool - v3 Two-Panel Layout
 *
 * Compares up to 4 selected dyes with visual charts and distance analysis.
 */
export class ComparisonTool extends BaseComponent {
  private options: ComparisonToolOptions;

  // State
  private selectedDyes: Dye[] = [];
  private dyesWithHSV: DyeWithHSV[] = [];
  private comparisonOptions: ComparisonOptions;
  private stats: ComparisonStats | null = null;
  private closestPair: [number, number] | null = null;

  // Child components
  private dyeSelector: DyeSelector | null = null;
  private dyeSelectorPanel: CollapsiblePanel | null = null;
  private optionsPanel: CollapsiblePanel | null = null;
  private marketBoard: MarketBoard | null = null;
  private marketPanel: CollapsiblePanel | null = null;
  private shareButton: ShareButton | null = null;

  // Mobile drawer components
  private drawerDyeSelector: DyeSelector | null = null;
  private drawerDyeSelectorPanel: CollapsiblePanel | null = null;
  private drawerOptionsPanel: CollapsiblePanel | null = null;
  private drawerMarketBoard: MarketBoard | null = null;
  private drawerMarketPanel: CollapsiblePanel | null = null;
  private drawerSelectedDyesContainer: HTMLElement | null = null;

  // DOM References
  private selectedDyesContainer: HTMLElement | null = null;
  private optionsContainer: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private statsContainer: HTMLElement | null = null;
  private chartsContainer: HTMLElement | null = null;
  private matrixContainer: HTMLElement | null = null;

  // Section wrappers for visibility toggling
  private selectedDyesSection: HTMLElement | null = null;
  private statsSection: HTMLElement | null = null;
  private chartsSection: HTMLElement | null = null;
  private matrixSection: HTMLElement | null = null;

  // Subscriptions
  private languageUnsubscribe: (() => void) | null = null;
  private configUnsubscribe: (() => void) | null = null;
  private marketBoardEventCleanup: (() => void) | null = null;

  constructor(container: HTMLElement, options: ComparisonToolOptions) {
    super(container);
    this.options = options;

    // Load persisted options
    this.comparisonOptions = {
      showDistanceValues:
        StorageService.getItem<boolean>(STORAGE_KEYS.showDistanceValues) ??
        DEFAULT_OPTIONS.showDistanceValues,
      highlightClosestPair:
        StorageService.getItem<boolean>(STORAGE_KEYS.highlightClosestPair) ??
        DEFAULT_OPTIONS.highlightClosestPair,
      showHex: StorageService.getItem<boolean>(STORAGE_KEYS.showHex) ?? DEFAULT_OPTIONS.showHex,
      showRgb: StorageService.getItem<boolean>(STORAGE_KEYS.showRgb) ?? DEFAULT_OPTIONS.showRgb,
      showHsv: StorageService.getItem<boolean>(STORAGE_KEYS.showHsv) ?? DEFAULT_OPTIONS.showHsv,
      showLab: StorageService.getItem<boolean>(STORAGE_KEYS.showLab) ?? DEFAULT_OPTIONS.showLab,
      showMarketPrices:
        StorageService.getItem<boolean>(STORAGE_KEYS.showMarketPrices) ??
        DEFAULT_OPTIONS.showMarketPrices,
    };
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
    this.configUnsubscribe = ConfigController.getInstance().subscribe('comparison', (config) => {
      this.setConfig(config);
    });

    // Load from share URL first, then fall back to persisted dyes
    const loadedFromUrl = this.loadFromShareUrl();
    if (!loadedFromUrl) {
      // Load persisted dyes after DyeSelector is initialized
      this.loadPersistedDyes();
    }

    // Set initial charts layout and listen for viewport changes
    this.updateChartsLayout();
    this.on(window, 'resize', this.updateChartsLayout);

    logger.info('[ComparisonTool] Mounted');
  }

  /**


  /**
   * Fetch prices for selected dyes and update display
   */
  private async fetchAndUpdatePrices(): Promise<void> {
    if (!this.comparisonOptions.showMarketPrices || this.selectedDyes.length === 0) {
      return;
    }

    const marketBoardService = MarketBoardService.getInstance();
    await marketBoardService.fetchPricesForDyes(this.selectedDyes);
    // Always update cards after fetch completes (even if stale/empty)
    // The 'prices-updated' event only fires for successful fetches,
    // so we need to explicitly render here to handle discarded requests
    this.renderSelectedDyesCards();
  }

  /**
   * Load persisted dyes from LocalStorage
   */
  private loadPersistedDyes(): void {
    const savedIds = StorageService.getItem<number[]>(STORAGE_KEYS.selectedDyes);
    if (savedIds && savedIds.length > 0 && this.dyeSelector) {
      const dyeService = DyeService.getInstance();
      const dyes = savedIds
        .map((id) => dyeService.getDyeById(id))
        .filter((d): d is Dye => d !== undefined);

      if (dyes.length > 0) {
        this.dyeSelector.setSelectedDyes(dyes);
        this.selectedDyes = dyes;
        this.calculateHSVValues();
        this.updateSelectedDyesDisplay();
        this.updateResults();
        this.updateDrawerSelectedDyesDisplay();
        this.updateShareButton(); // Enable share button after loading persisted dyes
        // Fetch prices for loaded dyes if Market Board is enabled
        if (this.comparisonOptions.showMarketPrices) {
          this.fetchAndUpdatePrices();
        }
        logger.info(`[ComparisonTool] Loaded ${dyes.length} persisted dyes`);
      }
    }
  }

  /**
   * Save selected dyes to LocalStorage
   */
  private saveSelectedDyes(): void {
    const dyeIds = this.selectedDyes.map((d) => d.id);
    StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);
  }

  destroy(): void {
    this.languageUnsubscribe?.();
    this.configUnsubscribe?.();
    this.marketBoardEventCleanup?.();
    this.dyeSelector?.destroy();
    this.dyeSelectorPanel?.destroy();
    this.optionsPanel?.destroy();
    this.marketBoard?.destroy();
    this.marketPanel?.destroy();

    // Clean up drawer components
    this.drawerDyeSelector?.destroy();
    this.drawerDyeSelectorPanel?.destroy();
    this.drawerOptionsPanel?.destroy();
    this.drawerMarketBoard?.destroy();
    this.drawerMarketPanel?.destroy();

    this.selectedDyes = [];
    this.dyesWithHSV = [];

    super.destroy();
    logger.info('[ComparisonTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   * Now reads all settings from displayOptions (refactored from individual fields)
   */
  public setConfig(config: Partial<ComparisonConfig>): void {
    let needsRerender = false;

    // Handle displayOptions from v4-display-options component
    // Note: ComparisonTool uses custom property mapping (showDeltaE→showDistanceValues,
    // showPrice→showMarketPrices) so we handle these explicitly rather than using
    // the shared applyDisplayOptions helper which expects standard DisplayOptionsConfig.
    if (config.displayOptions) {
      const opts = config.displayOptions;

      // Map displayOptions to internal comparisonOptions
      if (opts.showHex !== undefined && opts.showHex !== this.comparisonOptions.showHex) {
        this.comparisonOptions.showHex = opts.showHex;
        StorageService.setItem(STORAGE_KEYS.showHex, opts.showHex);
        needsRerender = true;
        logger.info(`[ComparisonTool] setConfig: displayOptions.showHex -> ${opts.showHex}`);
      }
      if (opts.showRgb !== undefined && opts.showRgb !== this.comparisonOptions.showRgb) {
        this.comparisonOptions.showRgb = opts.showRgb;
        StorageService.setItem(STORAGE_KEYS.showRgb, opts.showRgb);
        needsRerender = true;
        logger.info(`[ComparisonTool] setConfig: displayOptions.showRgb -> ${opts.showRgb}`);
      }
      if (opts.showHsv !== undefined && opts.showHsv !== this.comparisonOptions.showHsv) {
        this.comparisonOptions.showHsv = opts.showHsv;
        StorageService.setItem(STORAGE_KEYS.showHsv, opts.showHsv);
        needsRerender = true;
        logger.info(`[ComparisonTool] setConfig: displayOptions.showHsv -> ${opts.showHsv}`);
      }
      if (opts.showLab !== undefined && opts.showLab !== this.comparisonOptions.showLab) {
        this.comparisonOptions.showLab = opts.showLab;
        StorageService.setItem(STORAGE_KEYS.showLab, opts.showLab);
        needsRerender = true;
        logger.info(`[ComparisonTool] setConfig: displayOptions.showLab -> ${opts.showLab}`);
      }

      // Map showDeltaE to internal showDistanceValues
      if (
        opts.showDeltaE !== undefined &&
        opts.showDeltaE !== this.comparisonOptions.showDistanceValues
      ) {
        this.comparisonOptions.showDistanceValues = opts.showDeltaE;
        StorageService.setItem(STORAGE_KEYS.showDistanceValues, opts.showDeltaE);
        needsRerender = true;
        logger.info(`[ComparisonTool] setConfig: displayOptions.showDeltaE -> ${opts.showDeltaE}`);
      }

      // Map showPrice to internal showMarketPrices
      if (
        opts.showPrice !== undefined &&
        opts.showPrice !== this.comparisonOptions.showMarketPrices
      ) {
        this.comparisonOptions.showMarketPrices = opts.showPrice;
        StorageService.setItem(STORAGE_KEYS.showMarketPrices, opts.showPrice);
        needsRerender = true;
        logger.info(`[ComparisonTool] setConfig: displayOptions.showPrice -> ${opts.showPrice}`);

        // Fetch prices if enabled and we have dyes
        if (this.comparisonOptions.showMarketPrices && this.selectedDyes.length > 0) {
          void this.fetchAndUpdatePrices();
        }
      }

      // Note: showAcquisition is not used by comparison tool (has its own acquisition display)
    }

    // Re-render if config changed and we have dyes selected
    if (needsRerender && this.selectedDyes.length > 0) {
      this.updateResults();
    }
  }

  // ============================================================================
  // Left Panel Rendering
  // ============================================================================

  /**
   * Render left panel content
   */
  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Section 1: Dye Selection (Collapsible)
    const dyeContainer = this.createElement('div');
    left.appendChild(dyeContainer);
    this.dyeSelectorPanel = new CollapsiblePanel(dyeContainer, {
      title: LanguageService.t('comparison.compareDyes'),
      storageKey: 'v3_comparison_dyes',
      defaultOpen: true,
      icon: ICON_BEAKER,
    });
    this.dyeSelectorPanel.init();
    const dyeContent = this.createElement('div');
    this.renderDyeSelector(dyeContent);
    this.dyeSelectorPanel.setContent(dyeContent);

    // Section 2: Options (Collapsible)
    const optionsContainer = this.createElement('div');
    left.appendChild(optionsContainer);
    this.optionsPanel = new CollapsiblePanel(optionsContainer, {
      title: LanguageService.t('common.options'),
      storageKey: 'v3_comparison_options',
      defaultOpen: true,
      icon: ICON_SETTINGS,
    });
    this.optionsPanel.init();
    const optionsContent = this.createElement('div');
    this.renderOptions(optionsContent);
    this.optionsPanel.setContent(optionsContent);

    // Section 3: Market Board (Collapsible)
    const marketContainer = this.createElement('div');
    left.appendChild(marketContainer);
    this.marketPanel = new CollapsiblePanel(marketContainer, {
      title: LanguageService.t('marketBoard.title'),
      storageKey: 'v3_comparison_market',
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    this.marketPanel.init();

    // Create market board content
    // Note: MarketBoard delegates to MarketBoardService for state management
    const marketContent = this.createElement('div');
    this.marketBoard = new MarketBoard(marketContent);
    this.marketBoard.init();

    // Set up market board event listeners using shared utility
    setupMarketBoardListeners(
      marketContent,
      () => this.comparisonOptions.showMarketPrices,
      () => this.fetchAndUpdatePrices(),
      {
        onPricesToggled: () => {
          if (this.comparisonOptions.showMarketPrices) {
            void this.fetchAndUpdatePrices();
          } else {
            // Re-render to hide prices (fetchAndUpdatePrices only fetches if enabled)
            this.renderSelectedDyesCards();
          }
        },
        onServerChanged: () => {
          // Always re-render to update server name on cards, even if price fetch is pending/fails
          this.renderSelectedDyesCards();
          if (this.comparisonOptions.showMarketPrices && this.selectedDyes.length > 0) {
            void this.fetchAndUpdatePrices();
          }
        },
      }
    );

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
   * Create a header for right panel sections (styled like mock-up with golden underline)
   */
  private createHeader(text: string): HTMLElement {
    const header = this.createElement('div', { className: 'section-header' });
    const title = this.createElement('span', {
      className: 'section-title',
      textContent: text,
    });
    header.appendChild(title);
    return header;
  }

  /**
   * Render dye selector section
   */
  private renderDyeSelector(container: HTMLElement): void {
    const dyeContainer = this.createElement('div', { className: 'space-y-3' });

    // Show selected dyes
    this.selectedDyesContainer = this.createElement('div', {
      className: 'selected-dyes-display space-y-2',
    });
    this.updateSelectedDyesDisplay();
    dyeContainer.appendChild(this.selectedDyesContainer);

    // Dye selector component
    const selectorContainer = this.createElement('div');
    dyeContainer.appendChild(selectorContainer);

    this.dyeSelector = new DyeSelector(selectorContainer, {
      maxSelections: 4,
      allowMultiple: true,
      allowDuplicates: false,
      showCategories: true,
      showPrices: false,
      excludeFacewear: true,
      showFavorites: true,
      compactMode: true,
      hideSelectedChips: true, // Selections shown above in dedicated display
    });
    this.dyeSelector.init();

    // Listen for selection changes
    selectorContainer.addEventListener('selection-changed', () => {
      if (this.dyeSelector) {
        this.selectedDyes = this.dyeSelector.getSelectedDyes();
        this.calculateHSVValues();
        this.updateSelectedDyesDisplay();
        this.updateResults();
        this.updateDrawerSelectedDyesDisplay();
        this.saveSelectedDyes();
        this.updateShareButton();
        // Fetch prices for newly selected dyes if Market Board is enabled
        if (this.comparisonOptions.showMarketPrices && this.selectedDyes.length > 0) {
          void this.fetchAndUpdatePrices();
        }
      }
    });

    container.appendChild(dyeContainer);
  }

  /**
   * Update the selected dyes display
   */
  private updateSelectedDyesDisplay(): void {
    if (!this.selectedDyesContainer) return;
    clearContainer(this.selectedDyesContainer);

    if (this.selectedDyes.length === 0) {
      const placeholder = this.createElement('div', {
        className: 'p-3 rounded-lg border-2 border-dashed text-center text-sm',
        textContent:
          LanguageService.t('comparison.selectDyesToCompare'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      this.selectedDyesContainer.appendChild(placeholder);
      return;
    }

    for (const dye of this.selectedDyes) {
      const dyeItem = this.createElement('div', {
        className: 'flex items-center gap-3 p-2 rounded-lg',
        attributes: { style: 'background: var(--theme-background-secondary);' },
      });

      const swatch = this.createElement('div', {
        className: 'w-8 h-8 rounded border',
        attributes: {
          style: `background: ${dye.hex}; border-color: var(--theme-border);`,
        },
      });

      const name = this.createElement('span', {
        className: 'flex-1 text-sm font-medium truncate',
        textContent: LanguageService.getDyeName(dye.itemID) || dye.name,
        attributes: { style: 'color: var(--theme-text);' },
      });

      const removeBtn = this.createElement('button', {
        className: 'text-xs px-2 py-1 rounded transition-colors',
        textContent: '\u00D7',
        attributes: {
          style: 'background: var(--theme-card-hover); color: var(--theme-text-muted);',
        },
      });

      this.on(removeBtn, 'click', () => {
        this.removeDye(dye);
      });

      dyeItem.appendChild(swatch);
      dyeItem.appendChild(name);
      dyeItem.appendChild(removeBtn);
      this.selectedDyesContainer.appendChild(dyeItem);
    }

    // Add dye button if under max
    if (this.selectedDyes.length < 4) {
      const addBtn = this.createElement('button', {
        className: 'w-full p-3 rounded-lg border-2 border-dashed text-sm',
        textContent: `+ ${LanguageService.t('comparison.addDye')}`,
        attributes: { style: 'border-color: var(--theme-border); color: var(--theme-text-muted);' },
      });
      // The DyeSelector below handles actual adding
      this.selectedDyesContainer.appendChild(addBtn);
    }
  }

  /**
   * Render comparison options with Color Formats
   */
  private renderOptions(container: HTMLElement): void {
    this.optionsContainer = this.createElement('div', { className: 'space-y-4' });

    // === COLOR FORMATS SECTION ===
    const colorFormatsSection = this.createOptionsSection(
      LanguageService.t('config.colorFormats')
    );
    const colorFormatsOptions = [
      { key: 'showHex' as const, label: LanguageService.t('config.hexCodes') },
      { key: 'showRgb' as const, label: LanguageService.t('config.rgbValues') },
      { key: 'showHsv' as const, label: LanguageService.t('config.hsvValues') },
    ];
    for (const option of colorFormatsOptions) {
      colorFormatsSection.content.appendChild(this.createToggleRow(option.key, option.label));
    }
    this.optionsContainer.appendChild(colorFormatsSection.wrapper);

    // === COMPARISON OPTIONS SECTION ===
    const comparisonSection = this.createOptionsSection(
      LanguageService.t('comparison.comparisonOptions')
    );
    const comparisonOptions = [
      {
        key: 'showDistanceValues' as const,
        label: LanguageService.t('comparison.showDistanceValues'),
      },
      {
        key: 'highlightClosestPair' as const,
        label: LanguageService.t('comparison.highlightClosestPair'),
      },
    ];
    for (const option of comparisonOptions) {
      comparisonSection.content.appendChild(this.createToggleRow(option.key, option.label));
    }
    this.optionsContainer.appendChild(comparisonSection.wrapper);

    container.appendChild(this.optionsContainer);
  }

  /**
   * Create an options section with header and content container
   */
  private createOptionsSection(title: string): { wrapper: HTMLElement; content: HTMLElement } {
    const wrapper = this.createElement('div', {
      attributes: {
        style: `
          background: rgba(0, 0, 0, 0.2);
          border-radius: 8px;
          padding: 12px;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    const header = this.createElement('div', {
      className: 'text-xs font-medium mb-2',
      textContent: title,
      attributes: {
        style: `
          color: var(--theme-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    const content = this.createElement('div', { className: 'space-y-2' });

    wrapper.appendChild(header);
    wrapper.appendChild(content);

    return { wrapper, content };
  }

  /**
   * Create a toggle row with V4-style switch
   */
  private createToggleRow(key: keyof ComparisonOptions, label: string): HTMLElement {
    const row = this.createElement('label', {
      className: 'flex items-center justify-between cursor-pointer',
    });

    const text = this.createElement('span', {
      className: 'text-sm',
      textContent: label,
      attributes: { style: 'color: var(--theme-text);' },
    });

    // V4-style toggle switch container
    const toggleContainer = this.createElement('div', {
      attributes: {
        style: `
          position: relative;
          width: 44px;
          height: 24px;
          flex-shrink: 0;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    const checkbox = this.createElement('input', {
      attributes: {
        type: 'checkbox',
        'data-option': key,
        style: 'opacity: 0; width: 0; height: 0; position: absolute;',
      },
    }) as HTMLInputElement;
    checkbox.checked = this.comparisonOptions[key];

    const slider = this.createElement('div', {
      attributes: {
        style: `
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: ${checkbox.checked ? 'var(--theme-primary)' : 'rgba(255, 255, 255, 0.2)'};
          border-radius: 24px;
          transition: background 0.2s;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    const knob = this.createElement('div', {
      attributes: {
        style: `
          position: absolute;
          content: '';
          height: 18px;
          width: 18px;
          left: ${checkbox.checked ? '23px' : '3px'};
          top: 3px;
          background: white;
          border-radius: 50%;
          transition: left 0.2s;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    slider.appendChild(knob);
    toggleContainer.appendChild(checkbox);
    toggleContainer.appendChild(slider);

    this.on(toggleContainer, 'click', () => {
      checkbox.checked = !checkbox.checked;
      this.comparisonOptions[key] = checkbox.checked;
      StorageService.setItem(STORAGE_KEYS[key], checkbox.checked);

      // Update slider visual
      slider.style.background = checkbox.checked
        ? 'var(--theme-primary)'
        : 'rgba(255, 255, 255, 0.2)';
      knob.style.left = checkbox.checked ? '23px' : '3px';

      // Special handling for Market Board toggle
      if (key === 'showMarketPrices') {
        const marketBoardService = MarketBoardService.getInstance();
        marketBoardService.setShowPrices(checkbox.checked);
        // Fetch prices if enabling and we have dyes selected
        if (checkbox.checked && this.selectedDyes.length > 0) {
          this.fetchAndUpdatePrices();
        }
      }

      this.renderSelectedDyesCards();
      this.updateResults();
    });

    row.appendChild(text);
    row.appendChild(toggleContainer);

    return row;
  }

  /**
   * Populate the server dropdown with data centers and worlds
   */
  private populateServerDropdown(select: HTMLSelectElement): void {
    const dataCenters = WorldService.getAllDataCenters();
    const worlds = WorldService.getAllWorlds();
    const marketBoardService = MarketBoardService.getInstance();
    const currentServer = marketBoardService.getSelectedServer();

    if (dataCenters.length === 0) {
      const option = this.createElement('option', {
        textContent: 'Loading servers...',
        attributes: { value: 'Crystal' },
      });
      select.appendChild(option);
      return;
    }

    // Sort data centers by region then name
    const sortedDCs = [...dataCenters].sort((a, b) => {
      if (a.region !== b.region) return a.region.localeCompare(b.region);
      return a.name.localeCompare(b.name);
    });

    for (const dc of sortedDCs) {
      const optgroup = this.createElement('optgroup', {
        attributes: { label: `${dc.name} (${dc.region})` },
      }) as HTMLOptGroupElement;

      // Data center option (All Worlds)
      const dcOption = this.createElement('option', {
        textContent: `${dc.name} - All Worlds`,
        attributes: { value: dc.name },
      }) as HTMLOptionElement;
      if (currentServer === dc.name) dcOption.selected = true;
      optgroup.appendChild(dcOption);

      // Individual world options
      const dcWorlds = worlds
        .filter((w) => dc.worlds.includes(w.id))
        .sort((a, b) => a.name.localeCompare(b.name));

      for (const world of dcWorlds) {
        const worldOption = this.createElement('option', {
          textContent: `  ${world.name}`,
          attributes: { value: world.name },
        }) as HTMLOptionElement;
        if (currentServer === world.name) worldOption.selected = true;
        optgroup.appendChild(worldOption);
      }

      select.appendChild(optgroup);
    }
  }

  // ============================================================================
  // Right Panel Rendering
  // ============================================================================

  // DOM reference for selected dyes cards in right panel
  private selectedDyesCardsContainer: HTMLElement | null = null;

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Content wrapper with max-width to prevent over-expansion on ultrawide monitors
    const contentWrapper = this.createElement('div', {
      attributes: {
        style: `
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Empty state (shown when < 2 dyes selected)
    this.emptyStateContainer = this.createElement('div');
    this.renderEmptyState();
    contentWrapper.appendChild(this.emptyStateContainer);

    // Selected Dyes Cards Section (V4 result-cards in a horizontal row, centered)
    // Hidden by default via inline style - shown when dyes are selected
    this.selectedDyesSection = this.createElement('div', {
      className: 'mb-6',
      attributes: { style: 'display: none;' },
    });

    // Create header with Share button
    const selectedDyesHeader = this.createElement('div', {
      className: 'section-header',
      attributes: {
        style: 'display: flex; justify-content: space-between; align-items: center;',
      },
    });
    const selectedDyesTitle = this.createElement('span', {
      className: 'section-title',
      textContent: LanguageService.t('comparison.selectedDyes'),
    });
    selectedDyesHeader.appendChild(selectedDyesTitle);

    // Share Button - v4-share-button custom element
    this.shareButton = document.createElement('v4-share-button') as ShareButton;
    this.shareButton.tool = 'comparison';
    this.shareButton.shareParams = this.getShareParams();
    this.shareButton.disabled = this.selectedDyes.length === 0;
    selectedDyesHeader.appendChild(this.shareButton);

    this.selectedDyesSection.appendChild(selectedDyesHeader);
    this.selectedDyesCardsContainer = this.createElement('div', {
      className: 'flex flex-wrap gap-4 justify-center comparison-cards-container',
      attributes: {
        style:
          'display: flex; flex-direction: row; flex-wrap: wrap; gap: 1rem; justify-content: center; align-items: flex-start; --v4-result-card-width: 280px;',
      },
    });
    this.selectedDyesSection.appendChild(this.selectedDyesCardsContainer);
    contentWrapper.appendChild(this.selectedDyesSection);

    // Statistics Summary
    // Hidden by default via inline style - shown when 2+ dyes are selected
    this.statsSection = this.createElement('div', {
      className: 'mb-8',
      attributes: { style: 'display: none;' },
    });
    this.statsSection.appendChild(
      this.createHeader(LanguageService.t('comparison.statistics'))
    );
    this.statsContainer = this.createElement('div');
    this.statsSection.appendChild(this.statsContainer);
    contentWrapper.appendChild(this.statsSection);

    // Charts Grid - side by side on medium+ screens (with margin-top for spacing after Statistics)
    // Hidden by default via inline style - shown when 2+ dyes are selected
    this.chartsSection = this.createElement('div', {
      className: 'mb-8',
      attributes: { style: 'display: none; margin-top: 1.5rem;' },
    });
    // Charts grid - single column on mobile (<768px), 2 columns on larger screens
    // grid-template-columns is set dynamically by updateChartsLayout() based on viewport width
    this.chartsContainer = this.createElement('div', {
      className: 'grid gap-4 md:grid-cols-2',
      attributes: {
        style: 'display: grid; gap: 1rem; max-width: 1168px; margin: 0 auto;',
      },
    });
    this.chartsSection.appendChild(this.chartsContainer);
    contentWrapper.appendChild(this.chartsSection);

    // Distance Matrix
    // Hidden by default via inline style - shown when 2+ dyes are selected
    this.matrixSection = this.createElement('div', {
      attributes: { style: 'display: none;' },
    });
    this.matrixSection.appendChild(
      this.createHeader(
        LanguageService.t('comparison.colorDistanceMatrix')
      )
    );
    this.matrixContainer = this.createElement('div');
    this.matrixSection.appendChild(this.matrixContainer);
    contentWrapper.appendChild(this.matrixSection);

    // Append wrapper to right panel
    right.appendChild(contentWrapper);
  }

  /**
   * Render empty state - V4 design with placeholder slots
   */
  private renderEmptyState(): void {
    if (!this.emptyStateContainer) return;
    clearContainer(this.emptyStateContainer);

    const container = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Placeholder slots section
    const slotsContainer = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          padding: 20px;
          justify-content: center;
          margin-bottom: 2rem;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Create 4 placeholder slots
    for (let i = 0; i < 4; i++) {
      const slot = this.createElement('div', {
        attributes: {
          style: `
            width: 200px;
            height: 280px;
            border: 2px dashed rgba(255, 255, 255, 0.2);
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
            cursor: pointer;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      // Hover effect
      this.on(slot, 'mouseenter', () => {
        slot.style.borderColor = 'rgba(255, 255, 255, 0.35)';
        slot.style.background = 'rgba(255, 255, 255, 0.05)';
      });
      this.on(slot, 'mouseleave', () => {
        slot.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        slot.style.background = 'rgba(0, 0, 0, 0.1)';
      });

      // Plus icon in a dashed circle
      const iconContainer = this.createElement('div', {
        attributes: {
          style: `
            width: 48px;
            height: 48px;
            border: 2px dashed rgba(255, 255, 255, 0.25);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 12px;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      iconContainer.innerHTML = `
        <svg viewBox="0 0 24 24" fill="var(--theme-text-muted)" style="width: 24px; height: 24px; opacity: 0.4;">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      `;

      // "Add Dye" text
      const text = this.createElement('span', {
        textContent: LanguageService.t('comparison.addDye'),
        attributes: {
          style: `
            font-size: 0.85rem;
            color: var(--theme-text-muted);
            opacity: 0.6;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      slot.appendChild(iconContainer);
      slot.appendChild(text);
      slotsContainer.appendChild(slot);
    }

    container.appendChild(slotsContainer);

    // Empty state message
    const messageContainer = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 40px;
          text-align: center;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 12px;
          border: 1px dashed rgba(255, 255, 255, 0.15);
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Tool icon
    const iconEl = this.createElement('div', {
      attributes: {
        style: `
          width: 150px;
          height: 150px;
          margin-bottom: 20px;
          opacity: 0.4;
          color: var(--theme-text-muted);
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    iconEl.innerHTML = ICON_TOOL_COMPARISON;

    // Message text
    const message = this.createElement('p', {
      textContent: LanguageService.t('comparison.selectAtLeastTwoDyes'),
      attributes: {
        style: `
          font-size: 1.1rem;
          color: var(--theme-text-muted);
          max-width: 400px;
          line-height: 1.5;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    messageContainer.appendChild(iconEl);
    messageContainer.appendChild(message);
    container.appendChild(messageContainer);

    this.emptyStateContainer.appendChild(container);
  }

  /**
   * Update all results
   */
  private updateResults(): void {
    const hasDyes = this.selectedDyes.length > 0;
    const hasEnoughForAnalysis = this.selectedDyes.length >= 2;

    // Always render selected dyes cards (clears when empty, shows cards when has dyes)
    this.renderSelectedDyesCards();

    // Show/hide sections based on dye count
    this.showEmptyState(!hasDyes); // Only show empty state when NO dyes selected
    this.showAnalysisSections(hasEnoughForAnalysis); // Analysis needs 2+ dyes

    // Only calculate and render analysis when we have enough dyes
    if (hasEnoughForAnalysis) {
      this.calculateStats();
      this.findClosestPair();
      this.renderStats();
      this.renderCharts();
      this.renderDistanceMatrix();
    }
  }

  /**
   * Render selected dyes as V4 result-cards in the right panel
   */
  private renderSelectedDyesCards(): void {
    if (!this.selectedDyesCardsContainer) return;
    clearContainer(this.selectedDyesCardsContainer);

    for (const dye of this.selectedDyes) {
      // Create v4-result-card element
      const card = document.createElement('v4-result-card') as ResultCard;

      // Override default block display to allow horizontal layout
      card.style.display = 'inline-block';
      card.style.flexShrink = '0';

      // Build card data - use dye color for both original and match (no comparison target)
      const cardData: ResultCardData = {
        dye: dye,
        originalColor: dye.hex,
        matchedColor: dye.hex,
        // No deltaE in comparison context
        vendorCost: dye.cost,
      };

      // Try to get market price if Market Board is enabled
      if (this.comparisonOptions.showMarketPrices) {
        const marketBoardService = MarketBoardService.getInstance();
        const priceData = marketBoardService.getPriceForDye(dye.itemID);
        if (priceData) {
          cardData.price = priceData.currentMinPrice;
          // Use the actual world name from price data, not just the selected server/DC
          cardData.marketServer = marketBoardService.getWorldNameForPrice(priceData);
        } else {
          // No price data yet, show the selected server as placeholder
          cardData.marketServer = marketBoardService.getSelectedServer();
        }
      }

      card.data = cardData;

      // Configure display options based on comparison settings
      card.showHex = this.comparisonOptions.showHex;
      card.showRgb = this.comparisonOptions.showRgb;
      card.showHsv = this.comparisonOptions.showHsv;
      card.showLab = this.comparisonOptions.showLab;
      card.showDeltaE = false; // No Delta-E in comparison context
      card.showPrice = this.comparisonOptions.showMarketPrices;
      card.showAcquisition = true;
      card.primaryActionLabel = LanguageService.t('common.remove');

      // Handle remove action
      card.addEventListener('card-select', () => {
        this.removeDye(dye);
      });

      this.selectedDyesCardsContainer.appendChild(card);
    }
  }

  /**
   * Remove a dye from the selection
   */
  private removeDye(dye: Dye): void {
    const newSelection = this.selectedDyes.filter((d) => d.id !== dye.id);
    this.dyeSelector?.setSelectedDyes(newSelection);
    this.drawerDyeSelector?.setSelectedDyes(newSelection);
    this.selectedDyes = newSelection;
    this.calculateHSVValues();
    this.updateSelectedDyesDisplay();
    this.updateDrawerSelectedDyesDisplay();
    this.updateResults();
    this.saveSelectedDyes();
  }

  /**
   * Show/hide empty state (placeholder slots + message)
   * Empty state is shown when NO dyes are selected
   */
  private showEmptyState(show: boolean): void {
    // Toggle empty state container using inline style for reliability
    if (this.emptyStateContainer) {
      this.emptyStateContainer.style.display = show ? 'block' : 'none';
    }

    // Toggle selected dyes section (inverse of empty state)
    // When empty state is shown, hide selected dyes section
    // When empty state is hidden (has dyes), show selected dyes section
    if (this.selectedDyesSection) {
      this.selectedDyesSection.style.display = show ? 'none' : 'block';
    }
  }

  /**
   * Show/hide analysis sections (stats, charts, matrix)
   * Analysis sections require 2+ dyes to be meaningful
   */
  private showAnalysisSections(show: boolean): void {
    const analysisSections = [this.statsSection, this.chartsSection, this.matrixSection];

    for (const section of analysisSections) {
      if (section) {
        section.style.display = show ? 'block' : 'none';
      }
    }
  }

  /**
   * Calculate HSV values for all selected dyes
   */
  private calculateHSVValues(): void {
    this.dyesWithHSV = this.selectedDyes.map((dye) => {
      const hsv = ColorService.hexToHsv(dye.hex);
      return {
        dye,
        h: hsv.h,
        s: hsv.s,
        v: hsv.v,
      };
    });
  }

  /**
   * Calculate comparison statistics
   */
  private calculateStats(): void {
    if (this.dyesWithHSV.length < 2) {
      this.stats = null;
      return;
    }

    // Calculate averages
    const avgSaturation =
      this.dyesWithHSV.reduce((sum, d) => sum + d.s, 0) / this.dyesWithHSV.length;
    const avgBrightness =
      this.dyesWithHSV.reduce((sum, d) => sum + d.v, 0) / this.dyesWithHSV.length;

    // Calculate hue range (considering hue wrapping)
    const hues = this.dyesWithHSV.map((d) => d.h).sort((a, b) => a - b);
    let maxGap = 0;
    let gapStart = 0;
    for (let i = 0; i < hues.length; i++) {
      const next = (i + 1) % hues.length;
      const gap = next === 0 ? 360 - hues[i] + hues[0] : hues[next] - hues[i];
      if (gap > maxGap) {
        maxGap = gap;
        gapStart = hues[next === 0 ? 0 : next];
      }
    }
    const hueRange = 360 - maxGap;

    // Calculate average pairwise distance
    let totalDistance = 0;
    let pairCount = 0;
    for (let i = 0; i < this.selectedDyes.length; i++) {
      for (let j = i + 1; j < this.selectedDyes.length; j++) {
        totalDistance += ColorService.getColorDistance(
          this.selectedDyes[i].hex,
          this.selectedDyes[j].hex
        );
        pairCount++;
      }
    }
    const avgDistance = pairCount > 0 ? totalDistance / pairCount : 0;

    this.stats = {
      avgSaturation: Math.round(avgSaturation),
      avgBrightness: Math.round(avgBrightness),
      hueRange: Math.round(hueRange),
      avgDistance: Math.round(avgDistance * 10) / 10,
    };
  }

  /**
   * Find the closest pair of dyes
   */
  private findClosestPair(): void {
    if (this.selectedDyes.length < 2) {
      this.closestPair = null;
      return;
    }

    let minDistance = Infinity;
    let closest: [number, number] = [0, 1];

    for (let i = 0; i < this.selectedDyes.length; i++) {
      for (let j = i + 1; j < this.selectedDyes.length; j++) {
        const distance = ColorService.getColorDistance(
          this.selectedDyes[i].hex,
          this.selectedDyes[j].hex
        );
        if (distance < minDistance) {
          minDistance = distance;
          closest = [i, j];
        }
      }
    }

    this.closestPair = closest;
  }

  /**
   * Update charts container layout based on viewport width
   * Single column on mobile (<768px), two columns on larger screens
   */
  private updateChartsLayout(): void {
    if (!this.chartsContainer) return;

    const isDesktop = window.innerWidth >= 768;
    this.chartsContainer.style.gridTemplateColumns = isDesktop ? 'repeat(2, 1fr)' : '1fr';
  }

  /**
   * Render statistics summary - V4 stat-card design
   */
  private renderStats(): void {
    if (!this.statsContainer || !this.stats) return;
    clearContainer(this.statsContainer);

    // V4 Stats Grid - Flex row centered to match dyes card layout
    const grid = this.createElement('div', {
      className: 'flex flex-wrap justify-center gap-4',
      attributes: {
        style: 'display: flex; gap: 16px; justify-content: center; flex-wrap: wrap;',
      },
    });

    const statItems = [
      {
        label: LanguageService.t('comparison.avgSaturation'),
        value: this.stats.avgSaturation,
        unit: '%',
      },
      {
        label: LanguageService.t('comparison.avgBrightness'),
        value: this.stats.avgBrightness,
        unit: '%',
      },
      {
        label: LanguageService.t('comparison.hueRange'),
        value: this.stats.hueRange,
        unit: '°',
      },
      {
        label: LanguageService.t('comparison.avgDistance'),
        value: this.stats.avgDistance.toFixed(1),
        unit: '',
      },
    ];

    for (const stat of statItems) {
      // V4 Stat Card with hover effect
      const card = this.createElement('div', {
        attributes: {
          style: `
            background: var(--theme-card-background);
            border: 1px solid var(--theme-border);
            border-radius: 12px;
            padding: 24px 16px;
            text-align: center;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
            transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s;
            cursor: default;
            width: 280px;
            flex-shrink: 0;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      // Add hover effect
      this.on(card, 'mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.4)';
        card.style.borderColor = 'var(--theme-text-muted)';
      });
      this.on(card, 'mouseleave', () => {
        card.style.transform = 'translateY(0)';
        card.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
        card.style.borderColor = 'var(--theme-border)';
      });

      // Large value with gold accent
      const valueContainer = this.createElement('div', {
        attributes: {
          style: `
            font-size: 36px;
            font-weight: 700;
            color: var(--theme-primary);
            line-height: 1;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      // Value number
      const valueSpan = document.createTextNode(String(stat.value));
      valueContainer.appendChild(valueSpan);

      // Unit suffix (smaller, muted)
      if (stat.unit) {
        const unitSpan = this.createElement('span', {
          textContent: stat.unit,
          attributes: {
            style: `
              font-size: 18px;
              font-weight: 500;
              color: var(--theme-text-muted);
              margin-left: 2px;
            `
              .replace(/\s+/g, ' ')
              .trim(),
          },
        });
        valueContainer.appendChild(unitSpan);
      }

      // Label below value
      const labelEl = this.createElement('div', {
        textContent: stat.label,
        attributes: {
          style: `
            font-size: 11px;
            text-transform: uppercase;
            color: var(--theme-text-muted);
            letter-spacing: 1px;
            margin-top: 12px;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      card.appendChild(valueContainer);
      card.appendChild(labelEl);
      grid.appendChild(card);
    }

    this.statsContainer.appendChild(grid);
  }

  /**
   * Render charts (Hue-Saturation plot and Brightness distribution)
   */
  private renderCharts(): void {
    if (!this.chartsContainer) return;
    clearContainer(this.chartsContainer);

    // Hue-Saturation Plot
    this.chartsContainer.appendChild(
      this.createChartCard(
        LanguageService.t('comparison.hueSaturationPlot'),
        this.createHueSatPlot()
      )
    );

    // Brightness Distribution
    this.chartsContainer.appendChild(
      this.createChartCard(
        LanguageService.t('comparison.brightnessDistribution'),
        this.createBrightnessChart()
      )
    );
  }

  /**
   * Create a chart card wrapper
   */
  private createChartCard(title: string, content: HTMLElement): HTMLElement {
    const card = this.createElement('div', {
      className: 'p-4 flex flex-col',
      attributes: {
        style:
          'background: var(--theme-card-background); border: 1px solid var(--theme-border); border-radius: 12px;',
      },
    });
    // Centered chart title
    card.appendChild(
      this.createElement('h4', {
        className: 'text-sm font-medium mb-3 flex-shrink-0',
        textContent: title,
        attributes: {
          style: `
          color: var(--theme-text);
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 1px;
        `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      })
    );
    const contentWrapper = this.createElement('div', { className: 'flex-1 flex flex-col min-h-0' });
    contentWrapper.appendChild(content);
    card.appendChild(contentWrapper);
    return card;
  }

  /**
   * Create Hue-Saturation Plot - V4 plot-node design with hover tooltips
   */
  private createHueSatPlot(): HTMLElement {
    // V4 Container - responsive width with aspect ratio maintained
    const container = this.createElement('div', {
      attributes: {
        style: `
          position: relative;
          width: 100%;
          aspect-ratio: 380 / 280;
          margin: 0 auto;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // SVG for background, grid lines, and axis labels
    const svgContainer = this.createElement('div', {
      attributes: {
        style: `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    svgContainer.innerHTML = `
      <svg viewBox="0 0 380 280" style="width: 100%; height: 100%;" preserveAspectRatio="xMidYMid meet">
        <!-- Y-axis label -->
        <text x="15" y="140" text-anchor="middle" font-size="10" fill="var(--theme-text-muted)"
          transform="rotate(-90 15 140)" style="text-transform: uppercase; letter-spacing: 0.5px;">Saturation</text>

        <!-- Plot area background -->
        <rect x="50" y="20" width="300" height="200" fill="var(--theme-card-background)"
          stroke="rgba(255, 255, 255, 0.2)" stroke-width="1" rx="4" />

        <!-- Horizontal grid lines (25%, 50%, 75%) -->
        <line x1="50" y1="70" x2="350" y2="70" stroke="rgba(255, 255, 255, 0.08)" stroke-dasharray="4" />
        <line x1="50" y1="120" x2="350" y2="120" stroke="rgba(255, 255, 255, 0.08)" stroke-dasharray="4" />
        <line x1="50" y1="170" x2="350" y2="170" stroke="rgba(255, 255, 255, 0.08)" stroke-dasharray="4" />

        <!-- Vertical grid lines (90°, 180°, 270°) -->
        <line x1="125" y1="20" x2="125" y2="220" stroke="rgba(255, 255, 255, 0.08)" stroke-dasharray="4" />
        <line x1="200" y1="20" x2="200" y2="220" stroke="rgba(255, 255, 255, 0.08)" stroke-dasharray="4" />
        <line x1="275" y1="20" x2="275" y2="220" stroke="rgba(255, 255, 255, 0.08)" stroke-dasharray="4" />

        <!-- Y-axis tick labels (Saturation) -->
        <text x="45" y="24" text-anchor="end" font-size="9" fill="var(--theme-text-muted)">100%</text>
        <text x="45" y="74" text-anchor="end" font-size="9" fill="var(--theme-text-muted)">75%</text>
        <text x="45" y="124" text-anchor="end" font-size="9" fill="var(--theme-text-muted)">50%</text>
        <text x="45" y="174" text-anchor="end" font-size="9" fill="var(--theme-text-muted)">25%</text>
        <text x="45" y="224" text-anchor="end" font-size="9" fill="var(--theme-text-muted)">0%</text>

        <!-- X-axis tick labels (Hue) -->
        <text x="50" y="240" text-anchor="middle" font-size="9" fill="var(--theme-text-muted)">0°</text>
        <text x="125" y="240" text-anchor="middle" font-size="9" fill="var(--theme-text-muted)">90°</text>
        <text x="200" y="240" text-anchor="middle" font-size="9" fill="var(--theme-text-muted)">180°</text>
        <text x="275" y="240" text-anchor="middle" font-size="9" fill="var(--theme-text-muted)">270°</text>
        <text x="350" y="240" text-anchor="middle" font-size="9" fill="var(--theme-text-muted)">360°</text>

        <!-- X-axis label -->
        <text x="200" y="265" text-anchor="middle" font-size="10" fill="var(--theme-text-muted)"
          style="text-transform: uppercase; letter-spacing: 0.5px;">Hue</text>
      </svg>
    `;
    container.appendChild(svgContainer);

    // Plot area for nodes (overlay on SVG)
    // Use percentage-based positioning to match SVG viewBox (380x280) coordinates
    // Plot rect in SVG: x=50, y=20, width=300, height=200
    // As percentages: left=50/380=13.16%, top=20/280=7.14%, width=300/380=78.95%, height=200/280=71.43%
    const plotArea = this.createElement('div', {
      attributes: {
        style: `
          position: absolute;
          top: 7.14%;
          left: 13.16%;
          width: 78.95%;
          height: 71.43%;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Create plot nodes (HTML divs for hover effects and tooltips)
    for (let i = 0; i < this.dyesWithHSV.length; i++) {
      const d = this.dyesWithHSV[i];
      const dyeName = LanguageService.getDyeName(d.dye.itemID) || d.dye.name;

      // Calculate position (Hue on X, Saturation on Y - inverted because 100% is at top)
      const xPercent = (d.h / 360) * 100;
      const yPercent = 100 - d.s; // Invert so 100% saturation is at top

      const isClosest =
        this.comparisonOptions.highlightClosestPair &&
        this.closestPair &&
        (i === this.closestPair[0] || i === this.closestPair[1]);

      // V4 Plot Node
      const node = this.createElement('div', {
        attributes: {
          'data-label': dyeName,
          title: dyeName,
          style: `
            position: absolute;
            left: ${xPercent}%;
            top: ${yPercent}%;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 3px solid ${isClosest ? 'var(--theme-primary)' : 'rgba(255, 255, 255, 0.9)'};
            transform: translate(-50%, -50%);
            box-shadow: 0 3px 8px rgba(0, 0, 0, 0.5);
            cursor: pointer;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
            z-index: 2;
            background: ${d.dye.hex};
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      // Hover effects
      this.on(node, 'mouseenter', () => {
        node.style.transform = 'translate(-50%, -50%) scale(1.25)';
        node.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.6)';
        node.style.zIndex = '10';
      });
      this.on(node, 'mouseleave', () => {
        node.style.transform = 'translate(-50%, -50%)';
        node.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.5)';
        node.style.zIndex = '2';
      });

      plotArea.appendChild(node);
    }

    container.appendChild(plotArea);
    return container;
  }

  /**
   * Create Brightness Distribution bar chart - V4 bar-chart design
   */
  private createBrightnessChart(): HTMLElement {
    // V4 Container - responsive width, matching aspect ratio to Hue-Sat plot
    const container = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          width: 100%;
          aspect-ratio: 380 / 280;
          margin: 0 auto;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Bar chart area with Y-axis grid lines - increased bottom padding for labels
    const chartArea = this.createElement('div', {
      attributes: {
        style: `
          flex: 1;
          display: flex;
          align-items: flex-end;
          justify-content: space-around;
          padding-top: 32px;
          padding-bottom: 48px;
          position: relative;
          background: repeating-linear-gradient(
            to bottom,
            transparent,
            transparent calc(25% - 1px),
            rgba(255, 255, 255, 0.05) calc(25% - 1px),
            rgba(255, 255, 255, 0.05) 25%
          );
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // X-axis line - positioned above the label area
    const xAxisLine = this.createElement('div', {
      attributes: {
        style: `
          position: absolute;
          left: 0;
          right: 0;
          bottom: 48px;
          height: 1px;
          background: rgba(255, 255, 255, 0.2);
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    chartArea.appendChild(xAxisLine);

    // Create bars with value labels above and name labels below
    for (let i = 0; i < this.dyesWithHSV.length; i++) {
      const d = this.dyesWithHSV[i];
      const dyeName = LanguageService.getDyeName(d.dye.itemID) || d.dye.name;
      const isClosest =
        this.comparisonOptions.highlightClosestPair &&
        this.closestPair &&
        (i === this.closestPair[0] || i === this.closestPair[1]);

      // Bar item container (holds value, bar, and label)
      const barItem = this.createElement('div', {
        attributes: {
          style: `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            flex: 1;
            min-width: 60px;
            position: relative;
            height: 100%;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      // Value label above bar
      const valueLabel = this.createElement('span', {
        textContent: `${Math.round(d.v)}%`,
        attributes: {
          style: `
            position: absolute;
            top: -24px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 12px;
            font-weight: 600;
            color: var(--theme-text);
            white-space: nowrap;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      // The actual bar
      const bar = this.createElement('div', {
        attributes: {
          style: `
            width: 70%;
            max-width: 80px;
            height: ${d.v}%;
            border-radius: 6px 6px 0 0;
            transition: filter 0.2s, box-shadow 0.2s;
            position: relative;
            box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
            background: ${d.dye.hex};
            ${isClosest ? 'box-shadow: 0 0 0 3px var(--theme-primary), 0 -2px 8px rgba(0, 0, 0, 0.3);' : ''}
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      // Add hover effect
      this.on(bar, 'mouseenter', () => {
        bar.style.filter = 'brightness(1.15)';
        if (!isClosest) {
          bar.style.boxShadow = '0 -4px 12px rgba(0, 0, 0, 0.4)';
        }
      });
      this.on(bar, 'mouseleave', () => {
        bar.style.filter = 'brightness(1)';
        if (!isClosest) {
          bar.style.boxShadow = '0 -2px 8px rgba(0, 0, 0, 0.3)';
        }
      });

      // Name label below bar
      const nameLabel = this.createElement('span', {
        textContent: dyeName,
        attributes: {
          title: dyeName,
          style: `
            position: absolute;
            bottom: -24px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 10px;
            color: var(--theme-text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            text-align: center;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      });

      barItem.appendChild(valueLabel);
      barItem.appendChild(bar);
      barItem.appendChild(nameLabel);
      chartArea.appendChild(barItem);
    }

    container.appendChild(chartArea);
    return container;
  }

  /**
   * Render distance matrix - V4 pairwise-matrix design
   */
  private renderDistanceMatrix(): void {
    if (!this.matrixContainer) return;
    clearContainer(this.matrixContainer);

    if (this.selectedDyes.length < 2) return;

    // V4 Matrix container with rounded corners and shadow
    const matrix = this.createElement('div', {
      attributes: {
        style: `
          background: var(--theme-card-background);
          border: 1px solid var(--theme-border);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          max-width: 1168px;
          width: 100%;
          margin: 0 auto;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Build table HTML with V4 pairwise-matrix styling
    let html = `
      <div style="overflow-x: auto;">
        <table style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr>
              <th style="
                width: 140px;
                background: rgba(0, 0, 0, 0.4);
                padding: 12px 8px;
              "></th>
    `;

    // Column headers with larger swatches
    for (const dye of this.selectedDyes) {
      const dyeName = LanguageService.getDyeName(dye.itemID) || dye.name;
      html += `
        <th style="
          padding: 12px 8px;
          text-align: center;
          background: rgba(0, 0, 0, 0.4);
          border-bottom: 1px solid var(--theme-border);
          border-left: 1px solid var(--theme-border);
        ">
          <div style="
            width: 28px;
            height: 28px;
            border-radius: 4px;
            margin: 0 auto 6px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            background: ${dye.hex};
          "></div>
          <span style="
            font-size: 11px;
            font-weight: normal;
            color: var(--theme-text-muted);
            display: block;
            max-width: 80px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          ">${dyeName}</span>
        </th>
      `;
    }
    html += '</tr></thead><tbody>';

    // Data rows
    for (let i = 0; i < this.selectedDyes.length; i++) {
      const rowDye = this.selectedDyes[i];
      const rowDyeName = LanguageService.getDyeName(rowDye.itemID) || rowDye.name;
      const isRowClosest =
        this.comparisonOptions.highlightClosestPair &&
        this.closestPair &&
        (i === this.closestPair[0] || i === this.closestPair[1]);

      html += '<tr>';

      // Row header with swatch
      const rowBg = isRowClosest ? 'rgba(0, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.2)';
      html += `
        <td style="
          padding: 12px 16px;
          background: ${rowBg};
          border-bottom: 1px solid var(--theme-border);
          min-width: 140px;
        ">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="
              width: 24px;
              height: 24px;
              border-radius: 4px;
              flex-shrink: 0;
              border: 1px solid rgba(255, 255, 255, 0.1);
              background: ${rowDye.hex};
            "></div>
            <span style="
              font-size: 12px;
              color: var(--theme-text);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            ">${rowDyeName}</span>
          </div>
        </td>
      `;

      // Data cells
      for (let j = 0; j < this.selectedDyes.length; j++) {
        const isColClosest =
          this.comparisonOptions.highlightClosestPair &&
          this.closestPair &&
          (j === this.closestPair[0] || j === this.closestPair[1]);
        const isPair =
          this.comparisonOptions.highlightClosestPair &&
          this.closestPair &&
          ((i === this.closestPair[0] && j === this.closestPair[1]) ||
            (i === this.closestPair[1] && j === this.closestPair[0]));

        if (i === j) {
          // Diagonal cell
          html += `
            <td style="
              padding: 12px 8px;
              text-align: center;
              font-weight: 600;
              font-size: 13px;
              border-left: 1px solid var(--theme-border);
              border-bottom: 1px solid var(--theme-border);
              background: rgba(0, 0, 0, 0.3);
              color: var(--theme-text-muted);
            ">\u2014</td>
          `;
        } else {
          const distance = ColorService.getColorDistance(rowDye.hex, this.selectedDyes[j].hex);
          const distStr = distance.toFixed(1);
          const distanceColor = this.getDistanceColor(distance);

          // Cell background for highlighted pairs
          let cellBg = '';
          if (isPair) {
            cellBg = 'background: var(--theme-primary);';
          } else if (isRowClosest && isColClosest) {
            cellBg = 'background: rgba(0, 0, 0, 0.15);';
          }

          if (this.comparisonOptions.showDistanceValues) {
            const textColor = isPair ? 'var(--theme-text-header)' : distanceColor;
            html += `
              <td style="
                padding: 12px 8px;
                text-align: center;
                font-weight: 600;
                font-size: 13px;
                font-family: 'Consolas', 'Monaco', monospace;
                border-left: 1px solid var(--theme-border);
                border-bottom: 1px solid var(--theme-border);
                transition: background 0.1s;
                color: ${textColor};
                ${cellBg}
              ">${distStr}</td>
            `;
          } else {
            html += `
              <td style="
                padding: 12px 8px;
                text-align: center;
                border-left: 1px solid var(--theme-border);
                border-bottom: 1px solid var(--theme-border);
                ${cellBg}
              ">
                <div style="
                  width: 16px;
                  height: 16px;
                  border-radius: 4px;
                  margin: 0 auto;
                  background: ${distanceColor};
                "></div>
              </td>
            `;
          }
        }
      }

      html += '</tr>';
    }

    html += '</tbody></table></div>';
    matrix.innerHTML = html;
    this.matrixContainer.appendChild(matrix);
  }

  /**
   * Get color based on distance value - V4 color coding
   * Low distance (similar) = green, Medium = gold, High (different) = red
   */
  private getDistanceColor(distance: number): string {
    // Using perceptual thresholds for color distance
    // Delta-E < 100: very similar, 100-200: moderately different, > 200: very different
    if (distance < 100) return '#4caf50'; // Green - similar colors
    if (distance < 200) return 'var(--theme-primary)'; // Gold - moderate difference
    return '#f44336'; // Red - very different
  }

  // ============================================================================
  // Mobile Drawer Content
  // ============================================================================

  /**
   * Render mobile drawer content
   */
  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    const drawer = this.options.drawerContent;
    clearContainer(drawer);

    // Clean up previous drawer components
    this.drawerDyeSelector?.destroy();
    this.drawerDyeSelectorPanel?.destroy();
    this.drawerOptionsPanel?.destroy();
    this.drawerMarketBoard?.destroy();
    this.drawerMarketPanel?.destroy();

    this.drawerDyeSelector = null;
    this.drawerDyeSelectorPanel = null;
    this.drawerOptionsPanel = null;
    this.drawerMarketBoard = null;
    this.drawerMarketPanel = null;

    // Section 1: Dye Selection (Collapsible)
    const dyeContainer = this.createElement('div');
    drawer.appendChild(dyeContainer);
    this.renderDrawerDyePanel(dyeContainer);

    // Section 2: Options (Collapsible)
    const optionsContainer = this.createElement('div');
    drawer.appendChild(optionsContainer);
    this.renderDrawerOptionsPanel(optionsContainer);

    // Section 3: Market Board (Collapsible)
    const marketContainer = this.createElement('div');
    drawer.appendChild(marketContainer);
    this.drawerMarketPanel = new CollapsiblePanel(marketContainer, {
      title: LanguageService.t('marketBoard.title'),
      storageKey: 'v3_comparison_mobile_market',
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    this.drawerMarketPanel.init();

    const marketContent = this.createElement('div');
    this.drawerMarketBoard = new MarketBoard(marketContent);
    this.drawerMarketBoard.init();

    // Setup listeners for mobile market board
    setupMarketBoardListeners(
      marketContent,
      () => this.comparisonOptions.showMarketPrices,
      () => this.fetchAndUpdatePrices(),
      {
        onPricesToggled: () => {
          if (this.comparisonOptions.showMarketPrices) {
            void this.fetchAndUpdatePrices();
          } else {
            this.renderSelectedDyesCards();
          }
        },
        onServerChanged: () => {
          this.renderSelectedDyesCards();
          if (this.comparisonOptions.showMarketPrices && this.selectedDyes.length > 0) {
            void this.fetchAndUpdatePrices();
          }
        },
      }
    );

    this.drawerMarketPanel.setContent(marketContent);
  }

  /**
   * Render collapsible Dye Selection panel for mobile drawer
   */
  private renderDrawerDyePanel(container: HTMLElement): void {
    this.drawerDyeSelectorPanel = new CollapsiblePanel(container, {
      title: LanguageService.t('comparison.compareDyes'),
      defaultOpen: true,
      storageKey: 'v3_comparison_dyes_drawer',
      icon: ICON_BEAKER,
    });
    this.drawerDyeSelectorPanel.init();

    const contentContainer = this.drawerDyeSelectorPanel.getContentContainer();
    if (contentContainer) {
      this.renderDrawerDyeSelector(contentContainer);
    }
  }

  /**
   * Render dye selector for mobile drawer
   */
  private renderDrawerDyeSelector(container: HTMLElement): void {
    const dyeContainer = this.createElement('div', { className: 'space-y-3' });

    // Selected dyes display
    this.drawerSelectedDyesContainer = this.createElement('div', {
      className: 'selected-dyes-display space-y-2',
    });
    this.updateDrawerSelectedDyesDisplay();
    dyeContainer.appendChild(this.drawerSelectedDyesContainer);

    // DyeSelector component
    const selectorContainer = this.createElement('div');
    dyeContainer.appendChild(selectorContainer);

    this.drawerDyeSelector = new DyeSelector(selectorContainer, {
      maxSelections: 4,
      allowMultiple: true,
      allowDuplicates: false,
      showCategories: true,
      showPrices: false,
      excludeFacewear: true,
      showFavorites: true,
      compactMode: true,
      hideSelectedChips: true, // Selections shown above in dedicated display
    });
    this.drawerDyeSelector.init();

    // Pre-select current dyes
    if (this.selectedDyes.length > 0) {
      this.drawerDyeSelector.setSelectedDyes(this.selectedDyes);
    }

    // Listen for selection changes
    selectorContainer.addEventListener('selection-changed', () => {
      if (this.drawerDyeSelector) {
        this.selectedDyes = this.drawerDyeSelector.getSelectedDyes();
        this.calculateHSVValues();

        // Sync desktop selector
        this.dyeSelector?.setSelectedDyes(this.selectedDyes);

        // Update displays
        this.updateSelectedDyesDisplay();
        this.updateDrawerSelectedDyesDisplay();
        this.updateResults();
        this.saveSelectedDyes();
        // Fetch prices for newly selected dyes if Market Board is enabled
        if (this.comparisonOptions.showMarketPrices && this.selectedDyes.length > 0) {
          this.fetchAndUpdatePrices();
        }
      }
    });

    container.appendChild(dyeContainer);
  }

  /**
   * Update the selected dyes display in mobile drawer
   */
  private updateDrawerSelectedDyesDisplay(): void {
    if (!this.drawerSelectedDyesContainer) return;
    clearContainer(this.drawerSelectedDyesContainer);

    if (this.selectedDyes.length === 0) {
      // Show placeholder
      const placeholder = this.createElement('div', {
        className: 'p-3 rounded-lg border-2 border-dashed text-center text-sm',
        textContent:
          LanguageService.t('comparison.selectDyesToCompare'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      this.drawerSelectedDyesContainer.appendChild(placeholder);
      return;
    }

    // Show selected dyes with remove buttons
    for (const dye of this.selectedDyes) {
      const dyeItem = this.createElement('div', {
        className: 'flex items-center gap-3 p-2 rounded-lg',
        attributes: { style: 'background: var(--theme-background-secondary);' },
      });

      const swatch = this.createElement('div', {
        className: 'w-8 h-8 rounded border flex-shrink-0',
        attributes: { style: `background: ${dye.hex}; border-color: var(--theme-border);` },
      });

      const name = this.createElement('span', {
        className: 'flex-1 text-sm font-medium truncate',
        textContent: LanguageService.getDyeName(dye.itemID) || dye.name,
        attributes: { style: 'color: var(--theme-text);' },
      });

      const removeBtn = this.createElement('button', {
        className: 'text-xs px-2 py-1 rounded transition-colors flex-shrink-0',
        textContent: '\u00D7',
        attributes: {
          style: 'background: var(--theme-card-hover); color: var(--theme-text-muted);',
        },
      });

      this.on(removeBtn, 'click', () => this.handleDrawerRemoveDye(dye));

      dyeItem.appendChild(swatch);
      dyeItem.appendChild(name);
      dyeItem.appendChild(removeBtn);
      this.drawerSelectedDyesContainer.appendChild(dyeItem);
    }
  }

  /**
   * Handle removing a dye from the mobile drawer
   */
  private handleDrawerRemoveDye(dye: Dye): void {
    // Use centralized remove method
    this.removeDye(dye);
  }

  /**
   * Render collapsible Options panel for mobile drawer
   */
  private renderDrawerOptionsPanel(container: HTMLElement): void {
    this.drawerOptionsPanel = new CollapsiblePanel(container, {
      title: LanguageService.t('common.options'),
      defaultOpen: true,
      storageKey: 'v3_comparison_options_drawer',
      icon: ICON_SETTINGS,
    });
    this.drawerOptionsPanel.init();

    const contentContainer = this.drawerOptionsPanel.getContentContainer();
    if (contentContainer) {
      this.renderDrawerOptions(contentContainer);
    }
  }

  /**
   * Render option checkboxes in the mobile drawer
   */
  private renderDrawerOptions(container: HTMLElement): void {
    const optionsContainer = this.createElement('div', { className: 'space-y-2' });

    const options = [
      {
        key: 'showDistanceValues' as const,
        label: LanguageService.t('comparison.showDistanceValues'),
      },
      {
        key: 'highlightClosestPair' as const,
        label: LanguageService.t('comparison.highlightClosestPair'),
      },
    ];

    for (const option of options) {
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });

      const checkbox = this.createElement('input', {
        attributes: {
          type: 'checkbox',
          'data-option': option.key,
        },
        className: 'w-4 h-4 rounded',
      }) as HTMLInputElement;
      checkbox.checked = this.comparisonOptions[option.key];

      this.on(checkbox, 'change', () => {
        this.comparisonOptions[option.key] = checkbox.checked;
        StorageService.setItem(STORAGE_KEYS[option.key], checkbox.checked);
        this.updateResults();
      });

      const text = this.createElement('span', {
        className: 'text-sm',
        textContent: option.label,
        attributes: { style: 'color: var(--theme-text);' },
      });

      label.appendChild(checkbox);
      label.appendChild(text);
      optionsContainer.appendChild(label);
    }

    container.appendChild(optionsContainer);
  }

  /**
   * Clear all dye selections and return to empty state.
   * Called when "Clear All Dyes" button is clicked in Color Palette.
   */
  public clearDyes(): void {
    this.selectedDyes = [];
    this.dyesWithHSV = [];
    this.stats = null;

    // Clear from storage
    StorageService.removeItem(STORAGE_KEYS.selectedDyes);
    logger.info('[ComparisonTool] All dyes cleared');

    // Update dye selectors
    this.dyeSelector?.setSelectedDyes([]);
    this.drawerDyeSelector?.setSelectedDyes([]);

    // Clear UI containers
    if (this.selectedDyesCardsContainer) {
      clearContainer(this.selectedDyesCardsContainer);
    }
    if (this.statsContainer) {
      clearContainer(this.statsContainer);
    }
    if (this.chartsContainer) {
      clearContainer(this.chartsContainer);
    }
    if (this.matrixContainer) {
      clearContainer(this.matrixContainer);
    }

    // Show empty state and hide analysis sections
    this.showEmptyState(true);
    this.showAnalysisSections(false);
    this.updateDrawerSelectedDyesDisplay();
    this.updateShareButton(); // Disable share button when dyes are cleared
  }

  /**
   * Add a dye from external source (Color Palette drawer)
   * Adds the dye to the comparison list if not already present.
   *
   * @param dye The dye to add to the comparison
   */
  public addDye(dye: Dye): void {
    if (!dye) return;

    // Check if already in selection (max 4 dyes)
    if (this.selectedDyes.some((d) => d.id === dye.id)) {
      logger.debug(`[ComparisonTool] Dye already in selection: ${dye.name}`);
      return;
    }

    if (this.selectedDyes.length >= 4) {
      logger.debug(`[ComparisonTool] Max dyes reached (4), cannot add: ${dye.name}`);
      return;
    }

    this.selectedDyes.push(dye);
    logger.info(`[ComparisonTool] External dye added: ${dye.name}`);

    // Update DyeSelector if it exists
    if (this.dyeSelector) {
      this.dyeSelector.setSelectedDyes(this.selectedDyes);
    }

    // Persist and update UI
    const dyeIds = this.selectedDyes.map((d) => d.id);
    StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);
    this.calculateHSVValues();
    this.updateSelectedDyesDisplay();
    this.updateResults();
    this.updateShareButton(); // Update share button with new dye selection
  }

  /**
   * Alias for addDye to support the selectDye interface
   */
  public selectDye(dye: Dye): void {
    this.addDye(dye);
  }

  // ============================================================================
  // Share Functionality
  // ============================================================================

  /**
   * Get parameters for generating a share URL
   */
  private getShareParams(): Record<string, unknown> {
    if (this.selectedDyes.length === 0) {
      return {};
    }

    return {
      dyes: this.selectedDyes.map((d) => d.itemID),
    };
  }

  /**
   * Update share button state based on current selection
   */
  private updateShareButton(): void {
    if (this.shareButton) {
      this.shareButton.shareParams = this.getShareParams();
      this.shareButton.disabled = this.selectedDyes.length === 0;
    }
  }

  /**
   * Load tool state from share URL parameters
   * @returns true if dyes were loaded from URL, false otherwise
   */
  private loadFromShareUrl(): boolean {
    const parsed = ShareService.getShareParamsFromCurrentUrl();
    if (!parsed || parsed.tool !== 'comparison') {
      return false;
    }

    const params = parsed.params;
    if (!params.dyes || !Array.isArray(params.dyes) || params.dyes.length === 0) {
      return false;
    }

    // Load dyes by itemID
    const dyeService = DyeService.getInstance();
    const loadedDyes: Dye[] = [];

    for (const itemId of params.dyes) {
      if (typeof itemId === 'number') {
        // Find by itemID
        const allDyes = dyeService.getAllDyes();
        const dye = allDyes.find((d) => d.itemID === itemId);
        if (dye && !loadedDyes.some((d) => d.id === dye.id)) {
          loadedDyes.push(dye);
          if (loadedDyes.length >= 4) break; // Max 4 dyes
        }
      }
    }

    if (loadedDyes.length === 0) {
      logger.warn('[ComparisonTool] No valid dyes found in share URL');
      return false;
    }

    // Update state
    this.selectedDyes = loadedDyes;

    // Update DyeSelector UI
    if (this.dyeSelector) {
      this.dyeSelector.setSelectedDyes(loadedDyes);
    }

    // Calculate HSV and update displays
    this.calculateHSVValues();
    this.updateSelectedDyesDisplay();
    this.updateResults();
    this.updateShareButton();

    // Save to persistence
    this.saveSelectedDyes();

    logger.info(
      `[ComparisonTool] Loaded ${loadedDyes.length} dyes from share URL: ${loadedDyes.map((d) => d.name).join(', ')}`
    );

    // Fetch prices if enabled
    if (this.comparisonOptions.showMarketPrices) {
      void this.fetchAndUpdatePrices();
    }

    return true;
  }
}
