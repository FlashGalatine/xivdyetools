/**
 * @xivdyetools/types - Discord Snowflake Tests
 */
import { describe, it, expect } from 'vitest';
import {
  isValidSnowflake,
  createSnowflake,
  type DiscordSnowflake,
} from './discord-snowflake.js';

describe('isValidSnowflake', () => {
  describe('valid snowflakes', () => {
    it('should accept 17-digit snowflakes', () => {
      expect(isValidSnowflake('12345678901234567')).toBe(true);
    });

    it('should accept 18-digit snowflakes', () => {
      expect(isValidSnowflake('123456789012345678')).toBe(true);
    });

    it('should accept 19-digit snowflakes (current maximum)', () => {
      expect(isValidSnowflake('1234567890123456789')).toBe(true);
    });

    it('should accept 20-digit snowflakes (future-proofed)', () => {
      expect(isValidSnowflake('12345678901234567890')).toBe(true);
    });

    it('should accept all-zero snowflake', () => {
      expect(isValidSnowflake('00000000000000000')).toBe(true);
    });

    it('should accept all-nine snowflake', () => {
      expect(isValidSnowflake('99999999999999999')).toBe(true);
    });

    it('should accept real-looking Discord user IDs', () => {
      expect(isValidSnowflake('80351110224678912')).toBe(true);   // early Discord user
      expect(isValidSnowflake('987654321098765432')).toBe(true);  // typical current user
    });
  });

  describe('invalid snowflakes', () => {
    it('should reject empty string', () => {
      expect(isValidSnowflake('')).toBe(false);
    });

    it('should reject strings shorter than 17 digits', () => {
      expect(isValidSnowflake('1234567890123456')).toBe(false);  // 16 digits
      expect(isValidSnowflake('1')).toBe(false);
      expect(isValidSnowflake('1234567890')).toBe(false);        // 10 digits
    });

    it('should reject strings longer than 20 digits', () => {
      expect(isValidSnowflake('123456789012345678901')).toBe(false);  // 21 digits
    });

    it('should reject non-numeric characters', () => {
      expect(isValidSnowflake('1234567890123456a')).toBe(false);
      expect(isValidSnowflake('abcdefghijklmnopq')).toBe(false);
      expect(isValidSnowflake('12345678901234567!')).toBe(false);
    });

    it('should reject strings with spaces', () => {
      expect(isValidSnowflake(' 12345678901234567')).toBe(false);
      expect(isValidSnowflake('12345678901234567 ')).toBe(false);
      expect(isValidSnowflake('123456789 01234567')).toBe(false);
    });

    it('should reject strings with decimal points', () => {
      expect(isValidSnowflake('1234567890123456.7')).toBe(false);
    });

    it('should reject strings with leading sign', () => {
      expect(isValidSnowflake('+12345678901234567')).toBe(false);
      expect(isValidSnowflake('-12345678901234567')).toBe(false);
    });
  });
});

describe('createSnowflake', () => {
  it('should return a branded DiscordSnowflake for valid input', () => {
    const snowflake = createSnowflake('123456789012345678');
    expect(snowflake).toBe('123456789012345678');
    // Type assertion verifies the branded type works at compile time
    const _typed: DiscordSnowflake = snowflake;
    expect(_typed).toBe('123456789012345678');
  });

  it('should throw for invalid input', () => {
    expect(() => createSnowflake('')).toThrow('Invalid Discord snowflake format');
    expect(() => createSnowflake('abc')).toThrow('Invalid Discord snowflake format');
    expect(() => createSnowflake('1234')).toThrow('Invalid Discord snowflake format');
  });

  it('should include the invalid value in the error message', () => {
    expect(() => createSnowflake('not-a-snowflake')).toThrow('"not-a-snowflake"');
  });
});
