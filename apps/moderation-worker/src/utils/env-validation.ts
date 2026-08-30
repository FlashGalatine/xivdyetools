/**
 * Environment Variable Validation
 *
 * Validates required environment variables at startup to catch
 * configuration errors early rather than failing at request time.
 *
 * REFACTOR-001: Added to match the validation pattern of other workers.
 */

import type { Env } from '../types/env.js';
import { isValidSnowflake } from '@xivdyetools/types';
import type { ExtendedLogger } from '@xivdyetools/logger';

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Prefix of every error raised ONLY when `ENVIRONMENT === 'production'`
 * (FINDING-013). `src/index.ts` matches on it to refuse the request, so the
 * producer and the consumer share one constant rather than two copies of the
 * string — and because these errors cannot be raised outside production, the
 * match is inherently production-scoped.
 */
export const PRODUCTION_ENV_ERROR_PREFIX = 'Missing required env var in production: ';

/**
 * Validates all required environment variables for the Moderation worker.
 *
 * Required secrets:
 * - DISCORD_TOKEN: Bot token for sending follow-up messages
 * - DISCORD_PUBLIC_KEY: For verifying Discord interaction signatures
 * - MODERATOR_IDS: Comma-separated Discord user IDs for moderators
 * - MODERATION_CHANNEL_ID: Discord channel ID for moderation queue
 *
 * Required config:
 * - DISCORD_CLIENT_ID: Discord application ID
 * - PRESETS_API_URL: URL of the Presets API worker
 *
 * Required bindings:
 * - KV: KV namespace for rate limiting and preferences
 * - DB: D1 database binding
 * - PRESETS_API: Service binding to Presets API worker
 *
 * Required additionally when `ENVIRONMENT === 'production'` (FINDING-013):
 * - RL_COMMAND / RL_AUTOCOMPLETE: the two native rate-limit bindings
 */
export function validateEnv(env: Env): EnvValidationResult {
  const errors: string[] = [];

  // Check required secrets
  const requiredSecrets: Array<keyof Env> = [
    'DISCORD_TOKEN',
    'DISCORD_PUBLIC_KEY',
    'MODERATOR_IDS',
    'MODERATION_CHANNEL_ID',
  ];

  for (const key of requiredSecrets) {
    const value = env[key];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      errors.push(`Missing or empty required secret: ${key}`);
    }
  }

  // Check required config variables
  const requiredConfig: Array<keyof Env> = ['DISCORD_CLIENT_ID', 'PRESETS_API_URL'];

  for (const key of requiredConfig) {
    const value = env[key];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      errors.push(`Missing or empty required config: ${key}`);
    }
  }

  // SEC-005: Detect placeholder values that indicate wrangler.toml was not properly configured.
  // Placeholder values satisfy non-empty checks but will cause authentication failures at runtime.
  if (env.DISCORD_CLIENT_ID?.startsWith('YOUR_')) {
    errors.push(
      'DISCORD_CLIENT_ID contains a placeholder value — update wrangler.toml [env.production.vars]',
    );
  }

  // Validate PRESETS_API_URL is a valid URL
  if (env.PRESETS_API_URL) {
    try {
      const url = new URL(env.PRESETS_API_URL);
      if (!url.protocol.startsWith('http')) {
        errors.push(`PRESETS_API_URL must use HTTP(S): ${env.PRESETS_API_URL}`);
      }
    } catch {
      errors.push(`Invalid URL for PRESETS_API_URL: ${env.PRESETS_API_URL}`);
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

  // Follow-up 3: BOT_SIGNING_SECRET is optional (HMAC signing is skipped when
  // absent — see services/preset-api.ts's validateSecurityConfig, which only
  // warns), but when present it is passed to @xivdyetools/auth's
  // hmacSignHex, whose createHmacKey throws for secrets under 32 bytes
  // (FINDING-009). Mirrors oauth's JWT_SECRET check.
  if (env.BOT_SIGNING_SECRET && typeof env.BOT_SIGNING_SECRET === 'string') {
    if (env.BOT_SIGNING_SECRET.length < 32) {
      errors.push('BOT_SIGNING_SECRET must be at least 32 characters for security');
    }
  }

  // Check KV namespace binding
  if (!env.KV) {
    errors.push('Missing required KV namespace binding: KV');
  }

  // Check D1 database binding
  if (!env.DB) {
    errors.push('Missing required D1 database binding: DB');
  }

  // Check PRESETS_API service binding
  if (!env.PRESETS_API) {
    errors.push('Missing required service binding: PRESETS_API');
  }

  // FINDING-013 (2026-08-29 security audit): production must bind both native
  // `[[ratelimits]]` bindings. FINDING-003 moved per-user limiting onto them,
  // and losing one degrades in SILENCE — the worker falls back to the KV
  // limiter, which cannot throttle a fast client (1 write/s/key, swallowed put
  // failures, eventually-consistent reads), with no error and no log line.
  // That fallback is exactly what dev and tests want, so the requirement is
  // production-only, mirroring presets-api's block.
  //
  // `src/index.ts` refuses every request while one of these errors stands
  // (500 "Service misconfigured", `/health` included) — logging alone reaches
  // nobody with Workers Logs off on this script.
  if (env.ENVIRONMENT === 'production') {
    if (!env.RL_COMMAND) {
      errors.push(`${PRODUCTION_ENV_ERROR_PREFIX}RL_COMMAND`);
    }
    if (!env.RL_AUTOCOMPLETE) {
      errors.push(`${PRODUCTION_ENV_ERROR_PREFIX}RL_AUTOCOMPLETE`);
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
    console.error('Environment validation failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }
}
