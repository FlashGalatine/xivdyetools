/**
 * Character colour cell resolution for the Swatch crawler card.
 *
 * BUG-021 (deep dive 2026-09-02): the 5.0 Swatch Matcher shares a *cell
 * address* — `?slot=<sheet>&i=<index>` (`swatch-tool.ts` `getShareParams`) —
 * and no hex at all. Two cells can carry the same colour, and a hex lookup
 * misses when the sheet reloads under a different clan/gender, which is why
 * the SPA moved off hex. og-worker still needs a hex to name the card's
 * target and to build the `/og/swatch/<hex>/<limit>.png` image URL, so the
 * address is resolved here against the same `CharacterColorService` data the
 * page reads.
 *
 * The seven shared sheets are bundled in `@xivdyetools/core` and resolve
 * synchronously; `hairColors` / `skinColors` are keyed by clan and gender and
 * come from a lazily-imported table, which is why the whole resolver is async.
 */

import { CharacterColorService } from '@xivdyetools/core';
import { SUBRACE_TO_RACE } from '@xivdyetools/types';
import type {
  Gender,
  RaceSpecificColorCategory,
  SharedColorCategory,
  SubRace,
} from '@xivdyetools/types';
import type { CharacterGender, ColorSheetCategory } from '../types';

/** One instance for the isolate — the shared sheets are module-scope data. */
const characterColors = new CharacterColorService();

/** The two sheets whose palette depends on the character's clan and gender. */
function isRaceSpecificSheet(sheet: ColorSheetCategory): sheet is RaceSpecificColorCategory {
  return sheet === 'hairColors' || sheet === 'skinColors';
}

/** A clan the colour tables are actually keyed by (`Hyur` is a race, not a clan). */
function isSubRace(raw: string): raw is SubRace {
  return Object.hasOwn(SUBRACE_TO_RACE, raw);
}

/**
 * A cell index as the SPA emits it: a non-negative integer, and nothing else.
 * `parseInt` would accept `12abc` and `+12`; the address is an identity handle,
 * so an approximate read is worse than no read.
 */
export function parseCellIndex(raw: string | null): number | null {
  if (raw === null || !/^\d{1,4}$/.test(raw)) return null;
  return Number(raw);
}

/**
 * Resolve `(sheet, index[, race, gender])` to an upper-case `RRGGBB`, or null
 * when the address names no cell — an index past the end of the sheet, a clan
 * the tables do not carry, or a race-specific sheet shared without its clan.
 * A null sends the caller to its default card rather than to a guessed colour.
 */
export async function resolveCellHex(
  sheet: ColorSheetCategory,
  index: number,
  race?: string,
  gender?: CharacterGender,
): Promise<string | null> {
  let cells;
  if (isRaceSpecificSheet(sheet)) {
    if (!race || !gender || !isSubRace(race)) return null;
    cells = await characterColors.getRaceSpecificColors(sheet, race, gender as Gender);
  } else {
    cells = characterColors.getSharedColors(sheet as SharedColorCategory);
  }

  // `index` is the cell's own `index` field, which is its position today but
  // is the sheet's identity handle either way — match on the field, as the
  // SPA does (`this.colors.find((c) => c.index === sharedIndex)`).
  const cell = cells.find((c) => c.index === index);
  if (!cell) return null;

  const match = /^#?([0-9A-Fa-f]{6})$/.exec(cell.hex);
  return match ? match[1].toUpperCase() : null;
}
