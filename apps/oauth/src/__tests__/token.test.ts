/**
 * Token Handler Tests
 * Tests for the user-info and revoke endpoints, plus a guard that the removed
 * /auth/refresh endpoint stays removed (FINDING-003).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SELF, env, fetchWithEnv, createEnvWithKV } from './mocks/cloudflare-test.js';
import { createJWTForUser, revokeToken, isTokenRevoked } from '../services/jwt-service.js';
import { resetRateLimiter } from '../services/rate-limit.js';
import type { DiscordUser, Env } from '../types.js';

// Get environment from test context
const getEnv = (): Env => env;

const createMockUser = (): DiscordUser => ({
    id: '123456789',
    username: 'testuser',
    discriminator: '0001',
    global_name: 'Test User',
    avatar: 'abc123',
});

// REFACTOR-001: createJWT was removed from jwt-service; mint via
// createJWTForUser the same way the callback handlers do
const createJWT = (
    user: DiscordUser,
    tokenEnv: Env,
): Promise<{ token: string; expires_at: number; jti: string }> =>
    createJWTForUser(
        {
            id: user.id,
            discord_id: user.id,
            xivauth_id: null,
            auth_provider: 'discord',
            username: user.username,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
        },
        tokenEnv,
        { auth_provider: 'discord', global_name: user.global_name, avatar: user.avatar },
    );

describe('Token Handler', () => {
    let mockEnv: Env;
    let mockUser: DiscordUser;

    beforeEach(() => {
        mockEnv = getEnv();
        mockUser = createMockUser();
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
        resetRateLimiter();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * FINDING-003 (2026-08-29 security audit): /auth/refresh is gone. No client
     * ever called it — the web app re-runs the sign-in flow — while anyone
     * holding a copied token could re-mint it every hour for up to 30 days and
     * survive the victim's logout (only the presented jti was blacklisted).
     * The route must now 404 like any other unknown path, even for a token
     * that is perfectly valid.
     */
    describe('POST /auth/refresh (removed — FINDING-003)', () => {
        it('should 404 a valid token instead of minting a new one', async () => {
            const { token } = await createJWT(mockUser, mockEnv);

            const response = await SELF.fetch('http://localhost/auth/refresh', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(404);
            expect(json.error).toBe('Not Found');
            expect(json).not.toHaveProperty('token');
        });
    });

    describe('GET /auth/me', () => {
        it('should reject missing Authorization header', async () => {
            const response = await SELF.fetch('http://localhost/auth/me');
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('Authorization');
        });

        it('should reject non-Bearer authorization', async () => {
            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: 'Basic dXNlcjpwYXNz' },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.error).toContain('Authorization');
        });

        it('should return user info for valid token', async () => {
            const { token } = await createJWT(mockUser, mockEnv);

            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.user.id).toBe(mockUser.id);
            expect(json.user.username).toBe(mockUser.username);
            expect(json.user.global_name).toBe(mockUser.global_name);
            expect(json.user.avatar).toBe(mockUser.avatar);
        });

        // FINDING-022 (2026-08-29 security audit): the profile a bearer token
        // buys is as cacheable-sensitive as the token itself (RFC 6749 §5.1).
        it('should send Cache-Control: no-store on the user-info response', async () => {
            const { token } = await createJWT(mockUser, mockEnv);

            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });

            expect(response.status).toBe(200);
            expect(response.headers.get('Cache-Control')).toBe('no-store');
            expect(response.headers.get('Pragma')).toBe('no-cache');
        });

        it('should include avatar_url in response', async () => {
            const { token } = await createJWT(mockUser, mockEnv);

            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(json.user.avatar_url).toContain('cdn.discordapp.com');
            expect(json.user.avatar_url).toContain(mockUser.id);
            expect(json.user.avatar_url).toContain(mockUser.avatar);
        });

        it('should return null avatar_url when avatar is null', async () => {
            mockUser.avatar = null;
            const { token } = await createJWT(mockUser, mockEnv);

            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(json.user.avatar).toBeNull();
            expect(json.user.avatar_url).toBeNull();
        });

        /**
         * 2026-08-29 security-audit remediation (Sprint 2 review of Task 2,
         * oauth 3.0.0): `payload.sub` is the *internal* user UUID
         * (jwt-service.ts: `sub: user.id`), not the Discord snowflake
         * getAvatarUrl() needs — callback.ts's Discord path correctly passes
         * `discordUser.id`, but this handler passed `payload.sub`. Every
         * fixture elsewhere in this file (createJWT() above) sets the mock
         * UserRow's internal `id` EQUAL to the Discord id, which makes `sub`
         * and `discord_id` indistinguishable and hid the bug — this test
         * deliberately uses two different values so a regression can't hide
         * the same way. Not a numbered finding; discovered incidentally
         * while confirming nothing needed the (now-removed) stored
         * avatar_url column.
         */
        it('should build avatar_url from the Discord snowflake (discord_id), not the internal UUID (sub)', async () => {
            const internalUuid = 'a1b2c3d4-0000-4000-8000-000000000000';
            const discordSnowflake = '999888777666555444';
            const { token } = await createJWTForUser(
                {
                    id: internalUuid,
                    discord_id: discordSnowflake,
                    xivauth_id: null,
                    auth_provider: 'discord',
                    username: 'distinct-id-user',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                },
                mockEnv,
                { auth_provider: 'discord', global_name: 'Distinct Id User', avatar: 'abc123' }
            );

            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.user.id).toBe(internalUuid); // sub still surfaces as `id` — unrelated to the bug
            expect(json.user.avatar_url).toContain(discordSnowflake);
            expect(json.user.avatar_url).not.toContain(internalUuid);
        });

        it('should return a null avatar_url (falling back, not building a bogus URL) when discord_id is absent', async () => {
            const { token } = await createJWTForUser(
                {
                    id: 'xivauth-only-internal-uuid',
                    discord_id: null,
                    xivauth_id: 'xiv-user-123',
                    auth_provider: 'xivauth',
                    username: 'XIVAuth User xiv-user',
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                },
                mockEnv,
                // avatar deliberately non-null: proves the discord_id guard itself
                // (not getAvatarUrl's own null-avatar-hash short-circuit, which
                // "should return null avatar_url when avatar is null" above
                // already covers) is what returns null here.
                { auth_provider: 'xivauth', global_name: null, avatar: 'some-hash' }
            );

            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.user.avatar_url).toBeNull();
        });

        it('should reject expired token', async () => {
            const { token } = await createJWT(mockUser, mockEnv);

            // Advance time past expiry
            vi.advanceTimersByTime(3601 * 1000);

            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: `Bearer ${token}` },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('expired');
        });

        it('should reject token with invalid signature', async () => {
            const { token } = await createJWT(mockUser, mockEnv);
            // Tamper with the token
            const tamperedToken = token.slice(0, -5) + 'xxxxx';

            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: `Bearer ${tamperedToken}` },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
        });

        it('should reject malformed token', async () => {
            const response = await SELF.fetch('http://localhost/auth/me', {
                headers: { Authorization: 'Bearer not-a-jwt' },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
        });
    });

    describe('POST /auth/revoke', () => {
        it('should return success for revoke request', async () => {
            const { token } = await createJWT(mockUser, mockEnv);

            const response = await SELF.fetch('http://localhost/auth/revoke', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({}),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            // Message will say "revocation" when KV is not available (test env)
            // or "revoked successfully" when KV is available (production)
            expect(json.message.toLowerCase()).toContain('revoc');
        });

        it('should return success without body', async () => {
            const { token } = await createJWT(mockUser, mockEnv);

            const response = await SELF.fetch('http://localhost/auth/revoke', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
        });

        it('should reject missing Authorization header', async () => {
            const response = await SELF.fetch('http://localhost/auth/revoke', {
                method: 'POST',
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('Authorization');
        });

        it('should reject invalid token signature in revoke', async () => {
            // Create a token with an invalid signature
            const forgedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkiLCJpYXQiOjE3MDQwNjc2MDAsImV4cCI6MTcwNDA3MTIwMCwiaXNzIjoiaHR0cDovL2xvY2FsaG9zdDo4Nzg4IiwidXNlcm5hbWUiOiJ0ZXN0IiwiZ2xvYmFsX25hbWUiOm51bGwsImF2YXRhciI6bnVsbH0.invalid_signature';

            const response = await SELF.fetch('http://localhost/auth/revoke', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${forgedToken}`,
                },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('Invalid token');
        });
    });

    describe('Token Revocation with KV', () => {
        it('should successfully revoke token with KV available', async () => {
            const envWithKV = createEnvWithKV();
            const { token, jti } = await createJWT(mockUser, envWithKV);

            // Use the token to revoke itself via the API
            const response = await fetchWithEnv(
                envWithKV,
                'http://localhost/auth/revoke',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.revoked).toBe(true);
            expect(json.message).toContain('revoked successfully');

            // Verify the token JTI is now in the blacklist
            const isRevoked = await isTokenRevoked(jti, envWithKV.TOKEN_BLACKLIST);
            expect(isRevoked).toBe(true);
        });

        it('should reject /me endpoint with revoked token', async () => {
            const envWithKV = createEnvWithKV();
            const { token, jti, expires_at } = await createJWT(mockUser, envWithKV);

            // Revoke the token
            await revokeToken(jti, expires_at, envWithKV.TOKEN_BLACKLIST);

            // Try to use the revoked token
            const response = await fetchWithEnv(
                envWithKV,
                'http://localhost/auth/me',
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('revoked');
        });

        it('should handle token without JTI (older format) gracefully', async () => {
            // Create a token manually without JTI by creating a basic payload
            const base64UrlEncode = (data: string): string => {
                const bytes = new TextEncoder().encode(data);
                const base64 = btoa(String.fromCharCode(...bytes));
                return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            };

            const now = Math.floor(Date.now() / 1000);
            const payload = {
                sub: '123456789',
                iat: now,
                exp: now + 3600,
                iss: 'http://localhost:8788',
                username: 'testuser',
                global_name: 'Test User',
                avatar: 'abc123',
                // Note: no jti field
            };

            const header = { alg: 'HS256', typ: 'JWT' };
            const encodedHeader = base64UrlEncode(JSON.stringify(header));
            const encodedPayload = base64UrlEncode(JSON.stringify(payload));
            const signatureInput = `${encodedHeader}.${encodedPayload}`;

            // Sign with the test secret
            const encoder = new TextEncoder();
            const keyData = encoder.encode(mockEnv.JWT_SECRET);
            const key = await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign']
            );
            const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
            const sigBytes = new Uint8Array(signature);
            const base64Sig = btoa(String.fromCharCode(...sigBytes));
            const encodedSignature = base64Sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

            const tokenWithoutJTI = `${signatureInput}.${encodedSignature}`;

            const envWithKV = createEnvWithKV();

            // Try to revoke - should succeed but indicate token lacks JTI
            const response = await fetchWithEnv(
                envWithKV,
                'http://localhost/auth/revoke',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${tokenWithoutJTI}`,
                    },
                }
            );

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.revoked).toBe(false);
            expect(json.note).toContain('JTI');
        });

        it('should indicate when KV blacklist is not configured', async () => {
            // Use default env without KV
            const { token } = await createJWT(mockUser, mockEnv);

            const response = await SELF.fetch('http://localhost/auth/revoke', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.revoked).toBe(false);
            expect(json.note).toContain('blacklist not configured');
        });
    });

    describe('POST /auth/revoke error handling', () => {
        it('should handle KV errors gracefully during revocation', async () => {
            // Create a mock KV that throws errors
            const errorKV = {
                get: async () => { throw new Error('KV get failed'); },
                put: async () => { throw new Error('KV put failed'); },
                delete: async () => {},
                list: async () => ({ keys: [], list_complete: true, cacheStatus: null }),
                getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
            } as unknown as KVNamespace;

            const envWithErrorKV: Env & { TOKEN_BLACKLIST: KVNamespace } = {
                ...mockEnv,
                TOKEN_BLACKLIST: errorKV,
            };

            const { token } = await createJWT(mockUser, envWithErrorKV);

            // Revoke should fail gracefully (returns success=true, revoked=false)
            const response = await fetchWithEnv(
                envWithErrorKV,
                'http://localhost/auth/revoke',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            const json = (await response.json()) as Record<string, any>;

            // Should succeed but indicate revocation failed
            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.revoked).toBe(false);
        });

        it('should return 401 for malformed token in revoke', async () => {
            // Malformed tokens return 401 (Invalid token) not 500
            // because verifyJWTSignatureOnly returns null for malformed tokens
            const malformedToken = 'not.a.valid.jwt.token.format';

            const response = await SELF.fetch('http://localhost/auth/revoke', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${malformedToken}`,
                },
            });

            const json = (await response.json()) as Record<string, any>;

            // Should return 401 for invalid/malformed tokens
            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('Invalid token');
        });
    });
});
