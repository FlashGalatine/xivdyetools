/**
 * Pre-built Rate Limit Configurations
 *
 * Ready-to-use configurations for common rate limiting scenarios
 * across the xivdyetools ecosystem.
 */

import type { RateLimitConfig } from '../types.js';

// ============================================================================
// OAuth Endpoint Limits
// ============================================================================

/**
 * Rate limits for OAuth endpoints
 *
 * Protects authentication endpoints from brute force attacks.
 */
export const OAUTH_LIMITS: Record<string, RateLimitConfig> = {
  // Login initiation - stricter limit (10 per minute)
  '/auth/discord': { maxRequests: 10, windowMs: 60_000 },
  '/auth/xivauth': { maxRequests: 10, windowMs: 60_000 },

  // Token exchange - moderate limit (20 per minute)
  '/auth/callback': { maxRequests: 20, windowMs: 60_000 },
  '/auth/xivauth/callback': { maxRequests: 20, windowMs: 60_000 },

  // Token refresh - more lenient (30 per minute)
  '/auth/refresh': { maxRequests: 30, windowMs: 60_000 },

  // Default for other auth endpoints
  default: { maxRequests: 30, windowMs: 60_000 },
};

// BUG-007 (2026-07-18 audit): prefix matching must prefer the LONGEST key —
// insertion order made '/auth/xivauth' shadow '/auth/xivauth/callback', giving
// callbacks the stricter login-initiation limit. Sorted once at module load.
const OAUTH_LIMIT_KEYS_BY_LENGTH = Object.keys(OAUTH_LIMITS)
  .filter((key) => key !== 'default')
  .sort((a, b) => b.length - a.length);

/**
 * Get OAuth rate limit config for a path (longest matching prefix wins)
 */
export function getOAuthLimit(path: string): RateLimitConfig {
  for (const key of OAUTH_LIMIT_KEYS_BY_LENGTH) {
    if (path.startsWith(key)) {
      return OAUTH_LIMITS[key];
    }
  }
  return OAUTH_LIMITS.default;
}

// ============================================================================
// Discord Bot Command Limits
// ============================================================================

/**
 * Rate limits for Discord bot commands (the 5.0 command roster).
 *
 * Per-command limits based on resource intensity — higher for utility
 * commands, lower for expensive operations. Keys are the registered command
 * name; a `command:subcommand` key overrides the command entry for that
 * subcommand only (see `getDiscordCommandLimit`). Aliases (e.g. `/a11y` for
 * `/accessibility`) are canonicalised by the caller before lookup so both
 * spellings share one bucket.
 */
export const DISCORD_COMMAND_LIMITS: Record<string, RateLimitConfig> = {
  // OPT-007 (2026-07-18 audit): autocomplete fires on nearly every keystroke
  // — generous limit, fail-soft (limited requests return empty choices)
  autocomplete: { maxRequests: 60, windowMs: 60_000, burstAllowance: 10 },

  // Image processing — the Photon path through image-worker (5 per minute).
  // `/extractor color` is a plain dye lookup and keeps the command default.
  'extractor:image': { maxRequests: 5, windowMs: 60_000 },
  extractor: { maxRequests: 15, windowMs: 60_000 },

  // Accessibility / analysis features (10 per minute)
  accessibility: { maxRequests: 10, windowMs: 60_000 },

  // API- and D1-dependent commands (10 per minute)
  budget: { maxRequests: 10, windowMs: 60_000 },
  preset: { maxRequests: 10, windowMs: 60_000 },

  // Standard rendering commands (15 per minute)
  harmony: { maxRequests: 15, windowMs: 60_000 },
  mixer: { maxRequests: 15, windowMs: 60_000 },
  gradient: { maxRequests: 15, windowMs: 60_000 },
  comparison: { maxRequests: 15, windowMs: 60_000 },
  contrast: { maxRequests: 15, windowMs: 60_000 },
  swatch: { maxRequests: 15, windowMs: 60_000 },

  // Lighter commands (20 per minute)
  dye: { maxRequests: 20, windowMs: 60_000 },
  preferences: { maxRequests: 20, windowMs: 60_000 },

  // Utility commands (30 per minute)
  about: { maxRequests: 30, windowMs: 60_000 },
  manual: { maxRequests: 30, windowMs: 60_000 },

  // Default
  default: { maxRequests: 15, windowMs: 60_000 },
};

/**
 * Get Discord command rate limit config.
 *
 * Resolution order: `command:subcommand` → `command` → `default`.
 */
export function getDiscordCommandLimit(commandName: string, subcommand?: string): RateLimitConfig {
  if (subcommand) {
    const scoped = DISCORD_COMMAND_LIMITS[`${commandName}:${subcommand}`];
    if (scoped) return scoped;
  }
  return DISCORD_COMMAND_LIMITS[commandName] ?? DISCORD_COMMAND_LIMITS.default;
}

// ============================================================================
// Discord Moderation Limits
// ============================================================================

/**
 * Rate limits for moderation bot interactions
 *
 * Includes burst allowance for legitimate rapid interactions.
 */
export const MODERATION_LIMITS: Record<string, RateLimitConfig> = {
  // Command interactions (20 per minute + 5 burst)
  command: {
    maxRequests: 20,
    windowMs: 60_000,
    burstAllowance: 5,
  },

  // Autocomplete - higher limit due to typing (60 per minute + 10 burst)
  autocomplete: {
    maxRequests: 60,
    windowMs: 60_000,
    burstAllowance: 10,
  },
};

/**
 * Get moderation-bot rate limit config for an interaction type.
 *
 * @param type - `'command'` or `'autocomplete'`; falls back to `'command'`
 * for any other key.
 */
export function getModerationLimit(type: string): RateLimitConfig {
  return MODERATION_LIMITS[type] ?? MODERATION_LIMITS.command;
}

// ============================================================================
// Public API Limits
// ============================================================================

/**
 * Rate limits for public API endpoints
 *
 * Higher limits for general API access.
 */
export const PUBLIC_API_LIMITS: Record<string, RateLimitConfig> = {
  // Default public endpoint limit (100 per minute)
  default: { maxRequests: 100, windowMs: 60_000 },

  // Stricter for write operations (30 per minute)
  write: { maxRequests: 30, windowMs: 60_000 },
};
