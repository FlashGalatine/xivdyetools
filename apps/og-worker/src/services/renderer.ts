/**
 * SVG to PNG Renderer
 *
 * Uses resvg-wasm to convert SVG strings to PNG images. The 15E cards are
 * drawn on the 400 design grid and rastered ×3 (Discord 1200×1050, X 1200×630).
 *
 * IMPORTANT: Cloudflare Workers requires static WASM imports.
 * Dynamic WebAssembly.instantiate() is disallowed by the runtime.
 */

import { Resvg, initWasm } from '@resvg/resvg-wasm';

// Static WASM import - wrangler bundles this at build time
// @ts-expect-error - WASM imports are handled by wrangler bundler
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';

import { getFontBuffers } from './fonts';
import { GROUND } from './svg/tokens';

/** The 15E raster: ×3 on the console ground. Every card is drawn on it. */
const BAND_RENDER = { scale: 3, background: GROUND } as const;

// Track WASM initialization state
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Initializes the WASM module.
 * Must be called before rendering SVGs.
 * Safe to call multiple times - will only initialize once.
 */
async function initRenderer(): Promise<void> {
  if (wasmInitialized) return;

  if (wasmInitPromise) {
    await wasmInitPromise;
    return;
  }

  wasmInitPromise = (async () => {
    try {
      // Initialize with the statically imported WASM module
      // In Cloudflare Workers, this is a WebAssembly.Module instance
      await initWasm(resvgWasm);
      wasmInitialized = true;
      console.log('[Renderer] resvg-wasm initialized successfully');
    } catch (error) {
      console.error('[Renderer] WASM initialization failed:', error);
      throw new Error(
        `Failed to initialize SVG renderer: ${error instanceof Error ? error.message : 'Unknown error'}`
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
 * @returns PNG image as Uint8Array
 */
async function renderSvgToPng(
  svgString: string,
  options: {
    /** Scale factor (1 = native resolution, 2 = 2x) */
    scale?: number;
    /** Background color (default: transparent) */
    background?: string;
  } = {}
): Promise<Uint8Array> {
  // Ensure WASM is initialized
  await initRenderer();

  const { scale = 1, background } = options;

  try {
    const resvg = new Resvg(svgString, {
      fitTo: {
        mode: 'zoom',
        value: scale,
      },
      background,
      font: {
        // Load bundled font files for text rendering
        fontBuffers: getFontBuffers(),
        // Default to Onest (body font) for any unspecified text
        defaultFontFamily: 'Onest',
      },
    });

    const rendered = resvg.render();
    const pngBuffer = rendered.asPng();

    return pngBuffer;
  } catch (error) {
    console.error('[Renderer] SVG rendering failed:', error);
    throw new Error(
      `Failed to render SVG: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Renders an OG image SVG to a PNG response
 *
 * @param svgString - SVG content on the 400 design grid (400×350 or 400×210)
 * @param ttl - Explicit browser/edge cache TTLs in seconds (BUG-068: the old
 *   single seconds param was silently multiplied by 7 for the edge TTL,
 *   turning a "7 days" call site into 49 days at the edge)
 * @returns Response with PNG image and appropriate headers
 */
export async function renderOGImage(
  svgString: string,
  ttl: { browser: number; edge: number } = { browser: 86400, edge: 604800 }
): Promise<Response> {
  try {
    const pngBuffer = await renderSvgToPng(svgString, BAND_RENDER);

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': `public, max-age=${ttl.browser}, s-maxage=${ttl.edge}`,
        'CDN-Cache-Control': `max-age=${ttl.edge}`,
      },
    });
  } catch (error) {
    console.error('[Renderer] OG image generation failed:', error);

    // Return a fallback error response
    return new Response('Image generation failed', {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}
