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
