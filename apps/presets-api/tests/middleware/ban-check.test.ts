/**
 * Ban Check Middleware Tests
 *
 * Tests for the ban-check middleware that blocks banned users from
 * performing actions like submitting presets, editing, and voting.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import { requireNotBanned } from '../../src/middleware/ban-check';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext } from '../../src/types';
import { createMockEnv, createMockD1Database, createTestJWT } from '../test-utils';

type Variables = {
    auth: AuthContext;
};

const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!';

/**
 * FINDING-017: a D1 whose ban lookup throws (D1 incident, missing table) while
 * every other query is still served by the base mock. The shared mock D1
 * special-cases `SELECT 1 FROM banned_users` and never consults _setupMock for
 * it, so the failure has to be injected at the prepare() layer.
 */
function withFailingBanLookup(base: ReturnType<typeof createMockD1Database>): D1Database {
    return {
        ...base,
        prepare: (query: string) => {
            if (query.includes('banned_users')) {
                return {
                    bind: () => ({
                        first: async () => {
                            throw new Error('D1_ERROR: no such table: banned_users');
                        },
                    }),
                };
            }
            return base.prepare(query);
        },
    } as unknown as D1Database;
}

describe('BanCheckMiddleware', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;
    let mockDb: ReturnType<typeof createMockD1Database>;

    beforeEach(() => {
        mockDb = createMockD1Database();
        env = createMockEnv({ DB: mockDb as unknown as D1Database });

        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);

        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ============================================
    // requireNotBanned Middleware
    // ============================================

    describe('requireNotBanned', () => {
        beforeEach(() => {
            // Add middleware and test route
            app.use('/test/*', requireNotBanned);
            app.get('/test/action', (c) => {
                return c.json({ success: true, message: 'Action completed' });
            });
        });

        it('should pass through if user is not authenticated', async () => {
            const res = await app.request('/test/action', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };
            expect(body.success).toBe(true);
        });

        it('should pass through if user has no Discord ID', async () => {
            // Bot auth without X-User-Discord-ID header
            const res = await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        // No X-User-Discord-ID
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };
            expect(body.success).toBe(true);
        });

        it('should pass through if user is not banned', async () => {
            // Default behavior is not banned (no setup needed)

            const res = await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };
            expect(body.success).toBe(true);
        });

        it('should return 403 if user is banned', async () => {
            // Use _setBanStatus to simulate banned user
            mockDb._setBanStatus(true);

            const res = await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(403);
            const body = await res.json() as { success: boolean; error: string; message: string };
            expect(body.success).toBe(false);
            expect(body.error).toBe('USER_BANNED');
            expect(body.message).toBe('You have been banned from using Preset Palettes.');
        });

        it('should check correct Discord ID from header', async () => {
            const testUserId = '999888777';

            await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': testUserId,
                    },
                },
                env
            );

            // Verify the correct user ID was bound to the query
            expect(mockDb._bindings.some((b) => b.includes(testUserId))).toBe(true);
        });

        // FINDING-017 (2026-08-21 security audit): a failed ban lookup used to
        // `console.error` and call next() — a D1 incident silently admitted
        // banned users. Now the request fails CLOSED (503) everywhere except
        // local development, where a fresh D1 may not have the table yet.
        it('fails CLOSED with 503 when the ban lookup throws in production (FINDING-017)', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const prodEnv = createMockEnv({
                DB: withFailingBanLookup(mockDb),
                ENVIRONMENT: 'production',
            });
            const jwt = await createTestJWT(JWT_SECRET, { sub: '123456789', username: 'someone' });

            const res = await app.request(
                '/test/action',
                { headers: { Authorization: `Bearer ${jwt}` } },
                prodEnv
            );

            expect(res.status).toBe(503);
            const body = await res.json() as { success: boolean; error: string; message: string };
            expect(body.success).toBe(false);
            expect(body.error).toBe('SERVICE_UNAVAILABLE');
            expect(body.message).not.toContain('banned'); // the caller is not told they are banned
        });

        it('fails CLOSED in any environment that is not development (e.g. "test")', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const testEnv = createMockEnv({
                DB: withFailingBanLookup(mockDb),
                ENVIRONMENT: 'test',
            });

            const res = await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                testEnv
            );

            expect(res.status).toBe(503);
        });

        it('fails open only in development, and warns about it', async () => {
            vi.spyOn(console, 'error').mockImplementation(() => {});
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
            const devEnv = createMockEnv({ DB: withFailingBanLookup(mockDb) }); // ENVIRONMENT: development

            const res = await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                devEnv
            );

            expect(res.status).toBe(200);
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('development'));
        });

        it('still lets unauthenticated requests through when the lookup is broken (nothing to check)', async () => {
            const prodEnv = createMockEnv({
                DB: withFailingBanLookup(mockDb),
                ENVIRONMENT: 'production',
            });

            const res = await app.request('/test/action', {}, prodEnv);

            expect(res.status).toBe(200);
        });
    });

    // ============================================
    // SQL Query Verification
    // ============================================

    describe('SQL Query Verification', () => {
        beforeEach(() => {
            app.use('/test/*', requireNotBanned);
            app.get('/test/action', (c) => c.json({ success: true }));
        });

        it('should query banned_users table with unbanned_at IS NULL condition', async () => {
            await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            // Verify the query checks for active bans only
            const banQuery = mockDb._queries.find((q) => q.includes('banned_users'));
            expect(banQuery).toBeDefined();
            expect(banQuery).toContain('unbanned_at IS NULL');
        });

        it('should use LIMIT 1 for efficiency', async () => {
            await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            const banQuery = mockDb._queries.find((q) => q.includes('banned_users'));
            expect(banQuery).toContain('LIMIT 1');
        });
    });

    // ============================================
    // Edge Cases
    // ============================================

    describe('Edge Cases', () => {
        beforeEach(() => {
            app.use('/test/*', requireNotBanned);
            app.get('/test/action', (c) => c.json({ success: true }));
        });

        it('should handle user with unbanned_at set (previously banned but unbanned)', async () => {
            // Default behavior - not banned
            // The SQL query has "unbanned_at IS NULL" so users with unbanned_at set are not banned

            const res = await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
        });

        it('should work with JWT authentication', async () => {
            // Create a simple valid JWT for testing
            const jwtSecret = 'test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!';
            const header = { alg: 'HS256', typ: 'JWT' };
            const payload = {
                sub: '123456789',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
                iss: 'test',
                username: 'testuser',
                global_name: 'Test User',
                avatar: null,
            };

            const encoder = new TextEncoder();
            const base64UrlEncode = (obj: object) => {
                const str = JSON.stringify(obj);
                const bytes = encoder.encode(str);
                let base64 = btoa(String.fromCharCode(...bytes));
                return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            };

            const encodedHeader = base64UrlEncode(header);
            const encodedPayload = base64UrlEncode(payload);
            const signatureInput = `${encodedHeader}.${encodedPayload}`;

            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(jwtSecret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const signatureBuffer = await crypto.subtle.sign(
                'HMAC',
                key,
                encoder.encode(signatureInput)
            );
            const signatureArray = new Uint8Array(signatureBuffer);
            let signature = btoa(String.fromCharCode(...signatureArray));
            signature = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

            const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

            const res = await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                },
                env
            );

            expect(res.status).toBe(200);
        });

        it('should block banned user with JWT authentication', async () => {
            mockDb._setBanStatus(true);

            const jwtSecret = 'test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!';
            const header = { alg: 'HS256', typ: 'JWT' };
            const payload = {
                sub: '123456789',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
                iss: 'test',
                username: 'banneduser',
                global_name: 'Banned User',
                avatar: null,
            };

            const encoder = new TextEncoder();
            const base64UrlEncode = (obj: object) => {
                const str = JSON.stringify(obj);
                const bytes = encoder.encode(str);
                let base64 = btoa(String.fromCharCode(...bytes));
                return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            };

            const encodedHeader = base64UrlEncode(header);
            const encodedPayload = base64UrlEncode(payload);
            const signatureInput = `${encodedHeader}.${encodedPayload}`;

            const key = await crypto.subtle.importKey(
                'raw',
                encoder.encode(jwtSecret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const signatureBuffer = await crypto.subtle.sign(
                'HMAC',
                key,
                encoder.encode(signatureInput)
            );
            const signatureArray = new Uint8Array(signatureBuffer);
            let signature = btoa(String.fromCharCode(...signatureArray));
            signature = signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

            const jwt = `${encodedHeader}.${encodedPayload}.${signature}`;

            const res = await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                },
                env
            );

            expect(res.status).toBe(403);
        });
    });
});
