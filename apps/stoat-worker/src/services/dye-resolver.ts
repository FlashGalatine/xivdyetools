/**
 * Dye input resolver for the Stoat bot.
 *
 * Since Stoat has no autocomplete, users type dye identifiers as raw text.
 * This resolver accepts flexible input and finds the right dye(s) via
 * a multi-strategy approach: ItemID → exact name → localized name → partial match.
 */

import {
  resolveColorInput,
  resolveDyeInput,
  dyeService,
  type ResolvedColor,
} from '@xivdyetools/bot-logic';
import type { LocaleCode } from '@xivdyetools/bot-i18n';

/**
 * Threshold for adaptive multi-match behavior.
 * 1 match: execute immediately
 * 2-4 matches: execute for all (show inline)
 * 5+ matches: show disambiguation list
 */
export const MULTI_MATCH_THRESHOLD = 4;

/** Maximum number of disambiguation results to show */
export const MAX_DISAMBIGUATION_RESULTS = 12;

/**
 * Result of resolving a dye input string.
 */
export type DyeResolutionResult =
  | { kind: 'single'; dye: ResolvedColor }
  | { kind: 'multiple'; dyes: ResolvedColor[]; query: string }
  | { kind: 'disambiguation'; dyes: ResolvedColor[]; total: number; query: string }
  | { kind: 'none'; query: string; suggestions: string[] };

/**
 * Resolve a user-provided dye input string to one or more dyes.
 *
 * @param input - Raw user input (dye name, ItemID, hex code, etc.)
 * @param locale - User's locale for localized name matching
 * @returns Resolution result indicating single match, multiple matches, or no match
 */
export function resolveDyeInputMulti(
  input: string,
  _locale: LocaleCode = 'en',
): DyeResolutionResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { kind: 'none', query: '', suggestions: [] };
  }

  // 1. Try exact resolution (ItemID, exact name, hex code)
  const exact = resolveColorInput(trimmed, { findClosestForHex: true });
  if (exact) {
    return { kind: 'single', dye: exact };
  }

  // 2. Try standalone dye name resolution (leverages bot-logic's resolveDyeInput)
  const dyeResult = resolveDyeInput(trimmed);
  if (dyeResult) {
    return {
      kind: 'single',
      dye: {
        hex: dyeResult.hex,
        name: dyeResult.name,
        id: dyeResult.id,
        itemID: dyeResult.itemID,
        dye: dyeResult,
      },
    };
  }

  // 3. Try partial / substring match across all dyes
  const allDyes = dyeService.getAllDyes();
  const lowerInput = trimmed.toLowerCase();

  const partialMatches = allDyes.filter((dye) => {
    // Match against English name
    if (dye.name.toLowerCase().includes(lowerInput)) return true;
    // Match against category
    if (dye.category.toLowerCase().includes(lowerInput)) return true;
    return false;
  });

  if (partialMatches.length === 0) {
    // No matches — generate "did you mean?" suggestions using simple distance
    const suggestions = getSuggestions(trimmed, allDyes.map((d) => d.name));
    return { kind: 'none', query: trimmed, suggestions };
  }

  if (partialMatches.length === 1) {
    const dye = partialMatches[0];
    return {
      kind: 'single',
      dye: {
        hex: dye.hex,
        name: dye.name,
        id: dye.id,
        itemID: dye.itemID,
        dye,
      },
    };
  }

  // Convert to ResolvedColor array
  const resolved: ResolvedColor[] = partialMatches.map((dye) => ({
    hex: dye.hex,
    name: dye.name,
    id: dye.id,
    itemID: dye.itemID,
    dye,
  }));

  if (partialMatches.length <= MULTI_MATCH_THRESHOLD) {
    return { kind: 'multiple', dyes: resolved, query: trimmed };
  }

  return {
    kind: 'disambiguation',
    dyes: resolved.slice(0, MAX_DISAMBIGUATION_RESULTS),
    total: partialMatches.length,
    query: trimmed,
  };
}

/**
 * Get "did you mean?" suggestions for a misspelled input.
 * Uses a lightweight case-insensitive substring/prefix check.
 */
function getSuggestions(input: string, names: string[], maxResults = 3): string[] {
  const lower = input.toLowerCase();

  // Prioritize names that start with the input
  const startsWith = names.filter((n) => n.toLowerCase().startsWith(lower));
  if (startsWith.length > 0) {
    return startsWith.slice(0, maxResults);
  }

  // Fall back to names containing the input (already checked above, but for typo tolerance)
  const contains = names.filter((n) => {
    const nLower = n.toLowerCase();
    // Simple character overlap heuristic
    let matches = 0;
    for (const char of lower) {
      if (nLower.includes(char)) matches++;
    }
    return matches >= lower.length * 0.7;
  });

  return contains.slice(0, maxResults);
}
