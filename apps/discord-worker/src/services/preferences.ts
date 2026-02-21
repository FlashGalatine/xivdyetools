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
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import type { LocaleCode } from './i18n.js';
import { isValidLocale } from './i18n.js';
import type {
  UserPreferences,
  PreferenceKey,
  BlendingMode,
  MatchingMethod,
  Gender,
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
  logger?: ExtendedLogger
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
 */
export async function getPreference<K extends PreferenceKey>(
  kv: KVNamespace,
  userId: string,
  key: K,
  logger?: ExtendedLogger
): Promise<UserPreferences[K] | undefined> {
  const prefs = await getUserPreferences(kv, userId, logger);
  return prefs[key] ?? (PREFERENCE_DEFAULTS as Record<string, unknown>)[key] as UserPreferences[K];
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
  logger?: ExtendedLogger
): Promise<{ success: boolean; reason?: string }> {
  try {
    // Validate the value based on the key
    const validation = validatePreferenceValue(key, value);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    // Get current preferences
    const prefs = await getUserPreferences(kv, userId, logger);

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
        prefs.world = value as string;
        break;
      case 'market':
        prefs.market = value === true || value === 'on' || value === 'true';
        break;
    }

    // Update metadata
    prefs.updatedAt = new Date().toISOString();
    prefs._version = SCHEMA_VERSION;

    // Save to KV
    await kv.put(buildPrefsKey(userId), JSON.stringify(prefs));

    return { success: true };
  } catch (error) {
    if (logger) {
      logger.error('Failed to set preference', error instanceof Error ? error : undefined, { key, value });
    }
    return { success: false, reason: 'error' };
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
  logger?: ExtendedLogger
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
      logger.error('Failed to reset preference', error instanceof Error ? error : undefined, { key });
    }
    return false;
  }
}

/**
 * Check if a user has any preferences set
 */
export async function hasPreferences(
  kv: KVNamespace,
  userId: string
): Promise<boolean> {
  const key = buildPrefsKey(userId);
  const data = await kv.get(key);
  return data !== null;
}

// ============================================================================
// Resolution Helpers
// ============================================================================

/**
 * Resolve the effective value for a preference
 *
 * Resolution order: Explicit parameter → User preference → System default
 *
 * @param explicit - Explicitly provided value (from command parameter)
 * @param prefs - User preferences object
 * @param key - Preference key
 * @returns The resolved value
 */
export function resolvePreference<K extends PreferenceKey>(
  explicit: UserPreferences[K] | undefined | null,
  prefs: UserPreferences,
  key: K
): UserPreferences[K] | undefined {
  // 1. Explicit parameter takes precedence
  if (explicit !== undefined && explicit !== null) {
    return explicit;
  }

  // 2. User preference
  if (prefs[key] !== undefined) {
    return prefs[key];
  }

  // 3. System default
  return (PREFERENCE_DEFAULTS as Record<string, unknown>)[key] as UserPreferences[K];
}

/**
 * Resolve blending mode with fallback chain
 */
export function resolveBlendingMode(
  explicit: string | undefined | null,
  prefs: UserPreferences
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
  prefs: UserPreferences
): MatchingMethod {
  if (explicit && isValidMatchingMethod(explicit)) {
    return explicit;
  }
  return prefs.matching ?? PREFERENCE_DEFAULTS.matching;
}

/**
 * Resolve result count with fallback chain
 */
export function resolveCount(
  explicit: number | undefined | null,
  prefs: UserPreferences
): number {
  if (explicit !== undefined && explicit !== null && isValidCount(explicit)) {
    return explicit;
  }
  return prefs.count ?? PREFERENCE_DEFAULTS.count;
}

/**
 * Resolve market data flag with fallback chain
 */
export function resolveMarket(
  explicit: boolean | undefined | null,
  prefs: UserPreferences
): boolean {
  if (explicit !== undefined && explicit !== null) {
    return explicit;
  }
  return prefs.market ?? PREFERENCE_DEFAULTS.market;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate a preference value for a given key
 */
export function validatePreferenceValue(
  key: PreferenceKey,
  value: unknown
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

    case 'world':
      if (typeof value !== 'string' || value.length === 0) {
        return { valid: false, reason: 'invalidWorld' };
      }
      // Note: Full world validation would require a list of valid FFXIV worlds
      // For now, we accept any non-empty string
      break;

    case 'market':
      // Accept boolean, "on"/"off", "true"/"false"
      if (typeof value === 'boolean') break;
      if (typeof value === 'string') {
        const lower = value.toLowerCase();
        if (!['on', 'off', 'true', 'false'].includes(lower)) {
          return { valid: false, reason: 'invalidMarket' };
        }
      } else {
        return { valid: false, reason: 'invalidMarket' };
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
  logger?: ExtendedLogger
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
        logger.info('Migrated legacy preferences to unified format', { userId, keys: Object.keys(prefs) });
      }
    }
  } catch (error) {
    if (logger) {
      logger.error('Failed to migrate legacy preferences', error instanceof Error ? error : undefined);
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
    case 'clan':
    case 'gender':
    case 'world':
      return undefined; // No default
  }
}

/**
 * Get commands affected by a preference key
 */
export function getAffectedCommands(key: PreferenceKey): string[] {
  switch (key) {
    case 'language':
      return ['all commands'];
    case 'blending':
      return ['/mixer', '/gradient'];
    case 'matching':
      return ['/mixer', '/gradient', '/extractor', '/swatch', '/budget'];
    case 'count':
      return ['/mixer', '/gradient', '/extractor', '/swatch'];
    case 'clan':
    case 'gender':
      return ['/swatch'];
    case 'world':
      return ['/budget', 'market data on Result Cards'];
    case 'market':
      return ['all commands with Result Cards'];
  }
}
