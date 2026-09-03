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

const { mockShow, mockGetMySubmissions } = vi.hoisted(() => ({
  mockShow: vi.fn().mockReturnValue('modal-id-my-submissions'),
  mockGetMySubmissions: vi.fn(),
}));

vi.mock('@services/modal-service', () => ({
  ModalService: {
    show: mockShow,
    showConfirm: vi.fn(),
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
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@services/preset-submission-service', () => ({
  presetSubmissionService: {
    getMySubmissions: mockGetMySubmissions,
    deletePreset: vi.fn(),
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
    mockGetMySubmissions.mockReset();
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
});
