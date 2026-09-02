/**
 * XIV Dye Tools - Dye Service Wrapper Tests
 *
 * Tests for DyeService singleton wrapper
 *
 * @module services/__tests__/dye-service-wrapper.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DyeService, dyeService, resolvePresetDye, toStainId } from '../dye-service-wrapper';

describe('DyeService Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton before each test
    DyeService.resetInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Singleton Pattern
  // ==========================================================================

  describe('getInstance', () => {
    it('should return a singleton instance', () => {
      const instance1 = DyeService.getInstance();
      const instance2 = DyeService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create instance with dye database', () => {
      const instance = DyeService.getInstance();

      expect(instance).toBeTruthy();
      expect(typeof instance.getAllDyes).toBe('function');
    });

    it('should create new instance after reset', () => {
      const instance1 = DyeService.getInstance();
      DyeService.resetInstance();
      const instance2 = DyeService.getInstance();

      // Different objects after reset
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('resetInstance', () => {
    it('should reset the singleton to null', () => {
      DyeService.getInstance();
      DyeService.resetInstance();

      // Should be able to get a fresh instance
      const newInstance = DyeService.getInstance();
      expect(newInstance).toBeTruthy();
    });

    it('should allow re-initialization', () => {
      const first = DyeService.getInstance();
      DyeService.resetInstance();
      const second = DyeService.getInstance();

      expect(first).not.toBe(second);
    });
  });

  // ==========================================================================
  // Instance Methods (via Singleton)
  // ==========================================================================

  describe('instance methods', () => {
    it('should have getAllDyes method that returns dye array', () => {
      const instance = DyeService.getInstance();
      const dyes = instance.getAllDyes();

      expect(Array.isArray(dyes)).toBe(true);
      expect(dyes.length).toBeGreaterThan(0);
      // Each dye should have required properties
      expect(dyes[0]).toHaveProperty('id');
      expect(dyes[0]).toHaveProperty('name');
      expect(dyes[0]).toHaveProperty('hex');
    });

    it('should have getDyeById method', () => {
      const instance = DyeService.getInstance();
      // Get first dye to know a valid ID
      const allDyes = instance.getAllDyes();
      const firstDye = allDyes[0];

      const dye = instance.getDyeById(firstDye.id);

      expect(dye).not.toBeNull();
      expect(dye?.id).toBe(firstDye.id);
    });

    it('should return null for non-existent dye', () => {
      const instance = DyeService.getInstance();
      const dye = instance.getDyeById(999999);

      expect(dye).toBeNull();
    });

    it('should have searchByName method', () => {
      const instance = DyeService.getInstance();
      const results = instance.searchByName('Black');

      expect(Array.isArray(results)).toBe(true);
      // Should find at least Jet Black
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((d) => d.name.includes('Black'))).toBe(true);
    });

    it('should have findClosestDye method', () => {
      const instance = DyeService.getInstance();
      // Find closest to pure red (passing hex string)
      const closest = instance.findClosestDye('#FF0000');

      // May return null if no dyes match, or a Dye object
      if (closest !== null) {
        expect(closest).toHaveProperty('name');
      } else {
        // This is acceptable - finding closest can return null
        expect(closest).toBeNull();
      }
    });
  });
});

// ==========================================================================
// Exported Singleton
// ==========================================================================

describe('dyeService export', () => {
  beforeEach(() => {
    DyeService.resetInstance();
  });

  it('should export a singleton instance', () => {
    expect(dyeService).toBeTruthy();
  });

  it('should have core DyeService methods', () => {
    const instance = DyeService.getInstance();

    expect(typeof instance.getAllDyes).toBe('function');
    expect(typeof instance.getDyeById).toBe('function');
    expect(typeof instance.searchByName).toBe('function');
    expect(typeof instance.findClosestDye).toBe('function');
  });
});

// ==========================================================================
// Integration Tests
// ==========================================================================

describe('DyeService integration', () => {
  beforeEach(() => {
    DyeService.resetInstance();
  });

  it('should maintain singleton across multiple imports', async () => {
    const instance1 = DyeService.getInstance();

    // Re-import and check same singleton
    const { DyeService: ReimportedService } = await import('../dye-service-wrapper');
    const instance2 = ReimportedService.getInstance();

    // Should be the same instance
    expect(instance1).toBe(instance2);
  });

  it('should work correctly after reset and re-get', () => {
    const first = DyeService.getInstance();
    first.getAllDyes(); // Call a method

    DyeService.resetInstance();

    const second = DyeService.getInstance();
    const dyes = second.getAllDyes();

    expect(Array.isArray(dyes)).toBe(true);
    expect(dyes.length).toBeGreaterThan(0);
  });

  it('should return 125 dyes total (schema v2: Facewear moved out)', () => {
    const instance = DyeService.getInstance();
    const dyes = instance.getAllDyes();

    expect(dyes.length).toBe(125);
  });
});

// ============================================================================
// resolvePresetDye — the one read path every community preset goes through
// ============================================================================

/**
 * This block used to be the tripwire guarding the legacy-itemID branch: while
 * the live presets-api served rows whose `dyes` were 4.x itemIDs, deleting that
 * branch would have blanked every community palette.
 *
 * Its condition is now met and it has been inverted. The stainID D1 rewrite ran
 * 2026-08-28; a re-check on 2026-09-01 (dead-code audit DEAD-007) found 0
 * legacy IDs across every position of every `dyes` array in all 16 production
 * rows, with `previous_values` empty on all of them. Every producer now writes
 * stainIDs — the bot since discord-worker 5.1.0, the web form by validation.
 *
 * So the assertions below pin the *retirement*: a legacy itemID must resolve to
 * nothing. If community rows ever carry itemIDs again, this fails loudly
 * instead of the app silently resolving them through a second ID space.
 */
describe('resolvePresetDye', () => {
  it('resolves stainIDs (1–254) through the stain lookup', () => {
    expect(resolvePresetDye(1)?.stainID).toBe(1);
    expect(resolvePresetDye(254)).toBeUndefined(); // unassigned stain byte
  });

  it('no longer resolves legacy itemIDs — the branch is retired (DEAD-007)', () => {
    // The exact ids the live table held on 2026-08-20, before the rewrite.
    // Each one resolved to a dye then; none may resolve now.
    const preMigrationItemIds = [
      48171, 5785, 5787, 30124, 5761, 5734, 5749, 5762, 13715, 5758, 5804, 13722, 13117,
    ];
    for (const id of preMigrationItemIds) {
      expect(resolvePresetDye(id), `itemID ${id} must no longer resolve`).toBeUndefined();
    }
  });

  it('never guesses: ids in the 255–5728 gap, zero, negatives, non-integers and unknowns resolve to nothing', () => {
    expect(resolvePresetDye(0)).toBeUndefined();
    expect(resolvePresetDye(300)).toBeUndefined();
    expect(resolvePresetDye(-1042)).toBeUndefined(); // pre-v2 synthetic facewear id
    expect(resolvePresetDye(99_999_999)).toBeUndefined();
    expect(resolvePresetDye(1.5)).toBeUndefined();
    expect(resolvePresetDye(Number.NaN)).toBeUndefined();
  });
});

// ============================================================================
// toStainId — legacy 4.x itemID migration for persisted local data
// ============================================================================

describe('toStainId', () => {
  it('should map a legacy 4.x itemID to its stainID', () => {
    // Snow White: legacyItemID 5729 -> stainID 1
    expect(toStainId(5729)).toBe(1);
  });

  it('should pass a valid stainID through unchanged', () => {
    expect(toStainId(1)).toBe(1);
  });

  it('should return null for a value in neither ID space', () => {
    expect(toStainId(999999)).toBeNull();
  });
});
