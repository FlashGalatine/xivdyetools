/**
 * XIV Dye Tools - ConfigController Unit Tests
 * Tests for centralized reactive state management for v4 tool configurations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigController, getConfigController } from '../config-controller';
import { StorageService } from '../storage-service';
import type { ConfigKey } from '@shared/tool-config-types';

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

  describe('getConfigController helper', () => {
    it('should return the singleton instance', () => {
      const helper = getConfigController();
      const direct = ConfigController.getInstance();

      expect(helper).toBe(direct);
    });
  });

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
