/**
 * Transforms internal Dye objects into the public API response shape.
 * Strips internal fields (nameLower, categoryLower, lab) and adds marketItemID.
 */

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
