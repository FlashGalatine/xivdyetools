/**
 * Environment bindings for image-worker.
 *
 * Deliberately empty of storage bindings: this Worker is stateless. It holds no
 * secrets, no KV, no D1 — it decodes images and returns pixels.
 *
 * @module types
 */

export interface Env {
  /** Set to "production" by [env.production]; absent in dev. */
  ENVIRONMENT?: string;
}

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Result of URL validation
 */
export interface UrlValidationResult {
  /** Whether the URL is valid and safe */
  valid: boolean;
  /** Normalized URL (if valid) */
  normalizedUrl?: string;
  /** Error message (if invalid) */
  error?: string;
}

/**
 * Result of image format validation
 */
export interface FormatValidationResult {
  /** Whether the format is valid */
  valid: boolean;
  /** Detected format (if valid) */
  format?: ImageFormat;
  /** Error message (if invalid) */
  error?: string;
}

/**
 * Supported image formats
 */
export type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'bmp';
