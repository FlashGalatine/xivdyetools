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

/**
 * Get OAuth rate limit config for a path
 */
export function getOAuthLimit(path: string): RateLimitConfig {
  for (const [key, config] of Object.entries(OAUTH_LIMITS)) {
    if (key !== 'default' && path.startsWith(key)) {
      return config;
    }
  }
  return OAUTH_LIMITS.default;
}

// ============================================================================
// Discord Bot Command Limits
// ============================================================================

/**
 * Rate limits for Discord bot commands
 *
 * Per-command limits based on resource intensity.
 * Higher limits for utility commands, lower for expensive operations.
 */
export const DISCORD_COMMAND_LIMITS: Record<string, RateLimitConfig> = {
  // Image processing - expensive (5 per minute)
  match_image: { maxRequests: 5, windowMs: 60_000 },

  // Accessibility features (10 per minute)
  accessibility: { maxRequests: 10, windowMs: 60_000 },

  // API-dependent commands (10 per minute)
  budget: { maxRequests: 10, windowMs: 60_000 },

  // Standard commands (15 per minute)
  harmony: { maxRequests: 15, windowMs: 60_000 },
  match: { maxRequests: 15, windowMs: 60_000 },
  mixer: { maxRequests: 15, windowMs: 60_000 },
  comparison: { maxRequests: 15, windowMs: 60_000 },

  // Lighter commands (20 per minute)
  dye: { maxRequests: 20, windowMs: 60_000 },
  favorites: { maxRequests: 20, windowMs: 60_000 },
  collection: { maxRequests: 20, windowMs: 60_000 },
  language: { maxRequests: 20, windowMs: 60_000 },

  // Utility commands (30 per minute)
  about: { maxRequests: 30, windowMs: 60_000 },
  manual: { maxRequests: 30, windowMs: 60_000 },

  // Default
  default: { maxRequests: 15, windowMs: 60_000 },
};

/**
 * Get Discord command rate limit config
 */
export function getDiscordCommandLimit(
  commandName: string
): RateLimitConfig {
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

// ============================================================================
// Universalis Proxy Limits
// ============================================================================

/**
 * Rate limits for Universalis API proxy
 */
export const UNIVERSALIS_PROXY_LIMITS: Record<string, RateLimitConfig> = {
  // Market data requests (100 per minute)
  default: { maxRequests: 100, windowMs: 60_000 },
};
