/**
 * XIV Dye Tools v4.0 - Config Sidebar Component
 *
 * 320px glassmorphism sidebar containing all tool configurations.
 * Uses all-in-one approach: contains all configs internally,
 * shows/hides sections based on activeTool property.
 *
 * Phase 6: Wired to ConfigController for reactive state management.
 * Uses ToggleSwitchV4 and RangeSliderV4 for interactive controls.
 *
 * @module components/v4/config-sidebar
 */

import { html, css, CSSResultGroup, TemplateResult, nothing } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import { ConfigController } from '@services/config-controller';
import { authService, LanguageService, CollectionService } from '@services/index';
import { MarketBoardService, type PriceCategorySettings } from '@services/market-board-service';
import { StorageService } from '@services/storage-service';
import { TutorialService } from '@services/tutorial-service';
import type { ToolId } from '@services/router-service';
import type {
  HarmonyConfig,
  ExtractorConfig,
  AccessibilityConfig,
  ComparisonConfig,
  GradientConfig,
  MixerConfig,
  MixingMode,
  PresetsConfig,
  BudgetConfig,
  SwatchConfig,
  MarketConfig,
  AdvancedConfig,
  ConfigKey,
  DisplayOptionsConfig,
  PresetCategoryFilter,
  MatchingMethod,
} from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS, DEFAULT_CONFIGS } from '@shared/tool-config-types';
import { STORAGE_KEYS } from '@shared/constants';
import {
  ICON_REFRESH,
  ICON_PALETTE,
  ICON_STAR,
  ICON_FOLDER,
  ICON_BOOK,
  ICON_EXPORT,
  ICON_IMPORT,
} from '@shared/ui-icons';
import { showPresetSubmissionForm } from '@components/preset-submission-form';
import type { DataCenter, World } from '@shared/types';
import { logger } from '@shared/logger';

// Import child components to ensure registration
import './toggle-switch-v4';
import './range-slider-v4';
import './display-options-v4';
import type { DisplayOptionsChangeDetail } from './display-options-v4';
import type { SubRace } from '@xivdyetools/types';

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
 * V4 Config Sidebar - Tool configuration panel
 *
 * @fires sidebar-collapse - When collapse button is clicked (mobile)
 * @fires config-change - When any config value changes
 *   - detail.tool: The tool ID or 'global'
 *   - detail.key: The config property key
 *   - detail.value: The new value
 *
 * @example
 * ```html
 * <v4-config-sidebar
 *   .activeTool=${'harmony'}
 *   .collapsed=${false}
 *   @sidebar-collapse=${this.handleCollapse}
 *   @config-change=${this.handleConfigChange}
 * ></v4-config-sidebar>
 * ```
 */
@customElement('v4-config-sidebar')
export class ConfigSidebar extends BaseLitComponent {
  /**
   * Currently active tool ID - determines which config section is visible
   */
  @property({ type: String, attribute: 'active-tool' })
  activeTool: ToolId = 'harmony';

  /**
   * Whether sidebar is collapsed (mobile drawer mode)
   */
  @property({ type: Boolean, reflect: true })
  collapsed = false;

  // =========================================================================
  // Tool Configuration State
  // =========================================================================

  @state() private harmonyConfig: HarmonyConfig = {
    harmonyType: 'tetradic',
    strictMatching: false,
    matchingMethod: 'oklab',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };
  @state() private extractorConfig: ExtractorConfig = {
    vibrancyBoost: true,
    maxColors: 8,
    dragThreshold: 5,
    matchingMethod: 'oklab',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };
  @state() private accessibilityConfig: AccessibilityConfig = {
    normalVision: true,
    deuteranopia: true,
    protanopia: true,
    tritanopia: true,
    achromatopsia: true,
    showLabels: true,
    showHexValues: false,
    highContrastMode: false,
    displayOptions: {
      ...DEFAULT_DISPLAY_OPTIONS,
      showPrice: false,
      showDeltaE: false,
      showAcquisition: false,
    },
  };
  @state() private comparisonConfig: ComparisonConfig = {
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };
  @state() private gradientConfig: GradientConfig = {
    stepCount: 8,
    interpolation: 'hsv',
    matchingMethod: 'oklab',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };
  @state() private mixerConfig: MixerConfig = {
    maxResults: 3,
    mixingMode: 'ryb',
    matchingMethod: 'oklab',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };
  @state() private presetsConfig: PresetsConfig = {
    showMyPresetsOnly: false,
    showFavorites: false,
    sortBy: 'popular',
    category: 'all',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };
  @state() private budgetConfig: BudgetConfig = {
    maxPrice: 200000,
    maxResults: 8,
    maxDeltaE: 75,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };
  @state() private swatchConfig: SwatchConfig = {
    colorSheet: 'eyeColors',
    race: 'Midlander',
    gender: 'Male',
    maxResults: 3,
    matchingMethod: 'oklab',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };

  // Global display options shared across all tools
  @state() private globalDisplayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

  @state() private marketConfig: MarketConfig = {
    selectedServer: 'Crystal',
    showPrices: false,
  };

  // Server data for market config dropdown
  @state() private dataCenters: DataCenter[] = [];
  @state() private worlds: World[] = [];

  // Collapsible section state
  @state() private marketBoardCollapsed: boolean = false;
  @state() private advancedSettingsCollapsed: boolean = true; // Collapsed by default

  // Price category filter settings (from MarketBoardService)
  @state() private priceCategories: PriceCategorySettings = {
    baseDyes: false,
    craftDyes: false,
    alliedSocietyDyes: true,
    cosmicDyes: true,
    specialDyes: true,
  };

  // Advanced settings config
  @state() private advancedConfig: AdvancedConfig = { ...DEFAULT_CONFIGS.advanced };

  private configController: ConfigController | null = null;
  private languageUnsubscribe: (() => void) | null = null;
  private authUnsubscribe: (() => void) | null = null;

  static override styles: CSSResultGroup = [
    BaseLitComponent.baseStyles,
    css`
      :host {
        display: block;
        width: var(--v4-sidebar-width, 320px);
        height: 100%;
        flex-shrink: 0;
      }

      :host([collapsed]) {
        display: none;
      }

      .v4-config-sidebar {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--v4-glass-bg, rgba(30, 30, 30, 0.7));
        backdrop-filter: var(--v4-glass-blur, blur(12px));
        -webkit-backdrop-filter: var(--v4-glass-blur, blur(12px));
        border-right: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
      }

      /* Sidebar Header */
      .v4-sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        border-bottom: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
      }

      .v4-sidebar-title {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 600;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: var(--theme-text, #e0e0e0);
      }

      .v4-sidebar-collapse {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.15));
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        color: var(--theme-text, #e0e0e0);
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
        transition:
          color 0.2s,
          background 0.2s,
          border-color 0.2s,
          transform 0.15s;
      }

      .v4-sidebar-collapse:hover {
        color: #ff6b6b;
        background: rgba(255, 107, 107, 0.15);
        border-color: rgba(255, 107, 107, 0.3);
        transform: scale(1.05);
      }

      .v4-sidebar-collapse:active {
        transform: scale(0.95);
      }

      /* Sidebar Content */
      .v4-sidebar-content {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        scrollbar-width: thin;
      }

      .v4-sidebar-content::-webkit-scrollbar {
        width: 6px;
      }

      .v4-sidebar-content::-webkit-scrollbar-track {
        background: transparent;
      }

      .v4-sidebar-content::-webkit-scrollbar-thumb {
        background: var(--theme-border, rgba(255, 255, 255, 0.2));
        border-radius: 3px;
      }

      /* Config Group */
      .config-group {
        margin-bottom: 24px;
      }

      .config-label {
        font-family: 'Space Grotesk', sans-serif;
        font-size: 12px;
        color: var(--theme-text-muted, #a0a0a0);
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 12px;
      }

      /* Config Row (for toggle switches) */
      .config-row {
        margin-bottom: 12px;
      }

      /* Config Description (for explanatory text below toggles) */
      .config-description {
        font-size: 11px;
        color: var(--theme-text-muted, #888888);
        margin-top: 4px;
        line-height: 1.4;
      }

      /* Collapsible header styles */
      .config-label-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
        padding: 4px 0;
        margin-bottom: 8px;
        border-radius: 4px;
        transition: background-color 150ms ease;
      }

      .config-label-header:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }

      .config-label-header .config-label {
        margin-bottom: 0;
      }

      .collapse-icon {
        font-size: 10px;
        color: var(--theme-text-muted, #888888);
        transition: transform 150ms ease;
        margin-right: 4px;
      }

      .collapse-icon.collapsed {
        transform: rotate(180deg);
      }

      /* Collapsible content */
      .config-group-content {
        overflow: hidden;
        max-height: 500px;
        transition:
          max-height 200ms ease-out,
          opacity 150ms ease;
        opacity: 1;
      }

      .config-group-content.collapsed {
        max-height: 0;
        opacity: 0;
        pointer-events: none;
      }

      /* Market config section - match display-options group gap */
      .market-config {
        margin-top: var(--v4-display-options-group-gap, 20px);
      }

      /* Select Dropdown */
      .config-select {
        width: 100%;
        padding: 10px 12px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        color: var(--theme-text, #e0e0e0);
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        margin-bottom: 8px;
      }

      .config-select:focus {
        outline: 2px solid var(--theme-primary, #d4af37);
        outline-offset: 1px;
      }

      .config-select option {
        background: var(--theme-card-background, #2a2a2a);
        color: var(--theme-text, #e0e0e0);
      }

      /* Slider wrapper */
      .slider-wrapper {
        margin-bottom: 16px;
      }

      /* Config Section (tool-specific) */
      .config-section {
        display: block;
      }

      .config-section[hidden] {
        display: none;
      }

      /* Mobile Styles */
      @media (max-width: 768px) {
        :host {
          position: fixed;
          top: calc(var(--v4-header-height, 48px) + var(--v4-tool-bar-height, 64px));
          left: 0;
          bottom: 0;
          z-index: 100;
          transform: translateX(-100%);
          transition: transform 0.3s ease-out;
        }

        :host([collapsed='false']),
        :host(:not([collapsed])) {
          transform: translateX(0);
        }

        :host([collapsed]) {
          transform: translateX(-100%);
        }

        /* Close button styles are now set in base styles */
      }

      /* Auth section styles */
      .auth-section {
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--theme-border, rgba(255, 255, 255, 0.1));
      }

      .auth-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .auth-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: opacity var(--v4-transition-fast, 150ms);
      }

      .auth-btn:hover {
        opacity: 0.9;
      }

      .auth-btn svg {
        width: 18px;
        height: 18px;
      }

      .auth-btn-discord {
        background-color: #5865F2;
        color: white;
      }

      .auth-btn-xivauth {
        background-color: #3b82f6;
        color: white;
      }

      .user-card {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        margin-bottom: 12px;
      }

      .user-avatar {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
      }

      .user-info {
        flex: 1;
        min-width: 0;
      }

      .user-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, #e0e0e0);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .user-provider {
        font-size: 11px;
        color: var(--theme-text-muted, #888888);
      }

      .submit-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 16px;
        background: var(--theme-primary, #d4af37);
        color: var(--theme-background, #1a1a1a);
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity var(--v4-transition-fast, 150ms);
      }

      .submit-btn:hover {
        opacity: 0.9;
      }

      .logout-btn {
        display: block;
        width: 100%;
        margin-top: 8px;
        padding: 8px 12px;
        background: transparent;
        border: 1px solid var(--theme-border, rgba(255, 255, 255, 0.2));
        border-radius: 6px;
        color: var(--theme-text-muted, #888888);
        font-size: 12px;
        cursor: pointer;
        transition: all var(--v4-transition-fast, 150ms);
      }

      .logout-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: var(--theme-text-muted, #888888);
      }

      /* Advanced Settings Section */
      .advanced-settings {
        margin-top: var(--v4-display-options-group-gap, 20px);
        border-top: 1px solid var(--v4-glass-border, rgba(255, 255, 255, 0.1));
        padding-top: 16px;
      }

      .advanced-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        padding: 10px 16px;
        margin-bottom: 8px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.15));
        border-radius: 6px;
        color: var(--theme-text, #e0e0e0);
        font-size: 13px;
        cursor: pointer;
        text-align: left;
        transition: background 0.15s, border-color 0.15s;
      }

      .advanced-btn-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        flex-shrink: 0;
        opacity: 0.8;
      }

      .advanced-btn-icon svg {
        width: 100%;
        height: 100%;
      }

      .advanced-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.25);
      }

      .advanced-btn:active {
        transform: scale(0.98);
      }

      .advanced-btn-row {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .advanced-btn-half {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        flex: 1;
        padding: 8px 12px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid var(--v4-border-subtle, rgba(255, 255, 255, 0.15));
        border-radius: 6px;
        color: var(--theme-text, #e0e0e0);
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
      }

      .advanced-btn-half .advanced-btn-icon {
        width: 16px;
        height: 16px;
      }

      .advanced-btn-half:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: rgba(255, 255, 255, 0.25);
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        :host {
          transition: none;
        }
        .auth-btn,
        .submit-btn,
        .logout-btn,
        .advanced-btn,
        .advanced-btn-half {
          transition: none;
        }
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.loadConfigsFromController();
    this.loadServerData();
    // Subscribe to language changes to update translated text
    this.languageUnsubscribe = LanguageService.subscribe(() => {
      this.requestUpdate();
    });

    // Subscribe to auth changes to update UI on login/logout
    this.authUnsubscribe = authService.subscribe(() => {
      this.requestUpdate();
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.languageUnsubscribe?.();
    this.languageUnsubscribe = null;
    this.authUnsubscribe?.();
    this.authUnsubscribe = null;
  }

  /**
   * Load data centers and worlds for market dropdown
   */
  private async loadServerData(): Promise<void> {
    try {
      const [dcResponse, worldsResponse] = await Promise.all([
        fetch('/json/data-centers.json'),
        fetch('/json/worlds.json'),
      ]);

      if (!dcResponse.ok || !worldsResponse.ok) {
        throw new Error(
          `Failed to load server data: ${dcResponse.status}, ${worldsResponse.status}`
        );
      }

      this.dataCenters = await dcResponse.json();
      this.worlds = await worldsResponse.json();
      logger.info(
        '[ConfigSidebar] Loaded server data:',
        this.dataCenters.length,
        'DCs,',
        this.worlds.length,
        'worlds'
      );
    } catch (error) {
      logger.error('[ConfigSidebar] Error loading server data:', error);
      this.dataCenters = [];
      this.worlds = [];
    }
  }

  /**
   * Load all configs from ConfigController
   */
  private loadConfigsFromController(): void {
    this.configController = ConfigController.getInstance();

    // Load global display options first
    const globalConfig = this.configController.getConfig('global');
    this.globalDisplayOptions = globalConfig.displayOptions || { ...DEFAULT_DISPLAY_OPTIONS };

    this.harmonyConfig = this.configController.getConfig('harmony');
    this.extractorConfig = this.configController.getConfig('extractor');
    this.accessibilityConfig = this.configController.getConfig('accessibility');
    this.comparisonConfig = this.configController.getConfig('comparison');
    this.gradientConfig = this.configController.getConfig('gradient');
    this.mixerConfig = this.configController.getConfig('mixer');
    this.presetsConfig = this.configController.getConfig('presets');
    this.budgetConfig = this.configController.getConfig('budget');
    this.swatchConfig = this.configController.getConfig('swatch');
    this.marketConfig = this.configController.getConfig('market');
    this.advancedConfig = this.configController.getConfig('advanced');

    // Load price categories from MarketBoardService
    const marketBoardService = MarketBoardService.getInstance();
    this.priceCategories = marketBoardService.getPriceCategories();
  }

  /**
   * Handle config change from any control
   */
  private handleConfigChange<K extends ConfigKey>(tool: K, key: string, value: unknown): void {
    // Update local state based on tool
    switch (tool) {
      case 'harmony':
        this.harmonyConfig = { ...this.harmonyConfig, [key]: value };
        break;
      case 'extractor':
        this.extractorConfig = { ...this.extractorConfig, [key]: value };
        break;
      case 'accessibility':
        this.accessibilityConfig = { ...this.accessibilityConfig, [key]: value };
        break;
      case 'comparison':
        this.comparisonConfig = { ...this.comparisonConfig, [key]: value };
        break;
      case 'gradient':
        this.gradientConfig = { ...this.gradientConfig, [key]: value };
        break;
      case 'mixer':
        this.mixerConfig = { ...this.mixerConfig, [key]: value };
        break;
      case 'presets':
        this.presetsConfig = { ...this.presetsConfig, [key]: value };
        break;
      case 'budget':
        this.budgetConfig = { ...this.budgetConfig, [key]: value };
        break;
      case 'swatch':
        this.swatchConfig = { ...this.swatchConfig, [key]: value };
        break;
      case 'market':
        this.marketConfig = { ...this.marketConfig, [key]: value };
        break;
    }

    // Update ConfigController
    if (this.configController) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // Type assertion needed because computed property keys lose type safety
      (this.configController as any).setConfig(tool, { [key]: value });
    }

    // Emit event for parent components
    this.emit('config-change', { tool, key, value });
  }

  /**
   * Handle collapse button click
   */
  private handleCollapseClick(): void {
    this.emit('sidebar-collapse');
  }

  /**
   * Toggle Market Board section collapsed state
   */
  private toggleMarketBoard(): void {
    this.marketBoardCollapsed = !this.marketBoardCollapsed;
  }

  /**
   * Toggle Advanced Settings section collapsed state
   */
  private toggleAdvancedSettings(): void {
    this.advancedSettingsCollapsed = !this.advancedSettingsCollapsed;
  }

  // =========================================================================
  // Advanced Settings Handlers
  // =========================================================================

  /**
   * Reset all tool configs to defaults
   */
  private handleResetSettings(): void {
    if (!confirm(LanguageService.t('config.resetSettingsConfirm'))) return;
    ConfigController.getInstance().resetAllConfigs();
    this.loadConfigsFromController();
    this.emit('settings-reset');
    logger.info('[ConfigSidebar] All settings reset to defaults');
  }

  /**
   * Emit event to clear dyes across all tools
   */
  private handleClearDyes(): void {
    if (!confirm(LanguageService.t('config.clearDyesConfirm'))) return;
    this.emit('clear-all-dyes');
    logger.info('[ConfigSidebar] Clear dyes event emitted');
  }

  /**
   * Clear favorite dyes via CollectionService
   */
  private handleClearFavorites(): void {
    if (!confirm(LanguageService.t('config.clearFavoritesConfirm'))) return;
    CollectionService.clearFavorites();
    this.emit('favorites-cleared');
    logger.info('[ConfigSidebar] Favorites cleared');
  }

  /**
   * Clear saved palettes from localStorage
   */
  private handleClearPalettes(): void {
    if (!confirm(LanguageService.t('config.clearPalettesConfirm'))) return;
    StorageService.removeItem(STORAGE_KEYS.SAVED_PALETTES);
    this.emit('palettes-cleared');
    logger.info('[ConfigSidebar] Saved palettes cleared');
  }

  /**
   * Reset tutorial state to show onboarding hints again
   */
  private handleResetTutorial(): void {
    TutorialService.resetAllCompletions();
    this.emit('tutorial-reset');
    logger.info('[ConfigSidebar] Tutorial reset');
  }

  /**
   * Export all settings as JSON file download
   */
  private handleExportSettings(): void {
    const configs = ConfigController.getInstance().exportAllConfigs();
    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      type: 'xivdyetools-settings',
      configs,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xivdyetools-settings-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logger.info('[ConfigSidebar] Settings exported');
  }

  /**
   * Trigger hidden file input for import
   */
  private triggerImportSettings(): void {
    this.renderRoot.querySelector<HTMLInputElement>('.import-file-input')?.click();
  }

  /**
   * Handle file selection for import
   */
  private async handleImportFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate export format
      if (data.type !== 'xivdyetools-settings' || !data.configs) {
        throw new Error('Invalid settings file format');
      }

      ConfigController.getInstance().importConfigs(data.configs);
      this.loadConfigsFromController();
      this.emit('settings-imported');
      logger.info('[ConfigSidebar] Settings imported successfully');
    } catch (error) {
      logger.error('[ConfigSidebar] Import failed:', error);
      alert(LanguageService.t('config.importError'));
    }

    // Reset file input so the same file can be selected again
    input.value = '';
  }

  /**
   * Handle toggle changes for advanced config
   */
  private handleAdvancedConfigChange(key: keyof AdvancedConfig, value: boolean): void {
    this.advancedConfig = { ...this.advancedConfig, [key]: value };
    if (this.configController) {
      this.configController.setConfig('advanced', { [key]: value });
    }
    this.emit('config-change', { tool: 'advanced', key, value });
  }

  /**
   * Handle price category toggle changes
   * Updates MarketBoardService and triggers re-fetch of prices
   */
  private handlePriceCategoryChange(key: keyof PriceCategorySettings, value: boolean): void {
    // Update local state
    this.priceCategories = { ...this.priceCategories, [key]: value };

    // Update MarketBoardService (which persists to localStorage and emits events)
    const marketBoardService = MarketBoardService.getInstance();
    marketBoardService.setCategories({ [key]: value });

    logger.info(`[ConfigSidebar] Price category ${key} set to ${value}`);
  }

  /**
   * Handle display options change from v4-display-options component.
   * Updates global display options that are shared across all tools.
   */
  private handleDisplayOptionsChange(
    _tool: 'harmony' | 'mixer' | 'gradient' | 'swatch' | 'accessibility' | 'comparison' | 'budget' | 'extractor',
    e: CustomEvent<DisplayOptionsChangeDetail>
  ): void {
    const { option, value, allOptions } = e.detail;

    // Update global display options (shared across all tools)
    this.globalDisplayOptions = allOptions;

    // Save to global config via ConfigController
    if (this.configController) {
      (this.configController as ConfigController).setConfig('global', { displayOptions: allOptions });

      // Broadcast to all tools so they pick up the new display options
      const toolsWithDisplayOptions = [
        'harmony',
        'mixer',
        'gradient',
        'swatch',
        'accessibility',
        'comparison',
        'budget',
        'extractor',
      ] as const;
      for (const tool of toolsWithDisplayOptions) {
        (this.configController as ConfigController).setConfig(tool, { displayOptions: allOptions });
      }
    }

    // Emit event for parent components
    this.emit('config-change', { tool: 'global', key: `displayOptions.${option}`, value });
  }

  /**
   * Render Harmony Explorer config
   */
  private renderHarmonyConfig(): TemplateResult {
    return html`
      <div class="config-section" ?hidden=${this.activeTool !== 'harmony'}>
        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.harmonyType')}</div>
          <select
            class="config-select"
            .value=${this.harmonyConfig.harmonyType}
            @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value;
        this.handleConfigChange('harmony', 'harmonyType', value);
      }}
          >
            <option value="complementary">${LanguageService.t('config.complementary')}</option>
            <option value="analogous">${LanguageService.t('config.analogous')}</option>
            <option value="triadic">${LanguageService.t('config.triadic')}</option>
            <option value="split-complementary">${LanguageService.t('config.splitComplementary')}</option>
            <option value="tetradic">${LanguageService.t('config.tetradic')}</option>
            <option value="square">${LanguageService.t('config.square')}</option>
            <option value="monochromatic">${LanguageService.t('config.monochromatic')}</option>
            <option value="compound">${LanguageService.t('config.compound')}</option>
            <option value="shades">${LanguageService.t('config.shades')}</option>
          </select>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.matchingMode')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.perceptualMatching')}
              .checked=${this.harmonyConfig.strictMatching}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('harmony', 'strictMatching', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-description">
            ${this.harmonyConfig.strictMatching
        ? LanguageService.t('config.perceptualMatchingDesc')
        : LanguageService.t('config.hueMatchingDesc')}
          </div>
        </div>

        ${this.harmonyConfig.strictMatching
        ? this.renderMatchingMethodSection('harmony', this.harmonyConfig.matchingMethod)
        : ''}

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
        this.handleDisplayOptionsChange('harmony', e)}
        ></v4-display-options>
      </div>
    `;
  }

  /**
   * Render Palette Extractor config
   */
  private renderExtractorConfig(): TemplateResult {
    return html`
      <div class="config-section" ?hidden=${this.activeTool !== 'extractor'}>
        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.extractionSettings')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.vibrancyBoost')}
              .checked=${this.extractorConfig.vibrancyBoost}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('extractor', 'vibrancyBoost', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('config.maxColors')}
              .value=${this.extractorConfig.maxColors}
              .min=${3}
              .max=${10}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
        this.handleConfigChange('extractor', 'maxColors', e.detail.value)}
            ></v4-range-slider>
          </div>
          <div class="slider-wrapper" title=${LanguageService.t('config.dragThresholdTooltip')}>
            <v4-range-slider
              label=${LanguageService.t('config.dragThreshold')}
              .value=${this.extractorConfig.dragThreshold}
              .min=${3}
              .max=${15}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
        this.handleConfigChange('extractor', 'dragThreshold', e.detail.value)}
            ></v4-range-slider>
          </div>
        </div>

        ${this.renderMatchingMethodSection('extractor', this.extractorConfig.matchingMethod)}

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
        this.handleDisplayOptionsChange('extractor', e)}
        ></v4-display-options>
      </div>
    `;
  }

  /**
   * Render Accessibility Checker config
   */
  private renderAccessibilityConfig(): TemplateResult {
    return html`
      <div class="config-section" ?hidden=${this.activeTool !== 'accessibility'}>
        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.visionTypes')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.deuteranopia')}
              .checked=${this.accessibilityConfig.deuteranopia}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('accessibility', 'deuteranopia', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.protanopia')}
              .checked=${this.accessibilityConfig.protanopia}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('accessibility', 'protanopia', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.tritanopia')}
              .checked=${this.accessibilityConfig.tritanopia}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('accessibility', 'tritanopia', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.achromatopsia')}
              .checked=${this.accessibilityConfig.achromatopsia}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('accessibility', 'achromatopsia', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.simulationDisplay')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.showLabels')}
              .checked=${this.accessibilityConfig.showLabels}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('accessibility', 'showLabels', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.showHexValues')}
              .checked=${this.accessibilityConfig.showHexValues}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('accessibility', 'showHexValues', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.highContrastMode')}
              .checked=${this.accessibilityConfig.highContrastMode}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('accessibility', 'highContrastMode', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
        </div>

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .visibleGroups=${['colorFormats']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
        this.handleDisplayOptionsChange('accessibility', e)}
        ></v4-display-options>
      </div>
    `;
  }

  /**
   * Render Dye Comparison config
   */
  private renderComparisonConfig(): TemplateResult {
    return html`
      <div class="config-section" ?hidden=${this.activeTool !== 'comparison'}>
        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
        this.handleDisplayOptionsChange('comparison', e)}
        ></v4-display-options>
      </div>
    `;
  }

  /**
   * Render Gradient Builder config
   */
  private renderGradientConfig(): TemplateResult {
    return html`
      <div class="config-section" ?hidden=${this.activeTool !== 'gradient'}>
        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.gradientSteps')}</div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('config.count')}
              .value=${this.gradientConfig.stepCount}
              .min=${3}
              .max=${12}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
        this.handleConfigChange('gradient', 'stepCount', e.detail.value)}
            ></v4-range-slider>
          </div>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.colorSpace')}</div>
          <select
            class="config-select"
            .value=${this.gradientConfig.interpolation}
            @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value;
        this.handleConfigChange('gradient', 'interpolation', value);
      }}
          >
            <option value="oklch">OKLCH - ${LanguageService.t('gradient.mode.oklch')}</option>
            <option value="hsv">HSV - ${LanguageService.t('gradient.mode.hsv')}</option>
            <option value="lab">LAB - ${LanguageService.t('gradient.mode.lab')}</option>
            <option value="lch">LCH - ${LanguageService.t('gradient.mode.lch')}</option>
            <option value="rgb">RGB - ${LanguageService.t('gradient.mode.rgb')}</option>
          </select>
          <div class="config-description">
            ${this.getColorSpaceDescription()}
          </div>
        </div>

        ${this.renderMatchingMethodSection('gradient', this.gradientConfig.matchingMethod)}

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
        this.handleDisplayOptionsChange('gradient', e)}
        ></v4-display-options>
      </div>
    `;
  }

  /**
   * Render Dye Mixer config (NEW tool)
   */
  private renderMixerConfig(): TemplateResult {
    return html`
      <div class="config-section" ?hidden=${this.activeTool !== 'mixer'}>
        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.mixingMode')}</div>
          <select
            class="config-select"
            .value=${this.mixerConfig.mixingMode ?? 'ryb'}
            @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value as MixingMode;
        this.handleConfigChange('mixer', 'mixingMode', value);
      }}
          >
            <option value="spectral">${LanguageService.t('config.mixingSpectral')}</option>
            <option value="ryb">RYB - ${LanguageService.t('config.mixingRyb')}</option>
            <option value="oklab">OKLAB - ${LanguageService.t('config.mixingOklab')}</option>
            <option value="lab">LAB - ${LanguageService.t('config.mixingLab')}</option>
            <option value="hsl">HSL - ${LanguageService.t('config.mixingHsl')}</option>
            <option value="rgb">RGB - ${LanguageService.t('config.mixingRgb')}</option>
          </select>
          <div class="config-description">
            ${this.getMixingModeDescription()}
          </div>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.resultSettings')}</div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('config.maxResults')}
              .value=${this.mixerConfig.maxResults}
              .min=${3}
              .max=${8}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
        this.handleConfigChange('mixer', 'maxResults', e.detail.value)}
            ></v4-range-slider>
          </div>
        </div>

        ${this.renderMatchingMethodSection('mixer', this.mixerConfig.matchingMethod)}

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
        this.handleDisplayOptionsChange('mixer', e)}
        ></v4-display-options>
      </div>
    `;
  }

  /**
   * Get description text for the current matching method
   */
  private getMatchingMethodDescription(method: MatchingMethod): string {
    switch (method) {
      case 'oklab':
        return LanguageService.t('config.matchingOklabDesc');
      case 'hyab':
        return LanguageService.t('config.matchingHyabDesc');
      case 'ciede2000':
        return LanguageService.t('config.matchingCiede2000Desc');
      case 'cie76':
        return LanguageService.t('config.matchingCie76Desc');
      case 'rgb':
        return LanguageService.t('config.matchingRgbDesc');
      case 'oklch-weighted':
        return LanguageService.t('config.matchingOklchWeightedDesc');
      default:
        return '';
    }
  }

  /**
   * Render matching method dropdown for a tool
   */
  private renderMatchingMethodSection(
    toolKey: 'harmony' | 'extractor' | 'gradient' | 'mixer' | 'swatch',
    currentMethod: MatchingMethod
  ): TemplateResult {
    return html`
      <div class="config-group">
        <div class="config-label">${LanguageService.t('config.matchingMethod')}</div>
        <select
          class="config-select"
          .value=${currentMethod}
          @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value as MatchingMethod;
        this.handleConfigChange(toolKey, 'matchingMethod', value);
      }}
        >
          <option value="oklab">OKLAB - ${LanguageService.t('config.matchingOklab')}</option>
          <option value="hyab">HyAB - ${LanguageService.t('config.matchingHyab')}</option>
          <option value="ciede2000">CIEDE2000 - ${LanguageService.t('config.matchingCiede2000')}</option>
          <option value="cie76">CIE76 - ${LanguageService.t('config.matchingCie76')}</option>
          <option value="rgb">RGB - ${LanguageService.t('config.matchingRgb')}</option>
        </select>
        <div class="config-description">
          ${this.getMatchingMethodDescription(currentMethod)}
        </div>
      </div>
    `;
  }

  /**
   * Get description text for the current mixing mode
   */
  private getMixingModeDescription(): string {
    switch (this.mixerConfig.mixingMode) {
      case 'spectral':
        return LanguageService.t('config.mixingSpectralDesc');
      case 'ryb':
        return LanguageService.t('config.mixingRybDesc');
      case 'oklab':
        return LanguageService.t('config.mixingOklabDesc');
      case 'lab':
        return LanguageService.t('config.mixingLabDesc');
      case 'hsl':
        return LanguageService.t('config.mixingHslDesc');
      case 'rgb':
      default:
        return LanguageService.t('config.mixingRgbDesc');
    }
  }

  /**
   * Get description text for the current color space interpolation mode
   */
  private getColorSpaceDescription(): string {
    switch (this.gradientConfig.interpolation) {
      case 'oklch':
        return LanguageService.t('config.colorSpaceOklchDesc');
      case 'hsv':
        return LanguageService.t('config.colorSpaceHsvDesc');
      case 'lab':
        return LanguageService.t('config.colorSpaceLabDesc');
      case 'lch':
        return LanguageService.t('config.colorSpaceLchDesc');
      case 'rgb':
      default:
        return LanguageService.t('config.colorSpaceRgbDesc');
    }
  }

  /**
   * Render Community Presets config
   */
  private renderPresetsConfig(): TemplateResult {
    return html`
      <div class="config-section" ?hidden=${this.activeTool !== 'presets'}>
        ${this.renderPresetsAuthSection()}

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.category')}</div>
          <select
            class="config-select"
            .value=${this.presetsConfig.category}
            @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value as PresetCategoryFilter;
        this.handleConfigChange('presets', 'category', value);
      }}
          >
            <option value="all">${LanguageService.t('config.allCategories')}</option>
            <option value="jobs">${LanguageService.t('config.jobs')}</option>
            <option value="grand-companies">${LanguageService.t('config.grandCompanies')}</option>
            <option value="seasons">${LanguageService.t('config.seasons')}</option>
            <option value="events">${LanguageService.t('config.events')}</option>
            <option value="aesthetics">${LanguageService.t('config.aesthetics')}</option>
            <option value="community">${LanguageService.t('config.community')}</option>
          </select>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.sortBy')}</div>
          <select
            class="config-select"
            .value=${this.presetsConfig.sortBy}
            @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value;
        this.handleConfigChange('presets', 'sortBy', value);
      }}
          >
            <option value="popular">${LanguageService.t('config.mostPopular')}</option>
            <option value="recent">${LanguageService.t('config.mostRecent')}</option>
            <option value="name">${LanguageService.t('config.alphabetical')}</option>
          </select>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.filters')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.showMyPresetsOnly')}
              .checked=${this.presetsConfig.showMyPresetsOnly}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('presets', 'showMyPresetsOnly', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.showFavorites')}
              .checked=${this.presetsConfig.showFavorites}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('presets', 'showFavorites', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
        </div>

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
        this.handleDisplayOptionsChange('harmony', e)}
        ></v4-display-options>
      </div>
    `;
  }

  /**
   * Render auth section for presets
   */
  private renderPresetsAuthSection(): TemplateResult {
    const isAuthenticated = authService.isAuthenticated();
    const user = authService.getUser();

    if (isAuthenticated && user) {
      // Logged in - show user card and submit button
      const avatarUrl = user.avatar_url || `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id || '0') % 5}.png`;
      const displayName = user.global_name || user.username || 'User';
      const providerLabel = user.auth_provider === 'xivauth' ? 'XIVAuth' : 'Discord';

      return html`
        <div class="auth-section">
          <div class="config-label">${LanguageService.t('config.account')}</div>
          <div class="user-card">
            <img class="user-avatar" src="${avatarUrl}" alt="${displayName}" />
            <div class="user-info">
              <div class="user-name">${displayName}</div>
              <div class="user-provider">${LanguageService.tInterpolate('config.via', { provider: providerLabel })}</div>
            </div>
          </div>
          <button class="submit-btn" @click=${this.handleSubmitPreset}>
            + ${LanguageService.t('config.submitPreset')}
          </button>
          <button class="logout-btn" @click=${this.handleLogout}>
            ${LanguageService.t('config.logout')}
          </button>
        </div>
      `;
    }

    // Logged out - show login buttons
    return html`
      <div class="auth-section">
        <div class="config-label">${LanguageService.t('config.loginToSubmit')}</div>
        <div class="auth-buttons">
          <button class="auth-btn auth-btn-discord" @click=${() => this.handleLogin('discord')}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
            </svg>
            ${LanguageService.t('config.loginWithDiscord')}
          </button>
          <button class="auth-btn auth-btn-xivauth" @click=${() => this.handleLogin('xivauth')}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
            </svg>
            ${LanguageService.t('config.loginWithXIVAuth')}
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Handle login button click
   */
  private handleLogin(provider: 'discord' | 'xivauth'): void {
    if (provider === 'xivauth') {
      authService.loginWithXIVAuth(undefined, 'presets');
    } else {
      authService.login(undefined, 'presets');
    }
  }

  /**
   * Handle logout button click
   */
  private async handleLogout(): Promise<void> {
    await authService.logout();
  }

  /**
   * Handle submit preset button click
   */
  private handleSubmitPreset(): void {
    showPresetSubmissionForm((result) => {
      if (result.success) {
        logger.info('[ConfigSidebar] Preset submitted successfully');
        // The preset tool will handle refreshing the list
      }
    });
  }

  /**
   * Render Budget Suggestions config
   */
  private renderBudgetConfig(): TemplateResult {
    return html`
      <div class="config-section" ?hidden=${this.activeTool !== 'budget'}>
        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.budgetLimit')}</div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('config.maxPrice')}
              .value=${this.budgetConfig.maxPrice}
              .min=${0}
              .max=${200000}
              .step=${5000}
              .valueFormatter=${(v: number) => `${v.toLocaleString()} gil`}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
        this.handleConfigChange('budget', 'maxPrice', e.detail.value)}
            ></v4-range-slider>
          </div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('config.maxResults')}
              .value=${this.budgetConfig.maxResults}
              .min=${1}
              .max=${20}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
        this.handleConfigChange('budget', 'maxResults', e.detail.value)}
            ></v4-range-slider>
          </div>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.colorDistance')}</div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('config.maxDeltaE')}
              .value=${this.budgetConfig.maxDeltaE}
              .min=${0}
              .max=${100}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
        this.handleConfigChange('budget', 'maxDeltaE', e.detail.value)}
            ></v4-range-slider>
          </div>
        </div>

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
        this.handleDisplayOptionsChange('budget', e)}
        ></v4-display-options>
      </div>
    `;
  }

  /**
   * Check if current color sheet requires race/gender selection
   */
  private isRaceSpecificColorSheet(): boolean {
    return (
      this.swatchConfig.colorSheet === 'hairColors' || this.swatchConfig.colorSheet === 'skinColors'
    );
  }

  /**
   * Render Swatch Matcher config
   */
  private renderSwatchConfig(): TemplateResult {
    const showCharacterSection = this.isRaceSpecificColorSheet();

    return html`
      <div class="config-section" ?hidden=${this.activeTool !== 'swatch'}>
        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.colorSheet')}</div>
          <select
            class="config-select"
            .value=${this.swatchConfig.colorSheet}
            @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value;
        this.handleConfigChange('swatch', 'colorSheet', value);
      }}
          >
            <option value="eyeColors">${LanguageService.t('config.eyeColors')}</option>
            <option value="hairColors">${LanguageService.t('config.hairColors')}</option>
            <option value="skinColors">${LanguageService.t('config.skinColors')}</option>
            <option value="highlightColors">${LanguageService.t('config.highlightColors')}</option>
            <option value="lipColorsDark">${LanguageService.t('config.lipColorsDark')}</option>
            <option value="lipColorsLight">${LanguageService.t('config.lipColorsLight')}</option>
            <option value="tattooColors">${LanguageService.t('config.tattooColors')}</option>
            <option value="facePaintColorsDark">${LanguageService.t('config.facePaintDark')}</option>
            <option value="facePaintColorsLight">${LanguageService.t('config.facePaintLight')}</option>
          </select>
        </div>

        <div class="config-group" ?hidden=${!showCharacterSection}>
          <div class="config-label">${LanguageService.t('config.character')}</div>
          <select
            class="config-select"
            .value=${this.swatchConfig.race}
            @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value;
        this.handleConfigChange('swatch', 'race', value);
      }}
          >
            ${RACE_GROUPS.map(
        (group) => html`
                <optgroup label="${LanguageService.getRace(group.raceKey)}">
                  ${group.subraces.map(
          (subrace) => html`
                      <option
                        value="${subrace}"
                        ?selected=${this.swatchConfig.race === subrace}
                      >
                        ${LanguageService.getClan(SUBRACE_TO_CLAN_KEY[subrace])}
                      </option>
                    `
        )}
                </optgroup>
              `
      )}
          </select>
          <select
            class="config-select"
            .value=${this.swatchConfig.gender}
            @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value;
        this.handleConfigChange('swatch', 'gender', value);
      }}
          >
            <option value="Male" ?selected=${this.swatchConfig.gender === 'Male'}>
              ${LanguageService.t('tools.character.male')}
            </option>
            <option value="Female" ?selected=${this.swatchConfig.gender === 'Female'}>
              ${LanguageService.t('tools.character.female')}
            </option>
          </select>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.searchSettings')}</div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('config.maxResults')}
              .value=${this.swatchConfig.maxResults}
              .min=${1}
              .max=${6}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
        this.handleConfigChange('swatch', 'maxResults', e.detail.value)}
            ></v4-range-slider>
          </div>
        </div>

        ${this.renderMatchingMethodSection('swatch', this.swatchConfig.matchingMethod)}

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.displayOptions')}</div>
          <v4-display-options
            .showHex=${this.globalDisplayOptions.showHex}
            .showRgb=${this.globalDisplayOptions.showRgb}
            .showHsv=${this.globalDisplayOptions.showHsv}
            .showLab=${this.globalDisplayOptions.showLab}
            .showPrice=${this.globalDisplayOptions.showPrice}
            .showDeltaE=${this.globalDisplayOptions.showDeltaE}
            .showAcquisition=${this.globalDisplayOptions.showAcquisition}
            .visibleGroups=${['colorFormats', 'resultMetadata']}
            @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
        this.handleDisplayOptionsChange('swatch', e)}
          ></v4-display-options>
        </div>
      </div>
    `;
  }

  /**
   * Check if current tool supports market data
   */
  private toolSupportsMarket(): boolean {
    return ['harmony', 'comparison', 'budget', 'mixer', 'extractor', 'gradient', 'presets', 'swatch'].includes(
      this.activeTool
    );
  }

  /**
   * Render Market Board config (shown for tools that support market data)
   */
  private renderMarketConfig(): TemplateResult {
    // Only show for tools that support market data
    if (!this.toolSupportsMarket()) {
      return html``;
    }

    // Sort data centers alphabetically
    const sortedDataCenters = [...this.dataCenters].sort((a, b) => a.name.localeCompare(b.name));

    return html`
      <div class="config-section market-config">
        <div class="config-group">
          <div
            class="config-label-header"
            @click=${this.toggleMarketBoard}
            role="button"
            aria-expanded=${!this.marketBoardCollapsed}
            tabindex="0"
            @keydown=${(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggleMarketBoard();
        }
      }}
          >
            <div class="config-label">${LanguageService.t('config.marketBoard')}</div>
            <span class="collapse-icon ${this.marketBoardCollapsed ? 'collapsed' : ''}"
              >${this.marketBoardCollapsed ? '▼' : '▲'}</span
            >
          </div>
          <div class="config-group-content ${this.marketBoardCollapsed ? 'collapsed' : ''}">
            <div class="config-row">
              <v4-toggle-switch
                label=${LanguageService.t('config.enableMarketBoard')}
                .checked=${this.marketConfig.showPrices}
                @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleConfigChange('market', 'showPrices', e.detail.checked)}
              ></v4-toggle-switch>
            </div>
            <select
              class="config-select"
              .value=${this.marketConfig.selectedServer}
              ?disabled=${this.dataCenters.length === 0}
              @change=${(e: Event) => {
        const value = (e.target as HTMLSelectElement).value;
        this.handleConfigChange('market', 'selectedServer', value);
      }}
            >
              ${this.dataCenters.length === 0
        ? html`<option value="Crystal">${LanguageService.t('config.loadingServers')}</option>`
        : sortedDataCenters.map(
          (dc) => html`
                      <optgroup label="${dc.name} (${dc.region})">
                        <option
                          value="${dc.name}"
                          ?selected=${this.marketConfig.selectedServer === dc.name}
                        >
                          ${dc.name} - ${LanguageService.t('config.allWorlds')}
                        </option>
                        ${this.worlds
              .filter((w) => dc.worlds.includes(w.id))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(
                (world) => html`
                              <option
                                value="${world.name}"
                                ?selected=${this.marketConfig.selectedServer === world.name}
                              >
                                &nbsp;&nbsp;${world.name}
                              </option>
                            `
              )}
                      </optgroup>
                    `
        )}
            </select>
            ${this.marketConfig.showPrices ? html`
              <div class="config-label" style="margin-top: 16px; margin-bottom: 8px;">
                ${LanguageService.t('marketBoard.priceCategories')}
              </div>
              <div class="config-row">
                <v4-toggle-switch
                  label=${LanguageService.t('marketBoard.baseDyes')}
                  .checked=${this.priceCategories.baseDyes}
                  @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
          this.handlePriceCategoryChange('baseDyes', e.detail.checked)}
                ></v4-toggle-switch>
              </div>
              <div class="config-row">
                <v4-toggle-switch
                  label=${LanguageService.t('marketBoard.craftDyes')}
                  .checked=${this.priceCategories.craftDyes}
                  @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
          this.handlePriceCategoryChange('craftDyes', e.detail.checked)}
                ></v4-toggle-switch>
              </div>
              <div class="config-row">
                <v4-toggle-switch
                  label=${LanguageService.t('marketBoard.alliedSocietyDyes')}
                  .checked=${this.priceCategories.alliedSocietyDyes}
                  @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
          this.handlePriceCategoryChange('alliedSocietyDyes', e.detail.checked)}
                ></v4-toggle-switch>
              </div>
              <div class="config-row">
                <v4-toggle-switch
                  label=${LanguageService.t('marketBoard.cosmicDyes')}
                  .checked=${this.priceCategories.cosmicDyes}
                  @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
          this.handlePriceCategoryChange('cosmicDyes', e.detail.checked)}
                ></v4-toggle-switch>
              </div>
              <div class="config-row">
                <v4-toggle-switch
                  label=${LanguageService.t('marketBoard.specialDyes')}
                  .checked=${this.priceCategories.specialDyes}
                  @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
          this.handlePriceCategoryChange('specialDyes', e.detail.checked)}
                ></v4-toggle-switch>
              </div>
            ` : nothing}
            <div class="config-description">
              ${LanguageService.tInterpolate('config.pricesFetchedFrom', { server: this.marketConfig.selectedServer })}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Advanced Settings section (collapsed by default)
   */
  private renderAdvancedSettings(): TemplateResult {
    return html`
      <div class="config-section advanced-settings">
        <div class="config-group">
          <!-- Collapsible Header -->
          <div
            class="config-label-header"
            @click=${this.toggleAdvancedSettings}
            role="button"
            aria-expanded=${!this.advancedSettingsCollapsed}
            tabindex="0"
            @keydown=${(e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.toggleAdvancedSettings();
        }
      }}
          >
            <div class="config-label">${LanguageService.t('config.advancedSettings')}</div>
            <span class="collapse-icon ${this.advancedSettingsCollapsed ? 'collapsed' : ''}">
              ${this.advancedSettingsCollapsed ? '▼' : '▲'}
            </span>
          </div>

          <div class="config-group-content ${this.advancedSettingsCollapsed ? 'collapsed' : ''}">
            <!-- Data Management Buttons -->
            <button class="advanced-btn" @click=${this.handleResetSettings}>
              <span class="advanced-btn-icon">${unsafeHTML(ICON_REFRESH)}</span>
              ${LanguageService.t('config.resetSettings')}
            </button>
            <button class="advanced-btn" @click=${this.handleClearDyes}>
              <span class="advanced-btn-icon">${unsafeHTML(ICON_PALETTE)}</span>
              ${LanguageService.t('config.clearDyes')}
            </button>
            <button class="advanced-btn" @click=${this.handleClearFavorites}>
              <span class="advanced-btn-icon">${unsafeHTML(ICON_STAR)}</span>
              ${LanguageService.t('config.clearFavorites')}
            </button>
            <button class="advanced-btn" @click=${this.handleClearPalettes}>
              <span class="advanced-btn-icon">${unsafeHTML(ICON_FOLDER)}</span>
              ${LanguageService.t('config.clearPalettes')}
            </button>
            <button class="advanced-btn" @click=${this.handleResetTutorial}>
              <span class="advanced-btn-icon">${unsafeHTML(ICON_BOOK)}</span>
              ${LanguageService.t('config.resetTutorial')}
            </button>

            <!-- Export/Import Row -->
            <div class="advanced-btn-row">
              <button class="advanced-btn-half" @click=${this.handleExportSettings}>
                <span class="advanced-btn-icon">${unsafeHTML(ICON_EXPORT)}</span>
                ${LanguageService.t('config.exportSettings')}
              </button>
              <button class="advanced-btn-half" @click=${this.triggerImportSettings}>
                <span class="advanced-btn-icon">${unsafeHTML(ICON_IMPORT)}</span>
                ${LanguageService.t('config.importSettings')}
              </button>
              <input
                type="file"
                class="import-file-input"
                accept=".json"
                hidden
                @change=${this.handleImportFile}
              />
            </div>

            <!-- Toggle Switches -->
            <div class="config-row">
              <v4-toggle-switch
                label=${LanguageService.t('config.performanceMode')}
                .checked=${this.advancedConfig.performanceMode}
                @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleAdvancedConfigChange('performanceMode', e.detail.checked)}
              ></v4-toggle-switch>
            </div>
            <div class="config-description">
              ${LanguageService.t('config.performanceModeDesc')}
            </div>

            <div class="config-row">
              <v4-toggle-switch
                label=${LanguageService.t('config.enableAnalytics')}
                .checked=${this.advancedConfig.analyticsEnabled}
                @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
        this.handleAdvancedConfigChange('analyticsEnabled', e.detail.checked)}
              ></v4-toggle-switch>
            </div>
            <div class="config-description">
              ${LanguageService.t('config.analyticsDesc')}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    return html`
      <aside class="v4-config-sidebar" role="complementary" aria-label="${LanguageService.t('aria.toggleConfigSidebar')}">
        <!-- Sidebar Header -->
        <header class="v4-sidebar-header">
          <span class="v4-sidebar-title">${LanguageService.t('common.options')}</span>
          <button
            class="v4-sidebar-collapse"
            type="button"
            title="${LanguageService.t('aria.closeSidebar')}"
            aria-label="${LanguageService.t('aria.closeSidebar')}"
            @click=${this.handleCollapseClick}
          >
            ×
          </button>
        </header>

        <!-- Sidebar Content -->
        <div class="v4-sidebar-content">
          ${this.renderHarmonyConfig()} ${this.renderExtractorConfig()}
          ${this.renderAccessibilityConfig()} ${this.renderComparisonConfig()}
          ${this.renderGradientConfig()} ${this.renderMixerConfig()} ${this.renderPresetsConfig()}
          ${this.renderBudgetConfig()} ${this.renderSwatchConfig()} ${this.renderMarketConfig()}
          ${this.renderAdvancedSettings()}
        </div>
      </aside>
    `;
  }
}

// TypeScript declaration for custom element
declare global {
  interface HTMLElementTagNameMap {
    'v4-config-sidebar': ConfigSidebar;
  }
}
