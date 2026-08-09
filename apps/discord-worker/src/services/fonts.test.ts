/**
 * Tests for Fonts Service
 */
import { describe, it, expect, vi } from 'vitest';

// Mock the font file imports before importing the module.
//
// DEAD-005: this list must mirror the `.ttf` imports in fonts.ts exactly.
// Vitest resolves an *unmocked* .ttf through Vite's asset pipeline to a URL
// string, and `new Uint8Array('<string>')` coerces to NaN — yielding a
// zero-length buffer instead of throwing. A missing mock is therefore silent,
// and a stale one (this file mocked the long-deleted Habibi-Regular.ttf) is
// silent too. The byte lengths below are distinct so the assertions can prove
// every font actually arrived.
vi.mock('../fonts/SpaceGrotesk-VariableFont_wght.ttf', () => ({
    default: new ArrayBuffer(100),
}));
vi.mock('../fonts/Onest-VariableFont_wght.ttf', () => ({
    default: new ArrayBuffer(200),
}));
vi.mock('../fonts/FragmentMono-Regular.ttf', () => ({
    default: new ArrayBuffer(175),
}));
// CJK font mocks
vi.mock('../fonts/NotoSansSC-Subset.ttf', () => ({
    default: new ArrayBuffer(222),
}));
vi.mock('../fonts/NotoSansKR-Subset.ttf', () => ({
    default: new ArrayBuffer(155),
}));
vi.mock('../fonts/NotoSansJP-Subset.ttf', () => ({
    default: new ArrayBuffer(188),
}));

// Now import the module with mocked dependencies
import { getFontBuffers, FONT_FAMILIES } from './fonts.js';

describe('fonts.ts', () => {
    describe('FONT_FAMILIES', () => {
        it('should have correct font family names', () => {
            expect(FONT_FAMILIES.header).toBe('Space Grotesk');
            expect(FONT_FAMILIES.body).toBe('Onest');
            expect(FONT_FAMILIES.mono).toBe('Fragment Mono');
        });
    });

    describe('getFontBuffers', () => {
        it('should return an array of Uint8Arrays', () => {
            const buffers = getFontBuffers();

            expect(Array.isArray(buffers)).toBe(true);
            expect(buffers).toHaveLength(6);

            for (const buffer of buffers) {
                expect(buffer).toBeInstanceOf(Uint8Array);
            }
        });

        it('carries the bytes of every declared font, in import order', () => {
            // DEAD-005: `toBeInstanceOf(Uint8Array)` passes for a zero-length
            // buffer, so it cannot tell a mocked font from an unmocked one.
            // Asserting the exact byte lengths is what makes a drifted mock
            // list fail loudly instead of silently rendering nothing.
            expect(getFontBuffers().map((b) => b.byteLength)).toEqual([
                100, // Space Grotesk
                200, // Onest
                175, // Fragment Mono
                222, // Noto Sans SC
                155, // Noto Sans KR
                188, // Noto Sans JP
            ]);
        });

        it('should cache font buffers on subsequent calls', () => {
            const firstCall = getFontBuffers();
            const secondCall = getFontBuffers();

            // Same reference should be returned
            expect(firstCall).toBe(secondCall);
        });
    });
});
