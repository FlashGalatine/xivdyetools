/**
 * XIV Dye Tools OAuth Worker
 * Handles Discord OAuth flow and JWT issuance for web app authentication
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types.js';
import { authorizeRouter } from './handlers/authorize.js';
import { callbackRouter } from './handlers/callback.js';
import { tokenRouter } from './handlers/token.js';
import { xivauthRouter } from './handlers/xivauth.js';
import { checkRateLimit, getClientIp, oauthRateLimitTiers } from './services/rate-limit.js';
import { validateEnv, logValidationErrors } from './utils/env-validation.js';
import { requestIdMiddleware, getRequestId, loggerMiddleware, getLogger } from '@xivdyetools/worker-kit';
import type { MiddlewareVariables } from '@xivdyetools/worker-kit';
import { bodySizeLimit, jsonDepthLimit } from './middleware/body-validation.js';
import { getAllowedRedirectOrigins } from './constants/oauth.js';

// Define context variables type
type Variables = MiddlewareVariables;

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// BUG-017 (2026-07-18 audit): validation runs on every request (it's cheap
// string checks) so a misconfigured production isolate fails every request —
// not one 500 and then e.g. signing JWTs with a weak secret. Only the error
// logging is once-per-isolate.
let envErrorsLogged = false;

// ============================================
// MIDDLEWARE
// ============================================

// REFACTOR-001: Shared middleware from @xivdyetools/worker-middleware
app.use('*', requestIdMiddleware());
// FINDING-010 (2026-08-29 security audit): logUserAgent used to be opted in
// here, so every request's User-Agent rode into the "Request started" log
// context — contradicting the web privacy guide's promise that the server
// "discards everything about the request". Nothing here ever consumed the
// value. worker-kit's own default is `false`, so simply not setting it is
// the fix.
app.use('*', loggerMiddleware({
  serviceName: 'xivdyetools-oauth',
}));

// CORS configuration
// SECURITY: Allow specific origins plus whitelisted localhost ports for development
// OAUTH-SEC-001: Restrict localhost to specific ports to prevent malicious localhost apps
const ALLOWED_LOCALHOST_PORTS = ['3000', '5173', '8787'];

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) {
        // No origin header (e.g., curl, Postman) - don't allow for security
        return '';
      }

      const env = c.env as Env;

      // BUG-018 finished the job for redirect URIs but left CORS behind, so a
      // site could be allowed to START a login and then be blocked from every
      // XHR that completes one. beta.xivdyetools.app hit exactly that: the
      // authorize redirect succeeded, the callback returned, and the token
      // exchange was blocked with no Access-Control-Allow-Origin — so the app
      // sat there still showing its two login buttons.
      //
      // Same allowlist as the redirect check, so a host can never be trusted
      // for one half of the flow and not the other. getAllowedRedirectOrigins
      // already includes FRONTEND_URL and strips localhost outside development.
      if (getAllowedRedirectOrigins(env).includes(origin)) {
        return origin;
      }

      // SECURITY: Only allow localhost in development environment
      // Prevents malicious localhost apps from accessing OAuth in production
      if (env.ENVIRONMENT === 'development') {
        try {
          const url = new URL(origin);
          if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
            // Must have a port and it must be in our whitelist
            if (url.port && ALLOWED_LOCALHOST_PORTS.includes(url.port)) {
              return origin;
            }
          }
        } catch {
          // Invalid URL - not allowed
        }
      }

      // Not allowed
      return '';
    },
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    maxAge: 3600, // ARCH-002: 1 hour (was 24h) — allows CORS policy changes to propagate within an hour
    credentials: true,
  })
);

// Environment validation middleware
// Validates required env vars once per isolate and caches result
//
// FINDING-029 (2026-08-21 security audit): the gate keyed on
// ENVIRONMENT === 'production', so a non-development, non-production deploy
// (the since-deleted `[env.preview]`) failed OPEN. Everything that is not
// local `development` is production as far as fail-closed behaviour goes —
// and validateEnv additionally rejects any ENVIRONMENT value other than the
// two wrangler.toml defines.
//
// oauth-08: this used to sit ABOVE the CORS middleware, so its 500 went back
// without `Access-Control-Allow-Origin` and the SPA saw an opaque network
// error instead of the config incident the JSON body names precisely. CORS
// does not depend on validated env — the origin callback reads only
// FRONTEND_URL and ENVIRONMENT — so it belongs first.
app.use('*', async (c, next) => {
  const result = validateEnv(c.env);
  if (!result.valid) {
    const isDevelopment = c.env.ENVIRONMENT === 'development';
    if (!envErrorsLogged) {
      envErrorsLogged = true;
      logValidationErrors(result.errors);
      if (isDevelopment) {
        // In development, log warnings but continue
        const logger = getLogger(c);
        if (logger) {
          logger.warn('Continuing with invalid env configuration (development mode)');
        }
      }
    }
    // Outside development, fail fast on misconfiguration — on every request,
    // not just the first one in the isolate (BUG-017)
    if (!isDevelopment) {
      return c.json({ error: 'Service misconfigured' }, 500);
    }
  }
  return next();
});

// Security headers middleware
// Applies to all responses (after handler execution)
app.use('*', async (c, next) => {
  await next();
  // Prevent MIME-type sniffing attacks
  c.header('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking by denying iframe embedding
  c.header('X-Frame-Options', 'DENY');
  // FINDING-022 (2026-08-29 security audit): nothing this worker returns is
  // cacheable. The token responses are bearer JWTs (RFC 6749 §5.1 mandates
  // no-store on them), the callback bounces carry an authorization code, and
  // /auth/me is per-user. Nothing caches in the path today — this stops a
  // future CDN rule or a browser heuristic on a 200 JSON body from storing a
  // JWT. Applied to every route, not just /auth/*: /health has nothing worth
  // caching either. Pragma is for HTTP/1.0 intermediaries.
  c.header('Cache-Control', 'no-store');
  c.header('Pragma', 'no-cache');
  // Enforce HTTPS for 1 year everywhere except local development (FINDING-029:
  // was production-only, so any other non-development env went without HSTS)
  if (c.env.ENVIRONMENT !== 'development') {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
});

// Rate limiting middleware for auth endpoints
// Protects against brute force and credential stuffing attacks
// REFACTOR-006/OPT-004 (2026-07-18 audit): the dead Durable Object path was
// deleted; limits are KV-backed (globally consistent) when TOKEN_BLACKLIST
// is bound, per-isolate memory otherwise.
app.use('/auth/*', async (c, next) => {
  const clientIp = getClientIp(c.req.raw);
  const path = new URL(c.req.url).pathname;

  // FINDING-003: native rate-limit bindings first, KV (TOKEN_BLACKLIST) as fallback
  const result = await checkRateLimit(clientIp, path, {
    cloudflare: oauthRateLimitTiers(c.env),
    kv: c.env.TOKEN_BLACKLIST,
  });

  // FINDING-012 (2026-08-29 security audit): CloudflareRateLimiter is a
  // per-isolate singleton (services/rate-limit.ts) and cannot hold a
  // request-scoped logger, so a fail-open event (the accepted trade-off —
  // the request is still served) used to be invisible. Surfaced on the
  // result and logged here instead, once per request, through the request
  // logger. No client-visible signal (no header) and no key/IP in the log
  // context — just which endpoint saw the error.
  if (result.backendError) {
    const logger = getLogger(c);
    logger?.warn('Rate limiter backend error — request allowed (fail-open)', { path });
  }

  // Set rate limit headers on all responses
  c.header('X-RateLimit-Limit', result.limit.toString());
  c.header('X-RateLimit-Remaining', result.remaining.toString());
  c.header('X-RateLimit-Reset', Math.floor(result.resetAt.getTime() / 1000).toString());

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);
    c.header('Retry-After', retryAfter.toString());

    return c.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter,
      },
      429
    );
  }

  return next();
});

// oauth-09: these two run AFTER the rate limiter now. They used to be
// registered above it, so every request — including one about to be 429'd —
// read its body, `JSON.parse`d it and walked the structure recursively. The
// 10 KB cap bounds it, so this is CPU shaping rather than a DoS fix: a caller
// over the limit was still paying the parse budget on the worker instead of
// being rejected on a header check. Nothing in the limiter reads the body.

// SEC-004: Reject oversized request bodies (10KB limit — OAuth payloads are small)
app.use('/auth/*', bodySizeLimit);

// SEC-003: Validate JSON depth and structure on mutation requests
app.use('/auth/*', jsonDepthLimit);

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (c) => {
  return c.json({
    service: 'xivdyetools-oauth',
    status: 'healthy',
    environment: c.env.ENVIRONMENT,
  });
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// AUTH ROUTES
// All routes are mounted at /auth prefix
//
// Route Structure:
// ┌──────────────────────────────────────────┐
// │ Discord OAuth                            │
// │  /auth/discord      - Initiate login     │
// │  /auth/callback     - Discord callback   │
// ├──────────────────────────────────────────┤
// │ XIVAuth OAuth                            │
// │  /auth/xivauth      - Initiate login     │
// │  /auth/xivauth/cb   - XIVAuth callback   │
// ├──────────────────────────────────────────┤
// │ Token Management                         │
// │  /auth/me           - Current user info  │
// │  /auth/revoke       - Revoke session     │
// └──────────────────────────────────────────┘
//
// FINDING-003 (2026-08-29 security audit): /auth/refresh was removed — it had
// no client and let a copied token be re-minted for up to 30 days.
// ============================================

app.route('/auth', authorizeRouter);  // Discord: /auth/discord
app.route('/auth', callbackRouter);   // Discord: /auth/callback
app.route('/auth', xivauthRouter);    // XIVAuth: /auth/xivauth, /auth/xivauth/cb
app.route('/auth', tokenRouter);      // Tokens: /auth/me, /auth/revoke

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      error: 'Not Found',
      message: `Route ${c.req.method} ${c.req.path} not found`,
    },
    404
  );
});

// Global error handler
app.onError((err, c) => {
  const requestId = getRequestId(c);
  const logger = getLogger(c);
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
      error: 'Internal Server Error',
      message: isDev ? err.message : 'An error occurred',
      requestId,
    },
    500
  );
});

export default app;
