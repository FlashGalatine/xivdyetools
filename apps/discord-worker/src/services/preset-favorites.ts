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
  /**
   * BUG-047: presets-api answered 404 for this id when autocomplete tried to
   * back-fill its name, so it is not looked up again on every keystroke and
   * is offered under its id. Kept out of `name` on purpose: older builds wrote
   * the id there for every failed lookup, and those names still need healing.
   * Present only when true.
   */
  gone?: boolean;
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
 * OPT-007: read the denormalized favorite entries. Reads v2; falls back to the
 * legacy v1 bare-ID blob (entries get name '' until saveEntries migrates).
 *
 * BUG-006 (2026-10-04 deep-dive): this reader THROWS when a KV read fails.
 * The write paths (add/remove) use it directly, so a failed read fails the
 * write instead of being mistaken for an empty list and saved over the real
 * one. Only the read-only callers go through the lenient wrapper below.
 *
 * A v2 blob that is not JSON is the exception: unlike a failed `kv.get`, it
 * never fixes itself, so throwing on it failed every add and remove for good.
 * It is read like a v2 blob of the wrong shape — logged, then answered from
 * the v1 blob, which every save keeps in sync for exactly this — and the next
 * add or remove rewrites a valid v2. (A v1 blob that is not JSON still throws.)
 */
async function readPresetFavoriteEntries(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger,
): Promise<PresetFavoriteEntry[]> {
  const v2 = await kv.get(buildV2Key(userId));
  if (v2) {
    let parsed: unknown = null;
    try {
      parsed = JSON.parse(v2);
    } catch {
      logger?.warn('Preset favourites v2 blob is not JSON; reading the v1 blob instead');
    }
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (x): x is PresetFavoriteEntry =>
          typeof x === 'object' &&
          x !== null &&
          typeof (x as PresetFavoriteEntry).id === 'string',
      )
    ) {
      return parsed.map((e) => ({
        id: e.id,
        name: typeof e.name === 'string' ? e.name : '',
        // BUG-047: dropping the marker would bring a lookup per keystroke back
        ...(e.gone === true ? { gone: true } : {}),
      }));
    }
  }
  // Legacy v1 fallback: bare ID array
  const v1 = await kv.get(buildKey(userId));
  if (!v1) return [];
  const parsedV1: unknown = JSON.parse(v1);
  return Array.isArray(parsedV1)
    ? parsedV1.filter((x): x is string => typeof x === 'string').map((id) => ({ id, name: '' }))
    : [];
}

/**
 * OPT-007: get denormalized favorite entries for display (autocomplete,
 * `/preset favorite list`). Lenient: a failed read is logged and answered as
 * an empty list, which is safe only because nothing here writes it back.
 */
export async function getPresetFavoriteEntries(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger,
): Promise<PresetFavoriteEntry[]> {
  try {
    return await readPresetFavoriteEntries(kv, userId, logger);
  } catch (error) {
    logger?.error(
      'Failed to get preset favorite entries',
      error instanceof Error ? error : undefined,
    );
    return [];
  }
}

/** OPT-007: persist entries (v2) and keep the v1 ID blob in sync for rollback safety */
export async function savePresetFavoriteEntries(
  kv: KVNamespace,
  userId: string,
  entries: PresetFavoriteEntry[],
  _logger?: ExtendedLogger,
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
  logger?: ExtendedLogger,
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
  logger?: ExtendedLogger,
): Promise<PresetFavoriteResult> {
  try {
    // BUG-006: strict read — a failed read must not become `[]` and be saved
    const entries = await readPresetFavoriteEntries(kv, userId, logger);
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
      logger.error('Failed to add preset favorite', error instanceof Error ? error : undefined, {
        presetId,
      });
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
  logger?: ExtendedLogger,
): Promise<PresetFavoriteResult> {
  try {
    // BUG-006: strict read — a failed read is an error, not "not in the list"
    const entries = await readPresetFavoriteEntries(kv, userId, logger);
    const index = entries.findIndex((e) => e.id === presetId);
    if (index === -1) {
      return { success: false, reason: 'notFound' };
    }
    entries.splice(index, 1);
    await savePresetFavoriteEntries(kv, userId, entries, logger);
    return { success: true };
  } catch (error) {
    if (logger) {
      logger.error('Failed to remove preset favorite', error instanceof Error ? error : undefined, {
        presetId,
      });
    }
    return { success: false, reason: 'error' };
  }
}
