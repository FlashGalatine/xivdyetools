/**
 * Locale resolution and the CJK font-stack fallback.
 *
 * Two rules with real rendering consequences:
 *
 * - Locale resolution is a four-rung ladder (unified prefs → legacy i18n
 *   pref → Discord's client locale → 'en'). A corrupt prefs blob must fall
 *   *through* rather than throw, because this runs before every command.
 * - Font order is not cosmetic. JP must precede SC only for `ja`; if zh
 *   picked up the Japanese face, shared ideographs would render in the wrong
 *   letterforms. SC has no Hangul at all, so KR always comes last.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  discordLocaleToLocaleCode,
  formatLocaleDisplay,
  resolveUserLocale,
} from './i18n.js';
import { FONT_FAMILIES, getFontWithCjkFallback } from './fonts.js';

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

describe('formatLocaleDisplay', () => {
  it.each(['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const)(
    'renders %s with a flag and both names',
    (locale) => {
      const display = formatLocaleDisplay(locale);

      expect(display).toContain('(');
      expect(display.length).toBeGreaterThan(locale.length);
    }
  );

  it('falls back to the bare code for an unknown locale', () => {
    expect(formatLocaleDisplay('xx' as never)).toBe('xx');
  });
});

describe('getFontWithCjkFallback', () => {
  it('puts the primary font first', () => {
    expect(getFontWithCjkFallback('Onest', 'en').startsWith('Onest')).toBe(true);
  });

  it('puts JP ahead of SC for ja, so kana and kanji use Japanese letterforms', () => {
    const stack = getFontWithCjkFallback('Onest', 'ja');

    if (!stack.includes(FONT_FAMILIES.cjk)) return; // no CJK fonts bundled here
    expect(stack.indexOf('Noto Sans JP')).toBeLessThan(stack.indexOf(FONT_FAMILIES.cjk));
  });

  it.each(['zh', 'ko', 'en', 'de', undefined])(
    'does not put JP first for %s',
    (locale) => {
      const stack = getFontWithCjkFallback('Onest', locale);

      expect(stack).not.toContain('Noto Sans JP');
    }
  );

  it('always puts KR last — SC carries no Hangul glyphs', () => {
    for (const locale of ['ja', 'zh', 'ko', 'en']) {
      const stack = getFontWithCjkFallback('Onest', locale);
      if (!stack.includes(FONT_FAMILIES.kr)) continue;
      expect(stack.trim().endsWith(FONT_FAMILIES.kr)).toBe(true);
    }
  });

  it('names distinct families for the three Latin faces', () => {
    expect(new Set([FONT_FAMILIES.header, FONT_FAMILIES.body, FONT_FAMILIES.mono]).size).toBe(3);
  });
});
