/**
 * Data-invariant tests for colors_xiv.json against the closed vocabularies.
 *
 * These assertions replace the validation role of the retired
 * `apps/maintainer` tool (duplicate itemID check) and extend it with the
 * checks the tool never had: stainID uniqueness (Glamourer/Mare interop
 * depends on it), closed-vocabulary membership, and the acquisition →
 * (price, currency) coupling.
 */
import { describe, it, expect } from 'vitest';
import rawDyes from '../../data/colors_xiv.json';
import {
  DYE_CATEGORIES,
  DYE_ACQUISITIONS,
  ACQUISITION_META,
  type DyeAcquisition,
  type DyeCategory,
} from '../dye-vocabulary.js';

interface RawDye {
  itemID: number | null;
  category: string;
  name: string;
  hex: string;
  acquisition: string;
  price: number | null;
  currency: string | null;
  stainID: number | null;
  consolidationType: string | null;
}

const dyes = rawDyes as RawDye[];

describe('colors_xiv.json data invariants', () => {
  it('contains 125 standard dyes + 11 Facewear entries', () => {
    expect(dyes).toHaveLength(136);
    expect(dyes.filter((d) => d.category === 'Facewear')).toHaveLength(11);
  });

  it('uses only known categories', () => {
    for (const dye of dyes) {
      expect(DYE_CATEGORIES).toContain(dye.category as DyeCategory);
    }
  });

  it('uses only known acquisitions', () => {
    for (const dye of dyes) {
      expect(DYE_ACQUISITIONS).toContain(dye.acquisition as DyeAcquisition);
    }
  });

  it('price and currency match ACQUISITION_META for every entry', () => {
    for (const dye of dyes) {
      const meta = ACQUISITION_META[dye.acquisition as DyeAcquisition];
      expect(dye.price, `${dye.name} price`).toBe(meta.price);
      expect(dye.currency, `${dye.name} currency`).toBe(meta.currency);
    }
  });

  it('has unique non-null itemIDs', () => {
    const ids = dyes.map((d) => d.itemID).filter((id): id is number => id !== null);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique non-null stainIDs in the Stain sheet byte range', () => {
    const ids = dyes.map((d) => d.stainID).filter((id): id is number => id !== null);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(254);
    }
  });

  it('itemID, stainID, and Facewear category are consistent', () => {
    // Facewear entries have neither itemID nor stainID; standard dyes have both.
    for (const dye of dyes) {
      const isFacewear = dye.category === 'Facewear';
      expect(dye.itemID === null, `${dye.name} itemID nullness`).toBe(isFacewear);
      expect(dye.stainID === null, `${dye.name} stainID nullness`).toBe(isFacewear);
      expect(dye.acquisition === 'Facewear Collection', `${dye.name} acquisition`).toBe(isFacewear);
    }
  });

  it('has valid 6-digit hex colors', () => {
    // Schema v2 will additionally mandate lowercase (see research/monorepo-2.0/01);
    // today the 11 Facewear entries are uppercase, so this asserts validity only.
    for (const dye of dyes) {
      expect(dye.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('uses only known consolidation types', () => {
    for (const dye of dyes) {
      expect([null, 'A', 'B', 'C']).toContain(dye.consolidationType);
    }
  });

  it('has unique names', () => {
    const names = dyes.map((d) => d.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
