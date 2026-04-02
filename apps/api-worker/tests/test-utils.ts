/**
 * Test utilities for api-worker.
 * Provides mock environment and request helpers for Hono app testing.
 */

import { createMockKV } from '@xivdyetools/test-utils';
import type { Env } from '../src/types.js';

export function createMockEnv(overrides: Partial<Env> = {}): Env {
  return {
    RATE_LIMIT: createMockKV() as unknown as KVNamespace,
    ENVIRONMENT: 'development',
    API_VERSION: 'v1',
    ...overrides,
  };
}

/**
 * Helper to make a request to the Hono app with mock env bindings.
 * Usage: const res = await appRequest('/v1/dyes', env);
 */
export function buildRequest(path: string, options?: RequestInit): Request {
  return new Request(`http://localhost${path}`, options);
}

export { createMockKV };
