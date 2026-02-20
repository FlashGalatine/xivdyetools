/**
 * Tests for SVG Base Utilities
 */
import { describe, it, expect } from 'vitest';
import {
    escapeXml,
    hexToRgb,
    rgbToHex,
    getLuminance,
    getContrastTextColor,
    createSvgDocument,
    rect,
    circle,
    line,
    text,
    arcPath,
    group,
    THEME,
    FONTS,
} from './base.js';

describe('svg/base.ts', () => {
    describe('escapeXml', () => {
        it('should escape ampersands', () => {
            expect(escapeXml('foo & bar')).toBe('foo &amp; bar');
        });

        it('should escape less-than signs', () => {
            expect(escapeXml('foo < bar')).toBe('foo &lt; bar');
        });

        it('should escape greater-than signs', () => {
            expect(escapeXml('foo > bar')).toBe('foo &gt; bar');
        });

        it('should escape double quotes', () => {
            expect(escapeXml('foo "bar"')).toBe('foo &quot;bar&quot;');
        });

        it('should escape single quotes', () => {
            expect(escapeXml("foo 'bar'")).toBe('foo &apos;bar&apos;');
        });

        it('should escape all special characters in one string', () => {
            expect(escapeXml('<foo & "bar" \'baz\'>')).toBe(
                '&lt;foo &amp; &quot;bar&quot; &apos;baz&apos;&gt;'
            );
        });

        it('should return the same string if no escaping needed', () => {
            expect(escapeXml('Hello World')).toBe('Hello World');
        });
    });

    describe('hexToRgb', () => {
        it('should convert hex with hash to RGB', () => {
            expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
            expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
            expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
        });

        it('should convert hex without hash to RGB', () => {
            expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 });
            expect(hexToRgb('000000')).toEqual({ r: 0, g: 0, b: 0 });
        });

        it('should handle mixed case hex values', () => {
            expect(hexToRgb('#AbCdEf')).toEqual({ r: 171, g: 205, b: 239 });
        });
    });

    describe('rgbToHex', () => {
        it('should convert RGB to hex', () => {
            expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
            expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
            expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
        });

        it('should pad single-digit hex values', () => {
            expect(rgbToHex(0, 0, 0)).toBe('#000000');
            expect(rgbToHex(15, 15, 15)).toBe('#0f0f0f');
        });

        it('should handle white and black', () => {
            expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
            expect(rgbToHex(0, 0, 0)).toBe('#000000');
        });
    });

    describe('getLuminance', () => {
        it('should return 1 for white', () => {
            expect(getLuminance('#ffffff')).toBeCloseTo(1, 2);
        });

        it('should return 0 for black', () => {
            expect(getLuminance('#000000')).toBe(0);
        });

        it('should return intermediate values for gray', () => {
            const luminance = getLuminance('#808080');
            expect(luminance).toBeGreaterThan(0);
            expect(luminance).toBeLessThan(1);
        });
    });

    describe('getContrastTextColor', () => {
        it('should return black for light backgrounds', () => {
            expect(getContrastTextColor('#ffffff')).toBe('#000000');
            expect(getContrastTextColor('#ffff00')).toBe('#000000');
            expect(getContrastTextColor('#cccccc')).toBe('#000000');
        });

        it('should return white for dark backgrounds', () => {
            expect(getContrastTextColor('#000000')).toBe('#ffffff');
            expect(getContrastTextColor('#333333')).toBe('#ffffff');
            expect(getContrastTextColor('#0000ff')).toBe('#ffffff');
        });
    });

    describe('createSvgDocument', () => {
        it('should create SVG document with proper attributes', () => {
            const svg = createSvgDocument(800, 600, '<rect/>');

            expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
            expect(svg).toContain('width="800"');
            expect(svg).toContain('height="600"');
            expect(svg).toContain('viewBox="0 0 800 600"');
            expect(svg).toContain('<rect/>');
        });
    });

    describe('rect', () => {
        it('should create basic rectangle', () => {
            const r = rect(10, 20, 100, 50, '#ff0000');

            expect(r).toContain('<rect');
            expect(r).toContain('x="10"');
            expect(r).toContain('y="20"');
            expect(r).toContain('width="100"');
            expect(r).toContain('height="50"');
            expect(r).toContain('fill="#ff0000"');
        });

        it('should include optional corner radius', () => {
            const r = rect(0, 0, 100, 100, '#000', { rx: 10, ry: 5 });

            expect(r).toContain('rx="10"');
            expect(r).toContain('ry="5"');
        });

        it('should include optional stroke', () => {
            const r = rect(0, 0, 100, 100, '#000', { stroke: '#fff', strokeWidth: 2 });

            expect(r).toContain('stroke="#fff"');
            expect(r).toContain('stroke-width="2"');
        });

        it('should include optional opacity', () => {
            const r = rect(0, 0, 100, 100, '#000', { opacity: 0.5 });

            expect(r).toContain('opacity="0.5"');
        });
    });

    describe('circle', () => {
        it('should create basic circle', () => {
            const c = circle(50, 50, 25, '#00ff00');

            expect(c).toContain('<circle');
            expect(c).toContain('cx="50"');
            expect(c).toContain('cy="50"');
            expect(c).toContain('r="25"');
            expect(c).toContain('fill="#00ff00"');
        });

        it('should include optional stroke', () => {
            const c = circle(0, 0, 10, '#000', { stroke: '#fff', strokeWidth: 1 });

            expect(c).toContain('stroke="#fff"');
            expect(c).toContain('stroke-width="1"');
        });

        it('should include optional opacity', () => {
            const c = circle(0, 0, 10, '#000', { opacity: 0.8 });

            expect(c).toContain('opacity="0.8"');
        });
    });

    describe('line', () => {
        it('should create basic line', () => {
            const l = line(0, 0, 100, 100, '#ffffff', 2);

            expect(l).toContain('<line');
            expect(l).toContain('x1="0"');
            expect(l).toContain('y1="0"');
            expect(l).toContain('x2="100"');
            expect(l).toContain('y2="100"');
            expect(l).toContain('stroke="#ffffff"');
            expect(l).toContain('stroke-width="2"');
        });

        it('should use default stroke width of 1', () => {
            const l = line(0, 0, 50, 50, '#000');

            expect(l).toContain('stroke-width="1"');
        });

        it('should include optional dash array', () => {
            const l = line(0, 0, 100, 100, '#000', 1, { dashArray: '5,5' });

            expect(l).toContain('stroke-dasharray="5,5"');
        });

        it('should include optional opacity', () => {
            const l = line(0, 0, 100, 100, '#000', 1, { opacity: 0.5 });

            expect(l).toContain('opacity="0.5"');
        });
    });

    describe('text', () => {
        it('should create basic text element', () => {
            const t = text(100, 50, 'Hello World');

            expect(t).toContain('<text');
            expect(t).toContain('x="100"');
            expect(t).toContain('y="50"');
            expect(t).toContain('>Hello World</text>');
        });

        it('should escape XML characters in content', () => {
            const t = text(0, 0, '<script>alert("xss")</script>');

            expect(t).toContain('&lt;script&gt;');
            expect(t).not.toContain('<script>');
        });

        it('should include all optional attributes', () => {
            const t = text(0, 0, 'Test', {
                fill: '#ff0000',
                fontSize: 16,
                fontFamily: 'Arial',
                fontWeight: 'bold',
                textAnchor: 'middle',
                dominantBaseline: 'middle',
            });

            expect(t).toContain('fill="#ff0000"');
            expect(t).toContain('font-size="16"');
            expect(t).toContain('font-family="Arial"');
            expect(t).toContain('font-weight="bold"');
            expect(t).toContain('text-anchor="middle"');
            expect(t).toContain('dominant-baseline="middle"');
        });
    });

    describe('arcPath', () => {
        it('should generate arc path string', () => {
            const path = arcPath(100, 100, 50, 0, 90);

            expect(path).toContain('M 100 100');
            expect(path).toContain('A 50 50');
            expect(path).toContain('Z');
        });

        it('should handle large arc flag for angles > 180', () => {
            const path = arcPath(100, 100, 50, 0, 270);

            expect(path).toContain('1 1'); // Large arc flag should be 1
        });

        it('should handle small arc flag for angles <= 180', () => {
            const path = arcPath(100, 100, 50, 0, 90);

            expect(path).toContain('0 1'); // Large arc flag should be 0
        });
    });

    describe('group', () => {
        it('should create group without transform', () => {
            const g = group('<rect/>');

            expect(g).toBe('<g><rect/></g>');
        });

        it('should create group with transform', () => {
            const g = group('<rect/>', 'translate(10, 20)');

            expect(g).toBe('<g transform="translate(10, 20)"><rect/></g>');
        });
    });

    describe('THEME', () => {
        it('should have all theme colors defined', () => {
            expect(THEME.background).toBe('#1a1a2e');
            expect(THEME.backgroundLight).toBe('#2d2d3d');
            expect(THEME.text).toBe('#ffffff');
            expect(THEME.textMuted).toBe('#909090');
            expect(THEME.textDim).toBe('#666666');
            expect(THEME.accent).toBe('#5865f2');
            expect(THEME.border).toBe('#404050');
            expect(THEME.success).toBe('#57f287');
            expect(THEME.warning).toBe('#fee75c');
            expect(THEME.error).toBe('#ed4245');
        });
    });

    describe('FONTS', () => {
        it('should have all font families defined', () => {
            expect(FONTS.header).toBe('Space Grotesk');
            expect(FONTS.primary).toBe('Onest');
            expect(FONTS.mono).toBe('Habibi');
        });
    });
});
