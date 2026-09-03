/**
 * Harmony Generator Service
 * WEB-REF-003 FIX: Extracted from harmony-tool.ts to reduce component size.
 *
 * What is left here is the UI vocabulary: the harmony types the picker offers,
 * their icons, and their localized names.
 *
 * The SELECTION algorithm -- which dyes a harmony returns -- moved to
 * `@xivdyetools/core`'s `generateHarmonySlots` on 2026-09-03. It lived here, and
 * the bot and the OG card each had their own version, and the three disagreed
 * for most base dyes. There is one now.
 *
 * @module services/harmony-generator
 */

import { LanguageService } from '@services/index';

// ============================================================================
// Types
// ============================================================================

/**
 * Harmony type info for UI display
 */
export interface HarmonyTypeInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Harmony type IDs with their SVG icon names
 */
export const HARMONY_TYPE_IDS = [
  { id: 'complementary', icon: 'complementary' },
  { id: 'analogous', icon: 'analogous' },
  { id: 'triadic', icon: 'triadic' },
  { id: 'split-complementary', icon: 'split-complementary' },
  { id: 'tetradic', icon: 'tetradic' },
  { id: 'inverted-tetradic', icon: 'inverted-tetradic' },
  { id: 'square', icon: 'square' },
  { id: 'monochromatic', icon: 'monochromatic' },
  { id: 'compound', icon: 'compound' },
  { id: 'shades', icon: 'shades' },
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get harmony types with localized names and descriptions
 */
export function getHarmonyTypes(): HarmonyTypeInfo[] {
  return HARMONY_TYPE_IDS.map(({ id, icon }) => {
    // Convert id with hyphen to camelCase for core library lookups
    const camelCaseKey = id.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return {
      id,
      name: LanguageService.getHarmonyType(camelCaseKey),
      description: LanguageService.t(`harmony.types.${camelCaseKey}Desc`),
      icon,
    };
  });
}
