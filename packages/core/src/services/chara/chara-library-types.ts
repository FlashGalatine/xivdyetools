/**
 * The application-facing shapes of the xivcharakit-backed `.chara` import. Additive: the legacy
 * `ParsedCharaFile` / `ResolvedCharaCharacter` contracts are unchanged.
 */

import type { AppearanceSlotInspection } from 'xivcharakit/appearance';
import type { Field } from 'xivcharakit';
import type { ResolvedCharaCharacter } from './chara-resolver.js';

/**
 * One appearance slot. The library's stored fields (`storedIndex`, `storedExtended`) are replaced by
 * the plain `index` / `indexState`, so no raw document value travels with the projection.
 *
 * `matchHex` is the host matching policy, computed once: it equals `displayHex` only for a
 * confirmed-active, resolved slot, and is null otherwise (including unknown activation, which keeps
 * its `displayHex` as preview evidence).
 */
export type ImportedCharaSlot = Omit<AppearanceSlotInspection, 'storedIndex' | 'storedExtended'> & {
  index: number | null;
  indexState: Field<number>['state'];
  matchHex: string | null;
};

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
