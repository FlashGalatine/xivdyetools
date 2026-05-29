/**
 * Unit tests for GitHub webhook signature verification.
 *
 * verifyGitHubSignature computes HMAC-SHA256 over the payload using the
 * webhook secret and does a timing-safe comparison against the header value.
 * In Node.js, crypto.subtle.timingSafeEqual is not available, so the XOR
 * fallback path is exercised here — which is the more important path to test.
 */

import { describe, it, expect } from 'vitest';
import { verifyGitHubSignature } from './github-verify.js';

// ============================================================================
// Helpers to generate valid signatures for test fixtures
// ============================================================================

/**
 * Compute the expected sha256= signature for a given secret + payload.
 * Uses Node's built-in crypto module (not the Web Crypto API) to generate
 * a reference HMAC for test assertions.
 */
async function computeSignature(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

// ============================================================================
// verifyGitHubSignature
// ============================================================================

describe('verifyGitHubSignature', () => {
  const SECRET = 'my-webhook-secret';
  const PAYLOAD = '{"action":"push","ref":"refs/heads/main"}';

  describe('valid signatures', () => {
    it('returns true for a correctly computed signature', async () => {
      const signature = await computeSignature(SECRET, PAYLOAD);
      const result = await verifyGitHubSignature(SECRET, PAYLOAD, signature);
      expect(result).toBe(true);
    });

    it('returns true for a different valid secret + payload pair', async () => {
      const secret = 'another-secret-123';
      const payload = JSON.stringify({ commits: [] });
      const signature = await computeSignature(secret, payload);
      const result = await verifyGitHubSignature(secret, payload, signature);
      expect(result).toBe(true);
    });

    it('handles an empty payload', async () => {
      const signature = await computeSignature(SECRET, '');
      const result = await verifyGitHubSignature(SECRET, '', signature);
      expect(result).toBe(true);
    });

    it('handles a payload with special characters', async () => {
      const payload = 'Hello & <World> "test" \'value\'';
      const signature = await computeSignature(SECRET, payload);
      const result = await verifyGitHubSignature(SECRET, payload, signature);
      expect(result).toBe(true);
    });

    it('handles a unicode payload', async () => {
      const payload = JSON.stringify({ message: '修正: 日本語のテスト' });
      const signature = await computeSignature(SECRET, payload);
      const result = await verifyGitHubSignature(SECRET, payload, signature);
      expect(result).toBe(true);
    });
  });

  describe('invalid signatures', () => {
    it('returns false for wrong secret', async () => {
      const signature = await computeSignature('wrong-secret', PAYLOAD);
      const result = await verifyGitHubSignature(SECRET, PAYLOAD, signature);
      expect(result).toBe(false);
    });

    it('returns false for tampered payload', async () => {
      const signature = await computeSignature(SECRET, PAYLOAD);
      const tamperedPayload = PAYLOAD + ' extra';
      const result = await verifyGitHubSignature(SECRET, tamperedPayload, signature);
      expect(result).toBe(false);
    });

    it('returns false for truncated signature hex', async () => {
      const signature = await computeSignature(SECRET, PAYLOAD);
      const truncated = signature.slice(0, -4); // Remove last 2 hex bytes
      const result = await verifyGitHubSignature(SECRET, PAYLOAD, truncated);
      expect(result).toBe(false);
    });

    it('returns false for signature with wrong prefix (no sha256=)', async () => {
      const signature = await computeSignature(SECRET, PAYLOAD);
      const noPrefix = signature.replace('sha256=', '');
      const result = await verifyGitHubSignature(SECRET, PAYLOAD, noPrefix);
      expect(result).toBe(false);
    });

    it('returns false for wrong prefix (sha1= instead of sha256=)', async () => {
      const signature = await computeSignature(SECRET, PAYLOAD);
      const wrongPrefix = signature.replace('sha256=', 'sha1=');
      const result = await verifyGitHubSignature(SECRET, PAYLOAD, wrongPrefix);
      expect(result).toBe(false);
    });

    it('returns false for an entirely garbage signature', async () => {
      const result = await verifyGitHubSignature(SECRET, PAYLOAD, 'sha256=deadbeefdeadbeef');
      expect(result).toBe(false);
    });

    it('returns false for an all-zeros signature', async () => {
      const zeros = 'sha256=' + '0'.repeat(64);
      const result = await verifyGitHubSignature(SECRET, PAYLOAD, zeros);
      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for an empty signature string', async () => {
      const result = await verifyGitHubSignature(SECRET, PAYLOAD, '');
      expect(result).toBe(false);
    });

    it('is consistent: calling twice with same args returns same result', async () => {
      const signature = await computeSignature(SECRET, PAYLOAD);
      const first = await verifyGitHubSignature(SECRET, PAYLOAD, signature);
      const second = await verifyGitHubSignature(SECRET, PAYLOAD, signature);
      expect(first).toBe(second);
      expect(first).toBe(true);
    });
  });
});
