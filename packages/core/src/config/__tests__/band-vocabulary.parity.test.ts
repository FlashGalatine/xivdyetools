/**
 * Band vocabulary parity test.
 *
 * Recomputes the full calibration (band-calibration.ts, the port of the
 * confirmed `Band Calibration.dc.html` study) from dyes.json and asserts the
 * shipped constants in band-vocabulary.ts match exactly. If dyes.json
 * changes, this fails until `scripts/calibrate-bands.ts` is re-run and the
 * shipped numbers (and any design-doc figures) are updated together.
 */

import { describe, it, expect } from 'vitest';
import dyes from '../../data/dyes.json' with { type: 'json' };
import { calibrateBandVocabulary, DE2000_GROUND_TRUTH } from '../band-calibration.js';
import {
  BAND_VOCABULARY,
  RATIO_BANDS,
  classifyBandTier,
  classifyBandTierWithCuts,
  deriveDistinguishCuts,
  roundToBandDisplay,
} from '../band-vocabulary.js';

describe('band vocabulary parity with the calibration algorithm', () => {
  const hexes = (dyes as Array<{ hex: string; category: string }>)
    .filter((d) => d.category !== 'Facewear')
    .map((d) => d.hex);

  it(
    'shipped cuts equal a fresh calibration over dyes.json',
    { timeout: 180_000 },
    () => {
      const result = calibrateBandVocabulary(hexes);

      // Corpus shape from the confirmed study
      expect(result.realPairCount).toBe(7750);
      expect(result.pooledPairCount).toBe(38750);

      for (const context of ['match', 'harmony', 'separation'] as const) {
        for (const method of ['oklab', 'cie76', 'redmean', 'rgb'] as const) {
          expect(
            BAND_VOCABULARY[context][method].cuts,
            `${context}.${method}`
          ).toEqual(result[context][method].cuts);
        }
        // ΔE2000 rows are the settled ground truth, not calibrated
        expect(BAND_VOCABULARY[context].ciede2000.cuts).toEqual([
          ...DE2000_GROUND_TRUTH[context],
        ]);
        // DISTINGUISH % derives exactly from RGB DIST
        expect(BAND_VOCABULARY[context].distinguish.cuts).toEqual(
          deriveDistinguishCuts(BAND_VOCABULARY[context].rgb.cuts)
        );
      }

      expect(RATIO_BANDS.comparison.cuts).toEqual(result.ratio.comparison.cuts);
      expect(RATIO_BANDS.accessibility.cuts).toEqual(
        result.ratio.accessibilityAnchored.cuts
      );
    }
  );
});

describe('classifyBandTier', () => {
  it('scores on the display-rounded value (tier-on-displayed-value rule)', () => {
    // MATCH ΔE2000 first cut is 5 (dp 1): 4.96 rounds to 5.0 → tier 1, not 0
    expect(classifyBandTier(4.96, 'ciede2000', 'match')).toBe(1);
    expect(classifyBandTier(4.94, 'ciede2000', 'match')).toBe(0);
  });

  it('classifies each boundary ascending', () => {
    expect(classifyBandTier(0, 'ciede2000', 'match')).toBe(0);
    expect(classifyBandTier(7, 'ciede2000', 'match')).toBe(1);
    expect(classifyBandTier(15, 'ciede2000', 'match')).toBe(2);
    expect(classifyBandTier(25, 'ciede2000', 'match')).toBe(3);
  });

  it('supports moved ΔE2000 cuts for the user match line', () => {
    // Only ΔE2000's MATCH bands follow the user's slider
    expect(classifyBandTierWithCuts(7, [8, 16, 32], 1)).toBe(0);
    expect(classifyBandTierWithCuts(7, [5, 10, 20], 1)).toBe(1);
  });

  it('deltaEOK classifies in its raw unit at dp 3', () => {
    // The point is the DISPLAY rounding, not the specific cut: a value below
    // the first cut but which rounds UP onto it at dp 3 must land in tier 1.
    // (The example cut moved 0.017 -> 0.033 in 5.1.0 when getDeltaE_Oklab
    // became deltaEOK2 and the oklab bands were recalibrated.)
    expect(classifyBandTier(0.0324, 'oklab', 'match')).toBe(0);
    // 0.0329 display-rounds to 0.033 = the first cut -> tier 1, not 0
    expect(classifyBandTier(0.0329, 'oklab', 'match')).toBe(1);
    expect(classifyBandTier(0.0331, 'oklab', 'match')).toBe(1);
  });

  it('rounds to method display precision', () => {
    expect(roundToBandDisplay(0.12345, 'oklab')).toBe(0.123);
    expect(roundToBandDisplay(12.34, 'cie76')).toBe(12.3);
    expect(roundToBandDisplay(12.6, 'distinguish')).toBe(13);
  });
});
