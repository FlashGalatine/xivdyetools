/**
 * Tests for Gradient Bar SVG Generator
 */
import { describe, it, expect } from 'vitest';
import {
    generateGradientBar,
    interpolateColor,
    generateGradientColors,
    type GradientStep,
} from './gradient.js';

describe('svg/gradient.ts', () => {
    describe('interpolateColor', () => {
        it('should return start color when ratio is 0', () => {
            expect(interpolateColor('#ff0000', '#0000ff', 0)).toBe('#ff0000');
        });

        it('should return end color when ratio is 1', () => {
            expect(interpolateColor('#ff0000', '#0000ff', 1)).toBe('#0000ff');
        });

        it('should return midpoint color when ratio is 0.5', () => {
            const mid = interpolateColor('#ff0000', '#0000ff', 0.5);
            // Red to Blue at 50% should be purple (#800080 approximately)
            expect(mid).toBe('#800080');
        });

        it('should handle colors without hash prefix', () => {
            const result = interpolateColor('ffffff', '000000', 0.5);
            expect(result).toBe('#808080');
        });

        it('should handle black to white interpolation', () => {
            const quarter = interpolateColor('#000000', '#ffffff', 0.25);
            expect(quarter).toBe('#404040');
        });
    });

    describe('generateGradientColors', () => {
        it('should generate array of interpolated colors', () => {
            const colors = generateGradientColors('#000000', '#ffffff', 5);

            expect(colors).toHaveLength(5);
            expect(colors[0]).toBe('#000000');
            expect(colors[4]).toBe('#ffffff');
        });

        it('should include start and end colors', () => {
            const colors = generateGradientColors('#ff0000', '#0000ff', 3);

            expect(colors[0]).toBe('#ff0000');
            expect(colors[2]).toBe('#0000ff');
        });

        it('should handle 2 step gradient', () => {
            const colors = generateGradientColors('#000000', '#ffffff', 2);

            expect(colors).toEqual(['#000000', '#ffffff']);
        });

        it('should generate correct intermediate colors', () => {
            const colors = generateGradientColors('#000000', '#ffffff', 3);

            expect(colors[0]).toBe('#000000');
            expect(colors[1]).toBe('#808080'); // 50% gray
            expect(colors[2]).toBe('#ffffff');
        });
    });

    describe('generateGradientBar', () => {
        it('should generate valid SVG document', () => {
            const steps: GradientStep[] = [
                { hex: '#ff0000' },
                { hex: '#00ff00' },
                { hex: '#0000ff' },
            ];

            const svg = generateGradientBar({ steps });

            expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('</svg>');
        });

        it('should throw error for less than 2 steps', () => {
            expect(() => {
                generateGradientBar({ steps: [{ hex: '#ff0000' }] });
            }).toThrow('Gradient requires at least 2 steps');
        });

        it('should include all step colors', () => {
            const steps: GradientStep[] = [
                { hex: '#ff0000' },
                { hex: '#00ff00' },
            ];

            const svg = generateGradientBar({ steps });

            expect(svg).toContain('fill="#ff0000"');
            expect(svg).toContain('fill="#00ff00"');
        });

        it('should include dye names when provided', () => {
            const steps: GradientStep[] = [
                { hex: '#ff0000', dyeName: 'Dalamud Red' },
                { hex: '#ffffff', dyeName: 'Snow White' },
            ];

            const svg = generateGradientBar({ steps });

            expect(svg).toContain('Dalamud Red');
            expect(svg).toContain('Snow White');
        });

        it('should use custom width and height', () => {
            const steps: GradientStep[] = [
                { hex: '#000000' },
                { hex: '#ffffff' },
            ];

            const svg = generateGradientBar({ steps, width: 1000, height: 300 });

            expect(svg).toContain('width="1000"');
            expect(svg).toContain('height="300"');
        });

        it('should include START and END labels by default', () => {
            const steps: GradientStep[] = [
                { hex: '#000000' },
                { hex: '#ffffff' },
            ];

            const svg = generateGradientBar({ steps });

            expect(svg).toContain('START');
            expect(svg).toContain('END');
        });

        it('should hide START/END labels when showEndLabels is false', () => {
            const steps: GradientStep[] = [
                { hex: '#000000' },
                { hex: '#ffffff' },
            ];

            const svg = generateGradientBar({ steps, showEndLabels: false });

            expect(svg).not.toContain('>START<');
            expect(svg).not.toContain('>END<');
        });

        it('should include hex codes in output', () => {
            const steps: GradientStep[] = [
                { hex: '#AABBCC' },
                { hex: '#DDEEFF' },
            ];

            const svg = generateGradientBar({ steps });

            expect(svg).toContain('#AABBCC');
            expect(svg).toContain('#DDEEFF');
        });

        it('should truncate long dye names', () => {
            const steps: GradientStep[] = [
                { hex: '#ff0000', dyeName: 'Very Long Dye Name That Exceeds Limit' },
                { hex: '#ffffff', dyeName: 'Short' },
            ];

            const svg = generateGradientBar({ steps });

            // The truncated name should be in the output (with ..)
            expect(svg).toContain('Very Long ..');
            expect(svg).toContain('Short');
        });

        it('should handle steps with only hexes', () => {
            const steps: GradientStep[] = [
                { hex: '#111111' },
                { hex: '#222222' },
                { hex: '#333333' },
            ];

            const svg = generateGradientBar({ steps });

            expect(svg).toContain('fill="#111111"');
            expect(svg).toContain('fill="#222222"');
            expect(svg).toContain('fill="#333333"');
        });

        it('should include tick marks when showTicks is true', () => {
            const steps: GradientStep[] = [
                { hex: '#000000' },
                { hex: '#808080' },
                { hex: '#ffffff' },
            ];

            const svg = generateGradientBar({ steps, showTicks: true });

            // Tick marks are drawn as lines
            expect(svg).toContain('<line');
        });
    });
});
