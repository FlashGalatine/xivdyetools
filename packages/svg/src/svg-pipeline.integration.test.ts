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
import { generateHarmonyCard } from './harmony-card.js';
import { generateBudgetComparison } from './budget-comparison.js';
import { generateDyeInfoCard, type DyeInfoLabels } from './dye-info-card.js';
import { generateRandomDyesGrid } from './random-dyes-grid.js';
import { createMockDye } from '@xivdyetools/test-utils/factories';
import type { BudgetSuggestion, DyePriceData } from './budget-comparison.js';

// Shared 5.0 card label fixtures (real keys ×6 land in bot-logic i18n)
const INFO_LABELS: DyeInfoLabels = {
  stain: 'STAIN',
  src: 'SRC',
  mkt: 'MKT',
  nearest: 'NEAREST DYES',
  nearestMore: '+1 more',
};
const GRID_LABELS = { name: 'DYE', cat: 'CATEGORY', stain: 'STAIN' };
const HARMONY_LABELS = { base: 'BASE', idealKey: 'outline = ideal · solid = found' };
const TIER_WORDS = ['EXACT', 'CLOSE', 'LOOSE', 'UNREACHABLE'] as const;

// ============================================================================
// Helpers
// ============================================================================

/** Asserts the string is a valid SVG document */
function expectValidSvg(svg: string) {
  expect(svg).toContain('<svg');
  expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(svg).toContain('</svg>');
}

/** Creates a mock DyePriceData with only the fields required by the SVG package */
function createMockPrice(_itemID: number, price: number): DyePriceData {
  return {
    currentMinPrice: price,
    world: 'Cactuar',
    listingCount: 10,
  };
}

// ============================================================================
// Harmony Wheel
// ============================================================================

describe('SVG Pipeline: Harmony Card (11A)', () => {
  const baseOptions = {
    typeLabel: 'Triadic',
    baseHex: '#781A1A',
    baseName: 'Dalamud Red',
    baseSubText: '#781A1A · STAIN 10',
    labels: HARMONY_LABELS,
    tierWords: TIER_WORDS,
    lang: 'en',
  };

  it('generates one row per slot with ideal-vs-found pair', () => {
    const svg = generateHarmonyCard({
      ...baseOptions,
      slots: [
        {
          idealHex: '#1A781A',
          hex: '#658241',
          localizedName: 'Cactuar Green',
          subText: '#658241 · STAIN 51',
          deltaE: 11.19,
        },
        {
          idealHex: '#1A1A78',
          hex: '#000B9D',
          localizedName: 'Dragoon Blue',
          subText: '#000B9D · STAIN 90',
          deltaE: 4.87,
        },
      ],
    });

    expectValidSvg(svg);
    expect(svg).toContain('Cactuar Green');
    expect(svg).toContain('Dragoon Blue');
    // Ideal swatches carry the outlined ring; found swatches the inset ring
    expect(svg).toContain('#1A781A');
    expect(svg).toContain('TRIADIC');
    // Harmony bands (display-rounded, core-calibrated): 4.9 < 6 is EXACT,
    // 11.2 < 12 is CLOSE
    expect(svg).toContain('EXACT');
    expect(svg).toContain('CLOSE');
    expect(svg).toContain('xivdyetools.app');
  });

  it('caps rows at three and renders a tail strip (R1)', () => {
    const slot = (i: number) => ({
      idealHex: null,
      hex: `#10101${i}`,
      localizedName: `Mono ${i}`,
      subText: `#10101${i}`,
      deltaE: null,
    });
    const svg = generateHarmonyCard({
      ...baseOptions,
      typeLabel: 'Monochromatic',
      slots: [slot(1), slot(2), slot(3), slot(4), slot(5)],
    });

    expectValidSvg(svg);
    expect(svg).toContain('Mono 3');
    // Slots past three become tail swatches, not rows
    expect(svg).not.toContain('Mono 4');
    expect(svg).toContain('+2');
  });

  it('never exceeds the 350 px ceiling', () => {
    const svg = generateHarmonyCard({
      ...baseOptions,
      slots: [
        {
          idealHex: '#00FF00',
          hex: '#00EE00',
          localizedName: 'Green',
          subText: '#00EE00',
          deltaE: 1,
        },
      ],
    });
    const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
    expect(svg).toContain('width="400"');
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

});

// ============================================================================
// Dye Info Card
// ============================================================================

describe('SVG Pipeline: Dye Info Card (11B)', () => {
  function infoOptions(overrides: Partial<Parameters<typeof generateDyeInfoCard>[0]> = {}) {
    return {
      dye: createMockDye({
        id: 10,
        itemID: 5738,
        stainID: 10,
        name: 'Dalamud Red',
        hex: '#781A1A',
        rgb: { r: 120, g: 26, b: 26 },
        hsv: { h: 0, s: 78, v: 47 },
        category: 'Reds',
      }),
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
      labels: INFO_LABELS,
      lang: 'en',
      ...overrides,
    };
  }

  it('generates the 400×350 sheet with all sections', () => {
    const svg = generateDyeInfoCard(infoOptions());

    expectValidSvg(svg);
    expect(svg).toContain('width="400"');
    expect(svg).toContain('height="350"');
    expect(svg).toContain('Dalamud Red');
    expect(svg).toContain('STAIN 10');
    expect(svg).toContain('#781A1A');
    // Numeric grid, SRC/MKT rows, nearest strip
    expect(svg).toContain('HEX');
    expect(svg).toContain('LAB');
    expect(svg).toContain('Dye Vendor · 216 Gil');
    expect(svg).toContain('Standard Spectrum Dye · 52254');
    expect(svg).toContain('NEAREST DYES · +1 more');
    expect(svg).toContain('Rust Red');
    expect(svg).toContain('xivdyetools.app');
  });

  it('uses localized name and category', () => {
    const svg = generateDyeInfoCard(
      infoOptions({ localizedName: 'Dalamudroter', localizedCategory: 'Rot' })
    );

    expectValidSvg(svg);
    expect(svg).toContain('Dalamudroter');
    expect(svg).toContain('Rot');
  });

  it('formats ΔE with the locale decimal separator', () => {
    const svg = generateDyeInfoCard(infoOptions({ lang: 'de' }));
    // 8.74 → display 8,7 in German
    expect(svg).toContain('8,7');
  });

  it('renders light theme surfaces when asked', () => {
    const svg = generateDyeInfoCard(infoOptions({ theme: 'light' }));
    expect(svg).toContain('#FFFFFF');
    expect(svg).toContain('#E4E4E7');
  });
});

// ============================================================================
// Random Dyes Grid
// ============================================================================

describe('SVG Pipeline: Random Dyes Grid (11B table)', () => {
  const row = (n: number, name: string, hex: string, category = 'Reds') => ({
    hex,
    localizedName: name,
    localizedCategory: category,
    stainID: n,
  });

  it('generates the table with multiple dyes and grows with the count', () => {
    const svg3 = generateRandomDyesGrid({
      dyes: [row(1, 'Snow White', '#FFFFFF'), row(2, 'Jet Black', '#000000'), row(3, 'Dalamud Red', '#C24D4D')],
      title: 'Random Dyes',
      labels: GRID_LABELS,
    });
    const svg5 = generateRandomDyesGrid({
      dyes: [
        row(1, 'A', '#111111'),
        row(2, 'B', '#222222'),
        row(3, 'C', '#333333'),
        row(4, 'D', '#444444'),
        row(5, 'E', '#555555'),
      ],
      title: 'Random Dyes',
      labels: GRID_LABELS,
    });

    expectValidSvg(svg3);
    expect(svg3).toContain('Snow White');
    expect(svg3).toContain('Dalamud Red');
    const h3 = Number(/height="(\d+)"/.exec(svg3)?.[1]);
    const h5 = Number(/height="(\d+)"/.exec(svg5)?.[1]);
    expect(h3).toBeLessThan(h5);
    expect(h5).toBeLessThanOrEqual(350);
  });

  it('caps at five rows (R1)', () => {
    const svg = generateRandomDyesGrid({
      dyes: [1, 2, 3, 4, 5, 6, 7].map((n) => row(n, `Dye ${n}`, '#101010')),
      title: 'Random Dyes',
      labels: GRID_LABELS,
    });
    expect(svg).toContain('Dye 5');
    expect(svg).not.toContain('Dye 6');
  });

  it('escapes CJK localized names in XML', () => {
    const svg = generateRandomDyesGrid({
      dyes: [row(1, 'スノウホワイト', '#FFFFFF', 'ホワイト')],
      title: 'ランダムカララント',
      labels: { name: 'カララント', cat: 'カテゴリ', stain: '番号' },
    });

    expectValidSvg(svg);
    // CJK characters should be present (and XML-safe)
    expect(svg).toContain('スノウホワイト');
    expect(svg).toContain('ランダムカララント');
  });

  it('prints the stain column and header labels', () => {
    const svg = generateRandomDyesGrid({
      dyes: [row(87, 'Cherry Pink', '#DC6B7E')],
      title: 'Random Dyes',
      labels: GRID_LABELS,
    });

    expectValidSvg(svg);
    expect(svg).toContain('>87</text>');
    expect(svg).toContain('CATEGORY');
  });
});

// ============================================================================
// Cross-Module Composition
// ============================================================================

describe('SVG Pipeline: Cross-Module Integration', () => {
  it('all 5.0 cards share the CARD_DARK surface and the mark', () => {
    const harmonyOut = generateHarmonyCard({
      typeLabel: 'Complementary',
      baseHex: '#FF0000',
      baseName: 'Red',
      baseSubText: '#FF0000',
      slots: [
        { idealHex: '#00FFFF', hex: '#00EEEE', localizedName: 'Cyan', subText: '#00EEEE', deltaE: 2 },
      ],
      labels: HARMONY_LABELS,
      tierWords: TIER_WORDS,
      lang: 'en',
    });

    const cardOut = generateDyeInfoCard({
      dye: createMockDye({ id: 1, name: 'Red', hex: '#FF0000', category: 'Reds' }),
      localizedName: 'Red',
      localizedCategory: 'Reds',
      stainID: 1,
      srcValue: 'Dye Vendor · 216 Gil',
      mktValue: '52254',
      nearest: [],
      labels: INFO_LABELS,
      lang: 'en',
    });

    const gridOut = generateRandomDyesGrid({
      dyes: [{ hex: '#FF0000', localizedName: 'Red', localizedCategory: 'Reds', stainID: 1 }],
      title: 'Random Dyes',
      labels: GRID_LABELS,
    });

    // All should share the CARD_DARK surface and the attribution mark
    for (const svg of [harmonyOut, cardOut, gridOut]) {
      expectValidSvg(svg);
      expect(svg).toContain('#17171A');
      expect(svg).toContain('xivdyetools.app');
    }
  });
});
