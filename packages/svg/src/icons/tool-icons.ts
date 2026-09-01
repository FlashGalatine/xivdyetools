/**
 * XIV Dye Tools 5.0 icon system — the single geometry home.
 *
 * Ported from the confirmed design geometry (`tool-glyph.js`; verdicts in the
 * design register: tool glyphs = 1B Chip Cluster coloured 1E; detail set
 * complete ×9 confirmed 2026-08-07; harmony types = ten positions on a 1.2
 * ring at real HarmonyGenerator offsets; chrome trio 3A/3D/3F; panel + empty
 * state set confirmed 2026-08-07; five categories, five icons).
 *
 * System rules baked in:
 * - 32×32 grid, 28-unit live area, stroke 2.4 (2.2 on harmony rings), one
 *   chip primitive, **exactly one filled element per glyph — the accent
 *   slot** (`#EA4133` dark themes / `#CE2222` light; mono on dye-coloured
 *   grounds by passing `accent = ink`).
 * - Two tool variants: `compact` (16-24 px) and `detail` (≥62 px, adds a
 *   1.2-weight context layer — never a new object).
 * - `fill="none"` stays explicit on the group (`tool-banner.ts` floods
 *   otherwise) and glyphs are emitted as real inline SVG — **never
 *   `<symbol>`/`<use>`** (use-shadow trees inherit neither color nor stroke).
 * - **`currentColor` is black in resvg** and in sibling-of-coloured-text
 *   cases. Renderers (bot/OG cards) MUST pass an explicit `ink`; the
 *   `currentColor` default exists only for browser DOM consumers.
 * - No load-bearing opacity anywhere in the set.
 */

/** Accent for one filled element per glyph — dark grounds. */
export const GLYPH_ACCENT_DARK = '#EA4133';
/** Accent on light grounds (also the app-icon tile red). */
export const GLYPH_ACCENT_LIGHT = '#CE2222';

/** The nine tools + the tools-menu glyph (which takes no accent chip). */
export type ToolGlyphName =
  | 'harmony'
  | 'extractor'
  | 'accessibility'
  | 'comparison'
  | 'gradient'
  | 'mixer'
  | 'presets'
  | 'budget'
  | 'swatch'
  | 'tools';

export type HarmonyGlyphName =
  | 'complementary'
  | 'analogous'
  | 'triadic'
  | 'split'
  | 'tetradic'
  | 'inverted-tetradic'
  | 'square'
  | 'mono'
  | 'compound'
  | 'shades';

export type ChromeGlyphName = 'about' | 'sun' | 'moon' | 'globe';

export type PanelGlyphName =
  | 'search'
  | 'funnel'
  | 'alert'
  | 'wait'
  | 'folder'
  | 'coins'
  | 'steps'
  | 'formats'
  | 'stack'
  | 'ratio'
  | 'kebab'
  | 'presets-empty'
  | 'star'
  | 'star-fill'
  | 'swap'
  | 'pin'
  | 'pin-off'
  | 'anchor'
  | 'dye'
  | 'gear';

export type CategoryGlyphName =
  | 'jobs'
  | 'grand-companies'
  | 'seasons'
  | 'events'
  | 'aesthetics'
  | 'appearance'
  | 'zones'
  | 'raids-trials'
  | 'default';

const RING = '<circle cx="16" cy="16" r="11.6" stroke-width="1.4"/>';

/**
 * Raw geometry. `F` marks the single filled accent element and is substituted
 * at render. Do not hand-edit paths — the design project's `tool-glyph.js` is
 * the drawing record; changes land there first.
 */
const TOOL_COMPACT: Record<ToolGlyphName, string> = {
  harmony:
    '<rect x="21.4" y="11.5" width="9" height="9" rx="2"/><rect x="11.5" y="21.4" width="9" height="9" rx="2"/><rect x="1.6" y="11.5" width="9" height="9" rx="2"/><rect F x="11.5" y="1.6" width="9" height="9" rx="2"/>',
  extractor:
    '<rect x="1.7" y="1.7" width="14.6" height="14.6" rx="2.4"/><rect x="17" y="17" width="6.2" height="6.2" rx="1.6"/><rect F x="24" y="24" width="6.4" height="6.4" rx="1.6"/>',
  accessibility:
    '<rect x="6.2" y="6.2" width="19.6" height="19.6" rx="2.6"/><path F d="M16 7.6 H9.6 a2 2 0 0 0 -2 2 V22.4 a2 2 0 0 0 2 2 H16 Z"/>',
  comparison:
    '<rect x="17.4" y="9.4" width="13" height="13" rx="2.2"/><rect F x="1.6" y="9.4" width="13" height="13" rx="2.2"/>',
  gradient:
    '<rect x="9.4" y="15.8" width="7.4" height="7.4" rx="1.8"/><rect x="16.8" y="8.6" width="7.4" height="7.4" rx="1.8"/><rect x="23.2" y="1.6" width="7.4" height="7.4" rx="1.8"/><rect F x="1.6" y="23" width="7.4" height="7.4" rx="1.8"/>',
  mixer:
    '<rect x="1.6" y="2.6" width="17" height="17" rx="2.6"/><rect x="13.4" y="11.4" width="17" height="17" rx="2.6"/><path F d="M13.4 14 a2.6 2.6 0 0 1 2.6 -2.6 H18.6 V17 a2.6 2.6 0 0 1 -2.6 2.6 H13.4 Z"/>',
  presets:
    '<rect x="12" y="5.6" width="8" height="8" rx="1.8"/><rect x="21.4" y="5.6" width="8" height="8" rx="1.8"/><rect x="2.6" y="18.4" width="8" height="8" rx="1.8"/><rect x="12" y="18.4" width="8" height="8" rx="1.8"/><rect x="21.4" y="18.4" width="8" height="8" rx="1.8"/><rect F x="2.6" y="5.6" width="8" height="8" rx="1.8"/>',
  budget:
    '<g transform="rotate(-45 16 16)"><path d="M8.2 6.2 H17 L25.8 15 V23.8 a2 2 0 0 1 -2 2 H8.2 a2 2 0 0 1 -2 -2 V8.2 a2 2 0 0 1 2 -2 Z"/><circle F cx="19.4" cy="12" r="2.3"/></g>',
  swatch:
    '<path d="M5.4 30.4 V17.4 a10.6 10.6 0 0 1 21.2 0 V30.4"/><rect F x="12" y="17.2" width="8" height="8" rx="2"/>',
  // The Tools menu takes no chip: its centre dot renders in ink, not accent.
  tools:
    '<circle cx="8" cy="8" r="2"/><circle cx="16" cy="8" r="2"/><circle cx="24" cy="8" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="24" cy="16" r="2"/><circle cx="8" cy="24" r="2"/><circle cx="16" cy="24" r="2"/><circle cx="24" cy="24" r="2"/><circle cx="16" cy="16" r="2.6" fill="INK" stroke="none"/>',
};

/** Detail variants (≥62 px): one 1.2-weight context layer per glyph. */
const TOOL_DETAIL: Record<Exclude<ToolGlyphName, 'tools'>, string> = {
  harmony:
    '<circle cx="16" cy="16" r="13.6" stroke-width="1.2"/><circle cx="23.6" cy="8.4" r="0.9" stroke-width="1.2"/><circle cx="23.6" cy="23.6" r="0.9" stroke-width="1.2"/><circle cx="8.4" cy="23.6" r="0.9" stroke-width="1.2"/><circle cx="8.4" cy="8.4" r="0.9" stroke-width="1.2"/><rect x="21.4" y="11.5" width="9" height="9" rx="2"/><rect x="11.5" y="21.4" width="9" height="9" rx="2"/><rect x="1.6" y="11.5" width="9" height="9" rx="2"/><rect F x="11.5" y="1.6" width="9" height="9" rx="2"/>',
  extractor:
    '<rect x="1.7" y="1.7" width="14.6" height="14.6" rx="2.4"/><circle cx="5.8" cy="6.2" r="0.9" stroke-width="1.2"/><circle cx="11.6" cy="4.9" r="0.9" stroke-width="1.2"/><circle cx="8.3" cy="11.8" r="0.9" stroke-width="1.2"/><rect x="17" y="17" width="6.2" height="6.2" rx="1.6"/><rect F x="24" y="24" width="6.4" height="6.4" rx="1.6"/>',
  accessibility:
    '<path d="M 1.8 6 V 1.8 H 6" stroke-width="1.2"/><path d="M 26 1.8 H 30.2 V 6" stroke-width="1.2"/><path d="M 30.2 26 V 30.2 H 26" stroke-width="1.2"/><path d="M 6 30.2 H 1.8 V 26" stroke-width="1.2"/><rect x="6.2" y="6.2" width="19.6" height="19.6" rx="2.6"/><path F d="M16 7.6 H9.6 a2 2 0 0 0 -2 2 V22.4 a2 2 0 0 0 2 2 H16 Z"/>',
  comparison:
    '<rect x="17.4" y="7.4" width="13" height="13" rx="2.2"/><path d="M2 27.4 H30" stroke-width="1.2"/><path d="M2 25 V29.8" stroke-width="1.2"/><path d="M30 25 V29.8" stroke-width="1.2"/><path d="M16 25.4 V29.4" stroke-width="1.2"/><rect F x="1.6" y="7.4" width="13" height="13" rx="2.2"/>',
  gradient:
    '<path d="M 12.6 30.4 L 30.4 12.6" stroke-width="1.2"/><path d="M 11.4 29.2 L 13.8 31.6" stroke-width="1.2"/><path d="M 29.2 11.4 L 31.6 13.8" stroke-width="1.2"/><rect x="9.4" y="15.8" width="7.4" height="7.4" rx="1.8"/><rect x="16.8" y="8.6" width="7.4" height="7.4" rx="1.8"/><rect x="23.2" y="1.6" width="7.4" height="7.4" rx="1.8"/><rect F x="1.6" y="23" width="7.4" height="7.4" rx="1.8"/>',
  mixer:
    '<rect x="1.6" y="2.6" width="17" height="17" rx="2.6"/><rect x="13.4" y="11.4" width="17" height="17" rx="2.6"/><circle cx="10.1" cy="11.1" r="0.9" stroke-width="1.2"/><circle cx="21.9" cy="19.9" r="0.9" stroke-width="1.2"/><path F d="M13.4 14 a2.6 2.6 0 0 1 2.6 -2.6 H18.6 V17 a2.6 2.6 0 0 1 -2.6 2.6 H13.4 Z"/>',
  presets:
    '<path d="M 2.6 15.4 H 29.4" stroke-width="1.2"/><path d="M 2.6 28.2 H 29.4" stroke-width="1.2"/><rect x="12" y="5.6" width="8" height="8" rx="1.8"/><rect x="21.4" y="5.6" width="8" height="8" rx="1.8"/><rect x="2.6" y="18.4" width="8" height="8" rx="1.8"/><rect x="12" y="18.4" width="8" height="8" rx="1.8"/><rect x="21.4" y="18.4" width="8" height="8" rx="1.8"/><rect F x="2.6" y="5.6" width="8" height="8" rx="1.8"/>',
  budget:
    '<g transform="rotate(-45 16 16)"><path d="M8.2 2.4 H17.6 L26.4 11.2" stroke-width="1.2"/><path d="M8.2 6.2 H17 L25.8 15 V23.8 a2 2 0 0 1 -2 2 H8.2 a2 2 0 0 1 -2 -2 V8.2 a2 2 0 0 1 2 -2 Z"/><circle F cx="19.4" cy="12" r="2.3"/></g>',
  swatch:
    '<path d="M 9.4 30.4 V 17.4 a 6.6 6.6 0 0 1 13.2 0 V 30.4" stroke-width="1.2"/><path d="M 5.4 30.4 V 17.4 a10.6 10.6 0 0 1 21.2 0 V 30.4"/><rect F x="12" y="17.2" width="8" height="8" rx="2"/>',
};

/** Harmony types: ten positions on a 1.4-weight ring at real generator offsets. */
const HARMONY: Record<HarmonyGlyphName, string> = {
  complementary:
    RING +
    '<rect x="13" y="24.6" width="6" height="6" rx="1.5"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
  analogous:
    RING +
    '<rect x="18.8" y="2.95" width="6" height="6" rx="1.5"/><rect x="7.2" y="2.95" width="6" height="6" rx="1.5"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
  triadic:
    RING +
    '<rect x="23.05" y="18.8" width="6" height="6" rx="1.5"/><rect x="2.95" y="18.8" width="6" height="6" rx="1.5"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
  split:
    RING +
    '<rect x="18.8" y="23.05" width="6" height="6" rx="1.5"/><rect x="7.2" y="23.05" width="6" height="6" rx="1.5"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
  tetradic:
    RING +
    '<rect x="23.05" y="7.2" width="6" height="6" rx="1.5"/><rect x="13" y="24.6" width="6" height="6" rx="1.5"/><rect x="2.95" y="18.8" width="6" height="6" rx="1.5"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
  'inverted-tetradic':
    RING +
    '<rect x="23.05" y="18.8" width="6" height="6" rx="1.5"/><rect x="13" y="24.6" width="6" height="6" rx="1.5"/><rect x="2.95" y="7.2" width="6" height="6" rx="1.5"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
  square:
    RING +
    '<rect x="24.6" y="13" width="6" height="6" rx="1.5"/><rect x="13" y="24.6" width="6" height="6" rx="1.5"/><rect x="1.4" y="13" width="6" height="6" rx="1.5"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
  mono:
    RING +
    '<rect x="13.5" y="7.4" width="5" height="5" rx="1.3"/><rect x="14" y="13" width="4" height="4" rx="1.1"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
  compound:
    RING +
    '<rect x="18.8" y="2.95" width="6" height="6" rx="1.5"/><rect x="7.2" y="2.95" width="6" height="6" rx="1.5"/><rect x="13" y="24.6" width="6" height="6" rx="1.5"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
  shades:
    RING +
    '<rect x="16.3" y="2.1" width="5.4" height="5.4" rx="1.3"/><rect x="10.3" y="2.1" width="5.4" height="5.4" rx="1.3"/><rect F x="13" y="1.4" width="6" height="6" rx="1.5"/>',
};

/** Chrome trio (3A paint can / 3D sun + moon / 3F globe). */
const CHROME: Record<ChromeGlyphName, string> = {
  about:
    '<path d="M8.4 8 C9.6 2.6 22.4 2.6 23.6 8"/><ellipse cx="16" cy="9.6" rx="9" ry="3.2"/><path d="M7 9.6 C7 18 8.6 24.6 9.8 28.6 H22.2 C23.4 24.6 25 18 25 9.6"/><ellipse F cx="16" cy="9.6" rx="5" ry="1.7"/>',
  sun: '<path d="M25.4 16 H29.4"/><path d="M22.6 22.6 L25.5 25.5"/><path d="M16 25.4 V29.4"/><path d="M9.4 22.6 L6.5 25.5"/><path d="M6.6 16 H2.6"/><path d="M9.4 9.4 L6.5 6.5"/><path d="M16 6.6 V2.6"/><path d="M22.6 9.4 L25.5 6.5"/><circle F cx="16" cy="16" r="6.2"/>',
  moon: '<path F d="M28 17.05 A12 12 0 1 1 14.95 4 A9.33 9.33 0 0 0 28 17.05 Z"/>',
  globe:
    '<circle cx="16" cy="16" r="12.4"/><path d="M3.6 16 H28.4"/><path d="M16 3.6 a19.5 19.5 0 0 1 5.2 12.4 19.5 19.5 0 0 1 -5.2 12.4 19.5 19.5 0 0 1 -5.2 -12.4 19.5 19.5 0 0 1 5.2 -12.4 z"/>',
};

/** Panel / affordance / empty-state glyphs (32 grid, weight 2.4). */
const PANEL: Record<PanelGlyphName, string> = {
  search: '<circle cx="13.6" cy="13.6" r="10"/><path d="M20.9 20.9 L28.6 28.6"/>',
  funnel: '<path d="M3.2 4.6 H28.8 L19.8 15.6 V27 L12.2 23 V15.6 Z"/>',
  alert:
    '<path d="M16 3.8 L29.4 27.2 H2.6 Z"/><path d="M16 12.4 V19"/><circle F cx="16" cy="23.4" r="1.5"/>',
  wait: '<path d="M7.6 3.4 H24.4"/><path d="M7.6 28.6 H24.4"/><path d="M10.2 3.4 V7.8 C10.2 11.8 13 13.8 16 16 C13 18.2 10.2 20.2 10.2 24.2 V28.6"/><path d="M21.8 3.4 V7.8 C21.8 11.8 19 13.8 16 16 C19 18.2 21.8 20.2 21.8 24.2 V28.6"/><circle F cx="16" cy="24.6" r="1.5"/>',
  folder:
    '<path d="M2.6 8.2 a2 2 0 0 1 2 -2 H11.6 L14.8 9.8 H27.4 a2 2 0 0 1 2 2 V24.2 a2 2 0 0 1 -2 2 H4.6 a2 2 0 0 1 -2 -2 Z"/>',
  coins: '<circle cx="12.2" cy="12.2" r="8.8"/><path d="M26 13.6 A 8.8 8.8 0 1 1 13.6 26"/>',
  steps:
    '<rect x="1.8" y="10" width="28.4" height="12" rx="3"/><path d="M8.4 10 V22"/><path d="M15 10 V22"/><path d="M21.6 10 V22"/><rect x="3" y="11.2" width="4.2" height="9.6" rx="1.4" fill="INK" stroke="none"/>',
  formats:
    '<path d="M16.8 13.4 H29.6"/><path d="M16.8 19.6 H25.6"/><rect F x="1.8" y="10.6" width="11" height="11" rx="2.4"/>',
  stack:
    '<ellipse cx="16" cy="10.4" rx="9.4" ry="3.4"/><ellipse cx="16" cy="16.4" rx="9.4" ry="3.4"/><ellipse cx="16" cy="22.4" rx="9.4" ry="3.4" fill="INK" stroke="none"/>',
  ratio:
    '<path d="M4.6 16 H27.4"/><path d="M4.6 11.6 V20.4"/><path d="M27.4 11.6 V20.4"/><rect F x="10.4" y="11.8" width="8.4" height="8.4" rx="1.8"/>',
  kebab:
    '<circle cx="16" cy="6.6" r="2.6" fill="INK" stroke="none"/><circle cx="16" cy="16" r="2.6" fill="INK" stroke="none"/><circle cx="16" cy="25.4" r="2.6" fill="INK" stroke="none"/>',
  'presets-empty':
    '<rect F x="2.6" y="5.6" width="8" height="8" rx="1.8"/><path d="M2.6 15.4 H29.4"/><path d="M2.6 28.2 H29.4"/>',
  // Star state lives in the fill, never in a fading opacity.
  star: '<path d="M16 3.4 L19.4 12.3 L28.9 12.8 L21.5 18.8 L24 28 L16 22.8 L8 28 L10.5 18.8 L3.1 12.8 L12.6 12.3 Z"/>',
  'star-fill':
    '<path F d="M16 3.4 L19.4 12.3 L28.9 12.8 L21.5 18.8 L24 28 L16 22.8 L8 28 L10.5 18.8 L3.1 12.8 L12.6 12.3 Z"/>',
  swap: '<rect x="21.4" y="19.6" width="9" height="9" rx="2"/><path d="M12.4 7.9 H22.6"/><path d="M20.2 5.6 L22.8 7.9 L20.2 10.2"/><path d="M19.6 24.1 H9.4"/><path d="M11.8 21.8 L9.2 24.1 L11.8 26.4"/><rect F x="1.6" y="3.4" width="9" height="9" rx="2"/>',
  pin: '<path d="M16 19.8 V29"/><rect F x="8.6" y="4.6" width="14.8" height="14.8" rx="2.6"/>',
  'pin-off': '<path d="M16 19.8 V29"/><rect x="8.6" y="4.6" width="14.8" height="14.8" rx="2.6"/>',
  anchor:
    '<path d="M16 2 V8"/><path d="M16 24 V30"/><rect F x="9.4" y="9.4" width="13.2" height="13.2" rx="2.4"/>',
  dye: '<rect F x="6.5" y="6.5" width="19" height="19" rx="3.4"/>',
  // The gear keeps the ICON_SETTINGS name at its consumers; new geometry here.
  gear: '<circle cx="16" cy="16" r="10.6"/><path d="M26.6 16 H29.4"/><path d="M21.3 25.2 L22.7 27.6"/><path d="M10.7 25.2 L9.3 27.6"/><path d="M5.4 16 H2.6"/><path d="M10.7 6.8 L9.3 4.4"/><path d="M21.3 6.8 L22.7 4.4"/><circle F cx="16" cy="16" r="4"/>',
};

/** Preset categories: five categories, five icons (+ default). */
const CATEGORY: Record<CategoryGlyphName, string> = {
  jobs: '<circle cx="16" cy="9" r="5.4"/><path d="M16 14.4 V29"/><circle cx="16" cy="9" r="2.1" fill="INK" stroke="none"/>',
  'grand-companies':
    '<path d="M7 4.6 V29"/><path d="M7 6 H26.4 L21.8 12.8 L26.4 19.6 H7"/><circle cx="7" cy="4" r="1.9" fill="INK" stroke="none"/>',
  seasons:
    '<circle cx="16" cy="16" r="11.6"/><path d="M16 4.4 V27.6"/><path d="M4.4 16 H27.6"/><path d="M16 16 V4.4 A11.6 11.6 0 0 1 27.6 16 Z" fill="INK" stroke="none"/>',
  events:
    '<path d="M16 9.6 V2.6"/><path d="M22.1 14 L28.7 11.9"/><path d="M19.8 21.2 L23.9 26.8"/><path d="M12.2 21.2 L8.1 26.8"/><path d="M9.9 14 L3.3 11.9"/><circle cx="16" cy="16" r="3.4" fill="INK" stroke="none"/>',
  aesthetics:
    '<path d="M16 4.4 a3.2 3.2 0 0 1 3.2 3.2 c0 1.8 -1.6 2.4 -3.2 2.9 V13.4"/><path d="M16 13.4 L4.4 22.2 a1.4 1.4 0 0 0 0.9 2.5 H26.7 a1.4 1.4 0 0 0 0.9 -2.5 Z"/>',
  // Turn 23 (design 6a/6b/6c). Fills here are INK, not accent — the category
  // set's convention. A head in PROFILE, so it cannot collide with the Swatch
  // tool's front-facing bust; profile is also why one eye is correct where a
  // front view would need two.
  appearance:
    '<path d="M9.6 23.4 C6.6 17.4 7.4 9.4 13.6 5.4 C19.2 1.8 24.8 5.4 24.8 11.8 C24.8 14 24.2 15 24 15.8 L27 19.6 L22.2 21 V23.4 C22.2 26 20.4 27.6 17.4 27.6 H12 C10.6 27.6 9.6 26.4 9.6 25 Z"/><circle cx="20.4" cy="13.2" r="1.9" fill="INK" stroke="none"/>',
  // TWO summits — one peak is a mountain, and the category is places. The disc
  // is bare: rays are what make a disc a sun, and that is the only reason this
  // can share a set with the events burst. The baseline is not decoration —
  // without it the ridge reads as a chart.
  zones:
    '<path d="M3.6 25.8 H28.4"/><path d="M4.8 25.8 L11.8 12.4 L17 19.8 L21.2 14.4 L27.2 25.8"/><circle cx="24.4" cy="7.4" r="2.6" fill="INK" stroke="none"/>',
  // Crossed blades, no fill (the aesthetics precedent). Crossed weapons only
  // became free when jobs became one upright staff; the two differ by
  // ORIENTATION, which is the difference that survives 16 px.
  'raids-trials':
    '<path d="M7 26.6 L25 8.6"/><path d="M7.9 21.5 L12.1 25.7"/><path d="M25 26.6 L7 8.6"/><path d="M19.9 25.7 L24.1 21.5"/>',
  default:
    '<rect x="12" y="12" width="8" height="8" rx="1.8"/><rect x="21.4" y="12" width="8" height="8" rx="1.8"/><rect x="2.6" y="12" width="8" height="8" rx="1.8" fill="INK" stroke="none"/>',
};

export interface GlyphRenderOptions {
  /** Rendered width/height in px (default 32) */
  size?: number;
  /**
   * Omit the width/height attributes so CSS sizes the glyph (browser DOM
   * shims). Renderer contexts must NOT use this — resvg needs explicit size.
   */
  fluid?: boolean;
  /**
   * Stroke/ink colour. Defaults to `currentColor` for browser DOM use —
   * renderer contexts (resvg: bot cards, OG images) MUST pin an explicit ink
   * or every stroke comes out black.
   */
  ink?: string;
  /**
   * Accent for the single filled element (default `#EA4133`). Pass the ink
   * colour for the mono variant on dye-coloured grounds.
   */
  accent?: string;
  /** Stroke weight override (per-set defaults otherwise) */
  weight?: number;
}

function renderGlyph(
  inner: string,
  defaultWeight: number,
  { size = 32, ink = 'currentColor', accent = GLYPH_ACCENT_DARK, weight, fluid }: GlyphRenderOptions = {}
): string {
  const substituted = inner
    .replace(' F ', ` stroke="none" fill="${accent}" `)
    .replaceAll('INK', ink);
  const sw = weight ?? defaultWeight;
  const sizeAttrs = fluid ? '' : `width="${size}" height="${size}" `;
  return (
    `<svg ${sizeAttrs}viewBox="0 0 32 32" aria-hidden="true">` +
    `<g fill="none" stroke="${ink}" stroke-linecap="round" stroke-linejoin="round" stroke-width="${sw}">` +
    substituted +
    '</g></svg>'
  );
}

/**
 * Render a tool glyph (1B Chip Cluster). `detail` adds the confirmed
 * 1.2-weight context layer and is for placements ≥62 px; `compact` covers
 * 16-24 px. The `tools` glyph has no detail variant and takes no accent chip.
 */
export function toolGlyph(
  name: ToolGlyphName,
  variant: 'compact' | 'detail' = 'compact',
  options: GlyphRenderOptions = {}
): string {
  const geometry =
    variant === 'detail' && name !== 'tools'
      ? TOOL_DETAIL[name]
      : TOOL_COMPACT[name];
  return renderGlyph(geometry, 2.4, options);
}

/** Render a harmony-type glyph (ten ring positions at real generator offsets). */
export function harmonyGlyph(name: HarmonyGlyphName, options: GlyphRenderOptions = {}): string {
  return renderGlyph(HARMONY[name], 2.2, options);
}

/** Render a chrome glyph (about paint can, sun/moon theme pair, locale globe). */
export function chromeGlyph(name: ChromeGlyphName, options: GlyphRenderOptions = {}): string {
  return renderGlyph(CHROME[name], 2.4, options);
}

/** Render a panel / affordance / empty-state glyph. */
export function panelGlyph(name: PanelGlyphName, options: GlyphRenderOptions = {}): string {
  return renderGlyph(PANEL[name], 2.4, options);
}

/** Render a preset-category glyph (eight categories, eight icons, + default). */
export function categoryGlyph(name: CategoryGlyphName, options: GlyphRenderOptions = {}): string {
  return renderGlyph(CATEGORY[name], 2.4, options);
}

/**
 * Every glyph name per set — for shims, galleries, and parity tests.
 *
 * @testonly file-local fixture for the glyph parity test (asserts every
 * TOOL_COMPACT/TOOL_DETAIL/HARMONY/CHROME key renders); no shim or gallery
 * consumer exists in this workspace despite the docblock above.
 */
export const GLYPH_SETS = {
  tool: Object.keys(TOOL_COMPACT) as ToolGlyphName[],
  toolDetail: Object.keys(TOOL_DETAIL) as Exclude<ToolGlyphName, 'tools'>[],
  harmony: Object.keys(HARMONY) as HarmonyGlyphName[],
  chrome: Object.keys(CHROME) as ChromeGlyphName[],
  panel: Object.keys(PANEL) as PanelGlyphName[],
  category: Object.keys(CATEGORY) as CategoryGlyphName[],
} as const;
