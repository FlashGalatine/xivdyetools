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
export type KVValueType = 'text' | 'json' | 'arrayBuffer' | 'stream';

/** Real KV rejects an `expirationTtl` below this many seconds. */
export const KV_MIN_EXPIRATION_TTL = 60;

/** Real KV never returns more than this many keys in one `list()` page. */
export const KV_MAX_LIST_PAGE = 1000;

export interface MockKVNamespace {
  get: (key: string, options?: KVValueType | { type?: KVValueType }) => Promise<string | null>;
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
/**
 * Opaque-ish page cursor. Deliberately NOT the bare key name, so a test that
 * treats the cursor as opaque (passes it straight back) is the only thing that
 * works -- the same contract real KV gives.
 */
const CURSOR_PREFIX = 'mockkv-after:';

function encodeListCursor(lastKey: string): string {
  return `${CURSOR_PREFIX}${lastKey}`;
}

function decodeListCursor(cursor: string | undefined): string | null {
  if (!cursor || !cursor.startsWith(CURSOR_PREFIX)) return null;
  return cursor.slice(CURSOR_PREFIX.length);
}

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
    get: async (key: string, options?: KVValueType | { type?: KVValueType }) => {
      // Real KV accepts both `get(key, 'json')` and `get(key, { type: 'json' })`.
      // The mock used to read `options?.type` only, so the bare-string form
      // silently returned the raw string and a consumer using it looked correct
      // in tests while getting an unparsed value.
      const valueType = typeof options === 'string' ? options : options?.type;
      // Capture timestamp once to prevent race conditions with mocked time
      const nowSeconds = Date.now() / 1000;

      if (isExpiredAt(key, nowSeconds)) {
        cleanupKey(key);
        return null;
      }

      const value = store.get(key) ?? null;

      if (value === null) return null;

      if (valueType === 'json') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }

      return value;
    },

    put: async (key: string, value: string, options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }) => {
      // Validate BEFORE storing: a rejected put must not leave the value
      // behind. The old guard was `if (options?.expirationTtl)`, so 0 was
      // falsy and silently became "no TTL", and any positive value was
      // accepted -- real KV REJECTS anything under 60 seconds, so a consumer
      // computing a sub-minute TTL passed every test and threw in production.
      if (
        options?.expirationTtl !== undefined &&
        (!Number.isFinite(options.expirationTtl) ||
          options.expirationTtl < KV_MIN_EXPIRATION_TTL)
      ) {
        throw new Error(
          `Invalid expiration_ttl of ${options.expirationTtl}. Expiration TTL must be at least ${KV_MIN_EXPIRATION_TTL}.`,
        );
      }

      store.set(key, value);

      // Handle TTL
      if (options?.expirationTtl !== undefined) {
        // expirationTtl is seconds from now
        ttls.set(key, Math.floor(Date.now() / 1000) + options.expirationTtl);
      } else if (options?.expiration !== undefined) {
        // expiration is absolute Unix timestamp
        ttls.set(key, options.expiration);
      } else {
        ttls.delete(key);
      }

      // Handle metadata. A put REPLACES the whole entry, so metadata absent
      // from this call must be cleared -- leaving the previous value in place
      // made the mock more forgiving than KV.
      if (options?.metadata !== undefined) {
        metadata.set(key, options.metadata);
      } else {
        metadata.delete(key);
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
      // Real KV caps a page at 1000 however large a limit you ask for.
      const limit = Math.min(options?.limit ?? KV_MAX_LIST_PAGE, KV_MAX_LIST_PAGE);
      const expiredKeys: string[] = [];

      // BUG-098: the mock used to return `cursor: undefined` unconditionally,
      // so an un-paginated consumer (`await kv.list({ prefix })` with no cursor
      // loop) looked correct in tests and truncated at 1000 keys in production
      // -- which is exactly what hid BUG-035 in discord-worker's /stats. It
      // also emitted `list_complete: false` WITH no cursor when the page was
      // exactly full, a state real KV never returns, so a CORRECT cursor loop
      // would re-read page one forever against it.
      const resumeAfter = decodeListCursor(options?.cursor);
      let skipping = resumeAfter !== null;
      let truncated = false;

      for (const [key] of store.entries()) {
        if (!key.startsWith(prefix)) continue;

        if (isExpiredAt(key, nowSeconds)) {
          // Collect expired keys for cleanup after iteration
          expiredKeys.push(key);
          continue;
        }

        if (skipping) {
          if (key === resumeAfter) skipping = false;
          continue;
        }

        if (keys.length >= limit) {
          truncated = true;
          break;
        }

        keys.push({
          name: key,
          expiration: ttls.get(key),
          metadata: metadata.get(key),
        });
      }

      // Clean up expired keys after iteration to avoid modifying map during iteration
      for (const key of expiredKeys) {
        cleanupKey(key);
      }

      if (truncated && keys.length > 0) {
        return {
          keys,
          list_complete: false,
          cursor: encodeListCursor(keys[keys.length - 1].name),
        };
      }

      return { keys, list_complete: true };
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
