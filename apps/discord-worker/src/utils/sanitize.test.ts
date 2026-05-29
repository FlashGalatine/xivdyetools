/**
 * Unit tests for text sanitization utilities.
 *
 * These functions are security-critical: they strip control characters,
 * invisible Unicode, and Zalgo text from user-provided content before it
 * is sent to Discord embeds. Any missed character class can cause display
 * corruption or log-injection vulnerabilities.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizePresetName,
  sanitizePresetDescription,
  sanitizeCollectionName,
  sanitizeCollectionDescription,
  MAX_PRESET_NAME_LENGTH,
  MAX_PRESET_DESCRIPTION_LENGTH,
  MAX_COLLECTION_NAME_LENGTH,
  MAX_COLLECTION_DESCRIPTION_LENGTH,
} from './sanitize.js';

// ============================================================================
// Control character stripping
// ============================================================================

describe('control character stripping', () => {
  it('strips ASCII NUL (\\x00)', () => {
    expect(sanitizePresetName('foo\x00bar')).toBe('foobar');
  });

  it('strips ASCII control chars \\x01-\\x08', () => {
    expect(sanitizePresetName('a\x01\x02\x03b')).toBe('ab');
  });

  it('strips vertical tab (\\x0B) and form feed (\\x0C)', () => {
    expect(sanitizePresetName('a\x0Bb\x0Cc')).toBe('abc');
  });

  it('strips control chars \\x0E-\\x1F', () => {
    expect(sanitizePresetName('a\x0Eb\x1Fc')).toBe('abc');
  });

  it('strips DEL (\\x7F)', () => {
    expect(sanitizePresetName('delete\x7Fme')).toBe('deleteme');
  });

  it('preserves tab (\\x09) as it is a whitespace — gets normalized to single space', () => {
    // Tab is not stripped but whitespace normalization collapses it
    const result = sanitizePresetName('hello\tworld');
    expect(result).toBe('hello world');
  });

  it('preserves newline (\\x0A) — normalized to single space', () => {
    const result = sanitizePresetDescription('line1\nline2');
    expect(result).toBe('line1 line2');
  });
});

// ============================================================================
// Invisible Unicode stripping
// ============================================================================

describe('invisible Unicode stripping', () => {
  it('strips zero-width space (U+200B)', () => {
    expect(sanitizePresetName('foo​bar')).toBe('foobar');
  });

  it('strips zero-width non-joiner (U+200C)', () => {
    expect(sanitizePresetName('foo‌bar')).toBe('foobar');
  });

  it('strips zero-width joiner (U+200D)', () => {
    expect(sanitizePresetName('foo‍bar')).toBe('foobar');
  });

  it('strips byte order mark (U+FEFF)', () => {
    expect(sanitizePresetName('﻿Hello')).toBe('Hello');
  });

  it('strips word joiner (U+2060)', () => {
    expect(sanitizePresetName('foo⁠bar')).toBe('foobar');
  });

  it('strips soft hyphen (U+00AD)', () => {
    expect(sanitizePresetName('foo­bar')).toBe('foobar');
  });
});

// ============================================================================
// Whitespace normalization
// ============================================================================

describe('whitespace normalization', () => {
  it('collapses multiple spaces to one', () => {
    expect(sanitizePresetName('foo  bar   baz')).toBe('foo bar baz');
  });

  it('trims leading whitespace', () => {
    expect(sanitizePresetName('   hello')).toBe('hello');
  });

  it('trims trailing whitespace', () => {
    expect(sanitizePresetName('hello   ')).toBe('hello');
  });

  it('trims and collapses combined', () => {
    expect(sanitizePresetName('  foo   bar  ')).toBe('foo bar');
  });
});

// ============================================================================
// Truncation
// ============================================================================

describe('sanitizePresetName — truncation', () => {
  it('truncates names longer than MAX_PRESET_NAME_LENGTH', () => {
    const longName = 'a'.repeat(MAX_PRESET_NAME_LENGTH + 10);
    const result = sanitizePresetName(longName);
    expect(result.length).toBeLessThanOrEqual(MAX_PRESET_NAME_LENGTH);
    expect(result.endsWith('…')).toBe(true);
  });

  it('does not truncate names at exactly the limit', () => {
    const name = 'a'.repeat(MAX_PRESET_NAME_LENGTH);
    const result = sanitizePresetName(name);
    expect(result).toBe(name);
  });

  it('does not truncate short names', () => {
    expect(sanitizePresetName('Short Name')).toBe('Short Name');
  });
});

describe('sanitizePresetDescription — truncation', () => {
  it('truncates descriptions longer than MAX_PRESET_DESCRIPTION_LENGTH', () => {
    const longDesc = 'b'.repeat(MAX_PRESET_DESCRIPTION_LENGTH + 10);
    const result = sanitizePresetDescription(longDesc);
    expect(result.length).toBeLessThanOrEqual(MAX_PRESET_DESCRIPTION_LENGTH);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('sanitizeCollectionName — truncation', () => {
  it('truncates names longer than MAX_COLLECTION_NAME_LENGTH', () => {
    const longName = 'c'.repeat(MAX_COLLECTION_NAME_LENGTH + 5);
    const result = sanitizeCollectionName(longName);
    expect(result.length).toBeLessThanOrEqual(MAX_COLLECTION_NAME_LENGTH);
    expect(result.endsWith('…')).toBe(true);
  });
});

describe('sanitizeCollectionDescription — truncation', () => {
  it('truncates descriptions longer than MAX_COLLECTION_DESCRIPTION_LENGTH', () => {
    const longDesc = 'd'.repeat(MAX_COLLECTION_DESCRIPTION_LENGTH + 5);
    const result = sanitizeCollectionDescription(longDesc);
    expect(result.length).toBeLessThanOrEqual(MAX_COLLECTION_DESCRIPTION_LENGTH);
    expect(result.endsWith('…')).toBe(true);
  });
});

// ============================================================================
// Non-string input defence
// ============================================================================

describe('non-string input safety', () => {
  it('returns empty string for null-like input (cast to any)', () => {
    expect(sanitizePresetName(null as unknown as string)).toBe('');
    expect(sanitizePresetName(undefined as unknown as string)).toBe('');
    expect(sanitizePresetName(42 as unknown as string)).toBe('');
  });
});

// ============================================================================
// Normal input passes through unchanged
// ============================================================================

describe('normal input preservation', () => {
  it('passes through plain ASCII text', () => {
    expect(sanitizePresetName('Dalamud Red')).toBe('Dalamud Red');
  });

  it('passes through CJK characters', () => {
    expect(sanitizePresetName('真紅の染料')).toBe('真紅の染料');
  });

  it('passes through punctuation and symbols', () => {
    expect(sanitizePresetName("FF14 Dye Set #1 (Metallic)")).toBe("FF14 Dye Set #1 (Metallic)");
  });

  it('passes through accented Latin characters', () => {
    expect(sanitizePresetName('Teinture écarlate')).toBe('Teinture écarlate');
  });
});

// ============================================================================
// Exported constants
// ============================================================================

describe('exported length constants', () => {
  it('MAX_PRESET_NAME_LENGTH is a positive integer', () => {
    expect(typeof MAX_PRESET_NAME_LENGTH).toBe('number');
    expect(MAX_PRESET_NAME_LENGTH).toBeGreaterThan(0);
  });

  it('MAX_PRESET_DESCRIPTION_LENGTH > MAX_PRESET_NAME_LENGTH', () => {
    expect(MAX_PRESET_DESCRIPTION_LENGTH).toBeGreaterThan(MAX_PRESET_NAME_LENGTH);
  });
});
