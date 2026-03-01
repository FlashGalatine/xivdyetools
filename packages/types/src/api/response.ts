/**
 * @xivdyetools/types - API Response Types
 *
 * Caching types for API data.
 *
 * @module api/response
 */

/**
 * Cached data wrapper with TTL and integrity checking
 *
 * Used for storing data with expiration and optional
 * integrity verification.
 */
export interface CachedData<T> {
  /** The cached data */
  data: T;

  /** When data was cached (ms since epoch) */
  timestamp: number;

  /** Time-to-live in milliseconds */
  ttl: number;

  /** Cache version for invalidation */
  version?: string;

  /** Optional checksum for corruption detection */
  checksum?: string;
}
