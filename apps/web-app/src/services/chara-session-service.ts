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
 * card. Parsing lives in `chara-file-loader` so this module stays small: the
 * config sidebar subscribes to it from the layout shell chunk.
 *
 * @module services/chara-session-service
 */

import type { ResolvedCharaCharacter } from '@xivdyetools/core';
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
