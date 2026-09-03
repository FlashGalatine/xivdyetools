/**
 * Mock R2 Bucket for testing Cloudflare Workers
 *
 * Provides a minimal implementation of R2Bucket for testing
 * image storage and asset retrieval.
 *
 * @example
 * ```typescript
 * const bucket = createMockR2Bucket();
 *
 * // Pre-populate data
 * await bucket.put('image.png', new ArrayBuffer(100));
 *
 * // Use in tests
 * const env = { IMAGES: bucket as unknown as R2Bucket };
 *
 * // Check stored objects
 * expect(bucket._store.has('image.png')).toBe(true);
 *
 * // Reset between tests
 * bucket._reset();
 * ```
 */

/**
 * R2 object metadata
 */
interface R2ObjectMeta {
  key: string;
  size: number;
  uploaded: Date;
  httpEtag: string;
  etag: string;
  customMetadata?: Record<string, string>;
}

/** Subset of R2's httpMetadata this mock tracks. */
export interface MockR2HttpMetadata {
  cacheControl?: string;
  contentType?: string;
}

/**
 * Stored R2 object
 */
interface StoredR2Object {
  body: ArrayBuffer;
  meta: R2ObjectMeta;
  httpMetadata?: MockR2HttpMetadata;
}

/**
 * Mock R2 object returned from get()
 */
export interface MockR2Object {
  key: string;
  size: number;
  uploaded: Date;
  httpEtag: string;
  etag: string;
  customMetadata?: Record<string, string>;
  /**
   * BUG-100: `put()` stored this and nothing read it back, so
   * `presets-api/services/preview-image-service.ts` wrote the `immutable` +
   * `s-maxage=86400` policy that FINDING-018's takedown story depends on and
   * no test could observe it except by reaching into `_store`.
   */
  httpMetadata?: MockR2HttpMetadata;
  arrayBuffer: () => Promise<ArrayBuffer>;
  text: () => Promise<string>;
  json: <T = unknown>() => Promise<T>;
  blob: () => Promise<Blob>;
  /**
   * Copies the stored HTTP metadata onto a Headers object, the way a serving
   * path does. Absent from the mock entirely, so such a path would have thrown
   * only in production.
   */
  writeHttpMetadata: (headers: Headers) => void;
}

/**
 * Extended mock R2 bucket with test helpers
 */
/**
 * Opaque-ish page cursor, deliberately not the bare key. See the matching
 * helper in `cloudflare/kv.ts`.
 */
const CURSOR_PREFIX = 'mockr2-after:';

function encodeListCursor(lastKey: string): string {
  return `${CURSOR_PREFIX}${lastKey}`;
}

function decodeListCursor(cursor: string | undefined): string | null {
  if (!cursor || !cursor.startsWith(CURSOR_PREFIX)) return null;
  return cursor.slice(CURSOR_PREFIX.length);
}

export interface MockR2Bucket {
  get: (key: string) => Promise<MockR2Object | null>;
  put: (
    key: string,
    value: ArrayBuffer | string | ReadableStream | Blob,
    options?: {
      customMetadata?: Record<string, string>;
      httpMetadata?: MockR2HttpMetadata;
    }
  ) => Promise<R2ObjectMeta>;
  delete: (key: string | string[]) => Promise<void>;
  list: (options?: { prefix?: string; limit?: number; cursor?: string }) => Promise<{
    objects: R2ObjectMeta[];
    truncated: boolean;
    cursor?: string;
  }>;
  head: (key: string) => Promise<(R2ObjectMeta & { httpMetadata?: MockR2HttpMetadata }) | null>;

  /** Internal storage map (for assertions) */
  _store: Map<string, StoredR2Object>;

  /** Reset all storage */
  _reset: () => void;
}

/**
 * Creates a mock R2 bucket for testing
 *
 * @returns A mock R2 bucket that can be cast to R2Bucket
 */
export function createMockR2Bucket(): MockR2Bucket {
  const store = new Map<string, StoredR2Object>();

  const generateEtag = (): string => {
    return Math.random().toString(36).substring(2, 15);
  };

  const toArrayBuffer = async (value: ArrayBuffer | string | ReadableStream | Blob): Promise<ArrayBuffer> => {
    if (value instanceof ArrayBuffer) {
      return value;
    }
    if (typeof value === 'string') {
      const encoded = new TextEncoder().encode(value);
      return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
    }
    if (value instanceof Blob) {
      return value.arrayBuffer();
    }
    // ReadableStream
    const chunks: Uint8Array[] = [];
    const reader = value.getReader();
    let done = false;
    while (!done) {
      const result = await reader.read();
      done = result.done;
      if (result.value) {
        chunks.push(result.value);
      }
    }
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    return combined.buffer;
  };

  return {
    get: async (key: string) => {
      const stored = store.get(key);
      if (!stored) return null;

      const { body, meta, httpMetadata } = stored;

      return {
        ...meta,
        httpMetadata,
        arrayBuffer: async () => body.slice(0),
        text: async () => new TextDecoder().decode(body),
        json: async <T = unknown>() => JSON.parse(new TextDecoder().decode(body)) as T,
        blob: async () => new Blob([body]),
        writeHttpMetadata: (headers: Headers) => {
          if (httpMetadata?.contentType !== undefined) {
            headers.set('Content-Type', httpMetadata.contentType);
          }
          if (httpMetadata?.cacheControl !== undefined) {
            headers.set('Cache-Control', httpMetadata.cacheControl);
          }
        },
      };
    },

    put: async (
      key: string,
      value: ArrayBuffer | string | ReadableStream | Blob,
      options?: {
        customMetadata?: Record<string, string>;
        httpMetadata?: MockR2HttpMetadata;
      }
    ) => {
      const body = await toArrayBuffer(value);
      const etag = generateEtag();

      const meta: R2ObjectMeta = {
        key,
        size: body.byteLength,
        uploaded: new Date(),
        httpEtag: `"${etag}"`,
        etag,
        customMetadata: options?.customMetadata,
      };

      store.set(key, { body, meta, httpMetadata: options?.httpMetadata });
      return meta;
    },

    delete: async (key: string | string[]) => {
      const keys = Array.isArray(key) ? key : [key];
      for (const k of keys) {
        store.delete(k);
      }
    },

    list: async (options?: { prefix?: string; limit?: number; cursor?: string }) => {
      const prefix = options?.prefix ?? '';
      const limit = Math.min(options?.limit ?? 1000, 1000);
      const objects: R2ObjectMeta[] = [];

      // Same shape as BUG-098 on the KV mock: this used to report
      // `truncated: true` with `cursor: undefined` on an exactly-full page, a
      // state real R2 never returns, so a correct cursor loop would spin on
      // page one forever.
      const resumeAfter = decodeListCursor(options?.cursor);
      let skipping = resumeAfter !== null;
      let truncated = false;

      for (const [key, { meta }] of store.entries()) {
        if (!key.startsWith(prefix)) continue;

        if (skipping) {
          if (key === resumeAfter) skipping = false;
          continue;
        }

        if (objects.length >= limit) {
          truncated = true;
          break;
        }

        objects.push(meta);
      }

      if (truncated && objects.length > 0) {
        return {
          objects,
          truncated: true,
          cursor: encodeListCursor(objects[objects.length - 1].key),
        };
      }

      return { objects, truncated: false };
    },

    head: async (key: string) => {
      const stored = store.get(key);
      if (!stored) return null;
      return { ...stored.meta, httpMetadata: stored.httpMetadata };
    },

    _store: store,

    _reset: () => {
      store.clear();
    },
  };
}
