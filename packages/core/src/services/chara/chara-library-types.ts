/**
 * The application-facing shapes of the xivcharakit-backed `.chara` import. Additive: the legacy
 * `ParsedCharaFile` / `ResolvedCharaCharacter` contracts are unchanged.
 */

import type { AppearanceSlotInspection } from 'xivcharakit/appearance';
import type { Field } from 'xivcharakit';
import type { ResolvedCharaCharacter } from './chara-types.js';

/**
 * One appearance slot. The library's stored fields (`storedIndex`, `storedExtended`) are replaced by
 * the plain `index` / `indexState`, so no raw document value travels with the projection.
 *
 * `matchHex` is the host matching policy, computed once: it equals `displayHex` only for a
 * confirmed-active, resolved slot, and is null otherwise (including unknown activation, which keeps
 * its `displayHex` as preview evidence).
 *
 * `indexGap` is true only for a `lip` / `facePaint` index the library reads as a color index (not a
 * Hrothgar fur pattern, and not a lip of unknown race) whose stored number lies in the unused 96-127 gap, whether the library read it as a valid integer
 * (`indexOutOfRange`) or as an invalid fraction such as 96.5 (`invalidIndex`). It lets the host keep
 * its specific gap message without carrying the raw number.
 */
export type ImportedCharaSlot = Omit<AppearanceSlotInspection, 'storedIndex' | 'storedExtended'> & {
  index: number | null;
  indexState: Field<number>['state'];
  matchHex: string | null;
  indexGap: boolean;
};

/**
 * The library's palette contract: `resolveCharaWithProvider` consumes one directly
 * (e.g. an inspection worker that asks the page for each color).
 * `resolveCharaForTools` also accepts one, or bridges a `CharacterColorService`.
 */
export type { PaletteProvider as CharaPaletteProvider } from 'xivcharakit/palettes';

/** A bounded diagnostic: a fixed code and a sanitized path, never the library's English message. */
export interface CharaImportIssue {
  code: string;
  severity: 'info' | 'warning' | 'error';
  path: readonly (string | number)[];
}

export interface ImportedCharaCharacter extends Omit<ResolvedCharaCharacter, 'slots'> {
  slots: ImportedCharaSlot[];
  issues: CharaImportIssue[];
}
