/**
 * XIV Dye Tools - DyeFilters Unit Tests
 *
 * Tests the dye filters component for filtering dyes by type.
 * Covers rendering, filter state, persistence, and accessibility.
 *
 * @module components/__tests__/dye-filters.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DyeFilters, DyeFilterConfig } from '../dye-filters';
import {
  createTestContainer,
  cleanupTestContainer,
  click,
  query,
  queryAll,
  getAttr,
} from '../../__tests__/component-utils';
import { mockDyes } from '../../__tests__/mocks/services';

// Mock storage
const { mockGetItem, mockSetItem } = vi.hoisted(() => ({
  mockGetItem: vi.fn().mockReturnValue(null),
  mockSetItem: vi.fn(),
}));

vi.mock('@services/storage-service', () => ({
  appStorage: {
    getItem: mockGetItem,
    setItem: mockSetItem,
  },
}));

vi.mock('@services/index', () => ({
  LanguageService: {
    t: (key: string) => key,
    subscribe: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('@shared/constants', () => ({
  EXPENSIVE_DYE_IDS: [12345, 12346],
}));

describe('DyeFilters', () => {
  let container: HTMLElement;
  let filters: DyeFilters | null;

  beforeEach(() => {
    container = createTestContainer();
    container.id = 'test-filters';
    filters = null;
    vi.clearAllMocks();
    mockGetItem.mockReturnValue(null);
  });

  afterEach(() => {
    if (filters) {
      try {
        filters.destroy();
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
    it('should render collapsible header by default', () => {
      filters = new DyeFilters(container);
      filters.init();

      const header = query(container, 'button[aria-controls]');
      expect(header).not.toBeNull();
    });

    it('should hide header when hideHeader option is true', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const header = query(container, 'button[aria-controls]');
      expect(header).toBeNull();
    });

    it('should render all filter checkboxes', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const checkboxes = queryAll(container, 'input[type="checkbox"]');
      expect(checkboxes.length).toBe(5);
    });

    it('should render excludeMetallic checkbox', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const checkbox = query(container, '[id$="-excludeMetallic"]');
      expect(checkbox).not.toBeNull();
    });

    it('should render excludePastel checkbox', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const checkbox = query(container, '[id$="-excludePastel"]');
      expect(checkbox).not.toBeNull();
    });

    it('should render excludeExpensive checkbox', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const checkbox = query(container, '[id$="-excludeExpensive"]');
      expect(checkbox).not.toBeNull();
    });

    it('should render excludeDark checkbox', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const checkbox = query(container, '[id$="-excludeDark"]');
      expect(checkbox).not.toBeNull();
    });

    it('should render excludeCosmic checkbox', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const checkbox = query(container, '[id$="-excludeCosmic"]');
      expect(checkbox).not.toBeNull();
    });
  });

  // ============================================================================
  // Collapsible Behavior Tests
  // ============================================================================

  describe('Collapsible Behavior', () => {
    it('should start collapsed by default', () => {
      filters = new DyeFilters(container);
      filters.init();

      const header = query(container, 'button[aria-controls]');
      expect(getAttr(header, 'aria-expanded')).toBe('false');
    });

    it('should expand on header click', () => {
      filters = new DyeFilters(container);
      filters.init();

      const header = query<HTMLButtonElement>(container, 'button[aria-controls]');
      click(header);

      expect(getAttr(header, 'aria-expanded')).toBe('true');
    });

    it('should collapse on second header click', () => {
      filters = new DyeFilters(container);
      filters.init();

      const header = query<HTMLButtonElement>(container, 'button[aria-controls]');
      click(header);
      click(header);

      expect(getAttr(header, 'aria-expanded')).toBe('false');
    });

    it('should save expanded state to storage', () => {
      filters = new DyeFilters(container, { storageKeyPrefix: 'test' });
      filters.init();

      const header = query<HTMLButtonElement>(container, 'button[aria-controls]');
      click(header);

      expect(mockSetItem).toHaveBeenCalledWith('xivdyetools_test_filters_expanded', true);
    });

    it('should load expanded state from storage', () => {
      mockGetItem.mockImplementation((key) => {
        if (key === 'xivdyetools_test_filters_expanded') return true;
        return null;
      });

      filters = new DyeFilters(container, { storageKeyPrefix: 'test' });
      filters.init();

      const header = query(container, 'button[aria-controls]');
      expect(getAttr(header, 'aria-expanded')).toBe('true');
    });
  });

  // ============================================================================
  // Filter State Tests
  // ============================================================================

  describe('Filter State', () => {
    it('should return default filters on init', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const currentFilters = filters.getFilters();
      expect(currentFilters.excludeMetallic).toBe(false);
      expect(currentFilters.excludePastel).toBe(false);
      expect(currentFilters.excludeExpensive).toBe(false);
      expect(currentFilters.excludeDark).toBe(false);
      expect(currentFilters.excludeCosmic).toBe(false);
    });

    it('should load saved filters from storage', () => {
      const savedFilters: DyeFilterConfig = {
        excludeMetallic: true,
        excludePastel: false,
        excludeExpensive: true,
        excludeDark: false,
        excludeCosmic: false,
      };
      mockGetItem.mockImplementation((key) => {
        if (key === 'xivdyetools_harmony_filters') return savedFilters;
        return null;
      });

      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const currentFilters = filters.getFilters();
      expect(currentFilters.excludeMetallic).toBe(true);
      expect(currentFilters.excludeExpensive).toBe(true);
    });

    it('should update filter on checkbox change', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const metallicCheckbox = query<HTMLInputElement>(container, '[id$="-excludeMetallic"]');
      if (metallicCheckbox) {
        metallicCheckbox.checked = true;
        metallicCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const currentFilters = filters.getFilters();
      expect(currentFilters.excludeMetallic).toBe(true);
    });

    it('should save filter state to storage on change', () => {
      filters = new DyeFilters(container, { hideHeader: true, storageKeyPrefix: 'test' });
      filters.init();

      const metallicCheckbox = query<HTMLInputElement>(container, '[id$="-excludeMetallic"]');
      if (metallicCheckbox) {
        metallicCheckbox.checked = true;
        metallicCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(mockSetItem).toHaveBeenCalledWith(
        'xivdyetools_test_filters',
        expect.objectContaining({ excludeMetallic: true })
      );
    });

    it('should set filters programmatically', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      filters.setFilters({ excludeMetallic: true, excludePastel: true });

      const currentFilters = filters.getFilters();
      expect(currentFilters.excludeMetallic).toBe(true);
      expect(currentFilters.excludePastel).toBe(true);
    });
  });

  // ============================================================================
  // Callback Tests
  // ============================================================================

  describe('Filter Callbacks', () => {
    it('should call onFilterChange callback when filter changes', () => {
      const onFilterChange = vi.fn();
      filters = new DyeFilters(container, { hideHeader: true, onFilterChange });
      filters.init();

      const metallicCheckbox = query<HTMLInputElement>(container, '[id$="-excludeMetallic"]');
      if (metallicCheckbox) {
        metallicCheckbox.checked = true;
        metallicCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(onFilterChange).toHaveBeenCalled();
    });

    it('should emit dye-filters-changed event on change', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const eventSpy = vi.fn();
      container.addEventListener('dye-filters-changed', eventSpy);

      const metallicCheckbox = query<HTMLInputElement>(container, '[id$="-excludeMetallic"]');
      if (metallicCheckbox) {
        metallicCheckbox.checked = true;
        metallicCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Dye Filtering Tests
  // ============================================================================

  describe('Dye Filtering', () => {
    it('should exclude metallic dyes when excludeMetallic is true', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();
      filters.setFilters({ excludeMetallic: true });

      const metallicDye = { ...mockDyes[0], isMetallic: true };
      expect(filters.isDyeExcluded(metallicDye)).toBe(true);
    });

    it('should not exclude non-metallic dyes when excludeMetallic is true', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();
      filters.setFilters({ excludeMetallic: true });

      const normalDye = { ...mockDyes[0], isMetallic: false };
      expect(filters.isDyeExcluded(normalDye)).toBe(false);
    });

    it('should exclude pastel dyes when excludePastel is true', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();
      filters.setFilters({ excludePastel: true });

      const pastelDye = { ...mockDyes[0], isPastel: true };
      expect(filters.isDyeExcluded(pastelDye)).toBe(true);
    });

    it('should exclude dark dyes when excludeDark is true', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();
      filters.setFilters({ excludeDark: true });

      const darkDye = { ...mockDyes[0], isDark: true };
      expect(filters.isDyeExcluded(darkDye)).toBe(true);
    });

    it('should exclude cosmic dyes when excludeCosmic is true', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();
      filters.setFilters({ excludeCosmic: true });

      const cosmicDye = { ...mockDyes[0], isCosmic: true };
      expect(filters.isDyeExcluded(cosmicDye)).toBe(true);
    });

    it('should exclude expensive dyes when excludeExpensive is true', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();
      filters.setFilters({ excludeExpensive: true });

      const expensiveDye = { ...mockDyes[0], itemID: 12345 };
      expect(filters.isDyeExcluded(expensiveDye)).toBe(true);
    });

    it('should filter array of dyes correctly', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();
      filters.setFilters({ excludeMetallic: true });

      const testDyes = [
        { ...mockDyes[0], isMetallic: true },
        { ...mockDyes[1], isMetallic: false },
        { ...mockDyes[2], isMetallic: false },
      ];

      const filtered = filters.filterDyes(testDyes);
      expect(filtered.length).toBe(2);
    });
  });

  // ============================================================================
  // Accessibility Tests
  // ============================================================================

  describe('Accessibility', () => {
    it('should have aria-controls on toggle button', () => {
      filters = new DyeFilters(container);
      filters.init();

      const header = query(container, 'button[aria-controls]');
      expect(header).not.toBeNull();
      expect(header?.hasAttribute('aria-controls')).toBe(true);
    });

    it('should have role="region" on checkboxes container', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const region = query(container, '[role="region"]');
      expect(region).not.toBeNull();
    });

    it('should have labels associated with checkboxes', () => {
      filters = new DyeFilters(container, { hideHeader: true });
      filters.init();

      const checkboxes = queryAll<HTMLInputElement>(container, 'input[type="checkbox"]');
      checkboxes.forEach((checkbox) => {
        const label = query(container, `label[for="${checkbox.id}"]`);
        expect(label).not.toBeNull();
      });
    });
  });

  // ============================================================================
  // Lifecycle Tests
  // ============================================================================

  describe('Lifecycle', () => {
    it('should clean up on destroy', () => {
      filters = new DyeFilters(container);
      filters.init();

      filters.destroy();

      expect(queryAll(container, 'input[type="checkbox"]').length).toBe(0);
    });

    it('should use custom storage key prefix', () => {
      filters = new DyeFilters(container, { hideHeader: true, storageKeyPrefix: 'custom' });
      filters.init();

      const metallicCheckbox = query<HTMLInputElement>(container, '[id$="-excludeMetallic"]');
      if (metallicCheckbox) {
        metallicCheckbox.checked = true;
        metallicCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
      }

      expect(mockSetItem).toHaveBeenCalledWith('xivdyetools_custom_filters', expect.any(Object));
    });
  });
});
