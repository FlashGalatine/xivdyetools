import { describe, it, expect } from 'vitest';
import munsellAnchors from '../../../../data/munsell-anchors.json' with { type: 'json' };
import { MUNSELL_TABLE, MUNSELL_WHEEL } from '../munsell.js';
import { assertMonotoneTable } from '../hue-warp.js';

/**
 * The raw renotation anchors are TEST data: the runtime wheel reads only
 * `MUNSELL_TABLE`, and this file is the only reader of the anchors. Imported
 * straight from the generated JSON rather than re-exported from `munsell.ts`,
 * so 40 objects of provenance metadata stay out of every shipped bundle.
 */
const MUNSELL_ANCHORS = munsellAnchors.anchors;

const anchor = (notation: string) => {
  const a = MUNSELL_ANCHORS.find((x) => x.notation === notation);
  if (!a) throw new Error(`no anchor ${notation}`);
  return a;
};

describe('munsell wheel', () => {
  it('has 40 anchors, one per principal hue, and a valid 42-pair table', () => {
    expect(MUNSELL_ANCHORS).toHaveLength(40);
    expect(new Set(MUNSELL_ANCHORS.map((a) => a.notation)).size).toBe(40);
    expect(MUNSELL_TABLE).toHaveLength(42);
    expect(() => assertMonotoneTable(MUNSELL_TABLE, 'munsell')).not.toThrow();
  });

  it('spaces consecutive anchors 9° apart on the wheel (2.5 Munsell steps × 3.6°)', () => {
    const sorted = [...MUNSELL_ANCHORS].sort((a, b) => a.wheelAngle - b.wheelAngle);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].wheelAngle - sorted[i - 1].wheelAngle).toBeCloseTo(9, 6);
    }
  });

  it('keeps the principal hues in spectral order with plausible sRGB hues', () => {
    // Ranges, not exact values: the exact numbers are pinned by the golden
    // digest (HarmonySelector.golden.test.ts) once the wheel is wired in.
    //
    // Deviation from task-6-brief.md: the brief's literal thresholds here
    // (5R >= 345, 5Y > 50, 5B > 190) do not hold for the verified-correct
    // renotation-derived anchors — cross-checked against the independent
    // munsell.js oracle (docs/research/2026-09-04-harmony-color-wheels/
    // probes/munsell-crosscheck.{mjs,output.txt}), which agrees with this
    // package's computed hues to within ~0.2-0.3° on these anchors (5R
    // 2.51° vs 2.67°, 5Y 47.99° vs 47.74°, 5B 188.88° vs 189.42°) — i.e.
    // 5R sits just PAST 0° (not just before 360°), not a systematic-offset
    // bug in the Bradford/XYZ matrices. The ranges below are widened to
    // match the verified values while still asserting spectral order and
    // plausibility.
    const red = anchor('5R').hsvHue;
    expect(red < 15 || red >= 345).toBe(true);
    expect(anchor('5Y').hsvHue).toBeGreaterThan(45);
    expect(anchor('5Y').hsvHue).toBeLessThan(75);
    expect(anchor('5G').hsvHue).toBeGreaterThan(145);
    expect(anchor('5G').hsvHue).toBeLessThan(175);
    expect(anchor('5B').hsvHue).toBeGreaterThan(185);
    expect(anchor('5B').hsvHue).toBeLessThan(220);
    expect(anchor('5P').hsvHue).toBeGreaterThan(270);
    expect(anchor('5P').hsvHue).toBeLessThan(305);
  });

  it("red's complement is a blue-green (5BG), between sRGB 160° and 195°", () => {
    const hue = MUNSELL_WHEEL.target('#FF0000', 180).targetHue;
    expect(hue).toBeGreaterThan(160);
    expect(hue).toBeLessThan(195);
  });

  it('keeps a grey grey', () => {
    expect(MUNSELL_WHEEL.target('#808080', 180).targetHex).toBe('#808080');
  });
});
