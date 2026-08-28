/**
 * Accessibility OG image — the 15E band (5.0).
 *
 * The band body is the dye AS PERCEIVED (through the lens); the 52px strip
 * above it is the dye as designed (×0.66 on the shorter X field — the strip
 * keeps its proportion, not its absolute height) — the one structural variant
 * the shape needs, shared with Extractor and Mixer. Δ is the shift the lens
 * introduces, not a distance between dyes; no WCAG percentage rides the
 * picture (no criterion measures whether two colours are tellable apart).
 *
 * @module services/svg/accessibility
 */

import { ColorService } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, xStrip, type BandEntry, type BandFrame } from './band';
import { bandGlyph, notFoundBand } from './band-shared';
import { getDyeByItemId } from './dye-helpers';
import { role, deckLine, getToolTag } from '../og-strings';
import { getLocalizedDyeName, getLocalizedVisionName } from '../translator';
import type { VisionType } from '../../types';

export interface AccessibilityOGOptions {
  /** Array of dye stainIDs (1-4; param name kept for call-site stability) */
  dyeIds: number[];
  /** Vision type to simulate */
  visionType?: VisionType;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

/** The as-designed strip height (the drawn structural-variant size here). */
const DESIGNED_STRIP_H = 52;

/** Lens short codes — untranslated identifiers, the suite's vocabulary. */
const LENS_SHORT: Record<string, string> = {
  normal: 'NORM',
  protanopia: 'PROT',
  deuteranopia: 'DEUT',
  tritanopia: 'TRIT',
  achromatopsia: 'ACHR',
};

/**
 * Generates the Accessibility OG image SVG (400-grid — raster ×3 downstream).
 */
export function generateAccessibilityOG(options: AccessibilityOGOptions): string {
  const { visionType = 'deuteranopia', locale = 'en', frame = 'discord' } = options;

  const dyes = options.dyeIds
    .slice(0, 4)
    .map((id) => getDyeByItemId(id))
    .filter((d): d is Dye => d !== undefined);
  if (dyes.length === 0) {
    return notFoundBand(
      getToolTag('accessibility', locale),
      'accessibility',
      options.dyeIds.join(' · '),
      'accessibility',
      frame,
      locale
    );
  }

  const lens = LENS_SHORT[visionType] ?? visionType.toUpperCase();
  // The lens is the one thing the deck says that nothing else does, so it is
  // what moves to the footer on X — from the same locale key the embed uses.
  const lensName = getLocalizedVisionName(visionType, locale);
  const stripH = frame === 'x' ? xStrip(DESIGNED_STRIP_H) : DESIGNED_STRIP_H;

  const bands: BandEntry[] = dyes.map((dye) => {
    const simulated =
      visionType === 'normal'
        ? dye.hex
        : ColorService.simulateColorblindnessHex(dye.hex, visionType);
    const shift = ColorService.getDistanceForMethod(dye.hex, simulated, 'ciede2000');
    return {
      hex: simulated,
      role: role('asDesigned', locale),
      name: getLocalizedDyeName(dye, locale),
      value: dye.hex.toUpperCase(),
      tag: `Δ${shift.toFixed(1)}`,
      src: { hex: dye.hex, height: stripH },
    };
  });

  return generateBandCard({
    bands,
    toolTag: getToolTag('accessibility', locale),
    toolGlyph: bandGlyph('accessibility'),
    path: 'xivdyetools.app/accessibility',
    deck: `${lensName} · ${deckLine('a11yDyeCount', locale, { n: dyes.length })}`,
    footRight: frame === 'x' ? lens : 'ΔE2000',
    frame,
  });
}
