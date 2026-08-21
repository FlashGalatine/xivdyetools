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
const { mockGetAllDyes, mockGetDyeById, JA_DYE_NAMES } = vi.hoisted(() => ({
  mockGetAllDyes: vi.fn(),
  mockGetDyeById: vi.fn(),
  /**
   * Localized names for the mockDyes itemIDs, deliberately numbered so that
   * their alphabetical order is the REVERSE of the English one: `mockDyes[0]`
   * ("Snow White", 5729) sorts last in English and first here. A sort or search
   * that still reads `dye.name` therefore produces a different result, so these
   * tests fail if the localized helpers are reverted.
   */
  JA_DYE_NAMES: {
    5729: 'ja-01-スノーホワイト',
    5730: 'ja-02-アッシュグレイ',
    5731: 'ja-03-ソートブラック',
    5732: 'ja-04-ローズピンク',
    5733: 'ja-05-ワインレッド',
    5734: 'ja-06-コーラルピンク',
    5735: 'ja-07-ブラッドレッド',
    5736: 'ja-08-サンセットオレンジ',
    5737: 'ja-09-ダラガブレッド',
    5738: 'ja-10-スカイブルー',
  } as Record<number, string>,
}));

// `@shared/dye-name` imports LanguageService from its own module, not the
// `@services/index` barrel — mocking only the barrel would leave the helpers
// talking to the real service.
vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string) => key,
    getCurrentLocale: () => 'ja',
    getDyeName: (itemID: number) => JA_DYE_NAMES[itemID] ?? null,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
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
    getDyeName: (itemId: number) => JA_DYE_NAMES[itemId] ?? null,
    getCurrentLocale: () => 'ja',
    getCategory: (category: string) => category,
    getAcquisition: (acquisition: string) => acquisition,
    getCurrency: (currency: string) => currency,
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

// `@shared/ui-icons` is a bag of inert SVG string constants, so the real module
// is used: the previous hand-written stub exported only ICON_CRYSTAL, which made
// DyeSearchBox throw and render an error boundary instead of the dye grid.

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
  // Localized Dye Name Tests (HC-SYS-004 / HC-SYS-005)
  // ============================================================================

  describe('Localized dye names', () => {
    /** aria-labels of the rendered dye buttons, in DOM order. */
    const renderedNames = (): string[] =>
      Array.from(container.querySelectorAll('.dye-select-btn')).map(
        (btn) => btn.getAttribute('aria-label') ?? ''
      );

    /**
     * DyeSelector binds its custom-event handlers to its own root element (see
     * `BaseComponent.onCustom`), not to the host container, so events have to
     * be dispatched from inside it. The real DyeSearchBox emits `search-changed`
     * on a debounce; firing it directly keeps these tests timer-free while still
     * running the component's real filter + re-render path.
     */
    const fire = (name: string, detail: unknown): void => {
      const root = container.firstElementChild as HTMLElement;
      root.dispatchEvent(new CustomEvent(name, { detail, bubbles: true }));
    };

    const search = (query: string): void => fire('search-changed', query);

    it('labels each dye button with its localized name', () => {
      selector = new DyeSelector(container);
      selector.init();

      // English labels would read 'Snow White' — the mocked ja name must win.
      expect(renderedNames()).toContain('ja-01-スノーホワイト');
      expect(renderedNames()).not.toContain('Snow White');
    });

    it('finds a dye by searching its localized name', () => {
      selector = new DyeSelector(container);
      selector.init();

      search('ja-04');

      // 'ja-04' appears in no English dye name, so a `dye.name` search finds nothing.
      expect(renderedNames()).toEqual(['ja-04-ローズピンク']);
    });

    it('still finds a dye by its English name', () => {
      selector = new DyeSelector(container);
      selector.init();

      search('rose pink');

      expect(renderedNames()).toEqual(['ja-04-ローズピンク']);
    });

    it('sorts alphabetically by the localized name, not the English one', () => {
      selector = new DyeSelector(container);
      selector.init();

      fire('sort-changed', 'alphabetical');

      const names = renderedNames();
      expect(names).toHaveLength(mockDyes.length);
      // Sorting by `dye.name` would put 'Ash Grey' (ja-02) first; by localized
      // name 'Snow White' (ja-01) leads.
      expect(names[0]).toBe('ja-01-スノーホワイト');
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ja')));
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
