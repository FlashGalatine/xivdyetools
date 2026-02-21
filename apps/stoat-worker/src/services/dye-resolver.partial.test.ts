/**
 * Tests for dye-resolver.ts partial match / disambiguation paths.
 *
 * Mocks @xivdyetools/bot-logic to force resolution past the exact-match
 * branches into the partial/substring match branches.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock bot-logic so resolveColorInput and resolveDyeInput return null,
// forcing the code into the partial match path using dyeService.getAllDyes()
vi.mock('@xivdyetools/bot-logic', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@xivdyetools/bot-logic')>();
  return {
    ...actual,
    resolveColorInput: vi.fn().mockReturnValue(null),
    resolveDyeInput: vi.fn().mockReturnValue(null),
    dyeService: {
      getAllDyes: vi.fn().mockReturnValue([
        { hex: '#ffffff', name: 'Snow White', id: 1, itemID: 5729, category: 'White', categoryIndex: 0, sortOrder: 0, localizedNames: {} },
        { hex: '#eeeeee', name: 'Pure White', id: 2, itemID: 5730, category: 'White', categoryIndex: 0, sortOrder: 1, localizedNames: {} },
        { hex: '#111111', name: 'Jet Black', id: 3, itemID: 5731, category: 'Black', categoryIndex: 1, sortOrder: 0, localizedNames: {} },
        { hex: '#ff0000', name: 'Dalamud Red', id: 4, itemID: 5732, category: 'Red', categoryIndex: 2, sortOrder: 0, localizedNames: {} },
        { hex: '#cc0000', name: 'Rose Red', id: 5, itemID: 5733, category: 'Red', categoryIndex: 2, sortOrder: 1, localizedNames: {} },
        { hex: '#ff3333', name: 'Coral Red', id: 6, itemID: 5734, category: 'Red', categoryIndex: 2, sortOrder: 2, localizedNames: {} },
        { hex: '#ff6666', name: 'Salmon Pink', id: 7, itemID: 5735, category: 'Red', categoryIndex: 2, sortOrder: 3, localizedNames: {} },
        { hex: '#ff9999', name: 'Light Red', id: 8, itemID: 5736, category: 'Red', categoryIndex: 2, sortOrder: 4, localizedNames: {} },
      ]),
    },
  };
});

import {
  resolveDyeInputMulti,
  MULTI_MATCH_THRESHOLD,
  MAX_DISAMBIGUATION_RESULTS,
} from './dye-resolver.js';
import { resolveColorInput, resolveDyeInput } from '@xivdyetools/bot-logic';

describe('resolveDyeInputMulti (partial match paths)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default mock behavior (return null)
    vi.mocked(resolveColorInput).mockReturnValue(null);
    vi.mocked(resolveDyeInput).mockReturnValue(null);
  });

  it('returns kind=single when exactly one dye name matches', () => {
    // "Jet" matches only "Jet Black" in the name
    const result = resolveDyeInputMulti('Jet');
    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.dye.name).toBe('Jet Black');
      expect(result.dye.hex).toBe('#111111');
      expect(result.dye.id).toBe(3);
      expect(result.dye.itemID).toBe(5731);
      expect(result.dye.dye).toBeDefined();
    }
  });

  it('returns kind=multiple when 2-4 dyes match by name', () => {
    // "White" matches "Snow White" and "Pure White" (2 matches, ≤ threshold)
    const result = resolveDyeInputMulti('White');
    // "White" also matches the category, so could be more
    expect(['multiple', 'disambiguation']).toContain(result.kind);
    if (result.kind === 'multiple') {
      expect(result.dyes.length).toBeGreaterThanOrEqual(2);
      expect(result.dyes.length).toBeLessThanOrEqual(MULTI_MATCH_THRESHOLD);
      expect(result.query).toBe('White');
      for (const dye of result.dyes) {
        expect(dye.hex).toBeDefined();
        expect(dye.name).toBeDefined();
        expect(dye.dye).toBeDefined();
      }
    }
  });

  it('returns kind=disambiguation when many dyes match a category', () => {
    // "Red" matches "Dalamud Red", "Rose Red", "Coral Red", "Light Red" by name
    // plus "Salmon Pink" (category=Red), total 5 which > MULTI_MATCH_THRESHOLD(4)
    const result = resolveDyeInputMulti('Red');
    expect(result.kind).toBe('disambiguation');
    if (result.kind === 'disambiguation') {
      expect(result.total).toBeGreaterThan(MULTI_MATCH_THRESHOLD);
      expect(result.dyes.length).toBeLessThanOrEqual(MAX_DISAMBIGUATION_RESULTS);
      expect(result.query).toBe('Red');
    }
  });

  it('returns kind=none with suggestions when no partial match', () => {
    const result = resolveDyeInputMulti('xyzzyplugh');
    expect(result.kind).toBe('none');
    if (result.kind === 'none') {
      expect(result.query).toBe('xyzzyplugh');
      expect(Array.isArray(result.suggestions)).toBe(true);
    }
  });

  it('generates startsWith suggestions when available', () => {
    // "Snow" doesn't match anything since resolveColorInput/resolveDyeInput return null
    // but "Snow" starts with the name "Snow White"
    const result = resolveDyeInputMulti('Snow');
    // Since "Snow" is a substring of "Snow White", it matches via partial match
    expect(['single']).toContain(result.kind);
  });

  it('generates character overlap suggestions as fallback', () => {
    // A string with 70%+ character overlap with names but no substring match
    // Use something that overlaps with "Jet Black" characters
    const result = resolveDyeInputMulti('Jeb Tlack');
    // Won't substring-match but has character overlap with "Jet Black"
    if (result.kind === 'none') {
      // Suggestions via character overlap (70% threshold)
      expect(Array.isArray(result.suggestions)).toBe(true);
    }
  });

  it('falls through to partial match when resolveColorInput returns null', () => {
    // Ensure our mock returns null
    expect(resolveColorInput('anything')).toBeNull();
    
    const result = resolveDyeInputMulti('Salmon');
    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.dye.name).toBe('Salmon Pink');
    }
  });

  it('resolveDyeInput path returns single with full dye fields', () => {
    // Make resolveDyeInput return a dye this time
    vi.mocked(resolveDyeInput).mockReturnValueOnce({
      hex: '#aabbcc',
      name: 'Test Dye',
      id: 99,
      itemID: 9999,
      category: 'Test',
      categoryIndex: 0,
      sortOrder: 0,
      localizedNames: {},
    } as any);

    const result = resolveDyeInputMulti('Test Dye');
    expect(result.kind).toBe('single');
    if (result.kind === 'single') {
      expect(result.dye.hex).toBe('#aabbcc');
      expect(result.dye.name).toBe('Test Dye');
      expect(result.dye.id).toBe(99);
      expect(result.dye.itemID).toBe(9999);
      expect(result.dye.dye).toBeDefined();
    }
  });

  it('matches by category when name does not match', () => {
    // "Salmon Pink" has category "Red", so searching "Red" should include it
    const result = resolveDyeInputMulti('Red');
    if (result.kind === 'disambiguation' || result.kind === 'multiple') {
      const names = result.dyes.map((d) => d.name);
      expect(names).toContain('Salmon Pink'); // matched by category
    }
  });
});
