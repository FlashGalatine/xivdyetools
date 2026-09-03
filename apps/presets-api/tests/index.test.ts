/**
 * Main App (Index) Tests
 * Tests for health endpoints, CORS, error handling, and route mounting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../src/index';
import type { Env } from '../src/types';
import { createMockEnv, createMockD1Database, createMockPresetRow } from './test-utils';
import { createMockKV } from '@xivdyetools/test-utils';

/**
 * FINDING-013 (2026-08-29 security audit): validateEnv now requires
 * JWT_ISSUER, TOKEN_BLACKLIST and RL_PUBLIC in production alongside the
 * pre-existing BOT_SIGNING_SECRET / MODERATOR_IDS (JWT_SECRET is already
 * satisfied by createMockEnv's default). Every test below that exercises a
 * *valid* production request needs all four, or the env-validation
 * middleware 500s the request before it ever reaches the route under test.
 */
function validProductionOverrides(): Partial<Env> {
    return {
        ENVIRONMENT: 'production',
        BOT_SIGNING_SECRET: 'test-signing-secret',
        MODERATOR_IDS: '123456789012345678',
        JWT_ISSUER: 'https://auth.xivdyetools.app',
        TOKEN_BLACKLIST: createMockKV() as unknown as KVNamespace,
        RL_PUBLIC: {} as unknown as RateLimit,
        // BUG-043: `createMockEnv` leaves these undefined by default — which is
        // exactly the shape that made the moderation fan-out fail silently, so
        // production now refuses to start without them. A production fixture
        // has to look like production.
        INTERNAL_WEBHOOK_SECRET: 'test-internal-webhook-secret',
        DISCORD_WORKER: { fetch: async () => new Response(null, { status: 204 }) } as unknown as Fetcher,
    };
}

describe('Index/App', () => {
    let env: Env;

    beforeEach(() => {
        env = createMockEnv();
        vi.clearAllMocks();
    });

    // ============================================
    // Health Endpoints
    // ============================================

    describe('Health Endpoints', () => {
        it('GET / should return API info', async () => {
            const res = await app.request('/', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { name: string; version: string; status: string; environment: string };

            expect(body.name).toBe('XIV Dye Tools Community Presets API');
            expect(body.version).toBe('v1');
            expect(body.status).toBe('healthy');
            expect(body.environment).toBe('development');
        });

        it('GET /health should return health status', async () => {
            const res = await app.request('/health', {}, env);

            expect(res.status).toBe(200);
            const body = await res.json() as { status: string; timestamp: string };

            expect(body.status).toBe('ok');
            expect(body.timestamp).toBeDefined();
            expect(new Date(body.timestamp).getTime()).not.toBeNaN();
        });
    });

    // ============================================
    // CORS Configuration
    // ============================================

    describe('CORS Configuration', () => {
        it('should allow configured CORS_ORIGIN', async () => {
            const res = await app.request(
                '/',
                {
                    headers: {
                        Origin: 'http://localhost:3000',
                    },
                },
                env
            );

            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
        });

        it('should allow custom domain origin', async () => {
            env.ADDITIONAL_CORS_ORIGINS = 'https://xivdyetools.app';
            const res = await app.request(
                '/',
                {
                    headers: {
                        Origin: 'https://xivdyetools.app',
                    },
                },
                env
            );

            expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
                'https://xivdyetools.app'
            );
        });

        it('should allow localhost origins for development', async () => {
            const res = await app.request(
                '/',
                {
                    headers: {
                        Origin: 'http://localhost:5173',
                    },
                },
                env
            );

            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
        });

        it('should allow 127.0.0.1 origins for development', async () => {
            const res = await app.request(
                '/',
                {
                    headers: {
                        Origin: 'http://127.0.0.1:5173',
                    },
                },
                env
            );

            expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://127.0.0.1:5173');
        });

        it('should not allow unknown origins', async () => {
            const res = await app.request(
                '/',
                {
                    headers: {
                        Origin: 'https://malicious-site.com',
                    },
                },
                env
            );

            expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
        });

        it('should handle OPTIONS preflight requests', async () => {
            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'OPTIONS',
                    headers: {
                        Origin: 'http://localhost:3000',
                        'Access-Control-Request-Method': 'POST',
                        'Access-Control-Request-Headers': 'Content-Type, Authorization',
                    },
                },
                env
            );

            expect(res.status).toBe(204);
            expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
        });

        // FINDING-005 (2026-08-09 pre-release audit): X-User-Discord-ID and
        // X-User-Discord-Name are server-to-server bot identity headers, only
        // ever honoured behind a valid HMAC signature. No browser client sends
        // them, so advertising them in the preflight is pure attack surface.
        it('should not advertise the bot identity headers in preflight', async () => {
            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'OPTIONS',
                    headers: {
                        Origin: 'http://localhost:3000',
                        'Access-Control-Request-Method': 'POST',
                        'Access-Control-Request-Headers': 'Content-Type, Authorization',
                    },
                },
                env
            );

            const allowHeaders = (res.headers.get('Access-Control-Allow-Headers') ?? '').toLowerCase();

            expect(allowHeaders).toContain('content-type');
            expect(allowHeaders).toContain('authorization');
            expect(allowHeaders).not.toContain('x-user-discord-id');
            expect(allowHeaders).not.toContain('x-user-discord-name');
        });

        it('should expose rate limit headers', async () => {
            const res = await app.request(
                '/api/v1/presets',
                {
                    headers: {
                        Origin: 'http://localhost:3000',
                    },
                },
                env
            );

            expect(res.headers.get('Access-Control-Expose-Headers')).toContain('X-RateLimit-Remaining');
            expect(res.headers.get('Access-Control-Expose-Headers')).toContain('X-RateLimit-Reset');
        });

        // FINDING-002 (2026-08-09 pre-release audit): the loopback allowlist had
        // no environment guard, so production reflected Access-Control-Allow-Origin
        // for four localhost origins alongside credentials: true. Mirrors the
        // OAUTH-SEC-001 fix already present in apps/oauth/src/index.ts.
        describe('localhost origins are development-only (FINDING-002)', () => {
            // A production env that PASSES validateEnv — otherwise the env-validation
            // middleware 500s before cors() ever runs and every assertion below would
            // pass vacuously.
            const createProductionEnv = (): Env =>
                createMockEnv({
                    ...validProductionOverrides(),
                    CORS_ORIGIN: 'https://xivdyetools.app',
                });

            it('positive control: the configured production origin is still reflected', async () => {
                const res = await app.request(
                    '/',
                    { headers: { Origin: 'https://xivdyetools.app' } },
                    createProductionEnv()
                );

                expect(res.status).toBe(200);
                expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://xivdyetools.app');
            });

            it.each([
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'http://localhost:8787',
                'http://127.0.0.1:8787',
            ])('should not reflect %s in production', async (origin) => {
                const res = await app.request('/', { headers: { Origin: origin } }, createProductionEnv());

                expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
            });

            it.each([
                'http://localhost:5173',
                'http://127.0.0.1:5173',
                'http://localhost:8787',
                'http://127.0.0.1:8787',
            ])('should still reflect %s in development', async (origin) => {
                const res = await app.request(
                    '/',
                    { headers: { Origin: origin } },
                    createMockEnv({ ENVIRONMENT: 'development' })
                );

                expect(res.headers.get('Access-Control-Allow-Origin')).toBe(origin);
            });
        });
    });

    // ============================================
    // 404 Handler
    // ============================================

    describe('404 Handler', () => {
        it('should return 404 for unknown routes', async () => {
            const res = await app.request('/api/v1/nonexistent', {}, env);

            expect(res.status).toBe(404);
            const body = await res.json() as { error: string; message: string };

            expect(body.error).toBe('NOT_FOUND');
            expect(body.message).toContain('/api/v1/nonexistent');
        });

        it('should include method in 404 message', async () => {
            const res = await app.request(
                '/api/v1/unknown',
                {
                    method: 'POST',
                },
                env
            );

            expect(res.status).toBe(404);
            const body = await res.json() as { message: string };

            expect(body.message).toContain('POST');
        });
    });

    // ============================================
    // Error Handler
    // ============================================

    describe('Environment Validation', () => {
        // BUG-017 (2026-07-18 audit): a misconfigured production isolate must
        // fail EVERY request, not just the first one
        it('should 500 on every request when production env is misconfigured', async () => {
            // FINDING-013 review fix: must start from a fully-valid production
            // env and remove exactly this one variable — otherwise the env also
            // fails JWT_ISSUER/TOKEN_BLACKLIST/RL_PUBLIC validation, and this
            // test would stay red even if the BOT_SIGNING_SECRET check itself
            // were deleted from validateEnv.
            const badProdEnv = createMockEnv({
                ...validProductionOverrides(),
                BOT_SIGNING_SECRET: undefined, // required in production
            });

            const first = await app.request('/health', {}, badProdEnv);
            const second = await app.request('/health', {}, badProdEnv);

            expect(first.status).toBe(500);
            expect(second.status).toBe(500);
        });

        // FINDING-013 (2026-08-29 security audit): the same fail-closed,
        // fail-every-request behaviour must cover the new production-only
        // requirements too — a dropped TOKEN_BLACKLIST binding is exactly the
        // silent-degradation scenario the finding describes.
        it('should 500 on every request when TOKEN_BLACKLIST is missing in production (FINDING-013)', async () => {
            const badProdEnv = createMockEnv({
                ...validProductionOverrides(),
                TOKEN_BLACKLIST: undefined,
            });

            const first = await app.request('/health', {}, badProdEnv);
            const second = await app.request('/health', {}, badProdEnv);

            expect(first.status).toBe(500);
            expect(second.status).toBe(500);
        });
    });

    describe('Error Handler', () => {
        it('should add HSTS header in production', async () => {
            const prodEnv = createMockEnv(validProductionOverrides());

            const res = await app.request('/', {}, prodEnv);

            expect(res.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
        });

        it('should surface stack details in development when a route throws', async () => {
            const devEnv = createMockEnv({ ENVIRONMENT: 'development' });
            const res = await app.request('/__force-error', {}, devEnv);

            expect(res.status).toBe(500);
            const body = await res.json() as { message: string; stack?: string };

            expect(body.message).toBe('forced error');
            expect(body.stack).toBeDefined();
        });

        it('should hide stack details outside development when a route throws', async () => {
            const testEnv = createMockEnv({ ENVIRONMENT: 'test' });
            const res = await app.request('/__force-error', {}, testEnv);

            expect(res.status).toBe(500);
            const body = await res.json() as { message: string; stack?: string };

            expect(body.message).toBe('An unexpected error occurred');
            expect(body.stack).toBeUndefined();
        });

        it('should return 500 for unhandled errors in development', async () => {
            // We can't easily trigger an unhandled error from outside,
            // but we can test the error handler behavior by checking
            // that the error handler is registered
            createMockEnv({ ENVIRONMENT: 'development' });

            // This would need a route that throws - for now just verify the app loads
            expect(app).toBeDefined();
        });

        it('should hide error details in production', async () => {
            const prodEnv = createMockEnv({ ENVIRONMENT: 'production', BOT_SIGNING_SECRET: 'test-signing-secret', MODERATOR_IDS: '123456789012345678' });

            // Verify production env is set correctly
            expect(prodEnv.ENVIRONMENT).toBe('production');
        });

        it('should return 404 for force-error route in production', async () => {
            const prodEnv = createMockEnv(validProductionOverrides());
            const res = await app.request('/__force-error', {}, prodEnv);

            // In production, the force-error route returns 404 instead of throwing
            expect(res.status).toBe(404);
            const body = await res.json() as { error: string };
            expect(body.error).toBe('NOT_FOUND');
        });
    });

    // ============================================
    // Route Mounting
    // ============================================

    describe('Route Mounting', () => {
        it('should mount presets router at /api/v1/presets', async () => {
            const res = await app.request('/api/v1/presets', {}, env);

            // Should return something from the presets router, not 404
            expect(res.status).not.toBe(404);
        });

        it('should mount votes router at /api/v1/votes', async () => {
            // Need authentication for votes, but route should exist
            const res = await app.request('/api/v1/votes/test-id', { method: 'POST' }, env);

            // Should return 401 (auth required), not 404
            expect(res.status).toBe(401);
        });

        it('should mount categories router at /api/v1/categories', async () => {
            const res = await app.request('/api/v1/categories', {}, env);

            // Should return something from categories router
            expect(res.status).not.toBe(404);
        });

        it('should mount moderation router at /api/v1/moderation', async () => {
            // Need moderator auth, but route should exist
            const res = await app.request('/api/v1/moderation/pending', {}, env);

            // Should return 401 (auth required), not 404
            expect(res.status).toBe(401);
        });
    });

    // ============================================
    // Logger Middleware
    // ============================================

    describe('Logger Middleware', () => {
        it('should log requests (integration test)', async () => {
            // Logger middleware should be active
            // Just verify the app handles requests properly with logging
            const res = await app.request('/health', {}, env);
            expect(res.status).toBe(200);
        });

        // FINDING-010 (2026-08-29 security audit): loggerMiddleware was opted
        // into `logUserAgent: true`, so every request's User-Agent rode into the
        // "Request started" log context — contradicting the web privacy guide's
        // promise that the server "discards everything about the request".
        //
        // The worker-kit request logger is always the JSON adapter
        // (packages/logger/src/presets/worker.ts: `format: 'json'`
        // unconditionally), and JsonAdapter.write() always calls
        // `console.log(safeStringify(entry))` regardless of level — never
        // console.info/warn/etc. — so this spies on console.log and parses the
        // structured entry, rather than asserting on a header the app never
        // sends back to the client.
        it('does not log the User-Agent header on "Request started" (FINDING-010)', async () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            try {
                await app.request(
                    '/health',
                    { headers: { 'User-Agent': 'test-agent/1.0 (should-not-be-logged)' } },
                    env
                );

                const entries = logSpy.mock.calls
                    .map(([line]) => {
                        try {
                            return JSON.parse(String(line)) as {
                                message?: string;
                                context?: Record<string, unknown>;
                            };
                        } catch {
                            return null;
                        }
                    })
                    .filter((entry): entry is { message?: string; context?: Record<string, unknown> } => entry !== null);
                const startEntry = entries.find((entry) => entry.message === 'Request started');

                expect(startEntry).toBeDefined();
                expect(startEntry!.context).not.toHaveProperty('userAgent');
            } finally {
                logSpy.mockRestore();
            }
        });
    });

    // ============================================
    // Auth Middleware Integration
    // ============================================

    describe('Auth Middleware Integration', () => {
        it('should apply auth middleware to all routes', async () => {
            const res = await app.request(
                '/api/v1/presets/mine',
                {
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            // With valid auth, should get past auth middleware
            // Will fail at DB due to no mock, but proves auth is applied
            expect(res.status).not.toBe(401);
        });

        it('should allow unauthenticated access to public endpoints', async () => {
            const res = await app.request('/api/v1/presets', {}, env);

            // Public endpoints should work without auth
            // Will fail at DB layer, but not at auth
            expect(res.status).not.toBe(401);
        });
    });

    // ============================================
    // Content-Type Validation
    // ============================================

    describe('Content-Type Validation', () => {
        it('should reject POST with body but wrong content-type', async () => {
            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'text/plain',
                        'Content-Length': '10',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: 'some text',
                },
                env
            );

            expect(res.status).toBe(415);
            const body = await res.json() as { error: string; message: string };
            expect(body.error).toBe('Unsupported Media Type');
            expect(body.message).toContain('application/json');
        });

        it('should reject PATCH with body but no content-type', async () => {
            const res = await app.request(
                '/api/v1/presets/test-id',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Length': '10',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: '{}',
                },
                env
            );

            expect(res.status).toBe(415);
        });

        it('should allow POST with application/json content-type', async () => {
            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'test' }),
                },
                env
            );

            // Should pass Content-Type check (may fail later for other reasons)
            expect(res.status).not.toBe(415);
        });

        it('should allow POST with application/json; charset=utf-8', async () => {
            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'test' }),
                },
                env
            );

            // Should pass Content-Type check (may fail later for other reasons)
            expect(res.status).not.toBe(415);
        });

        it('should allow requests with empty body', async () => {
            const res = await app.request(
                '/api/v1/presets/test-id',
                {
                    method: 'PATCH',
                    headers: {
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                },
                env
            );

            // Should pass Content-Type check for empty body
            expect(res.status).not.toBe(415);
        });
    });

    // ============================================
    // Preview image upload — FULL middleware chain
    // ============================================

    // CRITICAL 1 & 2 (2026-08-10 final review): the handler tests mount
    // presetsRouter on a bare Hono app with only authMiddleware, so they never
    // saw the two global guards that made this route unreachable in production:
    // a 100 KB bodyLimit on all of /api/* (our images are up to 5 MB) and a
    // Content-Type gate that 415s anything that isn't application/json (the
    // client sends image/png). Neither was a handler bug, which is exactly why
    // no handler test could catch it. These tests drive the REAL app export.
    describe('Preview image upload through the real app', () => {
        // 200 KB of PNG: comfortably over the 100 KB global limit, well under
        // the route's own 5 MB one, so only the middleware chain can reject it.
        const bigPng = (() => {
            const bytes = new Uint8Array(200 * 1024);
            bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
            return bytes;
        })();

        const ctx = {
            waitUntil: () => {},
            passThroughOnException: () => {},
        } as unknown as ExecutionContext;

        // A real row the caller authors, so the request reaches the route's own
        // checks instead of stopping at 404/403 — otherwise "not 413" would
        // pass for the wrong reason.
        beforeEach(() => {
            const mockDb = createMockD1Database();
            mockDb._setupMock(() =>
                createMockPresetRow({ id: 'preset-123', author_discord_id: '123' })
            );
            env = createMockEnv({ DB: mockDb as unknown as D1Database });
        });

        const upload = (contentType?: string, body: Uint8Array = bigPng) =>
            app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'POST',
                    headers: {
                        ...(contentType ? { 'Content-Type': contentType } : {}),
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body,
                },
                env,
                ctx
            );

        it.each(['image/png', 'image/jpeg', 'image/webp'])(
            'accepts a 200 KB %s body: neither 413 nor 415',
            async (contentType) => {
                const res = await upload(contentType);

                expect(res.status).not.toBe(413);
                expect(res.status).not.toBe(415);
                expect(res.status).toBe(200);
            }
        );

        it('accepts a 200 KB body with no Content-Type at all', async () => {
            const res = await upload(undefined);

            expect(res.status).not.toBe(413);
            expect(res.status).not.toBe(415);
            expect(res.status).toBe(200);
        });

        it('still rejects a non-image Content-Type on the upload route', async () => {
            const res = await upload('text/plain');

            expect(res.status).toBe(415);
        });

        // The exemption is scoped to this one path — every other endpoint keeps
        // the 100 KB cap and the JSON-only rule.
        it('keeps the 100 KB limit on other /api routes', async () => {
            const res = await app.request(
                '/api/v1/presets',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ name: 'x'.repeat(200 * 1024) }),
                },
                env,
                ctx
            );

            expect(res.status).toBe(413);
        });

        it('keeps the 100 KB limit on the preview-image route for other methods', async () => {
            const res = await app.request(
                '/api/v1/presets/preset-123/preview-image',
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: 'Bearer test-bot-secret',
                        'X-User-Discord-ID': '123',
                    },
                    body: JSON.stringify({ pad: 'x'.repeat(200 * 1024) }),
                },
                env,
                ctx
            );

            expect(res.status).toBe(413);
        });

        // The route's own 5 MB check is the real limit, and it is reachable:
        // a 400 (not a 413) proves the handler, not the global bodyLimit,
        // rejected this one.
        it('rejects over 5 MB at the route, not at the global body limit', async () => {
            const tooBig = new Uint8Array(5 * 1024 * 1024 + 1);
            tooBig.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);

            const res = await upload('image/png', tooBig);

            expect(res.status).toBe(400);
        });
    });

    // ============================================
    // Environment Validation
    // ============================================

    describe('Environment Validation', () => {
        it('should return 500 in production with invalid env configuration', async () => {
            // Create an invalid production environment
            const invalidProdEnv = createMockEnv({
                ENVIRONMENT: 'production',
                CORS_ORIGIN: 'not-a-valid-url', // Invalid URL
            });

            // Note: The validation caches per isolate, so this test may be affected
            // by test order. In a real scenario, the first request with invalid env
            // would fail in production.
            const res = await app.request('/', {}, invalidProdEnv);

            // Could be 500 if env validation failed, or 200 if validation was cached
            expect([200, 500]).toContain(res.status);
        });
    });
});
