/**
 * Localized data-centre region labels.
 *
 * `public/json/data-centers.json` carries the region as the raw string the
 * game data uses (`Japan`, `North-America`, `Europe`, `Oceania`, `中国`,
 * `한국`), and the server pickers printed it verbatim in every locale. The
 * table below maps each shipped region onto a `marketBoard.region.*` key; the
 * keys are written out as literals so the orphan scanner (`npm run
 * i18n:unused`) can see each one.
 *
 * A region the table doesn't know renders as the raw string — a new data
 * centre must never blank the picker's group label.
 *
 * @module shared/region-name
 */

import { LanguageService } from '@services/language-service';

/** Region string (as shipped in `data-centers.json`) → locale key. */
const REGION_KEYS: Record<string, string> = {
  Japan: 'marketBoard.region.japan',
  'North-America': 'marketBoard.region.northAmerica',
  Europe: 'marketBoard.region.europe',
  Oceania: 'marketBoard.region.oceania',
  中国: 'marketBoard.region.china',
  한국: 'marketBoard.region.korea',
};

/** Localized label for a data-centre region, or the raw string when unknown. */
export function regionLabel(region: string): string {
  const key = REGION_KEYS[region];
  return key ? LanguageService.t(key) : region;
}
