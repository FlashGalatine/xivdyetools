/**
 * Budget Types
 *
 * Type definitions for the budget dye finder feature.
 * Helps users find affordable alternatives to expensive dyes.
 *
 * @module types/budget
 */

import type { Dye, PriceData } from '@xivdyetools/types';
import type { ConsolidationType, MatchingMethod } from '@xivdyetools/core';

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
// 13G LEDGER TYPES (5.0)
// ============================================================================

/**
 * Options for the ledger build. The old `maxPrice`/`sortBy`/`limit` are gone:
 * the ledger's sort IS the gil/ΔE ratio (a PNG cannot re-sort), and the row
 * cap belongs to the frame.
 */
export interface LedgerSearchOptions {
  /** Matching method for the ΔE column (default ciede2000) */
  method?: MatchingMethod;

  /** Match line, ΔE2000 only (2–20, default 8) — other methods pin to their
   *  calibrated MATCH middle cut */
  matchLine?: number;

  /** Remove the Venture Coffers group (gacha — no purchasable source) */
  excludeCoffers?: boolean;

  /** Remove Wide Spectrum #1 + #2 (types B/C — a different acquisition path) */
  excludeWideSpectrum?: boolean;
}

/** A priceless candidate row — the price lives on its group. */
export interface LedgerRowResult {
  dye: Dye;

  /** Distance in the chosen method's native unit */
  de: number;

  /** Pinned ΔE2000 (drives the ratio + sort fallback) */
  de2000: number;

  /** gil per ΔE2000 point — null when target or group has no price */
  perDe: number | null;

  /** DISTINGUISH % integer tie (amber in the frame, ΔE2000 breaks the sort) */
  tie?: boolean;
}

/** One pricing-path group: A/B/C consolidated item or a board-only listing. */
export interface LedgerGroupResult {
  /** 'A' | 'B' | 'C' | 'x{itemID}' */
  key: string;

  type: ConsolidationType | null;

  /** Verbatim EN Spectrum item name for A/B/C; the raw acquisition otherwise
   *  (the handler localizes board-only labels) */
  label: string;

  /** Raw acquisition for board-only groups, null for A/B/C */
  acquisition: string | null;

  /** The group's single gil figure, or null (offline board-only) */
  price: number | null;

  /** A's vendor 216 undercuts the board listing */
  vendorCheaper: boolean;

  rows: LedgerRowResult[];
}

/** Result of a 13G ledger build. */
export interface BudgetLedgerFindResult {
  targetDye: Dye;

  /** The target's group-rule price in gil, or null — blanks, never inventions */
  targetPrice: number | null;

  targetPriceSource: 'vendor' | 'board' | null;

  /** Target is priced and nothing undercuts it → sentence, not an empty frame */
  alreadyFloor: boolean;

  groups: LedgerGroupResult[];

  /** Rows dropped by the pixel cap, named in the embed */
  omitted: Array<{ itemID: number; name: string }>;

  method: MatchingMethod;
  matchLine: number;
  world: string;

  /** When prices were last updated (ISO timestamp) */
  pricesAsOf: string;

  /** OPT-006: true when prices were served from stale cache (Universalis down) */
  pricesStale?: boolean;
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
