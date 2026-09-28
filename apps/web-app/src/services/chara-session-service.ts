/**
 * The loaded `.chara` character, held once for the whole app.
 *
 * The file card, the THIS CHARACTER sheet and DYES ON THIS GLAMOUR all read
 * the one parsed file from here. Each used to live inside a single component
 * that the Swatch Matcher destroyed whenever it left the page or re-rendered
 * (a language switch does both), so the file vanished while the sidebar's
 * tribe/gender lock — persisted config — stayed on without it.
 *
 * Memory only, by design: nothing here touches localStorage, sessionStorage or
 * IndexedDB, so a reload clears it. That is the LOCAL ONLY promise on the file
 * card. Parsing lives in `chara-file-loader` so this module stays small:
 * ConfigController imports it into the main entry, where it pins the swatch
 * tribe and gender to the file, and the config sidebar's lock subscribes to it.
 *
 * @module services/chara-session-service
 */

import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import type { Gender, SubRace } from '@xivdyetools/types';
import { logger } from '@shared/logger';

/** One parsed character file. */
export interface CharaSession {
  readonly resolved: ResolvedCharaCharacter;
  /** The dropped file's name: shown on the file card, never sent anywhere */
  readonly fileName: string;
}

type CharaSessionListener = (session: CharaSession | null) => void;

export class CharaSessionService {
  private static session: CharaSession | null = null;
  private static readonly listeners = new Set<CharaSessionListener>();

  /** The loaded character, or null when no file is loaded. */
  static getSession(): CharaSession | null {
    return this.session;
  }

  /**
   * The loaded file's tribe and gender, or null when no file is loaded or it
   * lacks either. While this is non-null they are the Swatch Matcher's race
   * and gender: ConfigController pins the swatch config to them.
   */
  static getTribeAndGender(): { tribe: SubRace; gender: Gender } | null {
    const resolved = this.session?.resolved;
    return resolved?.tribe && resolved.gender
      ? { tribe: resolved.tribe, gender: resolved.gender }
      : null;
  }

  /** Replace the loaded character (null clears it) and tell every subscriber. */
  static setSession(session: CharaSession | null): void {
    this.session = session;
    for (const listener of [...this.listeners]) {
      try {
        listener(session);
      } catch (error) {
        // One broken consumer must not keep the file from the others.
        logger.error('[CharaSession] Subscriber failed:', error);
      }
    }
  }

  /** Called on every load and clear. Returns the unsubscribe function. */
  static subscribe(listener: CharaSessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
