/**
 * Tests for OpenGraph Data Generator
 *
 * @module og-data-generator.test
 */

import { describe, it, expect } from 'vitest';
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
      // Dye 43 is "Mud Green" in the dye database
      const result = generateHarmonyOGData(
        { dye: 43, harmony: 'complementary' },
        mockEnv
      );

      expect(result.title).toContain('Complementary');
      expect(result.title).toContain('XIV Dye Tools');
      expect(result.description).toContain('complementary');
      expect(result.url).toContain('dye=43');
      expect(result.url).toContain('harmony=complementary');
      expect(result.imageUrl).toContain('/harmony/43/complementary.png');
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
        const result = generateHarmonyOGData({ dye: 43, harmony }, mockEnv);
        expect(result.url).toContain(`harmony=${harmony}`);
      });
    });
  });

  describe('generateGradientOGData', () => {
    it('should generate OG data for valid gradient', () => {
      const result = generateGradientOGData(
        { start: 43, end: 44, steps: 5 },
        mockEnv
      );

      expect(result.title).toContain('Gradient');
      expect(result.title).toContain('XIV Dye Tools');
      expect(result.description).toContain('5-step gradient');
      expect(result.url).toContain('start=43');
      expect(result.url).toContain('end=44');
      expect(result.url).toContain('steps=5');
      expect(result.imageUrl).toContain('/gradient/43/44/5.png');
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
        { start: 999999, end: 44, steps: 5 },
        mockEnv
      );

      expect(result.imageUrl).toContain('/gradient/default.png');
    });

    it('should handle missing end dye', () => {
      const result = generateGradientOGData(
        { start: 43, end: 999999, steps: 5 },
        mockEnv
      );

      expect(result.imageUrl).toContain('/gradient/default.png');
    });
  });

  describe('generateMixerOGData', () => {
    it('should generate OG data for 2-dye mix', () => {
      const result = generateMixerOGData(
        { dyeA: 43, dyeB: 44, ratio: 60 },
        mockEnv
      );

      expect(result.title).toContain('60%');
      expect(result.title).toContain('40%');
      expect(result.url).toContain('dyeA=43');
      expect(result.url).toContain('dyeB=44');
      expect(result.url).toContain('ratio=60');
      expect(result.imageUrl).toContain('/mixer/43/44/60.png');
    });

    it('should generate OG data for 3-dye mix', () => {
      const result = generateMixerOGData(
        { dyeA: 43, dyeB: 44, dyeC: 45, ratio: 50 },
        mockEnv
      );

      expect(result.title).toContain('+');
      expect(result.url).toContain('dyeC=45');
      expect(result.imageUrl).toContain('/mixer/43/44/45/50.png');
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

    it('keeps sheet context OFF the image URL — the card does not draw it, so one cache key per card', () => {
      const result = generateSwatchOGData(
        {
          color: 'FF5733',
          sheet: 'hairColors',
          race: 'Wildwood',
          gender: 'Male',
          algo: 'oklab',
        },
        mockEnv
      );

      expect(result.imageUrl).not.toContain('sheet=');
      expect(result.imageUrl).not.toContain('race=');
      expect(result.imageUrl).not.toContain('gender=');
      // …but the algorithm still rides, because the card renders it
      expect(result.imageUrl).toContain('algo=oklab');
      // and the page URL keeps the full context (it shapes the description)
      expect(result.url).toContain('sheet=hairColors');
      expect(result.url).toContain('race=Wildwood');
    });
  });

  describe('generateComparisonOGData', () => {
    it('should generate OG data for multiple dyes', () => {
      const result = generateComparisonOGData({ dyes: [43, 44] }, mockEnv);

      expect(result.title).toContain('Compare');
      expect(result.description).toContain('comparison');
      expect(result.description).toContain('2');
      expect(result.url).toContain('dyes=43,44');
      expect(result.imageUrl).toContain('/comparison/43,44.png');
    });

    it('should limit to 4 dyes', () => {
      const result = generateComparisonOGData(
        { dyes: [43, 44, 45, 46, 47] },
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
        { dyes: [43, 44], vision: 'protanopia' },
        mockEnv
      );

      expect(result.title).toContain('Protanopia');
      expect(result.description).toContain('protanopia');
      expect(result.url).toContain('dyes=43,44');
      expect(result.url).toContain('vision=protanopia');
      expect(result.imageUrl).toContain('/accessibility/43,44/protanopia.png');
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
          { dyes: [43], vision },
          mockEnv
        );
        expect(result.url).toContain(`vision=${vision}`);
      });
    });

    it('should default to normal vision', () => {
      const result = generateAccessibilityOGData({ dyes: [43] }, mockEnv);

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
      // 15E: og:image is the Discord frame (1200×1050); X reads its own
      // twitter:image with ?frame=x at 1200×630
      expect(html).toContain('property="og:image:height" content="1050"');
      expect(html).toContain('frame=x');
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
      expect(html).toContain('Open XIV Dye Tools');
    });
  });

  describe('generateOGDataForTool', () => {
    it('should dispatch to harmony generator', () => {
      const params = new URLSearchParams('dye=43&harmony=tetradic');
      const result = generateOGDataForTool('harmony', params, mockEnv);

      expect(result.imageUrl).toContain('/harmony/');
    });

    it('should dispatch to gradient generator', () => {
      const params = new URLSearchParams('start=43&end=44&steps=5');
      const result = generateOGDataForTool('gradient', params, mockEnv);

      expect(result.imageUrl).toContain('/gradient/');
    });

    it('should dispatch to mixer generator', () => {
      const params = new URLSearchParams('dyeA=43&dyeB=44&ratio=60');
      const result = generateOGDataForTool('mixer', params, mockEnv);

      expect(result.imageUrl).toContain('/mixer/');
    });

    it('should dispatch to swatch generator', () => {
      const params = new URLSearchParams('color=FF5733&limit=5');
      const result = generateOGDataForTool('swatch', params, mockEnv);

      expect(result.imageUrl).toContain('/swatch/');
    });

    it('should dispatch to comparison generator', () => {
      const params = new URLSearchParams('dyes=43,44');
      const result = generateOGDataForTool('comparison', params, mockEnv);

      expect(result.imageUrl).toContain('/comparison/');
    });

    it('should dispatch to accessibility generator', () => {
      const params = new URLSearchParams('dyes=43&vision=protanopia');
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

    it('ignores the legacy perceptual param for harmony', () => {
      const params = new URLSearchParams('dye=43&harmony=analogous&perceptual=1');
      const result = generateOGDataForTool('harmony', params, mockEnv);

      // Should complete without error and never forward it
      expect(result.imageUrl).toContain('/harmony/');
      expect(result.imageUrl).not.toContain('perceptual');
    });

    it('should handle optional dyeC for mixer', () => {
      const params = new URLSearchParams('dyeA=43&dyeB=44&dyeC=45&ratio=50');
      const result = generateOGDataForTool('mixer', params, mockEnv);

      expect(result.imageUrl).toContain('/mixer/43/44/45/');
    });

    it('should filter invalid dye IDs in comparison', () => {
      const params = new URLSearchParams('dyes=43,invalid,44');
      const result = generateOGDataForTool('comparison', params, mockEnv);

      // Should only include valid IDs
      expect(result.url).toContain('dyes=43,44');
    });
  });

  // REFACTOR-001 (2026-04-28 audit): the four hardcoded display-name maps
  // (TOOL_NAMES, HARMONY_NAMES, VISION_NAMES, SHEET_NAMES) were replaced with
  // calls to TranslationProvider methods. These tests exercise the localized
  // path that the rest of the suite (which only uses default 'en') doesn't.
  describe('localization (REFACTOR-001)', () => {
    it('uses Japanese harmony name when locale is ja', () => {
      const params = new URLSearchParams('dye=43&harmony=complementary');
      const en = generateOGDataForTool('harmony', params, mockEnv, 'en');
      const ja = generateOGDataForTool('harmony', params, mockEnv, 'ja');

      expect(en.title).toContain('Complementary');
      expect(ja.title).toContain('補色');
      expect(ja.title).not.toContain('Complementary');
    });

    it('localizes split-complementary across the kebab/camel boundary', () => {
      const params = new URLSearchParams('dye=43&harmony=split-complementary');
      const ja = generateOGDataForTool('harmony', params, mockEnv, 'ja');
      // splitComplementary key in core's harmonyTypes: ja value is "分裂補色"
      expect(ja.title).toContain('分裂補色');
    });

    it('uses German tool fallback name when no dyes provided', () => {
      const params = new URLSearchParams('start=999999&end=999999&steps=5');
      const de = generateOGDataForTool('gradient', params, mockEnv, 'de');
      // Tool name "Verlaufs-Generator" from buildTools(de)
      expect(de.title).toContain('Verlaufs-Generator');
    });

    it('uses Korean sheet name in swatch description', () => {
      const params = new URLSearchParams('color=ABCDEF&sheet=eyeColors&limit=5');
      const ko = generateOGDataForTool('swatch', params, mockEnv, 'ko');
      // Sheet name "눈동자 색" lower-cased — Hangul has no case so it stays as-is
      expect(ko.description).toContain('눈동자 색');
    });

    it('uses French short vision name in accessibility title', () => {
      const params = new URLSearchParams('dyes=43,44&vision=deuteranopia');
      const fr = generateOGDataForTool('accessibility', params, mockEnv, 'fr');
      expect(fr.title).toContain('Deutéranopie');
    });

    it('falls back to en when locale arg is omitted', () => {
      const params = new URLSearchParams('dye=43&harmony=triadic');
      const result = generateOGDataForTool('harmony', params, mockEnv);
      expect(result.title).toContain('Triadic');
    });
  });
});

// ============================================================================
// DEAD-001 / DEAD-022: the three 5.0 tools + algo forwarding + route parity
// ============================================================================

describe('5.0 tools: extractor / presets / budget OG data', () => {
  it('extractor: colors= → the extractor card; no colors → the tool default', () => {
    const hit = generateOGDataForTool('extractor', new URLSearchParams('colors=8E5A3C,c9a96a,zzz&algo=oklab'), mockEnv);
    expect(hit.imageUrl).toBe('https://og.xivdyetools.app/og/extractor/8E5A3C,C9A96A.png');
    expect(hit.url).toContain('/extractor/?colors=8E5A3C,C9A96A');
    expect(hit.url).toContain('algo=oklab');
    expect(hit.title).toContain('XIV Dye Tools');
    expect(hit.themeColor).toBe('#8E5A3C');

    const miss = generateOGDataForTool('extractor', new URLSearchParams(''), mockEnv);
    expect(miss.imageUrl).toBe('https://og.xivdyetools.app/og/extractor/default.png');
    expect(miss.url).toBe('https://xivdyetools.app/extractor/');
  });

  it('extractor caps at five colours (the band cap)', () => {
    const colors = ['111111', '222222', '333333', '444444', '555555', '666666', '777777'];
    const r = generateOGDataForTool('extractor', new URLSearchParams(`colors=${colors.join(',')}`), mockEnv);
    expect(r.imageUrl).toContain('/og/extractor/111111,222222,333333,444444,555555.png');
  });

  it('presets: a curated id → its card with the dye names in the description', () => {
    const r = generateOGDataForTool('presets', new URLSearchParams('id=gc-maelstrom'), mockEnv);
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/presets/gc-maelstrom.png');
    expect(r.url).toBe('https://xivdyetools.app/presets/gc-maelstrom');
    expect(r.title).toMatch(/Maelstrom/);
    expect(r.description.length).toBeGreaterThan(20);
  });

  it('presets: unknown / community / missing id → the presets default card', () => {
    for (const q of ['id=community-abc', 'id=not-a-preset', '']) {
      const r = generateOGDataForTool('presets', new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, q).toBe('https://og.xivdyetools.app/og/presets/default.png');
      expect(r.url, q).toBe('https://xivdyetools.app/presets/');
    }
  });

  it('budget: dye= (stainID) → its card; hex= / legacy item ID / nothing → the budget default', () => {
    const hit = generateOGDataForTool('budget', new URLSearchParams('dye=102'), mockEnv);
    expect(hit.imageUrl).toBe('https://og.xivdyetools.app/og/budget/102.png');
    expect(hit.url).toBe('https://xivdyetools.app/budget/?dye=102&v=1');
    expect(hit.title).toMatch(/Jet Black/);
    for (const q of ['hex=ABCDEF', 'dye=5771', '']) {
      const r = generateOGDataForTool('budget', new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, q).toBe('https://og.xivdyetools.app/og/budget/default.png');
    }
  });

  it('every supported tool emits an image URL under its own /og/<tool>/ (route ↔ emitter parity)', () => {
    const rep: Record<string, string> = {
      harmony: 'dye=102&harmony=tetradic',
      gradient: 'start=1&end=102&steps=5',
      mixer: 'dyeA=1&dyeB=102&ratio=50',
      swatch: 'hex=ABCDEF&limit=5',
      comparison: 'dyes=1,2,3',
      accessibility: 'dyes=1,2&vision=deuteranopia',
      extractor: 'colors=8E5A3C,C9A96A',
      presets: 'id=gc-maelstrom',
      budget: 'dye=102',
    };
    for (const [tool, q] of Object.entries(rep)) {
      const r = generateOGDataForTool(tool as never, new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, tool).toContain(`/og/${tool}/`);
      expect(r.imageUrl, tool).not.toContain('default.png');
      // Swatch is the standing exception: a bare /swatch/ has always defaulted
      // to a white target card (pre-5.0 behaviour, not touched by this audit).
      if (tool === 'swatch') continue;
      const bare = generateOGDataForTool(tool as never, new URLSearchParams(''), mockEnv);
      expect(bare.imageUrl, `${tool} bare`).toBe(`https://og.xivdyetools.app/og/${tool}/default.png`);
    }
  });
});

describe('DEAD-022: the requested algorithm rides the image URL for every tool that renders it', () => {
  it('harmony / gradient / mixer forward a non-default algo (normalised), like swatch already did', () => {
    const cases: Array<[string, string]> = [
      ['harmony', 'dye=102&harmony=tetradic&algo=oklab'],
      ['gradient', 'start=1&end=102&steps=5&algo=oklab'],
      ['mixer', 'dyeA=1&dyeB=102&ratio=50&algo=oklab'],
      ['mixer', 'dyeA=1&dyeB=102&dyeC=50&ratio=50&algo=oklab'],
      ['swatch', 'hex=ABCDEF&limit=5&algo=oklab'],
    ];
    for (const [tool, q] of cases) {
      const r = generateOGDataForTool(tool as never, new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, `${tool} ${q}`).toMatch(/\.png\?algo=oklab$/);
    }
  });

  it('the suite default (ciede2000) and unknown values stay OFF the URL — one cache key for the same card', () => {
    for (const q of ['dye=102&harmony=tetradic', 'dye=102&harmony=tetradic&algo=ciede2000', 'dye=102&harmony=tetradic&algo=nonsense']) {
      const r = generateOGDataForTool('harmony', new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, q).toBe('https://og.xivdyetools.app/og/harmony/102/tetradic.png');
    }
  });

  it('legacy spellings normalise before they are emitted (euclidean → rgb)', () => {
    const r = generateOGDataForTool('harmony', new URLSearchParams('dye=102&harmony=tetradic&algo=euclidean'), mockEnv);
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/harmony/102/tetradic.png?algo=rgb');
  });

  it('algo and lang compose (?algo=…&lang=…)', () => {
    const r = generateOGDataForTool('harmony', new URLSearchParams('dye=102&harmony=tetradic&algo=oklab'), mockEnv, 'ja');
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/harmony/102/tetradic.png?algo=oklab&lang=ja');
  });
});
