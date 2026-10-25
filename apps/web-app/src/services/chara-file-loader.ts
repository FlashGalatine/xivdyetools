/**
 * Read a dropped `.chara` file into the shared character session.
 *
 * Parsing is core's (`parseCharaFile` → `resolveCharaColors`). This adds the
 * file-name and size checks, the `chara_parse` telemetry event and the
 * hand-off to `CharaSessionService`. It reports what went wrong instead of
 * showing it, so the file card owns the words.
 *
 * @module services/chara-file-loader
 */

import {
  CharacterColorService,
  MAX_CHARA_FILE_BYTES,
  parseCharaFile,
  resolveCharaColors,
} from '@xivdyetools/core';
import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import { logger } from '@shared/logger';
import { CharaSessionService } from './chara-session-service';
import { dyeService } from './dye-service-wrapper';
import { TelemetryService } from './telemetry-service';

export type CharaLoadResult =
  | { ok: true }
  /** Not named `*.chara` (a pose, an image, a folder): refused unread */
  | { ok: false; error: 'notChara' }
  /** Over `MAX_CHARA_FILE_BYTES`: refused unread */
  | { ok: false; error: 'tooLarge' }
  | { ok: false; error: 'failed'; reason: string }
  /** A newer file was chosen while this one was still loading: nothing to show */
  | { ok: false; error: 'superseded' };

/** Created on the first load; `resolveCharaColors` reads the creator sheets through it. */
let characterColors: CharacterColorService | null = null;

/**
 * Bumped by every load. Only the newest may publish: two drops that overlap
 * would otherwise finish in either order, and a slow earlier file could
 * replace the one the player picked last.
 */
let loadGeneration = 0;

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Parse `file` and make it the loaded character. On success every session
 * subscriber has already been told by the time this resolves.
 */
export async function loadCharaFile(file: File): Promise<CharaLoadResult> {
  // Refuse before reading. The name, not `file.type`: `.chara` has no
  // registered MIME type, so browsers report '' for it. The drop zone takes
  // any first file, and the picker's `accept` is only a hint (FINDING-001,
  // 2026-10-15 import review). A renamed pose still fails in the parser.
  if (!file.name.toLowerCase().endsWith('.chara')) return { ok: false, error: 'notChara' };
  // Then the size: real exports are under 3 KB, and a file with an attached
  // image is megabytes (WEB-13; 8 KiB since the 2026-10-15 review).
  if (file.size > MAX_CHARA_FILE_BYTES) return { ok: false, error: 'tooLarge' };

  // Only a file that will be read takes a generation, so a refused drop never
  // cancels a good file that is still loading.
  const generation = ++loadGeneration;
  const superseded = (): boolean => generation !== loadGeneration;

  // Reading is not parsing: a stale handle (the picker's File outliving the
  // file on disk) fails here, before the parser ever sees it — no chara_parse.
  let text: string;
  try {
    text = await file.text();
  } catch (error) {
    if (superseded()) return { ok: false, error: 'superseded' };
    // FINDING-001: no raw exception in the log (it can quote the file); the
    // reason still reaches the file card through the result.
    logger.error('[CharaFileLoader] Read failed');
    return { ok: false, error: 'failed', reason: reasonOf(error) };
  }
  if (superseded()) return { ok: false, error: 'superseded' };

  characterColors ??= new CharacterColorService();
  let resolved: ResolvedCharaCharacter;
  try {
    const parsed = parseCharaFile(text);
    resolved = await resolveCharaColors(parsed, characterColors, {
      getByStainId: (stainId: number) => dyeService.getByStainId(stainId),
    });
  } catch (error) {
    TelemetryService.track('chara_parse', { ok: false, producer: 'none' });
    // Core's message names the field and quotes the value, so it stays out of the log.
    logger.error('[CharaFileLoader] Parse failed');
    if (superseded()) return { ok: false, error: 'superseded' };
    // Core's messages name the field and the value; they ride into the
    // localized sentence as {reason}.
    return { ok: false, error: 'failed', reason: reasonOf(error) };
  }

  // Recorded before the session changes hands, so a subscriber that throws is
  // a consumer bug (the session logs it), not a parse failure.
  TelemetryService.track('chara_parse', {
    ok: true,
    producer: TelemetryService.normalizeProducer(resolved.producer),
  });
  // The parse above still counts; only the newest file becomes the character.
  if (superseded()) return { ok: false, error: 'superseded' };
  CharaSessionService.setSession({ resolved, fileName: file.name });
  // FINDING-001: neither the file name nor the file's own producer text; the same
  // normalized bucket the telemetry event carries.
  logger.info(
    `[CharaFileLoader] Parsed a file (${TelemetryService.normalizeProducer(resolved.producer)})`
  );
  return { ok: true };
}
