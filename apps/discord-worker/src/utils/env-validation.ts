/**
 * Environment Variable Validation
 *
 * Validates required environment variables at startup to catch
 * configuration errors early rather than failing at request time.
 */

import type { Env } from '../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';
import { isValidSnowflake } from '@xivdyetools/types';

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates all required environment variables for the Discord worker.
 *
 * Required variables:
 * - DISCORD_TOKEN: Bot token for sending messages
 * - DISCORD_PUBLIC_KEY: For verifying Discord interaction signatures
 * - DISCORD_CLIENT_ID: Discord application ID
 * - PRESETS_API_URL: URL for the Presets API worker
 * - KV: KV namespace binding for rate limiting and preferences
 *
 * Required additionally when `ENVIRONMENT === 'production'` (FINDING-013):
 * - RL_5 / RL_10 / RL_15 / RL_20 / RL_30 / RL_70: the six rate-limit tiers
 */
export function validateEnv(env: Env): EnvValidationResult {
  const errors: string[] = [];

  // Check required string environment variables (secrets)
  const requiredSecrets: Array<keyof Env> = ['DISCORD_TOKEN', 'DISCORD_PUBLIC_KEY'];

  for (const key of requiredSecrets) {
    const value = env[key];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      errors.push(`Missing or empty required secret: ${key}`);
    }
  }

  // Check required string environment variables (config)
  const requiredConfig: Array<keyof Env> = ['DISCORD_CLIENT_ID', 'PRESETS_API_URL'];

  for (const key of requiredConfig) {
    const value = env[key];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      errors.push(`Missing or empty required config: ${key}`);
    }
  }

  // Validate PRESETS_API_URL is a valid URL
  if (env.PRESETS_API_URL) {
    try {
      const url = new URL(env.PRESETS_API_URL);
      // Should use HTTPS for production API calls
      if (!url.protocol.startsWith('http')) {
        errors.push(`PRESETS_API_URL must use HTTP(S): ${env.PRESETS_API_URL}`);
      }
    } catch {
      errors.push(`Invalid URL for PRESETS_API_URL: ${env.PRESETS_API_URL}`);
    }
  }

  // Follow-up 3: BOT_SIGNING_SECRET is optional (HMAC signing is skipped when
  // absent — see services/preset-api.ts), but when present it is passed to
  // @xivdyetools/auth's hmacSignHex, whose createHmacKey throws for secrets
  // under 32 bytes (FINDING-009). Mirrors oauth's JWT_SECRET check.
  if (env.BOT_SIGNING_SECRET && typeof env.BOT_SIGNING_SECRET === 'string') {
    if (env.BOT_SIGNING_SECRET.length < 32) {
      errors.push('BOT_SIGNING_SECRET must be at least 32 characters for security');
    }
  }

  // Check KV namespace binding
  if (!env.KV) {
    errors.push('Missing required KV namespace binding: KV');
  }

  // Validate optional MODERATOR_IDS format if present
  if (env.MODERATOR_IDS) {
    const ids = env.MODERATOR_IDS.split(',').filter((id) => id.trim());
    for (const id of ids) {
      // FINDING-002: Validate Discord snowflake format via shared utility
      if (!isValidSnowflake(id.trim())) {
        errors.push(`Invalid Discord ID in MODERATOR_IDS: ${id}`);
      }
    }
  }

  // FINDING-013 (2026-08-29 security audit): production must bind all six
  // `[[ratelimits]]` tiers. FINDING-007 moved the per-user command counters
  // onto them, and losing one degrades in SILENCE — worker-kit routes the
  // orphaned commands to the next larger tier (dropping RL_5 hands
  // `/extractor image` 10/min instead of 5), losing all six falls back to a KV
  // limiter that cannot throttle a fast client at all. Workers Logs are off on
  // this script, so the once-per-isolate warning in `services/rate-limiter.ts`
  // is not a production signal — a missing binding has to fail loudly here.
  // Optional in development and tests so the KV fallback still works.
  if (env.ENVIRONMENT === 'production') {
    const requiredRateLimitBindings: Array<keyof Env> = [
      'RL_5',
      'RL_10',
      'RL_15',
      'RL_20',
      'RL_30',
      'RL_70',
    ];
    for (const key of requiredRateLimitBindings) {
      if (!env[key]) {
        errors.push(`Missing required env var in production: ${key}`);
      }
    }
  }

  // Validate optional STATS_AUTHORIZED_USERS format if present
  if (env.STATS_AUTHORIZED_USERS) {
    const ids = env.STATS_AUTHORIZED_USERS.split(',').filter((id) => id.trim());
    for (const id of ids) {
      if (!isValidSnowflake(id.trim())) {
        errors.push(`Invalid Discord ID in STATS_AUTHORIZED_USERS: ${id}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Logs validation errors to console.
 * Used by the validation middleware for debugging.
 *
 * @param errors - Array of validation error messages
 * @param logger - Optional logger for structured logging
 */
export function logValidationErrors(errors: string[], logger?: ExtendedLogger): void {
  if (logger) {
    logger.error('Environment validation failed', undefined, { errors });
  } else {
    // Fallback to console for cases where logger isn't available
    console.error('Environment validation failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }
}
