/**
 * Integration test utilities for xivdyetools-discord-worker
 *
 * Provides helpers for testing multi-module pipelines with realistic
 * mock Service Bindings, environment, and response assertions.
 */

import { vi, expect } from 'vitest';
import { createMockEnv, createMockKV, createMockD1, createMockAnalytics } from './test-utils.js';
import type { Env } from './types/env.js';

/**
 * Route handler for mock Service Bindings.
 * Maps URL path patterns to response factories.
 */
type RouteHandler = (request: Request, url: URL) => Response | Promise<Response>;

interface RouteMap {
  [pathPrefix: string]: RouteHandler;
}

/**
 * Creates a mock Fetcher (Service Binding) with route-based response stubs.
 *
 * @example
 * ```ts
 * const proxy = createMockServiceBinding({
 *   '/api/v2/aggregated/': (req, url) => Response.json({ results: [...] }),
 *   '/api/v2/worlds': () => Response.json([{ id: 1, name: 'Cactuar' }]),
 * });
 * ```
 */
export function createMockServiceBinding(routes: RouteMap = {}): Fetcher {
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);

    // Match routes by path prefix (longest prefix first)
    const sortedPrefixes = Object.keys(routes).sort((a, b) => b.length - a.length);
    for (const prefix of sortedPrefixes) {
      if (url.pathname.startsWith(prefix)) {
        return routes[prefix](request, url);
      }
    }

    return new Response('Not found', { status: 404 });
  });

  return { fetch: fetchFn } as unknown as Fetcher;
}

/**
 * Standard mock Universalis proxy responses for budget pipeline tests.
 */
export function createMockUniversalisProxy(priceMap?: Map<number, number>): Fetcher {
  return createMockServiceBinding({
    '/api/v2/aggregated/': (_req, url) => {
      const parts = url.pathname.split('/');
      const itemIds = parts[parts.length - 1].split(',').map(Number);

      return Response.json({
        results: itemIds.map(id => ({
          itemId: id,
          nq: {
            minListing: { dc: { price: priceMap?.get(id) ?? 1000 + id, worldId: 1 } },
            averageSalePrice: { dc: { price: (priceMap?.get(id) ?? 1000 + id) + 200 } },
            dailySaleVelocity: { dc: { quantity: 5 } },
            recentPurchase: {
              dc: { price: (priceMap?.get(id) ?? 1000 + id) + 100, timestamp: Date.now(), worldId: 1 },
            },
          },
          hq: {
            minListing: {},
            recentPurchase: {},
            averageSalePrice: {},
            dailySaleVelocity: {},
          },
          worldUploadTimes: [{ worldId: 1, timestamp: Date.now() }],
        })),
        failedItems: [],
      });
    },
    '/api/v2/worlds': () => {
      return Response.json([
        { id: 1, name: 'Cactuar' },
        { id: 2, name: 'Goblin' },
        { id: 3, name: 'Tonberry' },
      ]);
    },
    '/api/v2/data-centers': () => {
      return Response.json([
        { name: 'Aether', region: 'North-America', worlds: [1, 2] },
        { name: 'Elemental', region: 'Japan', worlds: [3] },
      ]);
    },
  });
}

/**
 * Creates a fully-configured mock Env with Service Binding stubs.
 * Extends the base `createMockEnv()` with optional Service Bindings.
 */
export function createFullMockEnv(overrides?: Partial<Env>): Env {
  return createMockEnv({
    UNIVERSALIS_PROXY: createMockUniversalisProxy(),
    UNIVERSALIS_PROXY_URL: 'https://mock-universalis.example.com',
    PRESETS_API: createMockServiceBinding(),
    ANNOUNCEMENT_CHANNEL_ID: 'test-announcement-channel',
    MODERATION_CHANNEL_ID: 'test-moderation-channel',
    SUBMISSION_LOG_CHANNEL_ID: 'test-submission-log-channel',
    MODERATOR_IDS: 'user-mod-1,user-mod-2',
    STATS_AUTHORIZED_USERS: 'user-stats-1',
    ...overrides,
  });
}

/**
 * Asserts that a Response contains valid Discord interaction JSON.
 */
export async function assertDiscordJsonResponse(
  response: Response,
  checks: {
    status?: number;
    type?: number;
    contentContains?: string;
    flags?: number;
    hasEmbeds?: boolean;
    hasChoices?: boolean;
  }
): Promise<Record<string, unknown>> {
  if (checks.status !== undefined) {
    expect(response.status).toBe(checks.status);
  }

  const data = await response.json() as Record<string, unknown>;

  if (checks.type !== undefined) {
    expect(data.type).toBe(checks.type);
  }

  const responseData = data.data as Record<string, unknown> | undefined;

  if (checks.contentContains !== undefined && responseData) {
    expect(responseData.content).toContain(checks.contentContains);
  }

  if (checks.flags !== undefined && responseData) {
    expect(responseData.flags).toBe(checks.flags);
  }

  if (checks.hasEmbeds && responseData) {
    expect(responseData.embeds).toBeDefined();
    expect(Array.isArray(responseData.embeds)).toBe(true);
  }

  if (checks.hasChoices && responseData) {
    expect(responseData.choices).toBeDefined();
    expect(Array.isArray(responseData.choices)).toBe(true);
  }

  return data;
}
