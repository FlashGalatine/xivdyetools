import { describe, it, expect, beforeEach } from 'vitest';
import {
  CONSOLIDATED_IDS,
  CONSOLIDATED_DYES,
  isConsolidationActive,
  getMarketItemID,
  getConsolidatedDyeName,
} from '../consolidated-ids.js';

describe('consolidated-ids', () => {
  // Save original values and restore after each test
  let originalA: number | null;
  let originalB: number | null;
  let originalC: number | null;

  beforeEach(() => {
    originalA = CONSOLIDATED_IDS.A;
    originalB = CONSOLIDATED_IDS.B;
    originalC = CONSOLIDATED_IDS.C;

    // Reset to null (pre-patch state)
    CONSOLIDATED_IDS.A = null;
    CONSOLIDATED_IDS.B = null;
    CONSOLIDATED_IDS.C = null;

    return () => {
      CONSOLIDATED_IDS.A = originalA;
      CONSOLIDATED_IDS.B = originalB;
      CONSOLIDATED_IDS.C = originalC;
    };
  });

  describe('isConsolidationActive', () => {
    it('returns false when all IDs are null', () => {
      expect(isConsolidationActive()).toBe(false);
    });

    it('returns false when only some IDs are set', () => {
      CONSOLIDATED_IDS.A = 99999;
      expect(isConsolidationActive()).toBe(false);

      CONSOLIDATED_IDS.B = 99998;
      expect(isConsolidationActive()).toBe(false);
    });

    it('returns true when all IDs are set', () => {
      CONSOLIDATED_IDS.A = 99999;
      CONSOLIDATED_IDS.B = 99998;
      CONSOLIDATED_IDS.C = 99997;
      expect(isConsolidationActive()).toBe(true);
    });
  });

  describe('getMarketItemID', () => {
    it('returns original itemID when consolidation is inactive', () => {
      const dye = { itemID: 5729, consolidationType: 'A' as const };
      expect(getMarketItemID(dye)).toBe(5729);
    });

    it('returns original itemID when consolidationType is null', () => {
      CONSOLIDATED_IDS.A = 99999;
      CONSOLIDATED_IDS.B = 99998;
      CONSOLIDATED_IDS.C = 99997;

      const dye = { itemID: 13114, consolidationType: null };
      expect(getMarketItemID(dye)).toBe(13114);
    });

    it('returns consolidated ID for Type A when active', () => {
      CONSOLIDATED_IDS.A = 99999;
      CONSOLIDATED_IDS.B = 99998;
      CONSOLIDATED_IDS.C = 99997;

      const dye = { itemID: 5729, consolidationType: 'A' as const };
      expect(getMarketItemID(dye)).toBe(99999);
    });

    it('returns consolidated ID for Type B when active', () => {
      CONSOLIDATED_IDS.A = 99999;
      CONSOLIDATED_IDS.B = 99998;
      CONSOLIDATED_IDS.C = 99997;

      const dye = { itemID: 30116, consolidationType: 'B' as const };
      expect(getMarketItemID(dye)).toBe(99998);
    });

    it('returns consolidated ID for Type C when active', () => {
      CONSOLIDATED_IDS.A = 99999;
      CONSOLIDATED_IDS.B = 99998;
      CONSOLIDATED_IDS.C = 99997;

      const dye = { itemID: 48163, consolidationType: 'C' as const };
      expect(getMarketItemID(dye)).toBe(99997);
    });

    it('returns original ID for Facewear dyes (negative itemID) even when active', () => {
      CONSOLIDATED_IDS.A = 99999;
      CONSOLIDATED_IDS.B = 99998;
      CONSOLIDATED_IDS.C = 99997;

      const dye = { itemID: -1127, consolidationType: null };
      expect(getMarketItemID(dye)).toBe(-1127);
    });

    it('returns original ID for Special dyes (Pure White) when active', () => {
      CONSOLIDATED_IDS.A = 99999;
      CONSOLIDATED_IDS.B = 99998;
      CONSOLIDATED_IDS.C = 99997;

      const dye = { itemID: 13114, consolidationType: null };
      expect(getMarketItemID(dye)).toBe(13114);
    });
  });

  describe('CONSOLIDATED_DYES', () => {
    it('exposes the official Patch 7.5 names for all three types', () => {
      expect(CONSOLIDATED_DYES.A.names.en).toBe('Standard Spectrum Dye');
      expect(CONSOLIDATED_DYES.B.names.en).toBe('Wide Spectrum #1 Dye');
      expect(CONSOLIDATED_DYES.C.names.en).toBe('Wide Spectrum #2 Dye');
    });

    it('exposes procurement metadata for all three types', () => {
      expect(CONSOLIDATED_DYES.A).toMatchObject({
        itemID: 52254,
        acquisition: 'Dye Vendor',
        price: 216,
        currency: 'Gil',
      });
      expect(CONSOLIDATED_DYES.B).toMatchObject({
        itemID: 52255,
        acquisition: 'The Firmament',
        price: 1000,
        currency: "Sky Builders' Scrips",
      });
      expect(CONSOLIDATED_DYES.C).toMatchObject({
        itemID: 52256,
        acquisition: 'Cosmic Exploration',
        price: 600,
        currency: 'Cosmocredits',
      });
    });

    it('exposes ko/zh names for all three consolidated types', () => {
      expect(CONSOLIDATED_DYES.A.names.ko).toBe('염료: 기본 색상');
      expect(CONSOLIDATED_DYES.A.names.zh).toBe('通用染剂');
      expect(CONSOLIDATED_DYES.B.names.ko).toBe('염료: 추가 색상 1');
      expect(CONSOLIDATED_DYES.B.names.zh).toBe('追加染剂1');
      expect(CONSOLIDATED_DYES.C.names.ko).toBe('염료: 추가 색상 2');
      expect(CONSOLIDATED_DYES.C.names.zh).toBe('追加染剂2');
    });
  });

  describe('getConsolidatedDyeName', () => {
    it('returns the requested locale when available', () => {
      expect(getConsolidatedDyeName('A', 'en')).toBe('Standard Spectrum Dye');
      expect(getConsolidatedDyeName('A', 'ja')).toBe('カララント:ノーマルカラー');
      expect(getConsolidatedDyeName('A', 'de')).toBe('Einfacher Farbstoff');
      expect(getConsolidatedDyeName('A', 'fr')).toBe('Teinture standard');
    });

    it('returns localized ko/zh names', () => {
      expect(getConsolidatedDyeName('A', 'ko')).toBe('염료: 기본 색상');
      expect(getConsolidatedDyeName('A', 'zh')).toBe('通用染剂');
      expect(getConsolidatedDyeName('B', 'ko')).toBe('염료: 추가 색상 1');
      expect(getConsolidatedDyeName('B', 'zh')).toBe('追加染剂1');
      expect(getConsolidatedDyeName('C', 'ko')).toBe('염료: 추가 색상 2');
      expect(getConsolidatedDyeName('C', 'zh')).toBe('追加染剂2');
    });

    it('falls back to English when a locale entry is null', () => {
      // Safety-hatch coverage: future consolidation patches may ship with
      // unsourced ko/zh, so the `?? names.en` branch must keep working.
      const originalKo = CONSOLIDATED_DYES.A.names.ko;
      CONSOLIDATED_DYES.A.names.ko = null;
      try {
        expect(getConsolidatedDyeName('A', 'ko')).toBe('Standard Spectrum Dye');
      } finally {
        CONSOLIDATED_DYES.A.names.ko = originalKo;
      }
    });

    it('handles all three consolidation types', () => {
      expect(getConsolidatedDyeName('A', 'fr')).toBe('Teinture standard');
      expect(getConsolidatedDyeName('B', 'fr')).toBe('Teinture additionnelle n°1');
      expect(getConsolidatedDyeName('C', 'fr')).toBe('Teinture additionnelle n°2');
    });
  });
});
