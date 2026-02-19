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
