/**
 * XIV Dye Tools - ColorDistanceMatrix Unit Tests
 *
 * Tests the color distance matrix component for displaying pairwise distances.
 * Covers rendering, matrix structure, distance values, and threshold colors.
 *
 * @module components/__tests__/color-distance-matrix.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ColorDistanceMatrix } from '../color-distance-matrix';
import {
  createTestContainer,
  cleanupTestContainer,
  query,
  queryAll,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
  },
  ColorService: {
    getColorDistance: vi.fn((hex1: string, hex2: string) => {
      // Return predictable distances for testing
      if (hex1 === hex2) return 0;
      return 50.5;
    }),
  },
}));

describe('ColorDistanceMatrix', () => {
  let container: HTMLElement;
  let matrix: ColorDistanceMatrix | null;

  beforeEach(() => {
    container = createTestContainer();
    matrix = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (matrix) {
      try {
        matrix.destroy();
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
    it('should render matrix container', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should render title', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      expect(container.textContent).toContain('comparison.matrix.title');
    });

    it('should render description', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      expect(container.textContent).toContain('comparison.matrix.description');
    });

    it('should render table element', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      const table = query(container, 'table');
      expect(table).not.toBeNull();
    });
  });

  // ============================================================================
  // Matrix Structure Tests
  // ============================================================================

  describe('Matrix Structure', () => {
    it('should render correct number of header columns', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 3));
      matrix.init();

      const headerCells = queryAll(container, 'thead th');
      // Empty cell + 3 dye headers
      expect(headerCells.length).toBe(4);
    });

    it('should render correct number of rows', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 3));
      matrix.init();

      const rows = queryAll(container, 'tbody tr');
      expect(rows.length).toBe(3);
    });

    it('should render NxN cells for N dyes', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 3));
      matrix.init();

      const cells = queryAll(container, 'tbody td');
      // 3 dyes = 3 rows * 4 cells per row (header + 3 data)
      expect(cells.length).toBe(12);
    });

    it('should render dye color swatches in headers', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      const swatches = queryAll(container, 'thead [style*="background-color"]');
      expect(swatches.length).toBe(2);
    });

    it('should render dye color swatches in row headers', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      const rowSwatches = queryAll(container, 'tbody td [style*="background-color"]');
      expect(rowSwatches.length).toBe(2);
    });
  });

  // ============================================================================
  // Distance Values Tests
  // ============================================================================

  describe('Distance Values', () => {
    it('should show 0.0 on diagonal cells', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      // Find cells that show 0.0
      const cells = queryAll(container, 'tbody td');
      const zeroCells = cells.filter((cell) => cell.textContent?.trim() === '0.0');
      // Should have 2 diagonal cells
      expect(zeroCells.length).toBe(2);
    });

    it('should show calculated distance for non-diagonal cells', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      // The mock returns 50.5 for non-equal hex values
      expect(container.textContent).toContain('50.5');
    });
  });

  // ============================================================================
  // Color Coding Tests
  // ============================================================================

  describe('Color Coding', () => {
    it('should apply background colors to distance cells', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      const cells = queryAll<HTMLTableCellElement>(container, 'tbody td');
      const coloredCells = cells.filter((cell) => cell.style.backgroundColor !== '');
      // Non-diagonal cells should have background colors
      expect(coloredCells.length).toBeGreaterThan(0);
    });

    it('should style diagonal cells differently', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      const cells = queryAll(container, 'tbody td');
      const diagonalCells = cells.filter((cell) => cell.classList.contains('bg-gray-100'));
      // Should have styled diagonal cells
      expect(diagonalCells.length).toBe(2);
    });
  });

  // ============================================================================
  // Dye Name Display Tests
  // ============================================================================

  describe('Dye Name Display', () => {
    it('should truncate long dye names', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      const nameSpans = queryAll(container, '.truncate');
      expect(nameSpans.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('Empty State', () => {
    it('should show empty state when no dyes', () => {
      matrix = new ColorDistanceMatrix(container, []);
      matrix.init();

      expect(container.textContent).toContain('comparison.matrix.selectDyes');
    });

    it('should not render table when no dyes', () => {
      matrix = new ColorDistanceMatrix(container, []);
      matrix.init();

      const table = query(container, 'table');
      expect(table).toBeNull();
    });
  });

  // ============================================================================
  // Update Tests
  // ============================================================================

  describe('Updates', () => {
    it('should update dyes', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      matrix.updateDyes(mockDyes.slice(0, 4));

      const rows = queryAll(container, 'tbody tr');
      expect(rows.length).toBe(4);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      matrix = new ColorDistanceMatrix(container, mockDyes.slice(0, 2));
      matrix.init();

      matrix.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
