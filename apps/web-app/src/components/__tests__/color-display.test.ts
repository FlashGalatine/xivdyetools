/**
 * XIV Dye Tools - ColorDisplay Unit Tests
 *
 * Tests the color display component for showing dye colors and properties.
 * Covers rendering, comparison mode, color values, and accessibility.
 *
 * @module components/__tests__/color-display.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorDisplay } from '../color-display';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

vi.mock('@services/index', () => ({
  ColorService: {
    getColorDistance: vi.fn().mockReturnValue(42.5),
    getContrastRatio: vi.fn().mockReturnValue(4.5),
    meetsWCAGAA: vi.fn().mockReturnValue(true),
    meetsWCAGAAA: vi.fn().mockReturnValue(false),
    getPerceivedLuminance: vi.fn().mockReturnValue(0.42),
    isLightColor: vi.fn().mockReturnValue(true),
    getOptimalTextColor: vi.fn().mockReturnValue('#000000'),
  },
  LanguageService: {
    t: (key: string) => key,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('ColorDisplay', () => {
  let container: HTMLElement;
  let display: ColorDisplay | null;

  beforeEach(() => {
    container = createTestContainer();
    display = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (display) {
      try {
        display.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('Empty State', () => {
    it('should render empty state when no dye selected', () => {
      display = new ColorDisplay(container);
      display.init();

      const emptyState = query(container, '.border-dashed');
      expect(emptyState).not.toBeNull();
    });

    it('should show "No color selected" text', () => {
      display = new ColorDisplay(container);
      display.init();

      expect(container.textContent).toContain('No color selected');
    });
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render primary color card when dye is set', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      const labelEl = query(container, '.uppercase.tracking-wide');
      expect(labelEl?.textContent).toBe('Primary');
    });

    it('should render color swatch with correct background', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      const swatch = query(container, `[style*="background-color: ${mockDyes[0].hex}"]`);
      expect(swatch).not.toBeNull();
    });

    it('should render dye name', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain(`Dye-${mockDyes[0].itemID}`);
    });
  });

  // ============================================================================
  // Color Values Tests
  // ============================================================================

  describe('Color Values', () => {
    it('should show hex value when showHex is true', () => {
      display = new ColorDisplay(container, { showHex: true });
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Hex');
      expect(container.textContent).toContain(mockDyes[0].hex);
    });

    it('should hide hex value when showHex is false', () => {
      display = new ColorDisplay(container, { showHex: false });
      display.init();
      display.setDye(mockDyes[0]);

      // Should not find the Hex label section
      const hexLabel = Array.from(container.querySelectorAll('.uppercase')).find(
        (el) => el.textContent === 'Hex'
      );
      expect(hexLabel).toBeUndefined();
    });

    it('should show RGB value when showRGB is true', () => {
      display = new ColorDisplay(container, { showRGB: true });
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('RGB');
    });

    it('should show HSV value when showHSV is true', () => {
      display = new ColorDisplay(container, { showHSV: true });
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('HSV');
    });

    it('should have clickable hex value for copy', () => {
      display = new ColorDisplay(container, { showHex: true });
      display.init();
      display.setDye(mockDyes[0]);

      const copyBtn = query(container, `[data-copy="${mockDyes[0].hex}"]`);
      expect(copyBtn).not.toBeNull();
    });

    it('should copy value to clipboard on click', async () => {
      display = new ColorDisplay(container, { showHex: true });
      display.init();
      display.setDye(mockDyes[0]);

      const copyBtn = query<HTMLButtonElement>(container, `[data-copy="${mockDyes[0].hex}"]`);
      click(copyBtn);

      // Wait for async clipboard operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockDyes[0].hex);
    });
  });

  // ============================================================================
  // Comparison Mode Tests
  // ============================================================================

  describe('Comparison Mode', () => {
    it('should render comparison card when comparison dye is set', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);
      display.setComparisonDye(mockDyes[1]);

      const labels = queryAll(container, '.uppercase.tracking-wide');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).toContain('Comparison');
    });

    it('should show color distance when showDistance is true', () => {
      display = new ColorDisplay(container, { showDistance: true });
      display.init();
      display.setDye(mockDyes[0]);
      display.setComparisonDye(mockDyes[1]);

      expect(container.textContent).toContain('Color Distance');
    });

    it('should show contrast ratio in comparison', () => {
      display = new ColorDisplay(container, { showDistance: true });
      display.init();
      display.setDye(mockDyes[0]);
      display.setComparisonDye(mockDyes[1]);

      expect(container.textContent).toContain('Contrast Ratio');
    });

    it('should show WCAG compliance status', () => {
      display = new ColorDisplay(container, { showDistance: true });
      display.init();
      display.setDye(mockDyes[0]);
      display.setComparisonDye(mockDyes[1]);

      expect(container.textContent).toContain('WCAG AA');
      expect(container.textContent).toContain('WCAG AAA');
    });

    it('should show progress bar for distance', () => {
      display = new ColorDisplay(container, { showDistance: true });
      display.init();
      display.setDye(mockDyes[0]);
      display.setComparisonDye(mockDyes[1]);

      const progressBar = query(container, '.bg-blue-500.h-2.rounded-full');
      expect(progressBar).not.toBeNull();
    });
  });

  // ============================================================================
  // Color Properties Tests
  // ============================================================================

  describe('Color Properties', () => {
    it('should render color properties section', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Color Properties');
    });

    it('should show category property', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Category');
      expect(container.textContent).toContain(mockDyes[0].category);
    });

    it('should show acquisition property', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Acquisition');
    });

    it('should show item ID property', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Item ID');
      expect(container.textContent).toContain(String(mockDyes[0].itemID));
    });

    it('should show brightness property', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Brightness');
    });

    it('should show saturation property', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Saturation');
    });
  });

  // ============================================================================
  // Accessibility Section Tests
  // ============================================================================

  describe('Accessibility Section', () => {
    it('should render accessibility section when showAccessibility is true', () => {
      display = new ColorDisplay(container, { showAccessibility: true });
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Accessibility');
    });

    it('should hide accessibility section when showAccessibility is false', () => {
      display = new ColorDisplay(container, { showAccessibility: false });
      display.init();
      display.setDye(mockDyes[0]);

      // Should only find one "Accessibility" - in the section title
      const accessibilityMentions = container.textContent?.match(/Accessibility/g) || [];
      expect(accessibilityMentions.length).toBe(0);
    });

    it('should show perceived luminance', () => {
      display = new ColorDisplay(container, { showAccessibility: true });
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Perceived Luminance');
    });

    it('should show brightness classification', () => {
      display = new ColorDisplay(container, { showAccessibility: true });
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Brightness Classification');
    });

    it('should show optimal text color', () => {
      display = new ColorDisplay(container, { showAccessibility: true });
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain('Optimal Text Color');
    });
  });

  // ============================================================================
  // Swatch Accessibility Tests
  // ============================================================================

  describe('Swatch Accessibility', () => {
    it('should have role="img" on color swatch', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      const swatch = query(container, '[role="img"]');
      expect(swatch).not.toBeNull();
    });

    it('should have aria-label on color swatch', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      const swatch = query(container, '[role="img"]');
      expect(swatch?.hasAttribute('aria-label')).toBe(true);
    });
  });

  // ============================================================================
  // State Management Tests
  // ============================================================================

  describe('State Management', () => {
    it('should return current dye with getDye', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      expect(display.getDye()).toEqual(mockDyes[0]);
    });

    it('should return null when no dye set', () => {
      display = new ColorDisplay(container);
      display.init();

      expect(display.getDye()).toBeNull();
    });

    it('should update when setDye is called', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      expect(container.textContent).toContain(mockDyes[0].hex);

      display.setDye(mockDyes[1]);

      expect(container.textContent).toContain(mockDyes[1].hex);
    });

    it('should clear comparison when setComparisonDye(null) is called', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);
      display.setComparisonDye(mockDyes[1]);
      display.setComparisonDye(null);

      const labels = queryAll(container, '.uppercase.tracking-wide');
      const labelTexts = Array.from(labels).map((l) => l.textContent);
      expect(labelTexts).not.toContain('Comparison');
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      display = new ColorDisplay(container);
      display.init();
      display.setDye(mockDyes[0]);

      display.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
