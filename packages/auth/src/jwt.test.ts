/**
 * Tests for JWT Verification Utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { decodeJWT, verifyJWT, verifyJWTSignatureOnly, type JWTPayload } from './jwt.js';
import { base64UrlEncode, base64UrlEncodeBytes } from './encoding/index.js';
import { createHmacKey } from './hmac.js';

// Helper to create a valid JWT for testing
async function createTestJWT(
  payload: JWTPayload,
  secret: string,
  algorithm = 'HS256',
): Promise<string> {
  const header = { alg: algorithm, typ: 'JWT' };
  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));

  const signatureInput = `${headerB64}.${payloadB64}`;
  const key = await createHmacKey(secret, 'sign');
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signatureInput));
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
      const payloadB64 = base64UrlEncodeBytes(new TextEncoder().encode('not-json'));
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
        new TextEncoder().encode(signatureInput),
      );
      const signatureB64 = base64UrlEncodeBytes(new Uint8Array(signature));
      const token = `${headerB64}.${payloadB64}.${signatureB64}`;

      const verified = await verifyJWT(token, secret);

      // FINDING-003: No exp means token is rejected
      expect(verified).toBeNull();
    });

    it('should reject token without sub claim (BUG-010)', async () => {
      // BUG-010: Tokens without sub claim must be rejected
      const header = { alg: 'HS256', typ: 'JWT' };
      const payload = {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'access',
      };
      const headerB64 = base64UrlEncode(JSON.stringify(header));
      const payloadB64 = base64UrlEncode(JSON.stringify(payload));
      const signatureInput = `${headerB64}.${payloadB64}`;
      const key = await createHmacKey(secret, 'sign');
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(signatureInput),
      );
      const signatureB64 = base64UrlEncodeBytes(new Uint8Array(signature));
      const token = `${headerB64}.${payloadB64}.${signatureB64}`;

      const verified = await verifyJWT(token, secret);

      // BUG-010: No sub means token is rejected
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

      const verified = await verifyJWTSignatureOnly(
        token,
        'wrong-secret-that-is-at-least-32-bytes!!',
      );

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

    it('should reject token without sub claim (BUG-010)', async () => {
      // BUG-010: Tokens without sub claim must be rejected even in signature-only mode
      const header = { alg: 'HS256', typ: 'JWT' };
      const payload = {
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'refresh',
      };
      const headerB64 = base64UrlEncode(JSON.stringify(header));
      const payloadB64 = base64UrlEncode(JSON.stringify(payload));
      const signatureInput = `${headerB64}.${payloadB64}`;
      const key = await createHmacKey(secret, 'sign');
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(signatureInput),
      );
      const signatureB64 = base64UrlEncodeBytes(new Uint8Array(signature));
      const token = `${headerB64}.${payloadB64}.${signatureB64}`;

      const verified = await verifyJWTSignatureOnly(token, secret);

      // BUG-010: No sub means token is rejected
      expect(verified).toBeNull();
    });
  });

  describe('type discriminator and iat edge cases', () => {
    it('verifyJWT rejects a token whose type does not match expectedType (BUG-057)', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'refresh',
      };
      const token = await createTestJWT(payload, secret);

      expect(await verifyJWT(token, secret, { expectedType: 'access' })).toBeNull();
      expect(await verifyJWT(token, secret, { expectedType: 'refresh' })).not.toBeNull();
    });

    it('verifyJWTSignatureOnly fails closed on missing iat when maxAgeMs is set (BUG-058)', async () => {
      const payload = {
        sub: '123456789',
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'refresh',
      } as JWTPayload;
      const token = await createTestJWT(payload, secret);

      expect(await verifyJWTSignatureOnly(token, secret, 60_000)).toBeNull();
    });

    it('verifyJWTSignatureOnly accepts iat: 0 (epoch) as a valid numeric iat', async () => {
      const payload: JWTPayload = {
        sub: '123456789',
        iat: 0,
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: 'refresh',
      };
      const token = await createTestJWT(payload, secret);

      // Numeric iat passes the type check; age cap then rejects the ancient token
      expect(await verifyJWTSignatureOnly(token, secret, 60_000)).toBeNull();
      // Without an age cap, iat is not consulted at all
      expect(await verifyJWTSignatureOnly(token, secret)).not.toBeNull();
    });
  });

  describe('claim hardening (FINDING-015)', () => {
    const now = () => Math.floor(Date.now() / 1000);

    it('verifyJWT rejects a signed token whose exp is a string', async () => {
      const token = await createTestJWT(
        { sub: '123', iat: now(), exp: String(now() + 3600) } as unknown as JWTPayload,
        secret,
      );
      expect(await verifyJWT(token, secret)).toBeNull();
    });

    it('verifyJWT rejects a signed token whose exp is an object', async () => {
      const token = await createTestJWT(
        { sub: '123', iat: now(), exp: {} } as unknown as JWTPayload,
        secret,
      );
      expect(await verifyJWT(token, secret)).toBeNull();
    });

    it('verifyJWT rejects a signed token whose sub is not a string', async () => {
      const token = await createTestJWT(
        { sub: 123, iat: now(), exp: now() + 3600 } as unknown as JWTPayload,
        secret,
      );
      expect(await verifyJWT(token, secret)).toBeNull();
    });

    it('verifyJWTSignatureOnly rejects a signed token whose exp is a string', async () => {
      const token = await createTestJWT(
        { sub: '123', iat: now(), exp: String(now() + 3600) } as unknown as JWTPayload,
        secret,
      );
      expect(await verifyJWTSignatureOnly(token, secret)).toBeNull();
    });

    it('verifyJWT rejects a token whose nbf is in the future', async () => {
      const token = await createTestJWT(
        { sub: '123', iat: now(), exp: now() + 3600, nbf: now() + 600 } as unknown as JWTPayload,
        secret,
      );
      expect(await verifyJWT(token, secret)).toBeNull();
    });

    it('verifyJWT accepts a token whose nbf is in the past', async () => {
      const token = await createTestJWT(
        { sub: '123', iat: now(), exp: now() + 3600, nbf: now() - 5 } as unknown as JWTPayload,
        secret,
      );
      expect(await verifyJWT(token, secret)).not.toBeNull();
    });

    it('verifyJWT enforces the issuer option when provided', async () => {
      const token = await createTestJWT(
        { sub: '123', iat: now(), exp: now() + 3600, iss: 'https://auth.example' },
        secret,
      );
      expect(await verifyJWT(token, secret, { issuer: 'https://auth.example' })).not.toBeNull();
      expect(await verifyJWT(token, secret, { issuer: 'https://evil.example' })).toBeNull();
      expect(
        await verifyJWT(token, secret, { issuer: ['https://other.example', 'https://auth.example'] }),
      ).not.toBeNull();
    });

    it('verifyJWT rejects a token with no iss when an issuer is required', async () => {
      const token = await createTestJWT({ sub: '123', iat: now(), exp: now() + 3600 }, secret);
      expect(await verifyJWT(token, secret, { issuer: 'https://auth.example' })).toBeNull();
    });

    it('verifyJWT enforces the audience option when provided', async () => {
      const token = await createTestJWT(
        { sub: '123', iat: now(), exp: now() + 3600, aud: 'presets-api' } as unknown as JWTPayload,
        secret,
      );
      expect(await verifyJWT(token, secret, { audience: 'presets-api' })).not.toBeNull();
      expect(await verifyJWT(token, secret, { audience: 'other' })).toBeNull();
    });
  });
});
