/**
 * Category factory functions for testing
 *
 * Provides functions to create mock category rows.
 *
 * @example
 * ```typescript
 * const row = createMockCategoryRow({ is_curated: 1 });
 * ```
 */

import { randomStringId, randomId } from '../utils/counters.js';

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
 * Creates a mock category row (as returned from database)
 *
 * @param overrides - Optional overrides for the default values
 * @returns A CategoryRow object
 */
export function createMockCategoryRow(overrides: Partial<CategoryRow> = {}): CategoryRow {
  const id = overrides.id ?? randomStringId('category');
  const displayOrder = overrides.display_order ?? randomId();

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
