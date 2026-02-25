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
        { cause: error }
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
 * @param logger - Optional logger for structured logging
 */
export async function renderSvgToPng(
  svgString: string,
  options: {
    /** Scale factor (2 = 2x resolution) */
    scale?: number;
    /** Background color (default: transparent) */
    background?: string;
  } = {},
  logger?: ExtendedLogger
): Promise<Uint8Array> {
  // Ensure WASM is initialized
  await initRenderer(logger);

  const { scale = 2, background } = options;

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
    if (logger) {
      logger.error('SVG rendering failed', error instanceof Error ? error : undefined);
    }
    throw new Error(
      `Failed to render SVG: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { cause: error }
    );
  }
}

/**
 * Renders an SVG to a PNG and returns it as a base64 data URL
 * Useful for embedding in HTML or testing
 */
export async function renderSvgToDataUrl(svgString: string): Promise<string> {
  const pngBuffer = await renderSvgToPng(svgString);
  const base64 = bufferToBase64(pngBuffer);
  return `data:image/png;base64,${base64}`;
}

/**
 * Converts a Uint8Array to a base64 string
 */
function bufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buffer.length; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}
