/**
 * XIV Dye Tools - Preset Submission Form Modal
 *
 * Modal form for submitting community presets
 *
 * @module components/preset-submission-form
 */

import {
  ModalService,
  LanguageService,
  ToastService,
  dyeService,
  authService,
  presetSubmissionService,
  validateSubmission,
} from '@services/index';
import { getCategoryIcon } from '@shared/category-icons';
import type { Dye } from '@shared/types';
import type { PresetCategory } from '@xivdyetools/core';
import type { PresetSubmission, SubmissionResult } from '@services/preset-submission-service';

// ============================================
// Types
// ============================================

interface FormState {
  name: string;
  description: string;
  category: PresetCategory;
  selectedDyes: Dye[];
  tags: string;
}

type OnSubmitCallback = (result: SubmissionResult) => void;

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
 * Show the preset submission form modal
 */
export function showPresetSubmissionForm(onSubmit?: OnSubmitCallback): void {
  // Check authentication first
  if (!authService.isAuthenticated()) {
    ToastService.error(LanguageService.t('preset.loginToSubmit'));
    return;
  }

  // Initialize form state
  const state: FormState = {
    name: '',
    description: '',
    category: 'community',
    selectedDyes: [],
    tags: '',
  };

  // Create form content
  const content = createFormContent(state, onSubmit);

  // Show modal using ModalService
  ModalService.show({
    type: 'custom',
    title: 'Submit a Preset',
    content,
    size: 'lg',
    closable: true,
  });
}

// ============================================
// Form Content Creation
// ============================================

function createFormContent(state: FormState, onSubmit?: OnSubmitCallback): HTMLElement {
  const form = document.createElement('div');
  form.className = 'preset-submission-form space-y-4';

  // Name input
  form.appendChild(createNameInput(state));

  // Description textarea
  form.appendChild(createDescriptionInput(state));

  // Category selector
  form.appendChild(createCategorySelector(state));

  // Dye selector
  form.appendChild(createDyeSelector(state));

  // Tags input
  form.appendChild(createTagsInput(state));

  // Submit button
  form.appendChild(createSubmitButton(state, onSubmit));

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
  label.htmlFor = 'preset-name';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'preset-name';
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
  label.htmlFor = 'preset-description';

  const textarea = document.createElement('textarea');
  textarea.id = 'preset-description';
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

function createCategorySelector(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = 'Category';

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-3 gap-2';

  for (const cat of CATEGORIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'px-3 py-2 rounded-lg border text-sm transition-all flex items-center justify-center gap-1';

    const isSelected = state.category === cat.id;
    if (isSelected) {
      btn.style.cssText =
        'background-color: var(--theme-primary); color: white; border-color: var(--theme-primary);';
    } else {
      btn.style.cssText =
        'background-color: var(--theme-card-background); color: var(--theme-text); border-color: var(--theme-border);';
    }

    btn.innerHTML = `<span class="w-4 h-4 inline-block">${getCategoryIcon(cat.id)}</span><span>${cat.label}</span>`;

    btn.addEventListener('click', () => {
      state.category = cat.id;
      // Update all buttons
      const buttons = grid.querySelectorAll('button');
      buttons.forEach((b, i) => {
        const selected = CATEGORIES[i].id === state.category;
        if (selected) {
          b.style.cssText =
            'background-color: var(--theme-primary); color: white; border-color: var(--theme-primary);';
        } else {
          b.style.cssText =
            'background-color: var(--theme-card-background); color: var(--theme-text); border-color: var(--theme-border);';
        }
      });
    });

    btn.addEventListener('mouseenter', () => {
      if (state.category !== cat.id) {
        btn.style.backgroundColor = 'var(--theme-card-hover)';
      }
    });

    btn.addEventListener('mouseleave', () => {
      if (state.category !== cat.id) {
        btn.style.backgroundColor = 'var(--theme-card-background)';
      }
    });

    grid.appendChild(btn);
  }

  wrapper.appendChild(label);
  wrapper.appendChild(grid);

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
  counter.id = 'dye-counter';
  counter.style.color = 'var(--theme-text-secondary)';
  counter.textContent = `${state.selectedDyes.length}/${MAX_DYES} (min ${MIN_DYES})`;

  labelRow.appendChild(label);
  labelRow.appendChild(counter);

  // Selected dyes display
  const selectedDisplay = document.createElement('div');
  selectedDisplay.id = 'selected-dyes-display';
  selectedDisplay.className = 'flex flex-wrap gap-2 mb-2 min-h-[40px] p-2 rounded-lg border';
  selectedDisplay.style.cssText =
    'background-color: var(--theme-card-background); border-color: var(--theme-border);';

  const updateSelectedDisplay = () => {
    selectedDisplay.innerHTML = '';

    if (state.selectedDyes.length === 0) {
      const placeholder = document.createElement('span');
      placeholder.className = 'text-sm opacity-50';
      placeholder.style.color = 'var(--theme-text)';
      placeholder.textContent = 'Click dyes below to add them...';
      selectedDisplay.appendChild(placeholder);
    } else {
      state.selectedDyes.forEach((dye, index) => {
        const chip = document.createElement('div');
        chip.className =
          'flex items-center gap-1 px-2 py-1 rounded-full text-xs border cursor-pointer transition-colors';
        chip.style.cssText = `background-color: ${dye.hex}20; border-color: ${dye.hex}; color: var(--theme-text);`;

        const swatch = document.createElement('div');
        swatch.className = 'w-3 h-3 rounded-full';
        swatch.style.backgroundColor = dye.hex;

        const name = document.createElement('span');
        name.textContent = dye.name;

        const remove = document.createElement('span');
        remove.className = 'ml-1 hover:text-red-500';
        remove.textContent = '×';

        chip.appendChild(swatch);
        chip.appendChild(name);
        chip.appendChild(remove);

        chip.addEventListener('click', () => {
          state.selectedDyes.splice(index, 1);
          updateSelectedDisplay();
          updateCounter();
        });

        chip.title = 'Click to remove';

        selectedDisplay.appendChild(chip);
      });
    }
  };

  const updateCounter = () => {
    const counterEl = document.getElementById('dye-counter');
    if (counterEl) {
      counterEl.textContent = `${state.selectedDyes.length}/${MAX_DYES} (min ${MIN_DYES})`;
      if (state.selectedDyes.length < MIN_DYES) {
        counterEl.style.color = '#ef4444';
      } else if (state.selectedDyes.length > MAX_DYES) {
        counterEl.style.color = '#ef4444';
      } else {
        counterEl.style.color = 'var(--theme-text-secondary)';
      }
    }
  };

  // Dye search/filter
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'w-full px-3 py-2 rounded-lg border mb-2 focus:outline-none focus:ring-2';
  searchInput.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  searchInput.placeholder = 'Search dyes by name...';

  // Dye grid
  const dyeGrid = document.createElement('div');
  dyeGrid.className =
    'grid grid-cols-6 sm:grid-cols-8 gap-1 max-h-48 overflow-y-auto p-2 rounded-lg border';
  dyeGrid.style.cssText =
    'background-color: var(--theme-card-background); border-color: var(--theme-border);';

  // Filter out Facewear dyes - they shouldn't be in presets
  const allDyes = dyeService.getAllDyes().filter((dye) => dye.category !== 'Facewear');
  let filteredDyes = allDyes;

  const renderDyeGrid = () => {
    dyeGrid.innerHTML = '';

    filteredDyes.forEach((dye) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'w-8 h-8 rounded border-2 transition-all hover:scale-110';

      const isSelected = state.selectedDyes.some((d) => d.id === dye.id);
      btn.style.cssText = `background-color: ${dye.hex}; border-color: ${isSelected ? 'white' : 'transparent'}; ${isSelected ? 'box-shadow: 0 0 0 2px var(--theme-primary);' : ''}`;

      btn.title = dye.name;

      btn.addEventListener('click', () => {
        const existingIndex = state.selectedDyes.findIndex((d) => d.id === dye.id);
        if (existingIndex >= 0) {
          // Remove if already selected
          state.selectedDyes.splice(existingIndex, 1);
        } else if (state.selectedDyes.length < MAX_DYES) {
          // Add if under limit
          state.selectedDyes.push(dye);
        } else {
          ToastService.warning(
            LanguageService.tInterpolate('preset.maxDyesAllowed', { count: String(MAX_DYES) })
          );
          return;
        }

        updateSelectedDisplay();
        updateCounter();
        renderDyeGrid();
      });

      dyeGrid.appendChild(btn);
    });
  };

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase();
    if (query) {
      filteredDyes = allDyes.filter((d) => d.name.toLowerCase().includes(query));
    } else {
      filteredDyes = allDyes;
    }
    renderDyeGrid();
  });

  // Initial render
  updateSelectedDisplay();
  renderDyeGrid();

  wrapper.appendChild(labelRow);
  wrapper.appendChild(selectedDisplay);
  wrapper.appendChild(searchInput);
  wrapper.appendChild(dyeGrid);

  return wrapper;
}

function createTagsInput(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = 'Tags (optional)';
  label.htmlFor = 'preset-tags';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'preset-tags';
  input.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500';
  input.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  input.placeholder = 'dark, gothic, elegant (comma-separated)';
  input.value = state.tags;

  const hint = document.createElement('div');
  hint.className = 'text-xs mt-1';
  hint.style.color = 'var(--theme-text-secondary)';
  hint.textContent = `Up to ${MAX_TAGS} tags, each max 30 characters`;

  input.addEventListener('input', () => {
    state.tags = input.value;
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(hint);

  return wrapper;
}

function createSubmitButton(state: FormState, onSubmit?: OnSubmitCallback): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'flex justify-end gap-2 pt-4 border-t';
  wrapper.style.borderColor = 'var(--theme-border)';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'px-4 py-2 rounded-lg border transition-colors';
  cancelBtn.style.cssText =
    'background-color: var(--theme-card-background); color: var(--theme-text); border-color: var(--theme-border);';
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
  submitBtn.id = 'submit-preset-btn';
  submitBtn.className = 'px-4 py-2 rounded-lg font-medium text-white transition-colors';
  submitBtn.style.cssText = 'background-color: var(--theme-primary);';
  submitBtn.textContent = 'Submit Preset';

  submitBtn.addEventListener('mouseenter', () => {
    submitBtn.style.opacity = '0.9';
  });

  submitBtn.addEventListener('mouseleave', () => {
    submitBtn.style.opacity = '1';
  });

  submitBtn.addEventListener('click', async () => {
    // Build submission
    const submission: PresetSubmission = {
      name: state.name.trim(),
      description: state.description.trim(),
      category_id: state.category,
      dyes: state.selectedDyes.map((d) => d.id),
      tags: state.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };

    // Validate
    const errors = validateSubmission(submission);
    if (errors.length > 0) {
      ToastService.error(errors.map((e) => e.message).join('. '));
      return;
    }

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      const result = await presetSubmissionService.submitPreset(submission);

      if (result.success) {
        if (result.duplicate) {
          const duplicateName = result.duplicate.name || 'existing preset';
          const message = result.vote_added
            ? LanguageService.tInterpolate('preset.duplicateWithVote', { name: duplicateName })
            : LanguageService.tInterpolate('preset.duplicateFound', { name: duplicateName });
          ToastService.info(message);

          // Navigate to the duplicate preset after dismissing modal
          console.info('[PresetSubmissionForm] calling ModalService.dismissTop() for duplicate');
          ModalService.dismissTop();
          console.info('[PresetSubmissionForm] dismissTop() returned for duplicate');

          // Store the duplicate preset ID for navigation
          if (result.duplicate.id) {
            sessionStorage.setItem('pendingPresetId', result.duplicate.id);
            // Dispatch event to notify preset browser to switch and show the preset
            window.dispatchEvent(
              new CustomEvent('navigate-to-preset', { detail: { presetId: result.duplicate.id } })
            );
          }

          onSubmit?.(result);
          return;
        } else if (result.moderation_status === 'pending') {
          ToastService.success(LanguageService.t('preset.submittedPendingReview'));
        } else {
          ToastService.success(LanguageService.t('preset.submittedSuccess'));
        }

        console.info('[PresetSubmissionForm] calling ModalService.dismissTop()');
        ModalService.dismissTop();
        console.info('[PresetSubmissionForm] dismissTop() returned');
        onSubmit?.(result);
      } else {
        ToastService.error(result.error || LanguageService.t('errors.submitPresetFailed'));
      }
    } catch {
      ToastService.error(LanguageService.t('errors.submitPresetFailed'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Preset';
    }
  });

  wrapper.appendChild(cancelBtn);
  wrapper.appendChild(submitBtn);

  return wrapper;
}
