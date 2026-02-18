/**
 * SVG to PNG Renderer
 *
 * Uses resvg-wasm to convert SVG strings to PNG images.
 * Optimized for OpenGraph image generation (1200x630px).
 *
 * IMPORTANT: Cloudflare Workers requires static WASM imports.
 * Dynamic WebAssembly.instantiate() is disallowed by the runtime.
 */

import { Resvg, initWasm } from '@resvg/resvg-wasm';

// Static WASM import - wrangler bundles this at build time
// @ts-expect-error - WASM imports are handled by wrangler bundler
import resvgWasm from '@resvg/resvg-wasm/index_bg.wasm';

import { getFontBuffers } from './fonts';

// Track WASM initialization state
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

/**
 * Initializes the WASM module.
 * Must be called before rendering SVGs.
 * Safe to call multiple times - will only initialize once.
 */
export async function initRenderer(): Promise<void> {
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

  await wasmInitPromise;
}

/**
 * Renders an SVG string to a PNG buffer
 *
 * @param svgString - SVG content to render
 * @param options - Rendering options
 * @returns PNG image as Uint8Array
 */
export async function renderSvgToPng(
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
 * @param svgString - SVG content (should be 1200x630)
 * @param cacheMaxAge - Cache duration in seconds (default: 24 hours)
 * @returns Response with PNG image and appropriate headers
 */
export async function renderOGImage(
  svgString: string,
  cacheMaxAge: number = 86400
): Promise<Response> {
  try {
    const pngBuffer = await renderSvgToPng(svgString, {
      scale: 1, // 1200x630 is already full resolution
      background: '#1a1a2e', // Match theme background
    });

    return new Response(pngBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': `public, max-age=${cacheMaxAge}, s-maxage=${cacheMaxAge * 7}`,
        'CDN-Cache-Control': `max-age=${cacheMaxAge * 7}`,
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
