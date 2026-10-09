/**
 * Tests for dye-resolver.ts
 *
 * Covers resolveDyeInputMulti() for all 4 result kinds against the REAL dye
 * database: single, multiple, disambiguation, none.
 *
 * BUG-071: every kind is asserted exactly -- no "any of the three kinds"
 * fallback and no `if (result.kind === ...)` guard that lets a wrong kind
 * pass. A throw on the wrong kind keeps the narrowing without the escape hatch.
 */

import { describe, it, expect } from 'vitest';
import {
  resolveDyeInputMulti,
  MULTI_MATCH_THRESHOLD,
  MAX_DISAMBIGUATION_RESULTS,
  type DyeResolutionResult,
} from './dye-resolver.js';

type Kind = DyeResolutionResult['kind'];

/** Resolve and assert the exact kind; returns the narrowed result. */
async function resolveAs<K extends Kind>(
  kind: K,
  input: string,
  locale?: Parameters<typeof resolveDyeInputMulti>[1],
): Promise<Extract<DyeResolutionResult, { kind: K }>> {
  const result = await resolveDyeInputMulti(input, locale);
  if (result.kind !== kind) {
    throw new Error(`"${input}" expected kind=${kind}, got ${result.kind}`);
  }
  return result as Extract<DyeResolutionResult, { kind: K }>;
}

describe('resolveDyeInputMulti', () => {
  describe('empty / blank input', () => {
    it('returns kind=none for empty string', async () => {
      const result = await resolveAs('none', '');
      expect(result.query).toBe('');
      expect(result.suggestions).toEqual([]);
    });

    it('returns kind=none for whitespace-only input', async () => {
      await resolveAs('none', '   ');
    });
  });

  describe('exact color input (hex code)', () => {
    it('resolves a hex code to a single dye', async () => {
      const result = await resolveAs('single', '#FFFFFF');
      expect(result.dye.dye).toBeDefined();
      expect(result.dye.hex).toBe('#FFFFFF');
    });

    it('resolves a 3-digit hex code', async () => {
      const result = await resolveAs('single', '#FFF');
      expect(result.dye.dye?.name).toBe('Pure White');
    });
  });

  describe('exact dye name input', () => {
    it('resolves an exact dye name to a single result', async () => {
      const result = await resolveAs('single', 'Snow White');
      expect(result.dye.name).toBe('Snow White');
      expect(result.dye.dye).toBeDefined();
    });

    it('resolves "Jet Black"', async () => {
      const result = await resolveAs('single', 'Jet Black');
      expect(result.dye.name).toBe('Jet Black');
    });

    it('exact name beats substring: "Dalamud Red" is single', async () => {
      const result = await resolveAs('single', 'Dalamud Red');
      expect(result.dye.name).toBe('Dalamud Red');
    });

    it('exact name is case-insensitive', async () => {
      const result = await resolveAs('single', 'snow white');
      expect(result.dye.name).toBe('Snow White');
    });
  });

  describe('partial match — single result', () => {
    it('returns kind=single for a unique partial match', async () => {
      const result = await resolveAs('single', 'Jet');
      expect(result.dye.name).toBe('Jet Black');
      expect(result.dye.dye).toBeDefined();
      expect(result.dye.hex).toBeDefined();
      expect(result.dye.id).toBeDefined();
      expect(result.dye.itemID).toBeDefined();
    });

    it('"Coral" matches only Coral Pink', async () => {
      const result = await resolveAs('single', 'Coral');
      expect(result.dye.name).toBe('Coral Pink');
    });
  });

  // BUG-073: step 1 used to take the first substring hit, so none of the
  // multiple / disambiguation branches below were reachable for a name query.
  describe('partial match — multiple results (2-4 matches)', () => {
    it('"white" is multiple with exactly the four White-named dyes', async () => {
      const result = await resolveAs('multiple', 'white');
      expect(result.query).toBe('white');
      expect(result.dyes.map((d) => d.name).sort()).toEqual([
        'Bone White',
        'Pearl White',
        'Pure White',
        'Snow White',
      ]);
      expect(result.dyes.length).toBeLessThanOrEqual(MULTI_MATCH_THRESHOLD);
      for (const dye of result.dyes) {
        expect(dye.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(dye.dye).toBeDefined();
      }
    });
  });

  describe('partial match — disambiguation (many results)', () => {
    it('"Blue": 25 hits, list capped at the maximum', async () => {
      const result = await resolveAs('disambiguation', 'Blue');
      expect(result.total).toBe(25);
      expect(result.dyes).toHaveLength(MAX_DISAMBIGUATION_RESULTS);
      expect(result.query).toBe('Blue');
    });

    it('"Brown" lists the capped set with a larger total', async () => {
      const result = await resolveAs('disambiguation', 'Brown');
      expect(result.total).toBeGreaterThan(MAX_DISAMBIGUATION_RESULTS);
      expect(result.dyes).toHaveLength(MAX_DISAMBIGUATION_RESULTS);
    });

    it('"Red" counts names plus the Reds category', async () => {
      const result = await resolveAs('disambiguation', 'Red');
      expect(result.total).toBe(17);
    });

    it('a category-only query ("neutral") lists its dyes', async () => {
      const result = await resolveAs('disambiguation', 'neutral');
      expect(result.total).toBe(6);
      expect(result.dyes).toHaveLength(6);
    });
  });

  describe('CSS color name fallback', () => {
    it('"BlueViolet" resolves to a single closest dye', async () => {
      const result = await resolveAs('single', 'BlueViolet');
      expect(result.dye.dye).toBeDefined();
    });
  });

  describe('no match', () => {
    it('returns kind=none for gibberish, with no suggestions', async () => {
      const result = await resolveAs('none', 'xyzzyplugh12345');
      expect(result.query).toBe('xyzzyplugh12345');
      expect(result.suggestions).toEqual([]);
    });

    it('suggests the real dye for a near-miss typo', async () => {
      const result = await resolveAs('none', 'Jet Blak');
      expect(result.suggestions[0]).toBe('Jet Black');
    });
  });

  describe('constants', () => {
    it('MULTI_MATCH_THRESHOLD is 4 and the cap is above it', () => {
      expect(MULTI_MATCH_THRESHOLD).toBe(4);
      expect(MAX_DISAMBIGUATION_RESULTS).toBeGreaterThan(MULTI_MATCH_THRESHOLD);
    });
  });

  // BUG-072: the locale is honored, not ignored.
  describe('locale parameter', () => {
    it('matches an exact Japanese name when the locale is ja', async () => {
      const result = await resolveAs('single', 'スノウホワイト', 'ja');
      expect(result.dye.name).toBe('Snow White');
    });

    it('matches a German name when the locale is de', async () => {
      const result = await resolveAs('single', 'Schneeweiß', 'de');
      expect(result.dye.name).toBe('Snow White');
    });

    it('does not match a Japanese name under the default (en) locale', async () => {
      await resolveAs('none', 'スノウホワイト');
    });

    // Partial localized queries bypass the exact-name step, so these are what
    // pin `locale` on the substring lookup. (The color-name lookup runs only when
    // the substring step found nothing, so its `locale` cannot be pinned.)
    it('matches a partial Japanese name (substring step) when the locale is ja', async () => {
      const result = await resolveAs('single', 'スノウ', 'ja');
      expect(result.dye.name).toBe('Snow White');
    });

    it('a partial Japanese name that fits several dyes is multiple under ja', async () => {
      const result = await resolveAs('multiple', 'ホワイト', 'ja');
      expect(result.dyes.map((d) => d.name).sort()).toEqual([
        'Bone White',
        'Pearl White',
        'Pure White',
        'Snow White',
      ]);
    });

    it('a partial German name that fits several dyes is multiple under de', async () => {
      const result = await resolveAs('multiple', 'Weiß', 'de');
      expect(result.dyes.map((d) => d.name)).toContain('Snow White');
      expect(result.dyes.length).toBeGreaterThanOrEqual(2);
    });

    it('partial localized names find nothing under en', async () => {
      await resolveAs('none', 'スノウ');
      await resolveAs('none', 'ホワイト');
      await resolveAs('none', 'Schnee');
    });
  });

  describe('ItemID input', () => {
    it('resolves a legacy item id to that dye', async () => {
      const result = await resolveAs('single', '5729');
      expect(result.dye.name).toBe('Snow White');
    });

    it('resolves a bare stain id to that dye, not the hex shorthand', async () => {
      const result = await resolveAs('single', '101');
      expect(result.dye.name).toBe('Pure White');
    });
  });
});
