/**
 * Construction, option resolution and batch guards for APIService.
 *
 * The constructor takes a single `APIServiceOptions` object (the legacy
 * positional `(cache, fetchClient, rateLimiter)` shape was removed —
 * DEAD-035, 2026-08-18 dead-code audit). Each option's resolution/default
 * is pinned here, along with the batch-fetch guards.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  APIService,
  MemoryCacheBackend,
  type FetchClient,
  type ICacheBackend,
  type RateLimiter,
} from '../APIService.js';

/** Records every URL requested and answers with an empty aggregated payload. */
function recordingFetchClient(): FetchClient & { urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    async fetch(url: string): Promise<Response> {
      urls.push(url);
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
  };
}

function countingRateLimiter(): RateLimiter & { waits: number; records: number } {
  return {
    waits: 0,
    records: 0,
    async waitIfNeeded(): Promise<void> {
      this.waits += 1;
    },
    recordRequest(): void {
      this.records += 1;
    },
  };
}

function spyCache(): ICacheBackend & { get: ReturnType<typeof vi.fn> } {
  const backing = new MemoryCacheBackend();
  return {
    get: vi.fn((key: string) => backing.get(key)),
    set: vi.fn((key: string, value) => backing.set(key, value)),
    delete: vi.fn((key: string) => backing.delete(key)),
  } as unknown as ICacheBackend & { get: ReturnType<typeof vi.fn> };
}

const silentLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe('APIService construction', () => {
  let fetchClient: ReturnType<typeof recordingFetchClient>;

  beforeEach(() => {
    fetchClient = recordingFetchClient();
  });

  describe('options-object API', () => {
    it('constructs with a fetchClient only', async () => {
      const service = new APIService({ fetchClient });

      await service.getPricesForDataCenter([5729], 'Aether');

      expect(fetchClient.urls).toHaveLength(1);
    });

    it('honours a custom baseUrl', async () => {
      const service = new APIService({ baseUrl: 'https://proxy.example/api/v2', fetchClient });

      await service.getPricesForDataCenter([5729], 'Aether');

      expect(fetchClient.urls[0]).toContain('https://proxy.example/api/v2/aggregated/');
    });

    it('falls back to the Universalis base when none is supplied', async () => {
      const service = new APIService({ fetchClient });

      await service.getPricesForDataCenter([5729], 'Aether');

      expect(fetchClient.urls[0]).toContain('universalis.app');
    });

    it('uses the supplied rate limiter', async () => {
      const rateLimiter = countingRateLimiter();
      const service = new APIService({ fetchClient, rateLimiter });

      await service.getPricesForDataCenter([5729], 'Aether');

      expect(rateLimiter.waits).toBeGreaterThan(0);
      expect(rateLimiter.records).toBeGreaterThan(0);
    });

    it('uses the supplied cache backend', async () => {
      const cacheBackend = spyCache();
      const service = new APIService({ fetchClient, cacheBackend });

      await service.getPricesForDataCenter([5729], 'Aether');

      expect(cacheBackend.get).toHaveBeenCalled();
    });

    it('defaults the logger to a no-op that never throws', async () => {
      const service = new APIService({ fetchClient });

      // A negative id trips the BUG-012 filter, which logs a warning
      await expect(service.getPricesForDataCenter([-1629, 5729], 'Aether')).resolves.toBeInstanceOf(
        Map,
      );
    });

    it('routes warnings to a supplied logger', async () => {
      const logger = silentLogger();
      const service = new APIService({ fetchClient, logger });

      await service.getPricesForDataCenter([-1629, 5729], 'Aether');

      expect(logger.warn).toHaveBeenCalled();
    });
  });

  describe('batch guards', () => {
    it('makes no request for an empty item list', async () => {
      const service = new APIService({ fetchClient });

      await expect(service.getPricesForDataCenter([], 'Aether')).resolves.toEqual(new Map());
      expect(fetchClient.urls).toHaveLength(0);
    });

    it('drops non-positive-integer ids rather than throwing (BUG-012)', async () => {
      const logger = silentLogger();
      const service = new APIService({ fetchClient, logger });

      await service.getPricesForDataCenter([-1629, 0, 1.5, 5729], 'Aether');

      expect(logger.warn).toHaveBeenCalled();
      expect(fetchClient.urls[0]).toContain('5729');
      expect(fetchClient.urls[0]).not.toContain('-1629');
    });

    it('makes no request when every id is invalid', async () => {
      const service = new APIService({ fetchClient, logger: silentLogger() });

      await expect(service.getPricesForDataCenter([-1629, -1390], 'Aether')).resolves.toEqual(
        new Map(),
      );
      expect(fetchClient.urls).toHaveLength(0);
    });

    it('chunks past the 100-item Universalis cap (BUG-001)', async () => {
      const service = new APIService({ fetchClient });
      const ids = Array.from({ length: 205 }, (_, i) => 5000 + i);

      await service.getPricesForDataCenter(ids, 'Aether');

      // 205 ids → 100 + 100 + 5
      expect(fetchClient.urls).toHaveLength(3);
    });

    it('sends a single request at exactly the cap', async () => {
      const service = new APIService({ fetchClient });
      const ids = Array.from({ length: 100 }, (_, i) => 5000 + i);

      await service.getPricesForDataCenter(ids, 'Aether');

      expect(fetchClient.urls).toHaveLength(1);
    });

    it('sanitizes the datacenter segment against path injection', async () => {
      const service = new APIService({ fetchClient });

      await service.getPricesForDataCenter([5729], '../../etc/passwd');

      expect(fetchClient.urls[0]).not.toContain('..');
      expect(fetchClient.urls[0]).not.toContain('/etc/');
      expect(fetchClient.urls[0]).toContain('etcpasswd');
    });

    it('uses the universal segment when no datacenter is given', async () => {
      const service = new APIService({ fetchClient });

      await service.getPriceData(5729);

      expect(fetchClient.urls[0]).toContain('/aggregated/universal/');
    });
  });
});
