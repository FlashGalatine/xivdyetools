/**
 * CacheService - Manages caching via the Cloudflare Cache API
 *
 * Uses synthetic URLs as cache keys with SWR (stale-while-revalidate) support.
 * Migrated from dual-layer (Cache API + KV) to Cache API-only to eliminate
 * KV write limits on the free tier.
 */

import type { CacheConfig } from '../types/cache';

/**
 * Result from Cache API lookup
 */
interface CacheApiResult {
  response: Response;
  isStale: boolean;
}

/**
 * CacheService handles all caching operations via the Cache API
 */
export class CacheService {
  private cache: Cache | null = null;
  private ctx: ExecutionContext;
  private baseUrl: string;
  private cacheInitPromise: Promise<Cache> | null = null;

  constructor(ctx: ExecutionContext, baseUrl: string) {
    this.ctx = ctx;
    this.baseUrl = baseUrl;
  }

  /**
   * Get the default cache (lazy initialization)
   */
  private async getCache(): Promise<Cache | null> {
    // Cache API is not available in local development
    if (typeof caches === 'undefined') {
      return null;
    }

    if (this.cache) {
      return this.cache;
    }

    if (!this.cacheInitPromise) {
      this.cacheInitPromise = caches.open('universalis-proxy');
    }

    this.cache = await this.cacheInitPromise;
    return this.cache;
  }

  /**
   * Build a Cache API-compatible URL from a cache key
   * Cache API requires full URLs as keys
   */
  private buildCacheUrl(key: string): string {
    return `${this.baseUrl}/__cache/${encodeURIComponent(key)}`;
  }

  /**
   * Get data from Cache API
   * Returns null if not found or expired beyond SWR window
   */
  async get(key: string): Promise<CacheApiResult | null> {
    const cache = await this.getCache();
    if (!cache) return null;

    try {
      const cacheUrl = this.buildCacheUrl(key);
      const cacheRequest = new Request(cacheUrl);

      const cached = await cache.match(cacheRequest);
      if (!cached) return null;

      // Extract cache metadata from headers
      const cachedAt = parseInt(cached.headers.get('X-Cached-At') || '0', 10);
      const ttl = parseInt(cached.headers.get('X-Cache-TTL') || '0', 10);
      const swrWindow = parseInt(cached.headers.get('X-SWR-Window') || '0', 10);

      const now = Date.now();
      const age = (now - cachedAt) / 1000;
      const isExpired = age > ttl;
      const isWithinSwr = age <= ttl + swrWindow;

      // If beyond SWR window, delete from cache and return null
      if (isExpired && !isWithinSwr) {
        this.ctx.waitUntil(cache.delete(cacheRequest));
        return null;
      }

      return {
        response: cached.clone(),
        isStale: isExpired,
      };
    } catch {
      return null;
    }
  }

  /**
   * Store data in Cache API
   */
  async store(key: string, data: unknown, config: CacheConfig): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    try {
      const cacheUrl = this.buildCacheUrl(key);
      const now = Date.now();

      const response = new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          // Set max-age to include SWR window so response isn't evicted too early
          'Cache-Control': `public, max-age=${config.cacheTtl + config.swrWindow}`,
          'X-Cached-At': String(now),
          'X-Cache-TTL': String(config.cacheTtl),
          'X-SWR-Window': String(config.swrWindow),
        },
      });

      await cache.put(new Request(cacheUrl), response);
    } catch {
      // Cache storage failed, continue without it
    }
  }

  /**
   * Store data to cache asynchronously (non-blocking)
   */
  storeAsync(key: string, data: unknown, config: CacheConfig): void {
    this.ctx.waitUntil(
      this.store(key, data, config).catch(() => {})
    );
  }

  /**
   * Delete data from cache
   */
  async deleteEntry(key: string): Promise<void> {
    const cache = await this.getCache();
    if (!cache) return;

    const cacheUrl = this.buildCacheUrl(key);
    await cache.delete(new Request(cacheUrl));
  }

  /**
   * Delete data from cache asynchronously (non-blocking)
   */
  deleteAsync(key: string): void {
    this.ctx.waitUntil(
      this.deleteEntry(key).catch(() => {})
    );
  }
}
