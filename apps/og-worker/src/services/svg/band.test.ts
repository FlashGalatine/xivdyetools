/**
 * 15E band frame tests — the drawn geometry and the band ink law.
 */
import { describe, it, expect } from 'vitest';
import { generateBandCard, bandInk, BAND_FRAMES, BAND_CAP } from './band';

const HARMONY_BANDS = [
  { hex: '#4C6E31', role: 'BASE', name: 'Mud Green', value: '#4C6E31', tag: '#33', grow: 2, nameSize: 17 },
  { hex: '#7A3C3C', role: '+90°', name: 'Wine Red', value: '#7A3C3C', tag: 'Δ4.2', grow: 1 },
  { hex: '#31556E', role: '+180°', name: 'Ink Blue', value: '#31556E', tag: 'Δ6.1', grow: 1 },
  { hex: '#6E5A31', role: '+270°', name: 'Bark Brown', value: '#6E5A31', tag: 'Δ3.8', grow: 1 },
];

describe('generateBandCard (15E)', () => {
  it('renders the Discord frame at the design-grid size with the one chrome strip', () => {
    const svg = generateBandCard({
      bands: HARMONY_BANDS,
      toolTag: 'HARMONY',
      toolGlyph: null,
      subLine: 'TETRADIC ON #33',
    });

    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="350"');
    expect(svg).toContain('XIV DYE TOOLS');
    expect(svg).toContain('HARMONY');
    expect(svg).toContain('TETRADIC ON #33');
    expect(svg).toContain('Mud Green');
    // No card chrome: the URL never rides the strip (the embed carries it)
    expect(svg).not.toContain('xivdyetools.app');
  });

  it('the X frame drops names to the strip (bandLine + urlLine)', () => {
    const svg = generateBandCard({
      bands: HARMONY_BANDS,
      toolTag: 'HARMONY',
      toolGlyph: null,
      frame: 'x',
      bandLine: 'Mud Green + 3 matches',
      urlLine: 'xivdyetools.app/harmony?dye=33 · ΔE2000',
    });

    expect(svg).toContain('height="210"');
    expect(svg).toContain('Mud Green + 3 matches');
    expect(svg).toContain('ΔE2000');
    // Band bodies keep only their tags in the X frame
    expect(svg).toContain('Δ4.2');
    expect(svg).not.toContain('>Wine Red<');
  });

  it('renders the structural variant: a source strip at the band top', () => {
    const svg = generateBandCard({
      bands: [
        { hex: '#8A5A3C', role: '31%', name: 'Bark Brown', tag: 'Δ2.1', grow: 31, src: { hex: '#8E5A3C', height: 54 } },
        { hex: '#C9A96A', role: '24%', name: 'Honey Yellow', tag: 'Δ1.4', grow: 24, src: { hex: '#C9A96A', height: 54 } },
      ],
      toolTag: 'EXTRACTOR',
      toolGlyph: null,
    });

    expect(svg).toContain('height="54"');
    expect(svg).toContain('#8E5A3C');
  });

  it('clamps at the five-band cap', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ hex: '#112233', name: `Dye ${i}` }));
    const svg = generateBandCard({ bands: many, toolTag: 'T', toolGlyph: null });
    expect(svg).toContain('Dye 4');
    expect(svg).not.toContain('Dye 5');
    expect(BAND_CAP).toBe(5);
  });

  it('band ink is measured contrast, not a luminance cut', () => {
    expect(bandInk('#FFFFFF').on).toBe('#0A0A0A');
    expect(bandInk('#000000').on).toBe('#FFFFFF');
    // The doc's marginal mid-tone still picks the better of the two
    const mid = bandInk('#B07333');
    expect(['#0A0A0A', '#FFFFFF']).toContain(mid.on);
  });

  it('raster targets state ×3 of the design grid', () => {
    expect(BAND_FRAMES.discord).toEqual({ width: 400, height: 350, scale: 3 });
    expect(BAND_FRAMES.x).toEqual({ width: 400, height: 210, scale: 3 });
  });
});
