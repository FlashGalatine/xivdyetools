/**
 * XIV Dye Tools - Tool Navigation SVG Icons
 *
 * Inline SVG icons for tool navigation using currentColor for theme adaptation
 * These replace external SVG files loaded via <img> tags which can't inherit color
 *
 * @module shared/tool-icons
 */

/**
 * Harmony Explorer icon - Square Harmony (circle with rotated square)
 */
export const ICON_TOOL_HARMONY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="12" r="9" fill="none"/>
  <rect x="7" y="7" width="10" height="10" transform="rotate(45 12 12)" fill="none"/>
</svg>`;

/**
 * Palette Extractor icon - Selection Crop (corner brackets with center swatch)
 */
export const ICON_TOOL_MATCHER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 8V5C3 3.89543 3.89543 3 5 3H8" fill="none"/>
  <path d="M21 8V5C21 3.89543 20.1046 3 19 3H16" fill="none"/>
  <path d="M3 16V19C3 20.1046 3.89543 21 5 21H8" fill="none"/>
  <path d="M21 16V19C21 20.1046 20.1046 21 19 21H16" fill="none"/>
  <rect x="8" y="8" width="8" height="8" rx="1" fill="none" opacity="0.5"/>
</svg>`;

/**
 * Accessibility Checker icon - Eye Check (eye with magnifier accent)
 */
export const ICON_TOOL_ACCESSIBILITY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" fill="none"/>
  <circle cx="12" cy="12" r="3" fill="none"/>
  <path d="M16 17L21 22" fill="none"/>
</svg>`;

/**
 * Dye Comparison icon - Cards Stack (overlapping card swatches)
 */
export const ICON_TOOL_COMPARISON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="3" width="14" height="14" rx="2" fill="none"/>
  <rect x="7" y="7" width="14" height="14" rx="2" fill="currentColor" fill-opacity="0.1"/>
</svg>`;

/**
 * Gradient Builder icon - Linear Fade (rectangle with gradient dividers)
 */
export const ICON_TOOL_MIXER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="5" width="18" height="14" rx="2" fill="none"/>
  <line x1="7" y1="5" x2="7" y2="19"/>
  <line x1="12" y1="5" x2="12" y2="19" opacity="0.6"/>
  <line x1="17" y1="5" x2="17" y2="19" opacity="0.3"/>
</svg>`;

/**
 * Community Presets icon - Share Star (upload arrow with container)
 */
export const ICON_TOOL_PRESETS = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 12V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 20V12" fill="none"/>
  <path d="M12 3L12 15" fill="none"/>
  <path d="M8 7L12 3L16 7" fill="none"/>
</svg>`;

/**
 * Budget Suggestions icon - Price Tag (diamond tag with dot)
 */
export const ICON_TOOL_BUDGET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 2L2 12L12 22L22 12L12 2Z" fill="none"/>
  <circle cx="12" cy="7" r="1.5" fill="currentColor"/>
</svg>`;

/**
 * Swatch Matcher icon - Face ID (portrait frame with face elements)
 */
export const ICON_TOOL_CHARACTER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="4" width="18" height="16" rx="2" fill="none"/>
  <circle cx="12" cy="10" r="3" fill="none"/>
  <path d="M16 17C16 17 14.5 14 12 14C9.5 14 8 17 8 17" fill="none"/>
</svg>`;

/**
 * Tools Menu icon - Toolbox
 */
export const ICON_TOOL_MENU = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="4" y="10" width="16" height="10" rx="1" fill="none"/>
  <path d="M 4 10 L 4 8 C 4 7 5 6 6 6 L 9 6" fill="none"/>
  <path d="M 20 10 L 20 8 C 20 7 19 6 18 6 L 15 6" fill="none"/>
  <path d="M 9 6 L 9 4 C 9 3 10 2 12 2 C 14 2 15 3 15 4 L 15 6" fill="none"/>
  <rect x="11" y="13" width="2" height="3" rx="0.5" fill="currentColor" stroke="none" opacity="0.6"/>
  <line x1="12" y1="10" x2="12" y2="20" opacity="0.3" stroke-width="1"/>
</svg>`;

/**
 * Dye Mixer icon - Alchemy Flask (laboratory flask shape)
 */
export const ICON_TOOL_DYE_MIXER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="M14 10V3H10V10L6 18C6 19.6569 7.34315 21 9 21H15C16.6569 21 18 19.6569 18 18L14 10Z" fill="none"/>
  <path d="M10 14H14" fill="none"/>
</svg>`;

/**
 * Map of tool icon names to SVG strings
 * V4: Updated with new tool IDs (extractor, gradient, swatch, mixer)
 */
export const TOOL_ICONS: Record<string, string> = {
  // V4 tool IDs
  harmony: ICON_TOOL_HARMONY,
  extractor: ICON_TOOL_MATCHER, // v4 name (was 'matcher')
  accessibility: ICON_TOOL_ACCESSIBILITY,
  comparison: ICON_TOOL_COMPARISON,
  gradient: ICON_TOOL_MIXER, // v4 name (was 'mixer' - now Gradient Builder)
  mixer: ICON_TOOL_DYE_MIXER, // NEW v4 Dye Mixer tool
  presets: ICON_TOOL_PRESETS,
  budget: ICON_TOOL_BUDGET,
  swatch: ICON_TOOL_CHARACTER, // v4 name (was 'character')
  // Legacy aliases for backwards compatibility
  matcher: ICON_TOOL_MATCHER,
  character: ICON_TOOL_CHARACTER,
  tools: ICON_TOOL_MENU,
};

/**
 * Get tool icon by name
 */
export function getToolIcon(name: string): string | undefined {
  return TOOL_ICONS[name];
}
