import { BaseComponent } from './base-component';
import { LanguageService, DyeService } from '@services/index';
import { ICON_DICE, ICON_BROOM } from '@shared/ui-icons';

export type SortOption =
  | 'alphabetical'
  | 'brightness-asc'
  | 'brightness-desc'
  | 'hue'
  | 'saturation'
  | 'category';

export interface DyeSearchBoxOptions {
  showCategories?: boolean;
  excludeFacewear?: boolean;
  initialSort?: SortOption;
  initialCategory?: string | null;
  initialSearch?: string;
}

export class DyeSearchBox extends BaseComponent {
  private searchQuery: string = '';
  private sortOption: SortOption = 'alphabetical';
  private currentCategory: string | null = null;
  private options: DyeSearchBoxOptions;

  constructor(container: HTMLElement, options: DyeSearchBoxOptions = {}) {
    super(container);
    this.options = {
      showCategories: options.showCategories ?? true,
      excludeFacewear: options.excludeFacewear ?? true,
      initialSort: options.initialSort ?? 'alphabetical',
      initialCategory: options.initialCategory ?? null,
      initialSearch: options.initialSearch ?? '',
    };
    this.sortOption = this.options.initialSort!;
    this.currentCategory = this.options.initialCategory!;
    this.searchQuery = this.options.initialSearch!;
  }

  renderContent(): void {
    const wrapper = this.createElement('div', { className: 'space-y-4' });

    // Search Input Section
    const searchContainer = this.createElement('div', {
      className: 'flex flex-col sm:flex-row gap-2',
    });

    const searchInput = this.createElement('input', {
      attributes: {
        type: 'text',
        placeholder: LanguageService.t('dyeSelector.searchPlaceholder'),
        'aria-label': LanguageService.t('dyeSelector.searchAriaLabel'),
        value: this.searchQuery,
      },
      className:
        'flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500',
    });

    const clearBtn = this.createElement('button', {
      className: 'p-2 rounded-lg transition-all duration-200 flex items-center justify-center',
      attributes: {
        id: 'dye-selector-clear-btn',
        type: 'button',
        'aria-label': LanguageService.t('dyeSelector.clearAriaLabel'),
        title: LanguageService.t('common.clear'),
        style: 'background-color: var(--theme-background-secondary); color: var(--theme-text);',
      },
    });

    // Add broom icon
    const broomIcon = this.createElement('span', {
      className: 'w-5 h-5 inline-block',
    });
    broomIcon.innerHTML = ICON_BROOM;
    clearBtn.appendChild(broomIcon);

    // Hover effects for clear button
    clearBtn.addEventListener('mouseenter', () => (clearBtn.style.filter = 'brightness(0.9)'));
    clearBtn.addEventListener('mouseleave', () => (clearBtn.style.filter = ''));
    clearBtn.addEventListener('mousedown', () => (clearBtn.style.filter = 'brightness(0.8)'));
    clearBtn.addEventListener('mouseup', () => (clearBtn.style.filter = 'brightness(0.9)'));

    // Random Dye Button (icon only to prevent overflow)
    const randomBtn = this.createElement('button', {
      className: 'p-2 rounded-lg transition-all duration-200 flex items-center justify-center',
      attributes: {
        id: 'dye-selector-random-btn',
        type: 'button',
        'aria-label': LanguageService.t('dyeSelector.randomDyeAriaLabel'),
        title: LanguageService.t('dyeSelector.randomDye'),
        style: 'background-color: var(--theme-background-secondary); color: var(--theme-text);',
      },
    });

    // Add dice icon only (no text to prevent overflow)
    const diceIcon = this.createElement('span', {
      className: 'w-5 h-5 inline-block',
    });
    diceIcon.innerHTML = ICON_DICE;

    randomBtn.appendChild(diceIcon);

    // Hover effects for random button
    randomBtn.addEventListener('mouseenter', () => (randomBtn.style.filter = 'brightness(0.9)'));
    randomBtn.addEventListener('mouseleave', () => (randomBtn.style.filter = ''));
    randomBtn.addEventListener('mousedown', () => (randomBtn.style.filter = 'brightness(0.8)'));
    randomBtn.addEventListener('mouseup', () => (randomBtn.style.filter = 'brightness(0.9)'));

    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(clearBtn);
    searchContainer.appendChild(randomBtn);
    wrapper.appendChild(searchContainer);

    // Sort Dropdown Section
    const sortContainer = this.createElement('div', {
      className: 'flex items-center gap-2',
    });

    const sortLabel = this.createElement('label', {
      textContent: LanguageService.t('dyeSelector.sortBy'),
      className: 'text-sm font-medium text-gray-700 dark:text-gray-300',
    });

    const sortSelect = this.createElement('select', {
      attributes: {
        id: 'dye-selector-sort',
        'aria-label': LanguageService.t('dyeSelector.sortAriaLabel'),
      },
      className:
        'px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm',
    });

    const sortOptions: Array<{ value: SortOption; label: string }> = [
      { value: 'alphabetical', label: LanguageService.t('dyeSelector.sortAlphabetical') },
      { value: 'brightness-asc', label: LanguageService.t('dyeSelector.sortBrightnessAsc') },
      { value: 'brightness-desc', label: LanguageService.t('dyeSelector.sortBrightnessDesc') },
      { value: 'hue', label: LanguageService.t('dyeSelector.sortHue') },
      { value: 'saturation', label: LanguageService.t('dyeSelector.sortSaturation') },
      { value: 'category', label: LanguageService.t('dyeSelector.sortCategory') },
    ];

    sortOptions.forEach((opt) => {
      const option = this.createElement('option', {
        textContent: opt.label,
        attributes: { value: opt.value },
      });
      if (opt.value === this.sortOption) option.selected = true;
      sortSelect.appendChild(option);
    });

    sortContainer.appendChild(sortLabel);
    sortContainer.appendChild(sortSelect);
    wrapper.appendChild(sortContainer);

    // Categories Section
    if (this.options.showCategories) {
      const categoryContainer = this.createElement('div', {
        className: 'flex flex-wrap gap-2',
      });

      const createCatBtn = (cat: string, label: string) => {
        const btn = this.createElement('button', {
          textContent: label,
          className:
            'px-3 py-1 rounded-full text-sm font-medium transition-colors border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
          attributes: { 'data-category': cat },
        });

        const isActive = cat === 'all' || cat === this.currentCategory;

        if (isActive) {
          btn.classList.remove(
            'border-gray-300',
            'dark:border-gray-600',
            'text-gray-700',
            'dark:text-gray-300',
            'hover:bg-gray-100',
            'dark:hover:bg-gray-700'
          );
          btn.classList.add('bg-blue-500', 'text-white');
        }
        return btn;
      };

      categoryContainer.appendChild(
        createCatBtn('all', LanguageService.t('dyeSelector.allCategories'))
      );

      let categories = DyeService.getInstance().getCategories();
      if (this.options.excludeFacewear) {
        categories = categories.filter((c) => c !== 'Facewear');
      }

      categories.forEach((cat) => {
        categoryContainer.appendChild(createCatBtn(cat, LanguageService.getCategory(cat)));
      });

      wrapper.appendChild(categoryContainer);
    }

    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    const searchInput = this.querySelector<HTMLInputElement>('input[type="text"]');
    const clearBtn = this.querySelector<HTMLButtonElement>(
      'button[aria-label="' + LanguageService.t('dyeSelector.clearAriaLabel') + '"]'
    );
    const sortSelect = this.querySelector<HTMLSelectElement>('select');
    const catBtns = this.querySelectorAll<HTMLButtonElement>('[data-category]');

    // Search Input
    if (searchInput) {
      this.on(searchInput, 'input', () => {
        this.searchQuery = searchInput.value;
        this.emit('search-changed', this.searchQuery);
      });
    }

    // Clear Button
    if (clearBtn && searchInput) {
      this.on(clearBtn, 'click', () => {
        this.searchQuery = '';
        searchInput.value = '';
        this.emit('clear-all', void 0);
      });
    }

    // Random Button
    const randomBtn = this.querySelector<HTMLButtonElement>('#dye-selector-random-btn');
    if (randomBtn) {
      this.on(randomBtn, 'click', () => {
        this.emit('random-dye-requested', void 0);
      });
    }

    // Sort Select
    if (sortSelect) {
      this.on(sortSelect, 'change', () => {
        this.sortOption = sortSelect.value as SortOption;
        this.emit('sort-changed', this.sortOption);
      });
    }

    // Categories
    catBtns.forEach((btn) => {
      this.on(btn, 'click', () => {
        const cat = btn.getAttribute('data-category');
        this.currentCategory = cat === 'all' ? null : cat;

        // Update visual state immediately
        catBtns.forEach((b) => {
          b.classList.remove('bg-blue-500', 'text-white');
          b.classList.add(
            'border',
            'border-gray-300',
            'dark:border-gray-600',
            'text-gray-700',
            'dark:text-gray-300',
            'hover:bg-gray-100',
            'dark:hover:bg-gray-700'
          );
        });
        btn.classList.remove(
          'border',
          'border-gray-300',
          'dark:border-gray-600',
          'text-gray-700',
          'dark:text-gray-300',
          'hover:bg-gray-100',
          'dark:hover:bg-gray-700'
        );
        btn.classList.add('bg-blue-500', 'text-white');

        this.emit('category-changed', this.currentCategory);
      });
    });
  }

  public getSearchQuery(): string {
    return this.searchQuery;
  }
  public getSortOption(): SortOption {
    return this.sortOption;
  }
  public getCategory(): string | null {
    return this.currentCategory;
  }

  public clear(): void {
    this.searchQuery = '';
    const input = this.container.querySelector('input');
    if (input) input.value = '';
  }

  public focusSearch(): void {
    const input = this.container.querySelector('input');
    if (input) input.focus();
  }
}
