/**
 * REFACTOR-003 (2026-07-18 audit): regression test asserting that the
 * k-d-tree-assisted findClosestDye returns the same winner as a brute-force
 * linear scan for every matching method across a sampled color grid.
 *
 * The k-d tree pre-filters perceptual candidates by an RGB-space radius
 * (CANDIDATE_RADIUS_BY_METHOD) with a boundary-safety fallback — this test is
 * what makes that construction auditable instead of asserted in a comment.
 */

import { describe, it, expect } from 'vitest';
import { DyeService } from '../DyeService.js';
import { ColorConverter } from '../color/ColorConverter.js';
import dyeDatabase from '../../data/colors_xiv.json';
import type { MatchingMethod, OklchWeights } from '../../types/index.js';
import type { Dye } from '@xivdyetools/types';

const METHODS: MatchingMethod[] = ['rgb', 'cie76', 'ciede2000', 'oklab', 'hyab', 'oklch-weighted'];

// The matchHue preset deliberately tolerates large lightness (≈RGB) gaps —
// the hardest case for an RGB-space pre-filter
const HUE_WEIGHTS: OklchWeights = { kL: 0.5, kC: 1.0, kH: 1.5 };

function bruteForceDistance(
  hex1: string,
  hex2: string,
  method: MatchingMethod,
  weights?: OklchWeights
): number {
  switch (method) {
    case 'rgb':
      return ColorConverter.getColorDistance(hex1, hex2);
    case 'cie76':
      return ColorConverter.getDeltaE(hex1, hex2, 'cie76');
    case 'ciede2000':
      return ColorConverter.getDeltaE(hex1, hex2, 'cie2000');
    case 'oklab':
      return ColorConverter.getDeltaE_Oklab(hex1, hex2);
    case 'hyab':
      return ColorConverter.getDeltaE_HyAB(hex1, hex2);
    case 'oklch-weighted':
      return ColorConverter.getDeltaE_OklchWeighted(hex1, hex2, weights);
  }
}

function bruteForceClosest(
  dyes: Dye[],
  hex: string,
  method: MatchingMethod,
  weights?: OklchWeights
): { dye: Dye; distance: number } | null {
  let best: { dye: Dye; distance: number } | null = null;
  for (const dye of dyes) {
    if (dye.category === 'Facewear') continue;
    const distance = bruteForceDistance(hex, dye.hex, method, weights);
    if (!best || distance < best.distance) {
      best = { dye, distance };
    }
  }
  return best;
}

describe('DyeSearch k-d tree / brute-force parity (REFACTOR-003)', () => {
  const dyeService = new DyeService(dyeDatabase);
  const allDyes = dyeService.getAllDyes();

  // 4×4×4 RGB grid plus grays and saturated corners = broad coverage without
  // making the suite slow
  const sampleHexes: string[] = [];
  for (let r = 0; r <= 255; r += 85) {
    for (let g = 0; g <= 255; g += 85) {
      for (let b = 0; b <= 255; b += 85) {
        sampleHexes.push(ColorConverter.rgbToHex(r, g, b));
      }
    }
  }
  sampleHexes.push('#808080', '#7F7F80', '#123456', '#FEDCBA');

  for (const method of METHODS) {
    it(`returns the brute-force winner for every sampled color (${method})`, () => {
      const weights = method === 'oklch-weighted' ? HUE_WEIGHTS : undefined;

      for (const hex of sampleHexes) {
        const expected = bruteForceClosest(allDyes, hex, method, weights);
        const actual = dyeService.findClosestDye(hex, {
          matchingMethod: method,
          weights,
        });

        expect(actual, `no result for ${hex} (${method})`).not.toBeNull();
        // Compare by distance, not identity — ties between equidistant dyes
        // are acceptable either way
        const actualDistance = bruteForceDistance(hex, actual!.hex, method, weights);
        expect(
          actualDistance,
          `${hex} (${method}): got ${actual!.name} @ ${actualDistance}, brute force found ${expected!.dye.name} @ ${expected!.distance}`
        ).toBeLessThanOrEqual(expected!.distance + 1e-9);
      }
    });
  }
});
