/**
 * Tests for SVG Base Utilities
 *
 * @module base.test
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
  group,
  linearGradient,
  THEME,
  FONTS,
  OG_DIMENSIONS,
} from './base';

describe('base SVG utilities', () => {
  describe('escapeXml', () => {
    it('should escape ampersand', () => {
      expect(escapeXml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape less than', () => {
      expect(escapeXml('foo < bar')).toBe('foo &lt; bar');
    });

    it('should escape greater than', () => {
      expect(escapeXml('foo > bar')).toBe('foo &gt; bar');
    });

    it('should escape double quotes', () => {
      expect(escapeXml('foo "bar" baz')).toBe('foo &quot;bar&quot; baz');
    });

    it('should escape single quotes', () => {
      expect(escapeXml("foo 'bar' baz")).toBe('foo &apos;bar&apos; baz');
    });

    it('should escape multiple special characters', () => {
      expect(escapeXml('<script>"alert(\'XSS\')&"</script>')).toBe(
        '&lt;script&gt;&quot;alert(&apos;XSS&apos;)&amp;&quot;&lt;/script&gt;'
      );
    });

    it('should return unchanged string with no special characters', () => {
      expect(escapeXml('Hello World 123')).toBe('Hello World 123');
    });
  });

  describe('hexToRgb', () => {
    it('should convert hex with # prefix', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should convert hex without # prefix', () => {
      expect(hexToRgb('00FF00')).toEqual({ r: 0, g: 255, b: 0 });
    });

    it('should convert lowercase hex', () => {
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should convert white', () => {
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
    });

    it('should convert black', () => {
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should convert mixed color', () => {
      expect(hexToRgb('#8B4513')).toEqual({ r: 139, g: 69, b: 19 });
    });
  });

  describe('rgbToHex', () => {
    it('should convert red', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    });

    it('should convert green', () => {
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00');
    });

    it('should convert blue', () => {
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff');
    });

    it('should convert white', () => {
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    });

    it('should convert black', () => {
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
    });

    it('should pad single digit values', () => {
      expect(rgbToHex(1, 2, 3)).toBe('#010203');
    });
  });

  describe('getLuminance', () => {
    it('should return 0 for black', () => {
      expect(getLuminance('#000000')).toBeCloseTo(0, 5);
    });

    it('should return 1 for white', () => {
      expect(getLuminance('#FFFFFF')).toBeCloseTo(1, 5);
    });

    it('should return correct luminance for red', () => {
      // Red has the lowest luminance coefficient (0.2126)
      const result = getLuminance('#FF0000');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(0.5);
    });

    it('should return correct luminance for green', () => {
      // Green has the highest luminance coefficient (0.7152)
      const result = getLuminance('#00FF00');
      expect(result).toBeGreaterThan(0.5);
    });

    it('should return correct luminance for blue', () => {
      // Blue has a low luminance coefficient (0.0722)
      const result = getLuminance('#0000FF');
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(0.2);
    });
  });

  describe('getContrastTextColor', () => {
    it('should return white text for dark backgrounds', () => {
      expect(getContrastTextColor('#000000')).toBe('#ffffff');
      expect(getContrastTextColor('#1a1a2e')).toBe('#ffffff');
      expect(getContrastTextColor('#2d2d3d')).toBe('#ffffff');
      expect(getContrastTextColor('#0000FF')).toBe('#ffffff');
    });

    it('should return black text for light backgrounds', () => {
      expect(getContrastTextColor('#FFFFFF')).toBe('#000000');
      expect(getContrastTextColor('#F5F5F5')).toBe('#000000');
      expect(getContrastTextColor('#FFFF00')).toBe('#000000');
    });

    it('should handle mid-tone colors correctly', () => {
      // Gray 50% should be around the threshold
      const result = getContrastTextColor('#808080');
      expect(['#000000', '#ffffff']).toContain(result);
    });
  });

  describe('createSvgDocument', () => {
    it('should create valid SVG document', () => {
      const result = createSvgDocument(100, 50, '<rect/>');
      expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(result).toContain('width="100"');
      expect(result).toContain('height="50"');
      expect(result).toContain('viewBox="0 0 100 50"');
      expect(result).toContain('<rect/>');
    });
  });

  describe('rect', () => {
    it('should create basic rect', () => {
      const result = rect(10, 20, 100, 50, '#FF0000');
      expect(result).toBe('<rect x="10" y="20" width="100" height="50" fill="#FF0000"/>');
    });

    it('should create rect with rounded corners', () => {
      const result = rect(0, 0, 100, 100, '#000', { rx: 10, ry: 5 });
      expect(result).toContain('rx="10"');
      expect(result).toContain('ry="5"');
    });

    it('should create rect with stroke', () => {
      const result = rect(0, 0, 100, 100, '#000', { stroke: '#FFF', strokeWidth: 2 });
      expect(result).toContain('stroke="#FFF"');
      expect(result).toContain('stroke-width="2"');
    });

    it('should create rect with opacity', () => {
      const result = rect(0, 0, 100, 100, '#000', { opacity: 0.5 });
      expect(result).toContain('opacity="0.5"');
    });
  });

  describe('circle', () => {
    it('should create basic circle', () => {
      const result = circle(50, 50, 25, '#FF0000');
      expect(result).toBe('<circle cx="50" cy="50" r="25" fill="#FF0000"/>');
    });

    it('should create circle with stroke', () => {
      const result = circle(50, 50, 25, '#000', { stroke: '#FFF', strokeWidth: 2 });
      expect(result).toContain('stroke="#FFF"');
      expect(result).toContain('stroke-width="2"');
    });

    it('should create circle with opacity', () => {
      const result = circle(50, 50, 25, '#000', { opacity: 0.8 });
      expect(result).toContain('opacity="0.8"');
    });
  });

  describe('line', () => {
    it('should create basic line', () => {
      const result = line(0, 0, 100, 100, '#FF0000');
      expect(result).toContain('x1="0"');
      expect(result).toContain('y1="0"');
      expect(result).toContain('x2="100"');
      expect(result).toContain('y2="100"');
      expect(result).toContain('stroke="#FF0000"');
      expect(result).toContain('stroke-width="1"');
    });

    it('should create line with custom stroke width', () => {
      const result = line(0, 0, 100, 100, '#000', 3);
      expect(result).toContain('stroke-width="3"');
    });

    it('should create line with opacity', () => {
      const result = line(0, 0, 100, 100, '#000', 1, { opacity: 0.5 });
      expect(result).toContain('opacity="0.5"');
    });

    it('should create line with dash array', () => {
      const result = line(0, 0, 100, 100, '#000', 1, { dashArray: '5,5' });
      expect(result).toContain('stroke-dasharray="5,5"');
    });
  });

  describe('text', () => {
    it('should create basic text', () => {
      const result = text(100, 50, 'Hello');
      expect(result).toContain('x="100"');
      expect(result).toContain('y="50"');
      expect(result).toContain('>Hello</text>');
    });

    it('should escape text content', () => {
      const result = text(0, 0, '<script>alert("XSS")</script>');
      expect(result).toContain('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
    });

    it('should set fill color', () => {
      const result = text(0, 0, 'Test', { fill: '#FF0000' });
      expect(result).toContain('fill="#FF0000"');
    });

    it('should set font properties', () => {
      const result = text(0, 0, 'Test', {
        fontSize: 24,
        fontFamily: 'Arial',
        fontWeight: 'bold',
      });
      expect(result).toContain('font-size="24"');
      expect(result).toContain('font-family="Arial"');
      expect(result).toContain('font-weight="bold"');
    });

    it('should set text anchor', () => {
      const result = text(0, 0, 'Test', { textAnchor: 'middle' });
      expect(result).toContain('text-anchor="middle"');
    });

    it('should set dominant baseline', () => {
      const result = text(0, 0, 'Test', { dominantBaseline: 'middle' });
      expect(result).toContain('dominant-baseline="middle"');
    });

    it('should set opacity', () => {
      const result = text(0, 0, 'Test', { opacity: 0.7 });
      expect(result).toContain('opacity="0.7"');
    });
  });

  describe('group', () => {
    it('should create basic group', () => {
      const result = group('<rect/>');
      expect(result).toBe('<g><rect/></g>');
    });

    it('should create group with transform', () => {
      const result = group('<rect/>', 'translate(10,20)');
      expect(result).toBe('<g transform="translate(10,20)"><rect/></g>');
    });
  });

  describe('linearGradient', () => {
    it('should create basic horizontal gradient', () => {
      const result = linearGradient('myGrad', [
        { offset: '0%', color: '#FF0000' },
        { offset: '100%', color: '#0000FF' },
      ]);
      expect(result).toContain('id="myGrad"');
      expect(result).toContain('x1="0%"');
      expect(result).toContain('y1="0%"');
      expect(result).toContain('x2="100%"');
      expect(result).toContain('y2="0%"');
      expect(result).toContain('<stop offset="0%" stop-color="#FF0000"/>');
      expect(result).toContain('<stop offset="100%" stop-color="#0000FF"/>');
    });

    it('should create vertical gradient', () => {
      const result = linearGradient(
        'vertGrad',
        [{ offset: '0%', color: '#000' }],
        { x1: '0%', y1: '0%', x2: '0%', y2: '100%' }
      );
      expect(result).toContain('x1="0%"');
      expect(result).toContain('y1="0%"');
      expect(result).toContain('x2="0%"');
      expect(result).toContain('y2="100%"');
    });

    it('should create gradient with multiple stops', () => {
      const result = linearGradient('multiGrad', [
        { offset: '0%', color: '#FF0000' },
        { offset: '50%', color: '#00FF00' },
        { offset: '100%', color: '#0000FF' },
      ]);
      expect(result).toContain('<stop offset="0%" stop-color="#FF0000"/>');
      expect(result).toContain('<stop offset="50%" stop-color="#00FF00"/>');
      expect(result).toContain('<stop offset="100%" stop-color="#0000FF"/>');
    });
  });

  describe('Constants', () => {
    describe('THEME', () => {
      it('should have all required colors', () => {
        expect(THEME.background).toBeDefined();
        expect(THEME.backgroundLight).toBeDefined();
        expect(THEME.backgroundCard).toBeDefined();
        expect(THEME.text).toBeDefined();
        expect(THEME.textMuted).toBeDefined();
        expect(THEME.textDim).toBeDefined();
        expect(THEME.accent).toBeDefined();
        expect(THEME.border).toBeDefined();
        expect(THEME.success).toBeDefined();
        expect(THEME.warning).toBeDefined();
        expect(THEME.error).toBeDefined();
      });
    });

    describe('FONTS', () => {
      it('should have all required font families', () => {
        expect(FONTS.header).toBe('Space Grotesk');
        expect(FONTS.primary).toBe('Onest');
        expect(FONTS.mono).toBe('Habibi');
      });
    });

    describe('OG_DIMENSIONS', () => {
      it('should have standard OG image dimensions', () => {
        expect(OG_DIMENSIONS.width).toBe(1200);
        expect(OG_DIMENSIONS.height).toBe(630);
      });
    });
  });
});
