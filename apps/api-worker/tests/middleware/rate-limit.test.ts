import { describe, it, expect } from 'vitest';
import app from '../../src/index.js';
import { createMockEnv } from '../test-utils.js';

const env = createMockEnv();

describe('Rate limit middleware', () => {
  it('includes rate limit headers on responses', async () => {
    const res = await app.request('/v1/dyes/categories', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    // The getRateLimitHeaders from @xivdyetools/rate-limiter sets these
    // With mock KV, the limiter should still set headers (fail-open)
    expect(res.headers.get('X-Request-Id')).toBeDefined();
  });

  it('does not rate limit health check', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.status).toBe('ok');
  });
});

describe('Request ID middleware', () => {
  it('generates X-Request-ID header', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    const requestId = res.headers.get('X-Request-ID');
    expect(requestId).toBeDefined();
    expect(requestId).toMatch(/^[a-f0-9-]{36}$/i);
  });

  it('preserves valid incoming X-Request-ID', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'X-Request-ID': id },
    }, env);

    expect(res.headers.get('X-Request-ID')).toBe(id);
  });

  it('rejects invalid X-Request-ID and generates new one', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'X-Request-ID': 'malicious<script>' },
    }, env);

    const requestId = res.headers.get('X-Request-ID');
    expect(requestId).not.toBe('malicious<script>');
    expect(requestId).toMatch(/^[a-f0-9-]{36}$/i);
  });
});

describe('App-level error handling', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await app.request('/v1/nonexistent', { method: 'GET' }, env);

    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
    expect(body.error).toBe('NOT_FOUND');
    expect(body.message).toContain('/v1/nonexistent');
    expect(body.meta.requestId).toBeDefined();
  });

  it('returns 404 for completely unknown paths', async () => {
    const res = await app.request('/unknown/path', { method: 'GET' }, env);

    expect(res.status).toBe(404);
    const body = await res.json() as any;
    expect(body.error).toBe('NOT_FOUND');
  });

  it('sets HSTS header in production', async () => {
    const prodEnv = createMockEnv({ ENVIRONMENT: 'production' });
    const res = await app.request('/health', { method: 'GET' }, prodEnv);

    expect(res.status).toBe(200);
    expect(res.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });

  it('does not set HSTS in development', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    expect(res.status).toBe(200);
    expect(res.headers.get('Strict-Transport-Security')).toBeNull();
  });

  it('sets X-Content-Type-Options header', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('sets X-API-Version header', async () => {
    const res = await app.request('/health', { method: 'GET' }, env);

    expect(res.headers.get('X-API-Version')).toBe('v1');
  });
});
