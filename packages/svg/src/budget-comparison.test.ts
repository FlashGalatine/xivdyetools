/**
 * Tests for Budget Comparison SVG Generator.
 *
 * Each generator is a pure function (data → SVG string), so tests assert:
 * - Output is a well-formed SVG document
 * - Content strings (labels, hex, dye names) appear in the output
 * - Edge cases (no alternatives, no price data) render without throwing
 */

import { describe, it, expect } from 'vitest';
import {
  generateBudgetComparison,
  generateNoWorldSetSvg,
  generateErrorSvg,
  formatGil,
  type BudgetSvgLabels,
  type BudgetComparisonOptions,
  type BudgetSuggestion,
  type DyePriceData,
} from './budget-comparison.js';
import { createMockDye } from '@xivdyetools/test-utils/factories';

// ============================================================================
// Test fixtures
// ============================================================================

const mockLabels: BudgetSvgLabels = {
  headerLabel: 'BUDGET ALTERNATIVES FOR',
  targetPriceLabel: 'Target Price',
  noListings: 'No listings',
  noAlternatives: 'No cheaper alternatives found',
  sortedBy: 'Sorted by: Best Value',
  onWorld: 'on Aether',
  gilAmountTemplate: '{amount} Gil',
  saveAmountTemplate: 'Save {amount} ({percent}%)',
  listingCountTemplate: '{count} listings',
  distanceQuality: {
    perfect: 'Perfect',
    excellent: 'Excellent',
    good: 'Good',
    fair: 'Fair',
    approximate: 'Approximate',
  },
  dyeNames: {},
  categoryNames: {},
};

const targetDye = createMockDye({
  id: 1,
  itemID: 5799,
  name: 'Pure White',
  hex: '#F0F0E0',
  rgb: { r: 240, g: 240, b: 224 },
  hsv: { h: 60, s: 7, v: 94 },
  category: 'White',
});

const targetPrice: DyePriceData = {
  currentMinPrice: 85000,
  world: 'Aether',
  listingCount: 12,
};

const altDye = createMockDye({
  id: 2,
  itemID: 5729,
  name: 'Snow White',
  hex: '#E4DFD0',
  rgb: { r: 228, g: 223, b: 208 },
  hsv: { h: 40, s: 9, v: 89 },
  category: 'White',
});

const altPrice: DyePriceData = {
  currentMinPrice: 5000,
  world: 'Aether',
  listingCount: 8,
};

const mockSuggestion: BudgetSuggestion = {
  dye: altDye,
  price: altPrice,
  colorDistance: 8.3,
  savings: 80000,
  savingsPercent: 94,
  valueScore: 92,
};

// ============================================================================
// generateBudgetComparison
// ============================================================================

describe('generateBudgetComparison', () => {
  it('returns a valid SVG document', () => {
    const opts: BudgetComparisonOptions = {
      targetDye,
      targetPrice,
      alternatives: [mockSuggestion],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    };

    const svg = generateBudgetComparison(opts);

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('</svg>');
  });

  it('includes target dye name', () => {
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice,
      alternatives: [mockSuggestion],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    });

    expect(svg).toContain('Pure White');
  });

  it('includes header label text', () => {
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice,
      alternatives: [mockSuggestion],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    });

    expect(svg).toContain('BUDGET ALTERNATIVES FOR');
  });

  it('includes alternative dye name', () => {
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice,
      alternatives: [mockSuggestion],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    });

    expect(svg).toContain('Snow White');
  });

  it('includes target dye hex color', () => {
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice,
      alternatives: [mockSuggestion],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    });

    expect(svg).toContain('F0F0E0');
  });

  it('shows noAlternatives message when alternatives list is empty', () => {
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice,
      alternatives: [],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    });

    expect(svg).toContain('No cheaper alternatives found');
  });

  it('handles null targetPrice (no listings for target)', () => {
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice: null,
      alternatives: [mockSuggestion],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('No listings');
  });

  it('handles alternative with null price', () => {
    const noPrice: BudgetSuggestion = { ...mockSuggestion, price: null };
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice,
      alternatives: [noPrice],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    });

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('No listings');
  });

  it('uses localized dye name from dyeNames map when available', () => {
    const labels = {
      ...mockLabels,
      dyeNames: { [targetDye.itemID]: '純白' },
    };
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice,
      alternatives: [],
      world: 'Aether',
      sortBy: 'value_score',
      labels,
    });

    expect(svg).toContain('純白');
  });

  it('accepts multiple alternatives and renders them all', () => {
    const secondAlt: BudgetSuggestion = {
      ...mockSuggestion,
      dye: createMockDye({ id: 3, name: 'Ash Grey', hex: '#8B8B8B' }),
      colorDistance: 28,
      savings: 82000,
      savingsPercent: 97,
    };
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice,
      alternatives: [mockSuggestion, secondAlt],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    });

    expect(svg).toContain('Snow White');
    expect(svg).toContain('Ash Grey');
  });

  it('respects custom width', () => {
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice,
      alternatives: [],
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
      width: 1000,
    });

    expect(svg).toContain('width="1000"');
  });
});

// ============================================================================
// generateNoWorldSetSvg
// ============================================================================

describe('generateNoWorldSetSvg', () => {
  it('returns a valid SVG document', () => {
    const svg = generateNoWorldSetSvg();
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('</svg>');
  });

  it('contains the "No World Set" prompt', () => {
    const svg = generateNoWorldSetSvg();
    expect(svg).toContain('No World Set');
  });

  it('accepts a custom width', () => {
    const svg = generateNoWorldSetSvg(600);
    expect(svg).toContain('width="600"');
  });
});

// ============================================================================
// generateErrorSvg
// ============================================================================

describe('generateErrorSvg', () => {
  it('returns a valid SVG document', () => {
    const svg = generateErrorSvg('Something went wrong');
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('</svg>');
  });

  it('includes the error message', () => {
    const svg = generateErrorSvg('API unavailable');
    expect(svg).toContain('API unavailable');
  });

  it('XML-escapes special characters in the error message', () => {
    const svg = generateErrorSvg('Error: <timeout> & retry');
    expect(svg).toContain('&lt;timeout&gt;');
    expect(svg).toContain('&amp;');
  });
});

// ============================================================================
// formatGil
// ============================================================================

describe('formatGil', () => {
  it('formats integers with thousand separators', () => {
    expect(formatGil(1000)).toBe('1,000');
    expect(formatGil(85000)).toBe('85,000');
    expect(formatGil(1000000)).toBe('1,000,000');
  });

  it('handles zero', () => {
    expect(formatGil(0)).toBe('0');
  });

  it('handles values under 1000', () => {
    expect(formatGil(500)).toBe('500');
    expect(formatGil(216)).toBe('216');
  });
});
