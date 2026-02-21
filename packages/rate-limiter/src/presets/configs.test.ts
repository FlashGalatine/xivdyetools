/**
 * Tests for rate limit preset configs
 *
 * Covers all exported config objects and lookup functions.
 */

import { describe, it, expect } from 'vitest';
import {
  OAUTH_LIMITS,
  getOAuthLimit,
  DISCORD_COMMAND_LIMITS,
  getDiscordCommandLimit,
  MODERATION_LIMITS,
  PUBLIC_API_LIMITS,
  UNIVERSALIS_PROXY_LIMITS,
} from './configs.js';

describe('OAUTH_LIMITS', () => {
  it('has a default config', () => {
    expect(OAUTH_LIMITS.default).toBeDefined();
    expect(OAUTH_LIMITS.default.maxRequests).toBeGreaterThan(0);
    expect(OAUTH_LIMITS.default.windowMs).toBeGreaterThan(0);
  });

  it('has configs for auth endpoints', () => {
    expect(OAUTH_LIMITS['/auth/discord']).toBeDefined();
    expect(OAUTH_LIMITS['/auth/xivauth']).toBeDefined();
    expect(OAUTH_LIMITS['/auth/callback']).toBeDefined();
    expect(OAUTH_LIMITS['/auth/refresh']).toBeDefined();
  });
});

describe('getOAuthLimit', () => {
  it('returns discord limit for /auth/discord path', () => {
    const limit = getOAuthLimit('/auth/discord');
    expect(limit).toEqual(OAUTH_LIMITS['/auth/discord']);
  });

  it('returns callback limit for /auth/callback path', () => {
    const limit = getOAuthLimit('/auth/callback');
    expect(limit).toEqual(OAUTH_LIMITS['/auth/callback']);
  });

  it('returns refresh limit for /auth/refresh path', () => {
    const limit = getOAuthLimit('/auth/refresh');
    expect(limit).toEqual(OAUTH_LIMITS['/auth/refresh']);
  });

  it('returns xivauth limit for /auth/xivauth path', () => {
    const limit = getOAuthLimit('/auth/xivauth');
    expect(limit).toEqual(OAUTH_LIMITS['/auth/xivauth']);
  });

  it('returns xivauth limit for /auth/xivauth/callback due to iteration order (startsWith)', () => {
    const limit = getOAuthLimit('/auth/xivauth/callback');
    // /auth/xivauth/callback starts with /auth/xivauth, which is iterated first
    expect(limit).toEqual(OAUTH_LIMITS['/auth/xivauth']);
  });

  it('returns default for unknown paths', () => {
    const limit = getOAuthLimit('/unknown/path');
    expect(limit).toEqual(OAUTH_LIMITS.default);
  });

  it('returns default for empty path', () => {
    const limit = getOAuthLimit('');
    expect(limit).toEqual(OAUTH_LIMITS.default);
  });

  it('matches paths with prefix matching (startsWith)', () => {
    // /auth/discord/callback should match /auth/discord
    const limit = getOAuthLimit('/auth/discord/callback');
    expect(limit).toEqual(OAUTH_LIMITS['/auth/discord']);
  });
});

describe('DISCORD_COMMAND_LIMITS', () => {
  it('has a default config', () => {
    expect(DISCORD_COMMAND_LIMITS.default).toBeDefined();
    expect(DISCORD_COMMAND_LIMITS.default.maxRequests).toBeGreaterThan(0);
  });

  it('has configs for common commands', () => {
    const expectedCommands = [
      'match_image', 'accessibility', 'budget', 'harmony', 'match',
      'mixer', 'comparison', 'dye', 'favorites', 'collection',
      'language', 'about', 'manual',
    ];
    for (const cmd of expectedCommands) {
      expect(DISCORD_COMMAND_LIMITS[cmd]).toBeDefined();
    }
  });

  it('match_image has the lowest limit', () => {
    expect(DISCORD_COMMAND_LIMITS.match_image.maxRequests).toBeLessThanOrEqual(
      DISCORD_COMMAND_LIMITS.default.maxRequests,
    );
  });
});

describe('getDiscordCommandLimit', () => {
  it('returns the specific limit for known commands', () => {
    expect(getDiscordCommandLimit('match_image')).toEqual(
      DISCORD_COMMAND_LIMITS.match_image,
    );
    expect(getDiscordCommandLimit('harmony')).toEqual(
      DISCORD_COMMAND_LIMITS.harmony,
    );
  });

  it('returns default for unknown commands', () => {
    expect(getDiscordCommandLimit('nonexistent')).toEqual(
      DISCORD_COMMAND_LIMITS.default,
    );
  });
});

describe('MODERATION_LIMITS', () => {
  it('has command and autocomplete configs', () => {
    expect(MODERATION_LIMITS.command).toBeDefined();
    expect(MODERATION_LIMITS.autocomplete).toBeDefined();
  });

  it('autocomplete has higher limits than command', () => {
    expect(MODERATION_LIMITS.autocomplete.maxRequests).toBeGreaterThan(
      MODERATION_LIMITS.command.maxRequests,
    );
  });

  it('includes burst allowance', () => {
    expect(MODERATION_LIMITS.command.burstAllowance).toBeDefined();
    expect(MODERATION_LIMITS.autocomplete.burstAllowance).toBeDefined();
  });
});

describe('PUBLIC_API_LIMITS', () => {
  it('has default and write configs', () => {
    expect(PUBLIC_API_LIMITS.default).toBeDefined();
    expect(PUBLIC_API_LIMITS.write).toBeDefined();
  });

  it('write has lower limits than default', () => {
    expect(PUBLIC_API_LIMITS.write.maxRequests).toBeLessThan(
      PUBLIC_API_LIMITS.default.maxRequests,
    );
  });
});

describe('UNIVERSALIS_PROXY_LIMITS', () => {
  it('has a default config', () => {
    expect(UNIVERSALIS_PROXY_LIMITS.default).toBeDefined();
    expect(UNIVERSALIS_PROXY_LIMITS.default.maxRequests).toBeGreaterThan(0);
  });
});
