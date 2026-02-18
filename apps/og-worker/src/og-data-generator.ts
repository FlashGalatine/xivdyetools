/**
 * OpenGraph Data Generator
 *
 * Generates HTML with dynamic OpenGraph meta tags for social media previews.
 * When a crawler requests a shared link, this module produces the HTML
 * that crawlers parse to generate rich link previews.
 *
 * @module og-data-generator
 */

import { DyeService, dyeDatabase, type Dye } from '@xivdyetools/core';
import type {
  OGData,
  ToolId,
  HarmonyParams,
  GradientParams,
  MixerParams,
  SwatchParams,
  ComparisonParams,
  AccessibilityParams,
  HarmonyType,
  VisionType,
  ColorSheetCategory,
  CharacterGender,
  Env,
} from './types';

// ============================================================================
// Tool Display Names
// ============================================================================

const TOOL_NAMES: Record<ToolId, string> = {
  harmony: 'Harmony Explorer',
  gradient: 'Gradient Builder',
  mixer: 'Dye Mixer',
  swatch: 'Swatch Matcher',
  comparison: 'Dye Comparison',
  accessibility: 'Accessibility Checker',
};

const HARMONY_NAMES: Record<HarmonyType, string> = {
  complementary: 'Complementary',
  analogous: 'Analogous',
  triadic: 'Triadic',
  'split-complementary': 'Split-Complementary',
  tetradic: 'Tetradic',
  square: 'Square',
  monochromatic: 'Monochromatic',
  compound: 'Compound',
  shades: 'Shades',
};

const VISION_NAMES: Record<VisionType, string> = {
  normal: 'Normal Vision',
  protanopia: 'Protanopia',
  deuteranopia: 'Deuteranopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
};

const SHEET_NAMES: Record<ColorSheetCategory, string> = {
  eyeColors: 'Eye Colors',
  highlightColors: 'Highlights',
  lipColorsDark: 'Lip Colors (Dark)',
  lipColorsLight: 'Lip Colors (Light)',
  tattooColors: 'Tattoo/Limbal',
  facePaintColorsDark: 'Face Paint (Dark)',
  facePaintColorsLight: 'Face Paint (Light)',
  hairColors: 'Hair Colors',
  skinColors: 'Skin Colors',
};

// ============================================================================
// DyeService Instance
// ============================================================================

/**
 * Initialize DyeService with the embedded dye database.
 * This runs once when the module is loaded.
 */
const dyeService = new DyeService(dyeDatabase);

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get dye name and hex color by itemID
 */
function getDyeInfo(itemID: number): { name: string; hex: string } | null {
  const allDyes = dyeService.getAllDyes();
  const dye = allDyes.find((d: Dye) => d.itemID === itemID);

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
export function generateHarmonyOGData(params: HarmonyParams, env: Env): OGData {
  const dyeInfo = getDyeInfo(params.dye);
  const harmonyName = HARMONY_NAMES[params.harmony] || params.harmony;

  if (!dyeInfo) {
    return {
      title: `${harmonyName} Harmony | XIV Dye Tools`,
      description: `Explore ${harmonyName.toLowerCase()} color harmonies for FFXIV dyes.`,
      url: `${env.APP_BASE_URL}/harmony/`,
      imageUrl: `${env.OG_IMAGE_BASE_URL}/harmony/default.png`,
      siteName: 'XIV Dye Tools',
    };
  }

  return {
    title: `${dyeInfo.name} - ${harmonyName} Harmony | XIV Dye Tools`,
    description: `Explore ${harmonyName.toLowerCase()} color harmonies for ${dyeInfo.name} (${dyeInfo.hex}) in FFXIV. Find matching dyes for your glamour!`,
    url: `${env.APP_BASE_URL}/harmony/?dye=${params.dye}&harmony=${params.harmony}&v=1`,
    imageUrl: `${env.OG_IMAGE_BASE_URL}/harmony/${params.dye}/${params.harmony}.png`,
    siteName: 'XIV Dye Tools',
    themeColor: dyeInfo.hex,
  };
}

/**
 * Generate OG data for Gradient Builder
 */
export function generateGradientOGData(params: GradientParams, env: Env): OGData {
  const startDye = getDyeInfo(params.start);
  const endDye = getDyeInfo(params.end);

  if (!startDye || !endDye) {
    return {
      title: 'Gradient Builder | XIV Dye Tools',
      description: 'Create smooth color gradients between FFXIV dyes.',
      url: `${env.APP_BASE_URL}/gradient/`,
      imageUrl: `${env.OG_IMAGE_BASE_URL}/gradient/default.png`,
      siteName: 'XIV Dye Tools',
    };
  }

  return {
    title: `${startDye.name} to ${endDye.name} Gradient | XIV Dye Tools`,
    description: `${params.steps}-step gradient from ${startDye.name} (${startDye.hex}) to ${endDye.name} (${endDye.hex}). Find the perfect dye progression for your FFXIV glamour!`,
    url: `${env.APP_BASE_URL}/gradient/?start=${params.start}&end=${params.end}&steps=${params.steps}&v=1`,
    imageUrl: `${env.OG_IMAGE_BASE_URL}/gradient/${params.start}/${params.end}/${params.steps}.png`,
    siteName: 'XIV Dye Tools',
    themeColor: startDye.hex,
  };
}

/**
 * Generate OG data for Dye Mixer
 */
export function generateMixerOGData(params: MixerParams, env: Env): OGData {
  const dyeA = getDyeInfo(params.dyeA);
  const dyeB = getDyeInfo(params.dyeB);
  const dyeC = params.dyeC ? getDyeInfo(params.dyeC) : null;

  if (!dyeA || !dyeB) {
    return {
      title: 'Dye Mixer | XIV Dye Tools',
      description: 'Mix FFXIV dyes and find the closest matching result.',
      url: `${env.APP_BASE_URL}/mixer/`,
      imageUrl: `${env.OG_IMAGE_BASE_URL}/mixer/default.png`,
      siteName: 'XIV Dye Tools',
    };
  }

  // 3-dye mix
  if (dyeC) {
    return {
      title: `${dyeA.name} + ${dyeB.name} + ${dyeC.name} | XIV Dye Tools`,
      description: `Mix ${dyeA.name}, ${dyeB.name}, and ${dyeC.name} to find matching FFXIV dyes for your perfect blend!`,
      url: `${env.APP_BASE_URL}/mixer/?dyeA=${params.dyeA}&dyeB=${params.dyeB}&dyeC=${params.dyeC}&v=1`,
      imageUrl: `${env.OG_IMAGE_BASE_URL}/mixer/${params.dyeA}/${params.dyeB}/${params.dyeC}/${params.ratio}.png`,
      siteName: 'XIV Dye Tools',
      themeColor: dyeA.hex,
    };
  }

  // 2-dye mix
  return {
    title: `${params.ratio}% ${dyeA.name} + ${100 - params.ratio}% ${dyeB.name} | XIV Dye Tools`,
    description: `Mix ${params.ratio}% ${dyeA.name} with ${100 - params.ratio}% ${dyeB.name} to find matching FFXIV dyes for your perfect blend!`,
    url: `${env.APP_BASE_URL}/mixer/?dyeA=${params.dyeA}&dyeB=${params.dyeB}&ratio=${params.ratio}&v=1`,
    imageUrl: `${env.OG_IMAGE_BASE_URL}/mixer/${params.dyeA}/${params.dyeB}/${params.ratio}.png`,
    siteName: 'XIV Dye Tools',
    themeColor: dyeA.hex,
  };
}

/**
 * Generate OG data for Swatch Matcher
 */
export function generateSwatchOGData(params: SwatchParams, env: Env): OGData {
  const hexColor = formatHex(params.color);
  const limit = params.limit || 5;
  const { sheet, race, gender } = params;

  // Build description based on available context
  let description = `Find the top ${limit} FFXIV dyes that match ${hexColor}.`;

  if (sheet) {
    const isRaceSpecific = sheet === 'hairColors' || sheet === 'skinColors';
    if (isRaceSpecific && race && gender) {
      description = `Find FFXIV dyes matching this ${gender} ${race} ${SHEET_NAMES[sheet].toLowerCase()} (${hexColor}).`;
    } else {
      description = `Find FFXIV dyes matching this ${SHEET_NAMES[sheet].toLowerCase()} (${hexColor}).`;
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

  // Build the OG image URL with query params for sheet context
  const imageUrlParams = new URLSearchParams();
  if (sheet) imageUrlParams.set('sheet', sheet);
  if (race) imageUrlParams.set('race', race);
  if (gender) imageUrlParams.set('gender', gender);
  if (params.algo) imageUrlParams.set('algo', params.algo);
  const imageQueryString = imageUrlParams.toString();
  const imageUrl = `${env.OG_IMAGE_BASE_URL}/swatch/${params.color}/${limit}.png${imageQueryString ? `?${imageQueryString}` : ''}`;

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
export function generateComparisonOGData(params: ComparisonParams, env: Env): OGData {
  const dyes = params.dyes.slice(0, 4).map(getDyeInfo).filter(Boolean);

  if (dyes.length === 0) {
    return {
      title: 'Dye Comparison | XIV Dye Tools',
      description: 'Compare up to 4 FFXIV dyes side by side.',
      url: `${env.APP_BASE_URL}/comparison/`,
      imageUrl: `${env.OG_IMAGE_BASE_URL}/comparison/default.png`,
      siteName: 'XIV Dye Tools',
    };
  }

  const dyeNames = dyes.map((d) => d!.name).join(', ');

  return {
    title: `Compare: ${dyeNames} | XIV Dye Tools`,
    description: `Side-by-side comparison of ${dyes.length} FFXIV dyes: ${dyeNames}. See how they look together!`,
    url: `${env.APP_BASE_URL}/comparison/?dyes=${params.dyes.join(',')}&v=1`,
    imageUrl: `${env.OG_IMAGE_BASE_URL}/comparison/${params.dyes.join(',')}.png`,
    siteName: 'XIV Dye Tools',
    themeColor: dyes[0]!.hex,
  };
}

/**
 * Generate OG data for Accessibility Checker
 */
export function generateAccessibilityOGData(params: AccessibilityParams, env: Env): OGData {
  const dyes = params.dyes.slice(0, 4).map(getDyeInfo).filter(Boolean);
  const visionName = params.vision ? VISION_NAMES[params.vision] : 'Color Vision';

  if (dyes.length === 0) {
    return {
      title: 'Accessibility Checker | XIV Dye Tools',
      description: 'Check how FFXIV dyes appear to players with color vision differences.',
      url: `${env.APP_BASE_URL}/accessibility/`,
      imageUrl: `${env.OG_IMAGE_BASE_URL}/accessibility/default.png`,
      siteName: 'XIV Dye Tools',
    };
  }

  const dyeNames = dyes.map((d) => d!.name).join(', ');

  return {
    title: `${visionName}: ${dyeNames} | XIV Dye Tools`,
    description: `See how ${dyeNames} appear with ${visionName.toLowerCase()}. Design inclusive glamours!`,
    url: `${env.APP_BASE_URL}/accessibility/?dyes=${params.dyes.join(',')}&vision=${params.vision || 'normal'}&v=1`,
    imageUrl: `${env.OG_IMAGE_BASE_URL}/accessibility/${params.dyes.join(',')}/${params.vision || 'normal'}.png`,
    siteName: 'XIV Dye Tools',
    themeColor: dyes[0]!.hex,
  };
}

// ============================================================================
// HTML Template Generator
// ============================================================================

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
    ? `<meta name="theme-color" content="${ogData.themeColor}">`
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
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${escapeHtml(ogData.siteName)}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${escapeHtml(ogData.url)}">
  <meta name="twitter:title" content="${escapeHtml(ogData.title)}">
  <meta name="twitter:description" content="${escapeHtml(ogData.description)}">
  <meta name="twitter:image" content="${escapeHtml(ogData.imageUrl)}">

  <!-- Discord embed color -->
  ${themeColorTag}

  <!-- Redirect for JavaScript-enabled browsers -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(ogData.url)}">

  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      background: #1a1a2e;
      color: #fff;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    a {
      color: #6366f1;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <p>Redirecting to XIV Dye Tools...</p>
    <p><a href="${escapeHtml(ogData.url)}">Click here if you're not redirected</a></p>
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
 * @returns OGData for the requested tool and parameters
 */
export function generateOGDataForTool(
  tool: ToolId,
  searchParams: URLSearchParams,
  env: Env
): OGData {
  switch (tool) {
    case 'harmony': {
      const params: HarmonyParams = {
        dye: parseInt(searchParams.get('dye') || '0', 10),
        harmony: (searchParams.get('harmony') || 'complementary').toLowerCase() as HarmonyParams['harmony'],
        algo: searchParams.get('algo') as HarmonyParams['algo'],
        perceptual: searchParams.get('perceptual') === '1',
      };
      return generateHarmonyOGData(params, env);
    }

    case 'gradient': {
      const params: GradientParams = {
        start: parseInt(searchParams.get('start') || '0', 10),
        end: parseInt(searchParams.get('end') || '0', 10),
        steps: parseInt(searchParams.get('steps') || '5', 10),
        algo: searchParams.get('algo') as GradientParams['algo'],
      };
      return generateGradientOGData(params, env);
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
      return generateMixerOGData(params, env);
    }

    case 'swatch': {
      const params: SwatchParams = {
        color: searchParams.get('color') || 'FFFFFF',
        algo: searchParams.get('algo') as SwatchParams['algo'],
        limit: parseInt(searchParams.get('limit') || '5', 10),
        sheet: searchParams.get('sheet') as ColorSheetCategory | undefined,
        race: searchParams.get('race') || undefined,
        gender: searchParams.get('gender') as CharacterGender | undefined,
      };
      return generateSwatchOGData(params, env);
    }

    case 'comparison': {
      const dyesParam = searchParams.get('dyes') || '';
      const params: ComparisonParams = {
        dyes: dyesParam
          .split(',')
          .map((id) => parseInt(id, 10))
          .filter((id) => !isNaN(id)),
      };
      return generateComparisonOGData(params, env);
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
      return generateAccessibilityOGData(params, env);
    }

    default: {
      // Fallback for unknown tools
      return {
        title: 'XIV Dye Tools',
        description: 'Explore FFXIV dye colors, create harmonious palettes, and find your perfect glamour combinations.',
        url: env.APP_BASE_URL,
        imageUrl: `${env.OG_IMAGE_BASE_URL}/default.png`,
        siteName: 'XIV Dye Tools',
      };
    }
  }
}
