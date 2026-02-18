/**
 * @xivdyetools/logger - Constants
 *
 * Shared constants for logger configuration.
 * LOGGER-REF-003 FIX: Consolidated redact fields to single source of truth.
 *
 * @module constants
 */

/**
 * Core fields to redact from logs.
 * These apply to all logger presets (browser, library, worker).
 */
export const CORE_REDACT_FIELDS = [
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'api_key',
  'apiKey',
  'access_token',
  'refresh_token',
] as const;

/**
 * Additional fields to redact in Cloudflare Worker environments.
 * These are service-specific secrets used by xivdyetools workers.
 */
export const WORKER_SPECIFIC_REDACT_FIELDS = [
  'jwt_secret',
  'bot_api_secret',
  'bot_signing_secret',
  'discord_client_secret',
] as const;

/**
 * All redact fields for worker presets.
 * Combines core fields with worker-specific secrets.
 */
export const WORKER_REDACT_FIELDS = [
  ...CORE_REDACT_FIELDS,
  ...WORKER_SPECIFIC_REDACT_FIELDS,
] as const;

/**
 * Default redact fields (alias for CORE_REDACT_FIELDS).
 * Used by base logger and non-worker presets.
 */
export const DEFAULT_REDACT_FIELDS = CORE_REDACT_FIELDS;
