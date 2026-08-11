/**
 * KV-backed component context: store / get / update, and their failure arms.
 *
 * Discord `custom_id` is capped at 100 characters, so button state lives in
 * KV behind a short hash. Two properties matter here. The hash is only 32
 * bits and *can* collide, which is why `verifyContextUser` exists and why a
 * miss must return null rather than someone else's context. And an expired
 * or unreadable context must degrade to null — a throw inside a button
 * handler leaves the user staring at a dead component.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getContext,
  storeContext,
  updateContext,
  verifyContextUser,
} from './component-context.js';

function memoryKv() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => void store.set(key, value)),
    delete: vi.fn(async (key: string) => void store.delete(key)),
  } as unknown as KVNamespace & { store: Map<string, string> };
}

const silentLogger = () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() });

const baseContext = { userId: 'user-1', command: 'harmony', data: { hex: '#FFFFFF' } };

afterEach(() => {
  vi.useRealTimers();
});

describe('storeContext', () => {
  it('returns a short hash and writes the context under it', async () => {
    const kv = memoryKv();

    const hash = await storeContext(kv, baseContext);

    expect(hash).toBeTruthy();
    // Short enough to survive Discord's 100-char custom_id budget
    expect(hash.length).toBeLessThanOrEqual(16);
    expect(kv.put).toHaveBeenCalledTimes(1);
  });

  it('never writes a TTL below the KV 60-second floor', async () => {
    const kv = memoryKv();

    await storeContext(kv, baseContext, 5);

    expect(vi.mocked(kv.put).mock.calls[0][2]).toEqual({ expirationTtl: 60 });
  });

  it('passes a longer TTL through unchanged', async () => {
    const kv = memoryKv();

    await storeContext(kv, baseContext, 900);

    expect(vi.mocked(kv.put).mock.calls[0][2]).toEqual({ expirationTtl: 900 });
  });

  it('produces a distinct hash per call, so two buttons never share state', async () => {
    const kv = memoryKv();

    const [a, b] = [await storeContext(kv, baseContext), await storeContext(kv, baseContext)];

    expect(a).not.toBe(b);
  });

  it('logs and rethrows when KV cannot be written', async () => {
    const kv = memoryKv();
    vi.mocked(kv.put).mockRejectedValue(new Error('KV down'));
    const logger = silentLogger();

    await expect(storeContext(kv, baseContext, 60, logger as never)).rejects.toThrow('KV down');
    expect(logger.error).toHaveBeenCalled();
  });

  it('rethrows without a logger too', async () => {
    const kv = memoryKv();
    vi.mocked(kv.put).mockRejectedValue(new Error('KV down'));

    await expect(storeContext(kv, baseContext)).rejects.toThrow('KV down');
  });

  it('records a debug line when a logger is supplied', async () => {
    const logger = silentLogger();

    await storeContext(memoryKv(), baseContext, 300, logger as never);

    expect(logger.debug).toHaveBeenCalled();
  });
});

describe('getContext', () => {
  it('round-trips a stored context', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext);

    const context = await getContext(kv, hash);

    expect(context?.userId).toBe('user-1');
    expect(context?.data).toEqual({ hex: '#FFFFFF' });
  });

  it('returns null for a hash that was never stored', async () => {
    const logger = silentLogger();

    expect(await getContext(memoryKv(), 'nosuch', logger as never)).toBeNull();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('returns null for a miss with no logger', async () => {
    expect(await getContext(memoryKv(), 'nosuch')).toBeNull();
  });

  it('returns null once the stored expiry has passed', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext, 60);
    const logger = silentLogger();

    // Belt-and-braces against KV's own TTL being late
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 120_000);

    expect(await getContext(kv, hash, logger as never)).toBeNull();
    expect(logger.debug).toHaveBeenCalled();
  });

  it('returns null rather than throwing on a corrupt blob', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext);
    kv.store.set([...kv.store.keys()][0], '{not json');
    const logger = silentLogger();

    expect(await getContext(kv, hash, logger as never)).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns null rather than throwing when KV itself fails', async () => {
    const kv = memoryKv();
    vi.mocked(kv.get).mockRejectedValue(new Error('KV down'));

    expect(await getContext(kv, 'anything')).toBeNull();
  });
});

describe('verifyContextUser', () => {
  it('accepts the owning user', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext);
    const context = (await getContext(kv, hash))!;

    expect(verifyContextUser(context, 'user-1')).toBe(true);
  });

  it('rejects anyone else — the 32-bit hash can collide', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext);
    const context = (await getContext(kv, hash))!;

    expect(verifyContextUser(context, 'someone-else')).toBe(false);
  });
});

describe('updateContext', () => {
  it('merges data and extends the expiry', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext, 60);

    const updated = await updateContext(kv, hash, { data: { page: 2 } }, 300);

    expect(updated?.data).toEqual({ hex: '#FFFFFF', page: 2 });
    expect(vi.mocked(kv.put).mock.calls[1][2]).toEqual({ expirationTtl: 300 });
  });

  it('overwrites an existing key in the merged data', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext);

    const updated = await updateContext(kv, hash, { data: { hex: '#000000' } });

    expect(updated?.data.hex).toBe('#000000');
  });

  it('raises a short TTL to the KV floor', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext);

    await updateContext(kv, hash, { data: { page: 2 } }, 5);

    expect(vi.mocked(kv.put).mock.calls[1][2]).toEqual({ expirationTtl: 60 });
  });

  it('returns null for a context that no longer exists', async () => {
    expect(await updateContext(memoryKv(), 'nosuch', { data: { page: 2 } })).toBeNull();
  });

  it('returns null rather than throwing when the write fails', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext);
    vi.mocked(kv.put).mockRejectedValue(new Error('KV down'));
    const logger = silentLogger();

    expect(await updateContext(kv, hash, { data: { page: 2 } }, 60, logger as never)).toBeNull();
    expect(logger.error).toHaveBeenCalled();
  });

  it('returns null on a write failure with no logger', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext);
    vi.mocked(kv.put).mockRejectedValue(new Error('KV down'));

    expect(await updateContext(kv, hash, { data: { page: 2 } })).toBeNull();
  });

  it('records a debug line on success when a logger is supplied', async () => {
    const kv = memoryKv();
    const hash = await storeContext(kv, baseContext);
    const logger = silentLogger();

    await updateContext(kv, hash, { data: { page: 2 } }, 300, logger as never);

    expect(logger.debug).toHaveBeenCalled();
  });
});
