/**
 * Tests for Environment Variable Validation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateEnv, logValidationErrors } from './env-validation.js';
import type { Env } from '../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

// Create a minimal valid env for testing
function createMinimalEnv(overrides: Partial<Env> = {}): Env {
    return {
        DISCORD_TOKEN: 'valid-token',
        DISCORD_PUBLIC_KEY: 'valid-public-key',
        DISCORD_CLIENT_ID: 'valid-client-id',
        PRESETS_API_URL: 'https://api.example.com',
        KV: {} as KVNamespace,
        DB: {} as D1Database,
        ...overrides,
    } as Env;
}

describe('env-validation.ts', () => {
    describe('validateEnv', () => {
        describe('required secrets', () => {
            it('should pass when all required secrets are present', () => {
                const env = createMinimalEnv();
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });

            it('should fail when DISCORD_TOKEN is missing', () => {
                const env = createMinimalEnv({ DISCORD_TOKEN: undefined as unknown as string });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required secret: DISCORD_TOKEN');
            });

            it('should fail when DISCORD_TOKEN is empty string', () => {
                const env = createMinimalEnv({ DISCORD_TOKEN: '' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required secret: DISCORD_TOKEN');
            });

            it('should fail when DISCORD_TOKEN is whitespace only', () => {
                const env = createMinimalEnv({ DISCORD_TOKEN: '   ' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required secret: DISCORD_TOKEN');
            });

            it('should fail when DISCORD_PUBLIC_KEY is missing', () => {
                const env = createMinimalEnv({ DISCORD_PUBLIC_KEY: undefined as unknown as string });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required secret: DISCORD_PUBLIC_KEY');
            });
        });

        describe('required config', () => {
            it('should fail when DISCORD_CLIENT_ID is missing', () => {
                const env = createMinimalEnv({ DISCORD_CLIENT_ID: undefined as unknown as string });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required config: DISCORD_CLIENT_ID');
            });

            it('should fail when PRESETS_API_URL is missing', () => {
                const env = createMinimalEnv({ PRESETS_API_URL: undefined as unknown as string });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing or empty required config: PRESETS_API_URL');
            });
        });

        describe('PRESETS_API_URL validation', () => {
            it('should accept valid HTTPS URL', () => {
                const env = createMinimalEnv({ PRESETS_API_URL: 'https://api.example.com' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should accept valid HTTP URL', () => {
                const env = createMinimalEnv({ PRESETS_API_URL: 'http://localhost:8787' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should reject invalid URL', () => {
                const env = createMinimalEnv({ PRESETS_API_URL: 'not-a-valid-url' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid URL for PRESETS_API_URL: not-a-valid-url');
            });

            it('should reject non-HTTP protocols', () => {
                const env = createMinimalEnv({ PRESETS_API_URL: 'ftp://example.com' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('PRESETS_API_URL must use HTTP(S): ftp://example.com');
            });
        });

        describe('KV namespace binding', () => {
            it('should fail when KV is missing', () => {
                const env = createMinimalEnv({ KV: undefined as unknown as KVNamespace });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required KV namespace binding: KV');
            });
        });

        describe('D1 database binding', () => {
            it('should fail when DB is missing', () => {
                const env = createMinimalEnv({ DB: undefined as unknown as D1Database });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Missing required D1 database binding: DB');
            });
        });

        describe('MODERATOR_IDS validation', () => {
            it('should pass when MODERATOR_IDS is not set', () => {
                const env = createMinimalEnv();
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass for valid Discord IDs (17-19 digits)', () => {
                const env = createMinimalEnv({ MODERATOR_IDS: '12345678901234567,123456789012345678' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should fail for invalid Discord IDs (too short)', () => {
                const env = createMinimalEnv({ MODERATOR_IDS: '1234' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid Discord ID in MODERATOR_IDS: 1234');
            });

            it('should fail for invalid Discord IDs (too long)', () => {
                const env = createMinimalEnv({ MODERATOR_IDS: '123456789012345678901' }); // 21 digits
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid Discord ID in MODERATOR_IDS: 123456789012345678901');
            });

            it('should fail for Discord IDs with non-numeric characters', () => {
                const env = createMinimalEnv({ MODERATOR_IDS: '1234567890123456a' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid Discord ID in MODERATOR_IDS: 1234567890123456a');
            });

            it('should handle multiple IDs with invalid ones', () => {
                const env = createMinimalEnv({ MODERATOR_IDS: '12345678901234567,invalid,123456789012345678' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid Discord ID in MODERATOR_IDS: invalid');
            });

            it('should handle whitespace around IDs', () => {
                const env = createMinimalEnv({ MODERATOR_IDS: '  12345678901234567  ,  123456789012345678  ' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });
        });

        describe('STATS_AUTHORIZED_USERS validation', () => {
            it('should pass when STATS_AUTHORIZED_USERS is not set', () => {
                const env = createMinimalEnv();
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should pass for valid Discord IDs', () => {
                const env = createMinimalEnv({ STATS_AUTHORIZED_USERS: '12345678901234567' });
                const result = validateEnv(env);

                expect(result.valid).toBe(true);
            });

            it('should fail for invalid Discord IDs', () => {
                const env = createMinimalEnv({ STATS_AUTHORIZED_USERS: 'invalid-id' });
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors).toContain('Invalid Discord ID in STATS_AUTHORIZED_USERS: invalid-id');
            });
        });

        describe('multiple errors', () => {
            it('should collect all validation errors', () => {
                const env = {
                    // Missing required items
                } as unknown as Env;
                const result = validateEnv(env);

                expect(result.valid).toBe(false);
                expect(result.errors.length).toBeGreaterThan(1);
            });
        });
    });

    describe('logValidationErrors', () => {
        let mockLogger: ExtendedLogger;
        let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            mockLogger = {
                error: vi.fn(),
                info: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn(),
            } as unknown as ExtendedLogger;
            consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        });

        it('should log to logger when provided', () => {
            const errors = ['Error 1', 'Error 2'];

            logValidationErrors(errors, mockLogger);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Environment validation failed',
                undefined,
                { errors }
            );
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        it('should log to console when logger is not provided', () => {
            const errors = ['Error 1', 'Error 2'];

            logValidationErrors(errors);

            expect(consoleErrorSpy).toHaveBeenCalledWith('Environment validation failed:');
            expect(consoleErrorSpy).toHaveBeenCalledWith('  - Error 1');
            expect(consoleErrorSpy).toHaveBeenCalledWith('  - Error 2');
        });

        it('should handle empty errors array', () => {
            logValidationErrors([], mockLogger);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Environment validation failed',
                undefined,
                { errors: [] }
            );
        });
    });
});
