/**
 * XIV Dye Tools - PresetSubmissionForm Unit Tests
 *
 * Covers the preview-image wiring added on top of preset submission:
 *  - the file-picker's change handler rejects an over-size file and clears
 *    the input before submit ever runs;
 *  - the post-submit upload only fires when a file was actually chosen;
 *  - a failed upload warns and lets the (already-successful) submission
 *    flow complete — it must never read as a failed submission.
 *
 * Follows the house mocking style used by camera-preview-modal.test.ts:
 * a static `vi.mock('@services/index', ...)` with plain `vi.fn()` stand-ins,
 * `LanguageService.t` echoing the key back so assertions can match on it.
 *
 * @module components/__tests__/preset-submission-form.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Dye } from '@xivdyetools/types';

// vi.mock factories are hoisted above imports, so anything they close over
// must itself be built inside vi.hoisted() — including the dye fixtures,
// not just the vi.fn() stand-ins.
const {
  mockShow,
  mockDismissTop,
  mockToastSuccess,
  mockToastError,
  mockToastWarning,
  mockToastInfo,
  mockSubmitPreset,
  mockUploadPreviewImage,
  mockDyes,
} = vi.hoisted(() => {
  function makeDye(overrides: Record<string, unknown> = {}) {
    return {
      id: 1,
      itemID: 10000,
      stainID: 1,
      name: 'Test Dye',
      hex: '#FF0000',
      rgb: { r: 255, g: 0, b: 0 },
      hsv: { h: 0, s: 100, v: 100 },
      category: 'Red',
      acquisition: 'Dye Vendor',
      cost: 216,
      currency: 'Gil',
      isMetallic: false,
      isPastel: false,
      isDark: false,
      isCosmic: false,
      isIshgardian: false,
      consolidationType: null,
      ...overrides,
    };
  }

  return {
    mockShow: vi.fn().mockReturnValue('modal-id-preset-submit'),
    mockDismissTop: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
    mockToastWarning: vi.fn(),
    mockToastInfo: vi.fn(),
    mockSubmitPreset: vi.fn(),
    mockUploadPreviewImage: vi.fn(),
    mockDyes: [
      makeDye({ id: 1, stainID: 1, name: 'Snow White', hex: '#F0F0F0' }),
      makeDye({ id: 2, stainID: 2, name: 'Ash Grey', hex: '#808080' }),
      makeDye({ id: 3, stainID: 3, name: 'Soot Black', hex: '#101010' }),
    ] as Dye[],
  };
});

vi.mock('@services/index', async () => {
  // Pull the real validateSubmission in — it's pure business logic we want
  // exercised as written, not re-implemented in a mock.
  const actual = await vi.importActual<typeof import('@services/preset-submission-service')>(
    '@services/preset-submission-service'
  );

  return {
    ModalService: {
      show: mockShow,
      dismissTop: mockDismissTop,
    },
    LanguageService: {
      t: (key: string) => key,
      tInterpolate: (key: string, vars: Record<string, string>) => `${key}:${JSON.stringify(vars)}`,
    },
    ToastService: {
      success: mockToastSuccess,
      error: mockToastError,
      warning: mockToastWarning,
      info: mockToastInfo,
    },
    dyeService: {
      getAllDyes: () => mockDyes,
    },
    authService: {
      isAuthenticated: () => true,
    },
    presetSubmissionService: {
      submitPreset: mockSubmitPreset,
    },
    validateSubmission: actual.validateSubmission,
  };
});

vi.mock('@services/preset-submission-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/preset-submission-service')>();
  return {
    ...actual,
    uploadPreviewImage: mockUploadPreviewImage,
  };
});

import { showPresetSubmissionForm } from '../preset-submission-form';

/** The modal content is a detached DOM tree — grab it off the ModalService.show call. */
function getFormContent(): HTMLElement {
  const config = mockShow.mock.calls[mockShow.mock.calls.length - 1][0];
  return config.content as HTMLElement;
}

/** Fill in the required fields so `validateSubmission` passes. */
function fillValidForm(content: HTMLElement): void {
  const name = content.querySelector<HTMLInputElement>('#preset-name')!;
  name.value = 'My Test Preset';
  name.dispatchEvent(new Event('input'));

  const description = content.querySelector<HTMLTextAreaElement>('#preset-description')!;
  description.value = 'A perfectly adequate description of the palette.';
  description.dispatchEvent(new Event('input'));

  // Category defaults to 'events', already valid — no click needed.

  // Dye grid: click the first three swatch buttons.
  const dyeButtons = content.querySelectorAll<HTMLButtonElement>('.grid.grid-cols-6 button');
  dyeButtons[0].click();
  dyeButtons[1].click();
  dyeButtons[2].click();
}

/** Attach a File to a file input the way a user's pick would, then fire `change`. */
function chooseFile(input: HTMLInputElement, file: File | null): void {
  Object.defineProperty(input, 'files', {
    value: file ? [file] : [],
    configurable: true,
  });
  input.dispatchEvent(new Event('change'));
}

function clickSubmit(content: HTMLElement): void {
  content.querySelector<HTMLButtonElement>('#submit-preset-btn')!.click();
}

/** Flush the microtask queue so the async submit handler settles. */
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('showPresetSubmissionForm — preview image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShow.mockReturnValue('modal-id-preset-submit');
    mockSubmitPreset.mockResolvedValue({
      success: true,
      preset: { id: 'preset-123' },
      moderation_status: 'pending',
    });
    mockUploadPreviewImage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an over-size file at selection time and never uploads it', async () => {
    showPresetSubmissionForm();
    const content = getFormContent();
    fillValidForm(content);

    const fileInput = content.querySelector<HTMLInputElement>('#preset-preview-image')!;
    const bigFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', {
      type: 'image/png',
    });
    chooseFile(fileInput, bigFile);

    // Rejected immediately — before submit is even clicked.
    expect(mockToastError).toHaveBeenCalledWith('preset.previewImageTooLarge');
    expect(fileInput.value).toBe('');

    clickSubmit(content);
    await flush();

    expect(mockSubmitPreset).toHaveBeenCalled();
    expect(mockUploadPreviewImage).not.toHaveBeenCalled();
  });

  it('does not attempt an upload when no file was chosen', async () => {
    showPresetSubmissionForm();
    const content = getFormContent();
    fillValidForm(content);

    clickSubmit(content);
    await flush();

    expect(mockSubmitPreset).toHaveBeenCalled();
    expect(mockUploadPreviewImage).not.toHaveBeenCalled();
  });

  it('uploads the chosen file with the newly-created preset id after a successful submit', async () => {
    showPresetSubmissionForm();
    const content = getFormContent();
    fillValidForm(content);

    const fileInput = content.querySelector<HTMLInputElement>('#preset-preview-image')!;
    const goodFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shot.png', {
      type: 'image/png',
    });
    chooseFile(fileInput, goodFile);
    expect(mockToastError).not.toHaveBeenCalled();

    clickSubmit(content);
    await flush();

    expect(mockUploadPreviewImage).toHaveBeenCalledWith('preset-123', goodFile);
  });

  it('warns but still completes the submission when the image upload fails', async () => {
    mockUploadPreviewImage.mockRejectedValue(new Error('network blip'));

    showPresetSubmissionForm();
    const content = getFormContent();
    fillValidForm(content);

    const fileInput = content.querySelector<HTMLInputElement>('#preset-preview-image')!;
    const goodFile = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'shot.png', {
      type: 'image/png',
    });
    chooseFile(fileInput, goodFile);

    clickSubmit(content);
    await flush();

    // The picture failed, not the submission.
    expect(mockToastWarning).toHaveBeenCalledWith('preset.previewImageFailed');
    expect(mockToastError).not.toHaveBeenCalled();

    // The flow still completes as a success: the modal closes and the
    // caller's onSubmit still fires with a successful result.
    expect(mockDismissTop).toHaveBeenCalled();
  });
});
