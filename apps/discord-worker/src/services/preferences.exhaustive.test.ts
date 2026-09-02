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
import {
  getAffectedCommands,
  getDefaultValue,
  getPreference,
  getUserPreferences,
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

describe('getPreference', () => {
  it('returns the stored value when one is set', async () => {
    const kv = memoryKv();
    await setPreference(kv, 'user-1', 'theme', 'light');

    expect(await getPreference(kv, 'user-1', 'theme')).toBe('light');
  });

  it('falls back to the system default when unset', async () => {
    const kv = memoryKv();

    expect(await getPreference(kv, 'user-1', 'theme')).toBe(getDefaultValue('theme'));
  });

  it.each(['clan', 'gender', 'world'] as const)(
    'returns undefined for %s, which has no default',
    async (key) => {
      const kv = memoryKv();

      expect(await getPreference(kv, 'user-1', key)).toBeUndefined();
    },
  );
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

describe('getAffectedCommands', () => {
  it.each(ALL_KEYS)('names at least one affected surface for %s', (key) => {
    const commands = getAffectedCommands(key);

    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
    expect(commands.every((c) => typeof c === 'string' && c.length > 0)).toBe(true);
  });

  it.each([
    ['language', 'preferences.affects.allCommands'],
    ['blending', '/mixer'],
    ['matching', '/budget'],
    ['count', '/extractor'],
    ['clan', '/swatch'],
    ['gender', '/swatch'],
    ['world', '/budget'],
    ['theme', 'preferences.affects.everyCard'],
  ] as const)('%s lists %s', (key, expected) => {
    expect(getAffectedCommands(key)).toContain(expected);
  });

  it.each(BOOLEAN_KEYS)('%s affects all Result Cards', (key) => {
    expect(getAffectedCommands(key)).toEqual(['preferences.affects.resultCards']);
  });
});
