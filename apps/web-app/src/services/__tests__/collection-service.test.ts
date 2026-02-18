/**
 * Unit tests for CollectionService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CollectionService } from '../collection-service';

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

describe('CollectionService', () => {
  beforeEach(() => {
    localStorageMock.clear();
    CollectionService.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Favorites', () => {
    it('should start with empty favorites', () => {
      expect(CollectionService.getFavorites()).toEqual([]);
      expect(CollectionService.getFavoritesCount()).toBe(0);
    });

    it('should add a favorite', () => {
      const result = CollectionService.addFavorite(1);
      expect(result).toBe(true);
      expect(CollectionService.getFavorites()).toContain(1);
      expect(CollectionService.getFavoritesCount()).toBe(1);
    });

    it('should not add duplicate favorites', () => {
      CollectionService.addFavorite(1);
      const result = CollectionService.addFavorite(1);
      expect(result).toBe(false);
      expect(CollectionService.getFavoritesCount()).toBe(1);
    });

    it('should remove a favorite', () => {
      CollectionService.addFavorite(1);
      const result = CollectionService.removeFavorite(1);
      expect(result).toBe(true);
      expect(CollectionService.getFavorites()).not.toContain(1);
    });

    it('should return false when removing non-existent favorite', () => {
      const result = CollectionService.removeFavorite(999);
      expect(result).toBe(false);
    });

    it('should toggle favorites correctly', () => {
      // Add
      const addResult = CollectionService.toggleFavorite(1);
      expect(addResult).toBe(true);
      expect(CollectionService.isFavorite(1)).toBe(true);

      // Remove
      const removeResult = CollectionService.toggleFavorite(1);
      expect(removeResult).toBe(false);
      expect(CollectionService.isFavorite(1)).toBe(false);
    });

    it('should check if dye is favorite', () => {
      expect(CollectionService.isFavorite(1)).toBe(false);
      CollectionService.addFavorite(1);
      expect(CollectionService.isFavorite(1)).toBe(true);
    });

    it('should enforce max favorites limit', () => {
      const max = CollectionService.getMaxFavorites();

      // Add max favorites
      for (let i = 1; i <= max; i++) {
        CollectionService.addFavorite(i);
      }

      expect(CollectionService.getFavoritesCount()).toBe(max);
      expect(CollectionService.canAddFavorite()).toBe(false);

      // Try to add one more
      const result = CollectionService.addFavorite(max + 1);
      expect(result).toBe(false);
      expect(CollectionService.getFavoritesCount()).toBe(max);
    });

    it('should clear all favorites', () => {
      CollectionService.addFavorite(1);
      CollectionService.addFavorite(2);
      CollectionService.addFavorite(3);

      CollectionService.clearFavorites();

      expect(CollectionService.getFavoritesCount()).toBe(0);
    });

    it('should reorder favorites', () => {
      CollectionService.addFavorite(1);
      CollectionService.addFavorite(2);
      CollectionService.addFavorite(3);

      CollectionService.reorderFavorites([3, 1, 2]);

      expect(CollectionService.getFavorites()).toEqual([3, 1, 2]);
    });

    it('should notify subscribers when favorites change', () => {
      const listener = vi.fn();
      const unsubscribe = CollectionService.subscribeFavorites(listener);

      // Initial call
      expect(listener).toHaveBeenCalledWith([]);

      CollectionService.addFavorite(1);
      expect(listener).toHaveBeenCalledWith([1]);

      CollectionService.removeFavorite(1);
      expect(listener).toHaveBeenCalledWith([]);

      unsubscribe();
    });
  });

  describe('Collections', () => {
    it('should start with empty collections', () => {
      expect(CollectionService.getCollections()).toEqual([]);
      expect(CollectionService.getCollectionsCount()).toBe(0);
    });

    it('should create a collection', () => {
      const collection = CollectionService.createCollection(
        'Test Collection',
        'A test description'
      );

      expect(collection).not.toBeNull();
      expect(collection!.name).toBe('Test Collection');
      expect(collection!.description).toBe('A test description');
      expect(collection!.dyes).toEqual([]);
      expect(CollectionService.getCollectionsCount()).toBe(1);
    });

    it('should not create collection with empty name', () => {
      const collection = CollectionService.createCollection('');
      expect(collection).toBeNull();
    });

    it('should not create collection with duplicate name', () => {
      CollectionService.createCollection('Test');
      const duplicate = CollectionService.createCollection('Test');
      expect(duplicate).toBeNull();
    });

    it('should get collection by ID', () => {
      const created = CollectionService.createCollection('Test');
      const retrieved = CollectionService.getCollection(created!.id);
      expect(retrieved).toEqual(created);
    });

    it('should get collection by name', () => {
      CollectionService.createCollection('My Collection');
      const retrieved = CollectionService.getCollectionByName('My Collection');
      expect(retrieved).not.toBeUndefined();
      expect(retrieved!.name).toBe('My Collection');
    });

    it('should update collection name', () => {
      const collection = CollectionService.createCollection('Old Name');
      const result = CollectionService.updateCollection(collection!.id, { name: 'New Name' });

      expect(result).toBe(true);
      expect(CollectionService.getCollection(collection!.id)!.name).toBe('New Name');
    });

    it('should update collection description', () => {
      const collection = CollectionService.createCollection('Test');
      CollectionService.updateCollection(collection!.id, { description: 'New description' });

      expect(CollectionService.getCollection(collection!.id)!.description).toBe('New description');
    });

    it('should delete collection', () => {
      const collection = CollectionService.createCollection('Test');
      const result = CollectionService.deleteCollection(collection!.id);

      expect(result).toBe(true);
      expect(CollectionService.getCollection(collection!.id)).toBeUndefined();
    });

    it('should add dye to collection', () => {
      const collection = CollectionService.createCollection('Test');
      const result = CollectionService.addDyeToCollection(collection!.id, 42);

      expect(result).toBe(true);
      expect(CollectionService.getCollection(collection!.id)!.dyes).toContain(42);
    });

    it('should not add duplicate dye to collection', () => {
      const collection = CollectionService.createCollection('Test');
      CollectionService.addDyeToCollection(collection!.id, 42);
      const result = CollectionService.addDyeToCollection(collection!.id, 42);

      expect(result).toBe(false);
      expect(CollectionService.getCollection(collection!.id)!.dyes.length).toBe(1);
    });

    it('should remove dye from collection', () => {
      const collection = CollectionService.createCollection('Test');
      CollectionService.addDyeToCollection(collection!.id, 42);
      const result = CollectionService.removeDyeFromCollection(collection!.id, 42);

      expect(result).toBe(true);
      expect(CollectionService.getCollection(collection!.id)!.dyes).not.toContain(42);
    });

    it('should enforce max dyes per collection', () => {
      const collection = CollectionService.createCollection('Test');
      const max = CollectionService.getMaxDyesPerCollection();

      for (let i = 1; i <= max; i++) {
        CollectionService.addDyeToCollection(collection!.id, i);
      }

      const result = CollectionService.addDyeToCollection(collection!.id, max + 1);
      expect(result).toBe(false);
    });

    it('should enforce max collections limit', () => {
      const max = CollectionService.getMaxCollections();

      for (let i = 1; i <= max; i++) {
        CollectionService.createCollection(`Collection ${i}`);
      }

      expect(CollectionService.canCreateCollection()).toBe(false);
      const result = CollectionService.createCollection('One More');
      expect(result).toBeNull();
    });

    it('should get collections containing a dye', () => {
      const col1 = CollectionService.createCollection('Collection 1');
      const col2 = CollectionService.createCollection('Collection 2');
      CollectionService.createCollection('Collection 3');

      CollectionService.addDyeToCollection(col1!.id, 42);
      CollectionService.addDyeToCollection(col2!.id, 42);

      const containing = CollectionService.getCollectionsContainingDye(42);
      expect(containing.length).toBe(2);
    });

    it('should notify subscribers when collections change', () => {
      const listener = vi.fn();
      const unsubscribe = CollectionService.subscribeCollections(listener);

      // Initial call
      expect(listener).toHaveBeenCalledWith([]);

      CollectionService.createCollection('Test');
      expect(listener).toHaveBeenCalled();

      unsubscribe();
    });
  });

  describe('Import/Export', () => {
    it('should export all data as JSON', () => {
      CollectionService.addFavorite(1);
      CollectionService.addFavorite(2);
      const collection = CollectionService.createCollection('Test');
      CollectionService.addDyeToCollection(collection!.id, 10);

      const exported = CollectionService.exportAll();
      const parsed = JSON.parse(exported);

      expect(parsed.type).toBe('xivdyetools-collection');
      expect(parsed.data.favorites).toEqual([1, 2]);
      expect(parsed.data.collections.length).toBe(1);
      expect(parsed.data.collections[0].dyes).toContain(10);
    });

    it('should export single collection', () => {
      const collection = CollectionService.createCollection('Test', 'Description');
      CollectionService.addDyeToCollection(collection!.id, 5);

      const exported = CollectionService.exportCollection(collection!.id);
      expect(exported).not.toBeNull();

      const parsed = JSON.parse(exported!);
      expect(parsed.data.collections.length).toBe(1);
      expect(parsed.data.collections[0].name).toBe('Test');
    });

    it('should import data correctly', () => {
      const importData = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        data: {
          favorites: [100, 101],
          collections: [
            {
              id: 'imported-1',
              name: 'Imported Collection',
              description: 'From import',
              dyes: [200, 201],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      });

      const result = CollectionService.importData(importData);

      expect(result.success).toBe(true);
      expect(result.favoritesImported).toBe(2);
      expect(result.collectionsImported).toBe(1);
      expect(CollectionService.isFavorite(100)).toBe(true);
      expect(CollectionService.getCollectionByName('Imported Collection')).not.toBeUndefined();
    });

    it('should reject invalid import format', () => {
      const result = CollectionService.importData('not valid json');
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject wrong file type', () => {
      const result = CollectionService.importData(JSON.stringify({ type: 'wrong-type' }));
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Invalid file format: not an XIV Dye Tools collection');
    });

    it('should handle duplicate collection names on import', () => {
      CollectionService.createCollection('Test');

      const importData = JSON.stringify({
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        type: 'xivdyetools-collection',
        data: {
          collections: [
            {
              id: 'new-id',
              name: 'Test',
              dyes: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      });

      const result = CollectionService.importData(importData);
      expect(result.success).toBe(true);

      // Should have renamed the imported collection
      const imported = CollectionService.getCollectionByName('Test_imported_1');
      expect(imported).not.toBeUndefined();
    });
  });
});
