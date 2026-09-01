/**
 * Tests for SVG Base Utilities
 */
import { describe, it, expect } from 'vitest';
import {
  num,
  grp,
  escapeXml,
  hexToRgb,
  getLuminance,
  getContrastTextColor,
  createSvgDocument,
  rect,
  circle,
  line,
  text,
  group,
  estimateTextWidth,
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
        '&lt;foo &amp; &quot;bar&quot; &apos;baz&apos;&gt;',
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
      // 5.0 replaced the palette wholesale — the old navy appeared
      // nowhere else we make. These are CARD_DARK's surfaces.
      expect(THEME.background).toBe('#17171A');
      expect(THEME.backgroundLight).toBe('#141416');
      expect(THEME.text).toBe('#ECECEE');
      expect(THEME.textMuted).toBe('#9C9CA2');
      expect(THEME.textDim).toBe('#86868C');
      expect(THEME.accent).toBe('#EA4133'); // one 5.0 accent, blurple retired
      expect(THEME.border).toBe('rgba(255,255,255,0.07)');
      expect(THEME.success).toBe('#57f287');
      expect(THEME.warning).toBe('#fee75c');
      expect(THEME.error).toBe('#ed4245');
    });
  });

  describe('FONTS', () => {
    it('should have all font families defined', () => {
      expect(FONTS.header).toBe('Space Grotesk');
      expect(FONTS.primary).toBe('Onest');
      expect(FONTS.mono).toBe('Fragment Mono');
    });

    /**
     * The CJK fallback order is not cosmetic and it is not interchangeable:
     * - JP must precede SC. Both carry the shared kanji, so if SC wins the
     *   lookup a Japanese player reads their own language in Chinese
     *   letterforms (F-17, fixed 2026-08-20 by adding JP *in front*).
     * - KR must follow SC. Noto Sans SC ships zero Hangul, so nothing is lost
     *   by asking it first, and KR carries no Han the other two need.
     * This rule used to live only in a prose comment and in
     * `apps/discord-worker/scripts/test-font-rendering.ts`, a manual script
     * nothing ran and which went stale (DEAD-028, 2026-09-01 dead-code audit).
     * Asserting the order here is what actually holds it.
     */
    it('orders the CJK fallback JP → SC → KR in every family that carries it', () => {
      const cjkFamilies = Object.entries(FONTS).filter(([, value]) => value.includes('Noto Sans'));
      expect(cjkFamilies.length).toBe(4); // cjk, headerCjk, primaryCjk, monoCjk

      for (const [key, value] of cjkFamilies) {
        const noto = value
          .split(',')
          .map((f) => f.trim())
          .filter((f) => f.startsWith('Noto Sans'));
        expect(noto, key).toEqual(['Noto Sans JP', 'Noto Sans SC', 'Noto Sans KR']);
      }
    });
  });

  describe('num', () => {
    it('applies the language decimal separator at a fixed precision', () => {
      // Not a .x5 tie — those round unpredictably through binary floats
      expect(num(12.46, 'en', 1)).toBe('12.5');
      expect(num(12.46, 'de', 1)).toBe('12,5');
      expect(num(12.46, 'fr', 2)).toBe('12,46');
      expect(num(12.46, 'ja', 1)).toBe('12.5');
      expect(num(12.46, 'ko', 1)).toBe('12.5');
      expect(num(12.46, 'zh', 1)).toBe('12.5');
    });

    it('falls back to English for an unknown language', () => {
      expect(num(3.5, 'xx', 1)).toBe('3.5');
    });

    it('keeps precision with the formatter, including zero dp', () => {
      expect(num(3.7, 'en', 0)).toBe('4');
      expect(num(3, 'de', 2)).toBe('3,00');
    });
  });

  describe('grp', () => {
    it('groups thousands with the language separator', () => {
      expect(grp(1234567, 'en')).toBe('1,234,567');
      expect(grp(1234567, 'de')).toBe('1.234.567');
      // French groups with U+202F NARROW NO-BREAK SPACE, not U+0020
      expect(grp(1234567, 'fr')).toBe('1 234 567');
    });

    it('leaves values under a thousand ungrouped', () => {
      expect(grp(999, 'en')).toBe('999');
      expect(grp(0, 'en')).toBe('0');
    });

    it('rounds before grouping and keeps the sign', () => {
      expect(grp(1234.6, 'en')).toBe('1,235');
      expect(grp(-1234567, 'en')).toBe('-1,234,567');
    });

    it('falls back to English for an unknown language', () => {
      expect(grp(1000, 'xx')).toBe('1,000');
    });
  });

  describe('estimateTextWidth', () => {
    it('counts Latin characters at the given width', () => {
      expect(estimateTextWidth('abc', 6)).toBe(18);
      expect(estimateTextWidth('', 6)).toBe(0);
    });

    it.each([
      ['Hangul Jamo', 'ᄀ'],
      ['CJK ideograph', '青'],
      ['kana', 'あ'],
      ['Hangul syllable', '한'],
      ['CJK compatibility ideograph', '豈'],
      ['fullwidth form', '：'],
      ['fullwidth sign', '￥'],
    ])('counts a %s as double width', (_name, char) => {
      expect(estimateTextWidth(char, 6)).toBe(12);
    });

    it('keeps halfwidth katakana narrow', () => {
      // U+FF71 sits above the fullwidth-forms cut on purpose
      expect(estimateTextWidth('ｱ', 6)).toBe(6);
    });

    it('mixes scripts additively', () => {
      expect(estimateTextWidth('a青b', 6)).toBe(6 + 12 + 6);
    });
  });
});

describe('NUMFMT / num / grp', () => {
  it('formats decimals per language at a fixed precision', () => {
    expect(num(9.53, 'en', 2)).toBe('9.53');
    expect(num(9.53, 'de', 2)).toBe('9,53');
    expect(num(9.53, 'fr', 1)).toBe('9,5');
    expect(num(7, 'ja', 1)).toBe('7.0');
  });

  it('groups thousands per language', () => {
    expect(grp(1234567, 'en')).toBe('1,234,567');
    expect(grp(1234567, 'de')).toBe('1.234.567');
    expect(grp(1234567, 'fr')).toBe('1\u202f234\u202f567');
    expect(grp(-4200, 'de')).toBe('-4.200');
    expect(grp(999, 'en')).toBe('999');
  });

  it('falls back to en for unknown languages', () => {
    expect(num(1.5, 'xx', 1)).toBe('1.5');
    expect(grp(1000, 'xx')).toBe('1,000');
  });
});
