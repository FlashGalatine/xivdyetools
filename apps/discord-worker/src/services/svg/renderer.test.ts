/**
 * Tests for SVG to PNG renderer service
 * 
 * Note: The actual renderer depends on WASM which is hard to mock.
 * These tests verify the module structure and export correctness.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@resvg/resvg-wasm', () => ({
    initWasm: vi.fn().mockResolvedValue(undefined),
    Resvg: class MockResvg {
        render() {
            return {
                asPng: () => new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
            };
        }
    },
}));

vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({
    default: new Uint8Array([0x00, 0x61, 0x73, 0x6D]),
}));

vi.mock('../fonts', () => ({
    getFontBuffers: vi.fn(() => [new Uint8Array([1, 2, 3])]),
}));

describe('SVG renderer', () => {
    describe('initRenderer', () => {
        it('exports initRenderer function', async () => {
            const { initRenderer } = await import('./renderer.js');
            expect(initRenderer).toBeDefined();
            expect(typeof initRenderer).toBe('function');
        });
    });

    describe('renderSvgToPng', () => {
        it('exports renderSvgToPng function', async () => {
            const { renderSvgToPng } = await import('./renderer.js');
            expect(renderSvgToPng).toBeDefined();
            expect(typeof renderSvgToPng).toBe('function');
        });
    });

    describe('renderSvgToDataUrl', () => {
        it('exports renderSvgToDataUrl function', async () => {
            const { renderSvgToDataUrl } = await import('./renderer.js');
            expect(renderSvgToDataUrl).toBeDefined();
            expect(typeof renderSvgToDataUrl).toBe('function');
        });
    });
});
