/**
 * XIV Dye Tools OpenGraph Worker
 *
 * This Cloudflare Worker intercepts requests to shared dye tool links and serves
 * dynamic OpenGraph metadata to social media crawlers (Discord, Twitter, Facebook, etc.).
 *
 * Flow:
 * 1. User shares a link like: https://xivdyetools.app/harmony/?dye=102&harmony=tetradic
 *    (dye params are stainIDs — 102 is Jet Black; legacy item IDs miss into the default card)
 * 2. Discord/Twitter crawler fetches that URL
 * 3. This worker detects the crawler by User-Agent
 * 4. If crawler: Returns HTML with dynamic og:meta tags + og:image URL
 * 5. If regular user: Proxies to the SPA (or lets Cloudflare serve it)
 *
 * @module index
 */

import { DEFAULT_MATCHING_METHOD, extractLocaleCode } from '@xivdyetools/core';
import { Hono, type Context } from 'hono';
import {
  requestIdMiddleware,
  loggerMiddleware,
  getLogger,
} from '@xivdyetools/worker-kit';
import type { LocaleCode } from '@xivdyetools/types';
import { detectCrawlerFromRequest, getCrawlerName } from './crawler-detector';
import {
  generateOGDataForTool,
  generateOGHTML,
  generateRootOGData,
  generateFallbackOGData,
} from './og-data-generator';
import { getOgDeck, getToolTag, role } from './services/og-strings';
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
import {
  OG_MAX_COMPARISON_DYES,
  OG_MAX_GRADIENT_STEPS,
  OG_MAX_MIXER_RATIO,
  OG_MAX_SWATCH_LIMIT,
  OG_MIN_GRADIENT_STEPS,
  OG_MIN_MIXER_RATIO,
  isAlgorithm,
  isHarmonyType,
  isVisionType,
} from './og-params';
import type { Env, ToolId, AnalyticsEvent, HarmonyType, MatchingAlgorithm, VisionType } from './types';

// ============================================================================
// Constants
// ============================================================================

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

// FINDING-003 parameter bounds and BUG-002 enum allow-lists live in
// ./og-params — shared with the crawler so the embed and the image routes
// enforce ONE vocabulary (FINDING-024).

/**
 * FINDING-024 / OG-3: the crawler HTML runs in the production app origin.
 * Every value in it is escaped, so these are defence in depth — a CSP turns
 * a future escaping regression into a non-event — plus `Vary: User-Agent`,
 * because the body depends on the UA (a human gets the SPA, a bot this stub)
 * and the tool routes advertise a public cache lifetime.
 */
const CRAWLER_HTML_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

function crawlerHtml(
  c: Context<{ Bindings: Env }>,
  html: string,
  status: 200 | 404,
  cacheControl: string
): Response {
  return c.text(html, status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': cacheControl,
    Vary: 'User-Agent',
    'Content-Security-Policy': CRAWLER_HTML_CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
  });
}

// ============================================================================
// Hono App Setup
// ============================================================================

const app = new Hono<{ Bindings: Env }>();

// ============================================================================
// Middleware: Observability (request ID + structured logger)
// REFACTOR-002 (2026-04-28 audit): aligns og-worker with the shared
// @xivdyetools/worker-kit middleware stack used by presets-api / discord-worker.
// ============================================================================

app.use('*', requestIdMiddleware());
app.use(
  '*',
  loggerMiddleware({
    serviceName: 'xivdyetools-og-worker',
    // FINDING-024 / OG-7: the raw UA of every human page view on the nine
    // production tool paths is not ours to keep — crawler hits log theirs
    // explicitly in createToolHandler (that is the string worth having when
    // a new crawler needs a detector pattern).
    logUserAgent: false,
  }),
);

// ============================================================================
// Middleware: /og/* request guards (FINDING-005, 2026-08-21 security audit)
// ============================================================================

/** No legitimate /og/* path segment (hex, stainID list, preset UUID, …) is longer than this. */
const OG_MAX_SEGMENT_CHARS = 64;
/** And no legitimate /og/* path is longer than this. */
const OG_MAX_PATH_CHARS = 512;

/**
 * Reject oversized path segments before any card is generated. A 16 KB
 * `:color` used to reach the not-found card's text-wrap and burn minutes of
 * CPU; Cloudflare accepts URLs up to 16 KB, so the bound has to be ours.
 */
app.use('/og/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (
    path.length > OG_MAX_PATH_CHARS ||
    path.split('/').some((segment) => segment.length > OG_MAX_SEGMENT_CHARS)
  ) {
    return c.json({ error: 'Request path too long' }, 400);
  }
  await next();
  // FINDING-024 / OG-3 (defence in depth on the image surface): a card is a
  // PNG or a JSON error — never sniffed into anything else. Set after next()
  // so cache hits and fresh renders alike carry it.
  c.header('X-Content-Type-Options', 'nosniff');
  return c.res;
});

/**
 * Edge cache for rendered PNGs. The `Cache-Control` / `CDN-Cache-Control`
 * headers set by renderOGImage describe the TTLs but do nothing by themselves
 * on a Worker response — every hit was a full resvg raster. Key = full URL
 * (lang / frame / algo all vary the image), GET only, 200s only; the Cache
 * API honours the response's own s-maxage for expiry. Absent outside Workers
 * (tests, Node) → pass-through.
 */
app.use('/og/*', async (c, next) => {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache || c.req.method !== 'GET') {
    return next();
  }

  const cacheKey = new Request(c.req.url, { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) {
    return hit;
  }

  await next();

  const res = c.res;
  if (res.status === 200) {
    const put = cache.put(cacheKey, res.clone());
    try {
      c.executionCtx.waitUntil(put);
    } catch {
      // No execution context (unit tests / non-Workers runtime): complete inline
      await put;
    }
  }
  return res;
});

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
      doubles: [event.timestamp],
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

/**
 * FINDING-024 / OG-5: the only ingress host whose origin is the SPA. On any
 * other host — the og image host (BUG-069), a workers.dev hostname, wrangler
 * dev — `fetch(request)` would self-fetch (CF error 1042) or reach nothing,
 * so humans there are sent to the app instead of passed through.
 */
function isAppHost(url: URL, env: Env): boolean {
  try {
    return url.hostname === new URL(env.APP_BASE_URL).hostname;
  } catch {
    return false;
  }
}

/**
 * Resolve the locale for an OG request.
 *
 * Priority: ?lang= query param → 'en' fallback. The query value is validated
 * against SUPPORTED_LOCALES (via extractLocaleCode) before being trusted.
 */
function resolveLocale(searchParams: URLSearchParams): LocaleCode {
  const raw = searchParams.get('lang');
  if (!raw) return 'en';
  return extractLocaleCode(raw) ?? 'en';
}

/**
 * Tool route handler factory
 * Creates a route handler for each supported tool
 */
function createToolHandler(tool: ToolId) {
  return async (c: Context<{ Bindings: Env }>) => {
    const request = c.req.raw;
    const env = c.env;
    const url = new URL(request.url);
    const crawlerInfo = detectCrawlerFromRequest(request);
    const locale = resolveLocale(url.searchParams);

    // If not a crawler, let the request pass through to the origin (SPA)
    if (!crawlerInfo.isCrawler) {
      // BUG-069 / FINDING-024 (OG-5): only the app host has the SPA behind
      // it. On the og. custom domain this worker IS the origin (fetch(request)
      // would self-fetch → CF error 1042), and a workers.dev hostname or
      // wrangler dev has no origin at all — send humans to the app instead.
      if (!isAppHost(url, env)) {
        return Response.redirect(env.APP_BASE_URL, 302);
      }
      // Pass through to origin - the SPA will handle it
      return fetch(request);
    }

    // Track analytics — FINDING-024 / OG-7: one datapoint per crawler hit.
    // Human page views are the SPA's business (they were only cost here).
    trackAnalytics(env, {
      event: 'og_request',
      tool,
      crawler: crawlerInfo.type,
      timestamp: Date.now(),
    });

    // Generate OG data for this tool (locale-aware display names). Presets are
    // shared as a PATH (/presets/<id>) — hand the segment through.
    const pathId = tool === 'presets' ? (c.req.param('presetId') ?? null) : null;
    const ogData = generateOGDataForTool(tool, url.searchParams, env, locale, pathId);

    // Structured request log (replaces ad-hoc console.log). The crawler's UA
    // is logged HERE, and only here (OG-7) — it is the string you need when a
    // new crawler wants a detector pattern.
    getLogger(c)?.info('Serving OG metadata', {
      tool,
      locale,
      crawler: getCrawlerName(crawlerInfo.type),
      userAgent: crawlerInfo.userAgent,
      url: url.toString(),
      title: ogData.title,
    });

    // Generate and return HTML with OG tags — 1h browser, 24h edge (OG-3:
    // security headers + Vary: User-Agent ride along)
    const html = generateOGHTML(ogData);
    return crawlerHtml(c, html, 200, 'public, max-age=3600, s-maxage=86400');
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
// The web app shares a preset as /presets/<id> (curated slug or
// community-<uuid>), not as a query — the one tool whose share form is a path.
app.get('/presets/:presetId', createToolHandler('presets'));

// ============================================================================
// OG Image Generation Routes
// ============================================================================

/**
 * The 2a default cards (confirmed 2026-08-07): a default never fakes data —
 * the mark's six stripes carry identity, the tool's banner glyph floats in a
 * dark tile, and the deck explains. The root card takes no tile and drops
 * the method tag.
 */
function buildDefaultCardSvg(
  tool: ToolId | null,
  frame: 'discord' | 'x',
  locale: LocaleCode
): string {
  if (tool && DEFAULT_DECK[tool]) {
    const deck = DEFAULT_DECK[tool];
    const strings = getOgDeck(tool, locale);
    return generateDefaultCard({
      // Same header slot as a data card, so the same localized tag — the
      // leading slash is what says "the tool" rather than "a result from it".
      tool: { glyphName: deck.glyphName, label: `/${getToolTag(tool, locale)}` },
      name: strings.name,
      sub: strings.sub,
      path: `xivdyetools.app/${tool}`,
      methodTag: tool === 'presets' ? role('curated', locale) : 'ΔE2000',
      frame,
    });
  }
  const root = getOgDeck('root', locale);
  return generateDefaultCard({
    tool: null,
    name: root.name,
    sub: root.sub,
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
    buildDefaultCardSvg(tool, frameFromQuery(c), resolveLocale(new URL(c.req.url).searchParams)),
    { browser: 86400, edge: 604800 }
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
  const algorithm = (c.req.query('algo') || DEFAULT_MATCHING_METHOD) as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // FINDING-011: Validate dyeId to prevent NaN propagation
  if (isNaN(dyeId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  // BUG-002: Validate string enum params (FINDING-024 / OG-8: never echo the value)
  if (!isHarmonyType(harmonyTypeRaw)) {
    return c.json({ error: 'Invalid harmony type' }, 400);
  }
  if (!isAlgorithm(algorithm)) {
    return c.json({ error: 'Invalid algorithm' }, 400);
  }

  // Track analytics
  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'harmony',
    crawler: 'none', // Image requests don't have crawler detection
    timestamp: Date.now(),
  });

  const svg = generateHarmonyOG({
    dyeId,
    harmonyType,
    algorithm,
    locale,
    frame: frameFromQuery(c),
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
  const algorithm = (c.req.query('algo') || DEFAULT_MATCHING_METHOD) as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // FINDING-011: Validate dye IDs to prevent NaN propagation
  if (isNaN(startDyeId) || isNaN(endDyeId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  // BUG-002: Validate algorithm param
  if (!isAlgorithm(algorithm)) {
    return c.json({ error: 'Invalid algorithm' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'gradient',
    crawler: 'none',
    timestamp: Date.now(),
  });

  if (isNaN(steps) || steps < OG_MIN_GRADIENT_STEPS || steps > OG_MAX_GRADIENT_STEPS) {
    return c.json({ error: `steps must be between ${OG_MIN_GRADIENT_STEPS} and ${OG_MAX_GRADIENT_STEPS}` }, 400);
  }

  const svg = generateGradientOG({
    startDyeId,
    endDyeId,
    steps,
    algorithm,
    locale,
    frame: frameFromQuery(c),
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
  const algorithm = (c.req.query('algo') || DEFAULT_MATCHING_METHOD) as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // FINDING-011: Validate dye IDs to prevent NaN propagation
  if (isNaN(dyeAId) || isNaN(dyeBId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  // BUG-002: Validate algorithm param
  if (!isAlgorithm(algorithm)) {
    return c.json({ error: 'Invalid algorithm' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'mixer',
    crawler: 'none',
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
  const algorithm = (c.req.query('algo') || DEFAULT_MATCHING_METHOD) as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // FINDING-011: Validate dye IDs to prevent NaN propagation
  if (isNaN(dyeAId) || isNaN(dyeBId) || isNaN(dyeCId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  // BUG-002: Validate algorithm param
  if (!isAlgorithm(algorithm)) {
    return c.json({ error: 'Invalid algorithm' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'mixer',
    crawler: 'none',
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

  return renderOGImage(svg);
});

/**
 * Swatch tool OG image
 * Pattern: /og/swatch/:color/:limit.png
 */
app.get('/og/swatch/:color/:limit', async (c) => {
  const color = c.req.param('color');
  const limit = parseInt(c.req.param('limit').replace('.png', ''), 10);
  const algorithm = (c.req.query('algo') || DEFAULT_MATCHING_METHOD) as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // BUG-002: Validate algorithm param
  if (!isAlgorithm(algorithm)) {
    return c.json({ error: 'Invalid algorithm' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'swatch',
    crawler: 'none',
    timestamp: Date.now(),
  });

  if (isNaN(limit) || limit < 1 || limit > OG_MAX_SWATCH_LIMIT) {
    return c.json({ error: `limit must be between 1 and ${OG_MAX_SWATCH_LIMIT}` }, 400);
  }

  const svg = generateSwatchOG({
    frame: frameFromQuery(c),
    color,
    limit,
    algorithm,
    locale,
  });

  return renderOGImage(svg);
});

/**
 * Comparison tool OG image
 * Pattern: /og/comparison/:dyes.png
 * where dyes is comma-separated stainIDs (e.g., "1,2,3")
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
    timestamp: Date.now(),
  });

  const svg = generateComparisonOG({ dyeIds, locale, frame: frameFromQuery(c) });

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
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  if (dyeIds.length === 0 || dyeIds.length > OG_MAX_COMPARISON_DYES) {
    return c.json({ error: `accessibility requires 1–${OG_MAX_COMPARISON_DYES} valid dye IDs` }, 400);
  }

  // BUG-002: Validate visionType param (FINDING-024 / OG-8: never echo the value)
  if (!isVisionType(visionTypeRaw)) {
    return c.json({ error: 'Invalid vision type' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'accessibility',
    crawler: 'none',
    timestamp: Date.now(),
  });

  const svg = generateAccessibilityOG({
    dyeIds,
    visionType,
    locale,
    frame: frameFromQuery(c),
  });

  return renderOGImage(svg);
});

/**
 * Extractor OG image (5.0, net-new)
 * Pattern: /og/extractor/:colors.png — colors = `RRGGBB` or `RRGGBB-share`
 * entries, comma-separated (e.g. 8E5A3C-31,C9A96A-24 or 8E5A3C,C9A96A), max 5.
 * The web app's share URL carries no shares; bare entries draw equal bands.
 */
app.get('/og/extractor/:colors', async (c) => {
  const colorsParam = c.req.param('colors').replace('.png', '');
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  const entries = colorsParam
    .split(',')
    .slice(0, 5)
    .map((pair) => {
      const [hex, shareRaw] = pair.split('-');
      const share = shareRaw === undefined ? undefined : parseInt(shareRaw, 10);
      return { hex: hex ?? '', share };
    })
    .filter((e) => /^[0-9A-Fa-f]{6}$/.test(e.hex) && (e.share === undefined || (!isNaN(e.share) && e.share > 0)));

  if (entries.length === 0) {
    return c.json({ error: 'extractor requires RRGGBB-share pairs' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'extractor',
    crawler: 'none',
    timestamp: Date.now(),
  });

  return renderOGImage(generateExtractorOG({ entries, locale, frame: frameFromQuery(c) }));
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
    timestamp: Date.now(),
  });

  return renderOGImage(generatePresetsOG({ presetId, locale, frame: frameFromQuery(c) }));
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
    timestamp: Date.now(),
  });

  return renderOGImage(generateBudgetOG({ dyeId, locale, frame: frameFromQuery(c) }));
});

/**
 * Default/fallback OG image
 */
app.get('/og/default.png', async (c) => {
  // BUG-068: explicit TTLs — 24h browser / 7d edge (the old param was
  // multiplied by 7 internally, yielding a 49-day edge TTL)
  return renderOGImage(
    buildDefaultCardSvg(null, frameFromQuery(c), resolveLocale(new URL(c.req.url).searchParams)),
    { browser: 86400, edge: 604800 }
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
    // Return generic OG data for root (localized via ?lang= like every tool)
    const ogData = generateRootOGData(c.env, resolveLocale(new URL(c.req.url).searchParams));

    const html = generateOGHTML(ogData);
    return crawlerHtml(c, html, 200, 'public, max-age=86400'); // 24h
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
    // Unknown route for a crawler: the minimal embed, but as the 404 it is
    // (FINDING-024 / OG-9 — it used to be a cacheable 200 for any path under
    // the routed prefixes) and never stored by anyone.
    const ogData = generateFallbackOGData(c.env, resolveLocale(new URL(c.req.url).searchParams));

    const html = generateOGHTML(ogData);
    return crawlerHtml(c, html, 404, 'no-store');
  }

  // BUG-069: never fetch(our own og. custom domain) — CF blocks worker
  // self-fetch (error 1042), so stray human/unknown-UA hits became 5xx.
  const url = new URL(c.req.url);
  if (isOgImageHost(url, c.env)) {
    return c.json({ error: 'Not found' }, 404);
  }
  // FINDING-024 / OG-5: and never fetch() any other non-app ingress host
  // (workers.dev, wrangler dev) either — humans go to the app.
  if (!isAppHost(url, c.env)) {
    return Response.redirect(c.env.APP_BASE_URL, 302);
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
