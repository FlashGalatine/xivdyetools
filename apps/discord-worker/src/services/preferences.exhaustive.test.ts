/**
 * Exhaustive per-key coverage of the preferences service.
 *
 * Every entry point here is a `switch` over the 15 `PreferenceKey`s, and
 * TypeScript's exhaustiveness check does not survive to runtime: a key added
 * to the union but forgotten in one of these switches compiles cleanly and
 * then silently does nothing — `setPreference` reports success while writing
 * no change. Driving every key through every switch is the only thing that
 * catches that.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getAffectedCommands,
  getDefaultValue,
  getUserPreferences,
  getUserPreferencesStrict,
  resetPreference,
  setPreference,
  validatePreferenceValue,
  WORLD_NAME_MAX_LENGTH,
} from './preferences.js';
import type { PreferenceKey } from '../types/preferences.js';

const ALL_KEYS: PreferenceKey[] = [
  'language',
  'blending',
  'matching',
  'count',
  'clan',
  'gender',
  'world',
  'market',
  'showHex',
  'showRgb',
  'showHsv',
  'showLab',
  'showDeltaE',
  'showAcquisition',
  'theme',
];

/** The seven keys that accept boolean / "on"|"off" / "true"|"false". */
const BOOLEAN_KEYS: PreferenceKey[] = [
  'market',
  'showHex',
  'showRgb',
  'showHsv',
  'showLab',
  'showDeltaE',
  'showAcquisition',
];

/** A valid value for each key, so setPreference gets past validation. */
const VALID_VALUE: Record<PreferenceKey, string | number | boolean> = {
  language: 'ja',
  blending: 'rgb',
  matching: 'ciede2000',
  count: 3,
  clan: 'Midlander',
  gender: 'female',
  world: 'Gilgamesh',
  market: true,
  showHex: true,
  showRgb: true,
  showHsv: true,
  showLab: true,
  showDeltaE: true,
  showAcquisition: true,
  theme: 'light',
};

/** In-memory KV double; the real binding is only get/put/delete here. */
function memoryKv(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    list: vi.fn(async () => ({ keys: [], list_complete: true, cacheStatus: null })),
  } as unknown as KVNamespace & { store: Map<string, string> };
}

const silentLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe('validatePreferenceValue', () => {
  it.each(ALL_KEYS)('accepts a valid %s value', (key) => {
    expect(validatePreferenceValue(key, VALID_VALUE[key])).toEqual({ valid: true });
  });

  it.each([
    ['language', 'klingon', 'invalidLanguage'],
    ['blending', 'telepathy', 'invalidBlendingMode'],
    ['matching', 'vibes', 'invalidMatchingMethod'],
    ['count', 999, 'invalidCount'],
    ['clan', 'NotAClan', 'invalidClan'],
    ['gender', 'Yes', 'invalidGender'],
    ['world', '', 'invalidWorld'],
    ['theme', 'neon', 'invalidTheme'],
  ] as const)('rejects an invalid %s with reason %s', (key, value, reason) => {
    expect(validatePreferenceValue(key, value)).toEqual({ valid: false, reason });
  });

  it.each(ALL_KEYS.filter((k) => !BOOLEAN_KEYS.includes(k)))(
    'rejects a non-string %s value',
    (key) => {
      // count coerces strings to numbers, so feed it something else
      const bad = key === 'count' ? {} : 42;
      expect(validatePreferenceValue(key, bad).valid).toBe(false);
    },
  );

  describe('the seven boolean keys', () => {
    it.each(BOOLEAN_KEYS)('%s accepts booleans and on/off/true/false strings', (key) => {
      for (const value of [true, false, 'on', 'off', 'true', 'false', 'ON', 'False']) {
        expect(validatePreferenceValue(key, value)).toEqual({ valid: true });
      }
    });

    it.each(BOOLEAN_KEYS)('%s rejects any other string', (key) => {
      expect(validatePreferenceValue(key, 'maybe')).toEqual({
        valid: false,
        reason: 'invalidBoolean',
      });
    });

    it.each(BOOLEAN_KEYS)('%s rejects a non-string non-boolean', (key) => {
      expect(validatePreferenceValue(key, 1).reason).toBe('invalidBoolean');
      expect(validatePreferenceValue(key, null).reason).toBe('invalidBoolean');
    });
  });

  it('parses a numeric string for count', () => {
    expect(validatePreferenceValue('count', '3')).toEqual({ valid: true });
    expect(validatePreferenceValue('count', 'three').valid).toBe(false);
  });

  // FINDING-019 (2026-08-29 security audit): `world` used to accept ANY
  // non-empty string, so a 6000-character Discord option value was stored
  // verbatim in `prefs:v1:<userId>` and later forwarded to the Universalis
  // proxy and the price-cache key. The sync guard is a shape check only —
  // whether the name exists is settled by the async `validateWorld()`.
  describe('world (FINDING-019)', () => {
    it('rejects a value longer than the schema cap', () => {
      expect(validatePreferenceValue('world', 'B'.repeat(WORLD_NAME_MAX_LENGTH + 1))).toEqual({
        valid: false,
        reason: 'invalidWorld',
      });
    });

    it('accepts a value exactly at the cap', () => {
      expect(validatePreferenceValue('world', 'B'.repeat(WORLD_NAME_MAX_LENGTH))).toEqual({
        valid: true,
      });
    });

    it.each([
      ['NUL', 'Bal\u0000mung'],
      ['newline', 'Bal\nmung'],
      ['unit separator', 'Bal\u001Fmung'],
      ['DEL', 'Bal\u007Fmung'],
    ])('rejects an embedded %s control character', (_label, value) => {
      expect(validatePreferenceValue('world', value)).toEqual({
        valid: false,
        reason: 'invalidWorld',
      });
    });

    // The CN and KR worlds are non-Latin: an ASCII check would lock those
    // players out of `/budget` entirely.
    it.each([['红玉海'], ['카벙클'], ['Ravana']])('accepts the non-Latin world %s', (value) => {
      expect(validatePreferenceValue('world', value)).toEqual({ valid: true });
    });

    it('accepts a padded value — length is measured after trimming', () => {
      expect(validatePreferenceValue('world', '  Balmung  ')).toEqual({ valid: true });
      expect(validatePreferenceValue('world', `  ${'B'.repeat(32)}  `)).toEqual({ valid: true });
    });

    it('still rejects a whitespace-only value', () => {
      expect(validatePreferenceValue('world', '   ')).toEqual({
        valid: false,
        reason: 'invalidWorld',
      });
    });
  });
});

describe('setPreference — one arm per key', () => {
  let kv: ReturnType<typeof memoryKv>;

  beforeEach(() => {
    kv = memoryKv();
  });

  it.each(ALL_KEYS)('writes %s through to KV', async (key) => {
    const result = await setPreference(kv, 'user-1', key, VALID_VALUE[key]);

    expect(result).toEqual({ success: true });
    const stored = JSON.parse([...kv.store.values()][0]) as Record<string, unknown>;
    expect(stored[key]).toBeDefined();
    expect(stored.updatedAt).toBeTruthy();
  });

  it.each(BOOLEAN_KEYS)('%s coerces "on" to true and "off" to false', async (key) => {
    await setPreference(kv, 'user-1', key, 'on');
    expect(JSON.parse([...kv.store.values()][0])[key]).toBe(true);

    await setPreference(kv, 'user-1', key, 'off');
    expect(JSON.parse([...kv.store.values()][0])[key]).toBe(false);
  });

  it.each(BOOLEAN_KEYS)('%s coerces "true"/"false" the same way', async (key) => {
    await setPreference(kv, 'user-1', key, 'true');
    expect(JSON.parse([...kv.store.values()][0])[key]).toBe(true);

    await setPreference(kv, 'user-1', key, 'false');
    expect(JSON.parse([...kv.store.values()][0])[key]).toBe(false);
  });

  it('refuses an invalid value without touching KV', async () => {
    const result = await setPreference(kv, 'user-1', 'theme', 'neon');

    expect(result).toEqual({ success: false, reason: 'invalidTheme' });
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('reports a KV write failure rather than claiming success', async () => {
    const failing = memoryKv();
    vi.mocked(failing.put).mockRejectedValue(new Error('KV down'));
    const logger = silentLogger();

    const result = await setPreference(failing, 'user-1', 'theme', 'light', logger as never);

    expect(result).toEqual({ success: false, reason: 'error' });
    expect(logger.error).toHaveBeenCalled();
  });

  // FINDING-011 (2026-08-29 security audit): the failure log carried the
  // preference VALUE — the user's home world, clan or language, i.e. mildly
  // identifying personal data, in a log line. Shape only from now on.
  it('logs the shape of a failed value, never the value itself', async () => {
    const failing = memoryKv();
    vi.mocked(failing.put).mockRejectedValue(new Error('KV down'));
    const logger = silentLogger();

    await setPreference(failing, 'user-1', 'world', 'Gilgamesh', logger as never);

    // BUG-029 made the write batched, so the context reports one entry per
    // queued key rather than a single key. What FINDING-011 actually pins is
    // unchanged and is the second assertion: the value never appears.
    const context = logger.error.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(context).toEqual({ keys: ['world'], valueTypes: ['string'], valueLengths: [9] });
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('Gilgamesh');
  });

  it('records no length for a non-string failed value', async () => {
    const failing = memoryKv();
    vi.mocked(failing.put).mockRejectedValue(new Error('KV down'));
    const logger = silentLogger();

    await setPreference(failing, 'user-1', 'count', 5, logger as never);

    expect(logger.error.mock.calls[0]?.[2]).toEqual({
      keys: ['count'],
      valueTypes: ['number'],
      valueLengths: [undefined],
    });
  });

  // FINDING-019: `/budget set_world` hands over an already-canonical name,
  // but `/preferences set world:` is free text — what is stored must be the
  // trimmed value the validator measured, not the padded original.
  it('stores a world without its surrounding whitespace', async () => {
    await setPreference(kv, 'user-1', 'world', '  Balmung  ');

    expect(JSON.parse([...kv.store.values()][0]).world).toBe('Balmung');
  });

  it('refuses an over-long world without touching KV', async () => {
    const result = await setPreference(kv, 'user-1', 'world', 'B'.repeat(33));

    expect(result).toEqual({ success: false, reason: 'invalidWorld' });
    expect(kv.put).not.toHaveBeenCalled();
  });

  it('survives a KV write failure with no logger', async () => {
    const failing = memoryKv();
    vi.mocked(failing.put).mockRejectedValue(new Error('KV down'));

    await expect(setPreference(failing, 'user-1', 'theme', 'light')).resolves.toEqual({
      success: false,
      reason: 'error',
    });
  });

  it('preserves other preferences when writing one', async () => {
    await setPreference(kv, 'user-1', 'theme', 'light');
    await setPreference(kv, 'user-1', 'language', 'ja');

    const stored = JSON.parse([...kv.store.values()][0]) as Record<string, unknown>;
    expect(stored.theme).toBe('light');
    expect(stored.language).toBe('ja');
  });
});

describe('getUserPreferences', () => {
  it('returns the stored object', async () => {
    const kv = memoryKv();
    await setPreference(kv, 'user-1', 'theme', 'light');

    expect((await getUserPreferences(kv, 'user-1')).theme).toBe('light');
  });

  it('returns an empty object rather than throwing on malformed JSON', async () => {
    const kv = memoryKv();
    // KVNamespace.get is overloaded; pin the string form for the mock
    vi.mocked(kv.get).mockResolvedValue('{not json' as never);
    const logger = silentLogger();

    expect(await getUserPreferences(kv, 'user-1', logger as never)).toEqual({});
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns an empty object rather than throwing when KV itself fails', async () => {
    const kv = memoryKv();
    vi.mocked(kv.get).mockRejectedValue(new Error('KV down'));

    expect(await getUserPreferences(kv, 'user-1')).toEqual({});
  });
});

describe('resetPreference', () => {
  it('removes a set preference', async () => {
    const kv = memoryKv();
    await setPreference(kv, 'user-1', 'theme', 'light');
    await setPreference(kv, 'user-1', 'language', 'ja');

    expect(await resetPreference(kv, 'user-1', 'theme')).toBe(true);
    const prefs = await getUserPreferences(kv, 'user-1');
    expect(prefs.theme).toBeUndefined();
    // …and leaves the others alone
    expect(prefs.language).toBe('ja');
  });

  it('deletes the whole record once the last real preference goes', async () => {
    const kv = memoryKv();
    await setPreference(kv, 'user-1', 'theme', 'light');

    expect(await resetPreference(kv, 'user-1', 'theme')).toBe(true);
    // Metadata alone is not worth a KV row
    expect(kv.store.size).toBe(0);
  });

  it('drops every preference when no key is given', async () => {
    const kv = memoryKv();
    await setPreference(kv, 'user-1', 'theme', 'light');
    await setPreference(kv, 'user-1', 'language', 'ja');

    expect(await resetPreference(kv, 'user-1')).toBe(true);
    expect(kv.store.size).toBe(0);
  });

  it('is a no-op for a preference that was never set', async () => {
    await expect(resetPreference(memoryKv(), 'user-1', 'theme')).resolves.toBe(true);
  });

  it('reports a KV failure', async () => {
    const kv = memoryKv();
    await setPreference(kv, 'user-1', 'theme', 'light');
    await setPreference(kv, 'user-1', 'language', 'ja');
    vi.mocked(kv.put).mockRejectedValue(new Error('KV down'));
    const logger = silentLogger();

    expect(await resetPreference(kv, 'user-1', 'theme', logger as never)).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it('reports a KV failure with no logger', async () => {
    const kv = memoryKv();
    vi.mocked(kv.delete).mockRejectedValue(new Error('KV down'));

    expect(await resetPreference(kv, 'user-1')).toBe(false);
  });
});

describe('getDefaultValue', () => {
  it.each(ALL_KEYS.filter((k) => !['clan', 'gender', 'world'].includes(k)))(
    '%s has a system default',
    (key) => {
      expect(getDefaultValue(key)).toBeDefined();
    },
  );

  it.each(['clan', 'gender', 'world'] as const)(
    '%s deliberately has no default — it is character-specific',
    (key) => {
      expect(getDefaultValue(key)).toBeUndefined();
    },
  );

  it('returns a default that its own validator accepts', () => {
    for (const key of ALL_KEYS) {
      const value = getDefaultValue(key);
      if (value === undefined) continue;
      expect(validatePreferenceValue(key, value)).toEqual({ valid: true });
    }
  });
});

/**
 * BUG-048 (2026-10-04 deep dive): `getUserPreferences` turns a failed read
 * into `{}` — right for a command that only wants defaults, wrong for a
 * read-modify-write. `setPreferences` applied the new key to that `{}` and
 * put it over the whole blob; `resetPreference(key)` saw nothing left and
 * deleted the blob. Both then reported success.
 */
describe('a failed read never becomes a write (BUG-048)', () => {
  const PREFS_KEY = 'prefs:v1:user-1';
  const STORED = JSON.stringify({ theme: 'light', language: 'ja', world: 'Balmung' });

  /** KV whose `get` fails for one key (once), and behaves for the rest. */
  function failingGetFor(failKey: string, seed: Record<string, string>, failure: unknown) {
    const kv = memoryKv(seed);
    const real = vi.mocked(kv.get).getMockImplementation()!;
    let failed = false;
    vi.mocked(kv.get).mockImplementation((async (key: string) => {
      if (key === failKey && !failed) {
        failed = true;
        if (failure instanceof Error) throw failure;
        return failure;
      }
      return real(key as never);
    }) as never);
    return kv;
  }

  it('set: a KV read failure leaves the stored blob untouched and reports failure', async () => {
    const kv = failingGetFor(PREFS_KEY, { [PREFS_KEY]: STORED }, new Error('KV down'));
    const logger = silentLogger();

    const result = await setPreference(kv, 'user-1', 'count', 3, logger as never);

    expect(result).toEqual({ success: false, reason: 'error' });
    expect(kv.put).not.toHaveBeenCalled();
    expect(kv.store.get(PREFS_KEY)).toBe(STORED);
    expect(logger.error).toHaveBeenCalled();
  });

  it('single-key reset: a KV read failure does not delete the blob', async () => {
    const kv = failingGetFor(PREFS_KEY, { [PREFS_KEY]: STORED }, new Error('KV down'));

    expect(await resetPreference(kv, 'user-1', 'theme')).toBe(false);
    expect(kv.delete).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
    expect(kv.store.get(PREFS_KEY)).toBe(STORED);
  });

  it('set: a failed legacy read aborts the write instead of orphaning the legacy value', async () => {
    // No unified blob yet, so the read falls through to the legacy keys. If
    // that read fails and the write went ahead anyway, the new blob would
    // exist — and the migration (which runs only when it does not) would
    // never bring the legacy world across.
    const kv = failingGetFor(
      'budget:world:v1:user-1',
      { 'budget:world:v1:user-1': JSON.stringify({ world: 'Cactuar' }) },
      new Error('KV down'),
    );

    expect((await setPreference(kv, 'user-1', 'theme', 'dark')).success).toBe(false);
    expect(kv.put).not.toHaveBeenCalled();

    // The next attempt reads cleanly and carries the legacy world across.
    expect((await setPreference(kv, 'user-1', 'theme', 'dark')).success).toBe(true);
    expect(JSON.parse(kv.store.get(PREFS_KEY)!)).toMatchObject({ theme: 'dark', world: 'Cactuar' });
  });

  it('single-key reset: a failed legacy read deletes nothing', async () => {
    const kv = failingGetFor(
      'i18n:user:user-1',
      { 'i18n:user:user-1': 'de' },
      new Error('KV down'),
    );

    expect(await resetPreference(kv, 'user-1', 'theme')).toBe(false);
    expect(kv.delete).not.toHaveBeenCalled();
    expect(kv.put).not.toHaveBeenCalled();
    expect(kv.store.get('i18n:user:user-1')).toBe('de');
  });

  it('the lenient read is unchanged: commands still get {} on a failed read', async () => {
    const kv = failingGetFor(PREFS_KEY, { [PREFS_KEY]: STORED }, new Error('KV down'));

    expect(await getUserPreferences(kv, 'user-1')).toEqual({});
  });

  it('the strict read throws where the lenient one returns {}', async () => {
    const kv = failingGetFor(PREFS_KEY, { [PREFS_KEY]: STORED }, new Error('KV down'));

    await expect(getUserPreferencesStrict(kv, 'user-1')).rejects.toThrow('KV down');
    expect(await getUserPreferencesStrict(kv, 'user-1')).toMatchObject({ theme: 'light' });
  });
});

/**
 * The other kind of failed read. A blob that does not parse, or parses to
 * something other than a plain object, holds nothing a writer could keep —
 * and unlike a failed `kv.get` it fails the same way on every retry. Aborting
 * the write there, as BUG-048 does for a transient failure, locked the user
 * out of every write but a full reset, each one answered "try again". Writers
 * read it as empty instead, so the next write replaces it.
 */
describe('an unreadable blob is replaced, not a lockout', () => {
  const PREFS_KEY = 'prefs:v1:user-1';

  it.each([
    ['does not parse', '{not json'],
    ['parses to a string', '"just a string"'],
    ['parses to null', 'null'],
    // The case the shape guard exists for: an array takes `prefs.theme = …`
    // silently, and JSON.stringify drops it — the write "succeeds" and
    // stores `[]` again, with the new preference gone.
    ['parses to an array', '[]'],
  ])('set: a blob that %s is replaced by the new preferences', async (_label, blob) => {
    const kv = memoryKv({ [PREFS_KEY]: blob });

    expect(await setPreference(kv, 'user-1', 'theme', 'dark')).toEqual({ success: true });
    const stored: unknown = JSON.parse(kv.store.get(PREFS_KEY)!);
    expect(Array.isArray(stored)).toBe(false);
    expect(stored).toMatchObject({ theme: 'dark' });
  });

  it.each([
    ['does not parse', '{not json'],
    // A NON-empty array: `[]` cannot tell the guard apart from no guard here,
    // since an empty array with only `updatedAt`/`_version` added reads as
    // "nothing left" and is deleted either way. Unguarded, `["light"]` keeps
    // an index key, so the reset reports success and writes the array back.
    ['parses to an array', '["light"]'],
  ])('single-key reset: a blob that %s is cleared, not kept', async (_label, blob) => {
    const kv = memoryKv({ [PREFS_KEY]: blob });

    expect(await resetPreference(kv, 'user-1', 'theme')).toBe(true);
    expect(kv.store.has(PREFS_KEY)).toBe(false);
  });

  it('the strict read answers {} for it — a kv.get failure still throws', async () => {
    expect(await getUserPreferencesStrict(memoryKv({ [PREFS_KEY]: '{not json' }), 'user-1')).toEqual(
      {},
    );
  });

  it('does not fall through to the legacy keys', async () => {
    const kv = memoryKv({ [PREFS_KEY]: '{not json', 'i18n:user:user-1': 'de' });

    expect(await getUserPreferencesStrict(kv, 'user-1')).toEqual({});
    expect(kv.get).toHaveBeenCalledTimes(1);
  });

  it('logs it without the blob contents or the user id', async () => {
    // Truncated JSON carrying a home world: a SyntaxError message quotes the
    // text it choked on, so passing it to the logger would leak the value.
    const kv = memoryKv({ [PREFS_KEY]: '{"world":"Balmung"' });
    const logger = silentLogger();

    await getUserPreferencesStrict(kv, 'user-1', logger as never);

    expect(logger.error).toHaveBeenCalled();
    const logged = logger.error.mock.calls
      .flat()
      .map((arg) => (arg instanceof Error ? `${arg.message} ${arg.stack}` : JSON.stringify(arg)))
      .join(' ');
    expect(logged).not.toContain('Balmung');
    expect(logged).not.toContain('user-1');
  });
});

/**
 * OPT-005 (2026-10-04 deep dive): with no `prefs:v1` blob, every read fell
 * through to the two legacy keys — two more KV reads per command, for every
 * user who never ran `/preferences set`. Their writers were removed in March
 * 2026, so a legacy key found empty stays empty: the answer is remembered.
 */
describe('legacy keys found empty are not re-read (OPT-005)', () => {
  it('a user with no blob and no legacy keys pays the legacy reads once', async () => {
    const kv = memoryKv();

    await getUserPreferences(kv, 'user-1');
    expect(kv.get).toHaveBeenCalledTimes(3); // blob + two legacy keys

    await getUserPreferences(kv, 'user-1');
    await getUserPreferences(kv, 'user-1');
    // Later reads touch only the blob
    expect(kv.get).toHaveBeenCalledTimes(5);
    expect(vi.mocked(kv.get).mock.calls.slice(3).map(([key]) => key)).toEqual([
      'prefs:v1:user-1',
      'prefs:v1:user-1',
    ]);
  });

  it('is remembered per user, not globally', async () => {
    const kv = memoryKv({ 'i18n:user:user-2': 'de' });

    await getUserPreferences(kv, 'user-1');
    expect((await getUserPreferences(kv, 'user-2')).language).toBe('de');
  });

  it('legacy keys holding nothing migratable are remembered too', async () => {
    const kv = memoryKv({ 'i18n:user:user-1': 'klingon', 'budget:world:v1:user-1': '{bad' });

    expect(await getUserPreferences(kv, 'user-1')).toEqual({});
    await getUserPreferences(kv, 'user-1');
    expect(kv.get).toHaveBeenCalledTimes(4);
  });

  it('a failed legacy read is not remembered as "empty"', async () => {
    const kv = memoryKv({ 'i18n:user:user-1': 'de' });
    const real = vi.mocked(kv.get).getMockImplementation()!;
    vi.mocked(kv.get).mockImplementationOnce(real as never); // the blob read
    vi.mocked(kv.get).mockRejectedValueOnce(new Error('KV down')); // legacy i18n

    expect(await getUserPreferences(kv, 'user-1')).toEqual({});
    expect((await getUserPreferences(kv, 'user-1')).language).toBe('de');
  });

  it('a failed migration write is not remembered either', async () => {
    const kv = memoryKv({ 'i18n:user:user-1': 'de' });
    vi.mocked(kv.put).mockRejectedValueOnce(new Error('KV down'));

    await getUserPreferences(kv, 'user-1');
    // Legacy key still there, so the next read migrates it
    expect((await getUserPreferences(kv, 'user-1')).language).toBe('de');
    expect(kv.store.has('prefs:v1:user-1')).toBe(true);
    expect(kv.store.has('i18n:user:user-1')).toBe(false);
  });

  it('a full reset after the memo still reads back as empty', async () => {
    const kv = memoryKv();
    await getUserPreferences(kv, 'user-1');
    await setPreference(kv, 'user-1', 'theme', 'light');
    await resetPreference(kv, 'user-1');

    expect(await getUserPreferences(kv, 'user-1')).toEqual({});
  });
});

describe('getAffectedCommands', () => {
  it.each(ALL_KEYS.filter((k) => k !== 'clan' && k !== 'gender'))(
    'names at least one affected surface for %s',
    (key) => {
      const commands = getAffectedCommands(key);

      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
    },
  );

  it.each([
    ['language', 'preferences.affects.allCommands'],
    ['blending', '/mixer'],
    ['matching', '/budget'],
    ['matching', '/harmony'],
    ['count', '/extractor'],
    ['world', '/budget'],
    ['world', '/manual'],
    ['theme', 'preferences.affects.everyCard'],
  ] as const)('%s lists %s', (key, expected) => {
    expect(getAffectedCommands(key)).toContain(expected);
  });

  // BUG-049 (2026-10-04 deep dive): the confirmation embed promised effects
  // that never happen.
  it.each([
    ['blending', '/gradient'], // /gradient takes its own color_space option
    ['matching', '/swatch'], // /swatch reads only the theme
    ['clan', '/swatch'], // /swatch reads the .chara file, not the preference
    ['gender', '/swatch'],
  ] as const)('%s does not claim %s', (key, wrong) => {
    expect(getAffectedCommands(key)).not.toContain(wrong);
  });

  it.each(['clan', 'gender'] as const)('%s names no command — nothing reads it', (key) => {
    expect(getAffectedCommands(key)).toEqual([]);
  });

  it.each(BOOLEAN_KEYS)('%s affects all Result Cards', (key) => {
    expect(getAffectedCommands(key)).toEqual(['preferences.affects.resultCards']);
  });

  /**
   * The key-to-handler table, derived from the handlers themselves: for every
   * key, the `/command` tokens `getAffectedCommands` lists must be exactly
   * the command handlers whose source reads that key. A handler that starts
   * (or stops) reading a preference fails here until the list follows.
   *
   * Only the literal `/command` tokens are checked — the
   * `preferences.affects.*` phrases describe surfaces, not handlers. The
   * reader patterns are plain text: a destructured read
   * (`const { matching } = prefs`) would be missed, so keep reads in the
   * `prefs.<key>` / `resolve*()` shapes below.
   */
  describe('key-to-handler table', () => {
    const HANDLERS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'handlers', 'commands');
    /** The handler file → the command it answers, where the names differ. */
    const COMMAND_FOR_FILE: Record<string, string> = { 'mixer-v4': '/mixer' };
    /** Writers and non-commands, not readers. */
    const NOT_READERS = new Set(['preferences', 'preset-notifications']);

    const READERS: Record<PreferenceKey, RegExp> = Object.fromEntries(
      ALL_KEYS.map((key) => [key, new RegExp(`\\bprefs\\??\\.${key}\\b`)]),
    ) as Record<PreferenceKey, RegExp>;
    READERS.blending = /\bresolveBlendingMode\(|\bprefs\??\.blending\b/;
    READERS.matching = /\bresolveMatchingMethod\(|\bprefs\??\.matching\b/;
    READERS.count = /\bresolveCount\(|\bprefs\??\.count\b/;

    const handlers = readdirSync(HANDLERS_DIR)
      .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
      .map((f) => f.replace(/\.ts$/, ''))
      .filter((name) => !NOT_READERS.has(name))
      .map((name) => ({
        command: COMMAND_FOR_FILE[name] ?? `/${name}`,
        source: readFileSync(join(HANDLERS_DIR, `${name}.ts`), 'utf8'),
      }));

    it('found the handler sources', () => {
      expect(handlers.map((h) => h.command)).toEqual(
        expect.arrayContaining(['/mixer', '/gradient', '/harmony', '/extractor', '/budget']),
      );
    });

    // `language` and `theme` are answered by a phrase that covers every
    // command / card ("all commands", "every generated card") rather than a
    // list of handlers, and several handlers read the theme off the
    // `getUserPreferences(...)` result inline — so the per-handler table does
    // not apply to them.
    const TABLE_KEYS = ALL_KEYS.filter((k) => k !== 'language' && k !== 'theme');

    it.each(TABLE_KEYS)('%s lists exactly the commands that read it', (key) => {
      const readers = handlers
        .filter((h) => READERS[key].test(h.source))
        .map((h) => h.command)
        .sort();
      const listed = getAffectedCommands(key)
        .filter((c) => c.startsWith('/'))
        .sort();

      expect(listed).toEqual(readers);
    });
  });
});
