/**
 * Mock for cloudflare:test module
 * Provides SELF and env for testing the worker
 *
 * Some utilities are now imported from @xivdyetools/test-utils.
 * This file contains project-specific utilities that require local types.
 */

import app from '../../index.js';
import type { Env } from '../../types.js';
import { createSQLiteD1 } from './sqlite-d1.js';

// Import shared utilities from main export
import {
    VALID_CODE_VERIFIER,
    VALID_CODE_CHALLENGE,
    createMockKV as sharedCreateMockKV,
} from '@xivdyetools/test-utils';

// Re-export for consumers of this module
export { VALID_CODE_VERIFIER, VALID_CODE_CHALLENGE };

// Re-export KV mock
export const createMockKV = sharedCreateMockKV;

/** SQL recording backs the privacy assertions with actual SQLite execution. */
export interface RecordedStatement { sql: string; params: unknown[] }
export const recordedStatements: RecordedStatement[] = [];
const fixtures: ReturnType<typeof createSQLiteD1>[] = [];
export const resetRecordedStatements = (): void => {
  recordedStatements.length = 0;
  for (const fixture of fixtures) fixture.statements.length = 0;
};
export const createMockDB = (): D1Database => {
  const fixture = createSQLiteD1(undefined, statement => recordedStatements.push(statement));
  fixtures.push(fixture);
  return fixture.db;
};
export function resetMockDB(): void {
  for (const fixture of fixtures) {
    fixture.sqlite.exec('DELETE FROM identity_operation_locks; DELETE FROM identity_operations; DELETE FROM users');
  }
  resetRecordedStatements();
}
// Shared mock DB instance
const mockDB = createMockDB();

// Mock environment bindings
export const env: Env = {
    ENVIRONMENT: 'development',
    DISCORD_CLIENT_ID: 'test-client-id',
    DISCORD_CLIENT_SECRET: 'test-client-secret',
    XIVAUTH_CLIENT_ID: 'test-xivauth-client-id',
    FRONTEND_URL: 'http://localhost:5173',
    WORKER_URL: 'http://localhost:8788',
    JWT_SECRET: 'test-jwt-secret-key-for-testing-32chars',
    JWT_EXPIRY: '3600',
    DB: mockDB,
};

// FINDING-012 (2026-08-29 security audit): a minimal always-allow RateLimit
// binding — good enough to satisfy validateEnv's "is it a present object"
// check and the middleware's happy path. Suites that need throw/deny
// behaviour build their own fake (see rate-limit-binding.test.ts,
// index.test.ts's "Rate limiter backend errors" describe).
export const createMockRateLimit = (): RateLimit =>
    ({
        limit: async () => ({ success: true }),
    }) as unknown as RateLimit;

// Create production environment for testing production-specific code paths
// BUG-017 (2026-07-18 audit): must pass validateEnv — production requires
// HTTPS URLs and a real Discord snowflake, and env validation now runs on
// every request instead of only the first one per isolate.
// FINDING-013 (2026-08-29 security audit): production validateEnv now also
// requires TOKEN_BLACKLIST and the three RL_AUTH_* bindings — without these
// every request through this fixture would 500 "Service misconfigured".
export const createProductionEnv = (): Env => ({
    ...env,
    ENVIRONMENT: 'production',
    FRONTEND_URL: 'https://xivdyetools.app',
    WORKER_URL: 'https://auth.xivdyetools.app',
    DISCORD_CLIENT_ID: '123456789012345678',
    TOKEN_BLACKLIST: createMockKV() as unknown as KVNamespace,
    RL_AUTH_10: createMockRateLimit(),
    RL_AUTH_20: createMockRateLimit(),
    RL_AUTH_30: createMockRateLimit(),
});

// Create environment with KV namespace for revocation tests
export const createEnvWithKV = (): Env & { TOKEN_BLACKLIST: KVNamespace } => ({
    ...env,
    TOKEN_BLACKLIST: createMockKV() as unknown as KVNamespace,
});

// SELF helper to make requests to the worker
export const SELF = {
    async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const request = new Request(input, init);
        return app.fetch(request, env);
    },
};

// Helper to make requests with a custom environment
export const fetchWithEnv = async (
    customEnv: Env,
    input: RequestInfo | URL,
    init?: RequestInit
): Promise<Response> => {
    const request = new Request(input, init);
    return app.fetch(request, customEnv);
};
