/**
 * Comparison Command — Unit Tests
 *
 * Tests for executeComparison — side-by-side dye comparison grid.
 */

import { describe, it, expect, vi } from 'vitest';
import { executeComparison, type ComparisonInput } from './comparison.js';
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

  it('keeps the embed to one line naming the closest pair', async () => {
    const result = await executeComparison({
      dyes: [snowWhite, sootBlack],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.description).toContain('↔');
  });

  it('renders the duel card for two dyes', async () => {
    const result = await executeComparison({
      dyes: [snowWhite, sootBlack],
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('/COMPARE');
    expect(result.svgString).toContain('ΔE2000');
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

// ============================================================================
// BUG-125 — fewer than two dyes, and the final catch
// ============================================================================

describe('executeComparison — fewer than two dyes (BUG-125)', () => {
  /**
   * One dye used to reach the duel renderer, which read `dyes[1].hex` and
   * threw a TypeError that came back as GENERATION_FAILED — a caller's
   * mistake reported as a render bug. It is refused up front now, in the
   * reader's language, before anything is drawn.
   */
  it.each([
    ['no dyes', []],
    ['one dye', [snowWhite]],
    // A JavaScript caller of the published package: refused, never thrown
    // across the boundary (the guard reads `dyes` before the try)
    ['undefined', undefined],
    ['null', null],
  ])('refuses %s with its own code and a localized message', async (_label, dyes) => {
    const warn = vi.fn();
    const result = await executeComparison({
      dyes: dyes as ComparisonInput['dyes'],
      locale: 'de',
      logger: { warn },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NOT_ENOUGH_DYES');
    expect(result.errorMessage).toBe('Beide Farbstoffe (dye1 und dye2) sind erforderlich.');
    // A refusal is an answer, not a failure — nothing is logged as one
    const lines = warn.mock.calls.flat().map(String);
    expect(lines.some((l) => l.includes('generation failed'))).toBe(false);
  });
});

describe('executeComparison — a generation failure is logged (BUG-125)', () => {
  it('logs the error class and leaves dye names and hexes out of the line', async () => {
    const warn = vi.fn();
    const broken = { ...sootBlack, hex: '#ZZZZZZ', name: 'Sentinel Dye Name', itemID: 0 };
    const result = await executeComparison({
      dyes: [snowWhite, broken],
      locale: 'en',
      logger: { warn },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('GENERATION_FAILED');

    const lines = warn.mock.calls.flat().map(String);
    expect(lines.some((l) => /^\[comparison\] generation failed: \w+/.test(l))).toBe(true);
    for (const line of lines) {
      expect(line).not.toContain('ZZZZZZ');
      expect(line).not.toContain('Sentinel Dye Name');
    }
  });
});
