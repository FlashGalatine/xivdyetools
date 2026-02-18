/**
 * Tests for Image Caching Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildCacheKey,
  isCacheable,
  lookupCache,
  storeInCache,
  deleteFromCache,
  getTtlForCommand,
  withCache,
  harmonyKeyParams,
  extractorColorKeyParams,
  gradientKeyParams,
  mixerKeyParams,
  swatchColorKeyParams,
  swatchGridKeyParams,
  comparisonKeyParams,
  dyeInfoKeyParams,
  CACHE_TTL,
} from './image-cache.js';

// Mock the global caches object
const mockCacheStore = new Map<string, Response>();
const mockCache = {
  match: vi.fn(async (key: string) => mockCacheStore.get(key) ?? null),
  put: vi.fn(async (key: string, response: Response) => {
    mockCacheStore.set(key, response);
  }),
  delete: vi.fn(async (key: string) => {
    const had = mockCacheStore.has(key);
    mockCacheStore.delete(key);
    return had;
  }),
};

// @ts-expect-error - Mocking global caches
globalThis.caches = {
  default: mockCache,
};

// Mock logger
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
} as never;

// Mock execution context
const mockCtx = {
  waitUntil: vi.fn((promise: Promise<unknown>) => promise),
  passThroughOnException: vi.fn(),
} as unknown as ExecutionContext;

describe('Image Cache Service', () => {
  beforeEach(() => {
    mockCacheStore.clear();
    vi.clearAllMocks();
  });

  describe('buildCacheKey', () => {
    it('generates deterministic keys for same input', async () => {
      const params = {
        command: 'harmony',
        params: { color: '#FF0000', type: 'complementary', locale: 'en' },
      };

      const key1 = await buildCacheKey(params);
      const key2 = await buildCacheKey(params);

      expect(key1).toBe(key2);
      expect(key1).toContain('cache.xivdyetools.internal');
      expect(key1).toContain('/v1/harmony/');
    });

    it('generates different keys for different inputs', async () => {
      const key1 = await buildCacheKey({
        command: 'harmony',
        params: { color: '#FF0000', locale: 'en' },
      });

      const key2 = await buildCacheKey({
        command: 'harmony',
        params: { color: '#00FF00', locale: 'en' },
      });

      expect(key1).not.toBe(key2);
    });

    it('ignores parameter order', async () => {
      const key1 = await buildCacheKey({
        command: 'test',
        params: { a: '1', b: '2', c: '3' },
      });

      const key2 = await buildCacheKey({
        command: 'test',
        params: { c: '3', a: '1', b: '2' },
      });

      expect(key1).toBe(key2);
    });

    it('filters out undefined and null values', async () => {
      const key1 = await buildCacheKey({
        command: 'test',
        params: { a: '1', b: undefined, c: null },
      });

      const key2 = await buildCacheKey({
        command: 'test',
        params: { a: '1' },
      });

      expect(key1).toBe(key2);
    });
  });

  describe('isCacheable', () => {
    it('returns true for cacheable commands', () => {
      expect(isCacheable('harmony')).toBe(true);
      expect(isCacheable('mixer')).toBe(true);
      expect(isCacheable('gradient')).toBe(true);
      expect(isCacheable('comparison')).toBe(true);
      expect(isCacheable('swatch_color')).toBe(true);
    });

    it('returns false for uncacheable commands', () => {
      expect(isCacheable('dye_random')).toBe(false);
      expect(isCacheable('extractor_image')).toBe(false);
    });
  });

  describe('lookupCache', () => {
    it('returns hit: false on cache miss', async () => {
      const result = await lookupCache('https://cache.test/miss', mockLogger);

      expect(result.hit).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('returns hit: true with data on cache hit', async () => {
      const testData = new Uint8Array([1, 2, 3, 4]).buffer;
      mockCacheStore.set('https://cache.test/hit', new Response(testData, {
        headers: { 'Content-Type': 'image/png' },
      }));

      const result = await lookupCache('https://cache.test/hit', mockLogger);

      expect(result.hit).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.contentType).toBe('image/png');
    });

    it('returns hit: false on error (fail open)', async () => {
      mockCache.match = vi.fn().mockRejectedValueOnce(new Error('Cache error'));

      const result = await lookupCache('https://cache.test/error', mockLogger);

      expect(result.hit).toBe(false);
      expect((mockLogger as { error: typeof vi.fn }).error).toHaveBeenCalled();

      // Restore mock
      mockCache.match = vi.fn(async (key: string) => mockCacheStore.get(key) ?? null);
    });
  });

  describe('storeInCache', () => {
    it('stores data with correct headers', async () => {
      const testData = new Uint8Array([1, 2, 3]).buffer;

      await storeInCache('https://cache.test/store', testData, {}, mockLogger);

      expect(mockCache.put).toHaveBeenCalled();
      const storedResponse = mockCacheStore.get('https://cache.test/store');
      expect(storedResponse).toBeDefined();
      expect(storedResponse?.headers.get('Content-Type')).toBe('image/png');
    });

    it('uses standard TTL by default', async () => {
      const testData = new Uint8Array([1, 2, 3]).buffer;

      await storeInCache('https://cache.test/ttl', testData, {}, mockLogger);

      const storedResponse = mockCacheStore.get('https://cache.test/ttl');
      expect(storedResponse?.headers.get('Cache-Control')).toBe(`s-maxage=${CACHE_TTL.STANDARD}`);
    });

    it('uses market TTL when hasMarketData is true', async () => {
      const testData = new Uint8Array([1, 2, 3]).buffer;

      await storeInCache('https://cache.test/market', testData, { hasMarketData: true }, mockLogger);

      const storedResponse = mockCacheStore.get('https://cache.test/market');
      expect(storedResponse?.headers.get('Cache-Control')).toBe(`s-maxage=${CACHE_TTL.WITH_MARKET}`);
    });

    it('uses custom TTL when provided', async () => {
      const testData = new Uint8Array([1, 2, 3]).buffer;
      const customTtl = 3600;

      await storeInCache('https://cache.test/custom', testData, { ttl: customTtl }, mockLogger);

      const storedResponse = mockCacheStore.get('https://cache.test/custom');
      expect(storedResponse?.headers.get('Cache-Control')).toBe(`s-maxage=${customTtl}`);
    });

    it('does not throw on error', async () => {
      mockCache.put = vi.fn().mockRejectedValueOnce(new Error('Store error'));

      await expect(
        storeInCache('https://cache.test/error', new ArrayBuffer(0), {}, mockLogger)
      ).resolves.not.toThrow();

      expect((mockLogger as { error: typeof vi.fn }).error).toHaveBeenCalled();

      // Restore mock
      mockCache.put = vi.fn(async (key: string, response: Response) => {
        mockCacheStore.set(key, response);
      });
    });
  });

  describe('deleteFromCache', () => {
    it('returns true when key existed', async () => {
      mockCacheStore.set('https://cache.test/delete', new Response());

      const result = await deleteFromCache('https://cache.test/delete', mockLogger);

      expect(result).toBe(true);
      expect(mockCacheStore.has('https://cache.test/delete')).toBe(false);
    });

    it('returns false when key did not exist', async () => {
      const result = await deleteFromCache('https://cache.test/nonexistent', mockLogger);

      expect(result).toBe(false);
    });
  });

  describe('getTtlForCommand', () => {
    it('returns static TTL for dye_info without market', () => {
      expect(getTtlForCommand('dye_info', false)).toBe(CACHE_TTL.STATIC);
    });

    it('returns market TTL for dye_info with market', () => {
      expect(getTtlForCommand('dye_info', true)).toBe(CACHE_TTL.WITH_MARKET);
    });

    it('returns static TTL for swatch_grid without market', () => {
      expect(getTtlForCommand('swatch_grid', false)).toBe(CACHE_TTL.STATIC);
    });

    it('returns budget TTL for budget_find', () => {
      expect(getTtlForCommand('budget_find', false)).toBe(CACHE_TTL.BUDGET);
      expect(getTtlForCommand('budget_find', true)).toBe(CACHE_TTL.BUDGET);
    });

    it('returns standard TTL for other commands', () => {
      expect(getTtlForCommand('harmony', false)).toBe(CACHE_TTL.STANDARD);
      expect(getTtlForCommand('mixer', false)).toBe(CACHE_TTL.STANDARD);
    });

    it('returns market TTL for other commands with market data', () => {
      expect(getTtlForCommand('harmony', true)).toBe(CACHE_TTL.WITH_MARKET);
      expect(getTtlForCommand('mixer', true)).toBe(CACHE_TTL.WITH_MARKET);
    });
  });

  describe('withCache', () => {
    it('returns cached data on hit', async () => {
      const testData = new Uint8Array([1, 2, 3, 4]).buffer;
      const params = { command: 'test', params: { a: '1' } };
      const cacheKey = await buildCacheKey(params);

      mockCacheStore.set(cacheKey, new Response(testData, {
        headers: { 'Content-Type': 'image/png' },
      }));

      const renderFn = vi.fn();
      const result = await withCache(params, renderFn, mockCtx, {}, mockLogger);

      expect(result.cacheStatus).toBe('hit');
      expect(renderFn).not.toHaveBeenCalled();
    });

    it('calls renderFn on cache miss', async () => {
      const testData = new Uint8Array([5, 6, 7, 8]).buffer;
      const params = { command: 'test', params: { a: '2' } };

      const renderFn = vi.fn().mockResolvedValue(testData);
      const result = await withCache(params, renderFn, mockCtx, {}, mockLogger);

      expect(result.cacheStatus).toBe('miss');
      expect(renderFn).toHaveBeenCalled();
      expect(result.data).toBe(testData);
    });

    it('stores result in cache after miss', async () => {
      const testData = new Uint8Array([9, 10]).buffer;
      const params = { command: 'cacheable', params: { b: '3' } };

      const renderFn = vi.fn().mockResolvedValue(testData);
      await withCache(params, renderFn, mockCtx, {}, mockLogger);

      // waitUntil should have been called
      expect(mockCtx.waitUntil).toHaveBeenCalled();
    });

    it('skips cache for uncacheable commands', async () => {
      const testData = new Uint8Array([11, 12]).buffer;
      const params = { command: 'dye_random', params: {} };

      const renderFn = vi.fn().mockResolvedValue(testData);
      const result = await withCache(params, renderFn, mockCtx, {}, mockLogger);

      expect(result.cacheStatus).toBe('skip');
      expect(renderFn).toHaveBeenCalled();
    });
  });

  describe('Key param builders', () => {
    it('harmonyKeyParams builds correct params', () => {
      const result = harmonyKeyParams('#FF0000', 'triadic', false, 'Cactuar', 'en');

      expect(result.command).toBe('harmony');
      expect(result.params.color).toBe('#FF0000');
      expect(result.params.type).toBe('triadic');
      expect(result.params.market).toBe(false);
      expect(result.params.world).toBe('Cactuar');
      expect(result.params.locale).toBe('en');
    });

    it('extractorColorKeyParams builds correct params', () => {
      const result = extractorColorKeyParams('#00FF00', 'oklab', 5, true, 'Gilgamesh', 'ja');

      expect(result.command).toBe('extractor_color');
      expect(result.params.color).toBe('#00FF00');
      expect(result.params.matching).toBe('oklab');
      expect(result.params.count).toBe(5);
    });

    it('gradientKeyParams builds correct params', () => {
      const result = gradientKeyParams('#FF0000', '#0000FF', 'lab', 'ciede2000', 7, false, undefined, 'de');

      expect(result.command).toBe('gradient');
      expect(result.params.start).toBe('#FF0000');
      expect(result.params.end).toBe('#0000FF');
      expect(result.params.mode).toBe('lab');
      expect(result.params.steps).toBe(7);
    });

    it('mixerKeyParams builds correct params', () => {
      const result = mixerKeyParams('Snow White', 'Soot Black', 'spectral', 'hyab', 5, true, 'Crystal', 'fr');

      expect(result.command).toBe('mixer');
      expect(result.params.dye1).toBe('Snow White');
      expect(result.params.dye2).toBe('Soot Black');
      expect(result.params.mode).toBe('spectral');
    });

    it('swatchColorKeyParams builds correct params', () => {
      const result = swatchColorKeyParams('skin', '#F5D0C5', 'Xaela', 'female', 'oklab', 5, false, undefined, 'ko');

      expect(result.command).toBe('swatch_color');
      expect(result.params.type).toBe('skin');
      expect(result.params.clan).toBe('Xaela');
      expect(result.params.gender).toBe('female');
    });

    it('swatchGridKeyParams builds correct params', () => {
      const result = swatchGridKeyParams('hair', 3, 5, 'Midlander', 'male', 'oklab', 5, false, undefined, 'zh');

      expect(result.command).toBe('swatch_grid');
      expect(result.params.row).toBe(3);
      expect(result.params.col).toBe(5);
    });

    it('comparisonKeyParams builds correct params', () => {
      const result = comparisonKeyParams(['Dye1', 'Dye2', 'Dye3'], 'en');

      expect(result.command).toBe('comparison');
      expect(result.params.dye1).toBe('Dye1');
      expect(result.params.dye2).toBe('Dye2');
      expect(result.params.dye3).toBe('Dye3');
    });

    it('dyeInfoKeyParams builds correct params', () => {
      const result = dyeInfoKeyParams('Snow White', 'ja');

      expect(result.command).toBe('dye_info');
      expect(result.params.name).toBe('Snow White');
      expect(result.params.locale).toBe('ja');
    });
  });
});
