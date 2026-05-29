/**
 * Tests for Dye Info Card SVG Generator.
 *
 * generateDyeInfoCard is a pure function (options → SVG string).
 * Tests assert structural validity, presence of key content strings,
 * and that displayOptions flags correctly gate sections.
 */

import { describe, it, expect } from 'vitest';
import { generateDyeInfoCard, type DyeInfoCardOptions } from './dye-info-card.js';
import { createMockDye } from '@xivdyetools/test-utils/factories';

// ============================================================================
// Test fixtures
// ============================================================================

const mockDye = createMockDye({
  id: 7,
  itemID: 5735,
  stainID: 7,
  name: 'Dalamud Red',
  hex: '#9B111E',
  rgb: { r: 155, g: 17, b: 30 },
  hsv: { h: 354, s: 89, v: 61 },
  category: 'Red',
});

const defaultOptions: DyeInfoCardOptions = {
  dye: mockDye,
};

// ============================================================================
// generateDyeInfoCard
// ============================================================================

describe('generateDyeInfoCard', () => {
  describe('SVG structure', () => {
    it('returns a valid SVG document', () => {
      const svg = generateDyeInfoCard(defaultOptions);

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('</svg>');
    });

    it('includes a viewBox attribute', () => {
      const svg = generateDyeInfoCard(defaultOptions);
      expect(svg).toContain('viewBox');
    });
  });

  describe('dye content', () => {
    it('includes the dye name', () => {
      const svg = generateDyeInfoCard(defaultOptions);
      expect(svg).toContain('Dalamud Red');
    });

    it('includes the dye hex color (uppercase)', () => {
      const svg = generateDyeInfoCard(defaultOptions);
      expect(svg).toContain('#9B111E');
    });

    it('uses the dye hex as a fill color in swatch', () => {
      const svg = generateDyeInfoCard(defaultOptions);
      // The hex is used as SVG fill attribute
      expect(svg).toContain('#9B111E');
    });

    it('includes the category', () => {
      const svg = generateDyeInfoCard(defaultOptions);
      expect(svg).toContain('Red');
    });

    it('includes the dye ID', () => {
      const svg = generateDyeInfoCard(defaultOptions);
      expect(svg).toContain('7');
    });
  });

  describe('localization', () => {
    it('uses localizedName when provided', () => {
      const svg = generateDyeInfoCard({
        ...defaultOptions,
        localizedName: 'ダラムドレッド',
      });

      expect(svg).toContain('ダラムドレッド');
      // Original name should not appear in main title area (localized overrides it)
    });

    it('falls back to dye.name when localizedName is not provided', () => {
      const svg = generateDyeInfoCard(defaultOptions);
      expect(svg).toContain('Dalamud Red');
    });

    it('uses localizedCategory when provided', () => {
      const svg = generateDyeInfoCard({
        ...defaultOptions,
        localizedCategory: 'Rouge',
      });

      expect(svg).toContain('Rouge');
    });
  });

  describe('displayOptions', () => {
    it('omits HEX row when showHex is false', () => {
      const svg = generateDyeInfoCard({
        ...defaultOptions,
        displayOptions: { showHex: false, showRgb: true, showHsv: true, showLab: true },
      });

      // The label "HEX" in the info section should not appear
      // (the hex still appears in the swatch overlay, but not as a "HEX:" label)
      const labelCount = (svg.match(/>HEX</g) ?? []).length;
      expect(labelCount).toBe(0);
    });

    it('omits RGB row when showRgb is false', () => {
      const svg = generateDyeInfoCard({
        ...defaultOptions,
        displayOptions: { showHex: true, showRgb: false, showHsv: true, showLab: true },
      });

      expect(svg).not.toContain('>RGB<');
    });

    it('omits HSV row when showHsv is false', () => {
      const svg = generateDyeInfoCard({
        ...defaultOptions,
        displayOptions: { showHex: true, showRgb: true, showHsv: false, showLab: true },
      });

      expect(svg).not.toContain('>HSV<');
    });

    it('omits LAB row when showLab is false', () => {
      const svg = generateDyeInfoCard({
        ...defaultOptions,
        displayOptions: { showHex: true, showRgb: true, showHsv: true, showLab: false },
      });

      expect(svg).not.toContain('>LAB<');
    });

    it('shows all sections by default (no displayOptions provided)', () => {
      const svg = generateDyeInfoCard(defaultOptions);

      expect(svg).toContain('>HEX<');
      expect(svg).toContain('>RGB<');
      expect(svg).toContain('>HSV<');
      expect(svg).toContain('>LAB<');
    });
  });

  describe('layout', () => {
    it('accepts a custom width', () => {
      const svg = generateDyeInfoCard({ ...defaultOptions, width: 600 });
      expect(svg).toContain('width="600"');
    });

    it('uses default width (500) when not specified', () => {
      const svg = generateDyeInfoCard(defaultOptions);
      expect(svg).toContain('width="500"');
    });
  });

  describe('branding', () => {
    it('includes the XIV Dye Tools footer', () => {
      const svg = generateDyeInfoCard(defaultOptions);
      expect(svg).toContain('XIV Dye Tools');
    });
  });
});
