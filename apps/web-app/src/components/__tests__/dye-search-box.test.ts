/**
 * XIV Dye Tools - DyeSearchBox Unit Tests
 *
 * Tests the dye search and filter component.
 * Covers search input, sort options, category filtering, and events.
 *
 * @module components/__tests__/dye-search-box.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock tool-panel-builders to prevent circular dependency when running with other tests
vi.mock('@services/tool-panel-builders', () => ({
  buildFiltersPanel: vi.fn(),
  buildMarketPanel: vi.fn(),
  buildPanelSection: vi.fn(),
  buildCheckboxPanelSection: vi.fn(),
  buildSelectPanelSection: vi.fn(),
  buildRadioPanelSection: vi.fn(),
}));

import { DyeSearchBox } from '../dye-search-box';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  input,
  query,
  queryAll,
  hasClass,
} from '../../__tests__/component-utils';

describe('DyeSearchBox', () => {
  let container: HTMLElement;
  let searchBox: DyeSearchBox | null;

  beforeEach(() => {
    container = createTestContainer();
    searchBox = null;
  });

  afterEach(() => {
    if (searchBox) {
      try {
        searchBox.destroy();
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
    it('should render search input', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const input = query(container, 'input[type="text"]');
      expect(input).not.toBeNull();
    });

    it('should render clear button', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const clearBtn = query(container, '#dye-selector-clear-btn');
      expect(clearBtn).not.toBeNull();
    });

    it('should render random button', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const randomBtn = query(container, '#dye-selector-random-btn');
      expect(randomBtn).not.toBeNull();
    });

    it('should render sort dropdown', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const sortSelect = query(container, 'select');
      expect(sortSelect).not.toBeNull();
    });

    it('should render category buttons when showCategories is true', () => {
      searchBox = new DyeSearchBox(container, { showCategories: true });
      searchBox.init();

      const categoryBtns = queryAll(container, '[data-category]');
      expect(categoryBtns.length).toBeGreaterThan(0);
    });

    it('should not render category buttons when showCategories is false', () => {
      searchBox = new DyeSearchBox(container, { showCategories: false });
      searchBox.init();

      const categoryBtns = queryAll(container, '[data-category]');
      expect(categoryBtns.length).toBe(0);
    });
  });

  // ============================================================================
  // Search Input Tests
  // ============================================================================

  describe('Search Input', () => {
    it('should emit search-changed on input', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const eventSpy = vi.fn();
      container.addEventListener('search-changed', eventSpy);

      const searchInput = query<HTMLInputElement>(container, 'input[type="text"]');
      input(searchInput!, 'test search');

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should update internal search query on input', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const searchInput = query<HTMLInputElement>(container, 'input[type="text"]');
      input(searchInput!, 'snow white');

      expect(searchBox.getSearchQuery()).toBe('snow white');
    });

    it('should apply initial search value', () => {
      searchBox = new DyeSearchBox(container, { initialSearch: 'preset search' });
      searchBox.init();

      expect(searchBox.getSearchQuery()).toBe('preset search');
    });

    it('should have accessible aria-label', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const searchInput = query(container, 'input[type="text"]');
      expect(searchInput?.hasAttribute('aria-label')).toBe(true);
    });
  });

  // ============================================================================
  // Clear Button Tests
  // ============================================================================

  describe('Clear Button', () => {
    it('should emit clear-all on click', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const eventSpy = vi.fn();
      container.addEventListener('clear-all', eventSpy);

      const clearBtn = query<HTMLButtonElement>(container, '#dye-selector-clear-btn');
      click(clearBtn);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should clear search input on click', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const searchInput = query<HTMLInputElement>(container, 'input[type="text"]');
      input(searchInput!, 'test search');

      const clearBtn = query<HTMLButtonElement>(container, '#dye-selector-clear-btn');
      click(clearBtn);

      expect(searchBox.getSearchQuery()).toBe('');
      expect(searchInput?.value).toBe('');
    });

    it('should have accessible aria-label', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const clearBtn = query(container, '#dye-selector-clear-btn');
      expect(clearBtn?.hasAttribute('aria-label')).toBe(true);
    });
  });

  // ============================================================================
  // Random Button Tests
  // ============================================================================

  describe('Random Button', () => {
    it('should emit random-dye-requested on click', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const eventSpy = vi.fn();
      container.addEventListener('random-dye-requested', eventSpy);

      const randomBtn = query<HTMLButtonElement>(container, '#dye-selector-random-btn');
      click(randomBtn);

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should have accessible aria-label', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const randomBtn = query(container, '#dye-selector-random-btn');
      expect(randomBtn?.hasAttribute('aria-label')).toBe(true);
    });

    it('should contain dice icon', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const randomBtn = query(container, '#dye-selector-random-btn');
      expect(randomBtn?.querySelector('svg')).not.toBeNull();
    });
  });

  // ============================================================================
  // Sort Dropdown Tests
  // ============================================================================

  describe('Sort Dropdown', () => {
    it('should render all sort options', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const sortSelect = query(container, 'select');
      const options = sortSelect?.querySelectorAll('option');

      expect(options?.length).toBe(6);
    });

    it('should emit sort-changed on selection', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const eventSpy = vi.fn();
      container.addEventListener('sort-changed', eventSpy);

      const sortSelect = query<HTMLSelectElement>(container, 'select');
      sortSelect!.value = 'brightness-asc';
      sortSelect!.dispatchEvent(new Event('change', { bubbles: true }));

      expect(eventSpy).toHaveBeenCalled();
    });

    it('should update internal sort option on selection', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const sortSelect = query<HTMLSelectElement>(container, 'select');
      sortSelect!.value = 'hue';
      sortSelect!.dispatchEvent(new Event('change', { bubbles: true }));

      expect(searchBox.getSortOption()).toBe('hue');
    });

    it('should apply initial sort option', () => {
      searchBox = new DyeSearchBox(container, { initialSort: 'category' });
      searchBox.init();

      expect(searchBox.getSortOption()).toBe('category');
    });

    it('should have accessible aria-label', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const sortSelect = query(container, 'select');
      expect(sortSelect?.hasAttribute('aria-label')).toBe(true);
    });
  });

  // ============================================================================
  // Category Filter Tests
  // ============================================================================

  describe('Category Filters', () => {
    it('should render "All Categories" button', () => {
      searchBox = new DyeSearchBox(container, { showCategories: true });
      searchBox.init();

      const allCatBtn = query(container, '[data-category="all"]');
      expect(allCatBtn).not.toBeNull();
    });

    it('should emit category-changed on category click', () => {
      searchBox = new DyeSearchBox(container, { showCategories: true });
      searchBox.init();

      const eventSpy = vi.fn();
      container.addEventListener('category-changed', eventSpy);

      const categoryBtns = queryAll<HTMLButtonElement>(container, '[data-category]');
      // Click on a specific category (not "all")
      const specificCat = Array.from(categoryBtns).find(
        (btn) => btn.getAttribute('data-category') !== 'all'
      );
      if (specificCat) {
        click(specificCat);
        expect(eventSpy).toHaveBeenCalled();
      }
    });

    it('should update internal category on click', () => {
      searchBox = new DyeSearchBox(container, { showCategories: true });
      searchBox.init();

      const categoryBtns = queryAll<HTMLButtonElement>(container, '[data-category]');
      const specificCat = Array.from(categoryBtns).find(
        (btn) => btn.getAttribute('data-category') !== 'all'
      );

      if (specificCat) {
        const catName = specificCat.getAttribute('data-category');
        click(specificCat);
        expect(searchBox.getCategory()).toBe(catName);
      }
    });

    it('should set category to null when "all" is clicked', () => {
      searchBox = new DyeSearchBox(container, { showCategories: true });
      searchBox.init();

      // First select a specific category
      const categoryBtns = queryAll<HTMLButtonElement>(container, '[data-category]');
      const specificCat = Array.from(categoryBtns).find(
        (btn) => btn.getAttribute('data-category') !== 'all'
      );
      if (specificCat) {
        click(specificCat);
      }

      // Then click "all"
      const allCatBtn = query<HTMLButtonElement>(container, '[data-category="all"]');
      click(allCatBtn);

      expect(searchBox.getCategory()).toBeNull();
    });

    it('should apply initial category', () => {
      // This test assumes "General-purpose" is a valid category
      searchBox = new DyeSearchBox(container, {
        showCategories: true,
        initialCategory: 'General-purpose',
      });
      searchBox.init();

      expect(searchBox.getCategory()).toBe('General-purpose');
    });

    it('should highlight active category button', () => {
      searchBox = new DyeSearchBox(container, { showCategories: true });
      searchBox.init();

      const categoryBtns = queryAll<HTMLButtonElement>(container, '[data-category]');
      const specificCat = Array.from(categoryBtns).find(
        (btn) => btn.getAttribute('data-category') !== 'all'
      );

      if (specificCat) {
        click(specificCat);
        expect(hasClass(specificCat, 'bg-blue-500')).toBe(true);
        expect(hasClass(specificCat, 'text-white')).toBe(true);
      }
    });
  });

  // ============================================================================
  // Options Tests
  // ============================================================================

  describe('Options', () => {
    it('should exclude Facewear by default', () => {
      searchBox = new DyeSearchBox(container, { showCategories: true });
      searchBox.init();

      const facewearBtn = query(container, '[data-category="Facewear"]');
      expect(facewearBtn).toBeNull();
    });

    it('should include Facewear when excludeFacewear is false', () => {
      searchBox = new DyeSearchBox(container, {
        showCategories: true,
        excludeFacewear: false,
      });
      searchBox.init();

      const facewearBtn = query(container, '[data-category="Facewear"]');
      expect(facewearBtn).not.toBeNull();
    });
  });

  // ============================================================================
  // Public Methods Tests
  // ============================================================================

  describe('Public Methods', () => {
    it('should clear search with clear() method', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const searchInput = query<HTMLInputElement>(container, 'input[type="text"]');
      input(searchInput!, 'test');

      searchBox.clear();

      expect(searchBox.getSearchQuery()).toBe('');
      expect(searchInput?.value).toBe('');
    });

    it('should focus search with focusSearch() method', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      const searchInput = query<HTMLInputElement>(container, 'input[type="text"]');
      searchBox.focusSearch();

      expect(document.activeElement).toBe(searchInput);
    });

    it('should return correct search query', () => {
      searchBox = new DyeSearchBox(container, { initialSearch: 'initial' });
      searchBox.init();

      expect(searchBox.getSearchQuery()).toBe('initial');
    });

    it('should return correct sort option', () => {
      searchBox = new DyeSearchBox(container, { initialSort: 'saturation' });
      searchBox.init();

      expect(searchBox.getSortOption()).toBe('saturation');
    });

    it('should return correct category', () => {
      searchBox = new DyeSearchBox(container, { initialCategory: 'General-purpose' });
      searchBox.init();

      expect(searchBox.getCategory()).toBe('General-purpose');
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      searchBox = new DyeSearchBox(container);
      searchBox.init();

      searchBox.destroy();

      expect(query(container, 'input[type="text"]')).toBeNull();
    });
  });
});
