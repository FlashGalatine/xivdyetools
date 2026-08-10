/**
 * XIV Dye Tools 5.0 — Budget tool (9C Ledger).
 *
 * "Jet Black costs 178,400 gil. Soot Black costs 216 and is 5.2 away."
 * One row per candidate, tier groups carrying the single Patch 7.5 price,
 * and a gil-per-ΔE-point column. Spec: docs/research/monorepo-2.0/9c-ledger-port-spec.md
 *
 * Pricing rules (replaces the shipped getBudgetComparablePrice defect):
 * - Coffer (X) dyes have NO vendor gil at all — gil figure only from the board.
 * - Spectrum A: vendor 216 gil (local, always known) + board price of item 52254.
 * - Spectrum B/C: scrip/credit cost is local and shown; the board price of
 *   52255/52256 is the only gil figure. Currencies are never converted.
 *
 * Tool content renders inside v4-layout-shell's shadow DOM — inline styles only.
 *
 * @module components/tools/budget-tool
 */

import {
  normalizeMatchingMethod,
  BAND_VOCABULARY,
  classifyBandTier,
  roundToBandDisplay,
  CONSOLIDATED_DYES,
  getConsolidatedDyeName,
  type ConsolidationType,
} from '@xivdyetools/core';
import { ShareService } from '@services/share-service';
import { CollectionService } from '@services/collection-service';
import { BaseComponent } from '@components/base-component';
import '@components/v4/result-card';
import type { ResultCard, ResultCardData, ContextAction } from '@components/v4/result-card';
import '@components/v4/share-button';
import type { ShareButton } from '@components/v4/share-button';
import {
  ColorService,
  ConfigController,
  dyeService,
  LanguageService,
  MarketBoardService,
  StorageService,
  ToastService,
  applyDisplayOptions,
} from '@services/index';
import type { DisplayOptionsConfig, DyeFiltersConfig } from '@shared/tool-config-types';
import { RouterService } from '@services/router-service';
import { ThemeService } from '@services/theme-service';
import { ICON_TOOL_BUDGET } from '@shared/tool-icons';
import { logger } from '@shared/logger';
import { clearContainer } from '@shared/utils';
import type { Dye, DyeId, PriceData } from '@xivdyetools/types';
import type { BudgetConfig, MatchingMethod } from '@shared/tool-config-types';
import { DEFAULT_DYE_FILTERS } from '@shared/tool-config-types';
import { filterDyes } from '@shared/dye-filter-utils';
import { methodShort } from '@components/metric-help';

// ============================================================================
// Types and Constants
// ============================================================================

export interface BudgetToolOptions {
  leftPanel: HTMLElement;
  rightPanel: HTMLElement;
  drawerContent?: HTMLElement | null;
}

/** Price tier of a dye under Patch 7.5 consolidation. */
type TierKey = ConsolidationType | 'X';

/** What a dye costs, in the 9C vocabulary. Currencies are never converted. */
interface DyePrice {
  tier: TierKey;
  /** Comparable gil figure: A = 216 vendor; B/C/X = board price or null. */
  gil: number | null;
  /** Board (market) gil price, null when unknown/offline. */
  board: number | null;
  /** Local non-market cost line ("216 gil", "100 Skybuilders' Scrips"), null for X. */
  localCost: string | null;
}

/** One ledger row: a candidate within the match line. */
interface LedgerRow {
  dye: Dye;
  /** Distance in the active method's unit, display-rounded. */
  de: number;
  price: DyePrice;
  /** (targetGil − rowGil) / rowΔE — null when either gil is unknown or method ≠ ΔE2000. */
  perPoint: number | null;
}

type SortCol = 'perPoint' | 'de' | 'name' | 'board';

const STORAGE_KEYS = {
  targetDyeId: 'v3_budget_target',
  matchLine: 'v5_budget_match_line',
  matchingMethod: 'v3_budget_matching_method',
  sortCol: 'v5_budget_sort_col',
  sortDir: 'v5_budget_sort_dir',
  showHex: 'v3_budget_show_hex',
  showRgb: 'v3_budget_show_rgb',
  showHsv: 'v3_budget_show_hsv',
  showLab: 'v3_budget_show_lab',
  showCmyk: 'v3_budget_show_cmyk',
  showPrice: 'v3_budget_show_price',
  showDeltaE: 'v3_budget_show_delta_e',
  showAcquisition: 'v3_budget_show_acquisition',
} as const;

const MATCH_LINE_MIN = 2;
const MATCH_LINE_MAX = 20;
const DEFAULT_MATCH_LINE = 8;

/** Standard Spectrum leads (user decision 2026-08-08), then ascending price. */
const TIER_ORDER: readonly TierKey[] = ['A', 'B', 'C', 'X'];
/** Upgrade mode drops the target's own (A) tier. */
const UPGRADE_ORDER: readonly TierKey[] = ['B', 'C', 'X'];

/** Mono tier tags are identifiers, never localized. rampIndex maps into the tier color ramps. */
const TIER_META: Record<TierKey, { tag: string; rampIndex: number }> = {
  A: { tag: 'STANDARD', rampIndex: 0 },
  B: { tag: 'WIDE #1', rampIndex: 1 },
  C: { tag: 'WIDE #2', rampIndex: 2 },
  X: { tag: 'COFFER', rampIndex: 3 },
};

/** Same ramps as 7C Duel — shared 5.0 tier colors. */
const TIER_RAMP_DARK = ['#5bbd68', '#8bc34a', '#ffc107', '#f4645a'] as const;
const TIER_RAMP_LIGHT = ['#137A33', '#1C7D3A', '#B45309', '#B91C1C'] as const;

const MONO = "'Fragment Mono', monospace";

// ============================================================================
// BudgetTool Component
// ============================================================================

/**
 * Budget tool — the 9C Ledger. Prices what a target dye's colour is worth,
 * line by line, against everything within the match line.
 */
export class BudgetTool extends BaseComponent {
  private options: BudgetToolOptions;

  // State
  private targetDye: Dye | null = null;
  private matchLine: number;
  private matchingMethod: MatchingMethod;
  private sortCol: SortCol;
  private sortDir: 1 | -1;
  private rows: LedgerRow[] = [];
  private priceData: Map<number, PriceData> = new Map();
  /** Whether the last price fetch returned anything (offline detection). */
  private marketOnline: boolean = true;
  private isLoading: boolean = false;
  private fetchProgress: { current: number; total: number } = { current: 0, total: 0 };

  // Display options (target Result Card)
  private showHex: boolean = true;
  private showRgb: boolean = false;
  private showHsv: boolean = false;
  private showLab: boolean = false;
  private showCmyk: boolean = false;
  private showPrice: boolean = true;
  private showDeltaE: boolean = true;
  private showAcquisition: boolean = true;
  // 5.0 card rows — no budget-local storage key; ConfigController replays them
  private showHue: boolean = true;
  private showStain: boolean = true;
  private showSpectrum: boolean = true;

  // Child components
  private dyeFiltersConfig: DyeFiltersConfig = { ...DEFAULT_DYE_FILTERS };
  private marketBoardService: MarketBoardService;

  // DOM References
  private targetDyeContainer: HTMLElement | null = null;
  private matchLineValueDisplay: HTMLElement | null = null;
  private quickPicksContent: HTMLElement | null = null;
  private emptyStateContainer: HTMLElement | null = null;
  private targetOverviewContainer: HTMLElement | null = null;
  private verdictContainer: HTMLElement | null = null;
  private ledgerContainer: HTMLElement | null = null;
  private shareButton: ShareButton | null = null;
  private narrowMql: MediaQueryList | null = null;
  private onNarrowChange = (): void => {
    this.renderLedger();
  };

  // Mobile drawer components
  private mobileTargetDyeContainer: HTMLElement | null = null;
  private mobileMatchLineValueDisplay: HTMLElement | null = null;
  private mobileQuickPicksContent: HTMLElement | null = null;

  constructor(container: HTMLElement, options: BudgetToolOptions) {
    super(container);
    this.options = options;

    this.marketBoardService = MarketBoardService.getInstance();

    const storedLine = StorageService.getItem<number>(STORAGE_KEYS.matchLine);
    this.matchLine = this.clampMatchLine(storedLine);
    this.matchingMethod = normalizeMatchingMethod(
      StorageService.getItem<string>(STORAGE_KEYS.matchingMethod)
    );
    const storedCol = StorageService.getItem<string>(STORAGE_KEYS.sortCol);
    this.sortCol =
      storedCol === 'de' ||
      storedCol === 'name' ||
      storedCol === 'board' ||
      storedCol === 'perPoint'
        ? storedCol
        : 'perPoint';
    this.sortDir = StorageService.getItem<number>(STORAGE_KEYS.sortDir) === -1 ? -1 : 1;

    this.showHex = StorageService.getItem<boolean>(STORAGE_KEYS.showHex) ?? true;
    this.showRgb = StorageService.getItem<boolean>(STORAGE_KEYS.showRgb) ?? false;
    this.showHsv = StorageService.getItem<boolean>(STORAGE_KEYS.showHsv) ?? false;
    this.showLab = StorageService.getItem<boolean>(STORAGE_KEYS.showLab) ?? false;
    this.showCmyk = StorageService.getItem<boolean>(STORAGE_KEYS.showCmyk) ?? false;
    this.showPrice = StorageService.getItem<boolean>(STORAGE_KEYS.showPrice) ?? true;
    this.showDeltaE = StorageService.getItem<boolean>(STORAGE_KEYS.showDeltaE) ?? true;
    this.showAcquisition = StorageService.getItem<boolean>(STORAGE_KEYS.showAcquisition) ?? true;

    const savedDyeId = StorageService.getItem<number>(STORAGE_KEYS.targetDyeId);
    if (savedDyeId) {
      this.targetDye = dyeService.getDyeById(savedDyeId) || null;
    }
  }

  /** Legacy v3 distance values (25–100) are out of the 2–20 line range → default. */
  private clampMatchLine(value: number | null | undefined): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_MATCH_LINE;
    if (value < MATCH_LINE_MIN || value > MATCH_LINE_MAX) return DEFAULT_MATCH_LINE;
    return Math.round(value);
  }

  // ============================================================================
  // Lifecycle Methods
  // ============================================================================

  renderContent(): void {
    // In the v4 shell leftPanel and rightPanel are the SAME element — the tool
    // renders one flow: controls (target, quick picks, match line, market)
    // above the verdict + ledger.
    this.renderMain();

    if (this.options.drawerContent) {
      this.renderDrawerContent();
    }

    this.element = this.container;
  }

  bindEvents(): void {
    // Event bindings handled in child components
  }

  onMount(): void {
    this.subs.add(
      LanguageService.subscribe(() => {
        this.update();
      })
    );

    this.subs.add(
      ConfigController.getInstance().subscribe('budget', (config) => {
        this.setConfig(config);
      })
    );

    // Server/showPrices changes come from the sidebar's Market Board section.
    // Defer the refetch a tick so MarketBoardService applies the change first.
    this.subs.add(
      ConfigController.getInstance().subscribe('market', () => {
        setTimeout(() => void this.findAlternatives(), 0);
      })
    );

    // Prices are core to this tool
    this.marketBoardService.setShowPrices(true);

    // Re-render the ledger across the narrow breakpoint (BOARD column drop)
    this.narrowMql = window.matchMedia('(max-width: 480px)');
    this.narrowMql.addEventListener('change', this.onNarrowChange);

    logger.info('[BudgetTool] Mounted');

    this.handleDeepLink();

    // Quick picks are generated from the board; the fetch also primes target pricing.
    void this.findAlternatives();
  }

  destroy(): void {
    this.targetDye = null;
    this.rows = [];
    this.priceData.clear();
    this.narrowMql?.removeEventListener('change', this.onNarrowChange);
    this.narrowMql = null;

    super.destroy();
    logger.info('[BudgetTool] Destroyed');
  }

  // ============================================================================
  // V4 Integration
  // ============================================================================

  /**
   * Update tool configuration from external source (V4 ConfigSidebar)
   */
  public setConfig(config: Partial<BudgetConfig>): void {
    let needsRefind = false;

    // maxDeltaE carries the match line (2–20); out-of-range legacy values reset
    if (config.maxDeltaE !== undefined) {
      const line = this.clampMatchLine(config.maxDeltaE);
      if (line !== this.matchLine) {
        this.matchLine = line;
        StorageService.setItem(STORAGE_KEYS.matchLine, line);
        needsRefind = true;
        logger.info(`[BudgetTool] setConfig: matchLine -> ${line}`);
        if (this.matchLineValueDisplay) {
          this.matchLineValueDisplay.textContent = String(line);
        }
        if (this.mobileMatchLineValueDisplay) {
          this.mobileMatchLineValueDisplay.textContent = String(line);
        }
      }
    }

    if (config.matchingMethod !== undefined && config.matchingMethod !== this.matchingMethod) {
      this.matchingMethod = config.matchingMethod;
      StorageService.setItem(STORAGE_KEYS.matchingMethod, config.matchingMethod);
      needsRefind = true;
      logger.info(`[BudgetTool] setConfig: matchingMethod -> ${config.matchingMethod}`);
      // The line is only calibrated against ΔE2000 — other methods pin to their
      // MATCH middle cut, so the slider section needs a rerender.
      this.renderMain();
      if (this.options.drawerContent) this.renderDrawerContent();
    }

    let needsRerender = false;
    if (config.displayOptions) {
      const currentOptions: DisplayOptionsConfig = {
        showHex: this.showHex,
        showRgb: this.showRgb,
        showHsv: this.showHsv,
        showLab: this.showLab,
        showCmyk: this.showCmyk,
        showPrice: this.showPrice,
        showDeltaE: this.showDeltaE,
        showAcquisition: this.showAcquisition,
        showHue: this.showHue,
        showStain: this.showStain,
        showSpectrum: this.showSpectrum,
      };

      const result = applyDisplayOptions({
        current: currentOptions,
        incoming: config.displayOptions,
        toolName: 'BudgetTool',
        onChange: (key, value) => {
          // 5.0 fields (showHue/showStain/showSpectrum) have no budget-local
          // storage key — they ride the card defaults.
          const storageKey = (STORAGE_KEYS as Partial<Record<typeof key, string>>)[key];
          if (storageKey) StorageService.setItem(storageKey, value);
        },
      });

      if (result.hasChanges) {
        this.showHex = result.options.showHex;
        this.showRgb = result.options.showRgb;
        this.showHsv = result.options.showHsv;
        this.showLab = result.options.showLab;
        this.showCmyk = result.options.showCmyk;
        this.showPrice = result.options.showPrice;
        this.showDeltaE = result.options.showDeltaE;
        this.showAcquisition = result.options.showAcquisition;
        this.showHue = result.options.showHue ?? true;
        this.showStain = result.options.showStain ?? true;
        this.showSpectrum = result.options.showSpectrum ?? true;
        needsRerender = true;
      }
    }

    if (config.dyeFilters) {
      const newFilters = { ...this.dyeFiltersConfig, ...config.dyeFilters };
      const filtersChanged = JSON.stringify(newFilters) !== JSON.stringify(this.dyeFiltersConfig);
      if (filtersChanged) {
        this.dyeFiltersConfig = newFilters;
        needsRefind = true;
        logger.info('[BudgetTool] setConfig: dyeFilters updated');
      }
    }

    if (needsRefind) {
      void this.findAlternatives();
    }

    if (needsRerender && this.targetDye) {
      this.renderTargetOverview();
    }
  }

  // ============================================================================
  // Deep Linking Support
  // ============================================================================

  private handleDeepLink(): void {
    const params = new URLSearchParams(window.location.search);
    const dyeParam = params.get('dye');
    const hexParam = params.get('hex');
    const maxDeltaParam = params.get('maxDelta');

    if (dyeParam) {
      // 5.0 grammar: ?dye= is a stainID
      const dye = ShareService.resolveSharedDye(dyeParam);
      if (dye) {
        this.targetDye = dye;
        this.updateTargetDyeDisplay();
        StorageService.setItem(STORAGE_KEYS.targetDyeId, dye.id);
      }
    } else if (hexParam && /^#?[0-9a-fA-F]{6}$/.test(hexParam)) {
      // ?hex= is a bare colour target — exclusive with `dye`, never persisted
      this.targetDye = this.virtualTargetFor(`#${hexParam.replace(/^#/, '')}`);
      this.updateTargetDyeDisplay();
    }

    if (maxDeltaParam !== null) {
      const n = Number(maxDeltaParam);
      if (Number.isFinite(n)) {
        this.matchLine = this.clampMatchLine(n);
        StorageService.setItem(STORAGE_KEYS.matchLine, this.matchLine);
      }
    }
  }

  // ============================================================================
  // Pricing engine (9C rules)
  // ============================================================================

  private tierOf(dye: Dye): TierKey {
    return dye.consolidationType ?? 'X';
  }

  /**
   * What a dye costs. The board price is read via the dye's own itemID —
   * MarketBoardService fans consolidated prices out to each member dye, so
   * A/B/C dyes carry their consolidated item's board price and X (coffer)
   * dyes carry their own listing.
   */
  private priceOf(dye: Dye): DyePrice {
    const tier = this.tierOf(dye);
    const raw = this.priceData.get(dye.itemID)?.currentMinPrice;
    const board = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : null;

    if (tier === 'X') {
      // Coffer dyes have no vendor price at all — never read dye.cost as gil.
      return { tier, gil: board, board, localCost: null };
    }

    const meta = CONSOLIDATED_DYES[tier];
    const localCost = `${meta.price.toLocaleString()} ${LanguageService.getCurrency(meta.currency)}`;
    if (tier === 'A') {
      // Vendor gil is deterministic and always known.
      return { tier, gil: meta.price, board, localCost };
    }
    // B/C: scrips/credits are never converted — board is the only gil figure.
    return { tier, gil: board, board, localCost };
  }

  /** The line: user slider for ΔE2000; other methods pin to their calibrated MATCH middle cut. */
  private effectiveThreshold(): number {
    if (this.matchingMethod === 'ciede2000') return this.matchLine;
    return BAND_VOCABULARY.match[this.matchingMethod].cuts[1];
  }

  /** Upgrade mode: the target already sits at the 216-gil floor. */
  private isUpgradeMode(): boolean {
    return this.targetDye?.consolidationType === 'A';
  }

  private fmtValue(value: number): string {
    return String(roundToBandDisplay(value, this.matchingMethod));
  }

  private tierRamp(): readonly string[] {
    return ThemeService.isDarkMode() ? TIER_RAMP_DARK : TIER_RAMP_LIGHT;
  }

  private tint(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private accent(): string {
    return ThemeService.isDarkMode() ? '#EA4133' : '#CE2222';
  }

  private dyeName(dye: Dye): string {
    return LanguageService.getDyeName(dye.itemID) || dye.name;
  }

  private tierName(tier: TierKey): string {
    if (tier === 'X') return LanguageService.getAcquisition('Venture Coffers');
    return getConsolidatedDyeName(tier, LanguageService.getCurrentLocale());
  }

  /** The 20 market-only dyes (no consolidation bucket). */
  private cofferDyes(): Dye[] {
    return dyeService.getAllDyes().filter((d) => !d.consolidationType && d.itemID > 0);
  }

  private tierPoolSize(tier: TierKey): number {
    return dyeService.getAllDyes().filter((d) => d.itemID > 0 && this.tierOf(d) === tier).length;
  }

  // ============================================================================
  // Core Business Logic
  // ============================================================================

  /**
   * Build the ledger: candidates within the match line, priced by tier.
   * Always fetches coffer prices too (quick picks are generated from the board).
   */
  private async findAlternatives(): Promise<void> {
    const target = this.targetDye;
    const threshold = this.effectiveThreshold();

    this.isLoading = true;
    if (target) {
      this.showEmptyState(false);
      this.renderLedger();
    }

    try {
      const allDyes = dyeService.getAllDyes().filter((d) => d.itemID > 0);
      let candidates: Dye[] = [];
      if (target) {
        candidates = allDyes.filter((d) => {
          if (d.id === target.id) return false;
          const de = roundToBandDisplay(
            ColorService.getDistanceForMethod(target.hex, d.hex, this.matchingMethod),
            this.matchingMethod
          );
          return de <= threshold;
        });
        candidates = filterDyes(this.dyeFiltersConfig, candidates);
      }

      // One fetch covers the target, every candidate, and the coffer set for
      // quick picks — MarketBoardService dedupes consolidated IDs internally.
      const toFetch = new Map<number, Dye>();
      if (target) toFetch.set(target.id, target);
      for (const d of candidates) toFetch.set(d.id, d);
      for (const d of this.cofferDyes()) toFetch.set(d.id, d);
      await this.fetchPrices(Array.from(toFetch.values()));

      if (target) {
        const targetGil = this.priceOf(target).gil;
        const upgrade = this.isUpgradeMode();
        this.rows = candidates
          .map((dye) => {
            const de = roundToBandDisplay(
              ColorService.getDistanceForMethod(target.hex, dye.hex, this.matchingMethod),
              this.matchingMethod
            );
            const price = this.priceOf(dye);
            const perPoint =
              this.matchingMethod === 'ciede2000' && targetGil != null && price.gil != null
                ? (targetGil - price.gil) / Math.max(de, 0.1)
                : null;
            return { dye, de, price, perPoint };
          })
          .filter((row) => !upgrade || row.price.gil == null || row.price.gil > (targetGil ?? 0));
      } else {
        this.rows = [];
      }

      this.isLoading = false;
      this.renderVerdict();
      this.renderLedger();
    } catch (error) {
      logger.error('[BudgetTool] Error building ledger:', error);
      ToastService.error(LanguageService.t('budget.errorFindingAlternatives'));
      this.isLoading = false;
      this.renderLedger();
    } finally {
      this.renderTargetOverview();
      this.updateTargetDyeDisplay();
      this.updateMobileTargetDyeDisplay();
      this.renderQuickPicks();
      if (!this.targetDye) this.showEmptyState(true);
    }
  }

  /**
   * Fetch prices for dyes with progress tracking. Sets marketOnline from the
   * response — an empty map after a non-empty request means Universalis is out.
   */
  private async fetchPrices(dyes: Dye[]): Promise<void> {
    this.fetchProgress = { current: 0, total: dyes.length };
    this.renderLedger();

    try {
      const prices = await this.marketBoardService.fetchPricesForDyes(dyes, (current, total) => {
        this.fetchProgress = { current, total };
        this.renderLedger();
      });
      prices.forEach((data, itemId) => {
        this.priceData.set(itemId, data);
      });
      this.marketOnline = prices.size > 0;
    } catch (error) {
      logger.warn('[BudgetTool] Error fetching prices:', error);
      this.marketOnline = false;
    }
  }

  /** Sort rows within a tier group by the active column. Unknown gil sorts last. */
  private sortRows(rows: LedgerRow[]): LedgerRow[] {
    const dir = this.sortDir;
    return rows.slice().sort((a, b) => {
      switch (this.sortCol) {
        case 'de':
          return (a.de - b.de) * dir;
        case 'name':
          return this.dyeName(a.dye).localeCompare(this.dyeName(b.dye)) * dir;
        case 'board': {
          const ab = a.price.board ?? Infinity;
          const bb = b.price.board ?? Infinity;
          if (ab !== bb) return (ab - bb) * dir;
          return a.de - b.de;
        }
        case 'perPoint':
        default: {
          // Best value first; empty cells sort last; fallback = distance.
          const ap = a.perPoint ?? -Infinity;
          const bp = b.perPoint ?? -Infinity;
          if (ap !== bp) return (bp - ap) * dir;
          return a.de - b.de;
        }
      }
    });
  }

  // ============================================================================
  // Main Flow Rendering
  // ============================================================================

  private renderMain(): void {
    const main = this.options.rightPanel;
    clearContainer(main);
    if (this.options.leftPanel !== this.options.rightPanel) {
      clearContainer(this.options.leftPanel);
    }

    const wrapper = this.createElement('div', {
      attributes: {
        style: 'max-width: 900px; margin: 0 auto; width: 100%;',
      },
    });
    main.appendChild(wrapper);

    const controls = this.createElement('div', {
      attributes: { style: 'margin-bottom: 20px;' },
    });
    wrapper.appendChild(controls);
    this.renderControls(controls);
    this.renderResultsContainers(wrapper);
  }

  /**
   * Plain stacked sections — the legacy CollapsiblePanel/MarketBoard/DyeSelector
   * chrome is Tailwind-dependent and breaks inside the shell's shadow DOM.
   * Server selection lives in the config sidebar's Market Board section.
   */
  private renderControls(left: HTMLElement): void {
    left.setAttribute(
      'style',
      'margin-bottom: 20px; display: flex; flex-direction: column; gap: 16px;'
    );

    // Section 1: Target Dye
    const targetSection = this.createElement('div');
    targetSection.appendChild(this.sectionLabel(LanguageService.t('budget.targetDye')));
    this.renderTargetDyeSection(targetSection, false);
    left.appendChild(targetSection);

    // Section 2: Quick Picks (generated from the board; carries its own label)
    this.quickPicksContent = this.createElement('div');
    this.renderQuickPicksInto(this.quickPicksContent);
    left.appendChild(this.quickPicksContent);

    // Section 3: Match line
    const lineSection = this.createElement('div', {
      attributes: {
        style:
          'padding: 12px 14px; border: 1px solid var(--theme-border); border-radius: 10px; background: var(--theme-card-background);',
      },
    });
    this.renderMatchLineSection(lineSection, false);
    left.appendChild(lineSection);
  }

  private sectionLabel(text: string): HTMLElement {
    return this.createElement('div', {
      textContent: text,
      attributes: {
        style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; text-transform: uppercase; color: var(--theme-text-muted); margin-bottom: 8px;`,
      },
    });
  }

  /**
   * Target dye display. Picking happens through the quick picks, ledger row
   * clicks, deep links, and the Color Palette drawer (which calls selectDye) —
   * the legacy DyeSelector is Tailwind-dependent and unusable in the shadow DOM.
   */
  private renderTargetDyeSection(container: HTMLElement, mobile: boolean): void {
    const display = this.createElement('div');
    if (mobile) {
      this.mobileTargetDyeContainer = display;
      this.updateMobileTargetDyeDisplay();
    } else {
      this.targetDyeContainer = display;
      this.updateTargetDyeDisplay();
    }
    container.appendChild(display);
  }

  private buildTargetDyeCard(): HTMLElement {
    const target = this.targetDye;
    if (!target) {
      return this.createElement('div', {
        textContent: LanguageService.t('budget.selectTargetDye'),
        attributes: {
          style:
            'padding: 16px; border-radius: 8px; border: 2px dashed var(--theme-border); text-align: center; color: var(--theme-text-muted);',
        },
      });
    }

    const isLight = this.isLightColor(target.hex);
    const textColor = isLight ? '#1A1A1A' : '#FFFFFF';
    const textShadow = isLight
      ? '0 1px 2px rgba(255, 255, 255, 0.3)'
      : '0 1px 2px rgba(0, 0, 0, 0.3)';

    const card = this.createElement('div', {
      attributes: {
        style: `padding: 16px; border-radius: 8px; background: ${target.hex}; border: 1px solid var(--theme-border);`,
      },
    });

    card.appendChild(
      this.createElement('p', {
        textContent: this.dyeName(target),
        attributes: {
          style: `font-weight: 600; font-size: 17px; margin: 0 0 4px; color: ${textColor} !important; text-shadow: ${textShadow};`,
        },
      })
    );
    card.appendChild(
      this.createElement('p', {
        textContent: target.hex,
        attributes: {
          style: `font-family: ${MONO}; font-size: 12px; margin: 0 0 8px; color: ${textColor} !important; opacity: 0.8; text-shadow: ${textShadow};`,
        },
      })
    );

    const price = this.priceOf(target);
    let priceText: string;
    if (price.board != null) {
      priceText = `~${price.board.toLocaleString()} gil`;
    } else if (price.localCost != null) {
      priceText = price.localCost;
    } else if (this.isLoading) {
      priceText = LanguageService.t('budget.loadingPrice');
    } else {
      priceText = '—';
    }
    card.appendChild(
      this.createElement('p', {
        textContent: priceText,
        attributes: {
          style: `font-family: ${MONO}; font-size: 13px; font-weight: 500; margin: 0; color: ${textColor} !important; text-shadow: ${textShadow};`,
        },
      })
    );

    return card;
  }

  private updateTargetDyeDisplay(): void {
    if (!this.targetDyeContainer) return;
    clearContainer(this.targetDyeContainer);
    this.targetDyeContainer.appendChild(this.buildTargetDyeCard());
  }

  private updateMobileTargetDyeDisplay(): void {
    if (!this.mobileTargetDyeContainer) return;
    clearContainer(this.mobileTargetDyeContainer);
    this.mobileTargetDyeContainer.appendChild(this.buildTargetDyeCard());
  }

  /**
   * Quick picks — GENERATED from the board, not hardcoded. Online: the
   * priciest coffer dyes on the selected world right now. Offline: the
   * market-only dyes, unpriced.
   */
  private renderQuickPicksInto(container: HTMLElement): void {
    clearContainer(container);

    const coffers = this.cofferDyes();
    const priced = coffers
      .map((dye) => ({ dye, board: this.priceOf(dye).board }))
      .filter((entry) => entry.board != null)
      .sort((a, b) => b.board! - a.board!);
    const online = priced.length > 0;

    const world = this.marketBoardService.getWorldNameForPrice(undefined) ?? '—';
    const label = this.createElement('div', {
      textContent: online
        ? LanguageService.tInterpolate('budget.priciestNow', { world })
        : LanguageService.t('budget.priciestOff'),
      attributes: {
        style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-bottom: 8px;`,
      },
    });
    container.appendChild(label);

    const picks = online
      ? priced.slice(0, 6)
      : coffers.slice(0, 6).map((dye) => ({ dye, board: null as number | null }));

    const grid = this.createElement('div', {
      attributes: {
        style: 'display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;',
      },
    });

    picks.forEach(({ dye, board }) => {
      const isSelected = this.targetDye?.id === dye.id;
      const btn = this.createElement('button', {
        attributes: {
          type: 'button',
          title: this.dyeName(dye),
          style: `display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; border: none; cursor: pointer; background: ${
            isSelected ? 'var(--theme-primary)' : 'var(--theme-card-background)'
          }; color: ${isSelected ? 'var(--theme-text-header)' : 'var(--theme-text)'};`,
        },
      }) as HTMLButtonElement;

      btn.appendChild(
        this.createElement('div', {
          attributes: {
            style: `width: 24px; height: 24px; border-radius: 6px; background: ${dye.hex}; border: 1px solid var(--theme-border);`,
          },
        })
      );
      btn.appendChild(
        this.createElement('span', {
          textContent: this.dyeName(dye).split(' ')[0],
          attributes: {
            style:
              'font-size: 11px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          },
        })
      );
      btn.appendChild(
        this.createElement('span', {
          textContent: board != null ? board.toLocaleString() : '—',
          attributes: {
            style: `font-family: ${MONO}; font-size: 9.5px; opacity: 0.75;`,
          },
        })
      );

      this.on(btn, 'click', () => {
        this.selectDye(dye);
      });

      grid.appendChild(btn);
    });

    container.appendChild(grid);
  }

  /** Re-render both quick-pick grids (called when prices arrive). */
  private renderQuickPicks(): void {
    if (this.quickPicksContent) this.renderQuickPicksInto(this.quickPicksContent);
    if (this.mobileQuickPicksContent) this.renderQuickPicksInto(this.mobileQuickPicksContent);
  }

  /**
   * Match line slider (2–20). Only ΔE2000 is calibrated against the slider;
   * every other method pins the line to its calibrated MATCH middle cut.
   */
  private renderMatchLineSection(container: HTMLElement, mobile: boolean): void {
    const isDe2000 = this.matchingMethod === 'ciede2000';
    const threshold = this.effectiveThreshold();

    const valueDisplay = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;',
      },
    });

    valueDisplay.appendChild(
      this.createElement('span', {
        textContent: methodShort(this.matchingMethod),
        attributes: {
          style: `font-family: ${MONO}; font-size: 11px; letter-spacing: 0.5px; color: var(--theme-text-muted);`,
        },
      })
    );

    const valueSpan = this.createElement('span', {
      textContent: isDe2000 ? String(this.matchLine) : `≤ ${this.fmtValue(threshold)}`,
      attributes: {
        style: `font-family: ${MONO}; font-weight: 600; color: var(--theme-text);`,
      },
    });
    if (mobile) {
      this.mobileMatchLineValueDisplay = valueSpan;
    } else {
      this.matchLineValueDisplay = valueSpan;
    }
    valueDisplay.appendChild(valueSpan);
    container.appendChild(valueDisplay);

    container.appendChild(
      this.createElement('p', {
        textContent: LanguageService.t('budget.matchLineDesc'),
        attributes: {
          style: 'font-size: 11px; margin: 0 0 12px; color: var(--theme-text-muted);',
        },
      })
    );

    const slider = this.createElement('input', {
      attributes: {
        type: 'range',
        min: String(MATCH_LINE_MIN),
        max: String(MATCH_LINE_MAX),
        value: String(this.matchLine),
        step: '1',
        style: `width: 100%; accent-color: var(--theme-primary);${isDe2000 ? '' : ' opacity: 0.4;'}`,
        ...(isDe2000 ? {} : { disabled: '' }),
      },
    }) as HTMLInputElement;

    this.on(slider, 'input', () => {
      this.matchLine = parseInt(slider.value, 10);
      const text = String(this.matchLine);
      if (this.matchLineValueDisplay) this.matchLineValueDisplay.textContent = text;
      if (this.mobileMatchLineValueDisplay) this.mobileMatchLineValueDisplay.textContent = text;
      StorageService.setItem(STORAGE_KEYS.matchLine, this.matchLine);
      void this.findAlternatives();
    });

    container.appendChild(slider);

    const ticksContainer = this.createElement('div', {
      attributes: {
        style: 'display: flex; justify-content: space-between; margin-top: 4px;',
      },
    });
    ['2', '8', '14', '20'].forEach((tick) => {
      ticksContainer.appendChild(
        this.createElement('span', {
          textContent: tick,
          attributes: {
            style: `font-family: ${MONO}; font-size: 10px; color: var(--theme-text-muted);`,
          },
        })
      );
    });
    container.appendChild(ticksContainer);
  }

  // ============================================================================
  // Results Rendering
  // ============================================================================

  private renderResultsContainers(wrapper: HTMLElement): void {
    const hasTargetDye = this.targetDye !== null;

    this.emptyStateContainer = this.createElement('div', {
      attributes: { style: hasTargetDye ? 'display: none;' : '' },
    });
    this.renderEmptyState();
    wrapper.appendChild(this.emptyStateContainer);

    this.targetOverviewContainer = this.createElement('div', {
      attributes: {
        style: hasTargetDye ? 'margin-bottom: 24px;' : 'margin-bottom: 24px; display: none;',
      },
    });
    wrapper.appendChild(this.targetOverviewContainer);

    this.verdictContainer = this.createElement('div', {
      attributes: { style: hasTargetDye ? 'margin-bottom: 18px;' : 'display: none;' },
    });
    wrapper.appendChild(this.verdictContainer);

    this.ledgerContainer = this.createElement('div', {
      attributes: { style: hasTargetDye ? '' : 'display: none;' },
    });
    wrapper.appendChild(this.ledgerContainer);

    if (hasTargetDye) {
      this.renderTargetOverview();
      this.renderVerdict();
      this.renderLedger();
    }
  }

  private renderEmptyState(): void {
    if (!this.emptyStateContainer) return;
    clearContainer(this.emptyStateContainer);

    // Shared empty-state treatment (shaded box + dimmed glyph + instruction).
    // Rules come from the shell's injected stylesheet — see v4-layout.ts.
    const empty = this.createElement('div', {
      className: 'v5-empty-state',
    });

    empty.innerHTML = `
      <div class="v5-empty-state-icon" aria-hidden="true">${ICON_TOOL_BUDGET}</div>
      <p class="v5-empty-state-text">${LanguageService.t('budget.selectTargetToStart')}</p>
    `;

    this.emptyStateContainer.appendChild(empty);
  }

  private showEmptyState(show: boolean): void {
    if (this.emptyStateContainer) {
      this.emptyStateContainer.style.display = show ? 'block' : 'none';
    }
    if (this.targetOverviewContainer) {
      this.targetOverviewContainer.style.display = show ? 'none' : 'block';
    }
    if (this.verdictContainer) {
      this.verdictContainer.style.display = show ? 'none' : 'block';
    }
    if (this.ledgerContainer) {
      this.ledgerContainer.style.display = show ? 'none' : 'block';
    }
  }

  /** Target Result Card — keeps ΔE2000 and the existing context actions. */
  private renderTargetOverview(): void {
    if (!this.targetOverviewContainer || !this.targetDye) return;

    this.showEmptyState(false);
    clearContainer(this.targetOverviewContainer);

    const cardWrapper = this.createElement('div', {
      attributes: {
        style: 'display: flex; justify-content: center;',
      },
    });

    const card = document.createElement('v4-result-card') as ResultCard;

    const priceInfo = this.priceData.get(this.targetDye.itemID);
    const marketServer = this.marketBoardService.getWorldNameForPrice(priceInfo);
    const price = this.priceOf(this.targetDye);

    const cardData: ResultCardData = {
      dye: this.targetDye,
      originalColor: this.targetDye.hex,
      matchedColor: this.targetDye.hex,
      marketServer: marketServer,
      price: price.board ?? undefined,
      vendorCost: this.targetDye.consolidationType ? this.targetDye.cost : undefined,
    };

    card.data = cardData;
    card.showActions = true;
    card.primaryActionLabel = LanguageService.t('budget.currentlySelected');
    card.showDeltaE = false;

    card.showHex = this.showHex;
    card.showRgb = this.showRgb;
    card.showHsv = this.showHsv;
    card.showLab = this.showLab;
    card.showCmyk = this.showCmyk;
    card.showPrice = this.showPrice;
    card.showAcquisition = this.showAcquisition;
    card.showHue = this.showHue;
    card.showStain = this.showStain;
    card.showConsolidation = this.showSpectrum;

    card.style.setProperty('--v4-result-card-width', '320px');

    card.addEventListener('context-action', ((
      e: CustomEvent<{ action: ContextAction; dye: Dye }>
    ) => {
      this.handleContextAction(e.detail.action, e.detail.dye);
    }) as EventListener);

    cardWrapper.appendChild(card);
    this.targetOverviewContainer.appendChild(cardWrapper);
    this.targetOverviewContainer.appendChild(this.buildSendToRow(this.targetDye));
  }

  /** 9C SEND TO row: Harmony · Compare · Copy item name · Save swap · Share. */
  private buildSendToRow(dye: Dye): HTMLElement {
    const row = this.createElement('div', {
      attributes: {
        style:
          'display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; margin-top: 10px;',
      },
    });
    row.appendChild(
      this.createElement('span', {
        textContent: LanguageService.t('budget.sendTo'),
        attributes: {
          style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-right: 4px;`,
        },
      })
    );

    const btn = (label: string, onClick: () => void): HTMLElement => {
      const b = this.createElement('button', {
        textContent: label,
        attributes: {
          type: 'button',
          style:
            'min-height: 32px; padding: 4px 10px; border-radius: 8px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: inherit; background: var(--theme-card-background); border: 1px solid var(--theme-border); color: var(--theme-text);',
        },
      });
      this.on(b, 'click', onClick);
      return b;
    };

    // Name-addressed handoffs and the swap record need a real dye
    if (dye.stainID !== null) {
      row.appendChild(
        btn(LanguageService.t('budget.handoffHarmony'), () =>
          RouterService.navigateTo('harmony', { dye: dye.name })
        )
      );
      row.appendChild(
        btn(LanguageService.t('budget.handoffCompare'), () =>
          RouterService.navigateTo('comparison', { dye: dye.name })
        )
      );
      row.appendChild(
        btn(LanguageService.t('budget.copyItem'), () => {
          void navigator.clipboard.writeText(this.itemNameFor(dye));
          ToastService.success(LanguageService.t('success.copiedToClipboard'));
        })
      );
      row.appendChild(btn(LanguageService.t('budget.saveSwap'), () => this.saveSwapRecord()));
    }

    const share = document.createElement('v4-share-button') as ShareButton;
    share.tool = 'budget';
    share.shareParams = this.getShareParams();
    this.shareButton = share;
    row.appendChild(share);

    return row;
  }

  /**
   * The market-searchable item name: consolidated tiers share one item;
   * coffer dyes carry their own (the localized dye name finds it).
   */
  private itemNameFor(dye: Dye): string {
    return dye.consolidationType
      ? getConsolidatedDyeName(dye.consolidationType, LanguageService.getCurrentLocale())
      : this.dyeName(dye);
  }

  /**
   * Save the target and its best-priced substitute as a device-local
   * `kind: 'swap'` record (the store's third collection kind).
   */
  private saveSwapRecord(): void {
    const target = this.targetDye;
    if (!target || target.stainID === null) return;

    const record = CollectionService.createCollection(this.dyeName(target), undefined, {
      kind: 'swap',
      target: target.stainID as DyeId,
    });
    if (!record) {
      ToastService.error(LanguageService.t('errors.saveChangesFailed'));
      return;
    }
    const cheapest = this.rows.reduce<LedgerRow | null>(
      (best, r) =>
        r.price.gil != null &&
        r.dye.stainID !== null &&
        (best?.price.gil == null || r.price.gil < best.price.gil)
          ? r
          : best,
      null
    );
    if (cheapest && cheapest.dye.stainID !== null) {
      CollectionService.addDyeToCollection(record.id, cheapest.dye.stainID as DyeId);
    }
    ToastService.success(LanguageService.t('budget.swapSaved'));
  }

  private getShareParams(): Record<string, unknown> {
    if (!this.targetDye) return {};
    const params: Record<string, unknown> = { maxDelta: this.matchLine };
    if (this.targetDye.stainID !== null) {
      params.dye = this.targetDye.stainID;
    } else {
      params.hex = this.targetDye.hex;
    }
    return params;
  }

  /** The verdict block: badge · headline · sub · money figure. */
  private renderVerdict(): void {
    if (!this.verdictContainer || !this.targetDye) return;
    clearContainer(this.verdictContainer);

    const dark = ThemeService.isDarkMode();
    const targetName = this.dyeName(this.targetDye);
    const upgrade = this.isUpgradeMode();
    const targetGil = this.priceOf(this.targetDye).gil;
    const gilWord = LanguageService.getCurrency('Gil');

    if (this.shareButton) this.shareButton.shareParams = this.getShareParams();

    let badge: string;
    let headline: string;
    let sub: string;
    let money: string;
    let moneyLabel: string;
    let unit: string;

    const cheapestGil = this.rows.reduce<number | null>(
      (min, r) => (r.price.gil != null && (min == null || r.price.gil < min) ? r.price.gil : min),
      null
    );

    if (upgrade) {
      badge = LanguageService.t('budget.upBadge');
      headline = LanguageService.tInterpolate('budget.upHead', { t: targetName });
      sub = LanguageService.tInterpolate('budget.upSub', { t: targetName });
      money = `${CONSOLIDATED_DYES.A.price.toLocaleString()} ${gilWord}`;
      moneyLabel = LanguageService.t('budget.upFloorLabel');
      unit = LanguageService.t('budget.upUnit');
    } else if (!this.marketOnline) {
      badge = LanguageService.t('budget.offBadge');
      headline = LanguageService.tInterpolate('budget.ledgerHead', { t: targetName });
      sub = LanguageService.t('budget.offText');
      money = cheapestGil != null ? `${cheapestGil.toLocaleString()} ${gilWord}` : '—';
      moneyLabel = LanguageService.t('budget.cheapestKnown');
      unit = LanguageService.t('budget.noTargetPrice');
    } else {
      badge = LanguageService.tInterpolate('budget.inRange', { n: this.rows.length });
      headline = LanguageService.tInterpolate('budget.ledgerHead', { t: targetName });
      sub = LanguageService.tInterpolate('budget.ledgerSub', {
        thr: `${this.fmtValue(this.effectiveThreshold())} ${methodShort(this.matchingMethod)}`,
      });
      const bestPerPoint = this.rows.reduce<number | null>(
        (max, r) => (r.perPoint != null && (max == null || r.perPoint > max) ? r.perPoint : max),
        null
      );
      if (bestPerPoint != null) {
        money = `${Math.round(bestPerPoint).toLocaleString()} ${gilWord}`;
        moneyLabel = LanguageService.t('budget.perPointLabel');
        unit = LanguageService.t('budget.perPointSort');
      } else {
        money = cheapestGil != null ? `${cheapestGil.toLocaleString()} ${gilWord}` : '—';
        moneyLabel = LanguageService.t('budget.cheapestKnown');
        unit = targetGil == null ? LanguageService.t('budget.noTargetPrice') : '';
      }
    }

    // Drawn verdict states: green when priced, amber offline, neutral in
    // upgrade mode — the theme accent belongs to selection, not verdicts
    const green = dark ? '#5bbd68' : '#137A33';
    const amber = dark ? '#ffc107' : '#B45309';
    const tone = upgrade ? (dark ? '#8a877f' : '#6b6862') : !this.marketOnline ? amber : green;
    const blockBorder = upgrade ? 'var(--theme-border)' : this.tint(tone, 0.35);
    const blockBg = upgrade ? 'var(--theme-card-background)' : this.tint(tone, 0.08);

    const block = this.createElement('div', {
      attributes: {
        style: `display: flex; gap: 20px; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; padding: 16px 18px; border-radius: 12px; border: 1px solid ${blockBorder}; background: ${blockBg};`,
      },
    });

    const leftCol = this.createElement('div', {
      attributes: { style: 'flex: 1 1 320px; min-width: 0;' },
    });
    leftCol.appendChild(
      this.createElement('span', {
        textContent: badge,
        attributes: {
          style: `display: inline-block; font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: ${tone}; color: ${dark ? '#0A0A0A' : '#FFFFFF'}; margin-bottom: 8px;`,
        },
      })
    );
    leftCol.appendChild(
      this.createElement('div', {
        textContent: headline,
        attributes: {
          style:
            'font-size: 17px; font-weight: 650; line-height: 1.3; color: var(--theme-text); margin-bottom: 6px; overflow-wrap: anywhere;',
        },
      })
    );
    leftCol.appendChild(
      this.createElement('div', {
        textContent: sub,
        attributes: {
          style: 'font-size: 12.5px; line-height: 1.55; color: var(--theme-text-muted);',
        },
      })
    );
    block.appendChild(leftCol);

    const rightCol = this.createElement('div', {
      attributes: { style: 'text-align: right; flex: 0 0 auto;' },
    });
    rightCol.appendChild(
      this.createElement('div', {
        textContent: money,
        attributes: {
          style: `font-family: ${MONO}; font-size: 22px; color: var(--theme-text); white-space: nowrap;`,
        },
      })
    );
    rightCol.appendChild(
      this.createElement('div', {
        textContent: moneyLabel,
        attributes: {
          style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: ${tone}; margin-top: 4px;`,
        },
      })
    );
    if (unit) {
      rightCol.appendChild(
        this.createElement('div', {
          textContent: unit,
          attributes: {
            style: 'font-size: 11px; color: var(--theme-text-muted); margin-top: 2px;',
          },
        })
      );
    }
    block.appendChild(rightCol);

    this.verdictContainer.appendChild(block);
  }

  /** The ledger: tier groups, price printed once per group, one row per candidate. */
  private renderLedger(): void {
    if (!this.ledgerContainer || !this.targetDye) return;
    clearContainer(this.ledgerContainer);

    if (this.isLoading) {
      const { current, total } = this.fetchProgress;
      const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
      const loading = this.createElement('div', {
        attributes: {
          style:
            'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 32px 0; text-align: center;',
        },
      });
      loading.innerHTML = `
        <svg width="32" height="32" style="color: var(--theme-primary); width: 32px; height: 32px;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <g>
            <circle style="opacity: 0.25;" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path style="opacity: 0.75;" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite"></animateTransform>
          </g>
        </svg>
        <div style="width: 100%; max-width: 320px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 4px; color: var(--theme-text-muted);">
            <span>${LanguageService.t('budget.fetchingPrices')}</span>
            <span style="font-family: ${MONO};">${current} / ${total}</span>
          </div>
          <div style="width: 100%; height: 8px; border-radius: 9999px; overflow: hidden; background: var(--theme-background-secondary);">
            <div style="height: 100%; border-radius: 9999px; background: var(--theme-primary); width: ${percentage}%;"></div>
          </div>
        </div>
      `;
      this.ledgerContainer.appendChild(loading);
      return;
    }

    const upgrade = this.isUpgradeMode();
    const targetGil = this.priceOf(this.targetDye).gil;
    const ramp = this.tierRamp();
    const dark = ThemeService.isDarkMode();
    const perPointActive = this.matchingMethod === 'ciede2000';

    const byTier = new Map<TierKey, LedgerRow[]>();
    for (const row of this.rows) {
      const tier = row.price.tier;
      if (!byTier.has(tier)) byTier.set(tier, []);
      byTier.get(tier)!.push(row);
    }

    const order = upgrade ? UPGRADE_ORDER : TIER_ORDER;

    for (const tier of order) {
      const list = byTier.get(tier) ?? [];
      // Upgrade mode drops an empty coffer band (nothing to promise there).
      if (upgrade && tier === 'X' && list.length === 0) continue;
      this.ledgerContainer.appendChild(
        this.buildTierGroup(tier, list, { upgrade, targetGil, ramp, dark, perPointActive })
      );
    }

    // The per-point column's honesty note.
    if (perPointActive && this.rows.length > 0) {
      this.ledgerContainer.appendChild(
        this.createElement('p', {
          textContent: LanguageService.t('budget.perPointNote'),
          attributes: {
            style:
              'font-size: 11px; line-height: 1.5; color: var(--theme-text-muted); margin: 4px 2px 0;',
          },
        })
      );
    }
  }

  private buildTierGroup(
    tier: TierKey,
    list: LedgerRow[],
    ctx: {
      upgrade: boolean;
      targetGil: number | null;
      ramp: readonly string[];
      dark: boolean;
      perPointActive: boolean;
    }
  ): HTMLElement {
    const meta = TIER_META[tier];
    const hue = ctx.ramp[meta.rampIndex];
    const pool = this.tierPoolSize(tier);
    const goodGreen = ctx.dark ? '#5bbd68' : '#137A33';

    const group = this.createElement('div', {
      attributes: {
        style: `border: 1px solid var(--theme-border); border-left: 3px solid ${hue}; border-radius: 12px; overflow: hidden; margin-bottom: 14px; background: var(--theme-card-background);`,
      },
    });

    // --- Group header: tag, name, count, price-once, multiple ---
    const header = this.createElement('div', {
      attributes: {
        style: `display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 14px; background: ${this.tint(hue, 0.06)};`,
      },
    });

    header.appendChild(
      this.createElement('span', {
        textContent: meta.tag,
        attributes: {
          style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: ${this.tint(hue, 0.16)}; color: ${hue}; flex: 0 0 auto;`,
        },
      })
    );
    header.appendChild(
      this.createElement('span', {
        textContent: this.tierName(tier),
        attributes: {
          style:
            'font-size: 13px; font-weight: 600; color: var(--theme-text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
        },
      })
    );
    header.appendChild(
      this.createElement('span', {
        textContent: `${list.length} / ${pool}`,
        attributes: {
          style: `font-family: ${MONO}; font-size: 11px; color: var(--theme-text-muted); flex: 1 1 auto;`,
        },
      })
    );

    // Price, once per tier. Currencies are compared through the board, never converted.
    const gilList = list.map((r) => r.price.gil).filter((g): g is number => g != null);
    const groupGil = gilList.length ? Math.min(...gilList) : null;
    const gilMax = gilList.length ? Math.max(...gilList) : null;

    let priceMain: string;
    let priceSub: string;
    let flag = '';
    let flagColor = '';
    let flagBg = '';

    if (tier === 'X') {
      if (groupGil == null) {
        priceMain = '—';
        if (!this.marketOnline) {
          flag = LanguageService.t('budget.offBadge');
          flagBg = 'rgba(244, 191, 79, 0.14)';
          flagColor = '#F4BF4F';
        }
      } else if (groupGil === gilMax) {
        priceMain = `${groupGil.toLocaleString()} gil`;
      } else {
        priceMain = `${groupGil.toLocaleString()} – ${gilMax!.toLocaleString()} gil`;
      }
      priceSub = LanguageService.t('budget.noVendorMarketOnly');
    } else {
      const tierMeta = CONSOLIDATED_DYES[tier];
      const localCost = `${tierMeta.price.toLocaleString()} ${tierMeta.currency}`;
      const boardPrice = list.length > 0 ? list[0].price.board : null;
      if (tier === 'A') {
        priceMain = `${tierMeta.price.toLocaleString()} gil`;
        priceSub =
          boardPrice != null
            ? `${LanguageService.t('budget.boardWord')} ${boardPrice.toLocaleString()}`
            : localCost;
        if (boardPrice != null && boardPrice > tierMeta.price) {
          flag = LanguageService.tInterpolate('budget.vendorSaves', {
            diff: (boardPrice - tierMeta.price).toLocaleString(),
          });
          flagBg = this.tint('#5bbd68', 0.14);
          flagColor = goodGreen;
        }
      } else if (boardPrice != null) {
        priceMain = `${boardPrice.toLocaleString()} gil`;
        priceSub = `${LanguageService.t('budget.orWord')} ${localCost}`;
      } else {
        priceMain = localCost;
        priceSub = '';
      }
    }
    if (list.length === 0) flag = '';

    const priceCol = this.createElement('div', {
      attributes: { style: 'text-align: right; flex: 0 0 auto;' },
    });
    priceCol.appendChild(
      this.createElement('div', {
        textContent: priceMain,
        attributes: {
          style: `font-family: ${MONO}; font-size: 15px; color: var(--theme-text); white-space: nowrap;`,
        },
      })
    );
    if (priceSub) {
      priceCol.appendChild(
        this.createElement('div', {
          textContent: priceSub,
          attributes: {
            style: 'font-size: 11px; color: var(--theme-text-muted); white-space: nowrap;',
          },
        })
      );
    }
    header.appendChild(priceCol);

    if (flag) {
      header.appendChild(
        this.createElement('span', {
          textContent: flag,
          attributes: {
            style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 0.5px; padding: 3px 7px; border-radius: 5px; background: ${flagBg}; color: ${flagColor}; flex: 0 0 auto;`,
          },
        })
      );
    }

    // Multiple vs target: ×N CHEAPER (or ×N more in upgrade mode)
    if (list.length > 0 && groupGil != null && ctx.targetGil != null && groupGil > 0) {
      const multipleCol = this.createElement('div', {
        attributes: { style: 'text-align: right; flex: 0 0 auto;' },
      });
      if (ctx.upgrade) {
        const n = groupGil / ctx.targetGil;
        multipleCol.appendChild(
          this.createElement('div', {
            textContent: LanguageService.tInterpolate('budget.upMultiple', {
              n: n.toFixed(n >= 100 ? 0 : 1),
            }),
            attributes: {
              style: `font-family: ${MONO}; font-size: 15px; color: var(--theme-text-muted); white-space: nowrap;`,
            },
          })
        );
      } else {
        const n = ctx.targetGil / groupGil;
        multipleCol.appendChild(
          this.createElement('div', {
            textContent: `×${n.toFixed(n >= 100 ? 0 : 1)}`,
            attributes: {
              style: `font-family: ${MONO}; font-size: 15px; color: ${goodGreen}; white-space: nowrap;`,
            },
          })
        );
        multipleCol.appendChild(
          this.createElement('div', {
            textContent: LanguageService.t('budget.multipleCheaper'),
            attributes: {
              style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted);`,
            },
          })
        );
      }
      header.appendChild(multipleCol);
    }

    group.appendChild(header);

    // --- Body: empty band or the row table ---
    if (list.length === 0) {
      group.appendChild(
        this.createElement('div', {
          textContent: LanguageService.t('budget.emptyBand'),
          attributes: {
            style: 'padding: 14px; font-size: 12px; color: var(--theme-text-muted);',
          },
        })
      );
      return group;
    }

    // The BOARD column drops on narrow viewports (drawn MOBILE·412 frame)
    const narrow = window.matchMedia('(max-width: 480px)').matches;
    const gridCols = narrow ? 'minmax(0, 1fr) 84px 96px' : 'minmax(0, 1fr) 84px 96px 96px';

    // Sortable column headers
    const headRow = this.createElement('div', {
      attributes: {
        style: `display: grid; grid-template-columns: ${gridCols}; gap: 8px; align-items: center; padding: 8px 14px 6px; border-top: 1px solid var(--theme-border);`,
      },
    });
    const cols: Array<{ col: SortCol; label: string; align: string }> = [
      { col: 'name', label: LanguageService.t('budget.colDye'), align: 'left' },
      { col: 'de', label: methodShort(this.matchingMethod), align: 'right' },
      ...(narrow
        ? []
        : [
            {
              col: 'board' as SortCol,
              label: LanguageService.t('budget.colBoard'),
              align: 'right',
            },
          ]),
      { col: 'perPoint', label: LanguageService.t('budget.colPerDe'), align: 'right' },
    ];
    for (const c of cols) {
      const active = this.sortCol === c.col;
      const btn = this.createElement('button', {
        textContent: active ? `${c.label} ${this.sortDir === 1 ? '▾' : '▴'}` : c.label,
        attributes: {
          type: 'button',
          style: `font-family: ${MONO}; font-size: 8.5px; letter-spacing: 1px; text-align: ${c.align}; background: none; border: none; padding: 0; cursor: pointer; color: ${active ? this.accent() : 'var(--theme-text-muted)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`,
        },
      }) as HTMLButtonElement;
      this.on(btn, 'click', () => {
        if (this.sortCol === c.col) {
          this.sortDir = this.sortDir === 1 ? -1 : 1;
        } else {
          this.sortCol = c.col;
          this.sortDir = 1;
        }
        StorageService.setItem(STORAGE_KEYS.sortCol, this.sortCol);
        StorageService.setItem(STORAGE_KEYS.sortDir, this.sortDir);
        this.renderLedger();
      });
      headRow.appendChild(btn);
    }
    group.appendChild(headRow);

    // Rows
    for (const row of this.sortRows(list)) {
      const tierIdx = classifyBandTier(row.de, this.matchingMethod, 'match');
      const deColor = ctx.ramp[tierIdx];

      const rowEl = this.createElement('div', {
        attributes: {
          role: 'button',
          tabindex: '0',
          style: `display: grid; grid-template-columns: ${gridCols}; gap: 8px; align-items: center; padding: 7px 14px; border-top: 1px solid var(--theme-border); cursor: pointer;`,
        },
      });

      const nameCell = this.createElement('div', {
        attributes: {
          style: 'display: flex; align-items: center; gap: 8px; min-width: 0;',
        },
      });
      nameCell.appendChild(
        this.createElement('span', {
          attributes: {
            style: `width: 14px; height: 14px; border-radius: 4px; flex: 0 0 auto; background: ${row.dye.hex}; border: 1px solid var(--theme-border);`,
          },
        })
      );
      nameCell.appendChild(
        this.createElement('span', {
          textContent: this.dyeName(row.dye),
          attributes: {
            style:
              'font-size: 13px; color: var(--theme-text); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;',
          },
        })
      );
      rowEl.appendChild(nameCell);

      rowEl.appendChild(
        this.createElement('span', {
          textContent: this.fmtValue(row.de),
          attributes: {
            style: `font-family: ${MONO}; font-size: 12.5px; text-align: right; color: ${deColor};`,
          },
        })
      );

      if (!narrow) {
        rowEl.appendChild(
          this.createElement('span', {
            textContent: row.price.board != null ? row.price.board.toLocaleString() : '—',
            attributes: {
              style: `font-family: ${MONO}; font-size: 12.5px; text-align: right; color: ${row.price.board != null ? 'var(--theme-text)' : 'var(--theme-text-muted)'};`,
            },
          })
        );
      }

      rowEl.appendChild(
        this.createElement('span', {
          textContent: row.perPoint != null ? Math.round(row.perPoint).toLocaleString() : '',
          attributes: {
            style: `font-family: ${MONO}; font-size: 12.5px; text-align: right; color: var(--theme-text);`,
          },
        })
      );

      const pick = () => this.selectDye(row.dye);
      this.on(rowEl, 'click', pick);
      this.on(rowEl, 'keydown', (e) => {
        const key = (e as KeyboardEvent).key;
        if (key === 'Enter' || key === ' ') {
          e.preventDefault();
          pick();
        }
      });

      group.appendChild(rowEl);
    }

    return group;
  }

  // ============================================================================
  // Mobile Drawer Content
  // ============================================================================

  private renderDrawerContent(): void {
    if (!this.options.drawerContent) return;
    const drawer = this.options.drawerContent;
    clearContainer(drawer);

    const flow = this.createElement('div', {
      attributes: { style: 'display: flex; flex-direction: column; gap: 16px;' },
    });
    drawer.appendChild(flow);

    const targetSection = this.createElement('div');
    targetSection.appendChild(this.sectionLabel(LanguageService.t('budget.targetDye')));
    this.renderTargetDyeSection(targetSection, true);
    flow.appendChild(targetSection);

    this.mobileQuickPicksContent = this.createElement('div');
    this.renderQuickPicksInto(this.mobileQuickPicksContent);
    flow.appendChild(this.mobileQuickPicksContent);

    const lineSection = this.createElement('div', {
      attributes: {
        style:
          'padding: 12px 14px; border: 1px solid var(--theme-border); border-radius: 10px; background: var(--theme-card-background);',
      },
    });
    this.renderMatchLineSection(lineSection, true);
    flow.appendChild(lineSection);
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private handleContextAction(action: ContextAction, dye: Dye): void {
    switch (action) {
      case 'add-comparison':
        RouterService.navigateTo('comparison', { dye: dye.name });
        break;
      case 'add-mixer':
        RouterService.navigateTo('mixer', { dye: dye.name });
        break;
      case 'add-accessibility':
        RouterService.navigateTo('accessibility', { dye: dye.name });
        break;
      case 'see-harmonies':
        RouterService.navigateTo('harmony', { dye: dye.name });
        break;
      case 'budget':
        this.selectDye(dye);
        break;
      case 'copy-hex':
        void navigator.clipboard.writeText(dye.hex);
        ToastService.success(LanguageService.t('success.copiedToClipboard'));
        break;
    }
  }

  private isLightColor(hex: string): boolean {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }

  /**
   * Clear all dye selections and return to empty state.
   * Called when "Clear All Dyes" button is clicked in Color Palette.
   */
  public clearDyes(): void {
    this.targetDye = null;
    this.rows = [];

    StorageService.removeItem(STORAGE_KEYS.targetDyeId);
    logger.info('[BudgetTool] All dyes cleared');

    if (this.ledgerContainer) clearContainer(this.ledgerContainer);
    if (this.verdictContainer) clearContainer(this.verdictContainer);

    this.showEmptyState(true);
    this.updateTargetDyeDisplay();
    this.updateMobileTargetDyeDisplay();
    this.renderQuickPicks();
  }

  /**
   * Select a dye as the new target (row pick, quick pick, or Color Palette drawer).
   */
  public selectDye(dye: Dye): void {
    if (!dye) return;

    this.targetDye = dye;

    StorageService.setItem(STORAGE_KEYS.targetDyeId, dye.id);
    logger.info(`[BudgetTool] Target selected: ${dye.name}`);

    void this.findAlternatives();
    this.updateTargetDyeDisplay();
    this.updateMobileTargetDyeDisplay();
    this.renderQuickPicks();
  }

  /** Wrap a bare colour in a virtual target dye (no stainID — never shared as a dye). */
  private virtualTargetFor(hex: string): Dye {
    return {
      id: -Date.now(),
      itemID: -Date.now(),
      stainID: null,
      name: `Custom (${hex.toUpperCase()})`,
      hex: hex.toUpperCase(),
      rgb: ColorService.hexToRgb(hex),
      hsv: ColorService.hexToHsv(hex),
      category: 'Custom',
      acquisition: 'Custom',
      cost: 0,
      currency: null,
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,
      isIshgardian: false,
      consolidationType: null,
    };
  }

  /**
   * Price an arbitrary colour from the Color Palette drawer's hex field /
   * native picker — the target can be an armour base colour or UI tint,
   * not only a dye.
   */
  public selectCustomColor(hex: string): void {
    if (!hex) return;
    this.selectDye(this.virtualTargetFor(hex));
  }
}
