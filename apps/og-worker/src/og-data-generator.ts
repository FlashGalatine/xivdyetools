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
import {
  ogTranslator,
  getLocalizedHarmonyName,
  getLocalizedVisionName,
} from './services/translator';
import type { LocaleCode, SheetKey, ToolKey } from '@xivdyetools/types';
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
  VisionType,
  ColorSheetCategory,
  CharacterGender,
  MatchingAlgorithm,
  Env,
} from './types';

// ============================================================================
// Localization (REFACTOR-001, 2026-04-28 audit)
// ============================================================================

// ogTranslator is shared from ./services/translator so SVG generators reuse
// the same preloaded instance — and the harmony / lens names below come from
// the same helpers the cards use, so the embed text and the picture inside it
// cannot disagree.

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

/** The per-tool 2a default card, for a share URL that resolves to nothing. */
function toolDefault(tool: ToolId, env: Env, locale: LocaleCode, description: string): OGData {
  return {
    title: `${getToolName(tool, locale)} | XIV Dye Tools`,
    description,
    url: `${env.APP_BASE_URL}/${tool}/`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/${tool}/default.png`, locale),
    siteName: 'XIV Dye Tools',
  };
}

function getToolName(tool: ToolId, locale: LocaleCode): string {
  return ogTranslator.getToolName(tool as ToolKey, locale);
}

function getSheetName(sheet: ColorSheetCategory, locale: LocaleCode): string {
  return ogTranslator.getSheetName(sheet as SheetKey, locale);
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
 * Get dye name and hex color by stainID (5.0: OG paths key on stainIDs)
 */
function getDyeInfo(stainID: number): { name: string; hex: string } | null {
  // OPT-023: O(1) map lookup via the shared helper
  const dye = getDyeByItemId(stainID);

  if (!dye) {
    return null;
  }

  return {
    name: dye.name,
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
  const dyeInfo = getDyeInfo(params.dye);
  const harmonyName = getLocalizedHarmonyName(params.harmony, locale);

  if (!dyeInfo) {
    return {
      title: `${harmonyName} Harmony | XIV Dye Tools`,
      description: `Explore ${harmonyName.toLowerCase()} color harmonies for FFXIV dyes.`,
      url: `${env.APP_BASE_URL}/harmony/`,
      imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/harmony/default.png`, locale),
      siteName: 'XIV Dye Tools',
    };
  }

  return {
    title: `${dyeInfo.name} - ${harmonyName} Harmony | XIV Dye Tools`,
    description: `Explore ${harmonyName.toLowerCase()} color harmonies for ${dyeInfo.name} (${dyeInfo.hex}) in FFXIV. Find matching dyes for your glamour!`,
    url: `${env.APP_BASE_URL}/harmony/?dye=${params.dye}&harmony=${params.harmony}&v=1`,
    imageUrl: withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/harmony/${params.dye}/${params.harmony}.png`, params.algo), locale),
    siteName: 'XIV Dye Tools',
    themeColor: dyeInfo.hex,
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
  const startDye = getDyeInfo(params.start);
  const endDye = getDyeInfo(params.end);

  if (!startDye || !endDye) {
    return {
      title: `${getToolName('gradient', locale)} | XIV Dye Tools`,
      description: 'Create smooth color gradients between FFXIV dyes.',
      url: `${env.APP_BASE_URL}/gradient/`,
      imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/gradient/default.png`, locale),
      siteName: 'XIV Dye Tools',
    };
  }

  return {
    title: `${startDye.name} to ${endDye.name} Gradient | XIV Dye Tools`,
    description: `${params.steps}-step gradient from ${startDye.name} (${startDye.hex}) to ${endDye.name} (${endDye.hex}). Find the perfect dye progression for your FFXIV glamour!`,
    url: `${env.APP_BASE_URL}/gradient/?start=${params.start}&end=${params.end}&steps=${params.steps}&v=1`,
    imageUrl: withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/gradient/${params.start}/${params.end}/${params.steps}.png`, params.algo), locale),
    siteName: 'XIV Dye Tools',
    themeColor: startDye.hex,
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
  const dyeA = getDyeInfo(params.dyeA);
  const dyeB = getDyeInfo(params.dyeB);
  const dyeC = params.dyeC ? getDyeInfo(params.dyeC) : null;

  if (!dyeA || !dyeB) {
    return {
      title: `${getToolName('mixer', locale)} | XIV Dye Tools`,
      description: 'Mix FFXIV dyes and find the closest matching result.',
      url: `${env.APP_BASE_URL}/mixer/`,
      imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/mixer/default.png`, locale),
      siteName: 'XIV Dye Tools',
    };
  }

  // 3-dye mix
  if (dyeC) {
    return {
      title: `${dyeA.name} + ${dyeB.name} + ${dyeC.name} | XIV Dye Tools`,
      description: `Mix ${dyeA.name}, ${dyeB.name}, and ${dyeC.name} to find matching FFXIV dyes for your perfect blend!`,
      url: `${env.APP_BASE_URL}/mixer/?dyeA=${params.dyeA}&dyeB=${params.dyeB}&dyeC=${params.dyeC}&v=1`,
      imageUrl: withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/mixer/${params.dyeA}/${params.dyeB}/${params.dyeC}/${params.ratio}.png`, params.algo), locale),
      siteName: 'XIV Dye Tools',
      themeColor: dyeA.hex,
    };
  }

  // 2-dye mix
  return {
    title: `${params.ratio}% ${dyeA.name} + ${100 - params.ratio}% ${dyeB.name} | XIV Dye Tools`,
    description: `Mix ${params.ratio}% ${dyeA.name} with ${100 - params.ratio}% ${dyeB.name} to find matching FFXIV dyes for your perfect blend!`,
    url: `${env.APP_BASE_URL}/mixer/?dyeA=${params.dyeA}&dyeB=${params.dyeB}&ratio=${params.ratio}&v=1`,
    imageUrl: withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/mixer/${params.dyeA}/${params.dyeB}/${params.ratio}.png`, params.algo), locale),
    siteName: 'XIV Dye Tools',
    themeColor: dyeA.hex,
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
  let description = `Find the top ${limit} FFXIV dyes that match ${hexColor}.`;

  if (sheet) {
    const isRaceSpecific = sheet === 'hairColors' || sheet === 'skinColors';
    const sheetName = getSheetName(sheet, locale).toLowerCase();
    if (isRaceSpecific && race && gender) {
      description = `Find FFXIV dyes matching this ${gender} ${race} ${sheetName} (${hexColor}).`;
    } else {
      description = `Find FFXIV dyes matching this ${sheetName} (${hexColor}).`;
    }
  } else {
    description += ' Perfect for matching character colors or custom palettes!';
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
  const imageUrl = withLang(withAlgo(`${env.OG_IMAGE_BASE_URL}/swatch/${params.color}/${limit}.png`, params.algo), locale);

  return {
    title: `Match ${hexColor} | XIV Dye Tools`,
    description,
    url: `${env.APP_BASE_URL}/swatch/?${urlParams.toString()}`,
    imageUrl,
    siteName: 'XIV Dye Tools',
    themeColor: hexColor,
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
  const dyes = params.dyes.slice(0, 4).map(getDyeInfo).filter(Boolean);

  if (dyes.length === 0) {
    return {
      title: `${getToolName('comparison', locale)} | XIV Dye Tools`,
      description: 'Compare up to 4 FFXIV dyes side by side.',
      url: `${env.APP_BASE_URL}/comparison/`,
      imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/comparison/default.png`, locale),
      siteName: 'XIV Dye Tools',
    };
  }

  const dyeNames = dyes.map((d) => d!.name).join(', ');

  return {
    title: `Compare: ${dyeNames} | XIV Dye Tools`,
    description: `Side-by-side comparison of ${dyes.length} FFXIV dyes: ${dyeNames}. See how they look together!`,
    url: `${env.APP_BASE_URL}/comparison/?dyes=${params.dyes.join(',')}&v=1`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/comparison/${params.dyes.join(',')}.png`, locale),
    siteName: 'XIV Dye Tools',
    themeColor: dyes[0]!.hex,
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
  const dyes = params.dyes.slice(0, 4).map(getDyeInfo).filter(Boolean);
  const visionName = params.vision ? getLocalizedVisionName(params.vision, locale) : 'Color Vision';

  if (dyes.length === 0) {
    return {
      title: `${getToolName('accessibility', locale)} | XIV Dye Tools`,
      description: 'Check how FFXIV dyes appear to players with color vision differences.',
      url: `${env.APP_BASE_URL}/accessibility/`,
      imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/accessibility/default.png`, locale),
      siteName: 'XIV Dye Tools',
    };
  }

  const dyeNames = dyes.map((d) => d!.name).join(', ');

  return {
    title: `${visionName}: ${dyeNames} | XIV Dye Tools`,
    description: `See how ${dyeNames} appear with ${visionName.toLowerCase()}. Design inclusive glamours!`,
    url: `${env.APP_BASE_URL}/accessibility/?dyes=${params.dyes.join(',')}&vision=${params.vision || 'normal'}&v=1`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/accessibility/${params.dyes.join(',')}/${params.vision || 'normal'}.png`, locale),
    siteName: 'XIV Dye Tools',
    themeColor: dyes[0]!.hex,
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
    return toolDefault('extractor', env, locale, 'Pull the palette from any image and match every color to a buyable FFXIV dye.');
  }

  const list = colors.map((c) => `#${c}`).join(', ');
  const algoQuery = params.algo ? `&algo=${encodeURIComponent(params.algo)}` : '';

  return {
    title: `${colors.length}-color palette | XIV Dye Tools`,
    description: `Colors extracted from an image (${list}), each matched to the nearest FFXIV dye.`,
    // Commas stay literal (like comparison's dyes=) — the SPA reads them either way
    url: `${env.APP_BASE_URL}/extractor/?colors=${colors.join(',')}${algoQuery}&v=1`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/extractor/${colors.join(',')}.png`, locale),
    siteName: 'XIV Dye Tools',
    themeColor: `#${colors[0]}`,
  };
}

/**
 * Generate OG data for Community Presets (5.0). Only the curated set has a
 * card (the worker bundles `presetData`); a community id or an unknown slug
 * degrades to the tool default rather than inventing a palette.
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
    return toolDefault('presets', env, locale, 'Curated and community FFXIV dye palettes — browse, vote, submit your own.');
  }

  const dyes = preset.dyes.map(getDyeInfo).filter((d): d is { name: string; hex: string } => d !== null);
  const dyeNames = dyes.map((d) => d.name).join(', ');

  return {
    title: `${preset.name} — ${getToolName('presets', locale)} | XIV Dye Tools`,
    description: dyeNames
      ? `Curated FFXIV dye palette: ${dyeNames}.${preset.description ? ` ${preset.description}` : ''}`
      : `Curated FFXIV dye palette. ${preset.description ?? ''}`.trim(),
    url: `${env.APP_BASE_URL}/presets/${preset.id}`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/presets/${preset.id}.png`, locale),
    siteName: 'XIV Dye Tools',
    themeColor: dyes[0]?.hex,
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
  const target = params.dye !== null ? getDyeInfo(params.dye) : null;
  if (!target || params.dye === null) {
    return toolDefault('budget', env, locale, 'The cheapest FFXIV dye near the one you want, priced from the market board.');
  }

  return {
    title: `Budget alternatives for ${target.name} | XIV Dye Tools`,
    description: `Cheaper FFXIV dyes near ${target.name} (${target.hex}), ranked by color distance and priced from the market board.`,
    url: `${env.APP_BASE_URL}/budget/?dye=${params.dye}&v=1`,
    imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/budget/${params.dye}.png`, locale),
    siteName: 'XIV Dye Tools',
    themeColor: target.hex,
  };
}

// ============================================================================
// HTML Template Generator
// ============================================================================

/** Append the X frame selector to an image URL (respects existing queries). */
function withFrameX(imageUrl: string): string {
  return imageUrl.includes('?') ? `${imageUrl}&frame=x` : `${imageUrl}?frame=x`;
}

/**
 * Generate HTML with OpenGraph meta tags for crawler consumption.
 *
 * This HTML includes:
 * - Standard OG tags (og:title, og:description, og:image, etc.)
 * - Twitter Card tags
 * - Discord-specific theme-color
 * - A meta refresh to redirect JS-enabled browsers to the real page
 *
 * @param ogData - The OpenGraph data to include in meta tags
 * @returns Complete HTML string
 */
export function generateOGHTML(ogData: OGData): string {
  const themeColorTag = ogData.themeColor
    ? `<meta name="theme-color" content="${escapeHtml(ogData.themeColor)}">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Primary Meta Tags -->
  <title>${escapeHtml(ogData.title)}</title>
  <meta name="title" content="${escapeHtml(ogData.title)}">
  <meta name="description" content="${escapeHtml(ogData.description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="website">
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
      <p><a href="${escapeHtml(ogData.url)}">Open XIV Dye Tools →</a></p>
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
    case 'harmony': {
      const params: HarmonyParams = {
        dye: parseInt(searchParams.get('dye') || '0', 10),
        harmony: (searchParams.get('harmony') || 'complementary').toLowerCase() as HarmonyParams['harmony'],
        algo: searchParams.get('algo') as HarmonyParams['algo'],
      };
      return generateHarmonyOGData(params, env, locale);
    }

    case 'gradient': {
      const params: GradientParams = {
        start: parseInt(searchParams.get('start') || '0', 10),
        end: parseInt(searchParams.get('end') || '0', 10),
        steps: parseInt(searchParams.get('steps') || '5', 10),
        algo: searchParams.get('algo') as GradientParams['algo'],
      };
      return generateGradientOGData(params, env, locale);
    }

    case 'mixer': {
      const dyeCRaw = searchParams.get('dyeC');
      const params: MixerParams = {
        dyeA: parseInt(searchParams.get('dyeA') || '0', 10),
        dyeB: parseInt(searchParams.get('dyeB') || '0', 10),
        dyeC: dyeCRaw ? parseInt(dyeCRaw, 10) : undefined,
        ratio: parseInt(searchParams.get('ratio') || '50', 10),
        algo: searchParams.get('algo') as MixerParams['algo'],
      };
      return generateMixerOGData(params, env, locale);
    }

    case 'swatch': {
      const params: SwatchParams = {
        color: searchParams.get('hex') || searchParams.get('color') || 'FFFFFF',
        algo: searchParams.get('algo') as SwatchParams['algo'],
        limit: parseInt(searchParams.get('limit') || '5', 10),
        sheet: searchParams.get('sheet') as ColorSheetCategory | undefined,
        race: searchParams.get('race') || undefined,
        gender: searchParams.get('gender') as CharacterGender | undefined,
      };
      return generateSwatchOGData(params, env, locale);
    }

    case 'comparison': {
      const dyesParam = searchParams.get('dyes') || '';
      const params: ComparisonParams = {
        dyes: dyesParam
          .split(',')
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id)),
      };
      return generateComparisonOGData(params, env, locale);
    }

    case 'accessibility': {
      const dyesParam = searchParams.get('dyes') || '';
      const params: AccessibilityParams = {
        dyes: dyesParam
          .split(',')
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id)),
        vision: searchParams.get('vision') as VisionType | undefined,
      };
      return generateAccessibilityOGData(params, env, locale);
    }

    case 'extractor': {
      const params: ExtractorParams = {
        colors: (searchParams.get('colors') || '')
          .split(',')
          .map((c) => c.trim().replace(/^#/, '').toUpperCase())
          .filter((c) => /^[0-9A-F]{6}$/.test(c)),
        algo: searchParams.get('algo') as ExtractorParams['algo'],
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
        title: 'XIV Dye Tools',
        description: 'Explore FFXIV dye colors, create harmonious palettes, and find your perfect glamour combinations.',
        url: env.APP_BASE_URL,
        imageUrl: withLang(`${env.OG_IMAGE_BASE_URL}/default.png`, locale),
        siteName: 'XIV Dye Tools',
      };
    }
  }
}
