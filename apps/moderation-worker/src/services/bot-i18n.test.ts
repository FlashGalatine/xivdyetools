import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockKV } from '@xivdyetools/test-utils';
import { Translator, createTranslator, createUserTranslator } from './bot-i18n.js';
import type { ExtendedLogger } from '@xivdyetools/logger';

// Create a mock logger for testing
function createMockLogger(): ExtendedLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
    withContext: vi.fn().mockReturnThis(),
  } as unknown as ExtendedLogger;
}

describe('bot-i18n', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockKV = createMockKV();
    mockLogger = createMockLogger();
  });

  describe('Translator', () => {
    describe('constructor', () => {
      it('should create translator with English locale', () => {
        const translator = new Translator('en');

        expect(translator.getLocale()).toBe('en');
      });

      it('should create translator with Japanese locale', () => {
        const translator = new Translator('ja');

        expect(translator.getLocale()).toBe('ja');
      });

      it('should create translator with logger', () => {
        const translator = new Translator('en', mockLogger);

        expect(translator.getLocale()).toBe('en');
      });

      it('should fallback to English for unsupported locales', () => {
        // All locales fallback to English in this simplified moderation bot
        const translator = new Translator('fr');

        expect(translator.getLocale()).toBe('fr');
        // But translations should still work (falling back to English)
        expect(translator.t('common.error')).toBe('Error');
      });
    });

    describe('t() - translation', () => {
      it('should translate simple keys', () => {
        const translator = new Translator('en');

        expect(translator.t('common.error')).toBe('Error');
        expect(translator.t('common.success')).toBe('Success');
      });

      it('should translate nested keys', () => {
        const translator = new Translator('en');

        expect(translator.t('errors.userNotFound')).toBe('Could not identify user.');
        expect(translator.t('errors.missingSubcommand')).toBe('Please specify a subcommand.');
      });

      it('should translate deeply nested keys', () => {
        const translator = new Translator('en');

        expect(translator.t('preset.moderation.accessDenied')).toBe(
          "You don't have permission to perform moderation actions."
        );
        expect(translator.t('preset.moderation.noPending')).toBe(
          'No presets are currently awaiting moderation.'
        );
      });

      it('should interpolate variables', () => {
        const translator = new Translator('en');

        const result = translator.t('errors.unknownSubcommand', { name: 'test' });

        expect(result).toBe('Unknown subcommand: test');
      });

      it('should interpolate multiple variables', () => {
        const translator = new Translator('en');

        const result = translator.t('preset.moderation.pendingCount', { count: 5 });

        expect(result).toBe('5 preset(s) pending review');
      });

      it('should handle numeric variable interpolation', () => {
        const translator = new Translator('en');

        const result = translator.t('preset.moderation.pendingCount', { count: 100 });

        expect(result).toBe('100 preset(s) pending review');
      });

      it('should return key for missing translations', () => {
        const translator = new Translator('en');

        const result = translator.t('nonexistent.key');

        expect(result).toBe('nonexistent.key');
      });

      it('should log warning for missing translations when logger provided', () => {
        const translator = new Translator('en', mockLogger);

        translator.t('missing.translation');

        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Missing translation')
        );
      });

      it('should not log warning without logger', () => {
        const translator = new Translator('en');

        // Should not throw
        const result = translator.t('missing.translation');

        expect(result).toBe('missing.translation');
      });

      it('should handle missing variables gracefully', () => {
        const translator = new Translator('en');

        // Template has {name} but we don't provide it
        const result = translator.t('errors.unknownSubcommand', {});

        expect(result).toBe('Unknown subcommand: {name}');
      });

      it('should handle extra variables gracefully', () => {
        const translator = new Translator('en');

        const result = translator.t('common.error', { extra: 'value', another: 123 });

        expect(result).toBe('Error');
      });

      it('should translate preset status keys', () => {
        const translator = new Translator('en');

        expect(translator.t('preset.status.pending')).toBe('Pending');
        expect(translator.t('preset.status.approved')).toBe('Approved');
        expect(translator.t('preset.status.rejected')).toBe('Rejected');
        expect(translator.t('preset.status.flagged')).toBe('Flagged');
        expect(translator.t('preset.status.hidden')).toBe('Hidden');
      });

      it('should translate ban-related keys', () => {
        const translator = new Translator('en');

        expect(translator.t('ban.confirmTitle')).toBe('Confirm User Ban');
        expect(translator.t('ban.yesBan')).toBe('Yes, Ban User');
        expect(translator.t('ban.cancel')).toBe('Cancel');
        expect(translator.t('ban.userBanned')).toBe('User Banned');
        expect(translator.t('ban.userUnbanned')).toBe('User Unbanned');
      });

      it('should translate category keys', () => {
        const translator = new Translator('en');

        expect(translator.t('preset.categories.jobs')).toBe('FFXIV Jobs');
        expect(translator.t('preset.categories.grand-companies')).toBe('Grand Companies');
        expect(translator.t('preset.categories.seasons')).toBe('Seasons');
        expect(translator.t('preset.categories.events')).toBe('FFXIV Events');
        expect(translator.t('preset.categories.aesthetics')).toBe('Aesthetics');
        expect(translator.t('preset.categories.community')).toBe('Community');
      });
    });

    describe('fallback behavior', () => {
      it('should fallback to English for non-English locale missing keys', () => {
        const translator = new Translator('ja');

        // Japanese locale is a copy of English in this simplified bot
        expect(translator.t('common.error')).toBe('Error');
      });

      it('should use English data when locale not found', () => {
        // Cast to bypass type checking for test
        const translator = new Translator('xx' as 'en');

        expect(translator.t('common.error')).toBe('Error');
      });
    });

    describe('getLocale()', () => {
      it('should return current locale', () => {
        const translatorEn = new Translator('en');
        const translatorJa = new Translator('ja');
        const translatorDe = new Translator('de');

        expect(translatorEn.getLocale()).toBe('en');
        expect(translatorJa.getLocale()).toBe('ja');
        expect(translatorDe.getLocale()).toBe('de');
      });
    });

    describe('getMeta()', () => {
      it('should return locale metadata for English', () => {
        const translator = new Translator('en');
        const meta = translator.getMeta();

        expect(meta.locale).toBe('en');
        expect(meta.name).toBe('English');
        expect(meta.nativeName).toBe('English');
        expect(meta.flag).toBe('🇺🇸');
      });

      it('should return locale metadata for all supported locales', () => {
        const locales: Array<'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh'> = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];

        for (const locale of locales) {
          const translator = new Translator(locale);
          const meta = translator.getMeta();

          expect(meta).toHaveProperty('locale');
          expect(meta).toHaveProperty('name');
          expect(meta).toHaveProperty('nativeName');
          expect(meta).toHaveProperty('flag');
        }
      });
    });
  });

  describe('createTranslator', () => {
    it('should create translator for English', () => {
      const translator = createTranslator('en');

      expect(translator.getLocale()).toBe('en');
      expect(translator.t('common.error')).toBe('Error');
    });

    it('should create translator for Japanese', () => {
      const translator = createTranslator('ja');

      expect(translator.getLocale()).toBe('ja');
    });

    it('should create translator with logger', () => {
      const translator = createTranslator('en', mockLogger);

      translator.t('missing.key');

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should create translators for all supported locales', () => {
      const locales: Array<'en' | 'ja' | 'de' | 'fr' | 'ko' | 'zh'> = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];

      for (const locale of locales) {
        const translator = createTranslator(locale);
        expect(translator.getLocale()).toBe(locale);
      }
    });
  });

  describe('createUserTranslator', () => {
    it('should create translator with user preference from KV', async () => {
      // Key format is 'i18n:user:{userId}'
      await mockKV.put('i18n:user:user123', 'ja');

      const translator = await createUserTranslator(mockKV as unknown as KVNamespace, 'user123');

      expect(translator.getLocale()).toBe('ja');
    });

    it('should fallback to Discord locale when no preference', async () => {
      const translator = await createUserTranslator(mockKV as unknown as KVNamespace, 'user456', 'de');

      expect(translator.getLocale()).toBe('de');
    });

    it('should fallback to English when no preference and no Discord locale', async () => {
      const translator = await createUserTranslator(mockKV as unknown as KVNamespace, 'user789');

      expect(translator.getLocale()).toBe('en');
    });

    it('should use user preference over Discord locale', async () => {
      await mockKV.put('i18n:user:user123', 'fr');

      const translator = await createUserTranslator(mockKV as unknown as KVNamespace, 'user123', 'de');

      expect(translator.getLocale()).toBe('fr');
    });

    it('should pass logger to translator', async () => {
      const translator = await createUserTranslator(mockKV as unknown as KVNamespace, 'user123', undefined, mockLogger);

      translator.t('missing.key');

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should handle Discord locale mapping', async () => {
      // Discord uses locale codes like 'ja' which should map correctly
      const translator = await createUserTranslator(mockKV as unknown as KVNamespace, 'user123', 'ja');

      expect(translator.getLocale()).toBe('ja');
    });

    it('should handle unsupported Discord locale', async () => {
      // Unsupported locale should fallback to English
      const translator = await createUserTranslator(mockKV as unknown as KVNamespace, 'user123', 'es');

      expect(translator.getLocale()).toBe('en');
    });
  });

  describe('interpolation edge cases', () => {
    it('should handle empty string interpolation', () => {
      const translator = new Translator('en');

      const result = translator.t('errors.unknownSubcommand', { name: '' });

      expect(result).toBe('Unknown subcommand: ');
    });

    it('should handle zero as variable value', () => {
      const translator = new Translator('en');

      const result = translator.t('preset.moderation.pendingCount', { count: 0 });

      expect(result).toBe('0 preset(s) pending review');
    });

    it('should handle special characters in variables', () => {
      const translator = new Translator('en');

      const result = translator.t('errors.unknownSubcommand', { name: '<script>alert("xss")</script>' });

      expect(result).toBe('Unknown subcommand: <script>alert("xss")</script>');
    });

    it('should handle unicode in variables', () => {
      const translator = new Translator('en');

      const result = translator.t('errors.unknownSubcommand', { name: '日本語コマンド' });

      expect(result).toBe('Unknown subcommand: 日本語コマンド');
    });
  });

  describe('path traversal edge cases', () => {
    it('should return key for null in path', () => {
      const translator = new Translator('en');

      const result = translator.t('common.null.value');

      expect(result).toBe('common.null.value');
    });

    it('should return key for array index access', () => {
      const translator = new Translator('en');

      const result = translator.t('common.0');

      expect(result).toBe('common.0');
    });

    it('should handle single-segment keys', () => {
      const translator = new Translator('en');

      // 'meta' exists but returns an object, not a string
      const result = translator.t('meta');

      expect(result).toBe('meta');
    });
  });
});
