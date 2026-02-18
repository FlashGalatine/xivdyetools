/**
 * XIV Dye Tools - ColorInterpolationDisplay Unit Tests
 *
 * Tests the color interpolation display component for gradient visualization.
 * Covers rendering, gradient bar, step markers, quality metrics, and interaction.
 *
 * @module components/__tests__/color-interpolation-display.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorInterpolationDisplay, InterpolationStep } from '../color-interpolation-display';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, params: Record<string, string>) =>
      `${key}: ${Object.values(params).join('/')}`,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
  },
  AnnouncerService: {
    announce: vi.fn(),
  },
}));

describe('ColorInterpolationDisplay', () => {
  let container: HTMLElement;
  let display: ColorInterpolationDisplay | null;

  const mockSteps: InterpolationStep[] = [
    { position: 0, theoreticalColor: '#FF0000', matchedDye: mockDyes[0], distance: 5.5 },
    { position: 0.33, theoreticalColor: '#AA5500', matchedDye: mockDyes[1], distance: 15.2 },
    { position: 0.66, theoreticalColor: '#55AA00', matchedDye: mockDyes[2], distance: 25.8 },
    { position: 1, theoreticalColor: '#00FF00', matchedDye: mockDyes[3], distance: 8.3 },
  ];

  beforeEach(() => {
    container = createTestContainer();
    display = null;
    vi.clearAllMocks();
    // Mock scrollIntoView since jsdom doesn't implement it
    Element.prototype.scrollIntoView = vi.fn();
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
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should render title with color space', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps, 'hsv');
      display.init();

      expect(container.textContent).toContain('mixer.colorTransition');
      expect(container.textContent).toContain('HSV');
    });

    it('should render gradient bar', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const gradientBar = query(container, '#gradient-bar');
      expect(gradientBar).not.toBeNull();
    });

    it('should render distance legend', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain('mixer.understandingDistance');
    });
  });

  // ============================================================================
  // Gradient Bar Tests
  // ============================================================================

  describe('Gradient Bar', () => {
    it('should have gradient background style', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const gradientBar = query<HTMLElement>(container, '#gradient-bar');
      expect(gradientBar?.style.background).toContain('linear-gradient');
    });

    it('should render start and end color labels', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain('mixer.start');
      expect(container.textContent).toContain('mixer.end');
    });

    it('should render start color swatch', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const swatches = queryAll(container, '.dye-swatch[style*="#FF0000"]');
      expect(swatches.length).toBeGreaterThan(0);
    });

    it('should render end color swatch', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const swatches = queryAll(container, '.dye-swatch[style*="#00FF00"]');
      expect(swatches.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Stop Markers Tests
  // ============================================================================

  describe('Stop Markers', () => {
    it('should render stop markers container', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const stopsContainer = query(container, '#stops-container');
      expect(stopsContainer).not.toBeNull();
    });

    it('should render correct number of stop markers', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const stopMarkers = queryAll(container, '[data-stop-index]');
      expect(stopMarkers.length).toBe(mockSteps.length);
    });

    it('should position markers at correct percentages', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const firstMarker = query<HTMLElement>(container, '[data-stop-index="0"]');
      expect(firstMarker?.style.left).toBe('0%');

      const lastMarker = query<HTMLElement>(container, '[data-stop-index="3"]');
      expect(lastMarker?.style.left).toBe('100%');
    });
  });

  // ============================================================================
  // Steps List Tests
  // ============================================================================

  describe('Steps List', () => {
    it('should render intermediate dyes label', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain('mixer.intermediateDyes');
    });

    it('should render step items for each step', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const stepItems = queryAll(container, '[data-step-index]');
      expect(stepItems.length).toBe(mockSteps.length);
    });

    it('should show position percentage for each step', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain('0%');
      expect(container.textContent).toContain('33%');
      expect(container.textContent).toContain('100%');
    });

    it('should show matched dye names', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain(`Dye-${mockDyes[0].itemID}`);
    });

    it('should show distance for each matched dye', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain('5.5');
      expect(container.textContent).toContain('15.2');
    });
  });

  // ============================================================================
  // Quality Metrics Tests
  // ============================================================================

  describe('Quality Metrics', () => {
    it('should render quality metrics section', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain('mixer.transitionQuality');
    });

    it('should show coverage percentage', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain('mixer.coverage');
    });

    it('should show average distance', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain('mixer.avgDistance');
    });

    it('should show max distance', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      expect(container.textContent).toContain('mixer.maxDistance');
    });
  });

  // ============================================================================
  // Distance Color Coding Tests
  // ============================================================================

  describe('Distance Color Coding', () => {
    it('should use green for excellent matches (<=30)', () => {
      const lowDistanceSteps: InterpolationStep[] = [
        { position: 0, theoreticalColor: '#FF0000', matchedDye: mockDyes[0], distance: 5 },
      ];

      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', lowDistanceSteps);
      display.init();

      expect(container.innerHTML).toContain('green');
    });

    it('should use red for poor matches (>100)', () => {
      const highDistanceSteps: InterpolationStep[] = [
        { position: 0, theoreticalColor: '#FF0000', matchedDye: mockDyes[0], distance: 150 },
      ];

      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', highDistanceSteps);
      display.init();

      expect(container.innerHTML).toContain('red');
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('Empty State', () => {
    it('should show empty state when no steps', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', []);
      display.init();

      expect(container.textContent).toContain('mixer.noInterpolationData');
    });
  });

  // ============================================================================
  // No Match Tests
  // ============================================================================

  describe('No Match', () => {
    it('should show no match message when dye is null', () => {
      const noMatchSteps: InterpolationStep[] = [
        { position: 0.5, theoreticalColor: '#808080', matchedDye: null, distance: 0 },
      ];

      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', noMatchSteps);
      display.init();

      expect(container.textContent).toContain('mixer.noCloseMatch');
    });
  });

  // ============================================================================
  // Interaction Tests
  // ============================================================================

  describe('Interaction', () => {
    it('should select stop marker on click', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const stopMarker = query<HTMLButtonElement>(container, '[data-stop-index="1"]');
      click(stopMarker);

      // Should highlight the marker (blue border)
      expect(stopMarker?.querySelector('div')?.classList.contains('border-blue-500')).toBe(true);
    });

    it('should highlight step in list when stop selected', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const stopMarker = query<HTMLButtonElement>(container, '[data-stop-index="1"]');
      click(stopMarker);

      const stepItem = query(container, '[data-step-index="1"]');
      expect(stepItem?.classList.contains('ring-2')).toBe(true);
    });

    it('should select step from list on click', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const stepItem = query<HTMLElement>(container, '[data-step-index="2"]');
      click(stepItem);

      expect(stepItem?.classList.contains('ring-2')).toBe(true);
    });
  });

  // ============================================================================
  // Update Tests
  // ============================================================================

  describe('Updates', () => {
    it('should update interpolation data', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      const newSteps: InterpolationStep[] = [
        { position: 0, theoreticalColor: '#0000FF', matchedDye: mockDyes[0], distance: 10 },
        { position: 1, theoreticalColor: '#FFFF00', matchedDye: mockDyes[1], distance: 20 },
      ];

      display.updateInterpolation('#0000FF', '#FFFF00', newSteps);

      const stepItems = queryAll(container, '[data-step-index]');
      expect(stepItems.length).toBe(2);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      display = new ColorInterpolationDisplay(container, '#FF0000', '#00FF00', mockSteps);
      display.init();

      display.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
