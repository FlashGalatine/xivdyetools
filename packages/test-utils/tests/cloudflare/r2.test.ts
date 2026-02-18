/**
 * Tests for Mock R2 Bucket
 */
import { describe, it, expect } from 'vitest';
import { createMockR2Bucket } from '../../src/cloudflare/r2.js';

describe('createMockR2Bucket', () => {
  it('creates a mock R2 bucket', () => {
    const bucket = createMockR2Bucket();

    expect(bucket.get).toBeDefined();
    expect(bucket.put).toBeDefined();
    expect(bucket.delete).toBeDefined();
    expect(bucket.list).toBeDefined();
    expect(bucket.head).toBeDefined();
    expect(bucket._store).toBeDefined();
    expect(bucket._reset).toBeDefined();
  });

  describe('put', () => {
    it('stores an ArrayBuffer', async () => {
      const bucket = createMockR2Bucket();
      const data = new ArrayBuffer(10);

      const result = await bucket.put('image.png', data);

      expect(result.key).toBe('image.png');
      expect(result.size).toBe(10);
      expect(bucket._store.has('image.png')).toBe(true);
    });

    it('stores a string', async () => {
      const bucket = createMockR2Bucket();

      const result = await bucket.put('test.txt', 'Hello, World!');

      expect(result.key).toBe('test.txt');
      expect(result.size).toBe(13);
    });

    it('stores a Blob', async () => {
      const bucket = createMockR2Bucket();
      const blob = new Blob(['test content'], { type: 'text/plain' });

      const result = await bucket.put('test.txt', blob);

      expect(result.key).toBe('test.txt');
      expect(result.size).toBe(12);
    });

    it('stores a ReadableStream', async () => {
      const bucket = createMockR2Bucket();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('stream data'));
          controller.close();
        },
      });

      const result = await bucket.put('stream.txt', stream);

      expect(result.key).toBe('stream.txt');
      expect(result.size).toBe(11);
    });

    it('includes metadata in result', async () => {
      const bucket = createMockR2Bucket();

      const result = await bucket.put('test.txt', 'data');

      expect(result.uploaded).toBeInstanceOf(Date);
      expect(result.etag).toBeDefined();
      expect(result.httpEtag).toMatch(/^".*"$/);
    });

    it('stores custom metadata', async () => {
      const bucket = createMockR2Bucket();

      const result = await bucket.put('test.txt', 'data', {
        customMetadata: { author: 'test', version: '1.0' },
      });

      expect(result.customMetadata).toEqual({ author: 'test', version: '1.0' });
    });
  });

  describe('get', () => {
    it('returns null for missing object', async () => {
      const bucket = createMockR2Bucket();

      const result = await bucket.get('nonexistent.txt');

      expect(result).toBeNull();
    });

    it('returns object with metadata', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'Hello');

      const result = await bucket.get('test.txt');

      expect(result).not.toBeNull();
      expect(result!.key).toBe('test.txt');
      expect(result!.size).toBe(5);
      expect(result!.uploaded).toBeInstanceOf(Date);
      expect(result!.etag).toBeDefined();
      expect(result!.httpEtag).toBeDefined();
    });

    it('provides arrayBuffer method', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'Hello');

      const result = await bucket.get('test.txt');
      const buffer = await result!.arrayBuffer();

      expect(buffer).toBeInstanceOf(ArrayBuffer);
      expect(buffer.byteLength).toBe(5);
    });

    it('provides text method', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'Hello, World!');

      const result = await bucket.get('test.txt');
      const text = await result!.text();

      expect(text).toBe('Hello, World!');
    });

    it('provides json method', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('data.json', JSON.stringify({ key: 'value' }));

      const result = await bucket.get('data.json');
      const json = await result!.json<{ key: string }>();

      expect(json).toEqual({ key: 'value' });
    });

    it('provides blob method', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'content');

      const result = await bucket.get('test.txt');
      const blob = await result!.blob();

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBe(7);
    });

    it('includes custom metadata', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'data', {
        customMetadata: { tag: 'important' },
      });

      const result = await bucket.get('test.txt');

      expect(result!.customMetadata).toEqual({ tag: 'important' });
    });

    it('returns copy of ArrayBuffer', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'Hello');

      const result = await bucket.get('test.txt');
      const buffer1 = await result!.arrayBuffer();
      const buffer2 = await result!.arrayBuffer();

      expect(buffer1).not.toBe(buffer2);
    });
  });

  describe('delete', () => {
    it('removes a single object', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'data');

      await bucket.delete('test.txt');

      expect(bucket._store.has('test.txt')).toBe(false);
    });

    it('removes multiple objects', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('file1.txt', 'data1');
      await bucket.put('file2.txt', 'data2');
      await bucket.put('file3.txt', 'data3');

      await bucket.delete(['file1.txt', 'file2.txt']);

      expect(bucket._store.has('file1.txt')).toBe(false);
      expect(bucket._store.has('file2.txt')).toBe(false);
      expect(bucket._store.has('file3.txt')).toBe(true);
    });

    it('does not throw for missing object', async () => {
      const bucket = createMockR2Bucket();

      await expect(bucket.delete('nonexistent.txt')).resolves.not.toThrow();
    });
  });

  describe('list', () => {
    it('lists all objects', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('file1.txt', 'a');
      await bucket.put('file2.txt', 'ab');
      await bucket.put('file3.txt', 'abc');

      const result = await bucket.list();

      expect(result.objects).toHaveLength(3);
      expect(result.truncated).toBe(false);
    });

    it('filters by prefix', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('images/photo1.jpg', 'data');
      await bucket.put('images/photo2.jpg', 'data');
      await bucket.put('docs/readme.txt', 'data');

      const result = await bucket.list({ prefix: 'images/' });

      expect(result.objects).toHaveLength(2);
      expect(result.objects.every((o) => o.key.startsWith('images/'))).toBe(true);
    });

    it('respects limit', async () => {
      const bucket = createMockR2Bucket();
      for (let i = 0; i < 10; i++) {
        await bucket.put(`file${i}.txt`, 'data');
      }

      const result = await bucket.list({ limit: 5 });

      expect(result.objects).toHaveLength(5);
      expect(result.truncated).toBe(true);
    });

    it('includes object metadata', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'Hello', {
        customMetadata: { author: 'test' },
      });

      const result = await bucket.list();

      expect(result.objects[0].key).toBe('test.txt');
      expect(result.objects[0].size).toBe(5);
      expect(result.objects[0].uploaded).toBeInstanceOf(Date);
      expect(result.objects[0].customMetadata).toEqual({ author: 'test' });
    });
  });

  describe('head', () => {
    it('returns metadata for existing object', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'Hello, World!');

      const result = await bucket.head('test.txt');

      expect(result).not.toBeNull();
      expect(result!.key).toBe('test.txt');
      expect(result!.size).toBe(13);
      expect(result!.etag).toBeDefined();
      expect(result!.uploaded).toBeInstanceOf(Date);
    });

    it('returns null for missing object', async () => {
      const bucket = createMockR2Bucket();

      const result = await bucket.head('nonexistent.txt');

      expect(result).toBeNull();
    });

    it('includes custom metadata', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'data', {
        customMetadata: { type: 'text' },
      });

      const result = await bucket.head('test.txt');

      expect(result!.customMetadata).toEqual({ type: 'text' });
    });
  });

  describe('_reset', () => {
    it('clears all objects', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('file1.txt', 'data');
      await bucket.put('file2.txt', 'data');

      bucket._reset();

      expect(bucket._store.size).toBe(0);
    });
  });

  describe('internal storage access', () => {
    it('allows direct store access for assertions', async () => {
      const bucket = createMockR2Bucket();
      await bucket.put('test.txt', 'data');

      expect(bucket._store.has('test.txt')).toBe(true);
      expect(bucket._store.get('test.txt')!.meta.key).toBe('test.txt');
    });
  });
});
