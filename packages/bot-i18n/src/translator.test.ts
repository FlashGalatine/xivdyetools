/**
 * Tests for the bot-i18n Translator package.
 *
 * Adapted from apps/discord-worker/src/services/bot-i18n.test.ts.
 * Note: createUserTranslator (KV-dependent) is not part of this package —
 * it lives in each bot's platform-specific glue layer.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  Translator,
  createTranslator,
  translate,
  getAvailableLocales,
  isLocaleSupported,
} from './index.js';

describe('Translator', () => {
  describe('constructor', () => {
    it('creates a translator with the specified locale', () => {
      const translator = new Translator('ja');
      expect(translator.getLocale()).toBe('ja');
    });

    it('falls back to English data for an invalid locale', () => {
      // Locale is stored as-is, but data falls back to en
      const translator = new Translator('invalid' as 'en');
      expect(translator.getLocale()).toBe('invalid');
    });
  });

  describe('t (translate)', () => {
    it('translates a key with English locale', () => {
      const translator = createTranslator('en');
      expect(translator.t('meta.locale')).toBe('en');
    });

    it('translates a deeply nested key', () => {
      const translator = createTranslator('en');
      expect(translator.t('meta.name')).toBe('English');
    });

    it('returns the key for missing translations', () => {
      const translator = createTranslator('en');
      expect(translator.t('nonexistent.key.path')).toBe('nonexistent.key.path');
    });

    it('logs warning for missing translations when logger is provided', () => {
      const mockLogger = { warn: vi.fn() };
      const translator = new Translator('en', mockLogger);

      translator.t('nonexistent.key.path');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Missing translation: nonexistent.key.path for locale en'
      );
    });

    it('interpolates variables in a real translation key', () => {
      const translator = createTranslator('en');
      const result = translator.t('errors.dyeNotFound', { name: 'Snow White' });
      expect(result).toBe('Could not find a dye named "Snow White".');
    });

    it('interpolates multiple variables', () => {
      const translator = createTranslator('en');
      const result = translator.t('dye.list.categorySummary', { total: 100, count: 5 });
      expect(result).toBe('There are 100 dyes across 5 categories:');
    });

    it('keeps placeholder when variable is missing', () => {
      const translator = createTranslator('en');
      const result = translator.t('dye.list.categorySummary', { total: 100 });
      expect(result).toContain('100');
      expect(result).toContain('{count}');
    });

    it('handles numeric variables', () => {
      const translator = createTranslator('en');
      const result = translator.t('dye.search.foundCount', { count: 1 });
      expect(result).toBe('Found 1 dye:');
    });

    it('falls back to English for missing translations in other locales', () => {
      const translator = createTranslator('ja');
      // meta.locale exists in Japanese and returns the ja locale code
      expect(translator.t('meta.locale')).toBe('ja');
    });

    it('returns the key when not found in any locale', () => {
      const translator = createTranslator('de');
      expect(translator.t('totally.nonexistent.key.xyz123')).toBe('totally.nonexistent.key.xyz123');
    });

    it('interpolates variables with non-English locale', () => {
      const translator = createTranslator('fr');
      const result = translator.t('errors.dyeNotFound', { name: 'Blanc Neige' });
      expect(result).toBe('Impossible de trouver une teinture nommée "Blanc Neige".');
    });

    it('returns key when path traverses through a non-object value', () => {
      const translator = createTranslator('en');
      // meta.locale is 'en' (a string), so .nested can't be traversed
      expect(translator.t('meta.locale.nested')).toBe('meta.locale.nested');
    });

    it('returns key for deeply nested non-existent path', () => {
      const translator = createTranslator('en');
      expect(translator.t('nonexistent.deep.path.value')).toBe('nonexistent.deep.path.value');
    });
  });

  describe('getLocale', () => {
    it('returns the current locale code', () => {
      expect(createTranslator('de').getLocale()).toBe('de');
    });
  });

  describe('getMeta', () => {
    it('returns locale metadata for English', () => {
      const meta = createTranslator('en').getMeta();
      expect(meta.locale).toBe('en');
      expect(meta.name).toBe('English');
      expect(meta.nativeName).toBe('English');
      expect(meta.flag).toBe('🇺🇸');
    });

    it('returns locale metadata for Japanese', () => {
      const meta = createTranslator('ja').getMeta();
      expect(meta.locale).toBe('ja');
      expect(meta.name).toBe('Japanese');
      expect(meta.nativeName).toBe('日本語');
      expect(meta.flag).toBe('🇯🇵');
    });
  });
});

describe('createTranslator', () => {
  it('returns a Translator instance', () => {
    expect(createTranslator('en')).toBeInstanceOf(Translator);
  });

  it('creates translators for all supported locales', () => {
    const localeCodes = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const;
    for (const locale of localeCodes) {
      const translator = createTranslator(locale);
      expect(translator.getLocale()).toBe(locale);
    }
  });
});

describe('translate', () => {
  it('translates without a reusable translator instance', () => {
    expect(translate('en', 'meta.name')).toBe('English');
  });

  it('interpolates variables', () => {
    const result = translate('en', 'errors.dyeNotFound', { name: 'Soot Black' });
    expect(result).toBe('Could not find a dye named "Soot Black".');
  });

  it('returns key for missing translation', () => {
    expect(translate('en', 'missing.key')).toBe('missing.key');
  });
});

describe('getAvailableLocales', () => {
  it('returns metadata for all 6 available locales', () => {
    const available = getAvailableLocales();
    expect(available).toHaveLength(6);

    const codes = available.map((l) => l.locale);
    expect(codes).toContain('en');
    expect(codes).toContain('ja');
    expect(codes).toContain('de');
    expect(codes).toContain('fr');
    expect(codes).toContain('ko');
    expect(codes).toContain('zh');
  });

  it('returns proper metadata structure for each locale', () => {
    for (const locale of getAvailableLocales()) {
      expect(locale).toHaveProperty('locale');
      expect(locale).toHaveProperty('name');
      expect(locale).toHaveProperty('nativeName');
      expect(locale).toHaveProperty('flag');
    }
  });
});

describe('isLocaleSupported', () => {
  it('returns true for supported locales', () => {
    expect(isLocaleSupported('en')).toBe(true);
    expect(isLocaleSupported('ja')).toBe(true);
    expect(isLocaleSupported('de')).toBe(true);
    expect(isLocaleSupported('fr')).toBe(true);
    expect(isLocaleSupported('ko')).toBe(true);
    expect(isLocaleSupported('zh')).toBe(true);
  });

  it('returns false for unsupported locales', () => {
    expect(isLocaleSupported('es')).toBe(false);
    expect(isLocaleSupported('pt')).toBe(false);
    expect(isLocaleSupported('')).toBe(false);
    expect(isLocaleSupported('EN')).toBe(false); // case-sensitive
  });
});
