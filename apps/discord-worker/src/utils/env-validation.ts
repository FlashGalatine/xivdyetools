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
 * - DB: D1 database binding
 */
export function validateEnv(env: Env): EnvValidationResult {
  const errors: string[] = [];

  // Check required string environment variables (secrets)
  const requiredSecrets: Array<keyof Env> = [
    'DISCORD_TOKEN',
    'DISCORD_PUBLIC_KEY',
  ];

  for (const key of requiredSecrets) {
    const value = env[key];
    if (!value || typeof value !== 'string' || value.trim() === '') {
      errors.push(`Missing or empty required secret: ${key}`);
    }
  }

  // Check required string environment variables (config)
  const requiredConfig: Array<keyof Env> = [
    'DISCORD_CLIENT_ID',
    'PRESETS_API_URL',
  ];

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

  // Check KV namespace binding
  if (!env.KV) {
    errors.push('Missing required KV namespace binding: KV');
  }

  // Check D1 database binding
  if (!env.DB) {
    errors.push('Missing required D1 database binding: DB');
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
export function logValidationErrors(
  errors: string[],
  logger?: ExtendedLogger
): void {
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
