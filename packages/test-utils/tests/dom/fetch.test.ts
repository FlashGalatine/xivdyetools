/**
 * Tests for fetch mock utilities
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  setupFetchMock,
  setupFetchMockHandler,
  createMockResponse,
} from '../../src/dom/fetch.js';

describe('setupFetchMock', () => {
  let mockFetch: ReturnType<typeof setupFetchMock>;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    if (mockFetch) {
      mockFetch.restore();
    }
    globalThis.fetch = originalFetch;
  });

  it('replaces global fetch', async () => {
    mockFetch = setupFetchMock({ data: 'test' });

    const response = await fetch('https://api.example.com/test');
    const body = await response.json();

    expect(body).toEqual({ data: 'test' });
  });

  it('records fetch calls', async () => {
    mockFetch = setupFetchMock({ success: true });

    await fetch('https://api.example.com/users');
    await fetch('https://api.example.com/items', { method: 'POST' });

    expect(mockFetch.calls).toHaveLength(2);
    expect(mockFetch.calls[0].url).toBe('https://api.example.com/users');
    expect(mockFetch.calls[1].url).toBe('https://api.example.com/items');
    expect(mockFetch.calls[1].init?.method).toBe('POST');
  });

  it('returns configured status', async () => {
    mockFetch = setupFetchMock({ error: 'Not found' }, { status: 404 });

    const response = await fetch('https://api.example.com/missing');

    expect(response.status).toBe(404);
  });

  it('returns configured statusText', async () => {
    mockFetch = setupFetchMock(
      { error: 'Gone' },
      { status: 410, statusText: 'Gone Forever' }
    );

    const response = await fetch('https://api.example.com/old');

    expect(response.statusText).toBe('Gone Forever');
  });

  it('returns configured headers', async () => {
    mockFetch = setupFetchMock(
      { data: 'test' },
      { headers: { 'X-Custom': 'value' } }
    );

    const response = await fetch('https://api.example.com/test');

    expect(response.headers.get('X-Custom')).toBe('value');
  });

  it('includes Content-Type header by default', async () => {
    mockFetch = setupFetchMock({ data: 'test' });

    const response = await fetch('https://api.example.com/test');

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });

  it('handles Request object input', async () => {
    mockFetch = setupFetchMock({ success: true });
    const request = new Request('https://api.example.com/users');

    await fetch(request);

    expect(mockFetch.calls[0].url).toBe('https://api.example.com/users');
  });

  it('handles URL object input', async () => {
    mockFetch = setupFetchMock({ success: true });
    const url = new URL('https://api.example.com/items');

    await fetch(url);

    expect(mockFetch.calls[0].url).toBe('https://api.example.com/items');
  });

  describe('restore', () => {
    it('restores original fetch', () => {
      mockFetch = setupFetchMock({ data: 'test' });

      mockFetch.restore();

      expect(globalThis.fetch).toBe(originalFetch);
    });
  });

  describe('clear', () => {
    it('clears recorded calls', async () => {
      mockFetch = setupFetchMock({ data: 'test' });

      await fetch('https://api.example.com/first');
      await fetch('https://api.example.com/second');
      mockFetch.clear();

      expect(mockFetch.calls).toHaveLength(0);
    });
  });

  describe('setResponse', () => {
    it('updates mock response', async () => {
      mockFetch = setupFetchMock({ initial: true });

      const response1 = await fetch('https://api.example.com/test');
      expect(await response1.json()).toEqual({ initial: true });

      mockFetch.setResponse({ updated: true });

      const response2 = await fetch('https://api.example.com/test');
      expect(await response2.json()).toEqual({ updated: true });
    });

    it('updates status when provided', async () => {
      mockFetch = setupFetchMock({ data: 'test' }, { status: 200 });

      mockFetch.setResponse({ error: 'Bad' }, { status: 400 });

      const response = await fetch('https://api.example.com/test');
      expect(response.status).toBe(400);
    });
  });
});

describe('setupFetchMockHandler', () => {
  let mockFetch: ReturnType<typeof setupFetchMockHandler>;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    if (mockFetch) {
      mockFetch.restore();
    }
    globalThis.fetch = originalFetch;
  });

  it('uses custom handler', async () => {
    mockFetch = setupFetchMockHandler((url) => {
      if (url.includes('/users')) {
        return new Response(JSON.stringify({ type: 'users' }));
      }
      return new Response(JSON.stringify({ type: 'other' }));
    });

    const usersResponse = await fetch('https://api.example.com/users');
    const otherResponse = await fetch('https://api.example.com/other');

    expect(await usersResponse.json()).toEqual({ type: 'users' });
    expect(await otherResponse.json()).toEqual({ type: 'other' });
  });

  it('receives init object', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch = setupFetchMockHandler((_url, init) => {
      capturedInit = init;
      return new Response('{}');
    });

    await fetch('https://api.example.com/test', {
      method: 'POST',
      body: 'data',
    });

    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.body).toBe('data');
  });

  it('records calls', async () => {
    mockFetch = setupFetchMockHandler(() => new Response('{}'));

    await fetch('https://api.example.com/a');
    await fetch('https://api.example.com/b');

    expect(mockFetch.calls).toHaveLength(2);
  });

  it('supports async handler', async () => {
    mockFetch = setupFetchMockHandler(async () => {
      await new Promise((r) => setTimeout(r, 1));
      return new Response(JSON.stringify({ async: true }));
    });

    const response = await fetch('https://api.example.com/test');

    expect(await response.json()).toEqual({ async: true });
  });

  describe('setResponse', () => {
    it('is a no-op for handler-based mock', () => {
      mockFetch = setupFetchMockHandler(() => new Response('original'));

      expect(() => mockFetch.setResponse({ new: 'response' })).not.toThrow();
    });
  });
});

describe('createMockResponse', () => {
  it('creates a Response with JSON body', async () => {
    const response = createMockResponse({ data: 'test' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: 'test' });
  });

  it('respects custom status', () => {
    const response = createMockResponse({ error: 'Bad' }, { status: 400 });

    expect(response.status).toBe(400);
  });

  it('respects custom statusText', () => {
    const response = createMockResponse(
      { error: 'Gone' },
      { status: 410, statusText: 'Resource Gone' }
    );

    expect(response.statusText).toBe('Resource Gone');
  });

  it('includes custom headers', () => {
    const response = createMockResponse(
      { data: 'test' },
      { headers: { 'X-Custom': 'value' } }
    );

    expect(response.headers.get('X-Custom')).toBe('value');
  });

  it('includes Content-Type header', () => {
    const response = createMockResponse({ data: 'test' });

    expect(response.headers.get('Content-Type')).toBe('application/json');
  });
});
