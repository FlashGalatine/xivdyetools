/**
 * Japanese Profanity Word List
 *
 * Minimal list for fast first-pass filtering.
 * Perspective API handles more comprehensive detection.
 */

export const jaProfanity: string[] = [
  // Japanese profanity - hiragana, katakana, kanji variants
  // List intentionally kept minimal - Perspective API handles most cases

  // Anti-AI-slop terms
  'aiのガラクタ', // AI junk/scrap
  'aiのゴミ', // AI trash/garbage
];
