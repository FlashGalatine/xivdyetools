import { describe, it, expect } from 'vitest';
import {
  sanitizeUrl,
  sanitizeHeaders,
  sanitizeErrorMessage,
  sanitizeFetchRequest,
  sanitizeFetchResponse,
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

  describe('sanitizeHeaders', () => {
    describe('sensitive headers', () => {
      it('should redact Authorization header', () => {
        const headers = {
          Authorization: 'Bot MTIzNDU2Nzg5MDEyMzQ1Njc4.abcdef.xyz123',
        };
        const result = sanitizeHeaders(headers);

        expect(result.Authorization).toBe('Bot MTIz...[REDACTED]');
      });

      it('should redact x-api-key header', () => {
        const headers = {
          'x-api-key': 'sk-1234567890abcdef',
        };
        const result = sanitizeHeaders(headers);

        expect(result['x-api-key']).toBe('sk-12345...[REDACTED]');
      });

      it('should redact x-auth-token header', () => {
        const headers = {
          'x-auth-token': 'token123456789',
        };
        const result = sanitizeHeaders(headers);

        expect(result['x-auth-token']).toBe('token123...[REDACTED]');
      });

      it('should redact x-request-signature header', () => {
        const headers = {
          'x-request-signature': 'sig1234567890',
        };
        const result = sanitizeHeaders(headers);

        expect(result['x-request-signature']).toBe('sig12345...[REDACTED]');
      });

      it('should redact cookie header', () => {
        const headers = {
          cookie: 'session=abc123xyz789',
        };
        const result = sanitizeHeaders(headers);

        expect(result.cookie).toBe('session=...[REDACTED]');
      });

      it('should redact set-cookie header', () => {
        const headers = {
          'set-cookie': 'session=abc123xyz789; Path=/',
        };
        const result = sanitizeHeaders(headers);

        expect(result['set-cookie']).toBe('session=...[REDACTED]');
      });

      it('should handle short sensitive values', () => {
        const headers = {
          Authorization: 'short',
        };
        const result = sanitizeHeaders(headers);

        expect(result.Authorization).toBe('[REDACTED]');
      });

      it('should be case-insensitive for header names', () => {
        const headers = {
          AUTHORIZATION: 'Bot secrettoken123',
          'X-API-KEY': 'apikey123456',
        };
        const result = sanitizeHeaders(headers);

        expect(result.AUTHORIZATION).toBe('Bot secr...[REDACTED]');
        expect(result['X-API-KEY']).toBe('apikey12...[REDACTED]');
      });
    });

    describe('non-sensitive headers', () => {
      it('should not modify Content-Type', () => {
        const headers = {
          'Content-Type': 'application/json',
        };
        const result = sanitizeHeaders(headers);

        expect(result['Content-Type']).toBe('application/json');
      });

      it('should not modify Accept header', () => {
        const headers = {
          Accept: 'application/json',
        };
        const result = sanitizeHeaders(headers);

        expect(result.Accept).toBe('application/json');
      });

      it('should not modify custom safe headers', () => {
        const headers = {
          'X-Request-Id': '12345',
          'User-Agent': 'MyApp/1.0',
        };
        const result = sanitizeHeaders(headers);

        expect(result['X-Request-Id']).toBe('12345');
        expect(result['User-Agent']).toBe('MyApp/1.0');
      });
    });

    describe('Headers instance', () => {
      it('should handle Headers object', () => {
        const headers = new Headers();
        headers.set('Authorization', 'Bearer supersecrettoken123');
        headers.set('Content-Type', 'application/json');

        const result = sanitizeHeaders(headers);

        // Headers.entries() returns lowercase keys
        expect(result.authorization).toContain('[REDACTED]');
        expect(result['content-type']).toBe('application/json');
      });
    });

    describe('mixed headers', () => {
      it('should handle mix of sensitive and non-sensitive', () => {
        const headers = {
          Authorization: 'Bot secrettoken123456',
          'Content-Type': 'application/json',
          'x-api-key': 'apikeyvalue123456',
          Accept: '*/*',
        };
        const result = sanitizeHeaders(headers);

        expect(result.Authorization).toBe('Bot secr...[REDACTED]');
        expect(result['Content-Type']).toBe('application/json');
        expect(result['x-api-key']).toBe('apikeyva...[REDACTED]');
        expect(result.Accept).toBe('*/*');
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

  describe('sanitizeFetchRequest', () => {
    it('should sanitize URL', () => {
      const result = sanitizeFetchRequest(
        '/webhooks/123/ABCDefgh1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU'
      );

      expect(result.url).toBe('/webhooks/123/[REDACTED_TOKEN]');
    });

    it('should sanitize headers', () => {
      const result = sanitizeFetchRequest('/api/data', {
        method: 'POST',
        headers: {
          Authorization: 'Bot secrettoken123456',
          'Content-Type': 'application/json',
        },
      });

      expect(result.headers.Authorization).toBe('Bot secr...[REDACTED]');
      expect(result.headers['Content-Type']).toBe('application/json');
    });

    it('should include method', () => {
      const result = sanitizeFetchRequest('/api', { method: 'POST' });

      expect(result.method).toBe('POST');
    });

    it('should default method to GET', () => {
      const result = sanitizeFetchRequest('/api');

      expect(result.method).toBe('GET');
    });

    it('should handle missing options', () => {
      const result = sanitizeFetchRequest('/api');

      expect(result.url).toBe('/api');
      expect(result.method).toBe('GET');
      expect(result.headers).toEqual({});
    });

    it('should handle URL object', () => {
      const result = sanitizeFetchRequest(new URL('https://api.example.com/data'));

      expect(result.url).toBe('https://api.example.com/data');
    });

    it('should handle missing headers in options', () => {
      const result = sanitizeFetchRequest('/api', { method: 'DELETE' });

      expect(result.headers).toEqual({});
    });
  });

  describe('sanitizeFetchResponse', () => {
    it('should sanitize response URL', () => {
      const mockResponse = {
        status: 200,
        statusText: 'OK',
        url: '/webhooks/123/ABCDefgh1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTU',
        headers: new Headers({ 'Content-Type': 'application/json' }),
      } as Response;

      const result = sanitizeFetchResponse(mockResponse);

      expect(result.url).toBe('/webhooks/123/[REDACTED_TOKEN]');
    });

    it('should include status and statusText', () => {
      const mockResponse = {
        status: 404,
        statusText: 'Not Found',
        url: '/api/users/123',
        headers: new Headers(),
      } as Response;

      const result = sanitizeFetchResponse(mockResponse);

      expect(result.status).toBe(404);
      expect(result.statusText).toBe('Not Found');
    });

    it('should sanitize response headers', () => {
      const mockHeaders = new Headers();
      mockHeaders.set('set-cookie', 'session=abc123xyz789');
      mockHeaders.set('content-type', 'application/json');

      const mockResponse = {
        status: 200,
        statusText: 'OK',
        url: '/api',
        headers: mockHeaders,
      } as Response;

      const result = sanitizeFetchResponse(mockResponse);

      expect(result.headers['set-cookie']).toBe('session=...[REDACTED]');
      expect(result.headers['content-type']).toBe('application/json');
    });

    it('should handle various status codes', () => {
      const statuses = [
        { status: 200, statusText: 'OK' },
        { status: 201, statusText: 'Created' },
        { status: 400, statusText: 'Bad Request' },
        { status: 401, statusText: 'Unauthorized' },
        { status: 500, statusText: 'Internal Server Error' },
      ];

      for (const { status, statusText } of statuses) {
        const mockResponse = {
          status,
          statusText,
          url: '/api',
          headers: new Headers(),
        } as Response;

        const result = sanitizeFetchResponse(mockResponse);

        expect(result.status).toBe(status);
        expect(result.statusText).toBe(statusText);
      }
    });
  });
});
