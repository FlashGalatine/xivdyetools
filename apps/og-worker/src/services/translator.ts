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

// CJK fonts (Noto Sans SC / KR) are not bundled in og-worker. Rendering CJK
// glyphs with the Latin-only bundle produces blank boxes, which is worse than
// English. Fall back to the English dye.name for these locales.
const CJK_LOCALES = new Set<LocaleCode>(['ja', 'ko', 'zh']);

/**
 * Return the localized display name for a dye, falling back to the English
 * `dye.name` when the locale is CJK (font not bundled) or the name is missing.
 */
export function getLocalizedDyeName(dye: Dye, locale: LocaleCode): string {
  if (CJK_LOCALES.has(locale)) return dye.name;
  return ogTranslator.getDyeName(dye.itemID, locale) ?? dye.name;
}
