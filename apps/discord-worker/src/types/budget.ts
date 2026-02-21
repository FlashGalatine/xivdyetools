/**
 * Budget Types
 *
 * Type definitions for the budget dye finder feature.
 * Helps users find affordable alternatives to expensive dyes.
 *
 * @module types/budget
 */

import type { Dye, PriceData } from '@xivdyetools/types';

// ============================================================================
// PRICE DATA TYPES
// ============================================================================

/**
 * Extended price data with world/datacenter context
 *
 * Extends the base PriceData with additional context needed for
 * the budget finder feature.
 */
export interface DyePriceData extends PriceData {
  /** World or datacenter where the price was fetched */
  world: string;

  /** Number of active listings */
  listingCount: number;

  /** ISO timestamp of when the price was fetched */
  fetchedAt: string;
}

/**
 * Cached price entry stored in KV
 */
export interface CachedPriceEntry {
  /** The price data */
  data: DyePriceData;

  /** When this cache entry was created (ms since epoch) */
  cachedAt: number;
}

// ============================================================================
// BUDGET SUGGESTION TYPES
// ============================================================================

/**
 * A budget-friendly alternative to an expensive dye
 *
 * Combines dye information, pricing, and calculated metrics
 * to help users find cheaper alternatives.
 */
export interface BudgetSuggestion {
  /** The alternative dye */
  dye: Dye;

  /** Market board price info (null if no listings) */
  price: DyePriceData | null;

  /** Color distance from target (lower = more similar) */
  colorDistance: number;

  /** Amount saved compared to target in gil */
  savings: number;

  /** Percentage savings compared to target */
  savingsPercent: number;

  /**
   * Combined value score (lower = better value)
   *
   * Calculated as: (colorDistance * 2) + (price / 1000)
   * This balances color similarity with price.
   */
  valueScore: number;
}

/**
 * Options for the budget find operation
 */
export interface BudgetSearchOptions {
  /** Maximum price to consider in gil (default: no limit) */
  maxPrice?: number;

  /** Maximum color distance from target (default: 50) */
  maxDistance?: number;

  /** How to sort results */
  sortBy?: BudgetSortOption;

  /** Maximum results to return (default: 5) */
  limit?: number;
}

/**
 * Sort options for budget suggestions
 */
export type BudgetSortOption = 'price' | 'color_match' | 'value_score';

/**
 * Result of a budget find operation
 */
export interface BudgetFindResult {
  /** The target dye user wants alternatives for */
  targetDye: Dye;

  /** Target dye's current price (null if no listings) */
  targetPrice: DyePriceData | null;

  /** List of cheaper alternatives */
  alternatives: BudgetSuggestion[];

  /** World/datacenter used for price lookup */
  world: string;

  /** Search options that were applied */
  searchOptions: BudgetSearchOptions;

  /** When prices were last updated (ISO timestamp) */
  pricesAsOf: string;
}

// ============================================================================
// USER PREFERENCE TYPES
// ============================================================================

/**
 * User's saved world/datacenter preference
 */
export interface UserWorldPreference {
  /** World name or datacenter */
  world: string;

  /** When this preference was set (ISO timestamp) */
  setAt: string;
}

// ============================================================================
// QUICK PICK TYPES
// ============================================================================

/**
 * Quick pick preset for popular expensive dyes
 */
export interface QuickPickPreset {
  /** Unique identifier (e.g., 'pure_white') */
  id: string;

  /** Display name */
  name: string;

  /** The expensive dye's item ID */
  targetDyeId: number;

  /** Description of why this is a popular pick */
  description: string;

  /** Emoji for Discord display */
  emoji: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Custom error for Universalis API errors
 */
export class UniversalisError extends Error {
  /** HTTP status code from Universalis */
  public readonly status: number;

  /** Whether this was a rate limit error */
  public readonly isRateLimited: boolean;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'UniversalisError';
    this.status = status;
    this.isRateLimited = status === 429;
  }
}

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * Sort option display metadata
 */
export const SORT_DISPLAY: Record<BudgetSortOption, { label: string; description: string }> = {
  price: {
    label: 'Lowest Price',
    description: 'Cheapest alternatives first',
  },
  color_match: {
    label: 'Best Color Match',
    description: 'Most similar colors first',
  },
  value_score: {
    label: 'Best Value',
    description: 'Balance of price and color match',
  },
};

/**
 * Color distance quality labels
 */
export function getDistanceQuality(distance: number): { label: string; emoji: string } {
  if (distance === 0) return { label: 'Perfect', emoji: '🎯' };
  if (distance < 10) return { label: 'Excellent', emoji: '✨' };
  if (distance < 25) return { label: 'Good', emoji: '👍' };
  if (distance < 50) return { label: 'Fair', emoji: '👌' };
  return { label: 'Approximate', emoji: '🔍' };
}

/**
 * Format gil amount with commas
 */
export function formatGil(amount: number): string {
  return amount.toLocaleString('en-US');
}
