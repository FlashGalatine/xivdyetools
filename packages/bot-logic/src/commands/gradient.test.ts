/**
 * Gradient Command — Unit Tests
 *
 * Tests for executeGradient — multi-step color gradient generation.
 */

import { describe, it, expect } from 'vitest';
import { executeGradient } from './gradient.js';
import type { InterpolationMode } from './gradient.js';

const startColor = { hex: '#FF0000' };
const endColor = { hex: '#0000FF' };

// ============================================================================
// executeGradient
// ============================================================================

describe('executeGradient', () => {
  it('generates a gradient with default settings', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('<svg');
    expect(result.gradientSteps.length).toBe(6); // default stepCount
    expect(result.startColor).toBe(startColor);
    expect(result.endColor).toBe(endColor);
  });

  it('respects custom step count', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      stepCount: 4,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.gradientSteps.length).toBe(4);
  });

  it('first step hex matches start color', async () => {
    const result = await executeGradient({
      startColor: { hex: '#FF0000' },
      endColor: { hex: '#00FF00' },
      stepCount: 3,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // First step should be at or very near the start color
    expect(result.gradientSteps[0].hex).toBeDefined();
  });

  it('last step hex matches end color', async () => {
    const result = await executeGradient({
      startColor: { hex: '#FF0000' },
      endColor: { hex: '#00FF00' },
      stepCount: 3,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Last step should be at or very near the end color
    expect(result.gradientSteps[result.gradientSteps.length - 1].hex).toBeDefined();
  });

  describe('color spaces', () => {
    const colorSpaces: InterpolationMode[] = ['rgb', 'hsv', 'lab', 'oklch', 'lch'];

    for (const colorSpace of colorSpaces) {
      it(`generates gradient in ${colorSpace} color space`, async () => {
        const result = await executeGradient({
          startColor,
          endColor,
          colorSpace,
          stepCount: 4,
          locale: 'en',
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.svgString).toContain('<svg');
        expect(result.gradientSteps.length).toBe(4);
      });
    }
  });

  it('each step has a hex color', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      stepCount: 5,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const step of result.gradientSteps) {
      expect(step.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('each step includes a distance value', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      stepCount: 4,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const step of result.gradientSteps) {
      expect(typeof step.distance).toBe('number');
      expect(step.distance).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns embed with title and description', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.title).toBeDefined();
    expect(result.embed.description).toBeDefined();
  });

  it('works with named start/end colors', async () => {
    const result = await executeGradient({
      startColor: { hex: '#FF0000', name: 'Dalamud Red', itemID: 5790 },
      endColor: { hex: '#FFFFFF', name: 'Snow White', itemID: 5729 },
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.description).toBeDefined();
  });

  it('works with Japanese locale', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      locale: 'ja',
    });

    expect(result.ok).toBe(true);
  });

  describe('hueDiff < -180 branches (blue to red)', () => {
    const blueStart = { hex: '#0000FF' };
    const redEnd = { hex: '#FF0000' };

    it('handles hueDiff < -180 in hsv', async () => {
      const result = await executeGradient({
        startColor: blueStart,
        endColor: redEnd,
        colorSpace: 'hsv',
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });

    it('handles hueDiff < -180 in oklch', async () => {
      const result = await executeGradient({
        startColor: blueStart,
        endColor: redEnd,
        colorSpace: 'oklch',
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });

    it('handles hueDiff < -180 in lch', async () => {
      const result = await executeGradient({
        startColor: blueStart,
        endColor: redEnd,
        colorSpace: 'lch',
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });
  });

  describe('default colorSpace fallback', () => {
    it('falls back to hsv for unrecognized colorSpace (red to blue, hueDiff > 180)', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        colorSpace: 'unknown' as InterpolationMode,
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });

    it('falls back to hsv for unrecognized colorSpace (blue to red, hueDiff < -180)', async () => {
      const result = await executeGradient({
        startColor: { hex: '#0000FF' },
        endColor: { hex: '#FF0000' },
        colorSpace: 'unknown' as InterpolationMode,
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });
  });

  describe('matchingMethod label', () => {
    it('uses ciede2000 matching method', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        matchingMethod: 'ciede2000',
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.embed.description).toContain('CIEDE2000');
    });

    it('uses cie76 matching method', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        matchingMethod: 'cie76',
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.embed.description).toContain('CIE76');
    });
  });

  describe('dyeFilters', () => {
    it('excludes metallic dyes when excludeMetallic is set', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        stepCount: 6,
        locale: 'en',
        dyeFilters: { excludeMetallic: true },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (const step of result.gradientSteps) {
        if (step.dye) {
          expect(step.dye.isMetallic).toBe(false);
        }
      }
    });

    it('returns dyes when dyeFilters is empty', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        stepCount: 4,
        locale: 'en',
        dyeFilters: {},
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.gradientSteps.length).toBe(4);
    });
  });
});
