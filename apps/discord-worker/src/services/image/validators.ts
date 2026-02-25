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
} from '../../types/image.js';

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
 * Maximum image dimensions (4096x4096)
 *
 * Prevents decompression bombs where a small file expands to huge pixel data
 */
export const MAX_IMAGE_DIMENSION = 4096;

/**
 * Maximum pixel count (16 megapixels)
 */
export const MAX_PIXEL_COUNT = 16 * 1024 * 1024; // 16 million pixels

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
export async function fetchImageWithTimeout(url: string): Promise<Uint8Array> {
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

      // Follow the validated redirect (one hop only)
      response = await fetch(redirectResult.normalizedUrl!, {
        signal: controller.signal,
        redirect: 'error', // No further redirects allowed
        headers: {
          'User-Agent': 'XIV Dye Tools Discord Bot/1.0',
        },
      });
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }

    // Check Content-Length if available
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const sizeError = validateFileSize(size);
      if (sizeError) {
        throw new Error(sizeError);
      }
    }

    const buffer = await response.arrayBuffer();

    // Validate actual size
    const sizeError = validateFileSize(buffer.byteLength);
    if (sizeError) {
      throw new Error(sizeError);
    }

    return new Uint8Array(buffer);
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
