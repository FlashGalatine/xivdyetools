/**
 * XIV Dye Tools - My Submissions modal against the REAL modal stack
 *
 * BUG-101 (2026-10-04 deep-dive) made a successful delete close My
 * Submissions and reopen it from a fresh fetch. The Sprint 4 review found two
 * ways that went wrong once deletes overlap, both only visible on the real
 * ModalService stack:
 *
 * (a) a DELETE that lands while the next row's confirm dialog is open reopened
 *     the list ON TOP of that destructive confirm, burying it;
 * (b) with two DELETEs in flight, the first one's reopen fetch could still list
 *     the second preset, and the second one's handler belonged to the closed
 *     list, so nothing refreshed again — the deleted row stayed listed.
 *
 * The presets-api is modelled as a mutable `server` list: GET answers a copy
 * of it, and a DELETE removes its row only when the test lets it land.
 *
 * @module components/__tests__/my-submissions-modal-stack.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { CommunityPreset } from '@services/community-preset-service';
import { ModalService } from '@services/modal-service';
import { LanguageService } from '@services/language-service';
import { ToastService } from '@services/toast-service';

const { mockGetMySubmissions, mockDeletePreset } = vi.hoisted(() => ({
  mockGetMySubmissions: vi.fn(),
  mockDeletePreset: vi.fn(),
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

function makePreset(id: string, name: string): CommunityPreset {
  return {
    id,
    name,
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
  } as CommunityPreset;
}

/** The presets-api's view of this author's submissions. */
let server: CommunityPreset[] = [];
/** DELETEs sent but not yet answered, by preset id. */
const pendingDeletes = new Map<string, (success: boolean) => void>();

/**
 * Answer the DELETE for `id`. On success the row leaves the server before the
 * client hears back; a refused DELETE leaves it there.
 */
async function landDelete(id: string, success = true): Promise<void> {
  pendingDeletes.get(id)!(success);
  pendingDeletes.delete(id);
  await flush();
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const stackTypes = () => ModalService.getModals().map((m) => m.type);

/** The My Submissions modal on the stack (there is at most one). */
function listContent(): HTMLElement {
  const lists = ModalService.getModals().filter((m) => m.type === 'custom');
  expect(lists).toHaveLength(1);
  return lists[0].content!;
}

/** Click a row's Delete — the confirm dialog opens on top of the list. */
function clickDelete(name: string): void {
  const row = Array.from(listContent().querySelectorAll('button[data-action="delete"]')).find(
    (btn) => btn.closest('div[style*="border-radius: 10px"]')?.textContent?.includes(name)
  ) as HTMLButtonElement | undefined;
  if (!row) throw new Error(`no Delete button on the row for "${name}"`);
  row.click();
  expect(ModalService.getTopModal()?.type).toBe('confirm');
}

/** Press Confirm the way modal-container does: onConfirm() (not awaited), then dismiss. */
function pressConfirm(): void {
  const confirm = ModalService.getTopModal()!;
  expect(confirm.type).toBe('confirm');
  confirm.onConfirm?.();
  ModalService.dismiss(confirm.id);
}

/** Press Cancel the way modal-container does. */
function pressCancel(): void {
  const confirm = ModalService.getTopModal()!;
  expect(confirm.type).toBe('confirm');
  confirm.onCancel?.();
  ModalService.dismiss(confirm.id);
}

describe('My Submissions deletes on the real modal stack', () => {
  beforeEach(() => {
    vi.spyOn(ToastService, 'success').mockImplementation(() => '');
    vi.spyOn(ToastService, 'error').mockImplementation(() => '');
    server = [makePreset('a', 'Alpha'), makePreset('b', 'Bravo')];
    pendingDeletes.clear();
    mockGetMySubmissions.mockReset();
    mockGetMySubmissions.mockImplementation(async () => ({
      presets: [...server],
      total: server.length,
    }));
    mockDeletePreset.mockReset();
    mockDeletePreset.mockImplementation(
      (id: string) =>
        new Promise<{ success: boolean }>((resolve) => {
          pendingDeletes.set(id, (success) => {
            if (success) server = server.filter((p) => p.id !== id);
            resolve({ success });
          });
        })
    );
  });

  afterEach(async () => {
    // Every DELETE a test sends lands before the next test starts.
    for (const id of [...pendingDeletes.keys()]) await landDelete(id);
    ModalService.dismissAll();
    await flush();
    vi.restoreAllMocks();
  });

  it("does not bury the next row's confirm dialog under a reopened list", async () => {
    await showMySubmissionsModal();
    clickDelete('Alpha');
    pressConfirm();
    clickDelete('Bravo');
    expect(stackTypes()).toEqual(['custom', 'confirm']);

    await landDelete('a');

    // Bravo's destructive confirm is still the dialog in front of the user.
    expect(stackTypes()).toEqual(['custom', 'confirm']);
    expect(ModalService.getTopModal()?.title).toBe(LanguageService.t('preset.deleteTitle'));

    // Cancelling it brings the list back on top — now from a fresh fetch.
    pressCancel();
    await flush();
    expect(stackTypes()).toEqual(['custom']);
    expect(mockGetMySubmissions).toHaveBeenCalledTimes(2);
    expect(listContent().textContent).not.toContain('Alpha');
    expect(listContent().textContent).toContain('Bravo');
  });

  it('leaves no deleted row listed when two deletes overlap', async () => {
    await showMySubmissionsModal();
    clickDelete('Alpha');
    pressConfirm();
    clickDelete('Bravo');
    pressConfirm();
    expect(stackTypes()).toEqual(['custom']);

    await landDelete('a');
    await landDelete('b');

    expect(server).toEqual([]);
    expect(stackTypes()).toEqual(['custom']);
    expect(listContent().textContent).not.toContain('Alpha');
    expect(listContent().textContent).not.toContain('Bravo');
    expect(listContent().textContent).toContain(LanguageService.t('preset.noSubmissionsYet'));
    // One refresh, once both had answered — not one per delete.
    expect(mockGetMySubmissions).toHaveBeenCalledTimes(2);
  });

  it('still refreshes for the first delete when the overlapping second one fails', async () => {
    await showMySubmissionsModal();
    clickDelete('Alpha');
    pressConfirm();
    clickDelete('Bravo');
    pressConfirm();

    await landDelete('a');
    // Bravo's DELETE is refused: the row stays on the server.
    await landDelete('b', false);

    expect(ToastService.error).toHaveBeenCalledWith(LanguageService.t('errors.deletePresetFailed'));
    expect(stackTypes()).toEqual(['custom']);
    expect(listContent().textContent).not.toContain('Alpha');
    expect(listContent().textContent).toContain('Bravo');
    expect(mockGetMySubmissions).toHaveBeenCalledTimes(2);
  });
});
