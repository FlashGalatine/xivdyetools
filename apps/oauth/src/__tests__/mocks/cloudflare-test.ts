/**
 * Mock for cloudflare:test module
 * Provides SELF and env for testing the worker
 *
 * Some utilities are now imported from @xivdyetools/test-utils.
 * This file contains project-specific utilities that require local types.
 */

import app from '../../index.js';
import type { Env, UserRow } from '../../types.js';

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

// In-memory user store for D1 mock
const userStore = new Map<string, UserRow>();

/**
 * One executed D1 statement, as the worker issued it.
 *
 * The 2026-08-29 audit (FINDING-001 / FINDING-002) turns "what does a login
 * write?" into an assertion, so the mock records every statement it executes
 * instead of quietly swallowing the ones the test does not model.
 */
export interface RecordedStatement {
    sql: string;
    params: unknown[];
}

const statementLog: RecordedStatement[] = [];

/** Every statement executed since the last reset, in order. */
export const recordedStatements: RecordedStatement[] = statementLog;

/** Clear the statement log — call from `beforeEach` in suites that assert on it. */
export const resetRecordedStatements = (): void => {
    statementLog.length = 0;
};

// Mock D1Database for user management tests
export const createMockDB = (): D1Database & { _users: Map<string, UserRow> } => {
    const users = userStore;

    // Helper to create a chainable statement
    const createStatement = (sql: string) => {
        let boundParams: unknown[] = [];

        const record = (): void => {
            statementLog.push({ sql, params: [...boundParams] });
        };

        const statement = {
            bind: (...params: unknown[]) => {
                boundParams = params;
                return statement;
            },
            first: async <T>(): Promise<T | null> => {
                record();
                // Handle SELECT queries
                if (sql.includes('SELECT') && sql.includes('discord_id = ?')) {
                    const discordId = boundParams[0] as string;
                    for (const user of users.values()) {
                        if (user.discord_id === discordId) {
                            return user as T;
                        }
                    }
                    return null;
                }
                if (sql.includes('SELECT') && sql.includes('xivauth_id = ?')) {
                    const xivauthId = boundParams[0] as string;
                    for (const user of users.values()) {
                        if (user.xivauth_id === xivauthId) {
                            return user as T;
                        }
                    }
                    return null;
                }
                if (sql.includes('SELECT') && sql.includes('WHERE id = ?')) {
                    const userId = boundParams[boundParams.length - 1] as string;
                    return (users.get(userId) as T) || null;
                }
                return null;
            },
            run: async () => {
                record();
                // Handle INSERT for new users
                if (sql.includes('INSERT INTO users')) {
                    const [id, discord_id, xivauth_id, auth_provider, username] =
                        boundParams as [string, string | null, string | null, string, string];
                    const now = new Date().toISOString();
                    users.set(id, {
                        id,
                        discord_id,
                        xivauth_id,
                        auth_provider,
                        username,
                        created_at: now,
                        updated_at: now,
                    });
                    return { success: true, meta: {} };
                }
                // Handle UPDATE
                if (sql.includes('UPDATE users')) {
                    const userId = boundParams[boundParams.length - 1] as string;
                    const existing = users.get(userId);
                    if (existing) {
                        existing.updated_at = new Date().toISOString();
                    }
                    return { success: true, meta: {} };
                }
                // FINDING-001: the xivauth_characters special cases are gone
                // with the table. Any statement this mock does not model is
                // still recorded above, so a suite can assert on it.
                return { success: true, meta: {} };
            },
            all: async <T>(): Promise<D1Result<T>> => {
                record();
                return { results: [] as T[], success: true, meta: {} as D1Meta & Record<string, unknown> };
            },
        };
        return statement;
    };

    return {
        _users: users,
        prepare: (sql: string) => createStatement(sql),
        exec: async () => ({ count: 0, duration: 0 }),
        // Execute (and therefore record) the batched statements rather than
        // dropping them — a batch is how a handler would write bulk rows.
        batch: async (stmts: { run: () => Promise<unknown> }[]) => {
            const results = [];
            for (const stmt of stmts) {
                results.push(await stmt.run());
            }
            return results;
        },
        dump: async () => new ArrayBuffer(0),
    } as unknown as D1Database & { _users: Map<string, UserRow> };
};

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

// Create production environment for testing production-specific code paths
// BUG-017 (2026-07-18 audit): must pass validateEnv — production requires
// HTTPS URLs and a real Discord snowflake, and env validation now runs on
// every request instead of only the first one per isolate.
export const createProductionEnv = (): Env => ({
    ...env,
    ENVIRONMENT: 'production',
    FRONTEND_URL: 'https://xivdyetools.app',
    WORKER_URL: 'https://auth.xivdyetools.app',
    DISCORD_CLIENT_ID: '123456789012345678',
});

// Create broken production environment for testing env validation failure
export const createBrokenProductionEnv = (): Partial<Env> => ({
    ENVIRONMENT: 'production',
    // Missing required fields to trigger validation failure
    DB: mockDB,
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
