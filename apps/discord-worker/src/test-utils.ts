/**
 * Shared test utilities for xivdyetools-discord-worker tests
 *
 * Thin composition wrapper: the actual KV / Analytics Engine mocks are the
 * shared implementations from @xivdyetools/test-utils (DEAD-005 consolidation,
 * Task 5). This file just types them for this worker's Env shape.
 */

import { createMockKV, createMockAnalyticsEngine } from '@xivdyetools/test-utils/cloudflare';
import type { Env } from './types/env.js';

/**
 * Creates a mock Env object with all required properties
 */
export function createMockEnv(overrides?: Partial<Env>): Env {
  return {
    DISCORD_PUBLIC_KEY: 'test-key',
    DISCORD_TOKEN: 'test-token',
    DISCORD_CLIENT_ID: 'test-app-id',
    PRESETS_API_URL: 'https://test-api.example.com',
    INTERNAL_WEBHOOK_SECRET: 'test-secret',
    KV: createMockKV() as unknown as KVNamespace,
    ANALYTICS: createMockAnalyticsEngine() as unknown as AnalyticsEngineDataset,
    ...overrides,
  } as Env;
}
