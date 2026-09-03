/**
 * Environment Validation Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnv, logValidationErrors } from '../../src/utils/env-validation';
import type { Env } from '../../src/types';
import { createMockD1Database } from '@xivdyetools/test-utils';

describe('Environment Validation', () => {
    /**
     * Create a valid environment for testing
     */
    function createValidEnv(overrides: Partial<Env> = {}): Env {
        return {
            DB: createMockD1Database() as unknown as D1Database,
            ENVIRONMENT: 'development',
            API_VERSION: 'v1',
            CORS_ORIGIN: 'https://example.com',
            BOT_API_SECRET: 'test-secret',
            MODERATOR_IDS: '123456789012345678',
            JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!',
            ...overrides,
        } as Env;
    }

    describe('validateEnv', () => {
        describe('required string environment variables', () => {
            it('should pass with all required variables set', () => {
                const env = createValidEnv();
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should fail when ENVIRONMENT is missing', () => {
                const env = createValidEnv({ ENVIRONMENT: undefined as unknown as string });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required env var: ENVIRONMENT');
            });

            it('should fail when API_VERSION is missing', () => {
                const env = createValidEnv({ API_VERSION: undefined as unknown as string });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required env var: API_VERSION');
            });

            it('should fail when CORS_ORIGIN is missing', () => {
                const env = createValidEnv({ CORS_ORIGIN: undefined as unknown as string });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required env var: CORS_ORIGIN');
            });

            it('should fail when BOT_API_SECRET is missing', () => {
                const env = createValidEnv({ BOT_API_SECRET: undefined as unknown as string });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required env var: BOT_API_SECRET');
            });

            it('should fail when MODERATOR_IDS is missing', () => {
                const env = createValidEnv({ MODERATOR_IDS: undefined as unknown as string });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required env var: MODERATOR_IDS');
            });

            it('should fail when a required variable is empty string', () => {
                const env = createValidEnv({ ENVIRONMENT: '' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required env var: ENVIRONMENT');
            });

            it('should fail when a required variable is whitespace only', () => {
                const env = createValidEnv({ ENVIRONMENT: '   ' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required env var: ENVIRONMENT');
            });
        });

        describe('CORS_ORIGIN URL validation', () => {
            it('should pass with a valid URL', () => {
                const env = createValidEnv({ CORS_ORIGIN: 'https://example.com' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass with localhost URL', () => {
                const env = createValidEnv({ CORS_ORIGIN: 'http://localhost:3000' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should fail with an invalid URL', () => {
                const env = createValidEnv({ CORS_ORIGIN: 'not-a-valid-url' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid URL for CORS_ORIGIN: not-a-valid-url');
            });

            it('should fail with a malformed URL', () => {
                const env = createValidEnv({ CORS_ORIGIN: 'http://[invalid' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors.some(e => e.includes('Invalid URL for CORS_ORIGIN'))).toBe(true);
            });
        });

        describe('ADDITIONAL_CORS_ORIGINS validation', () => {
            it('should pass when not provided', () => {
                const env = createValidEnv({ ADDITIONAL_CORS_ORIGINS: undefined });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass with a single valid URL', () => {
                const env = createValidEnv({
                    ADDITIONAL_CORS_ORIGINS: 'https://other.example.com',
                });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass with multiple valid URLs', () => {
                const env = createValidEnv({
                    ADDITIONAL_CORS_ORIGINS: 'https://one.com, https://two.com, https://three.com',
                });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should fail with an invalid URL in the list', () => {
                const env = createValidEnv({
                    ADDITIONAL_CORS_ORIGINS: 'https://valid.com, not-a-url, https://another.com',
                });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid URL in ADDITIONAL_CORS_ORIGINS: not-a-url');
            });

            it('should skip empty entries in comma-separated list', () => {
                const env = createValidEnv({
                    ADDITIONAL_CORS_ORIGINS: 'https://valid.com, , https://another.com',
                });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should handle whitespace in comma-separated list', () => {
                const env = createValidEnv({
                    ADDITIONAL_CORS_ORIGINS: '  https://one.com  ,  https://two.com  ',
                });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });
        });

        describe('MODERATOR_IDS validation', () => {
            it('should pass with a valid Discord snowflake ID (17 digits)', () => {
                const env = createValidEnv({ MODERATOR_IDS: '12345678901234567' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass with a valid Discord snowflake ID (18 digits)', () => {
                const env = createValidEnv({ MODERATOR_IDS: '123456789012345678' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass with a valid Discord snowflake ID (19 digits)', () => {
                const env = createValidEnv({ MODERATOR_IDS: '1234567890123456789' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass with multiple valid IDs comma-separated', () => {
                const env = createValidEnv({
                    MODERATOR_IDS: '123456789012345678,234567890123456789,345678901234567890',
                });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass with multiple valid IDs space-separated', () => {
                const env = createValidEnv({
                    MODERATOR_IDS: '123456789012345678 234567890123456789',
                });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass with mixed comma and space separators', () => {
                const env = createValidEnv({
                    MODERATOR_IDS: '123456789012345678, 234567890123456789 345678901234567890',
                });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should fail with an ID that is too short (< 17 digits)', () => {
                const env = createValidEnv({ MODERATOR_IDS: '1234567890123456' }); // 16 digits
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid Discord ID in MODERATOR_IDS: 1234567890123456');
            });

            it('should fail with an ID that is too long (> 20 digits)', () => {
                const env = createValidEnv({ MODERATOR_IDS: '123456789012345678901' }); // 21 digits
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid Discord ID in MODERATOR_IDS: 123456789012345678901');
            });

            it('should fail with non-numeric characters', () => {
                const env = createValidEnv({ MODERATOR_IDS: '12345678901234567a' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid Discord ID in MODERATOR_IDS: 12345678901234567a');
            });

            it('should fail when one ID in a list is invalid', () => {
                const env = createValidEnv({
                    MODERATOR_IDS: '123456789012345678,invalid,345678901234567890',
                });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid Discord ID in MODERATOR_IDS: invalid');
            });

            it('should fail when MODERATOR_IDS is only whitespace (empty after filter)', () => {
                const env = createValidEnv({ MODERATOR_IDS: '   ' });
                const result = validateEnv(env);

                // Should fail on the "empty required var" check first
                expect(result.valid).toBe(false);
            });
        });

        describe('DB binding validation', () => {
            it('should pass when DB is provided', () => {
                const env = createValidEnv();
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should fail when DB is missing', () => {
                const env = createValidEnv({ DB: undefined as unknown as D1Database });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required D1 database binding: DB');
            });
        });

        // FINDING-013 (2026-08-29 security audit): production also requires
        // the security bindings/vars the 2026-08-21 fixes rely on — a dropped
        // binding (config edit, dashboard change) previously degraded to "no
        // revocation" / "no issuer pinning" / a fallback rate limiter with no
        // error and no log. Development keeps them optional.
        describe('production-only requirements (FINDING-013)', () => {
            function createValidProductionEnv(overrides: Partial<Env> = {}): Env {
                return createValidEnv({
                    ENVIRONMENT: 'production',
                    BOT_SIGNING_SECRET: 'test-signing-secret',
                    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-bytes!!-that-is-at-least-32-bytes!!',
                    JWT_ISSUER: 'https://auth.xivdyetools.app',
                    TOKEN_BLACKLIST: {} as unknown as KVNamespace,
                    RL_PUBLIC: {} as unknown as RateLimit,
                    // BUG-043: the notification and image paths join the same
                    // class — they degrade silently rather than loudly.
                    INTERNAL_WEBHOOK_SECRET: 'test-internal-webhook-secret',
                    DISCORD_WORKER: {} as unknown as Fetcher,
                    IMAGE_WORKER: {} as unknown as Fetcher,
                    THUMBNAILS: {} as unknown as R2Bucket,
                    ...overrides,
                });
            }

            it('should pass when every production-only requirement is satisfied', () => {
                const result = validateEnv(createValidProductionEnv());

                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            /**
             * BUG-043: without these, `notifyDiscordBot` returns early with an
             * `info` log and NO throw — so the caller's
             * `.catch(storeFailedNotification)` never runs and nothing lands in
             * `failed_notifications` either. Every flagged submission stops
             * reaching the moderation channel while
             * `GET /moderation/failed-notifications` stays empty, which reads
             * as "nothing was missed".
             */
            it.each([
                ['INTERNAL_WEBHOOK_SECRET', 'Missing required env var in production: INTERNAL_WEBHOOK_SECRET'],
                ['DISCORD_WORKER', 'Missing required service binding in production: DISCORD_WORKER'],
                ['IMAGE_WORKER', 'Missing required service binding in production: IMAGE_WORKER'],
                ['THUMBNAILS', 'Missing required R2 binding in production: THUMBNAILS'],
            ])('should fail when %s is missing in production', (key, message) => {
                const result = validateEnv(createValidProductionEnv({ [key]: undefined }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain(message);
            });

            it('keeps all four optional outside production', () => {
                const result = validateEnv(
                    createValidEnv({
                        ENVIRONMENT: 'development',
                        INTERNAL_WEBHOOK_SECRET: undefined,
                        DISCORD_WORKER: undefined,
                        IMAGE_WORKER: undefined,
                        THUMBNAILS: undefined,
                    })
                );

                expect(result.valid).toBe(true);
            });

            it('should fail when JWT_SECRET is missing in production', () => {
                const result = validateEnv(createValidProductionEnv({ JWT_SECRET: undefined }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: JWT_SECRET');
            });

            it('should fail when JWT_SECRET is shorter than 32 characters in production', () => {
                const result = validateEnv(createValidProductionEnv({ JWT_SECRET: 'short-secret' }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: JWT_SECRET');
            });

            it('should fail when JWT_ISSUER is missing in production', () => {
                const result = validateEnv(createValidProductionEnv({ JWT_ISSUER: undefined }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: JWT_ISSUER');
            });

            it('should fail when JWT_ISSUER does not start with https:// in production', () => {
                const result = validateEnv(
                    createValidProductionEnv({ JWT_ISSUER: 'http://auth.xivdyetools.app' })
                );

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: JWT_ISSUER');
            });

            it('should fail when the TOKEN_BLACKLIST binding is missing in production', () => {
                const result = validateEnv(createValidProductionEnv({ TOKEN_BLACKLIST: undefined }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: TOKEN_BLACKLIST');
            });

            it('should fail when the RL_PUBLIC binding is missing in production', () => {
                const result = validateEnv(createValidProductionEnv({ RL_PUBLIC: undefined }));

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required env var in production: RL_PUBLIC');
            });

            it('should collect all four errors together when nothing is configured', () => {
                const result = validateEnv(
                    createValidProductionEnv({
                        JWT_SECRET: undefined,
                        JWT_ISSUER: undefined,
                        TOKEN_BLACKLIST: undefined,
                        RL_PUBLIC: undefined,
                    })
                );

                expect(result.valid).toBe(false);
                expect(result.errors).toEqual(
                    expect.arrayContaining([
                        'Missing required env var in production: JWT_SECRET',
                        'Missing required env var in production: JWT_ISSUER',
                        'Missing required env var in production: TOKEN_BLACKLIST',
                        'Missing required env var in production: RL_PUBLIC',
                    ])
                );
            });

            it('keeps JWT_SECRET, JWT_ISSUER, TOKEN_BLACKLIST and RL_PUBLIC optional outside production', () => {
                const result = validateEnv(
                    createValidEnv({
                        ENVIRONMENT: 'development',
                        JWT_SECRET: undefined,
                        JWT_ISSUER: undefined,
                        TOKEN_BLACKLIST: undefined,
                        RL_PUBLIC: undefined,
                    })
                );

                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
        });

        describe('multiple errors', () => {
            it('should collect all errors in a single validation run', () => {
                const env = {
                    // All required vars missing
                    DB: undefined,
                    ENVIRONMENT: '',
                    API_VERSION: undefined,
                    CORS_ORIGIN: 'not-a-url',
                    BOT_API_SECRET: undefined,
                    MODERATOR_IDS: 'invalid',
                } as unknown as Env;

                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(3);
            });
        });
    });

    describe('logValidationErrors', () => {
        let consoleSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        afterEach(() => {
            consoleSpy.mockRestore();
        });

        it('should log header and each error', () => {
            const errors = ['Error 1', 'Error 2', 'Error 3'];
            logValidationErrors(errors);

            expect(consoleSpy).toHaveBeenCalledWith('Environment validation failed:');
            expect(consoleSpy).toHaveBeenCalledWith('  - Error 1');
            expect(consoleSpy).toHaveBeenCalledWith('  - Error 2');
            expect(consoleSpy).toHaveBeenCalledWith('  - Error 3');
        });

        it('should work with empty errors array', () => {
            logValidationErrors([]);

            expect(consoleSpy).toHaveBeenCalledWith('Environment validation failed:');
            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });

        it('should work with single error', () => {
            logValidationErrors(['Single error']);

            expect(consoleSpy).toHaveBeenCalledWith('Environment validation failed:');
            expect(consoleSpy).toHaveBeenCalledWith('  - Single error');
            expect(consoleSpy).toHaveBeenCalledTimes(2);
        });
    });
});
