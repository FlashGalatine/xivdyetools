/**
 * XIV Dye Tools v4.0.0 - Extractor Tool Component (Palette Extractor)
 *
 * V4 Renamed: matcher-tool.ts → extractor-tool.ts
 * Extracts color palettes from uploaded images and finds matching FFXIV dyes.
 *
 * Left Panel: Image upload, color picker, sample settings, filters, market board
 * Right Panel: Image canvas with zoom, matched dye results, recent colors
 *
 * @module components/tools/extractor-tool
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { ImageUploadDisplay } from '@components/image-upload-display';
import { ColorPickerDisplay } from '@components/color-picker-display';
import { ImageZoomController } from '@components/image-zoom-controller';
import { RecentColorsPanel } from '@components/recent-colors-panel';
import { MarketBoard } from '@components/market-board';
import { openExportSheet } from '@components/export-sheet';
import {
  ColorService,
  ConfigController,
  dyeService,
  LanguageService,
  MarketBoardService,
  StorageService,
  ToastService,
  // WEB-REF-003 Phase 3: Shared panel builders
  buildMarketPanel,
} from '@services/index';
import { WorldService } from '@services/world-service';
import {
  ICON_IMAGE,
  ICON_PALETTE,
  ICON_SETTINGS,
  ICON_CLIPBOARD,
  ICON_CAMERA,
  ICON_LOCK,
  ICON_REFRESH,
  ICON_CLOSE,
} from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { indexedDBService, STORES } from '@services/indexeddb-service';
import { clearContainer } from '@shared/utils';
import type { Dye, DyeWithDistance, PriceData, RGB } from '@xivdyetools/types';
import type {
  ExtractorConfig,
  DisplayOptionsConfig,
  MatchingMethod,
  DyeFiltersConfig,
} from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS, DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import { isDyeExcluded, filterDyes } from '@shared/dye-filter-utils';
import {
  DEFAULT_MATCHING_METHOD,
  normalizeMatchingMethod,
  PaletteService,
  type PaletteMatch,
} from '@xivdyetools/core';
import type { ResultCard, ResultCardData, ContextAction } from '@components/v4/result-card';
import '@components/v4/result-card';

// ============================================================================
// Types and Constants
// ============================================================================

export interface ExtractorToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Storage keys for v3 matcher tool
 */
const STORAGE_KEYS = {
  sampleSize: 'v3_matcher_sample_size',
  paletteMode: 'v3_matcher_palette_mode',
  paletteColorCount: 'v3_matcher_palette_count',
  vibrancyBoost: 'v3_matcher_vibrancy_boost',
  imageDataUrl: 'v3_matcher_image',
  selectedColor: 'v3_matcher_color',
  extractedColors: 'v3_matcher_extracted_colors',
} as const;

// OPT-012: images persist to IndexedDB (image_cache store) instead of
// localStorage — a 2 MB data-URL string consumed up to ~80% of the shared
// ~5 MB localStorage budget and made every later setItem silently fail on
// QuotaExceededError. IndexedDB has no such practical constraint, so the cap
// only bounds memory/extraction cost.
const MAX_IMAGE_STORAGE_SIZE = 8 * 1024 * 1024;

// ============================================================================
// 3C "Loupe + roll" workspace constants
// ============================================================================

/**
 * 3C: the only sanctioned hardcoded grounds are the drawn on-image overlays —
 * chips sitting on arbitrary image pixels use the prototype's dark glass in
 * both themes (rgba(10,10,12,…) per the confirmed frames).
 */
const OVERLAY_BG = 'rgba(10, 10, 12, 0.66)';
const OVERLAY_CHIP_BG = 'rgba(10, 10, 12, 0.72)';

/** Accent tints derived from the theme accent (accent-soft / accent-border). */
const ACCENT_SOFT = 'color-mix(in srgb, var(--theme-primary) 14%, transparent)';
const ACCENT_BORDER = 'color-mix(in srgb, var(--theme-primary) 45%, transparent)';

/** Neutral placeholder for the loupe-colour chips before the first sample. */
const LOUPE_PLACEHOLDER = 'color-mix(in srgb, var(--theme-text-muted) 35%, transparent)';

/**
 * Responsive rules for the 3C workspace. Media queries cannot live in inline
 * styles; the tool renders inside the shell's shadow DOM, which allows a
 * scoped <style> element (same pattern as the shell's v5-results-grid rule).
 * Mobile (≤768px) keeps the same one-column flow per the prototype: 244px
 * image card, camera-first empty state, 44px Auto-extract target.
 */
const X3C_RESPONSIVE_CSS = `
  .x3c-workspace {
    display: flex; flex-direction: column; gap: 14px;
    height: 100%; width: 100%; max-width: 1400px; margin: 0 auto;
    padding: 18px; box-sizing: border-box;
  }
  .x3c-image-card { height: min(420px, 45vh); }
  .x3c-drop-title { font-size: 19px; }
  .x3c-dt-actions { display: flex; gap: 9px; }
  .x3c-mb-actions { display: none; }
  .x3c-dt-text { display: block; }
  .x3c-mb-text { display: none; }
  @media (max-width: 768px) {
    .x3c-workspace { padding: 12px; gap: 10px; }
    .x3c-image-card { height: 244px; }
    .x3c-drop-title { font-size: 17px; }
    .x3c-dt-actions { display: none; }
    .x3c-mb-actions { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 236px; }
    .x3c-dt-text { display: none; }
    .x3c-mb-text { display: block; }
    .x3c-auto-btn { min-height: 44px; }
  }
`;

// ============================================================================
// MatcherTool Component
// ============================================================================

/**
 * Matcher Tool - v3 Two-Panel Layout
 *
 * Match colors from images to FFXIV dyes.
 * Integrates existing v2 components into the new panel structure.
 */
export class ExtractorTool extends BaseComponent {
  private options: ExtractorToolOptions;

  // State
  private selectedColor: string | null = null;
  private sampleSize: number;
  private paletteMode: boolean;
  private paletteColorCount: number = 4;
  private vibrancyBoost: boolean = true;
  private matchedDyes: DyeWithDistance[] = [];
  // WEB-REF-003 Phase 4: MarketBoardService (shared price cache with race condition protection)
  private marketBoardService: MarketBoardService;

  // Getters for service state (replaces local showPrices and priceData fields)
  private get showPrices(): boolean {
    return this.marketBoardService.getShowPrices();
  }
  // OPT-027 (2026-07-18 audit): read-only view, no per-access map clone —
  // this getter is hit inside per-card render loops
  private get priceData(): ReadonlyMap<number, PriceData> {
    return this.marketBoardService.getPricesView();
  }
  private currentImage: HTMLImageElement | null = null;
  private displayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };
  private matchingMethod: MatchingMethod = DEFAULT_MATCHING_METHOD;
  private preventDuplicates: boolean = true;

  // Child components
  private imageUpload: ImageUploadDisplay | null = null;
  private colorPicker: ColorPickerDisplay | null = null;
  private imageZoom: ImageZoomController | null = null;
  private recentColors: RecentColorsPanel | null = null;
  private dyeFiltersConfig: DyeFiltersConfig = { ...DEFAULT_DYE_FILTERS };
  private marketBoard: MarketBoard | null = null;
  private marketPanel: CollapsiblePanel | null = null;
  private paletteService: PaletteService;

  // Collapsible section panels
  private imageSourcePanel: CollapsiblePanel | null = null;
  private colorSelectionPanel: CollapsiblePanel | null = null;
  private optionsPanel: CollapsiblePanel | null = null;

  // The roll: sampled + auto-extracted picks (persisted history)
  private extractedColorsHistory: Array<{ hex: string; timestamp: number }> = [];
  private readonly maxExtractedColors: number = 20;
  private lastPixelSampleHex: string | null = null;
  /**
   * Dominance labels for auto-extracted picks (lowercase hex → "34%"),
   * snapshotted when a K-means run fills the roll so the labels survive
   * focus clicks (which clear lastPaletteResults).
   */
  private rollDominanceByHex: Map<string, string> = new Map();

  // Color info card (right panel, above results)
  private colorInfoCardContainer: HTMLElement | null = null;

  // DOM References
  private sampleSlider: HTMLInputElement | null = null;
  private sampleDisplay: HTMLElement | null = null;
  private paletteModeCheckbox: HTMLInputElement | null = null;
  private paletteOptionsContainer: HTMLElement | null = null;
  private colorCountSlider: HTMLInputElement | null = null;
  private colorCountDisplay: HTMLElement | null = null;
  private extractPaletteBtn: HTMLButtonElement | null = null;
  private exportBtn: HTMLButtonElement | null = null;
  private resultsContainer: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;
  private resultsTitleElement: HTMLElement | null = null;
  private resultsCountElement: HTMLElement | null = null;
  private dropZone: HTMLElement | null = null;
  private dropZoneFileInput: HTMLInputElement | null = null;
  private cameraFileInput: HTMLInputElement | null = null;

  // 3C flow containers (empty drop-zone state vs loaded image/roll/results)
  private emptyFlowElement: HTMLElement | null = null;
  private loadedFlowElement: HTMLElement | null = null;
  private imageCardElement: HTMLElement | null = null;

  // 3C loupe overlay + roll strip
  private loupeElement: HTMLElement | null = null;
  private loupeHexChip: HTMLElement | null = null;
  private hintSwatchElement: HTMLElement | null = null;
  private addPickChipElement: HTMLElement | null = null;
  private rollSectionElement: HTMLElement | null = null;
  private rollStripElement: HTMLElement | null = null;
  private rollAutoBtn: HTMLButtonElement | null = null;
  /** The colour the loupe last held — feeds the hint chip and the + tile. */
  private currentLoupeHex: string | null = null;

  // Palette extraction state
  private lastPaletteResults: PaletteMatch[] = [];
  /** V4 result card elements for updating prices after fetch */
  private v4ResultCards: ResultCard[] = [];
  /** Last market fetch error code for display on cards (e.g., "H429", "NOFF") */
  private lastMarketError: string | undefined = undefined;

  // Subscriptions

  constructor(container: HTMLElement, options: ExtractorToolOptions) {
    super(container);
    this.options = options;

    // Load persisted state
    this.sampleSize = StorageService.getItem<number>(STORAGE_KEYS.sampleSize) ?? 5;
    this.paletteMode = StorageService.getItem<boolean>(STORAGE_KEYS.paletteMode) ?? true; // v4: Default to palette mode
    this.paletteColorCount = StorageService.getItem<number>(STORAGE_KEYS.paletteColorCount) ?? 4;
    this.vibrancyBoost = StorageService.getItem<boolean>(STORAGE_KEYS.vibrancyBoost) ?? true;

    // Seed from the persisted extractor config (v4 unified config) so a stored
    // choice survives reload and the tool agrees with what the sidebar shows.
    // Suite default is ΔE2000; normalized so persisted 4.x values
    // (hyab, oklch-weighted) migrate instead of reaching the matcher.
    const extractorConfig = ConfigController.getInstance().getConfig('extractor');
    this.matchingMethod = normalizeMatchingMethod(
      extractorConfig.matchingMethod ?? DEFAULT_MATCHING_METHOD
    );
    if (extractorConfig.preventDuplicates !== undefined) {
      this.preventDuplicates = extractorConfig.preventDuplicates;
    }
    if (extractorConfig.dyeFilters) {
      this.dyeFiltersConfig = { ...extractorConfig.dyeFilters };
    }
    if (extractorConfig.displayOptions) {
      this.displayOptions = { ...this.displayOptions, ...extractorConfig.displayOptions };
    }

    // WEB-REF-003 Phase 4: Initialize MarketBoardService (shared price cache)
    this.marketBoardService = MarketBoardService.getInstance();

    // Initialize palette service
    this.paletteService = new PaletteService();
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  renderContent(): void {
    this.renderLeftPanel();
    this.renderRightPanel();

    this.element = this.container;
  }

  bindEvents(): void {
    // FIX: Events from child components bubble through leftPanel, not this.container
    // The container is a detached div, so we must listen on the actual panel elements
    const leftPanel = this.options.leftPanel;

    // Image upload events - listen on leftPanel where ImageUploadDisplay is rendered
    this.onPanelEvent(leftPanel, 'image-loaded', (event: CustomEvent) => {
      const { image, dataUrl } = event.detail;
      this.onImageLoaded(image, dataUrl);
    });

    this.onPanelEvent(leftPanel, 'error', (event: CustomEvent) => {
      const message = event.detail?.message || 'Failed to load image';
      logger.error('[MatcherTool] Image upload error:', event.detail);
      ToastService.error(message);
    });

    // Color picker events
    this.onPanelEvent(leftPanel, 'color-selected', (event: CustomEvent) => {
      const { color } = event.detail;
      this.matchColor(color);
    });

    // Paste from clipboard (document-level listener)
    // Handles Ctrl+V / Cmd+V paste with image data
    this.on(document, 'paste', (e: Event) => {
      const pasteEvent = e as ClipboardEvent;
      const items = pasteEvent.clipboardData?.items;

      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            pasteEvent.preventDefault();
            const blob = items[i].getAsFile();
            if (blob) {
              this.handleDroppedFile(blob);
            }
          }
        }
      }
    });

    // Market board events are handled directly on marketContent in renderMarketPanel()
    // Events don't bubble reliably through CollapsiblePanel, so we use direct listeners there
  }

  /**
   * Listen for custom events on a specific panel element
   * This is needed because child components emit events that bubble through their
   * panel containers, not through this.container (which may be detached from DOM)
   */
  private onPanelEvent(
    panel: HTMLElement,
    eventName: string,
    handler: (event: CustomEvent) => void
  ): void {
    const boundHandler = (event: Event) => {
      if (event instanceof CustomEvent) {
        handler.call(this, event);
      }
    };

    panel.addEventListener(eventName, boundHandler);

    // Track for cleanup using unique key
    const listenerKey = `panel_${eventName}_${Date.now()}_${this.listeners.size}`;
    this.listeners.set(listenerKey, {
      target: panel,
      event: eventName,
      handler: boundHandler,
    });
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
      ConfigController.getInstance().subscribe('extractor', (config) => {
        this.setConfig(config);
      })
    );

    // Subscribe to market config changes (from ConfigSidebar)
    // Re-render results and fetch prices when server changes
    this.subs.add(
      ConfigController.getInstance().subscribe('market', (config) => {
        if (this.lastPaletteResults.length > 0) {
          this.renderPaletteResults(this.lastPaletteResults);
          if (config.showPrices) {
            void this.fetchPricesForMatches();
          }
        } else if (this.matchedDyes.length > 0) {
          this.renderMatchedResults();
          if (config.showPrices) {
            void this.fetchPricesForMatches();
          }
        }
      })
    );

    // Restore saved image (OPT-012: IndexedDB, with one-time localStorage
    // migration for the legacy v3_matcher_image key)
    void this.restoreImageFromStorage();

    // Restore extracted colors history from storage
    const savedExtractedColors = StorageService.getItem<Array<{ hex: string; timestamp: number }>>(
      STORAGE_KEYS.extractedColors
    );
    if (savedExtractedColors && savedExtractedColors.length > 0) {
      this.extractedColorsHistory = savedExtractedColors;
      this.lastPixelSampleHex = savedExtractedColors[0].hex;
      // 3C: seed the loupe-colour chips (hint swatch + add-pick tile) with
      // the most recent pick
      this.setLoupeHex(savedExtractedColors[0].hex);
      this.renderRollStrip();
    }

    // Restore saved color from storage
    const savedColor = StorageService.getItem<string>(STORAGE_KEYS.selectedColor);
    if (savedColor) {
      // Use safeTimeout to ensure components are fully initialized
      this.safeTimeout(() => {
        this.matchColor(savedColor);
        logger.info('[MatcherTool] Restored saved color:', savedColor);
      }, 100);
    }

    logger.info('[MatcherTool] Mounted');
  }

  /**
   * OPT-012: persist the current image data-URL to IndexedDB. Oversized
   * images clear any previous entry instead (matching the old behavior).
   */
  private async persistImage(dataUrl: string): Promise<void> {
    if (dataUrl.length < MAX_IMAGE_STORAGE_SIZE) {
      const ok = await indexedDBService.set(STORES.IMAGE_CACHE, STORAGE_KEYS.imageDataUrl, dataUrl);
      if (ok) {
        logger.info('[ExtractorTool] Image saved to IndexedDB');
      }
    } else {
      await indexedDBService.delete(STORES.IMAGE_CACHE, STORAGE_KEYS.imageDataUrl);
      logger.info('[ExtractorTool] Image too large to persist, cleared storage');
    }
  }

  /**
   * OPT-012: load the saved image from IndexedDB; if absent, migrate any
   * legacy localStorage entry (freeing up to ~4 MB of the shared quota).
   */
  private async restoreImageFromStorage(): Promise<void> {
    let dataUrl = await indexedDBService.get<string>(STORES.IMAGE_CACHE, STORAGE_KEYS.imageDataUrl);

    if (!dataUrl) {
      const legacy = StorageService.getItem<string>(STORAGE_KEYS.imageDataUrl);
      if (legacy) {
        dataUrl = legacy;
        await indexedDBService.set(STORES.IMAGE_CACHE, STORAGE_KEYS.imageDataUrl, legacy);
        StorageService.removeItem(STORAGE_KEYS.imageDataUrl);
        logger.info('[ExtractorTool] Migrated saved image from localStorage to IndexedDB');
      }
    }

    if (dataUrl && !this.isDestroyed) {
      this.restoreSavedImage(dataUrl);
    }
  }

  /**
   * Restore a saved image from storage
   */
  private restoreSavedImage(dataUrl: string): void {
    const img = new Image();

    img.onload = () => {
      this.currentImage = img;

      if (this.imageZoom) {
        this.imageZoom.setImage(img);
        // Auto-fit image after restoring
        this.imageZoom.autoFit();
      }

      this.updateFlowVisibility();

      logger.info('[ExtractorTool] Restored saved image from storage');

      // Clear handlers
      img.onload = null;
      img.onerror = null;

      // Auto-extract palette to restore results
      void this.extractPalette();
    };

    img.onerror = () => {
      // Failed to load saved image, clear it from storage
      void indexedDBService.delete(STORES.IMAGE_CACHE, STORAGE_KEYS.imageDataUrl);
      StorageService.removeItem(STORAGE_KEYS.imageDataUrl);
      logger.warn('[MatcherTool] Failed to restore saved image, cleared storage');
      img.onload = null;
      img.onerror = null;
    };

    img.src = dataUrl;
  }

  destroy(): void {
    // Cleanup subscriptions

    // Cleanup child components
    this.imageUpload?.destroy();
    this.colorPicker?.destroy();
    this.imageZoom?.destroy();
    this.recentColors?.destroy();
    this.marketBoard?.destroy();
    this.marketPanel?.destroy();

    // Cleanup collapsible section panels
    this.imageSourcePanel?.destroy();
    this.colorSelectionPanel?.destroy();
    this.optionsPanel?.destroy();

    super.destroy();
    logger.info('[MatcherTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   */
  public setConfig(config: Partial<ExtractorConfig>): void {
    let needsReextract = false;
    let needsRerender = false;

    // Handle vibrancyBoost
    if (config.vibrancyBoost !== undefined && config.vibrancyBoost !== this.vibrancyBoost) {
      this.vibrancyBoost = config.vibrancyBoost;
      StorageService.setItem(STORAGE_KEYS.vibrancyBoost, config.vibrancyBoost);
      needsReextract = true;
      logger.info(`[ExtractorTool] setConfig: vibrancyBoost -> ${config.vibrancyBoost}`);
    }

    // Handle maxColors (maps to paletteColorCount)
    if (config.maxColors !== undefined && config.maxColors !== this.paletteColorCount) {
      this.paletteColorCount = config.maxColors;
      StorageService.setItem(STORAGE_KEYS.paletteColorCount, config.maxColors);
      needsReextract = true;
      logger.info(`[ExtractorTool] setConfig: maxColors -> ${config.maxColors}`);

      // Update desktop display
      if (this.colorCountSlider) {
        this.colorCountSlider.value = String(config.maxColors);
      }
      if (this.colorCountDisplay) {
        this.colorCountDisplay.textContent = String(config.maxColors);
      }
    }

    // Handle displayOptions (Color Formats and Result Details)
    if (config.displayOptions) {
      this.displayOptions = { ...this.displayOptions, ...config.displayOptions };
      needsRerender = true;
      logger.info(`[ExtractorTool] setConfig: displayOptions updated`, config.displayOptions);
    }

    // Handle dragThreshold
    if (config.dragThreshold !== undefined && this.imageZoom) {
      this.imageZoom.setDragThreshold(config.dragThreshold);
      logger.info(`[ExtractorTool] setConfig: dragThreshold -> ${config.dragThreshold}`);
    }

    // Handle sampleAreaSize
    if (config.sampleAreaSize !== undefined && this.imageZoom) {
      this.imageZoom.setSampleAreaSize(config.sampleAreaSize);
      logger.info(`[ExtractorTool] setConfig: sampleAreaSize -> ${config.sampleAreaSize}`);
    }

    // Handle matchingMethod - re-match colors when algorithm changes
    if (config.matchingMethod !== undefined && config.matchingMethod !== this.matchingMethod) {
      this.matchingMethod = config.matchingMethod;
      needsReextract = true;
      logger.info(`[ExtractorTool] setConfig: matchingMethod -> ${config.matchingMethod}`);
    }

    // Handle preventDuplicates - re-render to apply/remove dedup
    if (
      config.preventDuplicates !== undefined &&
      config.preventDuplicates !== this.preventDuplicates
    ) {
      this.preventDuplicates = config.preventDuplicates;
      needsRerender = true;
      logger.info(`[ExtractorTool] setConfig: preventDuplicates -> ${config.preventDuplicates}`);
    }

    // Handle dyeFilters - re-match when filters change
    if (config.dyeFilters) {
      const newFilters = config.dyeFilters;
      if (JSON.stringify(this.dyeFiltersConfig) !== JSON.stringify(newFilters)) {
        this.dyeFiltersConfig = { ...newFilters };
        needsReextract = true;
        logger.info(`[ExtractorTool] setConfig: dyeFilters updated`);
      }
    }

    // Re-extract palette if config changed and we're in palette mode with an image
    if (needsReextract && this.paletteMode && this.currentImage) {
      void this.extractPalette();
    } else if (needsRerender && this.lastPaletteResults.length > 0) {
      // Just re-render if display options changed but no re-extraction needed
      this.renderPaletteResults(this.lastPaletteResults);
    }
  }

  // ============================================================================
  // Left Panel Rendering
  // ============================================================================

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Section 1: Image Upload (Collapsible, default open)
    const uploadContainer = this.createElement('div');
    left.appendChild(uploadContainer);
    this.imageSourcePanel = new CollapsiblePanel(uploadContainer, {
      title: LanguageService.t('matcher.imageSource'),
      storageKey: 'matcher_imageSource',
      defaultOpen: true,
      icon: ICON_IMAGE,
    });
    this.imageSourcePanel.init();
    const uploadContent = this.createElement('div');
    this.renderImageUpload(uploadContent);
    this.imageSourcePanel.setContent(uploadContent);

    // Section 2: Color Selection (Collapsible, default open)
    const colorContainer = this.createElement('div');
    left.appendChild(colorContainer);
    this.colorSelectionPanel = new CollapsiblePanel(colorContainer, {
      title: LanguageService.t('matcher.colorSelection'),
      storageKey: 'matcher_colorSelection',
      defaultOpen: true,
      icon: ICON_PALETTE,
    });
    this.colorSelectionPanel.init();
    const colorContent = this.createElement('div');
    this.renderColorPicker(colorContent);
    this.colorSelectionPanel.setContent(colorContent);

    // Section 3: Options (Collapsible, default closed)
    const optionsContainer = this.createElement('div');
    left.appendChild(optionsContainer);
    this.optionsPanel = new CollapsiblePanel(optionsContainer, {
      title: LanguageService.t('matcher.options'),
      storageKey: 'matcher_options',
      defaultOpen: false,
      icon: ICON_SETTINGS,
    });
    this.optionsPanel.init();
    const optionsContent = this.createElement('div');
    this.renderOptions(optionsContent);
    this.optionsPanel.setContent(optionsContent);

    // Collapsible: Market Board
    const marketContainer = this.createElement('div');
    left.appendChild(marketContainer);
    this.renderMarketPanel(marketContainer);
  }

  /**
   * Render image upload section
   */
  private renderImageUpload(container: HTMLElement): void {
    const uploadContainer = this.createElement('div');
    container.appendChild(uploadContainer);

    this.imageUpload = new ImageUploadDisplay(uploadContainer);
    this.imageUpload.init();
  }

  /**
   * Render color picker section
   */
  private renderColorPicker(container: HTMLElement): void {
    const pickerContainer = this.createElement('div');
    container.appendChild(pickerContainer);

    this.colorPicker = new ColorPickerDisplay(pickerContainer);
    this.colorPicker.init();
  }

  /**
   * Render options section (sample size, palette mode)
   */
  private renderOptions(container: HTMLElement): void {
    const optionsContainer = this.createElement('div', { className: 'space-y-4' });

    // Sample size slider
    const sampleGroup = this.createElement('div');
    const sampleLabel = this.createElement('label', {
      className: 'flex items-center justify-between text-sm mb-2',
    });
    sampleLabel.innerHTML = `
      <span style="color: var(--theme-text);">${LanguageService.t('matcher.sampleSize')}</span>
      <span class="number" style="color: var(--theme-text-muted);">${this.sampleSize}px</span>
    `;
    this.sampleDisplay = sampleLabel.querySelector('span:last-child') as HTMLElement;

    this.sampleSlider = this.createElement('input', {
      attributes: { type: 'range', min: '1', max: '10', value: String(this.sampleSize) },
      className: 'w-full',
    }) as HTMLInputElement;

    this.on(this.sampleSlider, 'input', () => {
      if (this.sampleSlider && this.sampleDisplay) {
        this.sampleSize = parseInt(this.sampleSlider.value, 10);
        this.sampleDisplay.textContent = `${this.sampleSize}px`;
        StorageService.setItem(STORAGE_KEYS.sampleSize, this.sampleSize);
      }
    });

    sampleGroup.appendChild(sampleLabel);
    sampleGroup.appendChild(this.sampleSlider);
    optionsContainer.appendChild(sampleGroup);

    // Palette mode toggle
    const paletteToggle = this.createElement('label', {
      className: 'flex items-center gap-3 cursor-pointer',
    });

    this.paletteModeCheckbox = this.createElement('input', {
      attributes: { type: 'checkbox' },
      className: 'w-5 h-5 rounded',
    }) as HTMLInputElement;
    this.paletteModeCheckbox.checked = this.paletteMode;

    this.on(this.paletteModeCheckbox, 'change', () => {
      if (this.paletteModeCheckbox) {
        this.paletteMode = this.paletteModeCheckbox.checked;
        StorageService.setItem(STORAGE_KEYS.paletteMode, this.paletteMode);
        this.updatePaletteOptionsVisibility();
      }
    });

    const toggleText = this.createElement('div');
    toggleText.innerHTML = `
      <p class="text-sm font-medium" style="color: var(--theme-text);">${LanguageService.t('matcher.extractPalette')}</p>
      <p class="text-xs" style="color: var(--theme-text-muted);">${LanguageService.t('matcher.extractPaletteDesc')}</p>
    `;

    paletteToggle.appendChild(this.paletteModeCheckbox);
    paletteToggle.appendChild(toggleText);
    optionsContainer.appendChild(paletteToggle);

    // Palette options (color count slider + extract button) - shown when palette mode enabled
    this.paletteOptionsContainer = this.createElement('div', {
      className: 'space-y-3 pt-3 border-t',
      attributes: {
        id: 'palette-options-container',
        style: `border-color: var(--theme-border); ${this.paletteMode ? '' : 'display: none;'}`,
      },
    });

    // Color count slider
    const colorCountGroup = this.createElement('div');
    const colorCountLabel = this.createElement('label', {
      className: 'flex items-center justify-between text-sm mb-2',
    });
    colorCountLabel.innerHTML = `
      <span style="color: var(--theme-text);">${LanguageService.t('matcher.colorCount')}</span>
      <span class="number font-bold" style="color: var(--theme-primary);">${this.paletteColorCount}</span>
    `;
    this.colorCountDisplay = colorCountLabel.querySelector('span:last-child') as HTMLElement;

    this.colorCountSlider = this.createElement('input', {
      attributes: { type: 'range', min: '3', max: '5', value: String(this.paletteColorCount) },
      className: 'w-full',
    }) as HTMLInputElement;

    this.on(this.colorCountSlider, 'input', () => {
      if (this.colorCountSlider && this.colorCountDisplay) {
        this.paletteColorCount = parseInt(this.colorCountSlider.value, 10);
        this.colorCountDisplay.textContent = String(this.paletteColorCount);
        StorageService.setItem(STORAGE_KEYS.paletteColorCount, this.paletteColorCount);
      }
    });

    colorCountGroup.appendChild(colorCountLabel);
    colorCountGroup.appendChild(this.colorCountSlider);
    this.paletteOptionsContainer.appendChild(colorCountGroup);

    // Extract palette button
    // 3C: bulk extraction survives as one button that fills the roll.
    this.extractPaletteBtn = this.createElement('button', {
      className: 'w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors',
      textContent: LanguageService.t('matcher.autoExtract'),
      attributes: {
        style: 'background: var(--theme-primary); color: white;',
      },
    }) as HTMLButtonElement;

    this.on(this.extractPaletteBtn, 'click', () => {
      void this.extractPalette();
    });

    this.paletteOptionsContainer.appendChild(this.extractPaletteBtn);
    optionsContainer.appendChild(this.paletteOptionsContainer);

    container.appendChild(optionsContainer);
  }

  /**
   * Update palette options visibility based on paletteMode
   */
  private updatePaletteOptionsVisibility(): void {
    if (this.paletteOptionsContainer) {
      this.paletteOptionsContainer.style.display = this.paletteMode ? '' : 'none';
    }
  }

  /**
   * Render market board collapsible panel
   * WEB-REF-003 Phase 3: Refactored to use shared builder
   * WEB-REF-003 Phase 4: Uses MarketBoardService for state (showPrices/priceData via getters)
   */
  private renderMarketPanel(container: HTMLElement): void {
    const refs = buildMarketPanel(this, container, {
      storageKey: 'matcher_market',
      getShowPrices: () => this.showPrices,
      fetchPrices: () => this.fetchPricesForMatches(),
      onPricesToggled: () => {
        logger.info('🔔 [ExtractorTool] onPricesToggled called, showPrices=', this.showPrices);
        if (this.showPrices) {
          void this.fetchPricesForMatches();
        } else {
          // Service handles cache clearing; just re-render to update UI
          if (this.lastPaletteResults.length > 0) {
            this.renderPaletteResults(this.lastPaletteResults);
          } else {
            this.renderMatchedResults();
          }
        }
      },
      onServerChanged: () => {
        // Service clears cache on server change; re-render results then fetch new prices
        logger.info('🔔 [ExtractorTool] onServerChanged called, showPrices=', this.showPrices);
        if (this.showPrices) {
          // Re-render results to clear stale prices (cache was cleared by service)
          if (this.lastPaletteResults.length > 0) {
            this.renderPaletteResults(this.lastPaletteResults);
          } else if (this.matchedDyes.length > 0) {
            this.renderMatchedResults();
          }
          // Then fetch new prices for the new server
          void this.fetchPricesForMatches();
        }
      },
    });
    this.marketPanel = refs.panel;
    this.marketBoard = refs.marketBoard;

    // Load server data for the dropdown (showPrices state now comes from MarketBoardService getter)
    void this.marketBoard.loadServerData();
  }

  // ============================================================================
  // Right Panel Rendering — the 3C "Loupe + roll" main flow
  // ============================================================================

  /**
   * One-column workspace per the confirmed 3C prototype:
   * EMPTY  → drawn drop zone + permanent privacy chip row
   * LOADED → image card (drag loupe, 44px replace/clear, hint chip)
   *          → roll strip (picks + add-pick tile, Auto-extract)
   *          → focus results (v5-results-grid of compact v4-result-cards)
   */
  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Scoped responsive rules — media queries cannot be expressed inline and
    // the tool renders inside the shell's shadow DOM, which allows a local
    // <style> element (same pattern as the shell's v5-results-grid rule).
    const styleEl = this.createElement('style');
    styleEl.textContent = X3C_RESPONSIVE_CSS;

    const workspace = this.createElement('div', {
      className: 'extractor-layout x3c-workspace',
    });
    workspace.appendChild(styleEl);

    // Hidden file inputs shared by both states (Choose image / Replace / camera)
    this.dropZoneFileInput = this.createElement('input', {
      attributes: { type: 'file', accept: 'image/*', style: 'display: none;' },
    }) as HTMLInputElement;
    this.on(this.dropZoneFileInput, 'change', () => {
      const file = this.dropZoneFileInput?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.handleDroppedFile(file);
      }
      // Reset input so same file can be selected again
      if (this.dropZoneFileInput) {
        this.dropZoneFileInput.value = '';
      }
    });
    workspace.appendChild(this.dropZoneFileInput);

    // Mobile camera capture — the existing camera flow (capture attribute on a
    // file input, exactly what the shipped mobile Take-a-photo path uses), not
    // a new capture pipeline.
    this.cameraFileInput = this.createElement('input', {
      attributes: {
        type: 'file',
        accept: 'image/*',
        capture: 'environment',
        style: 'display: none;',
      },
    }) as HTMLInputElement;
    this.on(this.cameraFileInput, 'change', () => {
      const file = this.cameraFileInput?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.handleDroppedFile(file);
      }
      if (this.cameraFileInput) {
        this.cameraFileInput.value = '';
      }
    });
    workspace.appendChild(this.cameraFileInput);

    workspace.appendChild(this.buildEmptyFlow());
    workspace.appendChild(this.buildLoadedFlow());

    right.appendChild(workspace);

    // Setup drop zone interactions
    this.setupDropZoneInteractions();

    // Rebuild presentation from existing state (language switch / re-render)
    this.renderRollStrip();
    if (this.lastPaletteResults.length > 0) {
      this.renderPaletteResults(this.lastPaletteResults);
    } else if (this.matchedDyes.length > 0) {
      this.renderMatchedResults();
    }
    this.updateFlowVisibility();
  }

  /**
   * EMPTY state — the drawn drop zone: 2px-dashed 16px-radius card filling the
   * available height (image glyph, dropTitle, dropBody / dropBodyMobile, the
   * action buttons) with the permanent privacy chip row below the zone.
   */
  private buildEmptyFlow(): HTMLElement {
    this.emptyFlowElement = this.createElement('div', {
      attributes: {
        style: 'flex: 1; min-height: 0; display: flex; flex-direction: column;',
      },
    });

    this.dropZone = this.createElement('div', {
      className: 'image-drop-zone',
      attributes: {
        id: 'extractor-drop-zone',
        style: [
          'flex: 1; min-height: 0;',
          'display: flex; flex-direction: column; align-items: center; justify-content: center;',
          'gap: 15px; padding: 24px 18px;',
          'border-radius: 16px; border: 2px dashed var(--theme-border);',
          'background: var(--theme-card-background);',
          'text-align: center; cursor: pointer; transition: border-color 0.2s;',
        ].join(' '),
      },
    });

    // Image glyph (54px, dimmed per the drawn empty state)
    const glyph = this.createElement('div', {
      attributes: {
        style: 'width: 54px; height: 54px; color: var(--theme-text-muted); opacity: 0.6;',
        'aria-hidden': 'true',
      },
    });
    glyph.innerHTML = ICON_IMAGE;
    this.dropZone.appendChild(glyph);

    this.dropZone.appendChild(
      this.createElement('span', {
        className: 'x3c-drop-title',
        textContent: LanguageService.t('matcher.dropTitle'),
        attributes: { style: 'font-weight: 600; color: var(--theme-text);' },
      })
    );

    // Body copy: the desktop line names Ctrl+V, the mobile line names the camera
    this.dropZone.appendChild(
      this.createElement('span', {
        className: 'x3c-dt-text',
        textContent: LanguageService.t('matcher.dropBody'),
        attributes: {
          style:
            'font-size: 13px; line-height: 1.5; color: var(--theme-text-muted); max-width: 340px;',
        },
      })
    );
    this.dropZone.appendChild(
      this.createElement('span', {
        className: 'x3c-mb-text',
        textContent: LanguageService.t('matcher.dropBodyMobile'),
        attributes: {
          style:
            'font-size: 13px; line-height: 1.5; color: var(--theme-text-muted); max-width: 250px;',
        },
      })
    );

    // Desktop actions: Choose image (accent lead) + Paste from clipboard
    const dtActions = this.createElement('div', { className: 'x3c-dt-actions' });
    const chooseBtn = this.createElement('button', {
      textContent: LanguageService.t('matcher.chooseImage'),
      attributes: {
        type: 'button',
        style: [
          'min-height: 40px; padding: 0 18px; border-radius: 10px; border: none;',
          'background: var(--theme-primary); color: #fff;',
          'font-family: inherit; font-weight: 600; font-size: 13px; cursor: pointer;',
        ].join(' '),
      },
    }) as HTMLButtonElement;
    this.on(chooseBtn, 'click', (e: Event) => {
      e.stopPropagation();
      this.dropZoneFileInput?.click();
    });
    dtActions.appendChild(chooseBtn);

    // Paste from clipboard — navigator.clipboard.read() is Chromium-only;
    // hidden in unsupported browsers (Ctrl+V still works via the document
    // paste listener, and the drop copy names it)
    if (typeof navigator?.clipboard?.read === 'function') {
      const pasteBtn = this.createElement('button', {
        attributes: {
          type: 'button',
          style: [
            'display: inline-flex; align-items: center; justify-content: center; gap: 6px;',
            'min-height: 40px; padding: 0 16px; border-radius: 10px;',
            'background: transparent; border: 1px solid var(--theme-border);',
            'color: var(--theme-text-muted); font-family: inherit; font-size: 12.5px; cursor: pointer;',
          ].join(' '),
        },
      }) as HTMLButtonElement;
      const pasteIcon = this.createElement('span', {
        attributes: {
          style: 'width: 15px; height: 15px; display: inline-flex; flex-shrink: 0;',
          'aria-hidden': 'true',
        },
      });
      pasteIcon.innerHTML = ICON_CLIPBOARD;
      pasteBtn.appendChild(pasteIcon);
      pasteBtn.appendChild(
        this.createElement('span', {
          textContent: LanguageService.t('matcher.pasteClipboard'),
        })
      );
      this.on(pasteBtn, 'click', (e: Event) => {
        e.stopPropagation();
        void this.pasteFromClipboardAPI();
      });
      dtActions.appendChild(pasteBtn);
    }
    this.dropZone.appendChild(dtActions);

    // Mobile actions: Take a photo (accent lead) + Choose from photos
    const mbActions = this.createElement('div', { className: 'x3c-mb-actions' });
    const takePhotoBtn = this.createElement('button', {
      attributes: {
        type: 'button',
        style: [
          'display: flex; align-items: center; justify-content: center; gap: 8px;',
          'min-height: 48px; padding: 0 16px; border-radius: 11px; border: none;',
          'background: var(--theme-primary); color: #fff;',
          'font-family: inherit; font-weight: 600; font-size: 13.5px; cursor: pointer;',
        ].join(' '),
      },
    }) as HTMLButtonElement;
    const cameraIcon = this.createElement('span', {
      attributes: {
        style: 'width: 18px; height: 18px; display: inline-flex; flex-shrink: 0;',
        'aria-hidden': 'true',
      },
    });
    cameraIcon.innerHTML = ICON_CAMERA;
    takePhotoBtn.appendChild(cameraIcon);
    takePhotoBtn.appendChild(
      this.createElement('span', { textContent: LanguageService.t('matcher.takePhoto') })
    );
    this.on(takePhotoBtn, 'click', (e: Event) => {
      e.stopPropagation();
      this.cameraFileInput?.click();
    });
    mbActions.appendChild(takePhotoBtn);

    const choosePhotosBtn = this.createElement('button', {
      attributes: {
        type: 'button',
        style: [
          'display: flex; align-items: center; justify-content: center; gap: 8px;',
          'min-height: 46px; padding: 0 16px; border-radius: 11px;',
          'background: transparent; border: 1px solid var(--theme-border);',
          'color: var(--theme-text); font-family: inherit; font-weight: 500; font-size: 13px; cursor: pointer;',
        ].join(' '),
      },
    }) as HTMLButtonElement;
    const photosIcon = this.createElement('span', {
      attributes: {
        style: 'width: 18px; height: 18px; display: inline-flex; flex-shrink: 0;',
        'aria-hidden': 'true',
      },
    });
    photosIcon.innerHTML = ICON_IMAGE;
    choosePhotosBtn.appendChild(photosIcon);
    choosePhotosBtn.appendChild(
      this.createElement('span', { textContent: LanguageService.t('matcher.chooseImageMobile') })
    );
    this.on(choosePhotosBtn, 'click', (e: Event) => {
      e.stopPropagation();
      this.dropZoneFileInput?.click();
    });
    mbActions.appendChild(choosePhotosBtn);
    this.dropZone.appendChild(mbActions);

    this.emptyFlowElement.appendChild(this.dropZone);

    // Permanent privacy chip row below the zone (lock glyph + privacy line)
    const privacyRow = this.createElement('div', {
      attributes: {
        style: [
          'display: flex; align-items: flex-start; gap: 9px;',
          'margin-top: 12px; padding: 11px 12px; border-radius: 11px;',
          'background: var(--theme-background-secondary);',
        ].join(' '),
      },
    });
    const lockIcon = this.createElement('span', {
      attributes: {
        style:
          'width: 15px; height: 15px; display: inline-flex; flex-shrink: 0; color: var(--theme-text-muted);',
        'aria-hidden': 'true',
      },
    });
    lockIcon.innerHTML = ICON_LOCK;
    privacyRow.appendChild(lockIcon);
    privacyRow.appendChild(
      this.createElement('span', {
        textContent: LanguageService.t('matcher.privacyNote'),
        attributes: {
          style: 'font-size: 11px; line-height: 1.45; color: var(--theme-text-muted);',
        },
      })
    );
    this.emptyFlowElement.appendChild(privacyRow);

    return this.emptyFlowElement;
  }

  /**
   * LOADED state — image card with the drag loupe, the roll strip and the
   * focus results, top to bottom in one column.
   */
  private buildLoadedFlow(): HTMLElement {
    this.loadedFlowElement = this.createElement('div', {
      attributes: {
        style: 'flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 12px;',
      },
    });

    this.loadedFlowElement.appendChild(this.buildImageCard());
    this.loadedFlowElement.appendChild(this.buildRollSection());
    this.loadedFlowElement.appendChild(this.buildResultsSection());

    return this.loadedFlowElement;
  }

  /**
   * The 3C image card: #000 ground, 14px radius, the canvas (zoom controller)
   * underneath, the 74px loupe overlay, 44px replace/clear top-right and the
   * loupe-colour hint chip bottom-left. rgba(10,10,12,…) overlay grounds are
   * the drawn on-image chips — the sanctioned hardcoded colours.
   */
  private buildImageCard(): HTMLElement {
    this.imageCardElement = this.createElement('div', {
      className: 'x3c-image-card',
      attributes: {
        style: [
          'flex-shrink: 0; position: relative;',
          'border-radius: 14px; overflow: hidden; background: #000;',
          'touch-action: none;',
        ].join(' '),
      },
    });

    // Canvas host — the zoom controller renders into this
    this.canvasContainer = this.createElement('div', {
      className: 'image-canvas-container',
      attributes: {
        style: 'position: absolute; inset: 0; overflow: hidden;',
      },
    });
    this.imageCardElement.appendChild(this.canvasContainer);
    this.renderImageCanvas();

    // The loupe: 74px circle following the pointer during drag, 3px white
    // border + dark outline shadow, fill = colour under the pointer, 13px
    // crosshair ring, bottom hex chip. Scales in over 120ms.
    this.loupeElement = this.createElement('div', {
      attributes: {
        style: [
          'position: absolute; top: 0; left: 0; width: 74px; height: 74px; border-radius: 50%;',
          'transform: translate(-50%, -50%) scale(0);',
          'border: 3px solid #fff;',
          'box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.55), 0 6px 18px rgba(0, 0, 0, 0.45);',
          'background: transparent; pointer-events: none;',
          'display: flex; align-items: flex-end; justify-content: center; padding-bottom: 7px;',
          'transition: transform 120ms ease; z-index: 120; box-sizing: border-box;',
        ].join(' '),
        'aria-hidden': 'true',
      },
    });
    this.loupeElement.appendChild(
      this.createElement('span', {
        attributes: {
          style: [
            'position: absolute; top: 50%; left: 50%; width: 13px; height: 13px;',
            'margin: -6.5px 0 0 -6.5px; border-radius: 50%;',
            'border: 1.5px solid rgba(255, 255, 255, 0.9);',
            'box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4); box-sizing: border-box;',
          ].join(' '),
        },
      })
    );
    this.loupeHexChip = this.createElement('span', {
      attributes: {
        style: [
          "font-family: 'Fragment Mono', monospace; font-size: 9px;",
          'padding: 2px 6px; border-radius: 5px;',
          `background: ${OVERLAY_CHIP_BG}; color: #fff;`,
        ].join(' '),
      },
    });
    this.loupeElement.appendChild(this.loupeHexChip);
    this.imageCardElement.appendChild(this.loupeElement);

    // Top-right 44px replace + clear controls on the drawn overlay ground
    const topControls = this.createElement('div', {
      attributes: {
        style: 'position: absolute; top: 8px; right: 8px; display: flex; gap: 5px; z-index: 110;',
      },
    });
    const overlayBtnStyle = [
      'width: 44px; height: 44px;',
      'display: flex; align-items: center; justify-content: center;',
      `border-radius: 10px; border: none; background: ${OVERLAY_BG}; color: #fff; cursor: pointer;`,
    ].join(' ');

    const replaceBtn = this.createElement('button', {
      attributes: {
        type: 'button',
        title: LanguageService.t('matcher.replaceImage'),
        'aria-label': LanguageService.t('matcher.replaceImage'),
        style: overlayBtnStyle,
      },
    }) as HTMLButtonElement;
    const replaceIcon = this.createElement('span', {
      attributes: {
        style: 'width: 18px; height: 18px; display: inline-flex;',
        'aria-hidden': 'true',
      },
    });
    replaceIcon.innerHTML = ICON_REFRESH;
    replaceBtn.appendChild(replaceIcon);
    this.on(replaceBtn, 'click', (e: Event) => {
      e.stopPropagation();
      this.dropZoneFileInput?.click();
    });
    topControls.appendChild(replaceBtn);

    const clearBtn = this.createElement('button', {
      attributes: {
        type: 'button',
        title: LanguageService.t('matcher.clearImage'),
        'aria-label': LanguageService.t('matcher.clearImage'),
        style: overlayBtnStyle,
      },
    }) as HTMLButtonElement;
    const clearIcon = this.createElement('span', {
      attributes: {
        style: 'width: 18px; height: 18px; display: inline-flex;',
        'aria-hidden': 'true',
      },
    });
    clearIcon.innerHTML = ICON_CLOSE;
    clearBtn.appendChild(clearIcon);
    this.on(clearBtn, 'click', (e: Event) => {
      e.stopPropagation();
      this.clearImage();
    });
    topControls.appendChild(clearBtn);
    this.imageCardElement.appendChild(topControls);

    // Bottom-left hint chip: 14px swatch of the current loupe colour + mono hint
    const hintChip = this.createElement('div', {
      attributes: {
        style: [
          'position: absolute; left: 8px; bottom: 8px;',
          'display: flex; align-items: center; gap: 6px;',
          `padding: 6px 10px; border-radius: 10px; background: ${OVERLAY_BG}; z-index: 110;`,
        ].join(' '),
      },
    });
    this.hintSwatchElement = this.createElement('span', {
      attributes: {
        style: `width: 14px; height: 14px; border-radius: 4px; flex-shrink: 0; background: ${LOUPE_PLACEHOLDER};`,
        'aria-hidden': 'true',
      },
    });
    hintChip.appendChild(this.hintSwatchElement);
    const hintTextStyle = "font-family: 'Fragment Mono', monospace; font-size: 10px; color: #fff;";
    hintChip.appendChild(
      this.createElement('span', {
        className: 'x3c-dt-text',
        textContent: LanguageService.t('matcher.clickToSample'),
        attributes: { style: hintTextStyle },
      })
    );
    hintChip.appendChild(
      this.createElement('span', {
        className: 'x3c-mb-text',
        textContent: LanguageService.t('matcher.tapToSample'),
        attributes: { style: hintTextStyle },
      })
    );
    this.imageCardElement.appendChild(hintChip);

    return this.imageCardElement;
  }

  /**
   * ROLL strip — mono uppercase roll label, Clear + Auto-extract on the right,
   * then the horizontal strip of 58px pick tiles and the trailing add-pick
   * tile committing the loupe colour.
   */
  private buildRollSection(): HTMLElement {
    this.rollSectionElement = this.createElement('div', {
      attributes: { style: 'flex-shrink: 0;' },
    });

    const headerRow = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px;',
      },
    });
    headerRow.appendChild(
      this.createElement('span', {
        textContent: LanguageService.t('matcher.roll'),
        attributes: {
          style:
            'font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--theme-text-muted); white-space: nowrap;',
        },
      })
    );

    const headerActions = this.createElement('div', {
      attributes: { style: 'display: flex; align-items: center; gap: 12px;' },
    });
    const rollClearBtn = this.createElement('button', {
      textContent: LanguageService.t('common.clear'),
      attributes: {
        type: 'button',
        style: [
          'background: none; border: none; color: var(--theme-primary);',
          'font-size: 12px; font-weight: 600; cursor: pointer;',
          'text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 4px;',
        ].join(' '),
      },
    }) as HTMLButtonElement;
    this.on(rollClearBtn, 'click', () => {
      this.clearExtractedColorsHistory();
    });
    headerActions.appendChild(rollClearBtn);

    // Auto-extract: bulk extraction survives as this one button (accent-soft
    // outlined), filling the roll via the existing K-means flow
    this.rollAutoBtn = this.createElement('button', {
      className: 'x3c-auto-btn',
      textContent: LanguageService.t('matcher.autoExtract'),
      attributes: {
        type: 'button',
        style: [
          'min-height: 36px; padding: 0 13px; border-radius: 9px; cursor: pointer;',
          'font-family: inherit; font-size: 12px; font-weight: 600; white-space: nowrap;',
          `background: ${ACCENT_SOFT}; border: 1px solid ${ACCENT_BORDER}; color: var(--theme-primary);`,
        ].join(' '),
      },
    }) as HTMLButtonElement;
    this.on(this.rollAutoBtn, 'click', () => {
      void this.extractPalette();
    });
    headerActions.appendChild(this.rollAutoBtn);
    headerRow.appendChild(headerActions);
    this.rollSectionElement.appendChild(headerRow);

    this.rollStripElement = this.createElement('div', {
      attributes: {
        style: 'display: flex; gap: 6px; overflow-x: auto; padding-bottom: 2px;',
      },
    });
    this.rollSectionElement.appendChild(this.rollStripElement);

    return this.rollSectionElement;
  }

  /**
   * FOCUS results — uppercase focus label, Fragment Mono count and the Export
   * action on the right, then the existing v5-results-grid card container.
   */
  private buildResultsSection(): HTMLElement {
    const resultsSection = this.createElement('div', {
      className: 'extractor-results-section',
      attributes: {
        style:
          'flex: 1; min-height: 0; min-width: 0; display: flex; flex-direction: column; gap: 10px;',
      },
    });

    const focusHeader = this.createElement('div', {
      attributes: {
        style: [
          'display: flex; align-items: center; justify-content: space-between; gap: 10px;',
          'padding-bottom: 8px; border-bottom: 1px solid var(--theme-border);',
        ].join(' '),
      },
    });
    this.resultsTitleElement = this.createElement('span', {
      className: 'extractor-section-title',
      textContent: LanguageService.t('matcher.extractedPalette'),
      attributes: {
        style:
          'font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--theme-text-muted);',
      },
    });
    focusHeader.appendChild(this.resultsTitleElement);

    const focusActions = this.createElement('div', {
      attributes: { style: 'display: flex; align-items: center; gap: 12px;' },
    });
    this.resultsCountElement = this.createElement('span', {
      attributes: {
        style:
          "font-family: 'Fragment Mono', monospace; font-size: 11px; color: var(--theme-text-muted);",
      },
    });
    focusActions.appendChild(this.resultsCountElement);

    const actionBtnStyle = [
      'background: none; border: none; color: var(--theme-primary);',
      'font-size: 12px; font-weight: 600; cursor: pointer;',
      'text-transform: uppercase; letter-spacing: 0.5px;',
    ].join(' ');
    this.exportBtn = this.createElement('button', {
      className: 'action-btn-text',
      textContent: LanguageService.t('common.export'),
      attributes: {
        type: 'button',
        disabled: 'true',
        style: `${actionBtnStyle} opacity: 0.5; cursor: not-allowed;`,
      },
    }) as HTMLButtonElement;
    this.on(this.exportBtn, 'click', () => {
      this.openPaletteExport();
    });
    focusActions.appendChild(this.exportBtn);
    focusHeader.appendChild(focusActions);
    resultsSection.appendChild(focusHeader);

    // Color info card container (hidden until pixel sample)
    this.colorInfoCardContainer = this.createElement('div', {
      className: 'color-info-card-wrapper',
      attributes: {
        style: 'display: none; justify-content: center; margin-bottom: 8px;',
      },
    });
    resultsSection.appendChild(this.colorInfoCardContainer);

    // Scrolling host — the v5-results-grid container is created per render
    // inside (grid rules come from the shell's injected style)
    this.resultsContainer = this.createElement('div', {
      className: 'extractor-results-scroll',
      attributes: {
        style: 'flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 16px;',
      },
    });
    resultsSection.appendChild(this.resultsContainer);

    return resultsSection;
  }

  /**
   * Setup drop zone click and workspace-wide drag/drop
   */
  private setupDropZoneInteractions(): void {
    if (!this.dropZone) return;

    // Click anywhere on the dashed card opens the file dialog (the card only
    // shows while no image is loaded)
    this.on(this.dropZone, 'click', () => {
      if (!this.currentImage) {
        this.dropZoneFileInput?.click();
      }
    });

    // Drag and drop works across the whole workspace in both states —
    // dropping a file replaces the current image
    const panel = this.options.rightPanel;
    this.on(panel, 'dragover', (e: Event) => {
      e.preventDefault();
      if (this.dropZone) {
        this.dropZone.style.borderColor = 'var(--theme-primary)';
      }
    });
    this.on(panel, 'dragleave', () => {
      if (this.dropZone) {
        this.dropZone.style.borderColor = '';
      }
    });
    this.on(panel, 'drop', (e: Event) => {
      e.preventDefault();
      if (this.dropZone) {
        this.dropZone.style.borderColor = '';
      }
      const dragEvent = e as DragEvent;
      const files = dragEvent.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          this.handleDroppedFile(file);
        }
      }
    });
  }

  /**
   * Shared image-arrival path (drop, file dialog, camera, paste, left-panel
   * uploader): persist, hand to the zoom controller, flip the workspace to
   * the loaded flow and auto-extract.
   */
  private onImageLoaded(image: HTMLImageElement, dataUrl?: string): void {
    this.currentImage = image;

    // OPT-012: persist to IndexedDB (async, off the image-load critical path)
    if (dataUrl) {
      void this.persistImage(dataUrl);
    }

    if (this.imageZoom) {
      this.imageZoom.setImage(image);
      // Auto-fit image after loading
      this.imageZoom.autoFit();
    }

    this.updateFlowVisibility();
    ToastService.success(LanguageService.t('matcher.imageLoaded'));

    // V4: Auto-extract palette on image load
    void this.extractPalette();
  }

  /**
   * Handle a dropped image file
   */
  private handleDroppedFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        this.onImageLoaded(img, dataUrl);
        this.emit('image-loaded', { image: img, dataUrl });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Read image from clipboard using the Clipboard API (navigator.clipboard.read)
   * This is the handler for the explicit "Paste from clipboard" button.
   * Ctrl+V paste is handled separately by the document-level paste listener in bindEvents.
   */
  private async pasteFromClipboardAPI(): Promise<void> {
    try {
      const clipboardItems = await navigator.clipboard.read();

      for (const item of clipboardItems) {
        const imageType = item.types.find((type) => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], 'clipboard-image.png', { type: imageType });
          this.handleDroppedFile(file);
          return;
        }
      }

      // No image found in clipboard
      ToastService.error(LanguageService.t('matcher.pasteNoImage'));
    } catch (error) {
      // Permission denied or API error
      logger.warn('[ExtractorTool] Clipboard read failed:', error);
      ToastService.error(LanguageService.t('matcher.pasteNoImage'));
    }
  }

  /**
   * Clear the current image and reset to the empty state
   */
  private clearImage(): void {
    // Clear image state
    this.currentImage = null;

    // Clear from storage (both the legacy localStorage key and the OPT-012
    // IndexedDB copy — otherwise the cleared image returns on reload)
    StorageService.removeItem(STORAGE_KEYS.imageDataUrl);
    void indexedDBService.delete(STORES.IMAGE_CACHE, STORAGE_KEYS.imageDataUrl);

    // Clear palette results (price cache managed by MarketBoardService)
    this.lastPaletteResults = [];
    this.matchedDyes = [];
    this.v4ResultCards = [];

    // Clear results container
    if (this.resultsContainer) {
      clearContainer(this.resultsContainer);
    }

    // Reset focus header
    if (this.resultsTitleElement) {
      this.resultsTitleElement.textContent = LanguageService.t('matcher.extractedPalette');
    }
    if (this.resultsCountElement) {
      this.resultsCountElement.textContent = '';
    }

    // Disable export button
    if (this.exportBtn) {
      this.exportBtn.disabled = true;
      this.exportBtn.style.opacity = '0.5';
      this.exportBtn.style.cursor = 'not-allowed';
    }

    this.hideLoupe();
    this.hideColorInfoCard();
    this.updateFlowVisibility();

    // Re-render the canvas area to clear zoom controller
    this.renderImageCanvas();

    ToastService.info(LanguageService.t('matcher.imageCleared'));
    logger.info('[ExtractorTool] Image cleared');
  }

  /**
   * Render image canvas with zoom controller and wire the 3C interactions:
   * plain click/tap samples, drag drives the loupe and samples on release.
   */
  private renderImageCanvas(): void {
    if (!this.canvasContainer) return;

    // Tear down any previous controller (its document-level key listeners
    // survive clearContainer otherwise)
    this.imageZoom?.destroy();
    this.imageZoom = null;
    clearContainer(this.canvasContainer);

    const canvasWrapper = this.createElement('div', {
      attributes: {
        style: 'position: absolute; inset: 0; overflow: hidden;',
      },
    });
    this.canvasContainer.appendChild(canvasWrapper);

    // NOTE: pixel sampling flows through the 'image-sampled' event below —
    // the file dialog is reached through Replace/drop, never by touching the
    // image you are trying to read.
    this.imageZoom = new ImageZoomController(canvasWrapper, {});
    this.imageZoom.init();

    // Plain click/tap and drag-release both land here with the controller's
    // pixel-averaged sample (sampleAreaSize) — keep the existing roll path
    this.onPanelEvent(canvasWrapper, 'image-sampled', (event: CustomEvent) => {
      const { hex, isPixelSample } = event.detail;
      if (isPixelSample && hex) {
        this.matchColor(hex, true);
      }
    });

    // 3C loupe: the drag reads the pixel under the pointer live
    this.onPanelEvent(canvasWrapper, 'loupe-move', (event: CustomEvent) => {
      const { hex, clientX, clientY } = event.detail;
      this.moveLoupe(hex, clientX, clientY);
    });
    this.onPanelEvent(canvasWrapper, 'loupe-end', () => {
      this.hideLoupe();
    });

    // If we already have an image, set it
    if (this.currentImage) {
      this.imageZoom.setImage(this.currentImage);
      this.imageZoom.autoFit();
    }
  }

  /**
   * Position the loupe under the pointer and fill it with the colour it reads.
   */
  private moveLoupe(hex: string, clientX: number, clientY: number): void {
    if (!this.imageCardElement || !this.loupeElement) return;

    const rect = this.imageCardElement.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height));

    this.loupeElement.style.left = `${x}px`;
    this.loupeElement.style.top = `${y}px`;
    this.loupeElement.style.background = hex;
    this.loupeElement.style.transform = 'translate(-50%, -50%) scale(1)';
    if (this.loupeHexChip) {
      this.loupeHexChip.textContent = hex.toUpperCase();
    }
    this.setLoupeHex(hex);
  }

  /**
   * Scale the loupe away (drag ended or was cancelled).
   */
  private hideLoupe(): void {
    if (this.loupeElement) {
      this.loupeElement.style.transform = 'translate(-50%, -50%) scale(0)';
    }
  }

  /**
   * Track the loupe's current colour — it feeds the bottom-left hint swatch
   * and the roll's add-pick tile chip.
   */
  private setLoupeHex(hex: string): void {
    this.currentLoupeHex = hex;
    if (this.hintSwatchElement) {
      this.hintSwatchElement.style.background = hex;
    }
    if (this.addPickChipElement) {
      this.addPickChipElement.style.background = hex;
    }
  }

  /**
   * Flip the workspace between the drawn empty state and the loaded flow.
   * Manual colour matches without an image still get the results section
   * (image card hidden); the roll shows whenever there is an image or picks.
   */
  private updateFlowVisibility(): void {
    const hasImage = this.currentImage !== null;
    const hasResults = this.lastPaletteResults.length > 0 || this.matchedDyes.length > 0;
    const showWorkspace = hasImage || hasResults;

    if (this.emptyFlowElement) {
      this.emptyFlowElement.style.display = showWorkspace ? 'none' : 'flex';
    }
    if (this.loadedFlowElement) {
      this.loadedFlowElement.style.display = showWorkspace ? 'flex' : 'none';
    }
    if (this.imageCardElement) {
      this.imageCardElement.style.display = hasImage ? '' : 'none';
    }
    if (this.rollSectionElement) {
      const showRoll = hasImage || this.extractedColorsHistory.length > 0;
      this.rollSectionElement.style.display = showRoll ? '' : 'none';
    }
  }

  // ============================================================================
  // Extracted Colors History & Color Info Card
  // ============================================================================

  /**
   * Render the color info card showing HEX, RGB, HSV, LAB for a sampled color.
   * Follows the swatch tool's "Selected Color" card pattern.
   */
  private renderColorInfoCard(hex: string): void {
    if (!this.colorInfoCardContainer) return;
    clearContainer(this.colorInfoCardContainer);

    const rgb = ColorService.hexToRgb(hex);
    const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);
    const lab = ColorService.rgbToLab(rgb.r, rgb.g, rgb.b);

    // Card container
    const card = this.createElement('div', {
      attributes: {
        style: `
          max-width: 320px;
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
          overflow: hidden;
          background: var(--theme-card-background, #2a2a2a);
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Title bar
    const titleBar = this.createElement('div', {
      attributes: {
        style: `
          padding: 12px 16px;
          background: var(--theme-card-header, rgba(0, 0, 0, 0.2));
          border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
          text-align: center;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    const title = this.createElement('span', {
      textContent: 'Sampled Color',
      attributes: {
        style: 'font-size: 14px; font-weight: 600; color: var(--theme-text, #e0e0e0);',
      },
    });
    titleBar.appendChild(title);
    card.appendChild(titleBar);

    // Large color swatch preview
    const swatchPreview = this.createElement('div', {
      attributes: {
        style: `width: 100%; height: 80px; background-color: ${hex};`,
      },
    });
    card.appendChild(swatchPreview);

    // Technical data section
    const dataSection = this.createElement('div', {
      attributes: {
        style: 'padding: 16px; display: flex; flex-direction: column; gap: 8px;',
      },
    });

    // Two-column data grid
    const dataGrid = this.createElement('div', {
      attributes: {
        style: 'display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; font-size: 12px;',
      },
    });

    const createDataRow = (label: string, value: string): HTMLElement => {
      const row = this.createElement('div', {
        attributes: {
          style: 'display: flex; justify-content: space-between; align-items: center;',
        },
      });
      row.appendChild(
        this.createElement('span', {
          textContent: label,
          attributes: { style: 'color: var(--theme-text-muted, #a0a0a0);' },
        })
      );
      row.appendChild(
        this.createElement('span', {
          className: 'number',
          textContent: value,
          attributes: { style: 'color: var(--theme-text, #e0e0e0); font-weight: 500;' },
        })
      );
      return row;
    };

    dataGrid.appendChild(createDataRow('HEX', hex.toUpperCase()));
    dataGrid.appendChild(createDataRow('RGB', `${rgb.r},${rgb.g},${rgb.b}`));
    dataGrid.appendChild(
      createDataRow('HSV', `${Math.round(hsv.h)},${Math.round(hsv.s)},${Math.round(hsv.v)}`)
    );
    dataGrid.appendChild(
      createDataRow('LAB', `${Math.round(lab.L)},${Math.round(lab.a)},${Math.round(lab.b)}`)
    );

    dataSection.appendChild(dataGrid);
    card.appendChild(dataSection);

    // Copy button
    const copyBtn = this.createElement('button', {
      textContent: 'Copy Color Info',
      attributes: {
        style: `
          width: 100%;
          padding: 10px 16px;
          background: var(--theme-primary, #d4a857);
          color: var(--theme-primary-text, #1a1a1a);
          border: none;
          border-radius: 0 0 11px 11px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.opacity = '0.9';
    });
    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.opacity = '1';
    });
    this.on(copyBtn, 'click', () => {
      const text = [
        `HEX: ${hex.toUpperCase()}`,
        `RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}`,
        `HSV: ${Math.round(hsv.h)}, ${Math.round(hsv.s)}, ${Math.round(hsv.v)}`,
        `LAB: ${Math.round(lab.L)}, ${Math.round(lab.a)}, ${Math.round(lab.b)}`,
      ].join('\n');
      void navigator.clipboard.writeText(text).then(() => {
        ToastService.success('Color info copied to clipboard');
      });
    });
    card.appendChild(copyBtn);

    this.colorInfoCardContainer.appendChild(card);
    this.colorInfoCardContainer.style.display = 'flex';
  }

  /**
   * Hide the color info card
   */
  private hideColorInfoCard(): void {
    if (this.colorInfoCardContainer) {
      this.colorInfoCardContainer.style.display = 'none';
    }
  }

  /**
   * Render the ROLL strip tiles: one 58px tile per sampled colour (40px swatch
   * over a mono dominance-%/hex row, focused tile ringed accent) plus the
   * trailing dashed add-pick tile committing the current loupe colour.
   * Sampled picks and auto-extracted picks share the one strip.
   */
  private renderRollStrip(): void {
    if (!this.rollStripElement) return;
    clearContainer(this.rollStripElement);

    // Dominance labels for auto-extracted picks (hex → "34%")
    const pctByHex = this.rollDominanceByHex;

    for (const entry of this.extractedColorsHistory) {
      const isFocused = entry.hex.toLowerCase() === this.lastPixelSampleHex?.toLowerCase();

      const tile = this.createElement('button', {
        attributes: {
          type: 'button',
          title: entry.hex.toUpperCase(),
          style: [
            'flex: 0 0 auto; width: 58px; padding: 0; overflow: hidden;',
            'display: flex; flex-direction: column;',
            'border-radius: 10px; cursor: pointer;',
            'background: var(--theme-card-background);',
            `border: 1px solid ${isFocused ? 'var(--theme-primary)' : 'var(--theme-border)'};`,
            `box-shadow: ${isFocused ? `0 0 0 2px ${ACCENT_SOFT}` : 'none'};`,
          ].join(' '),
        },
      }) as HTMLButtonElement;

      tile.appendChild(
        this.createElement('span', {
          attributes: {
            style: `display: block; height: 40px; width: 100%; background: ${entry.hex};`,
          },
        })
      );
      tile.appendChild(
        this.createElement('span', {
          textContent:
            pctByHex.get(entry.hex.toLowerCase()) ?? entry.hex.replace('#', '').toUpperCase(),
          attributes: {
            style: [
              "display: block; padding: 5px 2px 6px; font-family: 'Fragment Mono', monospace;",
              'font-size: 9px; color: var(--theme-text-muted);',
              'white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
            ].join(' '),
          },
        })
      );

      // Focus this pick — its matches fill the results
      this.on(tile, 'click', () => {
        this.lastPixelSampleHex = entry.hex;
        this.renderColorInfoCard(entry.hex);
        this.matchColor(entry.hex);
        this.renderRollStrip();
      });

      this.rollStripElement.appendChild(tile);
    }

    // Trailing add-pick tile: dashed accent border, 22px chip of the current
    // loupe colour + '+', committing the loupe colour to the roll
    if (this.currentImage) {
      const addTile = this.createElement('button', {
        attributes: {
          type: 'button',
          title: LanguageService.t('matcher.addPick'),
          'aria-label': LanguageService.t('matcher.addPick'),
          style: [
            'flex: 0 0 auto; width: 58px; min-height: 71px; padding: 0;',
            'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;',
            'border-radius: 10px; cursor: pointer; background: transparent;',
            `border: 1px dashed ${ACCENT_BORDER}; color: var(--theme-primary);`,
          ].join(' '),
        },
      }) as HTMLButtonElement;

      this.addPickChipElement = this.createElement('span', {
        attributes: {
          style: `width: 22px; height: 22px; border-radius: 6px; background: ${this.currentLoupeHex ?? LOUPE_PLACEHOLDER};`,
          'aria-hidden': 'true',
        },
      });
      addTile.appendChild(this.addPickChipElement);
      addTile.appendChild(
        this.createElement('span', {
          textContent: '+',
          attributes: { style: 'font-size: 15px; line-height: 1;' },
        })
      );

      this.on(addTile, 'click', () => {
        if (this.currentLoupeHex) {
          // Same commit path as a sample: prepends to the roll and focuses it
          this.matchColor(this.currentLoupeHex, true);
        }
      });

      this.rollStripElement.appendChild(addTile);
    } else {
      this.addPickChipElement = null;
    }
  }

  /** Format an RGB triple as an uppercase hex string. */
  private rgbToHexString(rgb: RGB): string {
    return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
  }

  /**
   * Clear the extracted colors history (the roll)
   */
  private clearExtractedColorsHistory(): void {
    this.extractedColorsHistory = [];
    this.lastPixelSampleHex = null;
    this.rollDominanceByHex.clear();
    StorageService.removeItem(STORAGE_KEYS.extractedColors);
    this.renderRollStrip();
    this.hideColorInfoCard();
    this.updateFlowVisibility();
  }

  /**
   * Populate the extracted colors history from palette extraction results.
   * Replaces the current history with the palette's extracted colors.
   */
  private populateHistoryFromPalette(matches: PaletteMatch[]): void {
    const now = Date.now();
    this.rollDominanceByHex = new Map(
      matches.map((match) => [
        this.rgbToHexString(match.extracted).toLowerCase(),
        `${Math.round(match.dominance)}%`,
      ])
    );
    this.extractedColorsHistory = matches.map((match) => ({
      hex: this.rgbToHexString(match.extracted),
      timestamp: now,
    }));
    this.lastPixelSampleHex = null;
    StorageService.setItem(STORAGE_KEYS.extractedColors, this.extractedColorsHistory);
    this.renderRollStrip();
  }

  // ============================================================================
  // Color Matching Logic
  // ============================================================================

  /**
   * Match a color to the closest dyes
   */
  private matchColor(hex: string, isPixelSample: boolean = false): void {
    this.selectedColor = hex;

    // Clear palette results when doing single color match
    this.lastPaletteResults = [];

    // Track pixel sample in the roll (extracted colors history)
    if (isPixelSample) {
      this.lastPixelSampleHex = hex;
      // 3C: a committed sample is also the loupe's colour
      this.setLoupeHex(hex);
      // Remove duplicate if already in history, then prepend
      this.extractedColorsHistory = this.extractedColorsHistory.filter(
        (e) => e.hex.toLowerCase() !== hex.toLowerCase()
      );
      this.extractedColorsHistory.unshift({ hex, timestamp: Date.now() });
      // Cap at max
      if (this.extractedColorsHistory.length > this.maxExtractedColors) {
        this.extractedColorsHistory = this.extractedColorsHistory.slice(0, this.maxExtractedColors);
      }
      StorageService.setItem(STORAGE_KEYS.extractedColors, this.extractedColorsHistory);
      this.renderRollStrip();
      this.renderColorInfoCard(hex);
    } else if (this.lastPixelSampleHex?.toLowerCase() === hex.toLowerCase()) {
      // Re-selecting from the roll — show the info card
      this.renderColorInfoCard(hex);
    }

    // Persist selected color to storage
    StorageService.setItem(STORAGE_KEYS.selectedColor, hex);

    // Add to recent colors
    if (this.recentColors) {
      this.recentColors.addRecentColor(hex);
    }

    // Find closest dyes using configured matching algorithm
    let closestDye = dyeService.findClosestDye(hex, { matchingMethod: this.matchingMethod });
    let withinDistance = dyeService.findDyesWithinDistance(hex, {
      maxDistance: 100,
      limit: 9,
      matchingMethod: this.matchingMethod,
    });

    // Apply dye filters from centralized config
    if (closestDye && isDyeExcluded(this.dyeFiltersConfig, closestDye)) {
      const allDyes = dyeService.getAllDyes();
      const filteredDyes = filterDyes(this.dyeFiltersConfig, allDyes);
      closestDye =
        filteredDyes.length > 0
          ? filteredDyes.reduce((best, dye) => {
              const bestDist = ColorService.getColorDistance(hex, best.hex);
              const dyeDist = ColorService.getColorDistance(hex, dye.hex);
              return dyeDist < bestDist ? dye : best;
            })
          : null;
    }

    // Filter within distance results
    withinDistance = filterDyes(this.dyeFiltersConfig, withinDistance);

    if (!closestDye) {
      this.matchedDyes = [];
      this.renderMatchedResults();
      return;
    }

    // Cache distances
    const closestDyeWithDistance: DyeWithDistance = {
      ...closestDye,
      distance: ColorService.getColorDistance(hex, closestDye.hex),
    };

    const withinDistanceWithCache: DyeWithDistance[] = withinDistance.map((dye) => ({
      ...dye,
      distance: ColorService.getColorDistance(hex, dye.hex),
    }));

    // Store matched dyes
    this.matchedDyes = [closestDyeWithDistance, ...withinDistanceWithCache];

    // Render results
    this.renderMatchedResults();

    // Fetch prices if enabled
    if (this.showPrices && this.marketBoard) {
      void this.fetchPricesForMatches();
    }

    logger.info('[MatcherTool] Matched color:', hex, 'Found:', this.matchedDyes.length, 'dyes');
  }

  /**
   * Render matched dye results using v4 unified result cards
   */
  private renderMatchedResults(): void {
    if (!this.resultsContainer) return;

    // Clear existing results
    clearContainer(this.resultsContainer);
    this.v4ResultCards = [];

    // Show the loaded flow (manual matches work without an image too)
    this.updateFlowVisibility();

    // Update focus header (label + Fragment Mono count)
    if (this.resultsTitleElement) {
      this.resultsTitleElement.textContent = LanguageService.t('matcher.matchedDyes');
    }
    if (this.resultsCountElement) {
      this.resultsCountElement.textContent = String(this.matchedDyes.length);
    }

    if (this.matchedDyes.length === 0) {
      if (this.selectedColor) {
        const noResults = this.createElement('p', {
          className: 'text-sm text-center py-4',
          textContent: LanguageService.t('matcher.noMatchingDyes'),
          attributes: { style: 'color: var(--theme-text-muted);' },
        });
        this.resultsContainer.appendChild(noResults);
      }
      return;
    }

    // Create grid container matching palette results layout
    const cardsGrid = this.createElement('div', {
      className: 'extractor-results-grid v5-results-grid',
    });

    for (const dye of this.matchedDyes) {
      // Build ResultCardData from DyeWithDistance
      const cardData: ResultCardData = {
        dye,
        originalColor: this.selectedColor || dye.hex,
        matchedColor: dye.hex,
        deltaE: dye.distance,
        matchingMethod: this.matchingMethod,
        vendorCost: dye.cost,
      };

      // Add market price if available
      if (this.showPrices && this.priceData.has(dye.itemID)) {
        const price = this.priceData.get(dye.itemID)!;
        cardData.price = price.currentMinPrice;
        cardData.marketServer =
          WorldService.getWorldName(price.worldId) ||
          this.marketBoard?.getSelectedServer() ||
          'Market';
      }

      // Create the v4-result-card element
      const card = document.createElement('v4-result-card') as unknown as ResultCard;
      card.compact = true;
      card.data = cardData;
      card.setAttribute('primary-opens-menu', 'true');

      // Apply display options from config
      card.showHex = this.displayOptions.showHex;
      card.showRgb = this.displayOptions.showRgb;
      card.showHsv = this.displayOptions.showHsv;
      card.showLab = this.displayOptions.showLab;
      card.showCmyk = this.displayOptions.showCmyk;
      card.showDeltaE = this.displayOptions.showDeltaE;
      card.showHue = this.displayOptions.showHue ?? true;
      card.showStain = this.displayOptions.showStain ?? true;
      card.showConsolidation = this.displayOptions.showSpectrum ?? true;
      card.showPrice = this.displayOptions.showPrice && this.showPrices;
      card.showAcquisition = this.displayOptions.showAcquisition;

      // Listen for context actions
      card.addEventListener('context-action', ((
        e: CustomEvent<{ action: ContextAction; dye: Dye }>
      ) => {
        this.handleContextAction(e.detail.action, e.detail.dye);
      }) as EventListener);

      this.v4ResultCards.push(card);
      cardsGrid.appendChild(card);
    }

    this.resultsContainer.appendChild(cardsGrid);
  }

  /**
   * Fetch prices for matched dyes
   * WEB-REF-003 Phase 4: Delegates to MarketBoardService with race condition protection
   */
  private async fetchPricesForMatches(): Promise<void> {
    logger.info('💰 [ExtractorTool] fetchPricesForMatches called, showPrices=', this.showPrices);
    if (!this.showPrices) return;

    // Collect dyes to fetch prices for - either from palette results or matched dyes
    let dyesToFetch: Dye[] = [];

    if (this.lastPaletteResults.length > 0) {
      // Extract dyes from palette results (apply dedup to match rendered results)
      const dedupedResults = this.deduplicatePaletteResults(this.lastPaletteResults);
      dyesToFetch = dedupedResults.map((match) => match.matchedDye);
    } else if (this.matchedDyes.length > 0) {
      dyesToFetch = this.matchedDyes;
    }

    if (dyesToFetch.length === 0) return;

    // Clear previous error before fetch
    this.lastMarketError = undefined;

    try {
      const prices = await this.marketBoardService.fetchPricesForDyes(dyesToFetch);
      logger.info(`[ExtractorTool] Fetched prices for ${prices.size} dyes`);
    } catch (error) {
      // Parse error into short display code for result cards
      this.lastMarketError = this.parseMarketError(error);
      logger.error('[ExtractorTool] Failed to fetch prices:', error);
    } finally {
      // Always update cards to reflect current showPrices state and any fetched data
      // This ensures cards show Market section even if fetch failed
      this.updateV4ResultCardPrices();
    }
  }

  /**
   * Parse a market fetch error into a short display code for result cards
   * Error code format follows result-card conventions:
   * - "H" prefix for HTTP errors (e.g., "H429" for rate limit, "H502" for bad gateway)
   * - "N" prefix for network errors (e.g., "NOFF" for offline)
   * - "E" prefix for other errors (e.g., "EUNK" for unknown)
   */
  private parseMarketError(error: unknown): string {
    // Check for network offline
    if (!navigator.onLine) {
      return 'NOFF'; // Network offline
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Check for HTTP status codes in error message
      const statusMatch =
        message.match(/status[:\s]*(\d{3})/i) ||
        message.match(/(\d{3})[:\s]*(rate limit|too many|forbidden|not found|server error)/i);
      if (statusMatch) {
        const status = parseInt(statusMatch[1], 10);
        if (status === 429) return 'H429'; // Rate limited
        if (status >= 500) return `H${status}`; // Server error
        if (status >= 400) return `H${status}`; // Client error
      }

      // Check for specific error patterns
      if (message.includes('rate limit')) return 'H429';
      if (message.includes('timeout') || message.includes('timed out')) return 'TOUT';
      if (
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('failed to fetch')
      )
        return 'NCON';
      if (message.includes('abort')) return 'CANC';
    }

    // Check if error is a Response object with status
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 429) return 'H429';
      if (status >= 400) return `H${status}`;
    }

    return 'EUNK'; // Unknown error
  }

  /**
   * Update v4 result cards with newly fetched price data
   * Called after fetchPricesForMatches() completes to update cards in-place
   * rather than re-rendering the entire grid
   */
  private updateV4ResultCardPrices(): void {
    logger.info(
      '🔄 [ExtractorTool] updateV4ResultCardPrices:',
      this.v4ResultCards.length,
      'cards, priceData size:',
      this.priceData.size
    );

    for (const card of this.v4ResultCards) {
      const currentData = card.data;
      if (!currentData?.dye) continue;

      const priceInfo = this.priceData.get(currentData.dye.itemID);
      // Get market server from price data, falling back to selected server from UI
      const marketServer =
        this.marketBoardService.getWorldNameForPrice(priceInfo) ??
        this.marketBoard?.getSelectedServer();

      logger.info(
        '  📦 Updating card:',
        currentData.dye.name,
        '| server:',
        marketServer,
        '| price:',
        priceInfo?.currentMinPrice
      );

      // Update card's showPrice display option (controls visibility of price section)
      card.showPrice = this.displayOptions.showPrice && this.showPrices;

      // Determine if we should show an error code instead of price
      // Show error if: showPrices is on, there's an error, AND no cached price data
      const shouldShowError = this.showPrices && this.lastMarketError && !priceInfo;

      // Update card data (triggers Lit re-render)
      card.data = {
        ...currentData,
        price: this.showPrices && priceInfo ? priceInfo.currentMinPrice : undefined,
        marketServer: marketServer,
        marketError: shouldShowError ? this.lastMarketError : undefined,
      };
    }
  }

  // ============================================================================
  // Palette Extraction
  // ============================================================================

  /**
   * Extract palette from loaded image using K-Means clustering.
   * 3C: this is the one surviving bulk path (Auto-extract) — it fills the roll.
   */
  private async extractPalette(): Promise<void> {
    // Get canvas from ImageZoomController
    const canvas = this.imageZoom?.getCanvas();

    if (!canvas || !this.currentImage) {
      ToastService.error(LanguageService.t('matcher.noImageForPalette'));
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      ToastService.error(LanguageService.t('errors.canvasContextFailed'));
      return;
    }

    // Update the Auto-extract buttons (roll header + left panel) to show
    // the loading state
    for (const btn of [this.rollAutoBtn, this.extractPaletteBtn]) {
      if (btn) {
        btn.textContent = LanguageService.t('matcher.extractingPalette');
        btn.disabled = true;
        btn.style.opacity = '0.7';
      }
    }

    // OPT-011: yield a frame so the "Extracting…" button state actually
    // paints — the work below is synchronous and previously started before
    // the browser could render the DOM writes above.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      // Get pixel data from canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // OPT-011: downsample the K-means input on large images (same grid
      // heuristic as findColorPositions) — ~10× less blocking work on a 4K
      // screenshot with negligible palette-quality loss.
      const pixels = this.samplePixelsForPalette(imageData);

      if (pixels.length === 0) {
        ToastService.error(LanguageService.t('errors.noPixelsToAnalyze'));
        return;
      }

      // Extract palette and match to dyes
      const matches = this.paletteService.extractAndMatchPalette(pixels, dyeService, {
        colorCount: this.paletteColorCount,
      });

      this.lastPaletteResults = matches;

      // Populate extracted colors history from palette results
      this.populateHistoryFromPalette(matches);

      // Find representative positions for each extracted color and draw indicators
      const positions = this.findColorPositions(imageData, matches);
      this.drawSampleIndicators(canvas, ctx, matches, positions);

      // Render results
      this.renderPaletteResults(matches);

      // Fetch prices if enabled
      if (this.showPrices && this.marketBoard) {
        // Convert PaletteMatch to DyeWithDistance for price fetching
        this.matchedDyes = matches.map((m: PaletteMatch) => ({
          ...m.matchedDye,
          distance: m.distance,
        }));
        void this.fetchPricesForMatches();
      }

      ToastService.success(
        LanguageService.tInterpolate('matcher.paletteExtracted', {
          count: String(matches.length),
        })
      );

      logger.info('[MatcherTool] Palette extracted:', matches.length, 'colors');
    } catch (error) {
      logger.error('[MatcherTool] Palette extraction failed:', error);
      ToastService.error(LanguageService.t('errors.paletteExtractionFailed'));
    } finally {
      // Restore button state
      for (const btn of [this.rollAutoBtn, this.extractPaletteBtn]) {
        if (btn) {
          btn.textContent = LanguageService.t('matcher.autoExtract');
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      }
    }
  }

  /**
   * OPT-011: build the K-means input from a sampled pixel grid instead of
   * every pixel. Targets ~100k samples — small images are used in full,
   * a 4K screenshot (~8.3M pixels) is reduced ~80×. Skips near-transparent
   * pixels like PaletteService.pixelDataToRGBFiltered did.
   */
  private samplePixelsForPalette(imageData: ImageData): RGB[] {
    const { data, width, height } = imageData;
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 100_000)));

    if (step === 1) {
      return PaletteService.pixelDataToRGBFiltered(data);
    }

    const pixels: RGB[] = [];
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        if (data[idx + 3] < 128) continue; // skip transparent
        pixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
      }
    }
    return pixels;
  }

  /**
   * Find representative pixel positions for each extracted color
   * Scans the image to find pixels closest to each centroid
   */
  private findColorPositions(
    imageData: ImageData,
    matches: PaletteMatch[]
  ): Array<{ x: number; y: number }> {
    const { data, width, height } = imageData;
    const positions: Array<{ x: number; y: number; distance: number }> = matches.map(() => ({
      x: 0,
      y: 0,
      distance: Infinity,
    }));

    // Sample grid (every 4th pixel for performance on large images)
    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 10000)));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // Skip transparent pixels
        if (a < 128) continue;

        // Check each extracted color
        for (let i = 0; i < matches.length; i++) {
          const extracted = matches[i].extracted;
          const dr = r - extracted.r;
          const dg = g - extracted.g;
          const db = b - extracted.b;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);

          if (dist < positions[i].distance) {
            positions[i] = { x, y, distance: dist };
          }
        }
      }
    }

    return positions.map((p) => ({ x: p.x, y: p.y }));
  }

  /**
   * Draw sample indicator circles on the canvas
   */
  private drawSampleIndicators(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    matches: PaletteMatch[],
    positions: Array<{ x: number; y: number }>
  ): void {
    // First redraw the original image to clear any previous indicators
    if (this.currentImage) {
      ctx.drawImage(this.currentImage, 0, 0);
    }

    // Calculate circle radius based on image size (2-4% of smaller dimension)
    const minDimension = Math.min(canvas.width, canvas.height);
    const radius = Math.max(15, Math.min(50, minDimension * 0.03));

    // Draw each indicator
    for (let i = 0; i < matches.length; i++) {
      const pos = positions[i];
      const match = matches[i];

      // Outer white circle (for visibility on dark backgrounds)
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Inner colored circle matching the extracted color
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgb(${match.extracted.r}, ${match.extracted.g}, ${match.extracted.b})`;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Small center dot
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${match.extracted.r}, ${match.extracted.g}, ${match.extracted.b})`;
      ctx.fill();

      // Number label
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 3;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(String(i + 1), pos.x, pos.y - radius - 10);
      ctx.fillText(String(i + 1), pos.x, pos.y - radius - 10);
    }
  }

  /**
   * Post-process palette matches to replace duplicate dyes with next-best alternatives.
   * When preventDuplicates is enabled, each palette slot gets a unique dye by finding
   * the next closest unused dye for each extracted color.
   */
  private deduplicatePaletteResults(matches: PaletteMatch[]): PaletteMatch[] {
    if (!this.preventDuplicates || matches.length <= 1) {
      return matches;
    }

    const usedDyeIds = new Set<number>();
    const dedupedMatches: PaletteMatch[] = [];

    for (const match of matches) {
      if (!usedDyeIds.has(match.matchedDye.itemID)) {
        // No conflict — use the original match
        usedDyeIds.add(match.matchedDye.itemID);
        dedupedMatches.push(match);
      } else {
        // Duplicate detected — find the next-best unique dye for this extracted color
        const hex = `#${match.extracted.r.toString(16).padStart(2, '0')}${match.extracted.g.toString(16).padStart(2, '0')}${match.extracted.b.toString(16).padStart(2, '0')}`;
        const candidates = dyeService.findDyesWithinDistance(hex, {
          maxDistance: 200,
          limit: 20,
          matchingMethod: this.matchingMethod,
        });

        const alternative = candidates.find((dye) => !usedDyeIds.has(dye.itemID));
        if (alternative) {
          const distance = ColorService.getColorDistance(hex, alternative.hex);
          usedDyeIds.add(alternative.itemID);
          dedupedMatches.push({
            extracted: match.extracted,
            matchedDye: alternative,
            distance,
            dominance: match.dominance,
          });
        } else {
          // No unique alternative found — keep the duplicate as last resort
          usedDyeIds.add(match.matchedDye.itemID);
          dedupedMatches.push(match);
        }
      }
    }

    return dedupedMatches;
  }

  /**
   * Render extracted palette results using v4-result-card components
   */
  private renderPaletteResults(matches: PaletteMatch[]): void {
    if (!this.resultsContainer) return;

    // Apply deduplication if enabled (operates on raw matches, preserving originals)
    matches = this.deduplicatePaletteResults(matches);

    // Clear existing results
    clearContainer(this.resultsContainer);
    this.v4ResultCards = []; // Clear card references for price updates

    // Hide color info card (palette mode doesn't use single-color info)
    this.hideColorInfoCard();

    // Show the loaded flow
    this.updateFlowVisibility();

    // Update focus header (label + Fragment Mono count)
    if (this.resultsTitleElement) {
      this.resultsTitleElement.textContent = LanguageService.t('matcher.extractedPalette');
    }
    if (this.resultsCountElement) {
      this.resultsCountElement.textContent = String(matches.length);
    }

    // Enable/disable export button based on results
    if (this.exportBtn) {
      const hasResults = matches.length > 0;
      this.exportBtn.disabled = !hasResults;
      this.exportBtn.style.opacity = hasResults ? '1' : '0.5';
      this.exportBtn.style.cursor = hasResults ? 'pointer' : 'not-allowed';
    }

    if (matches.length === 0) {
      return;
    }

    // Create grid container for cards with 280px card width
    const cardsGrid = this.createElement('div', {
      className: 'extractor-results-grid v5-results-grid',
    });

    // Create a v4-result-card for each extracted color
    for (const match of matches) {
      // Convert RGB to hex for original color
      const originalHex = `#${match.extracted.r.toString(16).padStart(2, '0')}${match.extracted.g.toString(16).padStart(2, '0')}${match.extracted.b.toString(16).padStart(2, '0')}`;

      // Create result card data
      const cardData: ResultCardData = {
        dye: match.matchedDye,
        originalColor: originalHex,
        matchedColor: match.matchedDye.hex,
        deltaE: match.distance,
        matchingMethod: this.matchingMethod,
        vendorCost: match.matchedDye.cost,
      };

      // Add market price if available
      if (this.showPrices && this.priceData.has(match.matchedDye.itemID)) {
        const price = this.priceData.get(match.matchedDye.itemID)!;
        cardData.price = price.currentMinPrice;
        // Resolve worldId to actual world name (e.g., 34 -> "Brynhildr")
        // Fall back to selected server/DC if worldId not available or can't be resolved
        cardData.marketServer =
          WorldService.getWorldName(price.worldId) ||
          this.marketBoard?.getSelectedServer() ||
          'Market';
      }

      // Create the v4-result-card element
      const card = document.createElement('v4-result-card') as unknown as ResultCard;
      card.compact = true;
      card.data = cardData;
      // Make primary button open context menu (same as Swatch tool)
      card.setAttribute('primary-opens-menu', 'true');

      // Apply display options from config
      card.showHex = this.displayOptions.showHex;
      card.showRgb = this.displayOptions.showRgb;
      card.showHsv = this.displayOptions.showHsv;
      card.showLab = this.displayOptions.showLab;
      card.showCmyk = this.displayOptions.showCmyk;
      card.showDeltaE = this.displayOptions.showDeltaE;
      card.showHue = this.displayOptions.showHue ?? true;
      card.showStain = this.displayOptions.showStain ?? true;
      card.showConsolidation = this.displayOptions.showSpectrum ?? true;
      card.showPrice = this.displayOptions.showPrice && this.showPrices;
      card.showAcquisition = this.displayOptions.showAcquisition;

      // Listen for context actions (both primary button and context menu trigger this)
      card.addEventListener('context-action', ((
        e: CustomEvent<{ action: ContextAction; dye: Dye }>
      ) => {
        this.handleContextAction(e.detail.action, e.detail.dye);
      }) as EventListener);

      // Store card reference for price updates
      this.v4ResultCards.push(card);
      cardsGrid.appendChild(card);
    }

    this.resultsContainer.appendChild(cardsGrid);
  }

  /**
   * Handle context menu actions from result cards
   */
  private handleContextAction(action: ContextAction, dye: Dye): void {
    switch (action) {
      case 'add-comparison':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', {
            detail: { toolId: 'comparison', dye },
          })
        );
        ToastService.success(LanguageService.t('harmony.addedToComparison'));
        break;

      case 'add-mixer':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', {
            detail: { toolId: 'mixer', dye },
          })
        );
        ToastService.success(LanguageService.t('harmony.addedToMixer'));
        break;

      case 'add-accessibility':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', {
            detail: { toolId: 'accessibility', dye },
          })
        );
        ToastService.success(LanguageService.t('harmony.addedToAccessibility'));
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
          ToastService.success(LanguageService.t('success.copiedToClipboard'));
        });
        break;
    }
  }

  /**
   * Open the shared export sheet over the current roll. Each pick exports as a
   * pair — the pixel actually sampled and the dye it resolved to — because the
   * drift between them is the whole reason this tool matches rather than just
   * reporting colours.
   */
  private openPaletteExport(): void {
    openExportSheet({
      tool: 'extractor',
      title: LanguageService.t('matcher.extractedPalette'),
      entries: this.lastPaletteResults.map((match, index) => {
        const { r, g, b } = match.extracted;
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        return {
          key: `pick-${index + 1}`,
          source: hex,
          dye: match.matchedDye,
          delta: match.distance,
        };
      }),
    });
  }
}
