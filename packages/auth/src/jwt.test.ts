/**
 * Tests for JWT Verification Utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  decodeJWT,
  verifyJWT,
  verifyJWTSignatureOnly,
  isJWTExpired,
  getJWTTimeToExpiry,
  type JWTPayload,
} from './jwt.js';
import { base64UrlEncode, base64UrlEncodeBytes } from '@xivdyetools/crypto';
import { createHmacKey } from './hmac.js';

// Helper to create a valid JWT for testing
async function createTestJWT(
  payload: JWTPayload,
  secret: string,
  algorithm = 'HS256'
): Promise<string> {
  const header = { alg: algorithm, typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));

  const signatureInput = `${headerB64}.${payloadB64}`;
  const key = await createHmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signatureInput)
  );
  const signatureB64 = base64UrlEncodeBytes(new Uint8Array(signature));

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

describe('jwt.ts', () => {
  const secret = 'test-jwt-secret-key-that-is-at-least-32-bytes!';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('decodeJWT', () => {
    it('should decode a valid JWT payload', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'access',
        username: 'testuser',
      };
      const token = await createTestJWT(payload, secret);

      const decoded = decodeJWT(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe('123456789');
      expect(decoded?.type).toBe('access');
      expect(decoded?.username).toBe('testuser');
    });

    it('should return null for invalid token format', () => {
      const decoded = decodeJWT('not.a.valid.token.format');
      expect(decoded).toBeNull();
    });

    it('should return null for malformed base64', () => {
      const decoded = decodeJWT('not-base64.also-not.valid');
      expect(decoded).toBeNull();
    });

    it('should return null for invalid JSON payload', () => {
      const headerB64 = base64UrlEncode('{"alg":"HS256","typ":"JWT"}');
      const payloadB64 = base64UrlEncodeBytes(
        new TextEncoder().encode('not-json')
      );
      const decoded = decodeJWT(`${headerB64}.${payloadB64}.signature`);
      expect(decoded).toBeNull();
    });
  });

  describe('verifyJWT', () => {
    it('should verify a valid token', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'access',
      };
      const token = await createTestJWT(payload, secret);

      const verified = await verifyJWT(token, secret);

      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe('123456789');
    });

    it('should return null for expired token', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        type: 'access',
      };
      const token = await createTestJWT(payload, secret);

      const verified = await verifyJWT(token, secret);

      expect(verified).toBeNull();
    });

    it('should return null for wrong secret', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'access',
      };
      const token = await createTestJWT(payload, secret);

      const verified = await verifyJWT(token, 'wrong-secret-that-is-at-least-32-bytes!!');

      expect(verified).toBeNull();
    });

    it('should return null for tampered payload', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'access',
      };
      const token = await createTestJWT(payload, secret);

      // Tamper with the payload
      const parts = token.split('.');
      const tamperedPayload = { ...payload, sub: 'tampered-id' };
      parts[1] = base64UrlEncode(JSON.stringify(tamperedPayload));
      const tamperedToken = parts.join('.');

      const verified = await verifyJWT(tamperedToken, secret);

      expect(verified).toBeNull();
    });

    it('should reject non-HS256 algorithm (security)', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'access',
      };
      // Create token with different algorithm in header
      const token = await createTestJWT(payload, secret, 'none');

      const verified = await verifyJWT(token, secret);

      expect(verified).toBeNull();
    });

    it('should return null for malformed token', async () => {
      const verified = await verifyJWT('not-a-jwt', secret);
      expect(verified).toBeNull();
    });

    it('should reject token without exp claim (FINDING-003)', async () => {
      // FINDING-003: Tokens without exp claim must be rejected
      const header = { alg: 'HS256', typ: 'JWT' };
      const payload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        type: 'access',
      };
      const headerB64 = base64UrlEncode(JSON.stringify(header));
      const payloadB64 = base64UrlEncode(JSON.stringify(payload));
      const signatureInput = `${headerB64}.${payloadB64}`;
      const key = await createHmacKey(secret, 'sign');
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(signatureInput)
      );
      const signatureB64 = base64UrlEncodeBytes(new Uint8Array(signature));
      const token = `${headerB64}.${payloadB64}.${signatureB64}`;

      const verified = await verifyJWT(token, secret);

      // FINDING-003: No exp means token is rejected
      expect(verified).toBeNull();
    });
  });

  describe('verifyJWTSignatureOnly', () => {
    it('should verify signature even for expired token', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600, // Expired
        type: 'refresh',
      };
      const token = await createTestJWT(payload, secret);

      const verified = await verifyJWTSignatureOnly(token, secret);

      expect(verified).not.toBeNull();
      expect(verified?.sub).toBe('123456789');
    });

    it('should return null for invalid signature', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'refresh',
      };
      const token = await createTestJWT(payload, secret);

      const verified = await verifyJWTSignatureOnly(token, 'wrong-secret-that-is-at-least-32-bytes!!');

      expect(verified).toBeNull();
    });

    it('should reject non-HS256 algorithm (security)', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'refresh',
      };
      const token = await createTestJWT(payload, secret, 'HS384');

      const verified = await verifyJWTSignatureOnly(token, secret);

      expect(verified).toBeNull();
    });

    it('should respect maxAgeMs parameter', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600,
        type: 'refresh',
      };
      const token = await createTestJWT(payload, secret);

      // Should fail with 1 hour max age
      const verified = await verifyJWTSignatureOnly(token, secret, 3600 * 1000);

      expect(verified).toBeNull();
    });

    it('should accept token within maxAgeMs', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
        exp: Math.floor(Date.now() / 1000) - 900, // Expired 15 minutes ago
        type: 'refresh',
      };
      const token = await createTestJWT(payload, secret);

      // Should pass with 1 hour max age
      const verified = await verifyJWTSignatureOnly(token, secret, 3600 * 1000);

      expect(verified).not.toBeNull();
    });
  });

  describe('isJWTExpired', () => {
    it('should return false for valid non-expired token', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'access',
      };
      const token = await createTestJWT(payload, secret);

      expect(isJWTExpired(token)).toBe(false);
    });

    it('should return true for expired token', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
        type: 'access',
      };
      const token = await createTestJWT(payload, secret);

      expect(isJWTExpired(token)).toBe(true);
    });

    it('should return true for malformed token', () => {
      expect(isJWTExpired('not-a-jwt')).toBe(true);
    });
  });

  describe('getJWTTimeToExpiry', () => {
    it('should return correct time to expiry', async () => {
      const expiresIn = 3600; // 1 hour
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + expiresIn,
        type: 'access',
      };
      const token = await createTestJWT(payload, secret);

      const ttl = getJWTTimeToExpiry(token);

      expect(ttl).toBe(expiresIn);
    });

    it('should return 0 for expired token', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
        type: 'access',
      };
      const token = await createTestJWT(payload, secret);

      expect(getJWTTimeToExpiry(token)).toBe(0);
    });

    it('should return 0 for malformed token', () => {
      expect(getJWTTimeToExpiry('not-a-jwt')).toBe(0);
    });
  });
});
