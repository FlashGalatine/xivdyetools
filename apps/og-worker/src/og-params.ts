/**
 * Share-URL parameter vocabularies and parsers — ONE source for the two
 * surfaces that read them: the crawler (og-data-generator.ts, which echoes
 * values into og:title / og:description / og:url / og:image on the production
 * domain) and the image routes (index.ts, which 400 on anything outside these
 * lists).
 *
 * FINDING-024 (2026-08-21 security audit, OG-2 / OG-6): the crawler used to
 * take `?harmony=`, `?vision=`, `?sheet=`, `?race=`, `?gender=`, `?hex=`,
 * `?steps=`, `?ratio=`, `?limit=` unvalidated (escaped, so no XSS — but a
 * share link could put "free gil giveaway at evil.example" into a preview
 * title under the real xivdyetools.app domain, and emit an image URL the
 * image route would reject). Everything is validated here first; unknown
 * values fall back to the parameter's default, or the tool default card.
 *
 * @module og-params
 */

import { isValidBlendingMode, type BlendingMode } from '@xivdyetools/core/blending';
import { parseColorWheelId, type ColorWheelId } from '@xivdyetools/core';
import type { GradientInterpolation } from './services/svg/gradient';
import type { CharacterGender, ColorSheetCategory, HarmonyType, MatchingAlgorithm, VisionType } from './types';

// ============================================================================
// Bounds (FINDING-003 — formerly local to index.ts)
// ============================================================================

export const OG_MIN_GRADIENT_STEPS = 2;
export const OG_MAX_GRADIENT_STEPS = 20;
/**
 * The Gradient Builder's own step range and default (gradient-tool
 * `STEP_MIN` / `STEP_MAX`, `DEFAULT_CONFIGS.gradient.stepCount`) — what the
 * crawler reads a share by (BUG-008). Inside the image route's 2–20 above,
 * which stays the bound for direct URLs.
 */
const PAGE_MIN_GRADIENT_STEPS = 3;
const PAGE_MAX_GRADIENT_STEPS = 12;
export const OG_DEFAULT_GRADIENT_STEPS = 8;
export const OG_MIN_MIXER_RATIO = 1;
export const OG_MAX_MIXER_RATIO = 99;
export const OG_MAX_SWATCH_LIMIT = 20;
export const OG_MAX_COMPARISON_DYES = 16;

// ============================================================================
// Enumerations (BUG-002 — formerly local to index.ts)
// ============================================================================

const VALID_HARMONY_TYPES: readonly string[] = [
  'complementary',
  'analogous',
  'triadic',
  'split-complementary',
  'tetradic',
  'inverted-tetradic',
  'square',
  'monochromatic',
  'compound',
  'shades',
] satisfies readonly HarmonyType[];

/** The 5.0 vocabulary + the legacy spellings `normalizeMatchingMethod` accepts. */
const VALID_ALGORITHMS: readonly string[] = [
  'ciede2000',
  'oklab',
  'cie76',
  'redmean',
  'rgb',
  'distinguish',
  // legacy (normalised on use)
  'euclidean',
  'hyab',
  'oklch-weighted',
];

const VALID_VISION_TYPES: readonly string[] = [
  'normal',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
] satisfies readonly VisionType[];

const VALID_SHEETS: readonly string[] = [
  'eyeColors',
  'highlightColors',
  'lipColorsDark',
  'lipColorsLight',
  'tattooColors',
  'facePaintColorsDark',
  'facePaintColorsLight',
  'hairColors',
  'skinColors',
] satisfies readonly ColorSheetCategory[];

/** The Gradient Builder's five interpolation modes (web-app `InterpolationMode`). */
const VALID_INTERPOLATIONS: readonly string[] = [
  'rgb',
  'hsv',
  'lab',
  'oklch',
  'lch',
] satisfies readonly GradientInterpolation[];

/** The page's default mode (`DEFAULT_CONFIGS.gradient`) — and `generateGradientOG`'s. */
export const DEFAULT_GRADIENT_INTERPOLATION: GradientInterpolation = 'hsv';

export function isHarmonyType(value: string): value is HarmonyType {
  return VALID_HARMONY_TYPES.includes(value);
}

export function isAlgorithm(value: string): boolean {
  return VALID_ALGORITHMS.includes(value);
}

export function isVisionType(value: string): value is VisionType {
  return VALID_VISION_TYPES.includes(value);
}

export function isSheet(value: string): value is ColorSheetCategory {
  return VALID_SHEETS.includes(value);
}

// ============================================================================
// Parsers for the crawler's query string
// ============================================================================

/**
 * A known algorithm spelling (legacy ones included — `withAlgo` normalises
 * them before anything is emitted); anything else is dropped, never echoed.
 */
export function parseAlgo(raw: string | null): MatchingAlgorithm | undefined {
  return raw && isAlgorithm(raw) ? (raw as MatchingAlgorithm) : undefined;
}

/**
 * `?wheel=` → a core wheel id, or undefined for absent/empty/unknown (the
 * guard already 400s unknown). Straight through to core's one normaliser, so
 * this worker cannot fold case differently from the web app or the bot.
 */
export function parseWheel(raw: string | null): ColorWheelId | undefined {
  return parseColorWheelId(raw);
}

/**
 * The web mixer's `?mode=` — which of the six algorithms mixed the colours.
 * Anything unrecognised is dropped, letting the card apply the web tool's own
 * default rather than 404 a link somebody already shared.
 */
export function parseMode(raw: string | null): BlendingMode | undefined {
  return raw && isValidBlendingMode(raw) ? raw : undefined;
}

/**
 * The Gradient Builder's `?interpolation=` (BUG-008): one of its five modes,
 * spelled exactly. The page's `isInterpolationMode` is a case-sensitive
 * membership test — unlike `wheel`, nothing folds — so `LAB` keeps the
 * reader's own setting there and is dropped here, never echoed.
 */
export function parseInterpolation(raw: string | null | undefined): GradientInterpolation | undefined {
  return raw && VALID_INTERPOLATIONS.includes(raw) ? (raw as GradientInterpolation) : undefined;
}

/**
 * A gradient share's `?steps=` exactly as the page applies it (BUG-008):
 * ShareService.parseUrl makes a number only of a canonical decimal spelling
 * (`String(parseFloat(v)) === v`, so `05`, `5.0`, `+5`, `1e1` stay strings),
 * and gradient-tool then takes a whole number in 3–12. Anything else is
 * undefined — the page keeps the reader's saved count, by default 8.
 */
export function parseShareSteps(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const n = parseFloat(raw);
  return String(n) === raw &&
    Number.isInteger(n) &&
    n >= PAGE_MIN_GRADIENT_STEPS &&
    n <= PAGE_MAX_GRADIENT_STEPS
    ? n
    : undefined;
}

/** `Male` / `Female`, case-insensitively; anything else is dropped. */
export function parseGender(raw: string | null): CharacterGender | undefined {
  if (!raw) return undefined;
  const g = raw.toLowerCase();
  return g === 'male' ? 'Male' : g === 'female' ? 'Female' : undefined;
}

/** `RRGGBB` / `#RRGGBB` in any case → upper-case `RRGGBB`; anything else → null. */
export function parseHexColor(raw: string | null): string | null {
  if (!raw) return null;
  const match = /^#?([0-9A-Fa-f]{6})$/.exec(raw);
  return match ? match[1].toUpperCase() : null;
}

/** An integer in [min, max]: NaN → `fallback`, out of range → clamped. */
export function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  const n = raw === null ? NaN : parseInt(raw, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Comma-separated stainIDs: integers only, capped at the image routes' maximum. */
export function parseDyeIdList(raw: string | null): number[] {
  return (raw ?? '')
    .split(',')
    .map((id) => parseInt(id, 10))
    .filter((id) => !Number.isNaN(id))
    .slice(0, OG_MAX_COMPARISON_DYES);
}
