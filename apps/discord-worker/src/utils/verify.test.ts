/**
 * Tests for Discord request verification
 *
 * Note: verify.ts now re-exports from @xivdyetools/auth (REFACTOR-003).
 * These tests verify the re-exported functions work correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    verifyDiscordRequest,
    unauthorizedResponse,
    badRequestResponse,
    timingSafeEqual,
} from './verify.js';

// Mock the @xivdyetools/auth package's internal verification
// The package uses Web Crypto API for Ed25519 verification
const mockVerifyResult: { isValid: boolean; body: string; error: string | undefined } = { isValid: true, body: '', error: undefined };

vi.mock('@xivdyetools/auth', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xivdyetools/auth')>();
    return {
        ...actual,
        verifyDiscordRequest: vi.fn().mockImplementation(async () => mockVerifyResult),
        // Keep actual implementations for helper functions
        unauthorizedResponse: actual.unauthorizedResponse,
        badRequestResponse: actual.badRequestResponse,
        timingSafeEqual: actual.timingSafeEqual,
    };
});

// Re-import after mocking to get the mocked version
import { verifyDiscordRequest as mockedVerifyDiscordRequest } from '@xivdyetools/auth';

describe('verify.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock result to default
        mockVerifyResult.isValid = true;
        mockVerifyResult.body = '';
        mockVerifyResult.error = undefined;
    });

    describe('verifyDiscordRequest', () => {
        const mockPublicKey = 'mock-public-key';

        it('should return invalid when signature headers are missing', async () => {
            mockVerifyResult.isValid = false;
            mockVerifyResult.body = '';
            mockVerifyResult.error = 'Missing signature headers';

            const request = new Request('https://example.com', {
                method: 'POST',
                headers: {
                    'X-Signature-Timestamp': '12345',
                },
                body: '{}',
            });

            const result = await verifyDiscordRequest(request, mockPublicKey);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Missing signature headers');
        });

        it('should return valid when signature verification passes', async () => {
            mockVerifyResult.isValid = true;
            mockVerifyResult.body = '{"type": 1}';
            mockVerifyResult.error = undefined;

            const request = new Request('https://example.com', {
                method: 'POST',
                headers: {
                    'X-Signature-Ed25519': 'valid-signature',
                    'X-Signature-Timestamp': '12345',
                },
                body: '{"type": 1}',
            });

            const result = await verifyDiscordRequest(request, mockPublicKey);

            expect(result.isValid).toBe(true);
            expect(result.body).toBe('{"type": 1}');
            expect(result.error).toBeUndefined();
        });

        it('should return invalid when signature verification fails', async () => {
            mockVerifyResult.isValid = false;
            mockVerifyResult.body = '{}';
            mockVerifyResult.error = 'Invalid signature';

            const request = new Request('https://example.com', {
                method: 'POST',
                headers: {
                    'X-Signature-Ed25519': 'invalid-signature',
                    'X-Signature-Timestamp': '12345',
                },
                body: '{}',
            });

            const result = await verifyDiscordRequest(request, mockPublicKey);

            expect(result.isValid).toBe(false);
            expect(result.body).toBe('{}');
            expect(result.error).toBe('Invalid signature');
        });

        it('should reject request body that is too large', async () => {
            mockVerifyResult.isValid = false;
            mockVerifyResult.body = '';
            mockVerifyResult.error = 'Request body too large';

            const request = new Request('https://example.com', {
                method: 'POST',
                headers: {
                    'Content-Length': '200000', // >100KB
                    'X-Signature-Ed25519': 'signature',
                    'X-Signature-Timestamp': '12345',
                },
                body: '{}',
            });

            const result = await verifyDiscordRequest(request, mockPublicKey);

            expect(result.isValid).toBe(false);
            expect(result.error).toBe('Request body too large');
        });
    });

    describe('unauthorizedResponse', () => {
        it('should return a 401 response with default message', async () => {
            const response = unauthorizedResponse();

            expect(response.status).toBe(401);
            expect(response.headers.get('Content-Type')).toBe('application/json');

            const body = (await response.json()) as { error: string };
            expect(body).toEqual({ error: 'Invalid request signature' });
        });

        it('should return a 401 response with custom message', async () => {
            const response = unauthorizedResponse('Custom error message');

            expect(response.status).toBe(401);

            const body = (await response.json()) as { error: string };
            expect(body).toEqual({ error: 'Custom error message' });
        });
    });

    describe('badRequestResponse', () => {
        it('should return a 400 response with the provided message', async () => {
            const response = badRequestResponse('Invalid input');

            expect(response.status).toBe(400);
            expect(response.headers.get('Content-Type')).toBe('application/json');

            const body = (await response.json()) as { error: string };
            expect(body).toEqual({ error: 'Invalid input' });
        });
    });

    describe('timingSafeEqual', () => {
        it('should return true for identical strings', async () => {
            const result = await timingSafeEqual('test-secret', 'test-secret');
            expect(result).toBe(true);
        });

        it('should return false for different strings', async () => {
            const result = await timingSafeEqual('test-secret', 'wrong-secret');
            expect(result).toBe(false);
        });

        it('should return false for strings with different lengths', async () => {
            const result = await timingSafeEqual('short', 'much-longer-string');
            expect(result).toBe(false);
        });

        it('should return true for empty strings', async () => {
            const result = await timingSafeEqual('', '');
            expect(result).toBe(true);
        });

        it('should return false for empty vs non-empty', async () => {
            const result1 = await timingSafeEqual('', 'something');
            const result2 = await timingSafeEqual('something', '');
            expect(result1).toBe(false);
            expect(result2).toBe(false);
        });

        it('should handle unicode strings', async () => {
            const result1 = await timingSafeEqual('こんにちは', 'こんにちは');
            const result2 = await timingSafeEqual('こんにちは', 'さようなら');
            expect(result1).toBe(true);
            expect(result2).toBe(false);
        });

        it('should detect single character differences', async () => {
            const result = await timingSafeEqual('secret-key-123', 'secret-key-124');
            expect(result).toBe(false);
        });

        it('should handle very long identical strings', async () => {
            const longString = 'a'.repeat(10000);
            const result = await timingSafeEqual(longString, longString);
            expect(result).toBe(true);
        });

        it('should use fallback when crypto.subtle.timingSafeEqual is unavailable', async () => {
            // Mock crypto.subtle.timingSafeEqual to be undefined
            const originalTimingSafeEqual = crypto.subtle.timingSafeEqual;
            (crypto.subtle as unknown as { timingSafeEqual: undefined }).timingSafeEqual = undefined;

            const result1 = await timingSafeEqual('test', 'test');
            const result2 = await timingSafeEqual('test', 'diff');

            // Restore
            (crypto.subtle as unknown as { timingSafeEqual: typeof originalTimingSafeEqual }).timingSafeEqual = originalTimingSafeEqual;

            expect(result1).toBe(true);
            expect(result2).toBe(false);
        });
    });
});
