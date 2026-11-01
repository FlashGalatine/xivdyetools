/**
 * Tests for HMAC Signing Utilities
 */
import { describe, it, expect } from 'vitest';
import { createHmacKey, hmacSign, hmacSignHex, hmacVerify, hmacVerifyHex } from './hmac.js';
import { hexToBytes } from './encoding/hex.js';

describe('hmac.ts', () => {
  // FINDING-009: All test secrets must be at least 32 bytes
  const TEST_SECRET = 'test-secret-that-is-at-least-32-bytes!';
  const TEST_SECRET_2 = 'another-secret-at-least-32-bytes-long!';

  describe('createHmacKey', () => {
    it('should create a CryptoKey for signing', async () => {
      const key = await createHmacKey(TEST_SECRET, 'sign');
      expect(key).toBeDefined();
      expect(key.algorithm.name).toBe('HMAC');
    });

    it('should create a CryptoKey for verification', async () => {
      const key = await createHmacKey(TEST_SECRET, 'verify');
      expect(key).toBeDefined();
      expect(key.algorithm.name).toBe('HMAC');
    });

    it('should create a CryptoKey for both operations', async () => {
      const key = await createHmacKey(TEST_SECRET, 'both');
      expect(key).toBeDefined();
    });

    it('should default to both operations', async () => {
      const key = await createHmacKey(TEST_SECRET);
      expect(key).toBeDefined();
    });

    it('should reject secrets shorter than 32 bytes (FINDING-009)', async () => {
      await expect(createHmacKey('short-secret', 'sign')).rejects.toThrow(
        'HMAC secret must be at least 32 bytes',
      );
    });

    it('should reject empty string secret (FINDING-009)', async () => {
      await expect(createHmacKey('', 'sign')).rejects.toThrow(
        'HMAC secret must be at least 32 bytes',
      );
    });
  });

  describe('hmacSign', () => {
    it('should return a base64url-encoded signature', async () => {
      const signature = await hmacSign('test-data', TEST_SECRET);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      // Base64URL should not contain + or /
      expect(signature).not.toMatch(/[+/]/);
    });

    it('should produce consistent signatures for same input', async () => {
      const sig1 = await hmacSign('test-data', TEST_SECRET);
      const sig2 = await hmacSign('test-data', TEST_SECRET);
      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different data', async () => {
      const sig1 = await hmacSign('data1', TEST_SECRET);
      const sig2 = await hmacSign('data2', TEST_SECRET);
      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different secrets', async () => {
      const sig1 = await hmacSign('test-data', TEST_SECRET);
      const sig2 = await hmacSign('test-data', TEST_SECRET_2);
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('hmacSignHex', () => {
    it('should return a hex-encoded signature', async () => {
      const signature = await hmacSignHex('test-data', TEST_SECRET);
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      // Should only contain hex characters
      expect(signature).toMatch(/^[0-9a-f]+$/);
    });

    it('should produce consistent signatures', async () => {
      const sig1 = await hmacSignHex('test-data', TEST_SECRET);
      const sig2 = await hmacSignHex('test-data', TEST_SECRET);
      expect(sig1).toBe(sig2);
    });
  });

  describe('hmacVerify', () => {
    // Independently pinned before auth adoption; aliases still verify natively.
    const data = 'DEAD-019 pinned vector: header.payload';
    const secret = 'pinned-vector-secret-for-dead-019-test!';
    const canonical = 'k-PyzXCM42BdFEHkzV3fXFdWNc3J1FU8rOeylbsvO0w';
    it('preserves the pinned canonical signing output', async () => {
      expect(await hmacSign(data, secret)).toBe(canonical);
    });
    it.each([
      canonical + '=',
      canonical.replace('-', '+'),
      ' ' + canonical,
      canonical.slice(0, 4) + '\t\n\r\f' + canonical.slice(4),
      canonical.slice(0, -1) + 'x',
    ])('rejects cryptographically valid Base64URL alias %j', async (signature) => {
      const raw = signature
        .replace(/[\t\n\r\f ]/g, '')
        .replace(/-/g, '+')
        .replace(/_/g, '/');
      const bytes = Uint8Array.from(atob(raw + '='.repeat((4 - (raw.length % 4)) % 4)), (c) =>
        c.charCodeAt(0),
      );
      const key = await createHmacKey(secret, 'verify');
      expect(await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(data))).toBe(
        true,
      );
      expect(await hmacVerify(data, signature, secret)).toBe(false);
      expect(await hmacVerify(data, canonical, secret)).toBe(true);
    });

    it('should return true for valid signature', async () => {
      const data = 'test-data';
      const signature = await hmacSign(data, TEST_SECRET);
      const isValid = await hmacVerify(data, signature, TEST_SECRET);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid signature', async () => {
      const isValid = await hmacVerify('test-data', 'invalid-signature', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should return false for wrong secret', async () => {
      const data = 'test-data';
      const signature = await hmacSign(data, TEST_SECRET);
      const isValid = await hmacVerify(data, signature, TEST_SECRET_2);
      expect(isValid).toBe(false);
    });

    it('should return false for tampered data', async () => {
      const signature = await hmacSign('original-data', TEST_SECRET);
      const isValid = await hmacVerify('tampered-data', signature, TEST_SECRET);
      expect(isValid).toBe(false);
    });
  });

  describe('hmacVerifyHex', () => {
    it.each(['upper', 'mixed'] as const)(
      'rejects a byte-equivalent %s-case signature',
      async (style) => {
        const signature = await hmacSignHex('case-boundary', TEST_SECRET);
        const alias =
          style === 'upper'
            ? signature.toUpperCase()
            : signature.replace(/[a-f]/, (c) => c.toUpperCase());
        expect(alias).not.toBe(signature);
        const key = await createHmacKey(TEST_SECRET, 'verify');
        expect(
          await crypto.subtle.verify(
            'HMAC',
            key,
            hexToBytes(alias),
            new TextEncoder().encode('case-boundary'),
          ),
        ).toBe(true);
        expect(await hmacVerifyHex('case-boundary', signature, TEST_SECRET)).toBe(true);
        expect(await hmacVerifyHex('case-boundary', alias, TEST_SECRET)).toBe(false);
      },
    );

    it.each([
      '',
      'a'.repeat(63),
      'a'.repeat(65),
      'a'.repeat(66),
      'g'.repeat(64),
      ' ' + 'a'.repeat(64),
    ])('rejects malformed hex signature %j without throwing', async (signature) => {
      await expect(hmacVerifyHex('case-boundary', signature, TEST_SECRET)).resolves.toBe(false);
    });

    it('should return true for valid hex signature', async () => {
      const data = 'test-data';
      const signature = await hmacSignHex(data, TEST_SECRET);
      const isValid = await hmacVerifyHex(data, signature, TEST_SECRET);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid hex signature', async () => {
      const isValid = await hmacVerifyHex(
        'test-data',
        'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        TEST_SECRET,
      );
      expect(isValid).toBe(false);
    });

    it('should return false for malformed hex', async () => {
      const isValid = await hmacVerifyHex('test-data', 'not-hex!', TEST_SECRET);
      expect(isValid).toBe(false);
    });
  });
});
