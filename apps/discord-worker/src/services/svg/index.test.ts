/**
 * Tests for SVG services index exports
 */
import { describe, it, expect, vi } from 'vitest';

// Mock resvg-wasm
vi.mock('@resvg/resvg-wasm', () => ({
    initWasm: vi.fn().mockResolvedValue(undefined),
    Resvg: vi.fn().mockImplementation(() => ({
        render: () => ({
            asPng: () => new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
        }),
    })),
}));

vi.mock('@resvg/resvg-wasm/index_bg.wasm', () => ({}));

vi.mock('../fonts', () => ({
    getFontBuffers: () => [],
}));

describe('svg/index exports', () => {
    it('exports base SVG functions', async () => {
        const svg = await import('./index.js');

        expect(svg.createSvgDocument).toBeDefined();
        expect(typeof svg.createSvgDocument).toBe('function');
    });

    it('exports harmony wheel generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateHarmonyWheel).toBeDefined();
        expect(typeof svg.generateHarmonyWheel).toBe('function');
    });

    it('exports gradient generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateGradientBar).toBeDefined();
        expect(typeof svg.generateGradientBar).toBe('function');

        expect(svg.generateGradientColors).toBeDefined();
        expect(typeof svg.generateGradientColors).toBe('function');
    });

    it('exports palette grid generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generatePaletteGrid).toBeDefined();
        expect(typeof svg.generatePaletteGrid).toBe('function');
    });

    it('exports accessibility comparison generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateAccessibilityComparison).toBeDefined();
        expect(typeof svg.generateAccessibilityComparison).toBe('function');
    });

    it('exports contrast matrix generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateContrastMatrix).toBeDefined();
        expect(typeof svg.generateContrastMatrix).toBe('function');
    });

    it('exports renderer functions', async () => {
        const svg = await import('./index.js');

        expect(svg.initRenderer).toBeDefined();
        expect(typeof svg.initRenderer).toBe('function');

        expect(svg.renderSvgToPng).toBeDefined();
        expect(typeof svg.renderSvgToPng).toBe('function');

        expect(svg.renderSvgToDataUrl).toBeDefined();
        expect(typeof svg.renderSvgToDataUrl).toBe('function');
    });
});
