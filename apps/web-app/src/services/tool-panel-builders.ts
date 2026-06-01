/**
 * Tool Panel Builders Service
 * WEB-REF-003 Phase 3: Shared panel building utilities for tool components.
 *
 * Provides reusable builder functions that create common UI patterns:
 * - Market board panel (CollapsiblePanel + MarketBoard)
 *
 * These builders eliminate ~30-40 lines of duplicated code per tool.
 *
 * @module services/tool-panel-builders
 */

import { BaseComponent } from '@components/base-component';
import { CollapsiblePanel } from '@components/collapsible-panel';
import { MarketBoard } from '@components/market-board';
import { setupMarketBoardListeners } from '@services/pricing-mixin';
import { LanguageService } from '@services/index';
import { ICON_MARKET } from '@shared/ui-icons';

// ============================================================================
// Shared Types (exported for use in tool components)
// ============================================================================

/**
 * References returned by market board panel builder
 */
export interface MarketPanelRefs {
  panel: CollapsiblePanel;
  marketBoard: MarketBoard;
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
  setupMarketBoardListeners(marketContent, config.getShowPrices, config.fetchPrices, {
    onPricesToggled: config.onPricesToggled,
    onServerChanged: config.onServerChanged,
    onRefreshRequested: config.onRefreshRequested,
  });

  panel.setContent(marketContent);
  return { panel, marketBoard };
}
