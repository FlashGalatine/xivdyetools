/**
 * Image Processing Types
 *
 * Types for image validation, processing, and color extraction.
 *
 * @module types/image
 */


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
