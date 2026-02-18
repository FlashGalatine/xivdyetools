/**
 * OG Card Base Layout
 *
 * Creates the common layout structure for all OG images:
 * - Header bar with tool name and XIV Dye Tools branding
 * - Main content area (tool-specific)
 * - Footer bar with website URL and optional metadata
 *
 * Dimensions: 1200x630 (standard OG image size)
 */

import {
  createSvgDocument,
  rect,
  text,
  linearGradient,
  THEME,
  FONTS,
  OG_DIMENSIONS,
} from './base';

export interface OGCardOptions {
  /** Tool display name (e.g., "HARMONY EXPLORER") */
  toolName: string;
  /** Subtitle text (e.g., "TETRADIC HARMONY") */
  subtitle?: string;
  /** Main content SVG elements */
  content: string;
  /** Footer text (optional, default shows website) */
  footerText?: string;
  /** Algorithm name to display (e.g., "OKLAB") */
  algorithm?: string;
}

/**
 * Generates a complete OG image SVG with standard layout
 */
export function generateOGCard(options: OGCardOptions): string {
  const { toolName, subtitle, content, footerText, algorithm } = options;
  const { width, height } = OG_DIMENSIONS;

  const elements: string[] = [];

  // Definitions (gradients)
  const defs = `
    <defs>
      ${linearGradient('headerGradient', [
        { offset: '0%', color: '#1a1a2e' },
        { offset: '100%', color: '#16213e' },
      ])}
      ${linearGradient('bgGradient', [
        { offset: '0%', color: '#1a1a2e' },
        { offset: '50%', color: '#16213e' },
        { offset: '100%', color: '#1a1a2e' },
      ], { x1: '0%', y1: '0%', x2: '100%', y2: '100%' })}
    </defs>
  `;
  elements.push(defs);

  // Background
  elements.push(rect(0, 0, width, height, 'url(#bgGradient)'));

  // Header bar (60px height)
  const headerHeight = 60;
  elements.push(rect(0, 0, width, headerHeight, 'url(#headerGradient)', { opacity: 0.9 }));

  // Header divider line
  elements.push(rect(0, headerHeight - 1, width, 1, THEME.border));

  // Header content
  // XIV DYE TOOLS branding on left
  elements.push(
    text(40, 38, '✦ XIV DYE TOOLS', {
      fill: THEME.text,
      fontSize: 18,
      fontFamily: FONTS.header,
      fontWeight: 600,
      dominantBaseline: 'middle',
    })
  );

  // Tool name in center
  elements.push(
    text(width / 2, 38, toolName.toUpperCase(), {
      fill: THEME.text,
      fontSize: 22,
      fontFamily: FONTS.header,
      fontWeight: 700,
      textAnchor: 'middle',
      dominantBaseline: 'middle',
    })
  );

  // Subtitle on right (if provided)
  if (subtitle) {
    elements.push(
      text(width - 40, 38, subtitle.toUpperCase(), {
        fill: THEME.accent,
        fontSize: 16,
        fontFamily: FONTS.header,
        fontWeight: 500,
        textAnchor: 'end',
        dominantBaseline: 'middle',
      })
    );
  }

  // Main content area (between header and footer)
  // Add the tool-specific content
  elements.push(content);

  // Footer bar (50px height)
  const footerHeight = 50;
  const footerY = height - footerHeight;
  elements.push(rect(0, footerY, width, footerHeight, THEME.background, { opacity: 0.9 }));

  // Footer divider line
  elements.push(rect(0, footerY, width, 1, THEME.border));

  // Footer content
  // Website URL on left
  elements.push(
    text(40, footerY + 30, footerText || '🎨 xivdyetools.app', {
      fill: THEME.textMuted,
      fontSize: 16,
      fontFamily: FONTS.primary,
      dominantBaseline: 'middle',
    })
  );

  // Algorithm on right (if provided)
  if (algorithm) {
    elements.push(
      text(width - 40, footerY + 30, `Algorithm: ${algorithm.toUpperCase()}`, {
        fill: THEME.textMuted,
        fontSize: 14,
        fontFamily: FONTS.primary,
        textAnchor: 'end',
        dominantBaseline: 'middle',
      })
    );
  }

  return createSvgDocument(width, height, elements.join('\n'));
}

/**
 * Layout constants for content positioning
 */
export const LAYOUT = {
  /** Top of content area (below header) */
  contentTop: 80,
  /** Bottom of content area (above footer) */
  contentBottom: 560,
  /** Content area height */
  contentHeight: 480,
  /** Horizontal padding */
  padding: 40,
  /** Available content width */
  contentWidth: 1120,
} as const;
