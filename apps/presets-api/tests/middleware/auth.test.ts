/**
 * Authentication Middleware Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import {
    authMiddleware,
    requireAuth,
    requireModerator,
    requireUserContext,
} from '../../src/middleware/auth';
import type { Env, AuthContext } from '../../src/types';
import { createMockEnv, createTestJWT, createExpiredJWT } from '../test-utils';
import { createMockKV } from '@xivdyetools/test-utils';
import { base64UrlEncode, base64UrlEncodeBytes, createBotSignatureV2 } from '@xivdyetools/auth';

type Variables = {
    auth: AuthContext;
};

describe('AuthMiddleware', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;

    beforeEach(() => {
        env = createMockEnv();
        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);

        // Test route that exposes auth context
        app.get('/test/auth', (c) => {
            const auth = c.get('auth');
            return c.json(auth);
        });

        // Protected route
        app.get('/test/protected', (c) => {
            const authError = requireAuth(c);
            if (authError) return authError;
            return c.json({ success: true });
        });

        // Moderator route
        app.get('/test/moderator', (c) => {
            const modError = requireModerator(c);
            if (modError) return modError;
            return c.json({ success: true });
        });

        // User context route
        app.get('/test/user-context', (c) => {
            const userError = requireUserContext(c);
            if (userError) return userError;
            return c.json({ userDiscordId: c.get('auth').userDiscordId });
        });
    });

    // ============================================
    // Unauthenticated Access
    // ============================================

    describe('Unauthenticated Access', () => {
        it('should set unauthenticated context when no auth header', async () => {
            const res = await app.request('/test/auth', {}, env);
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
            expect(body.isModerator).toBe(false);
            expect(body.authSource).toBe('none');
        });

        it('should set unauthenticated context with invalid bearer format', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: { Authorization: 'Basic abc123' },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should set unauthenticated with empty bearer token', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: { Authorization: 'Bearer ' },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });
    });

    // ============================================
    // Bot Authentication
    // ============================================

    describe('Bot Authentication', () => {
        it('should authenticate with valid BOT_API_SECRET', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                        'X-User-Discord-Name': 'BotUser',
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.authSource).toBe('bot');
            expect(body.userDiscordId).toBe('123456789');
            expect(body.userName).toBe('BotUser');
        });

        it('should not authenticate with invalid BOT_API_SECRET', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer wrong-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should mark bot user as moderator if in MODERATOR_IDS', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789', // In MODERATOR_IDS
                        'X-User-Discord-Name': 'ModeratorUser',
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.isModerator).toBe(true);
        });

        it('should not mark non-moderator bot user as moderator', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '111222333', // Not in MODERATOR_IDS
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.isModerator).toBe(false);
        });

        it('should handle missing X-User-Discord-ID with bot auth', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.userDiscordId).toBeUndefined();
        });

        it('should reject bot auth in production when BOT_SIGNING_SECRET is not configured', async () => {
            // In production, BOT_SIGNING_SECRET is required for bot auth
            const prodEnv = createMockEnv({
                ENVIRONMENT: 'production',
                BOT_SIGNING_SECRET: undefined, // Not configured
            });

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                    },
                },
                prodEnv
            );
            const body = await res.json() as AuthContext;

            // Should NOT be authenticated because BOT_SIGNING_SECRET is required in production
            expect(body.isAuthenticated).toBe(false);
        });
    });

    // ============================================
    // JWT (Web) Authentication
    // Node >= 18 exposes the same WebCrypto (`crypto.subtle`) the Worker
    // runtime uses, so HS256 signature verification runs for real here.
    // ============================================

    describe('JWT Authentication', () => {
        const JWT_SECRET = 'test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!';

        it('should authenticate with valid JWT', async () => {
            const jwt = await createTestJWT(JWT_SECRET, {
                sub: 'jwt-user-123',
                username: 'JWTUser',
                global_name: 'JWT Display Name',
                avatar: 'abc123',
            });

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.authSource).toBe('web');
            expect(body.userDiscordId).toBe('jwt-user-123');
            expect(body.userName).toBe('JWT Display Name'); // global_name preferred
        });

        it('should use username if global_name is null', async () => {
            const jwt = await createTestJWT(JWT_SECRET, {
                sub: 'jwt-user-123',
                username: 'JWTUser',
                global_name: null,
                avatar: null,
            });

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.userName).toBe('JWTUser');
        });

        it('should reject expired JWT', async () => {
            const jwt = await createExpiredJWT('test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!');

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should reject JWT with wrong secret', async () => {
            const jwt = await createTestJWT('wrong-secret', {
                sub: 'user-123',
                username: 'User',
            });

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should reject malformed JWT', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer not.a.valid.jwt.token',
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should reject JWT with invalid base64', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer !!!.@@@.###',
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should skip JWT auth if JWT_SECRET not configured', async () => {
            const noJwtEnv = createMockEnv({ JWT_SECRET: undefined });

            const jwt = await createTestJWT('any-secret', {
                sub: 'user-123',
                username: 'User',
            });

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                },
                noJwtEnv
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should mark JWT user as moderator if in MODERATOR_IDS', async () => {
            const jwt = await createTestJWT(JWT_SECRET, {
                sub: '123456789', // In MODERATOR_IDS
                username: 'ModUser',
            });

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: `Bearer ${jwt}`,
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isModerator).toBe(true);
        });

        // ------------------------------------------------------------
        // Identity claim selection.
        // The oauth worker mints `sub` = its internal user UUID and carries the
        // Discord snowflake in a separate `discord_id` claim (XIVAuth-only
        // users have no `discord_id`). The bot path (discord-worker /
        // moderation-worker) identifies users by snowflake via
        // X-User-Discord-ID, so the JWT path must resolve to the SAME key or
        // one person becomes two authors (`/mine`, edit/delete ownership,
        // bans, MODERATOR_IDS all diverge).
        // ------------------------------------------------------------

        it('should use the discord_id claim as the user identity when present (not sub)', async () => {
            // Non-literal so TS excess-property checks don't reject the extra claim
            const claims = {
                sub: '3f1c9d2e-8a4b-4c1d-9e0f-123456789abc', // internal oauth UUID
                discord_id: '555666777888999000',
                username: 'WebUser',
            };
            const jwt = await createTestJWT(JWT_SECRET, claims);

            const res = await app.request(
                '/test/auth',
                { headers: { Authorization: `Bearer ${jwt}` } },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.authSource).toBe('web');
            expect(body.userDiscordId).toBe('555666777888999000');
        });

        it('should fall back to sub when the JWT has no discord_id (XIVAuth-only user)', async () => {
            const claims = {
                sub: '3f1c9d2e-8a4b-4c1d-9e0f-123456789abc',
                username: 'XIVAuthOnly',
                auth_provider: 'xivauth',
                xivauth_id: 'xiv-42',
            };
            const jwt = await createTestJWT(JWT_SECRET, claims);

            const res = await app.request(
                '/test/auth',
                { headers: { Authorization: `Bearer ${jwt}` } },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.userDiscordId).toBe('3f1c9d2e-8a4b-4c1d-9e0f-123456789abc');
        });

        it('should ignore an empty discord_id claim and fall back to sub', async () => {
            const claims = {
                sub: 'user-uuid-1',
                discord_id: '',
                username: 'EmptyClaim',
            };
            const jwt = await createTestJWT(JWT_SECRET, claims);

            const res = await app.request(
                '/test/auth',
                { headers: { Authorization: `Bearer ${jwt}` } },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.userDiscordId).toBe('user-uuid-1');
        });

        it('should ignore a non-string discord_id claim and fall back to sub', async () => {
            const claims = {
                sub: 'user-uuid-2',
                discord_id: 555666777888999000, // numeric snowflake would lose precision anyway
                username: 'BadClaim',
            };
            const jwt = await createTestJWT(JWT_SECRET, claims);

            const res = await app.request(
                '/test/auth',
                { headers: { Authorization: `Bearer ${jwt}` } },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.userDiscordId).toBe('user-uuid-2');
        });

        it('should evaluate MODERATOR_IDS against the discord_id claim, not sub', async () => {
            const claims = {
                sub: 'not-a-moderator-uuid',
                discord_id: '123456789', // In MODERATOR_IDS
                username: 'WebMod',
            };
            const jwt = await createTestJWT(JWT_SECRET, claims);

            const res = await app.request(
                '/test/auth',
                { headers: { Authorization: `Bearer ${jwt}` } },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isModerator).toBe(true);
            expect(body.userDiscordId).toBe('123456789');
        });

        it('should give web (JWT) and bot (header) requests the same identity for the same Discord user', async () => {
            const claims = {
                sub: 'oauth-row-uuid',
                discord_id: '999888777666555444',
                username: 'SamePerson',
            };
            const jwt = await createTestJWT(JWT_SECRET, claims);

            const webRes = await app.request(
                '/test/user-context',
                { headers: { Authorization: `Bearer ${jwt}` } },
                env
            );
            const botRes = await app.request(
                '/test/user-context',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '999888777666555444',
                    },
                },
                env
            );

            const web = await webRes.json() as { userDiscordId: string };
            const bot = await botRes.json() as { userDiscordId: string };
            expect(web.userDiscordId).toBe('999888777666555444');
            expect(web.userDiscordId).toBe(bot.userDiscordId);
        });
    });

    // ============================================
    // requireAuth
    // ============================================

    describe('requireAuth', () => {
        it('should allow authenticated requests', async () => {
            const res = await app.request(
                '/test/protected',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { success: boolean };
            expect(body.success).toBe(true);
        });

        it('should reject unauthenticated requests with 401', async () => {
            const res = await app.request('/test/protected', {}, env);

            expect(res.status).toBe(401);
            const body = await res.json() as { error: string };
            // REFACTOR-003: the guards now use the canonical ErrorCode envelope.
            expect(body.error).toBe('UNAUTHORIZED');
        });
    });

    // ============================================
    // requireModerator
    // ============================================

    describe('requireModerator', () => {
        it('should allow moderator requests', async () => {
            const res = await app.request(
                '/test/moderator',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789', // In MODERATOR_IDS
                    },
                },
                env
            );

            expect(res.status).toBe(200);
        });

        it('should reject unauthenticated requests with 401', async () => {
            const res = await app.request('/test/moderator', {}, env);

            expect(res.status).toBe(401);
        });

        it('should reject non-moderator with 403', async () => {
            const res = await app.request(
                '/test/moderator',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '999999999', // Not in MODERATOR_IDS
                    },
                },
                env
            );

            expect(res.status).toBe(403);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('FORBIDDEN');
        });
    });

    // ============================================
    // requireUserContext
    // ============================================

    describe('requireUserContext', () => {
        it('should allow requests with user Discord ID', async () => {
            const res = await app.request(
                '/test/user-context',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': 'user-123',
                    },
                },
                env
            );

            expect(res.status).toBe(200);
            const body = await res.json() as { userDiscordId: string };
            expect(body.userDiscordId).toBe('user-123');
        });

        it('should reject requests without user Discord ID with 400', async () => {
            const res = await app.request(
                '/test/user-context',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        // No X-User-Discord-ID
                    },
                },
                env
            );

            expect(res.status).toBe(400);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('VALIDATION_ERROR');
        });
    });

    // ============================================
    // Moderator IDs Parsing
    // ============================================

    describe('Moderator IDs Parsing', () => {
        it('should handle comma-separated moderator IDs with spaces', async () => {
            const spaceEnv = createMockEnv({
                MODERATOR_IDS: '111, 222, 333',
            });

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '222',
                    },
                },
                spaceEnv
            );
            const body = await res.json() as AuthContext;

            expect(body.isModerator).toBe(true);
        });

        it('should handle single moderator ID', async () => {
            const singleEnv = createMockEnv({
                MODERATOR_IDS: '555',
            });

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '555',
                    },
                },
                singleEnv
            );
            const body = await res.json() as AuthContext;

            expect(body.isModerator).toBe(true);
        });

        it('should handle empty moderator IDs', async () => {
            const emptyEnv = createMockEnv({
                MODERATOR_IDS: '',
            });

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                emptyEnv
            );
            const body = await res.json() as AuthContext;

            expect(body.isModerator).toBe(false);
        });
    });

    // ============================================
    // Auth Priority (Bot over JWT for same token)
    // ============================================

    describe('Authentication Priority', () => {
        it('should prefer bot auth when token matches BOT_API_SECRET', async () => {
            // If the token matches BOT_API_SECRET, it should use bot auth
            // even if it could also be parsed as a JWT
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.authSource).toBe('bot');
        });
    });

    // ============================================
    // HMAC Request Signing (Bot Auth Security)
    // ============================================

    describe('Bot Auth with Signing Secret (v2)', () => {
        const SIGNING_SECRET = 'test-signing-secret-at-least-32-bytes!!!-at-least-32-bytes!!!';
        let signingEnv: Env;

        beforeEach(() => {
            signingEnv = createMockEnv({ BOT_SIGNING_SECRET: SIGNING_SECRET });
        });

        /**
         * Headers for a v2-signed `GET /test/auth`.
         *
         * FINDING-015 (2026-08-29 audit): v1 (`timestamp:userId:userName`) is no
         * longer accepted, so freshness, identity binding and malformed-timestamp
         * handling are exercised through the v2 signature both bots actually send
         * (a v1-only request is rejected — see auth-v2.test.ts). Each call signs a
         * fresh nonce; no KV is bound here, so the replay cache is inert.
         */
        async function signedHeaders(
            options: {
                timestamp?: string;
                userDiscordId?: string;
                userName?: string;
                /** Identity put on the wire when it must differ from the signed one */
                sentUserDiscordId?: string;
            } = {}
        ): Promise<Record<string, string>> {
            const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000).toString();
            const userDiscordId = options.userDiscordId ?? '123456789';
            const userName = options.userName ?? 'TestUser';
            const nonce = crypto.randomUUID();
            const signature = await createBotSignatureV2(
                { method: 'GET', path: '/test/auth', timestamp, nonce, userDiscordId, userName },
                SIGNING_SECRET
            );
            const headers: Record<string, string> = {
                Authorization: 'Bearer test-bot-secret',
                'X-Request-Timestamp': timestamp,
                'X-Request-Nonce': nonce,
                'X-Request-Signature-V2': signature,
            };
            const sentUserDiscordId = options.sentUserDiscordId ?? userDiscordId;
            if (sentUserDiscordId) headers['X-User-Discord-ID'] = sentUserDiscordId;
            if (userName) headers['X-User-Discord-Name'] = userName;
            return headers;
        }

        it('should reject bot auth without signature when signing secret configured', async () => {
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                        'X-User-Discord-Name': 'TestUser',
                    },
                },
                signingEnv
            );
            const body = await res.json() as { isAuthenticated: boolean };

            // Should be unauthenticated due to missing signature
            expect(body.isAuthenticated).toBe(false);
        });

        it('should authenticate with valid signature', async () => {
            const res = await app.request('/test/auth', { headers: await signedHeaders() }, signingEnv);
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.authSource).toBe('bot');
            expect(body.userDiscordId).toBe('123456789');
        });

        it('should reject request with invalid signature', async () => {
            const headers = await signedHeaders();
            headers['X-Request-Signature-V2'] = 'invalid-signature';

            const res = await app.request('/test/auth', { headers }, signingEnv);
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should reject request with expired timestamp (older than the v2 window)', async () => {
            const expiredTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 6+ minutes ago

            const res = await app.request(
                '/test/auth',
                { headers: await signedHeaders({ timestamp: expiredTimestamp }) },
                signingEnv
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should reject request with future timestamp (beyond the clock-skew allowance)', async () => {
            const futureTimestamp = (Math.floor(Date.now() / 1000) + 400).toString(); // 6+ minutes in future

            const res = await app.request(
                '/test/auth',
                { headers: await signedHeaders({ timestamp: futureTimestamp }) },
                signingEnv
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should reject request with invalid timestamp format', async () => {
            const headers = await signedHeaders({ timestamp: 'not-a-number' });

            const res = await app.request('/test/auth', { headers }, signingEnv);
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should handle missing timestamp', async () => {
            const headers = await signedHeaders();
            delete headers['X-Request-Timestamp'];

            const res = await app.request('/test/auth', { headers }, signingEnv);
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should work with empty user ID and name in signature', async () => {
            const res = await app.request(
                '/test/auth',
                { headers: await signedHeaders({ userDiscordId: '', userName: '' }) },
                signingEnv
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.userDiscordId).toBeUndefined();
        });

        it('should reject tampered user ID (header spoofing attempt)', async () => {
            // Sign with one user ID, send a different one in the header
            const res = await app.request(
                '/test/auth',
                { headers: await signedHeaders({ sentUserDiscordId: 'different-user-id' }) },
                signingEnv
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });
    });

    // ============================================
    // JWT Algorithm Validation
    // ============================================

    describe('JWT Security', () => {
        it('should reject JWT with wrong algorithm (alg confusion attack)', async () => {
            // Create a JWT with "none" algorithm
            const header = { alg: 'none', typ: 'JWT' };
            const payload = {
                sub: 'user-123',
                username: 'TestUser',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
                iss: 'xivdyetools-oauth-worker',
            };

            const encodeBase64Url = (obj: object): string => {
                const bytes = new TextEncoder().encode(JSON.stringify(obj));
                let binary = '';
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            };

            const fakeJwt = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}.`;

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: `Bearer ${fakeJwt}`,
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should reject JWT with RS256 algorithm', async () => {
            const header = { alg: 'RS256', typ: 'JWT' };
            const payload = {
                sub: 'user-123',
                username: 'TestUser',
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600,
            };

            const encodeBase64Url = (obj: object): string => {
                const bytes = new TextEncoder().encode(JSON.stringify(obj));
                let binary = '';
                for (let i = 0; i < bytes.length; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            };

            const fakeJwt = `${encodeBase64Url(header)}.${encodeBase64Url(payload)}.fake-signature`;

            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: `Bearer ${fakeJwt}`,
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('should reject JWT with invalid header JSON', async () => {
            // Invalid base64 that decodes to invalid JSON
            const invalidHeader = 'bm90LWpzb24';
            const res = await app.request(
                '/test/auth',
                {
                    headers: {
                        Authorization: `Bearer ${invalidHeader}.payload.signature`,
                    },
                },
                env
            );
            const body = await res.json() as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });
    });

    // ============================================
    // Revocation + issuer enforcement (FINDING-002 / FINDING-015)
    // ============================================

    describe('JWT revocation and issuer checks', () => {
        /** Mint an HS256 JWT with arbitrary claims (jti, iss, …) for these tests. */
        async function mintJWT(secret: string, claims: Record<string, unknown>): Promise<string> {
            const now = Math.floor(Date.now() / 1000);
            const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
            const payload = base64UrlEncode(
                JSON.stringify({ sub: 'user-uuid', iat: now, exp: now + 3600, ...claims })
            );
            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(secret),
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const sig = await crypto.subtle.sign(
                'HMAC',
                key,
                new TextEncoder().encode(`${header}.${payload}`)
            );
            return `${header}.${payload}.${base64UrlEncodeBytes(new Uint8Array(sig))}`;
        }

        it('treats a JWT whose jti is on the TOKEN_BLACKLIST as unauthenticated', async () => {
            const kv = createMockKV();
            await kv.put('revoked:jti-revoked', '1', { expirationTtl: 3600 });
            const revokedEnv = createMockEnv({ TOKEN_BLACKLIST: kv as unknown as KVNamespace });

            const token = await mintJWT(revokedEnv.JWT_SECRET!, {
                jti: 'jti-revoked',
                discord_id: '555',
            });
            const res = await app.request(
                '/test/auth',
                { headers: { Authorization: `Bearer ${token}` } },
                revokedEnv
            );
            const body = (await res.json()) as AuthContext;

            expect(body.isAuthenticated).toBe(false);
        });

        it('still authenticates a JWT whose jti is NOT on the TOKEN_BLACKLIST', async () => {
            const kv = createMockKV();
            const kvEnv = createMockEnv({ TOKEN_BLACKLIST: kv as unknown as KVNamespace });

            const token = await mintJWT(kvEnv.JWT_SECRET!, { jti: 'jti-live', discord_id: '555' });
            const res = await app.request(
                '/test/auth',
                { headers: { Authorization: `Bearer ${token}` } },
                kvEnv
            );
            const body = (await res.json()) as AuthContext;

            expect(body.isAuthenticated).toBe(true);
            expect(body.userDiscordId).toBe('555');
        });

        it('rejects a JWT from a different issuer when JWT_ISSUER is configured', async () => {
            const issuerEnv = createMockEnv({ JWT_ISSUER: 'https://auth.xivdyetools.app' });

            const foreign = await mintJWT(issuerEnv.JWT_SECRET!, {
                iss: 'https://auth-preview.example',
                discord_id: '555',
            });
            const res = await app.request(
                '/test/auth',
                { headers: { Authorization: `Bearer ${foreign}` } },
                issuerEnv
            );
            expect(((await res.json()) as AuthContext).isAuthenticated).toBe(false);

            const own = await mintJWT(issuerEnv.JWT_SECRET!, {
                iss: 'https://auth.xivdyetools.app',
                discord_id: '555',
            });
            const okRes = await app.request(
                '/test/auth',
                { headers: { Authorization: `Bearer ${own}` } },
                issuerEnv
            );
            expect(((await okRes.json()) as AuthContext).isAuthenticated).toBe(true);
        });
    });
});
