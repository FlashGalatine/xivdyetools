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
import type { Dye } from '@xivdyetools/types';
import {
  MAX_PREVIEW_IMAGE_BYTES,
  uploadPreviewImage,
  type PresetSubmission,
  type SubmissionResult,
} from '@services/preset-submission-service';
import { presetErrorMessage, presetValidationMessage } from '@shared/preset-i18n';
import { exampleLinkError } from '@shared/example-link';
import { dyeNameMatches, localizedDyeName } from '@shared/dye-name';
import { logger } from '@shared/logger';
import { createCategorySelector, type CategorySelection } from './preset-category-selector';

// ============================================
// Types
// ============================================

interface FormState {
  name: string;
  description: string;
  /** Primary + up to two secondary; the shared selector owns the ranking */
  categories: CategorySelection;
  selectedDyes: Dye[];
  tags: string;
  /** 8A example link (allowlisted host; validated on blur) */
  exampleLink: string;
  /** Optional card image; uploaded only after the preset is created (needs its id) */
  previewImage: File | null;
  /** Re-render the HOW IT WILL LOOK preview band (8S) */
  refreshPreview?: () => void;
}

type OnSubmitCallback = (result: SubmissionResult) => void;

// ============================================
// Configuration
// ============================================

const MIN_NAME_LENGTH = 2;
const MAX_NAME_LENGTH = 50;
const MIN_DESC_LENGTH = 10;
const MAX_DESC_LENGTH = 200;
// 8S: a preset has to be buyable and substantial — 3–6 real dyes
// (matches the Phase-1 presets-api validation change).
const MIN_DYES = 3;
const MAX_DYES = 6;

// ============================================
// Show Modal Function
// ============================================

/** Optional prefill (10A make-a-palette hands the glamour's dyes in). */
export interface SubmissionFormInitial {
  name?: string;
  dyes?: Dye[];
}

/**
 * Show the preset submission form modal
 */
export function showPresetSubmissionForm(
  onSubmit?: OnSubmitCallback,
  initial?: SubmissionFormInitial
): void {
  // Check authentication first
  if (!authService.isAuthenticated()) {
    ToastService.error(LanguageService.t('preset.loginToSubmit'));
    return;
  }

  // Initialize form state
  const state: FormState = {
    name: initial?.name ?? '',
    description: '',
    categories: { primary: 'events', secondary: [] },
    selectedDyes: initial?.dyes ? initial.dyes.slice(0, MAX_DYES) : [],
    tags: '',
    exampleLink: '',
    previewImage: null,
  };

  // Create form content
  const content = createFormContent(state, onSubmit);

  // 8S: one content column at 560 so the dye slots and preview band
  // are not squeezed.
  ModalService.show({
    type: 'custom',
    title: LanguageService.t('preset.submitTitle'),
    subtitle: LanguageService.t('preset.submitSub'),
    content,
    panelWidth: 560,
    closable: true,
  });
}

// ============================================
// Form Content Creation
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

/** 8S label row: localized label + REQUIRED/OPTIONAL chip. */
function fieldLabelRow(labelText: string, reqText: string, required: boolean): HTMLElement {
  const row = document.createElement('div');
  row.className = 'flex items-center justify-between mb-1';
  const label = document.createElement('span');
  label.className = 'text-sm font-medium';
  label.style.color = 'var(--theme-text)';
  label.textContent = labelText;
  const chip = document.createElement('span');
  chip.style.cssText = `font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 1px; padding: 2px 6px; border-radius: 4px; background: ${
    required
      ? 'color-mix(in srgb, var(--theme-primary) 14%, transparent)'
      : 'var(--theme-background-secondary)'
  }; color: ${required ? 'var(--theme-primary)' : 'var(--theme-text-muted)'};`;
  chip.textContent = reqText;
  row.appendChild(label);
  row.appendChild(chip);
  return row;
}

/** 8S field hint under an input. */
function fieldHint(text: string): HTMLElement {
  const hint = document.createElement('div');
  hint.className = 'text-xs mt-1';
  hint.style.color = 'var(--theme-text-muted)';
  hint.textContent = text;
  return hint;
}

/** HOW IT WILL LOOK — live preview band built from the current draft. */
function createPreviewBand(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'mb-4';

  const labelRow = document.createElement('div');
  labelRow.className = 'flex items-center justify-between mb-2';
  const label = document.createElement('span');
  label.style.cssText =
    'font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted);';
  label.textContent = LanguageService.t('preset.previewLabel');
  const draft = document.createElement('span');
  draft.style.cssText =
    'font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 1px; padding: 2px 6px; border-radius: 4px; background: var(--theme-background-secondary); color: var(--theme-text-muted);';
  draft.textContent = LanguageService.t('preset.draftBadge');
  labelRow.appendChild(label);
  labelRow.appendChild(draft);

  const card = document.createElement('div');
  card.style.cssText =
    'border: 1px solid var(--theme-border); border-radius: 10px; overflow: hidden;';

  const band = document.createElement('div');
  band.style.cssText = 'display: flex; height: 44px;';
  const nameLine = document.createElement('div');
  nameLine.style.cssText =
    'padding: 8px 12px; font-size: 13px; font-weight: 650; color: var(--theme-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

  const refresh = (): void => {
    band.replaceChildren(
      ...(state.selectedDyes.length
        ? state.selectedDyes.map((d) => {
            const seg = document.createElement('div');
            seg.style.cssText = `flex: 1; background: ${d.hex};`;
            return seg;
          })
        : [
            (() => {
              const seg = document.createElement('div');
              seg.style.cssText = 'flex: 1; background: var(--theme-background-secondary);';
              return seg;
            })(),
          ])
    );
    nameLine.textContent = state.name || '—';
  };
  state.refreshPreview = refresh;
  refresh();

  card.appendChild(band);
  card.appendChild(nameLine);
  wrapper.appendChild(labelRow);
  wrapper.appendChild(card);
  return wrapper;
}

function createFormContent(state: FormState, onSubmit?: OnSubmitCallback): HTMLElement {
  const form = document.createElement('div');
  form.className = 'preset-submission-form space-y-4';

  // 8S: live preview leads the form
  form.appendChild(createPreviewBand(state));

  // Any edit refreshes the preview (covers inputs, category and dye slots)
  form.addEventListener('input', () => state.refreshPreview?.());
  form.addEventListener('click', () => setTimeout(() => state.refreshPreview?.(), 0));

  // Name input
  form.appendChild(createNameInput(state));

  // Description textarea
  form.appendChild(createDescriptionInput(state));

  // Category selector
  form.appendChild(createCategorySelector(state.categories, () => state.refreshPreview?.()));

  // Dye selector — slot picker only: a preset has to be buyable
  form.appendChild(createDyeSelector(state));
  form.appendChild(fieldHint(LanguageService.t('preset.dyesHint')));

  // Tags input
  form.appendChild(createTagsInput(state));

  // Example link (8A) — validated on blur, not per keystroke
  form.appendChild(createExampleLinkInput(state));

  // Preview image — optional; only uploadable once the preset has an id
  form.appendChild(createPreviewImageInput(state));

  // Moderation rules line
  const rules = fieldHint(LanguageService.t('preset.rulesNote'));
  rules.style.cssText += 'line-height: 1.55; margin-top: 8px;';
  form.appendChild(rules);

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

  const label = fieldLabelRow(
    LanguageService.t('preset.fieldName'),
    LanguageService.t('preset.reqRequired'),
    true
  );

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'preset-name';
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
  wrapper.appendChild(fieldHint(LanguageService.t('preset.fieldNameHint')));

  return wrapper;
}

function createDescriptionInput(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = fieldLabelRow(
    LanguageService.t('preset.fieldDesc'),
    LanguageService.t('preset.reqRequired'),
    true
  );

  const textarea = document.createElement('textarea');
  textarea.id = 'preset-description';
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
  wrapper.appendChild(fieldHint(LanguageService.t('preset.fieldDescHint')));

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
  counter.id = 'dye-counter';
  counter.style.color = 'var(--theme-text-secondary)';
  counter.textContent = dyeCounterText(state.selectedDyes.length);

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
      placeholder.textContent = LanguageService.t('preset.clickDyesToAdd');
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
        name.textContent = localizedDyeName(dye);

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

        chip.title = LanguageService.t('preset.clickToRemove');

        selectedDisplay.appendChild(chip);
      });
    }
  };

  const updateCounter = () => {
    const counterEl = document.getElementById('dye-counter');
    if (counterEl) {
      counterEl.textContent = dyeCounterText(state.selectedDyes.length);
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
  searchInput.placeholder = LanguageService.t('dyeSelector.searchPlaceholder');

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

      btn.title = localizedDyeName(dye);

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
      filteredDyes = allDyes.filter((d) => dyeNameMatches(d, query));
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

  const label = fieldLabelRow(
    LanguageService.t('preset.fieldTags'),
    LanguageService.t('preset.reqOptional'),
    false
  );

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'preset-tags';
  input.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500';
  input.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  input.placeholder = LanguageService.t('preset.fieldTagsPlaceholder');
  input.value = state.tags;

  const hint = fieldHint(LanguageService.t('preset.fieldTagsHint'));

  input.addEventListener('input', () => {
    state.tags = input.value;
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(hint);

  return wrapper;
}

function createExampleLinkInput(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = fieldLabelRow(
    LanguageService.t('preset.fieldLink'),
    LanguageService.t('preset.reqNewOptional'),
    false
  );

  const input = document.createElement('input');
  input.type = 'url';
  input.id = 'preset-example-link';
  input.className =
    'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500';
  input.style.cssText =
    'background-color: var(--theme-input-background); color: var(--theme-text); border-color: var(--theme-border);';
  input.placeholder = 'eorzeacollection.com/glamour/44120';
  input.value = state.exampleLink;

  const hint = fieldHint(LanguageService.t('preset.fieldLinkHint'));

  input.addEventListener('input', () => {
    state.exampleLink = input.value;
  });
  // Validate on blur, not per keystroke — a half-typed URL is not an error yet.
  input.addEventListener('blur', () => {
    const error = exampleLinkError(state.exampleLink);
    input.style.borderColor = error ? '#ef4444' : 'var(--theme-border)';
    hint.style.color = error ? '#ef4444' : 'var(--theme-text-muted)';
  });

  wrapper.appendChild(label);
  wrapper.appendChild(input);
  wrapper.appendChild(hint);

  return wrapper;
}

const PREVIEW_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp';

function createPreviewImageInput(state: FormState): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'form-field';

  const label = fieldLabelRow(
    LanguageService.t('preset.fieldPreviewImage'),
    LanguageService.t('preset.reqOptional'),
    false
  );

  const input = document.createElement('input');
  input.type = 'file';
  input.id = 'preset-preview-image';
  input.accept = PREVIEW_IMAGE_ACCEPT;
  input.className = 'w-full text-sm';
  input.style.color = 'var(--theme-text)';

  const hint = fieldHint(LanguageService.t('preset.fieldPreviewImageHint'));

  input.addEventListener('change', () => {
    const file = input.files?.[0] ?? null;
    // Fail fast on size here — mirrors the server limit so the user finds
    // out before waiting on an upload the server would reject anyway.
    if (file && file.size > MAX_PREVIEW_IMAGE_BYTES) {
      ToastService.error(LanguageService.t('preset.previewImageTooLarge'));
      input.value = '';
      state.previewImage = null;
      return;
    }
    state.previewImage = file;
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
  submitBtn.id = 'submit-preset-btn';
  submitBtn.className = 'px-4 py-2 rounded-lg font-medium text-white transition-colors';
  submitBtn.style.cssText = 'background-color: var(--theme-primary);';
  submitBtn.textContent = LanguageService.t('preset.submitPreset');

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
      category_id: state.categories.primary,
      secondary_categories: state.categories.secondary,
      dyes: state.selectedDyes.map((d) => d.stainID).filter((id): id is number => id !== null),
      tags: state.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      example_link: state.exampleLink.trim() || null,
    };

    // Validate
    const errors = validateSubmission(submission);
    if (errors.length > 0) {
      // One toast per error: joining them with ". " builds an English sentence
      // out of translated fragments, which does not survive translation.
      // The service names the broken rule; the text is looked up here.
      for (const error of errors) {
        ToastService.error(presetValidationMessage(error));
      }
      return;
    }
    const linkError = exampleLinkError(state.exampleLink);
    if (linkError) {
      ToastService.error(linkError);
      return;
    }

    // Disable button and show loading
    submitBtn.disabled = true;
    submitBtn.textContent = LanguageService.t('preset.submitting');

    try {
      const result = await presetSubmissionService.submitPreset(submission);

      if (result.success) {
        if (result.duplicate) {
          const duplicateName = result.duplicate.name || LanguageService.t('preset.anotherPreset');
          const message = result.vote_added
            ? LanguageService.tInterpolate('preset.duplicateWithVote', { name: duplicateName })
            : LanguageService.tInterpolate('preset.duplicateFound', { name: duplicateName });
          ToastService.info(message);

          // Navigate to the duplicate preset after dismissing modal
          logger.info('[PresetSubmissionForm] calling ModalService.dismissTop() for duplicate');
          ModalService.dismissTop();
          logger.info('[PresetSubmissionForm] dismissTop() returned for duplicate');

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

        // The preset now exists, so the image (which is scoped to a preset
        // id) can go up. A failed upload must not read as a failed submission:
        // the preset was created either way, so warn and continue rather than
        // throwing.
        if (state.previewImage && result.preset?.id) {
          try {
            await uploadPreviewImage(result.preset.id, state.previewImage);
          } catch {
            ToastService.warning(LanguageService.t('preset.previewImageFailed'));
          }
        }

        logger.info('[PresetSubmissionForm] calling ModalService.dismissTop()');
        ModalService.dismissTop();
        logger.info('[PresetSubmissionForm] dismissTop() returned');
        onSubmit?.(result);
      } else if (result.validationErrors?.length) {
        // The service revalidates; one toast per rule, same as above.
        for (const error of result.validationErrors) {
          ToastService.error(presetValidationMessage(error));
        }
      } else {
        // `result.error` is the presets-API's own message when it sent one —
        // shown as toast details under the translated headline, not instead of it.
        ToastService.error(
          presetErrorMessage(result.errorCode, 'errors.submitPresetFailed'),
          result.error
        );
      }
    } catch {
      ToastService.error(LanguageService.t('errors.submitPresetFailed'));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = LanguageService.t('preset.submitPreset');
    }
  });

  wrapper.appendChild(cancelBtn);
  wrapper.appendChild(submitBtn);

  return wrapper;
}
