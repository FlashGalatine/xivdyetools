/**
 * Band calibration — the algorithm behind the 5.0 band vocabulary.
 *
 * Port of the confirmed calibration study (`Band Calibration.dc.html`,
 * confirmed 2026-08-07): for each context boundary, choose the per-method
 * threshold that maximises tier agreement with ΔE2000's settled tiers over
 * every real dye pair, round it to the method's display precision, and
 * re-score on rounded values (the tier-on-the-displayed-value rule).
 * Quantile-matched thresholds are computed beside as a stability check.
 *
 * Corpora:
 * - MATCH / HARMONY calibrate on all real dye pairs.
 * - SEPARATION calibrates on the pooled lens corpus — normal + protanopia +
 *   deuteranopia + tritanopia + achromatopsia, Machado severity-1.0 matrices
 *   applied in linear RGB (achromatopsia as linear-luminance grey) — because
 *   separation verdicts print on simulated pairs.
 * - RATIO (WCAG contrast, not a distance) is calibrated anyway: against MATCH
 *   tiers for Comparison and SEPARATION tiers for Accessibility, with the
 *   Accessibility top band anchored at 3:1 (the 1.4.11 figure).
 *
 * The shipped numbers live in `band-vocabulary.ts`; the parity test recomputes
 * them through this module. Per the confirmed decision, the shipped numbers
 * come from core's own primitives (ColorConverter, ColorblindnessSimulator,
 * ColorAccessibility), not from the design page's inline copies.
 */

import type { VisionType } from '@xivdyetools/types';
import { ColorConverter } from '../services/color/ColorConverter.js';
import { ColorblindnessSimulator } from '../services/color/ColorblindnessSimulator.js';
import { ColorAccessibility } from '../services/color/ColorAccessibility.js';
import { BAND_METHOD_DP } from './band-vocabulary.js';

/** Methods calibrated against ΔE2000 (DISTINGUISH % derives from RGB DIST). */
export type CalibratedMethodId = 'oklab' | 'cie76' | 'redmean' | 'rgb';

export interface CalibratedMethodBands {
  /** Accuracy-optimal cuts, display-rounded, ordering enforced (ascending) */
  cuts: [number, number, number];
  /** Quantile-matched cuts (stability cross-check, not shipped) */
  quantile: [number, number, number];
  /** Tier agreement with ΔE2000 on display-rounded values (0-1) */
  agreement: number;
  /** Agreement of the quantile cuts (0-1) */
  quantileAgreement: number;
}

export interface RatioCalibration {
  cuts: [number, number, number];
  agreement: number;
}

export interface BandCalibrationResult {
  realPairCount: number;
  pooledPairCount: number;
  match: Record<CalibratedMethodId, CalibratedMethodBands>;
  harmony: Record<CalibratedMethodId, CalibratedMethodBands>;
  separation: Record<CalibratedMethodId, CalibratedMethodBands>;
  ratio: {
    comparison: RatioCalibration;
    accessibility: RatioCalibration;
    /** Accessibility cuts with the top band anchored at 3:1 (1.4.11) */
    accessibilityAnchored: RatioCalibration;
  };
}

/** ΔE2000 settled ground-truth boundaries (ascending) */
export const DE2000_GROUND_TRUTH = {
  match: [5, 10, 20],
  harmony: [6, 12, 20],
  separation: [8, 15, 30],
} as const;

const LENSES: readonly VisionType[] = ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];

interface PairRows {
  ciede2000: number[];
  oklab: number[];
  cie76: number[];
  redmean: number[];
  rgb: number[];
  ratio: number[];
}

function roundTo(value: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}

function tierOf(value: number, bands: readonly number[]): number {
  return value < bands[0] ? 0 : value < bands[1] ? 1 : value < bands[2] ? 2 : 3;
}

/**
 * Best threshold for a binary split (label true = "should read below the
 * cut"), evaluated on display-rounded midpoints. Verbatim port of the study's
 * `bestCut`, including its behaviour of never placing the cut below the
 * smallest observed value.
 */
function bestCut(vals: readonly number[], labels: readonly boolean[], dp: number): number {
  const idx = vals.map((_, i) => i).sort((x, y) => vals[x] - vals[y]);
  let negTotal = 0;
  for (const l of labels) if (!l) negTotal++;
  let below = 0;
  let negBelow = 0;
  let bestAgree = -1;
  let bestT = 0;
  for (let k = 0; k < idx.length; k++) {
    if (labels[idx[k]]) below++;
    else negBelow++;
    const v = vals[idx[k]];
    const next = k + 1 < idx.length ? vals[idx[k + 1]] : v + 1;
    if (next === v) continue;
    const agree = below + (negTotal - negBelow);
    if (agree > bestAgree) {
      bestAgree = agree;
      bestT = roundTo((v + next) / 2, dp);
    }
  }
  return bestT;
}

/** Quantile-matched threshold: cut where the positive count falls. */
function quantileCut(vals: readonly number[], labels: readonly boolean[], dp: number): number {
  let pos = 0;
  for (const l of labels) if (l) pos++;
  const sorted = [...vals].sort((a, b) => a - b);
  const i = Math.min(sorted.length - 1, Math.max(0, pos - 1));
  return roundTo((sorted[i] + sorted[Math.min(sorted.length - 1, i + 1)]) / 2, dp);
}

/** Fraction of pairs whose display-rounded tier matches the reference tier. */
function jointAgree(
  vals: readonly number[],
  refTiers: readonly number[],
  bands: readonly number[],
  dp: number,
): number {
  let ok = 0;
  for (let i = 0; i < vals.length; i++) {
    if (tierOf(roundTo(vals[i], dp), bands) === refTiers[i]) ok++;
  }
  return ok / vals.length;
}

function pairRows(hexes: readonly string[]): PairRows {
  const rows: PairRows = { ciede2000: [], oklab: [], cie76: [], redmean: [], rgb: [], ratio: [] };
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      const a = hexes[i];
      const b = hexes[j];
      rows.ciede2000.push(ColorConverter.getDeltaE(a, b, 'cie2000'));
      rows.oklab.push(ColorConverter.getDeltaE_Oklab(a, b));
      rows.cie76.push(ColorConverter.getDeltaE(a, b, 'cie76'));
      rows.redmean.push(ColorConverter.getRedmeanDistance(a, b));
      rows.rgb.push(ColorConverter.getColorDistance(a, b));
      rows.ratio.push(ColorAccessibility.getContrastRatio(a, b));
    }
  }
  return rows;
}

function calibrateContext(
  rows: PairRows,
  refBands: readonly number[],
): Record<CalibratedMethodId, CalibratedMethodBands> {
  const refTiers = rows.ciede2000.map((v) => tierOf(roundTo(v, 1), refBands));
  const result = {} as Record<CalibratedMethodId, CalibratedMethodBands>;
  for (const id of ['oklab', 'cie76', 'redmean', 'rgb'] as const) {
    const dp = BAND_METHOD_DP[id];
    const vals = rows[id];
    const cuts: number[] = [];
    const quantile: number[] = [];
    for (let k = 0; k < 3; k++) {
      const labels = refTiers.map((t) => t <= k);
      cuts.push(bestCut(vals, labels, dp));
      quantile.push(quantileCut(vals, labels, dp));
    }
    for (let k = 1; k < 3; k++) {
      if (cuts[k] < cuts[k - 1]) cuts[k] = cuts[k - 1];
      if (quantile[k] < quantile[k - 1]) quantile[k] = quantile[k - 1];
    }
    result[id] = {
      cuts: cuts as [number, number, number],
      quantile: quantile as [number, number, number],
      agreement: jointAgree(vals, refTiers, cuts, dp),
      quantileAgreement: jointAgree(vals, refTiers, quantile, dp),
    };
  }
  return result;
}

function calibrateRatio(rows: PairRows, refBands: readonly number[]): RatioCalibration {
  const refTiers = rows.ciede2000.map((v) => tierOf(roundTo(v, 1), refBands));
  const cuts: number[] = [];
  for (let k = 0; k < 3; k++) {
    cuts.push(
      bestCut(
        rows.ratio,
        refTiers.map((t) => t <= k),
        2,
      ),
    );
  }
  for (let k = 1; k < 3; k++) if (cuts[k] < cuts[k - 1]) cuts[k] = cuts[k - 1];
  return {
    cuts: cuts as [number, number, number],
    agreement: jointAgree(rows.ratio, refTiers, cuts, 2),
  };
}

/**
 * Run the full band calibration over a dye list (hex strings).
 *
 * Deterministic and pure; used by the parity test and the
 * `calibrate-bands` script that regenerates `band-vocabulary.ts`'s numbers.
 */
export function calibrateBandVocabulary(hexes: readonly string[]): BandCalibrationResult {
  const normal = pairRows(hexes);

  const pooled: PairRows = {
    ciede2000: [...normal.ciede2000],
    oklab: [...normal.oklab],
    cie76: [...normal.cie76],
    redmean: [...normal.redmean],
    rgb: [...normal.rgb],
    ratio: [...normal.ratio],
  };
  for (const lens of LENSES) {
    const simulated = hexes.map((hex) =>
      ColorblindnessSimulator.simulateColorblindnessMachadoHex(hex, lens),
    );
    const rows = pairRows(simulated);
    for (const key of Object.keys(pooled) as (keyof PairRows)[]) {
      pooled[key].push(...rows[key]);
    }
  }

  const accessibility = calibrateRatio(pooled, DE2000_GROUND_TRUTH.separation);
  const anchoredCuts = [accessibility.cuts[0], accessibility.cuts[1], 3.0].map((v, i, a) =>
    i > 0 && v < a[i - 1] ? a[i - 1] : v,
  ) as [number, number, number];
  const refTiersSep = pooled.ciede2000.map((v) =>
    tierOf(roundTo(v, 1), DE2000_GROUND_TRUTH.separation),
  );

  return {
    realPairCount: normal.ciede2000.length,
    pooledPairCount: pooled.ciede2000.length,
    match: calibrateContext(normal, DE2000_GROUND_TRUTH.match),
    harmony: calibrateContext(normal, DE2000_GROUND_TRUTH.harmony),
    separation: calibrateContext(pooled, DE2000_GROUND_TRUTH.separation),
    ratio: {
      comparison: calibrateRatio(normal, DE2000_GROUND_TRUTH.match),
      accessibility,
      accessibilityAnchored: {
        cuts: anchoredCuts,
        agreement: jointAgree(pooled.ratio, refTiersSep, anchoredCuts, 2),
      },
    },
  };
}
