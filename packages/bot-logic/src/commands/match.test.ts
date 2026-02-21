/**
 * Match Command — Unit Tests
 *
 * Tests for executeMatch — finding closest FFXIV dye(s) to a color.
 */

import { describe, it, expect } from 'vitest';
import { executeMatch } from './match.js';

// ============================================================================
// executeMatch
// ============================================================================

describe('executeMatch', () => {
  describe('single match (default)', () => {
    it('finds closest dye for a hex color', async () => {
      const result = await executeMatch({ colorInput: '#FF0000', locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.targetHex).toBe('#FF0000');
      expect(result.matches).toHaveLength(1);
      expect(result.matches[0].dye).toBeDefined();
      expect(result.matches[0].distance).toBeGreaterThanOrEqual(0);
    });

    it('finds closest dye for a dye name input', async () => {
      const result = await executeMatch({ colorInput: 'Snow White', locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.fromDye).toBeDefined();
      expect(result.matches).toHaveLength(1);
    });

    it('returns embed with fields for single match', async () => {
      const result = await executeMatch({ colorInput: '#FF0000', locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.embed.fields).toBeDefined();
      expect(result.embed.fields!.length).toBe(3);
    });

    it('embed fields include input color, closest dye, and match quality', async () => {
      const result = await executeMatch({ colorInput: '#00FF00', locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const fieldNames = result.embed.fields!.map((f) => f.name);
      expect(fieldNames.some((n) => n.includes('🎨'))).toBe(true);
      expect(fieldNames.some((n) => n.includes('🧪'))).toBe(true);
      expect(fieldNames.some((n) => n.includes('📊'))).toBe(true);
    });
  });

  describe('multi match', () => {
    it('finds multiple closest dyes', async () => {
      const result = await executeMatch({ colorInput: '#FF0000', count: 3, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.matches.length).toBe(3);
    });

    it('matches are ordered by distance', async () => {
      const result = await executeMatch({ colorInput: '#0000FF', count: 5, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (let i = 1; i < result.matches.length; i++) {
        expect(result.matches[i].distance).toBeGreaterThanOrEqual(result.matches[i - 1].distance);
      }
    });

    it('returns embed with description for multi match', async () => {
      const result = await executeMatch({ colorInput: '#FF0000', count: 3, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.embed.description).toBeDefined();
      expect(result.embed.description).toContain('**1.**');
      expect(result.embed.description).toContain('**2.**');
      expect(result.embed.description).toContain('**3.**');
    });

    it('each match has a unique dye', async () => {
      const result = await executeMatch({ colorInput: '#FF8800', count: 5, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const ids = result.matches.map((m) => m.dye.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('clamps count to max 10', async () => {
      const result = await executeMatch({ colorInput: '#FFFFFF', count: 15, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.matches.length).toBeLessThanOrEqual(10);
    });

    it('clamps count to min 1', async () => {
      const result = await executeMatch({ colorInput: '#FFFFFF', count: 0, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('error handling', () => {
    it('returns error for unresolvable input', async () => {
      const result = await executeMatch({ colorInput: 'xyznotacolor123', locale: 'en' });

      expect(result.ok).toBe(false);
      if (result.ok) return;

      expect(result.error).toBe('INVALID_INPUT');
      expect(result.errorMessage).toBeDefined();
    });
  });

  describe('CSS color input', () => {
    it('resolves CSS-only color name and finds closest dye', async () => {
      // "crimson" is a CSS color that doesn't match any FFXIV dye name
      const result = await executeMatch({ colorInput: 'crimson', locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.targetHex).toBe('#DC143C');
      expect(result.matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Facewear exclusion', () => {
    it('excludes Facewear dyes from matches', async () => {
      const result = await executeMatch({ colorInput: '#FFFFFF', count: 10, locale: 'en' });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (const match of result.matches) {
        expect(match.dye.category).not.toBe('Facewear');
      }
    });
  });
});
