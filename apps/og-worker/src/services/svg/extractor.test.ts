/**
 * Extractor OG tests — the matching method (BUG-060, deep dive 2026-10-04).
 *
 * The frame, shares, X degrade and locales are covered in `new-tools.test.ts`;
 * this file pins only which dye each band names and which method it says it
 * measured with.
 */
import { describe, it, expect } from 'vitest';
import {
  LEGACY_MATCHING_METHOD_MAP,
  MATCHING_METHODS,
  MATCHING_METHOD_TAGS,
  normalizeMatchingMethod,
  type MatchingMethod,
} from '@xivdyetools/core';
import { generateExtractorOG } from './extractor';
import { dyeService } from './dye-helpers';

/** The bucket mark's clipPath id is a per-render counter (band.ts) — mask it. */
const normalizeMarkUid = (svg: string): string => svg.replace(/ogm\d+/g, 'ogmX');

/**
 * The dye hexes the card printed, in band order — which dyes were CHOSEN. In
 * the Discord frame only the matched dye's hex is a text run (the extracted
 * pixel is a strip fill, never text), so this is exactly the picks.
 */
const picked = (svg: string): string[] => [...svg.matchAll(/>(#[0-9A-F]{6})</g)].map((m) => m[1]);

/** The figures in the band tags, as printed. */
const deltas = (svg: string): string[] => [...svg.matchAll(/>Δ([\d.]+)</g)].map((m) => m[1]);

/**
 * `#C04080` is one extracted color whose nearest dye differs by method:
 * ΔE2000 `#F61296`, ΔEOK `#B61D4B`, ΔE76 `#F43195`, RGB `#CC6C5E` — so a
 * card that ranks by any ONE hard-coded method fails here for at least three
 * of the six.
 */
const SPLIT_HEX = 'C04080';

function card(hex: string, algorithm?: string): string {
  return generateExtractorOG({
    entries: [{ hex }],
    ...(algorithm === undefined ? {} : { algorithm: algorithm as MatchingMethod }),
  });
}

describe('generateExtractorOG — the requested method chooses the dye (BUG-060)', () => {
  it('breaks exact rgb ties the way the page does, not by table order', () => {
    // Each hex is an exact integer RGB tie between two dyes. The page calls
    // core's findClosestDye (a k-d tree under rgb) and names the dye in the
    // second column; the first tied dye in table order is the one the card
    // used to draw. Names pinned as literals so the tree cannot drift unseen.
    const TIES: Array<[string, string, string]> = [
      ['50161D', 'Wine Red', '#451511'],
      ['311D1A', 'Dark Red', ''],
      ['411F0F', 'Chestnut Brown', ''],
    ];
    for (const [hex, name, dyeHex] of TIES) {
      const page = dyeService.findClosestDye(`#${hex}`, { matchingMethod: 'rgb' })!;
      expect(page.name, hex).toBe(name);
      if (dyeHex) expect(page.hex.toLowerCase(), hex).toBe(dyeHex);
      expect(picked(card(hex, 'rgb')), hex).toEqual([page.hex.toUpperCase()]);
      expect(picked(card(hex, 'euclidean')), `${hex} euclidean`).toEqual([page.hex.toUpperCase()]);
    }
  });

  it('names the dye the page names for every method', () => {
    // For a one-color palette, the page (extractor-tool.ts `resolveDye`)
    // resolves the color with core's `findClosestDye(hex, { matchingMethod })`
    // (no earlier color holds a dye for Prevent-duplicates to skip); the card
    // is its unfurl, so it must land on the same dye.
    for (const method of MATCHING_METHODS) {
      const expected = dyeService.findClosestDye(`#${SPLIT_HEX}`, { matchingMethod: method })!;
      expect(picked(card(SPLIT_HEX, method)), method).toEqual([expected.hex.toUpperCase()]);
    }
  });

  it('a different method can name a different dye', () => {
    const byDeltaE = picked(card(SPLIT_HEX, 'ciede2000'));
    const byRgb = picked(card(SPLIT_HEX, 'rgb'));
    expect(byDeltaE).toHaveLength(1);
    expect(byRgb).not.toEqual(byDeltaE);
  });

  it('DISTINGUISH ranks unrounded — its integer ties do not fall to table order', () => {
    // `#315C66`: rounded DISTINGUISH % ties and the table's first tied row is
    // `#437272`; the unrounded ordering (identical to RGB distance) names
    // `#4F5766`, which is what the page's `findClosestDye` names.
    const hex = '315C66';
    const expected = dyeService.findClosestDye(`#${hex}`, { matchingMethod: 'distinguish' })!;
    const svg = card(hex, 'distinguish');
    expect(picked(svg)).toEqual([expected.hex.toUpperCase()]);
    expect(picked(svg)).toEqual(picked(card(hex, 'rgb')));
    // DISTINGUISH % prints an integer
    expect(deltas(svg)).toHaveLength(1);
    expect(deltas(svg)[0]).toMatch(/^\d+$/);
  });

  it('names the measured method in the footer, at that method’s precision', () => {
    const oklab = card(SPLIT_HEX, 'oklab');
    expect(oklab).toContain(`>${MATCHING_METHOD_TAGS.oklab}<`);
    expect(oklab).not.toContain('>ΔE2000<');
    // ΔEOK prints dp3
    expect(deltas(oklab)[0]).toMatch(/^\d+\.\d{3}$/);
  });

  it('a legacy spelling renders the card of the method it normalizes to', () => {
    for (const [legacy, normalized] of Object.entries(LEGACY_MATCHING_METHOD_MAP)) {
      expect(normalizeMarkUid(card(SPLIT_HEX, legacy)), legacy).toBe(normalizeMarkUid(card(SPLIT_HEX, normalized)));
    }
    // The loop alone also passes on a card that ignores the method: `hyab` and
    // `oklch-weighted` normalize to `ciede2000`, the one card it always drew.
    // `euclidean` normalizes to `rgb`, whose pick for SPLIT_HEX differs, so it
    // must render a different card from `ciede2000`, down to the dye it names.
    const euclidean = card(SPLIT_HEX, 'euclidean');
    const ciede2000 = card(SPLIT_HEX, 'ciede2000');
    expect(normalizeMarkUid(euclidean)).not.toBe(normalizeMarkUid(ciede2000));
    expect(picked(euclidean)).not.toEqual(picked(ciede2000));
  });

  it('no method is the suite default — ΔE2000, the card it always drew', () => {
    const plain = card(SPLIT_HEX);
    expect(normalizeMarkUid(plain)).toBe(normalizeMarkUid(card(SPLIT_HEX, normalizeMatchingMethod(undefined))));
    expect(plain).toContain('>ΔE2000<');
    expect(deltas(plain)[0]).toMatch(/^\d+\.\d$/);
  });
});
