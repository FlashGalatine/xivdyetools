/**
 * Budget Calculator — the 13G ledger model (5.0).
 *
 * Tier groups carry the single price; rows underneath are priceless. A group
 * is one price source: the three consolidated Spectrum items (A/B/C) or a
 * board-only dye's own listing — so every figure printed is a real listing or
 * the vendor's 216, never an invention. Replaces the 4.x pipeline (raw-RGB
 * distance + `(distance*2 + price/1000)` value score + per-dye prices for
 * consolidated dyes — this pipeline's cousin of the web's
 * `getBudgetComparablePrice` defect).
 *
 * @module services/budget/budget-calculator
 */

import {
  BAND_VOCABULARY,
  ColorService,
  CONSOLIDATED_DYES,
  CONSOLIDATED_IDS,
  getMarketItemID,
  type ConsolidationType,
  type MatchingMethod,
} from '@xivdyetools/core';
import {
  dyeService,
  searchDyesByName,
  findDyeByName,
  getLocalizedDyeName,
  getLocalizedCategory,
  type LocaleCode,
} from '@xivdyetools/bot-logic';
import type { Dye } from '@xivdyetools/types';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { Env } from '../../types/env.js';
import type {
  LedgerSearchOptions,
  LedgerRowResult,
  LedgerGroupResult,
  BudgetLedgerFindResult,
} from '../../types/budget.js';
import { fetchPricesBatched } from './universalis-client.js';
import { fetchWithCache } from './price-cache.js';

// ============================================================================
// Constants (13G pixel budget — mirrors @xivdyetools/svg budget-ledger)
// ============================================================================

/** Default match line (ΔE2000) — the only method whose net the user moves. */
const DEFAULT_MATCH_LINE = 8;

/** Frame budget: 350 − header 43 − column header 27. */
const LEDGER_CONTENT_BUDGET = 350 - 43 - 27;
const GROUP_H = 24;
const ROW_H = 40;
const FOOTER_H = 32;
const FOOTER_2LINE_H = 47;

/** R1 Cap: five rows at full size, whatever the group arithmetic says. */
const ROW_CAP = 5;

/** Tier order for the unranked fallback: Standard first (2.6d user decision). */
const TIER_ORDER: Record<ConsolidationType, number> = { A: 0, B: 1, C: 2 };

// ============================================================================
// Group pricing (the 9C rules)
// ============================================================================

interface GroupPricing {
  price: number | null;
  source: 'vendor' | 'board' | null;
  vendorCheaper: boolean;
}

/**
 * The single price a pricing-path group may print:
 * - A: min(vendor 216, board of 52254); flag when the vendor undercuts.
 *   Offline the vendor price stays — it is local and cannot move.
 * - B/C: the consolidated item's board price is the only gil figure; the
 *   scrip/credit cost is a different currency and is never converted.
 * - Board-only: the dye's own listing, or nothing.
 */
function groupPricing(
  type: ConsolidationType | null,
  ownItemId: number,
  boardPrice: (marketId: number) => number | null,
): GroupPricing {
  if (type === 'A') {
    const vendor = CONSOLIDATED_DYES.A.price;
    const board = boardPrice(CONSOLIDATED_IDS.A!);
    if (board !== null && board < vendor) {
      return { price: board, source: 'board', vendorCheaper: false };
    }
    return { price: vendor, source: 'vendor', vendorCheaper: board !== null && vendor < board };
  }
  if (type === 'B' || type === 'C') {
    const board = boardPrice(CONSOLIDATED_IDS[type]!);
    return { price: board, source: board !== null ? 'board' : null, vendorCheaper: false };
  }
  const board = boardPrice(ownItemId);
  return { price: board, source: board !== null ? 'board' : null, vendorCheaper: false };
}

// ============================================================================
// Core algorithm
// ============================================================================

/**
 * Build the 13G ledger for a target dye.
 *
 * The candidate net is the user's match line under ΔE2000; every other
 * method pins to its calibrated MATCH middle cut (only ΔE2000's bands follow
 * the slider — the standing band rule). gil/ΔE is PINNED to ΔE2000 whatever
 * the method says; when the target has no price the ratio has no numerator
 * and the rows fall back to tier-then-distance order — blanks, never
 * inventions. Exclusions remove whole pricing-path groups; the excluded
 * target itself stays allowed.
 */
export async function findBudgetLedger(
  env: Env,
  targetDyeId: number,
  world: string,
  options: LedgerSearchOptions = {},
  logger?: ExtendedLogger,
): Promise<BudgetLedgerFindResult> {
  const method: MatchingMethod = options.method ?? 'ciede2000';
  const matchLine = Math.max(2, Math.min(20, options.matchLine ?? DEFAULT_MATCH_LINE));
  const threshold = method === 'ciede2000' ? matchLine : BAND_VOCABULARY.match[method].cuts[1];

  const targetDye = resolveTargetDye(targetDyeId);
  if (!targetDye) {
    throw new Error(`Dye not found: ${targetDyeId}`);
  }

  const isExcluded = (dye: Dye): boolean =>
    (options.excludeCoffers === true && dye.acquisition === 'Venture Coffers') ||
    (options.excludeWideSpectrum === true &&
      (dye.consolidationType === 'B' || dye.consolidationType === 'C'));

  // 1. Candidate net (CPU-only pre-filter before any price I/O — OPT-002)
  interface Candidate {
    dye: Dye;
    de: number;
    de2000: number;
    pricing: GroupPricing;
    perDe: number | null;
    tie?: boolean;
  }
  const candidates: Candidate[] = [];
  for (const dye of dyeService.getAllDyes()) {
    if (dye.itemID <= 0 || dye.itemID === targetDye.itemID) continue;
    if (isExcluded(dye)) continue;
    const de = ColorService.getDistanceForMethod(targetDye.hex, dye.hex, method);
    if (de > threshold) continue;
    const de2000 =
      method === 'ciede2000'
        ? de
        : ColorService.getDistanceForMethod(targetDye.hex, dye.hex, 'ciede2000');
    candidates.push({
      dye,
      de,
      de2000,
      pricing: { price: null, source: null, vendorCheaper: false },
      perDe: null,
    });
  }

  // 2. Fetch prices (deduplicated market IDs — consolidated groups collapse)
  const marketIds = new Set<number>([getMarketItemID(targetDye)]);
  for (const c of candidates) marketIds.add(getMarketItemID(c.dye));
  const { prices, stale } = await fetchWithCache(
    world,
    Array.from(marketIds),
    (ids) => fetchPricesBatched(env, world, ids, logger),
    logger,
  );
  const boardPrice = (marketId: number): number | null =>
    prices.get(marketId)?.currentMinPrice ?? null;

  if (logger) {
    logger.info('Budget ledger: candidates priced', {
      method,
      threshold,
      candidates: candidates.length,
      fetched: marketIds.size,
    });
  }

  // 3. Target price by the same group rule as everything else
  const target = groupPricing(targetDye.consolidationType, targetDye.itemID, boardPrice);
  const targetPrice = target.price;

  // 4. Per-row pricing + the pinned ratio
  for (const c of candidates) {
    c.pricing = groupPricing(c.dye.consolidationType, c.dye.itemID, boardPrice);
    c.perDe =
      targetPrice !== null && c.pricing.price !== null
        ? (targetPrice - c.pricing.price) / Math.max(c.de2000, 0.1)
        : null;
  }

  // 5. Cheaper-than-target filter (unpriced rows stay — their column blanks)
  let rows = candidates;
  if (targetPrice !== null) {
    rows = rows.filter((c) => c.pricing.price === null || c.pricing.price < targetPrice);
  }
  const alreadyFloor = targetPrice !== null && rows.length === 0 && candidates.length > 0;

  // 6. Sort: gil/ΔE descending; tier-then-distance when no ratio exists
  const tierRank = (dye: Dye): number =>
    dye.consolidationType ? TIER_ORDER[dye.consolidationType] : 3;
  if (targetPrice !== null) {
    rows.sort((a, b) => {
      const pa = a.perDe ?? -Infinity;
      const pb = b.perDe ?? -Infinity;
      if (pb !== pa) return pb - pa;
      return a.de2000 - b.de2000;
    });
  } else {
    rows.sort((a, b) => tierRank(a.dye) - tierRank(b.dye) || a.de2000 - b.de2000);
  }

  // DISTINGUISH's integer rounding creates ties: badge them (amber in the
  // frame); the sort above already falls back to ΔE2000 beneath the display.
  if (method === 'distinguish') {
    const counts = new Map<number, number>();
    for (const r of rows) {
      const v = Math.round(r.de);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    for (const r of rows) {
      if ((counts.get(Math.round(r.de)) ?? 0) > 1) r.tie = true;
    }
  }

  // 7. Pixel cap: groups materialize as their first row is accepted; a row
  //    that cannot pay for its group header is omitted (named in the embed).
  let budget = LEDGER_CONTENT_BUDGET - (method === 'ciede2000' ? FOOTER_H : FOOTER_2LINE_H);
  const grouped = new Map<string, LedgerGroupResult>();
  const order: string[] = [];
  const omitted: Array<{ itemID: number; name: string }> = [];
  let accepted = 0;
  for (const r of rows) {
    const key = r.dye.consolidationType ?? `x${r.dye.itemID}`;
    const isNew = !grouped.has(key);
    const cost = (isNew ? GROUP_H : 0) + ROW_H;
    if (accepted >= ROW_CAP || cost > budget) {
      omitted.push({ itemID: r.dye.itemID, name: r.dye.name });
      continue;
    }
    budget -= cost;
    accepted++;
    if (isNew) {
      grouped.set(key, {
        key,
        type: r.dye.consolidationType,
        label: r.dye.consolidationType
          ? CONSOLIDATED_DYES[r.dye.consolidationType].names.en
          : r.dye.acquisition,
        acquisition: r.dye.consolidationType ? null : r.dye.acquisition,
        price: r.pricing.price,
        vendorCheaper: r.pricing.vendorCheaper,
        rows: [],
      });
      order.push(key);
    }
    const row: LedgerRowResult = { dye: r.dye, de: r.de, de2000: r.de2000, perDe: r.perDe };
    if (r.tie) row.tie = true;
    grouped.get(key)!.rows.push(row);
  }

  const priceTimestamps = Array.from(prices.values())
    .map((p) => p.fetchedAt)
    .filter(Boolean);
  const pricesAsOf = priceTimestamps.length > 0 ? priceTimestamps[0] : new Date().toISOString();

  return {
    targetDye,
    targetPrice,
    targetPriceSource: target.source,
    alreadyFloor,
    groups: order.map((k) => grouped.get(k)!),
    omitted,
    method,
    matchLine,
    world,
    pricesAsOf,
    pricesStale: stale,
  };
}

// ============================================================================
// Dye Lookup Utilities
// ============================================================================

/**
 * Get a dye by ID
 */
export function getDyeById(id: number): Dye | null {
  return dyeService.getDyeById(id);
}

/**
 * Resolve a numeric target the user (or a quick pick) handed us.
 *
 * 5.0 is stainID-first: the autocomplete offers stainIDs (1–254) and quick
 * picks are keyed by them. A legacy item id (≥ 5729 — what 4.x clients and
 * old habits still type) must keep resolving, and the two ranges are disjoint
 * (the Stain sheet is a byte; item ids start at 5729), so the number itself
 * says which lookup applies. Anything in the gap, zero or negative is nothing.
 */
export function resolveTargetDye(id: number): Dye | null {
  if (!Number.isInteger(id) || id <= 0) return null;
  if (id <= 254) return dyeService.getByStainId(id);
  return dyeService.getDyeById(id);
}

/**
 * Get a dye by name (exact match, case-insensitive)
 *
 * BUG-032 (2026-07-18 audit): Facewear entries (synthetic negative itemIDs)
 * are excluded — budget lookups feed Universalis price fetches, and a
 * negative ID in the batch makes the proxy reject the whole request.
 */
export function getDyeByName(name: string, locale: LocaleCode = 'en'): Dye | null {
  // F-02 (2026-08-20 i18n audit): exact match on the English OR localized name
  const dye = findDyeByName(name, locale);
  return dye && dye.itemID > 0 ? dye : null;
}

/**
 * Get autocomplete suggestions for dye names.
 *
 * F-02: matches English OR the locale's name and labels with the localized
 * name + category. `value` is the stainID (2026-08-29 — it used to be the
 * legacy item id, which showed up verbatim in the command echo); the handler
 * resolves either range through resolveTargetDye.
 */
export function getDyeAutocomplete(
  query: string,
  limit: number = 25,
  locale: LocaleCode = 'en',
): Array<{ name: string; value: string }> {
  const matches = searchDyesByName(query, locale).filter(
    (dye) => dye.itemID > 0 && dye.stainID != null,
  );

  return matches.slice(0, limit).map((dye) => ({
    name: `${getLocalizedDyeName(dye.itemID, dye.name, locale)} (${getLocalizedCategory(dye.category, locale)})`,
    value: String(dye.stainID),
  }));
}
