/**
 * XIV Dye Tools OpenGraph Worker - Type Definitions
 *
 * @module types
 */

import type { LocaleCode } from '@xivdyetools/types';
import type { AnalyticsEngineDataset } from '@cloudflare/workers-types';
import type { VisionType } from '@xivdyetools/types';

// ============================================================================
// Environment Bindings
// ============================================================================

export interface Env {
  // Environment variables
  APP_BASE_URL: string;
  OG_IMAGE_BASE_URL: string;

  // Analytics Engine binding
  ANALYTICS?: AnalyticsEngineDataset;
}

// ============================================================================
// Tool Types
// ============================================================================

export type ToolId =
  | 'harmony'
  | 'gradient'
  | 'mixer'
  | 'swatch'
  | 'comparison'
  | 'accessibility'
  | 'extractor'
  | 'presets'
  | 'budget';

export type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'
  | 'inverted-tetradic'
  | 'square'
  | 'monochromatic'
  | 'compound'
  | 'shades';

// 5.0: the shared matching vocabulary. Legacy URL values like 'euclidean' are
// accepted by the routes' VALID_ALGORITHMS and normalised where the distance is
// computed (dye-helpers.deltaForAlgorithm → normalizeMatchingMethod).
export type MatchingAlgorithm = import('@xivdyetools/core').MatchingMethod;

/** The six mixing algorithms — core's blending vocabulary, verbatim. */
export type BlendingMode = import('@xivdyetools/core/blending').BlendingMode;

// The five lenses are core's vocabulary — one type, no casts at the seams.
export type { VisionType };

// ============================================================================
// OpenGraph Data
// ============================================================================

export interface OGData {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  siteName: string;
  themeColor?: string;
  /** The locale the copy was authored in — `<html lang>` / `og:locale`. Defaults to `en`. */
  locale?: LocaleCode;
}

// ============================================================================
// Tool-Specific Share Parameters
// ============================================================================

export interface HarmonyParams {
  dye: number; // stainID
  harmony: HarmonyType;
  algo?: MatchingAlgorithm;
}

export interface GradientParams {
  start: number; // stainID
  end: number; // stainID
  steps: number;
  algo?: MatchingAlgorithm;
}

export interface MixerParams {
  dyeA: number; // stainID
  dyeB: number; // stainID
  dyeC?: number; // stainID (optional third dye)
  ratio: number; // 0-100
  /** Which of the six algorithms mixes the colours — the web mixer's `?mode=` */
  mode?: BlendingMode;
  algo?: MatchingAlgorithm;
}

/** Color sheet category types */
export type ColorSheetCategory =
  | 'eyeColors'
  | 'highlightColors'
  | 'lipColorsDark'
  | 'lipColorsLight'
  | 'tattooColors'
  | 'facePaintColorsDark'
  | 'facePaintColorsLight'
  | 'hairColors'
  | 'skinColors';

/** Gender for race-specific color sheets */
export type CharacterGender = 'Male' | 'Female';

export interface SwatchParams {
  color: string; // hex without #
  algo?: MatchingAlgorithm;
  limit?: number;
  /** Which color sheet this color is from */
  sheet?: ColorSheetCategory;
  /**
   * The cell's index within that sheet — the 5.0 share grammar's identity
   * handle (`?slot=&i=`). Present when the colour was resolved from an
   * address rather than read from a legacy `?hex=`; `og:url` is emitted in
   * whichever grammar the link arrived in (BUG-021).
   */
  cell?: number;
  /** Subrace for race-specific sheets (hairColors, skinColors) */
  race?: string;
  /** Gender for race-specific sheets */
  gender?: CharacterGender;
}

export interface ComparisonParams {
  dyes: number[]; // array of stainIDs (1-4)
}

export interface AccessibilityParams {
  dyes: number[]; // array of stainIDs
  vision?: VisionType;
}

/** 5.0 extractor share: `?colors=RRGGBB,RRGGBB…` (no shares — see ExtractorOGOptions) */
export interface ExtractorParams {
  colors: string[]; // RRGGBB, no #, upper-cased, max 5
  algo?: MatchingAlgorithm;
}

/** 5.0 presets share: the PATH `/presets/:id` (curated slug or `community-<uuid>`) */
export interface PresetsParams {
  id: string | null;
}

/** 5.0 budget share: `?dye=<stainID>` (a `?hex=` bare target has no card) */
export interface BudgetParams {
  dye: number | null; // stainID
}

// ============================================================================
// Crawler Detection
// ============================================================================

export type CrawlerType =
  | 'discord'
  | 'twitter'
  | 'facebook'
  | 'linkedin'
  | 'slack'
  | 'telegram'
  | 'whatsapp'
  | 'other'
  | 'none';

export interface CrawlerInfo {
  isCrawler: boolean;
  type: CrawlerType;
  userAgent: string;
}

// ============================================================================
// Analytics Events
// ============================================================================

export interface AnalyticsEvent {
  event: 'og_request' | 'og_image_request';
  tool: ToolId;
  crawler: CrawlerType;
  timestamp: number;
}
