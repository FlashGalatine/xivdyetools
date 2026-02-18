/**
 * XIV Dye Tools - Collection Manager Modal Component
 * Manage dye collections: create, edit, delete, and organize dyes
 */
/* istanbul ignore file */
import {
  ModalService,
  CollectionService,
  LanguageService,
  ToastService,
  dyeService,
} from '@services/index';
import type { Collection, DyeId } from '@services/collection-service';
import { ICON_FOLDER } from '@shared/empty-state-icons';
import type { Dye } from '@shared/types';

/**
 * Show the collection manager modal
 */
export function showCollectionManagerModal(): void {
  const collections = CollectionService.getCollections();

  const content = document.createElement('div');
  content.className = 'collection-manager-modal space-y-4';

  // Header with count and actions
  const header = document.createElement('div');
  header.className =
    'flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700';

  const countText = document.createElement('span');
  countText.className = 'text-sm text-gray-600 dark:text-gray-400';
  countText.textContent = LanguageService.tInterpolate('collections.collectionsCount', {
    count: String(collections.length),
  });
  header.appendChild(countText);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'flex gap-2';

  // Export button
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-theme-primary';
  exportBtn.textContent = LanguageService.t('collections.exportAll');
  exportBtn.disabled = collections.length === 0 && CollectionService.getFavoritesCount() === 0;
  exportBtn.addEventListener('click', () => {
    downloadCollectionsExport();
    ToastService.success(LanguageService.t('palette.exported'));
  });
  actionsDiv.appendChild(exportBtn);

  // Import button
  const importBtn = document.createElement('button');
  importBtn.className = 'btn-theme-secondary';
  importBtn.textContent = LanguageService.t('collections.import');
  importBtn.addEventListener('click', () => {
    triggerImport(content);
  });
  actionsDiv.appendChild(importBtn);

  // Create new collection button
  const createBtn = document.createElement('button');
  createBtn.className = 'btn-theme-primary';
  createBtn.textContent = LanguageService.t('collections.newCollection');
  createBtn.disabled = !CollectionService.canCreateCollection();
  createBtn.addEventListener('click', () => {
    showCreateCollectionDialog();
  });
  actionsDiv.appendChild(createBtn);

  header.appendChild(actionsDiv);
  content.appendChild(header);

  // Collection list or empty state
  if (collections.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'text-center py-8';

    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'w-12 h-12 mx-auto mb-2 opacity-50';
    emptyIcon.innerHTML = ICON_FOLDER;
    emptyState.appendChild(emptyIcon);

    const emptyText = document.createElement('p');
    emptyText.className = 'text-gray-500 dark:text-gray-400';
    emptyText.textContent = LanguageService.t('collections.collectionsEmpty');
    emptyState.appendChild(emptyText);

    const emptyHint = document.createElement('p');
    emptyHint.className = 'text-sm text-gray-400 dark:text-gray-500 mt-1';
    emptyHint.textContent = LanguageService.t('collections.collectionsEmptyHint');
    emptyState.appendChild(emptyHint);

    content.appendChild(emptyState);
  } else {
    const list = document.createElement('div');
    list.className = 'space-y-3 max-h-96 overflow-y-auto';

    for (const collection of collections) {
      const item = createCollectionItem(collection, () => {
        // Refresh modal after any change
        ModalService.dismissTop();
        showCollectionManagerModal();
      });
      list.appendChild(item);
    }

    content.appendChild(list);
  }

  showModal(LanguageService.t('collections.manageCollections'), content, 'lg');
}

/**
 * Create a collection list item
 */
function createCollectionItem(collection: Collection, onRefresh: () => void): HTMLElement {
  const item = document.createElement('div');
  item.className = 'collection-item p-4 rounded-lg card-theme-hover';

  // Top row with name and actions
  const topRow = document.createElement('div');
  topRow.className = 'flex items-center justify-between mb-2';

  const nameDiv = document.createElement('div');
  nameDiv.className = 'flex flex-col flex-1';

  const name = document.createElement('div');
  name.className = 'font-semibold truncate';
  name.style.color = 'var(--theme-text)';
  name.textContent = collection.name;
  name.title = collection.name;
  nameDiv.appendChild(name);

  if (collection.description) {
    const desc = document.createElement('div');
    desc.className = 'text-sm text-gray-500 dark:text-gray-400 truncate';
    desc.textContent = collection.description;
    desc.title = collection.description;
    nameDiv.appendChild(desc);
  }

  topRow.appendChild(nameDiv);

  const actions = document.createElement('div');
  actions.className = 'flex gap-1 ml-2';

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.className = 'btn-theme-ghost';
  editBtn.title = LanguageService.t('collections.editCollection');
  editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
  editBtn.addEventListener('click', () => {
    showEditCollectionDialog(collection, onRefresh);
  });
  actions.appendChild(editBtn);

  // Export single collection button
  const exportSingleBtn = document.createElement('button');
  exportSingleBtn.className = 'btn-theme-ghost';
  exportSingleBtn.title = LanguageService.t('collections.export');
  exportSingleBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
  exportSingleBtn.addEventListener('click', () => {
    downloadSingleCollection(collection);
    ToastService.success(LanguageService.t('palette.exported'));
  });
  actions.appendChild(exportSingleBtn);

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-theme-danger';
  deleteBtn.title = LanguageService.t('collections.deleteCollection');
  deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(LanguageService.t('collections.confirmDelete'))) {
      CollectionService.deleteCollection(collection.id);
      ToastService.success(LanguageService.t('collections.collectionDeleted'));
      onRefresh();
    }
  });
  actions.appendChild(deleteBtn);

  topRow.appendChild(actions);
  item.appendChild(topRow);

  // Dye swatches
  if (collection.dyes.length > 0) {
    const swatchRow = document.createElement('div');
    swatchRow.className = 'flex items-center gap-1 mb-2 flex-wrap';

    const displayedDyes = collection.dyes.slice(0, 8);
    for (const dyeId of displayedDyes) {
      const dye = dyeService.getDyeById(dyeId);
      if (dye) {
        const swatch = document.createElement('div');
        swatch.className =
          'w-6 h-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer hover:scale-110 transition-transform';
        swatch.style.backgroundColor = dye.hex;
        swatch.title = LanguageService.getDyeName(dye.itemID) || dye.name;
        swatchRow.appendChild(swatch);
      }
    }

    if (collection.dyes.length > 8) {
      const more = document.createElement('span');
      more.className = 'text-xs text-gray-500 dark:text-gray-400 ml-1';
      more.textContent = `+${collection.dyes.length - 8}`;
      swatchRow.appendChild(more);
    }

    item.appendChild(swatchRow);
  }

  // Meta info
  const metaRow = document.createElement('div');
  metaRow.className = 'flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400';

  const dyeCount = document.createElement('span');
  dyeCount.textContent = LanguageService.tInterpolate('collections.dyeCount', {
    count: String(collection.dyes.length),
  });
  metaRow.appendChild(dyeCount);

  const separator = document.createElement('span');
  separator.textContent = '•';
  metaRow.appendChild(separator);

  const date = document.createElement('span');
  date.textContent = new Date(collection.updatedAt).toLocaleDateString();
  metaRow.appendChild(date);

  item.appendChild(metaRow);

  return item;
}

/**
 * Show create collection dialog
 */
export function showCreateCollectionDialog(onCreated?: (collection: Collection) => void): void {
  const content = document.createElement('div');
  content.className = 'space-y-4';

  // Name input
  const nameGroup = document.createElement('div');
  nameGroup.className = 'space-y-2';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
  nameLabel.textContent = LanguageService.t('collections.collectionName');
  nameGroup.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  nameInput.placeholder = LanguageService.t('collections.collectionName');
  nameInput.maxLength = 50;
  nameGroup.appendChild(nameInput);

  content.appendChild(nameGroup);

  // Description input
  const descGroup = document.createElement('div');
  descGroup.className = 'space-y-2';

  const descLabel = document.createElement('label');
  descLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
  descLabel.textContent = LanguageService.t('collections.collectionDescription');
  descGroup.appendChild(descLabel);

  const descInput = document.createElement('textarea');
  descInput.className =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none';
  descInput.placeholder = LanguageService.t('collections.collectionDescription');
  descInput.rows = 2;
  descInput.maxLength = 200;
  descGroup.appendChild(descInput);

  content.appendChild(descGroup);

  // Buttons
  const buttons = document.createElement('div');
  buttons.className = 'flex justify-end gap-2 pt-2';

  const cancelBtn = document.createElement('button');
  cancelBtn.className =
    'px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors';
  cancelBtn.textContent = LanguageService.t('common.cancel');
  cancelBtn.addEventListener('click', () => {
    ModalService.dismissTop();
  });
  buttons.appendChild(cancelBtn);

  const createBtn = document.createElement('button');
  createBtn.className =
    'px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors';
  createBtn.textContent = LanguageService.t('collections.createCollection');
  createBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      ToastService.warning(LanguageService.t('collections.collectionName'));
      nameInput.focus();
      return;
    }

    const collection = CollectionService.createCollection(name, descInput.value.trim());
    if (collection) {
      ToastService.success(LanguageService.t('collections.collectionCreated'));
      ModalService.dismissTop();
      if (onCreated) {
        onCreated(collection);
      }
    } else {
      ToastService.error(LanguageService.t('palette.saveFailed'));
    }
  });
  buttons.appendChild(createBtn);

  content.appendChild(buttons);

  showModal(LanguageService.t('collections.createCollection'), content, 'sm');

  // Focus name input
  setTimeout(() => nameInput.focus(), 100);
}

/**
 * Show edit collection dialog
 */
function showEditCollectionDialog(collection: Collection, onUpdated: () => void): void {
  const content = document.createElement('div');
  content.className = 'space-y-4';

  // Name input
  const nameGroup = document.createElement('div');
  nameGroup.className = 'space-y-2';

  const nameLabel = document.createElement('label');
  nameLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
  nameLabel.textContent = LanguageService.t('collections.collectionName');
  nameGroup.appendChild(nameLabel);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  nameInput.value = collection.name;
  nameInput.maxLength = 50;
  nameGroup.appendChild(nameInput);

  content.appendChild(nameGroup);

  // Description input
  const descGroup = document.createElement('div');
  descGroup.className = 'space-y-2';

  const descLabel = document.createElement('label');
  descLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
  descLabel.textContent = LanguageService.t('collections.collectionDescription');
  descGroup.appendChild(descLabel);

  const descInput = document.createElement('textarea');
  descInput.className =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none';
  descInput.value = collection.description || '';
  descInput.rows = 2;
  descInput.maxLength = 200;
  descGroup.appendChild(descInput);

  content.appendChild(descGroup);

  // Dyes in collection (removable)
  if (collection.dyes.length > 0) {
    const dyesGroup = document.createElement('div');
    dyesGroup.className = 'space-y-2';

    const dyesLabel = document.createElement('label');
    dyesLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
    dyesLabel.textContent = LanguageService.tInterpolate('collections.dyeCount', {
      count: String(collection.dyes.length),
    });
    dyesGroup.appendChild(dyesLabel);

    const dyesGrid = document.createElement('div');
    dyesGrid.className = 'flex flex-wrap gap-2';

    for (const dyeId of collection.dyes) {
      const dye = dyeService.getDyeById(dyeId);
      if (dye) {
        const dyeTag = createDyeTag(dye, () => {
          CollectionService.removeDyeFromCollection(collection.id, dyeId);
          ToastService.success(
            LanguageService.tInterpolate('collections.removedFromCollection', {
              name: collection.name,
            })
          );
          ModalService.dismissTop();
          showEditCollectionDialog(CollectionService.getCollection(collection.id)!, onUpdated);
        });
        dyesGrid.appendChild(dyeTag);
      }
    }

    dyesGroup.appendChild(dyesGrid);
    content.appendChild(dyesGroup);
  }

  // Buttons
  const buttons = document.createElement('div');
  buttons.className = 'flex justify-end gap-2 pt-2';

  const cancelBtn = document.createElement('button');
  cancelBtn.className =
    'px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors';
  cancelBtn.textContent = LanguageService.t('common.cancel');
  cancelBtn.addEventListener('click', () => {
    ModalService.dismissTop();
  });
  buttons.appendChild(cancelBtn);

  const saveBtn = document.createElement('button');
  saveBtn.className =
    'px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors';
  saveBtn.textContent = LanguageService.t('common.save');
  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) {
      ToastService.warning(LanguageService.t('collections.collectionName'));
      nameInput.focus();
      return;
    }

    const success = CollectionService.updateCollection(collection.id, {
      name,
      description: descInput.value.trim(),
    });

    if (success) {
      ToastService.success(LanguageService.t('collections.collectionUpdated'));
      ModalService.dismissTop();
      onUpdated();
    } else {
      ToastService.error(LanguageService.t('palette.saveFailed'));
    }
  });
  buttons.appendChild(saveBtn);

  content.appendChild(buttons);

  showModal(LanguageService.t('collections.editCollection'), content, 'sm');

  // Focus name input
  setTimeout(() => nameInput.focus(), 100);
}

/**
 * Create a removable dye tag
 */
function createDyeTag(dye: Dye, onRemove: () => void): HTMLElement {
  const tag = document.createElement('div');
  tag.className =
    'inline-flex items-center gap-2 px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm';

  const swatch = document.createElement('div');
  swatch.className = 'w-3 h-3 rounded-full border border-gray-400';
  swatch.style.backgroundColor = dye.hex;
  tag.appendChild(swatch);

  const name = document.createElement('span');
  name.className = 'text-gray-900 dark:text-white';
  name.textContent = LanguageService.getDyeName(dye.itemID) || dye.name;
  tag.appendChild(name);

  const removeBtn = document.createElement('button');
  removeBtn.className =
    'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white';
  removeBtn.innerHTML = '✕';
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    onRemove();
  });
  tag.appendChild(removeBtn);

  return tag;
}

/**
 * Download all collections as JSON file
 */
function downloadCollectionsExport(): void {
  const json = CollectionService.exportAll();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `xivdyetools-collections-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download single collection as JSON file
 */
function downloadSingleCollection(collection: Collection): void {
  const json = CollectionService.exportCollection(collection.id);
  if (!json) return;

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `xivdyetools-${collection.name.replace(/[^a-z0-9]/gi, '-')}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger file import
 */
function triggerImport(container: HTMLElement): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = CollectionService.importData(text);

      if (result.success) {
        ToastService.success(
          LanguageService.tInterpolate('collections.importSuccess', {
            favorites: String(result.favoritesImported),
            collections: String(result.collectionsImported),
          })
        );
        // Refresh modal
        ModalService.dismissTop();
        showCollectionManagerModal();
      } else {
        const errorMsg =
          result.errors.length > 0
            ? result.errors[0]
            : LanguageService.t('collections.importFailed');
        ToastService.error(errorMsg);
      }
    } catch {
      ToastService.error(LanguageService.t('collections.invalidFormat'));
    }
  });

  container.appendChild(input);
  input.click();
  input.remove();
}

/**
 * Helper to show modal with fallback for tests
 */
function showModal(title: string, content: HTMLElement, size: 'sm' | 'md' | 'lg' = 'md'): void {
  const maybeShow = (ModalService as unknown as Record<string, unknown>).show as
    | ((config: {
        type: 'custom';
        title: string;
        content: HTMLElement;
        size?: 'sm' | 'md' | 'lg';
        closable?: boolean;
      }) => void)
    | undefined;

  if (typeof maybeShow === 'function') {
    maybeShow({
      type: 'custom',
      title,
      content,
      size,
      closable: true,
    });
  } else {
    // Fallback for test environments
    const fallback = document.createElement('div');
    fallback.className = 'modal-fallback';
    fallback.appendChild(content);
    document.body.appendChild(fallback);
  }
}
