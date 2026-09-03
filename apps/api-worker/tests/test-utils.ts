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
    UNIVERSALIS_API_BASE: 'https://universalis.app/api/v2',
    RATE_LIMIT_REQUESTS: '60',
    RATE_LIMIT_WINDOW_SECONDS: '60',
    ...overrides,
  };
}

export { createMockKV };
