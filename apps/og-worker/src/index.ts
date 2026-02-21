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

import { Hono } from 'hono';
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
  generateOGCard,
  THEME,
  FONTS,
  OG_DIMENSIONS,
  rect,
  text,
  circle,
} from './services/svg';
import type { Env, ToolId, AnalyticsEvent, HarmonyType, MatchingAlgorithm, VisionType } from './types';

// ============================================================================
// Constants
// ============================================================================

const SUPPORTED_TOOLS: ToolId[] = [
  'harmony',
  'gradient',
  'mixer',
  'swatch',
  'comparison',
  'accessibility',
];

// FINDING-003: Parameter bounds for OG image generation routes
// Prevents resource exhaustion from excessively large image parameters
const OG_MAX_GRADIENT_STEPS = 20;
const OG_MAX_MIXER_RATIO = 99;
const OG_MIN_MIXER_RATIO = 1;
const OG_MAX_SWATCH_LIMIT = 20;
const OG_MAX_COMPARISON_DYES = 16;

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

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
function createToolHandler(tool: ToolId) {
  return async (c: { req: { raw: Request }; env: Env; text: (html: string, status?: number, headers?: Record<string, string>) => Response }) => {
    const request = c.req.raw;
    const env = c.env;
    const url = new URL(request.url);
    const crawlerInfo = detectCrawlerFromRequest(request);

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
      // Pass through to origin - the SPA will handle it
      // In production, this would be proxied to the static site
      return fetch(request);
    }

    // Generate OG data for this tool
    const ogData = generateOGDataForTool(tool, url.searchParams, env);

    // Log for debugging
    console.log(
      `[OG Worker] Serving OG metadata for ${tool} to ${getCrawlerName(crawlerInfo.type)}`,
      {
        url: url.toString(),
        title: ogData.title,
      }
    );

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
 * Harmony tool OG image
 * Pattern: /og/harmony/:dyeId/:harmonyType.png
 */
app.get('/og/harmony/:dyeId/:harmonyType', async (c) => {
  const dyeId = parseInt(c.req.param('dyeId'), 10);
  const harmonyTypeRaw = c.req.param('harmonyType').replace('.png', '');
  const harmonyType = harmonyTypeRaw.toLowerCase() as HarmonyType;
  const algorithm = (c.req.query('algo') || 'oklab') as MatchingAlgorithm;

  // FINDING-011: Validate dyeId to prevent NaN propagation
  if (isNaN(dyeId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
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
  });

  return renderOGImage(svg);
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

  // FINDING-011: Validate dye IDs to prevent NaN propagation
  if (isNaN(startDyeId) || isNaN(endDyeId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
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
  });

  return renderOGImage(svg);
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

  // FINDING-011: Validate dye IDs to prevent NaN propagation
  if (isNaN(dyeAId) || isNaN(dyeBId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
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
  });

  return renderOGImage(svg);
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

  // FINDING-011: Validate dye IDs to prevent NaN propagation
  if (isNaN(dyeAId) || isNaN(dyeBId) || isNaN(dyeCId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
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
  });

  return renderOGImage(svg);
});

/**
 * Swatch tool OG image
 * Pattern: /og/swatch/:color/:limit.png?sheet=X&race=Y&gender=Z
 */
app.get('/og/swatch/:color/:limit', async (c) => {
  const color = c.req.param('color');
  const limit = parseInt(c.req.param('limit').replace('.png', ''), 10);
  const algorithm = (c.req.query('algo') || 'oklab') as MatchingAlgorithm;

  // Parse optional sheet context params
  const sheet = c.req.query('sheet') as import('./types').ColorSheetCategory | undefined;
  const race = c.req.query('race') || undefined;
  const gender = c.req.query('gender') as import('./types').CharacterGender | undefined;

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
    color,
    limit,
    algorithm,
    sheet,
    race,
    gender,
  });

  return renderOGImage(svg);
});

/**
 * Comparison tool OG image
 * Pattern: /og/comparison/:dyes.png
 * where dyes is comma-separated itemIDs (e.g., "5771,5772,5773")
 */
app.get('/og/comparison/:dyes', async (c) => {
  const dyesParam = c.req.param('dyes').replace('.png', '');
  const dyeIds = dyesParam.split(',').map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));

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

  const svg = generateComparisonOG({ dyeIds });

  return renderOGImage(svg);
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

  if (dyeIds.length === 0 || dyeIds.length > OG_MAX_COMPARISON_DYES) {
    return c.json({ error: `accessibility requires 1–${OG_MAX_COMPARISON_DYES} valid dye IDs` }, 400);
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
  });

  return renderOGImage(svg);
});

/**
 * Default/fallback OG image
 */
app.get('/og/default.png', async (c) => {
  // Generate a simple default image
  const contentElements: string[] = [];
  const centerX = OG_DIMENSIONS.width / 2;
  const centerY = OG_DIMENSIONS.height / 2;

  // Main title
  contentElements.push(
    text(centerX, centerY - 60, 'XIV DYE TOOLS', {
      fill: THEME.text,
      fontSize: 48,
      fontFamily: FONTS.header,
      fontWeight: 700,
      textAnchor: 'middle',
    })
  );

  // Subtitle
  contentElements.push(
    text(centerX, centerY, 'FFXIV Color & Dye Companion', {
      fill: THEME.textMuted,
      fontSize: 24,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  // Decorative color circles
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
  const circleY = centerY + 80;
  const circleSpacing = 70;
  const startX = centerX - ((colors.length - 1) * circleSpacing) / 2;

  colors.forEach((color, i) => {
    contentElements.push(circle(startX + i * circleSpacing, circleY, 22, color));
  });

  const svg = generateOGCard({
    toolName: 'XIV Dye Tools',
    content: contentElements.join('\n'),
  });

  return renderOGImage(svg, 604800); // Cache for 7 days
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

  // Pass through to origin for regular users
  return fetch(c.req.raw);
});

// ============================================================================
// Export Worker
// ============================================================================

export default app;
