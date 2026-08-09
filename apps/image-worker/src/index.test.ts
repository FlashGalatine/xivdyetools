import { describe, it, expect } from 'vitest';
import app from './index.js';
import type { Env } from './types.js';

const env: Env = { ENVIRONMENT: 'test' };

describe('image-worker', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('http://localhost/health', {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('returns 404 for unknown paths', async () => {
    const res = await app.request('http://localhost/nope', {}, env);

    expect(res.status).toBe(404);
  });
});
