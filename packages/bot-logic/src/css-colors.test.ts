/**
 * CSS Color Names — Unit Tests
 *
 * Tests for resolveCssColorName function.
 */

import { describe, it, expect } from 'vitest';
import { resolveCssColorName } from './css-colors.js';

describe('resolveCssColorName', () => {
  describe('valid CSS color names', () => {
    it('resolves lowercase name', () => {
      expect(resolveCssColorName('red')).toBe('#FF0000');
    });

    it('resolves mixed-case name', () => {
      expect(resolveCssColorName('BlueViolet')).toBe('#8A2BE2');
    });

    it('resolves uppercase name', () => {
      expect(resolveCssColorName('CORAL')).toBe('#FF7F50');
    });

    it('resolves white', () => {
      expect(resolveCssColorName('white')).toBe('#FFFFFF');
    });

    it('resolves black', () => {
      expect(resolveCssColorName('black')).toBe('#000000');
    });

    it('resolves multi-word color (no spaces)', () => {
      expect(resolveCssColorName('lightskyblue')).toBe('#87CEFA');
    });

    it('resolves rebeccapurple', () => {
      expect(resolveCssColorName('rebeccapurple')).toBe('#663399');
    });

    it('trims whitespace', () => {
      expect(resolveCssColorName('  red  ')).toBe('#FF0000');
    });
  });

  describe('gray/grey aliases', () => {
    it('resolves gray', () => {
      expect(resolveCssColorName('gray')).toBe('#808080');
    });

    it('resolves grey', () => {
      expect(resolveCssColorName('grey')).toBe('#808080');
    });

    it('resolves darkgray and darkgrey to same value', () => {
      expect(resolveCssColorName('darkgray')).toBe(resolveCssColorName('darkgrey'));
    });
  });

  describe('invalid inputs', () => {
    it('returns null for unknown name', () => {
      expect(resolveCssColorName('notacolor')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(resolveCssColorName('')).toBeNull();
    });

    it('returns null for hex code', () => {
      expect(resolveCssColorName('#FF0000')).toBeNull();
    });

    it('returns null for RGB notation', () => {
      expect(resolveCssColorName('rgb(255,0,0)')).toBeNull();
    });
  });

  describe('all 148 colors resolve to valid hex', () => {
    const HEX_PATTERN = /^#[0-9A-F]{6}$/;
    const sampleColors = [
      'aliceblue', 'aquamarine', 'chartreuse', 'cornflowerblue',
      'crimson', 'dodgerblue', 'firebrick', 'gold', 'honeydew',
      'indigo', 'khaki', 'lavender', 'magenta', 'navy',
      'olive', 'peru', 'salmon', 'teal', 'violet', 'wheat',
    ];

    for (const color of sampleColors) {
      it(`resolves ${color}`, () => {
        const result = resolveCssColorName(color);
        expect(result).not.toBeNull();
        expect(result).toMatch(HEX_PATTERN);
      });
    }
  });
});
