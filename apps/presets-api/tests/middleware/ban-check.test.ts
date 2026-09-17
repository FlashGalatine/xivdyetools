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

/**
 * BUG-043 (2026-09-16 deep-dive): the shared mock's `first()` special-cases
 * ANY `SELECT 1 FROM banned_users` query and answers from `_setBanStatus()`
 * regardless of the bound value (see d1.ts's own comment on the
 * special-case) — so a suite built only on `_setBanStatus` cannot see which
 * id or column was bound, which is exactly how BUG-001 (the ban check
 * binding a Discord ID even for a JWT `sub` UUID) went uncaught. This double
 * models a real `banned_users` row keyed on exactly one id: "banned" only
 * when the bound value equals `expectedId`, `null` (not banned) otherwise —
 * so a test using the wrong identity, or the wrong column, fails instead of
 * silently passing.
 */
function withBanStatusKeyedOn(
    base: ReturnType<typeof createMockD1Database>,
    expectedId: string
): D1Database {
    return {
        ...base,
        prepare: (query: string) => {
            if (query.includes('banned_users') && /SELECT\s+1\s+FROM/i.test(query)) {
                return {
                    bind: (...values: unknown[]) => ({
                        first: async () => (values[0] === expectedId ? { 1: 1 } : null),
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
            // BUG-043: a row scripted for the exact Discord ID the request
            // binds, not the identity-blind `_setBanStatus`.
            const keyedEnv = createMockEnv({ DB: withBanStatusKeyedOn(mockDb, '123456789') });

            const res = await app.request(
                '/test/action',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                keyedEnv
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
            // BUG-043: keyed on the `sub` this token carries (it sends no
            // `discord_id` claim, so `resolveJWTUserId` falls back to `sub`)
            // instead of the identity-blind `_setBanStatus`.
            const keyedEnv = createMockEnv({ DB: withBanStatusKeyedOn(mockDb, '123456789') });

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
                keyedEnv
            );

            expect(res.status).toBe(403);
        });

        // BUG-001 path (a) / BUG-043 (2026-09-16 deep-dive, coordinator
        // ruling): an XIVAuth-only account has no Discord snowflake, so
        // `resolveJWTUserId` falls back to the JWT `sub` — the oauth
        // worker's internal user UUID — and that UUID is what gets bound
        // here. The suite above could never see this because
        // `_setBanStatus` answers "banned" for ANY bound value.
        it('blocks a banned user identified only by their XIVAuth sub UUID (BUG-001 path (a))', async () => {
            const subUuid = '3f9c2a1e-7b4d-4e8a-9c1f-5d6e7a8b9c0d';
            const keyedEnv = createMockEnv({ DB: withBanStatusKeyedOn(mockDb, subUuid) });
            // No `discord_id` claim: an XIVAuth-only account.
            const jwt = await createTestJWT(JWT_SECRET, { sub: subUuid, username: 'xivauth-user' });

            const res = await app.request(
                '/test/action',
                { headers: { Authorization: `Bearer ${jwt}` } },
                keyedEnv
            );

            expect(res.status).toBe(403);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('USER_BANNED');
        });

        // Inverse of the case above: the scripted row is keyed on a
        // DIFFERENT id than the one this token resolves to, so a ban check
        // that bound the wrong value (or queried the wrong column) would
        // wrongly report banned. Passing through instead is what proves the
        // sub UUID case above wasn't just a mock that always returns banned.
        it('passes through when the banned row is keyed on a different id than the resolved sub', async () => {
            const subUuid = '3f9c2a1e-7b4d-4e8a-9c1f-5d6e7a8b9c0d';
            const someoneElsesId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
            const keyedEnv = createMockEnv({ DB: withBanStatusKeyedOn(mockDb, someoneElsesId) });
            const jwt = await createTestJWT(JWT_SECRET, { sub: subUuid, username: 'xivauth-user' });

            const res = await app.request(
                '/test/action',
                { headers: { Authorization: `Bearer ${jwt}` } },
                keyedEnv
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };
            expect(body.success).toBe(true);
        });
    });
});
