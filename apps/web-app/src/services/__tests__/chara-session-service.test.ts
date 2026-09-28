/**
 * CharaSessionService — the one loaded `.chara` character, shared by every
 * view of it (file card, THIS CHARACTER, DYES ON THIS GLAMOUR, the sidebar's
 * tribe/gender lock). Memory only: these tests also pin that it never writes
 * the character to browser storage.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ResolvedCharaCharacter } from '@xivdyetools/core';
import { CharaSessionService, type CharaSession } from '../chara-session-service';
import { logger } from '@shared/logger';

/** Only the session's identity matters here, not a parsed character's contents. */
const session = (fileName: string): CharaSession => ({
  resolved: { nickname: 'Real Name' } as unknown as ResolvedCharaCharacter,
  fileName,
});

beforeEach(() => {
  CharaSessionService.setSession(null);
});

afterEach(() => {
  CharaSessionService.setSession(null);
  vi.restoreAllMocks();
});

describe('CharaSessionService', () => {
  it('starts with no character loaded', () => {
    expect(CharaSessionService.getSession()).toBeNull();
  });

  it('hands every subscriber the new session, then null when it is cleared', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = CharaSessionService.subscribe(first);
    const unsubscribeSecond = CharaSessionService.subscribe(second);
    const loaded = session('a.chara');

    CharaSessionService.setSession(loaded);
    expect(CharaSessionService.getSession()).toBe(loaded);
    expect(first).toHaveBeenLastCalledWith(loaded);
    expect(second).toHaveBeenLastCalledWith(loaded);

    CharaSessionService.setSession(null);
    expect(CharaSessionService.getSession()).toBeNull();
    expect(first).toHaveBeenLastCalledWith(null);
    expect(second).toHaveBeenLastCalledWith(null);

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('stops calling a subscriber once it unsubscribes', () => {
    const listener = vi.fn();
    const unsubscribe = CharaSessionService.subscribe(listener);
    unsubscribe();

    CharaSessionService.setSession(session('a.chara'));

    expect(listener).not.toHaveBeenCalled();
  });

  it('keeps notifying the others when one subscriber throws, and logs it', () => {
    const error = vi.spyOn(logger, 'error').mockImplementation(() => {});
    const unsubscribeBroken = CharaSessionService.subscribe(() => {
      throw new Error('consumer bug');
    });
    const healthy = vi.fn();
    const unsubscribeHealthy = CharaSessionService.subscribe(healthy);
    const loaded = session('a.chara');

    expect(() => CharaSessionService.setSession(loaded)).not.toThrow();
    expect(healthy).toHaveBeenCalledWith(loaded);
    expect(error).toHaveBeenCalledWith('[CharaSession] Subscriber failed:', expect.any(Error));

    unsubscribeBroken();
    unsubscribeHealthy();
  });

  it('never writes the character to browser storage', () => {
    localStorage.clear();
    sessionStorage.clear();

    CharaSessionService.setSession(session('Real Name.chara'));

    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
