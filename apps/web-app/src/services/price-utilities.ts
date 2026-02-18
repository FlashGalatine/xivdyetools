/**
 * Price Utilities Service
 * WEB-REF-003 Phase 4: Shared price formatting and card data preparation utilities.
 *
 * Provides reusable utilities for:
 * - Formatting prices for display
 * - Preparing price data for result cards
 * - Getting price display strings with gil suffix
 *
 * These utilities eliminate duplicated price formatting logic across tools.
 *
 * @module services/price-utilities
 */

import type { Dye, PriceData } from '@shared/types';
import type { MarketBoardService } from './market-board-service';

// ============================================================================
// Types
// ============================================================================

/**
 * Price card data for v4-result-card components
 */
export interface PriceCardData {
  /** World/server name where price is from */
  marketServer?: string;
  /** Current minimum price (raw number) */
  price?: number;
  /** Whether to show price on the card */
  showPrice: boolean;
}

/**
 * Options for getting dye price display
 */
export interface DyePriceDisplayOptions {
  /** Whether prices are enabled */
  showPrices: boolean;
  /** Price data map (itemID -> PriceData) */
  priceData: Map<number, PriceData>;
  /** Optional suffix (default: ' gil') */
  suffix?: string;
  /** Whether to use locale formatting (default: true) */
  useLocale?: boolean;
}

// ============================================================================
// Price Formatting Utilities
// ============================================================================

/**
 * Format a price number for display with locale formatting.
 *
 * @param price - The price to format
 * @param suffix - Optional suffix (default: ' gil')
 * @returns Formatted price string (e.g., "1,234 gil")
 *
 * @example
 * formatPriceWithSuffix(1234) // "1,234 gil"
 * formatPriceWithSuffix(1234, ' G') // "1,234 G"
 */
export function formatPriceWithSuffix(price: number, suffix: string = ' gil'): string {
  return `${price.toLocaleString()}${suffix}`;
}

/**
 * Get price display string for a dye.
 * Returns null if prices are disabled or price is unavailable.
 *
 * @param dye - The dye to get price for
 * @param options - Display options
 * @returns Formatted price string or null
 *
 * @example
 * const priceStr = getDyePriceDisplay(dye, {
 *   showPrices: this.showPrices,
 *   priceData: this.priceData,
 * });
 * // Returns "1,234 gil" or null
 */
export function getDyePriceDisplay(dye: Dye, options: DyePriceDisplayOptions): string | null {
  if (!options.showPrices) return null;

  const priceInfo = options.priceData.get(dye.itemID);
  if (!priceInfo?.currentMinPrice) return null;

  const suffix = options.suffix ?? ' gil';

  if (options.useLocale === false) {
    return `${priceInfo.currentMinPrice}${suffix}`;
  }

  return formatPriceWithSuffix(priceInfo.currentMinPrice, suffix);
}

/**
 * Get price info for a dye (raw data access).
 *
 * @param dye - The dye to get price for
 * @param priceData - Price data map
 * @returns PriceData or undefined
 */
export function getPriceInfo(dye: Dye, priceData: Map<number, PriceData>): PriceData | undefined {
  return priceData.get(dye.itemID);
}

// ============================================================================
// Card Data Preparation
// ============================================================================

/**
 * Prepare price data for a v4-result-card component.
 * Extracts market server and price from MarketBoardService.
 *
 * @param dye - The dye to prepare data for
 * @param service - MarketBoardService instance
 * @returns Price card data object
 *
 * @example
 * const priceData = preparePriceCardData(dye, this.marketBoardService);
 * // { marketServer: 'Cactuar', price: 1234, showPrice: true }
 */
export function preparePriceCardData(dye: Dye, service: MarketBoardService): PriceCardData {
  const priceInfo = service.getPriceForDye(dye.itemID);
  const showPrice = service.getShowPrices();

  return {
    marketServer: service.getWorldNameForPrice(priceInfo),
    price: priceInfo?.currentMinPrice,
    showPrice,
  };
}

/**
 * Prepare price data using a price data map (for tools with local price state).
 * This is useful for tools that haven't migrated to MarketBoardService yet.
 *
 * @param dye - The dye to prepare data for
 * @param priceData - Price data map
 * @param showPrices - Whether prices are enabled
 * @param serverName - Current server name
 * @returns Price card data object
 *
 * @example
 * const data = preparePriceCardDataFromMap(dye, this.priceData, this.showPrices, 'Crystal');
 */
export function preparePriceCardDataFromMap(
  dye: Dye,
  priceData: Map<number, PriceData>,
  showPrices: boolean,
  serverName?: string
): PriceCardData {
  const priceInfo = priceData.get(dye.itemID);

  return {
    marketServer: serverName,
    price: priceInfo?.currentMinPrice,
    showPrice: showPrices,
  };
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get item IDs from dyes that need price fetching.
 * Filters based on dye categories that have market prices.
 *
 * @param dyes - Array of dyes
 * @param service - MarketBoardService instance for category checking
 * @returns Array of item IDs to fetch
 *
 * @example
 * const itemIds = getItemIdsForPriceFetch(matchedDyes, this.marketBoardService);
 */
export function getItemIdsForPriceFetch(dyes: Dye[], service: MarketBoardService): number[] {
  return dyes.filter((dye) => service.shouldFetchPrice(dye)).map((dye) => dye.itemID);
}

/**
 * Check if any dye in array has a cached price.
 *
 * @param dyes - Array of dyes
 * @param priceData - Price data map
 * @returns true if at least one dye has a cached price
 */
export function hasCachedPrices(dyes: Dye[], priceData: Map<number, PriceData>): boolean {
  return dyes.some((dye) => priceData.has(dye.itemID));
}
