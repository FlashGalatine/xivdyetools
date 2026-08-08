/**
 * Tests for the /accessibility command (13D/13E/13H router).
 *
 * The vision: option chooses the frame — a named lens renders 13D,
 * vision:all (or absent) renders 13E, a single dye renders 13H.
 */

import { describe, it, expect } from 'vitest';
import { executeAccessibility, VISION_TYPES } from './accessibility.js';

const dalamud = { hex: '#781A1A', name: 'Dalamud Red', itemID: 5738 };
const hunter = { hex: '#284B2C', name: 'Hunter Green', itemID: 5748 };

describe('executeAccessibility — 13H solo (one dye)', () => {
  it('renders every lens for a single dye', async () => {
    const result = await executeAccessibility({ dyes: [dalamud], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('solo');
    expect(result.svgString).toContain('/ACCESSIBILITY');
    expect(result.svgString).toContain('Dalamud Red');
    // Every lens row + the SHIFT column
    expect(result.svgString).toContain('SHIFT');
    expect(result.svgString).toContain('Achromatopsia');
  });

  it('carries no tier colours — a shift is not a risk', async () => {
    const result = await executeAccessibility({ dyes: [dalamud], locale: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The far tier colour never appears in the solo frame
    expect(result.svgString).not.toContain('#f4645a');
  });

  it('works with hex-only input (no itemID)', async () => {
    const result = await executeAccessibility({
      dyes: [{ hex: '#336699', name: '#336699' }],
      locale: 'en',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('#336699');
  });
});

describe('executeAccessibility — 13E all lenses (pair)', () => {
  it('renders one row per lens including the normal control', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'all',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('all');
    expect(result.svgString).toContain('Normal Vision');
    expect(result.svgString).toContain('Achromatopsia');
    expect(result.svgString).toContain('SEPARATION');
    // The verdict sentence lives in the embed, not the frame
    expect(result.embed.description).toBeDefined();
    expect(result.embed.title).toContain('↔');
  });

  it('defaults a pair with no vision option to 13E', async () => {
    const result = await executeAccessibility({ dyes: [dalamud, hunter], locale: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mode).toBe('all');
  });

  it('names the weakest lens under the table', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'all',
      locale: 'en',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The red/green pair's only real failure is achromatopsia
    expect(result.svgString).toContain('weakest: Achromatopsia');
  });
});

describe('executeAccessibility — 13D named lens (pair)', () => {
  it('routes a named lens to the lens frame', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'protanopia',
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.mode).toBe('lens');
    expect(result.svgString).toContain('AS DESIGNED');
    expect(result.svgString).toContain('AS PERCEIVED');
    // The other lenses stay as the summary strip (untranslated codes)
    expect(result.svgString).toContain('DEUT');
    expect(result.svgString).toContain('ACHR');
  });

  it('prints the typed command in the chip (/a11y alias)', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'deuteranopia',
      locale: 'en',
      commandLabel: '/A11Y',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('/A11Y');
    expect(result.svgString).not.toContain('/ACCESSIBILITY');
  });
});

describe('VISION_TYPES', () => {
  it('achromatopsia is a full member, not a hidden flag', () => {
    expect(VISION_TYPES).toContain('achromatopsia');
    expect(VISION_TYPES).toHaveLength(4);
  });
});

describe('localization', () => {
  it('works with Japanese locale', async () => {
    const result = await executeAccessibility({
      dyes: [dalamud, hunter],
      vision: 'all',
      locale: 'ja',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('通常の視覚');
  });
});
