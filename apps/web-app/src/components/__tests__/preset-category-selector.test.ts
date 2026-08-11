import { describe, it, expect, vi } from 'vitest';
import {
  createCategorySelector,
  SELECTABLE_CATEGORIES,
  MAX_CATEGORIES,
  type CategorySelection,
} from '../preset-category-selector';

function chips(el: HTMLElement): HTMLButtonElement[] {
  return Array.from(el.querySelectorAll('button[data-category]'));
}

function chipFor(el: HTMLElement, category: string): HTMLButtonElement {
  const chip = chips(el).find((b) => b.dataset.category === category);
  if (!chip) throw new Error(`no chip for ${category}`);
  return chip;
}

describe('preset category selector', () => {
  it('offers all eight submittable categories and no "all" pseudo-category', () => {
    expect(SELECTABLE_CATEGORIES).toHaveLength(8);
    expect(SELECTABLE_CATEGORIES).toContain('appearance');
    expect(SELECTABLE_CATEGORIES).toContain('zones');
    expect(SELECTABLE_CATEGORIES).toContain('raids-trials');
    expect(SELECTABLE_CATEGORIES as readonly string[]).not.toContain('all');
  });

  it('marks the initial primary with rank 1', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: [] };
    const el = createCategorySelector(selection);
    expect(chipFor(el, 'jobs').dataset.rank).toBe('1');
  });

  it('an unselected chip becomes the next secondary, in click order', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: [] };
    const el = createCategorySelector(selection);

    chipFor(el, 'zones').click();
    chipFor(el, 'events').click();

    expect(selection.primary).toBe('jobs');
    expect(selection.secondary).toEqual(['zones', 'events']);
    expect(chipFor(el, 'zones').dataset.rank).toBe('2');
    expect(chipFor(el, 'events').dataset.rank).toBe('3');
  });

  it('caps at three and leaves the selection untouched past the cap', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: ['zones', 'events'] };
    const el = createCategorySelector(selection);

    chipFor(el, 'seasons').click();

    expect(MAX_CATEGORIES).toBe(3);
    expect(selection.secondary).toEqual(['zones', 'events']);
    expect(chipFor(el, 'seasons').dataset.rank).toBeUndefined();
  });

  it('removing the primary promotes the next in line', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: ['zones', 'events'] };
    const el = createCategorySelector(selection);

    chipFor(el, 'jobs').click();

    expect(selection.primary).toBe('zones');
    expect(selection.secondary).toEqual(['events']);
  });

  it('refuses to remove the last remaining category', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: [] };
    const el = createCategorySelector(selection);

    chipFor(el, 'jobs').click();

    expect(selection.primary).toBe('jobs');
    expect(selection.secondary).toEqual([]);
  });

  it('notifies on every change', () => {
    const selection: CategorySelection = { primary: 'jobs', secondary: [] };
    const onChange = vi.fn();
    const el = createCategorySelector(selection, onChange);

    chipFor(el, 'zones').click();

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
