import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveIdentities, parseStoredIdentity, snapshotIds } from './identity-lookup.js';
import type { Env } from '../types/env.js';
const D = '123456789012345678',
  U = 'a0000000-0000-4000-8000-000000000001';
const found = { version: 1, status: 'found', internalId: U, discordId: D, identityRevision: 7 };
describe('bounded private stored identity lookup', () => {
  afterEach(() => vi.useRealTimers());
  it.each([D, U])(
    'accepts canonical provider result for %s and uses only correct ID kind',
    async (input) => {
      const lookupStoredIdentity = vi.fn(async () => found);
      const env = {
        LINKED_BAN_CONFIRMATION_ENABLED: 'true',
        OAUTH_IDENTITY: { lookupStoredIdentity },
      } as unknown as Env;
      expect(await resolveIdentities(env, [input])).toEqual([{ input, result: found }]);
      expect(lookupStoredIdentity).toHaveBeenCalledWith({
        kind: input === D ? 'discord' : 'internal',
        id: input,
      });
    },
  );
  it('authoritative missing includes only the explicit submitted ID', () =>
    expect(snapshotIds([{ input: D, result: { version: 1, status: 'missing' } }])).toEqual([D]));
  it('at most two raw independent lookups deduplicate at most four returned IDs', async () => {
    const binding = { lookupStoredIdentity: vi.fn(async () => found) };
    const env = {
      LINKED_BAN_CONFIRMATION_ENABLED: 'true',
      OAUTH_IDENTITY: binding,
    } as unknown as Env;
    const snapshots = await resolveIdentities(env, [D, U]);
    expect(binding.lookupStoredIdentity).toHaveBeenCalledTimes(2);
    expect(snapshotIds(snapshots)).toEqual([D, U].sort());
    await expect(resolveIdentities(env, [D, U, D])).rejects.toThrow();
    expect(binding.lookupStoredIdentity).toHaveBeenCalledTimes(2);
  });
  it.each([
    undefined,
    null,
    [],
    {},
    { version: 2, status: 'missing' },
    { version: 1, status: 'pending' },
    { version: 1, status: 'missing', name: 'private' },
    { ...found, discordId: null },
    { ...found, discordId: 'wrong' },
    { ...found, internalId: 'wrong' },
    { ...found, identityRevision: -1 },
    { ...found, identityRevision: 0.5 },
    { ...found, identityRevision: '7' },
    { ...found, xivauth_id: 'upstream-private' },
    { ...found, internalId: 'b0000000-0000-4000-8000-000000000001' },
  ])('strictly rejects unavailable/malformed/extra/mismatching DTO %#', (value) => {
    expect(() =>
      parseStoredIdentity(
        value,
        value && typeof value === 'object' && 'internalId' in value && value.internalId !== U
          ? U
          : D,
      ),
    ).toThrow();
  });
  it('accepts internal-only account without a Discord association', () =>
    expect(parseStoredIdentity({ ...found, discordId: null }, U)).toEqual({
      ...found,
      discordId: null,
    }));
  it.each(['false', undefined, 'TRUE', '1'])(
    'inactive/malformed flag %s makes no RPC',
    async (flag) => {
      const lookupStoredIdentity = vi.fn();
      await expect(
        resolveIdentities(
          {
            LINKED_BAN_CONFIRMATION_ENABLED: flag,
            OAUTH_IDENTITY: { lookupStoredIdentity },
          } as unknown as Env,
          [D],
        ),
      ).rejects.toThrow();
      expect(lookupStoredIdentity).not.toHaveBeenCalled();
    },
  );
  it('missing binding, invalid raw IDs, empty input and RPC exceptions fail closed', async () => {
    const lookupStoredIdentity = vi.fn(async () => {
      throw new Error('provider secret');
    });
    const env = {
      LINKED_BAN_CONFIRMATION_ENABLED: 'true',
      OAUTH_IDENTITY: { lookupStoredIdentity },
    } as unknown as Env;
    await expect(resolveIdentities(env, [])).rejects.toThrow();
    await expect(resolveIdentities(env, ['bad'])).rejects.toThrow();
    expect(lookupStoredIdentity).not.toHaveBeenCalled();
    await expect(resolveIdentities({ ...env, OAUTH_IDENTITY: undefined }, [D])).rejects.toThrow();
    await expect(resolveIdentities(env, [D])).rejects.toThrow('Identity lookup unavailable.');
  });
  it('local deadline abandons the result; late completion cannot call a write continuation', async () => {
    vi.useFakeTimers();
    let finish: (value: unknown) => void = () => {};
    const lookupStoredIdentity = vi.fn(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const env = {
      LINKED_BAN_CONFIRMATION_ENABLED: 'true',
      OAUTH_IDENTITY: { lookupStoredIdentity },
    } as unknown as Env;
    const continuation = vi.fn();
    const attempt = resolveIdentities(env, [D], 20).then(continuation);
    const rejected = expect(attempt).rejects.toThrow('Identity lookup unavailable.');
    await vi.advanceTimersByTimeAsync(21);
    await rejected;
    finish(found);
    await Promise.resolve();
    expect(continuation).not.toHaveBeenCalled();
  });
});
