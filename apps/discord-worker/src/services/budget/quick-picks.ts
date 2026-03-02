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
    id: 'jet_black',
    name: 'Jet Black',
    targetDyeId: 5763,
    description: 'Darkest black, popular for edgy looks',
    emoji: '⬛',
  },
  {
    id: 'pure_white',
    name: 'Pure White',
    targetDyeId: 5762,
    description: 'Most sought-after for clean glamours',
    emoji: '⬜',
  },
  // Cosmic Exploration Dyes (Wave 1)
  {
    id: 'ruby_red',
    name: 'Ruby Red',
    targetDyeId: 30116,
    description: 'Cosmic Exploration red',
    emoji: '❤️',
  },
  {
    id: 'cherry_pink',
    name: 'Cherry Pink',
    targetDyeId: 30117,
    description: 'Cosmic Exploration pink',
    emoji: '🌸',
  },
  {
    id: 'canary_yellow',
    name: 'Canary Yellow',
    targetDyeId: 30118,
    description: 'Cosmic Exploration bright yellow',
    emoji: '💛',
  },
  {
    id: 'vanilla_yellow',
    name: 'Vanilla Yellow',
    targetDyeId: 30119,
    description: 'Cosmic Exploration soft yellow',
    emoji: '🍦',
  },
  {
    id: 'dragoon_blue',
    name: 'Dragoon Blue',
    targetDyeId: 30120,
    description: 'Cosmic Exploration deep blue',
    emoji: '💙',
  },
  {
    id: 'turquoise_blue',
    name: 'Turquoise Blue',
    targetDyeId: 30121,
    description: 'Cosmic Exploration turquoise',
    emoji: '🩵',
  },
  {
    id: 'gunmetal_black',
    name: 'Gunmetal Black',
    targetDyeId: 30122,
    description: 'Cosmic Exploration dark metallic',
    emoji: '🖤',
  },
  {
    id: 'pearl_white',
    name: 'Pearl White',
    targetDyeId: 30123,
    description: 'Cosmic Exploration pearlescent',
    emoji: '🤍',
  },
  {
    id: 'metallic_brass',
    name: 'Metallic Brass',
    targetDyeId: 30124,
    description: 'Cosmic Exploration brass',
    emoji: '🔔',
  },
  // Cosmic Exploration Dyes (Wave 2)
  {
    id: 'neon_pink',
    name: 'Neon Pink',
    targetDyeId: 48163,
    description: 'Cosmic Exploration neon pink',
    emoji: '🩷',
  },
  {
    id: 'bright_orange',
    name: 'Bright Orange',
    targetDyeId: 48164,
    description: 'Cosmic Exploration bright orange',
    emoji: '🧡',
  },
  {
    id: 'neon_green',
    name: 'Neon Green',
    targetDyeId: 48165,
    description: 'Cosmic Exploration neon green',
    emoji: '💚',
  },
  {
    id: 'neon_yellow',
    name: 'Neon Yellow',
    targetDyeId: 48166,
    description: 'Cosmic Exploration neon yellow',
    emoji: '⚡',
  },
  {
    id: 'violet_purple',
    name: 'Violet Purple',
    targetDyeId: 48167,
    description: 'Cosmic Exploration violet',
    emoji: '💜',
  },
  {
    id: 'azure_blue',
    name: 'Azure Blue',
    targetDyeId: 48168,
    description: 'Cosmic Exploration azure',
    emoji: '🔵',
  },
  {
    id: 'carmine_red',
    name: 'Carmine Red',
    targetDyeId: 48227,
    description: 'Cosmic Exploration carmine',
    emoji: '♥️',
  },
  // Cosmic Fortunes Dyes
  {
    id: 'metallic_pink',
    name: 'Metallic Pink',
    targetDyeId: 48169,
    description: 'Cosmic Fortunes metallic pink',
    emoji: '💗',
  },
  {
    id: 'metallic_ruby_red',
    name: 'Metallic Ruby Red',
    targetDyeId: 48170,
    description: 'Cosmic Fortunes metallic ruby',
    emoji: '♦️',
  },
  {
    id: 'metallic_cobalt_green',
    name: 'Metallic Cobalt Green',
    targetDyeId: 48171,
    description: 'Cosmic Fortunes metallic green',
    emoji: '🟢',
  },
  {
    id: 'metallic_dark_blue',
    name: 'Metallic Dark Blue',
    targetDyeId: 48172,
    description: 'Cosmic Fortunes metallic blue',
    emoji: '🫐',
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
