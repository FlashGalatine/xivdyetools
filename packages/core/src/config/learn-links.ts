/**
 * /manual topic roster + learn-more link table — shared data for every
 * surface (web MetricHelp rows, bot /manual embeds, og-worker redirect page).
 *
 * Per the confirmed 5.0 rules (design register, cross-cutting):
 * - Authority order when sourcing: clinical body → medical portal →
 *   encyclopaedia. Read the target, not its name.
 * - **A missing URL degrades to no link, never the English one.**
 * - Embeds print authority + host, never the path; web `<a>`s still name the
 *   authority.
 * - The lead sentence and its tail are authored together per locale (JA
 *   `をご覧ください`; KO takes no tail — position-dependent). Those live in
 *   the locale string tables, not here.
 * - Every URL here passed a liveness check on 2026-08-07. Two of five had
 *   already moved once before that — keep the liveness test in CI-reachable
 *   form and treat a dead link as an absent link at render time.
 *
 * Roster decisions:
 * - Colour Vision: EN = NEI (clinical body) · DE = Portal der Augenmedizin
 *   (medical portal) · FR = Wikipédia *Daltonisme* (encyclopaedia; no
 *   endorsed FR clinical page) · JA = 日本眼科医会 (the JA copy names
 *   achromatopsia as separate, not a fourth 色覚異常) · KO = KDCA 국가건강정보포털.
 *   **ZH is deliberately absent** — blocked on a Simplified-Chinese reader.
 * - Contrast: cite WCAG 1.4.11 in all six locales, but **link only en/fr/zh**
 *   (the W3C-authorized translations). DE's endorsed 2.0 translation lacks the
 *   criterion; KO's translation is unofficial http; JA's waic.jp needs its own
 *   check before it can join.
 * - Matching Methods: our own docs — no localised authority exists.
 * - Spectrum & Prices: Lodestone **by game region, not locale**.
 * - Image Matching Tips and Character File link nothing.
 */

import type { LocaleCode } from '@xivdyetools/types';

/** Manual topic identifiers — stored choice values, verbatim across locales. */
export type ManualTopicId =
  | 'match_image'
  | 'color_vision'
  | 'contrast'
  | 'matching_methods'
  | 'spectrum_prices'
  | 'character_file';

/** FFXIV Lodestone regions (per-region hosts, not per-locale). */
export type LodestoneRegion = 'na' | 'eu' | 'jp' | 'de' | 'fr';

export interface LearnLink {
  /** The authority to name in UI (never print the URL path) */
  authority: string;
  /** Host, printed beside the authority in embeds */
  host: string;
  url: string;
}

export interface ManualTopic {
  id: ManualTopicId;
  /** Emoji prefix used in the /manual choice list (part of the shipped string) */
  emoji: string;
  /**
   * Per-locale learn-more links. An absent locale means NO link — consumers
   * must render the absent state, never fall back to English.
   */
  links: Partial<Record<LocaleCode, LearnLink>>;
}

const W3C = 'W3C';

/** Our own documentation site (Matching Methods target, all locales). */
export const XIVDYETOOLS_DOCS_URL = 'https://developers.xivdyetools.app/';

/** Lodestone by region — Spectrum & Prices resolves region from the user's world. */
export const LODESTONE_BY_REGION: Record<LodestoneRegion, LearnLink> = {
  na: {
    authority: 'The Lodestone',
    host: 'na.finalfantasyxiv.com',
    url: 'https://na.finalfantasyxiv.com/lodestone/',
  },
  eu: {
    authority: 'The Lodestone',
    host: 'eu.finalfantasyxiv.com',
    url: 'https://eu.finalfantasyxiv.com/lodestone/',
  },
  jp: {
    authority: 'The Lodestone',
    host: 'jp.finalfantasyxiv.com',
    url: 'https://jp.finalfantasyxiv.com/lodestone/',
  },
  de: {
    authority: 'The Lodestone',
    host: 'de.finalfantasyxiv.com',
    url: 'https://de.finalfantasyxiv.com/lodestone/',
  },
  fr: {
    authority: 'The Lodestone',
    host: 'fr.finalfantasyxiv.com',
    url: 'https://fr.finalfantasyxiv.com/lodestone/',
  },
};

const MATCHING_METHODS_LINK: LearnLink = {
  authority: 'XIV Dye Tools Docs',
  host: 'developers.xivdyetools.app',
  url: XIVDYETOOLS_DOCS_URL,
};

/**
 * The /manual topic roster. `match_image` ships today; the other five need
 * handler + choice registration in the bot (they are part of the 5.0 port).
 */
export const MANUAL_TOPICS: readonly ManualTopic[] = [
  {
    id: 'match_image',
    emoji: '📸',
    links: {},
  },
  {
    id: 'color_vision',
    emoji: '♿',
    links: {
      en: {
        authority: 'National Eye Institute',
        host: 'www.nei.nih.gov',
        url: 'https://www.nei.nih.gov/learn-about-eye-health/eye-conditions-and-diseases/color-blindness',
      },
      de: {
        authority: 'Portal der Augenmedizin',
        host: 'www.portal-der-augenmedizin.de',
        url: 'https://www.portal-der-augenmedizin.de/aktuelles/20110405-farbenblindheit-im-alltag.html',
      },
      fr: {
        authority: 'Wikipédia — Daltonisme',
        host: 'fr.wikipedia.org',
        url: 'https://fr.wikipedia.org/wiki/Daltonisme',
      },
      ja: {
        authority: '日本眼科医会',
        host: 'www.gankaikai.or.jp',
        url: 'https://www.gankaikai.or.jp/health/50/',
      },
      ko: {
        authority: '질병관리청 국가건강정보포털',
        host: 'health.kdca.go.kr',
        url: 'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=1469',
      },
      // zh: deliberately absent — needs a Simplified-Chinese source found via
      // a community reader. Absent = no link, never the English one.
    },
  },
  {
    id: 'contrast',
    emoji: '🔲',
    links: {
      en: {
        authority: `${W3C} — WCAG 2.1 (1.4.11)`,
        host: 'www.w3.org',
        url: 'https://www.w3.org/TR/WCAG21/#non-text-contrast',
      },
      fr: {
        authority: `${W3C} — WCAG 2.1, traduction autorisée (1.4.11)`,
        host: 'www.w3.org',
        url: 'https://www.w3.org/Translations/WCAG21-fr/',
      },
      zh: {
        authority: `${W3C} — WCAG 2.1 授权翻译 (1.4.11)`,
        host: 'www.w3.org',
        url: 'https://www.w3.org/Translations/WCAG21-zh/',
      },
      // de: endorsed WCAG 2.0 translation lacks 1.4.11 (a 2.1 criterion).
      // ko: only an unofficial http translation exists.
      // ja: waic.jp candidate not yet verified.
      // All three cite 1.4.11 in copy but render the absent-link state.
    },
  },
  {
    id: 'matching_methods',
    emoji: '📐',
    links: {
      en: MATCHING_METHODS_LINK,
      de: MATCHING_METHODS_LINK,
      fr: MATCHING_METHODS_LINK,
      ja: MATCHING_METHODS_LINK,
      ko: MATCHING_METHODS_LINK,
      zh: MATCHING_METHODS_LINK,
    },
  },
  {
    id: 'spectrum_prices',
    emoji: '🪙',
    links: {}, // region-keyed — resolve via LODESTONE_BY_REGION, not locale
  },
  {
    id: 'character_file',
    emoji: '👤',
    links: {}, // links nothing by decision
  },
];

/**
 * Learn-more link for a topic + locale. Returns null for the absent state —
 * consumers render "no link", never the English URL.
 */
export function getLearnLink(topic: ManualTopicId, locale: LocaleCode): LearnLink | null {
  const entry = MANUAL_TOPICS.find((t) => t.id === topic);
  return entry?.links[locale] ?? null;
}

/** Lodestone link for a game region (Spectrum & Prices topic). */
export function getLodestoneLink(region: LodestoneRegion): LearnLink {
  return LODESTONE_BY_REGION[region];
}
