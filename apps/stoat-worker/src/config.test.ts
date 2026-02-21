/**
 * Tests for bot configuration loading and validation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig, isValidUlid, isAuthorized } from './config.js';

describe('isValidUlid', () => {
  it('accepts valid Stoat ULIDs', () => {
    // Crockford Base32: 0-9 A-H J-K M-N P-T V-Z (excludes I, L, O, U)
    expect(isValidUlid('01HQJK8E0G1234567890ABCDEF')).toBe(true);
    expect(isValidUlid('00000000000000000000000000')).toBe(true);
    expect(isValidUlid('7ZZZZZZZZZZZZZZZZZZZZZZZZZ')).toBe(true);
  });

  it('rejects invalid ULIDs', () => {
    expect(isValidUlid('')).toBe(false);
    expect(isValidUlid('too-short')).toBe(false);
    expect(isValidUlid('01HQJK8E0G1234567890ABCDE')).toBe(false); // 25 chars
    expect(isValidUlid('01HQJK8E0G1234567890ABCDEFG')).toBe(false); // 27 chars
  });

  it('rejects ULIDs with excluded characters (I, L, O, U)', () => {
    expect(isValidUlid('01HQJK8E0G123456789IABCDEF')).toBe(false); // I
    expect(isValidUlid('01HQJK8E0G123456789LABCDEF')).toBe(false); // L
    expect(isValidUlid('01HQJK8E0G123456789OABCDEF')).toBe(false); // O
    expect(isValidUlid('01HQJK8E0G123456789UABCDEF')).toBe(false); // U
  });
});

describe('loadConfig', () => {
  beforeEach(() => {
    vi.stubEnv('BOT_TOKEN', 'test-token-123');
    vi.stubEnv('STATS_AUTHORIZED_USERS', '');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads BOT_TOKEN from env', () => {
    const config = loadConfig();
    expect(config.botToken).toBe('test-token-123');
  });

  it('throws if BOT_TOKEN is missing', () => {
    vi.stubEnv('BOT_TOKEN', '');
    // loadConfig checks for falsy, empty string is falsy
    expect(() => loadConfig()).toThrow('BOT_TOKEN');
  });

  it('parses comma-separated authorized users', () => {
    vi.stubEnv(
      'STATS_AUTHORIZED_USERS',
      '01HQJK8E0G1234567890ABCDEF,01HQJK8E0G1234567890ABCDEG',
    );
    const config = loadConfig();
    expect(config.authorizedUsers).toHaveLength(2);
    expect(config.authorizedUsers[0]).toBe('01HQJK8E0G1234567890ABCDEF');
  });

  it('handles empty authorized users', () => {
    vi.stubEnv('STATS_AUTHORIZED_USERS', '');
    const config = loadConfig();
    expect(config.authorizedUsers).toEqual([]);
  });

  it('throws on invalid ULID in authorized users', () => {
    vi.stubEnv('STATS_AUTHORIZED_USERS', 'invalid-ulid');
    expect(() => loadConfig()).toThrow('Invalid Stoat ULID');
  });

  it('loads optional Upstash config', () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://redis.example.com');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'secret');
    const config = loadConfig();
    expect(config.upstashRedisUrl).toBe('https://redis.example.com');
    expect(config.upstashRedisToken).toBe('secret');
  });
});

describe('isAuthorized', () => {
  it('returns true for authorized user', () => {
    const config = {
      botToken: 'test',
      authorizedUsers: ['01HQJK8E0G1234567890ABCDEF'],
    };
    expect(isAuthorized(config, '01HQJK8E0G1234567890ABCDEF')).toBe(true);
  });

  it('returns false for unauthorized user', () => {
    const config = {
      botToken: 'test',
      authorizedUsers: ['01HQJK8E0G1234567890ABCDEF'],
    };
    expect(isAuthorized(config, '01HQJK8E0GOTHER000000000000')).toBe(false);
  });

  it('returns false when no users are authorized', () => {
    const config = { botToken: 'test', authorizedUsers: [] };
    expect(isAuthorized(config, '01HQJK8E0G1234567890ABCDEF')).toBe(false);
  });
});
