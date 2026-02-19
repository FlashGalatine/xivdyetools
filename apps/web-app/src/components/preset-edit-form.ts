/**
 * XIV Dye Tools - Preset Edit Form Modal
 *
 * Modal form for editing community presets (owner only)
 *
 * @module components/preset-edit-form
 */

import {
  ModalService,
  ToastService,
  LanguageService,
  dyeService,
  authService,
  presetSubmissionService,
} from '@services/index';
import { getCategoryIcon } from '@shared/category-icons';
import type { Dye } from '@shared/types';
import type { PresetCategory } from '@xivdyetools/core';
import type { CommunityPreset } from '@services/community-preset-service';
import type { EditResult, PresetEditRequest } from '@services/preset-submission-service';

// ============================================
// Types
// ============================================

interface FormState {
  name: string;
  description: string;
  category: PresetCategory; // Read-only, for display
  selectedDyes: Dye[];
  tags: string;
}

type OnEditCallback = (result: EditResult) => void;

// ============================================
// Configuration
// ============================================

const CATEGORIES: { id: PresetCategory; label: string }[] = [
  { id: 'jobs', label: 'Jobs' },
  { id: 'grand-companies', label: 'Grand Companies' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'events', label: 'Events' },
  { id: 'aesthetics', label: 'Aesthetics' },
  { id: 'community', label: 'Community' },
];

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_DESC_LENGTH = 10;
const MAX_DESC_LENGTH = 200;
const MIN_DYES = 2;
const MAX_DYES = 5;
const MAX_TAGS = 10;

// ============================================
// Show Modal Function
// ============================================

/**
 * Show the preset edit form modal
 */
export function showPresetEditForm(preset: CommunityPreset, onEdit?: OnEditCallback): void {
  // Check authentication first
  if (!authService.isAuthenticated()) {
    ToastService.error(LanguageService.t('preset.loginToEdit'));
    return;
  }

  // Check ownership
  const user = authService.getUser();
  if (!user || preset.author_discord_id !== user.id) {
    ToastService.error(LanguageService.t('preset.onlyEditOwn'));
    return;
  }

  // Convert preset dyes to Dye objects
  const dyeObjects = preset.dyes
    .map((dyeId) => dyeService.getDyeById(dyeId))
    .filter((d): d is Dye => d !== null);

  // Initialize form state with existing values
  const state: FormState = {
    name: preset.name,
    description: preset.description,
    category: preset.category_id,
    selectedDyes: dyeObjects,
    tags: preset.tags.join(', '),
  };

  // Create form content
  const content = createFormContent(preset.id, state, onEdit);

  // Show modal using ModalService
  ModalService.show({
    type: 'custom',
    title: 'Edit Preset',
    content,
    size: 'lg',
    closable: true,
  });
}

// ============================================
// Form Content Creation
// ============================================

function createFormContent(
  presetId: string,
  state: FormState,
  onEdit?: OnEditCallback
): HTMLElement {
  const form = document.createElement('div');
  form.className = 'preset-edit-form space-y-4';

  // Name input
  form.appendChild(createNameInput(state));

  // Description textarea
  form.appendChild(createDescriptionInput(state));

  // Category display (read-only)
  form.appendChild(createCategoryDisplay(state));

  // Dye selector
  form.appendChild(createDyeSelector(state));

  // Tags input
  form.appendChild(createTagsInput(state));

  // Submit button
  form.appendChild(createSubmitButton(presetId, state, onEdit));

  return form;
}

// ============================================
// Form Field Creators
// ============================================

function createNameInput(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = 'Preset Name';
  label.htmlFor = 'edit-preset-name';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'edit-preset-name';
  input.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500';
  input.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  input.placeholder = 'e.g., Dark Knight Abyssal';
  input.maxLength = MAX_NAME_LENGTH;
  input.value = state.name;

  const counter = document.createElement('div');
  counter.className = 'text-xs mt-1 text-right';
  counter.style.color = 'var(--theme-text-secondary)';
  counter.textContent = `${state.name.length}/${MAX_NAME_LENGTH}`;

  input.addEventListener('input', () => {
    state.name = input.value;
    counter.textContent = `${state.name.length}/${MAX_NAME_LENGTH}`;

    // Visual feedback
    if (state.name.length < MIN_NAME_LENGTH) {
      counter.style.color = '#ef4444';
    } else {
      counter.style.color = 'var(--theme-text-secondary)';
    }
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(counter);

  return wrapper;
}

function createDescriptionInput(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = 'Description';
  label.htmlFor = 'edit-preset-description';

  const textarea = document.createElement('textarea');
  textarea.id = 'edit-preset-description';
  textarea.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none';
  textarea.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  textarea.placeholder = 'Describe your color palette and when to use it...';
  textarea.rows = 3;
  textarea.maxLength = MAX_DESC_LENGTH;
  textarea.value = state.description;

  const counter = document.createElement('div');
  counter.className = 'text-xs mt-1 text-right';
  counter.style.color = 'var(--theme-text-secondary)';
  counter.textContent = `${state.description.length}/${MAX_DESC_LENGTH} (min ${MIN_DESC_LENGTH})`;

  textarea.addEventListener('input', () => {
    state.description = textarea.value;
    counter.textContent = `${state.description.length}/${MAX_DESC_LENGTH} (min ${MIN_DESC_LENGTH})`;

    if (state.description.length < MIN_DESC_LENGTH) {
      counter.style.color = '#ef4444';
    } else {
      counter.style.color = 'var(--theme-text-secondary)';
    }
  });

  wrapper.appendChild(label);
  wrapper.appendChild(textarea);
  wrapper.appendChild(counter);

  return wrapper;
}

function createCategoryDisplay(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = 'Category (cannot be changed)';

  const category = CATEGORIES.find((c) => c.id === state.category);
  const display = document.createElement('div');
  display.className = 'px-3 py-2 rounded-lg border text-sm flex items-center gap-2';
  display.style.cssText =
    'background-color: var(--theme-card-background); color: var(--theme-text-secondary); border-color: var(--theme-border);';
  display.innerHTML = `<span class="w-4 h-4 inline-block">${getCategoryIcon(state.category)}</span><span>${category?.label || state.category}</span>`;

  wrapper.appendChild(label);
  wrapper.appendChild(display);

  return wrapper;
}

function createDyeSelector(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelRow = document.createElement('div');
  labelRow.className = 'flex items-center justify-between mb-1';

  const label = document.createElement('label');
  label.className = 'text-sm font-medium';
  label.style.color = 'var(--theme-text)';
  label.textContent = 'Select Dyes';

  const counter = document.createElement('span');
  counter.className = 'text-xs';
  counter.id = 'edit-dye-counter';
  counter.style.color = 'var(--theme-text-secondary)';
  counter.textContent = `${state.selectedDyes.length}/${MAX_DYES} (min ${MIN_DYES})`;

  labelRow.appendChild(label);
  labelRow.appendChild(counter);

  // Selected dyes display
  const selectedContainer = document.createElement('div');
  selectedContainer.className = 'flex flex-wrap gap-2 mb-2 min-h-[32px]';
  selectedContainer.id = 'edit-selected-dyes';

  function updateSelectedDisplay(): void {
    selectedContainer.innerHTML = '';
    for (const dye of state.selectedDyes) {
      const chip = document.createElement('div');
      chip.className = 'flex items-center gap-1 px-2 py-1 rounded-full text-xs';
      chip.style.cssText = `background-color: ${dye.hex}; color: ${getContrastColor(dye.hex)};`;
      chip.innerHTML = `
        <span>${dye.name}</span>
        <button type="button" class="ml-1 hover:opacity-75" data-remove="${dye.id}">&times;</button>
      `;

      chip.querySelector('button')?.addEventListener('click', () => {
        state.selectedDyes = state.selectedDyes.filter((d) => d.id !== dye.id);
        updateSelectedDisplay();
        updateDyeCounter();
        // Re-render dye grid to show removed dye as available
        renderDyeGrid();
      });

      selectedContainer.appendChild(chip);
    }
  }

  function updateDyeCounter(): void {
    counter.textContent = `${state.selectedDyes.length}/${MAX_DYES} (min ${MIN_DYES})`;
    if (state.selectedDyes.length < MIN_DYES) {
      counter.style.color = '#ef4444';
    } else if (state.selectedDyes.length >= MAX_DYES) {
      counter.style.color = '#f59e0b';
    } else {
      counter.style.color = 'var(--theme-text-secondary)';
    }
  }

  // Dye picker
  const pickerContainer = document.createElement('div');
  pickerContainer.className = 'border rounded-lg overflow-hidden';
  pickerContainer.style.cssText = 'border-color: var(--theme-border);';

  // Search input
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search dyes...';
  searchInput.className = 'w-full px-3 py-2 border-b focus:outline-none';
  searchInput.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';

  // Dye grid
  const dyeGrid = document.createElement('div');
  dyeGrid.className = 'grid grid-cols-6 sm:grid-cols-8 gap-1 p-2 max-h-48 overflow-y-auto';
  dyeGrid.id = 'edit-dye-grid';

  // Filter out Facewear dyes - they shouldn't be in presets
  const allDyes = dyeService.getAllDyes().filter((dye) => dye.category !== 'Facewear');
  let filteredDyes = [...allDyes];

  function renderDyeGrid(): void {
    dyeGrid.innerHTML = '';
    const availableDyes = filteredDyes.filter(
      (d) => !state.selectedDyes.some((s) => s.id === d.id)
    );

    for (const dye of availableDyes.slice(0, 100)) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'w-8 h-8 rounded border-2 hover:scale-110 transition-transform';
      swatch.style.cssText = `background-color: ${dye.hex}; border-color: transparent;`;
      swatch.title = dye.name;

      swatch.addEventListener('click', () => {
        if (state.selectedDyes.length < MAX_DYES) {
          state.selectedDyes.push(dye);
          updateSelectedDisplay();
          updateDyeCounter();
          renderDyeGrid();
        }
      });

      dyeGrid.appendChild(swatch);
    }

    if (availableDyes.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'col-span-full text-center py-4 text-sm';
      empty.style.color = 'var(--theme-text-secondary)';
      empty.textContent =
        filteredDyes.length === 0 ? 'No dyes found' : 'All matching dyes selected';
      dyeGrid.appendChild(empty);
    }
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (query) {
      filteredDyes = allDyes.filter(
        (d) => d.name.toLowerCase().includes(query) || d.category.toLowerCase().includes(query)
      );
    } else {
      filteredDyes = [...allDyes];
    }
    renderDyeGrid();
  });

  pickerContainer.appendChild(searchInput);
  pickerContainer.appendChild(dyeGrid);

  wrapper.appendChild(labelRow);
  wrapper.appendChild(selectedContainer);
  wrapper.appendChild(pickerContainer);

  // Initial render
  updateSelectedDisplay();
  updateDyeCounter();
  renderDyeGrid();

  return wrapper;
}

function createTagsInput(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = 'Tags (optional)';
  label.htmlFor = 'edit-preset-tags';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'edit-preset-tags';
  input.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500';
  input.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  input.placeholder = 'e.g., dark, edgy, tank (comma-separated)';
  input.value = state.tags;

  const hint = document.createElement('div');
  hint.className = 'text-xs mt-1';
  hint.style.color = 'var(--theme-text-secondary)';
  hint.textContent = `Max ${MAX_TAGS} tags, 30 chars each`;

  input.addEventListener('input', () => {
    state.tags = input.value;
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(hint);

  return wrapper;
}

function createSubmitButton(
  presetId: string,
  state: FormState,
  onEdit?: OnEditCallback
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex justify-end gap-2 pt-4 border-t';
  wrapper.style.borderColor = 'var(--theme-border)';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'px-4 py-2 rounded-lg font-medium transition-colors';
  cancelBtn.style.cssText =
    'background-color: var(--theme-card-background); color: var(--theme-text); border: 1px solid var(--theme-border);';
  cancelBtn.textContent = 'Cancel';

  cancelBtn.addEventListener('click', () => {
    ModalService.dismissTop();
  });

  cancelBtn.addEventListener('mouseenter', () => {
    cancelBtn.style.backgroundColor = 'var(--theme-card-hover)';
  });

  cancelBtn.addEventListener('mouseleave', () => {
    cancelBtn.style.backgroundColor = 'var(--theme-card-background)';
  });

  const submitBtn = document.createElement('button');
  submitBtn.type = 'button';
  submitBtn.id = 'save-preset-btn';
  submitBtn.className = 'px-4 py-2 rounded-lg font-medium text-white transition-colors';
  submitBtn.style.cssText = 'background-color: var(--theme-primary);';
  submitBtn.textContent = 'Save Changes';

  submitBtn.addEventListener('mouseenter', () => {
    submitBtn.style.opacity = '0.9';
  });

  submitBtn.addEventListener('mouseleave', () => {
    submitBtn.style.opacity = '1';
  });

  submitBtn.addEventListener('click', async () => {
    // Build edit request - only include fields that have values
    const updates: PresetEditRequest = {};

    if (state.name.trim()) {
      updates.name = state.name.trim();
    }
    if (state.description.trim()) {
      updates.description = state.description.trim();
    }
    if (state.selectedDyes.length >= MIN_DYES) {
      updates.dyes = state.selectedDyes.map((d) => d.id);
    }
    updates.tags = state.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // Validate
    const errors: string[] = [];
    if (updates.name && updates.name.length < MIN_NAME_LENGTH) {
      errors.push('Name must be at least 2 characters');
    }
    if (updates.description && updates.description.length < MIN_DESC_LENGTH) {
      errors.push('Description must be at least 10 characters');
    }
    if (state.selectedDyes.length < MIN_DYES) {
      errors.push('Must include at least 2 dyes');
    }
    if (state.selectedDyes.length > MAX_DYES) {
      errors.push('Maximum 5 dyes allowed');
    }

    if (errors.length > 0) {
      ToastService.error(errors.join('. '));
      return;
    }

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
      const result = await presetSubmissionService.editPreset(presetId, updates);

      if (result.success) {
        if (result.moderation_status === 'pending') {
          ToastService.info(LanguageService.t('preset.editPendingReview'));
        } else {
          ToastService.success(LanguageService.t('preset.editSuccess'));
        }

        ModalService.dismissTop();
        onEdit?.(result);
      } else if (result.duplicate) {
        // Dye combination already exists
        const dupName = result.duplicate.name || 'another preset';
        ToastService.error(
          LanguageService.tInterpolate('preset.duplicateFound', { name: dupName })
        );
      } else {
        ToastService.error(result.error || LanguageService.t('errors.saveChangesFailed'));
      }
    } catch {
      ToastService.error(LanguageService.t('errors.saveChangesFailed'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Changes';
    }
  });

  wrapper.appendChild(cancelBtn);
  wrapper.appendChild(submitBtn);

  return wrapper;
}

// ============================================
// Utility Functions
// ============================================

function getContrastColor(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
