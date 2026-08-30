/**
 * OpenGraph Data Generator
 *
 * Generates HTML with dynamic OpenGraph meta tags for social media previews.
 * When a crawler requests a shared link, this module produces the HTML
 * that crawlers parse to generate rich link previews.
 *
 * @module og-data-generator
 */

import { DEFAULT_MATCHING_METHOD, normalizeMatchingMethod, presetData } from '@xivdyetools/core';
import type { PresetData } from '@xivdyetools/types';
import { getDyeByItemId } from './services/svg/dye-helpers';
import { GROUND, MARK_STRIPES } from './services/svg/tokens';
import { COMPARISON_MAX_DYES } from './services/svg/comparison';
import { ACCESSIBILITY_MAX_DYES } from './services/svg/accessibility';
import { getOgDeck } from './services/og-strings';
import { embed } from './services/og-embed';
import {
  ogTranslator,
  getLocalizedDyeName,
  getLocalizedHarmonyName,
  getLocalizedVisionName,
  getLocalizedClanOrRace,
  isKnownClanOrRace,
} from './services/translator';
import {
  OG_MAX_GRADIENT_STEPS,
  OG_MAX_MIXER_RATIO,
  OG_MAX_SWATCH_LIMIT,
  OG_MIN_GRADIENT_STEPS,
  OG_MIN_MIXER_RATIO,
  clampInt,
  isHarmonyType,
  isSheet,
  isVisionType,
  parseAlgo,
  parseDyeIdList,
  parseGender,
  parseHexColor,
} from './og-params';
import type { LocaleCode, SheetKey } from '@xivdyetools/types';
import type {
  OGData,
  ToolId,
  HarmonyParams,
  GradientParams,
  MixerParams,
  SwatchParams,
  ComparisonParams,
  AccessibilityParams,
  ExtractorParams,
  PresetsParams,
  BudgetParams,
  ColorSheetCategory,
  CharacterGender,
  MatchingAlgorithm,
  Env,
} from './types';

// ============================================================================
// Localization (REFACTOR-001, 2026-04-28 audit; OG-I18N-002, 2026-08-20 audit)
// ============================================================================

// ogTranslator is shared from ./services/translator so SVG generators reuse
// the same preloaded instance — and the harmony / lens / dye names below come
// from the same helpers the cards use, so the embed text and the picture
// inside it cannot disagree. The sentences themselves are `OG_EMBED` ×6 in
// services/og-strings.ts; this module only fills them.

/**
 * Append the locale to an emitted image URL — the picture never localises
 * itself, so the `?lang=` must travel with every og:image URL. English is
 * the default and stays unparameterised (stable cache keys).
 */
function withLang(url: string, locale: LocaleCode): string {
  if (locale === 'en') return url;
  return `${url}${url.includes('?') ? '&' : '?'}lang=${locale}`;
}

/**
 * Append the requested matching algorithm to an emitted image URL, so the
 * card computes the same Δ the page did (DEAD-022 — the embed and the picture
 * cannot disagree). Legacy spellings normalise first; the suite default and
 * unknown values stay off the URL so the same card keeps one cache key.
 */
function withAlgo(url: string, algo: MatchingAlgorithm | string | null | undefined): string {
  if (!algo) return url;
  const method = normalizeMatchingMethod(algo);
  if (method === DEFAULT_MATCHING_METHOD) return url;
  return `${url}${url.includes('?') ? '&' : '?'}algo=${method}`;
}

/** The root name never localises, and it closes every title. */
const SITE_NAME = 'XIV Dye Tools';
function site(title: string): string {
  return `${title} | ${SITE_NAME}`;
}

/**
 * EN sentences lower-case a noun mid-sentence ("explore triadic color
 * harmonies"); no other locale does, and German nouns must keep their
 * capital (OG-I18N-006).
 */
function lc(s: string, locale: LocaleCode): string {
  return locale === 'en' ? s.toLowerCase() : s;
}

/**
 * The tool's display name for the embed title — the ×6 deck name (the 5.0
 * web-app title), never core `tools.*`: core has no extractor / presets /
 * budget and its six older names differ from the page and the card in 20 of
 * 36 cells (OG-I18N-004/005).
 */
function getToolName(tool: ToolId, locale: LocaleCode): string {
  return getOgDeck(tool, locale).name;
}

/** The per-tool 2a default card, for a share URL that resolves to nothing. */
function toolDefault(tool: ToolId, env: Env, locale: LocaleCode, description: string): OGData {
  return {
    title: site(getToolName(tool, locale)),
    description,
    url: `${env.APP_BASE_URL}/${tool}/`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/${tool}/default.png`, locale),
    siteName: SITE_NAME,
    locale,
  };
}

function getSheetName(sheet: ColorSheetCategory, locale: LocaleCode): string {
  return ogTranslator.getSheetName(sheet as SheetKey, locale);
}

function getGenderName(raw: CharacterGender | string, locale: LocaleCode): string {
  const g = raw.toLowerCase();
  if (g === 'male' || g === 'female') return embed(`gender.${g}`, locale);
  return raw;
}

// ============================================================================
// DyeService Instance
// ============================================================================

// REFACTOR-024: reuse the shared instance from dye-helpers instead of
// constructing a second DyeService (each init validates the 125 schema-v2
// dye entries and builds three indexes + a k-d tree — pure duplicated
// cold-start work).

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get dye name and hex color by stainID (5.0: OG paths key on stainIDs).
 * The name is the localized one — the same lookup the card uses
 * (OG-I18N-003).
 */
function getDyeInfo(stainID: number, locale: LocaleCode): { name: string; hex: string } | null {
  // OPT-023: O(1) map lookup via the shared helper
  const dye = getDyeByItemId(stainID);

  if (!dye) {
    return null;
  }

  return {
    name: getLocalizedDyeName(dye, locale),
    hex: dye.hex,
  };
}

/**
 * Format hex color for display (ensure # prefix)
 */
function formatHex(hex: string): string {
  return hex.startsWith('#') ? hex : `#${hex}`;
}

// ============================================================================
// Tool-Specific OG Data Generators
// ============================================================================

/**
 * Generate OG data for Harmony Explorer
 */
export function generateHarmonyOGData(
  params: HarmonyParams,
  env: Env,
  locale: LocaleCode = 'en',
): OGData {
  const dyeInfo = getDyeInfo(params.dye, locale);
  const harmonyName = getLocalizedHarmonyName(params.harmony, locale);

  if (!dyeInfo) {
    return {
      title: site(embed('harmony.titleNoDye', locale, { harmony: harmonyName })),
      description: embed('harmony.descriptionNoDye', locale, { harmony: lc(harmonyName, locale) }),
      url: `${env.APP_BASE_URL}/harmony/`,
      imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/harmony/default.png`, locale),
      siteName: SITE_NAME,
      locale,
    };
  }

  return {
    title: site(embed('harmony.title', locale, { dye: dyeInfo.name, harmony: harmonyName })),
    description: embed('harmony.description', locale, {
      harmony: lc(harmonyName, locale),
      dye: dyeInfo.name,
      hex: dyeInfo.hex,
    }),
    // OG-6: the harmony is enum-validated upstream; encoding is belt-and-braces
    url: `${env.APP_BASE_URL}/harmony/?dye=${params.dye}&harmony=${encodeURIComponent(params.harmony)}&v=1`,
    imageUrl: withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/harmony/${params.dye}/${encodeURIComponent(params.harmony)}.png`, params.algo), locale),
    siteName: SITE_NAME,
    themeColor: dyeInfo.hex,
    locale,
  };
}

/**
 * Generate OG data for Gradient Builder
 */
export function generateGradientOGData(
  params: GradientParams,
  env: Env,
  locale: LocaleCode = 'en',
): OGData {
  const startDye = getDyeInfo(params.start, locale);
  const endDye = getDyeInfo(params.end, locale);

  if (!startDye || !endDye) {
    return toolDefault('gradient', env, locale, embed('gradient.descriptionDefault', locale));
  }

  return {
    title: site(embed('gradient.title', locale, { start: startDye.name, end: endDye.name })),
    description: embed('gradient.description', locale, {
      n: params.steps,
      start: startDye.name,
      startHex: startDye.hex,
      end: endDye.name,
      endHex: endDye.hex,
    }),
    url: `${env.APP_BASE_URL}/gradient/?start=${params.start}&end=${params.end}&steps=${params.steps}&v=1`,
    imageUrl: withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/gradient/${params.start}/${params.end}/${params.steps}.png`, params.algo), locale),
    siteName: SITE_NAME,
    themeColor: startDye.hex,
    locale,
  };
}

/**
 * Generate OG data for Dye Mixer
 */
export function generateMixerOGData(
  params: MixerParams,
  env: Env,
  locale: LocaleCode = 'en',
): OGData {
  const dyeA = getDyeInfo(params.dyeA, locale);
  const dyeB = getDyeInfo(params.dyeB, locale);
  const dyeC = params.dyeC ? getDyeInfo(params.dyeC, locale) : null;

  if (!dyeA || !dyeB) {
    return toolDefault('mixer', env, locale, embed('mixer.descriptionDefault', locale));
  }

  // 3-dye mix
  if (dyeC) {
    const names = { a: dyeA.name, b: dyeB.name, c: dyeC.name };
    return {
      title: site(embed('mixer.title3', locale, names)),
      description: embed('mixer.description3', locale, names),
      url: `${env.APP_BASE_URL}/mixer/?dyeA=${params.dyeA}&dyeB=${params.dyeB}&dyeC=${params.dyeC}&v=1`,
      imageUrl: withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/mixer/${params.dyeA}/${params.dyeB}/${params.dyeC}/${params.ratio}.png`, params.algo), locale),
      siteName: SITE_NAME,
      themeColor: dyeA.hex,
      locale,
    };
  }

  // 2-dye mix
  const vars = { ratio: params.ratio, a: dyeA.name, ratioB: 100 - params.ratio, b: dyeB.name };
  return {
    title: site(embed('mixer.title2', locale, vars)),
    description: embed('mixer.description2', locale, vars),
    url: `${env.APP_BASE_URL}/mixer/?dyeA=${params.dyeA}&dyeB=${params.dyeB}&ratio=${params.ratio}&v=1`,
    imageUrl: withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/mixer/${params.dyeA}/${params.dyeB}/${params.ratio}.png`, params.algo), locale),
    siteName: SITE_NAME,
    themeColor: dyeA.hex,
    locale,
  };
}

/**
 * Generate OG data for Swatch Matcher
 */
export function generateSwatchOGData(
  params: SwatchParams,
  env: Env,
  locale: LocaleCode = 'en',
): OGData {
  const hexColor = formatHex(params.color);
  const limit = params.limit || 5;
  const { sheet, race, gender } = params;

  // Build description based on available context
  let description = embed('swatch.description', locale, { n: limit, hex: hexColor });

  if (sheet) {
    const isRaceSpecific = sheet === 'hairColors' || sheet === 'skinColors';
    const sheetName = lc(getSheetName(sheet, locale), locale);
    if (isRaceSpecific && race && gender) {
      description = embed('swatch.descriptionSheetRace', locale, {
        gender: getGenderName(gender, locale),
        race: getLocalizedClanOrRace(race, locale),
        sheet: sheetName,
        hex: hexColor,
      });
    } else {
      description = embed('swatch.descriptionSheet', locale, { sheet: sheetName, hex: hexColor });
    }
  }

  // Build the web app URL with all params
  const urlParams = new URLSearchParams();
  urlParams.set('color', params.color);
  urlParams.set('limit', String(limit));
  if (sheet) urlParams.set('sheet', sheet);
  if (race) urlParams.set('race', race);
  if (gender) urlParams.set('gender', gender);
  if (params.algo) urlParams.set('algo', params.algo);
  urlParams.set('v', '1');

  // The image URL carries only what the 15E card draws: the target, the
  // limit and the algorithm. Sheet context shapes the description above but
  // not the picture, so it stays off the image URL (one cache key per card).
  const imageUrl = withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/swatch/${encodeURIComponent(params.color)}/${limit}.png`, params.algo), locale);

  return {
    title: site(embed('swatch.title', locale, { hex: hexColor })),
    description,
    url: `${env.APP_BASE_URL}/swatch/?${urlParams.toString()}`,
    imageUrl,
    siteName: SITE_NAME,
    themeColor: hexColor,
    locale,
  };
}

/**
 * Generate OG data for Dye Comparison
 */
export function generateComparisonOGData(
  params: ComparisonParams,
  env: Env,
  locale: LocaleCode = 'en',
): OGData {
  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R17): COMPARISON_MAX_DYES is the
  // SAME constant services/svg/comparison.ts slices its bands on, imported
  // rather than re-guessed, so the two cannot drift apart silently. One
  // list, sliced once, feeds both the title (a card can't reasonably list
  // 16 names — that was already true) and the image URL (this is the fix:
  // before it, the URL carried every resolved id up to OG_MAX_COMPARISON_DYES
  // (16), most of which the card never draws — a request could still spell
  // the identical 4-dye card many ways by varying ids past position 4, the
  // same "many spellings render one card" shape ruling S7-R12 closes for
  // malformed ids). Resolving before slicing out nulls also fixes the
  // now-parked ?dyes=-5,1,2 case from the previous pass: an id that never
  // resolves cannot reach the URL either way.
  const resolved = params.dyes
    .slice(0, COMPARISON_MAX_DYES)
    .map((id) => ({ id, dye: getDyeInfo(id, locale) }))
    .filter((r): r is { id: number; dye: { name: string; hex: string } } => r.dye !== null);

  if (resolved.length === 0) {
    return toolDefault('comparison', env, locale, embed('comparison.descriptionDefault', locale));
  }

  const dyeNames = resolved.map((r) => r.dye.name).join(', ');

  return {
    title: site(embed('comparison.title', locale, { names: dyeNames })),
    description: embed('comparison.description', locale, { n: resolved.length, names: dyeNames }),
    url: `${env.APP_BASE_URL}/comparison/?dyes=${params.dyes.join(',')}&v=1`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/comparison/${resolved.map((r) => r.id).join(',')}.png`, locale),
    siteName: SITE_NAME,
    themeColor: resolved[0].dye.hex,
    locale,
  };
}

/**
 * Generate OG data for Accessibility Checker
 */
export function generateAccessibilityOGData(
  params: AccessibilityParams,
  env: Env,
  locale: LocaleCode = 'en',
): OGData {
  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R17): same reasoning as
  // generateComparisonOGData above — ACCESSIBILITY_MAX_DYES is the constant
  // services/svg/accessibility.ts slices its bands on; one resolved-and-sliced
  // list feeds both the title and the image URL, so the URL can never carry
  // an id the card doesn't draw.
  const resolved = params.dyes
    .slice(0, ACCESSIBILITY_MAX_DYES)
    .map((id) => ({ id, dye: getDyeInfo(id, locale) }))
    .filter((r): r is { id: number; dye: { name: string; hex: string } } => r.dye !== null);
  const visionName = params.vision
    ? getLocalizedVisionName(params.vision, locale)
    : embed('accessibility.lensAll', locale);

  if (resolved.length === 0) {
    return toolDefault('accessibility', env, locale, embed('accessibility.descriptionDefault', locale));
  }

  const dyeNames = resolved.map((r) => r.dye.name).join(', ');

  return {
    title: site(embed('accessibility.title', locale, { lens: visionName, names: dyeNames })),
    description: embed('accessibility.description', locale, { names: dyeNames, lens: lc(visionName, locale) }),
    url: `${env.APP_BASE_URL}/accessibility/?dyes=${params.dyes.join(',')}&vision=${encodeURIComponent(params.vision || 'normal')}&v=1`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/accessibility/${resolved.map((r) => r.id).join(',')}/${encodeURIComponent(params.vision || 'normal')}.png`, locale),
    siteName: SITE_NAME,
    themeColor: resolved[0].dye.hex,
    locale,
  };
}

/**
 * Generate OG data for the Palette Extractor (5.0). The share URL carries
 * the palette but not each colour's share, so the card draws equal, ranked
 * bands (see `ExtractorOGOptions`).
 */
export function generateExtractorOGData(
  params: ExtractorParams,
  env: Env,
  locale: LocaleCode = 'en',
): OGData {
  const colors = params.colors.slice(0, 5);
  if (colors.length === 0) {
    return toolDefault('extractor', env, locale, embed('extractor.descriptionDefault', locale));
  }

  const list = colors.map((c) => `#${c}`).join(', ');
  const algoQuery = params.algo ? `&algo=${encodeURIComponent(params.algo)}` : '';

  return {
    title: site(embed('extractor.title', locale, { n: colors.length })),
    description: embed('extractor.description', locale, { list }),
    // Commas stay literal (like comparison's dyes=) — the SPA reads them either way
    url: `${env.APP_BASE_URL}/extractor/?colors=${colors.join(',')}${algoQuery}&v=1`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/extractor/${colors.join(',')}.png`, locale),
    siteName: SITE_NAME,
    themeColor: `#${colors[0]}`,
    locale,
  };
}

/**
 * Generate OG data for Community Presets (5.0). Only the curated set has a
 * card (the worker bundles `presetData`); a community id or an unknown slug
 * degrades to the tool default rather than inventing a palette.
 *
 * The preset's own `name` / `description` are EN-only by design
 * (OG-I18N-010: "preset names not localised") — the sentence around them is
 * localized, the blurb is appended as-is.
 */
export function generatePresetsOGData(
  params: PresetsParams,
  env: Env,
  locale: LocaleCode = 'en',
): OGData {
  const preset = params.id
    ? (presetData as PresetData).palettes.find((p) => p.id === params.id)
    : undefined;
  if (!preset) {
    return toolDefault('presets', env, locale, embed('presets.descriptionDefault', locale));
  }

  const dyes = preset.dyes
    .map((id) => getDyeInfo(id, locale))
    .filter((d): d is { name: string; hex: string } => d !== null);
  const dyeNames = dyes.map((d) => d.name).join(', ');
  const blurb = preset.description ? ` ${preset.description}` : '';

  return {
    title: site(embed('presets.title', locale, { preset: preset.name, tool: getToolName('presets', locale) })),
    description: (dyeNames
      ? embed('presets.description', locale, { names: dyeNames })
      : embed('presets.descriptionNoDyes', locale)) + blurb,
    url: `${env.APP_BASE_URL}/presets/${preset.id}`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/presets/${preset.id}.png`, locale),
    siteName: SITE_NAME,
    themeColor: dyes[0]?.hex,
    locale,
  };
}

/**
 * Generate OG data for Budget (5.0). Only a dye target has a card — the
 * image route is stainID-keyed; a bare `?hex=` target degrades to the default.
 */
export function generateBudgetOGData(
  params: BudgetParams,
  env: Env,
  locale: LocaleCode = 'en',
): OGData {
  const target = params.dye !== null ? getDyeInfo(params.dye, locale) : null;
  if (!target || params.dye === null) {
    return toolDefault('budget', env, locale, embed('budget.descriptionDefault', locale));
  }

  return {
    title: site(embed('budget.title', locale, { dye: target.name })),
    description: embed('budget.description', locale, { dye: target.name, hex: target.hex }),
    url: `${env.APP_BASE_URL}/budget/?dye=${params.dye}&v=1`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/budget/${params.dye}.png`, locale),
    siteName: SITE_NAME,
    themeColor: target.hex,
    locale,
  };
}

/**
 * The site-root embed (`og.` / `og-beta.` only reach it — the web-app serves
 * its own static card on the apex).
 */
export function generateRootOGData(env: Env, locale: LocaleCode = 'en'): OGData {
  return {
    title: embed('root.title', locale),
    description: embed('root.description', locale),
    url: env.APP_BASE_URL,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/default.png`, locale),
    siteName: SITE_NAME,
    locale,
  };
}

/** The minimal embed for an unknown path. */
export function generateFallbackOGData(env: Env, locale: LocaleCode = 'en'): OGData {
  return {
    title: SITE_NAME,
    description: embed('fallback.description', locale),
    url: env.APP_BASE_URL,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/default.png`, locale),
    siteName: SITE_NAME,
    locale,
  };
}

// ============================================================================
// HTML Template Generator
// ============================================================================

/** Append the X frame selector to an image URL (respects existing queries). */
function withFrameX(imageUrl: string): string {
  return imageUrl.includes('?') ? `${imageUrl}&frame=x` : `${imageUrl}?frame=x`;
}

/** `og:locale` wants a territory; these are the six the app ships. */
const OG_LOCALE: Record<LocaleCode, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  de: 'de_DE',
  fr: 'fr_FR',
  ko: 'ko_KR',
  zh: 'zh_CN',
};

/**
 * Generate HTML with OpenGraph meta tags for crawler consumption.
 *
 * This HTML includes:
 * - Standard OG tags (og:title, og:description, og:image, og:locale, etc.)
 * - Twitter Card tags
 * - Discord-specific theme-color
 * - A meta refresh to redirect JS-enabled browsers to the real page
 *
 * @param ogData - The OpenGraph data to include in meta tags
 * @returns Complete HTML string
 */
export function generateOGHTML(ogData: OGData): string {
  const locale: LocaleCode = ogData.locale ?? 'en';
  const themeColorTag = ogData.themeColor
    ? `<meta name="theme-color" content="${escapeHtml(ogData.themeColor)}">`
    : '';

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${escapeHtml(ogData.title)}</title>
  <meta name="title" content="${escapeHtml(ogData.title)}">
  <meta name="description" content="${escapeHtml(ogData.description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:locale" content="${OG_LOCALE[locale] ?? OG_LOCALE.en}">
  <meta property="og:url" content="${escapeHtml(ogData.url)}">
  <meta property="og:title" content="${escapeHtml(ogData.title)}">
  <meta property="og:description" content="${escapeHtml(ogData.description)}">
  <meta property="og:image" content="${escapeHtml(ogData.imageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="1050">
  <meta property="og:site_name" content="${escapeHtml(ogData.siteName)}">

  <!-- Twitter: summary_large_image crops non-2:1, so X gets its own frame -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(ogData.url)}">
  <meta name="twitter:title" content="${escapeHtml(ogData.title)}">
  <meta name="twitter:description" content="${escapeHtml(ogData.description)}">
  <meta name="twitter:image" content="${escapeHtml(withFrameX(ogData.imageUrl))}">

  <!-- Discord embed color -->
  ${themeColorTag}

  <!-- Redirect for JavaScript-enabled browsers -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(ogData.url)}">

  <style>
    /* The page nobody designed, designed: the console palette, the mark's
       stripes, and the thing you asked for named while you wait. Reached by
       refresh-blocking browsers and pre-fetching clients — same surface,
       same theme. */
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: ${GROUND};
      color: #ECECEE;
    }
    .card {
      width: min(400px, calc(100vw - 48px));
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 12px;
      overflow: hidden;
      background: #17171A;
    }
    .stripes { display: flex; height: 64px; }
    .stripes span { flex: 1; }
    .deck { padding: 16px 18px 18px; }
    .title { font-size: 16px; font-weight: 600; margin: 0 0 4px; }
    .sub { font-size: 12.5px; color: #9C9CA2; margin: 0 0 14px; line-height: 1.5; }
    a {
      color: #FF6257;
      text-decoration: none;
      border-bottom: 1px solid rgba(255,98,87,0.35);
    }
    a:hover { color: #ff8579; }
    .foot {
      font-family: ui-monospace, monospace;
      font-size: 11px;
      color: #86868C;
      margin-top: 14px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="stripes">
      ${MARK_STRIPES.map((hex) => `<span style="background:${hex}"></span>`).join('')}
    </div>
    <div class="deck">
      <p class="title">${escapeHtml(ogData.title)}</p>
      <p class="sub">${escapeHtml(ogData.description)}</p>
      <p><a href="${escapeHtml(ogData.url)}">${escapeHtml(embed('body.open', locale))}</a></p>
      <p class="foot">xivdyetools.app</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Generate OG data for any tool based on parsed URL parameters.
 *
 * @param tool - The tool ID from the URL path
 * @param searchParams - URL search parameters
 * @param env - Environment bindings
 * @param locale - Optional locale for display-name localization (defaults to 'en').
 *                 Pass the value parsed from the request's `?lang=` query param
 *                 in `createToolHandler`.
 * @param pathId - For tools whose share form is a PATH (`/presets/:id`), the
 *                 path segment; `createToolHandler` passes it through.
 * @returns OGData for the requested tool and parameters
 */
export function generateOGDataForTool(
  tool: ToolId,
  searchParams: URLSearchParams,
  env: Env,
  locale: LocaleCode = 'en',
  pathId: string | null = null,
): OGData {
  switch (tool) {
    // FINDING-024 (OG-2 / OG-6): every value below that reaches og:title /
    // og:description / og:url / og:image is validated against the same
    // vocabulary the image routes enforce (og-params.ts). An unknown value
    // takes the parameter's default — the same thing a missing value gets —
    // so a share link can neither spoof preview text under the production
    // domain nor emit an image URL the image route would 400.
    case 'harmony': {
      const harmonyRaw = (searchParams.get('harmony') || 'complementary').toLowerCase();
      const params: HarmonyParams = {
        dye: parseInt(searchParams.get('dye') || '0', 10),
        harmony: isHarmonyType(harmonyRaw) ? harmonyRaw : 'complementary',
        algo: parseAlgo(searchParams.get('algo')),
      };
      return generateHarmonyOGData(params, env, locale);
    }

    case 'gradient': {
      const params: GradientParams = {
        start: parseInt(searchParams.get('start') || '0', 10),
        end: parseInt(searchParams.get('end') || '0', 10),
        steps: clampInt(searchParams.get('steps'), OG_MIN_GRADIENT_STEPS, OG_MAX_GRADIENT_STEPS, 5),
        algo: parseAlgo(searchParams.get('algo')),
      };
      return generateGradientOGData(params, env, locale);
    }

    case 'mixer': {
      const dyeCRaw = searchParams.get('dyeC');
      const params: MixerParams = {
        dyeA: parseInt(searchParams.get('dyeA') || '0', 10),
        dyeB: parseInt(searchParams.get('dyeB') || '0', 10),
        dyeC: dyeCRaw ? parseInt(dyeCRaw, 10) : undefined,
        ratio: clampInt(searchParams.get('ratio'), OG_MIN_MIXER_RATIO, OG_MAX_MIXER_RATIO, 50),
        algo: parseAlgo(searchParams.get('algo')),
      };
      return generateMixerOGData(params, env, locale);
    }

    case 'swatch': {
      // No target colour → the tool default. A white #FFFFFF stand-in was the
      // pre-5.0 behaviour; it invented a target the user never shared (2a: a
      // default never fakes data). A NON-HEX target is the same case: the
      // card cannot draw it and the crawler must not echo it.
      const color = parseHexColor(searchParams.get('hex') || searchParams.get('color'));
      if (!color) {
        return toolDefault('swatch', env, locale, embed('swatch.descriptionDefault', locale));
      }
      const sheetRaw = searchParams.get('sheet');
      const raceRaw = searchParams.get('race');
      const params: SwatchParams = {
        color,
        algo: parseAlgo(searchParams.get('algo')),
        limit: clampInt(searchParams.get('limit'), 1, OG_MAX_SWATCH_LIMIT, 5),
        sheet: sheetRaw && isSheet(sheetRaw) ? sheetRaw : undefined,
        // only a slug a locale table knows is ever looked up or echoed
        race: raceRaw && isKnownClanOrRace(raceRaw) ? raceRaw : undefined,
        gender: parseGender(searchParams.get('gender')),
      };
      return generateSwatchOGData(params, env, locale);
    }

    case 'comparison': {
      const params: ComparisonParams = { dyes: parseDyeIdList(searchParams.get('dyes')) };
      return generateComparisonOGData(params, env, locale);
    }

    case 'accessibility': {
      const visionRaw = searchParams.get('vision')?.toLowerCase();
      const params: AccessibilityParams = {
        dyes: parseDyeIdList(searchParams.get('dyes')),
        vision: visionRaw && isVisionType(visionRaw) ? visionRaw : undefined,
      };
      return generateAccessibilityOGData(params, env, locale);
    }

    case 'extractor': {
      const params: ExtractorParams = {
        colors: (searchParams.get('colors') || '')
          .split(',')
          .map((c) => c.trim().replace(/^#/, '').toUpperCase())
          .filter((c) => /^[0-9A-F]{6}$/.test(c)),
        algo: parseAlgo(searchParams.get('algo')),
      };
      return generateExtractorOGData(params, env, locale);
    }

    case 'presets': {
      // The web app shares presets as /presets/<id>; ?id= is accepted too.
      const raw = pathId ?? searchParams.get('id');
      const params: PresetsParams = {
        id: raw && /^[a-z0-9-]{1,64}$/.test(raw) ? raw : null,
      };
      return generatePresetsOGData(params, env, locale);
    }

    case 'budget': {
      const dyeRaw = searchParams.get('dye');
      const dye = dyeRaw ? parseInt(dyeRaw, 10) : NaN;
      const params: BudgetParams = { dye: Number.isNaN(dye) ? null : dye };
      return generateBudgetOGData(params, env, locale);
    }

    default: {
      // Fallback for unknown tools
      return {
        title: SITE_NAME,
        description: embed('unknown.description', locale),
        url: env.APP_BASE_URL,
        imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/default.png`, locale),
        siteName: SITE_NAME,
        locale,
      };
    }
  }
}
