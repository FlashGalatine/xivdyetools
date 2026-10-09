import { beforeAll, describe, expect, it } from 'vitest';
import { acquisitionFor, facewearAcquisitionFor, loadAcquisition } from './acquisition.js';
import table from './data/acquisition.en.json';
import facewearUnlocks from './data/facewear-unlocks.json';

describe('acquisitionFor', () => {
  // OPT-002: read before the first load is a programming error, never a silent "no line".
  it('refuses to answer before the table is loaded', () => {
    expect(() => acquisitionFor(47252)).toThrow(/loadAcquisition/);
  });

  it('reads the build-time table once loaded', async () => {
    await loadAcquisition();
    expect(acquisitionFor(47252)).toBe("Crystal Quartermaster - Wolves' Den Pier (1,500 Trophy Crystals)");
  });

  it('is undefined for an item the table does not know', async () => {
    await loadAcquisition();
    expect(acquisitionFor(-1)).toBeUndefined();
  });

  it('shares one load between callers', async () => {
    expect(loadAcquisition()).toBe(loadAcquisition());
  });
});

describe('facewear acquisitions from unlock items', () => {
  beforeAll(() => loadAcquisition());

  it('maps 61 styles and all 732 variants to their own unlock source', () => {
    const entries = Object.entries(facewearUnlocks);
    expect(entries).toHaveLength(732);
    expect(new Set(entries.map(([, itemId]) => itemId)).size).toBe(61);
    let known = 0;
    for (const [glassesId, itemId] of entries) {
      expect(facewearAcquisitionFor(Number(glassesId))).toBe(acquisitionFor(itemId));
      if (acquisitionFor(itemId)) known++;
    }
    expect(known).toBe(648);
  });

  it.each([157, 158, 168])('gives each under-rim variant %i the unlock item purchase source', (id) => {
    expect(facewearAcquisitionFor(id)).toBe("Scrip Exchange - Old Gridania (500 Purple Crafters' Scrips)");
  });

  it.each([61, 62, 72])('resolves the Monocle variant %i through the Monocles unlock item', (id) => {
    expect(facewearAcquisitionFor(id)).toBe('Maisenta - New Gridania (3,000 Gil)');
  });

  it('leaves unmapped rows and unknown unlock sources unset', () => {
    expect(facewearAcquisitionFor(0)).toBeUndefined();
    expect(facewearAcquisitionFor(409)).toBeUndefined();
    expect(facewearAcquisitionFor(65535)).toBeUndefined();
    const unknownVariants = Object.entries(facewearUnlocks).filter(([, itemId]) =>
      itemId === 52447 || (itemId >= 50308 && itemId <= 50313)
    );
    expect(unknownVariants).toHaveLength(84);
    for (const [glassesId] of unknownVariants) expect(facewearAcquisitionFor(Number(glassesId))).toBeUndefined();
  });

  it.each([637, 638, 648])('lists Kornago in Bentbranch for Teardrop Glasses variant %i', (id) => {
    expect(facewearAcquisitionFor(id)).toBe('Kornago Merchant - Central Shroud - Bentbranch Meadows (100 Faded Remnants of Resilience)');
  });
});

describe('acquisitionFor — researched sources', () => {
  beforeAll(() => loadAcquisition());

  it.each(['Varsarudh - Old Sharlayan', 'Mewazunte - Tuliyollal'])(
    'omits the price for all 127 equipment entries from %s',
    (vendor) => {
      const itemIds = Object.entries(table)
        .filter(([, line]) => line.includes(vendor))
        .map(([id]) => Number(id));
      expect(itemIds).toHaveLength(127);
      for (const itemId of itemIds) {
        expect(acquisitionFor(itemId)).toBe(vendor);
      }
    }
  );

  it.each(Array.from({ length: 55 }, (_, index) => 33043 + index))(
    'lists Enie for fiend costume equipment %i',
    (itemId) => {
      expect(acquisitionFor(itemId)).toBe(
        "Enie - Ishgard - The Firmament (3,000 Skybuilders' Scrips)"
      );
    }
  );
});
