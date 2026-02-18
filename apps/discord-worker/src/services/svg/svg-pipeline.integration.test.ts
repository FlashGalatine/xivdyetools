/**
 * SVG Pipeline Integration Tests
 *
 * Tests multi-module SVG generation pipelines with real logic.
 * No WASM mocking needed — these generators produce SVG strings
 * that are later rendered to PNG by renderer.ts (a separate step).
 *
 * Validates: correct SVG structure, presence of expected elements,
 * color values, text content, and cross-module data flow.
 */

import { describe, it, expect } from 'vitest';
import { generateHarmonyWheel } from './harmony-wheel.js';
import { generateBudgetComparison, generateNoWorldSetSvg, generateErrorSvg } from './budget-comparison.js';
import { generateDyeInfoCard } from './dye-info-card.js';
import { generateRandomDyesGrid } from './random-dyes-grid.js';
import { createMockDye } from '../../test-utils.js';
import type { BudgetSuggestion, DyePriceData } from '../../types/budget.js';

// ============================================================================
// Helpers
// ============================================================================

/** Asserts the string is a valid SVG document */
function expectValidSvg(svg: string) {
  expect(svg).toContain('<svg');
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain('</svg>');
}

/** Creates a mock DyePriceData */
function createMockPrice(itemID: number, price: number): DyePriceData {
  return {
    itemID,
    currentAverage: price + 200,
    currentMinPrice: price,
    currentMaxPrice: price + 500,
    lastUpdate: Date.now(),
    world: 'Cactuar',
    listingCount: 10,
    fetchedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Harmony Wheel
// ============================================================================

describe('SVG Pipeline: Harmony Wheel', () => {
  it('generates valid SVG for triadic harmony', () => {
    const svg = generateHarmonyWheel({
      baseColor: '#FF6B6B',
      baseName: 'Salmon Pink',
      harmonyType: 'triadic',
      dyes: [
        { id: 1, name: 'Dalamud Red', hex: '#C24D4D', category: 'Red' },
        { id: 2, name: 'Coral Pink', hex: '#E88E8E', category: 'Red' },
        { id: 3, name: 'Rose Pink', hex: '#D48E8E', category: 'Red' },
      ],
    });

    expectValidSvg(svg);
    // Harmony wheel is purely visual — colored circles + paths, no text labels.
    // Verify structural elements: color wheel paths, dye node circles, dashed connector lines.
    expect(svg).toContain('<circle');
    expect(svg).toContain('<path');
    expect(svg).toContain('<line');
    // Should contain the dye hex colors as fill values
    expect(svg.toLowerCase()).toContain('#c24d4d');
    expect(svg.toLowerCase()).toContain('#e88e8e');
  });

  it('generates SVG with custom dimensions', () => {
    const svg = generateHarmonyWheel({
      baseColor: '#4ECDC4',
      harmonyType: 'complementary',
      dyes: [{ id: 1, name: 'Turquoise Blue', hex: '#3EC8C0', category: 'Blue' }],
      width: 600,
      height: 600,
    });

    expectValidSvg(svg);
    expect(svg).toContain('width="600"');
    expect(svg).toContain('height="600"');
  });

  it('generates SVG with no matching dyes', () => {
    const svg = generateHarmonyWheel({
      baseColor: '#FF0000',
      harmonyType: 'analogous',
      dyes: [],
    });

    expectValidSvg(svg);
  });

  it('renders dye nodes positioned on the color wheel', () => {
    const svg = generateHarmonyWheel({
      baseColor: '#FF0000',
      harmonyType: 'triadic',
      dyes: [
        { id: 1, name: 'Red Dye', hex: '#FF0000', category: 'Red' },
        { id: 2, name: 'Green Dye', hex: '#00FF00', category: 'Green' },
        { id: 3, name: 'Blue Dye', hex: '#0000FF', category: 'Blue' },
      ],
    });

    expectValidSvg(svg);
    // Each dye should have a circle node with its fill color
    expect(svg.toLowerCase()).toContain('#ff0000');
    expect(svg.toLowerCase()).toContain('#00ff00');
    expect(svg.toLowerCase()).toContain('#0000ff');
    // Should have dashed connector lines (stroke-dasharray)
    expect(svg).toContain('stroke-dasharray');
  });
});

// ============================================================================
// Budget Comparison
// ============================================================================

describe('SVG Pipeline: Budget Comparison', () => {
  const targetDye = createMockDye({
    id: 1,
    name: 'Pure White',
    hex: '#FFFFFF',
    category: 'Metallic',
    itemID: 5820,
  });

  const mockLabels = {
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
    dyeNames: { 5820: 'Pure White', 5701: 'Snow White', 5702: 'Ash Grey' },
    categoryNames: { Metallic: 'Metallic', White: 'White', Grey: 'Grey' },
  };

  it('generates valid SVG with alternatives', () => {
    const alternatives: BudgetSuggestion[] = [
      {
        dye: createMockDye({ id: 2, name: 'Snow White', hex: '#EEEEEE', category: 'White', itemID: 5701 }),
        price: createMockPrice(5701, 500),
        colorDistance: 5.2,
        savings: 49500,
        savingsPercent: 99,
        valueScore: 10.9,
      },
      {
        dye: createMockDye({ id: 3, name: 'Ash Grey', hex: '#CCCCCC', category: 'Grey', itemID: 5702 }),
        price: createMockPrice(5702, 200),
        colorDistance: 20.1,
        savings: 49800,
        savingsPercent: 99.6,
        valueScore: 40.4,
      },
    ];

    const svg = generateBudgetComparison({
      targetDye,
      targetPrice: createMockPrice(5820, 50000),
      alternatives,
      world: 'Aether',
      sortBy: 'value_score',
      labels: mockLabels,
    });

    expectValidSvg(svg);
    // Should contain dye names and price-related text
    expect(svg).toContain('Pure White');
    expect(svg).toContain('Snow White');
    expect(svg).toContain('Ash Grey');
  });

  it('generates SVG when target has no listings', () => {
    const svg = generateBudgetComparison({
      targetDye,
      targetPrice: null,
      alternatives: [],
      world: 'Aether',
      sortBy: 'price',
      labels: mockLabels,
    });

    expectValidSvg(svg);
    expect(svg).toContain('No listings');
  });

  it('generates no-world-set SVG', () => {
    const svg = generateNoWorldSetSvg();
    expectValidSvg(svg);
  });

  it('generates error SVG with custom message', () => {
    const svg = generateErrorSvg('Market board unavailable');
    expectValidSvg(svg);
    expect(svg).toContain('Market board unavailable');
  });
});

// ============================================================================
// Dye Info Card
// ============================================================================

describe('SVG Pipeline: Dye Info Card', () => {
  it('generates valid card with all dye properties', () => {
    const dye = createMockDye({
      id: 42,
      name: 'Metallic Gold',
      hex: '#FFD700',
      category: 'Metallic',
      itemID: 5900,
      isMetallic: true,
    });

    const svg = generateDyeInfoCard({ dye });

    expectValidSvg(svg);
    // Should contain the dye name and hex
    expect(svg).toContain('Metallic Gold');
    expect(svg).toContain('#FFD700');
    // Should contain the category
    expect(svg).toContain('Metallic');
  });

  it('uses localized name and category when provided', () => {
    const dye = createMockDye({
      id: 1,
      name: 'Snow White',
      hex: '#FFFFFF',
      category: 'White',
    });

    const svg = generateDyeInfoCard({
      dye,
      localizedName: 'Schneeweiß',
      localizedCategory: 'Weiß',
    });

    expectValidSvg(svg);
    expect(svg).toContain('Schneeweiß');
  });

  it('integrates with color-blending rgbToLab for LAB values', () => {
    // This test validates the cross-module dependency:
    // dye-info-card.ts imports rgbToLab from color-blending.ts
    const dye = createMockDye({
      id: 1,
      name: 'Dalamud Red',
      hex: '#C24D4D',
      category: 'Red',
    });

    const svg = generateDyeInfoCard({ dye });

    expectValidSvg(svg);
    // Should contain LAB label and computed values (e.g., "48.7, 46.9, 24.4")
    expect(svg).toContain('>LAB<');
    // LAB values are in a separate text element: comma-separated decimals
    expect(svg).toMatch(/\d+\.\d+,\s*\d+\.\d+,\s*\d+\.\d+/);
  });

  it('handles custom dimensions', () => {
    const dye = createMockDye({ id: 1, name: 'Test', hex: '#808080' });
    const svg = generateDyeInfoCard({ dye, width: 600 });

    expectValidSvg(svg);
    expect(svg).toContain('width="600"');
  });
});

// ============================================================================
// Random Dyes Grid
// ============================================================================

describe('SVG Pipeline: Random Dyes Grid', () => {
  it('generates grid with multiple dyes', () => {
    const dyes = [
      {
        dye: createMockDye({ id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'White' }),
        localizedName: 'Snow White',
        localizedCategory: 'White',
      },
      {
        dye: createMockDye({ id: 2, name: 'Jet Black', hex: '#000000', category: 'Black' }),
        localizedName: 'Jet Black',
        localizedCategory: 'Black',
      },
      {
        dye: createMockDye({ id: 3, name: 'Dalamud Red', hex: '#C24D4D', category: 'Red' }),
        localizedName: 'Dalamud Red',
        localizedCategory: 'Red',
      },
    ];

    const svg = generateRandomDyesGrid({ dyes });

    expectValidSvg(svg);
    expect(svg).toContain('Snow White');
    expect(svg).toContain('Jet Black');
    expect(svg).toContain('Dalamud Red');
  });

  it('generates grid with single dye', () => {
    const svg = generateRandomDyesGrid({
      dyes: [{
        dye: createMockDye({ id: 1, name: 'Test Dye', hex: '#FF0000', category: 'Red' }),
        localizedName: 'Test Dye',
        localizedCategory: 'Red',
      }],
    });

    expectValidSvg(svg);
    expect(svg).toContain('Test Dye');
  });

  it('escapes CJK localized names in XML', () => {
    const svg = generateRandomDyesGrid({
      dyes: [{
        dye: createMockDye({ id: 1, name: 'Snow White', hex: '#FFFFFF', category: 'White' }),
        localizedName: 'スノウホワイト',
        localizedCategory: 'ホワイト',
      }],
    });

    expectValidSvg(svg);
    // CJK characters should be present (and XML-safe)
    expect(svg).toContain('スノウホワイト');
  });

  it('handles custom title', () => {
    const svg = generateRandomDyesGrid({
      dyes: [{
        dye: createMockDye({ id: 1, name: 'Test', hex: '#000000', category: 'Black' }),
        localizedName: 'Test',
        localizedCategory: 'Black',
      }],
      title: 'My Custom Title',
    });

    expectValidSvg(svg);
    expect(svg).toContain('My Custom Title');
  });
});

// ============================================================================
// Cross-Module Composition
// ============================================================================

describe('SVG Pipeline: Cross-Module Integration', () => {
  it('all generators produce non-empty SVG with shared THEME colors', () => {
    // The THEME.background (#1a1a2e) should appear in all generator outputs
    const harmonyOut = generateHarmonyWheel({
      baseColor: '#FF0000',
      harmonyType: 'complementary',
      dyes: [{ id: 1, name: 'Red', hex: '#FF0000' }],
    });

    const cardOut = generateDyeInfoCard({
      dye: createMockDye({ id: 1, name: 'Red', hex: '#FF0000', category: 'Red' }),
    });

    const gridOut = generateRandomDyesGrid({
      dyes: [{
        dye: createMockDye({ id: 1, name: 'Red', hex: '#FF0000', category: 'Red' }),
        localizedName: 'Red',
        localizedCategory: 'Red',
      }],
    });

    // All should use the shared dark theme background
    for (const svg of [harmonyOut, cardOut, gridOut]) {
      expectValidSvg(svg);
      expect(svg).toContain('#1a1a2e');
    }
  });
});
