/**
 * Photon Image Processing Service
 *
 * Uses @cf-wasm/photon (Cloudflare Workers-optimized fork of photon-wasm)
 * for loading, resizing, and extracting pixels from images.
 *
 * Key differences from Sharp:
 * - WASM-based, works in Cloudflare Workers
 * - Returns RGBA pixel data directly (no Canvas needed)
 * - Manual memory management required (free() after use)
 *
 * @module services/image/photon
 */

import { PhotonImage, SamplingFilter, resize, crop } from '@cf-wasm/photon';

// ============================================================================
// Types
// ============================================================================

/**
 * Processed image with extracted pixel data
 */
export interface ProcessedImage {
  /** RGBA pixel data (4 bytes per pixel) */
  pixels: Uint8Array;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
}

/**
 * Options for image processing
 */
export interface ProcessImageOptions {
  /** Maximum dimension for resizing (default: 256) */
  maxDimension?: number;
  /** Sampling filter for resize (default: Lanczos3) */
  samplingFilter?: SamplingFilter;
}

// ============================================================================
// Constants
// ============================================================================

/** Default max dimension for color extraction (balances quality vs performance) */
const DEFAULT_MAX_DIMENSION = 256;

/** Default sampling filter for best quality */
const DEFAULT_SAMPLING_FILTER = SamplingFilter.Lanczos3;

/** Card shot slot is 320x132; we encode at 2x for retina. */
export const THUMBNAIL_WIDTH = 640;
export const THUMBNAIL_HEIGHT = 264;
const TARGET_ASPECT = THUMBNAIL_WIDTH / THUMBNAIL_HEIGHT; // ~2.4242

/**
 * "Landscape" means wider than tall, so 4:3 (1.33) and 3:2 (1.50) are
 * landscape. The 0.05 tolerance only stops a nominally-square image being
 * treated as landscape by a rounding error; square and portrait share the same
 * branch, so the rule is one comparison.
 */
const LANDSCAPE_ASPECT_THRESHOLD = 1.05;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Load a PhotonImage from a byte buffer
 *
 * @param buffer - Image file contents (PNG, JPEG, GIF, WebP, BMP)
 * @returns PhotonImage instance (must call .free() when done)
 * @throws Error if image format is invalid or corrupted
 */
export function loadImage(buffer: Uint8Array): PhotonImage {
  try {
    // @cf-wasm/photon expects Uint8Array, not ArrayBuffer
    return PhotonImage.new_from_byteslice(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to load image: ${message}`, { cause: error });
  }
}

/**
 * Resize an image while maintaining aspect ratio
 *
 * @param image - PhotonImage to resize
 * @param maxDimension - Maximum width or height
 * @param samplingFilter - Resampling algorithm
 * @returns New resized PhotonImage (caller must free both images)
 */
export function resizeImage(
  image: PhotonImage,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
  samplingFilter: SamplingFilter = DEFAULT_SAMPLING_FILTER
): PhotonImage {
  const width = image.get_width();
  const height = image.get_height();

  // Calculate new dimensions maintaining aspect ratio
  let newWidth = width;
  let newHeight = height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      newWidth = maxDimension;
      newHeight = Math.round((height / width) * maxDimension);
    } else {
      newHeight = maxDimension;
      newWidth = Math.round((width / height) * maxDimension);
    }
  }

  // No resize needed if already smaller
  if (newWidth === width && newHeight === height) {
    // Return a copy to maintain consistent memory management
    // The caller expects to free both original and resized
    return PhotonImage.new_from_byteslice(image.get_bytes());
  }

  return resize(image, newWidth, newHeight, samplingFilter);
}

/**
 * Extract raw RGBA pixel data from an image
 *
 * @param image - PhotonImage to extract pixels from
 * @returns Uint8Array of RGBA pixels (4 bytes per pixel)
 */
export function extractPixels(image: PhotonImage): Uint8Array {
  return image.get_raw_pixels();
}

/**
 * Process an image buffer for color extraction
 *
 * This is the main entry point that:
 * 1. Loads the image from buffer
 * 2. Resizes to a manageable size
 * 3. Extracts RGBA pixel data
 * 4. Properly frees WASM memory
 *
 * @param buffer - Raw image file bytes
 * @param options - Processing options
 * @returns ProcessedImage with pixel data and dimensions
 *
 * @example
 * ```typescript
 * const response = await fetch(imageUrl);
 * const buffer = new Uint8Array(await response.arrayBuffer());
 * const processed = await processImageForExtraction(buffer);
 *
 * // Convert to RGB for PaletteService
 * const rgbPixels = PaletteService.pixelDataToRGBFiltered(processed.pixels);
 * const palette = paletteService.extractPalette(rgbPixels, { colorCount: 5 });
 * ```
 */
// eslint-disable-next-line @typescript-eslint/require-await -- callers expect async interface
export async function processImageForExtraction(
  buffer: Uint8Array,
  options: ProcessImageOptions = {}
): Promise<ProcessedImage> {
  const {
    maxDimension = DEFAULT_MAX_DIMENSION,
    samplingFilter = DEFAULT_SAMPLING_FILTER,
  } = options;

  let originalImage: PhotonImage | null = null;
  let resizedImage: PhotonImage | null = null;

  try {
    // Step 1: Load image
    originalImage = loadImage(buffer);

    // Step 2: Resize for processing
    resizedImage = resizeImage(originalImage, maxDimension, samplingFilter);

    // Step 3: Extract pixel data
    const pixels = extractPixels(resizedImage);
    const width = resizedImage.get_width();
    const height = resizedImage.get_height();

    return {
      pixels,
      width,
      height,
    };
  } finally {
    // Critical: Free WASM memory to prevent leaks
    // Workers have a 128MB limit, so cleanup is essential
    if (resizedImage) {
      try {
        resizedImage.free();
      } catch {
        // Ignore errors during cleanup
      }
    }
    if (originalImage && originalImage !== resizedImage) {
      try {
        originalImage.free();
      } catch {
        // Ignore errors during cleanup
      }
    }
  }
}

/**
 * Get image dimensions without full processing
 *
 * Useful for validation before expensive operations
 *
 * @param buffer - Raw image file bytes
 * @returns Object with width and height
 */
export function getImageDimensions(buffer: Uint8Array): { width: number; height: number } {
  let image: PhotonImage | null = null;

  try {
    image = loadImage(buffer);
    return {
      width: image.get_width(),
      height: image.get_height(),
    };
  } finally {
    if (image) {
      try {
        image.free();
      } catch {
        // Ignore errors during cleanup
      }
    }
  }
}

/**
 * The largest band of the target aspect ratio that fits inside the source,
 * positioned per the crop rule: middle for landscape, upper for square and
 * portrait. Always horizontally centred.
 *
 * Glamour shots are usually portrait with the character's head high in frame,
 * which is why those crop from the top rather than the centre.
 */
export function computeCropBox(
  width: number,
  height: number
): { x1: number; y1: number; x2: number; y2: number } {
  let bandWidth = width;
  let bandHeight = Math.round(width / TARGET_ASPECT);

  if (bandHeight > height) {
    // Source is wider than the target ratio — the band is limited by width.
    bandHeight = height;
    bandWidth = Math.round(height * TARGET_ASPECT);
  }

  const x1 = Math.round((width - bandWidth) / 2);
  const isLandscape = width / height > LANDSCAPE_ASPECT_THRESHOLD;
  const y1 = isLandscape ? Math.round((height - bandHeight) / 2) : 0;

  return { x1, y1, x2: x1 + bandWidth, y2: y1 + bandHeight };
}

/**
 * Decode -> crop to the card band -> resize to exactly 640x264 -> WebP.
 *
 * The decode/encode round trip also drops EXIF, so GPS coordinates in an
 * author's screenshot never reach R2.
 */
export function processImageForThumbnail(buffer: Uint8Array): Uint8Array {
  let original: PhotonImage | null = null;
  let cropped: PhotonImage | null = null;
  let resized: PhotonImage | null = null;

  try {
    original = loadImage(buffer);
    const box = computeCropBox(original.get_width(), original.get_height());
    cropped = crop(original, box.x1, box.y1, box.x2, box.y2);
    resized = resize(cropped, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, SamplingFilter.Lanczos3);
    return resized.get_bytes_webp();
  } finally {
    // Distinct references only — freeing the same pointer twice corrupts the
    // WASM heap.
    for (const img of new Set([original, cropped, resized])) {
      if (img) {
        try {
          img.free();
        } catch {
          // already freed
        }
      }
    }
  }
}
