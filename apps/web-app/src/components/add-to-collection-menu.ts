/* istanbul ignore file */
/**
 * XIV Dye Tools - Add to Collection Menu Component
 *
 * Dropdown menu for adding a dye to a collection.
 * Shows list of collections with quick add functionality.
 *
 * @module components/add-to-collection-menu
 */

import { CollectionService, LanguageService, ToastService } from '@services/index';
import type { Collection, DyeId } from '@services/collection-service';
import type { Dye } from '@shared/types';
import { showCreateCollectionDialog } from './collection-manager-modal';

/**
 * Options for the add to collection menu
 */
export interface AddToCollectionMenuOptions {
  dye: Dye;
  anchorElement: HTMLElement;
  onClose?: () => void;
  onAdded?: (collection: Collection) => void;
}

/**
 * Currently active menu instance
 */
let activeMenu: HTMLElement | null = null;
let cleanupListener: (() => void) | null = null;

/**
 * Show the add to collection menu
 */
export function showAddToCollectionMenu(options: AddToCollectionMenuOptions): void {
  // Close any existing menu
  closeAddToCollectionMenu();

  const { dye, anchorElement, onClose, onAdded } = options;
  const collections = CollectionService.getCollections();
  const dyeName = LanguageService.getDyeName(dye.itemID) || dye.name;

  // Create menu container
  const menu = document.createElement('div');
  menu.className =
    'add-to-collection-menu fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-48 max-w-64';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', LanguageService.t('collections.addToCollection'));

  // Position relative to anchor
  const rect = anchorElement.getBoundingClientRect();
  const menuWidth = 200;
  const menuHeight = Math.min(300, collections.length * 44 + 100);

  // Default position below the anchor
  let top = rect.bottom + 4;
  let left = rect.left;

  // Adjust if menu would go off-screen
  if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 8;
  }
  if (top + menuHeight > window.innerHeight) {
    top = rect.top - menuHeight - 4;
  }

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;

  // Header
  const header = document.createElement('div');
  header.className =
    'px-3 py-2 text-sm font-medium text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700';
  header.textContent = LanguageService.t('collections.addToCollection');
  menu.appendChild(header);

  // Collection list
  const list = document.createElement('div');
  list.className = 'max-h-48 overflow-y-auto py-1';

  if (collections.length === 0) {
    const emptyItem = document.createElement('div');
    emptyItem.className = 'px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic';
    emptyItem.textContent = LanguageService.t('collections.collectionsEmpty');
    list.appendChild(emptyItem);
  } else {
    for (const collection of collections) {
      const item = createCollectionMenuItem(collection, dye.id, dyeName, (addedCollection) => {
        closeAddToCollectionMenu();
        if (onAdded) {
          onAdded(addedCollection);
        }
      });
      list.appendChild(item);
    }
  }

  menu.appendChild(list);

  // Separator
  const separator = document.createElement('div');
  separator.className = 'border-t border-gray-200 dark:border-gray-700 my-1';
  menu.appendChild(separator);

  // Create new collection option
  const createItem = document.createElement('button');
  createItem.className =
    'w-full px-3 py-2 text-left text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2';
  createItem.setAttribute('role', 'menuitem');

  const plusIcon = document.createElement('span');
  plusIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
  createItem.appendChild(plusIcon);

  const createText = document.createElement('span');
  createText.textContent = LanguageService.t('collections.newCollection');
  createItem.appendChild(createText);

  createItem.addEventListener('click', () => {
    closeAddToCollectionMenu();
    showCreateCollectionDialog((newCollection) => {
      // Auto-add dye to the new collection
      CollectionService.addDyeToCollection(newCollection.id, dye.id);
      ToastService.success(
        LanguageService.tInterpolate('collections.addedToCollection', { name: newCollection.name })
      );
      if (onAdded) {
        onAdded(newCollection);
      }
    });
  });

  menu.appendChild(createItem);

  // Add to document
  document.body.appendChild(menu);
  activeMenu = menu;

  // Close on click outside
  const handleClickOutside = (event: MouseEvent) => {
    if (!menu.contains(event.target as Node) && !anchorElement.contains(event.target as Node)) {
      closeAddToCollectionMenu();
      if (onClose) {
        onClose();
      }
    }
  };

  // Close on escape
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      closeAddToCollectionMenu();
      if (onClose) {
        onClose();
      }
    }
  };

  // Delay adding listeners to prevent immediate close
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeydown);
    cleanupListener = () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, 10);
}

/**
 * Create a menu item for a collection
 */
function createCollectionMenuItem(
  collection: Collection,
  dyeId: DyeId,
  dyeName: string,
  onAdded: (collection: Collection) => void
): HTMLElement {
  const alreadyInCollection = collection.dyes.includes(dyeId);
  const isFull = collection.dyes.length >= CollectionService.getMaxDyesPerCollection();

  const item = document.createElement('button');
  item.className = `w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between ${
    alreadyInCollection || isFull ? 'opacity-50 cursor-not-allowed' : ''
  }`;
  item.setAttribute('role', 'menuitem');
  item.disabled = alreadyInCollection || isFull;

  const leftSide = document.createElement('div');
  leftSide.className = 'flex items-center gap-2 overflow-hidden';

  // Collection folder icon
  const folderIcon = document.createElement('span');
  folderIcon.className = 'text-gray-400';
  folderIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`;
  leftSide.appendChild(folderIcon);

  // Collection name
  const name = document.createElement('span');
  name.className = 'truncate text-gray-900 dark:text-white';
  name.textContent = collection.name;
  name.title = collection.name;
  leftSide.appendChild(name);

  item.appendChild(leftSide);

  // Right side info
  const rightSide = document.createElement('div');
  rightSide.className = 'flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400';

  if (alreadyInCollection) {
    const checkmark = document.createElement('span');
    checkmark.className = 'text-green-500';
    checkmark.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    rightSide.appendChild(checkmark);
  } else if (isFull) {
    const fullText = document.createElement('span');
    fullText.textContent = 'Full';
    rightSide.appendChild(fullText);
  } else {
    const count = document.createElement('span');
    count.textContent = `${collection.dyes.length}/${CollectionService.getMaxDyesPerCollection()}`;
    rightSide.appendChild(count);
  }

  item.appendChild(rightSide);

  // Add click handler
  if (!alreadyInCollection && !isFull) {
    item.addEventListener('click', () => {
      const success = CollectionService.addDyeToCollection(collection.id, dyeId);
      if (success) {
        ToastService.success(
          LanguageService.tInterpolate('collections.addedToCollection', { name: collection.name })
        );
        onAdded(collection);
      } else {
        ToastService.error(
          LanguageService.tInterpolate('collections.collectionFull', {
            max: String(CollectionService.getMaxDyesPerCollection()),
          })
        );
      }
    });
  }

  return item;
}

/**
 * Close the add to collection menu
 */
export function closeAddToCollectionMenu(): void {
  if (cleanupListener) {
    cleanupListener();
    cleanupListener = null;
  }
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

/**
 * Check if menu is currently open
 */
export function isAddToCollectionMenuOpen(): boolean {
  return activeMenu !== null;
}
