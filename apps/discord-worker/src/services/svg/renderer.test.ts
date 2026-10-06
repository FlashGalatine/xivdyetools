/**
 * Tests for SVG to PNG renderer service
 *
 * Note: The actual renderer depends on WASM which is hard to mock.
 * These tests verify the module structure and export correctness.
 */
import { describe, it, expect, vi } from 'vitest';

/** The options each `new Resvg(svg, options)` received. */
const resvgOptions = vi.hoisted(() => [] as unknown[]);

vi.mock('@resvg/resvg-wasm', () => ({
  initWasm: vi.fn().mockResolvedValue(undefined),
  Resvg: class MockResvg {
    constructor(_svg: string, options: unknown) {
      resvgOptions.push(options);
    }
    render() {
      return {
        asPng: () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      };
    }
  },
}));

vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({
  default: new Uint8Array([0x00, 0x61, 0x73, 0x6d]),
}));

/** One distinct buffer list per locale, so a test can tell which one reached resvg. */
const fontsFor = vi.hoisted(() => {
  const lists = new Map<string | undefined, Uint8Array[]>();
  return (locale?: string): Uint8Array[] => {
    if (!lists.has(locale)) lists.set(locale, [new Uint8Array([1, 2, 3])]);
    return lists.get(locale)!;
  };
});

vi.mock('../fonts', () => ({
  getFontBuffers: vi.fn((locale?: string) => fontsFor(locale)),
}));

describe('SVG renderer', () => {
  describe('initRenderer', () => {
    it('exports initRenderer function', async () => {
      const { initRenderer } = await import('./renderer.js');
      expect(initRenderer).toBeDefined();
      expect(typeof initRenderer).toBe('function');
    });

    // BUG-013 (2026-07-18 audit): a failed init must not poison the isolate —
    // the cached promise is reset so the next call retries
    it('retries init after a failed first attempt', async () => {
      const { initWasm } = await import('@resvg/resvg-wasm');
      const { initRenderer } = await import('./renderer.js');

      vi.mocked(initWasm).mockRejectedValueOnce(new Error('transient wasm failure'));

      await expect(initRenderer()).rejects.toThrow('Failed to initialize SVG renderer');
      // Second call must retry (and succeed with the default resolved mock),
      // not re-await the first call's cached rejection
      await expect(initRenderer()).resolves.toBeUndefined();
    });
  });

  describe('renderSvgToPng', () => {
    it('exports renderSvgToPng function', async () => {
      const { renderSvgToPng } = await import('./renderer.js');
      expect(renderSvgToPng).toBeDefined();
      expect(typeof renderSvgToPng).toBe('function');
    });

    // The font LOAD order decides which CJK face draws a kanji the primary
    // face lacks (font-load-order.test.ts), so the locale must reach
    // getFontBuffers and its buffers must reach resvg.
    it.each([['ja'], ['zh'], ['en']] as const)('hands resvg the font buffers for locale %s', async (locale) => {
      const { getFontBuffers } = await import('../fonts');
      const { renderSvgToPng } = await import('./renderer.js');

      await renderSvgToPng('<svg/>', { scale: 2, locale });

      expect(getFontBuffers).toHaveBeenLastCalledWith(locale);
      const options = resvgOptions.at(-1) as { font: { fontBuffers: Uint8Array[] } };
      expect(options.font.fontBuffers).toBe(fontsFor(locale));
    });
  });
});
