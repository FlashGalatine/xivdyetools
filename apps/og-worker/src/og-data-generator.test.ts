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
    it('should generate OG data for valid dye', async () => {
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

    it('should generate fallback OG data for invalid dye', async () => {
      const result = generateHarmonyOGData(
        { dye: 999999, harmony: 'analogous' },
        mockEnv
      );

      expect(result.title).toContain('Analogous Harmony');
      expect(result.imageUrl).toContain('/harmony/default.png');
      expect(result.themeColor).toBeUndefined();
    });

    it('should handle all harmony types', async () => {
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
    it('should generate OG data for valid gradient', async () => {
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

    it('should generate fallback for invalid dyes', async () => {
      const result = generateGradientOGData(
        { start: 999999, end: 999998, steps: 3 },
        mockEnv
      );

      expect(result.title).toBe('Gradient Builder | XIV Dye Tools');
      expect(result.imageUrl).toContain('/gradient/default.png');
    });

    it('should handle missing start dye', async () => {
      const result = generateGradientOGData(
        { start: 999999, end: 44, steps: 5 },
        mockEnv
      );

      expect(result.imageUrl).toContain('/gradient/default.png');
    });

    it('should handle missing end dye', async () => {
      const result = generateGradientOGData(
        { start: 43, end: 999999, steps: 5 },
        mockEnv
      );

      expect(result.imageUrl).toContain('/gradient/default.png');
    });
  });

  describe('generateMixerOGData', () => {
    it('should generate OG data for 2-dye mix', async () => {
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

    it('should generate OG data for 3-dye mix', async () => {
      const result = generateMixerOGData(
        { dyeA: 43, dyeB: 44, dyeC: 45, ratio: 50 },
        mockEnv
      );

      expect(result.title).toContain('+');
      expect(result.url).toContain('dyeC=45');
      expect(result.imageUrl).toContain('/mixer/43/44/45/50.png');
    });

    it('should generate fallback for invalid dyes', async () => {
      const result = generateMixerOGData(
        { dyeA: 999999, dyeB: 999998, ratio: 50 },
        mockEnv
      );

      expect(result.title).toBe('Dye Mixer | XIV Dye Tools');
      expect(result.imageUrl).toContain('/mixer/default.png');
    });
  });

  describe('generateSwatchOGData', () => {
    it('should generate OG data for valid color', async () => {
      const result = generateSwatchOGData(
        { color: 'FF5733', limit: 5 },
        mockEnv
      );

      expect(result.title).toContain('#FF5733');
      expect(result.description).toContain('top 5');
      expect(result.imageUrl).toContain('/swatch/FF5733/5.png');
      expect(result.themeColor).toBe('#FF5733');
    });

    it('should default limit to 5', async () => {
      const result = generateSwatchOGData({ color: 'ABCDEF' }, mockEnv);

      expect(result.description).toContain('top 5');
      expect(result.imageUrl).toContain('/swatch/ABCDEF/5.png');
    });

    it('should include sheet context in description', async () => {
      const result = generateSwatchOGData(
        { color: 'FF5733', sheet: 'eyeColors' },
        mockEnv
      );

      expect(result.description).toContain('eye colors');
    });

    it('should include race/gender context for race-specific sheets', async () => {
      const result = generateSwatchOGData(
        {
          color: 'FF5733',
          sheet: 'hairColors',
          race: 'Midlander',
          gender: 'Female',
        },
        mockEnv
      );

      // EN lower-cases the gender mid-sentence; the clan resolves to its name
      expect(result.description).toContain('female Midlander hair colors');
      expect(result.description).toContain('Midlander');
      expect(result.description).toContain('hair');
    });

    it('keeps sheet context OFF the image URL — the card does not draw it, so one cache key per card', async () => {
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
      expect(result.imageUrl).not.toContain('slot=');
      expect(result.imageUrl).not.toContain('race=');
      expect(result.imageUrl).not.toContain('gender=');
      // …but the algorithm still rides, because the card renders it
      expect(result.imageUrl).toContain('algo=oklab');
      // and the page URL keeps the full context (it shapes the description).
      // BUG-021: the sheet is emitted as `slot=`, the spelling the 5.0 tool
      // shares and reads first (`params.slot ?? params.sheet`).
      expect(result.url).toContain('slot=hairColors');
      expect(result.url).toContain('race=Wildwood');
    });
  });

  describe('generateComparisonOGData', () => {
    it('should generate OG data for multiple dyes', async () => {
      const result = generateComparisonOGData({ dyes: [43, 44] }, mockEnv);

      expect(result.title).toContain('Compare');
      expect(result.description).toContain('comparison');
      expect(result.description).toContain('2');
      expect(result.url).toContain('dyes=43,44');
      expect(result.imageUrl).toContain('/comparison/43,44.png');
    });

    it('should limit to 4 dyes', async () => {
      const result = generateComparisonOGData(
        { dyes: [43, 44, 45, 46, 47] },
        mockEnv
      );

      // Should only include first 4
      expect(result.description).toContain('4');
    });

    it('should generate fallback for empty dyes', async () => {
      const result = generateComparisonOGData({ dyes: [] }, mockEnv);

      expect(result.title).toBe('Dye Comparison | XIV Dye Tools');
      expect(result.imageUrl).toContain('/comparison/default.png');
    });

    it('should generate fallback for invalid dyes', async () => {
      const result = generateComparisonOGData({ dyes: [999999] }, mockEnv);

      expect(result.title).toBe('Dye Comparison | XIV Dye Tools');
      expect(result.imageUrl).toContain('/comparison/default.png');
    });

    // 2026-08-29 FINDING-024 (OG-4, Sprint 7 fix wave): imageUrl used to be
    // built from the RAW params.dyes, so a bogus id mixed in with valid
    // ones (e.g. a hand-edited share URL's ?dyes=999999,43,44) baked the
    // bogus id into the emitted /og/comparison/… URL even though it never
    // resolved to a dye or appeared in the card. The /og/* route's
    // canonical dye-list grammar (ruling S7-R12) would 400 that spelling —
    // this emitter must never produce it.
    it('drops an unresolved id from the image URL without dropping the resolved ones', async () => {
      const result = generateComparisonOGData({ dyes: [999999, 43, 44] }, mockEnv);

      expect(result.imageUrl).toContain('/comparison/43,44.png');
      expect(result.imageUrl).not.toContain('999999');
    });
  });

  describe('generateAccessibilityOGData', () => {
    it('should generate OG data for accessibility check', async () => {
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

    it('should handle all vision types', async () => {
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

    it('should default to normal vision', async () => {
      const result = generateAccessibilityOGData({ dyes: [43] }, mockEnv);

      expect(result.url).toContain('vision=normal');
    });

    it('should generate fallback for empty dyes', async () => {
      const result = generateAccessibilityOGData({ dyes: [] }, mockEnv);

      expect(result.title).toBe('Accessibility Checker | XIV Dye Tools');
      expect(result.imageUrl).toContain('/accessibility/default.png');
    });

    // 2026-08-29 FINDING-024 (OG-4, Sprint 7 fix wave): same fix as
    // generateComparisonOGData above.
    it('drops an unresolved id from the image URL without dropping the resolved ones', async () => {
      const result = generateAccessibilityOGData({ dyes: [999999, 43, 44] }, mockEnv);

      expect(result.imageUrl).toContain('/accessibility/43,44/');
      expect(result.imageUrl).not.toContain('999999');
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

    it('should generate valid HTML document', async () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('</head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</body>');
      expect(html).toContain('</html>');
    });

    it('carries ?lang= on the links a person follows, not on the canonical (I18N-002)', () => {
      const html = generateOGHTML({ ...testOGData, locale: 'ja' });

      // The meta-refresh is a real redirect and the body link is a real click:
      // both used to drop the sharer's locale, so a ja share rendered a Japanese
      // card and then landed the reader in their own browser's language.
      expect(html).toContain('http-equiv="refresh" content="0;url=https://example.com/test?foo=bar&amp;lang=ja"');
      expect(html).toContain('<a href="https://example.com/test?foo=bar&amp;lang=ja">');

      // og:url / twitter:url stay canonical on purpose — carrying a UI
      // preference would split one page into six canonical URLs.
      expect(html).toContain('property="og:url" content="https://example.com/test?foo=bar"');
      expect(html).toContain('name="twitter:url" content="https://example.com/test?foo=bar"');
    });

    it('leaves every URL bare for the default locale', () => {
      const html = generateOGHTML({ ...testOGData, locale: 'en' });

      expect(html).not.toContain('lang=en');
    });

    it('should include escaped title in meta tags', async () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('<title>Test Title</title>');
      expect(html).toContain('content="Test Title"');
    });

    it('should escape special characters in description', async () => {
      const html = generateOGHTML(testOGData);

      // Should escape quotes and angle brackets
      expect(html).toContain('&quot;quotes&quot;');
      expect(html).toContain('&amp;');
      expect(html).toContain('&lt;special&gt;');
    });

    it('should include Open Graph tags', async () => {
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

    it('should include Twitter Card tags', async () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('name="twitter:card" content="summary_large_image"');
      expect(html).toContain('name="twitter:url"');
      expect(html).toContain('name="twitter:title"');
      expect(html).toContain('name="twitter:description"');
      expect(html).toContain('name="twitter:image"');
    });

    it('should include theme color when provided', async () => {
      const html = generateOGHTML({
        ...testOGData,
        themeColor: '#FF5733',
      });

      expect(html).toContain('name="theme-color" content="#FF5733"');
    });

    it('should not include theme color when not provided', async () => {
      const html = generateOGHTML(testOGData);

      expect(html).not.toContain('name="theme-color"');
    });

    it('should include meta refresh redirect', async () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('http-equiv="refresh"');
      expect(html).toContain('url=https://example.com/test?foo=bar');
    });

    it('should include fallback link for non-JS browsers', async () => {
      const html = generateOGHTML(testOGData);

      expect(html).toContain('href="https://example.com/test?foo=bar"');
      expect(html).toContain('Open XIV Dye Tools');
    });
  });

  describe('generateOGDataForTool', () => {
    it('should dispatch to harmony generator', async () => {
      const params = new URLSearchParams('dye=43&harmony=tetradic');
      const result = await generateOGDataForTool('harmony', params, mockEnv);

      expect(result.imageUrl).toContain('/harmony/');
    });

    it('should dispatch to gradient generator', async () => {
      const params = new URLSearchParams('start=43&end=44&steps=5');
      const result = await generateOGDataForTool('gradient', params, mockEnv);

      expect(result.imageUrl).toContain('/gradient/');
    });

    it('should dispatch to mixer generator', async () => {
      const params = new URLSearchParams('dyeA=43&dyeB=44&ratio=60');
      const result = await generateOGDataForTool('mixer', params, mockEnv);

      expect(result.imageUrl).toContain('/mixer/');
    });

    it('should dispatch to swatch generator', async () => {
      const params = new URLSearchParams('color=FF5733&limit=5');
      const result = await generateOGDataForTool('swatch', params, mockEnv);

      expect(result.imageUrl).toContain('/swatch/');
    });

    it('should dispatch to comparison generator', async () => {
      const params = new URLSearchParams('dyes=43,44');
      const result = await generateOGDataForTool('comparison', params, mockEnv);

      expect(result.imageUrl).toContain('/comparison/');
    });

    it('should dispatch to accessibility generator', async () => {
      const params = new URLSearchParams('dyes=43&vision=protanopia');
      const result = await generateOGDataForTool('accessibility', params, mockEnv);

      expect(result.imageUrl).toContain('/accessibility/');
    });

    it('should return default OG data for unknown tool', async () => {
      const params = new URLSearchParams();
      // @ts-expect-error - Testing invalid tool
      const result = await generateOGDataForTool('unknown', params, mockEnv);

      expect(result.title).toBe('XIV Dye Tools');
      expect(result.imageUrl).toContain('/default.png');
    });

    it('should use default values for missing params', async () => {
      const params = new URLSearchParams();

      // When params are empty/invalid, generators return fallback OG data
      // Check that fallback images are used for tools requiring dye IDs
      const harmonyResult = await generateOGDataForTool('harmony', params, mockEnv);
      expect(harmonyResult.imageUrl).toContain('/harmony/default.png');

      const gradientResult = await generateOGDataForTool('gradient', params, mockEnv);
      expect(gradientResult.imageUrl).toContain('/gradient/default.png');

      const mixerResult = await generateOGDataForTool('mixer', params, mockEnv);
      expect(mixerResult.imageUrl).toContain('/mixer/default.png');

      // Swatch: no target → the swatch default card (no invented #FFFFFF target)
      const swatchResult = await generateOGDataForTool('swatch', params, mockEnv);
      expect(swatchResult.imageUrl).toContain('/swatch/default.png');
    });

    it('ignores the legacy perceptual param for harmony', async () => {
      const params = new URLSearchParams('dye=43&harmony=analogous&perceptual=1');
      const result = await generateOGDataForTool('harmony', params, mockEnv);

      // Should complete without error and never forward it
      expect(result.imageUrl).toContain('/harmony/');
      expect(result.imageUrl).not.toContain('perceptual');
    });

    it('should handle optional dyeC for mixer', async () => {
      const params = new URLSearchParams('dyeA=43&dyeB=44&dyeC=45&ratio=50');
      const result = await generateOGDataForTool('mixer', params, mockEnv);

      expect(result.imageUrl).toContain('/mixer/43/44/45/');
    });

    it('should filter invalid dye IDs in comparison', async () => {
      const params = new URLSearchParams('dyes=43,invalid,44');
      const result = await generateOGDataForTool('comparison', params, mockEnv);

      // Should only include valid IDs
      expect(result.url).toContain('dyes=43,44');
    });
  });

  // REFACTOR-001 (2026-04-28 audit): the four hardcoded display-name maps
  // (TOOL_NAMES, HARMONY_NAMES, VISION_NAMES, SHEET_NAMES) were replaced with
  // calls to TranslationProvider methods. These tests exercise the localized
  // path that the rest of the suite (which only uses default 'en') doesn't.
  describe('localization (REFACTOR-001)', () => {
    it('uses Japanese harmony name when locale is ja', async () => {
      const params = new URLSearchParams('dye=43&harmony=complementary');
      const en = await generateOGDataForTool('harmony', params, mockEnv, 'en');
      const ja = await generateOGDataForTool('harmony', params, mockEnv, 'ja');

      expect(en.title).toContain('Complementary');
      expect(ja.title).toContain('補色');
      expect(ja.title).not.toContain('Complementary');
    });

    it('localizes split-complementary across the kebab/camel boundary', async () => {
      const params = new URLSearchParams('dye=43&harmony=split-complementary');
      const ja = await generateOGDataForTool('harmony', params, mockEnv, 'ja');
      // splitComplementary key in core's harmonyTypes: ja value is "分裂補色"
      expect(ja.title).toContain('分裂補色');
    });

    it('uses German tool fallback name when no dyes provided', async () => {
      const params = new URLSearchParams('start=999999&end=999999&steps=5');
      const de = await generateOGDataForTool('gradient', params, mockEnv, 'de');
      // The x6 deck name (the 5.0 web-app title), not core tools.* -- OG-I18N-005
      expect(de.title).toContain('Verlauf-Ersteller');
    });

    it('uses Korean sheet name in swatch description', async () => {
      const params = new URLSearchParams('color=ABCDEF&sheet=eyeColors&limit=5');
      const ko = await generateOGDataForTool('swatch', params, mockEnv, 'ko');
      // Sheet name "눈동자 색" lower-cased — Hangul has no case so it stays as-is
      expect(ko.description).toContain('눈동자 색');
    });

    it('uses French short vision name in accessibility title', async () => {
      const params = new URLSearchParams('dyes=43,44&vision=deuteranopia');
      const fr = await generateOGDataForTool('accessibility', params, mockEnv, 'fr');
      expect(fr.title).toContain('Deutéranopie');
    });

    it('falls back to en when locale arg is omitted', async () => {
      const params = new URLSearchParams('dye=43&harmony=triadic');
      const result = await generateOGDataForTool('harmony', params, mockEnv);
      expect(result.title).toContain('Triadic');
    });
  });
});

// ============================================================================
// DEAD-001 / DEAD-022: the three 5.0 tools + algo forwarding + route parity
// ============================================================================

describe('5.0 tools: extractor / presets / budget OG data', () => {
  it('extractor: colors= → the extractor card; no colors → the tool default', async () => {
    const hit = await generateOGDataForTool('extractor', new URLSearchParams('colors=8E5A3C,c9a96a,zzz&algo=oklab'), mockEnv);
    expect(hit.imageUrl).toBe('https://og.xivdyetools.app/og/extractor/8E5A3C,C9A96A.png');
    expect(hit.url).toContain('/extractor/?colors=8E5A3C,C9A96A');
    expect(hit.url).toContain('algo=oklab');
    expect(hit.title).toContain('XIV Dye Tools');
    expect(hit.themeColor).toBe('#8E5A3C');

    const miss = await generateOGDataForTool('extractor', new URLSearchParams(''), mockEnv);
    expect(miss.imageUrl).toBe('https://og.xivdyetools.app/og/extractor/default.png');
    expect(miss.url).toBe('https://xivdyetools.app/extractor/');
  });

  it('extractor caps at five colours (the band cap)', async () => {
    const colors = ['111111', '222222', '333333', '444444', '555555', '666666', '777777'];
    const r = await generateOGDataForTool('extractor', new URLSearchParams(`colors=${colors.join(',')}`), mockEnv);
    expect(r.imageUrl).toContain('/og/extractor/111111,222222,333333,444444,555555.png');
  });

  it('presets: a curated id → its card with the dye names in the description', async () => {
    const r = await generateOGDataForTool('presets', new URLSearchParams('id=gc-maelstrom'), mockEnv);
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/presets/gc-maelstrom.png');
    expect(r.url).toBe('https://xivdyetools.app/presets/gc-maelstrom');
    expect(r.title).toMatch(/Maelstrom/);
    expect(r.description.length).toBeGreaterThan(20);
  });

  it('presets: unknown / community / missing id → the presets default card', async () => {
    for (const q of ['id=community-abc', 'id=not-a-preset', '']) {
      const r = await generateOGDataForTool('presets', new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, q).toBe('https://og.xivdyetools.app/og/presets/default.png');
      expect(r.url, q).toBe('https://xivdyetools.app/presets/');
    }
  });

  it('budget: dye= (stainID) → its card; hex= / legacy item ID / nothing → the budget default', async () => {
    const hit = await generateOGDataForTool('budget', new URLSearchParams('dye=102'), mockEnv);
    expect(hit.imageUrl).toBe('https://og.xivdyetools.app/og/budget/102.png');
    expect(hit.url).toBe('https://xivdyetools.app/budget/?dye=102&v=1');
    expect(hit.title).toMatch(/Jet Black/);
    for (const q of ['hex=ABCDEF', 'dye=5771', '']) {
      const r = await generateOGDataForTool('budget', new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, q).toBe('https://og.xivdyetools.app/og/budget/default.png');
    }
  });

  it('every supported tool emits an image URL under its own /og/<tool>/ (route ↔ emitter parity)', async () => {
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
      const r = await generateOGDataForTool(tool as never, new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, tool).toContain(`/og/${tool}/`);
      expect(r.imageUrl, tool).not.toContain('default.png');
      const bare = await generateOGDataForTool(tool as never, new URLSearchParams(''), mockEnv);
      expect(bare.imageUrl, `${tool} bare`).toBe(`https://og.xivdyetools.app/og/${tool}/default.png`);
    }
  });
});

describe('DEAD-022: the requested algorithm rides the image URL for every tool that renders it', () => {
  it('harmony / gradient / mixer forward a non-default algo (normalised), like swatch already did', async () => {
    const cases: Array<[string, string]> = [
      ['harmony', 'dye=102&harmony=tetradic&algo=oklab'],
      ['gradient', 'start=1&end=102&steps=5&algo=oklab'],
      ['mixer', 'dyeA=1&dyeB=102&ratio=50&algo=oklab'],
      ['mixer', 'dyeA=1&dyeB=102&dyeC=50&ratio=50&algo=oklab'],
      ['swatch', 'hex=ABCDEF&limit=5&algo=oklab'],
    ];
    for (const [tool, q] of cases) {
      const r = await generateOGDataForTool(tool as never, new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, `${tool} ${q}`).toMatch(/\.png\?algo=oklab$/);
    }
  });

  it('the suite default (ciede2000) and unknown values stay OFF the URL — one cache key for the same card', async () => {
    for (const q of ['dye=102&harmony=tetradic', 'dye=102&harmony=tetradic&algo=ciede2000', 'dye=102&harmony=tetradic&algo=nonsense']) {
      const r = await generateOGDataForTool('harmony', new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, q).toBe('https://og.xivdyetools.app/og/harmony/102/tetradic.png');
    }
  });

  it('legacy spellings normalise before they are emitted (euclidean → rgb)', async () => {
    const r = await generateOGDataForTool('harmony', new URLSearchParams('dye=102&harmony=tetradic&algo=euclidean'), mockEnv);
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/harmony/102/tetradic.png?algo=rgb');
  });

  it('algo and lang compose (?algo=…&lang=…)', async () => {
    const r = await generateOGDataForTool('harmony', new URLSearchParams('dye=102&harmony=tetradic&algo=oklab'), mockEnv, 'ja');
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/harmony/102/tetradic.png?algo=oklab&lang=ja');
  });
});

// ---------------------------------------------------------------------------
// Localized embed copy (2026-08-20 i18n audit, OG-I18N-002…009): under ?lang=
// the title and description are whole sentences in that language, not English
// templates with localized nouns spliced in.
// ---------------------------------------------------------------------------
import { ogTranslator } from './services/translator';

describe('localized embed copy', () => {
  const SHARES: Array<[string, string, string | null]> = [
    ['harmony', 'dye=1&harmony=split-complementary', null],
    ['harmony', 'dye=9999&harmony=triadic', null],
    ['gradient', 'start=1&end=102&steps=5', null],
    ['gradient', '', null],
    ['mixer', 'dyeA=1&dyeB=102&ratio=30', null],
    ['mixer', 'dyeA=1&dyeB=102&dyeC=5&ratio=30', null],
    ['mixer', '', null],
    ['swatch', 'hex=AABBCC&limit=3', null],
    ['swatch', 'hex=AABBCC&sheet=hairColors&race=SeekerOfTheSun&gender=Female', null],
    ['swatch', 'hex=AABBCC&sheet=eyeColors', null],
    ['swatch', '', null],
    ['comparison', 'dyes=1,2,3', null],
    ['comparison', '', null],
    ['accessibility', 'dyes=1,2&vision=deuteranopia', null],
    ['accessibility', 'dyes=1,2', null],
    ['accessibility', '', null],
    ['extractor', 'colors=AABBCC,112233', null],
    ['extractor', '', null],
    ['presets', '', 'community-abc'],
    ['budget', 'dye=1', null],
    ['budget', '', null],
    ['nope', '', null],
  ];

  // Latin runs that are legitimately English in any locale: the brand, the
  // game, hex codes. Anything else four letters long is an untranslated word.
  const strip = (s: string): string =>
    s.replace(/XIV Dye Tools/g, '').replace(/FFXIV/g, '').replace(/#[0-9A-Fa-f]{6}/g, '');

  it('ja: no English word survives in any tool title or description', async () => {
    for (const [tool, q, pid] of SHARES) {
      const d = await generateOGDataForTool(tool as never, new URLSearchParams(q), mockEnv, 'ja', pid);
      expect(strip(d.title), `${tool}?${q} title: ${d.title}`).not.toMatch(/[A-Za-z]{4,}/);
      expect(strip(d.description), `${tool}?${q} description: ${d.description}`).not.toMatch(/[A-Za-z]{4,}/);
    }
  });

  it('en output is unchanged in shape (templates, not rewrites)', async () => {
    const d = await generateOGDataForTool('harmony', new URLSearchParams('dye=1&harmony=triadic'), mockEnv, 'en');
    expect(d.title).toBe('Snow White - Triadic Harmony | XIV Dye Tools');
    expect(d.description).toBe('Explore triadic color harmonies for Snow White (#e4dfd0) in FFXIV. Find matching dyes for your glamour!');
  });

  it('dye names localize in the embed like they do on the card (OG-I18N-003)', async () => {
    const ja = await generateOGDataForTool('harmony', new URLSearchParams('dye=1&harmony=triadic'), mockEnv, 'ja');
    expect(ja.title).toContain('スノウホワイト');
    expect(ja.title).not.toContain('Snow White');
    const de = await generateOGDataForTool('gradient', new URLSearchParams('start=1&end=102&steps=5'), mockEnv, 'de');
    expect(de.title).toContain('Schneeweißer');
    expect(de.title).toContain('Rabenschwarzer');
  });

  it('extractor / presets / budget defaults take the ×6 deck names, not a formatted key (OG-I18N-004)', async () => {
    expect((await generateOGDataForTool('presets', new URLSearchParams(), mockEnv, 'ja', 'community-abc')).title).toContain('コミュニティプリセット');
    expect((await generateOGDataForTool('extractor', new URLSearchParams(), mockEnv, 'de')).title).toContain('Paletten-Extraktor');
    expect((await generateOGDataForTool('budget', new URLSearchParams(), mockEnv, 'fr')).title).toContain('Budget');
    expect((await generateOGDataForTool('presets', new URLSearchParams(), mockEnv, 'fr', 'gc-maelstrom')).title).toContain('Palettes Communautaires');
  });

  it('tool names in the title match the card deck, not core tools.* (OG-I18N-005)', async () => {
    const de = await generateOGDataForTool('gradient', new URLSearchParams(), mockEnv, 'de');
    expect(de.title).toContain('Verlauf-Ersteller');
    expect(de.title).not.toContain('Verlaufs-Generator');
  });

  it('German nouns keep their capital — no .toLowerCase() on localized text (OG-I18N-006)', async () => {
    const de = await generateOGDataForTool('harmony', new URLSearchParams('dye=1&harmony=split-complementary'), mockEnv, 'de');
    expect(de.description).toContain('Geteiltes Komplement');
    expect(de.description).not.toContain('geteiltes komplement');
  });

  it('swatch race and gender localize instead of echoing URL slugs (OG-I18N-007)', async () => {
    const ja = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('hex=AABBCC&sheet=hairColors&race=SeekerOfTheSun&gender=Female'),
      mockEnv,
      'ja'
    );
    expect(ja.description).toContain(ogTranslator.getClan('seekerOfTheSun', 'ja'));
    expect(ja.description).not.toContain('SeekerOfTheSun');
    expect(ja.description).not.toContain('Female');
    const en = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('hex=AABBCC&sheet=hairColors&race=Miqote&gender=Male'),
      mockEnv,
      'en'
    );
    expect(en.description).toContain("male Miqo'te hair colors");
  });

  it('accessibility without ?vision= has no "Color Vision" literal in other locales (OG-I18N-008)', async () => {
    const ja = await generateOGDataForTool('accessibility', new URLSearchParams('dyes=1,2'), mockEnv, 'ja');
    expect(ja.title).not.toContain('Color Vision');
  });

  it('the HTML carries the locale: <html lang>, og:locale, localized body link (OG-I18N-009)', async () => {
    const ja = generateOGHTML(await generateOGDataForTool('harmony', new URLSearchParams('dye=1&harmony=triadic'), mockEnv, 'ja'));
    expect(ja).toContain('<html lang="ja">');
    expect(ja).toContain('<meta property="og:locale" content="ja_JP">');
    expect(ja).not.toContain('Open XIV Dye Tools');
    const en = generateOGHTML(await generateOGDataForTool('harmony', new URLSearchParams('dye=1&harmony=triadic'), mockEnv));
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('<meta property="og:locale" content="en_US">');
    expect(en).toContain('Open XIV Dye Tools →');
  });
});

// ---------------------------------------------------------------------------
// FINDING-024 (2026-08-21 security audit, OG-2 / OG-6): every query parameter
// that used to be echoed — escaped but unvalidated — into og:title /
// og:description / og:url / og:image on the production domain is validated
// against its enum, regex or range first. Unknown values fall back to the
// parameter's default (or the tool default card); nothing attacker-authored
// survives into a link preview.
// ---------------------------------------------------------------------------
describe('FINDING-024: echoed parameters are validated (OG-2 / OG-6)', () => {
  const gen = (tool: string, q: string, locale: 'en' | 'ja' = 'en') =>
    generateOGDataForTool(tool as never, new URLSearchParams(q), mockEnv, locale);
  const ids = (n: number) => Array.from({ length: n }, (_, i) => i + 1).join(',');

  it('harmony: an unknown ?harmony= falls back to the default harmony — the text is never echoed', async () => {
    const r = await gen('harmony', 'dye=1&harmony=free%20gil%20giveaway%20at%20evil.example%20official');
    expect(r.title).not.toMatch(/gil|evil|official/i);
    expect(r.description).not.toMatch(/gil|evil|official/i);
    expect(r.url).toBe('https://xivdyetools.app/harmony/?dye=1&harmony=complementary&v=1');
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/harmony/1/complementary.png');
  });

  it('harmony: prototype keys are not looked up (?harmony=constructor)', async () => {
    const r = await gen('harmony', 'dye=1&harmony=constructor');
    expect(r.title).not.toMatch(/function|native code|constructor/i);
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/harmony/1/complementary.png');
  });

  it('accessibility: an unknown ?vision= is treated as absent', async () => {
    const r = await gen('accessibility', 'dyes=1,2&vision=scam%20alert');
    expect(r.title).not.toMatch(/scam/i);
    expect(r.description).not.toMatch(/scam/i);
    expect(r.url).toContain('vision=normal');
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/accessibility/1,2/normal.png');
  });

  it('swatch: unknown sheet / race / gender are dropped from the description and og:url', async () => {
    const plain = await gen('swatch', 'hex=AABBCC&limit=5');
    const junkSheet = await gen('swatch', 'hex=AABBCC&limit=5&sheet=evil%20corp');
    expect(junkSheet.description).toBe(plain.description);
    expect(junkSheet.url).not.toContain('sheet=');

    const junkRace = await gen('swatch', 'hex=AABBCC&limit=5&sheet=hairColors&race=constructor&gender=Female');
    expect(junkRace.description).not.toMatch(/constructor|function/i);
    expect(junkRace.description).toContain('hair colors');
    expect(junkRace.url).not.toContain('race=');

    const junkGender = await gen('swatch', 'hex=AABBCC&limit=5&sheet=hairColors&race=Midlander&gender=Attacker');
    expect(junkGender.description).not.toMatch(/attacker/i);
    expect(junkGender.url).not.toContain('gender=');

    // …and the real thing still works, case-insensitively on gender
    const ok = await gen('swatch', 'hex=AABBCC&limit=5&sheet=hairColors&race=Midlander&gender=female');
    expect(ok.description).toContain('female Midlander hair colors');
    expect(ok.url).toContain('gender=Female');
  });

  it('swatch: a non-hex ?hex=/?color= degrades to the swatch default card (no junk image URL)', async () => {
    for (const q of ['hex=junk', 'color=%3Cscript%3E', 'hex=GGGGGG', 'hex=12345', `hex=${'A'.repeat(100)}`]) {
      const r = await gen('swatch', q);
      expect(r.imageUrl, q).toBe('https://og.xivdyetools.app/og/swatch/default.png');
      expect(r.url, q).toBe('https://xivdyetools.app/swatch/');
      expect(r.title, q).not.toMatch(/junk|script|GGGGGG|12345/i);
      expect(r.themeColor, q).toBeUndefined();
    }
  });

  it('swatch: a valid colour is normalised to RRGGBB in the image URL (#, case)', async () => {
    const r = await gen('swatch', 'hex=%23ff5733&limit=5');
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/swatch/FF5733/5.png');
    expect(r.title).toContain('#FF5733');
    expect(r.themeColor).toBe('#FF5733');
  });

  it("gradient / mixer / swatch numeric params are clamped to the image routes' bounds (no NaN, no 400ing image URL)", async () => {
    expect((await gen('gradient', 'start=1&end=102&steps=999')).imageUrl).toBe('https://og.xivdyetools.app/og/gradient/1/102/20.png');
    expect((await gen('gradient', 'start=1&end=102&steps=-3')).imageUrl).toBe('https://og.xivdyetools.app/og/gradient/1/102/2.png');
    const nanSteps = await gen('gradient', 'start=1&end=102&steps=abc');
    expect(nanSteps.imageUrl).toBe('https://og.xivdyetools.app/og/gradient/1/102/5.png');
    expect(nanSteps.description).not.toContain('NaN');

    expect((await gen('mixer', 'dyeA=1&dyeB=102&ratio=500')).imageUrl).toBe('https://og.xivdyetools.app/og/mixer/1/102/99.png');
    expect((await gen('mixer', 'dyeA=1&dyeB=102&ratio=0')).imageUrl).toBe('https://og.xivdyetools.app/og/mixer/1/102/1.png');
    const nanRatio = await gen('mixer', 'dyeA=1&dyeB=102&ratio=abc');
    expect(nanRatio.imageUrl).toBe('https://og.xivdyetools.app/og/mixer/1/102/50.png');
    expect(nanRatio.title).not.toContain('NaN');

    expect((await gen('swatch', 'hex=AABBCC&limit=999')).imageUrl).toBe('https://og.xivdyetools.app/og/swatch/AABBCC/20.png');
    expect((await gen('swatch', 'hex=AABBCC&limit=0')).imageUrl).toBe('https://og.xivdyetools.app/og/swatch/AABBCC/1.png');
  });

  // 2026-08-29 FINDING-024 (OG-4, ruling S7-R17): the share URL's dye list
  // is still capped at 16 (parseDyeIdList, OG_MAX_COMPARISON_DYES) — that
  // part is unchanged, and `url` still carries it. The image URL is capped
  // further, to COMPARISON_MAX_DYES / ACCESSIBILITY_MAX_DYES (4) — as many
  // ids as the card actually draws, not as many as the share URL accepted.
  // Before this, the image URL carried all 16 even though 12 of them never
  // appeared on the card: a request could spell the identical 4-dye card
  // many ways just by varying ids past position 4.
  it("comparison / accessibility: the share URL's dye list is capped at 16, the image URL only ever carries as many ids as the card draws", async () => {
    const c = await gen('comparison', `dyes=${ids(40)}`);
    expect(c.url).toBe(`https://xivdyetools.app/comparison/?dyes=${ids(16)}&v=1`);
    expect(c.imageUrl).toBe(`https://og.xivdyetools.app/og/comparison/${ids(4)}.png`);
    const a = await gen('accessibility', `dyes=${ids(40)}&vision=protanopia`);
    expect(a.imageUrl).toBe(`https://og.xivdyetools.app/og/accessibility/${ids(4)}/protanopia.png`);
  });

  it('an unknown ?algo= never reaches og:url (swatch / extractor used to echo it raw)', async () => {
    expect((await gen('swatch', 'hex=AABBCC&algo=evil')).url).not.toContain('algo=');
    expect((await gen('extractor', 'colors=AABBCC&algo=evil')).url).not.toContain('algo=');
    // …while a known one still rides
    expect((await gen('swatch', 'hex=AABBCC&algo=oklab')).url).toContain('algo=oklab');
    expect((await gen('extractor', 'colors=AABBCC&algo=oklab')).url).toContain('algo=oklab');
  });

  it('the validation holds under every locale (the ja gate still passes with junk params)', async () => {
    const r = await gen('harmony', 'dye=1&harmony=free%20gil%20giveaway', 'ja');
    expect(r.title).not.toMatch(/gil|giveaway/i);
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/harmony/1/complementary.png?lang=ja');
  });
});

// ---------------------------------------------------------------------------
// BUG-021 (deep dive 2026-09-02): the 5.0 Swatch Matcher shares a CELL ADDRESS
// (`?slot=<sheet>&i=<index>`) and no hex at all. Reading only the retired
// `?hex=`/`?sheet=` pair meant every Swatch share unfurled as the generic
// default card — and the two sheet-aware sentences the 2026-08-20 i18n audit
// authored ×6 were unreachable, because both branches gate on `sheet` being
// set by a grammar nothing emits.
//
// Every swatch case in the rest of this file feeds the retired grammar, which
// is exactly why the suite stayed green while the real one degraded.
// ---------------------------------------------------------------------------
describe('BUG-021: the Swatch card reads the cell address the SPA actually shares', () => {
  // `eyeColors` cell 12 is #B9AF90 and Midlander/Female hair cell 5 is #515151
  // in packages/core/src/data/character_colors — the same tables the page reads.
  it('resolves ?slot=&i= to that cell’s colour, not the default card', async () => {
    const r = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('slot=eyeColors&i=12&algo=ciede2000&limit=5'),
      mockEnv
    );

    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/swatch/B9AF90/5.png');
    expect(r.imageUrl).not.toContain('default.png');
    expect(r.title).toContain('#B9AF90');
    expect(r.themeColor).toBe('#B9AF90');
  });

  it('reaches the sheet-aware description that was unreachable before', async () => {
    const bare = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('hex=B9AF90&limit=5'),
      mockEnv
    );
    const addressed = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('slot=eyeColors&i=12&limit=5'),
      mockEnv
    );

    // Same colour, same limit — the ONLY difference is that the sheet is known,
    // so the two must not produce the same sentence.
    expect(addressed.description).not.toBe(bare.description);
    expect(addressed.description.toLowerCase()).toContain('eye');
  });

  it('resolves a race-specific sheet, which needs ?race= and ?gender= as well', async () => {
    const r = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('slot=hairColors&i=5&race=Midlander&gender=Female&limit=4'),
      mockEnv
    );

    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/swatch/515151/4.png');
    expect(r.description).toContain('hair');

    // Without the clan the palette is unknown — a hair sheet has 16 of them —
    // so this degrades to the default card rather than guessing one.
    const noClan = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('slot=hairColors&i=5&limit=4'),
      mockEnv
    );
    expect(noClan.imageUrl).toBe('https://og.xivdyetools.app/og/swatch/default.png');
  });

  it('an address that names no cell degrades to the default card — it never invents a colour', async () => {
    for (const q of [
      'slot=eyeColors&i=999', // past the end of a 192-cell sheet
      'slot=lipColorsDark&i=120', // past the end of a 96-cell sheet
      'slot=eyeColors&i=-1', // not a cell index
      'slot=eyeColors&i=12abc', // parseInt would have read this as 12
      'slot=notASheet&i=12', // not a sheet
      'slot=hairColors&i=5&race=Hyur&gender=Female', // a race, not a clan
    ]) {
      const r = await generateOGDataForTool('swatch', new URLSearchParams(q), mockEnv);
      expect(r.imageUrl, q).toBe('https://og.xivdyetools.app/og/swatch/default.png');
    }
  });

  it('emits the grammar the link arrived in, so the click-through reopens the same cell', async () => {
    const addressed = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('slot=eyeColors&i=12&limit=5'),
      mockEnv
    );
    // The address is the identity handle: two cells can carry one colour, so a
    // hex round-trip would reopen whichever comes first.
    expect(addressed.url).toContain('slot=eyeColors');
    expect(addressed.url).toContain('i=12');
    expect(addressed.url).not.toContain('color=');

    // A legacy ?hex= link has no address to preserve and keeps the old shape,
    // which the SPA still resolves by colour match.
    const legacy = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('hex=B9AF90&sheet=eyeColors&limit=5'),
      mockEnv
    );
    expect(legacy.url).toContain('color=B9AF90');
    expect(legacy.url).not.toContain('i=');
  });

  it('`sheet` is still read as the pre-5.0 alias for `slot`', async () => {
    const r = await generateOGDataForTool(
      'swatch',
      new URLSearchParams('sheet=eyeColors&i=12&limit=5'),
      mockEnv
    );
    expect(r.imageUrl).toBe('https://og.xivdyetools.app/og/swatch/B9AF90/5.png');
  });
});

// ---------------------------------------------------------------------------
// og-6 (deep dive 2026-09-02): og:url was rebuilt from scratch on every tool
// and dropped `lang` — which ShareService.generateUrl sets for a non-EN locale
// *specifically* so this worker can localize — and `algo`, which harmony,
// gradient and mixer read on load. The reader saw a Japanese card measured in
// ΔEOK and clicked through to an English page measured in ΔE2000.
//
// The old test asserted an UNKNOWN algo never reaches og:url; nothing asserted
// a known one does, and nothing asserted lang round-trips at all.
// ---------------------------------------------------------------------------
describe('og-6: og:url carries the params the page reads back', () => {
  const SHARES: Array<[string, string, string | null]> = [
    ['harmony', 'dye=102&harmony=tetradic', null],
    ['gradient', 'start=1&end=102&steps=5', null],
    ['mixer', 'dyeA=1&dyeB=102&ratio=50', null],
    ['swatch', 'slot=eyeColors&i=12', null],
    ['comparison', 'dyes=1,2,3', null],
    ['accessibility', 'dyes=1,2&vision=deuteranopia', null],
    ['extractor', 'colors=8E5A3C,C9A96A', null],
    ['presets', '', 'gc-maelstrom'],
    ['budget', 'dye=102', null],
  ];

  it('lang round-trips into og:url on all nine tools', async () => {
    for (const [tool, q, pid] of SHARES) {
      const ja = await generateOGDataForTool(
        tool as never,
        new URLSearchParams(q),
        mockEnv,
        'ja',
        pid
      );
      expect(ja.url, `${tool}?${q}`).toContain('lang=ja');
      // …and English, the default, stays unparameterised
      const en = await generateOGDataForTool(
        tool as never,
        new URLSearchParams(q),
        mockEnv,
        'en',
        pid
      );
      expect(en.url, `${tool}?${q} (en)`).not.toContain('lang=');
    }
  });

  it('a KNOWN algo rides og:url on every tool that reads it back', async () => {
    for (const [tool, q] of [
      ['harmony', 'dye=102&harmony=tetradic&algo=oklab'],
      ['gradient', 'start=1&end=102&steps=5&algo=oklab'],
      ['mixer', 'dyeA=1&dyeB=102&ratio=50&algo=oklab'],
      ['swatch', 'slot=eyeColors&i=12&algo=oklab'],
    ]) {
      const r = await generateOGDataForTool(tool as never, new URLSearchParams(q), mockEnv);
      expect(r.url, q).toContain('algo=oklab');
      // the card and the page it opens must agree on the method
      expect(r.imageUrl, q).toContain('algo=oklab');
    }
  });

  it('the 3-dye mixer carries its ratio, which only the image URL had', async () => {
    const r = await generateOGDataForTool(
      'mixer',
      new URLSearchParams('dyeA=1&dyeB=102&dyeC=50&ratio=30'),
      mockEnv
    );
    expect(r.url).toContain('ratio=30');
  });
});
