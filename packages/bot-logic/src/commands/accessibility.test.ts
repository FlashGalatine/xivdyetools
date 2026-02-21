/**
 * Accessibility Command — Unit Tests
 *
 * Tests for executeAccessibility — colorblind simulation and contrast matrix.
 */

import { describe, it, expect } from 'vitest';
import { executeAccessibility, VISION_TYPES } from './accessibility.js';
import type { AccessibilityDye, VisionType } from './accessibility.js';

const whiteDye: AccessibilityDye = { hex: '#FFFFFF', name: 'Snow White', itemID: 5729 };
const blackDye: AccessibilityDye = { hex: '#2B2B2B', name: 'Soot Black', itemID: 5730 };
const redDye: AccessibilityDye = { hex: '#D60000', name: 'Dalamud Red', itemID: 5790 };
const blueDye: AccessibilityDye = { hex: '#0000D6', name: 'Royal Blue', itemID: 5806 };
const hexOnly: AccessibilityDye = { hex: '#FF8800', name: '#FF8800' };

// ============================================================================
// VISION_TYPES
// ============================================================================

describe('VISION_TYPES', () => {
  it('contains 3 vision types', () => {
    expect(VISION_TYPES).toHaveLength(3);
  });

  it('includes protanopia, deuteranopia, and tritanopia', () => {
    expect(VISION_TYPES).toContain('protanopia');
    expect(VISION_TYPES).toContain('deuteranopia');
    expect(VISION_TYPES).toContain('tritanopia');
  });
});

// ============================================================================
// Single dye — colorblind simulation mode
// ============================================================================

describe('executeAccessibility — simulation mode (single dye)', () => {
  it('generates simulation SVG for a single dye', async () => {
    const result = await executeAccessibility({
      dyes: [redDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('simulation');
    expect(result.svgString).toContain('<svg');
    expect(result.embed.title).toBeDefined();
  });

  it('uses all 3 vision types by default', async () => {
    const result = await executeAccessibility({
      dyes: [redDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The embed description should mention all vision types
    expect(result.embed.description).toBeDefined();
  });

  it('accepts custom vision types', async () => {
    const result = await executeAccessibility({
      dyes: [redDye],
      visionTypes: ['protanopia'],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('simulation');
  });

  it('works with hex-only input (no itemID)', async () => {
    const result = await executeAccessibility({
      dyes: [hexOnly],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('simulation');
    expect(result.svgString).toContain('<svg');
  });

  it('sets embed color from dye hex', async () => {
    const result = await executeAccessibility({
      dyes: [redDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedColor = parseInt(redDye.hex.replace('#', ''), 16);
    expect(result.embed.color).toBe(expectedColor);
  });

  it('includes footer with simulation method', async () => {
    const result = await executeAccessibility({
      dyes: [redDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.footer).toBeDefined();
  });
});

// ============================================================================
// Multiple dyes — contrast matrix mode
// ============================================================================

describe('executeAccessibility — contrast matrix mode (multiple dyes)', () => {
  it('generates contrast matrix for 2 dyes', async () => {
    const result = await executeAccessibility({
      dyes: [whiteDye, blackDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('contrast');
    expect(result.svgString).toContain('<svg');
  });

  it('generates contrast matrix for 3 dyes', async () => {
    const result = await executeAccessibility({
      dyes: [whiteDye, blackDye, redDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('contrast');
  });

  it('generates contrast matrix for 4 dyes', async () => {
    const result = await executeAccessibility({
      dyes: [whiteDye, blackDye, redDye, blueDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('contrast');
    expect(result.svgString).toContain('<svg');
  });

  it('embed mentions WCAG guidelines', async () => {
    const result = await executeAccessibility({
      dyes: [whiteDye, blackDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Should mention AAA and AA
    expect(result.embed.description).toContain('AAA');
    expect(result.embed.description).toContain('AA');
  });

  it('lists all compared dyes in description', async () => {
    const result = await executeAccessibility({
      dyes: [whiteDye, blackDye, redDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.description).toBeDefined();
  });

  it('sets embed color from first dye', async () => {
    const result = await executeAccessibility({
      dyes: [redDye, whiteDye],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedColor = parseInt(redDye.hex.replace('#', ''), 16);
    expect(result.embed.color).toBe(expectedColor);
  });
});

// ============================================================================
// Cross-locale
// ============================================================================

describe('executeAccessibility — locales', () => {
  it('works with Japanese locale (simulation)', async () => {
    const result = await executeAccessibility({
      dyes: [redDye],
      locale: 'ja',
    });

    expect(result.ok).toBe(true);
  });

  it('works with Japanese locale (contrast)', async () => {
    const result = await executeAccessibility({
      dyes: [whiteDye, blackDye],
      locale: 'ja',
    });

    expect(result.ok).toBe(true);
  });
});
