/**
 * CacheService - Manages caching via the Cloudflare Cache API
 *
 * Uses synthetic URLs as cache keys with SWR (stale-while-revalidate) support.
 * Migrated from dual-layer (Cache API + KV) to Cache API-only to eliminate
 * KV write limits on the free tier.
 */

import type { CacheConfig } from '../types';

/**
 * Result from Cache API lookup
 */
interface CacheApiResult {
  response: Response;
  isStale: boolean;
}

/**
 * Minimal logging surface `CacheService` accepts (BUG-019).
 *
 * Deliberately not `@xivdyetools/logger`'s `ExtendedLogger` — this app
 * consumes that package only transitively through `@xivdyetools/worker-kit`
 * (see this app's CLAUDE.md), and `CacheService` is constructed outside any
 * Hono context (`cachedFetch`, `CharaRowCache`), so there is no
 * `getLogger(c)` available to pass in. A structural `debug`-only shape keeps
 * this class dependency-free; any logger satisfying it — including a real
 * `ExtendedLogger` — can be passed.
 */
interface CacheServiceLogger {
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * CacheService handles all caching operations via the Cache API
 */
/**
 * Synthetic origin for every Cache API key this service writes (OPT-004).
 *
 * Deliberately not a real host: these URLs are never fetched, they are only
 * cache keys, and a fixed one means the same Universalis answer is stored once
 * regardless of which of the worker's three hostnames the request arrived on.
 */
const CACHE_URL_ORIGIN = 'https://cache.internal';

export class CacheService {
  private cache: Cache | null = null;
  private ctx: ExecutionContext;
  private cacheName: string;
  private cacheInitPromise: Promise<Cache> | null = null;
  private logger?: CacheServiceLogger;

  /**
   * @param cacheName Named Cache API store. The Universalis proxy keeps its
   * original name; other consumers (chara-resolve) pass their own so their
   * synthetic URLs can never collide with proxy entries.
   *
   * OPT-004 dropped the `baseUrl` parameter: keys are built from a fixed
   * synthetic origin now, so the request's hostname no longer partitions the
   * cache. `cacheName` was always the real namespace.
   *
   * @param logger Optional (BUG-019) — debug-logs the SWR-expiry cache
   * delete in `get()` when it fails. No current caller passes one; every
   * construction site is outside a Hono request context.
   */
  constructor(ctx: ExecutionContext, cacheName = 'universalis-proxy', logger?: CacheServiceLogger) {
    this.ctx = ctx;
    this.cacheName = cacheName;
    this.logger = logger;
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
      this.cacheInitPromise = caches.open(this.cacheName);
    }

    this.cache = await this.cacheInitPromise;
    return this.cache;
  }

  /**
   * Build a Cache API-compatible URL from a cache key
   * Cache API requires full URLs as keys
   */
  private buildCacheUrl(key: string): string {
    // OPT-004: this used `this.baseUrl` — the REQUEST's origin — so one
    // Universalis answer was stored under three disjoint namespaces:
    // `data.xivdyetools.app` (web app), the legacy `proxy.…` custom domains,
    // and `https://internal` (the discord-worker service binding). Three
    // upstream fetches per TTL window for one payload. The coalescer key was
    // already origin-free, so a cross-origin waiter took the winner's data and
    // then never populated its own namespace — the miss repeated every window.
    //
    // A fixed synthetic host makes the namespace the cache's own;
    // `caches.open('universalis-proxy')` already keeps it away from
    // `chara-resolve` and `caches.default`.
    return `${CACHE_URL_ORIGIN}/__cache/${encodeURIComponent(key)}`;
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
        // BUG-019: cache.delete() can reject (Cache API storage error); with
        // no .catch() that became an unhandled rejection inside waitUntil(),
        // which the runtime can surface as an uncaught exception in the
        // isolate. Swallow it — a stale entry that fails to evict just gets
        // re-evaluated and re-deleted on the next `get()` for this key.
        this.ctx.waitUntil(
          cache.delete(cacheRequest).catch((error: unknown) => {
            this.logger?.debug('Failed to delete cache entry beyond SWR window', {
              key,
              error: error instanceof Error ? error.message : String(error),
            });
          })
        );
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

}
