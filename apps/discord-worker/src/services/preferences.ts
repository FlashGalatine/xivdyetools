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

/** Build the legacy KV keys for a user (single source for migrate + reset). */
function buildLegacyI18nKey(userId: string): string {
  return `${LEGACY_I18N_PREFIX}${userId}`;
}
function buildLegacyWorldKey(userId: string): string {
  return `${LEGACY_WORLD_PREFIX}${userId}`;
}

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
 * Get a user's complete preferences object — for READING.
 *
 * If no unified preferences exist, attempts to migrate from legacy keys.
 * Returns an empty object if no preferences are set (defaults apply) — and
 * also when the read itself fails, so a KV hiccup degrades a command to its
 * defaults rather than failing it.
 *
 * That leniency is wrong for a read-modify-write: an empty object written
 * back is the user's whole blob gone (BUG-048). Anything that writes the blob
 * reads it with {@link getUserPreferencesStrict} instead.
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
    return await getUserPreferencesStrict(kv, userId, logger);
  } catch (error) {
    if (logger) {
      logger.error('Failed to get user preferences', error instanceof Error ? error : undefined);
    }
    return {};
  }
}

/**
 * Get a user's complete preferences object — for a read-modify-write.
 *
 * Same result as {@link getUserPreferences} on a clean read, but a read that
 * FAILED throws instead of answering `{}`: a KV error, or a failed read of a
 * legacy key while migrating. BUG-048 (2026-10-04 deep dive): the lenient
 * `{}` let `setPreferences` put a one-key object over the whole blob and
 * `resetPreference(key)` delete it, both reporting success. Callers abort
 * the write and report the failure — those failures are transient, so the
 * user's next attempt can succeed.
 *
 * A blob that was READ but is unusable — it does not parse, or parses to
 * something other than a plain object — is different: it holds nothing a
 * writer could preserve, and it would fail the same way on every retry, so
 * throwing would lock the user out of every write but a full reset. It is
 * logged and answered as `{}`, and the caller's write replaces it.
 *
 * A failure to PERSIST a migration is not a read failure: the migrated
 * object is still returned (and the migration retried on the next read).
 */
export async function getUserPreferencesStrict(
  kv: KVNamespace,
  userId: string,
  logger?: ExtendedLogger,
): Promise<UserPreferences> {
  const data = await kv.get(buildPrefsKey(userId));

  if (data) {
    const prefs = parseStoredPreferences(data);
    if (prefs.ok) return prefs.value;
    if (logger) {
      // Neither the blob nor the parser's message (which quotes the text it
      // choked on) is logged: the blob is the user's home world, clan and
      // language. No userId either (FINDING-018).
      logger.error('Stored preferences are unreadable; treating them as empty', undefined, {
        reason: prefs.reason,
      });
    }
    // Not a cue to migrate: the legacy keys are read only while NO blob exists
    return {};
  }

  // No unified prefs - attempt migration from legacy keys
  return migrateLegacyPreferences(kv, userId, logger);
}

/**
 * Parse a stored `prefs:v1` blob, or say why it is unusable. Only a plain
 * object is a preferences blob: an array would take `prefs.theme = …`
 * silently and then lose it to `JSON.stringify`.
 */
function parseStoredPreferences(
  data: string,
): { ok: true; value: UserPreferences } | { ok: false; reason: 'unparseable' | 'not_an_object' } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return { ok: false, reason: 'unparseable' };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: 'not_an_object' };
  }
  return { ok: true, value: parsed };
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
    // BUG-048: strict — a failed read must abort the write, not become `{}`
    const prefs = await getUserPreferencesStrict(kv, userId, logger);

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
      // FINDING-015: also drop the legacy keys, or the migration (and
      // resolveUserLocale's legacy fallback) would bring them back.
      await kv.delete(buildPrefsKey(userId));
      await kv.delete(buildLegacyI18nKey(userId));
      await kv.delete(buildLegacyWorldKey(userId));
      return true;
    }

    // Get current preferences. BUG-048: strict — with the lenient `{}` a
    // failed read made `hasPrefs` false below and deleted the whole blob.
    const prefs = await getUserPreferencesStrict(kv, userId, logger);

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

    // FINDING-015: a reset language / world must not resurrect from the
    // legacy key. Runs only after the unified blob was updated successfully.
    if (key === 'language') {
      await kv.delete(buildLegacyI18nKey(userId));
    } else if (key === 'world') {
      await kv.delete(buildLegacyWorldKey(userId));
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
 * OPT-005 (2026-10-04 deep dive): users whose legacy keys were read and held
 * nothing to migrate, per KV namespace.
 *
 * Without it, every read for a user with no `prefs:v1` blob — anyone who
 * never ran `/preferences set` — paid two more KV reads for keys that are
 * almost always absent. The legacy writers were removed in March 2026, so an
 * absent (or unmigratable) legacy key can never come back: the answer stays
 * true for the life of the isolate and needs no expiry. It is remembered
 * only after BOTH reads succeeded and nothing was found; a failed read or a
 * failed migration write leaves the user un-remembered, so it is retried.
 *
 * Kept in memory rather than as a KV tombstone on purpose: a tombstone is a
 * whole-blob write on the READ path, which could land after a concurrent
 * `/preferences set` and erase it (the BUG-036 race), and would store a row
 * for every user who ever ran any command.
 *
 * Keyed by the namespace binding so two namespaces never share an answer;
 * each set is capped and simply starts over when full.
 */
const legacyKeysEmpty = new WeakMap<KVNamespace, Set<string>>();
const LEGACY_EMPTY_MEMO_MAX = 10_000;

function rememberLegacyKeysEmpty(kv: KVNamespace, userId: string): void {
  let users = legacyKeysEmpty.get(kv);
  if (!users) {
    users = new Set();
    legacyKeysEmpty.set(kv, users);
  }
  if (users.size >= LEGACY_EMPTY_MEMO_MAX) users.clear();
  users.add(userId);
}

/**
 * Migrate legacy preference keys to unified preferences
 *
 * This is called automatically when getUserPreferences finds no unified prefs.
 * Reads from legacy keys and creates a unified preferences object.
 *
 * Once the unified write succeeds the legacy keys are deleted (FINDING-015);
 * they are never deleted before it, nor when it throws. The legacy writers
 * were removed in March 2026, so these keys only ever shrink.
 *
 * A failed legacy READ propagates (BUG-048): a writer must not go on to
 * create the blob, or the migration — which runs only while there is none —
 * would never carry that legacy value across. A failed migration WRITE is
 * logged and swallowed: the migrated object is still the right answer.
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
  if (legacyKeysEmpty.get(kv)?.has(userId)) return {};

  const prefs: UserPreferences = {};
  let hasMigrated = false;

  // Migrate language from i18n:user:{userId}
  const legacyLanguage = await kv.get(buildLegacyI18nKey(userId));
  if (legacyLanguage && isValidLocale(legacyLanguage)) {
    prefs.language = legacyLanguage;
    hasMigrated = true;
  }

  // Migrate world from budget:world:v1:{userId}
  const legacyWorldData = await kv.get(buildLegacyWorldKey(userId));
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

  if (!hasMigrated) {
    rememberLegacyKeysEmpty(kv, userId);
    return prefs;
  }

  // We migrated something: save it to the unified key
  try {
    prefs.updatedAt = new Date().toISOString();
    prefs._version = SCHEMA_VERSION;
    await kv.put(buildPrefsKey(userId), JSON.stringify(prefs));

    // Unified write succeeded - the legacy keys have served their purpose.
    await kv.delete(buildLegacyI18nKey(userId));
    await kv.delete(buildLegacyWorldKey(userId));

    if (logger) {
      // FINDING-018: no userId (bot policy §5); `keys` is key NAMES only.
      logger.info('Migrated legacy preferences to unified format', {
        keys: Object.keys(prefs),
      });
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
 *
 * BUG-049 (2026-10-04 deep dive): a `/command` token here is a promise in
 * the `/preferences set` confirmation, so it must name only handlers that
 * actually read the key. `/gradient` takes its own `color_space` option and
 * never reads `blending`; `/swatch` reads only the theme (its clan and gender
 * come from the `.chara` file); `/harmony` and `/manual` (the
 * `spectrum_prices` topic) do read `matching` / `world` and were missing.
 * Nothing reads `clan` or `gender` at all, so they name nothing.
 * `preferences.exhaustive.test.ts` derives the table from the handler
 * sources and fails when this list drifts from them.
 */
export function getAffectedCommands(key: PreferenceKey): string[] {
  switch (key) {
    case 'language':
      return ['preferences.affects.allCommands'];
    case 'blending':
      return ['/mixer'];
    case 'matching':
      return ['/mixer', '/gradient', '/extractor', '/harmony', '/budget'];
    case 'count':
      return ['/extractor'];
    case 'clan':
    case 'gender':
      return [];
    case 'world':
      return ['/budget', '/manual', 'preferences.affects.marketData'];
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
