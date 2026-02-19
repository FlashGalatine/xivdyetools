/**
 * Environment Variable Validation
 *
 * Validates required environment variables at startup to catch
 * configuration errors early rather than failing at request time.
 *
 * REFACTOR-001: Added to match the validation pattern of other workers.
 */

import type { Env } from '../types/env.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
}

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
    // Discord snowflakes are 17-19 digit numbers
    for (const id of ids) {
      if (!/^\d{17,19}$/.test(id.trim())) {
        errors.push(`Invalid Discord ID in MODERATOR_IDS: ${id}`);
      }
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
