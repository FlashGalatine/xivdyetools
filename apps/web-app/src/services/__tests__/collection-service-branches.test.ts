/**
 * XIV Dye Tools - CollectionService Branch Coverage Tests
 *
 * Targets uncovered branches in collection-service.ts:
 * - Import data edge cases (invalid collections, non-number dyeIds)
 * - Collection update edge cases (name too long, description too long)
 * - Storage loading edge cases (truncation paths)
 * - Reorder operations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CollectionService } from '../collection-service';
import { LanguageService } from '../language-service';
// The global setup's inert vi.fn() logger: it records every call whatever the
// logging mode, so a check on its arguments covers development and production
// alike (the real logger's per-mode console output is pinned in
// components/__tests__/chara-collection-privacy.test.ts).
import { logger } from '@shared/logger';

/** The name an imported copy takes when the original name is already used. */
const importedName = (name: string, n: number): string =>
  LanguageService.tInterpolate('collections.importedSuffix', { name, n });

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('CollectionService Branch Coverage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    CollectionService.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Import Data Edge Cases (lines around 600-650)
  // ==========================================================================

  describe('importData edge cases', () => {
    it('should skip collections with missing name', () => {
      const importData = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        data: {
          collections: [
            {
              id: 'invalid-1',
              // name is missing
              dyes: [1, 2, 3],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      });

      const result = CollectionService.importData(importData);

      expect(result.collectionsImported).toBe(0);
      expect(result.errors.some((e) => e.code === 'skippedInvalid')).toBe(true);
    });

    it('should skip collections with non-array dyes', () => {
      const importData = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        data: {
          collections: [
            {
              id: 'invalid-2',
              name: 'Test Collection',
              dyes: 'not an array', // Invalid
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      });

      const result = CollectionService.importData(importData);

      expect(result.collectionsImported).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should skip non-number dye IDs in favorites during import', () => {
      const importData = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        data: {
          favorites: [100, 'not a number', null, 101, undefined],
        },
      });

      const result = CollectionService.importData(importData);

      // Only valid number IDs should be imported
      expect(result.favoritesImported).toBe(2);
      expect(CollectionService.isFavorite(100)).toBe(true);
      expect(CollectionService.isFavorite(101)).toBe(true);
    });

    it('should skip non-number dye IDs in collection dyes during import', () => {
      const importData = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        data: {
          collections: [
            {
              id: 'test-1',
              name: 'Valid Collection',
              dyes: [1, 'string', 2, null, 3],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      });

      const result = CollectionService.importData(importData);

      expect(result.collectionsImported).toBe(1);

      const collection = CollectionService.getCollectionByName('Valid Collection');
      // Only number dye IDs should be added
      expect(collection?.dyes).toEqual([1, 2, 3]);
    });

    it('should handle missing data object in import', () => {
      const importData = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        // data is missing
      });

      const result = CollectionService.importData(importData);

      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual({ code: 'missingData' });
    });

    it('should handle name conflicts with incrementing suffix', () => {
      // Create base collection
      CollectionService.createCollection('Test');
      // Create another with the name the first import would have taken
      CollectionService.createCollection(importedName('Test', 1));

      // Import with name conflict - should become Test_imported_2
      const importData = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        data: {
          collections: [
            {
              id: 'import-1',
              name: 'Test',
              dyes: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      });

      const result = CollectionService.importData(importData);

      expect(result.collectionsImported).toBe(1);
      expect(CollectionService.getCollectionByName(importedName('Test', 2))).not.toBeUndefined();
    });

    it('falls back to a plain counter when the translation dropped its {n}', () => {
      // A locale whose `importedSuffix` lost `{n}` renders the same name for
      // every suffix, which used to spin `while (getCollectionByName(name))`
      // forever. The counter fallback has to kick in on the template, not on
      // whether the digit happens to show up in the rendered string.
      CollectionService.createCollection('Test');
      const spy = vi
        .spyOn(LanguageService, 't')
        .mockImplementation((key: string) =>
          key === 'collections.importedSuffix' ? '{name} (imported)' : key
        );

      try {
        const result = CollectionService.importData(
          JSON.stringify({
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            type: 'xivdyetools-collection',
            data: {
              collections: [
                {
                  id: 'import-noplaceholder',
                  name: 'Test',
                  dyes: [],
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
            },
          })
        );

        expect(result.collectionsImported).toBe(1);
        expect(CollectionService.getCollectionByName('Test (1)')).not.toBeUndefined();
      } finally {
        spy.mockRestore();
      }
    });
  });

  // ==========================================================================
  // FINDING-004: collection descriptions are validated per record
  // ==========================================================================

  describe('importData description validation (FINDING-004)', () => {
    /** A record name that must never reach a logger call. */
    const BAD_NAME = 'DESC-NAME-3e9d71';

    const payload = (collections: unknown[]): string =>
      JSON.stringify({
        version: '2.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        data: { collections },
      });

    /** Every argument of every logger call, flattened (Errors by name + message). */
    const loggedText = (): string =>
      (['debug', 'info', 'warn', 'error', 'log', 'group', 'table'] as const)
        .flatMap((method) => vi.mocked(logger[method]).mock.calls)
        .map((args) =>
          args
            .map((arg) =>
              arg instanceof Error
                ? `${arg.name}: ${arg.message}`
                : typeof arg === 'string'
                  ? arg
                  : JSON.stringify(arg)
            )
            .join(' ')
        )
        .join('\n');

    beforeEach(() => {
      // `reset()` above logs; only what the import logs counts here.
      vi.clearAllMocks();
    });

    it('imports a record with no description key as having no description', () => {
      const result = CollectionService.importData(payload([{ name: 'No Desc', dyes: [1] }]));

      expect(result.collectionsImported).toBe(1);
      expect(result.errors).toEqual([]);
      expect(CollectionService.getCollectionByName('No Desc')?.description).toBeUndefined();
    });

    it('imports a record with a null description as having no description', () => {
      const result = CollectionService.importData(
        payload([{ name: 'Null Desc', description: null, dyes: [1] }])
      );

      expect(result.collectionsImported).toBe(1);
      expect(result.errors).toEqual([]);
      expect(CollectionService.getCollectionByName('Null Desc')?.description).toBeUndefined();
    });

    it('trims a string description', () => {
      const result = CollectionService.importData(
        payload([{ name: 'Trim Desc', description: '  kept text  ', dyes: [1] }])
      );

      expect(result.collectionsImported).toBe(1);
      expect(CollectionService.getCollectionByName('Trim Desc')?.description).toBe('kept text');
    });

    it('accepts a 200-unit description and refuses a 201-unit one as createFailed', () => {
      const result = CollectionService.importData(
        payload([
          { name: 'At Limit', description: 'd'.repeat(200), dyes: [1] },
          { name: 'Over Limit', description: 'd'.repeat(201), dyes: [1] },
        ])
      );

      expect(result.collectionsImported).toBe(1);
      expect(CollectionService.getCollectionByName('At Limit')?.description).toHaveLength(200);
      expect(result.errors).toEqual([{ code: 'createFailed', name: 'Over Limit' }]);
      expect(CollectionService.getCollectionByName('Over Limit')).toBeUndefined();
    });

    it.each([
      ['a number', 42],
      ['zero', 0],
      ['true', true],
      ['false', false],
      ['an empty array', []],
      ['an array', ['text']],
      ['an empty object', {}],
      ['an object', { text: 'text' }],
    ])(
      'rejects a description that is %s as skippedInvalid, writes nothing, and imports the next record',
      (_label, description) => {
        const result = CollectionService.importData(
          payload([
            { id: 'bad-desc', name: BAD_NAME, description, dyes: [1] },
            { id: 'next-ok', name: 'Next Valid', dyes: [2] },
          ])
        );

        expect(result.errors).toEqual([expect.objectContaining({ code: 'skippedInvalid' })]);
        expect(result.collectionsImported).toBe(1);
        expect(CollectionService.getCollectionByName(BAD_NAME)).toBeUndefined();
        expect(localStorageMock.getItem('xivdyetools_collections') ?? '').not.toContain(BAD_NAME);
        expect(CollectionService.getCollectionByName('Next Valid')?.dyes).toEqual([2]);
      }
    );

    it.each([
      ['a number', 42],
      ['a boolean', true],
      ['an array', ['text']],
      ['an object', { text: 'text' }],
    ])(
      'rejects a description that is %s before any string operation — no name and no raw TypeError in any log',
      (_label, description) => {
        CollectionService.importData(
          payload([{ id: 'bad-desc', name: BAD_NAME, description, dyes: [1] }])
        );

        const logged = loggedText();
        expect(logged).not.toContain(BAD_NAME);
        expect(logged).not.toContain('TypeError');
        expect(logged).not.toContain('trim');
      }
    );
  });

  describe('createCollection runtime misuse (FINDING-004)', () => {
    it.each([
      ['a number', 42],
      ['a boolean', true],
      ['an array', ['text']],
      ['an object', { text: 'text' }],
      ['an object with its own trim()', { trim: () => 'smuggled' }],
    ])('returns null, without throwing, for a description that is %s', (_label, description) => {
      let created: ReturnType<typeof CollectionService.createCollection> = null;

      expect(() => {
        created = CollectionService.createCollection('Misuse', description as unknown as string);
      }).not.toThrow();
      expect(created).toBeNull();
      expect(CollectionService.getCollections()).toEqual([]);
    });

    it.each([
      ['a number', 42],
      ['null', null],
      ['undefined', undefined],
      ['an object', { text: 'text' }],
      ['an object with its own trim()', { trim: () => 'Smuggled' }],
    ])('returns null, without throwing, for a name that is %s', (_label, name) => {
      let created: ReturnType<typeof CollectionService.createCollection> = null;

      expect(() => {
        created = CollectionService.createCollection(name as unknown as string);
      }).not.toThrow();
      expect(created).toBeNull();
      expect(CollectionService.getCollections()).toEqual([]);
    });

    it('still treats a null description as no description', () => {
      const created = CollectionService.createCollection('Null Ok', null as unknown as string);

      expect(created?.description).toBeUndefined();
    });
  });

  // ==========================================================================
  // Collection Update Edge Cases
  // ==========================================================================

  describe('updateCollection edge cases', () => {
    it('should reject name that is too long', () => {
      const collection = CollectionService.createCollection('Short Name');
      expect(collection).not.toBeNull();

      const longName = 'A'.repeat(100); // Exceeds MAX_COLLECTION_NAME_LENGTH (50)
      const result = CollectionService.updateCollection(collection!.id, { name: longName });

      expect(result).toBe(false);
      expect(CollectionService.getCollection(collection!.id)?.name).toBe('Short Name');
    });

    it('should reject empty name on update', () => {
      const collection = CollectionService.createCollection('Original');
      expect(collection).not.toBeNull();

      const result = CollectionService.updateCollection(collection!.id, { name: '   ' });

      expect(result).toBe(false);
      expect(CollectionService.getCollection(collection!.id)?.name).toBe('Original');
    });

    it('should reject description that is too long', () => {
      const collection = CollectionService.createCollection('Test');
      expect(collection).not.toBeNull();

      const longDescription = 'A'.repeat(300); // Exceeds MAX_DESCRIPTION_LENGTH (200)
      const result = CollectionService.updateCollection(collection!.id, {
        description: longDescription,
      });

      expect(result).toBe(false);
    });

    it('should allow clearing description with empty string', () => {
      const collection = CollectionService.createCollection('Test', 'Initial description');
      expect(collection).not.toBeNull();
      expect(collection!.description).toBe('Initial description');

      const result = CollectionService.updateCollection(collection!.id, { description: '' });

      expect(result).toBe(true);
      expect(CollectionService.getCollection(collection!.id)?.description).toBeUndefined();
    });

    it('should reject update on non-existent collection', () => {
      const result = CollectionService.updateCollection('non-existent-id', { name: 'New Name' });

      expect(result).toBe(false);
    });

    it('should reject duplicate name on update (different collection)', () => {
      CollectionService.createCollection('Existing');
      const collection = CollectionService.createCollection('Original');
      expect(collection).not.toBeNull();

      const result = CollectionService.updateCollection(collection!.id, { name: 'Existing' });

      expect(result).toBe(false);
    });

    it('should allow same name on update (same collection)', () => {
      const collection = CollectionService.createCollection('Same Name');
      expect(collection).not.toBeNull();

      // Update with same name should succeed
      const result = CollectionService.updateCollection(collection!.id, { name: 'Same Name' });

      expect(result).toBe(true);
    });
  });

  // ==========================================================================
  // Collection Creation Edge Cases
  // ==========================================================================

  describe('createCollection edge cases', () => {
    it('should reject description that is too long', () => {
      const longDescription = 'B'.repeat(300);
      const collection = CollectionService.createCollection('Test', longDescription);

      expect(collection).toBeNull();
    });

    it('should handle whitespace-only name', () => {
      const collection = CollectionService.createCollection('   ');

      expect(collection).toBeNull();
    });

    it('should trim name and description', () => {
      const collection = CollectionService.createCollection(
        '  Trimmed Name  ',
        '  Trimmed Description  '
      );

      expect(collection).not.toBeNull();
      expect(collection!.name).toBe('Trimmed Name');
      expect(collection!.description).toBe('Trimmed Description');
    });
  });

  // ==========================================================================
  // Storage Loading Edge Cases (loadFavorites/loadCollections truncation)
  // ==========================================================================

  describe('storage loading edge cases', () => {
    it('should truncate favorites exceeding max limit on load', () => {
      // Directly set localStorage with too many favorites
      const maxFavorites = CollectionService.getMaxFavorites();
      const tooManyFavorites = Array.from({ length: maxFavorites + 10 }, (_, i) => i + 1);

      localStorageMock.setItem(
        'xivdyetools_favorites',
        JSON.stringify({
          version: '1.0.0',
          favorites: tooManyFavorites,
          lastModified: new Date().toISOString(),
        })
      );

      // Reset and reinitialize to trigger loadFavorites
      CollectionService['initialized'] = false;
      CollectionService['favoritesData'] = null;

      // Access favorites to trigger initialization
      const favorites = CollectionService.getFavorites();

      expect(favorites.length).toBe(maxFavorites);
    });

    it('should truncate dyes per collection exceeding limit on load', () => {
      const maxDyesPerCollection = CollectionService.getMaxDyesPerCollection();
      const tooManyDyes = Array.from({ length: maxDyesPerCollection + 10 }, (_, i) => i + 1);

      localStorageMock.setItem(
        'xivdyetools_collections',
        JSON.stringify({
          version: '1.0.0',
          collections: [
            {
              id: 'overfilled',
              name: 'Overfilled Collection',
              dyes: tooManyDyes,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          lastModified: new Date().toISOString(),
        })
      );

      // Reset and reinitialize
      CollectionService['initialized'] = false;
      CollectionService['collectionsData'] = null;

      const collections = CollectionService.getCollections();
      expect(collections[0].dyes.length).toBe(maxDyesPerCollection);
    });

    it('should create empty structure if loaded data is invalid', () => {
      localStorageMock.setItem('xivdyetools_favorites', JSON.stringify({ invalid: 'data' }));

      // Reset and reinitialize
      CollectionService['initialized'] = false;
      CollectionService['favoritesData'] = null;

      const favorites = CollectionService.getFavorites();
      expect(favorites).toEqual([]);
    });

    it('should create empty structure if loaded collections data is invalid', () => {
      localStorageMock.setItem('xivdyetools_collections', JSON.stringify({ noCollections: true }));

      // Reset and reinitialize
      CollectionService['initialized'] = false;
      CollectionService['collectionsData'] = null;

      const collections = CollectionService.getCollections();
      expect(collections).toEqual([]);
    });
  });

  // ==========================================================================
  // Reorder Operations Edge Cases
  // ==========================================================================

  // ==========================================================================
  // Remove Dye From Collection Edge Cases
  // ==========================================================================

  describe('removeDyeFromCollection edge cases', () => {
    it('should return false when removing from non-existent collection', () => {
      const result = CollectionService.removeDyeFromCollection('non-existent', 1);
      expect(result).toBe(false);
    });

    it('should return false when removing non-existent dye from collection', () => {
      const collection = CollectionService.createCollection('Test');
      CollectionService.addDyeToCollection(collection!.id, 1);

      const result = CollectionService.removeDyeFromCollection(collection!.id, 999);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Add Dye To Collection Edge Cases
  // ==========================================================================

  describe('addDyeToCollection edge cases', () => {
    it('should return false when adding to non-existent collection', () => {
      const result = CollectionService.addDyeToCollection('non-existent', 1);
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Delete Collection Edge Cases
  // ==========================================================================

  describe('deleteCollection edge cases', () => {
    it('should return false when deleting non-existent collection', () => {
      const result = CollectionService.deleteCollection('non-existent');
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Export Edge Cases
  // ==========================================================================

  describe('export edge cases', () => {
    it('should return null when exporting non-existent collection', () => {
      const result = CollectionService.exportCollection('non-existent');
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // saveFavorites/saveCollections when data is null
  // ==========================================================================

  describe('save operations with null data', () => {
    it('should not crash when saveFavorites is called with null data', () => {
      CollectionService['favoritesData'] = null;

      // This should not throw
      expect(() => CollectionService['saveFavorites']()).not.toThrow();
    });

    it('should not crash when saveCollections is called with null data', () => {
      CollectionService['collectionsData'] = null;

      // This should not throw
      expect(() => CollectionService['saveCollections']()).not.toThrow();
    });
  });
});
