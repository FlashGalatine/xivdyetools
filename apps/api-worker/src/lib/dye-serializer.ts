/**
 * Transforms internal Dye objects into the public API response shape.
 * Strips internal fields (nameLower, categoryLower, lab) and adds marketItemID.
 */

import { LocalizationService } from '@xivdyetools/core';
import type { LocaleCode } from '@xivdyetools/types';
import type { Dye } from '@xivdyetools/types';
import { getMarketItemID } from '@xivdyetools/core';

export interface ApiDye {
  itemID: number;
  stainID: number | null;
  id: number;
  name: string;
  localizedName?: string;
  hex: string;
  rgb: { r: number; g: number; b: number };
  hsv: { h: number; s: number; v: number };
  category: string;
  acquisition: string;
  cost: number;
  currency: string | null;
  isMetallic: boolean;
  isPastel: boolean;
  isDark: boolean;
  isCosmic: boolean;
  isIshgardian: boolean;
  consolidationType: 'A' | 'B' | 'C' | null;
  marketItemID: number;
}

export function serializeDye(dye: Dye, localizedName?: string): ApiDye {
  return {
    itemID: dye.itemID,
    stainID: dye.stainID,
    id: dye.id,
    name: dye.name,
    ...(localizedName && { localizedName }),
    hex: dye.hex,
    rgb: { r: dye.rgb.r, g: dye.rgb.g, b: dye.rgb.b },
    hsv: { h: dye.hsv.h, s: dye.hsv.s, v: dye.hsv.v },
    category: dye.category,
    acquisition: dye.acquisition,
    cost: dye.cost,
    currency: dye.currency,
    isMetallic: dye.isMetallic,
    isPastel: dye.isPastel,
    isDark: dye.isDark,
    isCosmic: dye.isCosmic,
    isIshgardian: dye.isIshgardian,
    consolidationType: dye.consolidationType,
    marketItemID: getMarketItemID(dye),
  };
}

/** Serialize a dye with a pre-calculated distance value (for match endpoints). */
export function serializeDyeWithDistance(
  dye: Dye,
  distance: number,
  localizedName?: string,
): { dye: ApiDye; distance: number } {
  return {
    dye: serializeDye(dye, localizedName),
    distance: Math.round(distance * 10000) / 10000,
  };
}

/**
 * Resolve a dye's localized name for the given request locale.
 *
 * BUG-067 (2026-07-18 audit): Facewear entries carry synthetic negative
 * itemIDs which are not keys in the locale dye-name maps — no localized names
 * exist for them, so the lookup is skipped (documented in api-docs). English
 * requests skip the lookup entirely (the canonical name is on Dye.name).
 * BUG-006: the locale is passed explicitly — never read from singleton state.
 */
export function localizedNameFor(dye: Dye, locale: string): string | undefined {
  if (locale === 'en') return undefined;
  if (dye.itemID < 0) return undefined; // Facewear — see BUG-067
  return LocalizationService.getDyeName(dye.itemID, locale as LocaleCode) || undefined;
}
