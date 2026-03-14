import { describe, it, expect, beforeEach } from 'vitest';
import {
  CONSOLIDATED_IDS,
  isConsolidationActive,
  getMarketItemID,
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
});
