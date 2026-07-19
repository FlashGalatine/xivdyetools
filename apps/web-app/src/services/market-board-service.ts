/**
 * XIV Dye Tools v4.0 - Market Board Service
 *
 * Centralized service for Market Board price data management.
 * Extracted from Harmony Tool's sophisticated patterns for reuse across all tools.
 *
 * Features:
 * - Singleton pattern for shared price cache across tools
 * - Request versioning to prevent stale responses (race condition protection)
 * - Event-driven updates for reactive UI
 * - ConfigController integration for settings persistence
 * - World name resolution for price data
 *
 * @module services/market-board-service
 */

import { APIService, WorldService } from '@services/index';
import { ConfigController } from '@services/config-controller';
import { logger } from '@shared/logger';
import { getMarketItemID, isConsolidationActive } from '@xivdyetools/core';
import type { Dye, PriceData } from '@xivdyetools/types';
import type { MarketConfig } from '@shared/tool-config-types';

// ============================================================================
// Types
// ============================================================================

/**
 * Event types emitted by MarketBoardService
 */
export type MarketBoardEventType =
  | 'prices-updated'
  | 'server-changed'
  | 'settings-changed'
  | 'fetch-started'
  | 'fetch-completed'
  | 'fetch-error';

/**
 * Event detail for prices-updated event
 */
export interface PricesUpdatedEvent {
  prices: Map<number, PriceData>;
  fetchedCount: number;
}

/**
 * Event detail for server-changed event
 */
export interface ServerChangedEvent {
  server: string;
  previousServer: string;
}

/**
 * Event detail for settings-changed event
 */
export interface SettingsChangedEvent {
  showPrices: boolean;
}

/**
 * Event detail for fetch-error event
 */
export interface FetchErrorEvent {
  error: Error;
  dyeCount: number;
}

// ============================================================================
// MarketBoardService Class
// ============================================================================

/**
 * MarketBoardService - Centralized Market Board price data management
 *
 * Provides a singleton service for fetching, caching, and distributing
 * market price data across all tools. Implements race condition protection
 * using request versioning pattern from Harmony Tool.
 *
 * @example
 * ```typescript
 * const service = MarketBoardService.getInstance();
 *
 * // Subscribe to price updates
 * service.addEventListener('prices-updated', (event) => {
 *   console.log('Prices updated:', event.detail.prices);
 * });
 *
 * // Fetch prices for dyes
 * await service.fetchPricesForDyes([dye1, dye2, dye3]);
 *
 * // Get cached price
 * const price = service.getPriceForDye(12345);
 * ```
 */
export class MarketBoardService extends EventTarget {
  // Singleton instance
  private static instance: MarketBoardService | null = null;

  // API service reference
  private apiService: ReturnType<typeof APIService.getInstance>;

  // State
  private priceData: Map<number, PriceData> = new Map();
  private requestVersion: number = 0;
  private selectedServer: string = 'Crystal';
  private showPrices: boolean = false;
  private isFetching: boolean = false;

  // Config controller subscription
  private configUnsubscribe: (() => void) | null = null;

  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {
    super();
    this.apiService = APIService.getInstance();

    // Subscribe to ConfigController for market config changes
    this.subscribeToConfigController();

    logger.info('[MarketBoardService] Initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): MarketBoardService {
    if (!MarketBoardService.instance) {
      MarketBoardService.instance = new MarketBoardService();
    }
    return MarketBoardService.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance(): void {
    if (MarketBoardService.instance) {
      MarketBoardService.instance.destroy();
      MarketBoardService.instance = null;
    }
  }

  // ============================================================================
  // ConfigController Integration
  // ============================================================================

  /**
   * Subscribe to ConfigController for market config changes
   */
  private subscribeToConfigController(): void {
    const configController = ConfigController.getInstance();

    // Load initial config
    const marketConfig = configController.getConfig('market');
    if (marketConfig) {
      this.selectedServer = marketConfig.selectedServer;
      this.showPrices = marketConfig.showPrices;
    }

    // Subscribe to changes
    this.configUnsubscribe = configController.subscribe('market', (config: MarketConfig) => {
      const serverChanged = config.selectedServer !== this.selectedServer;
      const showPricesChanged = config.showPrices !== this.showPrices;

      if (serverChanged) {
        const previousServer = this.selectedServer;
        this.selectedServer = config.selectedServer;

        // BUG-039 (2026-07-18 audit): invalidate any in-flight fetch for the
        // old server — otherwise its late response passes the version check
        // and repopulates the just-cleared cache with old-server prices
        this.requestVersion++;
        this.isFetching = false;

        // Clear prices on server change (prices are server-specific)
        this.priceData.clear();

        this.emitEvent('server-changed', {
          server: this.selectedServer,
          previousServer,
        });

        logger.info(`[MarketBoardService] Server changed to ${this.selectedServer}`);
      }

      if (showPricesChanged) {
        this.showPrices = config.showPrices;

        this.emitEvent('settings-changed', {
          showPrices: this.showPrices,
        });
      }
    });
  }

  // ============================================================================
  // Getters
  // ============================================================================

  /**
   * Get current selected server
   */
  getSelectedServer(): string {
    return this.selectedServer;
  }

  /**
   * Get whether prices should be shown
   */
  getShowPrices(): boolean {
    return this.showPrices;
  }

  /**
   * Check if currently fetching prices
   */
  getIsFetching(): boolean {
    return this.isFetching;
  }

  /**
   * Get all cached prices
   */
  getAllPrices(): Map<number, PriceData> {
    return new Map(this.priceData);
  }

  /**
   * Read-only view of the internal price cache — no copy.
   * OPT-027 (2026-07-18 audit): tools exposing a `priceData` getter were
   * cloning the full map on every property access inside per-card render
   * loops; this view eliminates the clones (type-level protection only).
   */
  getPricesView(): ReadonlyMap<number, PriceData> {
    return this.priceData;
  }

  // ============================================================================
  // Setters (update ConfigController which triggers subscriptions)
  // ============================================================================

  /**
   * Set selected server (updates ConfigController)
   */
  setServer(server: string): void {
    if (server === this.selectedServer) return;

    const configController = ConfigController.getInstance();
    configController.setConfig('market', { selectedServer: server });
    // ConfigController subscription will handle the state update
  }

  /**
   * Set show prices toggle (updates ConfigController)
   */
  setShowPrices(show: boolean): void {
    if (show === this.showPrices) return;

    const configController = ConfigController.getInstance();
    configController.setConfig('market', { showPrices: show });
    // ConfigController subscription will handle the state update
  }

  // ============================================================================
  // Price Data Methods
  // ============================================================================

  /**
   * Get cached price for a specific dye
   */
  getPriceForDye(itemID: number): PriceData | undefined {
    return this.priceData.get(itemID);
  }

  /**
   * Get world name for a price data entry
   * Resolves worldId to human-readable world name
   */
  getWorldNameForPrice(priceData: PriceData | undefined): string | undefined {
    if (!priceData?.worldId) {
      return this.selectedServer;
    }
    return WorldService.getWorldName(priceData.worldId) ?? this.selectedServer;
  }

  /**
   * Check if a dye is currently tradeable on the FFXIV Market Board.
   *
   * After Patch 7.5 (2026-04-28), individual dyes that belong to a consolidation
   * bucket (consolidationType A/B/C) are no longer tradeable as standalone items —
   * only the three consolidated dye items can be bought. Unconsolidated dyes
   * (Pure White, Jet Black, Special-category, etc.) remain individually tradeable.
   *
   * - Returns false when prices are toggled off entirely.
   * - Returns false for Facewear (synthetic negative itemIDs) — never on the market.
   * - Returns false for consolidated dyes when consolidated itemIDs are not yet
   *   datamined (pre-`isConsolidationActive`) to avoid 404ing on retired itemIDs.
   * - Otherwise returns true; `getMarketItemID` collapses consolidated dyes to the
   *   3 shared market IDs inside `fetchPricesForDyes`.
   */
  shouldFetchPrice(dye: Dye): boolean {
    if (!this.showPrices) return false;
    if (dye.itemID <= 0) return false;
    if (dye.consolidationType !== null && !isConsolidationActive()) return false;
    return true;
  }

  /**
   * Fetch prices for multiple dyes using batch API
   * Implements request versioning to prevent stale responses
   *
   * @param dyes - Array of dyes to fetch prices for
   * @param onProgress - Optional callback to report progress
   * @returns Map of itemID to PriceData
   */
  async fetchPricesForDyes(
    dyes: Dye[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Map<number, PriceData>> {
    // Increment version to invalidate any in-flight requests
    // This prevents race conditions when user rapidly changes servers
    this.requestVersion++;
    const requestVersion = this.requestVersion;

    // Filter dyes that should have prices fetched
    const dyesToFetch = dyes.filter((dye) => this.shouldFetchPrice(dye));
    const total = dyesToFetch.length;

    if (total === 0) {
      // BUG-039: a superseding call with nothing to fetch must not leave a
      // previous call's isFetching flag stuck true
      this.isFetching = false;
      onProgress?.(0, 0);
      return new Map();
    }

    // Emit fetch started event
    this.isFetching = true;
    this.emitEvent('fetch-started', { dyeCount: total });
    onProgress?.(0, total);

    try {
      // Build mapping: marketItemID -> original itemIDs (for consolidated dye fan-out)
      const marketIdToOriginals = new Map<number, number[]>();
      for (const dye of dyesToFetch) {
        const marketId = getMarketItemID(dye);
        if (!marketIdToOriginals.has(marketId)) {
          marketIdToOriginals.set(marketId, []);
        }
        marketIdToOriginals.get(marketId)!.push(dye.itemID);
      }

      // Fetch deduplicated market item IDs
      const itemIDs = Array.from(marketIdToOriginals.keys());

      // Use batch API to fetch all prices in a single request
      const batchResults = await this.apiService.getPricesForDataCenter(
        itemIDs,
        this.selectedServer
      );

      // Check if this response is still current (no newer request was made)
      if (requestVersion !== this.requestVersion) {
        logger.info(
          `[MarketBoardService] Discarding stale price response (v${requestVersion}, current v${this.requestVersion})`
        );
        return new Map();
      }

      // BUG-010/REFACTOR-011 (2026-07-18 audit): fan out consolidated prices
      // to each original dye's itemID in BOTH the shared cache and the
      // returned map. The raw batchResults are keyed by the 3 consolidated
      // market itemIDs (52254/52255/52256 for 105 dyes) — returning them
      // directly made callers that look up by original dye itemID (Budget,
      // Swatch) silently miss most prices.
      const result = new Map<number, PriceData>();
      for (const [marketId, priceData] of batchResults) {
        const originalIds = marketIdToOriginals.get(marketId) ?? [marketId];
        for (const originalId of originalIds) {
          this.priceData.set(originalId, priceData);
          result.set(originalId, priceData);
        }
      }

      // Report completion
      onProgress?.(total, total);
      this.isFetching = false;

      // Emit prices updated event (counts are per-dye, not per-market-item)
      this.emitEvent('prices-updated', {
        prices: new Map(this.priceData),
        fetchedCount: result.size,
      });

      this.emitEvent('fetch-completed', { dyeCount: result.size });
      logger.info(`[MarketBoardService] Fetched prices for ${result.size} dyes`);

      return result;
    } catch (error) {
      // Only log/emit error if this was the current request
      if (requestVersion === this.requestVersion) {
        this.isFetching = false;
        onProgress?.(total, total);

        const err = error instanceof Error ? error : new Error(String(error));
        this.emitEvent('fetch-error', { error: err, dyeCount: total });
        logger.error('[MarketBoardService] Failed to fetch prices:', error);
      }

      return new Map();
    }
  }

  /**
   * Clear all cached price data
   */
  clearCache(): void {
    this.priceData.clear();
    logger.info('[MarketBoardService] Cache cleared');
  }

  /**
   * Clear cache and trigger API cache clear
   */
  async refreshPrices(): Promise<void> {
    await APIService.clearCache();
    this.priceData.clear();
    logger.info('[MarketBoardService] Full cache refresh (API + local)');
  }

  // ============================================================================
  // Event Helpers
  // ============================================================================

  /**
   * Helper to emit typed events
   */
  private emitEvent<T>(type: MarketBoardEventType, detail: T): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Cleanup subscriptions and resources
   */
  destroy(): void {
    if (this.configUnsubscribe) {
      this.configUnsubscribe();
      this.configUnsubscribe = null;
    }
    this.priceData.clear();
    logger.info('[MarketBoardService] Destroyed');
  }
}

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Get singleton instance of MarketBoardService
 */
export function getMarketBoardService(): MarketBoardService {
  return MarketBoardService.getInstance();
}

/**
 * Format price for display (delegates to APIService)
 */
export function formatPrice(price: number): string {
  return APIService.formatPrice(price);
}
