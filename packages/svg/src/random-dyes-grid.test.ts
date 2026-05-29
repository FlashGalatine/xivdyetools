/**
 * Tests for Random Dyes Grid SVG Generator.
 *
 * generateRandomDyesGrid is a pure function (options → SVG string).
 * Tests assert structural validity, dye content presence,
 * layout mode behaviour (uniqueCategories), and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  generateRandomDyesGrid,
  type RandomDyeInfo,
  type RandomDyesGridOptions,
} from './random-dyes-grid.js';
import { createMockDye } from '@xivdyetools/test-utils/factories';

// ============================================================================
// Test fixtures
// ============================================================================

function makeDyeInfo(id: number, name: string, hex: string, category = 'Basic'): RandomDyeInfo {
  return {
    dye: createMockDye({ id, name, hex, category }),
    localizedName: name,
    localizedCategory: category,
  };
}

const fiveDyes: RandomDyeInfo[] = [
  makeDyeInfo(1, 'Bone White', '#F0EBE0', 'White'),
  makeDyeInfo(2, 'Dalamud Red', '#9B111E', 'Red'),
  makeDyeInfo(3, 'Celeste Green', '#50C878', 'Green'),
  makeDyeInfo(4, 'Storm Blue', '#2255AA', 'Blue'),
  makeDyeInfo(5, 'Soot Black', '#1C1C1C', 'Black'),
];

// ============================================================================
// generateRandomDyesGrid
// ============================================================================

describe('generateRandomDyesGrid', () => {
  describe('SVG structure', () => {
    it('returns a valid SVG document', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes });

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('</svg>');
    });

    it('includes a viewBox attribute', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes });
      expect(svg).toContain('viewBox');
    });
  });

  describe('dye content', () => {
    it('includes all dye names', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes });

      expect(svg).toContain('Bone White');
      expect(svg).toContain('Dalamud Red');
      expect(svg).toContain('Celeste Green');
      expect(svg).toContain('Storm Blue');
      expect(svg).toContain('Soot Black');
    });

    it('includes dye hex colors as fill attributes', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes });

      expect(svg).toContain('#F0EBE0');
      expect(svg).toContain('#9B111E');
    });

    it('includes category labels', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes });

      expect(svg).toContain('White');
      expect(svg).toContain('Red');
    });
  });

  describe('title', () => {
    it('uses default title when not specified', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes });
      // Default title contains the dice emoji text or a text node with the title string
      expect(svg).toContain('Random Dyes');
    });

    it('uses custom title when provided', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes, title: 'My Picks' });
      expect(svg).toContain('My Picks');
    });
  });

  describe('subtitle / mode', () => {
    it('shows count subtitle in random mode', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes });
      expect(svg).toContain('5 randomly selected dyes');
    });

    it('shows uniqueCategories subtitle when flag is set', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes, uniqueCategories: true });
      expect(svg).toContain('One from each category');
    });
  });

  describe('layout', () => {
    it('accepts a custom width', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes, width: 800 });
      expect(svg).toContain('width="800"');
    });

    it('uses default width (600) when not specified', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes });
      expect(svg).toContain('width="600"');
    });
  });

  describe('edge cases', () => {
    it('renders correctly with a single dye', () => {
      const svg = generateRandomDyesGrid({ dyes: [fiveDyes[0]] });

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('Bone White');
    });

    it('renders correctly with an empty dye list', () => {
      const svg = generateRandomDyesGrid({ dyes: [] });

      expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('</svg>');
    });

    it('renders correctly with fewer than 3 dyes (partial first row)', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes.slice(0, 2) });

      expect(svg).toContain('Bone White');
      expect(svg).toContain('Dalamud Red');
    });

    it('truncates long dye names (adds ellipsis for names > 18 chars)', () => {
      const longName = makeDyeInfo(99, 'A Very Long Dye Name Indeed', '#123456');
      const svg = generateRandomDyesGrid({ dyes: [longName] });

      // The full name is 27 chars, truncation limit is 18 — expect ellipsis
      expect(svg).toContain('…');
    });
  });

  describe('branding', () => {
    it('includes XIV Dye Tools footer', () => {
      const svg = generateRandomDyesGrid({ dyes: fiveDyes });
      expect(svg).toContain('XIV Dye Tools');
    });
  });
});
