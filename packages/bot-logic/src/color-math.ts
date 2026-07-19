/**
 * Shared Color Math Utilities
 *
 * Single source of truth for color distance calculation and match quality
 * thresholds, used by match, mixer, and gradient commands.
 *
 * @module color-math
 */

import { ColorService } from '@xivdyetools/core';
import { classifyMatchDistance } from '@xivdyetools/types';
import type { MatchQualityKey } from '@xivdyetools/types';

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
  key: MatchQualityKey;
  /** Emoji for this quality tier */
  emoji: string;
}

/**
 * Emoji display metadata per quality tier. Thresholds live in the shared
 * classifier (`classifyMatchDistance` in `@xivdyetools/types`, REFACTOR-004)
 * so embed text and generated images always agree on quality labels.
 */
const QUALITY_EMOJI: Record<MatchQualityKey, string> = {
  perfect: '🎯',
  excellent: '✨',
  good: '👍',
  fair: '⚠️',
  approximate: '🔍',
};

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
  const key = classifyMatchDistance(distance);
  return { key, emoji: QUALITY_EMOJI[key] };
}
