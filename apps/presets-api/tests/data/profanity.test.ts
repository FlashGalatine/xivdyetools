/**
 * Profanity Data Tests
 */

import { describe, it, expect } from 'vitest';
import { profanityLists, type SupportedLocale } from '../../src/data/profanity/index';
import { enProfanity } from '../../src/data/profanity/en';
import { jaProfanity } from '../../src/data/profanity/ja';
import { deProfanity } from '../../src/data/profanity/de';
import { frProfanity } from '../../src/data/profanity/fr';
import { koProfanity } from '../../src/data/profanity/ko';
import { zhProfanity } from '../../src/data/profanity/zh';

describe('ProfanityData', () => {
    // ============================================
    // profanityLists Index
    // ============================================

    describe('profanityLists', () => {
        it('should export all supported locales', () => {
            const expectedLocales: SupportedLocale[] = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];

            expectedLocales.forEach((locale) => {
                expect(profanityLists[locale]).toBeDefined();
                expect(Array.isArray(profanityLists[locale])).toBe(true);
            });
        });

        it('should have entries for each locale', () => {
            expect(Object.keys(profanityLists)).toHaveLength(6);
        });

        it('should map English profanity correctly', () => {
            expect(profanityLists.en).toBe(enProfanity);
        });

        it('should map Japanese profanity correctly', () => {
            expect(profanityLists.ja).toBe(jaProfanity);
        });

        it('should map German profanity correctly', () => {
            expect(profanityLists.de).toBe(deProfanity);
        });

        it('should map French profanity correctly', () => {
            expect(profanityLists.fr).toBe(frProfanity);
        });

        it('should map Korean profanity correctly', () => {
            expect(profanityLists.ko).toBe(koProfanity);
        });

        it('should map Chinese profanity correctly', () => {
            expect(profanityLists.zh).toBe(zhProfanity);
        });
    });

    // ============================================
    // English Profanity List
    // Note: Lists are intentionally kept minimal/empty 
    // since Perspective API handles comprehensive filtering
    // ============================================

    describe('English Profanity (en)', () => {
        it('should be an array (may be empty as Perspective API handles filtering)', () => {
            expect(Array.isArray(enProfanity)).toBe(true);
        });

        it('should contain strings only if not empty', () => {
            enProfanity.forEach((word) => {
                expect(typeof word).toBe('string');
            });
        });

        it('should not contain empty strings if not empty', () => {
            enProfanity.forEach((word) => {
                expect(word.length).toBeGreaterThan(0);
            });
        });

        it('should be lowercase for consistent matching if not empty', () => {
            enProfanity.forEach((word) => {
                expect(word).toBe(word.toLowerCase());
            });
        });
    });

    // ============================================
    // Japanese Profanity List
    // ============================================

    describe('Japanese Profanity (ja)', () => {
        it('should be an array (may be empty as Perspective API handles filtering)', () => {
            expect(Array.isArray(jaProfanity)).toBe(true);
        });

        it('should contain strings only if not empty', () => {
            jaProfanity.forEach((word) => {
                expect(typeof word).toBe('string');
            });
        });

        it('should not contain empty strings if not empty', () => {
            jaProfanity.forEach((word) => {
                expect(word.length).toBeGreaterThan(0);
            });
        });
    });

    // ============================================
    // German Profanity List
    // ============================================

    describe('German Profanity (de)', () => {
        it('should be an array (may be empty as Perspective API handles filtering)', () => {
            expect(Array.isArray(deProfanity)).toBe(true);
        });

        it('should contain strings only if not empty', () => {
            deProfanity.forEach((word) => {
                expect(typeof word).toBe('string');
            });
        });

        it('should not contain empty strings if not empty', () => {
            deProfanity.forEach((word) => {
                expect(word.length).toBeGreaterThan(0);
            });
        });
    });

    // ============================================
    // French Profanity List
    // ============================================

    describe('French Profanity (fr)', () => {
        it('should be an array (may be empty as Perspective API handles filtering)', () => {
            expect(Array.isArray(frProfanity)).toBe(true);
        });

        it('should contain strings only if not empty', () => {
            frProfanity.forEach((word) => {
                expect(typeof word).toBe('string');
            });
        });

        it('should not contain empty strings if not empty', () => {
            frProfanity.forEach((word) => {
                expect(word.length).toBeGreaterThan(0);
            });
        });
    });

    // ============================================
    // Korean Profanity List
    // ============================================

    describe('Korean Profanity (ko)', () => {
        it('should be an array (may be empty as Perspective API handles filtering)', () => {
            expect(Array.isArray(koProfanity)).toBe(true);
        });

        it('should contain strings only if not empty', () => {
            koProfanity.forEach((word) => {
                expect(typeof word).toBe('string');
            });
        });

        it('should not contain empty strings if not empty', () => {
            koProfanity.forEach((word) => {
                expect(word.length).toBeGreaterThan(0);
            });
        });
    });

    // ============================================
    // Chinese Profanity List
    // ============================================

    describe('Chinese Profanity (zh)', () => {
        it('should be an array (may be empty as Perspective API handles filtering)', () => {
            expect(Array.isArray(zhProfanity)).toBe(true);
        });

        it('should contain strings only if not empty', () => {
            zhProfanity.forEach((word) => {
                expect(typeof word).toBe('string');
            });
        });

        it('should not contain empty strings if not empty', () => {
            zhProfanity.forEach((word) => {
                expect(word.length).toBeGreaterThan(0);
            });
        });
    });

    // ============================================
    // No Duplicates (only matters if lists have content)
    // ============================================

    describe('Duplicate Prevention', () => {
        Object.entries(profanityLists).forEach(([locale, words]) => {
            it(`should have no duplicate words in ${locale} if list has content`, () => {
                if (words.length > 0) {
                    const unique = new Set(words.map((w) => w.toLowerCase()));
                    expect(unique.size).toBe(words.length);
                } else {
                    expect(words.length).toBe(0); // Pass for empty arrays
                }
            });
        });
    });

    // ============================================
    // Type Safety
    // ============================================

    describe('Type Safety', () => {
        it('SupportedLocale type should match available keys', () => {
            const locales: SupportedLocale[] = ['en', 'ja', 'de', 'fr', 'ko', 'zh'];

            locales.forEach((locale) => {
                expect(profanityLists[locale]).toBeDefined();
            });
        });
    });
});
