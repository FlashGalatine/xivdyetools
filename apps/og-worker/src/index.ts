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

import { DEFAULT_MATCHING_METHOD, DEFAULT_COLOR_WHEEL, extractLocaleCode, parseColorWheelId } from '@xivdyetools/core';
import { isValidBlendingMode, type BlendingMode } from '@xivdyetools/core/blending';
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
  parseWheel,
} from './og-params';
import type { Env, ToolId, AnalyticsEvent, HarmonyType, MatchingAlgorithm, VisionType } from './types';
import packageJson from '../package.json' with { type: 'json' };

// ============================================================================
// Constants
// ============================================================================

/**
 * The card generation, folded into every `/og/*` edge-cache key (BUG-025).
 *
 * Rendered PNGs are stored with `s-maxage=604800` and neither deploy workflow
 * purges, so before this the only thing that retired a card was seven days
 * passing. Bumping this worker's `version` is now what invalidates them —
 * which is why the deploy checklist's "bump if behaviour changed" is not
 * optional for a card-design or dye-data change.
 */
const CARD_VERSION: string = packageJson.version;

/** The X frame rides ?frame=x (the tag-based branch — twitter:image only). */
function frameFromQuery(c: { req: { query: (k: string) => string | undefined } }): 'discord' | 'x' {
  return c.req.query('frame') === 'x' ? 'x' : 'discord';
}

/**
 * The mixer card's mixing algorithm rides `?mode=` — the same key the web
 * mixer's share URL has always emitted. `undefined` lets `generateMixerOG`
 * apply the web tool's own default (`ryb`), so a link shared before this
 * worker read the param still renders the picture its sharer saw. A present-
 * but-invalid spelling never reaches here: the /og/* guard 400s it first.
 */
function modeFromQuery(c: {
  req: { query: (k: string) => string | undefined };
}): BlendingMode | undefined {
  const mode = c.req.query('mode');
  return mode && isValidBlendingMode(mode) ? mode : undefined;
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
 * The only five query keys any /og/* request may legitimately carry —
 * `lang`, `frame`, `algo`, `mode`, `wheel`.
 *
 * The allowlist is GLOBAL, but what reads each key is not: `resolveLocale`
 * (below) reads `lang` and `frameFromQuery` reads `frame` on every route;
 * `algo` is read by the five algo-aware image routes; `mode` only by the two
 * mixer routes; `wheel` only by `/og/harmony/*`. A present-but-invalid value
 * is rejected here on every route regardless (rulings S7-R7 / S7-R10), while
 * `ogCacheKey` below keys a route-specific parameter only on the routes that
 * render with it — an allowed key must not multiply the cache entries of a
 * card that ignores it.
 *
 * og-data-generator.ts emits exactly these onto an image URL (withLang /
 * withAlgo / withMode / withWheel / the ?frame=x twitter branch), so no URL
 * this worker itself produces ever carries a sixth key.
 *
 * `mode` joined the set on 2026-09-03: the web mixer's share URL had always
 * carried it and this worker had always ignored it, so a shared mix rendered
 * in CIELAB no matter which of the six algorithms the sharer had picked.
 * `wheel` joined it on 2026-09-04 for the Harmony Explorer's colour wheels.
 */
const OG_ALLOWED_QUERY_KEYS = new Set(['lang', 'frame', 'algo', 'mode', 'wheel']);

/**
 * 2026-08-29 FINDING-024 (OG-4): reject any /og/* request carrying a query
 * key outside the allowlist, before the cache lookup below and before any
 * render. Nothing bounded the *count* of distinct renders for one path —
 * appending a throwaway key (?x=1, ?x=2, …) produced a fresh URL on every
 * request, and the canonical cache key below still varies with anything it
 * is handed, so each variant was a full, unauthenticated, unrate-limited
 * resvg raster. 404, not 400: this worker deliberately refuses to mint a
 * resource for that URL variant at all, rather than reporting an error on
 * it. The body never echoes the offending key (the OG-8 rule: a validation
 * response never echoes attacker input).
 *
 * Ruling S7-R7 (fix round 1, same finding): `algo`'s *value* is validated
 * here too, not just its key. Being an allowed key is not the same as being
 * bounded — the five algo-aware routes below already reject a bad spelling
 * themselves (BUG-002), but seven other /og/* route patterns (both
 * default-card routes, comparison, accessibility, extractor, presets,
 * budget) never read `algo` at all, so `?algo=1`, `?algo=2`, … sailed
 * through the key allowlist unchecked and each minted a fresh canonical
 * cache key below — the exact amplification this guard exists to close,
 * just narrowed from "any key" to "algo's value". Rejecting it here bounds
 * the key space to pathname × 6 locales × 2 frames × 10 algo states (the 9
 * spellings in VALID_ALGORITHMS + absent). Status/body match what the five
 * algo-aware routes already return for this exact condition (400, `{error:
 * 'Invalid algorithm'}`) — that existing contract wins over matching this
 * guard's own 404-for-unknown-key convention just above: an unknown key
 * means no such resource variant exists, but a known key with a bad value
 * is the malformed-request shape the rest of the codebase already answers
 * with 400.
 *
 * Ruling S7-R10 (fix round 2, same finding): an EMPTY `algo` (`?algo=` or
 * bare `?algo`) is treated as absent, not invalid — verified
 * `new URL(...).searchParams.get('algo')` returns `''` (not `null`) for
 * both spellings, same as Hono's own query parser. `isAlgorithm('')` is
 * false, so without this carve-out an empty value would 400 here where it
 * previously fell through each algo-aware route's own
 * `c.req.query('algo') || DEFAULT_MATCHING_METHOD` and rendered the default
 * algorithm's card — this guard must not change behaviour the sprint never
 * set out to change. `if (algo && ...)` reads `''` as falsy, same as
 * `null`.
 */
app.use('/og/*', async (c, next) => {
  const { searchParams } = new URL(c.req.url);
  for (const key of searchParams.keys()) {
    if (!OG_ALLOWED_QUERY_KEYS.has(key)) {
      return c.json({ error: 'Unknown query parameter' }, 404);
    }
  }
  const algo = searchParams.get('algo');
  if (algo && !isAlgorithm(algo)) {
    return c.json({ error: 'Invalid algorithm' }, 400);
  }
  // Same reasoning as `algo` one line up (ruling S7-R7): `mode` is an allowed
  // KEY on every /og/* route but only the two mixer routes read it, so an
  // unchecked value would mint a fresh cache key on the other nine. Empty is
  // absent, not invalid (ruling S7-R10) — `''` is falsy, same as `null`.
  const mode = searchParams.get('mode');
  if (mode && !isValidBlendingMode(mode)) {
    return c.json({ error: 'Invalid mixing mode' }, 400);
  }
  // `wheel` picks the harmony card's GEOMETRY — five validated ids, the same
  // class as `algo`; an unknown value is a malformed request, never echoed.
  // `parseColorWheelId` is core's one normaliser (trim + lower-case +
  // membership), so this accepts `wheel=MUNSELL` exactly as the web app does
  // and cannot drift from the id list the card itself reads.
  const wheel = searchParams.get('wheel');
  if (wheel && !parseColorWheelId(wheel)) {
    return c.json({ error: 'Invalid color wheel' }, 400);
  }
  return next();
});

/**
 * Canonical cache key for a /og/* request (2026-08-29 FINDING-024, OG-4):
 * pathname + the allowed query axes, RESOLVED, in a fixed order — bounds the
 * key space to (pathname × lang × frame × algo) instead of the full URL.
 * `lang` is the *resolved* locale (resolveLocale already collapses
 * ?lang=EN / ?lang=en-US / a missing lang onto the same rendered card) and
 * `frame` is the *resolved* 'discord' | 'x' (an unrecognised ?frame= renders
 * 'discord', so it shares that entry) — both safe to canonicalise because
 * they already render identically. `algo` stays the *raw* query value,
 * verbatim, omitted when absent: og-params.ts's legacy spellings only
 * normalise at render time (normalizeMatchingMethod, inside deltaForAlgorithm),
 * and collapsing two spellings that could render differently onto one slot
 * would risk serving the wrong picture for one of them (ruling S7-R4). By
 * the time this runs, the query-key guard above has already rejected a
 * present-and-invalid `algo` (ruling S7-R7) and normalised an empty one to
 * absent (ruling S7-R10, matched here by the same `if (algo)` truthy check
 * — `''` and `null` both skip the `params.set`), so this function only ever
 * keys on one of the 9 `VALID_ALGORITHMS` spellings or nothing.
 * `origin` keeps beta and production in separate entries. **Path is
 * `c.req.path`, not `new URL(c.req.url).pathname`** (ruling S7-R9): Hono
 * decodes before it routes (`getPath` in `hono/utils/url`), and every
 * handler below reads `c.req.param()` / `searchParams`, never the raw path
 * — so `/og/harmony/102/%63omplementary.png`, `.../c%6Fmplementary.png`,
 * and `.../complementary.png` already route to the identical handler with
 * the identical decoded param, and keying on the raw pathname let each
 * percent-encoded spelling buy its own cache entry for the same card,
 * within the 64/512-char length caps. Collapsing is one-directional and
 * safe: two raw paths that decode alike always route alike. (The length
 * guard above this still measures the raw pathname on purpose — capping
 * the undecoded string is the conservative side of that check.)
 */
function ogCacheKey(c: Context<{ Bindings: Env }>): Request {
  const url = new URL(c.req.url);
  const params = new URLSearchParams();
  params.set('lang', resolveLocale(url.searchParams));
  params.set('frame', frameFromQuery(c));
  // BUG-025: the key carried nothing that changes when the CARD does, and the
  // stored response says `s-maxage=604800`, so a band-layout revision or a
  // renamed dye kept serving the pre-deploy PNG from every colo that already
  // had it — for up to seven days, with no purge step in either deploy
  // workflow. `CARD_VERSION` is this worker's own package version, so bumping
  // it (deploy checklist step 4) is what retires the old cards.
  params.set('v', CARD_VERSION);
  const algo = url.searchParams.get('algo');
  if (algo) {
    params.set('algo', algo);
  }
  // `mode` picks the mixer card's mixing ALGORITHM — two modes are two
  // different pictures of one path, so it must key. Raw and omitted-when-
  // absent for the same reason `algo` is; the guard above has already
  // rejected any present-and-invalid spelling.
  const mode = url.searchParams.get('mode');
  if (mode) {
    params.set('mode', mode);
  }
  // The default is elided so `wheel=rgb` and absent share one cache entry —
  // the same rule `withMode` applies to `ryb` and `withAlgo` to ΔE2000.
  // NORMALISED, not raw (unlike `algo` and `mode`): the five ids are the whole
  // vocabulary and `parseColorWheelId` folds case and whitespace exactly as
  // the card's own reader does, so `?wheel=RYB` and `?wheel=ryb` cannot buy
  // two entries for one picture.
  //
  // And only on the route that READS it. `wheel` is an allowed key everywhere
  // because the allowlist is global, but only `/og/harmony/*` renders with it;
  // keying on it elsewhere let `?wheel=` mint five distinct, unauthenticated
  // rasters of one identical gradient or mixer card — the FINDING-024 key-space
  // problem, reintroduced through a validated parameter.
  const wheel = parseColorWheelId(url.searchParams.get('wheel'));
  if (wheel && wheel !== DEFAULT_COLOR_WHEEL && c.req.path.startsWith('/og/harmony/')) {
    params.set('wheel', wheel);
  }
  // Ruling S7-R13 (og-7 refined): strip a trailing `.png` from the path too — it stays
  // optional at every route (below), so the two spellings must share one
  // cache entry rather than buying a ×2 key split for free.
  const path = cacheKeyPath(c.req.path);
  return new Request(`${url.origin}${path}?${params.toString()}`, { method: 'GET' });
}

/**
 * Edge cache for rendered PNGs. The `Cache-Control` / `CDN-Cache-Control`
 * headers set by renderOGImage describe the TTLs but do nothing by themselves
 * on a Worker response — every hit was a full resvg raster. Key = the
 * canonical key above (the query-key allowlist above guarantees no other
 * query key ever reaches this point), GET *and HEAD*, 200s only; the Cache
 * API honours the response's own s-maxage for expiry. Absent outside Workers
 * (tests, Node) → pass-through.
 *
 * Ruling S7-R8 (fix round 2, same finding): HEAD is cacheable exactly like
 * GET. Hono re-dispatches a HEAD request as GET for *routing*
 * (`hono-base.js#dispatch`), but builds this middleware's `Context` from
 * the original request, so `c.req.method` still reads `'HEAD'` here —
 * treating that as uncacheable meant `cache.match` and `cache.put` were
 * both skipped on every HEAD, and the render below ran every time: a HEAD
 * loop against ONE url (`curl -I` in a loop — no distinct URLs needed at
 * all) was a strictly cheaper version of the amplification this task
 * exists to close. Safe to fold in: `ogCacheKey` always builds its `Request`
 * with `{ method: 'GET' }` regardless of the inbound method, so `cache.put`
 * stays legal; and Hono's outer HEAD wrapper (`new Response(null, await
 * innerDispatch)`) strips the body afterward no matter which branch below
 * produced the response, so a HEAD still comes back bodiless either way.
 */
app.use('/og/*', async (c, next) => {
  const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!cache || (c.req.method !== 'GET' && c.req.method !== 'HEAD')) {
    return next();
  }

  const cacheKey = ogCacheKey(c);
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
    const ogData = await generateOGDataForTool(tool, url.searchParams, env, locale, pathId);

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

// ============================================================================
// Canonical path-param grammars (2026-08-29 FINDING-024, OG-4, ruling S7-R12)
// ============================================================================
//
// The query-key allowlist and the canonical cache key close the *query*
// axis of the amplification this finding is about — but every /og/* path
// param was still wide open on the *path* axis, at the same attacker cost:
// `/og/harmony/102aaa/complementary`, `/og/harmony/00102/complementary`,
// `/og/harmony/+102/complementary` and `/og/harmony/1%2F0/complementary`
// (Hono's `getPath` uses `decodeURI`, which deliberately leaves `%2F`
// encoded, so it survives routing as a literal path segment and only
// becomes `1/0` once `c.req.param()` runs `decodeURIComponent` on it —
// `parseInt('1/0', 10)` is `1`) all render the identical Jet Black card
// under a different `ogCacheKey`, and `/og/swatch/:color/:limit` never
// validated `:color` at all. Rejecting the non-canonical spellings (rather
// than normalising them into the cache key) is the fix: a generic
// normaliser would have to know each route's grammar, and getting it wrong
// is worse than rejecting — `/og/presets/007` and `/og/presets/7` are
// *different preset slugs*, so a leading-zero–stripping normaliser would
// collapse two different cards onto one key. Since only 200s are ever
// `cache.put`, rejecting bad spellings up front means only canonical keys
// ever enter the cache.
//
// Every grammar below was checked against what `og-data-generator.ts`
// actually emits (not just against the suggested shape) before being
// committed to — see the two fixes in that file for the one place a
// suggested grammar would have rejected a real emission.

/** A canonical non-negative integer: no leading zeros, no sign, no trailing junk. */
const CANONICAL_INT = /^(0|[1-9]\d*)$/;

/** `og-data-generator.ts` only ever emits a resolved, canonical dye ID — a
 * stainID looked up in the dye database — into an image URL (see the fixes
 * to `generateComparisonOGData` / `generateAccessibilityOGData`, which used
 * to leak the raw, unfiltered share-URL list here instead). */
function parseCanonicalInt(raw: string): number {
  return CANONICAL_INT.test(raw) ? parseInt(raw, 10) : NaN;
}

/** Comma-separated canonical integers, e.g. comparison/accessibility `:dyes`. */
const CANONICAL_DYE_LIST = /^(0|[1-9]\d*)(,(0|[1-9]\d*))*$/;
function isCanonicalDyeList(raw: string): boolean {
  return CANONICAL_DYE_LIST.test(raw);
}

/**
 * The exact hex form `parseHexColor` (og-params.ts) produces: upper-case,
 * no `#`, exactly 6 characters. Swatch's `:color` had no validation at all
 * before this — any of the 2^6 case spellings of one hex value (and
 * anything else) rendered the same card under a different key.
 */
const CANONICAL_SWATCH_COLOR = /^[0-9A-F]{6}$/;
function isCanonicalSwatchColor(raw: string): boolean {
  return CANONICAL_SWATCH_COLOR.test(raw);
}

/**
 * Extractor's `:colors`: `RRGGBB` or `RRGGBB-<share>` entries, comma
 * separated — same upper-case-only rule as swatch, share a canonical
 * integer. The route used to `.filter()` out malformed entries silently
 * (`entries.length === 0` was the only rejection), so `1,2,x,3`-shaped
 * input rendered a card from whatever survived instead of being rejected.
 */
const CANONICAL_EXTRACTOR_ENTRY = /^[0-9A-F]{6}(-(0|[1-9]\d*))?$/;
function isCanonicalExtractorColors(raw: string): boolean {
  return raw.split(',').every((entry) => CANONICAL_EXTRACTOR_ENTRY.test(entry));
}

/**
 * Ruling S7-R13 (same finding): `.png` stays optional (both spellings
 * render the same card, and CLAUDE.md documents the suffix as optional),
 * so this only strips a REAL trailing suffix — `String.replace('.png','')`
 * is unanchored and first-occurrence, so `/og/harmony/102/.pngcomplementary`
 * and `/og/harmony/102/co.pngmplementary` both used to validate as
 * `complementary`. Every route below uses this instead of a bare
 * `.replace('.png', '')` on its last path param.
 */
function stripPngSuffix(raw: string): string {
  return raw.endsWith('.png') ? raw.slice(0, -4) : raw;
}

/**
 * The cache-key spelling of a path. `.png` is optional at every *parameterised*
 * route (ruling S7-R13), so the two spellings of one card must share one entry
 * — but it is NOT optional on `/og/:tool/default.png` or `/og/default.png`.
 *
 * og-7 (deep dive 2026-09-02): stripping it there too meant a cache-warm
 * `GET /og/budget/default` answered 200 with the default card, because it
 * computed the same stripped key as the `/og/budget/default.png` that had run
 * before it — where the route grammar deliberately answers `400 {"error":
 * "Invalid dye ID"}` (`parseCanonicalInt('default')` is NaN). Right card,
 * wrong status, and which one you got depended on request order.
 *
 * `presets` is the one exception to the exception: S7-R16 reserves `default`
 * as a slug on the parameterised route, so `/og/presets/default` IS a real
 * route rendering the identical card and the two spellings still share one
 * entry. The rule underneath both cases is the same — `.png` is optional
 * exactly where the bare path routes to the same card.
 *
 * The existing `og-guards` test for the 400 could not see this: its describe
 * block never stubs `caches`, so the middleware short-circuits to `next()`
 * and the collision cannot appear.
 */
function cacheKeyPath(raw: string): string {
  if (raw.endsWith('/default.png') && !raw.endsWith('/presets/default.png')) return raw;
  return stripPngSuffix(raw);
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
  // Ruling S7-R12: parseCanonicalInt rejects trailing junk, leading zeros,
  // a sign, or a %2F spelling the same way isNaN already rejected "abc" —
  // one guard, no new branch.
  const dyeId = parseCanonicalInt(c.req.param('dyeId'));
  const harmonyTypeRaw = stripPngSuffix(c.req.param('harmonyType'));
  const harmonyType = harmonyTypeRaw.toLowerCase() as HarmonyType;
  const algorithm = (c.req.query('algo') || DEFAULT_MATCHING_METHOD) as MatchingAlgorithm;
  const wheel = parseWheel(c.req.query('wheel') ?? null);
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // FINDING-011: Validate dyeId to prevent NaN propagation
  if (isNaN(dyeId)) {
    return c.json({ error: 'Invalid dye ID' }, 400);
  }

  // BUG-002: Validate string enum params (FINDING-024 / OG-8: never echo the value)
  if (!isHarmonyType(harmonyTypeRaw)) {
    return c.json({ error: 'Invalid harmony type' }, 400);
  }
  // Unreachable over HTTP as of 2026-08-29 FINDING-024 (OG-4, ruling S7-R7):
  // the shared /og/* guard above already validates `algo` before any route
  // handler runs. Left in place as this route's own invariant rather than
  // deleted as dead code — the same reasoning covers the identical check on
  // the other four algo-aware routes below, unremarked there.
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
    wheel,
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
  // Ruling S7-R12: canonical spellings only (see parseCanonicalInt above).
  const startDyeId = parseCanonicalInt(c.req.param('startId'));
  const endDyeId = parseCanonicalInt(c.req.param('endId'));
  const steps = parseCanonicalInt(stripPngSuffix(c.req.param('steps')));
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
  // Ruling S7-R12: canonical spellings only (see parseCanonicalInt above).
  const dyeAId = parseCanonicalInt(c.req.param('dyeAId'));
  const dyeBId = parseCanonicalInt(c.req.param('dyeBId'));
  const ratio = parseCanonicalInt(stripPngSuffix(c.req.param('ratio')));
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
    mode: modeFromQuery(c),
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
  // Ruling S7-R12: canonical spellings only (see parseCanonicalInt above).
  const dyeAId = parseCanonicalInt(c.req.param('dyeAId'));
  const dyeBId = parseCanonicalInt(c.req.param('dyeBId'));
  const dyeCId = parseCanonicalInt(c.req.param('dyeCId'));
  const ratio = parseCanonicalInt(stripPngSuffix(c.req.param('ratio')));
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
    mode: modeFromQuery(c),
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
  const limit = parseCanonicalInt(stripPngSuffix(c.req.param('limit')));
  const algorithm = (c.req.query('algo') || DEFAULT_MATCHING_METHOD) as MatchingAlgorithm;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // Ruling S7-R12: :color was never validated at all — any of the 2^6 case
  // spellings of one hex value (and anything else) rendered the same card
  // under a different cache key. Canonical form only, matching what
  // parseHexColor (og-params.ts) actually emits.
  if (!isCanonicalSwatchColor(color)) {
    return c.json({ error: 'Invalid swatch color' }, 400);
  }

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
  const dyesParam = stripPngSuffix(c.req.param('dyes'));
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // Ruling S7-R12: the whole list must be canonical — `.filter((id) =>
  // !isNaN(id))` used to silently drop malformed entries, so
  // "1,2,x,3" rendered a 3-dye card instead of being rejected, and every
  // way of writing the surviving IDs (leading zeros, etc.) bought its own
  // cache entry for that same card.
  if (!isCanonicalDyeList(dyesParam)) {
    return c.json({ error: `comparison requires 1–${OG_MAX_COMPARISON_DYES} valid dye IDs` }, 400);
  }
  const dyeIds = dyesParam.split(',').map((id) => parseInt(id, 10));

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
  const visionTypeRaw = stripPngSuffix(c.req.param('visionType'));
  const visionType = visionTypeRaw.toLowerCase() as VisionType;
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // Ruling S7-R12: same as comparison — the whole list must be canonical,
  // not "whatever survives filtering out the NaN entries".
  if (!isCanonicalDyeList(dyesParam)) {
    return c.json({ error: `accessibility requires 1–${OG_MAX_COMPARISON_DYES} valid dye IDs` }, 400);
  }
  const dyeIds = dyesParam.split(',').map((id) => parseInt(id, 10));

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
  const colorsParam = stripPngSuffix(c.req.param('colors'));
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // Ruling S7-R12: the whole list must be canonical — the old `.filter()`
  // silently dropped any entry that didn't parse, so "1,2,x,3"-shaped
  // input rendered a card from whatever survived instead of being
  // rejected, and every surviving spelling (case, share format) bought its
  // own cache entry for that card.
  if (!isCanonicalExtractorColors(colorsParam)) {
    return c.json({ error: 'extractor requires RRGGBB-share pairs' }, 400);
  }

  const entries = colorsParam
    .split(',')
    .slice(0, 5)
    .map((pair) => {
      const [hex, shareRaw] = pair.split('-');
      const share = shareRaw === undefined ? undefined : parseInt(shareRaw, 10);
      return { hex, share };
    });

  // A share of exactly 0 is canonical format but not a usable band —
  // preserved as a rejection (not a silent drop) rather than removed.
  if (entries.length === 0 || entries.some((e) => e.share === 0)) {
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
  const presetId = stripPngSuffix(c.req.param('presetId'));
  const locale = resolveLocale(new URL(c.req.url).searchParams);

  // Slugs only — reject anything that could not be a stored choice value.
  // Already canonical (ruling S7-R12): no case, no leading-zero, no
  // trailing-junk ambiguity possible in this alphabet, so the grammar
  // itself needed no change — only the `.png` strip above did (S7-R13).
  if (!/^[a-z0-9-]{1,64}$/.test(presetId)) {
    return c.json({ error: 'Invalid preset id' }, 400);
  }

  trackAnalytics(c.env, {
    event: 'og_image_request',
    tool: 'presets',
    crawler: 'none',
    timestamp: Date.now(),
  });

  // Ruling S7-R16 (regression from S7-R13's .png strip, presets is the only
  // /og/<literal-tool>/:singleParam route this reaches — re-verified against
  // all four of that shape: comparison/extractor/budget's grammars are
  // numeric/hex-only and already reject the word "default" as malformed, so
  // only presets' general slug grammar lets it through). `/og/:tool/
  // default.png` above already owns the path `/og/presets/default.png`; once
  // `.png` became optional, `/og/presets/default` (no suffix) started
  // sharing that exact cache key while still reaching THIS handler, which
  // passed the slug grammar, found no such preset, and rendered presets' own
  // notFoundBand — a 200, cached under the key the real default card also
  // uses. One unauthenticated GET could poison every presets-fallback
  // unfurl for up to 7 days. `default` is therefore a RESERVED slug — no
  // curated preset can be given that id, because the emitted
  // `/og/presets/default.png` URL already shadows it — and both spellings
  // render the identical default card, so the shared key is correct by
  // construction rather than by special-casing the cache layer.
  if (presetId === 'default') {
    return renderOGImage(buildDefaultCardSvg('presets', frameFromQuery(c), locale));
  }

  return renderOGImage(generatePresetsOG({ presetId, locale, frame: frameFromQuery(c) }));
});

/**
 * Budget OG image (5.0, net-new)
 * Pattern: /og/budget/:dyeId.png — target dye stainID
 */
app.get('/og/budget/:dyeId', async (c) => {
  // Ruling S7-R12: canonical spellings only (see parseCanonicalInt above).
  const dyeId = parseCanonicalInt(stripPngSuffix(c.req.param('dyeId')));
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
