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
  resolvePresetDye,
  authService,
  presetSubmissionService,
} from '@services/index';
import {
  MAX_PREVIEW_IMAGE_BYTES,
  removePreviewImage,
  uploadPreviewImage,
} from '@services/preset-submission-service';
import { createCategorySelector, type CategorySelection } from './preset-category-selector';
import { presetErrorMessage, presetValidationMessage } from '@shared/preset-i18n';
import { exampleLinkError } from '@shared/example-link';
import { dyeNameMatches, localizedDyeName } from '@shared/dye-name';
import type { Dye } from '@xivdyetools/types';
import type { CommunityPreset } from '@services/community-preset-service';
import type { EditResult, PresetEditRequest } from '@services/preset-submission-service';

// ============================================
// Types
// ============================================

interface FormState {
  name: string;
  description: string;
  /** Editable since 5.0 — was a locked read-only display */
  categories: CategorySelection;
  selectedDyes: Dye[];
  tags: string;
  exampleLink: string;
  /** Picked file awaiting upload; null when nothing new was chosen */
  newPreviewImage: File | null;
  /**
   * The author pressed Remove; mutually exclusive with newPreviewImage.
   * Named `clearPreviewImage`, not `removePreviewImage`, so it cannot be
   * confused with the imported service function of that name.
   */
  clearPreviewImage: boolean;
  /** Status as loaded, so the field knows which affordance to render */
  previewImageStatus: 'none' | 'pending' | 'approved';
  previewImageUrl: string | null;
}

type OnEditCallback = (result: EditResult) => void;

// ============================================
// Configuration
// ============================================

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_DESC_LENGTH = 10;
const MAX_DESC_LENGTH = 200;
// Match the submission form and the service: a 2-dye edit passed here and
// then failed server-side, and a legal 6-dye palette could not be edited.
const MIN_DYES = 3;
const MAX_DYES = 6;
const MAX_TAGS = 10;
const MAX_TAG_LENGTH = 30;

// ============================================
// Localized Counters
// ============================================

/** "{n}/{max} (min {min})" — the description character counter. */
function descCounterText(length: number): string {
  return LanguageService.tInterpolate('preset.counterWithMin', {
    n: length,
    max: MAX_DESC_LENGTH,
    min: MIN_DESC_LENGTH,
  });
}

/** "{n}/{max} (min {min})" — the selected-dye counter. */
function dyeCounterText(count: number): string {
  return LanguageService.tInterpolate('preset.counterWithMin', {
    n: count,
    max: MAX_DYES,
    min: MIN_DYES,
  });
}

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
    .map((dyeId) => resolvePresetDye(dyeId) ?? null)
    .filter((d): d is Dye => d !== null);

  // Initialize form state with existing values
  const state: FormState = {
    name: preset.name,
    description: preset.description,
    categories: {
      primary: preset.category_id,
      secondary: preset.secondary_categories ?? [],
    },
    selectedDyes: dyeObjects,
    tags: preset.tags.join(', '),
    exampleLink: preset.example_link ?? '',
    newPreviewImage: null,
    clearPreviewImage: false,
    previewImageStatus: preset.preview_image_status ?? 'none',
    previewImageUrl: preset.preview_image_url ?? null,
  };

  // Create form content
  const content = createFormContent(preset, state, onEdit);

  // Show modal using ModalService
  ModalService.show({
    type: 'custom',
    title: LanguageService.t('preset.editTitle'),
    content,
    size: 'lg',
    closable: true,
  });
}

// ============================================
// Form Content Creation
// ============================================

function createFormContent(
  preset: CommunityPreset,
  state: FormState,
  onEdit?: OnEditCallback
): HTMLElement {
  const form = document.createElement('div');
  form.className = 'preset-edit-form space-y-4';

  // Name input
  form.appendChild(createNameInput(state));

  // Description textarea
  form.appendChild(createDescriptionInput(state));

  // Editable since 5.0. The category was locked here, and PresetEditRequest
  // had no category field at all, so a change had nowhere to go.
  form.appendChild(createCategorySelector(state.categories));

  // Dye selector
  form.appendChild(createDyeSelector(state));

  // Tags input
  form.appendChild(createTagsInput(state));

  // 8A: the example link is editable here too — it was submit-only, so a
  // link could be added at creation and then never corrected.
  form.appendChild(createExampleLinkInput(state));

  form.appendChild(createPreviewImageField(state));

  // Submit button
  form.appendChild(createSubmitButton(preset, state, onEdit));

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
  label.textContent = LanguageService.t('preset.fieldName');
  label.htmlFor = 'edit-preset-name';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'edit-preset-name';
  input.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500';
  input.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  input.placeholder = LanguageService.t('preset.fieldNamePlaceholder');
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
  label.textContent = LanguageService.t('preset.fieldDesc');
  label.htmlFor = 'edit-preset-description';

  const textarea = document.createElement('textarea');
  textarea.id = 'edit-preset-description';
  textarea.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none';
  textarea.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  textarea.placeholder = LanguageService.t('preset.fieldDescPlaceholder');
  textarea.rows = 3;
  textarea.maxLength = MAX_DESC_LENGTH;
  textarea.value = state.description;

  const counter = document.createElement('div');
  counter.className = 'text-xs mt-1 text-right';
  counter.style.color = 'var(--theme-text-secondary)';
  counter.textContent = descCounterText(state.description.length);

  textarea.addEventListener('input', () => {
    state.description = textarea.value;
    counter.textContent = descCounterText(state.description.length);

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

function createDyeSelector(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const labelRow = document.createElement('div');
  labelRow.className = 'flex items-center justify-between mb-1';

  const label = document.createElement('label');
  label.className = 'text-sm font-medium';
  label.style.color = 'var(--theme-text)';
  label.textContent = `${LanguageService.t('preset.dyes')} — ${LanguageService.t('preset.dyesReq')}`;

  const counter = document.createElement('span');
  counter.className = 'text-xs';
  counter.id = 'edit-dye-counter';
  counter.style.color = 'var(--theme-text-secondary)';
  counter.textContent = dyeCounterText(state.selectedDyes.length);

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
      const chipName = document.createElement('span');
      chipName.textContent = localizedDyeName(dye);
      const chipRemove = document.createElement('button');
      chipRemove.type = 'button';
      chipRemove.className = 'ml-1 hover:opacity-75';
      chipRemove.dataset.remove = String(dye.id);
      chipRemove.innerHTML = '&times;';
      chip.appendChild(chipName);
      chip.appendChild(chipRemove);

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
    counter.textContent = dyeCounterText(state.selectedDyes.length);
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
  searchInput.placeholder = LanguageService.t('colorPalette.searchPlaceholder');
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
      swatch.title = localizedDyeName(dye);

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
        filteredDyes.length === 0
          ? LanguageService.t('colorPalette.noDyesFound')
          : LanguageService.t('preset.allMatchingSelected');
      dyeGrid.appendChild(empty);
    }
  }

  searchInput.addEventListener('input', () => {
    const query = searchInput.value.toLowerCase().trim();
    if (query) {
      filteredDyes = allDyes.filter(
        (d) => dyeNameMatches(d, query) || d.category.toLowerCase().includes(query)
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

/**
 * Example link (8A) — the same allowlisted-host field the submission form
 * offers, validated by the same shared rule so the two cannot disagree.
 * Blank clears the link.
 */
function createExampleLinkInput(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = LanguageService.t('preset.fieldLink');
  label.htmlFor = 'edit-preset-example-link';

  const input = document.createElement('input');
  input.type = 'url';
  input.id = 'edit-preset-example-link';
  input.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500';
  input.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  input.placeholder = 'eorzeacollection.com/glamour/44120';
  input.value = state.exampleLink;

  const hint = document.createElement('div');
  hint.className = 'text-xs mt-1';
  hint.style.color = 'var(--theme-text-secondary)';
  hint.textContent = LanguageService.t('preset.fieldLinkHint');

  input.addEventListener('input', () => {
    state.exampleLink = input.value;
  });
  // Validate on blur, not per keystroke — a half-typed URL is not an error yet
  input.addEventListener('blur', () => {
    const error = exampleLinkError(state.exampleLink);
    input.style.borderColor = error ? '#ef4444' : 'var(--theme-border)';
    hint.style.color = error ? '#ef4444' : 'var(--theme-text-secondary)';
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(hint);

  return wrapper;
}

function createTagsInput(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = `${LanguageService.t('preset.fieldTags')} ${LanguageService.t('common.optional')}`;
  label.htmlFor = 'edit-preset-tags';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'edit-preset-tags';
  input.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500';
  input.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  input.placeholder = LanguageService.t('preset.fieldTagsPlaceholder');
  input.value = state.tags;

  const hint = document.createElement('div');
  hint.className = 'text-xs mt-1';
  hint.style.color = 'var(--theme-text-secondary)';
  hint.textContent = LanguageService.tInterpolate('preset.fieldTagsLimit', {
    max: MAX_TAGS,
    chars: MAX_TAG_LENGTH,
  });

  input.addEventListener('input', () => {
    state.tags = input.value;
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(hint);

  return wrapper;
}

const PREVIEW_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * Preview image: upload, replace, or remove.
 *
 * A new upload re-queues the IMAGE only — the preset's own status is never
 * touched, and the preset itself stays live and listed throughout. But a
 * REPLACEMENT is not a quiet swap: `POST /:id/preview-image` overwrites
 * `preview_image_key` and deletes the old R2 object in the same request, so
 * `preview_image_url` goes null immediately — the card shows no picture at
 * all (not the old one) until a moderator approves the new upload.
 * Removing clears the picture and, with it, the only reason the preset was in
 * the queue for its image.
 */
function createPreviewImageField(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-1';
  label.style.color = 'var(--theme-text)';
  label.textContent = LanguageService.t('preset.fieldPreviewImage');

  const body = document.createElement('div');
  body.className = 'space-y-2';

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = PREVIEW_IMAGE_ACCEPT;
  input.className = 'w-full text-sm';
  input.style.color = 'var(--theme-text)';

  input.addEventListener('change', () => {
    const file = input.files?.[0] ?? null;
    // Mirror the server limit so the author finds out before spending the upload.
    if (file && file.size > MAX_PREVIEW_IMAGE_BYTES) {
      ToastService.error(LanguageService.t('preset.previewImageTooLarge'));
      input.value = '';
      state.newPreviewImage = null;
      return;
    }
    state.newPreviewImage = file;
    // Picking a file supersedes a pending removal — they are mutually exclusive.
    if (file) state.clearPreviewImage = false;
    render();
  });

  function render(): void {
    body.replaceChildren();

    const hasStoredImage = state.previewImageStatus !== 'none' && !state.clearPreviewImage;

    if (hasStoredImage && state.previewImageStatus === 'approved' && state.previewImageUrl) {
      const img = document.createElement('img');
      img.src = state.previewImageUrl;
      img.alt = LanguageService.t('preset.previewImageCurrent');
      img.style.cssText =
        'width: 100%; max-width: 320px; border-radius: 8px; border: 1px solid var(--theme-border); display: block;';
      body.appendChild(img);
    } else if (hasStoredImage && state.previewImageStatus === 'pending') {
      const note = document.createElement('div');
      note.className = 'text-xs px-3 py-2 rounded-lg border';
      note.style.cssText =
        'border-color: rgba(244,191,79,0.35); background: rgba(244,191,79,0.08); color: var(--theme-text-secondary);';
      note.textContent = LanguageService.t('preset.previewImageUnderReview');
      body.appendChild(note);
    }

    if (state.clearPreviewImage) {
      const note = document.createElement('div');
      note.className = 'text-xs';
      note.style.color = 'var(--theme-text-secondary)';
      note.textContent = LanguageService.t('preset.previewImageRemoved');
      body.appendChild(note);
    }

    body.appendChild(input);

    if (hasStoredImage) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'px-3 py-1.5 rounded-lg border text-xs';
      removeBtn.style.cssText =
        'background-color: var(--theme-card-background); color: var(--theme-text); border-color: var(--theme-border);';
      removeBtn.textContent = LanguageService.t('preset.previewImageRemove');
      removeBtn.addEventListener('click', () => {
        state.clearPreviewImage = true;
        state.newPreviewImage = null;
        input.value = '';
        render();
      });
      body.appendChild(removeBtn);
    }
  }

  render();

  const hint = document.createElement('div');
  hint.className = 'text-xs mt-1';
  hint.style.color = 'var(--theme-text-secondary)';
  hint.textContent = LanguageService.t('preset.fieldPreviewImageHint');

  wrapper.appendChild(label);
  wrapper.appendChild(body);
  wrapper.appendChild(hint);
  return wrapper;
}

function createSubmitButton(
  preset: CommunityPreset,
  state: FormState,
  onEdit?: OnEditCallback
): HTMLElement {
  const presetId = preset.id;
  const wrapper = document.createElement('div');
  wrapper.className = 'flex justify-end gap-2 pt-4 border-t';
  wrapper.style.borderColor = 'var(--theme-border)';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'px-4 py-2 rounded-lg font-medium transition-colors';
  cancelBtn.style.cssText =
    'background-color: var(--theme-card-background); color: var(--theme-text); border: 1px solid var(--theme-border);';
  cancelBtn.textContent = LanguageService.t('common.cancel');

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
  submitBtn.textContent = LanguageService.t('preset.saveChanges');

  submitBtn.addEventListener('mouseenter', () => {
    submitBtn.style.opacity = '0.9';
  });

  submitBtn.addEventListener('mouseleave', () => {
    submitBtn.style.opacity = '1';
  });

  submitBtn.addEventListener('click', async () => {
    // Build the patch from what actually CHANGED, not from everything on the
    // form. Two reasons: an image-only edit would otherwise send a body full of
    // unchanged fields, and — because the API runs content moderation whenever
    // `name` or `description` is present — every picture swap would spend a
    // Perspective API call re-checking text nobody touched.
    const name = state.name.trim();
    const description = state.description.trim();
    const dyes = state.selectedDyes.map((d) => d.stainID).filter((id): id is number => id !== null);
    const tags = state.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    // Empty clears the link rather than leaving the old one in place
    const exampleLink = state.exampleLink.trim() || null;
    const originalSecondary = preset.secondary_categories ?? [];

    const updates: PresetEditRequest = {};
    if (name !== preset.name) updates.name = name;
    if (description !== preset.description) updates.description = description;
    if (dyes.join(',') !== preset.dyes.join(',')) updates.dyes = dyes;
    if (tags.join(',') !== preset.tags.join(',')) updates.tags = tags;
    if (exampleLink !== (preset.example_link ?? null)) updates.example_link = exampleLink;
    if (state.categories.primary !== preset.category_id) {
      updates.category_id = state.categories.primary;
    }
    if (state.categories.secondary.join(',') !== originalSecondary.join(',')) {
      updates.secondary_categories = state.categories.secondary;
    }

    // Validate against the form's values, not the patch: a field that did not
    // change was already valid, and one that did must be checked either way.
    const errors: string[] = [];
    if (name.length < MIN_NAME_LENGTH) {
      errors.push(
        LanguageService.tInterpolate('preset.validation.nameMin', { n: MIN_NAME_LENGTH })
      );
    }
    if (description.length < MIN_DESC_LENGTH) {
      errors.push(
        LanguageService.tInterpolate('preset.validation.descMin', { n: MIN_DESC_LENGTH })
      );
    }
    if (state.selectedDyes.length < MIN_DYES) {
      errors.push(LanguageService.tInterpolate('preset.validation.dyesMin', { n: MIN_DYES }));
    }
    if (state.selectedDyes.length > MAX_DYES) {
      errors.push(LanguageService.tInterpolate('preset.maxDyesAllowed', { count: MAX_DYES }));
    }

    if (errors.length > 0) {
      // One toast per error: joining them with ". " builds an English sentence
      // out of translated fragments, which does not survive translation.
      for (const error of errors) {
        ToastService.error(error);
      }
      return;
    }

    const hasFieldChanges = Object.keys(updates).length > 0;
    const hasImageChange = state.newPreviewImage !== null || state.clearPreviewImage;

    // An empty PATCH body comes back as 400 "No updates provided", which would
    // surface as a spurious error on an image-only edit that is about to
    // succeed. Nothing at all to do is its own, quieter message.
    if (!hasFieldChanges && !hasImageChange) {
      ToastService.info(LanguageService.t('preset.noChanges'));
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = LanguageService.t('preset.saving');

    try {
      let result: EditResult = { success: true };

      if (hasFieldChanges) {
        result = await presetSubmissionService.editPreset(presetId, updates);

        if (!result.success) {
          if (result.duplicate) {
            const dupName = result.duplicate.name || LanguageService.t('preset.anotherPreset');
            ToastService.error(
              LanguageService.tInterpolate('preset.duplicateFound', { name: dupName })
            );
          } else if (result.validationErrors?.length) {
            // One toast per rule; the service names the rule, the text is
            // looked up here (same table the form's own checks use).
            for (const error of result.validationErrors) {
              ToastService.error(presetValidationMessage(error));
            }
          } else {
            // `result.error` is the presets-API's own message when it sent one —
            // shown as toast details under the translated headline.
            ToastService.error(
              presetErrorMessage(result.errorCode, 'errors.saveChangesFailed'),
              result.error
            );
          }
          return;
        }
      }

      // Record what actually SUCCEEDED rather than re-reading the intent flags
      // below. ToastService stacks rather than replaces, so branching on
      // `state.newPreviewImage` after a failed upload would print "couldn't
      // upload the picture" and "picture uploaded, awaiting review" together.
      let imageUploaded = false;
      let imageCleared = false;

      if (state.newPreviewImage) {
        try {
          await uploadPreviewImage(presetId, state.newPreviewImage);
          imageUploaded = true;
        } catch {
          ToastService.warning(LanguageService.t('preset.previewImageFailed'));
        }
      } else if (state.clearPreviewImage) {
        try {
          await removePreviewImage(presetId);
          imageCleared = true;
        } catch {
          ToastService.warning(LanguageService.t('preset.previewImageRemoveFailed'));
        }
      }

      // A new picture is the more surprising outcome — it is invisible until a
      // moderator approves it — so when one actually landed it wins the message.
      if (imageUploaded) {
        ToastService.info(LanguageService.t('preset.previewImagePendingReview'));
      } else if (result.moderation_status === 'pending') {
        ToastService.info(LanguageService.t('preset.editPendingReview'));
      } else if (hasFieldChanges || imageCleared) {
        ToastService.success(LanguageService.t('preset.editSuccess'));
      }
      // Deliberately no `else`: an image-only edit whose image call failed has
      // already shown its warning, and has nothing to report as a success.

      ModalService.dismissTop();
      onEdit?.(result);
    } catch {
      ToastService.error(LanguageService.t('errors.saveChangesFailed'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = LanguageService.t('preset.saveChanges');
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
