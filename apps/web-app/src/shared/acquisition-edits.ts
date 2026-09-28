/**
 * The Glamour Reader's device-kept Acquisition edits (spec G8/G9, design 2c).
 *
 * The export sheet fills each piece's `Acquisition:` line from api-worker's
 * build-time table; the player may rewrite it. Only those rewritten lines are
 * kept, in this browser's storage, keyed by a hash of the GEAR — the slot,
 * the family's row (the lowest row_id, so a twin pick does not change the
 * key) and the stains on it — never the file, its name or the character's
 * name. Generated lines are never stored. Reset all deletes an outfit's
 * edits.
 *
 * Each edit remembers the twin whose generated line it replaced, so a later
 * twin pick can warn instead of overwriting (spec G9).
 *
 * @module shared/acquisition-edits
 */

import { StorageService } from '@services/storage-service';
import { STORAGE_PREFIX } from '@shared/constants';

export interface AcquisitionEdit {
  /** The player's line, as typed (may be empty: a deliberate blank) */
  text: string;
  /** The twin whose generated line this replaced */
  baseItemId: number;
}

const KEY = `${STORAGE_PREFIX}_glamour_acquisition_edits`;

/** A short FNV-1a hash of one piece of gear: slot, family row, stains. */
export function gearHash(slot: string, familyItemId: number, stainIds: readonly number[]): string {
  const input = `${slot}|${familyItemId}|${stainIds.join(',')}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function readAll(): Record<string, AcquisitionEdit> {
  const stored = StorageService.getItem<Record<string, AcquisitionEdit>>(KEY);
  return stored && typeof stored === 'object' ? stored : {};
}

function writeAll(edits: Record<string, AcquisitionEdit>): void {
  if (Object.keys(edits).length === 0) StorageService.removeItem(KEY);
  else StorageService.setItem(KEY, edits);
}

export const AcquisitionEdits = {
  get(hash: string): AcquisitionEdit | null {
    const edit = readAll()[hash];
    return edit && typeof edit.text === 'string' && typeof edit.baseItemId === 'number'
      ? edit
      : null;
  },

  set(hash: string, edit: AcquisitionEdit): void {
    writeAll({ ...readAll(), [hash]: edit });
  },

  remove(hash: string): void {
    const edits = readAll();
    delete edits[hash];
    writeAll(edits);
  },

  /** Reset all: forget the edits of one outfit's pieces, and nothing else. */
  resetAll(hashes: readonly string[]): void {
    const edits = readAll();
    for (const hash of hashes) delete edits[hash];
    writeAll(edits);
  },
};
