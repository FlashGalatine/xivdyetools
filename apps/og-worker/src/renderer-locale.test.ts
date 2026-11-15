/** FONT-001: every card route must pass its resolved locale to the renderer. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./services/renderer', () => ({
  renderOGImage: vi.fn(async () => new Response('png', { headers: { 'Content-Type': 'image/png' } })),
}));
const { default: app } = await import('./index');
const { renderOGImage } = await import('./services/renderer');
const ENV = { APP_BASE_URL: 'https://xivdyetools.app', OG_IMAGE_BASE_URL: 'https://og.xivdyetools.app/og' };
const ROUTES = [
  '/og/default.png',
  '/og/harmony/default.png',
  '/og/glamour/default.png',
  '/og/harmony/1/complementary.png',
  '/og/gradient/1/2/3.png',
  '/og/mixer/1/2/50.png',
  '/og/mixer/1/2/3/50.png',
  '/og/swatch/FF0000/3.png',
  '/og/comparison/1,2.png',
  '/og/accessibility/1/achromatopsia.png',
  '/og/extractor/FF0000.png',
  '/og/presets/default',
  '/og/presets/unknown-preset.png',
  '/og/budget/1.png',
];

beforeEach(() => vi.mocked(renderOGImage).mockClear());

describe('resolved card locale reaches rasterization on every image route', () => {
  for (const route of ROUTES) {
    it.each([['ja-JP', 'ja'], ['zh-CN', 'zh'], ['EN-US', 'en'], ['invalid', 'en']] as const)(
      `${route}: lang=%s reaches the renderer as %s`,
      async (query, locale) => {
        const response = await app.request(`${route}?lang=${query}`, {}, ENV);
        expect(response.status).toBe(200);
        expect(renderOGImage).toHaveBeenCalledOnce();
        expect(vi.mocked(renderOGImage).mock.calls[0][1]).toBe(locale);
      },
    );
  }
});
