/**
 * Tests for Harmony Wheel SVG Generator
 */
import { describe, it, expect } from 'vitest';
import { generateHarmonyWheel, type HarmonyDye } from './harmony-wheel.js';

describe('svg/harmony-wheel.ts', () => {
    describe('generateHarmonyWheel', () => {
        it('should generate valid SVG document', () => {
            const dyes: HarmonyDye[] = [
                { id: 1, name: 'Blue', hex: '#0000ff' },
                { id: 2, name: 'Green', hex: '#00ff00' },
            ];

            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                baseName: 'Red',
                harmonyType: 'triadic',
                dyes,
            });

            expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('</svg>');
        });

        it('should use default dimensions when not specified', () => {
            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                harmonyType: 'complementary',
                dyes: [{ id: 1, name: 'Cyan', hex: '#00ffff' }],
            });

            expect(svg).toContain('width="400"');
            expect(svg).toContain('height="400"');
        });

        it('should use custom dimensions when specified', () => {
            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                harmonyType: 'complementary',
                dyes: [{ id: 1, name: 'Test', hex: '#00ffff' }],
                width: 500,
                height: 600,
            });

            expect(svg).toContain('width="500"');
            expect(svg).toContain('height="600"');
        });

        it('should include base color marker', () => {
            const svg = generateHarmonyWheel({
                baseColor: '#ff5733',
                harmonyType: 'triadic',
                dyes: [{ id: 1, name: 'Test', hex: '#0000ff' }],
            });

            expect(svg).toContain('fill="#ff5733"');
        });

        it('should include all harmony dye markers', () => {
            const dyes: HarmonyDye[] = [
                { id: 1, name: 'Blue', hex: '#0000ff' },
                { id: 2, name: 'Green', hex: '#00ff00' },
                { id: 3, name: 'Yellow', hex: '#ffff00' },
            ];

            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                harmonyType: 'tetradic',
                dyes,
            });

            expect(svg).toContain('fill="#0000ff"');
            expect(svg).toContain('fill="#00ff00"');
            expect(svg).toContain('fill="#ffff00"');
        });

        it('should include connecting lines', () => {
            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                harmonyType: 'complementary',
                dyes: [{ id: 1, name: 'Cyan', hex: '#00ffff' }],
            });

            // Lines connecting center to markers
            expect(svg).toContain('<line');
        });

        it('should include the color wheel gradient', () => {
            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                harmonyType: 'analogous',
                dyes: [
                    { id: 1, name: 'Orange', hex: '#ff8800' },
                    { id: 2, name: 'Yellow', hex: '#ffff00' },
                ],
            });

            // Color wheel is made of path segments with HSL fills
            expect(svg).toContain('<path');
            expect(svg).toContain('hsl(');
        });

        it('should handle single harmony dye', () => {
            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                harmonyType: 'complementary',
                dyes: [{ id: 1, name: 'Cyan', hex: '#00ffff' }],
            });

            expect(svg).toContain('fill="#00ffff"');
        });

        it('should handle empty dyes array', () => {
            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                harmonyType: 'none',
                dyes: [],
            });

            // Should still generate valid SVG with just the base color
            expect(svg).toContain('<svg');
            expect(svg).toContain('fill="#ff0000"');
        });

        it('should include white stroke on markers', () => {
            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                harmonyType: 'triadic',
                dyes: [{ id: 1, name: 'Test', hex: '#0000ff' }],
            });

            expect(svg).toContain('stroke="#ffffff"');
        });

        it('should work with different harmony types', () => {
            const harmonyTypes = [
                'complementary',
                'analogous',
                'triadic',
                'split-complementary',
                'tetradic',
                'square',
                'monochromatic',
            ];

            for (const harmonyType of harmonyTypes) {
                const svg = generateHarmonyWheel({
                    baseColor: '#ff0000',
                    harmonyType,
                    dyes: [{ id: 1, name: 'Test', hex: '#0000ff' }],
                });

                expect(svg).toContain('<svg');
                expect(svg).toContain('</svg>');
            }
        });

        it('should handle colors with different hues correctly', () => {
            // Test with colors at different positions on the color wheel
            const dyes: HarmonyDye[] = [
                { id: 1, name: 'Pure Blue', hex: '#0000ff' },     // Hue ~240
                { id: 2, name: 'Pure Green', hex: '#00ff00' },    // Hue ~120
                { id: 3, name: 'Pure Yellow', hex: '#ffff00' },   // Hue ~60
            ];

            const svg = generateHarmonyWheel({
                baseColor: '#ff0000', // Hue ~0
                harmonyType: 'square',
                dyes,
            });

            // All colors should be present
            expect(svg).toContain('fill="#ff0000"');
            expect(svg).toContain('fill="#0000ff"');
            expect(svg).toContain('fill="#00ff00"');
            expect(svg).toContain('fill="#ffff00"');
        });

        it('should include dark center circle', () => {
            const svg = generateHarmonyWheel({
                baseColor: '#ff0000',
                harmonyType: 'triadic',
                dyes: [{ id: 1, name: 'Test', hex: '#0000ff' }],
            });

            // The center should have the theme background color
            expect(svg).toContain('fill="#1a1a2e"');
        });

        it('should handle green-dominant color (max === g branch)', () => {
            // Pure green color should hit the max === g branch in rgbToHue
            const svg = generateHarmonyWheel({
                baseColor: '#00ff00', // Pure green - max is g
                harmonyType: 'triadic',
                dyes: [{ id: 1, name: 'Green Test', hex: '#00ff00' }],
            });

            expect(svg).toContain('<svg');
            expect(svg).toContain('fill="#00ff00"');
        });

        it('should handle achromatic color (gray - delta === 0)', () => {
            // Gray color where r === g === b, delta is 0
            const svg = generateHarmonyWheel({
                baseColor: '#808080', // Gray - achromatic
                harmonyType: 'monochromatic',
                dyes: [{ id: 1, name: 'Gray Test', hex: '#808080' }],
            });

            expect(svg).toContain('<svg');
            expect(svg).toContain('fill="#808080"');
        });

        it('should handle negative hue wrap (hue < 0)', () => {
            // Certain colors can produce negative hue in calculation that gets wrapped
            const svg = generateHarmonyWheel({
                baseColor: '#ff0001', // Slightly off red
                harmonyType: 'complementary',
                dyes: [{ id: 1, name: 'Test', hex: '#0000ff' }],
            });

            expect(svg).toContain('<svg');
        });

        it('should handle blue-dominant color (max === b branch)', () => {
            // Pure blue color to hit max === b branch
            const svg = generateHarmonyWheel({
                baseColor: '#0000ff', // Pure blue - max is b
                harmonyType: 'triadic',
                dyes: [{ id: 1, name: 'Blue Test', hex: '#0000ff' }],
            });

            expect(svg).toContain('<svg');
            expect(svg).toContain('fill="#0000ff"');
        });
    });
});
