/**
 * Tests for User Preferences Service
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getUserWorld, setUserWorld, clearUserWorld } from './user-preferences.js';
import type { UserWorldPreference } from '../types/budget.js';

// Create mock KV namespace
function createMockKV() {
  const store = new Map<string, string>();

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
    _store: store, // For test inspection
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

describe('user-preferences.ts', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  const testUserId = 'user-123456789';

  beforeEach(() => {
    mockKV = createMockKV();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getUserWorld', () => {
    it('should return null for user with no preference', async () => {
      const result = await getUserWorld(mockKV, testUserId);
      expect(result).toBeNull();
    });

    it('should return stored preference', async () => {
      const preference: UserWorldPreference = {
        world: 'Crystal',
        setAt: new Date().toISOString(),
      };
      mockKV._store.set(`budget:world:v1:${testUserId}`, JSON.stringify(preference));

      const result = await getUserWorld(mockKV, testUserId);
      expect(result).toEqual(preference);
    });

    it('should return null on KV error', async () => {
      mockKV.get = vi.fn().mockRejectedValue(new Error('KV unavailable'));

      const result = await getUserWorld(mockKV, testUserId);
      expect(result).toBeNull();
    });
  });

  describe('setUserWorld', () => {
    it('should store world preference', async () => {
      await setUserWorld(mockKV, testUserId, 'Crystal');

      expect(mockKV.put).toHaveBeenCalled();
      const stored = mockKV._store.get(`budget:world:v1:${testUserId}`);
      expect(stored).toBeDefined();

      const parsed = JSON.parse(stored!);
      expect(parsed.world).toBe('Crystal');
      expect(parsed.setAt).toBeDefined();
    });

    it('should update existing preference', async () => {
      // Set initial preference
      await setUserWorld(mockKV, testUserId, 'Crystal');

      // Update to new world
      vi.advanceTimersByTime(1000);
      await setUserWorld(mockKV, testUserId, 'Aether');

      const stored = mockKV._store.get(`budget:world:v1:${testUserId}`);
      const parsed = JSON.parse(stored!);
      expect(parsed.world).toBe('Aether');
    });

    it('should return false on KV error', async () => {
      mockKV.put = vi.fn().mockRejectedValue(new Error('KV unavailable'));

      // Should return false on error
      const result = await setUserWorld(mockKV, testUserId, 'Crystal');
      expect(result).toBe(false);
    });
  });

  describe('clearUserWorld', () => {
    it('should delete world preference', async () => {
      // Set a preference first
      const preference: UserWorldPreference = {
        world: 'Crystal',
        setAt: new Date().toISOString(),
      };
      mockKV._store.set(`budget:world:v1:${testUserId}`, JSON.stringify(preference));

      await clearUserWorld(mockKV, testUserId);

      expect(mockKV.delete).toHaveBeenCalledWith(`budget:world:v1:${testUserId}`);
    });

    it('should not throw for non-existent preference', async () => {
      await expect(clearUserWorld(mockKV, testUserId)).resolves.not.toThrow();
    });
  });

  describe('integration', () => {
    it('should support full preference lifecycle', async () => {
      // Initially no preference
      let preference = await getUserWorld(mockKV, testUserId);
      expect(preference).toBeNull();

      // Set preference
      await setUserWorld(mockKV, testUserId, 'Crystal');
      preference = await getUserWorld(mockKV, testUserId);
      expect(preference?.world).toBe('Crystal');

      // Update preference
      await setUserWorld(mockKV, testUserId, 'Aether');
      preference = await getUserWorld(mockKV, testUserId);
      expect(preference?.world).toBe('Aether');

      // Clear preference
      await clearUserWorld(mockKV, testUserId);
      preference = await getUserWorld(mockKV, testUserId);
      expect(preference).toBeNull();
    });
  });
});
