/**
 * Locale Completeness Tests
 *
 * Ensures all locale files have the same keys as en.json (the source of truth).
 * When a new key is added to en.json, these tests fail for any locale that
 * hasn't been updated yet — catching missing translations early.
 */

import { describe, it, expect } from 'vitest';

import enLocale from './locales/en.json';
import jaLocale from './locales/ja.json';
import deLocale from './locales/de.json';
import frLocale from './locales/fr.json';
import koLocale from './locales/ko.json';
import zhLocale from './locales/zh.json';

function getAllKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return getAllKeys(value as Record<string, unknown>, fullKey);
    }
    return [fullKey];
  });
}

const locales = {
  ja: jaLocale,
  de: deLocale,
  fr: frLocale,
  ko: koLocale,
  zh: zhLocale,
} as const;

const enKeys = getAllKeys(enLocale as Record<string, unknown>);

describe('locale completeness', () => {
  for (const [code, data] of Object.entries(locales)) {
    it(`${code}.json has all keys present in en.json`, () => {
      const localeKeys = getAllKeys(data as Record<string, unknown>);
      const missing = enKeys.filter((key) => !localeKeys.includes(key));
      expect(missing).toEqual([]);
    });
  }
});

describe('locale structure', () => {
  const allLocales = { en: enLocale, ...locales } as const;

  for (const [code, data] of Object.entries(allLocales)) {
    it(`${code}.json has a valid meta block`, () => {
      const meta = (data as Record<string, unknown>)['meta'] as Record<string, unknown>;
      expect(typeof meta).toBe('object');
      expect(typeof meta['locale']).toBe('string');
      expect(typeof meta['name']).toBe('string');
      expect(typeof meta['nativeName']).toBe('string');
      expect(typeof meta['flag']).toBe('string');
    });
  }
});
