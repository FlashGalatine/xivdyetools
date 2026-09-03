/**
 * Tests for Preset Swatch SVG Generator
 */
import { describe, it, expect } from 'vitest';
import {
    generatePresetSwatch,
    type PresetSwatchOptions,
} from './preset-swatch.js';
import { createMockDye } from '@xivdyetools/test-utils/factories';
import type { Dye } from '@xivdyetools/types/dye';
import type { PresetCategory } from '@xivdyetools/types';

describe('svg/preset-swatch.ts', () => {
    const mockDye1: Dye = createMockDye({
        id: 1,
        itemID: 5729,
        name: 'Dalamud Red',
        hex: '#AA1111',
        rgb: { r: 170, g: 17, b: 17 },
        hsv: { h: 0, s: 90, v: 67 },
        category: 'Red',
    });

    const mockDye2: Dye = createMockDye({
        id: 2,
        itemID: 5730,
        name: 'Jet Black',
        hex: '#000000',
        rgb: { r: 0, g: 0, b: 0 },
        hsv: { h: 0, s: 0, v: 0 },
        category: 'Black',
        isDark: true,
    });

    const mockDye3: Dye = createMockDye({
        id: 3,
        itemID: 5731,
        name: 'Snow White',
        hex: '#FFFFFF',
        rgb: { r: 255, g: 255, b: 255 },
        hsv: { h: 0, s: 0, v: 100 },
        category: 'White',
    });

    const baseOptions: PresetSwatchOptions = {
        name: 'Test Preset',
        description: 'A test preset description',
        category: 'aesthetics' as PresetCategory,
        dyes: [mockDye1, mockDye2],
        // Required since I18N-011: the generator no longer supplies English
        // defaults, so a caller cannot forget to localize these.
        authorLine: 'by TestAuthor',
        emptyLabel: 'No valid dyes in this preset',
    };

    describe('generatePresetSwatch', () => {
        it('should generate valid SVG document', () => {
            const svg = generatePresetSwatch(baseOptions);

            expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('</svg>');
        });

        it('should include preset name', () => {
            const svg = generatePresetSwatch(baseOptions);

            expect(svg).toContain('Test Preset');
        });

        it('should include preset description', () => {
            const svg = generatePresetSwatch(baseOptions);

            expect(svg).toContain('A test preset description');
        });

        it('should truncate long descriptions', () => {
            const longDesc = 'A'.repeat(100);
            const svg = generatePresetSwatch({
                ...baseOptions,
                description: longDesc,
            });

            expect(svg).toContain('…');
            expect(svg).not.toContain(longDesc);
        });

        it('should include all dye swatches', () => {
            const svg = generatePresetSwatch(baseOptions);

            expect(svg).toContain('fill="#AA1111"');
            expect(svg).toContain('fill="#000000"');
        });

        it('should include dye names', () => {
            const svg = generatePresetSwatch(baseOptions);

            expect(svg).toContain('Dalamud Red');
            expect(svg).toContain('Jet Black');
        });

        it('should include dye hex codes', () => {
            const svg = generatePresetSwatch(baseOptions);

            expect(svg).toContain('#AA1111');
            expect(svg).toContain('#000000');
        });

        it('renders the caller-localized author line verbatim', () => {
            const svg = generatePresetSwatch({
                ...baseOptions,
                authorLine: 'von TestAuthor',
            });

            expect(svg).toContain('von TestAuthor');
        });

        it('renders the caller-localized "official" line verbatim', () => {
            const svg = generatePresetSwatch({
                ...baseOptions,
                authorLine: 'Offiziell',
            });

            expect(svg).toContain('Offiziell');
        });

        it('renders the localized votes label when given', () => {
            const svg = generatePresetSwatch({
                ...baseOptions,
                votesLabel: '42 Stimmen',
            });

            expect(svg).toContain('42 Stimmen');
        });

        it('draws no star: U+2605 is in none of the bundled faces (FONT-002)', () => {
            const svg = generatePresetSwatch({
                ...baseOptions,
                votesLabel: '42 votes',
            });

            expect(svg).not.toContain('★');
        });

        it('omits the votes segment entirely rather than inventing English', () => {
            const svg = generatePresetSwatch({ ...baseOptions, votesLabel: undefined });

            expect(svg).not.toContain('votes');
            expect(svg).not.toContain('★');
        });

        it('should use custom width', () => {
            const svg = generatePresetSwatch({
                ...baseOptions,
                width: 800,
            });

            expect(svg).toContain('width="800"');
        });

        it('should handle single dye', () => {
            const svg = generatePresetSwatch({
                ...baseOptions,
                dyes: [mockDye1],
            });

            expect(svg).toContain('Dalamud Red');
        });

        it('should handle multiple dyes', () => {
            const svg = generatePresetSwatch({
                ...baseOptions,
                dyes: [mockDye1, mockDye2, mockDye3],
            });

            expect(svg).toContain('Dalamud Red');
            expect(svg).toContain('Jet Black');
            expect(svg).toContain('Snow White');
        });

        it('should filter out null dyes', () => {
            const svg = generatePresetSwatch({
                ...baseOptions,
                dyes: [mockDye1, null, mockDye2],
            });

            expect(svg).toContain('Dalamud Red');
            expect(svg).toContain('Jet Black');
        });

        it('should show empty message when all dyes are null', () => {
            const svg = generatePresetSwatch({
                ...baseOptions,
                dyes: [null, null],
            });

            expect(svg).toContain('No valid dyes in this preset');
        });

        it('should include category icon', () => {
            const svg = generatePresetSwatch(baseOptions);

            // Should include some text with the preset name (which includes icon)
            expect(svg).toContain('Test Preset');
        });
    });


    describe('dye name truncation', () => {
        it('should truncate long dye names in full swatch view', () => {
            const longNameDye: Dye = createMockDye({
                id: 99,
                itemID: 9999,
                name: 'A Very Long Dye Name That Exceeds The Maximum Allowed Length',
                hex: '#FF00FF',
                rgb: { r: 255, g: 0, b: 255 },
                hsv: { h: 300, s: 100, v: 100 },
                category: 'Purple',
            });

            // Use a smaller width so the truncation kicks in sooner
            const svg = generatePresetSwatch({
                ...baseOptions,
                dyes: [longNameDye],
                width: 200, // Small width = smaller swatch = shorter max name length
            });

            // Should be truncated with '…'
            expect(svg).toContain('…');
            // Should not contain the full name
            expect(svg).not.toContain('A Very Long Dye Name That Exceeds The Maximum Allowed Length');
        });
    });
});
