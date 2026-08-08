/**
 * Dye emoji lookup — stainID-keyed (5.0).
 *
 * The application-emoji set is GENERATED from dyes.json at upload time
 * (`scripts/upload-emojis.ts`): a 128 px rounded-square bare chip of the dye
 * hex with the suite's hairline inset ring — no source image folder, our own
 * provenance, and any future dye gets an emoji by existing in dyes.json.
 *
 * The emoji is display-only vocabulary: no tier, no measure, never a
 * substitute for the butted pair in a frame.
 */

import emojiMapping from '../data/emoji-mapping.json';

interface EmojiMapping {
  /** Artwork generation tag — the sync replaces the set when this changes */
  artwork: string;
  /** stainID (as string) → Discord emoji markup `<:name:id>` */
  byStainId: Record<string, string>;
}

const mapping = emojiMapping as EmojiMapping;

/**
 * Get the Discord emoji markup for a dye by stainID.
 * Returns undefined for unknown stainIDs (e.g. Facewear-excluded 0).
 */
export function getDyeEmoji(stainId: number): string | undefined {
  return mapping.byStainId[String(stainId)];
}
