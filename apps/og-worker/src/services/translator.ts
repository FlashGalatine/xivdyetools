import {
  LocaleLoader,
  LocaleRegistry,
  TranslationProvider,
} from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';

/**
 * Module-scoped translator with all 6 locales eagerly preloaded.
 *
 * Shared by og-data-generator and the SVG generators so locale data is only
 * loaded once per isolate. Stateless: every call passes locale explicitly.
 */
export const ogTranslator: TranslationProvider = (() => {
  const loader = new LocaleLoader();
  const registry = new LocaleRegistry();
  for (const lc of ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const) {
    registry.registerLocale(loader.loadLocale(lc));
  }
  return new TranslationProvider(registry);
})();

/**
 * Return the localized display name for a dye, falling back to the English
 * `dye.name` when the locale lookup returns nothing.
 */
export function getLocalizedDyeName(dye: Dye, locale: LocaleCode): string {
  return ogTranslator.getDyeName(dye.itemID, locale) ?? dye.name;
}
