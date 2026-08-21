/**
 * Authorize Handler Tests
 * Tests for the OAuth authorization flow initiation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SELF, VALID_CODE_CHALLENGE } from './mocks/cloudflare-test.js';
import { resetRateLimiter } from '../services/rate-limit.js';

/**
 * Helper to decode signed state format (base64url(json).signature)
 */
function decodeSignedState(signedState: string): Record<string, unknown> {
    const [encodedPart] = signedState.split('.');
    // Convert base64url to base64
    let base64 = encodedPart.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4 !== 0) {
        base64 += '=';
    }
    return JSON.parse(atob(base64));
}

describe('Authorize Handler', () => {
    beforeEach(() => {
        // Reset rate limiter between tests to avoid 429 errors
        resetRateLimiter();
    });

    describe('GET /auth/discord', () => {
        it('should require code_challenge parameter', async () => {
            // SECURITY: code_verifier should NOT be accepted - it stays on the client
            const response = await SELF.fetch('http://localhost/auth/discord?state=test123');
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Missing code_challenge');
        });

        it('should reject invalid code_challenge format (too short)', async () => {
            const params = new URLSearchParams({
                code_challenge: 'short', // Invalid - less than 43 chars
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid code_challenge format');
            expect(json.message).toContain('base64url');
        });

        it('should reject invalid code_challenge format (invalid characters)', async () => {
            const params = new URLSearchParams({
                // Invalid chars: !, @, #, $ are not allowed in base64url
                code_challenge: '!@#$%^&*()_+=[]{}|;:,.<>?/`~' + 'a'.repeat(20),
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid code_challenge format');
        });

        it('should reject code_challenge with spaces', async () => {
            const params = new URLSearchParams({
                code_challenge: 'valid_challenge_start with spaces here too long enough',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid code_challenge format');
        });

        it('should not require code_verifier parameter (stays on client for security)', async () => {
            // SECURITY: code_verifier should NEVER be sent to the server
            // It stays in sessionStorage on the client and is sent via POST /auth/callback
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            // Should succeed without code_verifier
            expect(response.status).toBe(302);
        });

        it('should reject invalid code_challenge_method', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                code_challenge_method: 'plain',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid code_challenge_method');
            expect(json.message).toContain('S256');
        });

        it('should accept S256 code_challenge_method', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                code_challenge_method: 'S256',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);
        });

        it('should reject disallowed redirect_uri', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                redirect_uri: 'http://evil.com/callback',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid redirect_uri');
        });

        it('should allow localhost redirect_uri', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                redirect_uri: 'http://localhost:5173/auth/callback',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);
        });

        it('should redirect to Discord OAuth URL', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);

            const location = response.headers.get('location');
            expect(location).toContain('https://discord.com/oauth2/authorize');
            expect(location).toContain('client_id=');
            expect(location).toContain(`code_challenge=${VALID_CODE_CHALLENGE}`);
        });

        it('should include scope=identify in Discord URL', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            const location = response.headers.get('location');
            expect(location).toContain('scope=identify');
        });

        it('should encode state WITHOUT code_verifier (security)', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                return_path: '/settings',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            const location = new URL(response.headers.get('location')!);
            const state = location.searchParams.get('state');
            expect(state).toBeTruthy();

            // Decode signed state (format: base64url(json).signature)
            const decodedState = decodeSignedState(state!);
            expect(decodedState.code_challenge).toBe(VALID_CODE_CHALLENGE);
            // SECURITY: code_verifier should NOT be in state
            expect(decodedState.code_verifier).toBeUndefined();
            expect(decodedState.return_path).toBe('/settings');
        });

        it('should use default return_path when not provided', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            const location = new URL(response.headers.get('location')!);
            const state = location.searchParams.get('state');
            const decodedState = decodeSignedState(state!);

            expect(decodedState.return_path).toBe('/');
        });

        it('should include code_challenge_method in Discord URL', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            const location = response.headers.get('location');
            expect(location).toContain('code_challenge_method=S256');
        });

        it('should allow xivdyetools.app redirect', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                redirect_uri: 'https://xivdyetools.app/auth/callback',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);
        });
    });

    /**
     * FINDING-012 / OAUTH-4 (2026-08-21 security audit): redirect_uri used to be
     * matched by origin only, so any path on an allowed origin could receive the
     * ?code= bounce; return_path and state were embedded into the signed state
     * unbounded. Exact callback path + server-side caps.
     */
    describe('GET /auth/discord — redirect_uri path pin and parameter bounds', () => {
        it('should reject a redirect_uri on an allowed origin but a different path', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                redirect_uri: 'https://xivdyetools.app/anything/else',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid redirect_uri');
        });

        it('should reject a redirect_uri that carries a query string', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                redirect_uri: 'https://xivdyetools.app/auth/callback?next=https://evil.com',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid redirect_uri');
        });

        it('should reject a redirect_uri that carries a fragment', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                redirect_uri: 'https://xivdyetools.app/auth/callback#frag',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid redirect_uri');
        });

        it('should reject a return_path longer than 256 characters', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                return_path: '/' + 'a'.repeat(256),
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid return_path');
        });

        it('should reject a return_path that does not start with a single slash', async () => {
            for (const return_path of ['settings', '//evil.com/x', 'https://evil.com/', '\\evil']) {
                const params = new URLSearchParams({ code_challenge: VALID_CODE_CHALLENGE, return_path });

                const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
                const json = (await response.json()) as Record<string, any>;

                expect(response.status, return_path).toBe(400);
                expect(json.error, return_path).toBe('Invalid return_path');
            }
        });

        it('should reject a return_path containing a backslash or control characters', async () => {
            for (const return_path of ['/settings\\..\\x', '/a\nb', '/a' + String.fromCharCode(0) + 'b']) {
                const params = new URLSearchParams({ code_challenge: VALID_CODE_CHALLENGE, return_path });

                const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
                const json = (await response.json()) as Record<string, any>;

                expect(response.status, JSON.stringify(return_path)).toBe(400);
                expect(json.error, JSON.stringify(return_path)).toBe('Invalid return_path');
            }
        });

        it('should accept a return_path of exactly 256 characters (boundary)', async () => {
            const return_path = '/' + 'a'.repeat(255);
            const params = new URLSearchParams({ code_challenge: VALID_CODE_CHALLENGE, return_path });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                redirect: 'manual',
            });

            expect(response.status).toBe(302);
            const location = new URL(response.headers.get('location')!);
            expect(decodeSignedState(location.searchParams.get('state')!).return_path).toBe(return_path);
        });

        it('should reject a state longer than 256 characters', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                state: 'x'.repeat(257),
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid state');
        });

        it('should reject a state containing control characters', async () => {
            const params = new URLSearchParams({
                code_challenge: VALID_CODE_CHALLENGE,
                state: 'abc\r\ndef',
            });

            const response = await SELF.fetch(`http://localhost/auth/discord?${params}`);
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(400);
            expect(json.error).toBe('Invalid state');
        });

        it('should accept a state of exactly 256 printable characters and the SPA 64-hex form', async () => {
            for (const state of ['f'.repeat(64), 'x'.repeat(256)]) {
                const params = new URLSearchParams({ code_challenge: VALID_CODE_CHALLENGE, state });

                const response = await SELF.fetch(`http://localhost/auth/discord?${params}`, {
                    redirect: 'manual',
                });

                expect(response.status).toBe(302);
                const location = new URL(response.headers.get('location')!);
                expect(decodeSignedState(location.searchParams.get('state')!).csrf).toBe(state);
            }
        });
    });
});
