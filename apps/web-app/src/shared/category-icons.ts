/**
 * XIV Dye Tools - Preset Category SVG Icons
 *
 * Inline SVG icons for preset palette categories using currentColor for theme adaptation
 * Follows the same pattern as tool-icons.ts for consistency
 *
 * SECURITY NOTE: These SVG constants are used with innerHTML in preset-card.ts.
 * This is SAFE because content is static/code-defined, not user input.
 * See ui-icons.ts for detailed security rationale.
 *
 * @module shared/category-icons
 */

/**
 * Jobs category icon - Crossed Sword and Mage Staff
 */
export const ICON_CATEGORY_JOBS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19 19L8 8" />
  <circle cx="6" cy="6" r="3" />
  <path d="M6 6h.01" stroke-width="3" opacity="0.5" />
  <path d="M5 19L19 5" />
  <path d="M6 16l3 3" stroke-width="2" />
  <path d="M4 20l1-1" stroke-width="3" />
  <path d="M3 3l2 2" opacity="0.3" />
  <path d="M10 2l-1 2" opacity="0.3" />
</svg>`;

/**
 * Grand Companies category icon - Banner/Flag
 */
export const ICON_CATEGORY_GRAND_COMPANIES = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 4v16" stroke-width="2" />
  <path d="M5 4h12l-3 5 3 5H5" />
  <circle cx="5" cy="4" r="1" fill="currentColor" stroke="none" />
</svg>`;

/**
 * Seasons category icon - Sun and Snowflake combined
 */
export const ICON_CATEGORY_SEASONS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="9" cy="9" r="3" />
  <path d="M9 2v2M9 14v2M2 9h2M14 9h2" />
  <path d="M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4" opacity="0.5" />
  <path d="M17 14v8M13 18h8" opacity="0.7" />
  <path d="M14.5 15.5l2.5 2.5 2.5-2.5M14.5 20.5l2.5-2.5 2.5 2.5" opacity="0.5" />
</svg>`;

/**
 * Events category icon - Star burst / Celebration
 */
export const ICON_CATEGORY_EVENTS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke-width="2" />
  <path d="M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8" opacity="0.6" />
  <path d="M12 6l1 2M12 16l-1 2M6 12l2-1M16 12l2 1" opacity="0.4" />
</svg>`;

/**
 * Aesthetics category icon - Crystal/Diamond
 */
export const ICON_CATEGORY_AESTHETICS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M6 3h12l4 7-10 11L2 10l4-7z" />
  <path d="M2 10h20" opacity="0.5" />
  <path d="M12 21l-3-11 3-7 3 7-3 11z" opacity="0.4" />
  <path d="M6 3l3 7M18 3l-3 7" opacity="0.3" />
</svg>`;

/**
 * Community category icon - Two people silhouettes
 */
export const ICON_CATEGORY_COMMUNITY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="9" cy="7" r="3" />
  <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
  <circle cx="17" cy="7" r="2.5" opacity="0.6" />
  <path d="M17 11.5a3 3 0 0 1 3 3V21" opacity="0.6" />
</svg>`;

/**
 * Back arrow icon - Left-pointing chevron
 */
export const ICON_ARROW_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15 18l-6-6 6-6" />
</svg>`;

/**
 * Default fallback icon - Palette
 */
export const ICON_CATEGORY_DEFAULT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none" />
  <circle cx="7.5" cy="11" r="1.5" fill="currentColor" stroke="none" opacity="0.8" />
  <circle cx="9" cy="16" r="1.5" fill="currentColor" stroke="none" opacity="0.6" />
  <circle cx="16" cy="14" r="1.5" fill="currentColor" stroke="none" opacity="0.7" />
</svg>`;

/**
 * Map of category names to their SVG icons
 */
export const CATEGORY_ICONS: Record<string, string> = {
  jobs: ICON_CATEGORY_JOBS,
  'grand-companies': ICON_CATEGORY_GRAND_COMPANIES,
  seasons: ICON_CATEGORY_SEASONS,
  events: ICON_CATEGORY_EVENTS,
  aesthetics: ICON_CATEGORY_AESTHETICS,
  community: ICON_CATEGORY_COMMUNITY,
};

/**
 * Get category icon by name, returns default palette icon if not found
 */
export function getCategoryIcon(name: string): string {
  return CATEGORY_ICONS[name] || ICON_CATEGORY_DEFAULT;
}
