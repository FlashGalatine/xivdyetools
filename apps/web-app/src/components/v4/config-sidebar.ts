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

import { html, css, CSSResultGroup, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { BaseLitComponent } from './base-lit-component';
import { ConfigController } from '@services/config-controller';
import { authService, LanguageService } from '@services/index';
import { COMPANION_DYES_MIN, COMPANION_DYES_MAX, COMPANION_DYES_DEFAULT } from '@shared/constants';
import { SUBRACE_TO_CLAN_KEY } from '@shared/subrace-clan';
import { regionLabel } from '@shared/region-name';
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
  ConfigKey,
  DisplayOptionsConfig,
  DyeFiltersConfig,
  MatchingMethod,
} from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS, DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import { showPresetSubmissionForm } from '@components/preset-submission-form';
import type { DataCenter, World } from '@shared/types';
import { logger } from '@shared/logger';

// Import child components to ensure registration
import './toggle-switch-v4';
import './range-slider-v4';
import './display-options-v4';
import './dye-filters-v4';
import type { DisplayOptionsChangeDetail } from './display-options-v4';
import type { DyeFiltersChangeDetail } from './dye-filters-v4';
import { RACE_SUBRACES } from '@xivdyetools/types';
import type { SubRace, Race } from '@xivdyetools/types';

/**
 * First character of a display name, for the avatar chip shown when the auth
 * provider gave us no avatar URL.
 *
 * This replaces a `parseInt(user.id) % 5` guess at Discord's default-avatar
 * index. That guess could never work: `AuthUser.id` is *our* user ID, minted by
 * `crypto.randomUUID()` in the oauth worker -- not a Discord snowflake. When the
 * UUID began with a hex letter (6 of 16 possible first characters) `parseInt`
 * returned `NaN` and the app requested `embed/avatars/NaN.png`, a 404. It was
 * also wrong in principle for XIVAuth users, who have no Discord identity at all.
 *
 * Iterating the string yields code points rather than UTF-16 units, so an emoji
 * or astral-plane name does not render half a surrogate pair. Upper-casing is
 * app-locale aware: bare `toLocaleUpperCase()` follows the BROWSER locale, so a
 * Turkish-locale browser would render a dotted `İ` for an English UI.
 */
export function avatarInitial(name: string): string {
  const first = [...name.trim()][0];
  return first ? first.toLocaleUpperCase(LanguageService.getCurrentLocale()) : '?';
}

/**
 * Localization key for each race — a presentation concern local to this
 * component (differs from the canonical `Race` key by casing).
 */
const RACE_KEY_BY_RACE: Record<Race, string> = {
  Hyur: 'hyur',
  Elezen: 'elezen',
  Lalafell: 'lalafell',
  "Miqo'te": 'miqote',
  Roegadyn: 'roegadyn',
  AuRa: 'auRa',
  Hrothgar: 'hrothgar',
  Viera: 'viera',
};

/**
 * Race groups with their subraces and race key for localization.
 *
 * The race/subrace *set* and order are sourced from the shared
 * `RACE_SUBRACES` table in `@xivdyetools/types` (DEAD-024 adoption);
 * `RACE_KEY_BY_RACE` above is this component's own presentation layer.
 */
export const RACE_GROUPS: Array<{ raceKey: string; subraces: SubRace[] }> = (
  Object.entries(RACE_SUBRACES) as Array<[Race, readonly [SubRace, SubRace]]>
).map(([race, subraces]) => ({
  raceKey: RACE_KEY_BY_RACE[race],
  subraces: [...subraces],
}));

/**
 * V4 Config Sidebar - Tool configuration panel
 *
 * @fires sidebar-collapse - When the header × is clicked (desktop Simple-Settings column; the shell collapses the column and the console-bar gear restores it)
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

  /**
   * Embedded mode: hosted inside the Advanced Options slide-over rather than
   * as a standalone column — drops its own header/chrome (Q7 decision).
   */
  @property({ type: Boolean, reflect: true })
  embedded = false;

  // =========================================================================
  // Tool Configuration State
  // =========================================================================

  @state() private harmonyConfig: HarmonyConfig = {
    harmonyType: 'tetradic',
    strictMatching: false,
    matchingMethod: 'ciede2000',
    preventDuplicates: true,
    companionDyesCount: COMPANION_DYES_DEFAULT,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
    dyeFilters: { ...DEFAULT_DYE_FILTERS },
  };
  @state() private extractorConfig: ExtractorConfig = {
    vibrancyBoost: true,
    maxColors: 8,
    dragThreshold: 5,
    sampleAreaSize: 1,
    matchingMethod: 'ciede2000',
    preventDuplicates: true,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
    dyeFilters: { ...DEFAULT_DYE_FILTERS },
  };
  @state() private accessibilityConfig: AccessibilityConfig = {
    normalVision: true,
    deuteranopia: true,
    protanopia: true,
    tritanopia: true,
    achromatopsia: true,
    displayOptions: {
      ...DEFAULT_DISPLAY_OPTIONS,
      showPrice: false,
      showDeltaE: false,
      showAcquisition: false,
    },
  };
  @state() private comparisonConfig: ComparisonConfig = {
    matchThreshold: 5,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };
  @state() private gradientConfig: GradientConfig = {
    stepCount: 8,
    interpolation: 'hsv',
    matchingMethod: 'ciede2000',
    preventDuplicates: true,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
    dyeFilters: { ...DEFAULT_DYE_FILTERS },
  };
  @state() private mixerConfig: MixerConfig = {
    maxResults: 3,
    mixingMode: 'ryb',
    matchingMethod: 'ciede2000',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
    dyeFilters: { ...DEFAULT_DYE_FILTERS },
  };
  @state() private presetsConfig: PresetsConfig = {
    sortBy: 'popular',
    category: 'all',
    feedShots: true,
    feedBlend: false,
    feedHideUnbuyable: false,
    savedFirst: true,
    keepDeleted: true,
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  };
  @state() private budgetConfig: BudgetConfig = {
    maxDeltaE: 8,
    matchingMethod: 'ciede2000',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
    dyeFilters: { ...DEFAULT_DYE_FILTERS },
  };
  @state() private swatchConfig: SwatchConfig = {
    colorSheet: 'eyeColors',
    fileProvided: false,
    race: 'Midlander',
    gender: 'Male',
    maxResults: 3,
    matchingMethod: 'ciede2000',
    displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
    dyeFilters: { ...DEFAULT_DYE_FILTERS },
  };

  // Global display options shared across all tools
  @state() private globalDisplayOptions: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

  // Global dye filters shared across all tools
  @state() private globalDyeFilters: DyeFiltersConfig = { ...DEFAULT_DYE_FILTERS };

  @state() private marketConfig: MarketConfig = {
    selectedServer: 'Crystal',
    showPrices: false,
  };

  // Server data for market config dropdown
  @state() private dataCenters: DataCenter[] = [];
  @state() private worlds: World[] = [];

  // Collapsible section state
  @state() private marketBoardCollapsed: boolean = false;

  private configController: ConfigController | null = null;
  private languageUnsubscribe: (() => void) | null = null;
  private swatchConfigUnsubscribe: (() => void) | null = null;
  private harmonyConfigUnsubscribe: (() => void) | null = null;
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

      /* Embedded inside the Advanced Options slide-over (Q7: the config
         surface lives behind the header gear, not in a persistent column) */
      :host([embedded]) {
        width: 100%;
        height: auto;
      }

      :host([embedded]) .v4-config-sidebar {
        background: transparent;
        backdrop-filter: none;
        -webkit-backdrop-filter: none;
        border-right: none;
        height: auto;
      }

      :host([embedded]) .v4-sidebar-header {
        display: none;
      }

      :host([embedded]) .v4-sidebar-content {
        padding: 0;
        overflow-y: visible;
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

      /* 8A: one-line explanation under a toggle */
      .config-hint {
        font-size: 11px;
        line-height: 1.45;
        color: var(--theme-text-muted, #a0a0a0);
        margin: 2px 0 10px;
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
        background-color: #5865f2;
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

      /* Shown when the provider gave us no avatar. Local, so it cannot 404 and
         costs no third-party request. */
      .user-avatar--initial {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 auto;
        background: color-mix(in srgb, var(--theme-primary, #ea4133) 18%, transparent);
        color: var(--theme-primary, #ea4133);
        font-weight: 600;
        font-size: 15px;
        line-height: 1;
        user-select: none;
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

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        :host {
          transition: none;
        }
        .auth-btn,
        .submit-btn,
        .logout-btn {
          transition: none;
        }
      }
    `,
  ];

  override connectedCallback(): void {
    super.connectedCallback();
    this.loadConfigsFromController();
    void this.loadServerData();
    // 10A: the swatch tool pushes config changes of its own (a .chara file
    // sets tribe/gender and the fileProvided readout lock) — the sidebar
    // must follow, not just lead.
    this.swatchConfigUnsubscribe =
      this.configController?.subscribe('swatch', (config) => {
        this.swatchConfig = config;
      }) ?? null;
    // 1A: the harmony type rail sets the type from the workspace — the
    // sidebar dropdown has to follow it, same one-way gotcha as swatch.
    this.harmonyConfigUnsubscribe =
      this.configController?.subscribe('harmony', (config) => {
        this.harmonyConfig = config;
      }) ?? null;
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
    this.swatchConfigUnsubscribe?.();
    this.swatchConfigUnsubscribe = null;
    this.harmonyConfigUnsubscribe?.();
    this.harmonyConfigUnsubscribe = null;
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
    this.globalDyeFilters = globalConfig.dyeFilters || { ...DEFAULT_DYE_FILTERS };

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
      // Type assertion needed because computed property keys lose type safety
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.configController.setConfig(tool, { [key]: value } as any);
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
   * Handle display options change from v4-display-options component.
   * Updates global display options that are shared across all tools.
   */
  private handleDisplayOptionsChange(
    _tool:
      | 'harmony'
      | 'mixer'
      | 'gradient'
      | 'swatch'
      | 'accessibility'
      | 'comparison'
      | 'budget'
      | 'extractor',
    e: CustomEvent<DisplayOptionsChangeDetail>
  ): void {
    const { option, value, allOptions } = e.detail;

    // Update global display options (shared across all tools)
    this.globalDisplayOptions = allOptions;

    // Save to global config via ConfigController
    if (this.configController) {
      (this.configController as ConfigController).setConfig('global', {
        displayOptions: allOptions,
      });

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
   * Handle dye filters change from v4-dye-filters component.
   * Updates global dye filters that are shared across applicable tools.
   */
  private handleDyeFiltersChange(e: CustomEvent<DyeFiltersChangeDetail>): void {
    const { filter, value, allFilters } = e.detail;

    // Update global dye filters (shared across applicable tools)
    this.globalDyeFilters = allFilters;

    // Save to global config via ConfigController
    if (this.configController) {
      (this.configController as ConfigController).setConfig('global', {
        dyeFilters: allFilters,
      });

      // Broadcast to all tools that support dye filters
      const toolsWithDyeFilters = [
        'harmony',
        'mixer',
        'gradient',
        'swatch',
        'budget',
        'extractor',
      ] as const;
      for (const tool of toolsWithDyeFilters) {
        (this.configController as ConfigController).setConfig(tool, { dyeFilters: allFilters });
      }
    }

    // Emit event for parent components
    this.emit('config-change', { tool: 'global', key: `dyeFilters.${filter}`, value });
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
            <option value="complementary">
              ${LanguageService.getHarmonyType('complementary')}
            </option>
            <option value="analogous">${LanguageService.getHarmonyType('analogous')}</option>
            <option value="triadic">${LanguageService.getHarmonyType('triadic')}</option>
            <option value="split-complementary">
              ${LanguageService.getHarmonyType('splitComplementary')}
            </option>
            <option value="tetradic">${LanguageService.getHarmonyType('tetradic')}</option>
            <option value="inverted-tetradic">
              ${LanguageService.getHarmonyType('invertedTetradic')}
            </option>
            <option value="square">${LanguageService.getHarmonyType('square')}</option>
            <option value="monochromatic">
              ${LanguageService.getHarmonyType('monochromatic')}
            </option>
            <option value="compound">${LanguageService.getHarmonyType('compound')}</option>
            <option value="shades">${LanguageService.getHarmonyType('shades')}</option>
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
            ${
              this.harmonyConfig.strictMatching
                ? LanguageService.t('config.perceptualMatchingDesc')
                : LanguageService.t('config.hueMatchingDesc')
            }
          </div>
        </div>

        ${
          this.harmonyConfig.strictMatching
            ? this.renderMatchingMethodSection('harmony', this.harmonyConfig.matchingMethod)
            : ''
        }

        <div class="config-group">
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.preventDuplicates')}
              .checked=${this.harmonyConfig.preventDuplicates ?? true}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleConfigChange('harmony', 'preventDuplicates', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-description">${LanguageService.t('config.preventDuplicatesDesc')}</div>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('harmony.companionDyes')}</div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('harmony.companionDyes')}
              .value=${this.harmonyConfig.companionDyesCount ?? COMPANION_DYES_DEFAULT}
              .min=${COMPANION_DYES_MIN}
              .max=${COMPANION_DYES_MAX}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
                this.handleConfigChange('harmony', 'companionDyesCount', e.detail.value)}
            ></v4-range-slider>
          </div>
          <div class="config-description">${LanguageService.t('harmony.companionDyesDesc')}</div>
        </div>

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showCmyk=${this.globalDisplayOptions.showCmyk}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .showHue=${this.globalDisplayOptions.showHue ?? true}
          .showStain=${this.globalDisplayOptions.showStain ?? true}
          .showSpectrum=${this.globalDisplayOptions.showSpectrum ?? true}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
            this.handleDisplayOptionsChange('harmony', e)}
        ></v4-display-options>

        <v4-dye-filters
          .excludeMetallic=${this.globalDyeFilters.excludeMetallic}
          .excludePastel=${this.globalDyeFilters.excludePastel}
          .excludeDark=${this.globalDyeFilters.excludeDark}
          .excludeCosmic=${this.globalDyeFilters.excludeCosmic}
          .excludeIshgardian=${this.globalDyeFilters.excludeIshgardian}
          .excludeExpensive=${this.globalDyeFilters.excludeExpensive}
          .excludeCoffers=${this.globalDyeFilters.excludeCoffers}
          .excludeVendorDyes=${this.globalDyeFilters.excludeVendorDyes}
          .excludeCraftDyes=${this.globalDyeFilters.excludeCraftDyes}
          @dye-filters-change=${(e: CustomEvent<DyeFiltersChangeDetail>) =>
            this.handleDyeFiltersChange(e)}
        ></v4-dye-filters>
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

        <div class="config-group">
          <div class="config-label">${LanguageService.t('config.sampleAreaSize')}</div>
          <select
            class="config-select"
            .value=${String(this.extractorConfig.sampleAreaSize ?? 1)}
            title=${LanguageService.t('config.sampleAreaSizeTooltip')}
            @change=${(e: Event) => {
              const value = parseInt((e.target as HTMLSelectElement).value, 10);
              this.handleConfigChange('extractor', 'sampleAreaSize', value);
            }}
          >
            ${[1, 2, 4, 8, 16].map(
              (size) => html`
                <option
                  value=${size}
                  ?selected=${(this.extractorConfig.sampleAreaSize ?? 1) === size}
                >
                  ${size}×${size}${
                    size === 1 ? ` (${LanguageService.t('config.singlePixel')})` : ''
                  }
                </option>
              `
            )}
          </select>
          <div class="config-description">${LanguageService.t('config.sampleAreaSizeTooltip')}</div>
        </div>

        ${this.renderMatchingMethodSection('extractor', this.extractorConfig.matchingMethod)}

        <div class="config-group">
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.preventDuplicates')}
              .checked=${this.extractorConfig.preventDuplicates ?? true}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleConfigChange('extractor', 'preventDuplicates', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-description">${LanguageService.t('config.preventDuplicatesDesc')}</div>
        </div>

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showCmyk=${this.globalDisplayOptions.showCmyk}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .showHue=${this.globalDisplayOptions.showHue ?? true}
          .showStain=${this.globalDisplayOptions.showStain ?? true}
          .showSpectrum=${this.globalDisplayOptions.showSpectrum ?? true}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
            this.handleDisplayOptionsChange('extractor', e)}
        ></v4-display-options>

        <v4-dye-filters
          .excludeMetallic=${this.globalDyeFilters.excludeMetallic}
          .excludePastel=${this.globalDyeFilters.excludePastel}
          .excludeDark=${this.globalDyeFilters.excludeDark}
          .excludeCosmic=${this.globalDyeFilters.excludeCosmic}
          .excludeIshgardian=${this.globalDyeFilters.excludeIshgardian}
          .excludeExpensive=${this.globalDyeFilters.excludeExpensive}
          .excludeCoffers=${this.globalDyeFilters.excludeCoffers}
          .excludeVendorDyes=${this.globalDyeFilters.excludeVendorDyes}
          .excludeCraftDyes=${this.globalDyeFilters.excludeCraftDyes}
          @dye-filters-change=${(e: CustomEvent<DyeFiltersChangeDetail>) =>
            this.handleDyeFiltersChange(e)}
        ></v4-dye-filters>
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

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showCmyk=${this.globalDisplayOptions.showCmyk}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .showHue=${this.globalDisplayOptions.showHue ?? true}
          .showStain=${this.globalDisplayOptions.showStain ?? true}
          .showSpectrum=${this.globalDisplayOptions.showSpectrum ?? true}
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
        <div class="config-group">
          <div class="config-label">${LanguageService.t('comparison.matchLine')}</div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('comparison.matchLine')}
              .value=${this.comparisonConfig.matchThreshold ?? 5}
              .min=${1}
              .max=${15}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
                this.handleConfigChange('comparison', 'matchThreshold', e.detail.value)}
            ></v4-range-slider>
          </div>
        </div>
        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showCmyk=${this.globalDisplayOptions.showCmyk}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .showHue=${this.globalDisplayOptions.showHue ?? true}
          .showStain=${this.globalDisplayOptions.showStain ?? true}
          .showSpectrum=${this.globalDisplayOptions.showSpectrum ?? true}
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
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('config.preventDuplicates')}
              .checked=${this.gradientConfig.preventDuplicates ?? true}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleConfigChange('gradient', 'preventDuplicates', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-description">${LanguageService.t('config.preventDuplicatesDesc')}</div>
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
          <div class="config-description">${this.getColorSpaceDescription()}</div>
        </div>

        ${this.renderMatchingMethodSection('gradient', this.gradientConfig.matchingMethod)}

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showCmyk=${this.globalDisplayOptions.showCmyk}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .showHue=${this.globalDisplayOptions.showHue ?? true}
          .showStain=${this.globalDisplayOptions.showStain ?? true}
          .showSpectrum=${this.globalDisplayOptions.showSpectrum ?? true}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
            this.handleDisplayOptionsChange('gradient', e)}
        ></v4-display-options>

        <v4-dye-filters
          .excludeMetallic=${this.globalDyeFilters.excludeMetallic}
          .excludePastel=${this.globalDyeFilters.excludePastel}
          .excludeDark=${this.globalDyeFilters.excludeDark}
          .excludeCosmic=${this.globalDyeFilters.excludeCosmic}
          .excludeIshgardian=${this.globalDyeFilters.excludeIshgardian}
          .excludeExpensive=${this.globalDyeFilters.excludeExpensive}
          .excludeCoffers=${this.globalDyeFilters.excludeCoffers}
          .excludeVendorDyes=${this.globalDyeFilters.excludeVendorDyes}
          .excludeCraftDyes=${this.globalDyeFilters.excludeCraftDyes}
          @dye-filters-change=${(e: CustomEvent<DyeFiltersChangeDetail>) =>
            this.handleDyeFiltersChange(e)}
        ></v4-dye-filters>
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
          <div class="config-description">${this.getMixingModeDescription()}</div>
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
          .showCmyk=${this.globalDisplayOptions.showCmyk}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .showHue=${this.globalDisplayOptions.showHue ?? true}
          .showStain=${this.globalDisplayOptions.showStain ?? true}
          .showSpectrum=${this.globalDisplayOptions.showSpectrum ?? true}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
            this.handleDisplayOptionsChange('mixer', e)}
        ></v4-display-options>

        <v4-dye-filters
          .excludeMetallic=${this.globalDyeFilters.excludeMetallic}
          .excludePastel=${this.globalDyeFilters.excludePastel}
          .excludeDark=${this.globalDyeFilters.excludeDark}
          .excludeCosmic=${this.globalDyeFilters.excludeCosmic}
          .excludeIshgardian=${this.globalDyeFilters.excludeIshgardian}
          .excludeExpensive=${this.globalDyeFilters.excludeExpensive}
          .excludeCoffers=${this.globalDyeFilters.excludeCoffers}
          .excludeVendorDyes=${this.globalDyeFilters.excludeVendorDyes}
          .excludeCraftDyes=${this.globalDyeFilters.excludeCraftDyes}
          @dye-filters-change=${(e: CustomEvent<DyeFiltersChangeDetail>) =>
            this.handleDyeFiltersChange(e)}
        ></v4-dye-filters>
      </div>
    `;
  }

  /**
   * Get description text for the current matching method
   */
  private getMatchingMethodDescription(method: MatchingMethod): string {
    switch (method) {
      case 'ciede2000':
        return LanguageService.t('config.matchingCiede2000Desc');
      case 'oklab':
        return LanguageService.t('config.matchingOklabDesc');
      case 'cie76':
        return LanguageService.t('config.matchingCie76Desc');
      case 'redmean':
        return LanguageService.t('config.matchingRedmeanDesc');
      case 'rgb':
        return LanguageService.t('config.matchingRgbDesc');
      case 'distinguish':
        return LanguageService.t('config.matchingDistinguishDesc');
      default:
        return '';
    }
  }

  /**
   * Render matching method dropdown for a tool
   *
   * The leading ΔE2000 / ΔEOK / ΔE76 / REDMEAN / RGB DIST / DISTINGUISH % tags are
   * identifiers by decision (2026-08-20 i18n audit) — never localised.
   */
  private renderMatchingMethodSection(
    toolKey: 'harmony' | 'extractor' | 'gradient' | 'mixer' | 'budget' | 'swatch',
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
          <option value="ciede2000">
            ΔE2000 - ${LanguageService.t('config.matchingCiede2000')}
          </option>
          <option value="oklab">ΔEOK - ${LanguageService.t('config.matchingOklab')}</option>
          <option value="cie76">ΔE76 - ${LanguageService.t('config.matchingCie76')}</option>
          <option value="redmean">REDMEAN - ${LanguageService.t('config.matchingRedmean')}</option>
          <option value="rgb">RGB DIST - ${LanguageService.t('config.matchingRgb')}</option>
          <option value="distinguish">
            DISTINGUISH % - ${LanguageService.t('config.matchingDistinguish')}
          </option>
        </select>
        <div class="config-description">${this.getMatchingMethodDescription(currentMethod)}</div>
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

        <!-- 8A: category + sort moved onto the page (rail + cycling sort);
             the sidebar carries the Feed and Saved-shelf options instead -->
        <div class="config-group">
          <div class="config-label">${LanguageService.t('preset.tabCommunity')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('preset.cfgShowShots')}
              .checked=${this.presetsConfig.feedShots}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleConfigChange('presets', 'feedShots', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-hint">${LanguageService.t('preset.cfgShowShotsDesc')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('preset.cfgBlend')}
              .checked=${this.presetsConfig.feedBlend}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleConfigChange('presets', 'feedBlend', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-hint">${LanguageService.t('preset.cfgBlendDesc')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('preset.cfgHideUnbuyable')}
              .checked=${this.presetsConfig.feedHideUnbuyable}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleConfigChange('presets', 'feedHideUnbuyable', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-hint">${LanguageService.t('preset.cfgHideUnbuyableDesc')}</div>
        </div>

        <div class="config-group">
          <div class="config-label">${LanguageService.t('preset.tabSaved')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('preset.cfgSavedFirst')}
              .checked=${this.presetsConfig.savedFirst}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleConfigChange('presets', 'savedFirst', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-hint">${LanguageService.t('preset.cfgSavedFirstDesc')}</div>
          <div class="config-row">
            <v4-toggle-switch
              label=${LanguageService.t('preset.cfgKeepDeleted')}
              .checked=${this.presetsConfig.keepDeleted}
              @toggle-change=${(e: CustomEvent<{ checked: boolean }>) =>
                this.handleConfigChange('presets', 'keepDeleted', e.detail.checked)}
            ></v4-toggle-switch>
          </div>
          <div class="config-hint">${LanguageService.t('preset.cfgKeepDeletedDesc')}</div>
          <div class="config-hint" style="margin-top: 6px; opacity: 0.85;">
            ${LanguageService.t('preset.cfgStoredLocallyHint')}
          </div>
        </div>

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showCmyk=${this.globalDisplayOptions.showCmyk}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .showHue=${this.globalDisplayOptions.showHue ?? true}
          .showStain=${this.globalDisplayOptions.showStain ?? true}
          .showSpectrum=${this.globalDisplayOptions.showSpectrum ?? true}
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
      const displayName =
        user.global_name || user.username || LanguageService.t('config.userFallback');
      const providerLabel = user.auth_provider === 'xivauth' ? 'XIVAuth' : 'Discord';

      return html`
        <div class="auth-section">
          <div class="config-label">${LanguageService.t('config.account')}</div>
          <div class="user-card">
            ${
              user.avatar_url
                ? html`<img class="user-avatar" src="${user.avatar_url}" alt="${displayName}" />`
                : html`<div class="user-avatar user-avatar--initial" aria-hidden="true">
                    ${avatarInitial(displayName)}
                  </div>`
            }
            <div class="user-info">
              <div class="user-name">${displayName}</div>
              <div class="user-provider">
                ${LanguageService.tInterpolate('config.via', { provider: providerLabel })}
              </div>
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
              <path
                d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
              />
            </svg>
            ${LanguageService.t('config.loginWithDiscord')}
          </button>
          <button class="auth-btn auth-btn-xivauth" @click=${() => this.handleLogin('xivauth')}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
              />
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
      void authService.loginWithXIVAuth(undefined, 'presets');
    } else {
      void authService.login(undefined, 'presets');
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
          <div class="config-label">${LanguageService.t('budget.matchLine')}</div>
          <div class="slider-wrapper">
            <v4-range-slider
              label=${LanguageService.t('budget.matchLine')}
              .value=${this.budgetConfig.maxDeltaE}
              .min=${2}
              .max=${20}
              .disabled=${this.budgetConfig.matchingMethod !== 'ciede2000'}
              @slider-change=${(e: CustomEvent<{ value: number }>) =>
                this.handleConfigChange('budget', 'maxDeltaE', e.detail.value)}
            ></v4-range-slider>
          </div>
        </div>

        ${this.renderMatchingMethodSection('budget', this.budgetConfig.matchingMethod)}

        <v4-display-options
          .showHex=${this.globalDisplayOptions.showHex}
          .showRgb=${this.globalDisplayOptions.showRgb}
          .showHsv=${this.globalDisplayOptions.showHsv}
          .showLab=${this.globalDisplayOptions.showLab}
          .showCmyk=${this.globalDisplayOptions.showCmyk}
          .showPrice=${this.globalDisplayOptions.showPrice}
          .showDeltaE=${this.globalDisplayOptions.showDeltaE}
          .showAcquisition=${this.globalDisplayOptions.showAcquisition}
          .showHue=${this.globalDisplayOptions.showHue ?? true}
          .showStain=${this.globalDisplayOptions.showStain ?? true}
          .showSpectrum=${this.globalDisplayOptions.showSpectrum ?? true}
          .visibleGroups=${['colorFormats', 'resultMetadata']}
          @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
            this.handleDisplayOptionsChange('budget', e)}
        ></v4-display-options>

        <v4-dye-filters
          .excludeMetallic=${this.globalDyeFilters.excludeMetallic}
          .excludePastel=${this.globalDyeFilters.excludePastel}
          .excludeDark=${this.globalDyeFilters.excludeDark}
          .excludeCosmic=${this.globalDyeFilters.excludeCosmic}
          .excludeIshgardian=${this.globalDyeFilters.excludeIshgardian}
          .excludeExpensive=${this.globalDyeFilters.excludeExpensive}
          .excludeCoffers=${this.globalDyeFilters.excludeCoffers}
          .excludeVendorDyes=${this.globalDyeFilters.excludeVendorDyes}
          .excludeCraftDyes=${this.globalDyeFilters.excludeCraftDyes}
          @dye-filters-change=${(e: CustomEvent<DyeFiltersChangeDetail>) =>
            this.handleDyeFiltersChange(e)}
        ></v4-dye-filters>
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
        <!-- 10A: the nine-entry colorSheet dropdown is cut — the palette rail
             on the grid panel owns category + range now. -->
        <div class="config-group" ?hidden=${!showCharacterSection}>
          <div class="config-label">${LanguageService.t('swatch.whoHead')}</div>
          <select
            class="config-select"
            ?disabled=${this.swatchConfig.fileProvided}
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
                      <option value="${subrace}" ?selected=${this.swatchConfig.race === subrace}>
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
            ?disabled=${this.swatchConfig.fileProvided}
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
          <div class="config-hint">${LanguageService.t('swatch.whoHint')}</div>
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
            .showCmyk=${this.globalDisplayOptions.showCmyk}
            .showPrice=${this.globalDisplayOptions.showPrice}
            .showDeltaE=${this.globalDisplayOptions.showDeltaE}
            .showAcquisition=${this.globalDisplayOptions.showAcquisition}
            .showHue=${this.globalDisplayOptions.showHue ?? true}
            .showStain=${this.globalDisplayOptions.showStain ?? true}
            .showSpectrum=${this.globalDisplayOptions.showSpectrum ?? true}
            .visibleGroups=${['colorFormats', 'resultMetadata']}
            @display-options-change=${(e: CustomEvent<DisplayOptionsChangeDetail>) =>
              this.handleDisplayOptionsChange('swatch', e)}
          ></v4-display-options>
        </div>

        <v4-dye-filters
          .excludeMetallic=${this.globalDyeFilters.excludeMetallic}
          .excludePastel=${this.globalDyeFilters.excludePastel}
          .excludeDark=${this.globalDyeFilters.excludeDark}
          .excludeCosmic=${this.globalDyeFilters.excludeCosmic}
          .excludeIshgardian=${this.globalDyeFilters.excludeIshgardian}
          .excludeExpensive=${this.globalDyeFilters.excludeExpensive}
          .excludeCoffers=${this.globalDyeFilters.excludeCoffers}
          .excludeVendorDyes=${this.globalDyeFilters.excludeVendorDyes}
          .excludeCraftDyes=${this.globalDyeFilters.excludeCraftDyes}
          @dye-filters-change=${(e: CustomEvent<DyeFiltersChangeDetail>) =>
            this.handleDyeFiltersChange(e)}
        ></v4-dye-filters>
      </div>
    `;
  }

  /**
   * Check if current tool supports market data
   */
  private toolSupportsMarket(): boolean {
    return [
      'harmony',
      'comparison',
      'budget',
      'mixer',
      'extractor',
      'gradient',
      'presets',
      'swatch',
    ].includes(this.activeTool);
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
              ${
                this.dataCenters.length === 0
                  ? html`<option value="Crystal">
                      ${LanguageService.t('config.loadingServers')}
                    </option>`
                  : sortedDataCenters.map(
                      (dc) => html`
                        <optgroup label="${dc.name} (${regionLabel(dc.region)})">
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
                    )
              }
            </select>
            <div class="config-description">
              ${LanguageService.tInterpolate('config.pricesFetchedFrom', {
                server: this.marketConfig.selectedServer,
              })}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  protected override render(): TemplateResult {
    return html`
      <aside
        class="v4-config-sidebar"
        role="complementary"
        aria-label="${LanguageService.t('aria.toggleConfigSidebar')}"
      >
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
