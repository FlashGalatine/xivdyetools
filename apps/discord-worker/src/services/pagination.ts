/**
 * Pagination Service (V4)
 *
 * Provides button-based pagination for large result sets.
 * Uses component context storage for state management.
 *
 * Paginated commands:
 * - /dye list (categories, dyes within categories)
 * - /dye search (search results)
 * - /preset list (community presets)
 * - /extractor color (when count > 5)
 *
 * @module services/pagination
 */

import type { ExtendedLogger } from '@xivdyetools/logger';
import {
  storeContext,
  getContext,
  updateContext,
  buildCustomId,
  parseCustomId,
  CONTEXT_TTL,
  type ComponentContext,
} from './component-context.js';

// ============================================================================
// Constants
// ============================================================================

/** Default items per page */
export const DEFAULT_PAGE_SIZE = 10;

/** Maximum items per page */
export const MAX_PAGE_SIZE = 25;

/** Minimum items per page */
export const MIN_PAGE_SIZE = 5;

// ============================================================================
// Types
// ============================================================================

/**
 * Pagination state stored in component context
 */
export interface PaginationState {
  /** Current page (0-indexed) */
  currentPage: number;
  /** Total number of items */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Total pages */
  totalPages: number;
  /** Command-specific filter/sort options */
  filters?: Record<string, unknown>;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  /** Items for current page */
  items: T[];
  /** Pagination metadata */
  pagination: PaginationState;
  /** Context hash for buttons */
  contextHash: string;
}

/**
 * Pagination button configuration
 */
export interface PaginationButtons {
  /** Action row with navigation buttons */
  components: Array<{
    type: 2; // Button
    style: 1 | 2; // Primary or Secondary
    custom_id: string;
    label?: string;
    emoji?: { name: string };
    disabled?: boolean;
  }>;
}

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Calculate pagination metadata
 *
 * @param totalItems - Total number of items
 * @param pageSize - Items per page
 * @param currentPage - Current page (0-indexed)
 * @returns Pagination state
 */
export function calculatePagination(
  totalItems: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
  currentPage: number = 0
): PaginationState {
  const clampedPageSize = Math.max(MIN_PAGE_SIZE, Math.min(MAX_PAGE_SIZE, pageSize));
  const totalPages = Math.max(1, Math.ceil(totalItems / clampedPageSize));
  const clampedPage = Math.max(0, Math.min(currentPage, totalPages - 1));

  return {
    currentPage: clampedPage,
    totalItems,
    pageSize: clampedPageSize,
    totalPages,
  };
}

/**
 * Get items for a specific page
 *
 * @param items - All items
 * @param pagination - Pagination state
 * @returns Items for the current page
 */
export function getPageItems<T>(items: T[], pagination: PaginationState): T[] {
  const start = pagination.currentPage * pagination.pageSize;
  const end = start + pagination.pageSize;
  return items.slice(start, end);
}

/**
 * Check if pagination is needed
 *
 * @param totalItems - Total number of items
 * @param pageSize - Items per page
 * @returns Whether pagination is needed
 */
export function needsPagination(totalItems: number, pageSize: number = DEFAULT_PAGE_SIZE): boolean {
  return totalItems > pageSize;
}

// ============================================================================
// Context Management
// ============================================================================

/**
 * Create and store pagination context
 *
 * @param userId - User ID
 * @param interactionToken - Interaction token
 * @param applicationId - Application ID
 * @param command - Command name
 * @param pagination - Pagination state
 * @param filters - Optional filters
 * @param logger - Optional logger
 * @returns Context hash
 */
export async function createPaginationContext(
  userId: string,
  interactionToken: string,
  applicationId: string,
  command: string,
  pagination: PaginationState,
  filters?: Record<string, unknown>,
  logger?: ExtendedLogger
): Promise<string> {
  const context = {
    command,
    userId,
    interactionToken,
    applicationId,
    data: {
      pagination: { ...pagination, filters },
    },
  };

  return storeContext(context, CONTEXT_TTL.PAGINATION, logger);
}

/**
 * Get pagination state from context
 *
 * @param hash - Context hash
 * @param logger - Optional logger
 * @returns Pagination state or null
 */
export async function getPaginationState(
  hash: string,
  logger?: ExtendedLogger
): Promise<{ context: ComponentContext; pagination: PaginationState } | null> {
  const context = await getContext(hash, logger);

  if (!context || !context.data.pagination) {
    return null;
  }

  return {
    context,
    pagination: context.data.pagination as PaginationState,
  };
}

/**
 * Update pagination to a new page
 *
 * @param hash - Context hash
 * @param newPage - New page number
 * @param logger - Optional logger
 * @returns Updated pagination state or null
 */
export async function updatePaginationPage(
  hash: string,
  newPage: number,
  logger?: ExtendedLogger
): Promise<PaginationState | null> {
  const result = await getPaginationState(hash, logger);

  if (!result) {
    return null;
  }

  const { pagination } = result;
  const updatedPagination: PaginationState = {
    ...pagination,
    currentPage: Math.max(0, Math.min(newPage, pagination.totalPages - 1)),
  };

  const updated = await updateContext(
    hash,
    { data: { pagination: updatedPagination } },
    CONTEXT_TTL.PAGINATION,
    logger
  );

  return updated ? updatedPagination : null;
}

// ============================================================================
// Button Builders
// ============================================================================

/**
 * Build pagination navigation buttons
 *
 * Layout: [First] [Prev] [Page X/Y] [Next] [Last]
 *
 * @param hash - Context hash
 * @param pagination - Current pagination state
 * @returns Action row with buttons
 */
export function buildPaginationButtons(
  hash: string,
  pagination: PaginationState
): PaginationButtons {
  const { currentPage, totalPages } = pagination;

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= totalPages - 1;

  return {
    components: [
      // First page button
      {
        type: 2,
        style: 2, // Secondary
        custom_id: buildCustomId('page', 'nav', hash, 'first'),
        emoji: { name: '⏮️' },
        disabled: isFirstPage,
      },
      // Previous page button
      {
        type: 2,
        style: 2,
        custom_id: buildCustomId('page', 'nav', hash, 'prev'),
        emoji: { name: '◀️' },
        disabled: isFirstPage,
      },
      // Page indicator (disabled button showing current state)
      {
        type: 2,
        style: 2,
        custom_id: buildCustomId('page', 'indicator', hash),
        label: `${currentPage + 1} / ${totalPages}`,
        disabled: true,
      },
      // Next page button
      {
        type: 2,
        style: 2,
        custom_id: buildCustomId('page', 'nav', hash, 'next'),
        emoji: { name: '▶️' },
        disabled: isLastPage,
      },
      // Last page button
      {
        type: 2,
        style: 2,
        custom_id: buildCustomId('page', 'nav', hash, 'last'),
        emoji: { name: '⏭️' },
        disabled: isLastPage,
      },
    ],
  };
}

/**
 * Build compact pagination buttons (prev/next only)
 *
 * @param hash - Context hash
 * @param pagination - Current pagination state
 * @returns Action row with buttons
 */
export function buildCompactPaginationButtons(
  hash: string,
  pagination: PaginationState
): PaginationButtons {
  const { currentPage, totalPages } = pagination;

  const isFirstPage = currentPage === 0;
  const isLastPage = currentPage >= totalPages - 1;

  return {
    components: [
      // Previous button
      {
        type: 2,
        style: 2,
        custom_id: buildCustomId('page', 'nav', hash, 'prev'),
        label: 'Previous',
        emoji: { name: '◀️' },
        disabled: isFirstPage,
      },
      // Page indicator
      {
        type: 2,
        style: 1, // Primary for visibility
        custom_id: buildCustomId('page', 'indicator', hash),
        label: `Page ${currentPage + 1} of ${totalPages}`,
        disabled: true,
      },
      // Next button
      {
        type: 2,
        style: 2,
        custom_id: buildCustomId('page', 'nav', hash, 'next'),
        label: 'Next',
        emoji: { name: '▶️' },
        disabled: isLastPage,
      },
    ],
  };
}

// ============================================================================
// Navigation Handler
// ============================================================================

/**
 * Handle a pagination navigation action
 *
 * @param customId - The custom_id from the button click
 * @param logger - Optional logger
 * @returns New page number or null if invalid
 */
export async function handlePaginationNavigation(
  customId: string,
  logger?: ExtendedLogger
): Promise<{ newPage: number; pagination: PaginationState; context: ComponentContext } | null> {
  const parsed = parseCustomId(customId);

  if (!parsed || parsed.action !== 'page') {
    return null;
  }

  const { hash, value } = parsed;
  const result = await getPaginationState(hash, logger);

  if (!result) {
    return null;
  }

  const { context, pagination } = result;
  let newPage = pagination.currentPage;

  switch (value) {
    case 'first':
      newPage = 0;
      break;
    case 'prev':
      newPage = Math.max(0, pagination.currentPage - 1);
      break;
    case 'next':
      newPage = Math.min(pagination.totalPages - 1, pagination.currentPage + 1);
      break;
    case 'last':
      newPage = pagination.totalPages - 1;
      break;
    default:
      // Try to parse as page number
      const pageNum = parseInt(value ?? '', 10);
      if (!isNaN(pageNum)) {
        newPage = Math.max(0, Math.min(pageNum, pagination.totalPages - 1));
      }
  }

  // Update pagination in context
  const updatedPagination = await updatePaginationPage(hash, newPage, logger);

  if (!updatedPagination) {
    return null;
  }

  return {
    newPage,
    pagination: updatedPagination,
    context,
  };
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format pagination footer text
 *
 * @param pagination - Pagination state
 * @returns Footer text
 */
export function formatPaginationFooter(pagination: PaginationState): string {
  const { currentPage, totalPages, totalItems, pageSize } = pagination;
  const start = currentPage * pageSize + 1;
  const end = Math.min((currentPage + 1) * pageSize, totalItems);

  return `Showing ${start}-${end} of ${totalItems} results`;
}

/**
 * Format page range for display
 *
 * @param pagination - Pagination state
 * @returns Range string (e.g., "1-10")
 */
export function formatPageRange(pagination: PaginationState): string {
  const start = pagination.currentPage * pagination.pageSize + 1;
  const end = Math.min((pagination.currentPage + 1) * pagination.pageSize, pagination.totalItems);
  return `${start}-${end}`;
}
