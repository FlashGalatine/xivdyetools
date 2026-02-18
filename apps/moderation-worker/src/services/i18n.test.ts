import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockKV } from '@xivdyetools/test-utils';
import {
  isValidLocale,
  getLocaleInfo,
  discordLocaleToLocaleCode,
  getUserLanguagePreference,
  resolveUserLocale,
  SUPPORTED_LOCALES,
  type LocaleCode,
} from './i18n.js';

describe('i18n', () => {
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  describe('SUPPORTED_LOCALES', () => {
    it('should contain all expected locales', () => {
      const codes = SUPPORTED_LOCALES.map((l) => l.code);
      expect(codes).toEqual(['en', 'ja', 'de', 'fr', 'ko', 'zh']);
    });

    it('should have all required properties for each locale', () => {
      SUPPORTED_LOCALES.forEach((locale) => {
        expect(locale).toHaveProperty('code');
        expect(locale).toHaveProperty('name');
        expect(locale).toHaveProperty('nativeName');
        expect(locale).toHaveProperty('flag');

        expect(typeof locale.code).toBe('string');
        expect(typeof locale.name).toBe('string');
        expect(typeof locale.nativeName).toBe('string');
        expect(typeof locale.flag).toBe('string');
      });
    });

    it('should have unique locale codes', () => {
      const codes = SUPPORTED_LOCALES.map((l) => l.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe('isValidLocale', () => {
    it('should return true for valid locale codes', () => {
      expect(isValidLocale('en')).toBe(true);
      expect(isValidLocale('ja')).toBe(true);
      expect(isValidLocale('de')).toBe(true);
      expect(isValidLocale('fr')).toBe(true);
      expect(isValidLocale('ko')).toBe(true);
      expect(isValidLocale('zh')).toBe(true);
    });

    it('should return false for invalid locale codes', () => {
      expect(isValidLocale('es')).toBe(false);
      expect(isValidLocale('pt')).toBe(false);
      expect(isValidLocale('it')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidLocale('')).toBe(false);
    });

    it('should return false for uppercase codes', () => {
      expect(isValidLocale('EN')).toBe(false);
      expect(isValidLocale('JA')).toBe(false);
    });

    it('should return false for partial matches', () => {
      expect(isValidLocale('e')).toBe(false);
      expect(isValidLocale('eng')).toBe(false);
    });

    it('should return false for Discord locale format', () => {
      expect(isValidLocale('en-US')).toBe(false);
      expect(isValidLocale('zh-CN')).toBe(false);
    });
  });

  describe('getLocaleInfo', () => {
    it('should return locale info for English', () => {
      const info = getLocaleInfo('en');
      expect(info).toEqual({
        code: 'en',
        name: 'English',
        nativeName: 'English',
        flag: '🇺🇸',
      });
    });

    it('should return locale info for Japanese', () => {
      const info = getLocaleInfo('ja');
      expect(info).toEqual({
        code: 'ja',
        name: 'Japanese',
        nativeName: '日本語',
        flag: '🇯🇵',
      });
    });

    it('should return locale info for German', () => {
      const info = getLocaleInfo('de');
      expect(info).toBeDefined();
      expect(info?.code).toBe('de');
      expect(info?.name).toBe('German');
      expect(info?.nativeName).toBe('Deutsch');
    });

    it('should return locale info for French', () => {
      const info = getLocaleInfo('fr');
      expect(info?.code).toBe('fr');
      expect(info?.nativeName).toBe('Français');
    });

    it('should return locale info for Korean', () => {
      const info = getLocaleInfo('ko');
      expect(info?.code).toBe('ko');
      expect(info?.nativeName).toBe('한국어');
    });

    it('should return locale info for Chinese', () => {
      const info = getLocaleInfo('zh');
      expect(info?.code).toBe('zh');
      expect(info?.nativeName).toBe('中文');
    });

    it('should return undefined for invalid locale code', () => {
      const info = getLocaleInfo('es' as LocaleCode);
      expect(info).toBeUndefined();
    });
  });

  describe('discordLocaleToLocaleCode', () => {
    describe('English variants', () => {
      it('should map en-US to en', () => {
        expect(discordLocaleToLocaleCode('en-US')).toBe('en');
      });

      it('should map en-GB to en', () => {
        expect(discordLocaleToLocaleCode('en-GB')).toBe('en');
      });
    });

    describe('single-code locales', () => {
      it('should map ja to ja', () => {
        expect(discordLocaleToLocaleCode('ja')).toBe('ja');
      });

      it('should map de to de', () => {
        expect(discordLocaleToLocaleCode('de')).toBe('de');
      });

      it('should map fr to fr', () => {
        expect(discordLocaleToLocaleCode('fr')).toBe('fr');
      });

      it('should map ko to ko', () => {
        expect(discordLocaleToLocaleCode('ko')).toBe('ko');
      });
    });

    describe('Chinese variants', () => {
      it('should map zh-CN to zh', () => {
        expect(discordLocaleToLocaleCode('zh-CN')).toBe('zh');
      });

      it('should map zh-TW to zh', () => {
        expect(discordLocaleToLocaleCode('zh-TW')).toBe('zh');
      });
    });

    describe('unsupported locales', () => {
      it('should return null for unsupported Discord locales', () => {
        expect(discordLocaleToLocaleCode('es-ES')).toBeNull();
        expect(discordLocaleToLocaleCode('pt-BR')).toBeNull();
        expect(discordLocaleToLocaleCode('ru')).toBeNull();
        expect(discordLocaleToLocaleCode('it')).toBeNull();
      });

      it('should return null for invalid format', () => {
        expect(discordLocaleToLocaleCode('english')).toBeNull();
        expect(discordLocaleToLocaleCode('EN')).toBeNull();
        expect(discordLocaleToLocaleCode('')).toBeNull();
      });

      it('should return null for undefined values', () => {
        expect(discordLocaleToLocaleCode('unknown-XX')).toBeNull();
      });
    });
  });

  describe('getUserLanguagePreference', () => {
    it('should return user preference from KV', async () => {
      await mockKV.put('i18n:user:user-123', 'ja');

      const result = await getUserLanguagePreference(
        mockKV as unknown as KVNamespace,
        'user-123'
      );

      expect(result).toBe('ja');
    });

    it('should return null when no preference is stored', async () => {
      const result = await getUserLanguagePreference(
        mockKV as unknown as KVNamespace,
        'user-456'
      );

      expect(result).toBeNull();
    });

    it('should return null for invalid locale value in KV', async () => {
      await mockKV.put('i18n:user:user-789', 'invalid');

      const result = await getUserLanguagePreference(
        mockKV as unknown as KVNamespace,
        'user-789'
      );

      expect(result).toBeNull();
    });

    it('should validate locale code before returning', async () => {
      await mockKV.put('i18n:user:user-123', 'es'); // Not supported

      const result = await getUserLanguagePreference(
        mockKV as unknown as KVNamespace,
        'user-123'
      );

      expect(result).toBeNull();
    });

    it('should use correct KV key format', async () => {
      await mockKV.put('i18n:user:discord-123', 'de');

      const result = await getUserLanguagePreference(
        mockKV as unknown as KVNamespace,
        'discord-123'
      );

      // Verify the correct locale was retrieved
      expect(result).toBe('de');
      // Verify the value is stored with correct key in KV
      expect(mockKV._store.get('i18n:user:discord-123')).toBe('de');
    });

    it('should handle KV errors gracefully', async () => {
      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV connection failed')),
      } as unknown as KVNamespace;

      const result = await getUserLanguagePreference(errorKV, 'user-123');

      expect(result).toBeNull();
    });

    it('should log errors when logger is provided', async () => {
      const mockLogger = {
        error: vi.fn(),
      };

      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
      } as unknown as KVNamespace;

      await getUserLanguagePreference(errorKV, 'user-123', mockLogger as any);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get user language preference',
        expect.any(Error)
      );
    });

    it('should not log errors when logger is not provided', async () => {
      const errorKV = {
        get: vi.fn().mockRejectedValue(new Error('KV error')),
      } as unknown as KVNamespace;

      // Should not throw, just return null
      const result = await getUserLanguagePreference(errorKV, 'user-123');
      expect(result).toBeNull();
    });

    it('should handle empty string values', async () => {
      await mockKV.put('i18n:user:user-123', '');

      const result = await getUserLanguagePreference(
        mockKV as unknown as KVNamespace,
        'user-123'
      );

      expect(result).toBeNull();
    });
  });

  describe('resolveUserLocale', () => {
    describe('user preference priority', () => {
      it('should return user preference when available', async () => {
        await mockKV.put('i18n:user:user-123', 'ja');

        const result = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-123',
          'en-US'
        );

        expect(result).toBe('ja');
      });

      it('should prefer user preference over Discord locale', async () => {
        await mockKV.put('i18n:user:user-123', 'de');

        const result = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-123',
          'fr'
        );

        expect(result).toBe('de');
      });
    });

    describe('Discord locale fallback', () => {
      it('should use Discord locale when no user preference exists', async () => {
        const result = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-456',
          'ja'
        );

        expect(result).toBe('ja');
      });

      it('should map Discord locale variants correctly', async () => {
        const result1 = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-1',
          'en-GB'
        );
        expect(result1).toBe('en');

        const result2 = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-2',
          'zh-CN'
        );
        expect(result2).toBe('zh');
      });

      it('should handle all supported Discord locales', async () => {
        const discordLocales = ['en-US', 'ja', 'de', 'fr', 'ko', 'zh-TW'];
        const expected = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];

        for (let i = 0; i < discordLocales.length; i++) {
          const result = await resolveUserLocale(
            mockKV as unknown as KVNamespace,
            `user-${i}`,
            discordLocales[i]
          );
          expect(result).toBe(expected[i]);
        }
      });
    });

    describe('default fallback', () => {
      it('should default to English when no preference or Discord locale', async () => {
        const result = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-new'
        );

        expect(result).toBe('en');
      });

      it('should default to English for unsupported Discord locale', async () => {
        const result = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-789',
          'es-ES' // Not supported
        );

        expect(result).toBe('en');
      });

      it('should default to English when KV fails', async () => {
        const errorKV = {
          get: vi.fn().mockRejectedValue(new Error('KV error')),
        } as unknown as KVNamespace;

        const result = await resolveUserLocale(errorKV, 'user-123');

        expect(result).toBe('en');
      });
    });

    describe('fallback chain', () => {
      it('should follow preference → Discord → default chain', async () => {
        // No preference, no Discord locale → default (en)
        const result1 = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-1'
        );
        expect(result1).toBe('en');

        // No preference, has Discord locale → Discord locale
        const result2 = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-2',
          'ja'
        );
        expect(result2).toBe('ja');

        // Has preference → preference (ignores Discord)
        await mockKV.put('i18n:user:user-3', 'ko');
        const result3 = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-3',
          'ja'
        );
        expect(result3).toBe('ko');
      });
    });

    describe('edge cases', () => {
      it('should handle empty Discord locale', async () => {
        const result = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-123',
          ''
        );

        expect(result).toBe('en');
      });

      it('should handle undefined Discord locale', async () => {
        const result = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-123',
          undefined
        );

        expect(result).toBe('en');
      });

      it('should handle malformed Discord locale', async () => {
        const result = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-123',
          'invalid-locale-format'
        );

        expect(result).toBe('en');
      });

      it('should handle different user IDs consistently', async () => {
        await mockKV.put('i18n:user:user-a', 'ja');
        await mockKV.put('i18n:user:user-b', 'de');

        const resultA = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-a'
        );
        const resultB = await resolveUserLocale(
          mockKV as unknown as KVNamespace,
          'user-b'
        );

        expect(resultA).toBe('ja');
        expect(resultB).toBe('de');
      });
    });
  });
});
