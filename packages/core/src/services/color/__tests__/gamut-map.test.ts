import { describe, it, expect } from 'vitest';
import { differenceEuclidean, formatHex, toGamut } from 'culori';
import { ColorConverter } from '../ColorConverter.js';

/**
 * culori's toGamut with the CSS Color 4 arguments: bisect chroma in OKLCH, plain ΔEOK, JND 0.02.
 *
 * @types/culori@2.1.1 types `toGamut`'s third parameter as `number | null` only, but culori
 * v4's actual runtime `toGamut` accepts a difference function there (exactly what CSS Color 4's
 * gamut-mapping algorithm needs) — see the JS source in `culori/src/clamp.js`. The DefinitelyTyped
 * package hasn't caught up to v4 for this overload, so cast at the call site; the value passed at
 * runtime is unchanged, only the compile-time type is widened.
 */
const cssMap = toGamut('rgb', 'oklch', differenceEuclidean('oklab') as unknown as number, 0.02);

/** Deterministic LCG so the sample is the same on every run. */
function* lcg(seed: number): Generator<number> {
  let s = seed >>> 0;
  for (;;) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    yield s / 0x100000000;
  }
}

function channels(hex: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

describe('gamutMapOklch', () => {
  it('returns in-gamut colours unchanged', () => {
    const { L, C, h } = ColorConverter.hexToOklch('#6D5440');
    expect(ColorConverter.gamutMapOklch(L, C, h)).toBe('#6D5440');
  });

  it('returns white above L=1 and black below L=0', () => {
    expect(ColorConverter.gamutMapOklch(1.2, 0.3, 40)).toBe('#FFFFFF');
    expect(ColorConverter.gamutMapOklch(-0.1, 0.3, 40)).toBe('#000000');
  });

  it("maps pure blue's 180° complement to a dark olive, not the clipped dark red", () => {
    const { L, C, h } = ColorConverter.hexToOklch('#0000FF');
    const mapped = ColorConverter.gamutMapOklch(L, C, (h + 180) % 360);
    // research 02 Table B: css-map #734F00, clip #A02000 (50.6° off)
    const [r, g, b] = channels(mapped);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    expect(Math.abs(r - 0x73)).toBeLessThanOrEqual(3);
    expect(Math.abs(g - 0x4f)).toBeLessThanOrEqual(3);
    expect(b).toBeLessThanOrEqual(3);
  });

  it('agrees with culori.toGamut (CSS Color 4) to within one 8-bit step on 2000 random OKLCH colours', () => {
    const rand = lcg(20260904);
    let exact = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const L = 0.05 + 0.9 * rand.next().value;
      const C = 0.37 * rand.next().value;
      const h = 360 * rand.next().value;
      const ours = ColorConverter.gamutMapOklch(L, C, h);
      const theirs = formatHex(cssMap({ mode: 'oklch', l: L, c: C, h })).toUpperCase();
      const a = channels(ours);
      const b = channels(theirs);
      for (let k = 0; k < 3; k++) expect(Math.abs(a[k] - b[k])).toBeLessThanOrEqual(1);
      if (ours === theirs) exact++;
    }
    // Observed exact-match rate on this seed: 0.975 (recorded 2026-09-05, see task-4-report.md).
    expect(exact / N).toBeGreaterThan(0.9);
  });
});

describe('maxChromaOklch', () => {
  it('finds the sRGB cusp: pure red is at max chroma for its own L and h', () => {
    const { L, C, h } = ColorConverter.hexToOklch('#FF0000');
    expect(ColorConverter.maxChromaOklch(L, h)).toBeCloseTo(C, 3);
  });

  it('is much larger for magenta than for cyan at L=0.65 (research 02 Table D: 0.296 vs 0.111)', () => {
    expect(ColorConverter.maxChromaOklch(0.65, 330)).toBeCloseTo(0.296, 2);
    expect(ColorConverter.maxChromaOklch(0.65, 195)).toBeCloseTo(0.111, 2);
  });

  it('never returns an out-of-gamut chroma near the blue ray (h ≈ 264°)', () => {
    for (let L = 0.2; L <= 0.9; L += 0.05) {
      const c = ColorConverter.maxChromaOklch(L, 264);
      const hex = ColorConverter.gamutMapOklch(L, c, 264);
      const { C } = ColorConverter.hexToOklch(hex);
      expect(C).toBeGreaterThan(c - 0.01);
    }
  });

  /**
   * The sRGB solid is NOT star-shaped in OKLab along the blue ray: at
   * L ≈ 0.11 / h ≈ 264° the ray leaves the gamut around C ≈ 0.066 and
   * re-enters further out (that outer lobe is what makes #0000FF itself
   * legal). A plain lo/hi bisection seeded with `hi = 0.4` samples the
   * midpoint first, lands in the far lobe, and answers a chroma with a
   * out-of-gamut hole between it and the neutral axis — so the ring is
   * painted from a colour the gamut mapper then pulls back somewhere else.
   *
   * The contract this pins is CONNECTED-FROM-ZERO: every chroma in [0, C] is
   * inside sRGB, not merely C itself.
   */
  it('answers the FIRST gamut exit on the blue ray, not a chroma across the hole', () => {
    expect(ColorConverter.maxChromaOklch(0.11, 264.1)).toBeCloseTo(0.0659, 2);
    expect(Math.abs(ColorConverter.maxChromaOklch(0.11, 264.1) - 0.0659)).toBeLessThan(0.002);
  });

  it('returns a chroma whose whole segment [0, C] is in gamut, over 60 seeded samples', () => {
    const rand = lcg(20260905);
    const inGamutAt = (L: number, c: number, h: number): boolean => {
      // `gamutMapOklch` only reduces chroma; if it hands back essentially the
      // chroma asked for, that (L, c, h) was inside the gamut.
      const { C } = ColorConverter.hexToOklch(ColorConverter.gamutMapOklch(L, c, h));
      return C >= c - 0.004;
    };
    for (let i = 0; i < 60; i++) {
      const L = 0.1 + 0.8 * rand.next().value;
      const h = 360 * rand.next().value;
      const c = ColorConverter.maxChromaOklch(L, h);
      expect(inGamutAt(L, c, h), `C at L=${L} h=${h}`).toBe(true);
      expect(inGamutAt(L, 0.99 * c, h), `0.99C at L=${L} h=${h}`).toBe(true);
    }
  });
});
