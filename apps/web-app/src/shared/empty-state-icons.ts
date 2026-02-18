/**
 * XIV Dye Tools - Empty State SVG Icons
 *
 * Inline SVG icons for empty states using currentColor for theme adaptation
 * These replace emoji icons for better visual consistency and theme support
 *
 * @module shared/empty-state-icons
 */

/**
 * Search/magnifying glass icon for no search results
 */
export const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="11" cy="11" r="8"/>
  <path d="M21 21l-4.35-4.35"/>
</svg>`;

/**
 * Palette icon for filtered out / select dye states
 */
export const ICON_PALETTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="13.5" cy="6.5" r="1.5" fill="currentColor"/>
  <circle cx="17.5" cy="10.5" r="1.5" fill="currentColor"/>
  <circle cx="8.5" cy="7.5" r="1.5" fill="currentColor"/>
  <circle cx="6.5" cy="12.5" r="1.5" fill="currentColor"/>
  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.562C22 6.5 17.5 2 12 2Z"/>
</svg>`;

/**
 * Coins icon for no price data
 */
export const ICON_COINS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="8" cy="8" r="6"/>
  <path d="M18.09 10.37A6 6 0 1 1 10.34 18"/>
  <path d="M7 6h1v4"/>
  <path d="M16.71 13.88l.7.71-2.82 2.82"/>
</svg>`;

/**
 * Music notes icon for harmony/no harmony results
 */
export const ICON_HARMONY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 18V5l12-2v13"/>
  <circle cx="6" cy="18" r="3"/>
  <circle cx="18" cy="16" r="3"/>
</svg>`;

/**
 * Image/picture icon for no image loaded
 */
export const ICON_IMAGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
  <circle cx="8.5" cy="8.5" r="1.5"/>
  <path d="m21 15-5-5L5 21"/>
</svg>`;

/**
 * Warning triangle icon for error states
 */
export const ICON_WARNING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>
  <line x1="12" y1="9" x2="12" y2="13"/>
  <line x1="12" y1="17" x2="12.01" y2="17"/>
</svg>`;

/**
 * Hourglass icon for loading states
 */
export const ICON_LOADING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M5 22h14"/>
  <path d="M5 2h14"/>
  <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/>
  <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>
</svg>`;

/**
 * Folder icon for empty saved palettes
 */
export const ICON_FOLDER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
</svg>`;

/**
 * Empty inbox icon for no submissions/content
 * Replaces: 📭 emoji
 */
export const ICON_EMPTY_INBOX = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 9l9-6 9 6v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
  <path d="M3 9l9 6 9-6"/>
  <path d="M12 15v-3" stroke-dasharray="2 2"/>
</svg>`;

/**
 * Map of icon names to SVG strings for easy lookup
 */
export const EMPTY_STATE_ICONS: Record<string, string> = {
  search: ICON_SEARCH,
  palette: ICON_PALETTE,
  coins: ICON_COINS,
  harmony: ICON_HARMONY,
  image: ICON_IMAGE,
  warning: ICON_WARNING,
  loading: ICON_LOADING,
  folder: ICON_FOLDER,
  'empty-inbox': ICON_EMPTY_INBOX,
};

/**
 * Get SVG icon by name, returns the SVG string or undefined
 */
export function getEmptyStateIcon(name: string): string | undefined {
  return EMPTY_STATE_ICONS[name];
}
