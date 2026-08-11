/**
 * XIV Dye Tools - Preset Category Selector
 *
 * One control, used by both the submission and the edit form. A preset carries
 * a primary category and up to two secondary ones, and rank is carried by
 * SELECTION ORDER: the first chip you pick is the primary, the next two are
 * secondary in the order you picked them.
 *
 * That is deliberately affordance-free — no star toggle, no drag handle. To
 * change the primary you deselect and re-pick, and removing the primary
 * promotes the next in line rather than leaving the preset category-less.
 *
 * @module components/preset-category-selector
 */

import { LanguageService, ToastService } from '@services/index';
import { getCategoryIcon } from '@shared/category-icons';
import { presetCategoryLabel } from '@shared/preset-i18n';
import type { PresetCategory } from '@xivdyetools/types';

/** A preset's categories: one primary, up to MAX_CATEGORIES - 1 secondary. */
export interface CategorySelection {
  primary: PresetCategory;
  secondary: PresetCategory[];
}

/**
 * Submittable categories in display order. The `all` pseudo-category of the
 * gallery rail is a filter, never a value a preset can carry, so it is absent.
 */
export const SELECTABLE_CATEGORIES: readonly PresetCategory[] = [
  'jobs',
  'grand-companies',
  'seasons',
  'events',
  'aesthetics',
  'appearance',
  'zones',
  'raids-trials',
];

/** One primary + two secondary. */
export const MAX_CATEGORIES = 3;

const CHIP_BASE =
  'px-3 py-2 rounded-lg border text-sm transition-all flex items-center justify-center gap-1 relative';

export function createCategorySelector(
  selection: CategorySelection,
  onChange?: () => void
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-3 gap-2';

  const hint = document.createElement('div');
  hint.className = 'text-xs mt-1';
  hint.style.color = 'var(--theme-text-muted)';
  hint.textContent = LanguageService.t('preset.categoryHint');

  // Rank is the single source of truth while the control is open; index 0 is
  // the primary. `selection` is written back on every change so the caller can
  // simply read it at submit time.
  let ordered: PresetCategory[] = [selection.primary, ...selection.secondary];

  function commit(): void {
    const [primary, ...secondary] = ordered;
    // ordered can never be empty — toggle() refuses to remove the last entry.
    selection.primary = primary as PresetCategory;
    selection.secondary = secondary;
    render();
    onChange?.();
  }

  function toggle(category: PresetCategory): void {
    const index = ordered.indexOf(category);

    if (index === -1) {
      if (ordered.length >= MAX_CATEGORIES) {
        ToastService.warning(LanguageService.t('preset.categoryMaxReached'));
        return;
      }
      ordered = [...ordered, category];
      commit();
      return;
    }

    if (ordered.length === 1) {
      // A preset must always carry a category; removing the only one would
      // leave it unfiled with no way back except re-picking.
      ToastService.warning(LanguageService.t('preset.categoryNeedsOne'));
      return;
    }

    // Removing the primary promotes whatever was next — the list stays ranked.
    ordered = ordered.filter((c) => c !== category);
    commit();
  }

  function render(): void {
    grid.replaceChildren();

    for (const category of SELECTABLE_CATEGORIES) {
      const rank = ordered.indexOf(category);
      const isPrimary = rank === 0;
      const isSelected = rank !== -1;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = CHIP_BASE;
      btn.dataset.category = category;
      if (isSelected) btn.dataset.rank = String(rank + 1);

      if (isPrimary) {
        btn.style.cssText =
          'background-color: var(--theme-primary); color: white; border-color: var(--theme-primary);';
        btn.title = LanguageService.t('preset.categoryPrimaryBadge');
      } else if (isSelected) {
        btn.style.cssText =
          'background-color: color-mix(in srgb, var(--theme-primary) 14%, transparent); color: var(--theme-primary); border-color: color-mix(in srgb, var(--theme-primary) 45%, transparent);';
      } else {
        btn.style.cssText =
          'background-color: var(--theme-card-background); color: var(--theme-text); border-color: var(--theme-border);';
      }

      const icon = document.createElement('span');
      icon.className = 'w-4 h-4 inline-block';
      // Static, code-defined SVG — see the security note in category-icons.ts.
      icon.innerHTML = getCategoryIcon(category);

      const label = document.createElement('span');
      label.textContent = presetCategoryLabel(category);

      btn.appendChild(icon);
      btn.appendChild(label);

      if (isSelected) {
        const badge = document.createElement('span');
        badge.style.cssText =
          "font-family: 'Fragment Mono', monospace; font-size: 9px; opacity: 0.85; margin-left: 2px;";
        badge.textContent = String(rank + 1);
        btn.appendChild(badge);
      }

      btn.addEventListener('click', () => toggle(category));
      grid.appendChild(btn);
    }
  }

  render();

  wrapper.appendChild(grid);
  wrapper.appendChild(hint);
  return wrapper;
}
