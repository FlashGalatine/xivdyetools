/**
 * Cloudflare Workers mock implementations
 *
 * Provides mocks for D1 Database, KV Namespace, R2 Bucket,
 * Analytics Engine, and Service Binding Fetcher.
 *
 * NOTE (DEAD-026 / DEAD-005): `analytics.ts` had zero external consumers at
 * 2026-08-18 audit time, but Task 5's own DEAD-005 consolidation wires
 * `createMockAnalyticsEngine` into discord-worker's `src/test-utils.ts`, so
 * it is kept rather than deleted — deleting it in the same task that gives
 * it a consumer would be self-defeating.
 */

export * from './d1.js';
export * from './kv.js';
export * from './fetcher.js';
export * from './r2.js';
export * from './analytics.js';
