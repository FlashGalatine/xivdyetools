/**
 * Tests for startup environment validation.
 *
 * This runs once per isolate and is the only thing standing between a
 * misconfigured deploy and a moderation bot that silently accepts button
 * presses it cannot action. Every rule gets both arms: a missing secret must
 * be reported, and a present one must not produce a spurious error that
 * trains operators to ignore the log line.
 */

import { describe, it, expect, vi } from 'vitest';
import { logValidationErrors, validateEnv } from './env-validation.js';
import type { Env } from '../types/env.js';

/** A fully-configured environment; individual tests break one thing at a time. */
function validEnv(overrides: Partial<Env> = {}): Env {
  return {
    DISCORD_TOKEN: 'token-value',
    DISCORD_PUBLIC_KEY: 'a'.repeat(64),
    MODERATOR_IDS: '123456789012345678,234567890123456789',
    MODERATION_CHANNEL_ID: '345678901234567890',
    DISCORD_CLIENT_ID: '1453806659708129374',
    PRESETS_API_URL: 'https://presets.xivdyetools.app',
    KV: {} as KVNamespace,
    DB: {} as D1Database,
    PRESETS_API: {} as Fetcher,
    ...overrides,
  } as Env;
}

describe('validateEnv', () => {
  it('accepts a fully-configured environment', () => {
    const result = validateEnv(validEnv());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  describe('required secrets', () => {
    it.each([
      'DISCORD_TOKEN',
      'DISCORD_PUBLIC_KEY',
      'MODERATOR_IDS',
      'MODERATION_CHANNEL_ID',
    ] as const)('reports a missing %s', (key) => {
      const result = validateEnv(validEnv({ [key]: undefined } as Partial<Env>));

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(`required secret: ${key}`))).toBe(true);
    });

    it.each(['', '   '])('treats %j as missing, not present', (value) => {
      const result = validateEnv(validEnv({ DISCORD_TOKEN: value }));

      expect(result.errors.some((e) => e.includes('DISCORD_TOKEN'))).toBe(true);
    });

    it('treats a non-string secret as missing', () => {
      const result = validateEnv(validEnv({ DISCORD_TOKEN: 12345 as unknown as string }));

      expect(result.errors.some((e) => e.includes('DISCORD_TOKEN'))).toBe(true);
    });
  });

  describe('required config', () => {
    it.each(['DISCORD_CLIENT_ID', 'PRESETS_API_URL'] as const)('reports a missing %s', (key) => {
      const result = validateEnv(validEnv({ [key]: undefined } as Partial<Env>));

      expect(result.errors.some((e) => e.includes(`required config: ${key}`))).toBe(true);
    });

    it('flags an unreplaced wrangler.toml placeholder (SEC-005)', () => {
      // Non-empty, so it passes the presence check — and then fails at
      // runtime with an auth error that looks like a Discord outage.
      const result = validateEnv(validEnv({ DISCORD_CLIENT_ID: 'YOUR_CLIENT_ID_HERE' }));

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('placeholder value'))).toBe(true);
    });

    it('does not flag a real client id as a placeholder', () => {
      const result = validateEnv(validEnv({ DISCORD_CLIENT_ID: '1453806659708129374' }));

      expect(result.errors.some((e) => e.includes('placeholder'))).toBe(false);
    });
  });

  describe('PRESETS_API_URL', () => {
    it.each(['https://presets.xivdyetools.app', 'http://localhost:8787'])(
      'accepts %s',
      (url) => {
        const result = validateEnv(validEnv({ PRESETS_API_URL: url }));

        expect(result.errors.some((e) => e.includes('PRESETS_API_URL'))).toBe(false);
      }
    );

    it('rejects a non-HTTP scheme', () => {
      const result = validateEnv(validEnv({ PRESETS_API_URL: 'ftp://presets.example' }));

      expect(result.errors.some((e) => e.includes('must use HTTP(S)'))).toBe(true);
    });

    it('rejects an unparseable URL', () => {
      const result = validateEnv(validEnv({ PRESETS_API_URL: 'not a url' }));

      expect(result.errors.some((e) => e.includes('Invalid URL'))).toBe(true);
    });
  });

  describe('MODERATOR_IDS', () => {
    it.each([
      ['comma-separated', '123456789012345678,234567890123456789'],
      ['whitespace-separated', '123456789012345678 234567890123456789'],
      ['newline-separated', '123456789012345678\n234567890123456789'],
      ['a single id', '123456789012345678'],
    ])('accepts %s lists', (_label, value) => {
      const result = validateEnv(validEnv({ MODERATOR_IDS: value }));

      expect(result.errors.some((e) => e.includes('MODERATOR_IDS'))).toBe(false);
    });

    it('rejects a non-snowflake id (FINDING-002)', () => {
      const result = validateEnv(validEnv({ MODERATOR_IDS: '123456789012345678,not-a-snowflake' }));

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid Discord ID'))).toBe(true);
    });

    it('reports a separators-only value as empty', () => {
      const result = validateEnv(validEnv({ MODERATOR_IDS: ' , , ' }));

      expect(result.errors.some((e) => e.includes('at least one Discord ID'))).toBe(true);
    });
  });

  describe('bindings', () => {
    it.each([
      ['KV', 'KV namespace binding: KV'],
      ['DB', 'D1 database binding: DB'],
      ['PRESETS_API', 'service binding: PRESETS_API'],
    ] as const)('reports a missing %s binding', (key, message) => {
      const result = validateEnv(validEnv({ [key]: undefined } as Partial<Env>));

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes(message))).toBe(true);
    });
  });

  it('accumulates every problem rather than stopping at the first', () => {
    const result = validateEnv({
      PRESETS_API_URL: 'not a url',
      MODERATOR_IDS: 'nope',
    } as Env);

    expect(result.valid).toBe(false);
    // 3 missing secrets + 1 missing config + bad URL + bad snowflake + 3 bindings
    expect(result.errors.length).toBeGreaterThanOrEqual(8);
  });
});

describe('logValidationErrors', () => {
  it('routes to the structured logger when one is supplied', () => {
    const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    logValidationErrors(['boom'], logger as never);

    expect(logger.error).toHaveBeenCalledWith('Environment validation failed', undefined, {
      errors: ['boom'],
    });
  });

  it('falls back to console when there is no logger yet', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logValidationErrors(['first', 'second']);

    // One header line plus one line per error
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });

  it('prints only the header for an empty error list', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logValidationErrors([]);

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
