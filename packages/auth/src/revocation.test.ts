/**
 * Unit tests for the KV-backed JWT revocation blacklist (REFACTOR-001).
 *
 * Uses a Map-based structural stand-in for KVNamespace; the fail-open
 * contract (store errors → not revoked) is the security-relevant behavior
 * and is tested explicitly.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isTokenRevoked,
  revokeToken,
  REFRESH_GRACE_SECONDS,
  type RevocationStore,
} from './revocation.js';

function memoryStore(): RevocationStore & { data: Map<string, string>; ttls: Map<string, number> } {
  const data = new Map<string, string>();
  const ttls = new Map<string, number>();
  return {
    data,
    ttls,
    get: async (key) => data.get(key) ?? null,
    put: async (key, value, options) => {
      data.set(key, value);
      if (options?.expirationTtl !== undefined) ttls.set(key, options.expirationTtl);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('isTokenRevoked', () => {
  it('returns false when the store is undefined', async () => {
    await expect(isTokenRevoked('jti-1', undefined)).resolves.toBe(false);
  });

  it('returns false for an empty jti', async () => {
    await expect(isTokenRevoked('', memoryStore())).resolves.toBe(false);
  });

  it('returns false for a token that was never revoked', async () => {
    await expect(isTokenRevoked('jti-1', memoryStore())).resolves.toBe(false);
  });

  it('returns true for a revoked token', async () => {
    const store = memoryStore();
    await revokeToken('jti-1', Math.floor(Date.now() / 1000) + 3600, store);
    await expect(isTokenRevoked('jti-1', store)).resolves.toBe(true);
  });

  it('fails open when the store throws', async () => {
    const store: RevocationStore = {
      get: async () => {
        throw new Error('KV outage');
      },
      put: async () => {},
    };
    await expect(isTokenRevoked('jti-1', store)).resolves.toBe(false);
  });
});

describe('revokeToken', () => {
  it('returns false when the store is undefined or jti is empty', async () => {
    await expect(revokeToken('jti-1', 0, undefined)).resolves.toBe(false);
    await expect(revokeToken('', 0, memoryStore())).resolves.toBe(false);
  });

  it('records the revocation under a namespaced key', async () => {
    const store = memoryStore();
    await expect(revokeToken('jti-1', Math.floor(Date.now() / 1000) + 100, store)).resolves.toBe(
      true
    );
    expect(store.data.has('revoked:jti-1')).toBe(true);
  });

  it('sets TTL to remaining token lifetime PLUS the refresh grace window (FINDING-001)', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T00:00:00Z'));
    const now = Math.floor(Date.now() / 1000);

    const store = memoryStore();
    await revokeToken('jti-1', now + 900, store);
    // The entry must outlive exp by the same grace window /auth/refresh
    // honours, otherwise a revoked token becomes refreshable the moment it
    // expires.
    expect(store.ttls.get('revoked:jti-1')).toBe(900 + REFRESH_GRACE_SECONDS);
  });

  it('keeps an already-expired token blacklisted for the remainder of the grace window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T00:00:00Z'));
    const now = Math.floor(Date.now() / 1000);

    const store = memoryStore();
    await revokeToken('jti-1', now - 100, store); // expired 100 s ago
    expect(store.ttls.get('revoked:jti-1')).toBe(REFRESH_GRACE_SECONDS - 100);
  });

  it('honours a caller-supplied grace window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T00:00:00Z'));
    const now = Math.floor(Date.now() / 1000);

    const store = memoryStore();
    await revokeToken('jti-1', now + 900, store, { graceSeconds: 30 });
    expect(store.ttls.get('revoked:jti-1')).toBe(930);
  });

  it('clamps TTL to a minimum of 60 seconds for already-expired tokens', async () => {
    const store = memoryStore();
    await revokeToken('jti-1', 0, store);
    expect(store.ttls.get('revoked:jti-1')).toBe(60);
  });

  it('returns false when the store put throws', async () => {
    const store: RevocationStore = {
      get: async () => null,
      put: async () => {
        throw new Error('KV outage');
      },
    };
    await expect(revokeToken('jti-1', 0, store)).resolves.toBe(false);
  });
});
