/**
 * XIV Dye Tools - PresetEditForm Unit Tests
 *
 * The edit form shipped its 4.x English literals long after the sibling
 * submission form was localized, so these tests pin the i18n contract:
 *  - every label, placeholder, hint, counter and button comes from a
 *    `LanguageService` key (the mock echoes the key back, so the rendered
 *    text IS the key when the wiring is right and English prose when it is not);
 *  - the dye chips and swatch tooltips use the localized dye name;
 *  - validation raises ONE toast per error rather than a ". "-joined
 *    English sentence assembled from translated fragments.
 *
 * Follows the house mocking style of preset-submission-form.test.ts.
 *
 * @module components/__tests__/preset-edit-form.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Dye } from '@xivdyetools/types';

const {
  mockShow,
  mockDismissTop,
  mockToastError,
  mockToastInfo,
  mockToastSuccess,
  mockToastWarning,
  mockEditPreset,
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
    mockShow: vi.fn().mockReturnValue('modal-id-preset-edit'),
    mockDismissTop: vi.fn(),
    mockToastError: vi.fn(),
    mockToastInfo: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastWarning: vi.fn(),
    mockEditPreset: vi.fn(),
    mockDyes: [
      makeDye({ id: 1, itemID: 10001, stainID: 1, name: 'Snow White', hex: '#F0F0F0' }),
      makeDye({ id: 2, itemID: 10002, stainID: 2, name: 'Ash Grey', hex: '#808080' }),
      makeDye({ id: 3, itemID: 10003, stainID: 3, name: 'Soot Black', hex: '#101010' }),
      makeDye({ id: 4, itemID: 10004, stainID: 4, name: 'Rose Pink', hex: '#F0A0B0' }),
    ] as Dye[],
  };
});

vi.mock('@services/index', () => ({
  ModalService: {
    show: mockShow,
    dismissTop: mockDismissTop,
  },
  LanguageService: {
    // Echo the key back so a rendered English literal fails loudly.
    t: (key: string) => key,
    tInterpolate: (key: string, vars: Record<string, string | number>) =>
      `${key}:${JSON.stringify(vars)}`,
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
  resolvePresetDye: (stainID: number) => mockDyes.find((d) => d.stainID === stainID) ?? null,
  authService: {
    isAuthenticated: () => true,
    getUser: () => ({ id: 'author-1' }),
  },
  presetSubmissionService: {
    editPreset: mockEditPreset,
  },
}));

vi.mock('@services/preset-submission-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@services/preset-submission-service')>();
  return {
    ...actual,
    uploadPreviewImage: vi.fn(),
    removePreviewImage: vi.fn(),
  };
});

import { showPresetEditForm } from '../preset-edit-form';
import type { CommunityPreset } from '@services/community-preset-service';

/** 48 characters — long enough to clear MIN_DESC_LENGTH. */
const DESCRIPTION = 'A perfectly adequate description of a palette.xx';

function makePreset(overrides: Partial<CommunityPreset> = {}): CommunityPreset {
  return {
    id: 'preset-1',
    name: 'Abyssal Knight',
    description: DESCRIPTION,
    category_id: 'events',
    secondary_categories: [],
    dyes: [1, 2, 3],
    tags: ['dark', 'tank'],
    author_discord_id: 'author-1',
    ...overrides,
  } as unknown as CommunityPreset;
}

function getFormContent(): HTMLElement {
  const config = mockShow.mock.calls[mockShow.mock.calls.length - 1][0];
  return config.content as HTMLElement;
}

function getModalTitle(): string {
  return mockShow.mock.calls[mockShow.mock.calls.length - 1][0].title as string;
}

describe('showPresetEditForm — localization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockShow.mockReturnValue('modal-id-preset-edit');
    mockEditPreset.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('takes the modal title, labels and placeholders from translation keys', () => {
    showPresetEditForm(makePreset());
    const content = getFormContent();

    expect(getModalTitle()).toBe('preset.editTitle');

    expect(content.querySelector('label[for="edit-preset-name"]')?.textContent).toBe(
      'preset.fieldName'
    );
    expect(content.querySelector<HTMLInputElement>('#edit-preset-name')?.placeholder).toBe(
      'preset.fieldNamePlaceholder'
    );

    expect(content.querySelector('label[for="edit-preset-description"]')?.textContent).toBe(
      'preset.fieldDesc'
    );
    expect(
      content.querySelector<HTMLTextAreaElement>('#edit-preset-description')?.placeholder
    ).toBe('preset.fieldDescPlaceholder');

    expect(content.querySelector('label[for="edit-preset-tags"]')?.textContent).toBe(
      'preset.fieldTags common.optional'
    );
    expect(content.querySelector<HTMLInputElement>('#edit-preset-tags')?.placeholder).toBe(
      'preset.fieldTagsPlaceholder'
    );
  });

  it('takes the dye-selector label, counters and search placeholder from keys', () => {
    showPresetEditForm(makePreset());
    const content = getFormContent();

    const dyeCounter = content.querySelector('#edit-dye-counter');
    expect(dyeCounter?.previousElementSibling?.textContent).toBe('preset.dyes — preset.dyesReq');
    // 3 selected of a 3–6 range, rendered through the shared counter key.
    expect(dyeCounter?.textContent).toBe('preset.counterWithMin:{"n":3,"max":6,"min":3}');

    const searchInput = content.querySelector('#edit-dye-grid')
      ?.previousElementSibling as HTMLInputElement;
    expect(searchInput.placeholder).toBe('colorPalette.searchPlaceholder');

    // Description counter shares the same key.
    const descCounter = content.querySelector('#edit-preset-description')?.nextElementSibling;
    expect(descCounter?.textContent).toBe(
      `preset.counterWithMin:{"n":${DESCRIPTION.length},"max":200,"min":10}`
    );
  });

  it('takes the tags hint and both buttons from keys', () => {
    showPresetEditForm(makePreset());
    const content = getFormContent();

    const tagsHint = content.querySelector('#edit-preset-tags')?.nextElementSibling;
    expect(tagsHint?.textContent).toBe('preset.fieldTagsLimit:{"max":10,"chars":30}');

    const saveBtn = content.querySelector<HTMLButtonElement>('#save-preset-btn')!;
    expect(saveBtn.textContent).toBe('preset.saveChanges');
    expect(saveBtn.previousElementSibling?.textContent).toBe('common.cancel');
  });

  it('renders the empty dye grid message from keys', () => {
    showPresetEditForm(makePreset());
    const content = getFormContent();

    const searchInput = content.querySelector('#edit-dye-grid')
      ?.previousElementSibling as HTMLInputElement;
    const grid = content.querySelector('#edit-dye-grid')!;

    searchInput.value = 'zzzznothingmatches';
    searchInput.dispatchEvent(new Event('input'));
    expect(grid.textContent).toBe('colorPalette.noDyesFound');

    // A query that matches only already-selected dyes gets the other message.
    searchInput.value = 'snow white';
    searchInput.dispatchEvent(new Event('input'));
    expect(grid.textContent).toBe('preset.allMatchingSelected');
  });

  it('labels dye chips and swatches with the localized dye name', () => {
    showPresetEditForm(makePreset());
    const content = getFormContent();

    const chipNames = Array.from(content.querySelectorAll('#edit-selected-dyes > div > span')).map(
      (el) => el.textContent
    );
    expect(chipNames).toEqual(['Snow White', 'Ash Grey', 'Soot Black']);

    const swatch = content.querySelector<HTMLButtonElement>('#edit-dye-grid button')!;
    expect(swatch.title).toBe('Rose Pink');
  });

  it('raises one toast per validation error instead of a joined sentence', () => {
    showPresetEditForm(makePreset());
    const content = getFormContent();

    const name = content.querySelector<HTMLInputElement>('#edit-preset-name')!;
    name.value = 'x';
    name.dispatchEvent(new Event('input'));

    const description = content.querySelector<HTMLTextAreaElement>('#edit-preset-description')!;
    description.value = 'short';
    description.dispatchEvent(new Event('input'));

    // Drop two of the three dyes so the minimum fails too.
    const removeButtons = () =>
      content.querySelectorAll<HTMLButtonElement>('#edit-selected-dyes button');
    removeButtons()[0].click();
    removeButtons()[0].click();

    content.querySelector<HTMLButtonElement>('#save-preset-btn')!.click();

    expect(mockToastError).toHaveBeenCalledTimes(3);
    expect(mockToastError).toHaveBeenNthCalledWith(1, 'preset.validation.nameMin:{"n":2}');
    expect(mockToastError).toHaveBeenNthCalledWith(2, 'preset.validation.descMin:{"n":10}');
    expect(mockToastError).toHaveBeenNthCalledWith(3, 'preset.validation.dyesMin:{"n":3}');
    expect(mockEditPreset).not.toHaveBeenCalled();
  });

  it('shows the localized busy label while saving and restores the button label', async () => {
    let resolveEdit: (value: { success: boolean }) => void = () => {};
    mockEditPreset.mockReturnValue(
      new Promise<{ success: boolean }>((resolve) => {
        resolveEdit = resolve;
      })
    );

    showPresetEditForm(makePreset());
    const content = getFormContent();

    const name = content.querySelector<HTMLInputElement>('#edit-preset-name')!;
    name.value = 'A Renamed Preset';
    name.dispatchEvent(new Event('input'));

    const saveBtn = content.querySelector<HTMLButtonElement>('#save-preset-btn')!;
    saveBtn.click();

    expect(saveBtn.textContent).toBe('preset.saving');

    resolveEdit({ success: true });
    await vi.waitFor(() => expect(saveBtn.textContent).toBe('preset.saveChanges'));
  });

  // BUG-081: the grid rendered `availableDyes.slice(0, 100)`, a cap from when
  // the database was smaller. With 125 dyes it silently hid 25 of them -- and
  // the sibling SUBMISSION form renders all of them, so a palette could be
  // created out of a dye the edit form would not show.
  it('renders every available dye, not just the first 100', () => {
    const original = mockDyes.slice();
    mockDyes.length = 0;
    // The real database size.
    for (let i = 1; i <= 125; i += 1) {
      mockDyes.push({
        ...original[0],
        id: 10000 + i,
        itemID: 10000 + i,
        stainID: i,
        name: `Dye ${i}`,
      } as Dye);
    }

    try {
      showPresetEditForm(makePreset({ dyes: [1, 2, 3] }));
      const content = getFormContent();

      const swatches = content.querySelectorAll('#edit-dye-grid button');
      // 125 in the database, minus the 3 already on the preset.
      expect(swatches).toHaveLength(122);
    } finally {
      mockDyes.length = 0;
      mockDyes.push(...original);
    }
  });

  // BUG-083: MAX_TAGS and MAX_TAG_LENGTH were printed in the field hint and
  // enforced nowhere on the form, so an over-long tag list travelled to
  // presetSubmissionService.editPreset() and came back as a service-level
  // rejection instead of inline feedback.
  describe('tag limits (BUG-083)', () => {
    function submitWithTags(tags: string): void {
      showPresetEditForm(makePreset());
      const content = getFormContent();
      const input = content.querySelector<HTMLInputElement>('#edit-preset-tags')!;
      input.value = tags;
      input.dispatchEvent(new Event('input'));
      content.querySelector<HTMLButtonElement>('#save-preset-btn')!.click();
    }

    it('rejects more than MAX_TAGS tags', () => {
      submitWithTags(Array.from({ length: 11 }, (_, i) => `tag${i}`).join(','));

      expect(mockToastError).toHaveBeenCalledWith('preset.validation.tagsMax:{"n":10}');
      expect(mockEditPreset).not.toHaveBeenCalled();
    });

    it('rejects a tag longer than MAX_TAG_LENGTH', () => {
      submitWithTags(`short,${'x'.repeat(31)}`);

      expect(mockToastError).toHaveBeenCalledWith('preset.validation.tagLength:{"n":30}');
      expect(mockEditPreset).not.toHaveBeenCalled();
    });

    it('accepts exactly MAX_TAGS tags of exactly MAX_TAG_LENGTH', () => {
      submitWithTags(Array.from({ length: 10 }, () => 'x'.repeat(30)).join(','));

      expect(mockToastError).not.toHaveBeenCalled();
      expect(mockEditPreset).toHaveBeenCalled();
    });
  });
});
