/**
 * The embed shell — one accent, imported.
 *
 * An embed's four-pixel accent bar is the only branding it has, and the bot
 * spent it on Discord's brand: `0x5865f2` was declared independently in
 * `about.ts`, `manual.ts`, `stats.ts`, `preferences.ts` and
 * `announcements.ts`. A player scrolling a busy channel could not tell our
 * output from any other bot's.
 *
 * So the rule is the same one the cards follow: **one accent for the
 * product, and colour reserved for state.** Anything that is not a state
 * signal takes {@link BRAND_ACCENT}.
 *
 * Blurple survives in exactly one place — Discord's own `primary` button
 * style, which we do not control and do not set.
 *
 * @module utils/brand
 */

/**
 * The product accent — `#EA4133`, the same red the cards and the app icon
 * carry. Every embed the product owns uses this unless it is signalling
 * state.
 */
export const BRAND_ACCENT = 0xea4133;

/**
 * Colour reserved for state. These are the only legitimate reasons for an
 * embed not to be {@link BRAND_ACCENT}.
 *
 * `confirm` is amber rather than the accent for a specific reason: our
 * `#EA4133` and Discord's fixed danger red `#DA373C` are four hex points
 * apart, so on a destructive confirm the accent bar and the Delete button
 * read as the same colour carrying two different meanings. Button styles
 * are fixed on this platform, so the fix moves to the bar.
 */
export const STATE = {
  /** Any destructive confirmation — never the accent, never Discord's red */
  confirm: 0xf4bf4f,
  /** A command that failed */
  error: 0xed4245,
  /** A completed write the user asked for */
  success: 0x57f287,
  /** Advisory: degraded data, a missing world, an empty result */
  warning: 0xfee75c,
  /** No data at all — a dye with no listing, a search with no hit */
  neutral: 0x808080,
} as const;
