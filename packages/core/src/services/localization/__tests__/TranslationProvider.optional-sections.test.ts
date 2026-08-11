/**
 * Fallback chains for the optional LocaleData sections.
 *
 * `currencies`, `visions`, `tools` and `sheets` are optional — a generated
 * locale may omit them entirely. Each getter walks requested locale →
 * English → a formatted key, and the lower two rungs are exactly what a
 * partially-generated locale hits in production (og-worker link previews and
 * the Swatch Matcher surfaces both read these).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TranslationProvider } from '../TranslationProvider.js';
import { LocaleRegistry } from '../LocaleRegistry.js';
import type { LocaleCode, LocaleData, SheetKey, ToolKey, VisionType } from '@xivdyetools/types';

/**
 * Only the optional sections matter here; the mandatory ones are never read
 * by the four getters under test, so a minimal fixture keeps the intent
 * visible instead of burying it in 60 lines of unrelated translations.
 */
function localeFixture(
  locale: LocaleCode,
  sections: Partial<Pick<LocaleData, 'currencies' | 'visions' | 'tools' | 'sheets'>> = {}
): LocaleData {
  return {
    locale,
    meta: { version: '1.0.0', generated: '2026-01-01T00:00:00.000Z', dyeCount: 125 },
    labels: {},
    dyeNames: {},
    categories: {},
    acquisitions: {},
    metallicDyeIds: [],
    harmonyTypes: {},
    visionTypes: {},
    jobNames: {},
    grandCompanies: {},
    races: {},
    clans: {},
    ...sections,
  } as unknown as LocaleData;
}

const VISIONS: Record<VisionType, string> = {
  normal: 'Normal',
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Achromatopsia',
} as Record<VisionType, string>;

describe('TranslationProvider — optional locale sections', () => {
  let registry: LocaleRegistry;
  let provider: TranslationProvider;

  beforeEach(() => {
    registry = new LocaleRegistry();
    provider = new TranslationProvider(registry);
  });

  describe('getCurrency', () => {
    it('returns the requested locale value when present', () => {
      registry.registerLocale(localeFixture('ja', { currencies: { Gil: 'GIL-JA' } }));

      expect(provider.getCurrency('Gil', 'ja')).toBe('GIL-JA');
    });

    it('falls back to English when the locale omits the section entirely', () => {
      registry.registerLocale(localeFixture('en', { currencies: { Gil: 'Gil' } }));
      registry.registerLocale(localeFixture('ja'));

      expect(provider.getCurrency('Gil', 'ja')).toBe('Gil');
    });

    it('falls back to English when the locale has the section but not the key', () => {
      registry.registerLocale(localeFixture('en', { currencies: { Gil: 'Gil' } }));
      registry.registerLocale(localeFixture('ja', { currencies: { Scrips: 'SCRIPS-JA' } }));

      expect(provider.getCurrency('Gil', 'ja')).toBe('Gil');
    });

    it('returns the original currency when nothing translates it', () => {
      registry.registerLocale(localeFixture('en'));
      registry.registerLocale(localeFixture('ja'));

      expect(provider.getCurrency('Skybuilders Scrips', 'ja')).toBe('Skybuilders Scrips');
    });

    it('skips the English rung when English is the request', () => {
      // Nothing registered at all — exercises the `locale !== 'en'` guard
      expect(provider.getCurrency('Gil', 'en')).toBe('Gil');
    });
  });

  describe('getVisionShort', () => {
    it('returns the compact name from the requested locale', () => {
      registry.registerLocale(
        localeFixture('ja', { visions: { ...VISIONS, deuteranopia: 'DEUT-JA' } })
      );

      expect(provider.getVisionShort('deuteranopia' as VisionType, 'ja')).toBe('DEUT-JA');
    });

    it('falls back to English when the locale omits the section', () => {
      registry.registerLocale(localeFixture('en', { visions: VISIONS }));
      registry.registerLocale(localeFixture('ja'));

      expect(provider.getVisionShort('protanopia' as VisionType, 'ja')).toBe('Protanopia');
    });

    it('formats the key when no locale carries the section', () => {
      registry.registerLocale(localeFixture('en'));

      expect(provider.getVisionShort('achromatopsia' as VisionType, 'de')).toBe('Achromatopsia');
    });

    it('formats the key for English without consulting English twice', () => {
      expect(provider.getVisionShort('tritanopia' as VisionType, 'en')).toBe('Tritanopia');
    });
  });

  describe('getToolName', () => {
    const tools = { harmony: 'Harmony Explorer' } as unknown as LocaleData['tools'];

    it('returns the tool name from the requested locale', () => {
      registry.registerLocale(
        localeFixture('ja', { tools: { harmony: 'HARMONY-JA' } as unknown as LocaleData['tools'] })
      );

      expect(provider.getToolName('harmony' as ToolKey, 'ja')).toBe('HARMONY-JA');
    });

    it('falls back to English when the locale omits the section', () => {
      registry.registerLocale(localeFixture('en', { tools }));
      registry.registerLocale(localeFixture('ja'));

      expect(provider.getToolName('harmony' as ToolKey, 'ja')).toBe('Harmony Explorer');
    });

    it('formats the key when no locale carries the section', () => {
      registry.registerLocale(localeFixture('en'));

      expect(provider.getToolName('harmony' as ToolKey, 'de')).toBe('Harmony');
    });

    it('formats the key for English without consulting English twice', () => {
      expect(provider.getToolName('harmony' as ToolKey, 'en')).toBe('Harmony');
    });
  });

  describe('getSheetName', () => {
    const sheets = { eyeColors: 'Eye Colors' } as unknown as LocaleData['sheets'];

    it('returns the sheet name from the requested locale', () => {
      registry.registerLocale(
        localeFixture('ja', {
          sheets: { eyeColors: 'EYES-JA' } as unknown as LocaleData['sheets'],
        })
      );

      expect(provider.getSheetName('eyeColors' as SheetKey, 'ja')).toBe('EYES-JA');
    });

    it('falls back to English when the locale omits the section', () => {
      registry.registerLocale(localeFixture('en', { sheets }));
      registry.registerLocale(localeFixture('ja'));

      expect(provider.getSheetName('eyeColors' as SheetKey, 'ja')).toBe('Eye Colors');
    });

    it('formats the camelCase key when no locale carries the section', () => {
      registry.registerLocale(localeFixture('en'));

      expect(provider.getSheetName('eyeColors' as SheetKey, 'de')).toBe('Eye Colors');
    });

    it('formats the key for English without consulting English twice', () => {
      expect(provider.getSheetName('eyeColors' as SheetKey, 'en')).toBe('Eye Colors');
    });
  });
});
