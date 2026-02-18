/**
 * Tests for test secret constants
 */
import { describe, it, expect } from 'vitest';
import {
  TEST_JWT_SECRET,
  TEST_BOT_SECRET,
  TEST_DISCORD_CLIENT_ID,
  TEST_DISCORD_CLIENT_SECRET,
  TEST_XIVAUTH_CLIENT_ID,
  TEST_MODERATOR_IDS,
  TEST_USER_DISCORD_ID,
  TEST_MODERATOR_DISCORD_ID,
  TEST_FRONTEND_URL,
  TEST_WORKER_URL,
  TEST_CORS_ORIGIN,
  TEST_JWT_EXPIRY,
  TEST_JWT_EXPIRY_STRING,
} from '../../src/constants/secrets.js';

describe('Test Secrets Constants', () => {
  describe('JWT Secret', () => {
    it('is a non-empty string', () => {
      expect(typeof TEST_JWT_SECRET).toBe('string');
      expect(TEST_JWT_SECRET.length).toBeGreaterThan(0);
    });

    it('has sufficient length for HMAC-SHA256', () => {
      // Minimum recommended is 32 bytes
      expect(TEST_JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('Bot Secret', () => {
    it('is a non-empty string', () => {
      expect(typeof TEST_BOT_SECRET).toBe('string');
      expect(TEST_BOT_SECRET.length).toBeGreaterThan(0);
    });
  });

  describe('Discord Credentials', () => {
    it('has client ID', () => {
      expect(typeof TEST_DISCORD_CLIENT_ID).toBe('string');
      expect(TEST_DISCORD_CLIENT_ID.length).toBeGreaterThan(0);
    });

    it('has client secret', () => {
      expect(typeof TEST_DISCORD_CLIENT_SECRET).toBe('string');
      expect(TEST_DISCORD_CLIENT_SECRET.length).toBeGreaterThan(0);
    });
  });

  describe('XIVAuth Credentials', () => {
    it('has client ID', () => {
      expect(typeof TEST_XIVAUTH_CLIENT_ID).toBe('string');
      expect(TEST_XIVAUTH_CLIENT_ID.length).toBeGreaterThan(0);
    });
  });

  describe('Moderator IDs', () => {
    it('is a comma-separated list', () => {
      expect(TEST_MODERATOR_IDS).toContain(',');
    });

    it('can be parsed into array', () => {
      const ids = TEST_MODERATOR_IDS.split(',');
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.every((id) => id.length > 0)).toBe(true);
    });

    it('includes TEST_MODERATOR_DISCORD_ID', () => {
      expect(TEST_MODERATOR_IDS).toContain(TEST_MODERATOR_DISCORD_ID);
    });
  });

  describe('User IDs', () => {
    it('has test user ID', () => {
      expect(typeof TEST_USER_DISCORD_ID).toBe('string');
      expect(TEST_USER_DISCORD_ID.length).toBeGreaterThan(0);
    });

    it('has test moderator ID', () => {
      expect(typeof TEST_MODERATOR_DISCORD_ID).toBe('string');
      expect(TEST_MODERATOR_DISCORD_ID.length).toBeGreaterThan(0);
    });

    it('user and moderator IDs are different', () => {
      expect(TEST_USER_DISCORD_ID).not.toBe(TEST_MODERATOR_DISCORD_ID);
    });
  });

  describe('URLs', () => {
    it('has valid frontend URL', () => {
      expect(() => new URL(TEST_FRONTEND_URL)).not.toThrow();
    });

    it('has valid worker URL', () => {
      expect(() => new URL(TEST_WORKER_URL)).not.toThrow();
    });

    it('has valid CORS origin URL', () => {
      expect(() => new URL(TEST_CORS_ORIGIN)).not.toThrow();
    });

    it('frontend URL uses localhost', () => {
      const url = new URL(TEST_FRONTEND_URL);
      expect(url.hostname).toBe('localhost');
    });

    it('worker URL uses localhost', () => {
      const url = new URL(TEST_WORKER_URL);
      expect(url.hostname).toBe('localhost');
    });
  });

  describe('JWT Expiry', () => {
    it('is a number', () => {
      expect(typeof TEST_JWT_EXPIRY).toBe('number');
    });

    it('is 1 hour in seconds', () => {
      expect(TEST_JWT_EXPIRY).toBe(3600);
    });

    it('string matches number', () => {
      expect(TEST_JWT_EXPIRY_STRING).toBe(String(TEST_JWT_EXPIRY));
    });
  });
});
