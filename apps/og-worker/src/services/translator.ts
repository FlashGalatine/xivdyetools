import {
  LocaleLoader,
  LocaleRegistry,
  TranslationProvider,
} from '@xivdyetools/core';
import type { ClanKey, Dye, HarmonyTypeKey, LocaleCode, RaceKey, VisionType } from '@xivdyetools/types';

/**
 * Module-scoped translator with all 6 locales eagerly preloaded.
 *
 * Shared by og-data-generator and the SVG generators so locale data is only
 * loaded once per isolate. Stateless: every call passes locale explicitly.
 */
const ogRegistry: LocaleRegistry = (() => {
  const loader = new LocaleLoader();
  const registry = new LocaleRegistry();
  for (const lc of ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const) {
    registry.registerLocale(loader.loadLocale(lc));
  }
  return registry;
})();

export const ogTranslator: TranslationProvider = new TranslationProvider(ogRegistry);

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
export function getLocalizedVisionName(vision: VisionType, locale: LocaleCode): string {
  return ogTranslator.getVisionShort(vision, locale);
}

/**
 * The web-app shares the character's clan (`SeekerOfTheSun`, `Midlander`)
 * in swatch `?race=`; older links carry a race. Try the clan table, then the
 * race table, then echo the slug — never a formatted key in another language
 * (OG-I18N-007).
 */
export function getLocalizedClanOrRace(raw: string, locale: LocaleCode): string {
  const key = raw.charAt(0).toLowerCase() + raw.slice(1);
  const en = ogRegistry.getLocale('en');
  if (en?.clans && key in en.clans) return ogTranslator.getClan(key as ClanKey, locale);
  if (en?.races && key in en.races) return ogTranslator.getRace(key as RaceKey, locale);
  return raw;
}
