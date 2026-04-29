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
import { requestIdMiddleware, getRequestId, loggerMiddleware, getLogger } from '@xivdyetools/worker-middleware';
import { rateLimitMiddleware } from './middleware/rate-limit.js';

// Routes
import { dyesRouter } from './routes/dyes.js';
import { matchRouter } from './routes/match.js';

// Lib
import { ApiError, ErrorCode } from './lib/api-error.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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
    logUserAgent: true,
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
});

// 4. CORS — permissive for public read-only API
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Accept', 'X-API-Key'],
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

// 5. Rate limiting on API routes
app.use('/v1/*', rateLimitMiddleware);

// 6. API version header
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
    documentation: 'https://data.xivdyetools.app/docs',
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

  // Unexpected error — log and return generic message
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
      ...(isDev && { stack: err.stack }),
    },
    500,
  );
});

export default app;
