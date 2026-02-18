/**
 * User Preferences Service
 *
 * Manages persistent user preferences using Cloudflare KV.
 * Currently supports world/datacenter preferences for the budget finder.
 *
 * @module services/user-preferences
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import type { UserWorldPreference } from '../types/budget.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * KV schema version for data format evolution
 * Increment when changing the data structure stored in KV
 */
const KV_SCHEMA_VERSION = 'v1';

/** KV key prefix for world preferences */
const WORLD_PREF_KEY_PREFIX = `budget:world:${KV_SCHEMA_VERSION}:`;

// ============================================================================
// World Preference Functions
// ============================================================================

/**
 * Build a KV key for a user's world preference
 */
function buildWorldPrefKey(userId: string): string {
  return `${WORLD_PREF_KEY_PREFIX}${userId}`;
}

/**
 * Get a user's preferred world/datacenter
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param logger - Optional logger for structured logging
 * @returns The user's world preference or null if not set
 */
export async function getUserWorld(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<UserWorldPreference | null> {
  try {
    const key = buildWorldPrefKey(userId);
    const data = await kv.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as UserWorldPreference;
  } catch (error) {
    if (logger) {
      logger.error('Failed to get user world preference', error instanceof Error ? error : undefined);
    }
    return null;
  }
}

/**
 * Set a user's preferred world/datacenter
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param world - World or datacenter name
 * @param logger - Optional logger for structured logging
 * @returns True if saved successfully
 */
export async function setUserWorld(
  kv: KVNamespace,
  userId: string,
  world: string,
  logger?: ExtendedLogger
): Promise<boolean> {
  try {
    const key = buildWorldPrefKey(userId);
    const preference: UserWorldPreference = {
      world,
      setAt: new Date().toISOString(),
    };

    // No expiration - persists until user clears it
    await kv.put(key, JSON.stringify(preference));
    return true;
  } catch (error) {
    if (logger) {
      logger.error('Failed to set user world preference', error instanceof Error ? error : undefined);
    }
    return false;
  }
}

/**
 * Clear a user's world preference
 *
 * @param kv - KV namespace binding
 * @param userId - Discord user ID
 * @param logger - Optional logger for structured logging
 * @returns True if cleared successfully (or was already not set)
 */
export async function clearUserWorld(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger
): Promise<boolean> {
  try {
    const key = buildWorldPrefKey(userId);
    await kv.delete(key);
    return true;
  } catch (error) {
    if (logger) {
      logger.error('Failed to clear user world preference', error instanceof Error ? error : undefined);
    }
    return false;
  }
}

/**
 * Check if a user has a world preference set
 *
 * More efficient than getUserWorld when you only need existence check.
 */
export async function hasWorldPreference(
  kv: KVNamespace,
  userId: string
): Promise<boolean> {
  const key = buildWorldPrefKey(userId);
  const data = await kv.get(key);
  return data !== null;
}
