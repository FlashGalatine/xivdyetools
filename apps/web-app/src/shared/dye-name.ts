/**
 * Localized dye name lookup, comparison, and search matching.
 *
 * `LanguageService.getDyeName(itemID)` returns the core library's translated
 * name for the current locale, or `null` when none exists (English, or an
 * itemID the localization data doesn't cover — e.g. a custom dye's negative
 * synthetic id). These helpers centralize the "localized name, falling back
 * to the English `dye.name`" pattern used for display, sorting, and search.
 *
 * @module shared/dye-name
 */

import type { Dye } from '@xivdyetools/types';
import { LanguageService } from '@services/language-service';

/** Localized dye name, falling back to `dye.name` when no translation exists. */
export function localizedDyeName(dye: Pick<Dye, 'itemID' | 'name'>): string {
  return LanguageService.getDyeName(dye.itemID) ?? dye.name;
}

/** Locale-aware comparator for sorting dyes by their localized name. */
export function compareDyeNames(
  a: Pick<Dye, 'itemID' | 'name'>,
  b: Pick<Dye, 'itemID' | 'name'>
): number {
  return localizedDyeName(a).localeCompare(localizedDyeName(b), LanguageService.getCurrentLocale());
}

/** Case-insensitive substring match against both the localized and English dye names. */
export function dyeNameMatches(dye: Pick<Dye, 'itemID' | 'name'>, query: string): boolean {
  const needle = query.toLowerCase();
  return (
    localizedDyeName(dye).toLowerCase().includes(needle) || dye.name.toLowerCase().includes(needle)
  );
}
