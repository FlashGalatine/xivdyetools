/**
 * Tests for category factory functions
 */
import { describe, it, expect } from 'vitest';
import { createMockCategoryRow } from '../../src/factories/category.js';

describe('createMockCategoryRow', () => {
  it('creates a category row with defaults', () => {
    const row = createMockCategoryRow();

    // TEST-DESIGN-001: IDs are now random for parallel test safety
    expect(row.id).toMatch(/^category-[a-z0-9]{8}$/);
    expect(row.name).toBe('Test Category');
    expect(row.description).toBe('A test category description');
    expect(row.icon).toBeNull();
    expect(row.is_curated).toBe(0);
    expect(row.display_order).toBeGreaterThan(0);
  });

  it('accepts overrides', () => {
    const row = createMockCategoryRow({
      id: 'custom-id',
      name: 'Custom Name',
      is_curated: 1,
    });

    expect(row.id).toBe('custom-id');
    expect(row.name).toBe('Custom Name');
    expect(row.is_curated).toBe(1);
  });

  it('generates unique IDs', () => {
    const row1 = createMockCategoryRow();
    const row2 = createMockCategoryRow();

    expect(row1.id).not.toBe(row2.id);
  });

  it('generates unique display orders', () => {
    const row1 = createMockCategoryRow();
    const row2 = createMockCategoryRow();

    expect(row1.display_order).not.toBe(row2.display_order);
  });
});
