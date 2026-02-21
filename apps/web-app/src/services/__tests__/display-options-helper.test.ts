/**
 * XIV Dye Tools - Display Options Helper Unit Tests
 *
 * Tests the display options utility functions for consistent
 * display option handling across tools.
 *
 * @module services/__tests__/display-options-helper.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  applyDisplayOptions,
  hasDisplayOptionsChanges,
  getCardDisplayOptions,
  mergeWithDefaults,
  DEFAULT_DISPLAY_OPTIONS,
  type ApplyDisplayOptionsConfig,
  type DisplayOptionsChangeCallback,
} from '../display-options-helper';
import type { DisplayOptionsConfig } from '@shared/tool-config-types';
import { logger } from '@shared/logger';

// Mock the logger
vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('display-options-helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // DEFAULT_DISPLAY_OPTIONS Tests
  // ============================================================================

  describe('DEFAULT_DISPLAY_OPTIONS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_DISPLAY_OPTIONS).toEqual({
        showHex: true,
        showRgb: false,
        showHsv: false,
        showLab: false,
        showPrice: true,
        showDeltaE: true,
        showAcquisition: false,
      });
    });

    it('should be immutable (not frozen but values unchanged)', () => {
      expect(DEFAULT_DISPLAY_OPTIONS.showHex).toBe(true);
      expect(DEFAULT_DISPLAY_OPTIONS.showPrice).toBe(true);
      expect(DEFAULT_DISPLAY_OPTIONS.showRgb).toBe(false);
    });
  });

  // ============================================================================
  // applyDisplayOptions Tests
  // ============================================================================

  describe('applyDisplayOptions', () => {
    it('should return unchanged options when no incoming changes', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      const result = applyDisplayOptions({
        current,
        incoming: {},
        toolName: 'TestTool',
      });

      expect(result.hasChanges).toBe(false);
      expect(result.changedKeys).toHaveLength(0);
      expect(result.options).toEqual(current);
    });

    it('should apply single option change', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      const result = applyDisplayOptions({
        current,
        incoming: { showRgb: true },
        toolName: 'TestTool',
      });

      expect(result.hasChanges).toBe(true);
      expect(result.changedKeys).toEqual(['showRgb']);
      expect(result.options.showRgb).toBe(true);
    });

    it('should apply multiple option changes', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      const result = applyDisplayOptions({
        current,
        incoming: { showRgb: true, showHsv: true, showLab: true },
        toolName: 'TestTool',
      });

      expect(result.hasChanges).toBe(true);
      expect(result.changedKeys).toEqual(['showRgb', 'showHsv', 'showLab']);
      expect(result.options.showRgb).toBe(true);
      expect(result.options.showHsv).toBe(true);
      expect(result.options.showLab).toBe(true);
    });

    it('should ignore unchanged values', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      const result = applyDisplayOptions({
        current,
        incoming: { showHex: true }, // Same as default
        toolName: 'TestTool',
      });

      expect(result.hasChanges).toBe(false);
      expect(result.changedKeys).toHaveLength(0);
    });

    it('should not mutate the original current object', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };
      const originalValue = current.showRgb;

      applyDisplayOptions({
        current,
        incoming: { showRgb: true },
        toolName: 'TestTool',
      });

      expect(current.showRgb).toBe(originalValue);
    });

    it('should log changes when logChanges is true (default)', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      applyDisplayOptions({
        current,
        incoming: { showRgb: true },
        toolName: 'TestTool',
      });

      expect(logger.info).toHaveBeenCalledWith(
        '[TestTool] setConfig: displayOptions.showRgb -> true'
      );
    });

    it('should not log changes when logChanges is false', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      applyDisplayOptions({
        current,
        incoming: { showRgb: true },
        toolName: 'TestTool',
        logChanges: false,
      });

      expect(logger.info).not.toHaveBeenCalled();
    });

    it('should call onChange callback for each change', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };
      const onChange = vi.fn();

      applyDisplayOptions({
        current,
        incoming: { showRgb: true, showHsv: true },
        toolName: 'TestTool',
        onChange,
      });

      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenCalledWith('showRgb', true, expect.any(Object));
      expect(onChange).toHaveBeenCalledWith('showHsv', true, expect.any(Object));
    });

    it('should pass accumulated changes to onChange callback', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };
      const onChange = vi.fn();

      applyDisplayOptions({
        current,
        incoming: { showRgb: true, showHsv: true },
        toolName: 'TestTool',
        onChange,
      });

      // Second call should have both changes
      expect(onChange).toHaveBeenLastCalledWith('showHsv', true, { showRgb: true, showHsv: true });
    });

    it('should handle all display option keys', () => {
      const current: DisplayOptionsConfig = {
        showHex: true,
        showRgb: false,
        showHsv: false,
        showLab: false,
        showPrice: true,
        showDeltaE: true,
        showAcquisition: false,
      };

      const incoming: Partial<DisplayOptionsConfig> = {
        showHex: false,
        showRgb: true,
        showHsv: true,
        showLab: true,
        showPrice: false,
        showDeltaE: false,
        showAcquisition: true,
      };

      const result = applyDisplayOptions({
        current,
        incoming,
        toolName: 'TestTool',
        logChanges: false,
      });

      expect(result.hasChanges).toBe(true);
      expect(result.changedKeys).toHaveLength(7);
      expect(result.options).toEqual(incoming);
    });
  });

  // ============================================================================
  // hasDisplayOptionsChanges Tests
  // ============================================================================

  describe('hasDisplayOptionsChanges', () => {
    it('should return false when no changes', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      expect(hasDisplayOptionsChanges(current, {})).toBe(false);
    });

    it('should return false when incoming matches current', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      expect(hasDisplayOptionsChanges(current, { showHex: true })).toBe(false);
    });

    it('should return true when single option differs', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      expect(hasDisplayOptionsChanges(current, { showRgb: true })).toBe(true);
    });

    it('should return true when multiple options differ', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      expect(hasDisplayOptionsChanges(current, { showRgb: true, showHsv: true })).toBe(true);
    });

    it('should handle all option types', () => {
      const current: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      expect(hasDisplayOptionsChanges(current, { showPrice: false })).toBe(true);
      expect(hasDisplayOptionsChanges(current, { showDeltaE: false })).toBe(true);
      expect(hasDisplayOptionsChanges(current, { showAcquisition: true })).toBe(true);
    });
  });

  // ============================================================================
  // getCardDisplayOptions Tests
  // ============================================================================

  describe('getCardDisplayOptions', () => {
    it('should return all options with showPrices true', () => {
      const options: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS };

      const result = getCardDisplayOptions(options, true);

      expect(result).toEqual({
        showHex: true,
        showRgb: false,
        showHsv: false,
        showLab: false,
        showPrice: true,
        showDeltaE: true,
        showAcquisition: false,
      });
    });

    it('should disable showPrice when showPrices is false', () => {
      const options: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS, showPrice: true };

      const result = getCardDisplayOptions(options, false);

      expect(result.showPrice).toBe(false);
    });

    it('should keep showPrice false when option is false even if showPrices is true', () => {
      const options: DisplayOptionsConfig = { ...DEFAULT_DISPLAY_OPTIONS, showPrice: false };

      const result = getCardDisplayOptions(options, true);

      expect(result.showPrice).toBe(false);
    });

    it('should preserve all other options regardless of showPrices', () => {
      const options: DisplayOptionsConfig = {
        showHex: false,
        showRgb: true,
        showHsv: true,
        showLab: true,
        showPrice: true,
        showDeltaE: false,
        showAcquisition: true,
      };

      const result = getCardDisplayOptions(options, false);

      expect(result.showHex).toBe(false);
      expect(result.showRgb).toBe(true);
      expect(result.showHsv).toBe(true);
      expect(result.showLab).toBe(true);
      expect(result.showDeltaE).toBe(false);
      expect(result.showAcquisition).toBe(true);
    });
  });

  // ============================================================================
  // mergeWithDefaults Tests
  // ============================================================================

  describe('mergeWithDefaults', () => {
    it('should return defaults when partial is null', () => {
      const result = mergeWithDefaults(null);

      expect(result).toEqual(DEFAULT_DISPLAY_OPTIONS);
    });

    it('should return defaults when partial is undefined', () => {
      const result = mergeWithDefaults(undefined);

      expect(result).toEqual(DEFAULT_DISPLAY_OPTIONS);
    });

    it('should return defaults when partial is empty object', () => {
      const result = mergeWithDefaults({});

      expect(result).toEqual(DEFAULT_DISPLAY_OPTIONS);
    });

    it('should merge partial options with defaults', () => {
      const result = mergeWithDefaults({ showRgb: true });

      expect(result).toEqual({
        ...DEFAULT_DISPLAY_OPTIONS,
        showRgb: true,
      });
    });

    it('should override defaults with partial values', () => {
      const partial: Partial<DisplayOptionsConfig> = {
        showHex: false,
        showPrice: false,
      };

      const result = mergeWithDefaults(partial);

      expect(result.showHex).toBe(false);
      expect(result.showPrice).toBe(false);
      expect(result.showRgb).toBe(false); // Default preserved
    });

    it('should return a new object (not mutate defaults)', () => {
      const result = mergeWithDefaults({ showRgb: true });

      expect(result).not.toBe(DEFAULT_DISPLAY_OPTIONS);
      expect(DEFAULT_DISPLAY_OPTIONS.showRgb).toBe(false);
    });
  });
});
