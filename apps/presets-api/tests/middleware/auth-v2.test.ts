/**
 * Bot auth — request-bound signature v2 (FINDING-014, 2026-08-21 audit).
 *
 * v1 signed only `timestamp:userId:userName`. When the v2 header is present it
 * MUST verify (method + path + body hash + timestamp + nonce + identity, 60 s
 * window) — no silent fallback to v1, or an attacker with a captured v1 tuple
 * could downgrade. v1-only requests keep working until both bots have rolled
 * over (then v1 is removed).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware } from '../../src/middleware/auth';
import type { Env, AuthContext } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { createBotSignatureV2, hmacSignHex } from '@xivdyetools/auth';

type Variables = { auth: AuthContext };

const SECRET = 'test-signing-secret-at-least-32-bytes!!!-at-least-32-bytes!!!';

describe('bot auth v2 signature', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;

    beforeEach(() => {
        env = createMockEnv({ BOT_SIGNING_SECRET: SECRET });
        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);
        app.post('/api/v1/presets', (c) => c.json(c.get('auth')));
        app.get('/api/v1/presets/mine', (c) => c.json(c.get('auth')));
    });

    async function v2Headers(method: string, path: string, body: string | undefined, extra: Record<string, string> = {}) {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const nonce = 'nonce-1';
        const sig = await createBotSignatureV2(
            { method, path, body, timestamp, nonce, userDiscordId: '123456789', userName: 'TestUser' },
            SECRET
        );
        return {
            Authorization: 'Bearer test-bot-secret',
            'X-User-Discord-ID': '123456789',
            'X-User-Discord-Name': 'TestUser',
            'X-Request-Timestamp': timestamp,
            'X-Request-Nonce': nonce,
            'X-Request-Signature-V2': sig,
            ...extra,
        };
    }

    it('authenticates a request whose v2 signature matches method, path and body', async () => {
        const body = JSON.stringify({ name: 'hello' });
        const headers = await v2Headers('POST', '/api/v1/presets', body, { 'Content-Type': 'application/json' });
        const res = await app.request('/api/v1/presets', { method: 'POST', headers, body }, env);
        const auth = (await res.json()) as AuthContext;
        expect(auth.isAuthenticated).toBe(true);
        expect(auth.authSource).toBe('bot');
        expect(auth.userDiscordId).toBe('123456789');
    });

    it('authenticates a GET with no body', async () => {
        const headers = await v2Headers('GET', '/api/v1/presets/mine', undefined);
        const res = await app.request('/api/v1/presets/mine', { headers }, env);
        expect(((await res.json()) as AuthContext).isAuthenticated).toBe(true);
    });

    it('rejects when the body was tampered with after signing', async () => {
        const headers = await v2Headers('POST', '/api/v1/presets', JSON.stringify({ name: 'hello' }), {
            'Content-Type': 'application/json',
        });
        const res = await app.request(
            '/api/v1/presets',
            { method: 'POST', headers, body: JSON.stringify({ name: 'evil' }) },
            env
        );
        expect(((await res.json()) as AuthContext).isAuthenticated).toBe(false);
    });

    it('rejects when the signature was made for a different path', async () => {
        const headers = await v2Headers('GET', '/api/v1/presets/other', undefined);
        const res = await app.request('/api/v1/presets/mine', { headers }, env);
        expect(((await res.json()) as AuthContext).isAuthenticated).toBe(false);
    });

    it('does not fall back to v1 when a v2 header is present but invalid', async () => {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const v1 = await hmacSignHex(`${timestamp}:123456789:TestUser`, SECRET);
        const res = await app.request(
            '/api/v1/presets/mine',
            {
                headers: {
                    Authorization: 'Bearer test-bot-secret',
                    'X-User-Discord-ID': '123456789',
                    'X-User-Discord-Name': 'TestUser',
                    'X-Request-Timestamp': timestamp,
                    'X-Request-Signature': v1,
                    'X-Request-Signature-V2': 'deadbeef',
                },
            },
            env
        );
        expect(((await res.json()) as AuthContext).isAuthenticated).toBe(false);
    });

    it('still accepts a v1-only request (rollover compatibility)', async () => {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const v1 = await hmacSignHex(`${timestamp}:123456789:TestUser`, SECRET);
        const res = await app.request(
            '/api/v1/presets/mine',
            {
                headers: {
                    Authorization: 'Bearer test-bot-secret',
                    'X-User-Discord-ID': '123456789',
                    'X-User-Discord-Name': 'TestUser',
                    'X-Request-Timestamp': timestamp,
                    'X-Request-Signature': v1,
                },
            },
            env
        );
        expect(((await res.json()) as AuthContext).isAuthenticated).toBe(true);
    });
});
