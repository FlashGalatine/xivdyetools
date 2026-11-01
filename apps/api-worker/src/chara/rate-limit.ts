/** Soft miss-only budget: configuration errors fail loudly, runtime outages fail open. */
import type { Context } from 'hono';
import {
  CloudflareRateLimiter,
  KVRateLimiter,
  getClientIp,
  type RateLimitResult,
} from '@xivdyetools/worker-kit/rate-limiter';
import { SERVICE_BINDING_BUDGET_MULTIPLIER } from '../universalis/config/service-budget.js';
import { ErrorCode } from '../lib/api-error.js';
import type { Env, Variables } from '../types.js';

export const CHARA_PUBLIC_PRODUCTION_LIMIT = 30;
export const CHARA_PUBLIC_DEVELOPMENT_LIMIT = 60;
export const CHARA_WINDOW_SECONDS = 60;

/** A denial stays with the request whose own admission failed; pending lookups never carry it to another request. */
export class CharaQuotaError extends Error {
  constructor(public readonly result: RateLimitResult) {
    super('Too many upstream character-data requests. Please try again later.');
    this.name = 'CharaQuotaError';
  }
}

export function createCharaAdmission(env: Env, request: Request): () => Promise<void> {
  const ip = getClientIp(request, { ipv6Prefix64: true });
  const service = ip === 'unknown';
  const scope = service ? 'chara:svc:' : 'chara:ip:';
  const maximum =
    (env.ENVIRONMENT === 'production'
      ? CHARA_PUBLIC_PRODUCTION_LIMIT
      : CHARA_PUBLIC_DEVELOPMENT_LIMIT) * (service ? SERVICE_BINDING_BUDGET_MULTIPLIER : 1);
  const binding = service ? env.CHARA_SERVICE_RATE_LIMITER : env.CHARA_RATE_LIMITER;
  // Do not pass backend exception text, URLs, or caller keys to logs.
  const warn = (): void => console.warn('Chara rate limiter runtime failure; allowing operation', { scope });
  const logger = { warn, error: warn };
  if (binding === undefined &&
      (!env.RATE_LIMIT || typeof env.RATE_LIMIT.get !== 'function' || typeof env.RATE_LIMIT.put !== 'function'))
    throw new Error('Chara rate limiter requires a valid RATE_LIMIT KV binding');
  // Construction/validation is deliberately outside the runtime fail-open catch.
  const limiter = binding !== undefined
    ? new CloudflareRateLimiter({
        tiers: [{ limit: maximum, periodSeconds: CHARA_WINDOW_SECONDS, binding }],
        keyPrefix: scope,
        logger,
      })
    : new KVRateLimiter({ kv: env.RATE_LIMIT, keyPrefix: scope, logger });
  return async () => {
    let result: RateLimitResult;
    try {
      result = await limiter.check(service ? 'workers' : ip, {
        maxRequests: maximum,
        windowMs: CHARA_WINDOW_SECONDS * 1000,
        burstAllowance: 0,
        failOpen: false,
      });
    } catch {
      warn();
      return;
    }
    if (!result.allowed) throw new CharaQuotaError(result);
  };
}

export function charaQuotaResponse(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  error: CharaQuotaError,
): Response {
  const { result } = error;
  const retryAfter = result.retryAfter ?? Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
  c.header('Retry-After', String(retryAfter));
  c.header('X-RateLimit-Limit', String(result.limit));
  c.header('X-RateLimit-Remaining', String(result.remaining));
  c.header('X-RateLimit-Reset', String(Math.ceil(result.resetAt.getTime() / 1000)));
  c.header('Cache-Control', 'no-store');
  const locale = c.get('locale');
  return c.json({
    success: false,
    error: ErrorCode.RATE_LIMITED,
    message: error.message,
    retryAfter,
    meta: {
      requestId: c.get('requestId') || 'unknown',
      apiVersion: c.env.API_VERSION || 'v1',
      ...(locale && locale !== 'en' ? { locale } : {}),
    },
  }, 429);
}
