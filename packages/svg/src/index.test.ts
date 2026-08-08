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

    it('exports the harmony card generator and the frame system', async () => {
        const svg = await import('./index.js');

        expect(svg.generateHarmonyCard).toBeDefined();
        expect(typeof svg.generateHarmonyCard).toBe('function');
        expect(svg.CARD_WIDTH).toBe(400);
        expect(svg.CARD_MAX_HEIGHT).toBe(350);
        expect(svg.ROW_CAP).toBe(5);
        expect(svg.CARD_DARK).toBeDefined();
        expect(svg.CARD_LIGHT).toBeDefined();
    });

    it('exports gradient generator', async () => {
        const svg = await import('./index.js');

        expect(svg.generateGradientCard).toBeDefined();
        expect(typeof svg.generateGradientCard).toBe('function');

        expect(svg.generateMixerCard).toBeDefined();
        expect(typeof svg.generateMixerCard).toBe('function');

        expect(svg.generateGradientColors).toBeDefined();
        expect(typeof svg.generateGradientColors).toBe('function');

        expect(svg.interpolateColor).toBeDefined();
        expect(typeof svg.interpolateColor).toBe('function');
    });

    it('exports the extractor generators and the measured row', async () => {
        const svg = await import('./index.js');

        expect(svg.generatePaletteGrid).toBeDefined();
        expect(typeof svg.generatePaletteGrid).toBe('function');

        expect(svg.generateNearestSheet).toBeDefined();
        expect(typeof svg.generateNearestSheet).toBe('function');

        expect(svg.measuredRow).toBeDefined();
        expect(typeof svg.measuredRow).toBe('function');
    });

    it('exports the accessibility card generator (13D/13E/13H)', async () => {
        const svg = await import('./index.js');

        expect(svg.generateA11yCard).toBeDefined();
        expect(typeof svg.generateA11yCard).toBe('function');
    });

    it('exports the contrast card generator (13A/13B/13C·1)', async () => {
        const svg = await import('./index.js');

        expect(svg.generateContrastCard).toBeDefined();
        expect(typeof svg.generateContrastCard).toBe('function');

        expect(svg.contrastRatio).toBeDefined();
        expect(svg.contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
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

        expect(svg.CATEGORY_DISPLAY).toBeDefined();
        expect(typeof svg.CATEGORY_DISPLAY).toBe('object');
    });

    it('exports budget comparison generators', async () => {
        const svg = await import('./index.js');

        expect(svg.generateBudgetComparison).toBeDefined();
        expect(typeof svg.generateBudgetComparison).toBe('function');

        expect(svg.formatGil).toBeDefined();
        expect(typeof svg.formatGil).toBe('function');
    });
});
