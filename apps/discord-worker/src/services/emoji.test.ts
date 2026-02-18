/**
 * Tests for Emoji Service
 */
import { describe, it, expect, vi } from 'vitest';
import {
    getDyeEmoji,
    getDyeEmojiOrFallback,
    hasDyeEmoji,
    getEmojiCount,
} from './emoji.js';

// Mock the emoji mapping JSON
vi.mock('../data/emoji-mapping.json', () => ({
    default: {
        '5729': '<:snow_white:123456789>',
        '5730': '<:soot_black:987654321>',
        '5731': '<:dalamud_red:111222333>',
    },
}));

describe('emoji.ts', () => {
    describe('getDyeEmoji', () => {
        it('should return emoji string for known dye', () => {
            expect(getDyeEmoji(5729)).toBe('<:snow_white:123456789>');
            expect(getDyeEmoji(5730)).toBe('<:soot_black:987654321>');
        });

        it('should return undefined for unknown dye', () => {
            expect(getDyeEmoji(9999)).toBeUndefined();
            expect(getDyeEmoji(0)).toBeUndefined();
        });
    });

    describe('getDyeEmojiOrFallback', () => {
        it('should return emoji string for known dye', () => {
            expect(getDyeEmojiOrFallback(5729)).toBe('<:snow_white:123456789>');
        });

        it('should return fallback emoji for unknown dye', () => {
            expect(getDyeEmojiOrFallback(9999)).toBe('🎨');
            expect(getDyeEmojiOrFallback(9999, '#ff0000')).toBe('🎨');
        });
    });

    describe('hasDyeEmoji', () => {
        it('should return true for dyes with emoji', () => {
            expect(hasDyeEmoji(5729)).toBe(true);
            expect(hasDyeEmoji(5730)).toBe(true);
            expect(hasDyeEmoji(5731)).toBe(true);
        });

        it('should return false for dyes without emoji', () => {
            expect(hasDyeEmoji(9999)).toBe(false);
            expect(hasDyeEmoji(0)).toBe(false);
        });
    });

    describe('getEmojiCount', () => {
        it('should return the count of available emoji mappings', () => {
            expect(getEmojiCount()).toBe(3);
        });
    });
});
