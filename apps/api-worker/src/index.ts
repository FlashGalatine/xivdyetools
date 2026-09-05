/**
 * XIV Dye Tools Public API
 * Cloudflare Worker Entry Point
 *
 * Phase 1: Dye database + color matching (9 endpoints)
 * Deployed to data.xivdyetools.app
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from './types.js';

// Middleware
import { requestIdMiddleware, getRequestId, loggerMiddleware, getLogger } from '@xivdyetools/worker-kit';
import {
  rateLimitMiddleware,
  telemetryRateLimitMiddleware,
  TELEMETRY_PATH,
} from './middleware/rate-limit.js';
import { localeMiddleware } from './middleware/locale.js';

// Routes
import { dyesRouter } from './routes/dyes.js';
import { matchRouter } from './routes/match.js';
import { wheelsRouter } from './routes/wheels.js';
import { harmonyRouter } from './routes/harmony.js';
import { universalisRouter } from './universalis/router.js';
import { charaRouter } from './chara/router.js';
import { telemetryRouter } from './telemetry/router.js';

// Lib
import { ApiError, ErrorCode } from './lib/api-error.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ============================================
// DOCS SITE (developers.xivdyetools.app)
// ============================================
// Absorbed apps/api-docs (Monorepo 2.0 Tier 2): the VitePress build ships as
// Workers Static Assets (production env only). Runs BEFORE all API middleware
// so docs requests skip rate limiting, locale handling, and API headers.
app.use('*', async (c, next) => {
  if (c.env.ASSETS && new URL(c.req.url).hostname === 'developers.xivdyetools.app') {
    // FINDING-025 / API-10: the docs host skips the API middleware chain, so
    // the security headers the API sets must be applied here. The asset
    // response's headers are immutable — copy before setting.
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    const response = new Response(asset.body, asset);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (c.env.ENVIRONMENT === 'production') {
      response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return response;
  }
  return next();
});

// ============================================
// GLOBAL MIDDLEWARE
// ============================================

// 1. Request ID (must be first for tracing)
app.use('*', requestIdMiddleware());

// 2. Structured logger (mirrors presets-api / discord-worker)
app.use(
  '*',
  loggerMiddleware({
    serviceName: 'xivdyetools-api-worker',
    readApiVersionFromEnv: true,
  }),
);

// 3. Security headers
app.use('*', async (c, next) => {
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  if (c.env.ENVIRONMENT === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  // FINDING-025 / API-13: 4xx/5xx bodies (the error envelope, the proxy's
  // bare {error}, the 429s) are per-request answers — a 404 is heuristically
  // cacheable by RFC 9111, so say no-store explicitly on every error path.
  // api-worker-04 widened this from `>= 400` to every non-2xx: a 3xx answer
  // carried no cache directive at all, and a 301 is heuristically cacheable.
  if ((c.res.status < 200 || c.res.status >= 300) && !c.res.headers.has('Cache-Control')) {
    c.header('Cache-Control', 'no-store');
  }
});

// 4. CORS — permissive for public read-only API (POST exists only for
//    /v1/chara/resolve, whose body is twelve small integers — still anonymous,
//    still idempotent, still cacheable per key behind it).
//    FINDING-025 / API-11: `X-API-Key` is no longer advertised — no API-key
//    feature exists; add it back with the feature, not before.
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Accept'],
    exposeHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-Id',
      'X-API-Version',
      'Retry-After',
    ],
    maxAge: 3600,
    credentials: false,
  }),
);

// 5. Rate limiting on API routes. POST /v1/telemetry is carved out of the
//    API bucket (rateLimitMiddleware skips it) and limited on its own bucket:
//    beacons from many tabs behind one NAT address must never 429 /v1/chara/*.
app.use('/v1/*', rateLimitMiddleware);
// api-worker-05: registered on the exact path only. Hono's `use()` does NOT
// append `/*`, but `isTelemetryPath` exempts the whole `/v1/telemetry/`
// subtree from the API bucket — so `/v1/telemetry/x` traversed BOTH limiters
// untouched and reached notFound(): unlimited anonymous 404s on a `/v1/*`
// path the docs promise is limited.
app.use(TELEMETRY_PATH, telemetryRateLimitMiddleware);
app.use(`${TELEMETRY_PATH}/*`, telemetryRateLimitMiddleware);

// 6. Locale resolution on API routes (OPT-001 — 2026-04-28 audit)
//    Reads ?locale= once per request and sets the LocalizationService state
//    so handlers can call getDyeName() without per-call setLocale().
app.use('/v1/*', localeMiddleware);

// 7. API version header
app.use('*', async (c, next) => {
  await next();
  c.header('X-API-Version', c.env.API_VERSION || 'v1');
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/', (c) => {
  return c.json({
    name: 'XIV Dye Tools Public API',
    version: c.env.API_VERSION,
    status: 'healthy',
    // api-worker-07: this advertised `/docs` on this host, which 404s — the
    // ASSETS branch fires only for `developers.xivdyetools.app`, so nothing
    // has ever served it here.
    documentation: 'https://developers.xivdyetools.app',
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// API ROUTES
// ============================================

app.route('/v1/dyes', dyesRouter);
app.route('/v1/match', matchRouter);
// Colour wheels + harmony selection over core's shared selector (PR #167's
// wheels). Read-only, deterministic, cached like the dye routes.
app.route('/v1/wheels', wheelsRouter);
app.route('/v1/harmony', harmonyRouter);
// .chara equipment-model resolution (web-app Swatch Matcher import) — one
// XIVAPI search per file, per-key edge cache, icons proxied. See chara/router.ts.
app.route('/v1/chara', charaRouter);

// Opt-in web-app usage telemetry → Analytics Engine. Internal, undocumented,
// 204-only; see telemetry/router.ts and docs/operations/ANALYTICS_QUERIES.md.
app.route(TELEMETRY_PATH, telemetryRouter);

// Universalis market-board proxy (absorbed from apps/universalis-proxy).
// Canonical mount + /api/v2 compatibility mount for the proxy.xivdyetools.app
// custom domain and discord-worker's UNIVERSALIS_PROXY service binding.
// Deliberately outside /v1/* (no KV rate limit / locale middleware) and
// un-enveloped — see universalis/router.ts.
app.route('/universalis', universalisRouter);
app.route('/api/v2', universalisRouter);

// ============================================
// ERROR HANDLING
// ============================================

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: ErrorCode.NOT_FOUND,
      message: `Route ${c.req.method} ${new URL(c.req.url).pathname} not found`,
      meta: {
        requestId: getRequestId(c),
        apiVersion: c.env.API_VERSION || 'v1',
      },
    },
    404,
  );
});

app.onError((err, c) => {
  const requestId = getRequestId(c);
  const logger = getLogger(c);
  const isDev = c.env.ENVIRONMENT === 'development';

  // Structured ApiError — return its code and status
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: err.code,
        message: err.message,
        ...(err.details !== undefined && { details: err.details }),
        meta: { requestId, apiVersion: c.env.API_VERSION || 'v1' },
      },
      err.statusCode as 400,
    );
  }

  // Unexpected error — log (with the stack) and return a generic message.
  // FINDING-025 / API-5: the stack is never part of an HTTP response, in any
  // environment — the dev worker is publicly deployable and ENVIRONMENT is
  // just a var; correlate through requestId in the logs instead.
  if (logger) {
    logger.error('Unhandled error', err, { operation: 'globalErrorHandler' });
  } else {
    // Fallback if logger middleware is not active
    const logMessage = isDev ? err : { name: err.name, message: err.message };
    console.error(`[${requestId}] Unhandled error:`, logMessage);
  }

  return c.json(
    {
      success: false,
      error: ErrorCode.INTERNAL_ERROR,
      message: isDev ? err.message : 'An unexpected error occurred',
      meta: { requestId, apiVersion: c.env.API_VERSION || 'v1' },
    },
    500,
  );
});

export default app;
