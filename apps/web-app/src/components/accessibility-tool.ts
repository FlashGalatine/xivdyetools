/**
 * XIV Dye Tools v3.0.0 - Accessibility Tool Component
 *
 * Phase 4: Accessibility Checker migration to v3 two-panel layout.
 * Orchestrates colorblindness simulation and accessibility analysis.
 *
 * Left Panel: Dye selector (up to 4), vision type toggles, display options
 * Right Panel: Vision simulations, contrast analysis, distinguishability matrix
 *
 * @module components/tools/accessibility-tool
 */

import { BaseComponent } from '@components/base-component';
import { DyeSelector } from '@components/dye-selector';
import { CollapsiblePanel } from '@components/collapsible-panel';
// Side-effect import registers <v4-result-card>; the named import alone is
// type-only in this file and gets elided, leaving the element undefined on a
// direct /accessibility load
import '@components/v4/result-card';
import type { ResultCard, ResultCardData, ContextAction } from '@components/v4/result-card';
import {
  ColorService,
  ConfigController,
  LanguageService,
  StorageService,
  dyeService,
  applyDisplayOptions,
} from '@services/index';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye } from '@xivdyetools/types';
import type { AccessibilityConfig, DisplayOptionsConfig } from '@shared/tool-config-types';
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';
import { ICON_TOOL_ACCESSIBILITY } from '@shared/tool-icons';
import { ICON_WARNING, ICON_BEAKER, ICON_EYE, ICON_SLIDERS } from '@shared/ui-icons';
import {
  PAIR_READOUT_UNITS,
  createMetricHelp,
  tierColor,
  shiftTierColor,
  type PairReadoutUnit,
} from '@components/metric-help';
import { ThemeService } from '@services/theme-service';
import '@components/v4/share-button';
import type { ShareButton } from '@components/v4/share-button';
import { ShareService } from '@services/share-service';

// ============================================================================
// Types and Constants
// ============================================================================

export interface AccessibilityToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/**
 * Contrast result for a single background
 */
interface ContrastResult {
  ratio: number;
  wcagLevel: 'AAA' | 'AA' | 'Fail';
}

/**
 * Individual dye accessibility analysis
 */
interface DyeAccessibilityResult {
  dyeId: number;
  dyeName: string;
  hex: string;
  contrastVsWhite: ContrastResult;
  contrastVsBlack: ContrastResult;
  warnings: string[];
  colorblindnessSimulations: {
    normal: string;
    deuteranopia: string;
    protanopia: string;
    tritanopia: string;
    achromatopsia: string;
  };
}

/**
 * Dye pair comparison result
 */
interface DyePairResult {
  dye1Id: number;
  dye1Name: string;
  dye1Hex: string;
  dye2Id: number;
  dye2Name: string;
  dye2Hex: string;
  contrastRatio: number;
  wcagLevel: 'AAA' | 'AA' | 'Fail';
  distinguishability: number;
  colorblindnessDistinguishability: {
    normal: number;
    deuteranopia: number;
    protanopia: number;
    tritanopia: number;
  };
  warnings: string[];
}

/**
 * Display options state
 */
interface DisplayOptions {
  showLabels: boolean;
  showHexValues: boolean;
  highContrastMode: boolean;
}

/**
 * Vision type configuration
 */
const VISION_TYPES = [
  {
    id: 'normal',
    localeKey: 'normal',
    prevalence: '~92%',
    description: 'Standard Color Perception',
  },
  {
    id: 'deuteranopia',
    localeKey: 'deuteranopia',
    prevalence: '~6% males',
    description: 'Red-Green Colorblindness',
  },
  {
    id: 'protanopia',
    localeKey: 'protanopia',
    prevalence: '~2% males',
    description: 'Red-Green Colorblindness',
  },
  {
    id: 'tritanopia',
    localeKey: 'tritanopia',
    prevalence: '~0.01%',
    description: 'Blue-Yellow Colorblindness',
  },
  {
    id: 'achromatopsia',
    localeKey: 'achromatopsia',
    prevalence: '~0.003%',
    description: 'Total Colorblindness',
  },
] as const;

type VisionTypeId = (typeof VISION_TYPES)[number]['id'];

/**
 * Storage keys for v3 accessibility tool
 */
const STORAGE_KEYS = {
  selectedDyes: 'v3_accessibility_selected_dyes',
  enabledVisionTypes: 'v3_accessibility_vision_types',
  displayOptions: 'v3_accessibility_display_options',
  activeLens: 'v5_accessibility_lens',
  readoutUnit: 'v5_accessibility_unit',
} as const;

/**
 * pct-unit fail threshold (6A: tight = 2x). 25 keeps the Fine band real —
 * at 30 the tight cut collides with the 60 good cut and Fine collapses.
 */
const DEFAULT_PCT_THRESHOLD = 25;

/**
 * Default enabled vision types (all four colorblindness types plus normal vision)
 */
const DEFAULT_VISION_TYPES: VisionTypeId[] = [
  'normal',
  'deuteranopia',
  'protanopia',
  'tritanopia',
  'achromatopsia',
];

/**
 * Default simulation display options (for vision simulation cards)
 */
const DEFAULT_SIMULATION_OPTIONS: DisplayOptions = {
  showLabels: true,
  showHexValues: false,
  highContrastMode: false,
};

// ============================================================================
// AccessibilityTool Component
// ============================================================================

/**
 * Accessibility Tool - v3 Two-Panel Layout
 *
 * Simulates colorblindness and analyzes dye distinguishability
 * for up to 4 selected dyes.
 */
export class AccessibilityTool extends BaseComponent {
  private options: AccessibilityToolOptions;

  // State
  private selectedDyes: Dye[] = [];
  private enabledVisionTypes: Set<VisionTypeId>;
  private displayOptions: DisplayOptions;
  private cardDisplayOptions: DisplayOptionsConfig;
  private dyeResults: DyeAccessibilityResult[] = [];
  private pairResults: DyePairResult[] = [];
  private shareVisionType: VisionTypeId = 'protanopia'; // Default vision type for sharing

  // 6A Lens state
  private activeVision: VisionTypeId = 'normal';
  private readoutUnit: PairReadoutUnit = 'pct';
  private helpOpen = false;

  // Child components (Desktop)
  private dyeSelector: DyeSelector | null = null;
  private dyePanel: CollapsiblePanel | null = null;
  private visionPanel: CollapsiblePanel | null = null;
  private displayPanel: CollapsiblePanel | null = null;
  private shareButton: ShareButton | null = null;
  private shareVisionSelect: HTMLSelectElement | null = null;

  // Child components (Mobile Drawer) - separate instances for drawer vs desktop
  private drawerDyeSelector: DyeSelector | null = null;
  private drawerDyePanel: CollapsiblePanel | null = null;
  private drawerVisionPanel: CollapsiblePanel | null = null;
  private drawerDisplayPanel: CollapsiblePanel | null = null;

  // DOM References
  private visionTogglesContainer: HTMLElement | null = null;
  private displayOptionsContainer: HTMLElement | null = null;
  private selectedDyesSection: HTMLElement | null = null;
  private selectedDyesContainer: HTMLElement | null = null;
  private lensSection: HTMLElement | null = null;
  private lensTabsContainer: HTMLElement | null = null;
  private lensGridContainer: HTMLElement | null = null;
  private pairSection: HTMLElement | null = null;
  private pairHelpContainer: HTMLElement | null = null;
  private pairRowsContainer: HTMLElement | null = null;
  private pairUnitLabel: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;

  // V4 Result Card references for selected dyes display
  private v4ResultCards: ResultCard[] = [];

  // Subscriptions

  constructor(container: HTMLElement, options: AccessibilityToolOptions) {
    super(container);
    this.options = options;

    // Load persisted state
    const savedVisionTypes = StorageService.getItem<VisionTypeId[]>(
      STORAGE_KEYS.enabledVisionTypes
    );
    this.enabledVisionTypes = new Set(savedVisionTypes ?? DEFAULT_VISION_TYPES);

    this.displayOptions = StorageService.getItem<DisplayOptions>(STORAGE_KEYS.displayOptions) ?? {
      ...DEFAULT_SIMULATION_OPTIONS,
    };

    const savedLens = StorageService.getItem<VisionTypeId>(STORAGE_KEYS.activeLens);
    if (savedLens && VISION_TYPES.some((v) => v.id === savedLens)) {
      this.activeVision = savedLens;
    }
    const savedUnit = StorageService.getItem<PairReadoutUnit>(STORAGE_KEYS.readoutUnit);
    if (savedUnit && savedUnit in PAIR_READOUT_UNITS) {
      this.readoutUnit = savedUnit;
    }

    // Initialize card display options (for v4-result-cards)
    this.cardDisplayOptions = {
      ...DEFAULT_DISPLAY_OPTIONS,
      showPrice: false,
      showDeltaE: false,
      showAcquisition: false,
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
      ConfigController.getInstance().subscribe('accessibility', (config) => {
        this.setConfig(config);
      })
    );

    // Try to load from share URL first
    const loadedFromUrl = this.loadFromShareUrl();

    // If dyes were restored from localStorage or share URL, update results now that containers exist
    if (this.selectedDyes.length > 0) {
      this.updateResults();
      this.updateDrawerContent();
      logger.info(
        `[AccessibilityTool] Populated results for ${this.selectedDyes.length} ${loadedFromUrl ? 'shared' : 'restored'} dyes`
      );
    }

    logger.info('[AccessibilityTool] Mounted');
  }

  destroy(): void {
    // Destroy desktop components
    this.dyeSelector?.destroy();
    this.dyePanel?.destroy();
    this.visionPanel?.destroy();
    this.displayPanel?.destroy();

    // Destroy drawer components
    this.drawerDyeSelector?.destroy();
    this.drawerDyePanel?.destroy();
    this.drawerVisionPanel?.destroy();
    this.drawerDisplayPanel?.destroy();

    this.selectedDyes = [];
    this.dyeResults = [];
    this.pairResults = [];

    super.destroy();
    logger.info('[AccessibilityTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Clear all dye selections and return to empty state.
   * Called when "Clear All Dyes" button is clicked in Color Palette.
   */
  public clearDyes(): void {
    this.selectedDyes = [];

    // Clear from storage
    StorageService.removeItem(STORAGE_KEYS.selectedDyes);
    logger.info('[AccessibilityTool] All dyes cleared');

    // Update dye selectors
    this.dyeSelector?.setSelectedDyes([]);
    this.drawerDyeSelector?.setSelectedDyes([]);

    // Clear UI containers
    if (this.selectedDyesContainer) {
      clearContainer(this.selectedDyesContainer);
    }

    // Show empty state and hide other sections
    this.showEmptyState(true);
    this.updateDrawerContent();
  }

  /**
   * Select a dye from the Color Palette drawer
   * Adds to the selection if there's room (max 4 dyes)
   */
  public selectDye(dye: Dye): void {
    if (!dye) return;

    // Don't add duplicates
    if (this.selectedDyes.some((d) => d.id === dye.id)) {
      return;
    }

    // Check max selection limit
    if (this.selectedDyes.length >= 4) {
      // Remove oldest dye and add new one
      this.selectedDyes.shift();
    }

    // Add the dye
    this.selectedDyes.push(dye);

    // Save to storage
    const dyeIds = this.selectedDyes.map((d) => d.id);
    StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);

    // Update selectors
    this.dyeSelector?.setSelectedDyes(this.selectedDyes);
    this.drawerDyeSelector?.setSelectedDyes(this.selectedDyes);

    // Update displays
    this.updateResults();
    this.updateDrawerContent();

    logger.info(`[AccessibilityTool] Selected dye from palette: ${dye.name}`);
  }

  /**
   * Alias for selectDye - some tools use addDye naming
   */
  public addDye(dye: Dye): void {
    this.selectDye(dye);
  }

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   */
  public setConfig(config: Partial<AccessibilityConfig>): void {
    let needsRerender = false;

    // Map config properties to vision type IDs
    const visionTypeMap: Record<string, VisionTypeId> = {
      normalVision: 'normal',
      deuteranopia: 'deuteranopia',
      protanopia: 'protanopia',
      tritanopia: 'tritanopia',
      achromatopsia: 'achromatopsia',
    };

    // Handle vision type toggles
    for (const [configKey, visionId] of Object.entries(visionTypeMap)) {
      const configValue = config[configKey as keyof AccessibilityConfig] as boolean | undefined;
      if (configValue !== undefined) {
        const isEnabled = this.enabledVisionTypes.has(visionId);
        if (configValue !== isEnabled) {
          if (configValue) {
            this.enabledVisionTypes.add(visionId);
          } else {
            this.enabledVisionTypes.delete(visionId);
          }
          needsRerender = true;
          logger.info(`[AccessibilityTool] setConfig: ${configKey} -> ${configValue}`);
        }
      }
    }

    // Handle display options
    if (config.showLabels !== undefined && config.showLabels !== this.displayOptions.showLabels) {
      this.displayOptions.showLabels = config.showLabels;
      needsRerender = true;
      logger.info(`[AccessibilityTool] setConfig: showLabels -> ${config.showLabels}`);
    }

    if (
      config.showHexValues !== undefined &&
      config.showHexValues !== this.displayOptions.showHexValues
    ) {
      this.displayOptions.showHexValues = config.showHexValues;
      needsRerender = true;
      logger.info(`[AccessibilityTool] setConfig: showHexValues -> ${config.showHexValues}`);
    }

    if (
      config.highContrastMode !== undefined &&
      config.highContrastMode !== this.displayOptions.highContrastMode
    ) {
      this.displayOptions.highContrastMode = config.highContrastMode;
      needsRerender = true;
      logger.info(`[AccessibilityTool] setConfig: highContrastMode -> ${config.highContrastMode}`);
    }

    // Handle card display options (for v4-result-cards)
    // WEB-REF-003: Using shared applyDisplayOptions helper
    if (config.displayOptions !== undefined) {
      const result = applyDisplayOptions({
        current: this.cardDisplayOptions,
        incoming: config.displayOptions,
        toolName: 'AccessibilityTool',
        logChanges: false, // Log single summary instead
      });
      if (result.hasChanges) {
        this.cardDisplayOptions = result.options;
        needsRerender = true;
        logger.info(
          '[AccessibilityTool] setConfig: cardDisplayOptions updated',
          this.cardDisplayOptions
        );
      }
    }

    if (needsRerender) {
      // Save to storage
      StorageService.setItem(STORAGE_KEYS.enabledVisionTypes, Array.from(this.enabledVisionTypes));
      StorageService.setItem(STORAGE_KEYS.displayOptions, this.displayOptions);

      // Sync desktop and drawer checkboxes
      this.syncDesktopVisionCheckboxes();
      this.syncDesktopDisplayCheckboxes();

      // Re-render results if we have data
      if (this.selectedDyes.length > 0) {
        this.updateResults();
        this.updateDrawerContent();
      }
    }
  }

  // ============================================================================
  // Left Panel Rendering
  // ============================================================================

  private renderLeftPanel(): void {
    const left = this.options.leftPanel;
    clearContainer(left);

    // Section 1: Dye Selection (Collapsible with beaker icon)
    this.dyePanel = new CollapsiblePanel(left, {
      title: LanguageService.t('accessibility.inspectDyes'),
      storageKey: 'accessibility_dyes',
      defaultOpen: true,
      icon: ICON_BEAKER,
    });
    this.dyePanel.init();
    const dyeContent = this.dyePanel.getContentContainer();
    if (dyeContent) {
      this.renderDyeSelector(dyeContent);
    }

    // Section 2: Vision Types (Collapsible with eye icon)
    this.visionPanel = new CollapsiblePanel(left, {
      title: LanguageService.t('accessibility.visionTypes'),
      storageKey: 'accessibility_vision',
      defaultOpen: true,
      icon: ICON_EYE,
    });
    this.visionPanel.init();
    const visionContent = this.visionPanel.getContentContainer();
    if (visionContent) {
      this.renderVisionToggles(visionContent);
    }

    // Section 3: Display Options (Collapsible with sliders icon, default closed)
    this.displayPanel = new CollapsiblePanel(left, {
      title: LanguageService.t('accessibility.displayOptions'),
      storageKey: 'accessibility_display',
      defaultOpen: false,
      icon: ICON_SLIDERS,
    });
    this.displayPanel.init();
    const displayContent = this.displayPanel.getContentContainer();
    if (displayContent) {
      this.renderDisplayOptions(displayContent);
    }
  }

  /**
   * Create a header for right panel sections
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
    const selectedDisplay = this.createElement('div', {
      className: 'selected-dyes-display space-y-2',
    });
    this.updateSelectedDyesDisplay(selectedDisplay);
    dyeContainer.appendChild(selectedDisplay);

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

    // Restore saved dye selection from localStorage (UI only - results update in onMount)
    const savedDyeIds = StorageService.getItem<number[]>(STORAGE_KEYS.selectedDyes);
    if (savedDyeIds && savedDyeIds.length > 0) {
      const allDyes = dyeService.getAllDyes();
      const restoredDyes = savedDyeIds
        .map((id) => allDyes.find((d) => d.id === id))
        .filter((d): d is Dye => d !== undefined);

      if (restoredDyes.length > 0) {
        this.dyeSelector.setSelectedDyes(restoredDyes);
        this.selectedDyes = restoredDyes;
        this.updateSelectedDyesDisplay(selectedDisplay);
        // NOTE: updateResults() called in onMount() after right panel containers exist
        logger.info(
          `[AccessibilityTool] Restored ${restoredDyes.length} saved dyes from localStorage`
        );
      }
    }

    // Listen for selection changes
    selectorContainer.addEventListener('selection-changed', () => {
      if (this.dyeSelector) {
        this.selectedDyes = this.dyeSelector.getSelectedDyes();
        // Save selected dye IDs to localStorage
        const dyeIds = this.selectedDyes.map((d) => d.id);
        StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);
        this.updateSelectedDyesDisplay(selectedDisplay);
        this.updateResults();
        this.updateDrawerContent();
        this.updateShareButton();
      }
    });

    container.appendChild(dyeContainer);
  }

  /**
   * Update the selected dyes display
   */
  private updateSelectedDyesDisplay(container: HTMLElement): void {
    clearContainer(container);

    if (this.selectedDyes.length === 0) {
      const placeholder = this.createElement('div', {
        className: 'p-3 rounded-lg border-2 border-dashed text-center text-sm',
        textContent: LanguageService.t('accessibility.selectDyesToSeeAnalysis'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      container.appendChild(placeholder);
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
        textContent: LanguageService.t('common.remove'),
        attributes: {
          style: 'background: var(--theme-card-hover); color: var(--theme-text-muted);',
        },
      });

      this.on(removeBtn, 'click', () => {
        // Filter out this dye and update the selector
        const newSelection = this.selectedDyes.filter((d) => d.id !== dye.id);
        this.dyeSelector?.setSelectedDyes(newSelection);
        this.selectedDyes = newSelection;
        // Save updated selection to localStorage
        const dyeIds = newSelection.map((d) => d.id);
        StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);
        this.updateSelectedDyesDisplay(container);
        this.updateResults();
        this.updateDrawerContent();
      });

      dyeItem.appendChild(swatch);
      dyeItem.appendChild(name);
      dyeItem.appendChild(removeBtn);
      container.appendChild(dyeItem);
    }
  }

  /**
   * Render vision type toggles
   */
  private renderVisionToggles(container: HTMLElement): void {
    this.visionTogglesContainer = this.createElement('div', { className: 'space-y-2' });

    for (const type of VISION_TYPES) {
      const isEnabled = this.enabledVisionTypes.has(type.id);
      const label = this.createElement('label', {
        className: 'flex items-center gap-3 cursor-pointer',
      });

      const checkbox = this.createElement('input', {
        attributes: {
          type: 'checkbox',
          'data-vision-type': type.id,
        },
        className: 'w-4 h-4 rounded',
      }) as HTMLInputElement;
      checkbox.checked = isEnabled;

      this.on(checkbox, 'change', () => {
        if (checkbox.checked) {
          this.enabledVisionTypes.add(type.id);
        } else {
          this.enabledVisionTypes.delete(type.id);
        }
        StorageService.setItem(
          STORAGE_KEYS.enabledVisionTypes,
          Array.from(this.enabledVisionTypes)
        );
        this.updateResults();
        this.updateDrawerContent();
      });

      const textContainer = this.createElement('div', { className: 'flex-1' });
      const typeName = this.createElement('p', {
        className: 'text-sm font-medium',
        textContent: LanguageService.getVisionType(type.localeKey),
        attributes: { style: 'color: var(--theme-text);' },
      });
      const typePrevalence = this.createElement('p', {
        className: 'text-xs',
        textContent: type.prevalence,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      textContainer.appendChild(typeName);
      textContainer.appendChild(typePrevalence);

      label.appendChild(checkbox);
      label.appendChild(textContainer);
      this.visionTogglesContainer.appendChild(label);
    }

    container.appendChild(this.visionTogglesContainer);
  }

  /**
   * Render display options
   */
  private renderDisplayOptions(container: HTMLElement): void {
    this.displayOptionsContainer = this.createElement('div', { className: 'space-y-2' });

    const options = [
      { key: 'showLabels', label: LanguageService.t('accessibility.showLabels') },
      {
        key: 'showHexValues',
        label: LanguageService.t('accessibility.showHexValues'),
      },
      {
        key: 'highContrastMode',
        label: LanguageService.t('accessibility.highContrastMode'),
      },
    ] as const;

    for (const option of options) {
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });

      const checkbox = this.createElement('input', {
        attributes: {
          type: 'checkbox',
          'data-display-option': option.key,
        },
        className: 'w-4 h-4 rounded',
      }) as HTMLInputElement;
      checkbox.checked = this.displayOptions[option.key];

      this.on(checkbox, 'change', () => {
        this.displayOptions[option.key] = checkbox.checked;
        StorageService.setItem(STORAGE_KEYS.displayOptions, this.displayOptions);
        this.updateResults();
      });

      const text = this.createElement('span', {
        className: 'text-sm',
        textContent: option.label,
        attributes: { style: 'color: var(--theme-text);' },
      });

      label.appendChild(checkbox);
      label.appendChild(text);
      this.displayOptionsContainer.appendChild(label);
    }

    container.appendChild(this.displayOptionsContainer);
  }

  // ============================================================================
  // Right Panel Rendering
  // ============================================================================

  private renderRightPanel(): void {
    const right = this.options.rightPanel;
    clearContainer(right);

    // Empty state (shown when no dyes selected)
    // Use inline display style for reliable toggling, centered both horizontally and vertically
    this.emptyStateContainer = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          min-height: 300px;
          width: 100%;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    this.renderEmptyState();
    right.appendChild(this.emptyStateContainer);

    // Right Panel Content Wrapper (flex column with gap-8 for consistent spacing, max-width for ultrawide)
    const contentWrapper = this.createElement('div', {
      className: 'flex flex-col gap-8',
      attributes: {
        style: 'max-width: 1200px; margin: 0 auto; width: 100%;',
      },
    });

    // Selected Dyes Section with v4-result-cards (hidden initially)
    this.selectedDyesSection = this.createElement('div', {
      attributes: { style: 'display: none;' },
    });

    // Create header with Share button and vision type selector
    const selectedDyesHeader = this.createElement('div', {
      className: 'section-header',
      attributes: {
        style: 'display: flex; justify-content: space-between; align-items: center;',
      },
    });
    const selectedDyesTitle = this.createElement('span', {
      className: 'section-title',
      textContent: LanguageService.t('accessibility.seenAs'),
    });
    selectedDyesHeader.appendChild(selectedDyesTitle);

    // Share controls container (vision selector + button)
    const shareControls = this.createElement('div', {
      attributes: {
        style: 'display: flex; align-items: center; gap: 8px;',
      },
    });

    // Vision type selector label
    const visionLabel = this.createElement('span', {
      className: 'text-xs',
      textContent: LanguageService.t('accessibility.shareAs'),
      attributes: {
        style: 'color: var(--theme-text-muted);',
      },
    });
    shareControls.appendChild(visionLabel);

    // Vision type dropdown
    this.shareVisionSelect = this.createElement('select', {
      attributes: {
        style: `
          padding: 4px 8px;
          font-size: 12px;
          border-radius: 4px;
          border: 1px solid var(--theme-border);
          background: var(--theme-background-secondary);
          color: var(--theme-text);
          cursor: pointer;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    }) as HTMLSelectElement;

    // Populate dropdown with vision types (excluding 'normal' since it's just the original colors)
    const shareableVisionTypes = VISION_TYPES.filter((t) => t.id !== 'normal');
    for (const type of shareableVisionTypes) {
      const option = this.createElement('option', {
        textContent: LanguageService.getVisionType(type.localeKey),
        attributes: {
          value: type.id,
        },
      }) as HTMLOptionElement;
      if (type.id === this.shareVisionType) {
        option.selected = true;
      }
      this.shareVisionSelect.appendChild(option);
    }

    // Handle vision type change
    this.on(this.shareVisionSelect, 'change', () => {
      if (this.shareVisionSelect) {
        this.shareVisionType = this.shareVisionSelect.value as VisionTypeId;
        this.updateShareButton();
      }
    });

    shareControls.appendChild(this.shareVisionSelect);

    // Share Button - v4-share-button custom element
    this.shareButton = document.createElement('v4-share-button') as ShareButton;
    this.shareButton.tool = 'accessibility';
    this.shareButton.shareParams = this.getShareParams();
    this.shareButton.disabled = this.selectedDyes.length === 0;
    shareControls.appendChild(this.shareButton);

    selectedDyesHeader.appendChild(shareControls);

    this.selectedDyesSection.appendChild(selectedDyesHeader);
    // Horizontal flex layout for cards, centered
    this.selectedDyesContainer = this.createElement('div', {
      attributes: {
        style: `
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          justify-content: center;
        `
          .replace(/\s+/g, ' ')
          .trim(),
      },
    });
    this.selectedDyesSection.appendChild(this.selectedDyesContainer);
    // Appended to contentWrapper AFTER the pair section (drawn order:
    // lens → pairs → as designed → as perceived)

    // 6A: Lens section — vision tabs + the repainted per-dye grid
    this.lensSection = this.createElement('div', {
      attributes: { style: 'display: none;' },
    });
    this.lensSection.appendChild(this.createHeader(LanguageService.t('accessibility.lens')));
    this.lensTabsContainer = this.createElement('div', {
      attributes: {
        role: 'tablist',
        'aria-label': LanguageService.t('accessibility.lens'),
        style: 'display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px;',
      },
    });
    this.lensSection.appendChild(this.lensTabsContainer);
    this.lensGridContainer = this.createElement('div', {
      attributes: {
        style:
          'display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));',
      },
    });
    this.lensSection.appendChild(this.lensGridContainer);
    contentWrapper.appendChild(this.lensSection);

    // 6A: Pair readout — "Can you tell them apart?" + MetricHelp
    this.pairSection = this.createElement('div', {
      attributes: { style: 'display: none;' },
    });
    const pairHeader = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--theme-border);',
      },
    });
    const pairHeaderLeft = this.createElement('div', {
      attributes: { style: 'display: flex; align-items: center; gap: 4px;' },
    });
    pairHeaderLeft.appendChild(
      this.createElement('span', {
        className: 'section-title',
        textContent: LanguageService.t('accessibility.tellApart'),
      })
    );
    const helpBtn = this.createElement('button', {
      className: 'flex items-center justify-center',
      textContent: 'ⓘ',
      attributes: {
        type: 'button',
        'aria-label': LanguageService.t('accessibility.lens'),
        style:
          'width: 32px; height: 32px; border: none; background: transparent; cursor: pointer; color: var(--theme-text-muted); font-size: 14px;',
      },
    });
    this.on(helpBtn, 'click', () => {
      this.helpOpen = !this.helpOpen;
      this.renderPairReadout();
    });
    pairHeaderLeft.appendChild(helpBtn);
    pairHeader.appendChild(pairHeaderLeft);
    this.pairUnitLabel = this.createElement('span', {
      attributes: {
        style:
          "font-family: 'Fragment Mono', monospace; font-size: 11px; color: var(--theme-text-muted);",
      },
    });
    pairHeader.appendChild(this.pairUnitLabel);
    this.pairSection.appendChild(pairHeader);
    this.pairHelpContainer = this.createElement('div');
    this.pairSection.appendChild(this.pairHelpContainer);
    this.pairRowsContainer = this.createElement('div', {
      attributes: { style: 'display: flex; flex-direction: column; gap: 6px;' },
    });
    this.pairSection.appendChild(this.pairRowsContainer);
    contentWrapper.appendChild(this.pairSection);

    contentWrapper.appendChild(this.selectedDyesSection);

    right.appendChild(contentWrapper);
  }

  /**
   * Render empty state with 4 placeholder "Add Dye" cards (matching Compare Tool pattern)
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
        textContent: LanguageService.t('accessibility.addDye'),
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
    iconEl.innerHTML = ICON_TOOL_ACCESSIBILITY;

    // Message text
    const message = this.createElement('p', {
      textContent: LanguageService.t('accessibility.selectDyesToSeeAnalysis'),
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
   * Render selected dyes as v4-result-cards
   * Displays each selected dye with technical details and remove action
   */
  private renderSelectedDyeCards(): void {
    if (!this.selectedDyesContainer) return;
    clearContainer(this.selectedDyesContainer);

    // Clear previous card references
    this.v4ResultCards = [];

    this.selectedDyes.forEach((dye, index) => {
      // Create v4-result-card element
      const card = document.createElement('v4-result-card') as ResultCard;

      // 6A semantics: both swatches are the same dye — as designed → as
      // perceived under the active lens; ΔE is the shift the lens introduces
      const sim = this.simHex(index, this.activeVision);
      const lensActive = this.activeVision !== 'normal';
      const cardData: ResultCardData = {
        dye: dye,
        originalColor: dye.hex,
        matchedColor: lensActive ? sim : dye.hex,
        ...(lensActive ? { deltaE: ColorService.getDeltaE(dye.hex, sim, 'cie2000') } : {}),
      };

      // Assign data to card
      card.data = cardData;

      // Set display options from config - color formats are configurable
      card.showHex = this.cardDisplayOptions.showHex;
      card.showRgb = this.cardDisplayOptions.showRgb;
      card.showHsv = this.cardDisplayOptions.showHsv;
      card.showLab = this.cardDisplayOptions.showLab;
      card.showCmyk = this.cardDisplayOptions.showCmyk;
      card.showHue = this.cardDisplayOptions.showHue ?? true;
      card.showStain = this.cardDisplayOptions.showStain ?? true;
      card.showConsolidation = this.cardDisplayOptions.showSpectrum ?? true;
      card.showDeltaE = lensActive; // 6A: ΔE is the shift the lens introduces
      card.showPrice = false; // Keep prices hidden for accessibility tool
      card.showAcquisition = false; // Keep it simple, focus on colors

      // Set primary action to "Remove"
      card.primaryActionLabel = LanguageService.t('common.remove');

      // Handle "Remove" button click
      card.addEventListener('card-select', ((e: CustomEvent<{ dye: Dye }>) => {
        const dyeToRemove = e.detail.dye;
        this.removeDyeFromSelection(dyeToRemove);
      }) as EventListener);

      // Handle context menu actions (cross-tool navigation)
      card.addEventListener('context-action', ((
        e: CustomEvent<{ action: ContextAction; dye: Dye }>
      ) => {
        this.handleContextAction(e.detail.action, e.detail.dye);
      }) as EventListener);

      // Set card width for horizontal layout
      card.style.width = '280px';
      card.style.flexShrink = '0';

      // Store reference and add to container
      this.v4ResultCards.push(card);
      this.selectedDyesContainer?.appendChild(card);
    });
  }

  /**
   * Remove a dye from the selection
   */
  private removeDyeFromSelection(dye: Dye): void {
    const newSelection = this.selectedDyes.filter((d) => d.id !== dye.id);

    // Update selectors
    this.dyeSelector?.setSelectedDyes(newSelection);
    this.drawerDyeSelector?.setSelectedDyes(newSelection);
    this.selectedDyes = newSelection;

    // Save to storage
    const dyeIds = newSelection.map((d) => d.id);
    StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);

    // Update all displays
    this.updateResults();
    this.updateDrawerContent();

    // Update left panel selected dyes display
    const leftPanelDisplay = this.options.leftPanel.querySelector('.selected-dyes-display');
    if (leftPanelDisplay) {
      this.updateSelectedDyesDisplay(leftPanelDisplay as HTMLElement);
    }

    logger.info(`[AccessibilityTool] Removed dye: ${dye.name}`);
  }

  /**
   * Handle context menu actions for cross-tool navigation
   */
  private handleContextAction(action: ContextAction, dye: Dye): void {
    logger.info(`[AccessibilityTool] Context action: ${action} for ${dye.name}`);

    // Dispatch custom event for app-level handling
    const event = new CustomEvent('tool-context-action', {
      bubbles: true,
      detail: { action, dye, sourceTool: 'accessibility' },
    });
    this.container.dispatchEvent(event);
  }

  /**
   * Update results display
   */
  private updateResults(): void {
    if (this.selectedDyes.length === 0) {
      this.showEmptyState(true);
      return;
    }

    this.showEmptyState(false);

    // Calculate results
    this.dyeResults = this.selectedDyes.map((dye) => this.analyzeDye(dye));

    // Calculate pair results if 2+ dyes
    this.pairResults = [];
    if (this.selectedDyes.length >= 2) {
      for (let i = 0; i < this.selectedDyes.length; i++) {
        for (let j = i + 1; j < this.selectedDyes.length; j++) {
          this.pairResults.push(this.analyzePair(this.selectedDyes[i], this.selectedDyes[j]));
        }
      }
    }

    // Render the 6A sections: lens first, then the pair readout, then the
    // as-designed -> as-perceived cards
    this.renderLensTabs();
    this.renderLensGrid();
    this.renderPairReadout();
    this.renderSelectedDyeCards();
  }

  /**
   * Show/hide empty state
   * Uses inline display styles for reliability (Tailwind .hidden class can have specificity issues)
   */
  private showEmptyState(show: boolean): void {
    if (this.emptyStateContainer) {
      // Use inline style instead of CSS class for reliability
      this.emptyStateContainer.style.display = show ? 'flex' : 'none';
    }

    // Toggle all result sections using direct property references
    const displayValue = show ? 'none' : 'block';
    if (this.selectedDyesSection) {
      this.selectedDyesSection.style.display = displayValue;
    }
    if (this.lensSection) {
      this.lensSection.style.display = displayValue;
    }
    if (this.pairSection) {
      this.pairSection.style.display = displayValue;
    }
  }

  // ==========================================================================
  // 6A Lens renderers
  // ==========================================================================

  /** The vision types currently shown as lens tabs (config can hide some) */
  private visibleVisions(): (typeof VISION_TYPES)[number][] {
    return VISION_TYPES.filter((v) => this.enabledVisionTypes.has(v.id));
  }

  /** Simulated hex of a selected dye under a vision type */
  private simHex(dyeIndex: number, vision: VisionTypeId): string {
    const result = this.dyeResults[dyeIndex];
    if (!result) return '#000000';
    return result.colorblindnessSimulations[vision];
  }

  /** Pair value between two selected dyes under a vision, in the active unit */
  private pairValue(i: number, j: number, vision: VisionTypeId): number {
    const a = this.simHex(i, vision);
    const b = this.simHex(j, vision);
    if (this.readoutUnit === 'ratio') return ColorService.getContrastRatio(a, b);
    if (this.readoutUnit === 'de2000') return ColorService.getDeltaE(a, b, 'cie2000');
    return (ColorService.getColorDistance(a, b) / 441.67) * 100;
  }

  private unitBands(): { good: number; tight: number; fail: number } {
    return PAIR_READOUT_UNITS[this.readoutUnit].bands(DEFAULT_PCT_THRESHOLD);
  }

  /** All pair index combinations for the current selection */
  private pairIndexes(): Array<[number, number]> {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < this.selectedDyes.length; i++) {
      for (let j = i + 1; j < this.selectedDyes.length; j++) {
        pairs.push([i, j]);
      }
    }
    return pairs;
  }

  /**
   * Lens tabs: label + mono prevalence + a dot coloured by that lens's
   * worst pair. Selecting a tab repaints the whole workspace through it.
   */
  private renderLensTabs(): void {
    if (!this.lensTabsContainer) return;
    clearContainer(this.lensTabsContainer);

    const dark = ThemeService.isDarkMode();
    const bands = this.unitBands();
    const pairs = this.pairIndexes();

    for (const vision of this.visibleVisions()) {
      const active = vision.id === this.activeVision;
      const worst = pairs.length
        ? Math.min(...pairs.map(([i, j]) => this.pairValue(i, j, vision.id)))
        : bands.good;

      const tabBase =
        'display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 12px; border-radius: 12px; text-align: left; cursor: pointer; font-family: inherit;';
      const tab = this.createElement('button', {
        attributes: {
          type: 'button',
          role: 'tab',
          'aria-selected': String(active),
          title: LanguageService.t(`accessibility.visionDesc${this.capitalize(vision.id)}`),
          style: active
            ? `${tabBase} background: var(--theme-primary); border: 1px solid var(--theme-primary);`
            : `${tabBase} background: var(--theme-card-background); border: 1px solid var(--theme-border);`,
        },
      });

      tab.appendChild(
        this.createElement('span', {
          textContent: LanguageService.getVisionType(vision.localeKey),
          attributes: {
            style: `font-size: 12px; font-weight: 600; white-space: nowrap; color: ${active ? 'var(--theme-text-header)' : 'var(--theme-text)'};`,
          },
        })
      );

      const subRow = this.createElement('span', {
        attributes: { style: 'display: flex; align-items: center; gap: 6px;' },
      });
      subRow.appendChild(
        this.createElement('span', {
          textContent: vision.prevalence,
          attributes: {
            style: `font-family: 'Fragment Mono', monospace; font-size: 10px; white-space: nowrap; ${active ? 'color: var(--theme-text-header); opacity: 0.8;' : 'color: var(--theme-text-muted);'}`,
          },
        })
      );
      // The dot is the worst pair under that lens
      subRow.appendChild(
        this.createElement('span', {
          attributes: {
            title: LanguageService.t('accessibility.worstHint'),
            style: `display: block; width: 6px; height: 6px; border-radius: 50%; background: ${tierColor(worst, bands, dark)};`,
          },
        })
      );
      tab.appendChild(subRow);

      this.on(tab, 'click', () => {
        this.activeVision = vision.id;
        StorageService.setItem(STORAGE_KEYS.activeLens, this.activeVision);
        this.renderLensTabs();
        this.renderLensGrid();
        this.renderPairReadout();
        this.renderSelectedDyeCards();
      });

      this.lensTabsContainer.appendChild(tab);
    }
  }

  /**
   * The repainted per-dye grid: card ground = the simulated colour, original
   * chip top-left, the lens's DeltaE shift top-right, name bottom.
   */
  private renderLensGrid(): void {
    if (!this.lensGridContainer) return;
    const grid = this.lensGridContainer;
    clearContainer(grid);

    const dark = ThemeService.isDarkMode();

    this.selectedDyes.forEach((dye, i) => {
      const sim = this.simHex(i, this.activeVision);
      const shift = ColorService.getDeltaE(dye.hex, sim, 'cie2000');

      const card = this.createElement('div', {
        attributes: {
          style: `position: relative; border-radius: 12px; overflow: hidden; height: 96px; background: ${sim}; box-shadow: inset 0 0 0 1px rgba(127,127,127,0.22);`,
        },
      });

      // Original colour chip (what the wearer painted)
      card.appendChild(
        this.createElement('span', {
          attributes: {
            title: dye.hex.toUpperCase(),
            style: `position: absolute; top: 7px; left: 7px; display: block; width: 22px; height: 22px; border-radius: 6px; background: ${dye.hex}; box-shadow: 0 0 0 2px rgba(255,255,255,0.55), 0 1px 4px rgba(0,0,0,0.4);`,
          },
        })
      );

      // The shift the lens introduces
      const badge = this.createElement('span', {
        textContent: `\u0394E ${shift.toFixed(1)}`,
        attributes: {
          style: `position: absolute; top: 7px; right: 7px; font-family: 'Fragment Mono', monospace; font-size: 9.5px; padding: 3px 6px; border-radius: 5px; background: rgba(10,10,12,0.42); color: #fff; border-bottom: 2px solid ${shiftTierColor(shift, dark)};`,
        },
      });
      card.appendChild(badge);

      card.appendChild(
        this.createElement('span', {
          textContent: this.dyeResults[i]?.dyeName ?? dye.name,
          attributes: {
            style:
              'position: absolute; left: 7px; right: 7px; bottom: 7px; display: block; font-size: 11px; font-weight: 600; line-height: 1.2; padding: 4px 6px; border-radius: 6px; background: rgba(10,10,12,0.42); color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          },
        })
      );

      grid.appendChild(card);
    });
  }

  /**
   * The pair readout: one row per pair, valued in the active unit through
   * the active lens; the note shows normal -> lens when a lens is active.
   */
  private renderPairReadout(): void {
    if (!this.pairRowsContainer || !this.pairHelpContainer) return;
    clearContainer(this.pairRowsContainer);
    clearContainer(this.pairHelpContainer);

    const unit = PAIR_READOUT_UNITS[this.readoutUnit];
    if (this.pairUnitLabel) {
      this.pairUnitLabel.textContent = LanguageService.t(`accessibility.${unit.stem}Short`);
    }

    if (this.helpOpen) {
      this.pairHelpContainer.appendChild(
        createMetricHelp({
          unit: this.readoutUnit,
          threshold: DEFAULT_PCT_THRESHOLD,
          dark: ThemeService.isDarkMode(),
          onUnitChange: (next) => {
            this.readoutUnit = next;
            StorageService.setItem(STORAGE_KEYS.readoutUnit, next);
            this.renderLensTabs();
            this.renderPairReadout();
          },
        })
      );
    }

    const dark = ThemeService.isDarkMode();
    const bands = this.unitBands();
    const activeShort = this.visionShort(this.activeVision);

    for (const [i, j] of this.pairIndexes()) {
      const value = this.pairValue(i, j, this.activeVision);
      const fails = value < bands.fail;
      const color = tierColor(value, bands, dark);

      const row = this.createElement('div', {
        attributes: {
          style: `display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; min-height: 46px; background: var(--theme-card-background); border: 1px solid ${fails ? color : 'var(--theme-border)'};`,
        },
      });

      // Simulated swatch pair
      const swatches = this.createElement('span', {
        attributes: {
          style:
            'display: flex; flex-shrink: 0; border-radius: 6px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(127,127,127,0.22);',
        },
      });
      for (const idx of [i, j]) {
        swatches.appendChild(
          this.createElement('span', {
            attributes: {
              style: `display: block; width: 17px; height: 30px; background: ${this.simHex(idx, this.activeVision)};`,
            },
          })
        );
      }
      row.appendChild(swatches);

      // Title + note
      const text = this.createElement('span', {
        attributes: {
          style: 'flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px;',
        },
      });
      text.appendChild(
        this.createElement('span', {
          textContent: `${this.dyeResults[i]?.dyeName ?? ''} \u00d7 ${this.dyeResults[j]?.dyeName ?? ''}`,
          attributes: {
            style:
              'font-size: 12px; font-weight: 600; color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          },
        })
      );
      const note =
        this.activeVision === 'normal'
          ? '\u2014'
          : `${unit.format(this.pairValue(i, j, 'normal'))} NRM \u2192 ${unit.format(value)} ${activeShort}`;
      text.appendChild(
        this.createElement('span', {
          textContent: note,
          attributes: {
            style: `font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${fails ? color : 'var(--theme-text-muted)'};`,
          },
        })
      );
      row.appendChild(text);

      // The value
      row.appendChild(
        this.createElement('span', {
          textContent: unit.format(value),
          attributes: {
            style: `flex-shrink: 0; font-weight: 700; font-size: 16px; color: ${color};`,
          },
        })
      );

      this.pairRowsContainer.appendChild(row);
    }
  }

  /** Mono short code for a vision type (NRM/DEU/PRO/TRI/ACH) */
  private visionShort(vision: VisionTypeId): string {
    const shorts: Record<VisionTypeId, string> = {
      normal: 'NRM',
      deuteranopia: 'DEU',
      protanopia: 'PRO',
      tritanopia: 'TRI',
      achromatopsia: 'ACH',
    };
    return shorts[vision];
  }

  private capitalize(id: string): string {
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  // ============================================================================
  // Mobile Drawer Content
  // ============================================================================

  /**
   * Render full interactive configuration controls in the mobile drawer
   * Mirrors the left panel configuration but uses drawer-specific component instances
   */
  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    const drawer = this.options.drawerContent;
    clearContainer(drawer);

    // Destroy existing drawer components before re-rendering
    this.drawerDyeSelector?.destroy();
    this.drawerDyePanel?.destroy();
    this.drawerVisionPanel?.destroy();
    this.drawerDisplayPanel?.destroy();

    // Section 1: Dye Selection (Collapsible)
    const dyeContainer = this.createElement('div');
    drawer.appendChild(dyeContainer);
    this.renderDrawerDyePanel(dyeContainer);

    // Section 2: Vision Types (Collapsible)
    const visionContainer = this.createElement('div');
    drawer.appendChild(visionContainer);
    this.renderDrawerVisionPanel(visionContainer);

    // Section 3: Display Options (Collapsible)
    const displayContainer = this.createElement('div');
    drawer.appendChild(displayContainer);
    this.renderDrawerDisplayPanel(displayContainer);
  }

  /**
   * Render collapsible Dye Selection panel for mobile drawer
   */
  private renderDrawerDyePanel(container: HTMLElement): void {
    this.drawerDyePanel = new CollapsiblePanel(container, {
      title: LanguageService.t('accessibility.inspectDyes'),
      defaultOpen: true,
      storageKey: 'accessibility_dyes_drawer',
      icon: ICON_BEAKER,
    });
    this.drawerDyePanel.init();

    const contentContainer = this.drawerDyePanel.getContentContainer();
    if (contentContainer) {
      this.renderDrawerDyeSelector(contentContainer);
    }
  }

  /**
   * Render dye selector for mobile drawer
   */
  private renderDrawerDyeSelector(container: HTMLElement): void {
    const dyeContainer = this.createElement('div', { className: 'space-y-3' });

    // Current selection display
    const selectedDisplay = this.createElement('div', {
      className: 'drawer-selected-dyes-display space-y-2',
    });
    this.updateDrawerSelectedDyesDisplay(selectedDisplay);
    dyeContainer.appendChild(selectedDisplay);

    // Dye selector component
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

    // Pre-select persisted dyes if available
    if (this.selectedDyes.length > 0) {
      this.drawerDyeSelector.setSelectedDyes(this.selectedDyes);
    }

    // Listen for dye selection changes
    selectorContainer.addEventListener('selection-changed', () => {
      if (this.drawerDyeSelector) {
        this.selectedDyes = this.drawerDyeSelector.getSelectedDyes();
        // Save selected dye IDs to localStorage
        const dyeIds = this.selectedDyes.map((d) => d.id);
        StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);

        // Sync desktop selector if it exists
        this.dyeSelector?.setSelectedDyes(this.selectedDyes);

        // Update displays
        this.updateDrawerSelectedDyesDisplay(selectedDisplay);
        this.updateResults();
        logger.info(`[AccessibilityTool] Drawer: Selected ${this.selectedDyes.length} dyes`);
      }
    });

    container.appendChild(dyeContainer);
  }

  /**
   * Update the selected dyes display in mobile drawer
   */
  private updateDrawerSelectedDyesDisplay(container: HTMLElement): void {
    clearContainer(container);

    if (this.selectedDyes.length === 0) {
      const placeholder = this.createElement('div', {
        className: 'p-3 rounded-lg border-2 border-dashed text-center text-sm',
        textContent: LanguageService.t('accessibility.selectDyesToSeeAnalysis'),
        attributes: {
          style: 'border-color: var(--theme-border); color: var(--theme-text-muted);',
        },
      });
      container.appendChild(placeholder);
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
        textContent: LanguageService.t('common.remove'),
        attributes: {
          style: 'background: var(--theme-card-hover); color: var(--theme-text-muted);',
        },
      });

      this.on(removeBtn, 'click', () => {
        // Filter out this dye and update the selector
        const newSelection = this.selectedDyes.filter((d) => d.id !== dye.id);
        this.drawerDyeSelector?.setSelectedDyes(newSelection);
        this.dyeSelector?.setSelectedDyes(newSelection);
        this.selectedDyes = newSelection;
        // Save updated selection to localStorage
        const dyeIds = newSelection.map((d) => d.id);
        StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);
        this.updateDrawerSelectedDyesDisplay(container);
        this.updateResults();
      });

      dyeItem.appendChild(swatch);
      dyeItem.appendChild(name);
      dyeItem.appendChild(removeBtn);
      container.appendChild(dyeItem);
    }
  }

  /**
   * Render collapsible Vision Types panel for mobile drawer
   */
  private renderDrawerVisionPanel(container: HTMLElement): void {
    this.drawerVisionPanel = new CollapsiblePanel(container, {
      title: LanguageService.t('accessibility.visionTypes'),
      defaultOpen: true,
      storageKey: 'accessibility_vision_drawer',
      icon: ICON_EYE,
    });
    this.drawerVisionPanel.init();

    const contentContainer = this.drawerVisionPanel.getContentContainer();
    if (contentContainer) {
      this.renderDrawerVisionToggles(contentContainer);
    }
  }

  /**
   * Render vision type toggles for mobile drawer
   */
  private renderDrawerVisionToggles(container: HTMLElement): void {
    const togglesContainer = this.createElement('div', { className: 'space-y-2' });

    for (const type of VISION_TYPES) {
      const isEnabled = this.enabledVisionTypes.has(type.id);
      const label = this.createElement('label', {
        className: 'flex items-center gap-3 cursor-pointer',
      });

      const checkbox = this.createElement('input', {
        attributes: {
          type: 'checkbox',
          'data-vision-type': type.id,
        },
        className: 'w-4 h-4 rounded',
      }) as HTMLInputElement;
      checkbox.checked = isEnabled;

      this.on(checkbox, 'change', () => {
        if (checkbox.checked) {
          this.enabledVisionTypes.add(type.id);
        } else {
          this.enabledVisionTypes.delete(type.id);
        }
        StorageService.setItem(
          STORAGE_KEYS.enabledVisionTypes,
          Array.from(this.enabledVisionTypes)
        );

        // Sync desktop checkboxes
        this.syncDesktopVisionCheckboxes();

        this.updateResults();
      });

      const textContainer = this.createElement('div', { className: 'flex-1' });
      const typeName = this.createElement('p', {
        className: 'text-sm font-medium',
        textContent: LanguageService.getVisionType(type.localeKey),
        attributes: { style: 'color: var(--theme-text);' },
      });
      const typePrevalence = this.createElement('p', {
        className: 'text-xs',
        textContent: type.prevalence,
        attributes: { style: 'color: var(--theme-text-muted);' },
      });
      textContainer.appendChild(typeName);
      textContainer.appendChild(typePrevalence);

      label.appendChild(checkbox);
      label.appendChild(textContainer);
      togglesContainer.appendChild(label);
    }

    container.appendChild(togglesContainer);
  }

  /**
   * Render collapsible Display Options panel for mobile drawer
   */
  private renderDrawerDisplayPanel(container: HTMLElement): void {
    this.drawerDisplayPanel = new CollapsiblePanel(container, {
      title: LanguageService.t('accessibility.displayOptions'),
      defaultOpen: false,
      storageKey: 'accessibility_display_drawer',
      icon: ICON_SLIDERS,
    });
    this.drawerDisplayPanel.init();

    const contentContainer = this.drawerDisplayPanel.getContentContainer();
    if (contentContainer) {
      this.renderDrawerDisplayOptions(contentContainer);
    }
  }

  /**
   * Render display options for mobile drawer
   */
  private renderDrawerDisplayOptions(container: HTMLElement): void {
    const optionsContainer = this.createElement('div', { className: 'space-y-2' });

    const options = [
      { key: 'showLabels', label: LanguageService.t('accessibility.showLabels') },
      {
        key: 'showHexValues',
        label: LanguageService.t('accessibility.showHexValues'),
      },
      {
        key: 'highContrastMode',
        label: LanguageService.t('accessibility.highContrastMode'),
      },
    ] as const;

    for (const option of options) {
      const label = this.createElement('label', {
        className: 'flex items-center gap-2 cursor-pointer',
      });

      const checkbox = this.createElement('input', {
        attributes: {
          type: 'checkbox',
          'data-display-option': option.key,
        },
        className: 'w-4 h-4 rounded',
      }) as HTMLInputElement;
      checkbox.checked = this.displayOptions[option.key];

      this.on(checkbox, 'change', () => {
        this.displayOptions[option.key] = checkbox.checked;
        StorageService.setItem(STORAGE_KEYS.displayOptions, this.displayOptions);

        // Sync desktop checkboxes
        this.syncDesktopDisplayCheckboxes();

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
   * Sync desktop vision type checkboxes with current state
   */
  private syncDesktopVisionCheckboxes(): void {
    if (!this.visionTogglesContainer) return;
    const checkboxes =
      this.visionTogglesContainer.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      const visionType = checkbox.getAttribute('data-vision-type') as VisionTypeId;
      if (visionType) {
        checkbox.checked = this.enabledVisionTypes.has(visionType);
      }
    });
  }

  /**
   * Sync desktop display options checkboxes with current state
   */
  private syncDesktopDisplayCheckboxes(): void {
    if (!this.displayOptionsContainer) return;
    const checkboxes =
      this.displayOptionsContainer.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    checkboxes.forEach((checkbox) => {
      const optionKey = checkbox.getAttribute('data-display-option') as keyof DisplayOptions;
      if (optionKey) {
        checkbox.checked = this.displayOptions[optionKey];
      }
    });
  }

  /**
   * Update drawer content when desktop changes (sync drawer components)
   */
  private updateDrawerContent(): void {
    // Sync drawer dye selector with current state
    if (this.drawerDyeSelector) {
      this.drawerDyeSelector.setSelectedDyes(this.selectedDyes);
    }

    // Re-render drawer if components don't exist yet
    if (!this.drawerDyePanel && this.options.drawerContent) {
      this.renderDrawerContent();
    }
  }

  // ============================================================================
  // Analysis Logic (Ported from v2)
  // ============================================================================

  /**
   * Get WCAG level from contrast ratio
   */
  private getWCAGLevel(ratio: number): 'AAA' | 'AA' | 'Fail' {
    if (ratio >= 7) return 'AAA';
    if (ratio >= 4.5) return 'AA';
    return 'Fail';
  }

  /**
   * Analyze a single dye for accessibility
   */
  private analyzeDye(dye: Dye): DyeAccessibilityResult {
    const primaryHex = dye.hex;
    const lightBg = '#FFFFFF';
    const darkBg = '#000000';

    const contrastLight = ColorService.getContrastRatio(primaryHex, lightBg);
    const contrastDark = ColorService.getContrastRatio(primaryHex, darkBg);

    const warnings: string[] = [];

    // Simulate colorblindness for all 5 vision types
    const deuterColor = ColorService.simulateColorblindnessHex(primaryHex, 'deuteranopia');
    const protanColor = ColorService.simulateColorblindnessHex(primaryHex, 'protanopia');
    const tritanColor = ColorService.simulateColorblindnessHex(primaryHex, 'tritanopia');
    const achromColor = ColorService.simulateColorblindnessHex(primaryHex, 'achromatopsia');

    // Generate warnings
    if (deuterColor === protanColor) {
      warnings.push(LanguageService.t('accessibility.redGreenWarning'));
    }

    if (ColorService.getColorDistance(primaryHex, tritanColor) < 30) {
      warnings.push(LanguageService.t('accessibility.tritanopiaWarning'));
    }

    if (ColorService.getColorDistance(primaryHex, achromColor) < 30) {
      warnings.push(LanguageService.t('accessibility.achromatopsiaWarning'));
    }

    return {
      dyeId: dye.id,
      dyeName: LanguageService.getDyeName(dye.itemID) || dye.name,
      hex: primaryHex,
      contrastVsWhite: {
        ratio: Math.round(contrastLight * 100) / 100,
        wcagLevel: this.getWCAGLevel(contrastLight),
      },
      contrastVsBlack: {
        ratio: Math.round(contrastDark * 100) / 100,
        wcagLevel: this.getWCAGLevel(contrastDark),
      },
      warnings,
      colorblindnessSimulations: {
        normal: primaryHex,
        deuteranopia: deuterColor,
        protanopia: protanColor,
        tritanopia: tritanColor,
        achromatopsia: achromColor,
      },
    };
  }

  /**
   * Analyze distinguishability between two dyes
   */
  private analyzePair(dye1: Dye, dye2: Dye): DyePairResult {
    const contrastRatio = ColorService.getContrastRatio(dye1.hex, dye2.hex);
    const distance = ColorService.getColorDistance(dye1.hex, dye2.hex);
    const distinguishability = Math.round((distance / 441.67) * 100);

    // Calculate distinguishability under each vision type
    const normalDist = Math.round(
      (ColorService.getColorDistance(dye1.hex, dye2.hex) / 441.67) * 100
    );
    const deuterDist = Math.round(
      (ColorService.getColorDistance(
        ColorService.simulateColorblindnessHex(dye1.hex, 'deuteranopia'),
        ColorService.simulateColorblindnessHex(dye2.hex, 'deuteranopia')
      ) /
        441.67) *
        100
    );
    const protanDist = Math.round(
      (ColorService.getColorDistance(
        ColorService.simulateColorblindnessHex(dye1.hex, 'protanopia'),
        ColorService.simulateColorblindnessHex(dye2.hex, 'protanopia')
      ) /
        441.67) *
        100
    );
    const tritanDist = Math.round(
      (ColorService.getColorDistance(
        ColorService.simulateColorblindnessHex(dye1.hex, 'tritanopia'),
        ColorService.simulateColorblindnessHex(dye2.hex, 'tritanopia')
      ) /
        441.67) *
        100
    );

    const warnings: string[] = [];

    if (distinguishability < 20) {
      warnings.push(LanguageService.t('accessibility.verySimular'));
    } else if (distinguishability < 40) {
      warnings.push(LanguageService.t('accessibility.somewhatSimilar'));
    }

    // Colorblindness-specific warnings
    if (deuterDist < 20 && normalDist >= 20) {
      warnings.push(LanguageService.t('accessibility.hardForDeuteranopia'));
    }
    if (protanDist < 20 && normalDist >= 20) {
      warnings.push(LanguageService.t('accessibility.hardForProtanopia'));
    }
    if (tritanDist < 20 && normalDist >= 20) {
      warnings.push(LanguageService.t('accessibility.hardForTritanopia'));
    }

    return {
      dye1Id: dye1.id,
      dye1Name: LanguageService.getDyeName(dye1.itemID) || dye1.name,
      dye1Hex: dye1.hex,
      dye2Id: dye2.id,
      dye2Name: LanguageService.getDyeName(dye2.itemID) || dye2.name,
      dye2Hex: dye2.hex,
      contrastRatio: Math.round(contrastRatio * 100) / 100,
      wcagLevel: this.getWCAGLevel(contrastRatio),
      distinguishability,
      colorblindnessDistinguishability: {
        normal: normalDist,
        deuteranopia: deuterDist,
        protanopia: protanDist,
        tritanopia: tritanDist,
      },
      warnings,
    };
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

    // Use the vision type selected in the share dropdown
    return {
      dyes: this.selectedDyes.map((d) => d.stainID ?? 0),
      vision: this.shareVisionType,
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

    // Sync dropdown value with state
    if (this.shareVisionSelect && this.shareVisionSelect.value !== this.shareVisionType) {
      this.shareVisionSelect.value = this.shareVisionType;
    }
  }

  /**
   * Load tool state from share URL parameters
   * @returns true if state was loaded from URL, false otherwise
   */
  private loadFromShareUrl(): boolean {
    const parsed = ShareService.getShareParamsFromCurrentUrl();
    if (!parsed || parsed.tool !== 'accessibility') {
      return false;
    }

    const params = parsed.params;
    let hasChanges = false;

    // Load dyes by itemID
    if (params.dyes && Array.isArray(params.dyes) && params.dyes.length > 0) {
      const allDyes = dyeService.getAllDyes();
      const loadedDyes: Dye[] = [];

      for (const itemId of params.dyes) {
        if (typeof itemId === 'number') {
          const dye = ShareService.resolveSharedDye(itemId);
          if (dye && !loadedDyes.some((d) => d.id === dye.id)) {
            loadedDyes.push(dye);
            if (loadedDyes.length >= 4) break; // Max 4 dyes
          }
        }
      }

      if (loadedDyes.length > 0) {
        this.selectedDyes = loadedDyes;
        hasChanges = true;

        // Update DyeSelector UI
        if (this.dyeSelector) {
          this.dyeSelector.setSelectedDyes(loadedDyes);
        }

        // Save to localStorage
        const dyeIds = loadedDyes.map((d) => d.id);
        StorageService.setItem(STORAGE_KEYS.selectedDyes, dyeIds);

        logger.info(
          `[AccessibilityTool] Loaded ${loadedDyes.length} dyes from share URL: ${loadedDyes.map((d) => d.name).join(', ')}`
        );
      }
    }

    // Load vision type if specified
    if (params.vision && typeof params.vision === 'string') {
      const validVisionTypes: VisionTypeId[] = [
        'normal',
        'deuteranopia',
        'protanopia',
        'tritanopia',
        'achromatopsia',
      ];
      if (validVisionTypes.includes(params.vision as VisionTypeId)) {
        // Add this vision type to enabled types
        this.enabledVisionTypes.add(params.vision as VisionTypeId);
        StorageService.setItem(
          STORAGE_KEYS.enabledVisionTypes,
          Array.from(this.enabledVisionTypes)
        );
        hasChanges = true;
        logger.info(`[AccessibilityTool] Loaded vision type from share URL: ${params.vision}`);
      }
    }

    if (hasChanges) {
      this.updateShareButton();
    }

    return hasChanges;
  }
}
