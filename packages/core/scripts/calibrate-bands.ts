/**
 * Recompute the 5.0 band vocabulary from dyes.json.
 *
 * Prints the calibration result as JSON. The shipped constants in
 * `src/config/band-vocabulary.ts` are pasted from this output; the parity
 * test (`band-vocabulary.parity.test.ts`) recomputes and compares, so a
 * dyes.json change that shifts a cut fails loudly until this is re-run and
 * the constants (and any design-doc figures) are updated together.
 *
 * Usage: pnpm --filter @xivdyetools/core exec tsx scripts/calibrate-bands.ts
 */

import dyes from '../src/data/dyes.json' with { type: 'json' };
import { calibrateBandVocabulary } from '../src/config/band-calibration.js';

const hexes = (dyes as Array<{ hex: string; category: string }>)
  .filter((d) => d.category !== 'Facewear')
  .map((d) => d.hex);

const result = calibrateBandVocabulary(hexes);
console.log(JSON.stringify(result, null, 2));
