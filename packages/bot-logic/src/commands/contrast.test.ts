/**
 * Tests for the /contrast command (13A/13B/13C·1 router).
 */

import { describe, it, expect, vi } from 'vitest';
import { executeContrast, type ContrastInput } from './contrast.js';

const white = { hex: '#F0EBE0', name: 'Snow White', itemID: 5729 };
const black = { hex: '#2B2923', name: 'Soot Black', itemID: 5730 };
const red = { hex: '#781A1A', name: 'Dalamud Red', itemID: 5738 };
const blue = { hex: '#273067', name: 'Royal Blue', itemID: 5773 };

describe('executeContrast', () => {
  it('routes two dyes to 13A — the worst pair gets the whole card', async () => {
    const result = await executeContrast({ dyes: [white, black], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.pairs).toHaveLength(1);
    expect(result.svgString).toContain('/CONTRAST');
    expect(result.svgString).toContain(':1');
    // One pair: the REST strip is absent by condition, not blank
    expect(result.svgString).not.toContain('REST');
  });

  it('routes three dyes to 13B — every pair named', async () => {
    const result = await executeContrast({ dyes: [white, black, red], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.pairs).toHaveLength(3);
    expect(result.svgString).toContain('Snow White');
    expect(result.svgString).toContain('PAIR');
  });

  it('routes four dyes to 13C·1 — the plot with the value column', async () => {
    const result = await executeContrast({ dyes: [white, black, red, blue], locale: 'en' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.pairs).toHaveLength(6);
    // Axis endpoints + the shipped short column header
    expect(result.svgString).toContain('1:1');
    expect(result.svgString).toContain('21:1');
    expect(result.svgString).toContain('RATIO');
  });

  it('sorts pairs worst-first and leads the embed with the worst', async () => {
    const result = await executeContrast({ dyes: [white, black, red], locale: 'en' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (let i = 1; i < result.pairs.length; i++) {
      expect(result.pairs[i].ratio).toBeGreaterThanOrEqual(result.pairs[i - 1].ratio);
    }
    expect(result.embed.description).toContain(':1');
  });

  it('polarity: a high-contrast pair reads green, a near pair reads red', async () => {
    const high = await executeContrast({ dyes: [white, black], locale: 'en' });
    const low = await executeContrast({ dyes: [red, { ...red, name: 'Rust Red', hex: '#622207', itemID: 5741 }], locale: 'en' });
    expect(high.ok && low.ok).toBe(true);
    if (!high.ok || !low.ok) return;
    // green = far apart = safe (dark ramp tier colours)
    expect(high.svgString).toContain('#5bbd68');
    expect(low.svgString).toContain('#f4645a');
  });

  // BUG-142: the card floors the printed ratio; the embed above it in the
  // same Discord message used to round it (toFixed), so about half of all
  // dye pairs read two different figures — here 3.00:1 over a card saying
  // 2.99:1 "under 3:1". Dalamud Red ↔ Coral Pink is 2.99504: its third
  // decimal is 5, the case where floor and round part ways.
  describe('the embed prints the same floored ratio as the card (BUG-142)', () => {
    const dalamudRed = { hex: '#781A1A', name: 'Dalamud Red', itemID: 5738 };
    const coralPink = { hex: '#CC6C5E', name: 'Coral Pink' };

    it('reads 2.99:1 in the embed and on the card, never 3.00:1', async () => {
      const result = await executeContrast({ dyes: [dalamudRed, coralPink], locale: 'en' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.pairs[0].ratio).toBeGreaterThan(2.995);
      expect(result.pairs[0].ratio).toBeLessThan(3);
      expect(result.embed.description?.endsWith(' · 2.99:1')).toBe(true);
      expect(result.svgString).toContain('>2.99:1</text>');
      expect(result.embed.description).not.toContain('3.00');
      expect(result.svgString).not.toContain('3.00:1');
    });

    it("floors a real ratio a hair under the cut (2.9999999999993983 — the old epsilon's case)", async () => {
      const result = await executeContrast({
        dyes: [
          { hex: '#1C5F98', name: '#1C5F98' },
          { hex: '#190102', name: '#190102' },
        ],
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.embed.description?.endsWith(' · 2.99:1')).toBe(true);
      expect(result.svgString).toContain('>2.99:1</text>');
      expect(result.svgString).not.toContain('3.00:1');
    });

    it("prints the embed with the language's decimal separator, as the card does", async () => {
      const result = await executeContrast({ dyes: [dalamudRed, coralPink], locale: 'de' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.embed.description?.endsWith(' · 2,99:1')).toBe(true);
      expect(result.svgString).toContain('>2,99:1</text>');
    });
  });

  it('localizes the German column header (VERH.)', async () => {
    const result = await executeContrast({ dyes: [white, black, red, blue], locale: 'de' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('VERH.');
  });
});

describe('executeContrast — fewer than two dyes', () => {
  /**
   * A contrast needs a pair. Fewer dyes used to reach `pairs[0].nameA` and
   * throw a TypeError that came back as GENERATION_FAILED — a caller's
   * mistake reported as a render bug. A non-array (a JavaScript caller of the
   * published package) is refused the same way rather than thrown across the
   * boundary.
   */
  it.each([
    ['no dyes', []],
    ['one dye', [white]],
    ['undefined', undefined],
    ['null', null],
  ])('refuses %s with its own code and a localized message', async (_label, dyes) => {
    const warn = vi.fn();
    const result = await executeContrast({
      dyes: dyes as ContrastInput['dyes'],
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

describe('executeContrast — a generation failure is logged (BUG-125)', () => {
  /**
   * The catch used to be bare. A hex input is user-typed and core's parser
   * quotes it in its message, so the line names the error's class — never
   * the message, never a dye name or hex.
   */
  it('logs the error class and leaves names and hexes out of the line', async () => {
    const warn = vi.fn();
    const typed = { hex: '#ZZZZZZ', name: 'Sentinel Typed Name' };
    const result = await executeContrast({ dyes: [white, typed], locale: 'en', logger: { warn } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('GENERATION_FAILED');

    const lines = warn.mock.calls.flat().map(String);
    expect(lines.some((l) => /^\[contrast\] generation failed: \w+/.test(l))).toBe(true);
    for (const line of lines) {
      expect(line).not.toContain('ZZZZZZ');
      expect(line).not.toContain('Sentinel Typed Name');
    }
  });
});
