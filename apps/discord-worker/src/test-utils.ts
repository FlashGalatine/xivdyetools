/**
 * Shared test utilities for xivdyetools-discord-worker tests
 *
 * Provides consistent mock factories for Env, ExecutionContext, and common test data.
 */

import { vi } from 'vitest';
import type { Env } from './types/env.js';
import type { Dye } from '@xivdyetools/types/dye';
import type { CommunityPreset, PresetCategory } from '@xivdyetools/types/preset';

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

/**
 * Creates a mock ExecutionContext with all required properties
 */
export function createMockExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    props: {},
  } as unknown as ExecutionContext;
}

/**
 * Creates a mock Dye object with all required fields
 */
export function createMockDye(overrides: Partial<Dye> = {}): Dye {
  const id = overrides.id ?? 1;
  const itemID = overrides.itemID ?? 5700 + id;

  return {
    itemID,
    stainID: overrides.stainID ?? id,
    id,
    name: `Test Dye ${id}`,
    hex: '#888888',
    rgb: { r: 136, g: 136, b: 136 },
    hsv: { h: 0, s: 0, v: 53 },
    category: 'Grey',
    acquisition: 'Vendor',
    cost: 216,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
    ...overrides,
  };
}

/**
 * Creates multiple mock dyes
 */
export function createMockDyes(count: number, overrides: Partial<Dye> = {}): Dye[] {
  return Array.from({ length: count }, (_, i) =>
    createMockDye({ id: i + 1, ...overrides })
  );
}

/**
 * Creates a mock CommunityPreset with all required fields
 */
export function createMockPreset(overrides: Partial<CommunityPreset> = {}): CommunityPreset {
  return {
    id: 'test-preset-1',
    name: 'Test Preset',
    description: 'A test preset',
    category_id: 'aesthetics' as PresetCategory,
    dyes: [1, 2, 3],
    tags: ['test'],
    author_discord_id: 'user-123',
    author_name: 'TestUser',
    status: 'approved',
    vote_count: 0,
    is_curated: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
