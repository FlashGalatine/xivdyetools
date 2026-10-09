/**
 * Tests for SVG to PNG renderer service
 *
 * resvg-wasm is replaced with a fake that records each `Resvg` and each
 * `RenderedImage` it hands out, with spies on their `free()` / `asPng()`
 * calls. The fake is what lets a test make the constructor, `render()` or
 * `asPng()` throw, and count each `free()` and order it against `asPng()`.
 * font-load-order.test.ts renders through the real module.
 */
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { ExtendedLogger } from '@xivdyetools/logger';

const resvgState = vi.hoisted(() => ({
  /** The options each `new Resvg(svg, options)` received. */
  options: [] as unknown[],
  instances: [] as Array<{
    free: ReturnType<typeof vi.fn>;
    render: ReturnType<typeof vi.fn>;
  }>,
  images: [] as Array<{
    free: ReturnType<typeof vi.fn>;
    asPng: ReturnType<typeof vi.fn>;
  }>,
  failIn: null as 'constructor' | 'render' | 'asPng' | null,
  png: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
}));

vi.mock('@resvg/resvg-wasm', () => {
  class FakeResvg {
    free = vi.fn();
    render = vi.fn(() => {
      if (resvgState.failIn === 'render') throw new Error('render exploded');
      const image = {
        free: vi.fn(),
        asPng: vi.fn(() => {
          if (resvgState.failIn === 'asPng') throw new Error('encode exploded');
          return resvgState.png;
        }),
      };
      resvgState.images.push(image);
      return image;
    });

    constructor(_svg: string, options: unknown) {
      resvgState.options.push(options);
      if (resvgState.failIn === 'constructor') throw new Error('parse exploded');
      resvgState.instances.push(this);
    }
  }
  return { Resvg: FakeResvg, initWasm: vi.fn().mockResolvedValue(undefined) };
});

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

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="350"/>';

describe('SVG renderer', () => {
  beforeEach(() => {
    resvgState.options.length = 0;
    resvgState.instances.length = 0;
    resvgState.images.length = 0;
    resvgState.failIn = null;
  });

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
      const options = resvgState.options.at(-1) as { font: { fontBuffers: Uint8Array[] } };
      expect(options.font.fontBuffers).toBe(fontsFor(locale));
    });
  });

  // Every render must release both of its wasm allocations deterministically:
  // the `Resvg` (the parsed tree) and the `RenderedImage` (the RGBA pixmap).
  // Nothing else reclaims either in the deployed worker: in @resvg/resvg-wasm
  // 2.6.2 the `Resvg` constructor glue never registers a finalizer, and at
  // this worker's compatibility_date (2024-12-01) workerd has no
  // `FinalizationRegistry`, so `RenderedImage`'s registration is a no-op stub
  // too. (vitest runs on Node, where `FinalizationRegistry` exists, so no test
  // here can show that.) Both are freed in a `finally`: on success after
  // `asPng()` has copied the PNG bytes into a JS-owned buffer, and when the
  // constructor, `render()` or `asPng()` throws, whichever of the two was
  // allocated.
  describe('renderSvgToPng — wasm memory hygiene', () => {
    function mockLogger(): ExtendedLogger & { error: ReturnType<typeof vi.fn> } {
      return {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown as ExtendedLogger & { error: ReturnType<typeof vi.fn> };
    }

    it('frees the RenderedImage and the Resvg once each, after reading the PNG bytes', async () => {
      const { renderSvgToPng } = await import('./renderer.js');

      const png = await renderSvgToPng(SVG, { scale: 2, locale: 'en' });

      expect(png).toBe(resvgState.png);
      expect(resvgState.instances).toHaveLength(1);
      expect(resvgState.images).toHaveLength(1);
      const [resvg] = resvgState.instances;
      const [image] = resvgState.images;
      expect(image.free).toHaveBeenCalledOnce();
      expect(resvg.free).toHaveBeenCalledOnce();

      // The bytes are copied out before either allocation is released.
      const pngRead = image.asPng.mock.invocationCallOrder[0];
      expect(pngRead).toBeLessThan(image.free.mock.invocationCallOrder[0]);
      expect(pngRead).toBeLessThan(resvg.free.mock.invocationCallOrder[0]);
    });

    it('frees the Resvg once when render() throws', async () => {
      const { renderSvgToPng } = await import('./renderer.js');
      resvgState.failIn = 'render';

      await expect(renderSvgToPng(SVG, { scale: 2, locale: 'en' })).rejects.toThrow(
        'Failed to render SVG: render exploded',
      );

      expect(resvgState.instances).toHaveLength(1);
      expect(resvgState.images).toHaveLength(0);
      expect(resvgState.instances[0].free).toHaveBeenCalledOnce();
    });

    it('frees both once when asPng() throws', async () => {
      const { renderSvgToPng } = await import('./renderer.js');
      resvgState.failIn = 'asPng';

      await expect(renderSvgToPng(SVG, { scale: 2, locale: 'en' })).rejects.toThrow(
        'Failed to render SVG: encode exploded',
      );

      expect(resvgState.images).toHaveLength(1);
      expect(resvgState.images[0].free).toHaveBeenCalledOnce();
      expect(resvgState.instances[0].free).toHaveBeenCalledOnce();
    });

    it('surfaces the parse error when the SVG never parses — nothing was allocated to free', async () => {
      const { renderSvgToPng } = await import('./renderer.js');
      resvgState.failIn = 'constructor';
      const logger = mockLogger();

      const failure = await renderSvgToPng(SVG, { scale: 2, locale: 'en' }, logger).then(
        () => {
          throw new Error('expected renderSvgToPng to reject');
        },
        (error: unknown) => error,
      );

      expect(resvgState.instances).toHaveLength(0);
      expect(resvgState.images).toHaveLength(0);

      // The catch logs the original error...
      expect(logger.error).toHaveBeenCalledOnce();
      const [label, logged] = logger.error.mock.calls[0] as [string, unknown];
      expect(label).toBe('SVG rendering failed');
      expect(logged).toBeInstanceOf(Error);
      expect((logged as Error).message).toBe('parse exploded');

      // ...but that log is written before the `finally` runs, so it cannot
      // tell the cleanup apart. A `free()` on the never-assigned `resvg` would
      // throw a TypeError out of the `finally` and replace the parse error, so
      // the error that reaches the caller must still be the parse error.
      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toBe('Failed to render SVG: parse exploded');
      expect((failure as Error).cause).toBe(logged);
    });
  });
});
