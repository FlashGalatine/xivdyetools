/**
 * XIV Dye Tools 5.0 - Collection Service
 *
 * The ONE store for saved things (register: "Saved things: one
 * CollectionService store, typed records (palette | swap | character)").
 * Records are typed by `kind`, swap records carry a `target`, and one
 * offline/tombstone/cap policy covers every kind.
 *
 * 5.0 ID convention: every stored dye reference is a **stainID** (1–254),
 * one convention with share URLs, presets and `.chara`. Records written by
 * 4.x stored `dye.id` (= legacy market itemIDs, ≥ 5729 — the "three saved-
 * thing stores, three ID schemes" defect) and migrate on load; the ranges
 * are disjoint, so detection is exact. The 4.x PaletteService store, which
 * saved localized dye *names*, migrates here as `kind: 'palette'` records.
 *
 * @module services/collection-service
 */

import { StorageService } from './storage-service';
import { dyeService } from './dye-service-wrapper';
import { LanguageService } from './language-service';
import { STORAGE_KEYS } from '@shared/constants';
import { logger } from '@shared/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Dye ID type for type safety. 5.0: semantically a stainID (1–254).
 */
export type DyeId = number;

/**
 * Typed record kinds (confirmed register entry):
 * - `palette` — a saved list of dyes (harmony palettes, 8A saved presets,
 *   9C save-to-a-list, and the sibling record a 10A glamour export creates)
 * - `swap` — budget substitutes; carries `target`
 * - `character` — a `.chara`-derived character palette (10A)
 */
export type CollectionKind = 'palette' | 'swap' | 'character';

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
  /** Typed record kind — 4.x records without one read as 'palette' */
  kind: CollectionKind;
  /** swap records only: the dye the saved substitutes replace */
  target?: DyeId;
  dyes: DyeId[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Tombstone for a deleted record — import/merge must never resurrect a
 * record the user deleted (offline copies, restored backups, other tabs).
 */
export interface Tombstone {
  id: string;
  deletedAt: string;
}

/**
 * Collections data structure
 */
export interface CollectionsData {
  version: string;
  collections: Collection[];
  tombstones?: Tombstone[];
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
 * Why import failures are codes and not sentences: this service used to push
 * English prose into `errors[]`, which `collection-manager-modal` toasted
 * verbatim in every locale. It now names the reason and (where the message
 * needs one) the collection involved; the modal owns the wording.
 */
export type ImportErrorCode =
  'invalidFormat' | 'missingData' | 'skippedInvalid' | 'createFailed' | 'parseFailed';

export interface ImportError {
  code: ImportErrorCode;
  /** Collection name, for the `{name}` in `skippedInvalid`/`createFailed`. */
  name?: string;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  favoritesImported: number;
  collectionsImported: number;
  errors: ImportError[];
}

// ============================================================================
// Constants
// ============================================================================

const FAVORITES_KEY = 'xivdyetools_favorites';
const COLLECTIONS_KEY = 'xivdyetools_collections';
/** 2.0.0 = 5.0 schema: stainID dye refs, typed records, tombstones */
const DATA_VERSION = '2.0.0';

// Limits per spec
const MAX_FAVORITES = 40;
const MAX_COLLECTIONS = 50;
const MAX_DYES_PER_COLLECTION = 20;
const MAX_COLLECTION_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_TOMBSTONES = 200;

/** stainIDs live in 1–254; legacy market itemIDs start at 5729 — disjoint */
const STAIN_ID_MAX = 254;

// ============================================================================
// 4.x → 5.0 migration helpers
// ============================================================================

/**
 * Resolve a stored dye reference to a stainID. 5.0 values (1–254) pass
 * through when the stainID exists; 4.x values (legacy itemIDs, incl. the
 * negative synthetic Facewear range) resolve via the dye database.
 * Returns null for anything unresolvable — the caller drops it loudly.
 */
function toStainId(stored: number): DyeId | null {
  if (!Number.isFinite(stored)) return null;
  if (stored >= 1 && stored <= STAIN_ID_MAX) {
    return dyeService.getByStainId(stored) ? stored : null;
  }
  // Legacy itemID (dye.id === dye.itemID in 4.x)
  const dye = dyeService.getAllDyes().find((d) => d.itemID === stored || d.id === stored);
  return dye?.stainID ?? null;
}

/** Shape of the retired 4.x PaletteService records (localized dye names) */
interface LegacySavedPalette {
  id: string;
  name: string;
  baseColor: string;
  baseDyeName: string;
  harmonyType: string;
  companions: string[];
  dateCreated: string;
}

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
    // Flag first: the palette migration goes through the public APIs
    // (createCollection etc.), which re-enter initialize()
    this.initialized = true;
    this.migrateLegacyPalettes();
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

      // 5.0: migrate stored refs to stainIDs (4.x stored legacy itemIDs)
      const migrated = this.migrateDyeIds(data.favorites, 'favorites');
      if (migrated) {
        data.favorites = migrated;
        data.version = DATA_VERSION;
        this.favoritesData = data;
        this.saveFavorites();
      } else {
        this.favoritesData = data;
      }
    } else {
      this.favoritesData = {
        version: DATA_VERSION,
        favorites: [],
        lastModified: new Date().toISOString(),
      };
    }
  }

  /**
   * Migrate an id list to stainIDs. Returns the new list when anything
   * changed (values migrated or dropped), or null when it was already clean.
   */
  private static migrateDyeIds(ids: DyeId[], label: string): DyeId[] | null {
    let changed = false;
    const out: DyeId[] = [];
    for (const stored of ids) {
      const stainId = toStainId(stored);
      if (stainId === null) {
        logger.warn(`[CollectionService] Dropped unresolvable dye ref ${stored} in ${label}`);
        changed = true;
        continue;
      }
      if (stainId !== stored) changed = true;
      // Migration can create duplicates (two legacy ids → one dye)
      if (!out.includes(stainId)) out.push(stainId);
      else changed = true;
    }
    return changed ? out : null;
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

      // Also validate dyes per collection + apply the 5.0 record shape
      let migrated = false;
      for (const collection of data.collections) {
        if (collection.dyes.length > MAX_DYES_PER_COLLECTION) {
          logger.warn(
            `Collection "${collection.name}" exceeded dye limit (${collection.dyes.length}/${MAX_DYES_PER_COLLECTION}), truncating`
          );
          collection.dyes = collection.dyes.slice(0, MAX_DYES_PER_COLLECTION);
        }

        // 5.0: 4.x records have no kind — they were dye lists, i.e. palettes
        if (!collection.kind) {
          collection.kind = 'palette';
          migrated = true;
        }

        // 5.0: stored refs become stainIDs
        const migratedDyes = this.migrateDyeIds(collection.dyes, `collection "${collection.name}"`);
        if (migratedDyes) {
          collection.dyes = migratedDyes;
          migrated = true;
        }
        if (collection.target !== undefined) {
          const target = toStainId(collection.target);
          if (target === null) {
            delete collection.target;
            migrated = true;
          } else if (target !== collection.target) {
            collection.target = target;
            migrated = true;
          }
        }
      }

      this.collectionsData = data;
      if (migrated || data.version !== DATA_VERSION) {
        data.version = DATA_VERSION;
        this.saveCollections();
      }
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
   * Migrate the retired 4.x PaletteService store (localized dye names — the
   * defect that broke records across locale switches) into `kind: 'palette'`
   * records. Base resolves by hex first (locale-free), then name; companions
   * resolve by EN name, then the current locale's dye names. Unresolvable
   * dyes drop loudly; the legacy key is removed once processed.
   */
  private static migrateLegacyPalettes(): void {
    const legacy = StorageService.getItem<LegacySavedPalette[]>(STORAGE_KEYS.SAVED_PALETTES);
    if (!legacy || !Array.isArray(legacy) || legacy.length === 0) {
      if (legacy !== null) StorageService.removeItem(STORAGE_KEYS.SAVED_PALETTES);
      return;
    }

    const allDyes = dyeService.getAllDyes();
    const byHex = new Map<string, DyeId>();
    const byName = new Map<string, DyeId>();
    for (const dye of allDyes) {
      if (dye.stainID === null) continue;
      byHex.set(dye.hex.toLowerCase(), dye.stainID);
      byName.set(dye.name.toLowerCase(), dye.stainID);
      // Names in the active locale — best-effort cover for the stored-name
      // defect (cross-locale switchers may still lose dyes, loudly)
      const localized = LanguageService.getDyeName(dye.itemID);
      if (localized) byName.set(localized.toLowerCase(), dye.stainID);
    }

    let migratedCount = 0;
    let droppedDyes = 0;
    for (const palette of legacy) {
      if (!palette || typeof palette.name !== 'string' || !Array.isArray(palette.companions)) {
        continue;
      }

      const dyes: DyeId[] = [];
      const base =
        (typeof palette.baseColor === 'string' && byHex.get(palette.baseColor.toLowerCase())) ||
        (typeof palette.baseDyeName === 'string' &&
          byName.get(palette.baseDyeName.toLowerCase())) ||
        null;
      if (base) dyes.push(base);
      else droppedDyes++;

      for (const companion of palette.companions) {
        if (typeof companion !== 'string') continue;
        const resolved = byName.get(companion.toLowerCase());
        if (resolved && !dyes.includes(resolved)) dyes.push(resolved);
        else if (!resolved) droppedDyes++;
      }

      if (dyes.length === 0) {
        logger.warn(
          `[CollectionService] Legacy palette "${palette.name}" had no resolvable dyes — dropped`
        );
        continue;
      }

      // Dedupe the name against existing records
      let name = palette.name;
      let suffix = 1;
      while (this.getCollectionByName(name)) {
        name = `${palette.name} (${suffix})`;
        suffix++;
      }

      const created = this.createCollection(name, palette.harmonyType, { kind: 'palette' });
      if (!created) {
        logger.warn(
          `[CollectionService] Could not migrate legacy palette "${palette.name}" (cap reached?)`
        );
        continue;
      }
      for (const dyeId of dyes.slice(0, MAX_DYES_PER_COLLECTION)) {
        this.addDyeToCollection(created.id, dyeId);
      }
      migratedCount++;
    }

    StorageService.removeItem(STORAGE_KEYS.SAVED_PALETTES);
    logger.info(
      `[CollectionService] Migrated ${migratedCount}/${legacy.length} legacy palettes` +
        (droppedDyes > 0 ? ` (${droppedDyes} unresolvable dye names dropped)` : '')
    );
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

    // 5.0 guard: the store only accepts stainIDs
    if (toStainId(dyeId) !== dyeId) {
      logger.warn(`[CollectionService] Rejected non-stainID favorite ${dyeId}`);
      return false;
    }

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
   * @param options.kind - Typed record kind (default 'palette')
   * @param options.target - swap records only: the dye being replaced (stainID)
   * @returns The created collection, or null if failed
   */
  static createCollection(
    name: string,
    description?: string,
    options?: { kind?: CollectionKind; target?: DyeId }
  ): Collection | null {
    this.initialize();
    if (!this.collectionsData) return null;

    // A swap's target must be a real dye
    if (options?.target !== undefined && toStainId(options.target) !== options.target) {
      logger.warn(`Invalid swap target ${options.target} — not a stainID`);
      return null;
    }

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
      kind: options?.kind ?? 'palette',
      ...(options?.target !== undefined ? { target: options.target } : {}),
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
   * Delete a collection. Leaves a tombstone so an import/merge from an
   * offline copy can never resurrect it.
   */
  static deleteCollection(id: string): boolean {
    this.initialize();
    if (!this.collectionsData) return false;

    const index = this.collectionsData.collections.findIndex((c) => c.id === id);
    if (index === -1) return false;

    const deleted = this.collectionsData.collections.splice(index, 1)[0];
    this.addTombstone(deleted.id);
    this.saveCollections();
    logger.info(`🗑️ Deleted collection "${deleted.name}"`);
    return true;
  }

  /**
   * Get collections of one typed kind
   */
  static getCollectionsByKind(kind: CollectionKind): Collection[] {
    return this.getCollections().filter((c) => c.kind === kind);
  }

  /**
   * Delete every collection of one typed kind (tombstoned).
   * @returns number of records deleted
   */
  static deleteCollectionsByKind(kind: CollectionKind): number {
    this.initialize();
    if (!this.collectionsData) return 0;

    const doomed = this.collectionsData.collections.filter((c) => c.kind === kind);
    if (doomed.length === 0) return 0;

    for (const collection of doomed) {
      this.addTombstone(collection.id);
    }
    this.collectionsData.collections = this.collectionsData.collections.filter(
      (c) => c.kind !== kind
    );
    this.saveCollections();
    logger.info(`🗑️ Deleted ${doomed.length} ${kind} collections`);
    return doomed.length;
  }

  /**
   * Record a tombstone (capped FIFO)
   */
  private static addTombstone(id: string): void {
    if (!this.collectionsData) return;
    const tombstones = this.collectionsData.tombstones ?? [];
    tombstones.push({ id, deletedAt: new Date().toISOString() });
    while (tombstones.length > MAX_TOMBSTONES) tombstones.shift();
    this.collectionsData.tombstones = tombstones;
  }

  /**
   * Check whether a record id was deleted here
   */
  static isTombstoned(id: string): boolean {
    this.initialize();
    return this.collectionsData?.tombstones?.some((t) => t.id === id) ?? false;
  }

  /**
   * Add a dye to a collection
   */
  static addDyeToCollection(collectionId: string, dyeId: DyeId): boolean {
    this.initialize();
    if (!this.collectionsData) return false;

    // 5.0 guard: the store only accepts stainIDs
    if (toStainId(dyeId) !== dyeId) {
      logger.warn(`[CollectionService] Rejected non-stainID dye ref ${dyeId}`);
      return false;
    }

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
   * Name for an imported copy when the original name is already taken.
   *
   * `LanguageService.t()` echoes the key back when the locale bundles have not
   * been loaded (unit tests, or a load failure). Every suffix would then
   * produce the identical string and the caller's uniqueness loop would spin
   * forever, so fall back to a plain counter whenever the lookup did not
   * resolve.
   */
  private static importedCopyName(baseName: string, suffix: number): string {
    const key = 'collections.importedSuffix';
    const localized = LanguageService.tInterpolate(key, { name: baseName, n: suffix });
    return localized === key ? `${baseName} (${suffix})` : localized;
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
        result.errors.push({ code: 'invalidFormat' });
        return result;
      }

      if (!data.data) {
        result.errors.push({ code: 'missingData' });
        return result;
      }

      // Import favorites (legacy exports may carry itemIDs — resolve them)
      if (Array.isArray(data.data.favorites)) {
        for (const dyeId of data.data.favorites) {
          if (typeof dyeId !== 'number') continue;
          const stainId = toStainId(dyeId);
          if (stainId !== null && this.addFavorite(stainId)) {
            result.favoritesImported++;
          }
        }
      }

      // Import collections
      if (Array.isArray(data.data.collections)) {
        for (const collection of data.data.collections) {
          if (!collection.name || !Array.isArray(collection.dyes)) {
            result.errors.push({ code: 'skippedInvalid', name: collection.name });
            continue;
          }

          // Tombstone check: never resurrect a record the user deleted here
          if (collection.id && this.isTombstoned(collection.id)) {
            logger.info(`[CollectionService] Skipped tombstoned record "${collection.name}"`);
            continue;
          }

          // Handle name conflicts
          let name = collection.name;
          let suffix = 1;
          while (this.getCollectionByName(name)) {
            name = this.importedCopyName(collection.name, suffix);
            suffix++;
          }

          const target =
            typeof collection.target === 'number'
              ? (toStainId(collection.target) ?? undefined)
              : undefined;
          const newCollection = this.createCollection(name, collection.description, {
            kind: collection.kind ?? 'palette',
            ...(target !== undefined ? { target } : {}),
          });
          if (newCollection) {
            for (const dyeId of collection.dyes) {
              if (typeof dyeId !== 'number') continue;
              const stainId = toStainId(dyeId);
              if (stainId !== null) {
                this.addDyeToCollection(newCollection.id, stainId);
              }
            }
            result.collectionsImported++;
          } else {
            result.errors.push({ code: 'createFailed', name });
          }
        }
      }

      result.success = result.favoritesImported > 0 || result.collectionsImported > 0;
      logger.info(
        `📥 Imported ${result.favoritesImported} favorites, ${result.collectionsImported} collections`
      );
    } catch (error) {
      result.errors.push({ code: 'parseFailed' });
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
   * Re-run initialization from storage — exercises the load-time
   * migrations (for testing only)
   * @internal
   */
  static __reloadForTesting(): void {
    this.initialized = false;
    this.favoritesData = null;
    this.collectionsData = null;
    this.initialize();
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
      tombstones: [],
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
