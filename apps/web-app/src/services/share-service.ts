/**
 * XIV Dye Tools v4.0.0 - Share Service
 *
 * Service for generating shareable deep-link URLs with OpenGraph support.
 * Enables social media sharing with dynamic metadata previews.
 *
 * @module services/share-service
 */

import { ToastService } from './toast-service';
import { LanguageService } from './language-service';
import { dyeService } from './dye-service-wrapper';
import type { Dye } from '@xivdyetools/types';
import { logger } from '@shared/logger';
import type { ToolId } from './router-service';
import type { MatchingMethod, ColorWheelId } from '@xivdyetools/core';
import type { MixingMode, InterpolationMode } from '@shared/tool-config-types';

// Local harmony type definition (matches @components/v4/v4-color-wheel)
type HarmonyType =
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

// ============================================================================
// Types
// ============================================================================

/**
 * Current share URL schema version
 * Increment when making breaking changes to URL structure
 */
const SHARE_URL_VERSION = 1;

/**
 * Base URL for the application (production)
 */
const BASE_URL = 'https://xivdyetools.app';

/**
 * Tool-specific share parameters
 */
/*
 * 5.0 share-URL grammar (atomic across web + og-worker):
 * - Every `dye`-class param keys on **stainID** (1-254). Legacy itemIDs
 *   (>= 5729) are disjoint and rejected loudly on read — never silently
 *   resolved to a fallback dye.
 * - Bare colours travel as `hex`-class params (per slot, RRGGBB without #),
 *   mutually exclusive with the slot's dye param. Validated on read.
 */
export interface HarmonyShareParams {
  dye?: number; // stainID
  hex?: string; // bare colour slot (RRGGBB) — exclusive with `dye`
  harmony: HarmonyType;
  algo?: MatchingMethod;
  perceptual?: boolean;
  wheel?: ColorWheelId; // absent means rgb; never emitted for the default
}

export interface GradientShareParams {
  start?: number; // stainID
  end?: number; // stainID
  hexStart?: string; // bare colour slot — exclusive with `start`
  hexEnd?: string; // bare colour slot — exclusive with `end`
  steps?: number;
  interpolation?: InterpolationMode;
  algo?: MatchingMethod;
}

export interface MixerShareParams {
  dyeA?: number; // stainID
  dyeB?: number; // stainID
  dyeC?: number; // stainID (optional third dye)
  hexA?: string; // bare colour slots — each exclusive with its dye param
  hexB?: string;
  hexC?: string;
  ratio?: number; // 0-100 (percentage of dyeA)
  mode?: MixingMode;
  algo?: MatchingMethod;
}

export interface SwatchShareParams {
  /** Colour sheet (`eyes`, `hair`, `skin`, …) — with `i`, addresses a character swatch cell */
  slot?: string;
  /** Cell index within the sheet (the R·C address derives from it) */
  i?: number;
  /** Bare colour (RRGGBB without #) — the reverse-match form */
  hex?: string;
  /** Legacy read alias for `hex` (pre-5.0 links) */
  color?: string;
  /** Race/gender for the race-specific sheets */
  race?: string;
  gender?: string;
  algo?: MatchingMethod;
  limit?: number;
}

export interface ComparisonShareParams {
  dyes: number[]; // Array of stainIDs (max 4)
}

export interface AccessibilityShareParams {
  dyes: number[]; // Array of stainIDs
  vision?: string; // Vision type
}

export interface ExtractorShareParams {
  colors?: string[]; // Extracted hex colors
  algo?: MatchingMethod;
}

export interface BudgetShareParams {
  dye?: number; // Target dye stainID
  hex?: string; // bare colour target — exclusive with `dye`
  maxPrice?: number;
  maxDelta?: number;
}

/**
 * Union of all share parameter types
 */
export type ShareParams =
  | { tool: 'harmony'; params: HarmonyShareParams }
  | { tool: 'gradient'; params: GradientShareParams }
  | { tool: 'mixer'; params: MixerShareParams }
  | { tool: 'swatch'; params: SwatchShareParams }
  | { tool: 'comparison'; params: ComparisonShareParams }
  | { tool: 'accessibility'; params: AccessibilityShareParams }
  | { tool: 'extractor'; params: ExtractorShareParams }
  | { tool: 'budget'; params: BudgetShareParams };

/**
 * Result of generating a share URL
 */
export interface ShareResult {
  /** The complete shareable URL */
  url: string;
  /** Suggested title for the share */
  title: string;
  /** Suggested description for the share */
  description: string;
  /** Tool that was shared */
  tool: ToolId;
}

/**
 * Parsed share URL data
 */
export interface ParsedShareUrl {
  tool: ToolId;
  version: number;
  params: Record<string, string | number | boolean | string[] | number[]>;
}

/**
 * Share params that are always a list, however many values they carry.
 *
 * BUG-015: without this, arity decided the type — `?dyes=45,102` parsed as a
 * number array and `?dyes=45` as a bare number. Both consumers
 * (`comparison-tool`, `accessibility-tool`) gate on `Array.isArray`, so a
 * single-dye link restored nothing while still loading the page, which reads
 * as "the link works but shows the wrong dyes" rather than as an error.
 *
 * Add a key here whenever a producer can emit a comma-separated list for it.
 */
const LIST_PARAMS = new Set(['dyes']);

// ============================================================================
// Share Service Class
// ============================================================================

/**
 * Service for generating and parsing shareable URLs
 *
 * Usage:
 * ```typescript
 * // Generate a share URL
 * const result = ShareService.generateUrl({
 *   tool: 'harmony',
 *   params: { dye: 102, harmony: 'complementary', algo: 'ciede2000' } // 102 = Jet Black (stainID)
 * });
 *
 * // Copy to clipboard
 * await ShareService.copyToClipboard(result.url);
 *
 * // Parse a share URL
 * const parsed = ShareService.parseUrl(window.location.href);
 * ```
 */
export class ShareService {
  // ==========================================================================
  // URL Generation
  // ==========================================================================

  /**
   * Generate a shareable URL for a tool with specific parameters
   */
  static generateUrl(shareData: ShareParams): ShareResult {
    const { tool, params } = shareData;

    // Build URL
    const url = new URL(`${BASE_URL}/${tool}/`);

    // Cast params to Record for internal methods
    const paramsRecord = params as unknown as Record<string, unknown>;

    // Add tool-specific params
    this.addParamsToUrl(url, paramsRecord);

    // The sharer's locale rides the link so og-worker can localize the unfurl —
    // it resolves locale from `?lang=` and from nothing else (crawlers send no
    // useful Accept-Language). English stays unparameterised: og-worker keeps
    // EN cache keys bare, and the SPA's own routing ignores the param.
    const locale = LanguageService.getCurrentLocale();
    if (locale !== 'en') {
      url.searchParams.set('lang', locale);
    }

    // Add version for future compatibility
    url.searchParams.set('v', String(SHARE_URL_VERSION));

    // Generate title and description
    const title = this.generateTitle(tool, paramsRecord);
    const description = this.generateDescription(tool, paramsRecord);

    logger.info(`[ShareService] Generated URL: ${url.toString()}`);

    return {
      url: url.toString(),
      title,
      description,
      tool,
    };
  }

  /**
   * Add tool-specific parameters to a URL
   */
  private static addParamsToUrl(url: URL, params: Record<string, unknown>): void {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        // Arrays are comma-separated
        url.searchParams.set(key, value.join(','));
      } else if (typeof value === 'boolean') {
        // Booleans: only include if true (or use 1/0)
        url.searchParams.set(key, value ? '1' : '0');
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  }

  /**
   * Generate a human-readable title for the share
   */
  private static generateTitle(tool: ToolId, params: Record<string, unknown>): string {
    switch (tool) {
      case 'harmony': {
        const harmony = params.harmony as string;
        return `${harmony} Harmony | XIV Dye Tools`;
      }
      case 'gradient':
        return 'Dye Gradient | XIV Dye Tools';
      case 'mixer': {
        const ratio = params.ratio as number;
        return ratio !== undefined
          ? `${ratio}/${100 - ratio} Dye Mix | XIV Dye Tools`
          : 'Dye Mix | XIV Dye Tools';
      }
      case 'swatch':
        return 'Color Match | XIV Dye Tools';
      case 'comparison':
        return 'Dye Comparison | XIV Dye Tools';
      case 'accessibility':
        return 'Accessibility Check | XIV Dye Tools';
      case 'extractor':
        return 'Extracted Palette | XIV Dye Tools';
      case 'budget':
        return 'Budget Alternatives | XIV Dye Tools';
      default:
        return 'XIV Dye Tools';
    }
  }

  /**
   * Generate a description for the share
   */
  private static generateDescription(tool: ToolId, params: Record<string, unknown>): string {
    switch (tool) {
      case 'harmony': {
        const harmony = params.harmony as string;
        return `Explore ${harmony?.toLowerCase() || 'color'} harmonies for FFXIV dyes.`;
      }
      case 'gradient':
        return 'See this smooth dye gradient with interpolated color steps.';
      case 'mixer':
        return 'Check out this custom dye blend and its closest matches.';
      case 'swatch':
        return 'Find the closest FFXIV dyes to this color.';
      case 'comparison':
        return 'Compare these FFXIV dyes side by side.';
      case 'accessibility':
        return 'See how these dyes appear with different vision types.';
      case 'extractor':
        return 'Colors extracted from an image matched to FFXIV dyes.';
      case 'budget':
        return 'Affordable dye alternatives for your glamour.';
      default:
        return 'Free dye tools for FFXIV players.';
    }
  }

  // ==========================================================================
  // 5.0 shared-value resolution (stainID grammar, loud failures)
  // ==========================================================================

  /**
   * Resolve a shared `dye`-class param (stainID) to a Dye.
   *
   * Loud-failure contract: a legacy itemID (>= 5729, disjoint from the stain
   * range) or an unknown value produces a visible toast and `null` — never a
   * fallback dye.
   */
  static resolveSharedDye(raw: unknown): Dye | null {
    const id = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(id)) {
      ToastService.error(LanguageService.t('share.invalidDye'));
      return null;
    }
    if (id >= 5729) {
      // The pre-5.0 grammar carried FFXIV item IDs — tell the user instead of
      // guessing (the ranges are disjoint, so this is always detectable).
      ToastService.error(LanguageService.t('share.legacyLink'));
      logger.warn(`[ShareService] Legacy itemID in share URL rejected: ${id}`);
      return null;
    }
    const dye = dyeService.getByStainId(id);
    if (!dye) {
      ToastService.error(LanguageService.t('share.invalidDye'));
      logger.warn(`[ShareService] Unknown stainID in share URL: ${id}`);
      return null;
    }
    return dye;
  }

  /**
   * Validate a shared `hex`-class param. Accepts RRGGBB or RGB (with or
   * without #) and returns a normalized `#rrggbb`, or null with a toast.
   */
  static parseSharedHex(raw: unknown): string | null {
    const normalized = this.normalizeHex(raw);
    if (!normalized) {
      ToastService.error(LanguageService.t('share.invalidHex'));
      return null;
    }
    return normalized;
  }

  /**
   * Pure form of {@link parseSharedHex}: `#rrggbb` for a well-formed value,
   * null otherwise, no toast. An all-digit hex such as `112233` arrives from
   * `parseUrl()` as a number (its canonical decimal form is identical to the
   * hex string), so numbers are stringified rather than rejected.
   */
  private static normalizeHex(raw: unknown): string | null {
    const text =
      typeof raw === 'string'
        ? raw
        : typeof raw === 'number' && Number.isInteger(raw) && raw >= 0
          ? String(raw)
          : null;
    if (text === null) return null;
    const cleaned = text.trim().replace(/^#/, '').toLowerCase();
    if (/^[0-9a-f]{6}$/.test(cleaned)) return `#${cleaned}`;
    if (/^[0-9a-f]{3}$/.test(cleaned)) {
      return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`;
    }
    return null;
  }

  // ==========================================================================
  // URL Parsing
  // ==========================================================================

  /**
   * Split a comma-separated param into a list, numeric when every element
   * round-trips as a number.
   *
   * The `String(n) === part` round trip is what keeps a leading-zero value such
   * as `012345` a string: `parseFloat` alone would silently turn it into 12345,
   * which mangles bare-colour params that happen to start with a digit.
   */
  private static parseListParam(value: string): number[] | string[] {
    const parts = value.split(',');
    const asNumbers = parts.map((p) => parseFloat(p));
    const allNumbers = parts.every((p, i) => !isNaN(asNumbers[i]) && String(asNumbers[i]) === p);
    return allNumbers ? asNumbers : parts;
  }

  /**
   * Parse a share URL and extract tool and parameters
   */
  static parseUrl(urlString: string): ParsedShareUrl | null {
    try {
      const url = new URL(urlString);
      const pathParts = url.pathname.split('/').filter(Boolean);

      if (pathParts.length === 0) return null;

      const tool = pathParts[0] as ToolId;
      const version = parseInt(url.searchParams.get('v') || '1', 10);

      // Parse all query params
      const params: Record<string, string | number | boolean | string[] | number[]> = {};

      url.searchParams.forEach((value, key) => {
        if (key === 'v') return; // Skip version

        // BUG-015: array-ness is a property of the KEY, not of how many values
        // the sender happened to have. `?dyes=45,102` used to parse as a number
        // array while `?dyes=45` parsed as a bare number, and both consumers
        // gate on Array.isArray — so a one-dye Comparison or Accessibility link
        // silently restored nothing and showed the recipient's own dyes.
        if (LIST_PARAMS.has(key)) {
          params[key] = ShareService.parseListParam(value);
          return;
        }

        // Try to parse as number. The round-trip check keeps values that are
        // only incidentally numeric (a leading-zero hex like `012345`) as
        // strings.
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && String(numValue) === value) {
          params[key] = numValue;
          return;
        }

        // Check for boolean. `'1'` and `'0'` never reach here — they satisfy
        // the numeric round trip above and arrive as the numbers 1 and 0, which
        // every consumer reads truthily. Listing them here as booleans was dead
        // code; reordering instead would misread numeric params whose value is
        // legitimately 0 or 1, so the numeric branch keeps priority.
        if (value === 'true') {
          params[key] = true;
          return;
        }
        if (value === 'false') {
          params[key] = false;
          return;
        }

        // Check for comma-separated arrays
        if (value.includes(',')) {
          params[key] = ShareService.parseListParam(value);
          return;
        }

        // Default to string
        params[key] = value;
      });

      return { tool, version, params };
    } catch (error) {
      logger.warn('[ShareService] Failed to parse URL:', error);
      return null;
    }
  }

  /**
   * Check if the current URL is a share URL (has share-specific params)
   */
  static isShareUrl(): boolean {
    // Every URL this service has ever generated carries the `v=` marker, so it
    // is the one reliable signal. `dye=` alone is not: RouterService preserves
    // it across navigations and in-app hand-offs (Budget → Harmony, …) set it,
    // so it survives in the address bar of URLs nobody shared.
    return new URLSearchParams(window.location.search).has('v');
  }

  /**
   * Get share parameters from the current URL
   */
  static getShareParamsFromCurrentUrl(): ParsedShareUrl | null {
    return this.parseUrl(window.location.href);
  }

  // ==========================================================================
  // Clipboard Operations
  // ==========================================================================

  /**
   * Copy a URL to the clipboard and show a toast notification
   */
  static async copyToClipboard(url: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(url);

      ToastService.success(LanguageService.t('share.linkCopied'));

      return true;
    } catch (error) {
      logger.error('[ShareService] Failed to copy to clipboard:', error);

      // Fallback: try textarea method
      const success = this.fallbackCopyToClipboard(url);

      if (success) {
        ToastService.success(LanguageService.t('share.linkCopied'));
      } else {
        ToastService.error(
          LanguageService.t('errors.copyLinkFailed'),
          LanguageService.t('share.copyManually')
        );
      }

      return success;
    }
  }

  /**
   * Fallback clipboard copy using textarea (for older browsers)
   */
  private static fallbackCopyToClipboard(text: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);

    try {
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }

  /**
   * Generate and copy a share URL in one step
   */
  static async shareAndCopy(shareData: ShareParams): Promise<ShareResult | null> {
    try {
      const result = this.generateUrl(shareData);
      const copied = await this.copyToClipboard(result.url);

      if (!copied) {
        return null;
      }

      return result;
    } catch (error) {
      logger.error('[ShareService] Share failed:', error);

      ToastService.error(LanguageService.t('share.generateFailed'));
      return null;
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get the base URL for the application
   */
  static getBaseUrl(): string {
    // In development, use localhost
    if (import.meta.env.DEV) {
      return window.location.origin;
    }
    return BASE_URL;
  }

  /**
   * Validate that required parameters are present for a tool
   */
  static validateShareParams(shareData: ShareParams): string[] {
    const errors: string[] = [];
    const { tool, params } = shareData;
    const record = params as Record<string, unknown>;

    switch (tool) {
      case 'harmony':
        this.validateColourSlot(record, 'dye', 'hex', errors);
        if (!('harmony' in params) || !params.harmony) {
          errors.push('Missing required parameter: harmony');
        }
        break;

      case 'gradient':
        this.validateColourSlot(record, 'start', 'hexStart', errors);
        this.validateColourSlot(record, 'end', 'hexEnd', errors);
        break;

      case 'mixer':
        this.validateColourSlot(record, 'dyeA', 'hexA', errors);
        this.validateColourSlot(record, 'dyeB', 'hexB', errors);
        break;

      case 'swatch': {
        // 5.0 grammar: a character swatch is addressed by its cell (`slot` +
        // `i`); a bare colour rides on `hex` (`color` kept as a legacy read
        // alias). Either form satisfies the link.
        const hasCell =
          typeof record.slot === 'string' &&
          record.slot.length > 0 &&
          Number.isInteger(Number(record.i)) &&
          Number(record.i) >= 0;
        const hexRaw = record.hex ?? record.color;
        const hasHex = hexRaw !== undefined && hexRaw !== null && hexRaw !== '';
        if (!hasCell && !hasHex) {
          errors.push('Missing required parameter: slot + i (or hex)');
        } else if (hasHex && this.parseSharedHex(hexRaw) === null) {
          errors.push(`Invalid hex colour: ${String(hexRaw)}`);
        }
        break;
      }

      case 'comparison':
        if (!('dyes' in params) || !params.dyes?.length) {
          errors.push('Missing required parameter: dyes');
        }
        break;

      // Other tools may have optional params
    }

    return errors;
  }

  /**
   * One colour slot of the 5.0 grammar: satisfied by EITHER its stainID
   * param (a positive number) OR its `hex*` param (well-formed), never both
   * and never neither. Shared by harmony (`dye`/`hex`), gradient
   * (`start`/`hexStart`, `end`/`hexEnd`) and mixer (`dyeA`/`hexA`, `dyeB`/`hexB`).
   */
  private static validateColourSlot(
    params: Record<string, unknown>,
    dyeKey: string,
    hexKey: string,
    errors: string[]
  ): void {
    const dye = params[dyeKey];
    const hex = params[hexKey];
    const hasDye = dye !== undefined && dye !== null && dye !== 0 && dye !== '';
    const hasHex = hex !== undefined && hex !== null && hex !== '';

    if (hasDye && hasHex) {
      errors.push(`Conflicting parameters: ${dyeKey} and ${hexKey} are mutually exclusive`);
      return;
    }
    if (hasHex) {
      if (!this.normalizeHex(hex)) {
        errors.push(`Invalid parameter: ${hexKey} must be RRGGBB`);
      }
      return;
    }
    if (!hasDye) {
      errors.push(`Missing required parameter: ${dyeKey}`);
    }
  }
}
