/**
 * XIV Dye Tools - UI SVG Icons
 *
 * Inline SVG icons for UI elements using currentColor for theme adaptation
 * These replace external SVG files loaded via <img> tags which can't inherit color
 *
 * SECURITY NOTE: Static SVG innerHTML Pattern
 * ===========================================
 * These SVG constants are used with innerHTML in components (e.g., base-component.ts).
 * This pattern is SAFE because:
 *
 * 1. SVG content is defined as static constants in this file (code-controlled, not user input)
 * 2. No user data is ever interpolated into these SVG strings
 * 3. Icons are compile-time constants, not fetched from external sources
 * 4. The strict CSP blocks inline script execution even if SVG were compromised
 *
 * When adding new icons:
 * - Define as const strings in this file
 * - Never interpolate user input into SVG markup
 * - Use currentColor for theme adaptation (inherits from parent CSS)
 *
 * @see base-component.ts createElement() method
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
 * @module shared/ui-icons
 */

/**
 * Theme Switcher icon - Paint palette
 */
export const ICON_THEME = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 12 2 C 6.5 2 2 6.5 2 12 C 2 14.5 3 16.5 4.5 18 C 5 18.5 6 18.5 6.5 18 C 7 17.5 7 16.5 6.5 15.5 C 6 14.5 6 13 6 12 C 6 8.7 8.7 6 12 6 C 15.3 6 18 8.7 18 12 C 18 15.3 15.3 18 12 18 L 10 18 C 9 18 8 19 8 20 C 8 21 9 22 10 22 L 12 22 C 17.5 22 22 17.5 22 12 C 22 6.5 17.5 2 12 2 Z" fill="none"/>
  <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" opacity="0.6"/>
  <circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none" opacity="0.8"/>
  <circle cx="15.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" opacity="0.4"/>
</svg>`;

/**
 * Camera icon - Take photo
 */
export const ICON_CAMERA = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="8" width="18" height="12" rx="2" />
  <circle cx="12" cy="14" r="3" />
  <circle cx="17" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
  <path d="M 9 8 L 9 6 L 15 6 L 15 8" />
</svg>`;

/**
 * Eyedropper icon - Color picker tool
 */
export const ICON_EYEDROPPER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="18" cy="6" r="2.5" />
  <path d="M 17 8.5 L 14 11.5 L 9 16.5 L 6 19.5" />
  <path d="M 6 19.5 L 4.5 21 L 3 19.5 L 4.5 18 Z" fill="currentColor" />
  <line x1="14" y1="11.5" x2="12" y2="13.5" />
  <line x1="11" y1="14.5" x2="9" y2="16.5" />
</svg>`;

/**
 * Save icon - Floppy disk
 */
export const ICON_SAVE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 19 21 L 5 21 C 3.9 21 3 20.1 3 19 L 3 5 C 3 3.9 3.9 3 5 3 L 16 3 L 21 8 L 21 19 C 21 20.1 20.1 21 19 21 Z" />
  <rect x="6" y="3" width="9" height="5" />
  <rect x="7" y="13" width="10" height="6" rx="1" />
</svg>`;

/**
 * Share icon - Chain link
 */
export const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 10 13 C 10.7 13.7 11.5 14 12.5 14 C 13.5 14 14.3 13.7 15 13 L 18 10 C 18.7 9.3 19 8.5 19 7.5 C 19 6.5 18.7 5.7 18 5 C 17.3 4.3 16.5 4 15.5 4 C 14.5 4 13.7 4.3 13 5 L 11.5 6.5" />
  <path d="M 14 11 C 13.3 10.3 12.5 10 11.5 10 C 10.5 10 9.7 10.3 9 11 L 6 14 C 5.3 14.7 5 15.5 5 16.5 C 5 17.5 5.3 18.3 6 19 C 6.7 19.7 7.5 20 8.5 20 C 9.5 20 10.3 19.7 11 19 L 12.5 17.5" />
</svg>`;

/**
 * Hint icon - Light bulb
 */
export const ICON_HINT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 12 3 C 9 3 7 5 7 8 C 7 10 8 11.5 9 12.5 L 9 15 C 9 16 10 17 11 17 L 13 17 C 14 17 15 16 15 15 L 15 12.5 C 16 11.5 17 10 17 8 C 17 5 15 3 12 3 Z" />
  <line x1="10" y1="17" x2="14" y2="17" />
  <line x1="10.5" y1="19" x2="13.5" y2="19" />
  <circle cx="12" cy="9" r="1.5" fill="currentColor" stroke="none" opacity="0.5" />
</svg>`;

/**
 * Zoom to Fit icon
 */
export const ICON_ZOOM_FIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4" y="4" width="16" height="16" />
  <polyline points="9,4 4,4 4,9" />
  <polyline points="15,4 20,4 20,9" />
  <polyline points="9,20 4,20 4,15" />
  <polyline points="15,20 20,20 20,15" />
</svg>`;

/**
 * Zoom to Width icon
 */
export const ICON_ZOOM_WIDTH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4" y="7" width="16" height="10" />
  <line x1="2" y1="12" x2="7" y2="12" />
  <polyline points="4,10 2,12 4,14" />
  <line x1="22" y1="12" x2="17" y2="12" />
  <polyline points="20,10 22,12 20,14" />
</svg>`;

/**
 * Crystal icon - FFXIV-style gem (from monorepo crystal.svg)
 */
export const ICON_CRYSTAL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L19 9L12 22L5 9L12 2Z" />
  <path d="M12 2V22" opacity="0.5" />
  <path d="M5 9L12 13L19 9" opacity="0.5" />
  <path d="M19 4L21 4" opacity="0.4" />
  <path d="M20 3V5" opacity="0.4" />
</svg>`;

/**
 * Warning icon - Triangle with exclamation
 */
export const ICON_WARNING = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3L2 21h20L12 3Z" />
  <line x1="12" y1="9" x2="12" y2="13" />
  <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
</svg>`;

/**
 * Upload icon - Folder with arrow
 */
export const ICON_UPLOAD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 4 8 L 4 18 C 4 19 5 20 6 20 L 18 20 C 19 20 20 19 20 18 L 20 8 C 20 7 19 6 18 6 L 10 6 L 8 4 L 6 4 C 5 4 4 5 4 6 Z" />
  <line x1="12" y1="16" x2="12" y2="10" stroke-width="2" />
  <polyline points="9,13 12,10 15,13" stroke-width="2" />
</svg>`;

/**
 * Dice icon - Random selection
 */
export const ICON_DICE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="18" height="18" rx="3" />
  <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
  <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
  <circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
</svg>`;

/**
 * Coins icon - Budget/Gil (FFXIV-style stacked coins)
 */
export const ICON_COINS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <ellipse cx="12" cy="7" rx="7" ry="3" />
  <path d="M5 7v4c0 1.66 3.13 3 7 3s7-1.34 7-3V7" />
  <path d="M5 11v4c0 1.66 3.13 3 7 3s7-1.34 7-3v-4" />
  <path d="M5 15v2c0 1.66 3.13 3 7 3s7-1.34 7-3v-2" />
</svg>`;

/**
 * Broom icon - Clear/sweep action
 */
export const ICON_BROOM = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L12 10" />
  <path d="M9 10L15 10L17 22L7 22L9 10Z" />
  <path d="M9 14L15 14" opacity="0.5" />
  <path d="M8 18L16 18" opacity="0.5" />
</svg>`;

/**
 * Close icon - X shape for closing dialogs/panels
 */
export const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M18 6L6 18" />
  <path d="M6 6l12 12" />
</svg>`;

/**
 * Filter icon - Funnel shape
 */
export const ICON_FILTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 4h18l-7 8v6l-4 2V12L3 4z"/>
</svg>`;

/**
 * Market icon - Store/shop front
 */
export const ICON_MARKET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
  <polyline points="9 22 9 12 15 12 15 22"/>
</svg>`;

/**
 * Export icon - Arrow out of box
 */
export const ICON_EXPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
  <polyline points="17 8 12 3 7 8"/>
  <line x1="12" y1="3" x2="12" y2="15"/>
</svg>`;

/**
 * Beaker icon - Lab flask
 */
export const ICON_BEAKER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M9 3h6"/>
  <path d="M10 3v6l-4 8a2 2 0 002 2h8a2 2 0 002-2l-4-8V3"/>
  <path d="M8 15h8" opacity="0.5"/>
</svg>`;

/**
 * Settings icon - Cog/gear
 */
export const ICON_SETTINGS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="3"/>
  <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
</svg>`;

/**
 * Palette icon - Artist color palette
 */
export const ICON_PALETTE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="13.5" cy="6.5" r="1.5"/>
  <circle cx="17.5" cy="10.5" r="1.5"/>
  <circle cx="8.5" cy="7.5" r="1.5"/>
  <circle cx="6.5" cy="12.5" r="1.5"/>
  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>
</svg>`;

/**
 * Sort icon - Vertical bars
 */
export const ICON_SORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 6h18M3 12h12M3 18h6"/>
</svg>`;

/**
 * Eye icon - Vision/view
 */
export const ICON_EYE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>
</svg>`;

/**
 * Sliders icon - Adjustment controls
 */
export const ICON_SLIDERS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="4" y1="21" x2="4" y2="14"/>
  <line x1="4" y1="10" x2="4" y2="3"/>
  <line x1="12" y1="21" x2="12" y2="12"/>
  <line x1="12" y1="8" x2="12" y2="3"/>
  <line x1="20" y1="21" x2="20" y2="16"/>
  <line x1="20" y1="12" x2="20" y2="3"/>
  <circle cx="4" cy="12" r="2"/>
  <circle cx="12" cy="10" r="2"/>
  <circle cx="20" cy="14" r="2"/>
</svg>`;

/**
 * Target icon - Concentric circles (for budget/target selection)
 */
export const ICON_TARGET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
</svg>`;

/**
 * Sparkles icon - Magic/highlights
 */
export const ICON_SPARKLES = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/>
</svg>`;

/**
 * Distance icon - Color distance measurement
 */
export const ICON_DISTANCE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
</svg>`;

/**
 * Music icon - Music note (for harmony types)
 */
export const ICON_MUSIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="8" cy="18" r="4"/>
  <path d="M12 18V2l7 4"/>
</svg>`;

/**
 * Test tube icon - Vertical test tube
 */
export const ICON_TEST_TUBE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5h0c-1.4 0-2.5-1.1-2.5-2.5V2"/>
  <path d="M8.5 2h7"/>
  <path d="M14.5 16h-5"/>
</svg>`;

/**
 * Beaker pipe icon - Beaker with pipe attachment
 */
export const ICON_BEAKER_PIPE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4.5 3h10"/>
  <path d="M6 3v11a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V3"/>
  <path d="M14 10h5a2 2 0 0 1 2 2v5"/>
  <circle cx="21" cy="19" r="2"/>
</svg>`;

/**
 * Stairs icon - Staircase/steps (for interpolation)
 */
export const ICON_STAIRS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 20h4v-4h4v-4h4v-4h4"/>
  <path d="M4 20v-4h4v-4h4v-4h4v-4h4"/>
</svg>`;

/**
 * Star icon - Filled star (for ratings/favorites)
 */
export const ICON_STAR = `<svg viewBox="0 0 20 20" fill="currentColor">
  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
</svg>`;

/**
 * Search icon - Magnifying glass
 */
export const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
</svg>`;

/**
 * Grid icon - Grid layout view
 */
export const ICON_GRID = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
</svg>`;

/**
 * User icon - Person silhouette
 */
export const ICON_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
</svg>`;

/**
 * Edit icon - Pencil
 */
export const ICON_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
</svg>`;

/**
 * Trash icon - Delete/remove
 */
export const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
</svg>`;

/**
 * Image icon - Photo/picture (for image upload contexts)
 */
export const ICON_IMAGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
</svg>`;

/**
 * Info icon - Circle with "i" (for information)
 */
export const ICON_INFO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10"/>
  <line x1="12" y1="16" x2="12" y2="12"/>
  <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none"/>
</svg>`;

/**
 * About icon - Triangle warning sign with question mark (for about modals)
 */
export const ICON_ABOUT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L2 20h20L12 2Z" fill="none"/>
  <path d="M12 9c-1 0-1.5 0.5-1.5 1.5s0.5 1 1 1.5c0.5 0.5 0.5 1 0.5 1.5" fill="none"/>
  <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none"/>
</svg>`;

/**
 * Context menu icon - Vertical three dots (kebab menu)
 * Used for ResultCard action menus and dropdown triggers
 */
export const ICON_CONTEXT_MENU = `<svg viewBox="0 0 24 24" fill="currentColor">
  <circle cx="12" cy="5" r="2"/>
  <circle cx="12" cy="12" r="2"/>
  <circle cx="12" cy="19" r="2"/>
</svg>`;

/**
 * Globe icon - Language/internationalization selector
 */
export const ICON_GLOBE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="10" fill="none"/>
  <line x1="2" y1="12" x2="22" y2="12"/>
  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none"/>
</svg>`;

/**
 * Logo icon - XIV Dye Tools paint bucket with brush (branding)
 */
export const ICON_LOGO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" opacity="0.3"/>
  <path d="M7 14v4c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-4"/>
  <path d="M7 14c0-2 1-3 2.5-3.5"/>
  <path d="M17 14c0-2-1-3-2.5-3.5"/>
  <ellipse cx="12" cy="10" rx="3" ry="1.5" fill="currentColor" stroke="none" opacity="0.5"/>
  <path d="M12 3v4" stroke-width="2"/>
  <path d="M10 3h4" stroke-width="2"/>
  <circle cx="12" cy="14" r="2" fill="currentColor" stroke="none" opacity="0.7"/>
</svg>`;

/**
 * Link icon - Chain link for copy/share URLs
 * Replaces: 🔗 emoji
 */
export const ICON_LINK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 13a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5"/>
  <path d="M14 11a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1.5-1.5"/>
</svg>`;

/**
 * Document icon - For submissions/write actions
 * Replaces: 📝 emoji
 */
export const ICON_DOCUMENT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 3v4a1 1 0 001 1h4"/>
  <path d="M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z"/>
  <path d="M9 9h1M9 13h6M9 17h6"/>
</svg>`;

/**
 * Locked icon - Padlock for auth required states
 * Replaces: 🔐 emoji
 */
export const ICON_LOCKED = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="11" width="14" height="10" rx="2"/>
  <path d="M8 11V7a4 4 0 018 0v4"/>
  <circle cx="12" cy="16" r="1" fill="currentColor"/>
</svg>`;

/**
 * Lock icon - Security indicator
 * Replaces: 🔒 emoji
 */
export const ICON_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="5" y="11" width="14" height="10" rx="2"/>
  <path d="M8 11V7a4 4 0 018 0v4"/>
  <circle cx="12" cy="16" r="1" fill="currentColor"/>
</svg>`;

/**
 * Network icon - Antenna for connection status
 * Replaces: 📡 emoji
 */
export const ICON_NETWORK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 20v-4"/>
  <path d="M12 12V8"/>
  <path d="M12 4l6 4-6 4-6-4 6-4z"/>
  <path d="M6 8v4l6 4 6-4V8"/>
  <circle cx="12" cy="20" r="2"/>
</svg>`;

/**
 * Book icon - Tutorial/guide documentation
 * Replaces: 📚 emoji
 */
export const ICON_BOOK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
  <path d="M8 7h8M8 11h8M8 15h5"/>
</svg>`;

/**
 * Success icon - Checkmark for success states
 * Replaces: ✅ emoji
 */
export const ICON_SUCCESS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <path d="M8 12l3 3 5-6"/>
</svg>`;

/**
 * Error icon - X for error states
 * Replaces: ❌ emoji
 */
export const ICON_ERROR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9"/>
  <path d="M15 9l-6 6M9 9l6 6"/>
</svg>`;

/**
 * Refresh icon - Circular arrow for reset/reload actions
 * Replaces: 🔄 emoji
 */
export const ICON_REFRESH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 12a9 9 0 019-9 9.75 9.75 0 016.74 2.74L21 8"/>
  <path d="M21 3v5h-5"/>
  <path d="M21 12a9 9 0 01-9 9 9.75 9.75 0 01-6.74-2.74L3 16"/>
  <path d="M3 21v-5h5"/>
</svg>`;

/**
 * Import/Download icon - Arrow pointing down into tray
 * Replaces: 📥 emoji
 */
export const ICON_IMPORT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/>
  <line x1="12" y1="15" x2="12" y2="3"/>
</svg>`;

/**
 * Folder icon - For saved palettes/collections
 * Replaces: 🗂️ emoji
 */
export const ICON_FOLDER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
</svg>`;

/**
 * Zap/Lightning icon - For performance mode
 */
export const ICON_ZAP = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
</svg>`;

/**
 * Chart/Analytics icon - For analytics/statistics
 */
export const ICON_CHART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <line x1="18" y1="20" x2="18" y2="10"/>
  <line x1="12" y1="20" x2="12" y2="4"/>
  <line x1="6" y1="20" x2="6" y2="14"/>
</svg>`;

/**
 * Clipboard/paste icon - For paste from clipboard actions
 */
export const ICON_CLIPBOARD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
</svg>`;

/**
 * Keyboard icon - For keyboard shortcuts
 * Replaces: ⌨️ emoji
 */
export const ICON_KEYBOARD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="2" y="6" width="20" height="12" rx="2"/>
  <line x1="6" y1="10" x2="6" y2="10.01"/>
  <line x1="10" y1="10" x2="10" y2="10.01"/>
  <line x1="14" y1="10" x2="14" y2="10.01"/>
  <line x1="18" y1="10" x2="18" y2="10.01"/>
  <line x1="6" y1="14" x2="6" y2="14.01"/>
  <line x1="18" y1="14" x2="18" y2="14.01"/>
  <line x1="10" y1="14" x2="14" y2="14"/>
</svg>`;

/**
 * Map of UI icon names to SVG strings
 */
export const UI_ICONS: Record<string, string> = {
  theme: ICON_THEME,
  camera: ICON_CAMERA,
  eyedropper: ICON_EYEDROPPER,
  save: ICON_SAVE,
  share: ICON_SHARE,
  hint: ICON_HINT,
  'zoom-fit': ICON_ZOOM_FIT,
  'zoom-width': ICON_ZOOM_WIDTH,
  crystal: ICON_CRYSTAL,
  upload: ICON_UPLOAD,
  warning: ICON_WARNING,
  dice: ICON_DICE,
  coins: ICON_COINS,
  broom: ICON_BROOM,
  filter: ICON_FILTER,
  market: ICON_MARKET,
  export: ICON_EXPORT,
  beaker: ICON_BEAKER,
  settings: ICON_SETTINGS,
  palette: ICON_PALETTE,
  sort: ICON_SORT,
  eye: ICON_EYE,
  sliders: ICON_SLIDERS,
  target: ICON_TARGET,
  sparkles: ICON_SPARKLES,
  distance: ICON_DISTANCE,
  music: ICON_MUSIC,
  'test-tube': ICON_TEST_TUBE,
  'beaker-pipe': ICON_BEAKER_PIPE,
  stairs: ICON_STAIRS,
  star: ICON_STAR,
  search: ICON_SEARCH,
  grid: ICON_GRID,
  user: ICON_USER,
  edit: ICON_EDIT,
  trash: ICON_TRASH,
  image: ICON_IMAGE,
  info: ICON_INFO,
  about: ICON_ABOUT,
  globe: ICON_GLOBE,
  logo: ICON_LOGO,
  'context-menu': ICON_CONTEXT_MENU,
  close: ICON_CLOSE,
  // Emoji replacement icons
  link: ICON_LINK,
  document: ICON_DOCUMENT,
  locked: ICON_LOCKED,
  lock: ICON_LOCK,
  network: ICON_NETWORK,
  book: ICON_BOOK,
  success: ICON_SUCCESS,
  error: ICON_ERROR,
  refresh: ICON_REFRESH,
  import: ICON_IMPORT,
  folder: ICON_FOLDER,
  zap: ICON_ZAP,
  chart: ICON_CHART,
  keyboard: ICON_KEYBOARD,
  clipboard: ICON_CLIPBOARD,
};

/**
 * Get UI icon by name
 */
export function getUIIcon(name: string): string | undefined {
  return UI_ICONS[name];
}
