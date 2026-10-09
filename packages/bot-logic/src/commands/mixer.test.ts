/**
 * Mixer Command — Unit Tests
 *
 * Tests for executeMixer — blending two colors and finding closest dyes.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Dye, DyeTypeFilters } from '@xivdyetools/types';
import { ColorService, filterDyes, isDyeExcluded, type MatchingMethod } from '@xivdyetools/core';
import { blendColors } from '@xivdyetools/core/blending';
import { dyeService } from '../input-resolution.js';
import { executeMixer, MIXER_SWEEP_RATIOS } from './mixer.js';
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

  // BUG-033 (2026-10-04 deep dive): the filters used to be checked against
  // the nearest dye one at a time, giving up after twenty rejections — so
  // with `/preferences vendor` the Snow White + Soot Black sweep silently
  // lost its 65% stop (the first allowed dye sits at rank 31). The answer
  // must be the nearest dye in the FILTERED pool, for every stop.
  describe('dyeFilters narrow the pool before the search (BUG-033)', () => {
    const vendorFilter: DyeTypeFilters = { excludeVendorDyes: true };
    const dyeNamed = (name: string): Dye => {
      const dye = dyeService.searchByName(name)[0];
      expect(dye.name).toBe(name);
      return dye;
    };
    const rank = (hex: string, pool: Dye[], method: MatchingMethod): Dye[] =>
      [...pool].sort(
        (a, b) =>
          ColorService.getDistanceForMethod(hex, a.hex, method) -
          ColorService.getDistanceForMethod(hex, b.hex, method),
      );

    /**
     * Each row must reach a stop the old cap dropped under ITS method, or it
     * guards nothing for that method. Snow White + Rust Red does under all
     * five (its 65% and 80% stops). The reported Snow White + Soot Black does
     * under four — cie76 kept every stop there — so it is pinned under the
     * method it was reported with only.
     */
    const ROWS: Array<{ method: MatchingMethod; partner: string }> = [
      ...(['ciede2000', 'oklab', 'cie76', 'rgb', 'distinguish'] as MatchingMethod[]).map(
        (method) => ({ method, partner: 'Rust Red' }),
      ),
      { method: 'ciede2000', partner: 'Soot Black' },
    ];

    it.each(ROWS)(
      'reaches a stop whose twenty nearest unfiltered dyes by $method are all excluded (Snow White + $partner)',
      ({ method, partner }) => {
        // Precondition for the regression below: without it, a later dye-data
        // change could leave the filter never rejecting twenty in a row under
        // this method, and the row would pass without exercising the old cap.
        const snowWhite = dyeNamed('Snow White');
        const other = dyeNamed(partner);
        const capped = MIXER_SWEEP_RATIOS.filter((pct) => {
          const blendHex = blendColors(snowWhite.hex, other.hex, 'rgb', pct / 100).hex;
          return rank(blendHex, dyeService.getAllDyes(), method)
            .slice(0, 20)
            .every((dye) => isDyeExcluded(vendorFilter, dye));
        });
        expect(capped.length).toBeGreaterThan(0);
      },
    );

    // rgb runs core's k-d tree with the exclusion predicate; distinguish ranks
    // by the unrounded percent — both must still land on the nearest allowed
    // dye. Distances are compared rather than ids, so a tie between two
    // equidistant dyes cannot flake the test (rounding is monotonic, so the
    // rounded minimum is the minimum of the rounded distances).
    it.each(ROWS)(
      'keeps all five stops, each on the nearest allowed dye ($method, Snow White + $partner)',
      async ({ method: matchingMethod, partner }) => {
        const result = await executeMixer({
          dye1: dyeNamed('Snow White'),
          dye2: dyeNamed(partner),
          blendingMode: 'rgb',
          matchingMethod,
          locale: 'en',
          dyeFilters: vendorFilter,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.sweep.map((s) => s.pct)).toEqual([...MIXER_SWEEP_RATIOS]);
        const allowed = filterDyes(vendorFilter, dyeService.getAllDyes());
        for (const stop of result.sweep) {
          expect(isDyeExcluded(vendorFilter, stop.dye)).toBe(false);
          const nearestAllowed = rank(stop.blendHex, allowed, matchingMethod)[0];
          expect(
            ColorService.getDistanceForMethod(stop.blendHex, stop.dye.hex, matchingMethod),
          ).toBeCloseTo(
            ColorService.getDistanceForMethod(stop.blendHex, nearestAllowed.hex, matchingMethod),
            6,
          );
          expect(stop.deltaE).toBeCloseTo(
            ColorService.getDistanceForMethod(stop.blendHex, stop.dye.hex, 'ciede2000'),
            6,
          );
        }
      },
    );
  });

  // BUG-125: the final catch used to discard the exception, so a broken
  // card generator surfaced as GENERATION_FAILED with nothing in the log.
  // The line names the error's class (and an AppError's code), never its
  // message: core's colour helpers quote the hex they were given.
  describe('generation failure is logged (BUG-125)', () => {
    /** Every argument the logger received, one string per argument. */
    const loggedLines = (warn: ReturnType<typeof vi.fn>): string[] =>
      warn.mock.calls.flat().map(String);

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('warns with the error class and still returns GENERATION_FAILED', async () => {
      vi.spyOn(dyeService, 'findClosestDye').mockImplementation(() => {
        throw new TypeError('search exploded on Sentinel Secret');
      });
      const warn = vi.fn();

      const result = await executeMixer({
        dye1,
        dye2,
        blendingMode: 'rgb',
        locale: 'en',
        logger: { warn },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('GENERATION_FAILED');
      const lines = loggedLines(warn);
      expect(lines).toContain('[mixer] generation failed: TypeError');
      // Neither the inputs' names nor the error's message reaches the log
      for (const line of lines) {
        expect(line).not.toContain(dye1.name);
        expect(line).not.toContain(dye2.name);
        expect(line).not.toContain('Sentinel');
      }
    });

    it('never logs the hex core quotes back in its message', async () => {
      const warn = vi.fn();

      const result = await executeMixer({
        dye1: { hex: 'Sentinel Secret' },
        dye2,
        blendingMode: 'rgb',
        locale: 'en',
        logger: { warn },
      });

      expect(result).toMatchObject({ ok: false, error: 'GENERATION_FAILED' });
      const lines = loggedLines(warn);
      expect(lines).toContain('[mixer] generation failed: Error');
      for (const line of lines) expect(line).not.toContain('Sentinel');
    });

    it('names a non-Error throw by its type, without echoing its value', async () => {
      vi.spyOn(dyeService, 'findClosestDye').mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally testing the non-Error arm
        throw 'Dalamud Red';
      });
      const warn = vi.fn();

      const result = await executeMixer({
        dye1,
        dye2,
        blendingMode: 'rgb',
        locale: 'en',
        logger: { warn },
      });

      expect(result.ok).toBe(false);
      const lines = loggedLines(warn);
      expect(lines).toContain('[mixer] generation failed: string');
      for (const line of lines) expect(line).not.toContain('Dalamud Red');
    });

    it('fails cleanly without a logger', async () => {
      vi.spyOn(dyeService, 'findClosestDye').mockImplementation(() => {
        throw new Error('search exploded');
      });

      const result = await executeMixer({ dye1, dye2, blendingMode: 'rgb', locale: 'en' });

      expect(result).toMatchObject({ ok: false, error: 'GENERATION_FAILED' });
    });
  });
});
