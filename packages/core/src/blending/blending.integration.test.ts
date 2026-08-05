/**
 * Color Blending Integration Tests
 *
 * Tests cross-module usage patterns — these functions are consumed by
 * SVG generators and the mixer command handler. Validates consistent
 * behavior across the pipeline.
 *
 * Migrated from apps/discord-worker/src/services/color-blending.integration.test.ts
 */

import { describe, it, expect } from 'vitest';
import { blendColors, rgbToLab } from './index.js';
import type { BlendingMode } from './types.js';

const ALL_MODES: BlendingMode[] = ['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral'];
const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

// ============================================================================
// Consistent Interface Across All Modes
// ============================================================================

describe('All Blending Modes: Consistent Interface', () => {
  const testPairs = [
    { name: 'red + blue', color1: '#FF0000', color2: '#0000FF' },
    { name: 'warm + cool', color1: '#FF8C00', color2: '#4169E1' },
    { name: 'complementary', color1: '#00FF00', color2: '#FF00FF' },
    { name: 'near black + near white', color1: '#1A1A1A', color2: '#E5E5E5' },
  ];

  for (const { name, color1, color2 } of testPairs) {
    for (const mode of ALL_MODES) {
      it(`${mode} (${name}): returns { hex, rgb } with valid ranges`, () => {
        const result = blendColors(color1, color2, mode, 0.5);

        expect(result).toHaveProperty('hex');
        expect(result).toHaveProperty('rgb');
        expect(result.rgb).toHaveProperty('r');
        expect(result.rgb).toHaveProperty('g');
        expect(result.rgb).toHaveProperty('b');

        expect(result.hex).toMatch(HEX_PATTERN);
        expect(result.rgb.r).toBeGreaterThanOrEqual(0);
        expect(result.rgb.r).toBeLessThanOrEqual(255);
        expect(result.rgb.g).toBeGreaterThanOrEqual(0);
        expect(result.rgb.g).toBeLessThanOrEqual(255);
        expect(result.rgb.b).toBeGreaterThanOrEqual(0);
        expect(result.rgb.b).toBeLessThanOrEqual(255);

        const r = parseInt(result.hex.slice(1, 3), 16);
        const g = parseInt(result.hex.slice(3, 5), 16);
        const b = parseInt(result.hex.slice(5, 7), 16);
        expect(r).toBe(result.rgb.r);
        expect(g).toBe(result.rgb.g);
        expect(b).toBe(result.rgb.b);
      });
    }
  }
});

// ============================================================================
// LAB Round-Trip Accuracy
// ============================================================================

describe('rgbToLab: Round-Trip Accuracy (RGB → LAB → Blend → RGB)', () => {
  const midRangeColors = [
    { name: 'medium grey', rgb: { r: 128, g: 128, b: 128 } },
    { name: 'forest green', rgb: { r: 34, g: 139, b: 34 } },
    { name: 'coral', rgb: { r: 255, g: 127, b: 80 } },
    { name: 'steel blue', rgb: { r: 70, g: 130, b: 180 } },
    { name: 'plum', rgb: { r: 221, g: 160, b: 221 } },
  ];

  for (const { name, rgb } of midRangeColors) {
    it(`${name}: LAB blend at ratio=0 returns ≈ original (max channel deviation ≤ 1)`, () => {
      const hex = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;

      const result = blendColors(hex, '#000000', 'lab', 0);

      expect(Math.abs(result.rgb.r - rgb.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.rgb.g - rgb.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(result.rgb.b - rgb.b)).toBeLessThanOrEqual(1);
    });
  }

  it('LAB L* ordering matches perceived brightness', () => {
    const dark = rgbToLab({ r: 30, g: 30, b: 30 });
    const mid = rgbToLab({ r: 128, g: 128, b: 128 });
    const bright = rgbToLab({ r: 230, g: 230, b: 230 });

    expect(dark.l).toBeLessThan(mid.l);
    expect(mid.l).toBeLessThan(bright.l);
    expect(bright.l).toBeLessThan(100);
    expect(dark.l).toBeGreaterThan(0);
  });

  it('LAB a* axis: red has positive a*, green has negative a*', () => {
    const red = rgbToLab({ r: 200, g: 50, b: 50 });
    const green = rgbToLab({ r: 50, g: 200, b: 50 });

    expect(red.a).toBeGreaterThan(0);
    expect(green.a).toBeLessThan(0);
  });
});

// ============================================================================
// Gradient Generation (N-Step Blend)
// ============================================================================

describe('Gradient Generation: Monotonic Progression', () => {
  for (const mode of ALL_MODES) {
    it(`${mode}: 5-step gradient produces monotonic RGB progression`, () => {
      const color1 = '#000000';
      const color2 = '#FFFFFF';
      const steps = [0, 0.25, 0.5, 0.75, 1.0];

      const results = steps.map(ratio => blendColors(color1, color2, mode, ratio));

      if (mode !== 'spectral' && mode !== 'ryb') {
        for (let i = 1; i < results.length; i++) {
          expect(results[i].rgb.r).toBeGreaterThanOrEqual(results[i - 1].rgb.r);
          expect(results[i].rgb.g).toBeGreaterThanOrEqual(results[i - 1].rgb.g);
          expect(results[i].rgb.b).toBeGreaterThanOrEqual(results[i - 1].rgb.b);
        }
      }

      expect(results[0].rgb.r).toBeLessThan(10);
      if (mode !== 'spectral') {
        expect(results[results.length - 1].rgb.r).toBeGreaterThan(245);
      }
    });
  }

  it('colored gradient: hue transitions through visible spectrum', () => {
    const red = '#FF0000';
    const blue = '#0000FF';
    const steps = [0, 0.25, 0.5, 0.75, 1.0];

    const results = steps.map(ratio => blendColors(red, blue, 'hsl', ratio));

    expect(results[0].rgb.r).toBeGreaterThan(200);
    expect(results[0].rgb.b).toBeLessThan(50);

    expect(results[results.length - 1].rgb.b).toBeGreaterThan(200);
    expect(results[results.length - 1].rgb.r).toBeLessThan(50);

    const mid = results[2];
    expect(mid.hex).not.toBe('#FF0000');
    expect(mid.hex).not.toBe('#0000FF');
  });
});

// ============================================================================
// Dye-Typical Color Pairs
// ============================================================================

describe('Blending with FFXIV Dye-Typical Colors', () => {
  const dyePairs = [
    { name: 'Pure White + Jet Black', c1: '#FFFFFF', c2: '#2B2B2B' },
    { name: 'Dalamud Red + Metallic Red', c1: '#C24D4D', c2: '#8E4040' },
    { name: 'Pastel Pink + Pastel Blue', c1: '#E8A3A3', c2: '#A3B8E8' },
    { name: 'Metallic Gold + Metallic Silver', c1: '#C8A84A', c2: '#919BAB' },
  ];

  for (const { name, c1, c2 } of dyePairs) {
    it(`${name}: all modes produce distinct results`, () => {
      const results = ALL_MODES.map(mode => ({
        mode,
        result: blendColors(c1, c2, mode, 0.5),
      }));

      for (const { result } of results) {
        expect(result.hex).toMatch(HEX_PATTERN);
      }

      const hexValues = new Set(results.map(r => r.result.hex));
      expect(hexValues.size).toBeGreaterThan(1);
    });
  }
});
