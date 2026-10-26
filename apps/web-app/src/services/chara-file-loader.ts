/**
 * Read a dropped `.chara` file into the shared character session.
 *
 * Inspection runs off the main thread (`chara-inspection-service`: a worker reading the bytes
 * through core's xivcharakit facade, with the dyes attached on the page). This adds the file-name
 * and size checks, the capped read, the `chara_parse` telemetry event and the hand-off to
 * `CharaSessionService`. It reports what went wrong as a fixed code instead of showing it, so the
 * file card owns the words; no exception text ever leaves it.
 *
 * @module services/chara-file-loader
 */

import { MAX_CHARA_FILE_BYTES, type ImportedCharaCharacter } from '@xivdyetools/core';
import { logger } from '@shared/logger';
import { CharaSessionService } from './chara-session-service';
// A namespace import on purpose: `pnpm dead-code:check` reads the service's own bare
// `cancelCharaInspection();` statement as a class-member candidate (the file declares a class),
// and a member counts as used in production only through a dotted reference.
import * as inspection from './chara-inspection-service';
import { TelemetryService } from './telemetry-service';

/** Why a file did not become the loaded character; the file card maps each to a toast. */
export type CharaLoadFailure =
  /** Not named `*.chara` (a pose, an image, a folder): refused unread */
  | 'notChara'
  /** Over `MAX_CHARA_FILE_BYTES`, by its size or by what the capped read found */
  | 'tooLarge'
  /** The bytes could not be read (a stale handle), or the inspection refused them */
  | 'unreadable'
  /** The inspection worker failed to start, crashed or answered badly */
  | 'workerFailed'
  /** The inspection did not answer in time */
  | 'timedOut';

export type CharaLoadResult =
  | { ok: true }
  | { ok: false; error: CharaLoadFailure }
  /** A newer file, or SWAP, replaced this one while it was loading: nothing to show */
  | { ok: false; error: 'superseded' };

/** The session's file-name limit, the same 256 UTF-16 units core gives the file's own labels. */
const MAX_FILE_NAME_UNITS = 256;

/**
 * Bumped by every admitted load and by every clear. Only the newest load may publish: two drops
 * that overlap would otherwise finish in either order, and a slow earlier file could replace the
 * one the player picked last, or come back after SWAP cleared it.
 */
let loadGeneration = 0;

const fail = (error: CharaLoadFailure | 'superseded'): CharaLoadResult => ({ ok: false, error });

/**
 * Abandon any load in flight (its read or its inspection) so it can never publish. SWAP calls it
 * before clearing the session; a refused drop never does.
 */
export function cancelCharaLoad(): void {
  loadGeneration++;
  inspection.cancelCharaInspection();
}

/**
 * Inspect `file` and make it the loaded character. On success every session subscriber has
 * already been told by the time this resolves. A failure never touches the session, so the last
 * valid character stays loaded.
 */
export async function loadCharaFile(file: File): Promise<CharaLoadResult> {
  // Refuse before reading. The name, not `file.type`: `.chara` has no
  // registered MIME type, so browsers report '' for it. The drop zone takes
  // any first file, and the picker's `accept` is only a hint (FINDING-001,
  // 2026-10-15 import review). A renamed pose still fails in the inspection.
  if (!file.name.toLowerCase().endsWith('.chara')) return fail('notChara');
  // Then the size: real exports are under 3 KB, and a file with an attached
  // image is megabytes (WEB-13; 8 KiB since the 2026-10-15 review).
  if (file.size > MAX_CHARA_FILE_BYTES) return fail('tooLarge');

  // Only a file that will be read takes a generation, so a refused drop never
  // cancels a good file that is still loading.
  const generation = ++loadGeneration;
  const superseded = (): boolean => generation !== loadGeneration;
  const fileName = file.name.slice(0, MAX_FILE_NAME_UNITS);

  // One byte past the cap, so a file that grew after the size check is still refused. A stale
  // handle (the picker's File outliving the file on disk) fails here, before any inspection:
  // `unreadable`, with no chara_parse.
  let bytes: ArrayBuffer;
  try {
    bytes = await file.slice(0, MAX_CHARA_FILE_BYTES + 1).arrayBuffer();
  } catch {
    if (superseded()) return fail('superseded');
    // FINDING-001: no raw exception in the log (it can quote the file).
    logger.error('[CharaFileLoader] Read failed');
    return fail('unreadable');
  }
  // Load-bearing: starting an inspection cancels the pending one, which may be the newer file's.
  if (superseded()) return fail('superseded');
  if (bytes.byteLength > MAX_CHARA_FILE_BYTES) return fail('tooLarge');

  let resolved: ImportedCharaCharacter;
  try {
    resolved = await inspection.inspectCharaBytes(bytes);
  } catch (error) {
    // A cancelled or replaced load says nothing, whatever its inspection answered.
    if (superseded()) return fail('superseded');
    const code = error instanceof inspection.CharaInspectionError ? error.code : 'workerFailed';
    if (code === 'superseded') return fail('superseded');
    if (code === 'unreadable') {
      // The only parse outcome among the failures (D8): the file itself was refused.
      TelemetryService.track('chara_parse', { ok: false, producer: 'none' });
      logger.warn('[CharaFileLoader] Inspection refused (unreadable)');
      return fail('unreadable');
    }
    logger.warn(
      code === 'timedOut'
        ? '[CharaFileLoader] Inspection failed (timedOut)'
        : '[CharaFileLoader] Inspection failed (workerFailed)'
    );
    return fail(code);
  }
  if (superseded()) return fail('superseded');

  // Recorded before the session changes hands, so a subscriber that throws is
  // a consumer bug (the session logs it), not a parse failure.
  const producer = TelemetryService.normalizeProducer(resolved.producer);
  TelemetryService.track('chara_parse', { ok: true, producer });
  CharaSessionService.setSession({ resolved, fileName });
  // FINDING-001: neither the file name nor the file's own producer text; the same
  // normalized bucket the telemetry event carries.
  logger.info(`[CharaFileLoader] Parsed a file (${producer})`);
  return { ok: true };
}
