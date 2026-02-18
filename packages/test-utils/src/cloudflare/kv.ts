/**
 * Mock KV Namespace for testing Cloudflare Workers
 *
 * Provides a Map-backed implementation of KVNamespace for testing
 * rate limiting, caching, and other KV-dependent functionality.
 *
 * @example
 * ```typescript
 * const kv = createMockKV();
 *
 * // Use in tests
 * const env = { RATE_LIMITS: kv as unknown as KVNamespace };
 *
 * // Pre-populate data
 * await kv.put('user:123:count', '5');
 *
 * // Check stored values
 * expect(kv._store.get('user:123:count')).toBe('5');
 *
 * // Check TTL tracking (if needed)
 * expect(kv._ttls.get('user:123:count')).toBeGreaterThan(Date.now());
 *
 * // Reset between tests
 * kv._reset();
 * ```
 */

/**
 * KV list result item
 */
interface KVListKey {
  name: string;
  expiration?: number;
  metadata?: unknown;
}

/**
 * KV list result
 */
interface KVListResult {
  keys: KVListKey[];
  list_complete: boolean;
  cursor?: string;
}

/**
 * Extended mock KV namespace with test helpers
 */
export interface MockKVNamespace {
  get: (key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }) => Promise<void>;
  delete: (key: string) => Promise<void>;
  list: (options?: { prefix?: string; limit?: number; cursor?: string }) => Promise<KVListResult>;
  getWithMetadata: <T = unknown>(key: string) => Promise<{ value: string | null; metadata: T | null; cacheStatus: null }>;

  /** Internal storage map (for assertions) */
  _store: Map<string, string>;

  /** TTL tracking map - stores expiration timestamps */
  _ttls: Map<string, number>;

  /** Metadata tracking map */
  _metadata: Map<string, unknown>;

  /** Reset all storage */
  _reset: () => void;
}

/**
 * Creates a mock KV namespace for testing
 *
 * The mock uses an in-memory Map for storage and tracks TTLs
 * for expiration testing.
 *
 * @returns A mock KV namespace that can be cast to KVNamespace
 */
export function createMockKV(): MockKVNamespace {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  const metadata = new Map<string, unknown>();

  /**
   * Check if a key has expired using a snapshot timestamp
   * This prevents race conditions when time advances during async operations
   *
   * @param key - The key to check
   * @param nowSeconds - Snapshot of current time in seconds (use Date.now() / 1000)
   */
  const isExpiredAt = (key: string, nowSeconds: number): boolean => {
    const expiration = ttls.get(key);
    if (expiration === undefined) return false;
    return nowSeconds > expiration;
  };

  /**
   * Clean up an expired key from all stores
   */
  const cleanupKey = (key: string): void => {
    store.delete(key);
    ttls.delete(key);
    metadata.delete(key);
  };

  return {
    get: async (key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }) => {
      // Capture timestamp once to prevent race conditions with mocked time
      const nowSeconds = Date.now() / 1000;

      if (isExpiredAt(key, nowSeconds)) {
        cleanupKey(key);
        return null;
      }

      const value = store.get(key) ?? null;

      if (value === null) return null;

      if (options?.type === 'json') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      return value;
    },

    put: async (key: string, value: string, options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }) => {
      store.set(key, value);

      // Handle TTL
      if (options?.expirationTtl) {
        // expirationTtl is seconds from now
        ttls.set(key, Math.floor(Date.now() / 1000) + options.expirationTtl);
      } else if (options?.expiration) {
        // expiration is absolute Unix timestamp
        ttls.set(key, options.expiration);
      } else {
        ttls.delete(key);
      }

      // Handle metadata
      if (options?.metadata !== undefined) {
        metadata.set(key, options.metadata);
      }
    },

    delete: async (key: string) => {
      store.delete(key);
      ttls.delete(key);
      metadata.delete(key);
    },

    list: async (options?: { prefix?: string; limit?: number; cursor?: string }) => {
      // Capture timestamp once for consistent TTL checks across all keys
      const nowSeconds = Date.now() / 1000;
      const keys: KVListKey[] = [];
      const prefix = options?.prefix ?? '';
      const limit = options?.limit ?? 1000;
      const expiredKeys: string[] = [];

      for (const [key, _value] of store.entries()) {
        if (key.startsWith(prefix)) {
          if (isExpiredAt(key, nowSeconds)) {
            // Collect expired keys for cleanup after iteration
            expiredKeys.push(key);
          } else {
            keys.push({
              name: key,
              expiration: ttls.get(key),
              metadata: metadata.get(key),
            });

            if (keys.length >= limit) {
              break;
            }
          }
        }
      }

      // Clean up expired keys after iteration to avoid modifying map during iteration
      for (const key of expiredKeys) {
        cleanupKey(key);
      }

      return {
        keys,
        list_complete: keys.length < limit,
        cursor: undefined,
      };
    },

    getWithMetadata: async <T = unknown>(key: string) => {
      // Capture timestamp once to prevent race conditions with mocked time
      const nowSeconds = Date.now() / 1000;

      if (isExpiredAt(key, nowSeconds)) {
        cleanupKey(key);
        return { value: null, metadata: null, cacheStatus: null };
      }

      return {
        value: store.get(key) ?? null,
        metadata: (metadata.get(key) as T) ?? null,
        cacheStatus: null,
      };
    },

    _store: store,
    _ttls: ttls,
    _metadata: metadata,

    _reset: () => {
      store.clear();
      ttls.clear();
      metadata.clear();
    },
  };
}
