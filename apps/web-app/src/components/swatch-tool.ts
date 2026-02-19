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
import { CharacterColorService } from '@xivdyetools/core';
import type { CharacterColor, CharacterColorMatch, SubRace, Gender } from '@xivdyetools/types';
import { ICON_TOOL_CHARACTER } from '@shared/tool-icons';
import { ICON_PALETTE, ICON_MARKET } from '@shared/ui-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, PriceData } from '@shared/types';
import type {
  SwatchConfig,
  DisplayOptionsConfig,
  MarketConfig,
  MatchingMethod,
} from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';
import type { ResultCardData, ContextAction } from '@components/v4/result-card';
// Import v4-result-card custom element to ensure it's registered
import '@components/v4/result-card';
// Import v4-share-button for share functionality
import '@components/v4/share-button';
import type { ShareButton } from '@components/v4/share-button';
import { ShareService } from '@services/share-service';

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
  Helion: 'helion',
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
  { raceKey: 'hrothgar', subraces: ['Helion', 'TheLost'] },
  { raceKey: 'viera', subraces: ['Rava', 'Veena'] },
];

/**
 * Categories that are race-specific (need subrace/gender)
 */
const RACE_SPECIFIC_CATEGORIES: ColorCategory[] = ['hairColors', 'skinColors'];

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
  private matchingMethod: MatchingMethod = 'oklab';

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
  private selectedColorDisplay: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private shareButton: ShareButton | null = null;
  private subraceSelect: HTMLSelectElement | null = null;
  private genderSelect: HTMLSelectElement | null = null;
  private categorySelect: HTMLSelectElement | null = null;

  // Layout containers for responsive behavior
  private mainLayout: HTMLElement | null = null;
  private gridPanel: HTMLElement | null = null;

  // Mobile DOM References
  private mobileSubraceSelect: HTMLSelectElement | null = null;
  private mobileGenderSelect: HTMLSelectElement | null = null;
  private mobileCategorySelect: HTMLSelectElement | null = null;

  // Subscriptions
  private languageUnsubscribe: (() => void) | null = null;
  private configUnsubscribe: (() => void) | null = null;
  private marketConfigUnsubscribe: (() => void) | null = null;
  private resultsPanelMediaQueryCleanup: (() => void) | null = null;

  constructor(container: HTMLElement, options: SwatchToolOptions) {
    super(container);
    this.options = options;
    this.characterColorService = new CharacterColorService();
    this.marketBoardService = MarketBoardService.getInstance();

    // Load persisted settings
    this.subrace = StorageService.getItem<SubRace>(STORAGE_KEYS.subrace) ?? DEFAULTS.subrace;
    this.gender = StorageService.getItem<Gender>(STORAGE_KEYS.gender) ?? DEFAULTS.gender;
    this.colorCategory =
      StorageService.getItem<ColorCategory>(STORAGE_KEYS.colorCategory) ?? DEFAULTS.colorCategory;
    this.maxResults =
      StorageService.getItem<number>(STORAGE_KEYS.maxResults) ?? DEFAULTS.matchCount;

    // Load initial colors
    void this.loadColors();
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

    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.update();
    });

    // Subscribe to config changes from V4 ConfigSidebar
    const configController = ConfigController.getInstance();
    this.configUnsubscribe = configController.subscribe('swatch', (config) => {
      this.setConfig(config);
    });

    // Subscribe to market config changes
    this.marketConfigUnsubscribe = configController.subscribe('market', (config) => {
      this.setMarketConfig(config);
    });

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
    this.languageUnsubscribe?.();
    this.configUnsubscribe?.();
    this.marketConfigUnsubscribe?.();
    this.resultsPanelMediaQueryCleanup?.();

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
      });
    } else if (needsRematch && this.selectedColor) {
      // Just re-match if only maxResults changed
      this.findMatchingDyes();
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
          width: 420px;
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
    const gridTitle = this.createElement('span', {
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
    gridHeader.appendChild(gridTitle);
    this.gridPanel.appendChild(gridHeader);

    // Color grid (8 columns with larger swatches)
    // Swatch size adjusted via updateSwatchLayout() for mobile
    this.colorGridContainer = this.createElement('div', {
      attributes: {
        style: `
          display: grid;
          grid-template-columns: repeat(8, 44px);
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

    // Selected Color Section (shows technical info of selected swatch)
    const selectedSection = this.createElement('div', {
      attributes: {
        style: `
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
        `,
      },
    });

    // Section header (using consistent section-header/section-title pattern)
    const selectedHeader = this.createElement('div', {
      className: 'section-header',
      attributes: { style: 'width: 100%;' },
    });
    const selectedTitle = this.createElement('span', {
      className: 'section-title',
      textContent: LanguageService.t('tools.character.selectedColor'),
    });
    selectedHeader.appendChild(selectedTitle);
    selectedSection.appendChild(selectedHeader);

    // Selected Color Card (V4 style matching result cards)
    this.selectedColorDisplay = this.createElement('div', {
      attributes: {
        style: `
          background: var(--theme-card-background, #2a2a2a);
          border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
          border-radius: 12px;
          overflow: hidden;
          max-width: 320px;
        `,
      },
    });
    selectedSection.appendChild(this.selectedColorDisplay);
    resultsArea.appendChild(selectedSection);

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

    // Section header (using consistent section-header/section-title pattern)
    const matchHeader = this.createElement('div', {
      className: 'section-header',
      attributes: {
        style: `
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
        `,
      },
    });
    const matchTitle = this.createElement('span', {
      className: 'section-title',
      textContent: LanguageService.t('tools.character.matchingDyes'),
    });
    matchHeader.appendChild(matchTitle);

    // Share button
    this.shareButton = document.createElement('v4-share-button') as ShareButton;
    this.shareButton.tool = 'swatch';
    this.shareButton.compact = true;
    this.shareButton.disabled = true; // Disabled until a color is selected
    matchHeader.appendChild(this.shareButton);

    matchSection.appendChild(matchHeader);

    // Match results container (CSS grid with max 4 columns)
    this.matchResultsContainer = this.createElement('div', {
      attributes: {
        style: `
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 16px;
          width: 100%;
        `,
      },
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

    this.mainLayout.appendChild(resultsArea);
    right.appendChild(this.mainLayout);

    // Initialize displays
    this.updateSelectedColorDisplay();
    this.updateEmptyState();
    this.updateColorGrid();
  }

  /**
   * Update empty state visibility based on selection
   */
  private updateEmptyState(): void {
    if (!this.emptyStateContainer || !this.matchResultsContainer) return;

    const hasSelection = this.selectedColor !== null;
    const hasResults = this.matchedDyes.length > 0;

    // Show empty state when no color selected OR when selected but no results yet
    this.emptyStateContainer.style.display = hasSelection && hasResults ? 'none' : 'flex';

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
   * Update layout based on viewport width
   * Mobile: Vertical stack with responsive swatch sizes
   * Desktop: Horizontal layout with fixed 44px swatches
   */
  private updateSwatchLayout(): void {
    if (!this.mainLayout || !this.gridPanel || !this.colorGridContainer) return;

    const isMobile = window.innerWidth < 768;

    if (isMobile) {
      // Mobile: Stack vertically, responsive swatch sizes
      this.mainLayout.style.flexDirection = 'column';
      this.mainLayout.style.alignItems = 'center';

      // Calculate available width for grid (viewport - padding)
      const viewportWidth = window.innerWidth;
      const containerPadding = 32; // From right panel padding
      const gridPadding = 20; // From gridPanel padding on each side
      const availableWidth = viewportWidth - containerPadding * 2;

      // Calculate swatch size: (available - grid padding - gaps) / 8 columns
      // 7 gaps at 4px each = 28px
      const gridInnerWidth = availableWidth - gridPadding * 2;
      const swatchSize = Math.floor((gridInnerWidth - 28) / 8);
      // Clamp to reasonable range (min 28px, max 44px)
      const clampedSwatchSize = Math.max(28, Math.min(44, swatchSize));

      // Update grid panel width
      this.gridPanel.style.width = '100%';
      this.gridPanel.style.maxWidth = `${availableWidth}px`;

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
      this.gridPanel.style.width = '420px';
      this.gridPanel.style.maxWidth = '';

      // Restore fixed swatch sizes
      this.colorGridContainer.style.gridTemplateColumns = 'repeat(8, 44px)';

      const swatches = this.colorGridContainer.querySelectorAll('button');
      swatches.forEach((swatch) => {
        (swatch as HTMLElement).style.width = '44px';
        (swatch as HTMLElement).style.height = '44px';
      });
    }
  }

  /**
   * Update the color grid
   */
  private updateColorGrid(): void {
    if (!this.colorGridContainer) return;
    clearContainer(this.colorGridContainer);

    // Update the header label with category name and color count
    const gridHeader = this.colorGridContainer.previousElementSibling as HTMLElement;
    if (gridHeader) {
      const titleSpan = gridHeader.querySelector('.section-title');
      if (titleSpan) {
        titleSpan.textContent = `${this.getCategoryDisplayName(this.colorCategory)} (${this.colors.length})`;
      }
    }

    for (const color of this.colors) {
      const swatch = this.createElement('button', {
        className:
          'cursor-pointer transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1',
        attributes: {
          style: `
            width: 44px;
            height: 44px;
            background-color: ${color.hex};
            border: 1px solid var(--theme-border);
            border-radius: 4px;
          `,
          title: `${color.hex} (Index: ${color.index})`,
          'data-index': String(color.index),
          'aria-label': `Color ${color.index + 1}: ${color.hex}`,
        },
      });

      swatch.addEventListener('click', () => {
        this.selectColor(color);
      });

      this.colorGridContainer.appendChild(swatch);
    }

    // Apply responsive sizing to newly created swatches
    this.updateSwatchLayout();
  }

  /**
   * Update selected color display (V4 style card)
   */
  private updateSelectedColorDisplay(): void {
    if (!this.selectedColorDisplay) return;
    clearContainer(this.selectedColorDisplay);

    // Get parent section to show/hide header
    const parentSection = this.selectedColorDisplay.parentElement;

    if (!this.selectedColor) {
      // Hide the entire section when no color selected
      if (parentSection) {
        parentSection.style.display = 'none';
      }
      return;
    }

    // Show section when color is selected
    if (parentSection) {
      parentSection.style.display = 'flex';
    }

    // Calculate grid position (8 columns per row, 1-indexed)
    const gridRow = Math.floor(this.selectedColor.index / 8) + 1;
    const gridCol = (this.selectedColor.index % 8) + 1;

    // Calculate HSV values
    const hsv = ColorService.rgbToHsv(
      this.selectedColor.rgb.r,
      this.selectedColor.rgb.g,
      this.selectedColor.rgb.b
    );

    // Calculate LAB values
    const lab = ColorService.rgbToLab(
      this.selectedColor.rgb.r,
      this.selectedColor.rgb.g,
      this.selectedColor.rgb.b
    );

    // Card title (grid position)
    const titleBar = this.createElement('div', {
      attributes: {
        style: `
          padding: 12px 16px;
          background: var(--theme-card-header, rgba(0, 0, 0, 0.2));
          border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
          text-align: center;
        `,
      },
    });
    const title = this.createElement('span', {
      textContent: `Row ${gridRow}, Column ${gridCol}`,
      attributes: {
        style: `
          font-size: 14px;
          font-weight: 600;
          color: var(--theme-text, #e0e0e0);
        `,
      },
    });
    titleBar.appendChild(title);
    this.selectedColorDisplay.appendChild(titleBar);

    // Large color swatch preview
    const swatchPreview = this.createElement('div', {
      attributes: {
        style: `
          width: 100%;
          height: 80px;
          background-color: ${this.selectedColor.hex};
        `,
      },
    });
    this.selectedColorDisplay.appendChild(swatchPreview);

    // Technical data section
    const dataSection = this.createElement('div', {
      attributes: {
        style: `
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        `,
      },
    });

    // Two-column layout for technical data
    const dataGrid = this.createElement('div', {
      attributes: {
        style: `
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 16px;
          font-size: 12px;
        `,
      },
    });

    // Helper to create data rows
    const createDataRow = (label: string, value: string): HTMLElement => {
      const row = this.createElement('div', {
        attributes: {
          style: `
            display: flex;
            justify-content: space-between;
            align-items: center;
          `,
        },
      });
      const labelEl = this.createElement('span', {
        textContent: label,
        attributes: { style: 'color: var(--theme-text-muted, #a0a0a0);' },
      });
      const valueEl = this.createElement('span', {
        className: 'number',
        textContent: value,
        attributes: { style: 'color: var(--theme-text, #e0e0e0); font-weight: 500;' },
      });
      row.appendChild(labelEl);
      row.appendChild(valueEl);
      return row;
    };

    // Add data rows
    dataGrid.appendChild(createDataRow('HEX', this.selectedColor.hex.toUpperCase()));
    dataGrid.appendChild(createDataRow('Index', String(this.selectedColor.index)));
    dataGrid.appendChild(
      createDataRow(
        'RGB',
        `${this.selectedColor.rgb.r},${this.selectedColor.rgb.g},${this.selectedColor.rgb.b}`
      )
    );
    dataGrid.appendChild(
      createDataRow('HSV', `${Math.round(hsv.h)},${Math.round(hsv.s)},${Math.round(hsv.v)}`)
    );
    dataGrid.appendChild(
      createDataRow('LAB', `${Math.round(lab.L)},${Math.round(lab.a)},${Math.round(lab.b)}`)
    );

    dataSection.appendChild(dataGrid);
    this.selectedColorDisplay.appendChild(dataSection);

    // Copy button
    const copyBtn = this.createElement('button', {
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
        `,
      },
      textContent: 'Copy Color Info',
    });
    copyBtn.addEventListener('mouseenter', () => {
      copyBtn.style.opacity = '0.9';
    });
    copyBtn.addEventListener('mouseleave', () => {
      copyBtn.style.opacity = '1';
    });
    copyBtn.addEventListener('click', () => this.copySelectedColorInfo());
    this.selectedColorDisplay.appendChild(copyBtn);
  }

  /**
   * Copy selected color information to clipboard
   */
  private copySelectedColorInfo(): void {
    if (!this.selectedColor) return;

    const gridRow = Math.floor(this.selectedColor.index / 8) + 1;
    const gridCol = (this.selectedColor.index % 8) + 1;
    const hsv = ColorService.rgbToHsv(
      this.selectedColor.rgb.r,
      this.selectedColor.rgb.g,
      this.selectedColor.rgb.b
    );
    const lab = ColorService.rgbToLab(
      this.selectedColor.rgb.r,
      this.selectedColor.rgb.g,
      this.selectedColor.rgb.b
    );

    const info = [
      `Grid Position: Row ${gridRow}, Column ${gridCol}`,
      `Index: ${this.selectedColor.index}`,
      `HEX: ${this.selectedColor.hex.toUpperCase()}`,
      `RGB: ${this.selectedColor.rgb.r}, ${this.selectedColor.rgb.g}, ${this.selectedColor.rgb.b}`,
      `HSV: ${Math.round(hsv.h)}, ${Math.round(hsv.s)}, ${Math.round(hsv.v)}`,
      `LAB: ${Math.round(lab.L)}, ${Math.round(lab.a)}, ${Math.round(lab.b)}`,
    ].join('\n');

    navigator.clipboard
      .writeText(info)
      .then(() => {
        ToastService.success(LanguageService.t('success.copiedToClipboard'));
      })
      .catch(() => {
        ToastService.error(LanguageService.t('common.copyFailed'));
      });
  }

  /**
   * Update match results display using v4-result-card components
   */
  private updateMatchResults(): void {
    if (!this.matchResultsContainer) return;
    clearContainer(this.matchResultsContainer);

    // Update empty state visibility
    this.updateEmptyState();

    if (this.matchedDyes.length === 0) {
      return;
    }

    for (const match of this.matchedDyes) {
      // Create v4-result-card element
      const card = document.createElement('v4-result-card') as HTMLElement;
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
    StorageService.setItem(STORAGE_KEYS.selectedColorIndex, color.index);

    // Highlight selected swatch
    this.updateSwatchSelection();
    this.updateSelectedColorDisplay();
    this.findMatchingDyes();
    this.updateShareButton();

    // On mobile, scroll to results section so user can see the matches
    if (window.innerWidth < 768 && this.selectedColorDisplay) {
      // Small delay to allow DOM updates before scrolling
      this.safeTimeout(() => {
        this.selectedColorDisplay?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

    this.matchedDyes = this.characterColorService.findClosestDyes(this.selectedColor, dyeService, {
      count: this.maxResults,
      matchingMethod: this.matchingMethod,
    });

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
    this.updateSelectedColorDisplay();
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

    const params: Record<string, unknown> = {
      color: this.selectedColor.hex.replace('#', ''), // Hex without #
      sheet: this.colorCategory, // Which color sheet this color is from
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

    // Load color sheet (category) if specified - do this FIRST before loading colors
    if (params.sheet && typeof params.sheet === 'string') {
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
      if (validSheets.includes(params.sheet as ColorCategory)) {
        const newCategory = params.sheet as ColorCategory;
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
          'Helion',
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

    // Load matching algorithm if specified
    if (params.algo && typeof params.algo === 'string') {
      const validAlgos = ['oklab', 'ciede2000', 'euclidean'];
      if (validAlgos.includes(params.algo)) {
        this.matchingMethod = params.algo as MatchingMethod;
        hasChanges = true;
      }
    }

    // Load max results limit if specified
    if (typeof params.limit === 'number' && params.limit > 0 && params.limit <= 20) {
      this.maxResults = params.limit;
      StorageService.setItem(STORAGE_KEYS.maxResults, params.limit);
      hasChanges = true;
    }

    // Load color if specified
    if (params.color && typeof params.color === 'string') {
      // Normalize hex color (add # prefix if missing)
      const hexColor = params.color.startsWith('#') ? params.color : `#${params.color}`;

      // Ensure colors are loaded before searching
      if (this.colors.length === 0) {
        await this.loadColors();
      }

      // Find matching CharacterColor by hex in the current color sheet
      const matchingColor = this.colors.find((c) => c.hex.toLowerCase() === hexColor.toLowerCase());

      if (matchingColor) {
        // Found the color - select it
        this.selectedColor = matchingColor;
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
      this.updateSelectedColorDisplay();
      this.updateShareButton();

      // Find matching dyes if a color was selected
      if (this.selectedColor) {
        this.findMatchingDyes();
      }
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
