/**
 * Shared Color Math Utilities
 *
 * Single source of truth for color distance calculation and match quality
 * thresholds, used by match, mixer, and gradient commands.
 *
 * @module color-math
 */

import { ColorService } from '@xivdyetools/core';

// ============================================================================
// Color Distance
// ============================================================================

/**
 * Calculate Euclidean distance between two hex colors in RGB space.
 *
 * Delegates to `ColorService.getColorDistance()` from `@xivdyetools/core`.
 * Previously duplicated in match.ts, mixer.ts, and gradient.ts.
 */
export function getColorDistance(hex1: string, hex2: string): number {
  return ColorService.getColorDistance(hex1, hex2);
}

// ============================================================================
// Match Quality
// ============================================================================

/**
 * Match quality metadata (without localized labels).
 *
 * Callers use `key` to look up a translated label via `t.t('quality.<key>')`,
 * and `emoji` for display formatting.
 */
export interface MatchQualityInfo {
  /** Translation key suffix — use with `t.t('quality.<key>')` */
  key: 'perfect' | 'excellent' | 'good' | 'fair' | 'approximate';
  /** Emoji for this quality tier */
  emoji: string;
}

/**
 * Distance thresholds for match quality tiers.
 * Shared across all commands for consistent behavior.
 *
 * Thresholds based on Euclidean distance in RGB space:
 * - 0: Perfect match
 * - <10: Excellent (imperceptible difference)
 * - <25: Good (barely noticeable)
 * - <50: Fair (noticeable but similar)
 * - ≥50: Approximate
 */
const QUALITY_TIERS: readonly { readonly maxDistance: number; readonly info: MatchQualityInfo }[] = [
  { maxDistance: 0, info: { key: 'perfect', emoji: '🎯' } },
  { maxDistance: 10, info: { key: 'excellent', emoji: '✨' } },
  { maxDistance: 25, info: { key: 'good', emoji: '👍' } },
  { maxDistance: 50, info: { key: 'fair', emoji: '⚠️' } },
];

const APPROXIMATE_QUALITY: MatchQualityInfo = { key: 'approximate', emoji: '🔍' };

/**
 * Get match quality metadata for a given color distance.
 *
 * @param distance - RGB Euclidean distance between two colors
 * @returns Quality info with `key` for i18n lookup and `emoji` for display
 *
 * @example
 * const qi = getMatchQualityInfo(8);
 * // qi.key === 'excellent', qi.emoji === '✨'
 * const label = t.t(`quality.${qi.key}`);
 */
export function getMatchQualityInfo(distance: number): MatchQualityInfo {
  for (const { maxDistance, info } of QUALITY_TIERS) {
    if (distance <= maxDistance) {
      return info;
    }
  }
  return APPROXIMATE_QUALITY;
}
