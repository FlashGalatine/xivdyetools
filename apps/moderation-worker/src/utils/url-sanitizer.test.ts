import { describe, it, expect } from 'vitest';
import {
  sanitizeUrl,
  sanitizeErrorMessage,
} from './url-sanitizer.js';

describe('url-sanitizer', () => {
  describe('sanitizeUrl', () => {
    describe('Discord webhook URLs', () => {
      it('should redact webhook token in simple webhook URL', () => {
        const url = '/webhooks/123456789/ABCDefgh1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU';
        const result = sanitizeUrl(url);

        expect(result).toBe('/webhooks/123456789/[REDACTED_TOKEN]');
      });

      it('should redact webhook token in full URL', () => {
        const url = 'https://discord.com/api/v10/webhooks/123456789012345678/ABCDefgh1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU';
        const result = sanitizeUrl(url);

        expect(result).toContain('/webhooks/123456789012345678/[REDACTED_TOKEN]');
        expect(result).not.toContain('ABCDefgh');
      });

      it('should redact webhook token with message path', () => {
        const url = '/webhooks/123456789/ABCDefgh1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU/messages/@original';
        const result = sanitizeUrl(url);

        expect(result).toBe('/webhooks/123456789/[REDACTED_TOKEN]/messages/@original');
      });

      it('should redact webhook token with message ID', () => {
        const url = '/webhooks/123/ABCDefgh1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU/messages/987654321';
        const result = sanitizeUrl(url);

        expect(result).toBe('/webhooks/123/[REDACTED_TOKEN]/messages/987654321');
      });

      it('should handle URL object', () => {
        const url = new URL('https://discord.com/api/webhooks/123/ABCDefgh1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU');
        const result = sanitizeUrl(url);

        expect(result).toContain('[REDACTED_TOKEN]');
      });

      it('should not redact short tokens (under 64 chars)', () => {
        const url = '/webhooks/123/shorttoken';
        const result = sanitizeUrl(url);

        expect(result).toBe('/webhooks/123/shorttoken');
      });
    });

    describe('query parameter tokens', () => {
      it('should redact api_key parameter', () => {
        const url = '/api/data?api_key=secretkey123';
        const result = sanitizeUrl(url);

        expect(result).toBe('/api/data?api_key=[REDACTED]');
      });

      it('should redact token parameter', () => {
        const url = '/api/auth?token=mysecrettoken';
        const result = sanitizeUrl(url);

        expect(result).toBe('/api/auth?token=[REDACTED]');
      });

      it('should redact key parameter', () => {
        const url = '/api/data?key=abc123';
        const result = sanitizeUrl(url);

        expect(result).toBe('/api/data?key=[REDACTED]');
      });

      it('should redact secret parameter', () => {
        const url = '/api/data?secret=mysecret';
        const result = sanitizeUrl(url);

        expect(result).toBe('/api/data?secret=[REDACTED]');
      });

      it('should redact password parameter', () => {
        const url = '/api/login?password=hunter2';
        const result = sanitizeUrl(url);

        expect(result).toBe('/api/login?password=[REDACTED]');
      });

      it('should handle multiple sensitive params', () => {
        const url = '/api?api_key=key1&token=token1&other=safe';
        const result = sanitizeUrl(url);

        expect(result).toBe('/api?api_key=[REDACTED]&token=[REDACTED]&other=safe');
      });

      it('should be case-insensitive for param names', () => {
        const url = '/api?API_KEY=key1&TOKEN=token1';
        const result = sanitizeUrl(url);

        expect(result).toBe('/api?API_KEY=[REDACTED]&TOKEN=[REDACTED]');
      });
    });

    describe('Bearer tokens in text', () => {
      it('should redact Bearer token', () => {
        const text = 'Authorization: Bearer ABCdef123456789012345678';
        const result = sanitizeUrl(text);

        expect(result).toBe('Authorization: Bearer [REDACTED]');
      });

      it('should handle lowercase bearer', () => {
        const text = 'bearer abcdef123456789012345678';
        const result = sanitizeUrl(text);

        // The regex replacement normalizes to "Bearer"
        expect(result).toBe('Bearer [REDACTED]');
      });

      it('should not redact short Bearer values', () => {
        const text = 'Bearer short';
        const result = sanitizeUrl(text);

        expect(result).toBe('Bearer short');
      });
    });

    describe('safe URLs', () => {
      it('should not modify normal URLs', () => {
        const url = '/api/users/123';
        const result = sanitizeUrl(url);

        expect(result).toBe('/api/users/123');
      });

      it('should not modify URLs with normal query params', () => {
        const url = '/api/search?query=test&page=1';
        const result = sanitizeUrl(url);

        expect(result).toBe('/api/search?query=test&page=1');
      });

      it('should handle empty string', () => {
        const result = sanitizeUrl('');
        expect(result).toBe('');
      });
    });
  });

  describe('sanitizeErrorMessage', () => {
    it('should sanitize URLs in error messages', () => {
      const error = new Error('Request failed: /webhooks/123/ABCDefgh1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU');
      const result = sanitizeErrorMessage(error);

      expect(result).toContain('/webhooks/123/[REDACTED_TOKEN]');
    });

    it('should handle string errors', () => {
      const error = 'Failed to fetch /api?token=secret123';
      const result = sanitizeErrorMessage(error);

      expect(result).toContain('token=[REDACTED]');
    });

    it('should sanitize stack traces', () => {
      const error = new Error('API error');
      error.stack = 'Error: API error\n    at fetch(/webhooks/123/ABCDefgh1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU)';
      const result = sanitizeErrorMessage(error);

      expect(result).toContain('[REDACTED_TOKEN]');
    });

    it('should handle non-string, non-error values', () => {
      const error = { code: 500 };
      const result = sanitizeErrorMessage(error);

      expect(result).toBe('[object Object]');
    });

    it('should handle null and undefined', () => {
      expect(sanitizeErrorMessage(null)).toBe('null');
      expect(sanitizeErrorMessage(undefined)).toBe('undefined');
    });

    it('should sanitize Bearer tokens in error messages', () => {
      const error = 'Auth failed with Bearer ABCdef123456789012345678901234567890';
      const result = sanitizeErrorMessage(error);

      expect(result).toContain('Bearer [REDACTED]');
    });
  });

});
