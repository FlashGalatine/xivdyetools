/**
 * Tests for Discord Request Verification
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyDiscordRequest,
  unauthorizedResponse,
  badRequestResponse,
} from './discord.js';

// Mock discord-interactions
vi.mock('discord-interactions', () => ({
  verifyKey: vi.fn(),
}));

import { verifyKey } from 'discord-interactions';

describe('discord.ts', () => {
  const mockPublicKey = 'test-public-key-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyDiscordRequest', () => {
    it('should return valid result for valid signature', async () => {
      vi.mocked(verifyKey).mockResolvedValue(true);

      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'valid-signature',
          'X-Signature-Timestamp': '1234567890',
          'Content-Length': '50',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(true);
      expect(result.body).toBe(JSON.stringify({ type: 1 }));
      expect(result.error).toBeUndefined();
    });

    it('should return invalid result for invalid signature', async () => {
      vi.mocked(verifyKey).mockResolvedValue(false);

      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'invalid-signature',
          'X-Signature-Timestamp': '1234567890',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid signature');
    });

    it('should reject request with missing signature header', async () => {
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Timestamp': '1234567890',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing signature headers');
    });

    it('should reject request with missing timestamp header', async () => {
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'some-signature',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing signature headers');
    });

    it('should reject request with Content-Length exceeding limit', async () => {
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'some-signature',
          'X-Signature-Timestamp': '1234567890',
          'Content-Length': '200000', // 200KB, exceeds 100KB limit
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Request body too large');
    });

    it('should reject request with actual body exceeding limit', async () => {
      // Create a large body
      const largeBody = 'x'.repeat(150_000); // 150KB

      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'some-signature',
          'X-Signature-Timestamp': '1234567890',
          // No Content-Length header to bypass first check
        },
        body: largeBody,
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Request body too large');
    });

    it('should respect custom maxBodySize option', async () => {
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'some-signature',
          'X-Signature-Timestamp': '1234567890',
          'Content-Length': '500', // 500 bytes
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey, {
        maxBodySize: 100, // Only allow 100 bytes
      });

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Request body too large');
    });

    it('should handle verifyKey throwing an error', async () => {
      vi.mocked(verifyKey).mockRejectedValue(new Error('Verification error'));

      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'some-signature',
          'X-Signature-Timestamp': '1234567890',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Verification error');
    });

    it('should handle non-Error exceptions from verifyKey', async () => {
      vi.mocked(verifyKey).mockRejectedValue('string error');

      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'some-signature',
          'X-Signature-Timestamp': '1234567890',
        },
        body: JSON.stringify({ type: 1 }),
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Verification failed');
    });

    it('should include body in result even on invalid signature', async () => {
      vi.mocked(verifyKey).mockResolvedValue(false);

      const bodyContent = JSON.stringify({ type: 2, data: { name: 'test' } });
      const request = new Request('https://example.com/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature-Ed25519': 'invalid-signature',
          'X-Signature-Timestamp': '1234567890',
        },
        body: bodyContent,
      });

      const result = await verifyDiscordRequest(request, mockPublicKey);

      expect(result.isValid).toBe(false);
      expect(result.body).toBe(bodyContent);
    });
  });

  describe('unauthorizedResponse', () => {
    it('should return 401 response with default message', () => {
      const response = unauthorizedResponse();

      expect(response.status).toBe(401);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return 401 response with custom message', async () => {
      const response = unauthorizedResponse('Custom error message');
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.error).toBe('Custom error message');
    });
  });

  describe('badRequestResponse', () => {
    it('should return 400 response with message', async () => {
      const response = badRequestResponse('Bad request error');
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(body.error).toBe('Bad request error');
    });
  });
});
