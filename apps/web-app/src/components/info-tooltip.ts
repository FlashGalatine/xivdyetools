/**
 * XIV Dye Tools v2.2.0 - Info Tooltip Component
 *
 * Helper for creating info icons (ⓘ) with hover/focus tooltips
 *
 * @module components/info-tooltip
 */

import { TooltipService } from '@services/tooltip-service';

// ============================================================================
// Info Tooltip Configuration
// ============================================================================

export interface InfoTooltipOptions {
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  ariaLabel?: string;
}

// ============================================================================
// Info Tooltip Functions
// ============================================================================

/**
 * Create an info icon element with tooltip
 */
export function createInfoIcon(options: InfoTooltipOptions): HTMLElement {
  const icon = document.createElement('button');
  icon.type = 'button';
  icon.className = `
    info-tooltip-icon
    inline-flex items-center justify-center
    w-4 h-4 ml-1
    text-xs text-gray-400 dark:text-gray-500
    hover:text-blue-500 dark:hover:text-blue-400
    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
    rounded-full
    cursor-help
    transition-colors
  `
    .replace(/\s+/g, ' ')
    .trim();

  icon.textContent = 'ⓘ';
  icon.setAttribute('aria-label', options.ariaLabel || 'More information');
  icon.setAttribute('tabindex', '0');

  // Attach tooltip
  TooltipService.attach(icon, {
    content: options.content,
    position: options.position || 'auto',
    showOnFocus: true,
  });

  return icon;
}

/**
 * Create a label with an info icon
 */
export function createLabelWithInfo(
  labelText: string,
  tooltipContent: string,
  options: Partial<InfoTooltipOptions> = {}
): HTMLElement {
  const container = document.createElement('span');
  container.className = 'inline-flex items-center gap-1';

  const label = document.createElement('span');
  label.textContent = labelText;
  container.appendChild(label);

  const icon = createInfoIcon({
    content: tooltipContent,
    ...options,
  });
  container.appendChild(icon);

  return container;
}

/**
 * Add info icon to an existing element
 */
export function addInfoIconTo(
  element: HTMLElement,
  tooltipContent: string,
  options: Partial<InfoTooltipOptions> = {}
): HTMLElement {
  const icon = createInfoIcon({
    content: tooltipContent,
    ...options,
  });
  element.appendChild(icon);
  return icon;
}

// ============================================================================
// Predefined Tooltip Content
// ============================================================================

/**
 * Standard tooltip content for common features
 */
export const TOOLTIP_CONTENT = {
  // Harmony Generator tooltips
  deviance:
    'How closely the dye matches the ideal harmony color. Lower degrees mean a closer match to the color wheel position.',
  harmonyComplementary:
    'Complementary: Two colors directly opposite on the color wheel (180°). Creates high contrast.',
  harmonyAnalogous:
    'Analogous: Three colors adjacent on the color wheel. Creates harmonious, low-contrast palettes.',
  harmonyTriadic:
    'Triadic: Three colors equally spaced on the color wheel (120° apart). Bold and vibrant.',
  harmonySplitComplementary:
    'Split-Complementary: Base color plus two colors adjacent to its complement. Balanced contrast.',
  harmonyTetradic: 'Tetradic: Four colors forming a rectangle on the wheel. Rich and complex.',
  harmonySquare: 'Square: Four colors equally spaced (90° apart). Offers variety with balance.',
  harmonyMonochromatic:
    'Monochromatic: Variations of a single hue with different saturations and values.',
  harmonyCompound: 'Compound: Combination of complementary and analogous colors.',
  harmonyShades: 'Shades: Progressively darker versions of the base color.',

  // Color Matcher tooltips
  sampleSize:
    'Larger samples average more pixels for better accuracy on textured or patterned areas. Smaller samples are more precise for solid colors.',

  // Accessibility tooltips
  dualDyeMode:
    'Compare two dyes per outfit slot to see how different color combinations look together.',
  wcagContrast:
    'Web Content Accessibility Guidelines contrast rating. AAA = excellent (7:1+), AA = good (4.5:1+), Fail = poor contrast.',
  visionSimulation:
    'Simulates how the color palette appears to people with different types of color vision deficiency.',

  // Dye Comparison tooltips
  colorDistance:
    'Euclidean distance in RGB color space. Lower values indicate more similar colors.',
} as const;
