/**
 * Shared test utilities for xivdyetools-discord-worker tests
 *
 * Provides consistent mock factories for Env, ExecutionContext, and common test data.
 */

import { vi } from 'vitest';
import type { Env } from './types/env.js';

/**
 * Creates a mock KV namespace
 */
export function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cursor: '' })),
    _store: store,
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

/**
 * Creates a mock D1Database
 */
export function createMockD1(): D1Database {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
    })),
    batch: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({ count: 0 }),
    dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
  } as unknown as D1Database;
}

/**
 * Creates a mock AnalyticsEngineDataset
 */
export function createMockAnalytics(): AnalyticsEngineDataset {
  return {
    writeDataPoint: vi.fn(),
  } as unknown as AnalyticsEngineDataset;
}

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
    KV: createMockKV(),
    DB: createMockD1(),
    ANALYTICS: createMockAnalytics(),
    ...overrides,
  } as Env;
}
