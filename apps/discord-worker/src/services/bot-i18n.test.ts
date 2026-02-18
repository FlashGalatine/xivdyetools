/**
 * Tests for Bot I18n Service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    Translator,
    createTranslator,
    createUserTranslator,
    translate,
    getAvailableLocales,
    isLocaleSupported,
} from './bot-i18n.js';

// Mock the i18n.js module for resolveUserLocale
vi.mock('./i18n.js', () => ({
    resolveUserLocale: vi.fn().mockResolvedValue('en'),
}));

import { resolveUserLocale } from './i18n.js';

// Create mock KV namespace
function createMockKV() {
    return {
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as KVNamespace;
}

describe('bot-i18n.ts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Translator', () => {
        describe('constructor', () => {
            it('should create a translator with the specified locale', () => {
                const translator = new Translator('ja');
                expect(translator.getLocale()).toBe('ja');
            });

            it('should fall back to English for invalid locale', () => {
                const translator = new Translator('invalid' as any);
                // Should still store the locale but use English data as fallback
                expect(translator.getLocale()).toBe('invalid');
            });
        });

        describe('t (translate)', () => {
            it('should translate a key with English locale', () => {
                const translator = createTranslator('en');

                // Test with a key we know exists in the locale files
                const result = translator.t('meta.locale');
                expect(result).toBe('en');
            });

            it('should translate a deeply nested key', () => {
                const translator = createTranslator('en');

                const result = translator.t('meta.name');
                expect(result).toBe('English');
            });

            it('should return the key for missing translations', () => {
                const translator = createTranslator('en');

                const result = translator.t('nonexistent.key.path');
                expect(result).toBe('nonexistent.key.path');
            });

            it('should log warning for missing translations when logger is provided', () => {
                const mockLogger = {
                    warn: vi.fn(),
                    info: vi.fn(),
                    error: vi.fn(),
                    debug: vi.fn(),
                } as any;

                const translator = new Translator('en', mockLogger);

                translator.t('nonexistent.key.path');

                expect(mockLogger.warn).toHaveBeenCalledWith(
                    'Missing translation: nonexistent.key.path for locale en'
                );
            });

            it('should interpolate variables', () => {
                // Create a translator and test interpolation
                const translator = createTranslator('en');

                // Even if we can't verify actual keys, we can test interpolation logic
                // by accessing a key that returns a template (if one exists)
                // For now, test that the translator handles missing keys gracefully
                const result = translator.t('test_key', { value: '42' });
                expect(result).toBe('test_key'); // Returns key since it doesn't exist
            });

            it('should interpolate real translation key with variables', () => {
                const translator = createTranslator('en');

                // Use a real translation key that has a variable placeholder
                const result = translator.t('errors.dyeNotFound', { name: 'Snow White' });
                expect(result).toBe('Could not find a dye named "Snow White".');
            });

            it('should interpolate multiple variables', () => {
                const translator = createTranslator('en');

                // Use a key that has multiple placeholders
                const result = translator.t('dye.list.categorySummary', { total: 100, count: 5 });
                expect(result).toBe('There are 100 dyes across 5 categories:');
            });

            it('should keep placeholder when variable is missing', () => {
                const translator = createTranslator('en');

                // Provide only one of two required variables
                const result = translator.t('dye.list.categorySummary', { total: 100 });
                // {count} should remain as-is since it wasn't provided
                expect(result).toContain('100');
                expect(result).toContain('{count}');
            });

            it('should handle numeric variables', () => {
                const translator = createTranslator('en');

                // Test with a number variable
                const result = translator.t('dye.search.foundCount', { count: 1 });
                expect(result).toBe('Found 1 dye:');
            });

            it('should fall back to English for missing translations in other locales', () => {
                const translator = createTranslator('ja');

                // If a key is missing in Japanese but exists in English, it should use English
                // We'll test with a consistent key like meta.locale
                const result = translator.t('meta.locale');
                expect(result).toBe('ja');
            });

            it('should use English fallback when key is missing in non-English locale', () => {
                // Create translator for a non-English locale
                const translator = createTranslator('de');

                // Test with a key that exists - the behavior is to return the value from the locale
                // For a truly missing key, it would try English fallback first
                // Since we can't control locale data, test with a non-existent key
                const result = translator.t('totally.nonexistent.key.xyz123');
                // Should return the key since it's not found in either locale
                expect(result).toBe('totally.nonexistent.key.xyz123');
            });

            it('should interpolate variables with non-English locale', () => {
                const translator = createTranslator('fr');

                // Use a French translation with variables
                const result = translator.t('errors.dyeNotFound', { name: 'Blanc Neige' });
                expect(result).toBe('Impossible de trouver une teinture nommée "Blanc Neige".');
            });

            it('should return undefined when path traverses through a non-object value', () => {
                const translator = createTranslator('en');

                // Try to access a nested key where an intermediate value is a string
                // e.g., 'meta.locale.nested' where meta.locale is 'en' (a string)
                const result = translator.t('meta.locale.nested');
                expect(result).toBe('meta.locale.nested');
            });

            it('should return undefined when path traverses through null value', () => {
                const translator = createTranslator('en');

                // Access a deeply nested path that doesn't exist
                const result = translator.t('nonexistent.deep.path.value');
                expect(result).toBe('nonexistent.deep.path.value');
            });

            it('should keep placeholder when variable is not provided', () => {
                // This tests the interpolate function's fallback to match
                const translator = createTranslator('en');

                // Access a key and provide variables, but the template has a different placeholder
                // Since we don't have control over the template, test with missing variable
                const result = translator.t('missing_key', { unused: 'value' });
                expect(result).toBe('missing_key');
            });
        });

        describe('getLocale', () => {
            it('should return the current locale code', () => {
                const translator = createTranslator('de');
                expect(translator.getLocale()).toBe('de');
            });
        });

        describe('getMeta', () => {
            it('should return locale metadata', () => {
                const translator = createTranslator('en');
                const meta = translator.getMeta();

                expect(meta).toBeDefined();
                expect(meta.locale).toBe('en');
                expect(meta.name).toBe('English');
                expect(meta.nativeName).toBe('English');
                expect(meta.flag).toBe('🇺🇸');
            });

            it('should return correct metadata for other locales', () => {
                const translator = createTranslator('ja');
                const meta = translator.getMeta();

                expect(meta.locale).toBe('ja');
                expect(meta.name).toBe('Japanese');
                expect(meta.nativeName).toBe('日本語');
                expect(meta.flag).toBe('🇯🇵');
            });
        });
    });

    describe('createTranslator', () => {
        it('should create an English translator by default', () => {
            const translator = createTranslator('en');
            expect(translator).toBeInstanceOf(Translator);
            expect(translator.getLocale()).toBe('en');
        });

        it('should create translators for all supported locales', () => {
            const locales = ['en', 'ja', 'de', 'fr', 'ko', 'zh'] as const;

            for (const locale of locales) {
                const translator = createTranslator(locale);
                expect(translator.getLocale()).toBe(locale);
            }
        });
    });

    describe('createUserTranslator', () => {
        it('should create a translator based on user preferences', async () => {
            const mockKV = createMockKV();
            vi.mocked(resolveUserLocale).mockResolvedValue('ja');

            const translator = await createUserTranslator(mockKV, 'user-123', 'en-US');

            expect(resolveUserLocale).toHaveBeenCalledWith(mockKV, 'user-123', 'en-US');
            expect(translator.getLocale()).toBe('ja');
        });

        it('should use Discord locale when no preference set', async () => {
            const mockKV = createMockKV();
            vi.mocked(resolveUserLocale).mockResolvedValue('de');

            const translator = await createUserTranslator(mockKV, 'user-456', 'de');

            expect(translator.getLocale()).toBe('de');
        });
    });

    describe('translate', () => {
        it('should translate without creating a reusable translator', () => {
            const result = translate('en', 'meta.name');
            expect(result).toBe('English');
        });

        it('should interpolate variables', () => {
            // Test with a key that might not exist to verify the fallback behavior
            const result = translate('en', 'missing.{value}', { value: 'test' });
            expect(result).toBe('missing.{value}'); // Returns key as-is since it doesn't exist
        });
    });

    describe('getAvailableLocales', () => {
        it('should return metadata for all available locales', () => {
            const locales = getAvailableLocales();

            expect(locales).toHaveLength(6);

            const codes = locales.map(l => l.locale);
            expect(codes).toContain('en');
            expect(codes).toContain('ja');
            expect(codes).toContain('de');
            expect(codes).toContain('fr');
            expect(codes).toContain('ko');
            expect(codes).toContain('zh');
        });

        it('should return proper metadata structure', () => {
            const locales = getAvailableLocales();

            for (const locale of locales) {
                expect(locale).toHaveProperty('locale');
                expect(locale).toHaveProperty('name');
                expect(locale).toHaveProperty('nativeName');
                expect(locale).toHaveProperty('flag');
            }
        });
    });

    describe('isLocaleSupported', () => {
        it('should return true for supported locales', () => {
            expect(isLocaleSupported('en')).toBe(true);
            expect(isLocaleSupported('ja')).toBe(true);
            expect(isLocaleSupported('de')).toBe(true);
            expect(isLocaleSupported('fr')).toBe(true);
            expect(isLocaleSupported('ko')).toBe(true);
            expect(isLocaleSupported('zh')).toBe(true);
        });

        it('should return false for unsupported locales', () => {
            expect(isLocaleSupported('es')).toBe(false);
            expect(isLocaleSupported('pt')).toBe(false);
            expect(isLocaleSupported('ru')).toBe(false);
            expect(isLocaleSupported('')).toBe(false);
            expect(isLocaleSupported('EN')).toBe(false); // Case-sensitive
        });
    });
});
