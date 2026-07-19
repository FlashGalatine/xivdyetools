/**
 * Unit tests for the shared MODERATOR_IDS grammar (BUG-073 / REFACTOR-010).
 *
 * The regression this module fixed was newline-separated lists failing
 * closed in discord-worker, so mixed-separator parsing is the core case.
 */

import { describe, it, expect } from 'vitest';
import { isValidDiscordSnowflake, parseModeratorIds, isModeratorId } from './moderators.js';

const ID_A = '123456789012345678'; // 18 digits
const ID_B = '98765432109876543'; // 17 digits

describe('isValidDiscordSnowflake', () => {
  it('accepts 17–20 digit numeric strings', () => {
    expect(isValidDiscordSnowflake(ID_B)).toBe(true); // 17
    expect(isValidDiscordSnowflake('1'.repeat(20))).toBe(true); // 20
  });

  it('rejects too-short, too-long, and non-numeric strings', () => {
    expect(isValidDiscordSnowflake('1234567890123456')).toBe(false); // 16
    expect(isValidDiscordSnowflake('1'.repeat(21))).toBe(false); // 21
    expect(isValidDiscordSnowflake('not-a-snowflake')).toBe(false);
    expect(isValidDiscordSnowflake('')).toBe(false);
  });
});

describe('parseModeratorIds', () => {
  it('returns an empty set for undefined or empty input', () => {
    expect(parseModeratorIds(undefined).size).toBe(0);
    expect(parseModeratorIds('').size).toBe(0);
  });

  it('parses comma-separated lists', () => {
    expect(parseModeratorIds(`${ID_A},${ID_B}`)).toEqual(new Set([ID_A, ID_B]));
  });

  it('parses newline-separated lists (BUG-073 regression)', () => {
    expect(parseModeratorIds(`${ID_A}\n${ID_B}`)).toEqual(new Set([ID_A, ID_B]));
  });

  it('parses mixed comma/space/newline separators', () => {
    expect(parseModeratorIds(` ${ID_A}, \n ${ID_B} `)).toEqual(new Set([ID_A, ID_B]));
  });

  it('drops non-snowflake tokens', () => {
    expect(parseModeratorIds(`${ID_A},garbage,123`)).toEqual(new Set([ID_A]));
  });

  it('deduplicates repeated IDs', () => {
    expect(parseModeratorIds(`${ID_A},${ID_A}`).size).toBe(1);
  });
});

describe('isModeratorId', () => {
  it('returns true when the user is in the list', () => {
    expect(isModeratorId(`${ID_A} ${ID_B}`, ID_B)).toBe(true);
  });

  it('returns false when the user is absent', () => {
    expect(isModeratorId(ID_A, ID_B)).toBe(false);
  });

  it('returns false for undefined/empty moderator list', () => {
    expect(isModeratorId(undefined, ID_A)).toBe(false);
    expect(isModeratorId('', ID_A)).toBe(false);
  });

  it('returns false for an invalid userId without parsing the list', () => {
    expect(isModeratorId(ID_A, 'garbage')).toBe(false);
  });
});
