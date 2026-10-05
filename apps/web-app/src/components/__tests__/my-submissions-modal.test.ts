/**
 * XIV Dye Tools - My Submissions modal tests
 *
 * The modal renders remote strings — the author's own preset name and the
 * moderator-typed rejection reason (`preset.rejection_reason`, joined by the
 * API from moderation_log) — into an imperative `innerHTML` template. Both
 * must land as TEXT: a moderator (or anyone who can write to moderation_log)
 * must not be able to put a phishing link or overlay inside the app's own
 * modal (2026-08-21 security audit, FINDING-011 / WEB-1).
 *
 * Follows the house style of preset-submission-form.test.ts: the modal
 * content is a detached DOM tree, grabbed off the `ModalService.show` call.
 *
 * @module components/__tests__/my-submissions-modal.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CommunityPreset } from '@services/community-preset-service';

const {
  mockShow,
  mockShowConfirm,
  mockDismiss,
  mockGetMySubmissions,
  mockDeletePreset,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockShow: vi.fn().mockReturnValue('modal-id-my-submissions'),
  mockShowConfirm: vi.fn().mockReturnValue('modal-id-confirm'),
  mockDismiss: vi.fn(),
  mockGetMySubmissions: vi.fn(),
  mockDeletePreset: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock('@services/modal-service', () => ({
  ModalService: {
    show: mockShow,
    showConfirm: mockShowConfirm,
    dismiss: mockDismiss,
    dismissTop: vi.fn(),
  },
}));

vi.mock('@services/language-service', () => ({
  LanguageService: {
    t: (key: string) => key,
    tInterpolate: (key: string, vars: Record<string, unknown>) => `${key}:${JSON.stringify(vars)}`,
  },
}));

vi.mock('@services/toast-service', () => ({
  ToastService: {
    success: mockToastSuccess,
    error: mockToastError,
  },
}));

vi.mock('@services/preset-submission-service', () => ({
  presetSubmissionService: {
    getMySubmissions: mockGetMySubmissions,
    deletePreset: mockDeletePreset,
  },
}));

vi.mock('@services/dye-service-wrapper', () => ({
  resolvePresetDye: (id: number) => ({ id, hex: '#FF0000' }),
}));

import { showMySubmissionsModal } from '../my-submissions-modal';

function makePreset(overrides: Partial<CommunityPreset> = {}): CommunityPreset {
  return {
    id: 'preset-1',
    name: 'Plain Name',
    description: 'A description',
    category_id: 'jobs',
    secondary_categories: [],
    dyes: [1, 2, 3],
    tags: [],
    author_discord_id: '123',
    author_name: 'Author',
    vote_count: 4,
    status: 'approved',
    is_curated: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    preview_image_status: 'none',
    ...overrides,
  } as CommunityPreset;
}

/** The modal content is a detached DOM tree — grab it off the ModalService.show call. */
function getContent(): HTMLElement {
  const config = mockShow.mock.calls[mockShow.mock.calls.length - 1][0];
  return config.content as HTMLElement;
}

describe('showMySubmissionsModal', () => {
  beforeEach(() => {
    mockShow.mockClear();
    mockShowConfirm.mockClear();
    mockDismiss.mockClear();
    mockToastSuccess.mockClear();
    mockToastError.mockClear();
    mockGetMySubmissions.mockReset();
    // No default: every delete test states what the DELETE answers.
    mockDeletePreset.mockReset();
  });

  it('renders one row per submission with its status chip and actions (positive control)', async () => {
    mockGetMySubmissions.mockResolvedValue({
      presets: [
        makePreset({ id: 'a', status: 'approved' }),
        makePreset({ id: 'b', status: 'pending' }),
        makePreset({ id: 'c', status: 'rejected', rejection_reason: 'Too similar to #12' }),
      ],
      total: 3,
    });

    await showMySubmissionsModal();

    const content = getContent();
    expect(content.textContent).toContain('preset.statusLive');
    expect(content.textContent).toContain('preset.statusReview');
    expect(content.textContent).toContain('preset.statusRejected');
    expect(content.textContent).toContain('Too similar to #12');
    expect(content.querySelectorAll('button[data-action="delete"]').length).toBe(3);
    expect(content.querySelector('button[data-action="view"]')).not.toBeNull();
    expect(content.querySelector('button[data-action="resubmit"]')).not.toBeNull();
  });

  it('renders the preset name as text, never as markup', async () => {
    const name = '<img src=x onerror="alert(1)"><b>Bold</b> name';
    mockGetMySubmissions.mockResolvedValue({ presets: [makePreset({ name })], total: 1 });

    await showMySubmissionsModal();

    const content = getContent();
    expect(content.querySelector('img, b')).toBeNull();
    expect(content.textContent).toContain(name);
  });

  it("renders a moderator's rejection reason as text, never as markup", async () => {
    const reason =
      'Policy violation. <a href="https://xivdyetools-appeals.example">Appeal here</a>' +
      '<div id="overlay" style="position:fixed;inset:0"></div>';
    mockGetMySubmissions.mockResolvedValue({
      presets: [makePreset({ status: 'rejected', rejection_reason: reason })],
      total: 1,
    });

    await showMySubmissionsModal();

    const content = getContent();
    expect(content.querySelector('a')).toBeNull();
    expect(content.querySelector('#overlay')).toBeNull();
    expect(content.textContent).toContain(reason);
  });

  it('falls back to the review note when a rejected preset carries no reason', async () => {
    mockGetMySubmissions.mockResolvedValue({
      presets: [makePreset({ status: 'rejected', rejection_reason: null })],
      total: 1,
    });

    await showMySubmissionsModal();

    expect(getContent().textContent).toContain('preset.reviewNote');
  });

  /**
   * BUG-082: getMySubmissions used to swallow every failure into an empty list,
   * so this modal's error branch was unreachable and an API outage rendered
   * "no submissions yet" with 0/0/0 stats — telling an author their work was
   * gone. The service now rejects on failure; these pin the consequence.
   */
  describe('when the API is unreachable', () => {
    it('raises an error instead of showing an empty list', async () => {
      const { ToastService } = await import('@services/toast-service');
      mockGetMySubmissions.mockRejectedValue(new Error('network down'));

      await showMySubmissionsModal();

      expect(ToastService.error).toHaveBeenCalled();
    });

    it('does not open the modal at all', async () => {
      mockGetMySubmissions.mockRejectedValue(new Error('network down'));

      await showMySubmissionsModal();

      expect(mockShow).not.toHaveBeenCalled();
    });
  });

  /**
   * Delete from a row: click its Delete, then run the confirm dialog's
   * onConfirm the way modal-container does (called, not awaited — the
   * container dismisses the confirm itself straight after) and let the
   * DELETE settle.
   */
  async function confirmDeleteOfFirstRow(): Promise<void> {
    getContent().querySelector<HTMLButtonElement>('button[data-action="delete"]')!.click();
    const confirm = mockShowConfirm.mock.calls[mockShowConfirm.mock.calls.length - 1][0];
    void confirm.onConfirm();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // 2026-10-04 deep-dive BUG-032: deletePreset never throws — it answers
  // { success: false } on a 403/429/5xx or a dropped connection — and this
  // handler ignored the answer, so every failure toasted "deleted".
  describe('when the delete fails (BUG-032)', () => {
    const onChanged = vi.fn();

    beforeEach(async () => {
      onChanged.mockClear();
      mockGetMySubmissions.mockResolvedValue({ presets: [makePreset()], total: 1 });
      mockDeletePreset.mockResolvedValueOnce({ success: false, error: 'Forbidden' });
      await showMySubmissionsModal(onChanged);
      await confirmDeleteOfFirstRow();
    });

    it('says it failed, not that it succeeded', () => {
      expect(mockToastError).toHaveBeenCalledWith('errors.deletePresetFailed');
      expect(mockToastSuccess).not.toHaveBeenCalled();
    });

    it('leaves the list underneath and this modal alone', () => {
      expect(onChanged).not.toHaveBeenCalled();
      expect(mockDismiss).not.toHaveBeenCalled();
      expect(mockShow).toHaveBeenCalledTimes(1);
    });
  });

  // 2026-10-04 deep-dive BUG-101: the rows, stat tiles and subtitle are built
  // once, so after a successful delete the modal kept listing the deleted
  // preset with the old counts.
  describe('when the delete succeeds (BUG-101)', () => {
    const onChanged = vi.fn();

    beforeEach(async () => {
      onChanged.mockClear();
      mockGetMySubmissions
        .mockResolvedValueOnce({
          presets: [makePreset({ id: 'gone', name: 'Deleted One' }), makePreset({ id: 'kept' })],
          total: 2,
        })
        .mockResolvedValueOnce({ presets: [makePreset({ id: 'kept' })], total: 1 });
      mockDeletePreset.mockResolvedValueOnce({ success: true });
      await showMySubmissionsModal(onChanged);
      await confirmDeleteOfFirstRow();
    });

    it('deletes the row that was clicked and says so', () => {
      expect(mockDeletePreset).toHaveBeenCalledWith('gone');
      expect(mockToastSuccess).toHaveBeenCalledWith('preset.deleteSuccess');
      expect(onChanged).toHaveBeenCalledTimes(1);
    });

    it('closes this modal by its own id and reopens it from a fresh fetch', () => {
      // By id, not dismissTop(): the DELETE settles at an arbitrary later
      // moment, when another modal may be on top (BUG-088).
      expect(mockDismiss).toHaveBeenCalledWith('modal-id-my-submissions');
      expect(mockGetMySubmissions).toHaveBeenCalledTimes(2);
      expect(mockShow).toHaveBeenCalledTimes(2);
      expect(getContent().textContent).not.toContain('Deleted One');
      expect(getContent().querySelectorAll('button[data-action="delete"]').length).toBe(1);
    });

    it('does not try to dismiss the confirm dialog, which modal-container already closed', () => {
      expect(mockDismiss).not.toHaveBeenCalledWith('modal-id-confirm');
    });
  });

  // The DELETE can take up to 15 s. A user who closed My Submissions in the
  // meantime must not have it pop back up when the DELETE lands.
  it('does not reopen My Submissions if the user closed it while the delete ran (BUG-101)', async () => {
    const onChanged = vi.fn();
    mockGetMySubmissions.mockResolvedValue({ presets: [makePreset()], total: 1 });
    let resolveDelete!: (value: { success: boolean }) => void;
    mockDeletePreset.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDelete = resolve;
      })
    );
    await showMySubmissionsModal(onChanged);
    const modalConfig = mockShow.mock.calls[0][0];
    await confirmDeleteOfFirstRow();

    // ✕ / Esc / backdrop: ModalService.dismiss runs the modal's onClose.
    modalConfig.onClose?.();
    resolveDelete({ success: true });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockToastSuccess).toHaveBeenCalledWith('preset.deleteSuccess');
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockDismiss).not.toHaveBeenCalled();
  });
});
