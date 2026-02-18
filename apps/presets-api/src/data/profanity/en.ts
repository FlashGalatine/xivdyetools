/**
 * English Profanity Word List
 *
 * Minimal list for fast first-pass filtering.
 * Perspective API handles more comprehensive detection.
 */

export const enProfanity: string[] = [
  // Common severe profanity (most are caught by Perspective API,
  // but we include a minimal list for fast rejection)
  // List intentionally kept minimal - Perspective API handles most cases

  // Anti-AI-slop terms
  'ai slop',
];
