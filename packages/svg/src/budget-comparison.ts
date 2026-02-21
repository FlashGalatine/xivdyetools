/**
 * Budget Comparison SVG Generator
 *
 * Generates a visual comparison of target dye vs budget alternatives.
 * Used by the /budget command to display results.
 *
 * Layout:
 * +----------------------------------------------------------+
 * |  BUDGET ALTERNATIVES FOR                                  |
 * |  [Target Swatch] Pure White    Target Price: 85,000 Gil   |
 * +----------------------------------------------------------+
 * |  [Alt Swatch] Snow White       Price: 5,000    Save: 94%  |
 * |               #E4DFD0          Distance: 12 (Excellent)   |
 * +----------------------------------------------------------+
 * |  [Alt Swatch] Ash Grey         Price: 2,500    Save: 97%  |
 * |               #8B8B8B          Distance: 28 (Good)        |
 * +----------------------------------------------------------+
 *
 * @module svg/budget-comparison
 */

import type { Dye } from '@xivdyetools/core';
import {
  createSvgDocument,
  rect,
  text,
  line,
  THEME,
  FONTS,
  escapeXml,
  getContrastTextColor,
} from './base.js';

// ============================================================================
// Local Types (minimal subset used by SVG rendering)
// ============================================================================

/**
 * Price data for a dye on the market board.
 * This interface is structurally compatible with the discord-worker's
 * richer DyePriceData type — only the fields needed for SVG rendering
 * are declared here.
 */
export interface DyePriceData {
  currentMinPrice: number;
  world: string;
  listingCount: number;
}

/**
 * A budget alternative suggestion.
 */
export interface BudgetSuggestion {
  dye: Dye;
  price: DyePriceData | null;
  colorDistance: number;
  savings: number;
  savingsPercent: number;
  valueScore: number;
}

/**
 * Sort option for budget results.
 */
export type BudgetSortOption = 'price' | 'color_match' | 'value_score';

/**
 * Format a Gil amount with locale-appropriate separators.
 */
export function formatGil(amount: number): string {
  return amount.toLocaleString('en-US');
}

// ============================================================================
// Types
// ============================================================================

/**
 * Translated labels for the budget comparison SVG
 *
 * Pre-resolved strings are ready to render as-is.
 * Template strings use {var} placeholders for per-row interpolation.
 */
export interface BudgetSvgLabels {
  /** Header title (e.g., "BUDGET ALTERNATIVES FOR") */
  headerLabel: string;
  /** Label above target price (e.g., "Target Price") */
  targetPriceLabel: string;
  /** No listings available (e.g., "No listings") */
  noListings: string;
  /** No alternatives found (e.g., "No cheaper alternatives found") */
  noAlternatives: string;
  /** Pre-resolved sort indicator (e.g., "Sorted by: Best Value") */
  sortedBy: string;
  /** Pre-resolved world subtitle (e.g., "on Aether") */
  onWorld: string;
  /** Template: "{amount} Gil" */
  gilAmountTemplate: string;
  /** Template: "Save {amount} ({percent}%)" */
  saveAmountTemplate: string;
  /** Template: "{count} listings" */
  listingCountTemplate: string;
  /** Translated distance quality labels */
  distanceQuality: {
    perfect: string;
    excellent: string;
    good: string;
    fair: string;
    approximate: string;
  };
  /** Localized dye names keyed by itemID (falls back to Dye.name if missing) */
  dyeNames: Record<number, string>;
  /** Localized category names keyed by English category (falls back to raw category if missing) */
  categoryNames: Record<string, string>;
}

/**
 * Options for generating the budget comparison SVG
 */
export interface BudgetComparisonOptions {
  /** The target dye (expensive one) */
  targetDye: Dye;
  /** Target dye's price (null if no listings) */
  targetPrice: DyePriceData | null;
  /** Alternative dye suggestions */
  alternatives: BudgetSuggestion[];
  /** World/datacenter used for prices */
  world: string;
  /** How results are sorted */
  sortBy: BudgetSortOption;
  /** Translated labels for all text in the SVG */
  labels: BudgetSvgLabels;
  /** Canvas width in pixels (default: 800) */
  width?: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 800;
const PADDING = 24;
const HEADER_HEIGHT = 120;
const ROW_HEIGHT = 90;
const SWATCH_SIZE = 56;
const TARGET_SWATCH_SIZE = 72;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Fill a template string with variable values
 *
 * @example fillTemplate("{amount} Gil", { amount: "5,000" }) → "5,000 Gil"
 */
function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''));
}

/**
 * Map a color distance value to a quality tier key
 */
function getDistanceQualityKey(distance: number): keyof BudgetSvgLabels['distanceQuality'] {
  if (distance === 0) return 'perfect';
  if (distance < 10) return 'excellent';
  if (distance < 25) return 'good';
  if (distance < 50) return 'fair';
  return 'approximate';
}

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Generate a budget comparison SVG showing target vs alternatives
 */
export function generateBudgetComparison(options: BudgetComparisonOptions): string {
  const {
    targetDye,
    targetPrice,
    alternatives,
    labels,
    width = DEFAULT_WIDTH,
  } = options;

  // Calculate dimensions
  const hasAlternatives = alternatives.length > 0;
  const contentHeight = hasAlternatives ? alternatives.length * ROW_HEIGHT : 60;
  const height = PADDING * 2 + HEADER_HEIGHT + contentHeight;

  const elements: string[] = [];

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  // Header section
  elements.push(generateHeader(targetDye, targetPrice, labels, width));

  // Separator after header
  elements.push(
    line(PADDING, HEADER_HEIGHT, width - PADDING, HEADER_HEIGHT, THEME.border, 2)
  );

  // Alternatives section
  if (hasAlternatives) {
    alternatives.forEach((alt, index) => {
      const rowY = HEADER_HEIGHT + index * ROW_HEIGHT;
      elements.push(generateAlternativeRow(alt, PADDING, rowY, width - PADDING * 2, targetPrice, labels));

      // Separator line (except after last row)
      if (index < alternatives.length - 1) {
        elements.push(
          line(
            PADDING + 20,
            rowY + ROW_HEIGHT,
            width - PADDING - 20,
            rowY + ROW_HEIGHT,
            THEME.border,
            1
          )
        );
      }
    });
  } else {
    // No alternatives found message
    elements.push(
      text(width / 2, HEADER_HEIGHT + 30, labels.noAlternatives, {
        fill: THEME.textMuted,
        fontSize: 16,
        fontFamily: FONTS.primaryCjk,
        textAnchor: 'middle',
      })
    );
  }

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Generate the header section with target dye info
 */
function generateHeader(
  targetDye: Dye,
  targetPrice: DyePriceData | null,
  labels: BudgetSvgLabels,
  width: number
): string {
  const elements: string[] = [];

  // Title
  elements.push(
    text(PADDING, 35, labels.headerLabel, {
      fill: THEME.textMuted,
      fontSize: 12,
      fontFamily: FONTS.primaryCjk,
      fontWeight: 500,
    })
  );

  // Target dye swatch
  const swatchY = 50;
  elements.push(
    rect(PADDING, swatchY, TARGET_SWATCH_SIZE, TARGET_SWATCH_SIZE, targetDye.hex, {
      rx: 8,
      ry: 8,
      stroke: THEME.accent,
      strokeWidth: 3,
    })
  );

  // Hex value on swatch
  const swatchTextColor = getContrastTextColor(targetDye.hex);
  elements.push(
    text(PADDING + TARGET_SWATCH_SIZE / 2, swatchY + TARGET_SWATCH_SIZE - 8, targetDye.hex.toUpperCase(), {
      fill: swatchTextColor,
      fontSize: 10,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    })
  );

  // Target dye name (localized)
  const infoX = PADDING + TARGET_SWATCH_SIZE + 16;
  const targetName = labels.dyeNames[targetDye.itemID] ?? targetDye.name;
  elements.push(
    text(infoX, 70, escapeXml(targetName), {
      fill: THEME.text,
      fontSize: 24,
      fontFamily: FONTS.headerCjk,
      fontWeight: 600,
    })
  );

  // Category (localized)
  const targetCategory = labels.categoryNames[targetDye.category] ?? targetDye.category;
  elements.push(
    text(infoX, 92, escapeXml(targetCategory), {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primaryCjk,
    })
  );

  // Price section (right side)
  const priceX = width - PADDING;

  if (targetPrice) {
    elements.push(
      text(priceX, 55, labels.targetPriceLabel, {
        fill: THEME.textMuted,
        fontSize: 10,
        fontFamily: FONTS.primaryCjk,
        fontWeight: 500,
        textAnchor: 'end',
      })
    );
    elements.push(
      text(priceX, 80, fillTemplate(labels.gilAmountTemplate, { amount: formatGil(targetPrice.currentMinPrice) }), {
        fill: THEME.warning,
        fontSize: 22,
        fontFamily: FONTS.header,
        fontWeight: 600,
        textAnchor: 'end',
      })
    );
    elements.push(
      text(priceX, 100, labels.onWorld, {
        fill: THEME.textDim,
        fontSize: 12,
        fontFamily: FONTS.primaryCjk,
        textAnchor: 'end',
      })
    );
  } else {
    elements.push(
      text(priceX, 70, labels.noListings, {
        fill: THEME.textMuted,
        fontSize: 16,
        fontFamily: FONTS.primaryCjk,
        textAnchor: 'end',
      })
    );
    elements.push(
      text(priceX, 92, labels.onWorld, {
        fill: THEME.textDim,
        fontSize: 12,
        fontFamily: FONTS.primaryCjk,
        textAnchor: 'end',
      })
    );
  }

  // Sort indicator
  elements.push(
    text(width / 2, HEADER_HEIGHT - 8, labels.sortedBy, {
      fill: THEME.textDim,
      fontSize: 11,
      fontFamily: FONTS.primaryCjk,
      textAnchor: 'middle',
    })
  );

  return elements.join('\n');
}

/**
 * Generate a row for an alternative dye
 */
function generateAlternativeRow(
  alt: BudgetSuggestion,
  x: number,
  y: number,
  width: number,
  targetPrice: DyePriceData | null,
  labels: BudgetSvgLabels
): string {
  const elements: string[] = [];
  const rowPadding = 12;

  // Row background
  elements.push(
    rect(x, y + 6, width, ROW_HEIGHT - 12, THEME.backgroundLight, {
      rx: 8,
      ry: 8,
      opacity: 0.5,
    })
  );

  // Dye swatch
  const swatchX = x + rowPadding;
  const swatchY = y + (ROW_HEIGHT - SWATCH_SIZE) / 2;
  elements.push(
    rect(swatchX, swatchY, SWATCH_SIZE, SWATCH_SIZE, alt.dye.hex, {
      rx: 6,
      ry: 6,
      stroke: THEME.border,
      strokeWidth: 2,
    })
  );

  // Dye name (localized) and hex
  const infoX = swatchX + SWATCH_SIZE + 14;
  const altName = labels.dyeNames[alt.dye.itemID] ?? alt.dye.name;
  elements.push(
    text(infoX, y + 35, escapeXml(altName), {
      fill: THEME.text,
      fontSize: 16,
      fontFamily: FONTS.primaryCjk,
      fontWeight: 600,
    })
  );
  elements.push(
    text(infoX, y + 55, alt.dye.hex.toUpperCase(), {
      fill: THEME.textDim,
      fontSize: 12,
      fontFamily: FONTS.mono,
    })
  );

  // Color distance badge (no emoji/Δ — fonts lack those glyphs in resvg)
  const qualityKey = getDistanceQualityKey(alt.colorDistance);
  const qualityLabel = labels.distanceQuality[qualityKey];
  const distanceText = `${qualityLabel} (dE ${alt.colorDistance.toFixed(1)})`;
  elements.push(
    text(infoX, y + 75, distanceText, {
      fill: THEME.textMuted,
      fontSize: 11,
      fontFamily: FONTS.primaryCjk,
    })
  );

  // Price section (right side)
  const priceX = x + width - rowPadding;

  if (alt.price) {
    // Price
    elements.push(
      text(priceX, y + 35, fillTemplate(labels.gilAmountTemplate, { amount: formatGil(alt.price.currentMinPrice) }), {
        fill: THEME.success,
        fontSize: 18,
        fontFamily: FONTS.header,
        fontWeight: 600,
        textAnchor: 'end',
      })
    );

    // Savings
    if (targetPrice && alt.savings > 0) {
      const savingsText = fillTemplate(labels.saveAmountTemplate, {
        amount: formatGil(alt.savings),
        percent: alt.savingsPercent.toFixed(0),
      });
      elements.push(
        text(priceX, y + 55, savingsText, {
          fill: THEME.accent,
          fontSize: 13,
          fontFamily: FONTS.primaryCjk,
          fontWeight: 500,
          textAnchor: 'end',
        })
      );
    }

    // Listings count
    elements.push(
      text(priceX, y + 75, fillTemplate(labels.listingCountTemplate, { count: alt.price.listingCount }), {
        fill: THEME.textDim,
        fontSize: 11,
        fontFamily: FONTS.primaryCjk,
        textAnchor: 'end',
      })
    );
  } else {
    elements.push(
      text(priceX, y + 50, labels.noListings, {
        fill: THEME.textMuted,
        fontSize: 14,
        fontFamily: FONTS.primaryCjk,
        textAnchor: 'end',
      })
    );
  }

  return elements.join('\n');
}

/**
 * Generate an empty state SVG when no world is set
 */
export function generateNoWorldSetSvg(width: number = DEFAULT_WIDTH): string {
  const height = 160;
  const elements: string[] = [];

  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  elements.push(
    text(width / 2, 60, 'No World Set', {
      fill: THEME.warning,
      fontSize: 24,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  elements.push(
    text(width / 2, 95, 'Use /budget set_world to set your preferred', {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  elements.push(
    text(width / 2, 115, 'world or datacenter for price lookups.', {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Generate an error state SVG
 */
export function generateErrorSvg(message: string, width: number = DEFAULT_WIDTH): string {
  const height = 120;
  const elements: string[] = [];

  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  elements.push(
    text(width / 2, 50, 'Error', {
      fill: THEME.error,
      fontSize: 20,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  elements.push(
    text(width / 2, 80, escapeXml(message), {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primary,
      textAnchor: 'middle',
    })
  );

  return createSvgDocument(width, height, elements.join('\n'));
}
