/**
 * Tests for response assertion helpers
 */
import { describe, it, expect } from 'vitest';
import {
  assertJsonResponse,
  assertErrorResponse,
  assertOkResponse,
  assertRedirectResponse,
  assertHeaders,
  assertCorsHeaders,
  assertJsonContentType,
} from '../../src/assertions/response.js';

describe('assertJsonResponse', () => {
  it('returns parsed JSON body when status matches', async () => {
    const body = { data: 'test', count: 42 };
    const response = new Response(JSON.stringify(body), { status: 200 });

    const result = await assertJsonResponse<typeof body>(response, 200);

    expect(result).toEqual(body);
  });

  it('throws when status does not match', async () => {
    const response = new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });

    await expect(assertJsonResponse(response, 200)).rejects.toThrow(
      'Expected status 200, got 404'
    );
  });

  it('includes response body in error message', async () => {
    const errorBody = { error: 'Validation failed' };
    const response = new Response(JSON.stringify(errorBody), { status: 400 });

    await expect(assertJsonResponse(response, 200)).rejects.toThrow(
      JSON.stringify(errorBody)
    );
  });
});

describe('assertErrorResponse', () => {
  it('returns error response body when status matches', async () => {
    const body = { error: 'Validation failed', code: 'VALIDATION_ERROR' };
    const response = new Response(JSON.stringify(body), { status: 400 });

    const result = await assertErrorResponse(response, 400);

    expect(result.error).toBe('Validation failed');
    expect(result.code).toBe('VALIDATION_ERROR');
  });

  it('throws when status does not match', async () => {
    const response = new Response(JSON.stringify({ error: 'Error' }), { status: 500 });

    await expect(assertErrorResponse(response, 400)).rejects.toThrow(
      'Expected status 400, got 500'
    );
  });
});

describe('assertOkResponse', () => {
  it('returns JSON body for 200 response', async () => {
    const body = { success: true };
    const response = new Response(JSON.stringify(body), { status: 200 });

    const result = await assertOkResponse<typeof body>(response);

    expect(result).toEqual(body);
  });

  it('returns JSON body for 201 response', async () => {
    const body = { id: 'new-id' };
    const response = new Response(JSON.stringify(body), { status: 201 });

    const result = await assertOkResponse<typeof body>(response);

    expect(result).toEqual(body);
  });

  it('throws for 4xx response', async () => {
    const response = new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });

    await expect(assertOkResponse(response)).rejects.toThrow(
      'Expected OK response, got 400'
    );
  });

  it('throws for 5xx response', async () => {
    const response = new Response('Internal server error', { status: 500 });

    await expect(assertOkResponse(response)).rejects.toThrow(
      'Expected OK response, got 500'
    );
  });
});

describe('assertRedirectResponse', () => {
  it('returns location for 302 redirect', () => {
    const response = new Response(null, {
      status: 302,
      headers: { Location: 'https://example.com/callback' },
    });

    const location = assertRedirectResponse(response);

    expect(location).toBe('https://example.com/callback');
  });

  it('returns location for 301 redirect', () => {
    const response = new Response(null, {
      status: 301,
      headers: { Location: '/new-path' },
    });

    const location = assertRedirectResponse(response);

    expect(location).toBe('/new-path');
  });

  it('returns location for 303 redirect', () => {
    const response = new Response(null, {
      status: 303,
      headers: { Location: '/see-other' },
    });

    const location = assertRedirectResponse(response);

    expect(location).toBe('/see-other');
  });

  it('returns location for 307 redirect', () => {
    const response = new Response(null, {
      status: 307,
      headers: { Location: '/temporary' },
    });

    const location = assertRedirectResponse(response);

    expect(location).toBe('/temporary');
  });

  it('returns location for 308 redirect', () => {
    const response = new Response(null, {
      status: 308,
      headers: { Location: '/permanent' },
    });

    const location = assertRedirectResponse(response);

    expect(location).toBe('/permanent');
  });

  it('validates expected location when provided', () => {
    const response = new Response(null, {
      status: 302,
      headers: { Location: 'https://example.com/callback' },
    });

    const location = assertRedirectResponse(response, 'https://example.com/callback');

    expect(location).toBe('https://example.com/callback');
  });

  it('throws when location does not match expected', () => {
    const response = new Response(null, {
      status: 302,
      headers: { Location: 'https://example.com/actual' },
    });

    expect(() => assertRedirectResponse(response, 'https://example.com/expected')).toThrow(
      'Expected location "https://example.com/expected", got "https://example.com/actual"'
    );
  });

  it('throws for non-redirect status', () => {
    const response = new Response(null, { status: 200 });

    expect(() => assertRedirectResponse(response)).toThrow(
      'Expected redirect status (3xx), got 200'
    );
  });

  it('throws when Location header is missing', () => {
    const response = new Response(null, { status: 302 });

    expect(() => assertRedirectResponse(response)).toThrow(
      'Expected Location header in redirect response'
    );
  });
});

describe('assertHeaders', () => {
  it('passes when all headers match', () => {
    const response = new Response(null, {
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value',
      },
    });

    expect(() =>
      assertHeaders(response, {
        'Content-Type': 'application/json',
        'X-Custom-Header': 'value',
      })
    ).not.toThrow();
  });

  it('throws when header value does not match', () => {
    const response = new Response(null, {
      headers: { 'Content-Type': 'text/html' },
    });

    expect(() => assertHeaders(response, { 'Content-Type': 'application/json' })).toThrow(
      'Expected header "Content-Type" to be "application/json", got "text/html"'
    );
  });

  it('throws when header is missing', () => {
    const response = new Response(null);

    expect(() => assertHeaders(response, { 'X-Missing-Header': 'value' })).toThrow(
      'Expected header "X-Missing-Header" to be "value", got "null"'
    );
  });
});

describe('assertCorsHeaders', () => {
  it('passes when CORS header is present', () => {
    const response = new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });

    expect(() => assertCorsHeaders(response)).not.toThrow();
  });

  it('passes when CORS origin matches', () => {
    const response = new Response(null, {
      headers: { 'Access-Control-Allow-Origin': 'https://example.com' },
    });

    expect(() => assertCorsHeaders(response, 'https://example.com')).not.toThrow();
  });

  it('passes when CORS is wildcard and origin is specified', () => {
    const response = new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*' },
    });

    expect(() => assertCorsHeaders(response, 'https://any-origin.com')).not.toThrow();
  });

  it('throws when CORS header is missing', () => {
    const response = new Response(null);

    expect(() => assertCorsHeaders(response)).toThrow(
      'Expected Access-Control-Allow-Origin header'
    );
  });

  it('throws when CORS origin does not match', () => {
    const response = new Response(null, {
      headers: { 'Access-Control-Allow-Origin': 'https://other.com' },
    });

    expect(() => assertCorsHeaders(response, 'https://example.com')).toThrow(
      'Expected CORS origin "https://example.com" or "*", got "https://other.com"'
    );
  });
});

describe('assertJsonContentType', () => {
  it('passes for application/json', () => {
    const response = new Response(null, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(() => assertJsonContentType(response)).not.toThrow();
  });

  it('passes for application/json with charset', () => {
    const response = new Response(null, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });

    expect(() => assertJsonContentType(response)).not.toThrow();
  });

  it('throws for non-JSON content type', () => {
    const response = new Response(null, {
      headers: { 'Content-Type': 'text/html' },
    });

    expect(() => assertJsonContentType(response)).toThrow(
      'Expected Content-Type application/json, got "text/html"'
    );
  });

  it('throws when Content-Type is missing', () => {
    const response = new Response(null);

    expect(() => assertJsonContentType(response)).toThrow(
      'Expected Content-Type application/json, got "null"'
    );
  });
});
