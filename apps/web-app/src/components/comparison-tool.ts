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
// Side-effect import registers <v4-result-card> (the named import is
// type-only in this file and gets elided on a direct /comparison load)
import '@components/v4/result-card';
import type { ResultCard, ResultCardData } from '@components/v4/result-card';
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import {
  ColorService,
  ConfigController,
  DyeService,
  LanguageService,
  MarketBoardService,
  StorageService,
} from '@services/index';
import { ICON_TOOL_COMPARISON } from '@shared/tool-icons';
import { ICON_BEAKER, ICON_SETTINGS, ICON_MARKET } from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import { customDyeLabel, isCustomDye, makeCustomDye } from '@shared/custom-dye';
import type { Dye } from '@xivdyetools/types';
import {
  BAND_METHOD_DP,
  classifyBandTier,
  BAND_VOCABULARY,
  roundToBandDisplay,
  type MatchingMethod,
} from '@xivdyetools/core';
import { METHOD_ORDER, methodShort, createMethodHelp } from '@components/metric-help';
import { ThemeService } from '@services/theme-service';
import type { ComparisonConfig } from '@shared/tool-config-types';
import '@components/v4/share-button';
import type { ShareButton } from '@components/v4/share-button';
import { openExportSheet } from '@components/export-sheet';
import { ShareService } from '@services/share-service';
import { formatGil } from '@shared/format';

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
  showCmyk: boolean;
  showMarketPrices: boolean;
  // 5.0 Ticket optional fields — not persisted per-tool; default all-on
  showHue?: boolean;
  showStain?: boolean;
  showSpectrum?: boolean;
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
  showCmyk: 'v3_comparison_show_cmyk',
  showMarketPrices: 'v3_comparison_show_prices',
  method: 'v5_comparison_method',
  matchThreshold: 'v5_comparison_threshold',
} as const;

/** Comparison tier colours: GREEN = CLOSE (the deliberate polarity
 *  inversion vs the Accessibility Checker; each tool matches its own
 *  shipped convention). Index = band tier 0..3 (SAME..FAR). */
const COMPARISON_TIER_COLORS_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'] as const;
const COMPARISON_TIER_COLORS_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'] as const;
const TIER_KEYS = ['tierSame', 'tierClose', 'tierNear', 'tierFar'] as const;

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
  showCmyk: false,
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
  private comparisonOptions: ComparisonOptions;
  // 7C Duel state
  private activePair: [number, number] | null = null;
  private method: MatchingMethod = 'ciede2000';
  private methodHelpOpen = false;
  private matchThreshold = 5;

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
  private pairChipsSection: HTMLElement | null = null;
  private pairChipsContainer: HTMLElement | null = null;
  private pairUnitTag: HTMLElement | null = null;
  private pairsHeading: HTMLElement | null = null;
  private duelSection: HTMLElement | null = null;
  private duelContainer: HTMLElement | null = null;

  // Section wrappers for visibility toggling
  private selectedDyesSection: HTMLElement | null = null;
  /** Export + Share row — lives outside the single-dye section so the duel
   *  (2–4 dyes) keeps both actions reachable */
  private actionsRow: HTMLElement | null = null;

  // Subscriptions
  private marketBoardEventCleanup: (() => void) | null = null;

  constructor(container: HTMLElement, options: ComparisonToolOptions) {
    super(container);
    this.options = options;

    // Load persisted options
    const savedMethod = StorageService.getItem<MatchingMethod>(STORAGE_KEYS.method);
    if (savedMethod && (METHOD_ORDER as readonly string[]).includes(savedMethod)) {
      this.method = savedMethod;
    }
    const savedThr = StorageService.getItem<number>(STORAGE_KEYS.matchThreshold);
    if (typeof savedThr === 'number' && savedThr >= 1 && savedThr <= 15) {
      this.matchThreshold = savedThr;
    }

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
      showCmyk: StorageService.getItem<boolean>(STORAGE_KEYS.showCmyk) ?? DEFAULT_OPTIONS.showCmyk,
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
    this.subs.add(
      LanguageService.subscribe(() => {
        this.update();
      })
    );

    // Subscribe to config changes from V4 ConfigSidebar
    this.subs.add(
      ConfigController.getInstance().subscribe('comparison', (config) => {
        this.setConfig(config);
      })
    );

    // Load from share URL first, then fall back to persisted dyes
    const loadedFromUrl = this.loadFromShareUrl();
    if (!loadedFromUrl) {
      // Load persisted dyes after DyeSelector is initialized
      this.loadPersistedDyes();
    }

    // Set initial charts layout and listen for viewport changes

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
    // The duel is the section actually on screen once a pair is active, and it
    // reads prices from the service at render time. Without this it keeps the
    // cards it built before the fetch resolved and shows "Market —" forever,
    // while the (hidden) grid behind it shows the real price. renderDuel()
    // no-ops when no pair is active.
    this.renderDuel();
  }

  /**
   * Load persisted dyes from LocalStorage
   */
  private loadPersistedDyes(): void {
    const savedIds = StorageService.getItem<number[]>(STORAGE_KEYS.selectedDyes);
    if (savedIds && savedIds.length > 0) {
      const dyeService = DyeService.getInstance();
      // BUG-042 (2026-07-18 audit): getDyeById returns null (not undefined)
      // for unknown IDs — the old `!== undefined` filter let nulls through as
      // "Dye" and crashed the tool on every load while the stale IDs stayed
      // persisted. Filter with != null and self-heal the stored list (even
      // when the selector isn't mounted, so bad IDs never linger).
      const dyes = savedIds
        .map((id) => dyeService.getDyeById(id))
        .filter((d): d is Dye => d != null);

      if (dyes.length !== savedIds.length) {
        StorageService.setItem(
          STORAGE_KEYS.selectedDyes,
          dyes.map((d) => d.id)
        );
      }

      if (dyes.length > 0 && this.dyeSelector) {
        this.dyeSelector.setSelectedDyes(dyes);
        this.selectedDyes = dyes;
        this.updateSelectedDyesDisplay();
        this.updateResults();
        this.updateDrawerSelectedDyesDisplay();
        this.updateShareButton(); // Enable share button after loading persisted dyes
        // Fetch prices for loaded dyes if Market Board is enabled
        if (this.comparisonOptions.showMarketPrices) {
          void this.fetchAndUpdatePrices();
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

    // Match line (the ΔE2000 SAME cut) from the Simple-Settings slider
    if (
      config.matchThreshold !== undefined &&
      config.matchThreshold !== this.matchThreshold &&
      config.matchThreshold >= 1 &&
      config.matchThreshold <= 15
    ) {
      this.matchThreshold = config.matchThreshold;
      StorageService.setItem(STORAGE_KEYS.matchThreshold, config.matchThreshold);
      needsRerender = true;
      logger.info(`[ComparisonTool] setConfig: matchThreshold -> ${config.matchThreshold}`);
    }

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
      if (opts.showCmyk !== undefined && opts.showCmyk !== this.comparisonOptions.showCmyk) {
        this.comparisonOptions.showCmyk = opts.showCmyk;
        StorageService.setItem(STORAGE_KEYS.showCmyk, opts.showCmyk);
        needsRerender = true;
        logger.info(`[ComparisonTool] setConfig: displayOptions.showCmyk -> ${opts.showCmyk}`);
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
        textContent: LanguageService.t('comparison.selectDyesToCompare'),
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
    const colorFormatsSection = this.createOptionsSection(LanguageService.t('config.colorFormats'));
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
  private createToggleRow(
    key: keyof ComparisonOptions & keyof typeof STORAGE_KEYS,
    label: string
  ): HTMLElement {
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
          void this.fetchAndUpdatePrices();
        }
      }

      this.renderSelectedDyesCards();
      this.updateResults();
    });

    row.appendChild(text);
    row.appendChild(toggleContainer);

    return row;
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

    // Export + Share row. Sits ABOVE the single-dye section rather than in
    // its header: with a pair or more the duel owns the cards and that
    // section is hidden, but export/share must stay reachable for 1–4 dyes.
    // Hidden by default via inline style - shown when dyes are selected.
    const actionsRow = this.createElement('div', {
      attributes: {
        style:
          'display: none; justify-content: flex-end; align-items: center; gap: 12px; margin-bottom: 8px;',
      },
    });
    this.actionsRow = actionsRow;
    const exportBtn = this.createElement('button', {
      textContent: LanguageService.t('common.export'),
      attributes: {
        type: 'button',
        'data-testid': 'comparison-export',
        style: [
          'background: none; border: none; color: var(--theme-primary);',
          'font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;',
          'text-transform: uppercase; letter-spacing: 0.5px;',
        ].join(' '),
      },
    });
    this.on(exportBtn, 'click', () => this.openComparisonExport());
    actionsRow.appendChild(exportBtn);

    // Share Button - v4-share-button custom element
    this.shareButton = document.createElement('v4-share-button') as ShareButton;
    this.shareButton.tool = 'comparison';
    this.shareButton.shareParams = this.getShareParams();
    this.shareButton.disabled = this.selectedDyes.length === 0;
    actionsRow.appendChild(this.shareButton);
    contentWrapper.appendChild(actionsRow);

    // Selected Dyes Cards Section (V4 result-cards in a horizontal row, centered)
    // Hidden by default via inline style - shown when exactly one dye is selected
    this.selectedDyesSection = this.createElement('div', {
      className: 'mb-6',
      attributes: { style: 'display: none;' },
    });
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

    // 7C: Pair chips — all six pairs, closest first
    this.pairChipsSection = this.createElement('div', {
      attributes: { style: 'display: none; margin-bottom: 18px;' },
    });
    const chipsHeader = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;',
      },
    });
    this.pairsHeading = this.createElement('span', {
      className: 'section-title',
      textContent: LanguageService.t('comparison.thisPair'),
    });
    chipsHeader.appendChild(this.pairsHeading);
    this.pairUnitTag = this.createElement('span', {
      attributes: {
        style:
          "font-family: 'Fragment Mono', monospace; font-size: 11px; color: var(--theme-text-muted); white-space: nowrap;",
      },
    });
    chipsHeader.appendChild(this.pairUnitTag);
    this.pairChipsSection.appendChild(chipsHeader);
    this.pairChipsContainer = this.createElement('div', {
      attributes: { style: 'display: flex; gap: 6px; flex-wrap: wrap; justify-content: center;' },
    });
    this.pairChipsSection.appendChild(this.pairChipsContainer);
    contentWrapper.appendChild(this.pairChipsSection);

    // 7C: The duel — one pair fills the workspace
    this.duelSection = this.createElement('div', {
      attributes: { style: 'display: none;' },
    });
    this.duelContainer = this.createElement('div');
    this.duelSection.appendChild(this.duelContainer);
    contentWrapper.appendChild(this.duelSection);

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
    const count = this.selectedDyes.length;
    const hasEnoughForAnalysis = count >= 2;

    this.showEmptyState(count === 0);

    // Export + Share stay reachable for any loaded selection (1–4 dyes)
    if (this.actionsRow) {
      this.actionsRow.style.display = count >= 1 ? 'flex' : 'none';
    }
    this.updateShareButton();

    // 7C: the plain card row only exists for a single loaded dye — with a
    // pair or more, the duel owns the cards
    if (this.selectedDyesSection) {
      this.selectedDyesSection.style.display = count === 1 ? 'block' : 'none';
    }
    if (count === 1) {
      this.renderSelectedDyesCards();
    }

    if (this.pairChipsSection) {
      this.pairChipsSection.style.display = hasEnoughForAnalysis ? 'block' : 'none';
    }
    if (this.duelSection) {
      this.duelSection.style.display = hasEnoughForAnalysis ? 'block' : 'none';
    }

    if (hasEnoughForAnalysis) {
      this.ensureActivePair();
      this.renderPairChips();
      this.renderDuel();
    }
  }

  // ==========================================================================
  // 7C Duel — metric plumbing
  // ==========================================================================

  /** Value between two dyes in the active method, display-rounded (the
   *  calibration classifies on displayed values) */
  private metricValue(a: Dye, b: Dye): number {
    return roundToBandDisplay(
      ColorService.getDistanceForMethod(a.hex, b.hex, this.method),
      this.method
    );
  }

  /** Band tier 0..3 in MATCH context; the ΔE2000 SAME cut follows the
   *  user's threshold slider (other methods carry the calibrated cuts) */
  private tierFor(value: number): 0 | 1 | 2 | 3 {
    if (this.method === 'ciede2000') {
      if (value < this.matchThreshold) return 0;
      const tier = classifyBandTier(value, this.method, 'match');
      return tier === 0 ? 1 : tier;
    }
    return classifyBandTier(value, this.method, 'match');
  }

  private tierColorFor(tier: 0 | 1 | 2 | 3): string {
    const ramp = ThemeService.isDarkMode()
      ? COMPARISON_TIER_COLORS_DARK
      : COMPARISON_TIER_COLORS_LIGHT;
    return ramp[tier];
  }

  private tierWord(tier: 0 | 1 | 2 | 3): string {
    return LanguageService.t(`comparison.${TIER_KEYS[tier]}`);
  }

  private fmtValue(value: number, method: MatchingMethod = this.method): string {
    return value.toFixed(BAND_METHOD_DP[method]);
  }

  /**
   * All pairs, closest first in the active method. Ties on the displayed
   * value fall back to the raw distance (the calibration note: integer
   * rounding creates ties — orderings need a sort fallback), so NEAREST
   * and the default pair are deterministic.
   */
  private sortedPairs(): Array<{ i: number; j: number; value: number; raw: number }> {
    const pairs: Array<{ i: number; j: number; value: number; raw: number }> = [];
    for (let i = 0; i < this.selectedDyes.length; i++) {
      for (let j = i + 1; j < this.selectedDyes.length; j++) {
        const raw = ColorService.getDistanceForMethod(
          this.selectedDyes[i].hex,
          this.selectedDyes[j].hex,
          this.method
        );
        pairs.push({ i, j, value: roundToBandDisplay(raw, this.method), raw });
      }
    }
    return pairs.sort((a, b) => a.value - b.value || a.raw - b.raw);
  }

  /** Keep the active pair valid; default to the closest pair */
  private ensureActivePair(): void {
    const count = this.selectedDyes.length;
    const valid =
      this.activePair &&
      this.activePair[0] < count &&
      this.activePair[1] < count &&
      this.activePair[0] !== this.activePair[1];
    if (!valid) {
      const closest = this.sortedPairs()[0];
      this.activePair = closest ? [closest.i, closest.j] : null;
    }
  }

  private localizedName(dye: Dye): string {
    return LanguageService.getDyeName(dye.itemID) || dye.name;
  }

  // ==========================================================================
  // 7C Duel — renderers
  // ==========================================================================

  private renderPairChips(): void {
    if (!this.pairChipsContainer) return;
    const host = this.pairChipsContainer;
    clearContainer(host);

    if (this.pairUnitTag) {
      this.pairUnitTag.textContent = methodShort(this.method);
    }

    const pairs = this.sortedPairs();

    // Counts rule: the heading is a template of n (1/3/6 pairs)
    if (this.pairsHeading) {
      this.pairsHeading.textContent =
        pairs.length === 1
          ? LanguageService.t('comparison.thisPair')
          : LanguageService.tInterpolate('comparison.allPairs', { n: pairs.length });
    }

    // Pairs sharing a displayed value are marked TIE (dp rounding creates
    // ties — common for DISTINGUISH at dp 0; the raw sort broke the order)
    const displayCounts = new Map<string, number>();
    for (const p of pairs) {
      const k = this.fmtValue(p.value);
      displayCounts.set(k, (displayCounts.get(k) ?? 0) + 1);
    }

    for (const pair of pairs) {
      const a = this.selectedDyes[pair.i];
      const b = this.selectedDyes[pair.j];
      const active =
        this.activePair !== null &&
        ((this.activePair[0] === pair.i && this.activePair[1] === pair.j) ||
          (this.activePair[0] === pair.j && this.activePair[1] === pair.i));
      const tier = this.tierFor(pair.value);

      const chip = this.createElement('button', {
        attributes: {
          type: 'button',
          'aria-pressed': String(active),
          style: `display: flex; align-items: center; gap: 7px; min-height: 44px; padding: 6px 10px; border-radius: 11px; cursor: pointer; font-family: inherit; text-align: left; background: var(--theme-card-background); border: 1px solid ${active ? 'var(--theme-primary)' : 'var(--theme-border)'};${active ? ' box-shadow: 0 0 0 1px var(--theme-primary);' : ''}`,
        },
      });

      const swatches = this.createElement('span', {
        attributes: {
          style:
            'display: flex; flex-shrink: 0; border-radius: 5px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(127,127,127,0.22);',
        },
      });
      for (const hex of [a.hex, b.hex]) {
        swatches.appendChild(
          this.createElement('span', {
            attributes: { style: `display: block; width: 13px; height: 24px; background: ${hex};` },
          })
        );
      }
      chip.appendChild(swatches);

      chip.appendChild(
        this.createElement('span', {
          textContent: `${this.localizedName(a)} × ${this.localizedName(b)}`,
          attributes: {
            style:
              'font-size: 11px; font-weight: 600; color: var(--theme-text); max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          },
        })
      );

      chip.appendChild(
        this.createElement('span', {
          textContent: this.fmtValue(pair.value),
          attributes: {
            style: `font-family: 'Fragment Mono', monospace; font-size: 11px; font-weight: 600; color: ${this.tierColorFor(tier)};`,
          },
        })
      );

      if ((displayCounts.get(this.fmtValue(pair.value)) ?? 0) > 1) {
        chip.appendChild(
          this.createElement('span', {
            textContent: LanguageService.t('comparison.tieBadge'),
            attributes: {
              style:
                "flex-shrink: 0; font-family: 'Fragment Mono', monospace; font-size: 8px; letter-spacing: 0.8px; padding: 2px 5px; border-radius: 4px; border: 1px solid var(--theme-border); color: var(--theme-text-muted);",
            },
          })
        );
      }

      this.on(chip, 'click', () => {
        this.activePair = [pair.i, pair.j];
        this.renderPairChips();
        this.renderDuel();
      });

      host.appendChild(chip);
    }
  }

  private renderDuel(): void {
    if (!this.duelContainer || !this.activePair) return;
    const host = this.duelContainer;
    clearContainer(host);

    const [ia, ib] = this.activePair;
    const a = this.selectedDyes[ia];
    const b = this.selectedDyes[ib];
    if (!a || !b) return;

    const value = this.metricValue(a, b);
    const tier = this.tierFor(value);
    const tone = this.tierColorFor(tier);
    const nameA = this.localizedName(a);
    const nameB = this.localizedName(b);

    // --- split panel ---
    const split = this.createElement('div', {
      attributes: {
        style:
          'position: relative; display: flex; border-radius: 14px; overflow: hidden; height: 130px; box-shadow: inset 0 0 0 1px rgba(127,127,127,0.22); margin-bottom: 12px;',
      },
    });
    for (const [dye, name] of [
      [a, nameA],
      [b, nameB],
    ] as Array<[Dye, string]>) {
      const half = this.createElement('div', {
        attributes: { style: `flex: 1; position: relative; background: ${dye.hex};` },
      });
      half.appendChild(
        this.createElement('span', {
          textContent: name,
          attributes: {
            style:
              'position: absolute; left: 8px; right: 8px; bottom: 8px; font-size: 11.5px; font-weight: 600; padding: 4px 7px; border-radius: 6px; background: rgba(10,10,12,0.45); color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          },
        })
      );
      split.appendChild(half);
    }
    const centerBadge = this.createElement('span', {
      attributes: {
        style:
          "position: absolute; top: 10px; left: 50%; transform: translateX(-50%); display: flex; align-items: baseline; gap: 5px; padding: 5px 10px; border-radius: 8px; background: rgba(10,10,12,0.55); font-family: 'Fragment Mono', monospace;",
      },
    });
    centerBadge.appendChild(
      this.createElement('span', {
        textContent: this.fmtValue(value),
        attributes: { style: 'font-size: 16px; font-weight: 700; color: #fff;' },
      })
    );
    centerBadge.appendChild(
      this.createElement('span', {
        textContent: methodShort(this.method),
        attributes: { style: 'font-size: 9px; color: rgba(255,255,255,0.75);' },
      })
    );
    split.appendChild(centerBadge);
    host.appendChild(split);

    // --- verdict ---
    host.appendChild(this.buildVerdict(a, b, nameA, nameB, value, tier, tone));

    // --- what actually differs ---
    host.appendChild(this.buildWhatDiffers(a, b));

    // --- seven readouts ---
    host.appendChild(this.buildSevenReadouts(a, b, nameA, nameB));

    // --- this pair, each measured against the other ---
    const cardsHeader = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin: 16px 0 8px;',
      },
    });
    cardsHeader.appendChild(
      this.createElement('span', {
        className: 'section-title',
        textContent: LanguageService.t('comparison.thisPair'),
      })
    );
    cardsHeader.appendChild(
      this.createElement('span', {
        textContent: LanguageService.t('comparison.eachOther'),
        attributes: { style: 'font-size: 11px; color: var(--theme-text-muted);' },
      })
    );
    host.appendChild(cardsHeader);

    const cardsRow = this.createElement('div', {
      attributes: {
        style: 'display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;',
      },
    });
    const de2000 = roundToBandDisplay(
      ColorService.getDistanceForMethod(a.hex, b.hex, 'ciede2000'),
      'ciede2000'
    );
    for (const [dye, other] of [
      [a, b],
      [b, a],
    ] as Array<[Dye, Dye]>) {
      const card = document.createElement('v4-result-card') as ResultCard;
      card.style.width = '280px';
      card.style.flexShrink = '0';
      const cardData: ResultCardData = {
        dye,
        originalColor: other.hex,
        matchedColor: dye.hex,
        deltaE: de2000,
        vendorCost: dye.cost,
      };
      if (this.comparisonOptions.showMarketPrices) {
        const marketBoardService = MarketBoardService.getInstance();
        const priceData = marketBoardService.getPriceForDye(dye.itemID);
        if (priceData) {
          cardData.price = priceData.currentMinPrice;
          cardData.marketServer = marketBoardService.getWorldNameForPrice(priceData);
        }
      }
      card.data = cardData;
      card.showHex = this.comparisonOptions.showHex;
      card.showRgb = this.comparisonOptions.showRgb;
      card.showHsv = this.comparisonOptions.showHsv;
      card.showLab = this.comparisonOptions.showLab;
      card.showCmyk = this.comparisonOptions.showCmyk;
      card.showDeltaE = true; // the card keeps ΔE2000 whatever the switch says
      card.showHue = this.comparisonOptions.showHue ?? true;
      card.showStain = this.comparisonOptions.showStain ?? true;
      card.showConsolidation = this.comparisonOptions.showSpectrum ?? true;
      card.showPrice = this.comparisonOptions.showMarketPrices;
      card.showAcquisition = true; // once the colours tie, this is the decision
      card.primaryActionLabel = LanguageService.t('common.remove');
      card.addEventListener('card-select', () => this.removeDye(dye));
      cardsRow.appendChild(card);
    }
    host.appendChild(cardsRow);

    // --- bench ---
    const benchDyes = this.selectedDyes.filter((_, idx) => idx !== ia && idx !== ib);
    if (benchDyes.length > 0) {
      host.appendChild(
        this.createElement('div', {
          className: 'section-title',
          textContent: LanguageService.t('comparison.bench'),
          attributes: { style: 'display: block; margin: 16px 0 8px;' },
        })
      );
      const benchRow = this.createElement('div', {
        attributes: { style: 'display: flex; gap: 8px; flex-wrap: wrap;' },
      });
      for (const dye of benchDyes) {
        const idx = this.selectedDyes.indexOf(dye);
        const chip = this.createElement('button', {
          attributes: {
            type: 'button',
            title: this.localizedName(dye),
            style:
              'display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 6px 12px; border-radius: 11px; cursor: pointer; font-family: inherit; background: var(--theme-card-background); border: 1px solid var(--theme-border);',
          },
        });
        chip.appendChild(
          this.createElement('span', {
            attributes: {
              style: `display: block; width: 20px; height: 20px; border-radius: 6px; background: ${dye.hex}; box-shadow: inset 0 0 0 1px rgba(127,127,127,0.22);`,
            },
          })
        );
        chip.appendChild(
          this.createElement('span', {
            textContent: this.localizedName(dye),
            attributes: { style: 'font-size: 12px; font-weight: 600; color: var(--theme-text);' },
          })
        );
        // Swapping a bench dye in replaces the pair's second member
        this.on(chip, 'click', () => {
          this.activePair = [ia, idx];
          this.renderPairChips();
          this.renderDuel();
        });
        benchRow.appendChild(chip);
      }
      host.appendChild(benchRow);
    }
  }

  private buildVerdict(
    a: Dye,
    b: Dye,
    nameA: string,
    nameB: string,
    value: number,
    tier: 0 | 1 | 2 | 3,
    tone: string
  ): HTMLElement {
    const t = (key: string): string => LanguageService.t(`comparison.${key}`);
    const w = `${this.fmtValue(value)} ${methodShort(this.method)}`;

    // The match line the SAME verdict cites: ΔE2000 follows the user's
    // slider; every other method carries its fixed calibrated SAME cut,
    // printed with its own tag (never ΔE2000's number under another method)
    const matchLine =
      this.method === 'ciede2000'
        ? `ΔE ${this.matchThreshold}`
        : `${methodShort(this.method)} ${this.fmtValue(BAND_VOCABULARY.match[this.method].cuts[0], this.method)}`;

    let badge: string;
    let headline: string;
    let sub: string;
    if (tier === 0) {
      badge = t('badgeSame');
      headline = LanguageService.tInterpolate('comparison.headSame', { a: nameA, b: nameB });
      sub = LanguageService.tInterpolate('comparison.subSame', {
        w,
        thr: matchLine,
      });
    } else if (tier === 1) {
      badge = t('badgeClose');
      headline = LanguageService.tInterpolate('comparison.headClose', { a: nameA, b: nameB });
      sub = LanguageService.tInterpolate('comparison.subClose', { w });
    } else {
      badge = t('badgeWide');
      headline = LanguageService.tInterpolate('comparison.headWide', { a: nameA, b: nameB });
      sub = LanguageService.tInterpolate('comparison.subWide', { w });
    }

    const box = this.createElement('div', {
      attributes: {
        style: `display: flex; gap: 10px; padding: 12px; border-radius: 13px; margin-bottom: 14px; background: color-mix(in srgb, ${tone} 9%, transparent); border: 1px solid color-mix(in srgb, ${tone} 40%, transparent);`,
      },
    });
    box.appendChild(
      this.createElement('span', {
        attributes: {
          style: `display: block; width: 4px; flex-shrink: 0; border-radius: 2px; background: ${tone};`,
        },
      })
    );
    const text = this.createElement('span', {
      attributes: {
        style: 'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px;',
      },
    });
    text.appendChild(
      this.createElement('span', {
        textContent: badge,
        attributes: {
          style: `align-self: flex-start; font-family: 'Fragment Mono', monospace; font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: ${tone}; color: ${ThemeService.isDarkMode() ? '#0A0A0A' : '#FFFFFF'};`,
        },
      })
    );
    text.appendChild(
      this.createElement('span', {
        textContent: headline,
        attributes: {
          style: 'font-size: 15px; font-weight: 600; line-height: 1.25; color: var(--theme-text);',
        },
      })
    );
    text.appendChild(
      this.createElement('span', {
        textContent: sub,
        attributes: {
          style: 'font-size: 11.5px; line-height: 1.45; color: var(--theme-text-muted);',
        },
      })
    );

    // The cost line — appended on every tier when a price is known (once
    // the colours tie it IS the decision; on SUBSTITUTABLE it still is)
    let costLine: string | null = null;
    const aVendor = a.cost > 0 && a.currency === 'Gil';
    const bVendor = b.cost > 0 && b.currency === 'Gil';
    if (aVendor && bVendor) {
      if (a.cost === b.cost) {
        costLine = t('costSame');
      } else {
        const cheap = a.cost < b.cost ? nameA : nameB;
        const saving = formatGil(Math.abs(a.cost - b.cost));
        costLine = LanguageService.tInterpolate('comparison.costDiff', { cheap, saving });
      }
    } else if (aVendor !== bVendor) {
      costLine = LanguageService.tInterpolate('comparison.costUnknown', {
        a: aVendor ? nameA : nameB,
        b: aVendor ? nameB : nameA,
      });
    }
    if (costLine) {
      text.appendChild(
        this.createElement('span', {
          textContent: costLine,
          attributes: {
            style: 'font-size: 11.5px; line-height: 1.45; color: var(--theme-text);',
          },
        })
      );
    }

    box.appendChild(text);
    return box;
  }

  private buildWhatDiffers(a: Dye, b: Dye): HTMLElement {
    const t = (key: string): string => LanguageService.t(`comparison.${key}`);
    const wrap = this.createElement('div', { attributes: { style: 'margin-bottom: 14px;' } });

    const header = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--theme-border);',
      },
    });
    const left = this.createElement('span', {
      attributes: { style: 'display: flex; align-items: center; gap: 4px;' },
    });
    left.appendChild(
      this.createElement('span', {
        className: 'section-title',
        textContent: t('whatDiffers'),
      })
    );
    const helpBtn = this.createElement('button', {
      textContent: 'ⓘ',
      attributes: {
        type: 'button',
        'aria-label': LanguageService.tInterpolate('comparison.methodsHeading', {
          n: METHOD_ORDER.length,
        }),
        style:
          'width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; background: transparent; cursor: pointer; color: var(--theme-text-muted); font-size: 14px;',
      },
    });
    this.on(helpBtn, 'click', () => {
      this.methodHelpOpen = !this.methodHelpOpen;
      this.renderDuel();
    });
    left.appendChild(helpBtn);
    header.appendChild(left);
    header.appendChild(
      this.createElement('span', {
        textContent: methodShort(this.method),
        attributes: {
          style:
            "font-family: 'Fragment Mono', monospace; font-size: 10px; color: var(--theme-text-muted);",
        },
      })
    );
    wrap.appendChild(header);

    if (this.methodHelpOpen) {
      wrap.appendChild(
        createMethodHelp({
          method: this.method,
          dark: ThemeService.isDarkMode(),
          onMethodChange: (next) => {
            this.method = next;
            StorageService.setItem(STORAGE_KEYS.method, next);
            this.renderPairChips();
            this.renderDuel();
          },
        })
      );
    }

    const hsvA = ColorService.hexToHsv(a.hex);
    const hsvB = ColorService.hexToHsv(b.hex);
    const hueDiff = Math.min(Math.abs(hsvA.h - hsvB.h), 360 - Math.abs(hsvA.h - hsvB.h));
    // LIGHTNESS is Lab L* with a signed delta (HSV V calls saturated red
    // and white both 100); sign reads B relative to A
    const lA = Math.round(ColorService.hexToLab(a.hex).L);
    const lB = Math.round(ColorService.hexToLab(b.hex).L);
    const lDiff = lB - lA;
    // A coffer has no purchase price — VENDOR prints gil only, and Δ never
    // crosses currencies (the "price 1 = one venture" defect class)
    const aGil = a.cost > 0 && a.currency === 'Gil';
    const bGil = b.cost > 0 && b.currency === 'Gil';
    // A custom colour has no acquisition — print the localized "Custom"
    // label instead of running the sentinel through getAcquisition().
    const sourceLabel = (d: Dye): string =>
      isCustomDye(d)
        ? customDyeLabel()
        : LanguageService.getAcquisition(d.acquisition) || d.acquisition;
    const rows: Array<[string, string, string, string]> = [
      [
        t('deltaLight'),
        `L* ${lA}`,
        `L* ${lB}`,
        `Δ ${lDiff > 0 ? '+' : lDiff < 0 ? '−' : ''}${Math.abs(lDiff)}`,
      ],
      [
        t('deltaSat'),
        `${Math.round(hsvA.s)}%`,
        `${Math.round(hsvB.s)}%`,
        `Δ ${Math.abs(Math.round(hsvA.s) - Math.round(hsvB.s))}`,
      ],
      [
        t('deltaHue'),
        `${Math.round(hsvA.h)}°`,
        `${Math.round(hsvB.h)}°`,
        `Δ ${Math.round(hueDiff)}°`,
      ],
      [
        t('deltaVendor'),
        aGil ? `${a.cost}` : '—',
        bGil ? `${b.cost}` : '—',
        aGil && bGil ? `Δ ${Math.abs(a.cost - b.cost)}` : '—',
      ],
      [
        t('deltaSource'),
        sourceLabel(a),
        sourceLabel(b),
        a.acquisition === b.acquisition ? t('same') : t('differs'),
      ],
    ];

    const table = this.createElement('div', {
      attributes: { style: 'display: flex; flex-direction: column; gap: 4px;' },
    });
    for (const [label, va, vb, diff] of rows) {
      const row = this.createElement('div', {
        attributes: {
          style:
            'display: flex; align-items: center; gap: 8px; min-height: 34px; padding: 4px 10px; border-radius: 8px; background: var(--theme-card-background);',
        },
      });
      row.appendChild(
        this.createElement('span', {
          textContent: label,
          attributes: {
            style:
              "width: 92px; flex-shrink: 0; font-family: 'Fragment Mono', monospace; font-size: 9px; letter-spacing: 0.8px; color: var(--theme-text-muted);",
          },
        })
      );
      for (const v of [va, vb]) {
        row.appendChild(
          this.createElement('span', {
            textContent: v,
            attributes: {
              style:
                'flex: 1; min-width: 0; font-size: 12px; font-weight: 600; color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
            },
          })
        );
      }
      row.appendChild(
        this.createElement('span', {
          textContent: diff,
          attributes: {
            style:
              "flex-shrink: 0; font-family: 'Fragment Mono', monospace; font-size: 11px; color: var(--theme-text-muted);",
          },
        })
      );
      table.appendChild(row);
    }
    wrap.appendChild(table);
    return wrap;
  }

  private buildSevenReadouts(a: Dye, b: Dye, nameA: string, nameB: string): HTMLElement {
    const wrap = this.createElement('div', { attributes: { style: 'margin-bottom: 4px;' } });

    const header = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid var(--theme-border);',
      },
    });
    header.appendChild(
      this.createElement('span', {
        className: 'section-title',
        textContent: LanguageService.tInterpolate('comparison.methodsHeading', {
          n: METHOD_ORDER.length,
        }),
      })
    );
    header.appendChild(
      this.createElement('span', {
        textContent: `${nameA} ↔ ${nameB}`,
        attributes: {
          style:
            'font-size: 11px; color: var(--theme-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        },
      })
    );
    wrap.appendChild(header);

    const list = this.createElement('div', {
      attributes: { style: 'display: flex; flex-direction: column; gap: 4px;' },
    });

    const dark = ThemeService.isDarkMode();
    const ramp = dark ? COMPARISON_TIER_COLORS_DARK : COMPARISON_TIER_COLORS_LIGHT;
    const addRow = (
      tag: string,
      value: string,
      tier: 0 | 1 | 2 | 3 | null,
      topRule = false,
      onTap?: () => void,
      active = false
    ): void => {
      // RATIO prints last after a drawn rule, not just a gap
      if (topRule) {
        list.appendChild(
          this.createElement('div', {
            attributes: {
              style:
                'height: 1px; flex-shrink: 0; background: var(--theme-border); margin: 6px 2px 2px;',
            },
          })
        );
      }
      // Method rows are tiles: tapping one switches the tool's method
      const row = this.createElement(onTap ? 'button' : 'div', {
        attributes: {
          ...(onTap ? { type: 'button', 'aria-pressed': String(active) } : {}),
          style: `display: flex; align-items: center; gap: 8px; min-height: 36px; padding: 4px 10px; border-radius: 8px; width: 100%; font-family: inherit; text-align: left; background: var(--theme-card-background);${
            onTap
              ? ` cursor: pointer; border: 1px solid ${active ? 'var(--theme-primary)' : 'var(--theme-border)'};`
              : ' border: 1px solid transparent;'
          }`,
        },
      });
      if (onTap) this.on(row, 'click', onTap);
      row.appendChild(
        this.createElement('span', {
          textContent: tag,
          attributes: {
            style:
              "flex: 1; min-width: 0; font-family: 'Fragment Mono', monospace; font-size: 10px; letter-spacing: 0.6px; color: var(--theme-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;",
          },
        })
      );
      row.appendChild(
        this.createElement('span', {
          textContent: value,
          attributes: {
            style:
              "flex-shrink: 0; font-family: 'Fragment Mono', monospace; font-size: 13px; font-weight: 600; color: var(--theme-text);",
          },
        })
      );
      row.appendChild(
        this.createElement('span', {
          textContent: tier === null ? '—' : this.tierWord(tier),
          attributes: {
            style: `width: 72px; text-align: right; flex-shrink: 0; font-family: 'Fragment Mono', monospace; font-size: 9.5px; letter-spacing: 0.6px; color: ${tier === null ? 'var(--theme-text-muted)' : ramp[tier]};`,
          },
        })
      );
      list.appendChild(row);
    };

    for (const method of METHOD_ORDER) {
      const raw = ColorService.getDistanceForMethod(a.hex, b.hex, method);
      const value = roundToBandDisplay(raw, method);
      let tier = classifyBandTier(value, method, 'match');
      if (method === 'ciede2000' && value < this.matchThreshold) tier = 0;
      const active = method === this.method;
      addRow(
        methodShort(method),
        this.fmtValue(value, method),
        tier,
        false,
        () => {
          if (method === this.method) return;
          this.method = method;
          StorageService.setItem(STORAGE_KEYS.method, method);
          this.renderPairChips();
          this.renderDuel();
        },
        active
      );
    }

    // RATIO, last, after a rule — it is not a colour difference, so it
    // carries no tier word (the calibration found no lightness cut separates
    // the lower MATCH tiers at all: RATIO_BANDS.comparison is [1,1,1])
    const ratio = ColorService.getContrastRatio(a.hex, b.hex);
    const rounded = Math.round(ratio * 100) / 100;
    addRow('RATIO', `${rounded.toFixed(2)}:1`, null, true);

    wrap.appendChild(list);
    return wrap;
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
      card.showCmyk = this.comparisonOptions.showCmyk;
      card.showDeltaE = false; // No Delta-E in comparison context
      card.showHue = this.comparisonOptions.showHue ?? true;
      card.showStain = this.comparisonOptions.showStain ?? true;
      card.showConsolidation = this.comparisonOptions.showSpectrum ?? true;
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
    // The empty state hides everything, actions row included
    if (show && this.actionsRow) {
      this.actionsRow.style.display = 'none';
    }
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

        // Sync desktop selector
        this.dyeSelector?.setSelectedDyes(this.selectedDyes);

        // Update displays
        this.updateSelectedDyesDisplay();
        this.updateDrawerSelectedDyesDisplay();
        this.updateResults();
        this.saveSelectedDyes();
        // Fetch prices for newly selected dyes if Market Board is enabled
        if (this.comparisonOptions.showMarketPrices && this.selectedDyes.length > 0) {
          void this.fetchAndUpdatePrices();
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
        textContent: LanguageService.t('comparison.selectDyesToCompare'),
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
    this.activePair = null;

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
    if (this.pairChipsContainer) {
      clearContainer(this.pairChipsContainer);
    }
    if (this.duelContainer) {
      clearContainer(this.duelContainer);
    }

    // Show empty state and hide the duel sections
    this.updateResults();
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

  /**
   * Select an arbitrary colour from the Color Palette drawer's hex field /
   * native picker ("arbitrary colours enter every picker"). Wraps the hex
   * in a virtual dye; it duels like any dye but has no stainID, so it never
   * persists across sessions or enters share URLs.
   */
  public selectCustomColor(hex: string): void {
    if (!hex) return;

    this.addDye(makeCustomDye(hex));
  }

  // ============================================================================
  // Share Functionality
  // ============================================================================

  /**
   * Get parameters for generating a share URL
   */
  /**
   * Open the shared export sheet over the compared set. Comparison entries have
   * no source colour — the dyes ARE the input here, so nothing drifted and
   * there is no second half to publish.
   */
  private openComparisonExport(): void {
    openExportSheet({
      tool: 'comparison',
      title: LanguageService.t('comparison.selectedDyes'),
      entries: this.selectedDyes.map((dye, index) => ({
        key: `dye-${index + 1}`,
        dye,
      })),
    });
  }

  private getShareParams(): Record<string, unknown> {
    if (this.selectedDyes.length === 0) {
      return {};
    }

    // Virtual custom colours carry no stainID and are excluded
    return {
      dyes: this.selectedDyes.map((d) => d.stainID).filter((id): id is number => id !== null),
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
    const loadedDyes: Dye[] = [];

    for (const itemId of params.dyes) {
      if (typeof itemId === 'number') {
        // Find by itemID
        const dye = ShareService.resolveSharedDye(itemId);
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

    // Update displays
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
