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
import { DEFAULT_DISPLAY_OPTIONS } from '@shared/tool-config-types';

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
 * Default display options — re-exported, never redefined. This module used to
 * carry its own copy with the three 5.0 keys absent and four booleans
 * inverted; anything importing defaults via `@services/index` got that one.
 * One object, one source of truth: `@shared/tool-config-types`.
 */
export { DEFAULT_DISPLAY_OPTIONS };

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
    'showCmyk',
    'showPrice',
    'showDeltaE',
    'showAcquisition',
    // 5.0 rows: omitted here, every tool routing config through this helper
    // silently dropped the three toggles the sidebar was broadcasting.
    'showHue',
    'showStain',
    'showSpectrum',
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
