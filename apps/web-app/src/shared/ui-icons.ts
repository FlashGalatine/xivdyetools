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

import { chromeGlyph, panelGlyph } from '@xivdyetools/svg';
import { themedAccent } from './glyph-accent';

/**
 * Theme switcher icons — the confirmed 3D sun/moon pair (32 grid).
 * The header shows the glyph of the ACTIVE theme.
 */
export const ICON_THEME_SUN = themedAccent(chromeGlyph('sun', { fluid: true }));
export const ICON_THEME_MOON = themedAccent(chromeGlyph('moon', { fluid: true }));

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
 * Hint icon - Light bulb
 */
export const ICON_HINT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M 12 3 C 9 3 7 5 7 8 C 7 10 8 11.5 9 12.5 L 9 15 C 9 16 10 17 11 17 L 13 17 C 14 17 15 16 15 15 L 15 12.5 C 16 11.5 17 10 17 8 C 17 5 15 3 12 3 Z" />
  <line x1="10" y1="17" x2="14" y2="17" />
  <line x1="10.5" y1="19" x2="13.5" y2="19" />
  <circle cx="12" cy="9" r="1.5" fill="currentColor" stroke="none" opacity="0.5" />
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
 * Market icon - Store/shop front
 */
export const ICON_MARKET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
  <polyline points="9 22 9 12 15 12 15 22"/>
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
 * Settings icon — the confirmed 32-grid gear (keeps the ICON_SETTINGS name).
 */
export const ICON_SETTINGS = themedAccent(panelGlyph('gear', { fluid: true }));

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
 * Music icon - Music note (for harmony types)
 */
export const ICON_MUSIC = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="8" cy="18" r="4"/>
  <path d="M12 18V2l7 4"/>
</svg>`;

/**
 * Stairs icon - Staircase/steps (for interpolation)
 */
export const ICON_STAIRS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 20h4v-4h4v-4h4v-4h4"/>
  <path d="M4 20v-4h4v-4h4v-4h4v-4h4"/>
</svg>`;

/**
 * Star pair (5.0): one geometry on the 32 grid, two states — outline for
 * not-voted/not-saved, filled (accent slot) for voted/saved. State comes from
 * the fill, never from fading. Geometry home: `@xivdyetools/svg`.
 */
export const ICON_STAR = panelGlyph('star', { fluid: true });
export const ICON_STAR_FILLED = themedAccent(panelGlyph('star-fill', { fluid: true }));

/**
 * Back arrow icon - Left-pointing chevron (moved from category-icons.ts —
 * a navigation affordance, not a category)
 */
export const ICON_ARROW_BACK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M15 18l-6-6 6-6" />
</svg>`;

/**
 * Image icon - Photo/picture (for image upload contexts)
 */
export const ICON_IMAGE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
</svg>`;

/**
 * About icon - Triangle warning sign with question mark (for about modals)
 */
export const ICON_ABOUT = themedAccent(chromeGlyph('about', { fluid: true }));

/**
 * Context menu icon - Vertical three dots (kebab menu)
 * Used for ResultCard action menus and dropdown triggers
 */
export const ICON_CONTEXT_MENU = panelGlyph('kebab', { fluid: true });

/**
 * Globe icon - Language/internationalization selector
 */
export const ICON_GLOBE = chromeGlyph('globe', { fluid: true });

/**
 * Link icon - Chain link for copy/share URLs
 * Replaces: 🔗 emoji
 */
export const ICON_LINK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M10 13a4 4 0 005.66 0l3-3a4 4 0 00-5.66-5.66l-1.5 1.5"/>
  <path d="M14 11a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1.5-1.5"/>
</svg>`;

/**
 * Scroll / parchment icon - For the "What's New" release-notes button
 * Curled top and bottom rollers evoke an unfurled scroll
 */
export const ICON_SCROLL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19 17V5a2 2 0 00-2-2H4"/>
  <path d="M8 21h12a2 2 0 002-2v-1a1 1 0 00-1-1H11a1 1 0 00-1 1v1a2 2 0 11-4 0V5a2 2 0 10-4 0v2a1 1 0 001 1h3"/>
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
 * Clipboard/paste icon - For paste from clipboard actions
 */
export const ICON_CLIPBOARD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
</svg>`;
