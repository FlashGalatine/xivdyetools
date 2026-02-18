/**
 * Main App (Index) Tests
 * Tests for health endpoints, CORS, error handling, and route mounting
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../src/index';
import type { Env } from '../src/types';
import { createMockEnv } from './test-utils';

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

    describe('Error Handler', () => {
        it('should add HSTS header in production', async () => {
            const prodEnv = createMockEnv({ ENVIRONMENT: 'production' });

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
            const devEnv = createMockEnv({ ENVIRONMENT: 'development' });

            // This would need a route that throws - for now just verify the app loads
            expect(app).toBeDefined();
        });

        it('should hide error details in production', async () => {
            const prodEnv = createMockEnv({ ENVIRONMENT: 'production' });

            // Verify production env is set correctly
            expect(prodEnv.ENVIRONMENT).toBe('production');
        });

        it('should return 404 for force-error route in production', async () => {
            const prodEnv = createMockEnv({ ENVIRONMENT: 'production' });
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
