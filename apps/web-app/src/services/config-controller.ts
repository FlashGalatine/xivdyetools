/**
 * XIV Dye Tools v4.0 - Config Controller Service
 *
 * Centralized reactive state management for v4 tool configurations.
 * Acts as a bridge between ConfigSidebar and Tool components.
 *
 * Features:
 * - Singleton pattern for global access
 * - Type-safe configuration with generics
 * - Subscription-based reactivity
 * - Automatic persistence to localStorage
 *
 * @module services/config-controller
 */

import { StorageService } from './storage-service';
import { logger } from '@shared/logger';
import type { ToolId } from './router-service';
import {
  type ToolConfigMap,
  type ConfigKey,
  type ToolConfig,
  DEFAULT_CONFIGS,
  getDefaultConfig,
} from '@shared/tool-config-types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Storage key prefix for v4 configurations
 * Uses different prefix from v3 to avoid conflicts during migration
 */
const CONFIG_STORAGE_PREFIX = 'xivdyetools_v4_config_';

// ============================================================================
// Types
// ============================================================================

/**
 * Listener callback type for config changes
 */
type ConfigListener<T> = (config: T) => void;

/**
 * Event detail for config change notifications
 */
export interface ConfigChangeEvent<K extends ConfigKey = ConfigKey> {
  tool: K;
  key: keyof ToolConfigMap[K];
  value: ToolConfigMap[K][keyof ToolConfigMap[K]];
  fullConfig: ToolConfigMap[K];
}

// ============================================================================
// ConfigController Class
// ============================================================================

/**
 * ConfigController - Centralized tool configuration management
 *
 * Provides reactive state management for all v4 tool configurations.
 * ConfigSidebar writes configs here, and tools subscribe to receive updates.
 *
 * @example
 * ```typescript
 * // Get singleton instance
 * const controller = ConfigController.getInstance();
 *
 * // Get a tool's config
 * const harmonyConfig = controller.getConfig('harmony');
 *
 * // Update a config value
 * controller.setConfig('harmony', { showNames: false });
 *
 * // Subscribe to changes
 * const unsubscribe = controller.subscribe('harmony', (config) => {
 *   console.log('Harmony config changed:', config);
 * });
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export class ConfigController {
  // Singleton instance
  private static instance: ConfigController | null = null;

  // In-memory config storage
  private configs: Map<ConfigKey, ToolConfig> = new Map();

  // Listeners for each config key
  private listeners: Map<ConfigKey, Set<ConfigListener<ToolConfig>>> = new Map();

  // Track which configs have been loaded from storage
  private loadedFromStorage: Set<ConfigKey> = new Set();

  /**
   * Private constructor (singleton pattern)
   */
  private constructor() {
    logger.info('[ConfigController] Initializing');
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ConfigController {
    if (!ConfigController.instance) {
      ConfigController.instance = new ConfigController();
    }
    return ConfigController.instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    if (ConfigController.instance) {
      ConfigController.instance.listeners.clear();
      ConfigController.instance.configs.clear();
      ConfigController.instance.loadedFromStorage.clear();
      ConfigController.instance = null;
    }
  }

  /**
   * Get the configuration for a specific tool
   * Lazy-loads from storage on first access
   *
   * @param key - Tool ID or 'global'
   * @returns The tool's configuration
   */
  getConfig<K extends ConfigKey>(key: K): ToolConfigMap[K] {
    // Lazy load from storage if not already loaded
    if (!this.loadedFromStorage.has(key)) {
      this.loadFromStorage(key);
    }

    // Get from in-memory cache, or use defaults
    const config = this.configs.get(key);
    if (config) {
      return config as ToolConfigMap[K];
    }

    // Return defaults if no stored config
    return getDefaultConfig(key);
  }

  /**
   * Update the configuration for a specific tool
   * Merges partial updates with existing config
   *
   * @param key - Tool ID or 'global'
   * @param partial - Partial config to merge
   */
  setConfig<K extends ConfigKey>(key: K, partial: Partial<ToolConfigMap[K]>): void {
    // Get current config (triggers lazy load if needed)
    const currentConfig = this.getConfig(key);

    // Merge with partial update
    const newConfig = {
      ...currentConfig,
      ...partial,
    } as ToolConfigMap[K];

    // Store in memory
    this.configs.set(key, newConfig);

    // Persist to storage
    this.saveToStorage(key, newConfig);

    // Notify listeners
    this.notifyListeners(key, newConfig);

    logger.debug(`[ConfigController] Updated ${key} config:`, partial);
  }

  /**
   * Subscribe to config changes for a specific tool
   *
   * @param key - Tool ID or 'global'
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  subscribe<K extends ConfigKey>(key: K, listener: ConfigListener<ToolConfigMap[K]>): () => void {
    // Get or create listener set for this key
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    const listenerSet = this.listeners.get(key)!;
    listenerSet.add(listener as ConfigListener<ToolConfig>);

    logger.debug(`[ConfigController] Subscribed to ${key} config changes`);

    // Return unsubscribe function
    return () => {
      listenerSet.delete(listener as ConfigListener<ToolConfig>);
      logger.debug(`[ConfigController] Unsubscribed from ${key} config changes`);
    };
  }

  /**
   * Reset a tool's config to defaults
   *
   * @param key - Tool ID or 'global'
   */
  resetConfig<K extends ConfigKey>(key: K): void {
    const defaultConfig = getDefaultConfig(key);
    this.configs.set(key, defaultConfig);
    this.saveToStorage(key, defaultConfig);
    this.notifyListeners(key, defaultConfig);

    logger.info(`[ConfigController] Reset ${key} config to defaults`);
  }

  /**
   * Reset all configs to defaults
   */
  resetAllConfigs(): void {
    const keys: ConfigKey[] = [
      'global',
      'market',
      'advanced',
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

    for (const key of keys) {
      this.resetConfig(key);
    }
  }

  /**
   * Get all configs (for debugging/export)
   */
  getAllConfigs(): ToolConfigMap {
    return {
      global: this.getConfig('global'),
      market: this.getConfig('market'),
      advanced: this.getConfig('advanced'),
      harmony: this.getConfig('harmony'),
      extractor: this.getConfig('extractor'),
      accessibility: this.getConfig('accessibility'),
      comparison: this.getConfig('comparison'),
      gradient: this.getConfig('gradient'),
      mixer: this.getConfig('mixer'),
      presets: this.getConfig('presets'),
      budget: this.getConfig('budget'),
      swatch: this.getConfig('swatch'),
    };
  }

  /**
   * Export all configs as a serializable object for backup/sharing
   */
  exportAllConfigs(): ToolConfigMap {
    return this.getAllConfigs();
  }

  /**
   * Import configs from a serialized object (e.g., from file upload)
   * Only imports valid config keys, ignores unknown keys
   *
   * @param configs - Partial config object to import
   */
  importConfigs(configs: Partial<ToolConfigMap>): void {
    const validKeys: ConfigKey[] = [
      'global',
      'market',
      'advanced',
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

    for (const key of validKeys) {
      if (key in configs && configs[key]) {
        this.setConfig(key, configs[key] as Partial<ToolConfigMap[typeof key]>);
      }
    }

    logger.info('[ConfigController] Imported configs');
  }

  /**
   * Check if a string is a valid config key
   */
  isValidConfigKey(key: string): key is ConfigKey {
    const validKeys = [
      'global',
      'market',
      'advanced',
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
    return validKeys.includes(key);
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Load config from storage
   */
  private loadFromStorage<K extends ConfigKey>(key: K): void {
    const storageKey = `${CONFIG_STORAGE_PREFIX}${key}`;
    const stored = StorageService.getItem<ToolConfigMap[K]>(storageKey);

    if (stored) {
      // Merge with defaults to ensure all keys exist
      // (handles migrations when new config options are added)
      const defaults = getDefaultConfig(key);
      const mergedConfig = {
        ...defaults,
        ...stored,
      } as ToolConfigMap[K];

      this.configs.set(key, mergedConfig);
      logger.debug(`[ConfigController] Loaded ${key} config from storage`);
    } else {
      // Use defaults if nothing in storage
      this.configs.set(key, getDefaultConfig(key));
      logger.debug(`[ConfigController] Using default ${key} config`);
    }

    this.loadedFromStorage.add(key);
  }

  /**
   * Save config to storage
   */
  private saveToStorage<K extends ConfigKey>(key: K, config: ToolConfigMap[K]): void {
    const storageKey = `${CONFIG_STORAGE_PREFIX}${key}`;
    const success = StorageService.setItem(storageKey, config);

    if (!success) {
      logger.warn(`[ConfigController] Failed to save ${key} config to storage`);
    }
  }

  /**
   * Notify all listeners for a config key
   */
  private notifyListeners<K extends ConfigKey>(key: K, config: ToolConfigMap[K]): void {
    const listenerSet = this.listeners.get(key);
    if (!listenerSet || listenerSet.size === 0) {
      return;
    }

    for (const listener of listenerSet) {
      try {
        listener(config);
      } catch (error) {
        logger.error(`[ConfigController] Listener error for ${key}:`, error);
      }
    }
  }
}

// ============================================================================
// Export Singleton Getter (convenience)
// ============================================================================

/**
 * Get the ConfigController singleton instance
 * Convenience export for shorter imports
 */
export function getConfigController(): ConfigController {
  return ConfigController.getInstance();
}
