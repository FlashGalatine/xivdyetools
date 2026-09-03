/**
 * notFoundBand input hardening (FINDING-005 / OG-1, 2026-08-21 audit).
 *
 * The not-found card echoes the caller's input as its title. That input used
 * to flow, uncapped, into `wrapName`, whose hyphenation loop re-measured the
 * remaining word on every decrement — cubic in the input length — so a single
 * 16 KB URL segment burned seconds-to-minutes of CPU. The card must (a) cap
 * the echoed label and (b) wrap in linear time regardless of input.
 */
import { describe, it, expect } from 'vitest';
import { notFoundBand } from './band-shared.js';
import { DEFAULT_MATCHING_METHOD } from '@xivdyetools/core';
import { generateHarmonyOG } from './harmony';
import { generateSwatchOG } from './swatch';
import { generateGradientOG } from './gradient';
import { generateMixerOG } from './mixer';
import { dyeService } from './dye-helpers';

const allDyes = dyeService.getAllDyes();
const sid = allDyes[0].stainID ?? allDyes[0].id;
const sid2 = allDyes[5].stainID ?? allDyes[5].id;
/** See comparison.test.ts — the clip-path counter is cosmetic, not content. */
const normalizeMarkUid = (svg: string): string => svg.replace(/ogm\d+/g, 'ogmX');

describe('notFoundBand', () => {
  it('echoes a normal label unchanged', () => {
    const svg = notFoundBand('Swatch', 'swatch', '#GGGGGG', 'swatch');
    expect(svg).toContain('#GGGGGG');
  });

  it('caps a pathological label and renders in linear time', () => {
    const junk = 'X'.repeat(16 * 1024);
    const started = Date.now();
    const svg = notFoundBand('Swatch', 'swatch', junk, 'swatch');
    const elapsed = Date.now() - started;

    // cubic wrapping on 16 K chars takes tens of seconds; linear is milliseconds
    expect(elapsed).toBeLessThan(2000);
    // the raw 16 K string must not be in the card at all
    expect(svg).not.toContain(junk);
    // the echoed label is clipped to a short prefix (32 chars + ellipsis)
    expect(svg).toContain(`${'X'.repeat(32)}…`);
  });

  it('caps an over-long CJK label as well', () => {
    const junk = '彩'.repeat(8 * 1024);
    const started = Date.now();
    const svg = notFoundBand('Swatch', 'swatch', junk, 'swatch');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(svg).not.toContain(junk);
  });
});


// ---------------------------------------------------------------------------
// og-12 (deep dive 2026-09-02): five adapters defaulted `algorithm` to
// `'oklab'` while every route passes `DEFAULT_MATCHING_METHOD` explicitly. Only
// TESTS ever saw the default, so the suite measured every card with a method
// production never used — the one place a wrong default is invisible.
// ---------------------------------------------------------------------------
describe('og-12: an omitted algorithm is the suite default, not a second one', () => {
  it('every adapter renders the same card with the algorithm omitted as with the default named', () => {
    const cases: Array<[string, string, string]> = [
      ['harmony', generateHarmonyOG({ dyeId: sid, harmonyType: 'tetradic' }),
        generateHarmonyOG({ dyeId: sid, harmonyType: 'tetradic', algorithm: DEFAULT_MATCHING_METHOD })],
      ['swatch', generateSwatchOG({ color: '7A6B4F', limit: 4 }),
        generateSwatchOG({ color: '7A6B4F', limit: 4, algorithm: DEFAULT_MATCHING_METHOD })],
      ['gradient', generateGradientOG({ startDyeId: sid, endDyeId: sid2, steps: 5 }),
        generateGradientOG({ startDyeId: sid, endDyeId: sid2, steps: 5, algorithm: DEFAULT_MATCHING_METHOD })],
      ['mixer', generateMixerOG({ dyeAId: sid, dyeBId: sid2, ratio: 50 }),
        generateMixerOG({ dyeAId: sid, dyeBId: sid2, ratio: 50, algorithm: DEFAULT_MATCHING_METHOD })],
    ];
    for (const [name, omitted, explicit] of cases) {
      expect(normalizeMarkUid(omitted), name).toBe(normalizeMarkUid(explicit));
    }
  });

  it('…and that default is not oklab, which is what the omitted case used to render', () => {
    const omitted = generateSwatchOG({ color: '7A6B4F', limit: 4 });
    const oklab = generateSwatchOG({ color: '7A6B4F', limit: 4, algorithm: 'oklab' });
    expect(normalizeMarkUid(omitted)).not.toBe(normalizeMarkUid(oklab));
    expect(omitted).toContain('ΔE2000');
  });
});
