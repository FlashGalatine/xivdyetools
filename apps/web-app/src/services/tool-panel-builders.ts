/**
 * Tool Panel Builders Service
 * WEB-REF-003 Phase 3: Shared panel building utilities for tool components.
 *
 * Provides reusable builder functions that create common UI patterns:
 * - Filters panel (CollapsiblePanel + DyeFilters)
 * - Market board panel (CollapsiblePanel + MarketBoard)
 *
 * These builders eliminate ~30-40 lines of duplicated code per tool.
 *
 * @module services/tool-panel-builders
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { DyeFilters, type DyeFilterConfig } from '@components/dye-filters';
import { MarketBoard } from '@components/market-board';
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import { LanguageService } from '@services/index';
import { ICON_FILTER, ICON_MARKET } from '@shared/ui-icons';

// ============================================================================
// Shared Types (exported for use in tool components)
// ============================================================================

/**
 * References returned by filters panel builder
 */
export interface FiltersPanelRefs {
  panel: CollapsiblePanel;
  filters: DyeFilters;
}

/**
 * References returned by market board panel builder
 */
export interface MarketPanelRefs {
  panel: CollapsiblePanel;
  marketBoard: MarketBoard;
}

/**
 * Configuration for filters panel builder
 */
export interface FiltersPanelConfig {
  /** Storage key for panel collapse state */
  storageKey: string;
  /** Storage key prefix for filter settings */
  storageKeyPrefix: string;
  /** Callback when filters change */
  onFilterChange: (config: DyeFilterConfig) => void;
  /** Whether panel should be open by default (default: false) */
  defaultOpen?: boolean;
}

/**
 * Configuration for market board panel builder
 */
export interface MarketPanelConfig {
  /** Storage key for panel collapse state */
  storageKey: string;
  /** Getter for current showPrices state */
  getShowPrices: () => boolean;
  /** Function to fetch prices for displayed dyes */
  fetchPrices: () => Promise<void>;
  /** Callback when prices toggle changes */
  onPricesToggled?: () => void;
  /** Callback when server selection changes */
  onServerChanged?: () => void;
  /** Callback when refresh is requested (optional) */
  onRefreshRequested?: () => void;
  /** Whether panel should be open by default (default: false) */
  defaultOpen?: boolean;
}

// ============================================================================
// Builder Functions
// ============================================================================

/**
 * Build a filters panel with CollapsiblePanel + DyeFilters.
 *
 * Usage:
 * ```typescript
 * const filtersContainer = this.createElement('div');
 * container.appendChild(filtersContainer);
 * const refs = buildFiltersPanel(this, filtersContainer, {
 *   storageKey: 'my_tool_filters',
 *   storageKeyPrefix: 'my_tool',
 *   onFilterChange: (config) => this.handleFilterChange(config),
 * });
 * this.filtersPanel = refs.panel;
 * this.dyeFilters = refs.filters;
 * ```
 *
 * @param host The host component (for createElement access)
 * @param container Container element to render into
 * @param config Panel configuration
 * @returns References to created panel and filters
 */
export function buildFiltersPanel(
  host: BaseComponent,
  container: HTMLElement,
  config: FiltersPanelConfig
): FiltersPanelRefs {
  const panel = new CollapsiblePanel(container, {
    title: LanguageService.t('filters.advancedFilters'),
    storageKey: config.storageKey,
    defaultOpen: config.defaultOpen ?? false,
    icon: ICON_FILTER,
  });
  panel.init();

  const filtersContent = host.createElement('div');
  const filters = new DyeFilters(filtersContent, {
    storageKeyPrefix: config.storageKeyPrefix,
    hideHeader: true,
    onFilterChange: config.onFilterChange,
  });
  filters.init(); // Use init() to properly initialize lifecycle (render + bindEvents + onMount)
  panel.setContent(filtersContent);

  return { panel, filters };
}

/**
 * Build a market board panel with CollapsiblePanel + MarketBoard.
 *
 * Usage:
 * ```typescript
 * const marketContainer = this.createElement('div');
 * container.appendChild(marketContainer);
 * const refs = buildMarketPanel(this, marketContainer, {
 *   storageKey: 'my_tool_market',
 *   getShowPrices: () => this.showPrices,
 *   fetchPrices: () => this.fetchPricesForDisplayedDyes(),
 *   onPricesToggled: () => this.handlePricesToggle(),
 *   onServerChanged: () => this.handleServerChange(),
 * });
 * this.marketPanel = refs.panel;
 * this.marketBoard = refs.marketBoard;
 * ```
 *
 * @param host The host component (for createElement access)
 * @param container Container element to render into
 * @param config Panel configuration
 * @returns References to created panel and market board
 */
export function buildMarketPanel(
  host: BaseComponent,
  container: HTMLElement,
  config: MarketPanelConfig
): MarketPanelRefs {
  const panel = new CollapsiblePanel(container, {
    title: LanguageService.t('marketBoard.title'),
    storageKey: config.storageKey,
    defaultOpen: config.defaultOpen ?? false,
    icon: ICON_MARKET,
  });
  panel.init();

  const marketContent = host.createElement('div');
  const marketBoard = new MarketBoard(marketContent);
  marketBoard.init();

  // Set up market board event listeners using shared utility
  setupMarketBoardListeners(
    marketContent,
    config.getShowPrices,
    config.fetchPrices,
    {
      onPricesToggled: config.onPricesToggled,
      onServerChanged: config.onServerChanged,
      onRefreshRequested: config.onRefreshRequested,
    }
  );

  panel.setContent(marketContent);
  return { panel, marketBoard };
}
