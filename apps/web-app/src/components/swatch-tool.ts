/**
 * XIV Dye Tools v4.0.0 - Swatch Tool Component (Swatch Matcher)
 *
 * V4 Renamed: character-tool.ts → swatch-tool.ts
 * Match character customization colors to FFXIV dyes.
 * Allows players to find dyes that match their character's hair, eyes, skin, etc.
 *
 * Left Panel: Race/gender selection, color category selector
 * Right Panel: Color grid, matched dye results
 *
 * @module components/tools/swatch-tool
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { MarketBoard } from '@components/market-board';
import {
  ColorService,
  ConfigController,
  dyeService,
  LanguageService,
  MarketBoardService,
  StorageService,
  ToastService,
} from '@services/index';
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import { CharacterColorService, normalizeMatchingMethod } from '@xivdyetools/core';
import type { CharacterColor, CharacterColorMatch, SubRace, Gender } from '@xivdyetools/types';
import {
  ICON_TOOL_CHARACTER,
  ICON_TOOL_HARMONY,
  ICON_TOOL_COMPARISON,
  ICON_TOOL_GRADIENT,
  ICON_TOOL_ACCESSIBILITY,
} from '@shared/tool-icons';
import { ICON_PALETTE, ICON_MARKET } from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, PriceData } from '@xivdyetools/types';
import type {
  SwatchConfig,
  DisplayOptionsConfig,
  MarketConfig,
  MatchingMethod,
  DyeFiltersConfig,
} from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS, DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import { isDyeExcluded, hasActiveFilters } from '@shared/dye-filter-utils';
import type { ResultCardData, ContextAction } from '@components/v4/result-card';
// Import v4-result-card custom element to ensure it's registered
import '@components/v4/result-card';
// Import v4-share-button for share functionality
import '@components/v4/share-button';
import type { ShareButton } from '@components/v4/share-button';
import { ShareService } from '@services/share-service';
import { CharaImport, type CharaSlotGridRef } from '@components/chara-import';

// ============================================================================
// Types and Constants
// ============================================================================

export interface SwatchToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Color category options
 */
type ColorCategory =
  | 'eyeColors'
  | 'hairColors'
  | 'skinColors'
  | 'highlightColors'
  | 'lipColorsDark'
  | 'lipColorsLight'
  | 'tattooColors'
  | 'facePaintColorsDark'
  | 'facePaintColorsLight';

/**
 * Storage keys for character tool
 */
const STORAGE_KEYS = {
  subrace: 'v3_character_subrace',
  gender: 'v3_character_gender',
  colorCategory: 'v3_character_category',
  selectedColorIndex: 'v3_character_color_index',
  maxResults: 'v3_character_max_results',
  incomingDye: 'v4_swatch_target_dye',
} as const;

/**
 * Mapping from SubRace type values to ClanKey for localization lookup
 * SubRace uses PascalCase, ClanKey uses camelCase
 */
const SUBRACE_TO_CLAN_KEY: Record<SubRace, string> = {
  Midlander: 'midlander',
  Highlander: 'highlander',
  Wildwood: 'wildwood',
  Duskwight: 'duskwight',
  Plainsfolk: 'plainsfolk',
  Dunesfolk: 'dunesfolk',
  SeekerOfTheSun: 'seekerOfTheSun',
  KeeperOfTheMoon: 'keeperOfTheMoon',
  SeaWolf: 'seaWolf',
  Hellsguard: 'hellsguard',
  Raen: 'raen',
  Xaela: 'xaela',
  Helions: 'helions',
  TheLost: 'theLost',
  Rava: 'rava',
  Veena: 'veena',
};

/**
 * Race groups with their subraces and race key for localization
 */
const RACE_GROUPS: Array<{ raceKey: string; subraces: SubRace[] }> = [
  { raceKey: 'hyur', subraces: ['Midlander', 'Highlander'] },
  { raceKey: 'elezen', subraces: ['Wildwood', 'Duskwight'] },
  { raceKey: 'lalafell', subraces: ['Plainsfolk', 'Dunesfolk'] },
  { raceKey: 'miqote', subraces: ['SeekerOfTheSun', 'KeeperOfTheMoon'] },
  { raceKey: 'roegadyn', subraces: ['SeaWolf', 'Hellsguard'] },
  { raceKey: 'auRa', subraces: ['Raen', 'Xaela'] },
  { raceKey: 'hrothgar', subraces: ['Helions', 'TheLost'] },
  { raceKey: 'viera', subraces: ['Rava', 'Veena'] },
];

/**
 * Categories that are race-specific (need subrace/gender)
 */
const RACE_SPECIFIC_CATEGORIES: ColorCategory[] = ['hairColors', 'skinColors'];

/**
 * Categories whose preset palettes are retired by the Evercold expansion
 * (January 2027): eye, hair, and skin colors switch to a free color picker
 * in the character creator, so these preset grids will be replaced by a
 * color-picker input. A notice banner is shown while they remain.
 * (highlightColors may join this set if hair highlights are confirmed to use
 * the free picker too.)
 */
const EVERCOLD_DEPRECATED_CATEGORIES: ColorCategory[] = ['eyeColors', 'hairColors', 'skinColors'];

/**
 * Default values
 */
const DEFAULTS = {
  subrace: 'Midlander' as SubRace,
  gender: 'Male' as Gender,
  colorCategory: 'eyeColors' as ColorCategory,
  matchCount: 3,
};

// ============================================================================
// 10A Sheet vocabulary (drawn card metrics)
// ============================================================================

const MONO = "'Fragment Mono', monospace";

/**
 * Grid cell sizes per the 5.0 register: a dense 26px reference chart on
 * desktop (the slot cards' chip size), 44px touch targets on mobile.
 */
const GRID_CELL_DESKTOP = 26;
const GRID_CELL_MOBILE = 44;
/** Matches globals.css h1–h6 — Space Grotesk with the system fallback. */
const SANS = "'Space Grotesk', system-ui, sans-serif";

/**
 * Method display tags — identifiers, never localised. Mirrors core's
 * MATCHING_METHOD_TAGS (kept local so the tag map is available even where
 * core is mocked/minimal).
 */
const METHOD_TAGS: Record<MatchingMethod, string> = {
  ciede2000: 'ΔE2000',
  oklab: 'ΔEOK',
  cie76: 'ΔE76',
  redmean: 'REDMEAN',
  rgb: 'RGB DIST',
  distinguish: 'DISTINGUISH %',
};

// TODO(i18n): needs key — swatch.selSentence (the verdict sentence template)
const EN_SEL_SENTENCE = (subject: string, place: string, dye: string, delta: string): string =>
  `${subject} is ${place}. ${dye} sits ${delta} away.`;
// TODO(i18n): needs key — swatch.selSentenceCell (grid-cell variant, no slot)
const EN_SEL_SENTENCE_CELL = (place: string, dye: string, delta: string): string =>
  `${place}. ${dye} sits ${delta} away.`;
// TODO(i18n): needs key — swatch.selSentenceOffGrid (arbitrary-colour variant)
const EN_SEL_SENTENCE_OFF = (subject: string, dye: string, delta: string): string =>
  `${subject} is an arbitrary colour. ${dye} sits ${delta} away.`;

/** The selected thing the verdict card describes (sheet slot or grid cell). */
interface SwatchSelectionContext {
  source: 'slot' | 'grid';
  /** slot source only */
  hex?: string;
  label?: string;
  gridRef?: CharaSlotGridRef | null;
}

// ============================================================================
// CharacterTool Component
// ============================================================================

/**
 * Character Tool - v3 Two-Panel Layout
 *
 * Match character customization colors to FFXIV dyes.
 */
export class SwatchTool extends BaseComponent {
  private options: SwatchToolOptions;
  private characterColorService: CharacterColorService;
  private charaImport: CharaImport | null = null;
  private marketBoardService: MarketBoardService;

  // State
  private subrace: SubRace;
  private gender: Gender;
  private colorCategory: ColorCategory;
  private maxResults: number;
  private selectedColor: CharacterColor | null = null;
  private matchedDyes: CharacterColorMatch[] = [];
  private colors: CharacterColor[] = [];
  private priceData: Map<number, PriceData> = new Map();
  private showPrices: boolean = false;

  // Display options (from ConfigController) - for v4-result-card
  private displayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };
  // 5.0: one vocabulary across the suite — ΔE2000 default, same as 7C/9C.
  private matchingMethod: MatchingMethod = 'ciede2000';
  private dyeFiltersConfig: DyeFiltersConfig = { ...DEFAULT_DYE_FILTERS };

  // Reverse matching state (dye/hex → closest swatch)
  private reverseDyeHex: string | null = null;
  private reverseDyeName: string | null = null;
  private reverseMatchedSwatches: Array<{
    color: CharacterColor;
    distance: number;
    rank: number; // 1 = closest
  }> = [];

  // Child components
  private marketBoard: MarketBoard | null = null;
  private marketPanel: CollapsiblePanel | null = null;
  private racePanel: CollapsiblePanel | null = null;
  private categoryPanel: CollapsiblePanel | null = null;

  // Mobile components
  private mobileMarketBoard: MarketBoard | null = null;
  private mobileRacePanel: CollapsiblePanel | null = null;
  private mobileCategoryPanel: CollapsiblePanel | null = null;
  private mobileMarketPanel: CollapsiblePanel | null = null;

  // DOM References
  private colorGridContainer: HTMLElement | null = null;
  private matchResultsContainer: HTMLElement | null = null;
  /** 10A selection card (verdict sentence + IN-THE-CREATOR excerpt) */
  private selectionCardContainer: HTMLElement | null = null;
  /** 10A SEND TO handoff row (always at the flow's bottom) */
  private handoffContainer: HTMLElement | null = null;
  /** Mono unit tag beside the CLOSEST DYES header */
  private unitTagEl: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private shareButton: ShareButton | null = null;
  private reverseResultsContainer: HTMLElement | null = null;
  private reverseSection: HTMLElement | null = null;
  private subraceSelect: HTMLSelectElement | null = null;
  private genderSelect: HTMLSelectElement | null = null;
  private categorySelect: HTMLSelectElement | null = null;

  // Layout containers for responsive behavior
  private mainLayout: HTMLElement | null = null;
  private gridPanel: HTMLElement | null = null;
  private paletteRailContainer: HTMLElement | null = null;
  private gridTitleEl: HTMLElement | null = null;
  /** Loaded .chara character — drives grid pins and the readout lock */
  private charaResolved: import('@xivdyetools/core').ResolvedCharaCharacter | null = null;
  /** Sheet index the selection-card excerpt centres on (from a sheet-slot pick) */
  private gridExcerptAnchor: number | null = null;
  /** What the selection card describes — the last slot pick or grid click */
  private selectionContext: SwatchSelectionContext | null = null;

  // Mobile DOM References
  private mobileSubraceSelect: HTMLSelectElement | null = null;
  private mobileGenderSelect: HTMLSelectElement | null = null;
  private mobileCategorySelect: HTMLSelectElement | null = null;

  // Subscriptions
  private resultsPanelMediaQueryCleanup: (() => void) | null = null;

  constructor(container: HTMLElement, options: SwatchToolOptions) {
    super(container);
    this.options = options;
    this.characterColorService = new CharacterColorService();
    this.marketBoardService = MarketBoardService.getInstance();

    // Load persisted settings
    {
      // 5.0 stored-tribe migration: 'Helion' was renamed 'Helions' (the
      // game's plural); migrate the persisted value on read.
      const storedSubrace = StorageService.getItem<string>(STORAGE_KEYS.subrace);
      this.subrace =
        storedSubrace === 'Helion'
          ? 'Helions'
          : ((storedSubrace as SubRace | null) ?? DEFAULTS.subrace);
    }
    this.gender = StorageService.getItem<Gender>(STORAGE_KEYS.gender) ?? DEFAULTS.gender;
    this.colorCategory =
      StorageService.getItem<ColorCategory>(STORAGE_KEYS.colorCategory) ?? DEFAULTS.colorCategory;
    this.maxResults =
      StorageService.getItem<number>(STORAGE_KEYS.maxResults) ?? DEFAULTS.matchCount;

    // Load initial colors (async for race-specific categories like skin/hair)
    void this.loadColors().then(() => {
      if (!this.isDestroyed && this.colorGridContainer) {
        this.updateColorGrid();
      }
    });
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
    // Event bindings handled in render methods
  }

  onMount(): void {
    // Load state from share URL first (async, runs after colors loaded)
    void this.loadFromShareUrl();

    // Check for incoming dye from cross-tool navigation (e.g., result card context menu)
    this.handleIncomingDye();

    this.subs.add(
      LanguageService.subscribe(() => {
        this.update();
      })
    );

    // Subscribe to config changes from V4 ConfigSidebar
    const configController = ConfigController.getInstance();
    this.subs.add(
      configController.subscribe('swatch', (config) => {
        this.setConfig(config);
      })
    );

    // Subscribe to market config changes
    this.subs.add(
      configController.subscribe('market', (config) => {
        this.setMarketConfig(config);
      })
    );

    // Sync MarketBoard components with ConfigController on initial load
    const marketConfig = configController.getConfig('market');
    if (this.marketBoard) {
      this.marketBoard.setSelectedServer(marketConfig.selectedServer);
      this.marketBoard.setShowPrices(marketConfig.showPrices);
      this.showPrices = marketConfig.showPrices;
    }
    if (this.mobileMarketBoard) {
      this.mobileMarketBoard.setSelectedServer(marketConfig.selectedServer);
      this.mobileMarketBoard.setShowPrices(marketConfig.showPrices);
    }

    // Set initial layout and listen for viewport changes
    this.updateSwatchLayout();
    this.on(window, 'resize', this.updateSwatchLayout);

    logger.info('[SwatchTool] Mounted');
  }

  destroy(): void {
    this.resultsPanelMediaQueryCleanup?.();

    this.charaImport?.destroy();
    this.charaImport = null;
    this.marketBoard?.destroy();
    this.marketPanel?.destroy();
    this.racePanel?.destroy();
    this.categoryPanel?.destroy();

    this.mobileMarketBoard?.destroy();
    this.mobileRacePanel?.destroy();
    this.mobileCategoryPanel?.destroy();
    this.mobileMarketPanel?.destroy();

    this.selectedColor = null;
    this.matchedDyes = [];
    this.colors = [];
    this.priceData.clear();
    this.reverseDyeHex = null;
    this.reverseDyeName = null;
    this.reverseMatchedSwatches = [];

    super.destroy();
    logger.info('[CharacterTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   */
  public setConfig(config: Partial<SwatchConfig>): void {
    let needsReload = false;
    let needsRematch = false;
    let needsRedraw = false;

    // Handle race (now receives SubRace values directly like 'Midlander')
    if (config.race !== undefined && config.race !== this.subrace) {
      this.subrace = config.race as SubRace;
      StorageService.setItem(STORAGE_KEYS.subrace, config.race);
      needsReload = true;
      logger.info(`[SwatchTool] setConfig: race -> ${config.race}`);
    }

    // Handle gender
    if (config.gender !== undefined && config.gender !== this.gender) {
      this.gender = config.gender as Gender;
      StorageService.setItem(STORAGE_KEYS.gender, config.gender);
      needsReload = true;
      logger.info(`[SwatchTool] setConfig: gender -> ${config.gender}`);
    }

    // Handle colorSheet (now receives category keys directly like 'eyeColors')
    if (config.colorSheet !== undefined && config.colorSheet !== this.colorCategory) {
      // ConfigSidebar now sends category keys directly (e.g., 'eyeColors', 'hairColors')
      this.colorCategory = config.colorSheet as ColorCategory;
      StorageService.setItem(STORAGE_KEYS.colorCategory, config.colorSheet);
      needsReload = true;
      logger.info(`[SwatchTool] setConfig: colorSheet -> ${config.colorSheet}`);
    }

    // Handle maxResults
    if (config.maxResults !== undefined && config.maxResults !== this.maxResults) {
      this.maxResults = config.maxResults;
      StorageService.setItem(STORAGE_KEYS.maxResults, config.maxResults);
      needsRematch = true;
      logger.info(`[SwatchTool] setConfig: maxResults -> ${config.maxResults}`);
    }

    // Handle displayOptions (for v4-result-card display settings)
    if (config.displayOptions !== undefined) {
      this.displayOptions = { ...this.displayOptions, ...config.displayOptions };
      needsRedraw = true;
      logger.info(`[SwatchTool] setConfig: displayOptions updated`);
    }

    // Handle matchingMethod - re-match colors when algorithm changes
    if (config.matchingMethod !== undefined && config.matchingMethod !== this.matchingMethod) {
      this.matchingMethod = config.matchingMethod;
      needsRematch = true;
      logger.info(`[SwatchTool] setConfig: matchingMethod -> ${config.matchingMethod}`);
    }

    // Handle dyeFilters changes
    if (config.dyeFilters) {
      const newFilters = { ...this.dyeFiltersConfig, ...config.dyeFilters };
      const filtersChanged = JSON.stringify(newFilters) !== JSON.stringify(this.dyeFiltersConfig);
      if (filtersChanged) {
        this.dyeFiltersConfig = newFilters;
        needsRematch = true;
        logger.info('[SwatchTool] setConfig: dyeFilters updated');
      }
    }

    // Sync UI selectors (both desktop and mobile)
    if (needsReload || needsRematch) {
      // Update desktop selectors
      if (this.subraceSelect) this.subraceSelect.value = this.subrace;
      if (this.genderSelect) this.genderSelect.value = this.gender;
      if (this.categorySelect) this.categorySelect.value = this.colorCategory;
      // Update mobile selectors
      if (this.mobileSubraceSelect) this.mobileSubraceSelect.value = this.subrace;
      if (this.mobileGenderSelect) this.mobileGenderSelect.value = this.gender;
      if (this.mobileCategorySelect) this.mobileCategorySelect.value = this.colorCategory;
    }

    // Reload colors if race/gender/category changed
    if (needsReload) {
      this.selectedColor = null;
      void this.loadColors().then(() => {
        // Update the grid header title
        this.updateColorGrid();
        // Re-run reverse match against the new palette
        if (this.reverseDyeHex) {
          this.performReverseMatch();
        }
      });
    } else if (needsRematch) {
      // Re-match if maxResults or matchingMethod changed
      if (this.selectedColor) this.findMatchingDyes();
      if (this.reverseDyeHex) this.performReverseMatch();
    } else if (needsRedraw && this.matchedDyes.length > 0) {
      // Just redraw results if only display options changed
      this.updateMatchResults();
    }
  }

  /**
   * Update market configuration from external source (V4 ConfigSidebar)
   */
  public setMarketConfig(config: Partial<MarketConfig>): void {
    // Handle showPrices
    if ('showPrices' in config) {
      const showPrices = config.showPrices as boolean;
      this.showPrices = showPrices;
      logger.info(`[SwatchTool] setMarketConfig: showPrices -> ${showPrices}`);

      // Update both MarketBoard UI instances
      if (this.marketBoard) {
        this.marketBoard.setShowPrices(showPrices);
      }
      if (this.mobileMarketBoard) {
        this.mobileMarketBoard.setShowPrices(showPrices);
      }

      // Fetch prices if enabled, or re-render to hide them
      if (showPrices && this.matchedDyes.length > 0) {
        void this.fetchPrices(this.matchedDyes.map((m) => m.dye));
      } else {
        this.updateMatchResults();
      }
    }

    // Handle selectedServer
    if ('selectedServer' in config) {
      const selectedServer = config.selectedServer as string;
      logger.info(`[SwatchTool] setMarketConfig: selectedServer -> ${selectedServer}`);

      // Update both MarketBoard UI instances with the new server
      if (this.marketBoard) {
        this.marketBoard.setSelectedServer(selectedServer);
      }
      if (this.mobileMarketBoard) {
        this.mobileMarketBoard.setSelectedServer(selectedServer);
      }

      // Re-fetch prices with the new server if prices are enabled
      if (this.showPrices && this.matchedDyes.length > 0) {
        this.priceData.clear();
        void this.fetchPrices(this.matchedDyes.map((m) => m.dye));
      }
    }
  }

  // ============================================================================
  // Reverse Matching (Dye/Hex → Closest Swatch)
  // ============================================================================

  /**
   * Handle incoming dye from cross-tool navigation (e.g., result card context menu).
   * Reads a dye ID from localStorage, resolves to a Dye object, calls selectDye(),
   * then clears the storage key (one-shot consumption).
   */
  private handleIncomingDye(): void {
    const dyeId = StorageService.getItem<number>(STORAGE_KEYS.incomingDye);
    if (dyeId == null) return;

    // Clear immediately to prevent re-triggering on next mount
    StorageService.removeItem(STORAGE_KEYS.incomingDye);

    const dye = dyeService.getDyeById(dyeId);
    if (!dye) {
      logger.warn(`[SwatchTool] Incoming dye not found: id=${dyeId}`);
      return;
    }

    // Ensure colors are loaded before performing reverse match
    void this.loadColors().then(() => {
      if (!this.isDestroyed) {
        this.selectDye(dye);
        logger.info(`[SwatchTool] Incoming dye from navigation: "${dye.name}" (id=${dyeId})`);
      }
    });
  }

  /**
   * Handle dye selection from the palette drawer (reverse matching).
   * Finds the closest swatches in the current palette grid.
   */
  public selectDye(dye: Dye): void {
    if (!dye) return;
    this.reverseDyeHex = dye.hex;
    this.reverseDyeName = LanguageService.getDyeName(dye.itemID) || dye.name;
    logger.info(`[SwatchTool] Reverse match: dye "${this.reverseDyeName}" (${dye.hex})`);
    this.performReverseMatch();
  }

  /**
   * Handle custom color selection from the palette drawer (reverse matching).
   */
  public selectCustomColor(hex: string): void {
    if (!hex) return;
    this.reverseDyeHex = hex.startsWith('#') ? hex : `#${hex}`;
    this.reverseDyeName = `Custom (${this.reverseDyeHex.toUpperCase()})`;
    logger.info(`[SwatchTool] Reverse match: custom color ${this.reverseDyeHex}`);
    this.performReverseMatch();
  }

  /**
   * Find the closest swatch colors to the selected dye/hex.
   * Scans all colors in the current palette and ranks by distance.
   */
  private performReverseMatch(): void {
    if (!this.reverseDyeHex || this.colors.length === 0) {
      this.reverseMatchedSwatches = [];
      this.updateReverseHighlights();
      this.updateReverseResults();
      return;
    }

    // 5.0: the hardcoded top-3 is cut — the result count follows the same
    // maxResults control as the forward side.
    const scored: Array<{ color: CharacterColor; distance: number }> = [];

    for (const color of this.colors) {
      const distance = this.calculateColorDistance(this.reverseDyeHex, color.hex);
      scored.push({ color, distance });
    }
    scored.sort((a, b) => a.distance - b.distance);

    this.reverseMatchedSwatches = scored.slice(0, this.maxResults).map((s, i) => ({
      color: s.color,
      distance: s.distance,
      rank: i + 1,
    }));

    logger.info(
      `[SwatchTool] Reverse match found ${this.reverseMatchedSwatches.length} closest swatches`
    );

    this.updateReverseHighlights();
    this.updateReverseResults();
  }

  /**
   * Calculate color distance using the current matching method.
   * Mirrors CharacterColorService.calculateDistanceWithMethod.
   */
  private calculateColorDistance(hex1: string, hex2: string): number {
    // 5.0: one dispatch suite-wide (dE2000 default lives in core)
    return ColorService.getDistanceForMethod(hex1, hex2, this.matchingMethod);
  }

  /**
   * Ring reverse-matched swatches. One vocabulary: the theme accent at three
   * strengths by rank (the legacy blue second vocabulary was cut in 10A).
   * Still a box-shadow, so it reads as distinct from the forward selection's
   * outline without introducing a colour the palette never uses.
   */
  private updateReverseHighlights(): void {
    if (!this.colorGridContainer) return;

    const reverseMap = new Map(this.reverseMatchedSwatches.map((m) => [m.color.index, m.rank]));
    const accent = (pct: number): string =>
      `color-mix(in srgb, var(--theme-primary) ${pct}%, transparent)`;

    this.colorGridContainer.querySelectorAll('button').forEach((swatch) => {
      const el = swatch as HTMLElement;
      const index = parseInt(el.getAttribute('data-index') || '-1', 10);
      const rank = reverseMap.get(index);

      // Clear previous reverse highlights
      el.style.boxShadow = '';

      if (rank === 1) {
        el.style.boxShadow = `0 0 0 3px ${accent(90)}, 0 0 12px ${accent(50)}`;
        if (index !== this.selectedColor?.index) el.style.zIndex = '9';
      } else if (rank === 2) {
        el.style.boxShadow = `0 0 0 2px ${accent(60)}, 0 0 8px ${accent(30)}`;
        if (index !== this.selectedColor?.index) el.style.zIndex = '8';
      } else if (rank === 3) {
        el.style.boxShadow = `0 0 0 2px ${accent(30)}, 0 0 4px ${accent(15)}`;
        if (index !== this.selectedColor?.index) el.style.zIndex = '7';
      } else if (index !== this.selectedColor?.index) {
        el.style.zIndex = 'auto';
      }
    });
  }

  /**
   * Update reverse match results display.
   * Shows source dye info and matched swatch positions.
   */
  private updateReverseResults(): void {
    if (!this.reverseResultsContainer || !this.reverseSection) return;
    clearContainer(this.reverseResultsContainer);

    if (this.reverseMatchedSwatches.length === 0 || !this.reverseDyeHex) {
      this.reverseSection.style.display = 'none';
      return;
    }

    this.reverseSection.style.display = 'flex';

    // Source dye card
    const sourceCard = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--theme-card-background, #2a2a2a);
          border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
          border-radius: 8px;
        `,
      },
    });

    const sourceSwatch = this.createElement('div', {
      attributes: {
        style: `
          width: 40px;
          height: 40px;
          border-radius: 6px;
          border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.2));
          background-color: ${this.reverseDyeHex};
          flex-shrink: 0;
        `,
      },
    });
    sourceCard.appendChild(sourceSwatch);

    const sourceInfo = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        `,
      },
    });
    const sourceName = this.createElement('span', {
      textContent: this.reverseDyeName || '',
      attributes: {
        style: `
          font-size: 14px;
          font-weight: 600;
          color: var(--theme-text, #e0e0e0);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        `,
      },
    });
    sourceInfo.appendChild(sourceName);
    const sourceHex = this.createElement('span', {
      className: 'number',
      textContent: this.reverseDyeHex.toUpperCase(),
      attributes: {
        style: `
          font-size: 12px;
          color: var(--theme-text-muted, #a0a0a0);
        `,
      },
    });
    sourceInfo.appendChild(sourceHex);
    sourceCard.appendChild(sourceInfo);

    this.reverseResultsContainer.appendChild(sourceCard);

    // Matched swatch rows
    for (const match of this.reverseMatchedSwatches) {
      const gridRow = Math.floor(match.color.index / 8) + 1;
      const gridCol = (match.color.index % 8) + 1;

      const row = this.createElement('div', {
        attributes: {
          style: `
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 16px;
            background: var(--theme-card-background, #2a2a2a);
            border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.15s;
          `,
        },
      });

      // Hover effect
      row.addEventListener('mouseenter', () => {
        row.style.background = 'var(--theme-card-hover, #333333)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'var(--theme-card-background, #2a2a2a)';
      });

      // Click to select this swatch for forward matching
      row.addEventListener('click', () => {
        this.selectColor(match.color);
      });

      // Rank badge
      const rankBadge = this.createElement('span', {
        textContent: `#${match.rank}`,
        attributes: {
          style: `
            display: flex;
            align-items: center;
            justify-content: center;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: ${
              match.rank === 1
                ? 'color-mix(in srgb, var(--theme-primary) 18%, transparent)'
                : 'var(--theme-background-secondary)'
            };
            color: ${match.rank === 1 ? 'var(--theme-primary)' : 'var(--theme-text-muted, #a0a0a0)'};
            font-size: 11px;
            font-weight: 700;
            flex-shrink: 0;
          `,
        },
      });
      row.appendChild(rankBadge);

      // Color swatch
      const matchSwatch = this.createElement('div', {
        attributes: {
          style: `
            width: 32px;
            height: 32px;
            border-radius: 4px;
            border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.2));
            background-color: ${match.color.hex};
            flex-shrink: 0;
          `,
        },
      });
      row.appendChild(matchSwatch);

      // Info column
      const info = this.createElement('div', {
        attributes: {
          style: `
            display: flex;
            flex-direction: column;
            gap: 2px;
            flex: 1;
            min-width: 0;
          `,
        },
      });

      const posLabel = this.createElement('span', {
        textContent: `Row ${gridRow}, Column ${gridCol}`,
        attributes: {
          style: `
            font-size: 13px;
            font-weight: 500;
            color: var(--theme-text, #e0e0e0);
          `,
        },
      });
      info.appendChild(posLabel);

      const hexLabel = this.createElement('span', {
        className: 'number',
        textContent: match.color.hex.toUpperCase(),
        attributes: {
          style: `
            font-size: 11px;
            color: var(--theme-text-muted, #a0a0a0);
          `,
        },
      });
      info.appendChild(hexLabel);
      row.appendChild(info);

      // Distance badge
      const distBadge = this.createElement('span', {
        className: 'number',
        textContent: `Δ ${match.distance.toFixed(2)}`,
        attributes: {
          style: `
            font-size: 11px;
            color: var(--theme-text-muted, #a0a0a0);
            background: rgba(255, 255, 255, 0.06);
            padding: 4px 8px;
            border-radius: 4px;
            flex-shrink: 0;
          `,
        },
      });
      row.appendChild(distBadge);

      this.reverseResultsContainer.appendChild(row);
    }
  }

  /**
   * Clear reverse matching state and visuals.
   */
  private clearReverseMatch(): void {
    this.reverseDyeHex = null;
    this.reverseDyeName = null;
    this.reverseMatchedSwatches = [];
    this.updateReverseHighlights();
    this.updateReverseResults();
  }

  // ============================================================================
  // Left Panel Rendering
  // ============================================================================

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Section 1: Race & Gender Selection
    const raceContainer = this.createElement('div');
    left.appendChild(raceContainer);
    this.racePanel = new CollapsiblePanel(raceContainer, {
      title: LanguageService.t('tools.character.selectSubrace'),
      storageKey: 'v3_character_race_panel',
      defaultOpen: true,
      icon: ICON_TOOL_CHARACTER,
    });
    this.racePanel.init();
    const raceContent = this.createElement('div');
    this.renderRaceSection(raceContent);
    this.racePanel.setContent(raceContent);

    // Section 2: Color Category Selection
    const categoryContainer = this.createElement('div');
    left.appendChild(categoryContainer);
    this.categoryPanel = new CollapsiblePanel(categoryContainer, {
      title: LanguageService.t('tools.character.colorCategory'),
      storageKey: 'v3_character_category_panel',
      defaultOpen: true,
      icon: ICON_PALETTE,
    });
    this.categoryPanel.init();
    const categoryContent = this.createElement('div');
    this.renderCategorySection(categoryContent);
    this.categoryPanel.setContent(categoryContent);

    // Section 3: Market Board
    const marketContainer = this.createElement('div');
    left.appendChild(marketContainer);
    this.marketPanel = new CollapsiblePanel(marketContainer, {
      title: LanguageService.t('marketBoard.title'),
      storageKey: 'v3_character_market',
      defaultOpen: false,
      icon: ICON_MARKET,
    });
    this.marketPanel.init();

    const marketContent = this.createElement('div');
    this.marketBoard = new MarketBoard(marketContent);
    this.marketBoard.init();

    // Set up market board event listeners using shared utility
    setupMarketBoardListeners(
      marketContent,
      () => this.showPrices && this.matchedDyes.length > 0,
      () => void this.fetchPrices(this.matchedDyes.map((m) => m.dye)),
      {
        onPricesToggled: () => {
          if (this.showPrices && this.matchedDyes.length > 0) {
            void this.fetchPrices(this.matchedDyes.map((m) => m.dye));
          } else {
            this.updateMatchResults();
          }
        },
        onServerChanged: () => {
          if (this.selectedColor) {
            this.findMatchingDyes();
          }
        },
        onRefreshRequested: () => {
          if (this.showPrices && this.matchedDyes.length > 0) {
            this.priceData.clear();
            void this.fetchPrices(this.matchedDyes.map((m) => m.dye));
          }
        },
      }
    );

    // Initialize showPrices from MarketBoard state
    this.showPrices = this.marketBoard.getShowPrices();

    this.marketPanel.setContent(marketContent);
  }

  /**
   * Render race/gender selection
   */
  private renderRaceSection(container: HTMLElement): void {
    const section = this.createElement('div', { className: 'space-y-4 p-2' });

    // Subrace selector
    const subraceGroup = this.createElement('div', { className: 'space-y-2' });
    const subraceLabel = this.createElement('label', {
      className: 'block text-sm font-medium',
      textContent: LanguageService.t('tools.character.selectSubrace'),
      attributes: { style: 'color: var(--theme-text);' },
    });
    subraceGroup.appendChild(subraceLabel);

    this.subraceSelect = this.createElement('select', {
      className: 'w-full p-2 rounded-lg border text-sm',
      attributes: {
        style:
          'background: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);',
      },
    }) as HTMLSelectElement;

    // Group subraces by race with localized names
    for (const group of RACE_GROUPS) {
      const localizedRaceName = LanguageService.getRace(group.raceKey);
      const optgroup = this.createElement('optgroup', {
        attributes: { label: localizedRaceName },
      }) as HTMLOptGroupElement;

      for (const subrace of group.subraces) {
        const clanKey = SUBRACE_TO_CLAN_KEY[subrace];
        const localizedClanName = LanguageService.getClan(clanKey);
        const option = this.createElement('option', {
          textContent: localizedClanName,
          attributes: { value: subrace },
        }) as HTMLOptionElement;
        if (subrace === this.subrace) {
          option.selected = true;
        }
        optgroup.appendChild(option);
      }
      this.subraceSelect.appendChild(optgroup);
    }

    this.subraceSelect.addEventListener('change', () => {
      this.subrace = this.subraceSelect!.value as SubRace;
      StorageService.setItem(STORAGE_KEYS.subrace, this.subrace);
      this.syncMobileSelectors();
      void this.loadColors().then(() => {
        this.updateColorGrid();
        this.clearSelection();
      });
    });

    subraceGroup.appendChild(this.subraceSelect);
    section.appendChild(subraceGroup);

    // Gender selector
    const genderGroup = this.createElement('div', { className: 'space-y-2' });
    const genderLabel = this.createElement('label', {
      className: 'block text-sm font-medium',
      textContent: LanguageService.t('tools.character.selectGender'),
      attributes: { style: 'color: var(--theme-text);' },
    });
    genderGroup.appendChild(genderLabel);

    this.genderSelect = this.createElement('select', {
      className: 'w-full p-2 rounded-lg border text-sm',
      attributes: {
        style:
          'background: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);',
      },
    }) as HTMLSelectElement;

    const maleOption = this.createElement('option', {
      textContent: LanguageService.t('tools.character.male'),
      attributes: { value: 'Male' },
    }) as HTMLOptionElement;
    if (this.gender === 'Male') maleOption.selected = true;

    const femaleOption = this.createElement('option', {
      textContent: LanguageService.t('tools.character.female'),
      attributes: { value: 'Female' },
    }) as HTMLOptionElement;
    if (this.gender === 'Female') femaleOption.selected = true;

    this.genderSelect.appendChild(maleOption);
    this.genderSelect.appendChild(femaleOption);

    this.genderSelect.addEventListener('change', () => {
      this.gender = this.genderSelect!.value as Gender;
      StorageService.setItem(STORAGE_KEYS.gender, this.gender);
      this.syncMobileSelectors();
      void this.loadColors().then(() => {
        this.updateColorGrid();
        this.clearSelection();
      });
    });

    genderGroup.appendChild(this.genderSelect);
    section.appendChild(genderGroup);

    // Show/hide gender based on category
    this.updateGenderVisibility(genderGroup);

    container.appendChild(section);
  }

  /**
   * Render color category selection
   */
  private renderCategorySection(container: HTMLElement): void {
    const section = this.createElement('div', { className: 'space-y-2 p-2' });

    this.categorySelect = this.createElement('select', {
      className: 'w-full p-2 rounded-lg border text-sm',
      attributes: {
        style:
          'background: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);',
      },
    }) as HTMLSelectElement;

    const categories: Array<{ value: ColorCategory; label: string }> = [
      { value: 'eyeColors', label: LanguageService.t('tools.character.eyeColors') },
      {
        value: 'hairColors',
        label: LanguageService.t('tools.character.hairColors'),
      },
      {
        value: 'skinColors',
        label: LanguageService.t('tools.character.skinColors'),
      },
      {
        value: 'highlightColors',
        label: LanguageService.t('tools.character.highlightColors'),
      },
      {
        value: 'lipColorsDark',
        label: LanguageService.t('tools.character.lipColorsDark'),
      },
      {
        value: 'lipColorsLight',
        label: LanguageService.t('tools.character.lipColorsLight'),
      },
      {
        value: 'tattooColors',
        label: LanguageService.t('tools.character.tattooColors'),
      },
      {
        value: 'facePaintColorsDark',
        label: LanguageService.t('tools.character.facePaintDark'),
      },
      {
        value: 'facePaintColorsLight',
        label: LanguageService.t('tools.character.facePaintLight'),
      },
    ];

    for (const cat of categories) {
      const option = this.createElement('option', {
        textContent: cat.label,
        attributes: { value: cat.value },
      }) as HTMLOptionElement;
      if (cat.value === this.colorCategory) {
        option.selected = true;
      }
      this.categorySelect.appendChild(option);
    }

    this.categorySelect.addEventListener('change', () => {
      this.colorCategory = this.categorySelect!.value as ColorCategory;
      StorageService.setItem(STORAGE_KEYS.colorCategory, this.colorCategory);
      this.syncMobileSelectors();
      void this.loadColors().then(() => {
        this.updateColorGrid();
        this.clearSelection();
      });

      // Update gender visibility
      const genderGroup = this.subraceSelect?.parentElement
        ?.nextElementSibling as HTMLElement | null;
      if (genderGroup) {
        this.updateGenderVisibility(genderGroup);
      }
    });

    section.appendChild(this.categorySelect);
    container.appendChild(section);
  }

  /**
   * Update gender selector visibility based on category
   */
  private updateGenderVisibility(genderGroup: HTMLElement): void {
    const needsGender = RACE_SPECIFIC_CATEGORIES.includes(this.colorCategory);
    genderGroup.style.display = needsGender ? 'block' : 'none';
  }

  // ============================================================================
  // Right Panel Rendering (V4 Layout)
  // ============================================================================

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    // In V4, leftPanel and rightPanel are the same element.
    // Clear to remove leftPanel content (V4 uses ConfigSidebar instead).
    clearContainer(right);

    // Apply V4-style layout to the panel
    // Use min-height instead of height to allow container to grow with content
    right.setAttribute(
      'style',
      `
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      min-height: 100%;
      height: auto;
      padding: 32px;
      gap: 24px;
      box-sizing: border-box;
      overflow-y: auto;
    `
    );

    // 10A: the .chara reader sits ABOVE the workspace — the drop zone is an
    // offer, not a replacement; everything below keeps working without it.
    // (Constructed further down, once the glamour container exists.)
    const charaContainer = this.createElement('div', {
      attributes: { style: 'width: 100%; max-width: 1400px;' },
    });
    right.appendChild(charaContainer);

    // Main layout container: Color Grid (LEFT) | Results Area (RIGHT)
    // Use align-items: flex-start so children size to their content, not stretch to fill
    // On mobile, switches to column layout via updateSwatchLayout()
    // flex: 0 0 auto prevents flexbox from constraining height, allowing natural content sizing
    this.mainLayout = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex: 0 0 auto;
          gap: 24px;
          min-height: 500px;
          justify-content: center;
          align-items: flex-start;
          width: 100%;
          max-width: 1400px;
        `,
      },
    });

    // LEFT: Color Grid Panel (glassmorphism container)
    // height: fit-content ensures panel sizes to contain all swatches (96 or 192)
    // Width and swatch sizes adjusted via updateSwatchLayout() for mobile
    this.gridPanel = this.createElement('div', {
      className: 'glass',
      attributes: {
        style: `
          flex: 0 0 auto;
          width: fit-content;
          height: fit-content;
          background: var(--v4-glass-bg, rgba(30, 30, 30, 0.7));
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          align-items: center;
        `,
      },
    });

    // Grid header
    const gridHeader = this.createElement('div', {
      attributes: {
        style: `
          width: 100%;
          display: flex;
          justify-content: space-between;
          margin-bottom: 12px;
        `,
      },
    });
    this.gridTitleEl = this.createElement('span', {
      className: 'section-title',
      textContent: `${this.getCategoryDisplayName(this.colorCategory)} (${this.colors.length})`,
      attributes: {
        style: `
          font-size: 14px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--theme-text-muted, #a0a0a0);
        `,
      },
    });
    gridHeader.appendChild(this.gridTitleEl);
    this.gridPanel.appendChild(gridHeader);

    // 10A: seven palettes, not nine — Dark and Light are one game control
    // with two ranges, so lip/face-paint get a range toggle instead of
    // doubling the list.
    this.paletteRailContainer = this.createElement('div', {
      attributes: { style: 'width: 100%; margin-bottom: 12px;' },
    });
    this.gridPanel.appendChild(this.paletteRailContainer);
    this.renderPaletteRail();

    // Colour grid, 8 columns. Register sizing: 26px on desktop (a dense
    // reference chart you scan, same chip size as the slot cards), 44px on
    // mobile (a touch target). updateSwatchLayout() swaps to the mobile size.
    this.colorGridContainer = this.createElement('div', {
      attributes: {
        style: `
          display: grid;
          grid-template-columns: repeat(8, ${GRID_CELL_DESKTOP}px);
          gap: 4px;
          width: fit-content;
        `,
      },
    });
    this.gridPanel.appendChild(this.colorGridContainer);
    this.mainLayout.appendChild(this.gridPanel);

    // RIGHT: Results Area (wider to accommodate 4 cards per row)
    const resultsArea = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          gap: 24px;
          flex: 1;
          min-width: 0;
        `,
      },
    });

    // Reverse Match Section (shown when a dye is selected from palette drawer)
    this.reverseSection = this.createElement('div', {
      attributes: {
        style: `
          width: 100%;
          display: none;
          flex-direction: column;
          gap: 12px;
        `,
      },
    });

    const reverseHeader = this.createElement('div', {
      className: 'section-header',
      attributes: { style: 'width: 100%;' },
    });
    const reverseTitle = this.createElement('span', {
      className: 'section-title',
      textContent: 'Closest Swatches',
    });
    reverseHeader.appendChild(reverseTitle);
    this.reverseSection.appendChild(reverseHeader);

    this.reverseResultsContainer = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
        `,
      },
    });
    this.reverseSection.appendChild(this.reverseResultsContainer);
    resultsArea.appendChild(this.reverseSection);

    // 10A selection card: verdict sentence + IN-THE-CREATOR excerpt, one
    // 14px-radius surface card. Hidden until something is selected.
    this.selectionCardContainer = this.createElement('div', {
      attributes: { style: 'width: 100%; display: none;' },
    });
    resultsArea.appendChild(this.selectionCardContainer);

    // Matching Dyes Section
    const matchSection = this.createElement('div', {
      attributes: {
        style: `
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        `,
      },
    });

    // 10A header: mono CLOSEST DYES + unit tag right (plus the share button).
    const matchHeader = this.createElement('div', {
      className: 'section-header',
      attributes: {
        style: `
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        `,
      },
    });
    const matchTitle = this.createElement('span', {
      textContent: LanguageService.t('swatch.matchesHead'),
      attributes: {
        style: `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--theme-text-muted);`,
      },
    });
    matchHeader.appendChild(matchTitle);

    const matchHeaderRight = this.createElement('div', {
      attributes: { style: 'display: flex; align-items: center; gap: 10px; flex-shrink: 0;' },
    });
    // The unit is printed wherever a distance appears — identifiers, never localised.
    this.unitTagEl = this.createElement('span', {
      textContent: METHOD_TAGS[this.matchingMethod],
      attributes: {
        style: `font-family: ${MONO}; font-size: 9px; letter-spacing: 0.6px; white-space: nowrap; color: var(--theme-text-muted);`,
      },
    });
    matchHeaderRight.appendChild(this.unitTagEl);

    // Share button
    this.shareButton = document.createElement('v4-share-button') as ShareButton;
    this.shareButton.tool = 'swatch';
    this.shareButton.compact = true;
    this.shareButton.disabled = true; // Disabled until a color is selected
    matchHeaderRight.appendChild(this.shareButton);
    matchHeader.appendChild(matchHeaderRight);

    matchSection.appendChild(matchHeader);

    // Match results container — shared results grid (3-up desktop / 2-up mobile)
    this.matchResultsContainer = this.createElement('div', {
      className: 'v5-results-grid',
    });
    matchSection.appendChild(this.matchResultsContainer);
    resultsArea.appendChild(matchSection);

    // Empty state (shown when no color selected)
    this.emptyStateContainer = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          background: var(--theme-card-background, #2a2a2a);
          border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
          border-radius: 12px;
          min-width: 320px;
        `,
      },
    });
    // Empty state icon
    const emptyIcon = this.createElement('div', {
      attributes: {
        style: `
          width: 150px;
          height: 150px;
          opacity: 0.3;
          margin-bottom: 16px;
          color: var(--theme-text-muted, #888888);
        `,
      },
    });
    emptyIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="150" height="150">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" opacity="0.3"/>
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.5"/>
    </svg>`;
    this.emptyStateContainer.appendChild(emptyIcon);

    const emptyText = this.createElement('span', {
      textContent: LanguageService.t('tools.character.noColorSelected'),
      attributes: {
        style: `
          color: var(--theme-text-muted, #888888);
          font-size: 14px;
          text-align: center;
          max-width: 280px;
        `,
      },
    });
    this.emptyStateContainer.appendChild(emptyText);

    // Add empty state to results area (will be shown/hidden by updateMatchResults)
    resultsArea.appendChild(this.emptyStateContainer);

    // 10A: DYES ON THIS GLAMOUR renders here (after the matches, before the
    // handoff row) — the CharaImport below owns its content.
    const charaGlamourContainer = this.createElement('div', {
      attributes: { style: 'width: 100%;' },
    });
    resultsArea.appendChild(charaGlamourContainer);

    // 10A: SEND TO handoff row — always at the bottom of the flow.
    this.handoffContainer = this.createElement('div', {
      attributes: { style: 'width: 100%;' },
    });
    resultsArea.appendChild(this.handoffContainer);

    this.mainLayout.appendChild(resultsArea);
    right.appendChild(this.mainLayout);

    this.charaImport?.destroy();
    this.charaImport = new CharaImport(
      charaContainer,
      {
        onSlotPick: (hex, label, gridRef) => {
          this.selectionContext = { source: 'slot', hex, label, gridRef };
          if (gridRef) {
            // The selection card's excerpt centres on the slot's cell.
            this.gridExcerptAnchor = gridRef.sheetIndex;
            const target = gridRef.variant
              ? `${gridRef.paletteBase}${gridRef.variant === 'light' ? 'Light' : 'Dark'}`
              : gridRef.paletteBase;
            if (target !== (this.colorCategory as string)) {
              this.setConfig({ colorSheet: target });
            } else {
              this.updateColorGrid();
            }
          } else {
            this.gridExcerptAnchor = null;
            this.updateColorGrid();
          }
          this.selectCustomColor(hex);
        },
        onResolved: (resolved) => {
          this.charaResolved = resolved;
          this.gridExcerptAnchor = null;
          if (resolved === null && this.selectionContext?.source === 'slot') {
            this.selectionContext = null;
          }
          // Sidebar race/gender become a readout while a file is loaded —
          // push through ConfigController so the sidebar sees the flag.
          ConfigController.getInstance().setConfig('swatch', {
            fileProvided: resolved !== null,
          });
          this.updateColorGrid();
        },
        onTribeGender: (tribe, gender) => {
          // Through ConfigController so the sidebar readout follows the file.
          ConfigController.getInstance().setConfig('swatch', { race: tribe, gender });
        },
        onSubmitPalette: (dyes, name) => {
          void import('@components/preset-submission-form').then(({ showPresetSubmissionForm }) => {
            showPresetSubmissionForm(undefined, { dyes, name });
          });
        },
      },
      { glamourContainer: charaGlamourContainer }
    );
    this.charaImport.init();

    // Initialize displays
    this.updateSelectionCard();
    this.updateEmptyState();
    this.updateColorGrid();
    this.updateHandoffRow();
  }

  /**
   * Update empty state visibility based on selection
   */
  private updateEmptyState(): void {
    if (!this.emptyStateContainer || !this.matchResultsContainer) return;

    const hasSelection = this.selectedColor !== null;
    const hasResults = this.matchedDyes.length > 0;

    // Show empty state when no color selected OR when selected but no results
    // yet. A sheet-slot pick counts as an answer too (the selection card and
    // the ringed grid carry it), so it never reads as an empty workspace.
    const slotPicked = this.selectionContext?.source === 'slot';
    this.emptyStateContainer.style.display =
      (hasSelection && hasResults) || slotPicked ? 'none' : 'flex';

    // Hide match section header when showing empty state
    const matchSection = this.matchResultsContainer.parentElement;
    if (matchSection) {
      const matchHeader = matchSection.querySelector('div:first-child') as HTMLElement;
      if (matchHeader && matchHeader !== this.matchResultsContainer) {
        matchHeader.style.display = hasSelection && hasResults ? 'flex' : 'none';
      }
    }
  }

  /**
   * Update layout based on viewport width.
   * Mobile: vertical stack, 44px touch cells (scrolls sideways if needed).
   * Desktop: horizontal layout, 26px reference cells.
   */
  private updateSwatchLayout(): void {
    if (!this.mainLayout || !this.gridPanel || !this.colorGridContainer) return;

    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Mobile: Stack vertically, responsive swatch sizes
      this.mainLayout.style.flexDirection = 'column';
      this.mainLayout.style.alignItems = 'center';

      // Register sizing: cells are touch targets on mobile, so 44px is a
      // floor, not a ceiling. Where eight of them plus gaps overrun the
      // viewport the grid scrolls sideways inside its own panel rather than
      // shrinking below the target size.
      const viewportWidth = window.innerWidth;
      const containerPadding = 32; // From right panel padding
      const availableWidth = viewportWidth - containerPadding * 2;
      const clampedSwatchSize = GRID_CELL_MOBILE;

      // Update grid panel width
      this.gridPanel.style.width = '100%';
      this.gridPanel.style.maxWidth = `${availableWidth}px`;
      this.gridPanel.style.overflowX = 'auto';

      // Update grid template
      this.colorGridContainer.style.gridTemplateColumns = `repeat(8, ${clampedSwatchSize}px)`;

      // Update individual swatch sizes
      const swatches = this.colorGridContainer.querySelectorAll('button');
      swatches.forEach((swatch) => {
        (swatch as HTMLElement).style.width = `${clampedSwatchSize}px`;
        (swatch as HTMLElement).style.height = `${clampedSwatchSize}px`;
      });
    } else {
      // Desktop: Horizontal layout, fixed swatch sizes
      this.mainLayout.style.flexDirection = 'row';
      this.mainLayout.style.alignItems = 'flex-start';

      // Restore fixed width
      this.gridPanel.style.width = '';
      this.gridPanel.style.maxWidth = '';
      this.gridPanel.style.overflowX = '';

      // Restore the register's desktop cell size
      this.colorGridContainer.style.gridTemplateColumns = `repeat(8, ${GRID_CELL_DESKTOP}px)`;

      const swatches = this.colorGridContainer.querySelectorAll('button');
      swatches.forEach((swatch) => {
        (swatch as HTMLElement).style.width = `${GRID_CELL_DESKTOP}px`;
        (swatch as HTMLElement).style.height = `${GRID_CELL_DESKTOP}px`;
      });
    }
  }

  /**
   * Update the color grid
   */
  /**
   * Show or remove the Evercold deprecation notice above the swatch grid,
   * depending on whether the active category's preset palette is being
   * retired (eye/hair/skin → free color picker in the Evercold expansion,
   * January 2027).
   */
  private updateEvercoldNotice(): void {
    const parent = this.colorGridContainer?.parentElement;
    if (!parent) return;

    const existing = parent.querySelector('.evercold-notice');
    const show = EVERCOLD_DEPRECATED_CATEGORIES.includes(this.colorCategory);

    if (show && !existing && this.colorGridContainer) {
      parent.insertBefore(this.createEvercoldNotice(), this.colorGridContainer);
    } else if (!show && existing) {
      existing.remove();
    }
  }

  private createEvercoldNotice(): HTMLElement {
    const notice = this.createElement('div', {
      className: 'evercold-notice',
      attributes: {
        role: 'note',
        style: `
          margin-bottom: 12px;
          padding: 10px 14px;
          border-left: 3px solid var(--theme-primary);
          border-radius: 4px;
          background: var(--theme-background-secondary);
          font-size: 0.85rem;
          line-height: 1.5;
        `,
      },
    });

    const title = this.createElement('strong', {
      textContent: LanguageService.t('tools.character.evercoldNoticeTitle'),
      attributes: { style: 'display: block; margin-bottom: 2px; color: var(--theme-text);' },
    });
    const body = this.createElement('span', {
      textContent: LanguageService.t('tools.character.evercoldNotice'),
      attributes: { style: 'color: var(--theme-text-muted);' },
    });

    notice.appendChild(title);
    notice.appendChild(body);
    return notice;
  }

  /**
   * 10A palette rail: seven palettes with a Dark/Light range toggle for the
   * two split ones. Chips drive the same colorSheet config as the sidebar.
   */
  private renderPaletteRail(): void {
    if (!this.paletteRailContainer) return;
    clearContainer(this.paletteRailContainer);

    const PALETTES: Array<{ base: string; labelKey: string; split: boolean }> = [
      { base: 'eyeColors', labelKey: 'swatch.palEye', split: false },
      { base: 'hairColors', labelKey: 'swatch.palHair', split: false },
      { base: 'highlightColors', labelKey: 'swatch.palHighlight', split: false },
      { base: 'skinColors', labelKey: 'swatch.palSkin', split: false },
      { base: 'tattooColors', labelKey: 'swatch.palTattoo', split: false },
      { base: 'lipColors', labelKey: 'swatch.palLip', split: true },
      { base: 'facePaintColors', labelKey: 'swatch.palFacepaint', split: true },
    ];

    const current = this.colorCategory as string;
    const currentBase = current.replace(/(Dark|Light)$/, '');
    const currentRange = current.endsWith('Light') ? 'Light' : 'Dark';

    const rail = this.createElement('div', {
      attributes: { style: 'display: flex; gap: 6px; flex-wrap: wrap; align-items: center;' },
    });

    for (const palette of PALETTES) {
      const active = currentBase === palette.base;
      const chip = this.createElement('button', {
        textContent: LanguageService.t(palette.labelKey),
        attributes: {
          type: 'button',
          style: `font-size: 12px; padding: 5px 11px; border-radius: 999px; cursor: pointer; border: 1px solid ${
            active ? 'var(--theme-primary)' : 'transparent'
          }; background: ${
            active
              ? 'color-mix(in srgb, var(--theme-primary) 14%, transparent)'
              : 'var(--theme-background-secondary)'
          }; color: ${active ? 'var(--theme-primary)' : 'var(--theme-text-muted)'};`,
        },
      }) as HTMLButtonElement;
      this.on(chip, 'click', () => {
        this.gridExcerptAnchor = null;
        if (this.selectionContext?.source === 'slot') this.selectionContext = null;
        const target = palette.split ? `${palette.base}${currentRange}` : palette.base;
        this.setConfig({ colorSheet: target });
      });
      rail.appendChild(chip);
    }

    // Range toggle — only the split palettes have a Light variant.
    const activePalette = PALETTES.find((p) => p.base === currentBase);
    if (activePalette?.split) {
      const toggle = this.createElement('div', {
        attributes: {
          style:
            'display: inline-flex; border: 1px solid var(--theme-border); border-radius: 999px; overflow: hidden; margin-left: 4px;',
        },
      });
      for (const range of ['Dark', 'Light'] as const) {
        const on = currentRange === range;
        const btn = this.createElement('button', {
          textContent: LanguageService.t(
            range === 'Dark' ? 'swatch.rangeDark' : 'swatch.rangeLight'
          ),
          attributes: {
            type: 'button',
            style: `font-size: 11px; padding: 4px 10px; border: none; cursor: pointer; background: ${
              on ? 'color-mix(in srgb, var(--theme-primary) 16%, transparent)' : 'transparent'
            }; color: ${on ? 'var(--theme-primary)' : 'var(--theme-text-muted)'};`,
          },
        }) as HTMLButtonElement;
        this.on(btn, 'click', () => {
          this.gridExcerptAnchor = null;
          if (this.selectionContext?.source === 'slot') this.selectionContext = null;
          this.setConfig({ colorSheet: `${currentBase}${range}` });
        });
        toggle.appendChild(btn);
      }
      rail.appendChild(toggle);
    }

    this.paletteRailContainer.appendChild(rail);
  }

  /**
   * Pins for the current palette from the loaded .chara: sheetIndex → badge.
   * Co-located slots merge into one badge (1·2) — 84% of files put both
   * eyes on one cell, and a naive pin map would overwrite one of them.
   */
  private currentPalettePins(): Map<number, string> {
    const pins = new Map<number, string>();
    if (!this.charaResolved) return pins;

    const current = this.colorCategory as string;
    const currentBase = current.replace(/(Dark|Light)$/, '');
    const currentVariant = current.endsWith('Light')
      ? 'light'
      : current.endsWith('Dark')
        ? 'dark'
        : null;

    const baseOf = (slot: string): string | null =>
      slot === 'leftEye' || slot === 'rightEye'
        ? 'eyeColors'
        : slot === 'hair'
          ? 'hairColors'
          : slot === 'highlights'
            ? 'highlightColors'
            : slot === 'skin'
              ? 'skinColors'
              : slot === 'limbal'
                ? 'tattooColors'
                : slot === 'lip'
                  ? 'lipColors'
                  : slot === 'facePaint'
                    ? 'facePaintColors'
                    : null;

    let pinNumber = 0;
    for (const slot of this.charaResolved.slots) {
      if (slot.sheetIndex === null) continue;
      pinNumber++;
      if (baseOf(slot.slot) !== currentBase) continue;
      if (currentVariant && slot.sheetVariant && slot.sheetVariant !== currentVariant) continue;
      const existing = pins.get(slot.sheetIndex);
      pins.set(slot.sheetIndex, existing ? `${existing}·${pinNumber}` : String(pinNumber));
    }
    return pins;
  }

  private updateColorGrid(): void {
    this.renderPaletteRail();
    // Title tracks the palette — it went stale on category change before.
    if (this.gridTitleEl) {
      this.gridTitleEl.textContent = `${this.getCategoryDisplayName(this.colorCategory)} (${this.colors.length})`;
    }
    if (!this.colorGridContainer) return;
    this.updateEvercoldNotice();
    clearContainer(this.colorGridContainer);

    // Update the header label with category name and color count
    const gridHeader = this.colorGridContainer.previousElementSibling as HTMLElement;
    if (gridHeader) {
      const titleSpan = gridHeader.querySelector('.section-title');
      if (titleSpan) {
        titleSpan.textContent = `${this.getCategoryDisplayName(this.colorCategory)} (${this.colors.length})`;
      }
    }

    // 10A: pins from the loaded file (merged when co-located — both eyes on
    // one cell is the normal case). The grid itself stays full — the slow
    // path — while the five-row excerpt lives on the selection card.
    const pins = this.currentPalettePins();

    for (let sheetIndex = 0; sheetIndex < this.colors.length; sheetIndex++) {
      const color = this.colors[sheetIndex];
      const cellRow = Math.floor(sheetIndex / 8);
      const address = `R${cellRow + 1}·C${(sheetIndex % 8) + 1}`;

      const swatch = this.createElement('button', {
        className:
          'cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1',
        attributes: {
          style: `
            position: relative;
            width: ${GRID_CELL_DESKTOP}px;
            height: ${GRID_CELL_DESKTOP}px;
            background-color: ${color.hex};
            border: 1px solid var(--theme-border);
            border-radius: 4px;
          `,
          title: `${address} · ${color.hex}`,
          'data-index': String(color.index),
          'aria-label': `${address}: ${color.hex}`,
        },
      });

      const pinLabel = pins.get(sheetIndex);
      if (pinLabel) {
        swatch.appendChild(
          this.createElement('span', {
            textContent: pinLabel,
            attributes: {
              style:
                "position: absolute; top: -5px; right: -5px; font-family: 'Fragment Mono', monospace; font-size: 8px; line-height: 1; padding: 2px 4px; border-radius: 4px; background: var(--theme-primary); color: #fff; pointer-events: none;",
            },
          })
        );
      }

      swatch.addEventListener('click', () => {
        this.selectColor(color);
      });

      this.colorGridContainer.appendChild(swatch);
    }

    // Apply responsive sizing to newly created swatches
    this.updateSwatchLayout();
    // Re-run reverse match against potentially new palette, then highlight
    if (this.reverseDyeHex) {
      this.performReverseMatch();
    }
    // The selection card's excerpt reads this.colors, and the handoff chips
    // and empty state follow the selection — refresh them with the grid.
    this.updateSelectionCard();
    this.updateHandoffRow();
    this.updateEmptyState();
  }

  /**
   * The slot's palette must be the one on screen for the excerpt to be true —
   * a sidebar category switch can leave a slot context pointing elsewhere.
   */
  private gridRefMatchesCategory(ref: CharaSlotGridRef): boolean {
    const target = ref.variant
      ? `${ref.paletteBase}${ref.variant === 'light' ? 'Light' : 'Dark'}`
      : ref.paletteBase;
    return target === (this.colorCategory as string);
  }

  /** Closest pool dye to a bare colour under the current matching method. */
  private closestDyeTo(hex: string): { dye: Dye; distance: number } | null {
    let best: { dye: Dye; distance: number } | null = null;
    for (const dye of dyeService.getAllDyes()) {
      if (dye.itemID <= 0) continue;
      const distance = this.calculateColorDistance(hex, dye.hex);
      if (!best || distance < best.distance) best = { dye, distance };
    }
    return best;
  }

  /**
   * 10A selection card — the plain reading the sheet was built to write:
   * accent-soft slot tag + mono address, the verdict sentence naming the
   * closest dye, and the IN-THE-CREATOR five-row excerpt around the selected
   * cell. One 14px-radius surface card; replaces the v4 technical-info card
   * (Row/Column title, HEX/RGB/HSV/LAB rows, copy button).
   */
  private updateSelectionCard(): void {
    const container = this.selectionCardContainer;
    if (!container) return;
    clearContainer(container);

    const ctx = this.selectionContext;
    let tag = '';
    let addr = '';
    let subjectHex: string | null = null;
    let anchor: number | null = null;
    let offGrid = false;
    let slotLabel: string | null = null;

    if (ctx?.source === 'slot' && ctx.hex && ctx.label) {
      subjectHex = ctx.hex;
      slotLabel = ctx.label;
      tag = ctx.label.toUpperCase();
      if (ctx.gridRef) {
        const row = Math.floor(ctx.gridRef.sheetIndex / 8) + 1;
        const col = (ctx.gridRef.sheetIndex % 8) + 1;
        addr =
          ctx.gridRef.variant === 'light'
            ? `R${row}·C${col} · ${LanguageService.t('swatch.rangeLight')}`
            : `R${row}·C${col}`;
        if (this.gridRefMatchesCategory(ctx.gridRef)) {
          anchor = ctx.gridRef.sheetIndex;
        }
      } else {
        // An arbitrary colour has no address — OFF GRID, never a fake one.
        offGrid = true;
        addr = LanguageService.t('swatch.offGrid');
      }
    } else if (this.selectedColor) {
      subjectHex = this.selectedColor.hex;
      anchor = this.selectedColor.index;
      tag = `${this.getCategoryDisplayName(this.colorCategory).toUpperCase()} #${this.selectedColor.index}`;
      addr = `R${Math.floor(this.selectedColor.index / 8) + 1}·C${(this.selectedColor.index % 8) + 1}`;
    }

    if (!subjectHex) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'block';

    // Closest dye for the sentence: the top forward match where one exists,
    // otherwise computed against the dye pool with the current method.
    let bestName: string | null = null;
    let bestDelta: string | null = null;
    if (ctx?.source !== 'slot' && this.matchedDyes.length > 0) {
      const top = this.matchedDyes[0];
      bestName = LanguageService.getDyeName(top.dye.itemID) || top.dye.name;
      bestDelta = top.distance.toFixed(1);
    } else {
      const best = this.closestDyeTo(subjectHex);
      if (best) {
        bestName = LanguageService.getDyeName(best.dye.itemID) || best.dye.name;
        bestDelta = best.distance.toFixed(1);
      }
    }

    const palette = this.getCategoryDisplayName(this.colorCategory);
    let sentence: string;
    if (offGrid && slotLabel) {
      sentence =
        bestName && bestDelta
          ? EN_SEL_SENTENCE_OFF(slotLabel, bestName, bestDelta)
          : `${slotLabel} · ${subjectHex.toUpperCase()}`;
    } else if (slotLabel) {
      sentence =
        bestName && bestDelta
          ? EN_SEL_SENTENCE(slotLabel, `${palette} ${addr}`, bestName, bestDelta)
          : `${slotLabel} · ${palette} ${addr}`;
    } else {
      sentence =
        bestName && bestDelta
          ? EN_SEL_SENTENCE_CELL(`${palette} ${addr}`, bestName, bestDelta)
          : `${palette} ${addr}`;
    }

    const note = offGrid
      ? `${subjectHex.toUpperCase()} · ${LanguageService.t('swatch.offGridNote')}`
      : subjectHex.toUpperCase();

    const card = this.createElement('div', {
      attributes: {
        style:
          'padding: 12px 13px; border-radius: 14px; background: var(--theme-card-background); border: 1px solid var(--theme-border); box-sizing: border-box; width: 100%;',
      },
    });
    const inner = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; flex-wrap: wrap;',
      },
    });

    // Left column: tag + address, sentence, note.
    const left = this.createElement('div', {
      attributes: {
        style: 'flex: 1; min-width: 180px; display: flex; flex-direction: column; gap: 6px;',
      },
    });
    const tagRow = this.createElement('div', {
      attributes: { style: 'display: flex; align-items: center; gap: 7px; flex-wrap: wrap;' },
    });
    tagRow.appendChild(
      this.createElement('span', {
        textContent: tag,
        attributes: {
          style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: color-mix(in srgb, var(--theme-primary) 14%, transparent); color: var(--theme-primary); white-space: nowrap;`,
        },
      })
    );
    tagRow.appendChild(
      this.createElement('span', {
        textContent: addr,
        attributes: {
          style: `font-family: ${MONO}; font-size: 9.5px; letter-spacing: 0.5px; color: ${
            offGrid ? '#F4BF4F' : 'var(--theme-text-muted)'
          }; white-space: nowrap;`,
        },
      })
    );
    left.appendChild(tagRow);
    left.appendChild(
      this.createElement('div', {
        textContent: sentence,
        attributes: {
          style: `font-family: ${SANS}; font-weight: 600; font-size: 17px; line-height: 1.25; color: var(--theme-text);`,
        },
      })
    );
    left.appendChild(
      this.createElement('div', {
        textContent: note,
        attributes: {
          style: 'font-size: 11px; line-height: 1.5; color: var(--theme-text-muted);',
        },
      })
    );
    inner.appendChild(left);

    // Right column: IN THE CREATOR excerpt (only where an address exists).
    if (anchor !== null && this.colors.length > 0) {
      const right = this.createElement('div', {
        attributes: {
          style: 'flex-shrink: 0; display: flex; flex-direction: column; gap: 5px;',
        },
      });
      right.appendChild(
        this.createElement('span', {
          textContent: LanguageService.t('swatch.inGrid'),
          attributes: {
            style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted);`,
          },
        })
      );
      right.appendChild(this.buildSelectionExcerpt(anchor));
      inner.appendChild(right);
    }

    card.appendChild(inner);
    container.appendChild(card);
  }

  /**
   * Five-row × 8-col excerpt of 22px cells around the anchor — enough to
   * count to the cell in the creator, none of the wall. Row numbers left,
   * column numbers top; the selected row/col labels take the accent; the
   * selected cell is ringed. Reuses the sheet-index anchor machinery.
   */
  private buildSelectionExcerpt(anchor: number): HTMLElement {
    const totalRows = Math.ceil(this.colors.length / 8);
    const anchorRow = Math.floor(anchor / 8);
    const anchorCol = anchor % 8;
    const rowCount = Math.min(5, totalRows);
    const rowStart = Math.max(0, Math.min(anchorRow - 2, totalRows - rowCount));

    const grid = this.createElement('div', {
      attributes: {
        style:
          'display: grid; grid-template-columns: 16px repeat(8, 22px); gap: 3px; align-items: center; justify-items: center;',
      },
    });
    grid.appendChild(this.createElement('span'));
    for (let col = 0; col < 8; col++) {
      grid.appendChild(
        this.createElement('span', {
          textContent: String(col + 1),
          attributes: {
            style: `font-family: ${MONO}; font-size: 8.5px; color: ${
              col === anchorCol ? 'var(--theme-primary)' : 'var(--theme-text-muted)'
            };`,
          },
        })
      );
    }
    for (let row = rowStart; row < rowStart + rowCount; row++) {
      grid.appendChild(
        this.createElement('span', {
          textContent: String(row + 1),
          attributes: {
            style: `font-family: ${MONO}; font-size: 9px; justify-self: end; padding-right: 2px; color: ${
              row === anchorRow ? 'var(--theme-primary)' : 'var(--theme-text-muted)'
            };`,
          },
        })
      );
      for (let col = 0; col < 8; col++) {
        const sheetIndex = row * 8 + col;
        const color = this.colors[sheetIndex];
        if (!color) {
          grid.appendChild(
            this.createElement('span', { attributes: { style: 'width: 22px; height: 22px;' } })
          );
          continue;
        }
        const hit = sheetIndex === anchor;
        const cell = this.createElement('button', {
          attributes: {
            type: 'button',
            title: `R${row + 1}·C${col + 1} · ${color.hex}`,
            style: `width: 22px; height: 22px; padding: 0; border-radius: 5px; cursor: pointer; background: ${color.hex}; border: 1px solid ${
              hit ? 'var(--theme-primary)' : 'var(--theme-border)'
            }; box-shadow: ${
              hit ? '0 0 0 2px var(--theme-primary)' : 'inset 0 0 0 1px rgba(127, 127, 127, 0.22)'
            };`,
          },
        }) as HTMLButtonElement;
        this.on(cell, 'click', () => this.selectColor(color));
        grid.appendChild(cell);
      }
    }
    return grid;
  }

  /**
   * SEND TO targets on the 5.0 stainID share grammar — mirrors the handoff
   * row preset-detail builds (harmony ?dye=&harmony=, comparison and
   * accessibility ?dyes=, gradient ?start=&end=).
   */
  private handoffTargets(ids: number[]): Array<{ icon: string; label: string; url: string }> {
    return [
      {
        icon: ICON_TOOL_HARMONY,
        label: LanguageService.t('tools.harmony.title'),
        url: ids.length > 0 ? `/harmony/?dye=${ids[0]}&harmony=complementary` : '',
      },
      {
        icon: ICON_TOOL_COMPARISON,
        label: LanguageService.t('tools.comparison.title'),
        url: ids.length > 0 ? `/comparison/?dyes=${ids.slice(0, 4).join(',')}` : '',
      },
      {
        icon: ICON_TOOL_GRADIENT,
        label: LanguageService.t('tools.gradient.title'),
        url:
          ids.length >= 2
            ? `/gradient/?start=${ids[0]}&end=${ids[1]}`
            : ids.length > 0
              ? '/gradient/'
              : '',
      },
      {
        icon: ICON_TOOL_ACCESSIBILITY,
        label: LanguageService.t('tools.accessibility.title'),
        url: ids.length > 0 ? `/accessibility/?dyes=${ids.slice(0, 4).join(',')}` : '',
      },
    ];
  }

  /**
   * 10A SEND TO row — always present at the flow's bottom so the page never
   * dead-ends. Chips carry the matched dyes' stainIDs and dim until there
   * is a selection to carry.
   */
  private updateHandoffRow(): void {
    const container = this.handoffContainer;
    if (!container) return;
    clearContainer(container);

    container.appendChild(
      this.createElement('div', {
        textContent: LanguageService.t('swatch.sendTo'),
        attributes: {
          style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-bottom: 7px;`,
        },
      })
    );

    const row = this.createElement('div', {
      attributes: { style: 'display: flex; align-items: center; gap: 7px; flex-wrap: wrap;' },
    });
    let ids = this.matchedDyes
      .map((match) => match.dye.stainID)
      .filter((id): id is number => typeof id === 'number');
    // A sheet-slot pick is a selection too — carry its closest dye when the
    // forward matcher has nothing (reverse mode fills the grid, not results).
    if (ids.length === 0 && this.selectionContext?.source === 'slot' && this.selectionContext.hex) {
      const best = this.closestDyeTo(this.selectionContext.hex);
      if (best && typeof best.dye.stainID === 'number') ids = [best.dye.stainID];
    }

    for (const target of this.handoffTargets(ids)) {
      const enabled = target.url !== '';
      const chip = this.createElement('button', {
        attributes: {
          type: 'button',
          style: `display: flex; align-items: center; gap: 7px; height: 38px; padding: 0 12px; border-radius: 9px; border: 1px solid var(--theme-border); background: var(--theme-card-background); color: var(--theme-text); font-size: 12px; font-weight: 600; font-family: inherit; cursor: ${
            enabled ? 'pointer' : 'not-allowed'
          }; opacity: ${enabled ? '1' : '0.45'};`,
        },
      }) as HTMLButtonElement;
      chip.disabled = !enabled;
      const glyph = this.createElement('span', {
        attributes: {
          style:
            'display: block; width: 15px; height: 15px; flex-shrink: 0; color: var(--theme-text-muted);',
        },
      });
      glyph.innerHTML = target.icon || '';
      chip.appendChild(glyph);
      chip.appendChild(this.createElement('span', { textContent: target.label }));
      if (enabled) {
        this.on(chip, 'click', () => window.location.assign(target.url));
      }
      row.appendChild(chip);
    }
    container.appendChild(row);
  }

  /**
   * Update match results display using v4-result-card components
   */
  private updateMatchResults(): void {
    if (!this.matchResultsContainer) return;
    clearContainer(this.matchResultsContainer);

    // Update empty state visibility
    this.updateEmptyState();

    // The unit is printed wherever a distance appears; the handoff chips
    // carry the current matches' stainIDs.
    if (this.unitTagEl) this.unitTagEl.textContent = METHOD_TAGS[this.matchingMethod];
    this.updateHandoffRow();

    if (this.matchedDyes.length === 0) {
      return;
    }

    for (const match of this.matchedDyes) {
      // Create v4-result-card element
      const card = document.createElement('v4-result-card') as HTMLElement;
      card.setAttribute('compact', '');
      card.setAttribute('show-actions', 'true');
      // Make primary button open context menu (same as the ... button)
      card.setAttribute('primary-opens-menu', 'true');
      card.setAttribute('primary-action-label', 'Explore Dye');

      // Get price data for this dye
      const priceDataForDye = this.priceData.get(match.dye.itemID);

      // Set data property (ResultCardData interface)
      const cardData: ResultCardData = {
        dye: match.dye,
        originalColor: this.selectedColor?.hex || match.dye.hex,
        matchedColor: match.dye.hex,
        deltaE: match.distance,
        matchingMethod: this.matchingMethod,
        // Resolve worldId to actual world name
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
      (card as unknown as { showHue: boolean }).showHue = this.displayOptions.showHue ?? true;
      (card as unknown as { showStain: boolean }).showStain = this.displayOptions.showStain ?? true;
      (card as unknown as { showConsolidation: boolean }).showConsolidation =
        this.displayOptions.showSpectrum ?? true;
      (card as unknown as { showPrice: boolean }).showPrice = this.displayOptions.showPrice;
      (card as unknown as { showAcquisition: boolean }).showAcquisition =
        this.displayOptions.showAcquisition;

      // Listen for context actions (both primary button and context menu trigger this)
      card.addEventListener('context-action', ((
        e: CustomEvent<{ action: ContextAction; dye: Dye }>
      ) => {
        this.handleContextAction(e.detail.action, e.detail.dye);
      }) as EventListener);

      this.matchResultsContainer.appendChild(card);
    }
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

  // ============================================================================
  // Mobile Drawer
  // ============================================================================

  private renderDrawerContent(): void {
    const drawer = this.options.drawerContent;
    if (!drawer) return;

    // Race section
    const raceContainer = this.createElement('div');
    drawer.appendChild(raceContainer);
    this.mobileRacePanel = new CollapsiblePanel(raceContainer, {
      title: LanguageService.t('tools.character.selectSubrace'),
      storageKey: 'v3_character_mobile_race_panel',
      defaultOpen: true,
      icon: ICON_TOOL_CHARACTER,
    });
    this.mobileRacePanel.init();
    const mobileRaceContent = this.createElement('div');
    this.renderMobileRaceSection(mobileRaceContent);
    this.mobileRacePanel.setContent(mobileRaceContent);

    // Category section
    const categoryContainer = this.createElement('div');
    drawer.appendChild(categoryContainer);
    this.mobileCategoryPanel = new CollapsiblePanel(categoryContainer, {
      title: LanguageService.t('tools.character.colorCategory'),
      storageKey: 'v3_character_mobile_category_panel',
      defaultOpen: true,
      icon: ICON_PALETTE,
    });
    this.mobileCategoryPanel.init();
    const mobileCategoryContent = this.createElement('div');
    this.renderMobileCategorySection(mobileCategoryContent);
    this.mobileCategoryPanel.setContent(mobileCategoryContent);

    // Market Board
    const marketContainer = this.createElement('div');
    drawer.appendChild(marketContainer);
    this.mobileMarketPanel = new CollapsiblePanel(marketContainer, {
      title: LanguageService.t('marketBoard.title'),
      storageKey: 'v3_character_mobile_market',
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
      () => this.showPrices && this.matchedDyes.length > 0,
      () => void this.fetchPrices(this.matchedDyes.map((m) => m.dye)),
      {
        onPricesToggled: () => {
          if (this.showPrices && this.matchedDyes.length > 0) {
            void this.fetchPrices(this.matchedDyes.map((m) => m.dye));
          } else {
            this.updateMatchResults();
          }
        },
        onServerChanged: () => {
          if (this.selectedColor) {
            this.findMatchingDyes();
          }
        },
        onRefreshRequested: () => {
          if (this.showPrices && this.matchedDyes.length > 0) {
            this.priceData.clear();
            void this.fetchPrices(this.matchedDyes.map((m) => m.dye));
          }
        },
      }
    );

    this.mobileMarketPanel.setContent(mobileMarketContent);
  }

  /**
   * Render mobile race section (mirrors desktop)
   */
  private renderMobileRaceSection(container: HTMLElement): void {
    const section = this.createElement('div', { className: 'space-y-4 p-2' });

    // Subrace selector
    const subraceGroup = this.createElement('div', { className: 'space-y-2' });
    const subraceLabel = this.createElement('label', {
      className: 'block text-sm font-medium',
      textContent: LanguageService.t('tools.character.selectSubrace'),
      attributes: { style: 'color: var(--theme-text);' },
    });
    subraceGroup.appendChild(subraceLabel);

    this.mobileSubraceSelect = this.createElement('select', {
      className: 'w-full p-2 rounded-lg border text-sm',
      attributes: {
        style:
          'background: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);',
      },
    }) as HTMLSelectElement;

    // Group subraces by race with localized names
    for (const group of RACE_GROUPS) {
      const localizedRaceName = LanguageService.getRace(group.raceKey);
      const optgroup = this.createElement('optgroup', {
        attributes: { label: localizedRaceName },
      }) as HTMLOptGroupElement;

      for (const subrace of group.subraces) {
        const clanKey = SUBRACE_TO_CLAN_KEY[subrace];
        const localizedClanName = LanguageService.getClan(clanKey);
        const option = this.createElement('option', {
          textContent: localizedClanName,
          attributes: { value: subrace },
        }) as HTMLOptionElement;
        if (subrace === this.subrace) {
          option.selected = true;
        }
        optgroup.appendChild(option);
      }
      this.mobileSubraceSelect.appendChild(optgroup);
    }

    this.mobileSubraceSelect.addEventListener('change', () => {
      this.subrace = this.mobileSubraceSelect!.value as SubRace;
      StorageService.setItem(STORAGE_KEYS.subrace, this.subrace);
      this.syncDesktopSelectors();
      void this.loadColors().then(() => {
        this.updateColorGrid();
        this.clearSelection();
      });
    });

    subraceGroup.appendChild(this.mobileSubraceSelect);
    section.appendChild(subraceGroup);

    // Gender selector
    const genderGroup = this.createElement('div', { className: 'space-y-2' });
    const genderLabel = this.createElement('label', {
      className: 'block text-sm font-medium',
      textContent: LanguageService.t('tools.character.selectGender'),
      attributes: { style: 'color: var(--theme-text);' },
    });
    genderGroup.appendChild(genderLabel);

    this.mobileGenderSelect = this.createElement('select', {
      className: 'w-full p-2 rounded-lg border text-sm',
      attributes: {
        style:
          'background: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);',
      },
    }) as HTMLSelectElement;

    const maleOption = this.createElement('option', {
      textContent: LanguageService.t('tools.character.male'),
      attributes: { value: 'Male' },
    }) as HTMLOptionElement;
    if (this.gender === 'Male') maleOption.selected = true;

    const femaleOption = this.createElement('option', {
      textContent: LanguageService.t('tools.character.female'),
      attributes: { value: 'Female' },
    }) as HTMLOptionElement;
    if (this.gender === 'Female') femaleOption.selected = true;

    this.mobileGenderSelect.appendChild(maleOption);
    this.mobileGenderSelect.appendChild(femaleOption);

    this.mobileGenderSelect.addEventListener('change', () => {
      this.gender = this.mobileGenderSelect!.value as Gender;
      StorageService.setItem(STORAGE_KEYS.gender, this.gender);
      this.syncDesktopSelectors();
      void this.loadColors().then(() => {
        this.updateColorGrid();
        this.clearSelection();
      });
    });

    genderGroup.appendChild(this.mobileGenderSelect);
    section.appendChild(genderGroup);

    this.updateGenderVisibility(genderGroup);
    container.appendChild(section);
  }

  /**
   * Render mobile category section
   */
  private renderMobileCategorySection(container: HTMLElement): void {
    const section = this.createElement('div', { className: 'space-y-2 p-2' });

    this.mobileCategorySelect = this.createElement('select', {
      className: 'w-full p-2 rounded-lg border text-sm',
      attributes: {
        style:
          'background: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);',
      },
    }) as HTMLSelectElement;

    const categories: Array<{ value: ColorCategory; label: string }> = [
      { value: 'eyeColors', label: LanguageService.t('tools.character.eyeColors') },
      {
        value: 'hairColors',
        label: LanguageService.t('tools.character.hairColors'),
      },
      {
        value: 'skinColors',
        label: LanguageService.t('tools.character.skinColors'),
      },
      {
        value: 'highlightColors',
        label: LanguageService.t('tools.character.highlightColors'),
      },
      {
        value: 'lipColorsDark',
        label: LanguageService.t('tools.character.lipColorsDark'),
      },
      {
        value: 'lipColorsLight',
        label: LanguageService.t('tools.character.lipColorsLight'),
      },
      {
        value: 'tattooColors',
        label: LanguageService.t('tools.character.tattooColors'),
      },
      {
        value: 'facePaintColorsDark',
        label: LanguageService.t('tools.character.facePaintDark'),
      },
      {
        value: 'facePaintColorsLight',
        label: LanguageService.t('tools.character.facePaintLight'),
      },
    ];

    for (const cat of categories) {
      const option = this.createElement('option', {
        textContent: cat.label,
        attributes: { value: cat.value },
      }) as HTMLOptionElement;
      if (cat.value === this.colorCategory) {
        option.selected = true;
      }
      this.mobileCategorySelect.appendChild(option);
    }

    this.mobileCategorySelect.addEventListener('change', () => {
      this.colorCategory = this.mobileCategorySelect!.value as ColorCategory;
      StorageService.setItem(STORAGE_KEYS.colorCategory, this.colorCategory);
      this.syncDesktopSelectors();
      void this.loadColors().then(() => {
        this.updateColorGrid();
        this.clearSelection();
      });
    });

    section.appendChild(this.mobileCategorySelect);
    container.appendChild(section);
  }

  // ============================================================================
  // Data Loading & Matching
  // ============================================================================

  /**
   * Load colors based on current category/race/gender
   */
  private async loadColors(): Promise<void> {
    if (RACE_SPECIFIC_CATEGORIES.includes(this.colorCategory)) {
      if (this.colorCategory === 'hairColors') {
        this.colors = await this.characterColorService.getHairColors(this.subrace, this.gender);
      } else if (this.colorCategory === 'skinColors') {
        this.colors = await this.characterColorService.getSkinColors(this.subrace, this.gender);
      }
    } else {
      // Shared colors
      switch (this.colorCategory) {
        case 'eyeColors':
          this.colors = this.characterColorService.getEyeColors();
          break;
        case 'highlightColors':
          this.colors = this.characterColorService.getHighlightColors();
          break;
        case 'lipColorsDark':
          this.colors = this.characterColorService.getLipColorsDark();
          break;
        case 'lipColorsLight':
          this.colors = this.characterColorService.getLipColorsLight();
          break;
        case 'tattooColors':
          this.colors = this.characterColorService.getTattooColors();
          break;
        case 'facePaintColorsDark':
          this.colors = this.characterColorService.getFacePaintColorsDark();
          break;
        case 'facePaintColorsLight':
          this.colors = this.characterColorService.getFacePaintColorsLight();
          break;
      }
    }

    logger.info(`[CharacterTool] Loaded ${this.colors.length} colors for ${this.colorCategory}`);
  }

  /**
   * Select a color and find matching dyes
   */
  private selectColor(color: CharacterColor): void {
    this.selectedColor = color;
    this.selectionContext = { source: 'grid' };
    StorageService.setItem(STORAGE_KEYS.selectedColorIndex, color.index);

    // Highlight selected swatch
    this.updateSwatchSelection();
    this.findMatchingDyes();
    this.updateSelectionCard();
    this.updateShareButton();

    // On mobile, scroll to results section so user can see the matches
    if (window.innerWidth < 768 && this.selectionCardContainer) {
      // Small delay to allow DOM updates before scrolling
      this.safeTimeout(() => {
        this.selectionCardContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }

  /**
   * Update swatch selection highlighting
   */
  private updateSwatchSelection(): void {
    if (!this.colorGridContainer) return;

    const swatches = this.colorGridContainer.querySelectorAll('button');
    swatches.forEach((swatch) => {
      const index = parseInt(swatch.getAttribute('data-index') || '-1', 10);
      if (index === this.selectedColor?.index) {
        swatch.style.outline = '3px solid var(--theme-primary)';
        swatch.style.outlineOffset = '2px';
        swatch.style.zIndex = '10';
      } else {
        swatch.style.outline = 'none';
        swatch.style.outlineOffset = '0';
        swatch.style.zIndex = 'auto';
      }
    });
  }

  /**
   * Find dyes matching the selected color
   */
  private findMatchingDyes(): void {
    if (!this.selectedColor) {
      this.matchedDyes = [];
      this.updateMatchResults();
      return;
    }

    // Request extra results if filters are active, then filter and trim
    const requestCount = hasActiveFilters(this.dyeFiltersConfig)
      ? Math.min(this.maxResults * 3, 136)
      : this.maxResults;

    let matches = this.characterColorService.findClosestDyes(this.selectedColor, dyeService, {
      count: requestCount,
      matchingMethod: this.matchingMethod,
    });

    // Apply dye filters
    if (hasActiveFilters(this.dyeFiltersConfig)) {
      matches = matches.filter((m) => !isDyeExcluded(this.dyeFiltersConfig, m.dye));
      matches = matches.slice(0, this.maxResults);
    }

    this.matchedDyes = matches;

    logger.info(`[CharacterTool] Found ${this.matchedDyes.length} matching dyes`);
    this.updateMatchResults();

    // Fetch prices if enabled
    if (this.showPrices && this.matchedDyes.length > 0) {
      void this.fetchPrices(this.matchedDyes.map((m) => m.dye));
    }
  }

  /**
   * Fetch prices for matched dyes
   */
  private async fetchPrices(dyes: Dye[]): Promise<void> {
    const marketBoard = this.marketBoard || this.mobileMarketBoard;
    if (!marketBoard) return;

    try {
      const prices = await marketBoard.fetchPricesForDyes(dyes);
      prices.forEach((data, itemId) => {
        this.priceData.set(itemId, data);
      });
      this.updateMatchResults();
    } catch (error) {
      logger.warn('[CharacterTool] Error fetching prices:', error);
    }
  }

  /**
   * Clear the current selection
   */
  private clearSelection(): void {
    this.selectedColor = null;
    this.matchedDyes = [];
    this.selectionContext = null;
    this.updateSelectionCard();
    this.updateMatchResults();
    this.updateShareButton();
  }

  /**
   * Clear all selections and return to empty state.
   * Called when "Clear All Dyes" button is clicked in Color Palette.
   * Public wrapper for clearSelection() to match other tools' interface.
   */
  public clearDyes(): void {
    this.clearSelection();
    this.clearReverseMatch();
    logger.info('[SwatchTool] All selections cleared');
  }

  // ============================================================================
  // Share Functionality
  // ============================================================================

  /**
   * Get parameters for generating a share URL
   * Includes color sheet info so recipients see the correct palette
   */
  private getShareParams(): Record<string, unknown> {
    if (!this.selectedColor) return {};

    // Confirmed grammar: slot + i. A character swatch is identified by its
    // cell address, not its hex — two cells can carry the same colour, and
    // a hex lookup silently misses when the sheet reloads under a different
    // tribe/gender. `i` is the index the R·C address is derived from.
    const params: Record<string, unknown> = {
      slot: this.colorCategory,
      i: this.selectedColor.index,
      algo: this.matchingMethod,
      limit: this.maxResults,
    };

    // For race-specific sheets (hair, skin), include race/gender info
    if (RACE_SPECIFIC_CATEGORIES.includes(this.colorCategory)) {
      params.race = this.subrace;
      params.gender = this.gender;
    }

    return params;
  }

  /**
   * Update share button state based on current selection
   */
  private updateShareButton(): void {
    if (this.shareButton) {
      this.shareButton.shareParams = this.getShareParams();
      this.shareButton.disabled = !this.selectedColor;
    }
  }

  /**
   * Load tool state from share URL parameters
   * Handles: color, sheet, race, gender, algo, limit
   */
  private async loadFromShareUrl(): Promise<void> {
    const parsed = ShareService.getShareParamsFromCurrentUrl();
    if (!parsed || parsed.tool !== 'swatch') return;

    // Use generic params since we have extended params beyond SwatchShareParams
    const params = parsed.params as Record<string, string | number | boolean | string[] | number[]>;
    let hasChanges = false;
    let needsReload = false;

    // Load the slot (colour sheet) — FIRST, before the colours load.
    // `sheet` is the pre-5.0 alias for the same value; both are accepted.
    const slotParam = params.slot ?? params.sheet;
    if (slotParam && typeof slotParam === 'string') {
      const validSheets: ColorCategory[] = [
        'eyeColors',
        'hairColors',
        'skinColors',
        'highlightColors',
        'lipColorsDark',
        'lipColorsLight',
        'tattooColors',
        'facePaintColorsDark',
        'facePaintColorsLight',
      ];
      if (validSheets.includes(slotParam as ColorCategory)) {
        const newCategory = slotParam as ColorCategory;
        if (newCategory !== this.colorCategory) {
          this.colorCategory = newCategory;
          StorageService.setItem(STORAGE_KEYS.colorCategory, newCategory);
          needsReload = true;
          hasChanges = true;
          logger.info(`[SwatchTool] Switched to color sheet: ${newCategory}`);
        }
      }
    }

    // For race-specific sheets, load race and gender
    if (RACE_SPECIFIC_CATEGORIES.includes(this.colorCategory)) {
      // Load race (subrace) if specified
      if (params.race && typeof params.race === 'string') {
        const validRaces: SubRace[] = [
          'Midlander',
          'Highlander',
          'Wildwood',
          'Duskwight',
          'Plainsfolk',
          'Dunesfolk',
          'SeekerOfTheSun',
          'KeeperOfTheMoon',
          'SeaWolf',
          'Hellsguard',
          'Raen',
          'Xaela',
          'Helions',
          'TheLost',
          'Rava',
          'Veena',
        ];
        if (validRaces.includes(params.race as SubRace)) {
          const newRace = params.race as SubRace;
          if (newRace !== this.subrace) {
            this.subrace = newRace;
            StorageService.setItem(STORAGE_KEYS.subrace, newRace);
            needsReload = true;
            hasChanges = true;
          }
        }
      }

      // Load gender if specified
      if (params.gender && typeof params.gender === 'string') {
        const validGenders: Gender[] = ['Male', 'Female'];
        if (validGenders.includes(params.gender as Gender)) {
          const newGender = params.gender as Gender;
          if (newGender !== this.gender) {
            this.gender = newGender;
            StorageService.setItem(STORAGE_KEYS.gender, newGender);
            needsReload = true;
            hasChanges = true;
          }
        }
      }
    }

    // Reload colors if sheet/race/gender changed
    if (needsReload) {
      await this.loadColors();
      // Sync UI selectors with new values
      this.syncMobileSelectors();
      this.syncDesktopSelectors();
    }

    // Load matching algorithm if specified. One vocabulary, six methods —
    // normalize migrates legacy stored/shared spellings instead of dropping
    // every link that isn't one of the three the old whitelist knew.
    if (params.algo && typeof params.algo === 'string') {
      this.matchingMethod = normalizeMatchingMethod(params.algo);
      hasChanges = true;
    }

    // Load max results limit if specified
    if (typeof params.limit === 'number' && params.limit > 0 && params.limit <= 20) {
      this.maxResults = params.limit;
      StorageService.setItem(STORAGE_KEYS.maxResults, params.limit);
      hasChanges = true;
    }

    // Load the cell by index — the confirmed grammar's identity handle.
    const indexRaw = params.i;
    const sharedIndex =
      typeof indexRaw === 'number'
        ? indexRaw
        : typeof indexRaw === 'string' && /^\d+$/.test(indexRaw)
          ? Number(indexRaw)
          : null;
    if (sharedIndex !== null) {
      if (this.colors.length === 0) {
        await this.loadColors();
      }
      const cell = this.colors.find((c) => c.index === sharedIndex);
      if (cell) {
        this.selectedColor = cell;
        this.selectionContext = { source: 'grid' };
        StorageService.setItem(STORAGE_KEYS.selectedColorIndex, cell.index);
        hasChanges = true;
        logger.info(`[SwatchTool] Loaded cell ${sharedIndex} from share URL`);
      } else {
        logger.warn(
          `[SwatchTool] Shared cell ${sharedIndex} is outside the ${this.colorCategory} sheet`
        );
      }
    }

    // Legacy hex links (pre-slot+i) still resolve by colour match
    const sharedHexRaw = params.hex ?? params.color; // `color` accepted as legacy alias
    if (sharedIndex === null && sharedHexRaw && typeof sharedHexRaw === 'string') {
      // Normalize hex color (add # prefix if missing)
      const hexColor = ShareService.parseSharedHex(sharedHexRaw);
      if (!hexColor) return;

      // Ensure colors are loaded before searching
      if (this.colors.length === 0) {
        await this.loadColors();
      }

      // Find matching CharacterColor by hex in the current color sheet
      const matchingColor = this.colors.find((c) => c.hex.toLowerCase() === hexColor.toLowerCase());

      if (matchingColor) {
        // Found the color - select it
        this.selectedColor = matchingColor;
        this.selectionContext = { source: 'grid' };
        hasChanges = true;
        logger.info(`[SwatchTool] Loaded color from share URL: ${hexColor}`);
      } else {
        // Color not found - log warning with helpful info
        logger.warn(
          `[SwatchTool] Shared color ${hexColor} not found in color sheet (${this.colorCategory})`
        );
      }
    }

    if (hasChanges) {
      // Update UI to reflect loaded state
      this.updateColorGrid();
      this.updateSwatchSelection();
      this.updateShareButton();

      // Find matching dyes if a color was selected
      if (this.selectedColor) {
        this.findMatchingDyes();
      }
      this.updateSelectionCard();
    }
  }

  // ============================================================================
  // Sync Helpers
  // ============================================================================

  /**
   * Sync mobile selectors with desktop values
   */
  private syncMobileSelectors(): void {
    if (this.mobileSubraceSelect) {
      this.mobileSubraceSelect.value = this.subrace;
    }
    if (this.mobileGenderSelect) {
      this.mobileGenderSelect.value = this.gender;
    }
    if (this.mobileCategorySelect) {
      this.mobileCategorySelect.value = this.colorCategory;
    }
  }

  /**
   * Sync desktop selectors with mobile values
   */
  private syncDesktopSelectors(): void {
    if (this.subraceSelect) {
      this.subraceSelect.value = this.subrace;
    }
    if (this.genderSelect) {
      this.genderSelect.value = this.gender;
    }
    if (this.categorySelect) {
      this.categorySelect.value = this.colorCategory;
    }
  }

  /**
   * Get localized category display name
   */
  private getCategoryDisplayName(category: ColorCategory): string {
    const _key = `tools.character.${category.replace(/Colors?$/, 'Colors')}`;
    const labels: Record<ColorCategory, string> = {
      eyeColors: LanguageService.t('tools.character.eyeColors'),
      hairColors: LanguageService.t('tools.character.hairColors'),
      skinColors: LanguageService.t('tools.character.skinColors'),
      highlightColors: LanguageService.t('tools.character.highlightColors'),
      lipColorsDark: LanguageService.t('tools.character.lipColorsDark'),
      lipColorsLight: LanguageService.t('tools.character.lipColorsLight'),
      tattooColors: LanguageService.t('tools.character.tattooColors'),
      facePaintColorsDark: LanguageService.t('tools.character.facePaintDark'),
      facePaintColorsLight: LanguageService.t('tools.character.facePaintLight'),
    };
    return labels[category];
  }
}
