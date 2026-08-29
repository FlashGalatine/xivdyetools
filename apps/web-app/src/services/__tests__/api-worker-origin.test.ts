import { describe, it, expect, vi, afterEach } from 'vitest';

describe('getApiWorkerBase', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('prefers VITE_API_WORKER_URL and strips a trailing slash', async () => {
    vi.stubEnv('VITE_API_WORKER_URL', 'https://tunnel.example/');
    const { getApiWorkerBase } = await import('../api-worker-origin');
    expect(getApiWorkerBase()).toBe('https://tunnel.example');
  });

  it('falls back to the wrangler dev port outside production builds', async () => {
    vi.stubEnv('VITE_API_WORKER_URL', '');
    const { getApiWorkerBase } = await import('../api-worker-origin');
    expect(getApiWorkerBase()).toBe('http://localhost:8790');
  });

  it('is re-exported from chara-resolve-service for existing callers', async () => {
    const origin = await import('../api-worker-origin');
    const chara = await import('../chara-resolve-service');
    expect(chara.getApiWorkerBase).toBe(origin.getApiWorkerBase);
  });
});
