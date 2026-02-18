/**
 * Image Caching Service (V4)
 *
 * Caches generated images (SVG→PNG) using the Cloudflare Cache API.
 * Since identical inputs always produce identical output, this eliminates
 * redundant resvg-wasm renders and reduces response latency.
 *
 * Cache key format: https://cache.xivdyetools.internal/v1/{command}/{sha256-params-hash}
 *
 * @module services/image-cache
 */

import type { ExtendedLogger } from '@xivdyetools/logger';

// ============================================================================
// Constants
// ============================================================================

/** Cache version prefix - bump to invalidate all cached images (e.g., after visual redesign) */
const CACHE_VERSION = 'v1';

/** Base URL for cache keys (synthetic, not actually fetched) */
const CACHE_BASE_URL = 'https://cache.xivdyetools.internal';

/** TTL values in seconds */
export const CACHE_TTL = {
  /** Standard results without market data: 24 hours */
  STANDARD: 86400,
  /** Results with market data: 2 hours (prices shift) */
  WITH_MARKET: 7200,
  /** Static data (swatch grid, dye info): 7 days */
  STATIC: 604800,
  /** Budget results (always has pricing): 2 hours */
  BUDGET: 7200,
} as const;

/** Commands that should never be cached */
const UNCACHEABLE_COMMANDS = new Set([
  'dye_random',      // Non-deterministic output
  'extractor_image', // Unique user-uploaded image
]);

// ============================================================================
// Types
// ============================================================================

/**
 * Cache lookup result
 */
export interface CacheLookupResult {
  /** Whether a cached image was found */
  hit: boolean;
  /** The cached image data (if hit) */
  data?: ArrayBuffer;
  /** Content-Type header (if hit) */
  contentType?: string;
  /** Cache lookup latency in milliseconds */
  latencyMs: number;
}

/**
 * Parameters for building a cache key
 */
export interface CacheKeyParams {
  /** Command name (e.g., 'harmony', 'mixer', 'extractor_color') */
  command: string;
  /** All parameters that affect the rendered output */
  params: Record<string, string | number | boolean | undefined | null>;
}

/**
 * Options for cache storage
 */
export interface CacheStoreOptions {
  /** TTL in seconds (defaults based on command/params) */
  ttl?: number;
  /** Whether the result includes market data */
  hasMarketData?: boolean;
}

// ============================================================================
// Cache Key Generation
// ============================================================================

/**
 * Build a deterministic cache key for an image
 *
 * The key is a synthetic URL that serves as the Cache API key.
 * Parameters are sorted and hashed to ensure identical inputs produce identical keys.
 *
 * @param params - Command and parameters
 * @returns Cache key URL
 */
export async function buildCacheKey(params: CacheKeyParams): Promise<string> {
  const { command, params: inputParams } = params;

  // Filter out undefined/null values and sort keys for determinism
  const sortedEntries = Object.entries(inputParams)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b));

  // Create a deterministic JSON string
  const paramsJson = JSON.stringify(Object.fromEntries(sortedEntries));

  // Hash the params using SHA-256
  const hash = await sha256(paramsJson);

  return `${CACHE_BASE_URL}/${CACHE_VERSION}/${command}/${hash}`;
}

/**
 * Compute SHA-256 hash of a string
 */
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Cache Operations
// ============================================================================

/**
 * Check if a command result should be cached
 *
 * @param command - Command name
 * @returns Whether the command result is cacheable
 */
export function isCacheable(command: string): boolean {
  return !UNCACHEABLE_COMMANDS.has(command);
}

/**
 * Look up a cached image
 *
 * @param cacheKey - Cache key URL from buildCacheKey()
 * @param logger - Optional logger
 * @returns Cache lookup result with hit status and data
 */
export async function lookupCache(
  cacheKey: string,
  logger?: ExtendedLogger
): Promise<CacheLookupResult> {
  const startTime = Date.now();

  try {
    const cache = caches.default;
    const response = await cache.match(cacheKey);

    const latencyMs = Date.now() - startTime;

    if (response) {
      const data = await response.arrayBuffer();
      const contentType = response.headers.get('Content-Type') || 'image/png';

      if (logger) {
        logger.debug('Cache hit', { cacheKey, latencyMs, size: data.byteLength });
      }

      return {
        hit: true,
        data,
        contentType,
        latencyMs,
      };
    }

    if (logger) {
      logger.debug('Cache miss', { cacheKey, latencyMs });
    }

    return {
      hit: false,
      latencyMs,
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;

    if (logger) {
      logger.error('Cache lookup failed', error instanceof Error ? error : undefined, { cacheKey });
    }

    // Fail open - treat errors as cache miss
    return {
      hit: false,
      latencyMs,
    };
  }
}

/**
 * Store an image in the cache
 *
 * This should be called via ctx.waitUntil() to not block the response.
 *
 * @param cacheKey - Cache key URL from buildCacheKey()
 * @param data - Image data to cache
 * @param options - Cache storage options
 * @param logger - Optional logger
 */
export async function storeInCache(
  cacheKey: string,
  data: ArrayBuffer,
  options: CacheStoreOptions = {},
  logger?: ExtendedLogger
): Promise<void> {
  try {
    const cache = caches.default;

    // Determine TTL
    const ttl = options.ttl ?? (options.hasMarketData ? CACHE_TTL.WITH_MARKET : CACHE_TTL.STANDARD);

    const response = new Response(data, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': `s-maxage=${ttl}`,
        'X-Cache-Key': cacheKey,
        'X-Cache-TTL': ttl.toString(),
      },
    });

    await cache.put(cacheKey, response);

    if (logger) {
      logger.debug('Stored in cache', { cacheKey, ttl, size: data.byteLength });
    }
  } catch (error) {
    if (logger) {
      logger.error('Failed to store in cache', error instanceof Error ? error : undefined, { cacheKey });
    }
    // Non-fatal - the request can still succeed without caching
  }
}

/**
 * Delete an image from the cache
 *
 * @param cacheKey - Cache key URL
 * @param logger - Optional logger
 * @returns Whether the deletion was successful
 */
export async function deleteFromCache(
  cacheKey: string,
  logger?: ExtendedLogger
): Promise<boolean> {
  try {
    const cache = caches.default;
    const deleted = await cache.delete(cacheKey);

    if (logger) {
      logger.debug('Deleted from cache', { cacheKey, deleted });
    }

    return deleted;
  } catch (error) {
    if (logger) {
      logger.error('Failed to delete from cache', error instanceof Error ? error : undefined, { cacheKey });
    }
    return false;
  }
}

// ============================================================================
// TTL Helpers
// ============================================================================

/**
 * Get the appropriate TTL for a command
 *
 * @param command - Command name
 * @param hasMarketData - Whether the result includes market data
 * @returns TTL in seconds
 */
export function getTtlForCommand(command: string, hasMarketData: boolean): number {
  // Commands with static data get longer TTL
  if (command === 'swatch_grid' || command === 'dye_info') {
    return hasMarketData ? CACHE_TTL.WITH_MARKET : CACHE_TTL.STATIC;
  }

  // Budget always has pricing
  if (command === 'budget_find') {
    return CACHE_TTL.BUDGET;
  }

  // Standard TTL based on market data presence
  return hasMarketData ? CACHE_TTL.WITH_MARKET : CACHE_TTL.STANDARD;
}

// ============================================================================
// Cache-Aware Rendering Helper
// ============================================================================

/**
 * Cache-aware image rendering wrapper
 *
 * Checks cache before rendering, stores result after rendering.
 * Use this to wrap your SVG→PNG render calls.
 *
 * @param params - Cache key parameters
 * @param renderFn - Function that generates the image
 * @param ctx - Execution context for waitUntil
 * @param options - Cache options
 * @param logger - Optional logger
 * @returns Object with image data and cache status
 */
export async function withCache(
  params: CacheKeyParams,
  renderFn: () => Promise<ArrayBuffer>,
  ctx: ExecutionContext,
  options: CacheStoreOptions = {},
  logger?: ExtendedLogger
): Promise<{ data: ArrayBuffer; cacheStatus: 'hit' | 'miss' | 'skip'; lookupLatencyMs: number }> {
  // Check if cacheable
  if (!isCacheable(params.command)) {
    const data = await renderFn();
    return { data, cacheStatus: 'skip', lookupLatencyMs: 0 };
  }

  // Build cache key
  const cacheKey = await buildCacheKey(params);

  // Check cache
  const lookup = await lookupCache(cacheKey, logger);

  if (lookup.hit && lookup.data) {
    return { data: lookup.data, cacheStatus: 'hit', lookupLatencyMs: lookup.latencyMs };
  }

  // Cache miss - render the image
  const data = await renderFn();

  // Store in cache (non-blocking)
  ctx.waitUntil(
    storeInCache(cacheKey, data, options, logger)
  );

  return { data, cacheStatus: 'miss', lookupLatencyMs: lookup.latencyMs };
}

// ============================================================================
// Cache Key Builders for Specific Commands
// ============================================================================

/**
 * Build cache key params for /harmony command
 */
export function harmonyKeyParams(
  color: string,
  type: string,
  market: boolean,
  world: string | undefined,
  locale: string
): CacheKeyParams {
  return {
    command: 'harmony',
    params: { color, type, market, world, locale },
  };
}

/**
 * Build cache key params for /extractor color command
 */
export function extractorColorKeyParams(
  color: string,
  matching: string,
  count: number,
  market: boolean,
  world: string | undefined,
  locale: string
): CacheKeyParams {
  return {
    command: 'extractor_color',
    params: { color, matching, count, market, world, locale },
  };
}

/**
 * Build cache key params for /gradient command
 */
export function gradientKeyParams(
  start: string,
  end: string,
  mode: string,
  matching: string,
  steps: number,
  market: boolean,
  world: string | undefined,
  locale: string
): CacheKeyParams {
  return {
    command: 'gradient',
    params: { start, end, mode, matching, steps, market, world, locale },
  };
}

/**
 * Build cache key params for /mixer command
 */
export function mixerKeyParams(
  dye1: string,
  dye2: string,
  mode: string,
  matching: string,
  count: number,
  market: boolean,
  world: string | undefined,
  locale: string
): CacheKeyParams {
  return {
    command: 'mixer',
    params: { dye1, dye2, mode, matching, count, market, world, locale },
  };
}

/**
 * Build cache key params for /swatch color command
 */
export function swatchColorKeyParams(
  type: string,
  color: string,
  clan: string | undefined,
  gender: string | undefined,
  matching: string,
  count: number,
  market: boolean,
  world: string | undefined,
  locale: string
): CacheKeyParams {
  return {
    command: 'swatch_color',
    params: { type, color, clan, gender, matching, count, market, world, locale },
  };
}

/**
 * Build cache key params for /swatch grid command
 */
export function swatchGridKeyParams(
  type: string,
  row: number,
  col: number,
  clan: string | undefined,
  gender: string | undefined,
  matching: string,
  count: number,
  market: boolean,
  world: string | undefined,
  locale: string
): CacheKeyParams {
  return {
    command: 'swatch_grid',
    params: { type, row, col, clan, gender, matching, count, market, world, locale },
  };
}

/**
 * Build cache key params for /comparison command
 */
export function comparisonKeyParams(
  dyes: string[],
  locale: string
): CacheKeyParams {
  return {
    command: 'comparison',
    params: {
      dye1: dyes[0],
      dye2: dyes[1],
      dye3: dyes[2],
      dye4: dyes[3],
      locale,
    },
  };
}

/**
 * Build cache key params for /dye info command
 */
export function dyeInfoKeyParams(
  name: string,
  locale: string
): CacheKeyParams {
  return {
    command: 'dye_info',
    params: { name, locale },
  };
}
