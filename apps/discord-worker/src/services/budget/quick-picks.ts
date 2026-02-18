/**
 * Quick Picks Configuration
 *
 * Preset configurations for popular expensive dyes.
 * These are common targets for budget alternatives.
 *
 * @module services/budget/quick-picks
 */

import type { QuickPickPreset } from '../../types/budget.js';

/**
 * Quick pick presets for popular expensive dyes
 *
 * These are selected based on:
 * - High market board prices
 * - Community demand (glamour popularity)
 * - Frequent user searches
 */
export const QUICK_PICKS: QuickPickPreset[] = [
  {
    id: 'pure_white',
    name: 'Pure White',
    targetDyeId: 5762, // Pure White item ID
    description: 'Most sought-after for clean glamours',
    emoji: '⬜',
  },
  {
    id: 'jet_black',
    name: 'Jet Black',
    targetDyeId: 5763, // Jet Black item ID
    description: 'Darkest black, popular for edgy looks',
    emoji: '⬛',
  },
  {
    id: 'metallic_silver',
    name: 'Metallic Silver',
    targetDyeId: 13099, // Metallic Silver item ID
    description: 'Premium metallic sheen',
    emoji: '🔘',
  },
  {
    id: 'metallic_gold',
    name: 'Metallic Gold',
    targetDyeId: 13098, // Metallic Gold item ID
    description: 'Luxurious gold finish',
    emoji: '🥇',
  },
  {
    id: 'pastel_pink',
    name: 'Pastel Pink',
    targetDyeId: 13111, // Pastel Pink item ID
    description: 'Popular for cute aesthetics',
    emoji: '🩷',
  },
];

/**
 * Get a quick pick preset by ID
 */
export function getQuickPickById(id: string): QuickPickPreset | null {
  return QUICK_PICKS.find((pick) => pick.id === id) ?? null;
}

/**
 * Get all quick pick IDs for command choices
 */
export function getQuickPickChoices(): Array<{ name: string; value: string }> {
  return QUICK_PICKS.map((pick) => ({
    name: `${pick.emoji} ${pick.name}`,
    value: pick.id,
  }));
}
