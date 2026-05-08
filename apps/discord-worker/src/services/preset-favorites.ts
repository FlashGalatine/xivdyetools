/**
 * Preset Favorites Service
 *
 * Manages user-favorited community presets using Cloudflare KV.
 * Mirrors the dye-favorites pattern from `user-storage.ts` but stores preset IDs
 * (string UUIDs from `presets-api`) instead of dye IDs.
 *
 * KV key: `xivdye:preset_favorites:v1:{userId}` → JSON `string[]` of preset IDs.
 * The prefix is intentionally distinct from `xivdye:favorites:v1:` (dye favorites)
 * so the two namespaces don't collide.
 *
 * @module services/preset-favorites
 */

import type { ExtendedLogger } from '@xivdyetools/logger';

// ============================================================================
// Constants
// ============================================================================

const KV_SCHEMA_VERSION = 'v1';

const PRESET_FAVORITES_KEY_PREFIX = `xivdye:preset_favorites:${KV_SCHEMA_VERSION}:`;

/** Maximum number of favorited presets per user */
export const MAX_PRESET_FAVORITES = 50;

// ============================================================================
// Types
// ============================================================================

export interface PresetFavoriteResult {
  success: boolean;
  reason?: 'alreadyExists' | 'limitReached' | 'notFound' | 'error';
}

// ============================================================================
// Functions
// ============================================================================

function buildKey(userId: string): string {
  return `${PRESET_FAVORITES_KEY_PREFIX}${userId}`;
}

/**
 * Get a user's favorited preset IDs.
 */
export async function getPresetFavorites(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<string[]> {
  try {
    const data = await kv.get(buildKey(userId));
    if (!data) return [];
    const parsed: unknown = JSON.parse(data);
    return Array.isArray(parsed) && parsed.every((x): x is string => typeof x === 'string')
      ? parsed
      : [];
  } catch (error) {
    if (logger) {
      logger.error(
        'Failed to get preset favorites',
        error instanceof Error ? error : undefined,
        { userId }
      );
    }
    return [];
  }
}

/**
 * Add a preset ID to a user's favorites.
 */
export async function addPresetFavorite(
  kv: KVNamespace,
  userId: string,
  presetId: string,
  logger?: ExtendedLogger
): Promise<PresetFavoriteResult> {
  try {
    const current = await getPresetFavorites(kv, userId, logger);
    if (current.includes(presetId)) {
      return { success: false, reason: 'alreadyExists' };
    }
    if (current.length >= MAX_PRESET_FAVORITES) {
      return { success: false, reason: 'limitReached' };
    }
    current.push(presetId);
    await kv.put(buildKey(userId), JSON.stringify(current));
    return { success: true };
  } catch (error) {
    if (logger) {
      logger.error(
        'Failed to add preset favorite',
        error instanceof Error ? error : undefined,
        { userId, presetId }
      );
    }
    return { success: false, reason: 'error' };
  }
}

/**
 * Remove a preset ID from a user's favorites.
 */
export async function removePresetFavorite(
  kv: KVNamespace,
  userId: string,
  presetId: string,
  logger?: ExtendedLogger
): Promise<PresetFavoriteResult> {
  try {
    const current = await getPresetFavorites(kv, userId, logger);
    const index = current.indexOf(presetId);
    if (index === -1) {
      return { success: false, reason: 'notFound' };
    }
    current.splice(index, 1);
    if (current.length === 0) {
      await kv.delete(buildKey(userId));
    } else {
      await kv.put(buildKey(userId), JSON.stringify(current));
    }
    return { success: true };
  } catch (error) {
    if (logger) {
      logger.error(
        'Failed to remove preset favorite',
        error instanceof Error ? error : undefined,
        { userId, presetId }
      );
    }
    return { success: false, reason: 'error' };
  }
}

/**
 * Check whether a user has favorited a given preset.
 */
export async function isPresetFavorited(
  kv: KVNamespace,
  userId: string,
  presetId: string,
  logger?: ExtendedLogger
): Promise<boolean> {
  const favorites = await getPresetFavorites(kv, userId, logger);
  return favorites.includes(presetId);
}
