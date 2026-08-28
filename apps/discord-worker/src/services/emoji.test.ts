/**
 * Tests for Emoji Service (5.0 — stainID-keyed generated set)
 *
 * Discord application emoji are owned by the application that uploaded them:
 * a bot can only render its OWN application's emoji, and Discord degrades any
 * others to their literal `:name:` text. The beta bot is a second application,
 * so the mapping is keyed by application ID and the lookup must select the
 * caller's slot.
 */
import { describe, it, expect, vi } from 'vitest';
import { getDyeEmoji } from './emoji.js';

const PROD_APP = '1447108133020369048';
const BETA_APP = '1536085517270261771';

// Mock the emoji mapping JSON (artwork tag + per-application stainID keys)
vi.mock('../data/emoji-mapping.json', () => ({
    default: {
        byApplication: {
            '1447108133020369048': {
                artwork: 'chip-1',
                byStainId: {
                    '1': '<:snow_white:123456789>',
                    '6': '<:soot_black:987654321>',
                    '43': '<:dalamud_red:111222333>',
                },
            },
            '1536085517270261771': {
                artwork: 'chip-1',
                byStainId: {
                    '1': '<:snow_white:555000111>',
                    '6': '<:soot_black:555000222>',
                },
            },
        },
    },
}));

describe('emoji.ts', () => {
    describe('getDyeEmoji', () => {
        it('returns the requesting application’s own emoji markup', () => {
            expect(getDyeEmoji(1, PROD_APP)).toBe('<:snow_white:123456789>');
            expect(getDyeEmoji(6, PROD_APP)).toBe('<:soot_black:987654321>');
        });

        it('returns a different application’s own IDs for the same stainID', () => {
            // The whole point of the per-application shape: the beta bot must
            // never be handed production's IDs, which it cannot render.
            expect(getDyeEmoji(1, BETA_APP)).toBe('<:snow_white:555000111>');
            expect(getDyeEmoji(1, BETA_APP)).not.toBe(getDyeEmoji(1, PROD_APP));
        });

        it('returns undefined for unknown stainIDs (incl. the Facewear 0)', () => {
            expect(getDyeEmoji(9999, PROD_APP)).toBeUndefined();
            expect(getDyeEmoji(0, PROD_APP)).toBeUndefined();
        });

        it('returns undefined for an application with no uploaded set', () => {
            // Degrading to no emoji is correct. Falling back to another
            // application's markup is what produced naked `:name:` text in
            // the beta bot's cards.
            expect(getDyeEmoji(1, '999999999999999999')).toBeUndefined();
        });

        it('returns undefined when the application ID is absent', () => {
            expect(getDyeEmoji(1, undefined as unknown as string)).toBeUndefined();
            expect(getDyeEmoji(1, '')).toBeUndefined();
        });

        it('never returns bare :name: markup for a stainID it knows', () => {
            // A guard on the shape itself: every value must be full
            // <:name:id> markup, since bare :name: is exactly the bug.
            const markup = getDyeEmoji(43, PROD_APP);
            expect(markup).toMatch(/^<:[a-z0-9_]+:\d+>$/);
        });
    });
});
