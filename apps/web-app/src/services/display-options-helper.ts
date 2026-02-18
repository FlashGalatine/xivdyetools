/**
 * Display Options Helper
 * WEB-REF-003 Phase 4: Shared utilities for handling display options configuration.
 *
 * Provides reusable utilities for:
 * - Processing displayOptions from ConfigController
 * - Comparing and applying display option changes
 * - Logging display option updates consistently
 *
 * These utilities eliminate duplicated display options handling across tools.
 *
 * @module services/display-options-helper
 */

import { logger } from '@shared/logger';
import type { DisplayOptionsConfig } from '@shared/tool-config-types';

// ============================================================================
// Types
// ============================================================================

/**
 * Callback for when display options change
 */
export type DisplayOptionsChangeCallback = (
  key: keyof DisplayOptionsConfig,
  value: boolean,
  allChanges: Partial<DisplayOptionsConfig>
) => void;

/**
 * Options for applying display options
 */
export interface ApplyDisplayOptionsConfig {
  /** Current display options state */
  current: DisplayOptionsConfig;
  /** New options to apply */
  incoming: Partial<DisplayOptionsConfig>;
  /** Tool name for logging */
  toolName: string;
  /** Optional callback for each change */
  onChange?: DisplayOptionsChangeCallback;
  /** Whether to log each change (default: true) */
  logChanges?: boolean;
}

/**
 * Result of applying display options
 */
export interface ApplyDisplayOptionsResult {
  /** Updated options object */
  options: DisplayOptionsConfig;
  /** Whether any options changed */
  hasChanges: boolean;
  /** Keys that changed */
  changedKeys: (keyof DisplayOptionsConfig)[];
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default display options configuration
 * Used when initializing tools
 */
export const DEFAULT_DISPLAY_OPTIONS: DisplayOptionsConfig = {
  showHex: true,
  showRgb: false,
  showHsv: false,
  showLab: false,
  showPrice: true,
  showDeltaE: true,
  showAcquisition: false,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply incoming display options to current state.
 * Returns updated options and tracks which keys changed.
 *
 * @param config - Configuration for applying options
 * @returns Result with updated options and change tracking
 *
 * @example
 * // In setConfig method:
 * if (config.displayOptions) {
 *   const result = applyDisplayOptions({
 *     current: this.displayOptions,
 *     incoming: config.displayOptions,
 *     toolName: 'MixerTool',
 *   });
 *   if (result.hasChanges) {
 *     this.displayOptions = result.options;
 *     needsRerender = true;
 *   }
 * }
 */
export function applyDisplayOptions(config: ApplyDisplayOptionsConfig): ApplyDisplayOptionsResult {
  const { current, incoming, toolName, onChange, logChanges = true } = config;

  const updated: DisplayOptionsConfig = { ...current };
  const changedKeys: (keyof DisplayOptionsConfig)[] = [];
  const allChanges: Partial<DisplayOptionsConfig> = {};

  // Check each display option key
  const keys: (keyof DisplayOptionsConfig)[] = [
    'showHex',
    'showRgb',
    'showHsv',
    'showLab',
    'showPrice',
    'showDeltaE',
    'showAcquisition',
  ];

  for (const key of keys) {
    if (incoming[key] !== undefined && incoming[key] !== current[key]) {
      updated[key] = incoming[key]!;
      changedKeys.push(key);
      allChanges[key] = incoming[key];

      if (logChanges) {
        logger.info(`[${toolName}] setConfig: displayOptions.${key} -> ${incoming[key]}`);
      }

      if (onChange) {
        onChange(key, incoming[key]!, allChanges);
      }
    }
  }

  return {
    options: updated,
    hasChanges: changedKeys.length > 0,
    changedKeys,
  };
}

/**
 * Check if display options have any differences.
 * Useful for determining if re-render is needed.
 *
 * @param current - Current display options
 * @param incoming - Incoming options to compare
 * @returns true if any options differ
 */
export function hasDisplayOptionsChanges(
  current: DisplayOptionsConfig,
  incoming: Partial<DisplayOptionsConfig>
): boolean {
  const keys: (keyof DisplayOptionsConfig)[] = [
    'showHex',
    'showRgb',
    'showHsv',
    'showLab',
    'showPrice',
    'showDeltaE',
    'showAcquisition',
  ];

  return keys.some((key) => incoming[key] !== undefined && incoming[key] !== current[key]);
}

/**
 * Create a subset of display options for card components.
 * Extracts only the relevant options for v4-result-card.
 *
 * @param options - Full display options
 * @param showPrices - Whether prices are enabled (from MarketBoardService)
 * @returns Options subset for card components
 */
export function getCardDisplayOptions(
  options: DisplayOptionsConfig,
  showPrices: boolean
): Partial<DisplayOptionsConfig> {
  return {
    showHex: options.showHex,
    showRgb: options.showRgb,
    showHsv: options.showHsv,
    showLab: options.showLab,
    showPrice: options.showPrice && showPrices, // Combine with market setting
    showDeltaE: options.showDeltaE,
    showAcquisition: options.showAcquisition,
  };
}

/**
 * Merge partial display options with defaults.
 * Useful for initialization.
 *
 * @param partial - Partial options from storage or config
 * @returns Complete options with defaults applied
 */
export function mergeWithDefaults(
  partial: Partial<DisplayOptionsConfig> | null | undefined
): DisplayOptionsConfig {
  if (!partial) return { ...DEFAULT_DISPLAY_OPTIONS };

  return {
    ...DEFAULT_DISPLAY_OPTIONS,
    ...partial,
  };
}
