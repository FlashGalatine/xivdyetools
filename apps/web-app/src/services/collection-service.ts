/**
 * XIV Dye Tools v2.1.0 - Collection Service
 *
 * Manages user favorites and dye collections with localStorage persistence.
 * Provides subscription model for reactive UI updates.
 *
 * @module services/collection-service
 */

import { StorageService } from './storage-service';
import { logger } from '@shared/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Dye ID type for type safety
 */
export type DyeId = number;

/**
 * Favorites data structure
 */
export interface FavoritesData {
  version: string;
  favorites: DyeId[];
  lastModified: string;
}

/**
 * Collection data structure
 */
export interface Collection {
  id: string;
  name: string;
  description?: string;
  dyes: DyeId[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Collections data structure
 */
export interface CollectionsData {
  version: string;
  collections: Collection[];
  lastModified: string;
}

/**
 * Export format for sharing
 */
export interface CollectionExport {
  version: string;
  exportedAt: string;
  type: 'xivdyetools-collection';
  data: {
    favorites?: DyeId[];
    collections?: Collection[];
  };
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  favoritesImported: number;
  collectionsImported: number;
  errors: string[];
}

// ============================================================================
// Constants
// ============================================================================

const FAVORITES_KEY = 'xivdyetools_favorites';
const COLLECTIONS_KEY = 'xivdyetools_collections';
const DATA_VERSION = '1.0.0';

// Limits per spec
const MAX_FAVORITES = 40;
const MAX_COLLECTIONS = 50;
const MAX_DYES_PER_COLLECTION = 20;
const MAX_COLLECTION_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

// ============================================================================
// Collection Service Class
// ============================================================================

/**
 * Service for managing dye favorites and collections
 * Static singleton pattern with subscription model
 */
export class CollectionService {
  private static favoritesData: FavoritesData | null = null;
  private static collectionsData: CollectionsData | null = null;
  private static favoritesListeners: Set<(favorites: DyeId[]) => void> = new Set();
  private static collectionsListeners: Set<(collections: Collection[]) => void> = new Set();
  private static initialized = false;

  // OPT-004: Map-based indexes for O(1) lookups
  private static collectionsById: Map<string, Collection> = new Map();
  private static collectionsByDyeId: Map<DyeId, Set<string>> = new Map();

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the service by loading data from storage
   */
  static initialize(): void {
    if (this.initialized) return;

    this.loadFavorites();
    this.loadCollections();
    this.initialized = true;
    logger.info('📚 CollectionService initialized');
  }

  /**
   * Load favorites from storage
   */
  private static loadFavorites(): void {
    const data = StorageService.getItem<FavoritesData>(FAVORITES_KEY);
    if (data && data.version && Array.isArray(data.favorites)) {
      // Validate and truncate if exceeds limit (prevents corrupt/edited data issues)
      if (data.favorites.length > MAX_FAVORITES) {
        logger.warn(
          `Favorites data exceeded limit (${data.favorites.length}/${MAX_FAVORITES}), truncating`
        );
        data.favorites = data.favorites.slice(0, MAX_FAVORITES);
      }
      this.favoritesData = data;
    } else {
      this.favoritesData = {
        version: DATA_VERSION,
        favorites: [],
        lastModified: new Date().toISOString(),
      };
    }
  }

  /**
   * Load collections from storage
   */
  private static loadCollections(): void {
    const data = StorageService.getItem<CollectionsData>(COLLECTIONS_KEY);
    if (data && data.version && Array.isArray(data.collections)) {
      // Validate and truncate if exceeds limit (prevents corrupt/edited data issues)
      if (data.collections.length > MAX_COLLECTIONS) {
        logger.warn(
          `Collections data exceeded limit (${data.collections.length}/${MAX_COLLECTIONS}), truncating`
        );
        data.collections = data.collections.slice(0, MAX_COLLECTIONS);
      }

      // Also validate dyes per collection
      for (const collection of data.collections) {
        if (collection.dyes.length > MAX_DYES_PER_COLLECTION) {
          logger.warn(
            `Collection "${collection.name}" exceeded dye limit (${collection.dyes.length}/${MAX_DYES_PER_COLLECTION}), truncating`
          );
          collection.dyes = collection.dyes.slice(0, MAX_DYES_PER_COLLECTION);
        }
      }

      this.collectionsData = data;
    } else {
      this.collectionsData = {
        version: DATA_VERSION,
        collections: [],
        lastModified: new Date().toISOString(),
      };
    }
    this.rebuildIndexes();
  }

  /**
   * Rebuild Map-based indexes for O(1) lookups
   * Called after loading or modifying collections data
   * Per OPT-004: Trades O(n) rebuild on write for O(1) reads
   */
  private static rebuildIndexes(): void {
    this.collectionsById.clear();
    this.collectionsByDyeId.clear();

    if (!this.collectionsData) return;

    for (const collection of this.collectionsData.collections) {
      // Index by ID
      this.collectionsById.set(collection.id, collection);

      // Index by dye ID
      for (const dyeId of collection.dyes) {
        let collectionIds = this.collectionsByDyeId.get(dyeId);
        if (!collectionIds) {
          collectionIds = new Set();
          this.collectionsByDyeId.set(dyeId, collectionIds);
        }
        collectionIds.add(collection.id);
      }
    }
  }

  /**
   * Save favorites to storage
   */
  private static saveFavorites(): void {
    if (!this.favoritesData) return;
    this.favoritesData.lastModified = new Date().toISOString();
    StorageService.setItem(FAVORITES_KEY, this.favoritesData);
    this.notifyFavoritesListeners();
  }

  /**
   * Save collections to storage
   */
  private static saveCollections(): void {
    if (!this.collectionsData) return;
    this.collectionsData.lastModified = new Date().toISOString();
    StorageService.setItem(COLLECTIONS_KEY, this.collectionsData);
    this.rebuildIndexes(); // OPT-004: Keep indexes in sync
    this.notifyCollectionsListeners();
  }

  // ============================================================================
  // Favorites API
  // ============================================================================

  /**
   * Get all favorite dye IDs
   */
  static getFavorites(): DyeId[] {
    this.initialize();
    return [...(this.favoritesData?.favorites || [])];
  }

  /**
   * Add a dye to favorites
   * @returns true if added, false if already exists or limit reached
   */
  static addFavorite(dyeId: DyeId): boolean {
    this.initialize();
    if (!this.favoritesData) return false;

    // Check if already a favorite
    if (this.favoritesData.favorites.includes(dyeId)) {
      logger.debug(`Dye ${dyeId} is already a favorite`);
      return false;
    }

    // Check limit
    if (this.favoritesData.favorites.length >= MAX_FAVORITES) {
      logger.warn(`Cannot add favorite: maximum ${MAX_FAVORITES} favorites reached`);
      return false;
    }

    this.favoritesData.favorites.push(dyeId);
    this.saveFavorites();
    logger.info(`⭐ Added dye ${dyeId} to favorites`);
    return true;
  }

  /**
   * Remove a dye from favorites
   * @returns true if removed, false if not found
   */
  static removeFavorite(dyeId: DyeId): boolean {
    this.initialize();
    if (!this.favoritesData) return false;

    const index = this.favoritesData.favorites.indexOf(dyeId);
    if (index === -1) {
      return false;
    }

    this.favoritesData.favorites.splice(index, 1);
    this.saveFavorites();
    logger.info(`☆ Removed dye ${dyeId} from favorites`);
    return true;
  }

  /**
   * Toggle a dye's favorite status
   * @returns true if now a favorite, false if removed or failed
   */
  static toggleFavorite(dyeId: DyeId): boolean {
    if (this.isFavorite(dyeId)) {
      this.removeFavorite(dyeId);
      return false;
    } else {
      return this.addFavorite(dyeId);
    }
  }

  /**
   * Check if a dye is a favorite
   */
  static isFavorite(dyeId: DyeId): boolean {
    this.initialize();
    return this.favoritesData?.favorites.includes(dyeId) ?? false;
  }

  /**
   * Reorder favorites
   */
  static reorderFavorites(dyeIds: DyeId[]): void {
    this.initialize();
    if (!this.favoritesData) return;

    // Validate all IDs are current favorites
    const currentFavorites = new Set(this.favoritesData.favorites);
    const validIds = dyeIds.filter((id) => currentFavorites.has(id));

    this.favoritesData.favorites = validIds;
    this.saveFavorites();
  }

  /**
   * Clear all favorites
   */
  static clearFavorites(): void {
    this.initialize();
    if (!this.favoritesData) return;

    this.favoritesData.favorites = [];
    this.saveFavorites();
    logger.info('Cleared all favorites');
  }

  /**
   * Get favorites count
   */
  static getFavoritesCount(): number {
    return this.getFavorites().length;
  }

  /**
   * Check if can add more favorites
   */
  static canAddFavorite(): boolean {
    return this.getFavoritesCount() < MAX_FAVORITES;
  }

  // ============================================================================
  // Collections API
  // ============================================================================

  /**
   * Get all collections
   */
  static getCollections(): Collection[] {
    this.initialize();
    return [...(this.collectionsData?.collections || [])];
  }

  /**
   * Get a specific collection by ID
   * OPT-004: O(1) Map lookup instead of O(n) array search
   */
  static getCollection(id: string): Collection | undefined {
    this.initialize();
    return this.collectionsById.get(id);
  }

  /**
   * Get a collection by name
   */
  static getCollectionByName(name: string): Collection | undefined {
    this.initialize();
    const normalized = name.toLowerCase().trim();
    return this.collectionsData?.collections.find(
      (c) => c.name.toLowerCase().trim() === normalized
    );
  }

  /**
   * Create a new collection
   * @returns The created collection, or null if failed
   */
  static createCollection(name: string, description?: string): Collection | null {
    this.initialize();
    if (!this.collectionsData) return null;

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > MAX_COLLECTION_NAME_LENGTH) {
      logger.warn('Invalid collection name');
      return null;
    }

    // Check for duplicate name
    if (this.getCollectionByName(trimmedName)) {
      logger.warn(`Collection "${trimmedName}" already exists`);
      return null;
    }

    // Check limit
    if (this.collectionsData.collections.length >= MAX_COLLECTIONS) {
      logger.warn(`Cannot create collection: maximum ${MAX_COLLECTIONS} collections reached`);
      return null;
    }

    // Validate description
    const trimmedDesc = description?.trim();
    if (trimmedDesc && trimmedDesc.length > MAX_DESCRIPTION_LENGTH) {
      logger.warn('Description too long');
      return null;
    }

    const now = new Date().toISOString();
    const collection: Collection = {
      id: this.generateId(),
      name: trimmedName,
      description: trimmedDesc,
      dyes: [],
      createdAt: now,
      updatedAt: now,
    };

    this.collectionsData.collections.push(collection);
    this.saveCollections();
    logger.info(`📁 Created collection "${trimmedName}"`);
    return collection;
  }

  /**
   * Update a collection's name or description
   */
  static updateCollection(id: string, updates: { name?: string; description?: string }): boolean {
    this.initialize();
    if (!this.collectionsData) return false;

    const collection = this.collectionsData.collections.find((c) => c.id === id);
    if (!collection) return false;

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (!trimmedName || trimmedName.length > MAX_COLLECTION_NAME_LENGTH) {
        return false;
      }
      // Check for duplicate name (excluding current collection)
      const existing = this.getCollectionByName(trimmedName);
      if (existing && existing.id !== id) {
        return false;
      }
      collection.name = trimmedName;
    }

    if (updates.description !== undefined) {
      const trimmedDesc = updates.description.trim();
      if (trimmedDesc.length > MAX_DESCRIPTION_LENGTH) {
        return false;
      }
      collection.description = trimmedDesc || undefined;
    }

    collection.updatedAt = new Date().toISOString();
    this.saveCollections();
    return true;
  }

  /**
   * Delete a collection
   */
  static deleteCollection(id: string): boolean {
    this.initialize();
    if (!this.collectionsData) return false;

    const index = this.collectionsData.collections.findIndex((c) => c.id === id);
    if (index === -1) return false;

    const deleted = this.collectionsData.collections.splice(index, 1)[0];
    this.saveCollections();
    logger.info(`🗑️ Deleted collection "${deleted.name}"`);
    return true;
  }

  /**
   * Add a dye to a collection
   */
  static addDyeToCollection(collectionId: string, dyeId: DyeId): boolean {
    this.initialize();
    if (!this.collectionsData) return false;

    const collection = this.collectionsData.collections.find((c) => c.id === collectionId);
    if (!collection) return false;

    // Check if already in collection
    if (collection.dyes.includes(dyeId)) {
      return false;
    }

    // Check limit
    if (collection.dyes.length >= MAX_DYES_PER_COLLECTION) {
      logger.warn(`Cannot add dye: maximum ${MAX_DYES_PER_COLLECTION} dyes per collection`);
      return false;
    }

    collection.dyes.push(dyeId);
    collection.updatedAt = new Date().toISOString();
    this.saveCollections();
    return true;
  }

  /**
   * Remove a dye from a collection
   */
  static removeDyeFromCollection(collectionId: string, dyeId: DyeId): boolean {
    this.initialize();
    if (!this.collectionsData) return false;

    const collection = this.collectionsData.collections.find((c) => c.id === collectionId);
    if (!collection) return false;

    const index = collection.dyes.indexOf(dyeId);
    if (index === -1) return false;

    collection.dyes.splice(index, 1);
    collection.updatedAt = new Date().toISOString();
    this.saveCollections();
    return true;
  }

  /**
   * Reorder dyes within a collection
   */
  static reorderCollectionDyes(collectionId: string, dyeIds: DyeId[]): void {
    this.initialize();
    if (!this.collectionsData) return;

    const collection = this.collectionsData.collections.find((c) => c.id === collectionId);
    if (!collection) return;

    // Validate all IDs are in current collection
    const currentDyes = new Set(collection.dyes);
    const validIds = dyeIds.filter((id) => currentDyes.has(id));

    collection.dyes = validIds;
    collection.updatedAt = new Date().toISOString();
    this.saveCollections();
  }

  /**
   * Get collections count
   */
  static getCollectionsCount(): number {
    return this.getCollections().length;
  }

  /**
   * Check if can create more collections
   */
  static canCreateCollection(): boolean {
    return this.getCollectionsCount() < MAX_COLLECTIONS;
  }

  /**
   * Get all collections that contain a specific dye
   * OPT-004: O(1) Map lookup instead of O(n*m) array search
   */
  static getCollectionsContainingDye(dyeId: DyeId): Collection[] {
    this.initialize();
    const collectionIds = this.collectionsByDyeId.get(dyeId);
    if (!collectionIds) return [];

    const collections: Collection[] = [];
    for (const id of collectionIds) {
      const collection = this.collectionsById.get(id);
      if (collection) collections.push(collection);
    }
    return collections;
  }

  // ============================================================================
  // Import/Export
  // ============================================================================

  /**
   * Export all favorites and collections as JSON string
   */
  static exportAll(): string {
    this.initialize();

    const exportData: CollectionExport = {
      version: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      type: 'xivdyetools-collection',
      data: {
        favorites: this.getFavorites(),
        collections: this.getCollections(),
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export a single collection as JSON string
   */
  static exportCollection(id: string): string | null {
    const collection = this.getCollection(id);
    if (!collection) return null;

    const exportData: CollectionExport = {
      version: DATA_VERSION,
      exportedAt: new Date().toISOString(),
      type: 'xivdyetools-collection',
      data: {
        collections: [collection],
      },
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import favorites and/or collections from JSON string
   */
  static importData(json: string): ImportResult {
    const result: ImportResult = {
      success: false,
      favoritesImported: 0,
      collectionsImported: 0,
      errors: [],
    };

    try {
      const data = JSON.parse(json) as CollectionExport;

      // Validate structure
      if (data.type !== 'xivdyetools-collection') {
        result.errors.push('Invalid file format: not an XIV Dye Tools collection');
        return result;
      }

      if (!data.data) {
        result.errors.push('Invalid file format: missing data');
        return result;
      }

      // Import favorites
      if (Array.isArray(data.data.favorites)) {
        for (const dyeId of data.data.favorites) {
          if (typeof dyeId === 'number' && this.addFavorite(dyeId)) {
            result.favoritesImported++;
          }
        }
      }

      // Import collections
      if (Array.isArray(data.data.collections)) {
        for (const collection of data.data.collections) {
          if (!collection.name || !Array.isArray(collection.dyes)) {
            result.errors.push(`Skipped invalid collection: ${collection.name || 'unnamed'}`);
            continue;
          }

          // Handle name conflicts
          let name = collection.name;
          let suffix = 1;
          while (this.getCollectionByName(name)) {
            name = `${collection.name}_imported_${suffix}`;
            suffix++;
          }

          const newCollection = this.createCollection(name, collection.description);
          if (newCollection) {
            for (const dyeId of collection.dyes) {
              if (typeof dyeId === 'number') {
                this.addDyeToCollection(newCollection.id, dyeId);
              }
            }
            result.collectionsImported++;
          } else {
            result.errors.push(`Failed to create collection: ${name}`);
          }
        }
      }

      result.success = result.favoritesImported > 0 || result.collectionsImported > 0;
      logger.info(
        `📥 Imported ${result.favoritesImported} favorites, ${result.collectionsImported} collections`
      );
    } catch (error) {
      result.errors.push('Failed to parse JSON: invalid format');
      logger.error('Import failed:', error);
    }

    return result;
  }

  // ============================================================================
  // Subscriptions
  // ============================================================================

  /**
   * Subscribe to favorites changes
   * @returns Unsubscribe function
   */
  static subscribeFavorites(listener: (favorites: DyeId[]) => void): () => void {
    this.initialize();
    this.favoritesListeners.add(listener);

    // Immediately notify with current state
    listener(this.getFavorites());

    return () => {
      this.favoritesListeners.delete(listener);
    };
  }

  /**
   * Subscribe to collections changes
   * @returns Unsubscribe function
   */
  static subscribeCollections(listener: (collections: Collection[]) => void): () => void {
    this.initialize();
    this.collectionsListeners.add(listener);

    // Immediately notify with current state
    listener(this.getCollections());

    return () => {
      this.collectionsListeners.delete(listener);
    };
  }

  /**
   * Notify all favorites listeners
   */
  private static notifyFavoritesListeners(): void {
    const favorites = this.getFavorites();
    this.favoritesListeners.forEach((listener) => listener(favorites));
  }

  /**
   * Notify all collections listeners
   */
  private static notifyCollectionsListeners(): void {
    const collections = this.getCollections();
    this.collectionsListeners.forEach((listener) => listener(collections));
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Generate a unique ID
   */
  private static generateId(): string {
    return `col_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get maximum favorites limit
   */
  static getMaxFavorites(): number {
    return MAX_FAVORITES;
  }

  /**
   * Get maximum collections limit
   */
  static getMaxCollections(): number {
    return MAX_COLLECTIONS;
  }

  /**
   * Get maximum dyes per collection limit
   */
  static getMaxDyesPerCollection(): number {
    return MAX_DYES_PER_COLLECTION;
  }

  /**
   * Reset all data (for testing)
   */
  static reset(): void {
    this.favoritesData = {
      version: DATA_VERSION,
      favorites: [],
      lastModified: new Date().toISOString(),
    };
    this.collectionsData = {
      version: DATA_VERSION,
      collections: [],
      lastModified: new Date().toISOString(),
    };
    // OPT-004: Clear indexes
    this.collectionsById.clear();
    this.collectionsByDyeId.clear();
    this.saveFavorites();
    this.saveCollections();
    logger.info('CollectionService reset');
  }
}
