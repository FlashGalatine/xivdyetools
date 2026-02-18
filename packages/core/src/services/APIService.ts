/**
 * @xivdyetools/core - API Service
 *
 * Universalis API integration with caching and debouncing
 * Environment-agnostic with pluggable cache backends
 *
 * @module services/APIService
 */

import type { PriceData, CachedData, Logger } from '../types/index.js';
import { ErrorCode, AppError, NoOpLogger } from '../types/index.js';
import {
  UNIVERSALIS_API_BASE,
  UNIVERSALIS_API_TIMEOUT,
  UNIVERSALIS_API_RETRY_COUNT,
  UNIVERSALIS_API_RETRY_DELAY,
  API_CACHE_TTL,
  API_RATE_LIMIT_DELAY,
  API_CACHE_VERSION,
  API_MAX_RESPONSE_SIZE,
} from '../constants/index.js';
import { retry, sleep, generateChecksum } from '../utils/index.js';

// ============================================================================
// Fetch Client Interface
// ============================================================================

/**
 * Fetch client interface for HTTP requests
 * Implement this for different fetch implementations (global fetch, node-fetch, mocked fetch, etc.)
 *
 * Refactored for testability: Allows injecting mock fetch clients
 */
export interface FetchClient {
  /**
   * Perform HTTP fetch request
   */
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

/**
 * Default fetch client using global fetch API
 */
export class DefaultFetchClient implements FetchClient {
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    return fetch(url, options);
  }
}

// ============================================================================
// Rate Limiter Interface
// ============================================================================

/**
 * Rate limiter interface for controlling request frequency
 * Implement this for different rate limiting strategies
 *
 * Refactored for testability: Allows injecting custom rate limiters or disabling rate limiting for tests
 */
export interface RateLimiter {
  /**
   * Wait if needed to respect rate limits
   */
  waitIfNeeded(): Promise<void>;

  /**
   * Record that a request was made (updates internal state)
   */
  recordRequest(): void;
}

/**
 * Default rate limiter with configurable minimum delay between requests
 */
export class DefaultRateLimiter implements RateLimiter {
  private lastRequestTime: number = 0;

  /**
   * Constructor with optional minimum delay
   * @param minDelay Minimum milliseconds between requests (default: API_RATE_LIMIT_DELAY)
   */
  constructor(private minDelay: number = API_RATE_LIMIT_DELAY) {}

  async waitIfNeeded(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelay) {
      await sleep(this.minDelay - timeSinceLastRequest);
    }
  }

  recordRequest(): void {
    this.lastRequestTime = Date.now();
  }
}

// ============================================================================
// Cache Interface
// ============================================================================

/**
 * Cache backend interface
 * Implement this for different storage backends (localStorage, Redis, Memory, etc.)
 */
export interface ICacheBackend {
  /**
   * Get item from cache
   */
  get(key: string): Promise<CachedData<PriceData> | null> | CachedData<PriceData> | null;

  /**
   * Set item in cache
   */
  set(key: string, value: CachedData<PriceData>): Promise<void> | void;

  /**
   * Delete item from cache
   */
  delete(key: string): Promise<void> | void;

  /**
   * Clear all cache entries
   */
  clear(): Promise<void> | void;

  /**
   * Get all cache keys
   */
  keys(): Promise<string[]> | string[];
}

/**
 * In-memory cache backend (default, no persistence)
 */
export class MemoryCacheBackend implements ICacheBackend {
  private cache: Map<string, CachedData<PriceData>> = new Map();

  get(key: string): CachedData<PriceData> | null {
    return this.cache.get(key) || null;
  }

  set(key: string, value: CachedData<PriceData>): void {
    this.cache.set(key, value);
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// ============================================================================
// Price Extraction Types and Helpers
// ============================================================================

/**
 * Structure for price listing from a specific scope (DC, world, or region)
 */
interface PriceListing {
  price: number;
  worldId?: number;
}

/**
 * Structure for min listing data from Universalis API
 * Contains optional price listings at different scope levels
 */
interface MinListingData {
  dc?: PriceListing;
  world?: PriceListing;
  region?: PriceListing;
}

/**
 * Structure for quality-specific data (NQ or HQ)
 */
interface QualityData {
  minListing?: MinListingData;
}

/**
 * Structure for a single item result from Universalis API
 * CORE-REF-002 FIX: Extracted type to avoid duplication in parseApiResponse/parseBatchApiResponse
 *
 * Note: The `hq` field is retained for API compatibility with Universalis responses,
 * but is not used for dye price extraction since dyes are always NQ in FFXIV.
 */
export interface UniversalisItemResult {
  itemId: number;
  nq?: QualityData;
  hq?: QualityData;
}

/**
 * Result of extracting price from an API item
 */
interface ExtractedPriceInfo {
  price: number | null;
  worldId: number | undefined;
}

/**
 * Extract price and worldId from a Universalis API item result
 * CORE-REF-002 FIX: Centralized price extraction logic used by both single and batch parsing.
 *
 * Priority order (NQ only - dyes in FFXIV are always Normal Quality):
 * 1. Data Center price (preferred for cross-world comparison)
 * 2. World price (fallback)
 * 3. Region price (last resort)
 *
 * Note: HQ prices are intentionally not checked because dyes do not have HQ variants in FFXIV.
 *
 * @param result - The item result from Universalis API
 * @returns Object containing price (or null) and optional worldId
 */
function extractPriceFromApiItem(result: UniversalisItemResult): ExtractedPriceInfo {
  let price: number | null = null;
  let worldId: number | undefined = undefined;

  // Extract NQ prices only (dyes in FFXIV are always NQ - no HQ variants exist)
  // Priority: DC → World → Region
  if (result.nq?.minListing) {
    const listing = result.nq.minListing;
    if (listing.dc?.price) {
      price = listing.dc.price;
      worldId = listing.dc.worldId;
    } else if (listing.world?.price) {
      price = listing.world.price;
      worldId = listing.world.worldId;
    } else if (listing.region?.price) {
      price = listing.region.price;
      worldId = listing.region.worldId;
    }
  }

  return { price, worldId };
}

// ============================================================================
// API Service Class
// ============================================================================

/**
 * Configuration options for APIService
 */
export interface APIServiceOptions {
  /**
   * Cache backend implementation (defaults to memory cache)
   */
  cacheBackend?: ICacheBackend;

  /**
   * Fetch client implementation (defaults to global fetch)
   */
  fetchClient?: FetchClient;

  /**
   * Rate limiter implementation (defaults to standard rate limiting)
   */
  rateLimiter?: RateLimiter;

  /**
   * Logger for API operations (defaults to NoOpLogger)
   */
  logger?: Logger;

  /**
   * Base URL for the Universalis API (defaults to UNIVERSALIS_API_BASE constant)
   * Use this to route through a CORS proxy when calling from browsers
   *
   * @example
   * // Direct API access (server-side or when CORS is not an issue)
   * baseUrl: 'https://universalis.app/api/v2'
   *
   * // Through CORS proxy (browser clients)
   * baseUrl: 'https://universalis-proxy.xivdyetools.workers.dev/api/v2'
   */
  baseUrl?: string;
}

/**
 * Service for Universalis API integration
 * Handles price data fetching with caching and debouncing
 *
 * Refactored for testability: Supports dependency injection of cache, fetch client, and rate limiter
 *
 * @example
 * // With default implementations (memory cache, global fetch, standard rate limiting)
 * const apiService = new APIService();
 *
 * // With custom cache backend (e.g., Redis)
 * const redisCache = new RedisCacheBackend(redisClient);
 * const apiService = new APIService(redisCache);
 *
 * // With custom fetch client for testing
 * const mockFetch = new MockFetchClient();
 * const apiService = new APIService(undefined, mockFetch);
 *
 * // With custom rate limiter (e.g., no rate limiting for tests)
 * const noRateLimit = new NoOpRateLimiter();
 * const apiService = new APIService(undefined, undefined, noRateLimit);
 *
 * // Fetch price data
 * const priceData = await apiService.getPriceData(itemID, worldID, dataCenterID);
 *
 * // With custom logger for debugging
 * import { ConsoleLogger } from 'xivdyetools-core';
 * const apiService = new APIService({ logger: ConsoleLogger });
 *
 * // With custom base URL (e.g., CORS proxy for browser clients)
 * const apiService = new APIService({
 *   baseUrl: 'https://universalis-proxy.xivdyetools.workers.dev/api/v2'
 * });
 */
export class APIService {
  private cache: ICacheBackend;
  private fetchClient: FetchClient;
  private rateLimiter: RateLimiter;
  private pendingRequests: Map<string, Promise<PriceData | null>> = new Map();
  private readonly logger: Logger;
  private readonly baseUrl: string;

  /**
   * Constructor with optional dependency injection
   * @param options Configuration options or legacy cache backend
   */
  constructor(
    options?: ICacheBackend | APIServiceOptions,
    fetchClient?: FetchClient,
    rateLimiter?: RateLimiter
  ) {
    // Support both legacy positional arguments and new options object
    // Check for any known options property to detect options-based API
    if (options && this.isOptionsObject(options)) {
      // New options-based API
      const opts = options;
      this.cache = opts.cacheBackend ?? new MemoryCacheBackend();
      this.fetchClient = opts.fetchClient ?? new DefaultFetchClient();
      this.rateLimiter = opts.rateLimiter ?? new DefaultRateLimiter();
      this.logger = opts.logger ?? NoOpLogger;
      this.baseUrl = opts.baseUrl ?? UNIVERSALIS_API_BASE;
    } else {
      // Legacy positional arguments API
      this.cache = (options as ICacheBackend) ?? new MemoryCacheBackend();
      this.fetchClient = fetchClient ?? new DefaultFetchClient();
      this.rateLimiter = rateLimiter ?? new DefaultRateLimiter();
      this.logger = NoOpLogger;
      this.baseUrl = UNIVERSALIS_API_BASE;
    }
  }

  /**
   * Type guard to check if the options parameter is an APIServiceOptions object
   * Checks for any known property of APIServiceOptions
   */
  private isOptionsObject(options: unknown): options is APIServiceOptions {
    if (!options || typeof options !== 'object') return false;
    const obj = options as Record<string, unknown>;
    return (
      'logger' in obj ||
      'cacheBackend' in obj ||
      'baseUrl' in obj ||
      'fetchClient' in obj ||
      'rateLimiter' in obj
    );
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Get price from cache if available and not expired
   * Validates cache version and checksum
   *
   * ERROR-001: On cache backend errors, logs and returns null to fall through to API fetch.
   * This prevents cache failures from blocking price lookups.
   */
  private async getCachedPrice(cacheKey: string): Promise<PriceData | null> {
    let cached;
    try {
      cached = await this.cache.get(cacheKey);
    } catch (error) {
      // ERROR-001: Log cache backend error and fall through to API fetch
      // This distinguishes "cache broken" from "cache miss" in logs
      this.logger.error(
        `Cache backend error for key ${cacheKey}: ${error instanceof Error ? error.message : 'Unknown error'}. Falling through to API fetch.`
      );
      return null;
    }

    if (!cached) {
      return null;
    }

    // Check cache version
    if (cached.version && cached.version !== API_CACHE_VERSION) {
      await this.cache.delete(cacheKey);
      return null;
    }

    // Check if cache has expired
    if (Date.now() - cached.timestamp > cached.ttl) {
      await this.cache.delete(cacheKey);
      return null;
    }

    // Validate checksum if present
    if (cached.checksum) {
      const computedChecksum = generateChecksum(cached.data);
      if (computedChecksum !== cached.checksum) {
        this.logger.warn(`Cache corruption detected for key: ${cacheKey}`);
        await this.cache.delete(cacheKey);
        return null;
      }
    }

    return cached.data;
  }

  /**
   * Set price in cache with version and checksum
   */
  private async setCachedPrice(cacheKey: string, data: PriceData): Promise<void> {
    const checksum = generateChecksum(data);
    await this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: API_CACHE_TTL,
      version: API_CACHE_VERSION,
      checksum,
    });
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.cache.clear();
    this.logger.info('Price cache cleared');
  }

  /**
   * Get cache stats
   */
  async getCacheStats(): Promise<{ size: number; keys: string[] }> {
    const keys = await this.cache.keys();
    return { size: keys.length, keys };
  }

  // ============================================================================
  // API Calls
  // ============================================================================

  /**
   * Fetch price data for a dye from Universalis API
   * Implements caching, debouncing, and retry logic
   *
   * CORE-BUG-001/002 FIX: Uses atomic deduplication pattern to prevent race conditions.
   * The promise is stored in the map BEFORE the async operation begins, ensuring that
   * concurrent calls will always see the pending request even if they arrive during
   * the cache check phase.
   */
  async getPriceData(
    itemID: number,
    worldID?: number,
    dataCenterID?: string
  ): Promise<PriceData | null> {
    // Build cache key first (synchronous)
    const cacheKey = this.buildCacheKey(itemID, worldID, dataCenterID);

    // CORE-BUG-001 FIX: Check pending requests BEFORE any async operations
    // This prevents the race condition where two calls both pass the pending check
    // before either sets their promise in the map
    const existingRequest = this.pendingRequests.get(cacheKey);
    if (existingRequest) {
      this.logger.info(`Using pending request for item ${itemID}`);
      return existingRequest;
    }

    // CORE-BUG-001 FIX: Create and store the promise SYNCHRONOUSLY before starting
    // any async work. We use a deferred promise pattern to ensure the map entry
    // exists before we await anything.
    let resolvePromise: (value: PriceData | null) => void;

    const promise = new Promise<PriceData | null>((resolve) => {
      resolvePromise = resolve;
      // Note: We don't use reject because getPriceData returns null on error
      // to maintain existing API behavior (non-throwing)
    });

    // Store immediately - this is synchronous and happens before any await
    this.pendingRequests.set(cacheKey, promise);

    try {
      // Now we can safely do async operations
      const cached = await this.getCachedPrice(cacheKey);
      if (cached) {
        this.logger.info(`Price cache hit for item ${itemID}`);
        this.pendingRequests.delete(cacheKey);
        resolvePromise!(cached);
        return cached;
      }

      // Fetch from API
      const data = await this.fetchPriceData(itemID, worldID, dataCenterID);

      // CORE-BUG-002 FIX: Always delete from pending map before resolving/rejecting
      // This ensures cleanup happens in a predictable order
      this.pendingRequests.delete(cacheKey);

      if (data) {
        await this.setCachedPrice(cacheKey, data);
      }

      resolvePromise!(data);
      return data;
    } catch (error) {
      // CORE-BUG-002 FIX: Clean up on error path as well
      this.pendingRequests.delete(cacheKey);
      this.logger.error('Failed to fetch price data', error);

      // Resolve with null instead of rejecting to maintain existing behavior
      // where errors return null rather than throwing
      resolvePromise!(null);
      return null;
    }
  }

  /**
   * Internal method to fetch price data from API
   */
  private async fetchPriceData(
    itemID: number,
    worldID?: number,
    dataCenterID?: string
  ): Promise<PriceData | null> {
    // Rate limiting: use injected rate limiter
    await this.rateLimiter.waitIfNeeded();
    this.rateLimiter.recordRequest();

    // Build API URL
    const url = this.buildApiUrl(itemID, worldID, dataCenterID);

    try {
      const data = await retry(
        () => this.fetchWithTimeout(url, UNIVERSALIS_API_TIMEOUT),
        UNIVERSALIS_API_RETRY_COUNT,
        UNIVERSALIS_API_RETRY_DELAY,
        this.logger
      );

      if (!data) {
        return null;
      }

      // Parse and validate response
      return this.parseApiResponse(data, itemID);
    } catch (error) {
      // SECURITY: Log detailed error internally but provide sanitized message to callers
      // This prevents exposing internal API structure or upstream error details
      this.logger.error(
        `Failed to fetch price data for item ${itemID}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      throw new AppError(
        ErrorCode.API_CALL_FAILED,
        `Failed to fetch price data for item ${itemID}`,
        'warning'
      );
    }
  }

  /**
   * Fetch batch price data from API for multiple items in a single request
   * This is more efficient than making individual requests for each item
   *
   * @param itemIDs - Array of item IDs to fetch prices for
   * @param dataCenterID - Optional data center ID (e.g., "Crystal")
   * @returns Map of itemID -> PriceData for all successfully fetched items
   */
  private async fetchBatchPriceData(
    itemIDs: number[],
    dataCenterID?: string
  ): Promise<Map<number, PriceData>> {
    if (itemIDs.length === 0) {
      return new Map();
    }

    // Rate limiting: single request for the batch
    await this.rateLimiter.waitIfNeeded();
    this.rateLimiter.recordRequest();

    // Build batch API URL
    const url = this.buildBatchApiUrl(itemIDs, dataCenterID);

    try {
      const data = await retry(
        () => this.fetchWithTimeout(url, UNIVERSALIS_API_TIMEOUT),
        UNIVERSALIS_API_RETRY_COUNT,
        UNIVERSALIS_API_RETRY_DELAY,
        this.logger
      );

      if (!data) {
        return new Map();
      }

      // Parse batch response
      return this.parseBatchApiResponse(data);
    } catch (error) {
      this.logger.error(
        `Failed to fetch batch price data for ${itemIDs.length} items: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      return new Map();
    }
  }

  /**
   * Fetch with timeout and size limits
   * Uses injected fetch client for better testability
   * CORE-REF-002 FIX: Return type now uses UniversalisItemResult for consistency
   */
  private async fetchWithTimeout(
    url: string,
    timeoutMs: number
  ): Promise<{ results?: UniversalisItemResult[] }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await this.fetchClient.fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        throw new Error('Invalid content type: expected application/json');
      }

      // Check content-length header if available
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (!isNaN(size) && size > API_MAX_RESPONSE_SIZE) {
          throw new Error(
            `Response too large: ${size} bytes (max: ${API_MAX_RESPONSE_SIZE} bytes)`
          );
        }
      }

      // Read response text and validate size
      const text = await response.text();
      if (text.length > API_MAX_RESPONSE_SIZE) {
        throw new Error(
          `Response too large: ${text.length} bytes (max: ${API_MAX_RESPONSE_SIZE} bytes)`
        );
      }

      // Parse JSON with error handling
      try {
        return JSON.parse(text) as { results?: UniversalisItemResult[] };
      } catch (parseError) {
        throw new Error(
          `Invalid JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse and validate API response
   * CORE-REF-002 FIX: Now uses shared extractPriceFromApiItem() helper
   */
  private parseApiResponse(
    data: { results?: UniversalisItemResult[] },
    itemID: number
  ): PriceData | null {
    try {
      // Validate response structure
      if (!data || typeof data !== 'object') {
        this.logger.warn(`Invalid API response structure for item ${itemID}`);
        return null;
      }

      // Parse aggregated endpoint response format
      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        this.logger.warn(`No price data available for item ${itemID}`);
        return null;
      }

      const result = data.results[0];
      if (!result || typeof result !== 'object') {
        this.logger.warn(`Invalid result structure for item ${itemID}`);
        return null;
      }

      // Validate itemId type and match
      if (typeof result.itemId !== 'number' || result.itemId !== itemID) {
        this.logger.warn(`Item ID mismatch: expected ${itemID}, got ${result.itemId}`);
        return null;
      }

      // CORE-REF-002 FIX: Use shared price extraction helper
      const { price, worldId } = extractPriceFromApiItem(result);

      if (!price) {
        this.logger.warn(`No price data available for item ${itemID}`);
        return null;
      }

      return {
        itemID,
        currentAverage: Math.round(price),
        currentMinPrice: Math.round(price), // Using same price for all fields
        currentMaxPrice: Math.round(price),
        lastUpdate: Date.now(),
        worldId,
      };
    } catch (error) {
      this.logger.error(`Failed to parse price data for item ${itemID}`, error);
      return null;
    }
  }

  /**
   * Parse batch API response containing multiple items
   * Returns a Map of itemID -> PriceData for all successfully parsed items
   * CORE-REF-002 FIX: Now uses shared extractPriceFromApiItem() helper
   */
  private parseBatchApiResponse(data: {
    results?: UniversalisItemResult[];
    failedItems?: number[];
  }): Map<number, PriceData> {
    const results = new Map<number, PriceData>();

    try {
      // Validate response structure
      if (!data || typeof data !== 'object') {
        this.logger.warn('Invalid batch API response structure');
        return results;
      }

      if (!data.results || !Array.isArray(data.results)) {
        this.logger.warn('No results array in batch API response');
        return results;
      }

      // Parse each item in the results array
      for (const result of data.results) {
        if (!result || typeof result !== 'object' || typeof result.itemId !== 'number') {
          continue;
        }

        const itemID = result.itemId;

        // CORE-REF-002 FIX: Use shared price extraction helper
        const { price, worldId } = extractPriceFromApiItem(result);

        if (price) {
          results.set(itemID, {
            itemID,
            currentAverage: Math.round(price),
            currentMinPrice: Math.round(price),
            currentMaxPrice: Math.round(price),
            lastUpdate: Date.now(),
            worldId,
          });
        }
      }

      // Log any failed items
      if (data.failedItems && data.failedItems.length > 0) {
        this.logger.warn(
          `Batch request had ${data.failedItems.length} failed items: ${data.failedItems.join(', ')}`
        );
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to parse batch price data', error);
      return results;
    }
  }

  /**
   * Build API URL for item price query
   */
  private buildApiUrl(itemID: number, _worldID?: number, dataCenterID?: string): string {
    // Universalis API endpoint: /api/v2/aggregated/{dataCenter or worldName}/{itemIDs}
    // Note: worldID parameter reserved for future use (world-specific queries)
    // Sanitize dataCenterID to prevent URL path injection
    const pathSegment = dataCenterID ? this.sanitizeDataCenterId(dataCenterID) : 'universal';
    return `${this.baseUrl}/aggregated/${pathSegment}/${itemID}`;
  }

  /**
   * Build API URL for batch item price query
   * Universalis supports comma-separated item IDs in a single request
   * Example: /api/v2/aggregated/Crystal/5729,5730,5731
   *
   * INPUT-001: Added validation for array contents and length
   */
  private buildBatchApiUrl(itemIDs: number[], dataCenterID?: string): string {
    // INPUT-001: Validate array is not empty
    if (!itemIDs || itemIDs.length === 0) {
      throw new AppError(ErrorCode.INVALID_INPUT, 'itemIDs array cannot be empty', 'warning');
    }

    // INPUT-001: Validate array size (Universalis recommends max 100 items per request)
    if (itemIDs.length > 100) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        `Cannot fetch more than 100 items in one batch (got ${itemIDs.length})`,
        'warning'
      );
    }

    // INPUT-001: Validate each item ID is a positive integer
    const invalidIds = itemIDs.filter((id) => !Number.isInteger(id) || id < 1);
    if (invalidIds.length > 0) {
      throw new AppError(
        ErrorCode.INVALID_INPUT,
        `Invalid item IDs: all IDs must be positive integers (invalid: ${invalidIds.slice(0, 5).join(', ')}${invalidIds.length > 5 ? '...' : ''})`,
        'warning'
      );
    }

    // Sanitize dataCenterID to prevent URL path injection
    const pathSegment = dataCenterID ? this.sanitizeDataCenterId(dataCenterID) : 'universal';
    // Join item IDs with commas for batch request
    const itemsSegment = itemIDs.join(',');
    return `${this.baseUrl}/aggregated/${pathSegment}/${itemsSegment}`;
  }

  /**
   * Sanitize datacenter ID to prevent cache key injection.
   * Only allows alphanumeric characters (a-z, A-Z, 0-9).
   */
  private sanitizeDataCenterId(dataCenterID: string): string {
    return dataCenterID.replace(/[^a-zA-Z0-9]/g, '');
  }

  /**
   * Build cache key from parameters
   * SECURITY: Uses type prefixes to prevent cache key collisions
   * Format: itemID:type:value where type is 'dc', 'world', or 'global'
   * This prevents crafted dataCenterID values from colliding with other key patterns
   */
  private buildCacheKey(itemID: number, worldID?: number, dataCenterID?: string): string {
    const parts: (string | number)[] = [itemID];

    if (dataCenterID) {
      // Type prefix 'dc' ensures datacenter keys don't collide with world/global keys
      const sanitized = this.sanitizeDataCenterId(dataCenterID);
      parts.push('dc', sanitized);
    } else if (worldID) {
      // Type prefix 'world' ensures world keys don't collide with datacenter/global keys
      parts.push('world', worldID);
    } else {
      parts.push('global');
    }

    // Use colon delimiter (not in sanitized values) for unambiguous parsing
    return parts.join(':');
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Fetch prices for multiple items (global/universal pricing)
   * PERFORMANCE: Uses batched API requests to minimize rate limiting
   *
   * Strategy:
   * 1. Check cache for each item
   * 2. Collect uncached items
   * 3. Fetch uncached items in a single batched request
   * 4. Store fetched items in cache
   */
  async getPricesForItems(itemIDs: number[]): Promise<Map<number, PriceData>> {
    const results = new Map<number, PriceData>();
    const uncachedItemIDs: number[] = [];

    // Step 1: Check cache for each item (in parallel for async backends)
    const cacheChecks = await Promise.all(
      itemIDs.map(async (itemID) => {
        const cacheKey = this.buildCacheKey(itemID);
        const cached = await this.getCachedPrice(cacheKey);
        return { itemID, cached };
      })
    );

    for (const { itemID, cached } of cacheChecks) {
      if (cached) {
        results.set(itemID, cached);
      } else {
        uncachedItemIDs.push(itemID);
      }
    }

    // Step 2: If all items are cached, return immediately
    if (uncachedItemIDs.length === 0) {
      this.logger.debug(`All ${itemIDs.length} items found in cache`);
      return results;
    }

    this.logger.debug(`Fetching ${uncachedItemIDs.length} uncached items (${results.size} cached)`);

    // Step 3: Fetch uncached items in a single batched request
    const batchResults = await this.fetchBatchPriceData(uncachedItemIDs);

    // Step 4: Store fetched items in cache and add to results
    const cacheWrites: Promise<void>[] = [];
    for (const [itemID, priceData] of batchResults) {
      const cacheKey = this.buildCacheKey(itemID);
      cacheWrites.push(this.setCachedPrice(cacheKey, priceData));
      results.set(itemID, priceData);
    }
    await Promise.all(cacheWrites);

    return results;
  }

  /**
   * Fetch prices for dyes in a specific data center
   * PERFORMANCE: Uses batched API requests to minimize rate limiting
   *
   * Strategy:
   * 1. Check cache for each item
   * 2. Collect uncached items
   * 3. Fetch uncached items in a single batched request
   * 4. Store fetched items in cache
   */
  async getPricesForDataCenter(
    itemIDs: number[],
    dataCenterID: string
  ): Promise<Map<number, PriceData>> {
    const results = new Map<number, PriceData>();
    const uncachedItemIDs: number[] = [];

    // Step 1: Check cache for each item (in parallel for async backends)
    const cacheChecks = await Promise.all(
      itemIDs.map(async (itemID) => {
        const cacheKey = this.buildCacheKey(itemID, undefined, dataCenterID);
        const cached = await this.getCachedPrice(cacheKey);
        return { itemID, cached };
      })
    );

    for (const { itemID, cached } of cacheChecks) {
      if (cached) {
        results.set(itemID, cached);
      } else {
        uncachedItemIDs.push(itemID);
      }
    }

    // Step 2: If all items are cached, return immediately
    if (uncachedItemIDs.length === 0) {
      this.logger.debug(`All ${itemIDs.length} items found in cache for ${dataCenterID}`);
      return results;
    }

    this.logger.debug(
      `Fetching ${uncachedItemIDs.length} uncached items (${results.size} cached) for ${dataCenterID}`
    );

    // Step 3: Fetch uncached items in a single batched request
    const batchResults = await this.fetchBatchPriceData(uncachedItemIDs, dataCenterID);

    // Step 4: Store fetched items in cache and add to results
    const cacheWrites: Promise<void>[] = [];
    for (const [itemID, priceData] of batchResults) {
      const cacheKey = this.buildCacheKey(itemID, undefined, dataCenterID);
      cacheWrites.push(this.setCachedPrice(cacheKey, priceData));
      results.set(itemID, priceData);
    }
    await Promise.all(cacheWrites);

    return results;
  }

  // ============================================================================
  // Health Checks
  // ============================================================================

  /**
   * Check if Universalis API is available
   * Uses injected fetch client
   */
  async isAPIAvailable(): Promise<boolean> {
    try {
      const response = await this.fetchClient.fetch(`${this.baseUrl}/data-centers`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get API status information
   */
  async getAPIStatus(): Promise<{ available: boolean; latency: number }> {
    const start = Date.now();

    try {
      const available = await this.isAPIAvailable();
      const latency = Date.now() - start;

      return { available, latency };
    } catch {
      return { available: false, latency: -1 };
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Format price for display (FFXIV Gil format: 69,420G)
   */
  static formatPrice(price: number): string {
    const formattedNumber = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);

    // Return with small "G" suffix
    return `${formattedNumber}G`;
  }

  /**
   * Calculate price trend (simplified)
   */
  static getPriceTrend(
    currentPrice: number,
    previousPrice: number
  ): { trend: 'up' | 'down' | 'stable'; change: number; changePercent: number } {
    const change = currentPrice - previousPrice;
    const changePercent = previousPrice === 0 ? 0 : (change / previousPrice) * 100;

    let trend: 'up' | 'down' | 'stable';
    if (change > previousPrice * 0.05) {
      trend = 'up';
    } else if (change < -previousPrice * 0.05) {
      trend = 'down';
    } else {
      trend = 'stable';
    }

    return { trend, change, changePercent: Math.round(changePercent * 100) / 100 };
  }
}
