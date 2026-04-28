/**
 * Consolidated dye configuration for Patch 7.5.
 *
 * PATCH DAY (2026-04-28): Replace null itemIDs with real values from datamining.
 * Korean and Chinese localized names should be filled in alongside as they're sourced.
 */

import type { LocaleCode } from '@xivdyetools/types';

export type ConsolidationType = 'A' | 'B' | 'C';

/**
 * Localized name for a consolidated dye.
 * `ko` and `zh` start as `null` until translations are sourced — `getConsolidatedDyeName`
 * falls back to English in that case.
 */
export interface LocalizedDyeName {
  en: string;
  ja: string;
  de: string;
  fr: string;
  ko: string | null;
  zh: string | null;
}

export interface ConsolidatedDye {
  itemID: number | null;
  names: LocalizedDyeName;
  acquisition: string;
  price: number;
  currency: string;
}

export const CONSOLIDATED_IDS: Record<ConsolidationType, number | null> = {
  A: 52254, // Standard Spectrum Dye — covers the 85 ARR dyes (itemIDs 5729-5813)
  B: 52255, // Wide Spectrum #1 Dye — covers the 9 Ishgardian Restoration dyes (itemIDs 30116-30124)
  C: 52256, // Wide Spectrum #2 Dye — covers the 11 Cosmic Exploration dyes (itemIDs 48163-48172, 48227)
};

/**
 * Full metadata for the three consolidated dye items shipped in Patch 7.5.
 * `itemID` mirrors `CONSOLIDATED_IDS` and is filled on patch day.
 */
export const CONSOLIDATED_DYES: Record<ConsolidationType, ConsolidatedDye> = {
  A: {
    itemID: CONSOLIDATED_IDS.A,
    names: {
      en: 'Standard Spectrum Dye',
      ja: 'カララント:ノーマルカラー',
      de: 'Einfacher Farbstoff',
      fr: 'Teinture standard',
      ko: null,
      zh: null,
    },
    acquisition: 'Dye Vendor',
    price: 216,
    currency: 'Gil',
  },
  B: {
    itemID: CONSOLIDATED_IDS.B,
    names: {
      en: 'Wide Spectrum #1 Dye',
      ja: 'カララント:アディショナルカラー1',
      de: 'Zusatzfarbstoff 1',
      fr: 'Teinture additionnelle n°1',
      ko: null,
      zh: null,
    },
    acquisition: 'The Firmament',
    price: 1000,
    currency: "Sky Builders' Scrips",
  },
  C: {
    itemID: CONSOLIDATED_IDS.C,
    names: {
      en: 'Wide Spectrum #2 Dye',
      ja: 'カララント:アディショナルカラー2',
      de: 'Zusatzfarbstoff 2',
      fr: 'Teinture additionnelle n°2',
      ko: null,
      zh: null,
    },
    acquisition: 'Cosmic Exploration',
    price: 600,
    currency: 'Cosmocredits',
  },
};

/**
 * Whether dye consolidation is active (all IDs are known).
 * Returns true only when all three consolidated IDs have been set.
 */
export function isConsolidationActive(): boolean {
  return (
    CONSOLIDATED_IDS.A !== null &&
    CONSOLIDATED_IDS.B !== null &&
    CONSOLIDATED_IDS.C !== null
  );
}

/**
 * Get the market board item ID for a dye.
 *
 * - If consolidation is active and the dye has a consolidationType, returns the consolidated ID.
 * - Otherwise returns the dye's original itemID.
 * - Facewear dyes (negative IDs) always return the original ID.
 */
export function getMarketItemID(dye: {
  itemID: number;
  consolidationType: ConsolidationType | null;
}): number {
  if (dye.itemID < 0) return dye.itemID; // Facewear
  if (!dye.consolidationType) return dye.itemID; // Special/uncategorized
  if (!isConsolidationActive()) return dye.itemID; // Pre-patch fallback
  return CONSOLIDATED_IDS[dye.consolidationType]!;
}

/**
 * Get the localized display name for a consolidated dye.
 * Falls back to English when the requested locale's translation is `null`
 * (currently the case for `ko` and `zh` until names are sourced).
 */
export function getConsolidatedDyeName(type: ConsolidationType, locale: LocaleCode): string {
  const names = CONSOLIDATED_DYES[type].names;
  return names[locale] ?? names.en;
}
