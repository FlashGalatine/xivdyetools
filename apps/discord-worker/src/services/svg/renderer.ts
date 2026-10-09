/**
 * SVG to PNG Renderer
 *
 * Uses resvg-wasm to convert SVG strings to PNG images.
 * This is necessary because Discord displays PNG images better than SVG.
 *
 * IMPORTANT: Cloudflare Workers requires static WASM imports.
 * Dynamic WebAssembly.instantiate() is disallowed by the runtime.
 */

import { Resvg, initWasm } from '@resvg/resvg-wasm';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { LocaleCode } from '@xivdyetools/types';

// Static WASM import - wrangler bundles this at build time
// @ts-expect-error - WASM imports are handled by wrangler bundler
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';

import { getFontBuffers } from '../fonts';

// Track WASM initialization state
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Initializes the WASM module.
 * Must be called before rendering SVGs.
 * Safe to call multiple times - will only initialize once.
 *
 * @param logger - Optional logger for structured logging
 */
export async function initRenderer(logger?: ExtendedLogger): Promise<void> {
  if (wasmInitialized) return;

  if (wasmInitPromise) {
    await wasmInitPromise;
    return;
  }

  wasmInitPromise = (async (): Promise<void> => {
    try {
      // Initialize with the statically imported WASM module
      // In Cloudflare Workers, this is a WebAssembly.Module instance
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- wrangler bundles WASM as Module
      await initWasm(resvgWasm);
      wasmInitialized = true;
      if (logger) {
        logger.info('resvg-wasm initialized successfully');
      }
    } catch (error) {
      if (logger) {
        logger.error('WASM initialization failed', error instanceof Error ? error : undefined);
      }
      throw new Error(
        `Failed to initialize SVG renderer: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      );
    }
  })();

  // BUG-013 (2026-07-18 audit): reset the cached promise on failure so the
  // next request retries init instead of re-awaiting the same rejected
  // promise for the rest of the isolate's lifetime.
  wasmInitPromise.catch(() => {
    wasmInitPromise = null;
  });

  await wasmInitPromise;
}

/**
 * Renders an SVG string to a PNG buffer
 *
 * @param svgString - SVG content to render
 * @param options - Rendering options
 * @param logger - Optional logger for structured logging
 */
export async function renderSvgToPng(
  svgString: string,
  options: {
    /** Scale factor (2 = 2x resolution) */
    scale?: number;
    /** Background color (default: transparent) */
    background?: string;
    /**
     * The locale the card is drawn in. It picks the CJK font load order,
     * which is what decides the face for a glyph the primary (Latin) face
     * lacks: JP first for `ja` (Japanese letterforms), SC first otherwise.
     * See `getFontBuffers`. Required, so a card command cannot silently fall
     * back to the SC-first order for a Japanese user.
     */
    locale: LocaleCode;
  },
  logger?: ExtendedLogger,
): Promise<Uint8Array> {
  // Ensure WASM is initialized
  await initRenderer(logger);

  const { scale = 2, background, locale } = options;

  // Both wasm allocations of a render, the parsed tree and the RGBA pixmap,
  // are released in the `finally`: on success after `asPng()` has returned,
  // and on a failure whichever of the two was allocated. Nothing else frees
  // either of them in this worker. In @resvg/resvg-wasm 2.6.2 the `Resvg`
  // constructor glue never calls `ResvgFinalization.register`, and
  // `RenderedImage` registers only where a `FinalizationRegistry` exists:
  // this worker's compatibility_date (2024-12-01, no `enable_weak_ref` flag)
  // predates the 2025-05-05 default, so workerd has none and the glue falls
  // back to a no-op stub. Before this fix both allocations leaked for the life
  // of the isolate on every render, and GC reclaimed neither. Freeing is safe
  // after `asPng()`: it returns a JS-owned copy, not a view over wasm memory.
  // This is the fix the 2026-10-04
  // deep-dive's OPT-006 prescribes for og-worker's renderer. `RenderedImage`
  // is not exported from resvg-wasm's typings, hence the derived type.
  let resvg: InstanceType<typeof Resvg> | undefined;
  let rendered: ReturnType<InstanceType<typeof Resvg>['render']> | undefined;

  try {
    resvg = new Resvg(svgString, {
      fitTo: {
        mode: 'zoom',
        value: scale,
      },
      background,
      font: {
        // Load bundled font files for text rendering, in the locale's
        // fallback order (resvg builds its font database per instance, so
        // this array is the only thing cached across renders)
        fontBuffers: getFontBuffers(locale),
        // Default to Onest (body font) for any unspecified text
        defaultFontFamily: 'Onest',
      },
    });

    rendered = resvg.render();
    const pngBuffer = rendered.asPng();

    return pngBuffer;
  } catch (error) {
    if (logger) {
      logger.error('SVG rendering failed', error instanceof Error ? error : undefined);
    }
    throw new Error(
      `Failed to render SVG: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { cause: error },
    );
  } finally {
    rendered?.free();
    resvg?.free();
  }
}
