/**
 * Tests for OpenGraph Data Generator
 *
 * @module og-data-generator.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateHarmonyOGData,
  generateGradientOGData,
  generateMixerOGData,
  generateSwatchOGData,
  generateComparisonOGData,
  generateAccessibilityOGData,
  generateOGHTML,
  generateOGDataForTool,
} from './og-data-generator';
import type { Env } from './types';

const mockEnv: Env = {
  APP_BASE_URL: 'https://xivdyetools.app',
  OG_IMAGE_BASE_URL: 'https://og.xivdyetools.app/og',
};

describe('og-data-generator', () => {
  describe('generateHarmonyOGData', () => {
    it('should generate OG data for valid dye', () => {
      // Dye 5771 is "Mud Green" in the dye database
      const result = generateHarmonyOGData(
        { dye: 5771, harmony: 'complementary' },
        mockEnv
      );

      expect(result.title).toContain('Complementary');
      expect(result.title).toContain('XIV Dye Tools');
      expect(result.description).toContain('complementary');
      expect(result.url).toContain('dye=5771');
      expect(result.url).toContain('harmony=complementary');
      expect(result.imageUrl).toContain('/harmony/5771/complementary.png');
      expect(result.siteName).toBe('XIV Dye Tools');
      expect(result.themeColor).toBeDefined();
    });

    it('should generate fallback OG data for invalid dye', () => {
      const result = generateHarmonyOGData(
        { dye: 999999, harmony: 'analogous' },
        mockEnv
      );

      expect(result.title).toContain('Analogous Harmony');
      expect(result.imageUrl).toContain('/harmony/default.png');
      expect(result.themeColor).toBeUndefined();
    });

    it('should handle all harmony types', () => {
      const harmonyTypes = [
        'complementary',
        'analogous',
        'triadic',
        'split-complementary',
        'tetradic',
        'square',
        'monochromatic',
        'compound',
        'shades',
      ] as const;

      harmonyTypes.forEach((harmony) => {
        const result = generateHarmonyOGData({ dye: 5771, harmony }, mockEnv);
        expect(result.url).toContain(`harmony=${harmony}`);
      });
    });
  });

  describe('generateGradientOGData', () => {
    it('should generate OG data for valid gradient', () => {
      const result = generateGradientOGData(
        { start: 5771, end: 5772, steps: 5 },
        mockEnv
      );

      expect(result.title).toContain('Gradient');
      expect(result.title).toContain('XIV Dye Tools');
      expect(result.description).toContain('5-step gradient');
      expect(result.url).toContain('start=5771');
      expect(result.url).toContain('end=5772');
      expect(result.url).toContain('steps=5');
      expect(result.imageUrl).toContain('/gradient/5771/5772/5.png');
    });

    it('should generate fallback for invalid dyes', () => {
      const result = generateGradientOGData(
        { start: 999999, end: 999998, steps: 3 },
        mockEnv
      );

      expect(result.title).toBe('Gradient Builder | XIV Dye Tools');
      expect(result.imageUrl).toContain('/gradient/default.png');
    });

    it('should handle missing start dye', () => {
      const result = generateGradientOGData(
        { start: 999999, end: 5772, steps: 5 },
        mockEnv
      );

      expect(result.imageUrl).toContain('/gradient/default.png');
    });

    it('should handle missing end dye', () => {
      const result = generateGradientOGData(
        { start: 5771, end: 999999, steps: 5 },
        mockEnv
      );

      expect(result.imageUrl).toContain('/gradient/default.png');
    });
  });

  describe('generateMixerOGData', () => {
    it('should generate OG data for 2-dye mix', () => {
      const result = generateMixerOGData(
        { dyeA: 5771, dyeB: 5772, ratio: 60 },
        mockEnv
      );

      expect(result.title).toContain('60%');
      expect(result.title).toContain('40%');
      expect(result.url).toContain('dyeA=5771');
      expect(result.url).toContain('dyeB=5772');
      expect(result.url).toContain('ratio=60');
      expect(result.imageUrl).toContain('/mixer/5771/5772/60.png');
    });

    it('should generate OG data for 3-dye mix', () => {
      const result = generateMixerOGData(
        { dyeA: 5771, dyeB: 5772, dyeC: 5773, ratio: 50 },
        mockEnv
      );

      expect(result.title).toContain('+');
      expect(result.url).toContain('dyeC=5773');
      expect(result.imageUrl).toContain('/mixer/5771/5772/5773/50.png');
    });

    it('should generate fallback for invalid dyes', () => {
      const result = generateMixerOGData(
        { dyeA: 999999, dyeB: 999998, ratio: 50 },
        mockEnv
      );

      expect(result.title).toBe('Dye Mixer | XIV Dye Tools');
      expect(result.imageUrl).toContain('/mixer/default.png');
    });
  });

  describe('generateSwatchOGData', () => {
    it('should generate OG data for valid color', () => {
      const result = generateSwatchOGData(
        { color: 'FF5733', limit: 5 },
        mockEnv
      );

      expect(result.title).toContain('#FF5733');
      expect(result.description).toContain('top 5');
      expect(result.imageUrl).toContain('/swatch/FF5733/5.png');
      expect(result.themeColor).toBe('#FF5733');
    });

    it('should default limit to 5', () => {
      const result = generateSwatchOGData({ color: 'ABCDEF' }, mockEnv);

      expect(result.description).toContain('top 5');
      expect(result.imageUrl).toContain('/swatch/ABCDEF/5.png');
    });

    it('should include sheet context in description', () => {
      const result = generateSwatchOGData(
        { color: 'FF5733', sheet: 'eyeColors' },
        mockEnv
      );

      expect(result.description).toContain('eye colors');
    });

    it('should include race/gender context for race-specific sheets', () => {
      const result = generateSwatchOGData(
        {
          color: 'FF5733',
          sheet: 'hairColors',
          race: 'Midlander',
          gender: 'Female',
        },
        mockEnv
      );

      expect(result.description).toContain('Female');
      expect(result.description).toContain('Midlander');
      expect(result.description).toContain('hair');
    });

    it('should include sheet params in image URL', () => {
      const result = generateSwatchOGData(
        {
          color: 'FF5733',
          sheet: 'hairColors',
          race: 'Wildwood',
          gender: 'Male',
        },
        mockEnv
      );

      expect(result.imageUrl).toContain('sheet=hairColors');
      expect(result.imageUrl).toContain('race=Wildwood');
      expect(result.imageUrl).toContain('gender=Male');
    });
  });

  describe('generateComparisonOGData', () => {
    it('should generate OG data for multiple dyes', () => {
      const result = generateComparisonOGData({ dyes: [5771, 5772] }, mockEnv);

      expect(result.title).toContain('Compare');
      expect(result.description).toContain('comparison');
      expect(result.description).toContain('2');
      expect(result.url).toContain('dyes=5771,5772');
      expect(result.imageUrl).toContain('/comparison/5771,5772.png');
    });

    it('should limit to 4 dyes', () => {
      const result = generateComparisonOGData(
        { dyes: [5771, 5772, 5773, 5774, 5775] },
        mockEnv
      );

      // Should only include first 4
      expect(result.description).toContain('4');
    });

    it('should generate fallback for empty dyes', () => {
      const result = generateComparisonOGData({ dyes: [] }, mockEnv);

      expect(result.title).toBe('Dye Comparison | XIV Dye Tools');
      expect(result.imageUrl).toContain('/comparison/default.png');
    });

    it('should generate fallback for invalid dyes', () => {
      const result = generateComparisonOGData({ dyes: [999999] }, mockEnv);

      expect(result.title).toBe('Dye Comparison | XIV Dye Tools');
      expect(result.imageUrl).toContain('/comparison/default.png');
    });
  });

  describe('generateAccessibilityOGData', () => {
    it('should generate OG data for accessibility check', () => {
      const result = generateAccessibilityOGData(
        { dyes: [5771, 5772], vision: 'protanopia' },
        mockEnv
      );

      expect(result.title).toContain('Protanopia');
      expect(result.description).toContain('protanopia');
      expect(result.url).toContain('dyes=5771,5772');
      expect(result.url).toContain('vision=protanopia');
      expect(result.imageUrl).toContain('/accessibility/5771,5772/protanopia.png');
    });

    it('should handle all vision types', () => {
      const visionTypes = [
        'normal',
        'protanopia',
        'deuteranopia',
        'tritanopia',
        'achromatopsia',
      ] as const;

      visionTypes.forEach((vision) => {
        const result = generateAccessibilityOGData(
          { dyes: [5771], vision },
          mockEnv
        );
        expect(result.url).toContain(`vision=${vision}`);
      });
    });

    it('should default to normal vision', () => {
      const result = generateAccessibilityOGData({ dyes: [5771] }, mockEnv);

      expect(result.url).toContain('vision=normal');
    });

    it('should generate fallback for empty dyes', () => {
      const result = generateAccessibilityOGData({ dyes: [] }, mockEnv);

      expect(result.title).toBe('Accessibility Checker | XIV Dye Tools');
      expect(result.imageUrl).toContain('/accessibility/default.png');
    });
  });

  describe('generateOGHTML', () => {
    const testOGData = {
      title: 'Test Title',
      description: 'Test description with "quotes" & <special> characters',
      url: 'https://example.com/test?foo=bar',
      imageUrl: 'https://example.com/image.png',
      siteName: 'Test Site',
    };

    it('should generate valid HTML document', () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('</head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('should include escaped title in meta tags', () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('<title>Test Title</title>');
      expect(html).toContain('content="Test Title"');
    });

    it('should escape special characters in description', () => {
      const html = generateOGHTML(testOGData);

      // Should escape quotes and angle brackets
      expect(html).toContain('&quot;quotes&quot;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&lt;special&gt;');
    });

    it('should include Open Graph tags', () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('property="og:type" content="website"');
      expect(html).toContain('property="og:url"');
      expect(html).toContain('property="og:title"');
      expect(html).toContain('property="og:description"');
      expect(html).toContain('property="og:image"');
      expect(html).toContain('property="og:image:width" content="1200"');
      expect(html).toContain('property="og:image:height" content="630"');
      expect(html).toContain('property="og:site_name"');
    });

    it('should include Twitter Card tags', () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('name="twitter:card" content="summary_large_image"');
      expect(html).toContain('name="twitter:url"');
      expect(html).toContain('name="twitter:title"');
      expect(html).toContain('name="twitter:description"');
      expect(html).toContain('name="twitter:image"');
    });

    it('should include theme color when provided', () => {
      const html = generateOGHTML({
        ...testOGData,
        themeColor: '#FF5733',
      });

      expect(html).toContain('name="theme-color" content="#FF5733"');
    });

    it('should not include theme color when not provided', () => {
      const html = generateOGHTML(testOGData);

      expect(html).not.toContain('name="theme-color"');
    });

    it('should include meta refresh redirect', () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('http-equiv="refresh"');
      expect(html).toContain('url=https://example.com/test?foo=bar');
    });

    it('should include fallback link for non-JS browsers', () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('href="https://example.com/test?foo=bar"');
      expect(html).toContain("Click here if you're not redirected");
    });
  });

  describe('generateOGDataForTool', () => {
    it('should dispatch to harmony generator', () => {
      const params = new URLSearchParams('dye=5771&harmony=tetradic');
      const result = generateOGDataForTool('harmony', params, mockEnv);

      expect(result.imageUrl).toContain('/harmony/');
    });

    it('should dispatch to gradient generator', () => {
      const params = new URLSearchParams('start=5771&end=5772&steps=5');
      const result = generateOGDataForTool('gradient', params, mockEnv);

      expect(result.imageUrl).toContain('/gradient/');
    });

    it('should dispatch to mixer generator', () => {
      const params = new URLSearchParams('dyeA=5771&dyeB=5772&ratio=60');
      const result = generateOGDataForTool('mixer', params, mockEnv);

      expect(result.imageUrl).toContain('/mixer/');
    });

    it('should dispatch to swatch generator', () => {
      const params = new URLSearchParams('color=FF5733&limit=5');
      const result = generateOGDataForTool('swatch', params, mockEnv);

      expect(result.imageUrl).toContain('/swatch/');
    });

    it('should dispatch to comparison generator', () => {
      const params = new URLSearchParams('dyes=5771,5772');
      const result = generateOGDataForTool('comparison', params, mockEnv);

      expect(result.imageUrl).toContain('/comparison/');
    });

    it('should dispatch to accessibility generator', () => {
      const params = new URLSearchParams('dyes=5771&vision=protanopia');
      const result = generateOGDataForTool('accessibility', params, mockEnv);

      expect(result.imageUrl).toContain('/accessibility/');
    });

    it('should return default OG data for unknown tool', () => {
      const params = new URLSearchParams();
      // @ts-expect-error - Testing invalid tool
      const result = generateOGDataForTool('unknown', params, mockEnv);

      expect(result.title).toBe('XIV Dye Tools');
      expect(result.imageUrl).toContain('/default.png');
    });

    it('should use default values for missing params', () => {
      const params = new URLSearchParams();

      // When params are empty/invalid, generators return fallback OG data
      // Check that fallback images are used for tools requiring dye IDs
      const harmonyResult = generateOGDataForTool('harmony', params, mockEnv);
      expect(harmonyResult.imageUrl).toContain('/harmony/default.png');

      const gradientResult = generateOGDataForTool('gradient', params, mockEnv);
      expect(gradientResult.imageUrl).toContain('/gradient/default.png');

      const mixerResult = generateOGDataForTool('mixer', params, mockEnv);
      expect(mixerResult.imageUrl).toContain('/mixer/default.png');

      // Swatch defaults to FFFFFF color with limit 5
      const swatchResult = generateOGDataForTool('swatch', params, mockEnv);
      expect(swatchResult.imageUrl).toContain('/swatch/FFFFFF/5.png');
    });

    it('should parse perceptual param for harmony', () => {
      const params = new URLSearchParams('dye=5771&harmony=analogous&perceptual=1');
      const result = generateOGDataForTool('harmony', params, mockEnv);

      // Should complete without error
      expect(result.imageUrl).toContain('/harmony/');
    });

    it('should handle optional dyeC for mixer', () => {
      const params = new URLSearchParams('dyeA=5771&dyeB=5772&dyeC=5773&ratio=50');
      const result = generateOGDataForTool('mixer', params, mockEnv);

      expect(result.imageUrl).toContain('/mixer/5771/5772/5773/');
    });

    it('should filter invalid dye IDs in comparison', () => {
      const params = new URLSearchParams('dyes=5771,invalid,5772');
      const result = generateOGDataForTool('comparison', params, mockEnv);

      // Should only include valid IDs
      expect(result.url).toContain('dyes=5771,5772');
    });
  });
});
