/**
 * Tests for category factory functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetCounters } from '../../src/utils/counters.js';
import {
  createMockCategoryRow,
  createMockCategory,
  createMockCategories,
  createCuratedCategory,
  DEFAULT_CATEGORIES,
  categoryToRow,
} from '../../src/factories/category.js';

beforeEach(() => {
  resetCounters();
});

describe('createMockCategoryRow', () => {
  it('creates a category row with defaults', () => {
    const row = createMockCategoryRow();

    // TEST-DESIGN-001: IDs are now random for parallel test safety
    expect(row.id).toMatch(/^category-[a-z0-9]{8}$/);
    expect(row.name).toBe('Test Category');
    expect(row.description).toBe('A test category description');
    expect(row.icon).toBeNull();
    expect(row.is_curated).toBe(0);
    expect(row.display_order).toBe(1);
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

describe('createMockCategory', () => {
  it('creates a category with defaults', () => {
    const category = createMockCategory();

    // TEST-DESIGN-001: IDs are now random for parallel test safety
    expect(category.id).toMatch(/^category-[a-z0-9]{8}$/);
    expect(category.name).toBe('Test Category');
    expect(category.description).toBe('A test category description');
    expect(category.icon).toBeNull();
    expect(category.is_curated).toBe(false);
    expect(category.display_order).toBe(1);
  });

  it('accepts overrides', () => {
    const category = createMockCategory({
      name: 'Jobs',
      is_curated: true,
      icon: '⚔️',
    });

    expect(category.name).toBe('Jobs');
    expect(category.is_curated).toBe(true);
    expect(category.icon).toBe('⚔️');
  });

  it('generates unique IDs', () => {
    const cat1 = createMockCategory();
    const cat2 = createMockCategory();

    expect(cat1.id).not.toBe(cat2.id);
  });
});

describe('createMockCategories', () => {
  it('creates specified number of categories', () => {
    const categories = createMockCategories(5);

    expect(categories).toHaveLength(5);
  });

  it('generates unique names with index', () => {
    const categories = createMockCategories(3);

    expect(categories[0].name).toBe('Category 1');
    expect(categories[1].name).toBe('Category 2');
    expect(categories[2].name).toBe('Category 3');
  });

  it('applies overrides to all categories', () => {
    const categories = createMockCategories(3, { is_curated: true });

    expect(categories.every((c) => c.is_curated === true)).toBe(true);
  });

  it('generates unique IDs', () => {
    const categories = createMockCategories(3);
    const ids = categories.map((c) => c.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(3);
  });
});

describe('createCuratedCategory', () => {
  it('creates a curated category', () => {
    const category = createCuratedCategory();

    expect(category.is_curated).toBe(true);
  });

  it('accepts overrides', () => {
    const category = createCuratedCategory({ name: 'Official Themes' });

    expect(category.name).toBe('Official Themes');
    expect(category.is_curated).toBe(true);
  });

  it('override can set is_curated to false', () => {
    const category = createCuratedCategory({ is_curated: false });

    expect(category.is_curated).toBe(false);
  });
});

describe('DEFAULT_CATEGORIES', () => {
  it('is an array of categories', () => {
    expect(Array.isArray(DEFAULT_CATEGORIES)).toBe(true);
    expect(DEFAULT_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('has required properties on each category', () => {
    for (const cat of DEFAULT_CATEGORIES) {
      expect(cat.id).toBeDefined();
      expect(cat.name).toBeDefined();
      expect(cat.description).toBeDefined();
      expect(typeof cat.is_curated).toBe('boolean');
      expect(typeof cat.display_order).toBe('number');
    }
  });

  it('contains expected categories', () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name);

    expect(names).toContain('Jobs');
    expect(names).toContain('Grand Companies');
    expect(names).toContain('Seasons');
  });

  it('has some curated and some non-curated', () => {
    const curatedCount = DEFAULT_CATEGORIES.filter((c) => c.is_curated).length;
    const nonCuratedCount = DEFAULT_CATEGORIES.filter((c) => !c.is_curated).length;

    expect(curatedCount).toBeGreaterThan(0);
    expect(nonCuratedCount).toBeGreaterThan(0);
  });
});

describe('categoryToRow', () => {
  it('converts is_curated boolean to number', () => {
    const category = createMockCategory({ is_curated: true });

    const row = categoryToRow(category);

    expect(row.is_curated).toBe(1);
  });

  it('preserves other properties', () => {
    const category = createMockCategory({
      id: 'test-id',
      name: 'Test Name',
      description: 'Test Description',
      icon: '🎨',
      display_order: 5,
    });

    const row = categoryToRow(category);

    expect(row.id).toBe('test-id');
    expect(row.name).toBe('Test Name');
    expect(row.description).toBe('Test Description');
    expect(row.icon).toBe('🎨');
    expect(row.display_order).toBe(5);
  });

  it('converts false to 0', () => {
    const category = createMockCategory({ is_curated: false });

    const row = categoryToRow(category);

    expect(row.is_curated).toBe(0);
  });
});
