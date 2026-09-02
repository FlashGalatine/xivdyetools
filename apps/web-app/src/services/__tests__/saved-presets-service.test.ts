/**
 * XIV Dye Tools - Saved presets store tests
 *
 * The store keeps a SNAPSHOT of each saved preset, so a snapshot taken before
 * the 2026-08-28 stainID rewrite still holds 4.x legacy itemIDs. These tests
 * pin the read-time conversion that keeps those snapshots renderable.
 *
 * @module services/__tests__/saved-presets-service.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'v5_saved_presets';

// Snow White is stainID 1 / legacy itemID 5729; Ash Grey is 2 / 5730.
const LEGACY_SNOW_WHITE = 5729;
const LEGACY_ASH_GREY = 5730;

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

/** Seed one saved snapshot carrying the given dye references. */
function seed(dyes: number[]): void {
  localStorageMock.setItem(
    STORAGE_KEY,
    JSON.stringify([
      {
        id: 'community-abc',
        name: 'Saved before the rewrite',
        description: '',
        category: 'gear',
        secondaryCategories: [],
        dyes,
        tags: [],
        isCurated: false,
        savedAt: '2026-08-10T00:00:00.000Z',
      },
    ])
  );
}

/** Fresh module instance — the store's load latch is module state. */
async function freshStore() {
  vi.resetModules();
  const mod = await import('../saved-presets-service');
  return mod.SavedPresetsService;
}

/** Read the dye array currently persisted under the store's key. */
function persistedDyes(): number[] {
  const raw = localStorageMock.getItem(STORAGE_KEY);
  return JSON.parse(raw as string)[0].dyes;
}

describe('SavedPresetsService legacy dye migration', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    // A per-test doMock would otherwise leak into the tests after it.
    vi.doUnmock('../dye-service-wrapper');
  });

  it('should convert legacy 4.x itemIDs in a snapshot to stainIDs', async () => {
    seed([LEGACY_SNOW_WHITE, LEGACY_ASH_GREY]);

    const store = await freshStore();

    expect(store.getAll()[0].dyes).toEqual([1, 2]);
  });

  it('should persist the converted snapshot so the conversion happens once', async () => {
    seed([LEGACY_SNOW_WHITE, LEGACY_ASH_GREY]);

    const store = await freshStore();
    store.getAll();

    expect(persistedDyes()).toEqual([1, 2]);
  });

  it('should leave an unresolvable reference in place rather than dropping it', async () => {
    seed([LEGACY_SNOW_WHITE, 999999]);

    const store = await freshStore();

    expect(store.getAll()[0].dyes).toEqual([1, 999999]);
  });

  it('should still return snapshots when the conversion itself throws', async () => {
    seed([LEGACY_SNOW_WHITE, LEGACY_ASH_GREY]);
    vi.doMock('../dye-service-wrapper', () => ({
      dyeService: {
        isLoadedStatus: () => true,
        getByStainId: () => null,
        getDyeById: () => null,
      },
      toStainId: () => {
        throw new Error('dye database exploded');
      },
    }));

    const store = await freshStore();

    // Repair is opportunistic; the shelf must survive it failing.
    expect(store.getAll()[0].dyes).toEqual([LEGACY_SNOW_WHITE, LEGACY_ASH_GREY]);
  });

  it('should not rewrite storage when every reference is already a stainID', async () => {
    seed([1, 2]);
    vi.clearAllMocks(); // seeding itself writes; count only what the store does

    const store = await freshStore();
    store.getAll();

    // StorageService probes availability with its own throwaway key, so assert
    // on the store's key rather than on setItem being untouched.
    const wroteStore = localStorageMock.setItem.mock.calls.some(([key]) => key === STORAGE_KEY);
    expect(wroteStore).toBe(false);
  });
});
