/**
 * Image Processing Types
 *
 * Types for image validation, processing, and color extraction.
 *
 * @module types/image
 */

import type { Dye, RGB } from '@xivdyetools/core';

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

// ============================================================================
// Discord Attachment Types
// ============================================================================

/**
 * Discord attachment data from interaction
 * @see https://discord.com/developers/docs/resources/channel#attachment-object
 */
export interface DiscordAttachment {
  /** Attachment ID */
  id: string;
  /** Name of file attached */
  filename: string;
  /** Size of file in bytes */
  size: number;
  /** Source URL of file */
  url: string;
  /** Proxied URL of file */
  proxy_url: string;
  /** MIME type of file */
  content_type?: string;
  /** Width of image (if image) */
  width?: number;
  /** Height of image (if image) */
  height?: number;
}

// ============================================================================
// Extraction Types
// ============================================================================

/**
 * A color extracted from an image matched to an FFXIV dye
 */
export interface ExtractedPaletteEntry {
  /** The extracted RGB color */
  extracted: RGB;
  /** The closest matching FFXIV dye */
  matchedDye: Dye;
  /** Color distance (Euclidean in RGB space) */
  distance: number;
  /** Percentage of pixels in this cluster (0-100) */
  dominance: number;
}

/**
 * Match quality based on color distance
 */
export interface MatchQuality {
  /** Locale key for translation lookup (e.g., 'perfect', 'excellent') */
  key: string;
  /** Human-readable label */
  label: string;
  /** Short label for display */
  shortLabel: string;
  /** Distance threshold for this quality level */
  maxDistance: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Match quality thresholds
 *
 * Based on Euclidean distance in RGB space:
 * - Max possible distance: ~441 (black to white)
 * - Noticeable difference: ~10-15
 * - Perceptually similar: ~25-30
 */
export const MATCH_QUALITIES: MatchQuality[] = [
  { key: 'perfect', label: 'Perfect Match', shortLabel: 'PERFECT', maxDistance: 0 },
  { key: 'excellent', label: 'Excellent Match', shortLabel: 'EXCELLENT', maxDistance: 10 },
  { key: 'good', label: 'Good Match', shortLabel: 'GOOD', maxDistance: 25 },
  { key: 'fair', label: 'Fair Match', shortLabel: 'FAIR', maxDistance: 50 },
  { key: 'approximate', label: 'Approximate Match', shortLabel: 'APPROX', maxDistance: Infinity },
];

/**
 * Get the quality rating for a color distance
 */
export function getMatchQuality(distance: number): MatchQuality {
  for (const quality of MATCH_QUALITIES) {
    if (distance <= quality.maxDistance) {
      return quality;
    }
  }
  return MATCH_QUALITIES[MATCH_QUALITIES.length - 1];
}
