/**
 * Presets OG image — the 15E band (5.0, net-new route).
 *
 * 8A already settled that the strip is a fixed proportional band — N dyes,
 * N equal bands — so the shape is inherited rather than chosen. No Δ,
 * because a palette has no target (the same reason 8A does not use the
 * Result Card). Preset names are not localised; the chrome around them is.
 *
 * @module services/svg/presets
 */

import { presetData } from '@xivdyetools/core';
import type { Dye, LocaleCode } from '@xivdyetools/types';
import { generateBandCard, type BandEntry, type BandFrame } from './band';
import { bandGlyph, notFoundBand } from './band-shared';
import { dyeService } from './dye-helpers';
import { getToolTag } from '../og-strings';
import { getLocalizedDyeName } from '../translator';

export interface PresetsOGOptions {
  /** Curated preset id (slug — the stored choice value) */
  presetId: string;
  /** Locale for dye name display */
  locale?: LocaleCode;
  /** 15E frame */
  frame?: BandFrame;
}

interface PresetPalette {
  id: string;
  name: string;
  category: string;
  dyes: number[];
}

/**
 * Generates the Presets OG image SVG (400-grid — raster ×3 downstream).
 */
export function generatePresetsOG(options: PresetsOGOptions): string {
  const { presetId, locale = 'en', frame = 'discord' } = options;

  const palettes = (presetData as { palettes: PresetPalette[] }).palettes;
  const preset = palettes.find((p) => p.id === presetId);
  if (!preset) {
    return notFoundBand(getToolTag('presets', locale), 'presets', presetId, 'presets', frame);
  }

  const dyes = preset.dyes
    .map((stainId) => dyeService.getByStainId(stainId))
    .filter((d): d is Dye => d !== null && d !== undefined);
  if (dyes.length === 0) {
    return notFoundBand(getToolTag('presets', locale), 'presets', presetId, 'presets', frame);
  }

  // Equal bands, whatever the count — the 8A strip inherited
  const bands: BandEntry[] = dyes.map((dye) => ({
    hex: dye.hex,
    name: getLocalizedDyeName(dye, locale),
    value: dye.hex.toUpperCase(),
    tag: `#${dye.stainID ?? dye.id}`,
    grow: 1,
  }));

  return generateBandCard({
    bands,
    toolTag: getToolTag('presets', locale),
    toolGlyph: bandGlyph('presets'),
    path: 'xivdyetools.app/presets',
    // The preset's name was the deck's whole job, so on X it moves to the
    // footer verbatim — preset names are never localised, so no key is needed.
    deck: preset.name,
    footRight: frame === 'x' ? `${preset.name} · CURATED` : 'CURATED',
    footRightFont: frame === 'x' ? 'body' : 'mono',
    frame,
  });
}
