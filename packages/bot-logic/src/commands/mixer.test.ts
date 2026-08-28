/**
 * Mixer Command — Unit Tests
 *
 * Tests for executeMixer — blending two colors and finding closest dyes.
 */

import { describe, it, expect } from 'vitest';
import { executeMixer } from './mixer.js';
import type { BlendingMode } from './mixer.js';

const dye1 = { hex: '#FF0000', name: 'Dalamud Red', itemID: 5790 };
const dye2 = { hex: '#0000FF', name: 'Royal Blue', itemID: 5806 };
const hexOnly1 = { hex: '#FF8800' };
const hexOnly2 = { hex: '#00FF88' };

// ============================================================================
// executeMixer
// ============================================================================

describe('executeMixer', () => {
  it('blends two named dyes with rgb mode', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'rgb',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.blendingMode).toBe('rgb');
    expect(result.sweep.length).toBeGreaterThanOrEqual(1);
    expect(result.embed.title).toBeDefined();
  });

  describe('blending modes', () => {
    const modes: BlendingMode[] = ['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral'];

    for (const mode of modes) {
      it(`blends using ${mode} mode`, async () => {
        const result = await executeMixer({
          dye1: hexOnly1,
          dye2: hexOnly2,
          blendingMode: mode,
          locale: 'en',
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        for (const stop of result.sweep) {
          expect(stop.blendHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
        }
        expect(result.blendingMode).toBe(mode);
      });
    }
  });

  it('sweep stops each have a distinct ratio', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'rgb',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const pcts = result.sweep.map((s) => s.pct);
    expect(new Set(pcts).size).toBe(pcts.length);
  });

  it('sweep stops include ΔE2000 distance values', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'lab',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const stop of result.sweep) {
      expect(typeof stop.deltaE).toBe('number');
      expect(stop.deltaE).toBeGreaterThanOrEqual(0);
    }
  });

  it('works with hex-only inputs (no dye name)', async () => {
    const result = await executeMixer({
      dye1: hexOnly1,
      dye2: hexOnly2,
      blendingMode: 'rgb',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.description).toBeDefined();
  });

  it('embed includes blending mode information', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'oklab',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.description).toBeDefined();
  });

  it('sets embed color from the sweep best stop and renders the 12F card', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'rgb',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const best = result.sweep.find((s) => s.best);
    expect(best).toBeDefined();
    expect(result.embed.color).toBe(parseInt(best!.dye.hex.replace('#', ''), 16));
    expect(result.svgString).toContain('/MIXER');
    expect(result.sweep).toHaveLength(5);
  });

  it('different blending modes produce different sweep results', async () => {
    const rgbResult = await executeMixer({ dye1, dye2, blendingMode: 'rgb', locale: 'en' });
    const labResult = await executeMixer({ dye1, dye2, blendingMode: 'lab', locale: 'en' });

    expect(rgbResult.ok).toBe(true);
    expect(labResult.ok).toBe(true);
    if (!rgbResult.ok || !labResult.ok) return;

    // red + blue should land on a different blended hex per ratio for rgb vs lab
    const rgbHexes = rgbResult.sweep.map((s) => s.blendHex);
    const labHexes = labResult.sweep.map((s) => s.blendHex);
    expect(rgbHexes).not.toEqual(labHexes);
  });

  it('works with Japanese locale', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'rgb',
      locale: 'ja',
    });

    expect(result.ok).toBe(true);
  });

  describe('dyeFilters', () => {
    it('excludes metallic dyes when excludeMetallic is set', async () => {
      const result = await executeMixer({
        dye1,
        dye2,
        blendingMode: 'rgb',
        locale: 'en',
        dyeFilters: { excludeMetallic: true },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (const stop of result.sweep) {
        expect(stop.dye.isMetallic).toBe(false);
      }
    });

    it('returns a sweep when dyeFilters is empty', async () => {
      const result = await executeMixer({
        dye1,
        dye2,
        blendingMode: 'rgb',
        locale: 'en',
        dyeFilters: {},
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.sweep.length).toBeGreaterThanOrEqual(1);
    });
  });
});
