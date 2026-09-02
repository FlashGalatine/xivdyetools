/**
 * XIV Dye Tools - ConfigController Unit Tests
 * Tests for centralized reactive state management for v4 tool configurations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigController } from '../config-controller';
import { StorageService } from '../storage-service';
import { getDefaultConfig, type ConfigKey, type ToolConfigMap } from '@shared/tool-config-types';

// Mock StorageService
vi.mock('../storage-service', () => ({
  StorageService: {
    getItem: vi.fn(),
    setItem: vi.fn(() => true),
  },
}));

describe('ConfigController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ConfigController.resetInstance();
    (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
  });

  afterEach(() => {
    ConfigController.resetInstance();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Singleton Pattern Tests
  // ============================================================================

  describe('Singleton Pattern', () => {
    it('should return the same instance on multiple getInstance calls', () => {
      const instance1 = ConfigController.getInstance();
      const instance2 = ConfigController.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after resetInstance', () => {
      const instance1 = ConfigController.getInstance();
      ConfigController.resetInstance();
      const instance2 = ConfigController.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it('should handle resetInstance when no instance exists', () => {
      // Reset twice - second should be no-op
      ConfigController.resetInstance();
      ConfigController.resetInstance();

      // Should still work
      const instance = ConfigController.getInstance();
      expect(instance).toBeDefined();
    });
  });

  // ============================================================================
  // getConfigController Helper Tests
  // ============================================================================

  // ============================================================================
  // getConfig Tests
  // ============================================================================

  describe('getConfig', () => {
    it('should return default config when no stored value', () => {
      const controller = ConfigController.getInstance();
      const config = controller.getConfig('harmony');

      expect(config).toBeDefined();
      // Should have default harmony config properties
      expect(config).toHaveProperty('harmonyType');
    });

    it('should load config from storage on first access', () => {
      const storedConfig = { harmonyType: 'analogous', sortBy: 'hue' };
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(storedConfig);

      const controller = ConfigController.getInstance();
      const config = controller.getConfig('harmony');

      expect(StorageService.getItem).toHaveBeenCalledWith('xivdyetools_v4_config_harmony');
      expect(config.harmonyType).toBe('analogous');
    });

    it('should merge stored config with defaults for migration', () => {
      // Stored config missing some new properties
      const storedConfig = { harmonyType: 'analogous' };
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(storedConfig);

      const controller = ConfigController.getInstance();
      const config = controller.getConfig('harmony');

      // Should have the stored value
      expect(config.harmonyType).toBe('analogous');
      // Should also have default values for other properties
      expect(config).toBeDefined();
    });

    it('should only load from storage once (lazy load)', () => {
      const controller = ConfigController.getInstance();

      // First access
      controller.getConfig('harmony');
      expect(StorageService.getItem).toHaveBeenCalledTimes(1);

      // Second access - should not call storage again
      controller.getConfig('harmony');
      expect(StorageService.getItem).toHaveBeenCalledTimes(1);
    });

    it('should return cached config on subsequent calls', () => {
      const controller = ConfigController.getInstance();

      const config1 = controller.getConfig('global');
      const config2 = controller.getConfig('global');

      // Should return equivalent configs
      expect(config1).toEqual(config2);
    });

    it('should support all config keys', () => {
      const controller = ConfigController.getInstance();
      const keys: ConfigKey[] = [
        'global',
        'market',
        'harmony',
        'extractor',
        'accessibility',
        'comparison',
        'gradient',
        'mixer',
        'presets',
        'budget',
        'swatch',
      ];

      keys.forEach((key) => {
        const config = controller.getConfig(key);
        expect(config).toBeDefined();
      });
    });
  });

  // ============================================================================
  // setConfig Tests
  // ============================================================================

  describe('setConfig', () => {
    it('should update config with partial values', () => {
      const controller = ConfigController.getInstance();

      controller.setConfig('harmony', { harmonyType: 'analogous' });

      const config = controller.getConfig('harmony');
      expect(config.harmonyType).toBe('analogous');
    });

    it('should merge partial update with existing config', () => {
      const controller = ConfigController.getInstance();

      // Set initial config
      controller.setConfig('harmony', { harmonyType: 'triadic' });

      // Update with different property - should preserve harmonyType
      const originalConfig = controller.getConfig('harmony');
      controller.setConfig('harmony', {});

      const updatedConfig = controller.getConfig('harmony');
      expect(updatedConfig.harmonyType).toBe(originalConfig.harmonyType);
    });

    it('should persist config to storage', () => {
      const controller = ConfigController.getInstance();

      controller.setConfig('harmony', { harmonyType: 'analogous' });

      expect(StorageService.setItem).toHaveBeenCalledWith(
        'xivdyetools_v4_config_harmony',
        expect.objectContaining({ harmonyType: 'analogous' })
      );
    });

    it('should notify listeners on config change', () => {
      const controller = ConfigController.getInstance();
      const listener = vi.fn();

      controller.subscribe('harmony', listener);
      controller.setConfig('harmony', { harmonyType: 'analogous' });

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ harmonyType: 'analogous' }));
    });
  });

  // ============================================================================
  // subscribe Tests
  // ============================================================================

  describe('subscribe', () => {
    it('should add listener and return unsubscribe function', () => {
      const controller = ConfigController.getInstance();
      const listener = vi.fn();

      const unsubscribe = controller.subscribe('harmony', listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should notify listener on config change', () => {
      const controller = ConfigController.getInstance();
      const listener = vi.fn();

      controller.subscribe('harmony', listener);
      controller.setConfig('harmony', { harmonyType: 'analogous' });

      expect(listener).toHaveBeenCalled();
    });

    it('should remove listener when unsubscribe is called', () => {
      const controller = ConfigController.getInstance();
      const listener = vi.fn();

      const unsubscribe = controller.subscribe('harmony', listener);
      controller.setConfig('harmony', { harmonyType: 'triadic' });

      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      controller.setConfig('harmony', { harmonyType: 'analogous' });

      // Should not be called again
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support multiple listeners for same key', () => {
      const controller = ConfigController.getInstance();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      controller.subscribe('harmony', listener1);
      controller.subscribe('harmony', listener2);

      controller.setConfig('harmony', { harmonyType: 'analogous' });

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should support listeners for different keys', () => {
      const controller = ConfigController.getInstance();
      const harmonyListener = vi.fn();
      const globalListener = vi.fn();

      controller.subscribe('harmony', harmonyListener);
      controller.subscribe('global', globalListener);

      controller.setConfig('harmony', { harmonyType: 'analogous' });

      expect(harmonyListener).toHaveBeenCalled();
      expect(globalListener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const controller = ConfigController.getInstance();
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      controller.subscribe('harmony', errorListener);
      controller.subscribe('harmony', normalListener);

      // Should not throw
      expect(() => {
        controller.setConfig('harmony', { harmonyType: 'analogous' });
      }).not.toThrow();

      // Normal listener should still be called
      expect(normalListener).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // resetConfig Tests
  // ============================================================================

  describe('resetConfig', () => {
    it('should reset config to defaults', () => {
      const controller = ConfigController.getInstance();

      // Set a custom value
      controller.setConfig('harmony', { harmonyType: 'analogous' });

      // Reset
      controller.resetConfig('harmony');

      // Should be back to default
      const config = controller.getConfig('harmony');
      expect(config).toBeDefined();
    });

    it('should persist reset config to storage', () => {
      const controller = ConfigController.getInstance();

      controller.resetConfig('harmony');

      expect(StorageService.setItem).toHaveBeenCalledWith(
        'xivdyetools_v4_config_harmony',
        expect.any(Object)
      );
    });

    it('should notify listeners on reset', () => {
      const controller = ConfigController.getInstance();
      const listener = vi.fn();

      controller.subscribe('harmony', listener);
      controller.resetConfig('harmony');

      expect(listener).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // resetAllConfigs Tests
  // ============================================================================

  describe('resetAllConfigs', () => {
    it('should reset all configs to defaults', () => {
      const controller = ConfigController.getInstance();

      // Set custom values
      controller.setConfig('harmony', { harmonyType: 'analogous' });
      controller.setConfig('global', {});

      // Reset all
      controller.resetAllConfigs();

      // Storage should have been called for each config
      expect(StorageService.setItem).toHaveBeenCalledTimes(14); // 2 sets + 12 resets (9 tools + global + market + advanced)
    });

    it('should notify all listeners', () => {
      const controller = ConfigController.getInstance();
      const harmonyListener = vi.fn();
      const globalListener = vi.fn();

      controller.subscribe('harmony', harmonyListener);
      controller.subscribe('global', globalListener);

      controller.resetAllConfigs();

      expect(harmonyListener).toHaveBeenCalled();
      expect(globalListener).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // getAllConfigs Tests
  // ============================================================================

  describe('getAllConfigs', () => {
    it('should return all configs', () => {
      const controller = ConfigController.getInstance();

      const allConfigs = controller.getAllConfigs();

      expect(allConfigs).toHaveProperty('global');
      expect(allConfigs).toHaveProperty('market');
      expect(allConfigs).toHaveProperty('harmony');
      expect(allConfigs).toHaveProperty('extractor');
      expect(allConfigs).toHaveProperty('accessibility');
      expect(allConfigs).toHaveProperty('comparison');
      expect(allConfigs).toHaveProperty('gradient');
      expect(allConfigs).toHaveProperty('mixer');
      expect(allConfigs).toHaveProperty('presets');
      expect(allConfigs).toHaveProperty('budget');
      expect(allConfigs).toHaveProperty('swatch');
    });

    it('should return complete ToolConfigMap type', () => {
      const controller = ConfigController.getInstance();

      const allConfigs = controller.getAllConfigs();

      // Verify each key returns a valid config
      Object.keys(allConfigs).forEach((key) => {
        expect(allConfigs[key as ConfigKey]).toBeDefined();
      });
    });
  });

  // ============================================================================
  // Storage Failure Handling Tests
  // ============================================================================

  // WEB-6 (2026-08-21 security audit): `importConfigs` whitelisted the
  // top-level tool keys but spread each tool's object raw into state and
  // storage, so unknown / ill-typed fields from a hand-edited settings file
  // survived. Each imported field must be a known key with the default's type.
  describe('importConfigs', () => {
    it('keeps only known, correctly-typed fields of each tool config', () => {
      const controller = ConfigController.getInstance();
      const defaults = getDefaultConfig('harmony');

      controller.importConfigs({
        harmony: {
          harmonyType: 'triadic',
          strictMatching: 'yes',
          companionDyesCount: '3',
          bogus: 1,
        },
      } as unknown as Partial<ToolConfigMap>);

      const harmony = controller.getConfig('harmony');
      expect(harmony.harmonyType).toBe('triadic');
      expect(harmony.strictMatching).toBe(defaults.strictMatching);
      expect(harmony.companionDyesCount).toBe(defaults.companionDyesCount);
      expect('bogus' in harmony).toBe(false);
    });

    it('ignores a tool entry that is not a plain object', () => {
      const controller = ConfigController.getInstance();

      controller.importConfigs({
        harmony: 'nope',
        gradient: ['steps', 5],
        mixer: null,
      } as unknown as Partial<ToolConfigMap>);

      expect(controller.getConfig('harmony')).toEqual(getDefaultConfig('harmony'));
      expect(controller.getConfig('gradient')).toEqual(getDefaultConfig('gradient'));
      expect(controller.getConfig('mixer')).toEqual(getDefaultConfig('mixer'));
    });

    it('accepts nested option objects only when the default is an object too', () => {
      const controller = ConfigController.getInstance();
      const defaults = getDefaultConfig('harmony');

      controller.importConfigs({
        harmony: { displayOptions: 'all', dyeFilters: { ...defaults.dyeFilters } },
      } as unknown as Partial<ToolConfigMap>);

      const harmony = controller.getConfig('harmony');
      expect(harmony.displayOptions).toEqual(defaults.displayOptions);
      expect(harmony.dyeFilters).toEqual(defaults.dyeFilters);
    });

    it('ignores unknown top-level keys (existing behaviour)', () => {
      const controller = ConfigController.getInstance();

      expect(() =>
        controller.importConfigs({ evil: { x: 1 } } as unknown as Partial<ToolConfigMap>)
      ).not.toThrow();
      expect(controller.isValidConfigKey('evil')).toBe(false);
    });
  });

  describe('Cross-tab sync (StorageEvent)', () => {
    const ADVANCED_KEY = 'xivdyetools_v4_config_advanced';

    it('re-reads a config another tab saved and notifies its subscribers', () => {
      const controller = ConfigController.getInstance();
      const listener = vi.fn();
      controller.subscribe('advanced', listener);
      expect(controller.getConfig('advanced').analyticsEnabled).toBe(false);

      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue({
        analyticsEnabled: true,
        performanceMode: false,
      });
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: ADVANCED_KEY,
          newValue: JSON.stringify({ analyticsEnabled: true, performanceMode: false }),
        })
      );

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ analyticsEnabled: true }));
      expect(controller.getConfig('advanced').analyticsEnabled).toBe(true);
    });

    it('falls back to the defaults when another tab clears storage (key null)', () => {
      const controller = ConfigController.getInstance();
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue({
        analyticsEnabled: true,
        performanceMode: false,
      });
      expect(controller.getConfig('advanced').analyticsEnabled).toBe(true);
      const listener = vi.fn();
      controller.subscribe('advanced', listener);

      (StorageService.getItem as ReturnType<typeof vi.fn>).mockReturnValue(null);
      window.dispatchEvent(new StorageEvent('storage', { key: null }));

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({ analyticsEnabled: false }));
      expect(controller.getConfig('advanced').analyticsEnabled).toBe(false);
    });

    it('ignores keys that are not persisted configs', () => {
      const controller = ConfigController.getInstance();
      const listener = vi.fn();
      controller.subscribe('advanced', listener);
      controller.getConfig('advanced');
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockClear();

      window.dispatchEvent(
        new StorageEvent('storage', { key: 'xivdyetools_theme', newValue: 'x' })
      );

      expect(listener).not.toHaveBeenCalled();
      expect(StorageService.getItem).not.toHaveBeenCalled();
    });

    it('stops listening once the instance is reset', () => {
      const controller = ConfigController.getInstance();
      controller.getConfig('advanced');
      ConfigController.resetInstance();
      (StorageService.getItem as ReturnType<typeof vi.fn>).mockClear();

      window.dispatchEvent(new StorageEvent('storage', { key: ADVANCED_KEY, newValue: '{}' }));

      expect(StorageService.getItem).not.toHaveBeenCalled();
    });
  });

  describe('Storage Failure Handling', () => {
    it('should handle storage save failure gracefully', () => {
      (StorageService.setItem as ReturnType<typeof vi.fn>).mockReturnValue(false);

      const controller = ConfigController.getInstance();

      // Should not throw even when storage fails
      expect(() => {
        controller.setConfig('harmony', { harmonyType: 'analogous' });
      }).not.toThrow();

      // Config should still be updated in memory
      const config = controller.getConfig('harmony');
      expect(config.harmonyType).toBe('analogous');
    });
  });

  // ============================================================================
  // NotifyListeners Edge Cases
  // ============================================================================

  describe('notifyListeners edge cases', () => {
    it('should handle empty listener set', () => {
      const controller = ConfigController.getInstance();

      // Set config without any listeners
      expect(() => {
        controller.setConfig('harmony', { harmonyType: 'analogous' });
      }).not.toThrow();
    });

    it('should handle config key with no listeners registered', () => {
      const controller = ConfigController.getInstance();
      const harmonyListener = vi.fn();

      controller.subscribe('harmony', harmonyListener);

      // Set a different config - should not call harmony listener
      controller.setConfig('global', {});

      expect(harmonyListener).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Reset Instance Edge Cases
  // ============================================================================

  describe('resetInstance edge cases', () => {
    it('should clear listeners on reset', () => {
      const controller = ConfigController.getInstance();
      const listener = vi.fn();

      controller.subscribe('harmony', listener);

      // Reset instance
      ConfigController.resetInstance();

      // Get new instance and set config
      const newController = ConfigController.getInstance();
      newController.setConfig('harmony', { harmonyType: 'analogous' });

      // Original listener should not be called
      expect(listener).not.toHaveBeenCalled();
    });

    it('should clear loadedFromStorage tracking on reset', () => {
      const controller = ConfigController.getInstance();

      // Load config (marks as loaded)
      controller.getConfig('harmony');
      expect(StorageService.getItem).toHaveBeenCalledTimes(1);

      // Reset instance
      ConfigController.resetInstance();

      // Get new instance and load same config
      const newController = ConfigController.getInstance();
      newController.getConfig('harmony');

      // Should call storage again (not cached)
      expect(StorageService.getItem).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // Type Safety Tests
  // ============================================================================

  describe('Type safety', () => {
    it('should return correct typed config for each key', () => {
      const controller = ConfigController.getInstance();

      // Each config should have the correct shape
      const harmonyConfig = controller.getConfig('harmony');
      expect(harmonyConfig).toHaveProperty('harmonyType');

      const globalConfig = controller.getConfig('global');
      expect(globalConfig).toBeDefined();
    });
  });
});
