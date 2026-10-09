/**
 * Gradient OG image — the 15E band (5.0).
 *
 * A gradient is already a band — the shape needs no argument. The one
 * decision: the bands are the MATCHED DYES, not the interpolation, because
 * the interpolation is not something anyone can buy. Endpoints are the dyes
 * themselves (START/END + stain tag); each middle band is the nearest real
 * dye to its interpolated step that no earlier step has taken, tagged with the
 * Δ to that step.
 *
 * Every band is a step the Gradient Builder shows for the same share (BUG-008 /
 * BUG-009, 2026-10-04 deep dive). The card first resolves the page's whole
 * ramp at the shared step count n: step i sits at t = i / (n − 1) in the
 * page's interpolation mode (not a space derived from `?algo=`), the requested
 * algorithm ranks its candidates, and the page's dedupe runs over every middle
 * step in order. Only then does it choose what to draw: every step up to
 * BAND_CAP; beyond that, the endpoints plus BAND_CAP − 2 page steps spaced
 * evenly along the ramp, each labeled with the page's own step number. It
 * assumes the page's defaults for the two settings no share carries: duplicate
 * prevention on, no dye filters.
 *
 * @module services/svg/gradient
 */

import { ColorService, DEFAULT_MATCHING_METHOD, normalizeMatchingMethod } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, BAND_CAP, type BandEntry, type BandFrame } from './band';
import { algoTag, bandGlyph, fmtDelta, notFoundBand } from './band-shared';
import { dyeService, getDyeByItemId, deltaForAlgorithm } from './dye-helpers';
import { role, getToolTag } from '../og-strings';
import { getLocalizedDyeName } from '../translator';
import type { MatchingAlgorithm } from '../../types';

/**
 * The Gradient Builder's five interpolation modes — its share URL's
 * `interpolation=` vocabulary (web-app `InterpolationMode`).
 */
export type GradientInterpolation = 'rgb' | 'hsv' | 'lab' | 'oklch' | 'lch';

export interface GradientOGOptions {
  /** Start dye stainID (param name kept for call-site stability) */
  startDyeId: number;
  /** End dye stainID */
  endDyeId: number;
  /** The share's step count (including start and end) — the page's ramp length */
  steps: number;
  /** Matching algorithm — ranks each middle step's candidates and measures its Δ */
  algorithm?: MatchingAlgorithm;
  /**
   * The color space the ramp runs in — the share's `interpolation=`. Defaults
   * to `hsv`, the Gradient Builder's default; an unknown mode falls back to it.
   */
  interpolation?: GradientInterpolation;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/*
 * The ramp below mirrors the Gradient Builder's `interpolateInSpace` and its
 * powerless-hue rule (apps/web-app/src/components/gradient-tool.ts), which the
 * bot's /gradient also copies (packages/bot-logic/src/commands/gradient.ts) —
 * this is the third copy, because core has no shared helper for it: core's
 * `interpolateHue` has no gray rule and `blendColors`' powerless hue covers HSL
 * only. The arithmetic is kept operation for operation (per-channel rounding
 * in rgb, `hexToLab`/`labToHex` in lab, the same hue-wrap expression), since a
 * reordered float sum can round a step to a different hex and so a different
 * dye. gradient.test.ts pins the result against the page's own output.
 */

/**
 * Below these chromas an OKLCH / LCH endpoint is gray, and its hue is a
 * placeholder (core reports ~158 for an exact gray in LCH — float noise in a
 * and b). The page's values: exactly the r = g = b colors count as gray, the
 * set HSV marks with s === 0.
 */
const OKLCH_GREY_CHROMA = 1e-4;
const LCH_GREY_CHROMA = 0.01;

/**
 * The hue at `t` along the shorter arc, with CSS Color 4's "powerless hue"
 * rule: a gray endpoint takes the other side's hue, so a gray → blue ramp
 * stays blue rather than swinging through whatever lies between hue 0 and
 * blue. Both sides gray keeps each one's own (the ramp has no chroma).
 */
function interpolateHue(
  startHue: number,
  endHue: number,
  startIsGrey: boolean,
  endIsGrey: boolean,
  t: number
): number {
  const from = startIsGrey && !endIsGrey ? endHue : startHue;
  const to = endIsGrey && !startIsGrey ? startHue : endHue;
  let hueDiff = to - from;
  if (hueDiff > 180) hueDiff -= 360;
  if (hueDiff < -180) hueDiff += 360;
  return (from + hueDiff * t + 360) % 360;
}

/** One HSV step — the `hsv` mode, and the fallback for an unknown one. */
function interpolateHsv(startHex: string, endHex: string, t: number): string {
  const startHsv = ColorService.hexToHsv(startHex);
  const endHsv = ColorService.hexToHsv(endHex);
  // From integer RGB, s is exactly 0 when r = g = b
  const h = interpolateHue(startHsv.h, endHsv.h, startHsv.s === 0, endHsv.s === 0, t);
  const s = startHsv.s + (endHsv.s - startHsv.s) * t;
  const v = startHsv.v + (endHsv.v - startHsv.v) * t;
  return ColorService.hsvToHex(h, s, v);
}

/** Interpolate between two hexes at `t` in the page's interpolation mode. */
function interpolate(startHex: string, endHex: string, t: number, mode: GradientInterpolation): string {
  switch (mode) {
    case 'rgb': {
      const startRgb = ColorService.hexToRgb(startHex);
      const endRgb = ColorService.hexToRgb(endHex);
      const r = Math.round(startRgb.r + (endRgb.r - startRgb.r) * t);
      const g = Math.round(startRgb.g + (endRgb.g - startRgb.g) * t);
      const b = Math.round(startRgb.b + (endRgb.b - startRgb.b) * t);
      return ColorService.rgbToHex(r, g, b);
    }
    case 'lab': {
      const startLab = ColorService.hexToLab(startHex);
      const endLab = ColorService.hexToLab(endHex);
      const L = startLab.L + (endLab.L - startLab.L) * t;
      const a = startLab.a + (endLab.a - startLab.a) * t;
      const b = startLab.b + (endLab.b - startLab.b) * t;
      return ColorService.labToHex(L, a, b);
    }
    case 'oklch': {
      const startOklch = ColorService.hexToOklch(startHex);
      const endOklch = ColorService.hexToOklch(endHex);
      const L = startOklch.L + (endOklch.L - startOklch.L) * t;
      const C = startOklch.C + (endOklch.C - startOklch.C) * t;
      const h = interpolateHue(
        startOklch.h,
        endOklch.h,
        startOklch.C < OKLCH_GREY_CHROMA,
        endOklch.C < OKLCH_GREY_CHROMA,
        t
      );
      return ColorService.oklchToHex(L, C, h);
    }
    case 'lch': {
      const startLch = ColorService.hexToLch(startHex);
      const endLch = ColorService.hexToLch(endHex);
      const L = startLch.L + (endLch.L - startLch.L) * t;
      const C = startLch.C + (endLch.C - startLch.C) * t;
      const h = interpolateHue(
        startLch.h,
        endLch.h,
        startLch.C < LCH_GREY_CHROMA,
        endLch.C < LCH_GREY_CHROMA,
        t
      );
      return ColorService.lchToHex(L, C, h);
    }
    default:
      // 'hsv', and anything the type does not know: the page ignores an
      // unknown mode and keeps its hsv default, so the card does the same
      return interpolateHsv(startHex, endHex, t);
  }
}

/**
 * The middle steps a ramp of `n` steps draws, as page indices (0 is START,
 * n − 1 is END). Up to BAND_CAP that is every one; beyond it, BAND_CAP − 2 of
 * them at round(k · (n − 1) / (BAND_CAP − 1)) for k = 1 … BAND_CAP − 2 — the
 * evenly spaced points, rounded half up (`Math.round`). With BAND_CAP at 5 the
 * quotients are exact quarters, so no float lands beside a tie, and for every
 * n the route allows past it (6–20) the three are distinct and inside
 * 1 … n − 2 (gradient.test.ts lists them).
 */
function drawnSteps(n: number): number[] {
  if (n <= BAND_CAP) return Array.from({ length: n - 2 }, (_, k) => k + 1);
  return Array.from({ length: BAND_CAP - 2 }, (_, k) =>
    Math.round(((k + 1) * (n - 1)) / (BAND_CAP - 1))
  );
}

/**
 * Generates the Gradient OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateGradientOG(options: GradientOGOptions): string {
  const { startDyeId, endDyeId, interpolation = 'hsv', locale = 'en', frame = 'discord' } = options;
  // BUG-009: the image route forwards `?algo=` raw, legacy spellings included
  // (`euclidean`, `hyab`, `oklch-weighted`) — normalize once, so the ranking,
  // the Δ and the footer all read the method that actually runs.
  const algorithm = normalizeMatchingMethod(options.algorithm ?? DEFAULT_MATCHING_METHOD);

  const startDye = getDyeByItemId(startDyeId);
  const endDye = getDyeByItemId(endDyeId);
  if (!startDye || !endDye) {
    return notFoundBand(
      getToolTag('gradient', locale),
      'gradient',
      `#${startDyeId} → #${endDyeId}`,
      'gradient',
      frame,
      locale
    );
  }

  // The page's whole ramp, every middle step in order, before choosing which
  // to draw: the dedupe is a chain, so a step the card leaves out can still
  // decide the dye a drawn step lands on.
  const n = Math.max(2, options.steps);
  const endpointIds = [startDye.id, endDye.id];
  const taken = new Set<number>(endpointIds);
  const ramp = new Map<number, { ideal: string; dye: Dye }>();

  for (let i = 1; i < n - 1; i++) {
    const ideal = interpolate(startDye.hex, endDye.hex, i / (n - 1), interpolation);
    // The page's own search, call for call: core's findClosestDye with the
    // requested method (k-d tree for rgb, unrounded distinguish), endpoints
    // excluded; a dye an earlier step already took is re-searched with the taken
    // dyes excluded — the Gradient Builder's default duplicate prevention.
    let best: Dye | null = dyeService.findClosestDye(ideal, {
      excludeIds: endpointIds,
      matchingMethod: algorithm,
    });
    if (best && taken.has(best.id)) {
      best =
        dyeService.findClosestDye(ideal, { excludeIds: [...taken], matchingMethod: algorithm }) ??
        best;
    }
    if (best) {
      taken.add(best.id);
      ramp.set(i, { ideal, dye: best });
    }
  }

  const endpoint = (dye: Dye, which: 'start' | 'end'): BandEntry => ({
    hex: dye.hex,
    role: role(which, locale),
    name: getLocalizedDyeName(dye, locale),
    value: dye.hex.toUpperCase(),
    tag: `#${dye.stainID ?? dye.id}`,
  });
  const bands: BandEntry[] = [endpoint(startDye, 'start')];
  for (const i of drawnSteps(n)) {
    const step = ramp.get(i);
    if (!step) continue;
    bands.push({
      hex: step.dye.hex,
      // The page's step number: it counts from 1, START included
      role: String(i + 1),
      name: getLocalizedDyeName(step.dye, locale),
      value: step.dye.hex.toUpperCase(),
      tag: `Δ${fmtDelta(deltaForAlgorithm(step.ideal, step.dye.hex, algorithm), algorithm)}`,
    });
  }
  bands.push(endpoint(endDye, 'end'));

  const startName = getLocalizedDyeName(startDye, locale);
  const endName = getLocalizedDyeName(endDye, locale);

  return generateBandCard({
    bands,
    toolTag: getToolTag('gradient', locale),
    toolGlyph: bandGlyph('gradient'),
    path: 'xivdyetools.app/gradient',
    // The cleanest degrade of the nine: the headline is the endpoints, and
    // START and END keep them named in-band, so nothing moves on X.
    deck: `${startName} → ${endName}`,
    footRight: algoTag(algorithm),
    frame,
  });
}
