/**
 * Cache configuration constants for different endpoint types
 */

import type { CacheConfig } from '../types/cache';

/**
 * Cache configurations by endpoint type
 *
 * - aggregated: Price data that changes frequently (5 min TTL)
 * - dataCenters: Static data that rarely changes (24 hour TTL)
 * - worlds: Static data that rarely changes (24 hour TTL)
 */
export const CACHE_CONFIGS = {
  /**
   * Price data from /api/v2/aggregated/:datacenter/:itemIds
   * - 5 minute TTL (prices update frequently)
   * - 2 minute SWR window (serve stale while refreshing)
   */
  aggregated: {
    cacheTtl: 300, // 5 minutes
    swrWindow: 120, // 2 minutes
    keyPrefix: 'aggregated',
  },

  /**
   * Data centers list from /api/v2/data-centers
   * - 24 hour TTL (very static data)
   * - 6 hour SWR window (can serve quite stale data)
   */
  dataCenters: {
    cacheTtl: 86400, // 24 hours
    swrWindow: 21600, // 6 hours
    keyPrefix: 'data-centers',
  },

  /**
   * Worlds list from /api/v2/worlds
   * - 24 hour TTL (very static data)
   * - 6 hour SWR window (can serve quite stale data)
   */
  worlds: {
    cacheTtl: 86400, // 24 hours
    swrWindow: 21600, // 6 hours
    keyPrefix: 'worlds',
  },
} as const satisfies Record<string, CacheConfig>;

export type CacheConfigKey = keyof typeof CACHE_CONFIGS;
