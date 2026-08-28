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
  getModerationLimit,
  PUBLIC_API_LIMITS,
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

  // BUG-007 (2026-07-18 audit): longest prefix must win — previously
  // '/auth/xivauth' shadowed this and returned the stricter 10/min limit
  it('returns the callback limit for /auth/xivauth/callback (longest prefix wins)', () => {
    const limit = getOAuthLimit('/auth/xivauth/callback');
    expect(limit).toEqual(OAUTH_LIMITS['/auth/xivauth/callback']);
    expect(limit.maxRequests).toBe(20);
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

  it('has configs for the 5.0 command roster (no retired v4 keys)', () => {
    const expectedCommands = [
      'extractor',
      'extractor:image',
      'accessibility',
      'budget',
      'harmony',
      'mixer',
      'gradient',
      'comparison',
      'contrast',
      'swatch',
      'preset',
      'preferences',
      'dye',
      'about',
      'manual',
      'autocomplete',
    ];
    for (const cmd of expectedCommands) {
      expect(DISCORD_COMMAND_LIMITS[cmd]).toBeDefined();
    }
    // The v4 command set was deleted in discord-worker 5.0.0 — dead keys
    // here would silently mis-tier their replacements.
    for (const dead of ['match', 'match_image', 'favorites', 'collection', 'language']) {
      expect(DISCORD_COMMAND_LIMITS[dead]).toBeUndefined();
    }
  });

  it('extractor:image (Photon path) has the lowest limit', () => {
    expect(DISCORD_COMMAND_LIMITS['extractor:image'].maxRequests).toBe(5);
    expect(DISCORD_COMMAND_LIMITS['extractor:image'].maxRequests).toBeLessThan(
      DISCORD_COMMAND_LIMITS.extractor.maxRequests,
    );
  });
});

describe('getDiscordCommandLimit', () => {
  it('returns the specific limit for known commands', () => {
    expect(getDiscordCommandLimit('extractor')).toEqual(DISCORD_COMMAND_LIMITS.extractor);
    expect(getDiscordCommandLimit('harmony')).toEqual(DISCORD_COMMAND_LIMITS.harmony);
  });

  it('prefers a command:subcommand entry when one exists', () => {
    expect(getDiscordCommandLimit('extractor', 'image')).toEqual(
      DISCORD_COMMAND_LIMITS['extractor:image'],
    );
    // no dedicated entry for the color subcommand → falls back to the command
    expect(getDiscordCommandLimit('extractor', 'color')).toEqual(DISCORD_COMMAND_LIMITS.extractor);
  });

  it('returns default for unknown commands', () => {
    expect(getDiscordCommandLimit('nonexistent')).toEqual(DISCORD_COMMAND_LIMITS.default);
    expect(getDiscordCommandLimit('nonexistent', 'sub')).toEqual(DISCORD_COMMAND_LIMITS.default);
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

describe('getModerationLimit', () => {
  it('returns the command config for "command"', () => {
    expect(getModerationLimit('command')).toEqual(MODERATION_LIMITS.command);
  });

  it('returns the autocomplete config for "autocomplete"', () => {
    expect(getModerationLimit('autocomplete')).toEqual(MODERATION_LIMITS.autocomplete);
  });

  it('falls back to the command config for an unknown type', () => {
    expect(getModerationLimit('unknown')).toEqual(MODERATION_LIMITS.command);
  });
});

describe('PUBLIC_API_LIMITS', () => {
  it('has default and write configs', () => {
    expect(PUBLIC_API_LIMITS.default).toBeDefined();
    expect(PUBLIC_API_LIMITS.write).toBeDefined();
  });

  it('write has lower limits than default', () => {
    expect(PUBLIC_API_LIMITS.write.maxRequests).toBeLessThan(PUBLIC_API_LIMITS.default.maxRequests);
  });
});
