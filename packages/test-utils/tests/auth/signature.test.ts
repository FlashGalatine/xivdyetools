/**
 * Tests for HMAC signature helpers
 */
import { describe, it, expect } from 'vitest';
import {
  createBotSignature,
  createTimestampedSignature,
  verifyBotSignature,
  TEST_SIGNING_SECRET,
} from '../../src/auth/signature.js';

describe('TEST_SIGNING_SECRET', () => {
  it('is a defined constant', () => {
    expect(TEST_SIGNING_SECRET).toBe('test-signing-secret');
  });
});

describe('createBotSignature', () => {
  it('creates a hex-encoded signature', async () => {
    const signature = await createBotSignature('1234567890', 'user-id', 'username');

    expect(signature).toMatch(/^[a-f0-9]{64}$/); // SHA256 = 32 bytes = 64 hex chars
  });

  it('uses default secret when not provided', async () => {
    const sig1 = await createBotSignature('1234567890', 'user-id', 'username');
    const sig2 = await createBotSignature('1234567890', 'user-id', 'username', TEST_SIGNING_SECRET);

    expect(sig1).toBe(sig2);
  });

  it('produces different signatures with different secrets', async () => {
    const sig1 = await createBotSignature('1234567890', 'user-id', 'username', 'secret1');
    const sig2 = await createBotSignature('1234567890', 'user-id', 'username', 'secret2');

    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different timestamps', async () => {
    const sig1 = await createBotSignature('1111111111', 'user-id', 'username');
    const sig2 = await createBotSignature('2222222222', 'user-id', 'username');

    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different user IDs', async () => {
    const sig1 = await createBotSignature('1234567890', 'user-1', 'username');
    const sig2 = await createBotSignature('1234567890', 'user-2', 'username');

    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different usernames', async () => {
    const sig1 = await createBotSignature('1234567890', 'user-id', 'alice');
    const sig2 = await createBotSignature('1234567890', 'user-id', 'bob');

    expect(sig1).not.toBe(sig2);
  });

  it('is deterministic', async () => {
    const sig1 = await createBotSignature('1234567890', 'user-id', 'username', 'secret');
    const sig2 = await createBotSignature('1234567890', 'user-id', 'username', 'secret');

    expect(sig1).toBe(sig2);
  });
});

describe('createTimestampedSignature', () => {
  it('returns signature and timestamp', async () => {
    const result = await createTimestampedSignature('user-id', 'username');

    expect(result.signature).toMatch(/^[a-f0-9]{64}$/);
    expect(result.timestamp).toMatch(/^\d+$/);
  });

  it('uses current timestamp', async () => {
    const before = Math.floor(Date.now() / 1000);
    const result = await createTimestampedSignature('user-id', 'username');
    const after = Math.floor(Date.now() / 1000);

    const timestamp = parseInt(result.timestamp, 10);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('creates signature that can be verified', async () => {
    const { signature, timestamp } = await createTimestampedSignature('user-id', 'username');

    const isValid = await verifyBotSignature(signature, timestamp, 'user-id', 'username');

    expect(isValid).toBe(true);
  });

  it('uses custom secret when provided', async () => {
    const customSecret = 'my-custom-secret';
    const { signature, timestamp } = await createTimestampedSignature(
      'user-id',
      'username',
      customSecret
    );

    const isValid = await verifyBotSignature(
      signature,
      timestamp,
      'user-id',
      'username',
      customSecret
    );

    expect(isValid).toBe(true);
  });
});

describe('verifyBotSignature', () => {
  it('returns true for valid signature', async () => {
    const signature = await createBotSignature('1234567890', 'user-id', 'username');

    const isValid = await verifyBotSignature(signature, '1234567890', 'user-id', 'username');

    expect(isValid).toBe(true);
  });

  it('returns false for invalid signature', async () => {
    const isValid = await verifyBotSignature(
      'invalid-signature',
      '1234567890',
      'user-id',
      'username'
    );

    expect(isValid).toBe(false);
  });

  it('returns false for wrong timestamp', async () => {
    const signature = await createBotSignature('1234567890', 'user-id', 'username');

    const isValid = await verifyBotSignature(signature, '9999999999', 'user-id', 'username');

    expect(isValid).toBe(false);
  });

  it('returns false for wrong user ID', async () => {
    const signature = await createBotSignature('1234567890', 'user-id', 'username');

    const isValid = await verifyBotSignature(signature, '1234567890', 'wrong-user', 'username');

    expect(isValid).toBe(false);
  });

  it('returns false for wrong username', async () => {
    const signature = await createBotSignature('1234567890', 'user-id', 'username');

    const isValid = await verifyBotSignature(signature, '1234567890', 'user-id', 'wrong-name');

    expect(isValid).toBe(false);
  });

  it('returns false for wrong secret', async () => {
    const signature = await createBotSignature('1234567890', 'user-id', 'username', 'secret1');

    const isValid = await verifyBotSignature(
      signature,
      '1234567890',
      'user-id',
      'username',
      'secret2'
    );

    expect(isValid).toBe(false);
  });
});
