/**
 * Tests for Preset Favorites Service
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPresetFavorites,
  addPresetFavorite,
  removePresetFavorite,
  isPresetFavorited,
  MAX_PRESET_FAVORITES,
} from './preset-favorites.js';

// Create mock KV namespace with proper Map-based storage
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
    _store: store,
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

// Mock logger
const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
} as unknown as import('@xivdyetools/logger').ExtendedLogger;

describe('preset-favorites.ts', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  const mockUserId = 'user-123';
  const KEY = `xivdye:preset_favorites:v1:${mockUserId}`;

  beforeEach(() => {
    mockKV = createMockKV();
    vi.clearAllMocks();
  });

  describe('Constants', () => {
    it('should cap favorites at 50 presets', () => {
      expect(MAX_PRESET_FAVORITES).toBe(50);
    });
  });

  describe('getPresetFavorites', () => {
    it('should return empty array when no favorites exist', async () => {
      const favorites = await getPresetFavorites(mockKV, mockUserId);
      expect(favorites).toEqual([]);
    });

    it('should return favorited preset IDs from KV', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a', 'preset-b']));

      const favorites = await getPresetFavorites(mockKV, mockUserId);

      expect(favorites).toEqual(['preset-a', 'preset-b']);
    });

    it('should read from the preset_favorites KV namespace (distinct from dye favorites)', async () => {
      await getPresetFavorites(mockKV, mockUserId);

      expect(mockKV.get).toHaveBeenCalledWith(KEY);
    });

    it('should return empty array when stored value is not an array', async () => {
      mockKV._store.set(KEY, JSON.stringify({ not: 'an array' }));

      const favorites = await getPresetFavorites(mockKV, mockUserId);

      expect(favorites).toEqual([]);
    });

    it('should keep valid string entries and drop non-string ones (v1 fallback)', async () => {
      // OPT-007: the lenient v1 fallback salvages valid IDs instead of
      // discarding the whole blob
      mockKV._store.set(KEY, JSON.stringify(['preset-a', 42]));

      const favorites = await getPresetFavorites(mockKV, mockUserId);

      expect(favorites).toEqual(['preset-a']);
    });

    it('should return empty array and log on invalid JSON', async () => {
      mockKV._store.set(KEY, 'not-json{');

      const favorites = await getPresetFavorites(mockKV, mockUserId, mockLogger);

      expect(favorites).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get preset favorite entries',
        expect.any(Error),
        { userId: mockUserId }
      );
    });

    it('should return empty array on KV error without a logger', async () => {
      mockKV.get = vi.fn().mockRejectedValue(new Error('KV error'));

      const favorites = await getPresetFavorites(mockKV, mockUserId);

      expect(favorites).toEqual([]);
    });
  });

  describe('addPresetFavorite', () => {
    it('should add a new preset favorite', async () => {
      const result = await addPresetFavorite(mockKV, mockUserId, 'preset-a');

      expect(result).toEqual({ success: true });
      expect(mockKV._store.get(KEY)).toBe(JSON.stringify(['preset-a']));
    });

    it('should append to existing favorites', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a']));

      const result = await addPresetFavorite(mockKV, mockUserId, 'preset-b');

      expect(result).toEqual({ success: true });
      expect(mockKV._store.get(KEY)).toBe(JSON.stringify(['preset-a', 'preset-b']));
    });

    it('should return alreadyExists if preset is already favorited', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a']));

      const result = await addPresetFavorite(mockKV, mockUserId, 'preset-a');

      expect(result).toEqual({ success: false, reason: 'alreadyExists' });
    });

    it('should return limitReached at MAX_PRESET_FAVORITES', async () => {
      const existing = Array.from({ length: MAX_PRESET_FAVORITES }, (_, i) => `preset-${i}`);
      mockKV._store.set(KEY, JSON.stringify(existing));

      const result = await addPresetFavorite(mockKV, mockUserId, 'preset-overflow');

      expect(result).toEqual({ success: false, reason: 'limitReached' });
    });

    it('should return error and log on KV failure', async () => {
      mockKV.put = vi.fn().mockRejectedValue(new Error('KV error'));

      const result = await addPresetFavorite(mockKV, mockUserId, 'preset-a', 'Preset A', mockLogger);

      expect(result).toEqual({ success: false, reason: 'error' });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to add preset favorite',
        expect.any(Error),
        { userId: mockUserId, presetId: 'preset-a' }
      );
    });

    it('should return error on KV failure without a logger', async () => {
      mockKV.put = vi.fn().mockRejectedValue(new Error('KV error'));

      const result = await addPresetFavorite(mockKV, mockUserId, 'preset-a');

      expect(result).toEqual({ success: false, reason: 'error' });
    });
  });

  describe('removePresetFavorite', () => {
    it('should remove an existing preset favorite', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a', 'preset-b']));

      const result = await removePresetFavorite(mockKV, mockUserId, 'preset-a');

      expect(result).toEqual({ success: true });
      expect(mockKV._store.get(KEY)).toBe(JSON.stringify(['preset-b']));
    });

    it('should delete the KV entry when removing the last favorite', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a']));

      const result = await removePresetFavorite(mockKV, mockUserId, 'preset-a');

      expect(result).toEqual({ success: true });
      expect(mockKV._store.has(KEY)).toBe(false);
      expect(mockKV.delete).toHaveBeenCalledWith(KEY);
    });

    it('should return notFound if preset is not favorited', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a']));

      const result = await removePresetFavorite(mockKV, mockUserId, 'preset-missing');

      expect(result).toEqual({ success: false, reason: 'notFound' });
    });

    it('should return error and log on KV failure', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a', 'preset-b']));
      mockKV.put = vi.fn().mockRejectedValue(new Error('KV error'));

      const result = await removePresetFavorite(mockKV, mockUserId, 'preset-a', mockLogger);

      expect(result).toEqual({ success: false, reason: 'error' });
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to remove preset favorite',
        expect.any(Error),
        { userId: mockUserId, presetId: 'preset-a' }
      );
    });

    it('should return error on KV failure without a logger', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a', 'preset-b']));
      mockKV.put = vi.fn().mockRejectedValue(new Error('KV error'));

      const result = await removePresetFavorite(mockKV, mockUserId, 'preset-a');

      expect(result).toEqual({ success: false, reason: 'error' });
    });
  });

  describe('isPresetFavorited', () => {
    it('should return true if preset is favorited', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a']));

      const result = await isPresetFavorited(mockKV, mockUserId, 'preset-a');

      expect(result).toBe(true);
    });

    it('should return false if preset is not favorited', async () => {
      mockKV._store.set(KEY, JSON.stringify(['preset-a']));

      const result = await isPresetFavorited(mockKV, mockUserId, 'preset-missing');

      expect(result).toBe(false);
    });

    it('should return false when user has no favorites', async () => {
      const result = await isPresetFavorited(mockKV, mockUserId, 'preset-a');

      expect(result).toBe(false);
    });
  });
});
