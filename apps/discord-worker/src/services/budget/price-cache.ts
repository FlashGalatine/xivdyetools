/**
 * Price Cache Service
 *
 * Cache API-backed caching for Universalis market prices.
 * Uses a 5-minute freshness window with 15-minute stale fallback.
 *
 * Migrated from KV to Cache API to avoid the 1,000 writes/day
 * free-tier limit. The Cache API has no write limits.
 *
 * @module services/budget/price-cache
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import type { DyePriceData, CachedPriceEntry } from '../../types/budget.js';

// ============================================================================
// Constants
// ============================================================================

/** Cache schema version - bump to invalidate all cached prices */
const CACHE_SCHEMA_VERSION = 'v1';

/** Base URL for synthetic cache keys (not actually fetched) */
const CACHE_BASE_URL = 'https://cache.xivdyetools.internal/prices';

/** Cache TTL in seconds (5 minutes) - freshness window */
export const CACHE_TTL_SECONDS = 300;

/** Stale threshold - allow stale data up to 15 minutes old */
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

/**
 * Cache-Control max-age in seconds.
 * Set to 15 minutes (the stale threshold) so the Cache API retains data
 * for the full stale window. We check `cachedAt` in code for fresh vs stale.
 */
const CACHE_MAX_AGE_SECONDS = 900;

// ============================================================================
// Cache Key Utilities
// ============================================================================

/**
 * Build a synthetic URL cache key for a single price entry
 */
function buildPriceCacheUrl(world: string, itemId: number): string {
  return `${CACHE_BASE_URL}/${CACHE_SCHEMA_VERSION}/${world.toLowerCase()}/${itemId}`;
}

// ============================================================================
// Single Entry Operations
// ============================================================================

/**
 * Get a cached price entry
 *
 * @param world - World/datacenter name
 * @param itemId - FFXIV item ID
 * @param logger - Optional logger
 * @returns Price data if cached and fresh, null otherwise
 */
export async function getCachedPrice(
  world: string,
  itemId: number,
  logger?: ExtendedLogger
): Promise<DyePriceData | null> {
  try {
    const url = buildPriceCacheUrl(world, itemId);
    const cache = caches.default;
    const response = await cache.match(url);

    if (!response) {
      return null;
    }

    const entry = (await response.json()) as CachedPriceEntry;

    // Check if cache is still fresh
    const age = Date.now() - entry.cachedAt;
    if (age > CACHE_TTL_SECONDS * 1000) {
      return null; // Expired (stale) — caller should use getCachedPriceWithStale for fallback
    }

    return entry.data;
  } catch (error) {
    if (logger) {
      logger.error('Failed to get cached price', error instanceof Error ? error : undefined);
    }
    return null;
  }
}

/**
 * Get a cached price entry, allowing stale data
 *
 * Returns stale data (up to 15 minutes old) if available.
 * Useful for fallback when API is unavailable.
 *
 * @returns Object with data and isStale flag
 */
export async function getCachedPriceWithStale(
  world: string,
  itemId: number,
  logger?: ExtendedLogger
): Promise<{ data: DyePriceData | null; isStale: boolean }> {
  try {
    const url = buildPriceCacheUrl(world, itemId);
    const cache = caches.default;
    const response = await cache.match(url);

    if (!response) {
      return { data: null, isStale: false };
    }

    const entry = (await response.json()) as CachedPriceEntry;
    const age = Date.now() - entry.cachedAt;

    // Check if too old even for stale
    if (age > STALE_THRESHOLD_MS) {
      return { data: null, isStale: false };
    }

    const isStale = age > CACHE_TTL_SECONDS * 1000;
    return { data: entry.data, isStale };
  } catch (error) {
    if (logger) {
      logger.error('Failed to get cached price with stale', error instanceof Error ? error : undefined);
    }
    return { data: null, isStale: false };
  }
}

/**
 * Store a price entry in cache
 *
 * @param world - World/datacenter name
 * @param itemId - FFXIV item ID
 * @param data - Price data to cache
 * @param logger - Optional logger
 */
export async function setCachedPrice(
  world: string,
  itemId: number,
  data: DyePriceData,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const url = buildPriceCacheUrl(world, itemId);
    const entry: CachedPriceEntry = {
      data,
      cachedAt: Date.now(),
    };

    const cache = caches.default;
    const response = new Response(JSON.stringify(entry), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `s-maxage=${CACHE_MAX_AGE_SECONDS}`,
      },
    });

    await cache.put(url, response);
  } catch (error) {
    // Cache write failures are non-fatal
    if (logger) {
      logger.error('Failed to cache price', error instanceof Error ? error : undefined);
    }
  }
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Get multiple cached prices at once
 *
 * Issues parallel cache lookups for all item IDs.
 *
 * @returns Map of item ID to price data (only cached items)
 */
export async function getCachedPrices(
  world: string,
  itemIds: number[],
  logger?: ExtendedLogger
): Promise<Map<number, DyePriceData>> {
  const results = new Map<number, DyePriceData>();

  // Fetch all in parallel
  const promises = itemIds.map(async (itemId) => {
    const data = await getCachedPrice(world, itemId, logger);
    if (data) {
      results.set(itemId, data);
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Store multiple price entries at once
 *
 * @param world - World/datacenter name
 * @param prices - Map of item ID to price data
 * @param logger - Optional logger
 */
export async function setCachedPrices(
  world: string,
  prices: Map<number, DyePriceData>,
  logger?: ExtendedLogger
): Promise<void> {
  // Write all in parallel
  const promises = Array.from(prices.entries()).map(([itemId, data]) =>
    setCachedPrice(world, itemId, data, logger)
  );

  await Promise.all(promises);
}

// ============================================================================
// Cache-Aware Fetch
// ============================================================================

/**
 * Fetch prices with cache support
 *
 * Checks cache first, fetches missing items from API,
 * and caches the results.
 *
 * @param world - World/datacenter name
 * @param itemIds - Item IDs to fetch
 * @param fetchFn - Function to fetch prices from API
 * @param logger - Optional logger
 * @returns Map of item ID to price data
 */
export async function fetchWithCache(
  world: string,
  itemIds: number[],
  fetchFn: (ids: number[]) => Promise<Map<number, DyePriceData>>,
  logger?: ExtendedLogger
): Promise<{ prices: Map<number, DyePriceData>; fromCache: number; fromApi: number }> {
  // Check cache first
  const cached = await getCachedPrices(world, itemIds, logger);

  // Find which items need to be fetched
  const uncachedIds = itemIds.filter((id) => !cached.has(id));

  if (uncachedIds.length === 0) {
    // All items were cached
    return { prices: cached, fromCache: cached.size, fromApi: 0 };
  }

  // Fetch missing items from API
  const fetched = await fetchFn(uncachedIds);

  // Cache the new results
  await setCachedPrices(world, fetched, logger);

  // Merge results
  const combined = new Map<number, DyePriceData>();
  for (const [id, data] of cached) {
    combined.set(id, data);
  }
  for (const [id, data] of fetched) {
    combined.set(id, data);
  }

  return {
    prices: combined,
    fromCache: cached.size,
    fromApi: fetched.size,
  };
}

// ============================================================================
// Cache Invalidation
// ============================================================================

/**
 * Invalidate a specific price cache entry
 *
 * Use sparingly - cache expiry is the primary mechanism.
 */
export async function invalidateCachedPrice(
  world: string,
  itemId: number,
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const url = buildPriceCacheUrl(world, itemId);
    const cache = caches.default;
    await cache.delete(url);
  } catch (error) {
    if (logger) {
      logger.error('Failed to invalidate cache', error instanceof Error ? error : undefined);
    }
  }
}
