/**
 * Environment Variable Validation
 *
 * Validates required environment variables at startup to catch
 * configuration errors early rather than failing at request time.
 */

import type { Env } from '../types.js';

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
    // Discord snowflakes are 17-19 digit numbers
    for (const id of ids) {
      if (!/^\d{17,19}$/.test(id.trim())) {
        errors.push(`Invalid Discord ID in MODERATOR_IDS: ${id}`);
      }
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
 * Logs validation errors to console.
 * Used by the validation middleware for debugging.
 */
export function logValidationErrors(errors: string[]): void {
  console.error('Environment validation failed:');
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
}
