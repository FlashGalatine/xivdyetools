/**
 * End-to-end integration tests
 * Per R-5: Tests complete workflows combining multiple services
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DyeService, ColorService, dyeDatabase } from '../../index.js';
import type { Dye } from '../../types/index.js';

describe('End-to-End Workflow - Integration Tests', () => {
    let dyeService: DyeService;

    beforeAll(() => {
        dyeService = new DyeService(dyeDatabase);
    });

    describe('Complete Color Matching and Harmony Workflow', () => {
        it('should complete full workflow: hex → match → harmony → colorblind simulation', () => {
            const inputHex = '#FF5733'; // Orange-red

            // Step 1: Find closest dye
            const closestDye = dyeService.findClosestDye(inputHex);
            expect(closestDye).toBeDefined();
            if (!closestDye) return;

            // Step 2: Generate harmony
            const harmonies = dyeService.findTriadicDyes(inputHex);
            expect(harmonies.length).toBeGreaterThan(0);

            // Step 3: Simulate colorblindness for base and harmonies
            const baseRgb = ColorService.hexToRgb(closestDye.hex);
            const baseProtanopia = ColorService.simulateColorblindness(baseRgb, 'protanopia');
            expect(baseProtanopia).toBeDefined();

            harmonies.forEach((harmonyDye) => {
                const harmonyRgb = ColorService.hexToRgb(harmonyDye.hex);
                const harmonyProtanopia = ColorService.simulateColorblindness(harmonyRgb, 'protanopia');
                expect(harmonyProtanopia).toBeDefined();

                // Verify all conversions are valid
                const backToHex = ColorService.rgbToHex(harmonyProtanopia.r, harmonyProtanopia.g, harmonyProtanopia.b);
                expect(backToHex).toMatch(/^#[0-9A-F]{6}$/i);
            });
        });
    });

    describe('Multi-Step Color Analysis Workflow', () => {
        it('should analyze color through complete pipeline', () => {
            const testColor = '#8A2BE2'; // Blue violet

            // 1. Convert to all formats
            const rgb = ColorService.hexToRgb(testColor);
            const hsv = ColorService.rgbToHsv(rgb.r, rgb.g, rgb.b);

            // 2. Find matching dye
            const match = dyeService.findClosestDye(testColor);
            expect(match).toBeDefined();

            // 3. Generate harmonies
            const triadic = dyeService.findTriadicDyes(testColor);
            const analogous = dyeService.findAnalogousDyes(testColor);

            // 4. Calculate distances
            if (match) {
                const distance = ColorService.getColorDistance(testColor, match.hex);
                expect(distance).toBeGreaterThanOrEqual(0);

                // 5. Simulate colorblindness
                const matchRgb = ColorService.hexToRgb(match.hex);
                const simulated = ColorService.simulateColorblindness(matchRgb, 'deuteranopia');
                expect(simulated).toBeDefined();

                // 6. Verify round-trip conversions
                const simulatedHex = ColorService.rgbToHex(simulated.r, simulated.g, simulated.b);
                const backToRgb = ColorService.hexToRgb(simulatedHex);
                const backToHsv = ColorService.rgbToHsv(backToRgb.r, backToRgb.g, backToRgb.b);
                const finalHex = ColorService.hsvToHex(backToHsv.h, backToHsv.s, backToHsv.v);

                expect(finalHex).toMatch(/^#[0-9A-F]{6}$/i);
            }

            // Verify all harmonies are valid
            expect(triadic.length).toBeGreaterThan(0);
            expect(analogous.length).toBeGreaterThan(0);
        });
    });

    describe('Performance - Complete Workflow Speed', () => {
        it('should complete full workflow quickly', () => {
            const testColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF'];
            const iterations = 20;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                const color = testColors[i % testColors.length];

                // Complete workflow
                const match = dyeService.findClosestDye(color);
                if (match) {
                    dyeService.findTriadicDyes(color);
                    const rgb = ColorService.hexToRgb(match.hex);
                    ColorService.simulateColorblindness(rgb, 'protanopia');
                }
            }
            const duration = performance.now() - start;
            const avgTime = duration / iterations;

            // Should complete full workflow in < 100ms per iteration
            expect(avgTime).toBeLessThan(100);
        });
    });

    describe('Data Consistency Across Workflows', () => {
        it('should maintain data consistency through multiple operations', () => {
            const testColor = '#FF5733';
            const allDyes = dyeService.getAllDyes();
            expect(allDyes.length).toBeGreaterThan(0);

            // Find match
            const match1 = dyeService.findClosestDye(testColor);
            const match2 = dyeService.findClosestDye(testColor);

            // Should be consistent
            expect(match1?.id).toBe(match2?.id);

            // Generate harmonies multiple times
            const harmonies1 = dyeService.findTriadicDyes(testColor);
            const harmonies2 = dyeService.findTriadicDyes(testColor);

            // Should be consistent (same dyes, same order)
            expect(harmonies1.length).toBe(harmonies2.length);
            harmonies1.forEach((dye, index) => {
                expect(dye.id).toBe(harmonies2[index]?.id);
            });
        });
    });
});

