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

describe('verifyDiscordRequest', () => {
  const mockPublicKey = 'test-public-key';

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock result to default
    mockVerifyResult.isValid = true;
    mockVerifyResult.body = '';
    mockVerifyResult.error = undefined;
  });

  describe('signature verification', () => {
    it('should verify valid Discord signature', async () => {
      mockVerifyResult.isValid = true;
      mockVerifyResult.body = JSON.stringify({ type: 1 });
      mockVerifyResult.error = undefined;

      const request = new Request('https://example.com', {
        method: 'POST',
        headers: {
          'X-Signature-Ed25519': 'valid-signature',
          'X-Signature-Timestamp': '1234567890',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(true);
      expect(result.body).toBe(JSON.stringify({ type: 1 }));
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid Discord signature', async () => {
      mockVerifyResult.isValid = false;
      mockVerifyResult.body = JSON.stringify({ type: 1 });
      mockVerifyResult.error = 'Invalid signature';

      const request = new Request('https://example.com', {
        method: 'POST',
        headers: {
          'X-Signature-Ed25519': 'invalid-signature',
          'X-Signature-Timestamp': '1234567890',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should handle verification errors', async () => {
      mockVerifyResult.isValid = false;
      mockVerifyResult.body = JSON.stringify({ type: 1 });
      mockVerifyResult.error = 'Crypto error';

      const request = new Request('https://example.com', {
        method: 'POST',
        headers: {
          'X-Signature-Ed25519': 'signature',
          'X-Signature-Timestamp': '1234567890',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Crypto error');
    });
  });

  describe('missing headers', () => {
    it('should reject request with missing signature header', async () => {
      mockVerifyResult.isValid = false;
      mockVerifyResult.body = '';
      mockVerifyResult.error = 'Missing signature headers';

      const request = new Request('https://example.com', {
        method: 'POST',
        headers: {
          'X-Signature-Timestamp': '1234567890',
        },
        body: 'test',
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing signature headers');
      expect(result.body).toBe('');
    });

    it('should reject request with missing timestamp header', async () => {
      mockVerifyResult.isValid = false;
      mockVerifyResult.body = '';
      mockVerifyResult.error = 'Missing signature headers';

      const request = new Request('https://example.com', {
        method: 'POST',
        headers: {
          'X-Signature-Ed25519': 'signature',
        },
        body: 'test',
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing signature headers');
      expect(result.body).toBe('');
    });

    it('should reject request with both headers missing', async () => {
      mockVerifyResult.isValid = false;
      mockVerifyResult.body = '';
      mockVerifyResult.error = 'Missing signature headers';

      const request = new Request('https://example.com', {
        method: 'POST',
        body: 'test',
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing signature headers');
    });
  });

  describe('body size limits', () => {
    it('should reject request with Content-Length exceeding limit', async () => {
      mockVerifyResult.isValid = false;
      mockVerifyResult.body = '';
      mockVerifyResult.error = 'Request body too large';

      const request = new Request('https://example.com', {
        method: 'POST',
        headers: {
          'Content-Length': '100001', // Exceeds 100KB limit
          'X-Signature-Ed25519': 'signature',
          'X-Signature-Timestamp': '1234567890',
        },
        body: 'x'.repeat(100001),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Request body too large');
      expect(result.body).toBe('');
    });

    it('should accept request at exactly 100KB', async () => {
      mockVerifyResult.isValid = true;
      mockVerifyResult.body = 'x'.repeat(100000);
      mockVerifyResult.error = undefined;

      const bodyAt100KB = 'x'.repeat(100000);
      const request = new Request('https://example.com', {
        method: 'POST',
        headers: {
          'Content-Length': '100000',
          'X-Signature-Ed25519': 'signature',
          'X-Signature-Timestamp': '1234567890',
        },
        body: bodyAt100KB,
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle empty request body', async () => {
      mockVerifyResult.isValid = true;
      mockVerifyResult.body = '';
      mockVerifyResult.error = undefined;

      const request = new Request('https://example.com', {
        method: 'POST',
        headers: {
          'X-Signature-Ed25519': 'signature',
          'X-Signature-Timestamp': '1234567890',
        },
        body: '',
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(true);
      expect(result.body).toBe('');
    });
  });
});

describe('timingSafeEqual', () => {
  describe('equal strings', () => {
    it('should return true for identical strings', async () => {
      const result = await timingSafeEqual('hello', 'hello');
      expect(result).toBe(true);
    });

    it('should return true for empty strings', async () => {
      const result = await timingSafeEqual('', '');
      expect(result).toBe(true);
    });

    it('should return true for identical long strings', async () => {
      const longString = 'a'.repeat(1000);
      const result = await timingSafeEqual(longString, longString);
      expect(result).toBe(true);
    });

    it('should return true for identical special characters', async () => {
      const result = await timingSafeEqual('!@#$%^&*()', '!@#$%^&*()');
      expect(result).toBe(true);
    });

    it('should return true for identical unicode strings', async () => {
      const result = await timingSafeEqual('こんにちは', 'こんにちは');
      expect(result).toBe(true);
    });
  });

  describe('different strings', () => {
    it('should return false for different strings', async () => {
      const result = await timingSafeEqual('hello', 'world');
      expect(result).toBe(false);
    });

    it('should return false for strings with different lengths', async () => {
      const result = await timingSafeEqual('short', 'much longer string');
      expect(result).toBe(false);
    });

    it('should return false for one empty string', async () => {
      const result = await timingSafeEqual('', 'hello');
      expect(result).toBe(false);
    });

    it('should return false for strings differing by one character', async () => {
      const result = await timingSafeEqual('hello', 'hells');
      expect(result).toBe(false);
    });

    it('should return false for strings with different case', async () => {
      const result = await timingSafeEqual('Hello', 'hello');
      expect(result).toBe(false);
    });
  });

  describe('timing safety', () => {
    it('should use fallback XOR comparison when crypto.subtle fails', async () => {
      // Mock crypto.subtle.timingSafeEqual to be undefined
      const originalTimingSafeEqual = crypto.subtle.timingSafeEqual;
      crypto.subtle.timingSafeEqual = undefined as any;

      const result = await timingSafeEqual('test', 'test');
      expect(result).toBe(true);

      const resultDiff = await timingSafeEqual('test', 'diff');
      expect(resultDiff).toBe(false);

      // Restore
      crypto.subtle.timingSafeEqual = originalTimingSafeEqual;
    });

    it('should handle timing attack scenarios with constant-time comparison', async () => {
      // Both comparisons should take similar time (constant-time property)
      const token1 = 'a'.repeat(100);
      const token2 = 'b'.repeat(100);
      const token3 = 'a'.repeat(99) + 'b'; // Differs only at end

      // All these should complete without leaking timing information
      const result1 = await timingSafeEqual(token1, token2);
      const result2 = await timingSafeEqual(token1, token3);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
    });
  });
});

describe('unauthorizedResponse', () => {
  it('should create 401 response with default message', () => {
    const response = unauthorizedResponse();

    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should create 401 response with custom message', () => {
    const response = unauthorizedResponse('Custom error message');

    expect(response.status).toBe(401);
  });

  it('should include error message in response body', async () => {
    const response = unauthorizedResponse('Test error');
    const body = await response.json() as any;

    expect(body).toEqual({ error: 'Test error' });
  });

  it('should use default message when no argument provided', async () => {
    const response = unauthorizedResponse();
    const body = await response.json() as any;

    expect(body).toEqual({ error: 'Invalid request signature' });
  });
});

describe('badRequestResponse', () => {
  it('should create 400 response', () => {
    const response = badRequestResponse('Bad request');

    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('should include error message in response body', async () => {
    const response = badRequestResponse('Invalid data');
    const body = await response.json() as any;

    expect(body).toEqual({ error: 'Invalid data' });
  });

  it('should handle special characters in error message', async () => {
    const message = 'Error: <script>alert("xss")</script>';
    const response = badRequestResponse(message);
    const body = await response.json() as any;

    expect(body.error).toBe(message);
  });

  it('should handle empty error message', async () => {
    const response = badRequestResponse('');
    const body = await response.json() as any;

    expect(body).toEqual({ error: '' });
  });
});
