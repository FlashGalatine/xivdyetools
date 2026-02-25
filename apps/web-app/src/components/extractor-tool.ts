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
import { DyeFilters, type DyeFilterConfig } from '@components/dye-filters';
import { MarketBoard } from '@components/market-board';
import { createDyeActionDropdown } from '@components/dye-action-dropdown';
import {
  ColorService,
  ConfigController,
  dyeService,
  LanguageService,
  MarketBoardService,
  StorageService,
  ToastService,
  // WEB-REF-003 Phase 3: Shared panel builders
  buildFiltersPanel,
  buildMarketPanel,
} from '@services/index';
import { WorldService } from '@services/world-service';
// Note: setupMarketBoardListeners still used by drawer code until Phase 2 refactor
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import {
  ICON_FILTER,
  ICON_MARKET,
  ICON_IMAGE,
  ICON_PALETTE,
  ICON_SETTINGS,
  ICON_CLIPBOARD,
} from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, DyeWithDistance, PriceData } from '@shared/types';
import type {
  ExtractorConfig,
  DisplayOptionsConfig,
  MatchingMethod,
} from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';
import { PaletteService, type PaletteMatch } from '@xivdyetools/core';
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
} as const;

// Maximum image size to store in localStorage (2MB to be safe)
const MAX_IMAGE_STORAGE_SIZE = 2 * 1024 * 1024;

// Alias for backward compatibility
const ICON_UPLOAD = ICON_IMAGE;

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
  private filterConfig: DyeFilterConfig | null = null;

  // WEB-REF-003 Phase 4: MarketBoardService (shared price cache with race condition protection)
  private marketBoardService: MarketBoardService;

  // Getters for service state (replaces local showPrices and priceData fields)
  private get showPrices(): boolean {
    return this.marketBoardService.getShowPrices();
  }
  private get priceData(): Map<number, PriceData> {
    return this.marketBoardService.getAllPrices();
  }
  private currentImage: HTMLImageElement | null = null;
  private currentImageDataUrl: string | null = null;
  private displayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };
  private matchingMethod: MatchingMethod = 'oklab';
  private preventDuplicates: boolean = true;

  // Child components
  private imageUpload: ImageUploadDisplay | null = null;
  private colorPicker: ColorPickerDisplay | null = null;
  private imageZoom: ImageZoomController | null = null;
  private recentColors: RecentColorsPanel | null = null;
  private dyeFilters: DyeFilters | null = null;
  private marketBoard: MarketBoard | null = null;
  private filtersPanel: CollapsiblePanel | null = null;
  private marketPanel: CollapsiblePanel | null = null;
  private paletteService: PaletteService;

  // Collapsible section panels
  private imageSourcePanel: CollapsiblePanel | null = null;
  private colorSelectionPanel: CollapsiblePanel | null = null;
  private optionsPanel: CollapsiblePanel | null = null;

  // DOM References
  private sampleSlider: HTMLInputElement | null = null;
  private sampleDisplay: HTMLElement | null = null;
  private paletteModeCheckbox: HTMLInputElement | null = null;
  private paletteOptionsContainer: HTMLElement | null = null;
  private colorCountSlider: HTMLInputElement | null = null;
  private colorCountDisplay: HTMLElement | null = null;
  private extractPaletteBtn: HTMLButtonElement | null = null;
  private exportCssBtn: HTMLButtonElement | null = null;
  private resultsContainer: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private resultsTitleElement: HTMLElement | null = null;
  private dropZone: HTMLElement | null = null;
  private dropContent: HTMLElement | null = null;
  private dropZoneFileInput: HTMLInputElement | null = null;
  private imageSectionElement: HTMLElement | null = null;
  private extractorLayoutElement: HTMLElement | null = null;

  // Mobile-specific DOM References (separate from desktop to avoid conflicts)
  private mobileSampleSlider: HTMLInputElement | null = null;
  private mobileSampleDisplay: HTMLElement | null = null;
  private mobilePaletteModeCheckbox: HTMLInputElement | null = null;
  private mobilePaletteOptionsContainer: HTMLElement | null = null;
  private mobileColorCountSlider: HTMLInputElement | null = null;
  private mobileColorCountDisplay: HTMLElement | null = null;
  private mobileExtractPaletteBtn: HTMLButtonElement | null = null;
  private mobileDyeFilters: DyeFilters | null = null;
  private mobileImageUpload: ImageUploadDisplay | null = null;
  private mobileColorPicker: ColorPickerDisplay | null = null;
  private mobileMarketBoard: MarketBoard | null = null;
  private mobileImageSourceExpanded: boolean = true;
  private mobileColorSelectionExpanded: boolean = true;
  private mobileOptionsExpanded: boolean = false;
  private mobileFiltersExpanded: boolean = false;
  private mobileMarketExpanded: boolean = false;

  // Palette extraction state
  private lastPaletteResults: PaletteMatch[] = [];
  /** V4 result card elements for updating prices after fetch */
  private v4ResultCards: ResultCard[] = [];
  /** Last market fetch error code for display on cards (e.g., "H429", "NOFF") */
  private lastMarketError: string | undefined = undefined;

  // Subscriptions
  private languageUnsubscribe: (() => void) | null = null;
  private configUnsubscribe: (() => void) | null = null;
  private marketConfigUnsubscribe: (() => void) | null = null;

  constructor(container: HTMLElement, options: ExtractorToolOptions) {
    super(container);
    this.options = options;

    // Load persisted state
    this.sampleSize = StorageService.getItem<number>(STORAGE_KEYS.sampleSize) ?? 5;
    this.paletteMode = StorageService.getItem<boolean>(STORAGE_KEYS.paletteMode) ?? true; // v4: Default to palette mode
    this.paletteColorCount = StorageService.getItem<number>(STORAGE_KEYS.paletteColorCount) ?? 4;
    this.vibrancyBoost = StorageService.getItem<boolean>(STORAGE_KEYS.vibrancyBoost) ?? true;

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

    if (this.options.drawerContent) {
      this.renderDrawerContent();
    }

    this.element = this.container;
  }

  bindEvents(): void {
    // FIX: Events from child components bubble through leftPanel, not this.container
    // The container is a detached div, so we must listen on the actual panel elements
    const leftPanel = this.options.leftPanel;

    // Image upload events - listen on leftPanel where ImageUploadDisplay is rendered
    this.onPanelEvent(leftPanel, 'image-loaded', (event: CustomEvent) => {
      const { image, dataUrl } = event.detail;
      this.currentImage = image;
      this.currentImageDataUrl = dataUrl;

      // Persist image to storage if it's small enough
      if (dataUrl && dataUrl.length < MAX_IMAGE_STORAGE_SIZE) {
        StorageService.setItem(STORAGE_KEYS.imageDataUrl, dataUrl);
        logger.info('[MatcherTool] Image saved to storage');
      } else if (dataUrl) {
        // Clear any previously stored image if new one is too large
        StorageService.removeItem(STORAGE_KEYS.imageDataUrl);
        logger.info('[MatcherTool] Image too large to persist, cleared storage');
      }

      ToastService.success(LanguageService.t('matcher.imageLoaded'));

      // Hide drop zone content and show canvas
      if (this.dropContent) {
        this.dropContent.style.display = 'none';
      }
      if (this.dropZone) {
        this.dropZone.classList.add('has-image');
      }
      if (this.canvasContainer) {
        this.canvasContainer.classList.remove('hidden');
        this.canvasContainer.style.display = 'block';
      }

      if (this.imageZoom) {
        this.imageZoom.setImage(image);
        // Auto-fit image after loading
        this.imageZoom.autoFit();
      }

      this.showEmptyState(false);
      this.updateDrawerContent();

      // Update responsive layout now that image is loaded
      this.updateExtractorLayout();

      // V4: Auto-extract palette on image load
      void this.extractPalette();
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
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update();
    });

    // Subscribe to config changes from V4 ConfigSidebar
    this.configUnsubscribe = ConfigController.getInstance().subscribe('extractor', (config) => {
      this.setConfig(config);
    });

    // Subscribe to market config changes (from ConfigSidebar)
    // Re-render results and fetch prices when server changes
    this.marketConfigUnsubscribe = ConfigController.getInstance().subscribe('market', (config) => {
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
    });

    // Restore saved image from storage
    const savedImageDataUrl = StorageService.getItem<string>(STORAGE_KEYS.imageDataUrl);
    if (savedImageDataUrl) {
      this.restoreSavedImage(savedImageDataUrl);
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

    // Initial responsive layout update
    this.updateExtractorLayout();

    // Listen for window resize to update responsive layout
    this.on(window, 'resize', () => {
      this.updateExtractorLayout();
    });

    logger.info('[MatcherTool] Mounted');
  }

  /**
   * Restore a saved image from storage
   */
  private restoreSavedImage(dataUrl: string): void {
    const img = new Image();

    img.onload = () => {
      this.currentImage = img;
      this.currentImageDataUrl = dataUrl;

      // Hide drop content, show canvas
      if (this.dropContent) {
        this.dropContent.style.display = 'none';
      }
      if (this.dropZone) {
        this.dropZone.classList.add('has-image');
      }
      if (this.canvasContainer) {
        this.canvasContainer.classList.remove('hidden');
        this.canvasContainer.style.display = 'block';
      }

      if (this.imageZoom) {
        this.imageZoom.setImage(img);
        // Auto-fit image after restoring
        this.imageZoom.autoFit();
      }

      this.showEmptyState(false);
      this.updateDrawerContent();

      // Update responsive layout now that image is restored
      this.updateExtractorLayout();

      logger.info('[ExtractorTool] Restored saved image from storage');

      // Clear handlers
      img.onload = null;
      img.onerror = null;

      // Auto-extract palette to restore results
      void this.extractPalette();
    };

    img.onerror = () => {
      // Failed to load saved image, clear it from storage
      StorageService.removeItem(STORAGE_KEYS.imageDataUrl);
      logger.warn('[MatcherTool] Failed to restore saved image, cleared storage');
      img.onload = null;
      img.onerror = null;
    };

    img.src = dataUrl;
  }

  destroy(): void {
    // Cleanup subscriptions
    this.languageUnsubscribe?.();
    this.configUnsubscribe?.();
    this.marketConfigUnsubscribe?.();

    // Cleanup child components
    this.imageUpload?.destroy();
    this.colorPicker?.destroy();
    this.imageZoom?.destroy();
    this.recentColors?.destroy();
    this.dyeFilters?.destroy();
    this.marketBoard?.destroy();
    this.filtersPanel?.destroy();
    this.marketPanel?.destroy();

    // Cleanup collapsible section panels
    this.imageSourcePanel?.destroy();
    this.colorSelectionPanel?.destroy();
    this.optionsPanel?.destroy();

    // Cleanup mobile components
    this.mobileDyeFilters?.destroy();
    this.mobileImageUpload?.destroy();
    this.mobileColorPicker?.destroy();
    this.mobileMarketBoard?.destroy();

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
      // Update mobile display
      if (this.mobileColorCountSlider) {
        this.mobileColorCountSlider.value = String(config.maxColors);
      }
      if (this.mobileColorCountDisplay) {
        this.mobileColorCountDisplay.textContent = String(config.maxColors);
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

    // Handle matchingMethod - re-match colors when algorithm changes
    if (config.matchingMethod !== undefined && config.matchingMethod !== this.matchingMethod) {
      this.matchingMethod = config.matchingMethod;
      needsReextract = true;
      logger.info(`[ExtractorTool] setConfig: matchingMethod -> ${config.matchingMethod}`);
    }

    // Handle preventDuplicates - re-render to apply/remove dedup
    if (config.preventDuplicates !== undefined && config.preventDuplicates !== this.preventDuplicates) {
      this.preventDuplicates = config.preventDuplicates;
      needsRerender = true;
      logger.info(`[ExtractorTool] setConfig: preventDuplicates -> ${config.preventDuplicates}`);
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
      icon: ICON_UPLOAD,
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
        this.updateDrawerContent();
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
    this.extractPaletteBtn = this.createElement('button', {
      className: 'w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors',
      textContent: LanguageService.t('matcher.extractPaletteBtn'),
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
   * Update extractor layout for responsive design
   * Reduces image section height on mobile when an image is loaded
   * so users can see at least one result card
   */
  private updateExtractorLayout(): void {
    const isMobile = window.innerWidth < 768;
    const hasImage = this.currentImage !== null;

    // Image section height:
    // - Desktop: 300px (unchanged)
    // - Mobile without image: 220px (reduced but shows drop zone UI)
    // - Mobile with image: 180px (compact to show results)
    if (this.imageSectionElement) {
      if (isMobile) {
        this.imageSectionElement.style.height = hasImage ? '180px' : '220px';
      } else {
        this.imageSectionElement.style.height = '300px';
      }
    }

    // Adjust layout padding and gap on mobile
    if (this.extractorLayoutElement) {
      if (isMobile) {
        this.extractorLayoutElement.style.padding = '16px';
        this.extractorLayoutElement.style.gap = '16px';
      } else {
        this.extractorLayoutElement.style.padding = '32px';
        this.extractorLayoutElement.style.gap = '32px';
      }
    }
  }

  /**
   * Render dye filters collapsible panel
   * WEB-REF-003 Phase 3: Refactored to use shared builder
   */
  private renderFiltersPanel(container: HTMLElement): void {
    const refs = buildFiltersPanel(this, container, {
      storageKey: 'matcher_filters',
      storageKeyPrefix: 'v3_matcher',
      onFilterChange: (filters) => {
        this.filterConfig = filters;
        if (this.selectedColor) {
          this.matchColor(this.selectedColor);
        }
      },
    });
    this.filtersPanel = refs.panel;
    this.dyeFilters = refs.filters;
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
        console.info('🔔 [ExtractorTool] onPricesToggled called, showPrices=', this.showPrices);
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
        console.info('🔔 [ExtractorTool] onServerChanged called, showPrices=', this.showPrices);
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
  // Right Panel Rendering
  // ============================================================================

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Create main extractor layout container with inline styles
    // Store reference for responsive updates
    this.extractorLayoutElement = this.createElement('div', {
      className: 'extractor-layout',
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          gap: 32px;
          height: 100%;
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          padding: 32px;
          box-sizing: border-box;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    const extractorLayout = this.extractorLayoutElement;

    // === Top Section: Image Input ===
    // Store reference for responsive height updates
    this.imageSectionElement = this.createElement('div', {
      className: 'image-input-section',
      attributes: {
        style: `
          width: 100%;
          height: 300px;
          flex-shrink: 0;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    const imageSection = this.imageSectionElement;

    // Image drop zone
    // overflow: hidden clips the image content; zoom controls remain visible via inline styles
    this.dropZone = this.createElement('div', {
      className: 'image-drop-zone',
      attributes: {
        id: 'extractor-drop-zone',
        style: `
          width: 100%;
          height: 100%;
          border-radius: 12px;
          border: 2px dashed var(--theme-border, rgba(255, 255, 255, 0.1));
          background: rgba(255, 255, 255, 0.02);
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Drop content (shown when no image)
    this.dropContent = this.createElement('div', {
      className: 'drop-content',
      attributes: {
        style: `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 12px;
          pointer-events: none;
          z-index: 2;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    const dropIcon = this.createElement('div', {
      className: 'drop-icon',
      attributes: {
        style: `
          width: 150px;
          height: 150px;
          color: var(--theme-text-muted, #a0a0a0);
          opacity: 0.5;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    dropIcon.innerHTML = ICON_IMAGE;

    const dropText = this.createElement('span', {
      className: 'drop-text',
      textContent: LanguageService.t('matcher.dropImageHere'),
      attributes: {
        style: `
          font-size: 16px;
          color: var(--theme-text, #e0e0e0);
          font-weight: 500;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    const dropSubtext = this.createElement('span', {
      className: 'drop-subtext',
      textContent: LanguageService.t('matcher.supportedFormats'),
      attributes: {
        style: `
          font-size: 13px;
          color: var(--theme-text-muted, #a0a0a0);
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    this.dropContent.appendChild(dropIcon);
    this.dropContent.appendChild(dropText);
    this.dropContent.appendChild(dropSubtext);

    // Paste from Clipboard button
    // Uses navigator.clipboard.read() API (Chromium only); hidden in unsupported browsers
    if (typeof navigator?.clipboard?.read === 'function') {
      const pasteBtn = this.createElement('button', {
        className: 'btn-theme-primary',
        attributes: {
          style: `
            pointer-events: auto;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 4px;
            padding: 8px 16px;
            font-size: 13px;
            border-radius: 8px;
            cursor: pointer;
          `
            .replace(/\s+/g, ' ')
            .trim(),
        },
      }) as HTMLButtonElement;
      const pasteBtnIcon = this.createElement('span', {
        attributes: {
          style: 'width: 16px; height: 16px; display: inline-flex;',
          'aria-hidden': 'true',
        },
      });
      pasteBtnIcon.innerHTML = ICON_CLIPBOARD;
      const pasteBtnText = this.createElement('span', {
        textContent: LanguageService.t('matcher.pasteFromClipboard'),
      });
      pasteBtn.appendChild(pasteBtnIcon);
      pasteBtn.appendChild(pasteBtnText);

      this.on(pasteBtn, 'click', (e: Event) => {
        e.stopPropagation(); // Don't trigger drop zone's file input click
        void this.pasteFromClipboardAPI();
      });

      this.dropContent.appendChild(pasteBtn);
    }

    // Paste hint text (shown in all browsers — Ctrl+V always works)
    const pasteHint = this.createElement('span', {
      textContent: LanguageService.t('matcher.pasteHint'),
      attributes: {
        style: `
          font-size: 12px;
          color: var(--theme-text-muted, #a0a0a0);
          opacity: 0.7;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    this.dropContent.appendChild(pasteHint);

    this.dropZone.appendChild(this.dropContent);

    // Image canvas container (hidden until image loaded)
    // overflow: visible ensures zoom controls aren't clipped by ancestor's overflow: hidden
    this.canvasContainer = this.createElement('div', {
      className: 'image-canvas-container hidden',
      attributes: {
        style: `
          position: relative;
          width: 100%;
          height: 100%;
          overflow: visible;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    this.renderImageCanvas();
    this.dropZone.appendChild(this.canvasContainer);

    imageSection.appendChild(this.dropZone);
    extractorLayout.appendChild(imageSection);

    // === Right Section: Results ===
    const resultsSection = this.createElement('div', {
      className: 'extractor-results-section',
      attributes: {
        style: `
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 16px;
          overflow: hidden;
          min-width: 0;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    // Section header with title and actions
    const sectionHeader = this.createElement('div', {
      className: 'extractor-section-header',
      attributes: {
        style: `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });

    const sectionTitle = this.createElement('span', {
      className: 'extractor-section-title',
      textContent: LanguageService.t('matcher.extractedPalette'),
      attributes: {
        style: `
          font-size: 14px;
          text-transform: uppercase;
          color: var(--theme-text-muted, #a0a0a0);
          font-weight: 600;
          letter-spacing: 1px;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    this.resultsTitleElement = sectionTitle;
    sectionHeader.appendChild(sectionTitle);

    // Action buttons
    const actions = this.createElement('div', {
      className: 'palette-actions',
      attributes: { style: 'display: flex; gap: 16px;' },
    });

    const actionBtnStyle = `
      background: none;
      border: none;
      color: var(--theme-primary, #d4af37);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `
      .replace(/\s+/g, ' ')
      .trim();

    const disabledBtnStyle = `${actionBtnStyle} opacity: 0.5; cursor: not-allowed;`;

    this.exportCssBtn = this.createElement('button', {
      className: 'action-btn-text',
      textContent: LanguageService.t('matcher.exportCss'),
      attributes: { disabled: 'true', style: disabledBtnStyle },
    }) as HTMLButtonElement;

    this.on(this.exportCssBtn, 'click', () => {
      this.exportPaletteAsCss();
    });

    actions.appendChild(this.exportCssBtn);
    sectionHeader.appendChild(actions);

    resultsSection.appendChild(sectionHeader);

    // Results grid container
    this.resultsContainer = this.createElement('div', {
      className: 'extractor-results-grid',
      attributes: {
        style: `
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          overflow-y: auto;
          padding-bottom: 16px;
          align-content: flex-start;
          justify-content: center;
          flex: 1;
          min-height: 0;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    resultsSection.appendChild(this.resultsContainer);

    // Empty state for results (shown until results available)
    this.emptyStateContainer = this.createElement('div', {
      className: 'extractor-empty-results',
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          flex: 1;
          text-align: center;
          color: var(--theme-text-muted, #a0a0a0);
          padding-top: 60px;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    this.renderEmptyState();
    resultsSection.appendChild(this.emptyStateContainer);

    extractorLayout.appendChild(resultsSection);
    right.appendChild(extractorLayout);

    // Setup drop zone interactions
    this.setupDropZoneInteractions();

    // If we already have an image loaded, hide the drop content immediately
    if (this.currentImage) {
      if (this.dropContent) {
        this.dropContent.style.display = 'none';
      }
      if (this.dropZone) {
        this.dropZone.classList.add('has-image');
      }
      if (this.canvasContainer) {
        this.canvasContainer.classList.remove('hidden');
        this.canvasContainer.style.display = 'block';
      }
      if (this.emptyStateContainer) {
        this.emptyStateContainer.style.display = 'none';
      }
    }
  }

  /**
   * Setup drop zone click and drag interactions
   */
  private setupDropZoneInteractions(): void {
    if (!this.dropZone || !this.dropContent) return;

    // Click to trigger file upload - create hidden file input in drop zone
    this.dropZoneFileInput = this.createElement('input', {
      attributes: {
        type: 'file',
        accept: 'image/*',
        style: 'display: none;',
      },
    }) as HTMLInputElement;
    this.dropZone.appendChild(this.dropZoneFileInput);

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

    // Only trigger file dialog when clicking on drop zone if no image is loaded
    // When an image is loaded, clicking on the canvas triggers canvas-clicked event instead
    this.on(this.dropZone, 'click', (e: Event) => {
      // Don't trigger if click came from the canvas (stopPropagation should handle this,
      // but check target as a fallback)
      const target = e.target as HTMLElement;
      if (target.tagName === 'CANVAS') return;

      // If no image loaded, trigger file dialog
      if (!this.currentImage) {
        this.dropZoneFileInput?.click();
      }
    });

    // Drag and drop handling
    this.on(this.dropZone, 'dragover', (e: Event) => {
      e.preventDefault();
      this.dropZone?.classList.add('drag-over');
    });

    this.on(this.dropZone, 'dragleave', () => {
      this.dropZone?.classList.remove('drag-over');
    });

    this.on(this.dropZone, 'drop', (e: Event) => {
      e.preventDefault();
      this.dropZone?.classList.remove('drag-over');
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
   * Handle a dropped image file
   */
  private handleDroppedFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        this.currentImage = img;
        this.currentImageDataUrl = dataUrl;

        // Persist image to storage if it's small enough
        if (dataUrl && dataUrl.length < MAX_IMAGE_STORAGE_SIZE) {
          StorageService.setItem(STORAGE_KEYS.imageDataUrl, dataUrl);
          logger.info('[ExtractorTool] Image saved to storage (drop zone)');
        } else if (dataUrl) {
          // Clear any previously stored image if new one is too large
          StorageService.removeItem(STORAGE_KEYS.imageDataUrl);
          logger.info('[ExtractorTool] Image too large to persist, cleared storage');
        }

        // Hide drop content, show canvas
        if (this.dropContent) {
          this.dropContent.style.display = 'none';
        }
        if (this.dropZone) {
          this.dropZone.classList.add('has-image');
        }
        if (this.canvasContainer) {
          this.canvasContainer.classList.remove('hidden');
          this.canvasContainer.style.display = 'block';
        }

        // Set image in zoom controller
        if (this.imageZoom) {
          this.imageZoom.setImage(img);
          // Auto-fit image after loading from drop zone
          this.imageZoom.autoFit();
        }

        // Emit image loaded event
        this.emit('image-loaded', { image: img, dataUrl });

        // Hide empty state and update drawer
        this.showEmptyState(false);
        this.updateDrawerContent();

        // Update responsive layout now that image is loaded
        this.updateExtractorLayout();

        ToastService.success(LanguageService.t('matcher.imageLoaded'));

        // Auto-extract palette (v4 default behavior)
        void this.extractPalette();
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Read image from clipboard using the Clipboard API (navigator.clipboard.read)
   * This is the handler for the explicit "Paste from Clipboard" button.
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
   * Clear the current image and reset to empty state
   */
  private clearImage(): void {
    // Clear image state
    this.currentImage = null;
    this.currentImageDataUrl = null;

    // Clear from storage
    StorageService.removeItem(STORAGE_KEYS.imageDataUrl);

    // Clear palette results (price cache managed by MarketBoardService)
    this.lastPaletteResults = [];
    this.matchedDyes = [];

    // Show drop zone content, hide canvas
    if (this.dropContent) {
      this.dropContent.style.display = 'flex';
    }
    if (this.dropZone) {
      this.dropZone.classList.remove('has-image');
    }
    if (this.canvasContainer) {
      this.canvasContainer.classList.add('hidden');
      this.canvasContainer.style.display = 'none';
    }

    // Clear results container
    if (this.resultsContainer) {
      clearContainer(this.resultsContainer);
    }

    // Reset section title
    if (this.resultsTitleElement) {
      this.resultsTitleElement.textContent = LanguageService.t('matcher.extractedPalette');
    }

    // Disable export button
    if (this.exportCssBtn) {
      this.exportCssBtn.disabled = true;
      this.exportCssBtn.style.opacity = '0.5';
      this.exportCssBtn.style.cursor = 'not-allowed';
    }

    // Show empty state
    this.showEmptyState(true);
    this.updateDrawerContent();

    // Update responsive layout (image cleared, may expand drop zone)
    this.updateExtractorLayout();

    // Re-render the canvas area to clear zoom controller
    this.renderImageCanvas();

    ToastService.info(LanguageService.t('matcher.imageCleared'));
    logger.info('[ExtractorTool] Image cleared');
  }

  /**
   * Render image canvas with zoom controller
   */
  private renderImageCanvas(): void {
    if (!this.canvasContainer) return;
    clearContainer(this.canvasContainer);

    // overflow: visible ensures zoom controls aren't clipped by ancestor's overflow: hidden
    const canvasWrapper = this.createElement('div', {
      className: 'w-full h-full relative',
      attributes: {
        style: 'overflow: visible;',
      },
    });
    this.canvasContainer.appendChild(canvasWrapper);

    // NOTE: Pixel color sampling disabled for v4 extractor - focus on palette extraction only
    this.imageZoom = new ImageZoomController(canvasWrapper, {
      // No onColorSampled callback - palette extraction is triggered via config instead
    });
    this.imageZoom.init();

    // Listen for clear image request from zoom controls
    this.onPanelEvent(canvasWrapper, 'image-clear-requested', () => {
      this.clearImage();
    });

    // Listen for canvas click (no drag) to trigger file upload
    this.onPanelEvent(canvasWrapper, 'canvas-clicked', () => {
      // Trigger file dialog when user clicks (not drags) on the canvas
      this.dropZoneFileInput?.click();
    });

    // Listen for image-sampled (drag to select region) to extract palette from region
    this.onPanelEvent(canvasWrapper, 'image-sampled', (event: CustomEvent) => {
      const { x, y, width, height, isRegion } = event.detail;
      if (isRegion) {
        // User selected a region - extract palette from that region
        void this.extractPaletteFromRegion(x, y, width, height);
      }
    });

    // If we already have an image, set it
    if (this.currentImage) {
      this.imageZoom.setImage(this.currentImage);
    }
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): void {
    if (!this.emptyStateContainer) return;
    clearContainer(this.emptyStateContainer);

    // Icon with inline sizing
    const iconSpan = this.createElement('span', {
      attributes: {
        style: 'width: 150px; height: 150px; display: block; margin-bottom: 16px; opacity: 0.4;',
      },
    });
    iconSpan.innerHTML = ICON_IMAGE;

    // Text
    const text = this.createElement('p', {
      textContent: LanguageService.t('matcher.uploadPrompt'),
      attributes: { style: 'font-size: 16px; margin: 0;' },
    });

    this.emptyStateContainer.appendChild(iconSpan);
    this.emptyStateContainer.appendChild(text);
  }

  /**
   * Render recent colors panel
   */
  private renderRecentColors(container: HTMLElement): void {
    this.recentColors = new RecentColorsPanel(container, {
      onColorSelected: (hex) => {
        this.matchColor(hex);
      },
      storageKey: 'v3_matcher_recent',
      maxColors: 10,
    });
    this.recentColors.init();
  }

  /**
   * Show/hide empty state and drop zone content
   */
  private showEmptyState(show: boolean): void {
    if (this.emptyStateContainer) {
      this.emptyStateContainer.classList.toggle('hidden', !show);
      this.emptyStateContainer.style.display = show ? 'flex' : 'none';
    }

    // When hiding empty state (showing results), also hide drop content if we have an image
    if (!show && this.currentImage) {
      if (this.dropContent) {
        this.dropContent.style.display = 'none';
      }
      if (this.dropZone) {
        this.dropZone.classList.add('has-image');
      }
      if (this.canvasContainer) {
        this.canvasContainer.classList.remove('hidden');
        this.canvasContainer.style.display = 'block';
      }
    }
  }

  // ============================================================================
  // Mobile Drawer Content
  // ============================================================================

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    this.updateDrawerContent();
  }

  private updateDrawerContent(): void {
    if (!this.options.drawerContent) return;
    const drawer = this.options.drawerContent;
    clearContainer(drawer);

    // Destroy previous mobile components if they exist (clean slate)
    this.mobileDyeFilters?.destroy();
    this.mobileDyeFilters = null;
    this.mobileImageUpload?.destroy();
    this.mobileImageUpload = null;
    this.mobileColorPicker?.destroy();
    this.mobileColorPicker = null;
    this.mobileMarketBoard?.destroy();
    this.mobileMarketBoard = null;

    const content = this.createElement('div', { className: 'space-y-0' });

    // === Image Source Accordion Section ===
    const imageSourceSection = this.renderMobileImageSourceAccordion();
    content.appendChild(imageSourceSection);

    // === Color Selection Accordion Section ===
    const colorSelectionSection = this.renderMobileColorSelectionAccordion();
    content.appendChild(colorSelectionSection);

    // === Options Accordion Section ===
    const optionsSection = this.renderMobileOptionsAccordion();
    content.appendChild(optionsSection);

    // === Dye Filters Accordion Section ===
    const filtersSection = this.renderMobileFiltersAccordion();
    content.appendChild(filtersSection);

    // === Market Board Accordion Section ===
    const marketSection = this.renderMobileMarketAccordion();
    content.appendChild(marketSection);

    drawer.appendChild(content);
  }

  /**
   * Render mobile options accordion section
   */
  private renderMobileOptionsAccordion(): HTMLElement {
    const section = this.createElement('div', {
      className: 'border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });

    // Accordion header
    const header = this.createElement('button', {
      className: 'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
      attributes: {
        style: 'background: var(--theme-background-secondary); color: var(--theme-text);',
        type: 'button',
        'aria-expanded': String(this.mobileOptionsExpanded),
      },
    });

    const titleContainer = this.createElement('span', {
      className: 'flex items-center gap-2 font-medium text-sm',
    });
    const iconSpan = this.createElement('span', {
      className: 'w-4 h-4 flex-shrink-0',
      innerHTML: ICON_SETTINGS,
    });
    const titleText = this.createElement('span', {
      textContent: LanguageService.t('matcher.options'),
    });
    titleContainer.appendChild(iconSpan);
    titleContainer.appendChild(titleText);
    header.appendChild(titleContainer);

    // Chevron
    const chevron = this.createElement('span', {
      className: 'w-5 h-5 transition-transform duration-200',
      innerHTML: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-full h-full">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
      </svg>`,
      attributes: {
        style: this.mobileOptionsExpanded
          ? 'transform: rotate(0deg);'
          : 'transform: rotate(-90deg);',
      },
    });
    header.appendChild(chevron);
    section.appendChild(header);

    // Content area
    const contentWrapper = this.createElement('div', {
      className: 'overflow-hidden transition-all duration-200',
      attributes: {
        style: this.mobileOptionsExpanded
          ? 'max-height: 500px; opacity: 1;'
          : 'max-height: 0; opacity: 0;',
      },
    });

    const contentInner = this.createElement('div', {
      className: 'px-4 py-3 space-y-4',
      attributes: { style: 'background: var(--theme-card-background);' },
    });

    // Sample size slider
    const sampleGroup = this.createElement('div');
    const sampleLabel = this.createElement('label', {
      className: 'flex items-center justify-between text-sm mb-2',
    });
    sampleLabel.innerHTML = `
      <span style="color: var(--theme-text);">${LanguageService.t('matcher.sampleSize')}</span>
      <span class="number" style="color: var(--theme-text-muted);">${this.sampleSize}px</span>
    `;
    this.mobileSampleDisplay = sampleLabel.querySelector('span:last-child') as HTMLElement;

    this.mobileSampleSlider = this.createElement('input', {
      attributes: { type: 'range', min: '1', max: '10', value: String(this.sampleSize) },
      className: 'w-full',
    }) as HTMLInputElement;

    this.on(this.mobileSampleSlider, 'input', () => {
      if (this.mobileSampleSlider && this.mobileSampleDisplay) {
        this.sampleSize = parseInt(this.mobileSampleSlider.value, 10);
        this.mobileSampleDisplay.textContent = `${this.sampleSize}px`;
        StorageService.setItem(STORAGE_KEYS.sampleSize, this.sampleSize);
        // Sync desktop slider if visible
        if (this.sampleSlider) {
          this.sampleSlider.value = String(this.sampleSize);
        }
        if (this.sampleDisplay) {
          this.sampleDisplay.textContent = `${this.sampleSize}px`;
        }
      }
    });

    sampleGroup.appendChild(sampleLabel);
    sampleGroup.appendChild(this.mobileSampleSlider);
    contentInner.appendChild(sampleGroup);

    // Palette mode toggle
    const paletteToggle = this.createElement('label', {
      className: 'flex items-center gap-3 cursor-pointer',
    });

    this.mobilePaletteModeCheckbox = this.createElement('input', {
      attributes: { type: 'checkbox' },
      className: 'w-5 h-5 rounded',
    }) as HTMLInputElement;
    this.mobilePaletteModeCheckbox.checked = this.paletteMode;

    this.on(this.mobilePaletteModeCheckbox, 'change', () => {
      if (this.mobilePaletteModeCheckbox) {
        this.paletteMode = this.mobilePaletteModeCheckbox.checked;
        StorageService.setItem(STORAGE_KEYS.paletteMode, this.paletteMode);
        // Sync desktop checkbox if visible
        if (this.paletteModeCheckbox) {
          this.paletteModeCheckbox.checked = this.paletteMode;
        }
        this.updatePaletteOptionsVisibility();
        this.updateMobilePaletteOptionsVisibility();
      }
    });

    const toggleText = this.createElement('div');
    toggleText.innerHTML = `
      <p class="text-sm font-medium" style="color: var(--theme-text);">${LanguageService.t('matcher.extractPalette')}</p>
      <p class="text-xs" style="color: var(--theme-text-muted);">${LanguageService.t('matcher.extractPaletteDesc')}</p>
    `;

    paletteToggle.appendChild(this.mobilePaletteModeCheckbox);
    paletteToggle.appendChild(toggleText);
    contentInner.appendChild(paletteToggle);

    // Palette options (color count + extract button)
    this.mobilePaletteOptionsContainer = this.createElement('div', {
      className: 'space-y-3 pt-3 border-t',
      attributes: {
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
    this.mobileColorCountDisplay = colorCountLabel.querySelector('span:last-child') as HTMLElement;

    this.mobileColorCountSlider = this.createElement('input', {
      attributes: { type: 'range', min: '3', max: '5', value: String(this.paletteColorCount) },
      className: 'w-full',
    }) as HTMLInputElement;

    this.on(this.mobileColorCountSlider, 'input', () => {
      if (this.mobileColorCountSlider && this.mobileColorCountDisplay) {
        this.paletteColorCount = parseInt(this.mobileColorCountSlider.value, 10);
        this.mobileColorCountDisplay.textContent = String(this.paletteColorCount);
        StorageService.setItem(STORAGE_KEYS.paletteColorCount, this.paletteColorCount);
        // Sync desktop slider if visible
        if (this.colorCountSlider) {
          this.colorCountSlider.value = String(this.paletteColorCount);
        }
        if (this.colorCountDisplay) {
          this.colorCountDisplay.textContent = String(this.paletteColorCount);
        }
      }
    });

    colorCountGroup.appendChild(colorCountLabel);
    colorCountGroup.appendChild(this.mobileColorCountSlider);
    this.mobilePaletteOptionsContainer.appendChild(colorCountGroup);

    // Extract palette button
    this.mobileExtractPaletteBtn = this.createElement('button', {
      className: 'w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors',
      textContent: LanguageService.t('matcher.extractPaletteBtn'),
      attributes: {
        style: 'background: var(--theme-primary); color: white;',
      },
    }) as HTMLButtonElement;

    this.on(this.mobileExtractPaletteBtn, 'click', () => {
      void this.extractPalette();
    });

    this.mobilePaletteOptionsContainer.appendChild(this.mobileExtractPaletteBtn);
    contentInner.appendChild(this.mobilePaletteOptionsContainer);

    contentWrapper.appendChild(contentInner);
    section.appendChild(contentWrapper);

    // Toggle event
    this.on(header, 'click', () => {
      this.mobileOptionsExpanded = !this.mobileOptionsExpanded;
      header.setAttribute('aria-expanded', String(this.mobileOptionsExpanded));
      chevron.style.transform = this.mobileOptionsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
      contentWrapper.style.maxHeight = this.mobileOptionsExpanded ? '500px' : '0';
      contentWrapper.style.opacity = this.mobileOptionsExpanded ? '1' : '0';
    });

    return section;
  }

  /**
   * Render mobile dye filters accordion section
   */
  private renderMobileFiltersAccordion(): HTMLElement {
    const section = this.createElement('div', {
      className: 'border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });

    // Accordion header
    const header = this.createElement('button', {
      className: 'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
      attributes: {
        style: 'background: var(--theme-background-secondary); color: var(--theme-text);',
        type: 'button',
        'aria-expanded': String(this.mobileFiltersExpanded),
      },
    });

    const titleContainer = this.createElement('span', {
      className: 'flex items-center gap-2 font-medium text-sm',
    });
    const iconSpan = this.createElement('span', {
      className: 'w-4 h-4 flex-shrink-0',
      innerHTML: ICON_FILTER,
    });
    const titleText = this.createElement('span', {
      textContent: LanguageService.t('filters.advancedFilters'),
    });
    titleContainer.appendChild(iconSpan);
    titleContainer.appendChild(titleText);
    header.appendChild(titleContainer);

    // Chevron
    const chevron = this.createElement('span', {
      className: 'w-5 h-5 transition-transform duration-200',
      innerHTML: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-full h-full">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
      </svg>`,
      attributes: {
        style: this.mobileFiltersExpanded
          ? 'transform: rotate(0deg);'
          : 'transform: rotate(-90deg);',
      },
    });
    header.appendChild(chevron);
    section.appendChild(header);

    // Content area
    const contentWrapper = this.createElement('div', {
      className: 'overflow-hidden transition-all duration-200',
      attributes: {
        style: this.mobileFiltersExpanded
          ? 'max-height: 500px; opacity: 1;'
          : 'max-height: 0; opacity: 0;',
      },
    });

    const contentInner = this.createElement('div', {
      className: 'px-4 py-3',
      attributes: { style: 'background: var(--theme-card-background);' },
    });

    // Create mobile DyeFilters instance
    const filtersContainer = this.createElement('div', {
      attributes: { id: 'mobile-dye-filters' },
    });
    contentInner.appendChild(filtersContainer);

    this.mobileDyeFilters = new DyeFilters(filtersContainer, {
      storageKeyPrefix: 'v3_matcher',
      hideHeader: true, // We have our own accordion header
      onFilterChange: (filters) => {
        this.filterConfig = filters;
        if (this.selectedColor) {
          this.matchColor(this.selectedColor);
        }
      },
    });
    this.mobileDyeFilters.init();

    contentWrapper.appendChild(contentInner);
    section.appendChild(contentWrapper);

    // Toggle event
    this.on(header, 'click', () => {
      this.mobileFiltersExpanded = !this.mobileFiltersExpanded;
      header.setAttribute('aria-expanded', String(this.mobileFiltersExpanded));
      chevron.style.transform = this.mobileFiltersExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
      contentWrapper.style.maxHeight = this.mobileFiltersExpanded ? '500px' : '0';
      contentWrapper.style.opacity = this.mobileFiltersExpanded ? '1' : '0';
    });

    return section;
  }

  /**
   * Update mobile palette options visibility based on paletteMode
   */
  private updateMobilePaletteOptionsVisibility(): void {
    if (this.mobilePaletteOptionsContainer) {
      this.mobilePaletteOptionsContainer.style.display = this.paletteMode ? '' : 'none';
    }
  }

  /**
   * Render mobile image source accordion section
   */
  private renderMobileImageSourceAccordion(): HTMLElement {
    const section = this.createElement('div', {
      className: 'border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });

    // Accordion header
    const header = this.createElement('button', {
      className: 'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
      attributes: {
        style: 'background: var(--theme-background-secondary); color: var(--theme-text);',
        type: 'button',
        'aria-expanded': String(this.mobileImageSourceExpanded),
      },
    });

    const titleContainer = this.createElement('span', {
      className: 'flex items-center gap-2 font-medium text-sm',
    });
    const iconSpan = this.createElement('span', {
      className: 'w-4 h-4 flex-shrink-0',
      innerHTML: ICON_UPLOAD,
    });
    const titleText = this.createElement('span', {
      textContent: LanguageService.t('matcher.imageSource'),
    });
    titleContainer.appendChild(iconSpan);
    titleContainer.appendChild(titleText);
    header.appendChild(titleContainer);

    // Chevron
    const chevron = this.createElement('span', {
      className: 'w-5 h-5 transition-transform duration-200',
      innerHTML: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-full h-full">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
      </svg>`,
      attributes: {
        style: this.mobileImageSourceExpanded
          ? 'transform: rotate(0deg);'
          : 'transform: rotate(-90deg);',
      },
    });
    header.appendChild(chevron);
    section.appendChild(header);

    // Content area
    const contentWrapper = this.createElement('div', {
      className: 'overflow-hidden transition-all duration-200',
      attributes: {
        style: this.mobileImageSourceExpanded
          ? 'max-height: 800px; opacity: 1;'
          : 'max-height: 0; opacity: 0;',
      },
    });

    const contentInner = this.createElement('div', {
      className: 'px-4 py-3',
      attributes: { style: 'background: var(--theme-card-background);' },
    });

    // Create mobile ImageUploadDisplay instance
    const uploadContainer = this.createElement('div');
    contentInner.appendChild(uploadContainer);

    this.mobileImageUpload = new ImageUploadDisplay(uploadContainer);
    this.mobileImageUpload.init();

    // Listen for image-loaded events from mobile uploader
    this.onPanelEvent(uploadContainer, 'image-loaded', (event: CustomEvent) => {
      const { image, dataUrl } = event.detail;
      this.currentImage = image;
      this.currentImageDataUrl = dataUrl;

      // Persist image to storage if it's small enough
      if (dataUrl && dataUrl.length < MAX_IMAGE_STORAGE_SIZE) {
        StorageService.setItem(STORAGE_KEYS.imageDataUrl, dataUrl);
      } else if (dataUrl) {
        StorageService.removeItem(STORAGE_KEYS.imageDataUrl);
      }

      ToastService.success(LanguageService.t('matcher.imageLoaded'));

      if (this.imageZoom) {
        this.imageZoom.setImage(image);
        // Auto-fit image after loading from mobile upload
        this.imageZoom.autoFit();
      }

      this.showEmptyState(false);

      // Update responsive layout now that image is loaded
      this.updateExtractorLayout();
    });

    contentWrapper.appendChild(contentInner);
    section.appendChild(contentWrapper);

    // Toggle event
    this.on(header, 'click', () => {
      this.mobileImageSourceExpanded = !this.mobileImageSourceExpanded;
      header.setAttribute('aria-expanded', String(this.mobileImageSourceExpanded));
      chevron.style.transform = this.mobileImageSourceExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
      contentWrapper.style.maxHeight = this.mobileImageSourceExpanded ? '800px' : '0';
      contentWrapper.style.opacity = this.mobileImageSourceExpanded ? '1' : '0';
    });

    return section;
  }

  /**
   * Render mobile color selection accordion section
   */
  private renderMobileColorSelectionAccordion(): HTMLElement {
    const section = this.createElement('div', {
      className: 'border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });

    // Accordion header
    const header = this.createElement('button', {
      className: 'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
      attributes: {
        style: 'background: var(--theme-background-secondary); color: var(--theme-text);',
        type: 'button',
        'aria-expanded': String(this.mobileColorSelectionExpanded),
      },
    });

    const titleContainer = this.createElement('span', {
      className: 'flex items-center gap-2 font-medium text-sm',
    });
    const iconSpan = this.createElement('span', {
      className: 'w-4 h-4 flex-shrink-0',
      innerHTML: ICON_PALETTE,
    });
    const titleText = this.createElement('span', {
      textContent: LanguageService.t('matcher.colorSelection'),
    });
    titleContainer.appendChild(iconSpan);
    titleContainer.appendChild(titleText);
    header.appendChild(titleContainer);

    // Chevron
    const chevron = this.createElement('span', {
      className: 'w-5 h-5 transition-transform duration-200',
      innerHTML: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-full h-full">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
      </svg>`,
      attributes: {
        style: this.mobileColorSelectionExpanded
          ? 'transform: rotate(0deg);'
          : 'transform: rotate(-90deg);',
      },
    });
    header.appendChild(chevron);
    section.appendChild(header);

    // Content area
    const contentWrapper = this.createElement('div', {
      className: 'overflow-hidden transition-all duration-200',
      attributes: {
        style: this.mobileColorSelectionExpanded
          ? 'max-height: 500px; opacity: 1;'
          : 'max-height: 0; opacity: 0;',
      },
    });

    const contentInner = this.createElement('div', {
      className: 'px-4 py-3',
      attributes: { style: 'background: var(--theme-card-background);' },
    });

    // Create mobile ColorPickerDisplay instance
    const pickerContainer = this.createElement('div');
    contentInner.appendChild(pickerContainer);

    this.mobileColorPicker = new ColorPickerDisplay(pickerContainer);
    this.mobileColorPicker.init();

    // Listen for color-selected events from mobile picker
    this.onPanelEvent(pickerContainer, 'color-selected', (event: CustomEvent) => {
      const { color } = event.detail;
      this.matchColor(color);
    });

    contentWrapper.appendChild(contentInner);
    section.appendChild(contentWrapper);

    // Toggle event
    this.on(header, 'click', () => {
      this.mobileColorSelectionExpanded = !this.mobileColorSelectionExpanded;
      header.setAttribute('aria-expanded', String(this.mobileColorSelectionExpanded));
      chevron.style.transform = this.mobileColorSelectionExpanded
        ? 'rotate(0deg)'
        : 'rotate(-90deg)';
      contentWrapper.style.maxHeight = this.mobileColorSelectionExpanded ? '500px' : '0';
      contentWrapper.style.opacity = this.mobileColorSelectionExpanded ? '1' : '0';
    });

    return section;
  }

  /**
   * Render mobile market board accordion section
   */
  private renderMobileMarketAccordion(): HTMLElement {
    const section = this.createElement('div', {
      className: 'border-b',
      attributes: { style: 'border-color: var(--theme-border);' },
    });

    // Accordion header
    const header = this.createElement('button', {
      className: 'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
      attributes: {
        style: 'background: var(--theme-background-secondary); color: var(--theme-text);',
        type: 'button',
        'aria-expanded': String(this.mobileMarketExpanded),
      },
    });

    const titleContainer = this.createElement('span', {
      className: 'flex items-center gap-2 font-medium text-sm',
    });
    const iconSpan = this.createElement('span', {
      className: 'w-4 h-4 flex-shrink-0',
      innerHTML: ICON_MARKET,
    });
    const titleText = this.createElement('span', {
      textContent: LanguageService.t('marketBoard.title'),
    });
    titleContainer.appendChild(iconSpan);
    titleContainer.appendChild(titleText);
    header.appendChild(titleContainer);

    // Chevron
    const chevron = this.createElement('span', {
      className: 'w-5 h-5 transition-transform duration-200',
      innerHTML: `<svg viewBox="0 0 20 20" fill="currentColor" class="w-full h-full">
        <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
      </svg>`,
      attributes: {
        style: this.mobileMarketExpanded
          ? 'transform: rotate(0deg);'
          : 'transform: rotate(-90deg);',
      },
    });
    header.appendChild(chevron);
    section.appendChild(header);

    // Content area
    const contentWrapper = this.createElement('div', {
      className: 'overflow-hidden transition-all duration-200',
      attributes: {
        style: this.mobileMarketExpanded
          ? 'max-height: 600px; opacity: 1;'
          : 'max-height: 0; opacity: 0;',
      },
    });

    const contentInner = this.createElement('div', {
      className: 'px-4 py-3',
      attributes: { style: 'background: var(--theme-card-background);' },
    });

    // Create mobile MarketBoard instance
    const marketContainer = this.createElement('div');
    contentInner.appendChild(marketContainer);

    this.mobileMarketBoard = new MarketBoard(marketContainer);
    this.mobileMarketBoard.init();

    // Load server data for the dropdown
    void this.mobileMarketBoard.loadServerData();

    // Set up market board event listeners using shared utility
    // WEB-REF-003 Phase 4: Uses MarketBoardService for state (showPrices/priceData via getters)
    setupMarketBoardListeners(
      marketContainer,
      () => this.showPrices,
      () => this.fetchPricesForMatches(),
      {
        onPricesToggled: () => {
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
      }
    );

    contentWrapper.appendChild(contentInner);
    section.appendChild(contentWrapper);

    // Toggle event
    this.on(header, 'click', () => {
      this.mobileMarketExpanded = !this.mobileMarketExpanded;
      header.setAttribute('aria-expanded', String(this.mobileMarketExpanded));
      chevron.style.transform = this.mobileMarketExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
      contentWrapper.style.maxHeight = this.mobileMarketExpanded ? '600px' : '0';
      contentWrapper.style.opacity = this.mobileMarketExpanded ? '1' : '0';
    });

    return section;
  }

  // ============================================================================
  // Color Matching Logic
  // ============================================================================

  /**
   * Match a color to the closest dyes
   */
  private matchColor(hex: string): void {
    this.selectedColor = hex;
    this.showEmptyState(false);

    // Clear palette results when doing single color match
    this.lastPaletteResults = [];

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

    // Apply filters if available
    if (this.dyeFilters) {
      // Filter closest dye
      if (closestDye && this.dyeFilters.isDyeExcluded(closestDye)) {
        const allDyes = dyeService.getAllDyes();
        const filteredDyes = this.dyeFilters.filterDyes(allDyes);
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
      withinDistance = this.dyeFilters.filterDyes(withinDistance);
    }

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
    this.updateDrawerContent();

    // Fetch prices if enabled
    if (this.showPrices && this.marketBoard) {
      void this.fetchPricesForMatches();
    }

    logger.info('[MatcherTool] Matched color:', hex, 'Found:', this.matchedDyes.length, 'dyes');
  }

  /**
   * Render matched dye results
   */
  private renderMatchedResults(): void {
    if (!this.resultsContainer) return;

    // Clear existing results (keep header)
    const header = this.resultsContainer.querySelector('h3');
    clearContainer(this.resultsContainer);
    if (header) {
      this.resultsContainer.appendChild(header);
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

    const grid = this.createElement('div', { className: 'grid gap-3 sm:grid-cols-2' });

    this.matchedDyes.forEach((dye, index) => {
      const card = this.createDyeCard(dye, index);
      grid.appendChild(card);
    });

    this.resultsContainer.appendChild(grid);
  }

  /**
   * Create a dye result card
   */
  private createDyeCard(dye: DyeWithDistance, index: number): HTMLElement {
    const card = this.createElement('div', {
      className: 'group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
      attributes: {
        style: 'background: var(--theme-card-background); border: 1px solid var(--theme-border);',
      },
    });

    // Rank badge
    const rank = this.createElement('span', {
      className:
        'w-6 h-6 flex items-center justify-center text-xs font-bold rounded-full flex-shrink-0',
      textContent: String(index + 1),
      attributes: {
        style:
          index === 0
            ? 'background: var(--theme-primary); color: var(--theme-text-header);'
            : 'background: var(--theme-background-secondary); color: var(--theme-text-muted);',
      },
    });

    // Color swatches (sampled + dye)
    const swatches = this.createElement('div', { className: 'flex gap-1' });
    if (this.selectedColor) {
      const sampledSwatch = this.createElement('div', {
        className: 'w-5 h-10 rounded-l',
        attributes: { style: `background: ${this.selectedColor};`, title: 'Sampled color' },
      });
      swatches.appendChild(sampledSwatch);
    }
    const dyeSwatch = this.createElement('div', {
      className: 'w-5 h-10 rounded-r',
      attributes: { style: `background: ${dye.hex};`, title: dye.hex },
    });
    swatches.appendChild(dyeSwatch);

    // Dye info
    const info = this.createElement('div', { className: 'flex-1 min-w-0' });
    const dyeName = LanguageService.getDyeName(dye.itemID) ?? dye.name;
    info.innerHTML = `
      <p class="text-sm font-medium truncate" style="color: var(--theme-text);">${dyeName}</p>
      <p class="text-xs number" style="color: var(--theme-text-muted);">
        Δ ${dye.distance.toFixed(1)}
        ${this.showPrices && this.priceData.has(dye.itemID) ? ` · ${this.priceData.get(dye.itemID)!.currentMinPrice.toLocaleString()} gil` : ''}
      </p>
    `;

    card.appendChild(rank);
    card.appendChild(swatches);
    card.appendChild(info);

    // Action dropdown (visible on hover)
    const dropdownContainer = this.createElement('div', {
      className: 'opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0',
    });
    const actionDropdown = createDyeActionDropdown(dye);
    dropdownContainer.appendChild(actionDropdown);
    card.appendChild(dropdownContainer);

    // Hover effect
    this.on(card, 'mouseenter', () => {
      card.style.background = 'var(--theme-card-hover)';
    });
    this.on(card, 'mouseleave', () => {
      card.style.background = 'var(--theme-card-background)';
    });

    return card;
  }

  /**
   * Fetch prices for matched dyes
   * WEB-REF-003 Phase 4: Delegates to MarketBoardService with race condition protection
   */
  private async fetchPricesForMatches(): Promise<void> {
    console.info('💰 [ExtractorTool] fetchPricesForMatches called, showPrices=', this.showPrices);
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
    console.info(
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

      console.info(
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
   * Extract palette from a specific region of the loaded image
   */
  private async extractPaletteFromRegion(
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<void> {
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

    // Ensure region is within canvas bounds
    const regionX = Math.max(0, Math.floor(x));
    const regionY = Math.max(0, Math.floor(y));
    const regionWidth = Math.min(Math.floor(width), canvas.width - regionX);
    const regionHeight = Math.min(Math.floor(height), canvas.height - regionY);

    if (regionWidth <= 0 || regionHeight <= 0) {
      ToastService.error(LanguageService.t('errors.regionTooSmall'));
      return;
    }

    try {
      // Get pixel data from the selected region
      const imageData = ctx.getImageData(regionX, regionY, regionWidth, regionHeight);
      const pixels = PaletteService.pixelDataToRGBFiltered(imageData.data);

      if (pixels.length === 0) {
        ToastService.error(LanguageService.t('errors.noPixelsInRegion'));
        return;
      }

      // Extract palette and match to dyes
      const matches = this.paletteService.extractAndMatchPalette(pixels, dyeService, {
        colorCount: this.paletteColorCount,
      });

      this.lastPaletteResults = matches;

      // Draw indicators on the original canvas to show the selected region
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.strokeRect(regionX, regionY, regionWidth, regionHeight);

      // Render results
      this.renderPaletteResults(matches);

      // Hide empty state
      this.showEmptyState(false);

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

      logger.info('[ExtractorTool] Palette extracted from region:', matches.length, 'colors');
    } catch (error) {
      logger.error('[ExtractorTool] Palette extraction from region failed:', error);
      ToastService.error(LanguageService.t('errors.paletteExtractionFailed'));
    }
  }

  /**
   * Extract palette from loaded image using K-Means clustering
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

    // Update button to show loading state
    if (this.extractPaletteBtn) {
      this.extractPaletteBtn.textContent = LanguageService.t('matcher.extractingPalette');
      this.extractPaletteBtn.disabled = true;
      this.extractPaletteBtn.style.opacity = '0.7';
    }

    try {
      // Get pixel data from canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = PaletteService.pixelDataToRGBFiltered(imageData.data);

      if (pixels.length === 0) {
        ToastService.error(LanguageService.t('errors.noPixelsToAnalyze'));
        return;
      }

      // Extract palette and match to dyes
      const matches = this.paletteService.extractAndMatchPalette(pixels, dyeService, {
        colorCount: this.paletteColorCount,
      });

      this.lastPaletteResults = matches;

      // Find representative positions for each extracted color and draw indicators
      const positions = this.findColorPositions(imageData, matches);
      this.drawSampleIndicators(canvas, ctx, matches, positions);

      // Render results
      this.renderPaletteResults(matches);

      // Hide empty state
      this.showEmptyState(false);

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
      if (this.extractPaletteBtn) {
        this.extractPaletteBtn.textContent = LanguageService.t('matcher.extractPaletteBtn');
        this.extractPaletteBtn.disabled = false;
        this.extractPaletteBtn.style.opacity = '1';
      }
    }
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

    // Hide empty state
    this.showEmptyState(false);

    // Update section title with color count
    if (this.resultsTitleElement) {
      this.resultsTitleElement.textContent = `${LanguageService.t('matcher.extractedPalette')} (${matches.length} ${matches.length === 1 ? 'color' : 'colors'})`;
    }

    // Enable/disable export button based on results
    if (this.exportCssBtn) {
      const hasResults = matches.length > 0;
      this.exportCssBtn.disabled = !hasResults;
      this.exportCssBtn.style.opacity = hasResults ? '1' : '0.5';
      this.exportCssBtn.style.cursor = hasResults ? 'pointer' : 'not-allowed';
    }

    if (matches.length === 0) {
      return;
    }

    // Create grid container for cards with 280px card width
    const cardsGrid = this.createElement('div', {
      className: 'extractor-results-grid',
      attributes: {
        style: `
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          justify-content: center;
          --v4-result-card-width: 280px;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
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
      card.data = cardData;
      // Make primary button open context menu (same as Swatch tool)
      card.setAttribute('primary-opens-menu', 'true');

      // Apply display options from config
      card.showHex = this.displayOptions.showHex;
      card.showRgb = this.displayOptions.showRgb;
      card.showHsv = this.displayOptions.showHsv;
      card.showLab = this.displayOptions.showLab;
      card.showDeltaE = this.displayOptions.showDeltaE;
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
   * Export the extracted palette as a CSS file with custom properties
   */
  private exportPaletteAsCss(): void {
    if (this.lastPaletteResults.length === 0) {
      ToastService.error(LanguageService.t('matcher.noPaletteToExport'));
      return;
    }

    // Generate CSS content
    const timestamp = new Date().toISOString().split('T')[0];
    let cssContent = `/**
 * XIV Dye Tools - Extracted Palette
 * Generated: ${timestamp}
 * Colors: ${this.lastPaletteResults.length}
 */

:root {
  /* Extracted Colors (Original from image) */
`;

    // Add extracted colors
    this.lastPaletteResults.forEach((match, index) => {
      const { r, g, b } = match.extracted;
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      cssContent += `  --extracted-color-${index + 1}: ${hex.toUpperCase()};\n`;
    });

    cssContent += `\n  /* Matched FFXIV Dyes */\n`;

    // Add matched dye colors
    this.lastPaletteResults.forEach((match, index) => {
      const dyeName = match.matchedDye.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      cssContent += `  --dye-${index + 1}-${dyeName}: ${match.matchedDye.hex.toUpperCase()};\n`;
    });

    cssContent += `}\n\n/* Utility Classes */\n`;

    // Add utility classes for each color
    this.lastPaletteResults.forEach((match, index) => {
      const dyeName = match.matchedDye.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');
      cssContent += `
.bg-extracted-${index + 1} { background-color: var(--extracted-color-${index + 1}); }
.text-extracted-${index + 1} { color: var(--extracted-color-${index + 1}); }
.bg-dye-${index + 1} { background-color: var(--dye-${index + 1}-${dyeName}); }
.text-dye-${index + 1} { color: var(--dye-${index + 1}-${dyeName}); }
`;
    });

    // Create and trigger download
    const blob = new Blob([cssContent], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `xiv-palette-${timestamp}.css`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    ToastService.success(LanguageService.t('matcher.paletteExported'));
    logger.info('[ExtractorTool] Palette exported as CSS');
  }
}
