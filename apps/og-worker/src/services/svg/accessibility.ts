/**
 * Accessibility OG image — the 15E band (5.0).
 *
 * The band body is the dye AS PERCEIVED (through the lens); the 52px strip
 * above it is the dye as designed — the one structural variant the shape
 * needs, shared with Extractor and Mixer. Δ is the shift the lens
 * introduces, not a distance between dyes; no WCAG percentage rides the
 * picture (no criterion measures whether two colours are tellable apart).
 *
 * @module services/svg/accessibility
 */

import { ColorService } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, type BandEntry, type BandFrame } from './band';
import { bandGlyph, notFoundBand } from './band-shared';
import { getDyeByItemId } from './dye-helpers';
import { getLocalizedDyeName } from '../translator';
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
    return notFoundBand('A11Y', 'accessibility', options.dyeIds.join(' · '), 'accessibility', frame);
  }

  const lens = LENS_SHORT[visionType] ?? visionType.toUpperCase();
  const bands: BandEntry[] = dyes.map((dye) => {
    const simulated =
      visionType === 'normal'
        ? dye.hex
        : ColorService.simulateColorblindnessHex(dye.hex, visionType);
    const shift = ColorService.getDistanceForMethod(dye.hex, simulated, 'ciede2000');
    return {
      hex: simulated,
      role: 'AS DESIGNED',
      name: getLocalizedDyeName(dye, locale),
      value: dye.hex.toUpperCase(),
      tag: `Δ${shift.toFixed(1)}`,
      src: { hex: dye.hex, height: DESIGNED_STRIP_H },
    };
  });

  return generateBandCard({
    bands,
    toolTag: 'A11Y',
    toolGlyph: bandGlyph('accessibility'),
    subLine: `${lens} · ΔE2000`,
    bandLine: `${lens} · ${dyes.length}`,
    urlLine: `xivdyetools.app/accessibility?vision=${visionType} · ΔE2000`,
    frame,
  });
}
