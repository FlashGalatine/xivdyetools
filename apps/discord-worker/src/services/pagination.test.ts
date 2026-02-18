/**
 * Tests for Pagination Service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculatePagination,
  getPageItems,
  needsPagination,
  createPaginationContext,
  getPaginationState,
  updatePaginationPage,
  buildPaginationButtons,
  buildCompactPaginationButtons,
  handlePaginationNavigation,
  formatPaginationFooter,
  formatPageRange,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MIN_PAGE_SIZE,
} from './pagination.js';

// Mock component-context module
vi.mock('./component-context.js', async () => {
  const actual = await vi.importActual('./component-context.js');
  return {
    ...actual,
    storeContext: vi.fn(),
    getContext: vi.fn(),
    updateContext: vi.fn(),
  };
});

import { storeContext, getContext, updateContext } from './component-context.js';

describe('Pagination Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculatePagination', () => {
    it('calculates pagination for standard case', () => {
      const result = calculatePagination(45, 10, 0);

      expect(result).toEqual({
        currentPage: 0,
        totalItems: 45,
        pageSize: 10,
        totalPages: 5,
      });
    });

    it('uses default page size when not specified', () => {
      const result = calculatePagination(100);

      expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    });

    it('clamps page size to minimum', () => {
      const result = calculatePagination(100, 2); // Too small

      expect(result.pageSize).toBe(MIN_PAGE_SIZE);
    });

    it('clamps page size to maximum', () => {
      const result = calculatePagination(100, 50); // Too large

      expect(result.pageSize).toBe(MAX_PAGE_SIZE);
    });

    it('clamps current page to valid range', () => {
      const result = calculatePagination(30, 10, 5); // Page 5 doesn't exist

      expect(result.currentPage).toBe(2); // Last page (0-indexed)
    });

    it('handles negative current page', () => {
      const result = calculatePagination(30, 10, -1);

      expect(result.currentPage).toBe(0);
    });

    it('returns at least 1 total page', () => {
      const result = calculatePagination(0, 10, 0);

      expect(result.totalPages).toBe(1);
    });
  });

  describe('getPageItems', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];

    it('returns correct items for first page', () => {
      const pagination = calculatePagination(12, 5, 0);
      const result = getPageItems(items, pagination);

      expect(result).toEqual(['a', 'b', 'c', 'd', 'e']);
    });

    it('returns correct items for middle page', () => {
      const pagination = calculatePagination(12, 5, 1);
      const result = getPageItems(items, pagination);

      expect(result).toEqual(['f', 'g', 'h', 'i', 'j']);
    });

    it('returns correct items for last page (partial)', () => {
      const pagination = calculatePagination(12, 5, 2);
      const result = getPageItems(items, pagination);

      expect(result).toEqual(['k', 'l']);
    });
  });

  describe('needsPagination', () => {
    it('returns false when items fit on one page', () => {
      expect(needsPagination(5, 10)).toBe(false);
      expect(needsPagination(10, 10)).toBe(false);
    });

    it('returns true when items exceed page size', () => {
      expect(needsPagination(11, 10)).toBe(true);
      expect(needsPagination(100, 10)).toBe(true);
    });
  });

  describe('createPaginationContext', () => {
    it('stores context with pagination data', async () => {
      const pagination = calculatePagination(100, 10, 0);

      vi.mocked(storeContext).mockResolvedValue('testhash');

      const hash = await createPaginationContext(
        'user123',
        'token',
        'app',
        'dye_list',
        pagination,
        { category: 'Reds' }
      );

      expect(hash).toBe('testhash');
      expect(storeContext).toHaveBeenCalledWith(
        expect.objectContaining({
          command: 'dye_list',
          userId: 'user123',
          data: {
            pagination: expect.objectContaining({
              currentPage: 0,
              totalItems: 100,
              filters: { category: 'Reds' },
            }),
          },
        }),
        expect.any(Number),
        undefined
      );
    });
  });

  describe('getPaginationState', () => {
    it('returns pagination state from context', async () => {
      const pagination = calculatePagination(50, 10, 2);

      vi.mocked(getContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination },
        expiresAt: Date.now() + 1000000,
      });

      const result = await getPaginationState('hash');

      expect(result).toBeDefined();
      expect(result?.pagination.currentPage).toBe(2);
      expect(result?.pagination.totalItems).toBe(50);
    });

    it('returns null when context not found', async () => {
      vi.mocked(getContext).mockResolvedValue(null);

      const result = await getPaginationState('invalid');

      expect(result).toBeNull();
    });
  });

  describe('updatePaginationPage', () => {
    it('updates page and returns new state', async () => {
      const pagination = calculatePagination(50, 10, 0);

      vi.mocked(getContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination },
        expiresAt: Date.now() + 1000000,
      });

      vi.mocked(updateContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination: { ...pagination, currentPage: 3 } },
        expiresAt: Date.now() + 1000000,
      });

      const result = await updatePaginationPage('hash', 3);

      expect(result?.currentPage).toBe(3);
    });

    it('clamps page to valid range', async () => {
      const pagination = calculatePagination(30, 10, 0);

      vi.mocked(getContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination },
        expiresAt: Date.now() + 1000000,
      });

      vi.mocked(updateContext).mockImplementation(async (hash, updates) => {
        return {
          command: 'test',
          userId: 'user',
          interactionToken: 'token',
          applicationId: 'app',
          data: updates.data!,
          expiresAt: Date.now() + 1000000,
        };
      });

      const result = await updatePaginationPage('hash', 10); // Page 10 doesn't exist

      expect(result?.currentPage).toBe(2); // Last page
    });
  });

  describe('buildPaginationButtons', () => {
    it('builds full navigation buttons', () => {
      const pagination = calculatePagination(50, 10, 2);
      const buttons = buildPaginationButtons('hash123', pagination);

      expect(buttons.components).toHaveLength(5);

      // All buttons should be enabled in the middle
      expect(buttons.components[0].disabled).toBe(false); // First
      expect(buttons.components[1].disabled).toBe(false); // Prev
      expect(buttons.components[2].disabled).toBe(true);  // Indicator (always disabled)
      expect(buttons.components[3].disabled).toBe(false); // Next
      expect(buttons.components[4].disabled).toBe(false); // Last
    });

    it('disables first/prev on first page', () => {
      const pagination = calculatePagination(50, 10, 0);
      const buttons = buildPaginationButtons('hash', pagination);

      expect(buttons.components[0].disabled).toBe(true);  // First
      expect(buttons.components[1].disabled).toBe(true);  // Prev
      expect(buttons.components[3].disabled).toBe(false); // Next
      expect(buttons.components[4].disabled).toBe(false); // Last
    });

    it('disables next/last on last page', () => {
      const pagination = calculatePagination(50, 10, 4);
      const buttons = buildPaginationButtons('hash', pagination);

      expect(buttons.components[0].disabled).toBe(false); // First
      expect(buttons.components[1].disabled).toBe(false); // Prev
      expect(buttons.components[3].disabled).toBe(true);  // Next
      expect(buttons.components[4].disabled).toBe(true);  // Last
    });

    it('shows correct page indicator', () => {
      const pagination = calculatePagination(50, 10, 2);
      const buttons = buildPaginationButtons('hash', pagination);

      expect(buttons.components[2].label).toBe('3 / 5'); // Page 3 of 5
    });
  });

  describe('buildCompactPaginationButtons', () => {
    it('builds 3 buttons', () => {
      const pagination = calculatePagination(30, 10, 1);
      const buttons = buildCompactPaginationButtons('hash', pagination);

      expect(buttons.components).toHaveLength(3);
      expect(buttons.components[0].label).toBe('Previous');
      expect(buttons.components[1].label).toBe('Page 2 of 3');
      expect(buttons.components[2].label).toBe('Next');
    });
  });

  describe('handlePaginationNavigation', () => {
    it('handles "first" navigation', async () => {
      const pagination = calculatePagination(50, 10, 3);

      vi.mocked(getContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination },
        expiresAt: Date.now() + 1000000,
      });

      vi.mocked(updateContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination: { ...pagination, currentPage: 0 } },
        expiresAt: Date.now() + 1000000,
      });

      const result = await handlePaginationNavigation('page_nav_hash_first');

      expect(result?.newPage).toBe(0);
    });

    it('handles "prev" navigation', async () => {
      const pagination = calculatePagination(50, 10, 3);

      vi.mocked(getContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination },
        expiresAt: Date.now() + 1000000,
      });

      vi.mocked(updateContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination: { ...pagination, currentPage: 2 } },
        expiresAt: Date.now() + 1000000,
      });

      const result = await handlePaginationNavigation('page_nav_hash_prev');

      expect(result?.newPage).toBe(2);
    });

    it('handles "next" navigation', async () => {
      const pagination = calculatePagination(50, 10, 2);

      vi.mocked(getContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination },
        expiresAt: Date.now() + 1000000,
      });

      vi.mocked(updateContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination: { ...pagination, currentPage: 3 } },
        expiresAt: Date.now() + 1000000,
      });

      const result = await handlePaginationNavigation('page_nav_hash_next');

      expect(result?.newPage).toBe(3);
    });

    it('handles "last" navigation', async () => {
      const pagination = calculatePagination(50, 10, 0);

      vi.mocked(getContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination },
        expiresAt: Date.now() + 1000000,
      });

      vi.mocked(updateContext).mockResolvedValue({
        command: 'test',
        userId: 'user',
        interactionToken: 'token',
        applicationId: 'app',
        data: { pagination: { ...pagination, currentPage: 4 } },
        expiresAt: Date.now() + 1000000,
      });

      const result = await handlePaginationNavigation('page_nav_hash_last');

      expect(result?.newPage).toBe(4);
    });

    it('returns null for invalid custom_id', async () => {
      const result = await handlePaginationNavigation('invalid_custom_id');

      expect(result).toBeNull();
    });

    it('returns null for non-page action', async () => {
      const result = await handlePaginationNavigation('algo_mixer_hash_value');

      expect(result).toBeNull();
    });
  });

  describe('formatPaginationFooter', () => {
    it('formats footer for first page', () => {
      const pagination = calculatePagination(45, 10, 0);
      const footer = formatPaginationFooter(pagination);

      expect(footer).toBe('Showing 1-10 of 45 results');
    });

    it('formats footer for middle page', () => {
      const pagination = calculatePagination(45, 10, 2);
      const footer = formatPaginationFooter(pagination);

      expect(footer).toBe('Showing 21-30 of 45 results');
    });

    it('formats footer for last page (partial)', () => {
      const pagination = calculatePagination(45, 10, 4);
      const footer = formatPaginationFooter(pagination);

      expect(footer).toBe('Showing 41-45 of 45 results');
    });
  });

  describe('formatPageRange', () => {
    it('formats range correctly', () => {
      const pagination = calculatePagination(45, 10, 1);
      const range = formatPageRange(pagination);

      expect(range).toBe('11-20');
    });
  });
});
