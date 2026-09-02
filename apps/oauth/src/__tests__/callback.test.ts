/**
 * Callback Handler Tests
 * Tests for OAuth callback handling (both GET and POST methods)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    SELF,
    fetchWithEnv,
    createProductionEnv,
    env,
    VALID_CODE_VERIFIER,
    VALID_CODE_CHALLENGE,
    recordedStatements,
    resetRecordedStatements,
} from './mocks/cloudflare-test.js';
import { resetRateLimiter } from '../services/rate-limit.js';
import { signState, type StateData } from '../utils/state-signing.js';

// Store original fetch
const originalFetch = globalThis.fetch;

/**
 * Real S256 challenge for a verifier (RFC 7636 §4.2) — VALID_CODE_CHALLENGE
 * from test-utils is format-valid only, NOT the hash of VALID_CODE_VERIFIER.
 */
async function s256(verifier: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * Signed Discord-flow state, as the authorize handler would mint it
 */
async function createSignedState(overrides: Partial<StateData> = {}): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    return signState(
        {
            csrf: 'test-csrf',
            code_challenge: VALID_CODE_CHALLENGE,
            redirect_uri: 'http://localhost:5173/auth/callback',
            return_path: '/',
            provider: 'discord',
            iat: now,
            exp: now + 600,
            ...overrides,
        },
        env.JWT_SECRET
    );
}

/**
 * What the SPA returns to the POST callback: a signed state whose
 * code_challenge is the real S256 of VALID_CODE_VERIFIER (state is REQUIRED).
 */
async function boundState(): Promise<string> {
    return createSignedState({ code_challenge: await s256(VALID_CODE_VERIFIER) });
}

/**
 * Discord token + user endpoints mocked to succeed; returns the fetch mock so
 * tests can assert whether the token exchange was attempted.
 */
function mockDiscordSuccess(): ReturnType<typeof vi.fn> {
    const mock = vi.fn().mockImplementation((url: string) => {
        if (url.includes('oauth2/token')) {
            return Promise.resolve(new Response(JSON.stringify({
                access_token: 'discord_token',
                token_type: 'Bearer',
                expires_in: 604800,
                refresh_token: 'refresh',
                scope: 'identify',
            }), { status: 200 }));
        }
        if (url.includes('users/@me')) {
            return Promise.resolve(new Response(JSON.stringify({
                id: '123456789012345678',
                username: 'testuser',
                discriminator: '0001',
                global_name: 'Test User',
                avatar: 'abc123',
            }), { status: 200 }));
        }
        return originalFetch(url);
    });
    globalThis.fetch = mock;
    return mock;
}

describe('Callback Handler', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
        resetRateLimiter();
    });

    afterEach(() => {
        vi.useRealTimers();
        // Restore fetch
        globalThis.fetch = originalFetch;
    });

    /**
     * GET /auth/callback tests
     *
     * SECURITY: The GET callback now returns the auth code to the frontend
     * instead of exchanging it directly. The frontend then calls POST /auth/callback
     * with the code + code_verifier from sessionStorage.
     *
     * This ensures the code_verifier NEVER travels through URL redirects.
     */
    describe('GET /auth/callback', () => {
        it('should redirect with error when Discord returns error', async () => {
            const params = new URLSearchParams({
                error: 'access_denied',
                error_description: 'User denied access',
            });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);

            const location = new URL(response.headers.get('location')!);
            expect(location.searchParams.get('error')).toBe('User denied access');
        });

        /**
         * BUG-049: every GET-callback failure redirected to
         * `${FRONTEND_URL}/auth/callback`, discarding the allowlisted origin
         * that started the flow. A user on beta who cancels the consent screen
         * was dumped on the PRODUCTION site — their beta sessionStorage (PKCE
         * verifier, CSRF nonce, return path) is unreachable from there, and the
         * beta app never learns the login failed.
         *
         * The old assertions only ever read `searchParams.get('error')`; none
         * read `location.origin`, and the suite runs on an env where
         * FRONTEND_URL happens to equal the origin under test, so the two
         * coincided.
         */
        it('returns a cancelled login to the origin that started it, not to FRONTEND_URL', async () => {
            // localhost:3000 is on ALLOWED_REDIRECT_ORIGINS and is NOT
            // FRONTEND_URL (which the test env sets to :5173). That distinction
            // is the whole test: with :5173 the assertion passes even against
            // the unfixed code, because target and fallback coincide — which is
            // exactly why the original suite never caught this.
            const state = await createSignedState({
                redirect_uri: 'http://localhost:3000/auth/callback',
            });
            const params = new URLSearchParams({
                error: 'access_denied',
                error_description: 'User denied access',
                state,
            });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);
            const location = new URL(response.headers.get('location')!);
            expect(location.origin).toBe('http://localhost:3000');
            expect(location.searchParams.get('error')).toBe('User denied access');
        });

        it('falls back to FRONTEND_URL when the state is missing or forged', async () => {
            // Nothing trustworthy to recover a target from, so production is
            // the only safe destination — a forged state must never be able to
            // choose one.
            const params = new URLSearchParams({
                error: 'access_denied',
                state: 'not.a.signed.state',
            });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);
            const location = new URL(response.headers.get('location')!);
            expect(location.origin).toBe(new URL(env.FRONTEND_URL).origin);
        });

        it('should use error code when no description provided', async () => {
            const params = new URLSearchParams({
                error: 'access_denied',
            });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);

            const location = new URL(response.headers.get('location')!);
            expect(location.searchParams.get('error')).toBe('access_denied');
        });

        it('should require code parameter', async () => {
            const state = btoa(JSON.stringify({
                csrf: 'test',
                code_challenge: 'challenge',
                redirect_uri: 'http://localhost:5173/auth/callback',
                return_path: '/',
            }));

            const params = new URLSearchParams({ state });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);

            const location = new URL(response.headers.get('location')!);
            expect(location.searchParams.get('error')).toContain('Missing');
        });

        it('should require state parameter', async () => {
            const params = new URLSearchParams({ code: 'auth_code_123' });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);

            const location = new URL(response.headers.get('location')!);
            expect(location.searchParams.get('error')).toContain('Missing');
        });

        it('should handle invalid state encoding', async () => {
            const params = new URLSearchParams({
                code: 'auth_code_123',
                state: 'not-valid-base64!!!',
            });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);

            const location = new URL(response.headers.get('location')!);
            expect(location.searchParams.get('error')).toContain('Invalid state');
        });

        it('should redirect with code (not token) for secure PKCE flow', async () => {
            // GET callback now returns the code to frontend, not the token
            // Frontend then exchanges code via POST /auth/callback with code_verifier

            const state = btoa(JSON.stringify({
                csrf: 'test-csrf-token',
                code_challenge: 'challenge',
                redirect_uri: 'http://localhost:5173/auth/callback',
                return_path: '/',
            }));

            const params = new URLSearchParams({
                code: 'valid_auth_code',
                state,
            });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);

            const location = new URL(response.headers.get('location')!);
            // Should have code (for frontend to exchange via POST)
            expect(location.searchParams.get('code')).toBe('valid_auth_code');
            // Should have csrf token for validation
            expect(location.searchParams.get('csrf')).toBe('test-csrf-token');
            // Should NOT have token (that comes from POST exchange)
            expect(location.searchParams.get('token')).toBeNull();
        });

        it('should include return_path in redirect when provided', async () => {
            const state = btoa(JSON.stringify({
                csrf: 'test',
                code_challenge: 'challenge',
                redirect_uri: 'http://localhost:5173/auth/callback',
                return_path: '/settings',
            }));

            const params = new URLSearchParams({
                code: 'code',
                state,
            });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            const location = new URL(response.headers.get('location')!);
            expect(location.searchParams.get('return_path')).toBe('/settings');
        });

        it('should not include return_path when it is root', async () => {
            const state = btoa(JSON.stringify({
                csrf: 'test',
                code_challenge: 'challenge',
                redirect_uri: 'http://localhost:5173/auth/callback',
                return_path: '/',
            }));

            const params = new URLSearchParams({
                code: 'code',
                state,
            });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            const location = new URL(response.headers.get('location')!);
            expect(location.searchParams.has('return_path')).toBe(false);
        });

        it('should reject expired state token', async () => {
            // Create state with expired timestamp
            const now = Math.floor(Date.now() / 1000);
            const state = btoa(JSON.stringify({
                csrf: 'test',
                code_challenge: 'challenge',
                redirect_uri: 'http://localhost:5173/auth/callback',
                return_path: '/',
                iat: now - 7200, // 2 hours ago
                exp: now - 3600, // Expired 1 hour ago
            }));

            const params = new URLSearchParams({
                code: 'auth_code_123',
                state,
            });

            const response = await SELF.fetch(`http://localhost/auth/callback?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);

            const location = new URL(response.headers.get('location')!);
            expect(location.searchParams.get('error')).toContain('expired');
        });

        // FINDING-012 / OAUTH-5: the SPA needs the worker-signed state back so it
        // can hand it to POST /auth/callback, where the worker binds the
        // code_verifier to the code_challenge it signed at authorize time.
        it('should echo the signed state in the bounce so the SPA can return it for PKCE binding', async () => {
            const state = await createSignedState({ csrf: 'echo-me' });

            const response = await SELF.fetch(
                `http://localhost/auth/callback?${new URLSearchParams({ code: 'code', state })}`,
                { redirect: 'manual' }
            );

            expect(response.status).toBe(302);
            const location = new URL(response.headers.get('location')!);
            expect(location.searchParams.get('state')).toBe(state);
            expect(location.searchParams.get('csrf')).toBe('echo-me');
        });

        // FINDING-012 / OAUTH-4: exact redirect target — an allowlisted origin is
        // not enough, the path must be the SPA callback route.
        it('should refuse to bounce the code to a non-callback path on an allowed origin', async () => {
            const state = await createSignedState({
                redirect_uri: 'http://localhost:5173/some/other/page',
            });

            const response = await SELF.fetch(
                `http://localhost/auth/callback?${new URLSearchParams({ code: 'code', state })}`,
                { redirect: 'manual' }
            );

            expect(response.status).toBe(302);
            const location = new URL(response.headers.get('location')!);
            expect(location.pathname).toBe('/auth/callback');
            expect(location.searchParams.get('code')).toBeNull();
            expect(location.searchParams.get('error')).toBe('Untrusted redirect target');
        });
    });

    /**
     * FINDING-012 / OAUTH-5 (2026-08-21 security audit): the worker never bound
     * the code_verifier to the code_challenge it received — PKCE was delegated
     * entirely to Discord. When the SPA returns the signed state, the worker
     * must verify S256(code_verifier) === state.code_challenge BEFORE calling
     * Discord, so a misconfigured IdP cannot weaken PKCE.
     */
    describe('POST /auth/callback — PKCE binding to the signed state', () => {
        it('should reject a code_verifier that does not match the code_challenge in the signed state', async () => {
            const fetchMock = mockDiscordSuccess();
            // VALID_CODE_CHALLENGE is NOT S256(VALID_CODE_VERIFIER)
            const state = await createSignedState({ code_challenge: VALID_CODE_CHALLENGE });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.success).toBe(false);
            expect(json.error).toBe('PKCE verification failed');
            // Never reached the provider
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should exchange the code when S256(code_verifier) matches the signed state', async () => {
            const fetchMock = mockDiscordSuccess();
            const state = await createSignedState({ code_challenge: await s256(VALID_CODE_VERIFIER) });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.token).toBeTruthy();
            expect(fetchMock).toHaveBeenCalled();
        });

        it('should reject an unsigned state', async () => {
            const fetchMock = mockDiscordSuccess();
            const state = btoa(JSON.stringify({
                csrf: 'x',
                code_challenge: await s256(VALID_CODE_VERIFIER),
                redirect_uri: 'http://localhost:5173/auth/callback',
                return_path: '/',
                provider: 'discord',
            }));

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid state');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should reject a state with a tampered signature', async () => {
            const fetchMock = mockDiscordSuccess();
            const signed = await createSignedState({ code_challenge: await s256(VALID_CODE_VERIFIER) });
            const [payload, signature] = signed.split('.');
            const flipped = signature[0] === 'A' ? 'B' : 'A';
            const tampered = `${payload}.${flipped}${signature.slice(1)}`;

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state: tampered }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid state');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should reject a state minted for another provider', async () => {
            const fetchMock = mockDiscordSuccess();
            const state = await createSignedState({
                provider: 'xivauth',
                code_challenge: await s256(VALID_CODE_VERIFIER),
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid state');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should reject an expired state', async () => {
            const fetchMock = mockDiscordSuccess();
            const now = Math.floor(Date.now() / 1000);
            const state = await createSignedState({
                code_challenge: await s256(VALID_CODE_VERIFIER),
                iat: now - 1200,
                exp: now - 600,
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid state');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should reject a state that is not a string', async () => {
            const fetchMock = mockDiscordSuccess();

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state: 12345 }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid state');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should reject a signed state that carries no code_challenge', async () => {
            const fetchMock = mockDiscordSuccess();
            const state = await createSignedState({ code_challenge: undefined });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid state');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('should reject an absurdly long state without trying to verify it', async () => {
            const fetchMock = mockDiscordSuccess();

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'valid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: 'a'.repeat(5000) + '.' + 'b'.repeat(43),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid state');
            expect(fetchMock).not.toHaveBeenCalled();
        });

        // The web app forwards the signed state from the GET bounce, so the
        // binding is mandatory: without a state there is nothing to bind the
        // verifier to and the exchange must not reach the provider.
        it('should reject a missing, null or empty state with 400 Missing state', async () => {
            for (const body of [
                { code: 'valid_code', code_verifier: VALID_CODE_VERIFIER },
                { code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state: null },
                { code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state: '' },
            ]) {
                const fetchMock = mockDiscordSuccess();

                const response = await SELF.fetch('http://localhost/auth/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                const json = (await response.json()) as Record<string, any>;

                expect(response.status, JSON.stringify(body)).toBe(400);
                expect(json.success).toBe(false);
                expect(json.error).toBe('Missing state');
                expect(fetchMock).not.toHaveBeenCalled();
            }
        });
    });

    describe('POST /auth/callback', () => {
        it('should reject invalid JSON body', async () => {
            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'not-json',
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.success).toBe(false);
            expect(json.error).toBe('Invalid request body');
        });

        it('should require code in body', async () => {
            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code_verifier: VALID_CODE_VERIFIER }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.success).toBe(false);
            expect(json.error).toContain('code');
        });

        it('should require code_verifier in body', async () => {
            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: 'auth_code' }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.success).toBe(false);
            expect(json.error).toContain('code_verifier');
        });

        it('should reject invalid code_verifier format (too short)', async () => {
            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'auth_code',
                    code_verifier: 'short', // Less than 43 characters
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.success).toBe(false);
            expect(json.error).toBe('Invalid code_verifier format');
        });

        it('should reject invalid code_verifier format (invalid characters)', async () => {
            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'auth_code',
                    // Contains invalid chars like @, #, !, spaces
                    code_verifier: 'invalid@chars#here! with spaces too' + 'x'.repeat(15),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.success).toBe(false);
            expect(json.error).toBe('Invalid code_verifier format');
        });

        it('should handle Discord token exchange failure', async () => {
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }));
                }
                return originalFetch(url);
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'invalid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('authorization code');
        });

        it('should handle Discord user fetch failure', async () => {
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        access_token: 'token',
                        token_type: 'Bearer',
                        expires_in: 604800,
                        refresh_token: 'refresh',
                        scope: 'identify',
                    }), { status: 200 }));
                }
                if (url.includes('users/@me')) {
                    return Promise.resolve(new Response('Unauthorized', { status: 401 }));
                }
                return originalFetch(url);
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'valid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('user information');
        });

        it('should reject token missing required identify scope', async () => {
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        access_token: 'token',
                        token_type: 'Bearer',
                        expires_in: 604800,
                        refresh_token: 'refresh',
                        scope: 'email', // Wrong scope - no 'identify'
                    }), { status: 200 }));
                }
                return originalFetch(url);
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'valid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('missing required permissions');
        });

        it('should reject token with no scope', async () => {
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        access_token: 'token',
                        token_type: 'Bearer',
                        expires_in: 604800,
                        refresh_token: 'refresh',
                        // No scope field at all
                    }), { status: 200 }));
                }
                return originalFetch(url);
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'valid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('missing required permissions');
        });

        it('should reject Discord user response missing required id field', async () => {
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        access_token: 'token',
                        token_type: 'Bearer',
                        expires_in: 604800,
                        refresh_token: 'refresh',
                        scope: 'identify',
                    }), { status: 200 }));
                }
                if (url.includes('users/@me')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        // Missing 'id' field
                        username: 'testuser',
                        discriminator: '0001',
                        global_name: 'Test User',
                        avatar: 'abc123',
                    }), { status: 200 }));
                }
                return originalFetch(url);
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'valid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('Invalid user data');
        });

        it('should reject Discord user response missing required username field', async () => {
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        access_token: 'token',
                        token_type: 'Bearer',
                        expires_in: 604800,
                        refresh_token: 'refresh',
                        scope: 'identify',
                    }), { status: 200 }));
                }
                if (url.includes('users/@me')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        id: '123456789',
                        // Missing 'username' field
                        discriminator: '0001',
                        global_name: 'Test User',
                        avatar: 'abc123',
                    }), { status: 200 }));
                }
                return originalFetch(url);
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'valid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            expect(json.error).toContain('Invalid user data');
        });

        it('should return token and user info on success', async () => {
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        access_token: 'discord_token',
                        token_type: 'Bearer',
                        expires_in: 604800,
                        refresh_token: 'refresh',
                        scope: 'identify',
                    }), { status: 200 }));
                }
                if (url.includes('users/@me')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        id: '123456789',
                        username: 'testuser',
                        discriminator: '0001',
                        global_name: 'Test User',
                        avatar: 'abc123',
                    }), { status: 200 }));
                }
                return originalFetch(url);
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'valid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.success).toBe(true);
            expect(json.token).toBeTruthy();
            expect(json.expires_at).toBeTruthy();
            // user.id is now our internal database UUID, not the Discord ID
            expect(json.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
            expect(json.user).toMatchObject({
                username: 'testuser',
                global_name: 'Test User',
                avatar: 'abc123',
            });
            expect(json.user.avatar_url).toContain('cdn.discordapp.com');
        });

        // FINDING-022 (2026-08-29 security audit): this response body carries a
        // bearer JWT — RFC 6749 §5.1 requires it never be cached.
        it('should send Cache-Control: no-store on the token response', async () => {
            mockDiscordSuccess();

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'valid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.token).toBeTruthy();
            expect(response.headers.get('Cache-Control')).toBe('no-store');
            expect(response.headers.get('Pragma')).toBe('no-cache');
        });

        it('should ignore custom redirect_uri and use worker callback', async () => {
            globalThis.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
                if (url.includes('oauth2/token')) {
                    // Verify redirect_uri is forced to the worker callback (matches authorize step)
                    const body = options?.body
                        ? (options.body instanceof URLSearchParams ? options.body.toString()
                            : typeof options.body === 'string' ? options.body
                                : JSON.stringify(options.body))
                        : '';
                    expect(body).toContain('redirect_uri=http%3A%2F%2Flocalhost%3A8788%2Fauth%2Fcallback');

                    return Promise.resolve(new Response(JSON.stringify({
                        access_token: 'token',
                        token_type: 'Bearer',
                        expires_in: 604800,
                        refresh_token: 'refresh',
                        scope: 'identify',
                    }), { status: 200 }));
                }
                if (url.includes('users/@me')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        id: '123',
                        username: 'test',
                        discriminator: '0001',
                        global_name: null,
                        avatar: null,
                    }), { status: 200 }));
                }
                return originalFetch(url);
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                    redirect_uri: 'http://localhost:5173/custom/callback',
                }),
            });

            expect(response.status).toBe(200);
        });

        it('should handle null avatar', async () => {
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        access_token: 'token',
                        token_type: 'Bearer',
                        expires_in: 604800,
                        refresh_token: 'refresh',
                        scope: 'identify',
                    }), { status: 200 }));
                }
                if (url.includes('users/@me')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        id: '123',
                        username: 'test',
                        discriminator: '0001',
                        global_name: null,
                        avatar: null,
                    }), { status: 200 }));
                }
                return originalFetch(url);
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.user.avatar).toBeNull();
            expect(json.user.avatar_url).toBeNull();
        });

        it('should handle generic errors gracefully', async () => {
            globalThis.fetch = vi.fn().mockImplementation(() => {
                throw new Error('Network error');
            });

            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(500);
            expect(json.success).toBe(false);
            expect(json.error).toBe('Authentication failed');
        });
    });

    describe('POST /auth/callback (Production Environment)', () => {
        it('should sanitize error logging for token exchange failure in production', async () => {
            const prodEnv = createProductionEnv();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(
                        new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
                    );
                }
                return originalFetch(url);
            });

            const response = await fetchWithEnv(prodEnv, 'http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'invalid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(401);
            expect(json.success).toBe(false);
            // In production, console.error should only log 'Token exchange failed' without detailed error data
            expect(consoleSpy).toHaveBeenCalledWith('Token exchange failed');

            consoleSpy.mockRestore();
        });

        it('should sanitize error logging for generic errors in production', async () => {
            const prodEnv = createProductionEnv();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            globalThis.fetch = vi.fn().mockImplementation(() => {
                throw new Error('Production network error');
            });

            const response = await fetchWithEnv(prodEnv, 'http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(500);
            expect(json.success).toBe(false);
            // In production, should log sanitized error (name and message only)
            expect(consoleSpy).toHaveBeenCalledWith('OAuth callback error:', {
                name: 'Error',
                message: 'Production network error',
            });

            consoleSpy.mockRestore();
        });

        it('should log full error details in development environment', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(
                        new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })
                    );
                }
                return originalFetch(url);
            });

            await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: 'invalid_code',
                    code_verifier: VALID_CODE_VERIFIER,
                    state: await boundState(),
                }),
            });

            // In development, should log full error details
            expect(consoleSpy).toHaveBeenCalledWith('Token exchange failed:', { error: 'invalid_grant' });

            consoleSpy.mockRestore();
        });
    });

    /**
     * FINDING-002 (2026-08-29 security audit): `users.avatar_url` was written on
     * every Discord sign-in and never read back — every response recomputes the
     * CDN URL from the Discord id + avatar hash. The JWT also carried `orig_iat`
     * (whose only reader, `/auth/refresh`, is gone), `xivauth_id` and
     * `primary_character`, none of which any consumer reads.
     */
    describe('POST /auth/callback — data minimisation', () => {
        beforeEach(() => {
            resetRecordedStatements();
        });

        /** Discord endpoints mocked to succeed for a specific account. */
        function mockDiscordUser(discordId: string, avatar: string | null): void {
            globalThis.fetch = vi.fn().mockImplementation((url: string) => {
                if (url.includes('oauth2/token')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        access_token: 'discord_token',
                        token_type: 'Bearer',
                        expires_in: 604800,
                        refresh_token: 'refresh',
                        scope: 'identify',
                    }), { status: 200 }));
                }
                if (url.includes('users/@me')) {
                    return Promise.resolve(new Response(JSON.stringify({
                        id: discordId,
                        username: 'minimisation-user',
                        discriminator: '0001',
                        global_name: 'Minimisation User',
                        avatar,
                    }), { status: 200 }));
                }
                return originalFetch(url);
            });
        }

        function exchange(): Promise<Response> {
            return boundState().then((state) =>
                SELF.fetch('http://localhost/auth/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: 'valid_code', code_verifier: VALID_CODE_VERIFIER, state }),
                })
            );
        }

        it('should not persist the avatar URL when creating the user row, but still return it', async () => {
            mockDiscordUser('222333444555666777', 'deadbeefdeadbeefdeadbeefdeadbeef');

            const response = await exchange();
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);

            const insert = recordedStatements.find((s) => s.sql.includes('INSERT INTO users'));
            expect(insert).toBeDefined();
            expect(insert!.sql).not.toContain('avatar_url');
            // oauth-06: created_at / updated_at are now bound explicitly rather
            // than left to the column defaults, so the row and the object the
            // caller gets back carry the same string. The point of this
            // assertion — that the bind list is exactly the columns we mean to
            // write, and avatar_url is not among them — is unchanged.
            expect(insert!.params).toEqual([
                json.user.id,
                '222333444555666777',
                null,
                'discord',
                'Minimisation User',
                expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
                expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
            ]);

            // The response still carries the URL — recomputed, not stored
            expect(json.user.avatar_url).toBe(
                'https://cdn.discordapp.com/avatars/222333444555666777/deadbeefdeadbeefdeadbeefdeadbeef.png'
            );
        });

        it('should not persist the avatar URL when an existing user signs in again', async () => {
            mockDiscordUser('333444555666777888', 'aaaabbbbccccddddeeeeffff00001111');
            await exchange();

            resetRecordedStatements();
            mockDiscordUser('333444555666777888', 'a_1111222233334444555566667777888');
            const response = await exchange();
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);

            const update = recordedStatements.find((s) => s.sql.includes('UPDATE users'));
            expect(update).toBeDefined();
            expect(update!.sql).not.toContain('avatar_url');
            expect(update!.params.some((p) => typeof p === 'string' && p.includes('cdn.discordapp.com'))).toBe(false);

            // ...and the (animated) avatar still resolves in the response
            expect(json.user.avatar_url).toContain('.gif');
        });

        it('should mint exactly the claims consumers read for a Discord login', async () => {
            mockDiscordUser('444555666777888999', 'abc123abc123abc123abc123abc123ab');

            const response = await exchange();
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            const [, encodedPayload] = (json.token as string).split('.');
            let base64 = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4 !== 0) base64 += '=';
            const payload = JSON.parse(atob(base64)) as Record<string, unknown>;

            expect(Object.keys(payload).sort()).toEqual([
                'auth_provider',
                'avatar',
                'discord_id',
                'exp',
                'global_name',
                'iat',
                'iss',
                'jti',
                'sub',
                'username',
            ]);
            expect(payload.sub).toBe(json.user.id);
            expect(payload.discord_id).toBe('444555666777888999');
            expect(payload.avatar).toBe('abc123abc123abc123abc123abc123ab');
            expect(payload.auth_provider).toBe('discord');
        });
    });
});
