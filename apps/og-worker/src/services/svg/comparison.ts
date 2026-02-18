/**
 * Comparison Tool OG Image Generator
 *
 * Creates an OG image showing up to 4 dyes being compared side-by-side.
 *
 * Layout (1200x630):
 * ┌──────────────────────────────────────────────────────────────────┐
 * │  ✦ XIV DYE TOOLS           COMPARISON           4 DYES COMPARED │
 * ├──────────────────────────────────────────────────────────────────┤
 * │                                                                  │
 * │    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐       │
 * │    │         │   │         │   │         │   │         │       │
 * │    │ [COLOR] │   │ [COLOR] │   │ [COLOR] │   │ [COLOR] │       │
 * │    │         │   │         │   │         │   │         │       │
 * │    └─────────┘   └─────────┘   └─────────┘   └─────────┘       │
 * │    Snow White    Wine Red      Ink Blue      Desert Yellow     │
 * │      #F2F2F2      #8A2A37      #252A42        #C8B374          │
 * │      White        Red          Blue           Yellow           │
 * │                                                                  │
 * ├──────────────────────────────────────────────────────────────────┤
 * │  🎨 xivdyetools.app                                              │
 * └──────────────────────────────────────────────────────────────────┘
 */

import { type Dye } from '@xivdyetools/core';
import { rect, text, getContrastTextColor, THEME, FONTS, OG_DIMENSIONS } from './base';
import { generateOGCard, LAYOUT } from './og-card';
import { getDyeByItemId } from './dye-helpers';

export interface ComparisonOGOptions {
  /** Array of dye itemIDs (1-4) */
  dyeIds: number[];
}

/**
 * Generates the Comparison tool OG image SVG
 */
export function generateComparisonOG(options: ComparisonOGOptions): string {
  const { dyeIds } = options;

  // Look up all dyes
  const dyes: Dye[] = dyeIds
    .map((id) => getDyeByItemId(id))
    .filter((d): d is Dye => d !== undefined)
    .slice(0, 4); // Max 4 dyes

  if (dyes.length === 0) {
    return generateFallbackComparisonOG();
  }

  // Build content elements
  const contentElements: string[] = [];
  const { contentTop, contentHeight, padding } = LAYOUT;

  // Calculate swatch sizes based on number of dyes
  const numDyes = dyes.length;
  const swatchSize = numDyes === 1 ? 220 : numDyes === 2 ? 180 : numDyes === 3 ? 150 : 130;
  const gap = numDyes <= 2 ? 50 : numDyes === 3 ? 35 : 25;

  // Total width of all swatches
  const totalWidth = numDyes * swatchSize + (numDyes - 1) * gap;
  const startX = (OG_DIMENSIONS.width - totalWidth) / 2;

  // Vertical centering: swatch + labels (~70px below)
  const totalVisualHeight = swatchSize + 90;
  const startY = contentTop + (contentHeight - totalVisualHeight) / 2;

  dyes.forEach((dye, index) => {
    const x = startX + index * (swatchSize + gap);
    const centerX = x + swatchSize / 2;

    // Color swatch with white border
    contentElements.push(
      rect(x, startY, swatchSize, swatchSize, dye.hex, {
        rx: 12,
        stroke: '#ffffff',
        strokeWidth: 3,
      })
    );

    // Hex code inside the swatch (for large swatches)
    if (swatchSize >= 150) {
      const textColor = getContrastTextColor(dye.hex);
      contentElements.push(
        text(centerX, startY + swatchSize / 2, dye.hex.toUpperCase(), {
          fill: textColor,
          fontSize: swatchSize >= 180 ? 18 : 14,
          fontFamily: FONTS.mono,
          fontWeight: 500,
          textAnchor: 'middle',
          dominantBaseline: 'middle',
        })
      );
    }

    // Dye name below swatch
    const truncatedName =
      dye.name.length > 14 ? dye.name.slice(0, 12) + '..' : dye.name;
    contentElements.push(
      text(centerX, startY + swatchSize + 28, truncatedName, {
        fill: THEME.text,
        fontSize: numDyes <= 2 ? 20 : numDyes === 3 ? 17 : 15,
        fontFamily: FONTS.header,
        fontWeight: 600,
        textAnchor: 'middle',
      })
    );

    // Hex code below name (for smaller swatches)
    if (swatchSize < 150) {
      contentElements.push(
        text(centerX, startY + swatchSize + 50, dye.hex.toUpperCase(), {
          fill: THEME.textMuted,
          fontSize: 12,
          fontFamily: FONTS.mono,
          textAnchor: 'middle',
        })
      );
    }

    // Category below
    contentElements.push(
      text(
        centerX,
        startY + swatchSize + (swatchSize < 150 ? 70 : 52),
        dye.category,
        {
          fill: THEME.textMuted,
          fontSize: numDyes <= 2 ? 14 : 12,
          fontFamily: FONTS.primary,
          textAnchor: 'middle',
        }
      )
    );
  });

  return generateOGCard({
    toolName: 'Comparison',
    subtitle: `${dyes.length} ${dyes.length === 1 ? 'Dye' : 'Dyes'} Compared`,
    content: contentElements.join('\n'),
  });
}

/**
 * Generates a fallback OG image when no dyes are provided
 */
function generateFallbackComparisonOG(): string {
  const contentElements: string[] = [];
  const { contentTop, contentHeight } = LAYOUT;

  // Centered message
  contentElements.push(
    text(OG_DIMENSIONS.width / 2, contentTop + contentHeight / 2 - 20, 'Compare Dyes Side-by-Side', {
      fill: THEME.text,
      fontSize: 32,
      fontFamily: FONTS.header,
      fontWeight: 600,
      textAnchor: 'middle',
    })
  );

  contentElements.push(
    text(
      OG_DIMENSIONS.width / 2,
      contentTop + contentHeight / 2 + 30,
      'Select up to 4 dyes to compare colors and details',
      {
        fill: THEME.textMuted,
        fontSize: 18,
        fontFamily: FONTS.primary,
        textAnchor: 'middle',
      }
    )
  );

  // Example comparison swatches
  const colors = [
    { hex: '#F2F2F2', name: 'White' },
    { hex: '#8A2A37', name: 'Red' },
    { hex: '#252A42', name: 'Blue' },
    { hex: '#C8B374', name: 'Yellow' },
  ];

  const swatchSize = 80;
  const gap = 30;
  const totalWidth = colors.length * swatchSize + (colors.length - 1) * gap;
  const startX = (OG_DIMENSIONS.width - totalWidth) / 2;
  const swatchY = contentTop + contentHeight / 2 + 90;

  colors.forEach((color, i) => {
    const x = startX + i * (swatchSize + gap);
    contentElements.push(rect(x, swatchY, swatchSize, swatchSize, color.hex, { rx: 8 }));
    contentElements.push(
      text(x + swatchSize / 2, swatchY + swatchSize + 20, color.name, {
        fill: THEME.textMuted,
        fontSize: 12,
        fontFamily: FONTS.primary,
        textAnchor: 'middle',
      })
    );
  });

  return generateOGCard({
    toolName: 'Comparison',
    content: contentElements.join('\n'),
  });
}
