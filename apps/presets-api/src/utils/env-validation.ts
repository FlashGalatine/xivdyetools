/**
 * Environment Variable Validation
 *
 * Validates required environment variables at startup to catch
 * configuration errors early rather than failing at request time.
 */

import type { Env } from '../types.js';
import { isValidSnowflake } from '@xivdyetools/types';

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates all required environment variables for the Presets API worker.
 *
 * Required variables:
 * - ENVIRONMENT: Runtime environment (development/production)
 * - API_VERSION: API version string
 * - CORS_ORIGIN: Allowed CORS origin
 * - BOT_API_SECRET: Secret for bot authentication
 * - MODERATOR_IDS: Comma-separated Discord user IDs for moderators
 * - DB: D1 database binding
 *
 * Production-only required (FINDING-001):
 * - BOT_SIGNING_SECRET: HMAC signing key for bot request signature verification
 *
 * Production-only required (FINDING-013, 2026-08-29 security audit): the
 * bindings/vars the 2026-08-21 fixes rely on. A dropped one (a config edit, a
 * dashboard change) previously degraded silently — no revocation, no issuer
 * pinning, a fallback rate limiter — with no error and no log.
 * - JWT_SECRET: HS256 signing key, non-empty and at least 32 characters
 * - JWT_ISSUER: expected `iss` claim, must start with `https://`
 * - TOKEN_BLACKLIST: the oauth revocation KV binding
 * - RL_PUBLIC: the native Workers Rate Limiting binding for the public limiter
 */
export function validateEnv(env: Env): EnvValidationResult {
  const errors: string[] = [];

  // Check required string environment variables
  const requiredStrings: Array<keyof Env> = [
    'ENVIRONMENT',
    'API_VERSION',
    'CORS_ORIGIN',
    'BOT_API_SECRET',
    'MODERATOR_IDS',
  ];

  for (const key of requiredStrings) {
    const value = env[key];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      errors.push(`Missing or empty required env var: ${key}`);
    }
  }

  // Validate CORS_ORIGIN is a valid URL
  if (env.CORS_ORIGIN) {
    try {
      new URL(env.CORS_ORIGIN);
    } catch {
      errors.push(`Invalid URL for CORS_ORIGIN: ${env.CORS_ORIGIN}`);
    }
  }

  // Validate ADDITIONAL_CORS_ORIGINS if present
  if (env.ADDITIONAL_CORS_ORIGINS) {
    const origins = env.ADDITIONAL_CORS_ORIGINS.split(',').map((o) => o.trim());
    for (const origin of origins) {
      if (origin) {
        try {
          new URL(origin);
        } catch {
          errors.push(`Invalid URL in ADDITIONAL_CORS_ORIGINS: ${origin}`);
        }
      }
    }
  }

  // Validate MODERATOR_IDS format (comma-separated Discord snowflakes)
  if (env.MODERATOR_IDS) {
    const ids = env.MODERATOR_IDS.split(/[,\s]+/).filter((id) => id.trim());
    if (ids.length === 0) {
      errors.push('MODERATOR_IDS must contain at least one Discord ID');
    }
    // FINDING-002: Validate Discord snowflake format via shared utility
    for (const id of ids) {
      if (!isValidSnowflake(id.trim())) {
        errors.push(`Invalid Discord ID in MODERATOR_IDS: ${id}`);
      }
    }
  }

  // FINDING-001: BOT_SIGNING_SECRET is required in production for HMAC signature verification
  // Optional in development to allow local testing without secrets
  if (env.ENVIRONMENT === 'production' && (!env.BOT_SIGNING_SECRET || env.BOT_SIGNING_SECRET.trim() === '')) {
    errors.push('Missing required env var in production: BOT_SIGNING_SECRET');
  }

  // FINDING-013: production also requires the security bindings/vars the
  // 2026-08-21 fixes rely on. Optional in development/tests, same as
  // BOT_SIGNING_SECRET above.
  if (env.ENVIRONMENT === 'production') {
    if (!env.JWT_SECRET || env.JWT_SECRET.trim() === '' || env.JWT_SECRET.length < 32) {
      errors.push('Missing required env var in production: JWT_SECRET');
    }
    if (!env.JWT_ISSUER || !env.JWT_ISSUER.startsWith('https://')) {
      errors.push('Missing required env var in production: JWT_ISSUER');
    }
    if (!env.TOKEN_BLACKLIST) {
      errors.push('Missing required env var in production: TOKEN_BLACKLIST');
    }
    if (!env.RL_PUBLIC) {
      errors.push('Missing required env var in production: RL_PUBLIC');
    }
  }

  // Check D1 database binding
  if (!env.DB) {
    errors.push('Missing required D1 database binding: DB');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * FINDING-011 (2026-08-29 security audit): minimal logger interface — these
 * are operator-configuration diagnostics (which env var, what shape it
 * failed), never user data, so the message-only shape is just to keep this
 * file's `console` fallback usable by the direct unit tests.
 */
export interface EnvValidationLogger {
  error(message: string, ...args: unknown[]): void;
}

/**
 * Logs validation errors via the structured logger when available, console
 * otherwise (e.g. when called outside a request, or by tests).
 * Used by the validation middleware for debugging.
 */
export function logValidationErrors(errors: string[], logger?: EnvValidationLogger): void {
  (logger ?? console).error('Environment validation failed:');
  for (const error of errors) {
    (logger ?? console).error(`  - ${error}`);
  }
}
