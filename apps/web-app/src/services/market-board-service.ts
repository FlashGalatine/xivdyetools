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
import { appStorage } from '@services/storage-service';
import { PRICE_CATEGORIES } from '@shared/constants';
import { logger } from '@shared/logger';
import type { Dye, PriceData } from '@shared/types';
import type { MarketConfig } from '@shared/tool-config-types';

// ============================================================================
// Types
// ============================================================================

/**
 * Price category filter settings
 */
export interface PriceCategorySettings {
  baseDyes: boolean;
  craftDyes: boolean;
  alliedSocietyDyes: boolean;
  cosmicDyes: boolean;
  specialDyes: boolean;
}

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
  categories: PriceCategorySettings;
}

/**
 * Event detail for fetch-error event
 */
export interface FetchErrorEvent {
  error: Error;
  dyeCount: number;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY_CATEGORIES = 'market_board_categories';

const DEFAULT_CATEGORIES: PriceCategorySettings = {
  baseDyes: PRICE_CATEGORIES.baseDyes.default,
  craftDyes: PRICE_CATEGORIES.craftDyes.default,
  alliedSocietyDyes: PRICE_CATEGORIES.alliedSocietyDyes.default,
  cosmicDyes: PRICE_CATEGORIES.cosmicDyes.default,
  specialDyes: PRICE_CATEGORIES.specialDyes.default,
};

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
  private priceCategories: PriceCategorySettings;
  private isFetching: boolean = false;

  // Config controller subscription
  private configUnsubscribe: (() => void) | null = null;

  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {
    super();
    this.apiService = APIService.getInstance();

    // Load saved categories from localStorage
    this.priceCategories = appStorage.getItem(STORAGE_KEY_CATEGORIES, DEFAULT_CATEGORIES) ?? {
      ...DEFAULT_CATEGORIES,
    };

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
          categories: this.priceCategories,
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
   * Get current price categories
   */
  getPriceCategories(): PriceCategorySettings {
    return { ...this.priceCategories };
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

  /**
   * Set price categories
   */
  setCategories(categories: Partial<PriceCategorySettings>): void {
    const newCategories = { ...this.priceCategories, ...categories };

    // Check if anything actually changed
    const hasChanges = Object.keys(categories).some(
      (key) =>
        this.priceCategories[key as keyof PriceCategorySettings] !==
        categories[key as keyof PriceCategorySettings]
    );

    if (!hasChanges) return;

    this.priceCategories = newCategories;
    appStorage.setItem(STORAGE_KEY_CATEGORIES, this.priceCategories);

    this.emitEvent('settings-changed', {
      showPrices: this.showPrices,
      categories: this.priceCategories,
    });

    logger.debug('[MarketBoardService] Categories updated:', this.priceCategories);
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
   * Check if a dye should have its price fetched based on category settings
   */
  shouldFetchPrice(dye: Dye): boolean {
    // Check Base Dyes (Dye Vendor)
    if (
      this.priceCategories.baseDyes &&
      (PRICE_CATEGORIES.baseDyes.acquisitions as readonly string[]).includes(dye.acquisition)
    ) {
      return true;
    }

    // Check Craft Dyes
    if (
      this.priceCategories.craftDyes &&
      (PRICE_CATEGORIES.craftDyes.acquisitions as readonly string[]).includes(dye.acquisition)
    ) {
      return true;
    }

    // Check Allied Society Dyes
    if (
      this.priceCategories.alliedSocietyDyes &&
      (PRICE_CATEGORIES.alliedSocietyDyes.acquisitions as readonly string[]).includes(
        dye.acquisition
      )
    ) {
      return true;
    }

    // Check Cosmic Dyes
    if (
      this.priceCategories.cosmicDyes &&
      (PRICE_CATEGORIES.cosmicDyes.acquisitions as readonly string[]).includes(dye.acquisition)
    ) {
      return true;
    }

    // Check Special Dyes
    if (this.priceCategories.specialDyes && dye.category === 'Special') {
      return true;
    }

    return false;
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
    const dyesToFetch = dyes.filter((dye) => this.showPrices && this.shouldFetchPrice(dye));
    const total = dyesToFetch.length;

    if (total === 0) {
      onProgress?.(0, 0);
      return new Map();
    }

    // Emit fetch started event
    this.isFetching = true;
    this.emitEvent('fetch-started', { dyeCount: total });
    onProgress?.(0, total);

    try {
      // Extract item IDs for batch fetch
      const itemIDs = dyesToFetch.map((dye) => dye.itemID);

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

      // Update shared cache with new prices
      for (const [itemID, priceData] of batchResults) {
        this.priceData.set(itemID, priceData);
      }

      // Report completion
      onProgress?.(total, total);
      this.isFetching = false;

      // Emit prices updated event
      this.emitEvent('prices-updated', {
        prices: new Map(this.priceData),
        fetchedCount: batchResults.size,
      });

      this.emitEvent('fetch-completed', { dyeCount: batchResults.size });
      logger.info(`[MarketBoardService] Fetched prices for ${batchResults.size} dyes`);

      return batchResults;
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
