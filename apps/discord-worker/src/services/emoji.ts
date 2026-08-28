/**
 * Dye emoji lookup — stainID-keyed, per Discord application (5.0).
 *
 * The application-emoji set is GENERATED from dyes.json at upload time
 * (`scripts/upload-emojis.ts`): a 128 px rounded-square bare chip of the dye
 * hex with the suite's hairline inset ring — no source image folder, our own
 * provenance, and any future dye gets an emoji by existing in dyes.json.
 *
 * The emoji is display-only vocabulary: no tier, no measure, never a
 * substitute for the butted pair in a frame.
 *
 * ## Why the mapping is keyed by application
 *
 * Discord **application emoji are owned by the application that uploaded
 * them** — a bot can only render its own application's emoji. Handing a bot
 * another application's `<:name:id>` markup does not fail loudly; Discord
 * renders it as the literal text `:name:`, which is what appeared in the beta
 * bot's cards while the mapping held only production's IDs.
 *
 * Each application therefore gets its own slot, and an application with no
 * uploaded set resolves to `undefined` so callers simply omit the emoji.
 * Degrading to nothing is correct; degrading to another application's markup
 * is the bug.
 */

import emojiMapping from '../data/emoji-mapping.json';

interface ApplicationEmojiSet {
  /**
   * Artwork generation tag for THIS application's set — the sync replaces the
   * set when it changes. It lives per-application rather than per-file because
   * regeneration is per-application: a global tag would let one application's
   * re-upload mark every sibling as current while leaving them on stale chips.
   */
  artwork: string;
  /** stainID (as string) → emoji markup `<:name:id>` */
  byStainId: Record<string, string>;
}

interface EmojiMapping {
  /**
   * Discord application ID → that application's emoji set.
   * Populated by `scripts/upload-emojis.ts`, which writes only the slot for
   * whichever DISCORD_CLIENT_ID it uploaded to.
   */
  byApplication: Record<string, ApplicationEmojiSet>;
}

const mapping = emojiMapping as EmojiMapping;

/**
 * Get the Discord emoji markup for a dye by stainID, for a specific application.
 *
 * @param stainId - The dye's stainID
 * @param applicationId - The bot's own Discord application ID (`env.DISCORD_CLIENT_ID`)
 * @returns `<:name:id>` markup, or `undefined` for an unknown stainID (e.g. the
 *          Facewear-excluded 0) or an application with no uploaded emoji set
 */
export function getDyeEmoji(stainId: number, applicationId: string): string | undefined {
  if (!applicationId) return undefined;
  return mapping.byApplication[applicationId]?.byStainId?.[String(stainId)];
}
