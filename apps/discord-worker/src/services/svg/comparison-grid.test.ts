/**
 * Tests for Comparison Grid SVG Generator
 */
import { describe, it, expect } from 'vitest';
import { generateComparisonGrid, type ComparisonGridOptions } from './comparison-grid.js';
import { createMockDye } from '@xivdyetools/test-utils/factories';
import type { Dye } from '@xivdyetools/types/dye';

describe('svg/comparison-grid.ts', () => {
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
        hex: '#0A0A0A',
        rgb: { r: 10, g: 10, b: 10 },
        hsv: { h: 0, s: 0, v: 4 },
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

    const mockDye4: Dye = createMockDye({
        id: 4,
        itemID: 5732,
        name: 'Metallic Gold',
        hex: '#FFD700',
        rgb: { r: 255, g: 215, b: 0 },
        hsv: { h: 51, s: 100, v: 100 },
        category: 'Yellow',
        isMetallic: true,
    });

    describe('generateComparisonGrid', () => {
        it('should generate valid SVG document', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2] });

            expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('</svg>');
        });

        it('should show error message for less than 2 dyes', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1] });

            expect(svg).toContain('at least 2 dyes');
        });

        it('should include title', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2] });

            expect(svg).toContain('Dye Comparison');
        });

        it('should include all dye names', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2, mockDye3] });

            expect(svg).toContain('Dalamud Red');
            expect(svg).toContain('Jet Black');
            expect(svg).toContain('Snow White');
        });

        it('should include all dye hex codes', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2] });

            expect(svg).toContain('#AA1111');
            expect(svg).toContain('#0A0A0A');
        });

        it('should include dye categories', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2] });

            expect(svg).toContain('Red');
            expect(svg).toContain('Black');
        });

        it('should include RGB values', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2] });

            expect(svg).toContain('RGB(');
        });

        it('should include HSV values when showHsv is true (default)', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2], showHsv: true });

            expect(svg).toContain('HSV(');
        });

        it('should hide HSV values when showHsv is false', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2], showHsv: false });

            expect(svg).not.toContain('HSV(');
        });

        it('should include color analysis section', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2] });

            expect(svg).toContain('Color Analysis');
        });

        it('should include most similar and most different comparisons', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2, mockDye3] });

            expect(svg).toContain('Most Similar');
            expect(svg).toContain('Most Different');
        });

        it('should include distance values', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2] });

            expect(svg).toContain('Distance:');
        });

        it('should include contrast ratio', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2] });

            expect(svg).toContain('Contrast:');
            expect(svg).toContain(':1');
        });

        it('should use custom width', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2], width: 1000 });

            expect(svg).toContain('width="1000"');
        });

        it('should handle 4 dyes', () => {
            const svg = generateComparisonGrid({
                dyes: [mockDye1, mockDye2, mockDye3, mockDye4],
            });

            expect(svg).toContain('Dalamud Red');
            expect(svg).toContain('Jet Black');
            expect(svg).toContain('Snow White');
            expect(svg).toContain('Metallic Gold');
        });

        it('should include color swatches', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2] });

            // Color swatches include fill attributes with the dye colors
            expect(svg).toContain('fill="#AA1111"');
            expect(svg).toContain('fill="#0A0A0A"');
        });

        it('should include index numbers', () => {
            const svg = generateComparisonGrid({ dyes: [mockDye1, mockDye2, mockDye3] });

            // Index circles with numbers
            expect(svg).toContain('>1<');
            expect(svg).toContain('>2<');
            expect(svg).toContain('>3<');
        });

        it('should handle blue-dominant color (max === b branch in rgbToHsv)', () => {
            // Blue dye to hit max === b branch in rgbToHsv
            const blueDye: Dye = createMockDye({
                id: 10,
                itemID: 5740,
                name: 'Pure Blue',
                hex: '#0000FF',
                rgb: { r: 0, g: 0, b: 255 },
                hsv: { h: 240, s: 100, v: 100 },
                category: 'Blue',
            });

            const svg = generateComparisonGrid({ dyes: [blueDye, mockDye2] });

            expect(svg).toContain('Pure Blue');
            expect(svg).toContain('#0000FF');
        });

        it('should handle green-dominant color (max === g branch in rgbToHsv)', () => {
            // Green dye to hit max === g branch in rgbToHsv
            const greenDye: Dye = createMockDye({
                id: 11,
                itemID: 5741,
                name: 'Pure Green',
                hex: '#00FF00',
                rgb: { r: 0, g: 255, b: 0 },
                hsv: { h: 120, s: 100, v: 100 },
                category: 'Green',
            });

            const svg = generateComparisonGrid({ dyes: [greenDye, mockDye1] });

            expect(svg).toContain('Pure Green');
            expect(svg).toContain('#00FF00');
        });

        it('should handle achromatic colors (max === min in rgbToHsv)', () => {
            // Gray dye where r === g === b (achromatic)
            const grayDye: Dye = createMockDye({
                id: 12,
                itemID: 5742,
                name: 'Pure Gray',
                hex: '#808080',
                rgb: { r: 128, g: 128, b: 128 },
                hsv: { h: 0, s: 0, v: 50 },
                category: 'Gray',
            });

            const svg = generateComparisonGrid({ dyes: [grayDye, mockDye3] });

            expect(svg).toContain('Pure Gray');
            expect(svg).toContain('#808080');
        });

        it('should show AAA contrast rating for high contrast', () => {
            // Black and white have very high contrast (ratio > 7)
            const svg = generateComparisonGrid({ dyes: [mockDye2, mockDye3] }); // Jet Black and Snow White

            // The contrast ratio between black and white should be AAA
            expect(svg).toContain('AAA');
        });

        it('should show different contrast ratings based on color pairs', () => {
            // Test with colors that have different contrast levels
            const mediumContrastDye: Dye = createMockDye({
                id: 13,
                itemID: 5743,
                name: 'Medium Gray',
                hex: '#6B6B6B',
                rgb: { r: 107, g: 107, b: 107 },
                hsv: { h: 0, s: 0, v: 42 },
                category: 'Gray',
            });

            const svg = generateComparisonGrid({ dyes: [mediumContrastDye, mockDye3] });

            // Should contain some contrast rating
            expect(svg).toContain('Contrast:');
        });

        it('should handle pure black color (max === 0 in rgbToHsv)', () => {
            // Pure black where r=g=b=0 (max === 0)
            const blackDye: Dye = createMockDye({
                id: 14,
                itemID: 5744,
                name: 'Pure Black',
                hex: '#000000',
                rgb: { r: 0, g: 0, b: 0 },
                hsv: { h: 0, s: 0, v: 0 },
                category: 'Black',
                isDark: true,
            });

            const svg = generateComparisonGrid({ dyes: [blackDye, mockDye3] });

            expect(svg).toContain('Pure Black');
            expect(svg).toContain('#000000');
        });

        it('should handle red-dominant color (max === r branch in rgbToHsv)', () => {
            // Pure red dye to hit max === r branch in rgbToHsv
            const redDye: Dye = createMockDye({
                id: 15,
                itemID: 5745,
                name: 'Pure Red',
                hex: '#FF0000',
                rgb: { r: 255, g: 0, b: 0 },
                hsv: { h: 0, s: 100, v: 100 },
                category: 'Red',
            });

            const svg = generateComparisonGrid({ dyes: [redDye, mockDye2] });

            expect(svg).toContain('Pure Red');
            expect(svg).toContain('#FF0000');
        });

        it('should use success color for very similar colors (distance < 30)', () => {
            // Two very similar red colors
            const red1: Dye = createMockDye({
                id: 16,
                itemID: 5746,
                name: 'Red One',
                hex: '#FF0000',
                rgb: { r: 255, g: 0, b: 0 },
                hsv: { h: 0, s: 100, v: 100 },
                category: 'Red',
            });
            const red2: Dye = createMockDye({
                id: 17,
                itemID: 5747,
                name: 'Red Two',
                hex: '#FF1010', // Very similar to red1
                rgb: { r: 255, g: 16, b: 16 },
                hsv: { h: 0, s: 94, v: 100 },
                category: 'Red',
            });

            const svg = generateComparisonGrid({ dyes: [red1, red2] });

            // Distance < 30 should use success color (#57f287)
            expect(svg).toContain('#57f287');
        });

        it('should use green color for moderately similar colors (distance 30-80)', () => {
            // Two somewhat similar colors
            const red: Dye = createMockDye({
                id: 18,
                itemID: 5748,
                name: 'Bright Red',
                hex: '#FF0000',
                rgb: { r: 255, g: 0, b: 0 },
                hsv: { h: 0, s: 100, v: 100 },
                category: 'Red',
            });
            const orange: Dye = createMockDye({
                id: 19,
                itemID: 5749,
                name: 'Reddish Orange',
                hex: '#FF4400', // Distance ~68 from pure red
                rgb: { r: 255, g: 68, b: 0 },
                hsv: { h: 16, s: 100, v: 100 },
                category: 'Orange',
            });

            const svg = generateComparisonGrid({ dyes: [red, orange] });

            // Distance 30-80 should use green color (#22c55e)
            expect(svg).toContain('#22c55e');
        });

        it('should use amber color for different colors (distance 80-150)', () => {
            // Two different but not opposite colors
            const red: Dye = createMockDye({
                id: 20,
                itemID: 5750,
                name: 'Bright Red',
                hex: '#FF0000',
                rgb: { r: 255, g: 0, b: 0 },
                hsv: { h: 0, s: 100, v: 100 },
                category: 'Red',
            });
            // Use #FF6600 for distance ~102 from red
            const midOrange: Dye = createMockDye({
                id: 23,
                itemID: 5753,
                name: 'Mid Orange',
                hex: '#FF6600', // Distance ~102 from pure red
                rgb: { r: 255, g: 102, b: 0 },
                hsv: { h: 24, s: 100, v: 100 },
                category: 'Orange',
            });

            const svg = generateComparisonGrid({ dyes: [red, midOrange] });

            // Distance 80-150 should use amber color (#f59e0b)
            expect(svg).toContain('#f59e0b');
        });
    });
});
