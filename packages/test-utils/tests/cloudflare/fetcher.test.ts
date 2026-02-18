/**
 * Tests for Mock Fetcher
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createMockFetcher } from '../../src/cloudflare/fetcher.js';

describe('createMockFetcher', () => {
  it('creates a mock fetcher', () => {
    const fetcher = createMockFetcher();

    expect(fetcher.fetch).toBeDefined();
    expect(fetcher._calls).toBeDefined();
    expect(fetcher._setupResponse).toBeDefined();
    expect(fetcher._setupHandler).toBeDefined();
    expect(fetcher._reset).toBeDefined();
    expect(fetcher._setDefaultResponse).toBeDefined();
  });

  describe('fetch', () => {
    it('returns default success response', async () => {
      const fetcher = createMockFetcher();

      const response = await fetcher.fetch('https://api.example.com/test');

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ success: true });
    });

    it('records fetch calls', async () => {
      const fetcher = createMockFetcher();

      await fetcher.fetch('https://api.example.com/users', {
        method: 'POST',
        body: JSON.stringify({ name: 'Alice' }),
      });

      expect(fetcher._calls).toHaveLength(1);
      expect(fetcher._calls[0].url).toBe('https://api.example.com/users');
      expect(fetcher._calls[0].method).toBe('POST');
      expect(fetcher._calls[0].body).toBe('{"name":"Alice"}');
    });

    it('records timestamp', async () => {
      const before = Date.now();
      const fetcher = createMockFetcher();

      await fetcher.fetch('https://api.example.com/test');

      const after = Date.now();
      expect(fetcher._calls[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(fetcher._calls[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('handles Request object input', async () => {
      const fetcher = createMockFetcher();
      const request = new Request('https://api.example.com/users', {
        method: 'PUT',
      });

      await fetcher.fetch(request);

      expect(fetcher._calls[0].url).toBe('https://api.example.com/users');
      expect(fetcher._calls[0].method).toBe('PUT');
    });

    it('handles URL object input', async () => {
      const fetcher = createMockFetcher();
      const url = new URL('https://api.example.com/items');

      await fetcher.fetch(url);

      expect(fetcher._calls[0].url).toBe('https://api.example.com/items');
    });

    it('extracts headers from Headers object', async () => {
      const fetcher = createMockFetcher();
      const headers = new Headers();
      headers.set('Authorization', 'Bearer token');
      headers.set('Content-Type', 'application/json');

      await fetcher.fetch('https://api.example.com/test', { headers });

      expect(fetcher._calls[0].headers).toEqual({
        authorization: 'Bearer token',
        'content-type': 'application/json',
      });
    });

    it('extracts headers from array', async () => {
      const fetcher = createMockFetcher();

      await fetcher.fetch('https://api.example.com/test', {
        headers: [
          ['X-Custom', 'value1'],
          ['X-Another', 'value2'],
        ],
      });

      expect(fetcher._calls[0].headers['X-Custom']).toBe('value1');
      expect(fetcher._calls[0].headers['X-Another']).toBe('value2');
    });

    it('extracts headers from object', async () => {
      const fetcher = createMockFetcher();

      await fetcher.fetch('https://api.example.com/test', {
        headers: { 'X-Custom': 'value' },
      });

      expect(fetcher._calls[0].headers['X-Custom']).toBe('value');
    });

    it('defaults to GET method', async () => {
      const fetcher = createMockFetcher();

      await fetcher.fetch('https://api.example.com/test');

      expect(fetcher._calls[0].method).toBe('GET');
    });
  });

  describe('_setupResponse', () => {
    it('returns configured response for matching path', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupResponse('/api/users', { users: [{ id: 1 }] });

      const response = await fetcher.fetch('https://example.com/api/users');

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ users: [{ id: 1 }] });
    });

    it('supports custom status', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupResponse('/api/error', { error: 'Not found' }, { status: 404 });

      const response = await fetcher.fetch('https://example.com/api/error');

      expect(response.status).toBe(404);
    });

    it('supports custom headers', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupResponse(
        '/api/data',
        { data: 'test' },
        { headers: { 'X-Custom': 'value' } }
      );

      const response = await fetcher.fetch('https://example.com/api/data');

      expect(response.headers.get('X-Custom')).toBe('value');
    });

    it('supports regex patterns', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupResponse(/\/api\/users\/\d+/, { id: 1, name: 'User' });

      const response = await fetcher.fetch('https://example.com/api/users/123');

      const body = await response.json();
      expect(body).toEqual({ id: 1, name: 'User' });
    });

    it('prefers string match over regex', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupResponse(/\/api\//, { type: 'regex' });
      fetcher._setupResponse('/api/specific', { type: 'string' });

      const response = await fetcher.fetch('https://example.com/api/specific');

      const body = await response.json();
      expect(body.type).toBe('string');
    });
  });

  describe('_setupHandler', () => {
    it('uses custom handler for all requests', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupHandler((url, init) => {
        return new Response(JSON.stringify({ url, method: init?.method }), {
          status: 201,
        });
      });

      const response = await fetcher.fetch('https://example.com/test', {
        method: 'POST',
      });

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.url).toBe('https://example.com/test');
      expect(body.method).toBe('POST');
    });

    it('overrides _setupResponse', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupResponse('/test', { source: 'setupResponse' });
      fetcher._setupHandler(() => {
        return new Response(JSON.stringify({ source: 'handler' }));
      });

      const response = await fetcher.fetch('https://example.com/test');

      const body = await response.json();
      expect(body.source).toBe('handler');
    });

    it('can return Promise<Response>', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupHandler(async () => {
        await new Promise((r) => setTimeout(r, 1));
        return new Response(JSON.stringify({ async: true }));
      });

      const response = await fetcher.fetch('https://example.com/test');

      const body = await response.json();
      expect(body.async).toBe(true);
    });
  });

  describe('_setDefaultResponse', () => {
    it('changes default response', async () => {
      const fetcher = createMockFetcher();
      fetcher._setDefaultResponse({ default: 'changed' });

      const response = await fetcher.fetch('https://example.com/unknown');

      const body = await response.json();
      expect(body).toEqual({ default: 'changed' });
    });

    it('supports custom status', async () => {
      const fetcher = createMockFetcher();
      fetcher._setDefaultResponse({ error: 'Not found' }, { status: 404 });

      const response = await fetcher.fetch('https://example.com/unknown');

      expect(response.status).toBe(404);
    });
  });

  describe('_reset', () => {
    it('clears recorded calls', async () => {
      const fetcher = createMockFetcher();
      await fetcher.fetch('https://example.com/test1');
      await fetcher.fetch('https://example.com/test2');

      fetcher._reset();

      expect(fetcher._calls).toHaveLength(0);
    });

    it('clears configured responses', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupResponse('/test', { custom: true });

      fetcher._reset();

      const response = await fetcher.fetch('https://example.com/test');
      const body = await response.json();
      expect(body).toEqual({ success: true }); // Back to default
    });

    it('clears custom handler', async () => {
      const fetcher = createMockFetcher();
      fetcher._setupHandler(() => new Response('custom'));

      fetcher._reset();

      const response = await fetcher.fetch('https://example.com/test');
      const body = await response.json();
      expect(body).toEqual({ success: true });
    });

    it('resets default response', async () => {
      const fetcher = createMockFetcher();
      fetcher._setDefaultResponse({ changed: true }, { status: 201 });

      fetcher._reset();

      const response = await fetcher.fetch('https://example.com/test');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({ success: true });
    });
  });

  describe('multiple calls', () => {
    it('tracks all fetch calls', async () => {
      const fetcher = createMockFetcher();

      await fetcher.fetch('https://example.com/first');
      await fetcher.fetch('https://example.com/second', { method: 'POST' });
      await fetcher.fetch('https://example.com/third', { method: 'DELETE' });

      expect(fetcher._calls).toHaveLength(3);
      expect(fetcher._calls[0].url).toContain('first');
      expect(fetcher._calls[1].method).toBe('POST');
      expect(fetcher._calls[2].method).toBe('DELETE');
    });
  });
});
