/**
 * Tests for @xivdyetools/svg index exports
 *
 * Verifies that all SVG generator functions and utilities
 * are properly exported from the package entry point.
 */
import { describe, it, expect } from 'vitest';

describe('@xivdyetools/svg index exports', () => {
    it('exports base SVG utilities', async () => {
        const svg = await import('./index.js');

        expect(svg.createSvgDocument).toBeDefined();
        expect(typeof svg.createSvgDocument).toBe('function');
        expect(svg.escapeXml).toBeDefined();
        expect(svg.hexToRgb).toBeDefined();
        expect(svg.rgbToHex).toBeDefined();
        expect(svg.THEME).toBeDefined();
        expect(svg.FONTS).toBeDefined();
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

        expect(svg.interpolateColor).toBeDefined();
        expect(typeof svg.interpolateColor).toBe('function');
    });

    it('exports palette grid generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generatePaletteGrid).toBeDefined();
        expect(typeof svg.generatePaletteGrid).toBe('function');

        expect(svg.getMatchQuality).toBeDefined();
        expect(typeof svg.getMatchQuality).toBe('function');

        expect(svg.MATCH_QUALITIES).toBeDefined();
        expect(Array.isArray(svg.MATCH_QUALITIES)).toBe(true);
    });

    it('exports accessibility comparison generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateAccessibilityComparison).toBeDefined();
        expect(typeof svg.generateAccessibilityComparison).toBe('function');

        expect(svg.generateCompactAccessibilityRow).toBeDefined();
        expect(typeof svg.generateCompactAccessibilityRow).toBe('function');
    });

    it('exports contrast matrix generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateContrastMatrix).toBeDefined();
        expect(typeof svg.generateContrastMatrix).toBe('function');

        expect(svg.calculateContrast).toBeDefined();
        expect(typeof svg.calculateContrast).toBe('function');
    });

    it('exports random dyes grid generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateRandomDyesGrid).toBeDefined();
        expect(typeof svg.generateRandomDyesGrid).toBe('function');
    });

    it('exports comparison grid generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateComparisonGrid).toBeDefined();
        expect(typeof svg.generateComparisonGrid).toBe('function');
    });

    it('exports dye info card generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateDyeInfoCard).toBeDefined();
        expect(typeof svg.generateDyeInfoCard).toBe('function');
    });

    it('exports preset swatch generators', async () => {
        const svg = await import('./index.js');

        expect(svg.generatePresetSwatch).toBeDefined();
        expect(typeof svg.generatePresetSwatch).toBe('function');

        expect(svg.generateCompactPresetSwatch).toBeDefined();
        expect(typeof svg.generateCompactPresetSwatch).toBe('function');

        expect(svg.CATEGORY_DISPLAY).toBeDefined();
        expect(typeof svg.CATEGORY_DISPLAY).toBe('object');
    });

    it('exports budget comparison generators', async () => {
        const svg = await import('./index.js');

        expect(svg.generateBudgetComparison).toBeDefined();
        expect(typeof svg.generateBudgetComparison).toBe('function');

        expect(svg.generateNoWorldSetSvg).toBeDefined();
        expect(typeof svg.generateNoWorldSetSvg).toBe('function');

        expect(svg.generateErrorSvg).toBeDefined();
        expect(typeof svg.generateErrorSvg).toBe('function');

        expect(svg.formatGil).toBeDefined();
        expect(typeof svg.formatGil).toBe('function');
    });
});
