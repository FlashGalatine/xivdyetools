/**
 * XIV Dye Tools Community Presets API
 * Cloudflare Worker Entry Point
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ExtendedLogger } from '@xivdyetools/logger';
import type { Env, AuthContext } from './types.js';

// Import route handlers
import { presetsRouter } from './handlers/presets.js';
import { votesRouter } from './handlers/votes.js';
import { categoriesRouter } from './handlers/categories.js';
import { moderationRouter } from './handlers/moderation.js';

// Import middleware
import { authMiddleware } from './middleware/auth.js';
import { publicRateLimitMiddleware } from './middleware/rate-limit.js';
import { requestIdMiddleware, getRequestId } from './middleware/request-id.js';
import { loggerMiddleware, getLogger } from './middleware/logger.js';
import { validateEnv, logValidationErrors } from './utils/env-validation.js';
import { ErrorCode } from './utils/api-response.js';

// Extend Hono context with our custom variables
type Variables = {
  auth: AuthContext;
  requestId: string;
  logger: ExtendedLogger;
};

// Create Hono app with typed bindings
const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Track if we've validated env in this isolate
let envValidated = false;

// ============================================
// GLOBAL MIDDLEWARE
// ============================================

// Request ID middleware (must be early for tracing)
app.use('*', requestIdMiddleware);

// Structured request logger (after request ID for correlation)
app.use('*', loggerMiddleware);

// Environment validation middleware
// Validates required env vars once per isolate and caches result
app.use('*', async (c, next) => {
  if (!envValidated) {
    const result = validateEnv(c.env);
    envValidated = true;
    if (!result.valid) {
      logValidationErrors(result.errors);
      // In production, fail fast on misconfiguration
      if (c.env.ENVIRONMENT === 'production') {
        return c.json({ success: false, error: ErrorCode.SERVICE_UNAVAILABLE, message: 'Service misconfigured' }, 500);
      }
      // In development, log warnings but continue
      const logger = getLogger(c);
      if (logger) {
        logger.warn('Continuing with invalid env configuration (development mode)');
      }
    }
  }
  await next();
});

// Security headers middleware
app.use('*', async (c, next) => {
  await next();
  // Prevent MIME-type sniffing attacks
  c.header('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking by denying iframe embedding
  c.header('X-Frame-Options', 'DENY');
  // Enforce HTTPS for 1 year (only in production)
  if (c.env.ENVIRONMENT === 'production') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// CORS configuration
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowedOrigin = c.env.CORS_ORIGIN;
      // Additional allowed origins from environment (comma-separated)
      const additionalOrigins = c.env.ADDITIONAL_CORS_ORIGINS
        ? c.env.ADDITIONAL_CORS_ORIGINS.split(',').map((o: string) => o.trim())
        : [];

      // SECURITY: Don't allow requests without an Origin header
      // (server-to-server calls should use API keys, not CORS)
      if (!origin) {
        return null;
      }

      // Allow configured origin and additional production origins
      if (origin === allowedOrigin || additionalOrigins.includes(origin)) {
        return origin;
      }

      // SECURITY: Only allow specific localhost ports in development
      // This prevents malicious apps on other localhost ports from making requests
      const allowedDevOrigins = [
        'http://localhost:5173',   // Vite dev server
        'http://127.0.0.1:5173',   // Vite dev server (IP)
        'http://localhost:8787',   // Wrangler local dev
        'http://127.0.0.1:8787',   // Wrangler local dev (IP)
      ];
      if (allowedDevOrigins.includes(origin)) {
        return origin;
      }

      return null;
    },
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-User-Discord-ID', 'X-User-Discord-Name'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    maxAge: 86400,
    credentials: true,
  })
);

// Public rate limiting middleware (100 req/min per IP)
// Applied before auth to protect against unauthenticated abuse
app.use('/api/*', publicRateLimitMiddleware);

// Authentication middleware (sets auth context)
app.use('*', authMiddleware);

// SECURITY: Content-Type validation for mutation requests
// Prevents potential JSON smuggling and ensures consistent API behavior
app.use('/api/*', async (c, next) => {
  const method = c.req.method;
  if (['POST', 'PATCH', 'PUT'].includes(method)) {
    const contentType = c.req.header('content-type');
    // Allow requests with empty body (some deletions) or valid JSON content-type
    const contentLength = c.req.header('content-length');
    const hasBody = contentLength && parseInt(contentLength) > 0;

    if (hasBody && (!contentType || !contentType.includes('application/json'))) {
      return c.json(
        {
          error: 'Unsupported Media Type',
          message: 'Content-Type must be application/json',
        },
        415
      );
    }
  }
  await next();
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/', (c) => {
  return c.json({
    name: 'XIV Dye Tools Community Presets API',
    version: c.env.API_VERSION,
    status: 'healthy',
    environment: c.env.ENVIRONMENT,
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Test-only route to exercise global error handler without exposing in production
app.get('/__force-error', (c) => {
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({ success: false, error: ErrorCode.NOT_FOUND, message: 'Not found' }, 404);
  }
  throw new Error('forced error');
});

// ============================================
// API ROUTES
// ============================================

// Mount route handlers under /api/v1
app.route('/api/v1/presets', presetsRouter);
app.route('/api/v1/votes', votesRouter);
app.route('/api/v1/categories', categoriesRouter);
app.route('/api/v1/moderation', moderationRouter);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: ErrorCode.NOT_FOUND,
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  const requestId = getRequestId(c);
  const logger = getLogger(c);
  // Don't expose internal errors in production
  const isDev = c.env.ENVIRONMENT === 'development';

  // Use structured logger if available
  if (logger) {
    logger.error('Unhandled error', err, { operation: 'globalErrorHandler' });
  } else {
    // Fallback to console if logger not available
    const logMessage = isDev ? err : { name: err.name, message: err.message };
    console.error(`[${requestId}] Unhandled error:`, logMessage);
  }

  return c.json(
    {
      success: false,
      error: ErrorCode.INTERNAL_ERROR,
      message: isDev ? err.message : 'An unexpected error occurred',
      requestId,
      ...(isDev && { stack: err.stack }),
    },
    500
  );
});

// Export for Cloudflare Workers
export default app;
