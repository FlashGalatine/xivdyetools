/**
 * Preset Swatch SVG Generator
 *
 * Generates a visual display of preset color palettes.
 * Shows the preset name, description, and color swatches with dye names.
 *
 * **The 5.0 frame is DEFERRED, the defects are not.** Turn 14 parked all four
 * `/preset` directions — not between frames, but on whether the command
 * survives 5.0 at all, which is a product call and cannot be answered by
 * drawing another one. What did *not* defer is the list of defects that are
 * real in shipped code and cheap to fix either way:
 *
 * - the centred header measured nothing, in a package that ships
 *   `estimateTextWidth` precisely because CJK is 2× wide — now measured;
 * - the description was cut at 60 Latin characters — now a pixel budget;
 * - `Math.floor(width / 7)` divided pixels by one Latin character, so every
 *   CJK dye name overran its swatch by roughly double — now measured;
 * - the palette was the deleted navy, replaced wholesale in `base.ts`.
 *
 * Still deferred with the command: the 600 px canvas (against the suite's
 * 400 × 350 budget), the proportional band, and localised category names.
 * `generateCompactPresetSwatch` was deleted — it was written for a list view
 * that shipped as embed text and had zero callers through two releases.
 *
 * Layout:
 * +----------------------------------------------------------+
 * |              [Icon] Preset Name                          |
 * |        Brief description of the preset palette           |
 * |                   by Author • 42★                        |
 * +----------+----------+----------+----------+--------------+
 * | [Color1] | [Color2] | [Color3] | [Color4] |              |
 * |   Name   |   Name   |   Name   |   Name   |              |
 * |  #HEX    |  #HEX    |  #HEX    |  #HEX    |              |
 * +----------+----------+----------+----------+--------------+
 *
 * @module svg/preset-swatch
 */

import type { Dye } from '@xivdyetools/types';
import type { PresetCategory } from '@xivdyetools/types';
import { createSvgDocument, estimateTextWidth, rect, text, THEME, FONTS } from './base.js';

// ============================================================================
// Measured text
// ============================================================================

/**
 * Per-character width factors against the font size, matching `frame.ts`'s
 * `textWidth`. Kept local because this generator predates the frame system
 * and still draws on `createSvgDocument`.
 */
const WIDTH_FACTOR = { header: 0.58, body: 0.54, mono: 0.62 } as const;

/**
 * Ellipsise to a **pixel** budget, never a character count.
 *
 * The two defects this replaces were both character-count truncations in a
 * package that ships `estimateTextWidth` precisely because CJK is 2× wide:
 * a fixed 60-character description cut, and `Math.floor(width / 7)` — pixels
 * divided by one Latin character — which let every CJK dye name overrun its
 * swatch by roughly double.
 */
function fitToWidth(
  content: string,
  maxPx: number,
  fontSize: number,
  kind: keyof typeof WIDTH_FACTOR = 'body',
): string {
  const measure = (s: string) => estimateTextWidth(s, fontSize * WIDTH_FACTOR[kind]);
  if (measure(content) <= maxPx) return content;
  // Slice by code point — a UTF-16 slice bisects surrogate pairs (BUG-060)
  const chars = [...content];
  while (chars.length > 1 && measure(`${chars.join('')}…`) > maxPx) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

// ============================================================================
// Category Display (visual display constant, shared with discord-worker)
// ============================================================================

/**
 * Category display metadata for preset swatches. The single source — 2026-08-18
 * dead-code audit (DEAD-014) had discord-worker carrying its own duplicate of
 * this table; discord-worker's `preset.ts` now imports this export instead.
 */
export const CATEGORY_DISPLAY: Record<PresetCategory, { icon: string; name: string }> = {
  jobs: { icon: '⚔️', name: 'FFXIV Jobs' },
  'grand-companies': { icon: '🏛️', name: 'Grand Companies' },
  seasons: { icon: '🍂', name: 'Seasons' },
  events: { icon: '🎉', name: 'FFXIV Events' },
  aesthetics: { icon: '🎨', name: 'Aesthetics' },
  appearance: { icon: '👤', name: 'Appearance' },
  zones: { icon: '🏔️', name: 'Zones' },
  'raids-trials': { icon: '🗡️', name: 'Raids & Trials' },
};

// ============================================================================
// Types
// ============================================================================

/**
 * Options for generating a preset swatch
 */
export interface PresetSwatchOptions {
  /** Preset name */
  name: string;
  /** Preset description */
  description: string;
  /** Preset category */
  category: PresetCategory;
  /** Array of dyes in the preset (null for invalid dye IDs) */
  dyes: (Dye | null)[];
  /** Canvas width in pixels (default: 600) */
  width?: number;
  /**
   * Localized meta line — the caller renders "by {author}" / "Official" in the
   * user's language (2026-08-20 i18n audit, F-11).
   *
   * **Required** since I18N-011: it used to default to English built from
   * `authorName`, so any caller that forgot it silently baked English onto a
   * localized card, with no gate to catch it.
   */
  authorLine: string;
  /** Localized empty-state line. Required for the same reason as `authorLine`. */
  emptyLabel: string;
  /**
   * Localized vote-count text, already formatted — e.g. `"42 votes"` / `"42 票"`.
   *
   * FONT-002: this line used to be `` `${voteCount}★` ``, and U+2605 is in none
   * of the ten faces either Worker bundles, so it drew as a tofu box on every
   * preset card carrying a vote count — the same trap BUG-056 fixed for the
   * category emoji three screens up. Omit it and the segment is skipped; there
   * is deliberately no English default.
   */
  votesLabel?: string;
  /** Localized dye-name resolver. Default: the English `dye.name`. */
  dyeName?: (dye: Dye) => string;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WIDTH = 600;
const PADDING = 24;
const HEADER_HEIGHT = 90;
const SWATCH_HEIGHT = 80;
const LABEL_HEIGHT = 50;
const SWATCH_GAP = 8;
const MIN_SWATCH_WIDTH = 80;

// ============================================================================
// SVG Generation
// ============================================================================

/**
 * Generate a preset swatch SVG showing the palette colors
 *
 * @param options - Preset swatch configuration
 * @returns SVG string
 *
 * @example
 * ```typescript
 * const svg = generatePresetSwatch({
 *   name: 'Crimson Elegance',
 *   description: 'A refined red and gold palette',
 *   category: 'aesthetics',
 *   dyes: [dalamudRedDye, jetBlackDye, metallicGoldDye],
 *   authorLine: 'von ExampleUser',
 *   emptyLabel: 'Keine gültigen Farbstoffe',
 *   votesLabel: '42 Stimmen',
 * });
 * const png = await renderSvgToPng(svg);
 * ```
 */
export function generatePresetSwatch(options: PresetSwatchOptions): string {
  const {
    name,
    description,
    dyes,
    width = DEFAULT_WIDTH,
    authorLine,
    emptyLabel,
    votesLabel,
    dyeName = (d: Dye): string => d.name,
  } = options;

  // Filter out null dyes (invalid dye IDs)
  const validDyes = dyes.filter((d): d is Dye => d !== null);

  if (validDyes.length === 0) {
    return generateEmptySwatch(width, name, emptyLabel);
  }

  // Calculate dimensions
  const swatchAreaWidth = width - PADDING * 2 - SWATCH_GAP * (validDyes.length - 1);
  const swatchWidth = Math.max(MIN_SWATCH_WIDTH, Math.floor(swatchAreaWidth / validDyes.length));
  const height = PADDING * 2 + HEADER_HEIGHT + SWATCH_HEIGHT + LABEL_HEIGHT;

  const elements: string[] = [];

  // Background
  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  // Title — BUG-056: no category emoji in SVG text; the bundled resvg fonts
  // have no emoji glyphs, so the icon rendered as a tofu box in the PNG.
  // CATEGORY_DISPLAY icons remain for Discord *message* text, where they work.
  // Every string in this header is centred, so it can overrun in BOTH
  // directions — each one is measured against the content box before it is
  // anchored.
  const headerW = width - PADDING * 2;
  elements.push(
    text(width / 2, PADDING + 24, fitToWidth(name, headerW, 22, 'header'), {
      fill: THEME.text,
      fontSize: 22,
      fontFamily: FONTS.headerCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    }),
  );

  elements.push(
    text(width / 2, PADDING + 50, fitToWidth(description, headerW, 13), {
      fill: THEME.textMuted,
      fontSize: 13,
      fontFamily: FONTS.primaryCjk,
      textAnchor: 'middle',
    }),
  );

  // Author and votes metadata line. Both segments are caller-localized: the
  // star that used to stand in for "votes" here was undrawable (FONT-002).
  const metaParts: string[] = [authorLine];
  if (votesLabel) {
    metaParts.push(votesLabel);
  }

  elements.push(
    text(width / 2, PADDING + 72, fitToWidth(metaParts.join(' • '), headerW, 11), {
      fill: THEME.textDim,
      fontSize: 11,
      fontFamily: FONTS.primaryCjk,
      textAnchor: 'middle',
    }),
  );

  // Color swatches section
  const swatchY = PADDING + HEADER_HEIGHT;
  const totalSwatchesWidth = validDyes.length * swatchWidth + (validDyes.length - 1) * SWATCH_GAP;
  const startX = (width - totalSwatchesWidth) / 2;

  validDyes.forEach((dye, index) => {
    const x = startX + index * (swatchWidth + SWATCH_GAP);
    elements.push(generateDyeSwatch(dye, x, swatchY, swatchWidth, dyeName(dye)));
  });

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Generate a single dye swatch with label
 */
function generateDyeSwatch(dye: Dye, x: number, y: number, width: number, label: string): string {
  const elements: string[] = [];

  // Color swatch rectangle
  elements.push(
    rect(x, y, width, SWATCH_HEIGHT, dye.hex, {
      rx: 6,
      ry: 6,
      stroke: THEME.border,
      strokeWidth: 1,
    }),
  );

  // Dye name — measured against the swatch, not divided by a Latin character
  const labelY = y + SWATCH_HEIGHT + 18;
  const truncatedName = fitToWidth(label, width, 11);

  elements.push(
    text(x + width / 2, labelY, truncatedName, {
      fill: THEME.text,
      fontSize: 11,
      fontFamily: FONTS.primaryCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    }),
  );

  // Hex code
  elements.push(
    text(x + width / 2, labelY + 16, dye.hex.toUpperCase(), {
      fill: THEME.textDim,
      fontSize: 10,
      fontFamily: FONTS.mono,
      textAnchor: 'middle',
    }),
  );

  return elements.join('\n');
}

/**
 * Generate an empty swatch for presets with no valid dyes
 */
function generateEmptySwatch(width: number, name: string, emptyLabel: string): string {
  const height = 120;
  const elements: string[] = [];

  elements.push(rect(0, 0, width, height, THEME.background, { rx: 12, ry: 12 }));

  elements.push(
    text(width / 2, 40, fitToWidth(name, width - PADDING * 2, 18, 'header'), {
      fill: THEME.text,
      fontSize: 18,
      fontFamily: FONTS.headerCjk,
      fontWeight: 600,
      textAnchor: 'middle',
    }),
  );

  elements.push(
    text(width / 2, 75, emptyLabel, {
      fill: THEME.textMuted,
      fontSize: 14,
      fontFamily: FONTS.primaryCjk,
      textAnchor: 'middle',
    }),
  );

  return createSvgDocument(width, height, elements.join('\n'));
}

// generateCompactPresetSwatch deleted (5.0): zero callers, condemned in the
// register's /preset cheap-fix list.
