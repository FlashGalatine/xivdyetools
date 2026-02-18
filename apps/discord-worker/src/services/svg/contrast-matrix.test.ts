/**
 * Tests for Contrast Matrix SVG Generator
 */
import { describe, it, expect, vi } from 'vitest';
import {
    generateContrastMatrix,
    calculateContrast,
    type ContrastDye,
} from './contrast-matrix.js';

// Mock the ColorService with a simpler implementation
vi.mock('@xivdyetools/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xivdyetools/core')>();
    return {
        ...actual,
        ColorService: {
            getContrastRatio: (hex1: string, hex2: string) => {
                // Simple mock: white vs black = 21:1, same color = 1:1
                if (hex1 === hex2) return 1;
                if (
                    (hex1.toLowerCase() === '#ffffff' && hex2.toLowerCase() === '#0a0a0a') ||
                    (hex2.toLowerCase() === '#ffffff' && hex1.toLowerCase() === '#0a0a0a')
                ) {
                    return 19.4;
                }
                if (
                    (hex1.toLowerCase() === '#ffffff' && hex2.toLowerCase() === '#000000') ||
                    (hex2.toLowerCase() === '#ffffff' && hex1.toLowerCase() === '#000000')
                ) {
                    return 21;
                }
                // Default moderate contrast
                return 5.0;
            },
        },
    };
});

describe('svg/contrast-matrix.ts', () => {
    const dye1: ContrastDye = { name: 'Snow White', hex: '#FFFFFF' };
    const dye2: ContrastDye = { name: 'Jet Black', hex: '#0A0A0A' };
    const dye3: ContrastDye = { name: 'Dalamud Red', hex: '#AA1111' };

    describe('calculateContrast', () => {
        it('should return AAA for high contrast (>= 7:1)', () => {
            const result = calculateContrast('#FFFFFF', '#0A0A0A');
            expect(result.level).toBe('AAA');
            expect(result.ratio).toBeGreaterThanOrEqual(7);
        });

        it('should return AA for medium contrast (>= 4.5:1, < 7:1)', () => {
            const result = calculateContrast('#AAAAAA', '#333333');
            expect(result.level).toBe('AA');
        });
    });

    describe('generateContrastMatrix', () => {
        it('should generate valid SVG document', () => {
            const svg = generateContrastMatrix({ dyes: [dye1, dye2] });

            expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('</svg>');
        });

        it('should show error for less than 2 dyes', () => {
            const svg = generateContrastMatrix({ dyes: [dye1] });

            expect(svg).toContain('at least 2 dyes');
        });

        it('should show error for more than 4 dyes', () => {
            const dyes = [dye1, dye2, dye3, { name: 'D4', hex: '#444' }, { name: 'D5', hex: '#555' }];
            const svg = generateContrastMatrix({ dyes });

            expect(svg).toContain('Maximum 4 dyes');
        });

        it('should include title when provided', () => {
            const svg = generateContrastMatrix({
                dyes: [dye1, dye2],
                title: 'Accessibility Check',
            });

            expect(svg).toContain('Accessibility Check');
        });

        it('should include all dye names', () => {
            const svg = generateContrastMatrix({ dyes: [dye1, dye2, dye3] });

            expect(svg).toContain('Snow White');
            expect(svg).toContain('Jet Black');
            expect(svg).toContain('Dalamud Red');
        });

        it('should include color swatches', () => {
            const svg = generateContrastMatrix({ dyes: [dye1, dye2] });

            expect(svg).toContain('fill="#FFFFFF"');
            expect(svg).toContain('fill="#0A0A0A"');
        });

        it('should include contrast ratios', () => {
            const svg = generateContrastMatrix({ dyes: [dye1, dye2] });

            // Should contain ratio text like "X.XX:1"
            expect(svg).toContain(':1');
        });

        it('should include WCAG level badges', () => {
            const svg = generateContrastMatrix({ dyes: [dye1, dye2] });

            // High contrast white/black should be AAA
            expect(svg).toContain('AAA');
        });

        it('should include legend', () => {
            const svg = generateContrastMatrix({ dyes: [dye1, dye2] });

            // Legend items
            expect(svg).toContain('7:1+');
            expect(svg).toContain('4.5:1+');
            // < is escaped to &lt; in SVG
            expect(svg).toContain('&lt;4.5:1');
        });

        it('should handle 3 dyes', () => {
            const svg = generateContrastMatrix({ dyes: [dye1, dye2, dye3] });

            expect(svg).toContain('<svg');
            expect(svg).toContain('</svg>');
        });

        it('should handle 4 dyes', () => {
            const dyes = [dye1, dye2, dye3, { name: 'Gold', hex: '#FFD700' }];
            const svg = generateContrastMatrix({ dyes });

            expect(svg).toContain('Snow White');
            expect(svg).toContain('Gold');
        });

        it('should include diagonal cells for same dye comparison', () => {
            const svg = generateContrastMatrix({ dyes: [dye1, dye2] });

            // Diagonal cells show em-dash
            expect(svg).toContain('—');
        });
    });
});
