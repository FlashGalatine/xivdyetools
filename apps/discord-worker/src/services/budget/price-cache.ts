/**
 * Price Cache Service
 *
 * Cache API-backed caching for Universalis market prices.
 * 5-minute freshness window; entries up to 15 minutes old are served only
 * on the stale-if-error path when Universalis is unavailable (OPT-006).
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

/** Cache-Control max-age in seconds — retain entries for 15 minutes to cover burst reads. */
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
  logger?: ExtendedLogger,
  options?: { acceptStale?: boolean }
): Promise<DyePriceData | null> {
  try {
    const url = buildPriceCacheUrl(world, itemId);
    const cache = caches.default;
    const response = await cache.match(url);

    if (!response) {
      return null;
    }

    const entry: CachedPriceEntry = await response.json();

    // Check if cache is still fresh
    // OPT-006 (2026-07-18 audit): with acceptStale, entries in the 5-15 min
    // band are served (stale-if-error path) — previously the 300-900s
    // retention window was dead weight that no code path ever read
    const age = Date.now() - entry.cachedAt;
    const maxAge = options?.acceptStale ? CACHE_MAX_AGE_SECONDS : CACHE_TTL_SECONDS;
    if (age > maxAge * 1000) {
      return null; // Expired
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
  logger?: ExtendedLogger,
  options?: { acceptStale?: boolean }
): Promise<Map<number, DyePriceData>> {
  const results = new Map<number, DyePriceData>();

  // Fetch all in parallel
  const promises = itemIds.map(async (itemId) => {
    const data = await getCachedPrice(world, itemId, logger, options);
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
): Promise<{ prices: Map<number, DyePriceData>; fromCache: number; fromApi: number; stale: boolean }> {
  // Check cache first
  const cached = await getCachedPrices(world, itemIds, logger);

  // Find which items need to be fetched
  const uncachedIds = itemIds.filter((id) => !cached.has(id));

  if (uncachedIds.length === 0) {
    // All items were cached
    return { prices: cached, fromCache: cached.size, fromApi: 0, stale: false };
  }

  // Fetch missing items from API
  // OPT-006 (2026-07-18 audit): stale-if-error — when Universalis fails,
  // re-read the cache accepting entries up to 15 minutes old and serve them
  // as a degraded (but working) response instead of a hard failure. The
  // caller surfaces `stale: true` in the embed.
  let fetched: Map<number, DyePriceData>;
  try {
    fetched = await fetchFn(uncachedIds);
  } catch (error) {
    const staleEntries = await getCachedPrices(world, uncachedIds, logger, { acceptStale: true });
    if (staleEntries.size > 0) {
      logger?.warn?.('Universalis fetch failed; serving stale cached prices', {
        staleCount: staleEntries.size,
        missing: uncachedIds.length - staleEntries.size,
      });
      const combinedStale = new Map<number, DyePriceData>([...cached, ...staleEntries]);
      return {
        prices: combinedStale,
        fromCache: combinedStale.size,
        fromApi: 0,
        stale: true,
      };
    }
    throw error; // No stale data either — propagate the original failure
  }

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
    stale: false,
  };
}


