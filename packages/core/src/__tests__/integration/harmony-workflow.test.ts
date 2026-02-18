/**
 * Integration tests for harmony generation workflow
 * Per R-5: Tests complete harmony generation pipeline
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { DyeService, ColorService, dyeDatabase } from '../../index.js';
import type { Dye } from '../../types/index.js';

describe('Harmony Generation Workflow - Integration Tests', () => {
    let dyeService: DyeService;

    beforeAll(() => {
        dyeService = new DyeService(dyeDatabase);
    });

    describe('Complete Harmony Workflow', () => {
        const testColors = ['#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080'];

        testColors.forEach((hexColor) => {
            it(`should generate complementary harmony for ${hexColor}`, () => {
                // Find base dye
                const baseDye = dyeService.findClosestDye(hexColor);
                expect(baseDye).toBeDefined();
                expect(baseDye?.hex).toBeDefined();

                // Generate complementary
                const complementary = dyeService.findComplementaryPair(hexColor);
                expect(complementary).toBeDefined();
                if (complementary) {
                    // Complementary should be different from base
                    expect(complementary.id).not.toBe(baseDye?.id);

                    // Verify color distance is reasonable (complementary should be far)
                    const distance = ColorService.getColorDistance(
                        baseDye!.hex,
                        complementary.hex
                    );
                    expect(distance).toBeGreaterThan(50); // Complementary colors are far apart
                }
            });

            it(`should generate triadic harmony for ${hexColor}`, () => {
                const triadic = dyeService.findTriadicDyes(hexColor);
                expect(triadic.length).toBeGreaterThan(0);
                expect(triadic.length).toBeLessThanOrEqual(2); // Base + 2 triadic colors

                // All dyes should be valid
                triadic.forEach((dye) => {
                    expect(dye.id).toBeGreaterThan(0);
                    expect(dye.hex).toMatch(/^#[0-9A-F]{6}$/i);
                    expect(dye.name).toBeTruthy();
                });

                // Should not include base dye
                const baseDye = dyeService.findClosestDye(hexColor);
                const baseDyeInResults = triadic.some((dye) => dye.id === baseDye?.id);
                expect(baseDyeInResults).toBe(false);
            });

            it(`should generate analogous harmony for ${hexColor}`, () => {
                const analogous = dyeService.findAnalogousDyes(hexColor, 30);
                expect(analogous.length).toBeGreaterThan(0);

                // Analogous colors should be similar (close hue)
                const baseDye = dyeService.findClosestDye(hexColor);
                if (baseDye) {
                    const baseHsv = ColorService.hexToHsv(baseDye.hex);
                    analogous.forEach((dye) => {
                        const dyeHsv = ColorService.hexToHsv(dye.hex);
                        // Hue should be within ±60° (allowing for tolerance)
                        const hueDiff = Math.min(
                            Math.abs(dyeHsv.h - baseHsv.h),
                            360 - Math.abs(dyeHsv.h - baseHsv.h)
                        );
                        expect(hueDiff).toBeLessThan(90); // Analogous should be close
                    });
                }
            });
        });
    });

    describe('Harmony Type Coverage', () => {
        const baseColor = '#FF5733' as const; // Orange-red

        it('should generate all harmony types', () => {
            const harmonies = {
                complementary: dyeService.findComplementaryPair(baseColor),
                triadic: dyeService.findTriadicDyes(baseColor),
                square: dyeService.findSquareDyes(baseColor),
                tetradic: dyeService.findTetradicDyes(baseColor),
                analogous: dyeService.findAnalogousDyes(baseColor),
                splitComplementary: dyeService.findSplitComplementaryDyes(baseColor),
                compound: dyeService.findCompoundDyes(baseColor),
                monochromatic: dyeService.findMonochromaticDyes(baseColor, 5),
            };

            // All should return results (or null for complementary)
            expect(harmonies.complementary !== undefined).toBe(true);
            expect(harmonies.triadic.length).toBeGreaterThan(0);
            expect(harmonies.square.length).toBeGreaterThan(0);
            expect(harmonies.tetradic.length).toBeGreaterThan(0);
            expect(harmonies.analogous.length).toBeGreaterThan(0);
            expect(harmonies.splitComplementary.length).toBeGreaterThan(0);
            expect(harmonies.compound.length).toBeGreaterThan(0);
            expect(harmonies.monochromatic.length).toBeGreaterThan(0);
        });
    });

    describe('Performance - Harmony Generation Speed', () => {
        it('should generate harmonies quickly using hue-indexed lookup', () => {
            const testColor = '#FF0000';
            const iterations = 50;

            const start = performance.now();
            for (let i = 0; i < iterations; i++) {
                dyeService.findTriadicDyes(testColor);
                dyeService.findAnalogousDyes(testColor);
                dyeService.findSquareDyes(testColor);
            }
            const duration = performance.now() - start;
            const avgTime = duration / iterations;

            // Per P-2: Should be fast with hue-indexed lookups
            // Target: < 50ms per harmony type (3 types = 150ms total per iteration)
            expect(avgTime).toBeLessThan(200); // Allow some buffer
        });
    });

    describe('Harmony Quality Validation', () => {
        it('should generate high-quality harmonies with reasonable color distances', () => {
            const baseColor = '#8A2BE2'; // Blue violet
            const harmonies = dyeService.findTriadicDyes(baseColor);

            if (harmonies.length >= 2) {
                // Triadic colors should be approximately 120° apart
                const baseDye = dyeService.findClosestDye(baseColor);
                if (baseDye) {
                    const baseHsv = ColorService.hexToHsv(baseDye.hex);

                    harmonies.forEach((dye, index) => {
                        const dyeHsv = ColorService.hexToHsv(dye.hex);
                        const expectedHue = (baseHsv.h + (index + 1) * 120) % 360;
                        const hueDiff = Math.min(
                            Math.abs(dyeHsv.h - expectedHue),
                            360 - Math.abs(dyeHsv.h - expectedHue)
                        );

                        // Should be within ±45° of expected triadic position
                        expect(hueDiff).toBeLessThan(45);
                    });
                }
            }
        });
    });
});

