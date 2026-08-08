/**
 * XIV Dye Tools OpenGraph Worker
 *
 * This Cloudflare Worker intercepts requests to shared dye tool links and serves
 * dynamic OpenGraph metadata to social media crawlers (Discord, Twitter, Facebook, etc.).
 *
 * Flow:
 * 1. User shares a link like: https://xivdyetools.app/harmony/?dye=5771&harmony=tetradic
 * 2. Discord/Twitter crawler fetches that URL
 * 3. This worker detects the crawler by User-Agent
 * 4. If crawler: Returns HTML with dynamic og:meta tags + og:image URL
 * 5. If regular user: Proxies to the SPA (or lets Cloudflare serve it)
 *
 * @module index
 */

import { normalizeMatchingMethod } from '@xivdyetools/core';
import { Hono, type Context } from 'hono';
import {
  requestIdMiddleware,
  loggerMiddleware,
  getLogger,
} from '@xivdyetools/worker-kit';
import { extractLocaleCode } from '@xivdyetools/core';
import type { LocaleCode } from '@xivdyetools/types';
import { detectCrawlerFromRequest, getCrawlerName } from './crawler-detector';
import { generateOGDataForTool, generateOGHTML } from './og-data-generator';
import { renderOGImage } from './services/renderer';
import {
  generateHarmonyOG,
  generateGradientOG,
  generateMixerOG,
  generateSwatchOG,
  generateComparisonOG,
  generateAccessibilityOG,
  generateExtractorOG,
  generatePresetsOG,
  generateBudgetOG,
  generateDefaultCard,
  DEFAULT_DECK,
} from './services/svg';
import type { Env, ToolId, AnalyticsEvent, HarmonyType, MatchingAlgorithm, VisionType } from './types';

// ============================================================================
// Constants
// ============================================================================

/** 15E band cards: 400-grid SVG rastered ×3 on the band ground. */
const BAND_RENDER = { scale: 3, background: '#0B0B0C' } as const;

/** The X frame rides ?frame=x (the tag-based branch — twitter:image only). */
function frameFromQuery(c: { req: { query: (k: string) => string | undefined } }): 'discord' | 'x' {
  return c.req.query('frame') === 'x' ? 'x' : 'discord';
}

const SUPPORTED_TOOLS: ToolId[] = [
  'harmony',
  'gradient',
  'mixer',
  'swatch',
  'comparison',
  'accessibility',
  'extractor',
  'presets',
  'budget',
];

// FINDING-003: Parameter bounds for OG image generation routes
// Prevents resource exhaustion from excessively large image parameters
const OG_MAX_GRADIENT_STEPS = 20;
const OG_MAX_MIXER_RATIO = 99;
const OG_MIN_MIXER_RATIO = 1;
const OG_MAX_SWATCH_LIMIT = 20;
const OG_MAX_COMPARISON_DYES = 16;

// BUG-002: Valid enum values for string route/query params.
// Using readonly string[] so .includes() accepts any string without type casts.
const VALID_HARMONY_TYPES: readonly string[] = [
  'complementary', 'analogous', 'triadic', 'split-complementary',
  'tetradic', 'inverted-tetradic', 'square', 'monochromatic', 'compound', 'shades',
];
// 5.0 vocabulary + the legacy spellings normalizeMatchingMethod accepts
const VALID_ALGORITHMS: readonly string[] = [
  'ciede2000',
  'oklab',
  'cie76',
  'redmean',
  'rgb',
  'distinguish',
  // legacy (normalised on use)
  'euclidean',
  'hyab',
  'oklch-weighted',
];
const VALID_VISION_TYPES: readonly string[] = [
  'normal', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia',
];

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// Middleware: Observability (request ID + structured logger)
// REFACTOR-002 (2026-04-28 audit): aligns og-worker with the shared
// @xivdyetools/worker-middleware stack used by presets-api / discord-worker.
// ============================================================================

app.use('*', requestIdMiddleware());
app.use(
  '*',
  loggerMiddleware({
    serviceName: 'xivdyetools-og-worker',
    logUserAgent: true,
  }),
);

// ============================================================================
// Middleware: Analytics Tracking
// ============================================================================

/**
 * Track analytics events using Cloudflare Analytics Engine.
 */
function trackAnalytics(env: Env, event: AnalyticsEvent): void {
  if (!env.ANALYTICS) {
    return;
  }

  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [event.event, event.tool, event.crawler],
      doubles: [event.timestamp, event.cacheHit ? 1 : 0],
      indexes: [event.tool],
    });
  } catch (error) {
    // Silently fail - analytics shouldn't break the request
    console.error('[Analytics] Failed to track event:', error);
  }
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * Health check endpoint
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'xivdyetools-og-worker',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Tool route handler factory
 * Creates a route handler for each supported tool
 */
/**
 * Resolve the locale for an OG request.
 *
 * Priority: ?lang= query param → 'en' fallback. The query value is validated
 * against SUPPORTED_LOCALES (via extractLocaleCode) before being trusted.
 */
/**
 * BUG-069: is this request addressed to the worker's own image custom domain?
 * (On that host the worker is the origin, so pass-through fetch would 1042.)
 */
function isOgImageHost(url: URL, env: Env): boolean {
  try {
    return url.hostname === new URL(env.OG_IMAGE_BASE_URL).hostname;
  } catch {
    return false;
  }
}

function resolveLocale(searchParams: URLSearchParams): LocaleCode {
  const raw = searchParams.get('lang');
  if (!raw) return 'en';
  return extractLocaleCode(raw) ?? 'en';
}

function createToolHandler(tool: ToolId) {
  return async (c: Context<{ Bindings: Env }>) => {
    const request = c.req.raw;
    const env = c.env;
    const url = new URL(request.url);
    const crawlerInfo = detectCrawlerFromRequest(request);
    const locale = resolveLocale(url.searchParams);

    // Track analytics
    trackAnalytics(env, {
      event: 'og_request',
      tool,
      crawler: crawlerInfo.type,
      cacheHit: false,
      timestamp: Date.now(),
    });

    // If not a crawler, let the request pass through to the origin (SPA)
    if (!crawlerInfo.isCrawler) {
      // BUG-069: on the og. custom domain this worker IS the origin —
      // fetch(request) would self-fetch and surface CF error 1042 as a 5xx.
      if (isOgImageHost(url, env)) {
        return Response.redirect(env.APP_BASE_URL, 302);
      }
      // Pass through to origin - the SPA will handle it
      // In production, this would be proxied to the static site
      return fetch(request);
    }

    // Generate OG data for this tool (locale-aware display names)
    const ogData = generateOGDataForTool(tool, url.searchParams, env, locale);

    // Structured request log (replaces ad-hoc console.log)
    getLogger(c)?.info('Serving OG metadata', {
      tool,
      locale,
      crawler: getCrawlerName(crawlerInfo.type),
      url: url.toString(),
      title: ogData.title,
    });

    // Generate and return HTML with OG tags
    const html = generateOGHTML(ogData);

    return c.text(html, 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400', // 1h browser, 24h edge
    });
  };
}

// ============================================================================
// Register Tool Routes
// ============================================================================

// Register routes for each tool
// Pattern: /{tool}/* to catch both /{tool}/ and /{tool}/?params
for (const tool of SUPPORTED_TOOLS) {
  app.get(`/${tool}`, createToolHandler(tool));
  app.get(`/${tool}/`, createToolHandler(tool));
}

// ============================================================================
// OG Image Generation Routes
// ============================================================================

/**
 * The 2a default cards (confirmed 2026-08-07): a default never fakes data —
 * the mark's six stripes carry identity, the tool's banner glyph floats in a
 * dark tile, and the deck explains. The root card takes no tile and drops
 * the method tag.
 */
function buildDefaultCardSvg(tool: ToolId | null, frame: 'discord' | 'x'): string {
  if (tool && DEFAULT_DECK[tool]) {
    const deck = DEFAULT_DECK[tool];
    return generateDefaultCard({
      tool: { glyphName: deck.glyphName, label: deck.label },
      name: deck.name,
      sub: deck.sub,
      path: `xivdyetools.app/${tool}`,
      methodTag: tool === 'presets' ? 'CURATED' : 'ΔE2000',
      frame,
    });
  }
  return generateDefaultCard({
    tool: null,
    name: 'XIV Dye Tools',
    sub: 'Colour tools for FFXIV dyes — harmony, matching, prices, accessibility.',
    path: 'xivdyetools.app',
    methodTag: null,
    frame,
  });
}

/**
 * Per-tool default OG image — the fallback the meta tags emit when a tool
 * URL carries no parameters. Registered before the parameterised tool routes
 * so /og/comparison/default.png never parses "default.png" as a dye list.
 */
app.get('/og/:tool/default.png', async (c) => {
  const tool = c.req.param('tool') as ToolId;
  if (!SUPPORTED_TOOLS.includes(tool)) {
    return c.json({ error: 'Unknown tool' }, 404);
  }
  return renderOGImage(
    buildDefaultCardSvg(tool, frameFromQuery(c)),
    { browser: 86400, edge: 604800 },
    BAND_RENDER
  );
});

/**
 * Harmony tool OG image
 * Pattern: /og/harmony/:dyeId/:harmonyType.png
 */
app.get('/og/harmony/:dyeId/:harmonyType', async (c) => {
  const dyeId = parseInt(c.req.param('dyeId'), 10);
  const harmonyTypeRaw = c.req.param('harmonyType').replace('.png', '');
  const harmonyType = harmonyTypeRaw.toLowerCase() as HarmonyType;
  const algorithm = (c.req.query('algo') || 'oklab') as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // FINDING-011: Validate dyeId to prevent NaN propagation
  if (isNaN(dyeId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  // BUG-002: Validate string enum params
  if (!VALID_HARMONY_TYPES.includes(harmonyTypeRaw)) {
    return c.json({ error: `Invalid harmony type: ${harmonyTypeRaw}` }, 400);
  }
  if (!VALID_ALGORITHMS.includes(algorithm)) {
    return c.json({ error: `Invalid algorithm: ${algorithm}` }, 400);
  }

  // Track analytics
  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'harmony',
    crawler: 'none', // Image requests don't have crawler detection
    cacheHit: false,
    timestamp: Date.now(),
  });

  const svg = generateHarmonyOG({
    dyeId,
    harmonyType,
    algorithm,
    locale,
    frame: frameFromQuery(c),
  });

  return renderOGImage(svg, undefined, BAND_RENDER);
});

/**
 * Gradient tool OG image
 * Pattern: /og/gradient/:startId/:endId/:steps.png
 */
app.get('/og/gradient/:startId/:endId/:steps', async (c) => {
  const startDyeId = parseInt(c.req.param('startId'), 10);
  const endDyeId = parseInt(c.req.param('endId'), 10);
  const steps = parseInt(c.req.param('steps').replace('.png', ''), 10);
  const algorithm = (c.req.query('algo') || 'oklab') as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // FINDING-011: Validate dye IDs to prevent NaN propagation
  if (isNaN(startDyeId) || isNaN(endDyeId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  // BUG-002: Validate algorithm param
  if (!VALID_ALGORITHMS.includes(algorithm)) {
    return c.json({ error: `Invalid algorithm: ${algorithm}` }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'gradient',
    crawler: 'none',
    cacheHit: false,
    timestamp: Date.now(),
  });

  if (isNaN(steps) || steps < 2 || steps > OG_MAX_GRADIENT_STEPS) {
    return c.json({ error: `steps must be between 2 and ${OG_MAX_GRADIENT_STEPS}` }, 400);
  }

  const svg = generateGradientOG({
    startDyeId,
    endDyeId,
    steps,
    algorithm,
    locale,
    frame: frameFromQuery(c),
  });

  return renderOGImage(svg, undefined, BAND_RENDER);
});

/**
 * Mixer tool OG image (2 dyes)
 * Pattern: /og/mixer/:dyeAId/:dyeBId/:ratio.png
 */
app.get('/og/mixer/:dyeAId/:dyeBId/:ratio', async (c) => {
  const dyeAId = parseInt(c.req.param('dyeAId'), 10);
  const dyeBId = parseInt(c.req.param('dyeBId'), 10);
  const ratio = parseInt(c.req.param('ratio').replace('.png', ''), 10);
  const algorithm = (c.req.query('algo') || 'oklab') as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // FINDING-011: Validate dye IDs to prevent NaN propagation
  if (isNaN(dyeAId) || isNaN(dyeBId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  // BUG-002: Validate algorithm param
  if (!VALID_ALGORITHMS.includes(algorithm)) {
    return c.json({ error: `Invalid algorithm: ${algorithm}` }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'mixer',
    crawler: 'none',
    cacheHit: false,
    timestamp: Date.now(),
  });

  if (isNaN(ratio) || ratio < OG_MIN_MIXER_RATIO || ratio > OG_MAX_MIXER_RATIO) {
    return c.json({ error: `ratio must be between ${OG_MIN_MIXER_RATIO} and ${OG_MAX_MIXER_RATIO}` }, 400);
  }

  const svg = generateMixerOG({
    dyeAId,
    dyeBId,
    ratio,
    algorithm,
    locale,
    frame: frameFromQuery(c),
  });

  return renderOGImage(svg, undefined, BAND_RENDER);
});

/**
 * Mixer tool OG image (3 dyes)
 * Pattern: /og/mixer/:dyeAId/:dyeBId/:dyeCId/:ratio.png
 */
app.get('/og/mixer/:dyeAId/:dyeBId/:dyeCId/:ratio', async (c) => {
  const dyeAId = parseInt(c.req.param('dyeAId'), 10);
  const dyeBId = parseInt(c.req.param('dyeBId'), 10);
  const dyeCId = parseInt(c.req.param('dyeCId'), 10);
  const ratio = parseInt(c.req.param('ratio').replace('.png', ''), 10);
  const algorithm = (c.req.query('algo') || 'oklab') as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // FINDING-011: Validate dye IDs to prevent NaN propagation
  if (isNaN(dyeAId) || isNaN(dyeBId) || isNaN(dyeCId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  // BUG-002: Validate algorithm param
  if (!VALID_ALGORITHMS.includes(algorithm)) {
    return c.json({ error: `Invalid algorithm: ${algorithm}` }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'mixer',
    crawler: 'none',
    cacheHit: false,
    timestamp: Date.now(),
  });

  if (isNaN(ratio) || ratio < OG_MIN_MIXER_RATIO || ratio > OG_MAX_MIXER_RATIO) {
    return c.json({ error: `ratio must be between ${OG_MIN_MIXER_RATIO} and ${OG_MAX_MIXER_RATIO}` }, 400);
  }

  const svg = generateMixerOG({
    dyeAId,
    dyeBId,
    dyeCId,
    ratio,
    algorithm,
    locale,
    frame: frameFromQuery(c),
  });

  return renderOGImage(svg, undefined, BAND_RENDER);
});

/**
 * Swatch tool OG image
 * Pattern: /og/swatch/:color/:limit.png?sheet=X&race=Y&gender=Z
 */
app.get('/og/swatch/:color/:limit', async (c) => {
  const color = c.req.param('color');
  const limit = parseInt(c.req.param('limit').replace('.png', ''), 10);
  const algorithm = (c.req.query('algo') || 'oklab') as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // Parse optional sheet context params
  const sheet = c.req.query('sheet') as import('./types').ColorSheetCategory | undefined;
  const race = c.req.query('race') || undefined;
  const gender = c.req.query('gender') as import('./types').CharacterGender | undefined;

  // BUG-002: Validate algorithm param
  if (!VALID_ALGORITHMS.includes(algorithm)) {
    return c.json({ error: `Invalid algorithm: ${algorithm}` }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'swatch',
    crawler: 'none',
    cacheHit: false,
    timestamp: Date.now(),
  });

  if (isNaN(limit) || limit < 1 || limit > OG_MAX_SWATCH_LIMIT) {
    return c.json({ error: `limit must be between 1 and ${OG_MAX_SWATCH_LIMIT}` }, 400);
  }

  const svg = await generateSwatchOG({
    frame: frameFromQuery(c),
    color,
    limit,
    algorithm,
    sheet,
    race,
    gender,
    locale,
  });

  return renderOGImage(svg, undefined, BAND_RENDER);
});

/**
 * Comparison tool OG image
 * Pattern: /og/comparison/:dyes.png
 * where dyes is comma-separated itemIDs (e.g., "5771,5772,5773")
 */
app.get('/og/comparison/:dyes', async (c) => {
  const dyesParam = c.req.param('dyes').replace('.png', '');
  const dyeIds = dyesParam.split(',').map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  if (dyeIds.length === 0 || dyeIds.length > OG_MAX_COMPARISON_DYES) {
    return c.json({ error: `comparison requires 1–${OG_MAX_COMPARISON_DYES} valid dye IDs` }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'comparison',
    crawler: 'none',
    cacheHit: false,
    timestamp: Date.now(),
  });

  const svg = generateComparisonOG({ dyeIds, locale });

  return renderOGImage(svg, undefined, BAND_RENDER);
});

/**
 * Accessibility tool OG image
 * Pattern: /og/accessibility/:dyes/:visionType.png
 */
app.get('/og/accessibility/:dyes/:visionType', async (c) => {
  const dyesParam = c.req.param('dyes');
  const visionTypeRaw = c.req.param('visionType').replace('.png', '');
  const visionType = visionTypeRaw.toLowerCase() as VisionType;
  const dyeIds = dyesParam.split(',').map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  if (dyeIds.length === 0 || dyeIds.length > OG_MAX_COMPARISON_DYES) {
    return c.json({ error: `accessibility requires 1–${OG_MAX_COMPARISON_DYES} valid dye IDs` }, 400);
  }

  // BUG-002: Validate visionType param
  if (!VALID_VISION_TYPES.includes(visionTypeRaw)) {
    return c.json({ error: `Invalid vision type: ${visionTypeRaw}` }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'accessibility',
    crawler: 'none',
    cacheHit: false,
    timestamp: Date.now(),
  });

  const svg = generateAccessibilityOG({
    dyeIds,
    visionType,
    locale,
    frame: frameFromQuery(c),
  });

  return renderOGImage(svg, undefined, BAND_RENDER);
});

/**
 * Extractor OG image (5.0, net-new)
 * Pattern: /og/extractor/:colors.png — colors = `RRGGBB-share` pairs,
 * comma-separated (e.g. 8E5A3C-31,C9A96A-24), max 5
 */
app.get('/og/extractor/:colors', async (c) => {
  const colorsParam = c.req.param('colors').replace('.png', '');
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  const entries = colorsParam
    .split(',')
    .slice(0, 5)
    .map((pair) => {
      const [hex, shareRaw] = pair.split('-');
      return { hex: hex ?? '', share: parseInt(shareRaw ?? '0', 10) };
    })
    .filter((e) => /^[0-9A-Fa-f]{6}$/.test(e.hex) && !isNaN(e.share) && e.share > 0);

  if (entries.length === 0) {
    return c.json({ error: 'extractor requires RRGGBB-share pairs' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'extractor',
    crawler: 'none',
    cacheHit: false,
    timestamp: Date.now(),
  });

  return renderOGImage(generateExtractorOG({ entries, locale, frame: frameFromQuery(c) }), undefined, BAND_RENDER);
});

/**
 * Presets OG image (5.0, net-new)
 * Pattern: /og/presets/:presetId.png — curated preset slug
 */
app.get('/og/presets/:presetId', async (c) => {
  const presetId = c.req.param('presetId').replace('.png', '');
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // Slugs only — reject anything that could not be a stored choice value
  if (!/^[a-z0-9-]{1,64}$/.test(presetId)) {
    return c.json({ error: 'Invalid preset id' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'presets',
    crawler: 'none',
    cacheHit: false,
    timestamp: Date.now(),
  });

  return renderOGImage(generatePresetsOG({ presetId, locale, frame: frameFromQuery(c) }), undefined, BAND_RENDER);
});

/**
 * Budget OG image (5.0, net-new)
 * Pattern: /og/budget/:dyeId.png — target dye stainID
 */
app.get('/og/budget/:dyeId', async (c) => {
  const dyeId = parseInt(c.req.param('dyeId').replace('.png', ''), 10);
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  if (isNaN(dyeId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'budget',
    crawler: 'none',
    cacheHit: false,
    timestamp: Date.now(),
  });

  return renderOGImage(generateBudgetOG({ dyeId, locale, frame: frameFromQuery(c) }), undefined, BAND_RENDER);
});

/**
 * Default/fallback OG image
 */
app.get('/og/default.png', async (c) => {
  // BUG-068: explicit TTLs — 24h browser / 7d edge (the old param was
  // multiplied by 7 internally, yielding a 49-day edge TTL)
  return renderOGImage(
    buildDefaultCardSvg(null, frameFromQuery(c)),
    { browser: 86400, edge: 604800 },
    BAND_RENDER
  );
});

// ============================================================================
// Fallback Routes
// ============================================================================

/**
 * Root route - show info or redirect to main site
 */
app.get('/', (c) => {
  const crawlerInfo = detectCrawlerFromRequest(c.req.raw);

  if (crawlerInfo.isCrawler) {
    // Return generic OG data for root
    const ogData = {
      title: 'XIV Dye Tools - FFXIV Color & Dye Companion',
      description:
        'Explore FFXIV dye colors, create harmonious palettes, build gradients, mix colors, and find your perfect glamour combinations. Free web tools for Final Fantasy XIV players.',
      url: c.env.APP_BASE_URL,
      imageUrl: `${c.env.OG_IMAGE_BASE_URL}/default.png`,
      siteName: 'XIV Dye Tools',
    };

    const html = generateOGHTML(ogData);
    return c.text(html, 200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=86400', // 24h
    });
  }

  // Regular user - redirect to main site
  return Response.redirect(c.env.APP_BASE_URL, 302);
});

/**
 * Catch-all route for unknown paths
 * Pass through to origin for regular users, return 404 for crawlers
 */
app.all('*', (c) => {
  const crawlerInfo = detectCrawlerFromRequest(c.req.raw);

  if (crawlerInfo.isCrawler) {
    // Unknown route for crawler - return minimal OG tags
    const ogData = {
      title: 'XIV Dye Tools',
      description: 'FFXIV Color & Dye Companion',
      url: c.env.APP_BASE_URL,
      imageUrl: `${c.env.OG_IMAGE_BASE_URL}/default.png`,
      siteName: 'XIV Dye Tools',
    };

    const html = generateOGHTML(ogData);
    return c.text(html, 200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
  }

  // BUG-069: never fetch(our own og. custom domain) — CF blocks worker
  // self-fetch (error 1042), so stray human/unknown-UA hits became 5xx.
  const url = new URL(c.req.url);
  if (isOgImageHost(url, c.env)) {
    return c.json({ error: 'Not found' }, 404);
  }

  // Pass through to origin for regular users
  return fetch(c.req.raw);
});

// ============================================================================
// Global Error Handler
// ============================================================================

app.onError((err, c) => {
  const logger = getLogger(c);
  if (logger) {
    logger.error('Unhandled error', err, { operation: 'globalErrorHandler' });
  } else {
    console.error('[OG Worker] Unhandled error:', err);
  }
  return c.json(
    {
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    },
    500,
  );
});

// ============================================================================
// Export Worker
// ============================================================================

export default app;
