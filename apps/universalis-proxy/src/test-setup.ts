/**
 * Test Setup - Mocks for Cloudflare Worker runtime APIs
 *
 * This file provides mocks for Cloudflare-specific globals that aren't
 * available in Node.js test environments:
 * - caches (Cache API)
 * - ExecutionContext
 */

import { vi } from 'vitest';

/**
 * Mock Cache implementation
 */
export class MockCache implements Cache {
  private storage = new Map<string, Response>();

  async match(request: RequestInfo | URL): Promise<Response | undefined> {
    const key = typeof request === 'string' ? request : (request as Request).url;
    const cached = this.storage.get(key);
    return cached ? cached.clone() : undefined;
  }

  async put(request: RequestInfo | URL, response: Response): Promise<void> {
    const key = typeof request === 'string' ? request : (request as Request).url;
    this.storage.set(key, response.clone());
  }

  async delete(request: RequestInfo | URL): Promise<boolean> {
    const key = typeof request === 'string' ? request : (request as Request).url;
    return this.storage.delete(key);
  }

  // Required but not used
  async add(): Promise<void> {}
  async addAll(): Promise<void> {}
  async keys(): Promise<readonly Request[]> {
    return [];
  }
  async matchAll(): Promise<readonly Response[]> {
    return [];
  }

  // Test helper to clear storage
  clear(): void {
    this.storage.clear();
  }

  // Test helper to get size
  get size(): number {
    return this.storage.size;
  }
}

/**
 * Mock CacheStorage implementation
 */
export class MockCacheStorage implements CacheStorage {
  private caches = new Map<string, MockCache>();
  readonly default: Cache = new MockCache();

  async open(cacheName: string): Promise<MockCache> {
    let cache = this.caches.get(cacheName);
    if (!cache) {
      cache = new MockCache();
      this.caches.set(cacheName, cache);
    }
    return cache;
  }

  async has(cacheName: string): Promise<boolean> {
    return this.caches.has(cacheName);
  }

  async delete(cacheName: string): Promise<boolean> {
    return this.caches.delete(cacheName);
  }

  async keys(): Promise<string[]> {
    return Array.from(this.caches.keys());
  }

  async match(): Promise<Response | undefined> {
    return undefined;
  }

  // Test helper to clear all caches
  clear(): void {
    this.caches.clear();
  }
}

/**
 * Create a mock ExecutionContext
 */
export function createMockExecutionContext(): ExecutionContext {
  const waitUntilPromises: Promise<unknown>[] = [];

  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => {
      waitUntilPromises.push(promise);
    }),
    passThroughOnException: vi.fn(),
    // Test helper to wait for all background tasks
    _waitForAll: () => Promise.all(waitUntilPromises),
    _promises: waitUntilPromises,
  } as unknown as ExecutionContext;
}

/**
 * Create a mock Env object
 */
export function createMockEnv(
  overrides: Partial<{
    ENVIRONMENT: string;
    ALLOWED_ORIGINS: string;
    UNIVERSALIS_API_BASE: string;
    RATE_LIMIT_REQUESTS: string;
    RATE_LIMIT_WINDOW_SECONDS: string;
  }> = {}
) {
  return {
    ENVIRONMENT: 'test',
    ALLOWED_ORIGINS: 'https://xivdyetools.app',
    UNIVERSALIS_API_BASE: 'https://universalis.app/api/v2',
    RATE_LIMIT_REQUESTS: '100',
    RATE_LIMIT_WINDOW_SECONDS: '60',
    ...overrides,
  };
}

// Setup global mocks
let mockCacheStorage = new MockCacheStorage();

// @ts-expect-error - Assigning to globalThis for test environment
globalThis.caches = mockCacheStorage;

// Helper to reset all mocks between tests
export function resetAllMocks(): void {
  mockCacheStorage.clear();
  // Create a completely new instance to ensure isolation
  mockCacheStorage = new MockCacheStorage();
  // @ts-expect-error - Assigning to globalThis for test environment
  globalThis.caches = mockCacheStorage;
}
