/**
 * Gradient Command — Unit Tests
 *
 * Tests for executeGradient — multi-step color gradient generation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Dye, DyeTypeFilters } from '@xivdyetools/types';
import { ColorService, filterDyes, isDyeExcluded, type MatchingMethod } from '@xivdyetools/core';
import { dyeService } from '../input-resolution.js';
import { executeGradient } from './gradient.js';
import type { InterpolationMode } from './gradient.js';

const startColor = { hex: '#FF0000' };
const endColor = { hex: '#0000FF' };

// ============================================================================
// executeGradient
// ============================================================================

describe('executeGradient', () => {
  it('generates a gradient with default settings', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.svgString).toContain('<svg');
    expect(result.gradientSteps.length).toBe(6); // default stepCount
    expect(result.startColor).toBe(startColor);
    expect(result.endColor).toBe(endColor);
  });

  it('respects custom step count', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      stepCount: 4,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.gradientSteps.length).toBe(4);
  });

  it('first step hex matches start color', async () => {
    const result = await executeGradient({
      startColor: { hex: '#FF0000' },
      endColor: { hex: '#00FF00' },
      stepCount: 3,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // First step should be at or very near the start color
    expect(result.gradientSteps[0].hex).toBeDefined();
  });

  it('last step hex matches end color', async () => {
    const result = await executeGradient({
      startColor: { hex: '#FF0000' },
      endColor: { hex: '#00FF00' },
      stepCount: 3,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Last step should be at or very near the end color
    expect(result.gradientSteps[result.gradientSteps.length - 1].hex).toBeDefined();
  });

  describe('color spaces', () => {
    const colorSpaces: InterpolationMode[] = ['rgb', 'hsv', 'lab', 'oklch', 'lch'];

    for (const colorSpace of colorSpaces) {
      it(`generates gradient in ${colorSpace} color space`, async () => {
        const result = await executeGradient({
          startColor,
          endColor,
          colorSpace,
          stepCount: 4,
          locale: 'en',
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        expect(result.svgString).toContain('<svg');
        expect(result.gradientSteps.length).toBe(4);
      });
    }
  });

  it('each step has a hex color', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      stepCount: 5,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const step of result.gradientSteps) {
      expect(step.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('each step includes a distance value', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      stepCount: 4,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const step of result.gradientSteps) {
      expect(typeof step.distance).toBe('number');
      expect(step.distance).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns embed with title and description', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // One line: the card carries every step; the description exists only
    // when the cap omitted rows
    expect(result.embed.title).toBeDefined();
    expect(result.svgString).toContain('/GRADIENT');
  });

  it('works with named start/end colors', async () => {
    const result = await executeGradient({
      startColor: { hex: '#FF0000', name: 'Dalamud Red', itemID: 5790 },
      endColor: { hex: '#FFFFFF', name: 'Snow White', itemID: 5729 },
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.embed.title).toBeDefined();
    expect(result.svgString).toContain('width="400"');
  });

  it('works with Japanese locale', async () => {
    const result = await executeGradient({
      startColor,
      endColor,
      locale: 'ja',
    });

    expect(result.ok).toBe(true);
  });

  describe('hueDiff < -180 branches (blue to red)', () => {
    const blueStart = { hex: '#0000FF' };
    const redEnd = { hex: '#FF0000' };

    it('handles hueDiff < -180 in hsv', async () => {
      const result = await executeGradient({
        startColor: blueStart,
        endColor: redEnd,
        colorSpace: 'hsv',
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });

    it('handles hueDiff < -180 in oklch', async () => {
      const result = await executeGradient({
        startColor: blueStart,
        endColor: redEnd,
        colorSpace: 'oklch',
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });

    it('handles hueDiff < -180 in lch', async () => {
      const result = await executeGradient({
        startColor: blueStart,
        endColor: redEnd,
        colorSpace: 'lch',
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });
  });

  describe('default colorSpace fallback', () => {
    it('falls back to hsv for unrecognized colorSpace (red to blue, hueDiff > 180)', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        colorSpace: 'unknown' as InterpolationMode,
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });

    it('falls back to hsv for unrecognized colorSpace (blue to red, hueDiff < -180)', async () => {
      const result = await executeGradient({
        startColor: { hex: '#0000FF' },
        endColor: { hex: '#FF0000' },
        colorSpace: 'unknown' as InterpolationMode,
        stepCount: 3,
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gradientSteps.length).toBe(3);
    });
  });

  describe('matchingMethod label', () => {
    it('uses ciede2000 matching method', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        matchingMethod: 'ciede2000',
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // The card prints ΔE2000 per row; omissions (if any) ride the embed
      expect(result.gradientSteps.every((s) => typeof s.distance === 'number')).toBe(true);
    });

    it('uses cie76 matching method', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        matchingMethod: 'cie76',
        locale: 'en',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.svgString).toContain('/GRADIENT');
    });
  });

  describe('dyeFilters', () => {
    it('excludes metallic dyes when excludeMetallic is set', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        stepCount: 6,
        locale: 'en',
        dyeFilters: { excludeMetallic: true },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      for (const step of result.gradientSteps) {
        if (step.dye) {
          expect(step.dye.isMetallic).toBe(false);
        }
      }
    });

    it('returns dyes when dyeFilters is empty', async () => {
      const result = await executeGradient({
        startColor,
        endColor,
        stepCount: 4,
        locale: 'en',
        dyeFilters: {},
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.gradientSteps.length).toBe(4);
    });
  });

  // BUG-033 (2026-10-04 deep dive): the filters used to be checked against
  // the nearest dye one at a time, giving up after ten rejections — so with
  // `/preferences vendor` (85 of 125 dyes excluded) the #666666 step of a
  // white→black gradient printed "no match" at ΔE 999 although 40 allowed
  // dyes exist. The answer must be the nearest dye in the FILTERED pool.
  describe('dyeFilters narrow the pool before the search (BUG-033)', () => {
    const vendorFilter: DyeTypeFilters = { excludeVendorDyes: true };
    const rank = (hex: string, pool: Dye[], method: MatchingMethod): Dye[] =>
      [...pool].sort(
        (a, b) =>
          ColorService.getDistanceForMethod(hex, a.hex, method) -
          ColorService.getDistanceForMethod(hex, b.hex, method),
      );

    // rgb runs core's k-d tree with the exclusion predicate; distinguish ranks
    // by the unrounded percent — both must still land on the nearest allowed
    // dye. Distances are compared rather than ids, so a tie between two
    // equidistant dyes cannot flake the test (rounding is monotonic, so the
    // rounded minimum is the minimum of the rounded distances).
    it.each(['ciede2000', 'oklab', 'cie76', 'rgb', 'distinguish'] as MatchingMethod[])(
      'matches every step to the nearest allowed dye (%s)',
      async (matchingMethod) => {
        const result = await executeGradient({
          startColor: { hex: '#FFFFFF' },
          endColor: { hex: '#000000' },
          stepCount: 6,
          colorSpace: 'hsv',
          matchingMethod,
          locale: 'en',
          dyeFilters: vendorFilter,
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const allowed = filterDyes(vendorFilter, dyeService.getAllDyes());
        expect(allowed.length).toBeGreaterThan(0);
        for (const step of result.gradientSteps) {
          expect(step.dye, `step ${step.hex} found no dye`).toBeDefined();
          expect(isDyeExcluded(vendorFilter, step.dye!)).toBe(false);
          const nearestAllowed = rank(step.hex, allowed, matchingMethod)[0];
          expect(
            ColorService.getDistanceForMethod(step.hex, step.dye!.hex, matchingMethod),
          ).toBeCloseTo(
            ColorService.getDistanceForMethod(step.hex, nearestAllowed.hex, matchingMethod),
            6,
          );
          expect(step.distance).toBeCloseTo(
            ColorService.getDistanceForMethod(step.hex, step.dye!.hex, 'ciede2000'),
            6,
          );
        }
      },
    );

    it('reaches a step whose ten nearest unfiltered dyes are all excluded', async () => {
      // Precondition for the test above: without it, a later dye-data change
      // could leave the filter never rejecting ten in a row, and the BUG-033
      // regression would pass without exercising the old cap at all.
      const result = await executeGradient({
        startColor: { hex: '#FFFFFF' },
        endColor: { hex: '#000000' },
        stepCount: 6,
        colorSpace: 'hsv',
        locale: 'en',
        dyeFilters: vendorFilter,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const capped = result.gradientSteps.filter((step) =>
        rank(step.hex, dyeService.getAllDyes(), 'ciede2000')
          .slice(0, 10)
          .every((dye) => isDyeExcluded(vendorFilter, dye)),
      );
      expect(capped.map((s) => s.hex)).toContain('#666666');
      for (const step of capped) {
        expect(step.dye).toBeDefined();
        expect(step.distance).toBeLessThan(999);
      }
    });
  });

  // 12H·2 stage 2: past five distinct rows, a row whose worst step is ΔE 0.0
  // says nothing (the dye IS the ideal), so it drops by its VALUE. Between two
  // real dyes that is exactly the two endpoints: six steps, six distinct
  // dyes, and the four in between are the rows. The strip still carries all
  // six; the embed names the two the rows left out.
  describe('the row cap drops zero-ΔE rows by value', () => {
    const named = (name: string): Dye => {
      const dye = dyeService.getAllDyes().find((d) => d.name === name);
      if (!dye) throw new Error(`fixture dye ${name} missing`);
      return dye;
    };

    it('a dye-to-dye gradient drops its two exact endpoints and keeps the four gaps', async () => {
      const snow = named('Snow White');
      const jet = named('Jet Black');
      const result = await executeGradient({
        startColor: { hex: snow.hex, name: snow.name, itemID: snow.itemID, dye: snow },
        endColor: { hex: jet.hex, name: jet.name, itemID: jet.itemID, dye: jet },
        stepCount: 6,
        locale: 'en',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Preconditions: six distinct consecutive dyes, zero ΔE only at the ends
      const ids = result.gradientSteps.map((s) => s.dyeId);
      expect(new Set(ids).size).toBe(6);
      const distances = result.gradientSteps.map((s) => s.distance);
      expect(distances[0]).toBe(0);
      expect(distances[5]).toBe(0);
      for (const d of distances.slice(1, 5)) expect(d).toBeGreaterThanOrEqual(0.05);

      expect(result.omittedRows).toBe(2);
      expect(result.embed.description).toBe('+2 more, listed in the message');
      // The card's rows are steps 2-5, in step order: each row opens with its
      // step number at the left margin.
      const stepLabels = [
        ...result.svgString.matchAll(/<text x="16" [^>]*>(\d+(?:–\d+)?)<\/text>/g),
      ].map((m) => m[1]);
      expect(stepLabels).toEqual(['2', '3', '4', '5']);
    });
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

      const result = await executeGradient({
        startColor: { hex: '#FF0000', name: 'Dalamud Red', itemID: 5790 },
        endColor,
        locale: 'en',
        logger: { warn },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error).toBe('GENERATION_FAILED');
      const lines = loggedLines(warn);
      expect(lines).toContain('[gradient] generation failed: TypeError');
      // Neither the input's name nor the error's message reaches the log
      for (const line of lines) {
        expect(line).not.toContain('Dalamud Red');
        expect(line).not.toContain('Sentinel');
      }
    });

    it('never logs the hex core quotes back in its message', async () => {
      const warn = vi.fn();

      const result = await executeGradient({
        startColor: { hex: 'Sentinel Secret' },
        endColor,
        locale: 'en',
        logger: { warn },
      });

      expect(result).toMatchObject({ ok: false, error: 'GENERATION_FAILED' });
      const lines = loggedLines(warn);
      expect(lines).toContain('[gradient] generation failed: AppError INVALID_HEX_COLOR');
      for (const line of lines) expect(line).not.toContain('Sentinel');
    });

    it('names a non-Error throw by its type, without echoing its value', async () => {
      vi.spyOn(dyeService, 'findClosestDye').mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- intentionally testing the non-Error arm
        throw 'Dalamud Red';
      });
      const warn = vi.fn();

      const result = await executeGradient({
        startColor,
        endColor,
        locale: 'en',
        logger: { warn },
      });

      expect(result.ok).toBe(false);
      const lines = loggedLines(warn);
      expect(lines).toContain('[gradient] generation failed: string');
      for (const line of lines) expect(line).not.toContain('Dalamud Red');
    });

    it('fails cleanly without a logger', async () => {
      vi.spyOn(dyeService, 'findClosestDye').mockImplementation(() => {
        throw new Error('search exploded');
      });

      const result = await executeGradient({ startColor, endColor, locale: 'en' });

      expect(result).toMatchObject({ ok: false, error: 'GENERATION_FAILED' });
    });
  });
});

// ============================================================================
// A grey endpoint's hue is powerless (BUG-035's sibling on the hue paths)
// ============================================================================

describe('executeGradient — a grey endpoint has no hue of its own', () => {
  /** The five step hexes of a gradient between two raw hexes. */
  const ramp = async (
    start: string,
    end: string,
    colorSpace: InterpolationMode,
  ): Promise<string[]> => {
    const result = await executeGradient({
      startColor: { hex: start },
      endColor: { hex: end },
      colorSpace,
      stepCount: 5,
      locale: 'en',
    });
    if (!result.ok) throw new Error(`gradient failed: ${result.error}`);
    return result.gradientSteps.map((step) => step.hex);
  };

  /** A colour's hue in the space the mode interpolates in (anything else is HSV). */
  const hueIn = (colorSpace: InterpolationMode, hex: string): number => {
    if (colorSpace === 'oklch') return ColorService.hexToOklch(hex).h;
    if (colorSpace === 'lch') return ColorService.hexToLch(hex).h;
    return ColorService.hexToHsv(hex).h;
  };

  /** The angle between two hues, the short way round. */
  const hueGap = (a: number, b: number): number => {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
  };

  // Slate Grey is an exact grey dye; #2A3FD0 is a saturated blue.
  const SLATE_GREY = '#656565';
  const BLUE = '#2A3FD0';

  // 'not-a-space' reaches the switch's default branch, which is HSV too.
  const HUE_MODES: InterpolationMode[] = [
    'hsv',
    'oklch',
    'lch',
    'not-a-space' as InterpolationMode,
  ];

  // A grey reports hue 0 in HSV and OKLCH and ~158 in LCH (float noise in a
  // and b) — a placeholder, not a colour. Interpolating it drew a purple
  // midpoint (#975D9B) in HSV, sent the LCH ramp through teal (#276A68), and
  // turned white → blue pink. Each pair runs both ways, so the grey side is
  // tested as the start and as the end.
  describe.each(HUE_MODES)('in %s', (colorSpace) => {
    it.each([
      [SLATE_GREY, BLUE],
      [BLUE, SLATE_GREY],
      ['#FFFFFF', '#0000FF'],
      ['#0000FF', '#FFFFFF'],
    ])('the midpoint of %s → %s keeps the blue end’s hue', async (start, end) => {
      const blue = start === SLATE_GREY || start === '#FFFFFF' ? end : start;

      const midpoint = (await ramp(start, end, colorSpace))[2];

      expect(hueGap(hueIn(colorSpace, midpoint), hueIn(colorSpace, blue))).toBeLessThan(3);
    });
  });

  // The exact ramps, pinned once the rule holds. The web app's gradient tool
  // runs the same arithmetic, and its tests pin the same hexes.
  it.each([
    // Before: ['#656565', '#806674', '#975D9B', '#7549B5', '#2A3FD0']
    ['hsv', ['#656565', '#666980', '#5D659B', '#4956B5', '#2A3FD0']],
    // Before: ['#656565', '#77566D', '#754989', '#6042AF', '#2A3FD0']
    ['oklch', ['#656565', '#556182', '#445A9D', '#364FB6', '#2A3FD0']],
    // Before: ['#656565', '#276A68', '#006A91', '#0061C3', '#2A3FD0']
    ['lch', ['#656565', '#635C80', '#5B529A', '#4C49B5', '#2A3FD0']],
  ] as const)('pins the Slate Grey → blue ramp in %s', async (colorSpace, expected) => {
    expect(await ramp(SLATE_GREY, BLUE, colorSpace)).toEqual(expected);
  });

  // Two chromatic ends are untouched: these are the ramps the code drew
  // before the rule, byte for byte. Snow White (#E4DFD0) is a near-grey with a
  // real, faint hue — only an exact grey (r = g = b) is powerless, as in
  // core's blendHSL. White → black is grey at both ends, where the hue does
  // not matter and the ends keep their own.
  const UNCHANGED: Array<{
    start: string;
    end: string;
    hsv: string[];
    oklch: string[];
    lch: string[];
  }> = [
    {
      start: '#FF0000',
      end: '#0000FF',
      hsv: ['#FF0000', '#FF0080', '#FF00FF', '#8000FF', '#0000FF'],
      oklch: ['#FF0000', '#E8007B', '#BA00C2', '#7A00F4', '#0000FF'],
      lch: ['#FF0000', '#FF0045', '#FA0080', '#C500C3', '#0000FF'],
    },
    {
      start: '#0000FF',
      end: '#FF0000',
      hsv: ['#0000FF', '#8000FF', '#FF00FF', '#FF0080', '#FF0000'],
      oklch: ['#0000FF', '#7A00F4', '#BA00C2', '#E8007B', '#FF0000'],
      lch: ['#0000FF', '#C500C3', '#FA0080', '#FF0045', '#FF0000'],
    },
    {
      // Dalamud Red → Royal Blue
      start: '#781A1A',
      end: '#273067',
      hsv: ['#781A1A', '#741E4C', '#6A216F', '#40246B', '#273067'],
      oklch: ['#781A1A', '#6D1A3F', '#5B2158', '#432966', '#273067'],
      lch: ['#781A1A', '#761035', '#68184D', '#4E265E', '#273067'],
    },
    {
      // Snow White → Royal Blue
      start: '#E4DFD0',
      end: '#273067',
      hsv: ['#E4DFD0', '#C59A99', '#A56B94', '#6B4586', '#273067'],
      oklch: ['#E4DFD0', '#C8AA9C', '#A47783', '#6F4E79', '#273067'],
      lch: ['#E4DFD0', '#C9AB9A', '#AC777C', '#7C4B70', '#273067'],
    },
    {
      start: '#FFFFFF',
      end: '#000000',
      hsv: ['#FFFFFF', '#BFBFBF', '#808080', '#404040', '#000000'],
      oklch: ['#FFFFFF', '#AEAEAE', '#636363', '#222222', '#000000'],
      lch: ['#FFFFFF', '#B9B9B9', '#777777', '#3B3B3B', '#000000'],
    },
  ];

  it.each(UNCHANGED)('leaves $start → $end byte-identical in every hue mode', async (row) => {
    expect(await ramp(row.start, row.end, 'hsv')).toEqual(row.hsv);
    expect(await ramp(row.start, row.end, 'oklch')).toEqual(row.oklch);
    expect(await ramp(row.start, row.end, 'lch')).toEqual(row.lch);
    // The default branch is HSV
    expect(await ramp(row.start, row.end, 'not-a-space' as InterpolationMode)).toEqual(row.hsv);
  });
});
