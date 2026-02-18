/**
 * Multi-language Profanity Word Lists
 *
 * NOTE: This file contains words that are blocked for content moderation.
 * The lists are intentionally minimal as Perspective API provides
 * more comprehensive ML-based detection.
 *
 * Local lists serve as a fast first-pass filter for:
 * - Obviously problematic words that don't need ML
 * - Gaming/FFXIV-specific slurs
 * - Terms the ML might miss due to context
 */

import { enProfanity } from './en.js';
import { jaProfanity } from './ja.js';
import { deProfanity } from './de.js';
import { frProfanity } from './fr.js';
import { koProfanity } from './ko.js';
import { zhProfanity } from './zh.js';

export type SupportedLocale = 'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh';

export const profanityLists: Record<SupportedLocale, string[]> = {
  en: enProfanity,
  ja: jaProfanity,
  de: deProfanity,
  fr: frProfanity,
  ko: koProfanity,
  zh: zhProfanity,
};
