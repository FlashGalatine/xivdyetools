/**
 * Shared "custom dye" factory.
 *
 * Seven tools each wrap a bare hex colour picked from the Custom Color
 * drawer (or a `hexStart`/`hexEnd`-style share param) in a virtual `Dye` so
 * the rest of the tool can treat it like any other database entry —
 * negative synthetic id, no stainID, `category`/`acquisition` set to a
 * sentinel string. Every one of those tools hand-rolled the same object
 * shape with a hardcoded English `"Custom (#HEX)"` name. This module is the
 * single source of truth for that shape, with the name routed through
 * `LanguageService` so it localizes.
 *
 * @module shared/custom-dye
 */

import { ColorService } from '@xivdyetools/core';
import type { Dye } from '@xivdyetools/types';
import { LanguageService } from '@services/language-service';

/**
 * Sentinel value used for a custom dye's `category` and `acquisition`
 * fields. Render sites should check for this with {@link isCustomDye} and
 * substitute {@link customDyeLabel} rather than displaying it directly.
 */
export const CUSTOM_DYE_SENTINEL = '__custom__' as const;

/** Monotonic suffix so two custom dyes minted in the same millisecond (e.g. `hexStart` + `hexEnd` from one share link) get distinct synthetic ids. */
let customDyeSequence = 0;

/**
 * Wrap a bare hex colour in a virtual "dye" (negative id, no stainID) so
 * the rest of a tool can treat it like any other endpoint.
 *
 * Mirrors the shape every tool's local `createCustomDye` built by hand
 * (see `gradient-tool.ts` / `mixer-tool.ts`), except the name is localized
 * via `LanguageService.tInterpolate('common.customColorName', ...)` and
 * `category`/`acquisition` use {@link CUSTOM_DYE_SENTINEL} instead of the
 * literal string `'Custom'`.
 */
export function makeCustomDye(hex: string): Dye {
  const syntheticId = -(Date.now() + ++customDyeSequence);
  return {
    id: syntheticId,
    itemID: syntheticId,
    stainID: null, // Custom colors don't have a stain ID
    name: LanguageService.tInterpolate('common.customColorName', { hex: hex.toUpperCase() }),
    hex: hex.toUpperCase(),
    rgb: ColorService.hexToRgb(hex),
    hsv: ColorService.hexToHsv(hex),
    category: CUSTOM_DYE_SENTINEL,
    acquisition: CUSTOM_DYE_SENTINEL,
    cost: 0,
    currency: null,
    isMetallic: false,
    isPastel: false,
    isDark: false,
    isCosmic: false,
    isIshgardian: false,
    consolidationType: null,
  } as Dye;
}

/** True when `dye` is a virtual custom-colour dye minted by {@link makeCustomDye}. */
export function isCustomDye(dye: Pick<Dye, 'category'>): boolean {
  return dye.category === CUSTOM_DYE_SENTINEL;
}

/** Localized label ("Custom") for a custom dye's category/acquisition badges. */
export function customDyeLabel(): string {
  return LanguageService.t('common.custom');
}
