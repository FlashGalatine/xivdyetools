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

/**
 * OPT-007 (2026-07-18 audit): v2 stores denormalized `{ id, name }` entries
 * (name captured at favorite-add time) so autocomplete needs ZERO
 * service-binding calls -- the v1 bare-ID schema forced up to 50 parallel
 * presets-api fetches per keystroke. v1 blobs are lazily migrated on read.
 */
const PRESET_FAVORITES_V2_KEY_PREFIX = 'xivdye:preset_favorites:v2:';

/** Maximum number of favorited presets per user */
export const MAX_PRESET_FAVORITES = 50;

// ============================================================================
// Types
// ============================================================================

export interface PresetFavoriteResult {
  success: boolean;
  reason?: 'alreadyExists' | 'limitReached' | 'notFound' | 'error';
}

/** OPT-007: denormalized favorite entry (name may be '' for legacy v1 data) */
export interface PresetFavoriteEntry {
  id: string;
  name: string;
}

// ============================================================================
// Functions
// ============================================================================

function buildKey(userId: string): string {
  return `${PRESET_FAVORITES_KEY_PREFIX}${userId}`;
}

function buildV2Key(userId: string): string {
  return `${PRESET_FAVORITES_V2_KEY_PREFIX}${userId}`;
}

/**
 * OPT-007: get denormalized favorite entries. Reads v2; falls back to the
 * legacy v1 bare-ID blob (entries get name '' until saveEntries migrates).
 */
export async function getPresetFavoriteEntries(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<PresetFavoriteEntry[]> {
  try {
    const v2 = await kv.get(buildV2Key(userId));
    if (v2) {
      const parsed: unknown = JSON.parse(v2);
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (x): x is PresetFavoriteEntry =>
            typeof x === 'object' && x !== null && typeof (x as PresetFavoriteEntry).id === 'string'
        )
      ) {
        return parsed.map((e) => ({ id: e.id, name: typeof e.name === 'string' ? e.name : '' }));
      }
    }
    // Legacy v1 fallback: bare ID array
    const v1 = await kv.get(buildKey(userId));
    if (!v1) return [];
    const parsedV1: unknown = JSON.parse(v1);
    return Array.isArray(parsedV1)
      ? parsedV1.filter((x): x is string => typeof x === 'string').map((id) => ({ id, name: '' }))
      : [];
  } catch (error) {
    logger?.error('Failed to get preset favorite entries', error instanceof Error ? error : undefined, { userId });
    return [];
  }
}

/** OPT-007: persist entries (v2) and keep the v1 ID blob in sync for rollback safety */
export async function savePresetFavoriteEntries(
  kv: KVNamespace,
  userId: string,
  entries: PresetFavoriteEntry[],
  _logger?: ExtendedLogger
): Promise<void> {
  // Failures propagate — add/remove report them to the user; best-effort
  // callers (autocomplete lazy migration) wrap this in their own try/catch
  if (entries.length === 0) {
    await kv.delete(buildV2Key(userId));
    await kv.delete(buildKey(userId));
    return;
  }
  await kv.put(buildV2Key(userId), JSON.stringify(entries));
  await kv.put(buildKey(userId), JSON.stringify(entries.map((e) => e.id)));
}

/**
 * Get a user's favorited preset IDs.
 */
export async function getPresetFavorites(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<string[]> {
  const entries = await getPresetFavoriteEntries(kv, userId, logger);
  return entries.map((e) => e.id);
}

/**
 * Add a preset ID to a user's favorites.
 */
export async function addPresetFavorite(
  kv: KVNamespace,
  userId: string,
  presetId: string,
  presetName: string = '',
  logger?: ExtendedLogger
): Promise<PresetFavoriteResult> {
  try {
    const entries = await getPresetFavoriteEntries(kv, userId, logger);
    if (entries.some((e) => e.id === presetId)) {
      return { success: false, reason: 'alreadyExists' };
    }
    if (entries.length >= MAX_PRESET_FAVORITES) {
      return { success: false, reason: 'limitReached' };
    }
    // OPT-007: capture the name here -- the preset object is already in hand
    // at every add site, and autocomplete then needs no API calls
    entries.push({ id: presetId, name: presetName });
    await savePresetFavoriteEntries(kv, userId, entries, logger);
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
    const entries = await getPresetFavoriteEntries(kv, userId, logger);
    const index = entries.findIndex((e) => e.id === presetId);
    if (index === -1) {
      return { success: false, reason: 'notFound' };
    }
    entries.splice(index, 1);
    await savePresetFavoriteEntries(kv, userId, entries, logger);
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
