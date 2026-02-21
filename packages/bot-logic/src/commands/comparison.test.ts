/**
 * Comparison Command — Unit Tests
 *
 * Tests for executeComparison — side-by-side dye comparison grid.
 */

import { describe, it, expect } from 'vitest';
import { executeComparison } from './comparison.js';
import { dyeService } from '../input-resolution.js';

const snowWhite = dyeService.searchByName('Snow White')[0];
const sootBlack = dyeService.searchByName('Soot Black')[0];
const dalamudRed = dyeService.searchByName('Dalamud Red')[0];
const royalBlue = dyeService.searchByName('Royal Blue')[0];

// ============================================================================
// executeComparison
// ============================================================================

describe('executeComparison', () => {
  it('generates comparison for 2 dyes', async () => {
    const result = await executeComparison({
      dyes: [snowWhite, sootBlack],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('<svg');
    expect(result.dyes).toHaveLength(2);
    expect(result.embed.title).toContain('2');
  });

  it('generates comparison for 3 dyes', async () => {
    const result = await executeComparison({
      dyes: [snowWhite, sootBlack, dalamudRed],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('<svg');
    expect(result.dyes).toHaveLength(3);
  });

  it('generates comparison for 4 dyes', async () => {
    const result = await executeComparison({
      dyes: [snowWhite, sootBlack, dalamudRed, royalBlue],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('<svg');
    expect(result.dyes).toHaveLength(4);
  });

  it('sets embed color from first dye', async () => {
    const result = await executeComparison({
      dyes: [dalamudRed, snowWhite],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedColor = parseInt(dalamudRed.hex.replace('#', ''), 16);
    expect(result.embed.color).toBe(expectedColor);
  });

  it('embed description lists all dyes', async () => {
    const result = await executeComparison({
      dyes: [snowWhite, sootBlack],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.description).toContain('**1.**');
    expect(result.embed.description).toContain('**2.**');
  });

  it('includes footer in embed', async () => {
    const result = await executeComparison({
      dyes: [snowWhite, sootBlack],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.footer).toBeDefined();
  });

  it('works with Japanese locale', async () => {
    const result = await executeComparison({
      dyes: [snowWhite, sootBlack],
      locale: 'ja',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('<svg');
  });
});
