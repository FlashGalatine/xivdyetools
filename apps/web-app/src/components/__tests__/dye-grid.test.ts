/**
 * XIV Dye Tools - DyeGrid Unit Tests
 *
 * Tests the dye grid component for displaying and selecting dyes.
 * Covers rendering, selection, keyboard navigation, favorites, and accessibility.
 *
 * @module components/__tests__/dye-grid.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DyeGrid } from '../dye-grid';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
  getAttr,
  hasClass,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Mock dependencies
const { mockAddFavorite, mockRemoveFavorite, mockIsFavorite, mockSubscribeFavorites } = vi.hoisted(
  () => ({
    mockAddFavorite: vi.fn().mockReturnValue(true),
    mockRemoveFavorite: vi.fn(),
    mockIsFavorite: vi.fn().mockReturnValue(false),
    mockSubscribeFavorites: vi.fn().mockReturnValue(() => {}),
  })
);

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    getDyeName: (itemId: number) => `Dye-${itemId}`,
    getCategory: (category: string) => category,
    tInterpolate: (key: string, params: Record<string, string>) =>
      `${key}:${JSON.stringify(params)}`,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
  CollectionService: {
    addFavorite: mockAddFavorite,
    removeFavorite: mockRemoveFavorite,
    isFavorite: mockIsFavorite,
    subscribeFavorites: mockSubscribeFavorites,
    getMaxFavorites: vi.fn().mockReturnValue(20),
  },
  ToastService: {
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('DyeGrid', () => {
  let container: HTMLElement;
  let grid: DyeGrid | null;

  beforeEach(() => {
    container = createTestContainer();
    grid = null;
    vi.clearAllMocks();
    mockIsFavorite.mockReturnValue(false);

    // Mock scrollIntoView since jsdom doesn't implement it
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    if (grid) {
      try {
        grid.destroy();
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
    it('should render grid container with role="grid"', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      const gridEl = query(container, '[role="grid"]');
      expect(gridEl).not.toBeNull();
    });

    it('should render dye cards for each dye', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      const cards = queryAll(container, '.dye-select-btn');
      expect(cards.length).toBe(mockDyes.length);
    });

    it('should render dye color swatch with correct background', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const colorDiv = query(container, `[style*="background-color: ${mockDyes[0].hex}"]`);
      expect(colorDiv).not.toBeNull();
    });

    it('should render dye name', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const nameEl = query(container, '.text-sm.font-semibold');
      expect(nameEl).not.toBeNull();
    });

    it('should render dye hex value', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const hexEl = query(container, '.number');
      expect(hexEl?.textContent).toBe(mockDyes[0].hex);
    });
  });

  // ============================================================================
  // Options Tests
  // ============================================================================

  describe('Grid Options', () => {
    it('should hide categories when showCategories is false', () => {
      grid = new DyeGrid(container, { showCategories: false });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const categoryEls = queryAll(container, '.text-xs.text-gray-500');
      // Should not have category text
      expect(categoryEls.length).toBe(0);
    });

    it('should show categories by default', () => {
      grid = new DyeGrid(container, { showCategories: true });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const card = query(container, '.dye-select-btn');
      expect(card?.textContent).toContain(mockDyes[0].category);
    });

    it('should use compact 3-column layout when compactMode is true', () => {
      grid = new DyeGrid(container, { compactMode: true });
      grid.init();
      grid.setDyes(mockDyes);

      const gridEl = query(container, '[role="grid"]');
      expect(hasClass(gridEl, 'grid-cols-3')).toBe(true);
    });

    it('should hide favorites when showFavorites is false', () => {
      grid = new DyeGrid(container, { showFavorites: false });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const favoriteBtn = query(container, '.favorite-btn');
      expect(favoriteBtn).toBeNull();
    });
  });

  // ============================================================================
  // Empty State Tests
  // ============================================================================

  describe('Empty State', () => {
    it('should render search empty state when no results', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([], { type: 'search', query: 'purple' });

      const emptyState = query(container, '[role="grid"]');
      expect(emptyState?.innerHTML).toContain('dyeSelector.noResults');
    });

    it('should render category empty state', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([], { type: 'category' });

      const emptyState = query(container, '[role="grid"]');
      expect(emptyState?.innerHTML).toContain('dyeSelector.noDyesInCategory');
    });
  });

  // ============================================================================
  // Selection Tests
  // ============================================================================

  describe('Dye Selection', () => {
    it('should emit dye-selected event on click', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const eventSpy = vi.fn();
      container.addEventListener('dye-selected', eventSpy);

      const card = query<HTMLButtonElement>(container, '.dye-select-btn');
      click(card);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should mark selected dyes with aria-selected', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);
      grid.setSelectedDyes([mockDyes[0]]);

      const firstCard = query(container, `[data-dye-id="${mockDyes[0].id}"]`);
      expect(getAttr(firstCard, 'aria-selected')).toBe('true');
    });

    it('should style selected dyes differently', () => {
      grid = new DyeGrid(container);
      grid.init();
      // Set selected dyes BEFORE calling setDyes for visual styling
      // (setSelectedDyes only updates aria-selected, not classes)
      grid.setDyes(mockDyes);
      // Re-render with selected dyes set
      grid.setSelectedDyes([mockDyes[0]]);
      grid.setDyes(mockDyes); // Re-render to apply visual styles

      const firstCard = query(container, `[data-dye-id="${mockDyes[0].id}"]`);
      expect(hasClass(firstCard, 'ring-2')).toBe(true);
      expect(hasClass(firstCard, 'ring-blue-500')).toBe(true);
    });
  });

  // ============================================================================
  // Keyboard Navigation Tests
  // ============================================================================

  describe('Keyboard Navigation', () => {
    it('should handle ArrowRight key', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      const gridEl = query(container, '[role="grid"]');
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

      // Focus should move to first item (or next if already focused)
      const focused = document.activeElement;
      expect(focused?.classList.contains('dye-select-btn')).toBe(true);
    });

    it('should handle Enter key for selection', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      const eventSpy = vi.fn();
      container.addEventListener('dye-selected', eventSpy);

      const gridEl = query(container, '[role="grid"]');
      // First navigate with arrow to set focusedIndex (initially -1)
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      // Now Enter should work since focusedIndex is set
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

      // Should emit selection event
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle Space key for selection', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      const eventSpy = vi.fn();
      container.addEventListener('dye-selected', eventSpy);

      const gridEl = query(container, '[role="grid"]');
      // First navigate with arrow to set focusedIndex (initially -1)
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      // Now Space should work since focusedIndex is set
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle Escape key', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      const eventSpy = vi.fn();
      container.addEventListener('escape-pressed', eventSpy);

      const gridEl = query(container, '[role="grid"]');
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle Home key to go to first', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      const gridEl = query(container, '[role="grid"]');
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));

      const cards = queryAll(container, '.dye-select-btn');
      expect(document.activeElement).toBe(cards[0]);
    });

    it('should handle End key to go to last', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      const gridEl = query(container, '[role="grid"]');
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));

      const cards = queryAll(container, '.dye-select-btn');
      expect(document.activeElement).toBe(cards[cards.length - 1]);
    });
  });

  // ============================================================================
  // Favorites Tests
  // ============================================================================

  describe('Favorites', () => {
    it('should render favorite button for each dye', () => {
      grid = new DyeGrid(container, { showFavorites: true });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const favoriteBtn = query(container, '.favorite-btn');
      expect(favoriteBtn).not.toBeNull();
    });

    it('should show filled star for favorited dyes', () => {
      mockIsFavorite.mockReturnValue(true);
      mockSubscribeFavorites.mockImplementation((callback) => {
        callback([mockDyes[0].id]);
        return () => {};
      });

      grid = new DyeGrid(container, { showFavorites: true });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const favoriteBtn = query(container, '.favorite-btn');
      expect(getAttr(favoriteBtn, 'aria-pressed')).toBe('true');
    });

    it('should toggle favorite on button click', () => {
      grid = new DyeGrid(container, { showFavorites: true });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const favoriteBtn = query<HTMLButtonElement>(container, '.favorite-btn');
      click(favoriteBtn);

      expect(mockAddFavorite).toHaveBeenCalledWith(mockDyes[0].id);
    });

    it('should remove favorite when already favorited', () => {
      mockIsFavorite.mockReturnValue(true);

      grid = new DyeGrid(container, { showFavorites: true });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const favoriteBtn = query<HTMLButtonElement>(container, '.favorite-btn');
      click(favoriteBtn);

      expect(mockRemoveFavorite).toHaveBeenCalledWith(mockDyes[0].id);
    });

    it('should emit favorite-toggled event', () => {
      grid = new DyeGrid(container, { showFavorites: true });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const eventSpy = vi.fn();
      container.addEventListener('favorite-toggled', eventSpy);

      const favoriteBtn = query<HTMLButtonElement>(container, '.favorite-btn');
      click(favoriteBtn);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should handle F key to toggle favorite', () => {
      grid = new DyeGrid(container, { showFavorites: true });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const gridEl = query(container, '[role="grid"]');
      // First navigate to set focusedIndex (initially -1)
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
      // Now F key should work since focusedIndex is set
      gridEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));

      expect(mockAddFavorite).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Collection Button Tests
  // ============================================================================

  describe('Collection Button', () => {
    it('should render collection button for each dye', () => {
      grid = new DyeGrid(container, { showFavorites: true });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const collectionBtn = query(container, '.collection-btn');
      expect(collectionBtn).not.toBeNull();
    });

    it('should have aria-label for collection button', () => {
      grid = new DyeGrid(container, { showFavorites: true });
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const collectionBtn = query(container, '.collection-btn');
      expect(collectionBtn?.hasAttribute('aria-label')).toBe(true);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have aria-label on grid', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      const gridEl = query(container, '[role="grid"]');
      expect(gridEl?.hasAttribute('aria-label')).toBe(true);
    });

    it('should have aria-label on each dye button', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const card = query(container, '.dye-select-btn');
      expect(card?.hasAttribute('aria-label')).toBe(true);
    });

    it('should have aria-selected on each dye button', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const card = query(container, '.dye-select-btn');
      expect(card?.hasAttribute('aria-selected')).toBe(true);
    });

    it('should have type="button" on dye buttons', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([mockDyes[0]]);

      const card = query(container, '.dye-select-btn');
      expect(getAttr(card, 'type')).toBe('button');
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes(mockDyes);

      grid.destroy();

      expect(query(container, '[role="grid"]')).toBeNull();
    });

    it('should unsubscribe from favorites on destroy', () => {
      const unsubscribe = vi.fn();
      mockSubscribeFavorites.mockReturnValue(unsubscribe);

      grid = new DyeGrid(container, { showFavorites: true });
      grid.init();
      grid.setDyes(mockDyes);

      grid.destroy();

      expect(unsubscribe).toHaveBeenCalled();
    });

    it('should update when setDyes is called', () => {
      grid = new DyeGrid(container);
      grid.init();
      grid.setDyes([mockDyes[0]]);

      let cards = queryAll(container, '.dye-select-btn');
      expect(cards.length).toBe(1);

      grid.setDyes(mockDyes);

      cards = queryAll(container, '.dye-select-btn');
      expect(cards.length).toBe(mockDyes.length);
    });
  });
});
