/**
 * Bot auth — request-bound signature v2 (FINDING-014, 2026-08-21 audit) and its
 * nonce replay cache (FINDING-015, 2026-08-29 audit).
 *
 * v1 signed only `timestamp:userId:userName` — no method, path, body or nonce —
 * so a captured tuple could be replayed against ANY route for five minutes.
 * Both bots have sent v2 alongside v1 since 2026-08-21 and are deployed on it,
 * so v1 is no longer accepted at all: a request without
 * `X-Request-Signature-V2` is unauthenticated whatever `X-Request-Signature`
 * carries. Every accepted nonce is then recorded in KV for 120 s, so the same
 * signed request cannot be replayed inside its own 60 s freshness window.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import { authMiddleware, requireAuth } from '../../src/middleware/auth';
import type { Env, AuthContext } from '../../src/types';
import { createMockEnv } from '../test-utils';
import { createMockKV, type MockKVNamespace } from '@xivdyetools/test-utils';
import { createBotSignatureV2, hmacSignHex } from '@xivdyetools/auth';

type Variables = { auth: AuthContext };

const SECRET = 'test-signing-secret-at-least-32-bytes!!!-at-least-32-bytes!!!';

/** Path of the route guarded by `requireAuth` (401 envelope assertions). */
const PROTECTED_PATH = '/api/v1/presets/protected';

describe('bot auth v2 signature', () => {
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let env: Env;

    beforeEach(() => {
        env = createMockEnv({ BOT_SIGNING_SECRET: SECRET });
        app = new Hono<{ Bindings: Env; Variables: Variables }>();
        app.use('*', authMiddleware);
        app.post('/api/v1/presets', (c) => c.json(c.get('auth')));
        app.get('/api/v1/presets/mine', (c) => c.json(c.get('auth')));
        app.get(PROTECTED_PATH, (c) => requireAuth(c) ?? c.json({ success: true }));
    });

    async function v2Headers(
        method: string,
        path: string,
        body?: string,
        options: { nonce?: string; extra?: Record<string, string> } = {}
    ) {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const nonce = options.nonce ?? crypto.randomUUID();
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
            ...options.extra,
        };
    }

    it('authenticates a request whose v2 signature matches method, path and body', async () => {
        const body = JSON.stringify({ name: 'hello' });
        const headers = await v2Headers('POST', '/api/v1/presets', body, {
            extra: { 'Content-Type': 'application/json' },
        });
        const res = await app.request('/api/v1/presets', { method: 'POST', headers, body }, env);
        const auth = (await res.json()) as AuthContext;
        expect(auth.isAuthenticated).toBe(true);
        expect(auth.authSource).toBe('bot');
        expect(auth.userDiscordId).toBe('123456789');
    });

    it('authenticates a GET with no body', async () => {
        const headers = await v2Headers('GET', '/api/v1/presets/mine');
        const res = await app.request('/api/v1/presets/mine', { headers }, env);
        expect(((await res.json()) as AuthContext).isAuthenticated).toBe(true);
    });

    it('rejects when the body was tampered with after signing', async () => {
        const headers = await v2Headers('POST', '/api/v1/presets', JSON.stringify({ name: 'hello' }), {
            extra: { 'Content-Type': 'application/json' },
        });
        const res = await app.request(
            '/api/v1/presets',
            { method: 'POST', headers, body: JSON.stringify({ name: 'evil' }) },
            env
        );
        expect(((await res.json()) as AuthContext).isAuthenticated).toBe(false);
    });

    it('rejects when the signature was made for a different path', async () => {
        const headers = await v2Headers('GET', '/api/v1/presets/other');
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

    // FINDING-015 (2026-08-29 audit): v1 acceptance is gone. Both bots have been
    // deployed on v2 since 2026-08-28, so a v1-only request is either a stale
    // client or someone stripping the v2 header to downgrade.
    it('rejects a valid v1-only request — v1 is no longer accepted (FINDING-015)', async () => {
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
        expect(((await res.json()) as AuthContext).isAuthenticated).toBe(false);
    });

    // The point of this one is that a request carrying ONLY the retired v1
    // signature is unauthenticated and gets the worker's ordinary 401 — not
    // that the envelope never changes. REFACTOR-003 changed that envelope
    // worker-wide (the guards now use the canonical `ErrorCode` helpers rather
    // than hand-rolling `{error: 'Unauthorized'}` with no `success` field), so
    // this asserts the new ordinary shape.
    it('answers 401 with the ordinary envelope when the v2 signature header is missing', async () => {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const v1 = await hmacSignHex(`${timestamp}:123456789:TestUser`, SECRET);
        const res = await app.request(
            PROTECTED_PATH,
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
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Valid authentication required',
        });
    });

    // ============================================
    // Nonce replay cache (FINDING-015)
    // ============================================

    describe('nonce replay cache (FINDING-015)', () => {
        let kv: MockKVNamespace;
        let kvEnv: Env;

        beforeEach(() => {
            kv = createMockKV();
            kvEnv = createMockEnv({
                BOT_SIGNING_SECRET: SECRET,
                TOKEN_BLACKLIST: kv as unknown as KVNamespace,
            });
        });

        it('records an accepted nonce under `botnonce:` with a 120 s TTL', async () => {
            const putSpy = vi.spyOn(kv, 'put');
            const getSpy = vi.spyOn(kv, 'get');
            const nonce = 'first-nonce';
            const headers = await v2Headers('GET', PROTECTED_PATH, undefined, { nonce });

            const res = await app.request(PROTECTED_PATH, { headers }, kvEnv);

            expect(res.status).toBe(200);
            expect(getSpy).toHaveBeenCalledWith(`botnonce:${nonce}`);
            expect(putSpy).toHaveBeenCalledWith(`botnonce:${nonce}`, '1', { expirationTtl: 120 });
        });

        it('rejects the same signed request replayed with the same nonce', async () => {
            const headers = await v2Headers('GET', PROTECTED_PATH, undefined, { nonce: 'replayed-nonce' });

            const first = await app.request(PROTECTED_PATH, { headers }, kvEnv);
            const replay = await app.request(PROTECTED_PATH, { headers }, kvEnv);

            expect(first.status).toBe(200);
            expect(replay.status).toBe(401);
            expect(await replay.json()).toEqual({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Valid authentication required',
            });
        });

        it('accepts a second request that carries a fresh nonce', async () => {
            const first = await v2Headers('GET', PROTECTED_PATH, undefined, { nonce: 'nonce-a' });
            const second = await v2Headers('GET', PROTECTED_PATH, undefined, { nonce: 'nonce-b' });

            expect((await app.request(PROTECTED_PATH, { headers: first }, kvEnv)).status).toBe(200);
            expect((await app.request(PROTECTED_PATH, { headers: second }, kvEnv)).status).toBe(200);
            expect(kv._store.has('botnonce:nonce-a')).toBe(true);
            expect(kv._store.has('botnonce:nonce-b')).toBe(true);
        });

        it('rejects a nonce longer than 64 characters before touching KV', async () => {
            const getSpy = vi.spyOn(kv, 'get');
            const headers = await v2Headers('GET', PROTECTED_PATH, undefined, { nonce: 'n'.repeat(65) });

            const res = await app.request(PROTECTED_PATH, { headers }, kvEnv);

            expect(res.status).toBe(401);
            expect(getSpy).not.toHaveBeenCalled();
        });

        it('rejects a nonce containing characters outside [A-Za-z0-9._-] before touching KV', async () => {
            const getSpy = vi.spyOn(kv, 'get');
            const headers = await v2Headers('GET', PROTECTED_PATH, undefined, { nonce: 'nonce with spaces' });

            const res = await app.request(PROTECTED_PATH, { headers }, kvEnv);

            expect(res.status).toBe(401);
            expect(getSpy).not.toHaveBeenCalled();
        });

        it('rejects a valid signature that carries no nonce header at all', async () => {
            const timestamp = String(Math.floor(Date.now() / 1000));
            const sig = await createBotSignatureV2(
                {
                    method: 'GET',
                    path: PROTECTED_PATH,
                    timestamp,
                    userDiscordId: '123456789',
                    userName: 'TestUser',
                },
                SECRET
            );

            const res = await app.request(
                PROTECTED_PATH,
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123456789',
                        'X-User-Discord-Name': 'TestUser',
                        'X-Request-Timestamp': timestamp,
                        'X-Request-Signature-V2': sig,
                    },
                },
                kvEnv
            );

            expect(res.status).toBe(401);
        });

        // Best-effort by design: KV is eventually consistent and a KV incident
        // must not lock both bots out of the API. The 60 s signature window is
        // the primary bound; the cache narrows it inside a colo.
        it('still authenticates when the KV read fails (replay check is best-effort)', async () => {
            const getSpy = vi.spyOn(kv, 'get').mockRejectedValue(new Error('KV unavailable'));
            const headers = await v2Headers('GET', PROTECTED_PATH, undefined, { nonce: 'kv-error-nonce' });

            const res = await app.request(PROTECTED_PATH, { headers }, kvEnv);

            expect(getSpy).toHaveBeenCalledWith('botnonce:kv-error-nonce');
            expect(res.status).toBe(200);
        });
    });

    // Dev/tests only — `wrangler.toml` binds TOKEN_BLACKLIST in both deployed
    // environments, so this path is never taken in dev-deploy or production.
    it('skips the replay check when TOKEN_BLACKLIST is not bound (dev/tests without KV)', async () => {
        const headers = await v2Headers('GET', PROTECTED_PATH, undefined, { nonce: 'unbound-kv-nonce' });

        const first = await app.request(PROTECTED_PATH, { headers }, env);
        const replay = await app.request(PROTECTED_PATH, { headers }, env);

        expect(first.status).toBe(200);
        expect(replay.status).toBe(200);
    });

    it('still rejects a malformed nonce when TOKEN_BLACKLIST is not bound', async () => {
        const headers = await v2Headers('GET', PROTECTED_PATH, undefined, { nonce: 'nonce with spaces' });

        const res = await app.request(PROTECTED_PATH, { headers }, env);

        expect(res.status).toBe(401);
    });
});
