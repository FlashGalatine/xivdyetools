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
import { StorageService } from '../storage-service';

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
      expect(result.errors.some((e) => e.includes('invalid') || e.includes('Skipped'))).toBe(true);
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
      expect(result.errors).toContain('Invalid file format: missing data');
    });

    it('should handle name conflicts with incrementing suffix', () => {
      // Create base collection
      CollectionService.createCollection('Test');
      // Create another with same name (will become Test_imported_1)
      CollectionService.createCollection('Test_imported_1');

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
      expect(CollectionService.getCollectionByName('Test_imported_2')).not.toBeUndefined();
    });

    it('should handle collection creation failure during import', () => {
      // Fill up to max collections
      const maxCollections = CollectionService.getMaxCollections();
      for (let i = 0; i < maxCollections; i++) {
        CollectionService.createCollection(`Collection ${i}`);
      }

      // Try to import more
      const importData = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        data: {
          collections: [
            {
              id: 'overflow-1',
              name: 'Overflow Collection',
              dyes: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      });

      const result = CollectionService.importData(importData);

      expect(result.collectionsImported).toBe(0);
      expect(result.errors.some((e) => e.includes('Failed to create collection'))).toBe(true);
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

    it('should truncate collections exceeding max limit on load', () => {
      // Directly set localStorage with too many collections
      const maxCollections = CollectionService.getMaxCollections();
      const tooManyCollections = Array.from({ length: maxCollections + 5 }, (_, i) => ({
        id: `col-${i}`,
        name: `Collection ${i}`,
        dyes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      localStorageMock.setItem(
        'xivdyetools_collections',
        JSON.stringify({
          version: '1.0.0',
          collections: tooManyCollections,
          lastModified: new Date().toISOString(),
        })
      );

      // Reset and reinitialize to trigger loadCollections
      CollectionService['initialized'] = false;
      CollectionService['collectionsData'] = null;

      // Access collections to trigger initialization
      const collections = CollectionService.getCollections();

      expect(collections.length).toBe(maxCollections);
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

  describe('reorder operations', () => {
    it('should filter out invalid IDs when reordering favorites', () => {
      CollectionService.addFavorite(1);
      CollectionService.addFavorite(2);
      CollectionService.addFavorite(3);

      // Reorder with some invalid IDs
      CollectionService.reorderFavorites([3, 999, 1, 888, 2]);

      const favorites = CollectionService.getFavorites();
      // Only valid IDs should remain
      expect(favorites).toEqual([3, 1, 2]);
    });

    it('should filter out invalid IDs when reordering collection dyes', () => {
      const collection = CollectionService.createCollection('Test');
      CollectionService.addDyeToCollection(collection!.id, 10);
      CollectionService.addDyeToCollection(collection!.id, 20);
      CollectionService.addDyeToCollection(collection!.id, 30);

      // Reorder with some invalid IDs
      CollectionService.reorderCollectionDyes(collection!.id, [30, 999, 10, 888]);

      const updated = CollectionService.getCollection(collection!.id);
      expect(updated?.dyes).toEqual([30, 10]);
    });

    it('should handle reorder on non-existent collection gracefully', () => {
      // Should not throw
      expect(() => {
        CollectionService.reorderCollectionDyes('non-existent', [1, 2, 3]);
      }).not.toThrow();
    });
  });

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
