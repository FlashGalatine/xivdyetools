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
import type { LocaleCode } from '@xivdyetools/bot-logic/i18n';

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
 * Levenshtein distance, capped: once the best possible result exceeds `max`
 * there is no point finishing the row.
 */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    let rowBest = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < rowBest) rowBest = value;
    }
    if (rowBest > max) return max + 1;
    previous = current;
  }

  return previous[b.length];
}

/**
 * Get "did you mean?" suggestions for a misspelled input.
 *
 * BUG-102: this used to try a `startsWith` pass first and fall back to a
 * character-overlap heuristic. The prefix pass was UNREACHABLE -- getSuggestions
 * is only called when no dye name CONTAINS the input, and a name starting with
 * the input necessarily contains it -- so every suggestion came from the
 * fallback, which asked only that 70% of the input's characters appear
 * ANYWHERE in the name. For a short query that is very nearly every dye:
 * "rd" suggested whatever happened to sort first. Rank by edit distance
 * instead, and say nothing rather than something arbitrary.
 */
function getSuggestions(input: string, names: string[], maxResults = 3): string[] {
  const lower = input.toLowerCase();
  // A typo is close to its target; an unrelated word is not. Scale with the
  // query so short inputs cannot match half the database.
  const maxDistance = Math.max(1, Math.floor(lower.length / 3) + 1);

  const scored: Array<{ name: string; distance: number }> = [];
  for (const name of names) {
    const distance = editDistance(lower, name.toLowerCase(), maxDistance);
    if (distance <= maxDistance) scored.push({ name, distance });
  }

  scored.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
  return scored.slice(0, maxResults).map((entry) => entry.name);
}
