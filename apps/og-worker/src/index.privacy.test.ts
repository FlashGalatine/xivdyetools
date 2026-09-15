/**
 * Route-level regression for crawler log minimization.
 */
import { describe, expect, it, vi } from 'vitest';

const info = vi.hoisted(() => vi.fn());

// This crawler HTML route never renders a PNG; avoid importing Workers-only WASM.
vi.mock('./services/renderer', () => ({ renderOGImage: vi.fn() }));

// The route is real. The worker-kit transport is replaced so this test
// can observe the request-scoped structured event without a Workers log sink.
vi.mock('@xivdyetools/worker-kit', () => ({
  requestIdMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  loggerMiddleware: () => async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
    c.set('logger', { info });
    await next();
  },
  getLogger: (c: { get: (key: string) => unknown }) => c.get('logger') as { info: typeof info },
}));

const { default: app } = await import('./index');

const TEST_ENV = {
  APP_BASE_URL: 'https://xivdyetools.app',
  OG_IMAGE_BASE_URL: 'https://og.xivdyetools.app/og',
};

describe('FINDING-006: crawler metadata log minimization', () => {
  it('emits only coarse normalized fields for a crafted crawler request', async () => {
    const rawUserAgent = 'Discordbot/2.0 private-ua-sentinel';
    const fullUrl = 'https://xivdyetools.app/harmony/?dye=1&harmony=triadic&lang=JA&share=private-query-sentinel';
    info.mockClear();

    const response = await app.request(fullUrl, { headers: { 'User-Agent': rawUserAgent } }, TEST_ENV);

    expect(response.status).toBe(200);
    expect(info).toHaveBeenCalledOnce();
    expect(info).toHaveBeenCalledWith('Serving OG metadata', {
      tool: 'harmony',
      locale: 'ja',
      crawler: 'discord',
    });

    const context = info.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(context).sort()).toEqual(['crawler', 'locale', 'tool']);
    expect(context).not.toHaveProperty('userAgent');
    expect(context).not.toHaveProperty('url');
    expect(context).not.toHaveProperty('title');
    expect(JSON.stringify(context)).not.toContain(rawUserAgent);
    expect(JSON.stringify(context)).not.toContain(fullUrl);
    expect(JSON.stringify(context)).not.toContain('private-query-sentinel');
  });
});
