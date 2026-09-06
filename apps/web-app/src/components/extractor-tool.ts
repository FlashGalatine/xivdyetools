/**
 * XIV Dye Tools - Extractor Tool Component (Palette Extractor)
 *
 * 4A "Loupe over a weighted bar over the card sheet" — confirmed 2026-09-05
 * (`Extractor Tool Directions.dc.html`, superseding the 3C loupe + roll). One
 * column, three stages, each owning a different job:
 *
 *   1. INPUT  — the image with a persistent, draggable loupe that reads the
 *               real pixels under the pointer and names the nearest dye as it
 *               moves. Nothing commits until the `+` tile is tapped.
 *   2. INDEX  — the dominance bar butted under the image. Extracted colours
 *               are proportional segments sized by their share of the canvas;
 *               after a 3px break, each committed pick is a fixed-width
 *               segment labelled with its slot number — a hand-sampled colour
 *               has no dominance share and is never drawn as one. The `+` tile
 *               at the right end holds whatever the loupe is reading.
 *   3. OUTPUT — the card sheet, one result card per bar segment.
 *
 * Bulk extraction is no longer a mode: it runs on image load and again on
 * every config change (colour count, vibrancy, method, filters), and the
 * committed picks survive those re-runs. Advanced lives only behind the
 * app-bar gear (the config sidebar), so this tool renders one main flow and
 * owns no option panel — `ConfigController` is its single source of settings.
 *
 * @module components/tools/extractor-tool
 */

import { BaseComponent } from '@components/base-component';
import { ImageZoomController } from '@components/image-zoom-controller';
import { openExportSheet } from '@components/export-sheet';
import {
  ColorService,
  ConfigController,
  dyeService,
  getContrastColor,
  LanguageService,
  MarketBoardService,
  StorageService,
  ToastService,
} from '@services/index';
import { WorldService } from '@services/world-service';
import {
  ICON_IMAGE,
  ICON_CLIPBOARD,
  ICON_CAMERA,
  ICON_LOCK,
  ICON_REFRESH,
  ICON_CLOSE,
} from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import { MAX_USER_FILE_BYTES } from '@shared/constants';
import type { Dye, PriceData, RGB } from '@xivdyetools/types';
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
  /** Unused since the v4 shell passes one panel twice — kept so every tool mounts alike. */
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * One segment of the bar and one card of the sheet. `share` is the extracted
 * colour's dominance in percent; a committed pick carries `null` — it has no
 * share and must never be drawn as a proportion.
 */
interface RollEntry {
  hex: string;
  share: number | null;
  dye: Dye;
  distance: number;
}

/**
 * Storage keys the v3/3C builds wrote. None is read any more — the tool's
 * settings live in `ConfigController` (the sidebar's store), the image is
 * session-only (FINDING-009) and picks belong to the image they were read
 * from — so mount() deletes whatever an earlier build left behind.
 */
const LEGACY_STORAGE_KEYS = [
  'v3_matcher_sample_size',
  'v3_matcher_palette_mode',
  'v3_matcher_palette_count',
  'v3_matcher_vibrancy_boost',
  'v3_matcher_image',
  'v3_matcher_color',
  'v3_matcher_extracted_colors',
] as const;

/**
 * The bar is the capacity limit: six extracted plus two picks is comfortable
 * at 412px and past four picks the proportional segments stop reading, which
 * is the same ceiling `.chara`'s Make-a-palette accepted (Decisions, 4A).
 */
const MAX_PICKS = 6;

/** Default colour count when the config carries none (mirrors DEFAULT_CONFIGS). */
const DEFAULT_MAX_COLORS = 4;

/**
 * The only sanctioned hardcoded grounds are the drawn on-image overlays —
 * chips sitting on arbitrary image pixels use the prototype's dark glass in
 * both themes (rgba(10,10,12,…) per the confirmed frames), and the `+` tile
 * sits on the image's #000 frame.
 */
const OVERLAY_BG = 'rgba(10, 10, 12, 0.66)';
const OVERLAY_CHIP_BG = 'rgba(10, 10, 12, 0.72)';
const ADD_TILE_BG = 'rgba(10, 10, 12, 0.92)';

/** Accent tint derived from the theme accent (the drawn accent-border). */
const ACCENT_BORDER = 'color-mix(in srgb, var(--theme-primary) 45%, transparent)';

/** Neutral placeholder for the loupe-colour chips before the first read. */
const LOUPE_PLACEHOLDER = 'color-mix(in srgb, var(--theme-text-muted) 35%, transparent)';

/**
 * Responsive rules for the 4A workspace. Media queries cannot live in inline
 * styles; the tool renders inside the shell's shadow DOM, which allows a
 * scoped <style> element (same pattern as the shell's v5-results-grid rule).
 *
 * Desktop scrolls the whole column (the hero spends ~320px before the first
 * card, so roughly one card row shows at a time — the accepted cost). Mobile
 * (≤768px) pins the hero and scrolls the sheet under it: 226px image, 44px
 * bar, 40px pick segments, 44px `+` tile, 74px loupe.
 */
const X4A_RESPONSIVE_CSS = `
  .x4a-workspace {
    display: flex; flex-direction: column; gap: 10px;
    min-height: 100%; width: 100%; max-width: 1400px; margin: 0 auto;
    padding: 18px 20px 28px; box-sizing: border-box;
  }
  .x4a-hero { flex-shrink: 0; display: flex; flex-direction: column; }
  .x4a-image-card { height: 276px; }
  .x4a-bar { height: 48px; }
  .x4a-seg { min-width: 0; }
  .x4a-seg-pick { flex: 0 0 52px; }
  .x4a-add-tile { flex: 0 0 52px; }
  .x4a-loupe { width: 104px; height: 104px; padding-bottom: 10px; }
  .x4a-loupe-ring { width: 16px; height: 16px; margin: -8px 0 0 -8px; }
  .x4a-sheet { flex: 1; min-height: 0; }
  .x4a-drop-title { font-size: 19px; }
  .x4a-dt-actions { display: flex; gap: 9px; }
  .x4a-mb-actions { display: none; }
  .x4a-dt-text { display: block; }
  .x4a-mb-text { display: none; }
  @media (max-width: 768px) {
    .x4a-workspace { padding: 12px 14px 24px; gap: 8px; height: 100%; min-height: 0; }
    .x4a-image-card { height: 226px; }
    .x4a-bar { height: 44px; }
    .x4a-seg { min-width: 26px; }
    .x4a-seg-pick { flex-basis: 40px; }
    .x4a-add-tile { flex-basis: 44px; }
    .x4a-loupe { width: 74px; height: 74px; padding-bottom: 7px; }
    .x4a-loupe-ring { width: 13px; height: 13px; margin: -6.5px 0 0 -6.5px; }
    .x4a-sheet { overflow-y: auto; }
    /* The zoom controller's toolbar sits bottom-right; on a 226px card it
       lands on the hint chip, and the frames carry no zoom chrome. The
       controller sets its display inline, hence the !important. */
    .x4a-image-card .zoom-controls { display: none !important; }
    .x4a-drop-title { font-size: 17px; }
    .x4a-dt-actions { display: none; }
    .x4a-mb-actions { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 236px; }
    .x4a-dt-text { display: none; }
    .x4a-mb-text { display: block; }
  }
`;

// ============================================================================
// ExtractorTool Component
// ============================================================================

export class ExtractorTool extends BaseComponent {
  private options: ExtractorToolOptions;

  // ---- Settings (seeded from and pushed by ConfigController) ----
  private paletteColorCount: number = DEFAULT_MAX_COLORS;
  private vibrancyBoost: boolean = true;
  private displayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };
  private matchingMethod: MatchingMethod = DEFAULT_MATCHING_METHOD;
  private preventDuplicates: boolean = true;
  private dyeFiltersConfig: DyeFiltersConfig = { ...DEFAULT_DYE_FILTERS };
  private dragThreshold: number | undefined = undefined;
  private sampleAreaSize: number | undefined = undefined;

  // ---- Services ----
  private marketBoardService: MarketBoardService;
  private paletteService: PaletteService;

  private get showPrices(): boolean {
    return this.marketBoardService.getShowPrices();
  }
  // Read-only view, no per-access map clone — hit inside per-card render loops
  private get priceData(): ReadonlyMap<number, PriceData> {
    return this.marketBoardService.getPricesView();
  }

  // ---- Workspace state ----
  private currentImage: HTMLImageElement | null = null;
  /** Raw K-means output for the current image (pre-dedupe, pre-filter). */
  private extractedMatches: PaletteMatch[] = [];
  /** Committed loupe picks, in commit order. Session-only, cleared with the image. */
  private picks: string[] = [];
  /** The resolved bar/sheet: extracted entries first, then picks. */
  private roll: RollEntry[] = [];
  /** Index into `roll` of the focused segment/card, or null. */
  private focusIndex: number | null = null;
  /** The colour the loupe last read — feeds the hint chip and the `+` tile. */
  private currentLoupeHex: string | null = null;
  private isExtracting: boolean = false;

  // ---- Child components ----
  private imageZoom: ImageZoomController | null = null;

  // ---- DOM references ----
  private workspaceElement: HTMLElement | null = null;
  private emptyFlowElement: HTMLElement | null = null;
  private loadedFlowElement: HTMLElement | null = null;
  private imageCardElement: HTMLElement | null = null;
  private canvasContainer: HTMLElement | null = null;
  private dropZone: HTMLElement | null = null;
  private dropZoneFileInput: HTMLInputElement | null = null;
  private cameraFileInput: HTMLInputElement | null = null;

  private loupeElement: HTMLElement | null = null;
  private loupeHexChip: HTMLElement | null = null;
  private hintSwatchElement: HTMLElement | null = null;
  private hintRestElements: HTMLElement[] = [];
  private hintReadElement: HTMLElement | null = null;

  private barElement: HTMLElement | null = null;
  private addPickChipElement: HTMLElement | null = null;
  private legendElement: HTMLElement | null = null;
  private clearPicksBtn: HTMLButtonElement | null = null;
  private resultsCountElement: HTMLElement | null = null;
  private exportBtn: HTMLButtonElement | null = null;
  private resultsContainer: HTMLElement | null = null;

  /** V4 result card elements for updating prices after fetch */
  private v4ResultCards: ResultCard[] = [];
  /** Last market fetch error code for display on cards (e.g., "H429", "NOFF") */
  private lastMarketError: string | undefined = undefined;

  constructor(container: HTMLElement, options: ExtractorToolOptions) {
    super(container);
    this.options = options;

    // Seed from the persisted extractor config so a stored choice survives
    // reload and the tool agrees with what the sidebar shows. The method is
    // normalized so persisted 4.x values (hyab, oklch-weighted) migrate
    // instead of reaching the matcher.
    const config = ConfigController.getInstance().getConfig('extractor');
    this.matchingMethod = normalizeMatchingMethod(config.matchingMethod ?? DEFAULT_MATCHING_METHOD);
    if (typeof config.maxColors === 'number') {
      this.paletteColorCount = config.maxColors;
    }
    if (typeof config.vibrancyBoost === 'boolean') {
      this.vibrancyBoost = config.vibrancyBoost;
    }
    if (config.preventDuplicates !== undefined) {
      this.preventDuplicates = config.preventDuplicates;
    }
    if (config.dyeFilters) {
      this.dyeFiltersConfig = { ...config.dyeFilters };
    }
    if (config.displayOptions) {
      this.displayOptions = { ...this.displayOptions, ...config.displayOptions };
    }
    if (typeof config.dragThreshold === 'number') {
      this.dragThreshold = config.dragThreshold;
    }
    if (typeof config.sampleAreaSize === 'number') {
      this.sampleAreaSize = config.sampleAreaSize;
    }

    this.marketBoardService = MarketBoardService.getInstance();
    this.paletteService = new PaletteService();
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  renderContent(): void {
    this.renderWorkspace();
    this.element = this.container;
  }

  bindEvents(): void {
    // Paste from clipboard (document-level listener) — Ctrl+V / Cmd+V with
    // image data lands here; the explicit button uses the Clipboard API.
    this.on(document, 'paste', (e: Event) => {
      const pasteEvent = e as ClipboardEvent;
      const items = pasteEvent.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          pasteEvent.preventDefault();
          const blob = items[i].getAsFile();
          if (blob) {
            this.handleDroppedFile(blob);
          }
        }
      }
    });
  }

  /**
   * Listen for custom events on a specific element. Child components emit on
   * their own containers (bubbling), not on this.container.
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
    const listenerKey = `panel_${eventName}_${Date.now()}_${this.listeners.size}`;
    this.listeners.set(listenerKey, { target: panel, event: eventName, handler: boundHandler });
  }

  onMount(): void {
    // Language changes rebuild the workspace (only in onMount, NOT bindEvents)
    this.subs.add(
      LanguageService.subscribe(() => {
        this.update();
      })
    );

    // The sidebar is the only settings surface
    this.subs.add(
      ConfigController.getInstance().subscribe('extractor', (config) => {
        this.setConfig(config);
      })
    );

    // Market config (prices on/off, server) from the sidebar: re-render the
    // sheet and fetch for the new server
    this.subs.add(
      ConfigController.getInstance().subscribe('market', (config) => {
        if (this.roll.length === 0) return;
        this.renderCards();
        if (config.showPrices) {
          void this.fetchPricesForRoll();
        }
      })
    );

    // Nothing the earlier builds persisted is read back (idempotent cleanup)
    for (const key of LEGACY_STORAGE_KEYS) {
      StorageService.removeItem(key);
    }

    logger.info('[ExtractorTool] Mounted');
  }

  destroy(): void {
    this.imageZoom?.destroy();
    this.imageZoom = null;
    super.destroy();
    logger.info('[ExtractorTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration — the sidebar surface
  // ============================================================================

  /**
   * Update tool configuration from the config sidebar. Anything that changes
   * which colours come out of the image or which dye each resolves to
   * re-extracts (the picks survive); anything presentational re-renders.
   */
  public setConfig(config: Partial<ExtractorConfig>): void {
    let needsReextract = false;
    let needsReresolve = false;
    let needsRerender = false;

    if (config.vibrancyBoost !== undefined && config.vibrancyBoost !== this.vibrancyBoost) {
      this.vibrancyBoost = config.vibrancyBoost;
      // Vibrancy is an ordering of the extracted colours, not a different
      // extraction — re-resolving is enough
      needsReresolve = true;
      logger.info(`[ExtractorTool] setConfig: vibrancyBoost -> ${config.vibrancyBoost}`);
    }

    if (config.maxColors !== undefined && config.maxColors !== this.paletteColorCount) {
      this.paletteColorCount = config.maxColors;
      needsReextract = true;
      logger.info(`[ExtractorTool] setConfig: maxColors -> ${config.maxColors}`);
    }

    if (config.displayOptions) {
      this.displayOptions = { ...this.displayOptions, ...config.displayOptions };
      needsRerender = true;
      logger.info(`[ExtractorTool] setConfig: displayOptions updated`, config.displayOptions);
    }

    if (config.dragThreshold !== undefined) {
      this.dragThreshold = config.dragThreshold;
      this.imageZoom?.setDragThreshold(config.dragThreshold);
      logger.info(`[ExtractorTool] setConfig: dragThreshold -> ${config.dragThreshold}`);
    }

    if (config.sampleAreaSize !== undefined) {
      this.sampleAreaSize = config.sampleAreaSize;
      this.imageZoom?.setSampleAreaSize(config.sampleAreaSize);
      logger.info(`[ExtractorTool] setConfig: sampleAreaSize -> ${config.sampleAreaSize}`);
    }

    if (config.matchingMethod !== undefined && config.matchingMethod !== this.matchingMethod) {
      this.matchingMethod = config.matchingMethod;
      needsReextract = true;
      logger.info(`[ExtractorTool] setConfig: matchingMethod -> ${config.matchingMethod}`);
    }

    if (
      config.preventDuplicates !== undefined &&
      config.preventDuplicates !== this.preventDuplicates
    ) {
      this.preventDuplicates = config.preventDuplicates;
      needsReresolve = true;
      logger.info(`[ExtractorTool] setConfig: preventDuplicates -> ${config.preventDuplicates}`);
    }

    if (config.dyeFilters) {
      const newFilters = config.dyeFilters;
      if (JSON.stringify(this.dyeFiltersConfig) !== JSON.stringify(newFilters)) {
        this.dyeFiltersConfig = { ...newFilters };
        needsReresolve = true;
        logger.info(`[ExtractorTool] setConfig: dyeFilters updated`);
      }
    }

    if (needsReextract && this.currentImage) {
      void this.extractPalette(false);
    } else if (needsReresolve && this.currentImage) {
      this.renderRoll();
    } else if (needsRerender && this.roll.length > 0) {
      this.renderCards();
    }
  }

  // ============================================================================
  // Workspace — the one-column 4A flow
  // ============================================================================

  /**
   * EMPTY  → drawn drop zone + permanent privacy chip row
   * LOADED → hero (image card with the loupe, the bar butted under it, the
   *          legend row, the section header) → card sheet
   */
  private renderWorkspace(): void {
    const panel = this.options.rightPanel;
    clearContainer(panel);

    const styleEl = this.createElement('style');
    styleEl.textContent = X4A_RESPONSIVE_CSS;

    this.workspaceElement = this.createElement('div', {
      className: 'extractor-layout x4a-workspace',
    });
    this.workspaceElement.appendChild(styleEl);
    if (this.isExtracting) {
      this.workspaceElement.dataset.busy = 'true';
    }

    // Hidden file inputs shared by both states (Choose image / Replace / camera)
    this.dropZoneFileInput = this.createElement('input', {
      attributes: { type: 'file', accept: 'image/*', style: 'display: none;' },
    }) as HTMLInputElement;
    this.on(this.dropZoneFileInput, 'change', () => {
      const file = this.dropZoneFileInput?.files?.[0];
      if (file && file.type.startsWith('image/')) {
        this.handleDroppedFile(file);
      }
      if (this.dropZoneFileInput) {
        this.dropZoneFileInput.value = '';
      }
    });
    this.workspaceElement.appendChild(this.dropZoneFileInput);

    // Mobile camera capture — the capture attribute on a file input, exactly
    // what the shipped mobile Take-a-photo path uses
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
    this.workspaceElement.appendChild(this.cameraFileInput);

    this.workspaceElement.appendChild(this.buildEmptyFlow());
    this.workspaceElement.appendChild(this.buildLoadedFlow());

    panel.appendChild(this.workspaceElement);

    this.setupDropZoneInteractions();

    // Rebuild presentation from existing state (language switch / re-render)
    if (this.currentImage) {
      this.renderRoll();
      if (this.currentLoupeHex) {
        this.setLoupeHex(this.currentLoupeHex);
      }
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
        className: 'x4a-drop-title',
        textContent: LanguageService.t('matcher.dropTitle'),
        attributes: { style: 'font-weight: 600; color: var(--theme-text);' },
      })
    );

    // Body copy: the desktop line names Ctrl+V, the mobile line names the camera
    this.dropZone.appendChild(
      this.createElement('span', {
        className: 'x4a-dt-text',
        textContent: LanguageService.t('matcher.dropBody'),
        attributes: {
          style:
            'font-size: 13px; line-height: 1.5; color: var(--theme-text-muted); max-width: 340px;',
        },
      })
    );
    this.dropZone.appendChild(
      this.createElement('span', {
        className: 'x4a-mb-text',
        textContent: LanguageService.t('matcher.dropBodyMobile'),
        attributes: {
          style:
            'font-size: 13px; line-height: 1.5; color: var(--theme-text-muted); max-width: 250px;',
        },
      })
    );

    // Desktop actions: Choose image (accent lead) + Paste from clipboard
    const dtActions = this.createElement('div', { className: 'x4a-dt-actions' });
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
    const mbActions = this.createElement('div', { className: 'x4a-mb-actions' });
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
   * LOADED state — the hero (image + bar + legend + header) pinned on mobile,
   * then the card sheet.
   */
  private buildLoadedFlow(): HTMLElement {
    this.loadedFlowElement = this.createElement('div', {
      attributes: {
        style: 'flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px;',
      },
    });

    const hero = this.createElement('div', { className: 'x4a-hero' });

    // The frame: #000 ground, 14px radius, image card over the bar
    const frame = this.createElement('div', {
      attributes: {
        style: 'flex-shrink: 0; border-radius: 14px; overflow: hidden; background: #000;',
      },
    });
    frame.appendChild(this.buildImageCard());
    frame.appendChild(this.buildBar());
    hero.appendChild(frame);

    hero.appendChild(this.buildLegendRow());
    hero.appendChild(this.buildSectionHeader());
    this.loadedFlowElement.appendChild(hero);

    this.loadedFlowElement.appendChild(this.buildSheet());

    return this.loadedFlowElement;
  }

  /**
   * The image card: the canvas (zoom controller) underneath, the persistent
   * loupe overlay, 44px replace/clear top-right and the loupe-colour hint chip
   * bottom-left. rgba(10,10,12,…) overlay grounds are the drawn on-image
   * chips — the sanctioned hardcoded colours.
   */
  private buildImageCard(): HTMLElement {
    this.imageCardElement = this.createElement('div', {
      className: 'x4a-image-card',
      attributes: {
        style: 'position: relative; overflow: hidden; touch-action: none;',
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

    // The loupe: a circle that stays where it last read, 3px white border +
    // dark outline shadow, fill = the colour it holds, centre ring, bottom hex
    // chip. Scales up 16% while dragging; hidden (scale 0) until the first read.
    this.loupeElement = this.createElement('div', {
      className: 'x4a-loupe',
      attributes: {
        id: 'extractor-loupe',
        style: [
          'position: absolute; top: 0; left: 0; border-radius: 50%;',
          'transform: translate(-50%, -50%) scale(0);',
          'border: 3px solid #fff;',
          'box-shadow: 0 0 0 1.5px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.5);',
          'background: transparent; pointer-events: none;',
          'display: flex; align-items: flex-end; justify-content: center;',
          'transition: transform 120ms ease; z-index: 120; box-sizing: border-box;',
        ].join(' '),
        'aria-hidden': 'true',
      },
    });
    this.loupeElement.appendChild(
      this.createElement('span', {
        className: 'x4a-loupe-ring',
        attributes: {
          style: [
            'position: absolute; top: 50%; left: 50%; border-radius: 50%;',
            'border: 1.5px solid rgba(255, 255, 255, 0.9);',
            'box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4); box-sizing: border-box;',
          ].join(' '),
        },
      })
    );
    this.loupeHexChip = this.createElement('span', {
      className: 'number',
      attributes: {
        style: [
          'font-family: var(--font-mono); font-size: 10px;',
          'padding: 3px 8px; border-radius: 6px;',
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

    // Bottom-left hint chip: swatch of the loupe colour + mono text. At rest
    // it carries the instruction; once the loupe has read a colour it names
    // the hex and the nearest dye.
    const hintChip = this.createElement('div', {
      attributes: {
        style: [
          'position: absolute; left: 10px; bottom: 10px;',
          'display: flex; align-items: center; gap: 8px; max-width: calc(100% - 20px);',
          `padding: 7px 11px; border-radius: 10px; background: ${OVERLAY_BG}; z-index: 110;`,
        ].join(' '),
      },
    });
    this.hintSwatchElement = this.createElement('span', {
      attributes: {
        style: `width: 15px; height: 15px; border-radius: 4px; flex-shrink: 0; background: ${LOUPE_PLACEHOLDER};`,
        'aria-hidden': 'true',
      },
    });
    hintChip.appendChild(this.hintSwatchElement);
    const hintTextStyle =
      'font-family: var(--font-mono); font-size: 10.5px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';
    const restDesktop = this.createElement('span', {
      className: 'x4a-dt-text',
      textContent: LanguageService.t('matcher.clickToSample'),
      attributes: { style: hintTextStyle },
    });
    const restMobile = this.createElement('span', {
      className: 'x4a-mb-text',
      textContent: LanguageService.t('matcher.tapToSample'),
      attributes: { style: hintTextStyle },
    });
    this.hintRestElements = [restDesktop, restMobile];
    this.hintReadElement = this.createElement('span', {
      className: 'x4a-hint-read',
      attributes: { style: `${hintTextStyle} display: none;` },
    });
    hintChip.appendChild(restDesktop);
    hintChip.appendChild(restMobile);
    hintChip.appendChild(this.hintReadElement);
    this.imageCardElement.appendChild(hintChip);

    return this.imageCardElement;
  }

  /**
   * The bar butted under the image. Segments are rendered by renderBar();
   * this is the strip itself.
   */
  private buildBar(): HTMLElement {
    this.barElement = this.createElement('div', {
      className: 'x4a-bar',
      attributes: {
        id: 'extractor-bar',
        role: 'group',
        'aria-label': LanguageService.t('matcher.imageShare'),
        style: 'display: flex; align-items: stretch;',
      },
    });
    return this.barElement;
  }

  /**
   * Legend row under the bar: `IMAGE SHARE · n picks` and, once there is a
   * pick to clear, the outlined Clear-picks button.
   */
  private buildLegendRow(): HTMLElement {
    const row = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 32px; margin-top: 8px;',
      },
    });
    this.legendElement = this.createElement('span', {
      className: 'number',
      attributes: {
        id: 'extractor-legend',
        style: [
          'font-family: var(--font-mono); font-size: 10.5px; letter-spacing: 0.04em;',
          'color: var(--theme-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;',
        ].join(' '),
      },
    });
    row.appendChild(this.legendElement);

    this.clearPicksBtn = this.createElement('button', {
      textContent: LanguageService.t('matcher.clearPicks'),
      attributes: {
        type: 'button',
        id: 'extractor-clear-picks',
        style: [
          'flex-shrink: 0; min-height: 30px; padding: 0 10px; border-radius: 8px;',
          'background: transparent; border: 1px solid var(--theme-border);',
          'color: var(--theme-text-muted); font-family: inherit; font-size: 11.5px; cursor: pointer; white-space: nowrap;',
          'display: none;',
        ].join(' '),
      },
    }) as HTMLButtonElement;
    this.on(this.clearPicksBtn, 'click', () => {
      this.clearPicks();
    });
    row.appendChild(this.clearPicksBtn);

    return row;
  }

  /**
   * Section header: uppercase EXTRACTED PALETTE, the Fragment Mono count
   * (`6 + 2` with picks, `6 of 6` without) and the Export action.
   */
  private buildSectionHeader(): HTMLElement {
    const header = this.createElement('div', {
      attributes: {
        style: [
          'display: flex; align-items: center; justify-content: space-between; gap: 10px;',
          'margin-top: 4px; padding-bottom: 9px; border-bottom: 1px solid var(--theme-border);',
        ].join(' '),
      },
    });
    header.appendChild(
      this.createElement('span', {
        className: 'extractor-section-title',
        textContent: LanguageService.t('matcher.extractedPalette'),
        attributes: {
          style:
            'font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--theme-text-muted);',
        },
      })
    );

    const actions = this.createElement('div', {
      attributes: { style: 'display: flex; align-items: center; gap: 12px;' },
    });
    this.resultsCountElement = this.createElement('span', {
      className: 'number',
      attributes: {
        id: 'extractor-count',
        style: 'font-family: var(--font-mono); font-size: 11px; color: var(--theme-text-muted);',
      },
    });
    actions.appendChild(this.resultsCountElement);

    this.exportBtn = this.createElement('button', {
      className: 'action-btn-text',
      textContent: LanguageService.t('common.export'),
      attributes: {
        type: 'button',
        disabled: 'true',
        style: [
          'background: none; border: none; color: var(--theme-primary);',
          'font-size: 12px; font-weight: 600; cursor: not-allowed; opacity: 0.5;',
          'text-transform: uppercase; letter-spacing: 0.5px;',
        ].join(' '),
      },
    }) as HTMLButtonElement;
    this.on(this.exportBtn, 'click', () => {
      this.openPaletteExport();
    });
    actions.appendChild(this.exportBtn);
    header.appendChild(actions);

    return header;
  }

  /** The card sheet host — the v5-results-grid is created per render inside. */
  private buildSheet(): HTMLElement {
    this.resultsContainer = this.createElement('div', {
      className: 'extractor-results-scroll x4a-sheet',
      attributes: { style: 'padding-bottom: 16px;' },
    });
    return this.resultsContainer;
  }

  /**
   * Drop-zone click and workspace-wide drag/drop
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

  // ============================================================================
  // Image arrival and departure
  // ============================================================================

  /**
   * Shared image-arrival path (drop, file dialog, camera, paste): hand to the
   * zoom controller, flip to the loaded flow and extract. A new image starts
   * a new roll — picks belong to the pixels they were read from.
   * FINDING-009: the image is held in memory only.
   */
  private onImageLoaded(image: HTMLImageElement): void {
    this.currentImage = image;
    this.picks = [];
    this.focusIndex = null;
    this.currentLoupeHex = null;
    this.resetLoupe();

    if (this.imageZoom) {
      this.imageZoom.setImage(image);
      this.imageZoom.autoFit();
    }

    this.updateFlowVisibility();
    ToastService.success(LanguageService.t('matcher.imageLoaded'));

    void this.extractPalette(true);
  }

  /**
   * Handle a dropped image file (also the clipboard path). Refuses a file
   * over the shared cap before the reader runs — decoding a huge image hangs
   * the tab (WEB-13).
   */
  private handleDroppedFile(file: File): void {
    if (file.size > MAX_USER_FILE_BYTES) {
      ToastService.error(LanguageService.t('errors.imageTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        this.onImageLoaded(img);
        this.emit('image-loaded', { image: img, dataUrl });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  /**
   * Read image from clipboard using the Clipboard API (navigator.clipboard.read)
   * — the explicit "Paste from clipboard" button. Ctrl+V is the document-level
   * paste listener in bindEvents.
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
      ToastService.error(LanguageService.t('matcher.pasteNoImage'));
    } catch (error) {
      logger.warn('[ExtractorTool] Clipboard read failed:', error);
      ToastService.error(LanguageService.t('matcher.pasteNoImage'));
    }
  }

  /**
   * Clear the current image and everything read from it. FINDING-009:
   * nothing was persisted, so dropping the references is the whole clear.
   */
  private clearImage(): void {
    this.currentImage = null;
    this.extractedMatches = [];
    this.picks = [];
    this.roll = [];
    this.focusIndex = null;
    this.currentLoupeHex = null;
    this.v4ResultCards = [];

    if (this.resultsContainer) {
      clearContainer(this.resultsContainer);
    }
    if (this.barElement) {
      clearContainer(this.barElement);
    }
    this.renderLegend();
    this.renderHeader();
    this.resetLoupe();
    this.updateFlowVisibility();

    // Re-render the canvas area to clear the zoom controller
    this.renderImageCanvas();

    ToastService.info(LanguageService.t('matcher.imageCleared'));
    logger.info('[ExtractorTool] Image cleared');
  }

  /**
   * Flip the workspace between the drawn empty state and the loaded flow.
   */
  private updateFlowVisibility(): void {
    const hasImage = this.currentImage !== null;
    if (this.emptyFlowElement) {
      this.emptyFlowElement.style.display = hasImage ? 'none' : 'flex';
    }
    if (this.loadedFlowElement) {
      this.loadedFlowElement.style.display = hasImage ? 'flex' : 'none';
    }
  }

  // ============================================================================
  // The loupe (stage 1 — input)
  // ============================================================================

  /**
   * Render the image canvas with the zoom controller and wire the loupe:
   * a plain click/tap reads the pixels under it (pixel-averaged via
   * sampleAreaSize), a drag past the threshold drives the loupe live and
   * reads at the release point. Nothing here commits a pick.
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

    this.imageZoom = new ImageZoomController(canvasWrapper, {});
    this.imageZoom.init();
    if (this.dragThreshold !== undefined) {
      this.imageZoom.setDragThreshold(this.dragThreshold);
    }
    if (this.sampleAreaSize !== undefined) {
      this.imageZoom.setSampleAreaSize(this.sampleAreaSize);
    }

    // A click/tap, or the release of a drag: the controller's averaged
    // sample at that canvas point. The loupe settles there holding it.
    this.onPanelEvent(canvasWrapper, 'image-sampled', (event: CustomEvent) => {
      const { hex, x, y, isPixelSample } = event.detail as {
        hex?: string;
        x?: number;
        y?: number;
        isPixelSample?: boolean;
      };
      if (!isPixelSample || !hex) return;
      const point = this.canvasToCardPoint(x ?? 0, y ?? 0);
      this.showLoupe(hex, point, false);
    });

    // The drag reads the pixel under the pointer live
    this.onPanelEvent(canvasWrapper, 'loupe-move', (event: CustomEvent) => {
      const { hex, clientX, clientY } = event.detail as {
        hex: string;
        clientX: number;
        clientY: number;
      };
      this.showLoupe(hex, this.clientToCardPoint(clientX, clientY), true);
    });
    this.onPanelEvent(canvasWrapper, 'loupe-end', () => {
      this.settleLoupe();
    });

    if (this.currentImage) {
      this.imageZoom.setImage(this.currentImage);
      this.imageZoom.autoFit();
    }
  }

  /** Card-relative point for a client coordinate, clamped to the card. */
  private clientToCardPoint(clientX: number, clientY: number): { left: number; top: number } {
    if (!this.imageCardElement) return { left: 0, top: 0 };
    const rect = this.imageCardElement.getBoundingClientRect();
    return {
      left: Math.max(0, Math.min(clientX - rect.left, rect.width)),
      top: Math.max(0, Math.min(clientY - rect.top, rect.height)),
    };
  }

  /** Card-relative point for a canvas pixel coordinate. */
  private canvasToCardPoint(x: number, y: number): { left: number; top: number } {
    const canvas = this.imageZoom?.getCanvas();
    if (!canvas || !this.imageCardElement || !canvas.width || !canvas.height) {
      return { left: 0, top: 0 };
    }
    const c = canvas.getBoundingClientRect();
    return this.clientToCardPoint(
      c.left + (x / canvas.width) * c.width,
      c.top + (y / canvas.height) * c.height
    );
  }

  /**
   * Put the loupe at a point holding a colour. `dragging` scales it up 16%
   * (the drawn drag state); a settled loupe sits at scale 1.
   */
  private showLoupe(hex: string, point: { left: number; top: number }, dragging: boolean): void {
    if (!this.loupeElement) return;
    this.loupeElement.style.left = `${point.left}px`;
    this.loupeElement.style.top = `${point.top}px`;
    this.loupeElement.style.background = hex;
    this.loupeElement.style.transform = `translate(-50%, -50%) scale(${dragging ? 1.16 : 1})`;
    if (this.loupeHexChip) {
      this.loupeHexChip.textContent = hex.toUpperCase();
    }
    this.setLoupeHex(hex);
  }

  /** Drag ended: the loupe stays where it is, back at scale 1. */
  private settleLoupe(): void {
    if (this.loupeElement && this.currentLoupeHex) {
      this.loupeElement.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  }

  /** New or cleared image: the loupe has read nothing yet. */
  private resetLoupe(): void {
    if (this.loupeElement) {
      this.loupeElement.style.transform = 'translate(-50%, -50%) scale(0)';
      this.loupeElement.style.background = 'transparent';
    }
    if (this.loupeHexChip) {
      this.loupeHexChip.textContent = '';
    }
    if (this.hintSwatchElement) {
      this.hintSwatchElement.style.background = LOUPE_PLACEHOLDER;
    }
    if (this.addPickChipElement) {
      this.addPickChipElement.style.background = LOUPE_PLACEHOLDER;
    }
    for (const el of this.hintRestElements) {
      el.style.display = '';
    }
    if (this.hintReadElement) {
      this.hintReadElement.style.display = 'none';
      this.hintReadElement.textContent = '';
    }
  }

  /**
   * Track the loupe's colour — it feeds the hint chip (which names the
   * nearest dye) and the `+` tile's chip.
   */
  private setLoupeHex(hex: string): void {
    this.currentLoupeHex = hex;
    if (this.hintSwatchElement) {
      this.hintSwatchElement.style.background = hex;
    }
    if (this.addPickChipElement) {
      this.addPickChipElement.style.background = hex;
    }
    if (this.hintReadElement) {
      const nearest = dyeService.findClosestDye(hex, { matchingMethod: this.matchingMethod });
      const name = nearest ? this.dyeDisplayName(nearest) : '';
      this.hintReadElement.textContent = name
        ? `${hex.toUpperCase()} · ${name}`
        : hex.toUpperCase();
      this.hintReadElement.style.display = '';
      for (const el of this.hintRestElements) {
        el.style.display = 'none';
      }
    }
  }

  private dyeDisplayName(dye: Dye): string {
    return LanguageService.getDyeName(dye.itemID) || dye.name;
  }

  // ============================================================================
  // The roll — resolution shared by the bar and the sheet
  // ============================================================================

  /**
   * Resolve every bar segment to a dye through ONE path: the extracted
   * colours (ordered by share, or by the vibrancy score when the boost is
   * on) and then the picks, each taking the nearest dye that the filters
   * allow and — while preventDuplicates is on — no earlier slot has taken.
   */
  private rebuildRoll(): void {
    const sources: Array<{ hex: string; share: number | null; preferred?: Dye }> =
      this.orderedExtracted().map((match) => ({
        hex: this.rgbToHexString(match.extracted),
        share: Math.round(match.dominance),
        preferred: match.matchedDye,
      }));
    for (const hex of this.picks) {
      sources.push({ hex, share: null });
    }

    const used = new Set<number>();
    const roll: RollEntry[] = [];
    for (const source of sources) {
      const dye = this.nearestEligibleDye(source.hex, used, source.preferred);
      if (!dye) continue;
      if (this.preventDuplicates) {
        used.add(dye.itemID);
      }
      roll.push({
        hex: source.hex,
        share: source.share,
        dye,
        // Measured with the method the card labels (BUG-007) — never raw RGB
        distance: ColorService.getDistanceForMethod(source.hex, dye.hex, this.matchingMethod),
      });
    }
    this.roll = roll;

    if (this.focusIndex !== null && this.focusIndex >= roll.length) {
      this.focusIndex = null;
    }
  }

  /**
   * The extracted colours in bar order. K-means returns them by share; the
   * vibrancy boost weights saturated colours above greys and browns
   * (`0.55 × saturation + share`, the drawn formula) so a small vivid accent
   * can lead a large muted field. The widths stay share-based either way.
   */
  private orderedExtracted(): PaletteMatch[] {
    if (!this.vibrancyBoost) return this.extractedMatches;
    const score = (match: PaletteMatch): number => {
      const { r, g, b } = match.extracted;
      const sat = ColorService.rgbToHsv(r, g, b).s;
      return sat * 0.55 + match.dominance;
    };
    return [...this.extractedMatches].sort((a, b) => score(b) - score(a));
  }

  /**
   * The nearest dye the current filters allow that no earlier slot holds
   * (while preventDuplicates is on). `preferred` is the extraction's own
   * match, taken when it qualifies so the sheet agrees with the matcher.
   * The substitute is chosen by the same metric as the original match, or
   * excluding a dye would change what "closest" means (BUG-007).
   */
  private nearestEligibleDye(hex: string, used: Set<number>, preferred?: Dye): Dye | null {
    const eligible = (dye: Dye): boolean =>
      !isDyeExcluded(this.dyeFiltersConfig, dye) &&
      !(this.preventDuplicates && used.has(dye.itemID));

    const first =
      preferred ?? dyeService.findClosestDye(hex, { matchingMethod: this.matchingMethod });
    if (first && eligible(first)) return first;

    const pool = filterDyes(this.dyeFiltersConfig, dyeService.getAllDyes()).filter(eligible);
    if (pool.length === 0) return null;
    return pool.reduce((best, dye) => {
      const bestDist = ColorService.getDistanceForMethod(hex, best.hex, this.matchingMethod);
      const dyeDist = ColorService.getDistanceForMethod(hex, dye.hex, this.matchingMethod);
      return dyeDist < bestDist ? dye : best;
    });
  }

  /** Format an RGB triple as an uppercase hex string. */
  private rgbToHexString(rgb: RGB): string {
    return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`.toUpperCase();
  }

  /** Resolve the roll and repaint every stage that shows it. */
  private renderRoll(): void {
    this.rebuildRoll();
    this.renderBar();
    this.renderLegend();
    this.renderHeader();
    this.renderCards();
    if (this.showPrices && this.roll.length > 0) {
      void this.fetchPricesForRoll();
    }
  }

  // ============================================================================
  // The bar (stage 2 — index)
  // ============================================================================

  /**
   * Extracted segments sized by share (`flex: share 1 0`, labelled `n%`),
   * a 3px break, then each pick as a fixed-width segment labelled with its
   * slot number, then the `+` tile holding the loupe colour.
   */
  private renderBar(): void {
    if (!this.barElement) return;
    clearContainer(this.barElement);

    const firstPick = this.roll.findIndex((entry) => entry.share === null);

    this.roll.forEach((entry, index) => {
      const isPick = entry.share === null;
      const focused = index === this.focusIndex;
      const segment = this.createElement('button', {
        className: isPick ? 'x4a-seg x4a-seg-pick' : 'x4a-seg',
        attributes: {
          type: 'button',
          title: isPick
            ? `${entry.hex.toUpperCase()} · ${this.dyeDisplayName(entry.dye)}`
            : `${entry.hex.toUpperCase()} · ${entry.share}% · ${this.dyeDisplayName(entry.dye)}`,
          'aria-pressed': focused ? 'true' : 'false',
          'data-index': String(index),
          style: [
            'display: flex; align-items: center; justify-content: center; padding: 0;',
            'cursor: pointer; border: none; box-sizing: border-box;',
            `border-top: 3px solid ${focused ? 'var(--theme-primary)' : 'transparent'};`,
            `background: ${entry.hex};`,
            // Longhands, not the `flex` shorthand: the width IS the share and
            // must stay readable as flex-grow (jsdom never expands the shorthand)
            isPick
              ? ''
              : `flex-grow: ${Math.max(1, entry.share ?? 1)}; flex-shrink: 1; flex-basis: 0;`,
            // The 3px break separates the two kinds of segment
            isPick && index === firstPick && firstPick > 0 ? 'margin-left: 3px;' : '',
          ].join(' '),
        },
      }) as HTMLButtonElement;
      segment.appendChild(
        this.createElement('span', {
          className: 'number',
          textContent: isPick ? String(index + 1) : `${entry.share}%`,
          attributes: {
            style: [
              'font-family: var(--font-mono); font-size: 9.5px; white-space: nowrap; overflow: hidden;',
              `color: ${getContrastColor(entry.hex)};`,
            ].join(' '),
          },
        })
      );
      this.on(segment, 'click', () => {
        this.setFocus(index);
      });
      this.barElement!.appendChild(segment);
    });

    // The `+` tile: dark glass, dashed accent left edge, the loupe's colour
    // as a 16px chip. Commits the loupe colour into the picks run.
    const atCap = this.picks.length >= MAX_PICKS;
    const addTile = this.createElement('button', {
      className: 'x4a-add-tile',
      attributes: {
        type: 'button',
        id: 'extractor-add-pick',
        title: LanguageService.t('matcher.addPick'),
        'aria-label': LanguageService.t('matcher.addPick'),
        'aria-disabled': atCap ? 'true' : 'false',
        style: [
          'display: flex; align-items: center; justify-content: center; gap: 5px; padding: 0;',
          `cursor: pointer; background: ${ADD_TILE_BG}; border: none; box-sizing: border-box;`,
          `border-left: 1px dashed ${ACCENT_BORDER}; color: var(--theme-primary);`,
          atCap ? 'opacity: 0.45;' : '',
        ].join(' '),
      },
    }) as HTMLButtonElement;
    this.addPickChipElement = this.createElement('span', {
      attributes: {
        style: `width: 16px; height: 16px; border-radius: 4px; flex-shrink: 0; background: ${this.currentLoupeHex ?? LOUPE_PLACEHOLDER};`,
        'aria-hidden': 'true',
      },
    });
    addTile.appendChild(this.addPickChipElement);
    addTile.appendChild(
      this.createElement('span', {
        textContent: '+',
        attributes: { style: 'font-size: 13px; line-height: 1;', 'aria-hidden': 'true' },
      })
    );
    this.on(addTile, 'click', () => {
      this.commitPick();
    });
    this.barElement.appendChild(addTile);
  }

  /**
   * Commit the loupe's colour as a pick — it joins the fixed-width run at
   * the bar's right end and gets its own card. Nothing to commit before the
   * loupe has read a colour; past the cap, say so rather than drop one.
   */
  private commitPick(): void {
    if (!this.currentLoupeHex || !this.currentImage) return;
    if (this.picks.length >= MAX_PICKS) {
      ToastService.info(
        LanguageService.tInterpolate('matcher.pickCapReached', { max: String(MAX_PICKS) })
      );
      return;
    }
    this.picks.push(this.currentLoupeHex);
    this.renderRoll();
    this.setFocus(this.roll.length - 1);
  }

  /** Drop every pick; the extracted run stays. */
  private clearPicks(): void {
    if (this.picks.length === 0) return;
    this.picks = [];
    this.focusIndex = null;
    this.renderRoll();
  }

  /**
   * Focus a segment: its top edge takes the accent, its card takes the
   * selected ring and scrolls into view.
   */
  private setFocus(index: number | null): void {
    this.focusIndex = index !== null && index >= 0 && index < this.roll.length ? index : null;

    if (this.barElement) {
      const segments = this.barElement.querySelectorAll<HTMLElement>('.x4a-seg');
      segments.forEach((segment, i) => {
        const focused = i === this.focusIndex;
        segment.style.borderTopColor = focused ? 'var(--theme-primary)' : 'transparent';
        segment.setAttribute('aria-pressed', focused ? 'true' : 'false');
      });
    }

    this.v4ResultCards.forEach((card, i) => {
      card.selected = i === this.focusIndex;
    });
    if (this.focusIndex !== null) {
      const card = this.v4ResultCards[this.focusIndex];
      if (card && typeof card.scrollIntoView === 'function') {
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  /** `IMAGE SHARE · n picks`, and the Clear-picks button while there are any. */
  private renderLegend(): void {
    const picks = this.picks.length;
    if (this.legendElement) {
      const share = LanguageService.t('matcher.imageShare');
      const picksText =
        picks === 1
          ? LanguageService.t('matcher.picksCountOne')
          : LanguageService.tInterpolate('matcher.picksCount', { count: String(picks) });
      this.legendElement.textContent = picks > 0 ? `${share} · ${picksText}` : share;
    }
    if (this.clearPicksBtn) {
      this.clearPicksBtn.style.display = picks > 0 ? '' : 'none';
    }
  }

  /** The count reads `6 + 2` with picks (never `8 of 6`), `6 of 6` without. */
  private renderHeader(): void {
    const picks = this.roll.filter((entry) => entry.share === null).length;
    const extracted = this.roll.length - picks;
    if (this.resultsCountElement) {
      if (this.roll.length === 0) {
        this.resultsCountElement.textContent = '';
      } else if (picks > 0) {
        this.resultsCountElement.textContent = LanguageService.tInterpolate('matcher.rollCount', {
          extracted: String(extracted),
          picks: String(picks),
        });
      } else {
        this.resultsCountElement.textContent = LanguageService.tInterpolate('matcher.rollCountOf', {
          count: String(extracted),
          max: String(this.paletteColorCount),
        });
      }
    }
    if (this.exportBtn) {
      const hasResults = this.roll.length > 0;
      this.exportBtn.disabled = !hasResults;
      this.exportBtn.style.opacity = hasResults ? '1' : '0.5';
      this.exportBtn.style.cursor = hasResults ? 'pointer' : 'not-allowed';
    }
  }

  // ============================================================================
  // The sheet (stage 3 — output)
  // ============================================================================

  /** One compact result card per roll entry, in bar order. */
  private renderCards(): void {
    if (!this.resultsContainer) return;
    clearContainer(this.resultsContainer);
    this.v4ResultCards = [];

    if (this.roll.length === 0) return;

    const cardsGrid = this.createElement('div', {
      className: 'extractor-results-grid v5-results-grid',
    });

    this.roll.forEach((entry, index) => {
      const cardData: ResultCardData = {
        dye: entry.dye,
        originalColor: entry.hex,
        matchedColor: entry.dye.hex,
        deltaE: entry.distance,
        matchingMethod: this.matchingMethod,
        vendorCost: entry.dye.cost,
      };

      if (this.showPrices && this.priceData.has(entry.dye.itemID)) {
        const price = this.priceData.get(entry.dye.itemID)!;
        cardData.price = price.currentMinPrice;
        // Resolve worldId to a world name; fall back to the selected server
        cardData.marketServer =
          WorldService.getWorldName(price.worldId) ||
          this.marketBoardService.getSelectedServer() ||
          LanguageService.t('common.market');
      }

      const card = document.createElement('v4-result-card') as unknown as ResultCard;
      card.compact = true;
      card.data = cardData;
      card.selected = index === this.focusIndex;
      card.setAttribute('primary-opens-menu', 'true');
      card.dataset.index = String(index);

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

      card.addEventListener('context-action', ((
        e: CustomEvent<{ action: ContextAction; dye: Dye }>
      ) => {
        this.handleContextAction(e.detail.action, e.detail.dye);
      }) as EventListener);

      this.v4ResultCards.push(card);
      cardsGrid.appendChild(card);
    });

    this.resultsContainer.appendChild(cardsGrid);
  }

  // ============================================================================
  // Market prices
  // ============================================================================

  /** Fetch prices for every distinct dye on the sheet. */
  private async fetchPricesForRoll(): Promise<void> {
    if (!this.showPrices) return;

    const seen = new Set<number>();
    const dyesToFetch: Dye[] = [];
    for (const entry of this.roll) {
      if (seen.has(entry.dye.itemID)) continue;
      seen.add(entry.dye.itemID);
      dyesToFetch.push(entry.dye);
    }
    if (dyesToFetch.length === 0) return;

    this.lastMarketError = undefined;
    try {
      const prices = await this.marketBoardService.fetchPricesForDyes(dyesToFetch);
      logger.info(`[ExtractorTool] Fetched prices for ${prices.size} dyes`);
    } catch (error) {
      this.lastMarketError = this.parseMarketError(error);
      logger.error('[ExtractorTool] Failed to fetch prices:', error);
    } finally {
      // Always update cards to reflect current showPrices state and any
      // fetched data — cards show the Market section even if the fetch failed
      this.updateV4ResultCardPrices();
    }
  }

  /**
   * Parse a market fetch error into a short display code for result cards:
   * "H" + status for HTTP errors, "N" for network, "E" for other.
   */
  private parseMarketError(error: unknown): string {
    if (!navigator.onLine) {
      return 'NOFF';
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const statusMatch =
        message.match(/status[:\s]*(\d{3})/i) ||
        message.match(/(\d{3})[:\s]*(rate limit|too many|forbidden|not found|server error)/i);
      if (statusMatch) {
        const status = parseInt(statusMatch[1], 10);
        if (status === 429) return 'H429';
        if (status >= 400) return `H${status}`;
      }
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

    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as { status: number }).status;
      if (status === 429) return 'H429';
      if (status >= 400) return `H${status}`;
    }

    return 'EUNK';
  }

  /** Push fetched prices (or the error code) onto the cards in place. */
  private updateV4ResultCardPrices(): void {
    for (const card of this.v4ResultCards) {
      const currentData = card.data;
      if (!currentData?.dye) continue;

      const priceInfo = this.priceData.get(currentData.dye.itemID);
      const marketServer =
        this.marketBoardService.getWorldNameForPrice(priceInfo) ??
        this.marketBoardService.getSelectedServer();

      card.showPrice = this.displayOptions.showPrice && this.showPrices;
      const shouldShowError = this.showPrices && this.lastMarketError && !priceInfo;

      card.data = {
        ...currentData,
        price: this.showPrices && priceInfo ? priceInfo.currentMinPrice : undefined,
        marketServer,
        marketError: shouldShowError ? this.lastMarketError : undefined,
      };
    }
  }

  // ============================================================================
  // Palette Extraction
  // ============================================================================

  /**
   * Extract the dominant colours with K-means and rebuild the roll. Runs on
   * image load (`announce` toasts the count) and on every config change that
   * affects the extraction — silently, so a slider drag is not a toast storm.
   * The picks survive a re-extraction.
   */
  private async extractPalette(announce: boolean): Promise<void> {
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

    this.isExtracting = true;
    if (this.workspaceElement) {
      this.workspaceElement.dataset.busy = 'true';
    }
    if (this.barElement) {
      this.barElement.setAttribute('aria-busy', 'true');
    }

    // OPT-011: yield a frame so the busy state actually paints — the work
    // below is synchronous
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // OPT-011: downsample the K-means input on large images
      const pixels = this.samplePixelsForPalette(imageData);

      if (pixels.length === 0) {
        ToastService.error(LanguageService.t('errors.noPixelsToAnalyze'));
        return;
      }

      // BUG-091: pass `matchingMethod`, or the service falls back to its own
      // default whatever the user selected
      const matches = this.paletteService.extractAndMatchPalette(pixels, dyeService, {
        colorCount: this.paletteColorCount,
        matchingMethod: this.matchingMethod,
      });

      // K-means hands back `colorCount` clusters whatever the image holds, so
      // a flat logo asked for four colours returns two real clusters and two
      // empty ones. An empty cluster has no pixels — it is not a colour the
      // image contains, it must not take a bar segment or a card, and the
      // count would read `4 + 2` over two real colours.
      const kept = matches.filter((match) => match.dominance >= 1);
      this.extractedMatches = kept;
      this.renderRoll();

      if (announce) {
        ToastService.success(
          LanguageService.tInterpolate(
            kept.length === 1 ? 'matcher.paletteExtractedOne' : 'matcher.paletteExtracted',
            { count: String(kept.length) }
          )
        );
      }

      logger.info('[ExtractorTool] Palette extracted:', kept.length, 'colors');
    } catch (error) {
      logger.error('[ExtractorTool] Palette extraction failed:', error);
      ToastService.error(LanguageService.t('errors.paletteExtractionFailed'));
    } finally {
      this.isExtracting = false;
      if (this.workspaceElement) {
        delete this.workspaceElement.dataset.busy;
      }
      if (this.barElement) {
        this.barElement.removeAttribute('aria-busy');
      }
    }
  }

  /**
   * OPT-011: build the K-means input from a sampled pixel grid instead of
   * every pixel. Targets ~100k samples — small images are used in full,
   * a 4K screenshot (~8.3M pixels) is reduced ~80×. Skips near-transparent
   * pixels like PaletteService.pixelDataToRGBFiltered does.
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

  // ============================================================================
  // Hand-offs
  // ============================================================================

  /**
   * Handle context menu actions from result cards
   */
  private handleContextAction(action: ContextAction, dye: Dye): void {
    switch (action) {
      case 'add-comparison':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', { detail: { toolId: 'comparison', dye } })
        );
        ToastService.success(LanguageService.t('harmony.addedToComparison'));
        break;

      case 'add-mixer':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', { detail: { toolId: 'mixer', dye } })
        );
        ToastService.success(LanguageService.t('harmony.addedToMixer'));
        break;

      case 'add-accessibility':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', { detail: { toolId: 'accessibility', dye } })
        );
        ToastService.success(LanguageService.t('harmony.addedToAccessibility'));
        break;

      case 'see-harmonies':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', { detail: { toolId: 'harmony', dye } })
        );
        break;

      case 'budget':
        window.dispatchEvent(
          new CustomEvent('navigate-to-tool', { detail: { toolId: 'budget', dye } })
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
   * Open the shared export sheet over the roll — extracted colours and picks
   * alike. Each entry exports as a pair, the pixel actually read and the dye
   * it resolved to, because the drift between them is the whole reason this
   * tool matches rather than just reporting colours.
   */
  private openPaletteExport(): void {
    openExportSheet({
      tool: 'extractor',
      title: LanguageService.t('matcher.extractedPalette'),
      entries: this.roll.map((entry, index) => ({
        key: `pick-${index + 1}`,
        source: entry.hex,
        dye: entry.dye,
        delta: entry.distance,
      })),
    });
  }
}
