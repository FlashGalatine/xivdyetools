/**
 * Unified Preferences Service (V4)
 *
 * Manages all user preferences in a single KV entry.
 * Handles migration from legacy preference keys on first access.
 *
 * KV Key: `prefs:v1:{userId}`
 *
 * Legacy keys migrated:
 * - `i18n:user:{userId}` → preferences.language
 * - `budget:world:v1:{userId}` → preferences.world
 *
 * @module services/preferences
 *
 * ⚠️ BUG-036 (2026-07-18 audit) — KNOWN LIMITATION (fix deferred): all of a
 * user's data here lives in ONE JSON blob updated get → mutate → put with no
 * concurrency control. Cloudflare KV is last-write-wins and eventually
 * consistent (~60s cross-colo), so two in-flight mutations for the same user
 * (rapid successive commands, two devices, different colos) can silently drop
 * one write. The durable fix is per-item keys (one key per favorite /
 * membership, mirroring analytics' usertrack: pattern) or a per-user Durable
 * Object — deferred because it requires a data migration of existing user
 * blobs. Until then, treat rare "my item vanished" reports as this race.
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import type { LocaleCode } from './i18n.js';
import { normalizeMatchingMethod } from '@xivdyetools/core';
import { isValidLocale } from './i18n.js';
import type {
  UserPreferences,
  PreferenceKey,
  BlendingMode,
  MatchingMethod,
  Gender,
  CardTheme,
} from '../types/preferences.js';
import {
  PREFERENCE_DEFAULTS,
  isValidBlendingMode,
  isValidMatchingMethod,
  isValidClan,
  isValidGender,
  isValidCount,
  normalizeClan,
} from '../types/preferences.js';

// ============================================================================
// Constants
// ============================================================================

/** Current schema version */
const SCHEMA_VERSION = 1;

/** KV key prefix for unified preferences */
const PREFS_KEY_PREFIX = 'prefs:v1:';

/** Legacy key prefixes for migration */
const LEGACY_I18N_PREFIX = 'i18n:user:';
const LEGACY_WORLD_PREFIX = 'budget:world:v1:';

/**
 * Longest world / data-centre name this service will store.
 *
 * FINDING-019 (2026-08-29 security audit): `world` used to accept any
 * non-empty string, so a `/preferences set world:` value of up to Discord's
 * 6000 characters was written verbatim into `prefs:v1:<userId>` and later
 * forwarded to the Universalis proxy and the shared price-cache key. Every
 * live world and data-centre name sits comfortably inside 32 characters, and
 * the same number is published as `max_length` on all four registered
 * `world` options (`commands/schemas.ts`) — `commands/schemas.test.ts` pins
 * the two together.
 */
export const WORLD_NAME_MAX_LENGTH = 32;

/**
 * True when the string contains a C0 control character or DEL.
 *
 * Deliberately NOT an ASCII check: the CN and KR worlds are non-Latin
 * (`红玉海`, `카벙클`), so anything stricter than "no control characters"
 * would lock those players out of `/budget`.
 */
function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Build a KV key for a user's preferences
 */
function buildPrefsKey(userId: string): string {
  return `${PREFS_KEY_PREFIX}${userId}`;
}

/**
 * Get a user's complete preferences object
 *
 * If no unified preferences exist, attempts to migrate from legacy keys.
 * Returns an empty object if no preferences are set (defaults apply).
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param logger - Optional logger for structured logging
 * @returns User preferences object (may be empty)
 */
export async function getUserPreferences(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger,
): Promise<UserPreferences> {
  try {
    const key = buildPrefsKey(userId);
    const data = await kv.get(key);

    if (data) {
      const prefs = JSON.parse(data) as UserPreferences;
      return prefs;
    }

    // No unified prefs - attempt migration from legacy keys
    const migrated = await migrateLegacyPreferences(kv, userId, logger);
    return migrated;
  } catch (error) {
    if (logger) {
      logger.error('Failed to get user preferences', error instanceof Error ? error : undefined);
    }
    return {};
  }
}

/**
 * Get a single preference value with fallback to default
 *
 * Resolution order: User preference → System default
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param key - Preference key to get
 * @param logger - Optional logger
 * @returns The preference value or default
 *
 * @testonly reached only by preferences.test.ts. Its sole production
 * "reference" was a stale comment in services/i18n.ts claiming a lazy import to
 * avoid a circular dependency -- code that no longer existed, since locale
 * resolution reads KV directly. REFACTOR-001 rewrote that file and the comment
 * went with it, which is what surfaced this. A deletion candidate: no command
 * path reads a single preference by key today.
 */
export async function getPreference<K extends PreferenceKey>(
  kv: KVNamespace,
  userId: string,
  key: K,
  logger?: ExtendedLogger,
): Promise<UserPreferences[K] | undefined> {
  const prefs = await getUserPreferences(kv, userId, logger);
  return (
    prefs[key] ?? ((PREFERENCE_DEFAULTS as Record<string, unknown>)[key] as UserPreferences[K])
  );
}

/**
 * Set a single preference value
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param key - Preference key to set
 * @param value - Value to set
 * @param logger - Optional logger
 * @returns Result with success status and error reason if failed
 */
export async function setPreference(
  kv: KVNamespace,
  userId: string,
  key: PreferenceKey,
  value: string | number | boolean,
  logger?: ExtendedLogger,
): Promise<{ success: boolean; reason?: string }> {
  const results = await setPreferences(kv, userId, [{ key, value }], logger);
  return results[0];
}

/**
 * Apply one validated preference onto an in-memory preferences object.
 *
 * Split out of `setPreference` so a multi-option `/preferences set` can apply
 * every key to ONE object and write it once (BUG-029).
 */
function applyPreference(
  prefs: UserPreferences,
  key: PreferenceKey,
  value: string | number | boolean,
): void {
  {
    // Update the specific preference
    switch (key) {
      case 'language':
        prefs.language = value as LocaleCode;
        break;
      case 'blending':
        prefs.blending = value as BlendingMode;
        break;
      case 'matching':
        prefs.matching = value as MatchingMethod;
        break;
      case 'count':
        prefs.count = value as number;
        break;
      case 'clan':
        prefs.clan = normalizeClan(value as string) ?? (value as string);
        break;
      case 'gender':
        prefs.gender = value as Gender;
        break;
      case 'world':
        // Store what the guard measured, not the padded original
        prefs.world = (value as string).trim();
        break;
      case 'market':
        prefs.market = value === true || value === 'on' || value === 'true';
        break;
      case 'showHex':
        prefs.showHex = value === true || value === 'on' || value === 'true';
        break;
      case 'showRgb':
        prefs.showRgb = value === true || value === 'on' || value === 'true';
        break;
      case 'showHsv':
        prefs.showHsv = value === true || value === 'on' || value === 'true';
        break;
      case 'showLab':
        prefs.showLab = value === true || value === 'on' || value === 'true';
        break;
      case 'showDeltaE':
        prefs.showDeltaE = value === true || value === 'on' || value === 'true';
        break;
      case 'showAcquisition':
        prefs.showAcquisition = value === true || value === 'on' || value === 'true';
        break;
      case 'theme':
        prefs.theme = value as CardTheme;
        break;
    }
  }
}

/**
 * Set several preferences in one read-modify-write cycle.
 *
 * BUG-029: `/preferences set` used to call `setPreference` once per option,
 * and each call was a full get → mutate → put of the SAME `prefs:v1:{userId}`
 * blob. Workers KV allows one write per second per key and is eventually
 * consistent, so a `get` issued straight after a `put` on that key is not
 * guaranteed to see it: iteration 2 could read the pre-`language` object, add
 * `matching`, and write it back — silently dropping `language` while the embed
 * reported all of them saved. `/preferences set` advertises exactly this
 * multi-option usage in its own docstring, and 14 options are settable.
 *
 * One read, every validated key applied to that one object, one write. Each
 * entry still gets its own result so the handler can list per-key failures.
 *
 * @returns one result per entry, in the order given
 */
export async function setPreferences(
  kv: KVNamespace,
  userId: string,
  entries: Array<{ key: PreferenceKey; value: string | number | boolean }>,
  logger?: ExtendedLogger,
): Promise<Array<{ success: boolean; reason?: string }>> {
  const results: Array<{ success: boolean; reason?: string }> = entries.map(() => ({
    success: false,
    reason: 'error',
  }));

  // Validate first — an invalid value never reaches the stored object, and a
  // batch where every entry is invalid does no KV work at all.
  const applicable: number[] = [];
  entries.forEach((entry, i) => {
    const validation = validatePreferenceValue(entry.key, entry.value);
    if (validation.valid) {
      applicable.push(i);
    } else {
      results[i] = { success: false, reason: validation.reason };
    }
  });

  if (applicable.length === 0) return results;

  try {
    const prefs = await getUserPreferences(kv, userId, logger);

    for (const i of applicable) {
      applyPreference(prefs, entries[i].key, entries[i].value);
    }

    // Update metadata
    prefs.updatedAt = new Date().toISOString();
    prefs._version = SCHEMA_VERSION;

    // Save to KV — one write for the whole batch
    await kv.put(buildPrefsKey(userId), JSON.stringify(prefs));

    for (const i of applicable) results[i] = { success: true };
    return results;
  } catch (error) {
    if (logger) {
      // FINDING-011 (2026-08-29 security audit): the value itself is the
      // user's home world / clan / language — personal data that has no
      // business in a log line. Its shape is what diagnoses a write failure.
      logger.error('Failed to set preferences', error instanceof Error ? error : undefined, {
        keys: applicable.map((i) => entries[i].key),
        valueTypes: applicable.map((i) => typeof entries[i].value),
        valueLengths: applicable.map((i) =>
          typeof entries[i].value === 'string' ? entries[i].value.length : undefined,
        ),
      });
    }
    return results;
  }
}

/**
 * Reset a single preference to system default
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param key - Preference key to reset (or undefined to reset all)
 * @param logger - Optional logger
 * @returns True if reset successfully
 */
export async function resetPreference(
  kv: KVNamespace,
  userId: string,
  key?: PreferenceKey,
  logger?: ExtendedLogger,
): Promise<boolean> {
  try {
    if (!key) {
      // Reset all - delete the entire preferences object
      await kv.delete(buildPrefsKey(userId));
      return true;
    }

    // Get current preferences
    const prefs = await getUserPreferences(kv, userId, logger);

    // Delete the specific key
    delete prefs[key];

    // Update metadata
    prefs.updatedAt = new Date().toISOString();
    prefs._version = SCHEMA_VERSION;

    // Save to KV (or delete if empty)
    const hasPrefs = Object.keys(prefs).some((k) => !k.startsWith('_') && k !== 'updatedAt');
    if (hasPrefs) {
      await kv.put(buildPrefsKey(userId), JSON.stringify(prefs));
    } else {
      await kv.delete(buildPrefsKey(userId));
    }

    return true;
  } catch (error) {
    if (logger) {
      logger.error('Failed to reset preference', error instanceof Error ? error : undefined, {
        key,
      });
    }
    return false;
  }
}

// ============================================================================
// Resolution Helpers
// ============================================================================

/**
 * Resolve blending mode with fallback chain
 */
export function resolveBlendingMode(
  explicit: string | undefined | null,
  prefs: UserPreferences,
): BlendingMode {
  if (explicit && isValidBlendingMode(explicit)) {
    return explicit;
  }
  return prefs.blending ?? PREFERENCE_DEFAULTS.blending;
}

/**
 * Resolve matching method with fallback chain
 */
export function resolveMatchingMethod(
  explicit: string | undefined | null,
  prefs: UserPreferences,
): MatchingMethod {
  if (explicit && isValidMatchingMethod(explicit)) {
    return explicit;
  }
  // 5.0 KV migration on read: v4 stored values (oklab-as-default era,
  // hyab, oklch-weighted) normalise into the new vocabulary; absent falls
  // to the suite default (dE2000).
  if (prefs.matching !== undefined) {
    return normalizeMatchingMethod(prefs.matching);
  }
  return PREFERENCE_DEFAULTS.matching;
}

/**
 * Resolve result count with fallback chain
 */
export function resolveCount(explicit: number | undefined | null, prefs: UserPreferences): number {
  if (explicit !== undefined && explicit !== null && isValidCount(explicit)) {
    return explicit;
  }
  return prefs.count ?? PREFERENCE_DEFAULTS.count;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a preference value for a given key
 */
export function validatePreferenceValue(
  key: PreferenceKey,
  value: unknown,
): { valid: boolean; reason?: string } {
  switch (key) {
    case 'language':
      if (typeof value !== 'string' || !isValidLocale(value)) {
        return { valid: false, reason: 'invalidLanguage' };
      }
      break;

    case 'blending':
      if (typeof value !== 'string' || !isValidBlendingMode(value)) {
        return { valid: false, reason: 'invalidBlendingMode' };
      }
      break;

    case 'matching':
      if (typeof value !== 'string' || !isValidMatchingMethod(value)) {
        return { valid: false, reason: 'invalidMatchingMethod' };
      }
      break;

    case 'count': {
      const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
      if (typeof numValue !== 'number' || !isValidCount(numValue)) {
        return { valid: false, reason: 'invalidCount' };
      }
      break;
    }

    case 'clan':
      if (typeof value !== 'string' || !isValidClan(value)) {
        return { valid: false, reason: 'invalidClan' };
      }
      break;

    case 'gender':
      if (typeof value !== 'string' || !isValidGender(value)) {
        return { valid: false, reason: 'invalidGender' };
      }
      break;

    case 'world': {
      // Shape only (FINDING-019). Whether the name exists is settled by the
      // async, Universalis-backed `validateWorld()` in the command handlers —
      // this switch is synchronous and cannot make that call.
      if (typeof value !== 'string') {
        return { valid: false, reason: 'invalidWorld' };
      }
      const trimmed = value.trim();
      if (
        trimmed.length === 0 ||
        trimmed.length > WORLD_NAME_MAX_LENGTH ||
        hasControlCharacters(trimmed)
      ) {
        return { valid: false, reason: 'invalidWorld' };
      }
      break;
    }

    case 'theme':
      if (value !== 'dark' && value !== 'light') {
        return { valid: false, reason: 'invalidTheme' };
      }
      break;

    case 'market':
    case 'showHex':
    case 'showRgb':
    case 'showHsv':
    case 'showLab':
    case 'showDeltaE':
    case 'showAcquisition':
      // Accept boolean, "on"/"off", "true"/"false"
      if (typeof value === 'boolean') break;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (!['on', 'off', 'true', 'false'].includes(lower)) {
          return { valid: false, reason: 'invalidBoolean' };
        }
      } else {
        return { valid: false, reason: 'invalidBoolean' };
      }
      break;
  }

  return { valid: true };
}

// ============================================================================
// Migration
// ============================================================================

/**
 * Migrate legacy preference keys to unified preferences
 *
 * This is called automatically when getUserPreferences finds no unified prefs.
 * Reads from legacy keys and creates a unified preferences object.
 *
 * Legacy keys are NOT deleted - they serve as fallback during transition.
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param logger - Optional logger
 * @returns Migrated preferences object
 */
async function migrateLegacyPreferences(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger,
): Promise<UserPreferences> {
  const prefs: UserPreferences = {};
  let hasMigrated = false;

  try {
    // Migrate language from i18n:user:{userId}
    const legacyLanguage = await kv.get(`${LEGACY_I18N_PREFIX}${userId}`);
    if (legacyLanguage && isValidLocale(legacyLanguage)) {
      prefs.language = legacyLanguage;
      hasMigrated = true;
    }

    // Migrate world from budget:world:v1:{userId}
    const legacyWorldData = await kv.get(`${LEGACY_WORLD_PREFIX}${userId}`);
    if (legacyWorldData) {
      try {
        const worldPref = JSON.parse(legacyWorldData) as { world?: string };
        if (worldPref.world) {
          prefs.world = worldPref.world;
          hasMigrated = true;
        }
      } catch {
        // Invalid JSON in legacy key, skip
      }
    }

    // If we migrated anything, save to unified key
    if (hasMigrated) {
      prefs.updatedAt = new Date().toISOString();
      prefs._version = SCHEMA_VERSION;
      await kv.put(buildPrefsKey(userId), JSON.stringify(prefs));

      if (logger) {
        logger.info('Migrated legacy preferences to unified format', {
          userId,
          keys: Object.keys(prefs),
        });
      }
    }
  } catch (error) {
    if (logger) {
      logger.error(
        'Failed to migrate legacy preferences',
        error instanceof Error ? error : undefined,
      );
    }
  }

  return prefs;
}

/**
 * Get the default value for a preference key
 */
export function getDefaultValue(key: PreferenceKey): string | number | boolean | undefined {
  switch (key) {
    case 'language':
      return PREFERENCE_DEFAULTS.language;
    case 'blending':
      return PREFERENCE_DEFAULTS.blending;
    case 'matching':
      return PREFERENCE_DEFAULTS.matching;
    case 'count':
      return PREFERENCE_DEFAULTS.count;
    case 'market':
      return PREFERENCE_DEFAULTS.market;
    case 'showHex':
      return PREFERENCE_DEFAULTS.showHex;
    case 'showRgb':
      return PREFERENCE_DEFAULTS.showRgb;
    case 'showHsv':
      return PREFERENCE_DEFAULTS.showHsv;
    case 'showLab':
      return PREFERENCE_DEFAULTS.showLab;
    case 'showDeltaE':
      return PREFERENCE_DEFAULTS.showDeltaE;
    case 'showAcquisition':
      return PREFERENCE_DEFAULTS.showAcquisition;
    case 'theme':
      return PREFERENCE_DEFAULTS.theme;
    case 'clan':
    case 'gender':
    case 'world':
      return undefined; // No default
  }
}

/**
 * Get commands affected by a preference key.
 *
 * Entries are either a literal command token (`/mixer` — never localized) or
 * a `preferences.affects.*` locale key the caller renders with `t.t()`
 * (F-05, 2026-08-20 audit).
 */
export function getAffectedCommands(key: PreferenceKey): string[] {
  switch (key) {
    case 'language':
      return ['preferences.affects.allCommands'];
    case 'blending':
      return ['/mixer', '/gradient'];
    case 'matching':
      return ['/mixer', '/gradient', '/extractor', '/swatch', '/budget'];
    case 'count':
      return ['/extractor'];
    case 'clan':
    case 'gender':
      return ['/swatch'];
    case 'world':
      return ['/budget', 'preferences.affects.marketData'];
    case 'theme':
      return ['preferences.affects.everyCard'];
    case 'market':
    case 'showHex':
    case 'showRgb':
    case 'showHsv':
    case 'showLab':
    case 'showDeltaE':
    case 'showAcquisition':
      return ['preferences.affects.resultCards'];
  }
}
