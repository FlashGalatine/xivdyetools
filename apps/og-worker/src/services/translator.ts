import {
  LocaleLoader,
  LocaleRegistry,
  TranslationProvider,
} from '@xivdyetools/core';
import type {
  Dye,
  HarmonyTypeKey,
  LocaleCode,
  VisionType as CoreVisionType,
} from '@xivdyetools/types';

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

/** Route form (`split-complementary`) → locale key form (`splitComplementary`). */
export function harmonyToKey(harmony: string): HarmonyTypeKey {
  return harmony.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()) as HarmonyTypeKey;
}

/**
 * The localized harmony-type name. Shared by the crawler HTML and the cards so
 * the embed text and the picture inside it cannot disagree.
 */
export function getLocalizedHarmonyName(harmony: string, locale: LocaleCode): string {
  return ogTranslator.getHarmonyType(harmonyToKey(harmony), locale);
}

/** The localized lens name — the same shipped key the embed uses. */
export function getLocalizedVisionName(vision: string, locale: LocaleCode): string {
  return ogTranslator.getVisionShort(vision as CoreVisionType, locale);
}
