/**
 * Tests for HMAC Signing Utilities
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createHmacKey,
  hmacSign,
  hmacSignHex,
  hmacVerify,
  hmacVerifyHex,
  verifyBotSignature,
} from './hmac.js';

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
        'HMAC secret must be at least 32 bytes'
      );
    });

    it('should reject empty string secret (FINDING-009)', async () => {
      await expect(createHmacKey('', 'sign')).rejects.toThrow(
        'HMAC secret must be at least 32 bytes'
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
    it('should return true for valid hex signature', async () => {
      const data = 'test-data';
      const signature = await hmacSignHex(data, TEST_SECRET);
      const isValid = await hmacVerifyHex(data, signature, TEST_SECRET);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid hex signature', async () => {
      const isValid = await hmacVerifyHex('test-data', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', TEST_SECRET);
      expect(isValid).toBe(false);
    });

    it('should return false for malformed hex', async () => {
      const isValid = await hmacVerifyHex('test-data', 'not-hex!', TEST_SECRET);
      expect(isValid).toBe(false);
    });
  });

  describe('verifyBotSignature', () => {
    const secret = 'bot-signing-secret-at-least-32-bytes!!';

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return true for valid signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const userId = '123456789';
      const userName = 'testuser';
      const message = `${timestamp}:${userId}:${userName}`;
      const signature = await hmacSignHex(message, secret);

      const isValid = await verifyBotSignature(
        signature,
        timestamp,
        userId,
        userName,
        secret
      );
      expect(isValid).toBe(true);
    });

    it('should return false for missing signature', async () => {
      const isValid = await verifyBotSignature(
        undefined,
        '1234567890',
        '123456789',
        'testuser',
        secret
      );
      expect(isValid).toBe(false);
    });

    it('should return false for missing timestamp', async () => {
      const isValid = await verifyBotSignature(
        'somesignature',
        undefined,
        '123456789',
        'testuser',
        secret
      );
      expect(isValid).toBe(false);
    });

    it('should return false for missing userId', async () => {
      const isValid = await verifyBotSignature(
        'somesignature',
        '1234567890',
        undefined,
        'testuser',
        secret
      );
      expect(isValid).toBe(false);
    });

    it('should return false for missing userName', async () => {
      const isValid = await verifyBotSignature(
        'somesignature',
        '1234567890',
        '123456789',
        undefined,
        secret
      );
      expect(isValid).toBe(false);
    });

    it('should return false for expired signature', async () => {
      // Create signature from 10 minutes ago (default max age is 5 minutes)
      const oldTimestamp = Math.floor(Date.now() / 1000) - 600;
      const userId = '123456789';
      const userName = 'testuser';
      const message = `${oldTimestamp}:${userId}:${userName}`;
      const signature = await hmacSignHex(message, secret);

      const isValid = await verifyBotSignature(
        signature,
        oldTimestamp.toString(),
        userId,
        userName,
        secret
      );
      expect(isValid).toBe(false);
    });

    it('should return false for future timestamp beyond clock skew', async () => {
      // Create signature 2 minutes in the future (default clock skew is 1 minute)
      const futureTimestamp = Math.floor(Date.now() / 1000) + 120;
      const userId = '123456789';
      const userName = 'testuser';
      const message = `${futureTimestamp}:${userId}:${userName}`;
      const signature = await hmacSignHex(message, secret);

      const isValid = await verifyBotSignature(
        signature,
        futureTimestamp.toString(),
        userId,
        userName,
        secret
      );
      expect(isValid).toBe(false);
    });

    it('should accept signature within clock skew tolerance', async () => {
      // Create signature 30 seconds in the future (within default 1 minute clock skew)
      const futureTimestamp = Math.floor(Date.now() / 1000) + 30;
      const userId = '123456789';
      const userName = 'testuser';
      const message = `${futureTimestamp}:${userId}:${userName}`;
      const signature = await hmacSignHex(message, secret);

      const isValid = await verifyBotSignature(
        signature,
        futureTimestamp.toString(),
        userId,
        userName,
        secret
      );
      expect(isValid).toBe(true);
    });

    it('should return false for invalid timestamp format', async () => {
      const isValid = await verifyBotSignature(
        'somesignature',
        'not-a-number',
        '123456789',
        'testuser',
        secret
      );
      expect(isValid).toBe(false);
    });

    it('should return false for wrong signature', async () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const userId = '123456789';
      const userName = 'testuser';

      const isValid = await verifyBotSignature(
        'wrongsignature',
        timestamp,
        userId,
        userName,
        secret
      );
      expect(isValid).toBe(false);
    });

    it('should respect custom maxAgeMs option', async () => {
      // Create signature from 2 minutes ago
      const oldTimestamp = Math.floor(Date.now() / 1000) - 120;
      const userId = '123456789';
      const userName = 'testuser';
      const message = `${oldTimestamp}:${userId}:${userName}`;
      const signature = await hmacSignHex(message, secret);

      // Should fail with default 5 minute max age... wait, 2 minutes is within 5 minutes
      // Let's use 1 minute max age instead
      const isValid = await verifyBotSignature(
        signature,
        oldTimestamp.toString(),
        userId,
        userName,
        secret,
        { maxAgeMs: 60 * 1000 } // 1 minute
      );
      expect(isValid).toBe(false);
    });

    it('should respect custom clockSkewMs option', async () => {
      // Create signature 30 seconds in the future
      const futureTimestamp = Math.floor(Date.now() / 1000) + 30;
      const userId = '123456789';
      const userName = 'testuser';
      const message = `${futureTimestamp}:${userId}:${userName}`;
      const signature = await hmacSignHex(message, secret);

      // Should fail with 10 second clock skew tolerance
      const isValid = await verifyBotSignature(
        signature,
        futureTimestamp.toString(),
        userId,
        userName,
        secret,
        { clockSkewMs: 10 * 1000 } // 10 seconds
      );
      expect(isValid).toBe(false);
    });
  });
});
