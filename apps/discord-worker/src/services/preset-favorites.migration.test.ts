/**
 * The v1 → v2 favorites migration and its corruption guards.
 *
 * v1 stored a bare `string[]` of preset IDs; v2 stores denormalized
 * `{ id, name }` entries so autocomplete needs no API calls (OPT-007). Both
 * shapes are live in KV right now, so the reader has to accept either and
 * treat anything else as empty — a throw here would break autocomplete for
 * a user whose blob got mangled, with no way for them to recover it.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  addPresetFavorite,
  getPresetFavoriteEntries,
  isPresetFavorited,
  removePresetFavorite,
  savePresetFavoriteEntries,
} from './preset-favorites.js';

function memoryKv(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => void store.set(key, value)),
    delete: vi.fn(async (key: string) => void store.delete(key)),
  } as unknown as KVNamespace & { store: Map<string, string> };
}

const silentLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

/** Discover the two key names the module uses without importing internals. */
async function keyNames() {
  const kv = memoryKv();
  await savePresetFavoriteEntries(kv, 'user-1', [{ id: 'p1', name: 'One' }]);
  const keys = [...kv.store.keys()];
  const v2 = keys.find((k) => k.includes('v2')) ?? keys[0];
  const v1 = keys.find((k) => k !== v2) ?? keys[0];
  return { v1, v2 };
}

describe('getPresetFavoriteEntries', () => {
  it('returns an empty list for a user with nothing stored', async () => {
    expect(await getPresetFavoriteEntries(memoryKv(), 'user-1')).toEqual([]);
  });

  it('reads v2 denormalized entries', async () => {
    const kv = memoryKv();
    await savePresetFavoriteEntries(kv, 'user-1', [
      { id: 'p1', name: 'Snow Palette' },
      { id: 'p2', name: 'Soot Palette' },
    ]);

    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([
      { id: 'p1', name: 'Snow Palette' },
      { id: 'p2', name: 'Soot Palette' },
    ]);
  });

  it('falls back to the legacy v1 bare-ID blob with blank names', async () => {
    const { v1 } = await keyNames();
    const kv = memoryKv({ [v1]: JSON.stringify(['p1', 'p2']) });

    // Names stay empty until savePresetFavoriteEntries migrates them
    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([
      { id: 'p1', name: '' },
      { id: 'p2', name: '' },
    ]);
  });

  it('drops non-string members of a legacy v1 blob', async () => {
    const { v1 } = await keyNames();
    const kv = memoryKv({ [v1]: JSON.stringify(['p1', 42, null, 'p2']) });

    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([
      { id: 'p1', name: '' },
      { id: 'p2', name: '' },
    ]);
  });

  it('treats a non-array v1 blob as empty', async () => {
    const { v1 } = await keyNames();
    const kv = memoryKv({ [v1]: JSON.stringify({ nope: true }) });

    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([]);
  });

  it('falls through to v1 when the v2 blob is not an array of entries', async () => {
    const { v1, v2 } = await keyNames();
    const kv = memoryKv({
      [v2]: JSON.stringify({ not: 'an array' }),
      [v1]: JSON.stringify(['p9']),
    });

    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([{ id: 'p9', name: '' }]);
  });

  it('falls through to v1 when a v2 member has no string id', async () => {
    const { v1, v2 } = await keyNames();
    const kv = memoryKv({
      [v2]: JSON.stringify([{ id: 42, name: 'bad' }]),
      [v1]: JSON.stringify(['p9']),
    });

    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([{ id: 'p9', name: '' }]);
  });

  it('blanks a v2 name that is not a string', async () => {
    const { v2 } = await keyNames();
    const kv = memoryKv({ [v2]: JSON.stringify([{ id: 'p1', name: 12345 }]) });

    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([{ id: 'p1', name: '' }]);
  });

  it('returns empty rather than throwing on malformed JSON', async () => {
    const { v2 } = await keyNames();
    const kv = memoryKv({ [v2]: '{not json' });
    const logger = silentLogger();

    expect(await getPresetFavoriteEntries(kv, 'user-1', logger as never)).toEqual([]);
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns empty rather than throwing when KV itself fails', async () => {
    const kv = memoryKv();
    vi.mocked(kv.get).mockRejectedValue(new Error('KV down'));

    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([]);
  });
});

describe('savePresetFavoriteEntries', () => {
  it('writes both v2 and the v1 blob for rollback safety', async () => {
    const kv = memoryKv();

    await savePresetFavoriteEntries(kv, 'user-1', [{ id: 'p1', name: 'One' }]);

    expect(kv.store.size).toBe(2);
    const values = [...kv.store.values()].map((v) => JSON.parse(v));
    expect(values.some((v) => JSON.stringify(v) === JSON.stringify(['p1']))).toBe(true);
    expect(values.some((v) => v[0]?.name === 'One')).toBe(true);
  });

  it('migrates a v1-only user to v2 on the next write', async () => {
    const { v1 } = await keyNames();
    const kv = memoryKv({ [v1]: JSON.stringify(['p1']) });

    const entries = await getPresetFavoriteEntries(kv, 'user-1');
    entries[0].name = 'Recovered Name';
    await savePresetFavoriteEntries(kv, 'user-1', entries);

    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([
      { id: 'p1', name: 'Recovered Name' },
    ]);
  });
});

describe('addPresetFavorite', () => {
  it('adds a new favorite', async () => {
    const kv = memoryKv();

    expect(await addPresetFavorite(kv, 'user-1', 'p1', 'One')).toEqual({ success: true });
    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([{ id: 'p1', name: 'One' }]);
  });

  it('refuses a duplicate', async () => {
    const kv = memoryKv();
    await addPresetFavorite(kv, 'user-1', 'p1', 'One');

    expect(await addPresetFavorite(kv, 'user-1', 'p1', 'One again')).toEqual({
      success: false,
      reason: 'alreadyExists',
    });
  });

  it('refuses once the cap is reached', async () => {
    const kv = memoryKv();
    // Fill past any plausible cap
    for (let i = 0; i < 60; i++) {
      const result = await addPresetFavorite(kv, 'user-1', `p${i}`, `Preset ${i}`);
      if (!result.success) {
        expect(result.reason).toBe('limitReached');
        return;
      }
    }
    throw new Error('expected a limit to be enforced');
  });

  it('reports an error rather than throwing when KV fails', async () => {
    const kv = memoryKv();
    vi.mocked(kv.put).mockRejectedValue(new Error('KV down'));
    const logger = silentLogger();

    expect(await addPresetFavorite(kv, 'user-1', 'p1', 'One', logger as never)).toEqual({
      success: false,
      reason: 'error',
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('reports an error with no logger supplied', async () => {
    const kv = memoryKv();
    vi.mocked(kv.put).mockRejectedValue(new Error('KV down'));

    expect(await addPresetFavorite(kv, 'user-1', 'p1', 'One')).toEqual({
      success: false,
      reason: 'error',
    });
  });
});

describe('removePresetFavorite', () => {
  it('removes an existing favorite', async () => {
    const kv = memoryKv();
    await addPresetFavorite(kv, 'user-1', 'p1', 'One');
    await addPresetFavorite(kv, 'user-1', 'p2', 'Two');

    expect(await removePresetFavorite(kv, 'user-1', 'p1')).toEqual({ success: true });
    expect(await getPresetFavoriteEntries(kv, 'user-1')).toEqual([{ id: 'p2', name: 'Two' }]);
  });

  it('reports notFound for a favorite that was never there', async () => {
    expect(await removePresetFavorite(memoryKv(), 'user-1', 'nope')).toEqual({
      success: false,
      reason: 'notFound',
    });
  });

  it('deletes both blobs when the last favorite goes', async () => {
    const kv = memoryKv();
    await addPresetFavorite(kv, 'user-1', 'p1', 'One');

    expect(await removePresetFavorite(kv, 'user-1', 'p1')).toEqual({ success: true });
    // An empty list is a deleted key, not a stored `[]`
    expect(kv.store.size).toBe(0);
  });

  it('reports an error rather than throwing when KV fails', async () => {
    const kv = memoryKv();
    // Two entries, so removing one takes the put path rather than the delete path
    await addPresetFavorite(kv, 'user-1', 'p1', 'One');
    await addPresetFavorite(kv, 'user-1', 'p2', 'Two');
    vi.mocked(kv.put).mockRejectedValue(new Error('KV down'));
    const logger = silentLogger();

    expect(await removePresetFavorite(kv, 'user-1', 'p1', logger as never)).toEqual({
      success: false,
      reason: 'error',
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it('reports an error with no logger supplied', async () => {
    const kv = memoryKv();
    await addPresetFavorite(kv, 'user-1', 'p1', 'One');
    await addPresetFavorite(kv, 'user-1', 'p2', 'Two');
    vi.mocked(kv.put).mockRejectedValue(new Error('KV down'));

    expect(await removePresetFavorite(kv, 'user-1', 'p1')).toMatchObject({ success: false });
  });
});

describe('isPresetFavorited', () => {
  it('is true only for an id the user actually favorited', async () => {
    const kv = memoryKv();
    await addPresetFavorite(kv, 'user-1', 'p1', 'One');

    expect(await isPresetFavorited(kv, 'user-1', 'p1')).toBe(true);
    expect(await isPresetFavorited(kv, 'user-1', 'p2')).toBe(false);
  });

  it('is false for a user with nothing stored', async () => {
    expect(await isPresetFavorited(memoryKv(), 'user-1', 'p1')).toBe(false);
  });

  it('sees favorites recorded in the legacy v1 shape', async () => {
    const { v1 } = await keyNames();
    const kv = memoryKv({ [v1]: JSON.stringify(['p1']) });

    expect(await isPresetFavorited(kv, 'user-1', 'p1')).toBe(true);
  });
});
