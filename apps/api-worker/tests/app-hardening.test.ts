/**
 * App-level hardening from the 2026-08-21 security audit (FINDING-025):
 * - API-5  unexpected errors never carry a stack trace; generic message outside development
 * - API-10 the docs host (ASSETS) gets the same security headers as the API
 * - API-11 CORS no longer advertises the non-existent X-API-Key header
 * - API-13 4xx/5xx envelopes are explicitly non-cacheable
 *
 * Plus FINDING-010 (2026-08-29 security audit): the logger middleware no
 * longer logs the User-Agent header.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import app from '../src/index.js';
import { createMockEnv } from './test-utils.js';
import { dyeService } from '../src/lib/services.js';

describe('unexpected errors (API-5)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('never returns a stack trace, even in development', async () => {
    vi.spyOn(dyeService, 'searchByName').mockImplementation(() => {
      const err = new Error('boom');
      err.stack = 'Error: boom\n    at searchByName (/bundle/internal-module.js:1:1)';
      throw err;
    });
    const res = await app.request('/v1/dyes/search?q=red', { method: 'GET' }, createMockEnv());
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('INTERNAL_ERROR');
    // development keeps the message (operator convenience) — the stack is gone everywhere
    expect(body.message).toBe('boom');
    expect(body.stack).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain('internal-module.js');
  });

  it('returns a generic message outside development', async () => {
    vi.spyOn(dyeService, 'searchByName').mockImplementation(() => {
      throw new Error('secret detail');
    });
    const res = await app.request(
      '/v1/dyes/search?q=red',
      { method: 'GET' },
      createMockEnv({ ENVIRONMENT: 'production' }),
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as any;
    expect(body.message).toBe('An unexpected error occurred');
    expect(JSON.stringify(body)).not.toContain('secret detail');
    expect(body.meta.requestId).toBeDefined();
  });
});

describe('error responses are not cacheable (API-13)', () => {
  it.each([
    ['/v1/nonexistent', 404],
    ['/unknown/path', 404],
    ['/v1/dyes/999999999', 404],
    ['/v1/match/closest', 400],
    ['/v1/match/closest?hex=zzz', 400],
  ])('%s → %i with Cache-Control: no-store', async (path, status) => {
    const res = await app.request(path, { method: 'GET' }, createMockEnv());
    expect(res.status).toBe(status);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('leaves success responses cacheable', async () => {
    const res = await app.request('/v1/dyes/categories', { method: 'GET' }, createMockEnv());
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600');
  });
});

describe('docs host (API-10)', () => {
  it('adds the security headers to responses served from ASSETS', async () => {
    const fetchSpy = vi.fn(
      async () => new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    );
    const env = createMockEnv({
      ENVIRONMENT: 'production',
      ASSETS: { fetch: fetchSpy } as unknown as Fetcher,
    });
    const res = await app.request('https://developers.xivdyetools.app/guide/', { method: 'GET' }, env);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<html></html>');
    expect(res.headers.get('Content-Type')).toBe('text/html');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });

  it('still serves the API (not assets) on every other host', async () => {
    const fetchSpy = vi.fn();
    const env = createMockEnv({ ASSETS: { fetch: fetchSpy } as unknown as Fetcher });
    const res = await app.request('https://data.xivdyetools.app/health', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('CORS (API-11)', () => {
  it('no longer advertises the non-existent X-API-Key request header', async () => {
    const res = await app.request(
      '/v1/dyes',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'X-API-Key',
        },
      },
      createMockEnv(),
    );
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Headers') ?? '').not.toMatch(/x-api-key/i);
  });
});

/**
 * FINDING-010 (2026-08-29 security audit): loggerMiddleware was opted into
 * `logUserAgent: true`, so every request's User-Agent rode into the "Request
 * started" log context — contradicting the web app's privacy page, which
 * promises the telemetry server "discards everything about the request
 * except the validated events" (apps/web-app/PRIVACY.md) and, more broadly,
 * that no User-Agent is ever collected.
 *
 * The worker-kit request logger is always the JSON adapter
 * (packages/logger/src/adapters/json-adapter.ts:
 * `console.log(safeStringify(entry))` regardless of level — never
 * console.info/warn/etc.), so this spies on console.log and parses the
 * structured entry, rather than asserting on a header the app never sends
 * back to the client (mirrors apps/oauth/src/__tests__/index.test.ts and
 * apps/presets-api/tests/index.test.ts).
 */
describe('Logger Middleware (FINDING-010)', () => {
  it('does not log the User-Agent header on "Request started"', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await app.request(
        '/health',
        { headers: { 'User-Agent': 'test-agent/1.0 (should-not-be-logged)' } },
        createMockEnv(),
      );

      const entries = logSpy.mock.calls
        .map(([line]) => {
          try {
            return JSON.parse(String(line)) as {
              message?: string;
              context?: Record<string, unknown>;
            };
          } catch {
            return null;
          }
        })
        .filter(
          (entry): entry is { message?: string; context?: Record<string, unknown> } => entry !== null,
        );
      const startEntry = entries.find((entry) => entry.message === 'Request started');

      expect(startEntry).toBeDefined();
      expect(startEntry!.context).not.toHaveProperty('userAgent');
    } finally {
      logSpy.mockRestore();
    }
  });
});
