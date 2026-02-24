/**
 * XIV Dye Tools - ColorblindnessDisplay Unit Tests
 *
 * Tests the colorblindness display component for vision simulation.
 * Covers rendering, all 5 simulation types, and color value display.
 *
 * @module components/__tests__/colorblindness-display.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorblindnessDisplay } from '../colorblindness-display';
import {
  createTestContainer,
  cleanupTestContainer,
  queryAll,
} from '../../__tests__/component-utils';

vi.mock('@services/index', () => ({
  ColorService: {
    hexToRgb: vi.fn((hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16) || 0;
      const g = parseInt(hex.slice(3, 5), 16) || 0;
      const b = parseInt(hex.slice(5, 7), 16) || 0;
      return { r, g, b };
    }),
    rgbToHex: vi.fn((r: number, g: number, b: number) => {
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
    }),
    simulateColorblindnessHex: vi.fn((hex: string) => {
      // Return modified hex to simulate colorblindness effect
      return hex;
    }),
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

describe('ColorblindnessDisplay', () => {
  let container: HTMLElement;
  let display: ColorblindnessDisplay | null;

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
  // Basic Rendering Tests
  // ============================================================================

  describe('Basic Rendering', () => {
    it('should render display container', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should render title', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      expect(container.textContent).toContain('Color Perception Simulation');
    });

    it('should render description', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      expect(container.textContent).toContain('See how this color appears');
    });

    it('should render color swatches', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      const swatches = queryAll(container, '[style*="background"]');
      expect(swatches.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Vision Type Simulation Tests
  // ============================================================================

  describe('Vision Type Simulations', () => {
    const visionTypes = [
      { type: 'normal', name: 'Normal Vision' },
      { type: 'deuteranopia', name: 'Deuteranopia' },
      { type: 'protanopia', name: 'Protanopia' },
      { type: 'tritanopia', name: 'Tritanopia' },
      { type: 'achromatopsia', name: 'Achromatopsia' },
    ];

    visionTypes.forEach(({ name }) => {
      it(`should render ${name} simulation`, () => {
        display = new ColorblindnessDisplay(container, '#FF0000');
        display.init();

        expect(container.textContent).toContain(name);
      });
    });

    it('should render all 5 vision type sections', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      // Check for all vision type names
      expect(container.textContent).toContain('Normal Vision');
      expect(container.textContent).toContain('Deuteranopia');
      expect(container.textContent).toContain('Protanopia');
      expect(container.textContent).toContain('Tritanopia');
      expect(container.textContent).toContain('Achromatopsia');
    });
  });

  // ============================================================================
  // Color Value Display Tests
  // ============================================================================

  describe('Color Value Display', () => {
    it('should render color values section', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      expect(container.textContent).toContain('Color Values');
    });

    it('should show RGB values', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      expect(container.textContent).toContain('rgb');
    });
  });

  // ============================================================================
  // Prevalence Information Tests
  // ============================================================================

  describe('Prevalence Information', () => {
    it('should show prevalence for deuteranopia', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      expect(container.textContent).toContain('~1.2%');
    });

    it('should show prevalence for protanopia', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      expect(container.textContent).toContain('~1.3%');
    });

    it('should show prevalence for tritanopia', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      expect(container.textContent).toContain('~0.02%');
    });
  });

  // ============================================================================
  // Update Tests
  // ============================================================================

  describe('Updates', () => {
    it('should update color', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      display.updateColor('#00FF00');

      // Component should re-render with new color
      expect(container.textContent).toContain('Color Perception Simulation');
    });
  });

  // ============================================================================
  // Different Input Colors Tests
  // ============================================================================

  describe('Different Input Colors', () => {
    it('should handle blue color', () => {
      display = new ColorblindnessDisplay(container, '#0000FF');
      display.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should handle green color', () => {
      display = new ColorblindnessDisplay(container, '#00FF00');
      display.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should handle white color', () => {
      display = new ColorblindnessDisplay(container, '#FFFFFF');
      display.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should use default red if no color provided', () => {
      display = new ColorblindnessDisplay(container);
      display.init();

      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      display = new ColorblindnessDisplay(container, '#FF0000');
      display.init();

      display.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
