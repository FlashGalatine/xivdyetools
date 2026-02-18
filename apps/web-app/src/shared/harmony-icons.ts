/**
 * XIV Dye Tools - Harmony Type SVG Icons
 *
 * Inline SVG strings for harmony type icons using currentColor
 * for automatic theme adaptation.
 *
 * @module shared/harmony-icons
 */

/**
 * Harmony type icon SVG strings
 * All icons use currentColor for stroke/fill to inherit parent text color
 */
export const HARMONY_ICONS: Record<string, string> = {
  complementary: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Complementary Harmony</title>
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="12" cy="21" r="2.5" fill="currentColor" stroke="none" />
  <line x1="12" y1="5.5" x2="12" y2="18.5" stroke-dasharray="2 2" />
</svg>`,

  analogous: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Analogous Harmony</title>
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <circle cx="7" cy="4.5" r="2" fill="currentColor" stroke="none" />
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="17" cy="4.5" r="2" fill="currentColor" stroke="none" />
  <path d="M 7 4.5 Q 12 2 17 4.5" fill="none" />
</svg>`,

  triadic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Triadic Harmony</title>
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <polygon points="12,3 21,18 3,18" fill="none" />
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="21" cy="18" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="3" cy="18" r="2.5" fill="currentColor" stroke="none" />
</svg>`,

  'split-complementary': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Split-Complementary Harmony</title>
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <line x1="12" y1="3" x2="12" y2="12" />
  <line x1="12" y1="12" x2="6" y2="20" />
  <line x1="12" y1="12" x2="18" y2="20" />
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="6" cy="20" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="18" cy="20" r="2.5" fill="currentColor" stroke="none" />
</svg>`,

  tetradic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Tetradic Harmony</title>
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <rect x="5" y="5" width="14" height="14" fill="none" rx="1" />
  <circle cx="5" cy="5" r="2" fill="currentColor" stroke="none" />
  <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none" />
  <circle cx="19" cy="19" r="2" fill="currentColor" stroke="none" />
  <circle cx="5" cy="19" r="2" fill="currentColor" stroke="none" />
</svg>`,

  square: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Square Harmony</title>
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <polygon points="12,3 21,12 12,21 3,12" fill="none" />
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="21" cy="12" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="12" cy="21" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="3" cy="12" r="2.5" fill="currentColor" stroke="none" />
</svg>`,

  monochromatic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Monochromatic Harmony</title>
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <circle cx="12" cy="3" r="2" fill="currentColor" stroke="none" opacity="1" />
  <circle cx="12" cy="8" r="2" fill="currentColor" stroke="none" opacity="0.6" />
  <circle cx="12" cy="13" r="2" fill="currentColor" stroke="none" opacity="0.35" />
  <line x1="12" y1="5" x2="12" y2="11" stroke-dasharray="1 2" opacity="0.5" />
</svg>`,

  compound: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Compound Harmony</title>
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="2 2" />
  <circle cx="12" cy="3" r="2.5" fill="currentColor" stroke="none" />
  <circle cx="12" cy="21" r="2" fill="currentColor" stroke="none" />
  <circle cx="7" cy="19" r="2" fill="currentColor" stroke="none" />
  <circle cx="17" cy="19" r="2" fill="currentColor" stroke="none" />
  <path d="M 7 19 Q 12 22 17 19" fill="none" />
</svg>`,

  shades: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
  <title>Shades Harmony</title>
  <circle cx="12" cy="12" r="10" opacity="0.3" />
  <circle cx="12" cy="4" r="2.5" fill="currentColor" stroke="none" opacity="0.25" />
  <circle cx="12" cy="10" r="2.5" fill="currentColor" stroke="none" opacity="0.6" />
  <circle cx="12" cy="16" r="2.5" fill="currentColor" stroke="none" opacity="1" />
  <line x1="12" y1="6.5" x2="12" y2="7.5" stroke-dasharray="1 1" opacity="0.4" />
  <line x1="12" y1="12.5" x2="12" y2="13.5" stroke-dasharray="1 1" opacity="0.7" />
</svg>`,
};
