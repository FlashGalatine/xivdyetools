/**
 * Gradient OG tests — the 15E band adapter.
 */
import { describe, it, expect } from 'vitest';
import { generateGradientOG, type GradientInterpolation } from './gradient';
import { BAND_CAP } from './band';
import { BAND_METHOD_DP, ColorService, normalizeMatchingMethod } from '@xivdyetools/core';
import { dyeService, getDyeByItemId } from './dye-helpers';
import { algoTag } from './band-shared';
import type { MatchingAlgorithm } from '../../types';

const dyes = dyeService.getAllDyes();
const sid = (i: number): number => dyes[i].stainID ?? dyes[i].id;

/** Every hex the card prints, in band order (each band's value line). */
const bandHexes = (svg: string): string[] =>
  [...svg.matchAll(/>(#[0-9A-F]{6})</g)].map((m) => m[1]);
/** The middle bands' printed hexes — the matched dyes. */
const middleHexes = (svg: string): string[] => bandHexes(svg).slice(1, -1);
/** The middle bands' Δ tags, as printed. */
const deltaTags = (svg: string): string[] =>
  [...svg.matchAll(/Δ(\d+(?:\.\d+)?)</g)].map((m) => m[1]);
/** The middle bands' role lines — the page's step numbers (the only all-digit text). */
const stepLabels = (svg: string): string[] =>
  [...svg.matchAll(/<text[^>]*>(\d+)<\/text>/g)].map((m) => m[1]);

/** The card with its per-render mark clip id (`ogm<n>`) folded, so two renders compare. */
const stable = (svg: string): string => svg.replace(/ogm\d+/g, 'ogm');

/**
 * What the card must print for steps whose ideals are `ideals` and whose dyes
 * are `dyesHex`. Computed the way the Gradient Builder's rail does
 * (gradient-tool.ts: `ColorService.getDistanceForMethod(step, dye, method)
 * .toFixed(BAND_METHOD_DP[method])`), straight from core and NOT through the
 * card's own deltaForAlgorithm / fmtDelta, so a wrong metric or decimal count
 * in those helpers fails here instead of agreeing with itself.
 */
const expectedDeltas = (ideals: string[], dyesHex: string[], algorithm: MatchingAlgorithm): string[] => {
  const method = normalizeMatchingMethod(algorithm);
  return ideals.map((ideal, i) =>
    ColorService.getDistanceForMethod(ideal, dyesHex[i], method).toFixed(BAND_METHOD_DP[method]),
  );
};

describe('generateGradientOG (15E band)', () => {
  it('renders endpoints as the dyes themselves and middles as matched dyes', () => {
    const svg = generateGradientOG({ startDyeId: sid(0), endDyeId: sid(10), steps: 5 });
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="350"');
    expect(svg).toContain('START');
    expect(svg).toContain('END');
    // Middle bands are tagged with the Δ to their interpolated step
    expect(svg).toMatch(/Δ\d+\.\d/);
    expect(svg).toContain('GRADIENT');
  });

  it('a ramp longer than the band cap still draws BAND_CAP bands', () => {
    const svg = generateGradientOG({ startDyeId: sid(0), endDyeId: sid(10), steps: 12 });
    expect(svg).toContain('height="350"');
    expect(bandHexes(svg)).toHaveLength(BAND_CAP);
  });

  it('the X frame carries the endpoints line', () => {
    const svg = generateGradientOG({ startDyeId: sid(0), endDyeId: sid(10), steps: 4, frame: 'x' });
    expect(svg).toContain('height="210"');
    expect(svg).toContain('xivdyetools.app/gradient');
  });

  it('an unknown dye renders the neutral state, never throws', () => {
    const svg = generateGradientOG({ startDyeId: 999999, endDyeId: sid(1), steps: 4 });
    expect(svg).toContain('NOT FOUND');
  });
});

/**
 * The page steps the card draws past BAND_CAP, by page index (0 = START,
 * n − 1 = END), for every step count the image route accepts: the middles at
 * round(k·(n − 1) / 4), k = 1…3, rounded half up. Written out rather than
 * derived, so a change to the card's rounding fails here instead of agreeing
 * with itself. Up to BAND_CAP the card draws every step.
 */
const SHOWN_STEPS: Readonly<Record<number, readonly number[]>> = {
  6: [1, 3, 4],
  7: [2, 3, 5],
  8: [2, 4, 5],
  9: [2, 4, 6],
  10: [2, 5, 7],
  11: [3, 5, 8],
  12: [3, 6, 8],
  13: [3, 6, 9],
  14: [3, 7, 10],
  15: [4, 7, 11],
  16: [4, 8, 11],
  17: [4, 8, 12],
  18: [4, 9, 13],
  19: [5, 9, 14],
  20: [5, 10, 14],
};
const shownSteps = (steps: number): readonly number[] =>
  steps <= BAND_CAP ? Array.from({ length: steps - 2 }, (_, i) => i + 1) : SHOWN_STEPS[steps];

/**
 * BUG-008 golden: the card draws the steps the Gradient Builder shows for the
 * same `?start=&end=&steps=&interpolation=&algo=` share.
 *
 * Provenance. Every row was produced by running the web app's OWN source —
 * `interpolateHue`, `interpolateInSpace` and `calculateInterpolation`, lifted
 * verbatim out of apps/web-app/src/components/gradient-tool.ts with the page's
 * defaults (duplicate prevention on, no dye filters, no pins) — against the
 * built @xivdyetools/core. That harness first reproduced every middle hex the
 * web app's own suite pins (gradient-tool.test.ts, "a grey endpoint has no hue
 * of its own": Slate Grey → #2A3FD0 and Dalamud Red → Royal Blue in hsv / oklch
 * / lch); the 10 → 73 rows' ideals here are those same pinned values.
 *
 * Columns: start stainID, end stainID, steps, interpolation, algorithm, then
 * the page's WHOLE middle ramp — page steps 2 to n − 1 — as (matched dye hexes)
 * and (ideal step hexes). The card draws all of them up to BAND_CAP and the
 * three SHOWN_STEPS above it, so a long row also checks that the dedupe ran
 * over the steps the card does not draw. Slate Grey (4) and Jet Black (102)
 * are exact grays (r = g = b), so their rows exercise the powerless-hue rule
 * from both ends. Ink Blue (68) → Snow White (1) is the audit's repro (the
 * page's hsv ramp is green, the old card's Lab ramp gray); it and Cork Brown
 * (22) → Dark Purple (111) at 8 steps — the page's default — are the repros
 * for long ramps, where the card used to ramp at five steps and draw Morbol
 * Green and Blood Red, which those pages never show.
 */
const PAGE_GOLDEN: ReadonlyArray<
  readonly [number, number, number, GradientInterpolation, MatchingAlgorithm, string, string]
> = [
  [4, 73, 5, 'rgb', 'ciede2000', '#4F5766 #2F3851 #312D57', '#565866 #464B66 #373D67'],
  [4, 73, 5, 'hsv', 'ciede2000', '#4F5766 #2F3851 #312D57', '#565866 #464B66 #373D66'],
  [4, 73, 5, 'lab', 'ciede2000', '#4F5766 #514560 #312D57', '#585766 #4A4A67 #3A3D67'],
  [4, 73, 5, 'oklch', 'ciede2000', '#4F5766 #2F3851 #234172', '#545867 #444B68 #353E68'],
  [4, 73, 5, 'lch', 'ciede2000', '#4F5766 #514560 #312D57', '#585766 #4A4A67 #3A3D67'],
  [73, 4, 5, 'rgb', 'ciede2000', '#312D57 #2F3851 #4F5766', '#373D67 #464B66 #565866'],
  [73, 4, 5, 'hsv', 'ciede2000', '#312D57 #2F3851 #4F5766', '#373D66 #464B66 #565866'],
  [73, 4, 5, 'lab', 'ciede2000', '#312D57 #514560 #4F5766', '#3A3D67 #4A4A67 #585766'],
  [73, 4, 5, 'oklch', 'ciede2000', '#234172 #2F3851 #4F5766', '#353E68 #444B68 #545867'],
  [73, 4, 5, 'lch', 'ciede2000', '#312D57 #514560 #4F5766', '#3A3D67 #4A4A67 #585766'],
  [102, 88, 5, 'rgb', 'ciede2000', '#585230 #8B9C63 #ABB054', '#56542E #8E8B3E #C6C14D'],
  [102, 88, 5, 'hsv', 'ciede2000', '#484742 #8B9C63 #ABB054', '#565548 #8E8C61 #C6C268'],
  [102, 88, 5, 'lab', 'ciede2000', '#585230 #707326 #ABB054', '#504D2F #86823F #C1BB4F'],
  [102, 88, 5, 'oklch', 'ciede2000', '#585230 #707326 #ABB054', '#4E4D32 #858243 #BFBB51'],
  [102, 88, 5, 'lch', 'ciede2000', '#585230 #707326 #ABB054', '#504D2F #86823F #C1BB4F'],
  [88, 102, 5, 'rgb', 'ciede2000', '#ABB054 #8B9C63 #585230', '#C6C14D #8E8B3E #56542E'],
  [88, 102, 5, 'hsv', 'ciede2000', '#ABB054 #8B9C63 #484742', '#C6C268 #8E8C61 #565548'],
  [88, 102, 5, 'lab', 'ciede2000', '#ABB054 #707326 #585230', '#C1BB4F #86823F #504D2F'],
  [88, 102, 5, 'oklch', 'ciede2000', '#ABB054 #707326 #585230', '#BFBB51 #858243 #4E4D32'],
  [88, 102, 5, 'lch', 'ciede2000', '#ABB054 #707326 #585230', '#C1BB4F #86823F #504D2F'],
  [68, 1, 5, 'rgb', 'ciede2000', '#484742 #898784 #ACA8A2', '#4D4F51 #7F7F7C #B2AFA6'],
  [68, 1, 5, 'hsv', 'ciede2000', '#1F4646 #5F7558 #BACFAA', '#3F5654 #69856F #A8B59A'],
  [68, 1, 5, 'lab', 'ciede2000', '#484742 #898784 #ACA8A2', '#46494D #777876 #ACAAA2'],
  [68, 1, 5, 'oklch', 'ciede2000', '#484742 #898784 #ACA8A2', '#3E4B4F #6C7B77 #A5ADA0'],
  [68, 1, 5, 'lch', 'ciede2000', '#484742 #437272 #ACA8A2', '#3D4B50 #6A7B78 #A3ADA1'],
  [10, 73, 5, 'rgb', 'ciede2000', '#5B1729 #66304E #312D57', '#64202D #502541 #3B2B54'],
  [10, 73, 5, 'hsv', 'ciede2000', '#66304E #514560 #312D57', '#741E4C #6A216F #40246B'],
  [10, 73, 5, 'lab', 'ciede2000', '#5B1729 #66304E #3B2A3D', '#6B222D #5C2740 #482C53'],
  [10, 73, 5, 'oklch', 'ciede2000', '#66304E #3B2A3D #312D57', '#6D1A3F #5B2158 #432966'],
  [10, 73, 5, 'lch', 'ciede2000', '#5B1729 #66304E #312D57', '#761035 #68184D #4E265E'],
  [4, 73, 4, 'rgb', 'ciede2000', '#4F5766 #2F3851', '#505366 #3C4266'],
  [4, 73, 4, 'hsv', 'ciede2000', '#4F5766 #2F3851', '#515466 #3C4266'],
  [4, 73, 4, 'lab', 'ciede2000', '#4F5766 #312D57', '#535366 #404167'],
  [4, 73, 4, 'oklch', 'ciede2000', '#4F5766 #2F3851', '#4F5467 #3A4368'],
  [4, 73, 4, 'lch', 'ciede2000', '#4F5766 #312D57', '#535366 #404167'],
  [102, 88, 4, 'rgb', 'ciede2000', '#707326 #ABB054', '#696633 #B3AF48'],
  [102, 88, 4, 'hsv', 'ciede2000', '#585230 #ABB054', '#696853 #B3B068'],
  [102, 88, 4, 'lab', 'ciede2000', '#585230 #ABB054', '#625E35 #ADA74A'],
  [102, 88, 4, 'oklch', 'ciede2000', '#585230 #ABB054', '#605E38 #ABA84D'],
  [102, 88, 4, 'lch', 'ciede2000', '#585230 #ABB054', '#625E35 #ADA74A'],
  [68, 1, 4, 'rgb', 'ciede2000', '#656565 #ACA8A2', '#5D5F5F #A19F98'],
  [68, 1, 4, 'hsv', 'ciede2000', '#437272 #8B9C63', '#4C665D #91A589'],
  [68, 1, 4, 'lab', 'ciede2000', '#656565 #ACA8A2', '#56585A #9A9993'],
  [68, 1, 4, 'oklch', 'ciede2000', '#656565 #A7A7A7', '#4C5B5D #919C92'],
  [68, 1, 4, 'lch', 'ciede2000', '#4F5766 #A7A7A7', '#4A5B5E #8F9C93'],
  [4, 73, 3, 'rgb', 'ciede2000', '#2F3851', '#464B66'],
  [4, 73, 3, 'hsv', 'ciede2000', '#2F3851', '#464B66'],
  [4, 73, 3, 'lab', 'ciede2000', '#514560', '#4A4A67'],
  [4, 73, 3, 'oklch', 'ciede2000', '#2F3851', '#444B68'],
  [4, 73, 3, 'lch', 'ciede2000', '#514560', '#4A4A67'],
  [102, 88, 3, 'rgb', 'ciede2000', '#8B9C63', '#8E8B3E'],
  [102, 88, 3, 'hsv', 'ciede2000', '#8B9C63', '#8E8C61'],
  [102, 88, 3, 'lab', 'ciede2000', '#707326', '#86823F'],
  [102, 88, 3, 'oklch', 'ciede2000', '#707326', '#858243'],
  [102, 88, 3, 'lch', 'ciede2000', '#707326', '#86823F'],
  [68, 1, 3, 'rgb', 'ciede2000', '#898784', '#7F7F7C'],
  [68, 1, 3, 'hsv', 'ciede2000', '#5F7558', '#69856F'],
  [68, 1, 3, 'lab', 'ciede2000', '#898784', '#777876'],
  [68, 1, 3, 'oklch', 'ciede2000', '#898784', '#6C7B77'],
  [68, 1, 3, 'lch', 'ciede2000', '#437272', '#6A7B78'],
  // Past BAND_CAP: the page's whole ramp, of which the card draws three steps
  [68, 1, 6, 'hsv', 'ciede2000', '#1F4646 #5F7558 #8B9C63 #BACFAA', '#374C4D #587364 #7F987C #B6BEA4'],
  [68, 1, 6, 'lab', 'ciede2000', '#484742 #656565 #898784 #ACA8A2', '#3D4045 #636465 #8C8B87 #B7B4AB'],
  [68, 1, 7, 'hsv', 'ciede2000',
    '#1F4646 #437272 #5F7558 #8B9C63 #BACFAA',
    '#324446 #4C665D #69856F #91A589 #BFC4AB'],
  [68, 1, 7, 'lab', 'ciede2000',
    '#373747 #656565 #898784 #ACA8A2 #BFB4A3',
    '#373A40 #56585A #777876 #9A9993 #BEBBB1'],
  [68, 1, 8, 'hsv', 'ciede2000',
    '#152C2C #3B4D3C #5F7558 #8B9C63 #BACFAA #BBBB8A',
    '#2E3E42 #455D58 #5D7867 #779377 #9EAE93 #C5C9B0'],
  [68, 1, 8, 'lab', 'ciede2000',
    '#373747 #484742 #656565 #898784 #ACA8A2 #BFB4A3',
    '#33363C #4D4F52 #696A6A #868682 #A4A29B #C4C0B5'],
  [68, 1, 10, 'hsv', 'ciede2000',
    '#152C2C #1F4646 #437272 #5F7558 #8B9C63 #BBBB8A #BACFAA #BFB4A3',
    '#2A373C #3A5151 #4C665D #5F7B69 #749074 #91A589 #B0BAA0 #CDCFB7'],
  [68, 1, 10, 'lab', 'ciede2000',
    '#232026 #484742 #656565 #898784 #92816C #ACA8A2 #BFB4A3 #A7A7A7',
    '#2D3137 #414448 #56585A #6C6D6D #83827F #9A9993 #B2B0A7 #CBC7BB'],
  [68, 1, 12, 'hsv', 'ciede2000',
    '#152C2C #1F4646 #3B4D3C #437272 #5F7558 #8B9C63 #BBBB8A #BACFAA #BFB4A3 #EBD3A0',
    '#273238 #344749 #425B57 #516C61 #617D6A #728E73 #899F83 #A2B095 #BBC2A8 #D3D3BC'],
  [68, 1, 12, 'lab', 'ciede2000',
    '#232026 #373747 #484742 #656565 #898784 #92816C #A7A7A7 #ACA8A2 #BFB4A3 #F9F8F4',
    '#2A2E34 #3A3D42 #4B4D50 #5C5E5F #6E6F6E #81807E #94938E #A7A59E #BBB8AE #CFCBBF'],
  [22, 111, 6, 'hsv', 'ciede2000', '#CC6C5E #79526C #66304E #3B2A3D', '#A85F56 #885161 #67465D #453647'],
  [22, 111, 6, 'lab', 'ciede2000', '#996E3F #7B5C2D #6A4B37 #3F3329', '#A5784D #836143 #624A3A #423430'],
  [22, 111, 7, 'hsv', 'ciede2000',
    '#CC6C5E #79526C #66304E #514560 #3B2A3D',
    '#AE6656 #93535D #774C61 #5C4158 #3F3241'],
  [22, 111, 7, 'lab', 'ciede2000',
    '#996E3F #7B5C2D #6A4B37 #615245 #3F3329',
    '#AB7C4E #8E6846 #72553E #574236 #3D312E'],
  [22, 111, 8, 'hsv', 'ciede2000',
    '#CC6C5E #B61D4B #79526C #66304E #514560 #322C3B',
    '#B26B57 #9A5459 #834F61 #6C485F #553D53 #3A303D'],
  [22, 111, 8, 'lab', 'ciede2000',
    '#A2875C #996E3F #7B5C2D #6A4B37 #3F3329 #30211B',
    '#AF7F4F #966E49 #7E5D42 #664D3B #4F3D34 #392E2D'],
  [22, 111, 10, 'hsv', 'ciede2000',
    '#CC6C5E #913B27 #79526C #66304E #514560 #3B2A3D #322C3B #373747',
    '#B77357 #A55B56 #93535D #814F62 #6E4960 #5C4158 #49384A #352D38'],
  [22, 111, 10, 'lab', 'ciede2000',
    '#A2875C #996E3F #7B5C2D #6A4B37 #615245 #3F3329 #30211B #28211C',
    '#B58351 #A1764C #8E6846 #7B5B41 #694F3C #574236 #453731 #342B2B'],
  [22, 111, 12, 'hsv', 'ciede2000',
    '#B75C2D #CC6C5E #B61D4B #79526C #66304E #514560 #3B2A3D #322C3B #373747 #181820',
    '#BA7857 #AB6356 #9D5557 #8E525F #7F4E62 #704960 #61435A #523C51 #423444 #322A35'],
  [22, 111, 12, 'lab', 'ciede2000',
    '#A2875C #996E3F #8E581B #7B5C2D #6A4B37 #615245 #3F3329 #4F2D1F #30211B #28211C',
    '#B98652 #A87B4D #997049 #896545 #7A5A41 #6B503C #5C4638 #4D3C33 #3F322F #31292A'],
  [102, 88, 6, 'hsv', 'ciede2000', '#484742 #5F7558 #8B9C63 #F2D770', '#4B4A41 #787659 #A4A266 #D1CD67'],
  [102, 88, 6, 'lab', 'ciede2000', '#323621 #707326 #ABB054 #F2D770', '#46432C #706C39 #9D9846 #CDC652'],
  [102, 88, 7, 'hsv', 'ciede2000',
    '#484742 #585230 #8B9C63 #ABB054 #F2D770',
    '#43433C #696853 #8E8C61 #B3B068 #D9D466'],
  [102, 88, 7, 'lab', 'ciede2000',
    '#323621 #585230 #707326 #ABB054 #F4DA46',
    '#3F3D2A #625E35 #86823F #ADA74A #D5CE54'],
  [102, 88, 8, 'hsv', 'ciede2000',
    '#484742 #585230 #5F7558 #8B9C63 #ABB054 #EDE63D',
    '#3E3E38 #5E5D4D #7E7D5C #9E9C65 #BEBA68 #DED965'],
  [102, 88, 8, 'lab', 'ciede2000',
    '#323621 #585230 #707326 #8B9C63 #ABB054 #EDE63D',
    '#3A3828 #575432 #76723B #979144 #B8B24D #DAD455'],
  [102, 88, 10, 'hsv', 'ciede2000',
    '#2B2923 #484742 #585230 #92816C #8B9C63 #ABB054 #F2D770 #EDE63D',
    '#373733 #504F45 #696853 #82805D #9A9864 #B3B068 #CCC868 #E5DF64'],
  [102, 88, 10, 'lab', 'ciede2000',
    '#2B2923 #585230 #4B5232 #707326 #8B9C63 #ABB054 #F2D770 #EDE63D',
    '#343226 #4A472D #625E35 #7A753C #938E43 #ADA74A #C7C150 #E2DC57'],
  [102, 88, 12, 'hsv', 'ciede2000',
    '#2B2923 #484742 #585230 #5F7558 #92816C #8B9C63 #ABB054 #BBBB8A #F2D770 #EDE63D',
    '#32322F #47463F #5B5A4B #6F6E56 #84825E #989664 #ADAA67 #C1BD68 #D5D067 #EAE463'],
  [102, 88, 12, 'lab', 'ciede2000',
    '#2B2923 #323621 #585230 #707326 #658241 #8B9C63 #ABB054 #9BB363 #F2D770 #EDE63D',
    '#302E24 #423F2B #555131 #686437 #7C783D #918C42 #A6A048 #BBB54D #D1CB53 #E7E158'],
  [68, 1, 6, 'hsv', 'rgb', '#3B4D3C #5F7558 #898784 #BFB4A3', '#374C4D #587364 #7F987C #B6BEA4'],
  [68, 1, 6, 'lab', 'rgb', '#373747 #656565 #898784 #BFB4A3', '#3D4045 #636465 #8C8B87 #B7B4AB'],
  [68, 1, 7, 'hsv', 'rgb',
    '#373747 #4F5766 #5F7558 #898784 #BACFAA',
    '#324446 #4C665D #69856F #91A589 #BFC4AB'],
  [68, 1, 7, 'lab', 'rgb',
    '#373747 #4F5766 #836969 #A7A7A7 #BFB4A3',
    '#373A40 #56585A #777876 #9A9993 #BEBBB1'],
  [68, 1, 8, 'hsv', 'rgb',
    '#373747 #4F5766 #5F7558 #898784 #ACA8A2 #BACFAA',
    '#2E3E42 #455D58 #5D7867 #779377 #9EAE93 #C5C9B0'],
  [68, 1, 8, 'lab', 'rgb',
    '#322C3B #514560 #656565 #898784 #ACA8A2 #BACFAA',
    '#33363C #4D4F52 #696A6A #868682 #A4A29B #C4C0B5'],
  [68, 1, 10, 'hsv', 'rgb',
    '#322C3B #3B4D3C #4F5766 #5F7558 #898784 #8E9BAC #BFB4A3 #BACFAA',
    '#2A373C #3A5151 #4C665D #5F7B69 #749074 #91A589 #B0BAA0 #CDCFB7'],
  [68, 1, 10, 'lab', 'rgb',
    '#322C3B #484742 #4F5766 #656565 #898784 #A7A7A7 #ACA8A2 #BACFAA',
    '#2D3137 #414448 #56585A #6C6D6D #83827F #9A9993 #B2B0A7 #CBC7BB'],
  [68, 1, 12, 'hsv', 'rgb',
    '#322C3B #3B4D3C #4F5766 #5F7558 #656565 #898784 #8B9C63 #ACA8A2 #BACFAA #EBD3A0',
    '#273238 #344749 #425B57 #516C61 #617D6A #728E73 #899F83 #A2B095 #BBC2A8 #D3D3BC'],
  [68, 1, 12, 'lab', 'rgb',
    '#322C3B #373747 #484742 #656565 #836969 #898784 #8E9BAC #ACA8A2 #BFB4A3 #BACFAA',
    '#2A2E34 #3A3D42 #4B4D50 #5C5E5F #6E6F6E #81807E #94938E #A7A59E #BBB8AE #CFCBBF'],
  [22, 111, 6, 'hsv', 'rgb', '#996E3F #79526C #514560 #373747', '#A85F56 #885161 #67465D #453647'],
  [22, 111, 6, 'lab', 'rgb', '#996E3F #7B5C2D #6A4B37 #3F3329', '#A5784D #836143 #624A3A #423430'],
  [22, 111, 7, 'hsv', 'rgb',
    '#CC6C5E #836969 #79526C #514560 #3B2A3D',
    '#AE6656 #93535D #774C61 #5C4158 #3F3241'],
  [22, 111, 7, 'lab', 'rgb',
    '#A2875C #996E3F #6A4B37 #585230 #3F3329',
    '#AB7C4E #8E6846 #72553E #574236 #3D312E'],
  [22, 111, 8, 'hsv', 'rgb',
    '#CC6C5E #836969 #79526C #514560 #66304E #3B2A3D',
    '#B26B57 #9A5459 #834F61 #6C485F #553D53 #3A303D'],
  [22, 111, 8, 'lab', 'rgb',
    '#A2875C #996E3F #7B5C2D #6A4B37 #484742 #3F3329',
    '#AF7F4F #966E49 #7E5D42 #664D3B #4F3D34 #392E2D'],
  [22, 111, 10, 'hsv', 'rgb',
    '#CC6C5E #996E3F #836969 #79526C #514560 #66304E #484742 #322C3B',
    '#B77357 #A55B56 #93535D #814F62 #6E4960 #5C4158 #49384A #352D38'],
  [22, 111, 10, 'lab', 'rgb',
    '#A2875C #996E3F #7B5C2D #6A4B37 #615245 #585230 #3F3329 #2B2923',
    '#B58351 #A1764C #8E6846 #7B5B41 #694F3C #574236 #453731 #342B2B'],
  [22, 111, 12, 'hsv', 'rgb',
    '#CC6C5E #996E3F #836969 #79526C #656565 #514560 #66304E #484742 #373747 #322C3B',
    '#BA7857 #AB6356 #9D5557 #8E525F #7F4E62 #704960 #61435A #523C51 #423444 #322A35'],
  [22, 111, 12, 'lab', 'rgb',
    '#A2875C #996E3F #A58430 #7B5C2D #6A4B37 #615245 #585230 #484742 #3F3329 #2B2923',
    '#B98652 #A87B4D #997049 #896545 #7A5A41 #6B503C #5C4638 #4D3C33 #3F322F #31292A'],
  [102, 88, 6, 'hsv', 'rgb', '#484742 #836969 #9BB363 #E9C06F', '#4B4A41 #787659 #A4A266 #D1CD67'],
  [102, 88, 6, 'lab', 'rgb', '#4B5232 #707326 #A2875C #DBB457', '#46432C #706C39 #9D9846 #CDC652'],
  [102, 88, 7, 'hsv', 'rgb',
    '#484742 #5F7558 #92816C #B7A370 #F2D770',
    '#43433C #696853 #8E8C61 #B3B068 #D9D466'],
  [102, 88, 7, 'lab', 'rgb',
    '#3F3329 #585230 #996E3F #ABB054 #DBB457',
    '#3F3D2A #625E35 #86823F #ADA74A #D5CE54'],
  [102, 88, 8, 'hsv', 'rgb',
    '#3B4D3C #615245 #836969 #8B9C63 #B7A370 #F2D770',
    '#3E3E38 #5E5D4D #7E7D5C #9E9C65 #BEBA68 #DED965'],
  [102, 88, 8, 'lab', 'rgb',
    '#3F3329 #585230 #707326 #A58430 #ABB054 #F4DA46',
    '#3A3828 #575432 #76723B #979144 #B8B24D #DAD455'],
  [102, 88, 10, 'hsv', 'rgb',
    '#3F3329 #484742 #5F7558 #92816C #8B9C63 #B7A370 #DBB457 #F2D770',
    '#373733 #504F45 #696853 #82805D #9A9864 #B3B068 #CCC868 #E5DF64'],
  [102, 88, 10, 'lab', 'rgb',
    '#323621 #4B5232 #585230 #707326 #A58430 #ABB054 #DBB457 #F4DA46',
    '#343226 #4A472D #625E35 #7A753C #938E43 #ADA74A #C7C150 #E2DC57'],
  [102, 88, 12, 'hsv', 'rgb',
    '#322C3B #484742 #615245 #5F7558 #92816C #8B9C63 #B7A370 #DBB457 #E9C06F #F2D770',
    '#32322F #47463F #5B5A4B #6F6E56 #84825E #989664 #ADAA67 #C1BD68 #D5D067 #EAE463'],
  [102, 88, 12, 'lab', 'rgb',
    '#2B2923 #3F3329 #585230 #7B5C2D #658241 #A58430 #ABB054 #DBB457 #E9C06F #F4DA46',
    '#302E24 #423F2B #555131 #686437 #7C783D #918C42 #A6A048 #BBB54D #D1CB53 #E7E158'],
  [68, 1, 8, 'rgb', 'ciede2000',
    '#373747 #656565 #898784 #A7A7A7 #ACA8A2 #BFB4A3',
    '#373A3F #545657 #71716F #8D8D88 #AAA8A0 #C7C4B8'],
  [68, 1, 8, 'oklch', 'ciede2000',
    '#1C3D54 #484742 #656565 #898784 #ACA8A2 #BFB4A3',
    '#2E383E #445255 #5E6E6C #7C8982 #9CA69A #BFC2B4'],
  [68, 1, 8, 'lch', 'ciede2000',
    '#1C3D54 #4F5766 #656565 #898784 #A7A7A7 #BFB4A3',
    '#2D383F #425256 #5C6D6D #798983 #9AA69B #BEC2B4'],
  [22, 111, 8, 'rgb', 'ciede2000',
    '#A2875C #996E3F #7B5C2D #6A4B37 #3F3329 #30211B',
    '#B1814F #9A7148 #826141 #6A503B #524034 #3B302D'],
  [22, 111, 8, 'oklch', 'ciede2000',
    '#996E3F #836969 #79526C #66304E #3B2A3D #322C3B',
    '#B67A59 #9F675B #855659 #6A4753 #503A47 #382D38'],
  [22, 111, 8, 'lch', 'ciede2000',
    '#B75C2D #CC6C5E #836969 #79526C #3B2A3D #322C3B',
    '#BB7957 #A76459 #8E5458 #714652 #543948 #392D39'],
];

describe('BUG-008: the card draws the page’s own steps', () => {
  it.each(PAGE_GOLDEN)(
    '%i → %i, %i steps, %s, %s: the steps the Gradient Builder shows',
    (start, end, steps, interpolation, algorithm, dyesHex, idealsHex) => {
      // The row is the page's whole middle ramp: page index i sits at [i − 1]
      const pageDyes = dyesHex.split(' ');
      const pageIdeals = idealsHex.split(' ');
      expect(pageDyes).toHaveLength(steps - 2);
      const shown = shownSteps(steps);

      const svg = generateGradientOG({ startDyeId: start, endDyeId: end, steps, interpolation, algorithm });

      // Endpoints are the dyes themselves; the middles are the page's picks
      const startHex = getDyeByItemId(start)!.hex.toUpperCase();
      const endHex = getDyeByItemId(end)!.hex.toUpperCase();
      expect(bandHexes(svg)).toEqual([startHex, ...shown.map((i) => pageDyes[i - 1]), endHex]);
      // The Δ is measured against the page's ideal step, so this pins the
      // ramp itself, not just which dye it landed nearest
      expect(deltaTags(svg)).toEqual(
        expectedDeltas(
          shown.map((i) => pageIdeals[i - 1]),
          shown.map((i) => pageDyes[i - 1]),
          algorithm
        )
      );
      // Each middle band is labeled with the page's own step number
      expect(stepLabels(svg)).toEqual(shown.map((i) => String(i + 1)));
    }
  );

  it.each(Object.entries(SHOWN_STEPS).map(([steps, indices]) => [Number(steps), indices] as const))(
    '%i steps: the card draws page steps %j, distinct and inside the ramp',
    (steps, indices) => {
      expect(indices).toHaveLength(BAND_CAP - 2);
      indices.forEach((index, k) => {
        expect(index).toBeGreaterThanOrEqual(1);
        expect(index).toBeLessThanOrEqual(steps - 2);
        if (k > 0) expect(index).toBeGreaterThan(indices[k - 1]);
      });
      const svg = generateGradientOG({ startDyeId: 68, endDyeId: 1, steps });
      expect(bandHexes(svg)).toHaveLength(BAND_CAP);
      expect(stepLabels(svg)).toEqual(indices.map((index) => String(index + 1)));
    }
  );

  it('defaults to hsv — the Gradient Builder’s default mode', () => {
    // Ink Blue → Snow White: green on the page, gray under the old Lab ramp
    const svg = generateGradientOG({ startDyeId: 68, endDyeId: 1, steps: 5 });
    expect(middleHexes(svg)).toEqual(['#1F4646', '#5F7558', '#BACFAA']);
    expect(stable(svg)).toBe(
      stable(generateGradientOG({ startDyeId: 68, endDyeId: 1, steps: 5, interpolation: 'hsv' }))
    );
  });

  it('an unknown mode falls back to hsv, never a flat gray ramp', () => {
    // Pins behavior rather than guarding a regression: this passed before
    // BUG-008 too, when the card ignored the mode altogether
    const svg = generateGradientOG({
      startDyeId: 68,
      endDyeId: 1,
      steps: 5,
      interpolation: 'spectral' as GradientInterpolation,
    });
    expect(stable(svg)).toBe(
      stable(generateGradientOG({ startDyeId: 68, endDyeId: 1, steps: 5, interpolation: 'hsv' }))
    );
  });

  it('the matching algorithm no longer picks the ramp’s space', () => {
    // Before, ?algo=oklab ramped in Oklab and ?algo=rgb in RGB, whatever the
    // page drew. The ideal steps (and so each Δ's reference) now belong to the
    // interpolation mode alone — these are the hsv ramp's.
    const ideals = ['#565548', '#8E8C61', '#C6C268'];
    for (const algorithm of ['oklab', 'rgb', 'cie76'] as const) {
      const svg = generateGradientOG({ startDyeId: 102, endDyeId: 88, steps: 5, algorithm });
      expect(deltaTags(svg), algorithm).toEqual(
        expectedDeltas(ideals, middleHexes(svg), algorithm)
      );
    }
  });
});

/**
 * BUG-009 / BUG-061: `?algo=` chooses the dyes, not just the printed Δ. The
 * card used to rank by a hard-coded ciede2000 and then print the delta and the
 * footer in the requested method — a ΔE2000 pick labeled in another unit.
 * Rows come from the same web-app harness as PAGE_GOLDEN (hsv, 5 steps).
 */
const ALGO_GOLDEN: ReadonlyArray<readonly [number, number, MatchingAlgorithm, string]> = [
  [102, 88, 'ciede2000', '#484742 #8B9C63 #ABB054'],
  [102, 88, 'oklab', '#615245 #A2875C #ABB054'],
  [102, 88, 'rgb', '#615245 #92816C #DBB457'],
  [102, 88, 'cie76', '#615245 #A2875C #ABB054'],
  [102, 88, 'redmean', '#615245 #92816C #DBB457'],
  [102, 88, 'distinguish', '#615245 #92816C #DBB457'],
  [68, 1, 'ciede2000', '#1F4646 #5F7558 #BACFAA'],
  [68, 1, 'oklab', '#3B4D3C #5F7558 #BFB4A3'],
  [68, 1, 'rgb', '#4F5766 #5F7558 #ACA8A2'],
  [68, 1, 'cie76', '#1F4646 #5F7558 #BACFAA'],
  [68, 1, 'redmean', '#4F5766 #5F7558 #ACA8A2'],
  [68, 1, 'distinguish', '#4F5766 #5F7558 #ACA8A2'],
];

describe('BUG-009: the requested algorithm ranks the middle dyes', () => {
  it.each(ALGO_GOLDEN)('%i → %i under %s: the page’s picks', (start, end, algorithm, dyesHex) => {
    const svg = generateGradientOG({ startDyeId: start, endDyeId: end, steps: 5, algorithm });
    expect(middleHexes(svg)).toEqual(dyesHex.split(' '));
    expect(svg).toContain(algoTag(algorithm));
  });

  it('rgb and ciede2000 pick different middles for one ramp', () => {
    const pick = (algorithm: MatchingAlgorithm): string[] =>
      middleHexes(generateGradientOG({ startDyeId: 102, endDyeId: 88, steps: 5, algorithm }));
    expect(pick('rgb')).not.toEqual(pick('ciede2000'));
  });

  it.each([
    ['euclidean', 'rgb'],
    // These two pin behavior rather than guard a regression: both already drew
    // the ciede2000 card before BUG-009, when ciede2000 was hard-coded
    ['hyab', 'ciede2000'],
    ['oklch-weighted', 'ciede2000'],
  ] as const)('the legacy spelling %s draws exactly the %s card', (legacy, method) => {
    // The image route forwards the raw ?algo= spelling (VALID_ALGORITHMS keeps
    // the three pre-5.0 ones), so the card normalizes it before anything reads it
    for (const [start, end] of [
      [102, 88],
      [68, 1],
    ] as const) {
      const viaLegacy = generateGradientOG({
        startDyeId: start,
        endDyeId: end,
        steps: 5,
        algorithm: legacy as unknown as MatchingAlgorithm,
      });
      expect(stable(viaLegacy)).toBe(
        stable(generateGradientOG({ startDyeId: start, endDyeId: end, steps: 5, algorithm: method }))
      );
    }
  });
});
