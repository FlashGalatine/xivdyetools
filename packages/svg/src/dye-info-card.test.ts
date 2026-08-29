/**
 * Tests for the 11B Dye Info sheet generator.
 *
 * generateDyeInfoCard is a pure function (options → SVG string). Tests
 * assert structural validity, the confirmed section content, band tiering
 * on the nearest strip, and theme behaviour.
 */

import { describe, it, expect } from 'vitest';
import { generateDyeInfoCard, type DyeInfoCardOptions } from './dye-info-card.js';
import { createMockDye } from '@xivdyetools/test-utils/factories';

// ============================================================================
// Test fixtures
// ============================================================================

const mockDye = createMockDye({
  id: 10,
  itemID: 5738,
  stainID: 10,
  name: 'Dalamud Red',
  hex: '#781A1A',
  rgb: { r: 120, g: 26, b: 26 },
  hsv: { h: 0, s: 78, v: 47 },
  category: 'Reds',
});

const defaultOptions: DyeInfoCardOptions = {
  dye: mockDye,
  localizedName: 'Dalamud Red',
  localizedCategory: 'Reds',
  stainID: 10,
  srcValue: 'Dye Vendor · 216 Gil',
  mktValue: 'Standard Spectrum Dye · 52254',
  nearest: [
    { hex: '#622207', name: 'Rust Red', deltaE: 8.74 },
    { hex: '#913B27', name: 'Blood Red', deltaE: 9.38 },
    { hex: '#470103', name: 'Metallic Ruby Red', deltaE: 10.77 },
  ],
  labels: {
    stain: 'STAIN',
    src: 'SRC',
    mkt: 'MKT',
    nearest: 'NEAREST DYES',
    nearestMore: '+1 more',
  },
  lang: 'en',
};

// ============================================================================
// generateDyeInfoCard
// ============================================================================

describe('generateDyeInfoCard', () => {
  it('returns a valid 400×350 SVG document', () => {
    const svg = generateDyeInfoCard(defaultOptions);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="350"');
    expect(svg).toContain('</svg>');
  });

  it('draws the header band in the dye colour with name, category and stain', () => {
    const svg = generateDyeInfoCard(defaultOptions);

    expect(svg).toContain('fill="#781A1A"');
    expect(svg).toContain('Dalamud Red');
    expect(svg).toContain('Reds');
    expect(svg).toContain('STAIN 10');
  });

  it('prints the numeric grid (HEX/RGB/HSV/LAB) at the type floor', () => {
    const svg = generateDyeInfoCard(defaultOptions);

    expect(svg).toContain('>HEX</text>');
    expect(svg).toContain('#781A1A');
    expect(svg).toContain('>120 26 26</text>');
    expect(svg).toContain('>0 78 47</text>');
    expect(svg).toContain('>LAB</text>');
  });

  it('carries SRC (with price) and MKT (verbatim Spectrum item) rows', () => {
    const svg = generateDyeInfoCard(defaultOptions);

    expect(svg).toContain('Dye Vendor · 216 Gil');
    expect(svg).toContain('Standard Spectrum Dye · 52254');
  });

  it('renders the nearest strip with tier-toned bars and the omitted count', () => {
    const svg = generateDyeInfoCard(defaultOptions);

    expect(svg).toContain('NEAREST DYES · +1 more');
    expect(svg).toContain('Rust Red');
    expect(svg).toContain('Metallic Ruby Red');
    // 8.74 is in the 5–10 match band → the second dark tier colour
    expect(svg).toContain('#8bc34a');
    // 10.77 is in the 10–20 band → the third tier colour
    expect(svg).toContain('#ffc107');
  });

  it('omits the "+N more" suffix when nothing is omitted', () => {
    const svg = generateDyeInfoCard({ ...defaultOptions, labels: { ...defaultOptions.labels, nearestMore: '' } });
    expect(svg).toContain('NEAREST DYES');
    expect(svg).not.toContain('NEAREST DYES ·');
  });

  it('hides the stain readout when stainID is null', () => {
    const svg = generateDyeInfoCard({ ...defaultOptions, stainID: null });
    expect(svg).not.toContain('STAIN 10');
  });

  it('localizes labels and number formatting', () => {
    const svg = generateDyeInfoCard({
      ...defaultOptions,
      labels: { stain: 'FARBNR.', src: 'QUELLE', mkt: 'MARKT', nearest: 'NÄCHSTE FARBSTOFFE', nearestMore: '+1 weitere' },
      srcValue: 'Farbstoffverkäufer · 216 Gil',
      lang: 'de',
    });

    expect(svg).toContain('FARBNR. 10');
    expect(svg).toContain('Farbstoffverkäufer · 216 Gil');
    // German decimal comma on the strip ΔE (8.74 → 8,7)
    expect(svg).toContain('8,7');
  });

  it('ships both themes on the same geometry', () => {
    const dark = generateDyeInfoCard(defaultOptions);
    const light = generateDyeInfoCard({ ...defaultOptions, theme: 'light' });

    expect(dark).toContain('#17171A');
    expect(light).toContain('#FFFFFF');
    expect(light).toContain('#E4E4E7');
    // Light tier ramp on the strip
    expect(light).toContain('#1C7D3A');
  });

  it('always renders the attribution mark, never a centred footer', () => {
    const svg = generateDyeInfoCard(defaultOptions);
    expect(svg).toContain('xivdyetools.app');
    expect(svg).not.toContain('Run again');
  });
});

// 2026-08-29: the dye names on the sheet are set in bold — the title and each
// nearest-dye caption — so the names read first, before the numbers.
describe('generateDyeInfoCard — name weight', () => {
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  it('sets the title and every nearest-dye name in bold (700)', () => {
    const svg = generateDyeInfoCard(defaultOptions);

    expect(svg).toMatch(new RegExp(`<text[^>]*font-weight="700"[^>]*>${escape('Dalamud Red')}</text>`));
    for (const n of defaultOptions.nearest) {
      expect(svg).toMatch(new RegExp(`<text[^>]*font-weight="700"[^>]*>${escape(n.name)}</text>`));
    }
  });
});

// 2026-08-29: the header band is the dye's own colour, so its ink is picked
// per dye by the frame's band-ink law — near-black on the ~60 light dyes
// (Pure White, Snow White, Honey Yellow …), white on the rest. Before this
// every band took white ink and a Pure White sheet had an invisible title.
describe('generateDyeInfoCard — band ink', () => {
  const pureWhite = createMockDye({
    id: 101,
    itemID: 13114,
    stainID: 101,
    name: 'Pure White',
    hex: '#F9F8F4',
    rgb: { r: 249, g: 248, b: 244 },
    hsv: { h: 48, s: 2, v: 98 },
    category: 'Special',
  });
  const lightOptions: DyeInfoCardOptions = {
    ...defaultOptions,
    dye: pureWhite,
    localizedName: 'Pure White',
    localizedCategory: 'Special',
    stainID: 101,
  };

  it('sets the name, stain readout, category and chip label in near-black ink on a light dye', () => {
    const svg = generateDyeInfoCard(lightOptions);

    expect(svg).toMatch(/<text[^>]*fill="#0A0A0A"[^>]*>Pure White<\/text>/);
    expect(svg).toMatch(/<text[^>]*fill="rgba\(10,10,10,0\.85\)"[^>]*>STAIN 101<\/text>/);
    expect(svg).toMatch(/<text[^>]*fill="rgba\(10,10,10,0\.72\)"[^>]*>Special<\/text>/);
    expect(svg).toMatch(/<text[^>]*fill="rgba\(10,10,10,0\.85\)"[^>]*>\/DYE INFO<\/text>/);
  });

  it('leaves no white ink on a light band — the chip glyph included', () => {
    const svg = generateDyeInfoCard(lightOptions);

    // The three white tiers the band used to hard-code; the glyph took the
    // 0.85 one as both its ink and its accent.
    expect(svg).not.toContain('rgba(255,255,255,0.85)');
    expect(svg).not.toContain('rgba(255,255,255,0.72)');
    expect(svg).not.toMatch(/<text[^>]*fill="#FFFFFF"[^>]*>Pure White<\/text>/);
  });

  it('keeps white ink on a dark dye', () => {
    const svg = generateDyeInfoCard(defaultOptions);

    expect(svg).toMatch(/<text[^>]*fill="#FFFFFF"[^>]*>Dalamud Red<\/text>/);
    expect(svg).toMatch(/<text[^>]*fill="rgba\(255,255,255,0\.85\)"[^>]*>STAIN 10<\/text>/);
    expect(svg).toMatch(/<text[^>]*fill="rgba\(255,255,255,0\.72\)"[^>]*>Reds<\/text>/);
    expect(svg).not.toContain('#0A0A0A');
  });

  it('picks the ink from the dye colour, not the card theme', () => {
    const light = generateDyeInfoCard({ ...lightOptions, theme: 'light' });
    const dark = generateDyeInfoCard({ ...defaultOptions, theme: 'light' });

    expect(light).toMatch(/<text[^>]*fill="#0A0A0A"[^>]*>Pure White<\/text>/);
    expect(dark).toMatch(/<text[^>]*fill="#FFFFFF"[^>]*>Dalamud Red<\/text>/);
  });
});
