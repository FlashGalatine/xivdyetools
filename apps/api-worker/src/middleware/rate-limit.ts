/**
 * Rate limiting middleware for /v1/* — per-client IP — plus a separate bucket
 * for `POST /v1/telemetry` (see TELEMETRY_LIMIT).
 *
 * FINDING-003 (2026-08-21 security audit): the KV backend cannot throttle a
 * fast client (KV allows 1 write/s/key, the increment swallows the resulting
 * 429s, reads are eventually consistent) and fails open on any KV error, so
 * the 60 + 5 / 60 s limit was never enforced against the one pattern it
 * exists for. The native Workers Rate Limiting binding (`API_RATE_LIMITER`,
 * `[[ratelimits]]` in wrangler.toml, limit 65 / 60 s) counts atomically
 * per colo with no storage writes and is used whenever it is bound; KV is
 * retained only as the fallback for environments without the binding.
 *
 * Uses shared rate limiting middleware factory from @xivdyetools/worker-kit
 * (REFACTOR-002) with the KV/binding backends from
 * @xivdyetools/worker-kit/rate-limiter.
 */

import type { Context, MiddlewareHandler } from 'hono';
import { rateLimitMiddleware as createRateLimitMiddleware } from '@xivdyetools/worker-kit';
import {
  KVRateLimiter,
  CloudflareRateLimiter,
  getClientIp,
  type RateLimiter,
} from '@xivdyetools/worker-kit/rate-limiter';
import { ErrorCode } from '../lib/api-error.js';
import type { Env, Variables } from '../types.js';

/** Effective limit: 60 requests + 5 burst per 60 s window (matches the binding's `simple.limit`). */
const API_LIMIT = { maxRequests: 60, windowMs: 60_000, burstAllowance: 5, failOpen: true } as const;
const API_EFFECTIVE_LIMIT = API_LIMIT.maxRequests + API_LIMIT.burstAllowance;

/**
 * Choose the backend for this isolate: the native binding when bound, KV otherwise.
 * Exported for tests; production code goes through `rateLimitMiddleware`.
 */
export function selectApiRateLimiter(env: Env): RateLimiter {
  if (env.API_RATE_LIMITER) {
    return new CloudflareRateLimiter({
      tiers: [{ limit: API_EFFECTIVE_LIMIT, periodSeconds: 60, binding: env.API_RATE_LIMITER }],
      keyPrefix: 'api:ip:',
    });
  }
  // BUG-004 (2026-04-28 audit): no module-scope singleton — KVRateLimiter
  // construction is cheap (stores the binding reference); the middleware
  // factory memoises the result per isolate (BUG-061).
  return new KVRateLimiter({ kv: env.RATE_LIMIT, keyPrefix: 'api:ip:' });
}

/** `POST /v1/telemetry` — carved out of the API bucket, limited on its own (see below). */
export const TELEMETRY_PATH = '/v1/telemetry';

export function isTelemetryPath(path: string): boolean {
  return path === TELEMETRY_PATH || path.startsWith(`${TELEMETRY_PATH}/`);
}

/**
 * Build a fresh /v1/* rate-limit middleware. A factory (rather than a single
 * module-level instance) so each test can exercise backend selection on its
 * own isolate-scoped cache. `skipPath` exempts a route from this bucket
 * (production passes `isTelemetryPath`).
 */
export function createApiRateLimitMiddleware(
  skipPath?: (path: string) => boolean,
): MiddlewareHandler {
  const limiter = createRateLimitMiddleware({
    backend: (c: Context<{ Bindings: Env }>) => selectApiRateLimiter(c.env),
    keyExtractor: (c) => getClientIp(c.req.raw),
    config: API_LIMIT,
    onError: 'fail-open',
    formatError: (c: Context<{ Bindings: Env; Variables: Variables }>, retryAfter) =>
      c.json(
        {
          success: false,
          error: ErrorCode.RATE_LIMITED,
          message:
            'Rate limit exceeded. 60 requests per minute allowed. Retry after the indicated number of seconds.',
          retryAfter,
          meta: {
            requestId: c.get('requestId') || 'unknown',
            apiVersion: c.env.API_VERSION || 'v1',
          },
        },
        429,
      ),
  });
  if (!skipPath) return limiter;
  return async (c, next) => {
    if (skipPath(c.req.path)) {
      await next();
      return;
    }
    return limiter(c, next);
  };
}

/** The `/v1/*` API bucket — every route except `POST /v1/telemetry`, which has its own. */
export const rateLimitMiddleware = createApiRateLimitMiddleware(isTelemetryPath);

/**
 * `POST /v1/telemetry` gets its own bucket. The limiter keys per client IP,
 * and one opted-in tab beacons every 15 s plus once per hide / pagehide; a
 * NAT or VPN egress can carry dozens of such tabs. Sharing the 65 / 60 s API
 * bucket would let telemetry 429 the user-facing `/v1/chara/*` calls behind
 * that address — so beacons draw on `TELEMETRY_RATE_LIMITER` (240 / 60 s,
 * ≈ 60 tabs at the steady rate) and never on `API_RATE_LIMITER`. The client
 * ignores the response either way (`sendBeacon`), so the 429 body is minimal.
 *
 * FINDING-014 (2026-08-29 audit): this bucket fails CLOSED, unlike the API
 * one. A broken backend used to admit unlimited batches, each worth up to 25
 * metered Analytics Engine writes; a dropped beacon costs nothing but a data
 * point, so unavailability must not widen the sink. `failOpen: false` makes
 * the backend rethrow instead of swallowing the error into `allowed: true`,
 * and `onError: 'fail-closed'` below turns that throw into a 429 — either
 * setting alone leaves the gap open.
 */
const TELEMETRY_LIMIT = {
  maxRequests: 240,
  windowMs: 60_000,
  burstAllowance: 0,
  failOpen: false,
} as const;

/** Backend for the telemetry bucket: the native binding when bound, KV (own key prefix) otherwise. */
export function selectTelemetryRateLimiter(env: Env): RateLimiter {
  if (env.TELEMETRY_RATE_LIMITER) {
    return new CloudflareRateLimiter({
      tiers: [
        {
          limit: TELEMETRY_LIMIT.maxRequests,
          periodSeconds: 60,
          binding: env.TELEMETRY_RATE_LIMITER,
        },
      ],
      keyPrefix: 'telemetry:ip:',
    });
  }
  return new KVRateLimiter({ kv: env.RATE_LIMIT, keyPrefix: 'telemetry:ip:' });
}

/**
 * Build a fresh `/v1/telemetry` rate-limit middleware (factory for the same
 * reason as above). Fails closed — see TELEMETRY_LIMIT (FINDING-014).
 */
export function createTelemetryRateLimitMiddleware(): MiddlewareHandler {
  return createRateLimitMiddleware({
    backend: (c: Context<{ Bindings: Env }>) => selectTelemetryRateLimiter(c.env),
    keyExtractor: (c) => getClientIp(c.req.raw),
    config: TELEMETRY_LIMIT,
    onError: 'fail-closed',
    formatError: (c: Context<{ Bindings: Env; Variables: Variables }>, retryAfter) =>
      c.json(
        {
          success: false,
          error: ErrorCode.RATE_LIMITED,
          message: 'Telemetry rate limit exceeded. Retry after the indicated number of seconds.',
          retryAfter,
          meta: {
            requestId: c.get('requestId') || 'unknown',
            apiVersion: c.env.API_VERSION || 'v1',
          },
        },
        429,
      ),
  });
}

export const telemetryRateLimitMiddleware = createTelemetryRateLimitMiddleware();
