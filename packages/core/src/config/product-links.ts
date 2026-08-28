/**
 * Where the product can be found — one home, because both surfaces print it.
 *
 * The web app's About modal and the bot's `/about` show the same seven
 * places. Kept here rather than in each surface for the reason the 5.0
 * design register keeps giving: a list duplicated across two apps is a list
 * that drifts, and the drift is invisible until somebody notices the bot is
 * advertising a repo that moved two releases ago.
 *
 * Only `label` and `url` live here. Icons are presentation and stay with the
 * surface that draws them — the web app maps these onto its SVG set, the bot
 * renders markdown links.
 *
 * @module config/product-links
 */

export interface ProductLink {
  /** Display name. Proper nouns — never localised. */
  label: string;
  url: string;
}

/**
 * Social presence, in the order both surfaces display it.
 *
 * `github.com/FlashGalatine` is the profile rather than a repository: the
 * project has moved repos once already (the standalone discord-worker into
 * the monorepo), and a profile link survives the next move too.
 */
export const SOCIAL_LINKS: readonly ProductLink[] = [
  { label: 'GitHub', url: 'https://github.com/FlashGalatine' },
  { label: 'X/Twitter', url: 'https://x.com/AsheJunius' },
  { label: 'Twitch', url: 'https://www.twitch.tv/flashgalatine' },
  { label: 'Bluesky', url: 'https://bsky.app/profile/projectgalatine.com' },
  { label: 'Discord', url: 'https://discord.gg/5VUSKTZCe5' },
  { label: 'Patreon', url: 'https://patreon.com/ProjectGalatine' },
  { label: 'Ko-fi', url: 'https://ko-fi.com/flashgalatine' },
] as const;

/**
 * The product itself. The web app does not print these (a modal linking to
 * the page it is drawn on says nothing); the bot does, because a Discord
 * reader has no other way in.
 */
export const PRODUCT_LINKS = {
  webApp: { label: 'Web App', url: 'https://xivdyetools.app/' },
  inviteBot: {
    label: 'Invite Bot',
    url: 'https://discord.com/oauth2/authorize?client_id=1447108133020369048',
  },
} as const satisfies Record<string, ProductLink>;
