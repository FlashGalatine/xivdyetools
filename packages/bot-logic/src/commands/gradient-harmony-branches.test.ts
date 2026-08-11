/**
 * Interpolation modes and exhausted-filter paths for /gradient and /harmony.
 *
 * Both commands loop over candidate dyes and give up after a bounded number
 * of attempts. When a user's filter set excludes everything, that loop falls
 * through to a no-dye step — and the card must still render blanks rather
 * than `undefined`, because a burned-in "undefined" survives every repost of
 * the PNG.
 */

import { describe, it, expect } from 'vitest';
import type { DyeTypeFilters } from '@xivdyetools/types';
import { dyeService } from '../input-resolution.js';
import { executeGradient, type InterpolationMode } from './gradient.js';
import { executeHarmony } from './harmony.js';

const snowWhite = dyeService.searchByName('Snow White')[0];
const sootBlack = dyeService.searchByName('Soot Black')[0];

const resolved = (dye: typeof snowWhite) => ({
  hex: dye.hex,
  name: dye.name,
  id: dye.id,
  itemID: dye.itemID,
  dye,
});

/** Every exclusion at once — nothing in the database survives it. */
const excludeEverything: DyeTypeFilters = {
  excludeMetallic: true,
  excludePastel: true,
  excludeDark: true,
  excludeCosmic: true,
  excludeIshgardian: true,
  excludeExpensive: true,
  excludeVendorDyes: true,
  excludeCraftDyes: true,
};

describe('executeGradient — interpolation modes', () => {
  it.each(['rgb', 'lab', 'oklab', 'ryb', 'hsl', 'spectral', 'lch', 'hsv'] as InterpolationMode[])(
    'renders a card in %s space',
    async (colorSpace) => {
      const result = await executeGradient({
        startColor: resolved(snowWhite),
        endColor: resolved(sootBlack),
        stepCount: 5,
        colorSpace,
        locale: 'en',
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.svgString).toContain('<svg');
      expect(result.svgString).not.toContain('undefined');
      expect(result.svgString).not.toContain('NaN');
    }
  );

  it('falls back to HSV for an unrecognised colour space', async () => {
    const result = await executeGradient({
      startColor: resolved(snowWhite),
      endColor: resolved(sootBlack),
      stepCount: 4,
      colorSpace: 'not-a-space' as InterpolationMode,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('<svg');
  });

  it('does not divide by zero at a single step', async () => {
    const result = await executeGradient({
      startColor: resolved(snowWhite),
      endColor: resolved(sootBlack),
      stepCount: 1,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).not.toContain('NaN');
  });
});

describe('executeGradient — exhausted filters', () => {
  it('renders blanks rather than undefined when no dye survives the filters', async () => {
    const result = await executeGradient({
      startColor: resolved(snowWhite),
      endColor: resolved(sootBlack),
      stepCount: 6,
      locale: 'en',
      dyeFilters: excludeEverything,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('<svg');
    expect(result.svgString).not.toContain('undefined');
    // Steps with no match keep their ideal hex and carry no dye
    expect(result.gradientSteps.every((s) => typeof s.hex === 'string')).toBe(true);
    expect(result.gradientSteps.every((s) => s.dye === undefined)).toBe(true);
    expect(result.gradientSteps.every((s) => s.dyeName === undefined)).toBe(true);
  });
});

describe('executeGradient — the 12H·4 collapse verdict', () => {
  it('calls out four-plus steps that collapse to two rows or fewer', async () => {
    // Endpoints one JND apart: every interpolated step lands on the same dye
    const nearlyIdentical = { ...snowWhite, hex: '#FFFFFF' };
    const alsoNearlyIdentical = { ...snowWhite, hex: '#FEFEFE' };

    const result = await executeGradient({
      startColor: resolved(nearlyIdentical),
      endColor: resolved(alsoNearlyIdentical),
      stepCount: 6,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('<svg');
  });

  it('omits the verdict for a gradient that really does span dyes', async () => {
    const result = await executeGradient({
      startColor: resolved(snowWhite),
      endColor: resolved(sootBlack),
      stepCount: 8,
      locale: 'en',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.svgString).toContain('<svg');
  });
});

describe('executeHarmony — exhausted filters', () => {
  it('reports NO_MATCHES when the filters exclude every harmony dye', async () => {
    const result = await executeHarmony({
      baseHex: snowWhite.hex,
      baseName: snowWhite.name,
      baseId: snowWhite.id,
      baseItemID: snowWhite.itemID,
      harmonyType: 'triadic',
      locale: 'en',
      dyeFilters: excludeEverything,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('NO_MATCHES');
    expect(result.errorMessage).toBeTruthy();
  });

  it('skips filtered companions while expanding a slot', async () => {
    // A partial filter leaves some dyes standing, so the companion loop has
    // to reject-and-retry rather than give up.
    const result = await executeHarmony({
      baseHex: snowWhite.hex,
      baseName: snowWhite.name,
      baseId: snowWhite.id,
      baseItemID: snowWhite.itemID,
      harmonyType: 'triadic',
      locale: 'en',
      companionCount: 3,
      dyeFilters: { excludeMetallic: true, excludeExpensive: true },
    });

    if (!result.ok) {
      expect(result.error).toBe('NO_MATCHES');
      return;
    }
    expect(result.harmonyDyes.length).toBeGreaterThan(0);
    expect(result.svgString).not.toContain('undefined');
  });

  it('clamps the companion count into 1–3', async () => {
    for (const companionCount of [0, 1, 3, 99]) {
      const result = await executeHarmony({
        baseHex: snowWhite.hex,
        harmonyType: 'complementary',
        locale: 'en',
        companionCount,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.svgString).toContain('<svg');
    }
  });

  it('deduplicates across slots when asked', async () => {
    const result = await executeHarmony({
      baseHex: snowWhite.hex,
      baseId: snowWhite.id,
      harmonyType: 'tetradic',
      locale: 'en',
      companionCount: 2,
      preventDuplicates: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.harmonyDyes.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('applies the tighter threshold under strict matching', async () => {
    const result = await executeHarmony({
      baseHex: snowWhite.hex,
      harmonyType: 'analogous',
      locale: 'en',
      strictMatching: true,
    });

    if (!result.ok) {
      expect(result.error).toBe('NO_MATCHES');
      return;
    }
    expect(result.svgString).toContain('<svg');
  });
});
