/**
 * OPT-006 (2026-10-04 deep-dive): `renderSvgToPng` must release the wasm
 * allocations of every render deterministically — `Resvg` (the parsed tree)
 * and `RenderedImage` (the 1200×1050 RGBA pixmap, ~5 MB). Before the fix
 * neither was freed explicitly. The `Resvg` constructor glue in
 * @resvg/resvg-wasm 2.6.2 never calls `ResvgFinalization.register`, and this
 * worker's compatibility_date (2024-12-01, no `enable_weak_ref`) predates the
 * 2025-05-05 default that enables `FinalizationRegistry`, so the glue's
 * registries are no-op stubs: BOTH allocations leaked for the life of the
 * isolate and GC reclaimed neither. (Vitest runs on Node, where
 * `FinalizationRegistry` exists, so these tests cannot show that.) Both are
 * now freed in a `finally`, after `asPng()` has copied the PNG bytes into a
 * JS-owned buffer, on success and on every failure path.
 *
 * resvg-wasm is replaced with a fake so the tests can make the constructor,
 * `render()` or `asPng()` throw, and can count and order the `free()` calls.
 * (A real `asPng()` after `free()` would not read stale bytes: `free()` zeroes
 * the object's pointer, so the call throws "null pointer passed to rust".)
 */
import { beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

const resvgState = vi.hoisted(() => ({
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

    constructor() {
      if (resvgState.failIn === 'constructor') throw new Error('parse exploded');
      resvgState.instances.push(this);
    }
  }
  return { Resvg: FakeResvg, initWasm: vi.fn(async () => {}) };
});
vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({ default: {} }));
vi.mock('./fonts', () => ({ getFontBuffers: () => [] }));

const { renderOGImage } = await import('./renderer');

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="350"/>';

describe('renderOGImage — wasm memory hygiene (OPT-006)', () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    resvgState.instances.length = 0;
    resvgState.images.length = 0;
    resvgState.failIn = null;
    // No restoreMocks in this app's vitest config, so a re-spy returns the
    // same spy with every earlier test's calls still on it — clear them.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleError.mockClear();
  });

  it('frees the RenderedImage and the Resvg after reading the PNG bytes', async () => {
    const response = await renderOGImage(SVG);

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(resvgState.png);

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

  it('frees the Resvg when render() throws', async () => {
    resvgState.failIn = 'render';

    const response = await renderOGImage(SVG);

    expect(response.status).toBe(500);
    expect(resvgState.instances).toHaveLength(1);
    expect(resvgState.images).toHaveLength(0);
    expect(resvgState.instances[0].free).toHaveBeenCalledOnce();
  });

  it('frees both when asPng() throws', async () => {
    resvgState.failIn = 'asPng';

    const response = await renderOGImage(SVG);

    expect(response.status).toBe(500);
    expect(resvgState.images).toHaveLength(1);
    expect(resvgState.images[0].free).toHaveBeenCalledOnce();
    expect(resvgState.instances[0].free).toHaveBeenCalledOnce();
  });

  it('still answers 500 when the SVG never parses — nothing was allocated to free', async () => {
    resvgState.failIn = 'constructor';

    const response = await renderOGImage(SVG);

    expect(response.status).toBe(500);
    expect(resvgState.instances).toHaveLength(0);
    expect(resvgState.images).toHaveLength(0);

    // The 500 alone cannot tell the cleanup apart: a `free()` on the
    // never-assigned `resvg` would throw a TypeError out of the `finally`,
    // replace the parse error, and still end in a 500. The error that reaches
    // `renderOGImage` must be the parse error. (`renderSvgToPng`'s own catch
    // logs the raw error before the `finally` runs, so read the outer log.)
    const outer = consoleError.mock.calls.filter(
      ([label]) => label === '[Renderer] OG image generation failed:'
    );
    expect(outer).toHaveLength(1);
    expect(outer[0][1]).toBeInstanceOf(Error);
    expect((outer[0][1] as Error).message).toBe('Failed to render SVG: parse exploded');
  });
});
