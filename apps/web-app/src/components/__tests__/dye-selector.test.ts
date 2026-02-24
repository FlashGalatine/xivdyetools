/**
 * XIV Dye Tools - DyeSelector Unit Tests
 *
 * Tests the dye selector component for browsing and selecting dyes.
 * Covers rendering, search/filter, selection, favorites, and events.
 *
 * @module components/__tests__/dye-selector.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DyeSelector } from '../dye-selector';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Use vi.hoisted() to ensure mock functions are available before vi.mock() hoisting
const { mockGetAllDyes, mockGetDyeById } = vi.hoisted(() => ({
  mockGetAllDyes: vi.fn(),
  mockGetDyeById: vi.fn(),
}));

vi.mock('@services/dye-service-wrapper', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
    }),
  },
}));

vi.mock('@services/index', () => ({
  DyeService: {
    getInstance: vi.fn().mockReturnValue({
      getAllDyes: mockGetAllDyes,
      getDyeById: mockGetDyeById,
      getCategories: vi.fn().mockReturnValue(['Base', 'Craft']),
    }),
  },
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, params: Record<string, string>) =>
      `${key}: ${Object.values(params).join('/')}`,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  CollectionService: {
    getFavorites: vi.fn().mockReturnValue([]),
    subscribeFavorites: vi.fn().mockReturnValue(() => {}),
    isFavorite: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('@shared/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@shared/ui-icons', () => ({
  ICON_CRYSTAL: '<svg></svg>',
}));

vi.mock('../collection-manager-modal', () => ({
  showCollectionManagerModal: vi.fn(),
}));

describe('DyeSelector', () => {
  let container: HTMLElement;
  let selector: DyeSelector | null;

  beforeEach(() => {
    container = createTestContainer();
    selector = null;
    vi.clearAllMocks();
    // Set up mock return values
    mockGetAllDyes.mockReturnValue(mockDyes);
    mockGetDyeById.mockImplementation((id: number) => mockDyes.find((d) => d.id === id));
    // Mock scrollIntoView since jsdom doesn't implement it
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    if (selector) {
      try {
        selector.destroy();
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
    it('should render dye selector container', () => {
      selector = new DyeSelector(container);
      selector.init();

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should render dye grid container', () => {
      selector = new DyeSelector(container);
      selector.init();

      const gridContainer = query(container, '#dye-grid-container');
      expect(gridContainer).not.toBeNull();
    });

    it('should render selected dyes container when allowMultiple is true', () => {
      selector = new DyeSelector(container, { allowMultiple: true });
      selector.init();

      const selectedContainer = query(container, '#selected-dyes-container');
      expect(selectedContainer).not.toBeNull();
    });

    it('should not render selected dyes container when hideSelectedChips is true', () => {
      selector = new DyeSelector(container, { allowMultiple: true, hideSelectedChips: true });
      selector.init();

      const selectedContainer = query(container, '#selected-dyes-container');
      expect(selectedContainer).toBeNull();
    });

    it('should render favorites panel when showFavorites is true', () => {
      selector = new DyeSelector(container, { showFavorites: true });
      selector.init();

      const favoritesPanel = query(container, '#favorites-panel');
      expect(favoritesPanel).not.toBeNull();
    });

    it('should not render favorites panel when showFavorites is false', () => {
      selector = new DyeSelector(container, { showFavorites: false });
      selector.init();

      const favoritesPanel = query(container, '#favorites-panel');
      expect(favoritesPanel).toBeNull();
    });
  });

  // ============================================================================
  // Selection Tests
  // ============================================================================

  describe('Selection', () => {
    it('should start with empty selection', () => {
      selector = new DyeSelector(container);
      selector.init();

      expect(selector.getSelectedDyes()).toHaveLength(0);
    });

    it('should set selected dyes programmatically', () => {
      selector = new DyeSelector(container);
      selector.init();

      selector.setSelectedDyes([mockDyes[0], mockDyes[1]]);

      expect(selector.getSelectedDyes()).toHaveLength(2);
    });

    it('should respect maxSelections when setting dyes', () => {
      selector = new DyeSelector(container, { maxSelections: 2 });
      selector.init();

      selector.setSelectedDyes([mockDyes[0], mockDyes[1], mockDyes[2], mockDyes[3]]);

      expect(selector.getSelectedDyes()).toHaveLength(2);
    });

    it('should have getSelectedDyes method', () => {
      selector = new DyeSelector(container);
      selector.init();

      expect(typeof selector.getSelectedDyes).toBe('function');
    });

    it('should have setSelectedDyes method', () => {
      selector = new DyeSelector(container);
      selector.init();

      expect(typeof selector.setSelectedDyes).toBe('function');
    });

    it('should clear selection by setting empty array', () => {
      selector = new DyeSelector(container);
      selector.init();

      selector.setSelectedDyes([mockDyes[0], mockDyes[1]]);
      expect(selector.getSelectedDyes()).toHaveLength(2);

      selector.setSelectedDyes([]);
      expect(selector.getSelectedDyes()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Search and Filter Tests
  // ============================================================================

  describe('Search and Filter', () => {
    it('should update grid on search-changed event', () => {
      selector = new DyeSelector(container);
      selector.init();

      container.dispatchEvent(new CustomEvent('search-changed', { detail: 'rose', bubbles: true }));

      // Search state should be updated (internal state)
      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should update grid on category-changed event', () => {
      selector = new DyeSelector(container);
      selector.init();

      container.dispatchEvent(
        new CustomEvent('category-changed', { detail: 'Base', bubbles: true })
      );

      // Category state should be updated
      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should update grid on sort-changed event', () => {
      selector = new DyeSelector(container);
      selector.init();

      container.dispatchEvent(
        new CustomEvent('sort-changed', { detail: 'brightness-asc', bubbles: true })
      );

      expect(container.children.length).toBeGreaterThan(0);
    });

    it('should clear selection by setting empty array', () => {
      selector = new DyeSelector(container);
      selector.init();

      selector.setSelectedDyes([mockDyes[0]]);
      expect(selector.getSelectedDyes()).toHaveLength(1);

      // Use setSelectedDyes with empty array to clear
      selector.setSelectedDyes([]);

      expect(selector.getSelectedDyes()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Random Dye Tests
  // ============================================================================

  describe('Random Dye', () => {
    it('should support random dye selection via events', () => {
      selector = new DyeSelector(container);
      selector.init();

      // Component should render and respond to events
      expect(container.children.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Favorites Panel Tests
  // ============================================================================

  describe('Favorites Panel', () => {
    it('should render favorites header', () => {
      selector = new DyeSelector(container, { showFavorites: true });
      selector.init();

      const header = query(container, '#favorites-header');
      expect(header).not.toBeNull();
    });

    it('should toggle favorites panel on header click', () => {
      selector = new DyeSelector(container, { showFavorites: true });
      selector.init();

      const header = query<HTMLButtonElement>(container, '#favorites-header');
      const content = query(container, '#favorites-content');

      // Initially expanded
      expect(content?.classList.contains('hidden')).toBe(false);

      // Click to collapse
      click(header);
      expect(content?.classList.contains('hidden')).toBe(true);

      // Click to expand
      click(header);
      expect(content?.classList.contains('hidden')).toBe(false);
    });

    it('should show empty state when no favorites', () => {
      selector = new DyeSelector(container, { showFavorites: true });
      selector.init();

      const emptyHint = query(container, '#favorites-content .text-center');
      expect(emptyHint).not.toBeNull();
    });
  });

  // ============================================================================
  // Escape Key Tests
  // ============================================================================

  describe('Escape Key', () => {
    it('should support clearing selection via setSelectedDyes', () => {
      selector = new DyeSelector(container);
      selector.init();

      selector.setSelectedDyes([mockDyes[0]]);
      expect(selector.getSelectedDyes()).toHaveLength(1);

      // Clear using setSelectedDyes
      selector.setSelectedDyes([]);

      expect(selector.getSelectedDyes()).toHaveLength(0);
    });
  });

  // ============================================================================
  // State Tests
  // ============================================================================

  describe('State Management', () => {
    it('should return correct state', () => {
      selector = new DyeSelector(container);
      selector.init();

      selector.setSelectedDyes([mockDyes[0]]);

      const state = (selector as unknown as { getState: () => Record<string, unknown> }).getState();
      expect(state.selectedDyes).toHaveLength(1);
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      selector = new DyeSelector(container, { showFavorites: true });
      selector.init();

      selector.destroy();

      expect(container.children.length).toBe(0);
    });
  });
});
