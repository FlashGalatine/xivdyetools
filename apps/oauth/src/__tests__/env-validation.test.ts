/**
 * Environment Validation Tests
 * Tests for env-validation.ts utility functions
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateEnv, logValidationErrors } from '../utils/env-validation.js';
import type { Env } from '../types.js';

// Create a valid mock environment for testing
const createValidEnv = (): Env => ({
    ENVIRONMENT: 'development',
    DISCORD_CLIENT_ID: '12345678901234567',
    DISCORD_CLIENT_SECRET: 'test-client-secret',
    XIVAUTH_CLIENT_ID: 'test-xivauth-client-id',
    JWT_SECRET: 'test-jwt-secret-key-for-testing-32chars',
    JWT_EXPIRY: '3600',
    FRONTEND_URL: 'http://localhost:5173',
    WORKER_URL: 'http://localhost:8788',
    DB: {} as D1Database,
});

// FINDING-013 (2026-08-29 security audit): a fully valid production
// environment — every test in the "production-only requirements" describe
// below starts from this and removes exactly ONE binding (the Sprint 1
// lesson recorded in apps/presets-api/tests/utils/env-validation.test.ts: a
// test that removes several vars at once proves nothing about any one of
// them).
const createValidProductionEnv = (overrides: Partial<Env> = {}): Env => ({
    ...createValidEnv(),
    ENVIRONMENT: 'production',
    FRONTEND_URL: 'https://xivdyetools.example.com',
    WORKER_URL: 'https://oauth.example.com',
    TOKEN_BLACKLIST: {} as unknown as KVNamespace,
    RL_AUTH_10: {} as unknown as RateLimit,
    RL_AUTH_20: {} as unknown as RateLimit,
    RL_AUTH_30: {} as unknown as RateLimit,
    ...overrides,
});

describe('Environment Validation', () => {
    describe('validateEnv', () => {
        it('should pass with valid development environment', () => {
            const env = createValidEnv();
            const result = validateEnv(env);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should pass with valid production environment using HTTPS', () => {
            const result = validateEnv(createValidProductionEnv());

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail when required string variables are missing', () => {
            const env = {
                ENVIRONMENT: 'development',
                // Missing other required fields
            } as unknown as Env;

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors.some(e => e.includes('DISCORD_CLIENT_ID'))).toBe(true);
        });

        it('should fail when JWT_EXPIRY is not a valid number', () => {
            const env = createValidEnv();
            env.JWT_EXPIRY = 'not-a-number';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('JWT_EXPIRY'))).toBe(true);
            expect(result.errors.some(e => e.includes('positive number'))).toBe(true);
        });

        it('should fail when JWT_EXPIRY is zero', () => {
            const env = createValidEnv();
            env.JWT_EXPIRY = '0';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('JWT_EXPIRY'))).toBe(true);
        });

        it('should fail when JWT_EXPIRY is negative', () => {
            const env = createValidEnv();
            env.JWT_EXPIRY = '-100';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('JWT_EXPIRY'))).toBe(true);
        });

        it('should fail when URL is invalid', () => {
            const env = createValidEnv();
            env.FRONTEND_URL = 'not-a-valid-url';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('Invalid URL'))).toBe(true);
        });

        it('should fail when production URLs use HTTP instead of HTTPS', () => {
            const env = createValidEnv();
            env.ENVIRONMENT = 'production';
            env.FRONTEND_URL = 'http://insecure.example.com';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('FRONTEND_URL') && e.includes('must use HTTPS'))).toBe(true);
        });

        it('should fail when WORKER_URL uses HTTP in production', () => {
            const env = createValidEnv();
            env.ENVIRONMENT = 'production';
            env.FRONTEND_URL = 'https://secure.example.com';
            env.WORKER_URL = 'http://insecure-worker.example.com';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('WORKER_URL') && e.includes('HTTPS'))).toBe(true);
        });

        // FINDING-029 (2026-08-21 security audit): every fail-closed gate keyed on
        // ENVIRONMENT === 'production', so any other non-development value (the
        // since-deleted `preview` env) was a production-grade issuer that failed
        // open. The gates now key on !== 'development', and ENVIRONMENT itself is
        // restricted to the two values wrangler.toml defines.
        it('should require HTTPS for every non-development environment, not only production', () => {
            const env = createValidEnv();
            env.ENVIRONMENT = 'preview';
            env.FRONTEND_URL = 'http://insecure.example.com';
            env.WORKER_URL = 'http://insecure-worker.example.com';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('FRONTEND_URL') && e.includes('HTTPS'))).toBe(true);
            expect(result.errors.some(e => e.includes('WORKER_URL') && e.includes('HTTPS'))).toBe(true);
        });

        it('should reject an ENVIRONMENT value other than development or production', () => {
            for (const value of ['preview', 'staging', 'Production', 'prod']) {
                const env = createValidEnv();
                env.ENVIRONMENT = value;
                env.FRONTEND_URL = 'https://secure.example.com';
                env.WORKER_URL = 'https://secure-worker.example.com';

                const result = validateEnv(env);

                expect(result.valid, value).toBe(false);
                expect(result.errors.some(e => e.startsWith('ENVIRONMENT must be')), value).toBe(true);
            }
        });

        it('should still allow HTTP URLs in development', () => {
            const env = createValidEnv(); // development + http://localhost URLs

            expect(validateEnv(env).valid).toBe(true);
        });

        it('should fail when DB is not provided', () => {
            const env = createValidEnv();
            // @ts-expect-error - intentionally testing undefined DB
            env.DB = undefined;

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('D1 database binding'))).toBe(true);
        });

        it('should fail when required string is empty', () => {
            const env = createValidEnv();
            env.DISCORD_CLIENT_ID = '';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('DISCORD_CLIENT_ID'))).toBe(true);
        });

        it('should fail when required string is only whitespace', () => {
            const env = createValidEnv();
            env.JWT_SECRET = '   ';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('JWT_SECRET'))).toBe(true);
        });

        // REFACTOR-003: Validate DISCORD_CLIENT_ID as a snowflake
        it('should fail when DISCORD_CLIENT_ID is not a valid snowflake', () => {
            const env = createValidEnv();
            env.DISCORD_CLIENT_ID = 'not-a-snowflake';

            const result = validateEnv(env);

            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('DISCORD_CLIENT_ID') && e.includes('snowflake'))).toBe(true);
        });

        // FINDING-013 (2026-08-29 security audit): production also requires
        // the bindings the 2026-08-21 fixes rely on — a dropped binding
        // (config edit, dashboard change) previously degraded silently: the
        // KV or in-memory rate-limit fallback instead of the native
        // per-client limiter, or no revocation check, with no error and no
        // log. Development keeps them optional.
        describe('production-only requirements (FINDING-013)', () => {
            it('should pass when every production-only requirement is satisfied', () => {
                const result = validateEnv(createValidProductionEnv());

                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should fail when the RL_AUTH_10 binding is missing in production', () => {
                const result = validateEnv(createValidProductionEnv({ RL_AUTH_10: undefined }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: RL_AUTH_10');
            });

            it('should fail when the RL_AUTH_20 binding is missing in production', () => {
                const result = validateEnv(createValidProductionEnv({ RL_AUTH_20: undefined }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: RL_AUTH_20');
            });

            it('should fail when the RL_AUTH_30 binding is missing in production', () => {
                const result = validateEnv(createValidProductionEnv({ RL_AUTH_30: undefined }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: RL_AUTH_30');
            });

            it('should fail when the TOKEN_BLACKLIST binding is missing in production', () => {
                const result = validateEnv(createValidProductionEnv({ TOKEN_BLACKLIST: undefined }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: TOKEN_BLACKLIST');
            });

            it('should collect all four errors together when nothing is configured', () => {
                const result = validateEnv(
                    createValidProductionEnv({
                        RL_AUTH_10: undefined,
                        RL_AUTH_20: undefined,
                        RL_AUTH_30: undefined,
                        TOKEN_BLACKLIST: undefined,
                    })
                );

                expect(result.valid).toBe(false);
                expect(result.errors).toEqual(
                    expect.arrayContaining([
                        'Missing required env var in production: RL_AUTH_10',
                        'Missing required env var in production: RL_AUTH_20',
                        'Missing required env var in production: RL_AUTH_30',
                        'Missing required env var in production: TOKEN_BLACKLIST',
                    ])
                );
            });

            it('keeps RL_AUTH_10, RL_AUTH_20, RL_AUTH_30 and TOKEN_BLACKLIST optional outside production', () => {
                const result = validateEnv(
                    createValidEnv() // development; none of the four bindings set
                );

                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
        });
    });

    describe('logValidationErrors', () => {
        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('should log all errors to console.error', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            const errors = ['Error 1', 'Error 2', 'Error 3'];
            logValidationErrors(errors);

            // First call is the header
            expect(consoleSpy).toHaveBeenCalledWith('Environment validation failed:');
            // Then one call per error
            expect(consoleSpy).toHaveBeenCalledWith('  - Error 1');
            expect(consoleSpy).toHaveBeenCalledWith('  - Error 2');
            expect(consoleSpy).toHaveBeenCalledWith('  - Error 3');
            expect(consoleSpy).toHaveBeenCalledTimes(4);
        });

        it('should handle empty error array', () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            logValidationErrors([]);

            expect(consoleSpy).toHaveBeenCalledWith('Environment validation failed:');
            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });
    });
});
