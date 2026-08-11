/**
 * XIV Dye Tools - Preset Category SVG Icons (5.0 shim)
 *
 * The geometry home is `@xivdyetools/svg`: the confirmed 32-grid category set
 * (jobs = mage's staff, grand-companies = flag, seasons = quartered disc,
 * events = five-ray, aesthetics = hanger, appearance = head in profile,
 * zones = ridgeline, raids-trials = crossed blades) — eight categories, eight
 * icons; the retired `community` category has no icon. Unknown categories
 * fall back to the neutral chip-row glyph.
 *
 * SECURITY NOTE: These SVG constants are used with innerHTML in preset UI.
 * This is SAFE because content is static/code-defined, not user input.
 * See ui-icons.ts for detailed security rationale.
 *
 * @module shared/category-icons
 */

import { categoryGlyph, type CategoryGlyphName } from '@xivdyetools/svg';
import { themedAccent } from './glyph-accent';

const glyph = (name: CategoryGlyphName): string =>
  themedAccent(categoryGlyph(name, { fluid: true }));

/**
 * Map of category names to their SVG icons (the eight submittable categories).
 */
const CATEGORY_ICONS: Record<string, string> = {
  jobs: glyph('jobs'),
  'grand-companies': glyph('grand-companies'),
  seasons: glyph('seasons'),
  events: glyph('events'),
  aesthetics: glyph('aesthetics'),
  appearance: glyph('appearance'),
  zones: glyph('zones'),
  'raids-trials': glyph('raids-trials'),
};

const ICON_CATEGORY_DEFAULT = glyph('default');

/**
 * Get category icon by name, returns the neutral default glyph if not found
 */
export function getCategoryIcon(name: string): string {
  return CATEGORY_ICONS[name] || ICON_CATEGORY_DEFAULT;
}
