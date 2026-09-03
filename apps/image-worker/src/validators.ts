/**
 * Image Validation Service
 *
 * Provides security validation for image URLs and content:
 * - SSRF protection (only allow Discord CDN)
 * - File size limits
 * - Image format validation via magic bytes
 *
 * @module services/image/validators
 */

import type {
  UrlValidationResult,
  FormatValidationResult,
  ImageFormat,
} from './types.js';
import { readImageDimensions, type ImageDimensions } from './dimensions.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Allowed hostnames for image URLs (Discord CDN only)
 *
 * This prevents SSRF attacks by ensuring we only fetch from trusted sources.
 */
const ALLOWED_HOSTS = new Set([
  'cdn.discordapp.com',
  'media.discordapp.net',
]);

/**
 * Maximum allowed file size (10MB)
 *
 * Workers have 128MB memory limit, and we need room for:
 * - Original image buffer
 * - Decoded pixel data (4x uncompressed)
 * - Processing overhead
 */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Maximum image dimension per side (4096px) — the SECONDARY guard.
 *
 * Prevents decompression bombs where a small file expands to huge pixel data.
 * The binding limit is {@link MAX_PIXEL_COUNT} below; this one only rejects a
 * shape no legitimate palette source has.
 */
export const MAX_IMAGE_DIMENSION = 4096;

/**
 * Bytes an RGBA pixel costs in one buffer.
 */
const BYTES_PER_RGBA_PIXEL = 4;

/**
 * How many full RGBA copies of the image exist at once inside photon.
 *
 * `get_raw_pixels()` materialises one, and `dyn_image_from_raw` copies that
 * vector again for each operation — so a decode-then-resize holds two.
 */
const CONCURRENT_RGBA_COPIES = 2;

/**
 * The share of the isolate's 128 MiB this Worker will spend on decoded pixels.
 *
 * The rest pays for the JS-side source buffer (up to
 * {@link MAX_FILE_SIZE_BYTES}), the resize output, the WASM module itself and
 * the runtime's own overhead — and this Worker shares its isolate with
 * whatever else is resident.
 *
 * 2026-09-03 (pre-merge review of the deep dive): this was 32 MiB, i.e. a
 * 4 MP ceiling. That is below the resolution people actually screenshot at —
 * 3840×2160 is 8.29 MP and 3440×1440 is 4.95 MP, so a 4K or ultrawide capture,
 * the single most common palette source an FFXIV player has, was refused
 * pre-decode with no downscale path and nothing but an error to show for it.
 * At 72 MiB the ceiling is 9.4 MP: 4K and ultrawide pass, and 4096×4096 —
 * the decompression bomb BUG-052 was actually about, at 134 MiB of RGBA — is
 * still refused. The trade is a thinner margin: peak lands near 95-100 MB of
 * the 128 MiB isolate rather than 55-60, so this is the ceiling, not a floor
 * to raise again without measuring the real peak first.
 */
const PIXEL_MEMORY_BUDGET_BYTES = 72 * 1024 * 1024;

/**
 * Maximum pixel count — **derived from the memory budget, not the side length**.
 *
 * BUG-052 (deep dive 2026-09-02): this used to be `16 * 1024 * 1024`, exactly
 * 4096², so the largest square the side cap admits was accepted at equality
 * (`pixelCount > MAX_PIXEL_COUNT` is false when they are equal). One RGBA
 * buffer for it is 64 MiB and photon holds two, so decode-then-resize needed
 * ≥ 128 MiB of WASM linear memory against Cloudflare's 128 MiB per-isolate
 * limit — before the source buffer and the resize output. A solid-colour
 * 4096×4096 PNG compresses to tens of KB, far under the 10 MB file cap, so the
 * OOM this pre-decode gate exists to prevent was reachable from any Discord
 * attachment, in a Worker shared with presets-api.
 *
 * The ceiling is deliberately NOT set to "more resolution than extraction can
 * use". Extraction downscales to a 256px long edge, so on that reasoning any
 * cap above ~1 MP would do — but the cap rejects the INPUT, before a decode
 * that is the only thing able to downscale it. Set too low it does not save a
 * user bandwidth; it refuses their screenshot. So the number answers "what can
 * this isolate decode without dying", and nothing else. See
 * {@link PIXEL_MEMORY_BUDGET_BYTES} for the 4 MP → 9.4 MP revision.
 */
export const MAX_PIXEL_COUNT = Math.floor(
  PIXEL_MEMORY_BUDGET_BYTES / (BYTES_PER_RGBA_PIXEL * CONCURRENT_RGBA_COPIES)
); // 9,437,184 px ≈ 9.4 MP — admits 3840×2160 (8.29) and 3440×1440 (4.95)

/** Smallest `maxDimension` that still yields a usable palette sample. */
export const MIN_MAX_DIMENSION = 16;

/**
 * FINDING-004 (2026-08-21 audit): `maxDimension` arrives from the request body
 * and used to flow straight into `resize()` — NaN / 0 / huge values produced a
 * zero-sized or full-resolution RGBA buffer. Integer 16..MAX_IMAGE_DIMENSION.
 *
 * REFACTOR-007 (deep dive 2026-09-02): this lives HERE, not in `photon.ts`, so
 * the route and the processor can share one rule without the route importing
 * the WASM-touching module — which every route test mocks wholesale, so a rule
 * reached through it would be undefined under test. `photon.ts` re-exports it
 * for its own callers.
 */
export function assertValidMaxDimension(value: number): void {
  if (!Number.isInteger(value) || value < MIN_MAX_DIMENSION || value > MAX_IMAGE_DIMENSION) {
    throw new Error(
      `Invalid maxDimension: expected an integer between ${MIN_MAX_DIMENSION} and ${MAX_IMAGE_DIMENSION}`
    );
  }
}

/**
 * Request timeout for image fetching (10 seconds)
 */
export const FETCH_TIMEOUT_MS = 10000;

/**
 * Magic bytes for image format detection
 */
const MAGIC_BYTES: Record<ImageFormat, number[]> = {
  png: [0x89, 0x50, 0x4e, 0x47], // \x89PNG
  jpeg: [0xff, 0xd8, 0xff], // \xFF\xD8\xFF
  gif: [0x47, 0x49, 0x46], // GIF
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF (check for WEBP at offset 8)
  bmp: [0x42, 0x4d], // BM
};

// ============================================================================
// URL Validation
// ============================================================================

/**
 * Validate an image URL for security
 *
 * Prevents SSRF by only allowing Discord CDN URLs.
 *
 * @param url - URL to validate
 * @returns Validation result with normalized URL or error
 *
 * @example
 * ```typescript
 * const result = validateImageUrl('https://cdn.discordapp.com/attachments/...');
 * if (!result.valid) {
 *   return errorResponse(result.error);
 * }
 * const response = await fetch(result.normalizedUrl);
 * ```
 */
export function validateImageUrl(url: string): UrlValidationResult {
  // Empty URL check
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'No image URL provided' };
  }

  // Parse URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Protocol check (HTTPS only)
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed' };
  }

  // Host allowlist check (SSRF protection)
  const hostname = parsedUrl.hostname.toLowerCase();
  if (!ALLOWED_HOSTS.has(hostname)) {
    return {
      valid: false,
      error: 'Only Discord CDN URLs are allowed for security',
    };
  }

  // Block private/internal IPs (defense in depth)
  // These should never come from Discord CDN, but check anyway
  if (isPrivateHost(hostname)) {
    return { valid: false, error: 'Private network access is not allowed' };
  }

  return {
    valid: true,
    normalizedUrl: parsedUrl.toString(),
  };
}

/**
 * Check if a hostname is unsafe (private/internal IP or IP literal)
 *
 * SECURITY: Blocks all IP address literals since Discord CDN uses hostnames.
 * Also blocks cloud metadata endpoints and private IP ranges.
 */
function isPrivateHost(hostname: string): boolean {
  // Block ALL IP address literals (IPv4 and IPv6)
  // Discord CDN always uses hostnames like cdn.discordapp.com, never IPs
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Pattern = /^([0-9a-f:]+)$/i;
  if (ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)) {
    return true;
  }

  // Block cloud metadata endpoints (AWS, GCP, Azure, etc.)
  const metadataHosts = [
    /^169\.254\.169\.254$/, // AWS/GCP metadata
    /^metadata\.google\.internal$/i,
    /^metadata\.azure\.internal$/i,
  ];
  if (metadataHosts.some((pattern) => pattern.test(hostname))) {
    return true;
  }

  // Private IP patterns (defense in depth, shouldn't be reachable via hostname)
  const privatePatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^0\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
    /^fd[0-9a-f]{2}:/i, // Unique local addresses
  ];

  return privatePatterns.some((pattern) => pattern.test(hostname));
}

// ============================================================================
// Size Validation
// ============================================================================

/**
 * Validate image file size
 *
 * @param sizeBytes - File size in bytes
 * @returns Error message if invalid, undefined if valid
 */
export function validateFileSize(sizeBytes: number): string | undefined {
  if (sizeBytes <= 0) {
    return 'Image file is empty';
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(1);
    const maxMB = (MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0);
    return `Image too large (${sizeMB}MB). Maximum size is ${maxMB}MB`;
  }

  return undefined;
}

/**
 * Validate image dimensions
 *
 * @param width - Image width in pixels
 * @param height - Image height in pixels
 * @returns Error message if invalid, undefined if valid
 */
export function validateDimensions(
  width: number,
  height: number
): string | undefined {
  if (width <= 0 || height <= 0) {
    return 'Image has invalid dimensions';
  }

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return `Image too large (${width}x${height}). Maximum dimension is ${MAX_IMAGE_DIMENSION}px`;
  }

  const pixelCount = width * height;
  if (pixelCount > MAX_PIXEL_COUNT) {
    const megapixels = (pixelCount / 1024 / 1024).toFixed(1);
    const maxMegapixels = (MAX_PIXEL_COUNT / 1024 / 1024).toFixed(0);
    return `Image has too many pixels (${megapixels}MP). Maximum is ${maxMegapixels}MP`;
  }

  return undefined;
}

/**
 * FINDING-004 (2026-08-21 audit): the pre-decode dimension gate.
 *
 * Reads width × height from the container header (no decoding) and applies
 * {@link validateDimensions}. Unreadable headers fail closed — photon would
 * otherwise decode blind and a decompression bomb would OOM the isolate.
 *
 * @returns the dimensions when acceptable
 * @throws Error with a user-facing message (contains "too large" / "too many
 *   pixels" / "format" so discord-worker's substring contract keeps working)
 */
export function assertImageDimensionsFromHeader(buffer: Uint8Array): ImageDimensions {
  const dims = readImageDimensions(buffer);
  if (!dims) {
    throw new Error('Unsupported image format or unreadable image dimensions');
  }
  const error = validateDimensions(dims.width, dims.height);
  if (error) {
    throw new Error(error);
  }
  return dims;
}

/**
 * Read a body stream into memory, abandoning it as soon as it exceeds `maxBytes`.
 *
 * FINDING-004: the previous `arrayBuffer()`-then-check pattern buffered the
 * whole body (up to the platform's ~100 MB request cap) before the 10 MB rule
 * ran. Streaming lets the cap bind while bytes arrive.
 *
 * @throws Error("Image too large…") once the cap is exceeded
 */
export async function readBodyWithCap(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number = MAX_FILE_SIZE_BYTES
): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        const maxMB = (maxBytes / 1024 / 1024).toFixed(0);
        throw new Error(`Image too large. Maximum size is ${maxMB}MB`);
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already released by cancel()
    }
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

// ============================================================================
// Format Validation
// ============================================================================

/**
 * Detect image format from magic bytes
 *
 * @param buffer - First 12+ bytes of the image file
 * @returns Detected format or undefined
 */
export function detectImageFormat(buffer: Uint8Array): ImageFormat | undefined {
  if (buffer.length < 12) {
    return undefined;
  }

  // Check PNG
  if (matchesMagicBytes(buffer, MAGIC_BYTES.png)) {
    return 'png';
  }

  // Check JPEG
  if (matchesMagicBytes(buffer, MAGIC_BYTES.jpeg)) {
    return 'jpeg';
  }

  // Check GIF
  if (matchesMagicBytes(buffer, MAGIC_BYTES.gif)) {
    return 'gif';
  }

  // Check WebP (RIFF....WEBP)
  if (
    matchesMagicBytes(buffer, MAGIC_BYTES.webp) &&
    buffer[8] === 0x57 && // W
    buffer[9] === 0x45 && // E
    buffer[10] === 0x42 && // B
    buffer[11] === 0x50 // P
  ) {
    return 'webp';
  }

  // Check BMP
  if (matchesMagicBytes(buffer, MAGIC_BYTES.bmp)) {
    return 'bmp';
  }

  return undefined;
}

/**
 * Check if buffer starts with magic bytes
 */
function matchesMagicBytes(buffer: Uint8Array, magic: number[]): boolean {
  for (let i = 0; i < magic.length; i++) {
    if (buffer[i] !== magic[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Validate image format from buffer
 *
 * @param buffer - Image file buffer
 * @returns Validation result with format or error
 */
export function validateImageFormat(buffer: Uint8Array): FormatValidationResult {
  const format = detectImageFormat(buffer);

  if (!format) {
    return {
      valid: false,
      error: 'Unsupported image format. Use PNG, JPEG, GIF, WebP, or BMP',
    };
  }

  return {
    valid: true,
    format,
  };
}

// ============================================================================
// Image Fetching
// ============================================================================

/**
 * Fetch an image from a validated URL with timeout
 *
 * SECURITY: Uses manual redirect handling to prevent SSRF via redirect attacks.
 * Discord CDN should never redirect to external hosts, but we validate anyway.
 *
 * @param url - Validated image URL
 * @returns Image buffer
 * @throws Error if fetch fails or times out
 */
export async function fetchImageWithTimeout(
  url: string,
  options: { maxBytes?: number } = {}
): Promise<Uint8Array> {
  const maxBytes = options.maxBytes ?? MAX_FILE_SIZE_BYTES;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    // SECURITY: Use manual redirect handling to validate redirect targets
    // This prevents SSRF attacks where Discord CDN might redirect to internal hosts
    let response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual', // Don't auto-follow redirects
      headers: {
        // Identify ourselves as a bot
        'User-Agent': 'XIV Dye Tools Discord Bot/1.0',
      },
    });

    // Handle redirects manually with validation
    if (response.status >= 300 && response.status < 400) {
      const redirectUrl = response.headers.get('Location');
      if (!redirectUrl) {
        throw new Error('Redirect without Location header');
      }

      // Validate the redirect target using the same security checks
      const redirectResult = validateImageUrl(redirectUrl);
      if (!redirectResult.valid) {
        throw new Error(`Unsafe redirect target: ${redirectResult.error}`);
      }

      // Follow the validated redirect (one hop only). `manual`, not `error`:
      // workerd has no `error` mode (it throws a TypeError on it — found
      // 2026-08-29); a second redirect comes back as a 3xx that the `!ok`
      // check below rejects, so it is still never followed.
      response = await fetch(redirectResult.normalizedUrl!, {
        signal: controller.signal,
        redirect: 'manual', // No further redirects allowed
        headers: {
          'User-Agent': 'XIV Dye Tools Discord Bot/1.0',
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }

    // Check Content-Length if available (cheap early reject)
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (Number.isFinite(size) && size > maxBytes) {
        const sizeError = validateFileSize(size);
        throw new Error(sizeError ?? 'Image too large');
      }
    }

    // FINDING-004: stream with a cap — a missing or lying Content-Length must
    // not let the body be buffered to completion before the size rule applies.
    // (Real responses always expose `body`; the arrayBuffer() branch only
    // serves hand-built responses without a stream, e.g. in tests.)
    const bytes = response.body
      ? await readBodyWithCap(response.body, maxBytes)
      : new Uint8Array(await response.arrayBuffer());

    // Validate actual size (also catches empty bodies)
    const sizeError = validateFileSize(bytes.byteLength);
    if (sizeError) {
      throw new Error(sizeError);
    }

    return bytes;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Image fetch timed out', { cause: error });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ============================================================================
// Combined Validation
// ============================================================================

/**
 * Validate and fetch an image from a Discord attachment URL
 *
 * Performs all security checks:
 * 1. URL validation (SSRF protection)
 * 2. Fetch with timeout
 * 3. Size validation
 * 4. Format validation
 *
 * @param url - Discord attachment URL
 * @returns Validated image buffer and format
 *
 * @example
 * ```typescript
 * try {
 *   const { buffer, format } = await validateAndFetchImage(attachment.url);
 *   const processed = await processImageForExtraction(buffer);
 * } catch (error) {
 *   return errorResponse(error.message);
 * }
 * ```
 */
export async function validateAndFetchImage(url: string): Promise<{
  buffer: Uint8Array;
  format: ImageFormat;
}> {
  // Step 1: Validate URL
  const urlResult = validateImageUrl(url);
  if (!urlResult.valid) {
    throw new Error(urlResult.error);
  }

  // Step 2: Fetch with timeout
  const buffer = await fetchImageWithTimeout(urlResult.normalizedUrl!);

  // Step 3: Validate format
  const formatResult = validateImageFormat(buffer);
  if (!formatResult.valid) {
    throw new Error(formatResult.error);
  }

  return {
    buffer,
    format: formatResult.format!,
  };
}
