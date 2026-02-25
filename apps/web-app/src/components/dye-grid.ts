import { BaseComponent } from './base-component';
import { LanguageService, CollectionService, ToastService } from '@services/index';
import { Dye } from '@shared/types';
import { clearContainer } from '@shared/utils';
import { getEmptyStateHTML } from './empty-state';
import { ICON_SEARCH, ICON_PALETTE } from '@shared/empty-state-icons';
import { showAddToCollectionMenu } from './add-to-collection-menu';

export interface DyeGridOptions {
  allowMultiple?: boolean;
  allowDuplicates?: boolean;
  maxSelections?: number;
  showCategories?: boolean;
  showFavorites?: boolean;
  /** Use compact 3-column grid layout for narrow panels */
  compactMode?: boolean;
}

export class DyeGrid extends BaseComponent {
  private dyes: Dye[] = [];
  private selectedDyes: Dye[] = [];
  private focusedIndex: number = -1;
  private gridColumns: number = 4;
  private options: DyeGridOptions;
  private emptyState: { type: 'search' | 'category'; query?: string } | null = null;
  private favorites: Set<number> = new Set();
  private unsubscribeFavorites: (() => void) | null = null;

  constructor(container: HTMLElement, options: DyeGridOptions = {}) {
    super(container);
    this.options = {
      allowMultiple: options.allowMultiple ?? true,
      allowDuplicates: options.allowDuplicates ?? false,
      maxSelections: options.maxSelections ?? 4,
      showCategories: options.showCategories ?? true,
      showFavorites: options.showFavorites ?? true,
      compactMode: options.compactMode ?? false,
    };

    // Subscribe to favorites changes
    if (this.options.showFavorites) {
      this.unsubscribeFavorites = CollectionService.subscribeFavorites((favs) => {
        this.favorites = new Set(favs);
        this.updateFavoriteVisuals();
      });
    }
  }

  public setDyes(dyes: Dye[], emptyState?: { type: 'search' | 'category'; query?: string }): void {
    this.dyes = dyes;
    this.emptyState = emptyState || null;
    this.update();
  }

  public setSelectedDyes(dyes: Dye[]): void {
    this.selectedDyes = dyes;
    this.updateSelectionVisuals();
  }

  renderContent(): void {
    // Use compact 3-column layout when compactMode is enabled
    const gridClasses = this.options.compactMode
      ? 'grid grid-cols-3 gap-3 max-h-96 overflow-y-auto'
      : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto';

    const wrapper = this.createElement('div', {
      className: gridClasses,
      attributes: {
        role: 'grid',
        'aria-label': LanguageService.t('dyeSelector.gridAriaLabel'),
      },
    });

    if (this.dyes.length === 0 && this.emptyState) {
      // Render empty state
      const emptyHtml =
        this.emptyState.type === 'search'
          ? getEmptyStateHTML({
              icon: ICON_SEARCH,
              title:
                LanguageService.tInterpolate('dyeSelector.noResults', {
                  query: this.emptyState.query || '',
                }) || `No dyes match "${this.emptyState.query}"`,
              description: LanguageService.t('dyeSelector.noResultsHint'),
            })
          : getEmptyStateHTML({
              icon: ICON_PALETTE,
              title: LanguageService.t('dyeSelector.noDyesInCategory'),
              description: LanguageService.t('dyeSelector.tryCategoryHint'),
            });
      wrapper.innerHTML = emptyHtml;
      wrapper.classList.remove(
        'grid',
        'grid-cols-1',
        'sm:grid-cols-2',
        'md:grid-cols-3',
        'lg:grid-cols-4',
        'gap-3'
      );
      wrapper.classList.add('flex', 'flex-col', 'items-center', 'justify-center', 'p-8');
    } else {
      this.dyes.forEach((dye, i) => {
        const _isFocused = i === this.focusedIndex || (this.focusedIndex === -1 && i === 0);
        const isSelected = this.selectedDyes.some((d) => d.id === dye.id);
        const isFavorite = this.favorites.has(dye.id);

        const btn = this.createElement('button', {
          className: `dye-select-btn group relative flex flex-col items-center p-3 rounded-xl transition-all duration-200 ${
            isSelected
              ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500 shadow-md transform scale-[1.02]'
              : 'bg-white dark:bg-gray-800 hover:shadow-lg hover:-translate-y-0.5 hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-100 dark:border-gray-700'
          }`,
          attributes: {
            'data-dye-id': String(dye.id),
            'aria-label': dye.name,
            'aria-selected': isSelected ? 'true' : 'false',
            type: 'button',
          },
        });

        this.on(btn, 'click', (e) => {
          // Don't trigger selection if clicking the favorite button
          if ((e.target as HTMLElement).closest('.favorite-btn')) {
            return;
          }
          e.stopPropagation();
          this.emit('dye-selected', dye);
        });

        // Content wrapper
        const content = this.createElement('div', { className: 'space-y-1 w-full' });

        // Action buttons container (positioned absolutely in top-right)
        if (this.options.showFavorites) {
          const actionsContainer = this.createElement('div', {
            className: 'absolute top-1 right-1 z-10 flex gap-0.5',
          });

          // Add to Collection button
          const collectionBtn = this.createElement('button', {
            className:
              'collection-btn p-1.5 rounded-full transition-all duration-200 text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700',
            attributes: {
              'data-collection-dye-id': String(dye.id),
              'aria-label': LanguageService.t('collections.addToCollection'),
              type: 'button',
            },
          });
          collectionBtn.innerHTML =
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>';
          actionsContainer.appendChild(collectionBtn);

          // Favorite star button
          const favoriteBtn = this.createElement('button', {
            className: `favorite-btn p-1.5 rounded-full transition-all duration-200 ${
              isFavorite
                ? 'text-yellow-500 hover:text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30'
                : 'text-gray-400 hover:text-yellow-500 opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`,
            attributes: {
              'data-favorite-dye-id': String(dye.id),
              'aria-label': isFavorite
                ? LanguageService.t('collections.removeFromFavorites')
                : LanguageService.t('collections.addToFavorites'),
              'aria-pressed': isFavorite ? 'true' : 'false',
              type: 'button',
            },
          });
          // Star icon (filled when favorite, outline when not)
          favoriteBtn.innerHTML = isFavorite
            ? '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>'
            : '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>';
          actionsContainer.appendChild(favoriteBtn);

          btn.appendChild(actionsContainer);
        }

        // Color div with 2:1 aspect ratio
        content.appendChild(
          this.createElement('div', {
            className: 'w-full max-h-16 h-12 rounded border border-gray-300 dark:border-gray-600',
            attributes: { style: `background-color: ${dye.hex}; aspect-ratio: 2/1;` },
          })
        );
        // Name
        content.appendChild(
          this.createElement('div', {
            textContent: LanguageService.getDyeName(dye.itemID) || dye.name,
            className: 'text-sm font-semibold text-gray-900 dark:text-white truncate',
          })
        );
        // Hex
        content.appendChild(
          this.createElement('div', {
            textContent: dye.hex,
            className: 'text-xs text-gray-600 dark:text-gray-400 number',
          })
        );
        // Category
        if (this.options.showCategories) {
          content.appendChild(
            this.createElement('div', {
              textContent: LanguageService.getCategory(dye.category),
              className: 'text-xs text-gray-500 dark:text-gray-500',
            })
          );
        }

        btn.appendChild(content);
        wrapper.appendChild(btn);
      });
    }

    clearContainer(this.container);
    this.element = wrapper;
    this.container.appendChild(this.element);
  }

  bindEvents(): void {
    if (!this.element) return;

    // Click on dye button
    this.on(this.element, 'click', (e) => {
      // Handle collection button clicks
      const collectionTarget = (e.target as HTMLElement).closest('.collection-btn');
      if (collectionTarget) {
        e.stopPropagation();
        const dyeId = parseInt(collectionTarget.getAttribute('data-collection-dye-id') || '0', 10);
        this.handleCollectionClick(dyeId, collectionTarget as HTMLElement);
        return;
      }

      // Handle favorite button clicks
      const favoriteTarget = (e.target as HTMLElement).closest('.favorite-btn');
      if (favoriteTarget) {
        e.stopPropagation();
        const dyeId = parseInt(favoriteTarget.getAttribute('data-favorite-dye-id') || '0', 10);
        this.handleFavoriteToggle(dyeId);
        return;
      }

      // Handle dye selection
      const target = (e.target as HTMLElement).closest('.dye-select-btn');
      if (target) {
        const id = parseInt(target.getAttribute('data-dye-id') || '0', 10);
        const dye = this.dyes.find((d) => d.id === id);
        if (dye) this.emit('dye-selected', dye);
      }
    });

    // Keydown
    this.on(this.element, 'keydown', (e) => this.handleKeydown(e as KeyboardEvent));
  }

  /**
   * Handle favorite toggle for a dye
   */
  private handleFavoriteToggle(dyeId: number): void {
    const dye = this.dyes.find((d) => d.id === dyeId);
    if (!dye) return;

    const dyeName = LanguageService.getDyeName(dye.itemID) || dye.name;
    const wasFavorite = CollectionService.isFavorite(dyeId);

    if (wasFavorite) {
      CollectionService.removeFavorite(dyeId);
      ToastService.success(LanguageService.t('collections.removedFromFavorites'));
    } else {
      const added = CollectionService.addFavorite(dyeId);
      if (added) {
        ToastService.success(LanguageService.t('collections.addedToFavorites'));
      } else {
        // Likely at max favorites
        const max = CollectionService.getMaxFavorites();
        ToastService.warning(
          LanguageService.tInterpolate('collections.favoritesFull', { max: String(max) }) ||
            `Maximum ${max} favorites allowed`
        );
      }
    }

    // Emit event for parent components
    this.emit('favorite-toggled', { dyeId, isFavorite: !wasFavorite, dyeName });
  }

  /**
   * Handle collection button click for a dye
   */
  private handleCollectionClick(dyeId: number, anchorElement: HTMLElement): void {
    const dye = this.dyes.find((d) => d.id === dyeId);
    if (!dye) return;

    showAddToCollectionMenu({
      dye,
      anchorElement,
      onAdded: (collection) => {
        this.emit('added-to-collection', { dyeId, collection });
      },
    });
  }

  /**
   * Update favorite star visuals without full re-render
   */
  private updateFavoriteVisuals(): void {
    if (!this.options.showFavorites) return;

    const favoriteBtns = this.container.querySelectorAll<HTMLButtonElement>('.favorite-btn');
    favoriteBtns.forEach((btn) => {
      const dyeId = parseInt(btn.getAttribute('data-favorite-dye-id') || '0', 10);
      const isFavorite = this.favorites.has(dyeId);

      // Update classes
      if (isFavorite) {
        btn.classList.remove(
          'text-gray-400',
          'opacity-0',
          'group-hover:opacity-100',
          'hover:bg-gray-100',
          'dark:hover:bg-gray-700'
        );
        btn.classList.add(
          'text-yellow-500',
          'hover:text-yellow-600',
          'bg-yellow-50',
          'dark:bg-yellow-900/30'
        );
      } else {
        btn.classList.remove(
          'text-yellow-500',
          'hover:text-yellow-600',
          'bg-yellow-50',
          'dark:bg-yellow-900/30'
        );
        btn.classList.add(
          'text-gray-400',
          'opacity-0',
          'group-hover:opacity-100',
          'hover:bg-gray-100',
          'dark:hover:bg-gray-700'
        );
      }

      // Update aria attributes
      btn.setAttribute('aria-pressed', isFavorite ? 'true' : 'false');
      btn.setAttribute(
        'aria-label',
        isFavorite
          ? LanguageService.t('collections.removeFromFavorites')
          : LanguageService.t('collections.addToFavorites')
      );

      // Update icon
      btn.innerHTML = isFavorite
        ? '<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>'
        : '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/></svg>';
    });
  }

  private updateSelectionVisuals(): void {
    const btns = this.container.querySelectorAll('.dye-select-btn');
    btns.forEach((btn) => {
      const id = parseInt(btn.getAttribute('data-dye-id') || '0', 10);
      const isSelected = this.selectedDyes.some((d) => d.id === id);
      btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    });
  }

  private handleKeydown(event: KeyboardEvent): void {
    const dyeButtons = this.container.querySelectorAll<HTMLButtonElement>('.dye-select-btn');
    if (dyeButtons.length === 0) return;

    this.updateGridColumns();

    const key = event.key;
    let newIndex: number;

    switch (key) {
      case 'ArrowRight':
        event.preventDefault();
        newIndex = Math.min(this.focusedIndex + 1, this.dyes.length - 1);
        break;

      case 'ArrowLeft':
        event.preventDefault();
        newIndex = Math.max(this.focusedIndex - 1, 0);
        break;

      case 'ArrowDown':
        event.preventDefault();
        newIndex = Math.min(this.focusedIndex + this.gridColumns, this.dyes.length - 1);
        break;

      case 'ArrowUp':
        event.preventDefault();
        newIndex = Math.max(this.focusedIndex - this.gridColumns, 0);
        break;

      case 'Home':
        event.preventDefault();
        newIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        newIndex = this.dyes.length - 1;
        break;

      case 'PageDown':
        event.preventDefault();
        newIndex = Math.min(this.focusedIndex + this.gridColumns * 3, this.dyes.length - 1);
        break;

      case 'PageUp':
        event.preventDefault();
        newIndex = Math.max(this.focusedIndex - this.gridColumns * 3, 0);
        break;

      case 'Enter':
      case ' ':
        event.preventDefault();
        if (this.focusedIndex >= 0 && this.focusedIndex < this.dyes.length) {
          this.emit('dye-selected', this.dyes[this.focusedIndex]);
        }
        return;

      case 'Escape':
        event.preventDefault();
        this.emit('escape-pressed', void 0);
        return;

      case 'f':
      case 'F':
        // Toggle favorite on focused dye
        if (
          this.options.showFavorites &&
          this.focusedIndex >= 0 &&
          this.focusedIndex < this.dyes.length
        ) {
          event.preventDefault();
          const focusedDye = this.dyes[this.focusedIndex];
          this.handleFavoriteToggle(focusedDye.id);
        }
        return;

      case 'c':
      case 'C':
        // Open add-to-collection menu on focused dye
        if (
          this.options.showFavorites &&
          this.focusedIndex >= 0 &&
          this.focusedIndex < this.dyes.length
        ) {
          event.preventDefault();
          const focusedDye = this.dyes[this.focusedIndex];
          const dyeButtons = this.container.querySelectorAll<HTMLButtonElement>('.dye-select-btn');
          const focusedBtn = dyeButtons[this.focusedIndex];
          if (focusedBtn) {
            const collectionBtn = focusedBtn.querySelector('.collection-btn');
            if (collectionBtn) {
              this.handleCollectionClick(focusedDye.id, collectionBtn as HTMLElement);
            }
          }
        }
        return;

      default:
        return;
    }

    if (newIndex !== this.focusedIndex) {
      this.setFocusedIndex(newIndex);
    }
  }

  private updateGridColumns(): void {
    const gridContainer = this.container.querySelector<HTMLElement>('div[role="grid"]');
    if (!gridContainer) return;

    const computedStyle = window.getComputedStyle(gridContainer);
    const gridTemplateColumns = computedStyle.gridTemplateColumns;

    if (gridTemplateColumns && gridTemplateColumns !== 'none') {
      const columns = gridTemplateColumns.split(' ').length;
      this.gridColumns = columns;
    } else {
      const width = window.innerWidth;
      if (width >= 1024) this.gridColumns = 4;
      else if (width >= 768) this.gridColumns = 3;
      else if (width >= 640) this.gridColumns = 2;
      else this.gridColumns = 1;
    }
  }

  private setFocusedIndex(index: number): void {
    const dyeButtons = this.container.querySelectorAll<HTMLButtonElement>('.dye-select-btn');
    if (index < 0 || index >= dyeButtons.length) return;

    if (this.focusedIndex >= 0 && this.focusedIndex < dyeButtons.length) {
      dyeButtons[this.focusedIndex].setAttribute('tabindex', '-1');
    }

    this.focusedIndex = index;
    const newFocusedBtn = dyeButtons[this.focusedIndex];
    newFocusedBtn.setAttribute('tabindex', '0');
    newFocusedBtn.focus();
    newFocusedBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /**
   * Clean up subscriptions when component is destroyed
   */
  override destroy(): void {
    if (this.unsubscribeFavorites) {
      this.unsubscribeFavorites();
      this.unsubscribeFavorites = null;
    }
    super.destroy();
  }
}
