/**
 * Tests for Mock KV Namespace
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockKV } from '../../src/cloudflare/kv.js';

describe('createMockKV', () => {
  it('creates a mock KV namespace', () => {
    const kv = createMockKV();

    expect(kv.get).toBeDefined();
    expect(kv.put).toBeDefined();
    expect(kv.delete).toBeDefined();
    expect(kv.list).toBeDefined();
    expect(kv.getWithMetadata).toBeDefined();
    expect(kv._store).toBeDefined();
    expect(kv._ttls).toBeDefined();
    expect(kv._metadata).toBeDefined();
    expect(kv._reset).toBeDefined();
  });

  describe('put and get', () => {
    it('stores and retrieves a value', async () => {
      const kv = createMockKV();

      await kv.put('key1', 'value1');
      const result = await kv.get('key1');

      expect(result).toBe('value1');
    });

    it('returns null for missing key', async () => {
      const kv = createMockKV();

      const result = await kv.get('nonexistent');

      expect(result).toBeNull();
    });

    it('overwrites existing value', async () => {
      const kv = createMockKV();

      await kv.put('key', 'first');
      await kv.put('key', 'second');
      const result = await kv.get('key');

      expect(result).toBe('second');
    });
  });

  describe('get with options', () => {
    it('returns text by default', async () => {
      const kv = createMockKV();
      await kv.put('key', '{"data":"test"}');

      const result = await kv.get('key');

      expect(result).toBe('{"data":"test"}');
    });

    it('returns text with type: text', async () => {
      const kv = createMockKV();
      await kv.put('key', '{"data":"test"}');

      const result = await kv.get('key', { type: 'text' });

      expect(result).toBe('{"data":"test"}');
    });

    it('parses JSON with type: json', async () => {
      const kv = createMockKV();
      await kv.put('key', '{"data":"test"}');

      const result = await kv.get('key', { type: 'json' });

      expect(result).toEqual({ data: 'test' });
    });

    it('returns raw string for invalid JSON with type: json', async () => {
      const kv = createMockKV();
      await kv.put('key', 'not-json');

      const result = await kv.get('key', { type: 'json' });

      expect(result).toBe('not-json');
    });
  });

  describe('TTL handling', () => {
    it('respects expirationTtl', async () => {
      const kv = createMockKV();

      await kv.put('key', 'value', { expirationTtl: 60 });

      // Should be accessible immediately
      const result = await kv.get('key');
      expect(result).toBe('value');

      // TTL should be tracked
      const ttl = kv._ttls.get('key');
      expect(ttl).toBeDefined();
      expect(ttl).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('respects expiration timestamp', async () => {
      const kv = createMockKV();
      const futureExpiration = Math.floor(Date.now() / 1000) + 3600;

      await kv.put('key', 'value', { expiration: futureExpiration });

      const result = await kv.get('key');
      expect(result).toBe('value');

      const ttl = kv._ttls.get('key');
      expect(ttl).toBe(futureExpiration);
    });

    it('returns null for expired key', async () => {
      const kv = createMockKV();

      // Set with past expiration
      await kv.put('key', 'value');
      kv._ttls.set('key', Math.floor(Date.now() / 1000) - 60);

      const result = await kv.get('key');
      expect(result).toBeNull();
    });

    it('deletes expired key from store', async () => {
      const kv = createMockKV();

      await kv.put('key', 'value');
      kv._ttls.set('key', Math.floor(Date.now() / 1000) - 60);

      await kv.get('key');

      expect(kv._store.has('key')).toBe(false);
      expect(kv._ttls.has('key')).toBe(false);
    });

    it('clears TTL when put without expiration', async () => {
      const kv = createMockKV();

      await kv.put('key', 'value', { expirationTtl: 60 });
      await kv.put('key', 'updated');

      expect(kv._ttls.has('key')).toBe(false);
    });
  });

  describe('metadata handling', () => {
    it('stores metadata', async () => {
      const kv = createMockKV();

      await kv.put('key', 'value', { metadata: { author: 'test' } });

      expect(kv._metadata.get('key')).toEqual({ author: 'test' });
    });

    it('retrieves metadata with getWithMetadata', async () => {
      const kv = createMockKV();
      await kv.put('key', 'value', { metadata: { count: 42 } });

      const result = await kv.getWithMetadata<{ count: number }>('key');

      expect(result.value).toBe('value');
      expect(result.metadata).toEqual({ count: 42 });
      expect(result.cacheStatus).toBeNull();
    });

    it('returns null metadata for key without metadata', async () => {
      const kv = createMockKV();
      await kv.put('key', 'value');

      const result = await kv.getWithMetadata('key');

      expect(result.value).toBe('value');
      expect(result.metadata).toBeNull();
    });

    it('returns null values for missing key', async () => {
      const kv = createMockKV();

      const result = await kv.getWithMetadata('nonexistent');

      expect(result.value).toBeNull();
      expect(result.metadata).toBeNull();
    });

    it('handles expired keys in getWithMetadata', async () => {
      const kv = createMockKV();
      await kv.put('key', 'value', { metadata: { test: true } });
      kv._ttls.set('key', Math.floor(Date.now() / 1000) - 60);

      const result = await kv.getWithMetadata('key');

      expect(result.value).toBeNull();
      expect(result.metadata).toBeNull();
    });
  });

  describe('delete', () => {
    it('removes a key', async () => {
      const kv = createMockKV();
      await kv.put('key', 'value');

      await kv.delete('key');

      const result = await kv.get('key');
      expect(result).toBeNull();
    });

    it('removes TTL and metadata', async () => {
      const kv = createMockKV();
      await kv.put('key', 'value', {
        expirationTtl: 60,
        metadata: { test: true },
      });

      await kv.delete('key');

      expect(kv._store.has('key')).toBe(false);
      expect(kv._ttls.has('key')).toBe(false);
      expect(kv._metadata.has('key')).toBe(false);
    });

    it('does not throw for missing key', async () => {
      const kv = createMockKV();

      await expect(kv.delete('nonexistent')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('lists all keys', async () => {
      const kv = createMockKV();
      await kv.put('key1', 'value1');
      await kv.put('key2', 'value2');
      await kv.put('key3', 'value3');

      const result = await kv.list();

      expect(result.keys).toHaveLength(3);
      expect(result.keys.map((k) => k.name)).toContain('key1');
      expect(result.keys.map((k) => k.name)).toContain('key2');
      expect(result.keys.map((k) => k.name)).toContain('key3');
    });

    it('filters by prefix', async () => {
      const kv = createMockKV();
      await kv.put('user:1', 'alice');
      await kv.put('user:2', 'bob');
      await kv.put('session:1', 'data');

      const result = await kv.list({ prefix: 'user:' });

      expect(result.keys).toHaveLength(2);
      expect(result.keys.every((k) => k.name.startsWith('user:'))).toBe(true);
    });

    it('respects limit', async () => {
      const kv = createMockKV();
      for (let i = 0; i < 10; i++) {
        await kv.put(`key${i}`, `value${i}`);
      }

      const result = await kv.list({ limit: 5 });

      expect(result.keys).toHaveLength(5);
      expect(result.list_complete).toBe(false);
    });

    it('indicates list_complete when all keys returned', async () => {
      const kv = createMockKV();
      await kv.put('key1', 'value1');
      await kv.put('key2', 'value2');

      const result = await kv.list();

      expect(result.list_complete).toBe(true);
    });

    it('includes expiration in key info', async () => {
      const kv = createMockKV();
      const expiration = Math.floor(Date.now() / 1000) + 3600;
      await kv.put('key', 'value', { expiration });

      const result = await kv.list();

      expect(result.keys[0].expiration).toBe(expiration);
    });

    it('includes metadata in key info', async () => {
      const kv = createMockKV();
      await kv.put('key', 'value', { metadata: { test: true } });

      const result = await kv.list();

      expect(result.keys[0].metadata).toEqual({ test: true });
    });

    it('excludes expired keys', async () => {
      const kv = createMockKV();
      await kv.put('valid', 'value');
      await kv.put('expired', 'value');
      kv._ttls.set('expired', Math.floor(Date.now() / 1000) - 60);

      const result = await kv.list();

      expect(result.keys).toHaveLength(1);
      expect(result.keys[0].name).toBe('valid');
    });
  });

  describe('_reset', () => {
    it('clears all data', async () => {
      const kv = createMockKV();
      await kv.put('key1', 'value1', {
        expirationTtl: 60,
        metadata: { test: true },
      });
      await kv.put('key2', 'value2');

      kv._reset();

      expect(kv._store.size).toBe(0);
      expect(kv._ttls.size).toBe(0);
      expect(kv._metadata.size).toBe(0);
    });
  });

  describe('internal storage access', () => {
    it('allows direct store access for assertions', async () => {
      const kv = createMockKV();
      await kv.put('key', 'value');

      expect(kv._store.get('key')).toBe('value');
    });

    it('allows direct TTL access', async () => {
      const kv = createMockKV();
      await kv.put('key', 'value', { expirationTtl: 60 });

      const ttl = kv._ttls.get('key')!;
      const expectedTtl = Math.floor(Date.now() / 1000) + 60;
      expect(Math.abs(ttl - expectedTtl)).toBeLessThan(2);
    });
  });

  // BUG-098: the mock used to return `cursor: undefined` unconditionally, so an
  // un-paginated `await kv.list({ prefix })` looked correct in tests and
  // truncated at 1000 keys in production -- which is what hid BUG-035 in
  // discord-worker's /stats preferences. It also emitted `list_complete: false`
  // with no cursor on an exactly-full page, a state real KV never returns, so a
  // CORRECT cursor loop would have spun on page one forever against it.
  describe('list() pagination', () => {
    it('issues a cursor when more keys remain, and completes without one', async () => {
      const kv = createMockKV();
      for (let i = 0; i < 5; i++) {
        await kv.put(`p:${i}`, String(i));
      }

      const page1 = await kv.list({ prefix: 'p:', limit: 2 });
      expect(page1.keys.map((k) => k.name)).toEqual(['p:0', 'p:1']);
      expect(page1.list_complete).toBe(false);
      expect(typeof page1.cursor).toBe('string');

      const page2 = await kv.list({ prefix: 'p:', limit: 2, cursor: page1.cursor });
      expect(page2.keys.map((k) => k.name)).toEqual(['p:2', 'p:3']);
      expect(page2.list_complete).toBe(false);

      const page3 = await kv.list({ prefix: 'p:', limit: 2, cursor: page2.cursor });
      expect(page3.keys.map((k) => k.name)).toEqual(['p:4']);
      expect(page3.list_complete).toBe(true);
      expect(page3.cursor).toBeUndefined();
    });

    it('never reports list_complete:false without a cursor to follow', async () => {
      const kv = createMockKV();
      for (let i = 0; i < 4; i++) {
        await kv.put(`q:${i}`, String(i));
      }

      // Exactly-full page: the old mock said `list_complete: false` here with
      // `cursor: undefined`, which no real KV response can express.
      const page = await kv.list({ prefix: 'q:', limit: 4 });
      expect(page.list_complete).toBe(true);
      expect(page.cursor).toBeUndefined();
    });

    it('drives a standard cursor loop to completion exactly once per key', async () => {
      const kv = createMockKV();
      for (let i = 0; i < 7; i++) {
        await kv.put(`r:${i}`, String(i));
      }

      const seen: string[] = [];
      let cursor: string | undefined;
      let guard = 0;
      for (;;) {
        if (++guard > 20) throw new Error('cursor loop did not terminate');
        const page = await kv.list({ prefix: 'r:', limit: 3, cursor });
        seen.push(...page.keys.map((k) => k.name));
        if (page.list_complete) break;
        cursor = page.cursor;
      }

      expect(seen).toHaveLength(7);
      expect(new Set(seen).size).toBe(7);
    });

    it('caps a page at 1000 even when asked for more', async () => {
      const kv = createMockKV();
      for (let i = 0; i < 1005; i++) {
        await kv.put(`big:${i}`, '1');
      }

      const page = await kv.list({ prefix: 'big:', limit: 5000 });
      expect(page.keys).toHaveLength(1000);
      expect(page.list_complete).toBe(false);
      expect(page.cursor).toBeDefined();
    });
  });

  // pkg-worker-kit-test-utils-09: three ways the mock was more permissive than
  // real KV, each of which lets a consumer pass every test and fail in prod.
  describe('put()/get() fidelity', () => {
    it('rejects an expirationTtl below 60 seconds', async () => {
      const kv = createMockKV();
      await expect(kv.put('k', 'v', { expirationTtl: 30 })).rejects.toThrow(
        /at least 60/,
      );
    });

    it('rejects an expirationTtl of 0 rather than treating it as "no TTL"', async () => {
      const kv = createMockKV();
      await expect(kv.put('k', 'v', { expirationTtl: 0 })).rejects.toThrow(
        /at least 60/,
      );
      expect(kv._store.has('k')).toBe(false);
    });

    it('accepts an expirationTtl of exactly 60', async () => {
      const kv = createMockKV();
      await expect(kv.put('k', 'v', { expirationTtl: 60 })).resolves.toBeUndefined();
    });

    it('clears metadata when a later put omits it', async () => {
      const kv = createMockKV();
      await kv.put('k', 'v1', { metadata: { tag: 'first' } });
      expect(kv._metadata.get('k')).toEqual({ tag: 'first' });

      // Real KV replaces the whole entry; the mock used to leave the old
      // metadata attached to the new value.
      await kv.put('k', 'v2');
      expect(kv._metadata.get('k')).toBeUndefined();

      const withMeta = await kv.getWithMetadata('k');
      expect(withMeta.value).toBe('v2');
      expect(withMeta.metadata).toBeNull();
    });

    it('parses JSON for the bare-string type argument, not just { type }', async () => {
      const kv = createMockKV();
      await kv.put('j', JSON.stringify({ a: 1 }));

      // Real KV accepts both forms; the mock only read `options?.type`, so this
      // one silently returned the raw string.
      expect(await kv.get('j', 'json')).toEqual({ a: 1 });
      expect(await kv.get('j', { type: 'json' })).toEqual({ a: 1 });
      expect(await kv.get('j')).toBe('{"a":1}');
    });
  });
});
