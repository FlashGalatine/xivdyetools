/**
 * Locale resolution.
 *
 * Locale resolution is a four-rung ladder (unified prefs → legacy i18n
 * pref → Discord's client locale → 'en'). A corrupt prefs blob must fall
 * *through* rather than throw, because this runs before every command.
 */

import { describe, it, expect, vi } from 'vitest';
import { discordLocaleToLocaleCode, resolveUserLocale } from './i18n.js';

function memoryKv(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => void store.set(key, value)),
    delete: vi.fn(async (key: string) => void store.delete(key)),
  } as unknown as KVNamespace & { store: Map<string, string> };
}

const prefsKey = (userId: string) => `prefs:v1:${userId}`;

describe('resolveUserLocale', () => {
  it('prefers the unified preferences language', async () => {
    const kv = memoryKv({ [prefsKey('u1')]: JSON.stringify({ language: 'ja' }) });

    expect(await resolveUserLocale(kv, 'u1', 'de')).toBe('ja');
  });

  it('ignores an unsupported language in unified preferences', async () => {
    const kv = memoryKv({ [prefsKey('u1')]: JSON.stringify({ language: 'klingon' }) });

    expect(await resolveUserLocale(kv, 'u1', 'de')).toBe('de');
  });

  it('ignores unified preferences with no language at all', async () => {
    const kv = memoryKv({ [prefsKey('u1')]: JSON.stringify({ theme: 'light' }) });

    expect(await resolveUserLocale(kv, 'u1', 'fr')).toBe('fr');
  });

  it('falls through a corrupt preferences blob rather than throwing', async () => {
    const kv = memoryKv({ [prefsKey('u1')]: '{not json' });

    expect(await resolveUserLocale(kv, 'u1', 'ko')).toBe('ko');
  });

  it('falls through when KV itself fails', async () => {
    const kv = memoryKv();
    vi.mocked(kv.get).mockRejectedValue(new Error('KV down'));

    // Every later rung also reads KV, so this lands on the Discord locale
    await expect(resolveUserLocale(kv, 'u1', 'de')).resolves.toBeTruthy();
  });

  it('maps the Discord client locale when no preference is stored', async () => {
    expect(await resolveUserLocale(memoryKv(), 'u1', 'ja')).toBe('ja');
    expect(await resolveUserLocale(memoryKv(), 'u1', 'de')).toBe('de');
  });

  it('defaults to English for an unmappable Discord locale', async () => {
    expect(await resolveUserLocale(memoryKv(), 'u1', 'tlh-KX')).toBe('en');
  });

  it('defaults to English when no Discord locale is sent at all', async () => {
    expect(await resolveUserLocale(memoryKv(), 'u1')).toBe('en');
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
  ])('maps %s to %s', (discord, expected) => {
    expect(discordLocaleToLocaleCode(discord)).toBe(expected);
  });

  it('returns null for a locale the bot does not ship', () => {
    expect(discordLocaleToLocaleCode('tlh-KX')).toBeNull();
  });
});
