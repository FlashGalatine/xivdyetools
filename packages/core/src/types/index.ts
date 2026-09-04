/**
 * @xivdyetools/core - Core-Specific Type Definitions
 *
 * Color matching algorithm types defined by core.
 * For shared types (Dye, RGB, etc.), import from '@xivdyetools/types'.
 *
 * @module types
 */

// ============================================================================
// Color Matching Types (core-specific)
// ============================================================================

/**
 * The 5.0 matching vocabulary — one list suite-wide (web, Discord bot,
 * og-worker, public API). Stored choice values; identifiers never localise.
 *
 * - ciede2000: ΔE2000 — industry-standard perceptual formula (**the default
 *   everywhere**)
 * - oklab: ΔEOK2 — OKLAB Euclidean, a/b scaled x2 per CSS Color 4 §20.4
 *   (prints raw, dp 3)
 * - cie76: ΔE76 — CIELAB Euclidean
 * - redmean: REDMEAN — weighted RGB approximation
 * - rgb: RGB DIST — Euclidean RGB distance
 * - distinguish: DISTINGUISH % — RGB DIST rescaled to 0-100. Kept
 *   deliberately for continuity with the Accessibility readout; identical
 *   ranks to RGB DIST by construction. Display rounding creates ties —
 *   orderings driven by the displayed value badge TIE, never imply a single
 *   answer.
 *
 * RATIO (WCAG contrast) is the seventh *display* entry only where the tool
 *   measures it (Accessibility Checker, Dye Comparison) — it is not a
 *   distance and never ranks dye matches, so it is not a MatchingMethod.
 *
 * The v4 methods `hyab` and `oklch-weighted` are retired; stored values
 * migrate through {@link normalizeMatchingMethod}.
 */
export type MatchingMethod = 'ciede2000' | 'oklab' | 'cie76' | 'redmean' | 'rgb' | 'distinguish';

/** Suite display order: ΔE2000 · ΔEOK2 · ΔE76 · REDMEAN · RGB DIST · DISTINGUISH % */
export const MATCHING_METHODS: readonly MatchingMethod[] = [
  'ciede2000',
  'oklab',
  'cie76',
  'redmean',
  'rgb',
  'distinguish',
];

/** ΔE2000 is the default everywhere — one answer to "what does CLOSE mean". */
export const DEFAULT_MATCHING_METHOD: MatchingMethod = 'ciede2000';

/**
 * Method display tags (the short-key vocabulary; `ratio` included for the
 * two tools that print it). Tags are identifiers — never localise them.
 */
export const MATCHING_METHOD_TAGS: Record<MatchingMethod | 'ratio', string> = {
  ciede2000: 'ΔE2000',
  oklab: 'ΔEOK2',
  cie76: 'ΔE76',
  redmean: 'REDMEAN',
  rgb: 'RGB DIST',
  distinguish: 'DISTINGUISH %',
  ratio: 'RATIO',
};

/**
 * Retired v4 stored values → their 5.0 replacement. Both retired methods
 * fold into the suite default (there is no perceptual successor that keeps
 * their exact behaviour, and a silently different non-default would be
 * worse than the default).
 */
export const LEGACY_MATCHING_METHOD_MAP: Record<string, MatchingMethod> = {
  hyab: 'ciede2000',
  'oklch-weighted': 'ciede2000',
  // Pre-5.0 deep links used 'euclidean' informally for RGB distance
  euclidean: 'rgb',
};

/** Type guard for the 5.0 vocabulary. */
export function isMatchingMethod(value: unknown): value is MatchingMethod {
  return typeof value === 'string' && (MATCHING_METHODS as readonly string[]).includes(value);
}

/**
 * Normalize any stored/parsed method value (KV preference, localStorage,
 * URL `algo` param, API body) into the 5.0 vocabulary: current values pass
 * through, retired values map, anything else falls back to the default.
 */
/**
 * BUG-011: `value in OBJ` and `OBJ[value]` both walk `Object.prototype`, so
 * `'constructor'`, `'toString'` and `'__proto__'` looked like legacy method
 * names and returned a FUNCTION typed as a `MatchingMethod`. This normalizer is
 * applied at every ingress — KV preference, localStorage, the URL `algo` param,
 * API bodies — and its whole contract is "anything else falls back to the
 * default", so a crafted value propagated a function into the matching method
 * and `getDistanceForMethod`'s exhaustive switch then returned `undefined`.
 *
 * `Object.hasOwn` is the fix rather than a `Map` because
 * `LEGACY_MATCHING_METHOD_MAP` is a published export; changing its type would
 * be a breaking change for a defect that needs a guard, not a new shape.
 */
export function normalizeMatchingMethod(value: unknown): MatchingMethod {
  if (isMatchingMethod(value)) return value;
  if (typeof value === 'string' && Object.hasOwn(LEGACY_MATCHING_METHOD_MAP, value)) {
    return LEGACY_MATCHING_METHOD_MAP[value];
  }
  return DEFAULT_MATCHING_METHOD;
}
