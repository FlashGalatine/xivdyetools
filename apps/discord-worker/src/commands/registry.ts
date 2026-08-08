/**
 * Command registry — the roster of record for the bot's slash commands.
 *
 * One `{name, category}` entry per registered command (5.0 decision, /about
 * rework): the registration script asserts schema parity against this list
 * before publishing, `/about` builds its pill index from it, and
 * `about.test.ts` asserts roster parity — so a command can no longer exist in
 * the dispatch switch, the schema literal, and `/about` in three different
 * states.
 *
 * Categories are display groupings for `/about`; the values are identifiers
 * (never localised) — locale files key their labels off them.
 */

export type CommandCategory =
  | 'color-tools'
  | 'dye-database'
  | 'analysis'
  | 'community'
  | 'utility';

export interface CommandRegistryEntry {
  name: string;
  category: CommandCategory;
  /** Marked for removal — carried in /about's "Removed in v5" field */
  deprecated?: true;
}

export const COMMAND_REGISTRY: readonly CommandRegistryEntry[] = [
  // Colour tools
  { name: 'harmony', category: 'color-tools' },
  { name: 'mixer', category: 'color-tools' },
  { name: 'gradient', category: 'color-tools' },
  { name: 'extractor', category: 'color-tools' },
  { name: 'swatch', category: 'color-tools' },

  // Dye database
  { name: 'dye', category: 'dye-database' },

  // Analysis
  { name: 'comparison', category: 'analysis' },
  // /contrast: WCAG 1.4.11 pairs left /accessibility with the 5.0 split
  { name: 'contrast', category: 'analysis' },
  { name: 'accessibility', category: 'analysis' },
  // /a11y: a second registration sharing the accessibility handler —
  // Discord has no alias mechanism (Turn 13 RESOLVED)
  { name: 'a11y', category: 'analysis' },
  { name: 'budget', category: 'analysis' },

  // Community
  { name: 'preset', category: 'community' },

  // Utility / meta
  { name: 'preferences', category: 'utility' },
  { name: 'manual', category: 'utility' },
  { name: 'changelog', category: 'utility' },
  { name: 'about', category: 'utility' },
  { name: 'stats', category: 'utility' },
];

/** Names only, for parity checks. */
export function registryCommandNames(): string[] {
  return COMMAND_REGISTRY.map((c) => c.name);
}
