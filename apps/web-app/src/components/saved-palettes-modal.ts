/**
 * XIV Dye Tools - Saved Palettes Modal Component
 *
 * Phase 4: Advanced Features (T6)
 * Modal for viewing, managing, and loading saved palettes
 *
 * @module components/saved-palettes-modal
 */

import {
  ModalService,
  PaletteService,
  LanguageService,
  ToastService,
  dyeService,
} from '@services/index';
import type { SavedPalette } from '@services/palette-service';
import { ICON_FOLDER } from '@shared/empty-state-icons';

// Cache dye name to hex color mapping for fast lookups
let dyeNameToHexMap: Map<string, string> | null = null;

function getDyeHexByName(name: string): string | undefined {
  // Build the map on first use
  if (!dyeNameToHexMap) {
    dyeNameToHexMap = new Map();
    const allDyes = dyeService.getAllDyes();
    for (const dye of allDyes) {
      dyeNameToHexMap.set(dye.name, dye.hex);
    }
  }
  return dyeNameToHexMap.get(name);
}

/**
 * Callback when a palette is loaded
 */
export type OnPaletteLoadCallback = (palette: SavedPalette) => void;

/**
 * Show the saved palettes modal
 */
export function showSavedPalettesModal(onLoad?: OnPaletteLoadCallback): void {
  const palettes = PaletteService.getPalettesSortedByDate();

  const content = document.createElement('div');
  content.className = 'saved-palettes-modal space-y-4';

  // Header with count and actions
  const header = document.createElement('div');
  header.className =
    'flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700';

  const countText = document.createElement('span');
  countText.className = 'text-sm text-gray-600 dark:text-gray-400';
  countText.textContent = LanguageService.t('palette.savedCount').replace(
    '{count}',
    palettes.length.toString()
  );
  header.appendChild(countText);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'flex gap-2';

  // Export button - uses theme-aware primary button styling
  const exportBtn = document.createElement('button');
  exportBtn.className = 'btn-theme-primary';
  exportBtn.textContent = LanguageService.t('palette.export');
  exportBtn.disabled = palettes.length === 0;
  exportBtn.addEventListener('click', () => {
    PaletteService.downloadPalettes();
    ToastService.success(LanguageService.t('palette.exported'));
  });
  actionsDiv.appendChild(exportBtn);

  // Import button - uses theme-aware secondary button styling
  const importBtn = document.createElement('button');
  importBtn.className = 'btn-theme-secondary';
  importBtn.textContent = LanguageService.t('palette.import');
  importBtn.addEventListener('click', () => {
    triggerImport(content, onLoad);
  });
  actionsDiv.appendChild(importBtn);

  header.appendChild(actionsDiv);
  content.appendChild(header);

  // Palette list or empty state
  if (palettes.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'text-center py-8';

    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'w-12 h-12 mx-auto mb-2 opacity-50';
    emptyIcon.innerHTML = ICON_FOLDER;
    emptyState.appendChild(emptyIcon);

    const emptyText = document.createElement('p');
    emptyText.className = 'text-gray-500 dark:text-gray-400';
    emptyText.textContent = LanguageService.t('palette.noPalettes');
    emptyState.appendChild(emptyText);

    const emptyHint = document.createElement('p');
    emptyHint.className = 'text-sm text-gray-400 dark:text-gray-500 mt-1';
    emptyHint.textContent = LanguageService.t('palette.saveHint');
    emptyState.appendChild(emptyHint);

    content.appendChild(emptyState);
  } else {
    const list = document.createElement('div');
    list.className = 'space-y-2 max-h-96 overflow-y-auto';

    for (const palette of palettes) {
      const item = createPaletteItem(palette, onLoad, () => {
        // Refresh modal after delete
        ModalService.dismissTop();
        showSavedPalettesModal(onLoad);
      });
      list.appendChild(item);
    }

    content.appendChild(list);
  }

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
      title: LanguageService.t('palette.savedPalettes'),
      content,
      size: 'md',
      closable: true,
    });
  } else {
    // In test/mocked environments, append content directly to body to avoid hard dependency on ModalService
    const fallback = document.createElement('div');
    fallback.className = 'modal-fallback';
    fallback.appendChild(content);
    document.body.appendChild(fallback);
  }
}

/**
 * Create a palette list item
 */
function createPaletteItem(
  palette: SavedPalette,
  onLoad?: OnPaletteLoadCallback,
  onDelete?: () => void
): HTMLElement {
  const item = document.createElement('div');
  item.className = 'palette-item p-3 rounded-lg card-theme-hover';

  // Top row with name and actions
  const topRow = document.createElement('div');
  topRow.className = 'flex items-center justify-between mb-2';

  const nameDiv = document.createElement('div');
  nameDiv.className = 'font-semibold truncate flex-1';
  nameDiv.style.color = 'var(--theme-text)';
  nameDiv.textContent = palette.name;
  nameDiv.title = palette.name;
  topRow.appendChild(nameDiv);

  const actions = document.createElement('div');
  actions.className = 'flex gap-1 ml-2';

  // Load button - uses theme-aware ghost button styling
  const loadBtn = document.createElement('button');
  loadBtn.className = 'btn-theme-ghost';
  loadBtn.title = LanguageService.t('palette.load');
  loadBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--theme-primary);"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>`;
  loadBtn.addEventListener('click', () => {
    if (onLoad) {
      onLoad(palette);
      ModalService.dismissTop();
      ToastService.success(LanguageService.t('palette.loaded'));
    }
  });
  actions.appendChild(loadBtn);

  // Delete button - uses theme-aware danger button styling
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn-theme-danger';
  deleteBtn.title = LanguageService.t('common.delete');
  deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(LanguageService.t('palette.confirmDelete'))) {
      PaletteService.deletePalette(palette.id);
      ToastService.success(LanguageService.t('palette.deleted'));
      if (onDelete) onDelete();
    }
  });
  actions.appendChild(deleteBtn);

  topRow.appendChild(actions);
  item.appendChild(topRow);

  // Color swatches
  const swatchRow = document.createElement('div');
  swatchRow.className = 'flex items-center gap-1 mb-2';

  // Base color swatch
  const baseSwatch = document.createElement('div');
  baseSwatch.className = 'w-6 h-6 rounded border border-gray-300 dark:border-gray-600';
  baseSwatch.style.backgroundColor = palette.baseColor;
  baseSwatch.title = `${palette.baseDyeName} (Base)`;
  swatchRow.appendChild(baseSwatch);

  // Arrow
  const arrow = document.createElement('span');
  arrow.className = 'text-gray-400 text-xs mx-1';
  arrow.textContent = '→';
  swatchRow.appendChild(arrow);

  // Companion swatches (up to 4) - look up actual dye colors
  const companionColors = palette.companions.slice(0, 4);
  for (const name of companionColors) {
    const swatch = document.createElement('div');
    swatch.className = 'w-6 h-6 rounded border border-gray-300 dark:border-gray-600';
    swatch.title = name;
    // Look up the actual dye color by name
    const hexColor = getDyeHexByName(name);
    if (hexColor) {
      swatch.style.backgroundColor = hexColor;
    } else {
      // Fallback for unknown dye names
      swatch.classList.add('bg-gray-200', 'dark:bg-gray-700');
    }
    swatchRow.appendChild(swatch);
  }

  if (palette.companions.length > 4) {
    const more = document.createElement('span');
    more.className = 'text-xs text-gray-500 dark:text-gray-400 ml-1';
    more.textContent = `+${palette.companions.length - 4}`;
    swatchRow.appendChild(more);
  }

  item.appendChild(swatchRow);

  // Meta info
  const metaRow = document.createElement('div');
  metaRow.className = 'flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400';

  const harmonyType = document.createElement('span');
  harmonyType.textContent = palette.harmonyType;
  metaRow.appendChild(harmonyType);

  const separator = document.createElement('span');
  separator.textContent = '•';
  metaRow.appendChild(separator);

  const date = document.createElement('span');
  date.textContent = new Date(palette.dateCreated).toLocaleDateString();
  metaRow.appendChild(date);

  item.appendChild(metaRow);

  return item;
}

/**
 * Trigger file import
 */
function triggerImport(container: HTMLElement, onLoad?: OnPaletteLoadCallback): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.style.display = 'none';

  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const count = PaletteService.importPalettes(data, true);

      if (count > 0) {
        ToastService.success(
          LanguageService.t('palette.imported').replace('{count}', count.toString())
        );
        // Refresh modal
        ModalService.dismissTop();
        showSavedPalettesModal(onLoad);
      } else {
        ToastService.warning(LanguageService.t('palette.importFailed'));
      }
    } catch {
      ToastService.error(LanguageService.t('palette.invalidFile'));
    }
  });

  container.appendChild(input);
  input.click();
  input.remove();
}

/**
 * Show save palette dialog
 */
export function showSavePaletteDialog(
  harmonyType: string,
  harmonyName: string,
  baseColor: string,
  baseDyeName: string,
  companions: string[]
): void {
  const content = document.createElement('div');
  content.className = 'space-y-4';

  // Preview
  const preview = document.createElement('div');
  preview.className = 'p-3 bg-gray-100 dark:bg-gray-800 rounded-lg';

  const previewLabel = document.createElement('div');
  previewLabel.className = 'text-xs text-gray-500 dark:text-gray-400 mb-2';
  previewLabel.textContent = LanguageService.t('palette.preview');
  preview.appendChild(previewLabel);

  const swatchRow = document.createElement('div');
  swatchRow.className = 'flex items-center gap-2';

  const baseSwatch = document.createElement('div');
  baseSwatch.className = 'w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600';
  baseSwatch.style.backgroundColor = baseColor;
  baseSwatch.title = baseDyeName;
  swatchRow.appendChild(baseSwatch);

  const arrow = document.createElement('span');
  arrow.className = 'text-gray-400';
  arrow.textContent = '→';
  swatchRow.appendChild(arrow);

  const companionText = document.createElement('span');
  companionText.className = 'text-sm text-gray-700 dark:text-gray-300';
  companionText.textContent = companions.slice(0, 3).join(', ');
  if (companions.length > 3) {
    companionText.textContent += ` +${companions.length - 3}`;
  }
  swatchRow.appendChild(companionText);

  preview.appendChild(swatchRow);

  const typeLabel = document.createElement('div');
  typeLabel.className = 'text-sm text-gray-600 dark:text-gray-400 mt-2';
  typeLabel.textContent = `${LanguageService.t('harmony.harmonyType')}: ${harmonyName}`;
  preview.appendChild(typeLabel);

  content.appendChild(preview);

  // Name input
  const inputGroup = document.createElement('div');
  inputGroup.className = 'space-y-2';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
  label.textContent = LanguageService.t('palette.name');
  inputGroup.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.className =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500';
  input.placeholder =
    typeof (PaletteService as unknown as Record<string, unknown>).generateDefaultName === 'function'
      ? PaletteService.generateDefaultName()
      : 'Palette';
  input.value = `${harmonyName} - ${baseDyeName}`;
  inputGroup.appendChild(input);

  content.appendChild(inputGroup);

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
    const name = input.value.trim() || PaletteService.generateDefaultName();
    const result = PaletteService.savePalette(
      name,
      baseColor,
      baseDyeName,
      harmonyType,
      companions
    );

    if (result) {
      ToastService.success(LanguageService.t('palette.saveSuccess'));
      ModalService.dismissTop();
    } else {
      ToastService.error(LanguageService.t('palette.saveFailed'));
    }
  });
  buttons.appendChild(saveBtn);

  content.appendChild(buttons);

  try {
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
        title: LanguageService.t('palette.savePalette'),
        content,
        size: 'sm',
        closable: true,
      });
      return;
    }
  } catch {}

  const fallback = document.createElement('div');
  fallback.className = 'modal-fallback';
  fallback.appendChild(content);
  document.body.appendChild(fallback);
}
