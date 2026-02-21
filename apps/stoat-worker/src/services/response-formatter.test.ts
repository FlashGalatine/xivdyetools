/**
 * Tests for response-formatter.ts
 *
 * Covers all exported functions and constants.
 */

import { describe, it, expect } from 'vitest';
import {
  formatErrorReply,
  formatDisambiguationList,
  formatNoMatchReply,
  colorToHex,
  DYE_INFO_REACTIONS,
} from './response-formatter.js';

describe('DYE_INFO_REACTIONS', () => {
  it('contains 4 encoded emoji reactions', () => {
    expect(DYE_INFO_REACTIONS).toHaveLength(4);
  });

  it('reactions are URI-encoded emoji strings', () => {
    for (const reaction of DYE_INFO_REACTIONS) {
      expect(reaction).toMatch(/^%/);
      expect(decodeURIComponent(reaction)).toBeTruthy();
    }
  });
});

describe('formatErrorReply', () => {
  it('returns a reply with error content', () => {
    const result = formatErrorReply('msg-01', 'Something went wrong');
    expect(result.content).toBe('Something went wrong');
    expect(result.replies).toEqual([{ id: 'msg-01', mention: false }]);
  });

  it('appends usage hint when provided', () => {
    const result = formatErrorReply('msg-01', 'Missing argument', '!xd info <dye>');
    expect(result.content).toContain('Missing argument');
    expect(result.content).toContain('Usage: `!xd info <dye>`');
  });

  it('does not include usage line when omitted', () => {
    const result = formatErrorReply('msg-01', 'Oops');
    expect(result.content).not.toContain('Usage:');
  });
});

describe('formatDisambiguationList', () => {
  it('lists dye names with 1-based indices', () => {
    const dyes = [
      { name: 'Snow White', itemID: 5729 },
      { name: 'Pure White', itemID: 5730 },
    ];
    const result = formatDisambiguationList('msg-01', 'white', dyes, 2);
    expect(result.content).toContain('1. Snow White (5729)');
    expect(result.content).toContain('2. Pure White (5730)');
    expect(result.replies).toEqual([{ id: 'msg-01', mention: false }]);
  });

  it('shows "... and N more" when total exceeds displayed count', () => {
    const dyes = [{ name: 'Dye A', itemID: 1 }];
    const result = formatDisambiguationList('msg-01', 'test', dyes, 10);
    expect(result.content).toContain('... and 9 more');
  });

  it('does not show "... and N more" when all dyes are displayed', () => {
    const dyes = [
      { name: 'Dye A', itemID: 1 },
      { name: 'Dye B', itemID: 2 },
    ];
    const result = formatDisambiguationList('msg-01', 'test', dyes, 2);
    expect(result.content).not.toContain('... and');
  });

  it('omits item ID for null or non-positive IDs', () => {
    const dyes = [
      { name: 'Facewear Dye', itemID: null },
      { name: 'Negative ID', itemID: -1 },
      { name: 'Zero ID', itemID: 0 },
    ];
    const result = formatDisambiguationList('msg-01', 'test', dyes, 3);
    expect(result.content).toContain('1. Facewear Dye');
    expect(result.content).toContain('2. Negative ID');
    expect(result.content).toContain('3. Zero ID');
    expect(result.content).not.toMatch(/Facewear Dye \(/);
  });

  it('includes usage hint', () => {
    const result = formatDisambiguationList('msg-01', 'q', [], 0);
    expect(result.content).toContain('Use the full name or ItemID');
  });
});

describe('formatNoMatchReply', () => {
  it('reports no match for the query', () => {
    const result = formatNoMatchReply('msg-01', 'xyzzy', []);
    expect(result.content).toContain('No dye found matching "xyzzy"');
    expect(result.replies).toEqual([{ id: 'msg-01', mention: false }]);
  });

  it('includes suggestions when available', () => {
    const result = formatNoMatchReply('msg-01', 'whte', ['Snow White', 'Pure White']);
    expect(result.content).toContain('Did you mean: Snow White, Pure White?');
  });

  it('omits suggestions line when empty', () => {
    const result = formatNoMatchReply('msg-01', 'zzz', []);
    expect(result.content).not.toContain('Did you mean');
  });

  it('includes ItemID tip', () => {
    const result = formatNoMatchReply('msg-01', 'test', []);
    expect(result.content).toContain('ItemID');
  });
});

describe('colorToHex', () => {
  it('formats a color number as a 6-digit hex string', () => {
    expect(colorToHex(0xff5733)).toBe('#ff5733');
  });

  it('pads short hex values with leading zeros', () => {
    expect(colorToHex(0x000000)).toBe('#000000');
    expect(colorToHex(0x0000ff)).toBe('#0000ff');
    expect(colorToHex(0x00ff00)).toBe('#00ff00');
  });

  it('handles white (0xffffff)', () => {
    expect(colorToHex(0xffffff)).toBe('#ffffff');
  });
});
