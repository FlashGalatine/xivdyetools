/**
 * Design tokens shared by every card surface — the band frame, the 2a
 * default cards, the raster step and the crawler HTML. One place to change
 * the ground, the stacks or the mark's stripes; nothing re-types them.
 *
 * @module services/svg/tokens
 */

/** The console ground. Every card is drawn on it; the raster fills it. */
export const GROUND = '#0B0B0C';

/**
 * Latin-led stacks, shared with the bot frame system. For glyphs the primary
 * face lacks, resvg uses the loaded buffer order rather than this CJK list;
 * fonts.ts selects JP first for ja and SC first for the other locales.
 */
export const STACKS = {
  mono: 'Fragment Mono, Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR',
  body: 'Onest, Noto Sans JP, Noto Sans SC, Noto Sans KR',
  display: 'Space Grotesk, Noto Sans JP, Noto Sans SC, Noto Sans KR',
} as const;

/**
 * The six spill colours as drawn in the app icon — the mark's source of
 * truth, referenced once, never re-typed per card.
 */
export const MARK_STRIPES = [
  '#E5484D',
  '#F76B15',
  '#FFC53D',
  '#30A46C',
  '#0091FF',
  '#8E4EC6',
] as const;

/** The 13px compact tool glyph in the header strip: strip inks. */
export const COMPACT_GLYPH = { size: 13, ink: '#ECECEE', accent: '#FF6257' } as const;
