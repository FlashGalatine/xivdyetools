import { describe, it, expect, beforeEach } from 'vitest';
import { TranslationProvider } from '../TranslationProvider.js';
import { LocaleRegistry } from '../LocaleRegistry.js';
import type {
  LocaleData,
  LocaleCode,
  TranslationKey,
  HarmonyTypeKey,
  VisionType,
  RaceKey,
  ClanKey,
} from '@xivdyetools/types';

describe('TranslationProvider', () => {
  let registry: LocaleRegistry;
  let provider: TranslationProvider;

  // Mock locale data
  const mockEnglishData: LocaleData = {
    locale: 'en' as LocaleCode,
    meta: {
      version: '1.0.0',
      generated: '2025-01-01T00:00:00.000Z',
      dyeCount: 125,
    },
    labels: {
      dye: 'Dye',
      dark: 'Dark',
      metallic: 'Metallic',
      pastel: 'Pastel',
      cosmic: 'Cosmic',
      cosmicExploration: 'Cosmic Exploration',
      cosmicFortunes: 'Cosmic Fortunes',
    },
    dyeNames: {
      '5729': 'Snow White',
      '5740': 'Wine Red',
      '13116': 'Metallic Silver',
    },
    categories: {
      Reds: 'Reds',
      Blues: 'Blues',
      Neutral: 'Neutral',
      Greens: 'Greens',
    },
    acquisitions: {
      'Dye Vendor': 'Dye Vendor',
      Crafting: 'Crafting',
      'Ixali Vendor': 'Ixali Vendor',
    },
    harmonyTypes: {
      complementary: 'Complementary',
      analogous: 'Analogous',
      triadic: 'Triadic',
      splitComplementary: 'Split-Complementary',
      tetradic: 'Tetradic',
      invertedTetradic: 'Inverted Tetradic',
      square: 'Square',
      monochromatic: 'Monochromatic',
      compound: 'Compound',
      shades: 'Shades',
    },
    visionTypes: {
      normal: 'Normal Vision',
      deuteranopia: 'Deuteranopia (Red-Green Colorblindness)',
      protanopia: 'Protanopia (Red-Green Colorblindness)',
      tritanopia: 'Tritanopia (Blue-Yellow Colorblindness)',
      achromatopsia: 'Achromatopsia (Total Colorblindness)',
    },
    races: {
      hyur: 'Hyur',
      elezen: 'Elezen',
      lalafell: 'Lalafell',
      miqote: "Miqo'te",
      roegadyn: 'Roegadyn',
      auRa: 'Au Ra',
      viera: 'Viera',
      hrothgar: 'Hrothgar',
    },
    clans: {
      midlander: 'Midlander',
      highlander: 'Highlander',
      wildwood: 'Wildwood',
      duskwight: 'Duskwight',
      plainsfolk: 'Plainsfolk',
      dunesfolk: 'Dunesfolk',
      seekerOfTheSun: 'Seeker of the Sun',
      keeperOfTheMoon: 'Keeper of the Moon',
      seaWolf: 'Sea Wolf',
      hellsguard: 'Hellsguard',
      raen: 'Raen',
      xaela: 'Xaela',
      rava: 'Rava',
      veena: 'Veena',
      helions: 'Helions',
      theLost: 'The Lost',
    },
  };

  const mockJapaneseData: LocaleData = {
    ...mockEnglishData,
    locale: 'ja' as LocaleCode,
    labels: {
      dye: 'カララント',
      dark: '濃',
      metallic: 'メタリック',
      pastel: 'パステル',
      cosmic: 'コスミック',
      cosmicExploration: 'コズミック・エクスプロレーション',
      cosmicFortunes: 'コズミック・フォーチュン',
    },
    dyeNames: {
      '5729': 'スノウホワイト',
      '5740': 'ワインレッド',
      '13116': 'メタリックシルバー',
    },
    categories: {
      Reds: '赤系',
      Blues: '青系',
      Neutral: '無彩色',
      Greens: '緑系',
    },
    acquisitions: {
      'Dye Vendor': '染料販売業者',
      Crafting: 'クラフト',
      'Ixali Vendor': 'イクサル族',
    },
    harmonyTypes: {
      ...mockEnglishData.harmonyTypes,
      complementary: '補色',
      triadic: '三色配色',
    },
    visionTypes: {
      ...mockEnglishData.visionTypes,
      normal: '正常な視覚',
      deuteranopia: '2型色覚（赤緑色盲）',
    },
    races: {
      ...mockEnglishData.races,
      hyur: 'ヒューラン',
      elezen: 'エレゼン',
      lalafell: 'ララフェル',
      miqote: 'ミコッテ',
    },
    clans: {
      ...mockEnglishData.clans,
      midlander: 'ミッドランダー',
      highlander: 'ハイランダー',
      seekerOfTheSun: 'サンシーカー',
      keeperOfTheMoon: 'ムーンキーパー',
    },
  };

  beforeEach(() => {
    registry = new LocaleRegistry();
    provider = new TranslationProvider(registry);
  });

  describe('getLabel', () => {
    it('should return label from requested locale', () => {
      registry.registerLocale(mockEnglishData);

      const label = provider.getLabel('dye' as TranslationKey, 'en');
      expect(label).toBe('Dye');
    });

    it('should return Japanese label when requested', () => {
      registry.registerLocale(mockJapaneseData);

      const label = provider.getLabel('dye' as TranslationKey, 'ja');
      expect(label).toBe('カララント');
    });

    it('should fallback to English when requested locale not available', () => {
      registry.registerLocale(mockEnglishData);

      const label = provider.getLabel('dye' as TranslationKey, 'de');
      expect(label).toBe('Dye');
    });

    it('should format key when neither requested nor English locale available', () => {
      const label = provider.getLabel('cosmicExploration' as TranslationKey, 'de');
      expect(label).toBe('Cosmic Exploration');
    });

    it('should handle all label keys', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getLabel('dye' as TranslationKey, 'en')).toBe('Dye');
      expect(provider.getLabel('dark' as TranslationKey, 'en')).toBe('Dark');
      expect(provider.getLabel('metallic' as TranslationKey, 'en')).toBe('Metallic');
      expect(provider.getLabel('pastel' as TranslationKey, 'en')).toBe('Pastel');
    });
  });

  describe('getDyeName', () => {
    it('should return dye name from requested locale', () => {
      registry.registerLocale(mockEnglishData);

      const name = provider.getDyeName(5729, 'en');
      expect(name).toBe('Snow White');
    });

    it('should return Japanese dye name when requested', () => {
      registry.registerLocale(mockJapaneseData);

      const name = provider.getDyeName(5729, 'ja');
      expect(name).toBe('スノウホワイト');
    });

    it('should fallback to English when requested locale not available', () => {
      registry.registerLocale(mockEnglishData);

      const name = provider.getDyeName(5729, 'de');
      expect(name).toBe('Snow White');
    });

    it('should return null for non-existent dye ID', () => {
      registry.registerLocale(mockEnglishData);

      const name = provider.getDyeName(99999, 'en');
      expect(name).toBeNull();
    });

    // BUG-002 (2026-04-28 audit): consolidated dye items live in CONSOLIDATED_DYES,
    // not in the CSV-driven locale registry. The fallback path is exercised here.
    describe('Patch 7.5 consolidated dye fallback', () => {
      it('returns localized name for itemID 52254 (Type-A) in ja', () => {
        registry.registerLocale(mockEnglishData);
        const name = provider.getDyeName(52254, 'ja');
        expect(name).toBe('カララント:ノーマルカラー');
      });

      it('returns localized name for itemID 52255 (Type-B) in de', () => {
        const name = provider.getDyeName(52255, 'de');
        expect(name).toBe('Zusatzfarbstoff 1');
      });

      it('returns localized name for itemID 52256 (Type-C) in fr', () => {
        const name = provider.getDyeName(52256, 'fr');
        expect(name).toBe('Teinture additionnelle n°2');
      });

      it('returns English name for consolidated ID without registry data', () => {
        // No locale registered — falls straight to CONSOLIDATED_DYES
        const name = provider.getDyeName(52254, 'en');
        expect(name).toBe('Standard Spectrum Dye');
      });
    });

    it('should handle multiple dye IDs correctly', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getDyeName(5729, 'en')).toBe('Snow White');
      expect(provider.getDyeName(5740, 'en')).toBe('Wine Red');
      expect(provider.getDyeName(13116, 'en')).toBe('Metallic Silver');
    });
  });

  describe('getCategory', () => {
    it('should return category from requested locale', () => {
      registry.registerLocale(mockEnglishData);

      const category = provider.getCategory('Reds', 'en');
      expect(category).toBe('Reds');
    });

    it('should return Japanese category when requested', () => {
      registry.registerLocale(mockJapaneseData);

      const category = provider.getCategory('Reds', 'ja');
      expect(category).toBe('赤系');
    });

    it('should fallback to English when requested locale not available', () => {
      registry.registerLocale(mockEnglishData);

      const category = provider.getCategory('Reds', 'de');
      expect(category).toBe('Reds');
    });

    it('should return original category when not found in any locale', () => {
      const category = provider.getCategory('Unknown', 'en');
      expect(category).toBe('Unknown');
    });

    it('should handle all standard categories', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getCategory('Reds', 'en')).toBe('Reds');
      expect(provider.getCategory('Blues', 'en')).toBe('Blues');
      expect(provider.getCategory('Greens', 'en')).toBe('Greens');
      expect(provider.getCategory('Neutral', 'en')).toBe('Neutral');
    });
  });

  describe('getAcquisition', () => {
    it('should return acquisition method from requested locale', () => {
      registry.registerLocale(mockEnglishData);

      const acquisition = provider.getAcquisition('Dye Vendor', 'en');
      expect(acquisition).toBe('Dye Vendor');
    });

    it('should return Japanese acquisition when requested', () => {
      registry.registerLocale(mockJapaneseData);

      const acquisition = provider.getAcquisition('Dye Vendor', 'ja');
      expect(acquisition).toBe('染料販売業者');
    });

    it('should fallback to English when requested locale not available', () => {
      registry.registerLocale(mockEnglishData);

      const acquisition = provider.getAcquisition('Crafting', 'de');
      expect(acquisition).toBe('Crafting');
    });

    it('should return original acquisition when not found', () => {
      const acquisition = provider.getAcquisition('Unknown', 'en');
      expect(acquisition).toBe('Unknown');
    });

    it('should handle various acquisition methods', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getAcquisition('Dye Vendor', 'en')).toBe('Dye Vendor');
      expect(provider.getAcquisition('Crafting', 'en')).toBe('Crafting');
      expect(provider.getAcquisition('Ixali Vendor', 'en')).toBe('Ixali Vendor');
    });
  });

  describe('getHarmonyType', () => {
    it('should return harmony type from requested locale', () => {
      registry.registerLocale(mockEnglishData);

      const harmony = provider.getHarmonyType('complementary' as HarmonyTypeKey, 'en');
      expect(harmony).toBe('Complementary');
    });

    it('should return Japanese harmony type when requested', () => {
      registry.registerLocale(mockJapaneseData);

      const harmony = provider.getHarmonyType('complementary' as HarmonyTypeKey, 'ja');
      expect(harmony).toBe('補色');
    });

    it('should fallback to English when requested locale not available', () => {
      registry.registerLocale(mockEnglishData);

      const harmony = provider.getHarmonyType('triadic' as HarmonyTypeKey, 'de');
      expect(harmony).toBe('Triadic');
    });

    it('should format key when not found in any locale', () => {
      // Using 'fr' (valid LocaleCode) with no registry to test fallback to formatting
      const harmony = provider.getHarmonyType('splitComplementary' as HarmonyTypeKey, 'fr');
      expect(harmony).toBe('Split Complementary');
    });

    it('should handle all harmony types', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getHarmonyType('complementary' as HarmonyTypeKey, 'en')).toBe(
        'Complementary',
      );
      expect(provider.getHarmonyType('analogous' as HarmonyTypeKey, 'en')).toBe('Analogous');
      expect(provider.getHarmonyType('triadic' as HarmonyTypeKey, 'en')).toBe('Triadic');
      expect(provider.getHarmonyType('monochromatic' as HarmonyTypeKey, 'en')).toBe(
        'Monochromatic',
      );
    });
  });

  describe('getVisionType', () => {
    it('should return vision type from requested locale', () => {
      registry.registerLocale(mockEnglishData);

      const vision = provider.getVisionType('normal' as VisionType, 'en');
      expect(vision).toBe('Normal Vision');
    });

    it('should return Japanese vision type when requested', () => {
      registry.registerLocale(mockJapaneseData);

      const vision = provider.getVisionType('normal' as VisionType, 'ja');
      expect(vision).toBe('正常な視覚');
    });

    it('should fallback to English when requested locale not available', () => {
      registry.registerLocale(mockEnglishData);

      const vision = provider.getVisionType('deuteranopia' as VisionType, 'de');
      expect(vision).toContain('Deuteranopia');
    });

    it('should format key when not found in any locale', () => {
      // Using 'fr' (valid LocaleCode) with no registry to test fallback to formatting
      const vision = provider.getVisionType('achromatopsia' as VisionType, 'fr');
      expect(vision).toBe('Achromatopsia');
    });

    it('should handle all vision types', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getVisionType('normal' as VisionType, 'en')).toBe('Normal Vision');
      expect(provider.getVisionType('deuteranopia' as VisionType, 'en')).toContain('Deuteranopia');
      expect(provider.getVisionType('protanopia' as VisionType, 'en')).toContain('Protanopia');
      expect(provider.getVisionType('tritanopia' as VisionType, 'en')).toContain('Tritanopia');
    });
  });

  describe('fallback chain', () => {
    it('should use requested locale → English → formatted key chain', () => {
      registry.registerLocale(mockEnglishData);

      // Requested locale (not registered)
      const label1 = provider.getLabel('dye' as TranslationKey, 'de');
      expect(label1).toBe('Dye'); // Falls back to English

      // No locale registered at all
      const emptyRegistry = new LocaleRegistry();
      const emptyProvider = new TranslationProvider(emptyRegistry);
      const label2 = emptyProvider.getLabel('cosmicExploration' as TranslationKey, 'en');
      expect(label2).toBe('Cosmic Exploration'); // Formatted key
    });

    it('should not fallback to English when locale is English', () => {
      registry.registerLocale(mockEnglishData);

      const label = provider.getLabel('dye' as TranslationKey, 'en');
      expect(label).toBe('Dye');
    });

    it('should handle multiple locales with proper fallback', () => {
      registry.registerLocale(mockEnglishData);
      registry.registerLocale(mockJapaneseData);

      // Japanese locale should use Japanese
      expect(provider.getLabel('dye' as TranslationKey, 'ja')).toBe('カララント');

      // Unregistered locale should fallback to English
      expect(provider.getLabel('dye' as TranslationKey, 'fr')).toBe('Dye');
    });
  });

  describe('key formatting', () => {
    it('should format camelCase keys to Title Case', () => {
      const formatted = provider.getLabel('cosmicExploration' as TranslationKey, 'de');
      expect(formatted).toBe('Cosmic Exploration');
    });

    it('should handle harmony type key formatting', () => {
      const formatted = provider.getHarmonyType('splitComplementary' as HarmonyTypeKey, 'de');
      expect(formatted).toBe('Split Complementary');
    });

    it('should handle vision type key formatting', () => {
      const formatted = provider.getVisionType('achromatopsia' as VisionType, 'de');
      expect(formatted).toBe('Achromatopsia');
    });
  });

  describe('getRace', () => {
    it('should return race name from requested locale', () => {
      registry.registerLocale(mockEnglishData);

      const race = provider.getRace('hyur' as RaceKey, 'en');
      expect(race).toBe('Hyur');
    });

    it('should return Japanese race name when requested', () => {
      registry.registerLocale(mockJapaneseData);

      const race = provider.getRace('miqote' as RaceKey, 'ja');
      expect(race).toBe('ミコッテ');
    });

    it('should fallback to English when requested locale not available', () => {
      registry.registerLocale(mockEnglishData);

      const race = provider.getRace('viera' as RaceKey, 'de');
      expect(race).toBe('Viera');
    });

    it('should format key when not found in any locale', () => {
      const race = provider.getRace('auRa' as RaceKey, 'fr');
      expect(race).toBe('Au Ra');
    });

    it('should handle all race types', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getRace('hyur' as RaceKey, 'en')).toBe('Hyur');
      expect(provider.getRace('elezen' as RaceKey, 'en')).toBe('Elezen');
      expect(provider.getRace('lalafell' as RaceKey, 'en')).toBe('Lalafell');
      expect(provider.getRace('miqote' as RaceKey, 'en')).toBe("Miqo'te");
      expect(provider.getRace('roegadyn' as RaceKey, 'en')).toBe('Roegadyn');
      expect(provider.getRace('auRa' as RaceKey, 'en')).toBe('Au Ra');
      expect(provider.getRace('viera' as RaceKey, 'en')).toBe('Viera');
      expect(provider.getRace('hrothgar' as RaceKey, 'en')).toBe('Hrothgar');
    });

    it('should handle Japanese race names', () => {
      registry.registerLocale(mockJapaneseData);

      expect(provider.getRace('hyur' as RaceKey, 'ja')).toBe('ヒューラン');
      expect(provider.getRace('elezen' as RaceKey, 'ja')).toBe('エレゼン');
      expect(provider.getRace('lalafell' as RaceKey, 'ja')).toBe('ララフェル');
      expect(provider.getRace('miqote' as RaceKey, 'ja')).toBe('ミコッテ');
    });
  });

  describe('getClan', () => {
    it('should return clan name from requested locale', () => {
      registry.registerLocale(mockEnglishData);

      const clan = provider.getClan('midlander' as ClanKey, 'en');
      expect(clan).toBe('Midlander');
    });

    it('should return Japanese clan name when requested', () => {
      registry.registerLocale(mockJapaneseData);

      const clan = provider.getClan('seekerOfTheSun' as ClanKey, 'ja');
      expect(clan).toBe('サンシーカー');
    });

    it('should fallback to English when requested locale not available', () => {
      registry.registerLocale(mockEnglishData);

      const clan = provider.getClan('highlander' as ClanKey, 'de');
      expect(clan).toBe('Highlander');
    });

    it('should format key when not found in any locale', () => {
      const clan = provider.getClan('keeperOfTheMoon' as ClanKey, 'fr');
      expect(clan).toBe('Keeper Of The Moon');
    });

    it('should handle Hyur clans', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getClan('midlander' as ClanKey, 'en')).toBe('Midlander');
      expect(provider.getClan('highlander' as ClanKey, 'en')).toBe('Highlander');
    });

    it('should handle Elezen clans', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getClan('wildwood' as ClanKey, 'en')).toBe('Wildwood');
      expect(provider.getClan('duskwight' as ClanKey, 'en')).toBe('Duskwight');
    });

    it('should handle Lalafell clans', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getClan('plainsfolk' as ClanKey, 'en')).toBe('Plainsfolk');
      expect(provider.getClan('dunesfolk' as ClanKey, 'en')).toBe('Dunesfolk');
    });

    it("should handle Miqo'te clans", () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getClan('seekerOfTheSun' as ClanKey, 'en')).toBe('Seeker of the Sun');
      expect(provider.getClan('keeperOfTheMoon' as ClanKey, 'en')).toBe('Keeper of the Moon');
    });

    it('should handle Roegadyn clans', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getClan('seaWolf' as ClanKey, 'en')).toBe('Sea Wolf');
      expect(provider.getClan('hellsguard' as ClanKey, 'en')).toBe('Hellsguard');
    });

    it('should handle Au Ra clans', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getClan('raen' as ClanKey, 'en')).toBe('Raen');
      expect(provider.getClan('xaela' as ClanKey, 'en')).toBe('Xaela');
    });

    it('should handle Viera clans', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getClan('rava' as ClanKey, 'en')).toBe('Rava');
      expect(provider.getClan('veena' as ClanKey, 'en')).toBe('Veena');
    });

    it('should handle Hrothgar clans', () => {
      registry.registerLocale(mockEnglishData);

      expect(provider.getClan('helions' as ClanKey, 'en')).toBe('Helions');
      expect(provider.getClan('theLost' as ClanKey, 'en')).toBe('The Lost');
    });

    it('should handle Japanese clan names', () => {
      registry.registerLocale(mockJapaneseData);

      expect(provider.getClan('midlander' as ClanKey, 'ja')).toBe('ミッドランダー');
      expect(provider.getClan('highlander' as ClanKey, 'ja')).toBe('ハイランダー');
      expect(provider.getClan('seekerOfTheSun' as ClanKey, 'ja')).toBe('サンシーカー');
      expect(provider.getClan('keeperOfTheMoon' as ClanKey, 'ja')).toBe('ムーンキーパー');
    });
  });
});
