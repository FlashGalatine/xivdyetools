/**
 * Comparison Command — Unit Tests
 *
 * Tests for executeComparison — side-by-side dye comparison grid.
 */

import { describe, it, expect, vi } from 'vitest';
import { executeComparison, type ComparisonInput } from './comparison.js';
import { executeContrast } from './contrast.js';
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

// ============================================================================
// BUG-142 — one printed ratio across /compare and /contrast
// ============================================================================

describe('the /compare RATIO readout prints what /contrast prints (BUG-142)', () => {
  /**
   * The duel's RATIO readout used to round (toFixed) while /contrast floors,
   * so the same pair read 3.00:1 on /compare and 2.99:1 "under 3:1" on
   * /contrast — about half of all dye pairs disagreed. Dalamud Red ↔ Coral
   * Pink is 2.99504: its third decimal is 5, where floor and round part ways.
   * The figure is hard-coded, not recomputed, so the test cannot pass by
   * checking the shared formatter against itself.
   */
  const coralPink = dyeService.searchByName('Coral Pink')[0];

  /** Every `N.NN:1` figure the svg prints as a whole text node. */
  const ratioFigures = (svg: string): string[] =>
    [...svg.matchAll(/>(\d+[.,]\d+:1)<\/text>/g)].map((m) => m[1]);

  const asContrastInput = (d: typeof dalamudRed) => ({ hex: d.hex, name: d.name, itemID: d.itemID });

  it.each([
    ['en', '2.99:1'],
    ['de', '2,99:1'],
  ] as const)('prints %s as %s on the duel, the /contrast card and its embed', async (locale, expected) => {
    const compared = await executeComparison({ dyes: [dalamudRed, coralPink], locale });
    const contrasted = await executeContrast({
      dyes: [asContrastInput(dalamudRed), asContrastInput(coralPink)],
      locale,
    });
    expect(compared.ok && contrasted.ok).toBe(true);
    if (!compared.ok || !contrasted.ok) return;

    expect(contrasted.pairs[0].ratio).toBeGreaterThan(2.995);
    expect(contrasted.pairs[0].ratio).toBeLessThan(3);

    expect(ratioFigures(compared.svgString)).toEqual([expected]);
    expect(ratioFigures(contrasted.svgString)).toEqual([expected]);
    expect(contrasted.embed.description?.endsWith(` · ${expected}`)).toBe(true);
  });
});

// ============================================================================
// One separator per card — every duel readout through the card's formatter
// ============================================================================

describe('every /compare duel readout uses the locale decimal separator', () => {
  /**
   * The RATIO readout went through the localized printer (2,99:1 in de/fr)
   * while the six distance readouts were bare toFixed, so one German card read
   * 27,2 in the ΔE headline, 27.2 under it in the strip, and 2,99:1 at the
   * end. The figures are Dalamud Red ↔ Coral Pink, hard-coded so the test
   * cannot pass by checking the formatter against itself.
   */
  const coralPink = dyeService.searchByName('Coral Pink')[0];
  const LABELS = ['ΔE2000', 'ΔEOK2', 'ΔE76', 'REDMEAN', 'RGB', 'DIST%', 'RATIO'];

  /** Every text node of the svg, in document order. */
  const texts = (svg: string): string[] =>
    [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((m) => m[1]);

  /**
   * The readout strip as [label, value] pairs — each value is the text node
   * just before its label. The strip's ΔE2000 is the LAST one: the headline
   * carries the same label first.
   */
  const strip = (svg: string): string[][] => {
    const all = texts(svg);
    const start = all.lastIndexOf('ΔE2000') - 1;
    const cells = all.slice(start, start + 2 * LABELS.length);
    return LABELS.map((_, k) => [cells[2 * k + 1], cells[2 * k]]);
  };

  it.each([
    ['en', ['27.2', '0.260', '30.5', '237', '136', '31%', '2.99:1']],
    ['de', ['27,2', '0,260', '30,5', '237', '136', '31%', '2,99:1']],
    ['fr', ['27,2', '0,260', '30,5', '237', '136', '31%', '2,99:1']],
  ] as const)('%s prints every readout in the one style', async (locale, values) => {
    const result = await executeComparison({ dyes: [dalamudRed, coralPink], locale });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(strip(result.svgString)).toEqual(LABELS.map((label, k) => [label, values[k]]));
  });

  it('the strip ΔE2000 reads exactly as the headline ΔE above it (de)', async () => {
    const result = await executeComparison({ dyes: [dalamudRed, coralPink], locale: 'de' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const all = texts(result.svgString);
    const headline = all[all.indexOf('ΔE2000') - 1];
    const readout = all[all.lastIndexOf('ΔE2000') - 1];
    expect(all.indexOf('ΔE2000')).toBeLessThan(all.lastIndexOf('ΔE2000'));
    expect(headline).toBe('27,2');
    expect(readout).toBe(headline);
  });
});
