/**
 * Tests for Accessibility Comparison SVG Generator
 */
import { describe, it, expect, vi } from 'vitest';
import {
    generateAccessibilityComparison,
    generateCompactAccessibilityRow,
    type VisionType,
} from './accessibility-comparison.js';

// Mock the ColorService
vi.mock('@xivdyetools/core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@xivdyetools/core')>();
    return {
        ...actual,
        ColorService: {
            simulateColorblindness: vi.fn((rgb, visionType) => {
                // Return slightly different colors based on vision type
                switch (visionType) {
                    case 'protanopia':
                        return { r: Math.max(0, rgb.r - 50), g: rgb.g + 20, b: rgb.b + 30 };
                    case 'deuteranopia':
                        return { r: rgb.r - 30, g: Math.max(0, rgb.g - 50), b: rgb.b + 10 };
                    case 'tritanopia':
                        return { r: rgb.r + 10, g: rgb.g - 10, b: Math.max(0, rgb.b - 50) };
                    default:
                        return rgb;
                }
            }),
        },
    };
});

describe('svg/accessibility-comparison.ts', () => {
    describe('generateAccessibilityComparison', () => {
        it('should generate valid SVG document', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Dalamud Red',
            });

            expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('</svg>');
        });

        it('should include dye name as title', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Dalamud Red',
            });

            expect(svg).toContain('Dalamud Red');
        });

        it('should include accessibility subtitle', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Test Dye',
            });

            expect(svg).toContain('Color Vision Accessibility');
        });

        it('should include normal vision swatch', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Test Dye',
            });

            expect(svg).toContain('Normal Vision');
            expect(svg).toContain('Full color perception');
        });

        it('should include all default vision types', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Test Dye',
            });

            expect(svg).toContain('Protanopia');
            expect(svg).toContain('Deuteranopia');
            expect(svg).toContain('Tritanopia');
        });

        it('should include vision type descriptions', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Test Dye',
            });

            expect(svg).toContain('Red-blind');
            expect(svg).toContain('Green-blind');
            expect(svg).toContain('Blue-blind');
        });

        it('should include original hex color', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Test Dye',
            });

            expect(svg).toContain('#AA1111');
        });

        it('should use custom width', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Test Dye',
                width: 600,
            });

            expect(svg).toContain('width="600"');
        });

        it('should handle subset of vision types', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Test Dye',
                visionTypes: ['protanopia'],
            });

            expect(svg).toContain('Protanopia');
            expect(svg).not.toContain('Deuteranopia');
            expect(svg).not.toContain('Tritanopia');
        });

        it('should escape special characters in dye name', () => {
            const svg = generateAccessibilityComparison({
                dyeHex: '#AA1111',
                dyeName: 'Test & Dye <Special>',
            });

            // Characters should be escaped to prevent XML issues
            expect(svg).toContain('&amp;');
            expect(svg).not.toContain('<Special>');
        });
    });

    describe('generateCompactAccessibilityRow', () => {
        it('should return array of vision results', () => {
            const results = generateCompactAccessibilityRow('#AA1111');

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);
        });

        it('should include normal vision first', () => {
            const results = generateCompactAccessibilityRow('#AA1111');

            expect(results[0].type).toBe('normal');
            expect(results[0].hex).toBe('#AA1111');
            expect(results[0].label).toBe('Normal');
        });

        it('should include all default vision types', () => {
            const results = generateCompactAccessibilityRow('#AA1111');

            const types = results.map((r) => r.type);
            expect(types).toContain('normal');
            expect(types).toContain('protanopia');
            expect(types).toContain('deuteranopia');
            expect(types).toContain('tritanopia');
        });

        it('should handle custom vision types', () => {
            const results = generateCompactAccessibilityRow('#AA1111', ['protanopia']);

            expect(results).toHaveLength(2); // normal + protanopia
            expect(results[0].type).toBe('normal');
            expect(results[1].type).toBe('protanopia');
        });

        it('should return simulated hex colors', () => {
            const results = generateCompactAccessibilityRow('#AA1111');

            // Each simulation should have a hex color
            for (const result of results) {
                expect(result.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
            }
        });

        it('should use short labels', () => {
            const results = generateCompactAccessibilityRow('#AA1111');

            // Labels should be short (first word of the full label)
            expect(results.find((r) => r.type === 'protanopia')?.label).toBe('Protanopia');
        });
    });
});
