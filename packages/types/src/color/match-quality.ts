/**
 * Match-quality tiers for color-distance classification.
 *
 * REFACTOR-004 (2026-07-18 audit): single source of truth for the RGB-distance
 * quality thresholds, previously duplicated four times across
 * `@xivdyetools/bot-logic` and `@xivdyetools/svg` with inconsistent boundary
 * operators (a distance of exactly 10 was "excellent" in one copy and "good"
 * in another, so a Discord embed and its attached image could disagree about
 * the same match). Semantics are standardized on INCLUSIVE boundaries
 * (`distance <= maxDistance`, bot-logic's original behavior).
 *
 * Thresholds are Euclidean distance in RGB space (max possible ~441):
 * - 0: perfect match
 * - ≤10: excellent (imperceptible difference)
 * - ≤25: good (barely noticeable)
 * - ≤50: fair (noticeable but similar)
 * - >50: approximate
 */

/** Quality tier key — display metadata (labels, emoji) lives per package. */
export type MatchQualityKey = 'perfect' | 'excellent' | 'good' | 'fair' | 'approximate';

/** Ordered quality tiers with inclusive upper bounds. */
export const MATCH_QUALITY_TIERS: readonly {
  readonly key: MatchQualityKey;
  readonly maxDistance: number;
}[] = [
  { key: 'perfect', maxDistance: 0 },
  { key: 'excellent', maxDistance: 10 },
  { key: 'good', maxDistance: 25 },
  { key: 'fair', maxDistance: 50 },
  { key: 'approximate', maxDistance: Infinity },
] as const;

/**
 * Classify an RGB-space color distance into a quality tier.
 * Boundaries are inclusive: exactly 10 → 'excellent', exactly 25 → 'good'.
 */
export function classifyMatchDistance(distance: number): MatchQualityKey {
  for (const tier of MATCH_QUALITY_TIERS) {
    if (distance <= tier.maxDistance) {
      return tier.key;
    }
  }
  return 'approximate';
}
