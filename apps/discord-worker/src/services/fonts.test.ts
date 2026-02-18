/**
 * Tests for Fonts Service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the font file imports before importing the module
vi.mock('../fonts/SpaceGrotesk-VariableFont_wght.ttf', () => ({
    default: new ArrayBuffer(100),
}));
vi.mock('../fonts/Onest-VariableFont_wght.ttf', () => ({
    default: new ArrayBuffer(200),
}));
vi.mock('../fonts/Habibi-Regular.ttf', () => ({
    default: new ArrayBuffer(150),
}));
// CJK font mocks
vi.mock('../fonts/NotoSansSC-Subset.ttf', () => ({
    default: new ArrayBuffer(222),
}));
vi.mock('../fonts/NotoSansKR-Subset.ttf', () => ({
    default: new ArrayBuffer(155),
}));

// Now import the module with mocked dependencies
import { getFontBuffers, FONT_FAMILIES } from './fonts.js';

describe('fonts.ts', () => {
    describe('FONT_FAMILIES', () => {
        it('should have correct font family names', () => {
            expect(FONT_FAMILIES.header).toBe('Space Grotesk');
            expect(FONT_FAMILIES.body).toBe('Onest');
            expect(FONT_FAMILIES.mono).toBe('Habibi');
        });
    });

    describe('getFontBuffers', () => {
        it('should return an array of Uint8Arrays', () => {
            const buffers = getFontBuffers();

            expect(Array.isArray(buffers)).toBe(true);
            expect(buffers).toHaveLength(5);

            for (const buffer of buffers) {
                expect(buffer).toBeInstanceOf(Uint8Array);
            }
        });

        it('should cache font buffers on subsequent calls', () => {
            const firstCall = getFontBuffers();
            const secondCall = getFontBuffers();

            // Same reference should be returned
            expect(firstCall).toBe(secondCall);
        });
    });
});
