/**
 * Read a dropped `.chara` file into the shared character session.
 *
 * Parsing is core's (`parseCharaFile` → `resolveCharaColors`). This adds the
 * size cap, the `chara_parse` telemetry event and the hand-off to
 * `CharaSessionService`. It reports what went wrong instead of showing it, so
 * the file card owns the words.
 *
 * @module services/chara-file-loader
 */

import { CharacterColorService, parseCharaFile, resolveCharaColors } from '@xivdyetools/core';
import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import { MAX_USER_FILE_BYTES } from '@shared/constants';
import { logger } from '@shared/logger';
import { CharaSessionService } from './chara-session-service';
import { dyeService } from './dye-service-wrapper';
import { TelemetryService } from './telemetry-service';

export type CharaLoadResult =
  | { ok: true }
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
  const generation = ++loadGeneration;
  const superseded = (): boolean => generation !== loadGeneration;

  // Refuse before reading: a multi-GB drop would hang the tab in
  // file.text() / JSON.parse (WEB-13). Same cap as the image inputs.
  if (file.size > MAX_USER_FILE_BYTES) return { ok: false, error: 'tooLarge' };

  // Reading is not parsing: a stale handle (the picker's File outliving the
  // file on disk) fails here, before the parser ever sees it — no chara_parse.
  let text: string;
  try {
    text = await file.text();
  } catch (error) {
    if (superseded()) return { ok: false, error: 'superseded' };
    logger.error('[CharaFileLoader] Read failed:', error);
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
    logger.error('[CharaFileLoader] Parse failed:', error);
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
  logger.info(`[CharaFileLoader] Parsed ${file.name} (${resolved.producer ?? 'unknown producer'})`);
  return { ok: true };
}
