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
});
