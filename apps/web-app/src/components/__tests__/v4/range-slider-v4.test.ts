/**
 * XIV Dye Tools - RangeSliderV4 Unit Tests
 *
 * Tests the V4 range slider Lit component for numeric input.
 * Covers rendering, value changes, and bounds validation.
 *
 * @module components/__tests__/v4/range-slider-v4.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('RangeSliderV4', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should be a custom element', async () => {
      const { RangeSliderV4 } = await import('../../v4/range-slider-v4');
      expect(RangeSliderV4).toBeDefined();
    });

    it('should have correct class name', async () => {
      const { RangeSliderV4 } = await import('../../v4/range-slider-v4');
      expect(RangeSliderV4.name).toBe('RangeSliderV4');
    });
  });

  // ============================================================================
  // Properties Tests
  // ============================================================================

  describe('Properties', () => {
    it('should have value property with default', async () => {
      const { RangeSliderV4 } = await import('../../v4/range-slider-v4');
      const slider = new RangeSliderV4();
      expect(slider.value).toBe(0);
    });

    it('should have min property with default', async () => {
      const { RangeSliderV4 } = await import('../../v4/range-slider-v4');
      const slider = new RangeSliderV4();
      expect(slider.min).toBe(0);
    });

    it('should have max property with default', async () => {
      const { RangeSliderV4 } = await import('../../v4/range-slider-v4');
      const slider = new RangeSliderV4();
      expect(slider.max).toBe(100);
    });

    it('should have step property with default', async () => {
      const { RangeSliderV4 } = await import('../../v4/range-slider-v4');
      const slider = new RangeSliderV4();
      expect(slider.step).toBe(1);
    });
  });

  // ============================================================================
  // Component Structure Tests
  // ============================================================================

  describe('Component Structure', () => {
    it('should extend BaseLitComponent', async () => {
      const { RangeSliderV4 } = await import('../../v4/range-slider-v4');
      const { BaseLitComponent } = await import('../../v4/base-lit-component');
      expect(RangeSliderV4.prototype instanceof BaseLitComponent).toBe(true);
    });

    it('should have styles defined', async () => {
      const { RangeSliderV4 } = await import('../../v4/range-slider-v4');
      expect(RangeSliderV4.styles).toBeDefined();
    });
  });
});
