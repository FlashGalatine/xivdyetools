/**
 * Category factory functions for testing
 *
 * Provides functions to create mock categories.
 *
 * @example
 * ```typescript
 * const category = createMockCategory({ name: 'Jobs' });
 * const row = createMockCategoryRow({ is_curated: 1 });
 * ```
 */

import { nextStringId, nextId } from '../utils/counters.js';

/**
 * Category database row type (as stored in D1)
 */
export interface CategoryRow {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  is_curated: number; // SQLite boolean (0 or 1)
  display_order: number;
}

/**
 * Category domain object (with boolean is_curated)
 */
export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string | null;
  is_curated: boolean;
  display_order: number;
}

/**
 * Creates a mock category row (as returned from database)
 *
 * @param overrides - Optional overrides for the default values
 * @returns A CategoryRow object
 */
export function createMockCategoryRow(overrides: Partial<CategoryRow> = {}): CategoryRow {
  const id = overrides.id ?? nextStringId('category');
  const displayOrder = overrides.display_order ?? nextId('category-order');

  return {
    id,
    name: 'Test Category',
    description: 'A test category description',
    icon: null,
    is_curated: 0,
    display_order: displayOrder,
    ...overrides,
  };
}

/**
 * Creates a mock category domain object
 *
 * @param overrides - Optional overrides for the default values
 * @returns A Category object
 */
export function createMockCategory(overrides: Partial<Category> = {}): Category {
  const id = overrides.id ?? nextStringId('category');
  const displayOrder = overrides.display_order ?? nextId('category-order');

  return {
    id,
    name: 'Test Category',
    description: 'A test category description',
    icon: null,
    is_curated: false,
    display_order: displayOrder,
    ...overrides,
  };
}

/**
 * Creates multiple mock categories
 *
 * @param count - Number of categories to create
 * @param overrides - Optional overrides to apply to all categories
 * @returns Array of Category objects
 */
export function createMockCategories(
  count: number,
  overrides: Partial<Category> = {}
): Category[] {
  return Array.from({ length: count }, (_, i) =>
    createMockCategory({
      name: `Category ${i + 1}`,
      ...overrides,
    })
  );
}

/**
 * Creates a curated category
 *
 * @param overrides - Optional overrides
 * @returns A curated Category object
 */
export function createCuratedCategory(overrides: Partial<Category> = {}): Category {
  return createMockCategory({
    is_curated: true,
    ...overrides,
  });
}

/**
 * Default preset categories for testing
 */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'jobs', name: 'Jobs', description: 'Job-inspired palettes', icon: null, is_curated: true, display_order: 1 },
  { id: 'grand-companies', name: 'Grand Companies', description: 'GC-themed palettes', icon: null, is_curated: true, display_order: 2 },
  { id: 'seasons', name: 'Seasons', description: 'Seasonal themes', icon: null, is_curated: true, display_order: 3 },
  { id: 'events', name: 'Events', description: 'Event themes', icon: null, is_curated: true, display_order: 4 },
  { id: 'aesthetics', name: 'Aesthetics', description: 'Visual styles', icon: null, is_curated: true, display_order: 5 },
  { id: 'community', name: 'Community', description: 'User submissions', icon: null, is_curated: false, display_order: 6 },
];

/**
 * Converts a Category to a CategoryRow
 *
 * @param category - The Category to convert
 * @returns A CategoryRow object
 */
export function categoryToRow(category: Category): CategoryRow {
  return {
    ...category,
    is_curated: category.is_curated ? 1 : 0,
  };
}
