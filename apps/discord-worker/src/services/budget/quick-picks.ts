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
    targetDyeId: 102,
    description: 'Darkest black, popular for edgy looks',
    emoji: '⬛',
  },
  {
    id: 'pure_white',
    name: 'Pure White',
    targetDyeId: 101,
    description: 'Most sought-after for clean glamours',
    emoji: '⬜',
  },
  // Cosmic Exploration Dyes (Wave 1)
  {
    id: 'ruby_red',
    name: 'Ruby Red',
    targetDyeId: 86,
    description: 'Cosmic Exploration red',
    emoji: '❤️',
  },
  {
    id: 'cherry_pink',
    name: 'Cherry Pink',
    targetDyeId: 87,
    description: 'Cosmic Exploration pink',
    emoji: '🌸',
  },
  {
    id: 'canary_yellow',
    name: 'Canary Yellow',
    targetDyeId: 88,
    description: 'Cosmic Exploration bright yellow',
    emoji: '💛',
  },
  {
    id: 'vanilla_yellow',
    name: 'Vanilla Yellow',
    targetDyeId: 89,
    description: 'Cosmic Exploration soft yellow',
    emoji: '🍦',
  },
  {
    id: 'dragoon_blue',
    name: 'Dragoon Blue',
    targetDyeId: 90,
    description: 'Cosmic Exploration deep blue',
    emoji: '💙',
  },
  {
    id: 'turquoise_blue',
    name: 'Turquoise Blue',
    targetDyeId: 91,
    description: 'Cosmic Exploration turquoise',
    emoji: '🩵',
  },
  {
    id: 'gunmetal_black',
    name: 'Gunmetal Black',
    targetDyeId: 92,
    description: 'Cosmic Exploration dark metallic',
    emoji: '🖤',
  },
  {
    id: 'pearl_white',
    name: 'Pearl White',
    targetDyeId: 93,
    description: 'Cosmic Exploration pearlescent',
    emoji: '🤍',
  },
  {
    id: 'metallic_brass',
    name: 'Metallic Brass',
    targetDyeId: 94,
    description: 'Cosmic Exploration brass',
    emoji: '🔔',
  },
  // Cosmic Exploration Dyes (Wave 2)
  {
    id: 'neon_pink',
    name: 'Neon Pink',
    targetDyeId: 96,
    description: 'Cosmic Exploration neon pink',
    emoji: '🩷',
  },
  {
    id: 'bright_orange',
    name: 'Bright Orange',
    targetDyeId: 97,
    description: 'Cosmic Exploration bright orange',
    emoji: '🧡',
  },
  {
    id: 'neon_green',
    name: 'Neon Green',
    targetDyeId: 99,
    description: 'Cosmic Exploration neon green',
    emoji: '💚',
  },
  {
    id: 'neon_yellow',
    name: 'Neon Yellow',
    targetDyeId: 98,
    description: 'Cosmic Exploration neon yellow',
    emoji: '⚡',
  },
  {
    id: 'violet_purple',
    name: 'Violet Purple',
    targetDyeId: 121,
    description: 'Cosmic Exploration violet',
    emoji: '💜',
  },
  {
    id: 'azure_blue',
    name: 'Azure Blue',
    targetDyeId: 100,
    description: 'Cosmic Exploration azure',
    emoji: '🔵',
  },
  {
    id: 'carmine_red',
    name: 'Carmine Red',
    targetDyeId: 95,
    description: 'Cosmic Exploration carmine',
    emoji: '♥️',
  },
  // Cosmic Fortunes Dyes
  {
    id: 'metallic_pink',
    name: 'Metallic Pink',
    targetDyeId: 122,
    description: 'Cosmic Fortunes metallic pink',
    emoji: '💗',
  },
  {
    id: 'metallic_ruby_red',
    name: 'Metallic Ruby Red',
    targetDyeId: 123,
    description: 'Cosmic Fortunes metallic ruby',
    emoji: '♦️',
  },
  {
    id: 'metallic_cobalt_green',
    name: 'Metallic Cobalt Green',
    targetDyeId: 124,
    description: 'Cosmic Fortunes metallic green',
    emoji: '🟢',
  },
  {
    id: 'metallic_dark_blue',
    name: 'Metallic Dark Blue',
    targetDyeId: 125,
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
