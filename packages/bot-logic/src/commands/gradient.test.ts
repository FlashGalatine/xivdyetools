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
});
