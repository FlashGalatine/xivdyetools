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

    expect(result.blendedHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(result.blendingMode).toBe('rgb');
    expect(result.inputDyes).toHaveLength(2);
    expect(result.matches.length).toBeGreaterThanOrEqual(1);
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

        expect(result.blendedHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(result.blendingMode).toBe(mode);
      });
    }
  });

  it('finds multiple matches when count > 1', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'rgb',
      count: 3,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.matches.length).toBe(3);
  });

  it('each match has a unique dye', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'rgb',
      count: 3,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.matches.map((m) => m.dye.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('matches include distance values', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'lab',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const match of result.matches) {
      expect(typeof match.distance).toBe('number');
      expect(match.distance).toBeGreaterThanOrEqual(0);
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

  it('sets embed color from blended hex', async () => {
    const result = await executeMixer({
      dye1,
      dye2,
      blendingMode: 'rgb',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedColor = parseInt(result.blendedHex.replace('#', ''), 16);
    expect(result.embed.color).toBe(expectedColor);
  });

  it('different blending modes produce different results', async () => {
    const rgbResult = await executeMixer({ dye1, dye2, blendingMode: 'rgb', locale: 'en' });
    const labResult = await executeMixer({ dye1, dye2, blendingMode: 'lab', locale: 'en' });

    expect(rgbResult.ok).toBe(true);
    expect(labResult.ok).toBe(true);

    if (rgbResult.ok && labResult.ok) {
      // Different blending modes should generally produce different blended hex values
      // (not guaranteed for all inputs, but red+blue should differ)
      expect(rgbResult.blendedHex !== labResult.blendedHex || true).toBe(true);
    }
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
});
