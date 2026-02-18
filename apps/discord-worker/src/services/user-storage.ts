/**
 * User Storage Service
 *
 * Manages user favorites and collections using Cloudflare KV.
 *
 * @module services/user-storage
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import { sanitizeCollectionName, sanitizeCollectionDescription } from '../utils/sanitize.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * KV schema version for data format evolution
 * Increment when changing the data structure stored in KV
 */
const KV_SCHEMA_VERSION = 'v1';

const FAVORITES_KEY_PREFIX = `xivdye:favorites:${KV_SCHEMA_VERSION}:`;
const COLLECTIONS_KEY_PREFIX = `xivdye:collections:${KV_SCHEMA_VERSION}:`;

/** Maximum number of favorite dyes per user */
export const MAX_FAVORITES = 20;

/** Maximum number of collections per user */
export const MAX_COLLECTIONS = 50;

/** Maximum number of dyes per collection */
export const MAX_DYES_PER_COLLECTION = 20;

/** Maximum length for collection names */
export const MAX_COLLECTION_NAME_LENGTH = 50;

/** Maximum length for collection descriptions */
export const MAX_DESCRIPTION_LENGTH = 200;

// ============================================================================
// Types
// ============================================================================

/**
 * Result of an add operation
 */
export interface AddResult {
  success: boolean;
  reason?: 'alreadyExists' | 'limitReached' | 'notFound' | 'error';
}

/**
 * A dye collection
 */
export interface Collection {
  /** Unique identifier */
  id: string;
  /** Collection name */
  name: string;
  /** Optional description */
  description?: string;
  /** Array of dye IDs in the collection */
  dyes: number[];
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
}

// ============================================================================
// Favorites Functions
// ============================================================================

/**
 * Get a user's favorite dyes
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param logger - Optional logger for structured logging
 * @returns Array of dye IDs
 */
export async function getFavorites(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<number[]> {
  try {
    const data = await kv.get(`${FAVORITES_KEY_PREFIX}${userId}`);
    if (!data) return [];
    return JSON.parse(data) as number[];
  } catch (error) {
    if (logger) {
      logger.error('Failed to get favorites', error instanceof Error ? error : undefined);
    }
    return [];
  }
}

/**
 * Add a dye to user's favorites
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param dyeId - Dye ID to add
 * @param logger - Optional logger for structured logging
 * @returns Result of the operation
 */
export async function addFavorite(
  kv: KVNamespace,
  userId: string,
  dyeId: number,
  logger?: ExtendedLogger
): Promise<AddResult> {
  try {
    const favorites = await getFavorites(kv, userId, logger);

    // Check if already a favorite
    if (favorites.includes(dyeId)) {
      return { success: false, reason: 'alreadyExists' };
    }

    // Check limit
    if (favorites.length >= MAX_FAVORITES) {
      return { success: false, reason: 'limitReached' };
    }

    // Add and save
    favorites.push(dyeId);
    await kv.put(`${FAVORITES_KEY_PREFIX}${userId}`, JSON.stringify(favorites));

    return { success: true };
  } catch (error) {
    if (logger) {
      logger.error('Failed to add favorite', error instanceof Error ? error : undefined);
    }
    return { success: false, reason: 'error' };
  }
}

/**
 * Remove a dye from user's favorites
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param dyeId - Dye ID to remove
 * @param logger - Optional logger for structured logging
 * @returns True if removed, false if not found
 */
export async function removeFavorite(
  kv: KVNamespace,
  userId: string,
  dyeId: number,
  logger?: ExtendedLogger
): Promise<boolean> {
  try {
    const favorites = await getFavorites(kv, userId, logger);
    const index = favorites.indexOf(dyeId);

    if (index === -1) {
      return false;
    }

    favorites.splice(index, 1);
    await kv.put(`${FAVORITES_KEY_PREFIX}${userId}`, JSON.stringify(favorites));

    return true;
  } catch (error) {
    if (logger) {
      logger.error('Failed to remove favorite', error instanceof Error ? error : undefined);
    }
    return false;
  }
}

/**
 * Check if a dye is in user's favorites
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param dyeId - Dye ID to check
 * @returns True if dye is a favorite
 */
export async function isFavorite(
  kv: KVNamespace,
  userId: string,
  dyeId: number
): Promise<boolean> {
  const favorites = await getFavorites(kv, userId);
  return favorites.includes(dyeId);
}

/**
 * Clear all user's favorites
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param logger - Optional logger for structured logging
 */
export async function clearFavorites(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<boolean> {
  try {
    await kv.delete(`${FAVORITES_KEY_PREFIX}${userId}`);
    return true;
  } catch (error) {
    if (logger) {
      logger.error('Failed to clear favorites', error instanceof Error ? error : undefined);
    }
    return false;
  }
}

// ============================================================================
// Collections Functions
// ============================================================================

/**
 * Get all collections for a user
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param logger - Optional logger for structured logging
 * @returns Array of collections
 */
export async function getCollections(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<Collection[]> {
  try {
    const data = await kv.get(`${COLLECTIONS_KEY_PREFIX}${userId}`);
    if (!data) return [];
    return JSON.parse(data) as Collection[];
  } catch (error) {
    if (logger) {
      logger.error('Failed to get collections', error instanceof Error ? error : undefined);
    }
    return [];
  }
}

/**
 * Get a specific collection by name
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param name - Collection name (case-insensitive)
 * @param logger - Optional logger for structured logging
 * @returns Collection or null if not found
 */
export async function getCollection(
  kv: KVNamespace,
  userId: string,
  name: string,
  logger?: ExtendedLogger
): Promise<Collection | null> {
  const collections = await getCollections(kv, userId, logger);
  return collections.find((c) => c.name.toLowerCase() === name.toLowerCase()) ?? null;
}

/**
 * Create a new collection
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param name - Collection name
 * @param description - Optional description
 * @param logger - Optional logger for structured logging
 * @returns Result with collection if successful
 */
export async function createCollection(
  kv: KVNamespace,
  userId: string,
  name: string,
  description?: string,
  logger?: ExtendedLogger
): Promise<{ success: boolean; collection?: Collection; reason?: string }> {
  try {
    // SECURITY: Sanitize name and description to prevent control chars, zalgo, etc.
    const sanitizedName = sanitizeCollectionName(name);
    const sanitizedDescription = description ? sanitizeCollectionDescription(description) : undefined;

    // Reject empty names after sanitization
    if (!sanitizedName || sanitizedName.length === 0) {
      return { success: false, reason: 'invalidName' };
    }

    // Validate name length
    if (sanitizedName.length > MAX_COLLECTION_NAME_LENGTH) {
      return { success: false, reason: 'nameTooLong' };
    }

    // Validate description length
    if (sanitizedDescription && sanitizedDescription.length > MAX_DESCRIPTION_LENGTH) {
      return { success: false, reason: 'descriptionTooLong' };
    }

    const collections = await getCollections(kv, userId, logger);

    // Check for duplicate name
    if (collections.some((c) => c.name.toLowerCase() === sanitizedName.toLowerCase())) {
      return { success: false, reason: 'alreadyExists' };
    }

    // Check limit
    if (collections.length >= MAX_COLLECTIONS) {
      return { success: false, reason: 'limitReached' };
    }

    // Create new collection
    const now = new Date().toISOString();
    const collection: Collection = {
      id: crypto.randomUUID(),
      name: sanitizedName,
      description: sanitizedDescription,
      dyes: [],
      createdAt: now,
      updatedAt: now,
    };

    collections.push(collection);
    await kv.put(`${COLLECTIONS_KEY_PREFIX}${userId}`, JSON.stringify(collections));

    return { success: true, collection };
  } catch (error) {
    if (logger) {
      logger.error('Failed to create collection', error instanceof Error ? error : undefined);
    }
    return { success: false, reason: 'error' };
  }
}

/**
 * Delete a collection
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param name - Collection name to delete
 * @param logger - Optional logger for structured logging
 * @returns True if deleted, false if not found
 */
export async function deleteCollection(
  kv: KVNamespace,
  userId: string,
  name: string,
  logger?: ExtendedLogger
): Promise<boolean> {
  try {
    const collections = await getCollections(kv, userId, logger);
    const index = collections.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());

    if (index === -1) {
      return false;
    }

    collections.splice(index, 1);
    await kv.put(`${COLLECTIONS_KEY_PREFIX}${userId}`, JSON.stringify(collections));

    return true;
  } catch (error) {
    if (logger) {
      logger.error('Failed to delete collection', error instanceof Error ? error : undefined);
    }
    return false;
  }
}

/**
 * Rename a collection
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param oldName - Current collection name
 * @param newName - New collection name
 * @param logger - Optional logger for structured logging
 * @returns Result of the operation
 */
export async function renameCollection(
  kv: KVNamespace,
  userId: string,
  oldName: string,
  newName: string,
  logger?: ExtendedLogger
): Promise<{ success: boolean; reason?: string }> {
  try {
    // SECURITY: Sanitize name to prevent control chars, zalgo, etc.
    const sanitizedNewName = sanitizeCollectionName(newName);

    // Reject empty names after sanitization
    if (!sanitizedNewName || sanitizedNewName.length === 0) {
      return { success: false, reason: 'invalidName' };
    }

    // Validate new name length
    if (sanitizedNewName.length > MAX_COLLECTION_NAME_LENGTH) {
      return { success: false, reason: 'nameTooLong' };
    }

    const collections = await getCollections(kv, userId, logger);

    // Find the collection to rename
    const collection = collections.find((c) => c.name.toLowerCase() === oldName.toLowerCase());
    if (!collection) {
      return { success: false, reason: 'notFound' };
    }

    // Check if new name already exists
    if (collections.some((c) => c.name.toLowerCase() === sanitizedNewName.toLowerCase() && c.id !== collection.id)) {
      return { success: false, reason: 'alreadyExists' };
    }

    // Update name
    collection.name = sanitizedNewName;
    collection.updatedAt = new Date().toISOString();

    await kv.put(`${COLLECTIONS_KEY_PREFIX}${userId}`, JSON.stringify(collections));

    return { success: true };
  } catch (error) {
    if (logger) {
      logger.error('Failed to rename collection', error instanceof Error ? error : undefined);
    }
    return { success: false, reason: 'error' };
  }
}

/**
 * Add a dye to a collection
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param collectionName - Collection name
 * @param dyeId - Dye ID to add
 * @param logger - Optional logger for structured logging
 * @returns Result of the operation
 */
export async function addDyeToCollection(
  kv: KVNamespace,
  userId: string,
  collectionName: string,
  dyeId: number,
  logger?: ExtendedLogger
): Promise<AddResult> {
  try {
    const collections = await getCollections(kv, userId, logger);
    const collection = collections.find((c) => c.name.toLowerCase() === collectionName.toLowerCase());

    if (!collection) {
      return { success: false, reason: 'notFound' };
    }

    // Check if already in collection
    if (collection.dyes.includes(dyeId)) {
      return { success: false, reason: 'alreadyExists' };
    }

    // Check limit
    if (collection.dyes.length >= MAX_DYES_PER_COLLECTION) {
      return { success: false, reason: 'limitReached' };
    }

    // Add dye
    collection.dyes.push(dyeId);
    collection.updatedAt = new Date().toISOString();

    await kv.put(`${COLLECTIONS_KEY_PREFIX}${userId}`, JSON.stringify(collections));

    return { success: true };
  } catch (error) {
    if (logger) {
      logger.error('Failed to add dye to collection', error instanceof Error ? error : undefined);
    }
    return { success: false, reason: 'error' };
  }
}

/**
 * Remove a dye from a collection
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param collectionName - Collection name
 * @param dyeId - Dye ID to remove
 * @param logger - Optional logger for structured logging
 * @returns True if removed, false if not found
 */
export async function removeDyeFromCollection(
  kv: KVNamespace,
  userId: string,
  collectionName: string,
  dyeId: number,
  logger?: ExtendedLogger
): Promise<boolean> {
  try {
    const collections = await getCollections(kv, userId, logger);
    const collection = collections.find((c) => c.name.toLowerCase() === collectionName.toLowerCase());

    if (!collection) {
      return false;
    }

    const index = collection.dyes.indexOf(dyeId);
    if (index === -1) {
      return false;
    }

    collection.dyes.splice(index, 1);
    collection.updatedAt = new Date().toISOString();

    await kv.put(`${COLLECTIONS_KEY_PREFIX}${userId}`, JSON.stringify(collections));

    return true;
  } catch (error) {
    if (logger) {
      logger.error('Failed to remove dye from collection', error instanceof Error ? error : undefined);
    }
    return false;
  }
}
