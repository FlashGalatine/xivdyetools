/**
 * XIV Dye Tools v4.0.0 - Share Service
 *
 * Service for generating shareable deep-link URLs with OpenGraph support.
 * Enables social media sharing with dynamic metadata previews.
 *
 * @module services/share-service
 */

import { ToastService } from './toast-service';
import { logger } from '@shared/logger';
import type { ToolId } from './router-service';
import type { MatchingMethod } from '@xivdyetools/core';
import type { MixingMode, InterpolationMode } from '@shared/tool-config-types';

// Local harmony type definition (matches @components/v4/v4-color-wheel)
type HarmonyType =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split-complementary'
  | 'tetradic'
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
export const SHARE_URL_VERSION = 1;

/**
 * Base URL for the application (production)
 */
export const BASE_URL = 'https://xivdyetools.app';

/**
 * Tool-specific share parameters
 */
export interface HarmonyShareParams {
  dye: number; // itemID
  harmony: HarmonyType;
  algo?: MatchingMethod;
  perceptual?: boolean;
}

export interface GradientShareParams {
  start: number; // itemID
  end: number; // itemID
  steps?: number;
  interpolation?: InterpolationMode;
  algo?: MatchingMethod;
}

export interface MixerShareParams {
  dyeA: number; // itemID
  dyeB: number; // itemID
  dyeC?: number; // itemID (optional third dye)
  ratio?: number; // 0-100 (percentage of dyeA)
  mode?: MixingMode;
  algo?: MatchingMethod;
}

export interface SwatchShareParams {
  color: string; // Hex without #
  algo?: MatchingMethod;
  limit?: number;
}

export interface ComparisonShareParams {
  dyes: number[]; // Array of itemIDs (max 4)
}

export interface AccessibilityShareParams {
  dyes: number[]; // Array of itemIDs
  vision?: string; // Vision type
}

export interface ExtractorShareParams {
  colors?: string[]; // Extracted hex colors
  algo?: MatchingMethod;
}

export interface BudgetShareParams {
  dye: number; // Target dye itemID
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
 * Share analytics event
 */
export interface ShareAnalyticsEvent {
  event: 'share_initiated' | 'share_copied' | 'share_failed';
  tool: ToolId;
  params: Record<string, unknown>;
  timestamp: number;
}

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
 *   params: { dye: 48227, harmony: 'Complementary', algo: 'oklab' }
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
  private static analyticsListeners: Set<(event: ShareAnalyticsEvent) => void> = new Set();

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
    this.addParamsToUrl(url, tool, paramsRecord);

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
  private static addParamsToUrl(
    url: URL,
    tool: ToolId,
    params: Record<string, unknown>
  ): void {
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
  private static generateTitle(
    tool: ToolId,
    params: Record<string, unknown>
  ): string {
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
  private static generateDescription(
    tool: ToolId,
    params: Record<string, unknown>
  ): string {
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
  // URL Parsing
  // ==========================================================================

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

        // Try to parse as number
        const numValue = parseFloat(value);
        if (!isNaN(numValue) && String(numValue) === value) {
          params[key] = numValue;
          return;
        }

        // Check for boolean
        if (value === '1' || value === 'true') {
          params[key] = true;
          return;
        }
        if (value === '0' || value === 'false') {
          params[key] = false;
          return;
        }

        // Check for comma-separated arrays
        if (value.includes(',')) {
          const parts = value.split(',');
          // If all parts are numbers, parse as number array
          const allNumbers = parts.every((p) => !isNaN(parseFloat(p)));
          if (allNumbers) {
            params[key] = parts.map((p) => parseFloat(p));
          } else {
            params[key] = parts;
          }
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
    const params = new URLSearchParams(window.location.search);
    return params.has('v') || params.has('dye') || params.has('color') || params.has('dyes');
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

      ToastService.success('Link copied to clipboard!');

      this.trackAnalytics({
        event: 'share_copied',
        tool: this.parseUrl(url)?.tool || 'harmony',
        params: {},
        timestamp: Date.now(),
      });

      return true;
    } catch (error) {
      logger.error('[ShareService] Failed to copy to clipboard:', error);

      // Fallback: try textarea method
      const success = this.fallbackCopyToClipboard(url);

      if (success) {
        ToastService.success('Link copied to clipboard!');
      } else {
        ToastService.error('Failed to copy link', 'Please copy the URL manually');
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

      this.trackAnalytics({
        event: 'share_initiated',
        tool: shareData.tool,
        params: shareData.params as Record<string, unknown>,
        timestamp: Date.now(),
      });

      return result;
    } catch (error) {
      logger.error('[ShareService] Share failed:', error);

      this.trackAnalytics({
        event: 'share_failed',
        tool: shareData.tool,
        params: shareData.params as Record<string, unknown>,
        timestamp: Date.now(),
      });

      ToastService.error('Failed to generate share link');
      return null;
    }
  }

  // ==========================================================================
  // Analytics
  // ==========================================================================

  /**
   * Subscribe to share analytics events
   * @returns Unsubscribe function
   */
  static subscribeToAnalytics(
    listener: (event: ShareAnalyticsEvent) => void
  ): () => void {
    this.analyticsListeners.add(listener);
    return () => this.analyticsListeners.delete(listener);
  }

  /**
   * Track an analytics event
   */
  private static trackAnalytics(event: ShareAnalyticsEvent): void {
    this.analyticsListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.warn('[ShareService] Analytics listener error:', error);
      }
    });

    // Log for debugging
    logger.info(`[ShareService] Analytics: ${event.event}`, event);
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

    switch (tool) {
      case 'harmony':
        if (!('dye' in params) || !params.dye) {
          errors.push('Missing required parameter: dye');
        }
        if (!('harmony' in params) || !params.harmony) {
          errors.push('Missing required parameter: harmony');
        }
        break;

      case 'gradient':
        if (!('start' in params) || !params.start) {
          errors.push('Missing required parameter: start');
        }
        if (!('end' in params) || !params.end) {
          errors.push('Missing required parameter: end');
        }
        break;

      case 'mixer':
        if (!('dyeA' in params) || !params.dyeA) {
          errors.push('Missing required parameter: dyeA');
        }
        if (!('dyeB' in params) || !params.dyeB) {
          errors.push('Missing required parameter: dyeB');
        }
        break;

      case 'swatch':
        if (!('color' in params) || !params.color) {
          errors.push('Missing required parameter: color');
        }
        break;

      case 'comparison':
        if (!('dyes' in params) || !params.dyes?.length) {
          errors.push('Missing required parameter: dyes');
        }
        break;

      // Other tools may have optional params
    }

    return errors;
  }

  // ==========================================================================
  // Client-Side Analytics Storage
  // ==========================================================================

  private static readonly ANALYTICS_STORAGE_KEY = 'xiv_share_analytics';
  private static readonly MAX_STORED_EVENTS = 100;
  private static analyticsInitialized = false;

  /**
   * Initialize client-side analytics storage
   * Automatically subscribes to share events and persists them
   */
  static initializeAnalytics(): void {
    if (this.analyticsInitialized) return;

    this.subscribeToAnalytics((event) => {
      this.storeAnalyticsEvent(event);
    });

    this.analyticsInitialized = true;
    logger.info('[ShareService] Client-side analytics initialized');
  }

  /**
   * Store an analytics event in localStorage
   */
  private static storeAnalyticsEvent(event: ShareAnalyticsEvent): void {
    try {
      const events = this.getStoredAnalyticsEvents();
      events.push(event);

      // Keep only the most recent events
      if (events.length > this.MAX_STORED_EVENTS) {
        events.splice(0, events.length - this.MAX_STORED_EVENTS);
      }

      localStorage.setItem(this.ANALYTICS_STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      logger.warn('[ShareService] Failed to store analytics event:', error);
    }
  }

  /**
   * Get all stored analytics events
   */
  static getStoredAnalyticsEvents(): ShareAnalyticsEvent[] {
    try {
      const stored = localStorage.getItem(this.ANALYTICS_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as ShareAnalyticsEvent[]) : [];
    } catch {
      return [];
    }
  }

  /**
   * Get share analytics statistics
   */
  static getAnalyticsStats(): {
    totalShares: number;
    sharesByTool: Record<string, number>;
    successRate: number;
    recentShares: ShareAnalyticsEvent[];
  } {
    const events = this.getStoredAnalyticsEvents();

    const initiated = events.filter((e) => e.event === 'share_initiated').length;
    const copied = events.filter((e) => e.event === 'share_copied').length;
    const failed = events.filter((e) => e.event === 'share_failed').length;

    // Count by tool (from initiated events)
    const sharesByTool: Record<string, number> = {};
    events
      .filter((e) => e.event === 'share_initiated')
      .forEach((e) => {
        sharesByTool[e.tool] = (sharesByTool[e.tool] || 0) + 1;
      });

    // Success rate (copied / initiated)
    const successRate = initiated > 0 ? (copied / initiated) * 100 : 0;

    // Get last 10 events
    const recentShares = events.slice(-10).reverse();

    return {
      totalShares: initiated,
      sharesByTool,
      successRate: Math.round(successRate),
      recentShares,
    };
  }

  /**
   * Clear stored analytics data
   */
  static clearAnalyticsData(): void {
    try {
      localStorage.removeItem(this.ANALYTICS_STORAGE_KEY);
      logger.info('[ShareService] Analytics data cleared');
    } catch (error) {
      logger.warn('[ShareService] Failed to clear analytics data:', error);
    }
  }
}
