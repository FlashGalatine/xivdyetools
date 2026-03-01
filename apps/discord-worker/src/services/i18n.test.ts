/**
 * Tests for I18n Service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    isValidLocale,
    getLocaleInfo,
    discordLocaleToLocaleCode,
    resolveUserLocale,
    initializeLocale,
    formatLocaleDisplay,
    getLocalizedDyeName,
    getLocalizedCategory,
    SUPPORTED_LOCALES,
    type LocaleCode,
} from './i18n.js';

// Shared mock functions for LocalizationService instances (BUG-001: per-locale instances)
// vi.hoisted ensures these are available when vi.mock factory runs (hoisted above imports)
const { mockSetLocale, mockGetDyeName, mockGetCategory } = vi.hoisted(() => ({
    mockSetLocale: vi.fn().mockResolvedValue(undefined),
    mockGetDyeName: vi.fn((itemID: number) => {
        const names: Record<number, string> = { 5729: 'Snow White', 5730: 'Soot Black' };
        return names[itemID] ?? null;
    }),
    mockGetCategory: vi.fn((category: string) => `Localized_${category}`),
}));

// Mock xivdyetools-core LocalizationService as constructor (BUG-001: no longer a singleton)
// Must use regular function (not arrow) so it's constructable with `new`
vi.mock('@xivdyetools/core', () => ({
    LocalizationService: vi.fn().mockImplementation(function () {
        return {
            setLocale: mockSetLocale,
            getDyeName: mockGetDyeName,
            getCategory: mockGetCategory,
        };
    }),
    // bot-logic/input-resolution.ts creates a DyeService instance at module load time
    DyeService: vi.fn().mockImplementation(function () { return {}; }),
    dyeDatabase: [],
}));

import { LocalizationService } from '@xivdyetools/core';

// Create mock KV namespace
function createMockKV() {
    const store = new Map<string, string>();

    return {
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
            store.delete(key);
        }),
        _store: store,
    } as unknown as KVNamespace & { _store: Map<string, string> };
}

describe('i18n.ts', () => {
    let mockKV: ReturnType<typeof createMockKV>;
    const mockUserId = 'user-123';

    beforeEach(() => {
        mockKV = createMockKV();
        vi.clearAllMocks();
        // Reset shared mocks (clears once-queue) then restore default implementations
        mockSetLocale.mockReset().mockResolvedValue(undefined);
        mockGetDyeName.mockReset().mockImplementation((itemID: number) => {
            const names: Record<number, string> = { 5729: 'Snow White', 5730: 'Soot Black' };
            return names[itemID] ?? null;
        });
        mockGetCategory.mockReset().mockImplementation((category: string) => `Localized_${category}`);
    });

    describe('SUPPORTED_LOCALES', () => {
        it('should contain all 6 supported locales', () => {
            expect(SUPPORTED_LOCALES).toHaveLength(6);

            const codes = SUPPORTED_LOCALES.map(l => l.code);
            expect(codes).toContain('en');
            expect(codes).toContain('ja');
            expect(codes).toContain('de');
            expect(codes).toContain('fr');
            expect(codes).toContain('ko');
            expect(codes).toContain('zh');
        });

        it('should have proper locale info structure', () => {
            const en = SUPPORTED_LOCALES.find(l => l.code === 'en');
            expect(en).toEqual({
                code: 'en',
                name: 'English',
                nativeName: 'English',
                flag: '🇺🇸',
            });

            const ja = SUPPORTED_LOCALES.find(l => l.code === 'ja');
            expect(ja).toEqual({
                code: 'ja',
                name: 'Japanese',
                nativeName: '日本語',
                flag: '🇯🇵',
            });
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
            expect(isValidLocale('EN')).toBe(false); // Case-sensitive
            expect(isValidLocale('')).toBe(false);
            expect(isValidLocale('english')).toBe(false);
        });
    });

    describe('getLocaleInfo', () => {
        it('should return locale info for valid codes', () => {
            const info = getLocaleInfo('ja');

            expect(info).toBeDefined();
            expect(info?.code).toBe('ja');
            expect(info?.name).toBe('Japanese');
            expect(info?.nativeName).toBe('日本語');
            expect(info?.flag).toBe('🇯🇵');
        });

        it('should return undefined for invalid codes', () => {
            // Type assertion since we're testing with invalid input
            const info = getLocaleInfo('invalid' as LocaleCode);
            expect(info).toBeUndefined();
        });
    });

    describe('discordLocaleToLocaleCode', () => {
        it('should map English locales', () => {
            expect(discordLocaleToLocaleCode('en-US')).toBe('en');
            expect(discordLocaleToLocaleCode('en-GB')).toBe('en');
        });

        it('should map Japanese locale', () => {
            expect(discordLocaleToLocaleCode('ja')).toBe('ja');
        });

        it('should map German locale', () => {
            expect(discordLocaleToLocaleCode('de')).toBe('de');
        });

        it('should map French locale', () => {
            expect(discordLocaleToLocaleCode('fr')).toBe('fr');
        });

        it('should map Korean locale', () => {
            expect(discordLocaleToLocaleCode('ko')).toBe('ko');
        });

        it('should map Chinese locales', () => {
            expect(discordLocaleToLocaleCode('zh-CN')).toBe('zh');
            expect(discordLocaleToLocaleCode('zh-TW')).toBe('zh');
        });

        it('should return null for unsupported Discord locales', () => {
            expect(discordLocaleToLocaleCode('es-ES')).toBeNull();
            expect(discordLocaleToLocaleCode('pt-BR')).toBeNull();
            expect(discordLocaleToLocaleCode('ru')).toBeNull();
        });
    });

    describe('resolveUserLocale', () => {
        it('should prefer user preference over Discord locale', async () => {
            mockKV._store.set(`i18n:user:${mockUserId}`, 'ja');

            const result = await resolveUserLocale(mockKV, mockUserId, 'en-US');

            expect(result).toBe('ja');
        });

        it('should use Discord locale when no preference is set', async () => {
            const result = await resolveUserLocale(mockKV, mockUserId, 'de');

            expect(result).toBe('de');
        });

        it('should map Discord locale codes correctly', async () => {
            const result = await resolveUserLocale(mockKV, mockUserId, 'zh-CN');

            expect(result).toBe('zh');
        });

        it('should default to English when no preference and unsupported Discord locale', async () => {
            const result = await resolveUserLocale(mockKV, mockUserId, 'es-ES');

            expect(result).toBe('en');
        });

        it('should default to English when no preference and no Discord locale', async () => {
            const result = await resolveUserLocale(mockKV, mockUserId);

            expect(result).toBe('en');
        });
    });

    describe('initializeLocale', () => {
        it('should create instance and set locale', async () => {
            await initializeLocale('ja');

            expect(LocalizationService).toHaveBeenCalled();
            expect(mockSetLocale).toHaveBeenCalledWith('ja');
        });

        it('should fall back to English on error', async () => {
            mockSetLocale
                .mockRejectedValueOnce(new Error('Failed'))
                .mockResolvedValueOnce(undefined);

            await initializeLocale('invalid' as LocaleCode);

            expect(mockSetLocale).toHaveBeenLastCalledWith('en');
        });
    });

    describe('formatLocaleDisplay', () => {
        it('should format locale for display', () => {
            expect(formatLocaleDisplay('en')).toBe('🇺🇸 English (English)');
            expect(formatLocaleDisplay('ja')).toBe('🇯🇵 Japanese (日本語)');
            expect(formatLocaleDisplay('de')).toBe('🇩🇪 German (Deutsch)');
            expect(formatLocaleDisplay('fr')).toBe('🇫🇷 French (Français)');
            expect(formatLocaleDisplay('ko')).toBe('🇰🇷 Korean (한국어)');
            expect(formatLocaleDisplay('zh')).toBe('🇨🇳 Chinese (中文)');
        });

        it('should return code for unknown locale', () => {
            const result = formatLocaleDisplay('invalid' as LocaleCode);
            expect(result).toBe('invalid');
        });
    });

    describe('getLocalizedDyeName', () => {
        it('should return localized dye name', async () => {
            await initializeLocale('en');
            const result = getLocalizedDyeName(5729, 'Fallback');
            expect(result).toBe('Snow White');
        });

        it('should return fallback when localization fails', async () => {
            await initializeLocale('en');
            const result = getLocalizedDyeName(9999, 'Unknown Dye');
            expect(result).toBe('Unknown Dye');
        });

        it('should return fallback on error', async () => {
            await initializeLocale('en');
            mockGetDyeName.mockImplementationOnce(() => {
                throw new Error('Error');
            });

            const result = getLocalizedDyeName(5729, 'Fallback');
            expect(result).toBe('Fallback');
        });
    });

    describe('getLocalizedCategory', () => {
        it('should return localized category name', async () => {
            await initializeLocale('en');
            const result = getLocalizedCategory('Reds');
            expect(result).toBe('Localized_Reds');
        });

        it('should return original category on error', async () => {
            await initializeLocale('en');
            mockGetCategory.mockImplementationOnce(() => {
                throw new Error('Error');
            });

            const result = getLocalizedCategory('Blues');
            expect(result).toBe('Blues');
        });
    });

    // ==========================================================================
    // Logger Coverage Tests
    // ==========================================================================

});
