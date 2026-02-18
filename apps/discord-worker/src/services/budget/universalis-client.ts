/**
 * Universalis API Client
 *
 * Fetches market board prices from the Universalis API via the
 * xivdyetools-universalis-proxy worker.
 *
 * Uses Service Binding for Worker-to-Worker communication when available,
 * with fallback to URL-based fetch for local development.
 *
 * @module services/budget/universalis-client
 */

import type { Env } from '../../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { UniversalisError, type DyePriceData } from '../../types/budget.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Universalis v2 aggregated price response
 *
 * The aggregated endpoint returns an array of items (not a keyed object).
 * Each item contains summary statistics at datacenter (dc) and region levels.
 */
interface UniversalisAggregatedResponse {
  results: UniversalisAggregatedItem[];
  failedItems: number[];
}

interface UniversalisAggregatedItem {
  itemId: number;
  nq: {
    minListing: { dc?: { price: number; worldId: number }; region?: { price: number; worldId: number } };
    recentPurchase: { dc?: { price: number; timestamp: number; worldId: number }; region?: { price: number; timestamp: number; worldId: number } };
    averageSalePrice: { dc?: { price: number }; region?: { price: number } };
    dailySaleVelocity: { dc?: { quantity: number }; region?: { quantity: number } };
  };
  hq: {
    minListing: { dc?: { price: number; worldId: number }; region?: { price: number; worldId: number } };
    recentPurchase: { dc?: { price: number; timestamp: number; worldId: number }; region?: { price: number; timestamp: number; worldId: number } };
    averageSalePrice: { dc?: { price: number }; region?: { price: number } };
    dailySaleVelocity: { dc?: { quantity: number }; region?: { quantity: number } };
  };
  worldUploadTimes: Array<{ worldId: number; timestamp: number }>;
}

/**
 * World data from Universalis
 */
export interface UniversalisWorld {
  id: number;
  name: string;
}

/**
 * Data center from Universalis
 */
export interface UniversalisDataCenter {
  name: string;
  region: string;
  worlds: number[];
}

// ============================================================================
// Constants
// ============================================================================

/** Default timeout for API requests (ms) */
const REQUEST_TIMEOUT = 10000;

/** Maximum number of items per batch request */
const MAX_BATCH_SIZE = 100;

/** Cache TTL for world/datacenter data (1 hour) */
const WORLD_CACHE_TTL = 60 * 60 * 1000;

// Module-level cache for world/datacenter data (OPT-001)
// Persists across requests within the same Cloudflare Worker isolate
let worldsCache: { data: UniversalisWorld[]; expiry: number } | null = null;
let dataCentersCache: { data: UniversalisDataCenter[]; expiry: number } | null = null;

// ============================================================================
// Core Request Function
// ============================================================================

/**
 * Make a request to the Universalis proxy
 *
 * Uses Service Binding when available for direct Worker-to-Worker
 * communication, otherwise falls back to URL-based fetch.
 */
async function request<T>(
  env: Env,
  path: string,
  options: {
    logger?: ExtendedLogger;
    timeout?: number;
  } = {}
): Promise<T> {
  // Require either service binding or URL-based configuration
  if (!env.UNIVERSALIS_PROXY && !env.UNIVERSALIS_PROXY_URL) {
    throw new UniversalisError(503, 'Universalis proxy not configured');
  }

  const timeout = options.timeout ?? REQUEST_TIMEOUT;

  try {
    let response: Response;

    if (env.UNIVERSALIS_PROXY) {
      // Use Service Binding for Worker-to-Worker communication
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        response = await env.UNIVERSALIS_PROXY.fetch(
          new Request(`https://internal${path}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
          })
        );
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      // Fall back to external URL for local development
      const url = `${env.UNIVERSALIS_PROXY_URL}${path}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        response = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // Handle error responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        (errorData as { error?: string; message?: string }).error ||
        (errorData as { error?: string; message?: string }).message ||
        `Universalis API error: ${response.status}`;

      throw new UniversalisError(response.status, message);
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof UniversalisError) {
      throw error;
    }

    // Handle abort/timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new UniversalisError(408, 'Request timeout');
    }

    // Network or parsing error
    if (options.logger) {
      options.logger.error('Universalis request failed', error instanceof Error ? error : undefined);
    }
    throw new UniversalisError(500, 'Failed to communicate with Universalis API');
  }
}

// ============================================================================
// Public API Functions
// ============================================================================

/**
 * Check if the Universalis client is configured
 */
export function isUniversalisEnabled(env: Env): boolean {
  return Boolean(env.UNIVERSALIS_PROXY || env.UNIVERSALIS_PROXY_URL);
}

/**
 * Fetch aggregated prices for multiple items
 *
 * @param env - Environment bindings
 * @param world - World name or datacenter (e.g., "Crystal", "Cactuar")
 * @param itemIds - Array of item IDs to fetch prices for
 * @param logger - Optional logger for structured logging
 * @returns Map of item ID to price data (missing items = no listings)
 */
export async function fetchPrices(
  env: Env,
  world: string,
  itemIds: number[],
  logger?: ExtendedLogger
): Promise<Map<number, DyePriceData>> {
  if (itemIds.length === 0) {
    return new Map();
  }

  // Validate batch size
  if (itemIds.length > MAX_BATCH_SIZE) {
    throw new UniversalisError(
      400,
      `Too many items requested (${itemIds.length}). Maximum is ${MAX_BATCH_SIZE}.`
    );
  }

  const itemIdString = itemIds.join(',');
  const path = `/api/v2/aggregated/${encodeURIComponent(world)}/${itemIdString}`;

  const response = await request<UniversalisAggregatedResponse>(env, path, { logger });

  // Convert aggregated response to our DyePriceData format
  const priceMap = new Map<number, DyePriceData>();
  const now = new Date().toISOString();

  for (const item of response.results) {
    const itemId = item.itemId;

    // Skip items with no NQ listing data (empty dc object = no listings)
    const minListingPrice = item.nq?.minListing?.dc?.price;
    if (minListingPrice == null) {
      continue;
    }

    const averagePrice = item.nq.averageSalePrice?.dc?.price ?? minListingPrice;
    const lastUpload = item.worldUploadTimes?.[0]?.timestamp ?? Date.now();
    const velocity = item.nq.dailySaleVelocity?.dc?.quantity ?? 0;

    priceMap.set(itemId, {
      itemID: itemId,
      currentAverage: Math.round(averagePrice),
      currentMinPrice: minListingPrice,
      currentMaxPrice: minListingPrice, // aggregated endpoint doesn't provide max listing price
      lastUpdate: lastUpload,
      world,
      listingCount: Math.max(1, Math.round(velocity)), // use daily velocity as activity proxy
      fetchedAt: now,
    });
  }

  return priceMap;
}

/**
 * Fetch prices in batches for many items
 *
 * Splits large requests into multiple batch requests.
 */
export async function fetchPricesBatched(
  env: Env,
  world: string,
  itemIds: number[],
  logger?: ExtendedLogger
): Promise<Map<number, DyePriceData>> {
  const result = new Map<number, DyePriceData>();

  // Split into batches
  for (let i = 0; i < itemIds.length; i += MAX_BATCH_SIZE) {
    const batch = itemIds.slice(i, i + MAX_BATCH_SIZE);
    const batchResult = await fetchPrices(env, world, batch, logger);

    // Merge results
    for (const [id, data] of batchResult) {
      result.set(id, data);
    }
  }

  return result;
}

/**
 * Fetch list of all worlds
 */
export async function fetchWorlds(
  env: Env,
  logger?: ExtendedLogger
): Promise<UniversalisWorld[]> {
  return request<UniversalisWorld[]>(env, '/api/v2/worlds', { logger });
}

/**
 * Fetch list of all data centers
 */
export async function fetchDataCenters(
  env: Env,
  logger?: ExtendedLogger
): Promise<UniversalisDataCenter[]> {
  return request<UniversalisDataCenter[]>(env, '/api/v2/data-centers', { logger });
}

/**
 * Get worlds with module-level caching (OPT-001)
 *
 * World lists change extremely rarely (only when SE adds servers).
 * Caching for 1 hour eliminates redundant HTTP requests on every
 * autocomplete keystroke.
 */
async function getCachedWorlds(env: Env, logger?: ExtendedLogger): Promise<UniversalisWorld[]> {
  if (worldsCache && Date.now() < worldsCache.expiry) {
    return worldsCache.data;
  }
  const data = await fetchWorlds(env, logger);
  worldsCache = { data, expiry: Date.now() + WORLD_CACHE_TTL };
  return data;
}

/**
 * Get data centers with module-level caching (OPT-001)
 */
async function getCachedDataCenters(env: Env, logger?: ExtendedLogger): Promise<UniversalisDataCenter[]> {
  if (dataCentersCache && Date.now() < dataCentersCache.expiry) {
    return dataCentersCache.data;
  }
  const data = await fetchDataCenters(env, logger);
  dataCentersCache = { data, expiry: Date.now() + WORLD_CACHE_TTL };
  return data;
}

/**
 * Validate that a world/datacenter name exists
 *
 * @returns Normalized name if valid, null if not found
 */
export async function validateWorld(
  env: Env,
  worldOrDc: string,
  logger?: ExtendedLogger
): Promise<string | null> {
  const normalizedInput = worldOrDc.toLowerCase().trim();

  try {
    // Check worlds first
    const worlds = await getCachedWorlds(env, logger);
    const matchedWorld = worlds.find((w) => w.name.toLowerCase() === normalizedInput);
    if (matchedWorld) {
      return matchedWorld.name;
    }

    // Check data centers
    const dataCenters = await getCachedDataCenters(env, logger);
    const matchedDc = dataCenters.find((dc) => dc.name.toLowerCase() === normalizedInput);
    if (matchedDc) {
      return matchedDc.name;
    }

    return null;
  } catch (error) {
    if (logger) {
      logger.error('Failed to validate world', error instanceof Error ? error : undefined);
    }
    return null;
  }
}

/**
 * Get autocomplete suggestions for world/datacenter
 */
export async function getWorldAutocomplete(
  env: Env,
  query: string,
  logger?: ExtendedLogger
): Promise<Array<{ name: string; value: string }>> {
  const normalizedQuery = query.toLowerCase().trim();

  try {
    const [worlds, dataCenters] = await Promise.all([
      getCachedWorlds(env, logger),
      getCachedDataCenters(env, logger),
    ]);

    const suggestions: Array<{ name: string; value: string }> = [];

    // Add matching data centers first (broader scope)
    for (const dc of dataCenters) {
      if (dc.name.toLowerCase().includes(normalizedQuery)) {
        suggestions.push({
          name: `${dc.name} (${dc.region} Data Center)`,
          value: dc.name,
        });
      }
    }

    // Add matching worlds
    for (const world of worlds) {
      if (world.name.toLowerCase().includes(normalizedQuery)) {
        suggestions.push({
          name: world.name,
          value: world.name,
        });
      }
    }

    // Limit to 25 for Discord autocomplete
    return suggestions.slice(0, 25);
  } catch (error) {
    if (logger) {
      logger.error('Failed to get world autocomplete', error instanceof Error ? error : undefined);
    }
    return [];
  }
}
