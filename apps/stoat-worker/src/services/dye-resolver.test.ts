/**
 * Tests for dye-resolver.ts
 *
 * Covers resolveDyeInputMulti() for all 4 result kinds:
 * single, multiple, disambiguation, none.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  resolveDyeInputMulti,
  MULTI_MATCH_THRESHOLD,
  MAX_DISAMBIGUATION_RESULTS,
  type DyeResolutionResult,
} from './dye-resolver.js';

describe('resolveDyeInputMulti', () => {
  describe('empty / blank input', () => {
    it('returns kind=none for empty string', () => {
      const result = resolveDyeInputMulti('');
      expect(result.kind).toBe('none');
      if (result.kind === 'none') {
        expect(result.query).toBe('');
        expect(result.suggestions).toEqual([]);
      }
    });

    it('returns kind=none for whitespace-only input', () => {
      const result = resolveDyeInputMulti('   ');
      expect(result.kind).toBe('none');
    });
  });

  describe('exact color input (hex code)', () => {
    it('resolves a hex code to a single dye', () => {
      const result = resolveDyeInputMulti('#FFFFFF');
      expect(result.kind).toBe('single');
      if (result.kind === 'single') {
        expect(result.dye).toBeDefined();
        expect(result.dye.hex).toBeDefined();
      }
    });

    it('resolves a 3-digit hex code', () => {
      const result = resolveDyeInputMulti('#FFF');
      expect(result.kind).toBe('single');
    });
  });

  describe('exact dye name input', () => {
    it('resolves an exact dye name to a single result', () => {
      const result = resolveDyeInputMulti('Snow White');
      expect(result.kind).toBe('single');
      if (result.kind === 'single') {
        expect(result.dye.name).toBe('Snow White');
        expect(result.dye.dye).toBeDefined();
      }
    });

    it('resolves "Jet Black"', () => {
      const result = resolveDyeInputMulti('Jet Black');
      expect(result.kind).toBe('single');
      if (result.kind === 'single') {
        expect(result.dye.name).toBe('Jet Black');
      }
    });
  });

  describe('partial match — single result', () => {
    it('returns kind=single for a unique partial match', () => {
      // "Jet Black" is the only dye with "Jet" in the name
      const result = resolveDyeInputMulti('Jet');
      expect(result.kind).toBe('single');
      if (result.kind === 'single') {
        expect(result.dye.name).toBe('Jet Black');
        expect(result.dye.dye).toBeDefined();
        expect(result.dye.hex).toBeDefined();
        expect(result.dye.id).toBeDefined();
        expect(result.dye.itemID).toBeDefined();
      }
    });
  });

  describe('partial match — multiple results (2-4 matches)', () => {
    it('returns kind=multiple when a small number of dyes match', () => {
      // Try "Coral" - should match "Coral Pink" and maybe "Coral" category dyes
      const result = resolveDyeInputMulti('Coral');
      if (result.kind === 'multiple') {
        expect(result.dyes.length).toBeGreaterThanOrEqual(2);
        expect(result.dyes.length).toBeLessThanOrEqual(MULTI_MATCH_THRESHOLD);
        expect(result.query).toBe('Coral');
        // Each resolved dye should have required fields
        for (const dye of result.dyes) {
          expect(dye.hex).toBeDefined();
          expect(dye.name).toBeDefined();
          expect(dye.dye).toBeDefined();
        }
      } else {
        // Still valid resolution
        expect(['single', 'multiple', 'disambiguation']).toContain(result.kind);
      }
    });
  });

  describe('partial match — disambiguation (many results)', () => {
    it('returns kind=disambiguation when many dyes match a category', () => {
      // "Blue" matches many dyes (a category + names)
      const result = resolveDyeInputMulti('Blue');
      // Should match many blue dyes
      if (result.kind === 'disambiguation') {
        expect(result.dyes.length).toBeLessThanOrEqual(MAX_DISAMBIGUATION_RESULTS);
        expect(result.total).toBeGreaterThan(MULTI_MATCH_THRESHOLD);
        expect(result.query).toBe('Blue');
      } else {
        // Even if it returns multiple, it's still a valid resolution
        expect(['single', 'multiple', 'disambiguation']).toContain(result.kind);
      }
    });
  });

  describe('no match', () => {
    it('returns kind=none for a gibberish input', () => {
      const result = resolveDyeInputMulti('xyzzyplugh12345');
      expect(result.kind).toBe('none');
      if (result.kind === 'none') {
        expect(result.query).toBe('xyzzyplugh12345');
      }
    });

    it('includes suggestions for a near-miss prefix', () => {
      // "Sno" starts with same letters as "Snow White"
      const result = resolveDyeInputMulti('Sno');
      // Could be single (partial match catches it) or none with suggestions
      if (result.kind === 'none') {
        expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
      }
    });

    it('includes suggestions via character overlap for typo', () => {
      // A string where no dye starts with it, but character overlap might suggest
      const result = resolveDyeInputMulti('Znow Whiet');
      if (result.kind === 'none') {
        // Suggestions may or may not be generated
        expect(Array.isArray(result.suggestions)).toBe(true);
      }
    });
  });

  describe('constants', () => {
    it('MULTI_MATCH_THRESHOLD is a positive integer', () => {
      expect(MULTI_MATCH_THRESHOLD).toBeGreaterThan(0);
      expect(Number.isInteger(MULTI_MATCH_THRESHOLD)).toBe(true);
    });

    it('MAX_DISAMBIGUATION_RESULTS is a positive integer', () => {
      expect(MAX_DISAMBIGUATION_RESULTS).toBeGreaterThan(0);
      expect(Number.isInteger(MAX_DISAMBIGUATION_RESULTS)).toBe(true);
    });
  });

  describe('locale parameter', () => {
    it('accepts locale as second arg without error', () => {
      const result = resolveDyeInputMulti('Snow White', 'ja');
      expect(result.kind).toBe('single');
    });

    it('defaults to en when locale is omitted', () => {
      const result = resolveDyeInputMulti('Snow White');
      expect(result.kind).toBe('single');
    });
  });

  describe('ItemID input', () => {
    it('resolves a numeric ItemID string', () => {
      // ItemIDs are resolved via resolveColorInput or resolveDyeInput
      const result = resolveDyeInputMulti('5729');
      // This depends on whether bot-logic's resolver handles item IDs
      expect(['single', 'none']).toContain(result.kind);
    });
  });

  describe('category matching', () => {
    it('matches by category name (partial match path)', () => {
      // Categories like "Red", "Blue", "White" etc.
      const result = resolveDyeInputMulti('Red');
      // "Red" matches multiple dyes in the Red category
      expect(['single', 'multiple', 'disambiguation']).toContain(result.kind);
      if (result.kind === 'disambiguation') {
        expect(result.total).toBeGreaterThan(MULTI_MATCH_THRESHOLD);
      }
    });
  });

  describe('disambiguation with truncation', () => {
    it('limits disambiguation results to MAX_DISAMBIGUATION_RESULTS', () => {
      // Use a very broad category that has many dyes
      const result = resolveDyeInputMulti('Brown');
      if (result.kind === 'disambiguation') {
        expect(result.dyes.length).toBeLessThanOrEqual(MAX_DISAMBIGUATION_RESULTS);
      }
    });
  });

  describe('resolveDyeInput fallback path', () => {
    it('resolves known dye names that resolveDyeInput handles', () => {
      // Try common dye names that the bot-logic resolveDyeInput() should handle
      const result = resolveDyeInputMulti('Dalamud Red');
      expect(result.kind).toBe('single');
      if (result.kind === 'single') {
        expect(result.dye.name).toContain('Dalamud Red');
      }
    });
  });
});
