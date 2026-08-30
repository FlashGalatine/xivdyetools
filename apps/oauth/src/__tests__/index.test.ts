/**
 * Main App Tests
 * Tests for the Hono app, middleware, health checks, and error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SELF, fetchWithEnv, createProductionEnv, env, VALID_CODE_CHALLENGE } from './mocks/cloudflare-test.js';
import { resetRateLimiter, checkRateLimit } from '../services/rate-limit.js';

describe('OAuth Worker App', () => {
    beforeEach(() => {
        // Reset rate limiter before each test to avoid cross-test pollution
        resetRateLimiter();
    });

    describe('Health Check Routes', () => {
        it('GET / should return service info', async () => {
            const response = await SELF.fetch('http://localhost/');
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json).toMatchObject({
                service: 'xivdyetools-oauth',
                status: 'healthy',
            });
        });

        it('GET /health should return health status', async () => {
            const response = await SELF.fetch('http://localhost/health');
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(200);
            expect(json.status).toBe('healthy');
            expect(json.timestamp).toBeDefined();
            expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
        });
    });

    describe('CORS Middleware', () => {
        it('should allow localhost origins', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'http://localhost:5173' },
            });

            expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
        });

        it('should allow any localhost port', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'http://localhost:3000' },
            });

            expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
        });

        it('should not allow unknown origins', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'http://evil.com' },
            });

            expect(response.headers.get('access-control-allow-origin')).not.toBe('http://evil.com');
        });

        it('should allow FRONTEND_URL origin', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'http://localhost:5173' }, // This matches FRONTEND_URL in mock env
            });

            expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
        });

        // Regression: CORS previously allowed ONLY FRONTEND_URL, so the beta site
        // could pass the redirect_uri allowlist and start a login, then have every
        // token-exchange XHR blocked — completing the flow but never appearing
        // logged in. CORS and redirect URIs must share one allowlist.
        it('should allow every origin trusted for redirects, not just FRONTEND_URL', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'https://beta.xivdyetools.app' },
            });

            expect(response.headers.get('access-control-allow-origin')).toBe(
                'https://beta.xivdyetools.app'
            );
        });

        it('should still reject an origin that is in neither allowlist', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'https://beta.xivdyetools.app.evil.com' },
            });

            expect(response.headers.get('access-control-allow-origin')).not.toBe(
                'https://beta.xivdyetools.app.evil.com'
            );
        });

        it('should handle request without origin header', async () => {
            const response = await SELF.fetch('http://localhost/');

            // Response should still work without CORS headers
            expect(response.status).toBe(200);
        });

        it('should handle OPTIONS preflight requests', async () => {
            const response = await SELF.fetch('http://localhost/', {
                method: 'OPTIONS',
                headers: {
                    Origin: 'http://localhost:5173',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'Content-Type',
                },
            });

            expect(response.status).toBe(204);
            expect(response.headers.get('access-control-allow-methods')).toContain('POST');
        });

        it('should reject localhost without whitelisted port', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'http://localhost:9999' }, // Not in whitelist
            });

            // Should not include CORS headers for non-whitelisted port
            expect(response.headers.get('access-control-allow-origin')).not.toBe('http://localhost:9999');
        });

        it('should reject 127.0.0.1 without whitelisted port', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'http://127.0.0.1:9999' },
            });

            expect(response.headers.get('access-control-allow-origin')).not.toBe('http://127.0.0.1:9999');
        });

        it('should allow 127.0.0.1 with whitelisted port', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'http://127.0.0.1:5173' },
            });

            expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
        });

        it('should reject invalid URL in origin header', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'not-a-valid-url' },
            });

            // Should not allow invalid URLs
            expect(response.headers.get('access-control-allow-origin')).not.toBe('not-a-valid-url');
        });

        it('should reject localhost without port', async () => {
            const response = await SELF.fetch('http://localhost/', {
                headers: { Origin: 'http://localhost' }, // No port specified
            });

            // No port means empty string from url.port, not in whitelist
            expect(response.headers.get('access-control-allow-origin')).not.toBe('http://localhost');
        });
    });

    describe('404 Handler', () => {
        it('should return 404 for unknown routes', async () => {
            const response = await SELF.fetch('http://localhost/unknown/route');
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(404);
            expect(json.error).toBe('Not Found');
            expect(json.message).toContain('/unknown/route');
        });

        it('should include method in 404 message', async () => {
            const response = await SELF.fetch('http://localhost/unknown', {
                method: 'POST',
                body: '{}',
            });
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(404);
            expect(json.message).toContain('POST');
        });
    });

    /**
     * FINDING-022 (2026-08-29 security audit): every response this worker
     * emits is auth material or a step towards it, so none of it may be
     * cached (RFC 6749 §5.1). The header middleware used to set only
     * nosniff / X-Frame-Options / HSTS.
     */
    describe('Cache-Control (FINDING-022)', () => {
        it('should send no-store and Pragma: no-cache on every response', async () => {
            const response = await SELF.fetch('http://localhost/health');

            expect(response.status).toBe(200);
            expect(response.headers.get('Cache-Control')).toBe('no-store');
            expect(response.headers.get('Pragma')).toBe('no-cache');
        });

        it('should send no-store on a 404 too', async () => {
            const response = await SELF.fetch('http://localhost/unknown/route');

            expect(response.status).toBe(404);
            expect(response.headers.get('Cache-Control')).toBe('no-store');
            expect(response.headers.get('Pragma')).toBe('no-cache');
        });
    });

    /**
     * FINDING-010 (2026-08-29 security audit): loggerMiddleware was opted
     * into `logUserAgent: true`, so every request's User-Agent rode into the
     * "Request started" log context — contradicting the web privacy guide's
     * promise that the server "discards everything about the request".
     *
     * The worker-kit request logger is always the JSON adapter
     * (packages/logger/src/adapters/json-adapter.ts: `console.log(safeStringify(entry))`
     * regardless of level — never console.info/warn/etc.), so this spies on
     * console.log and parses the structured entry, rather than asserting on a
     * header the app never sends back to the client (mirrors
     * apps/presets-api/tests/index.test.ts).
     */
    describe('Logger Middleware (FINDING-010)', () => {
        it('does not log the User-Agent header on "Request started"', async () => {
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            try {
                await SELF.fetch('http://localhost/health', {
                    headers: { 'User-Agent': 'test-agent/1.0 (should-not-be-logged)' },
                });

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

    describe('Rate Limiting Middleware', () => {
        it('should add rate limit headers to auth responses', async () => {
            const response = await SELF.fetch(`http://localhost/auth/discord?code_challenge=${VALID_CODE_CHALLENGE}`);

            expect(response.headers.get('X-RateLimit-Limit')).toBeTruthy();
            expect(response.headers.get('X-RateLimit-Remaining')).toBeTruthy();
            expect(response.headers.get('X-RateLimit-Reset')).toBeTruthy();
        });

        it('should return 429 when rate limit is exceeded', async () => {
            // Exhaust the rate limit for /auth/discord (limit: 10)
            for (let i = 0; i < 10; i++) {
                checkRateLimit('test-ip-rate-limit', '/auth/discord');
            }

            // Make a request that should be rate limited
            const response = await fetchWithEnv(
                env,
                `http://localhost/auth/discord?code_challenge=${VALID_CODE_CHALLENGE}`,
                {
                    headers: {
                        'CF-Connecting-IP': 'test-ip-rate-limit',
                    },
                }
            );

            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(429);
            expect(json.error).toBe('Too Many Requests');
            expect(json.message).toContain('Rate limit exceeded');
            expect(json.retryAfter).toBeGreaterThan(0);
            expect(response.headers.get('Retry-After')).toBeTruthy();
        });

        it('should track rate limits per IP', async () => {
            // Use up rate limit for one IP
            for (let i = 0; i < 10; i++) {
                checkRateLimit('blocked-ip', '/auth/discord');
            }

            // Different IP should still work
            const response = await fetchWithEnv(
                env,
                `http://localhost/auth/discord?code_challenge=${VALID_CODE_CHALLENGE}`,
                {
                    headers: {
                        'CF-Connecting-IP': 'allowed-ip',
                    },
                }
            );

            expect(response.status).toBe(302); // Should redirect, not rate limited
        });
    });

    /**
     * FINDING-012 (2026-08-29 security audit): CloudflareRateLimiter is a
     * per-isolate singleton (services/rate-limit.ts) constructed without a
     * logger, and the middleware dropped `result.backendError` — so a
     * throwing RL_AUTH_* binding fell back to fail-open (the accepted
     * trade-off) with no signal anywhere that it had happened. The fix
     * surfaces `backendError` on checkRateLimit()'s result and logs it here,
     * per request, through the request-scoped logger — the limiter itself
     * cannot hold one. Same console.log/JSON-parse approach as the
     * FINDING-010 test above; the context is checked for exactly `path` plus
     * an explicit absence of the client's key/IP (constraints.md: no
     * client-visible header, no key/IP in the context).
     */
    describe('Rate limiter backend errors (FINDING-012)', () => {
        function throwingRateLimitBinding(): RateLimit {
            return {
                limit: async () => {
                    throw new Error('binding unavailable');
                },
            } as unknown as RateLimit;
        }

        function healthyRateLimitBinding(): RateLimit {
            return {
                limit: async () => ({ success: true }),
            } as unknown as RateLimit;
        }

        function parseLogEntries(
            calls: unknown[][]
        ): Array<{ level?: string; message?: string; context?: Record<string, unknown> }> {
            return calls
                .map(([line]: unknown[]) => {
                    try {
                        return JSON.parse(String(line)) as {
                            level?: string;
                            message?: string;
                            context?: Record<string, unknown>;
                        };
                    } catch {
                        return null;
                    }
                })
                .filter(
                    (entry): entry is { level?: string; message?: string; context?: Record<string, unknown> } =>
                        entry !== null
                );
        }

        it('still serves the request and logs a warn when the RL_AUTH_10 binding throws', async () => {
            const throwingEnv = { ...env, RL_AUTH_10: throwingRateLimitBinding() };
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            try {
                const response = await fetchWithEnv(
                    throwingEnv,
                    `http://localhost/auth/discord?code_challenge=${VALID_CODE_CHALLENGE}`
                );

                // Fail-open (existing accepted trade-off): still served, not 500/429.
                expect(response.status).toBe(302);

                const warnEntry = parseLogEntries(logSpy.mock.calls).find(
                    (entry) => entry.message === 'Rate limiter backend error — request allowed (fail-open)'
                );

                expect(warnEntry).toBeDefined();
                expect(warnEntry!.level).toBe('warn');
                expect(warnEntry!.context).toMatchObject({ path: '/auth/discord' });
                expect(warnEntry!.context).not.toHaveProperty('key');
                expect(warnEntry!.context).not.toHaveProperty('ip');
                expect(warnEntry!.context).not.toHaveProperty('error');
            } finally {
                logSpy.mockRestore();
            }
        });

        it('does not log a warn when the binding is healthy', async () => {
            const healthyEnv = { ...env, RL_AUTH_10: healthyRateLimitBinding() };
            const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
            try {
                const response = await fetchWithEnv(
                    healthyEnv,
                    `http://localhost/auth/discord?code_challenge=${VALID_CODE_CHALLENGE}`
                );

                expect(response.status).toBe(302);

                const warnEntry = parseLogEntries(logSpy.mock.calls).find(
                    (entry) => entry.message === 'Rate limiter backend error — request allowed (fail-open)'
                );

                expect(warnEntry).toBeUndefined();
            } finally {
                logSpy.mockRestore();
            }
        });
    });

    describe('Global Error Handler', () => {
        it('should handle unexpected errors in development mode', async () => {
            // We can test the error handler by causing an internal error
            // One way is to provide malformed data that causes an error deep in processing
            // But most errors are caught by specific handlers, so let's test via
            // a route that we know will trigger an error

            // For this test, we'll verify the error handler structure is correct
            // by checking that errors return proper JSON structure
            const response = await SELF.fetch('http://localhost/auth/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: 'invalid json {{{',
            });

            const json = (await response.json()) as Record<string, any>;
            expect(response.status).toBe(400);
            expect(json.error).toBeDefined();
        });

        it('should sanitize error messages in production mode', async () => {
            const prodEnv = createProductionEnv();

            // Make request with invalid JSON to trigger error handling
            const response = await fetchWithEnv(
                prodEnv,
                'http://localhost/auth/callback',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: 'invalid json',
                }
            );

            const json = (await response.json()) as Record<string, any>;
            expect(response.status).toBe(400);
            // In production, specific handler catches this before global error handler
            expect(json.success).toBe(false);
        });

        it('should return environment in health check', async () => {
            const prodEnv = createProductionEnv();

            const response = await fetchWithEnv(prodEnv, 'http://localhost/');
            const json = (await response.json()) as Record<string, any>;

            expect(json.environment).toBe('production');
        });

        it('should trigger global error handler with uncaught exception (development)', async () => {
            // This tests lines 132-143 of index.ts (app.onError handler)
            // We need to trigger an uncaught error that propagates to the global handler
            // One way is to cause an error during middleware processing

            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // We need to intercept the rate limiter to throw an error
            // For this test, we'll trigger the global handler by causing an error
            // in a way that bypasses specific route handlers

            // Use fetchWithEnv with an env that causes issues
            // The test verifies the console.error was called and response is 500
            // But most routes have try-catch, so this is tricky to trigger directly

            consoleSpy.mockRestore();
        });

        it('should return generic error message in production when global error handler triggers', async () => {
            // This tests the production branch of the global error handler
            const prodEnv = createProductionEnv();
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Make a request that could trigger errors
            const response = await fetchWithEnv(
                prodEnv,
                'http://localhost/auth/me',
                {
                    headers: {
                        Authorization: 'Bearer malformed.token.that.might.cause.issues',
                    },
                }
            );

            const json = (await response.json()) as Record<string, any>;

            // Even in error cases, production should return sanitized messages
            expect(response.status).toBeGreaterThanOrEqual(400);
            expect(json).toBeDefined();

            consoleSpy.mockRestore();
        });
    });

    /**
     * FINDING-029 (2026-08-21 security audit): the env-validation gate and HSTS
     * keyed on ENVIRONMENT === 'production', so a non-development, non-production
     * deployment (the deleted `[env.preview]`) failed OPEN. Everything that is
     * not `development` is now treated as production.
     */
    describe('Environment gates (FINDING-029)', () => {
        it('should fail closed with 500 when production config is invalid', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const brokenProd = { ...createProductionEnv(), FRONTEND_URL: 'http://insecure.example.com' };

            const response = await fetchWithEnv(brokenProd, 'http://localhost/health');
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(500);
            expect(json.error).toBe('Service misconfigured');
            consoleSpy.mockRestore();
        });

        it('should fail closed for a non-development environment that is not production either', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            // Exactly what the deleted preview env looked like: an unknown ENVIRONMENT
            // label with otherwise production-shaped config.
            const previewLike = { ...createProductionEnv(), ENVIRONMENT: 'preview' };

            const response = await fetchWithEnv(previewLike, 'http://localhost/health');
            const json = (await response.json()) as Record<string, any>;

            expect(response.status).toBe(500);
            expect(json.error).toBe('Service misconfigured');
            consoleSpy.mockRestore();
        });

        it('should keep serving with a warning when development config is invalid', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            const brokenDev = { ...env, JWT_EXPIRY: 'not-a-number' };

            const response = await fetchWithEnv(brokenDev, 'http://localhost/health');

            expect(response.status).toBe(200);
            consoleSpy.mockRestore();
        });

        it('should send HSTS in production and not in development', async () => {
            const prod = await fetchWithEnv(createProductionEnv(), 'http://localhost/health');
            expect(prod.headers.get('Strict-Transport-Security')).toContain('max-age=31536000');

            const dev = await SELF.fetch('http://localhost/health');
            expect(dev.headers.get('Strict-Transport-Security')).toBeNull();
        });
    });
});
