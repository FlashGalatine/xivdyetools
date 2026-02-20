/**
 * Tests for Unified Preferences Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock xivdyetools-core to avoid JSON import issues
vi.mock('@xivdyetools/core', () => ({
  // Must be constructable: bot-logic/localization.ts uses `new LocalizationService()`
  LocalizationService: vi.fn().mockImplementation(function () {
    return {
      setLocale: vi.fn().mockResolvedValue(undefined),
      getDyeName: vi.fn(() => null),
      getCategory: vi.fn((category: string) => category),
    };
  }),
  // bot-logic/input-resolution.ts creates a DyeService instance at module load time
  DyeService: vi.fn().mockImplementation(function () { return {}; }),
  dyeDatabase: [],
}));

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
    _store: store,
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

// Create mock logger
function createMockLogger() {
  return {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as never;
}
import {
  getUserPreferences,
  getPreference,
  setPreference,
  resetPreference,
  resolveBlendingMode,
  resolveMatchingMethod,
  resolveCount,
  resolveMarket,
  validatePreferenceValue,
  getDefaultValue,
  getAffectedCommands,
} from './preferences.js';
import type { UserPreferences } from '../types/preferences.js';

describe('Preferences Service', () => {
  let mockKV: ReturnType<typeof createMockKV>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  const testUserId = 'user-123456';

  beforeEach(() => {
    mockKV = createMockKV();
    mockLogger = createMockLogger();
  });

  describe('getUserPreferences', () => {
    it('returns empty object when no preferences exist', async () => {
      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs).toEqual({});
    });

    it('returns stored preferences', async () => {
      const stored: UserPreferences = {
        language: 'ja',
        blending: 'spectral',
        count: 8,
      };
      mockKV._store.set(`prefs:v1:${testUserId}`, JSON.stringify(stored));

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.language).toBe('ja');
      expect(prefs.blending).toBe('spectral');
      expect(prefs.count).toBe(8);
    });

    it('migrates legacy language preference', async () => {
      mockKV._store.set(`i18n:user:${testUserId}`, 'de');

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.language).toBe('de');

      // Should have saved to unified key
      const unified = mockKV._store.get(`prefs:v1:${testUserId}`);
      expect(unified).toBeDefined();
    });

    it('migrates legacy world preference', async () => {
      mockKV._store.set(`budget:world:v1:${testUserId}`, JSON.stringify({
        world: 'Cactuar',
        setAt: '2025-01-01T00:00:00Z',
      }));

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.world).toBe('Cactuar');
    });

    it('migrates both legacy preferences', async () => {
      mockKV._store.set(`i18n:user:${testUserId}`, 'fr');
      mockKV._store.set(`budget:world:v1:${testUserId}`, JSON.stringify({
        world: 'Gilgamesh',
        setAt: '2025-01-01T00:00:00Z',
      }));

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.language).toBe('fr');
      expect(prefs.world).toBe('Gilgamesh');
    });
  });

  describe('setPreference', () => {
    it('sets language preference', async () => {
      const result = await setPreference(mockKV, testUserId, 'language', 'ja', mockLogger);
      expect(result.success).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.language).toBe('ja');
    });

    it('sets blending mode preference', async () => {
      const result = await setPreference(mockKV, testUserId, 'blending', 'spectral', mockLogger);
      expect(result.success).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.blending).toBe('spectral');
    });

    it('sets matching method preference', async () => {
      const result = await setPreference(mockKV, testUserId, 'matching', 'ciede2000', mockLogger);
      expect(result.success).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.matching).toBe('ciede2000');
    });

    it('sets count preference', async () => {
      const result = await setPreference(mockKV, testUserId, 'count', 8, mockLogger);
      expect(result.success).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.count).toBe(8);
    });

    it('sets clan preference with normalization', async () => {
      const result = await setPreference(mockKV, testUserId, 'clan', 'xaela', mockLogger);
      expect(result.success).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.clan).toBe('Xaela');
    });

    it('sets gender preference', async () => {
      const result = await setPreference(mockKV, testUserId, 'gender', 'female', mockLogger);
      expect(result.success).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.gender).toBe('female');
    });

    it('sets world preference', async () => {
      const result = await setPreference(mockKV, testUserId, 'world', 'Cactuar', mockLogger);
      expect(result.success).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.world).toBe('Cactuar');
    });

    it('sets market preference from boolean', async () => {
      const result = await setPreference(mockKV, testUserId, 'market', true, mockLogger);
      expect(result.success).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.market).toBe(true);
    });

    it('sets market preference from string "on"', async () => {
      const result = await setPreference(mockKV, testUserId, 'market', 'on', mockLogger);
      expect(result.success).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.market).toBe(true);
    });

    it('rejects invalid language', async () => {
      const result = await setPreference(mockKV, testUserId, 'language', 'invalid', mockLogger);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalidLanguage');
    });

    it('rejects invalid blending mode', async () => {
      const result = await setPreference(mockKV, testUserId, 'blending', 'invalid', mockLogger);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalidBlendingMode');
    });

    it('rejects invalid count', async () => {
      const result = await setPreference(mockKV, testUserId, 'count', 15, mockLogger);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalidCount');
    });

    it('rejects invalid clan', async () => {
      const result = await setPreference(mockKV, testUserId, 'clan', 'NotAClan', mockLogger);
      expect(result.success).toBe(false);
      expect(result.reason).toBe('invalidClan');
    });
  });

  describe('resetPreference', () => {
    it('resets a single preference', async () => {
      await setPreference(mockKV, testUserId, 'blending', 'spectral', mockLogger);
      await setPreference(mockKV, testUserId, 'count', 8, mockLogger);

      const result = await resetPreference(mockKV, testUserId, 'blending', mockLogger);
      expect(result).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs.blending).toBeUndefined();
      expect(prefs.count).toBe(8); // Still there
    });

    it('resets all preferences', async () => {
      await setPreference(mockKV, testUserId, 'blending', 'spectral', mockLogger);
      await setPreference(mockKV, testUserId, 'count', 8, mockLogger);

      const result = await resetPreference(mockKV, testUserId, undefined, mockLogger);
      expect(result).toBe(true);

      const prefs = await getUserPreferences(mockKV, testUserId, mockLogger);
      expect(prefs).toEqual({});
    });
  });

  describe('Resolution Functions', () => {
    describe('resolveBlendingMode', () => {
      it('uses explicit value when provided', () => {
        const prefs: UserPreferences = { blending: 'spectral' };
        expect(resolveBlendingMode('lab', prefs)).toBe('lab');
      });

      it('uses preference when no explicit value', () => {
        const prefs: UserPreferences = { blending: 'spectral' };
        expect(resolveBlendingMode(undefined, prefs)).toBe('spectral');
      });

      it('uses default when no explicit or preference', () => {
        const prefs: UserPreferences = {};
        expect(resolveBlendingMode(undefined, prefs)).toBe('rgb');
      });

      it('ignores invalid explicit value', () => {
        const prefs: UserPreferences = { blending: 'spectral' };
        expect(resolveBlendingMode('invalid', prefs)).toBe('spectral');
      });
    });

    describe('resolveMatchingMethod', () => {
      it('uses explicit value when provided', () => {
        const prefs: UserPreferences = { matching: 'ciede2000' };
        expect(resolveMatchingMethod('hyab', prefs)).toBe('hyab');
      });

      it('uses preference when no explicit value', () => {
        const prefs: UserPreferences = { matching: 'ciede2000' };
        expect(resolveMatchingMethod(undefined, prefs)).toBe('ciede2000');
      });

      it('uses default when no explicit or preference', () => {
        const prefs: UserPreferences = {};
        expect(resolveMatchingMethod(undefined, prefs)).toBe('oklab');
      });
    });

    describe('resolveCount', () => {
      it('uses explicit value when provided', () => {
        const prefs: UserPreferences = { count: 8 };
        expect(resolveCount(3, prefs)).toBe(3);
      });

      it('uses preference when no explicit value', () => {
        const prefs: UserPreferences = { count: 8 };
        expect(resolveCount(undefined, prefs)).toBe(8);
      });

      it('uses default when no explicit or preference', () => {
        const prefs: UserPreferences = {};
        expect(resolveCount(undefined, prefs)).toBe(5);
      });
    });

    describe('resolveMarket', () => {
      it('uses explicit true', () => {
        const prefs: UserPreferences = { market: false };
        expect(resolveMarket(true, prefs)).toBe(true);
      });

      it('uses explicit false', () => {
        const prefs: UserPreferences = { market: true };
        expect(resolveMarket(false, prefs)).toBe(false);
      });

      it('uses preference when no explicit', () => {
        const prefs: UserPreferences = { market: true };
        expect(resolveMarket(undefined, prefs)).toBe(true);
      });

      it('uses default when no explicit or preference', () => {
        const prefs: UserPreferences = {};
        expect(resolveMarket(undefined, prefs)).toBe(false);
      });
    });
  });

  describe('validatePreferenceValue', () => {
    it('validates valid language', () => {
      expect(validatePreferenceValue('language', 'ja').valid).toBe(true);
    });

    it('rejects invalid language', () => {
      expect(validatePreferenceValue('language', 'invalid').valid).toBe(false);
    });

    it('validates valid blending mode', () => {
      expect(validatePreferenceValue('blending', 'spectral').valid).toBe(true);
    });

    it('validates valid count in range', () => {
      expect(validatePreferenceValue('count', 5).valid).toBe(true);
    });

    it('rejects count out of range', () => {
      expect(validatePreferenceValue('count', 0).valid).toBe(false);
      expect(validatePreferenceValue('count', 11).valid).toBe(false);
    });

    it('validates count from string', () => {
      expect(validatePreferenceValue('count', '5').valid).toBe(true);
    });

    it('validates valid clan (case-insensitive)', () => {
      expect(validatePreferenceValue('clan', 'xaela').valid).toBe(true);
      expect(validatePreferenceValue('clan', 'Xaela').valid).toBe(true);
    });

    it('validates valid gender', () => {
      expect(validatePreferenceValue('gender', 'male').valid).toBe(true);
      expect(validatePreferenceValue('gender', 'female').valid).toBe(true);
    });

    it('validates market boolean', () => {
      expect(validatePreferenceValue('market', true).valid).toBe(true);
      expect(validatePreferenceValue('market', false).valid).toBe(true);
    });

    it('validates market string values', () => {
      expect(validatePreferenceValue('market', 'on').valid).toBe(true);
      expect(validatePreferenceValue('market', 'off').valid).toBe(true);
      expect(validatePreferenceValue('market', 'true').valid).toBe(true);
      expect(validatePreferenceValue('market', 'false').valid).toBe(true);
    });
  });

  describe('getDefaultValue', () => {
    it('returns correct defaults', () => {
      expect(getDefaultValue('language')).toBe('en');
      expect(getDefaultValue('blending')).toBe('rgb');
      expect(getDefaultValue('matching')).toBe('oklab');
      expect(getDefaultValue('count')).toBe(5);
      expect(getDefaultValue('market')).toBe(false);
      expect(getDefaultValue('clan')).toBeUndefined();
      expect(getDefaultValue('gender')).toBeUndefined();
      expect(getDefaultValue('world')).toBeUndefined();
    });
  });

  describe('getAffectedCommands', () => {
    it('returns correct commands for each key', () => {
      expect(getAffectedCommands('language')).toContain('all commands');
      expect(getAffectedCommands('blending')).toContain('/mixer');
      expect(getAffectedCommands('blending')).toContain('/gradient');
      expect(getAffectedCommands('matching')).toContain('/extractor');
      expect(getAffectedCommands('clan')).toContain('/swatch');
      expect(getAffectedCommands('world')).toContain('/budget');
    });
  });
});
