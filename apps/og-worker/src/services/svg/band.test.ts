/**
 * 15E band frame tests — the drawn geometry, the shared chrome, the band
 * ink law, and the one degrade rule that separates the two frames.
 */
import { describe, it, expect } from 'vitest';
import {
  generateBandCard,
  bandInk,
  cardFooter,
  cardHeader,
  xStrip,
  BAND_FRAMES,
  BAND_CAP,
  DECK_H,
  FOOTER_H,
  HEADER_H,
} from './band';
import { generateDefaultCard } from './default-card';

const HARMONY_BANDS = [
  { hex: '#4C6E31', role: 'BASE', name: 'Mud Green', value: '#4C6E31', tag: '#33', grow: 2, nameSize: 17 },
  { hex: '#7A3C3C', role: '+90°', name: 'Wine Red', value: '#7A3C3C', tag: 'Δ4.2', grow: 1 },
  { hex: '#31556E', role: '+180°', name: 'Ink Blue', value: '#31556E', tag: 'Δ6.1', grow: 1 },
  { hex: '#6E5A31', role: '+270°', name: 'Bark Brown', value: '#6E5A31', tag: 'Δ3.8', grow: 1 },
];

const base = {
  bands: HARMONY_BANDS,
  toolTag: 'HARMONY',
  toolGlyph: null,
  path: 'xivdyetools.app/harmony',
};

describe('generateBandCard (15E)', () => {
  it('renders the Discord frame at the design-grid size with header, deck and footer', () => {
    const svg = generateBandCard({ ...base, deck: 'Mud Green · Tetradic', footRight: 'ΔE2000' });

    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="350"');
    expect(svg).toContain('XIV DYE TOOLS');
    expect(svg).toContain('HARMONY');
    expect(svg).toContain('Mud Green · Tetradic');
    expect(svg).toContain('xivdyetools.app/harmony');
    expect(svg).toContain('ΔE2000');
    expect(svg).toContain('Mud Green');
  });

  it('the footer prints the path only — a query string would clip, not reflow', () => {
    const svg = generateBandCard({ ...base, deck: 'x' });
    expect(svg).not.toContain('?dye=');
    expect(svg).not.toContain('https://');
  });

  it('the X frame drops the deck but keeps the in-band content unchanged', () => {
    const discord = generateBandCard({ ...base, deck: 'Mud Green · Tetradic', footRight: 'ΔE2000' });
    const x = generateBandCard({
      ...base,
      frame: 'x',
      deck: 'Mud Green · Tetradic',
      footRight: 'ΔE2000',
    });

    expect(x).toContain('height="210"');
    // The deck is Discord-only; passing it on X is a no-op, not a draw
    expect(discord).toContain('Mud Green · Tetradic');
    expect(x).not.toContain('Mud Green · Tetradic');
    // Names, roles and tags all survive — only the frame got shorter
    expect(x).toContain('>Wine Red<');
    expect(x).toContain('>Mud Green<');
    expect(x).toContain('Δ4.2');
    expect(x).toContain('+180°');
  });

  it('the X band field is 154px — 210 less the same 30/26 chrome', () => {
    expect(BAND_FRAMES.x.height - HEADER_H - FOOTER_H).toBe(154);
  });

  it('the source strip keeps its proportion on X, not its absolute height', () => {
    // The degrade rule as stated: 52 → 34, 54 → 36, 46 → 30
    expect(xStrip(52)).toBe(34);
    expect(xStrip(54)).toBe(36);
    expect(xStrip(46)).toBe(30);
  });

  it('renders the structural variant: a source strip at the band top', () => {
    const svg = generateBandCard({
      bands: [
        { hex: '#8A5A3C', role: '31%', name: 'Bark Brown', tag: 'Δ2.1', grow: 31, src: { hex: '#8E5A3C', height: 54 } },
        { hex: '#C9A96A', role: '24%', name: 'Honey Yellow', tag: 'Δ1.4', grow: 24, src: { hex: '#C9A96A', height: 54 } },
      ],
      toolTag: 'EXTRACT',
      toolGlyph: null,
      path: 'xivdyetools.app/extractor',
    });

    expect(svg).toContain('height="54"');
    expect(svg).toContain('#8E5A3C');
    // The strip hangs off the band field, not off the frame top
    expect(svg).toContain(`y="${HEADER_H}"`);
  });

  it('clamps at the five-band cap', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ hex: '#112233', name: `Dye ${i}` }));
    const svg = generateBandCard({ bands: many, toolTag: 'T', toolGlyph: null, path: 'x' });
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

  it('the chrome zones are the confirmed 30 / 36 / 26', () => {
    expect(HEADER_H).toBe(30);
    expect(DECK_H).toBe(36);
    expect(FOOTER_H).toBe(26);
  });
});

/** The mark's clipPath id carries a per-call counter — normalise it away. */
const stripMarkUid = (svg: string): string => svg.replace(/ogm\d+b/g, 'ogmXb');

describe('the shared chrome', () => {
  it('a band card and a default card emit identical Discord headers', () => {
    const header = stripMarkUid(cardHeader(400, { toolTag: null, toolGlyph: null }));

    const bandCard = stripMarkUid(
      generateBandCard({
        bands: HARMONY_BANDS,
        toolTag: '',
        toolGlyph: null,
        path: 'xivdyetools.app/harmony',
      })
    );
    const defaultCard = stripMarkUid(
      generateDefaultCard({
        tool: null,
        name: 'Color Harmony',
        sub: 'Build a palette around any dye.',
        path: 'xivdyetools.app/harmony',
      })
    );

    expect(bandCard).toContain(header);
    expect(defaultCard).toContain(header);
    expect(header).toContain('XIV DYE TOOLS');
  });

  it('a band card and a default card emit identical Discord footers', () => {
    const footer = cardFooter(400, 350, { path: 'xivdyetools.app/budget', right: 'ΔE2000' });

    expect(
      generateBandCard({
        bands: HARMONY_BANDS,
        toolTag: 'BUDGET',
        toolGlyph: null,
        path: 'xivdyetools.app/budget',
        footRight: 'ΔE2000',
      })
    ).toContain(footer);

    expect(
      generateDefaultCard({
        tool: null,
        name: 'Budget',
        sub: 'The cheapest dye near the one you want.',
        path: 'xivdyetools.app/budget',
        methodTag: 'ΔE2000',
      })
    ).toContain(footer);
  });

  it('the mark is the OG doc #ogmark — six spill stripes, the bucket outline, a purple pour', () => {
    const header = cardHeader(400, { toolTag: null, toolGlyph: null });
    expect(header).toContain('<rect width="48" height="48" rx="11" fill="#CE2222"/>');
    expect(header).toContain('<rect x="30" y="16" width="5" height="30" fill="#0091FF"/>');
    expect(header).toContain('<rect x="35" y="16" width="6" height="30" fill="#8E4EC6"/>');
    expect(header).toContain('stroke="#C8CCD5" stroke-width="1.4"');
    expect(header).toContain('<ellipse cx="24" cy="17" rx="14" ry="5.4" fill="#FBFBFC"/>');
    expect(header).toContain('<ellipse cx="24" cy="17" rx="9.6" ry="3.4" fill="#8E4EC6"/>');
  });
});
