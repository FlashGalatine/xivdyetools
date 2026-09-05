/**
 * The anti-drift gate for the committed OKLCH-hue table.
 *
 * `src/data/oklch-hue-table.json` is generated, not hand-written, so the one
 * thing worth pinning is that re-running the generator still produces exactly
 * what is checked in. Before the table was extracted, the module derived it at
 * import time and any "test" of the derivation compared it against itself.
 *
 * It lives beside the derivation rather than under `src/__tests__/` because
 * core's `tsconfig.json` sets `rootDir: ./src`, and a file under `src/` may not
 * import one outside it (TS6059).
 */

import { describe, it, expect } from 'vitest';
import { deriveOklchHueTable } from './oklch-hue-table.js';
import { OKLCH_HUE_TABLE } from '../../src/services/dye/wheels/oklch-hue.js';

describe('oklch-hue table', () => {
  it('matches the committed src/data/oklch-hue-table.json exactly', () => {
    expect(deriveOklchHueTable()).toEqual(OKLCH_HUE_TABLE);
  });

  it('pairs each OKLab hue with the HSV hue of the SAME 8-bit sample', () => {
    // The generator's second column is `hexToHsv(hsvToHex(h,100,100)).h`, not
    // the loop's nominal `h`. `hsvToHex` rounds to 8 bits, so for at least one
    // step those differ — which is the whole point of the fix.
    const nominal = new Set<number>();
    for (let h = 0; h < 360; h += 5) nominal.add(h);
    const measured = deriveOklchHueTable()
      .slice(1, -1)
      .map(([, hsv]) => hsv);
    expect(measured.some((h) => !nominal.has(h))).toBe(true);
  });
});
