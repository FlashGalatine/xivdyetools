/**
 * Tests for the locale layer both Discord bots now share (REFACTOR-001).
 *
 * The forked copies this replaces had one test suite between them, and BUG-001
 * — moderation-worker never reading the unified `prefs:v1:` blob — lived in the
 * gap. The priority order is the whole contract, so every step of it is pinned
 * here, including the failure behaviour: locale resolution runs on every
 * interaction and must degrade the language, never the interaction.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  SUPPORTED_LOCALES,
  isValidLocale,
  discordLocaleToLocaleCode,
  resolveUserLocale,
  type LocalePreferenceStore,
} from './locale-resolution.js';
import { LOCALE_CODES } from './types.js';

/** A KV double whose contents are a plain map. */
function store(entries: Record<string, string> = {}): LocalePreferenceStore & {
  get: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn(async (key: string) => entries[key] ?? null),
  };
}

describe('isValidLocale', () => {
  it.each(LOCALE_CODES)('accepts %s', (code) => {
    expect(isValidLocale(code)).toBe(true);
  });

  it.each(['', 'EN', 'en-US', 'es', 'zh-CN', 'constructor'])('rejects %j', (code) => {
    expect(isValidLocale(code)).toBe(false);
  });

  // REFACTOR-001: the guard and the type are derived from ONE list, so they
  // cannot disagree. moderation-worker's copy declared the union and the array
  // separately, and structural typing hid it: adding a seventh locale to the
  // shared type would have compiled clean there and been silently rejected.
  it('accepts exactly the codes LOCALE_CODES declares', () => {
    expect(SUPPORTED_LOCALES.map((l) => l.code)).toEqual([...LOCALE_CODES]);
  });
});

describe('discordLocaleToLocaleCode', () => {
  it.each([
    ['en-US', 'en'],
    ['en-GB', 'en'],
    ['ja', 'ja'],
    ['de', 'de'],
    ['fr', 'fr'],
    ['ko', 'ko'],
    ['zh-CN', 'zh'],
    ['zh-TW', 'zh'],
  ])('maps %s to %s', (discord, expected) => {
    expect(discordLocaleToLocaleCode(discord)).toBe(expected);
  });

  it.each(['es-ES', 'pt-BR', 'ru', '', 'toString'])('returns null for %j', (discord) => {
    expect(discordLocaleToLocaleCode(discord)).toBeNull();
  });
});

describe('resolveUserLocale', () => {
  // BUG-001: this step is the one moderation-worker's copy never had. Both
  // workers bind the SAME production KV namespace, and `/preferences` writes
  // `prefs:v1:` exclusively, so a user who set their language through the main
  // bot had no legacy key and every moderation string came back in their
  // Discord client locale instead.
  it('prefers the unified preferences blob', async () => {
    const kv = store({
      'prefs:v1:u1': JSON.stringify({ language: 'ja' }),
      'i18n:user:u1': 'de',
    });

    await expect(resolveUserLocale(kv, 'u1', 'fr')).resolves.toBe('ja');
  });

  it('falls back to the legacy key when the blob has no language', async () => {
    const kv = store({
      'prefs:v1:u1': JSON.stringify({ theme: 'dark' }),
      'i18n:user:u1': 'de',
    });

    await expect(resolveUserLocale(kv, 'u1', 'fr')).resolves.toBe('de');
  });

  it('falls back to the legacy key when there is no blob', async () => {
    const kv = store({ 'i18n:user:u1': 'ko' });

    await expect(resolveUserLocale(kv, 'u1', 'fr')).resolves.toBe('ko');
  });

  it('falls back to the Discord client locale', async () => {
    await expect(resolveUserLocale(store(), 'u1', 'zh-TW')).resolves.toBe('zh');
  });

  it('defaults to English', async () => {
    await expect(resolveUserLocale(store(), 'u1')).resolves.toBe('en');
    await expect(resolveUserLocale(store(), 'u1', 'es-ES')).resolves.toBe('en');
  });

  it('ignores an unsupported language in the blob', async () => {
    const kv = store({ 'prefs:v1:u1': JSON.stringify({ language: 'es' }) });

    await expect(resolveUserLocale(kv, 'u1', 'de')).resolves.toBe('de');
  });

  it('ignores an unsupported value in the legacy key', async () => {
    const kv = store({ 'i18n:user:u1': 'es' });

    await expect(resolveUserLocale(kv, 'u1', 'de')).resolves.toBe('de');
  });

  // A malformed blob or a KV outage must cost the user their language, not
  // their command.
  it('falls through a malformed preferences blob', async () => {
    const kv = store({ 'prefs:v1:u1': 'not json {', 'i18n:user:u1': 'ja' });

    await expect(resolveUserLocale(kv, 'u1')).resolves.toBe('ja');
  });

  it('resolves to English when every KV read throws', async () => {
    const kv: LocalePreferenceStore = {
      get: vi.fn().mockRejectedValue(new Error('KV unavailable')),
    };

    await expect(resolveUserLocale(kv, 'u1')).resolves.toBe('en');
  });

  it('still honours the Discord locale when KV is down', async () => {
    const kv: LocalePreferenceStore = {
      get: vi.fn().mockRejectedValue(new Error('KV unavailable')),
    };

    await expect(resolveUserLocale(kv, 'u1', 'ja')).resolves.toBe('ja');
  });

  it('reads the two keys under the prefixes both workers agree on', async () => {
    const kv = store();

    await resolveUserLocale(kv, 'user-123');

    expect(kv.get).toHaveBeenCalledWith('prefs:v1:user-123');
    expect(kv.get).toHaveBeenCalledWith('i18n:user:user-123');
  });
});

// BUG-126 (2026-10-04 audit): the legacy reader has logged a KV failure since
// REFACTOR-001 kept moderation-worker's louder copy, but resolveUserLocale —
// its only production caller — never handed it a logger, so the line never
// fired. Locale resolution still never throws; it now says why it degraded.
describe('resolveUserLocale logging (BUG-126)', () => {
  const USER_ID = 'user-123';
  // Short, and at the very start of the malformed blob: V8 quotes only about
  // ten characters either side of the parse position, so a sentinel placed
  // later in a longer blob would be elided ('"not json { "...') and the
  // leak test could not see the leak it guards against.
  const SENTINEL = 'blobsecret';

  /**
   * Every string a logger was handed: each message, and each Error's
   * message, name and stack. `JSON.stringify(mock.calls)` would render an
   * Error as `{}` and hide exactly the leak these tests look for.
   */
  function loggedText(error: ReturnType<typeof vi.fn>): string {
    return error.mock.calls
      .flat()
      .map((arg: unknown) =>
        arg instanceof Error ? `${arg.name} ${arg.message} ${arg.stack ?? ''}` : String(arg)
      )
      .join('\n');
  }

  it('logs a KV failure on both reads and still resolves', async () => {
    const kv: LocalePreferenceStore = {
      get: vi.fn().mockRejectedValue(new Error('KV unavailable')),
    };
    const logger = { error: vi.fn() };

    await expect(resolveUserLocale(kv, USER_ID, 'ja', logger)).resolves.toBe('ja');

    expect(logger.error).toHaveBeenCalledTimes(2);
    for (const [message, error] of logger.error.mock.calls) {
      expect(typeof message).toBe('string');
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('KV unavailable');
    }
  });

  // The promise is narrower than "the id is never logged". The fixed messages
  // never name the user, but a failed KV read hands the logger the KV's own
  // Error unchanged — its message is what tells a rate limit from an outage:
  // the worker logger drops the stack, and the class alone would read just
  // 'Error'. If the runtime's error quotes the key, the id travels with it,
  // as it already does on each slash command's 'Handling command' line. The
  // rejection here quotes the key so that choice is pinned, not assumed:
  // hiding it would make this test fail and need a deliberate edit.
  it('keeps the user id out of its own messages and passes the KV error through as-is', async () => {
    const rejections: Error[] = [];
    const kv: LocalePreferenceStore = {
      get: vi.fn(async (key: string) => {
        const error = new Error(`KV GET failed for ${key}`);
        rejections.push(error);
        throw error;
      }),
    };
    const logger = { error: vi.fn() };

    await resolveUserLocale(kv, USER_ID, undefined, logger);

    expect(rejections.map((e) => e.message)).toEqual([
      `KV GET failed for prefs:v1:${USER_ID}`,
      `KV GET failed for i18n:user:${USER_ID}`,
    ]);
    expect(logger.error).toHaveBeenCalledTimes(2);
    logger.error.mock.calls.forEach(([message, error], i) => {
      expect(message).not.toContain(USER_ID);
      expect(error).toBe(rejections[i]);
    });
  });

  // JSON.parse's SyntaxError quotes the input ("… is not valid JSON"), so
  // handing it to the logger would write the user's stored blob into the
  // logs. A malformed blob is logged by a fixed message alone.
  it('logs a malformed blob without the KV contents', async () => {
    const kv = store({
      [`prefs:v1:${USER_ID}`]: `${SENTINEL} {`,
      [`i18n:user:${USER_ID}`]: 'ja',
    });
    const logger = { error: vi.fn() };

    await expect(resolveUserLocale(kv, USER_ID, undefined, logger)).resolves.toBe('ja');

    expect(logger.error).toHaveBeenCalledTimes(1);
    const text = loggedText(logger.error);
    expect(text).not.toContain(SENTINEL);
    expect(text).not.toContain(USER_ID);
  });

  // LocaleResolutionLogger takes `error?: Error`, and a JavaScript store can
  // reject with anything. A thrown string is not an Error, so the line goes
  // out with no error object rather than handing the logger whatever was
  // thrown, which could be a quoted key or blob.
  it('logs a non-Error KV rejection by its message alone, on both reads', async () => {
    const kv: LocalePreferenceStore = {
      get: vi.fn().mockRejectedValue(`KV GET failed for prefs:v1:${USER_ID}`),
    };
    const logger = { error: vi.fn() };

    await expect(resolveUserLocale(kv, USER_ID, 'fr', logger)).resolves.toBe('fr');

    expect(logger.error).toHaveBeenCalledTimes(2);
    for (const [message, error] of logger.error.mock.calls) {
      expect(typeof message).toBe('string');
      expect(error).toBeUndefined();
    }
    expect(loggedText(logger.error)).not.toContain(USER_ID);
  });

  it('logs nothing when every read succeeds', async () => {
    const logger = { error: vi.fn() };

    await resolveUserLocale(store({ 'i18n:user:u1': 'de' }), 'u1', 'fr', logger);

    expect(logger.error).not.toHaveBeenCalled();
  });

  it('still resolves without a logger', async () => {
    const kv: LocalePreferenceStore = {
      get: vi.fn().mockRejectedValue(new Error('KV unavailable')),
    };

    await expect(resolveUserLocale(kv, USER_ID, 'de')).resolves.toBe('de');
  });
});
