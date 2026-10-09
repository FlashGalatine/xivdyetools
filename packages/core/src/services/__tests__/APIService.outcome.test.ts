/**
 * BUG-090 (2026-10-04 deep-dive): a batch price fetch reports HOW it went.
 *
 * `getPricesForDataCenter` turns every upstream failure (a thrown fetch, a
 * timeout, a non-OK status, an unparseable body, retry exhaustion) into an
 * empty Map, which is indistinguishable from "the board has no listings" —
 * so a Universalis proxy outage reached the web app as a successful fetch and
 * none of its market-failure UI could ever appear.
 * `getPricesForDataCenterWithOutcome` returns the same prices plus an outcome;
 * the Map-only method is published API and must answer exactly as before.
 *
 * Every outage path retries with exponential backoff (1s, then 2s), so these
 * tests run on fake timers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  APIService,
  MemoryCacheBackend,
  type FetchClient,
  type RateLimiter,
} from '../APIService.js';
import { UNIVERSALIS_API_BASE, UNIVERSALIS_API_RETRY_COUNT } from '../../constants/index.js';

/** A fetch client that answers through `handler` and counts every attempt. */
function scriptedFetchClient(
  handler: (url: string, init?: RequestInit) => Promise<Response>,
): FetchClient & { urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    async fetch(url: string, init?: RequestInit): Promise<Response> {
      urls.push(url);
      return handler(url, init);
    },
  };
}

/** A JSON response with Universalis's content type. */
function json(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** An aggregated batch body pricing every id at `id * 10`. */
function pricedBody(ids: number[]): unknown {
  return {
    results: ids.map((id) => ({ itemId: id, nq: { minListing: { dc: { price: id * 10 } } } })),
    failedItems: [],
  };
}

const noWait: RateLimiter = {
  async waitIfNeeded(): Promise<void> {},
  recordRequest(): void {},
};

/** Settle `promise` while draining the retry backoff and timeout timers. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return promise;
}

function serviceWith(fetchClient: FetchClient): APIService {
  return new APIService({ fetchClient, rateLimiter: noWait });
}

describe('APIService batch fetch outcome (BUG-090)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('an upstream outage', () => {
    const outages: Array<[string, (url: string, init?: RequestInit) => Promise<Response>]> = [
      ['a thrown fetch (network down)', () => Promise.reject(new TypeError('Failed to fetch'))],
      ['a 503 from the proxy', () => Promise.resolve(json({ error: 'unavailable' }, 503))],
      ['a 500 from the proxy', () => Promise.resolve(json({ error: 'boom' }, 500))],
      ['a deterministic 404', () => Promise.resolve(json({ error: 'not found' }, 404))],
      [
        'a timeout',
        (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(new DOMException('The operation was aborted.', 'AbortError')),
            );
          }),
      ],
      ['an unparseable body', () => Promise.resolve(json('{"results": [', 200))],
      ['a null body', () => Promise.resolve(json('null', 200))],
      ['a body with no results array', () => Promise.resolve(json({ failedItems: [5729] }, 200))],
    ];

    it.each(outages)('reports %s as outcome "error" with no prices', async (_label, handler) => {
      const service = serviceWith(scriptedFetchClient(handler));

      const result = await settle(
        service.getPricesForDataCenterWithOutcome([5729, 5730], 'Aether'),
      );

      expect(result.outcome).toBe('error');
      expect(result.prices).toEqual(new Map());
    });

    it.each(outages)(
      'leaves getPricesForDataCenter answering an empty Map for %s',
      async (_label, handler) => {
        const service = serviceWith(scriptedFetchClient(handler));

        const prices = await settle(service.getPricesForDataCenter([5729, 5730], 'Aether'));

        expect(prices).toEqual(new Map());
      },
    );

    it('retries a 5xx to exhaustion before giving up', async () => {
      const fetchClient = scriptedFetchClient(() => Promise.resolve(json({}, 503)));
      const service = serviceWith(fetchClient);

      const result = await settle(service.getPricesForDataCenterWithOutcome([5729], 'Aether'));

      expect(result.outcome).toBe('error');
      expect(fetchClient.urls).toHaveLength(UNIVERSALIS_API_RETRY_COUNT);
    });

    // Sprint 27 review: 'error' promises an empty Map. A failed fetch beside
    // cached prices is 'partial' -- a consumer that read 'error' here used to
    // say every price was missing while it was showing some of them.
    it('reports cached prices beside a failed fetch for the rest as "partial"', async () => {
      let down = false;
      const fetchClient = scriptedFetchClient((url) =>
        down
          ? Promise.reject(new TypeError('Failed to fetch'))
          : Promise.resolve(json(pricedBody([Number(url.split('/').pop())]))),
      );
      const service = serviceWith(fetchClient);
      await settle(service.getPricesForDataCenterWithOutcome([5729], 'Aether'));

      down = true;
      const result = await settle(
        service.getPricesForDataCenterWithOutcome([5729, 5730], 'Aether'),
      );

      expect(result.outcome).toBe('partial');
      expect([...result.prices.keys()]).toEqual([5729]);
    });

    it('keeps "error" for a failed fetch when nothing is cached either', async () => {
      const fetchClient = scriptedFetchClient((url) =>
        url.endsWith('/5729')
          ? Promise.resolve(json(pricedBody([5729])))
          : Promise.reject(new TypeError('Failed to fetch')),
      );
      const service = serviceWith(fetchClient);
      // A cached price for an item this call did not ask about does not count
      await settle(service.getPricesForDataCenterWithOutcome([5729], 'Aether'));

      const result = await settle(service.getPricesForDataCenterWithOutcome([5730], 'Aether'));

      expect(result).toEqual({ prices: new Map(), outcome: 'error' });
    });
  });

  // Sprint 27 review: the rate limiter sat outside the request's try, so a
  // custom limiter that failed made a "never throws" method reject.
  describe('a failing rate limiter', () => {
    const limiters: Array<[string, RateLimiter]> = [
      [
        'rejects while waiting',
        {
          async waitIfNeeded(): Promise<void> {
            throw new Error('limiter backend down');
          },
          recordRequest(): void {},
        },
      ],
      [
        'throws while recording',
        {
          async waitIfNeeded(): Promise<void> {},
          recordRequest(): void {
            throw new Error('limiter backend down');
          },
        },
      ],
    ];

    it.each(limiters)(
      'reports a limiter that %s as a failed request, without rejecting',
      async (_label, rateLimiter) => {
        const fetchClient = scriptedFetchClient(() => Promise.resolve(json(pricedBody([5729]))));
        const service = new APIService({ fetchClient, rateLimiter });

        const result = await settle(
          service.getPricesForDataCenterWithOutcome([5729], 'Aether').catch((error: unknown) => ({
            rejected: error,
          })),
        );

        expect(result).toEqual({ prices: new Map(), outcome: 'error' });
        expect(fetchClient.urls).toHaveLength(0);
      },
    );

    it('keeps getPricesForDataCenter answering an empty Map', async () => {
      const service = new APIService({
        fetchClient: scriptedFetchClient(() => Promise.resolve(json(pricedBody([5729])))),
        rateLimiter: limiters[0][1],
      });

      await expect(settle(service.getPricesForDataCenter([5729], 'Aether'))).resolves.toEqual(
        new Map(),
      );
    });
  });

  // Sprint 27 review: the data-center sanitiser kept ASCII letters and digits
  // only, so every Chinese / Korean data center and world the web app offers
  // collapsed to '' -- `/aggregated//<ids>`, which api-worker's
  // `/aggregated/:datacenter/:itemIds` route answers with a 404. With BUG-090
  // that became a permanent market error for those players.
  describe('CN and KR data centers and worlds', () => {
    /** Answers like api-worker: an empty data-center segment matches no route. */
    const workerLike = (): ReturnType<typeof scriptedFetchClient> =>
      scriptedFetchClient((url) => {
        if (url.includes('/aggregated//')) {
          return Promise.resolve(json({ error: 'Not Found' }, 404));
        }
        const ids = (url.split('/').pop() ?? '').split(',').map(Number);
        return Promise.resolve(json(pricedBody(ids)));
      });

    const segment = (name: string): string =>
      `${UNIVERSALIS_API_BASE}/aggregated/${encodeURIComponent(name)}/`;

    it.each([
      ['a Chinese data center', '陆行鸟'],
      ['the Korean data center', '한국'],
      ['a Chinese world', '红玉海'],
      ['a Korean world', '카벙클'],
    ])('prices %s through an encoded, non-empty path segment', async (_label, name) => {
      const fetchClient = workerLike();
      const service = serviceWith(fetchClient);

      const result = await settle(service.getPricesForDataCenterWithOutcome([5729, 5730], name));

      expect(fetchClient.urls).toEqual([`${segment(name)}5729,5730`]);
      expect(result.outcome).toBe('ok');
      expect(result.prices.get(5729)?.currentAverage).toBe(57290);
      expect(result.prices.get(5730)?.currentAverage).toBe(57300);
    });

    it('encodes the single-item path the same way', async () => {
      const fetchClient = workerLike();
      const service = serviceWith(fetchClient);

      const price = await settle(service.getPriceData(5729, undefined, '莫古力'));

      expect(fetchClient.urls).toEqual([`${segment('莫古力')}5729`]);
      expect(price?.currentAverage).toBe(57290);
    });

    // encodeURIComponent throws URIError on a lone surrogate, and the URL is
    // built outside the request's try: the sanitiser must strip it first, or
    // the "never throws" method rejects.
    it('strips a lone surrogate before encoding', async () => {
      const fetchClient = workerLike();
      const service = serviceWith(fetchClient);

      const result = await settle(
        service.getPricesForDataCenterWithOutcome([5729], 'Crystal\uD800'),
      );

      expect(fetchClient.urls).toEqual([`${segment('Crystal')}5729`]);
      expect(result.outcome).toBe('ok');
    });

    it('gives two CN data centers separate cache entries', async () => {
      // Any URL is answered, so this isolates the cache key: a shared key
      // would serve 莫古力 the price cached for 陆行鸟 without a request.
      let price = 100;
      const fetchClient = scriptedFetchClient(() =>
        Promise.resolve(
          json({ results: [{ itemId: 5729, nq: { minListing: { dc: { price: price++ } } } }] }),
        ),
      );
      const cacheBackend = new MemoryCacheBackend();
      const service = new APIService({ fetchClient, rateLimiter: noWait, cacheBackend });

      const first = await settle(service.getPricesForDataCenterWithOutcome([5729], '陆行鸟'));
      const second = await settle(service.getPricesForDataCenterWithOutcome([5729], '莫古力'));

      expect(first.prices.get(5729)?.currentAverage).toBe(100);
      expect(second.prices.get(5729)?.currentAverage).toBe(101);
      expect(fetchClient.urls).toHaveLength(2);
      expect(cacheBackend.keys().sort()).toEqual(['5729:dc:莫古力', '5729:dc:陆行鸟'].sort());
    });

    it.each([
      ['a path traversal', 'Crystal/../x', 'Crystalx'],
      ['a pre-encoded slash', '%2F', '2F'],
      ['a deeper traversal', '../../etc/passwd', 'etcpasswd'],
      ['a traversal between CJK names', '陆行鸟/../한국', '陆行鸟한국'],
      ['a query and a fragment', '陆行鸟?x=1#y', '陆行鸟x1y'],
    ])('still neutralises %s', async (_label, name, kept) => {
      const fetchClient = workerLike();
      const service = serviceWith(fetchClient);

      await settle(service.getPricesForDataCenterWithOutcome([5729], name));

      expect(fetchClient.urls).toEqual([`${segment(kept)}5729`]);
      const path = fetchClient.urls[0].slice(UNIVERSALIS_API_BASE.length);
      expect(path).not.toContain('..');
      expect(path).not.toMatch(/%2F|%5C|[?#]/i);
      expect(path.split('/')).toHaveLength(4); // '', 'aggregated', <dc>, <ids>
    });
  });

  describe('a successful fetch', () => {
    it('reports "ok" with the fetched prices', async () => {
      const service = serviceWith(
        scriptedFetchClient(() => Promise.resolve(json(pricedBody([5729, 5730])))),
      );

      const result = await settle(
        service.getPricesForDataCenterWithOutcome([5729, 5730], 'Aether'),
      );

      expect(result.outcome).toBe('ok');
      expect(result.prices.get(5729)?.currentAverage).toBe(57290);
      expect(result.prices.get(5730)?.currentAverage).toBe(57300);
    });

    it('reports a 200 with no matching items as "ok" — the board answered', async () => {
      const service = serviceWith(
        scriptedFetchClient(() => Promise.resolve(json({ results: [], failedItems: [5729] }))),
      );

      const result = await settle(service.getPricesForDataCenterWithOutcome([5729], 'Aether'));

      expect(result.outcome).toBe('ok');
      expect(result.prices.size).toBe(0);
    });

    it('answers getPricesForDataCenter with the same prices', async () => {
      const service = serviceWith(
        scriptedFetchClient(() => Promise.resolve(json(pricedBody([5729, 5730])))),
      );

      const prices = await settle(service.getPricesForDataCenter([5729, 5730], 'Aether'));

      expect(prices).toBeInstanceOf(Map);
      expect([...prices.keys()].sort()).toEqual([5729, 5730]);
      expect(prices.get(5730)?.currentMinPrice).toBe(57300);
    });

    it('reports an all-cached call as "ok" without a request', async () => {
      const fetchClient = scriptedFetchClient(() => Promise.resolve(json(pricedBody([5729]))));
      const service = serviceWith(fetchClient);
      await settle(service.getPricesForDataCenterWithOutcome([5729], 'Aether'));
      fetchClient.urls.length = 0;

      const result = await settle(service.getPricesForDataCenterWithOutcome([5729], 'Aether'));

      expect(result.outcome).toBe('ok');
      expect(result.prices.size).toBe(1);
      expect(fetchClient.urls).toHaveLength(0);
    });

    it.each([
      ['an empty item list', []],
      ['only invalid ids', [-1629, 0, 1.5]],
    ])('reports %s as "ok" without a request', async (_label, ids) => {
      const fetchClient = scriptedFetchClient(() =>
        Promise.reject(new Error('unexpected request')),
      );
      const service = serviceWith(fetchClient);

      const result = await settle(service.getPricesForDataCenterWithOutcome(ids, 'Aether'));

      expect(result).toEqual({ prices: new Map(), outcome: 'ok' });
      expect(fetchClient.urls).toHaveLength(0);
    });
  });

  describe('a batch larger than one request (BUG-001 chunking)', () => {
    const ids = Array.from({ length: 150 }, (_, i) => 5001 + i);
    const firstChunk = ids.slice(0, 100);
    const secondChunk = ids.slice(100);
    const isSecondChunk = (url: string): boolean => url.endsWith(`/${secondChunk.join(',')}`);

    it('reports "partial" with the prices the other chunk returned', async () => {
      const fetchClient = scriptedFetchClient((url) =>
        isSecondChunk(url)
          ? Promise.resolve(json({}, 503))
          : Promise.resolve(json(pricedBody(firstChunk))),
      );
      const service = serviceWith(fetchClient);

      const result = await settle(service.getPricesForDataCenterWithOutcome(ids, 'Aether'));

      expect(result.outcome).toBe('partial');
      expect(result.prices.size).toBe(100);
      expect(result.prices.get(5001)?.currentAverage).toBe(50010);
      expect(result.prices.has(secondChunk[0])).toBe(false);
    });

    it('reports "partial" when it is the first chunk that fails', async () => {
      const fetchClient = scriptedFetchClient((url) =>
        isSecondChunk(url)
          ? Promise.resolve(json(pricedBody(secondChunk)))
          : Promise.reject(new TypeError('Failed to fetch')),
      );
      const service = serviceWith(fetchClient);

      const result = await settle(service.getPricesForDataCenterWithOutcome(ids, 'Aether'));

      expect(result.outcome).toBe('partial');
      expect(result.prices.size).toBe(50);
      expect(result.prices.has(firstChunk[0])).toBe(false);
    });

    it('reports "error" when every chunk fails', async () => {
      const service = serviceWith(scriptedFetchClient(() => Promise.resolve(json({}, 502))));

      const result = await settle(service.getPricesForDataCenterWithOutcome(ids, 'Aether'));

      expect(result.outcome).toBe('error');
      expect(result.prices.size).toBe(0);
    });

    it('keeps getPricesForDataCenter answering the surviving chunk only', async () => {
      const service = serviceWith(
        scriptedFetchClient((url) =>
          isSecondChunk(url)
            ? Promise.resolve(json({}, 503))
            : Promise.resolve(json(pricedBody(firstChunk))),
        ),
      );

      const prices = await settle(service.getPricesForDataCenter(ids, 'Aether'));

      expect(prices.size).toBe(100);
    });
  });

  describe('in-flight coalescing (OPT-001)', () => {
    it('gives every coalesced caller the outage outcome from one upstream request', async () => {
      const fetchClient = scriptedFetchClient(() => Promise.resolve(json({}, 503)));
      const service = serviceWith(fetchClient);

      const first = service.getPricesForDataCenterWithOutcome([5729, 5730], 'Aether');
      const second = service.getPricesForDataCenterWithOutcome([5730, 5729], 'Aether');
      await vi.runAllTimersAsync();

      expect((await first).outcome).toBe('error');
      expect((await second).outcome).toBe('error');
      // One request's retries, not two requests' worth
      expect(fetchClient.urls).toHaveLength(UNIVERSALIS_API_RETRY_COUNT);
    });

    it('shares the outcome with a coalesced getPricesForDataCenter caller too', async () => {
      const fetchClient = scriptedFetchClient(() => Promise.resolve(json(pricedBody([5729]))));
      const service = serviceWith(fetchClient);

      const withOutcome = service.getPricesForDataCenterWithOutcome([5729], 'Aether');
      const mapOnly = service.getPricesForDataCenter([5729], 'Aether');
      await vi.runAllTimersAsync();

      expect((await withOutcome).outcome).toBe('ok');
      expect((await mapOnly).get(5729)?.currentAverage).toBe(57290);
      expect(fetchClient.urls).toHaveLength(1);
    });
  });
});
