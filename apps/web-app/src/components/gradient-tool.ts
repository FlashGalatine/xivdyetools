/**
 * XIV Dye Tools v4.0.0 - Gradient Tool Component (Gradient Builder)
 *
 * V4 Renamed: mixer-tool.ts â†’ gradient-tool.ts
 * Creates color gradients between two dyes with intermediate matches.
 *
 * Left Panel: Start/End dye selectors, steps slider, color space toggle, filters, market board
 * Right Panel: Gradient preview, intermediate dye matches, export options
 *
 * @module components/tools/gradient-tool
 */

import {
  BAND_METHOD_DP,
  classifyBandTier,
  isMatchingMethod,
  isValidHexColor,
  LEGACY_MATCHING_METHOD_MAP,
  normalizeMatchingMethod,
} from '@xivdyetools/core';
import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { DyeSelector } from '@components/dye-selector';
import { MarketBoard } from '@components/market-board';
import { openExportSheet } from '@components/export-sheet';
import '@components/v4/result-card';
import type { ResultCard, ResultCardData, ContextAction } from '@components/v4/result-card';
import '@components/v4/share-button';
import type { ShareButton } from '@components/v4/share-button';
import { ShareService } from '@services/share-service';
import {
  ColorService,
  ConfigController,
  dyeService,
  LanguageService,
  MarketBoardService,
  StorageService,
  ThemeService,
  ToastService,
  WorldService,
  // WEB-REF-003 Phase 3: Shared panel builders
  buildMarketPanel,
} from '@services/index';
// Note: setupMarketBoardListeners still used by drawer code until Phase 2 refactor
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import { ICON_TOOL_GRADIENT } from '@shared/tool-icons';
// Note: ICON_MARKET still used by drawer code until Phase 2 refactor
import { ICON_MARKET, ICON_STAIRS, ICON_PALETTE } from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import { isCustomDye, makeCustomDye } from '@shared/custom-dye';
import type { Dye, PriceData } from '@xivdyetools/types';
import type {
  GradientConfig,
  DisplayOptionsConfig,
  MarketConfig,
  InterpolationMode,
  MatchingMethod,
  DyeFiltersConfig,
} from '@shared/tool-config-types';
import {
  DEFAULT_DISPLAY_OPTIONS,
  DEFAULT_DYE_FILTERS,
  getDefaultConfig,
} from '@shared/tool-config-types';
import { isDyeExcluded, filterDyes } from '@shared/dye-filter-utils';

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
  selectedDyes: 'v3_mixer_selected_dyes',
  // Legacy keys for migration
  startDyeId: 'v3_mixer_start_dye_id',
  endDyeId: 'v3_mixer_end_dye_id',
} as const;

/**
 * BUG-019 (2026-10-04 deep-dive): the tool's own mirrors of the step count
 * and colour space. ConfigController owns both settings (the sidebar always
 * showed its values), so these are only ever removed, never read or written.
 */
const RETIRED_SETTINGS_KEYS = ['v3_mixer_steps', 'v3_mixer_color_space'] as const;

/**
 * 4C accent tints (the drawn accent-soft / accent-border), built on the
 * theme's primary token so both Light and Dark themes hold.
 */
/** Ramp length, per the drawn 4C control — one range for slider, sidebar and share. */
const STEP_MIN = 3;
const STEP_MAX = 12;

/**
 * A finite step count, rounded and clamped into the ramp's range; null for
 * anything else. An imported config is type-checked only, so the controller
 * can hold 50 or 4.5.
 */
function toStepCount(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.min(STEP_MAX, Math.max(STEP_MIN, Math.round(value)));
}

/** The five spaces interpolateInSpace implements; anything else draws a flat grey ramp. */
const INTERPOLATION_MODES: readonly InterpolationMode[] = ['rgb', 'hsv', 'lab', 'oklch', 'lch'];

function isInterpolationMode(value: unknown): value is InterpolationMode {
  return typeof value === 'string' && (INTERPOLATION_MODES as readonly string[]).includes(value);
}

const ACCENT_SOFT = 'color-mix(in srgb, var(--theme-primary) 14%, transparent)';
const ACCENT_BORDER = 'color-mix(in srgb, var(--theme-primary) 45%, transparent)';

/** Shared 5.0 tier ramps (same as result-card / 7C Duel / 9C Ledger). */
const TIER_RAMP_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'] as const;
const TIER_RAMP_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'] as const;

// 4C glyphs — drawn geometry from the confirmed prototype (static innerHTML
// only, per the icons security pattern).
const ICON_SWAP_ENDS =
  '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M7 4 4 7l3 3"></path><path d="M20 17H4"></path><path d="M17 14l3 3-3 3"></path></svg>';
const PIN_GLYPH_PATHS =
  '<path d="M12 17v5"></path><path d="M9 10.76V6a3 3 0 0 1 6 0v4.76a2 2 0 0 0 .55 1.38l1.16 1.24a1 1 0 0 1-.73 1.68H8.02a1 1 0 0 1-.73-1.68l1.16-1.24A2 2 0 0 0 9 10.76z"></path>';
const ICON_PIN_OUTLINE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${PIN_GLYPH_PATHS}</svg>`;
const ICON_PIN_FILLED = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${PIN_GLYPH_PATHS}</svg>`;
const ICON_END_ANCHOR =
  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v4"></path><path d="M12 18v4"></path></svg>';

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
  private matchingMethod: MatchingMethod = 'ciede2000';
  private preventDuplicates = true;
  private currentSteps: InterpolationStep[] = [];
  /** 4C: pinned step index â†’ the dye anchored there (captured at pin time) */
  private pinnedSteps = new Map<number, Dye>();
  /** Pins are meaningless across an endpoint change â€” track to invalidate */
  private lastEndpointsKey = '';

  // Market Board Service integration
  private marketBoardService: MarketBoardService;

  // Computed getters for market data (delegates to shared service)
  private get showPrices(): boolean {
    return this.marketBoardService.getShowPrices();
  }

  // OPT-027 (2026-07-18 audit): read-only view, no per-access map clone â€”
  // this getter is hit inside per-card render loops
  private get priceData(): ReadonlyMap<number, PriceData> {
    return this.marketBoardService.getPricesView();
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
  private dyeFiltersConfig: DyeFiltersConfig = { ...DEFAULT_DYE_FILTERS };
  private marketBoard: MarketBoard | null = null;
  private dyeSelectionPanel: CollapsiblePanel | null = null;
  private settingsPanel: CollapsiblePanel | null = null;
  private marketPanel: CollapsiblePanel | null = null;

  // Child components (mobile drawer - separate instances for independent panel states)
  private mobileDyeSelectionPanel: CollapsiblePanel | null = null;
  private mobileSettingsPanel: CollapsiblePanel | null = null;
  private mobileMarketPanel: CollapsiblePanel | null = null;
  private mobileDyeSelector: DyeSelector | null = null;
  private mobileMarketBoard: MarketBoard | null = null;
  private mobileStepValueDisplay: HTMLElement | null = null;

  // DOM References
  private selectedDyesContainer: HTMLElement | null = null;
  private mobileSelectedDyesContainer: HTMLElement | null = null;
  private stepValueDisplay: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private matchesContainer: HTMLElement | null = null;
  private resultsHeader: HTMLElement | null = null;
  private resultsHeaderContainer: HTMLElement | null = null;
  private shareButton: ShareButton | null = null;

  // DOM References (4C pin-rail main flow)
  private endpointsRowContainer: HTMLElement | null = null;
  private railSection: HTMLElement | null = null;
  private bandContainer: HTMLElement | null = null;
  private railPinCount: HTMLElement | null = null;
  private pinColumn: HTMLElement | null = null;
  private rowsColumn: HTMLElement | null = null;
  private summaryCluster: HTMLElement | null = null;
  private exportButton: HTMLElement | null = null;

  /** 4C: armed endpoint — the dye-palette drawer's next pick lands here */
  private activeEndpoint: 0 | 1 | null = null;
  /** 4C: focused rail step (accent ring on the row + selected card below) */
  private focusedStep: number | null = null;

  // V4 Result Card references (for price updates)
  private v4ResultCards: ResultCard[] = [];

  // Subscriptions

  // Display options (from ConfigController) - for future v4-result-card migration
  private displayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

  // Guard flag to prevent selection-changed event from overwriting state during external selection
  private isExternalSelection = false;

  constructor(container: HTMLElement, options: GradientToolOptions) {
    super(container);
    this.options = options;

    // Initialize shared MarketBoardService
    this.marketBoardService = MarketBoardService.getInstance();

    // BUG-019 / BUG-022 (2026-10-04 deep-dive): seed EVERY setting from
    // ConfigController. subscribe() never replays, so this is the only
    // mount-time source; the step count and colour space used to come from
    // the tool's own v3 keys and the dye filters from nowhere, so a reload
    // could disagree with the sidebar until its next broadcast.
    // Nested objects are copied: getConfig can hand back the controller's
    // live object, or DEFAULT_CONFIGS itself for a never-saved tool.
    const defaults = getDefaultConfig('gradient');
    const saved = ConfigController.getInstance().getConfig('gradient');
    this.stepCount = toStepCount(saved.stepCount) ?? defaults.stepCount;
    this.colorSpace = isInterpolationMode(saved.interpolation)
      ? saved.interpolation
      : defaults.interpolation;
    // Normalized so persisted 4.x values (hyab, oklch-weighted) migrate
    this.matchingMethod = normalizeMatchingMethod(saved.matchingMethod ?? 'ciede2000');
    this.preventDuplicates = saved.preventDuplicates ?? defaults.preventDuplicates;
    this.displayOptions = { ...DEFAULT_DISPLAY_OPTIONS, ...saved.displayOptions };
    this.dyeFiltersConfig = { ...DEFAULT_DYE_FILTERS, ...saved.dyeFilters };
    for (const key of RETIRED_SETTINGS_KEYS) {
      StorageService.removeItem(key);
    }

    // Note: showPrices now comes from MarketBoardService getter

    // Load persisted dye selections (with migration from old format)
    this.loadSelectedDyes();
  }

  /**
   * Load selected dyes from storage, migrating from old format if needed
   */
  private loadSelectedDyes(): void {
    // Try new storage format first
    const saved = StorageService.getItem<Array<number | string>>(STORAGE_KEYS.selectedDyes);

    if (saved && saved.length > 0) {
      // BUG-092 (2026-10-04 deep-dive): the list is positional — [0] is Start,
      // [1] is End — so a slot that cannot be restored ends it. Filtering the
      // slot out slid the End dye into Start.
      const restored: Dye[] = [];
      for (const entry of saved) {
        const dye = this.restoreStoredEndpoint(entry);
        if (!dye) break;
        restored.push(dye);
      }
      this.selectedDyes = restored;
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
        logger.info('[GradientTool] Migrated dye selection from old storage format');
      }
    }
  }

  /**
   * One stored endpoint: a dye id, or the hex of a Custom Color endpoint.
   * Null when it no longer resolves.
   */
  private restoreStoredEndpoint(entry: unknown): Dye | null {
    if (typeof entry === 'string') {
      return isValidHexColor(entry) ? makeCustomDye(entry) : null;
    }
    if (typeof entry === 'number') {
      return dyeService.getDyeById(entry) || null;
    }
    return null;
  }

  /**
   * Save selected dyes to storage. A Custom Color endpoint is stored by its
   * hex: its id is minted per session by makeCustomDye and resolves to
   * nothing on the next load (BUG-092).
   */
  private saveSelectedDyes(): void {
    const entries = this.selectedDyes.map((d) => (isCustomDye(d) ? d.hex : d.id));
    StorageService.setItem(STORAGE_KEYS.selectedDyes, entries);
  }

  /**
   * Resolve a shared dye param (5.0: stainID; legacy itemIDs fail loudly).
   */
  private findSharedDye(value: number): Dye | null {
    return ShareService.resolveSharedDye(value);
  }

  /**
   * Resolve one shared endpoint from its (mutually exclusive) stainID and
   * bare-colour params. Returns null when neither is present or the value
   * fails loudly inside ShareService.
   */
  private resolveSharedEndpoint(dyeParam: unknown, hexParam: unknown): Dye | null {
    if (typeof dyeParam === 'number') {
      return this.findSharedDye(dyeParam);
    }
    if (hexParam !== undefined && hexParam !== null && hexParam !== '') {
      const hex = ShareService.parseSharedHex(hexParam);
      return hex ? makeCustomDye(hex) : null;
    }
    return null;
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

    // Each endpoint is EITHER a stainID (`start`/`end`) OR a bare colour
    // (`hexStart`/`hexEnd`) — the dye slot wins when both are present, and a
    // bare colour goes through the same virtual-dye path as the drawer's
    // Custom Color so the rest of the tool treats it like any endpoint.
    const startDye = this.resolveSharedEndpoint(params.start, params.hexStart);
    if (startDye) {
      this.selectedDyes[0] = startDye;
      hasChanges = true;
    }

    const endDye = this.resolveSharedEndpoint(params.end, params.hexEnd);
    if (endDye) {
      this.selectedDyes[1] = endDye;
      hasChanges = true;
    }

    // A rejected start (legacy itemID, bad hex) with a good end would leave a
    // hole at [0]; the endpoint list is positional and cannot hold one.
    if (hasChanges) {
      this.selectedDyes = this.selectedDyes.filter((d): d is Dye => Boolean(d));
    }

    // BUG-019 (2026-10-04 deep-dive): the shared settings used to reach only
    // this tool's fields (and its own v3 keys), so the controller's next
    // broadcast — any sidebar touch — reverted them. Each one is validated
    // first, so a malformed link cannot overwrite a saved setting.
    const settings: Partial<GradientConfig> = {};

    // Step count — the shared range is the slider's range, 3–12, whole steps
    if (
      typeof params.steps === 'number' &&
      Number.isInteger(params.steps) &&
      params.steps >= STEP_MIN &&
      params.steps <= STEP_MAX
    ) {
      settings.stepCount = params.steps;
    }

    // Interpolation mode (color space)
    if (isInterpolationMode(params.interpolation)) {
      settings.interpolation = params.interpolation;
    }

    // Matching algorithm — a current or retired method name only. An unknown
    // value would normalize to the suite default and replace the user's own.
    if (
      typeof params.algo === 'string' &&
      (isMatchingMethod(params.algo) || Object.hasOwn(LEGACY_MATCHING_METHOD_MAP, params.algo))
    ) {
      settings.matchingMethod = normalizeMatchingMethod(params.algo);
    }

    if (Object.keys(settings).length > 0) {
      // Apply locally first, then write the controller once. This runs before
      // onMount subscribes, and even if it ever ran after, the echoed config
      // would find nothing changed.
      this.stepCount = settings.stepCount ?? this.stepCount;
      this.colorSpace = settings.interpolation ?? this.colorSpace;
      this.matchingMethod = settings.matchingMethod ?? this.matchingMethod;
      ConfigController.getInstance().setConfig('gradient', settings);
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
    // BUG-093 (2026-10-04 deep-dive): update() re-runs this on every language
    // switch. A replaced child keeps its service subscriptions until it is
    // destroyed, so each switch used to leave one more detached MarketBoard
    // relaying server changes into this tool.
    this.destroyChildComponents();

    this.renderLeftPanel();
    this.renderRightPanel();

    if (this.options.drawerContent) {
      this.renderDrawerContent();
    }

    this.element = this.container;
  }

  /**
   * Destroy the child components a render is about to rebuild — the same
   * step HarmonyTool takes — and, from destroy(), the last set.
   */
  private destroyChildComponents(): void {
    // Desktop components
    this.dyeSelector?.destroy();
    this.dyeSelector = null;
    this.marketBoard?.destroy();
    this.marketBoard = null;
    this.dyeSelectionPanel?.destroy();
    this.dyeSelectionPanel = null;
    this.settingsPanel?.destroy();
    this.settingsPanel = null;
    this.marketPanel?.destroy();
    this.marketPanel = null;

    // Mobile drawer components
    this.mobileDyeSelector?.destroy();
    this.mobileDyeSelector = null;
    this.mobileMarketBoard?.destroy();
    this.mobileMarketBoard = null;
    this.mobileDyeSelectionPanel?.destroy();
    this.mobileDyeSelectionPanel = null;
    this.mobileSettingsPanel?.destroy();
    this.mobileSettingsPanel = null;
    this.mobileMarketPanel?.destroy();
    this.mobileMarketPanel = null;
  }

  bindEvents(): void {
    // Event bindings handled in child components
  }

  onMount(): void {
    // Load from share URL first (overrides the saved dyes and settings if URL
    // params present) — and before the config subscription below, so its
    // ConfigController write is not echoed back into setConfig
    this.loadFromShareUrl();

    // Sync DyeSelector with loaded dyes (from URL or localStorage)
    if (this.selectedDyes.length > 0) {
      this.dyeSelector?.setSelectedDyes(this.selectedDyes);
      this.mobileDyeSelector?.setSelectedDyes(this.selectedDyes);
      this.updateSelectedDyesDisplay();
      this.updateMobileSelectedDyesDisplay();
    }

    // Subscribe to language changes (only in onMount, NOT bindEvents - avoids infinite loop)
    this.subs.add(
      LanguageService.subscribe(() => {
        this.update();
      })
    );

    // Subscribe to config changes from V4 ConfigSidebar
    const configController = ConfigController.getInstance();
    this.subs.add(
      configController.subscribe('gradient', (config) => {
        this.setConfig(config);
      })
    );

    // Subscribe to market config changes
    this.subs.add(
      configController.subscribe('market', (config) => {
        this.setConfig(config);
      })
    );

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

    logger.info('[GradientTool] Mounted');
  }

  onUpdate(): void {
    // update() rebuilds both panels (e.g. on language change) — repopulate
    // the 4C workspace from the current state instead of leaving the fresh
    // shell in its empty default.
    this.updateInterpolation();
  }

  destroy(): void {
    this.destroyChildComponents();

    this.selectedDyes = [];
    this.currentSteps = [];

    super.destroy();
    logger.info('[GradientTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   * Accepts both GradientConfig and MarketConfig properties
   *
   * Apply-only: this is the ConfigController subscriber (and the v4-layout
   * forward's target, which re-delivers every sidebar change), so it never
   * writes the controller or storage, and an unchanged value is a no-op.
   */
  public setConfig(config: Partial<GradientConfig> & Partial<MarketConfig>): void {
    let needsUpdate = false;

    // Handle preventDuplicates
    if (
      config.preventDuplicates !== undefined &&
      config.preventDuplicates !== this.preventDuplicates
    ) {
      this.preventDuplicates = config.preventDuplicates;
      needsUpdate = true;
      logger.info(`[GradientTool] setConfig: preventDuplicates -> ${config.preventDuplicates}`);
    }

    // Handle stepCount — clamped the same way as the constructor's seed
    const stepCount = toStepCount(config.stepCount);
    if (stepCount !== null && stepCount !== this.stepCount) {
      this.stepCount = stepCount;
      // A pin is an index into the ramp; re-counting moves every position,
      // so the pins no longer mean what the user set them to.
      this.pinnedSteps.clear();
      needsUpdate = true;
      logger.info(`[GradientTool] setConfig: stepCount -> ${stepCount}`);

      // Update desktop display
      if (this.stepValueDisplay) {
        this.stepValueDisplay.textContent = String(stepCount);
      }
      // Update mobile display
      if (this.mobileStepValueDisplay) {
        this.mobileStepValueDisplay.textContent = String(stepCount);
      }
    }

    // Handle interpolation (maps to colorSpace); an unknown mode is ignored
    if (isInterpolationMode(config.interpolation) && config.interpolation !== this.colorSpace) {
      this.colorSpace = config.interpolation;
      needsUpdate = true;
      logger.info(`[GradientTool] setConfig: interpolation -> ${config.interpolation}`);
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

    // Handle dyeFilters changes
    if (config.dyeFilters) {
      const newFilters = { ...this.dyeFiltersConfig, ...config.dyeFilters };
      const filtersChanged = JSON.stringify(newFilters) !== JSON.stringify(this.dyeFiltersConfig);
      if (filtersChanged) {
        this.dyeFiltersConfig = newFilters;
        needsUpdate = true;
        logger.info('[GradientTool] setConfig: dyeFilters updated');
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

    // Section 3: Market Board (collapsible)
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
        detailText += ` â€¢ ${priceText}`;
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
        min: String(STEP_MIN),
        max: String(STEP_MAX),
        value: String(this.stepCount),
        style: 'accent-color: var(--theme-primary);',
      },
    }) as HTMLInputElement;

    this.on(stepsInput, 'input', () => {
      this.stepCount = parseInt(stepsInput.value, 10);
      if (this.stepValueDisplay) {
        this.stepValueDisplay.textContent = String(this.stepCount);
      }
      // Applied above first, so the controller's synchronous echo is a no-op
      ConfigController.getInstance().setConfig('gradient', { stepCount: this.stepCount });
      // Pins are ramp indices — a new count re-anchors them somewhere the
      // user never chose, so they clear with the count.
      this.pinnedSteps.clear();
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
      // Applied above first, so the controller's synchronous echo is a no-op
      ConfigController.getInstance().setConfig('gradient', { interpolation: this.colorSpace });
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

    // Workspace shell (4C main flow). Padding lives in the injected
    // stylesheet so the mobile media rule can win — inline padding would
    // always override it.
    // Note: overflow-y handled by parent layout shell - do NOT add it here to avoid double scrollbars
    right.classList.add('v5-grad-workspace');
    right.setAttribute(
      'style',
      'display: flex; flex-direction: column; width: 100%; height: 100%; box-sizing: border-box;'
    );

    // Hover + media rules inline styles cannot express. The tool renders
    // inside the shell's shadow root, so this <style> scopes there.
    const styles = document.createElement('style');
    styles.textContent = `
      .v5-grad-workspace { padding: 32px; }
      .v5-grad-ep-card:hover { border-color: ${ACCENT_BORDER} !important; }
      .v5-grad-swap:hover:not([disabled]) { background: var(--theme-card-hover); }
      .v5-grad-pin:hover:not([disabled]) { background: var(--theme-card-hover); }
      .v5-grad-row:hover { border-color: ${ACCENT_BORDER} !important; }
      @media (max-width: 768px) {
        .v5-grad-workspace { padding: 16px 12px 24px; }
      }
    `;
    right.appendChild(styles);

    // Content wrapper with max-width to prevent over-expansion on ultrawide monitors
    const contentWrapper = this.createElement('div', {
      attributes: {
        style:
          'max-width: 1200px; margin: 0 auto; width: 100%; display: flex; flex-direction: column; flex: 1; min-height: 0;',
      },
    });

    // One centred column for the endpoints row + pin rail (drawn geometry)
    const flowColumn = this.createElement('div', {
      attributes: { style: 'width: 100%; max-width: 720px; margin: 0 auto;' },
    });

    // ENDPOINTS ROW: FROM card | 44px swap | TO card
    this.endpointsRowContainer = this.createElement('div', {
      attributes: {
        'data-testid': 'gradient-endpoints-row',
        style:
          'flex-shrink: 0; display: flex; align-items: stretch; gap: 8px; padding: 4px 0 10px;',
      },
    });
    flowColumn.appendChild(this.endpointsRowContainer);

    // THE PIN RAIL: header (PINNED · count) over [44px pin column | step rows]
    this.railSection = this.createElement('div', {
      attributes: {
        'data-testid': 'gradient-pin-rail',
        style: 'display: none; margin-bottom: 14px;',
      },
    });
    const railHeader = this.createElement('div', {
      attributes: {
        title: LanguageService.t('gradient.pinnedDesc'),
        style:
          'display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 9px;',
      },
    });
    railHeader.appendChild(
      this.createElement('span', {
        textContent: LanguageService.t('gradient.pinned'),
        attributes: {
          style:
            'font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--theme-text-muted);',
        },
      })
    );
    this.railPinCount = this.createElement('span', {
      attributes: {
        style: 'font-family: var(--font-mono); font-size: 10px; color: var(--theme-text-muted);',
      },
    });
    railHeader.appendChild(this.railPinCount);
    this.railSection.appendChild(railHeader);

    // Ideal over achievable: the smooth ramp you asked for, directly above the
    // one the dye database can actually build. Reading down a column shows
    // where the palette runs out — the rail's per-row cells say the same thing
    // one step at a time, but the divergence is a shape, not a list.
    this.bandContainer = this.createElement('div', {
      attributes: { style: 'margin-bottom: 10px;' },
    });
    this.railSection.appendChild(this.bandContainer);

    const railBody = this.createElement('div', {
      attributes: { style: 'display: flex; gap: 8px;' },
    });
    this.pinColumn = this.createElement('div', {
      attributes: {
        style:
          'width: 44px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; padding-top: 2px;',
      },
    });
    this.rowsColumn = this.createElement('div', {
      attributes: {
        style: 'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px;',
      },
    });
    railBody.appendChild(this.pinColumn);
    railBody.appendChild(this.rowsColumn);
    this.railSection.appendChild(railBody);
    flowColumn.appendChild(this.railSection);
    contentWrapper.appendChild(flowColumn);

    // Results section container
    const resultsSection = this.createElement('div', {
      attributes: {
        'data-testid': 'gradient-results-section',
        style:
          'width: 100%; display: flex; flex-direction: column; position: relative; flex: 1; min-height: 0;',
      },
    });

    // FOCUS header: uppercase focus label left; drift summary + pin controls
    // + share button in the right slot. Hidden until dyes are selected.
    this.resultsHeaderContainer = this.createElement('div', {
      className: 'section-header',
      attributes: {
        style:
          'width: 100%; display: none; justify-content: space-between; align-items: center; gap: 10px;',
      },
    });
    this.resultsHeader = this.createElement('span', {
      textContent: LanguageService.t('gradient.gradientResults'),
      attributes: {
        style:
          'font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--theme-text-muted); white-space: nowrap;',
      },
    });
    this.summaryCluster = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: center; gap: 10px; min-width: 0; flex-wrap: wrap; justify-content: flex-end;',
      },
    });

    // Export: the 4C spec's header action, on the shared sheet. A ramp is the
    // one output here people paste into a stylesheet, and until 5.0 this tool
    // had no export at all — only its locale string existed.
    // Held as a field, not appended here: updateFocusHeader() clears the
    // cluster on every recalculation, so anything parked at construction time
    // is gone by the first render. It re-appends this alongside Share.
    this.exportButton = this.createElement('button', {
      textContent: LanguageService.t('common.export'),
      attributes: {
        type: 'button',
        'data-testid': 'gradient-export',
        style: [
          'background: none; border: none; color: var(--theme-primary);',
          'font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;',
          'text-transform: uppercase; letter-spacing: 0.5px;',
        ].join(' '),
      },
    });
    this.on(this.exportButton, 'click', () => this.openGradientExport());

    // Share Button - v4-share-button custom element (lives in the header's
    // right slot; share URL write path)
    this.shareButton = document.createElement('v4-share-button') as ShareButton;
    this.shareButton.tool = 'gradient';
    this.shareButton.shareParams = this.getShareParams();
    // Disabled from the first paint: without this the button sits
    // enabled with empty params until the first update, and a click
    // there fails ShareService validation instead of being inert.
    this.shareButton.disabled = !this.startDye || !this.endDye;
    this.summaryCluster.appendChild(this.shareButton);

    this.resultsHeaderContainer.appendChild(this.resultsHeader);
    this.resultsHeaderContainer.appendChild(this.summaryCluster);
    resultsSection.appendChild(this.resultsHeaderContainer);

    // Matches container: compact result cards as direct grid children
    this.matchesContainer = this.createElement('div', {
      className: 'v5-results-grid',
      attributes: {
        'data-testid': 'gradient-matches-container',
        style: 'padding: 4px 0 20px; display: none;',
      },
    });

    // Empty state message (inside results area)
    // Shared empty-state treatment — see v4-layout.ts for the injected rules.
    this.emptyStateContainer = this.createElement('div', {
      className: 'empty-state-message v5-empty-state',
      attributes: {
        'data-testid': 'gradient-empty-state',
      },
    });
    this.emptyStateContainer.innerHTML = `
      <div class="v5-empty-state-icon" aria-hidden="true">${ICON_TOOL_GRADIENT}</div>
      <div class="v5-empty-state-title">${LanguageService.t('gradient.setStartAndEnd')}</div>
      <div class="v5-empty-state-text">${LanguageService.t('gradient.clickPlusButtons')}</div>
    `;

    resultsSection.appendChild(this.emptyStateContainer);
    resultsSection.appendChild(this.matchesContainer);
    contentWrapper.appendChild(resultsSection);

    right.appendChild(contentWrapper);

    // Populate the endpoint cards for the current selection
    this.updateEndpointCards();
  }

  /**
   * ENDPOINTS ROW (4C): FROM card + swap + TO card. Clicking a card arms
   * that endpoint — the dye-palette drawer's next selection lands in it via
   * the existing selectDye() path. Swap exchanges start/end; pins clear via
   * the endpoints-key check in calculateInterpolation().
   */
  private updateEndpointCards(): void {
    if (!this.endpointsRowContainer) return;
    clearContainer(this.endpointsRowContainer);

    this.endpointsRowContainer.appendChild(this.buildEndpointCard(0));

    const canSwap = Boolean(this.startDye && this.endDye);
    const swapBtn = this.createElement('button', {
      className: 'v5-grad-swap',
      attributes: {
        type: 'button',
        'data-testid': 'gradient-swap-button',
        title: LanguageService.t('gradient.swap'),
        'aria-label': LanguageService.t('gradient.swap'),
        ...(canSwap ? {} : { disabled: '' }),
        style: `width: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 11px; border: 1px solid var(--theme-border); background: var(--theme-background-secondary); color: var(--theme-text-muted); cursor: ${canSwap ? 'pointer' : 'default'}; opacity: ${canSwap ? '1' : '0.45'};`,
      },
    }) as HTMLButtonElement;
    swapBtn.innerHTML = ICON_SWAP_ENDS;
    if (canSwap) {
      this.on(swapBtn, 'click', () => {
        const start = this.selectedDyes[0];
        this.selectedDyes[0] = this.selectedDyes[1];
        this.selectedDyes[1] = start;
        logger.info('[GradientTool] Swapped start and end dyes');
        this.updateAfterSlotSelection();
      });
    }
    this.endpointsRowContainer.appendChild(swapBtn);

    this.endpointsRowContainer.appendChild(this.buildEndpointCard(1));
  }

  /** One FROM/TO endpoint card (drawn: 52px, surface, 30px swatch, mono label). */
  private buildEndpointCard(slot: 0 | 1): HTMLElement {
    const dye = slot === 0 ? this.startDye : this.endDye;
    const active = this.activeEndpoint === slot;
    const card = this.createElement('button', {
      className: 'v5-grad-ep-card',
      attributes: {
        type: 'button',
        'data-testid': slot === 0 ? 'gradient-start-node' : 'gradient-end-node',
        title: LanguageService.t(
          slot === 0 ? 'gradient.clickToSelectStart' : 'gradient.clickToSelectEnd'
        ),
        style: `flex: 1; min-width: 0; display: flex; align-items: center; gap: 9px; min-height: 52px; padding: 7px 9px; border-radius: 11px; cursor: pointer; text-align: left; font-family: inherit; background: var(--theme-card-background); border: 1px solid ${active ? ACCENT_BORDER : 'var(--theme-border)'};`,
      },
    }) as HTMLButtonElement;

    const swatch = this.createElement('span', {
      attributes: {
        style: dye
          ? `width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; background: ${dye.hex};`
          : 'width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--theme-border); color: var(--theme-text-muted); font-size: 15px; font-weight: 300;',
      },
    });
    if (!dye) swatch.textContent = '+';
    card.appendChild(swatch);

    const col = this.createElement('span', {
      attributes: {
        style: 'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px;',
      },
    });
    col.appendChild(
      this.createElement('span', {
        textContent: LanguageService.t(slot === 0 ? 'gradient.fromLabel' : 'gradient.toLabel'),
        attributes: {
          style:
            'font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 0.8px; color: var(--theme-text-muted);',
        },
      })
    );
    col.appendChild(
      this.createElement('span', {
        textContent: dye
          ? LanguageService.getDyeName(dye.itemID) || dye.name
          : LanguageService.t('gradient.selectColor'),
        attributes: {
          style: `font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${dye ? 'var(--theme-text)' : 'var(--theme-text-muted)'};`,
        },
      })
    );
    card.appendChild(col);

    this.on(card, 'click', () => {
      // Arm this endpoint: the next palette selection replaces it
      this.activeEndpoint = slot;
      this.updateEndpointCards();
    });
    return card;
  }

  /**
   * THE PIN RAIL (4C): one 44px pin tile and one 44px step row per gradient
   * step. Endpoints carry dashed anchor tiles (already fixed); middle steps
   * carry pin toggles. Each row butts the ideal band against the matched dye
   * fill and prints the step's drift.
   */
  /**
   * The dual band: ideal ramp on top, achievable (matched dyes) beneath, both
   * as equal-width segments so the columns line up step for step.
   */
  private renderDualBand(): void {
    if (!this.bandContainer) return;
    clearContainer(this.bandContainer);
    if (this.currentSteps.length === 0) return;

    const band = (colors: string[], radius: string): HTMLElement => {
      const row = this.createElement('div', {
        attributes: {
          style: `display: flex; height: 18px; border-radius: ${radius}; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(127,127,127,0.22);`,
        },
      });
      for (const c of colors) {
        row.appendChild(
          this.createElement('span', {
            attributes: { style: `flex: 1; background: ${c};` },
          })
        );
      }
      return row;
    };

    const ideal = this.currentSteps.map((s) => s.theoreticalColor);
    const achievable = this.currentSteps.map(
      (s) => s.matchedDye?.hex ?? 'var(--theme-background-secondary)'
    );

    const wrap = this.createElement('div', {
      attributes: { style: 'display: flex; flex-direction: column; gap: 2px;' },
    });
    wrap.appendChild(band(ideal, '8px 8px 0 0'));
    wrap.appendChild(band(achievable, '0 0 8px 8px'));

    const legend = this.createElement('div', {
      attributes: {
        style: `display: flex; gap: 10px; margin-top: 4px; font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted);`,
      },
    });
    legend.appendChild(
      this.createElement('span', { textContent: LanguageService.t('gradient.bandIdeal') })
    );
    legend.appendChild(
      this.createElement('span', { textContent: LanguageService.t('gradient.bandAchievable') })
    );

    this.bandContainer.appendChild(wrap);
    this.bandContainer.appendChild(legend);
  }

  /**
   * Open the shared export sheet over the ramp. Each step exports as a pair:
   * the ideal interpolated colour and the dye that step resolved to — the same
   * ideal-over-achievable divergence the dual band draws, in text form.
   */
  private openGradientExport(): void {
    openExportSheet({
      tool: 'gradient',
      title: LanguageService.t('gradient.gradientResults'),
      meta: [
        LanguageService.tInterpolate('gradient.exportMeta', {
          space: this.colorSpace,
          n: this.currentSteps.length,
        }),
      ],
      entries: this.currentSteps.map((step, index) => ({
        key: `step-${index + 1}`,
        source: step.theoreticalColor,
        dye: step.matchedDye,
        delta: step.distance,
      })),
    });
  }

  private renderPinRail(): void {
    if (!this.railSection || !this.pinColumn || !this.rowsColumn) return;
    this.renderDualBand();

    clearContainer(this.pinColumn);
    clearContainer(this.rowsColumn);

    if (this.currentSteps.length === 0 || !this.startDye || !this.endDye) {
      this.railSection.style.display = 'none';
      return;
    }
    this.railSection.style.display = '';

    if (this.railPinCount) {
      this.railPinCount.textContent =
        this.pinnedSteps.size > 0
          ? LanguageService.tInterpolate('gradient.pinnedCount', { n: this.pinnedSteps.size })
          : LanguageService.t('gradient.pinStep');
    }

    const dp = BAND_METHOD_DP[this.matchingMethod] ?? 1;
    const last = this.currentSteps.length - 1;

    for (let i = 0; i < this.currentSteps.length; i++) {
      const step = this.currentSteps[i];
      const isEndpoint = i === 0 || i === last;
      const isPinned = this.pinnedSteps.has(i);
      const isFocused = this.focusedStep === i;

      // ---- pin column tile ----
      if (isEndpoint) {
        // Dashed anchor: an endpoint is already fixed, never pinnable
        const anchor = this.createElement('span', {
          attributes: {
            title: LanguageService.t('gradient.endAnchor'),
            style:
              'width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 9px; border: 1px dashed var(--theme-border); color: var(--theme-text-muted);',
          },
        });
        anchor.innerHTML = ICON_END_ANCHOR;
        this.pinColumn.appendChild(anchor);
      } else {
        const canPin = isPinned || step.matchedDye !== null;
        const pinBtn = this.createElement('button', {
          className: 'v5-grad-pin',
          attributes: {
            type: 'button',
            title: LanguageService.t(isPinned ? 'gradient.unpinStep' : 'gradient.pinStep'),
            'aria-pressed': isPinned ? 'true' : 'false',
            ...(canPin ? {} : { disabled: '' }),
            style: `width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 9px; cursor: ${canPin ? 'pointer' : 'default'}; border: 1px solid ${isPinned ? ACCENT_BORDER : 'var(--theme-border)'}; background: ${isPinned ? ACCENT_SOFT : 'transparent'}; color: ${isPinned ? 'var(--theme-primary)' : 'var(--theme-text-muted)'}; opacity: ${canPin ? '1' : '0.45'};`,
          },
        }) as HTMLButtonElement;
        pinBtn.innerHTML = isPinned ? ICON_PIN_FILLED : ICON_PIN_OUTLINE;
        if (canPin) {
          const stepIndex = i;
          const stepDye = step.matchedDye;
          this.on(pinBtn, 'click', () => {
            if (this.pinnedSteps.has(stepIndex)) {
              this.pinnedSteps.delete(stepIndex);
            } else if (stepDye) {
              this.pinnedSteps.set(stepIndex, stepDye);
            }
            this.focusedStep = stepIndex;
            this.calculateInterpolation();
            this.renderPinRail();
            this.updateFocusHeader();
            this.renderIntermediateMatches();
          });
        }
        this.pinColumn.appendChild(pinBtn);
      }

      // ---- step row: [ideal band | matched dye fill (name + drift)] ----
      const dye = step.matchedDye;
      const name = dye ? LanguageService.getDyeName(dye.itemID) || dye.name : '—';
      const deLabel = dye ? step.distance.toFixed(dp) : '';
      const ink = dye ? this.onColorInk(dye.hex) : 'var(--theme-text-muted)';
      const row = this.createElement('button', {
        className: 'v5-grad-row',
        attributes: {
          type: 'button',
          'data-gradient-rail-step': String(i + 1),
          title: dye ? `${name} · ${deLabel}` : LanguageService.t('gradient.noMatchesFound'),
          style: `display: flex; align-items: stretch; width: 100%; height: 44px; padding: 0; overflow: hidden; border-radius: 8px; cursor: pointer; text-align: left; font-family: inherit; border: 1px solid ${isFocused ? ACCENT_BORDER : 'var(--theme-border)'}; box-shadow: ${isFocused ? `0 0 0 2px ${ACCENT_SOFT}` : 'none'}; background: var(--theme-card-background);`,
        },
      }) as HTMLButtonElement;

      row.appendChild(
        this.createElement('span', {
          attributes: {
            style: `width: 40px; flex-shrink: 0; background: ${step.theoreticalColor};`,
          },
        })
      );

      const fill = this.createElement('span', {
        attributes: {
          style: `flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 0 10px; background: ${dye ? dye.hex : 'var(--theme-background-secondary)'};`,
        },
      });
      fill.appendChild(
        this.createElement('span', {
          textContent: name,
          attributes: {
            style: `font-size: 11.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: ${ink};`,
          },
        })
      );
      if (deLabel) {
        fill.appendChild(
          this.createElement('span', {
            textContent: deLabel,
            attributes: {
              style: `font-family: var(--font-mono); font-size: 10px; margin-left: auto; flex-shrink: 0; color: ${ink}; opacity: 0.72;`,
            },
          })
        );
      }
      row.appendChild(fill);

      const stepIndex = i;
      this.on(row, 'click', () => {
        this.focusedStep = stepIndex;
        this.renderPinRail();
        this.updateFocusHeader();
        this.applyFocusToCards();
      });
      this.rowsColumn.appendChild(row);
    }
  }

  /**
   * FOCUS header: uppercase focus label (STEP n when a row is focused) on
   * the left; the avg-drift summary, pinned count + Clear pins, and the
   * share button in the right slot.
   */
  private updateFocusHeader(): void {
    if (!this.resultsHeader || !this.summaryCluster) return;

    this.resultsHeader.textContent =
      this.focusedStep !== null && this.currentSteps[this.focusedStep]
        ? LanguageService.tInterpolate('gradient.stepN', { n: this.focusedStep + 1 })
        : LanguageService.t('gradient.gradientResults');

    clearContainer(this.summaryCluster);

    if (this.currentSteps.length > 0) {
      const drifts = this.currentSteps.filter((s) => s.matchedDye).map((s) => s.distance);
      const avgRaw = drifts.length ? drifts.reduce((a, b) => a + b, 0) / drifts.length : 0;
      const avgDp = BAND_METHOD_DP[this.matchingMethod] ?? 1;
      this.summaryCluster.appendChild(
        this.createElement('span', {
          textContent: LanguageService.tInterpolate('gradient.avgDriftValue', {
            v: avgRaw.toFixed(avgDp),
          }),
          attributes: {
            style: `font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.5px; white-space: nowrap; color: ${this.driftTierColor(avgRaw)};`,
          },
        })
      );
      // The average hides the lurch: a ramp averaging ΔE 4 can still have one
      // step at 25, and that worst step is what decides whether it reads
      // smooth. Print it beside the average, in its own tier colour.
      if (drifts.length > 0) {
        const maxRaw = Math.max(...drifts);
        this.summaryCluster.appendChild(
          this.createElement('span', {
            textContent: LanguageService.tInterpolate('gradient.maxDriftValue', {
              v: maxRaw.toFixed(avgDp),
            }),
            attributes: {
              title: LanguageService.t('gradient.maxDriftDesc'),
              style: `font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.5px; white-space: nowrap; color: ${this.driftTierColor(maxRaw)};`,
            },
          })
        );
      }
      if (this.pinnedSteps.size > 0) {
        this.summaryCluster.appendChild(
          this.createElement('span', {
            textContent: LanguageService.tInterpolate('gradient.pinnedCount', {
              n: this.pinnedSteps.size,
            }),
            attributes: {
              title: LanguageService.t('gradient.pinnedDesc'),
              style: `font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 5px; white-space: nowrap; background: ${ACCENT_SOFT}; color: var(--theme-primary);`,
            },
          })
        );
        const clearBtn = this.createElement('button', {
          textContent: LanguageService.t('gradient.clearPins'),
          attributes: {
            type: 'button',
            style:
              'font-size: 11px; padding: 3px 9px; border-radius: 6px; border: 1px solid var(--theme-border); background: transparent; color: var(--theme-text-muted); cursor: pointer; white-space: nowrap;',
          },
        }) as HTMLButtonElement;
        this.on(clearBtn, 'click', () => {
          this.pinnedSteps.clear();
          this.calculateInterpolation();
          this.renderPinRail();
          this.updateFocusHeader();
          this.renderIntermediateMatches();
        });
        this.summaryCluster.appendChild(clearBtn);
      }
      // Only offered once there is a ramp to export.
      if (this.exportButton) {
        this.summaryCluster.appendChild(this.exportButton);
      }
    }

    if (this.shareButton) {
      this.summaryCluster.appendChild(this.shareButton);
    }
  }

  /** Drift value → tier colour via the calibrated MATCH bands (5.0 ramps). */
  private driftTierColor(value: number): string {
    let dark = true;
    try {
      dark = ThemeService.isDarkMode();
    } catch {
      // jsdom/unit-test environments stub @services/index without ThemeService
    }
    const ramp = dark ? TIER_RAMP_DARK : TIER_RAMP_LIGHT;
    const tier = classifyBandTier(value, this.matchingMethod, 'match');
    return ramp[Math.min(tier, ramp.length - 1)];
  }

  /** On-colour ink for a dye fill: simple luminance best-of (mixer's cut). */
  private onColorInk(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.45 ? 'rgba(10, 10, 10, 0.9)' : 'rgba(255, 255, 255, 0.92)';
  }

  /** Reflect the focused rail step onto the compact result cards below. */
  private applyFocusToCards(): void {
    for (const card of this.v4ResultCards) {
      const cardStep = Number(card.getAttribute('data-gradient-step')) - 1;
      const focused = this.focusedStep !== null && cardStep === this.focusedStep;
      card.toggleAttribute('selected', focused);
      if (focused) {
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }

  /**
   * Update all results
   */
  private updateInterpolation(): void {
    // Endpoint cards always reflect the current selection state
    this.updateEndpointCards();

    if (!this.startDye || !this.endDye) {
      this.showEmptyState(true);
      this.currentSteps = [];
      this.focusedStep = null;
      this.renderPinRail();
      return;
    }

    this.showEmptyState(false);
    this.calculateInterpolation();
    if (this.focusedStep !== null && this.focusedStep >= this.currentSteps.length) {
      this.focusedStep = null;
    }
    this.renderPinRail();
    this.updateFocusHeader();
    this.renderIntermediateMatches();
  }

  /**
   * Show/hide empty state, pin rail and matches container
   */
  private showEmptyState(show: boolean): void {
    if (this.emptyStateContainer) {
      this.emptyStateContainer.style.display = show ? 'flex' : 'none';
    }
    if (this.matchesContainer) {
      // '' lets the .v5-results-grid class rule (display: grid) apply
      this.matchesContainer.style.display = show ? 'none' : '';
    }
    // Hide results header when showing empty state
    if (this.resultsHeaderContainer) {
      this.resultsHeaderContainer.style.display = show ? 'none' : 'flex';
    }
    if (show && this.railSection) {
      this.railSection.style.display = 'none';
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

    // A custom endpoint has no stainID — share it as the declared bare-colour
    // slot (`hexStart`/`hexEnd`) instead of an invalid `start=0` that fails
    // validation and loses the colour. The two params are mutually exclusive.
    const start =
      this.startDye.stainID !== null
        ? { start: this.startDye.stainID }
        : { hexStart: this.startDye.hex.replace('#', '') };
    const end =
      this.endDye.stainID !== null
        ? { end: this.endDye.stainID }
        : { hexEnd: this.endDye.hex.replace('#', '') };

    return {
      ...start,
      ...end,
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
  /** Interpolate between two hexes at t in the active colour space. */
  private interpolateInSpace(startHex: string, endHex: string, t: number): string {
    switch (this.colorSpace) {
      case 'rgb': {
        const startRgb = ColorService.hexToRgb(startHex);
        const endRgb = ColorService.hexToRgb(endHex);
        const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * t);
        const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * t);
        const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * t);
        return ColorService.rgbToHex(r, g, b);
      }
      case 'hsv': {
        const startHsv = ColorService.hexToHsv(startHex);
        const endHsv = ColorService.hexToHsv(endHex);
        let hueDiff = endHsv.h - startHsv.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const h = (startHsv.h + hueDiff * t + 360) % 360;
        const s = startHsv.s + (endHsv.s - startHsv.s) * t;
        const v = startHsv.v + (endHsv.v - startHsv.v) * t;
        return ColorService.hsvToHex(h, s, v);
      }
      case 'lab': {
        const startLab = ColorService.hexToLab(startHex);
        const endLab = ColorService.hexToLab(endHex);
        const L = startLab.L + (endLab.L - startLab.L) * t;
        const a = startLab.a + (endLab.a - startLab.a) * t;
        const b = startLab.b + (endLab.b - startLab.b) * t;
        return ColorService.labToHex(L, a, b);
      }
      case 'oklch': {
        const startOklch = ColorService.hexToOklch(startHex);
        const endOklch = ColorService.hexToOklch(endHex);
        let hueDiff = endOklch.h - startOklch.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const L = startOklch.L + (endOklch.L - startOklch.L) * t;
        const C = startOklch.C + (endOklch.C - startOklch.C) * t;
        const h = (startOklch.h + hueDiff * t + 360) % 360;
        return ColorService.oklchToHex(L, C, h);
      }
      case 'lch': {
        const startLch = ColorService.hexToLch(startHex);
        const endLch = ColorService.hexToLch(endHex);
        let hueDiff = endLch.h - startLch.h;
        if (hueDiff > 180) hueDiff -= 360;
        if (hueDiff < -180) hueDiff += 360;
        const L = startLch.L + (endLch.L - startLch.L) * t;
        const C = startLch.C + (endLch.C - startLch.C) * t;
        const h = (startLch.h + hueDiff * t + 360) % 360;
        return ColorService.lchToHex(L, C, h);
      }
      default:
        return ColorService.hsvToHex(0, 0, 50);
    }
  }

  private calculateInterpolation(): void {
    if (!this.startDye || !this.endDye) {
      this.currentSteps = [];
      return;
    }

    const result: InterpolationStep[] = [];
    const steps = this.stepCount;

    // 4C: changing an endpoint redraws a different ramp â€” old pins would
    // anchor a curve they were never part of.
    const endpointsKey = `${this.startDye.id}-${this.endDye.id}`;
    if (endpointsKey !== this.lastEndpointsKey) {
      this.lastEndpointsKey = endpointsKey;
      this.pinnedSteps.clear();
    }

    // 4C: pins on endpoints or beyond the ramp are meaningless â€” drop them.
    for (const index of [...this.pinnedSteps.keys()]) {
      if (index <= 0 || index >= steps - 1) this.pinnedSteps.delete(index);
    }

    // 4C Pin rail: anchors are the endpoints plus every pinned step's matched
    // dye. Each segment between consecutive anchors re-interpolates on its
    // own, so the curve passes through colours that actually exist.
    const anchors: Array<{ index: number; hex: string }> = [
      { index: 0, hex: this.startDye.hex },
      ...[...this.pinnedSteps.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([index, dye]) => ({ index, hex: dye.hex })),
      { index: steps - 1, hex: this.endDye.hex },
    ];

    // Dyes already spoken for: the endpoints and every pinned dye up front,
    // then each free step's match as the ramp resolves (see the dedupe branch
    // below). BUG-020 (2026-10-04 deep-dive): pins used to join only when the
    // loop reached them, so a free step BEFORE a pin — which interpolates
    // toward that pin's own hex — could match the pinned dye undeduplicated.
    const usedDyeIds = new Set<number>([
      this.startDye.id,
      this.endDye.id,
      ...[...this.pinnedSteps.values()].map((dye) => dye.id),
    ]);

    for (let i = 0; i < steps; i++) {
      // 4C fix: the drawn endpoint rows ARE the selected endpoint dyes at
      // drift 0.0 — start/end dyes are only excluded from MIDDLE-step
      // matching, never from their own steps.
      if (i === 0 || i === steps - 1) {
        const endpointDye = i === 0 ? this.startDye : this.endDye;
        result.push({
          position: steps === 1 ? 0 : i / (steps - 1),
          theoreticalColor: endpointDye.hex,
          matchedDye: endpointDye,
          distance: 0,
        });
        continue;
      }

      let lower = anchors[0];
      let upper = anchors[anchors.length - 1];
      for (const anchor of anchors) {
        if (anchor.index <= i && anchor.index >= lower.index) lower = anchor;
        if (anchor.index >= i && anchor.index <= upper.index) upper = anchor;
      }
      const span = upper.index - lower.index;
      const t = span === 0 ? 0 : (i - lower.index) / span;
      const theoreticalColor = this.interpolateInSpace(lower.hex, upper.hex, t);

      // 4C: a pinned step is no longer aiming at anything â€” its matched dye
      // IS the anchor and its drift reads 0.0. Already in usedDyeIds (seeded
      // above), and never deduped itself, even against another pin.
      const pinnedDye = this.pinnedSteps.get(i);
      if (pinnedDye) {
        result.push({
          position: steps === 1 ? 0 : i / (steps - 1),
          theoreticalColor,
          matchedDye: pinnedDye,
          distance: 0,
        });
        continue;
      }

      // Middle steps hunt for the closest dye; only they exclude the
      // endpoint dyes (the endpoints resolve to themselves above)
      const excludeIds = [this.startDye.id, this.endDye.id];
      let matchedDye = dyeService.findClosestDye(theoreticalColor, {
        excludeIds,
        matchingMethod: this.matchingMethod,
      });

      // Apply filters if available
      if (matchedDye && isDyeExcluded(this.dyeFiltersConfig, matchedDye)) {
        // Find the next closest non-excluded dye — ranked by the selected
        // method, same as the primary path. Raw RGB here would re-rank the
        // substitute against a different notion of "closest".
        const allDyes = dyeService.getAllDyes();
        const filteredDyes = filterDyes(this.dyeFiltersConfig, allDyes).filter(
          (dye) => !excludeIds.includes(dye.id) && dye.category !== 'Facewear'
        );
        matchedDye =
          filteredDyes.length > 0
            ? filteredDyes.reduce((best, dye) => {
                const bestDist = ColorService.getDistanceForMethod(
                  theoreticalColor,
                  best.hex,
                  this.matchingMethod
                );
                const dyeDist = ColorService.getDistanceForMethod(
                  theoreticalColor,
                  dye.hex,
                  this.matchingMethod
                );
                return dyeDist < bestDist ? dye : best;
              })
            : null;
      }

      // Dedupe: without it a flat stretch of the ramp can match the same dye
      // four steps running (harmony and extractor both carry this toggle).
      // Pinned steps are explicit choices and never count as duplicates; a
      // free step is deduped against every pin, wherever it sits.
      if (this.preventDuplicates && matchedDye && usedDyeIds.has(matchedDye.id)) {
        const fallback = dyeService.findClosestDye(theoreticalColor, {
          excludeIds: [...excludeIds, ...usedDyeIds],
          matchingMethod: this.matchingMethod,
        });
        // A repeat beats an empty step when the pool is exhausted
        if (fallback && !isDyeExcluded(this.dyeFiltersConfig, fallback)) {
          matchedDye = fallback;
        }
      }
      if (matchedDye) usedDyeIds.add(matchedDye.id);

      // Drift in the suite vocabulary: step vs its matched dye, in the
      // active matching method â€” not raw RGB distance.
      const distance = matchedDye
        ? ColorService.getDistanceForMethod(theoreticalColor, matchedDye.hex, this.matchingMethod)
        : Infinity;

      result.push({
        position: steps === 1 ? 0 : i / (steps - 1),
        theoreticalColor,
        matchedDye: matchedDye || null,
        distance: distance === Infinity ? 0 : distance,
      });
    }

    this.currentSteps = result;
  }

  /**
   * FOCUS RESULTS: render the step matches as compact v4-result-card
   * components — direct children of the v5-results-grid. The focused rail
   * row's card carries the selected ring.
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
      card.compact = true;

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
      card.showCmyk = this.displayOptions.showCmyk;
      card.showDeltaE = this.displayOptions.showDeltaE;
      card.showHue = this.displayOptions.showHue ?? true;
      card.showStain = this.displayOptions.showStain ?? true;
      card.showConsolidation = this.displayOptions.showSpectrum ?? true;
      // BUG-086 sibling (2026-10-04 Sprint 22 review): the service fetches
      // nothing while the global Market Board toggle is off (its default), so
      // the tool's own Price option alone drew "Market —" forever.
      card.showPrice = this.displayOptions.showPrice && this.showPrices;
      card.showAcquisition = this.displayOptions.showAcquisition;

      // Enable slot picker for gradient tool (Select Dye â†’ choose Start or End slot)
      card.showSlotPicker = true;
      card.primaryActionLabel = LanguageService.t('common.selectDye');

      // Handle slot selection (add-mixer-slot-1 = Start, add-mixer-slot-2 = End).
      // BUG-094 (2026-10-04 deep-dive): through the endpoint rules — the
      // endpoint rows carry cards too, and writing the slot directly let the
      // start row's dye become the End as well.
      card.addEventListener('context-action', ((
        e: CustomEvent<{ action: ContextAction; dye: Dye }>
      ) => {
        const { action, dye: selectedDye } = e.detail;

        if (action === 'add-mixer-slot-1') {
          this.setEndpoint(0, selectedDye);
        } else if (action === 'add-mixer-slot-2') {
          this.setEndpoint(1, selectedDye);
        } else {
          // Handle other context actions (inspect, transform, external links)
          this.handleContextAction(action, selectedDye);
        }
      }) as EventListener);

      // Store reference for later price updates
      this.v4ResultCards.push(card);

      // 4C: the focused rail row's card carries the selected ring
      card.toggleAttribute('selected', this.focusedStep === i);

      // Pin controls live in the rail's pin column — cards are direct
      // children so the shared v5-results-grid rules apply
      this.matchesContainer.appendChild(card);
    }

    // If no steps have matches
    if (this.currentSteps.every((s) => !s.matchedDye)) {
      const noSteps = this.createElement('div', {
        textContent: LanguageService.t('gradient.noMatchesFound'),
        attributes: {
          style:
            'grid-column: 1 / -1; padding: 24px; text-align: center; font-size: 14px; color: var(--theme-text-muted);',
        },
      });
      this.matchesContainer.appendChild(noSteps);
    }
  }

  /**
   * Put a dye into one endpoint: the armed endpoint's palette pick, and a
   * result card's Start/End slot picker. That slot's own dye is a no-op, and
   * the other endpoint's dye swaps the ends, so a gradient never runs from a
   * dye to itself.
   */
  private setEndpoint(idx: 0 | 1, dye: Dye): void {
    const cur = idx === 0 ? this.startDye : this.endDye;
    const other = idx === 0 ? this.endDye : this.startDye;

    if (cur && cur.id === dye.id) {
      logger.info(`[GradientTool] ${dye.name} already set for that endpoint, ignoring`);
      return;
    }
    if (other && other.id === dye.id) {
      if (!cur) {
        ToastService.warning(LanguageService.t('gradient.sameDyeWarning'));
        return;
      }
      // Picked the other endpoint's dye — swap ends (existing gesture)
      this.selectedDyes[idx === 0 ? 1 : 0] = cur;
      this.selectedDyes[idx] = dye;
    } else if (this.selectedDyes.length === 0) {
      // The dense selection model always fills start first
      this.selectedDyes = [dye];
    } else {
      this.selectedDyes[idx] = dye;
    }
    logger.info(`[GradientTool] Dye set into ${idx === 0 ? 'start' : 'end'}: ${dye.name}`);
    this.updateAfterSlotSelection();
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
      // Inspect and transform actions. The result card performs each of these
      // itself (hand-off, storage write, toast, navigation, or its slot
      // selection modal when the target is full) before it emits the action.
      // BUG-013 (2026-10-04 deep-dive) found inspect-budget repeated here, and
      // the Sprint 5 review the rest: repeating them toasted twice and
      // navigated twice; with Comparison already holding four dyes the card
      // opened its slot modal while this added the dye and navigated away
      // under it. And the card's same-tool navigation destroys this tool
      // first, so 'transform-gradient' saved the destroyed tool's emptied
      // selection plus the dye over the two endpoints the card had just
      // stored, losing the start dye.
      case 'inspect-harmony':
      case 'inspect-budget':
      case 'inspect-accessibility':
      case 'inspect-comparison':
      case 'transform-gradient':
      case 'transform-mixer':
        break;
    }
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

    // Section 3: Market Board (collapsible)
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
        min: String(STEP_MIN),
        max: String(STEP_MAX),
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
      // Applied above first, so the controller's synchronous echo is a no-op
      ConfigController.getInstance().setConfig('gradient', { stepCount: this.stepCount });
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
      // Applied above first, so the controller's synchronous echo is a no-op
      ConfigController.getInstance().setConfig('gradient', { interpolation: this.colorSpace });
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
    this.activeEndpoint = null;
    this.focusedStep = null;

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

    // Show empty state and reset the endpoints row + rail
    this.showEmptyState(true);
    this.updateEndpointCards();
    this.renderPinRail();
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

    // 4C endpoints row: a card click arms an endpoint — palette selections
    // land in the armed slot instead of the legacy fill-then-shift flow.
    if (this.activeEndpoint !== null) {
      this.setEndpoint(this.activeEndpoint, dye);
      return;
    }

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
    // If both are set: shift dyes (new dye â†’ Start, old Start â†’ End)
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
        // Normal shift: old Start â†’ End, new dye â†’ Start
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

    // Use the existing selectDye logic to add to gradient
    this.selectDye(makeCustomDye(hex));
    logger.info(`[GradientTool] Custom color selected: ${hex}`);
  }
}
