/**
 * Tests for Emoji Service
 */
import { describe, it, expect, vi } from 'vitest';
import { getDyeEmoji } from './emoji.js';

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


});
