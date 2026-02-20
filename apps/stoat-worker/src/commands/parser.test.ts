/**
 * Tests for the command parser.
 *
 * The parser is the first thing every message hits, so thorough
 * coverage here prevents misrouting bugs downstream.
 */

import { describe, it, expect } from 'vitest';
import { parseCommand, parseSingleDyeArgs, parseMultiDyeArgs } from './parser.js';

// ════════════════════════════════════════════════════════════════════════
// parseCommand
// ════════════════════════════════════════════════════════════════════════

describe('parseCommand', () => {
  // ── Prefix detection ────────────────────────────────────────────────

  describe('prefix detection', () => {
    it('recognizes !xd prefix', () => {
      const result = parseCommand('!xd info Snow White');
      expect(result).not.toBeNull();
      expect(result!.prefix).toBe('!xd');
    });

    it('recognizes !xivdye prefix', () => {
      const result = parseCommand('!xivdye harmony Pure White');
      expect(result).not.toBeNull();
      expect(result!.prefix).toBe('!xivdye');
    });

    it('is case-insensitive for prefix', () => {
      const result = parseCommand('!XD info test');
      expect(result).not.toBeNull();
      expect(result!.prefix).toBe('!xd');
    });

    it('returns null for non-matching prefix', () => {
      expect(parseCommand('hello world')).toBeNull();
      expect(parseCommand('!other info')).toBeNull();
    });

    it('does not match prefix as substring', () => {
      expect(parseCommand('!xdstuff')).toBeNull();
      expect(parseCommand('!xivdyestuff')).toBeNull();
    });

    it('treats bare prefix as help command', () => {
      const result = parseCommand('!xd');
      expect(result).not.toBeNull();
      expect(result!.command).toBe('help');
      expect(result!.subcommand).toBeNull();
      expect(result!.rawArgs).toEqual([]);
    });
  });

  // ── Short aliases ──────────────────────────────────────────────────

  describe('short aliases', () => {
    it('maps !xd info → dye.info', () => {
      const result = parseCommand('!xd info Snow White');
      expect(result).toMatchObject({
        command: 'dye',
        subcommand: 'info',
        rawArgs: ['Snow', 'White'],
      });
    });

    it('maps !xd search → dye.search', () => {
      const result = parseCommand('!xd search turquoise');
      expect(result).toMatchObject({
        command: 'dye',
        subcommand: 'search',
        rawArgs: ['turquoise'],
      });
    });

    it('maps !xd random → dye.random', () => {
      const result = parseCommand('!xd random');
      expect(result).toMatchObject({
        command: 'dye',
        subcommand: 'random',
        rawArgs: [],
      });
    });

    it('maps !xd list → dye.list', () => {
      const result = parseCommand('!xd list Red');
      expect(result).toMatchObject({
        command: 'dye',
        subcommand: 'list',
        rawArgs: ['Red'],
      });
    });
  });

  // ── Subcommand routing ─────────────────────────────────────────────

  describe('subcommand routing', () => {
    it('extracts subcommand for known parent commands', () => {
      const result = parseCommand('!xd dye info Snow White');
      expect(result).toMatchObject({
        command: 'dye',
        subcommand: 'info',
        rawArgs: ['Snow', 'White'],
      });
    });

    it('handles parent command without subcommand', () => {
      const result = parseCommand('!xd stats');
      expect(result).toMatchObject({
        command: 'stats',
        subcommand: null,
        rawArgs: [],
      });
    });
  });

  // ── Simple commands ────────────────────────────────────────────────

  describe('simple commands', () => {
    it('parses simple commands without subcommands', () => {
      const result = parseCommand('!xd ping');
      expect(result).toMatchObject({
        command: 'ping',
        subcommand: null,
        rawArgs: [],
      });
    });

    it('parses help command', () => {
      const result = parseCommand('!xd help');
      expect(result).toMatchObject({
        command: 'help',
        subcommand: null,
        rawArgs: [],
      });
    });

    it('parses harmony with greedy args', () => {
      const result = parseCommand('!xivdye harmony Pure White triadic');
      expect(result).toMatchObject({
        command: 'harmony',
        subcommand: null,
        rawArgs: ['Pure', 'White', 'triadic'],
      });
    });

    it('parses gradient with > separator', () => {
      const result = parseCommand('!xivdye gradient Pure White > Jet Black 5');
      expect(result).toMatchObject({
        command: 'gradient',
        subcommand: null,
        rawArgs: ['Pure', 'White', '>', 'Jet', 'Black', '5'],
      });
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles extra whitespace', () => {
      const result = parseCommand('  !xd   info   Snow   White  ');
      expect(result).toMatchObject({
        command: 'dye',
        subcommand: 'info',
        rawArgs: ['Snow', 'White'],
      });
    });

    it('ignores empty content', () => {
      expect(parseCommand('')).toBeNull();
      expect(parseCommand('   ')).toBeNull();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════
// parseSingleDyeArgs
// ════════════════════════════════════════════════════════════════════════

describe('parseSingleDyeArgs', () => {
  it('returns empty dyeName for empty tokens', () => {
    const result = parseSingleDyeArgs([]);
    expect(result).toEqual({ dyeName: '', trailingArgs: [] });
  });

  it('returns full name when no trailing options', () => {
    const result = parseSingleDyeArgs(['Snow', 'White']);
    expect(result).toEqual({ dyeName: 'Snow White', trailingArgs: [] });
  });

  it('splits trailing known option values', () => {
    const result = parseSingleDyeArgs(['Pure', 'White', 'triadic']);
    expect(result).toEqual({ dyeName: 'Pure White', trailingArgs: ['triadic'] });
  });

  it('splits trailing numeric args', () => {
    const result = parseSingleDyeArgs(['Jet', 'Black', '5']);
    expect(result).toEqual({ dyeName: 'Jet Black', trailingArgs: ['5'] });
  });

  it('splits multiple trailing options', () => {
    const result = parseSingleDyeArgs(['Sunset', 'Orange', '5', 'oklch']);
    expect(result).toEqual({ dyeName: 'Sunset Orange', trailingArgs: ['5', 'oklch'] });
  });

  it('treats a single word as the dye name', () => {
    const result = parseSingleDyeArgs(['turquoise']);
    expect(result).toEqual({ dyeName: 'turquoise', trailingArgs: [] });
  });
});

// ════════════════════════════════════════════════════════════════════════
// parseMultiDyeArgs
// ════════════════════════════════════════════════════════════════════════

describe('parseMultiDyeArgs', () => {
  it('returns empty for no tokens', () => {
    const result = parseMultiDyeArgs([]);
    expect(result).toEqual({ dyeSegments: [], trailingArgs: [] });
  });

  it('returns single segment if no > separator', () => {
    const result = parseMultiDyeArgs(['Snow', 'White']);
    expect(result).toEqual({ dyeSegments: ['Snow White'], trailingArgs: [] });
  });

  it('splits two dye segments by >', () => {
    const result = parseMultiDyeArgs(['Pure', 'White', '>', 'Jet', 'Black']);
    expect(result).toEqual({
      dyeSegments: ['Pure White', 'Jet Black'],
      trailingArgs: [],
    });
  });

  it('extracts trailing args from the last segment', () => {
    const result = parseMultiDyeArgs(['Pure', 'White', '>', 'Jet', 'Black', '5', 'oklch']);
    expect(result).toEqual({
      dyeSegments: ['Pure White', 'Jet Black'],
      trailingArgs: ['5', 'oklch'],
    });
  });

  it('handles three dye segments', () => {
    const result = parseMultiDyeArgs([
      'Pure',
      'White',
      '>',
      'Soot',
      'Black',
      '>',
      'Jet',
      'Black',
    ]);
    expect(result).toEqual({
      dyeSegments: ['Pure White', 'Soot Black', 'Jet Black'],
      trailingArgs: [],
    });
  });

  it('ignores leading > separator', () => {
    const result = parseMultiDyeArgs(['>', 'Snow', 'White']);
    expect(result).toEqual({ dyeSegments: ['Snow White'], trailingArgs: [] });
  });

  it('ignores consecutive > separators', () => {
    const result = parseMultiDyeArgs(['Pure', 'White', '>', '>', 'Jet', 'Black']);
    expect(result).toEqual({
      dyeSegments: ['Pure White', 'Jet Black'],
      trailingArgs: [],
    });
  });
});
