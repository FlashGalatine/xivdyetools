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
import { generateBudgetLedger, type BudgetLedgerGroup } from './budget-ledger.js';
import { generateDyeInfoCard, type DyeInfoLabels } from './dye-info-card.js';
import { generateRandomDyesGrid } from './random-dyes-grid.js';
import { createMockDye } from '@xivdyetools/test-utils/factories';

// Shared 5.0 card label fixtures (real keys ×6 land in bot-logic i18n)
const INFO_LABELS: DyeInfoLabels = {
  stain: 'STAIN',
  src: 'SRC',
  mkt: 'MKT',
  nearest: 'NEAREST DYES',
  nearestMore: '+1 more',
};
const GRID_LABELS = { name: 'DYE', cat: 'CATEGORY', stain: 'STAIN' };
const HARMONY_LABELS = {
  base: 'BASE',
  ideal: 'IDEAL HUE',
  found: 'NEAREST DYE',
  bandKey: 'bands: ≤6 / ≤12 / ≤20',
  derivedNote: 'ΔE2000-derived',
};
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


// ============================================================================
// Harmony Wheel
// ============================================================================

describe('SVG Pipeline: Harmony Card (11A)', () => {
  const baseOptions = {
    typeLabel: 'Triadic',
    baseHex: '#781A1A',
    baseName: 'Dalamud Red',
    baseAngle: '0°',
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
          angleLabel: '120°',
        },
        {
          idealHex: '#1A1A78',
          hex: '#000B9D',
          localizedName: 'Dragoon Blue',
          subText: '#000B9D · STAIN 90',
          deltaE: 4.87,
          angleLabel: '240°',
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

  it('caps rows at four and renders a tail strip (R1)', () => {
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
    // Turn 13 re-measured 11A: 39 px rows hold base + FOUR slots at 350
    expect(svg).toContain('Mono 4');
    // Slots past four become tail swatches, not rows
    expect(svg).not.toContain('Mono 5');
    expect(svg).toContain('+1');
  });

  it('holds the worst case — four slots, verdict and an off-default method — under 350', () => {
    // Turn 13's measurement, as a guard: past 350 Discord contracts the box
    // horizontally and every type size in it shrinks again.
    const slot = (i: number) => ({
      idealHex: '#1A781A',
      hex: `#65824${i}`,
      localizedName: 'Metallic kobaltgrüner',
      subText: '#658241 · FARBNR. 124',
      deltaE: 12.34,
      angleLabel: `${i * 90}°`,
    });
    const svg = generateHarmonyCard({
      ...baseOptions,
      typeLabel: 'Tetradisch',
      slots: [slot(1), slot(2), slot(3), slot(4)],
      verdict: '270° · Metallic kobaltgrüner · 12,3',
      method: 'redmean',
      lang: 'de',
    });

    const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
    // All four slots are rows, not a tail
    expect(svg).not.toContain('+1');
    // The method is printed wherever a tier or verdict appears
    expect(svg).toContain('REDMEAN');
    expect(svg).toContain('↓');
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
// Budget Ledger (13G)
// ============================================================================

describe('SVG Pipeline: Budget Ledger (13G)', () => {
  const LEDGER_LABELS = {
    lTarget: 'TARGET',
    lCandidate: 'CANDIDATE',
    deLabel: 'ΔE',
    perDeLabel: 'GIL/ΔE',
    keyLines: ['GIL/ΔE = (TARGET − ROW) ÷ ΔE2000'],
  };
  const GROUPS: BudgetLedgerGroup[] = [
    {
      tier: 'Standard Spectrum Dye',
      price: '216 GIL',
      flag: 'VENDOR CHEAPER',
      rows: [
        { hex: '#2F2C2B', name: 'Soot Black', de: '5.2', tier: 1, perDe: '13.6k' },
        { hex: '#1B2A3E', name: 'Ink Blue', de: '5.4', tier: 1, perDe: '13.2k' },
        { hex: '#3A2141', name: 'Currant Purple', de: '11.2', tier: 2, perDe: '6.3k' },
      ],
    },
    {
      tier: 'Venture Coffers',
      price: '41,200 GIL',
      rows: [{ hex: '#3F3329', name: 'Dark Brown', de: '5.3', tier: 1, perDe: '5.7k' }],
    },
  ];

  it('renders the drawn frame: two groups, four rows, one price per group', () => {
    const svg = generateBudgetLedger({
      target: { hex: '#1F1D1A', name: 'Jet Black', price: '71,400 GIL', subLabel: 'board only' },
      groups: GROUPS,
      labels: LEDGER_LABELS,
      lang: 'en',
    });

    expectValidSvg(svg);
    expect(svg).toContain('Jet Black');
    expect(svg).toContain('71,400 GIL');
    expect(svg).toContain('Standard Spectrum Dye');
    expect(svg).toContain('VENDOR CHEAPER');
    expect(svg).toContain('Venture Coffers');
    expect(svg).toContain('13.6k');
    // Rows are priceless — the only prices are the two group figures + target
    expect(svg).toContain('216 GIL');
    expect(svg).toContain('41,200 GIL');
    expect(svg).toContain('/BUDGET');
    const height = Number(/height="(\d+)"/.exec(svg)?.[1]);
    expect(height).toBeLessThanOrEqual(350);
  });

  it('blanks, never invents: null prices and ratios print em dashes', () => {
    const svg = generateBudgetLedger({
      target: { hex: '#1F1D1A', name: 'Jet Black', price: null, subLabel: 'no price' },
      groups: [
        {
          tier: 'Standard Spectrum Dye',
          price: '216 GIL',
          rows: [{ hex: '#2F2C2B', name: 'Soot Black', de: '5.2', tier: 1, perDe: null }],
        },
      ],
      labels: LEDGER_LABELS,
      lang: 'en',
    });

    expectValidSvg(svg);
    expect(svg).toContain('—');
    expect(svg).toContain('no price');
  });

  it('renders a second footer key line off-ΔE2000', () => {
    const svg = generateBudgetLedger({
      target: { hex: '#1F1D1A', name: 'Jet Black', price: '71,400 GIL', subLabel: 'board only' },
      groups: GROUPS,
      labels: {
        ...LEDGER_LABELS,
        deLabel: 'RGB',
        keyLines: ['GIL/ΔE = (TARGET − ROW) ÷ ΔE2000', 'ΔE column: RGB DIST · ratio stays ΔE2000'],
      },
      lang: 'en',
      wideDe: true,
    });

    expectValidSvg(svg);
    expect(svg).toContain('ratio stays ΔE2000');
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
      baseAngle: '0°',
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
