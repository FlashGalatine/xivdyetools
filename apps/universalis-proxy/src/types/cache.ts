/**
 * Cache type definitions for the Cache API caching system
 */

/**
 * Configuration for a cache entry type
 */
export interface CacheConfig {
  /** Time-to-live for Cache API in seconds */
  cacheTtl: number;
  /** Stale-while-revalidate window in seconds */
  swrWindow: number;
  /** Cache key prefix for namespacing */
  keyPrefix: string;
}

/**
 * Result of a cache lookup operation
 */
export interface CacheResult<T = unknown> {
  /** The cached data */
  data: T;
  /** Where the data was retrieved from */
  source: CacheSource;
  /** Whether the data is stale (within SWR window) */
  isStale: boolean;
}

/**
 * Possible sources for cached data
 */
export type CacheSource = 'cache-api' | 'upstream';

/**
 * Extended environment bindings
 */
export interface Env {
  ENVIRONMENT: string;
  ALLOWED_ORIGINS: string;
  UNIVERSALIS_API_BASE: string;
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
}
