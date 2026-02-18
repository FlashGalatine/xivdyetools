/**
 * Image Processing Services
 *
 * Provides image loading, validation, and pixel extraction
 * using WASM-based photon for Cloudflare Workers compatibility.
 *
 * @module services/image
 */

// Photon image processing
export {
  // Types
  type ProcessedImage,
  type ProcessImageOptions,
  // Functions
  loadImage,
  resizeImage,
  extractPixels,
  processImageForExtraction,
  getImageDimensions,
} from './photon.js';

// Image validation
export {
  // Constants
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_PIXEL_COUNT,
  FETCH_TIMEOUT_MS,
  // URL validation
  validateImageUrl,
  // Size validation
  validateFileSize,
  validateDimensions,
  // Format validation
  detectImageFormat,
  validateImageFormat,
  // Fetching
  fetchImageWithTimeout,
  validateAndFetchImage,
} from './validators.js';
