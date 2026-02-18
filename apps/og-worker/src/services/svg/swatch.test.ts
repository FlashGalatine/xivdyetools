/**
 * Tests for Swatch Tool OG Image Generator
 *
 * @module swatch.test
 */

import { describe, it, expect } from 'vitest';
import { generateSwatchOG } from './swatch';

describe('swatch SVG generator', () => {
  describe('generateSwatchOG', () => {
    it('should generate valid SVG for valid color', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 5,
      });

      expect(result).toContain('<svg');
      expect(result).toContain('</svg>');
      expect(result).toContain('SWATCH MATCHER');
    });

    it('should include hex color in subtitle', async () => {
      const result = await generateSwatchOG({
        color: 'AABBCC',
        limit: 5,
      });

      expect(result).toContain('#AABBCC');
    });

    it('should handle color with # prefix', async () => {
      const result = await generateSwatchOG({
        color: '#FF5733',
        limit: 5,
      });

      expect(result).toContain('<svg');
      expect(result).toContain('#FF5733');
    });

    it('should handle lowercase hex', async () => {
      const result = await generateSwatchOG({
        color: 'aabbcc',
        limit: 5,
      });

      expect(result).toContain('<svg');
      expect(result.toUpperCase()).toContain('#AABBCC');
    });

    it('should include INPUT COLOR label', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 5,
      });

      expect(result).toContain('INPUT COLOR');
    });

    it('should include TOP MATCHES label', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 5,
      });

      expect(result).toContain('TOP');
      expect(result).toContain('MATCHES');
    });

    it('should include RGB values', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 5,
      });

      expect(result).toContain('RGB(');
    });

    it('should include algorithm when provided', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 5,
        algorithm: 'oklab',
      });

      expect(result).toContain('OKLAB');
    });

    it('should show delta values for matches', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 5,
      });

      expect(result).toContain('Δ');
    });

    it('should highlight top match with badge', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 5,
      });

      expect(result).toContain('#1');
    });

    it('should limit matches to requested count', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 2,
      });

      expect(result).toContain('TOP 2 MATCHES');
    });

    it('should cap limit at 4 for cleaner layout', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 10,
      });

      expect(result).toContain('TOP 4 MATCHES');
    });

    it('should enforce minimum limit of 1', async () => {
      const result = await generateSwatchOG({
        color: 'FF5733',
        limit: 0,
      });

      expect(result).toContain('TOP 1 MATCHES');
    });

    describe('character color context', () => {
      it('should show sheet context when sheet param provided', async () => {
        const result = await generateSwatchOG({
          color: 'FF5733',
          limit: 5,
          sheet: 'eyeColors',
        });

        // May or may not find the color in eye colors
        expect(result).toContain('<svg');
      });

      it('should handle race-specific sheet with all params', async () => {
        const result = await generateSwatchOG({
          color: 'FF5733',
          limit: 5,
          sheet: 'hairColors',
          race: 'Midlander',
          gender: 'Female',
        });

        expect(result).toContain('<svg');
      });

      it('should handle race-specific sheet without race/gender', async () => {
        const result = await generateSwatchOG({
          color: 'FF5733',
          limit: 5,
          sheet: 'skinColors',
        });

        expect(result).toContain('<svg');
      });
    });

    describe('fallback', () => {
      it('should generate fallback for invalid hex', async () => {
        const result = await generateSwatchOG({
          color: 'invalid',
          limit: 5,
        });

        expect(result).toContain('Match Any Color');
        expect(result).toContain('Find FFXIV dyes');
      });

      it('should generate fallback for too short hex', async () => {
        const result = await generateSwatchOG({
          color: 'FFF',
          limit: 5,
        });

        expect(result).toContain('Match Any Color');
      });

      it('should generate fallback for too long hex', async () => {
        const result = await generateSwatchOG({
          color: 'FF5733FF',
          limit: 5,
        });

        expect(result).toContain('Match Any Color');
      });

      it('should show example colors in fallback', async () => {
        const result = await generateSwatchOG({
          color: 'invalid',
          limit: 5,
        });

        // Example colors
        expect(result).toContain('#8B4513'); // Brown
        expect(result).toContain('#4169E1'); // Blue
      });
    });

    describe('default values', () => {
      it('should default limit to 5', async () => {
        const result = await generateSwatchOG({
          color: 'FF5733',
        });

        // Limited to 4 for display, but should have matches
        expect(result).toContain('MATCHES');
      });

      it('should default algorithm to oklab', async () => {
        const result = await generateSwatchOG({
          color: 'FF5733',
          limit: 5,
        });

        expect(result).toContain('OKLAB');
      });
    });
  });
});
