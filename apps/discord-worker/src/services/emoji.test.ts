/**
 * Tests for Emoji Service (5.0 — stainID-keyed generated set)
 */
import { describe, it, expect, vi } from 'vitest';
import { getDyeEmoji } from './emoji.js';

// Mock the emoji mapping JSON (5.0 shape: artwork tag + stainID keys)
vi.mock('../data/emoji-mapping.json', () => ({
    default: {
        artwork: 'chip-1',
        byStainId: {
            '1': '<:snow_white:123456789>',
            '6': '<:soot_black:987654321>',
            '43': '<:dalamud_red:111222333>',
        },
    },
}));

describe('emoji.ts', () => {
    describe('getDyeEmoji', () => {
        it('returns emoji markup for a known stainID', () => {
            expect(getDyeEmoji(1)).toBe('<:snow_white:123456789>');
            expect(getDyeEmoji(6)).toBe('<:soot_black:987654321>');
        });

        it('returns undefined for unknown stainIDs (incl. the Facewear 0)', () => {
            expect(getDyeEmoji(9999)).toBeUndefined();
            expect(getDyeEmoji(0)).toBeUndefined();
        });
    });
});
