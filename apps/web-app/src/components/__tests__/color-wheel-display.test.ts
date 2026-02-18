/**
 * XIV Dye Tools - ColorWheelDisplay Unit Tests
 *
 * Tests the color wheel display component for visualizing color harmonies.
 * Covers rendering, SVG structure, harmony types, and accessibility.
 *
 * @module components/__tests__/color-wheel-display.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorWheelDisplay } from '../color-wheel-display';
import {
  createTestContainer,
  cleanupTestContainer,
  query,
  queryAll,
  getAttr,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

vi.mock('@services/index', () => ({
  ColorService: {
    hexToRgb: vi.fn((hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;
      return { r, g, b };
    }),
    rgbToHsv: vi.fn((r: number, g: number, b: number) => {
      // Simplified HSV calculation for testing
      const max = Math.max(r, g, b);
      const v = (max / 255) * 100;
      let h = 0;
      if (r >= g && r >= b) h = 0;
      else if (g >= r && g >= b) h = 120;
      else h = 240;
      return { h, s: 50, v };
    }),
  },
  ThemeService: {
    getCurrentThemeObject: vi.fn().mockReturnValue({ isDark: false }),
  },
  LanguageService: {
    t: (key: string) => key,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
  },
}));

describe('ColorWheelDisplay', () => {
  let container: HTMLElement;
  let wheel: ColorWheelDisplay | null;

  beforeEach(() => {
    container = createTestContainer();
    wheel = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wheel) {
      try {
        wheel.destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
    cleanupTestContainer(container);
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render SVG element', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const svg = query(container, 'svg');
      expect(svg).not.toBeNull();
    });

    it('should have class color-wheel on SVG', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const svg = query(container, 'svg.color-wheel');
      expect(svg).not.toBeNull();
    });

    it('should render with specified size', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary', 300);
      wheel.init();

      const svg = query(container, 'svg');
      expect(getAttr(svg, 'width')).toBe('300');
      expect(getAttr(svg, 'height')).toBe('300');
    });

    it('should use default size of 200', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const svg = query(container, 'svg');
      expect(getAttr(svg, 'width')).toBe('200');
    });

    it('should have viewBox attribute', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary', 200);
      wheel.init();

      const svg = query(container, 'svg');
      expect(getAttr(svg, 'viewBox')).toBe('0 0 200 200');
    });
  });

  // ============================================================================
  // Color Wheel Segments Tests
  // ============================================================================

  describe('Color Wheel Segments', () => {
    it('should render color segments (paths)', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const paths = queryAll(container, 'svg path');
      expect(paths.length).toBeGreaterThan(0);
    });

    it('should render 60 hue segments', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      // 60 segments for the color wheel donut
      const paths = queryAll(container, 'svg path');
      expect(paths.length).toBe(60);
    });

    it('should have fill colors on segments', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const path = query(container, 'svg path');
      expect(path?.hasAttribute('fill')).toBe(true);
    });
  });

  // ============================================================================
  // Color Dots Tests
  // ============================================================================

  describe('Color Dots', () => {
    it('should render circles for base color', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const circles = queryAll(container, 'svg circle');
      expect(circles.length).toBeGreaterThan(0);
    });

    it('should render circles for harmony colors', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', mockDyes.slice(0, 3), 'triadic');
      wheel.init();

      const circles = queryAll(container, 'svg circle');
      // Each dye gets 2 circles (glow + main), plus base color gets 2
      // So with 3 harmony dyes + base = 8 circles
      expect(circles.length).toBe(8);
    });

    it('should have tooltips on harmony circles', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const titles = queryAll(container, 'svg title');
      expect(titles.length).toBeGreaterThan(0);
    });

    it('should include dye name in tooltip', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const title = query(container, 'svg title');
      expect(title?.textContent).toContain(`Dye-${mockDyes[0].itemID}`);
    });
  });

  // ============================================================================
  // Connection Lines Tests
  // ============================================================================

  describe('Connection Lines', () => {
    it('should render connection lines between colors', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const lines = queryAll(container, 'svg line');
      expect(lines.length).toBeGreaterThan(0);
    });

    it('should have dashed stroke on connection lines', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      // Query specifically for lines with stroke-dasharray (connection lines)
      // Indicator lines are rendered first without stroke-dasharray
      const dashedLines = queryAll(container, 'svg line[stroke-dasharray]');
      expect(dashedLines.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Center Label Tests
  // ============================================================================

  describe('Center Label', () => {
    it('should render center text label', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const text = query(container, 'svg text');
      expect(text).not.toBeNull();
    });

    it('should show short name for complementary', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const text = query(container, 'svg text');
      expect(text?.textContent).toBe('COMP');
    });

    it('should show short name for analogous', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'analogous');
      wheel.init();

      const text = query(container, 'svg text');
      expect(text?.textContent).toBe('ANALOG');
    });

    it('should show short name for triadic', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', mockDyes.slice(0, 2), 'triadic');
      wheel.init();

      const text = query(container, 'svg text');
      expect(text?.textContent).toBe('TRIAD');
    });

    it('should show short name for split-complementary', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', mockDyes.slice(0, 2), 'split-complementary');
      wheel.init();

      const text = query(container, 'svg text');
      expect(text?.textContent).toBe('SPLIT');
    });

    it('should show short name for tetradic', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', mockDyes.slice(0, 3), 'tetradic');
      wheel.init();

      const text = query(container, 'svg text');
      expect(text?.textContent).toBe('TETRA');
    });

    it('should show short name for square', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', mockDyes.slice(0, 3), 'square');
      wheel.init();

      const text = query(container, 'svg text');
      expect(text?.textContent).toBe('SQUARE');
    });

    it('should show short name for monochromatic', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'monochromatic');
      wheel.init();

      const text = query(container, 'svg text');
      expect(text?.textContent).toBe('MONO');
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have role="img" on SVG', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const svg = query(container, 'svg');
      expect(getAttr(svg, 'role')).toBe('img');
    });

    it('should have aria-label on SVG', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const svg = query(container, 'svg');
      expect(svg?.hasAttribute('aria-label')).toBe(true);
    });

    it('should include harmony type in aria-label', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const svg = query(container, 'svg');
      const ariaLabel = getAttr(svg, 'aria-label');
      expect(ariaLabel).toContain('harmony.complementary');
    });

    it('should include color count in aria-label', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', mockDyes.slice(0, 3), 'triadic');
      wheel.init();

      const svg = query(container, 'svg');
      const ariaLabel = getAttr(svg, 'aria-label');
      expect(ariaLabel).toContain('3');
    });
  });

  // ============================================================================
  // Harmony Indicator Lines Tests
  // ============================================================================

  describe('Harmony Indicator Lines', () => {
    it('should render indicator lines for complementary', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const lines = queryAll(container, 'svg line');
      // At least 2 indicator lines + connection lines
      expect(lines.length).toBeGreaterThanOrEqual(2);
    });

    it('should render 3 indicator lines for triadic', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', mockDyes.slice(0, 2), 'triadic');
      wheel.init();

      const lines = queryAll(container, 'svg line');
      // 3 indicator lines + 2 connection lines = 5
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ============================================================================
  // Defs and Gradients Tests
  // ============================================================================

  describe('Defs and Gradients', () => {
    it('should render defs element', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const defs = query(container, 'svg defs');
      expect(defs).not.toBeNull();
    });

    it('should render radial gradients for segments', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      const gradients = queryAll(container, 'svg radialGradient');
      expect(gradients.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      wheel = new ColorWheelDisplay(container, '#FF0000', [mockDyes[0]], 'complementary');
      wheel.init();

      wheel.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
