/**
 * XIV Dye Tools 5.0 — My Submissions modal (8S shared flow, 620px).
 *
 * The screen the shipped app never had: every submission with its status —
 * LIVE (green) · IN REVIEW (amber) · NOT PUBLISHED (red) — a note for the
 * non-live states, and per-status actions on one line. A rejected
 * submission used to just fail to appear, with the reason living only in
 * the moderation worker; until the presets-api exposes that reason, the
 * rejected note falls back to the review explanation.
 *
 * @module components/my-submissions-modal
 */

import { ModalService, type ModalId } from '@services/modal-service';
import { LanguageService } from '@services/language-service';
import { ToastService } from '@services/toast-service';
import { presetSubmissionService } from '@services/preset-submission-service';
import { resolvePresetDye } from '@services/dye-service-wrapper';
import { escapeHtml } from '@shared/utils';
import type { CommunityPreset } from '@services/community-preset-service';

type StatusKind = 'live' | 'review' | 'rejected';

function statusKind(preset: CommunityPreset): StatusKind {
  switch (preset.status) {
    case 'approved':
      return 'live';
    case 'rejected':
      return 'rejected';
    case 'pending':
    case 'flagged':
    default:
      return 'review';
  }
}

const STATUS_TONE: Record<StatusKind, string> = {
  live: '#61C554',
  review: '#F4BF4F',
  rejected: '#F4645A',
};

function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function statValue(value: string, label: string, color: string): string {
  return `
    <div style="flex: 1; min-width: 0; text-align: center; padding: 10px 6px; border: 1px solid var(--theme-border); border-radius: 10px;">
      <div style="font-family: var(--font-mono); font-size: 20px; color: ${color};">${value}</div>
      <div style="font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 1px; color: var(--theme-text-muted); margin-top: 2px;">${label}</div>
    </div>`;
}

function bandFor(preset: CommunityPreset): string {
  const segs = preset.dyes
    .map((id) => resolvePresetDye(id) ?? null)
    .filter((d) => d !== null)
    .map((d) => `<span style="flex: 1; background: ${d!.hex};"></span>`)
    .join('');
  return `<span style="display: flex; width: 56px; height: 22px; border-radius: 6px; overflow: hidden; border: 1px solid var(--theme-border); flex: 0 0 auto;">${segs}</span>`;
}

// BUG-101 (2026-10-04 deep-dive): the rows, tiles and subtitle are built once,
// so after a delete the list is closed and reopened from a fresh fetch. That
// state lives here, not in one modal's closure, because the reopen makes a new
// modal: a DELETE still in flight from the old list must refresh the new one.
// The refresh waits until every DELETE has answered (overlapping deletes
// refresh once, after the last, so no fetch races a DELETE still running) and
// until the list is the top modal — reopening it while the next row's confirm
// dialog is open would push the list ON TOP of that confirm and bury it.

/** DELETEs sent from My Submissions that have not answered yet. */
let deletesInFlight = 0;
/** A delete has succeeded since the open list's rows were fetched. */
let listStale = false;
/** The My Submissions modal on screen, if any. */
let openList: { id: ModalId; onChanged?: () => void } | null = null;

/** Reopen the open list from a fresh fetch, if a delete left it stale and nothing blocks it. */
function refreshIfStale(): void {
  if (!listStale || deletesInFlight > 0 || !openList) return;
  // Not on top: the stack listener retries once the modals above it close.
  if (ModalService.getTopModal()?.id !== openList.id) return;
  const { id, onChanged } = openList;
  openList = null;
  ModalService.dismiss(id);
  void showMySubmissionsModal(onChanged);
}

/**
 * Show the 8S My Submissions modal. Fetches fresh; each row carries its
 * status chip, note, and per-status actions.
 */
export async function showMySubmissionsModal(onChanged?: () => void): Promise<void> {
  const t = (key: string) => LanguageService.t(key);

  // This fetch is the fresh list; a delete that lands from here on marks it stale again.
  listStale = false;
  let presets: CommunityPreset[] = [];
  try {
    const response = await presetSubmissionService.getMySubmissions();
    presets = response.presets;
  } catch {
    ToastService.error(t('errors.apiFailed'));
    return;
  }

  const live = presets.filter((p) => statusKind(p) === 'live');
  const awaiting = presets.filter((p) => statusKind(p) === 'review');
  const totalVotes = live.reduce((sum, p) => sum + p.vote_count, 0);

  const content = document.createElement('div');

  const rows = presets
    .map((preset, index) => {
      const kind = statusKind(preset);
      const tone = STATUS_TONE[kind];
      const statusLabel =
        kind === 'live'
          ? t('preset.statusLive')
          : kind === 'review'
            ? t('preset.statusReview')
            : t('preset.statusRejected');
      // Rejected rows show the actual moderation reason (joined by the API
      // from moderation_log); the review note is the fallback.
      // SECURITY (FINDING-011): the reason is moderator-typed text and the
      // name is author-typed text — both remote strings, both interpolated
      // into the innerHTML template below, so both are escaped here. Every
      // other interpolation in this file is code-controlled (t() strings,
      // dye-DB hex values, numbers, the tint()/tone palette).
      const note = escapeHtml(
        kind === 'live'
          ? ''
          : kind === 'rejected'
            ? preset.rejection_reason || t('preset.reviewNote')
            : t('preset.reviewNote')
      );
      const name = escapeHtml(preset.name);
      // Only a live row has a published vote tally; the others show an em
      // dash in the count slot so the label still reads as a votes column.
      const votesText =
        kind === 'live'
          ? LanguageService.tInterpolate(
              preset.vote_count === 1 ? 'preset.votesCountOne' : 'preset.votesCount',
              { n: preset.vote_count }
            )
          : LanguageService.tInterpolate('preset.votesCount', { n: '—' });
      const actions =
        kind === 'live'
          ? [
              { id: 'view', label: t('preset.actView') },
              { id: 'edit', label: t('preset.edit') },
              { id: 'delete', label: t('preset.delete') },
            ]
          : kind === 'review'
            ? [
                { id: 'edit', label: t('preset.edit') },
                { id: 'delete', label: t('preset.delete') },
              ]
            : [
                { id: 'edit', label: t('preset.edit') },
                { id: 'resubmit', label: t('preset.actResubmit') },
                { id: 'delete', label: t('preset.delete') },
              ];
      const actionButtons = actions
        .map((action, actionIndex) => {
          const destructive = actionIndex === actions.length - 1;
          return `<button data-action="${action.id}" data-index="${index}" style="font-size: 11.5px; font-weight: 600; padding: 5px 11px; border-radius: 7px; cursor: pointer; border: 1px solid ${
            destructive ? tint('#F4645A', 0.3) : 'var(--theme-border)'
          }; background: ${destructive ? 'transparent' : 'var(--theme-card-background)'}; color: ${
            destructive ? '#F4645A' : 'var(--theme-text)'
          };">${action.label}</button>`;
        })
        .join('');

      return `
        <div style="border: 1px solid ${kind === 'rejected' ? tint('#F4645A', 0.35) : 'var(--theme-border)'}; border-radius: 10px; padding: 12px 14px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            ${bandFor(preset)}
            <span style="flex: 1; min-width: 0; font-size: 13.5px; font-weight: 650; color: var(--theme-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${name}</span>
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--theme-text-muted); flex: 0 0 auto;">${votesText}</span>
            <span style="font-family: var(--font-mono); font-size: 8.5px; letter-spacing: 1px; padding: 3px 7px; border-radius: 5px; background: ${tint(tone, 0.16)}; color: ${tone}; flex: 0 0 auto;">${statusLabel}</span>
          </div>
          ${
            note
              ? `<div style="font-size: 11.5px; line-height: 1.5; color: var(--theme-text); background: ${tint(tone, 0.08)}; border-radius: 7px; padding: 7px 10px; margin-top: 8px;">${note}</div>`
              : ''
          }
          <div style="display: flex; gap: 6px; margin-top: 9px;">${actionButtons}</div>
        </div>`;
    })
    .join('');

  content.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 16px;">
      ${statValue(String(live.length), t('preset.statPublished'), '#61C554')}
      ${statValue(String(totalVotes), t('preset.statTotalVotes'), 'var(--theme-primary)')}
      ${statValue(String(awaiting.length), t('preset.statAwaitingReview'), '#F4BF4F')}
    </div>
    ${rows || `<p style="font-size: 13px; color: var(--theme-text-muted); text-align: center; padding: 24px 0;">${t('preset.noSubmissionsYet')}</p>`}
  `;

  content.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button[data-action]');
    if (!btn) return;
    const preset = presets[Number(btn.getAttribute('data-index'))];
    if (!preset) return;
    const action = btn.getAttribute('data-action');

    if (action === 'view') {
      ModalService.dismissTop();
      window.location.assign(`/presets/community-${preset.id}`);
      return;
    }
    if (action === 'edit' || action === 'resubmit') {
      ModalService.dismissTop();
      void import('./preset-edit-form').then(({ showPresetEditForm }) => {
        showPresetEditForm(preset, (result) => {
          if (result.success) onChanged?.();
        });
      });
      return;
    }
    if (action === 'delete') {
      const confirmEl = document.createElement('p');
      confirmEl.textContent = t('preset.confirmDelete');
      // modal-container closes the confirm dialog itself as soon as Confirm is
      // clicked, so nothing here dismisses it. BUG-088: `onConfirm` is async
      // and nothing awaits it, so the DELETE resolves at an arbitrary later
      // moment -- by which time the user may have opened another modal, and
      // `dismissTop()` would close THAT one. Hence refreshIfStale dismisses
      // the list by id, and only while the list is the top modal.
      ModalService.showConfirm({
        title: t('preset.deleteTitle'),
        content: confirmEl,
        destructive: true,
        confirmText: t('common.delete'),
        cancelText: t('common.cancel'),
        onConfirm: async () => {
          // Counted before the first await: modal-container dismisses the
          // confirm right after calling this, and that stack change must not
          // refresh the list while this DELETE is still running.
          deletesInFlight++;
          let result: Awaited<ReturnType<typeof presetSubmissionService.deletePreset>>;
          try {
            // BUG-032 (2026-10-04 deep-dive): deletePreset answers a failure
            // ({ success: false }) rather than throwing it.
            result = await presetSubmissionService.deletePreset(preset.id);
          } finally {
            deletesInFlight--;
          }
          if (result.success) {
            ToastService.success(t('preset.deleteSuccess'));
            onChanged?.();
            listStale = true;
          } else {
            ToastService.error(t('errors.deletePresetFailed'));
          }
          // On failure too: an earlier delete's refresh may be waiting on this one.
          refreshIfStale();
        },
      });
    }
  });

  // Runs on every route that closes the modal (✕, Esc, backdrop, an action
  // that leaves it, the refresh's own dismiss) — ModalService calls onClose
  // on each — so a DELETE landing after the user closed it reopens nothing.
  let unsubscribe: (() => void) | null = null;
  const modalId = ModalService.show({
    type: 'custom',
    onClose: () => {
      unsubscribe?.();
      if (openList?.id === modalId) openList = null;
    },
    title: t('preset.mySubmissions'),
    subtitle: `${LanguageService.tInterpolate(
      presets.length === 1 ? 'preset.mineSummaryPresetsOne' : 'preset.mineSummaryPresetsMany',
      { n: presets.length }
    )} · ${LanguageService.tInterpolate(
      totalVotes === 1 ? 'preset.votesCountOne' : 'preset.votesCount',
      { n: totalVotes }
    )}`,
    content,
    panelWidth: 620,
  });
  openList = { id: modalId, onChanged };
  // A refresh deferred while a confirm sat on top runs once the list is top
  // again. Queued, not run inside the notification: dismissing from within
  // it would hand the listeners after this one a stack that no longer exists.
  unsubscribe = ModalService.subscribe(() => queueMicrotask(refreshIfStale), {
    immediate: false,
  });
  // A DELETE that landed while this list was being fetched may be in it.
  refreshIfStale();
}
